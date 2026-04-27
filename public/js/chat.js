const storedUser = localStorage.getItem('user');
if (!storedUser) { window.location.href = '/login'; }
const user = JSON.parse(storedUser);
const token = localStorage.getItem('token');
const currentUserId = user ? parseInt(user.id) : null;

if (!currentUserId || !token) {
    alert('User not found, please login again');
    window.location.href = '/login';
}

let activeContact = null;
let activeGroup   = null;
let contacts      = [];
let groups        = [];
let currentRoom   = null;

// unread counts: key = "contact_<id>" or "group_<id>", value = count
const unread = {};

function generateRoomId(id1, id2) {
    return [parseInt(id1), parseInt(id2)].sort((a, b) => a - b).join('_');
}

// ── Socket ────────────────────────────────────────────────────────────────────
const socket = io({ auth: { token } });

socket.on('connect', () => { socket.emit('join'); });

socket.on('connect_error', (err) => {
    console.error('Socket connection error:', err.message);
});

socket.on('authError', (err) => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    window.location.href = '/login';
});

socket.on('joined', () => {
    loadContacts();
    loadGroups();
});

// ── Incoming messages ─────────────────────────────────────────────────────────
socket.on('newMessage', (msg) => {
    const msgSenderId = parseInt(msg.senderId);
    const fromMe      = msgSenderId === currentUserId;

    if (msg.isGroup) {
        const gid = parseInt(msg.groupId);
        if (activeGroup && gid === activeGroup.id) {
            renderMessage(msg);
            scrollToBottom();
        } else if (!fromMe) {
            // badge the group in the sidebar
            const key = `group_${gid}`;
            unread[key] = (unread[key] || 0) + 1;
            updateBadge('group', gid);
        }
    } else {
        const otherId = fromMe ? parseInt(msg.receiverId) : msgSenderId;
        if (activeContact && otherId === activeContact.id) {
            renderMessage(msg);
            scrollToBottom();
        } else if (!fromMe) {
            const key = `contact_${msgSenderId}`;
            unread[key] = (unread[key] || 0) + 1;
            updateBadge('contact', msgSenderId);
        }
        // Always refresh preview text for DMs
        updateLastMessagePreview(otherId, msg.content);
    }
});

// Update the last-message preview text in the sidebar without a full reload
function updateLastMessagePreview(contactId, content, mediaType) {
    const el = contactList.querySelector(`.contact[data-id="${contactId}"][data-type="contact"] .contact-preview`);
    if (!el) return;
    if (content) {
        el.textContent = content;
    } else if (mediaType) {
        el.textContent = mediaType === 'image' ? '📷 Photo' : mediaType === 'video' ? '🎥 Video' : '📎 File';
    } else {
        el.textContent = '';
    }
}

// Place or update the unread badge dot on a sidebar item
function updateBadge(type, id) {
    const key   = `${type}_${id}`;
    const count = unread[key] || 0;
    const el    = contactList.querySelector(`.contact[data-id="${id}"][data-type="${type}"]`);
    if (!el) return;

    let badge = el.querySelector('.unread-badge');
    if (count === 0) {
        if (badge) badge.remove();
        return;
    }
    if (!badge) {
        badge = document.createElement('span');
        badge.className = 'unread-badge';
        el.appendChild(badge);
    }
    badge.textContent = count > 99 ? '99+' : count;
}

function clearBadge(type, id) {
    const key = `${type}_${id}`;
    unread[key] = 0;
    updateBadge(type, id);
}

socket.on('userOnline',  () => loadContacts());
socket.on('userOffline', () => loadContacts());

