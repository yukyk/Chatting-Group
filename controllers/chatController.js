const { DataTypes, Op } = require("sequelize");
const Message = require("../models/Message");
const User = require("../models/User");
const Group = require("../models/Group");
const GroupMember = require("../models/GroupMember");
const middleware = require('../socket-io/middleware');

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
        const { contactId } = req.query;
        const messages = await Message.findAll({
            where: {
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
        const { receiverId, content } = req.body;
        console.log("Sending message:", { senderId, receiverId, content });
        
        if (!receiverId || !content) {
            return res.status(400).json({ success: false, message: "Missing required fields" });
        }
        
        const message = await Message.create({ senderId, receiverId, content });
        console.log("Message saved:", message.id);
        res.json({ success: true, message });
    } catch (error) {
        console.error("Send message error:", error);
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
        const members = [userId, ...memberIds].map(id => ({ groupId: group.id, userId: id }));
        await GroupMember.bulkCreate(members);
        console.log('Group created:', group.id, 'with members:', members.length);
        res.json({ success: true, group });
    } catch (error) {
        console.error('Create group error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getGroups = async (req, res) => {
    try {
        const userId = req.user.userId;
        const groups = await Group.findAll({
            include: [{
                model: GroupMember,
                required: false
            }]
        });
        const filteredGroups = groups.filter(g => g.GroupMembers.some(m => m.userId === userId));
        console.log('Groups found:', groups.length, 'filtered:', filteredGroups.length);
        res.json({ success: true, groups: filteredGroups });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};;

exports.getGroup = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { groupId } = req.params;
        const isMember = await GroupMember.findOne({ where: { groupId, userId } });
        if (!isMember) {
            return res.status(403).json({ success: false, message: "Not a member" });
        }
        const group = await Group.findByPk(groupId, {
            include: [{
                model: GroupMember,
                include: [{ model: User, attributes: ['id', 'name', 'email'] }]
            }]
        });
        if (!group) {
            return res.status(404).json({ success: false, message: "Group not found" });
        }
        const members = group.GroupMembers.map(gm => gm.User);
        res.json({ success: true, group: { ...group.toJSON(), members } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getGroupMessages = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { groupId } = req.query;
        const isMember = await GroupMember.findOne({ where: { groupId, userId } });
        if (!isMember) {
            return res.status(403).json({ success: false, message: "Not a member" });
        }
        const messages = await Message.findAll({
            where: { receiverId: groupId, isGroup: true },
            include: [{ model: User, as: 'sender', attributes: ['name'] }],
            order: [["createdAt", "ASC"]]
        });
        const msgs = messages.map(m => ({
            id: m.id,
            senderId: m.senderId,
            senderName: m.sender.name,
            content: m.content,
            createdAt: m.createdAt,
            isGroup: true
        }));
        res.json({ success: true, messages: msgs });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
