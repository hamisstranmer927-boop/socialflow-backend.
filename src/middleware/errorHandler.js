/**
 * Centralized error handling middleware.
 * Must be registered LAST in the middleware chain.
 */

// Custom API Error class
class ApiError extends Error {
  constructor(statusCode, message, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
  }
}

/**
 * 404 handler — catches unmatched routes
 */
function notFoundHandler(req, res, next) {
  const error = new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`);
  next(error);
}

/**
 * Global error handler
 */
function errorHandler(err, req, res, _next) {
  // Default values
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  let details = err.details || null;

  // Sequelize validation errors
  if (err.name === 'SequelizeValidationError' || err.name === 'SequelizeUniqueConstraintError') {
    statusCode = 400;
    message = 'Validation error';
    details = err.errors?.map((e) => ({
      field: e.path,
      message: e.message,
    }));
  }

  // Joi validation errors
  if (err.isJoi) {
    statusCode = 400;
    message = 'Validation error';
    details = err.details?.map((d) => ({
      field: d.path?.join('.'),
      message: d.message,
    }));
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  }
  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
  }

  // Log server errors
  if (statusCode >= 500) {
    console.error('🔥 Server Error:', {
      statusCode,
      message: err.message,
      stack: err.stack,
      url: req.originalUrl,
      method: req.method,
    });
  }

  // Send response
  const response = {
    success: false,
    error: message,
  };

  if (details) {
    response.details = details;
  }

  // Include stack trace in development
  if (process.env.NODE_ENV === 'development' && statusCode >= 500) {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
}

module.exports = { ApiError, notFoundHandler, errorHandler };
