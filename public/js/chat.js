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
let activeContact = null;
let contacts = [];
let currentRoom = null;

function generateRoomId(email1, email2) {
    const sorted = [email1, email2].sort();
    return sorted.join('_');
}

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

// Listen for join confirmation
socket.on('joined', () => {
    loadContacts();
});

socket.on('newMessage', (msg) => {
    const msgSenderId = parseInt(msg.senderId);
    const msgReceiverId = parseInt(msg.receiverId);
    const isSentByMe = msgSenderId === currentUserId;
    const isSentToMe = msgReceiverId === currentUserId;
    
    if (isSentByMe || isSentToMe) {
        if (activeContact && (msgSenderId === activeContact.id || msgReceiverId === activeContact.id)) {
            renderMessage(msg);
            scrollToBottom();
        } else if (!activeContact) {
            renderMessage(msg);
            scrollToBottom();
        }
    }
    loadContacts();
});

// Listen for user online/offline events
socket.on('userOnline', (data) => {
    loadContacts();
});

socket.on('userOffline', (data) => {
    loadContacts();
});

socket.on('private_room_invitation', (data) => {
    const { roomId, inviterId, inviterName } = data;
    const notifications = document.getElementById('notifications');
    notifications.style.display = 'block';
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.innerHTML = `
        <div class="notification-text">Private room invitation from ${inviterName}</div>
        <div class="notification-buttons">
            <button class="accept">Yes</button>
            <button class="decline">No</button>
        </div>
    `;
    notifications.appendChild(notification);
    
    notification.querySelector('.accept').addEventListener('click', () => {
        socket.emit('accept_private_room', { roomId, inviterId });
        notifications.removeChild(notification);
        if (notifications.children.length === 0) {
            notifications.style.display = 'none';
        }
    });
    
    notification.querySelector('.decline').addEventListener('click', () => {
        notifications.removeChild(notification);
        if (notifications.children.length === 0) {
            notifications.style.display = 'none';
        }
    });
});

socket.on('private_room_joined', (data) => {
    const { roomId } = data;
    // Find the contact based on the roomId
    const contactEmail = roomId.split('_').find(email => email !== user.email);
    const contact = contacts.find(c => c.email === contactEmail);
    if (contact) {
        // Leave current room
        if (currentRoom) {
            socket.emit('leave_room', { roomId: currentRoom });
        }
        // Join new room
        currentRoom = roomId;
        activeContact = contact;
        document.querySelectorAll(".contact").forEach(el => el.classList.remove("active"));
        chatHeader.innerHTML = `<span>${contact.name} (Private)</span>`;
        emptyState.style.display = "none";
        loadMessages();
    }
});

socket.on('redirect_to_private', (data) => {
    const { roomId } = data;
    window.location.href = `/private-chat?roomId=${roomId}`;
});

socket.on('invitation_failed', (data) => {
    alert(`Invitation failed: ${data.message}`);
});

socket.on('invitation_sent_offline', (data) => {
    alert(data.message);
});

document.getElementById('profileAvatar').textContent = user?.name?.charAt(0).toUpperCase() || '?';
document.getElementById('profileName').textContent = user?.name || 'Unknown';
document.getElementById('profileEmail').textContent = user?.email || '';

document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    window.location.href = '/login';
});

document.getElementById('startChatBtn').addEventListener('click', async () => {
    const email = document.getElementById('newChatEmail').value.trim();
    if (!email) {
        alert('Please enter an email');
        return;
    }
    try {
        const res = await fetch('/api/chat/validate-email', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ email })
        });
        const data = await res.json();
        if (data.success) {
            const contact = data.user;
            const roomId = generateRoomId(user.email, contact.email);
            socket.emit('join_room', { roomId });
            currentRoom = roomId;
            activeContact = contact;
            document.querySelectorAll(".contact").forEach(el => el.classList.remove("active"));
            chatHeader.innerHTML = `<span>${contact.name}</span>`;
            emptyState.style.display = "none";
            await loadMessages();
            document.getElementById('newChatEmail').value = '';
        } else {
            alert('User not found');
        }
    } catch (err) {
        console.error('Error validating email:', err);
        alert('Error validating email');
    }
});

const contactList = document.getElementById("contactList");
const chatHeader = document.getElementById("chatHeader");
const messagesContainer = document.getElementById("messagesContainer");
const emptyState = document.getElementById("emptyState");
const messageForm = document.getElementById("messageForm");
const messageInput = document.getElementById("messageInput");

