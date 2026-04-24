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
console.log('User data:', user, 'ID:', currentUserId);
let activeContact = null;
let contacts = [];
let activePersonalChat = null;
let pendingPersonalRequests = [];

const socket = io({
    auth: {
        token: token
    }
});

socket.on('connect', () => {
    console.log('Socket connected, emitting join for user:', currentUserId);
    socket.emit('join');
});

socket.on('authError', (err) => {
    console.error('Authentication error:', err.message);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    window.location.href = '/login';
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

// Personal chat request received
socket.on('personalChatRequest', (data) => {
    console.log('Personal chat request received:', data);
    pendingPersonalRequests.push({
        requesterId: data.requesterId,
        requesterName: data.requesterName,
        timestamp: data.timestamp
    });
    updatePersonalRequestsBadge();
    
    // Also show a notification if we're already on the requests page
    if (document.getElementById('personalRequestsSection').style.display !== 'none') {
        renderPersonalRequests();
    }
});

// Personal chat request sent successfully
socket.on('personalChatRequestSent', (data) => {
    console.log('Personal chat request sent to user ' + data.targetUserId);
    alert('Personal chat request sent!');
});

// Personal chat request error
socket.on('personalChatRequestError', (data) => {
    console.error('Personal chat request error:', data.message);
    alert('Error: ' + data.message);
});

// Personal chat accepted - both parties receive this
socket.on('personalChatAccepted', (data) => {
    console.log('Personal chat accepted, room info:', data);
    
    // Remove from pending requests if it was ours
    pendingPersonalRequests = pendingPersonalRequests.filter(req => req.requesterId !== data.participants[0] && req.requesterId !== data.participants[1]);
    updatePersonalRequestsBadge();
    
    // Set active personal chat
    activePersonalChat = {
        roomId: data.roomId,
        participants: data.participants
    };
    
    // Update UI to show we're in a personal chat
    const otherUserId = data.participants.find(id => id !== currentUserId);
    const otherUser = contacts.find(c => c.id === otherUserId);
    if (otherUser) {
        chatHeader.innerHTML = `<span>🔒 Personal Chat with ${otherUser.name}</span>`;
    } else {
        chatHeader.innerHTML = `<span>🔒 Personal Chat (Room: ${data.roomId})</span>`;
    }
    
    emptyState.style.display = 'none';
    alert('Personal chat started! You can now chat privately.');
});

// Personal chat rejected
socket.on('personalChatRejected', (data) => {
    console.log('Personal chat rejected by user ' + data.targetUserId);
    pendingPersonalRequests = pendingPersonalRequests.filter(req => req.requesterId !== data.targetUserId);
    updatePersonalRequestsBadge();
    
    // Get the user name from contacts
    const rejectedUser = contacts.find(c => c.id === data.targetUserId);
    alert('Your personal chat request was rejected by ' + (rejectedUser ? rejectedUser.name : 'the user'));
});

socket.on('personalChatRejectedAck', (data) => {
    console.log('Personal chat rejection acknowledged for requester ' + data.requesterId);
});

// Personal message received
socket.on('personalMessage', (msg) => {
    console.log('Personal message received:', msg);
    
    if (activePersonalChat && activePersonalChat.roomId === msg.roomId) {
        renderMessage(msg);
        scrollToBottom();
    }
    
    loadContacts();
});

socket.on('personalMessageError', (data) => {
    console.error('Personal message error:', data.message);
    alert('Error sending message: ' + data.message);
});

// Personal chat history loaded
socket.on('personalChatHistory', (data) => {
    console.log('Personal chat history loaded:', data.messages.length, 'messages');
    messagesContainer.innerHTML = '';
    data.messages.forEach(renderMessage);
    scrollToBottom();
});

// Left personal room
socket.on('leftPersonalRoom', (data) => {
    console.log('Left personal room:', data.roomId);
    if (activePersonalChat && activePersonalChat.roomId === data.roomId) {
        activePersonalChat = null;
    }
});

socket.on('personalChatError', (data) => {
    console.error('Personal chat error:', data.message);
    alert('Error: ' + data.message);
});

document.getElementById('profileAvatar').textContent = user?.name?.charAt(0).toUpperCase() || '?';
document.getElementById('profileName').textContent = user?.name || 'Unknown';
document.getElementById('profileEmail').textContent = user?.email || '';

document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    window.location.href = '/login';
});

// Toggle personal requests view
document.getElementById('personalRequestsBtn').addEventListener('click', () => {
    const requestsSection = document.getElementById('personalRequestsSection');
    const contactList = document.getElementById('contactList');
    
    if (requestsSection.style.display === 'none') {
        // Show personal requests
        requestsSection.style.display = 'block';
        contactList.style.display = 'none';
        renderPersonalRequests();
    } else {
        // Show contacts
        requestsSection.style.display = 'none';
        contactList.style.display = 'block';
    }
});

// Back to contacts from personal requests
document.getElementById('backToContactsBtn').addEventListener('click', () => {
    document.getElementById('personalRequestsSection').style.display = 'none';
    document.getElementById('contactList').style.display = 'block';
});

