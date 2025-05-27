const User = require('../../Model/userModel/userModel');
// const UserAdditionalInfo = require('../../Model/userModel/userAdditionalInfo');
const RefreshToken = require('../../Model/userModel/refreshToken');
const {generateToken} = require('../../Utils/Jwt');
const bcrypt = require('bcrypt');
const Otp = require('../../Model/userModel/otpModel');
const jwt = require('jsonwebtoken');
const axios = require('axios');

const BlacklistedToken = require('../../Model/userModel/blackListedToken');
require('dotenv').config();



const sendOtpToUser = async (user, phone) => {
  const generateNumericOtp = () => Math.floor(1000 + Math.random() * 9000).toString();
  const otp = generateNumericOtp();
  console.log("Generated OTP (numeric only):", otp);

  const hashedOtp = await bcrypt.hash(otp, 10);
  const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

  const saveOtp  = await Otp.create({
    userId: user._id,
    otp: hashedOtp,
    expiresAt: otpExpiresAt,
  });


  if(!saveOtp) {
    console.error('Failed to save OTP to database');
    return null;
  }



  return otp
  // const data = {
  //   route: 'q', // transactional route
  //   message: `Your OTP is ${otp}. It is valid for 10 minutes.`,
  //   flash: 0,
  //   numbers: phone
  // };

  // try {
  //   const response = await axios.post(
  //     'https://www.fast2sms.com/dev/bulkV2',
  //     data,
  //     {
  //       headers: {
  //         authorization: process.env.FAST2SMS_API_KEY,
  //         'Content-Type': 'application/json'
  //       }
  //     }
  //   );

  //   console.log('Fast2SMS response:', response.data);

  //   if (!response.data.return) {
  //     console.error('Failed to send OTP. Response:', response.data);
  //     return null;
  //   }

  //   return response.data;

  // } catch (error) {
  //   console.error('Axios/Fast2SMS Error:', error.response?.data || error.message);
  //   return null;
  // }
};



// Controller: Send OTP
exports.sendOtp = async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ success: false, message: 'Phone number is required' });
    }

    let user = await User.findOne({ phone }).populate('additionalInfo');
    if (!user) {
      user = await User.create({ phone, role: 'user' });
    }

    if (user.role !== 'user') {
      return res.status(403).json({
        success: false,
        message: 'Only users with role "user" can request OTP',
      });
    }

    // ✅ Step 1: Check cooldown (60 seconds)
    const recentOtp = await Otp.findOne({
      userId: user._id,
      createdAt: { $gt: new Date(Date.now() - 60 * 1000) } // last 60 seconds
    });

    if (recentOtp) {
      const secondsRemaining = Math.ceil((recentOtp.createdAt.getTime() + 60 * 1000 - Date.now()) / 1000);
      return res.status(429).json({
        success: false,
        message: `Please wait ${secondsRemaining} seconds before requesting a new OTP`,
      });
    }

    // ✅ Step 2: Remove all previous OTPs (optional but clean)
    await Otp.deleteMany({ userId: user._id });

    // ✅ Step 3: Send new OTP
    const otp = await sendOtpToUser(user, phone);
    if (!otp) {
      return res.status(500).json({
        success: false,
        message: 'Failed to send OTP',
      });
    }

    res.status(200).json({
      success: true,
      message: 'OTP sent successfully',
      otp: otp, // ❗ REMOVE THIS IN PRODUCTION
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error sending OTP',
      error: error.message,
    });
  }
};


// Verify OTP
exports.verifyOtp = async (req, res) => {
  try {
    const { phone, otp } = req.body;

    const user = await User.findOne({ phone }).populate('additionalInfo');
    console.log("User found:", user);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.role !== 'user') {
      return res.status(403).json({ success: false, message: 'Only users with role \"user\" can log in' });
    }

    // ✅ Always fetch latest OTP
    const userOtp = await Otp.findOne({ userId: user._id }).sort({ createdAt: -1 });

    console.log("Fetched OTP:", userOtp);
    console.log("Current time:", new Date());
    console.log("OTP expiry:", userOtp?.expiresAt);

    if (!userOtp || new Date() > userOtp.expiresAt) {
      return res.status(400).json({
        success: false,
        message: 'OTP has expired or not found, please request a new one',
      });
    }

    const isMatch = await bcrypt.compare(otp, userOtp.otp);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }

    await Otp.deleteOne({ _id: userOtp._id }); // remove used OTP

    // 🔐 Generate JWT
    const payload = { id: user._id, role: user.role };
    const { accessToken, refreshToken } = await generateToken(payload);

    // delete Old RefreshToken 
   await RefreshToken.deleteOne({ userId: user._id });

const createRefreshToken = await RefreshToken.create({ 
  userId: user._id, 
  token: refreshToken 
});



    res.status(200).json({
      success: true,
      message: 'OTP verified successfully, you are logged in',
      user: {
        id: user._id,
        phone: user.phone,
        email: user.additionalInfo?.email || 'Not Provided',
        role: user.role,
        tokens: { accessToken, refreshToken },
      },
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error verifying OTP',
      error: error.message,
    });
  }
};



// Regenerate Refresh Token
exports.regenerateRefreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ success: false, message: 'Refresh token is required' });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
    if (!decoded) {
      return res.status(400).json({ success: false, message: 'Invalid refresh token' });
    }

    const existingToken = await RefreshToken.findOne({ token: refreshToken });
    if (!existingToken) {
      return res.status(400).json({ success: false, message: 'Invalid or expired refresh token' });
    }

    // Delete old token
    await RefreshToken.deleteOne({ token: refreshToken });

    const payload = { id: decoded.id || decoded.userId, role: decoded.role };
    const { accessToken, refreshToken: newRefreshToken } = generateToken(payload);

    await RefreshToken.create({ userId: payload.id, token: newRefreshToken });

    res.status(200).json({
      success: true,
      message: 'Tokens regenerated successfully',
      accessToken,
      refreshToken: newRefreshToken,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error regenerating refresh token', error: error.message });
  }
};

// Logout
exports.logout = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    const token = req.headers.authorization?.split(' ')[1]; // Correct extraction
   const accessToken = token


    if (!refreshToken || !accessToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token and access token are required',
      });
    }

    // ❌ Delete refresh token from DB
    const deleted = await RefreshToken.deleteOne({ token: refreshToken });

  console.log(deleted,"deleted");
  


    if (deleted.deletedCount === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired refresh token',
      });
    }

    // 🛑 Decode the access token and store in blacklist
    const decoded = jwt.verify(accessToken, process.env.JWT_SECRET);
    const expiresAt = new Date(decoded.exp * 1000);

    await BlacklistedToken.create({ token: accessToken, expiresAt });

    res.status(200).json({
      success: true,
      message: 'Logged out successfully, token blacklisted',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error during logout',
      error: error.message,
    });
  }
};

// Get Current User
exports.getCurrentUser = async (req, res) => {
  try {
    const userId = req.user.id;
    console.log("User ID from token:", userId);

    const user = await User.findById(userId).populate('additionalInfo');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }



    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        phone: user.phone,
        email: user.additionalInfo?.email || '',
        name: user.additionalInfo?.name || '',
        address: user.additionalInfo?.address || '',
        role: user.role,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching user', error: error.message });
  }
};
