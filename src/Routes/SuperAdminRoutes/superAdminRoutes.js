const express = require("express");
const router = express.Router();

// Controller functions
const {
  createAdmin,
  createCoach,
  getAllUsers,
  deleteUser,
} = require("../../Controller/SuperAdminController/superAdmin");

// Middleware to protect super admin routes
const { authentication, isSuperAdmin } = require("../../Middleware/userAuth");

// Protected routes for Super Admin
router.post("/create-admin", authentication, isSuperAdmin, createAdmin);
router.post("/create-coach", authentication, isSuperAdmin, createCoach);
router.get("/users", authentication, isSuperAdmin, getAllUsers);
router.delete("/user/:id", authentication, isSuperAdmin, deleteUser);

module.exports = router;
