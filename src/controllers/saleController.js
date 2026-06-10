const Sale = require('../models/Sale');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const StockMovement = require('../models/StockMovement');
const { createLog } = require('./activityController');

const getSales = async (req, res, next) => {
  try {
    let sales = await Sale.find({})
      .populate('customer')
      .populate({ path: 'items.product', populate: { path: 'category' } })
      .sort({ createdAt: -1 });

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        let needsSave = false;
    for (let sale of sales) {
      let docNeedsSave = false;

      if (sale.remainingBalance === 0 && (sale.paymentStatus === 'Pending' || sale.paymentStatus === 'Partially Paid')) {
        sale.remainingBalance = sale.totalWithTax || sale.totalAmount;
        docNeedsSave = true;
      }

      if (sale.documentType === 'Invoice' && sale.remainingBalance > 0) {
        let referenceDate = sale.updatedAt; 
        if (sale.payments && sale.payments.length > 0) {
          referenceDate = sale.payments[sale.payments.length - 1].date;
        }

        if (referenceDate < thirtyDaysAgo && (sale.paymentStatus !== 'Overdue' || sale.status !== 'Overdue')) {
          sale.paymentStatus = 'Overdue';
          sale.status = 'Overdue';
          docNeedsSave = true;
        }
      }

      if (docNeedsSave) {
        await sale.save();
        needsSave = true;
      }
    }

        if (needsSave) {
      sales = await Sale.find({})
        .populate('customer')
        .populate({ path: 'items.product', populate: { path: 'category' } })
        .sort({ createdAt: -1 });
    }

    res.json(sales);
  } catch (error) {
    next(error);
  }
};

const getSaleById = async (req, res, next) => {
  try {
    const sale = await Sale.findById(req.params.id)
      .populate('customer')
      .populate({ path: 'items.product', populate: { path: 'category' } });

          if (sale) {
      res.json(sale);
    } else {
      res.status(404);
      throw new Error('Sale not found');
    }
  } catch (error) {
    next(error);
  }
};

const createSale = async (req, res, next) => {
  try {
    const { customer, documentNumber, documentType, parentDocument, items, totalAmount, courier } = req.body;

    let calculatedTaxAmount = 0;
    if (items && items.length > 0) {
      for (const item of items) {
        const product = await Product.findById(item.product).populate('category');
        const taxRate = product?.category?.taxRate ?? 0.19;
        calculatedTaxAmount += (item.subtotal * taxRate);
      }
    }

    const finalTaxAmount = Number(calculatedTaxAmount.toFixed(2));
    const finalTotalWithTax = Number((Number(totalAmount) + finalTaxAmount).toFixed(2));

    const sale = await Sale.create({
      customer, documentNumber, documentType, parentDocument, items, totalAmount, courier, status: 'Pending',
      taxAmount: finalTaxAmount,
      totalWithTax: finalTotalWithTax
    });

    const client = await Customer.findById(customer);
    await createLog(req.user._id, 'CREATE', 'Sale', documentNumber, `${documentType || 'Quote'} created for ${client?.name || 'Customer'}`);
    res.status(201).json(sale);
  } catch (error) {
    next(error);
  }
};

const updateSaleStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const sale = await Sale.findById(req.params.id);

    if (!sale) {
      res.status(404);
      throw new Error('Sale not found');
    }

    if (sale.status === 'Shipped') {
      res.status(400);
      throw new Error('Order already shipped');
    }

    if (status === 'Shipped') {
      for (const item of sale.items) {
        const product = await Product.findById(item.product);
        if (product) {
          product.currentStock -= item.quantity;
          await product.save();

          await StockMovement.create({
            product: product._id,
            type: 'OUT',
            quantity: item.quantity,
            reason: `Sales Order #${sale.documentNumber}`,
            user: req.user._id
          });
        }
      }

      const client = await Customer.findById(sale.customer);
      if (client) {
        client.totalSpent += sale.totalAmount;
        await client.save();
      }
    }

    sale.status = status;
    const updatedSale = await sale.save();

    await createLog(req.user._id, 'UPDATE', 'Sale', sale.documentNumber, `Order status changed to ${status}`);
    res.json(updatedSale);
  } catch (error) {
    next(error);
  }
};

