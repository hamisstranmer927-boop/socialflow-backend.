const axios = require('axios');
const { ApiError } = require('../../middleware/errorHandler');

const TIKTOK_API_URL = 'https://open.tiktokapis.com/v2';
const TIKTOK_AUTH_URL = 'https://www.tiktok.com/v2/auth/authorize';

/**
 * TikTok Service — Content Posting API integration
 */
class TikTokService {
  /**
   * Get OAuth authorization URL
   */
  static getAuthUrl(state) {
    const params = new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY,
      redirect_uri: process.env.TIKTOK_REDIRECT_URI,
      scope: 'user.info.basic,video.upload,video.publish,video.list',
      response_type: 'code',
      state,
    });

    return `${TIKTOK_AUTH_URL}/?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  static async exchangeCodeForToken(code) {
    try {
      const { data } = await axios.post(`${TIKTOK_API_URL}/oauth/token/`, {
        client_key: process.env.TIKTOK_CLIENT_KEY,
        client_secret: process.env.TIKTOK_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: process.env.TIKTOK_REDIRECT_URI,
      });

      if (data.error) {
        throw new Error(data.error.message || 'Token exchange failed');
      }

      return {
        accessToken: data.data.access_token,
        refreshToken: data.data.refresh_token,
        expiresIn: data.data.expires_in,
        openId: data.data.open_id,
      };
    } catch (error) {
      console.error('TikTok token exchange error:', error.response?.data || error.message);
      throw new ApiError(400, 'Failed to connect TikTok account.');
    }
  }

  /**
   * Get TikTok user info
   */
  static async getAccountInfo(accessToken) {
    try {
      const { data } = await axios.get(`${TIKTOK_API_URL}/user/info/`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: {
          fields: 'open_id,display_name,avatar_url,follower_count,following_count,likes_count,video_count',
        },
      });

      if (data.error?.code !== 'ok') {
        throw new Error(data.error?.message || 'Failed to get user info');
      }

      const user = data.data.user;

      return {
        platformAccountId: user.open_id,
        accountName: user.display_name,
        accountUsername: user.display_name,
        avatarUrl: user.avatar_url,
        metadata: {
          followerCount: user.follower_count,
          followingCount: user.following_count,
          likesCount: user.likes_count,
          videoCount: user.video_count,
        },
      };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      console.error('TikTok account info error:', error.response?.data || error.message);
      throw new ApiError(400, 'Failed to retrieve TikTok account info.');
    }
  }

  /**
   * Publish a video to TikTok (Content Posting API)
   * TikTok requires video content — no image-only posts.
   */
  static async publishPost({ accessToken, caption, videoUrl }) {
    try {
      // Step 1: Initialize video upload
      const { data: initData } = await axios.post(
        `${TIKTOK_API_URL}/post/publish/video/init/`,
        {
          post_info: {
            title: caption?.substring(0, 150) || '',
            privacy_level: 'PUBLIC_TO_EVERYONE',
            disable_duet: false,
            disable_stitch: false,
            disable_comment: false,
          },
          source_info: {
            source: 'PULL_FROM_URL',
            video_url: videoUrl,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (initData.error?.code !== 'ok') {
        throw new Error(initData.error?.message || 'Video init failed');
      }

      return {
        platformPostId: initData.data?.publish_id,
        postUrl: null, // TikTok doesn't return a direct URL immediately
        status: 'processing', // TikTok processes asynchronously
      };
    } catch (error) {
      console.error('TikTok publish error:', error.response?.data || error.message);
      throw new ApiError(500, `TikTok publish failed: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  /**
   * Refresh access token
   */
  static async refreshToken(refreshToken) {
    try {
      const { data } = await axios.post(`${TIKTOK_API_URL}/oauth/token/`, {
        client_key: process.env.TIKTOK_CLIENT_KEY,
        client_secret: process.env.TIKTOK_CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      });

      return {
        accessToken: data.data.access_token,
        refreshToken: data.data.refresh_token,
        expiresIn: data.data.expires_in,
      };
    } catch (error) {
      throw new ApiError(500, 'Failed to refresh TikTok token.');
    }
  }
}

module.exports = TikTokService;
