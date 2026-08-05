const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
    validate: { isEmail: true },
  },
  displayName: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  avatarUrl: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  bio: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  jobTitle: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  company: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  phoneNumber: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  firebaseUid: {
    type: DataTypes.STRING(128),
    allowNull: true,
    unique: true,
  },
  passwordHash: {
    type: DataTypes.STRING(255),
    allowNull: true, // Null when using Firebase auth
  },
  subscriptionTier: {
    type: DataTypes.ENUM('starter', 'professional', 'enterprise'),
    defaultValue: 'starter',
    allowNull: false,
  },
  stripeCustomerId: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  stripeSubscriptionId: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  subscriptionStatus: {
    type: DataTypes.ENUM('active', 'past_due', 'canceled', 'trialing', 'inactive'),
    defaultValue: 'inactive',
    allowNull: false,
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  lastLoginAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'users',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['email'], unique: true },
    { fields: ['firebase_uid'], unique: true },
    { fields: ['stripe_customer_id'] },
  ],
});

module.exports = User;
