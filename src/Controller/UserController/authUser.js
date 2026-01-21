const User = require('../../Model/userModel/userModel');
const RefreshToken = require('../../Model/userModel/refreshToken');
const Otp = require('../../Model/userModel/otpModel');
const BlacklistedToken = require('../../Model/userModel/blackListedToken');

const { generateToken } = require('../../Utils/Jwt');
const { sendOtpValidation, verifyOtpValidation } = require("../../validator/loginValidation");

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

/* =====================================================
   HELPERS
===================================================== */

const generateNumericOtp = () =>
  Math.floor(1000 + Math.random() * 9000).toString();

const hashToken = (token) => bcrypt.hash(token, 10);
const compareToken = (token, hash) => bcrypt.compare(token, hash);

/* =====================================================
   SEND OTP
===================================================== */
exports.sendOtp = async (req, res) => {
  try {
    const { phone } = req.body;

    const { error } = sendOtpValidation({ phone });
    if (error) {
      return res.status(400).json({ success: false, message: error.details[0].message });
    }

    let user = await User.findOne({ phone });
    if (!user) {
      user = await User.create({ phone, role: 'user' });
    }

    if (user.role !== 'user') {
      return res.status(403).json({ success: false, message: 'Invalid role for OTP login' });
    }

    // cooldown 60s
    const recentOtp = await Otp.findOne({
      userId: user._id,
      createdAt: { $gt: new Date(Date.now() - 60 * 1000) }
    });

    if (recentOtp) {
      return res.status(429).json({
        success: false,
        message: 'Please wait before requesting another OTP',
      });
    }

    await Otp.deleteMany({ userId: user._id });

    const otp = generateNumericOtp();
    const hashedOtp = await bcrypt.hash(otp, 10);

    await Otp.create({
      userId: user._id,
      otp: hashedOtp,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    const response = {
      success: true,
      message: 'OTP sent successfully',
    };

    // ⚠️ DEV ONLY
    if (process.env.NODE_ENV !== 'production') {
      response.otp = otp;
    }

    return res.status(200).json(response);

  } catch (error) {
    res.status(500).json({ success: false, message: 'OTP send failed', error: error.message });
  }
};

/* =====================================================
   VERIFY OTP / LOGIN
===================================================== */
exports.verifyOtp = async (req, res) => {
  try {
    const { phone, otp } = req.body;

    const { error } = verifyOtpValidation({ phone, otp });
    if (error) {
      return res.status(400).json({ success: false, message: error.details[0].message });
    }

    const user = await User.findOne({ phone }).populate('additionalInfo');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const otpDoc = await Otp.findOne({ userId: user._id }).sort({ createdAt: -1 });

    if (!otpDoc || new Date() > otpDoc.expiresAt) {
      return res.status(400).json({ success: false, message: 'OTP expired or invalid' });
    }

    const isValid = await bcrypt.compare(otp, otpDoc.otp);
    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }

    await Otp.deleteMany({ userId: user._id });

    const payload = { id: user._id, role: user.role };
    const { accessToken, refreshToken } = await generateToken(payload);

    const hashedRefresh = await hashToken(refreshToken);

    await RefreshToken.deleteMany({ userId: user._id });
    await RefreshToken.create({ userId: user._id, token: hashedRefresh });

    res.status(200).json({
      success: true,
      message: 'Logged in successfully',
      user: {
        id: user._id,
        phone: user.phone,
        name: user.additionalInfo?.name || '',
        email: user.additionalInfo?.email || '',
        role: user.role,
      },
      tokens: { accessToken, refreshToken },
    });

  } catch (error) {
    res.status(500).json({ success: false, message: 'OTP verification failed', error: error.message });
  }
};

/* =====================================================
   REFRESH TOKEN
===================================================== */
exports.regenerateRefreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ success: false, message: 'Refresh token required' });
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN);
    } catch {
      return res.status(401).json({ success: false, message: 'Invalid refresh token' });
    }

    const savedToken = await RefreshToken.findOne({ userId: decoded.id });
    if (!savedToken) {
      return res.status(401).json({ success: false, message: 'Session expired' });
    }

    const isMatch = await compareToken(refreshToken, savedToken.token);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid refresh token' });
    }

    await RefreshToken.deleteOne({ _id: savedToken._id });

    const payload = { id: decoded.id, role: decoded.role };
    const { accessToken, refreshToken: newRefresh } = await generateToken(payload);

    const hashedNew = await hashToken(newRefresh);
    await RefreshToken.create({ userId: decoded.id, token: hashedNew });

    res.status(200).json({
      success: true,
      accessToken,
      refreshToken: newRefresh,
    });

  } catch (error) {
    res.status(500).json({ success: false, message: 'Token refresh failed', error: error.message });
  }
};

/* =====================================================
   LOGOUT
===================================================== */
exports.logout = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    const authHeader = req.headers.authorization || req.headers.Authorization;
    const accessToken = authHeader?.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : null;

    if (!refreshToken || !accessToken) {
      return res.status(400).json({ success: false, message: "Tokens required" });
    }

    // 1) Try verify access token (for exp + userId)
    let decoded = null;
    try {
      decoded = jwt.verify(accessToken, process.env.JWT_SECRET);
    } catch (e) {
      // If expired/invalid, we still want to revoke refresh token (best effort)
      decoded = jwt.decode(accessToken); // might still give id/exp
    }

    // 2) Kill refresh tokens (single session policy)
    // Only if we have userId
    if (decoded?.id) {
      await RefreshToken.deleteMany({ userId: decoded.id });
    }

    // 3) Blacklist access token (raw, because middleware checks raw)
    // Avoid duplicates
    if (decoded?.exp) {
      await BlacklistedToken.findOneAndUpdate(
        { token: accessToken },
        {
          $setOnInsert: {
            token: accessToken,
            expiresAt: new Date(decoded.exp * 1000),
          },
        },
        { upsert: true }
      );
    }

    return res
      .status(200)
      .json({ success: true, message: "Logged out successfully" });
  } catch (error) {
    console.error("logout error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Logout failed" });
  }
};


/* =====================================================
   GET CURRENT USER
===================================================== */
exports.getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate('additionalInfo');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        phone: user.phone,
        name: user.additionalInfo?.name || '',
        email: user.additionalInfo?.email || '',
        role: user.role,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Fetch failed', error: error.message });
  }
};
