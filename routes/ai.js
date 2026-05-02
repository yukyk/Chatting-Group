const express = require("express");
const router = express.Router();
const aiController = require("../controllers/AIController");
const { authMiddleware } = require("../controllers/AuthController");

router.post("/predictive-typing", authMiddleware, aiController.predictiveTyping);
router.post("/smart-replies", authMiddleware, aiController.smartReplies);

module.exports = router;