// Usage: npm run db:images
// One-time (safe to re-run): copies every file in backend/uploads/ (including catalog/) into the MongoDB "images" collection.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Image = require('../models/Image');

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
const CONTENT_TYPES = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

// All image files below `folder`, as paths relative to the uploads directory.
const listImageFiles = (folder, prefix = '') =>
  fs.readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) return listImageFiles(path.join(folder, entry.name), relativePath);
    return CONTENT_TYPES[path.extname(entry.name).toLowerCase()] ? [relativePath] : [];
  });

(async () => {
  await connectDB();
  const files = listImageFiles(UPLOADS_DIR);
  for (const relativePath of files) {
    const data = fs.readFileSync(path.join(UPLOADS_DIR, relativePath));
    const contentType = CONTENT_TYPES[path.extname(relativePath).toLowerCase()];
    await Image.updateOne({ path: relativePath }, { $set: { contentType, data } }, { upsert: true });
  }
  console.log(`Imported ${files.length} image(s) into MongoDB.`);
  await mongoose.disconnect();
})();
