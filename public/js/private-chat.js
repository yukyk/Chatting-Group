const storedUser = localStorage.getItem('user');
if (!storedUser) {
    window.location.href = '/login';
}
const user = JSON.parse(storedUser);
const token = localStorage.getItem('token');
const currentUserId = user ? parseInt(user.id) : null;

if (!currentUserId || !token) {
    alert('User not found, please login again');
    window.location.href = '/login';
}

const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('roomId');
if (!roomId) {
    alert('No room ID provided');
    window.location.href = '/chat';
}

let activeContact = null;

const socket = io({
    auth: {
        token: token
    }
});

socket.on('connect', () => {
    socket.emit('join');
});

socket.on('authError', (err) => {
    console.error('Authentication error:', err.message);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    window.location.href = '/login';
});

socket.on('joined', () => {
    socket.emit('join_room', { roomId });
    loadMessages();
});

socket.on('newMessage', (msg) => {
    const msgSenderId = parseInt(msg.senderId);
    const isSentByMe = msgSenderId === currentUserId;
    renderMessage(msg);
    scrollToBottom();
});

document.getElementById('backBtn').addEventListener('click', () => {
    window.location.href = '/chat';
});

const messagesContainer = document.getElementById("messagesContainer");
const messageForm = document.getElementById("messageForm");
const messageInput = document.getElementById("messageInput");

function formatTime(date) {
    return new Date(date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function renderMessage(msg) {
    const emptyState = document.getElementById('emptyState');
    if (emptyState) emptyState.style.display = 'none';
    
    const isSent = parseInt(msg.senderId) === currentUserId;
    const div = document.createElement("div");
    div.className = `message ${isSent ? "sent" : "received"}`;

    let contentHtml = '';
    if (msg.mediaUrl) {
        if (msg.mediaType === 'image') {
            contentHtml = `<img src="${escapeHtml(msg.mediaUrl)}" alt="Image" class="media-image" onclick="window.open('${escapeHtml(msg.mediaUrl)}')">`;
        } else if (msg.mediaType === 'video') {
            contentHtml = `<video controls class="media-video"><source src="${escapeHtml(msg.mediaUrl)}" type="video/mp4"></video>`;
        } else if (msg.mediaType === 'file') {
            contentHtml = `<a href="${escapeHtml(msg.mediaUrl)}" target="_blank" class="media-file">📄 Download File</a>`;
        }
    }
    if (msg.content) {
        contentHtml += `<div class="message-content">${escapeHtml(msg.content)}</div>`;
    }

    div.innerHTML = `
        ${contentHtml}
        <div class="message-meta">${formatTime(msg.createdAt)}</div>
    `;
    messagesContainer.appendChild(div);
}

function escapeHtml(text) {
    return String(text)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

messageForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const content = messageInput.value.trim();
    if (!content) return;

    const sendBtn = messageForm.querySelector("button[type='submit']");
    sendBtn.disabled = true;

    socket.emit('sendMessage', {
        receiverId: activeContact ? activeContact.id : 0, // dummy
        content: content,
        roomId: roomId
    });

    messageInput.value = "";
    sendBtn.disabled = false;
});

// ── Media upload ──────────────────────────────────────────────────────────────
document.getElementById('uploadBtn').addEventListener('click', () => {
    document.getElementById('fileInput').click();
});

document.getElementById('fileInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
        alert('File too large. Max 10MB.');
        return;
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'video/mp4', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
        alert('Invalid file type. Only images, videos, and PDFs allowed.');
        return;
    }

    try {
        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch('/api/chat/upload-media', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });

        const data = await res.json();
        if (data.success) {
            sendMediaMessage(data.mediaUrl, data.fileType);
        } else {
            alert('Upload failed: ' + (data.message || 'Unknown error'));
        }
    } catch (err) {
        console.error('Upload error:', err);
        alert('Upload failed');
    }

    // Reset input
    e.target.value = '';
});

function sendMediaMessage(mediaUrl, mediaType) {
    socket.emit('sendMessage', {
        receiverId: activeContact ? activeContact.id : 0, // dummy
        content: '',
        mediaUrl,
        mediaType,
        roomId: roomId
    });
}

async function loadMessages() {
    try {
        // Since it's private, perhaps load all messages for the room, but since messages are per user, need to adjust
        // For simplicity, load messages between the two users
        const contactEmail = roomId.split('_').find(email => email !== user.email);
        if (contactEmail) {
            const res = await fetch(`/api/chat/contacts`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await res.json();
            if (data.success) {
                const contact = data.contacts.find(c => c.email === contactEmail);
                if (contact) {
                    activeContact = contact;
                    const msgRes = await fetch(`/api/chat/messages?contactId=${contact.id}`, {
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    });
                    const msgData = await msgRes.json();
                    if (msgData.success && msgData.messages.length > 0) {
                        msgData.messages.forEach(renderMessage);
                        scrollToBottom();
                    } else {
                        messagesContainer.innerHTML = "<div class='empty-state'>No messages yet. Say hi!</div>";
                    }
                }
            }
        }
    } catch (err) {
        console.error("Load messages error:", err);
        messagesContainer.innerHTML = "<div class='empty-state'>Failed to load messages</div>";
    }
}