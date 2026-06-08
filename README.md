<div align="center">

<h1>
  <img src="https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Drop%20of%20blood/3D/drop_of_blood_3d.png" width="60" alt="Blood Drop"/>
  <br/>
  شہرِ حیات
  <br/>
  <sub>Shehr-e-Hayat — City of Life</sub>
</h1>

<p>
  <strong>Karachi's first open-source, centralized blood bank portal.</strong><br/>
  Real-time inventory. Live hospital requests. A city-wide map of supply and demand — built to save lives.
</p>

<p>
  <img src="https://img.shields.io/badge/Node.js-20%2B-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js"/>
  <img src="https://img.shields.io/badge/Express.js-4.x-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express"/>
  <img src="https://img.shields.io/badge/MongoDB-Atlas-47A248?style=for-the-badge&logo=mongodb&logoColor=white" alt="MongoDB"/>
  <img src="https://img.shields.io/badge/Tailwind_CSS-3.x-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind"/>
  <img src="https://img.shields.io/badge/Leaflet.js-Map-199900?style=for-the-badge&logo=leaflet&logoColor=white" alt="Leaflet"/>
  <img src="https://img.shields.io/badge/JWT-Auth-000000?style=for-the-badge&logo=jsonwebtokens&logoColor=white" alt="JWT"/>
</p>

<p>
  <img src="https://img.shields.io/badge/Status-Active_Development-blue?style=flat-square"/>
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square"/>
  <img src="https://img.shields.io/badge/Made_in-Karachi%2C_Pakistan-009900?style=flat-square"/>
  <img src="https://img.shields.io/badge/DBMS_Project-University-7C3AED?style=flat-square"/>
</p>

</div>

---

## Table of Contents

