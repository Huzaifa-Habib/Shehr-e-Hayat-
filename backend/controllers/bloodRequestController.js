'use strict';

const mongoose = require('mongoose');
const { body, param, query, validationResult } = require('express-validator');
const BloodRequest = require('../models/BloodRequest');
const { URGENCY_LEVELS, REQUEST_STATUSES, CASE_TYPES } = require('../models/BloodRequest');
const Hospital = require('../models/Hospital');
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
 * @desc    Get all requests
 * @route   GET /api/requests
 * @access  Public
 */
const getAllRequests = async (req, res) => {
  try {
    const { status, urgency, bloodType } = req.query;
    const filter = {};
    if (status) {
      filter.status = status;
    } else {
      filter.status = { $ne: REQUEST_STATUSES.CLOSED };
      filter.expiresAt = { $gt: new Date() };
    }

    if (urgency) {
      filter.urgency = urgency;
    }

    if (bloodType) {
      filter.bloodTypeRequired = bloodType;
    }
    const requests = await BloodRequest.find(filter)
      .populate('hospitalId', 'name shortCode address contact')
      .populate('postedBy', 'name email');
    const urgencyPriority = {
      [URGENCY_LEVELS.CRITICAL]: 1,
      [URGENCY_LEVELS.URGENT]: 2,
      [URGENCY_LEVELS.NORMAL]: 3,
    };

    requests.sort((a, b) => {
      const priorityA = urgencyPriority[a.urgency] || 99;
      const priorityB = urgencyPriority[b.urgency] || 99;
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
    return res.status(200).json({
      success: true,
      count: requests.length,
      data: requests,
    });
  } catch (err) {
    console.error('getAllRequests error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while retrieving blood requests.',
    });
  }
};

/**
 * @desc    Get blood request by ID
 * @route   GET /api/requests/:id
 * @access  Public
 */
const getRequestById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request ID format.',
      });
    }

    const request = await BloodRequest.findById(id)
      .populate('hospitalId', 'name shortCode address contact')
      .populate('postedBy', 'name email');

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Blood request not found.',
      });
    }

    return res.status(200).json({
      success: true,
      data: request,
    });
  } catch (err) {
    console.error('getRequestById error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while retrieving the blood request.',
    });
  }
};

/**
 * @desc    Create a new blood request
 * @route   POST /api/requests
 * @access  Protected (hospital_admin only)
 */
const createRequestValidation = [
  body('bloodTypeRequired')
    .notEmpty().withMessage('Required blood type is required.')
    .isIn(BLOOD_TYPES).withMessage(`Blood type must be one of: ${BLOOD_TYPES.join(', ')}`),
  body('unitsRequested')
    .notEmpty().withMessage('Units requested is required.')
    .isInt({ min: 1, max: 50 }).withMessage('Units requested must be an integer between 1 and 50.'),
  body('urgency')
    .notEmpty().withMessage('Urgency level is required.')
    .isIn(Object.values(URGENCY_LEVELS)).withMessage(`Urgency level must be one of: ${Object.values(URGENCY_LEVELS).join(', ')}`),
  body('patientInfo.caseType')
    .notEmpty().withMessage('Patient case type is required.')
    .isIn(CASE_TYPES).withMessage(`Case type must be one of: ${CASE_TYPES.join(', ')}`),
  body('patientInfo.wardOrDept')
    .optional({ nullable: true })
    .trim()
    .isString(),
  body('expiresAt')
    .optional()
    .isISO8601().withMessage('ExpiresAt must be a valid ISO date.')
    .custom((val) => new Date(val) > new Date()).withMessage('Expiry date must be in the future.'),
];

const createRequest = async (req, res) => {
  try {
    if (hasValidationErrors(req, res)) return;

    const hospitalId = req.user.associatedEntityId;
    if (!hospitalId) {
      return res.status(400).json({
        success: false,
        message: 'No associated hospital entity found for this user.',
      });
    }

    // Verify hospital exists and is active
    const hospital = await Hospital.findById(hospitalId);
    if (!hospital || !hospital.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Associated hospital is inactive or does not exist.',
      });
    }

    const { bloodTypeRequired, unitsRequested, urgency, patientInfo, expiresAt } = req.body;

    const createData = {
      hospitalId,
      postedBy: req.user.id,
      bloodTypeRequired,
      unitsRequested,
      urgency,
      patientInfo: {
        caseType: patientInfo.caseType,
        wardOrDept: patientInfo.wardOrDept || null,
      },
    };

    if (expiresAt) {
      createData.expiresAt = new Date(expiresAt);
    }

    const request = await BloodRequest.create(createData);

    // Record CREATE_REQUEST audit log
    await AuditLog.record({
      userId: req.user.id,
      action: AUDIT_ACTIONS.CREATE_REQUEST,
      targetCollection: 'bloodrequests',
      targetDocumentId: request._id,
      newValue: {
        hospitalId,
        bloodTypeRequired,
        unitsRequested,
        urgency,
        patientInfo,
      },
      ipAddress: req.ip,
    });

    return res.status(201).json({
      success: true,
      message: 'Blood request created successfully.',
      data: request,
    });
  } catch (err) {
    console.error('createRequest error:', err.message, err.stack);
    return res.status(500).json({
      success: false,
      message: err.message || 'An error occurred while creating the blood request.',
    });
  }
};

