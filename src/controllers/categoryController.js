const Category = require('../models/Category');

const getCategories = async (req, res, next) => {
  try {
    const categories = await Category.find({}).sort({ name: 1 });
    res.json(categories);
  } catch (error) {
    next(error);
  }
};

const createCategory = async (req, res, next) => {
  try {
    const { name, taxRate, description } = req.body;
    const categoryExists = await Category.findOne({ name: name ? name.toUpperCase() : '' });
    if (categoryExists) {
      res.status(400);
      throw new Error('Category already exists');
    }
    const category = await Category.create({ name, taxRate, description });
    res.status(201).json(category);
  } catch (error) {
    next(error);
  }
};

const updateCategory = async (req, res, next) => {
  try {
    const { name, taxRate, description } = req.body;
    const category = await Category.findById(req.params.id);
    if (!category) {
      res.status(404);
      throw new Error('Category not found');
    }
    if (name) category.name = name.toUpperCase();
    if (taxRate !== undefined) category.taxRate = taxRate;
    if (description !== undefined) category.description = description;

        const updatedCategory = await category.save();
    res.json(updatedCategory);
  } catch (error) {
    next(error);
  }
};

module.exports = { getCategories, createCategory, updateCategory };
