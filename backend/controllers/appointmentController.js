'use strict';

const mongoose = require('mongoose');
const { body, param, query, validationResult } = require('express-validator');
const Appointment = require('../models/Appointment');
const { APPOINTMENT_STATUSES } = require('../models/Appointment');
const BloodBank = require('../models/BloodBank');
const { BLOOD_TYPES } = require('../models/BloodBank');
const User = require('../models/User');
const { ROLES } = require('../models/User');
const BloodRequest = require('../models/BloodRequest');
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
 * @desc    Book a new blood donation appointment
 * @route   POST /api/appointments
 * @access  Protected (donor only)
 */
const bookAppointmentValidation = [
  body('bloodBankId')
    .notEmpty().withMessage('Blood bank ID is required.')
    .custom((val) => mongoose.Types.ObjectId.isValid(val)).withMessage('Invalid blood bank ID format.'),
  body('scheduledDate')
    .notEmpty().withMessage('Scheduled date is required.')
    .isISO8601().withMessage('Scheduled date must be a valid ISO date.')
    .custom((val) => new Date(val) > new Date()).withMessage('Scheduled date must be in the future.'),
  body('bloodType')
    .notEmpty().withMessage('Blood type is required.')
    .isIn(BLOOD_TYPES).withMessage(`Blood type must be one of: ${BLOOD_TYPES.join(', ')}`),
  body('notes')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 500 }).withMessage('Notes cannot exceed 500 characters.'),
  body('requestId')
    .optional({ nullable: true })
    .custom((val) => !val || mongoose.Types.ObjectId.isValid(val)).withMessage('Invalid blood request ID format.'),
];

const bookAppointment = async (req, res) => {
  try {
    if (hasValidationErrors(req, res)) return;

    const { bloodBankId, scheduledDate, bloodType, notes, requestId } = req.body;

    // Verify blood bank exists and is active
    const bank = await BloodBank.findById(bloodBankId);
    if (!bank || !bank.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Blood bank does not exist or is inactive.',
      });
    }

    // Check donor eligibility
    const donor = await User.findById(req.user.id);
    if (!donor) {
      return res.status(404).json({
        success: false,
        message: 'Donor not found.',
      });
    }

    if (donor.role !== ROLES.DONOR) {
      return res.status(403).json({
        success: false,
        message: 'Only registered donors can book appointments.',
      });
    }

    if (!donor.isEligibleToDonate) {
      return res.status(400).json({
        success: false,
        message: 'You are not currently eligible to donate blood.',
        daysUntilEligible: donor.daysUntilEligible,
      });
    }

    // Check for duplicate appointment on same calendar date
    const targetDate = new Date(scheduledDate);
    const startOfDay = new Date(targetDate);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const duplicate = await Appointment.findOne({
      donorId: req.user.id,
      bloodBankId,
      status: { $in: [APPOINTMENT_STATUSES.PENDING, APPOINTMENT_STATUSES.CONFIRMED] },
      scheduledDate: {
        $gte: startOfDay,
        $lte: endOfDay,
      },
    });

    if (duplicate) {
      return res.status(400).json({
        success: false,
        message: 'You already have an active appointment scheduled at this bank on the selected date.',
      });
    }

    // Create appointment
    const appointment = await Appointment.create({
      donorId: req.user.id,
      bloodBankId,
      requestId: requestId || null,
      scheduledDate: new Date(scheduledDate),
      bloodType,
      notes: notes || null,
    });

    // Record BOOK_APPOINTMENT audit log
    await AuditLog.record({
      userId: req.user.id,
      action: AUDIT_ACTIONS.BOOK_APPOINTMENT,
      targetCollection: 'appointments',
      targetDocumentId: appointment._id,
      newValue: {
        bloodBankId,
        scheduledDate,
        bloodType,
        requestId,
      },
      ipAddress: req.ip,
    });

    return res.status(201).json({
      success: true,
      message: 'Appointment booked successfully.',
      data: appointment,
    });
  } catch (err) {
    console.error('bookAppointment error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while booking the appointment.',
    });
  }
};

/**
 * @desc    Get appointments for the logged-in donor
 * @route   GET /api/appointments/my
 * @access  Protected (donor only)
 */
const getMyAppointments = async (req, res) => {
  try {
    const { status } = req.query;

    const queryParams = { donorId: req.user.id };
    if (status) {
      queryParams.status = status;
    }

    const appointments = await Appointment.find(queryParams)
      .populate('bloodBankId', 'name branch address contact')
      .populate('requestId', 'bloodTypeRequired urgency hospitalId')
      .sort({ scheduledDate: -1 });

    return res.status(200).json({
      success: true,
      count: appointments.length,
      data: appointments,
    });
  } catch (err) {
    console.error('getMyAppointments error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while retrieving your appointments.',
    });
  }
};

/**
 * @desc    Get all appointments for a specific blood bank
 * @route   GET /api/appointments/bank/:bankId
 * @access  Protected (blood_bank_admin for own bank, super_admin)
 */
