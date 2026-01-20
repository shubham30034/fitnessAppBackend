const express = require("express");
const router = express.Router();

/* ===============================
   CONTROLLERS
================================ */
const {
  sendOtp,
  verifyOtp,
  regenerateRefreshToken,
  logout,
  getCurrentUser,
} = require("../../Controller/UserController/authUser");

const {
  createAdditionalInfo,
  getAdditionalInfo,
  updateAdditionalInfo,
  uploadProfilePicture,
  deleteAdditionalInfo,
  getProfilePictureUrls,
} = require("../../Controller/UserController/additionalInfo");

/* ===============================
   MIDDLEWARE
================================ */
const { authentication, isUser } = require("../../Middleware/userAuth");
const {
  uploadSingleImage,
  handleUploadError,
} = require("../../Middleware/uploadProfileUser");

/* ===============================
   PUBLIC ROUTES
================================ */
router.post("/send-otp", sendOtp);
router.post("/verify-otp", verifyOtp);
router.post("/refresh-token", regenerateRefreshToken);

/* ===============================
   USER ROUTES
================================ */
router.post("/additional-info", authentication, isUser, createAdditionalInfo);
router.get("/additional-info", authentication, isUser, getAdditionalInfo);
router.put("/additional-info", authentication, isUser, updateAdditionalInfo);
router.delete("/additional-info", authentication, isUser, deleteAdditionalInfo);

router.post(
  "/additional-info/profile",
  authentication,
  isUser,
  uploadSingleImage,
  uploadProfilePicture,
  handleUploadError
);

router.get(
  "/additional-info/profile",
  authentication,
  isUser,
  getProfilePictureUrls
);

router.post("/logout", authentication, isUser, logout);
router.get("/me", authentication, isUser, getCurrentUser);

module.exports = router;
