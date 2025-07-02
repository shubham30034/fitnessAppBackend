const User = require('../../Model/userModel/userModel');
const bcrypt = require('bcrypt');
const {generateToken} = require('../../Utils/Jwt');
const RefreshToken = require('../../Model/userModel/refreshToken');
const jwt = require('jsonwebtoken');
const BlacklistedToken = require('../../Model/userModel/blackListedToken');
const {loginValidation} = require("../../validator/coachSellerValidation")

// Coach & Seller Login
exports.loginWithPassword = async (req, res) => {
  try {
    const { phone, password } = req.body;

    const { error } = loginValidation({ phone, password });
    if (error) {
    return res.status(400).json({
     success: false,
     message: 'Validation failed',
    errors: error.details.map(e => e.message),
     });
   }
    
    const user = await User.findOne({ phone }).populate('additionalInfo');
  
    if(!user){
      return res.status(400).json({
        success:false,
        message:"unable to find offical"
      })
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
    const { accessToken, refreshToken } = await generateToken(payload);

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


// controller/coachAuthController.js

exports.getMe = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId).populate('additionalInfo');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
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
    res.status(500).json({
      success: false,
      message: "Error retrieving user",
      error: error.message,
    });
  }
};





// Logout
exports.logout = async (req, res) => {
  try {
    const { refreshToken } = req.body;
   const token = req.headers.authorization?.split(' ')[1]; // Correct extraction
   const accessToken = token


    console.log("refreshToken", refreshToken);

    if (!refreshToken || !accessToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token and access token are required',
      });
    }

    // ❌ Delete refresh token from DB
    const deleted = await RefreshToken.deleteOne({ token: refreshToken });

    console.log(deleted, "deleted");

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
    const userId = req.user.id;

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
