const crypto = require('crypto');
const multer = require('multer');
const Image = require('../models/Image');
const { AppError } = require('../utils/helpers');

const ALLOWED = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

// Keep the file in memory just long enough to store it in MongoDB.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) =>
    ALLOWED[file.mimetype] ? cb(null, true) : cb(new AppError('Only JPG, PNG or WEBP images are allowed', 400)),
}).single('image');

// POST /api/uploads/image (multipart, field "image") -> { url }
const uploadImage = (req, res, next) => {
  upload(req, res, async (error) => {
    if (error) return next(error);
    if (!req.file) return next(new AppError('No image uploaded', 400));
    try {
      // Random name + extension from the verified mime type (never trust the client filename).
      const path = crypto.randomBytes(16).toString('hex') + ALLOWED[req.file.mimetype];
      await Image.create({ path, contentType: req.file.mimetype, data: req.file.buffer });
      res.status(201).json({ success: true, url: `/uploads/${path}` });
    } catch (saveError) {
      next(saveError);
    }
  });
};

// GET /uploads/<path> — serve a stored image. Images never change under the same URL, so cache them hard.
const serveImage = async (req, res, next) => {
  try {
    const image = await Image.findOne({ path: [].concat(req.params.imagePath).join('/') }).select('contentType data');
    if (!image) return res.status(404).end();
    res.set({
      'Content-Type': image.contentType,
      'Cache-Control': 'public, max-age=604800, immutable',
      // The frontend runs on another origin, so allow it to embed these images.
      'Cross-Origin-Resource-Policy': 'cross-origin',
    });
    res.send(image.data);
  } catch (error) {
    next(error);
  }
};

module.exports = { uploadImage, serveImage };
