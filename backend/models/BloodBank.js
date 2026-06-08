'use strict';

const mongoose = require('mongoose');

// ─── Sub-schema: per-blood-type inventory entry ──────────────────────────────

const inventoryEntrySchema = new mongoose.Schema(
  {
    units: {
      type:    Number,
      required: true,
      min:     [0, 'Units cannot be negative.'],
      max:     [9999, 'Units cannot exceed 9999.'],
      default: 0,
    },
    lastUpdated: {
      type:    Date,
      default: Date.now,
    },
  },
  { _id: false } // Embedded — no separate ObjectId needed
);

// ─── Blood types accepted by the system ──────────────────────────────────────

const BLOOD_TYPES = [
  'A_positive', 'A_negative',
  'B_positive', 'B_negative',
  'AB_positive','AB_negative',
  'O_positive', 'O_negative',
];

// Build the inventory object definition dynamically to keep the schema DRY
const inventoryDefinition = {};
BLOOD_TYPES.forEach((bt) => {
  inventoryDefinition[bt] = {
    type:    inventoryEntrySchema,
    default: () => ({ units: 0, lastUpdated: new Date() }),
  };
});

// ─── Main schema ─────────────────────────────────────────────────────────────

const bloodBankSchema = new mongoose.Schema(
  {
    name: {
      type:     String,
      required: [true, 'Blood bank name is required.'],
      trim:     true,
      maxlength: [150, 'Name cannot exceed 150 characters.'],
    },

    // Optional branch identifier — e.g., "Korangi", "Model Colony"
    branch: {
      type:    String,
      trim:    true,
      default: null,
    },

    // Neighborhood/Region identifier for location-based filtering
    neighborhood: {
      type:    String,
      trim:    true,
      default: null,
    },

    address: {
      type:     String,
      required: [true, 'Address is required.'],
      trim:     true,
    },

    // GeoJSON Point: coordinates = [longitude, latitude]
    // ⚠️  Order matters: GeoJSON and MongoDB use [lng, lat], NOT [lat, lng]
    location: {
      type: {
        type:    String,
        enum:    ['Point'],
        required: true,
        default: 'Point',
      },
      coordinates: {
        type:     [Number],
        required: [true, 'Coordinates [lng, lat] are required.'],
        validate: {
          validator: (coords) =>
            Array.isArray(coords) &&
            coords.length === 2 &&
            coords[0] >= -180 && coords[0] <= 180 && // longitude
            coords[1] >= -90  && coords[1] <= 90,    // latitude
          message: 'coordinates must be [longitude, latitude] in valid ranges.',
        },
      },
    },

    contact: {
      type:     String,
      required: [true, 'Contact number is required.'],
      trim:     true,
    },

    operatingHours: {
      type:    String,
      trim:    true,
      default: '24/7',
    },

    isActive: {
      type:    Boolean,
      default: true,
    },

    // Embedded inventory — all 8 blood types
    inventory: inventoryDefinition,

    // Units below this count trigger a "critical" alert shown publicly
    alertThreshold: {
      type:    Number,
      default: 10,
      min:     [0, 'Alert threshold cannot be negative.'],
    },
  },
  {
    timestamps: true,
    toJSON:    { virtuals: true },
    toObject:  { virtuals: true },
  }
);

// ─── Indexes ─────────────────────────────────────────────────────────────────

// Required for $near, $geoWithin, and $geoIntersects queries
bloodBankSchema.index({ location: '2dsphere' });
bloodBankSchema.index({ isActive: 1 });
bloodBankSchema.index({ name:     1 });

// ─── Virtuals ────────────────────────────────────────────────────────────────

/**
 * Returns an array of blood types currently at or below the alert threshold.
 * Used by GET /api/blood/critical
 */
bloodBankSchema.virtual('criticalTypes').get(function () {
  if (!this.inventory) return [];
  return BLOOD_TYPES.filter(
    (bt) => this.inventory[bt] && this.inventory[bt].units <= this.alertThreshold
  );
});

/**
 * Total units across all blood types combined — useful for dashboard stats.
 */
bloodBankSchema.virtual('totalUnits').get(function () {
  if (!this.inventory) return 0;
  return BLOOD_TYPES.reduce(
    (sum, bt) => sum + (this.inventory[bt] ? this.inventory[bt].units : 0),
    0
  );
});

/**
 * Whether ANY blood type is critically low.
 */
bloodBankSchema.virtual('hasCriticalShortage').get(function () {
  return this.criticalTypes && this.criticalTypes.length > 0;
});

// ─── Instance Methods ────────────────────────────────────────────────────────

/**
 * Update a single blood type's unit count and refresh its lastUpdated timestamp.
 * @param {string} bloodType  — e.g., 'B_negative'
 * @param {number} units      — new absolute unit count
 * @returns {Promise<BloodBank>}
 */
bloodBankSchema.methods.updateInventoryEntry = function (bloodType, units) {
  if (!BLOOD_TYPES.includes(bloodType)) {
    throw new Error(`Invalid blood type: ${bloodType}`);
  }
  this.inventory[bloodType].units       = units;
  this.inventory[bloodType].lastUpdated = new Date();
  return this.save();
};

// ─── Export ──────────────────────────────────────────────────────────────────

const BloodBank = mongoose.model('BloodBank', bloodBankSchema);

module.exports             = BloodBank;
module.exports.BLOOD_TYPES = BLOOD_TYPES;