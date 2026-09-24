const Product = require('../models/Product');
const Category = require('../models/Category');
const Market = require('../models/Market');
const User = require('../models/User');
const cache = require('../utils/cache');
const { publicFarmerFilter, approvedFarmerIds } = require('../utils/services');

// GET /api/home
// Everything the landing page needs in ONE cached request (60s), computed with aggregations instead of the
// browser downloading 100 products and counting them itself. Cost is independent of the number of visitors.
const build = async () => {
  const farmerIds = await approvedFarmerIds(publicFarmerFilter());
  const base = { isActive: true, available: true, quantityAvailable: { $gt: 0 }, farmer: { $in: farmerIds } };
  const hasImage = { $cond: [{ $gt: [{ $strLenCP: { $ifNull: ['$image', ''] } }, 0] }, 1, 0] };

  const [productCount, marketCount, catAgg, growerAgg, newest, markets, categories] = await Promise.all([
    Product.countDocuments(base),
    Market.countDocuments({ isActive: true }),
    Product.aggregate([
      { $match: base },
      { $addFields: { hasImage } },
      { $sort: { hasImage: -1, createdAt: -1 } },
      { $group: { _id: '$category', count: { $sum: 1 }, image: { $first: '$image' } } },
      { $sort: { count: -1 } },
    ]),
    Product.aggregate([
      { $match: base },
      { $addFields: { hasImage } },
      { $sort: { hasImage: -1, createdAt: -1 } },
      { $group: { _id: '$farmer', count: { $sum: 1 }, image: { $first: '$image' } } },
      { $sort: { count: -1 } },
      { $limit: 6 },
    ]),
    Product.find({ ...base, image: { $exists: true, $nin: [null, ''] } })
      .sort({ createdAt: -1 })
      .limit(12)
      .populate('category', 'name')
      .populate('farmer', 'farmerProfile.stallName farmerProfile.slug farmerProfile.location'),
    Market.find({ isActive: true }).sort('name').limit(12).lean(),
    Category.find({ isActive: true }).sort('name').lean(),
  ]);

  const categoryById = new Map(categories.map((category) => [String(category._id), category]));
  const categoryTiles = catAgg
    .filter((tile) => categoryById.has(String(tile._id)))
    .map((tile) => ({ _id: tile._id, name: categoryById.get(String(tile._id)).name, count: tile.count, image: tile.image || null }));

  const farmers = await User.find({ _id: { $in: growerAgg.map((grower) => grower._id) } })
    .select('farmerProfile.stallName farmerProfile.slug farmerProfile.operatingDays farmerProfile.markets farmerProfile.ratingAvg farmerProfile.ratingCount')
    .populate('farmerProfile.markets', 'name')
    .lean();
  const farmerById = new Map(farmers.map((farmer) => [String(farmer._id), farmer]));
  const growers = growerAgg
    .filter((grower) => farmerById.has(String(grower._id)))
    .map((grower) => ({ ...farmerById.get(String(grower._id)), productCount: grower.count, image: grower.image || null }));

  return {
    stats: { products: productCount, farmers: farmerIds.length, markets: marketCount },
    categories: categories.map((category) => ({ _id: category._id, name: category.name })),
    categoryTiles,
    growers,
    newest,
    markets,
  };
};

const summary = async (req, res) => {
  const data = await cache.cached('home', 60_000, build);
  res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=60');
  res.json({ success: true, ...data });
};

module.exports = { summary };
