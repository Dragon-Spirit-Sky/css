// 显示提示消息
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(function() {
        toast.classList.add('removing');
        setTimeout(function() { toast.remove(); }, 300);
    }, 2800);
}

// 页面加载器
function showPageLoader(text) {
    var loader = document.getElementById('page-loader');
    if (!loader) {
        loader = document.createElement('div');
        loader.id = 'page-loader';
        loader.className = 'page-loader';
        loader.innerHTML = '<div class="loader-spinner"></div><div class="loader-text">' + (text || '加载中...') + '</div>';
        document.body.appendChild(loader);
    } else {
        loader.querySelector('.loader-text').textContent = text || '加载中...';
        loader.classList.remove('hidden');
    }
}
function hidePageLoader() {
    var loader = document.getElementById('page-loader');
    if (loader) {
        loader.classList.add('hidden');
        setTimeout(function() { if (loader.parentNode) loader.remove(); }, 400);
    }
}

// 生成6位随机邀请码
function generateInviteCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// 检查邀请码是否有效（5分钟过期）
function isInviteCodeValid(project) {
    if (!project.inviteCode || !project.inviteExpireTime) {
        return false;
    }
    const now = Date.now();
    const expireTime = new Date(project.inviteExpireTime).getTime();
    return now < expireTime;
}

// 检查登录状态 (门禁函数)
function checkLogin() {
    const currentUser = getCurrentUser();
    if (!currentUser) {
        // 如果没登录，踢回登录页
        window.location.href = 'login_lh.html';
        return null;
    }
    return currentUser;
}

// 获取当前登录用户 (必须从 sessionStorage 读)
function getCurrentUser() {
    const userStr = sessionStorage.getItem('currentUser_lh');
    if (userStr) {
        return JSON.parse(userStr);
    }
    return null;
}

// 退出登录 (清理 sessionStorage)
function logout() {
    sessionStorage.removeItem('currentUser_lh');
    localStorage.removeItem('rememberedUser_lh');
    window.location.href = 'login_lh.html';
}

// 初始化头部导航（登录后才显示）
// 初始化头部导航（登录后才显示）- 增加空值检查版
function initHeader() {
    const currentUser = getCurrentUser();
    const header = document.getElementById('header');
    const userInfoDiv = document.getElementById('user-info');
    
    // 关键：如果页面没有header元素，直接返回不执行
    if (!header) {
        return;
    }
    
    if (!currentUser) {
        header.style.display = 'none';
        return;
    }
    
    header.style.display = 'flex';

    if (userInfoDiv) {
        userInfoDiv.innerHTML = `
            <span class="user-badge">欢迎你，${currentUser.username}</span>
            <span class="nav-divider"></span>
            <a href="user_detail_lh.html" class="layui-btn layui-btn-sm">个人中心</a>
            <button class="layui-btn layui-btn-sm layui-btn-danger" onclick="logout()">退出</button>
        `;
        if (!document.getElementById('msg-icon')) {
            var msgIcon = document.createElement('span');
            msgIcon.id = 'msg-icon';
            msgIcon.className = 'msg-icon-wrap';
            msgIcon.title = '站内信';
            msgIcon.innerHTML = '🔔<span class="msg-badge" id="msg-badge">0</span>';
            msgIcon.onclick = toggleMessageCenter;
            userInfoDiv.insertBefore(msgIcon, userInfoDiv.firstChild);
        }
    }
    updateUnreadBadge();

    if (!document.getElementById('chat-overlay')) {
        var overlay = document.createElement('div');
        overlay.id = 'chat-overlay';
        overlay.className = 'chat-overlay';
        overlay.innerHTML =
            '<div class="chat-card">' +
                '<div class="chat-card-header">' +
                    '<span>📬 站内信</span>' +
                    '<span class="chat-card-close" onclick="closeChatModal()">&times;</span>' +
                '</div>' +
                '<div class="chat-container">' +
                    '<div class="chat-sidebar">' +
                        '<div class="sidebar-header">' +
                            '<button class="new-chat-btn" onclick="openSearchModal()">+ 创建</button>' +
                        '</div>' +
                        '<div class="contact-list" id="contact-list">' +
                            '<div class="chat-empty" style="font-size:13px;padding:40px 0;">暂无联系人</div>' +
                        '</div>' +
                    '</div>' +
                    '<div class="chat-main" id="chat-main">' +
                        '<div class="chat-empty" id="chat-empty">👈 选择一个联系人开始聊天</div>' +
                        '<div class="chat-header" id="chat-header" style="display:none;"></div>' +
                        '<div class="chat-messages" id="chat-messages" style="display:none;"></div>' +
                        '<div class="chat-input-area" id="chat-input-area" style="display:none;">' +
                            '<input type="text" class="chat-input" id="chat-input" placeholder="输入消息…" maxlength="500" onkeydown="if(event.key===\'Enter\')sendChatMsg()">' +
                            '<button class="chat-send-btn" onclick="sendChatMsg()">➤</button>' +
                        '</div>' +
                    '</div>' +
                '</div>' +
            '</div>';
        overlay.onclick = function(e) { if (e.target === overlay) closeChatModal(); };
        document.body.appendChild(overlay);
    }
}

