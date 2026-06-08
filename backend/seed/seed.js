/**
 * seed.js — Karachi Blood Bank Portal Database Seeder
 *
 * Usage:
 *   node seed/seed.js            # Seeds the database (drops all existing data first)
 *   node seed/seed.js --fresh    # Alias for above; explicit drop + reseed
 *
 * Prerequisites:
 *   1. Copy .env.example to .env and fill in MONGODB_URI and SEED_DEFAULT_PASSWORD
 *   2. npm install
 *
 * Default password for ALL seeded accounts: $SEED_DEFAULT_PASSWORD (from .env)
 * ─────────────────────────────────────────────────────────────────────────────
 * Seeded counts:
 *   • 12 Blood Banks (spread across Karachi with realistic GPS)
 *   • 8  Hospitals
 *   • 1  Super Admin
 *   • 12 Blood Bank Admins (one per bank)
 *   • 8  Hospital Admins   (one per hospital)
 *   • 8  Donors            (varied blood types)
 *   • 4  Blood Requests    (varied urgency, 3 open, 1 partially fulfilled)
 *   • 5  Appointments      (varied statuses)
 *   • 1  Audit Log entry   (seed event)
 */

'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const mongoose   = require('mongoose');
const bcrypt     = require('bcryptjs');
const connectDB  = require('../config/db');

// Models
const User        = require('../models/User');
const BloodBank   = require('../models/BloodBank');
const Hospital    = require('../models/Hospital');
const BloodRequest= require('../models/BloodRequest');
const Appointment = require('../models/Appointment');
const AuditLog    = require('../models/AuditLog');

const { ROLES }              = User;
const { URGENCY_LEVELS, REQUEST_STATUSES, CASE_TYPES } = BloodRequest;
const { APPOINTMENT_STATUSES } = Appointment;
const { AUDIT_ACTIONS }      = AuditLog;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Build a fully-formed inventory object from a plain units map.
 * Any blood type not supplied defaults to 0 units.
 */
const BLOOD_TYPES = [
  'A_positive', 'A_negative',
  'B_positive', 'B_negative',
  'AB_positive','AB_negative',
  'O_positive', 'O_negative',
];

const makeInventory = (units = {}) => {
  const inv = {};
  BLOOD_TYPES.forEach((bt) => {
    inv[bt] = { units: units[bt] ?? 0, lastUpdated: new Date() };
  });
  return inv;
};

/**
 * Return a Date `daysFromNow` days in the future.
 */
const daysFromNow = (n) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);

/**
 * Return a Date `daysAgo` days in the past.
 */
const daysAgo = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

// ─── Clear all collections ───────────────────────────────────────────────────

const dropAll = async () => {
  const collections = ['users', 'bloodbanks', 'hospitals', 'bloodrequests', 'appointments', 'auditlogs'];
  for (const col of collections) {
    try {
      await mongoose.connection.dropCollection(col);
      console.log(`   🗑️  Dropped: ${col}`);
    } catch (err) {
      if (err.code === 26) {
        console.log(`   ⬜  Skipped (not found): ${col}`);
      } else {
        throw err;
      }
    }
  }
};

// ─── Blood Bank Data ─────────────────────────────────────────────────────────
// ⚠️  GeoJSON coordinates = [longitude, latitude] — NOT [lat, lng]
// ⚠️  Inventory: units below alertThreshold (10) will appear as "critical" on the public dashboard

