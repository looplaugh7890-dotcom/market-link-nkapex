// Usage: npm run seed:demo
// Adds ~26 demo customers, ~120 orders over the last 30 days and some reviews so the admin analytics have real
// numbers to show. Safe to re-run: it first removes the previous demo data (e-mails start with "demo+").
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Review = require('../models/Review');
const Notification = require('../models/Notification');
const { recalcRatings } = require('../utils/services');

const DAY = 24 * 3600 * 1000;
const rnd = (n) => Math.floor(Math.random() * n);
const pick = (a) => a[rnd(a.length)];
const NAMES = ['Ayesha Khan', 'Hamza Ali', 'Sara Ahmed', 'Bilal Sheikh', 'Fatima Noor', 'Usman Raza', 'Zainab Malik', 'Ali Hassan', 'Maryam Siddiqui', 'Omar Farooq', 'Hira Baig', 'Daniyal Shah', 'Iqra Javed', 'Saad Mirza', 'Noor Fatima', 'Talha Iqbal', 'Areeba Tariq', 'Kashif Anwar', 'Mehwish Rauf', 'Faizan Qureshi', 'Laiba Aslam', 'Junaid Butt', 'Sana Yousuf', 'Rehan Chaudhry', 'Amna Riaz', 'Shahzaib Ali'];
const GOOD = ['Fresh and exactly as described.', 'Great quality, will order again.', 'Picked up on time, lovely stall.', 'Best produce in the market.', 'Very friendly farmer.'];
const BAD = ['Some items were not as fresh as expected.', 'Pickup was delayed by 30 minutes.', 'Quantity was less than what I ordered.'];
const STATUSES = [...Array(11).fill('completed'), ...Array(2).fill('ready'), ...Array(2).fill('accepted'), ...Array(3).fill('placed'), ...Array(1).fill('cancelled'), ...Array(1).fill('declined')];
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

(async () => {
  await connectDB();
  if (mongoose.connection.name === 'test' && !process.env.ALLOW_TEST_DB) throw new Error('Refusing to write to the shared "test" database.');

  const old = await User.find({ email: /^demo\+/ }).select('_id');
  const oldIds = old.map((u) => u._id);
  if (oldIds.length) {
    const oldOrders = await Order.find({ customer: { $in: oldIds } }).select('_id');
    await Promise.all([
      Review.deleteMany({ customer: { $in: oldIds } }),
      Order.deleteMany({ customer: { $in: oldIds } }),
      Notification.deleteMany({ user: { $in: oldIds } }),
      User.deleteMany({ _id: { $in: oldIds } }),
    ]);
    console.log(`Removed previous demo data (${oldIds.length} customers, ${oldOrders.length} orders)`);
  }

  const farmers = await User.find({ role: 'farmer', 'farmerProfile.approvalStatus': 'approved' });
  const byFarmer = new Map();
  for (const p of await Product.find({ isActive: true })) byFarmer.set(String(p.farmer), [...(byFarmer.get(String(p.farmer)) || []), p]);
  const sellers = farmers.filter((f) => (byFarmer.get(String(f._id)) || []).length);
  if (!sellers.length) throw new Error('No approved farmers with products. Run "npm run seed" and "npm run seed:catalog" first.');

  // customers: sign-ups spread over the last 21 days
  const customers = [];
  for (let i = 0; i < NAMES.length; i++) {
    const c = await User.create({ name: NAMES[i], email: `demo+c${i + 1}@marketlink.test`, password: 'Password@123', phone: `030${10000000 + rnd(89999999)}`, address: `${10 + i} Garden Road, Karachi`, role: 'customer' });
    const joined = new Date(Date.now() - rnd(21) * DAY - rnd(20) * 3600 * 1000);
    await User.collection.updateOne({ _id: c._id }, { $set: { createdAt: joined, updatedAt: joined } });
    customers.push(c);
  }

  // orders: more recent days are busier, and there is a weekend bump
  const orders = [];
  for (let i = 0; i < 120; i++) {
    const daysAgo = Math.floor(Math.pow(Math.random(), 1.5) * 30);
    const at = new Date(Date.now() - daysAgo * DAY - rnd(12) * 3600 * 1000);
    const farmer = pick(sellers);
    const prods = byFarmer.get(String(farmer._id));
    const chosen = [...prods].sort(() => Math.random() - 0.5).slice(0, 1 + rnd(3));
    const items = chosen.map((p) => ({ product: p._id, name: p.name, unit: p.unit, price: p.price, quantity: 1 + rnd(4) }));
    const status = daysAgo < 2 ? pick(['placed', 'accepted', 'ready', 'completed']) : pick(STATUSES);
    const pickup = new Date(at.getTime() + 2 * DAY);
    const history = [{ status: 'placed', at }];
    if (['accepted', 'ready', 'completed'].includes(status)) history.push({ status: 'accepted', at: new Date(at.getTime() + 3600e3) });
    if (['ready', 'completed'].includes(status)) history.push({ status: 'ready', at: new Date(at.getTime() + 2 * DAY - 3600e3) });
    if (status === 'completed') history.push({ status: 'completed', at: pickup });
    if (['cancelled', 'declined'].includes(status)) history.push({ status, at: new Date(at.getTime() + 1800e3) });
    orders.push({
      customer: pick(customers)._id,
      farmer: farmer._id,
      market: pick(farmer.farmerProfile.markets)?._id || pick(farmer.farmerProfile.markets),
      items,
      totalAmount: Math.round(items.reduce((s, x) => s + x.price * x.quantity, 0) * 100) / 100,
      pickupDate: ymd(pickup),
      pickupSlot: { start: '09:00', end: '10:00' },
      status,
      statusHistory: history,
      createdAt: at,
      updatedAt: at,
    });
  }
  await Order.collection.insertMany(orders);
  const saved = await Order.find({ customer: { $in: customers.map((c) => c._id) }, status: 'completed' });

  // reviews on ~35% of completed orders
  let made = 0;
  for (const o of saved) {
    if (Math.random() > 0.35) continue;
    const rating = Math.random() < 0.12 ? 1 + rnd(2) : 4 + rnd(2);
    const product = Math.random() < 0.6 ? o.items[0].product : undefined;
    try {
      await Review.create({ customer: o.customer, order: o._id, farmer: o.farmer, product, targetType: product ? 'product' : 'farmer', rating, comment: rating <= 2 ? pick(BAD) : pick(GOOD) });
      await recalcRatings({ farmer: o.farmer, product });
      made++;
    } catch {
      /* duplicate review for this order/target: skip */
    }
  }
  console.log(`Demo data ready: ${customers.length} customers, ${orders.length} orders, ${made} reviews.`);
  await mongoose.disconnect();
})().catch(async (e) => {
  console.error(e.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
