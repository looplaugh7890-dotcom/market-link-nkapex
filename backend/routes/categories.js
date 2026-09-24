const router = require('express').Router();
const controller = require('../controllers/categoryController');
const { protect, authorize } = require('../middleware/auth');

router.get('/', controller.listCategories);
router.post('/', protect, authorize('admin'), controller.createCategory);
router.put('/:id', protect, authorize('admin'), controller.updateCategory);
router.delete('/:id', protect, authorize('admin'), controller.deleteCategory);

module.exports = router;
