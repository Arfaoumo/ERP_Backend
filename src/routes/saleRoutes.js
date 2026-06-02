const express = require('express');
const router = express.Router();
const { getSales, getSaleById, createSale, updateSaleStatus, convertSale, updatePaymentStatus, cancelQuote } = require('../controllers/saleController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.route('/')
  .get(protect, authorize('Admin', 'Employee_Commercial'), getSales)
  .post(protect, authorize('Admin', 'Employee_Commercial'), createSale);

router.route('/quotes/:id/cancel')
  .patch(protect, authorize('Admin', 'Employee_Commercial'), cancelQuote)
  .put(protect, authorize('Admin', 'Employee_Commercial'), cancelQuote);

router.route('/:id')
  .get(protect, authorize('Admin', 'Employee_Commercial'), getSaleById);

router.route('/:id/cancel')
  .patch(protect, authorize('Admin', 'Employee_Commercial'), cancelQuote)
  .put(protect, authorize('Admin', 'Employee_Commercial'), cancelQuote);

router.route('/:id/status')
  .put(protect, authorize('Admin', 'Employee_Commercial'), updateSaleStatus);

router.route('/:id/convert')
  .post(protect, authorize('Admin', 'Employee_Commercial'), convertSale);

router.route('/:id/payment')
  .put(protect, authorize('Admin', 'Employee_Commercial'), updatePaymentStatus);

module.exports = router;
