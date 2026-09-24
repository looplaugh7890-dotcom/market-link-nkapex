const Market = require('../models/Market');
const User = require('../models/User');
const { AppError, cleanString, escapeRegex, getPagination, requireFields, withinKm, DAYS, byIdOrSlug } = require('../utils/helpers');
const { publicFarmerFilter } = require('../utils/services');
const { audit } = require('../utils/audit');
const cache = require('../utils/cache');

// GET /api/markets?day=saturday&search=&lat=&lng=&radius=10
const listMarkets = async (req, res) => {
  const filter = { isActive: true };
  if (cleanString(req.query.day)) filter.operatingDays = cleanString(req.query.day).toLowerCase();
  if (cleanString(req.query.search)) filter.name = new RegExp(escapeRegex(cleanString(req.query.search)), 'i');
  if (cleanString(req.query.lat) && cleanString(req.query.lng)) {
    filter.geo = withinKm(req.query.lat, req.query.lng, req.query.radius || 10);
  }
  const { page, limit, skip } = getPagination(req);
  const [markets, total] = await Promise.all([
    Market.find(filter).sort('name').skip(skip).limit(limit),
    Market.countDocuments(filter),
  ]);
  res.json({ success: true, total, page, markets });
};

// Market details + the farmers present there.
const getMarket = async (req, res) => {
  const market = await Market.findOne(byIdOrSlug(req.params.id));
  if (!market) throw new AppError('Market not found', 404);
  const farmers = await User.find({ ...publicFarmerFilter(), 'farmerProfile.markets': market._id }).select(
    'farmerProfile.stallName farmerProfile.slug farmerProfile.operatingDays farmerProfile.ratingAvg farmerProfile.ratingCount farmerProfile.location'
  );
  res.json({ success: true, market, farmers });
};

// Copy only the market fields an admin is allowed to set.
const pickMarketFields = (body) => {
  const fields = {};
  ['name', 'address', 'mapProvider', 'mapLink', 'openTime', 'closeTime', 'isActive'].forEach((key) => {
    if (body[key] !== undefined) fields[key] = body[key];
  });
  if (body.latitude !== undefined) fields.latitude = Number(body.latitude);
  if (body.longitude !== undefined) fields.longitude = Number(body.longitude);
  if (Array.isArray(body.operatingDays)) {
    fields.operatingDays = body.operatingDays
      .map((day) => String(day).toLowerCase())
      .filter((day) => DAYS.includes(day));
  }
  return fields;
};

const createMarket = async (req, res) => {
  requireFields(req.body, ['name', 'address', 'latitude', 'longitude']);
  const market = await Market.create(pickMarketFields(req.body));
  cache.clear('home');
  cache.clear('admin:');
  audit(req, 'market.create', `Added market ${market.name}`, { type: 'market', id: market._id });
  res.status(201).json({ success: true, market });
};

const updateMarket = async (req, res) => {
  const market = await Market.findById(req.params.id);
  if (!market) throw new AppError('Market not found', 404);
  market.set(pickMarketFields(req.body));
  await market.save();
  cache.clear('home');
  audit(req, 'market.update', `Edited market ${market.name}`, { type: 'market', id: market._id });
  res.json({ success: true, market });
};

const deleteMarket = async (req, res) => {
  const market = await Market.findByIdAndDelete(req.params.id);
  if (!market) throw new AppError('Market not found', 404);
  await User.updateMany({ 'farmerProfile.markets': market._id }, { $pull: { 'farmerProfile.markets': market._id } });
  cache.clear('home');
  cache.clear('admin:');
  audit(req, 'market.remove', `Removed market ${market.name}`, { type: 'market', id: market._id });
  res.json({ success: true, message: 'Market removed' });
};

module.exports = { listMarkets, getMarket, createMarket, updateMarket, deleteMarket };
