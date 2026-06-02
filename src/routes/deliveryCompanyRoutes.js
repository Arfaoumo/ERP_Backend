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
  .post(protect, authorize('Admin'), createCourier);

router.route('/all')
  .get(protect, authorize('Admin'), getAllCouriers);

router.route('/:id')
  .put(protect, authorize('Admin'), updateCourier);

router.route('/:id/toggle')
  .patch(protect, authorize('Admin'), toggleCourierStatus);

module.exports = router;
