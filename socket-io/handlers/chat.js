const { Message, User } = require('../../models');
const middleware = require('../middleware');

const pendingInvitations = new Map();

const setupHandlers = (socket, io) => {

    socket.on('join', () => {
        middleware.handleJoin(socket, io);
    });

    // ── Direct messages ──────────────────────────────────────────────────────
    socket.on('sendMessage', async (data) => {
        if (!socket.user?.userId) {
            socket.emit('authError', { message: 'Not authenticated' });
            return;
        }

        const senderId = socket.user.userId;
        const receiverId = parseInt(data.receiverId, 10);
        const { content, roomId } = data;

        if (isNaN(receiverId) || !content?.trim()) {
            socket.emit('messageError', { message: 'Invalid message payload' });
            return;
        }

        try {
            const message = await Message.create({
                senderId,
                receiverId,
                content: content.trim(),
                isGroup: false
            });

            io.to(roomId).emit('newMessage', {
                id: message.id,
                senderId: message.senderId,
                receiverId: message.receiverId,
                content: message.content,
                createdAt: message.createdAt,
                isGroup: false
            });
        } catch (err) {
            console.error('Error saving message:', err);
            socket.emit('messageError', { message: 'Failed to send message' });
        }
    });

    // ── Room management ───────────────────────────────────────────────────────
    socket.on('join_room', (data) => {
        socket.join(data.roomId);
    });

    socket.on('leave_room', (data) => {
        socket.leave(data.roomId);
    });

    // ── Group messages ────────────────────────────────────────────────────────
    socket.on('join_group', (data) => {
        const groupId = parseInt(data.groupId, 10);
        socket.join(`group_${groupId}`);
    });

    socket.on('sendGroupMessage', async (data) => {
        if (!socket.user?.userId) {
            socket.emit('authError', { message: 'Not authenticated' });
            return;
        }

        const senderId = socket.user.userId;
        const groupId = parseInt(data.groupId, 10);
        const content = data.content?.trim();

        if (isNaN(groupId) || !content) {
            socket.emit('groupMessageError', { message: 'Invalid group message payload' });
            return;
        }

        try {
            const message = await Message.create({
                senderId,
                groupId,
                content,
                isGroup: true
            });

            // Fetch sender name so all clients can show it
            const sender = await User.findByPk(senderId, { attributes: ['name'] });

            io.to(`group_${groupId}`).emit('newMessage', {
                id: message.id,
                senderId: message.senderId,
                senderName: sender?.name ?? 'Unknown',
                groupId: message.groupId,
                content: message.content,
                createdAt: message.createdAt,
                isGroup: true
            });
        } catch (err) {
            console.error('Error saving group message:', err);
            socket.emit('groupMessageError', { message: 'Failed to send group message' });
        }
    });

    // ── Private room invitations ──────────────────────────────────────────────
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
                    }
                } catch (err) {
                    console.error('Error fetching inviter:', err);
                }
            } else {
                socket.emit('invitation_failed', { message: 'Contact socket not found' });
            }
        } else {
            if (!pendingInvitations.has(contactId)) {
                pendingInvitations.set(contactId, []);
            }
            const inviterUser = await User.findByPk(socket.user.userId);
            pendingInvitations.get(contactId).push({
                roomId,
                inviterId: socket.user.userId,
                inviterName: inviterUser?.name ?? 'Unknown'
            });
            socket.emit('invitation_sent_offline', {
                message: 'Invitation sent. Contact will receive it when online.'
            });
        }
    });

    socket.on('accept_private_room', (data) => {
        const { roomId, inviterId } = data;
        socket.join(roomId);
        socket.emit('redirect_to_private', { roomId });

        const inviterSocketId = middleware.userSockets.get(inviterId);
        if (inviterSocketId) {
            const inviterSocket = io.sockets.sockets.get(inviterSocketId);
            if (inviterSocket) {
                inviterSocket.join(roomId);
                inviterSocket.emit('redirect_to_private', { roomId });
            }
        }
    });

    // Broadcast group deletion to all members still in the room
    socket.on('group_deleted', ({ groupId }) => {
        io.to(`group_${groupId}`).emit('groupDeleted', { groupId });
    });
};

module.exports = setupHandlers;