const express = require("express");
const router = express.Router();

// Controller functions
const {
  createAdmin,
  createSeller,
  createCoach,
  getAllUsers,
  deleteUser,
  getAllInvoices,
  getOfficals
} = require("../../Controller/SuperAdminController/superAdmin");

// Middleware to protect super admin routes
const { authentication, isSuperAdmin } = require("../../Middleware/userAuth");

// Protected routes for Super Admin
router.post("/create-admin", authentication, isSuperAdmin, createAdmin);
router.post("/create-coach", authentication, isSuperAdmin, createCoach);
router.post("/create-seller", authentication, isSuperAdmin, createSeller);
router.get("/users", authentication, isSuperAdmin, getAllUsers);
router.get("/officals", authentication, isSuperAdmin, getOfficals);
router.delete("/user/:id", authentication, isSuperAdmin, deleteUser);
router.get("/invoices", authentication, isSuperAdmin, getAllInvoices);

module.exports = router;
