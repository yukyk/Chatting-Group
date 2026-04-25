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
let activeGroup = null;
let contacts = [];
let groups = [];
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
    loadGroups();
});

socket.on('newMessage', (msg) => {
    const msgSenderId = parseInt(msg.senderId);
    const isSentByMe = msgSenderId === currentUserId;
    const isGroup = msg.isGroup;
    const isForMe = isGroup ? activeGroup && parseInt(msg.receiverId) === activeGroup.id : (activeContact && (msgSenderId === activeContact.id || parseInt(msg.receiverId) === activeContact.id));
    
    if (isForMe) {
        renderMessage(msg);
        scrollToBottom();
    }
    if (!isGroup) {
        loadContacts();
    }
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

document.getElementById('createGroupBtn').addEventListener('click', () => {
    openGroupModal();
});

function openGroupModal() {
    const modal = document.getElementById('groupModal');
    const contactSelection = document.getElementById('contactSelection');
    const groupNameInput = document.getElementById('groupNameInput');
    contactSelection.innerHTML = contacts.map(c => `
        <label class="contact-checkbox">
            <input type="checkbox" value="${c.id}">
            <span>${c.name}</span>
        </label>
    `).join("");
    groupNameInput.value = '';
    modal.style.display = 'block';
}

document.querySelector('.close').addEventListener('click', () => {
    document.getElementById('groupModal').style.display = 'none';
});

document.getElementById('createGroupBtnModal').addEventListener('click', () => {
    const selected = Array.from(document.querySelectorAll('#contactSelection input:checked')).map(cb => parseInt(cb.value));
    const name = document.getElementById('groupNameInput').value.trim();
    if (selected.length === 0) {
        alert('Select at least one contact');
        return;
    }
    if (!name) {
        alert('Enter a group name');
        return;
    }
    createGroup(name, selected);
    document.getElementById('groupModal').style.display = 'none';
});

async function createGroup(name, memberIds) {
    try {
        const res = await fetch('/api/chat/groups', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ name, memberIds })
        });
        const data = await res.json();
        if (data.success) {
            loadGroups();
            alert('Group created successfully!');
        } else {
            alert('Failed to create group: ' + (data.message || 'Unknown error'));
        }
    } catch (err) {
        console.error('Create group error:', err);
        alert('Error creating group');
    }
}

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
    console.log('Rendering contacts:', contacts.length, 'groups:', groups.length);
    if (!contactList) {
        console.error('Contact list element not found');
        return;
    }
    let html = '';
    if (contacts.length === 0 && groups.length === 0) {
        contactList.innerHTML = '<div class="contact"><div class="contact-info"><div class="contact-name">No chats found</div><div class="contact-preview">No other users or groups</div></div></div>';
        return;
    }
    // Render individual contacts
    html += contacts.map(c => `
        <div class="contact" data-id="${c.id}" data-type="contact">
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
    // Render groups
    html += groups.map(g => `
        <div class="contact" data-id="${g.id}" data-type="group">
            <div class="contact-avatar">G</div>
            <div class="contact-info">
                <div class="contact-name">${g.name}</div>
                <div class="contact-preview">Group chat</div>
            </div>
        </div>
    `).join("");
    console.log('HTML length:', html.length);
    contactList.innerHTML = html;
    console.log('InnerHTML set');
    document.querySelectorAll(".contact").forEach(el => {
        el.addEventListener("click", () => {
            const type = el.dataset.type;
            const id = parseInt(el.dataset.id);
            if (type === 'group') {
                selectGroup(id);
            } else {
                selectContact(id);
            }
        });
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

async function selectGroup(groupId) {
    activeGroup = groups.find(g => g.id === groupId);
    activeContact = null;
    document.querySelectorAll(".contact").forEach(el => el.classList.remove("active"));
    document.querySelector(`.contact[data-id="${groupId}"][data-type="group"]`).classList.add("active");
    // Fetch group details including members
    try {
        const res = await fetch(`/api/chat/groups/${groupId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const data = await res.json();
        if (data.success) {
            const members = data.group.members.map(m => m.name).join(', ');
            chatHeader.innerHTML = `<span>${activeGroup.name} (${members})</span>`;
        } else {
            chatHeader.innerHTML = `<span>${activeGroup.name}</span>`;
        }
    } catch (err) {
        chatHeader.innerHTML = `<span>${activeGroup.name}</span>`;
    }
    emptyState.style.display = "none";
    
    // Leave previous room
    if (currentRoom) {
        socket.emit('leave_room', { roomId: currentRoom });
    }
    
    // Join group room
    socket.emit('join_group', { groupId });
    currentRoom = `group_${groupId}`;
    
    await loadGroupMessages();
}

async function loadGroupMessages() {
    if (!activeGroup) return;
    
    messagesContainer.innerHTML = "";
    try {
        const res = await fetch(`/api/chat/groups/messages?groupId=${activeGroup.id}`, {
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
        console.error("Load group messages error:", err);
        messagesContainer.innerHTML = "<div class='empty-state'>Failed to load messages</div>";
    }
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
    if (!activeContact && !activeGroup) return;
    
    const emptyState = document.getElementById('emptyState');
    if (emptyState) emptyState.style.display = 'none';
    
    const isSent = parseInt(msg.senderId) === currentUserId;
    const div = document.createElement("div");
    div.className = `message ${isSent ? "sent" : "received"}`;
    const senderName = msg.isGroup && !isSent ? `${msg.senderName}: ` : '';
    div.innerHTML = `
        <div class="message-content">${senderName}${msg.content}</div>
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
    } else if (activeGroup) {
        socket.emit('sendGroupMessage', {
            groupId: activeGroup.id,
            content: content
        });
    }

    messageInput.value = "";
    sendBtn.disabled = false;
});

async function loadGroups() {
    try {
        const res = await fetch('/api/chat/groups', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const data = await res.json();
        console.log('Load groups response:', data);
        if (data.success) {
            groups = data.groups;
            console.log('Groups loaded:', groups.length);
            renderContacts();
        } else {
            console.error('Failed to load groups:', data);
        }
    } catch (err) {
        console.error("Failed to load groups:", err);
    }
}

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
