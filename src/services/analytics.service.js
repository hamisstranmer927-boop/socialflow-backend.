const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const { Analytics, SocialAccount, ScheduledPost, PublishedPost } = require('../models');
const { ApiError } = require('../middleware/errorHandler');
const { cacheGet, cacheSet, invalidateCache } = require('../middleware/cache');

const OVERVIEW_CACHE_TTL = 120; // 2 minutes
const ACCOUNT_ANALYTICS_CACHE_TTL = 180; // 3 minutes

/**
 * Get dashboard overview analytics for a user.
 * Optimized: parallel queries + Redis caching.
 */
async function getOverview(userId) {
  // Check cache first
  const cacheKey = `sf:${userId}:analytics:overview`;
  const cached = await cacheGet(cacheKey);
  if (cached) return cached;

  // Get all active social accounts
  const accounts = await SocialAccount.findAll({
    where: { userId, isActive: true },
    attributes: ['id', 'platform', 'accountName', 'accountUsername', 'avatarUrl'],
  });

  const accountIds = accounts.map((a) => a.id);

  // Skip queries if no accounts
  if (accountIds.length === 0) {
    const empty = {
      connectedAccounts: 0,
      accounts: [],
      metrics: {},
      posts: { scheduled: 0, publishedThisWeek: 0 },
      period: { from: new Date().toISOString(), to: new Date().toISOString() },
    };
    await cacheSet(cacheKey, empty, OVERVIEW_CACHE_TTL);
    return empty;
  }

  const today = new Date();
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const fourteenDaysAgo = new Date(today);
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  // Run all 4 queries in parallel instead of sequential
  const [recentMetrics, previousMetrics, scheduledCount, publishedThisWeek] = await Promise.all([
    // Recent 7 days
    Analytics.findAll({
      where: {
        socialAccountId: { [Op.in]: accountIds },
        date: { [Op.gte]: sevenDaysAgo },
      },
      attributes: [
        'metricType',
        [sequelize.fn('SUM', sequelize.col('value')), 'total'],
      ],
      group: ['metricType'],
      raw: true,
    }),

    // Previous 7 days for comparison
    Analytics.findAll({
      where: {
        socialAccountId: { [Op.in]: accountIds },
        date: { [Op.between]: [fourteenDaysAgo, sevenDaysAgo] },
      },
      attributes: [
        'metricType',
        [sequelize.fn('SUM', sequelize.col('value')), 'total'],
      ],
      group: ['metricType'],
      raw: true,
    }),

    // Scheduled posts count
    ScheduledPost.count({
      where: { userId, status: 'scheduled' },
    }),

    // Published this week
    PublishedPost.count({
      where: {
        publishedAt: { [Op.gte]: sevenDaysAgo },
      },
      include: [{
        model: ScheduledPost,
        as: 'scheduledPost',
        where: { userId },
        attributes: [],
      }],
    }),
  ]);

  // Build metrics with change %
  const metricsMap = {};
  recentMetrics.forEach((m) => {
    metricsMap[m.metricType] = { current: parseFloat(m.total) || 0 };
  });
  previousMetrics.forEach((m) => {
    if (metricsMap[m.metricType]) {
      const prev = parseFloat(m.total) || 0;
      const curr = metricsMap[m.metricType].current;
      metricsMap[m.metricType].previous = prev;
      metricsMap[m.metricType].change = prev > 0 ? Math.round(((curr - prev) / prev) * 100) : 0;
    }
  });

  const result = {
    connectedAccounts: accounts.length,
    accounts: accounts.map((a) => a.toJSON()),
    metrics: metricsMap,
    posts: {
      scheduled: scheduledCount,
      publishedThisWeek,
    },
    period: {
      from: sevenDaysAgo.toISOString(),
      to: today.toISOString(),
    },
  };

  // Cache the result
  await cacheSet(cacheKey, result, OVERVIEW_CACHE_TTL);

  return result;
}

/**
 * Get detailed analytics for a specific social account.
 * Cached for 3 minutes.
 */
async function getAccountAnalytics(userId, accountId, options = {}) {
  const days = options.days || 30;

  // Check cache
  const cacheKey = `sf:${userId}:analytics:${accountId}:${days}`;
  const cached = await cacheGet(cacheKey);
  if (cached) return cached;

  const account = await SocialAccount.findOne({
    where: { id: accountId, userId },
    attributes: ['id', 'platform', 'accountName', 'accountUsername'],
  });

  if (!account) throw new ApiError(404, 'Social account not found.');

  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days);

  const metrics = await Analytics.findAll({
    where: {
      socialAccountId: accountId,
      date: { [Op.gte]: fromDate },
    },
    attributes: ['date', 'metricType', 'value'],
    order: [['date', 'ASC'], ['metricType', 'ASC']],
    raw: true,
  });

  // Group by date for charting
  const chartData = {};
  const totals = {};
  metrics.forEach((m) => {
    const dateStr = m.date;
    if (!chartData[dateStr]) chartData[dateStr] = { date: dateStr };
    const val = parseFloat(m.value);
    chartData[dateStr][m.metricType] = val;
    totals[m.metricType] = (totals[m.metricType] || 0) + val;
  });

  const result = {
    account: {
      id: account.id,
      platform: account.platform,
      accountName: account.accountName,
      accountUsername: account.accountUsername,
    },
    period: { days, from: fromDate.toISOString() },
    totals,
    chartData: Object.values(chartData),
  };

  // Cache result
  await cacheSet(cacheKey, result, ACCOUNT_ANALYTICS_CACHE_TTL);

  return result;
}

/**
 * Store analytics data (called by analytics collector job).
 * Optimized: batch upsert instead of sequential single upserts.
 */
async function storeMetrics(socialAccountId, platform, date, metrics) {
  const operations = Object.entries(metrics).map(([metricType, value]) => ({
    socialAccountId,
    platform,
    date,
    metricType,
    value,
  }));

  // Batch upsert all metrics in one query
  await Analytics.bulkCreate(operations, {
    updateOnDuplicate: ['value', 'updated_at'],
    conflictAttributes: ['social_account_id', 'date', 'metric_type'],
  });

  // Invalidate analytics cache for the owning user
  // Find the user via the social account
  try {
    const account = await SocialAccount.findByPk(socialAccountId, {
      attributes: ['userId'],
      raw: true,
    });
    if (account) {
      await invalidateCache(`sf:${account.userId}:analytics:*`);
    }
  } catch {
    // Non-critical — cache will expire naturally
  }
}

module.exports = {
  getOverview,
  getAccountAnalytics,
  storeMetrics,
};
