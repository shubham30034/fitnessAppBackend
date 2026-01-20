const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const mongoose = require("mongoose");

const User = require("../../Model/userModel/userModel");
const UserAdditionalInfo = require("../../Model/userModel/additionalInfo");
const RefreshToken = require("../../Model/userModel/refreshToken");
const BlacklistedToken = require("../../Model/userModel/blackListedToken");

const { generateToken } = require("../../Utils/Jwt");
const {
  loginValidation,
  signupValidation,
} = require("../../validator/coachSellerValidation");

/* ========================= CONSTANTS ========================= */
const STAFF_ROLES = ["coach", "seller", "coachmanager"];
const OFFICIAL_ROLES = ["admin", "superadmin"];
const NON_USER_ROLES = [...STAFF_ROLES, ...OFFICIAL_ROLES];

// bootstrap only (dev)
const SIGNUP_ALLOWED_ROLES = ["coach", "seller"];

const TEMP_PW_TOKEN_EXP = "10m"; // temp access token expiry

/* ========================= HELPERS ========================= */
const hashToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");

const invalidAuth = (res) =>
  res.status(401).json({ success: false, message: "Invalid credentials" });

const forbidden = (res, message = "Not allowed") =>
  res.status(403).json({ success: false, message });

const badRequest = (res, message = "Invalid request") =>
  res.status(400).json({ success: false, message });

const buildUserResponse = (user) => ({
  id: user._id,
  phone: user.phone,
  role: user.role,
  name: user.additionalInfo?.name || "",
  email: user.additionalInfo?.email || "",
});

/**
 * Normalize phone to ONE consistent format.
 * Accepts:
 * - 9876543210
 * - 919876543210
 * - +919876543210
 * Returns: +919876543210 OR null
 */
const normalizePhone = (phoneRaw) => {
  if (!phoneRaw) return null;

  let p = String(phoneRaw).trim();
  p = p.replace(/[\s-]/g, "");

  if (p.startsWith("+")) {
    if (/^\+91\d{10}$/.test(p)) return p;
    return null;
  }

  if (/^91\d{10}$/.test(p)) return `+${p}`;
  if (/^\d{10}$/.test(p)) return `+91${p}`;

  return null;
};

// Strong password check: 8+ chars, upper, lower, number, special
const isStrongPassword = (password) => {
  const strongRegex =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_+\-=\[\]{};':"\\|,.<>\/?])[A-Za-z\d@$!%*?&#^()_+\-=\[\]{};':"\\|,.<>\/?]{8,}$/;
  return strongRegex.test(password);
};

const getBearerToken = (req) => {
  const h = req.headers?.authorization || req.headers?.Authorization;
  if (!h) return null;
  const parts = String(h).split(" ");
  if (parts.length !== 2) return null;
  if (parts[0].toLowerCase() !== "bearer") return null;
  return parts[1];
};

// TEMP token for password-change-only access
const generateTempPwAccessToken = (user) => {
  const payload = { id: user._id, role: user.role, pw: true };
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: TEMP_PW_TOKEN_EXP,
  });
};

// Verify refresh token with correct secret
const verifyRefreshToken = (token) => {
  // You MUST store refresh secret in env:
  // REFRESH_TOKEN_SECRET=...
  return jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
};

/* ========================= LOGIN (COACH / SELLER / COACHMANAGER) ========================= */
exports.loginWithPassword = async (req, res) => {
  try {
    const { phone, password } = req.body;

    const { error } = loginValidation({ phone, password });
    if (error) {
      return res.status(400).json({
        success: false,
        errors: error.details.map((e) => e.message),
      });
    }

    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) return invalidAuth(res);

    // IMPORTANT: include password
    const user = await User.findOne({ phone: normalizedPhone })
      .populate("additionalInfo");

      

    if (
      !user ||
      !user.password ||
      !user.isActive ||
      !STAFF_ROLES.includes(user.role)
    ) {
      return invalidAuth(res);
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return invalidAuth(res);

    // mustChangePassword => temp token
    if (user.mustChangePassword) {
      const tempAccessToken = generateTempPwAccessToken(user);

      return res.status(200).json({
        success: true,
        mustChangePassword: true,
        message:
          "Password reset detected. Please change your password to continue.",
        user: buildUserResponse(user),
        tempAccessToken,
      });
    }

    // Normal tokens
    const payload = { id: user._id, role: user.role };
    const { accessToken, refreshToken } = await generateToken(payload);

    // Single refresh token per user
    await RefreshToken.deleteMany({ userId: user._id });
    await RefreshToken.create({
      userId: user._id,
      token: hashToken(refreshToken),
    });

    return res.json({
      success: true,
      user: buildUserResponse(user),
      tokens: { accessToken, refreshToken },
    });
  } catch (err) {
    console.error("loginWithPassword error:", err);
    return res.status(500).json({ success: false, message: "Login failed" });
  }
};