// Request personal chat on form submit
messageForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const content = messageInput.value.trim();
    if (!content) return;
    
    const sendBtn = messageForm.querySelector('button');
    sendBtn.disabled = true;
    
    if (activePersonalChat) {
        // Send personal message
        socket.emit('personal_message', {
            roomId: activePersonalChat.roomId,
            receiverId: activePersonalChat.participants.find(id => id !== currentUserId),
            content: content
        });
    } else if (activeContact) {
        // Send regular message
        socket.emit('sendMessage', {
            receiverId: activeContact.id,
            content: content
        });
    }
    
    messageInput.value = '';
    sendBtn.disabled = false;
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
    console.log('Rendering contacts to DOM:', contacts.length);
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
            <button class="personal-chat-btn" data-id="${c.id}" title="Request Personal Chat" style="padding: 6px 10px; border: none; border-radius: 6px; background: var(--accent); color: white; cursor: pointer; font-size: 11px; white-space: nowrap;">Request Private Chat</button>
        </div>
    `).join("");
    document.querySelectorAll(".contact").forEach(el => {
        el.addEventListener("click", () => selectContact(parseInt(el.dataset.id)));
    });
    document.querySelectorAll(".personal-chat-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            requestPersonalChat(parseInt(btn.dataset.id));
        });
    });
}

function requestPersonalChat(targetUserId) {
    socket.emit('request_personal_chat', { targetUserId });
}

function acceptPersonalChat(requesterId) {
    socket.emit('accept_personal_chat', { requesterId });
}

function rejectPersonalChat(requesterId) {
    socket.emit('reject_personal_chat', { requesterId });
}

function renderPersonalRequests() {
    const list = document.getElementById('personalRequestsList');
    if (pendingPersonalRequests.length === 0) {
        list.innerHTML = '<div class="contact"><div class="contact-info"><div class="contact-name">No pending requests</div><div class="contact-preview">No one has requested a private chat</div></div></div>';
        return;
    }
    list.innerHTML = pendingPersonalRequests.map(req => {
        const requester = contacts.find(c => c.id === req.requesterId);
        const isOnline = requester ? requester.online : false;
        return `
        <div class="contact">
            <div class="contact-avatar">
                ${req.requesterName ? req.requesterName.charAt(0) : '?'}
                ${isOnline ? '<span class="online-indicator" style="position: absolute; bottom: 2px; right: 2px; width: 12px; height: 12px; background: var(--accent); border-radius: 50%; border: 2px solid var(--bg-secondary);"></span>' : ''}
            </div>
            <div class="contact-info">
                <div class="contact-name">
                    ${req.requesterName || 'Unknown'}
                    ${isOnline ? '<span style="color: var(--accent); font-size: 11px; margin-left: 4px;">● online</span>' : '<span style="color: var(--text-secondary); font-size: 11px; margin-left: 4px;">○ offline</span>'}
                </div>
                <div class="contact-preview">Requests private chat</div>
            </div>
            <div style="display: flex; gap: 8px;">
                <button onclick="acceptPersonalChat(${req.requesterId})" style="padding: 6px 12px; border: none; border-radius: 6px; background: var(--accent); color: white; cursor: pointer; font-size: 12px;">Accept</button>
                <button onclick="rejectPersonalChat(${req.requesterId})" style="padding: 6px 12px; border: none; border-radius: 6px; background: #e74c3c; color: white; cursor: pointer; font-size: 12px;">Reject</button>
            </div>
        </div>
    `}).join("");
}

function updatePersonalRequestsBadge() {
    const badge = document.getElementById('personalRequestsBadge');
    if (badge) {
        const count = pendingPersonalRequests.length;
        badge.textContent = count;
        badge.style.display = count > 0 ? 'block' : 'none';
    }
}

async function selectContact(contactId) {
    activeContact = contacts.find(c => c.id === contactId);
    document.querySelectorAll(".contact").forEach(el => el.classList.remove("active"));
    document.querySelector(`.contact[data-id="${contactId}"]`).classList.add("active");
    chatHeader.innerHTML = `<span>${activeContact.name}</span>`;
    emptyState.style.display = "none";
    await loadMessages();
}

async function loadMessages() {
    if (!activeContact) return;
    
    messagesContainer.innerHTML = "";
    try {
        const res = await fetch(`/api/chat/messages?userId=${currentUserId}&contactId=${activeContact.id}`);
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
    if (!activeContact && !activePersonalChat) return;
    
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

    if (activePersonalChat) {
        // Send personal message
        socket.emit('personal_message', {
            roomId: activePersonalChat.roomId,
            receiverId: activePersonalChat.participants.find(id => id !== currentUserId),
            content: content
        });
    } else if (activeContact) {
        // Send regular message
        socket.emit('sendMessage', {
            receiverId: activeContact.id,
            content: content
        });
    }

    messageInput.value = "";
    sendBtn.disabled = false;
});

async function loadContacts() {
    try {
        console.log('Loading contacts for user:', currentUserId);
        const res = await fetch(`/api/chat/contacts?userId=${currentUserId}`);
        const data = await res.json();
        console.log('Contacts loaded:', data);
        if (data.success) {
            contacts = data.contacts;
            console.log('Rendering', contacts.length, 'contacts');
            renderContacts();
        } else {
            console.error('Failed to load contacts:', data);
        }
    } catch (err) {
        console.error("Failed to load contacts:", err);
    }
}

loadContacts();
