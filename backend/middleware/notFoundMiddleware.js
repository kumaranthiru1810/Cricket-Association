/**
 * middleware/notFoundMiddleware.js
 *
 * Reusable 404 error middleware & helpers for unmatched endpoints and missing resources.
 */

const DATA_NOT_FOUND_MESSAGE = 'Data not found';

/**
 * Create a standardized 404 Error instance.
 * @param {string} [message='Data not found']
 * @returns {Error}
 */
function createNotFoundError(message = DATA_NOT_FOUND_MESSAGE) {
  const err = new Error(message);
  err.status = 404;
  err.statusCode = 404;
  err.code = 'NOT_FOUND';
  return err;
}

/**
 * Send a standardized 404 JSON response.
 * @param {import('express').Response} res
 * @param {string} [message='Data not found']
 * @param {Record<string, any>} [extra={}]
 */
function sendNotFound(res, message = DATA_NOT_FOUND_MESSAGE, extra = {}) {
  return res.status(404).json({
    success: false,
    message,
    code: 'NOT_FOUND',
    ...extra
  });
}

/**
 * Express catch-all 404 middleware for any unmatched route / endpoint.
 * Mount this in server.js after all API routes and before the global error handler.
 */
function notFoundHandler(req, res, _next) {
  return sendNotFound(res, `404 Not Found: Cannot ${req.method} ${req.originalUrl}`, {
    method: req.method,
    path: req.originalUrl
  });
}

module.exports = {
  DATA_NOT_FOUND_MESSAGE,
  createNotFoundError,
  sendNotFound,
  notFoundHandler
};
