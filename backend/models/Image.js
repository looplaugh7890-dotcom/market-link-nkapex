const mongoose = require('mongoose');

// Uploaded pictures live in MongoDB, so they travel with the database and survive server restarts/redeploys.
// `path` is what appears in the URL: /uploads/<path> (e.g. "3f9c...a1.png" or "catalog/apples.jpg").
const imageSchema = new mongoose.Schema(
  {
    path: { type: String, required: true, unique: true },
    contentType: { type: String, required: true },
    data: { type: Buffer, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Image', imageSchema);
