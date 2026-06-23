var _currentChatUserId = null;
var _currentChatUserName = null;

document.addEventListener('DOMContentLoaded', function() {
    initHeader();
    loadContacts();
});

function getAvatarChar(name) {
    return name ? name.charAt(0).toUpperCase() : '?';
}

async function loadContacts() {
    var user = getCurrentUser();
    if (!user) return;
    var userId = user.objectId || user.id;
    var list = document.getElementById('contact-list');
    list.innerHTML = '<div class="chat-empty" style="font-size:13px;padding:40px 0;">加载中…</div>';

    try {
        var received = Bmob.Query('Messages');
        received.equalTo('receiverId', '==', userId);
        var sent = Bmob.Query('Messages');
        sent.equalTo('senderId', '==', userId);

        var recRes = await received.find();
        var sentRes = await sent.find();

        var allMsgs = (recRes || []).concat(sentRes || []);
        var contactMap = {};

        allMsgs.forEach(function(m) {
            var contactId, contactName;
            if (m.senderId === userId) {
                contactId = m.receiverId;
                contactName = m.receiverName || '未知';
            } else {
                contactId = m.senderId;
                contactName = m.senderName || '未知';
            }
            if (!contactMap[contactId]) {
                contactMap[contactId] = { id: contactId, name: contactName, time: m.time || '', preview: m.content || '' };
            }
            var existing = contactMap[contactId];
            if (m.createdAt && (!existing.createdAt || m.createdAt > existing.createdAt)) {
                existing.time = m.time || '';
                existing.preview = m.content || '';
                existing.createdAt = m.createdAt;
            }
        });

        var contacts = Object.values(contactMap);
        contacts.sort(function(a, b) {
            return (b.createdAt || '').localeCompare(a.createdAt || '');
        });

        renderContactList(contacts);
    } catch (e) {
        list.innerHTML = '<div class="chat-empty" style="font-size:13px;padding:40px 0;">加载失败，请刷新</div>';
    }
}

function renderContactList(contacts) {
    var list = document.getElementById('contact-list');
    if (!contacts || contacts.length === 0) {
        list.innerHTML = '<div class="chat-empty" style="font-size:13px;padding:40px 0;">暂无联系人</div>';
        return;
    }
    list.innerHTML = '';
    contacts.forEach(function(c) {
        var div = document.createElement('div');
        div.className = 'contact-item';
        if (c.id === _currentChatUserId) div.classList.add('active');
        div.onclick = function() { selectContact(c.id, c.name); };
        div.innerHTML =
            '<div class="contact-avatar">' + getAvatarChar(c.name) + '</div>' +
            '<div class="contact-info">' +
                '<div class="contact-name">' + c.name + '</div>' +
                '<div class="contact-preview">' + (c.preview || '') + '</div>' +
            '</div>';
        list.appendChild(div);
    });
}

async function selectContact(userId, userName) {
    _currentChatUserId = userId;
    _currentChatUserName = userName;

    document.getElementById('chat-empty').style.display = 'none';
    document.getElementById('chat-header').style.display = 'block';
    document.getElementById('chat-messages').style.display = 'flex';
    document.getElementById('chat-input-area').style.display = 'flex';
    document.getElementById('chat-header').textContent = userName;

    var items = document.querySelectorAll('.contact-item');
    items.forEach(function(item) {
        item.classList.remove('active');
        var nameEl = item.querySelector('.contact-name');
        if (nameEl && nameEl.textContent === userName) item.classList.add('active');
    });

    await loadMessages(userId);
}

async function loadMessages(contactId) {
    var user = getCurrentUser();
    if (!user) return;
    var userId = user.objectId || user.id;
    var container = document.getElementById('chat-messages');
    container.innerHTML = '<div class="chat-empty" style="font-size:13px;padding:20px;">加载中…</div>';

    try {
        var q1 = Bmob.Query('Messages');
        q1.equalTo('senderId', '==', userId);
        q1.equalTo('receiverId', '==', contactId);
        var res1 = await q1.find();

        var q2 = Bmob.Query('Messages');
        q2.equalTo('senderId', '==', contactId);
        q2.equalTo('receiverId', '==', userId);
        var res2 = await q2.find();

        var allMsgs = (res1 || []).concat(res2 || []);
        allMsgs.sort(function(a, b) {
            return (a.createdAt || '').localeCompare(b.createdAt || '');
        });

        renderMessages(allMsgs);
        scrollToBottom();

        var unreadMsgs = allMsgs.filter(function(m) {
            return m.senderId === contactId && !m.isRead;
        });
        unreadMsgs.forEach(function(m) {
            markAsRead(m.objectId);
        });
    } catch (e) {
        container.innerHTML = '<div class="chat-empty" style="font-size:13px;padding:20px;">加载失败</div>';
    }
}

