const jwt = require('jsonwebtoken');

const userSockets = new Map();
const onlineUsers = new Map(); // userId to count of connections

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

const handleJoin = (socket, io) => {
  if (!socket.user || !socket.user.userId) {
    socket.emit('authError', { message: 'Not authenticated' });
    return;
  }
  const uid = socket.user.userId;
  socket.join(`user_${uid}`);
  userSockets.set(uid, socket.id);
  const count = onlineUsers.get(uid) || 0;
  onlineUsers.set(uid, count + 1);
  socket.userId = uid;
  console.log(`User ${uid} joined room user_${uid}`);
  
  // If first connection, notify online
  if (count === 0) {
    io.emit('userOnline', { userId: uid });
  }
  
  // Confirm to the joining user that they have joined
  socket.emit('joined');
};

module.exports = {
  setupMiddleware,
  handleJoin,
  userSockets,
  onlineUsers,
  verifyToken,
  JWT_SECRET
};