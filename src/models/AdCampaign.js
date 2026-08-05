const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const AdCampaign = sequelize.define('AdCampaign', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'users', key: 'id' },
    field: 'user_id',
  },
  socialAccountId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'social_accounts', key: 'id' },
    field: 'social_account_id',
  },
  adAccountId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'ad_accounts', key: 'id' },
    field: 'ad_account_id',
  },
  platformCampaignId: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'platform_campaign_id',
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  objective: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  platform: {
    type: DataTypes.ENUM('facebook', 'instagram', 'google', 'tiktok', 'linkedin'),
    allowNull: false,
  },
  budget: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
  },
  spent: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
  },
  status: {
    type: DataTypes.ENUM('active', 'paused', 'completed'),
    defaultValue: 'active',
  },
  startDate: {
    type: DataTypes.DATEONLY,
    field: 'start_date',
  },
  endDate: {
    type: DataTypes.DATEONLY,
    field: 'end_date',
  },
}, {
  tableName: 'ad_campaigns',
  timestamps: true,
  underscored: true,
});

module.exports = AdCampaign;
