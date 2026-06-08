/**
 * server.js — Core Application Entry Point
 * Centralized Blood Bank Portal for Karachi
 *
 * Implements industry-standard security practices:
 * - Helmet for HTTP security headers
 * - Controlled CORS configuration via environment variables
 * - Express Rate Limiting to prevent DoS/brute force
 * - NoSQL Injection protection via express-mongo-sanitize
 * - Payload size limit restrictions
 * - Production-ready logging with Morgan
 * - Graceful shutdown and system signal handling
 * - Robust uncaught exception and unhandled rejection tracking
 */

'use strict';

// 1. Load Environment Variables
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoSanitize = require('express-mongo-sanitize');
const { rateLimit } = require('express-rate-limit');
const connectDB = require('./config/db');

// Initialize Express
const app = express();
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Define DB Connection holder
let server;

// 2. Connect to Database
connectDB().catch((err) => {
  console.error('❌ Database connection failed at startup:', err.message);
  // Do NOT call process.exit(1) — it permanently kills the Vercel function
});

// Only start the HTTP listener in local dev
if (process.env.NODE_ENV !== 'production') {
  const server = app.listen(PORT, () => {
    console.log(`🚀 Server running in [${NODE_ENV}] mode on port ${PORT}`);
  });
}

// 4. Security & Request Parsing Middlewares

// Enable "trust proxy" if running behind a reverse proxy (e.g. Nginx, PM2, Heroku, Cloudflare)
// to accurately capture client IP addresses for rate limiting and logging.
app.set('trust proxy', 1);

// Hide Express fingerprinting header
app.disable('x-powered-by');

// Use Helmet to set secure HTTP headers (protects against XSS, clickjacking, etc.)
// Configure CSP to allow CDN resources used by the frontend (Tailwind, Leaflet, Google Fonts, Lucide)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "'unsafe-eval'",
          "https://cdn.tailwindcss.com",
          "https://unpkg.com",
        ],
        scriptSrcAttr: ["'unsafe-inline'"],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://fonts.googleapis.com",
          "https://unpkg.com",
        ],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: [
          "'self'",
          "data:",
          "https://*.tile.openstreetmap.org",
          "https://unpkg.com",
          "https://*.cartodb.com",
          "https://*.cartocdn.com",
        ],
        connectSrc: ["'self'"],
      },
    },
  })
);

// Configure CORS with explicit origin checks
// Configure CORS with dynamic multi-origin tracking
const allowedOrigins = [
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:3000',
  'https://shehr-e-hayat.vercel.app'
];

// Push environment-specific origin if configured via dashboard
if (process.env.CORS_ORIGIN) {
  allowedOrigins.push(process.env.CORS_ORIGIN);
}

app.use(
  cors({
    origin: (origin, callback) => {
      // 1. Allow internal requests, same-origin, or local dev tracking flags
      if (!origin || NODE_ENV === 'development') {
        return callback(null, true);
      }
      
      // 2. Grant access if matching verified origins or Vercel preview deployment extensions
      if (allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
        return callback(null, true);
      }
      
      return callback(new Error('Blocked by CORS policy: origin not allowed.'), false);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true,
  })
);

// Morgan HTTP request logging (JSON-like structure in production, simple dev logs in local)
if (NODE_ENV === 'production') {
  app.use(morgan(':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" - :response-time ms'));
} else {
  app.use(morgan('dev'));
}

// Request payload size limiting to prevent Denial of Service (DoS) attacks
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Sanitize user inputs to prevent MongoDB Operator Injection (NoSQL Injection)
app.use(mongoSanitize());

// Global Rate Limiting (100 requests per 15 minutes per IP address)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Limit each IP to 500 requests per `window` (frontend loads trigger multiple API calls)
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: {
    status: 429,
    message: 'Too many requests from this IP. Please try again after 15 minutes.',
  },
});
app.use('/api/', globalLimiter);

// 5. Health Check Endpoint
app.get('/health', async (req, res) => {
  const mongoose = require('mongoose');
  const dbStatus = mongoose.connection.readyState === 1 ? 'UP' : 'DOWN';
  
  const status = {
    status: 'UP',
    database: dbStatus,
    timestamp: new Date(),
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
  };

  if (dbStatus === 'UP') {
    return res.status(200).json(status);
  } else {
    return res.status(503).json({
      ...status,
      status: 'DOWN',
      message: 'Database is disconnected',
    });
  }
});

// 6. API Routing
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/bloodbanks', require('./routes/bloodBankRoutes'));
app.use('/api/blood', require('./routes/bloodSearchRoutes'));
app.use('/api/requests', require('./routes/bloodRequestRoutes'));
app.use('/api/appointments', require('./routes/appointmentRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));

// Serve Static Frontend Files
app.use(express.static(path.join(__dirname, '../frontend')));

// Serve index.html for root path (SPA-like entry point)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// 7. Global 404 Route (Resource not found)
app.use((req, res, next) => {
  res.status(404).json({
    status: 404,
    message: `Resource not found: ${req.originalUrl}`,
  });
});

// 8. Global Centralized Error Handling Middleware (Prevents leaking stack traces in production)
app.use((err, req, res, next) => {
  console.error(`💥 Error handler caught: ${err.message}`);
  
  // Custom response structure
  const statusCode = err.statusCode || 500;
  const message = err.message || 'An unexpected error occurred on the server.';
  
  res.status(statusCode).json({
    success: false,
    status: statusCode,
    message: message,
    // Provide stack trace ONLY in development mode
    stack: NODE_ENV === 'development' ? err.stack : undefined,
  });
});

// 9. Graceful Shutdown & Process Failure Listeners
const gracefulShutdown = (signal) => {
  console.log(`\n🛑 Received ${signal}. Initiating graceful shutdown...`);
  
  if (server) {
    server.close(async () => {
      console.log('🚪 Express HTTP server closed.');
      
      const mongoose = require('mongoose');
      try {
        await mongoose.connection.close(false);
        console.log('🔌 MongoDB Atlas connection closed safely.');
        process.exit(0);
      } catch (err) {
        console.error('❌ Error during MongoDB connection close:', err.message);
        process.exit(1);
      }
    });
  } else {
    process.exit(0);
  }
};

// Listen for termination and interrupt signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Listen for uncaught exceptions and unhandled promise rejections
process.on('uncaughtException', (err) => {
  console.error('💥 UNCAUGHT EXCEPTION! Shutting down server...');
  console.error(err.name, err.message);
  console.error(err.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 UNHANDLED REJECTION! Shutting down server...');
  console.error('Reason:', reason);
  process.exit(1);
});



module.exports = app; // Export app for testing purposes (e.g. with Jest/Supertest)