const router = require('express').Router();
const controller = require('../controllers/customerController');
const { listAnnouncements } = require('../controllers/adminController');
const { protect } = require('../middleware/auth');

router.use(protect);
router.get('/', controller.listNotifications);
router.get('/announcements', listAnnouncements);
router.patch('/read-all', controller.markAllRead);
router.patch('/:id/read', controller.markRead);

module.exports = router;
