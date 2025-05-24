const jwt = require('jsonwebtoken');
require('dotenv').config();

exports.generateToken = async(payload) => {

  try {
    const accessToken = await jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: '1d',
    });
  
    const refreshToken = jwt.sign(payload, process.env.REFRESH_TOKEN, {
      expiresIn: '30d',
    });
  
    return { accessToken, refreshToken };
    
  } catch (error) {
    console.error('Error generating token:', error);
    throw new Error('Token generation failed');
  }


};
