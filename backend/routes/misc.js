const router = require('express').Router();
const { ask } = require('../controllers/chatbotController');
const { uploadImage } = require('../controllers/uploadController');
const { protect, authorize } = require('../middleware/auth');

router.post('/chatbot', ask);
router.post('/uploads/image', protect, authorize('farmer', 'admin'), uploadImage);

module.exports = router;