// ── Private room invitations ──────────────────────────────────────────────────
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
        </div>`;
    notifications.appendChild(notification);

    notification.querySelector('.accept').addEventListener('click', () => {
        socket.emit('accept_private_room', { roomId, inviterId });
        notifications.removeChild(notification);
        if (notifications.children.length === 0) notifications.style.display = 'none';
    });
    notification.querySelector('.decline').addEventListener('click', () => {
        notifications.removeChild(notification);
        if (notifications.children.length === 0) notifications.style.display = 'none';
    });
});

socket.on('redirect_to_private',     ({ roomId }) => { window.location.href = `/private-chat?roomId=${roomId}`; });
socket.on('invitation_failed',       (d) => alert(`Invitation failed: ${d.message}`));
socket.on('invitation_sent_offline', (d) => alert(d.message));

// Socket: group was deleted by creator — remove it from everyone's sidebar
socket.on('groupDeleted', ({ groupId }) => {
    groups = groups.filter(g => g.id !== groupId);
    if (activeGroup && activeGroup.id === groupId) {
        activeGroup = null;
        currentRoom = null;
        messagesContainer.innerHTML = '';
        chatHeader.innerHTML = '<span>Select a chat</span>';
        emptyState.style.display = 'flex';
    }
    renderContacts();
});

// ── Profile bar ───────────────────────────────────────────────────────────────
document.getElementById('profileAvatar').textContent = user?.name?.charAt(0).toUpperCase() || '?';
document.getElementById('profileName').textContent   = user?.name  || 'Unknown';
document.getElementById('profileEmail').textContent  = user?.email || '';

document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    window.location.href = '/login';
});

// ── Group create modal ────────────────────────────────────────────────────────
document.getElementById('createGroupBtn').addEventListener('click', openGroupModal);

function openGroupModal() {
    const contactSelection = document.getElementById('contactSelection');
    const groupNameInput   = document.getElementById('groupNameInput');

    contactSelection.innerHTML = contacts.length === 0
        ? '<p style="color:var(--text-secondary);font-size:13px;">No other users found.</p>'
        : contacts.map(c => `
            <label class="contact-checkbox">
                <input type="checkbox" value="${c.id}">
                <span>${c.name} <span style="color:var(--text-secondary);font-size:12px;">(${c.email})</span></span>
            </label>`).join('');

    groupNameInput.value = '';
    document.getElementById('groupModal').style.display = 'block';
}

document.querySelector('#groupModal .close').addEventListener('click', () => {
    document.getElementById('groupModal').style.display = 'none';
});
document.getElementById('groupModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('groupModal'))
        document.getElementById('groupModal').style.display = 'none';
});

document.getElementById('createGroupBtnModal').addEventListener('click', async () => {
    const selected = Array.from(document.querySelectorAll('#contactSelection input:checked'))
                         .map(cb => parseInt(cb.value));
    const name = document.getElementById('groupNameInput').value.trim();
    if (selected.length === 0) { alert('Select at least one contact'); return; }
    if (!name)                  { alert('Enter a group name'); return; }
    await createGroup(name, selected);
    document.getElementById('groupModal').style.display = 'none';
});

async function createGroup(name, memberIds) {
    try {
        const res  = await fetch('/api/chat/groups', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ name, memberIds })
        });
        const data = await res.json();
        if (data.success) {
            await loadGroups();
            alert('Group created successfully!');
        } else {
            alert('Failed to create group: ' + (data.message || 'Unknown error'));
        }
    } catch (err) {
        console.error('Create group error:', err);
        alert('Error creating group');
    }
}

// ── Delete group ──────────────────────────────────────────────────────────────
async function deleteGroup(groupId) {
    if (!confirm('Delete this group and all its messages? This cannot be undone.')) return;
    try {
        const res  = await fetch(`/api/chat/groups/${groupId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
            // Notify all members via socket
            socket.emit('group_deleted', { groupId });
            groups = groups.filter(g => g.id !== groupId);
            if (activeGroup && activeGroup.id === groupId) {
                activeGroup = null;
                currentRoom = null;
                messagesContainer.innerHTML = '';
                chatHeader.innerHTML = '<span>Select a chat</span>';
                emptyState.style.display = 'flex';
            }
            renderContacts();
        } else {
            alert(data.message || 'Failed to delete group');
        }
    } catch (err) {
        console.error('Delete group error:', err);
        alert('Error deleting group');
    }
}

// ── DOM refs ──────────────────────────────────────────────────────────────────
const contactList       = document.getElementById('contactList');
const chatHeader        = document.getElementById('chatHeader');
const messagesContainer = document.getElementById('messagesContainer');
const emptyState        = document.getElementById('emptyState');
const messageForm       = document.getElementById('messageForm');
const messageInput      = document.getElementById('messageInput');

