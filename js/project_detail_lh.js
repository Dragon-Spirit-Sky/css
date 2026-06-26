let currentProject = null;
let countdownTimer = null;

document.addEventListener('DOMContentLoaded', async function() {
    initLocalStorage();
    initHeader();
    checkLogin();
    showPageLoader('加载班级详情...');

    var urlParams = new URLSearchParams(window.location.search);
    var projectId = urlParams.get('id');

    if (!projectId) {
        showToast('班级ID不存在', 'error');
        window.location.href = 'index_lh.html';
        return;
    }

    await loadProjectDetail(projectId);
    initInviteSection();
    bindEvents();
    hidePageLoader();
});

// 数据变更同步刷新（从Bmob重新加载）
window.addEventListener('refreshProject', async function() {
    if (!currentProject) return;
    await loadProjectDetail(currentProject.objectId);
});

async function loadProjectDetail(id) {
    var project = await fetchProjectById(id);

    if (!project) {
        showToast('班级不存在', 'error');
        window.location.href = 'index_lh.html';
        return;
    }
    
    currentProject = project;

    if (!currentProject.groups) currentProject.groups = [];
    currentProject.groups.forEach(function(g) { if (!g.ratingAssignments) g.ratingAssignments = null; });
    if (!currentProject.displayGroupId && currentProject.displayGroupId !== 0) currentProject.displayGroupId = null;
    if (currentProject.showFinished === undefined) currentProject.showFinished = false;

    document.getElementById('project-name').textContent = currentProject.name;
    var creator = (currentProject.members || []).find(function(m) { return m.userId == currentProject.creatorId; });
    document.getElementById('project-creator').textContent = (creator && creator.username) || '未知';
    document.getElementById('project-createtime').textContent = currentProject.createTime;
    document.getElementById('project-member-count').textContent = currentProject.members.length;

    renderMemberList();
    renderGroupList();
    updateDisplayArea();
    renderMyGroupRatings();

    var dashLink = document.getElementById('dashboard-link');
    if (dashLink) dashLink.href = 'dashboard_lh.html?id=' + currentProject.objectId;

    var currentUser = getCurrentUser();
    var role = await getUserRoleInProject(currentProject.objectId, currentUser.objectId || currentUser.id);
    var ratingsLink = document.getElementById('member-ratings-link');
    if (ratingsLink && role === 'teacher') {
        ratingsLink.style.display = 'inline-block';
    }
    var manageBtn = document.getElementById('manage-class-btn');
    if (manageBtn && role === 'teacher') {
        manageBtn.style.display = 'inline-block';
        manageBtn.onclick = openManageClassModal;
    }
}

function bindEvents() {
    document.getElementById('add-group-btn').addEventListener('click', openAddGroupModal);
    document.getElementById('edit-name-btn').addEventListener('click', openEditNameModal);
    document.getElementById('end-display-btn').addEventListener('click', endCurrentDisplay);
}

// ==================== Bmob云端同步（🔒 防覆盖版本） ====================
async function syncCurrentProject() {
    if (!currentProject || !currentProject.objectId) {
        console.error('❌ syncCurrentProject: 缺少项目ID');
        throw new Error('项目数据不完整：缺少objectId');
    }
    
    // 传递当前版本号（如果有）
    var localVersion = currentProject.dataVersion || 0;  // ✅ 修复：使用dataVersion
    
    console.log('📤 开始安全同步（版本:', localVersion, '）:', {
        objectId: currentProject.objectId,
        projectName: currentProject.name,
        membersCount: (currentProject.members || []).length,
        groupsCount: (currentProject.groups || []).length,
        totalRatings: countTotalRatings(),
        updateTime: currentProject.updateTime
    });
    
    var projectData = {
        dataVersion: localVersion,  // ✅ 修复：传递版本号用于冲突检测
        name: currentProject.name,
        members: currentProject.members,
        groups: currentProject.groups,
        inviteCode: currentProject.inviteCode,
        inviteExpireTime: currentProject.inviteExpireTime || '',
        displayGroupId: currentProject.displayGroupId || '',
        showFinished: currentProject.showFinished,
        logs: currentProject.logs,
        updateTime: currentProject.updateTime
    };
    
    try {
        var result = await updateProjectToCloud(currentProject.objectId, projectData);
        
        if (result.merged) {
            console.log('🔄 检测到数据已合并（防止了数据丢失）');
            showToast('⚠️ 检测到其他人的更新，已自动合并', 'warning', 3000);
            
            // 重要：重新加载合并后的数据到内存！
            await loadProjectDetail(currentProject.objectId);
        } else {
            // 更新本地版本号
            currentProject.dataVersion = result.version;  // ✅ 修复：更新dataVersion
            console.log('✅ 同步成功，新版本:', result.version);
        }
        
        return result;
        
    } catch (error) {
        console.error('❌ 项目同步失败:', error);
        throw error;
    }
}

function countTotalRatings() {
    var total = 0;
    (currentProject.groups || []).forEach(function(group) {
        if (group.memberRatings) {
            total += group.memberRatings.length;
        }
    });
    return total;
}
function openEditNameModal() {
    var currentUser = getCurrentUser();
    var userId = currentUser.objectId || currentUser.id;
    var members = currentProject.members || [];
    var me = members.find(function(m) { return m.userId == userId; });
    if (!me || me.role !== 'teacher') {
        showToast('只有老师才能修改班级名称', 'error');
        return;
    }
    document.getElementById('new-project-name').value = currentProject.name;
    document.getElementById('edit-name-modal').style.display = 'flex';
}

async function saveProjectName() {
    var newName = document.getElementById('new-project-name').value.trim();
    if (!newName) { showToast('请输入班级名称', 'error'); return; }
    var currentUser = getCurrentUser();
    var userId = currentUser.objectId || currentUser.id;
    currentProject.name = newName;
    currentProject.updateTime = new Date().toLocaleString();
    currentProject.logs.push({
        time: new Date().toLocaleString(), userId: userId,
        username: currentUser.username, content: '将班级名称修改为：' + newName
    });
    await syncCurrentProject();
    document.getElementById('project-name').textContent = newName;
    closeModal('edit-name-modal');
    showToast('班级名称修改成功', 'success');
}

// ==================== 邀请码（保持不变） ====================
function bindGenerateCodeButton() {
    const btn = document.getElementById('generate-code-btn');
    if (btn) btn.addEventListener('click', generateNewInviteCode);
}

function initInviteSection() {
    var currentUser = getCurrentUser();
    var isTeacher = false;
    var members = currentProject.members || [];
    var me = members.find(function(m) { return m.userId == (currentUser.objectId || currentUser.id); });
    if (me && me.role === 'teacher') isTeacher = true;
    
    var inviteSection = document.getElementById('invite-section');
    if (!isTeacher) { inviteSection.style.display = 'none'; return; }
    bindGenerateCodeButton();
    updateInviteCodeDisplay();
    countdownTimer = setInterval(updateInviteCodeDisplay, 1000);
}

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
        expireDisplay.textContent = '剩余 ' + remainSeconds + ' 秒过期';
        generateBtn.textContent = '📨 重新生成邀请码';
    } else {
        codeDisplay.textContent = '暂无邀请码';
        expireDisplay.textContent = '';
        generateBtn.textContent = '📨 生成5分钟有效邀请码';
    }
}

async function generateNewInviteCode() {
    var currentUser = getCurrentUser();
    var members = currentProject.members || [];
    var me = members.find(function(m) { return m.userId == (currentUser.objectId || currentUser.id); });
    if (!me || me.role !== 'teacher') {
        showToast('只有老师才能生成邀请码', 'error');
        return;
    }
    var newCode = generateInviteCode();
    var expireTime = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    var userId = currentUser.objectId || currentUser.id;
    currentProject.inviteCode = newCode;
    currentProject.inviteExpireTime = expireTime;
    currentProject.logs.push({
        time: new Date().toLocaleString(), userId: userId,
        username: currentUser.username, content: '生成了新的邀请码：' + newCode
    });
    currentProject.updateTime = new Date().toLocaleString();
    await syncCurrentProject();
    showToast('邀请码生成成功：' + newCode + '，5分钟内有效', 'success');
    updateInviteCodeDisplay();
}