const getBankAppointments = async (req, res) => {
  try {
    const { bankId } = req.params;
    const { status, date } = req.query;

    if (!mongoose.Types.ObjectId.isValid(bankId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid blood bank ID format.',
      });
    }

    // Ownership check
    if (req.user.role === ROLES.BLOOD_BANK_ADMIN && (!req.user.associatedEntityId || req.user.associatedEntityId.toString() !== bankId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view appointments for your own blood bank.',
      });
    }

    const queryParams = { bloodBankId: bankId };

    if (status) {
      queryParams.status = status;
    }

    if (date) {
      const targetDate = new Date(date);
      const startOfDay = new Date(targetDate);
      startOfDay.setUTCHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate);
      endOfDay.setUTCHours(23, 59, 59, 999);

      queryParams.scheduledDate = {
        $gte: startOfDay,
        $lte: endOfDay,
      };
    }

    const appointments = await Appointment.find(queryParams)
      .populate('donorId', 'name email phone bloodType')
      .sort({ scheduledDate: 1 });

    return res.status(200).json({
      success: true,
      count: appointments.length,
      data: appointments,
    });
  } catch (err) {
    console.error('getBankAppointments error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while retrieving bank appointments.',
    });
  }
};

/**
 * @desc    Update status of an appointment
 * @route   PATCH /api/appointments/:id/status
 * @access  Protected (blood_bank_admin only)
 */
const updateAppointmentStatusValidation = [
  param('id').custom((val) => mongoose.Types.ObjectId.isValid(val)).withMessage('Invalid appointment ID format.'),
  body('status')
    .notEmpty().withMessage('Status is required.')
    .isIn([
      APPOINTMENT_STATUSES.CONFIRMED,
      APPOINTMENT_STATUSES.COMPLETED,
      APPOINTMENT_STATUSES.CANCELLED,
      APPOINTMENT_STATUSES.NO_SHOW,
    ]).withMessage('Status must be one of: Confirmed, Completed, Cancelled, No_Show.'),
];

const updateAppointmentStatus = async (req, res) => {
  try {
    if (hasValidationErrors(req, res)) return;

    const { id } = req.params;
    const { status } = req.body;

    const appointment = await Appointment.findById(id);
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found.',
      });
    }

    // Find the associated blood bank
    const bank = await BloodBank.findById(appointment.bloodBankId);
    if (!bank) {
      return res.status(404).json({
        success: false,
        message: 'Associated blood bank not found.',
      });
    }

    // Ownership check: verify current user is the admin of this blood bank
    if (!req.user.associatedEntityId || req.user.associatedEntityId.toString() !== bank._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only update appointments for your own blood bank.',
      });
    }

    // Validate state transitions
    const allowedTransitions = {
      [APPOINTMENT_STATUSES.PENDING]: [APPOINTMENT_STATUSES.CONFIRMED, APPOINTMENT_STATUSES.CANCELLED],
      [APPOINTMENT_STATUSES.CONFIRMED]: [APPOINTMENT_STATUSES.COMPLETED, APPOINTMENT_STATUSES.CANCELLED, APPOINTMENT_STATUSES.NO_SHOW],
      [APPOINTMENT_STATUSES.COMPLETED]: [],
      [APPOINTMENT_STATUSES.CANCELLED]: [],
      [APPOINTMENT_STATUSES.NO_SHOW]: [],
    };

    const currentStatus = appointment.status;
    if (!allowedTransitions[currentStatus].includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot transition appointment status from ${currentStatus} to ${status}.`,
      });
    }

    const previousStatus = appointment.status;
    appointment.status = status;
    appointment.confirmedBy = req.user.id;

    // Handle Completed status details
    if (status === APPOINTMENT_STATUSES.COMPLETED) {
      // 1. Update donor last donation date
      const donor = await User.findById(appointment.donorId);
      if (donor) {
        donor.lastDonationDate = new Date();
        await donor.save();
      }

      // 2. Increment blood bank inventory
      const bt = appointment.bloodType;
      if (bank.inventory[bt]) {
        bank.inventory[bt].units += 1;
        bank.inventory[bt].lastUpdated = new Date();
        await bank.save();
      }

      // 3. Increment Blood Request fulfillment if applicable
      if (appointment.requestId) {
        const request = await BloodRequest.findById(appointment.requestId);
        if (request) {
          request.unitsFulfilled += 1;
          await request.save(); // status will be auto-calculated in pre-save hook
        }
      }
    }

    await appointment.save();

    // Determine audit action
    let auditAction;
    if (status === APPOINTMENT_STATUSES.CONFIRMED) auditAction = AUDIT_ACTIONS.CONFIRM_APPOINTMENT;
    else if (status === APPOINTMENT_STATUSES.COMPLETED) auditAction = AUDIT_ACTIONS.COMPLETE_APPOINTMENT;
    else if (status === APPOINTMENT_STATUSES.CANCELLED) auditAction = AUDIT_ACTIONS.CANCEL_APPOINTMENT;
    else if (status === APPOINTMENT_STATUSES.NO_SHOW) auditAction = AUDIT_ACTIONS.NO_SHOW_APPOINTMENT;

    // Record audit log
    await AuditLog.record({
      userId: req.user.id,
      action: auditAction,
      targetCollection: 'appointments',
      targetDocumentId: appointment._id,
      previousValue: { status: previousStatus },
      newValue: { status },
      ipAddress: req.ip,
    });

    return res.status(200).json({
      success: true,
      message: `Appointment successfully marked as ${status}.`,
      data: appointment,
    });
  } catch (err) {
    console.error('updateAppointmentStatus error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while updating the appointment status.',
    });
  }
};

module.exports = {
  bookAppointment,
  bookAppointmentValidation,
  getMyAppointments,
  getBankAppointments,
  updateAppointmentStatus,
  updateAppointmentStatusValidation,
};
