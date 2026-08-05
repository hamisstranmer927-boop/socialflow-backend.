const express = require('express');
const router = express.Router();
const aiService = require('../services/ai.service');
const { authenticate } = require('../middleware/auth.middleware');

// GET /api/ai/trends - Get live AI trends
router.get('/trends', authenticate, async (req, res) => {
  try {
    const platform = req.query.platform || 'all';
    const customApiKey = req.headers['x-gemini-api-key'];
    const trends = await aiService.generateTrendingTopics(platform, { customApiKey });
    res.json({ success: true, data: trends });
  } catch (error) {
    console.error('AI Trends Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch AI trends' });
  }
});

// POST /api/ai/insights - Get AI insights for analytics
router.post('/insights', authenticate, async (req, res) => {
  try {
    const { metrics } = req.body;
    if (!metrics) {
      return res.status(400).json({ success: false, message: 'Metrics data is required' });
    }
    const customApiKey = req.headers['x-gemini-api-key'];
    const tips = await aiService.generateAnalyticsInsights(metrics, { customApiKey });
    res.json({ success: true, data: tips });
  } catch (error) {
    console.error('AI Insights Error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate insights' });
  }
});

// POST /api/ai/suggestions - Get AI content suggestions
router.post('/suggestions', authenticate, async (req, res) => {
  try {
    const { topic, platform } = req.body;
    if (!topic) {
      return res.status(400).json({ success: false, message: 'Topic is required' });
    }
    const customApiKey = req.headers['x-gemini-api-key'];
    const suggestions = await aiService.generateCaptionSuggestions(topic, { platform, customApiKey });
    res.json({ success: true, data: suggestions });
  } catch (error) {
    console.error('AI Suggestions Error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate suggestions' });
  }
});

module.exports = router;
