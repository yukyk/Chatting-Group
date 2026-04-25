const express = require("express");
const router = express.Router();
const chatController = require("../controllers/chatController");
const { authMiddleware } = require("../controllers/AuthController");

router.get("/contacts", authMiddleware, chatController.getContacts);
router.get("/messages", authMiddleware, chatController.getMessages);
router.post("/messages", authMiddleware, chatController.sendMessage);
router.post("/validate-email", authMiddleware, chatController.validateEmail);

module.exports = router;
