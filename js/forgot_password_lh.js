// 全局变量
var currentSmsCode = '';
var smsCountdownTimer = null;

document.addEventListener('DOMContentLoaded', function() {
    initLocalStorage();
});

document.getElementById('forgot-form').addEventListener('submit', function(e) {
    e.preventDefault();
    validateForm().then(function(valid) {
        if (valid) resetPassword();
    });
});

// 发送短信验证码
async function sendSmsCode() {
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
    
    // 检查手机号是否已注册（Bmob云端）
    var q = Bmob.Query('Users');
    q.equalTo('phone', '==', phone);
    var existUsers = await q.find();
    if (existUsers.length === 0) {
        document.getElementById('phone-error').textContent = '该手机号未注册，请先注册';
        return;
    }
    document.getElementById('phone-error').textContent = '';
    
    // 生成6位随机验证码
    currentSmsCode = Math.floor(100000 + Math.random() * 900000).toString();
    
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
        var q = Bmob.Query('Users');
        q.equalTo('phone', '==', phone);
        var existUsers = await q.find();
        if (existUsers.length === 0) {
            document.getElementById('phone-error').textContent = '该手机号未注册';
            isValid = false;
        } else {
            document.getElementById('phone-error').textContent = '';
        }
    }
    
    // 短信验证码
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
    
    // 新密码
    var password = document.getElementById('password').value;
    if (!password) {
        document.getElementById('password-error').textContent = '请输入新密码';
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
        document.getElementById('confirm-password-error').textContent = '请再次输入新密码';
        isValid = false;
    } else if (confirmPassword !== password) {
        document.getElementById('confirm-password-error').textContent = '两次输入的密码不一致';
        isValid = false;
    } else {
        document.getElementById('confirm-password-error').textContent = '';
    }
    
    return isValid;
}

async function resetPassword() {
    var submitBtn = document.querySelector('.submit-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = '重置中...';
    
    var phone = document.getElementById('phone').value.trim();
    var newPassword = document.getElementById('password').value;
    
    try {
        var q = Bmob.Query('Users');
        q.equalTo('phone', '==', phone);
        var existUsers = await q.find();
        if (existUsers.length > 0) {
            var uq = Bmob.Query('Users');
            uq.set('id', existUsers[0].objectId);
            uq.set('password', newPassword);
            await uq.save();
            showToast('密码重置成功，正在跳转到登录页...', 'success');
            setTimeout(function() {
                window.location.href = 'login_lh.html';
            }, 1500);
        } else {
            showToast('用户不存在，请检查手机号', 'error');
            submitBtn.disabled = false;
            submitBtn.textContent = '重置密码';
        }
    } catch (e) {
        showToast('重置失败：' + e.message, 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = '重置密码';
    }
}

window.onbeforeunload = function() {
    if (smsCountdownTimer) clearInterval(smsCountdownTimer);
};