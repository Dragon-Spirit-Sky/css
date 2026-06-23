// 页面加载完成后执行 (修复：使用 DOMContentLoaded)
document.addEventListener('DOMContentLoaded', async function() {
    initLocalStorage();
    initHeader();
    var currentUser = getCurrentUser();
    if (currentUser) {
        renderUserProjects(currentUser.objectId || currentUser.id);
    } else {
        window.location.href = 'login_lh.html';
    }
});
// 渲染用户参与的所有班级（async）
async function renderUserProjects(userId) {
    const projects = await getUserProjects(userId);
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
        const member = project.members.find(m => m.userId == userId);
        const roleClass = member.role === 'teacher' ? 'role-teacher' : 'role-member';
        const roleText = member.role === 'teacher' ? '老师' : '成员';
        
        const card = document.createElement('div');
        card.className = 'project-card';
        card.onclick = function() {
            window.location.href = 'project_detail_lh.html?id=' + project.objectId;
        };
        
        card.innerHTML = '<div class="project-header">' +
            '<div class="project-name">' + project.name + '</div>' +
            '<div class="project-role ' + roleClass + '">' + roleText + '</div>' +
            '</div>' +
            '<div style="color: #1e3a8a; margin-bottom: 10px;">' + (project.description || '暂无描述') + '</div>' +
            '<div style="display: flex; justify-content: space-between; align-items: center;">' +
            '<div>' +
            '<span style="color: #1e3a8a;">成员数：' + project.members.length + '</span>' +
            '<span style="margin: 0 15px; color: #dcdfe6;">|</span>' +
            '<span style="color: #1e3a8a;">小组数：' + (project.groups ? project.groups.length : 0) + '</span>' +
            '<span style="margin: 0 15px; color: #dcdfe6;">|</span>' +
            '<span style="color: #1e3a8a;">创建时间：' + project.createTime + '</span>' +
            '</div>' +
            '</div>';
        
        card.classList.add('card-enter');
        container.appendChild(card);
    });
}

// 打开创建班级弹窗
document.getElementById('create-project-btn').addEventListener('click', openCreateModal);
function openCreateModal() {
    document.getElementById('create-form').reset();
    document.getElementById('project-name-error').textContent = '';
    document.getElementById('create-modal').style.display = 'flex';
}

// 打开加入班级弹窗
document.getElementById('join-project-btn').addEventListener('click', openJoinModal);
function openJoinModal() {
    document.getElementById('join-form').reset();
    document.getElementById('invite-code-error').textContent = '';
    document.getElementById('join-modal').style.display = 'flex';
}

// 创建班级（保存到Bmob云端）
async function createProject() {
    try {
    const name = document.getElementById('project-name').value.trim();
    const description = document.getElementById('project-desc').value.trim();
    
    if (!name) {
        document.getElementById('project-name-error').textContent = '请输入班级名称';
        return;
    }
    
    const currentUser = getCurrentUser();
    if (!currentUser) {
        showToast('登录已过期，请重新登录', 'error');
        return;
    }
    const userId = currentUser.objectId || currentUser.id;
    
    const newProject = {
        id: Date.now(),
        name: name,
        description: description,
        inviteCode: null,
        inviteExpireTime: null,
        creatorId: userId,
        members: [
            {
                userId: userId,
                username: currentUser.username,
                role: 'teacher',
                joinTime: new Date().toLocaleString()
            }
        ],
        groups: [],
        displayGroupId: null,
        showFinished: false,
        logs: [
            {
                time: new Date().toLocaleString(),
                userId: userId,
                username: currentUser.username,
                content: '班级创建成功'
            }
        ],
        createTime: new Date().toLocaleString(),
        updateTime: new Date().toLocaleString()
    };
    
        await saveProjectToCloud(newProject);
        showToast('班级创建成功，请在班级详情页生成邀请码', 'success');
        closeModal('create-modal');
        renderUserProjects(userId);
    } catch (e) {
        console.error('创建班级失败:', e);
        showToast('创建失败：' + (e.message || e.error || '未知错误，请检查Bmob表是否创建'), 'error');
    }
}

// 加入班级（从Bmob云端查询+更新）
async function joinProject() {
    const inviteCode = document.getElementById('invite-code').value.trim();
    
    if (!inviteCode || inviteCode.length !== 6 || !/^\d+$/.test(inviteCode)) {
        document.getElementById('invite-code-error').textContent = '请输入正确的6位数字邀请码';
        return;
    }
    
    const currentUser = getCurrentUser();
    const userId = currentUser.objectId || currentUser.id;
    
    try {
        const query = Bmob.Query('Projects');
        const allProjects = await query.find();
        const project = allProjects.find(p => p.inviteCode === inviteCode);
        
        if (!project) {
            document.getElementById('invite-code-error').textContent = '邀请码无效，请检查后重试';
            return;
        }
        
        if (!isInviteCodeValid(project)) {
            document.getElementById('invite-code-error').textContent = '邀请码已过期，请让老师重新生成';
            return;
        }
        
        if (project.members.some(m => m.userId == userId)) {
            showToast('你已经加入了这个班级', 'info');
            closeModal('join-modal');
            return;
        }
        
        project.members.push({
            userId: userId,
            username: currentUser.username,
            role: 'member',
            joinTime: new Date().toLocaleString()
        });
        
        project.logs.push({
            time: new Date().toLocaleString(),
            userId: userId,
            username: currentUser.username,
            content: '加入了班级'
        });
        
        project.updateTime = new Date().toLocaleString();
        await updateProjectToCloud(project.objectId, {
            members: project.members,
            logs: project.logs,
            updateTime: project.updateTime
        });
        
        showToast('加入班级成功', 'success');
        closeModal('join-modal');
        renderUserProjects(userId);
    } catch (e) {
        showToast('加入失败：' + e.message, 'error');
    }
}

// 关闭弹窗
function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}