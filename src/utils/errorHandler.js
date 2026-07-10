const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || (res.statusCode === 200 ? 500 : res.statusCode);
  let message = err.message || 'Internal server error.';
  let errors = Array.isArray(err.errors) ? err.errors : [];

  if (err.code === 11000) {
    statusCode = 409;
    message = 'A record with that unique value already exists.';
    errors = Object.keys(err.keyPattern || {}).map((field) => ({ field, message: 'Must be unique.' }));
  } else if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Database validation failed.';
    errors = Object.values(err.errors).map((error) => ({ field: error.path, message: error.message }));
  } else if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid ${err.path}.`;
    errors = [{ field: err.path, message: 'Invalid value.' }];
  } else if (err.name === 'MulterError') {
    statusCode = 400;
    message = err.code === 'LIMIT_FILE_SIZE' ? 'Uploaded file is too large.' : 'Invalid upload.';
  }

  if (statusCode >= 500 && process.env.NODE_ENV !== 'test') console.error(err);
  res.status(statusCode).json({
    success: false,
    message,
    errors
  });
};

module.exports = { errorHandler };
