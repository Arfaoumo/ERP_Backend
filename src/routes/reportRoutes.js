const express = require('express');
const router = express.Router();
const { exportData, getReports, generateMonthlySummary } = require('../controllers/reportController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.route('/')
  .get(protect, authorize('Admin', 'Employee_Commercial', 'Employee_Achats', 'Employee_Finance'), getReports);

router.route('/export/:type')
  .get(protect, authorize('Admin', 'Employee_Commercial', 'Employee_Achats', 'Employee_Finance'), exportData);

router.route('/generate')
  .post(protect, authorize('Admin', 'Employee_Finance'), generateMonthlySummary);

module.exports = router;
