/**
 * @file Express error-handling middleware.
 * Captures thrown errors, ensures consistent HTTP status, and returns JSON response.
 */

/**
 * Global error handler for Express.
 * Ensures non-200 status codes, logs errors, and conditionally exposes stack trace.
 *
 * @param {Error} err - The error object
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {void}
 */
const errorHandler = (err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;

  console.error(`Error: ${err.message}`);
  console.error(err.stack);

  res.status(statusCode).json({
    success: false,
    message: err.message,
    stack:
      process.env.NODE_ENV === "production" ? "stack trace hidden" : err.stack,
  });
};

module.exports = errorHandler;
