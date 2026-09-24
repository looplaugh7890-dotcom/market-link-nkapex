require('dotenv').config();
const mongoose = require('mongoose');

// Scripts and the standalone server want the process to stop when MongoDB is unreachable;
// serverless callers pass { exitOnFail: false } so the error surfaces as a failed request instead.
const connectDB = async ({ exitOnFail = true } = {}) => {
  try {
    // MONGO_DB_NAME keeps this app in its own database when the cluster is shared with other projects.
    const options = {
      ...(process.env.MONGO_DB_NAME ? { dbName: process.env.MONGO_DB_NAME } : {}),
      // Connection pool sized for many concurrent requests; fail fast instead of hanging when the DB is down.
      maxPoolSize: Number(process.env.MONGO_POOL_SIZE) || 50,
      minPoolSize: 5,
      serverSelectionTimeoutMS: 8000,
      socketTimeoutMS: 45000,
      // In production create indexes with `npm run db:init` once, not on every boot of every instance.
      autoIndex: process.env.NODE_ENV !== 'production',
    };
    const conn = await mongoose.connect(process.env.MONGO_URI, options);
    console.log(`MongoDB connected: ${conn.connection.host} (database: ${conn.connection.name})`);
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
    if (exitOnFail) process.exit(1);
    throw error;
  }
};

module.exports = connectDB;
