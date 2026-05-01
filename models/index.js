const sequelize = require('../utils/util');
const User = require('./User');
const Message = require('./Message');
const ArchivedChat = require('./ArchivedChat');
const Group = require('./Group');
const GroupMember = require('./GroupMember');

// User / Message associations
User.hasMany(Message, { foreignKey: 'senderId', as: 'sentMessages' });
Message.belongsTo(User, { foreignKey: 'senderId', as: 'sender' });
Message.belongsTo(User, { foreignKey: 'receiverId', as: 'receiver' });

// Group / GroupMember associations
Group.hasMany(GroupMember, { foreignKey: 'groupId', as: 'GroupMembers' });
GroupMember.belongsTo(Group, { foreignKey: 'groupId', as: 'Group' });

// User / GroupMember associations
User.hasMany(GroupMember, { foreignKey: 'userId', as: 'GroupMemberships' });
GroupMember.belongsTo(User, { foreignKey: 'userId', as: 'User' });

// Group / Message associations
Group.hasMany(Message, { foreignKey: 'groupId', as: 'groupMessages' });
Message.belongsTo(Group, { foreignKey: 'groupId', as: 'group' });

module.exports = {
  sequelize,
  User,
  Message,
  ArchivedChat,
  Group,
  GroupMember
};
