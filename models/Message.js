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
        allowNull: false,
        references: { model: "users", key: "id" }
    },
    receiverId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "users", key: "id" }
    },
    groupId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "groups", key: "id" }
    },
    content: {
        type: DataTypes.TEXT,
        allowNull: false
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
