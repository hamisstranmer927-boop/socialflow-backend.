const express = require('express');
const Joi = require('joi');
const { authenticate } = require('../middleware/auth.middleware');
const { authLimiter } = require('../middleware/rateLimiter');
const authService = require('../services/auth.service');

const router = express.Router();

/**
 * POST /api/auth/register
 * Register a new user (Firebase token or email/password)
 */
router.post('/register', authLimiter, async (req, res, next) => {
  try {
    const schema = Joi.object({
      email: Joi.string().email().required(),
      displayName: Joi.string().max(100).optional(),
      password: Joi.string().min(8).optional(),
      firebaseToken: Joi.string().optional(),
    }).or('password', 'firebaseToken');

    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ success: false, error: error.details[0].message });

    const result = await authService.registerUser(value);

    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/login
 * Login (Firebase token or email/password)
 */
router.post('/login', authLimiter, async (req, res, next) => {
  try {
    const schema = Joi.object({
      email: Joi.string().email().optional(),
      password: Joi.string().optional(),
      firebaseToken: Joi.string().optional(),
    });

    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ success: false, error: error.details[0].message });

    const result = await authService.loginUser(value);

    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/auth/me
 * Get current user profile
 */
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const profile = await authService.getUserProfile(req.userId);
    res.json({ success: true, data: profile });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/auth/profile
 * Update user profile
 */
router.put('/profile', authenticate, async (req, res, next) => {
  try {
    const schema = Joi.object({
      displayName: Joi.string().max(100).optional(),
      avatarUrl: Joi.string().allow('', null).optional(),
      bio: Joi.string().allow('', null).optional(),
      jobTitle: Joi.string().allow('', null).optional(),
      company: Joi.string().allow('', null).optional(),
      phoneNumber: Joi.string().allow('', null).optional(),
    });

    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ success: false, error: error.details[0].message });

    const updated = await authService.updateProfile(req.userId, value);
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
