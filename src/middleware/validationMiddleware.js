const mongoose = require('mongoose');
const { ApiError } = require('../utils/apiError');

const validate = (schema, target = 'body') => (req, res, next) => {
  const result = schema.safeParse(req[target]);
  if (!result.success) {
    return next(new ApiError(
      400,
      'Request validation failed.',
      result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message
      }))
    ));
  }
  req[target] = result.data;
  next();
};

const validateObjectId = (param = 'id') => (req, res, next) => {
  if (!mongoose.isObjectIdOrHexString(req.params[param])) {
    return next(new ApiError(400, `Invalid ${param}.`, [{ field: param, message: 'Must be a valid ObjectId.' }]));
  }
  next();
};

module.exports = { validate, validateObjectId };
