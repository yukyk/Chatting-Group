const Message = require("../models/Message");

exports.getMessages = async (req, res) => {
    try {
        const { userId, contactId } = req.query;
        const messages = await Message.findAll({
            where: {
                [require("sequelize").Op.or]: [
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
        const { senderId, receiverId, content } = req.body;
        const message = await Message.create({ senderId, receiverId, content });
        res.json({ success: true, message });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
