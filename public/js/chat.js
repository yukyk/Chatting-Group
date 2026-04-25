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

// Listen for join confirmation
socket.on('joined', () => {
    console.log('Successfully joined, loading contacts');
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
    console.log('User came online:', data.userId);
    loadContacts();
});

socket.on('userOffline', (data) => {
    console.log('User went offline:', data.userId);
    loadContacts();
});

document.getElementById('profileAvatar').textContent = user?.name?.charAt(0).toUpperCase() || '?';
document.getElementById('profileName').textContent = user?.name || 'Unknown';
document.getElementById('profileEmail').textContent = user?.email || '';

document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    window.location.href = '/login';
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
        </div>
    `).join("");
    document.querySelectorAll(".contact").forEach(el => {
        el.addEventListener("click", () => selectContact(parseInt(el.dataset.id)));
    });
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
            content: content
        });
    }

    messageInput.value = "";
    sendBtn.disabled = false;
});

async function loadContacts() {
    try {
        console.log('Loading contacts for user:', currentUserId);
        const res = await fetch('/api/chat/contacts', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
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
