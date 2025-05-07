const User = require('../../Model/userModel/userModel');
const UserAdditionalInfo = require('../../Model/userModel/userAdditionalInfo');
const otpGenerator = require('otp-generator');
const request = require('request'); // For sending SMS using MSG91 API
const RefreshToken = require('../../Model/userModel/refreshToken'); 
const generateToken = require('../../Utils/Jwt'); // Assuming you have a utility function to generate JWT tokens
const bcrypt = require('bcrypt');

// Send OTP
const sendOtp = async (req, res) => {
  try {
    const { phone } = req.body;

    // Find user by phone and check if role is 'user'
    const user = await User.findOne({ phone }).populate('additionalInfo');
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (user.role !== 'user') {
      return res.status(403).json({ message: 'Only users with role "user" can log in' });
    }

    // Generate OTP (6 digits)
    const otp = otpGenerator.generate(6, { upperCase: false, specialChars: false });

    // Hash the OTP using bcrypt
    const hashedOtp = await bcrypt.hash(otp, 10); // 10 is the saltRounds (the higher, the more secure but slower)

    // Set OTP and expiry time (e.g., 10 minutes from now)
    const expiryTime = new Date();
    expiryTime.setMinutes(expiryTime.getMinutes() + 10); // Set expiry for 10 minutes

    // Save hashed OTP and expiry time to user model
    user.otp = hashedOtp;
    user.otpExpiresAt = expiryTime;

    await user.save();

    // Send OTP via SMS using MSG91 API
    const message = `Your OTP is ${otp}. It is valid for 10 minutes.`;
    const apiKey = process.env.MSG91_API_KEY;  // Replace with your actual MSG91 API key
    const senderId = process.env.MSG91_SENDER_ID;   // Replace with your sender ID (e.g., 'MSGIND')

    const smsUrl = `https://api.msg91.com/api/v2/sendsms`;

    const options = {
      url: smsUrl,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender: senderId,
        route: '4', // Route 4 for promotional SMS (adjust if needed)
        country: '91', // Country code for India (change it accordingly for other countries)
        sms: [
          {
            message: message,
            to: [phone], // Array of phone numbers
          },
        ],
      }),
    };

    // Send request to MSG91 API
    request(options, (error, response, body) => {
      if (error) {
        return res.status(500).json({ message: 'Error sending OTP via SMS', error: error.message });
      }

      if (response.statusCode === 200) {
        console.log(`OTP sent to ${phone}: ${otp}`);
        res.status(200).json({ message: 'OTP sent successfully to your phone' });
      } else {
        res.status(500).json({ message: 'Failed to send OTP', error: body });
      }
    });

  } catch (error) {
    res.status(500).json({ message: 'Error sending OTP', error: error.message });
  }
};

// Verify OTP
const verifyOtp = async (req, res) => {
  try {
    const { phone, otp } = req.body;

    // Find user by phone and check if role is 'user'
    const user = await User.findOne({ phone }).populate('additionalInfo');
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (user.role !== 'user') {
      return res.status(403).json({ message: 'Only users with role "user" can log in' });
    }

    // Check if OTP has expired manually
    const currentTime = new Date();
    if (currentTime > user.otpExpiresAt) {
      return res.status(400).json({ message: 'OTP has expired, please request a new one' });
    }

    // Compare entered OTP with the hashed OTP
    const isMatch = await bcrypt.compare(otp, user.otp);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid OTP' });
    }

    // OTP is valid, clear OTP fields
    user.otp = undefined;
    user.otpExpiresAt = undefined;
    await user.save();

    // Generate JWT token for the user access token and refresh token
    const payload = {
      id: user._id,
      role: user.role,
    };
    const { accessToken, refreshToken } = generateToken(user._id, payload, '1h'); // 1 hour expiry for access token

    // Save refresh token in the user model (optional, if you want to store it)
    const newRefreshToken = await RefreshToken.create({
      userId: user._id,
      token: refreshToken,
    });

    // User is now logged in, return user details
    res.status(200).json({
      message: 'OTP verified successfully, you are logged in',
      user: {
        id: user._id,
        phone: user.phone,
        email: user.additionalInfo ? user.additionalInfo.email : 'Not Provided',
        role: user.role,
        tokens: {
          accessToken,
          refreshToken: newRefreshToken.token,
        },
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Error verifying OTP', error: error.message });
  }
};

// Regenerate Refresh Token
exports.regenerateRefreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ message: 'Refresh token is required' });
    }

    // Verify the refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
    if (!decoded) {
      return res.status(400).json({ message: 'Invalid refresh token' });
    }

    // Find token in DB
    const existingToken = await RefreshToken.findOne({ token: refreshToken });
    if (!existingToken) {
      return res.status(400).json({ message: 'Invalid or expired refresh token' });
    }

    // Optional: Delete old token (prevent reuse)
    await RefreshToken.deleteOne({ token: refreshToken });

    // Generate new tokens
    const payload = {
      id: decoded.id || decoded.userId, // ensure consistent structure
      role: decoded.role,
    };

    const { accessToken, refreshToken: newRefreshToken } = generateToken(payload);

    // Save new refresh token in DB
    await RefreshToken.create({
      userId: payload.id,
      token: newRefreshToken,
    });

    res.status(200).json({
      message: 'Tokens regenerated successfully',
      accessToken,
      refreshToken: newRefreshToken,
    });

  } catch (error) {
    console.error('Token regeneration error:', error);
    res.status(500).json({ message: 'Error regenerating refresh token', error: error.message });
  }
};

// Logout
exports.logout = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ message: 'Refresh token is required' });
    }

    await RefreshToken.deleteOne({ token: refreshToken });

    res.status(200).json({ message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error during logout', error: error.message });
  }
};

// Get Current User
exports.getCurrentUser = async (req, res) => {
  try {
    const userId = req.user._id;

    const user = await User.findById(userId).populate('additionalInfo');
    if (!user) return res.status(404).json({ message: 'User not found' });

    res.status(200).json({
      id: user._id,
      phone: user.phone,
      email: user.additionalInfo?.email || '',
      name: user.additionalInfo?.name || '',
      address: user.additionalInfo?.address || '',
      role: user.role,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching user', error: error.message });
  }
};


