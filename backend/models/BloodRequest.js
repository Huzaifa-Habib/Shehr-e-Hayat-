'use strict';

const mongoose   = require('mongoose');
const BLOOD_TYPES = require('./BloodBank').BLOOD_TYPES;

// ─── Constants ───────────────────────────────────────────────────────────────

const URGENCY_LEVELS = Object.freeze({
  NORMAL:   'Normal',
  URGENT:   'Urgent',
  CRITICAL: 'Critical',
});

const REQUEST_STATUSES = Object.freeze({
  OPEN:                'Open',
  PARTIALLY_FULFILLED: 'Partially_Fulfilled',
  CLOSED:              'Closed',
  EXPIRED:             'Expired',
});

const CASE_TYPES = Object.freeze([
  'Accident',
  'Surgery',
  'Thalassemia',
  'Cancer',
  'Kidney_Disease',
  'Childbirth',
  'Other',
]);

// Auto-expire requests after this many hours if not manually closed
const DEFAULT_EXPIRY_HOURS = 48;

// ─── Schema ──────────────────────────────────────────────────────────────────
const bloodRequestSchema = new mongoose.Schema(
  {
    hospitalId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'Hospital',
      required: [true, 'Hospital ID is required.'],
    },
    postedBy: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: [true, 'Posted-by user ID is required.'],
    },
    patientInfo: {
      wardOrDept: {
        type:    String,
        trim:    true,
        default: null,
      },
      caseType: {
        type:    String,
        enum:    {
          values:  CASE_TYPES,
          message: '{VALUE} is not a valid case type.',
        },
        required: [true, 'Case type is required.'],
      },
    },
    bloodTypeRequired: {
      type:     String,
      required: [true, 'Blood type is required.'],
      enum:     {
        values:  BLOOD_TYPES,
        message: '{VALUE} is not a recognised blood type.',
      },
    },
    unitsRequested: {
      type:     Number,
      required: [true, 'Units requested is required.'],
      min:      [1, 'Must request at least 1 unit.'],
      max:      [50, 'Cannot request more than 50 units per request.'],
    },
    unitsFulfilled: {
      type:    Number,
      default: 0,
      min:     [0, 'Units fulfilled cannot be negative.'],
    },

    urgency: {
      type:     String,
      required: [true, 'Urgency level is required.'],
      enum:     {
        values:  Object.values(URGENCY_LEVELS),
        message: '{VALUE} is not a valid urgency level.',
      },
      default: URGENCY_LEVELS.NORMAL,
    },

    status: {
      type:    String,
      enum:    {
        values:  Object.values(REQUEST_STATUSES),
        message: '{VALUE} is not a valid status.',
      },
      default: REQUEST_STATUSES.OPEN,
    },

    // Auto-set to 48 hours after creation if not provided
    expiresAt: {
      type:     Date,
      required: true,
      default:  () => new Date(Date.now() + DEFAULT_EXPIRY_HOURS * 60 * 60 * 1000),
    },
  },
  {
    timestamps: true,
    toJSON:    { virtuals: true },
    toObject:  { virtuals: true },
  }
);

// ─── Pre-save Hook ───────────────────────────────────────────────────────────

// Auto-set expiresAt on new documents if not supplied
bloodRequestSchema.pre('save', function (next) {
  if (this.isNew && !this.expiresAt) {
    this.expiresAt = new Date(Date.now() + DEFAULT_EXPIRY_HOURS * 60 * 60 * 1000);
  }

  // Auto-update status based on fulfillment
  if (this.unitsFulfilled >= this.unitsRequested) {
    this.status = REQUEST_STATUSES.CLOSED;
  } else if (this.unitsFulfilled > 0) {
    this.status = REQUEST_STATUSES.PARTIALLY_FULFILLED;
  }

  next();
});

// ─── Indexes ─────────────────────────────────────────────────────────────────

bloodRequestSchema.index({ status: 1 });
bloodRequestSchema.index({ hospitalId: 1 });
bloodRequestSchema.index({ bloodTypeRequired: 1 });
bloodRequestSchema.index({ urgency: 1, status: 1 }); // Dashboard: critical open requests
bloodRequestSchema.index({ expiresAt: 1 });          // TTL-style cleanup queries

// ─── Virtuals ────────────────────────────────────────────────────────────────

/**
 * Units still needed to fulfil the request.
 */
bloodRequestSchema.virtual('unitsStillNeeded').get(function () {
  return Math.max(0, this.unitsRequested - this.unitsFulfilled);
});

/**
 * Whether this request has passed its expiry date and should be considered expired.
 */
bloodRequestSchema.virtual('isExpired').get(function () {
  return this.expiresAt && new Date() > this.expiresAt && this.status === REQUEST_STATUSES.OPEN;
});

/**
 * Fulfilment percentage (0–100).
 */
bloodRequestSchema.virtual('fulfilmentPercent').get(function () {
  if (!this.unitsRequested) return 0;
  return Math.round((this.unitsFulfilled / this.unitsRequested) * 100);
});

// ─── Export ──────────────────────────────────────────────────────────────────

const BloodRequest = mongoose.model('BloodRequest', bloodRequestSchema);

module.exports                   = BloodRequest;
module.exports.URGENCY_LEVELS    = URGENCY_LEVELS;
module.exports.REQUEST_STATUSES  = REQUEST_STATUSES;
module.exports.CASE_TYPES        = CASE_TYPES;
