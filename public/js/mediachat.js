// ─────────────────────────────────────────────────────────────────
// ADD TO: public/js/chat.js
// This snippet wires up the file-picker button and handles
// upload + Socket.IO broadcast in one flow.
// ─────────────────────────────────────────────────────────────────

// ── 1. Add a hidden file-input + attach-button to your HTML ──────
// In views/chat.html, inside the message-input bar, add:
//
//   <input type="file" id="mediaInput" accept="image/*,video/*,.pdf,.zip,.txt" hidden />
//   <button id="attachBtn" title="Share media">📎</button>
//
// ─────────────────────────────────────────────────────────────────

// ── 2. Paste this block into public/js/chat.js ───────────────────

(function initMediaSharing() {
  const attachBtn  = document.getElementById('attachBtn');
  const mediaInput = document.getElementById('mediaInput');

  if (!attachBtn || !mediaInput) return; // guard if elements not yet in HTML

  // Open file picker when the attach button is clicked
  attachBtn.addEventListener('click', () => mediaInput.click());

  mediaInput.addEventListener('change', async () => {
    const file = mediaInput.files[0];
    if (!file) return;

    // Reset so the same file can be re-selected later
    mediaInput.value = '';

    const token = localStorage.getItem('token');
    const user  = JSON.parse(localStorage.getItem('user') || '{}');
    const room  = getCurrentRoom(); // ← replace with however you track the active room

    if (!token || !user.id) {
      alert('You must be logged in to share files.');
      return;
    }

    // --- Upload to backend ---
    const formData = new FormData();
    formData.append('media', file);
    formData.append('room', room);

    try {
      showUploadIndicator(true);

      const res = await fetch('/api/media/upload', {
        method : 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body   : formData,
      });

      const data = await res.json();

      if (!data.success) throw new Error(data.message);

      // --- Broadcast via Socket.IO ---
      socket.emit('send_media', {
        room    : data.room,
        mediaUrl: data.mediaUrl,
        fileType: data.fileType,
        fileName: data.fileName,
        sender  : { id: user.id, name: user.name },
      });

    } catch (err) {
      console.error('[Media Upload]', err);
      alert('Upload failed: ' + err.message);
    } finally {
      showUploadIndicator(false);
    }
  });

  // --- Receive media from others (or self-echo) ---
  socket.on('receive_media', (msg) => {
    appendMediaMessage(msg);
  });

  // ── Helpers ───────────────────────────────────────────────────

  function showUploadIndicator(show) {
    if (attachBtn) attachBtn.disabled = show;
    // You can also show a spinner / progress bar here
  }

  /**
   * Renders a received media message into the chat window.
   * Adjust selectors to match your existing chat HTML structure.
   */
  function appendMediaMessage(msg) {
    const chatBox = document.getElementById('chat-messages'); // adjust selector
    if (!chatBox) return;

    const wrapper = document.createElement('div');
    wrapper.classList.add('message', 'media-message');

    let mediaHtml = '';

    if (msg.fileType === 'image') {
      mediaHtml = `<img src="${escHtml(msg.mediaUrl)}" alt="${escHtml(msg.fileName)}"
                        style="max-width:260px; border-radius:8px; display:block;" />`;

    } else if (msg.fileType === 'video') {
      mediaHtml = `<video src="${escHtml(msg.mediaUrl)}" controls
                          style="max-width:260px; border-radius:8px; display:block;"></video>`;

    } else {
      mediaHtml = `<a href="${escHtml(msg.mediaUrl)}" target="_blank" rel="noopener noreferrer"
                      download="${escHtml(msg.fileName)}">
                     📄 ${escHtml(msg.fileName)}
                   </a>`;
    }

    wrapper.innerHTML = `
      <span class="sender-name">${escHtml(msg.sender.name)}</span>
      ${mediaHtml}
      <span class="timestamp">${new Date(msg.timestamp).toLocaleTimeString()}</span>
    `;

    chatBox.appendChild(wrapper);
    chatBox.scrollTop = chatBox.scrollHeight;
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * Replace this with however your app tracks the current room.
   * e.g. a global variable, a data attribute on the chat container, etc.
   */
  function getCurrentRoom() {
    return window.currentRoom || 'general';
  }
})();