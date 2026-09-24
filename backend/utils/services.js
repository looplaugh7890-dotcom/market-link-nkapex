const cache = require('./cache');
const User = require('../models/User');
const Notification = require('../models/Notification');
const Review = require('../models/Review');
const Product = require('../models/Product');
const { cleanString, withinKm } = require('./helpers');

const notify = (userId, title, message, type = 'order', link) =>
  Notification.create({ user: userId, title, message, type, link });

const notifyMany = (userIds, title, message, type, link) =>
  userIds.length
    ? Notification.insertMany(userIds.map((user) => ({ user, title, message, type, link })))
    : Promise.resolve();

// Base filter for farmers who may appear publicly.
const publicFarmerFilter = () => ({
  role: 'farmer',
  isActive: true,
  'farmerProfile.approvalStatus': 'approved',
});

// Build a farmer filter from ?market=&day=&lat=&lng=&radius=&search=
const farmerFilterFromQuery = (query) => {
  const filter = publicFarmerFilter();
  if (cleanString(query.market)) filter['farmerProfile.markets'] = cleanString(query.market);
  if (cleanString(query.day)) filter['farmerProfile.operatingDays'] = cleanString(query.day).toLowerCase();
  if (cleanString(query.lat) && cleanString(query.lng)) {
    filter['farmerProfile.geo'] = withinKm(query.lat, query.lng, query.radius || 10);
  }
  return filter;
};

// Cached for 30s (single-flight): every product listing needs this set, so do not query it per request.
// Call invalidateFarmers() whenever a farmer's approval, markets or days change.
const approvedFarmerIds = (filter) => cache.cached(`farmers:ids:${JSON.stringify(filter)}`, 30_000, () => User.find(filter).distinct('_id'));
const invalidateFarmers = () => cache.clear('farmers:');

// Recompute rating aggregates after a review is added/removed.
const recalcRatings = async ({ farmer, product }) => {
  if (farmer) {
    const [stats] = await Review.aggregate([
      { $match: { farmer, targetType: 'farmer' } },
      { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
    ]);
    await User.updateOne(
      { _id: farmer },
      {
        'farmerProfile.ratingAvg': stats ? Math.round(stats.avg * 10) / 10 : 0,
        'farmerProfile.ratingCount': stats ? stats.count : 0,
      }
    );
  }
  if (product) {
    const [stats] = await Review.aggregate([
      { $match: { product, targetType: 'product' } },
      { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
    ]);
    await Product.updateOne(
      { _id: product },
      { ratingAvg: stats ? Math.round(stats.avg * 10) / 10 : 0, ratingCount: stats ? stats.count : 0 }
    );
  }
};

// Tell customers who favorited a product that it's back in stock.
const notifyRestock = async (product) => {
  const users = await User.find({ 'favorites.products': product._id, isActive: true }).distinct('_id');
  await notifyMany(
    users,
    'Back in stock',
    `${product.name} is available again.`,
    'restock',
    `/products/${product._id}`
  );
};

module.exports = {
  notify,
  notifyMany,
  publicFarmerFilter,
  farmerFilterFromQuery,
  approvedFarmerIds,
  invalidateFarmers,
  recalcRatings,
  notifyRestock,
};
