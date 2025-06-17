const express = require("express");
const router = express.Router();

// Controller functions
const {
 createUser,
  getAllUsers,
  deleteUser,
  getAllInvoices,
  getOfficals
} = require("../../Controller/SuperAdminController/superAdmin");

// Middleware to protect super admin routes
const { authentication, isSuperAdmin } = require("../../Middleware/userAuth");

// Protected routes for Super Admin
router.post("/create-user", authentication, isSuperAdmin, createUser);
router.get("/users", authentication, isSuperAdmin, getAllUsers);
router.get("/officals", authentication, isSuperAdmin, getOfficals);
router.delete("/user/:id", authentication, isSuperAdmin, deleteUser);
router.get("/invoices", authentication, isSuperAdmin, getAllInvoices);

module.exports = router;
