const axios = require('axios');
const { ApiError } = require('../../middleware/errorHandler');

const META_GRAPH_URL = 'https://graph.facebook.com/v18.0';

/**
 * Instagram Service — Meta Graph API integration
 */
class InstagramService {
  /**
   * Get OAuth authorization URL
   */
  static getAuthUrl(state) {
    const params = new URLSearchParams({
      client_id: process.env.META_APP_ID,
      redirect_uri: process.env.META_REDIRECT_URI,
      scope: 'instagram_basic,instagram_content_publish,instagram_manage_insights,pages_show_list,pages_read_engagement',
      response_type: 'code',
      state,
    });

    return `https://www.facebook.com/v18.0/dialog/oauth?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  static async exchangeCodeForToken(code) {
    try {
      // Get short-lived token
      const { data } = await axios.get(`${META_GRAPH_URL}/oauth/access_token`, {
        params: {
          client_id: process.env.META_APP_ID,
          client_secret: process.env.META_APP_SECRET,
          redirect_uri: process.env.META_REDIRECT_URI,
          code,
        },
      });

      // Exchange for long-lived token (60 days)
      const longLived = await axios.get(`${META_GRAPH_URL}/oauth/access_token`, {
        params: {
          grant_type: 'fb_exchange_token',
          client_id: process.env.META_APP_ID,
          client_secret: process.env.META_APP_SECRET,
          fb_exchange_token: data.access_token,
        },
      });

      return {
        accessToken: longLived.data.access_token,
        expiresIn: longLived.data.expires_in || 5184000, // 60 days default
      };
    } catch (error) {
      console.error('Instagram token exchange error:', error.response?.data || error.message);
      throw new ApiError(400, 'Failed to connect Instagram account.');
    }
  }

  /**
   * Get Instagram Business account info
   */
  static async getAccountInfo(accessToken) {
    try {
      // Get Facebook pages linked to this user
      const { data: pagesData } = await axios.get(`${META_GRAPH_URL}/me/accounts`, {
        params: { access_token: accessToken },
      });

      if (!pagesData.data?.length) {
        throw new ApiError(400, 'No Facebook pages found. Instagram Business requires a linked Facebook page.');
      }

      // Get Instagram business account from the first page
      const page = pagesData.data[0];
      const { data: igData } = await axios.get(`${META_GRAPH_URL}/${page.id}`, {
        params: {
          fields: 'instagram_business_account',
          access_token: page.access_token,
        },
      });

      if (!igData.instagram_business_account) {
        throw new ApiError(400, 'No Instagram Business account linked to this page.');
      }

      const igAccountId = igData.instagram_business_account.id;

      // Get IG account details
      const { data: profile } = await axios.get(`${META_GRAPH_URL}/${igAccountId}`, {
        params: {
          fields: 'id,username,name,profile_picture_url,followers_count,media_count',
          access_token: accessToken,
        },
      });

      return {
        platformAccountId: igAccountId,
        accountName: profile.name,
        accountUsername: profile.username,
        avatarUrl: profile.profile_picture_url,
        metadata: {
          pageId: page.id,
          pageAccessToken: page.access_token,
          followersCount: profile.followers_count,
          mediaCount: profile.media_count,
        },
      };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      console.error('Instagram account info error:', error.response?.data || error.message);
      throw new ApiError(400, 'Failed to retrieve Instagram account info.');
    }
  }

  /**
   * Publish a post to Instagram
   * Instagram uses a 2-step process: create media container → publish
   */
  static async publishPost({ accessToken, igAccountId, caption, imageUrl, locationName, metadata }) {
    try {
      const pageAccessToken = metadata?.pageAccessToken || accessToken;
      
      let finalCaption = caption;
      if (locationName) {
        finalCaption += `\n\n📍 ${locationName}`;
      }

      // Step 1: Create media container
      const containerParams = {
        caption: finalCaption,
        access_token: pageAccessToken,
      };

      if (imageUrl) {
        containerParams.image_url = imageUrl;
      }

      const { data: container } = await axios.post(
        `${META_GRAPH_URL}/${igAccountId}/media`,
        null,
        { params: containerParams }
      );

      // Step 2: Publish the container
      const { data: published } = await axios.post(
        `${META_GRAPH_URL}/${igAccountId}/media_publish`,
        null,
        {
          params: {
            creation_id: container.id,
            access_token: pageAccessToken,
          },
        }
      );

      return {
        platformPostId: published.id,
        postUrl: `https://www.instagram.com/p/${published.id}/`,
      };
    } catch (error) {
      console.error('Instagram publish error:', error.response?.data || error.message);
      throw new ApiError(500, `Instagram publish failed: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  /**
   * Get insights/analytics for Instagram account
   */
  static async getInsights(accessToken, igAccountId, period = 'day') {
    try {
      const { data } = await axios.get(`${META_GRAPH_URL}/${igAccountId}/insights`, {
        params: {
          metric: 'impressions,reach,follower_count,profile_views',
          period,
          access_token: accessToken,
        },
      });

      const metrics = {};
      data.data?.forEach((item) => {
        metrics[item.name] = item.values?.[item.values.length - 1]?.value || 0;
      });

      return metrics;
    } catch (error) {
      console.error('Instagram insights error:', error.response?.data || error.message);
      return {};
    }
  }

  /**
   * Refresh a long-lived token (must be done before 60 days)
   */
  static async refreshToken(accessToken) {
    try {
      const { data } = await axios.get(`${META_GRAPH_URL}/oauth/access_token`, {
        params: {
          grant_type: 'fb_exchange_token',
          client_id: process.env.META_APP_ID,
          client_secret: process.env.META_APP_SECRET,
          fb_exchange_token: accessToken,
        },
      });

      return {
        accessToken: data.access_token,
        expiresIn: data.expires_in,
      };
    } catch (error) {
      console.error('Instagram token refresh error:', error.response?.data || error.message);
      throw new ApiError(500, 'Failed to refresh Instagram token.');
    }
  }
}

module.exports = InstagramService;
