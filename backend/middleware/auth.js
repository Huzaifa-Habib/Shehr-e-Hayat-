'use strict';

const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * protect — JWT Authentication Middleware
 *
 * Extracts the Bearer token from the Authorization header, verifies it,
 * and attaches the decoded user payload to `req.user`.
 *
 * Expected header format:  Authorization: Bearer <token>
 * Decoded payload shape:   { id, role, associatedEntityId }
 */
const protect = async (req, res, next) => {
  try {
    // 1. Extract token from header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No authentication token provided.',
      });
    }

    const token = authHeader.split(' ')[1];

    // 2. Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Token has expired. Please log in again.',
        });
      }
      return res.status(401).json({
        success: false,
        message: 'Invalid authentication token.',
      });
    }

    // 3. Verify user still exists and is verified
    const user = await User.findById(decoded.id).select('role associatedEntityId isVerified name email');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'The user associated with this token no longer exists.',
      });
    }

    if (!user.isVerified) {
      return res.status(403).json({
        success: false,
        message: 'Your account is pending verification by a super admin.',
      });
    }

    // 4. Attach user info to the request object for downstream handlers
    req.user = {
      id:                 user._id,
      role:               user.role,
      associatedEntityId: user.associatedEntityId,
      name:               user.name,
      email:              user.email,
    };

    next();
  } catch (err) {
    console.error('Auth middleware error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Internal authentication error.',
    });
  }
};

module.exports = { protect };
