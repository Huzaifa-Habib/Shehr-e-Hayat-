# Karachi Blood Bank Portal — Complete Setup Guide
### From zero to a running, seeded database in one sitting

---

## Before You Start — What You Need

Make sure these are installed on your machine first. Open **Command Prompt** (Windows) or **Terminal** (Mac/Linux) and run each check:

```bash
node --version
```
✅ Should print something like `v20.x.x` or higher. If you get "not recognized", install Node.js from https://nodejs.org (download the **LTS** version).

```bash
npm --version
```
✅ Should print `10.x.x` or similar. npm comes bundled with Node — if Node installed, npm is there.

```bash
git --version
```
✅ Should print a version. If not, install from https://git-scm.com — needed for version control.

---

## PART 1 — Installing All Packages

### Step 1.1 — Open your project folder in terminal

Open **VS Code**, then go to `Terminal → New Terminal`. The terminal that opens is already inside your project. Or open your system terminal and navigate manually:

```bash
# Replace the path below with where YOUR project actually is
cd C:\Users\YourName\Projects\bloodbank-portal\backend      # Windows
cd /Users/yourname/Projects/bloodbank-portal/backend        # Mac/Linux
```

Confirm you're in the right place — you should see `package.json` when you run:

```bash
ls        # Mac/Linux
dir       # Windows
```

### Step 1.2 — Install all dependencies in one command

This single command reads your `package.json` and downloads every package the system needs:

```bash
npm install
```

You will see a progress bar and then output like:
```
added 147 packages in 12s
```

This creates the `node_modules/` folder. **Never commit this folder to git** — it is in your `.gitignore` already.

### What gets installed — full breakdown

| Package | What It Does |
|---|---|
| `express` | The web server framework that handles all API routes |
| `mongoose` | Connects Node.js to MongoDB and validates your schemas |
| `bcryptjs` | Hashes passwords so they are never stored in plain text |
| `jsonwebtoken` | Creates and verifies JWT tokens for authentication |
| `dotenv` | Loads your `.env` secret file into the app |
| `cors` | Lets your frontend HTML pages talk to this backend |
| `helmet` | Sets secure HTTP headers to protect against common attacks |
| `express-rate-limit` | Blocks brute-force login attacks (max 10 tries per 15 min) |
| `express-validator` | Validates and sanitizes all incoming request data |
| `express-mongo-sanitize` | Prevents NoSQL injection attacks |
| `morgan` | Logs every HTTP request in the terminal for debugging |
| `nodemon` *(dev only)* | Auto-restarts the server when you save a file |

### Step 1.3 — Verify installation succeeded

```bash
node -e "require('express'); require('mongoose'); require('bcryptjs'); console.log('All packages OK')"
```

✅ Output: `All packages OK` — you're good to go.

---

## PART 2 — MongoDB Atlas Setup (Full Baby-Step Guide)

MongoDB Atlas is the free cloud database you will use. You do not install anything locally — it runs on the internet and your app connects to it through a URL (called a connection string).

---

### Step 2.1 — Create a free MongoDB Atlas account

1. Open your browser and go to: **https://www.mongodb.com/cloud/atlas/register**
2. Fill in your name, email, and password — or sign up with Google
3. Click **Create your Atlas account**
4. Check your email and verify your address
5. You will be taken to a "Tell us about yourself" survey — just fill it in (pick "Student" and "Learning MongoDB")

---

### Step 2.2 — Create your free cluster

After signing in you will see the Atlas dashboard. A **cluster** is where your database actually lives.

1. Click the big green button **"Create"** (or "Build a Database")

2. On the plan selection screen, choose **M0 — FREE** (it says "Shared", "512 MB storage", "Free forever"). Do NOT pick M2 or M5 — those cost money.

3. Under **Cloud Provider & Region**, select:
   - Provider: **AWS**
   - Region: pick the one closest to you. For Pakistan, choose **Mumbai (ap-south-1)** for lowest latency.

