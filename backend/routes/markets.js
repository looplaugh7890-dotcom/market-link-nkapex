const router = require('express').Router();
const controller = require('../controllers/marketController');
const { protect, authorize } = require('../middleware/auth');

router.get('/', controller.listMarkets);
router.get('/:id', controller.getMarket);
router.post('/', protect, authorize('admin'), controller.createMarket);
router.put('/:id', protect, authorize('admin'), controller.updateMarket);
router.delete('/:id', protect, authorize('admin'), controller.deleteMarket);

module.exports = router;
