const Product = require('../models/Product');
const StockMovement = require('../models/StockMovement');
const fs = require('fs');
const path = require('path');
const { createLog } = require('./activityController');

const getProducts = async (req, res, next) => {
  try {
    const products = await Product.find({});
    res.json(products);
  } catch (error) {
    next(error);
  }
};

const createProduct = async (req, res, next) => {
  try {
    const product = new Product(req.body);
    const createdProduct = await product.save();
    await createLog(req.user._id, 'CREATE', 'Product', createdProduct.name, `New product created with SKU: ${createdProduct.sku}`);
    res.status(201).json(createdProduct);
  } catch (error) {
    next(error);
  }
};

const updateProduct = async (req, res, next) => {
  try {
    const { name, description, sellingPrice, buyingPrice, minStockThreshold, imageUrl, isActive } = req.body;
    const product = await Product.findById(req.params.id);

    if (product) {
      product.name = name || product.name;
      product.description = description || product.description;
      product.sellingPrice = sellingPrice || product.sellingPrice;
      product.buyingPrice = buyingPrice !== undefined ? buyingPrice : product.buyingPrice;
      product.minStockThreshold = minStockThreshold || product.minStockThreshold;
      if (isActive !== undefined) product.isActive = isActive;
      
      if (imageUrl !== undefined && imageUrl !== product.imageUrl) {
        if (product.imageUrl && product.imageUrl.startsWith('/uploads')) {
          const oldFilePath = path.join(process.cwd(), product.imageUrl);
          if (fs.existsSync(oldFilePath)) {
            fs.unlinkSync(oldFilePath);
          }
        }
        product.imageUrl = imageUrl;
      }

      const updatedProduct = await product.save();
      await createLog(req.user._id, 'UPDATE', 'Product', updatedProduct.name, 'Product details updated');
      res.json(updatedProduct);
    } else {
      res.status(404);
      throw new Error('Product not found');
    }
  } catch (error) {
    next(error);
  }
};

const adjustStock = async (req, res, next) => {
  try {
    const { type, quantity, reason } = req.body;
    const productId = req.params.id;

    const product = await Product.findById(productId);
    if (!product) {
      res.status(404);
      throw new Error('Product not found');
    }

    const qty = Number(quantity);
    if (type === 'OUT' && product.currentStock < qty) {
      res.status(400);
      throw new Error('Insufficient stock');
    }

    product.currentStock = type === 'IN' ? product.currentStock + qty : product.currentStock - qty;
    await product.save();

    const movement = await StockMovement.create({
      product: productId,
      type,
      quantity: qty,
      reason,
      user: req.user._id
    });

    await createLog(req.user._id, 'STOCK_ADJUST', 'Product', product.name, `${type} adjustment: ${qty} units. Reason: ${reason}`);

    res.status(201).json({ product, movement });
  } catch (error) {
    next(error);
  }
};

const getStockMovements = async (req, res, next) => {
  try {
    const movements = await StockMovement.find({})
      .populate('product', 'name sku')
      .populate('user', 'firstName lastName')
      .sort({ createdAt: -1 });
    res.json(movements);
  } catch (error) {
    next(error);
  }
};

module.exports = { getProducts, createProduct, updateProduct, adjustStock, getStockMovements };
