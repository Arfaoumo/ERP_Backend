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
const { validate, validateObjectId } = require('../middleware/validationMiddleware');
const schemas = require('../validation/schemas');

router.route('/')
  .get(protect, getAvailableCouriers)
  .post(protect, authorize('Admin', 'Employee_Stocks'), validate(schemas.courierCreate), createCourier);

router.route('/all')
  .get(protect, authorize('Admin', 'Employee_Stocks'), getAllCouriers);

router.route('/:id')
  .put(protect, authorize('Admin', 'Employee_Stocks'), validateObjectId(), validate(schemas.courierUpdate), updateCourier);

router.route('/:id/toggle')
  .patch(protect, authorize('Admin', 'Employee_Stocks'), validateObjectId(), validate(schemas.courierToggle), toggleCourierStatus);

module.exports = router;
