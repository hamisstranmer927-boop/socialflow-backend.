const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Analytics = sequelize.define('Analytics', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  socialAccountId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'social_accounts', key: 'id' },
    field: 'social_account_id',
  },
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  metricType: {
    type: DataTypes.ENUM('reach', 'impressions', 'engagement', 'followers', 'likes', 'comments', 'shares', 'clicks', 'saves', 'profile_views'),
    allowNull: false,
    field: 'metric_type',
  },
  value: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    defaultValue: 0,
  },
  platform: {
    type: DataTypes.ENUM('instagram', 'facebook', 'tiktok', 'linkedin', 'youtube', 'twitter'),
    allowNull: false,
  },
}, {
  tableName: 'analytics',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['social_account_id'] },
    { fields: ['date'] },
    { fields: ['metric_type'] },
    { fields: ['social_account_id', 'date', 'metric_type'], unique: true },
  ],
});

module.exports = Analytics;
