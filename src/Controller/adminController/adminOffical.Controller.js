const bcrypt = require("bcrypt");
const crypto = require("crypto");
const mongoose = require("mongoose");

const User = require("../../Model/userModel/userModel");
const UserAdditionalInfo = require("../../Model/userModel/additionalInfo");
const RefreshToken = require("../../Model/userModel/refreshToken");
const BlacklistedToken = require("../../Model/userModel/blackListedToken"); // ✅ used for access token blacklisting

const { sendSMS } = require("../../services/smsService/smsService");

/* ========================= CONSTANTS ========================= */

// Admin can only create operational staff
const ADMIN_CREATABLE_ROLES = ["coach", "seller", "coachmanager"];

// Superadmin can create admin + operational staff
const SUPERADMIN_CREATABLE_ROLES = ["admin", ...ADMIN_CREATABLE_ROLES];

// Roles that are NEVER allowed to be created via API
const FORBIDDEN_ROLES = ["superadmin", "user"];

// Limits
const NAME_MAX_LEN = 60;
const EMAIL_MAX_LEN = 120;
const ADDRESS_MAX_LEN = 300;

/* ========================= HELPERS ========================= */

const forbid = (res, message = "Not allowed") =>
  res.status(403).json({ success: false, message });

const badRequest = (res, message = "Invalid request") =>
  res.status(400).json({ success: false, message });

const isAdminOrSuperadmin = (req) =>
  req.user && ["admin", "superadmin"].includes(req.user.role);

const generateTempPassword = () => crypto.randomBytes(6).toString("hex"); // 12 chars

// SHA256 token hash (good practice for storing sensitive token-like strings)
const hashToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");

/**
 * STRICT normalize phone to ONE consistent format.
 * Accepts:
 *  - 9876543210
 *  - 919876543210
 *  - +919876543210
 * Returns:
 *  - +919876543210
 * Else null
 */
const normalizePhone = (phoneRaw) => {
  if (!phoneRaw) return null;

  let p = String(phoneRaw).trim();
  p = p.replace(/[\s-]/g, "");

  // Strict E.164 for India only
  if (p.startsWith("+")) {
    if (/^\+91\d{10}$/.test(p)) return p;
    return null;
  }

  if (/^91\d{10}$/.test(p)) return `+${p}`;
  if (/^\d{10}$/.test(p)) return `+91${p}`;

  return null;
};

/** normalize role input */
const normalizeRole = (roleRaw) => {
  if (!roleRaw) return null;
  return String(roleRaw).trim().toLowerCase();
};

/** basic email validation */
const isValidEmail = (email) => {
  if (!email) return true; // allow empty
  // basic & safe
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
};

const sanitizeEmail = (email) => {
  if (email === undefined) return undefined;
  if (email === null) return null;
  return String(email).trim().toLowerCase();
};

const safeName = (name) => {
  if (name === undefined) return undefined;
  if (name === null) return null;
  return String(name).trim();
};

const safeAddress = (address) => {
  if (address === undefined) return undefined;
  if (address === null) return null;
  return String(address).trim();
};

const assertStringLimits = (res, { name, email, address }) => {
  if (name && name.length > NAME_MAX_LEN)
    return badRequest(res, `Name max length is ${NAME_MAX_LEN}`);

  if (email && email.length > EMAIL_MAX_LEN)
    return badRequest(res, `Email max length is ${EMAIL_MAX_LEN}`);

  if (address && address.length > ADDRESS_MAX_LEN)
    return badRequest(res, `Address max length is ${ADDRESS_MAX_LEN}`);

  if (email && !isValidEmail(email)) return badRequest(res, "Invalid email");

  return null;
};

const isValidRoleForCreator = (creatorRole, targetRole) => {
  if (!targetRole) return false;
  if (FORBIDDEN_ROLES.includes(targetRole)) return false;

  if (creatorRole === "admin") return ADMIN_CREATABLE_ROLES.includes(targetRole);
  if (creatorRole === "superadmin")
    return SUPERADMIN_CREATABLE_ROLES.includes(targetRole);

  return false;
};