const bloodBankData = [
  {
    name:           'Indus Hospital Blood Bank',
    branch:         'Korangi',
    neighborhood:   'Korangi',
    address:        'Plot C-76, Sector 31/5, Korangi Industrial Area, Karachi',
    location:       { type: 'Point', coordinates: [67.1232, 24.8294] },
    contact:        '+922135477710',
    operatingHours: '24/7',
    alertThreshold: 10,
    inventory: makeInventory({
      A_positive: 48, A_negative: 8,
      B_positive: 32, B_negative: 3,   // ⚠️ Critical
      AB_positive:22, AB_negative: 1,  // ⚠️ Critical
      O_positive: 65, O_negative: 6,   // ⚠️ Critical
    }),
  },
  {
    name:           'Indus Hospital Blood Bank',
    branch:         'Model Colony',
    neighborhood:   'Model Colony',
    address:        'Sector A, Model Colony, Karachi',
    location:       { type: 'Point', coordinates: [67.1600, 24.8800] },
    contact:        '+922134660000',
    operatingHours: '08:00–22:00',
    alertThreshold: 10,
    inventory: makeInventory({
      A_positive: 35, A_negative: 5,
      B_positive: 28, B_negative: 2,   // ⚠️ Critical
      AB_positive:15, AB_negative: 0,  // ⚠️ Out of stock
      O_positive: 52, O_negative: 4,   // ⚠️ Critical
    }),
  },
  {
    name:           'Fatimid Foundation Blood Bank',
    branch:         'Gulshan-e-Iqbal',
    neighborhood:   'Gulshan',
    address:        'Block 6, Gulshan-e-Iqbal, Karachi',
    location:       { type: 'Point', coordinates: [67.1050, 24.9150] },
    contact:        '+922134970770',
    operatingHours: '24/7',
    alertThreshold: 10,
    inventory: makeInventory({
      A_positive: 41, A_negative: 6,
      B_positive: 38, B_negative: 4,   // ⚠️ Critical
      AB_positive:20, AB_negative: 2,  // ⚠️ Critical
      O_positive: 59, O_negative: 7,   // ⚠️ Critical
    }),
  },
  {
    name:           'Fatimid Foundation Blood Bank',
    branch:         'North Nazimabad',
    neighborhood:   'Nazimabad',
    address:        'Block L, North Nazimabad, Karachi',
    location:       { type: 'Point', coordinates: [67.0340, 24.9407] },
    contact:        '+922136636300',
    operatingHours: '24/7',
    alertThreshold: 10,
    inventory: makeInventory({
      A_positive: 30, A_negative: 4,
      B_positive: 25, B_negative: 1,   // ⚠️ Critical
      AB_positive:12, AB_negative: 0,  // ⚠️ Out of stock
      O_positive: 44, O_negative: 3,   // ⚠️ Critical
    }),
  },
  {
    name:           'Chhipa Welfare Blood Bank',
    branch:         'Saddar',
    neighborhood:   'Saddar',
    address:        'M.A. Jinnah Road, Saddar, Karachi',
    location:       { type: 'Point', coordinates: [67.0100, 24.8600] },
    contact:        '+922135654080',
    operatingHours: '07:00–23:00',
    alertThreshold: 10,
    inventory: makeInventory({
      A_positive: 22, A_negative: 3,
      B_positive: 18, B_negative: 2,   // ⚠️ Critical
      AB_positive: 8, AB_negative: 0,  // ⚠️ Critical (below threshold) & Out of stock
      O_positive: 31, O_negative: 2,   // ⚠️ Critical
    }),
  },
  {
    name:           'Edhi Foundation Blood Bank',
    branch:         'Korangi',
    neighborhood:   'Korangi',
    address:        'Edhi Village, Korangi, Karachi',
    location:       { type: 'Point', coordinates: [67.1300, 24.8350] },
    contact:        '+922135071501',
    operatingHours: '24/7',
    alertThreshold: 10,
    inventory: makeInventory({
      A_positive: 15, A_negative: 2,
      B_positive: 12, B_negative: 1,   // ⚠️ Critical
      AB_positive: 5, AB_negative: 0,  // ⚠️ Critical & Out of stock
      O_positive: 23, O_negative: 1,   // ⚠️ Critical
    }),
  },
  {
    name:           'SIUT Blood Bank',
    branch:         'Gulshan',
    neighborhood:   'Gulshan',
    address:        'Deh Seragi, University Road, Karachi',
    location:       { type: 'Point', coordinates: [67.0900, 24.9100] },
    contact:        '+922199251930',
    operatingHours: '24/7',
    alertThreshold: 10,
    inventory: makeInventory({
      A_positive: 27, A_negative: 5,
      B_positive: 22, B_negative: 3,   // ⚠️ Critical
      AB_positive:14, AB_negative: 1,  // ⚠️ Critical
      O_positive: 71, O_negative: 5,   // ⚠️ Critical (kidney patients drive high O+ demand)
    }),
  },
  {
    name:           'Aga Khan University Hospital Blood Bank',
    branch:         'Stadium Road',
    neighborhood:   'DHA',
    address:        'Stadium Road, Karachi 74800',
    location:       { type: 'Point', coordinates: [67.0818, 24.8952] },
    contact:        '+922134930051',
    operatingHours: '24/7',
    alertThreshold: 10,
    inventory: makeInventory({
      A_positive: 55, A_negative: 12,
      B_positive: 40, B_negative: 8,   // ⚠️ Critical (highest B- in city, still critical)
      AB_positive:28, AB_negative: 3,  // ⚠️ Critical (best AB- in city, still critical)
      O_positive: 68, O_negative: 9,   // ⚠️ Critical (highest O- in city, still critical)
    }),
  },
  {
    name:           'Ziauddin Hospital Blood Bank',
    branch:         'North Nazimabad',
    neighborhood:   'Nazimabad',
    address:        'Block B, North Nazimabad, Karachi',
    location:       { type: 'Point', coordinates: [67.0500, 24.9490] },
    contact:        '+922136616000',
    operatingHours: '24/7',
    alertThreshold: 10,
    inventory: makeInventory({
      A_positive: 33, A_negative: 4,
      B_positive: 27, B_negative: 2,   // ⚠️ Critical
      AB_positive:16, AB_negative: 1,  // ⚠️ Critical
      O_positive: 48, O_negative: 4,   // ⚠️ Critical
    }),
  },
  {
    name:           'Liaquat National Blood Bank',
    branch:         'Gulshan',
    neighborhood:   'Gulshan',
    address:        'National Stadium Road, Karachi',
    location:       { type: 'Point', coordinates: [67.0880, 24.9120] },
    contact:        '+922234930000',
    operatingHours: '24/7',
    alertThreshold: 10,
    inventory: makeInventory({
      A_positive: 38, A_negative: 6,
      B_positive: 30, B_negative: 3,   // ⚠️ Critical
      AB_positive:19, AB_negative: 1,  // ⚠️ Critical
      O_positive: 55, O_negative: 6,   // ⚠️ Critical
    }),
  },
  {
    name:           'Patel Hospital Blood Bank',
    branch:         'Kardar',
    neighborhood:   'Saddar',
    address:        'Ramdas Street, Soldier Bazaar, Karachi',
    location:       { type: 'Point', coordinates: [67.0200, 24.8570] },
    contact:        '+922132560911',
    operatingHours: '08:00–20:00',
    alertThreshold: 10,
    inventory: makeInventory({
      A_positive: 14, A_negative: 2,
      B_positive: 10, B_negative: 0,   // ⚠️ Critical & Out of stock
      AB_positive: 6, AB_negative: 0,  // ⚠️ Critical & Out of stock
      O_positive: 19, O_negative: 1,   // ⚠️ Critical
    }),
  },
  {
    name:           'National Institute of Blood Diseases Blood Bank',
    branch:         'Karachi University',
    neighborhood:   'Gulshan',
    address:        'Karachi University Campus, Gulshan-e-Iqbal, Karachi',
    location:       { type: 'Point', coordinates: [67.1100, 24.9310] },
    contact:        '+922199261606',
    operatingHours: '08:00–22:00',
    alertThreshold: 10,
    inventory: makeInventory({
      A_positive: 25, A_negative: 5,
      B_positive: 20, B_negative: 2,   // ⚠️ Critical
      AB_positive:13, AB_negative: 1,  // ⚠️ Critical
      O_positive: 35, O_negative: 3,   // ⚠️ Critical
    }),
  },
];