/* ========================= LOGIN (ADMIN / SUPERADMIN) ========================= */
exports.loginOfficial = async (req, res) => {
  try {
    const { phone, password } = req.body;

    const { error } = loginValidation({ phone, password });
    if (error) {
      return res.status(400).json({
        success: false,
        errors: error.details.map((e) => e.message),
      });
    }

    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) return invalidAuth(res);

    const user = await User.findOne({ phone: normalizedPhone })
      .select("+password mustChangePassword isActive role phone additionalInfo")
      .populate("additionalInfo");

    if (
      !user ||
      !user.password ||
      !user.isActive ||
      !OFFICIAL_ROLES.includes(user.role)
    ) {
      return invalidAuth(res);
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return invalidAuth(res);

    if (user.mustChangePassword) {
      const tempAccessToken = generateTempPwAccessToken(user);

      return res.status(200).json({
        success: true,
        mustChangePassword: true,
        message:
          "Password reset detected. Please change your password to continue.",
        user: buildUserResponse(user),
        tempAccessToken,
      });
    }

    const payload = { id: user._id, role: user.role };
    const { accessToken, refreshToken } = await generateToken(payload);

    await RefreshToken.deleteMany({ userId: user._id });
    await RefreshToken.create({
      userId: user._id,
      token: hashToken(refreshToken),
    });

    return res.json({
      success: true,
      user: buildUserResponse(user),
      tokens: { accessToken, refreshToken },
    });
  } catch (err) {
    console.error("loginOfficial error:", err);
    return res.status(500).json({ success: false, message: "Login failed" });
  }
};

/* ========================= SIGNUP (BOOTSTRAP ONLY) ========================= */
exports.signupWithPassword = async (req, res) => {
  try {
    if (process.env.NODE_ENV === "production") {
      return forbidden(res, "Signup disabled");
    }

    let { phone, password, role, name, email, address } = req.body;

    role = String(role || "").trim().toLowerCase();

    if (!SIGNUP_ALLOWED_ROLES.includes(role)) {
      return forbidden(res, "Signup not allowed for this role");
    }

    const { error } = signupValidation({
      phone,
      password,
      role,
      name,
      email,
      address,
    });
    if (error) {
      return res.status(400).json({
        success: false,
        errors: error.details.map((e) => e.message),
      });
    }

    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) return badRequest(res, "Invalid phone number");

    const exists = await User.findOne({ phone: normalizedPhone });
    if (exists) {
      return res.status(409).json({
        success: false,
        message: "Account already exists",
      });
    }

    if (!isStrongPassword(password)) {
      return badRequest(
        res,
        "Password too weak. Use 8+ chars with uppercase, lowercase, number & special character."
      );
    }

    const hashed = await bcrypt.hash(password, 12);

    const user = await User.create({
      phone: normalizedPhone,
      password: hashed,
      role,
      isActive: true,
      mustChangePassword: false,
    });

    if (name || email || address) {
      const info = await UserAdditionalInfo.create({
        userId: user._id,
        name: String(name || "").trim(),
        email: String(email || "").trim().toLowerCase(),
        address: String(address || "").trim(),
      });
      user.additionalInfo = info._id;
      await user.save();
    }

    return res.status(201).json({
      success: true,
      message: "Account created",
    });
  } catch (err) {
    console.error("signupWithPassword error:", err);
    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Duplicate field error",
      });
    }
    return res.status(500).json({ success: false, message: "Signup failed" });
  }
};

/* ========================= GET CURRENT USER ========================= */
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate("additionalInfo");

    if (!user || !user.isActive) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.json({
      success: true,
      user: buildUserResponse(user),
    });
  } catch (err) {
    console.error("getMe error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch user" });
  }
};

