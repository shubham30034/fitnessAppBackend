const User = require('../Model/userModel/userModel');
const jwt = require('jsonwebtoken');




exports.authentication = (req,res,next)=>{
   try{

        const token = req.headers
        if(!token){
            return res.status(401).json({message:"unauthorized"})
        }

        jwt.verify(token,process.env.JWT_SECRET,(err,decoded)=>{
            if(err){
                return res.status(401).json({message:"unauthorized"})
            }
            req.user = decoded
            next()
        })
   }catch(err){
      return res.status(500).json({message:"server error",error:err.message})

}}



exports.isAdmin = (req,res,next)=>{
    try{
        const user = req.user
        if(!user){
            return res.status(401).json({message:"unauthorized"})
        }
        if(user.role !== 'admin'){
            return res.status(403).json({message:"forbidden"})
        }
        next()
    }catch(err){
        return res.status(500).json({message:"server error",error:err.message})
    }
}


exports.isAdmin = (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized: No user data' });
  
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden: Admins only' });
    }
    next();
  };
  
  exports.isSuperAdmin = (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized: No user data' });
  
    if (req.user.role !== 'superAdmin') {
      return res.status(403).json({ message: 'Forbidden: SuperAdmins only' });
    }
    next();
  };
  
  exports.isCoach = (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized: No user data' });
  
    if (req.user.role !== 'coach') {
      return res.status(403).json({ message: 'Forbidden: Coaches only' });
    }
    next();
  };
  
  exports.isSeller = (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized: No user data' });
  
    if (req.user.role !== 'seller') {
      return res.status(403).json({ message: 'Forbidden: Sellers only' });
    }
    next();
  };
  
  exports.isUser = (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized: No user data' });
  
    if (req.user.role !== 'user') {
      return res.status(403).json({ message: 'Forbidden: Users only' });
    }
    next();
  };
  

// authentication and authorization controller