const mongoose = require('mongoose');

const supplierOrderSchema = mongoose.Schema({
  supplier: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Supplier' },
  documentNumber: { type: String, required: true, unique: true }, // Replaces orderNumber
  documentType: { type: String, enum: ['Request', 'Order'], default: 'Request' },
  parentDocument: { type: mongoose.Schema.Types.ObjectId, ref: 'SupplierOrder', default: null },
  products: [
    {
      product: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Product' },
      quantity: { type: Number, required: true },
      buyingPrice: { type: Number, required: true }
    }
  ],
  status: { type: String, required: true, enum: ['Pending', 'Received', 'Cancelled'], default: 'Pending' },
  paymentStatus: { type: String, enum: ['Unpaid', 'Partial', 'Paid'], default: 'Unpaid' },
  totalAmount: { type: Number, required: true, default: 0.0 },
  orderedBy: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
  receivedDate: { type: Date }
}, {
  timestamps: true,
});

const SupplierOrder = mongoose.model('SupplierOrder', supplierOrderSchema);
module.exports = SupplierOrder;
