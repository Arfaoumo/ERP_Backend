const express = require('express');
const router = express.Router();
const { getActivityLogs } = require('../controllers/activityController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.get('/', protect, getActivityLogs);

module.exports = router;
