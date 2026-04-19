const sequelize = require('../Utils/util');
const User = require('../models/User');
const Message = require('../models/Message');

const initDatabase = async () => {
    try {
        await sequelize.authenticate();
        console.log('MySQL connection successful');

        await sequelize.sync({ alter: true });
        console.log('Database synchronized successfully');
    } catch (error) {
        console.error('Database initialization error:', error);
        process.exit(1);
    }
};

module.exports = initDatabase;