const { sequelize } = require('../models');

const initDatabase = async () => {
    try {
        await sequelize.authenticate();
        console.log('MySQL connection successful');

        // Try to sync with alter:true first
        try {
            await sequelize.sync({ alter: true });
            console.log('Database synchronized successfully');
        } catch (alterError) {
            // If "too many keys" error occurs, fall back to alter:false
            if (alterError.original && alterError.original.code === 'ER_TOO_MANY_KEYS') {
                console.warn('Too many keys in table, skipping ALTER. Using basic sync.');
                await sequelize.sync({ alter: false });
                console.log('Database synchronized (without ALTER)');
            } else {
                throw alterError;
            }
        }
    } catch (error) {
        console.error('Database initialization error:', error);
        process.exit(1);
    }
};

module.exports = initDatabase;