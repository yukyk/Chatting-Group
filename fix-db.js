/**
 * Run this ONCE to fix the existing messages table:
 *   node fix-db.js
 *
 * It drops the old foreign key constraints and makes receiverId nullable.
 * After running it, start the server normally with: npm run dev
 */
require('dotenv').config();
const { sequelize } = require('./models');

async function fix() {
    const q = (sql) => sequelize.query(sql);

    try {
        await sequelize.authenticate();
        console.log('Connected to DB');

        // Drop FK constraints that reference receiverId (name may vary)
        // We ignore errors here in case they don't exist yet
        const fks = ['messages_ibfk_2', 'messages_receiver_id_foreign'];
        for (const fk of fks) {
            try {
                await q(`ALTER TABLE messages DROP FOREIGN KEY \`${fk}\``);
                console.log(`Dropped FK ${fk}`);
            } catch { /* didn't exist, fine */ }
        }

        // Make receiverId nullable (the column might already be allowNull in the model
        // but the DB column definition may still say NOT NULL)
        await q(`ALTER TABLE messages MODIFY COLUMN receiverId INT NULL`);
        console.log('receiverId is now nullable');

        // Add groupId column if it doesn't exist yet
        try {
            await q(`ALTER TABLE messages ADD COLUMN groupId INT NULL`);
            console.log('groupId column added');
        } catch { console.log('groupId column already exists'); }

        console.log('\nDone! Now run: npm run dev');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err.message);
        process.exit(1);
    }
}

fix();