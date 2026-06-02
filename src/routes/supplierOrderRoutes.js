const express = require('express');
const router = express.Router();
const { getOrders, createOrder, updateOrderStatus } = require('../controllers/supplierOrderController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.route('/')
  .get(protect, authorize('Admin', 'Employee_Achats'), getOrders)
  .post(protect, authorize('Admin', 'Employee_Achats'), createOrder);

router.route('/:id/status')
  .put(protect, authorize('Admin', 'Employee_Achats'), updateOrderStatus);

module.exports = router;
