const ActivityLog = require('../models/ActivityLog');

const getActivityLogs = async (req, res, next) => {
  try {
    const logs = await ActivityLog.find({})
      .populate('user', 'firstName lastName email')
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
