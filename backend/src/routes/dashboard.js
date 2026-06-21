const express = require('express');
const router = express.Router();
const { getDashboard } = require('../controllers/dashboardController');
const { requireAuth } = require('../middleware/auth');

router.get('/', requireAuth, getDashboard);

module.exports = router;
