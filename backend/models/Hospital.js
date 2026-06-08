'use strict';

const mongoose = require('mongoose');

// ─── Schema ──────────────────────────────────────────────────────────────────

const hospitalSchema = new mongoose.Schema(
  {
    name: {
      type:      String,
      required:  [true, 'Hospital name is required.'],
      trim:      true,
      maxlength: [150, 'Name cannot exceed 150 characters.'],
    },

    // Short identifier used in UI labels — e.g., "CHK", "JPMC", "LNH"
    shortCode: {
      type:      String,
      required:  [true, 'Short code is required.'],
      trim:      true,
      uppercase: true,
      maxlength: [10, 'Short code cannot exceed 10 characters.'],
      unique:    true,
    },

    address: {
      type:     String,
      required: [true, 'Address is required.'],
      trim:     true,
    },

    // GeoJSON Point: coordinates = [longitude, latitude]
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
            coords[0] >= -180 && coords[0] <= 180 &&
            coords[1] >= -90  && coords[1] <= 90,
          message: 'coordinates must be [longitude, latitude] in valid ranges.',
        },
      },
    },

    contact: {
      type:     String,
      required: [true, 'Contact number is required.'],
      trim:     true,
    },

    // Whether this is a public government hospital (relevant for UI display)
    isGovernment: {
      type:    Boolean,
      default: false,
    },

    isActive: {
      type:    Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON:   { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Indexes ─────────────────────────────────────────────────────────────────

hospitalSchema.index({ location: '2dsphere' });
hospitalSchema.index({ isActive: 1 });

// ─── Export ──────────────────────────────────────────────────────────────────

const Hospital = mongoose.model('Hospital', hospitalSchema);

module.exports = Hospital;