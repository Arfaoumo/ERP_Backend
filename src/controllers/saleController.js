const Sale = require('../models/Sale');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const StockMovement = require('../models/StockMovement');
const { createLog } = require('./activityController');
const { ApiError } = require('../utils/apiError');
const { runInTransaction } = require('../utils/transaction');
const { roundMoney } = require('../utils/money');
const PDFDocument = require('pdfkit');

const getSales = async (req, res, next) => {
  try {
    const sales = await Sale.find({})
      .populate('customer')
      .populate({ path: 'items.product', populate: { path: 'category' } })
      .sort({ createdAt: -1 });
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
    const { customer, documentNumber, documentType, parentDocument, items, courier } = req.body;

    let calculatedTotalAmount = 0;
    let calculatedTaxAmount = 0;

    if (items && items.length > 0) {
      for (const item of items) {
        const product = await Product.findById(item.product).populate('category');
        if (!product) {
          res.status(404);
          throw new Error(`Product not found for ID: ${item.product}`);
        }
        const dbPrice = product.sellingPrice;
        item.sellingPrice = dbPrice;
        const itemSubtotal = Number((item.quantity * dbPrice).toFixed(2));
        item.subtotal = itemSubtotal;

        calculatedTotalAmount = Number((calculatedTotalAmount + itemSubtotal).toFixed(2));

        const taxRate = product?.category?.taxRate ?? 0.19;
        const itemTax = Number((itemSubtotal * taxRate).toFixed(2));
        calculatedTaxAmount = Number((calculatedTaxAmount + itemTax).toFixed(2));
      }
    }

    const finalTaxAmount = Number(calculatedTaxAmount.toFixed(2));
    const finalTotalAmount = Number(calculatedTotalAmount.toFixed(2));
    const finalTotalWithTax = Number((finalTotalAmount + finalTaxAmount).toFixed(2));

    const sale = await Sale.create({
      customer, documentNumber, documentType, parentDocument, items, totalAmount: finalTotalAmount, courier, status: 'Pending',
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

    if (status === sale.status) return res.json(sale);

    if (status === 'Shipped') {
      throw new ApiError(409, 'Shipping is recorded by converting an Order to a Delivery Note.');
    }

    throw new ApiError(400, 'Manual status transitions are not supported for sales documents.');
  } catch (error) {
    next(error);
  }
};

const convertSale = async (req, res, next) => {
  try {
    const result = await runInTransaction(async (session) => {
      const parent = await Sale.findById(req.params.id).session(session);
      if (!parent) throw new ApiError(404, 'Document not found');

      const transitions = {
        Quote: { nextType: 'Order', prefix: 'ORD-', expectedStatus: 'Pending', parentStatus: 'Processed' },
        Order: { nextType: 'DeliveryNote', prefix: 'DLV-', expectedStatus: 'Pending', parentStatus: 'Processed' },
        DeliveryNote: { nextType: 'Invoice', prefix: 'INV-', expectedStatus: 'In Transit', parentStatus: 'Delivered' }
      };
      const transition = transitions[parent.documentType];
      if (!transition) throw new ApiError(400, 'Cannot convert this document further.');

      const existing = await Sale.findOne({
        parentDocument: parent._id,
        documentType: transition.nextType
      }).session(session);
      if (existing) return { document: existing, parentType: parent.documentType, created: false };

      if (parent.status !== transition.expectedStatus) {
        throw new ApiError(409, `${parent.documentType} is not in a convertible state.`);
      }
      if (!parent.items.length) throw new ApiError(400, 'A sales document must contain at least one item.');

      const numericPart = parent.documentNumber.includes('-')
        ? parent.documentNumber.split('-').slice(1).join('-')
        : parent._id.toString().slice(-6);
      const newDocNumber = `${transition.prefix}${numericPart}`;

      if (parent.documentType === 'Order') {
        const quantitiesByProduct = new Map();
        for (const item of parent.items) {
          const quantity = Number(item.quantity);
          if (!Number.isFinite(quantity) || quantity <= 0) {
            throw new ApiError(400, 'Order item quantities must be positive numbers.');
          }
          const productId = item.product.toString();
          quantitiesByProduct.set(productId, (quantitiesByProduct.get(productId) || 0) + quantity);
        }

        for (const [productId, quantity] of quantitiesByProduct) {
          const product = await Product.findOneAndUpdate(
            { _id: productId, currentStock: { $gte: quantity } },
            { $inc: { currentStock: -quantity } },
            { new: true, session, runValidators: true }
          );
          if (!product) {
            const existingProduct = await Product.findById(productId).session(session);
            if (!existingProduct) throw new ApiError(404, `Product not found for item: ${productId}`);
            throw new ApiError(
              409,
              `Insufficient stock for product: ${existingProduct.name}. Available: ${existingProduct.currentStock}, Required: ${quantity}`
            );
          }

          await StockMovement.create([{
            product: product._id,
            type: 'OUT',
            quantity,
            reason: `Delivery Note #${newDocNumber}`,
            user: req.user._id,
            sourceType: 'Sale',
            sourceDocument: parent._id
          }], { session });
        }
      }

      const [newDoc] = await Sale.create([{
        customer: parent.customer,
        documentNumber: newDocNumber,
        documentType: transition.nextType,
        parentDocument: parent._id,
        items: parent.items,
        totalAmount: parent.totalAmount,
        taxAmount: parent.taxAmount,
        totalWithTax: parent.totalWithTax,
        courier: parent.courier,
        status: transition.nextType === 'DeliveryNote' ? 'In Transit' : 'Pending',
        paymentStatus: 'Pending'
      }], { session });

      if (transition.nextType === 'Invoice') {
        await Customer.updateOne(
          { _id: newDoc.customer },
          { $inc: { totalSpent: newDoc.totalAmount } },
          { session }
        );
      }

      parent.status = transition.parentStatus;
      await parent.save({ session });
      return { document: newDoc, parentType: parent.documentType, created: true };
    });

    if (result.created) {
      await createLog(
        req.user._id,
        'CREATE',
        'Sale',
        result.document.documentNumber,
        `Converted ${result.parentType} to ${result.document.documentType}`
      );
    }
    res.status(result.created ? 201 : 200).json(result.document);
  } catch (error) {
    if (error?.code === 11000) {
      const existing = await Sale.findOne({ parentDocument: req.params.id }).sort({ createdAt: -1 });
      if (existing) return res.status(200).json(existing);
    }
    next(error);
  }
};

const updatePaymentStatus = async (req, res, next) => {
  try {
    const { amount, paymentMethod } = req.body;
    const numericAmount = Number(amount);
    const roundedAmount = roundMoney(numericAmount);
    const allowedMethods = ['Cash', 'Check'];

    if (!Number.isFinite(numericAmount) || roundedAmount <= 0) {
      throw new ApiError(400, 'Payment amount must be a finite number greater than zero.');
    }
    if (!allowedMethods.includes(paymentMethod)) {
      throw new ApiError(400, 'Payment method must be Cash or Check.');
    }

    const sale = await runInTransaction(async (session) => {
      const invoice = await Sale.findById(req.params.id).session(session);
      if (!invoice) throw new ApiError(404, 'Sale not found');
      if (invoice.documentType !== 'Invoice') {
        throw new ApiError(400, 'Payments can only be recorded against invoices.');
      }
      if (invoice.status === 'Cancelled') {
        throw new ApiError(409, 'Cancelled invoices cannot receive payments.');
      }
      if (invoice.paymentStatus === 'Paid' || invoice.status === 'Finalized') {
        throw new ApiError(409, 'This invoice is already fully paid.');
      }

      const total = roundMoney(invoice.totalWithTax || invoice.totalAmount);
      const amountPaid = roundMoney(invoice.amountPaid || 0);
      const remaining = roundMoney(total - amountPaid);
      if (remaining <= 0) throw new ApiError(409, 'This invoice has no remaining balance.');
      if (roundedAmount > remaining) {
        throw new ApiError(409, `Payment exceeds the remaining balance of ${remaining.toFixed(2)}.`);
      }

      const newAmountPaid = roundMoney(amountPaid + roundedAmount);
      const newRemaining = roundMoney(total - newAmountPaid);
      invoice.payments.push({ amount: roundedAmount, paymentMethod, date: new Date() });
      invoice.amountPaid = newAmountPaid;
      invoice.remainingBalance = newRemaining;

      if (newRemaining === 0) {
        invoice.paymentStatus = 'Paid';
        invoice.status = 'Finalized';
      } else {
        invoice.paymentStatus = 'Partially Paid';
        invoice.status = 'Partially Paid';
      }

      await invoice.save({ session });
      return invoice;
    });

    await createLog(req.user._id, 'UPDATE', 'Sale', sale.documentNumber, `Payment of ${roundedAmount.toFixed(2)} recorded via ${paymentMethod}. Status: ${sale.paymentStatus}`);
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

const generateSalePdf = async (req, res, next) => {
  try {
    const sale = await Sale.findById(req.params.id)
      .populate('customer')
      .populate({ path: 'items.product', populate: { path: 'category' } });

    if (!sale) {
      res.status(404);
      throw new Error('Sale not found');
    }

    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${sale.documentNumber}.pdf"`);
    doc.pipe(res);

    const docTypeLabel = {
      'Invoice': 'FACTURE',
      'Quote': 'DEVIS',
      'Order': 'COMMANDE',
      'DeliveryNote': 'BON DE LIVRAISON'
    }[sale.documentType] || 'DOCUMENT';

    doc.fillColor('#0f172a')
       .fontSize(28)
       .font('Helvetica-Bold')
       .text(docTypeLabel, 50, 50);

    doc.fillColor('#64748b')
       .fontSize(10)
       .font('Courier-Bold')
       .text(`#${sale.documentNumber}`, 50, 85);

    doc.fillColor('#0f172a')
       .fontSize(12)
       .font('Helvetica-Bold')
       .text('Designet Web Agency', 350, 50, { align: 'right' });
    
    doc.fillColor('#64748b')
       .fontSize(9)
       .font('Helvetica')
       .text('Tunis, Tunisia', 350, 65, { align: 'right' })
       .text('contact@designet.tn', 350, 78, { align: 'right' });

    doc.strokeColor('#e2e8f0')
       .lineWidth(1)
       .moveTo(50, 110)
       .lineTo(545, 110)
       .stroke();

    const billToY = 130;
    doc.fillColor('#94a3b8')
       .fontSize(8)
       .font('Helvetica-Bold')
       .text('FACTURÉ À', 50, billToY);

    doc.fillColor('#0f172a')
       .fontSize(14)
       .font('Helvetica-Bold')
       .text(sale.customer?.name || 'Client Inconnu', 50, billToY + 15);

    const addressText = sale.customer?.address || sale.customer?.shippingAddress || 'N/A';
    const phoneText = sale.customer?.phone || 'N/A';
    const emailText = sale.customer?.email || 'N/A';
    const cinText = sale.customer?.cin || 'N/A';

    doc.fillColor('#334155')
       .fontSize(9)
       .font('Helvetica')
       .text(`ADRESSE : ${addressText}`, 50, billToY + 35, { width: 220 })
       .text(`TÉL : ${phoneText}`, 50, billToY + 60)
       .text(`EMAIL : ${emailText}`, 50, billToY + 75)
       .text(`CIN : ${cinText}`, 50, billToY + 90);

    doc.fillColor('#94a3b8')
       .fontSize(8)
       .font('Helvetica-Bold')
       .text(sale.documentType === 'Invoice' ? 'DÉTAILS DE LA FACTURE' : 'DÉTAILS DU DOCUMENT', 350, billToY);

    const docDate = new Date(sale.createdAt).toLocaleDateString('fr-FR');
    doc.fillColor('#334155')
       .fontSize(9)
       .font('Helvetica')
       .text(`DATE : ${docDate}`, 350, billToY + 15);

    if (['Invoice', 'DeliveryNote', 'Order', 'Quote'].includes(sale.documentType) && sale.courier && sale.courier.toUpperCase() !== 'NONE') {
      doc.text(`LIVRAISON PAR : ${sale.courier.toUpperCase()}`, 350, billToY + 30);
    }

    const tableHeaderY = 260;
    
    doc.fillColor('#f8fafc')
       .rect(50, tableHeaderY, 495, 20)
       .fill();

    doc.fillColor('#0f172a')
       .fontSize(8)
       .font('Helvetica-Bold')
       .text('DÉSIGNATION', 55, tableHeaderY + 6)
       .text('QTÉ', 230, tableHeaderY + 6, { width: 40, align: 'right' })
       .text('TVA', 280, tableHeaderY + 6, { width: 40, align: 'right' })
       .text('PRIX HT', 330, tableHeaderY + 6, { width: 60, align: 'right' })
       .text('PRIX TTC', 400, tableHeaderY + 6, { width: 60, align: 'right' })
       .text('TOTAL TTC', 470, tableHeaderY + 6, { width: 70, align: 'right' });

    doc.strokeColor('#0f172a')
       .lineWidth(1)
       .moveTo(50, tableHeaderY + 20)
       .lineTo(545, tableHeaderY + 20)
       .stroke();

    let currentY = tableHeaderY + 25;
    
    for (const item of sale.items) {
      const p = item.product || {};
      const taxRate = p.category?.taxRate ?? 0.19;
      const priceTTC = item.sellingPrice * (1 + taxRate);
      const totalTTC = item.quantity * priceTTC;

      doc.fillColor('#0f172a')
         .fontSize(9)
         .font('Helvetica-Bold')
         .text(p.name || 'Produit', 55, currentY);

      doc.fillColor('#94a3b8')
         .fontSize(8)
         .font('Courier')
         .text(p.sku || 'SKU-000', 55, currentY + 12);

      doc.fillColor('#334155')
         .fontSize(9)
         .font('Helvetica')
         .text(item.quantity.toString(), 230, currentY, { width: 40, align: 'right' })
         .text(`${(taxRate * 100).toFixed(0)}%`, 280, currentY, { width: 40, align: 'right' })
         .text(`€${item.sellingPrice.toFixed(2)}`, 330, currentY, { width: 60, align: 'right' })
         .text(`€${priceTTC.toFixed(2)}`, 400, currentY, { width: 60, align: 'right' })
         .text(`€${totalTTC.toFixed(2)}`, 470, currentY, { width: 70, align: 'right' });

      doc.strokeColor('#f1f5f9')
         .lineWidth(0.5)
         .moveTo(50, currentY + 28)
         .lineTo(545, currentY + 28)
         .stroke();

      currentY += 35;
    }

    const totalsY = currentY + 10;
    
    doc.fillColor('#64748b')
       .fontSize(9)
       .font('Helvetica')
       .text('Sous-total HT', 350, totalsY, { width: 100, align: 'left' });
    doc.fillColor('#0f172a')
       .font('Helvetica-Bold')
       .text(`€${(sale.totalAmount || 0).toFixed(2)}`, 450, totalsY, { width: 90, align: 'right' });

    doc.fillColor('#64748b')
       .font('Helvetica')
       .text('Montant TVA', 350, totalsY + 18, { width: 100, align: 'left' });
    doc.fillColor('#0f172a')
       .font('Helvetica-Bold')
       .text(`€${(sale.taxAmount || 0).toFixed(2)}`, 450, totalsY + 18, { width: 90, align: 'right' });

    doc.strokeColor('#0f172a')
       .lineWidth(1.5)
       .moveTo(350, totalsY + 36)
       .lineTo(545, totalsY + 36)
       .stroke();

    doc.fillColor('#0f172a')
       .fontSize(10)
       .font('Helvetica-Bold')
       .text('TOTAL TTC', 350, totalsY + 44, { width: 100, align: 'left' });
    doc.fillColor('#2563eb')
       .fontSize(16)
       .font('Helvetica-Bold')
       .text(`€${(sale.totalWithTax || sale.totalAmount).toFixed(2)}`, 450, totalsY + 42, { width: 90, align: 'right' });

    const footerY = totalsY + 100;
    doc.strokeColor('#f1f5f9')
       .lineWidth(1)
       .moveTo(50, footerY)
       .lineTo(545, footerY)
       .stroke();

    doc.fillColor('#94a3b8')
       .fontSize(8)
       .font('Helvetica-Bold')
       .text('Merci pour votre confiance'.toUpperCase(), 50, footerY + 15, { align: 'center', width: 495 });

    doc.end();

  } catch (error) {
    next(error);
  }
};

module.exports = { getSales, getSaleById, createSale, updateSaleStatus, convertSale, updatePaymentStatus, cancelQuote, generateSalePdf };
