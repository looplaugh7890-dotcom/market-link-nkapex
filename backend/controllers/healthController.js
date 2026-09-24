const mongoose = require('mongoose');

// Used by load balancers / uptime monitors: 200 only when MongoDB is connected.
const healthCheck = (req, res) => {
  const dbUp = mongoose.connection.readyState === 1;
  res.status(dbUp ? 200 : 503).json({
    success: dbUp,
    message: dbUp ? 'Server is healthy' : 'Database unavailable',
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
};

module.exports = { healthCheck };
