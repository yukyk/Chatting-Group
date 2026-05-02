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

    // Add smart replies for received messages
    if (!isSent && msg.content && !msg.mediaUrl) {
        fetchSmartReplies(msg.content, div);
    }
}

function fetchSmartReplies(message, messageDiv) {
    fetch('/api/ai/smart-replies', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ message })
    })
    .then(res => res.json())
    .then(data => {
        const replies = data.replies || [];
        if (replies.length > 0) {
            const repliesDiv = document.createElement('div');
            repliesDiv.className = 'smart-replies';
            repliesDiv.style.marginTop = '8px';
            repliesDiv.style.display = 'flex';
            repliesDiv.style.gap = '8px';
            repliesDiv.style.flexWrap = 'wrap';
            replies.forEach(reply => {
                const btn = document.createElement('button');
                btn.className = 'smart-reply-btn';
                btn.textContent = reply;
                btn.style.padding = '6px 12px';
                btn.style.background = 'var(--bg-tertiary)';
                btn.style.color = 'var(--text-primary)';
                btn.style.border = 'none';
                btn.style.borderRadius = '16px';
                btn.style.fontSize = '14px';
                btn.style.cursor = 'pointer';
                btn.style.transition = 'background 0.2s';
                btn.addEventListener('mouseenter', () => btn.style.background = 'var(--accent)');
                btn.addEventListener('mouseleave', () => btn.style.background = 'var(--bg-tertiary)');
                btn.addEventListener('click', () => {
                    messageInput.value = reply;
                    messageInput.focus();
                    hideSuggestions();
                });
                repliesDiv.appendChild(btn);
            });
            messageDiv.appendChild(repliesDiv);
        }
    })
    .catch(err => console.error('Error fetching smart replies:', err));
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
    currentCompletion = '';
    updateCompletionDisplay();
    sendBtn.disabled = false;
});

// ── Predictive Typing ──────────────────────────────────────────────────────────
let typingTimeout;
let currentCompletion = '';
const hiddenSpan = document.createElement('span');
hiddenSpan.style.visibility = 'hidden';
hiddenSpan.style.position = 'absolute';
hiddenSpan.style.fontSize = '14px';
hiddenSpan.style.fontFamily = 'inherit';
document.body.appendChild(hiddenSpan);

messageInput.addEventListener('input', () => {
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(fetchCompletion, 100);
    handleCompletionMatch();
});

messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Tab' && currentCompletion) {
        e.preventDefault();
        messageInput.value += currentCompletion;
        currentCompletion = '';
        updateCompletionDisplay();
        messageInput.focus();
    }
});

function fetchCompletion() {
    const partial = messageInput.value.trim();
    if (!partial) {
        currentCompletion = '';
        updateCompletionDisplay();
        return;
    }

    fetch('/api/ai/predictive-typing', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ partial })
    })
    .then(res => res.json())
    .then(data => {
        currentCompletion = data.completion || '';
        updateCompletionDisplay();
    })
    .catch(err => {
        console.error('Error fetching completion:', err);
        currentCompletion = '';
        updateCompletionDisplay();
    });
}

function updateCompletionDisplay() {
    const completionEl = document.getElementById('completion');
    if (!completionEl) return;
    if (!currentCompletion) {
        completionEl.textContent = '';
        return;
    }
    const computedStyle = window.getComputedStyle(messageInput);
    hiddenSpan.style.font = computedStyle.font;
    hiddenSpan.style.letterSpacing = computedStyle.letterSpacing;
    hiddenSpan.textContent = messageInput.value;
    const textWidth = hiddenSpan.offsetWidth;
    completionEl.style.left = (16 + textWidth) + 'px';
    completionEl.textContent = currentCompletion;
    completionEl.style.display = 'inline';
}

function handleCompletionMatch() {
    if (!currentCompletion) return;
    const inputVal = messageInput.value;
    const lastChar = inputVal.slice(-1);
    if (lastChar && currentCompletion.startsWith(lastChar)) {
        currentCompletion = currentCompletion.slice(1);
        updateCompletionDisplay();
    } else {
        // If doesn't match, refetch
        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(fetchCompletion, 100);
    }
}

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