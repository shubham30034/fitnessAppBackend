const User = require('../../Model/userModel/userModel');
const bcrypt = require('bcrypt');
const generateToken = require('../../Utils/Jwt');
const RefreshToken = require('../../Model/userModel/refreshToken');
const jwt = require('jsonwebtoken');

// Coach & Seller Login
exports.loginWithPassword = async (req, res) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({
        success: false,
        message: 'Phone number and password are required',
      });
    }

    const user = await User.findOne({ phone }).populate('additionalInfo');

    if (!user || !['coach', 'seller'].includes(user.role)) {
      return res.status(404).json({
        success: false,
        message: 'Coach or Seller not found',
      });
    }

    if (!user.password) {
      return res.status(400).json({
        success: false,
        message: 'Password not set for this account',
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid password',
      });
    }

    const payload = { id: user._id, role: user.role };
    const { accessToken, refreshToken } = generateToken(payload);

    await RefreshToken.create({
      userId: user._id,
      token: refreshToken,
    });

    res.status(200).json({
      success: true,
      message: 'Login successful',
      user: {
        id: user._id,
        phone: user.phone,
        role: user.role,
        email: user.additionalInfo?.email || '',
        name: user.additionalInfo?.name || '',
      },
      tokens: {
        accessToken,
        refreshToken,
      },
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Login error',
      error: error.message,
    });
  }
};

// Logout
exports.logout = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ success: false, message: 'Refresh token is required' });
    }

    await RefreshToken.deleteOne({ token: refreshToken });
    res.status(200).json({ success: true, message: 'Logged out successfully' });

  } catch (error) {
    res.status(500).json({ success: false, message: 'Error during logout', error: error.message });
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
    const existingToken = await RefreshToken.findOne({ token: refreshToken });
    if (!existingToken) {
      return res.status(400).json({ success: false, message: 'Invalid or expired refresh token' });
    }

    await RefreshToken.deleteOne({ token: refreshToken });

    const payload = { id: decoded.id, role: decoded.role };
    const { accessToken, refreshToken: newRefreshToken } = generateToken(payload);

    await RefreshToken.create({
      userId: payload.id,
      token: newRefreshToken,
    });

    res.status(200).json({
      success: true,
      message: 'Tokens regenerated successfully',
      accessToken,
      refreshToken: newRefreshToken,
    });

  } catch (error) {
    res.status(500).json({ success: false, message: 'Error regenerating token', error: error.message });
  }
};

// Get Current User
exports.getCurrentUser = async (req, res) => {
  try {
    const userId = req.user._id;

    const user = await User.findById(userId).populate('additionalInfo');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        phone: user.phone,
        role: user.role,
        email: user.additionalInfo?.email || '',
        name: user.additionalInfo?.name || '',
      },
    });

  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching user', error: error.message });
  }
};
