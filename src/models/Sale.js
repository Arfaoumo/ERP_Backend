const mongoose = require('mongoose');

const saleItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  quantity: { type: Number, required: true },
  sellingPrice: { type: Number, required: true },
  subtotal: { type: Number, required: true }
});

const saleSchema = new mongoose.Schema({
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  documentNumber: { type: String, required: true, unique: true, immutable: true }, 
  documentType: { type: String, enum: ['Quote', 'Order', 'DeliveryNote', 'Invoice'], default: 'Quote' },
  parentDocument: { type: mongoose.Schema.Types.ObjectId, ref: 'Sale', default: null }, 
  courier: { type: String, default: 'NONE', uppercase: true },
  items: [saleItemSchema],
  totalAmount: { type: Number, required: true, min: 0 },
  taxAmount: { type: Number, default: 0, min: 0 },
  totalWithTax: { type: Number, default: 0, min: 0 },
  amountPaid: { type: Number, default: 0, min: 0 },
  remainingBalance: { type: Number, default: 0, min: 0 },
  payments: [{
    amount: { type: Number, required: true, min: 0.01 },
    paymentMethod: { type: String, enum: ['Cash', 'Check'], required: true },
    checkStatus: { type: String, enum: ['Pending', 'Cleared', 'Bounced', 'None'], default: 'None' },
    date: { type: Date, default: Date.now }
  }],
  status: { type: String, enum: ['Pending', 'Processed', 'Shipped', 'Cancelled', 'Finalized', 'In Transit', 'Delivered', 'Partially Paid', 'Overdue'], default: 'Pending' },
  paymentStatus: { type: String, enum: ['Paid', 'Pending', 'Overdue', 'Partially Paid'], default: 'Pending' }
}, { timestamps: true });

saleSchema.index(
  { parentDocument: 1, documentType: 1 },
  {
    unique: true,
    partialFilterExpression: { parentDocument: { $type: 'objectId' } }
  }
);

saleSchema.pre('save', function(next) {
  if (this.isNew || this.isModified('totalWithTax') || this.isModified('amountPaid')) {
    const total = this.totalWithTax > 0 ? this.totalWithTax : this.totalAmount;
    this.remainingBalance = Math.max(0, Number((total - this.amountPaid).toFixed(2)));
  }
  next();
});

module.exports = mongoose.model('Sale', saleSchema);

