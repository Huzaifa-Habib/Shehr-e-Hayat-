'use strict';

const jwt              = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const rateLimit        = require('express-rate-limit');
const User             = require('../models/User');
const AuditLog         = require('../models/AuditLog');
const { ROLES, BLOOD_TYPES } = require('../models/User');
const { AUDIT_ACTIONS }      = require('../models/AuditLog');

// ─── JWT Helper ──────────────────────────────────────────────────────────────

/**
 * Sign a JWT for the given user.
 * @param {Object} user - Mongoose user document (needs _id, role, associatedEntityId)
 * @returns {string} Signed JWT
 */
const signToken = (user) => {
  return jwt.sign(
    {
      id:                 user._id,
      role:               user.role,
      associatedEntityId: user.associatedEntityId,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// ─── Auth Rate Limiter ───────────────────────────────────────────────────────

/**
 * Stricter rate limiter for authentication endpoints.
 * 10 requests per 15-minute window per IP.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max:      10,
  standardHeaders: true,
  legacyHeaders:   false,
  message: {
    success: false,
    message: 'Too many authentication attempts. Please try again after 15 minutes.',
  },
});

// ─── Validation Rules ────────────────────────────────────────────────────────

/** Validation chain for the register endpoint. */
const registerValidation = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required.')
    .isLength({ min: 3, max: 100 }).withMessage('Name must be between 3 and 100 characters.'),

  body('email')
    .trim()
    .notEmpty().withMessage('Email is required.')
    .isEmail().withMessage('Please provide a valid email address.')
    .normalizeEmail({ gmail_remove_dots: false, gmail_remove_subaddress: false }),

  body('phone')
    .trim()
    .notEmpty().withMessage('Phone number is required.')
    .matches(/^\+92\d{10}$/).withMessage('Phone must be in Pakistani format: +92XXXXXXXXXX'),

  body('password')
    .notEmpty().withMessage('Password is required.')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters.')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter.')
    .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter.')
    .matches(/\d/).withMessage('Password must contain at least one number.'),

  body('bloodType')
    .notEmpty().withMessage('Blood type is required.')
    .isIn(BLOOD_TYPES).withMessage(`Blood type must be one of: ${BLOOD_TYPES.join(', ')}`),
];

/** Validation chain for the login endpoint. */
const loginValidation = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required.')
    .isEmail().withMessage('Please provide a valid email address.')
    .normalizeEmail({ gmail_remove_dots: false, gmail_remove_subaddress: false }),

  body('password')
    .notEmpty().withMessage('Password is required.'),
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Check express-validator results and return a 400 response if any are invalid.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {boolean} true if there are errors (response already sent), false otherwise
 */
const hasValidationErrors = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      message: 'Validation failed.',
      errors:  errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
    return true;
  }
  return false;
};

/**
 * Build a sanitised user object safe for API responses (no passwordHash).
 * @param {Object} user - Mongoose user document
 * @returns {Object}
 */
const sanitiseUser = (user) => {
  const obj = user.toJSON ? user.toJSON() : { ...user };
  delete obj.passwordHash;
  return obj;
};

// ─── Controllers ─────────────────────────────────────────────────────────────

/**
 * @desc    Register a new donor account
 * @route   POST /api/auth/register
 * @access  Public
 */
const register = async (req, res) => {
  try {
    // 1. Validate input
    if (hasValidationErrors(req, res)) return;
    const { name, email, phone, password, bloodType } = req.body;
    // 2. Check for duplicate email
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'An account with this email already exists.',
      });
    }
    // 3. Hash password
    const passwordHash = await User.hashPassword(password);
    // 4. Create user (donor-only, auto-verified)
    const user = await User.create({
      name,
      email,
      phone,
      passwordHash,
      bloodType,
      role:       ROLES.DONOR,
      isVerified: true,
    });
    // 5. Audit log
    await AuditLog.record({
      userId:           user._id,
      action:           AUDIT_ACTIONS.REGISTER,
      targetCollection: 'users',
      targetDocumentId: user._id,
      newValue:         { name, email, role: ROLES.DONOR, bloodType },
      ipAddress:        req.ip,
    });
    // 6. Generate JWT
    const token = signToken(user);

    // 7. Respond
    return res.status(201).json({
      success: true,
      message: 'Registration successful.',
      data: {
        token,
        user: sanitiseUser(user),
      },
    });
  } catch (err) {
    // Handle Mongoose duplicate-key error (race condition safeguard)
    if (err.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'An account with this email already exists.',
      });
    }
    console.error('Register error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'An internal error occurred during registration.',
    });
  }
};

/**
 * @desc    Authenticate user and return JWT
 * @route   POST /api/auth/login
 * @access  Public
 */
const login = async (req, res) => {
  try {
    // 1. Validate input
    if (hasValidationErrors(req, res)) return;

    const { email, password } = req.body;

    // 2. Find user (include passwordHash which is select:false by default)
    const user = await User.findOne({ email }).select('+passwordHash');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials.',
      });
    }

    // 3. Verify password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      // Record failed login attempt
      await AuditLog.record({
        userId:           user._id,
        action:           AUDIT_ACTIONS.FAILED_LOGIN,
        targetCollection: 'users',
        targetDocumentId: user._id,
        ipAddress:        req.ip,
        meta:             { reason: 'Incorrect password' },
      });

      return res.status(401).json({
        success: false,
        message: 'Invalid credentials.',
      });
    }

    // 4. Check verification status
    if (!user.isVerified) {
      return res.status(403).json({
        success: false,
        message: 'Account pending verification. Please contact a super admin.',
      });
    }

    // 5. Generate JWT
    const token = signToken(user);

    // 6. Audit log
    await AuditLog.record({
      userId:           user._id,
      action:           AUDIT_ACTIONS.LOGIN,
      targetCollection: 'users',
      targetDocumentId: user._id,
      ipAddress:        req.ip,
    });

    // 7. Respond
    return res.status(200).json({
      success: true,
      message: 'Login successful.',
      data: {
        token,
        user: sanitiseUser(user),
      },
    });
  } catch (err) {
    console.error('Login error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'An internal error occurred during login.',
    });
  }
};

/**
 * @desc    Get the currently authenticated user's profile
 * @route   GET /api/auth/me
 * @access  Protected
 */
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    // Populate associatedEntityId based on user role
    if (req.user.role === ROLES.BLOOD_BANK_ADMIN && user.associatedEntityId) {
      await user.populate({ path: 'associatedEntityId', model: 'BloodBank' });
    } else if (req.user.role === ROLES.HOSPITAL_ADMIN && user.associatedEntityId) {
      await user.populate({ path: 'associatedEntityId', model: 'Hospital' });
    }

    return res.status(200).json({
      success: true,
      data: { user: sanitiseUser(user) },
    });
  } catch (err) {
    console.error('GetMe error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'An internal error occurred while retrieving your profile.',
    });
  }
};

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  register,
  registerValidation,
  login,
  loginValidation,
  getMe,
  authLimiter,
};
