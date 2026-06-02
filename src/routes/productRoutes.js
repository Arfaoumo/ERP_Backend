const express = require('express');
const router = express.Router();
const { getProducts, createProduct, updateProduct, adjustStock, getStockMovements } = require('../controllers/productController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.route('/')
  .get(protect, getProducts)
  .post(protect, authorize('Admin', 'Employee_Stocks'), createProduct);

router.route('/movements')
  .get(protect, authorize('Admin', 'Employee_Stocks'), getStockMovements);

router.route('/:id')
  .put(protect, authorize('Admin', 'Employee_Stocks'), updateProduct);

router.route('/:id/stock')
  .post(protect, authorize('Admin', 'Employee_Stocks'), adjustStock);

module.exports = router;
