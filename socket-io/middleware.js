const jwt = require('jsonwebtoken');

const userSockets = new Map();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
};

const setupMiddleware = (io) => {
  io.use((socket, next) => {
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
  });
};

const handleJoin = (socket) => {
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

module.exports = {
  setupMiddleware,
  handleJoin,
  userSockets,
  verifyToken,
  JWT_SECRET
};