/* ========================= LOGOUT ========================= */
exports.logout = async (req, res) => {
  try {
    const accessToken = getBearerToken(req);
    const { refreshToken } = req.body;

    if (!accessToken || !refreshToken) {
      return badRequest(res, "Tokens required");
    }

    // decode access token to find userId & expiry
    let decodedAccess;
    try {
      decodedAccess = jwt.verify(accessToken, process.env.JWT_SECRET);
    } catch {
      // token invalid/expired => still delete refresh token if possible
      // but we need userId, so best effort: decode
      decodedAccess = jwt.decode(accessToken);
    }

    if (decodedAccess?.id) {
      await RefreshToken.deleteOne({
        userId: decodedAccess.id,
        token: hashToken(refreshToken),
      });
    }

    // blacklist access token (store hashed)
    if (decodedAccess?.exp) {
      await BlacklistedToken.create({
        token: hashToken(accessToken),
        userId: decodedAccess?.id || null,
        expiresAt: new Date(decodedAccess.exp * 1000),
        reason: "LOGOUT",
      });
    }

    return res.json({ success: true, message: "Logged out" });
  } catch (err) {
    console.error("logout error:", err);
    return res.status(500).json({ success: false, message: "Logout failed" });
  }
};

/* ========================= REFRESH TOKEN ========================= */
exports.regenerateRefreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) return badRequest(res, "Refresh token required");

    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch {
      return res.status(401).json({
        success: false,
        message: "Invalid refresh token",
      });
    }

    const hashed = hashToken(refreshToken);

    // ensure refresh token exists in DB
    const exists = await RefreshToken.findOne({
      userId: decoded.id,
      token: hashed,
    });

    if (!exists) {
      return res.status(401).json({
        success: false,
        message: "Invalid refresh token",
      });
    }

    // rotate refresh token
    await RefreshToken.deleteOne({ userId: decoded.id, token: hashed });

    const payload = { id: decoded.id, role: decoded.role };
    const { accessToken, refreshToken: newRefreshToken } =
      await generateToken(payload);

    await RefreshToken.create({
      userId: decoded.id,
      token: hashToken(newRefreshToken),
    });

    return res.json({
      success: true,
      accessToken,
      refreshToken: newRefreshToken,
    });
  } catch (err) {
    console.error("regenerateRefreshToken error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Token refresh failed" });
  }
};

/* ========================= CHANGE PASSWORD (NORMAL + TEMP TOKEN) =========================
   Flow A (normal): oldPassword + newPassword required
   Flow B (temp pw): token has pw:true -> only newPassword required
*/
exports.changePassword = async (req, res) => {
  try {
    const accessToken = getBearerToken(req);
    const isTempFlow = req.user?.pw === true; // ✅ comes from temp token payload

    const { oldPassword, newPassword } = req.body;

    // temp flow -> old password not required
    if (!newPassword) {
      return badRequest(res, "newPassword required");
    }

    if (!isStrongPassword(newPassword)) {
      return badRequest(
        res,
        "Password too weak. Use 8+ chars with uppercase, lowercase, number & special character."
      );
    }

    const user = await User.findById(req.user.id).select(
      "+password mustChangePassword role isActive"
    );

    if (!user || !user.isActive) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!NON_USER_ROLES.includes(user.role)) {
      return forbidden(res);
    }

    // Normal flow: verify oldPassword
    if (!isTempFlow) {
      if (!oldPassword) return badRequest(res, "oldPassword required");

      if (oldPassword === newPassword) {
        return badRequest(res, "New password must be different from old password");
      }

      const ok = await bcrypt.compare(oldPassword, user.password);
      if (!ok) {
        return res.status(401).json({
          success: false,
          message: "Old password incorrect",
        });
      }
    }

    // Update password
    user.password = await bcrypt.hash(newPassword, 12);
    user.mustChangePassword = false;
    await user.save();

    // logout everywhere
    await RefreshToken.deleteMany({ userId: user._id });

    // blacklist current access token (recommended)
    if (accessToken) {
      try {
        const decoded = jwt.decode(accessToken);
        if (decoded?.exp) {
          await BlacklistedToken.create({
            token: hashToken(accessToken),
            userId: user._id,
            expiresAt: new Date(decoded.exp * 1000),
            reason: isTempFlow ? "TEMP_PW_CHANGE" : "PASSWORD_CHANGE",
          });
        }
      } catch (_) {}
    }

    // ✅ BEST UX:
    // Temp flow => issue fresh tokens immediately (so user can continue)
    if (isTempFlow) {
      const payload = { id: user._id, role: user.role };
      const { accessToken: newAccess, refreshToken: newRefresh } =
        await generateToken(payload);

      await RefreshToken.create({
        userId: user._id,
        token: hashToken(newRefresh),
      });

      return res.json({
        success: true,
        message: "Password changed successfully",
        tokens: {
          accessToken: newAccess,
          refreshToken: newRefresh,
        },
      });
    }

    // Normal flow: force re-login (safer)
    return res.json({
      success: true,
      message: "Password changed successfully. Please login again.",
    });
  } catch (err) {
    console.error("changePassword error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to change password" });
  }
};
