let currentProject = null;
let countdownTimer = null;

// 页面加载完成后执行
window.onload = function() {
    initLocalStorage();
    initHeader();
    checkLogin();
    
    // 获取URL中的项目ID
    const urlParams = new URLSearchParams(window.location.search);
    const projectId = parseInt(urlParams.get('id'));
    
    if (!projectId) {
        showToast('项目ID不存在', 'error');
        window.location.href = 'index_pm.html';
        return;
    }
    
    loadProjectDetail(projectId);
    initInviteSection();
    bindGenerateCodeButton(); // 绑定邀请码按钮事件
};

// 加载项目详情
function loadProjectDetail(id) {
    const projects = JSON.parse(localStorage.getItem('projects_pm')) || [];
    currentProject = projects.find(p => p.id === id);
    
    if (!currentProject) {
        showToast('项目不存在', 'error');
        window.location.href = 'index_pm.html';
        return;
    }
    
    // 填充基本信息
    document.getElementById('project-name').textContent = currentProject.name;
    document.getElementById('project-desc').textContent = currentProject.description || '暂无描述';
    document.getElementById('project-creator').textContent = currentProject.members.find(m => m.userId === currentProject.creatorId)?.username || '未知';
    document.getElementById('project-createtime').textContent = currentProject.createTime;
    document.getElementById('project-member-count').textContent = currentProject.members.length;
    document.getElementById('project-score').textContent = currentProject.score ? `${currentProject.score}分` : '未评分';
    
    renderMemberList();
    renderGroupList();
    renderTaskList();
    renderLogList();
    initScoreSection();
}

// ==================== 邀请码相关功能（已修复重名问题） ====================
// 绑定邀请码按钮事件（推荐用addEventListener，不用内联onclick）
function bindGenerateCodeButton() {
    const btn = document.getElementById('generate-code-btn');
    if (btn) {
        btn.addEventListener('click', generateNewInviteCode);
    }
}

// 初始化邀请码区域
function initInviteSection() {
    const currentUser = getCurrentUser();
    const inviteSection = document.getElementById('invite-section');
    
    // 只有老师可以看到邀请码区域
    if (getUserRoleInProject(currentProject.id, currentUser.id) !== 'teacher') {
        inviteSection.style.display = 'none';
        return;
    }
    
    updateInviteCodeDisplay();
    // 每秒更新倒计时
    countdownTimer = setInterval(updateInviteCodeDisplay, 1000);
}

// 更新邀请码显示和倒计时
function updateInviteCodeDisplay() {
    if (!currentProject) return;
    
    const codeDisplay = document.getElementById('invite-code-display');
    const expireDisplay = document.getElementById('invite-expire');
    const generateBtn = document.getElementById('generate-code-btn');
    
    if (isInviteCodeValid(currentProject)) {
        const now = Date.now();
        const expireTime = new Date(currentProject.inviteExpireTime).getTime();
        const remainSeconds = Math.ceil((expireTime - now) / 1000);
        
        codeDisplay.textContent = currentProject.inviteCode;
        expireDisplay.textContent = `剩余 ${remainSeconds} 秒过期`;
        generateBtn.textContent = '重新生成邀请码';
    } else {
        codeDisplay.textContent = '暂无邀请码';
        expireDisplay.textContent = '';
        generateBtn.textContent = '生成5分钟有效邀请码';
    }
}

