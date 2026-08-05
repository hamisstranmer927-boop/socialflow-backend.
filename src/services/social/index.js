const InstagramService = require('./instagram.service');
const FacebookService = require('./facebook.service');
const TikTokService = require('./tiktok.service');

/**
 * Social Platform Manager — Routes to the correct platform service
 */
const PLATFORM_SERVICES = {
  instagram: InstagramService,
  facebook: FacebookService,
  tiktok: TikTokService,
};

/**
 * Get platform service by name
 */
function getPlatformService(platform) {
  const service = PLATFORM_SERVICES[platform];
  if (!service) {
    throw new Error(`Unsupported platform: ${platform}. Supported: ${Object.keys(PLATFORM_SERVICES).join(', ')}`);
  }
  return service;
}

/**
 * Get OAuth URL for a platform
 */
function getOAuthUrl(platform, state) {
  const service = getPlatformService(platform);
  return service.getAuthUrl(state);
}

/**
 * Exchange OAuth code for token
 */
async function exchangeToken(platform, code) {
  const service = getPlatformService(platform);
  return service.exchangeCodeForToken(code);
}

/**
 * Get account info after OAuth
 */
async function getAccountInfo(platform, accessToken) {
  const service = getPlatformService(platform);
  return service.getAccountInfo(accessToken);
}

/**
 * Publish to a specific platform
 */
async function publishToplatform(platform, publishData) {
  const service = getPlatformService(platform);
  return service.publishPost(publishData);
}

/**
 * Refresh a platform token
 */
async function refreshPlatformToken(platform, tokenData) {
  const service = getPlatformService(platform);
  if (platform === 'tiktok') {
    return service.refreshToken(tokenData.refreshToken);
  }
  return service.refreshToken(tokenData.accessToken);
}

module.exports = {
  getPlatformService,
  getOAuthUrl,
  exchangeToken,
  getAccountInfo,
  publishToplatform,
  refreshPlatformToken,
  PLATFORM_SERVICES,
};
