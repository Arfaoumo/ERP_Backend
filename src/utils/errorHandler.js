const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || (res.statusCode === 200 ? 500 : res.statusCode);
  let message = err.message;

  if (err.code === 11000) {
    statusCode = 400;
    message = req.t ? req.t('error.duplicateField', { defaultValue: 'Duplicate field value entered. Please use a unique value.' }) : 'Duplicate field value entered. Please use a unique value.';
  }

  res.status(statusCode).json({
    message: message,
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
};

module.exports = { errorHandler };