// 初始化本地存储数据（Bmob云端，无需初始化）
function initLocalStorage() {
    // 数据已迁移至Bmob云端，无需localStorage初始化
}

// 获取用户参与的所有班级（从Bmob云端）
async function getUserProjects(userId) {
    try {
        const query = Bmob.Query('Projects');
        const res = await query.find();
        return res.filter(p => p.members && p.members.some(m => m.userId == userId));
    } catch (e) {
        console.error('获取班级列表失败:', e);
        return [];
    }
}

async function getUserRoleInProject(projectId, userId) {
    try {
        const query = Bmob.Query('Projects');
        const res = await query.get(projectId);
        if (!res || !res.members) return null;
        const member = res.members.find(m => m.userId == userId);
        return member ? member.role : null;
    } catch (e) {
        console.error('获取角色失败:', e);
        return null;
    }
}

// ========== Bmob 云端CRUD辅助函数 ==========

// 保存项目到云端（新建）
async function saveProjectToCloud(project) {
    const query = Bmob.Query('Projects');
    query.set('name', project.name);
    query.set('description', project.description || '');
    query.set('creatorId', project.creatorId);
    query.set('createTime', project.createTime);
    query.set('updateTime', project.updateTime);
    query.set('members', project.members);
    query.set('groups', project.groups || []);
    query.set('inviteCode', project.inviteCode || '');
    query.set('inviteExpireTime', project.inviteExpireTime || '');
    query.set('displayGroupId', project.displayGroupId || '');
    query.set('showFinished', project.showFinished || false);
    query.set('logs', project.logs || []);
    const res = await query.save();
    return res.objectId;
}

// 更新项目到云端
async function updateProjectToCloud(objectId, projectData) {
    const query = Bmob.Query('Projects');
    query.set('id', objectId);
    for (var key in projectData) {
        if (projectData.hasOwnProperty(key)) {
            query.set(key, projectData[key]);
        }
    }
    await query.save();
}

// 从云端获取所有项目
async function fetchAllProjects() {
    try {
        const query = Bmob.Query('Projects');
        return await query.find();
    } catch (e) {
        console.error('获取项目列表失败:', e);
        return [];
    }
}

// 从云端获取单个项目
async function fetchProjectById(objectId) {
    try {
        const query = Bmob.Query('Projects');
        return await query.get(objectId);
    } catch (e) {
        console.error('获取项目失败:', e);
        return null;
    }
}

// 删除云端项目
async function deleteProjectFromCloud(objectId) {
    const query = Bmob.Query('Projects');
    await query.destroy(objectId);
}

