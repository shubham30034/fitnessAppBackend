const User = require('../Model/userModel/userModel');
const jwt = require('jsonwebtoken');
const BlacklistedToken = require('../Model/userModel/blackListedToken');

exports.authentication = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1]; // Correct extraction
  

    if (!token) {
      return res.status(401).json({ success: false, message: 'Unauthorized: No token provided' });
    }

    // 🔒 Check if token is blacklisted
    const blacklisted = await BlacklistedToken.findOne({ token });
    if (blacklisted) {
      return res.status(401).json({ success: false, message: 'Unauthorized: Token is blacklisted' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded) {
      return res.status(401).json({ success: false, message: 'Unauthorized: Invalid token' });
    }

    console.log("user",decoded)

    req.user = decoded;
    next();
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};


// Admin Authorization Middleware
exports.isAdmin = (req, res, next) => {
  if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized: No user data' });

  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Forbidden: Admins only' });
  }
  next();
};

// Super Admin Authorization Middleware
exports.isSuperAdmin = (req, res, next) => {
  if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized: No user data' });

  if (req.user.role !== 'superadmin') {
    return res.status(403).json({ success: false, message: 'Forbidden: SuperAdmins only' });
  }
  next();
};

// Coach Authorization Middleware
exports.isCoach = (req, res, next) => {
  if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized: No user data' });

  if (req.user.role !== 'coach') {
    return res.status(403).json({ success: false, message: 'Forbidden: Coaches only' });
  }
  next();
};

// Seller Authorization Middleware
exports.isSeller = (req, res, next) => {
  if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized: No user data' });

  if (req.user.role !== 'seller') {
    return res.status(403).json({ success: false, message: 'Forbidden: Sellers only' });
  }
  next();
};

// User Authorization Middleware
exports.isUser = (req, res, next) => {
  if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized: No user data' });

  if (req.user.role !== 'user') {
    return res.status(403).json({ success: false, message: 'Forbidden: Users only' });
  }
  next();
};
