const User = require('../models/User');
const Product = require('../models/Product');
const Market = require('../models/Market');
const Notification = require('../models/Notification');
const { AppError, getPagination } = require('../utils/helpers');

const TYPES = {
  farmers: (id) => User.exists({ _id: id, role: 'farmer' }),
  products: (id) => Product.exists({ _id: id }),
  markets: (id) => Market.exists({ _id: id }),
};

const getFavorites = async (req, res) => {
  const user = await User.findById(req.user._id)
    .populate('favorites.farmers', 'farmerProfile.stallName farmerProfile.location')
    .populate('favorites.products', 'name price unit quantityAvailable available image farmer')
    .populate('favorites.markets', 'name address latitude longitude mapLink operatingDays openTime closeTime');
  res.json({ success: true, favorites: user.favorites });
};

// PUT /api/customer/favorites/:type/:id   (type = farmers | products | markets)
const addFavorite = async (req, res) => {
  const { type, id } = req.params;
  if (!TYPES[type]) throw new AppError('type must be farmers, products or markets', 400);
  if (!(await TYPES[type](id))) throw new AppError('Item not found', 404);
  await User.updateOne({ _id: req.user._id }, { $addToSet: { [`favorites.${type}`]: id } });
  res.json({ success: true, message: 'Added to favorites' });
};

const removeFavorite = async (req, res) => {
  const { type, id } = req.params;
  if (!TYPES[type]) throw new AppError('type must be farmers, products or markets', 400);
  await User.updateOne({ _id: req.user._id }, { $pull: { [`favorites.${type}`]: id } });
  res.json({ success: true, message: 'Removed from favorites' });
};

// ---- notifications (all roles) ----

const listNotifications = async (req, res) => {
  const { page, limit, skip } = getPagination(req);
  const filter = { user: req.user._id };
  const [notifications, total, unread] = await Promise.all([
    Notification.find(filter).sort('-createdAt').skip(skip).limit(limit),
    Notification.countDocuments(filter),
    Notification.countDocuments({ ...filter, read: false }),
  ]);
  res.json({ success: true, total, unread, notifications });
};

const markRead = async (req, res) => {
  const notification = await Notification.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, { read: true }, { new: true });
  if (!notification) throw new AppError('Notification not found', 404);
  res.json({ success: true, notification });
};

const markAllRead = async (req, res) => {
  await Notification.updateMany({ user: req.user._id, read: false }, { read: true });
  res.json({ success: true });
};

module.exports = { getFavorites, addFavorite, removeFavorite, listNotifications, markRead, markAllRead };
