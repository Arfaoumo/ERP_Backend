const FinancialReport = require('../models/FinancialReport');
const Sale = require('../models/Sale');
const SupplierOrder = require('../models/SupplierOrder');
const { Parser } = require('json2csv');

const exportData = async (req, res, next) => {
  try {
    const { type } = req.params; 

        let data;
    let fields;

    const typeMap = {
      'Quote': 'Devis',
      'Order': 'Commande',
      'DeliveryNote': 'Bon de Livraison',
      'Invoice': 'Facture'
    };

    const statusMap = {
      'Pending': 'En Attente',
      'In Progress': 'En Cours',
      'Completed': 'Terminé',
      'Cancelled': 'Annulé',
      'Approved': 'Approuvé',
      'Shipped': 'Expédié',
      'Received': 'Reçu'
    };

    const paymentMap = {
      'Unpaid': 'Non Payé',
      'Partial': 'Partiel',
      'Paid': 'Payé',
      'Overdue': 'En Retard'
    };

    if (type === 'sales') {
      const sales = await Sale.find().populate('customer', 'name email').sort({ createdAt: -1 });
      data = sales.map(s => ({
        'Identifiant': s.documentNumber,
        'Date': new Date(s.createdAt).toLocaleDateString('fr-FR'),
        'Type': typeMap[s.documentType] || s.documentType,
        'Client': s.customer ? s.customer.name : 'Inconnu',
        'Total': s.totalAmount,
        'Statut': statusMap[s.status] || s.status,
        'Paiement': s.documentType === 'Invoice' ? (paymentMap[s.paymentStatus] || s.paymentStatus) : '-'
      }));
      fields = ['Identifiant', 'Date', 'Type', 'Client', 'Total', 'Statut', 'Paiement'];
    } else if (type === 'purchases') {
      const purchases = await SupplierOrder.find().populate('supplier', 'name').sort({ createdAt: -1 });
      data = purchases.map(p => ({
        'Identifiant': p.documentNumber,
        'Date': new Date(p.createdAt).toLocaleDateString('fr-FR'),
        'Fournisseur': p.supplier ? p.supplier.name : 'Inconnu',
        'Total': p.totalAmount,
        'Statut': statusMap[p.status] || p.status
      }));
      fields = ['Identifiant', 'Date', 'Fournisseur', 'Total', 'Statut'];
    } else {
      return res.status(400).json({ message: 'Invalid export type. Use "sales" or "purchases".' });
    }

    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(data);

    res.header('Content-Type', 'text/csv');
    res.attachment(`${type}_export_${new Date().toISOString().split('T')[0]}.csv`);
    return res.send(csv);

  } catch (error) {
    next(error);
  }
};

const getReports = async (req, res, next) => {
  try {
    const reports = await FinancialReport.find().sort({ year: -1, month: -1 });
    res.json(reports);
  } catch (error) {
    next(error);
  }
};

const generateMonthlySummary = async (req, res, next) => {
  try {
    const { month, year } = req.body; 

        const targetMonth = month !== undefined ? parseInt(month) : new Date().getMonth();
    const targetYear = year !== undefined ? parseInt(year) : new Date().getFullYear();

    const firstDay = new Date(targetYear, targetMonth, 1);
    const lastDay = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59, 999);

    const salesData = await Sale.aggregate([
      { $match: { documentType: 'Invoice', paymentStatus: 'Paid', createdAt: { $gte: firstDay, $lte: lastDay } } },
      { $group: { _id: null, totalRevenue: { $sum: "$amountPaid" }, count: { $sum: 1 } } }
    ]);
    const totalRevenue = salesData.length > 0 ? salesData[0].totalRevenue : 0;
    const salesCount = salesData.length > 0 ? salesData[0].count : 0;

    const purchasesData = await SupplierOrder.aggregate([
      { $match: { status: { $ne: 'Cancelled' }, createdAt: { $gte: firstDay, $lte: lastDay } } },
      { $group: { _id: null, totalPurchases: { $sum: "$totalAmount" }, count: { $sum: 1 } } }
    ]);
    const totalPurchases = purchasesData.length > 0 ? purchasesData[0].totalPurchases : 0;
    const purchasesCount = purchasesData.length > 0 ? purchasesData[0].count : 0;

    const profit = totalRevenue - totalPurchases;

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const monthName = monthNames[targetMonth];

    let report = await FinancialReport.findOne({ month: monthName, year: targetYear });

        if (report) {
      report.totalRevenue = totalRevenue;
      report.totalPurchases = totalPurchases;
      report.profit = profit;
      report.salesCount = salesCount;
      report.purchasesCount = purchasesCount;
      await report.save();
    } else {
      report = await FinancialReport.create({
        month: monthName,
        year: targetYear,
        totalRevenue,
        totalPurchases,
        profit,
        salesCount,
        purchasesCount
      });
    }

    if (res) {
      res.status(201).json(report);
    } else {
      return report; 
    }

  } catch (error) {
    if (res) next(error);
    else console.error('Error generating monthly report:', error);
  }
};

module.exports = { exportData, getReports, generateMonthlySummary };
