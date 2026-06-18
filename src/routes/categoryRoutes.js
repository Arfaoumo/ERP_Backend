const express = require('express');
const router = express.Router();
const { getCategories, createCategory, updateCategory } = require('../controllers/categoryController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.route('/')
  .get(protect, getCategories)
  .post(protect, authorize('Admin', 'Employee_Stocks'), createCategory);

router.route('/:id')
  .put(protect, authorize('Admin', 'Employee_Stocks'), updateCategory);

module.exports = router;
