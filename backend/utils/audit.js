const AuditLog = require('../models/AuditLog');

// Fire-and-forget: a failure to write the log must never break the admin action itself.
const audit = (req, action, summary, target = {}) =>
  AuditLog.create({ admin: req.user._id, adminName: req.user.name, action, summary, targetType: target.type, targetId: target.id ? String(target.id) : undefined }).catch((error) =>
    console.error('audit log failed:', error.message)
  );

module.exports = { audit };
