const router = require('express').Router();
const controller = require('../controllers/customerController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect, authorize('customer'));
router.get('/favorites', controller.getFavorites);
router.put('/favorites/:type/:id', controller.addFavorite);
router.delete('/favorites/:type/:id', controller.removeFavorite);

module.exports = router;
