const SupplierOrder = require('../models/SupplierOrder');
const Product = require('../models/Product');
const StockMovement = require('../models/StockMovement');
const { createLog } = require('./activityController');

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
    const { supplier, documentNumber, documentType, parentDocument, products, totalAmount } = req.body;

        const order = await SupplierOrder.create({
      supplier,
      documentNumber,
      documentType,
      parentDocument,
      products,
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
    const order = await SupplierOrder.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const { status } = req.body;

    if (status === 'Received' && order.status !== 'Received') {
      for (const item of order.products) {
        if (!item.product) continue;
        const product = await Product.findById(item.product);
        if (product) {
          product.currentStock += item.quantity;
          await product.save();

          await StockMovement.create({
            product: product._id,
            type: 'IN',
            quantity: item.quantity,
            reason: `Reception of PO #${order.documentNumber}`,
            user: req.user._id
          });
        }
      }
      order.receivedDate = Date.now();
    }

    order.status = status;
    await order.save();

    await createLog(req.user._id, 'UPDATE', 'SupplierOrder', order.documentNumber, `Status changed to ${status}`);

    res.json(order);
  } catch (error) {
    next(error);
  }
};

module.exports = { getOrders, createOrder, updateOrderStatus };
