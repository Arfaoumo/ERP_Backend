const express = require('express');
const router = express.Router();
const { getSales, getSaleById, createSale, updateSaleStatus, convertSale, updatePaymentStatus, cancelQuote, generateSalePdf } = require('../controllers/saleController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { validate, validateObjectId } = require('../middleware/validationMiddleware');
const schemas = require('../validation/schemas');

router.route('/')
  .get(protect, authorize('Admin', 'Employee_Commercial'), getSales)
  .post(protect, authorize('Admin', 'Employee_Commercial'), validate(schemas.saleCreate), createSale);

router.route('/quotes/:id/cancel')
  .patch(protect, authorize('Admin', 'Employee_Commercial'), validateObjectId(), cancelQuote)
  .put(protect, authorize('Admin', 'Employee_Commercial'), validateObjectId(), cancelQuote);

router.route('/:id')
  .get(protect, authorize('Admin', 'Employee_Commercial'), validateObjectId(), getSaleById);

router.route('/:id/pdf')
  .get(protect, authorize('Admin', 'Employee_Commercial', 'Employee_Finance', 'Employee_Stocks'), validateObjectId(), generateSalePdf);

router.route('/:id/cancel')
  .patch(protect, authorize('Admin', 'Employee_Commercial'), validateObjectId(), cancelQuote)
  .put(protect, authorize('Admin', 'Employee_Commercial'), validateObjectId(), cancelQuote);

router.route('/:id/status')
  .put(protect, authorize('Admin', 'Employee_Commercial'), validateObjectId(), validate(schemas.saleStatus), updateSaleStatus);

router.route('/:id/convert')
  .post(protect, authorize('Admin', 'Employee_Commercial'), validateObjectId(), convertSale);

router.route('/:id/payment')
  .put(protect, authorize('Admin', 'Employee_Commercial'), validateObjectId(), validate(schemas.payment), updatePaymentStatus);

module.exports = router;