4. Under **Cluster Name**, change the default `Cluster0` to something meaningful:
   ```
   karachi-bloodbank
   ```

5. Click **"Create Deployment"** (or "Create Cluster"). It will take about 1–3 minutes to spin up. A progress bar will show.

---

### Step 2.3 — Create a database user

While the cluster is creating, Atlas will show you a **"Security Quickstart"** popup (or you can find this at **Security → Database Access** in the left sidebar).

This is the username and password your Node.js app will use to log into the database. **This is NOT your Atlas account password — it is a separate database user.**

1. Make sure **"Username and Password"** is selected as the authentication method

2. Enter a username. Use something simple and memorable:
   ```
   bloodbank_admin
   ```

3. For the password, click **"Autogenerate Secure Password"** — Atlas will create a strong random password. **Copy this password immediately and save it somewhere safe** (Notepad, Notes app, anywhere). You will need it in Step 2.6.

   Alternatively, type your own password. Rules: no `@`, no `#`, no `/`, no special characters that break URLs. A safe format:
   ```
   BloodBank2026Karachi
   ```

4. Under "Database User Privileges", keep the default: **"Atlas admin"** or **"Read and write to any database"**

5. Click **"Add User"** (or "Create User")

---

### Step 2.4 — Whitelist your IP address

Atlas blocks all connections by default. You must tell it which IP addresses are allowed to connect.

1. In the Security Quickstart (or go to **Security → Network Access** in the left sidebar)

2. Click **"Add IP Address"**

3. You will see two options:
   - **"Add Current IP Address"** — adds only your current internet IP (more secure, but breaks if your ISP changes your IP, which happens often in Pakistan on mobile connections)
   - **"Allow Access from Anywhere"** — sets `0.0.0.0/0` which allows all IPs (fine for development/prototype, not for production)

4. **For this project (development/prototype), click "Allow Access from Anywhere"** — this removes connection headaches while you're building and testing.

   > ⚠️ Note: For a real production system you would whitelist specific IPs only. For a university prototype, "Allow Anywhere" is completely fine.

5. Add a description like `Development - All IPs`

6. Click **"Confirm"**

---

### Step 2.5 — Get your connection string

1. Go back to **Database** in the left sidebar (or click the cluster name `karachi-bloodbank`)

2. Click the green **"Connect"** button

3. A popup appears with several connection options. Choose **"Drivers"** (the option that shows code/SDK)

4. Make sure:
   - Driver is set to **Node.js**
   - Version is set to **5.5 or later**

5. You will see a connection string that looks like this:
   ```
   mongodb+srv://bloodbank_admin:<password>@karachi-bloodbank.xxxxx.mongodb.net/?retryWrites=true&w=majority&appName=karachi-bloodbank
   ```

6. **Copy this entire string** — you need it in the next step.

---

### Step 2.6 — Create your `.env` file

Your project has an `env.example` file. You need to make a real `.env` from it.

**In VS Code terminal:**

```bash
# Make sure you're inside the backend/ folder, then run:
copy env.example .env      # Windows Command Prompt
cp env.example .env        # Mac/Linux or Windows PowerShell
```

Now open `.env` in VS Code and fill it in. Here is exactly what it should look like — replace every `<placeholder>` with your actual values:

```env
# MongoDB Atlas Connection String
# Take the string from Step 2.5, then replace <password> with your actual database password from Step 2.3
# Also add the database name (karachi-bloodbank) before the ? 
MONGODB_URI=mongodb+srv://bloodbank_admin:BloodBank2026Karachi@karachi-bloodbank.xxxxx.mongodb.net/karachi-bloodbank?retryWrites=true&w=majority&appName=karachi-bloodbank

# JWT Secret — run this command to generate one, then paste the output here:
# node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=paste_the_long_hex_string_here

JWT_EXPIRES_IN=7d

PORT=5000
NODE_ENV=development

# Your frontend will open on port 5500 (VS Code Live Server default)
CORS_ORIGIN=http://localhost:5500

# Password that seed.js will assign to all dummy accounts
SEED_DEFAULT_PASSWORD=Karachi@1234
```

