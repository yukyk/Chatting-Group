const sequelize = require('../utils/util');

const initDatabase = async () => {
    try {
        await sequelize.authenticate();
        console.log('MySQL connection successful');

        await sequelize.sync();
        console.log('Database synchronized successfully');
    } catch (error) {
        console.error('Database initialization error:', error);
        process.exit(1);
    }
};

module.exports = initDatabase;