function formatTime(date) {
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ── Sidebar rendering ─────────────────────────────────────────────────────────
function renderContacts() {
    if (!contactList) return;

    if (contacts.length === 0 && groups.length === 0) {
        contactList.innerHTML = `
            <div class="contact">
                <div class="contact-info">
                    <div class="contact-name">No users found</div>
                    <div class="contact-preview">Be the first to sign up!</div>
                </div>
            </div>`;
        return;
    }

    let html = '';

    // All users
    if (contacts.length > 0) {
        html += contacts.map(c => `
            <div class="contact" data-id="${c.id}" data-type="contact">
                <div class="contact-avatar">
                    ${c.name.charAt(0).toUpperCase()}
                    ${c.online ? '<span class="online-indicator"></span>' : ''}
                </div>
                <div class="contact-info">
                    <div class="contact-name">
                        ${c.name}
                        <span class="online-label ${c.online ? 'is-online' : ''}">
                            ${c.online ? '● online' : '○ offline'}
                        </span>
                    </div>
                    <div class="contact-preview">${c.lastMessage || 'No messages yet'}</div>
                </div>
                <button class="invite-btn" data-id="${c.id}" title="Invite to Private Room">🔒</button>
            </div>`).join('');
    }

    // Groups section
    if (groups.length > 0) {
        html += `<div class="section-label">Groups</div>`;
        html += groups.map(g => {
            const isCreator = g.creatorId === currentUserId;
            return `
            <div class="contact" data-id="${g.id}" data-type="group">
                <div class="contact-avatar group-avatar">G</div>
                <div class="contact-info">
                    <div class="contact-name">
                        ${g.name}
                        ${isCreator ? '<span class="creator-badge">creator</span>' : ''}
                    </div>
                    <div class="contact-preview">Group chat</div>
                </div>
                ${isCreator ? `<button class="delete-group-btn" data-id="${g.id}" title="Delete group">🗑</button>` : ''}
            </div>`;
        }).join('');
    }

    contactList.innerHTML = html;

    // Re-apply existing badges (survive re-renders)
    Object.entries(unread).forEach(([key, count]) => {
        if (count > 0) {
            const [type, id] = key.split('_');
            updateBadge(type, parseInt(id));
        }
    });

    // Contact click
    contactList.querySelectorAll('.contact').forEach(el => {
        el.addEventListener('click', () => {
            const type = el.dataset.type;
            const id   = parseInt(el.dataset.id);
            if (type === 'group') selectGroup(id);
            else selectContact(id);
        });
    });

    // Invite button
    contactList.querySelectorAll('.invite-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const contactId = parseInt(btn.dataset.id);
            const contact   = contacts.find(c => c.id === contactId);
            if (contact) {
                const roomId = generateRoomId(currentUserId, contact.id);
                socket.emit('invite_to_private_room', { contactId, roomId });
                alert(`Invitation sent to ${contact.name} for private room.`);
            }
        });
    });

    // Delete group button (only rendered for creator)
    contactList.querySelectorAll('.delete-group-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteGroup(parseInt(btn.dataset.id));
        });
    });
}