### Critical: Fix your connection string

The string Atlas gives you looks like this:
```
mongodb+srv://bloodbank_admin:<password>@karachi-bloodbank.xxxxx.mongodb.net/?retryWrites=true...
```

You need to make **two changes**:

1. Replace `<password>` with your actual password (the one from Step 2.3). Remove the `< >` angle brackets too.
2. Add your database name between `.net/` and `?` — insert `karachi-bloodbank` there.

**Before (raw Atlas string):**
```
mongodb+srv://bloodbank_admin:<password>@karachi-bloodbank.abc123.mongodb.net/?retryWrites=true&w=majority
```

**After (correct .env value):**
```
mongodb+srv://bloodbank_admin:BloodBank2026Karachi@karachi-bloodbank.abc123.mongodb.net/karachi-bloodbank?retryWrites=true&w=majority
```

> ⚠️ If your password contains special characters like `@`, `#`, `/`, or `%`, it will break the URL. Either choose a password without them, or URL-encode them (e.g., `@` becomes `%40`). The safest move: regenerate the password in Atlas to contain only letters and numbers.

---

### Step 2.7 — Generate your JWT secret

Open your VS Code terminal (still inside `backend/`) and run:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

You will get a long random string like:
```
a3f9b2e1c847d6....(128 characters total)
```

Copy that entire output and paste it as the value for `JWT_SECRET` in your `.env` file.

---

### Step 2.8 — Test the database connection

Before running the seed, verify the connection works with this quick test:

```bash
node -e "
require('dotenv').config();
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URI)
  .then(() => { console.log('SUCCESS: Connected to MongoDB Atlas'); process.exit(0); })
  .catch(err => { console.error('FAILED:', err.message); process.exit(1); });
"
```

**If you see:**
```
SUCCESS: Connected to MongoDB Atlas
```
✅ Your connection string is correct. Move to Step 2.9.

**If you see an error, here are the most common causes:**

| Error Message | What's Wrong | Fix |
|---|---|---|
| `bad auth: Authentication failed` | Wrong password in connection string | Go back to Atlas → Security → Database Access, reset the password, update .env |
| `connection timed out` or `ETIMEDOUT` | IP not whitelisted | Go to Atlas → Security → Network Access, add your IP or use 0.0.0.0/0 |
| `getaddrinfo ENOTFOUND` | Cluster name in URI is wrong | Re-copy the connection string from Atlas → Connect |
| `MongoParseError: URI malformed` | Special character in password breaking the URL | Change password to letters/numbers only |
| `Cannot find module 'dotenv'` | You're not inside the backend/ folder | `cd backend` then retry |

---

### Step 2.9 — Run the seed script

This populates your entire database with realistic Karachi dummy data in one command:

```bash
npm run seed
```

This runs `node seed/seed.js`. Watch the terminal output — it will log progress like:

```
🌱 Starting Karachi Blood Bank Portal seed...
✅ Connected to MongoDB: karachi-bloodbank.abc123.mongodb.net
🗑  Dropping existing collections...
🏥 Seeding 12 blood banks...
🏨 Seeding 8 hospitals...
👤 Seeding users (1 super admin + 12 bank admins + 8 hospital admins + 8 donors)...
🩸 Seeding 4 blood requests...
📅 Seeding 5 appointments...
📋 Writing audit log...
✅ Seed complete! Database is ready.
📊 Summary:
   Blood Banks : 12
   Hospitals   : 8
   Users       : 29
   Requests    : 4
   Appointments: 5
```

If you see `✅ Seed complete!` — your database is fully populated and ready.

---

### Step 2.10 — Verify data in Atlas

