const express = require('express');
const crypto = require('crypto');
const { authenticate } = require('../middleware/auth.middleware');
const { tierCheck } = require('../middleware/tierCheck.middleware');
const { SocialAccount } = require('../models');
const socialManager = require('../services/social');
const { ApiError } = require('../middleware/errorHandler');
const { redis } = require('../config/redis');

const router = express.Router();

const OAUTH_STATE_TTL = 600; // 10 minutes

/**
 * POST /api/social/connect
 * Initiate OAuth flow for a platform
 */
router.post('/connect', authenticate, tierCheck({ checkAccountLimit: true }), async (req, res, next) => {
  try {
    const { platform } = req.body;
    const supportedPlatforms = ['instagram', 'facebook', 'tiktok', 'linkedin', 'youtube', 'twitter'];

    if (!supportedPlatforms.includes(platform)) {
      return res.status(400).json({
        success: false,
        error: `Unsupported platform: ${platform}. Supported: ${supportedPlatforms.join(', ')}`,
      });
    }

    // Generate OAuth state for CSRF protection
    const state = crypto.randomBytes(32).toString('hex');

    // Store state in Redis with 10-minute TTL
    await redis.setex(
      `sf:oauth:${state}`,
      OAUTH_STATE_TTL,
      JSON.stringify({ userId: req.userId, platform, createdAt: Date.now() })
    );

    const authUrl = socialManager.getOAuthUrl(platform, state);

    res.json({
      success: true,
      data: { authUrl, state },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/social/callback/:platform
 * Handle OAuth callback
 */
router.get('/callback/:platform', async (req, res, next) => {
  try {
    const { platform } = req.params;
    const { code, state, error: oauthError } = req.query;

    if (oauthError) {
      return res.redirect(`${process.env.CLIENT_URL}/connect/error?message=${oauthError}`);
    }

    // Verify state from Redis
    const stateRaw = await redis.get(`sf:oauth:${state}`);
    if (!stateRaw) {
      return res.redirect(`${process.env.CLIENT_URL}/connect/error?message=Invalid+state`);
    }
    const stateData = JSON.parse(stateRaw);
    await redis.del(`sf:oauth:${state}`); // One-time use

    const { userId } = stateData;

    // Exchange code for token
    const tokenData = await socialManager.exchangeToken(platform, code);

    // Get account info
    const accountInfo = await socialManager.getAccountInfo(platform, tokenData.accessToken);

    // Calculate token expiry
    const tokenExpiresAt = tokenData.expiresIn
      ? new Date(Date.now() + tokenData.expiresIn * 1000)
      : null;

    // Upsert social account
    const [account, created] = await SocialAccount.findOrCreate({
      where: {
        userId,
        platform,
        platformAccountId: accountInfo.platformAccountId,
      },
      defaults: {
        accountName: accountInfo.accountName,
        accountUsername: accountInfo.accountUsername,
        avatarUrl: accountInfo.avatarUrl,
        accessToken: tokenData.accessToken,
        refreshToken: tokenData.refreshToken || null,
        tokenExpiresAt,
        metadata: accountInfo.metadata || {},
        isActive: true,
      },
    });

    if (!created) {
      // Update existing account with new tokens
      await account.update({
        accessToken: tokenData.accessToken,
        refreshToken: tokenData.refreshToken || account.refreshToken,
        tokenExpiresAt,
        accountName: accountInfo.accountName,
        accountUsername: accountInfo.accountUsername,
        avatarUrl: accountInfo.avatarUrl,
        metadata: accountInfo.metadata || account.metadata,
        isActive: true,
      });
    }

    // Redirect back to app root to avoid Web deep linking issues
    res.redirect(`${process.env.CLIENT_URL}`);
  } catch (err) {
    console.error('OAuth callback error:', err);
    res.redirect(`${process.env.CLIENT_URL}?error=oauth_failed`);
  }
});

/**
 * GET /api/social/accounts
 * List all connected social accounts
 */
router.get('/accounts', authenticate, async (req, res, next) => {
  try {
    const accounts = await SocialAccount.findAll({
      where: { userId: req.userId },
      attributes: { exclude: ['accessToken', 'refreshToken'] },
      order: [['createdAt', 'DESC']],
    });

    res.json({ success: true, data: accounts });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/social/accounts/:id
 * Disconnect a social account
 */
router.delete('/accounts/:id', authenticate, async (req, res, next) => {
  try {
    const account = await SocialAccount.findOne({
      where: { id: req.params.id, userId: req.userId },
    });

    if (!account) throw new ApiError(404, 'Account not found.');

    await account.update({ isActive: false, accessToken: '', refreshToken: null });
    res.json({ success: true, message: `${account.platform} account disconnected.` });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/social/accounts/:id/refresh
 * Force refresh token for an account
 */
router.post('/accounts/:id/refresh', authenticate, async (req, res, next) => {
  try {
    const account = await SocialAccount.findOne({
      where: { id: req.params.id, userId: req.userId },
    });

    if (!account) throw new ApiError(404, 'Account not found.');

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

    res.json({ success: true, message: 'Token refreshed successfully.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
