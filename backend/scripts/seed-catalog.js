// Usage: npm run seed:catalog  (additive + idempotent: adds markets, farmers, categories and products
// without deleting anything. Safe to re-run.)
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');
const Market = require('../models/Market');
const Category = require('../models/Category');
const Product = require('../models/Product');

const fs = require('fs');
const path = require('path');

const PASSWORD = 'Password@123';
const slug = (n) => n.toLowerCase().replace(/&/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const CATEGORIES = ['Vegetables', 'Fruits', 'Dairy', 'Baked Goods', 'Eggs & Poultry', 'Meat & Seafood', 'Honey & Preserves', 'Herbs & Spices', 'Grains & Pulses'];

const MARKETS = [
  { name: 'Green Valley Market', address: '12 Orchard Road, Green Valley', latitude: 24.8607, longitude: 67.0011, operatingDays: ['saturday', 'sunday'], openTime: '08:00', closeTime: '14:00' },
  { name: 'Riverside Sunday Bazaar', address: 'Riverside Park, Clifton', latitude: 24.8138, longitude: 67.0301, operatingDays: ['sunday'], openTime: '09:00', closeTime: '15:00' },
  { name: 'Old Town Farmers Hub', address: '4 Market Square, Old Town', latitude: 24.8921, longitude: 67.0284, operatingDays: ['wednesday', 'friday', 'saturday'], openTime: '07:30', closeTime: '13:00' },
  { name: 'Hillside Organic Market', address: '88 Ridge Avenue, Hillside', latitude: 24.9256, longitude: 67.0925, operatingDays: ['saturday'], openTime: '08:00', closeTime: '16:00' },
];

// email -> stall; products: [category, name, description, price, unit, qty]
const FARMERS = [
  {
    email: 'farmer@marketlink.test', name: 'Fred Farmer', stall: "Fred's Fresh Produce", markets: ['Green Valley Market'], days: ['saturday', 'sunday'],
    products: [
      ['Vegetables', 'Cucumbers', 'Crisp, thin-skinned cucumbers picked this morning.', 2.2, 'kg', 35],
      ['Vegetables', 'Spinach', 'Tender leaves, washed and bunched.', 1.8, 'bunch', 40],
      ['Fruits', 'Strawberries', 'Sweet, sun-ripened strawberries.', 6.5, 'kg', 18],
      ['Herbs & Spices', 'Fresh Mint', 'Fragrant mint for chai and salads.', 0.9, 'bunch', 60],
    ],
  },
  {
    email: 'sunrise.orchard@marketlink.test', name: 'Sara Malik', stall: 'Sunrise Orchard', markets: ['Green Valley Market', 'Riverside Sunday Bazaar'], days: ['saturday', 'sunday'],
    products: [
      ['Fruits', 'Oranges', 'Juicy navel oranges, great for fresh juice.', 3.2, 'kg', 60],
      ['Fruits', 'Mangoes', 'Sindhri mangoes, ripe and fragrant.', 7.5, 'kg', 25],
      ['Fruits', 'Bananas', 'Naturally ripened bananas.', 1.6, 'dozen', 45],
      ['Fruits', 'Pomegranates', 'Ruby-red, sweet pomegranates.', 5.4, 'kg', 30],
      ['Fruits', 'Guavas', 'Crunchy pink-flesh guavas.', 2.8, 'kg', 28],
    ],
  },
  {
    email: 'meadow.dairy@marketlink.test', name: 'Bilal Ahmed', stall: 'Meadowbrook Dairy', markets: ['Riverside Sunday Bazaar', 'Old Town Farmers Hub'], days: ['wednesday', 'friday', 'saturday', 'sunday'],
    products: [
      ['Dairy', 'Fresh Whole Milk', 'Un-homogenised whole milk, chilled at the farm.', 1.9, 'litre', 80],
      ['Dairy', 'Farm Yogurt', 'Thick set yogurt made daily.', 2.4, 'kg', 40],
      ['Dairy', 'Desi Ghee', 'Slow-cooked clarified butter.', 14, 'kg', 12],
      ['Dairy', 'Paneer', 'Soft, fresh cottage cheese.', 8.5, 'kg', 15],
      ['Eggs & Poultry', 'Farm Eggs', 'Brown eggs from grass-fed hens.', 4.2, 'dozen', 50],
    ],
  },
  {
    email: 'goldencrust.bakery@marketlink.test', name: 'Nadia Hussain', stall: 'Golden Crust Bakery', markets: ['Old Town Farmers Hub', 'Hillside Organic Market'], days: ['wednesday', 'friday', 'saturday'],
    products: [
      ['Baked Goods', 'Sourdough Loaf', 'Naturally leavened, baked every morning.', 4.5, 'loaf', 30],
      ['Baked Goods', 'Whole Wheat Bread', 'Soft, high-fibre sandwich loaf.', 2.8, 'loaf', 40],
      ['Baked Goods', 'Butter Croissants', 'Flaky all-butter croissants.', 1.5, 'piece', 48],
      ['Baked Goods', 'Date & Walnut Cake', 'Moist cake, no refined sugar.', 9, 'each', 10],
    ],
  },
  {
    email: 'hillside.harvest@marketlink.test', name: 'Imran Qureshi', stall: 'Hillside Harvest', markets: ['Hillside Organic Market', 'Green Valley Market'], days: ['saturday'],
    products: [
      ['Honey & Preserves', 'Wild Forest Honey', 'Raw, unfiltered honey from hillside hives.', 11, 'jar', 22],
      ['Honey & Preserves', 'Mango Pickle', 'Traditional spiced pickle, small batch.', 4.8, 'jar', 26],
      ['Grains & Pulses', 'Basmati Rice', 'Aged long-grain basmati.', 3.9, 'kg', 100],
      ['Grains & Pulses', 'Red Lentils', 'Split masoor dal, cleaned and sorted.', 2.6, 'kg', 70],
      ['Vegetables', 'Organic Potatoes', 'Chemical-free potatoes, great for roasting.', 1.4, 'kg', 90],
      ['Herbs & Spices', 'Coriander Seeds', 'Whole, sun-dried coriander.', 3.1, 'kg', 20],
    ],
  },
  {
    email: 'bluewater.catch@marketlink.test', name: 'Yusuf Baloch', stall: 'Bluewater Catch', markets: ['Riverside Sunday Bazaar'], days: ['sunday'],
    products: [
      ['Meat & Seafood', 'Fresh Rohu Fish', 'Cleaned whole rohu, caught the same day.', 6.8, 'kg', 20],
      ['Meat & Seafood', 'Jumbo Prawns', 'Sweet, firm prawns, deveined on request.', 15, 'kg', 14],
    ],
  },
];

(async () => {
  await connectDB();
  if (mongoose.connection.name === 'test' && !process.env.ALLOW_TEST_DB) {
    console.error('Refusing to write to the shared "test" database.');
    process.exit(1);
  }

  const cat = {};
  for (const name of CATEGORIES) {
    cat[name] = (await Category.findOneAndUpdate({ name }, { $setOnInsert: { name } }, { upsert: true, returnDocument: 'after' }))._id;
  }

  const market = {};
  for (const m of MARKETS) {
    let doc = await Market.findOne({ name: m.name });
    if (!doc) doc = await Market.create({ ...m, mapProvider: 'openstreetmap' });
    market[m.name] = doc;
  }

  let added = 0;
  for (const f of FARMERS) {
    const marketDocs = f.markets.map((n) => market[n]);
    let farmer = await User.findOne({ email: f.email });
    if (!farmer) {
      const m0 = marketDocs[0];
      farmer = await User.create({
        name: f.name, email: f.email, password: PASSWORD, phone: '0300' + Math.floor(1000000 + Math.random() * 8999999), address: m0.address, role: 'farmer',
        farmerProfile: {
          stallName: f.stall, contactPerson: f.name, approvalStatus: 'approved', markets: marketDocs.map((marketDoc) => marketDoc._id), operatingDays: f.days,
          pickupWindows: f.days.map((day) => ({ day, start: '09:00', end: '13:00' })), cutoffHours: 12,
          location: { address: `Stall at ${m0.name}`, latitude: m0.latitude, longitude: m0.longitude },
          geo: { type: 'Point', coordinates: [m0.longitude, m0.latitude] },
        },
      });
    } else if (f.email === 'farmer@marketlink.test') {
      // Existing demo farmer: also list them at the new markets' schedule days.
      await User.updateOne({ _id: farmer._id }, { $set: { 'farmerProfile.markets': marketDocs.map((marketDoc) => marketDoc._id) } });
    }
    for (const [c, name, description, price, unit, qty] of f.products) {
      const r = await Product.updateOne({ farmer: farmer._id, name }, { $setOnInsert: { farmer: farmer._id, category: cat[c], name, description, price, unit, quantityAvailable: qty } }, { upsert: true });
      if (r.upsertedCount) added++;
    }
  }

  // Freshness details (harvest date, storage tip, badges) so product pages look complete.
  const INFO = {
    Vegetables: ['Refrigerate in a breathable bag. Best within 5 days.', ['organic', 'seasonal', 'fresh-picked']],
    Fruits: ['Keep at room temperature until ripe, then refrigerate.', ['seasonal', 'pesticide-free']],
    Dairy: ['Keep chilled at 4°C and use within 3 days.', ['fresh-picked', 'small-batch']],
    'Baked Goods': ['Store in a bread bin; freeze slices to keep longer.', ['handmade', 'small-batch']],
    'Eggs & Poultry': ['Refrigerate. Best within 3 weeks.', ['pesticide-free', 'fresh-picked']],
    'Meat & Seafood': ['Keep on ice and cook the same day.', ['fresh-picked']],
    'Honey & Preserves': ['Store in a cool, dark place.', ['handmade', 'small-batch', 'vegan']],
    'Herbs & Spices': ['Store in a jar away from sunlight.', ['organic', 'vegan']],
    'Grains & Pulses': ['Keep in an airtight container in a dry cupboard.', ['organic', 'vegan', 'gluten-free']],
  };
  const catName = new Map((await Category.find()).map((c) => [String(c._id), c.name]));
  let n = 0;
  for (const p of await Product.find({ harvestedOn: { $exists: false } })) {
    const [storage, tags] = INFO[catName.get(String(p.category))] || [];
    if (!storage) continue;
    await Product.updateOne({ _id: p._id }, { $set: { storage, tags, harvestedOn: new Date(Date.now() - (n++ % 3) * 24 * 3600 * 1000) } });
  }

  // Attach a photo (uploads/catalog/<slug>.jpg) to every product that has one and no image yet.
  for (const p of await Product.find({ image: { $in: [null, ''] } })) {
    const file = `${slug(p.name)}.jpg`;
    if (fs.existsSync(path.join(__dirname, '..', 'uploads', 'catalog', file))) await Product.updateOne({ _id: p._id }, { $set: { image: `/uploads/catalog/${file}` } });
  }

  // Upserts skip model hooks, so give any new product its readable URL slug now.
  for (const p of await Product.find({ slug: { $exists: false } })) await p.save({ validateModifiedOnly: true });

  console.log(`Catalog ready: ${await Market.countDocuments()} markets, ${await User.countDocuments({ role: 'farmer' })} farmers, ${await Category.countDocuments()} categories, ${await Product.countDocuments()} products (${added} new).`);
  console.log(`New farmer logins use password: ${PASSWORD}`);
  await mongoose.disconnect();
})().catch((error) => { console.error(error); process.exit(1); });
