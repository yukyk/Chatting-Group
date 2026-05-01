const { sequelize, Message } = require('../models');

async function archiveOldMessages() {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const transaction = await sequelize.transaction();

  try {
    const [insertResult] = await sequelize.query(
      `INSERT INTO archived_chats (senderId, receiverId, groupId, content, mediaUrl, mediaType, isGroup, createdAt, updatedAt)
       SELECT senderId, receiverId, groupId, content, mediaUrl, mediaType, isGroup, createdAt, updatedAt
       FROM messages
       WHERE createdAt < :cutoff`,
      { replacements: { cutoff }, transaction }
    );

    const [deleteResult] = await sequelize.query(
      `DELETE FROM messages WHERE createdAt < :cutoff`,
      { replacements: { cutoff }, transaction }
    );

    await transaction.commit();

    const inserted = insertResult && insertResult.affectedRows ? insertResult.affectedRows : 0;
    const deleted = deleteResult && deleteResult.affectedRows ? deleteResult.affectedRows : 0;

    console.log(`Archived ${inserted} messages and deleted ${deleted} old messages from messages table.`);
  } catch (error) {
    await transaction.rollback();
    console.error('Failed to archive old messages:', error);
  }
}

function getNextRunDelay(targetHour = 3, targetMinute = 0) {
  const now = new Date();
  const nextRun = new Date(now);
  nextRun.setHours(targetHour, targetMinute, 0, 0);

  if (nextRun <= now) {
    nextRun.setDate(nextRun.getDate() + 1);
  }

  return nextRun.getTime() - now.getTime();
}

function scheduleDailyArchive() {
  archiveOldMessages();

  const initialDelay = getNextRunDelay(3, 0);

  setTimeout(() => {
    archiveOldMessages();
    setInterval(archiveOldMessages, 24 * 60 * 60 * 1000);
  }, initialDelay);

  const nextRun = new Date(Date.now() + initialDelay);
  console.log(`Scheduled nightly message archive at 03:00. Next run at ${nextRun.toLocaleString()}`);
}

module.exports = {
  archiveOldMessages,
  scheduleDailyArchive
};
