// controllers/mediaController.js
const { uploadToS3 } = require('../utils/s3Uploader');

/**
 * POST /api/chat/upload-media
 * Expects: multipart/form-data with field "media" and body field "room".
 * Returns: { success, mediaUrl, fileType, fileName }
 */
async function uploadMedia(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }

    const { room } = req.body;
    // room is optional, not required for all cases

    const mediaUrl = await uploadToS3(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype
    );

    // Determine a simple category for the client to render correctly
    let fileType = 'file';
    if (req.file.mimetype.startsWith('image/')) fileType = 'image';
    else if (req.file.mimetype.startsWith('video/')) fileType = 'video';

    return res.status(200).json({
      success: true,
      mediaUrl,
      fileType,
      fileName: req.file.originalname,
      room: room || null,
    });
  } catch (err) {
    console.error('[uploadMedia] Error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = { uploadMedia };