const express = require("express");
const router = express.Router();
const chatController = require("../controllers/chatController");
const { authMiddleware } = require("../controllers/AuthController");
const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage() });

router.get("/contacts",             authMiddleware, chatController.getContacts);
router.get("/messages",             authMiddleware, chatController.getMessages);
router.post("/messages",            authMiddleware, chatController.sendMessage);
router.post("/validate-email",      authMiddleware, chatController.validateEmail);
router.post("/groups",              authMiddleware, chatController.createGroup);
router.get("/groups",               authMiddleware, chatController.getGroups);
router.get("/groups/messages",      authMiddleware, chatController.getGroupMessages);
router.get("/groups/:groupId",      authMiddleware, chatController.getGroup);
router.delete("/groups/:groupId",   authMiddleware, chatController.deleteGroup);
router.post(
  "/upload-media",
  authMiddleware,
  upload.single("file"),
  chatController.uploadMedia
);

module.exports = router;