const User = require('../models/User');
const Market = require('../models/Market');
const Order = require('../models/Order');
const Report = require('../models/Report');
const Announcement = require('../models/Announcement');
const Review = require('../models/Review');
const Product = require('../models/Product');
const AuditLog = require('../models/AuditLog');
const { audit } = require('../utils/audit');
const { AppError, cleanString, escapeRegex, getPagination, requireFields } = require('../utils/helpers');
const { notify, notifyMany, invalidateFarmers } = require('../utils/services');
const cache = require('../utils/cache');

// The whole overview is computed with a handful of aggregations and cached for 30s: with 100k+ users an exact
// count / group-by on every dashboard view (and every auto-refresh) would be wasted work.
const DAY = 24 * 3600 * 1000;
const isoDay = (date) => date.toISOString().slice(0, 10);
// The last `count` calendar days as YYYY-MM-DD strings, oldest first.
const lastDays = (count) =>
  Array.from({ length: count }, (_, index) => isoDay(new Date(Date.now() - (count - 1 - index) * DAY)));

const buildDashboard = async () => {
  const fourteenDaysAgo = new Date(Date.now() - 13 * DAY);
  fourteenDaysAgo.setUTCHours(0, 0, 0, 0);
  const thirtyDaysAgo = new Date(Date.now() - 30 * DAY);
  const sixtyDaysAgo = new Date(Date.now() - 60 * DAY);
  const approvedFarmer = { role: 'farmer', 'farmerProfile.approvalStatus': 'approved' };

  const [
    farmerCount,
    customerCount,
    marketCount,
    orderCount,
    productCount,
    reviewCount,
    pendingFarmerList,
    ordersPerDay,
    signupsPerDay,
    ordersByStatus,
    allTimeRevenue,
    last30Days,
    previous30Days,
    topMarkets,
  ] = await Promise.all([
    User.countDocuments({ role: 'farmer' }),
    User.countDocuments({ role: 'customer' }),
    Market.estimatedDocumentCount(),
    Order.estimatedDocumentCount(),
    Product.countDocuments({ isActive: true }),
    Review.estimatedDocumentCount(),
    User.find({ role: 'farmer', 'farmerProfile.approvalStatus': 'pending' }).sort('createdAt').limit(5).select('name email phone createdAt farmerProfile.stallName').lean(),
    Order.aggregate([
      { $match: { createdAt: { $gte: fourteenDaysAgo } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, orders: { $sum: 1 }, revenue: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$totalAmount', 0] } } } },
    ]),
    User.aggregate([{ $match: { role: 'customer', createdAt: { $gte: fourteenDaysAgo } } }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, n: { $sum: 1 } } }]),
    Order.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
    Order.aggregate([{ $match: { status: 'completed' } }, { $group: { _id: null, revenue: { $sum: '$totalAmount' } } }]),
    Order.aggregate([{ $match: { createdAt: { $gte: thirtyDaysAgo } } }, { $group: { _id: null, orders: { $sum: 1 }, revenue: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$totalAmount', 0] } } } }]),
    Order.aggregate([{ $match: { createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo } } }, { $group: { _id: null, orders: { $sum: 1 }, revenue: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$totalAmount', 0] } } } }]),
    buildReport('revenue_by_market'),
  ]);

  const ordersByDate = new Map(ordersPerDay.map((row) => [row._id, row]));
  const signupsByDate = new Map(signupsPerDay.map((row) => [row._id, row.n]));
  const days = lastDays(14).map((day) => ({
    day,
    orders: ordersByDate.get(day)?.orders || 0,
    revenue: ordersByDate.get(day)?.revenue || 0,
    signups: signupsByDate.get(day) || 0,
  }));

  // "Needs attention": things an admin can fix in one click.
  const [lowRated, outOfStock, withProducts, coveredMarkets, deactivated] = await Promise.all([
    Review.find({ rating: { $lte: 2 }, createdAt: { $gte: thirtyDaysAgo } }).sort('-createdAt').limit(3).populate('customer', 'name').populate('product', 'name').select('rating comment customer product createdAt').lean(),
    Product.countDocuments({ isActive: true, available: true, quantityAvailable: 0 }),
    Product.distinct('farmer', { isActive: true }),
    User.distinct('farmerProfile.markets', approvedFarmer),
    User.countDocuments({ role: { $in: ['customer', 'farmer'] }, isActive: false }),
  ]);
  const [farmersNoProducts, marketsNoFarmers, lowRatedCount] = await Promise.all([
    User.countDocuments({ ...approvedFarmer, _id: { $nin: withProducts } }),
    Market.countDocuments({ isActive: true, _id: { $nin: coveredMarkets } }),
    Review.countDocuments({ rating: { $lte: 2 }, createdAt: { $gte: thirtyDaysAgo } }),
  ]);

  const [recentOrders, recentUsers] = await Promise.all([
    Order.find().sort('-createdAt').limit(6).populate('customer', 'name').populate('farmer', 'farmerProfile.stallName').select('customer farmer totalAmount status createdAt').lean(),
    User.find({ role: { $in: ['customer', 'farmer'] } }).sort('-createdAt').limit(5).select('name role createdAt farmerProfile.stallName').lean(),
  ]);

  const current = last30Days[0] || { orders: 0, revenue: 0 };
  const previous = previous30Days[0] || { orders: 0, revenue: 0 };
  // Percent change vs the previous period; null when there is no previous period to compare with.
  const percentChange = (now, before) => (before ? Math.round(((now - before) / before) * 100) : null);
  return {
    totalFarmers: farmerCount,
    totalCustomers: customerCount,
    totalMarkets: marketCount,
    totalOrders: orderCount,
    totalProducts: productCount,
    totalReviews: reviewCount,
    pendingFarmers: pendingFarmerList.length ? await User.countDocuments({ role: 'farmer', 'farmerProfile.approvalStatus': 'pending' }) : 0,
    revenue: allTimeRevenue[0]?.revenue || 0,
    last30: {
      orders: current.orders,
      revenue: current.revenue,
      ordersChange: percentChange(current.orders, previous.orders),
      revenueChange: percentChange(current.revenue, previous.revenue),
    },
    days,
    byStatus: Object.fromEntries(ordersByStatus.map((row) => [row._id, row.n])),
    topMarkets: topMarkets.slice(0, 5),
    attention: { pendingFarmers: pendingFarmerList, lowRated, lowRatedCount, outOfStock, farmersNoProducts, marketsNoFarmers, deactivated },
    recent: { orders: recentOrders, users: recentUsers },
    generatedAt: new Date().toISOString(),
  };
};

const dashboard = async (req, res) => {
  const stats = await cache.cached('admin:dashboard', 30_000, buildDashboard);
  res.json({ success: true, stats });
};

// GET /api/admin/users?role=farmer&status=pending&search=
const listUsers = async (req, res) => {
  const filter = { role: { $in: ['farmer', 'customer'] } };
  if (['farmer', 'customer'].includes(req.query.role)) filter.role = req.query.role;
  if (['pending', 'approved', 'suspended'].includes(req.query.status)) filter['farmerProfile.approvalStatus'] = req.query.status;
  if (req.query.active === 'true' || req.query.active === 'false') filter.isActive = req.query.active === 'true';
  if (cleanString(req.query.search)) {
    const searchPattern = new RegExp(escapeRegex(cleanString(req.query.search)), 'i');
    filter.$or = [{ name: searchPattern }, { email: searchPattern }, { 'farmerProfile.stallName': searchPattern }];
  }
  const { page, limit, skip } = getPagination(req);
  const [users, total] = await Promise.all([
    User.find(filter).sort('-createdAt').skip(skip).limit(limit).lean(),
    User.countDocuments(filter),
  ]);
  res.json({ success: true, total, page, users });
};

// PATCH /api/admin/farmers/:id/status { status: 'approved' | 'suspended' | 'pending' }
const setFarmerStatus = async (req, res) => {
  const { status } = req.body;
  if (!['approved', 'suspended', 'pending'].includes(status)) throw new AppError('Invalid status', 400);
  const farmer = await User.findOne({ _id: req.params.id, role: 'farmer' });
  if (!farmer) throw new AppError('Farmer not found', 404);
  farmer.farmerProfile.approvalStatus = status;
  await farmer.save();
  invalidateFarmers();
  cache.clear('admin:');
  cache.clear('home');
  await notify(farmer._id, `Account ${status}`, `Your farmer account is now ${status}.`, 'account');
  audit(req, `farmer.${status}`, `${status === 'approved' ? 'Approved' : status === 'suspended' ? 'Suspended' : 'Set to pending:'} farmer ${farmer.farmerProfile.stallName}`, { type: 'farmer', id: farmer._id });
  res.json({ success: true, user: farmer });
};

// PATCH /api/admin/customers/:id/active { isActive }
const setCustomerActive = async (req, res) => {
  if (typeof req.body.isActive !== 'boolean') throw new AppError('isActive must be a boolean', 400);
  const user = await User.findOneAndUpdate(
    { _id: req.params.id, role: { $in: ['customer', 'farmer'] } },
    { isActive: req.body.isActive },
    { new: true }
  );
  if (!user) throw new AppError('User not found', 404);
  cache.clear('admin:');
  audit(req, req.body.isActive ? 'user.activate' : 'user.deactivate', `${req.body.isActive ? 'Activated' : 'Deactivated'} ${user.role} ${user.name} (${user.email})`, { type: 'user', id: user._id });
  res.json({ success: true, user });
};

// GET /api/admin/reviews?rating=  — every review, for moderation.
const listReviews = async (req, res) => {
  const filter = {};
  const rating = parseInt(req.query.rating, 10);
  if (rating >= 1 && rating <= 5) filter.rating = rating;
  const { page, limit, skip } = getPagination(req);
  const [reviews, total] = await Promise.all([
    Review.find(filter)
      .populate('customer', 'name')
      .populate('farmer', 'farmerProfile.stallName')
      .populate('product', 'name')
      .sort('-createdAt')
      .skip(skip)
      .limit(limit),
    Review.countDocuments(filter),
  ]);
  res.json({ success: true, total, page, reviews });
};

// ---- reports ----

const buildReport = async (reportType) => {
  const completed = { status: 'completed' };
  if (reportType === 'revenue_by_market') {
    return Order.aggregate([
      { $match: completed },
      { $group: { _id: '$market', orders: { $sum: 1 }, revenue: { $sum: '$totalAmount' } } },
      { $lookup: { from: 'markets', localField: '_id', foreignField: '_id', as: 'market' } },
      { $project: { _id: 0, marketId: '$_id', market: { $arrayElemAt: ['$market.name', 0] }, orders: 1, revenue: 1 } },
      { $sort: { revenue: -1 } },
    ]);
  }
  if (reportType === 'top_products') {
    return Order.aggregate([
      { $match: completed },
      { $unwind: '$items' },
      { $group: { _id: '$items.name', unit: { $first: '$items.unit' }, units: { $sum: '$items.quantity' }, revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } } } },
      { $sort: { revenue: -1 } },
      { $limit: 10 },
      { $project: { _id: 0, product: '$_id', unit: 1, units: 1, revenue: 1 } },
    ]);
  }
  if (reportType === 'active_farmers') {
    return Order.aggregate([
      { $group: { _id: '$farmer', orders: { $sum: 1 }, revenue: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$totalAmount', 0] } } } },
      { $sort: { orders: -1 } },
      { $limit: 10 },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'farmer' } },
      { $project: { _id: 0, farmerId: '$_id', stallName: { $arrayElemAt: ['$farmer.farmerProfile.stallName', 0] }, orders: 1, revenue: 1 } },
    ]);
  }
  const [totals] = await Order.aggregate([
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        completedOrders: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
        revenue: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$totalAmount', 0] } },
      },
    },
  ]);
  return {
    totalOrders: totals?.totalOrders || 0,
    completedOrders: totals?.completedOrders || 0,
    revenue: totals?.revenue || 0,
    revenueByMarket: await buildReport('revenue_by_market'),
    mostActiveFarmers: await buildReport('active_farmers'),
  };
};

// POST /api/admin/reports { reportType: summary | revenue_by_market | active_farmers }
const generateReport = async (req, res) => {
  const reportType = req.body.reportType || 'summary';
  if (!['summary', 'revenue_by_market', 'active_farmers', 'top_products'].includes(reportType)) {
    throw new AppError('Invalid reportType', 400);
  }
  const report = await Report.create({ generatedBy: req.user._id, reportType, data: await buildReport(reportType) });
  audit(req, 'report.generate', `Generated report: ${reportType.replace(/_/g, ' ')}`, { type: 'report', id: report._id });
  res.status(201).json({ success: true, report });
};

const listReports = async (req, res) => {
  const reports = await Report.find().sort('-generatedAt').limit(50).populate('generatedBy', 'name');
  res.json({ success: true, reports });
};

// ---- announcements ----

const createAnnouncement = async (req, res) => {
  requireFields(req.body, ['title', 'message']);
  const audience = ['all', 'farmers', 'customers'].includes(req.body.audience) ? req.body.audience : 'all';
  const announcement = await Announcement.create({
    title: cleanString(req.body.title),
    message: cleanString(req.body.message),
    audience,
    createdBy: req.user._id,
  });
  const roleFilter = audience === 'all' ? { role: { $in: ['farmer', 'customer'] } } : { role: audience.slice(0, -1) };
  const recipientIds = await User.find({ ...roleFilter, isActive: true }).distinct('_id');
  await notifyMany(recipientIds, announcement.title, announcement.message, 'announcement');
  audit(req, 'announcement.publish', `Published announcement "${announcement.title}" to ${audience} (${recipientIds.length} recipients)`, { type: 'announcement', id: announcement._id });
  res.status(201).json({ success: true, announcement });
};

const listAnnouncements = async (req, res) => {
  const filter = {};
  if (req.user?.role === 'farmer') filter.audience = { $in: ['all', 'farmers'] };
  if (req.user?.role === 'customer') filter.audience = { $in: ['all', 'customers'] };
  const announcements = await Announcement.find(filter).sort('-createdAt').limit(20);
  res.json({ success: true, announcements });
};

const deleteAnnouncement = async (req, res) => {
  const announcement = await Announcement.findByIdAndDelete(req.params.id);
  if (!announcement) throw new AppError('Announcement not found', 404);
  audit(req, 'announcement.remove', `Removed announcement "${announcement.title}"`, { type: 'announcement', id: announcement._id });
  res.json({ success: true, message: 'Announcement removed' });
};

// ---- bulk actions ----

// PATCH /api/admin/users/bulk { ids: [...], action: approve | suspend | activate | deactivate }  (max 100)
const bulkUsers = async (req, res) => {
  const { ids, action } = req.body;
  if (!Array.isArray(ids) || !ids.length || ids.length > 100) throw new AppError('ids must be 1-100 user ids', 400);
  if (!['approve', 'suspend', 'activate', 'deactivate'].includes(action)) throw new AppError('Invalid action', 400);
  const changesApproval = action === 'approve' || action === 'suspend';
  const matchFilter = { _id: { $in: ids }, role: changesApproval ? 'farmer' : { $in: ['customer', 'farmer'] } };
  let changes;
  if (action === 'approve') changes = { 'farmerProfile.approvalStatus': 'approved' };
  else if (action === 'suspend') changes = { 'farmerProfile.approvalStatus': 'suspended' };
  else changes = { isActive: action === 'activate' };
  const result = await User.updateMany(matchFilter, { $set: changes });
  if (changesApproval) {
    const status = action === 'approve' ? 'approved' : 'suspended';
    await notifyMany(ids, `Account ${status}`, `Your farmer account is now ${status}.`, 'account');
  }
  invalidateFarmers();
  cache.clear('admin:');
  cache.clear('home');
  audit(req, `bulk.${action}`, `Bulk ${action}: ${result.modifiedCount} of ${ids.length} selected accounts`, { type: 'user' });
  res.json({ success: true, matched: result.matchedCount, modified: result.modifiedCount });
};

// ---- CSV export (streamed with a cursor, so it works for very large collections) ----

const csvCell = (value) => {
  const text = value === undefined || value === null ? '' : String(value);
  // Neutralise spreadsheet formula injection (=, +, -, @) while keeping normal negative numbers readable.
  const safe = /^[=+@]/.test(text) || /^-[^0-9.]/.test(text) ? `'${text}` : text;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

// GET /api/admin/export/users?role=customer|farmer   GET /api/admin/export/orders?status=
const exportCsv = async (req, res) => {
  const type = req.params.type;
  if (!['users', 'orders'].includes(type)) throw new AppError('Unknown export', 404);
  res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="marketlink-${type}-${isoDay(new Date())}.csv"` });
  const MAX_ROWS = 100000;
  let rowCount = 0;
  if (type === 'users') {
    const filter = { role: { $in: ['farmer', 'customer'] } };
    if (['farmer', 'customer'].includes(req.query.role)) filter.role = req.query.role;
    res.write('name,email,phone,role,account,approval,stall,joined\n');
    for await (const user of User.find(filter).sort('-createdAt').lean().cursor()) {
      if (rowCount++ >= MAX_ROWS) break;
      res.write([user.name, user.email, user.phone, user.role, user.isActive ? 'active' : 'deactivated', user.farmerProfile?.approvalStatus, user.farmerProfile?.stallName, user.createdAt?.toISOString()].map(csvCell).join(',') + '\n');
    }
  } else {
    const filter = Order.STATUSES.includes(req.query.status) ? { status: req.query.status } : {};
    res.write('order,placed_at,customer,farmer,market,items,total,status,pickup_date\n');
    const cursor = Order.find(filter).sort('-createdAt').populate('customer', 'name').populate('farmer', 'farmerProfile.stallName').populate('market', 'name').lean().cursor();
    for await (const order of cursor) {
      if (rowCount++ >= MAX_ROWS) break;
      res.write([order._id, order.createdAt?.toISOString(), order.customer?.name, order.farmer?.farmerProfile?.stallName, order.market?.name, order.items?.length, order.totalAmount, order.status, order.pickupDate].map(csvCell).join(',') + '\n');
    }
  }
  audit(req, 'export', `Exported ${rowCount} ${type} to CSV`, { type });
  res.end();
};

// ---- audit log + global search ----

// GET /api/admin/audit?action=&page=
const listAudit = async (req, res) => {
  const filter = {};
  if (cleanString(req.query.action)) filter.action = new RegExp(`^${escapeRegex(cleanString(req.query.action))}`);
  const { page, limit, skip } = getPagination(req, 25);
  const [logs, total] = await Promise.all([AuditLog.find(filter).sort('-createdAt').skip(skip).limit(limit).lean(), AuditLog.countDocuments(filter)]);
  res.json({ success: true, total, page, logs });
};

// GET /api/admin/search?q=  — powers the Ctrl/⌘+K command palette.
const search = async (req, res) => {
  const searchText = cleanString(req.query.q);
  if (!searchText || searchText.length < 2) return res.json({ success: true, results: [] });
  const searchPattern = new RegExp(escapeRegex(searchText), 'i');
  const [users, markets, products] = await Promise.all([
    User.find({ role: { $in: ['customer', 'farmer'] }, $or: [{ name: searchPattern }, { email: searchPattern }, { 'farmerProfile.stallName': searchPattern }] }).limit(5).select('name email role isActive farmerProfile.stallName farmerProfile.approvalStatus').lean(),
    Market.find({ name: searchPattern }).limit(3).select('name address').lean(),
    Product.find({ name: searchPattern, isActive: true }).limit(4).select('name price unit').lean(),
  ]);
  res.json({
    success: true,
    results: [
      ...users.map((user) => ({
        type: user.role,
        id: user._id,
        title: user.farmerProfile?.stallName || user.name,
        subtitle: `${user.email}${user.isActive ? '' : ' · deactivated'}${user.farmerProfile?.approvalStatus ? ` · ${user.farmerProfile.approvalStatus}` : ''}`,
        to: `/admin/users?search=${encodeURIComponent(user.email)}&tab=${user.role}`,
      })),
      ...markets.map((market) => ({ type: 'market', id: market._id, title: market.name, subtitle: market.address, to: '/admin/markets' })),
      ...products.map((product) => ({ type: 'product', id: product._id, title: product.name, subtitle: `$${product.price} / ${product.unit}`, to: '/admin/moderation?tab=products' })),
    ],
  });
};

module.exports = {
  bulkUsers,
  exportCsv,
  listAudit,
  search,
  dashboard,
  listUsers,
  setFarmerStatus,
  setCustomerActive,
  listReviews,
  generateReport,
  listReports,
  createAnnouncement,
  listAnnouncements,
  deleteAnnouncement,
};
