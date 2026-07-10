const SupplierOrder = require('../models/SupplierOrder');
const Product = require('../models/Product');
const StockMovement = require('../models/StockMovement');
const Supplier = require('../models/Supplier');
const { createLog } = require('./activityController');
const { ApiError } = require('../utils/apiError');
const { runInTransaction } = require('../utils/transaction');

const getOrders = async (req, res, next) => {
  try {
    const orders = await SupplierOrder.find({})
      .populate('supplier', 'name')
      .populate('orderedBy', 'firstName lastName')
      .populate('products.product', 'name sku')
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    next(error);
  }
};

const createOrder = async (req, res, next) => {
  try {
    const { supplier, documentNumber, documentType, parentDocument, products } = req.body;
    const supplierExists = await Supplier.exists({ _id: supplier, isActive: true });
    if (!supplierExists) throw new ApiError(404, 'Active supplier not found.');

    const productIds = [...new Set(products.map((item) => item.product))];
    const databaseProducts = await Product.find({ _id: { $in: productIds }, isActive: true });
    const byId = new Map(databaseProducts.map((product) => [product._id.toString(), product]));
    const safeProducts = products.map((item) => {
      const product = byId.get(item.product);
      if (!product) throw new ApiError(404, `Active product not found: ${item.product}`);
      return {
        product: product._id,
        quantity: Number(item.quantity),
        buyingPrice: Number(product.buyingPrice)
      };
    });
    const totalAmount = Number(safeProducts.reduce(
      (total, item) => total + (item.quantity * item.buyingPrice), 0
    ).toFixed(2));

    const order = await SupplierOrder.create({
      supplier,
      documentNumber,
      documentType,
      parentDocument,
      products: safeProducts,
      totalAmount,
      orderedBy: req.user._id
    });

    await createLog(req.user._id, 'CREATE', 'SupplierOrder', documentNumber, `${documentType || 'Request'} created for supplier ID: ${supplier}`);

    res.status(201).json(order);
  } catch (error) {
    next(error);
  }
};

const updateOrderStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['Received', 'Cancelled'].includes(status)) {
      throw new ApiError(400, 'Status must be Received or Cancelled.');
    }

    const result = await runInTransaction(async (session) => {
      const order = await SupplierOrder.findById(req.params.id).session(session);
      if (!order) throw new ApiError(404, 'Order not found');
      if (order.status === status) return { order, changed: false };
      if (order.status !== 'Pending') throw new ApiError(409, 'Only pending purchase orders can change status.');

      if (status === 'Received') {
        const quantitiesByProduct = new Map();
        for (const item of order.products) {
          const quantity = Number(item.quantity);
          if (!item.product || !Number.isFinite(quantity) || quantity <= 0) {
            throw new ApiError(400, 'Purchase order items must reference a product and a positive quantity.');
          }
          const productId = item.product.toString();
          quantitiesByProduct.set(productId, (quantitiesByProduct.get(productId) || 0) + quantity);
        }

        for (const [productId, quantity] of quantitiesByProduct) {
          const product = await Product.findByIdAndUpdate(
            productId,
            { $inc: { currentStock: quantity } },
            { new: true, session, runValidators: true }
          );
          if (!product) throw new ApiError(404, `Product not found for item: ${productId}`);

          await StockMovement.create([{
            product: product._id,
            type: 'IN',
            quantity,
            reason: `Reception of PO #${order.documentNumber}`,
            user: req.user._id,
            sourceType: 'SupplierOrder',
            sourceDocument: order._id
          }], { session });
        }
        order.receivedDate = new Date();
      }

      order.status = status;
      await order.save({ session });
      return { order, changed: true };
    });

    if (result.changed) {
      await createLog(req.user._id, 'UPDATE', 'SupplierOrder', result.order.documentNumber, `Status changed to ${status}`);
    }
    res.json(result.order);
  } catch (error) {
    if (error?.code === 11000) {
      const existing = await SupplierOrder.findById(req.params.id);
      if (existing?.status === 'Received') return res.json(existing);
    }
    next(error);
  }
};

module.exports = { getOrders, createOrder, updateOrderStatus };
