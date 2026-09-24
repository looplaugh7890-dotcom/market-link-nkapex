const Review = require('../models/Review');
const Order = require('../models/Order');
const { AppError, cleanString, getPagination, requireFields } = require('../utils/helpers');
const { recalcRatings, notify } = require('../utils/services');
const { audit } = require('../utils/audit');

// POST /api/reviews { order, product?, rating, comment }
// Omit product to review the farmer. Only after the order is completed.
const createReview = async (req, res) => {
  requireFields(req.body, ['order', 'rating']);
  const rating = Number(req.body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new AppError('rating must be 1-5', 400);

  const order = await Order.findById(req.body.order);
  if (!order || !order.customer.equals(req.user._id)) throw new AppError('Order not found', 404);
  if (order.status !== 'completed') throw new AppError('You can review only completed orders', 400);

  const product = cleanString(req.body.product);
  if (product && !order.items.some((item) => item.product.equals(product))) {
    throw new AppError('That product is not part of this order', 400);
  }

  const review = await Review.create({
    customer: req.user._id,
    order: order._id,
    farmer: order.farmer,
    product: product || undefined,
    targetType: product ? 'product' : 'farmer',
    rating,
    comment: cleanString(req.body.comment),
  });
  await recalcRatings({ farmer: order.farmer, product: product && review.product });
  await notify(order.farmer, 'New review', `You received a ${rating}-star review.`, 'review');
  res.status(201).json({ success: true, review });
};

// GET /api/reviews?farmer=&product=
const listReviews = async (req, res) => {
  const filter = {};
  if (cleanString(req.query.farmer)) filter.farmer = cleanString(req.query.farmer);
  if (cleanString(req.query.product)) filter.product = cleanString(req.query.product);
  if (!filter.farmer && !filter.product) throw new AppError('Provide ?farmer= or ?product=', 400);
  const { page, limit, skip } = getPagination(req);
  const [reviews, total] = await Promise.all([
    Review.find(filter).populate('customer', 'name').sort('-createdAt').skip(skip).limit(limit),
    Review.countDocuments(filter),
  ]);
  res.json({ success: true, total, page, reviews });
};

// GET /api/reviews/order/:orderId — the logged-in customer's reviews for one order.
const orderReviews = async (req, res) => {
  const reviews = await Review.find({ order: req.params.orderId, customer: req.user._id });
  res.json({ success: true, reviews });
};

// Farmer's inbox of reviews about them.
const myReviews = async (req, res) => {
  const reviews = await Review.find({ farmer: req.user._id })
    .populate('customer', 'name')
    .populate('product', 'name')
    .sort('-createdAt');
  res.json({ success: true, reviews });
};

// PUT /api/reviews/:id/reply { text }
const replyToReview = async (req, res) => {
  const review = await Review.findById(req.params.id);
  if (!review || !review.farmer.equals(req.user._id)) throw new AppError('Review not found', 404);
  if (!cleanString(req.body.text)) throw new AppError('Reply text is required', 400);
  review.reply = { text: cleanString(req.body.text), at: new Date() };
  await review.save();
  res.json({ success: true, review });
};

// Customer removes own review; admin may remove any (moderation).
const deleteReview = async (req, res) => {
  const review = await Review.findById(req.params.id);
  if (!review) throw new AppError('Review not found', 404);
  if (req.user.role !== 'admin' && !review.customer.equals(req.user._id)) throw new AppError('Not your review', 403);
  await review.deleteOne();
  await recalcRatings({ farmer: review.farmer, product: review.product });
  if (req.user.role === 'admin') audit(req, 'review.remove', `Removed a ${review.rating}-star review`, { type: 'review', id: review._id });
  res.json({ success: true, message: 'Review removed' });
};

module.exports = { orderReviews, createReview, listReviews, myReviews, replyToReview, deleteReview };