const canManageTargetUser = (actorRole, targetUserRole) => {
  if (!targetUserRole) return false;

  // hard rule
  if (targetUserRole === "superadmin") return false;

  if (actorRole === "admin") {
    return ADMIN_CREATABLE_ROLES.includes(targetUserRole);
  }

  if (actorRole === "superadmin") {
    return SUPERADMIN_CREATABLE_ROLES.includes(targetUserRole);
  }

  return false;
};

/** extract bearer token from header */
const getBearerToken = (req) => {
  const h = req.headers?.authorization || req.headers?.Authorization;
  if (!h) return null;
  const parts = String(h).split(" ");
  if (parts.length !== 2) return null;
  if (parts[0].toLowerCase() !== "bearer") return null;
  return parts[1];
};

/* ========================= CREATE OFFICIAL ========================= */
exports.createOfficial = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    let { phone, role } = req.body;

    role = normalizeRole(role);
    const name = safeName(req.body?.name);
    const email = sanitizeEmail(req.body?.email);
    const address = safeAddress(req.body?.address);

    // limits & formats
    const limitErr = assertStringLimits(res, { name, email, address });
    if (limitErr) return limitErr;

    if (!phone || !role) return badRequest(res, "Phone and role are required");
    if (!isAdminOrSuperadmin(req)) return forbid(res);

    // strict role authority
    if (!isValidRoleForCreator(req.user.role, role)) {
      return forbid(res, "You cannot create this role");
    }

    // normalize phone
    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) return badRequest(res, "Invalid phone number");

    await session.withTransaction(async () => {
      // duplicate phone
      const exists = await User.findOne({ phone: normalizedPhone }).session(
        session
      );
      if (exists) {
        const err = new Error("DUPLICATE_PHONE");
        err.code = "DUPLICATE_PHONE";
        throw err;
      }

      // temp password
      const tempPassword = generateTempPassword();
      const hashedPassword = await bcrypt.hash(tempPassword, 12);

      // create user
      const user = await User.create(
        [
          {
            phone: normalizedPhone,
            role,
            password: hashedPassword,
            isActive: true,
            mustChangePassword: true,

            // optional audits (add in schema)
            createdBy: req.user?._id,
            updatedBy: req.user?._id,
          },
        ],
        { session }
      );

      const createdUser = user[0];

      // optional additional info
      if (name || email || address) {
        const info = await UserAdditionalInfo.create(
          [
            {
              userId: createdUser._id,
              name,
              email,
              address,
            },
          ],
          { session }
        );

        createdUser.additionalInfo = info[0]._id;
        await createdUser.save({ session });
      }

      res.locals.__tempPassword = tempPassword;
      res.locals.__createdUser = createdUser;
    });

    if (!res.locals.__createdUser) {
      return res.status(500).json({
        success: false,
        message: "Failed to create official",
      });
    }

    // send SMS (outside transaction)
    const createdUser = res.locals.__createdUser;
    const tempPassword = res.locals.__tempPassword;

    const msg =
      `Your account has been created.\n` +
      `Temporary Password: ${tempPassword}\n` +
      `Login & change your password immediately.`;

    let smsSent = false;
    try {
      await sendSMS({ to: createdUser.phone, message: msg });
      smsSent = true;
    } catch (smsErr) {
      console.error("❌ SMS Failed (createOfficial):", smsErr);
    }

    const response = {
      success: true,
      message: smsSent
        ? "Official created successfully. Temporary password sent via SMS."
        : "Official created successfully, but SMS delivery failed. Please resend credentials.",
      data: {
        id: createdUser._id,
        phone: createdUser.phone,
        role: createdUser.role,
      },
    };

    if (process.env.NODE_ENV !== "production") {
      response.data.tempPassword = tempPassword;
    }

    return res.status(201).json(response);
  } catch (err) {
    console.error("createOfficial error:", err);

    if (err.code === "DUPLICATE_PHONE") {
      return res.status(409).json({
        success: false,
        message: "User already exists",
      });
    }

    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Duplicate field error",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create official",
    });
  } finally {
    session.endSession();
  }
};