// 页面加载时初始化 (修复：使用 DOMContentLoaded 避免冲突)
document.addEventListener('DOMContentLoaded', function() {
    initLocalStorage();
    // 登录页和注册页不需要检查登录
    if (!window.location.pathname.includes('login_lh.html') && 
        !window.location.pathname.includes('register_lh.html') &&
        !window.location.pathname.includes('forgot_password_lh.html') &&
        !window.location.pathname.includes('terms_lh.html')) {
        checkLogin();
    }
    initHeader();
});

// ========== 数据变更通知（Bmob云端，无需跨标签页同步） ==========

// ========== 背景视差效果 ==========
(function() {
    var targetX = 0, targetY = 0, currentX = 0, currentY = 0;
    var isActive = false;

    document.addEventListener('mousemove', function(e) {
        targetX = (e.clientX / window.innerWidth - 0.5) * 12;
        targetY = (e.clientY / window.innerHeight - 0.5) * 12;
        if (!isActive) {
            isActive = true;
            requestAnimationFrame(animate);
        }
    });

    function animate() {
        currentX += (targetX - currentX) * 0.06;
        currentY += (targetY - currentY) * 0.06;
        document.body.style.backgroundPosition = 'calc(50% + ' + currentX + 'px) calc(50% + ' + currentY + 'px)';
        if (Math.abs(targetX - currentX) > 0.01 || Math.abs(targetY - currentY) > 0.01) {
            requestAnimationFrame(animate);
        } else {
            isActive = false;
        }
    }
})();

// ========== 站内信系统 ==========

async function updateUnreadBadge() {
    var badge = document.getElementById('msg-badge');
    if (!badge) return;
    var user = getCurrentUser();
    if (!user) { badge.style.display = 'none'; return; }
    try {
        var query = Bmob.Query('Messages');
        query.equalTo('receiverId', '==', user.objectId || user.id);
        query.equalTo('isRead', '==', false);
        var res = await query.find();
        var count = res ? res.length : 0;
        if (count > 0) { badge.textContent = ''; badge.style.display = 'block'; }
        else { badge.style.display = 'none'; }
    } catch (e) {}
}

function toggleMessageCenter() {
    var overlay = document.getElementById('chat-overlay');
    if (!overlay) return;
    overlay.style.display = 'flex';
    var badge = document.getElementById('msg-badge');
    if (badge) badge.style.display = 'none';
    initChat();
}

var _currentChatUserId = null;
var _currentChatUserName = null;
var _chatInited = false;

function closeChatModal() {
    var overlay = document.getElementById('chat-overlay');
    if (overlay) overlay.style.display = 'none';
}

function initChat() {
    if (_chatInited) { loadContacts(); return; }
    _chatInited = true;
    loadContacts();
}

var _avatarPresets = [
    { emoji: '😀', color: '#667eea' },
    { emoji: '🦊', color: '#ff9800' },
    { emoji: '🐱', color: '#4caf50' },
    { emoji: '🐶', color: '#2196f3' },
    { emoji: '🐼', color: '#9c27b0' },
    { emoji: '🦁', color: '#f44336' },
    { emoji: '🐰', color: '#e91e63' },
    { emoji: '🐮', color: '#00bcd4' },
    { emoji: '🐸', color: '#8bc34a' },
    { emoji: '🐵', color: '#795548' },
    { emoji: '🐯', color: '#ff5722' },
    { emoji: '🐨', color: '#607d8b' }
];

function getAvatarHtml(name) {
    if (!name) return '<span>?</span>';
    var hash = 0;
    for (var i = 0; i < name.length; i++) { hash = ((hash << 5) - hash) + name.charCodeAt(i); hash |= 0; }
    var idx = Math.abs(hash) % _avatarPresets.length;
    var avatar = _avatarPresets[idx];
    return '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:inherit;">' + avatar.emoji + '</div>';
}

