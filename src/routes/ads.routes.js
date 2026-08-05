const express = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const { AdCampaign, AdMetric, SocialAccount, AdAccount } = require('../models');
const MetaAdsService = require('../services/ads/metaAds.service');

const router = express.Router();

/**
 * GET /api/ads
 * List user's ad campaigns with optional filters
 */
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { socialAccountId, platform, status } = req.query;
    const where = { userId: req.userId };

    if (socialAccountId) where.socialAccountId = socialAccountId;
    if (platform) where.platform = platform;
    if (status) where.status = status;

    let campaigns = await AdCampaign.findAll({
      where,
      include: [{ model: AdMetric, as: 'metrics' }],
      order: [['createdAt', 'DESC']],
    });

    res.json({ success: true, data: campaigns });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/ads
 * Create new ad campaign
 */
router.post('/', authenticate, async (req, res, next) => {
  try {
    const { name, platform, budget, startDate, endDate, socialAccountId } = req.body;
    const campaign = await AdCampaign.create({
      userId: req.userId,
      socialAccountId: socialAccountId || null,
      name,
      platform,
      budget,
      spent: 0,
      status: 'active',
      startDate,
      endDate,
    });
    res.status(201).json({ success: true, data: campaign });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/ads/sync/meta
 * Sync Meta (Facebook/Instagram) ad accounts and campaigns
 */
router.post('/sync/meta', authenticate, async (req, res, next) => {
  try {
    // 1. Find all active Facebook accounts for the user
    const fbAccounts = await SocialAccount.findAll({
      where: { userId: req.userId, platform: 'facebook', isActive: true },
    });

    if (fbAccounts.length === 0) {
      return res.status(400).json({ success: false, message: 'No active Facebook account connected.' });
    }

    const results = [];

    // 2. Loop through accounts and fetch Ad Accounts
    for (const fbAcc of fbAccounts) {
      if (!fbAcc.accessToken) continue;

      const remoteAdAccounts = await MetaAdsService.getAdAccounts(fbAcc.accessToken);

      for (const remoteAd of remoteAdAccounts) {
        // Upsert AdAccount
        const [adAccount] = await AdAccount.upsert({
          userId: req.userId,
          socialAccountId: fbAcc.id,
          platformAccountId: remoteAd.platformAccountId,
          accountName: remoteAd.accountName,
          platform: 'facebook',
          currency: remoteAd.currency,
          timezone: remoteAd.timezone,
          isActive: remoteAd.isActive,
        });

        // 3. Fetch Campaigns for this AdAccount
        const remoteCampaigns = await MetaAdsService.getCampaigns(remoteAd.platformAccountId, fbAcc.accessToken);

        for (const remoteCamp of remoteCampaigns) {
          // Upsert Campaign
          const [campaign] = await AdCampaign.upsert({
            userId: req.userId,
            adAccountId: adAccount.id,
            platformCampaignId: remoteCamp.platformCampaignId,
            name: remoteCamp.name,
            objective: remoteCamp.objective,
            platform: 'facebook',
            budget: remoteCamp.budget,
            status: remoteCamp.status,
            startDate: remoteCamp.startDate,
            endDate: remoteCamp.endDate,
          });

          // 4. Fetch Insights (Metrics) for Campaign
          const insights = await MetaAdsService.getCampaignInsights(remoteCamp.platformCampaignId, fbAcc.accessToken);

          // Update total spent on Campaign
          await campaign.update({ spent: insights.spend });

          // Upsert Metric for today
          const today = new Date().toISOString().split('T')[0];
          await AdMetric.upsert({
            campaignId: campaign.id,
            date: today,
            spend: insights.spend,
            cpc: insights.cpc,
            cpm: insights.cpm,
            ctr: insights.ctr,
            impressions: insights.impressions,
            clicks: insights.clicks,
            conversions: insights.conversions,
            roas: insights.roas,
          });
        }
        
        results.push({
          adAccount: adAccount.accountName,
          campaignsSynced: remoteCampaigns.length,
        });
      }
    }

    res.json({ success: true, data: results, message: 'Sync complete' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
