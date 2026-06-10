const mongoose = require('mongoose');

const financialReportSchema = new mongoose.Schema({
  month: { type: String, required: true }, 
  year: { type: Number, required: true },  
  totalRevenue: { type: Number, default: 0 },
  totalPurchases: { type: Number, default: 0 },
  profit: { type: Number, default: 0 },
  salesCount: { type: Number, default: 0 },
  purchasesCount: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('FinancialReport', financialReportSchema);
