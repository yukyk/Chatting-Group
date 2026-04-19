const storedUser = localStorage.getItem('user');
if (!storedUser) {
    window.location.href = '/login';
}
const user = JSON.parse(storedUser);
const currentUserId = user ? parseInt(user.id) : null;

if (!currentUserId) {
    alert('User not found, please login again');
    window.location.href = '/login';
}
console.log('User data:', user, 'ID:', currentUserId);
let activeContact = null;
let contacts = [];

const socket = io();

socket.on('connect', () => {
    console.log('Socket connected, emitting join for user:', currentUserId);
    socket.emit('join', currentUserId);
});

socket.on('connect_error', (err) => {
    console.error('Socket connection error:', err);
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
    if (contacts.length === 0) {
        contactList.innerHTML = '<div class="contact"><div class="contact-info"><div class="contact-name">No contacts yet</div><div class="contact-preview">Create another user to chat</div></div></div>';
        return;
    }
    contactList.innerHTML = contacts.map(c => `
        <div class="contact" data-id="${c.id}">
            <div class="contact-avatar">${c.name.charAt(0)}</div>
            <div class="contact-info">
                <div class="contact-name">${c.name}</div>
                <div class="contact-preview">${c.lastMessage}</div>
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
    if (!content || !activeContact) return;

    const sendBtn = messageForm.querySelector("button");
    sendBtn.disabled = true;

    socket.emit('sendMessage', {
        senderId: currentUserId,
        receiverId: activeContact.id,
        content: content
    });

    messageInput.value = "";
    sendBtn.disabled = false;
});

async function loadContacts() {
    try {
        const res = await fetch(`/api/chat/contacts?userId=${currentUserId}`);
        const data = await res.json();
        if (data.success) {
            contacts = data.contacts;
            renderContacts();
        }
    } catch (err) {
        console.error("Failed to load contacts:", err);
    }
}

loadContacts();
