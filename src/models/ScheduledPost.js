const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ScheduledPost = sequelize.define('ScheduledPost', {
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
  content: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Post caption/text content',
  },
  mediaUrls: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: 'Array of media file URLs',
  },
  locationName: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'Optional location tagging for the post',
  },
  targetAccountIds: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: 'Array of SocialAccount UUIDs to publish to',
  },
  platforms: {
    type: DataTypes.JSON,
    allowNull: false,
    comment: 'Array of platform names to publish to',
  },
  scheduleTime: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('draft', 'scheduled', 'publishing', 'published', 'partially_published', 'failed'),
    defaultValue: 'draft',
    allowNull: false,
  },
  publishedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  platformSpecific: {
    type: DataTypes.JSON,
    defaultValue: {},
    comment: 'Per-platform overrides (e.g., different captions, hashtags)',
  },
  tags: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: 'Internal tags for organization',
  },
  errorMessage: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Error details if publishing failed',
  },
  bullJobId: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'Reference to the Bull queue job',
  },
}, {
  tableName: 'scheduled_posts',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['user_id'] },
    { fields: ['status'] },
    { fields: ['schedule_time'] },
    { fields: ['user_id', 'status'] },
  ],
});

module.exports = ScheduledPost;
