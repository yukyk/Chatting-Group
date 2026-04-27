const express = require('express');
const router = express.Router();

const upload = require('../middleware/upload');
const { uploadMedia } = require('../controllers/mediacontroller');
const { authMiddleware } = require('../controllers/AuthController');

router.post(
  '/upload-media',
  authMiddleware,
  upload.single('file'),
  uploadMedia
);

module.exports = router;