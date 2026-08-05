const express = require('express');
const { Op } = require('sequelize');
const { authenticate } = require('../middleware/auth.middleware');
const { Trend } = require('../models');

const router = express.Router();

// Fallback dynamic trends map for each platform
const DEFAULT_PLATFORM_TRENDS = {
  youtube: [
    { id: 'yt-1', trendName: '#ShortsViral2026', platform: 'youtube', category: 'Entertainment', volume: 3200000, growthRate: '+88%' },
    { id: 'yt-2', trendName: '#TechUnboxing', platform: 'youtube', category: 'Tech', volume: 1400000, growthRate: '+42%' },
    { id: 'yt-3', trendName: '#ContentCreatorTips', platform: 'youtube', category: 'Education', volume: 950000, growthRate: '+35%' },
  ],
  instagram: [
    { id: 'ig-1', trendName: '#AiMarketing2026', platform: 'instagram', category: 'Tech', volume: 850000, growthRate: '+45%' },
    { id: 'ig-2', trendName: '#ReelsStrategy', platform: 'instagram', category: 'Business', volume: 620000, growthRate: '+30%' },
    { id: 'ig-3', trendName: '#SustainableLiving', platform: 'instagram', category: 'Lifestyle', volume: 420000, growthRate: '+22%' },
  ],
  tiktok: [
    { id: 'tt-1', trendName: '#SocialMediaGrowth', platform: 'tiktok', category: 'Business', volume: 1200000, growthRate: '+68%' },
    { id: 'tt-2', trendName: '#FYPChallenge', platform: 'tiktok', category: 'Viral', volume: 3400000, growthRate: '+95%' },
    { id: 'tt-3', trendName: '#TechHacks', platform: 'tiktok', category: 'Tech', volume: 910000, growthRate: '+54%' },
  ],
  twitter: [
    { id: 'tw-1', trendName: '#TechNews', platform: 'twitter', category: 'Tech', volume: 750000, growthRate: '+40%' },
    { id: 'tw-2', trendName: '#Crypto2026', platform: 'twitter', category: 'Finance', volume: 1100000, growthRate: '+50%' },
  ],
  linkedin: [
    { id: 'li-1', trendName: '#RemoteWorkCulture', platform: 'linkedin', category: 'Career', volume: 310000, growthRate: '+18%' },
    { id: 'li-2', trendName: '#Leadership101', platform: 'linkedin', category: 'Management', volume: 540000, growthRate: '+25%' },
  ],
};

/**
 * GET /api/trends
 * List active trending topics and hashtags with platform & search filters
 */
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { platform, category, search } = req.query;
    const where = {};

    if (platform && platform !== 'all') {
      where.platform = platform;
    }
    if (category && category !== 'all') {
      where.category = category;
    }
    if (search && search.trim()) {
      where.trendName = { [Op.iLike]: `%${search.trim()}%` };
    }

    let trends = await Trend.findAll({
      where,
      order: [['volume', 'DESC']],
      limit: 30,
    });

    // Fallback if specific platform query returned empty array
    if (trends.length === 0) {
      if (platform && DEFAULT_PLATFORM_TRENDS[platform]) {
        trends = DEFAULT_PLATFORM_TRENDS[platform];
      } else {
        // Return flattened default list
        trends = Object.values(DEFAULT_PLATFORM_TRENDS).flat();
      }

      // Apply search filter if provided
      if (search && search.trim()) {
        const q = search.trim().toLowerCase();
        trends = trends.filter((t) => t.trendName.toLowerCase().includes(q));
      }
    }

    res.json({ success: true, data: trends });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
