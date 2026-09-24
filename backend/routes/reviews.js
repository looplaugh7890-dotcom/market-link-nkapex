const router = require('express').Router();
const controller = require('../controllers/reviewController');
const { protect, authorize } = require('../middleware/auth');

router.get('/', controller.listReviews);
router.get('/order/:orderId', protect, authorize('customer'), controller.orderReviews);
router.get('/mine', protect, authorize('farmer'), controller.myReviews);
router.post('/', protect, authorize('customer'), controller.createReview);
router.put('/:id/reply', protect, authorize('farmer'), controller.replyToReview);
router.delete('/:id', protect, authorize('customer', 'admin'), controller.deleteReview);

module.exports = router;