// ==================== 成员列表 ====================
function renderMemberList() {
    const memberList = document.getElementById('member-list');
    memberList.innerHTML = '';

    currentProject.members.forEach(member => {
        const div = document.createElement('div');
        div.style.cssText = 'padding: 8px 12px; background: rgba(255, 255, 255, 0.1); border-radius: 8px; display: flex; align-items: center; gap: 8px; font-size: 14px;';

        let roleBadge = '';
        if (member.role === 'teacher') {
            roleBadge = '<span class="badge badge-teacher">老师</span>';
        } else {
            roleBadge = '<span class="badge badge-member">学生</span>';
        }

        div.innerHTML = '<span>' + member.username + '</span>' + roleBadge;
        memberList.appendChild(div);
    });
}

// ==================== 小组管理 ====================
function renderGroupList() {
    var groupList = document.getElementById('group-list');
    groupList.innerHTML = '';

    if (currentProject.groups.length === 0) {
        groupList.innerHTML = '<div style="text-align: center; padding: 30px; color: white;">暂无小组，请点击"创建小组"</div>';
        return;
    }

    var currentUser = getCurrentUser();
    var userId = currentUser.objectId || currentUser.id;
    var members = currentProject.members || [];
    var me = members.find(function(m) { return m.userId == userId; });
    var isTeacher = me && me.role === 'teacher';
    var myGroup = findUserGroup(userId);

    currentProject.groups.forEach(function(group) {
        if (!group.votes) group.votes = [];
        if (!group.memberRatings) group.memberRatings = [];
        var isDisplaying = currentProject.displayGroupId === group.id;
        var isMyGroup = myGroup && myGroup.id === group.id;
        var namePrefix = isMyGroup ? '⭐ ' : '';
        var finalizedTag = group.finalized ? '<span style="color:#66bb6a;font-size:12px;margin-left:6px;">已结算</span>' : '';

        var div = document.createElement('div');
        div.className = 'group-list-item card-enter' + (isDisplaying ? ' displaying' : '');

        var actionsHtml = '';
        if (isTeacher) {
            if (!isDisplaying) {
                actionsHtml += '<button class="layui-btn layui-btn-xs" style="color: #06b6d4 !important; text-shadow: 0 0 6px rgba(0,0,0,0.8), 0 0 14px rgba(0,0,0,0.5);" onclick="setDisplayGroup(' + group.id + ')">🔍 设为展示</button>';
            }
            actionsHtml += '<button class="layui-btn layui-btn-xs layui-btn-warm" style="color: #f59e0b !important; text-shadow: 0 0 6px rgba(0,0,0,0.8), 0 0 14px rgba(0,0,0,0.5);" onclick="editGroup(' + group.id + ')">✏️ 编辑</button>';
            actionsHtml += '<button class="layui-btn layui-btn-xs layui-btn-danger" style="text-shadow: 0 0 6px rgba(0,0,0,0.8), 0 0 14px rgba(0,0,0,0.5);" onclick="deleteGroup(' + group.id + ')">🗑️ 删除</button>';
        } else if (isMyGroup) {
            actionsHtml += '<button class="layui-btn layui-btn-xs" style="color: #f59e0b !important;" onclick="editGroupName(' + group.id + ')">✏️ 编辑</button>';
        }

        var voteStats = getGroupVoteStats(group);
        var myVote = group.votes.find(function(v) { return v.userId == userId; });
        var hasVoted = !!myVote;
        var hasVotedAnywhere = currentProject.groups.some(function(g) {
            return g.votes && g.votes.some(function(v) { return v.userId == userId; });
        });

        var voteBarHtml = '';
        if (!isMyGroup) {
            voteBarHtml += '<div class="vote-bar">';
            voteBarHtml += '<span class="vote-count">📊 已投票：' + voteStats.count + ' 人</span>';
            if (hasVoted) {
                voteBarHtml += '<span class="voted-badge">✅ 已投票</span>';
            }
            if (isTeacher && voteStats.count > 0) {
                voteBarHtml += '<button class="vote-detail-btn" onclick="toggleVoteDetail(' + group.id + ')">查看投票详情</button>';
            }
            voteBarHtml += '<button class="layui-btn layui-btn-xs" style="margin-left:auto;" onclick="openVoteModal(' + group.id + ')"' + (hasVotedAnywhere ? ' disabled' : '') + '>' + (hasVoted ? '✅ 已投票' : (hasVotedAnywhere ? '✅ 已投票' : '🗳️ 投票')) + '</button>';
            voteBarHtml += '</div>';

            if (isTeacher) {
                voteBarHtml += '<div class="vote-detail-panel" id="vote-detail-' + group.id + '">';
                group.votes.forEach(function(v) {
                    var voterName = v.from || '未知';
                    voteBarHtml += '<div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px dashed #e0e0e0;">';
                    voteBarHtml += '<span>' + voterName + '</span>';
                    voteBarHtml += '<span style="font-weight:bold;color:#14b8a6;">已投票</span>';
                    voteBarHtml += '</div>';
                });
                voteBarHtml += '</div>';
            }
        }

        div.innerHTML = '<div class="group-header">' +
            '<span class="group-title">' + namePrefix + group.name + finalizedTag + (isMyGroup ? '<span class="my-group-badge">我的小组</span>' : '') + '</span>' +
            '<div class="group-actions">' + actionsHtml + '</div>' +
            '</div>' +
            '<div class="group-members">成员：' + (group.members.join('、') || '暂无成员') + '</div>' +
            (isDisplaying ? '<div class="group-avg-score" style="color: #ffb300;">🎤 正在展示</div>' : '') +
            voteBarHtml;

        groupList.appendChild(div);
    });

    renderMyGroupRatings();
}

function findUserGroup(userId) {
    if (!currentProject || !currentProject.groups) return null;
    for (var i = 0; i < currentProject.groups.length; i++) {
        var group = currentProject.groups[i];
        var member = currentProject.members.find(function(m) { return m.userId == userId; });
        if (member && group.members.indexOf(member.username) !== -1) {
            return group;
        }
    }
    return null;
}

function getGroupVoteStats(group) {
    if (!group.votes || group.votes.length === 0) {
        return { count: 0 };
    }
    return { count: group.votes.length };
}

function openVoteModal(groupId) {
    var group = currentProject.groups.find(function(g) { return g.id === groupId; });
    if (!group) return;
    var currentUser = getCurrentUser();
    var userId = currentUser.objectId || currentUser.id;
    var myGroup = findUserGroup(userId);
    if (myGroup && myGroup.id === groupId) {
        showToast('不能给自己的小组投票', 'warning');
        return;
    }
    var hasVoted = group.votes && group.votes.some(function(v) { return v.userId == userId; });
    if (hasVoted) {
        showToast('已投票，不可撤销', 'warning');
        return;
    }
    var hasVotedAnywhere = currentProject.groups.some(function(g) {
        return g.votes && g.votes.some(function(v) { return v.userId == userId; });
    });
    if (hasVotedAnywhere) {
        showToast('每人只能投一票，您已为其他小组投过票', 'warning');
        return;
    }
    document.getElementById('vote-group-name').textContent = group.name;
    document.getElementById('vote-score-error').textContent = '';
    window._voteGroupId = groupId;

    var confirmText = document.getElementById('vote-confirm-text');
    var confirmBtn = document.getElementById('vote-confirm-btn');
    confirmText.textContent = '确认将你的票投给该小组？';
    confirmBtn.textContent = '确认投票';
    confirmBtn.className = 'vote-btn';
    document.getElementById('vote-modal').style.display = 'flex';
}

