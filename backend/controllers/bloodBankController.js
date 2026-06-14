'use strict';

const mongoose = require('mongoose');
const { body, param, validationResult } = require('express-validator');
const BloodBank = require('../models/BloodBank');
const AuditLog = require('../models/AuditLog');
const { AUDIT_ACTIONS } = require('../models/AuditLog');
const { BLOOD_TYPES } = require('../models/BloodBank');

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
 * @desc    Get all active blood banks
 * @route   GET /api/bloodbanks
 * @access  Public
 */
const getAllBloodBanks = async (req, res) => {
  try {
    const { search } = req.query;
    const query = { isActive: true };

    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    const bloodBanks = await BloodBank.find(query)
      .select('name branch address location contact operatingHours inventory alertThreshold')
      .sort({ name: 1 });

    return res.status(200).json({
      success: true,
      count: bloodBanks.length,
      data: bloodBanks,
    });
  } catch (err) {
    console.error('getAllBloodBanks error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'An internal error occurred while retrieving blood banks.',
    });
  }
};

/**
 * @desc    Get a single blood bank by ID
 * @route   GET /api/bloodbanks/:id
 * @access  Public
 */
const getBloodBankById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid blood bank ID format.',
      });
    }

    const bloodBank = await BloodBank.findById(id);
    if (!bloodBank) {
      return res.status(404).json({
        success: false,
        message: 'Blood bank not found.',
      });
    }

    return res.status(200).json({
      success: true,
      data: bloodBank,
    });
  } catch (err) {
    console.error('getBloodBankById error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'An internal error occurred while retrieving the blood bank.',
    });
  }
};

/**
 * @desc    Update blood bank inventory
 * @route   PUT /api/bloodbanks/:id/inventory
 * @access  Protected (blood_bank_admin for own bank, or super_admin)
 */
const updateInventoryValidation = [
  param('id').custom((val) => mongoose.Types.ObjectId.isValid(val)).withMessage('Invalid blood bank ID format.'),
  body('bloodType')
    .notEmpty().withMessage('Blood type is required.')
    .isIn(BLOOD_TYPES).withMessage(`Blood type must be one of: ${BLOOD_TYPES.join(', ')}`),
  body('units')
    .notEmpty().withMessage('Units count is required.')
    .isInt({ min: 0, max: 9999 }).withMessage('Units must be an integer between 0 and 9999.'),
];

const updateInventory = async (req, res) => {
  try {
    if (hasValidationErrors(req, res)) return;
    const { id } = req.params;
    const { bloodType, units } = req.body;
    // Entity ownership check: if blood_bank_admin, verify req.user.associatedEntityId matches id
    if (req.user.role === 'blood_bank_admin' && (!req.user.associatedEntityId || req.user.associatedEntityId.toString() !== id)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only update inventory for your associated blood bank.',
      });
    }
    const bank = await BloodBank.findById(id);
    if (!bank) {
      return res.status(404).json({
        success: false,
        message: 'Blood bank not found.',
      });
    }
    // Capture previousValue for audit
    const previousValue = {
      bloodType,
      units: bank.inventory[bloodType] ? bank.inventory[bloodType].units : 0,
    };
    // Update inventory using instance method
    await bank.updateInventoryEntry(bloodType, units);
    // Record UPDATE_INVENTORY audit log
    await AuditLog.record({
      userId: req.user.id,
      action: AUDIT_ACTIONS.UPDATE_INVENTORY,
      targetCollection: 'bloodbanks',
      targetDocumentId: bank._id,
      previousValue,
      newValue: {
        bloodType,
        units,
      },
      ipAddress: req.ip,
    });

    return res.status(200).json({
      success: true,
      message: 'Inventory updated successfully.',
      data: bank,
    });
  } catch (err) {
    console.error('updateInventory error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'An internal error occurred while updating the inventory.',
    });
  }
};

/**
 * @desc    Create a new blood bank
 * @route   POST /api/bloodbanks
 * @access  Protected (super_admin only)
 */
