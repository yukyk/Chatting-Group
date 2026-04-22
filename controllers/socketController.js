const jwt = require('jsonwebtoken');
const Message = require('../models/Message');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

const userSockets = new Map();

const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
};

const socketAuthMiddleware = (socket, next) => {
  const token = socket.handshake.auth.token;
  
  if (!token) {
    return next(new Error('Authentication required'));
  }
  
  const decoded = verifyToken(token);
  if (!decoded) {
    return next(new Error('Invalid token'));
  }
  
  socket.user = decoded;
  next();
};

const handleJoin = (socket) => {
  return () => {
    if (!socket.user || !socket.user.userId) {
      socket.emit('authError', { message: 'Not authenticated' });
      return;
    }
    const uid = socket.user.userId;
    socket.join(`user_${uid}`);
    userSockets.set(uid, socket.id);
    socket.userId = uid;
    console.log(`User ${uid} joined room user_${uid}`);
  };
};

const handleSendMessage = (socket, io) => {
  return async (data) => {
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
  };
};

const handleDisconnect = (socket) => {
  return () => {
    if (socket.userId) {
      userSockets.delete(socket.userId);
    }
    console.log('User disconnected:', socket.id);
  };
};

const initializeSocket = (io) => {
  io.use(socketAuthMiddleware);

  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join', handleJoin(socket));
    socket.on('sendMessage', handleSendMessage(socket, io));
    socket.on('disconnect', handleDisconnect(socket));
  });
};

module.exports = {
  initializeSocket,
  verifyToken,
  JWT_SECRET
};