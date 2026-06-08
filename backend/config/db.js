'use strict';

const mongoose = require('mongoose');

/**
 * Connect to MongoDB Atlas.
 * Exits the process on failure — this is intentional for server startup.
 * For seed scripts, the script itself handles the disconnect.
 */
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      // Mongoose 8.x defaults are sensible; these are explicitly documented here
      // for production visibility.
      serverSelectionTimeoutMS: 10000, // Fail fast if Atlas is unreachable
      socketTimeoutMS:          45000, // Close idle sockets after 45s
    });

    console.log(`✅  MongoDB Atlas connected → ${conn.connection.host}`);

    // Log connection events for debugging in production
    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️   MongoDB disconnected. Attempting to reconnect...');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('🔄  MongoDB reconnected.');
    });

    mongoose.connection.on('error', (err) => {
      console.error('❌  MongoDB runtime error:', err.message);
    });

    return conn;
  } catch (error) {
    console.error('❌  MongoDB initial connection failed:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;