async function submitVote() {
    var groupId = window._voteGroupId;
    if (!groupId) return;
    var currentUser = getCurrentUser();
    var userId = currentUser.objectId || currentUser.id;
    var grpIdx = currentProject.groups.findIndex(function(g) { return g.id === groupId; });
    if (!currentProject.groups[grpIdx].votes) currentProject.groups[grpIdx].votes = [];

    var myGroup = findUserGroup(userId);
    if (myGroup && myGroup.id === groupId) {
        showToast('不能给自己小组投票！', 'warning');
        return;
    }
    var existingIdx = currentProject.groups[grpIdx].votes.findIndex(function(v) { return v.userId == userId; });
    if (existingIdx !== -1) { showToast('已投票，不可撤销', 'warning'); return; }
    var hasVotedAnywhere = currentProject.groups.some(function(g) {
        return g.votes && g.votes.some(function(v) { return v.userId == userId; });
    });
    if (hasVotedAnywhere) { showToast('每人只能投一票，不可撤销', 'warning'); return; }

    var members = currentProject.members || [];
    var me = members.find(function(m) { return m.userId == userId; });
    var fromLabel = (me && me.role === 'teacher') ? '老师' : currentUser.username;
    currentProject.groups[grpIdx].votes.push({ userId: userId, from: fromLabel, time: new Date().toLocaleString() });
    currentProject.updateTime = new Date().toLocaleString();
    await syncCurrentProject();
    closeModal('vote-modal');
    renderGroupList();
    updateDisplayArea();
    showToast('投票成功！', 'success');
}

function toggleVoteDetail(groupId) {
    var panel = document.getElementById('vote-detail-' + groupId);
    if (panel) panel.classList.toggle('show');
}

function renderMyGroupRatings() {
    var card = document.getElementById('my-group-rating-card');
    var list = document.getElementById('member-rating-list');
    var nameDisplay = document.getElementById('my-group-name-display');
    var shuffleArea = document.getElementById('teacher-shuffle-area');
    var currentUser = getCurrentUser();
    var userId = currentUser.objectId || currentUser.id;
    var members = currentProject.members || [];
    var me = members.find(function(m) { return m.userId == userId; });
    var isTeacher = me && me.role === 'teacher';

    if (shuffleArea) shuffleArea.style.display = isTeacher ? 'block' : 'none';

    var myGroup = findUserGroup(userId);
    if (!myGroup) {
        nameDisplay.textContent = '';
        list.innerHTML = isTeacher ? '' : '<div style="color: #374151; text-align: center; padding: 20px; font-size: 14px;">请先加入一个小组哦</div>';
        return;
    }
    card.style.display = 'block';
    nameDisplay.textContent = '你所在的小组：' + myGroup.name;
    if (!myGroup.memberRatings) myGroup.memberRatings = [];

    var assignments = myGroup.ratingAssignments;
    if (!assignments || !assignments.shuffled) {
        list.innerHTML = '<div style="color: #f59e0b; text-align: center; padding: 15px; font-size: 14px;">⏳ 等待老师分配评价对象</div>';
        return;
    }

    var myAssignment = assignments.assignments.find(function(a) { return a.raterId == userId; });
    if (!myAssignment) {
        list.innerHTML = '<div style="color: #6b7280; text-align: center; padding: 15px;">暂无你的评价分配</div>';
        return;
    }

    list.innerHTML = '';
    myAssignment.targetIds.forEach(function(targetUserId) {
        var targetMember = currentProject.members.find(function(m) { return m.userId == targetUserId; });
        if (!targetMember) return;
        var memberName = targetMember.username;
        var myRating = myGroup.memberRatings.find(function(r) { return r.raterId == userId && r.targetUserId == targetUserId; });
        var hasRated = !!myRating;
        var div = document.createElement('div');
        div.className = 'member-rating-item';
        div.innerHTML =
            '<div class="rating-info">' +
            '<span style="font-weight:500;">' + memberName + '</span>' +
            '</div>' +
            '<button class="layui-btn layui-btn-xs" onclick="openRatingModal(\'' + targetUserId + '\')">' + (hasRated ? '修改评价' : '评价') + '</button>';
        list.appendChild(div);
    });
}

function shuffleArray(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var temp = a[i]; a[i] = a[j]; a[j] = temp;
    }
    return a;
}

async function shuffleAllRatingAssignments() {
    var currentUser = getCurrentUser();
    var userId = currentUser.objectId || currentUser.id;
    var members = currentProject.members || [];
    var me = members.find(function(m) { return m.userId == userId; });
    if (!me || me.role !== 'teacher') {
        showToast('只有老师才能执行此操作', 'error');
        return;
    }

    if (!confirm('确定要重新随机分配所有小组的评价对象吗？\n\n将会清除所有评分和分配关系。')) return;

    var groups = currentProject.groups || [];
    var shuffledCount = 0;

    groups.forEach(function(group) {
        // 评价者：本组学生成员
        var raterNames = group.members.filter(function(name) {
            var member = members.find(function(m) { return m.username === name; });
            return member && member.role !== 'teacher';
        });
        var raterIds = raterNames.map(function(name) {
            var member = members.find(function(m) { return m.username === name; });
            return member ? member.userId : null;
        }).filter(Boolean);

        // 评价对象：全班所有学生（排除老师）
        var allStudentIds = members.filter(function(m) { return m.role !== 'teacher'; }).map(function(m) { return m.userId; });

        var evalCount = {};
        allStudentIds.forEach(function(id) { evalCount[id] = 0; });

        var assignments = [];
        raterIds.forEach(function(raterId) {
            var pool = allStudentIds.filter(function(id) { return id !== raterId; });
            pool = shuffleArray(pool);
            var targets = pool.slice(0, 3);
            targets.forEach(function(t) { evalCount[t]++; });
            var raterMember = members.find(function(m) { return m.userId == raterId; });
            assignments.push({
                raterId: raterId,
                raterName: raterMember ? raterMember.username : '',
                targetIds: targets
            });
        });

        var maxIter = 300;
        while (maxIter-- > 0) {
            var over = null, under = null;
            for (var id in evalCount) {
                if (evalCount[id] > 3) over = id;
                if (evalCount[id] < 3) under = id;
            }
            if (!over || !under) break;
            var swapped = false;
            for (var i = 0; i < assignments.length; i++) {
                var a = assignments[i];
                if (a.raterId === under) continue;
                var overIdx = a.targetIds.indexOf(over);
                if (overIdx !== -1 && a.targetIds.indexOf(under) === -1) {
                    a.targetIds[overIdx] = under;
                    evalCount[over]--;
                    evalCount[under]++;
                    swapped = true;
                    break;
                }
            }
            if (!swapped) break;
        }

        group.ratingAssignments = {
            shuffled: true,
            time: new Date().toLocaleString(),
            assignments: assignments
        };
        group.memberRatings = [];
        shuffledCount++;
    });

    if (shuffledCount === 0) {
        showToast('没有足够成员的小组（每组至少需要4名学生）', 'warning');
        return;
    }

    currentProject.logs.push({
        time: new Date().toLocaleString(), userId: userId,
        username: currentUser.username,
        content: '打乱了 ' + shuffledCount + ' 个小组的评价分配'
    });
    currentProject.updateTime = new Date().toLocaleString();
    await syncCurrentProject();
    renderMyGroupRatings();
    showToast('已为 ' + shuffledCount + ' 个小组随机分配评价对象', 'success');
}

