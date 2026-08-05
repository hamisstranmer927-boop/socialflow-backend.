const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const TeamMember = sequelize.define('TeamMember', {
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
    comment: 'The team owner / inviter',
  },
  memberEmail: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'member_email',
  },
  memberUserId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'users', key: 'id' },
    field: 'member_user_id',
    comment: 'Linked after the invited member signs up',
  },
  role: {
    type: DataTypes.ENUM('admin', 'editor', 'viewer'),
    defaultValue: 'editor',
    allowNull: false,
  },
  inviteStatus: {
    type: DataTypes.ENUM('pending', 'accepted', 'declined'),
    defaultValue: 'pending',
    allowNull: false,
    field: 'invite_status',
  },
  inviteToken: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'invite_token',
  },
}, {
  tableName: 'team_members',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['user_id'] },
    { fields: ['member_email'] },
    { fields: ['user_id', 'member_email'], unique: true },
  ],
});

module.exports = TeamMember;
