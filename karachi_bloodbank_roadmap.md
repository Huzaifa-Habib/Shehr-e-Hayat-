# Karachi Centralized Blood Bank Portal — Complete Project Roadmap

---

## Honest Assessment of Your Idea

Your instinct is correct and the problem is real. As of mid-2026, there is no centralized, publicly accessible, real-time blood inventory system covering Karachi's blood banks. What exists today:

- **Fatimid Foundation**, **Indus Hospital Blood Bank**, **Chhipa**, and **Edhi** each run their own siloed records
- Emergency requests spread via WhatsApp forwards and Twitter/X posts — completely unverified and unreliable
- Thalassemia patients and trauma cases at **Civil Hospital (CHK)**, **JPMC**, **Abbasi Shaheed**, and **Liaquat National** frequently face shortages of rare blood types (B−, AB−, O−) while O+ and A+ sit surplus at the famous banks
- The few existing directories (e.g., government health portals) are static HTML pages, not live databases

**Your system directly attacks the core inefficiency: misdirected donation traffic.** This is not just a DBMS project — it is a genuinely needed civic infrastructure prototype.

### Should You Add a Hospital Role?

**Yes, absolutely — it is the missing piece.** Without hospitals, your system is a supply-side dashboard. With hospitals, you close the demand loop:

- Hospitals post live, verified blood requests with urgency levels
- Blood banks see what nearby hospitals need and can notify their donor pool
- Donors see *why* a specific bank is critical right now, not just raw numbers — this is psychologically far more motivating for action

The full role architecture should be **four roles, not three**.

---

## Final Role Architecture

| Role | Who They Are | Core Permissions |
|---|---|---|
| `super_admin` | Your team / project owner | Full CRUD on all collections. Onboard/verify blood banks and hospitals. View audit logs. |
| `blood_bank_admin` | Indus, Fatimid, Chhipa, Edhi staff | Update their own bank's live inventory. Accept/reject donor appointments. Mark donations complete. |
| `hospital_admin` | JPMC, Civil Hospital, Liaquat National staff | Post, update, or close emergency blood requests. Read-only on bank inventories. |
| `donor` / `public_user` | General citizens of Karachi | View live public inventory, view hospital requests, book donation appointments. Strict read-only for all system data. |

---

## Complete Technology Stack

### Backend
| Layer | Technology | Why |
|---|---|---|
| Runtime | **Node.js (v20+ LTS)** | Same language as your frontend JS; massive ecosystem |
| Framework | **Express.js** | Lightweight, unopinionated, perfect for REST APIs |
| ODM | **Mongoose** | Schema validation on top of MongoDB; critical for data integrity |
| Authentication | **JSON Web Tokens (jsonwebtoken)** | Stateless, scalable auth — token carries user role |
| Password Security | **bcryptjs** | Industry-standard hashing; never store plain text passwords |
| Environment Config | **dotenv** | Keep secrets out of your codebase |
| Input Validation | **express-validator** | Sanitize all incoming data before it touches MongoDB |
| Rate Limiting | **express-rate-limit** | Block brute force attacks on auth endpoints |
| CORS | **cors** | Control which frontend origins can call your API |
| Logging | **morgan** | HTTP request logging for debugging |

### Frontend
| Layer | Technology | Why |
|---|---|---|
| Markup | **HTML5** | Semantic structure |
| Styling | **Tailwind CSS (CDN or CLI)** | Rapid utility-first styling |
| Interactivity | **Vanilla JavaScript (ES6+)** | No framework bloat for a prototype |
| Async Communication | **Fetch API** | Native browser API; no extra library needed |
| Optional Enhancement | **Axios** | Slightly cleaner error handling than raw Fetch; your choice |
| Charts / Visuals | **Chart.js** | Render live inventory bar charts on dashboards |
| Maps | **Leaflet.js + OpenStreetMap** | Free map tiles; plot blood bank and hospital locations across Karachi |
| Icons | **Lucide Icons (CDN)** | Clean, consistent icon set |

### Database & Infrastructure
| Layer | Technology | Why |
|---|---|---|
| Database | **MongoDB Atlas (Free Tier)** | Cloud-hosted; no local setup; free 512MB is plenty for prototype |
| ODM | **Mongoose** | As above |
| Dev Environment | **VS Code + Thunder Client** | Test API endpoints without Postman |
| Version Control | **Git + GitHub** | Always. Even for a prototype. |

---