function openRatingModal(targetUserId) {
    var targetMember = currentProject.members.find(function(m) { return m.userId == targetUserId; });
    if (!targetMember) return;
    var currentUser = getCurrentUser();
    var userId = currentUser.objectId || currentUser.id;
    var myGroup = findUserGroup(userId);
    if (!myGroup) return;
    if (!myGroup.memberRatings) myGroup.memberRatings = [];
    var existing = myGroup.memberRatings.find(function(r) { return r.raterId == userId && r.targetUserId == targetUserId; });

    document.getElementById('rating-modal-title').textContent = '给 ' + targetMember.username + ' 打分';
    document.getElementById('rating-design').value = existing ? existing.designScore : '0';
    document.getElementById('rating-function').value = existing ? existing.functionScore : '0';
    document.getElementById('rating-ui').value = existing ? existing.uiScore : '0';
    window._ratingTargetUserId = targetUserId;
    document.getElementById('rating-modal').classList.add('active');
}

function closeRatingModal() {
    document.getElementById('rating-modal').classList.remove('active');
}

async function submitRating() {
    var targetUserId = window._ratingTargetUserId;
    if (!targetUserId) return;
    
    var designScore = parseFloat(document.getElementById('rating-design').value);
    var functionScore = parseFloat(document.getElementById('rating-function').value);
    var uiScore = parseFloat(document.getElementById('rating-ui').value);
    
    if (isNaN(designScore) || isNaN(functionScore) || isNaN(uiScore)) {
        showToast('⚠️ 请输入有效的数字分数', 'error');
        return;
    }

    var originalDesign = designScore;
    var originalFunction = functionScore;
    var originalUi = uiScore;

    designScore = Math.min(Math.max(0, designScore), 10);
    functionScore = Math.min(Math.max(0, functionScore), 10);
    uiScore = Math.min(Math.max(0, uiScore), 10);

    var hasAdjusted = (originalDesign !== designScore || originalFunction !== functionScore || originalUi !== uiScore);
    if (hasAdjusted) {
        document.getElementById('rating-design').value = designScore;
        document.getElementById('rating-function').value = functionScore;
        document.getElementById('rating-ui').value = uiScore;
        showToast('📊 分数已自动调整到 0-10 分范围内', 'warning');
    }
    
    var currentUser = getCurrentUser();
    var userId = currentUser.objectId || currentUser.id;
    var myGroup = findUserGroup(userId);
    if (!myGroup) { showToast('你不在任何小组中', 'error'); return; }
    
    var grpIdx = currentProject.groups.findIndex(function(g) { return g.id === myGroup.id; });
    if (grpIdx === -1) {
        showToast('❌ 未找到你的小组信息', 'error');
        return;
    }
    
    if (!currentProject.groups[grpIdx]) {
        showToast('❌ 小组数据异常', 'error');
        console.error('小组索引无效:', grpIdx, '总组数:', currentProject.groups.length);
        return;
    }
    
    if (!currentProject.groups[grpIdx].memberRatings) {
        currentProject.groups[grpIdx].memberRatings = [];
    }

    var targetMember = currentProject.members.find(function(m) { return m.userId == targetUserId; });
    var existingIdx = currentProject.groups[grpIdx].memberRatings.findIndex(function(r) {
        return r.raterId == userId && r.targetUserId == targetUserId;
    });
    
    var ratingData = {
        raterId: userId, 
        raterName: currentUser.username,
        targetUserId: targetUserId, 
        targetName: targetMember ? targetMember.username : '',
        designScore: designScore, 
        functionScore: functionScore, 
        uiScore: uiScore,
        time: new Date().toLocaleString(),
        savedToCloud: false  // 标记是否已保存到云端
    };
    
    if (existingIdx !== -1) {
        currentProject.groups[grpIdx].memberRatings[existingIdx] = ratingData;
        console.log('✏️ 更新已有评价:', ratingData.raterName, '→', ratingData.targetName);
    } else {
        currentProject.groups[grpIdx].memberRatings.push(ratingData);
        console.log('➕ 新增评价:', ratingData.raterName, '→', ratingData.targetName);
    }
    
    currentProject.updateTime = new Date().toLocaleString();
    
    var submitBtn = document.querySelector('#rating-modal .layui-btn:not(.layui-btn-primary)');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = '⏳ 保存中...';
    }
    
    try {
        console.log('🚀 开始同步到云端...');
        console.log('📦 待保存数据预览:', {
            projectId: currentProject.objectId,
            groupName: myGroup.name,
            ratingsCount: currentProject.groups[grpIdx].memberRatings.length,
            lastRating: ratingData
        });
        
        await syncCurrentProject();
        
        console.log('✅ 云端同步成功！');
        
        ratingData.savedToCloud = true;
        
        closeRatingModal();
        renderMyGroupRatings();
        showToast('✅ 评价已成功保存到云端！', 'success');
        
    } catch (error) {
        console.error('❌ 云端同步失败:', error);
        console.error('错误详情:', {
            message: error.message,
            code: error.code,
            stack: error.stack
        });
        
        var errorMsg = '💾 保存失败';
        if (error.message.includes('timeout') || error.message.includes('Timeout')) {
            errorMsg = '⏰ 网络超时，请检查网络后重试';
        } else if (error.message.includes('401') || error.message.includes('Unauthorized')) {
            errorMsg = '🔒 登录已过期，请重新登录';
        } else if (error.message.includes('403') || error.message.includes('Forbidden')) {
            errorMsg = '🚫 无权限操作，请联系老师';
        } else if (error.message.includes('Network') || error.message.includes('network')) {
            errorMsg = '🌐 网络连接失败，请检查网络';
        } else if (error.message) {
            errorMsg = '❌ 保存失败: ' + error.message;
        }
        
        showToast(errorMsg + '（数据暂存在本地）', 'error');
        
        setTimeout(function() {
            if (confirm('⚠️ 评分未能保存到云端\n\n错误信息: ' + error.message + '\n\n是否重试？')) {
                submitRating();
            }
        }, 1000);
        
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = '提交评价';
        }
    }
}

function renderMemberRating() {
    renderMyGroupRatings();
}

