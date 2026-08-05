const express = require('express');
const Joi = require('joi');
const { authenticate } = require('../middleware/auth.middleware');
const { cacheMiddleware, invalidateUserCache } = require('../middleware/cache');
const schedulingService = require('../services/scheduling.service');

const router = express.Router();

/**
 * POST /api/posts
 * Create & schedule a new post
 */
router.post('/', authenticate, async (req, res, next) => {
  try {
    const schema = Joi.object({
      content: Joi.string().max(5000).allow('', null),
      mediaUrls: Joi.array().items(Joi.string()).max(10).optional(),
      targetAccountIds: Joi.array().items(Joi.string().uuid()).min(1).required(),
      platforms: Joi.array().items(
        Joi.string().valid('instagram', 'facebook', 'tiktok', 'linkedin', 'youtube', 'twitter')
      ).optional(),
      scheduleTime: Joi.date().iso().greater('now').required(),
      platformSpecific: Joi.object().optional(),
      locationName: Joi.string().max(255).allow('', null).optional(),
      tags: Joi.array().items(Joi.string()).optional(),
    });

    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ success: false, error: error.details[0].message });

    const post = await schedulingService.createScheduledPost(req.userId, value);

    // Invalidate posts cache
    await invalidateUserCache(req.userId);

    res.status(201).json({
      success: true,
      data: post,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/posts
 * List user's posts with optional filters
 */
router.get('/', authenticate, cacheMiddleware(60), async (req, res, next) => {
  try {
    const { status, platform, from, to, limit, offset } = req.query;

    const posts = await schedulingService.getUserPosts(req.userId, {
      status,
      platform,
      from,
      to,
      limit: parseInt(limit, 10) || 50,
      offset: parseInt(offset, 10) || 0,
    });

    res.json({
      success: true,
      data: posts,
      count: posts.length,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/posts/:id
 * Get a single post
 */
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const post = await schedulingService.getPostById(req.userId, req.params.id);
    res.json({ success: true, data: post });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/posts/:id
 * Update a scheduled post
 */
router.put('/:id', authenticate, async (req, res, next) => {
  try {
    const schema = Joi.object({
      content: Joi.string().max(5000).allow('', null).optional(),
      mediaUrls: Joi.array().items(Joi.string()).max(10).optional(),
      targetAccountIds: Joi.array().items(Joi.string().uuid()).min(1).optional(),
      platforms: Joi.array().items(
        Joi.string().valid('instagram', 'facebook', 'tiktok', 'linkedin', 'youtube', 'twitter')
      ).optional(),
      scheduleTime: Joi.date().iso().greater('now').optional(),
      platformSpecific: Joi.object().optional(),
      locationName: Joi.string().max(255).allow('', null).optional(),
      tags: Joi.array().items(Joi.string()).optional(),
    });

    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ success: false, error: error.details[0].message });

    const post = await schedulingService.updatePost(req.userId, req.params.id, value);
    await invalidateUserCache(req.userId);
    res.json({ success: true, data: post });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/posts/:id
 * Delete/cancel a post
 */
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const result = await schedulingService.deletePost(req.userId, req.params.id);
    await invalidateUserCache(req.userId);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/posts/:id/publish-now
 * Publish a scheduled post immediately
 */
router.post('/:id/publish-now', authenticate, async (req, res, next) => {
  try {
    const result = await schedulingService.publishNow(req.userId, req.params.id);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
