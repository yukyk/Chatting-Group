require('dotenv').config();
const express = require('express');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

const initDatabase = require('./config/initDb');
initDatabase();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api', require('./routes/auth'));
app.use('/api/chat', require('./routes/chat'));

const userSockets = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join', (userId) => {
    const uid = parseInt(userId);
    socket.join(`user_${uid}`);
    userSockets.set(uid, socket.id);
    socket.userId = uid;
    console.log(`User ${uid} joined room user_${uid}`);
  });

  socket.on('sendMessage', async (data) => {
    const { senderId, receiverId, content } = data;
    const senderIdInt = parseInt(senderId);
    const receiverIdInt = parseInt(receiverId);
    
    try {
      const Message = require("./models/Message");
      const message = await Message.create({ senderId: senderIdInt, receiverId: receiverIdInt, content });
      
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

  socket.on('disconnect', () => {
    if (socket.userId) {
      userSockets.delete(socket.userId);
    }
    console.log('User disconnected:', socket.id);
  });
});

app.get('/', (req, res) => {
  res.redirect('/chat');
});

app.get('/signup', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'signup.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

app.get('/chat', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'chat.html'));
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Something went wrong!'
  });
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});