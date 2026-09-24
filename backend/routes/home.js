const router = require('express').Router();
const { summary } = require('../controllers/homeController');

router.get('/', summary);

module.exports = router;
