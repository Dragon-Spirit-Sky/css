window.onload = function() {
    initLocalStorage();
    initHeader();
    checkLogin();
    renderProjectTable();
    initAddProjectButton();
};

// 初始化新增项目按钮
function initAddProjectButton() {
    const currentUser = getCurrentUser();
    // 只有组长和老师可以新增项目
    if (currentUser.role === 'student') {
        document.getElementById('add-project-btn').style.display = 'none';
    }
}

// 渲染项目表格
function renderProjectTable() {
    const projects = JSON.parse(localStorage.getItem('projects_pm'));
    const tbody = document.getElementById('project-table-body');
    tbody.innerHTML = '';
    
    projects.forEach(project => {
        const tr = document.createElement('tr');
        
        // 进度条样式
        let progressColor = '#67c23a';
        if (project.progress < 30) progressColor = '#f56c6c';
        else if (project.progress < 60) progressColor = '#e6a23c';
        
        tr.innerHTML = `
            <td>${project.id}</td>
            <td>${project.name}</td>
            <td>${project.groupName}</td>
            <td>${project.leader}</td>
            <td>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div style="width: 100px; height: 8px; background-color: #ebeef5; border-radius: 4px; overflow: hidden;">
                        <div style="width: ${project.progress}%; height: 100%; background-color: ${progressColor};"></div>
                    </div>
                    <span>${project.progress}%</span>
                </div>
            </td>
            <td>${project.score ? project.score : '未评分'}</td>
            <td>
                <div class="action-buttons">
                    <a href="project_detail_pm.html?id=${project.id}" class="btn btn-primary btn-sm">查看</a>
                    <button class="btn btn-warning btn-sm" onclick="editProject(${project.id})">编辑</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteProject(${project.id})">删除</button>
                </div>
            </td>
        `;
        
        tbody.appendChild(tr);
    });
}

// 打开新增项目弹窗
document.getElementById('add-project-btn').addEventListener('click', function() {
    document.getElementById('modal-title').textContent = '新增项目';
    document.getElementById('project-form').reset();
    document.getElementById('project-id').value = '';
    
    // 自动填充当前用户的小组和姓名（如果是组长）
    const currentUser = getCurrentUser();
    if (currentUser.role === 'leader') {
        document.getElementById('project-group').value = currentUser.groupName;
        document.getElementById('project-leader').value = currentUser.username;
    }
    
    document.getElementById('project-modal').style.display = 'flex';
});

// 编辑项目
function editProject(id) {
    const projects = JSON.parse(localStorage.getItem('projects_pm'));
    const project = projects.find(p => p.id === id);
    
    if (!project) {
        showToast('项目不存在', 'error');
        return;
    }
    
    document.getElementById('modal-title').textContent = '编辑项目';
    document.getElementById('project-id').value = project.id;
    document.getElementById('project-name').value = project.name;
    document.getElementById('project-group').value = project.groupName;
    document.getElementById('project-leader').value = project.leader;
    document.getElementById('project-progress').value = project.progress;
    document.getElementById('project-members').value = project.members.join(',');
    
    document.getElementById('project-modal').style.display = 'flex';
}

// 保存项目
function saveProject() {
    const id = document.getElementById('project-id').value;
    const name = document.getElementById('project-name').value.trim();
    const groupName = document.getElementById('project-group').value.trim();
    const leader = document.getElementById('project-leader').value.trim();
    const progress = parseInt(document.getElementById('project-progress').value) || 0;
    const members = document.getElementById('project-members').value.split(',').map(m => m.trim()).filter(m => m);
    
    if (!name || !groupName || !leader) {
        showToast('请填写完整信息', 'error');
        return;
    }
    
    const projects = JSON.parse(localStorage.getItem('projects_pm'));
    
    if (id) {
        // 编辑现有项目
        const index = projects.findIndex(p => p.id === parseInt(id));
        projects[index].name = name;
        projects[index].groupName = groupName;
        projects[index].leader = leader;
        projects[index].progress = progress;
        projects[index].members = members;
        projects[index].updateTime = new Date().toLocaleString();
        
        // 添加进度日志
        projects[index].logs.push({
            time: new Date().toLocaleString(),
            content: `项目进度更新为 ${progress}%`
        });
        
        addLog(`编辑项目 ${name}`);
        showToast('项目更新成功', 'success');
    } else {
        // 新增项目
        const newProject = {
            id: Date.now(),
            name: name,
            groupName: groupName,
            leader: leader,
            progress: progress,
            score: null,
            comment: '',
            members: members,
            tasks: members.map(m => ({ name: '待分配任务', status: 'todo', assignee: m })),
            logs: [
                { time: new Date().toLocaleString(), content: '项目创建成功' }
            ],
            createTime: new Date().toLocaleString(),
            updateTime: new Date().toLocaleString()
        };
        
        projects.push(newProject);
        addLog(`创建新项目 ${name}`);
        showToast('项目创建成功', 'success');
    }
    
    localStorage.setItem('projects_pm', JSON.stringify(projects));
    closeModal();
    renderProjectTable();
}

// 删除项目
function deleteProject(id) {
    if (confirm('确定要删除这个项目吗？此操作不可恢复！')) {
        let projects = JSON.parse(localStorage.getItem('projects_pm'));
        const project = projects.find(p => p.id === id);
        projects = projects.filter(p => p.id !== id);
        localStorage.setItem('projects_pm', JSON.stringify(projects));
        
        addLog(`删除项目 ${project.name}`);
        showToast('项目删除成功', 'success');
        renderProjectTable();
    }
}

// 关闭弹窗
function closeModal() {
    document.getElementById('project-modal').style.display = 'none';
}