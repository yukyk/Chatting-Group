const Message = require('../../models/Message');
const User = require('../../models/User');
const middleware = require('../middleware');

const pendingInvitations = new Map(); // key: userId, value: array of invitations

const setupHandlers = (socket, io) => {
  // Handle joining user room
  socket.on('join', () => {
    middleware.handleJoin(socket, io);
  });

  // Handle sending messages
  socket.on('sendMessage', async (data) => {
    if (!socket.user || !socket.user.userId) {
      socket.emit('authError', { message: 'Not authenticated' });
      return;
    }

    const senderId = socket.user.userId;
    const { receiverId, content, roomId } = data;
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
      
      // Emit to the room instead of user room
      io.to(roomId).emit('newMessage', messageData);
      console.log(`Message sent to room ${roomId}`);
    } catch (err) {
      console.error('Error saving message:', err);
    }
  });

  // Handle joining a room
  socket.on('join_room', (data) => {
    const { roomId } = data;
    socket.join(roomId);
    console.log(`User ${socket.user.userId} joined room ${roomId}`);
  });

  // Handle leaving a room
  socket.on('leave_room', (data) => {
    const { roomId } = data;
    socket.leave(roomId);
    console.log(`User ${socket.user.userId} left room ${roomId}`);
  });

  // Handle inviting to private room
  socket.on('invite_to_private_room', async (data) => {
    const { contactId, roomId } = data;
    const contactSocketId = middleware.userSockets.get(contactId);
    if (contactSocketId) {
      const contactSocket = io.sockets.sockets.get(contactSocketId);
      if (contactSocket) {
        try {
          const inviter = await User.findByPk(socket.user.userId);
          if (inviter) {
            contactSocket.emit('private_room_invitation', {
              roomId,
              inviterId: socket.user.userId,
              inviterName: inviter.name
            });
            console.log(`Invitation sent from ${socket.user.userId} to ${contactId} for room ${roomId}`);
          }
        } catch (err) {
          console.error('Error fetching inviter:', err);
        }
      } else {
        socket.emit('invitation_failed', { message: 'Contact socket not found' });
      }
    } else {
      // Store pending invitation
      if (!pendingInvitations.has(contactId)) {
        pendingInvitations.set(contactId, []);
      }
      pendingInvitations.get(contactId).push({
        roomId,
        inviterId: socket.user.userId,
        inviterName: (await User.findByPk(socket.user.userId)).name
      });
      socket.emit('invitation_sent_offline', { message: 'Invitation sent. Contact will receive it when online.' });
      console.log(`Invitation stored for offline user ${contactId}`);
    }
  });

  // Handle accepting private room invitation
  socket.on('accept_private_room', (data) => {
    const { roomId, inviterId } = data;
    const inviterSocketId = middleware.userSockets.get(inviterId);
    // Join invitee to the room
    socket.join(roomId);
    // Emit to invitee
    socket.emit('redirect_to_private', { roomId });
    if (inviterSocketId) {
      const inviterSocket = io.sockets.sockets.get(inviterSocketId);
      if (inviterSocket) {
        // Join inviter to the room
        inviterSocket.join(roomId);
        // Emit to inviter
        inviterSocket.emit('redirect_to_private', { roomId });
        console.log(`Private room ${roomId} created for users ${socket.user.userId} and ${inviterId}`);
      }
    }
  });

  // Handle joining group
  socket.on('join_group', (data) => {
    const { groupId } = data;
    socket.join(`group_${groupId}`);
    console.log(`User ${socket.user.userId} joined group ${groupId}`);
  });

  // Handle sending group messages
  socket.on('sendGroupMessage', async (data) => {
    if (!socket.user || !socket.user.userId) {
      socket.emit('authError', { message: 'Not authenticated' });
      return;
    }

    const senderId = socket.user.userId;
    const { groupId, content } = data;
    
    try {
      const message = await Message.create({ senderId, receiverId: groupId, content, isGroup: true });
      
      const messageData = {
        id: message.id,
        senderId: message.senderId,
        receiverId: message.receiverId,
        content: message.content,
        createdAt: message.createdAt,
        isGroup: true
      };
      
      io.to(`group_${groupId}`).emit('newMessage', messageData);
      console.log(`Group message sent to group ${groupId}`);
    } catch (err) {
      console.error('Error saving group message:', err);
    }
  });
};

module.exports = setupHandlers;