const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

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

// ✅ Verify refresh token with correct secret
const verifyRefreshToken = (token) => {
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

    // ✅ IMPORTANT: include password select
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
    const { refreshToken } = req.body;

    const authHeader = req.headers.authorization || req.headers.Authorization;
    const accessToken = authHeader?.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : null;

    if (!refreshToken || !accessToken) {
      return res.status(400).json({ success: false, message: "Tokens required" });
    }

    // ✅ verify ACCESS token with JWT_SECRET (not refresh secret)
    let decoded = null;
    try {
      decoded = jwt.verify(accessToken, process.env.JWT_SECRET);
    } catch (e) {
      decoded = jwt.decode(accessToken); // best-effort decode
    }

    // kill refresh tokens if we have userId
    if (decoded?.id) {
      await RefreshToken.deleteMany({ userId: decoded.id });
    }

    // blacklist raw access token (because middleware checks raw)
    if (decoded?.exp) {
      await BlacklistedToken.findOneAndUpdate(
        { token: accessToken },
        {
          $setOnInsert: {
            token: accessToken,
            expiresAt: new Date(decoded.exp * 1000),
            reason: "LOGOUT",
            userId: decoded?.id || null,
          },
        },
        { upsert: true }
      );
    }

    return res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("logout error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Logout failed" });
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
    } catch (e) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid refresh token" });
    }

    const hashed = hashToken(refreshToken);

    // ✅ atomic delete = replay proof
    const exists = await RefreshToken.findOneAndDelete({
      userId: decoded.id,
      token: hashed,
    });

    if (!exists) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid refresh token" });
    }

    // fetch role from DB (don’t trust token claims fully)
    const user = await User.findById(decoded.id).select("role isActive");
    if (!user || !user.isActive) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid refresh token" });
    }

    const payload = { id: user._id, role: user.role };
    const { accessToken, refreshToken: newRefreshToken } =
      await generateToken(payload);

    await RefreshToken.create({
      userId: user._id,
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
    const isTempFlow = req.user?.pw === true;

    const { oldPassword, newPassword } = req.body;

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

    user.password = await bcrypt.hash(newPassword, 12);
    user.mustChangePassword = false;
    await user.save();

    // logout everywhere
    await RefreshToken.deleteMany({ userId: user._id });

    // ✅ blacklist RAW current access token (because middleware checks raw)
    if (accessToken) {
      try {
        const d = jwt.decode(accessToken);
        if (d?.exp) {
          await BlacklistedToken.findOneAndUpdate(
            { token: accessToken },
            {
              $setOnInsert: {
                token: accessToken,
                userId: user._id,
                expiresAt: new Date(d.exp * 1000),
                reason: isTempFlow ? "TEMP_PW_CHANGE" : "PASSWORD_CHANGE",
              },
            },
            { upsert: true }
          );
        }
      } catch (_) {}
    }

    // Temp flow => issue fresh tokens immediately
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
