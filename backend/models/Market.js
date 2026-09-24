const mongoose = require('mongoose');
const { DAYS, slugify, uniqueSlug } = require('../utils/helpers');

const marketSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    slug: { type: String, trim: true, lowercase: true, unique: true, sparse: true },
    address: { type: String, required: true, trim: true },
    latitude: { type: Number, required: true, min: -90, max: 90 },
    longitude: { type: Number, required: true, min: -180, max: 180 },
    geo: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: undefined },
    },
    mapProvider: { type: String, enum: ['google', 'openstreetmap'], default: 'openstreetmap' },
    mapLink: { type: String, trim: true },
    operatingDays: [{ type: String, enum: DAYS }],
    openTime: { type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    closeTime: { type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

marketSchema.index({ geo: '2dsphere' });

marketSchema.pre('validate', async function () {
  if (!this.slug) this.slug = await uniqueSlug((candidate) => this.constructor.exists({ slug: candidate, _id: { $ne: this._id } }), slugify(this.name));
  if (this.latitude != null && this.longitude != null) {
    this.geo = { type: 'Point', coordinates: [this.longitude, this.latitude] };
  }
});

module.exports = mongoose.model('Market', marketSchema);