// 生成新的邀请码（已重命名，避免和工具函数冲突）
function generateNewInviteCode() {
    console.log('点击了生成邀请码按钮'); // 调试用，控制台会打印
    
    const currentUser = getCurrentUser();
    
    // 权限检查
    if (getUserRoleInProject(currentProject.id, currentUser.id) !== 'teacher') {
        showToast('只有老师才能生成邀请码', 'error');
        return;
    }
    
    const projects = JSON.parse(localStorage.getItem('projects_pm')) || [];
    const index = projects.findIndex(p => p.id === currentProject.id);
    
    if (index === -1) {
        showToast('项目数据错误', 'error');
        return;
    }
    
    // 调用工具函数生成6位邀请码（现在不会冲突了）
    const newCode = generateInviteCode();
    // 5分钟后过期
    const expireTime = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    
    // 更新项目数据
    projects[index].inviteCode = newCode;
    projects[index].inviteExpireTime = expireTime;
    
    // 添加日志
    projects[index].logs.push({
        time: new Date().toLocaleString(),
        userId: currentUser.id,
        username: currentUser.username,
        content: `生成了新的邀请码：${newCode}`
    });
    
    projects[index].updateTime = new Date().toLocaleString();
    localStorage.setItem('projects_pm', JSON.stringify(projects));
    
    // 更新当前项目对象
    currentProject = projects[index];
    
    showToast(`邀请码生成成功：${newCode}，5分钟内有效`, 'success');
    updateInviteCodeDisplay();
    renderLogList(); // 刷新日志列表
}

// ==================== 成员管理功能 ====================
function renderMemberList() {
    const memberList = document.getElementById('member-list');
    memberList.innerHTML = '';
    const currentUser = getCurrentUser();
    const isTeacher = getUserRoleInProject(currentProject.id, currentUser.id) === 'teacher';
    
    currentProject.members.forEach(member => {
        const li = document.createElement('li');
        li.className = 'member-item';
        
        let roleBadge = '';
        if (member.role === 'teacher') {
            roleBadge = '<span class="badge badge-teacher">老师</span>';
        } else {
            roleBadge = '<span class="badge badge-member">成员</span>';
        }
        
        let actionButtons = '';
        if (isTeacher && member.userId !== currentUser.id) {
            if (member.role === 'member') {
                actionButtons = `
                    <button class="btn btn-sm btn-success" onclick="promoteToTeacher(${member.userId})">提升为老师</button>
                    <button class="btn btn-sm btn-danger" onclick="removeMember(${member.userId})">移除</button>
                `;
            } else {
                actionButtons = `
                    <button class="btn btn-sm btn-danger" onclick="removeMember(${member.userId})">移除</button>
                `;
            }
        }
        
        li.innerHTML = `
            <div class="member-info">
                <span class="member-name">${member.username}</span>
                ${roleBadge}
            </div>
            <div class="member-actions">
                ${actionButtons}
            </div>
        `;
        
        memberList.appendChild(li);
    });
}

function promoteToTeacher(userId) {
    const currentUser = getCurrentUser();
    if (getUserRoleInProject(currentProject.id, currentUser.id) !== 'teacher') {
        showToast('只有老师才能进行此操作', 'error');
        return;
    }
    
    const projects = JSON.parse(localStorage.getItem('projects_pm')) || [];
    const index = projects.findIndex(p => p.id === currentProject.id);
    const memberIndex = projects[index].members.findIndex(m => m.userId === userId);
    
    projects[index].members[memberIndex].role = 'teacher';
    
    projects[index].logs.push({
        time: new Date().toLocaleString(),
        userId: currentUser.id,
        username: currentUser.username,
        content: `将 ${projects[index].members[memberIndex].username} 提升为老师`
    });
    
    projects[index].updateTime = new Date().toLocaleString();
    localStorage.setItem('projects_pm', JSON.stringify(projects));
    
    currentProject = projects[index];
    showToast('提升成功', 'success');
    renderMemberList();
    renderLogList();
}

function removeMember(userId) {
    if (!confirm('确定要移除该成员吗？')) return;
    
    const currentUser = getCurrentUser();
    if (getUserRoleInProject(currentProject.id, currentUser.id) !== 'teacher') {
        showToast('只有老师才能进行此操作', 'error');
        return;
    }
    
    const projects = JSON.parse(localStorage.getItem('projects_pm')) || [];
    const index = projects.findIndex(p => p.id === currentProject.id);
    const member = projects[index].members.find(m => m.userId === userId);
    
    projects[index].members = projects[index].members.filter(m => m.userId !== userId);
    
    projects[index].logs.push({
        time: new Date().toLocaleString(),
        userId: currentUser.id,
        username: currentUser.username,
        content: `移除了成员 ${member.username}`
    });
    
    projects[index].updateTime = new Date().toLocaleString();
    localStorage.setItem('projects_pm', JSON.stringify(projects));
    
    currentProject = projects[index];
    showToast('移除成功', 'success');
    renderMemberList();
    renderLogList();
}

