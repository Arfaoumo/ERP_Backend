const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name: { type: String, required: true, uppercase: true },
  taxRate: { type: Number, required: true, default: 0.19, min: 0, max: 1 },
  description: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Category', categorySchema);
