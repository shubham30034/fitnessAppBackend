const express = require("express");
const router = express.Router();

const {
  loginWithPassword,
  loginOfficial,
  signupWithPassword,
  getMe,
  logout,
  regenerateRefreshToken,
  changePassword,
} = require("../../Controller/CoachSellerController/auth");

const { enforceTempPwToken } = require("../../Middleware/enforceTempPwToken");
const { authentication } = require("../../Middleware/userAuth");

/* ========================= AUTH ROUTES ========================= */

/**
 * Staff login
 * Roles allowed:
 * - coach
 * - seller
 * - coachmanager
 */
router.post("/login", loginWithPassword);

/**
 * Admin / Superadmin login
 */
router.post("/official-login", loginOfficial);

/**
 * Bootstrap signup
 * ⚠️ Auto-disabled in production via controller
 */
router.post("/signup", signupWithPassword);

/**
 * Refresh access token
 * (refresh token doesn't need auth middleware)
 */
router.post("/refresh-token", regenerateRefreshToken);

/**
 * ✅ Change password
 * IMPORTANT:
 * - Must work with TEMP token (pw:true)
 * - So authentication + enforceTempPwToken needed
 */
router.post("/change-password", authentication, enforceTempPwToken, changePassword);

/**
 * Get current logged-in user
 * TEMP TOKEN should NOT allow access here
 */
router.get("/me", authentication, enforceTempPwToken, getMe);

/**
 * Logout (access + refresh token)
 * TEMP TOKEN can logout ✅ allowed
 */
router.post("/logout", authentication, logout);


module.exports = router;
