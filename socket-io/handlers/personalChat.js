const Message = require('../../models/Message');
const { Op } = require('sequelize');
const { userSockets } = require('../middleware');

// Track personal rooms
const personalRooms = new Map(); // roomId -> { user1, user2 }

const setupPersonalChatHandlers = (socket, io) => {
  // Start a personal chat with another user
  socket.on('start_personal_chat', async (data) => {
    if (!socket.user || !socket.user.userId) {
      socket.emit('authError', { message: 'Not authenticated' });
      return;
    }

    const userId = socket.user.userId;
    const { targetUserId } = data;
    const targetIdInt = parseInt(targetUserId);

    if (isNaN(targetIdInt) || targetIdInt === userId) {
      socket.emit('personalChatError', { message: 'Invalid user' });
      return;
    }

    // Create personal room ID (sorted to ensure consistency)
    const roomId = [userId, targetIdInt].sort((a, b) => a - b).join('_');

    // Join both users to the personal room
    socket.join(`personal_${roomId}`);
    
    const targetSocketId = userSockets.get(targetIdInt);
    if (targetSocketId) {
      io.sockets.sockets.get(targetSocketId)?.join(`personal_${roomId}`);
    }

    // Track the room
    if (!personalRooms.has(roomId)) {
      personalRooms.set(roomId, {
        user1: userId,
        user2: targetIdInt,
        createdAt: new Date().toISOString()
      });
    }

    // Notify the user who initiated the chat
    const roomInfo = {
      roomId,
      participants: [userId, targetIdInt],
      createdAt: new Date().toISOString()
    };

    socket.emit('personalChatStarted', roomInfo);

    // Load recent messages for this personal room
    try {
      const messages = await Message.findAll({
        where: {
          [require('sequelize').Op.or]: [
            { senderId: userId, receiverId: targetIdInt },
            { senderId: targetIdInt, receiverId: userId }
          ]
        },
        order: [['createdAt', 'ASC']],
        limit: 50
      });

      const messageData = messages.map(m => ({
        id: m.id,
        senderId: m.senderId,
        receiverId: m.receiverId,
        content: m.content,
        createdAt: m.createdAt
      }));

      socket.emit('personalChatHistory', { roomId, messages: messageData });
    } catch (err) {
      console.error('Error loading personal chat history:', err);
    }
  });

  // Send a personal message within a personal room
  socket.on('personal_message', async (data) => {
    if (!socket.user || !socket.user.userId) {
      socket.emit('authError', { message: 'Not authenticated' });
      return;
    }

    const senderId = socket.user.userId;
    const { roomId, receiverId, content } = data;
    const receiverIdInt = parseInt(receiverId);

    if (isNaN(receiverIdInt) || !content || !content.trim()) {
      socket.emit('personalMessageError', { message: 'Invalid message' });
      return;
    }

    // Verify this is a valid personal room for these users
    const roomKey = [senderId, receiverIdInt].sort((a, b) => a - b).join('_');
    if (roomKey !== roomId) {
      socket.emit('personalMessageError', { message: 'Invalid room' });
      return;
    }

    try {
      const message = await Message.create({
        senderId,
        receiverId: receiverIdInt,
        content: content.trim()
      });

      const messageData = {
        id: message.id,
        senderId: message.senderId,
        receiverId: message.receiverId,
        content: message.content,
        createdAt: message.createdAt,
        roomId
      };

      // Emit to both users in the personal room
      io.to(`personal_${roomId}`).emit('personalMessage', messageData);
      console.log(`Personal message sent in room ${roomId}:`, message.id);
    } catch (err) {
      console.error('Error saving personal message:', err);
      socket.emit('personalMessageError', { message: 'Failed to send message' });
    }
  });

  // Leave personal room
  socket.on('leave_personal_room', (data) => {
    const { roomId } = data;
    socket.leave(`personal_${roomId}`);
    socket.emit('leftPersonalRoom', { roomId });
  });

  // Cleanup on disconnect
  socket.on('disconnect', () => {
    if (socket.userId) {
      userSockets.delete(socket.userId);
    }
    console.log('User disconnected:', socket.id);
  });
};

module.exports = setupPersonalChatHandlers;