'use strict';

const express = require('express');
const router  = express.Router();

const { protect } = require('../middleware/auth');
const authorize = require('../middleware/authorize');

const {
  getAllRequests,
  getRequestById,
  createRequest,
  createRequestValidation,
  updateRequest,
  updateRequestValidation,
  deleteRequest,
  deleteRequestValidation,
} = require('../controllers/bloodRequestController');

/**
 * @route   GET /api/requests
 * @desc    Get all active requests
 * @access  Public
 */
router.get('/', getAllRequests);

/**
 * @route   GET /api/requests/:id
 * @desc    Get a blood request by ID
 * @access  Public
 */
router.get('/:id', getRequestById);

/**
 * @route   POST /api/requests
 * @desc    Create a new blood request
 * @access  Protected (hospital_admin)
 */
router.post('/', protect, authorize('hospital_admin', 'blood_bank_admin'), createRequestValidation, createRequest);

/**
 * @route   PATCH /api/requests/:id
 * @desc    Update a blood request
 * @access  Protected (hospital_admin, super_admin)
 */
router.patch('/:id', protect, authorize('hospital_admin', 'super_admin'), updateRequestValidation, updateRequest);

/**
 * @route   DELETE /api/requests/:id
 * @desc    Soft close a blood request
 * @access  Protected (hospital_admin, super_admin)
 */
router.delete('/:id', protect, authorize('hospital_admin', 'super_admin'), deleteRequestValidation, deleteRequest);

module.exports = router;
