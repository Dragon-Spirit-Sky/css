
// 班级列表页面逻辑
document.addEventListener('DOMContentLoaded', async function() {
    initLocalStorage();
    initHeader();
    checkLogin();
    showPageLoader('加载班级列表...');
    await renderProjectTable();
    hidePageLoader();
    
    document.getElementById('add-project-btn').addEventListener('click', function() {
        document.getElementById('create-name').value = '';
        document.getElementById('create-desc').value = '';
        document.getElementById('create-name-error').textContent = '';
        document.getElementById('create-modal').style.display = 'flex';
    });
});

function closeCreateModal() {
    document.getElementById('create-modal').style.display = 'none';
}

async function createProject() {
    try {
    var name = document.getElementById('create-name').value.trim();
    var desc = document.getElementById('create-desc').value.trim();
    
    if (!name) {
        document.getElementById('create-name-error').textContent = '请输入班级名称';
        return;
    }
    
    var currentUser = getCurrentUser();
    if (!currentUser) {
        showToast('登录已过期，请重新登录', 'error');
        return;
    }
    var userId = currentUser.objectId || currentUser.id;
    
    var newProject = {
        id: Date.now(),
        name: name,
        description: desc,
        inviteCode: null,
        inviteExpireTime: null,
        creatorId: userId,
        members: [{
            userId: userId,
            username: currentUser.username,
            role: 'teacher',
            joinTime: new Date().toLocaleString()
        }],
        groups: [],
        displayGroupId: null,
        showFinished: false,
        logs: [{
            time: new Date().toLocaleString(),
            userId: userId,
            username: currentUser.username,
            content: '班级创建成功'
        }],
        createTime: new Date().toLocaleString(),
        updateTime: new Date().toLocaleString()
    };
    
        await saveProjectToCloud(newProject);
        closeCreateModal();
        showToast('班级创建成功', 'success');
        await renderProjectTable();
    } catch (e) {
        console.error('创建班级失败:', e);
        showToast('创建失败：' + (e.message || e.error || '未知错误'), 'error');
    }
}

// 渲染班级表格
async function renderProjectTable() {
    var projects = await fetchAllProjects();
    var tbody = document.getElementById('project-table-body');
    tbody.innerHTML = '';
    
    if (projects.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6"><div class="table-empty"><div class="empty-icon">📂</div><p style="color:#909399;margin-top:12px;">暂无班级数据，点击右上角"新增班级"创建</p></div></td></tr>';
        return;
    }

    projects.forEach(function(project, idx) {
        var createUser = project.members.find(function(m) { return m.userId == project.creatorId; });
        var teacherCount = project.members.filter(function(m) { return m.role === 'teacher'; }).length;
        var studentCount = project.members.filter(function(m) { return m.role !== 'teacher'; }).length;
        var groupCount = project.groups ? project.groups.length : 0;
        

        var tr = document.createElement('tr');
        tr.className = 'card-enter';
        tr.style.animationDelay = (idx * 0.05) + 's';
        tr.innerHTML = '<td><strong>' + project.name + '</strong></td>' +
            '<td>' + (createUser ? createUser.username : '未知') + '</td>' +
            '<td>' + project.members.length + '（老师' + teacherCount + '，学生' + studentCount + '）</td>' +
            '<td>' + groupCount + '</td>' +
            '<td>' + project.createTime + '</td>' +
            '<td><div class="action-buttons">' +
            '<a href="project_detail_lh.html?id=' + project.objectId + '" class="layui-btn layui-btn-xs btn-custom btn-primary-custom">查看</a>' +
            '<button class="layui-btn layui-btn-xs btn-custom btn-danger-custom" onclick="deleteProject(\'' + project.objectId + '\')">删除</button>' +
            '</div></td>';
        tbody.appendChild(tr);
    });
}

// 删除班级
async function deleteProject(objectId) {
    var currentUser = getCurrentUser();
    var userId = currentUser.objectId || currentUser.id;
    var projects = await fetchAllProjects();
    var project = projects.find(function(p) { return p.objectId === objectId; });

    if (!project) {
        showToast('班级不存在', 'error');
        return;
    }

    var role = await getUserRoleInProject(objectId, userId);
    if (project.creatorId != userId && role !== 'teacher') {
        showToast('只有老师才能删除班级', 'error');
        return;
    }

    if (!confirm('确定要删除班级"' + project.name + '"吗？\n此操作不可恢复！')) {
        return;
    }
    await deleteProjectFromCloud(objectId);
    showToast('班级删除成功', 'success');
    await renderProjectTable();
}