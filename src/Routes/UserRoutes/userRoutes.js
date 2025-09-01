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
  deleteAdditionalInfo,
  getProfilePictureUrls
} = require("../../Controller/UserController/additionalInfo");







// Middleware
const { authentication, isUser } = require("../../Middleware/userAuth");
const { uploadSingleImage, handleUploadError } = require("../../Middleware/uploadProfileUser")

// Public routes
router.post("/send-otp", sendOtp);
router.post("/verify-otp", verifyOtp);
router.post("/refresh-token", regenerateRefreshToken);


// Protected routes for additional info

router.post("/additional-info", authentication,createAdditionalInfo)
router.get("/additional-info", authentication,getAdditionalInfo)
router.put("/additional-info", authentication, updateAdditionalInfo)
router.delete("/additional-info", authentication, deleteAdditionalInfo)
router.post("/additional-info/profile", authentication, uploadSingleImage, uploadProfilePicture);
router.get("/additional-info/profile", authentication, getProfilePictureUrls);
router.use(handleUploadError); // Add error handling middleware




// Protected routes
router.post("/logout", authentication, isUser, logout);
router.get("/me", authentication, isUser, getCurrentUser);

module.exports = router;
