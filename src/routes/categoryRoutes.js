const express = require('express');
const router = express.Router();
const { getCategories, createCategory, updateCategory } = require('../controllers/categoryController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { validate, validateObjectId } = require('../middleware/validationMiddleware');
const schemas = require('../validation/schemas');

router.route('/')
  .get(protect, getCategories)
  .post(protect, authorize('Admin', 'Employee_Stocks'), validate(schemas.categoryCreate), createCategory);

router.route('/:id')
  .put(protect, authorize('Admin', 'Employee_Stocks'), validateObjectId(), validate(schemas.categoryUpdate), updateCategory);

module.exports = router;
