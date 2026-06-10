const ActivityLog = require('../models/ActivityLog');
const User = require('../models/User');

const getActivityLogs = async (req, res, next) => {
  try {
    let query = {};
    
    // If not admin, only show logs from users with the exact same role
    if (req.user.role !== 'Admin') {
      const peers = await User.find({ role: req.user.role }).select('_id');
      const peerIds = peers.map(p => p._id);
      query = { user: { $in: peerIds } };
    }

    const logs = await ActivityLog.find(query)
      .populate('user', 'firstName lastName email role')
      .sort({ createdAt: -1 })
      .limit(200); // Keep it performant
    res.json(logs);
  } catch (error) {
    next(error);
  }
};

const createLog = async (userId, action, targetType, targetName, details) => {
  try {
    await ActivityLog.create({
      user: userId,
      action,
      targetType,
      targetName,
      details
    });
  } catch (error) {
    console.error('Activity Log Error:', error);
  }
};

module.exports = { getActivityLogs, createLog };
