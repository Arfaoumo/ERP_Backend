const express = require('express');
const router = express.Router();
const { getOrders, createOrder, updateOrderStatus } = require('../controllers/supplierOrderController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { validate, validateObjectId } = require('../middleware/validationMiddleware');
const schemas = require('../validation/schemas');

router.route('/')
  .get(protect, authorize('Admin', 'Employee_Achats'), getOrders)
  .post(protect, authorize('Admin', 'Employee_Achats'), validate(schemas.purchaseCreate), createOrder);

router.route('/:id/status')
  .put(protect, authorize('Admin', 'Employee_Achats'), validateObjectId(), validate(schemas.purchaseStatus), updateOrderStatus);

module.exports = router;
