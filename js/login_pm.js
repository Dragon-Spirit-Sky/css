// 页面加载时检查是否有记住的密码
window.onload = function() {
    initLocalStorage();
    
    const rememberedUser = JSON.parse(localStorage.getItem('rememberedUser_pm'));
    if (rememberedUser) {
        document.getElementById('username').value = rememberedUser.username;
        document.getElementById('password').value = rememberedUser.password;
        document.getElementById('remember-me').checked = true;
    }

    // 密码显示/隐藏切换
    document.getElementById('eye-btn').addEventListener('click', function() {
        const passwordInput = document.getElementById('password');
        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            this.textContent = '🙈';
        } else {
            passwordInput.type = 'password';
            this.textContent = '👁️';
        }
    });
};

document.getElementById('login-form').addEventListener('submit', function(e) {
    e.preventDefault();
    if (validateForm()) {
        loginUser();
    }
});

// 表单验证
function validateForm() {
    let isValid = true;
    
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    
    if (!username) {
        document.getElementById('username-error').textContent = '请输入用户名';
        isValid = false;
    } else {
        document.getElementById('username-error').textContent = '';
    }
    
    if (!password) {
        document.getElementById('password-error').textContent = '请输入密码';
        isValid = false;
    } else {
        document.getElementById('password-error').textContent = '';
    }
    
    return isValid;
}

// 登录用户
function loginUser() {
    const submitBtn = document.querySelector('.submit-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = '登录中...';

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const rememberMe = document.getElementById('remember-me').checked;
    
    const users = JSON.parse(localStorage.getItem('users_pm'));
    const user = users.find(u => u.username === username && u.password === password);
    
    if (user) {
        // 保存当前登录用户到sessionStorage
        sessionStorage.setItem('currentUser_pm', JSON.stringify(user));
        
        // 记住密码
        if (rememberMe) {
            localStorage.setItem('rememberedUser_pm', JSON.stringify({ username, password }));
        } else {
            localStorage.removeItem('rememberedUser_pm');
        }
        
        showToast('登录成功', 'success');
        
        setTimeout(() => {
            window.location.href = 'index_pm.html';
        }, 1000);
    } else {
        showToast('用户名或密码错误', 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = '立即登录';
    }
}