## MongoDB Schema Design

Use a **hybrid approach**: embed data for performance (blood type inventory inside a bank document), reference data for relationships (appointments referencing user IDs and bank IDs).

### Collection 1: `users`
```javascript
{
  "_id": ObjectId,
  "name": "Huzaifa Habib",
  "email": "huzaifa@example.com",
  "phone": "+923001234567",
  "passwordHash": "$2b$10$eF...",           // bcrypt — NEVER store plain text
  "role": "blood_bank_admin",               // super_admin | blood_bank_admin | hospital_admin | donor
  "bloodType": "O_positive",                // Only relevant for donors
  "associatedEntityId": ObjectId("..."),    // Points to BloodBank or Hospital doc if applicable
  "isVerified": true,                       // Admin manually verifies bank/hospital accounts
  "lastDonationDate": ISODate("..."),       // For 3-month eligibility cooldown enforcement
  "createdAt": ISODate("..."),
  "updatedAt": ISODate("...")
}
```

### Collection 2: `bloodbanks`
```javascript
{
  "_id": ObjectId,
  "name": "Indus Hospital Blood Bank",
  "branch": "Korangi",
  "address": "Korangi Crossing, Karachi",
  "location": {
    "type": "Point",
    "coordinates": [67.1232, 24.8294]       // GeoJSON: [lng, lat] — enables MongoDB geospatial queries
  },
  "contact": "+9221111111111",
  "operatingHours": "24/7",
  "isActive": true,
  "inventory": {
    "A_positive":  { "units": 45, "lastUpdated": ISODate("...") },
    "A_negative":  { "units": 3,  "lastUpdated": ISODate("...") },  // Below threshold — triggers alert
    "B_positive":  { "units": 22, "lastUpdated": ISODate("...") },
    "B_negative":  { "units": 1,  "lastUpdated": ISODate("...") },  // Critical
    "AB_positive": { "units": 18, "lastUpdated": ISODate("...") },
    "AB_negative": { "units": 0,  "lastUpdated": ISODate("...") },  // Out of stock
    "O_positive":  { "units": 60, "lastUpdated": ISODate("...") },
    "O_negative":  { "units": 7,  "lastUpdated": ISODate("...") }
  },
  "alertThreshold": 10,                     // Units below this = critical alert shown publicly
  "createdAt": ISODate("..."),
  "updatedAt": ISODate("...")
}
// Index: Create a 2dsphere index on location for geospatial queries
// db.bloodbanks.createIndex({ location: "2dsphere" })
```

### Collection 3: `hospitals`
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

### Collection 4: `bloodrequests`
```javascript
{
  "_id": ObjectId,
  "hospitalId": ObjectId("..."),            // References hospitals collection
  "postedBy": ObjectId("..."),              // References users collection (hospital_admin)
  "patientInfo": {
    "wardOrDept": "ICU",
    "caseType": "Accident"                  // Accident | Surgery | Thalassemia | Cancer | Other
  },
  "bloodTypeRequired": "B_negative",
  "unitsRequested": 5,
  "unitsFulfilled": 2,
  "urgency": "Critical",                    // Normal | Urgent | Critical
  "status": "Open",                         // Open | Partially_Fulfilled | Closed | Expired
  "expiresAt": ISODate("..."),              // Auto-close after 48hrs if not closed manually
  "createdAt": ISODate("..."),
  "updatedAt": ISODate("...")
}
```

### Collection 5: `appointments`
```javascript
{
  "_id": ObjectId,
  "donorId": ObjectId("..."),              // References users collection
  "bloodBankId": ObjectId("..."),          // References bloodbanks collection
  "requestId": ObjectId("..."),            // Optional — if responding to a specific hospital request
  "scheduledDate": ISODate("..."),
  "status": "Pending",                     // Pending | Confirmed | Completed | Cancelled | No_Show
  "bloodType": "O_positive",
  "notes": "First time donor",
  "confirmedBy": ObjectId("..."),          // blood_bank_admin who confirmed
  "createdAt": ISODate("...")
}
```

### Collection 6: `auditlogs` (Super Admin only)
```javascript
{
  "_id": ObjectId,
  "userId": ObjectId("..."),
  "action": "UPDATE_INVENTORY",            // LOGIN | CREATE_REQUEST | UPDATE_INVENTORY | etc.
  "targetCollection": "bloodbanks",
  "targetDocumentId": ObjectId("..."),
  "previousValue": { "B_negative": { "units": 5 } },
  "newValue": { "B_negative": { "units": 1 } },
  "ipAddress": "111.68.x.x",
  "timestamp": ISODate("...")
}
```

