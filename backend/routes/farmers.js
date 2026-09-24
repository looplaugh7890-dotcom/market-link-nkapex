const router = require('express').Router();
const controller = require('../controllers/farmerController');
const { protect, authorize } = require('../middleware/auth');

router.get('/', controller.listFarmers);
router.get('/dashboard', protect, authorize('farmer'), controller.dashboard);
router.put('/profile', protect, authorize('farmer'), controller.updateProfile);
router.get('/:id', controller.getFarmer);

module.exports = router;
