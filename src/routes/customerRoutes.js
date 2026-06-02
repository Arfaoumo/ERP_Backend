const express = require('express');
const router = express.Router();
const { getCustomers, createCustomer, updateCustomer } = require('../controllers/customerController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.route('/')
  .get(protect, authorize('Admin', 'Employee_Commercial'), getCustomers)
  .post(protect, authorize('Admin', 'Employee_Commercial'), createCustomer);

router.route('/:id')
  .put(protect, authorize('Admin', 'Employee_Commercial'), updateCustomer);

module.exports = router;
