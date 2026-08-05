const { redis } = require('../config/redis');

/**
 * Redis Cache Layer for SocialFlow
 * 
 * Provides route-level caching and manual cache helpers.
 * Cache keys are scoped per-user to prevent data leaking.
 */

// ─── Default TTL (seconds) ───────────────────────────────

const DEFAULT_TTL = 120; // 2 minutes

// ─── Cache Key Builder ───────────────────────────────────

function buildCacheKey(userId, req) {
  const base = `sf:${userId}:${req.baseUrl}${req.path}`;
  const qs = Object.keys(req.query).length > 0
    ? ':' + Object.keys(req.query).sort().map(k => `${k}=${req.query[k]}`).join('&')
    : '';
  return base + qs;
}

// ─── Route Cache Middleware ──────────────────────────────

/**
 * Express middleware that caches JSON responses in Redis.
 * 
 * Usage:
 *   router.get('/overview', authenticate, cacheMiddleware(120), handler);
 * 
 * @param {number} ttl - Cache duration in seconds (default 120)
 */
function cacheMiddleware(ttl = DEFAULT_TTL) {
  return async (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') return next();

    const userId = req.userId;
    if (!userId) return next();

    const key = buildCacheKey(userId, req);

    try {
      const cached = await redis.get(key);
      if (cached) {
        const data = JSON.parse(cached);
        res.set('X-Cache', 'HIT');
        return res.json(data);
      }
    } catch (err) {
      // Cache miss or Redis error — continue to handler
    }

    // Intercept res.json to cache the response
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      // Only cache successful responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        redis.setex(key, ttl, JSON.stringify(body)).catch(() => {});
      }
      res.set('X-Cache', 'MISS');
      return originalJson(body);
    };

    next();
  };
}

// ─── Manual Cache Helpers ────────────────────────────────

/**
 * Get a value from cache
 */
async function cacheGet(key) {
  try {
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

/**
 * Set a value in cache with TTL
 */
async function cacheSet(key, value, ttl = DEFAULT_TTL) {
  try {
    await redis.setex(key, ttl, JSON.stringify(value));
  } catch {
    // Silent fail — cache is best-effort
  }
}

/**
 * Delete cache entries matching a pattern
 * Use for cache invalidation after writes.
 * 
 * Example: invalidateCache('sf:user123:/api/analytics*')
 */
async function invalidateCache(pattern) {
  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch {
    // Silent fail
  }
}

/**
 * Delete a single cache key
 */
async function invalidateKey(key) {
  try {
    await redis.del(key);
  } catch {
    // Silent fail
  }
}

/**
 * Invalidate all cache for a specific user
 */
async function invalidateUserCache(userId) {
  return invalidateCache(`sf:${userId}:*`);
}

module.exports = {
  cacheMiddleware,
  cacheGet,
  cacheSet,
  invalidateCache,
  invalidateKey,
  invalidateUserCache,
  buildCacheKey,
};
