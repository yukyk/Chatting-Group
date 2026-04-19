const user = JSON.parse(localStorage.getItem('user') || 'null');
if (!user) {
    window.location.href = '/login';
}
const currentUserId = user?.id;
let activeContact = null;
let contacts = [
    { id: 2, name: "Alice Johnson", lastMessage: "See you later!" },
    { id: 3, name: "Bob Smith", lastMessage: "How are you?" },
    { id: 4, name: "Charlie Brown", lastMessage: "Thanks!" }
];

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
    messagesContainer.innerHTML = "";
    const res = await fetch(`/api/messages?userId=${currentUserId}&contactId=${activeContact.id}`);
    const { messages } = await res.json();
    if (messages.length === 0) {
        messagesContainer.innerHTML = "<div class='empty-state'>No messages yet. Say hi!</div>";
    } else {
        messages.forEach(renderMessage);
        scrollToBottom();
    }
}

function renderMessage(msg) {
    const isSent = msg.senderId === currentUserId;
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

messageForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const content = messageInput.value.trim();
    if (!content || !activeContact) return;

    const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senderId: currentUserId, receiverId: activeContact.id, content })
    });
    const { message } = await res.json();
    renderMessage(message);
    activeContact.lastMessage = content;
    messageInput.value = "";
    scrollToBottom();
});

renderContacts();
