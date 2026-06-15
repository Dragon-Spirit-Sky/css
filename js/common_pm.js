// 显示提示消息
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 3000);
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

// 检查用户是否登录，未登录直接跳转到登录页
function checkLogin() {
    const currentUser = JSON.parse(sessionStorage.getItem('currentUser_pm'));
    if (!currentUser) {
        window.location.href = 'login_pm.html';
        return null;
    }
    return currentUser;
}

// 获取当前登录用户
function getCurrentUser() {
    return JSON.parse(sessionStorage.getItem('currentUser_pm'));
}

// 退出登录
function logout() {
    sessionStorage.removeItem('currentUser_pm');
    showToast('退出登录成功', 'success');
    window.location.href = 'login_pm.html';
}

// 初始化头部导航（登录后才显示）
function initHeader() {
    const currentUser = getCurrentUser();
    const header = document.getElementById('header');
    const userInfoDiv = document.getElementById('user-info');
    
    if (!currentUser) {
        header.style.display = 'none';
        return;
    }
    
    header.style.display = 'flex';
    userInfoDiv.innerHTML = `
        <span>欢迎你，${currentUser.username}</span>
        <a href="user_detail_pm.html" class="btn btn-primary">个人中心</a>
        <button class="btn btn-danger" onclick="logout()">退出</button>
    `;
}

// 初始化本地存储数据（首次运行时）
function initLocalStorage() {
    // 初始化用户数据
    if (!localStorage.getItem('users_pm')) {
        localStorage.setItem('users_pm', JSON.stringify([]));
    }
    
    // 初始化项目数据
    if (!localStorage.getItem('projects_pm')) {
        localStorage.setItem('projects_pm', JSON.stringify([]));
    }
}

// 获取用户参与的所有项目
function getUserProjects(userId) {
    const projects = JSON.parse(localStorage.getItem('projects_pm'));
    return projects.filter(p => 
        p.members.some(m => m.userId === userId)
    );
}

// 检查用户在某个项目中的角色
function getUserRoleInProject(projectId, userId) {
    const projects = JSON.parse(localStorage.getItem('projects_pm'));
    const project = projects.find(p => p.id === projectId);
    
    if (!project) return null;
    
    const member = project.members.find(m => m.userId === userId);
    return member ? member.role : null;
}

// 页面加载时初始化
window.onload = function() {
    initLocalStorage();
    // 登录页和注册页不需要检查登录
    if (!window.location.pathname.includes('login_pm.html') && 
        !window.location.pathname.includes('register_pm.html')) {
        checkLogin();
    }
    initHeader();
};