// ─── Hospital Data ────────────────────────────────────────────────────────────

const hospitalData = [
  {
    name:         'Civil Hospital Karachi',
    shortCode:    'CHK',
    address:      'Baba-e-Urdu Road, Saddar, Karachi',
    location:     { type: 'Point', coordinates: [67.0209, 24.8553] },
    contact:      '+922199215740',
    isGovernment: true,
  },
  {
    name:         'Jinnah Postgraduate Medical Centre',
    shortCode:    'JPMC',
    address:      'Rafiqui Shaheed Road, Karachi',
    location:     { type: 'Point', coordinates: [67.0309, 24.8706] },
    contact:      '+922199201730',
    isGovernment: true,
  },
  {
    name:         'Liaquat National Hospital',
    shortCode:    'LNH',
    address:      'National Stadium Road, Gulshan, Karachi',
    location:     { type: 'Point', coordinates: [67.0872, 24.9134] },
    contact:      '+922234930051',
    isGovernment: false,
  },
  {
    name:         'Abbasi Shaheed Hospital',
    shortCode:    'ASH',
    address:      'M.A. Jinnah Road, Nazimabad, Karachi',
    location:     { type: 'Point', coordinates: [67.0301, 24.9197] },
    contact:      '+922132775011',
    isGovernment: true,
  },
  {
    name:         'Aga Khan University Hospital',
    shortCode:    'AKUH',
    address:      'Stadium Road, Karachi 74800',
    location:     { type: 'Point', coordinates: [67.0818, 24.8952] },
    contact:      '+922134930051',
    isGovernment: false,
  },
  {
    name:         'South City Hospital',
    shortCode:    'SCH',
    address:      'Soldier Bazaar, Karachi',
    location:     { type: 'Point', coordinates: [67.0143, 24.8579] },
    contact:      '+922132560914',
    isGovernment: false,
  },
  {
    name:         'Ziauddin Hospital',
    shortCode:    'ZH',
    address:      'Block B, North Nazimabad, Karachi',
    location:     { type: 'Point', coordinates: [67.0500, 24.9490] },
    contact:      '+922136616000',
    isGovernment: false,
  },
  {
    name:         'National Medical Centre',
    shortCode:    'NMC',
    address:      'Gulshan-e-Iqbal, Karachi',
    location:     { type: 'Point', coordinates: [67.0921, 24.9002] },
    contact:      '+922134825231',
    isGovernment: false,
  },
];

