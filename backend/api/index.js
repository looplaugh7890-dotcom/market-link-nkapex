// Vercel serverless entry: every request is routed here (see vercel.json).
const app = require('../server');
const connectDB = require('../config/db');

// Connect once per warm function instance and reuse the connection for later requests.
let connection;
const ensureConnected = () => {
  if (!connection) connection = connectDB({ exitOnFail: false }).catch((error) => {
    connection = undefined; // try again on the next request
    throw error;
  });
  return connection;
};

module.exports = async (req, res) => {
  try {
    await ensureConnected();
  } catch {
    return res.status(503).json({ success: false, message: 'Database unavailable, please try again.' });
  }
  return app(req, res);
};
