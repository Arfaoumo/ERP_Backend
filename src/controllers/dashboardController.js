const Product = require('../models/Product');
const SupplierOrder = require('../models/SupplierOrder');
const Customer = require('../models/Customer');
const Sale = require('../models/Sale');

const getMetrics = async (req, res, next) => {
  try {
    const trailing30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const purchasesData = await SupplierOrder.aggregate([
      {
        $match: {
          status: { $ne: 'Cancelled' },
          createdAt: { $gte: trailing30Days }
        }
      },
      {
        $group: {
          _id: null,
          totalPurchases: { $sum: "$totalAmount" },
          count: { $sum: 1 }
        }
      }
    ]);
    const purchasesThisMonth = purchasesData.length > 0 ? purchasesData[0].totalPurchases : 0;
    const purchasesCount = purchasesData.length > 0 ? purchasesData[0].count : 0;

    const stockData = await Product.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: null, totalValue: { $sum: { $multiply: ["$currentStock", "$buyingPrice"] } } } }
    ]);
    const totalStockValue = stockData.length > 0 ? stockData[0].totalValue : 0;

    const totalCustomers = await Customer.countDocuments();

    const activeProducts = await Product.countDocuments({ isActive: true });

    const pendingOrdersData = await Sale.aggregate([
      { $match: { documentType: 'Order', status: 'Pending' } },
      { $group: { _id: null, totalRevenue: { $sum: "$totalAmount" }, count: { $sum: 1 } } }
    ]);
    const pendingOrdersRevenue = pendingOrdersData.length > 0 ? pendingOrdersData[0].totalRevenue : 0;
    const pendingOrdersCount = pendingOrdersData.length > 0 ? pendingOrdersData[0].count : 0;

    const transitData = await Sale.aggregate([
      { $match: { documentType: 'DeliveryNote', status: 'In Transit' } },
      { $group: { _id: null, totalRevenue: { $sum: "$totalAmount" }, count: { $sum: 1 } } }
    ]);
    const transitRevenue = transitData.length > 0 ? transitData[0].totalRevenue : 0;
    const transitCount = transitData.length > 0 ? transitData[0].count : 0;

    const overdueData = await Sale.aggregate([
      { $match: { documentType: 'Invoice', paymentStatus: 'Overdue' } },
      { $group: { _id: null, totalRevenue: { $sum: "$remainingBalance" }, count: { $sum: 1 } } }
    ]);
    const overdueRevenue = overdueData.length > 0 ? overdueData[0].totalRevenue : 0;
    const overdueCount = overdueData.length > 0 ? overdueData[0].count : 0;

    const revenueData = await Sale.aggregate([
      {
        $match: {
          documentType: 'Invoice',
          status: { $ne: 'Cancelled' },
          createdAt: { $gte: trailing30Days }
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$totalWithTax" },
          count: { $sum: 1 }
        }
      }
    ]);
    const totalRevenueMonth = revenueData.length > 0 ? revenueData[0].totalRevenue : 0;
    const finalizedInvoicesCount = revenueData.length > 0 ? revenueData[0].count : 0;

    res.json({
      purchasesThisMonth,
      purchasesCount,
      totalStockValue,
      totalCustomers,
      activeProducts,
      pendingOrdersRevenue,
      pendingOrdersCount,
      transitRevenue,
      transitCount,
      overdueRevenue,
      overdueCount,
      totalRevenueMonth,
      finalizedInvoicesCount
    });

  } catch (error) {
    next(error);
  }
};

module.exports = { getMetrics };
