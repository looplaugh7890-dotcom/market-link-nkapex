// Usage: npm run seed  (wipes and re-creates demo data)
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');
const Market = require('../models/Market');
const Category = require('../models/Category');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Review = require('../models/Review');
const Notification = require('../models/Notification');
const Announcement = require('../models/Announcement');
const Report = require('../models/Report');

const PASSWORD = 'Password@123';

(async () => {
  await connectDB();

  // seed() deletes every document in this app's collections, so never run it against the
  // default "test" database, which is commonly shared with other projects.
  if (mongoose.connection.name === 'test' && !process.env.ALLOW_TEST_DB) {
    console.error('Refusing to seed the shared "test" database. Set MONGO_DB_NAME=marketlink in backend/.env first.');
    process.exit(1);
  }
  await Promise.all([User, Market, Category, Product, Order, Review, Notification, Announcement, Report].map((m) => m.deleteMany({})));

  const categories = await Category.insertMany(
    ['Vegetables', 'Fruits', 'Dairy', 'Baked Goods', 'Eggs & Poultry'].map((name) => ({ name }))
  );
  const cat = Object.fromEntries(categories.map((category) => [category.name, category._id]));

  const market = await Market.create({
    name: 'Green Valley Market',
    address: '12 Orchard Road, Green Valley',
    latitude: 24.8607,
    longitude: 67.0011,
    mapProvider: 'openstreetmap',
    operatingDays: ['saturday', 'sunday'],
    openTime: '08:00',
    closeTime: '14:00',
  });

  await User.create({ name: 'Admin', email: 'admin@marketlink.test', password: PASSWORD, phone: '0000000000', address: 'HQ', role: 'admin' });
  await User.create({ name: 'Cathy Customer', email: 'customer@marketlink.test', password: PASSWORD, phone: '1111111111', address: '5 Elm Street' });

  const farmer = await User.create({
    name: 'Fred Farmer',
    email: 'farmer@marketlink.test',
    password: PASSWORD,
    phone: '2222222222',
    address: '1 Farm Lane',
    role: 'farmer',
    farmerProfile: {
      stallName: 'Fred\'s Fresh Produce',
      contactPerson: 'Fred Farmer',
      approvalStatus: 'approved',
      markets: [market._id],
      operatingDays: ['saturday', 'sunday'],
      pickupWindows: [
        { day: 'saturday', start: '09:00', end: '13:00' },
        { day: 'sunday', start: '09:00', end: '13:00' },
      ],
      cutoffHours: 12,
      location: { address: 'Stall 7, Green Valley Market', latitude: 24.8608, longitude: 67.0012 },
      geo: { type: 'Point', coordinates: [67.0012, 24.8608] },
    },
  });
  await User.create({
    name: 'Pat Pending', email: 'pending.farmer@marketlink.test', password: PASSWORD, phone: '3333333333', address: '2 Farm Lane', role: 'farmer',
    farmerProfile: { stallName: 'Pending Patch', contactPerson: 'Pat Pending' },
  });

  await Product.insertMany([
    { farmer: farmer._id, category: cat.Vegetables, name: 'Tomatoes', price: 3.5, unit: 'kg', quantityAvailable: 50, weeklyTemplate: { enabled: true, quantity: 50 } },
    { farmer: farmer._id, category: cat.Vegetables, name: 'Carrots', price: 2, unit: 'kg', quantityAvailable: 30 },
    { farmer: farmer._id, category: cat.Fruits, name: 'Apples', price: 4.25, unit: 'kg', quantityAvailable: 40 },
    { farmer: farmer._id, category: cat['Eggs & Poultry'], name: 'Free-range Eggs', price: 5, unit: 'dozen', quantityAvailable: 20 },
  ]);

  console.log('Seeded. Login credentials (password for all: %s)', PASSWORD);
  console.log(' admin    admin@marketlink.test');
  console.log(' farmer   farmer@marketlink.test (approved)');
  console.log(' farmer   pending.farmer@marketlink.test (pending approval)');
  console.log(' customer customer@marketlink.test');
  await mongoose.disconnect();
})().catch((error) => { console.error(error); process.exit(1); });