---

## Security Architecture — Making It Impenetrable

### 1. JWT Authentication Middleware
Every protected route runs through this middleware before the controller executes:

```javascript
// middleware/auth.js
const jwt = require('jsonwebtoken');

const protect = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1]; // Bearer <token>
  if (!token) return res.status(401).json({ message: 'No token. Access denied.' });
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, role, associatedEntityId }
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
};
```

### 2. Role Authorization Middleware
```javascript
// middleware/authorize.js
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden. Insufficient privileges.' });
    }
    next();
  };
};

// Usage on a route:
// router.put('/inventory/:bankId', protect, authorize('blood_bank_admin', 'super_admin'), updateInventory);
```

### 3. Entity Ownership Guard
A blood bank admin must only be able to edit their own bank — not another bank's data:

```javascript
// Inside updateInventory controller
if (req.user.role === 'blood_bank_admin') {
  if (req.user.associatedEntityId.toString() !== req.params.bankId) {
    return res.status(403).json({ message: 'You can only manage your own blood bank.' });
  }
}
```

### 4. Input Sanitization
```javascript
// On every POST/PUT route — never trust incoming data
const { body, validationResult } = require('express-validator');

const inventoryValidator = [
  body('bloodType').isIn(['A_positive','A_negative','B_positive','B_negative',
                          'AB_positive','AB_negative','O_positive','O_negative']),
  body('units').isInt({ min: 0, max: 9999 }),
];
```

### 5. Rate Limiting (Prevents Brute Force)
```javascript
const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,                   // Max 10 login attempts per IP
  message: 'Too many login attempts. Try again in 15 minutes.'
});

app.use('/api/auth/login', authLimiter);
```

### 6. Security Checklist
- [ ] `helmet.js` — Sets secure HTTP headers automatically
- [ ] `cors` configured to allow only your frontend domain
- [ ] Passwords hashed with `bcryptjs` (salt rounds: 12)
- [ ] JWT secret is a 256-bit random string stored in `.env`, never in code
- [ ] `.env` is in `.gitignore` — never commit secrets
- [ ] MongoDB connection string stored in `.env`
- [ ] `mongoSanitize` — Prevents NoSQL injection attacks
- [ ] HTTPS only in production (MongoDB Atlas enforces this by default)

---

## Complete API Endpoint Map

### Auth Routes — `/api/auth`
| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/register` | Public | Register donor. Bank/hospital accounts created by super_admin only |
| POST | `/login` | Public | Returns JWT token |
| GET | `/me` | Authenticated | Returns logged-in user's profile |

### Blood Bank Routes — `/api/bloodbanks`
| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/` | Public | List all active blood banks in Karachi |
| GET | `/:id` | Public | Get one blood bank with full live inventory |
| GET | `/:id/inventory` | Public | Get only the inventory of a specific bank |
| PUT | `/:id/inventory` | blood_bank_admin, super_admin | Update inventory units for a blood type |
| POST | `/` | super_admin | Onboard a new blood bank |
| PATCH | `/:id/status` | super_admin | Activate or deactivate a bank |

### Blood Search Routes — `/api/blood`
| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/search?type=B_negative` | Public | Find all banks with available units of a type, sorted by quantity |
| GET | `/critical` | Public | List all blood types currently below alert threshold across all banks |
| GET | `/map` | Public | Return all banks with coordinates for Leaflet map rendering |

### Blood Request Routes — `/api/requests`
| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/` | Public | View all open hospital blood requests |
| GET | `/:id` | Public | View a specific request |
| POST | `/` | hospital_admin | Post a new blood request |
| PATCH | `/:id` | hospital_admin, super_admin | Update fulfilled units or urgency |
| DELETE | `/:id` | hospital_admin, super_admin | Close/cancel a request |

### Appointment Routes — `/api/appointments`
| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/` | donor | Book a donation appointment |
| GET | `/my` | donor | View own appointment history |
| GET | `/bank/:bankId` | blood_bank_admin | View all appointments for their bank |
| PATCH | `/:id/status` | blood_bank_admin | Confirm, complete, or mark no-show |

### Admin Routes — `/api/admin`
| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/users` | super_admin | List all users |
| POST | `/hospitals` | super_admin | Onboard a new hospital |
| GET | `/logs` | super_admin | View audit log |
| PATCH | `/users/:id/verify` | super_admin | Verify a blood bank or hospital account |