// ==================== 分组管理功能 ====================
function renderGroupList() {
    const groupList = document.getElementById('group-list');
    groupList.innerHTML = '';
    const currentUser = getCurrentUser();
    const isTeacher = getUserRoleInProject(currentProject.id, currentUser.id) === 'teacher';
    
    if (currentProject.groups.length === 0) {
        groupList.innerHTML = '<li style="text-align: center; padding: 20px; color: #909399;">暂无分组</li>';
        return;
    }
    
    currentProject.groups.forEach(group => {
        const li = document.createElement('li');
        li.className = 'group-item';
        
        let actionButtons = '';
        if (isTeacher) {
            actionButtons = `
                <button class="btn btn-sm btn-warning" onclick="editGroup(${group.id})">编辑</button>
                <button class="btn btn-sm btn-danger" onclick="deleteGroup(${group.id})">删除</button>
            `;
        }
        
        li.innerHTML = `
            <div class="group-info">
                <div class="group-name">${group.name}</div>
                <div class="group-members">成员：${group.members.join(', ') || '暂无成员'}</div>
            </div>
            <div class="group-actions">
                ${actionButtons}
            </div>
        `;
        
        groupList.appendChild(li);
    });
}

document.getElementById('add-group-btn').addEventListener('click', function() {
    const currentUser = getCurrentUser();
    if (getUserRoleInProject(currentProject.id, currentUser.id) !== 'teacher') {
        showToast('只有老师才能创建分组', 'error');
        return;
    }
    
    document.getElementById('group-modal-title').textContent = '创建分组';
    document.getElementById('group-form').reset();
    document.getElementById('group-id').value = '';
    
    const memberCheckboxes = document.getElementById('member-checkboxes');
    memberCheckboxes.innerHTML = '';
    currentProject.members.forEach(member => {
        const div = document.createElement('div');
        div.className = 'form-check';
        div.innerHTML = `
            <input type="checkbox" id="member-${member.userId}" value="${member.userId}" name="group-members">
            <label for="member-${member.userId}">${member.username}</label>
        `;
        memberCheckboxes.appendChild(div);
    });
    
    document.getElementById('group-modal').style.display = 'flex';
});

function editGroup(groupId) {
    const group = currentProject.groups.find(g => g.id === groupId);
    if (!group) return;
    
    document.getElementById('group-modal-title').textContent = '编辑分组';
    document.getElementById('group-id').value = group.id;
    document.getElementById('group-name').value = group.name;
    
    const memberCheckboxes = document.getElementById('member-checkboxes');
    memberCheckboxes.innerHTML = '';
    currentProject.members.forEach(member => {
        const div = document.createElement('div');
        div.className = 'form-check';
        const checked = group.members.includes(member.username) ? 'checked' : '';
        div.innerHTML = `
            <input type="checkbox" id="member-${member.userId}" value="${member.userId}" name="group-members" ${checked}>
            <label for="member-${member.userId}">${member.username}</label>
        `;
        memberCheckboxes.appendChild(div);
    });
    
    document.getElementById('group-modal').style.display = 'flex';
}

