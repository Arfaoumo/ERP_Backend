const mongoose = require('mongoose');

const deliveryCompanySchema = new mongoose.Schema({
  name: { type: String, required: true, uppercase: true, unique: true },
  code: { type: String, lowercase: true },
  contactEmail: { type: String, lowercase: true },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('DeliveryCompany', deliveryCompanySchema);