---

## Phase-by-Phase Implementation Roadmap

### Phase 0 — Project Setup (Day 1)

```
bloodbank-portal/
├── backend/
│   ├── config/          # db.js (MongoDB connection)
│   ├── controllers/     # Logic for each route
│   ├── middleware/      # auth.js, authorize.js, validate.js
│   ├── models/          # Mongoose schemas
│   ├── routes/          # Express route files
│   ├── seed/            # seed.js — dummy Karachi data
│   ├── utils/           # Helper functions
│   ├── .env             # Secrets (NEVER commit this)
│   ├── .gitignore
│   └── server.js        # Entry point
└── frontend/
    ├── assets/          # Images, icons
    ├── css/             # Custom CSS if any
    ├── js/              # api.js, auth.js, dashboard.js, map.js
    ├── index.html       # Landing page
    ├── login.html
    ├── register.html
    ├── donor-dashboard.html
    ├── bank-admin-dashboard.html
    ├── hospital-admin-dashboard.html
    └── super-admin-dashboard.html
```

**Install dependencies:**
```bash
npm init -y
npm install express mongoose bcryptjs jsonwebtoken dotenv cors helmet \
            express-rate-limit express-validator express-mongo-sanitize morgan
```

---

### Phase 1 — Database & Seeding (Days 1–2)

Write `seed.js` to populate your MongoDB Atlas instance with realistic Karachi data:

**Seed data targets:**
- 12–15 blood banks across Karachi (Indus-Korangi, Indus-Model Colony, Fatimid-Gulshan, Fatimid-North Nazimabad, Chhipa-Saddar, Edhi-Korangi, SIUT, Agha Khan, Ziauddin, etc.)
- 8 hospitals (CHK, JPMC, Liaquat National, Abbasi Shaheed, Aga Khan, South City, Ziauddin, National Medical Centre)
- Randomized inventory — ensure some critical shortages (B−, AB−, O−) to make the live dashboard interesting immediately
- 3–4 open hospital blood requests with varying urgency
- 5–10 dummy donor accounts

**Tip:** Use realistic GPS coordinates for all locations so your Leaflet map actually looks like Karachi.

---

### Phase 2 — Backend API (Days 3–7)

Build in this sequence. Each step is testable in Thunder Client or Postman before moving on.

1. `server.js` — Express app with all middleware wired up (helmet, cors, morgan, rate limiter)
2. `config/db.js` — MongoDB Atlas connection with Mongoose
3. All Mongoose models (users, bloodbanks, hospitals, bloodrequests, appointments, auditlogs)
4. Auth controller and routes (`/register`, `/login`, `/me`)
5. `middleware/auth.js` — JWT verification
6. `middleware/authorize.js` — Role guard
7. Blood bank controller and routes (public inventory GET, protected inventory PUT)
8. Blood search routes (the most publicly useful endpoints)
9. Blood request routes (hospital admin creates, public reads)
10. Appointment routes (donor books, bank admin manages)
11. Super admin routes

Test every single route before touching the frontend. This discipline will save you enormous debugging time later.

---

### Phase 3 — Frontend Pages (Days 8–14)

#### Landing Page (`index.html`)
- Hero section with a live stats bar: total units available citywide, number of critical shortages, open hospital requests — all fetched on page load via `fetch('/api/blood/critical')`
- Blood type quick-search bar (user picks blood type, sees results instantly)
- Karachi map (Leaflet) with markers for all blood banks, color-coded by urgency: green (adequate), yellow (low), red (critical), grey (out of stock)
- Marquee or notification strip showing the latest open hospital emergency requests
- Call-to-action: "Find Blood" and "Donate Now" buttons

#### Donor Dashboard (`donor-dashboard.html`)
- My blood type and eligibility status (has it been 3 months since last donation?)
- City-wide shortage map highlighting banks that need their specific blood type
- Appointment booking form (pick bank, pick date/time)
- Appointment history table

#### Blood Bank Admin Dashboard (`bank-admin-dashboard.html`)
- Inventory control panel — a live editable table of all 8 blood types with unit counts
- When an admin changes a number and clicks Save, a `PUT /api/bloodbanks/:id/inventory` fires via Fetch
- Upcoming appointments list — Confirm / Mark Complete / No Show buttons
- Stats panel: donations this month, most donated type, critical types

