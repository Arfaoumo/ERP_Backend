const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  contactName: { type: String },
  email: { type: String, required: true, unique: true },
  phone: { type: String },
  address: { type: String }, 
  cin: { type: String },
  shippingAddress: { type: String },
  totalSpent: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Customer', customerSchema);
