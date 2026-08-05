const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const AdMetric = sequelize.define('AdMetric', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  campaignId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'ad_campaigns', key: 'id' },
    field: 'campaign_id',
  },
  impressions: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  clicks: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  conversions: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  spend: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  cpc: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
    comment: 'Cost Per Click',
  },
  cpm: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
    comment: 'Cost Per Mille',
  },
  ctr: {
    type: DataTypes.DECIMAL(5, 2),
    defaultValue: 0,
    comment: 'Click Through Rate (%)',
  },
  roas: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
    comment: 'Return On Ad Spend',
  },
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
}, {
  tableName: 'ad_metrics',
  timestamps: true,
  underscored: true,
});

module.exports = AdMetric;
