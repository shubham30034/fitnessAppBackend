const express = require('express');
const router = express.Router();

const {
  createOfficial,
  updateOfficialStatus,
  listOfficials,
  resetOfficialPassword,
  updateOfficialInfo,
} = require('../../Controller/adminController/adminOffical.Controller');

const { authentication } = require('../../Middleware/userAuth');

/**
 * All admin routes require authentication
 */
router.use(authentication);

/**
 * Admin OR Superadmin only
 */
const isAdminOrSuperadmin = (req, res, next) => {
  if (req.user.role === 'admin' || req.user.role === 'superadmin') {
    return next();
  }
  return res.status(403).json({
    success: false,
    message: 'Access denied',
  });
};

router.use(isAdminOrSuperadmin);

/* ========================= OFFICIAL MANAGEMENT ========================= */

// Create official (admin / coach / seller etc.)
router.post('/officials', createOfficial);

// Enable / Disable official
router.patch('/officials/:id/status', updateOfficialStatus);

// Update official profile info (name, email, address)
router.patch('/officials/:id', updateOfficialInfo);

// Reset official password (generate temp password)
router.post('/officials/:id/reset-password', resetOfficialPassword);

// List officials
router.get('/officials', listOfficials);

module.exports = router;
