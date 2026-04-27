const { DataTypes } = require("sequelize");
const sequelize = require("../utils/util");

const Message = sequelize.define("Message", {
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
        allowNull: true   // nullable: null for group messages
    },
    groupId: {
        type: DataTypes.INTEGER,
        allowNull: true   // nullable: null for direct messages
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
    tableName: "messages",
    timestamps: true
});

module.exports = Message;