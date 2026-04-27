// utils/s3Uploader.js
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

/**
 * Uploads a file buffer to S3 and returns the public URL.
 * @param {Buffer} fileBuffer - The file contents.
 * @param {string} originalName - Original filename (used for extension).
 * @param {string} mimeType - MIME type of the file.
 * @returns {Promise<string>} - The public S3 URL.
 */
async function uploadToS3(fileBuffer, originalName, mimeType) {
  const ext = path.extname(originalName);
  const key = `chat-media/${uuidv4()}${ext}`;

  const command = new PutObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET_NAME,
    Key: key,
    Body: fileBuffer,
    ContentType: mimeType,
    // Remove ACL: 'public-read' if your bucket blocks public ACLs;
    // use a bucket policy instead (see AWS_SETUP.md).
  });

  await s3.send(command);

  const url = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
  return url;
}

module.exports = { uploadToS3 };