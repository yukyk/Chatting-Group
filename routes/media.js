// routes/media.js
const express = require('express');
const router = express.Router();
const upload = require('../middlewares/upload');
const { uploadMedia } = require('../controllers/mediaController');

// ── JWT auth middleware (reuse your existing one) ──────────────────────────────
// If you already have an authMiddleware file, import it instead.
const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'No token provided.' });
  }
  const token = authHeader.split(' ')[1];
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }
}
// ──────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/media/upload
 * Field name: "media"  (matches the frontend FormData key)
 */
router.post('/upload', authMiddleware, upload.single('media'), uploadMedia);

module.exports = router;