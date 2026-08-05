const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const AdAccount = sequelize.define('AdAccount', {
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
  platformAccountId: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'platform_account_id',
  },
  accountName: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'account_name',
  },
  platform: {
    type: DataTypes.ENUM('facebook', 'instagram', 'google', 'tiktok', 'linkedin', 'twitter'),
    allowNull: false,
  },
  currency: {
    type: DataTypes.STRING(10),
    defaultValue: 'USD',
  },
  timezone: {
    type: DataTypes.STRING,
    defaultValue: 'UTC',
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active',
  },
  metadata: {
    type: DataTypes.JSON,
    defaultValue: {},
    comment: 'Platform-specific configuration',
  },
}, {
  tableName: 'ad_accounts',
  timestamps: true,
  underscored: true,
});

module.exports = AdAccount;
