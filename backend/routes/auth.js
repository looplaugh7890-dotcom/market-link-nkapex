const router = require('express').Router();
const controller = require('../controllers/authController');
const { protect } = require('../middleware/auth');

router.post('/register', controller.registerCustomer);
router.post('/register-farmer', controller.registerFarmer);
router.post('/login', controller.login);
router.get('/me', protect, controller.getMe);
router.put('/me', protect, controller.updateMe);
router.put('/password', protect, controller.changePassword);

module.exports = router;
