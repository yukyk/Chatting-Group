const { DataTypes } = require("sequelize");
const sequelize = require("../utils/util");

const Group = sequelize.define("Group", {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    creatorId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "users", key: "id" }
    }
}, {
    tableName: "groups",
    timestamps: true
});

module.exports = Group;