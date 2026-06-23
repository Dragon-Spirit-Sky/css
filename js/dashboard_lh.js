var currentProject = null;
var allGroups = [];
var chartInstances = [];

function loadProjectData(projectId) {
    fetchProjectById(projectId).then(function(project) {
        currentProject = project;
        if (!currentProject) {
            document.getElementById('chart-main').innerHTML = '<div class="empty-state"><div class="empty-icon">📂</div><p>班级不存在</p></div>';
            return;
        }
        allGroups = currentProject.groups || [];
        document.getElementById('page-title').textContent = '🏆 排行榜 - ' + currentProject.name;
        if (allGroups.length === 0) {
            document.getElementById('chart-main').innerHTML = '<div class="empty-state"><div class="empty-icon">📭</div><p>暂无小组数据</p></div>';
            document.getElementById('vote-list').innerHTML = '';
            return;
        }
        renderCharts();
        renderVoteList();
    });
    window.addEventListener('resize', function() {
        chartInstances.forEach(function(c) { if (c) c.resize(); });
    });
}

function getGroupVoteCount(group) {
    return group.votes ? group.votes.length : 0;
}

function renderCharts() {
    var sorted = allGroups.slice().sort(function(a, b) { return getGroupVoteCount(b) - getGroupVoteCount(a); });
    var top3 = sorted.slice(0, 3);

    var container = document.getElementById('chart-main');
    if (sorted.every(function(g) { return getGroupVoteCount(g) === 0; })) {
        container.innerHTML = '<div class="empty-state"><div class="empty-icon">🗳️</div><p>暂无投票数据，快去投票吧！</p></div>';
        return;
    }

    chartInstances.forEach(function(c) { if (c) c.dispose(); });
    chartInstances = [];

    var chart = echarts.init(container);
    chartInstances.push(chart);

    var maxVotes = getGroupVoteCount(top3[0]) || 1;

    // 重新排列：第二名在左，第一名居中，第三名在右
    var orderedNames = [];
    var orderedCounts = [];
    if (top3.length >= 2) { orderedNames.push(top3[1].name); orderedCounts.push(getGroupVoteCount(top3[1])); }
    if (top3.length >= 1) { orderedNames.push(top3[0].name); orderedCounts.push(getGroupVoteCount(top3[0])); }
    if (top3.length >= 3) { orderedNames.push(top3[2].name); orderedCounts.push(getGroupVoteCount(top3[2])); }

    // 3D领奖台：第二名(左) / 第一名(中) / 第三名(右)
    var podiumColors = [];
    if (top3.length >= 2) podiumColors.push({ front: '#b0bec5', side: '#78909c', top: '#cfd8dc' });
    if (top3.length >= 1) podiumColors.push({ front: '#ffd700', side: '#ff8f00', top: '#ffe57f' });
    if (top3.length >= 3) podiumColors.push({ front: '#ff8a65', side: '#d84315', top: '#ffab91' });
    var depth = 18;

    var option = {
        title: {
            text: '排行榜',
            left: 'center',
            top: 8,
            textStyle: { fontSize: 18, color: '#2e3a5c' }
        },
        tooltip: {
            trigger: 'item',
            formatter: function(p) {
                return orderedNames[p.dataIndex] + '<br/>获得票数：<strong>' + orderedCounts[p.dataIndex] + ' 票</strong>';
            }
        },
        grid: { left: '10%', right: '10%', bottom: '14%', top: '20%' },
        xAxis: {
            type: 'category',
            data: orderedNames,
            axisTick: { show: false },
            axisLine: { lineStyle: { color: '#e0e5ec' } },
            axisLabel: { fontSize: 13, color: '#5a6377', fontWeight: 'bold' }
        },
        yAxis: {
            type: 'value',
            name: '票数',
            min: 0,
            max: maxVotes + 3,
            minInterval: 1,
            axisLabel: { fontSize: 12, color: '#a0a8b8' },
            splitLine: { lineStyle: { color: '#f0edf5', type: 'dashed' } }
        },
        series: [{
            type: 'custom',
            renderItem: function(params, api) {
                var idx = params.dataIndex;
                var val = orderedCounts[idx];
                if (val === 0) return null;
                var c = podiumColors[idx];
                var rankTitles = [];
                if (top3.length >= 2) rankTitles.push('亚军');
                if (top3.length >= 1) rankTitles.push('冠军');
                if (top3.length >= 3) rankTitles.push('季军');
                var topCoord = api.coord([idx, val]);
                var botCoord = api.coord([idx, 0]);
                var barW = api.size([0.7, 0])[0];
                var barH = botCoord[1] - topCoord[1];
                var x = topCoord[0];
                var y = topCoord[1];
                var l = x - barW / 2;
                var r = x + barW / 2;
                var d = depth;

                return {
                    type: 'group',
                    children: [
                        { type: 'rect', shape: { x: l, y: y, width: barW, height: barH }, style: { fill: c.front } },
                        { type: 'polygon', shape: { points: [[r, y], [r + d, y - d], [r + d, y + barH - d], [r, y + barH]] }, style: { fill: c.side } },
                        { type: 'polygon', shape: { points: [[l, y], [l + d, y - d], [r + d, y - d], [r, y]] }, style: { fill: c.top } },
                        { type: 'text', style: { text: rankTitles[idx], fill: '#fff', font: 'bold 18px sans-serif', textAlign: 'center', textVerticalAlign: 'middle' }, position: [x, y + barH / 2] },
                        { type: 'text', style: { text: val + '票', fill: '#2e3a5c', font: 'bold 14px sans-serif', textAlign: 'center', textVerticalAlign: 'middle' }, position: [x + d / 2, y - d / 2] }
                    ]
                };
            },
            data: orderedCounts
        }]
    };
    chart.setOption(option);
}

