const Product = require('../models/Product');
const StockMovement = require('../models/StockMovement');
const { createLog } = require('./activityController');
const { ApiError } = require('../utils/apiError');
const { runInTransaction } = require('../utils/transaction');
const { deleteLocalUpload } = require('../utils/files');

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
    const product = new Product({
      name: req.body.name,
      sku: req.body.sku,
      category: req.body.category,
      description: req.body.description,
      sellingPrice: req.body.sellingPrice,
      buyingPrice: req.body.buyingPrice,
      minStockThreshold: req.body.minStockThreshold,
      imageUrl: req.body.imageUrl,
      isActive: req.body.isActive
    });
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
      let oldImageUrl = null;
      product.name = name || product.name;
      product.description = description || product.description;
      product.sellingPrice = sellingPrice || product.sellingPrice;
      product.buyingPrice = buyingPrice !== undefined ? buyingPrice : product.buyingPrice;
      product.minStockThreshold = minStockThreshold || product.minStockThreshold;
      if (isActive !== undefined) product.isActive = isActive;

            if (imageUrl !== undefined && imageUrl !== product.imageUrl) {
        oldImageUrl = product.imageUrl;
        product.imageUrl = imageUrl;
      }

      const updatedProduct = await product.save();
      await deleteLocalUpload(oldImageUrl);
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
    const qty = Number(quantity);
    if (!['IN', 'OUT'].includes(type)) throw new ApiError(400, 'Stock movement type must be IN or OUT.');
    if (!Number.isFinite(qty) || qty <= 0) throw new ApiError(400, 'Quantity must be a positive number.');
    if (typeof reason !== 'string' || !reason.trim()) throw new ApiError(400, 'Reason is required.');

    const result = await runInTransaction(async (session) => {
      const filter = { _id: productId };
      if (type === 'OUT') filter.currentStock = { $gte: qty };
      const product = await Product.findOneAndUpdate(
        filter,
        { $inc: { currentStock: type === 'IN' ? qty : -qty } },
        { new: true, session, runValidators: true }
      );
      if (!product) {
        const exists = await Product.exists({ _id: productId }).session(session);
        if (!exists) throw new ApiError(404, 'Product not found');
        throw new ApiError(409, 'Insufficient stock');
      }

      const [movement] = await StockMovement.create([{
        product: productId,
        type,
        quantity: qty,
        reason: reason.trim(),
        user: req.user._id
      }], { session });
      return { product, movement };
    });

    await createLog(req.user._id, 'STOCK_ADJUST', 'Product', result.product.name, `${type} adjustment: ${qty} units. Reason: ${reason.trim()}`);

    res.status(201).json(result);
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
