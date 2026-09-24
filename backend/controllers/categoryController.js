const Category = require('../models/Category');
const Product = require('../models/Product');
const { AppError, requireFields, cleanString } = require('../utils/helpers');
const cache = require('../utils/cache');
const { audit } = require('../utils/audit');

const listCategories = async (req, res) => {
  // ?all=true also returns deactivated categories (used by the admin settings page).
  const filter = req.query.all === 'true' ? {} : { isActive: true };
  // The public list is identical for everyone, so it is cached for 60s (cleared on any change below).
  const categories = await cache.cached(`categories:${req.query.all === 'true'}`, 60_000, () => Category.find(filter).sort('name').lean());
  res.json({ success: true, categories });
};

const createCategory = async (req, res) => {
  requireFields(req.body, ['name']);
  const category = await Category.create({ name: cleanString(req.body.name), description: cleanString(req.body.description) });
  cache.clear('categories:');
  cache.clear('home');
  audit(req, 'category.create', `Added category ${category.name}`, { type: 'category', id: category._id });
  res.status(201).json({ success: true, category });
};

const updateCategory = async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) throw new AppError('Category not found', 404);
  if (cleanString(req.body.name)) category.name = cleanString(req.body.name);
  if (req.body.description !== undefined) category.description = cleanString(req.body.description);
  if (typeof req.body.isActive === 'boolean') category.isActive = req.body.isActive;
  await category.save();
  cache.clear('categories:');
  cache.clear('home');
  audit(req, 'category.update', `Updated category ${category.name}${typeof req.body.isActive === 'boolean' ? (category.isActive ? ' (activated)' : ' (deactivated)') : ''}`, { type: 'category', id: category._id });
  res.json({ success: true, category });
};

const deleteCategory = async (req, res) => {
  if (await Product.exists({ category: req.params.id })) {
    throw new AppError('Category is in use by products; deactivate it instead', 409);
  }
  const category = await Category.findByIdAndDelete(req.params.id);
  if (!category) throw new AppError('Category not found', 404);
  cache.clear('categories:');
  cache.clear('home');
  audit(req, 'category.remove', `Deleted category ${category.name}`, { type: 'category', id: category._id });
  res.json({ success: true, message: 'Category removed' });
};

module.exports = { listCategories, createCategory, updateCategory, deleteCategory };
