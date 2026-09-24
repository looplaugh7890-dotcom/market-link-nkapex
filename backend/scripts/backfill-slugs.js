// Usage: npm run db:slugs   (idempotent: only touches records that have no slug yet)
// Gives every existing product, market and farmer stall a readable URL slug, e.g. /products/sourdough-loaf.
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Product = require('../models/Product');
const Market = require('../models/Market');
const User = require('../models/User');

(async () => {
  await connectDB();
  const counts = {};
  for (const [label, filter, Model] of [
    ['products', { slug: { $exists: false } }, Product],
    ['markets', { slug: { $exists: false } }, Market],
    ['farmers', { role: 'farmer', 'farmerProfile.slug': { $exists: false } }, User],
  ]) {
    counts[label] = 0;
    for (const doc of await Model.find(filter)) {
      await doc.save({ validateModifiedOnly: true });
      counts[label]++;
    }
  }
  await Promise.all([Product.syncIndexes(), Market.syncIndexes(), User.syncIndexes()]);
  console.log('Slugs created:', counts);
  await mongoose.disconnect();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
