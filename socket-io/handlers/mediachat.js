const { registerMediaHandlers } = require('./handlers/mediachat'); // add at top

// socket-io/handlers/mediaChat.js
//
// ADD this handler inside your existing socket-io/handlers/chat.js (or import it there).
// It listens for the "send_media" event that the frontend emits after a successful upload.

/**
 * Registers the "send_media" socket event handler.
 *
 * @param {import('socket.io').Socket} socket
 * @param {import('socket.io').Server} io
 */
function registerMediaHandlers(socket, io) {
  /**
   * Client emits:
   * {
   *   room      : string,        // chat room name / ID
   *   mediaUrl  : string,        // S3 URL returned by the upload endpoint
   *   fileType  : 'image'|'video'|'file',
   *   fileName  : string,        // original file name
   *   sender    : { id, name }   // user info stored in localStorage
   * }
   */
  socket.on('send_media', (data) => {
    const { room, mediaUrl, fileType, fileName, sender } = data;

    if (!room || !mediaUrl || !sender) {
      console.warn('[send_media] Missing required fields');
      return;
    }

    const message = {
      type: 'media',
      fileType,         // 'image' | 'video' | 'file'
      mediaUrl,
      fileName,
      sender,
      timestamp: new Date().toISOString(),
    };

    // Broadcast to everyone in the room (including sender for confirmation)
    io.to(room).emit('receive_media', message);

    console.log(`[send_media] ${sender.name} shared ${fileType} in room "${room}"`);
  });
}

module.exports = { registerMediaHandlers };