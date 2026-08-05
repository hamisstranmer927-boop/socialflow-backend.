const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Trend = sequelize.define('Trend', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  platform: {
    type: DataTypes.ENUM('instagram', 'tiktok', 'twitter', 'linkedin', 'facebook', 'youtube', 'all'),
    defaultValue: 'all',
  },
  trendName: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'trend_name',
  },
  category: {
    type: DataTypes.STRING,
    defaultValue: 'General',
  },
  volume: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  growthRate: {
    type: DataTypes.STRING,
    defaultValue: '+15%',
    field: 'growth_rate',
  },
}, {
  tableName: 'trends',
  timestamps: true,
  underscored: true,
});

module.exports = Trend;
