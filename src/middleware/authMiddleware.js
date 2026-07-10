const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { ApiError } = require('../utils/apiError');

const protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id);
      if (!req.user || !req.user.isActive) {
        return next(new ApiError(401, 'Not authorized, user is unavailable.'));
      }
      return next();
    } catch (error) {
      return next(new ApiError(401, 'Not authorized, token failed.'));
    }
  }
  if (!token) {
    return next(new ApiError(401, 'Not authorized, no token.'));
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role) && req.user.role !== 'Admin') {
      return next(new ApiError(403, 'User role is not authorized to access this route.'));
    }
    next();
  };
};

module.exports = { protect, authorize };
