const Product = require('../models/Product');
const Sale = require('../models/Sale');
const SupplierOrder = require('../models/SupplierOrder');
const User = require('../models/User');

const getAlerts = async (req, res, next) => {
  try {
    const userRole = req.user.role;
    let alerts = [];

    const canSeeLowStock = ['Admin', 'Employee_Stocks'].includes(userRole);
    const canSeeOverdueInvoices = ['Admin', 'Employee_Commercial', 'Employee_Finance'].includes(userRole);
    const canSeeDelayedSupplierOrders = ['Admin', 'Employee_Achats'].includes(userRole);
    const canSeeIncompleteProfiles = ['Admin', 'Employee_RH'].includes(userRole);

    if (canSeeLowStock) {
      const lowStockProducts = await Product.find({
        $expr: { $lte: ['$currentStock', '$minStockThreshold'] },
        isActive: true
      });

            lowStockProducts.forEach(product => {
        alerts.push({
          id: `ls_${product._id}`,
          type: 'LOW_STOCK',
          title: 'Stock Bas',
          message: `Le produit "${product.name}" est en rupture de stock ou presque.`,
          urgency: 'high',
          data: {
            productId: product._id,
            name: product.name,
            sku: product.sku,
            currentStock: product.currentStock,
            threshold: product.minStockThreshold
          }
        });
      });
    }

    if (canSeeOverdueInvoices) {
      const overdueSales = await Sale.find({ paymentStatus: 'Overdue' }).populate('customer', 'name');

            overdueSales.forEach(sale => {
        alerts.push({
          id: `oi_${sale._id}`,
          type: 'OVERDUE_PAYMENT',
          title: 'Paiement en retard',
          message: `La facture ${sale.documentNumber} est en retard.`,
          urgency: 'high',
          data: {
            saleId: sale._id,
            documentNumber: sale.documentNumber,
            customerName: sale.customer ? sale.customer.name : 'Client Inconnu',
            balance: sale.remainingBalance || sale.totalAmount
          }
        });
      });
    }

    if (canSeeDelayedSupplierOrders) {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const delayedOrders = await SupplierOrder.find({
        status: 'Pending',
        createdAt: { $lte: sevenDaysAgo }
      }).populate('supplier', 'name');

      delayedOrders.forEach(order => {
        alerts.push({
          id: `do_${order._id}`,
          type: 'DELAYED_SUPPLIER_ORDER',
          title: 'Commande fournisseur en retard',
          message: `La commande ${order.documentNumber} est en attente depuis plus de 7 jours.`,
          urgency: 'medium',
          data: {
            orderId: order._id,
            documentNumber: order.documentNumber,
            supplierName: order.supplier ? order.supplier.name : 'Fournisseur Inconnu',
            createdAt: order.createdAt
          }
        });
      });
    }

    if (canSeeIncompleteProfiles) {
      const incompleteUsers = await User.find({
        $or: [
          { avatarUrl: { $exists: false } },
          { avatarUrl: null },
          { avatarUrl: '' }
        ]
      });

      incompleteUsers.forEach(user => {
        alerts.push({
          id: `ip_${user._id}`,
          type: 'INCOMPLETE_PROFILE',
          title: 'Profil RH Incomplet',
          message: `Le profil de l'employé ${user.firstName} ${user.lastName} est incomplet (photo manquante).`,
          urgency: 'low',
          data: {
            userId: user._id,
            name: `${user.firstName} ${user.lastName}`,
            email: user.email,
            role: user.role
          }
        });
      });
    }

    res.json(alerts);

  } catch (error) {
    next(error);
  }
};

module.exports = { getAlerts };