1. Go back to **https://cloud.mongodb.com**
2. Click **"Browse Collections"** on your `karachi-bloodbank` cluster
3. You should see a database called `karachi-bloodbank` with these collections:
   - `users` — 29 documents
   - `bloodbanks` — 12 documents
   - `hospitals` — 8 documents
   - `bloodrequests` — 4 documents
   - `appointments` — 5 documents
   - `auditlogs` — 1 document

4. Click into `bloodbanks` and browse a document — you should see real Karachi blood bank data with GPS coordinates and inventory.

---

## PART 3 — Seeded Account Credentials

All seeded accounts use the password from your `.env`:
```
SEED_DEFAULT_PASSWORD=Karachi@1234
```

### Super Admin
```
Email    : admin@bloodbank.karachi
Password : Karachi@1234
Role     : super_admin
```

### Blood Bank Admin Examples
```
Email    : admin@induskorangi.org        → Indus Hospital Blood Bank (Korangi)
Email    : admin@fatimidgulshan.org      → Fatimid Foundation (Gulshan)
Email    : admin@akhbloodbank.org        → Aga Khan Hospital Blood Bank
Password : Karachi@1234 (all of them)
```

### Hospital Admin Examples
```
Email    : admin@civilhospital.gov.pk   → Civil Hospital Karachi
Email    : admin@jpmc.gov.pk            → JPMC
Email    : admin@liaquatnational.pk     → Liaquat National Hospital
Password : Karachi@1234 (all of them)
```

### Donor Examples
```
Email    : ahmed.raza@gmail.com         → Blood type: O_positive
Email    : fatima.malik@gmail.com       → Blood type: B_negative
Email    : hassan.siddiqui@gmail.com    → Blood type: AB_negative
Password : Karachi@1234 (all of them)
```

---

## PART 4 — Daily Development Commands

Once setup is complete, here are the only commands you need day-to-day:

### Start the development server (with auto-restart)
```bash
npm run dev
```
The server runs at `http://localhost:5000`. Every time you save a `.js` file, nodemon restarts automatically.

### Start the server without auto-restart
```bash
npm start
```

### Re-seed the database (wipes everything and starts fresh)
```bash
npm run seed
```
or the explicit alias:
```bash
npm run seed:fresh
```
> ⚠️ This **deletes all existing data** and re-inserts the dummy data. Use this whenever you want a clean slate during development.

### Test a specific API endpoint (install Thunder Client extension in VS Code — it's the free alternative to Postman built right into VS Code)
Once the server is running, you can send requests to:
```
GET  http://localhost:5000/api/bloodbanks
POST http://localhost:5000/api/auth/login
```

---

## PART 5 — Troubleshooting Checklist

Run through this list if something doesn't work:

```
□ Is the terminal pointed at backend/ folder? Run: ls — you should see package.json
□ Does .env exist? (not env.example — the actual .env file)
□ Is MONGODB_URI filled in with your real cluster URL?
□ Did you replace <password> in the connection string?
□ Did you add the database name (karachi-bloodbank) before the ?
□ Is your IP whitelisted in Atlas? (or using 0.0.0.0/0 for dev)
□ Is node_modules/ present? If not, run: npm install
□ Is your Atlas cluster in "Active" state? (check the Atlas dashboard)
□ Does JWT_SECRET have a value? (cannot be empty)
```

---

## Quick Reference Card

```
Project folder structure (what you should have):
backend/
├── config/
│   └── db.js
├── models/
│   ├── User.js
│   ├── BloodBank.js
│   ├── Hospital.js
│   ├── BloodRequest.js
│   ├── Appointment.js
│   └── AuditLog.js
├── seed/
│   └── seed.js
├── .env              ← YOU CREATE THIS (copy from env.example)
├── .env.example      ← template, already exists
├── .gitignore        ← already exists
└── package.json      ← already exists

Commands summary:
  npm install         ← install all packages (do once)
  npm run dev         ← start server with auto-reload (daily use)
  npm run seed        ← wipe DB and re-seed dummy data
  npm start           ← start server without auto-reload
```

---

*Next phase: Phase 2 — building the full Express server and all API routes.*
