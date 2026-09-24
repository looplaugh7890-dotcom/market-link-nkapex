const Market = require('../models/Market');
const Product = require('../models/Product');
const User = require('../models/User');
const { AppError, escapeRegex } = require('../utils/helpers');
const { publicFarmerFilter } = require('../utils/services');

const STOP = new Set(['the', 'a', 'an', 'is', 'are', 'do', 'you', 'have', 'any', 'what', 'when', 'where', 'how', 'much', 'does', 'open', 'at', 'in', 'on', 'for', 'of', 'me', 'i', 'can', 'get', 'find', 'show', 'there', 'today', 'time', 'times', 'timing', 'timings', 'hours', 'pickup', 'available', 'availability', 'price', 'cost', 'and', 'to', 'buy', 'want', 'need', 'sell', 'sells', 'stock']);

const capitalize = (word) => word.charAt(0).toUpperCase() + word.slice(1);

// POST /api/chatbot { message } — rule-based assistant over live data (no external AI needed).
const ask = async (req, res) => {
  const message = typeof req.body.message === 'string' ? req.body.message.trim().slice(0, 300) : '';
  if (!message) throw new AppError('message is required', 400);
  const text = message.toLowerCase();

  // 1. Market timings
  const markets = await Market.find({ isActive: true });
  const market = markets.find((candidate) => text.includes(candidate.name.toLowerCase()));
  if (market || /market/.test(text) && /(time|timing|open|hour|day|when)/.test(text)) {
    const list = market ? [market] : markets.slice(0, 5);
    if (!list.length) return res.json({ success: true, reply: 'There are no markets listed yet.' });
    const lines = list.map(
      (item) =>
        `${item.name}: ${item.operatingDays.map(capitalize).join(', ') || 'days not set'}${item.openTime ? `, ${item.openTime}-${item.closeTime}` : ''} (${item.address})`
    );
    return res.json({ success: true, reply: lines.join('\n'), data: { markets: list } });
  }

  // 2. Farmer availability / pickup windows
  const farmers = await User.find(publicFarmerFilter()).select('farmerProfile.stallName farmerProfile.operatingDays farmerProfile.pickupWindows');
  const farmer = farmers.find((candidate) => text.includes(candidate.farmerProfile.stallName.toLowerCase()));
  if (farmer) {
    const profile = farmer.farmerProfile;
    const windows = profile.pickupWindows.map((window) => `${capitalize(window.day)} ${window.start}-${window.end}`).join('; ') || 'no fixed windows';
    const inStock = await Product.countDocuments({ farmer: farmer._id, isActive: true, available: true, quantityAvailable: { $gt: 0 } });
    return res.json({
      success: true,
      reply: `${profile.stallName} is open ${profile.operatingDays.map(capitalize).join(', ') || 'on days not yet set'}. Pickup windows: ${windows}. ${inStock} product(s) currently in stock.`,
      data: { farmerId: farmer._id },
    });
  }

  if (/pickup|pick up|cut.?off|cancel|pay/.test(text)) {
    return res.json({
      success: true,
      reply: 'Pick a pickup date and time slot inside the farmer\'s pickup windows when ordering. You can modify or cancel until the farmer\'s cut-off time. Payment is made in person at pickup - there is no online payment.',
    });
  }

  // 3. Product search
  const words = text.replace(/[^a-z\s]/g, ' ').split(/\s+/).filter((word) => word.length > 2 && !STOP.has(word));
  if (words.length) {
    const wordPattern = new RegExp(words.map(escapeRegex).join('|'), 'i');
    const products = await Product.find({
      name: wordPattern,
      isActive: true,
      available: true,
      quantityAvailable: { $gt: 0 },
      farmer: { $in: farmers.map((farmer) => farmer._id) },
    })
      .populate('farmer', 'farmerProfile.stallName')
      .limit(5);
    if (products.length) {
      const lines = products.map(
        (product) => `${product.name} - ${product.price}/${product.unit} (${product.quantityAvailable} left) at ${product.farmer.farmerProfile.stallName}`
      );
      return res.json({ success: true, reply: `Here is what I found:\n${lines.join('\n')}`, data: { products } });
    }
    return res.json({ success: true, reply: `Sorry, nothing matching "${words.join(' ')}" is in stock right now.` });
  }

  res.json({
    success: true,
    reply: 'I can help with market timings, farmer availability, pickup windows and product search. Try "Do you have tomatoes?" or "When is Green Valley Market open?"',
  });
};

module.exports = { ask };
