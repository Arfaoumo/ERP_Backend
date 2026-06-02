const express = require('express');
const router = express.Router();
const { getSuppliers, createSupplier, updateSupplier } = require('../controllers/supplierController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.route('/')
  .get(protect, authorize('Admin', 'Employee_Achats'), getSuppliers)
  .post(protect, authorize('Admin', 'Employee_Achats'), createSupplier);

router.route('/:id')
  .put(protect, authorize('Admin', 'Employee_Achats'), updateSupplier);

module.exports = router;
