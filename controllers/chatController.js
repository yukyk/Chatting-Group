const { DataTypes, Op } = require("sequelize");
const Message = require("../models/Message");
const User = require("../models/User");
const { userSockets } = require('../socket-io/middleware');

exports.getContacts = async (req, res) => {
    try {
        const userId = req.user.userId;

        const users = await User.findAll({
            where: { id: { [Op.ne]: userId } },
            attributes: ["id", "name"]
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
                lastMessage: lastMsg ? lastMsg.content : "",
                online: userSockets.has(user.id)
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
