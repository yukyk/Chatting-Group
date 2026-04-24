const Message = require('../../models/Message');
const { userSockets } = require('../middleware');

const setupHandlers = (socket, io) => {
  // Handle joining user room
  socket.on('join', () => {
    if (!socket.user || !socket.user.userId) {
      socket.emit('authError', { message: 'Not authenticated' });
      return;
    }
    const uid = socket.user.userId;
    socket.join(`user_${uid}`);
    userSockets.set(uid, socket.id);
    socket.userId = uid;
    console.log(`User ${uid} joined room user_${uid}`);
  });

  // Handle sending messages
  socket.on('sendMessage', async (data) => {
    if (!socket.user || !socket.user.userId) {
      socket.emit('authError', { message: 'Not authenticated' });
      return;
    }

    const senderId = socket.user.userId;
    const { receiverId, content } = data;
    const receiverIdInt = parseInt(receiverId);
    
    try {
      const message = await Message.create({ senderId, receiverId: receiverIdInt, content });
      
      const messageData = {
        id: message.id,
        senderId: message.senderId,
        receiverId: message.receiverId,
        content: message.content,
        createdAt: message.createdAt
      };
      
      socket.emit('newMessage', messageData);
      io.to(`user_${receiverIdInt}`).emit('newMessage', messageData);
      console.log(`Message sent to room user_${receiverIdInt}`);
    } catch (err) {
      console.error('Error saving message:', err);
    }
  });
};

module.exports = setupHandlers;