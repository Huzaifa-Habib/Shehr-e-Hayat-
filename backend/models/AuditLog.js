'use strict';

const mongoose = require('mongoose');

// ─── Constants ───────────────────────────────────────────────────────────────

const AUDIT_ACTIONS = Object.freeze({
  // Auth
  LOGIN:              'LOGIN',
  LOGOUT:             'LOGOUT',
  REGISTER:           'REGISTER',
  FAILED_LOGIN:       'FAILED_LOGIN',

  // Inventory
  UPDATE_INVENTORY:   'UPDATE_INVENTORY',

  // Blood Requests
  CREATE_REQUEST:     'CREATE_REQUEST',
  UPDATE_REQUEST:     'UPDATE_REQUEST',
  CLOSE_REQUEST:      'CLOSE_REQUEST',

  // Appointments
  BOOK_APPOINTMENT:   'BOOK_APPOINTMENT',
  CONFIRM_APPOINTMENT:'CONFIRM_APPOINTMENT',
  COMPLETE_APPOINTMENT:'COMPLETE_APPOINTMENT',
  CANCEL_APPOINTMENT: 'CANCEL_APPOINTMENT',
  NO_SHOW_APPOINTMENT:'NO_SHOW_APPOINTMENT',

  // Admin
  ONBOARD_BLOOD_BANK: 'ONBOARD_BLOOD_BANK',
  ONBOARD_HOSPITAL:   'ONBOARD_HOSPITAL',
  VERIFY_USER:        'VERIFY_USER',
  DEACTIVATE_ENTITY:  'DEACTIVATE_ENTITY',
  ACTIVATE_ENTITY:    'ACTIVATE_ENTITY',

  // Seed (development only)
  SEED_DATABASE:      'SEED_DATABASE',
});

const AUDITABLE_COLLECTIONS = Object.freeze([
  'users',
  'bloodbanks',
  'hospitals',
  'bloodrequests',
  'appointments',
  'auditlogs',
]);

// ─── Schema ──────────────────────────────────────────────────────────────────

const auditLogSchema = new mongoose.Schema(
  {
    // The user who performed the action
    userId: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     'User',
      default: null, // null for system-level or anonymous actions
    },

    action: {
      type:     String,
      required: [true, 'Audit action is required.'],
      enum:     {
        values:  Object.values(AUDIT_ACTIONS),
        message: '{VALUE} is not a recognised audit action.',
      },
    },

    // Which MongoDB collection was affected
    targetCollection: {
      type:    String,
      enum:    {
        values:  AUDITABLE_COLLECTIONS,
        message: '{VALUE} is not an auditable collection.',
      },
      default: null,
    },

    // The _id of the document that was modified
    targetDocumentId: {
      type:    mongoose.Schema.Types.ObjectId,
      default: null,
    },

    // Snapshot of the relevant field(s) BEFORE the change (only for updates)
    previousValue: {
      type:    mongoose.Schema.Types.Mixed,
      default: null,
    },

    // Snapshot of the relevant field(s) AFTER the change
    newValue: {
      type:    mongoose.Schema.Types.Mixed,
      default: null,
    },

    // Requester's IP address — populated from req.ip in the controller
    ipAddress: {
      type:    String,
      trim:    true,
      default: null,
    },

    // Additional free-form context (e.g., user agent, notes)
    meta: {
      type:    mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    // Use 'timestamp' as a single field (not Mongoose's updatedAt — audit logs are immutable)
    timestamps: false,
    versionKey: false,
  }
);

// Manually set the timestamp on every document — immutable and explicit
auditLogSchema.add({
  timestamp: {
    type:    Date,
    default: Date.now,
    immutable: true, // Prevents accidental overwrites via save()
  },
});

// ─── Indexes ─────────────────────────────────────────────────────────────────

auditLogSchema.index({ userId:           1 });
auditLogSchema.index({ action:           1 });
auditLogSchema.index({ targetCollection: 1, targetDocumentId: 1 });
auditLogSchema.index({ timestamp:        -1 }); // Most recent first for log viewer

// TTL index: auto-delete logs older than 1 year (365 days) to prevent unbounded growth
auditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 365 });

// ─── Static Method ───────────────────────────────────────────────────────────

/**
 * Convenience static to create and save an audit log entry in one call.
 *
 * Usage:
 *   await AuditLog.record({
 *     userId:           req.user.id,
 *     action:           AUDIT_ACTIONS.UPDATE_INVENTORY,
 *     targetCollection: 'bloodbanks',
 *     targetDocumentId: bank._id,
 *     previousValue:    { B_negative: { units: 5 } },
 *     newValue:         { B_negative: { units: 1 } },
 *     ipAddress:        req.ip,
 *   });
 */
auditLogSchema.statics.record = async function (data) {
  try {
    return await this.create(data);
  } catch (err) {
    // Audit logging must NEVER crash the main request flow
    console.error('⚠️  AuditLog.record failed silently:', err.message);
    return null;
  }
};

// ─── Export ──────────────────────────────────────────────────────────────────

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

module.exports               = AuditLog;
module.exports.AUDIT_ACTIONS = AUDIT_ACTIONS;