- [The Problem](#-the-problem)
- [What Shehr-e-Hayat Solves](#-what-shehr-e-hayat-solves)
- [Live Features](#-live-features)
- [System Architecture](#-system-architecture)
- [Role Architecture](#-role-architecture)
- [Tech Stack](#-tech-stack)
- [Database Schema](#-database-schema)
- [API Reference](#-api-reference)
- [Security Design](#-security-design)
- [Getting Started](#-getting-started)
- [Seeded Demo Accounts](#-seeded-demo-accounts)
- [Project Structure](#-project-structure)
- [Development Roadmap](#-development-roadmap)
- [What This Demonstrates](#-what-this-demonstrates-for-evaluators)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🩸 The Problem

As of 2026, **there is no centralized, publicly accessible, real-time blood inventory system** covering Karachi — a city of 20+ million people.

What exists today is broken:

- **Fatimid Foundation**, **Indus Hospital**, **Chhipa**, and **Edhi** each run completely siloed records with no inter-system communication
- Emergency blood requests spread via unverified **WhatsApp forwards** and **Twitter/X posts**
- Thalassemia patients and trauma cases at **Civil Hospital (CHK)**, **JPMC**, **Abbasi Shaheed**, and **Liaquat National** routinely face critical shortages of `B−`, `AB−`, and `O−` — while `O+` and `A+` sit at surplus in other banks across the city
- The few existing public directories are **static HTML pages** — not live databases

> **The core inefficiency is misdirected donation traffic.** Donors show up where it is convenient, not where it is critical. Shehr-e-Hayat fixes this.

---

## ✅ What Shehr-e-Hayat Solves

Shehr-e-Hayat is a **full-stack civic infrastructure prototype** that closes the demand-supply loop across Karachi's blood banking network:

| Before | After |
|--------|-------|
| Donors call banks one by one | One map shows every bank's live inventory |
| Hospitals post requests on WhatsApp | Verified hospital admins post structured emergency requests |
| Banks cannot see what hospitals urgently need | Blood banks see hospital demand in real time |
| Donors donate without context | Donors see *exactly why* a specific bank is critical right now |
| No audit trail on inventory changes | Every write operation is logged with user, timestamp, and IP |

---

## ✨ Live Features

### Public Landing Page
- 🗺️ **Live Karachi map** (Leaflet.js + OpenStreetMap) with all blood banks color-coded by stock level — green (adequate), amber (low), red (critical)
- 📊 **City-wide metrics bar** — total units available, open hospital requests, critical shortage count, all fetched live on page load
- 🔍 **Blood type search** — filter by type and district to find the nearest bank with available units
- 📢 **Emergency marquee** — scrolling live feed of all open hospital requests with urgency level and units still needed
- 🔄 **Auto-refresh** — critical shortage data polls every 60 seconds without page reload

### Donor Dashboard
- Eligibility status with 90-day donation cooldown enforcement
- City-wide shortage map highlighting which banks need your specific blood type
- Appointment booking form — pick bank, date, and time slot
- Full appointment history with status tracking

### Blood Bank Admin Dashboard
- Live editable inventory panel — change unit counts, hit Save, API updates instantly
- Appointment queue management — Confirm / Complete / No Show controls
- Monthly donation stats and critical stock alerts

### Hospital Admin Dashboard
- Post structured blood requests with urgency level (`Normal` / `Urgent` / `Critical`), ward/department, and case type
- Track fulfillment in real time — units pledged vs units needed
- Close requests when demand is met

### Super Admin Dashboard
- System-wide analytics overview
- Blood bank and hospital onboarding and verification
- User management across all roles
- Full audit log viewer — every privileged action with before/after values

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                             │
│  index.html · donor-dashboard · bank-admin · hospital-admin     │
│  super-admin · login · register                                 │
│  [Tailwind CSS · Vanilla JS · Fetch API · Leaflet.js · Chart.js]│
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTPS / REST
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                         API LAYER                               │
│              Express.js REST API (Node.js v20+)                 │
│                                                                 │
│  /api/auth       /api/bloodbanks     /api/blood                 │
│  /api/requests   /api/appointments   /api/admin                 │
│                                                                 │
│  Middleware Stack:                                              │
│  helmet → cors → morgan → rate-limiter → mongoSanitize          │
│                    ↓                                            │
│          protect (JWT verify) → authorize (role guard)          │
│                    ↓                                            │
│          express-validator (input sanitization)                 │
└────────────────────────────┬────────────────────────────────────┘
                             │ Mongoose ODM
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                       DATABASE LAYER                            │
│                  MongoDB Atlas (Free Tier)                      │
│                                                                 │
│  users · bloodbanks · hospitals · bloodrequests                 │
│  appointments · auditlogs                                       │
│                                                                 │
│  Indexes: 2dsphere on bloodbanks.location, hospitals.location   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 👥 Role Architecture

The system uses four distinct roles enforced at both the API middleware and database query level:

| Role | Who | Core Permissions |
|------|-----|-----------------|
| `super_admin` | Project owners / System administrators | Full CRUD on all collections. Onboard and verify blood banks and hospitals. View complete audit logs. |
| `blood_bank_admin` | Staff at Indus, Fatimid, Chhipa, Edhi, SIUT, etc. | Update their own bank's live inventory. Accept, reject, and complete donor appointments. Read-only on all other banks. |
| `hospital_admin` | Staff at JPMC, Civil Hospital, Liaquat National, etc. | Post, update, and close emergency blood requests. Read-only on all blood bank inventories. |
| `donor` / `public_user` | General citizens of Karachi | View public live inventory and hospital requests. Book donation appointments. Strict read-only on all system data. |

> Bank and hospital admin accounts are **never self-registered**. They are created and verified by `super_admin` only — ensuring data integrity.

---

## 🛠️ Tech Stack

### Backend

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Runtime | **Node.js v20+ LTS** | JavaScript everywhere; massive ecosystem |
| Framework | **Express.js** | Lightweight, unopinionated REST API server |
| ODM | **Mongoose** | Schema validation and typed queries on top of MongoDB |
| Authentication | **jsonwebtoken** | Stateless JWT auth — token carries user ID and role |
| Password Security | **bcryptjs** | Industry-standard hashing; salt rounds: 12 |
| Environment | **dotenv** | Secrets never touch the codebase |
| Input Validation | **express-validator** | Sanitize and validate every incoming request body |
| Security Headers | **helmet** | Sets 14+ secure HTTP headers automatically |
| NoSQL Injection | **express-mongo-sanitize** | Strips `$` and `.` from user-supplied data |
| Rate Limiting | **express-rate-limit** | 10 login attempts per IP per 15 minutes |
| CORS | **cors** | Allowlist-only frontend origin policy |
| Logging | **morgan** | HTTP request logging for debugging |
| Dev | **nodemon** | Auto-restart on file save |

### Frontend

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Markup | **HTML5** | Semantic, accessible structure |
| Styling | **Tailwind CSS (CDN)** | Utility-first; responsive in every breakpoint |
| Logic | **Vanilla JavaScript (ES6+)** | Zero framework bloat for a prototype |
| HTTP | **Fetch API** | Native async calls to the REST API |
| Maps | **Leaflet.js + OpenStreetMap** | Free tile maps; Karachi blood bank pin topology |
| Charts | **Chart.js** | Live inventory bar charts on admin dashboards |
| Icons | **Lucide Icons + Material Symbols** | Clean, consistent iconography |

### Infrastructure

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Database | **MongoDB Atlas (M0 Free)** | Cloud-hosted; 512MB free; no local setup needed |
| Version Control | **Git + GitHub** | Source of truth for the entire project |
| API Testing | **VS Code Thunder Client** | Test every endpoint before touching the frontend |

---

## 🗄️ Database Schema

Six MongoDB collections with a hybrid embed/reference strategy — embedded for performance (inventory inside a bank document), referenced for relationships (appointments pointing to user and bank IDs).

<details>
<summary><strong>Collection 1: <code>users</code></strong></summary>

```javascript
{
  "_id": ObjectId,
  "name": "Huzaifa Habib",
  "email": "huzaifa@example.com",
  "phone": "+923001234567",
  "passwordHash": "$2b$12$eF...",        // bcrypt, salt rounds: 12 — NEVER plain text
  "role": "blood_bank_admin",            // super_admin | blood_bank_admin | hospital_admin | donor
  "bloodType": "O_positive",             // Relevant for donors only
  "associatedEntityId": ObjectId("..."), // Points to BloodBank or Hospital doc
  "isVerified": true,                    // super_admin manually verifies bank/hospital accounts
  "lastDonationDate": ISODate("..."),    // Enforces 90-day eligibility cooldown
  "createdAt": ISODate("..."),
  "updatedAt": ISODate("...")
}
```
</details>

<details>
<summary><strong>Collection 2: <code>bloodbanks</code></strong></summary>

```javascript
{
  "_id": ObjectId,
  "name": "Indus Hospital Blood Bank",
  "branch": "Korangi",
  "address": "Korangi Crossing, Karachi",
  "location": {
    "type": "Point",
    "coordinates": [67.1232, 24.8294]   // GeoJSON [lng, lat] — enables 2dsphere queries
  },
  "contact": "+9221111111111",
  "operatingHours": "24/7",
  "isActive": true,
  "inventory": {
    "A_positive":  { "units": 45, "lastUpdated": ISODate("...") },
    "A_negative":  { "units": 3,  "lastUpdated": ISODate("...") }, // Below threshold
    "B_positive":  { "units": 22, "lastUpdated": ISODate("...") },
    "B_negative":  { "units": 1,  "lastUpdated": ISODate("...") }, // Critical
    "AB_positive": { "units": 18, "lastUpdated": ISODate("...") },
    "AB_negative": { "units": 0,  "lastUpdated": ISODate("...") }, // Out of stock
    "O_positive":  { "units": 60, "lastUpdated": ISODate("...") },
    "O_negative":  { "units": 7,  "lastUpdated": ISODate("...") }
  },
  "alertThreshold": 10,                  // Units below this = public critical alert
  "createdAt": ISODate("..."),
  "updatedAt": ISODate("...")
}
// Required index: db.bloodbanks.createIndex({ location: "2dsphere" })
```
</details>

<details>
<summary><strong>Collection 3: <code>hospitals</code></strong></summary>

```javascript
{
  "_id": ObjectId,
  "name": "Civil Hospital Karachi",
  "shortCode": "CHK",
  "address": "Baba-e-Urdu Road, Saddar, Karachi",
  "location": {
    "type": "Point",
    "coordinates": [67.0209, 24.8553]
  },
  "contact": "+922199215740",
  "isGovernment": true,
  "isActive": true,
  "createdAt": ISODate("...")
}
```
</details>

<details>
<summary><strong>Collection 4: <code>bloodrequests</code></strong></summary>

```javascript
{
  "_id": ObjectId,
  "hospitalId": ObjectId("..."),         // ref: hospitals
  "postedBy": ObjectId("..."),           // ref: users (hospital_admin)
  "patientInfo": {
    "wardOrDept": "ICU",
    "caseType": "Accident"               // Accident | Surgery | Thalassemia | Cancer | Other
  },
  "bloodTypeRequired": "B_negative",
  "unitsRequested": 5,
  "unitsFulfilled": 2,
  "urgency": "Critical",                 // Normal | Urgent | Critical
  "status": "Open",                      // Open | Partially_Fulfilled | Closed | Expired
  "expiresAt": ISODate("..."),           // Auto-close after 48 hours if not closed manually
  "createdAt": ISODate("..."),
  "updatedAt": ISODate("...")
}
```
</details>

<details>
<summary><strong>Collection 5: <code>appointments</code></strong></summary>

```javascript
{
  "_id": ObjectId,
  "donorId": ObjectId("..."),            // ref: users
  "bloodBankId": ObjectId("..."),        // ref: bloodbanks
  "requestId": ObjectId("..."),          // Optional — responding to a specific hospital request
  "scheduledDate": ISODate("..."),
  "status": "Pending",                   // Pending | Confirmed | Completed | Cancelled | No_Show
  "bloodType": "O_positive",
  "notes": "First time donor",
  "confirmedBy": ObjectId("..."),        // blood_bank_admin who confirmed
  "createdAt": ISODate("...")
}
```
</details>

<details>
<summary><strong>Collection 6: <code>auditlogs</code> (Super Admin only)</strong></summary>

```javascript
{
  "_id": ObjectId,
  "userId": ObjectId("..."),
  "action": "UPDATE_INVENTORY",          // LOGIN | CREATE_REQUEST | UPDATE_INVENTORY | ...
  "targetCollection": "bloodbanks",
  "targetDocumentId": ObjectId("..."),
  "previousValue": { "B_negative": { "units": 5 } },
  "newValue":      { "B_negative": { "units": 1 } },
  "ipAddress": "111.68.x.x",
  "timestamp": ISODate("...")
}
```
</details>

---

## 📡 API Reference

### Auth — `/api/auth`

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| `POST` | `/register` | Public | Register a new donor account |
| `POST` | `/login` | Public | Authenticate and receive a JWT token |
| `GET` | `/me` | Authenticated | Return the logged-in user's full profile |

### Blood Banks — `/api/bloodbanks`

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| `GET` | `/` | Public | List all active blood banks |
| `GET` | `/:id` | Public | Get one bank with full live inventory |
| `GET` | `/:id/inventory` | Public | Get inventory only for a specific bank |
| `PUT` | `/:id/inventory` | `blood_bank_admin`, `super_admin` | Update unit count for a blood type |
| `POST` | `/` | `super_admin` | Onboard a new blood bank |
| `PATCH` | `/:id/status` | `super_admin` | Activate or deactivate a bank |

### Blood Search — `/api/blood`

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| `GET` | `/search?type=B_negative` | Public | All banks with available units of a type, sorted by quantity |
| `GET` | `/critical` | Public | All blood types currently below alert threshold city-wide |
| `GET` | `/map` | Public | All banks with coordinates for Leaflet map rendering |

### Blood Requests — `/api/requests`

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| `GET` | `/` | Public | View all open hospital blood requests |
| `GET` | `/:id` | Public | View a specific request |
| `POST` | `/` | `hospital_admin` | Post a new emergency blood request |
| `PATCH` | `/:id` | `hospital_admin`, `super_admin` | Update fulfilled units or urgency |
| `DELETE` | `/:id` | `hospital_admin`, `super_admin` | Close or cancel a request |

### Appointments — `/api/appointments`

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| `POST` | `/` | `donor` | Book a donation appointment |
| `GET` | `/my` | `donor` | View own appointment history |
| `GET` | `/bank/:bankId` | `blood_bank_admin` | View all appointments for their bank |
| `PATCH` | `/:id/status` | `blood_bank_admin` | Confirm, complete, or mark no-show |

### Admin — `/api/admin`

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| `GET` | `/users` | `super_admin` | List all system users |
| `POST` | `/hospitals` | `super_admin` | Onboard a new hospital |
| `GET` | `/logs` | `super_admin` | View full audit log |
| `PATCH` | `/users/:id/verify` | `super_admin` | Verify a bank or hospital account |

---

## 🔐 Security Design

Security is layered and applied at every level of the stack.

### 1. JWT Middleware (`middleware/auth.js`)
Every protected route verifies the Bearer token before any controller logic executes:

```javascript
const protect = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token. Access denied.' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, role, associatedEntityId }
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
};
```

### 2. Role Guard (`middleware/authorize.js`)
Roles are checked on every sensitive endpoint:

```javascript
const authorize = (...allowedRoles) => (req, res, next) => {
  if (!allowedRoles.includes(req.user.role))
    return res.status(403).json({ message: 'Forbidden. Insufficient privileges.' });
  next();
};

// Example usage:
router.put('/:id/inventory', protect, authorize('blood_bank_admin', 'super_admin'), updateInventory);
```

### 3. Entity Ownership Guard
A blood bank admin can only write to their own bank — not any other:

```javascript
if (req.user.role === 'blood_bank_admin') {
  if (req.user.associatedEntityId.toString() !== req.params.bankId)
    return res.status(403).json({ message: 'You can only manage your own blood bank.' });
}
```

### 4. Rate Limiting — Brute Force Protection
Auth endpoints are protected from automated attacks:

```javascript
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15-minute window
  max: 10,                   // Maximum 10 login attempts per IP
  message: 'Too many login attempts. Try again in 15 minutes.'
});
app.use('/api/auth/login', authLimiter);
```

### Security Checklist

- [x] `helmet.js` — Sets 14+ secure HTTP response headers
- [x] `cors` — Configured to allow only the declared frontend origin
- [x] `bcryptjs` — Passwords hashed with salt rounds: 12; plain text never stored
- [x] JWT secret is a 256-bit random hex string stored in `.env` only
- [x] `.env` is in `.gitignore` — secrets never reach version control
- [x] `express-mongo-sanitize` — Blocks NoSQL injection by stripping `$` operators
- [x] `express-validator` — Every POST/PUT body is validated and sanitized before use
- [x] HTTPS enforced by MongoDB Atlas on all database connections

---

## 🚀 Getting Started

### Prerequisites

Make sure the following are installed before you begin:

```bash
node --version   # v20.x.x or higher required
npm --version    # 10.x.x or higher
git --version    # any recent version
```

If Node.js is not installed, download the **LTS version** from [nodejs.org](https://nodejs.org).

---

### Step 1 — Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/shehr-e-hayat.git
cd shehr-e-hayat/backend
```

---

### Step 2 — Install all dependencies

```bash
npm install
```

This installs every package declared in `package.json`. When complete you will see:
```
added 147 packages in ~12s
```

Verify the install succeeded:

```bash
node -e "require('express'); require('mongoose'); require('bcryptjs'); console.log('All packages OK')"
```

---

### Step 3 — MongoDB Atlas setup

1. Create a free account at [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas/register)
2. Create a free **M0 cluster** — name it `karachi-bloodbank`, region: **AWS Mumbai (ap-south-1)**
3. Under **Security → Database Access**, create a database user with read/write privileges
4. Under **Security → Network Access**, add `0.0.0.0/0` (allow from anywhere) for development
5. Click **Connect → Drivers** on your cluster and copy the connection string

---

### Step 4 — Configure environment variables

```bash
# From inside the backend/ folder:
cp env.example .env        # Mac/Linux
copy env.example .env      # Windows Command Prompt
```

Open `.env` and fill in all values:

```env
# MongoDB — paste your Atlas string; replace <password> and add the DB name before the ?
MONGODB_URI=mongodb+srv://bloodbank_admin:YOUR_PASSWORD@karachi-bloodbank.xxxxx.mongodb.net/karachi-bloodbank?retryWrites=true&w=majority

# Generate a secure JWT secret with this one-liner:
# node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=paste_your_128_char_hex_string_here

JWT_EXPIRES_IN=7d
PORT=5000
NODE_ENV=development

# VS Code Live Server default port
CORS_ORIGIN=http://localhost:5500

# Password used for all seeded demo accounts
SEED_DEFAULT_PASSWORD=Karachi@1234
```

> ⚠️ **Never commit `.env` to Git.** It is already listed in `.gitignore`.

---

### Step 5 — Test the database connection

```bash
node -e "
require('dotenv').config();
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URI)
  .then(() => { console.log('SUCCESS: Connected to MongoDB Atlas'); process.exit(0); })
  .catch(err => { console.error('FAILED:', err.message); process.exit(1); });
"
```

---

### Step 6 — Seed the database

Populate the database with realistic Karachi data: 12 blood banks, 8 hospitals, 29 users, open emergency requests, and appointments:

```bash
npm run seed
```

Expected output:
```
🌱 Starting Karachi Blood Bank Portal seed...
✅ Connected to MongoDB: karachi-bloodbank.xxxxx.mongodb.net
🗑  Dropping existing collections...
🏥 Seeding 12 blood banks...
🏨 Seeding 8 hospitals...
👤 Seeding users (1 super admin + 12 bank admins + 8 hospital admins + 8 donors)...
🩸 Seeding 4 blood requests...
📅 Seeding 5 appointments...
✅ Seed complete! Database is ready.
   Blood Banks : 12
   Hospitals   : 8
   Users       : 29
   Requests    : 4
   Appointments: 5
```

---

### Step 7 — Start the development server

```bash
npm run dev
```

The API server starts at **`http://localhost:5000`** and restarts automatically on every file save.

Open `frontend/index.html` with the [VS Code Live Server extension](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) — it will run at `http://localhost:5500`.

---

### Troubleshooting

| Problem | Likely Cause | Fix |
|---------|-------------|-----|
| `bad auth: Authentication failed` | Wrong password in connection string | Reset password in Atlas → Security → Database Access |
| `connection timed out` / `ETIMEDOUT` | IP not whitelisted | Atlas → Security → Network Access → add `0.0.0.0/0` |
| `getaddrinfo ENOTFOUND` | Wrong cluster name in URI | Re-copy the string from Atlas → Connect |
| `MongoParseError: URI malformed` | Special character (`@`, `#`) in password | Change password to letters/numbers only |
| `Cannot find module 'dotenv'` | Wrong working directory | `cd backend` then retry |
| `JWT_SECRET` auth errors | Empty JWT_SECRET in `.env` | Generate one with the `crypto` command in Step 4 |

---

## 🔑 Seeded Demo Accounts

All demo accounts use the password set in `.env`:
```
SEED_DEFAULT_PASSWORD=Karachi@1234
```

### Super Admin
```
Email    : admin@bloodbank.karachi
Password : Karachi@1234
```

### Blood Bank Admin Examples
```
Email    : admin@induskorangi.org        →  Indus Hospital Blood Bank (Korangi)
Email    : admin@fatimidgulshan.org      →  Fatimid Foundation (Gulshan-e-Iqbal)
Email    : admin@akhbloodbank.org        →  Aga Khan Hospital Blood Bank
Password : Karachi@1234  (all accounts)
```

### Hospital Admin Examples
```
Email    : admin@civilhospital.gov.pk   →  Civil Hospital Karachi
Email    : admin@jpmc.gov.pk            →  JPMC
Email    : admin@liaquatnational.pk     →  Liaquat National Hospital
Password : Karachi@1234  (all accounts)
```

### Donor Examples
```
Email    : ahmed.raza@gmail.com         →  Blood type: O+
Email    : fatima.malik@gmail.com       →  Blood type: B−
Email    : hassan.siddiqui@gmail.com    →  Blood type: AB−
Password : Karachi@1234  (all accounts)
```

---

## 📁 Project Structure

```
shehr-e-hayat/
│
├── backend/
│   ├── config/
│   │   └── db.js                    # MongoDB Atlas connection
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── bloodBankController.js
│   │   ├── bloodSearchController.js
│   │   ├── requestController.js
│   │   ├── appointmentController.js
│   │   └── adminController.js
│   ├── middleware/
│   │   ├── auth.js                  # JWT verification
│   │   ├── authorize.js             # Role-based access guard
│   │   └── validate.js              # express-validator rules
│   ├── models/
│   │   ├── User.js
│   │   ├── BloodBank.js
│   │   ├── Hospital.js
│   │   ├── BloodRequest.js
│   │   ├── Appointment.js
│   │   └── AuditLog.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── bloodBanks.js
│   │   ├── blood.js
│   │   ├── requests.js
│   │   ├── appointments.js
│   │   └── admin.js
│   ├── seed/
│   │   └── seed.js                  # Karachi dummy data seeder
│   ├── utils/
│   │   └── helpers.js
│   ├── .env                         # ← YOU CREATE THIS (copy from env.example)
│   ├── env.example                  # Template — safe to commit
│   ├── .gitignore
│   ├── package.json
│   └── server.js                    # Entry point
│
└── frontend/
    ├── assets/
    ├── css/
    ├── js/
    │   ├── api.js                   # All fetch calls to the backend
    │   ├── auth.js                  # Login/logout/token handling
    │   ├── map.js                   # Leaflet map logic
    │   ├── dashboard.js             # Dashboard-specific logic
    │   └── utils.js                 # Shared helpers and formatters
    ├── index.html                   # Public landing page + live map
    ├── login.html
    ├── register.html
    ├── donor-dashboard.html
    ├── bank-admin-dashboard.html
    ├── hospital-admin-dashboard.html
    └── super-admin-dashboard.html
```

---

## 🗓️ Development Roadmap

| Phase | Scope | Timeline |
|-------|-------|----------|
| **Phase 0** — Setup | Project scaffold, `.env`, `package.json`, folder structure | Day 1 |
| **Phase 1** — Database | Mongoose models, geospatial indexes, seed script with realistic Karachi data | Days 1–2 |
| **Phase 2** — Backend API | All 6 route groups, JWT auth, role guards, entity ownership, audit logging | Days 3–7 |
| **Phase 3** — Frontend Pages | All 7 HTML pages wired to live API, Leaflet map, Chart.js dashboards | Days 8–14 |
| **Phase 4** — Real-Time Feel | 60-second polling on critical data, SSE push notifications (optional) | Days 14–16 |
| **Phase 5** — Polish & Demo | Error states, loading spinners, mobile responsiveness, demo video | Days 17–20 |

### Phase 4 — Polling Implementation (No WebSocket Required)

```javascript
// On the public landing page — keeps shortage data fresh without page reload
setInterval(async () => {
  const res = await fetch('/api/blood/critical');
  const data = await res.json();
  renderCriticalAlerts(data);
}, 60_000); // Every 60 seconds
```

**Optional enhancement:** Server-Sent Events (SSE) to push critical request notifications to all active donor sessions — no third-party library needed, built into Node.js, and genuinely impressive for a prototype.

---

## 🎓 What This Demonstrates (For Evaluators)

From a database management systems perspective, this project covers:

| Concept | Where It Appears |
|---------|-----------------|
| **Complex document schema design** | Hybrid embed/reference strategy across 6 collections |
| **Role-Based Access Control (RBAC)** | Enforced at middleware level and inside controller logic |
| **Geospatial indexing** | `2dsphere` index on `bloodbanks.location` enables proximity queries |
| **MongoDB aggregation pipeline** | City-wide shortage analytics and dashboard statistics |
| **Referential integrity patterns** | `populate()` for consistent cross-collection joins |
| **Audit logging** | Every privileged write operation stored with before/after values |
| **Schema validation** | Mongoose enforces types, enums, and required fields on every write |
| **Normalization decisions** | Conscious embed-vs-reference choices with documented reasoning |
| **Index design** | Compound and single-field indexes on frequently queried fields |
| **Security at the data layer** | Input sanitization, NoSQL injection prevention, ownership guards |

> This is not a toy CRUD application. The schema has real architectural thought behind it, and that will be evident to anyone who reads the models.

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome.

1. **Fork** this repository
2. Create a feature branch: `git checkout -b feature/your-feature-name`
3. Commit your changes: `git commit -m "feat: add your feature"`
4. Push to the branch: `git push origin feature/your-feature-name`
5. Open a **Pull Request** with a clear description of the change

### Areas where help is most valuable right now

- [ ] Expanding the seed dataset with more Karachi blood banks and donors
- [ ] Server-Sent Events (SSE) implementation for real-time push notifications
- [ ] Geospatial proximity search — "find the 3 nearest banks to my location with B−"
- [ ] SMS notification integration via local Pakistan SMS gateway
- [ ] PWA (Progressive Web App) manifest for offline-first donor experience
- [ ] Docker Compose configuration for local full-stack setup

---

## 📜 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

You are free to use, modify, and distribute this project for any purpose, including civic and humanitarian applications.

---

## 🙏 Acknowledgments

- **Fatimid Foundation, Indus Hospital, Chhipa, and Edhi Foundation** — whose vital work inspired this system and whose real-world operations informed the data model
- **OpenStreetMap contributors** — for free, open map tile infrastructure
- **MongoDB Atlas** — for making cloud databases accessible at no cost for prototypes
- The people of Karachi — for whom this system was designed

---

<div align="center">

**شہرِ حیات — City of Life**

*Built in Karachi. For Karachi.*

<img src="https://img.shields.io/badge/Node.js-339933?style=flat&logo=nodedotjs&logoColor=white"/>
<img src="https://img.shields.io/badge/MongoDB-47A248?style=flat&logo=mongodb&logoColor=white"/>
<img src="https://img.shields.io/badge/Express.js-000000?style=flat&logo=express&logoColor=white"/>
<img src="https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=flat&logo=tailwindcss&logoColor=white"/>
<img src="https://img.shields.io/badge/Leaflet.js-199900?style=flat&logo=leaflet&logoColor=white"/>

</div>
