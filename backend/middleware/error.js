const notFound = (req, res) => {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
};

const errorHandler = (err, req, res, next) => {
  let status = err.statusCode || 500;
  let message = err.message || 'Server error';

  if (err.name === 'CastError') {
    status = 400;
    message = `Invalid ${err.path}`;
  } else if (err.name === 'ValidationError') {
    status = 400;
    message = Object.values(err.errors).map((validationError) => validationError.message).join(', ');
  } else if (err.code === 11000) {
    status = 409;
    message = `Duplicate value for ${Object.keys(err.keyPattern || {}).join(', ') || 'field'}`;
  } else if (err.name === 'MulterError') {
    status = 400;
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'Invalid JSON body';
  }

  if (status >= 500) console.error(err);
  res.status(status).json({ success: false, message: status >= 500 ? 'Server error' : message });
};

module.exports = { notFound, errorHandler };
