window.onload = function() {
    initLocalStorage();
    initHeader();
    const currentUser = checkLogin();
    
    if (currentUser) {
        renderUserInfo(currentUser);
        renderTaskChart();
        renderRecordList(currentUser);
    }
};

// 渲染用户基本信息
function renderUserInfo(user) {
    // 头像显示用户名第一个字
    document.getElementById('user-avatar').textContent = user.username.charAt(0).toUpperCase();
    document.getElementById('user-username').textContent = user.username;
    
    let roleText = '';
    switch(user.role) {
        case 'student': roleText = '学生'; break;
        case 'leader': roleText = '组长'; break;
        case 'teacher': roleText = '老师'; break;
    }
    document.getElementById('user-role').textContent = roleText;
    document.getElementById('user-group').textContent = user.groupName || '无';
    document.getElementById('user-email').textContent = user.email;
    document.getElementById('user-createtime').textContent = user.createTime;
}

// 渲染个人任务完成趋势图表
function renderTaskChart() {
    // 模拟最近7天的任务完成数据
    const days = [];
    const completedTasks = [];
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        days.push(`${date.getMonth()+1}/${date.getDate()}`);
        completedTasks.push(Math.floor(Math.random() * 5) + 1);
    }
    
    const chart = echarts.init(document.getElementById('task-chart'));
    const option = {
        tooltip: {
            trigger: 'axis'
        },
        xAxis: {
            type: 'category',
            data: days
        },
        yAxis: {
            type: 'value',
            name: '完成任务数'
        },
        series: [
            {
                data: completedTasks,
                type: 'bar',
                barWidth: '60%',
                itemStyle: {
                    color: '#667eea',
                    borderRadius: [4, 4, 0, 0]
                },
                label: {
                    show: true,
                    position: 'top'
                }
            }
        ]
    };
    chart.setOption(option);
    window.addEventListener('resize', () => chart.resize());
}

// 渲染操作记录列表
function renderRecordList(user) {
    const logs = JSON.parse(localStorage.getItem('logs_pm'));
    // 只显示当前用户的操作记录
    const userLogs = logs.filter(log => log.userId === user.id).slice(0, 20); // 显示最近20条
    
    const recordList = document.getElementById('record-list');
    recordList.innerHTML = '';
    
    if (userLogs.length === 0) {
        recordList.innerHTML = '<li style="text-align: center; padding: 20px; color: #909399;">暂无操作记录</li>';
        return;
    }
    
    userLogs.forEach(log => {
        const li = document.createElement('li');
        li.className = 'record-item';
        li.innerHTML = `
            <div class="record-time">${log.time}</div>
            <div>${log.content}</div>
        `;
        recordList.appendChild(li);
    });
}