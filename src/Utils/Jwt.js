const jwt = require('jsonwebtoken');
require('dotenv').config();

exports.generateToken = async(payload) => {
  try {
    const accessToken = await jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: '1d',
      issuer: 'fitness-app',
      audience: 'fitness-app-users',
    });
  
    const refreshToken = jwt.sign(payload, process.env.REFRESH_TOKEN, {
      expiresIn: '30d',
      issuer: 'fitness-app',
      audience: 'fitness-app-users',
    });
  
    return { accessToken, refreshToken };
    
  } catch (error) {
    console.error('Error generating token:', error);
    throw new Error('Token generation failed');
  }
};

// Add token verification utility
exports.verifyToken = (token, secret) => {
  try {
    return jwt.verify(token, secret, {
      issuer: 'fitness-app',
      audience: 'fitness-app-users',
    });
  } catch (error) {
    throw error;
  }
};
