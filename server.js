require('dotenv').config();
const express = require('express');
const path = require('path');
const http = require('http');

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;

require('./models');
const initDatabase = require('./config/initDb');
const { scheduleDailyArchive } = require('./config/archiveMessages');
const { initializeSocket, getIO } = require('./socket-io');

initDatabase()
  .then(() => {
    scheduleDailyArchive();
  })
  .catch((error) => {
    console.error('Database initialization failed:', error);
  });

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api', require('./routes/auth'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/chat', require('./routes/media'));
app.use('/api/ai', require('./routes/ai'));

initializeSocket(server);

// Export io for use in controllers
global.io = getIO();

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

app.get('/private-chat', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'private-chat.html'));
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