#### Hospital Admin Dashboard (`hospital-admin-dashboard.html`)
- Post new blood request form (blood type, units needed, urgency, ward/dept)
- My active requests list with real-time fulfilled unit count
- Close request button when need is met

#### Super Admin Dashboard (`super-admin-dashboard.html`)
- System-wide stats overview
- Manage Blood Banks table (activate/deactivate, edit details)
- Manage Hospitals table
- User management (view all, verify pending bank/hospital accounts)
- Audit log viewer (who changed what and when)

---

### Phase 4 — Real-Time Feel (Days 14–16)

Since this is a prototype (not using WebSockets), simulate real-time with polling:

```javascript
// On public landing page and donor dashboard
// Refresh critical shortage data every 60 seconds
setInterval(async () => {
  const res = await fetch('/api/blood/critical');
  const data = await res.json();
  renderCriticalAlerts(data); // Re-render the alert section without page reload
}, 60000);
```

For the bank admin inventory panel, fire an immediate `PUT` on every save — no polling needed since they are the source of truth.

**Optional enhancement:** Use **Server-Sent Events (SSE)** — a simpler alternative to WebSockets, built into Node.js — to push critical request notifications to active donor browser sessions. This is impressive for a prototype and not difficult to implement.

---

### Phase 5 — Polish & Submission Prep (Days 17–20)

- Add loading spinners on all async operations
- Add proper error messages: "No B− blood available in your area", "Your account is pending verification", etc.
- Mobile-responsive check on all pages — Tailwind makes this straightforward
- Record a demo video showing the full loop: hospital posts critical request → bank admin sees it → donor sees the shortage alert → books appointment → bank admin marks complete → inventory updates live
- Write a brief README documenting the architecture, how to run locally, and your seed script

---

## Karachi-Specific Dummy Data: Blood Banks to Seed

| Blood Bank | Area | Coordinates (approx.) |
|---|---|---|
| Indus Hospital Blood Bank | Korangi | 24.8294, 67.1232 |
| Indus Hospital Blood Bank | Model Colony | 24.8800, 67.1600 |
| Fatimid Foundation | Gulshan-e-Iqbal | 24.9150, 67.1050 |
| Fatimid Foundation | North Nazimabad | 24.9407, 67.0340 |
| Chhipa Welfare | Saddar | 24.8600, 67.0100 |
| Edhi Foundation | Korangi | 24.8350, 67.1300 |
| SIUT Blood Bank | Gulshan | 24.9100, 67.0900 |
| Aga Khan Hospital Blood Bank | Stadium Road | 24.8952, 67.0818 |
| Ziauddin Hospital | North Nazimabad | 24.9490, 67.0500 |
| Liaquat National Blood Bank | Gulshan | 24.9120, 67.0880 |
| Patel Hospital | Kardar | 24.8570, 67.0200 |
| National Institute of Blood Disease | Karachi Univ | 24.9310, 67.1100 |

---

## What This Project Demonstrates (For Your Evaluators)

From a DBMS course perspective, this prototype covers:

- Complex document schema design with embedded and referenced documents
- Role-Based Access Control implemented at both the API middleware and database query level
- Geospatial indexing (`2dsphere`) for proximity-based blood bank queries
- Aggregation pipeline usage for city-wide shortage analytics
- Audit logging for all privileged write operations
- Data integrity enforcement via Mongoose schema validation
- Proper normalization decisions (when to embed vs. reference in a document store)

This is not a toy CRUD app. The schema has real thought behind it. That will be evident to any evaluator who looks at the code.

---

## Final Honest Verdict

This idea has real-world value, it is technically non-trivial enough to be a serious project, and it solves a genuine gap in Karachi's public health infrastructure. The absence of such a system is the problem — you are building the solution.

The one thing that will determine whether it is excellent or merely good is **data quality in your seed script.** Make the dummy data feel real: have some banks with critical shortages, have a hospital posting an urgent O− request, have the map populated with correctly placed Karachi markers. A good demo is 50% real engineering and 50% compelling data. Both matter equally.

Build the backend first. Test every route before touching CSS. The frontend is easy once the API is solid.

---

*Stack Summary: Node.js · Express.js · MongoDB Atlas · Mongoose · JWT · bcryptjs · HTML · Tailwind CSS · Vanilla JS · Fetch API · Chart.js · Leaflet.js*
