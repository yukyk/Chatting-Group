const { DataTypes } = require("sequelize");
const sequelize = require("../utils/util");

const GroupMember = sequelize.define("GroupMember", {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    groupId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "groups", key: "id" }
    },
    userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "users", key: "id" }
    }
}, {
    tableName: "group_members",
    timestamps: true
});

module.exports = GroupMember;