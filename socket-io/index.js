const { Server } = require('socket.io');
const { setupMiddleware } = require('./middleware');
const setupHandlers = require('./handlers/chat');

const initializeSocket = (httpServer) => {
  const io = new Server(httpServer);

  // Setup middleware
  setupMiddleware(io);

  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Setup event handlers
    setupHandlers(socket, io);

    // Handle disconnect
    socket.on('disconnect', () => {
      if (socket.userId) {
        const { userSockets } = require('./middleware');
        userSockets.delete(socket.userId);
      }
      console.log('User disconnected:', socket.id);
    });
  });
};

module.exports = { initializeSocket };