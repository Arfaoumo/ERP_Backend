const mongoose = require('mongoose');

const supplierSchema = mongoose.Schema({
  name: { type: String, required: true },
  contactName: { type: String },
  email: { type: String, required: true, unique: true },
  phone: { type: String },
  address: { type: String },
  vatNumber: { type: String },
  isActive: { type: Boolean, default: true },
  products: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }]
}, {
  timestamps: true,
});

const Supplier = mongoose.model('Supplier', supplierSchema);
module.exports = Supplier;
