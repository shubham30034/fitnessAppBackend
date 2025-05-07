const jwt = require('jsonwebtoken');


require('dotenv').config()


exports.generateToken = (payload) => {


   const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: '1d',
   });

   const refreshToken = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: '7d',
   });

   return { accessToken, refreshToken };


}