'use strict';

const express = require('express');
const router  = express.Router();

const { protect } = require('../middleware/auth');
const authorize = require('../middleware/authorize');

const {
  getAllUsers,
  createHospital,
  createHospitalValidation,
  getAuditLogs,
  verifyUser,
  verifyUserValidation,
} = require('../controllers/adminController');

// All admin routes require authentication and super_admin authorization
router.use(protect, authorize('super_admin'));

/**
 * @route   GET /api/admin/users
 * @desc    Get all users (paginated)
 * @access  Protected (super_admin)
 */
router.get('/users', getAllUsers);

/**
 * @route   POST /api/admin/hospitals
 * @desc    Create and onboard a new hospital
 * @access  Protected (super_admin)
 */
router.post('/hospitals', createHospitalValidation, createHospital);

/**
 * @route   GET /api/admin/logs
 * @desc    Get all audit logs (paginated)
 * @access  Protected (super_admin)
 */
router.get('/logs', getAuditLogs);

/**
 * @route   PATCH /api/admin/users/:id/verify
 * @desc    Verify a hospital or blood bank admin account
 * @access  Protected (super_admin)
 */
router.patch('/users/:id/verify', verifyUserValidation, verifyUser);

module.exports = router;
