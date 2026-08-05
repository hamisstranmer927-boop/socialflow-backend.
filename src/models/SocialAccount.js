const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const SocialAccount = sequelize.define('SocialAccount', {
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
  platform: {
    type: DataTypes.ENUM('instagram', 'facebook', 'tiktok', 'linkedin', 'youtube', 'twitter'),
    allowNull: false,
  },
  platformAccountId: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  accountName: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  accountUsername: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  avatarUrl: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  accessToken: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  refreshToken: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  tokenExpiresAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  scopes: {
    type: DataTypes.JSON,
    defaultValue: [],
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  metadata: {
    type: DataTypes.JSON,
    defaultValue: {},
    comment: 'Platform-specific metadata (page ID, channel ID, etc.)',
  },
}, {
  tableName: 'social_accounts',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['user_id'] },
    { fields: ['platform'] },
    { fields: ['user_id', 'platform', 'platform_account_id'], unique: true },
  ],
});

module.exports = SocialAccount;
