const { Server } = require('socket.io');
const middleware = require('./middleware');
const setupChatHandlers = require('./handlers/chat');
const setupPersonalChatHandlers = require('./handlers/personalChat');
const { registerMediaHandlers } = require('./handlers/mediachat');

let ioInstance = null;

const initializeSocket = (httpServer) => {
  const io = new Server(httpServer);
  ioInstance = io;

  // Setup middleware
  middleware.setupMiddleware(io);

  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Setup event handlers
    setupChatHandlers(socket, io);
    setupPersonalChatHandlers(socket, io);
    registerMediaHandlers(socket, io);

    // Handle disconnect
    socket.on('disconnect', () => {
      if (socket.userId) {
        const uid = socket.userId;
        const count = middleware.onlineUsers.get(uid) || 0;
        if (count > 0) {
          middleware.onlineUsers.set(uid, count - 1);
          if (count - 1 === 0) {
            // Last connection, notify offline
            io.emit('userOffline', { userId: uid });
            middleware.onlineUsers.delete(uid);
          }
        }
      }
      middleware.userSockets.delete(uid);
      console.log('User disconnected:', socket.id);
    });
  });
};

const getIO = () => ioInstance;

module.exports = { initializeSocket, getIO };