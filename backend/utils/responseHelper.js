/**
 * utils/responseHelper.js
 *
 * Reusable response helpers for consistent list payloads and
 * automatic "Data not found" messaging when lists are empty.
 */

const { DATA_NOT_FOUND_MESSAGE } = require('../middleware/notFoundMiddleware');

/**
 * Build a standardized list response payload.
 * Attaches `message: 'Data not found'` whenever the list is empty.
 *
 * @param {Array<any>} items
 * @param {Record<string, any>} [extra={}]
 * @returns {Record<string, any>}
 */
function buildListResponse(items, extra = {}) {
  const list = Array.isArray(items) ? items : [];
  const payload = {
    success: true,
    count: list.length,
    data: list,
    ...extra
  };

  if (list.length === 0 && !payload.message) {
    payload.message = DATA_NOT_FOUND_MESSAGE;
  }

  return payload;
}

/**
 * Send a standardized list JSON response.
 *
 * @param {import('express').Response} res
 * @param {Array<any>} items
 * @param {Record<string, any>} [extra={}]
 * @param {number} [status=200]
 */
function sendListResponse(res, items, extra = {}, status = 200) {
  return res.status(status).json(buildListResponse(items, extra));
}

/**
 * Attach `message: 'Data not found'` to a multi-collection payload
 * if all provided arrays are empty.
 *
 * @param {Record<string, any>} payload
 * @param {...Array<any>} arrays
 * @returns {Record<string, any>}
 */
function withEmptyDataMessage(payload, ...arrays) {
  const hasAnyItem = arrays.some((arr) => Array.isArray(arr) && arr.length > 0);
  if (!hasAnyItem && !payload.message) {
    return { ...payload, message: DATA_NOT_FOUND_MESSAGE };
  }
  return payload;
}

module.exports = {
  DATA_NOT_FOUND_MESSAGE,
  buildListResponse,
  sendListResponse,
  withEmptyDataMessage
};
