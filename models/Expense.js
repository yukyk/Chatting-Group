const { DataTypes } = require("sequelize");
const sequelize = require("../Utils/util");

const Expense = sequelize.define("Expense", {
    amount:{
        type: DataTypes.FLOAT,
        allowNull: false,
        validate:{
            min:1
        }
    },
    description:{
        type: DataTypes.STRING,
        allowNull: false
    },
    category:{
        type: DataTypes.STRING,
        allowNull: false
    },
    status:{
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'pending'
    },
    userId:{
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id',
            onDelete: 'CASCADE'
        }
    },
    note:{
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: null
    }
}, {
    tableName: "expenses",
    timestamps: true
});

module.exports = Expense;