// 预设头像列表
var presetAvatars = [
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
var currentUserData = null;
var selectedAvatarIndex = -1;
var customImageData = null;

document.addEventListener('DOMContentLoaded', function() {
    initLocalStorage();
    initHeader();
    var currentUser = checkLogin();
    
    if (currentUser) {
        currentUserData = currentUser;
        renderUserInfo(currentUser);
        renderRecordList(currentUser);
    }
});

// 渲染用户基本信息
function renderUserInfo(user) {
    var avatarEl = document.getElementById('user-avatar');
    var avatarText = document.getElementById('avatar-text');
    
    // 头像：优先使用自定义图片，其次emoji，最后首字母
    if (user.avatar && user.avatar.customImage) {
        avatarText.style.display = 'none';
        avatarEl.style.background = 'url(' + user.avatar.customImage + ') center/cover no-repeat';
    } else if (user.avatar && user.avatar.emoji) {
        avatarText.style.display = '';
        avatarEl.style.background = 'linear-gradient(135deg, ' + (user.avatar.color || '#667eea') + ' 0%, ' + 
            lightenColor(user.avatar.color || '#667eea', 0.3) + ' 100%)';
        avatarText.textContent = user.avatar.emoji;
    } else {
        var name = user.username || '';
        var hash = 0;
        for (var i = 0; i < name.length; i++) { hash = ((hash << 5) - hash) + name.charCodeAt(i); hash |= 0; }
        var randAvatar = presetAvatars[Math.abs(hash) % presetAvatars.length];
        avatarText.style.display = '';
        avatarEl.style.background = 'linear-gradient(135deg, ' + randAvatar.color + ' 0%, ' + lightenColor(randAvatar.color, 0.3) + ' 100%)';
        avatarText.textContent = randAvatar.emoji;
        user.avatar = { emoji: randAvatar.emoji, color: randAvatar.color };
        sessionStorage.setItem('currentUser_lh', JSON.stringify(user));
        var uq2 = Bmob.Query('Users');
        uq2.set('id', user.objectId || user.id);
        uq2.set('avatar', user.avatar);
        uq2.save().catch(function(e) { console.error('随机头像保存失败:', e); });
    }
    
    document.getElementById('user-username').textContent = user.username;
    document.getElementById('user-phone').textContent = user.phone || '未绑定';
    document.getElementById('user-studentid').textContent = user.studentId || '未设置';
    document.getElementById('user-createtime').textContent = user.createTime;
    var gender = user.gender || '保密';
    document.getElementById('user-gender').textContent = gender;
    var genderIcon = {'男':'♂','女':'♀','保密':'⚧'};
    var genderIconEl = document.getElementById('gender-icon');
    genderIconEl.textContent = genderIcon[gender] || '⚧';
    var iconStyles = {
        '男': { bg: '#e8f0fe', color: '#5a7fc2' },
        '女': { bg: '#fce4ec', color: '#d4788a' },
        '保密': { bg: '#f3e5f5', color: '#9c7ab5' }
    };
    var style = iconStyles[gender] || iconStyles['保密'];
    genderIconEl.style.background = style.bg;
    genderIconEl.style.color = style.color;
}

// 打开编辑弹窗
function openEditModal() {
    document.getElementById('edit-username').value = currentUserData.username || '';
    document.getElementById('edit-studentid').value = currentUserData.studentId || '';
    document.getElementById('edit-phone-display').textContent = currentUserData.phone || '未绑定';
    document.getElementById('edit-username-error').textContent = '';
    document.getElementById('edit-studentid-error').textContent = '';
    var gender = currentUserData.gender || '保密';
    var radios = document.getElementsByName('edit-gender');
    for (var i = 0; i < radios.length; i++) {
        radios[i].checked = (radios[i].value === gender);
    }
    document.getElementById('edit-modal').classList.add('active');
}

// 保存用户信息
async function saveUserInfo() {
    var newUsername = document.getElementById('edit-username').value.trim();
    var newStudentId = document.getElementById('edit-studentid').value.trim();
    var isValid = true;
    
    // 验证用户名
    var usernameRegex = /^[\u4e00-\u9fa5a-zA-Z0-9]{2,16}$/;
    if (!newUsername) {
        document.getElementById('edit-username-error').textContent = '用户名不能为空';
        isValid = false;
    } else if (!usernameRegex.test(newUsername)) {
        document.getElementById('edit-username-error').textContent = '用户名需2-16位（中英文数字）';
        isValid = false;
    } else if (newUsername !== currentUserData.username) {
        var q = Bmob.Query('Users');
        q.equalTo('username', '==', newUsername);
        var existUsers = await q.find();
        if (existUsers.length > 0 && existUsers[0].objectId !== (currentUserData.objectId || '')) {
            document.getElementById('edit-username-error').textContent = '用户名已被占用';
            isValid = false;
        } else {
            document.getElementById('edit-username-error').textContent = '';
        }
    } else {
        document.getElementById('edit-username-error').textContent = '';
    }
    
    if (!isValid) return;

    // 更新 Bmob Users 表
    var genderRadios = document.getElementsByName('edit-gender');
    var newGender = '保密';
    for (var i = 0; i < genderRadios.length; i++) {
        if (genderRadios[i].checked) { newGender = genderRadios[i].value; break; }
    }
    try {
        var uq = Bmob.Query('Users');
        uq.set('id', currentUserData.objectId || currentUserData.id);
        uq.set('username', newUsername);
        uq.set('studentId', newStudentId);
        uq.set('gender', newGender);
        await uq.save();
    } catch (e) {
        showToast('更新失败：' + e.message, 'error');
        return;
    }

    // 更新 sessionStorage
    currentUserData.username = newUsername;
    currentUserData.studentId = newStudentId;
    var genderRadios2 = document.getElementsByName('edit-gender');
    for (var j = 0; j < genderRadios2.length; j++) {
        if (genderRadios2[j].checked) {
            currentUserData.gender = genderRadios2[j].value;
            break;
        }
    }
    sessionStorage.setItem('currentUser_lh', JSON.stringify(currentUserData));
    
    // 更新页面显示
    renderUserInfo(currentUserData);
    closeModal('edit-modal');
    
    if (typeof showToast === 'function') {
        showToast('个人信息已更新', 'success');
    } else {
        alert('个人信息已更新');
    }
}

// ==================== 修改手机号 ====================
var phoneSmsCode = '';
var phoneSmsTimer = null;

function openPhoneModal() {
    document.getElementById('new-phone').value = '';
    document.getElementById('phone-sms-code').value = '';
    document.getElementById('new-phone-error').textContent = '';
    document.getElementById('phone-sms-error').textContent = '';
    phoneSmsCode = '';
    if (phoneSmsTimer) { clearInterval(phoneSmsTimer); phoneSmsTimer = null; }
    document.getElementById('phone-send-sms-btn').disabled = false;
    document.getElementById('phone-send-sms-btn').textContent = '发送验证码';
    document.getElementById('phone-modal').classList.add('active');
}

function sendPhoneSmsCode() {
    var phone = document.getElementById('new-phone').value.trim();
    var phoneRegex = /^1[3-9]\d{9}$/;
    if (!phone) {
        document.getElementById('new-phone-error').textContent = '请先输入手机号';
        return;
    }
    if (!phoneRegex.test(phone)) {
        document.getElementById('new-phone-error').textContent = '请输入正确的11位手机号';
        return;
    }
    document.getElementById('new-phone-error').textContent = '';
    phoneSmsCode = Math.floor(100000 + Math.random() * 900000).toString();
    showToast('验证码已发送至 ' + phone + '，验证码为：' + phoneSmsCode, 'success');
    var btn = document.getElementById('phone-send-sms-btn');
    var countdown = 60;
    btn.disabled = true;
    if (phoneSmsTimer) clearInterval(phoneSmsTimer);
    phoneSmsTimer = setInterval(function() {
        countdown--;
        btn.textContent = countdown + '秒后重发';
        if (countdown <= 0) {
            clearInterval(phoneSmsTimer);
            phoneSmsTimer = null;
            btn.disabled = false;
            btn.textContent = '发送验证码';
        }
    }, 1000);
}

async function savePhone() {
    var newPhone = document.getElementById('new-phone').value.trim();
    var smsCode = document.getElementById('phone-sms-code').value.trim();
    var phoneRegex = /^1[3-9]\d{9}$/;
    if (!newPhone) {
        document.getElementById('new-phone-error').textContent = '请输入手机号';
        return;
    }
    if (!phoneRegex.test(newPhone)) {
        document.getElementById('new-phone-error').textContent = '请输入正确的11位手机号';
        return;
    }
    if (!smsCode) {
        document.getElementById('phone-sms-error').textContent = '请输入验证码';
        return;
    }
    if (!phoneSmsCode) {
        document.getElementById('phone-sms-error').textContent = '请先点击发送验证码';
        return;
    }
    if (smsCode !== phoneSmsCode) {
        document.getElementById('phone-sms-error').textContent = '验证码错误';
        return;
    }
    try {
        var q = Bmob.Query('Users');
        q.equalTo('phone', '==', newPhone);
        var existUsers = await q.find();
        if (existUsers.length > 0 && existUsers[0].objectId !== (currentUserData.objectId || currentUserData.id)) {
            document.getElementById('new-phone-error').textContent = '该手机号已被其他账号绑定';
            return;
        }
        var uq = Bmob.Query('Users');
        uq.set('id', currentUserData.objectId || currentUserData.id);
        uq.set('phone', newPhone);
        await uq.save();
        currentUserData.phone = newPhone;
        sessionStorage.setItem('currentUser_lh', JSON.stringify(currentUserData));
        renderUserInfo(currentUserData);
        closeModal('phone-modal');
        showToast('手机号修改成功', 'success');
    } catch (e) {
        showToast('修改失败：' + (e.message || '请稍后重试'), 'error');
    }
}

// 打开头像选择弹窗
function openAvatarPicker() {
    var picker = document.getElementById('avatar-picker');
    picker.innerHTML = '';
    
    // 重置上传预览
    customImageData = null;
    document.getElementById('avatar-file-input').value = '';
    document.getElementById('upload-preview-img').style.display = 'none';
    document.getElementById('upload-hint').style.display = '';
    
    // 判断当前选中的头像
    var currentEmoji = (currentUserData.avatar && !currentUserData.avatar.customImage) ? currentUserData.avatar.emoji : null;
    selectedAvatarIndex = -1;
    
    // 如果当前是自定义图片，预览显示
    if (currentUserData.avatar && currentUserData.avatar.customImage) {
        customImageData = currentUserData.avatar.customImage;
        document.getElementById('upload-preview-img').src = currentUserData.avatar.customImage;
        document.getElementById('upload-preview-img').style.display = '';
        document.getElementById('upload-hint').style.display = 'none';
    }
    
    presetAvatars.forEach(function(avatar, index) {
        var div = document.createElement('div');
        div.className = 'avatar-option';
        div.style.background = 'linear-gradient(135deg, ' + avatar.color + ' 0%, ' + lightenColor(avatar.color, 0.3) + ' 100%)';
        div.textContent = avatar.emoji;
        div.title = '头像 ' + (index + 1);
        
        if (avatar.emoji === currentEmoji) {
            div.classList.add('selected');
            selectedAvatarIndex = index;
        }
        
        div.addEventListener('click', function() {
            // 点击emoji头像时清除自定义图片
            customImageData = null;
            document.getElementById('upload-preview-img').style.display = 'none';
            document.getElementById('upload-hint').style.display = '';
            // 移除所有选中
            var options = picker.querySelectorAll('.avatar-option');
            options.forEach(function(o) { o.classList.remove('selected'); });
            // 选中当前
            div.classList.add('selected');
            selectedAvatarIndex = index;
        });
        
        picker.appendChild(div);
    });
    
    document.getElementById('avatar-modal').classList.add('active');
}

// 处理自定义图片上传（含压缩）
function handleImageUpload(input) {
    if (!input.files || !input.files[0]) return;
    var file = input.files[0];

    // 检查文件大小（限制2MB）
    if (file.size > 2 * 1024 * 1024) {
        if (typeof showToast === 'function') {
            showToast('图片大小不能超过2MB', 'warning');
        }
        return;
    }

    var reader = new FileReader();
    reader.onload = function(e) {
        // 压缩图片再存储
        compressImage(e.target.result, 200, 200, 0.6, function(compressed) {
            customImageData = compressed;
            document.getElementById('upload-preview-img').src = compressed;
            document.getElementById('upload-preview-img').style.display = '';
            document.getElementById('upload-hint').style.display = 'none';
            // 清除emoji选中状态
            selectedAvatarIndex = -1;
            var options = document.getElementById('avatar-picker').querySelectorAll('.avatar-option');
            options.forEach(function(o) { o.classList.remove('selected'); });
        });
    };
    reader.readAsDataURL(file);
}

// 图片压缩工具函数
function compressImage(dataUrl, maxW, maxH, quality, callback) {
    var img = new Image();
    img.onload = function() {
        var w = img.width, h = img.height;
        if (w > maxW) { h = h * maxW / w; w = maxW; }
        if (h > maxH) { w = w * maxH / h; h = maxH; }
        var canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        callback(canvas.toDataURL('image/jpeg', quality));
    };
    img.src = dataUrl;
}

// 确认头像选择
async function confirmAvatar() {
    var avatarData = null;
    
    if (customImageData) {
        // 使用自定义图片
        avatarData = { customImage: customImageData };
    } else if (selectedAvatarIndex >= 0) {
        // 使用预设emoji
        var selected = presetAvatars[selectedAvatarIndex];
        avatarData = { emoji: selected.emoji, color: selected.color };
    } else {
        if (typeof showToast === 'function') {
            showToast('请选择一个头像或上传图片', 'warning');
        }
        return;
    }
    
    // 更新 Bmob Users 表
    try {
        var uq = Bmob.Query('Users');
        uq.set('id', currentUserData.objectId || currentUserData.id);
        uq.set('avatar', avatarData);
        await uq.save();
    } catch (e) {
        showToast('头像更新失败：' + (e.message || '图片过大，请尝试更小的图片'), 'error');
        return;
    }

    // 更新 sessionStorage
    currentUserData.avatar = avatarData;
    sessionStorage.setItem('currentUser_lh', JSON.stringify(currentUserData));
    
    // 更新页面显示
    renderUserInfo(currentUserData);
    closeModal('avatar-modal');
    initHeader(); // 刷新头部导航栏
    
    if (typeof showToast === 'function') {
        showToast('头像已更新', 'success');
    }
}

// 辅助函数：颜色变亮
function lightenColor(hex, factor) {
    var r = parseInt(hex.slice(1, 3), 16);
    var g = parseInt(hex.slice(3, 5), 16);
    var b = parseInt(hex.slice(5, 7), 16);
    r = Math.min(255, Math.round(r + (255 - r) * factor));
    g = Math.min(255, Math.round(g + (255 - g) * factor));
    b = Math.min(255, Math.round(b + (255 - b) * factor));
    return '#' + [r, g, b].map(function(c) { return c.toString(16).padStart(2, '0'); }).join('');
}

// 关闭弹窗（复用 common 逻辑）
function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

// 渲染操作记录列表
async function renderRecordList(user) {
    var query = Bmob.Query('Projects');
    var projects = await query.find();
    var allLogs = [];
    var userId = user.objectId || user.id;
    
    projects.forEach(project => {
        if (project.logs) {
            project.logs.forEach(log => {
                if (log.userId == userId) {
                    allLogs.push({
                        time: log.time,
                        content: '[' + project.name + '] ' + log.content
                    });
                }
            });
        }
    });
    
    allLogs.sort((a, b) => new Date(b.time) - new Date(a.time));
    const userLogs = allLogs.slice(0, 20);
    
    const recordList = document.getElementById('record-list');
    recordList.innerHTML = '';
    
    if (userLogs.length === 0) {
        recordList.innerHTML = '<li style="text-align:center;padding:40px 20px;"><div class="empty-icon" style="font-size:48px;display:inline-block;animation:float 3s ease-in-out infinite;">📋</div><p style="color:#909399;margin-top:10px;">暂无操作记录</p></li>';
        return;
    }
    
    userLogs.forEach(log => {
        const li = document.createElement('li');
        li.className = 'record-item';
        li.innerHTML = `
            <div class="record-time">${log.time}</div>
            <div>${log.content}</div>
        `;
        recordList.appendChild(li);
    });
}