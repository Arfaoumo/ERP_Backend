const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  action: { 
    type: String, 
    required: true 
  },
  targetType: { 
    type: String, 
    required: true 
  },
  targetName: {
    type: String 
  },
  details: { 
    type: String 
  }
}, { timestamps: true });

module.exports = mongoose.model('ActivityLog', activityLogSchema);
