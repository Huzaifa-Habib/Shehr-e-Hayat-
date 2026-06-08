'use strict';

const express = require('express');
const router  = express.Router();

const { protect } = require('../middleware/auth');

const {
  register,
  registerValidation,
  login,
  loginValidation,
  getMe,
  authLimiter,
} = require('../controllers/authController');

// ─── Public Routes ───────────────────────────────────────────────────────────

/**
 * @route   POST /api/auth/register
 * @desc    Register a new donor account
 * @access  Public (rate-limited)
 */
router.post('/register', authLimiter, registerValidation, register);

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user & return JWT
 * @access  Public (rate-limited)
 */
router.post('/login', authLimiter, loginValidation, login);

// ─── Protected Routes ────────────────────────────────────────────────────────

/**
 * @route   GET /api/auth/me
 * @desc    Get currently authenticated user's profile
 * @access  Protected
 */
router.get('/me', protect, getMe);

// ─── Export ──────────────────────────────────────────────────────────────────

module.exports = router;
