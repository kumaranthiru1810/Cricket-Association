/**
 * middleware/cacheMiddleware.js
 * In-memory response cache for public GET endpoints (portal home, news, laws, master-settings, points table).
 * Enforces:
 * - Never cache authenticated requests (Authorization header or req.user).
 * - Never cache live-score or mutating endpoints.
 * - Invalidation mechanism for write operations.
 */

const cacheStore = new Map();

/**
 * Generate cache key based on URL and query params
 */
function getCacheKey(req) {
  return `${req.method}:${req.baseUrl || ''}${req.path}:${JSON.stringify(req.query || {})}`;
}

/**
 * Cache middleware factory
 * @param {number} ttlSeconds - Time-to-live in seconds (default 30s)
 * @param {string} tag - Invalidation tag (e.g. 'news', 'settings', 'portal')
 */
function cacheResponse(ttlSeconds = 30, tag = 'general') {
  return (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Never cache authenticated requests
    if (req.headers.authorization || req.headers['x-access-token'] || req.cookies?.token || req.user) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      return next();
    }

    // Never cache live scoring endpoints
    const originalUrl = req.originalUrl || req.url || '';
    if (originalUrl.includes('/live') || originalUrl.includes('/score') || originalUrl.includes('/scorer')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      return next();
    }

    const key = getCacheKey(req);
    const cached = cacheStore.get(key);
    const now = Date.now();

    if (cached && cached.expiresAt > now) {
      res.setHeader('X-Cache', 'HIT');
      res.setHeader('Cache-Control', `public, max-age=${Math.max(1, Math.round((cached.expiresAt - now) / 1000))}`);
      return res.status(cached.status).json(cached.body);
    }

    // Capture response json
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      // Only cache successful 200 responses
      if (res.statusCode === 200 && body && body.success !== false) {
        cacheStore.set(key, {
          status: res.statusCode,
          body,
          expiresAt: now + (ttlSeconds * 1000),
          tag
        });
      }
      res.setHeader('X-Cache', 'MISS');
      res.setHeader('Cache-Control', `public, max-age=${ttlSeconds}`);
      return originalJson(body);
    };

    next();
  };
}

/**
 * Invalidate cache by tag or prefix
 */
function invalidateCache(tagOrPrefix) {
  if (!tagOrPrefix) {
    cacheStore.clear();
    return;
  }
  for (const [key, entry] of cacheStore.entries()) {
    if (entry.tag === tagOrPrefix || key.includes(tagOrPrefix)) {
      cacheStore.delete(key);
    }
  }
}

// Periodic cleanup of expired entries (runs every 60s)
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of cacheStore.entries()) {
    if (entry.expiresAt <= now) {
      cacheStore.delete(key);
    }
  }
}, 60000).unref();

module.exports = {
  cacheResponse,
  invalidateCache
};

