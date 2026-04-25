const { sequelize } = require('../models');

const initDatabase = async () => {
    try {
        await sequelize.authenticate();
        console.log('MySQL connection successful');

        // alter:true adds/modifies columns without dropping data
        await sequelize.sync({ alter: true });
        console.log('Database synchronized successfully');
    } catch (error) {
        console.error('Database initialization error:', error);
        process.exit(1);
    }
};

module.exports = initDatabase;