function saveGroup() {
    const groupId = document.getElementById('group-id').value;
    const groupName = document.getElementById('group-name').value.trim();
    
    if (!groupName) {
        showToast('请输入分组名称', 'error');
        return;
    }
    
    const selectedMembers = Array.from(document.querySelectorAll('input[name="group-members"]:checked'))
        .map(checkbox => {
            const userId = parseInt(checkbox.value);
            return currentProject.members.find(m => m.userId === userId).username;
        });
    
    const currentUser = getCurrentUser();
    const projects = JSON.parse(localStorage.getItem('projects_pm')) || [];
    const index = projects.findIndex(p => p.id === currentProject.id);
    
    if (groupId) {
        const groupIndex = projects[index].groups.findIndex(g => g.id === parseInt(groupId));
        projects[index].groups[groupIndex].name = groupName;
        projects[index].groups[groupIndex].members = selectedMembers;
        
        projects[index].logs.push({
            time: new Date().toLocaleString(),
            userId: currentUser.id,
            username: currentUser.username,
            content: `编辑了分组 ${groupName}`
        });
        
        showToast('分组更新成功', 'success');
    } else {
        const newGroup = {
            id: Date.now(),
            name: groupName,
            members: selectedMembers
        };
        
        projects[index].groups.push(newGroup);
        
        projects[index].logs.push({
            time: new Date().toLocaleString(),
            userId: currentUser.id,
            username: currentUser.username,
            content: `创建了新分组 ${groupName}`
        });
        
        showToast('分组创建成功', 'success');
    }
    
    projects[index].updateTime = new Date().toLocaleString();
    localStorage.setItem('projects_pm', JSON.stringify(projects));
    
    currentProject = projects[index];
    closeModal('group-modal');
    renderGroupList();
    renderLogList();
}

function deleteGroup(groupId) {
    if (!confirm('确定要删除这个分组吗？')) return;
    
    const currentUser = getCurrentUser();
    const projects = JSON.parse(localStorage.getItem('projects_pm')) || [];
    const index = projects.findIndex(p => p.id === currentProject.id);
    const group = projects[index].groups.find(g => g.id === groupId);
    
    projects[index].groups = projects[index].groups.filter(g => g.id !== groupId);
    
    projects[index].logs.push({
        time: new Date().toLocaleString(),
        userId: currentUser.id,
        username: currentUser.username,
        content: `删除了分组 ${group.name}`
    });
    
    projects[index].updateTime = new Date().toLocaleString();
    localStorage.setItem('projects_pm', JSON.stringify(projects));
    
    currentProject = projects[index];
    showToast('分组删除成功', 'success');
    renderGroupList();
    renderLogList();
}

// ==================== 任务管理功能 ====================
function renderTaskList() {
    const taskList = document.getElementById('task-list');
    taskList.innerHTML = '';
    const currentUser = getCurrentUser();
    const isTeacher = getUserRoleInProject(currentProject.id, currentUser.id) === 'teacher';
    
    if (currentProject.tasks.length === 0) {
        taskList.innerHTML = '<li style="text-align: center; padding: 20px; color: #909399;">暂无任务</li>';
        return;
    }
    
    currentProject.tasks.forEach(task => {
        const li = document.createElement('li');
        li.className = 'task-item';
        
        let statusClass = '';
        let statusText = '';
        switch(task.status) {
            case 'done': statusClass = 'status-done'; statusText = '已完成'; break;
            case 'doing': statusClass = 'status-doing'; statusText = '进行中'; break;
            case 'todo': statusClass = 'status-todo'; statusText = '待开始'; break;
        }
        
        let actionButtons = '';
        if (isTeacher || task.assignee === currentUser.username) {
            actionButtons = `
                <select class="task-status-select" onchange="updateTaskStatus(${task.id}, this.value)">
                    <option value="todo" ${task.status === 'todo' ? 'selected' : ''}>待开始</option>
                    <option value="doing" ${task.status === 'doing' ? 'selected' : ''}>进行中</option>
                    <option value="done" ${task.status === 'done' ? 'selected' : ''}>已完成</option>
                </select>
            `;
        }
        
        if (isTeacher) {
            actionButtons += `
                <button class="btn btn-sm btn-warning" onclick="editTask(${task.id})">编辑</button>
                <button class="btn btn-sm btn-danger" onclick="deleteTask(${task.id})">删除</button>
            `;
        }
        
        li.innerHTML = `
            <div class="task-info">
                <div class="task-name">${task.name}</div>
                <div class="task-assignee">负责人：${task.assignee}</div>
            </div>
            <div class="task-actions">
                <span class="task-status ${statusClass}">${statusText}</span>
                ${actionButtons}
            </div>
        `;
        
        taskList.appendChild(li);
    });
}

