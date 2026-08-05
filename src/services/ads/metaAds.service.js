const axios = require('axios');
const { ApiError } = require('../../middleware/errorHandler');

const META_GRAPH_URL = 'https://graph.facebook.com/v18.0';

class MetaAdsService {
  /**
   * Fetch ad accounts for a given user token
   */
  static async getAdAccounts(accessToken) {
    try {
      const { data } = await axios.get(`${META_GRAPH_URL}/me/adaccounts`, {
        params: {
          fields: 'id,name,currency,timezone_name,account_status',
          access_token: accessToken,
        },
      });

      return data.data.map((account) => ({
        platformAccountId: account.id,
        accountName: account.name || account.id,
        currency: account.currency,
        timezone: account.timezone_name,
        isActive: account.account_status === 1, // 1 is ACTIVE in Meta
      }));
    } catch (error) {
      console.error('Meta Ads getAdAccounts error:', error.response?.data || error.message);
      throw new ApiError(500, 'Failed to fetch Meta Ad Accounts.');
    }
  }

  /**
   * Fetch campaigns for a specific ad account
   */
  static async getCampaigns(adAccountId, accessToken) {
    try {
      const { data } = await axios.get(`${META_GRAPH_URL}/${adAccountId}/campaigns`, {
        params: {
          fields: 'id,name,objective,status,daily_budget,lifetime_budget,start_time,stop_time',
          access_token: accessToken,
        },
      });

      return data.data.map((campaign) => ({
        platformCampaignId: campaign.id,
        name: campaign.name,
        objective: campaign.objective,
        status: campaign.status === 'ACTIVE' ? 'active' : (campaign.status === 'PAUSED' ? 'paused' : 'completed'),
        budget: (campaign.daily_budget || campaign.lifetime_budget || 0) / 100, // Meta returns in cents
        startDate: campaign.start_time ? new Date(campaign.start_time).toISOString().split('T')[0] : null,
        endDate: campaign.stop_time ? new Date(campaign.stop_time).toISOString().split('T')[0] : null,
      }));
    } catch (error) {
      console.error('Meta Ads getCampaigns error:', error.response?.data || error.message);
      throw new ApiError(500, 'Failed to fetch Meta Campaigns.');
    }
  }

  /**
   * Fetch insights (metrics) for a campaign
   */
  static async getCampaignInsights(campaignId, accessToken, datePreset = 'maximum') {
    try {
      const { data } = await axios.get(`${META_GRAPH_URL}/${campaignId}/insights`, {
        params: {
          fields: 'spend,cpc,cpm,ctr,impressions,clicks,actions',
          date_preset: datePreset,
          access_token: accessToken,
        },
      });

      if (!data.data || data.data.length === 0) {
        return { spend: 0, cpc: 0, cpm: 0, ctr: 0, impressions: 0, clicks: 0, conversions: 0 };
      }

      const insights = data.data[0];
      
      // Calculate conversions (Purchases or Leads depending on objective)
      const actions = insights.actions || [];
      const conversions = actions.find(a => a.action_type === 'purchase' || a.action_type === 'lead')?.value || 0;

      // Real ROAS calculation using action_values (revenue) from Meta
      const purchaseActionValues = insights.action_values || [];
      const revenue = purchaseActionValues.find(a => a.action_type === 'purchase')?.value || 0;
      
      const spend = parseFloat(insights.spend || 0);
      const roas = spend > 0 ? (parseFloat(revenue) / spend) : 0;

      return {
        spend,
        cpc: parseFloat(insights.cpc || 0),
        cpm: parseFloat(insights.cpm || 0),
        ctr: parseFloat(insights.ctr || 0),
        impressions: parseInt(insights.impressions || 0, 10),
        clicks: parseInt(insights.clicks || 0, 10),
        conversions: parseInt(conversions, 10),
        roas
      };
    } catch (error) {
      console.error(`Meta Ads getInsights error for ${campaignId}:`, error.response?.data || error.message);
      // Return 0s if insights fail (e.g., campaign too new or no spend)
      return { spend: 0, cpc: 0, cpm: 0, ctr: 0, impressions: 0, clicks: 0, conversions: 0, roas: 0 };
    }
  }
}

module.exports = MetaAdsService;
