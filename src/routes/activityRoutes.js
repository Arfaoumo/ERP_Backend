const express = require('express');
const router = express.Router();
const { getActivityLogs } = require('../controllers/activityController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Only Admins can see system logs
router.get('/', protect, authorize('Admin'), getActivityLogs);

module.exports = router;
