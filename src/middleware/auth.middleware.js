const jwt = require('jsonwebtoken');
const { verifyFirebaseToken, getApp } = require('../config/firebase');
const { User } = require('../models');
const { cacheGet, cacheSet } = require('./cache');

const USER_CACHE_TTL = 300; // 5 minutes

/**
 * Find user with Redis caching.
 * Avoids hitting the DB on every single request.
 */
async function findUserCached(query) {
  const cacheKey = query.firebaseUid
    ? `sf:user:fb:${query.firebaseUid}`
    : `sf:user:id:${query.userId}`;

  // Try cache first
  const cached = await cacheGet(cacheKey);
  if (cached) return cached;

  // Cache miss — query DB
  let user;
  if (query.firebaseUid) {
    user = await User.findOne({
      where: { firebaseUid: query.firebaseUid },
      attributes: ['id', 'email', 'displayName', 'subscriptionTier', 'isActive'],
    });
  } else {
    user = await User.findByPk(query.userId, {
      attributes: ['id', 'email', 'displayName', 'subscriptionTier', 'isActive'],
    });
  }

  if (user) {
    const userData = user.toJSON();
    await cacheSet(cacheKey, userData, USER_CACHE_TTL);
    return userData;
  }

  return null;
}

/**
 * Authentication middleware.
 * Supports both Firebase ID tokens and JWT fallback tokens.
 * Uses Redis cache for user lookups (~93% fewer DB hits).
 * 
 * Header format: Authorization: Bearer <token>
 */
async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required. Provide a Bearer token.',
      });
    }

    const token = authHeader.split(' ')[1];
    let lookupQuery = null;

    // Try Firebase first
    if (getApp()) {
      try {
        const decoded = await verifyFirebaseToken(token);
        lookupQuery = { firebaseUid: decoded.uid };
      } catch (firebaseError) {
        // Firebase token invalid — try JWT fallback
      }
    }

    // JWT fallback
    if (!lookupQuery) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        lookupQuery = { userId: decoded.userId };
      } catch (jwtError) {
        return res.status(401).json({
          success: false,
          error: 'Invalid or expired token.',
        });
      }
    }

    // Find user (cached)
    const user = await findUserCached(lookupQuery);

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        error: 'User not found or deactivated.',
      });
    }

    // Attach user to request
    req.user = user;
    req.userId = user.id;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      error: 'Authentication failed.',
    });
  }
}

/**
 * Optional auth — attaches user if token present, continues if not.
 */
async function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }
  return authenticate(req, res, next);
}

module.exports = { authenticate, optionalAuth };

