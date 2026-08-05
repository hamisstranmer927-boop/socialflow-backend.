const Bull = require('bull');
const { redisConfig } = require('../config/redis');
const { SocialAccount } = require('../models');
const socialManager = require('../services/social');
const { Op } = require('sequelize');

/**
 * Token Refresher Job
 * Runs every 6 hours to refresh tokens expiring within 7 days
 */
const tokenRefreshQueue = new Bull('token-refresh', {
  redis: redisConfig,
});

// Process token refresh jobs
tokenRefreshQueue.process(async (job) => {
  console.log('🔄 Running token refresh job...');

  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

  // Find accounts with tokens expiring soon
  const expiringAccounts = await SocialAccount.findAll({
    where: {
      isActive: true,
      tokenExpiresAt: {
        [Op.lte]: sevenDaysFromNow,
        [Op.gte]: new Date(), // Not yet expired
      },
    },
  });

  console.log(`Found ${expiringAccounts.length} accounts needing token refresh.`);

  let refreshed = 0;
  let failed = 0;

  for (const account of expiringAccounts) {
    try {
      const tokenData = await socialManager.refreshPlatformToken(account.platform, {
        accessToken: account.accessToken,
        refreshToken: account.refreshToken,
      });

      const tokenExpiresAt = tokenData.expiresIn
        ? new Date(Date.now() + tokenData.expiresIn * 1000)
        : null;

      await account.update({
        accessToken: tokenData.accessToken,
        refreshToken: tokenData.refreshToken || account.refreshToken,
        tokenExpiresAt,
      });

      refreshed++;
    } catch (error) {
      console.error(`Token refresh failed for ${account.platform} (${account.id}):`, error.message);
      failed++;
    }
  }

  console.log(`✅ Token refresh complete: ${refreshed} refreshed, ${failed} failed.`);
  return { refreshed, failed };
});

/**
 * Schedule recurring token refresh (every 6 hours)
 */
async function startTokenRefreshSchedule() {
  // Remove existing repeatable jobs
  const existingJobs = await tokenRefreshQueue.getRepeatableJobs();
  for (const job of existingJobs) {
    await tokenRefreshQueue.removeRepeatableByKey(job.key);
  }

  // Add new repeatable job
  await tokenRefreshQueue.add(
    {},
    {
      repeat: { cron: '0 */6 * * *' }, // Every 6 hours
      removeOnComplete: 10,
      removeOnFail: 20,
    }
  );

  console.log('🔄 Token refresh schedule started (every 6 hours).');
}

module.exports = { tokenRefreshQueue, startTokenRefreshSchedule };