/* ========================= RESEND TEMP PASSWORD =========================
   ✅ Use when SMS failed in create/reset OR staff lost password before changing.
   ✅ Only admin/superadmin.
   ✅ Generates new temp password (safer than resending old).
*/
exports.resendTempPassword = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isAdminOrSuperadmin(req)) return forbid(res);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return badRequest(res, "Invalid user id");
    }

    const user = await User.findById(id).select("phone role isActive");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (!canManageTargetUser(req.user.role, user.role)) {
      return forbid(res, "You cannot resend temp password for this user");
    }

    const tempPassword = generateTempPassword();
    const hashedPassword = await bcrypt.hash(tempPassword, 12);

    user.password = hashedPassword;
    user.mustChangePassword = true;
    user.updatedBy = req.user?._id;

    await user.save();

    // kill sessions
    await RefreshToken.deleteMany({ userId: user._id });

    const msg =
      `Your account credentials have been updated.\n` +
      `Temporary Password: ${tempPassword}\n` +
      `Login & change your password immediately.`;

    let smsSent = false;
    try {
      await sendSMS({ to: user.phone, message: msg });
      smsSent = true;
    } catch (smsErr) {
      console.error("❌ SMS Failed (resendTempPassword):", smsErr);
    }

    const response = {
      success: true,
      message: smsSent
        ? "Temporary password sent via SMS."
        : "Temporary password generated, but SMS delivery failed. Please retry.",
    };

    if (process.env.NODE_ENV !== "production") {
      response.tempPassword = tempPassword;
    }

    return res.json(response);
  } catch (err) {
    console.error("resendTempPassword error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to resend temp password",
    });
  }
};

/* ========================= ENABLE / DISABLE OFFICIAL ========================= */
exports.updateOfficialStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    if (!isAdminOrSuperadmin(req)) return forbid(res);

    if (typeof isActive !== "boolean") {
      return badRequest(res, "isActive must be boolean");
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return badRequest(res, "Invalid user id");
    }

    const user = await User.findById(id).select("role isActive phone");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (!canManageTargetUser(req.user.role, user.role)) {
      return forbid(res, "You cannot update this user's status");
    }

    if (user.isActive === isActive) {
      return res.json({
        success: true,
        message: `User already ${isActive ? "active" : "inactive"}`,
      });
    }

    user.isActive = isActive;
    user.updatedBy = req.user?._id;
    await user.save();

    // If deactivating -> kill refresh tokens + blacklist current access token (optional but recommended)
    if (isActive === false) {
      try {
        await RefreshToken.deleteMany({ userId: user._id });
      } catch (e) {
        console.error("RefreshToken cleanup failed:", e);
      }

      // ✅ Access token blacklist (best practice)
      // Works only if caller provides their own access token in Authorization header.
      // For target user token blacklisting, you'd need token tracking system.
      try {
        const accessToken = getBearerToken(req);
        if (accessToken) {
          await BlacklistedToken.create({
            token: hashToken(accessToken),
            userId: req.user?._id,
            reason: "STATUS_DEACTIVATE_ACTION",
          });
        }
      } catch (e) {
        console.error("Access token blacklist failed:", e);
      }
    }

    return res.json({
      success: true,
      message: `User ${isActive ? "activated" : "deactivated"} successfully`,
    });
  } catch (err) {
    console.error("updateOfficialStatus error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to update status",
    });
  }
};