function openMemberRatingsModal() {
    var memberStats = {};
    currentProject.members.forEach(function(m) {
        memberStats[m.userId] = {
            name: m.username, designScores: [], functionScores: [], uiScores: [], allScores: []
        };
    });
    (currentProject.groups || []).forEach(function(g) {
        (g.memberRatings || []).forEach(function(r) {
            var stats = memberStats[r.targetUserId];
            if (!stats) return;
            stats.designScores.push(r.designScore || 0);
            stats.functionScores.push(r.functionScore || 0);
            stats.uiScores.push(r.uiScore || 0);
            stats.allScores.push(r.designScore || 0, r.functionScore || 0, r.uiScore || 0);
        });
    });
    function avg(arr) {
        if (arr.length === 0) return '-';
        return (arr.reduce(function(s, v) { return s + v; }, 0) / arr.length).toFixed(1);
    }
    var tbody = document.getElementById('member-ratings-table-body');
    tbody.innerHTML = '';
    var hasData = false;
    currentProject.members.forEach(function(m) {
        var s = memberStats[m.userId];
        if (s.allScores.length === 0) return;
        hasData = true;
        var tr = document.createElement('tr');
        tr.innerHTML =
            '<td style="padding:12px 10px;text-align:center;font-size:13px;color:#1e293b;font-weight:600;">' + m.username + '</td>' +
            '<td style="padding:12px 10px;text-align:center;font-size:13px;color:#1e3a8a;font-weight:700;">' + avg(s.allScores) + '</td>' +
            '<td style="padding:12px 10px;text-align:center;font-size:13px;color:#1e293b;font-weight:600;">' + avg(s.designScores) + '</td>' +
            '<td style="padding:12px 10px;text-align:center;font-size:13px;color:#1e293b;font-weight:600;">' + avg(s.functionScores) + '</td>' +
            '<td style="padding:12px 10px;text-align:center;font-size:13px;color:#1e293b;font-weight:600;">' + avg(s.uiScores) + '</td>' +
            '<td style="padding:12px 10px;text-align:center;"><button class="layui-btn layui-btn-xs btn-cyan" onclick="openRatingDetailModal(\'' + m.userId + '\')">查看详情</button></td>';
        tbody.appendChild(tr);
    });
    if (!hasData) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px;color:#6b7280;">📭 暂无评价数据</td></tr>';
    }

    var uncompleted = getUncompletedMembers();
    var section = document.getElementById('uncompleted-section');
    var ulist = document.getElementById('uncompleted-members-list');
    var remindBtn = document.getElementById('remind-uncompleted-btn');

    var raters = uncompleted.filter(function(u) { return u.type === 'rater'; });
    var unrateds = uncompleted.filter(function(u) { return u.type === 'unrated'; });

    if (raters.length > 0 || unrateds.length > 0) {
        section.style.display = 'block';
        ulist.innerHTML = '';

        if (raters.length > 0) {
            var rLabel = document.createElement('div');
            rLabel.style.cssText = 'font-size:13px;font-weight:600;color:#e65100;margin-bottom:6px;width:100%;';
            rLabel.textContent = '⚠️ 未完成评分：';
            ulist.appendChild(rLabel);
            raters.forEach(function(u) {
                var tag = document.createElement('span');
                tag.style.cssText = 'display:inline-block;padding:4px 12px;background:#fff3e0;color:#e65100;border-radius:12px;font-size:13px;font-weight:500;border:1px solid #ffe0b2;';
                tag.textContent = u.name + '（' + u.ratedCount + '/' + u.totalCount + '）';
                ulist.appendChild(tag);
            });
        }

        if (unrateds.length > 0) {
            var uLabel = document.createElement('div');
            uLabel.style.cssText = 'font-size:13px;font-weight:600;color:#c62828;margin-bottom:6px;width:100%;' + (raters.length > 0 ? 'margin-top:10px;' : '');
            uLabel.textContent = '🛑 尚未被评分：';
            ulist.appendChild(uLabel);
            unrateds.forEach(function(u) {
                var tag = document.createElement('span');
                tag.style.cssText = 'display:inline-block;padding:4px 12px;background:#fce4ec;color:#c62828;border-radius:12px;font-size:13px;font-weight:500;border:1px solid #f8bbd0;';
                tag.textContent = u.name;
                ulist.appendChild(tag);
            });
        }

        remindBtn.style.display = raters.length > 0 ? 'inline-block' : 'none';
        window._uncompletedMembers = raters;
    } else {
        section.style.display = 'none';
        remindBtn.style.display = 'none';
        window._uncompletedMembers = [];
    }

    document.getElementById('member-ratings-modal').style.display = 'flex';
}

function getUncompletedMembers() {
    var members = currentProject.members || [];
    var groups = currentProject.groups || [];
    var result = [];
    var ratedUserIds = {};

    groups.forEach(function(group) {
        var assignments = group.ratingAssignments;
        if (!assignments || !assignments.shuffled) return;
        var ratings = group.memberRatings || [];

        assignments.assignments.forEach(function(a) {
            var member = members.find(function(m) { return m.userId == a.raterId; });
            if (!member || member.role === 'teacher') return;
            var totalCount = a.targetIds.length;
            var ratedCount = 0;
            a.targetIds.forEach(function(tid) {
                var found = ratings.find(function(r) { return r.raterId == a.raterId && r.targetUserId == tid; });
                if (found) ratedCount++;
            });
            if (ratedCount < totalCount) {
                result.push({ userId: a.raterId, name: member.username, ratedCount: ratedCount, totalCount: totalCount, type: 'rater' });
            }

            a.targetIds.forEach(function(tid) {
                if (!ratedUserIds[tid]) ratedUserIds[tid] = true;
            });
        });

        ratings.forEach(function(r) {
            ratedUserIds[r.targetUserId] = true;
        });

        var groupStudentIds = group.members.map(function(name) {
            var m = members.find(function(mb) { return mb.username === name; });
            return m ? m.userId : null;
        }).filter(Boolean);

        groupStudentIds.forEach(function(sid) {
            var student = members.find(function(m) { return m.userId == sid; });
            if (!student || student.role === 'teacher') return;
            if (!ratedUserIds[sid]) {
                var alreadyInResult = result.some(function(r) { return r.userId === sid && r.type === 'unrated'; });
                if (!alreadyInResult) {
                    result.push({ userId: sid, name: student.username, ratedCount: 0, totalCount: 0, type: 'unrated' });
                }
            }
        });
    });

    return result;
}

async function remindUncompletedMembers() {
    var uncompleted = window._uncompletedMembers || [];
    if (uncompleted.length === 0) {
        showToast('所有成员已完成评分', 'success');
        return;
    }
    if (!confirm('确定要提醒以下 ' + uncompleted.length + ' 位成员尽快完成评分吗？\n\n' + uncompleted.map(function(u) { return u.name + '（' + u.ratedCount + '/' + u.totalCount + '）'; }).join('\n'))) return;
    var currentUser = getCurrentUser();
    var projectName = currentProject ? currentProject.name : '未知班级';
    var now = new Date().toLocaleString();
    var successCount = 0;
    for (var i = 0; i < uncompleted.length; i++) {
        try {
            var query = Bmob.Query('Messages');
            query.set('senderId', 'system');
            query.set('senderName', '系统通知');
            query.set('receiverId', uncompleted[i].userId);
            query.set('receiverName', uncompleted[i].name);
            query.set('content', '📢 ' + currentUser.username + '老师提醒你：请尽快完成「' + projectName + '」小组评价任务！当前进度 ' + uncompleted[i].ratedCount + '/' + uncompleted[i].totalCount + '，还差 ' + (uncompleted[i].totalCount - uncompleted[i].ratedCount) + ' 位同学未评价。');
            query.set('time', now);
            query.set('isRead', false);
            await query.save();
            successCount++;
        } catch (e) {}
    }
    showToast('已成功提醒 ' + successCount + ' 位成员', 'success');
}

function openRatingDetailModal(userId) {
    if (!currentProject || !currentProject.members) return;
    var member = currentProject.members.find(function(m) { return m.userId == userId; });
    var memberName = member ? member.username : '未知';
    document.getElementById('rating-detail-title').textContent = '📋 ' + memberName + ' 的评价详情';
    var allRatings = [];
    (currentProject.groups || []).forEach(function(g) {
        (g.memberRatings || []).forEach(function(r) {
            if (r.targetUserId == userId) allRatings.push(r);
        });
    });
    function avg(arr) {
        if (arr.length === 0) return '-';
        return (arr.reduce(function(s, v) { return s + v; }, 0) / arr.length).toFixed(1);
    }
    var ds = allRatings.map(function(r) { return r.designScore || 0; });
    var fs = allRatings.map(function(r) { return r.functionScore || 0; });
    var us = allRatings.map(function(r) { return r.uiScore || 0; });
    var allNum = ds.concat(fs).concat(us);
    document.getElementById('stat-total').textContent = avg(allNum);
    document.getElementById('stat-design').textContent = avg(ds);
    document.getElementById('stat-function').textContent = avg(fs);
    document.getElementById('stat-ui').textContent = avg(us);
    var tbody = document.getElementById('rating-detail-table-body');
    if (allRatings.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:30px;color:#6b7280;">📭 暂无评分记录</td></tr>';
    } else {
        tbody.innerHTML = '';
        allRatings.forEach(function(r) {
            var tr = document.createElement('tr');
            tr.innerHTML =
                '<td style="padding:10px 8px;text-align:center;font-size:13px;color:#1e293b;font-weight:600;">' + (r.raterName || '未知') + '</td>' +
                '<td style="padding:10px 8px;text-align:center;font-size:13px;color:#1e293b;font-weight:600;">' + (r.designScore != null ? r.designScore : '-') + '</td>' +
                '<td style="padding:10px 8px;text-align:center;font-size:13px;color:#1e293b;font-weight:600;">' + (r.functionScore != null ? r.functionScore : '-') + '</td>' +
                '<td style="padding:10px 8px;text-align:center;font-size:13px;color:#1e293b;font-weight:600;">' + (r.uiScore != null ? r.uiScore : '-') + '</td>' +
                '<td style="padding:10px 8px;text-align:center;font-size:12px;color:#6b7280;">' + (r.time || '-') + '</td>';
            tbody.appendChild(tr);
        });
    }
    document.getElementById('rating-detail-modal').style.display = 'flex';
}

