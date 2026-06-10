const express = require('express');
const router = express.Router();
const { getMetrics } = require('../controllers/dashboardController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.route('/metrics').get(protect, getMetrics);

module.exports = router;
