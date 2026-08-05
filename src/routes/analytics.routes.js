const express = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const { cacheMiddleware } = require('../middleware/cache');
const analyticsService = require('../services/analytics.service');

const router = express.Router();

/**
 * GET /api/analytics/overview
 * Dashboard overview analytics (cached 2 minutes)
 */
router.get('/overview', authenticate, cacheMiddleware(120), async (req, res, next) => {
  try {
    const overview = await analyticsService.getOverview(req.userId);
    res.json({ success: true, data: overview });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/analytics/:accountId
 * Detailed analytics for a specific social account (cached 3 minutes)
 */
router.get('/:accountId', authenticate, cacheMiddleware(180), async (req, res, next) => {
  try {
    const days = parseInt(req.query.days, 10) || 30;
    const analytics = await analyticsService.getAccountAnalytics(
      req.userId,
      req.params.accountId,
      { days }
    );
    res.json({ success: true, data: analytics });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
