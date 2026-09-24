// Usage: npm run db:export
// Writes the current collections to ../database/sample-data/*.json (MongoDB Extended JSON).
// Restore one with: mongoimport --uri "$MONGO_URI" --collection users --jsonArray --file users.json
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const { EJSON } = require('bson');

// Only this app's collections; the database may be shared with other projects.
const OWN = ['users', 'markets', 'categories', 'products', 'orders', 'reviews', 'notifications', 'announcements', 'reports'];
const OUT = path.join(__dirname, '..', '..', 'database', 'sample-data');

(async () => {
  await connectDB();
  fs.mkdirSync(OUT, { recursive: true });
  for (const name of OWN) {
    const docs = await mongoose.connection.db.collection(name).find().toArray();
    fs.writeFileSync(path.join(OUT, `${name}.json`), EJSON.stringify(docs, null, 2));
    console.log(`${name}: ${docs.length} document(s)`);
  }
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
