const mongoose = require('mongoose');

const { Schema } = mongoose;

const ORDER_STATUSES = ['placed', 'accepted', 'declined', 'ready', 'completed', 'cancelled'];

const orderSchema = new Schema(
  {
    customer: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    farmer: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    market: { type: Schema.Types.ObjectId, ref: 'Market' },
    items: [
      {
        _id: false,
        product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
        // Snapshot at order time so later price edits don't rewrite history.
        name: String,
        unit: String,
        price: Number,
        quantity: { type: Number, required: true, min: 1 },
      },
    ],
    totalAmount: { type: Number, required: true, min: 0 },
    pickupDate: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    pickupSlot: {
      start: { type: String, required: true },
      end: { type: String, required: true },
    },
    notes: { type: String, trim: true, maxlength: 500 },
    status: { type: String, enum: ORDER_STATUSES, default: 'placed', index: true },
    statusHistory: [{ _id: false, status: String, at: { type: Date, default: Date.now } }],
  },
  { timestamps: true }
);

orderSchema.methods.setStatus = function (status) {
  this.status = status;
  this.statusHistory.push({ status });
};

orderSchema.statics.STATUSES = ORDER_STATUSES;

// "My orders" pages: newest first per customer / farmer, and the farmer's pending queue.
orderSchema.index({ customer: 1, createdAt: -1 });
orderSchema.index({ farmer: 1, createdAt: -1 });
orderSchema.index({ farmer: 1, status: 1 });

module.exports = mongoose.model('Order', orderSchema);
