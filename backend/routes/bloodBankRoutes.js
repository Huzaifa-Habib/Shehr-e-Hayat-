'use strict';

const express = require('express');
const router  = express.Router();

const { protect } = require('../middleware/auth');
const authorize = require('../middleware/authorize');

const {
  getAllBloodBanks,
  getBloodBankById,
  updateInventory,
  updateInventoryValidation,
  createBloodBank,
  createBloodBankValidation,
  toggleBloodBankStatus,
  toggleBloodBankStatusValidation,
} = require('../controllers/bloodBankController');

/**
 * @route   GET /api/bloodbanks
 * @desc    Get all active blood banks
 * @access  Public
 */
router.get('/', getAllBloodBanks);

/**
 * @route   GET /api/bloodbanks/:id
 * @desc    Get a single blood bank by ID
 * @access  Public
 */
router.get('/:id', getBloodBankById);

/**
 * @route   PUT /api/bloodbanks/:id/inventory
 * @desc    Update blood bank inventory
 * @access  Protected (blood_bank_admin, super_admin)
 */
router.put('/:id/inventory', protect, authorize('blood_bank_admin', 'super_admin'), updateInventoryValidation, updateInventory);

/**
 * @route   POST /api/bloodbanks
 * @desc    Create a new blood bank
 * @access  Protected (super_admin)
 */
router.post('/', protect, authorize('super_admin'), createBloodBankValidation, createBloodBank);

/**
 * @route   PATCH /api/bloodbanks/:id/status
 * @desc    Toggle blood bank active status
 * @access  Protected (super_admin)
 */
router.patch('/:id/status', protect, authorize('super_admin'), toggleBloodBankStatusValidation, toggleBloodBankStatus);

module.exports = router;
