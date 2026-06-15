// 表单提交事件监听
document.getElementById('register-form').addEventListener('submit', function(e) {
    e.preventDefault();
    if (validateForm()) {
        registerUser();
    }
});

/**
 * 表单验证函数
 * @returns {boolean} 验证是否通过
 */
function validateForm() {
    let isValid = true;
    
    // 1. 验证用户名
    const username = document.getElementById('username').value.trim();
    const usernameRegex = /^[a-zA-Z0-9]{3,16}$/; // 3-16位字母数字
    
    if (!username) {
        document.getElementById('username-error').textContent = '请输入用户名';
        isValid = false;
    } else if (!usernameRegex.test(username)) {
        document.getElementById('username-error').textContent = '用户名必须是3-16位字母或数字';
        isValid = false;
    } else {
        // 检查用户名是否已存在
        const users = JSON.parse(localStorage.getItem('users_pm')) || [];
        if (users.some(u => u.username === username)) {
            document.getElementById('username-error').textContent = '用户名已存在，请更换';
            isValid = false;
        } else {
            document.getElementById('username-error').textContent = '';
        }
    }
    
    // 2. 验证密码
    const password = document.getElementById('password').value;
    if (!password) {
        document.getElementById('password-error').textContent = '请输入密码';
        isValid = false;
    } else if (password.length < 6 || password.length > 16) {
        document.getElementById('password-error').textContent = '密码长度必须在6-16位之间';
        isValid = false;
    } else {
        document.getElementById('password-error').textContent = '';
    }
    
    // 3. 验证确认密码
    const confirmPassword = document.getElementById('confirm-password').value;
    if (!confirmPassword) {
        document.getElementById('confirm-password-error').textContent = '请再次输入密码';
        isValid = false;
    } else if (confirmPassword !== password) {
        document.getElementById('confirm-password-error').textContent = '两次输入的密码不一致';
        isValid = false;
    } else {
        document.getElementById('confirm-password-error').textContent = '';
    }
    
    return isValid;
}

/**
 * 注册用户逻辑
 */
function registerUser() {
    // 获取提交按钮并设置加载状态
    const submitBtn = document.querySelector('.submit-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = '注册中...';

    // 从表单获取数据
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    
    // 获取现有用户列表（如果不存在则初始化为空数组）
    const users = JSON.parse(localStorage.getItem('users_pm')) || [];
    
    // 创建新用户对象
    const newUser = {
        id: Date.now(), // 用时间戳作为唯一ID
        username: username,
        password: password,
        createTime: new Date().toLocaleString() // 注册时间
    };
    
    // 添加到用户列表并保存到本地存储
    users.push(newUser);
    localStorage.setItem('users_pm', JSON.stringify(users));
    
    // 注册成功提示
    showToast('注册成功，正在跳转到登录页...', 'success');
    
    // 1.5秒后跳转到登录页
    setTimeout(() => {
        window.location.href = 'login_pm.html';
    }, 1500);
}