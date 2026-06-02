const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  action: { 
    type: String, 
    required: true // e.g., 'CREATE', 'UPDATE', 'DELETE', 'STOCK_ADJUST'
  },
  targetType: { 
    type: String, 
    required: true // e.g., 'Product', 'User', 'Supplier'
  },
  targetName: {
    type: String // Name of the product/user/supplier for quick reading
  },
  details: { 
    type: String 
  }
}, { timestamps: true });

module.exports = mongoose.model('ActivityLog', activityLogSchema);
