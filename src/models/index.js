const User = require('./User');
const SocialAccount = require('./SocialAccount');
const ScheduledPost = require('./ScheduledPost');
const PublishedPost = require('./PublishedPost');
const Analytics = require('./Analytics');
const TeamMember = require('./TeamMember');
const MediaLibrary = require('./MediaLibrary');
const AdAccount = require('./AdAccount');
const AdCampaign = require('./AdCampaign');
const AdMetric = require('./AdMetric');
const Trend = require('./Trend');

// ─── Associations ────────────────────────────────────────

// User → SocialAccounts (1:N)
User.hasMany(SocialAccount, { foreignKey: 'userId', as: 'socialAccounts', onDelete: 'CASCADE' });
SocialAccount.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// User → ScheduledPosts (1:N)
User.hasMany(ScheduledPost, { foreignKey: 'userId', as: 'scheduledPosts', onDelete: 'CASCADE' });
ScheduledPost.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// ScheduledPost → PublishedPosts (1:N)
ScheduledPost.hasMany(PublishedPost, { foreignKey: 'scheduledPostId', as: 'publishedPosts', onDelete: 'CASCADE' });
PublishedPost.belongsTo(ScheduledPost, { foreignKey: 'scheduledPostId', as: 'scheduledPost' });

// SocialAccount → Analytics (1:N)
SocialAccount.hasMany(Analytics, { foreignKey: 'socialAccountId', as: 'analytics', onDelete: 'CASCADE' });
Analytics.belongsTo(SocialAccount, { foreignKey: 'socialAccountId', as: 'socialAccount' });

// User → TeamMembers (1:N) — as team owner
User.hasMany(TeamMember, { foreignKey: 'userId', as: 'teamMembers', onDelete: 'CASCADE' });
TeamMember.belongsTo(User, { foreignKey: 'userId', as: 'owner' });

// TeamMember → User (N:1) — as invited member
User.hasMany(TeamMember, { foreignKey: 'memberUserId', as: 'teamMemberships' });
TeamMember.belongsTo(User, { foreignKey: 'memberUserId', as: 'member' });

// User → MediaLibrary (1:N)
User.hasMany(MediaLibrary, { foreignKey: 'userId', as: 'media', onDelete: 'CASCADE' });
MediaLibrary.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// User → AdCampaigns (1:N)
User.hasMany(AdCampaign, { foreignKey: 'userId', as: 'adCampaigns', onDelete: 'CASCADE' });
AdCampaign.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// AdCampaign → AdMetrics (1:N)
AdCampaign.hasMany(AdMetric, { foreignKey: 'campaignId', as: 'metrics', onDelete: 'CASCADE' });
AdMetric.belongsTo(AdCampaign, { foreignKey: 'campaignId', as: 'campaign' });

// User → AdAccounts (1:N)
User.hasMany(AdAccount, { foreignKey: 'userId', as: 'adAccounts', onDelete: 'CASCADE' });
AdAccount.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// SocialAccount → AdAccounts (1:N)
SocialAccount.hasMany(AdAccount, { foreignKey: 'socialAccountId', as: 'adAccounts', onDelete: 'SET NULL' });
AdAccount.belongsTo(SocialAccount, { foreignKey: 'socialAccountId', as: 'socialAccount' });

// AdAccount → AdCampaigns (1:N)
AdAccount.hasMany(AdCampaign, { foreignKey: 'adAccountId', as: 'campaigns', onDelete: 'CASCADE' });
AdCampaign.belongsTo(AdAccount, { foreignKey: 'adAccountId', as: 'adAccount' });

module.exports = {
  User,
  SocialAccount,
  ScheduledPost,
  PublishedPost,
  Analytics,
  TeamMember,
  MediaLibrary,
  AdAccount,
  AdCampaign,
  AdMetric,
  Trend,
};