function renderMessages(messages) {
    var container = document.getElementById('chat-messages');
    var user = getCurrentUser();
    var userId = user.objectId || user.id;
    container.innerHTML = '';

    if (!messages || messages.length === 0) {
        container.innerHTML = '<div class="chat-empty" style="font-size:13px;padding:40px;">暂无消息，发送第一条吧</div>';
        return;
    }

    messages.forEach(function(m) {
        var isSelf = m.senderId === userId;
        var row = document.createElement('div');
        row.className = 'msg-row ' + (isSelf ? 'self' : 'other');
        var name = isSelf ? user.username : (m.senderName || '未知');
        var avatarChar = getAvatarChar(name);

        var contentHtml = m.content || '';
        contentHtml = contentHtml
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/```([\s\S]*?)```/g, '<pre>$1</pre>')
            .replace(/\n/g, '<br>');

        row.innerHTML =
            '<div class="msg-avatar">' + avatarChar + '</div>' +
            '<div class="msg-bubble">' +
                contentHtml +
                '<div class="msg-time">' + (m.time || '') + '</div>' +
            '</div>';
        container.appendChild(row);
    });
}

function scrollToBottom() {
    var container = document.getElementById('chat-messages');
    setTimeout(function() { container.scrollTop = container.scrollHeight; }, 100);
}

async function sendMessage() {
    var input = document.getElementById('chat-input');
    var content = input.value.trim();
    if (!content) return;
    if (!_currentChatUserId) { showToast('请先选择联系人', 'warning'); return; }

    var user = getCurrentUser();
    var now = new Date().toLocaleString();

    input.value = '';
    input.disabled = true;

    try {
        var query = Bmob.Query('Messages');
        query.set('senderId', user.objectId || user.id);
        query.set('senderName', user.username);
        query.set('receiverId', _currentChatUserId);
        query.set('receiverName', _currentChatUserName);
        query.set('content', content);
        query.set('time', now);
        query.set('isRead', false);
        await query.save();

        await loadMessages(_currentChatUserId);
        loadContacts();
    } catch (e) {
        showToast('发送失败', 'error');
    }
    input.disabled = false;
    input.focus();
}

async function markAsRead(msgId) {
    try {
        var query = Bmob.Query('Messages');
        query.set('objectId', msgId);
        query.set('isRead', true);
        await query.save();
        updateUnreadBadge();
    } catch (e) {}
}

function openSearchModal() {
    var overlay = document.createElement('div');
    overlay.className = 'search-modal-overlay';
    overlay.id = 'search-modal-overlay';
    overlay.innerHTML =
        '<div class="search-modal">' +
            '<div class="search-modal-header">' +
                '<span>🔍 查找用户</span>' +
                '<span class="search-modal-close" onclick="closeSearchModal()">&times;</span>' +
            '</div>' +
            '<div class="search-modal-body">' +
                '<input type="text" id="search-user-input" placeholder="输入用户名搜索…" oninput="searchUsers()" autofocus>' +
                '<div id="search-result-list"></div>' +
            '</div>' +
        '</div>';
    overlay.onclick = function(e) {
        if (e.target === overlay) closeSearchModal();
    };
    document.body.appendChild(overlay);
    setTimeout(function() {
        document.getElementById('search-user-input').focus();
    }, 100);
}

function closeSearchModal() {
    var overlay = document.getElementById('search-modal-overlay');
    if (overlay) overlay.remove();
}

async function searchUsers() {
    var keyword = document.getElementById('search-user-input').value.trim();
    var list = document.getElementById('search-result-list');
    if (!keyword) { list.innerHTML = ''; return; }

    var user = getCurrentUser();
    var userId = user.objectId || user.id;
    list.innerHTML = '<div style="padding:8px;color:#909399;font-size:13px;">搜索中…</div>';

    try {
        var query = Bmob.Query('Users');
        var res = await query.find();
        var filtered = (res || []).filter(function(u) {
            return u.objectId !== userId && u.username && u.username.indexOf(keyword) !== -1;
        });

        if (filtered.length === 0) {
            list.innerHTML = '<div style="padding:8px;color:#909399;font-size:13px;">未找到用户</div>';
            return;
        }

        list.innerHTML = '';
        filtered.forEach(function(u) {
            var div = document.createElement('div');
            div.className = 'search-user-item';
            div.innerHTML =
                '<div class="search-avatar">' + getAvatarChar(u.username) + '</div>' +
                '<div style="font-weight:600;color:#1a237e;">' + u.username + '</div>';
            div.onclick = function() {
                closeSearchModal();
                selectContact(u.objectId, u.username);
            };
            list.appendChild(div);
        });
    } catch (e) {
        list.innerHTML = '<div style="padding:8px;color:#ef4444;font-size:13px;">搜索失败</div>';
    }
}