function renderVoteList() {
    var container = document.getElementById('vote-list');
    var sorted = allGroups.slice().sort(function(a, b) { return getGroupVoteCount(b) - getGroupVoteCount(a); });
    var maxVotes = sorted.length > 0 ? getGroupVoteCount(sorted[0]) : 1;

    var currentUser = getCurrentUser();
    var userId = currentUser ? (currentUser.objectId || currentUser.id) : null;
    var html = '<div class="vote-grid">';

    sorted.forEach(function(group, idx) {
        var voteCount = getGroupVoteCount(group);
        var rankClass = idx === 0 ? 'gold' : idx === 1 ? 'silver' : idx === 2 ? 'bronze' : 'normal';
        var rankIcon = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : (idx + 1);
        var hasVoted = currentUser && group.votes && group.votes.some(function(v) { return v.userId == userId; });
        var isMyGroup = currentUser && group.members.indexOf(currentUser.username) !== -1;
        var hasVotedAnywhere = currentUser && allGroups.some(function(g) {
            return g.votes && g.votes.some(function(v) { return v.userId == userId; });
        });

        html += '<div class="vote-card">';
        html += '<div class="vote-card-header">';
        html += '<div class="vote-card-rank ' + rankClass + '">' + rankIcon + '</div>';
        html += '<div class="vote-card-name" title="' + group.name + '">' + (isMyGroup ? '⭐ ' : '') + group.name + '</div>';
        html += '</div>';
        html += '<div class="vote-card-image">';
        if (group.image) {
            html += '<img src="' + group.image + '" alt="' + group.name + '">';
        } else {
            html += '<span class="no-image">🖼️</span>';
        }
        html += '</div>';
        html += '<div class="vote-card-footer">';
        html += '<span class="vote-card-members" title="' + group.members.join('、') + '">成员：' + group.members.join('、') + '</span>';
        html += '<span class="vote-card-votes">' + voteCount + ' 票</span>';
        if (isMyGroup) {
            html += '<span style="color:#909399;font-size:12px;white-space:nowrap;">我的小组</span>';
        } else {
            html += '<button class="vote-btn-mini' + (hasVoted ? ' voted' : '') + '" onclick="quickVote(' + group.id + ')"' + (hasVotedAnywhere ? ' disabled' : '') + '>' + (hasVoted ? '✓ 已投票' : (hasVotedAnywhere ? '✓ 已投票' : '🗳 投票')) + '</button>';
        }
        html += '</div>';
        html += '</div>';
    });

    html += '</div>';

    container.innerHTML = html;
}

async function quickVote(groupId) {
    var currentUser = getCurrentUser();
    if (!currentUser) { showToast('请先登录', 'error'); return; }
    var userId = currentUser.objectId || currentUser.id;

    var group = currentProject.groups.find(function(g) { return g.id === groupId; });
    var myGroup = currentProject.groups.find(function(g) {
        return g.members.indexOf(currentUser.username) !== -1;
    });
    if (myGroup && myGroup.id === groupId) {
        showToast('不能给自己小组投票！', 'warning');
        return;
    }
    if (!group.votes) group.votes = [];
    var existingIdx = group.votes.findIndex(function(v) { return v.userId == userId; });
    if (existingIdx !== -1) { showToast('已投票，不可撤销', 'warning'); return; }
    var hasVotedAnywhere = currentProject.groups.some(function(g) {
        return g.votes && g.votes.some(function(v) { return v.userId == userId; });
    });
    if (hasVotedAnywhere) { showToast('每人只能投一票，不可撤销', 'warning'); return; }

    var members = currentProject.members || [];
    var me = members.find(function(m) { return m.userId == userId; });
    var fromLabel = (me && me.role === 'teacher') ? '老师' : currentUser.username;
    group.votes.push({ userId: userId, from: fromLabel, time: new Date().toLocaleString() });
    currentProject.updateTime = new Date().toLocaleString();
    await updateProjectToCloud(currentProject.objectId, {
        groups: currentProject.groups,
        updateTime: currentProject.updateTime
    });
    allGroups = currentProject.groups;
    renderCharts();
    renderVoteList();
    showToast('投票成功！', 'success');
}

document.addEventListener('DOMContentLoaded', async function() {
    initLocalStorage();
    initHeader();
    checkLogin();
    showPageLoader('加载排行榜...');

    var urlParams = new URLSearchParams(window.location.search);
    var projectId = urlParams.get('id');

    if (!projectId) {
        document.getElementById('page-title').textContent = '🏆 排行榜';
        document.getElementById('chart-main').innerHTML = '<div class="empty-state"><div class="empty-icon">📂</div><p>请从班级详情页进入</p></div>';
        hidePageLoader();
        return;
    }

    loadProjectData(projectId);
    hidePageLoader();

    var backBtn = document.getElementById('back-to-detail');
    if (backBtn) {
        backBtn.href = 'project_detail_lh.html?id=' + projectId;
    }
});

// 数据刷新（Bmob云端无需跨标签页同步）