'use strict';

const express = require('express');
const router  = express.Router();

const { protect } = require('../middleware/auth');
const authorize = require('../middleware/authorize');

const {
  bookAppointment,
  bookAppointmentValidation,
  getMyAppointments,
  getBankAppointments,
  updateAppointmentStatus,
  updateAppointmentStatusValidation,
} = require('../controllers/appointmentController');

/**
 * @route   POST /api/appointments
 * @desc    Book a new blood donation appointment
 * @access  Protected (donor)
 */
router.post('/', protect, authorize('donor'), bookAppointmentValidation, bookAppointment);

/**
 * @route   GET /api/appointments/my
 * @desc    Get current donor's appointments
 * @access  Protected (donor)
 */
router.get('/my', protect, authorize('donor'), getMyAppointments);

/**
 * @route   GET /api/appointments/bank/:bankId
 * @desc    Get appointments for a specific blood bank
 * @access  Protected (blood_bank_admin, super_admin)
 */
router.get('/bank/:bankId', protect, authorize('blood_bank_admin', 'super_admin'), getBankAppointments);

/**
 * @route   PATCH /api/appointments/:id/status
 * @desc    Update appointment status
 * @access  Protected (blood_bank_admin)
 */
router.patch('/:id/status', protect, authorize('blood_bank_admin'), updateAppointmentStatusValidation, updateAppointmentStatus);

module.exports = router;
