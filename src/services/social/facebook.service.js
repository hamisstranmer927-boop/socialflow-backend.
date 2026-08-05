const axios = require('axios');
const { ApiError } = require('../../middleware/errorHandler');

const META_GRAPH_URL = 'https://graph.facebook.com/v18.0';

/**
 * Facebook Service — Meta Graph API integration
 */
class FacebookService {
  /**
   * Get OAuth authorization URL
   */
  static getAuthUrl(state) {
    const params = new URLSearchParams({
      client_id: process.env.META_APP_ID,
      redirect_uri: `${process.env.APP_URL}/api/social/callback/facebook`,
      scope: 'pages_show_list,pages_read_engagement,pages_manage_posts,pages_read_user_content,read_insights,ads_management,ads_read,business_management',
      response_type: 'code',
      state,
    });

    return `https://www.facebook.com/v18.0/dialog/oauth?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  static async exchangeCodeForToken(code) {
    try {
      const { data } = await axios.get(`${META_GRAPH_URL}/oauth/access_token`, {
        params: {
          client_id: process.env.META_APP_ID,
          client_secret: process.env.META_APP_SECRET,
          redirect_uri: `${process.env.APP_URL}/api/social/callback/facebook`,
          code,
        },
      });

      // Get long-lived token
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
        expiresIn: longLived.data.expires_in || 5184000,
      };
    } catch (error) {
      console.error('Facebook token exchange error:', error.response?.data || error.message);
      throw new ApiError(400, 'Failed to connect Facebook account.');
    }
  }

  /**
   * Get Facebook pages managed by the user
   */
  static async getAccountInfo(accessToken) {
    try {
      const { data } = await axios.get(`${META_GRAPH_URL}/me/accounts`, {
        params: {
          fields: 'id,name,access_token,picture{url},fan_count,category',
          access_token: accessToken,
        },
      });

      if (!data.data?.length) {
        throw new ApiError(400, 'No Facebook pages found for this account.');
      }

      const page = data.data[0]; // Use first page

      return {
        platformAccountId: page.id,
        accountName: page.name,
        accountUsername: page.name,
        avatarUrl: page.picture?.data?.url,
        metadata: {
          pageAccessToken: page.access_token,
          fanCount: page.fan_count,
          category: page.category,
          allPages: data.data.map((p) => ({ id: p.id, name: p.name })),
        },
      };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      console.error('Facebook account info error:', error.response?.data || error.message);
      throw new ApiError(400, 'Failed to retrieve Facebook page info.');
    }
  }

  /**
   * Publish a post to Facebook Page
   */
  static async publishPost({ accessToken, pageId, message, link, imageUrl, locationName, metadata }) {
    try {
      const pageAccessToken = metadata?.pageAccessToken || accessToken;

      let finalMessage = message;
      if (locationName) {
        finalMessage += `\n\n📍 ${locationName}`;
      }

      let endpoint = `${META_GRAPH_URL}/${pageId}/feed`;
      const params = { access_token: pageAccessToken };

      if (imageUrl) {
        // Photo post
        endpoint = `${META_GRAPH_URL}/${pageId}/photos`;
        params.url = imageUrl;
        params.message = finalMessage;
      } else {
        params.message = finalMessage;
        if (link) params.link = link;
      }

      const { data } = await axios.post(endpoint, null, { params });

      return {
        platformPostId: data.id || data.post_id,
        postUrl: `https://www.facebook.com/${data.id || data.post_id}`,
      };
    } catch (error) {
      console.error('Facebook publish error:', error.response?.data || error.message);
      throw new ApiError(500, `Facebook publish failed: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  /**
   * Get page insights
   */
  static async getInsights(pageAccessToken, pageId) {
    try {
      const { data } = await axios.get(`${META_GRAPH_URL}/${pageId}/insights`, {
        params: {
          metric: 'page_impressions,page_engaged_users,page_fans,page_views_total',
          period: 'day',
          access_token: pageAccessToken,
        },
      });

      const metrics = {};
      data.data?.forEach((item) => {
        metrics[item.name] = item.values?.[item.values.length - 1]?.value || 0;
      });

      return metrics;
    } catch (error) {
      console.error('Facebook insights error:', error.response?.data || error.message);
      return {};
    }
  }

  /**
   * Refresh token
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
      throw new ApiError(500, 'Failed to refresh Facebook token.');
    }
  }
}

module.exports = FacebookService;