// ─── Main seed function ───────────────────────────────────────────────────────

const seed = async () => {
  console.log('\n🩸  Karachi Blood Bank Portal — Database Seeder');
  console.log('━'.repeat(55));

  // ── Connect ──────────────────────────────────────────────
  await connectDB();
  console.log('\n📦  Step 1/9 — Dropping existing collections...');
  await dropAll();

  // ── Hash passwords ───────────────────────────────────────
  console.log('\n🔐  Step 2/9 — Hashing passwords...');
  const defaultPassword = process.env.SEED_DEFAULT_PASSWORD || 'Karachi@1234';
  const passwordHash    = await bcrypt.hash(defaultPassword, 12);
  console.log(`   ✅  Using password: ${defaultPassword}`);

  // ── Blood Banks ──────────────────────────────────────────
  console.log('\n🏥  Step 3/9 — Seeding blood banks...');
  const banks = await BloodBank.insertMany(bloodBankData);
  banks.forEach((b) => console.log(`   ✅  ${b.name}${b.branch ? ` (${b.branch})` : ''}`));

  // ── Hospitals ────────────────────────────────────────────
  console.log('\n🏨  Step 4/9 — Seeding hospitals...');
  const hospitals = await Hospital.insertMany(hospitalData);
  hospitals.forEach((h) => console.log(`   ✅  [${h.shortCode}] ${h.name}`));

  // ── Super Admin ──────────────────────────────────────────
  console.log('\n👑  Step 5/9 — Seeding super admin...');
  const [superAdmin] = await User.create([
    {
      name:         'Portal Super Admin',
      email:        'admin@bloodbank.karachi',
      phone:        '+923001110000',
      passwordHash,
      role:         ROLES.SUPER_ADMIN,
      isVerified:   true,
    },
  ]);
  console.log(`   ✅  ${superAdmin.email} (super_admin)`);

  // ── Blood Bank Admins ────────────────────────────────────
  console.log('\n🩺  Step 6/9 — Seeding blood bank admins...');
  const bankAdminData = [
    { name: 'Ahmed Raza',      email: 'admin@induskorangi.org',    phone: '+923011110001', bank: banks[0]  },
    { name: 'Sara Khan',       email: 'admin@indus-model.pk',     phone: '+923011110002', bank: banks[1]  },
    { name: 'Imran Malik',     email: 'admin@fatimid-gulshan.pk', phone: '+923011110003', bank: banks[2]  },
    { name: 'Nadia Siddiqui', email: 'admin@fatimid-northnaz.pk',phone: '+923011110004', bank: banks[3]  },
    { name: 'Tariq Hussain',  email: 'admin@chhipa-saddar.pk',   phone: '+923011110005', bank: banks[4]  },
    { name: 'Rukhsana Bibi',  email: 'admin@edhi-korangi.pk',    phone: '+923011110006', bank: banks[5]  },
    { name: 'Faisal Qureshi', email: 'admin@siut-gulshan.pk',    phone: '+923011110007', bank: banks[6]  },
    { name: 'Amna Baig',      email: 'admin@akuh.pk',            phone: '+923011110008', bank: banks[7]  },
    { name: 'Shahid Mehmood', email: 'admin@ziauddin.pk',        phone: '+923011110009', bank: banks[8]  },
    { name: 'Zainab Rizvi',   email: 'admin@lnh.pk',             phone: '+923011110010', bank: banks[9]  },
    { name: 'Kamran Javed',   email: 'admin@patel.pk',           phone: '+923011110011', bank: banks[10] },
    { name: 'Farah Akhtar',   email: 'admin@nibd.pk',            phone: '+923011110012', bank: banks[11] },
  ];

  const bankAdmins = await User.insertMany(
    bankAdminData.map(({ name, email, phone, bank }) => ({
      name,
      email,
      phone,
      passwordHash,
      role:               ROLES.BLOOD_BANK_ADMIN,
      associatedEntityId: bank._id,
      isVerified:         true,
    }))
  );
  bankAdmins.forEach((u, i) =>
    console.log(`   ✅  ${u.email} → ${bankAdminData[i].bank.name} (${bankAdminData[i].bank.branch || 'main'})`)
  );

  // ── Hospital Admins ──────────────────────────────────────
  console.log('\n🏨  Step 7/9 — Seeding hospital admins...');
  const hospitalAdminData = [
    { name: 'Dr. Waseem Ali',     email: 'admin@civilhospital.gov.pk', phone: '+923021110001', hospital: hospitals[0] },
    { name: 'Dr. Rabia Noor',     email: 'admin@jpmc.pk',         phone: '+923021110002', hospital: hospitals[1] },
    { name: 'Dr. Shahbaz Hassan', email: 'admin@lnh-hosp.pk',     phone: '+923021110003', hospital: hospitals[2] },
    { name: 'Dr. Irum Fatima',    email: 'admin@ash.pk',          phone: '+923021110004', hospital: hospitals[3] },
    { name: 'Dr. Salman Sheikh',  email: 'admin@akuh-hosp.pk',    phone: '+923021110005', hospital: hospitals[4] },
    { name: 'Dr. Asma Tahir',     email: 'admin@southcity.pk',    phone: '+923021110006', hospital: hospitals[5] },
    { name: 'Dr. Omer Farooq',    email: 'admin@ziauddin-hosp.pk',phone: '+923021110007', hospital: hospitals[6] },
    { name: 'Dr. Hira Zafar',     email: 'admin@nmc.pk',          phone: '+923021110008', hospital: hospitals[7] },
  ];

  const hospitalAdmins = await User.insertMany(
    hospitalAdminData.map(({ name, email, phone, hospital }) => ({
      name,
      email,
      phone,
      passwordHash,
      role:               ROLES.HOSPITAL_ADMIN,
      associatedEntityId: hospital._id,
      isVerified:         true,
    }))
  );
  hospitalAdmins.forEach((u, i) =>
    console.log(`   ✅  ${u.email} → [${hospitalAdminData[i].hospital.shortCode}] ${hospitalAdminData[i].hospital.name}`)
  );

  // ── Donors ───────────────────────────────────────────────
  console.log('\n🩸  Step 8/9 — Seeding donors...');
  const donorData = [
    { name: 'Ahmed Raza',     email: 'ahmed.raza@gmail.com',     phone: '+923331110001', bloodType: 'O_positive',  lastDonationDate: daysAgo(120) }, // Eligible
    { name: 'Fatima Malik',   email: 'fatima.malik@gmail.com',   phone: '+923331110002', bloodType: 'B_negative',  lastDonationDate: null         }, // Eligible (never donated)
    { name: 'Bilal Hassan',   email: 'bilal.hassan@gmail.com',   phone: '+923331110003', bloodType: 'A_positive',  lastDonationDate: daysAgo(95)  }, // Eligible
    { name: 'Zara Siddiqui',  email: 'zara.siddiqui@gmail.com',  phone: '+923331110004', bloodType: 'AB_positive', lastDonationDate: daysAgo(45)  }, // NOT eligible (donated 45 days ago)
    { name: 'Usman Tariq',    email: 'usman.tariq@gmail.com',    phone: '+923331110005', bloodType: 'O_negative',  lastDonationDate: null         }, // Eligible (never donated)
    { name: 'Hina Baig',      email: 'hina.baig@gmail.com',      phone: '+923331110006', bloodType: 'B_positive',  lastDonationDate: daysAgo(150) }, // Eligible
    { name: 'Kamran Akhtar',  email: 'kamran.akhtar@gmail.com',  phone: '+923331110007', bloodType: 'A_negative',  lastDonationDate: daysAgo(60)  }, // NOT eligible
    { name: 'Saima Rizvi',    email: 'saima.rizvi@gmail.com',    phone: '+923331110008', bloodType: 'AB_negative', lastDonationDate: null         }, // Eligible (never donated)
  ];

  const donors = await User.insertMany(
    donorData.map(({ name, email, phone, bloodType, lastDonationDate }) => ({
      name,
      email,
      phone,
      passwordHash,
      role:             ROLES.DONOR,
      bloodType,
      lastDonationDate,
      isVerified:       true,
    }))
  );
  donors.forEach((d, i) =>
    console.log(
      `   ✅  ${d.name} (${donorData[i].bloodType}) — ` +
      `${donorData[i].lastDonationDate ? `last donated ${Math.round((Date.now() - donorData[i].lastDonationDate) / 86400000)} days ago` : 'never donated'}`
    )
  );

  // ── Blood Requests ───────────────────────────────────────
  console.log('\n🚨  Step 9/9 — Seeding blood requests, appointments, and audit log...');

  // Request 1: Critical O- shortage at Abbasi Shaheed (ICU trauma)
  const req1 = await BloodRequest.create({
    hospitalId:        hospitals[3]._id,         // Abbasi Shaheed (ASH)
    postedBy:          hospitalAdmins[3]._id,     // Dr. Irum Fatima
    patientInfo:       { wardOrDept: 'ICU', caseType: CASE_TYPES[0] }, // Accident
    bloodTypeRequired: 'O_negative',
    unitsRequested:    6,
    unitsFulfilled:    0,
    urgency:           URGENCY_LEVELS.CRITICAL,
    status:            REQUEST_STATUSES.OPEN,
    expiresAt:         daysFromNow(2),
  });
  console.log(`   🚨  [CRITICAL] O- × 6 — Abbasi Shaheed ICU (${req1.status})`);

  // Request 2: Critical B- at JPMC (accident victim)
  const req2 = await BloodRequest.create({
    hospitalId:        hospitals[1]._id,          // JPMC
    postedBy:          hospitalAdmins[1]._id,      // Dr. Rabia Noor
    patientInfo:       { wardOrDept: 'Emergency', caseType: CASE_TYPES[0] }, // Accident
    bloodTypeRequired: 'B_negative',
    unitsRequested:    4,
    unitsFulfilled:    1,                         // Partially fulfilled — one donor responded
    urgency:           URGENCY_LEVELS.CRITICAL,
    expiresAt:         daysFromNow(1),
  });
  console.log(`   🚨  [CRITICAL] B- × 4 (1 fulfilled) — JPMC Emergency (${req2.status})`);

  // Request 3: Urgent AB- at CHK (surgery)
  const req3 = await BloodRequest.create({
    hospitalId:        hospitals[0]._id,           // CHK
    postedBy:          hospitalAdmins[0]._id,       // Dr. Waseem Ali
    patientInfo:       { wardOrDept: 'Operation Theater', caseType: CASE_TYPES[1] }, // Surgery
    bloodTypeRequired: 'AB_negative',
    unitsRequested:    2,
    unitsFulfilled:    0,
    urgency:           URGENCY_LEVELS.URGENT,
    status:            REQUEST_STATUSES.OPEN,
    expiresAt:         daysFromNow(2),
  });
  console.log(`   ⚠️   [URGENT] AB- × 2 — Civil Hospital OT (${req3.status})`);

  // Request 4: Normal A+ at LNH (cancer/thalassemia — routine transfusion)
  const req4 = await BloodRequest.create({
    hospitalId:        hospitals[2]._id,           // LNH
    postedBy:          hospitalAdmins[2]._id,       // Dr. Shahbaz Hassan
    patientInfo:       { wardOrDept: 'Oncology Ward', caseType: CASE_TYPES[3] }, // Cancer
    bloodTypeRequired: 'A_positive',
    unitsRequested:    3,
    unitsFulfilled:    3,                          // Fully fulfilled → auto-closes
    urgency:           URGENCY_LEVELS.NORMAL,
    expiresAt:         daysFromNow(3),
  });
  console.log(`   ✅  [NORMAL] A+ × 3 (fully fulfilled) — LNH Oncology (${req4.status})`);

  // ── Appointments ─────────────────────────────────────────

  // Appt 1: Fatima (B-) responding to JPMC B- critical request → Indus Korangi (nearest bank with B-)
  const appt1 = await Appointment.create({
    donorId:       donors[1]._id,     // Fatima Malik (B-)
    bloodBankId:   banks[0]._id,      // Indus Korangi
    requestId:     req2._id,          // JPMC B- request
    scheduledDate: daysFromNow(1),
    status:        APPOINTMENT_STATUSES.CONFIRMED,
    bloodType:     'B_negative',
    notes:         'Responding to JPMC emergency request. First time donor.',
    confirmedBy:   bankAdmins[0]._id, // Indus Korangi admin
  });
  console.log(`   📅  ${donors[1].name} (B-) → Indus Korangi [${appt1.status}] — JPMC request`);

  // Appt 2: Ahmed (O+) donating at SIUT — general donation
  const appt2 = await Appointment.create({
    donorId:       donors[0]._id,     // Ahmed Khan (O+)
    bloodBankId:   banks[6]._id,      // SIUT
    requestId:     null,
    scheduledDate: daysFromNow(3),
    status:        APPOINTMENT_STATUSES.PENDING,
    bloodType:     'O_positive',
    notes:         'Regular donation — kidney ward awareness.',
  });
  console.log(`   📅  ${donors[0].name} (O+) → SIUT [${appt2.status}] — general`);

  // Appt 3: Usman (O-) responding to Abbasi Shaheed O- critical request → Aga Khan (highest O-)
  const appt3 = await Appointment.create({
    donorId:       donors[4]._id,     // Usman Tariq (O-)
    bloodBankId:   banks[7]._id,      // Aga Khan
    requestId:     req1._id,          // Abbasi Shaheed O- request
    scheduledDate: daysFromNow(1),
    status:        APPOINTMENT_STATUSES.CONFIRMED,
    bloodType:     'O_negative',
    notes:         'Universal donor — responding to trauma case at Abbasi Shaheed.',
    confirmedBy:   bankAdmins[7]._id, // AKUH admin
  });
  console.log(`   📅  ${donors[4].name} (O-) → Aga Khan [${appt3.status}] — ASH request`);

  // Appt 4: Bilal (A+) — completed last week at Fatimid Gulshan
  const appt4 = await Appointment.create({
    donorId:       donors[2]._id,     // Bilal Hassan (A+)
    bloodBankId:   banks[2]._id,      // Fatimid Gulshan
    requestId:     req4._id,          // LNH A+ request (now fulfilled)
    scheduledDate: daysAgo(7),
    status:        APPOINTMENT_STATUSES.COMPLETED,
    bloodType:     'A_positive',
    notes:         'LNH oncology request. Happy to donate regularly.',
    confirmedBy:   bankAdmins[2]._id, // Fatimid Gulshan admin
  });
  console.log(`   📅  ${donors[2].name} (A+) → Fatimid Gulshan [${appt4.status}] — completed`);

  // Appt 5: Saima (AB-) — pending self-booked at Aga Khan
  const appt5 = await Appointment.create({
    donorId:       donors[7]._id,     // Saima Rizvi (AB-)
    bloodBankId:   banks[7]._id,      // Aga Khan (highest AB- stock)
    requestId:     null,
    scheduledDate: daysFromNow(5),
    status:        APPOINTMENT_STATUSES.PENDING,
    bloodType:     'AB_negative',
    notes:         'Saw the AB- shortage alert on the portal. First time donor.',
  });
  console.log(`   📅  ${donors[7].name} (AB-) → Aga Khan [${appt5.status}] — saw portal alert`);

  // ── Audit Log ────────────────────────────────────────────
  await AuditLog.record({
    userId:           superAdmin._id,
    action:           AUDIT_ACTIONS.SEED_DATABASE,
    targetCollection: null,
    previousValue:    null,
    newValue: {
      bloodBanks:       banks.length,
      hospitals:        hospitals.length,
      users:            1 + bankAdmins.length + hospitalAdmins.length + donors.length,
      bloodRequests:    4,
      appointments:     5,
    },
    ipAddress: '127.0.0.1',
    meta:      { note: 'Initial Karachi demo seed — Phase 1', env: process.env.NODE_ENV },
  });

  // ── Summary ──────────────────────────────────────────────
  console.log('\n' + '━'.repeat(55));
  console.log('✅  SEED COMPLETE\n');
  console.log('📊  Summary:');
  console.log(`   Blood Banks:    ${banks.length}`);
  console.log(`   Hospitals:      ${hospitals.length}`);
  console.log(`   Super Admins:   1`);
  console.log(`   Bank Admins:    ${bankAdmins.length}`);
  console.log(`   Hospital Admins:${hospitalAdmins.length}`);
  console.log(`   Donors:         ${donors.length}`);
  console.log(`   Blood Requests: 4 (2 critical open, 1 urgent open, 1 closed)`);
  console.log(`   Appointments:   5 (2 confirmed, 2 pending, 1 completed)`);
  console.log('\n🔑  Login credentials (all accounts):');
  console.log(`   Password: ${defaultPassword}`);
  console.log(`   Super Admin:    superadmin@karachibloodbank.pk`);
  console.log(`   Bank Admin ex.: admin@indus-korangi.pk`);
  console.log(`   Hospital Admin: admin@chk.pk`);
  console.log(`   Donor:          ahmed.khan@gmail.com`);
  console.log('\n🗺️  Live shortage snapshot:');
  console.log('   B-  → Critical city-wide  (max 8 units at AKUH)');
  console.log('   AB- → Critical city-wide  (max 3 units at AKUH)');
  console.log('   O-  → Critical city-wide  (max 9 units at AKUH)');
  console.log('   O+  → Adequate (65+ units at multiple banks)');
  console.log('   A+  → Adequate (55+ units at AKUH)\n');
};

// ─── Entry Point ─────────────────────────────────────────────────────────────

seed()
  .catch((err) => {
    console.error('\n❌  Seed failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  })
  .finally(async () => {
    await mongoose.disconnect();
    console.log('🔌  MongoDB disconnected. Goodbye.\n');
  });