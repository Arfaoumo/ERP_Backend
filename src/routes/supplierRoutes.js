const express = require('express');
const router = express.Router();
const { getSuppliers, createSupplier, updateSupplier } = require('../controllers/supplierController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { validate, validateObjectId } = require('../middleware/validationMiddleware');
const schemas = require('../validation/schemas');

router.route('/')
  .get(protect, authorize('Admin', 'Employee_Achats'), getSuppliers)
  .post(protect, authorize('Admin', 'Employee_Achats'), validate(schemas.supplierCreate), createSupplier);

router.route('/:id')
  .put(protect, authorize('Admin', 'Employee_Achats'), validateObjectId(), validate(schemas.supplierUpdate), updateSupplier);

module.exports = router;