/**
 * @desc    Update a blood request
 * @route   PATCH /api/requests/:id
 * @access  Protected (hospital_admin for own requests, super_admin)
 */
const updateRequestValidation = [
  param('id').custom((val) => mongoose.Types.ObjectId.isValid(val)).withMessage('Invalid request ID format.'),
  body('unitsFulfilled')
    .optional()
    .isInt({ min: 0 }).withMessage('Units fulfilled must be a non-negative integer.'),
  body('urgency')
    .optional()
    .isIn(Object.values(URGENCY_LEVELS)).withMessage(`Urgency level must be one of: ${Object.values(URGENCY_LEVELS).join(', ')}`),
  body('patientInfo.wardOrDept')
    .optional({ nullable: true })
    .trim()
    .isString(),
];

const updateRequest = async (req, res) => {
  try {
    if (hasValidationErrors(req, res)) return;

    const { id } = req.params;
    const request = await BloodRequest.findById(id);

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Blood request not found.',
      });
    }

    // Ownership check
    if (req.user.role === 'hospital_admin' && (!req.user.associatedEntityId || request.hospitalId.toString() !== req.user.associatedEntityId.toString())) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only update requests for your associated hospital.',
      });
    }

    const previousValue = {
      unitsFulfilled: request.unitsFulfilled,
      urgency: request.urgency,
      wardOrDept: request.patientInfo ? request.patientInfo.wardOrDept : null,
    };

    const { unitsFulfilled, urgency, patientInfo } = req.body;

    if (unitsFulfilled !== undefined) {
      if (unitsFulfilled > request.unitsRequested) {
        return res.status(400).json({
          success: false,
          message: `Units fulfilled cannot exceed units requested (${request.unitsRequested}).`,
        });
      }
      request.unitsFulfilled = unitsFulfilled;
    }

    if (urgency !== undefined) {
      request.urgency = urgency;
    }

    if (patientInfo && patientInfo.wardOrDept !== undefined) {
      request.patientInfo.wardOrDept = patientInfo.wardOrDept;
    }

    await request.save();

    // Record UPDATE_REQUEST audit log
    await AuditLog.record({
      userId: req.user.id,
      action: AUDIT_ACTIONS.UPDATE_REQUEST,
      targetCollection: 'bloodrequests',
      targetDocumentId: request._id,
      previousValue,
      newValue: {
        unitsFulfilled: request.unitsFulfilled,
        urgency: request.urgency,
        wardOrDept: request.patientInfo ? request.patientInfo.wardOrDept : null,
      },
      ipAddress: req.ip,
    });

    return res.status(200).json({
      success: true,
      message: 'Blood request updated successfully.',
      data: request,
    });
  } catch (err) {
    console.error('updateRequest error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while updating the blood request.',
    });
  }
};

/**
 * @desc    Soft close a blood request
 * @route   DELETE /api/requests/:id
 * @access  Protected (hospital_admin for own requests, super_admin)
 */
const deleteRequestValidation = [
  param('id').custom((val) => mongoose.Types.ObjectId.isValid(val)).withMessage('Invalid request ID format.'),
];

const deleteRequest = async (req, res) => {
  try {
    if (hasValidationErrors(req, res)) return;

    const { id } = req.params;
    const request = await BloodRequest.findById(id);

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Blood request not found.',
      });
    }

    // Ownership check
    if (req.user.role === 'hospital_admin' && (!req.user.associatedEntityId || request.hospitalId.toString() !== req.user.associatedEntityId.toString())) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only close requests for your associated hospital.',
      });
    }

    if (request.status === REQUEST_STATUSES.CLOSED) {
      return res.status(400).json({
        success: false,
        message: 'Blood request is already closed.',
      });
    }

    const previousStatus = request.status;
    request.status = REQUEST_STATUSES.CLOSED;
    await request.save();

    // Record CLOSE_REQUEST audit log
    await AuditLog.record({
      userId: req.user.id,
      action: AUDIT_ACTIONS.CLOSE_REQUEST,
      targetCollection: 'bloodrequests',
      targetDocumentId: request._id,
      previousValue: { status: previousStatus },
      newValue: { status: request.status },
      ipAddress: req.ip,
    });

    return res.status(200).json({
      success: true,
      message: 'Blood request closed successfully.',
    });
  } catch (err) {
    console.error('deleteRequest error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while closing the blood request.',
    });
  }
};

module.exports = {
  getAllRequests,
  getRequestById,
  createRequest,
  createRequestValidation,
  updateRequest,
  updateRequestValidation,
  deleteRequest,
  deleteRequestValidation,
};