// ==================== 展示模式 ====================
async function setDisplayGroup(groupId) {
    var currentUser = getCurrentUser();
    var userId = currentUser.objectId || currentUser.id;
    var members = currentProject.members || [];
    var me = members.find(function(m) { return m.userId == userId; });
    if (!me || me.role !== 'teacher') {
        showToast('只有老师才能设置展示小组', 'error');
        return;
    }
    if (currentProject.showFinished) {
        showToast('展示已结束，请先结束展示结果', 'warning');
        return;
    }

    currentProject.displayGroupId = groupId;
    currentProject.logs.push({
        time: new Date().toLocaleString(), userId: userId,
        username: currentUser.username,
        content: '设置当前展示小组：' + (currentProject.groups.find(function(g) { return g.id === groupId; }) || {}).name || ''
    });
    currentProject.updateTime = new Date().toLocaleString();
    try {
        await syncCurrentProject();
    } catch (e) {
        console.error('同步展示状态失败:', e);
    }
    updateDisplayArea();
    renderGroupList();
    showToast('已设置当前展示小组', 'success');
}

function updateDisplayArea() {
    var displayArea = document.getElementById('current-display-area');
    var teacherEndArea = document.getElementById('teacher-end-area');
    var voteStatus = document.getElementById('vote-status');
    var displayGroupId = currentProject.displayGroupId;
    var currentUser = getCurrentUser();
    var userId = currentUser.objectId || currentUser.id;
    var members = currentProject.members || [];
    var me = members.find(function(m) { return m.userId == userId; });
    var isTeacher = me && me.role === 'teacher';
    if (!displayGroupId) {
        displayArea.innerHTML = '<div class="display-icon">📊</div><div style="color: #6b7280;">暂无正在展示的小组</div>';
        teacherEndArea.style.display = 'none';
        voteStatus.textContent = '';
        return;
    }
    var group = currentProject.groups.find(g => g.id === displayGroupId);
    if (!group) {
        displayArea.innerHTML = '<div class="display-icon">📊</div><div style="color: #6b7280;">暂无正在展示的小组</div>';
        teacherEndArea.style.display = 'none';
        voteStatus.textContent = '';
        return;
    }
    var voteCount = group.votes ? group.votes.length : 0;
    if (group.image) {
        displayArea.innerHTML = '<div class="display-image"><img src="' + group.image + '" alt="' + group.name + '"></div><div class="display-group-name">' + group.name + '</div>';
    } else {
        displayArea.innerHTML = '<div class="display-icon">🎤</div><div class="display-group-name">' + group.name + '</div>';
    }
    teacherEndArea.style.display = isTeacher ? 'block' : 'none';
    renderVoteStatus(group);
}

function renderVoteStatus(group) {
    var div = document.getElementById('vote-status');
    if (!group.votes || group.votes.length === 0) { div.textContent = '尚未有人投票'; return; }
    var currentUser = getCurrentUser();
    var userId = currentUser.objectId || currentUser.id;
    var members = currentProject.members || [];
    var me = members.find(function(m) { return m.userId == userId; });
    var isTeacher = me && me.role === 'teacher';
    if (isTeacher) {
        var votedNames = group.votes.map(function(s) { return s.from; });
        div.textContent = '已投票：' + votedNames.join('、') + '（' + group.votes.length + '人）';
    } else {
        div.textContent = '已投票：' + group.votes.length + ' 人';
    }
}

// 获取用户头像HTML
function getUserAvatarHtml(userId) {
    var currentUser = getCurrentUser();
    var user = (currentUser && (currentUser.objectId || currentUser.id) == userId) ? currentUser : null;
    if (!user) return '<span class="mini-avatar" style="background: #bdbdbd;">?</span>';
    if (user.avatar && user.avatar.customImage) {
        return '<span class="mini-avatar" style="background-image: url(' + user.avatar.customImage + ');"></span>';
    }
    if (user.avatar && user.avatar.emoji) {
        return '<span class="mini-avatar" style="background: ' + user.avatar.color + ';">' + user.avatar.emoji + '</span>';
    }
    var name = user.username || '';
    var hash = 0;
    for (var i = 0; i < name.length; i++) { hash = ((hash << 5) - hash) + name.charCodeAt(i); hash |= 0; }
    var avatars = [{ emoji: '😀', color: '#667eea' },{ emoji: '🦊', color: '#ff9800' },{ emoji: '🐱', color: '#4caf50' },{ emoji: '🐶', color: '#2196f3' },{ emoji: '🐼', color: '#9c27b0' },{ emoji: '🦁', color: '#f44336' },{ emoji: '🐰', color: '#e91e63' },{ emoji: '🐮', color: '#00bcd4' },{ emoji: '🐸', color: '#8bc34a' },{ emoji: '🐵', color: '#795548' },{ emoji: '🐯', color: '#ff5722' },{ emoji: '🐨', color: '#607d8b' }];
    var avatar = avatars[Math.abs(hash) % avatars.length];
    return '<span class="mini-avatar" style="background:' + avatar.color + ';">' + avatar.emoji + '</span>';
}

// ==================== 展示结束 ====================
async function endCurrentDisplay() {
    var displayGroupId = currentProject.displayGroupId;
    if (!displayGroupId) { showToast('当前没有正在展示的小组', 'error'); return; }
    currentProject.displayGroupId = null;
    currentProject.updateTime = new Date().toLocaleString();
    try {
        await syncCurrentProject();
    } catch (e) {
        console.error('结束展示同步失败:', e);
    }
    updateDisplayArea();
    renderGroupList();
    showToast('已结束当前展示', 'info');
}

// ==================== 编辑小组时显示投票详情 ====================
function renderEditScoreDetail(group) {
    var section = document.getElementById('edit-score-section');
    var list = document.getElementById('edit-score-list');

    if (!group.votes || group.votes.length === 0) {
        section.style.display = 'block';
        list.innerHTML = '<div style="color: #6b7280; text-align: center; padding: 10px;">暂无投票记录</div>';
        return;
    }

    section.style.display = 'block';

    var html = '';
    group.votes.forEach(function(v) {
        html += '<div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px dashed #e0e0e0;">' +
            '<span style="font-weight: 500;">' + v.from + '</span>' +
            '<span style="font-weight: bold; color: #14b8a6;">已投票</span>' +
            '</div>';
    });

    html += '<div style="margin-top: 10px; padding-top: 8px; border-top: 2px solid #14b8a6; text-align: right; font-weight: bold; color: #374151;">' +
        '当前投票数：' + group.votes.length + ' 票</div>';

    list.innerHTML = html;
}

// ==================== 重置单个小组投票 ====================
async function resetGroupScores() {
    var groupId = parseInt(document.getElementById('group-id').value);
    if (!confirm('确定要重置该小组的全部投票吗？所有成员需要重新投票。')) return;
    var currentUser = getCurrentUser();
    var userId = currentUser.objectId || currentUser.id;
    var groupIndex = currentProject.groups.findIndex(function(g) { return g.id === groupId; });
    var groupName = currentProject.groups[groupIndex].name;
    currentProject.groups[groupIndex].votes = [];
    currentProject.groups[groupIndex].finalized = false;
    currentProject.groups[groupIndex].finalizedVotes = null;
    currentProject.logs.push({
        time: new Date().toLocaleString(), userId: userId,
        username: currentUser.username, content: '重置了小组 ' + groupName + ' 的全部投票'
    });
    currentProject.updateTime = new Date().toLocaleString();
    await syncCurrentProject();
    var group = currentProject.groups.find(function(g) { return g.id === groupId; });
    if (group) renderEditScoreDetail(group);
    renderGroupList();
    updateDisplayArea();
    showToast(groupName + ' 的投票已重置，请重新投票', 'success');
}

