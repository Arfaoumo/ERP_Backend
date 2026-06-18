const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select('-password');
      if (!req.user) {
        const msg = req.t ? req.t('error.userNotFound', { defaultValue: 'Not authorized, user not found' }) : 'Not authorized, user not found';
        return res.status(401).json({ message: msg });
      }
      return next();
    } catch (error) {
      res.status(401);
      const msg = req.t ? req.t('error.tokenFailed', { defaultValue: 'Not authorized, token failed' }) : 'Not authorized, token failed';
      return next(new Error(msg));
    }
  }
  if (!token) {
    res.status(401);
    const msg = req.t ? req.t('error.noToken', { defaultValue: 'Not authorized, no token' }) : 'Not authorized, no token';
    return next(new Error(msg));
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role) && req.user.role !== 'Admin') {
      res.status(403);
      const msg = req.t ? req.t('error.unauthorized', { defaultValue: `User role ${req.user.role} is not authorized to access this route` }) : `User role ${req.user.role} is not authorized to access this route`;
      return next(new Error(msg));
    }
    next();
  };
};

module.exports = { protect, authorize };