/* ========================= LIST OFFICIALS ========================= */
exports.listOfficials = async (req, res) => {
  try {
    if (!isAdminOrSuperadmin(req)) return forbid(res);

    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(
      Math.max(parseInt(req.query.limit || "20", 10), 1),
      100
    );
    const skip = (page - 1) * limit;

    const roleFilter =
      req.user.role === "admin"
        ? ADMIN_CREATABLE_ROLES
        : SUPERADMIN_CREATABLE_ROLES;

    const [users, total] = await Promise.all([
      User.find({ role: { $in: roleFilter } })
        .select("phone role isActive createdAt additionalInfo")
        .populate("additionalInfo", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      User.countDocuments({ role: { $in: roleFilter } }),
    ]);

    return res.json({
      success: true,
      page,
      limit,
      total,
      count: users.length,
      data: users,
    });
  } catch (err) {
    console.error("listOfficials error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch officials",
    });
  }
};

/* ========================= RESET OFFICIAL PASSWORD ========================= */
exports.resetOfficialPassword = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isAdminOrSuperadmin(req)) return forbid(res);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return badRequest(res, "Invalid user id");
    }

    const user = await User.findById(id).select(
      "phone role isActive password mustChangePassword"
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!canManageTargetUser(req.user.role, user.role)) {
      return forbid(res, "You cannot reset this user's password");
    }

    const tempPassword = generateTempPassword();
    const hashedPassword = await bcrypt.hash(tempPassword, 12);

    user.password = hashedPassword;
    user.mustChangePassword = true;

    user.lastPasswordResetBy = req.user?._id;
    user.lastPasswordResetAt = new Date();
    user.updatedBy = req.user?._id;

    await user.save();

    // Kill sessions
    await RefreshToken.deleteMany({ userId: user._id });

    const msg =
      `Your password has been reset.\n` +
      `Temporary Password: ${tempPassword}\n` +
      `Login & change your password immediately.`;

    let smsSent = false;
    try {
      await sendSMS({ to: user.phone, message: msg });
      smsSent = true;
    } catch (smsErr) {
      console.error("❌ SMS Failed (resetOfficialPassword):", smsErr);
    }

    const response = {
      success: true,
      message: smsSent
        ? "Password reset successfully. Temporary password sent via SMS."
        : "Password reset successfully, but SMS delivery failed. Please resend credentials.",
    };

    if (process.env.NODE_ENV !== "production") {
      response.tempPassword = tempPassword;
    }

    return res.json(response);
  } catch (err) {
    console.error("resetOfficialPassword error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to reset password",
    });
  }
};

/* ========================= UPDATE OFFICIAL INFO ========================= */
exports.updateOfficialInfo = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isAdminOrSuperadmin(req)) return forbid(res);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return badRequest(res, "Invalid user id");
    }

    const name = safeName(req.body?.name);
    const email = sanitizeEmail(req.body?.email);
    const address = safeAddress(req.body?.address);

    // limits & formats
    const limitErr = assertStringLimits(res, { name, email, address });
    if (limitErr) return limitErr;

    const user = await User.findById(id).select("role additionalInfo");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!canManageTargetUser(req.user.role, user.role)) {
      return forbid(res, "You cannot update this user's info");
    }

    let info = null;

    if (!user.additionalInfo) {
      info = await UserAdditionalInfo.create({
        userId: user._id,
        name: name ?? undefined,
        email: email ?? undefined,
        address: address ?? undefined,
      });

      user.additionalInfo = info._id;
      user.updatedBy = req.user?._id;
      await user.save();
    } else {
      info = await UserAdditionalInfo.findById(user.additionalInfo);

      if (!info) {
        // broken reference -> recreate
        info = await UserAdditionalInfo.create({
          userId: user._id,
          name: name ?? undefined,
          email: email ?? undefined,
          address: address ?? undefined,
        });

        user.additionalInfo = info._id;
        user.updatedBy = req.user?._id;
        await user.save();
      } else {
        if (name !== undefined) info.name = name;
        if (email !== undefined) info.email = email;
        if (address !== undefined) info.address = address;
        await info.save();
      }
    }

    return res.json({
      success: true,
      message: "Official info updated successfully",
    });
  } catch (err) {
    console.error("updateOfficialInfo error:", err);

    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Email already in use",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to update official",
    });
  }
};
