const Bull = require('bull');
const { redisConfig } = require('../config/redis');
const { SocialAccount } = require('../models');
const analyticsService = require('../services/analytics.service');
const socialManager = require('../services/social');

/**
 * Analytics Collector Job
 * Runs every 4 hours to fetch fresh analytics from connected platforms
 */
const analyticsQueue = new Bull('analytics-collector', {
  redis: redisConfig,
});

analyticsQueue.process(async (job) => {
  console.log('📊 Running analytics collector...');

  const accounts = await SocialAccount.findAll({
    where: { isActive: true },
  });

  let collected = 0;
  let failed = 0;
  const today = new Date().toISOString().split('T')[0];

  for (const account of accounts) {
    try {
      const service = socialManager.getPlatformService(account.platform);

      let metrics = {};

      if (account.platform === 'instagram') {
        metrics = await service.getInsights(account.accessToken, account.platformAccountId);
      } else if (account.platform === 'facebook') {
        const pageToken = account.metadata?.pageAccessToken || account.accessToken;
        metrics = await service.getInsights(pageToken, account.platformAccountId);
      }
      // TikTok analytics API is limited in beta — skip for now

      if (Object.keys(metrics).length > 0) {
        // Map platform-specific metric names to our standard names
        const standardMetrics = {};
        if (metrics.impressions || metrics.page_impressions) {
          standardMetrics.impressions = metrics.impressions || metrics.page_impressions;
        }
        if (metrics.reach) {
          standardMetrics.reach = metrics.reach;
        }
        if (metrics.follower_count || metrics.page_fans) {
          standardMetrics.followers = metrics.follower_count || metrics.page_fans;
        }
        if (metrics.page_engaged_users) {
          standardMetrics.engagement = metrics.page_engaged_users;
        }
        if (metrics.profile_views || metrics.page_views_total) {
          standardMetrics.profile_views = metrics.profile_views || metrics.page_views_total;
        }

        await analyticsService.storeMetrics(account.id, account.platform, today, standardMetrics);
        collected++;
      }
    } catch (error) {
      console.error(`Analytics collection failed for ${account.platform} (${account.id}):`, error.message);
      failed++;
    }
  }

  console.log(`✅ Analytics collection complete: ${collected} collected, ${failed} failed.`);
  return { collected, failed };
});

/**
 * Schedule recurring analytics collection (every 4 hours)
 */
async function startAnalyticsSchedule() {
  const existingJobs = await analyticsQueue.getRepeatableJobs();
  for (const job of existingJobs) {
    await analyticsQueue.removeRepeatableByKey(job.key);
  }

  await analyticsQueue.add(
    {},
    {
      repeat: { cron: '0 */4 * * *' }, // Every 4 hours
      removeOnComplete: 10,
      removeOnFail: 20,
    }
  );

  console.log('📊 Analytics collection schedule started (every 4 hours).');
}

module.exports = { analyticsQueue, startAnalyticsSchedule };
