const router = require('express').Router();
const controller = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect, authorize('admin'));
router.get('/dashboard', controller.dashboard);
router.get('/search', controller.search);
router.get('/audit', controller.listAudit);
router.get('/export/:type', controller.exportCsv);
router.patch('/users/bulk', controller.bulkUsers);
router.get('/users', controller.listUsers);
router.patch('/farmers/:id/status', controller.setFarmerStatus);
router.patch('/users/:id/active', controller.setCustomerActive);
router.get('/reviews', controller.listReviews);
router.get('/reports', controller.listReports);
router.post('/reports', controller.generateReport);
router.post('/announcements', controller.createAnnouncement);
router.delete('/announcements/:id', controller.deleteAnnouncement);

module.exports = router;