document.getElementById('add-task-btn').addEventListener('click', function() {
    const currentUser = getCurrentUser();
    if (getUserRoleInProject(currentProject.id, currentUser.id) !== 'teacher') {
        showToast('只有老师才能创建任务', 'error');
        return;
    }
    
    document.getElementById('task-modal-title').textContent = '创建任务';
    document.getElementById('task-form').reset();
    document.getElementById('task-id').value = '';
    
    const assigneeSelect = document.getElementById('task-assignee');
    assigneeSelect.innerHTML = '';
    currentProject.members.forEach(member => {
        const option = document.createElement('option');
        option.value = member.username;
        option.textContent = member.username;
        assigneeSelect.appendChild(option);
    });
    
    document.getElementById('task-modal').style.display = 'flex';
});

function editTask(taskId) {
    const task = currentProject.tasks.find(t => t.id === taskId);
    if (!task) return;
    
    document.getElementById('task-modal-title').textContent = '编辑任务';
    document.getElementById('task-id').value = task.id;
    document.getElementById('task-name').value = task.name;
    document.getElementById('task-desc').value = task.description || '';
    document.getElementById('task-assignee').value = task.assignee;
    document.getElementById('task-status').value = task.status;
    
    document.getElementById('task-modal').style.display = 'flex';
}

function saveTask() {
    const taskId = document.getElementById('task-id').value;
    const taskName = document.getElementById('task-name').value.trim();
    const taskDesc = document.getElementById('task-desc').value.trim();
    const taskAssignee = document.getElementById('task-assignee').value;
    const taskStatus = document.getElementById('task-status').value;
    
    if (!taskName) {
        showToast('请输入任务名称', 'error');
        return;
    }
    
    const currentUser = getCurrentUser();
    const projects = JSON.parse(localStorage.getItem('projects_pm')) || [];
    const index = projects.findIndex(p => p.id === currentProject.id);
    
    if (taskId) {
        const taskIndex = projects[index].tasks.findIndex(t => t.id === parseInt(taskId));
        projects[index].tasks[taskIndex].name = taskName;
        projects[index].tasks[taskIndex].description = taskDesc;
        projects[index].tasks[taskIndex].assignee = taskAssignee;
        projects[index].tasks[taskIndex].status = taskStatus;
        
        projects[index].logs.push({
            time: new Date().toLocaleString(),
            userId: currentUser.id,
            username: currentUser.username,
            content: `编辑了任务 ${taskName}`
        });
        
        showToast('任务更新成功', 'success');
    } else {
        const newTask = {
            id: Date.now(),
            name: taskName,
            description: taskDesc,
            assignee: taskAssignee,
            status: taskStatus,
            createTime: new Date().toLocaleString()
        };
        
        projects[index].tasks.push(newTask);
        
        projects[index].logs.push({
            time: new Date().toLocaleString(),
            userId: currentUser.id,
            username: currentUser.username,
            content: `创建了新任务 ${taskName}，负责人：${taskAssignee}`
        });
        
        showToast('任务创建成功', 'success');
    }
    
    projects[index].updateTime = new Date().toLocaleString();
    localStorage.setItem('projects_pm', JSON.stringify(projects));
    
    currentProject = projects[index];
    closeModal('task-modal');
    renderTaskList();
    renderLogList();
}

