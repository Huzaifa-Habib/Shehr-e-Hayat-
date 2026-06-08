'use strict';

const mongoose = require('mongoose');
const { body, param, query, validationResult } = require('express-validator');
const User = require('../models/User');
const { ROLES } = require('../models/User');
const Hospital = require('../models/Hospital');
const AuditLog = require('../models/AuditLog');
const { AUDIT_ACTIONS } = require('../models/AuditLog');

// Validation helper
const hasValidationErrors = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      message: 'Validation failed.',
      errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
    return true;
  }
  return false;
};

/**
 * @desc    Get all users (paginated and filterable)
 * @route   GET /api/admin/users
 * @access  Protected (super_admin only)
 */
const getAllUsers = async (req, res) => {
  try {
    const { role, verified, search } = req.query;

    const filter = {};

    if (role) {
      filter.role = role;
    }

    if (verified !== undefined) {
      filter.isVerified = verified === 'true';
    }

    if (search) {
      filter.name = { $regex: search, $options: 'i' };
    }

    const page = parseInt(req.query.page, 10) || 1;
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const skip = (page - 1) * limit;

    const total = await User.countDocuments(filter);
    const pages = Math.ceil(total / limit);

    const users = await User.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return res.status(200).json({
      success: true,
      data: users,
      pagination: {
        page,
        limit,
        total,
        pages,
      },
    });
  } catch (err) {
    console.error('getAllUsers error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while retrieving users.',
    });
  }
};

/**
 * @desc    Create and onboard a new hospital
 * @route   POST /api/admin/hospitals
 * @access  Protected (super_admin only)
 */
const createHospitalValidation = [
  body('name')
    .trim()
    .notEmpty().withMessage('Hospital name is required.')
    .isLength({ max: 150 }).withMessage('Name cannot exceed 150 characters.'),
  body('shortCode')
    .trim()
    .notEmpty().withMessage('Short code is required.')
    .isLength({ min: 2, max: 10 }).withMessage('Short code must be between 2 and 10 characters.')
    .toUpperCase(),
  body('address')
    .trim()
    .notEmpty().withMessage('Address is required.'),
  body('contact')
    .trim()
    .notEmpty().withMessage('Contact number is required.'),
  body('location.coordinates')
    .isArray({ min: 2, max: 2 }).withMessage('Coordinates must be an array of exactly [longitude, latitude].')
    .custom((coords) => {
      const [lng, lat] = coords;
      return typeof lng === 'number' && typeof lat === 'number' &&
             lng >= -180 && lng <= 180 &&
             lat >= -90 && lat <= 90;
    }).withMessage('Coordinates must be valid [longitude (-180 to 180), latitude (-90 to 90)].'),
  body('isGovernment')
    .optional()
    .isBoolean().withMessage('isGovernment must be a boolean value.'),
];

const createHospital = async (req, res) => {
  try {
    if (hasValidationErrors(req, res)) return;

    const { name, shortCode, address, contact, location, isGovernment } = req.body;

    // Check shortCode uniqueness
    const existingHospital = await Hospital.findOne({ shortCode: shortCode.toUpperCase() });
    if (existingHospital) {
      return res.status(400).json({
        success: false,
        message: `A hospital with short code "${shortCode.toUpperCase()}" already exists.`,
      });
    }

    const hospital = await Hospital.create({
      name,
      shortCode: shortCode.toUpperCase(),
      address,
      contact,
      location: {
        type: 'Point',
        coordinates: location.coordinates,
      },
      isGovernment: isGovernment || false,
    });

    // Record ONBOARD_HOSPITAL audit log
    await AuditLog.record({
      userId: req.user.id,
      action: AUDIT_ACTIONS.ONBOARD_HOSPITAL,
      targetCollection: 'hospitals',
      targetDocumentId: hospital._id,
      newValue: {
        name,
        shortCode: shortCode.toUpperCase(),
        address,
        contact,
        coordinates: location.coordinates,
        isGovernment,
      },
      ipAddress: req.ip,
    });

    return res.status(201).json({
      success: true,
      message: 'Hospital onboarded successfully.',
      data: hospital,
    });
  } catch (err) {
    console.error('createHospital error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while onboarding the hospital.',
    });
  }
};

/**
 * @desc    Get all audit logs (paginated and filterable)
 * @route   GET /api/admin/logs
 * @access  Protected (super_admin only)
 */
const getAuditLogs = async (req, res) => {
  try {
    const { action, userId, from, to } = req.query;

    const filter = {};

    if (action) {
      filter.action = action;
    }

    if (userId) {
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid user ID format.',
        });
      }
      filter.userId = userId;
    }

    if (from || to) {
      filter.timestamp = {};
      if (from) {
        filter.timestamp.$gte = new Date(from);
      }
      if (to) {
        filter.timestamp.$lte = new Date(to);
      }
    }

    const page = parseInt(req.query.page, 10) || 1;
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const skip = (page - 1) * limit;

    const total = await AuditLog.countDocuments(filter);
    const pages = Math.ceil(total / limit);

    const logs = await AuditLog.find(filter)
      .populate('userId', 'name email role')
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit);

    return res.status(200).json({
      success: true,
      data: logs,
      pagination: {
        page,
        limit,
        total,
        pages,
      },
    });
  } catch (err) {
    console.error('getAuditLogs error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while retrieving audit logs.',
    });
  }
};

/**
 * @desc    Verify a hospital or blood bank admin account
 * @route   PATCH /api/admin/users/:id/verify
 * @access  Protected (super_admin only)
 */
const verifyUserValidation = [
  param('id').custom((val) => mongoose.Types.ObjectId.isValid(val)).withMessage('Invalid user ID format.'),
];

const verifyUser = async (req, res) => {
  try {
    if (hasValidationErrors(req, res)) return;

    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    if (user.role === ROLES.DONOR || user.role === ROLES.SUPER_ADMIN) {
      return res.status(400).json({
        success: false,
        message: `Users with role "${user.role}" do not require manual verification.`,
      });
    }

    if (user.isVerified) {
      return res.status(400).json({
        success: false,
        message: 'User is already verified.',
      });
    }

    user.isVerified = true;
    await user.save();

    // Record VERIFY_USER audit log
    await AuditLog.record({
      userId: req.user.id,
      action: AUDIT_ACTIONS.VERIFY_USER,
      targetCollection: 'users',
      targetDocumentId: user._id,
      previousValue: { isVerified: false },
      newValue: { isVerified: true },
      ipAddress: req.ip,
    });

    return res.status(200).json({
      success: true,
      message: 'User verified successfully.',
      data: user,
    });
  } catch (err) {
    console.error('verifyUser error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while verifying the user.',
    });
  }
};

module.exports = {
  getAllUsers,
  createHospital,
  createHospitalValidation,
  getAuditLogs,
  verifyUser,
  verifyUserValidation,
};
