const { DataTypes } = require('sequelize');
const sequelize = require('../utils/util');

const ArchivedChat = sequelize.define('ArchivedChat', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    senderId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    receiverId: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    groupId: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    content: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    mediaUrl: {
        type: DataTypes.STRING,
        allowNull: true
    },
    mediaType: {
        type: DataTypes.ENUM('text', 'image', 'video', 'file'),
        defaultValue: 'text'
    },
    isGroup: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    }
}, {
    tableName: 'archived_chats',
    timestamps: true
});

module.exports = ArchivedChat;