// ── Select group ──────────────────────────────────────────────────────────────
async function selectGroup(groupId) {
    activeGroup   = groups.find(g => g.id === groupId);
    activeContact = null;
    clearBadge('group', groupId);

    contactList.querySelectorAll('.contact').forEach(el => el.classList.remove('active'));
    const el = contactList.querySelector(`.contact[data-id="${groupId}"][data-type="group"]`);
    if (el) el.classList.add('active');

    chatHeader.innerHTML = `<span>${activeGroup.name} <span class="header-sub">loading members…</span></span>`;
    emptyState.style.display = 'none';

    try {
        const res  = await fetch(`/api/chat/groups/${groupId}`, { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        if (data.success) {
            const members = data.group.members.map(m => m.name).join(', ');
            chatHeader.innerHTML = `<span>${activeGroup.name} <span class="header-sub">${members}</span></span>`;
        } else {
            chatHeader.innerHTML = `<span>${activeGroup.name}</span>`;
        }
    } catch {
        chatHeader.innerHTML = `<span>${activeGroup.name}</span>`;
    }

    if (currentRoom) socket.emit('leave_room', { roomId: currentRoom });
    socket.emit('join_group', { groupId });
    currentRoom = `group_${groupId}`;

    await loadGroupMessages();
}

async function loadGroupMessages() {
    if (!activeGroup) return;
    messagesContainer.innerHTML = '';

    try {
        const res  = await fetch(`/api/chat/groups/messages?groupId=${activeGroup.id}`, { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        if (data.success && data.messages.length > 0) {
            data.messages.forEach(renderMessage);
            scrollToBottom();
        } else {
            messagesContainer.innerHTML = "<div class='empty-state'>No messages yet. Say hi!</div>";
        }
    } catch (err) {
        messagesContainer.innerHTML = "<div class='empty-state'>Failed to load messages</div>";
    }
}

// ── Select contact (DM) ───────────────────────────────────────────────────────
async function selectContact(contactId) {
    activeContact = contacts.find(c => c.id === contactId);
    activeGroup   = null;
    clearBadge('contact', contactId);

    contactList.querySelectorAll('.contact').forEach(el => el.classList.remove('active'));
    const el = contactList.querySelector(`.contact[data-id="${contactId}"][data-type="contact"]`);
    if (el) el.classList.add('active');

    chatHeader.innerHTML = `<span>${activeContact.name}</span>`;
    emptyState.style.display = 'none';

    if (currentRoom) socket.emit('leave_room', { roomId: currentRoom });
    const roomId = generateRoomId(currentUserId, activeContact.id);
    socket.emit('join_room', { roomId });
    currentRoom = roomId;

    await loadMessages();
}

async function loadMessages() {
    if (!activeContact) return;
    messagesContainer.innerHTML = '';

    try {
        const res  = await fetch(`/api/chat/messages?contactId=${activeContact.id}`, { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        if (data.success && data.messages.length > 0) {
            data.messages.forEach(renderMessage);
            scrollToBottom();
        } else {
            messagesContainer.innerHTML = "<div class='empty-state'>No messages yet. Say hi!</div>";
        }
    } catch (err) {
        messagesContainer.innerHTML = "<div class='empty-state'>Failed to load messages</div>";
    }
}

// ── Render message bubble ─────────────────────────────────────────────────────
function renderMessage(msg) {
    if (!activeContact && !activeGroup) return;

    const isSent = parseInt(msg.senderId) === currentUserId;
    const div    = document.createElement('div');
    div.className = `message ${isSent ? 'sent' : 'received'}`;

    const senderLabel = msg.isGroup && !isSent
        ? `<div class="msg-sender">${escapeHtml(msg.senderName || 'Unknown')}</div>`
        : '';

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
        ${senderLabel}
        ${contentHtml}
        <div class="message-meta">${formatTime(msg.createdAt)}</div>`;
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

// ── Send message ──────────────────────────────────────────────────────────────
messageForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const content = messageInput.value.trim();
    if (!content) return;

    const sendBtn = messageForm.querySelector('button');
    sendBtn.disabled = true;

    if (activeContact) {
        socket.emit('sendMessage', { receiverId: activeContact.id, content, roomId: currentRoom });
    } else if (activeGroup) {
        socket.emit('sendGroupMessage', { groupId: activeGroup.id, content });
    }

    messageInput.value = '';
    sendBtn.disabled   = false;
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
        formData.append('room', currentRoom);

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
    if (activeContact) {
        socket.emit('sendMessage', {
            receiverId: activeContact.id,
            content: '',
            mediaUrl,
            mediaType,
            roomId: currentRoom
        });
    } else if (activeGroup) {
        socket.emit('sendGroupMessage', {
            groupId: activeGroup.id,
            content: '',
            mediaUrl,
            mediaType
        });
    }
}

// ── Data loading ──────────────────────────────────────────────────────────────
async function loadGroups() {
    try {
        const res  = await fetch('/api/chat/groups', { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        if (data.success) { groups = data.groups; renderContacts(); }
    } catch (err) { console.error('Failed to load groups:', err); }
}

async function loadContacts() {
    try {
        const res  = await fetch('/api/chat/contacts', { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        if (data.success) { contacts = data.contacts; renderContacts(); }
    } catch (err) { console.error('Failed to load contacts:', err); }
}