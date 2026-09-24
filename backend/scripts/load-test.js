// Usage: npm run test:load [customers=100000]
// Seeds a THROW-AWAY database ("<MONGO_DB_NAME>_loadtest") with N customers, orders and notifications, times the
// queries the app runs most, checks they use indexes, then drops that database. Your real data is never touched.
require('dotenv').config();
const N = Number(process.argv[2]) || 100000;
const realDb = process.env.MONGO_DB_NAME || 'marketlink';
process.env.MONGO_DB_NAME = `${realDb}_loadtest`;
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const connectDB = require('../config/db');
const User = require('../models/User');
const Market = require('../models/Market');
const Category = require('../models/Category');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Notification = require('../models/Notification');

const oid = () => new mongoose.Types.ObjectId();
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const chunks = async (total, size, make, coll) => {
  for (let i = 0; i < total; i += size) {
    await coll.insertMany(Array.from({ length: Math.min(size, total - i) }, (_, index) => make(i + index)), { ordered: false });
    process.stdout.write(`\r  ${Math.min(i + size, total)}/${total}`);
  }
  process.stdout.write('\n');
};
const time = async (label, fn, runs = 7) => {
  await fn(); // warm-up
  const ts = [];
  for (let i = 0; i < runs; i++) {
    const t = process.hrtime.bigint();
    await fn();
    ts.push(Number(process.hrtime.bigint() - t) / 1e6);
  }
  ts.sort((first, second) => first - second);
  console.log(`  ${ts[Math.floor(runs / 2)].toFixed(1).padStart(8)} ms  ${label}`);
  return ts[Math.floor(runs / 2)];
};
const plan = async (label, cursor) => {
  const ex = await cursor.explain('executionStats');
  const s = JSON.stringify(ex.queryPlanner.winningPlan);
  const stage = /IXSCAN/.test(s) ? 'IXSCAN' : /COLLSCAN/.test(s) ? 'COLLSCAN' : 'other';
  const st = ex.executionStats;
  console.log(`  ${stage.padEnd(8)} examined ${String(st.totalDocsExamined).padStart(7)} docs / ${String(st.totalKeysExamined).padStart(7)} keys, returned ${st.nReturned}  <- ${label}`);
};

