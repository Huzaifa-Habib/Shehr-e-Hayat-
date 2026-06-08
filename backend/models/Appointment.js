'use strict';

const mongoose   = require('mongoose');
const BLOOD_TYPES = require('./BloodBank').BLOOD_TYPES;

// ─── Constants ───────────────────────────────────────────────────────────────

const APPOINTMENT_STATUSES = Object.freeze({
  PENDING:   'Pending',
  CONFIRMED: 'Confirmed',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  NO_SHOW:   'No_Show',
});

// ─── Schema ──────────────────────────────────────────────────────────────────

const appointmentSchema = new mongoose.Schema(
  {
    donorId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: [true, 'Donor ID is required.'],
    },

    bloodBankId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'BloodBank',
      required: [true, 'Blood bank ID is required.'],
    },

    // Optional: appointment created in response to a specific hospital blood request
    requestId: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     'BloodRequest',
      default: null,
    },

    scheduledDate: {
      type:     Date,
      required: [true, 'Scheduled date is required.'],
      validate: {
        validator: function (v) {
          // Must be a future date for new pending or confirmed bookings
          if (this.isNew && (!this.status || ['Pending', 'Confirmed'].includes(this.status))) {
            return v > new Date();
          }
          return true;
        },
        message: 'Scheduled date must be in the future.',
      },
    },

    status: {
      type:    String,
      enum:    {
        values:  Object.values(APPOINTMENT_STATUSES),
        message: '{VALUE} is not a valid appointment status.',
      },
      default: APPOINTMENT_STATUSES.PENDING,
    },

    // Donor's blood type at the time of booking (denormalized for quick reference)
    bloodType: {
      type:     String,
      required: [true, 'Blood type is required for an appointment.'],
      enum:     {
        values:  BLOOD_TYPES,
        message: '{VALUE} is not a recognised blood type.',
      },
    },

    // Free-text notes from the donor (e.g., first time, health notes)
    notes: {
      type:      String,
      trim:      true,
      maxlength: [500, 'Notes cannot exceed 500 characters.'],
      default:   null,
    },

    // The blood_bank_admin who confirmed / completed / marked this appointment
    confirmedBy: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     'User',
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON:    { virtuals: true },
    toObject:  { virtuals: true },
  }
);

// ─── Indexes ─────────────────────────────────────────────────────────────────

appointmentSchema.index({ donorId:     1 });
appointmentSchema.index({ bloodBankId: 1 });
appointmentSchema.index({ status:      1 });
appointmentSchema.index({ scheduledDate: 1 });
appointmentSchema.index({ bloodBankId: 1, status: 1, scheduledDate: 1 }); // Bank admin dashboard query

// ─── Virtuals ────────────────────────────────────────────────────────────────

/**
 * Whether this appointment is still in a cancellable state (Pending or Confirmed).
 */
appointmentSchema.virtual('isCancellable').get(function () {
  return [APPOINTMENT_STATUSES.PENDING, APPOINTMENT_STATUSES.CONFIRMED].includes(this.status);
});

// ─── Export ──────────────────────────────────────────────────────────────────

const Appointment = mongoose.model('Appointment', appointmentSchema);

module.exports                      = Appointment;
module.exports.APPOINTMENT_STATUSES = APPOINTMENT_STATUSES;