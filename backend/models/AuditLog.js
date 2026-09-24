const mongoose = require('mongoose');

// One row per admin action: who did what, to whom, when. Read-only from the UI; never edited.
const auditLogSchema = new mongoose.Schema(
  {
    admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    adminName: { type: String, required: true },
    action: { type: String, required: true, index: true }, // e.g. farmer.approve, user.deactivate, review.remove
    targetType: { type: String }, // user | farmer | market | category | product | review | announcement | report
    targetId: { type: String },
    summary: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
auditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
