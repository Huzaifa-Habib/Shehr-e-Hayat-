'use strict';

const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

// ─── Constants ──────────────────────────────────────────────────────────────

const ROLES = Object.freeze({
  SUPER_ADMIN:      'super_admin',
  BLOOD_BANK_ADMIN: 'blood_bank_admin',
  HOSPITAL_ADMIN:   'hospital_admin',
  DONOR:            'donor',
});

const BLOOD_TYPES = Object.freeze([
  'A_positive', 'A_negative',
  'B_positive', 'B_negative',
  'AB_positive','AB_negative',
  'O_positive', 'O_negative',
]);

const DONOR_COOLDOWN_MONTHS = 3; // Min gap between donations

// ─── Schema ─────────────────────────────────────────────────────────────────

const userSchema = new mongoose.Schema(
  {
    name: {
      type:      String,
      required:  [true, 'Full name is required.'],
      trim:      true,
      maxlength: [100, 'Name cannot exceed 100 characters.'],
    },

    email: {
      type:      String,
      required:  [true, 'Email is required.'],
      unique:    true,
      lowercase: true,
      trim:      true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        'Please provide a valid email address.',
      ],
    },

    phone: {
      type:     String,
      required: [true, 'Phone number is required.'],
      trim:     true,
      match: [
        /^\+92\d{10}$/,
        'Phone must be in Pakistani format: +92XXXXXXXXXX',
      ],
    },

    // NEVER store plain-text passwords. This field receives bcrypt output only.
    passwordHash: {
      type:     String,
      required: true,
      select:   false, // Excluded from all queries by default
    },

    role: {
      type:     String,
      required: true,
      enum:     {
        values:  Object.values(ROLES),
        message: '{VALUE} is not a valid role.',
      },
      default: ROLES.DONOR,
    },

    // Only meaningful for donors — blood type they carry
    bloodType: {
      type:    String,
      enum:    {
        values:  [...BLOOD_TYPES, null],
        message: '{VALUE} is not a recognised blood type.',
      },
      default: null,
    },

    // Points to a BloodBank _id (for blood_bank_admin) or Hospital _id (for hospital_admin)
    associatedEntityId: {
      type:    mongoose.Schema.Types.ObjectId,
      default: null,
    },

    // super_admin must manually verify bank/hospital admin accounts before they can log in
    isVerified: {
      type:    Boolean,
      default: false,
    },

    // Donor-only: tracks when last donation occurred for 3-month eligibility cooldown
    lastDonationDate: {
      type:    Date,
      default: null,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt automatically
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        delete ret.passwordHash; // Never leak the hash in API responses
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

// ─── Indexes ─────────────────────────────────────────────────────────────────

userSchema.index({ role:                1 });
userSchema.index({ associatedEntityId:  1 });
userSchema.index({ role: 1, isVerified: 1 }); // Super admin user-list queries

// ─── Virtuals ────────────────────────────────────────────────────────────────

/**
 * Whether this donor is eligible to donate again.
 * Returns true for non-donors too (field is irrelevant for them).
 */
userSchema.virtual('isEligibleToDonate').get(function () {
  if (this.role !== ROLES.DONOR)   return null;
  if (!this.lastDonationDate)       return true;
  const cutoff = new Date(this.lastDonationDate);
  cutoff.setMonth(cutoff.getMonth() + DONOR_COOLDOWN_MONTHS);
  return new Date() >= cutoff;
});

/**
 * Days remaining until donor is eligible again (null if already eligible or not a donor).
 */
userSchema.virtual('daysUntilEligible').get(function () {
  if (this.role !== ROLES.DONOR || !this.lastDonationDate) return null;
  const cutoff = new Date(this.lastDonationDate);
  cutoff.setMonth(cutoff.getMonth() + DONOR_COOLDOWN_MONTHS);
  const diff = cutoff - new Date();
  return diff > 0 ? Math.ceil(diff / (1000 * 60 * 60 * 24)) : 0;
});

// ─── Instance Methods ────────────────────────────────────────────────────────

/**
 * Verify a plain-text password against the stored hash.
 * Always use this — never compare the hash directly.
 */
userSchema.methods.comparePassword = async function (candidatePassword) {
  // passwordHash is selected: false — caller must query with .select('+passwordHash')
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

// ─── Static Methods ──────────────────────────────────────────────────────────

/**
 * Hash a plain-text password. Use this before creating or updating a user.
 * @param {string} plainText
 * @returns {Promise<string>} bcrypt hash
 */
userSchema.statics.hashPassword = async function (plainText) {
  return bcrypt.hash(plainText, 12);
};

// ─── Export ──────────────────────────────────────────────────────────────────

const User = mongoose.model('User', userSchema);

module.exports        = User;
module.exports.ROLES  = ROLES;
module.exports.BLOOD_TYPES = BLOOD_TYPES;