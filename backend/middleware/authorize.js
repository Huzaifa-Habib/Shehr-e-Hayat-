'use strict';

/**
 * authorize — Role-Based Authorization Middleware
 *
 * Accepts a list of allowed roles and returns a middleware function
 * that checks whether the authenticated user's role is in the list.
 *
 * Must be used AFTER the `protect` middleware (which populates req.user).
 *
 * Usage:
 *   router.put('/inventory/:bankId', protect, authorize('blood_bank_admin', 'super_admin'), controller);
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required before authorization.',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden. This action requires one of these roles: ${allowedRoles.join(', ')}. Your role: ${req.user.role}.`,
      });
    }

    next();
  };
};

module.exports = authorize;
