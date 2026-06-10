const express = require('express');
const router = express.Router();
const { getActivityLogs } = require('../controllers/activityController');
const { protect, authorize } = require('../middleware/authMiddleware');

// All users can see logs, but controller filters by role
router.get('/', protect, getActivityLogs);

module.exports = router;
