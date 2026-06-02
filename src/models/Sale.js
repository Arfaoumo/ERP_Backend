const mongoose = require('mongoose');

const saleItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  quantity: { type: Number, required: true },
  sellingPrice: { type: Number, required: true },
  subtotal: { type: Number, required: true }
});

const saleSchema = new mongoose.Schema({
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  documentNumber: { type: String, required: true, unique: true }, // Replaces invoiceNumber to cover Quotes/Orders
  documentType: { type: String, enum: ['Quote', 'Order', 'DeliveryNote', 'Invoice'], default: 'Quote' },
  parentDocument: { type: mongoose.Schema.Types.ObjectId, ref: 'Sale', default: null }, // Traces back to Quote/Order
  courier: { type: String, default: 'NONE', uppercase: true },
  items: [saleItemSchema],
  totalAmount: { type: Number, required: true },
  taxAmount: { type: Number, default: 0 },
  totalWithTax: { type: Number, default: 0 },
  amountPaid: { type: Number, default: 0 },
  remainingBalance: { type: Number, default: 0 },
  payments: [{
    amount: { type: Number, required: true },
    paymentMethod: { type: String, enum: ['Cash', 'Check'], required: true },
    checkStatus: { type: String, enum: ['Pending', 'Cleared', 'Bounced', 'None'], default: 'None' },
    date: { type: Date, default: Date.now }
  }],
  status: { type: String, enum: ['Pending', 'Processed', 'Shipped', 'Cancelled', 'Finalized', 'In Transit', 'Delivered', 'Partially Paid', 'Overdue'], default: 'Pending' },
  paymentStatus: { type: String, enum: ['Paid', 'Pending', 'Overdue', 'Partially Paid'], default: 'Pending' }
}, { timestamps: true });

saleSchema.pre('save', function(next) {
  if (this.isNew || this.isModified('totalWithTax') || this.isModified('amountPaid')) {
    this.remainingBalance = Number((this.totalWithTax - this.amountPaid).toFixed(2));
  }
  next();
});

module.exports = mongoose.model('Sale', saleSchema);