function getAvatarBg(name) {
    if (!name) return 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    var hash = 0;
    for (var i = 0; i < name.length; i++) { hash = ((hash << 5) - hash) + name.charCodeAt(i); hash |= 0; }
    var idx = Math.abs(hash) % _avatarPresets.length;
    var avatar = _avatarPresets[idx];
    return 'linear-gradient(135deg, ' + avatar.color + ' 0%, ' + avatar.color + 'cc 100%)';
}

async function loadContacts() {
    var user = getCurrentUser();
    if (!user) return;
    var userId = user.objectId || user.id;
    var list = document.getElementById('contact-list');
    if (!list) return;
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
        contacts.sort(function(a, b) { return (b.createdAt || '').localeCompare(a.createdAt || ''); });
        renderContactList(contacts);
    } catch (e) {
        list.innerHTML = '<div class="chat-empty" style="font-size:13px;padding:40px 0;">加载失败</div>';
    }
}

function renderContactList(contacts) {
    var list = document.getElementById('contact-list');
    if (!list) return;
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
            '<div class="contact-avatar" style="background:' + getAvatarBg(c.name) + ';">' + getAvatarHtml(c.name) + '</div>' +
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
    var isSystem = (userId === 'system');
    document.getElementById('chat-input-area').style.display = isSystem ? 'none' : 'flex';
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
        allMsgs.sort(function(a, b) { return (a.createdAt || '').localeCompare(b.createdAt || ''); });
        renderMessages(allMsgs);
        scrollToBottom();
        allMsgs.filter(function(m) { return m.senderId === contactId && !m.isRead; }).forEach(function(m) { markAsRead(m.objectId); });
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
        var contentHtml = (m.content || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/```([\s\S]*?)```/g, '<pre>$1</pre>').replace(/\n/g, '<br>');
        row.innerHTML =
            '<div class="msg-avatar" style="background:' + getAvatarBg(name) + ';">' + getAvatarHtml(name) + '</div>' +
            '<div class="msg-bubble">' + contentHtml + '<div class="msg-time">' + (m.time || '') + '</div></div>';
        container.appendChild(row);
    });
}

function scrollToBottom() {
    var c = document.getElementById('chat-messages');
    setTimeout(function() { c.scrollTop = c.scrollHeight; }, 100);
}

async function sendChatMsg() {
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
    } catch (e) { showToast('发送失败', 'error'); }
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
        '<div class="search-modal"><div class="search-modal-header"><span>🔍 查找用户</span><span class="search-modal-close" onclick="closeSearchModal()">&times;</span></div>' +
        '<div class="search-modal-body"><input type="text" id="search-user-input" placeholder="输入用户名搜索…" oninput="searchUsers()" autofocus><div id="search-result-list"></div></div></div>';
    overlay.onclick = function(e) { if (e.target === overlay) closeSearchModal(); };
    document.body.appendChild(overlay);
    setTimeout(function() { var inp = document.getElementById('search-user-input'); if (inp) inp.focus(); }, 100);
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
        var filtered = (res || []).filter(function(u) { return u.objectId !== userId && u.username && u.username.indexOf(keyword) !== -1; });
        if (filtered.length === 0) { list.innerHTML = '<div style="padding:8px;color:#909399;font-size:13px;">未找到用户</div>'; return; }
        list.innerHTML = '';
        filtered.forEach(function(u) {
            var div = document.createElement('div');
            div.className = 'search-user-item';
            div.innerHTML = '<div class="search-avatar" style="background:' + getAvatarBg(u.username) + ';">' + getAvatarHtml(u.username) + '</div><div style="font-weight:600;color:#1a237e;">' + u.username + '</div>';
            div.onclick = function() { closeSearchModal(); selectContact(u.objectId, u.username); };
            list.appendChild(div);
        });
    } catch (e) { list.innerHTML = '<div style="padding:8px;color:#ef4444;font-size:13px;">搜索失败</div>'; }
}