(async () => {
  await connectDB();
  if (mongoose.connection.name === realDb) throw new Error('Refusing to run against the real database');
  console.log(`Temporary database: ${mongoose.connection.name}`);
  await mongoose.connection.dropDatabase();
  await Promise.all([User, Market, Category, Product, Order, Notification].map((m) => m.syncIndexes()));

  const hash = await bcrypt.hash('Password@123', 8);
  const cat = await Category.create({ name: 'Load' });
  const market = await Market.create({ name: 'Load Market', address: 'x', latitude: 24.8, longitude: 67, operatingDays: ['saturday'] });
  const farmers = Array.from({ length: 50 }, (_, index) => ({
    _id: oid(), name: `Farmer ${index}`, email: `farmer${index}@load.test`, password: hash, phone: '1', address: 'x', role: 'farmer', isActive: true, createdAt: new Date(), updatedAt: new Date(),
    farmerProfile: { stallName: `Stall ${index}`, approvalStatus: 'approved', markets: [market._id], operatingDays: ['saturday'], pickupWindows: [], cutoffHours: 12, geo: { type: 'Point', coordinates: [67, 24.8] } },
  }));
  await User.collection.insertMany(farmers);
  await Product.collection.insertMany(
    Array.from({ length: 1000 }, (_, index) => ({ farmer: pick(farmers)._id, category: cat._id, name: `Product ${index}`, price: 1 + (index % 20), unit: 'kg', quantityAvailable: 50, available: true, isActive: true, ratingAvg: 0, ratingCount: 0, createdAt: new Date(Date.now() - index * 1000), updatedAt: new Date() }))
  );

  console.log(`Seeding ${N} customers...`);
  const customerIds = [];
  await chunks(N, 5000, (i) => {
    const _id = oid();
    if (i % 100 === 0) customerIds.push(_id);
    return { _id, name: `Customer ${i}`, email: `customer${i}@load.test`, password: hash, phone: '03001234567', address: `${i} Test Street`, role: 'customer', isActive: true, favorites: { farmers: [], products: [], markets: [] }, createdAt: new Date(Date.now() - i * 1000), updatedAt: new Date() };
  }, User.collection);
  console.log(`Seeding ${N} orders...`);
  await chunks(N, 5000, (i) => ({ customer: pick(customerIds), farmer: pick(farmers)._id, items: [{ product: oid(), name: 'x', unit: 'kg', price: 2, quantity: 2 }], totalAmount: 4, status: pick(['placed', 'accepted', 'ready', 'completed']), pickupDate: '2026-10-03', pickupSlot: { start: '09:00', end: '10:00' }, createdAt: new Date(Date.now() - i * 1000), updatedAt: new Date() }), Order.collection);
  console.log(`Seeding ${N} notifications...`);
  await chunks(N, 5000, (i) => ({ user: pick(customerIds), type: 'order', title: 'Order accepted', message: 'x', read: false, createdAt: new Date(Date.now() - i * 1000), updatedAt: new Date() }), Notification.collection);

  const me = customerIds[7];
  const someFarmer = farmers[3]._id;
  console.log(`\nTimings (median of 7, includes network round-trip to MongoDB):`);
  await time('login: find user by e-mail', () => User.findOne({ email: 'customer5000@load.test' }).select('+password').lean());
  await time('auth check: find user by _id (every request)', () => User.findById(me).lean());
  await time('admin dashboard: count customers', () => User.countDocuments({ role: 'customer' }));
  await time('admin dashboard: estimated order count', () => Order.estimatedDocumentCount());
  await time('admin users: page 1 (15 newest customers)', () => User.find({ role: 'customer' }).sort('-createdAt').limit(15).lean());
  await time('admin users: deep page 2000', () => User.find({ role: 'customer' }).sort('-createdAt').skip(2000 * 15).limit(15).lean());
  await time('admin users: search by e-mail prefix', () => User.find({ role: 'customer', email: /^customer4242/ }).limit(15).lean());
  await time('admin users: search by name (unanchored regex)', () => User.find({ role: 'customer', name: /Customer 99999/i }).limit(15).lean());
  await time('customer: my orders (page 1)', () => Order.find({ customer: me }).sort('-createdAt').limit(20).lean());
  await time('farmer: pending orders queue', () => Order.find({ farmer: someFarmer, status: 'placed' }).sort('-createdAt').limit(20).lean());
  await time('customer: notifications (page 1)', () => Notification.find({ user: me }).sort('-createdAt').limit(20).lean());
  await time('shop: product list (filters + sort + page)', () => Product.find({ isActive: true, available: true, quantityAvailable: { $gt: 0 }, category: cat._id, price: { $gte: 2, $lte: 15 } }).sort('-createdAt').limit(12).lean());
  await time('shop: product count for the same filter', () => Product.countDocuments({ isActive: true, available: true, quantityAvailable: { $gt: 0 }, category: cat._id }));

  console.log('\nQuery plans:');
  await plan('login by e-mail', User.find({ email: 'customer5000@load.test' }));
  await plan('admin users page 1', User.find({ role: 'customer' }).sort('-createdAt').limit(15));
  await plan('email prefix search', User.find({ role: 'customer', email: /^customer4242/ }).limit(15));
  await plan('name search (regex)', User.find({ role: 'customer', name: /Customer 99999/i }).limit(15));
  await plan('my orders', Order.find({ customer: me }).sort('-createdAt').limit(20));
  await plan('farmer pending queue', Order.find({ farmer: someFarmer, status: 'placed' }).sort('-createdAt').limit(20));
  await plan('notifications', Notification.find({ user: me }).sort('-createdAt').limit(20));
  await plan('product list', Product.find({ isActive: true, available: true, category: cat._id }).sort('-createdAt').limit(12));

  const stats = await mongoose.connection.db.stats();
  console.log(`\nTemporary data size: ${(stats.dataSize / 1e6).toFixed(0)} MB data, ${(stats.indexSize / 1e6).toFixed(0)} MB indexes`);
  await mongoose.connection.dropDatabase();
  console.log('Temporary database dropped.');
  await mongoose.disconnect();
})().catch(async (error) => {
  console.error('\nFailed:', error.message);
  try {
    if (mongoose.connection.name && mongoose.connection.name.endsWith('_loadtest')) await mongoose.connection.dropDatabase();
  } catch { /* ignore */ }
  process.exit(1);
});