// ==================== 小组CRUD ====================
var groupImageData = '';

function previewGroupImage(input) {
    var file = input.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { showToast('图片不能超过2MB', 'error'); input.value = ''; return; }
    var reader = new FileReader();
    reader.onload = function(e) {
        var img = new Image();
        img.onload = function() {
            var canvas = document.createElement('canvas');
            var maxW = 400;
            var quality = 0.5;
            var scale = Math.min(1, maxW / img.width);
            canvas.width = img.width * scale;
            canvas.height = img.height * scale;
            var ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            groupImageData = canvas.toDataURL('image/jpeg', quality);
            while (groupImageData.length > 40960 && quality > 0.1) {
                quality -= 0.1;
                groupImageData = canvas.toDataURL('image/jpeg', quality);
            }
            if (groupImageData.length > 40960) {
                var smallerScale = Math.min(1, 300 / img.width);
                canvas.width = img.width * smallerScale;
                canvas.height = img.height * smallerScale;
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                groupImageData = canvas.toDataURL('image/jpeg', 0.3);
            }
            if (groupImageData.length > 40960) {
                showToast('图片过大，请换一张小一点的图片', 'error');
                return;
            }
            document.getElementById('group-image-preview-img').src = groupImageData;
            document.getElementById('group-image-preview').style.display = 'block';
            document.getElementById('group-image-remove-btn').style.display = '';
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function removeGroupImage() {
    groupImageData = '';
    document.getElementById('group-image-input').value = '';
    document.getElementById('group-image-preview').style.display = 'none';
    document.getElementById('group-image-remove-btn').style.display = 'none';
}

function openAddGroupModal() {
    var currentUser = getCurrentUser();
    var userId = currentUser.objectId || currentUser.id;
    var members = currentProject.members || [];
    var me = members.find(function(m) { return m.userId == userId; });
    if (!me || me.role !== 'teacher') {
        showToast('只有老师才能创建小组', 'error');
        return;
    }

    document.getElementById('group-modal-title').textContent = '创建小组';
    document.getElementById('group-form').reset();
    document.getElementById('group-id').value = '';
    document.getElementById('edit-score-section').style.display = 'none';
    removeGroupImage();

    var memberCheckboxes = document.getElementById('member-checkboxes');
    memberCheckboxes.innerHTML = '';

    // 收集已在其他小组的成员
    var groupedNames = {};
    (currentProject.groups || []).forEach(function(g) {
        (g.members || []).forEach(function(name) { groupedNames[name] = true; });
    });

    // 排序：未分组在前，已分组在后
    var sortedMembers = currentProject.members.slice().sort(function(a, b) {
        var aIn = groupedNames[a.username] ? 1 : 0;
        var bIn = groupedNames[b.username] ? 1 : 0;
        return aIn - bIn;
    });

    sortedMembers.forEach(member => {
        var isGrouped = groupedNames[member.username];
        const div = document.createElement('div');
        div.className = 'form-check member-check-item';
        div.style.marginBottom = '8px';
        div.innerHTML = `
            <input type="checkbox" id="member-${member.userId}" value="${member.userId}" name="group-members" ${isGrouped ? 'disabled' : ''}>
            <label for="member-${member.userId}" style="${isGrouped ? 'color: #9ca3af;' : ''}">${member.username}${isGrouped ? '（已加入其他小组）' : ''}（${member.role === 'teacher' ? '老师' : '学生'}）</label>
        `;
        memberCheckboxes.appendChild(div);
    });

    // 搜索过滤
    var searchInput = document.getElementById('member-search-input');
    searchInput.value = '';
    searchInput.oninput = function() {
        var keyword = this.value.trim().toLowerCase();
        var items = memberCheckboxes.querySelectorAll('.member-check-item');
        items.forEach(function(item) {
            var label = item.querySelector('label').textContent.toLowerCase();
            item.style.display = keyword === '' || label.indexOf(keyword) !== -1 ? '' : 'none';
        });
    };

    document.getElementById('group-modal').style.display = 'flex';
}

function editGroupName(groupId) {
    var group = currentProject.groups.find(function(g) { return g.id === groupId; });
    if (!group) return;
    var currentUser = getCurrentUser();
    var myGroup = findUserGroup(currentUser.objectId || currentUser.id);
    if (!myGroup || myGroup.id !== groupId) {
        showToast('只能编辑自己的小组', 'error');
        return;
    }

    document.getElementById('group-modal-title').textContent = '编辑小组名称';
    document.getElementById('group-id').value = group.id;
    document.getElementById('group-name').value = group.name;
    document.getElementById('member-checkboxes').parentElement.style.display = 'none';
    document.getElementById('edit-score-section').style.display = 'none';
    if (group.image) {
        groupImageData = group.image;
        document.getElementById('group-image-preview-img').src = group.image;
        document.getElementById('group-image-preview').style.display = 'block';
        document.getElementById('group-image-remove-btn').style.display = '';
    } else {
        removeGroupImage();
    }
    window._isStudentEdit = true;
    document.getElementById('group-modal').style.display = 'flex';
}

function editGroup(groupId) {
    const group = currentProject.groups.find(g => g.id === groupId);
    if (!group) return;

    document.getElementById('group-modal-title').textContent = '编辑小组';
    document.getElementById('group-id').value = group.id;
    document.getElementById('group-name').value = group.name;

    const memberCheckboxes = document.getElementById('member-checkboxes');
    memberCheckboxes.innerHTML = '';

    // 收集已在其他小组的成员（排除当前小组）
    var groupedNames = {};
    (currentProject.groups || []).forEach(function(g) {
        if (g.id === groupId) return;
        (g.members || []).forEach(function(name) { groupedNames[name] = true; });
    });

    // 排序：未分组在前，已分组在后
    var sortedMembers = currentProject.members.slice().sort(function(a, b) {
        var aIn = groupedNames[a.username] ? 1 : 0;
        var bIn = groupedNames[b.username] ? 1 : 0;
        return aIn - bIn;
    });

    sortedMembers.forEach(member => {
        var isGrouped = groupedNames[member.username];
        const div = document.createElement('div');
        div.className = 'form-check member-check-item';
        div.style.marginBottom = '8px';
        const checked = group.members.includes(member.username) ? 'checked' : '';
        div.innerHTML = `
            <input type="checkbox" id="member-${member.userId}" value="${member.userId}" name="group-members" ${checked} ${isGrouped ? 'disabled' : ''}>
            <label for="member-${member.userId}" style="${isGrouped ? 'color: #9ca3af;' : ''}">${member.username}${isGrouped ? '（已加入其他小组）' : ''}（${member.role === 'teacher' ? '老师' : '学生'}）</label>
        `;
        memberCheckboxes.appendChild(div);
    });

    // 搜索过滤
    var searchInput = document.getElementById('member-search-input');
    searchInput.value = '';
    searchInput.oninput = function() {
        var keyword = this.value.trim().toLowerCase();
        var items = memberCheckboxes.querySelectorAll('.member-check-item');
        items.forEach(function(item) {
            var label = item.querySelector('label').textContent.toLowerCase();
            item.style.display = keyword === '' || label.indexOf(keyword) !== -1 ? '' : 'none';
        });
    };

    renderEditScoreDetail(group);

    if (group.image) {
        groupImageData = group.image;
        document.getElementById('group-image-preview-img').src = group.image;
        document.getElementById('group-image-preview').style.display = 'block';
        document.getElementById('group-image-remove-btn').style.display = '';
    } else {
        removeGroupImage();
    }

    document.getElementById('group-modal').style.display = 'flex';
}

async function saveGroup() {
    var groupId = document.getElementById('group-id').value;
    var groupName = document.getElementById('group-name').value.trim();
    var isStudentEdit = window._isStudentEdit;
    window._isStudentEdit = false;
    var currentUser = getCurrentUser();
    var userId = currentUser.objectId || currentUser.id;

    if (!groupName) { showToast('请输入小组实训名称', 'error'); return; }

    if (isStudentEdit) {
        var gIdx = currentProject.groups.findIndex(function(g) { return g.id === parseInt(groupId); });
        currentProject.groups[gIdx].name = groupName;
        currentProject.groups[gIdx].image = groupImageData || '';
        currentProject.updateTime = new Date().toLocaleString();
        currentProject.logs.push({
            time: new Date().toLocaleString(), userId: userId,
            username: currentUser.username, content: '修改了小组名称：' + groupName
        });
        await syncCurrentProject();
        closeModal('group-modal');
        document.getElementById('member-checkboxes').parentElement.style.display = '';
        renderGroupList();
        updateDisplayArea();
        showToast('小组名称已更新', 'success');
        return;
    }

    var selectedMembers = Array.from(document.querySelectorAll('input[name="group-members"]:checked'))
        .map(function(checkbox) {
            var cbUserId = checkbox.value;
            var member = currentProject.members.find(function(m) { return m.userId == cbUserId; });
            return member ? member.username : '';
        }).filter(function(name) { return name; });

    if (selectedMembers.length === 0) { showToast('请至少选择一位成员', 'error'); return; }

    if (groupId) {
        var groupIndex = currentProject.groups.findIndex(function(g) { return g.id === parseInt(groupId); });
        var oldVotes = currentProject.groups[groupIndex].votes || [];
        var oldMemberRatings = currentProject.groups[groupIndex].memberRatings || [];
        var oldMembers = currentProject.groups[groupIndex].members || [];
        var membersChanged = oldMembers.sort().join(',') !== selectedMembers.sort().join(',');
        currentProject.groups[groupIndex].name = groupName;
        currentProject.groups[groupIndex].members = selectedMembers;
        currentProject.groups[groupIndex].votes = oldVotes;
        currentProject.groups[groupIndex].memberRatings = oldMemberRatings;
        currentProject.groups[groupIndex].image = groupImageData || '';
        if (membersChanged) currentProject.groups[groupIndex].ratingAssignments = null;
        currentProject.logs.push({
            time: new Date().toLocaleString(), userId: userId,
            username: currentUser.username, content: '编辑了小组：' + groupName
        });
        showToast('小组更新成功', 'success');
    } else {
        currentProject.groups.push({
            id: Date.now(), name: groupName, members: selectedMembers, votes: [], ratingAssignments: null, image: groupImageData || ''
        });
        currentProject.logs.push({
            time: new Date().toLocaleString(), userId: userId,
            username: currentUser.username, content: '创建了新小组：' + groupName
        });
        showToast('小组创建成功', 'success');
    }

    currentProject.updateTime = new Date().toLocaleString();
    try {
        await syncCurrentProject();
        closeModal('group-modal');
        renderGroupList();
    } catch (e) {
        console.error('保存小组失败:', e);
        showToast('保存失败：' + (e.message || e.error || '未知错误'), 'error');
    }
}

async function deleteGroup(groupId) {
    if (!confirm('确定要删除这个小组吗？')) return;
    var currentUser = getCurrentUser();
    var userId = currentUser.objectId || currentUser.id;
    var group = currentProject.groups.find(function(g) { return g.id === groupId; });
    if (currentProject.displayGroupId === groupId) {
        currentProject.displayGroupId = null;
    }
    currentProject.groups = currentProject.groups.filter(function(g) { return g.id !== groupId; });
    currentProject.logs.push({
        time: new Date().toLocaleString(), userId: userId,
        username: currentUser.username, content: '删除了小组：' + group.name
    });
    currentProject.updateTime = new Date().toLocaleString();
    await syncCurrentProject();
    showToast('小组删除成功', 'success');
    updateDisplayArea();
    renderGroupList();
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
    if (modalId === 'group-modal') {
        var cb = document.getElementById('member-checkboxes');
        if (cb && cb.parentElement) cb.parentElement.style.display = '';
        window._isStudentEdit = false;
        removeGroupImage();
    }
}

// ==================== 管理班级成员 ====================
function openManageClassModal() {
    var members = currentProject.members || [];
    document.getElementById('manage-member-count').textContent = members.length;
    var list = document.getElementById('manage-member-list');
    list.innerHTML = '';

    members.forEach(function(member) {
        var div = document.createElement('div');
        div.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border-bottom:1px solid rgba(148,163,184,0.15);font-size:14px;';
        var roleLabel = member.role === 'teacher' ? '<span style="color:#f59e0b;font-weight:600;">老师</span>' : '<span style="color:#6b7280;">学生</span>';
        div.innerHTML =
            '<span>' + member.username + ' ' + roleLabel + '</span>' +
            (member.role !== 'teacher'
                ? '<button class="layui-btn layui-btn-xs layui-btn-danger" onclick="removeStudentFromClass(\'' + member.userId + '\')">移除</button>'
                : '<span style="font-size:12px;color:#6b7280;">不可移除</span>');
        list.appendChild(div);
    });

    document.getElementById('manage-class-modal').style.display = 'flex';
}

async function removeStudentFromClass(userId) {
    var member = currentProject.members.find(function(m) { return m.userId == userId; });
    if (!member) return;
    if (!confirm('确定要从班级中移除 ' + member.username + ' 吗？')) return;

    currentProject.members = currentProject.members.filter(function(m) { return m.userId != userId; });
    currentProject.groups.forEach(function(g) {
        g.members = g.members.filter(function(name) { return name !== member.username; });
        g.votes = (g.votes || []).filter(function(v) { return v.userId != userId; });
    });

    var currentUser = getCurrentUser();
    currentProject.logs.push({
        time: new Date().toLocaleString(),
        userId: currentUser.objectId || currentUser.id,
        username: currentUser.username,
        content: '从班级移除了学生：' + member.username
    });
    currentProject.updateTime = new Date().toLocaleString();
    await syncCurrentProject();
    renderMemberList();
    renderGroupList();
    openManageClassModal();
    showToast('已移除 ' + member.username, 'success');
}

async function addStudentToClass() {
    var username = document.getElementById('add-student-input').value.trim();
    if (!username) { showToast('请输入学生用户名', 'error'); return; }

    var alreadyIn = currentProject.members.some(function(m) { return m.username === username; });
    if (alreadyIn) { showToast('该学生已在班级中', 'info'); return; }

    try {
        var query = Bmob.Query('Users');
        query.equalTo('username', '==', username);
        var users = await query.find();
        if (users.length === 0) { showToast('未找到用户：' + username, 'error'); return; }

        var user = users[0];
        currentProject.members.push({
            userId: user.objectId,
            username: user.username,
            role: 'member',
            joinTime: new Date().toLocaleString()
        });

        var currentUser = getCurrentUser();
        currentProject.logs.push({
            time: new Date().toLocaleString(),
            userId: currentUser.objectId || currentUser.id,
            username: currentUser.username,
            content: '手动添加了学生：' + user.username
        });
        currentProject.updateTime = new Date().toLocaleString();
        await syncCurrentProject();
        document.getElementById('add-student-input').value = '';
        renderMemberList();
        renderGroupList();
        openManageClassModal();
        showToast('已添加 ' + user.username, 'success');
    } catch (e) {
        console.error('添加学生失败:', e);
        showToast('添加失败：' + (e.message || e.error || JSON.stringify(e)), 'error');
    }
}

window.onbeforeunload = function() {
    if (countdownTimer) clearInterval(countdownTimer);
};