const createBloodBankValidation = [
  body('name')
    .trim()
    .notEmpty().withMessage('Blood bank name is required.')
    .isLength({ max: 150 }).withMessage('Name cannot exceed 150 characters.'),
  body('branch')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 100 }).withMessage('Branch name cannot exceed 100 characters.'),
  body('address')
    .trim()
    .notEmpty().withMessage('Address is required.'),
  body('contact')
    .trim()
    .notEmpty().withMessage('Contact number is required.'),
  body('operatingHours')
    .optional()
    .trim(),
  body('location.coordinates')
    .isArray({ min: 2, max: 2 }).withMessage('Coordinates must be an array of exactly [longitude, latitude].')
    .custom((coords) => {
      const [lng, lat] = coords;
      return typeof lng === 'number' && typeof lat === 'number' &&
             lng >= -180 && lng <= 180 &&
             lat >= -90 && lat <= 90;
    }).withMessage('Coordinates must be valid [longitude (-180 to 180), latitude (-90 to 90)].'),
  body('alertThreshold')
    .optional()
    .isInt({ min: 0 }).withMessage('Alert threshold must be a non-negative integer.'),
];

const createBloodBank = async (req, res) => {
  try {
    if (hasValidationErrors(req, res)) return;

    const { name, branch, address, contact, operatingHours, location, alertThreshold } = req.body;

    const newBank = await BloodBank.create({
      name,
      branch: branch || null,
      address,
      contact,
      operatingHours: operatingHours || '24/7',
      location: {
        type: 'Point',
        coordinates: location.coordinates,
      },
      alertThreshold: alertThreshold !== undefined ? alertThreshold : 10,
    });

    // Record ONBOARD_BLOOD_BANK audit log
    await AuditLog.record({
      userId: req.user.id,
      action: AUDIT_ACTIONS.ONBOARD_BLOOD_BANK,
      targetCollection: 'bloodbanks',
      targetDocumentId: newBank._id,
      newValue: {
        name,
        branch,
        address,
        contact,
        coordinates: location.coordinates,
      },
      ipAddress: req.ip,
    });

    return res.status(201).json({
      success: true,
      message: 'Blood bank onboarded successfully.',
      data: newBank,
    });
  } catch (err) {
    console.error('createBloodBank error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'An internal error occurred while creating the blood bank.',
    });
  }
};

/**
 * @desc    Toggle blood bank active status
 * @route   PATCH /api/bloodbanks/:id/status
 * @access  Protected (super_admin only)
 */
const toggleBloodBankStatusValidation = [
  param('id').custom((val) => mongoose.Types.ObjectId.isValid(val)).withMessage('Invalid blood bank ID format.'),
];

const toggleBloodBankStatus = async (req, res) => {
  try {
    if (hasValidationErrors(req, res)) return;

    const { id } = req.params;

    const bank = await BloodBank.findById(id);
    if (!bank) {
      return res.status(404).json({
        success: false,
        message: 'Blood bank not found.',
      });
    }

    const previousStatus = bank.isActive;
    bank.isActive = !bank.isActive;
    await bank.save();

    const action = bank.isActive ? AUDIT_ACTIONS.ACTIVATE_ENTITY : AUDIT_ACTIONS.DEACTIVATE_ENTITY;

    // Record audit log
    await AuditLog.record({
      userId: req.user.id,
      action,
      targetCollection: 'bloodbanks',
      targetDocumentId: bank._id,
      previousValue: { isActive: previousStatus },
      newValue: { isActive: bank.isActive },
      ipAddress: req.ip,
    });

    return res.status(200).json({
      success: true,
      message: `Blood bank status set to ${bank.isActive ? 'active' : 'inactive'}.`,
      data: bank,
    });
  } catch (err) {
    console.error('toggleBloodBankStatus error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'An internal error occurred while toggling blood bank status.',
    });
  }
};

module.exports = {
  getAllBloodBanks,
  getBloodBankById,
  updateInventory,
  updateInventoryValidation,
  createBloodBank,
  createBloodBankValidation,
  toggleBloodBankStatus,
  toggleBloodBankStatusValidation,
};
