const express = require('express');
const router = express.Router();
const { getProducts, createProduct, updateProduct, adjustStock, getStockMovements } = require('../controllers/productController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { validate, validateObjectId } = require('../middleware/validationMiddleware');
const schemas = require('../validation/schemas');

router.route('/')
  .get(protect, getProducts)
  .post(protect, authorize('Admin', 'Employee_Stocks', 'Employee_Achats'), validate(schemas.productCreate), createProduct);

router.route('/movements')
  .get(protect, authorize('Admin', 'Employee_Stocks'), getStockMovements);

router.route('/:id')
  .put(protect, authorize('Admin', 'Employee_Stocks'), validateObjectId(), validate(schemas.productUpdate), updateProduct);

router.route('/:id/stock')
  .post(protect, authorize('Admin', 'Employee_Stocks'), validateObjectId(), validate(schemas.stockAdjustment), adjustStock);

module.exports = router;
