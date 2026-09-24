const mongoose = require('mongoose');

const { Schema } = mongoose;

const reviewSchema = new Schema(
  {
    customer: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    order: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
    farmer: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    product: { type: Schema.Types.ObjectId, ref: 'Product', index: true },
    targetType: { type: String, enum: ['farmer', 'product'], required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, trim: true, maxlength: 1000 },
    reply: {
      text: { type: String, trim: true, maxlength: 1000 },
      at: Date,
    },
  },
  { timestamps: true }
);

// One review per customer per order per target (farmer reviews have no product).
reviewSchema.index({ customer: 1, order: 1, targetType: 1, product: 1 }, { unique: true });
reviewSchema.index({ product: 1, createdAt: -1 });
reviewSchema.index({ farmer: 1, createdAt: -1 });

module.exports = mongoose.model('Review', reviewSchema);
