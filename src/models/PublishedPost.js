const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PublishedPost = sequelize.define('PublishedPost', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  scheduledPostId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'scheduled_posts', key: 'id' },
    field: 'scheduled_post_id',
  },
  platform: {
    type: DataTypes.ENUM('instagram', 'facebook', 'tiktok', 'linkedin', 'youtube', 'twitter'),
    allowNull: false,
  },
  platformPostId: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'The post ID returned by the platform after publishing',
  },
  postUrl: {
    type: DataTypes.STRING(500),
    allowNull: true,
    comment: 'Direct URL to the published post',
  },
  publishedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  status: {
    type: DataTypes.ENUM('success', 'failed'),
    defaultValue: 'success',
  },
  errorMessage: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  metadata: {
    type: DataTypes.JSON,
    defaultValue: {},
    comment: 'Platform-specific response data',
  },
}, {
  tableName: 'published_posts',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['scheduled_post_id'] },
    { fields: ['platform'] },
    { fields: ['published_at'] },
  ],
});

module.exports = PublishedPost;
