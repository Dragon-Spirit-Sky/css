// 页面加载完成后执行
var currentSmsCode = '';
var smsCountdownTimer = null;

document.addEventListener('DOMContentLoaded', function() {
    initLocalStorage();
});

document.getElementById('register-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    if (await validateForm()) {
        registerUser();
    }
});

// 发送短信验证码（模拟）
function sendSmsCode() {
    var phone = document.getElementById('phone').value.trim();
    var phoneRegex = /^1[3-9]\d{9}$/;
    
    if (!phone) {
        document.getElementById('phone-error').textContent = '请先输入手机号';
        return;
    }
    if (!phoneRegex.test(phone)) {
        document.getElementById('phone-error').textContent = '请输入正确的11位手机号';
        return;
    }
    document.getElementById('phone-error').textContent = '';
    
    // 生成6位随机验证码
    currentSmsCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    // 模拟发送短信（前端演示用弹窗展示验证码）
    showToast('验证码已发送至 ' + phone + '，验证码为：' + currentSmsCode, 'success');
    
    // 60秒倒计时
    var btn = document.getElementById('send-sms-btn');
    var countdown = 60;
    btn.disabled = true;
    
    if (smsCountdownTimer) clearInterval(smsCountdownTimer);
    smsCountdownTimer = setInterval(function() {
        countdown--;
        btn.textContent = countdown + '秒后重发';
        if (countdown <= 0) {
            clearInterval(smsCountdownTimer);
            btn.disabled = false;
            btn.textContent = '发送验证码';
        }
    }, 1000);
}

async function validateForm() {
    var isValid = true;
    
    // 用户名：支持中文、英文、数字，2-16位
    var username = document.getElementById('username').value.trim();
    var usernameRegex = /^[\u4e00-\u9fa5a-zA-Z0-9]{2,16}$/;
    
    if (!username) {
        document.getElementById('username-error').textContent = '请输入用户名';
        isValid = false;
    } else if (!usernameRegex.test(username)) {
        document.getElementById('username-error').textContent = '用户名需2-16位（支持中英文和数字）';
        isValid = false;
    } else {
        try {
            var q1 = Bmob.Query('Users');
            q1.equalTo('username', '==', username);
            var existUsers = await q1.find();
            if (existUsers.length > 0) {
                document.getElementById('username-error').textContent = '用户名已存在，请更换';
                isValid = false;
            } else {
                document.getElementById('username-error').textContent = '';
            }
        } catch (e) { document.getElementById('username-error').textContent = ''; }
    }
    
    // 手机号验证
    var phone = document.getElementById('phone').value.trim();
    var phoneRegex = /^1[3-9]\d{9}$/;
    if (!phone) {
        document.getElementById('phone-error').textContent = '请输入手机号';
        isValid = false;
    } else if (!phoneRegex.test(phone)) {
        document.getElementById('phone-error').textContent = '请输入正确的11位手机号';
        isValid = false;
    } else {
        try {
            var q2 = Bmob.Query('Users');
            q2.equalTo('phone', '==', phone);
            var existPhones = await q2.find();
            if (existPhones.length > 0) {
                document.getElementById('phone-error').textContent = '该手机号已被注册';
                isValid = false;
            } else {
                document.getElementById('phone-error').textContent = '';
            }
        } catch (e) { document.getElementById('phone-error').textContent = ''; }
    }
    
    // 短信验证码验证
    var smsCode = document.getElementById('sms-code').value.trim();
    if (!smsCode) {
        document.getElementById('sms-code-error').textContent = '请输入短信验证码';
        isValid = false;
    } else if (!currentSmsCode) {
        document.getElementById('sms-code-error').textContent = '请先点击发送验证码';
        isValid = false;
    } else if (smsCode !== currentSmsCode) {
        document.getElementById('sms-code-error').textContent = '验证码错误，请重新输入';
        isValid = false;
    } else {
        document.getElementById('sms-code-error').textContent = '';
    }
    
    // 密码验证
    var password = document.getElementById('password').value;
    if (!password) {
        document.getElementById('password-error').textContent = '请输入密码';
        isValid = false;
    } else if (password.length < 6 || password.length > 16) {
        document.getElementById('password-error').textContent = '密码长度必须在6-16位之间';
        isValid = false;
    } else {
        document.getElementById('password-error').textContent = '';
    }
    
    // 确认密码
    var confirmPassword = document.getElementById('confirm-password').value;
    if (!confirmPassword) {
        document.getElementById('confirm-password-error').textContent = '请再次输入密码';
        isValid = false;
    } else if (confirmPassword !== password) {
        document.getElementById('confirm-password-error').textContent = '两次输入的密码不一致';
        isValid = false;
    } else {
        document.getElementById('confirm-password-error').textContent = '';
    }

    // 用户协议
    var agreeTerms = document.getElementById('agree-terms').checked;
    if (!agreeTerms) {
        document.getElementById('agree-terms-error').textContent = '请先阅读并同意用户服务协议';
        isValid = false;
    } else {
        document.getElementById('agree-terms-error').textContent = '';
    }
    
    return isValid;
}

async function registerUser() {
    var submitBtn = document.querySelector('.submit-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = '注册中...';

    try {
        var query = Bmob.Query('Users');
        query.set('username', document.getElementById('username').value.trim());
        query.set('phone', document.getElementById('phone').value.trim());
        query.set('password', document.getElementById('password').value);
        query.set('studentId', '');
        query.set('gender', '保密');
        query.set('createTime', new Date().toLocaleString());
        var res = await query.save();
        
        var user = {
            objectId: res.objectId,
            username: document.getElementById('username').value.trim(),
            phone: document.getElementById('phone').value.trim(),
            password: document.getElementById('password').value,
            studentId: '',
            gender: '保密',
            createTime: new Date().toLocaleString()
        };
        sessionStorage.setItem('currentUser_lh', JSON.stringify(user));
        
        showToast('注册成功，正在跳转...', 'success');
        setTimeout(function() {
            window.location.href = 'index_lh.html';
        }, 1500);
    } catch (e) {
        showToast('注册失败：' + e.message, 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = '立即注册';
    }
}

// 页面卸载时清除定时器
window.onbeforeunload = function() {
    if (smsCountdownTimer) clearInterval(smsCountdownTimer);
};