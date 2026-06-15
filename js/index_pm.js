window.onload = function() {
    initLocalStorage();
    initHeader();
    const currentUser = checkLogin();
    
    if (currentUser) {
        renderUserProjects(currentUser.id);
    }
};

// 渲染用户参与的所有项目
function renderUserProjects(userId) {
    const projects = getUserProjects(userId);
    const container = document.getElementById('projects-container');
    const emptyState = document.getElementById('empty-state');
    
    if (projects.length === 0) {
        container.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }
    
    emptyState.style.display = 'none';
    container.innerHTML = '';
    
    projects.forEach(project => {
        const member = project.members.find(m => m.userId === userId);
        const roleClass = member.role === 'teacher' ? 'role-teacher' : 'role-member';
        const roleText = member.role === 'teacher' ? '老师' : '成员';
        
        const card = document.createElement('div');
        card.className = 'project-card';
        card.onclick = function() {
            window.location.href = `project_detail_pm.html?id=${project.id}`;
        };
        
        card.innerHTML = `
            <div class="project-header">
                <div class="project-name">${project.name}</div>
                <div class="project-role ${roleClass}">${roleText}</div>
            </div>
            <div style="color: #606266; margin-bottom: 10px;">${project.description || '暂无描述'}</div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <span style="color: #909399;">成员数：${project.members.length}</span>
                    <span style="margin: 0 15px; color: #dcdfe6;">|</span>
                    <span style="color: #909399;">创建时间：${project.createTime}</span>
                </div>
            </div>
        `;
        
        container.appendChild(card);
    });
}

// 打开创建项目弹窗
document.getElementById('create-project-btn').addEventListener('click', openCreateModal);
function openCreateModal() {
    document.getElementById('create-form').reset();
    document.getElementById('project-name-error').textContent = '';
    document.getElementById('create-modal').style.display = 'flex';
}

// 打开加入项目弹窗
document.getElementById('join-project-btn').addEventListener('click', openJoinModal);
function openJoinModal() {
    document.getElementById('join-form').reset();
    document.getElementById('invite-code-error').textContent = '';
    document.getElementById('join-modal').style.display = 'flex';
}

// 创建项目（不再自动生成邀请码）
function createProject() {
    const name = document.getElementById('project-name').value.trim();
    const description = document.getElementById('project-desc').value.trim();
    
    if (!name) {
        document.getElementById('project-name-error').textContent = '请输入项目名称';
        return;
    }
    
    const currentUser = getCurrentUser();
    const projects = JSON.parse(localStorage.getItem('projects_pm'));
    
    const newProject = {
        id: Date.now(),
        name: name,
        description: description,
        inviteCode: null, // 初始为空
        inviteExpireTime: null, // 初始为空
        creatorId: currentUser.id,
        members: [
            {
                userId: currentUser.id,
                username: currentUser.username,
                role: 'teacher',
                joinTime: new Date().toLocaleString()
            }
        ],
        groups: [],
        tasks: [],
        logs: [
            {
                time: new Date().toLocaleString(),
                userId: currentUser.id,
                username: currentUser.username,
                content: '项目创建成功'
            }
        ],
        createTime: new Date().toLocaleString(),
        updateTime: new Date().toLocaleString()
    };
    
    projects.push(newProject);
    localStorage.setItem('projects_pm', JSON.stringify(projects));
    
    showToast('项目创建成功，请在项目详情页生成邀请码', 'success');
    closeModal('create-modal');
    renderUserProjects(currentUser.id);
}

// 加入项目（增加过期验证）
function joinProject() {
    const inviteCode = document.getElementById('invite-code').value.trim();
    
    if (!inviteCode || inviteCode.length !== 6 || !/^\d+$/.test(inviteCode)) {
        document.getElementById('invite-code-error').textContent = '请输入正确的6位数字邀请码';
        return;
    }
    
    const currentUser = getCurrentUser();
    const projects = JSON.parse(localStorage.getItem('projects_pm'));
    const project = projects.find(p => p.inviteCode === inviteCode);
    
    if (!project) {
        document.getElementById('invite-code-error').textContent = '邀请码无效，请检查后重试';
        return;
    }
    
    // 检查邀请码是否过期
    if (!isInviteCodeValid(project)) {
        document.getElementById('invite-code-error').textContent = '邀请码已过期，请让老师重新生成';
        return;
    }
    
    // 检查是否已经加入
    if (project.members.some(m => m.userId === currentUser.id)) {
        showToast('你已经加入了这个项目', 'info');
        closeModal('join-modal');
        return;
    }
    
    // 添加为普通成员
    project.members.push({
        userId: currentUser.id,
        username: currentUser.username,
        role: 'member',
        joinTime: new Date().toLocaleString()
    });
    
    project.logs.push({
        time: new Date().toLocaleString(),
        userId: currentUser.id,
        username: currentUser.username,
        content: '加入了项目'
    });
    
    project.updateTime = new Date().toLocaleString();
    localStorage.setItem('projects_pm', JSON.stringify(projects));
    
    showToast('加入项目成功', 'success');
    closeModal('join-modal');
    renderUserProjects(currentUser.id);
}

// 关闭弹窗
function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}