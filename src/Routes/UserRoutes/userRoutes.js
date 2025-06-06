const express = require("express");
const router = express.Router();

// Controller functions
const {
  sendOtp,
  verifyOtp,
  regenerateRefreshToken,
  logout,
  getCurrentUser,
} = require("../../Controller/UserController/authUser");


// additional info controller
const {
  createAdditionalInfo,
  getAdditionalInfo,
  updateAdditionalInfo,
  uploadProfilePicture,
  deleteAdditionalInfo
} = require("../../Controller/UserController/additionalInfo");







// Middleware
const { authentication, isUser } = require("../../Middleware/userAuth");
const uploadProfileImage = require("../../Middleware/uploadProfileUser")

// Public routes
router.post("/send-otp", sendOtp);
router.post("/verify-otp", verifyOtp);
router.post("/refresh-token", regenerateRefreshToken);


// Protected routes for additional info

router.post("/additional-info", authentication,createAdditionalInfo)
router.get("/additional-info", authentication,getAdditionalInfo)
router.delete("/additional-info", authentication, deleteAdditionalInfo); 
router.put("/additional-info", authentication, uploadProfileImage,uploadProfilePicture);




// Protected routes
router.post("/logout", authentication, isUser, logout);
router.get("/me", authentication, isUser, getCurrentUser);

module.exports = router;
