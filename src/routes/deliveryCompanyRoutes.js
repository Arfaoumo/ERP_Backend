const express = require('express');
const router = express.Router();
const { 
  getAvailableCouriers,
  getAllCouriers,
  createCourier,
  updateCourier,
  toggleCourierStatus
} = require('../controllers/deliveryCompanyController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.route('/')
  .get(protect, getAvailableCouriers)
  .post(protect, authorize('Admin', 'Employee_Stocks'), createCourier);

router.route('/all')
  .get(protect, authorize('Admin', 'Employee_Stocks'), getAllCouriers);

router.route('/:id')
  .put(protect, authorize('Admin', 'Employee_Stocks'), updateCourier);

router.route('/:id/toggle')
  .patch(protect, authorize('Admin', 'Employee_Stocks'), toggleCourierStatus);

module.exports = router;