function updateTaskStatus(taskId, newStatus) {
    const currentUser = getCurrentUser();
    const projects = JSON.parse(localStorage.getItem('projects_pm')) || [];
    const index = projects.findIndex(p => p.id === currentProject.id);
    const taskIndex = projects[index].tasks.findIndex(t => t.id === taskId);
    const task = projects[index].tasks[taskIndex];
    
    task.status = newStatus;
    
    let statusText = '';
    switch(newStatus) {
        case 'done': statusText = '已完成'; break;
        case 'doing': statusText = '进行中'; break;
        case 'todo': statusText = '待开始'; break;
    }
    
    projects[index].logs.push({
        time: new Date().toLocaleString(),
        userId: currentUser.id,
        username: currentUser.username,
        content: `将任务 ${task.name} 状态更新为 ${statusText}`
    });
    
    projects[index].updateTime = new Date().toLocaleString();
    localStorage.setItem('projects_pm', JSON.stringify(projects));
    
    currentProject = projects[index];
    showToast('任务状态更新成功', 'success');
    renderLogList();
}

function deleteTask(taskId) {
    if (!confirm('确定要删除这个任务吗？')) return;
    
    const currentUser = getCurrentUser();
    const projects = JSON.parse(localStorage.getItem('projects_pm')) || [];
    const index = projects.findIndex(p => p.id === currentProject.id);
    const task = projects[index].tasks.find(t => t.id === taskId);
    
    projects[index].tasks = projects[index].tasks.filter(t => t.id !== taskId);
    
    projects[index].logs.push({
        time: new Date().toLocaleString(),
        userId: currentUser.id,
        username: currentUser.username,
        content: `删除了任务 ${task.name}`
    });
    
    projects[index].updateTime = new Date().toLocaleString();
    localStorage.setItem('projects_pm', JSON.stringify(projects));
    
    currentProject = projects[index];
    showToast('任务删除成功', 'success');
    renderTaskList();
    renderLogList();
}

// ==================== 进度日志功能 ====================
function renderLogList() {
    const logList = document.getElementById('log-list');
    logList.innerHTML = '';
    
    const sortedLogs = [...currentProject.logs].reverse();
    
    sortedLogs.forEach(log => {
        const li = document.createElement('li');
        li.className = 'log-item';
        li.innerHTML = `
            <div class="log-time">${log.time} - ${log.username}</div>
            <div class="log-content">${log.content}</div>
        `;
        logList.appendChild(li);
    });
}

// ==================== 评分功能 ====================
function initScoreSection() {
    const currentUser = getCurrentUser();
    const scoreSection = document.getElementById('score-section');
    
    if (getUserRoleInProject(currentProject.id, currentUser.id) !== 'teacher') {
        scoreSection.style.display = 'none';
        return;
    }
    
    if (currentProject.score) {
        document.getElementById('project-score-input').value = currentProject.score;
        document.getElementById('project-comment').value = currentProject.comment;
    }
}

document.getElementById('score-form').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const score = parseInt(document.getElementById('project-score-input').value);
    const comment = document.getElementById('project-comment').value.trim();
    
    if (!score || score < 0 || score > 100) {
        showToast('请输入0-100之间的有效评分', 'error');
        return;
    }
    
    const currentUser = getCurrentUser();
    const projects = JSON.parse(localStorage.getItem('projects_pm')) || [];
    const index = projects.findIndex(p => p.id === currentProject.id);
    
    projects[index].score = score;
    projects[index].comment = comment;
    projects[index].updateTime = new Date().toLocaleString();
    
    projects[index].logs.push({
        time: new Date().toLocaleString(),
        userId: currentUser.id,
        username: currentUser.username,
        content: `给出评分：${score}分，评语：${comment}`
    });
    
    localStorage.setItem('projects_pm', JSON.stringify(projects));
    
    currentProject = projects[index];
    showToast('评分提交成功', 'success');
    renderLogList();
    // 更新页面上的评分显示
    document.getElementById('project-score').textContent = `${score}分`;
});

// ==================== 通用工具函数 ====================
function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

window.onbeforeunload = function() {
    if (countdownTimer) {
        clearInterval(countdownTimer);
    }
};