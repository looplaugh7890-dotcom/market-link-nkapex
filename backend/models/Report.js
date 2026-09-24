const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema(
  {
    generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reportType: { type: String, enum: ['summary', 'revenue_by_market', 'active_farmers', 'top_products'], required: true },
    data: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  { timestamps: { createdAt: 'generatedAt', updatedAt: false } }
);

module.exports = mongoose.model('Report', reportSchema);
