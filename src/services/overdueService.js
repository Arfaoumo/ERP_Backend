const Sale = require('../models/Sale');

const processOverdueInvoices = async (now = new Date()) => {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - 30);

  return Sale.updateMany(
    {
      documentType: 'Invoice',
      paymentStatus: { $in: ['Pending', 'Partially Paid'] },
      remainingBalance: { $gt: 0 },
      updatedAt: { $lt: cutoff }
    },
    {
      $set: {
        paymentStatus: 'Overdue',
        status: 'Overdue'
      }
    }
  );
};

module.exports = { processOverdueInvoices };