const convertSale = async (req, res, next) => {
  try {
    const parent = await Sale.findById(req.params.id);
    if (!parent) return res.status(404).json({ message: 'Document not found' });

    let nextType = '';
    let docPrefix = '';

        if (parent.documentType === 'Quote') { nextType = 'Order'; docPrefix = 'ORD-'; }
    else if (parent.documentType === 'Order') { nextType = 'DeliveryNote'; docPrefix = 'DLV-'; }
    else if (parent.documentType === 'DeliveryNote') { nextType = 'Invoice'; docPrefix = 'INV-'; }
    else { return res.status(400).json({ message: 'Cannot convert this document further.' }); }

    const numericPart = parent.documentNumber.includes('-') ? parent.documentNumber.split('-')[1] : Date.now().toString().slice(-6);
    const newDocNumber = `${docPrefix}${numericPart}`;

    const newDoc = await Sale.create({
      customer: parent.customer,
      documentNumber: newDocNumber,
      documentType: nextType,
      parentDocument: parent._id,
      items: parent.items,
      totalAmount: parent.totalAmount,
      taxAmount: parent.taxAmount,
      totalWithTax: parent.totalWithTax,
      courier: parent.courier,
      status: nextType === 'DeliveryNote' ? 'In Transit' : 'Pending',
      paymentStatus: 'Pending'
    });

    if (nextType === 'DeliveryNote') {
      for (const item of newDoc.items) {
        const product = await Product.findById(item.product);
        if (product) {
          product.currentStock -= item.quantity;
          await product.save();
          await StockMovement.create({
            product: product._id, type: 'OUT', quantity: item.quantity,
            reason: `Delivery Note #${newDocNumber}`, user: req.user._id
          });
        }
      }
    }

    if (nextType === 'Invoice') {
      const client = await Customer.findById(newDoc.customer);
      if (client) {
        client.totalSpent += newDoc.totalAmount;
        await client.save();
      }
    }

    if (parent.documentType === 'DeliveryNote') {
      parent.status = 'Delivered';
    } else {
      parent.status = 'Processed';
    }
    await parent.save();

    await createLog(req.user._id, 'CREATE', 'Sale', newDocNumber, `Converted ${parent.documentType} to ${nextType}`);
    res.status(201).json(newDoc);
  } catch (error) {
    next(error);
  }
};

const updatePaymentStatus = async (req, res, next) => {
  try {
    const { amount, paymentMethod } = req.body;
    const sale = await Sale.findById(req.params.id);
    if (!sale) return res.status(404).json({ message: 'Sale not found' });

    if (amount) {
      sale.payments.push({ amount, paymentMethod, date: new Date() });
      sale.amountPaid += Number(amount);
      sale.remainingBalance = (sale.totalWithTax || sale.totalAmount) - sale.amountPaid;
    }

    if (sale.remainingBalance <= 0) {
      sale.paymentStatus = 'Paid';
      sale.status = 'Finalized';
    } else if (sale.amountPaid > 0) {
      sale.paymentStatus = 'Partially Paid';
      sale.status = 'Partially Paid';
    } else {
      sale.paymentStatus = 'Pending';
    }

    await sale.save();

    await createLog(req.user._id, 'UPDATE', 'Sale', sale.documentNumber, `Payment of ${amount} recorded via ${paymentMethod}. Status: ${sale.paymentStatus}`);
    res.json(sale);
  } catch (error) {
    next(error);
  }
};

const cancelQuote = async (req, res, next) => {
  try {
    const sale = await Sale.findById(req.params.id);
    if (!sale) return res.status(404).json({ message: 'Document not found' });

    if (sale.documentType === 'Quote' && sale.status === 'Pending') {
      sale.status = 'Cancelled';
      await sale.save();
      await createLog(req.user._id, 'UPDATE', 'Sale', sale.documentNumber, 'Pending quote cancelled');
      res.json({ message: 'Quote cancelled successfully', sale });
    } else {
      res.status(400);
      throw new Error('Only pending quotes can be cancelled');
    }
  } catch (error) {
    next(error);
  }
};

module.exports = { getSales, getSaleById, createSale, updateSaleStatus, convertSale, updatePaymentStatus, cancelQuote };
