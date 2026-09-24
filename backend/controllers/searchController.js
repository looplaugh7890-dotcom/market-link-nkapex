const Product = require('../models/Product');
const Category = require('../models/Category');
const Market = require('../models/Market');
const User = require('../models/User');
const cache = require('../utils/cache');
const { cleanString, escapeRegex } = require('../utils/helpers');
const { publicFarmerFilter, approvedFarmerIds } = require('../utils/services');

// Lower is better: name starts with the query, then a word in the name starts with it, then it appears anywhere.
const rank = (name, query) => {
  const lowerName = name.toLowerCase();
  if (lowerName.startsWith(query)) return 0;
  if (lowerName.split(/[\s\-&/,]+/).some((word) => word.startsWith(query))) return 1;
  return 2;
};
// For 1-2 letters only show names that START with them (or a word that does); "contains" matches are noise there.
const relevant = (query, key) => (item) => query.length > 2 || rank(item[key], query) <= 1;
const byRank = (query, key) => (first, second) =>
  rank(first[key], query) - rank(second[key], query) || first[key].localeCompare(second[key]);

// GET /api/search?q=to  — live suggestions for the header search box: products, categories, growers and markets that
// match the letters typed so far, best matches (prefix) first.
const suggest = async (req, res) => {
  const rawText = (cleanString(req.query.q) || '').slice(0, 40);
  if (!rawText) return res.json({ success: true, products: [], categories: [], farmers: [], markets: [] });
  const query = rawText.toLowerCase();
  const searchPattern = new RegExp(escapeRegex(rawText), 'i');

  const [farmerIds, categories] = await Promise.all([
    approvedFarmerIds(publicFarmerFilter()),
    cache.cached('categories:false', 60_000, () => Category.find({ isActive: true }).sort('name').lean()),
  ]);

  const [products, farmers, markets] = await Promise.all([
    Product.find({ name: searchPattern, isActive: true, available: true, quantityAvailable: { $gt: 0 }, farmer: { $in: farmerIds } })
      .limit(30)
      .populate('category', 'name')
      .populate('farmer', 'farmerProfile.stallName farmerProfile.slug'),
    User.find({ ...publicFarmerFilter(), 'farmerProfile.stallName': searchPattern }).limit(10).select('farmerProfile.stallName farmerProfile.slug farmerProfile.markets').populate('farmerProfile.markets', 'name').lean(),
    Market.find({ isActive: true, $or: [{ name: searchPattern }, { address: searchPattern }] }).limit(10).select('name slug address operatingDays').lean(),
  ]);

  res.json({
    success: true,
    products: products.filter(relevant(query, 'name')).sort(byRank(query, 'name')).slice(0, 5),
    categories: categories
      .filter((category) => searchPattern.test(category.name))
      .filter(relevant(query, 'name'))
      .sort(byRank(query, 'name'))
      .slice(0, 3)
      .map((category) => ({ _id: category._id, name: category.name })),
    farmers: farmers
      .map((farmer) => ({
        _id: farmer._id,
        slug: farmer.farmerProfile.slug,
        name: farmer.farmerProfile.stallName,
        markets: (farmer.farmerProfile.markets || []).map((market) => market.name),
      }))
      .filter(relevant(query, 'name'))
      .sort(byRank(query, 'name'))
      .slice(0, 3),
    markets: markets.filter(relevant(query, 'name')).sort(byRank(query, 'name')).slice(0, 3),
  });
};

module.exports = { suggest };