function formatTime(date) {
    return new Date(date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function renderContacts() {
    if (!contactList) {
        console.error('Contact list element not found');
        return;
    }
    if (contacts.length === 0) {
        contactList.innerHTML = '<div class="contact"><div class="contact-info"><div class="contact-name">No users found</div><div class="contact-preview">No other users registered</div></div></div>';
        return;
    }
    contactList.innerHTML = contacts.map(c => `
        <div class="contact" data-id="${c.id}">
            <div class="contact-avatar">
                ${c.name.charAt(0)}
                ${c.online ? '<span class="online-indicator" style="position: absolute; bottom: 2px; right: 2px; width: 12px; height: 12px; background: var(--accent); border-radius: 50%; border: 2px solid var(--bg-secondary);"></span>' : ''}
            </div>
            <div class="contact-info">
                <div class="contact-name">
                    ${c.name}
                    ${c.online ? '<span style="color: var(--accent); font-size: 11px; margin-left: 4px;">● online</span>' : '<span style="color: var(--text-secondary); font-size: 11px; margin-left: 4px;">○ offline</span>'}
                </div>
                <div class="contact-preview">${c.lastMessage || 'No messages yet'}</div>
            </div>
            <button class="invite-btn" data-id="${c.id}" title="Invite to Private Room">🔒</button>
        </div>
    `).join("");
    document.querySelectorAll(".contact").forEach(el => {
        el.addEventListener("click", () => selectContact(parseInt(el.dataset.id)));
    });
    document.querySelectorAll(".invite-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const contactId = parseInt(btn.dataset.id);
            const contact = contacts.find(c => c.id === contactId);
            if (contact) {
                const roomId = generateRoomId(user.email, contact.email);
                socket.emit('invite_to_private_room', { contactId, roomId });
                alert(`Invitation sent to ${contact.name} for private room.`);
            }
        });
    });
}

async function selectContact(contactId) {
    activeContact = contacts.find(c => c.id === contactId);
    document.querySelectorAll(".contact").forEach(el => el.classList.remove("active"));
    document.querySelector(`.contact[data-id="${contactId}"]`).classList.add("active");
    chatHeader.innerHTML = `<span>${activeContact.name}</span>`;
    emptyState.style.display = "none";
    
    // Leave previous room
    if (currentRoom) {
        socket.emit('leave_room', { roomId: currentRoom });
    }
    
    // Join new room
    const roomId = generateRoomId(user.email, activeContact.email);
    socket.emit('join_room', { roomId });
    currentRoom = roomId;
    
    await loadMessages();
}

async function loadMessages() {
    if (!activeContact) return;
    
    messagesContainer.innerHTML = "";
    try {
        const res = await fetch(`/api/chat/messages?contactId=${activeContact.id}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const data = await res.json();
        
        if (data.success && data.messages.length > 0) {
            data.messages.forEach(renderMessage);
            scrollToBottom();
        } else if (data.messages && data.messages.length === 0) {
            messagesContainer.innerHTML = "<div class='empty-state'>No messages yet. Say hi!</div>";
        }
    } catch (err) {
        console.error("Load messages error:", err);
        messagesContainer.innerHTML = "<div class='empty-state'>Failed to load messages</div>";
    }
}

function renderMessage(msg) {
    if (!activeContact) return;
    
    const emptyState = document.getElementById('emptyState');
    if (emptyState) emptyState.style.display = 'none';
    
    const isSent = parseInt(msg.senderId) === currentUserId;
    const div = document.createElement("div");
    div.className = `message ${isSent ? "sent" : "received"}`;
    div.innerHTML = `
        <div class="message-content">${msg.content}</div>
        <div class="message-meta">${formatTime(msg.createdAt)}</div>
    `;
    messagesContainer.appendChild(div);
}

function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

messageForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const content = messageInput.value.trim();
    if (!content) return;

    const sendBtn = messageForm.querySelector("button");
    sendBtn.disabled = true;

    if (activeContact) {
        socket.emit('sendMessage', {
            receiverId: activeContact.id,
            content: content,
            roomId: currentRoom
        });
    }

    messageInput.value = "";
    sendBtn.disabled = false;
});

async function loadContacts() {
    try {
        const res = await fetch('/api/chat/contacts', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const data = await res.json();
        if (data.success) {
            contacts = data.contacts;
            renderContacts();
        } else {
            console.error('Failed to load contacts:', data);
        }
    } catch (err) {
        console.error("Failed to load contacts:", err);
    }
}
