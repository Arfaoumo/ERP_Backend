const express = require('express');
const router = express.Router();
const { getCustomers, createCustomer, updateCustomer } = require('../controllers/customerController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { validate, validateObjectId } = require('../middleware/validationMiddleware');
const schemas = require('../validation/schemas');

router.route('/')
  .get(protect, authorize('Admin', 'Employee_Commercial'), getCustomers)
  .post(protect, authorize('Admin', 'Employee_Commercial'), validate(schemas.customerCreate), createCustomer);

router.route('/:id')
  .put(protect, authorize('Admin', 'Employee_Commercial'), validateObjectId(), validate(schemas.customerUpdate), updateCustomer);

module.exports = router;
