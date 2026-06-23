// 全局变量：保存当前正确的验证码
let currentCaptcha = '';
// 全局变量：倒计时定时器
let captchaCountdownTimer = null;

// 页面加载完成后执行
document.addEventListener('DOMContentLoaded', function() {
    initLocalStorage();
    initCaptcha();
    loadRememberedUser();
});

// ==================== 验证码核心功能 ====================
// 初始化验证码
function initCaptcha() {
    generateCaptcha();
    // 点击验证码画布也能刷新
    document.getElementById('captcha-canvas').addEventListener('click', refreshCaptcha);
    // 点击刷新按钮刷新
    document.getElementById('refresh-captcha-btn').addEventListener('click', refreshCaptcha);
}

// 生成随机验证码（4位数字+大小写字母）
function generateRandomCode() {
    // 字符集：去掉容易混淆的0/O、1/l/I
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz';
    let code = '';
    for (let i = 0; i < 4; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// 绘制验证码到Canvas
function drawCaptcha(code) {
    const canvas = document.getElementById('captcha-canvas');
    const ctx = canvas.getContext('2d');
    
    // 1. 绘制背景
    ctx.fillStyle = '#f5f7fa';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // 2. 绘制干扰线（4条）
    for (let i = 0; i < 4; i++) {
        ctx.strokeStyle = `rgba(${Math.random()*150}, ${Math.random()*150}, ${Math.random()*150}, 0.5)`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(Math.random() * canvas.width, Math.random() * canvas.height);
        ctx.lineTo(Math.random() * canvas.width, Math.random() * canvas.height);
        ctx.stroke();
    }
    
    // 3. 绘制干扰点（30个）
    for (let i = 0; i < 30; i++) {
        ctx.fillStyle = `rgba(${Math.random()*150}, ${Math.random()*150}, ${Math.random()*150}, 0.5)`;
        ctx.beginPath();
        ctx.arc(Math.random() * canvas.width, Math.random() * canvas.height, 1, 0, 2 * Math.PI);
        ctx.fill();
    }
    
    // 4. 绘制验证码文字（每个字符随机角度和颜色）
    ctx.font = 'bold 24px Arial';
    ctx.textBaseline = 'middle';
    const colors = ['#1976d2', '#66bb6a', '#e6a23c', '#f56c6c', '#9c27b0'];
    
    for (let i = 0; i < code.length; i++) {
        ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
        // 随机旋转角度 (-15° ~ +15°)
        const angle = (Math.random() - 0.5) * 0.5;
        ctx.save();
        ctx.translate(20 + i * 25, canvas.height / 2);
        ctx.rotate(angle);
        ctx.fillText(code[i], 0, 0);
        ctx.restore();
    }
}

// 生成新验证码
function generateCaptcha() {
    currentCaptcha = generateRandomCode();
    drawCaptcha(currentCaptcha);
    // 清空验证码输入框
    document.getElementById('captcha').value = '';
    // 清除之前的错误
    document.getElementById('captcha-error').textContent = '';
}

// 刷新验证码（带60秒冷却）
function refreshCaptcha() {
    const btn = document.getElementById('refresh-captcha-btn');
    
    // 如果正在倒计时，直接返回
    if (btn.disabled) return;
    
    // 生成新验证码
    generateCaptcha();
    
    // 开始60秒倒计时
    let countdown = 60;
    btn.disabled = true;
    btn.textContent = `${countdown}秒后刷新`;
    
    // 清除之前的定时器
    if (captchaCountdownTimer) {
        clearInterval(captchaCountdownTimer);
    }
    
    captchaCountdownTimer = setInterval(() => {
        countdown--;
        btn.textContent = `${countdown}秒后刷新`;
        
        if (countdown <= 0) {
            clearInterval(captchaCountdownTimer);
            btn.disabled = false;
            btn.textContent = '刷新';
        }
    }, 1000);
}

// 验证验证码是否正确（大小写不敏感）
function validateCaptcha(inputCode) {
    return inputCode.toUpperCase() === currentCaptcha.toUpperCase();
}

// ==================== 原有登录逻辑（已整合验证码验证） ====================
document.getElementById('login-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    if (validateForm()) {
        loginUser();
    }
});

// 表单验证（支持中文用户名和手机号）
function validateForm() {
    let isValid = true;
    
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const captcha = document.getElementById('captcha').value.trim();
    
    // 支持中文用户名、英文用户名、或手机号
    const cnRegex = /^[\u4e00-\u9fa5a-zA-Z0-9]{2,16}$/;
    const phoneRegex = /^1[3-9]\d{9}$/;
    
    // 账户验证
    if (!username) {
        document.getElementById('username-error').textContent = '请输入用户名或手机号';
        isValid = false;
    } else if (!cnRegex.test(username) && !phoneRegex.test(username)) {
        document.getElementById('username-error').textContent = '用户名需2-16位（支持中英文数字）或11位手机号';
        isValid = false;
    } else {
        document.getElementById('username-error').textContent = '';
    }
    
    // 密码验证
    if (!password) {
        document.getElementById('password-error').textContent = '请输入密码';
        isValid = false;
    } else {
        document.getElementById('password-error').textContent = '';
    }
    
    // 验证码验证
    if (!captcha) {
        document.getElementById('captcha-error').textContent = '请输入验证码';
        isValid = false;
    } else if (!validateCaptcha(captcha)) {
        document.getElementById('captcha-error').textContent = '验证码错误，请重新输入';
        isValid = false;
        refreshCaptcha();
    } else {
        document.getElementById('captcha-error').textContent = '';
    }
    
    return isValid;
}

// 登录用户（支持用户名或手机号登录）
async function loginUser() {
    const submitBtn = document.querySelector('.submit-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = '登录中...';
    const account = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const rememberMe = document.getElementById('remember-me').checked;
    
    try {
        const query = Bmob.Query('Users');
        const res = await query.find();
        
        const userObj = res.find(u => 
            (u.username === account || u.phone === account) && u.password === password
        );
        
        if (userObj) {
            var user = { objectId: userObj.objectId, ...userObj };
            sessionStorage.setItem('currentUser_lh', JSON.stringify(user));
            
            if (rememberMe) {
                localStorage.setItem('rememberedUser_lh', JSON.stringify({ username: account, password: password }));
            } else {
                localStorage.removeItem('rememberedUser_lh');
            }
            
            showToast('登录成功，正在跳转...', 'success');
            setTimeout(function() {
                window.location.href = 'index_lh.html';
            }, 500);
        } else {
            showToast('用户名或密码错误', 'error');
            submitBtn.disabled = false;
            submitBtn.textContent = '立即登录';
            refreshCaptcha();
        }
    } catch (e) {
        showToast('登录失败：' + e.message, 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = '立即登录';
        refreshCaptcha();
    }
}

// 页面加载时自动填充记住的密码
function loadRememberedUser() {
    var remembered = localStorage.getItem('rememberedUser_lh');
    if (remembered) {
        try {
            var data = JSON.parse(remembered);
            if (data.username && data.password) {
                document.getElementById('username').value = data.username;
                document.getElementById('password').value = data.password;
                document.getElementById('remember-me').checked = true;
            }
        } catch (e) {
            localStorage.removeItem('rememberedUser_lh');
        }
    }
}

// 页面卸载时清除定时器
window.onbeforeunload = function() {
    if (captchaCountdownTimer) {
        clearInterval(captchaCountdownTimer);
    }
};