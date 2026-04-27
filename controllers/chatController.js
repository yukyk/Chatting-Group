const path = require('path');
const { Op } = require("sequelize");
const { Message, User, Group, GroupMember } = require("../models");
const middleware = require('../socket-io/middleware');
const s3Client = require('../config/config/s3');
const { PutObjectCommand } = require('@aws-sdk/client-s3');
const { v4: uuidv4 } = require('uuid');

exports.getContacts = async (req, res) => {
    try {
        const userId = req.user.userId;

        const users = await User.findAll({
            where: { id: { [Op.ne]: userId } },
            attributes: ["id", "name", "email"]
        });

        const contacts = await Promise.all(users.map(async (user) => {
            const lastMsg = await Message.findOne({
                where: {
                    isGroup: false,
                    [Op.or]: [
                        { senderId: userId, receiverId: user.id },
                        { senderId: user.id, receiverId: userId }
                    ]
                },
                order: [["createdAt", "DESC"]]
            });
            return {
                id: user.id,
                name: user.name,
                email: user.email,
                lastMessage: lastMsg ? lastMsg.content : "",
                online: middleware.onlineUsers.has(user.id)
            };
        }));

        res.json({ success: true, contacts });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getMessages = async (req, res) => {
    try {
        const userId = req.user.userId;
        const contactId = parseInt(req.query.contactId, 10);
        const messages = await Message.findAll({
            where: {
                isGroup: false,
                [Op.or]: [
                    { senderId: userId, receiverId: contactId },
                    { senderId: contactId, receiverId: userId }
                ]
            },
            order: [["createdAt", "ASC"]]
        });
        res.json({ success: true, messages });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.sendMessage = async (req, res) => {
    try {
        const senderId = req.user.userId;
        const receiverId = parseInt(req.body.receiverId, 10);
        const { content } = req.body;

        if (!receiverId || !content) {
            return res.status(400).json({ success: false, message: "Missing required fields" });
        }

        const message = await Message.create({ senderId, receiverId, content, isGroup: false });
        res.json({ success: true, message });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.validateEmail = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ success: false, message: "Email is required" });
        }
        const user = await User.findOne({ where: { email } });
        if (user) {
            res.json({ success: true, user: { id: user.id, name: user.name, email: user.email } });
        } else {
            res.status(404).json({ success: false, message: "User not found" });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.createGroup = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { name, memberIds } = req.body;

        if (!name || !memberIds || !Array.isArray(memberIds)) {
            return res.status(400).json({ success: false, message: "Name and memberIds required" });
        }

        const group = await Group.create({ name, creatorId: userId });

        const allIds = [...new Set([userId, ...memberIds.map(id => parseInt(id, 10))])];
        const members = allIds.map(id => ({ groupId: group.id, userId: id }));
        await GroupMember.bulkCreate(members);

        res.json({ success: true, group });
    } catch (error) {
        console.error('Create group error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getGroups = async (req, res) => {
    try {
        const userId = req.user.userId;

        const memberships = await GroupMember.findAll({ where: { userId } });
        const groupIds = memberships.map(m => m.groupId);

        if (groupIds.length === 0) {
            return res.json({ success: true, groups: [] });
        }

        const groups = await Group.findAll({
            where: { id: groupIds },
            include: [{ model: GroupMember, as: 'GroupMembers' }]
        });

        res.json({ success: true, groups });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getGroup = async (req, res) => {
    try {
        const userId = req.user.userId;
        const groupId = parseInt(req.params.groupId, 10);

        const isMember = await GroupMember.findOne({ where: { groupId, userId } });
        if (!isMember) {
            return res.status(403).json({ success: false, message: "Not a member" });
        }

        const group = await Group.findByPk(groupId, {
            include: [{
                model: GroupMember,
                as: 'GroupMembers',
                include: [{ model: User, as: 'User', attributes: ['id', 'name', 'email'] }]
            }]
        });

        if (!group) {
            return res.status(404).json({ success: false, message: "Group not found" });
        }

        const members = group.GroupMembers.map(gm => gm.User).filter(Boolean);
        res.json({ success: true, group: { ...group.toJSON(), members } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getGroupMessages = async (req, res) => {
    try {
        const userId = req.user.userId;
        const groupId = parseInt(req.query.groupId, 10);

        if (isNaN(groupId)) {
            return res.status(400).json({ success: false, message: "Invalid groupId" });
        }

        const isMember = await GroupMember.findOne({ where: { groupId, userId } });
        if (!isMember) {
            return res.status(403).json({ success: false, message: "Not a member" });
        }

        const messages = await Message.findAll({
            where: { groupId, isGroup: true },
            include: [{ model: User, as: 'sender', attributes: ['id', 'name'] }],
            order: [["createdAt", "ASC"]]
        });

        const msgs = messages.map(m => ({
            id: m.id,
            senderId: m.senderId,
            senderName: m.sender?.name ?? 'Unknown',
            groupId: m.groupId,
            content: m.content,
            createdAt: m.createdAt,
            isGroup: true
        }));

        res.json({ success: true, messages: msgs });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.deleteGroup = async (req, res) => {
    try {
        const userId = req.user.userId;
        const groupId = parseInt(req.params.groupId, 10);

        const group = await Group.findByPk(groupId);
        if (!group) {
            return res.status(404).json({ success: false, message: "Group not found" });
        }
        if (group.creatorId !== userId) {
            return res.status(403).json({ success: false, message: "Only the group creator can delete this group" });
        }

        // Delete messages, members, then group
        await Message.destroy({ where: { groupId, isGroup: true } });
        await GroupMember.destroy({ where: { groupId } });
        await group.destroy();

        res.json({ success: true, message: "Group deleted" });
    } catch (error) {
        console.error('Delete group error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.uploadMedia = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }

        const file = req.file;
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (file.size > maxSize) {
            return res.status(400).json({ success: false, message: 'File too large. Max 10MB.' });
        }

        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'video/mp4', 'application/pdf'];
        if (!allowedTypes.includes(file.mimetype)) {
            return res.status(400).json({ success: false, message: 'Invalid file type. Only images, videos, and PDFs allowed.' });
        }

        const extension = path.extname(file.originalname).toLowerCase() || '';
        const safeExtension = extension.match(/\.[a-z0-9]+$/i) ? extension : '';
        const key = `uploads/${uuidv4()}${safeExtension}`;

        const uploadParams = {
            Bucket: process.env.AWS_S3_BUCKET_NAME,
            Key: key,
            Body: file.buffer,
            ContentType: file.mimetype,
            ACL: 'public-read'
        };

        await s3Client.send(new PutObjectCommand(uploadParams));

        const url = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

        res.json({ success: true, url, mediaType: getMediaType(file.mimetype) });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ success: false, message: 'Upload failed' });
    }
};

function getMediaType(mimetype) {
    if (mimetype.startsWith('image/')) return 'image';
    if (mimetype.startsWith('video/')) return 'video';
    return 'file';
}