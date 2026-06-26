// 显示提示消息
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(function() {
        toast.classList.add('removing');
        setTimeout(function() { toast.remove(); }, 300);
    }, 2800);
}

// 页面加载器
function showPageLoader(text) {
    var loader = document.getElementById('page-loader');
    if (!loader) {
        loader = document.createElement('div');
        loader.id = 'page-loader';
        loader.className = 'page-loader';
        loader.innerHTML = '<div class="loader-spinner"></div><div class="loader-text">' + (text || '加载中...') + '</div>';
        document.body.appendChild(loader);
    } else {
        loader.querySelector('.loader-text').textContent = text || '加载中...';
        loader.classList.remove('hidden');
    }
}
function hidePageLoader() {
    var loader = document.getElementById('page-loader');
    if (loader) {
        loader.classList.add('hidden');
        setTimeout(function() { if (loader.parentNode) loader.remove(); }, 400);
    }
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

// 检查登录状态 (门禁函数)
function checkLogin() {
    const currentUser = getCurrentUser();
    if (!currentUser) {
        // 如果没登录，踢回登录页
        window.location.href = 'login_lh.html';
        return null;
    }
    return currentUser;
}

// 获取当前登录用户 (必须从 sessionStorage 读)
function getCurrentUser() {
    const userStr = sessionStorage.getItem('currentUser_lh');
    if (userStr) {
        return JSON.parse(userStr);
    }
    return null;
}

// 退出登录 (清理 sessionStorage)
function logout() {
    sessionStorage.removeItem('currentUser_lh');
    localStorage.removeItem('rememberedUser_lh');
    window.location.href = 'login_lh.html';
}

// 初始化头部导航（登录后才显示）
// 初始化头部导航（登录后才显示）- 增加空值检查版
function initHeader() {
    const currentUser = getCurrentUser();
    const header = document.getElementById('header');
    const userInfoDiv = document.getElementById('user-info');
    
    // 关键：如果页面没有header元素，直接返回不执行
    if (!header) {
        return;
    }
    
    if (!currentUser) {
        header.style.display = 'none';
        return;
    }
    
    header.style.display = 'flex';

    if (userInfoDiv) {
        userInfoDiv.innerHTML = `
            <span class="user-badge">欢迎你，${currentUser.username}</span>
            <span class="nav-divider"></span>
            <a href="user_detail_lh.html" class="layui-btn layui-btn-sm">个人中心</a>
            <button class="layui-btn layui-btn-sm layui-btn-danger" onclick="logout()">退出</button>
        `;
        if (!document.getElementById('msg-icon')) {
            var msgIcon = document.createElement('span');
            msgIcon.id = 'msg-icon';
            msgIcon.className = 'msg-icon-wrap';
            msgIcon.title = '站内信';
            msgIcon.innerHTML = '🔔<span class="msg-badge" id="msg-badge">0</span>';
            msgIcon.onclick = toggleMessageCenter;
            userInfoDiv.insertBefore(msgIcon, userInfoDiv.firstChild);
        }
    }
    updateUnreadBadge();

    if (!document.getElementById('chat-overlay')) {
        var overlay = document.createElement('div');
        overlay.id = 'chat-overlay';
        overlay.className = 'chat-overlay';
        overlay.innerHTML =
            '<div class="chat-card">' +
                '<div class="chat-card-header">' +
                    '<span>📬 站内信</span>' +
                    '<span class="chat-card-close" onclick="closeChatModal()">&times;</span>' +
                '</div>' +
                '<div class="chat-container">' +
                    '<div class="chat-sidebar">' +
                        '<div class="sidebar-header">' +
                            '<button class="new-chat-btn" onclick="openSearchModal()">+ 创建</button>' +
                        '</div>' +
                        '<div class="contact-list" id="contact-list">' +
                            '<div class="chat-empty" style="font-size:13px;padding:40px 0;">暂无联系人</div>' +
                        '</div>' +
                    '</div>' +
                    '<div class="chat-main" id="chat-main">' +
                        '<div class="chat-empty" id="chat-empty">👈 选择一个联系人开始聊天</div>' +
                        '<div class="chat-header" id="chat-header" style="display:none;"></div>' +
                        '<div class="chat-messages" id="chat-messages" style="display:none;"></div>' +
                        '<div class="chat-input-area" id="chat-input-area" style="display:none;">' +
                            '<input type="text" class="chat-input" id="chat-input" placeholder="输入消息…" maxlength="500" onkeydown="if(event.key===\'Enter\')sendChatMsg()">' +
                            '<button class="chat-send-btn" onclick="sendChatMsg()">➤</button>' +
                        '</div>' +
                    '</div>' +
                '</div>' +
            '</div>';
        overlay.onclick = function(e) { if (e.target === overlay) closeChatModal(); };
        document.body.appendChild(overlay);
    }
}

// 初始化本地存储数据（Bmob云端，无需初始化）
function initLocalStorage() {
    // 数据已迁移至Bmob云端，无需localStorage初始化
}

// 获取用户参与的所有班级（从Bmob云端）
async function getUserProjects(userId) {
    try {
        const query = Bmob.Query('Projects');
        const res = await query.find();
        return res.filter(p => p.members && p.members.some(m => m.userId == userId));
    } catch (e) {
        console.error('获取班级列表失败:', e);
        return [];
    }
}

async function getUserRoleInProject(projectId, userId) {
    try {
        const query = Bmob.Query('Projects');
        const res = await query.get(projectId);
        if (!res || !res.members) return null;
        const member = res.members.find(m => m.userId == userId);
        return member ? member.role : null;
    } catch (e) {
        console.error('获取角色失败:', e);
        return null;
    }
}

// ========== Bmob 云端CRUD辅助函数 ==========

// 保存项目到云端（新建）
async function saveProjectToCloud(project) {
    const query = Bmob.Query('Projects');
    query.set('name', project.name);
    query.set('description', project.description || '');
    query.set('creatorId', project.creatorId);
    query.set('createTime', project.createTime);
    query.set('updateTime', project.updateTime);
    query.set('members', project.members);
    query.set('groups', project.groups || []);
    query.set('inviteCode', project.inviteCode || '');
    query.set('inviteExpireTime', project.inviteExpireTime || '');
    query.set('displayGroupId', project.displayGroupId || '');
    query.set('showFinished', project.showFinished || false);
    query.set('logs', project.logs || []);
    const res = await query.save();
    return res.objectId;
}

// 更新项目到云端（🔒 防覆盖版本：带版本控制+智能合并）
async function updateProjectToCloud(objectId, projectData) {
    if (!objectId) {
        console.error('❌ updateProjectToCloud: objectId 为空');
        throw new Error('项目ID不能为空');
    }
    
    if (!projectData || typeof projectData !== 'object') {
        console.error('❌ updateProjectToCloud: projectData 无效', projectData);
        throw new Error('项目数据无效');
    }
    
    console.log('🔒 开始安全同步（防覆盖模式）:', {
        objectId: objectId,
        keys: Object.keys(projectData),
        dataSize: JSON.stringify(projectData).length + ' bytes',
        localVersion: projectData.dataVersion || '未设置'
    });
    
    try {
        // 步骤1: 先获取云端最新数据（防止覆盖）
        console.log('📥 步骤1: 获取云端最新数据...');
        const cloudQuery = Bmob.Query('Projects');
        const cloudData = await cloudQuery.get(objectId);
        
        if (!cloudData) {
            throw new Error('云端项目不存在，可能已被删除');
        }
        
        console.log('✅ 云端数据获取成功:', {
            cloudVersion: cloudData.dataVersion || '无版本号',
            cloudUpdate: cloudData.updateTime,
            hasGroups: !!(cloudData.groups && cloudData.groups.length > 0)
        });
        
        // 步骤2: 版本冲突检测
        var localVersion = projectData.dataVersion || 0;
        var cloudVersion = cloudData.dataVersion || 0;
        
        if (localVersion && cloudVersion && localVersion < cloudVersion) {
            console.warn('⚠️ 检测到版本冲突！', {
                localVersion: localVersion,
                cloudVersion: cloudVersion,
                message: '云端已被其他人更新'
            });
            console.log('🔄 开始智能合并...');
            
            // 步骤3: 智能合并数据（关键！）
            var mergedData = mergeProjectData(cloudData, projectData);
            
            console.log('🔄 数据合并完成:', {
                mergedRatingsCount: countTotalRatingsInData(mergedData.groups),
                cloudRatingsCount: countTotalRatingsInData(cloudData.groups),
                localRatingsCount: countTotalRatingsInData(projectData.groups)
            });
            
            // 使用合并后的数据
            projectData = mergedData;
        } else {
            // 没有冲突，正常更新
            console.log('✅ 无版本冲突，直接更新');
        }
        
        // 步骤4: 更新版本号
        var newVersion = Math.max(localVersion, cloudVersion) + 1;
        projectData.dataVersion = newVersion;  // ✅ 修复：不用_开头
        projectData.lastSyncTime = new Date().toISOString();  // ✅ 修复：不用_开头
        
        console.log('📤 步骤4: 准备保存（版本:', newVersion, ')');
        
        // 统计评价记录
        if (projectData.groups) {
            var totalRatings = 0;
            projectData.groups.forEach(function(group, idx) {
                if (group.memberRatings) {
                    totalRatings += group.memberRatings.length;
                    console.log(`  📁 小组${idx + 1}: ${group.memberRatings.length} 条评价`);
                }
            });
            console.log(`📊 总计保存: ${totalRatings} 条评价记录`);
        }
        
        // 步骤5: 执行保存
        const saveQuery = Bmob.Query('Projects');
        saveQuery.set('id', objectId);
        
        for (var key in projectData) {
            if (projectData.hasOwnProperty(key)) {
                var value = projectData[key];
                var valueSize = JSON.stringify(value).length;
                
                if (valueSize > 100000) {
                    console.warn(`⚠️ 大字段 ${key}: ${(valueSize/1024).toFixed(1)}KB`);
                }
                
                saveQuery.set(key, value);
            }
        }
        
        console.log('⏳ 正在调用 Bmob API...');
        var startTime = Date.now();
        
        await saveQuery.save();
        
        var duration = Date.now() - startTime;
        console.log(`✅ 保存成功! 版本:${newVersion}, 耗时:${duration}ms`);
        
        return {
            success: true,
            version: newVersion,
            duration: duration,
            merged: (localVersion < cloudVersion)
        };
        
    } catch (error) {
        console.error('❌ 保存失败:', error);
        var parsedError = parseBmobError(error);
        throw new Error(parsedError.message || error.message);
    }
}

// 智能合并两个版本的项目数据（核心算法）
function mergeProjectData(cloudData, localData) {
    console.log('🔄 开始智能合并...');
    
    var merged = JSON.parse(JSON.stringify(cloudData));  // 以云端为基础
    
    // 合并基本信息（以本地为准，因为这是用户主动修改的）
    if (localData.name) merged.name = localData.name;
    if (localData.members) merged.members = localData.members;
    if (localData.inviteCode !== undefined) merged.inviteCode = localData.inviteCode;
    if (localData.inviteExpireTime !== undefined) merged.inviteExpireTime = localData.inviteExpireTime;
    if (localData.displayGroupId !== undefined) merged.displayGroupId = localData.displayGroupId;
    if (localData.showFinished !== undefined) merged.showFinished = localData.showFinished;
    if (localData.logs) merged.logs = localData.logs;
    if (localData.updateTime) merged.updateTime = localData.updateTime;
    
    // 关键：智能合并小组和评价数据（保留所有评价！）
    if (localData.groups && cloudData.groups) {
        merged.groups = mergeGroupsWithRatings(cloudData.groups, localData.groups);
    } else if (localData.groups) {
        merged.groups = localData.groups;
    }
    
    console.log('✅ 合并完成');
    return merged;
}

// 合并小组数据（特别处理评价记录，确保不丢失）
function mergeGroupsWithRatings(cloudGroups, localGroups) {
    var mergedGroups = [];
    
    // 以本地组为基础
    localGroups.forEach(function(localGroup, idx) {
        var mergedGroup = JSON.parse(JSON.stringify(localGroup));
        
        // 找到对应的云端组
        var cloudGroup = cloudGroups.find(function(g) { return g.id === localGroup.id; });
        
        if (cloudGroup) {
            // 合并评价记录（取并集，不丢失任何一条！）
            if (cloudGroup.memberRatings || localGroup.memberRatings) {
                var allRatings = {};
                
                // 先添加云端的评价
                (cloudGroup.memberRatings || []).forEach(function(rating) {
                    var key = rating.raterId + '_' + rating.targetUserId;
                    allRatings[key] = rating;
                });
                
                // 再添加/覆盖本地的评价（本地优先）
                (localGroup.memberRatings || []).forEach(function(rating) {
                    var key = rating.raterId + '_' + rating.targetUserId;
                    allRatings[key] = rating;  // 本地的会覆盖云端的（更新版本）
                });
                
                // 转换回数组
                mergedGroup.memberRatings = Object.values(allRatings);
                
                console.log(`  📁 组"${localGroup.name}" 合并评价:`, {
                    cloudCount: (cloudGroup.memberRatings || []).length,
                    localCount: (localGroup.memberRatings || []).length,
                    mergedCount: mergedGroup.memberRatings.length
                });
            }
            
            // 保留其他字段（以本地为准）
            if (localGroup.ratingAssignments) {
                mergedGroup.ratingAssignments = localGroup.ratingAssignments;
            }
        }
        
        mergedGroups.push(mergedGroup);
    });
    
    // 添加云端有但本地没有的组（防止删除）
    cloudGroups.forEach(function(cloudGroup) {
        var exists = mergedGroups.find(function(g) { return g.id === cloudGroup.id; });
        if (!exists) {
            console.log(`  ➕ 保留云端新增组: "${cloudGroup.name}"`);
            mergedGroups.push(JSON.parse(JSON.stringify(cloudGroup)));
        }
    });
    
    return mergedGroups;
}

function countTotalRatingsInData(groups) {
    if (!groups) return 0;
    var total = 0;
    groups.forEach(function(group) {
        if (group.memberRatings) {
            total += group.memberRatings.length;
        }
    });
    return total;
}

// 解析Bmob错误信息
function parseBmobError(error) {
    var result = {
        code: error.code || 'UNKNOWN',
        message: error.message || '未知错误',
        suggestion: ''
    };
    
    switch(result.code) {
        case 100:
            result.message = '无法连接到Bmob服务器';
            result.suggestion = '请检查网络连接';
            break;
        case 101:
            result.message = '对象不存在或无权限访问';
            result.suggestion = '请检查objectId是否正确，或确认登录状态';
            break;
        case 102:
            result.message = '用户名或密码错误';
            result.suggestion = '请重新登录';
            break;
        case 124:
            result.message = '请求超时';
            result.suggestion = '请检查网络后重试';
            break;
        case 137:
            result.message = '文件过大';
            result.suggestion = '项目数据超过限制，请联系管理员';
            break;
        case 139:
            result.message = 'API调用频率超限';
            result.suggestion = '请稍后再试';
            break;
        case 153:
            result.message = '权限被拒绝';
            result.suggestion = '你可能没有修改此项目的权限';
            break;
        default:
            if (error.message && error.message.includes('timeout')) {
                result.code = 'TIMEOUT';
                result.message = '网络请求超时';
                result.suggestion = '网络较慢，请重试';
            } else if (error.message && error.message.includes('Network')) {
                result.code = 'NETWORK';
                result.message = '网络连接失败';
                result.suggestion = '请检查网络设置';
            } else if (error.message && error.message.includes('401')) {
                result.code = 'UNAUTHORIZED';
                result.message = '未授权或登录过期';
                result.suggestion = '请重新登录';
            }
    }
    
    return result;
}

// ==================== 数据诊断工具（用于排查丢失问题）====================

// 检查项目数据完整性
async function diagnoseProjectData(projectId) {
    console.log('🔍 开始诊断项目数据...');
    
    try {
        var project = await fetchProjectById(projectId);
        
        if (!project) {
            console.error('❌ 项目不存在:', projectId);
            return { valid: false, error: '项目不存在' };
        }
        
        var diagnosis = {
            projectId: projectId,
            projectName: project.name,
            version: project.dataVersion || '无版本号',  // ✅ 修复
            lastUpdate: project.updateTime,
            lastSync: project.lastSyncTime || '未知',  // ✅ 修复
            timestamp: new Date().toISOString(),
            
            // 统计信息
            membersCount: (project.members || []).length,
            groupsCount: (project.groups || []).length,
            totalRatings: 0,
            ratingsByGroup: [],
            
            // 问题检测
            issues: [],
            warnings: []
        };
        
        // 检查评价数据
        (project.groups || []).forEach(function(group, idx) {
            var groupInfo = {
                groupId: group.id,
 groupName: group.name || '未命名组',
                memberCount: (group.members || []).length,
                ratingsCount: (group.memberRatings || []).length,
                hasAssignments: !!(group.ratingAssignments && group.ratingAssignments.shuffled),
                issues: []
            };
            
            diagnosis.totalRatings += groupInfo.ratingsCount;
            
            // 检查评价记录的完整性
            if (group.memberRatings && group.memberRatings.length > 0) {
                var ratingKeys = {};
                group.memberRatings.forEach(function(rating, rIdx) {
                    var key = rating.raterId + '_' + rating.targetUserId;
                    
                    // 检查重复
                    if (ratingKeys[key]) {
                        groupInfo.issues.push(`重复评价 #${rIdx}: ${rating.raterName}→${rating.targetName}`);
                        diagnosis.warnings.push(`组"${group.name}"发现重复评价`);
                    }
                    ratingKeys[key] = true;
                    
                    // 检查必填字段
                    if (!rating.raterId) groupInfo.issues.push(`评价 #${rIdx} 缺少raterId`);
                    if (!rating.targetUserId) groupInfo.issues.push(`评价 #${rIdx} 缺少targetUserId`);
                    if (rating.designScore === undefined || rating.functionScore === undefined || rating.uiScore === undefined) {
                        groupInfo.issues.push(`评价 #${rIdx} 分数不完整`);
                    }
                });
            }
            
            // 检查是否有分配但没完成的情况
            if (groupInfo.hasAssignments && group.ratingAssignments.assignments) {
                var expectedRatings = 0;
                group.ratingAssignments.assignments.forEach(function(a) {
                    expectedRatings += a.targetIds.length;
                });
                
                if (groupInfo.ratingsCount < expectedRatings) {
                    groupInfo.issues.push(`评价进度: ${groupInfo.ratingsCount}/${expectedRatings}`);
                }
            }
            
            if (groupInfo.issues.length > 0) {
                diagnosis.issues.push({
                    type: 'group',
                    groupIndex: idx,
                    groupName: group.name,
                    problems: groupInfo.issues
                });
            }
            
            diagnosis.ratingsByGroup.push(groupInfo);
        });
        
        // 总体评估
        if (diagnosis.totalRatings === 0 && diagnosis.groupsCount > 0) {
            diagnosis.warnings.push('⚠️ 所有小组都没有评价记录');
        }
        
        if (!project.dataVersion) {  // ✅ 修复
            diagnosis.warnings.push('⚠️ 项目没有版本号（可能未启用防覆盖功能）');
        }
        
        console.log('📊 诊断结果:', diagnosis);
        
        return diagnosis;
        
    } catch (error) {
        console.error('❌ 诊断失败:', error);
        return { valid: false, error: error.message };
    }
}

// 在浏览器控制台调用此函数查看详细诊断
// 用法: window.diagnoseCurrentProject()
window.diagnoseCurrentProject = async function() {
    if (typeof currentProject !== 'undefined' && currentProject && currentProject.objectId) {
        return await diagnoseProjectData(currentProject.objectId);
    } else {
        console.error('❌ 当前页面没有加载项目数据');
        return null;
    }
};

console.log('✅ 数据诊断工具已加载');
console.log('💡 使用方法: 在浏览器控制台输入 await window.diagnoseCurrentProject()');

// 从云端获取所有项目
async function fetchAllProjects() {
    try {
        const query = Bmob.Query('Projects');
        return await query.find();
    } catch (e) {
        console.error('获取项目列表失败:', e);
        return [];
    }
}

// 从云端获取单个项目
async function fetchProjectById(objectId) {
    try {
        const query = Bmob.Query('Projects');
        return await query.get(objectId);
    } catch (e) {
        console.error('获取项目失败:', e);
        return null;
    }
}

// 删除云端项目
async function deleteProjectFromCloud(objectId) {
    const query = Bmob.Query('Projects');
    await query.destroy(objectId);
}

// 页面加载时初始化 (修复：使用 DOMContentLoaded 避免冲突)
document.addEventListener('DOMContentLoaded', function() {
    initLocalStorage();
    // 登录页和注册页不需要检查登录
    if (!window.location.pathname.includes('login_lh.html') && 
        !window.location.pathname.includes('register_lh.html') &&
        !window.location.pathname.includes('forgot_password_lh.html') &&
        !window.location.pathname.includes('terms_lh.html')) {
        checkLogin();
    }
    initHeader();
});

// ========== 数据变更通知（Bmob云端，无需跨标签页同步） ==========

// ========== 背景视差效果 ==========
(function() {
    var targetX = 0, targetY = 0, currentX = 0, currentY = 0;
    var isActive = false;

    document.addEventListener('mousemove', function(e) {
        targetX = (e.clientX / window.innerWidth - 0.5) * 12;
        targetY = (e.clientY / window.innerHeight - 0.5) * 12;
        if (!isActive) {
            isActive = true;
            requestAnimationFrame(animate);
        }
    });

    function animate() {
        currentX += (targetX - currentX) * 0.06;
        currentY += (targetY - currentY) * 0.06;
        document.body.style.backgroundPosition = 'calc(50% + ' + currentX + 'px) calc(50% + ' + currentY + 'px)';
        if (Math.abs(targetX - currentX) > 0.01 || Math.abs(targetY - currentY) > 0.01) {
            requestAnimationFrame(animate);
        } else {
            isActive = false;
        }
    }
})();

// ========== 站内信系统 ==========

async function updateUnreadBadge() {
    var badge = document.getElementById('msg-badge');
    if (!badge) return;
    var user = getCurrentUser();
    if (!user) { badge.style.display = 'none'; return; }
    try {
        var query = Bmob.Query('Messages');
        query.equalTo('receiverId', '==', user.objectId || user.id);
        query.equalTo('isRead', '==', false);
        var res = await query.find();
        var count = res ? res.length : 0;
        if (count > 0) { badge.textContent = ''; badge.style.display = 'block'; }
        else { badge.style.display = 'none'; }
    } catch (e) {}
}

function toggleMessageCenter() {
    var overlay = document.getElementById('chat-overlay');
    if (!overlay) return;
    overlay.style.display = 'flex';
    var badge = document.getElementById('msg-badge');
    if (badge) badge.style.display = 'none';
    initChat();
}

var _currentChatUserId = null;
var _currentChatUserName = null;
var _chatInited = false;

function closeChatModal() {
    var overlay = document.getElementById('chat-overlay');
    if (overlay) overlay.style.display = 'none';
}

function initChat() {
    if (_chatInited) { loadContacts(); return; }
    _chatInited = true;
    loadContacts();
}

var _avatarPresets = [
    { emoji: '😀', color: '#667eea' },
    { emoji: '🦊', color: '#ff9800' },
    { emoji: '🐱', color: '#4caf50' },
    { emoji: '🐶', color: '#2196f3' },
    { emoji: '🐼', color: '#9c27b0' },
    { emoji: '🦁', color: '#f44336' },
    { emoji: '🐰', color: '#e91e63' },
    { emoji: '🐮', color: '#00bcd4' },
    { emoji: '🐸', color: '#8bc34a' },
    { emoji: '🐵', color: '#795548' },
    { emoji: '🐯', color: '#ff5722' },
    { emoji: '🐨', color: '#607d8b' }
];

function getAvatarHtml(name) {
    if (!name) return '<span>?</span>';
    var hash = 0;
    for (var i = 0; i < name.length; i++) { hash = ((hash << 5) - hash) + name.charCodeAt(i); hash |= 0; }
    var idx = Math.abs(hash) % _avatarPresets.length;
    var avatar = _avatarPresets[idx];
    return '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:inherit;">' + avatar.emoji + '</div>';
}

function getAvatarBg(name) {
    if (!name) return 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    var hash = 0;
    for (var i = 0; i < name.length; i++) { hash = ((hash << 5) - hash) + name.charCodeAt(i); hash |= 0; }
    var idx = Math.abs(hash) % _avatarPresets.length;
    var avatar = _avatarPresets[idx];
    return 'linear-gradient(135deg, ' + avatar.color + ' 0%, ' + avatar.color + 'cc 100%)';
}

async function loadContacts() {
    var user = getCurrentUser();
    if (!user) return;
    var userId = user.objectId || user.id;
    var list = document.getElementById('contact-list');
    if (!list) return;
    list.innerHTML = '<div class="chat-empty" style="font-size:13px;padding:40px 0;">加载中…</div>';
    try {
        var received = Bmob.Query('Messages');
        received.equalTo('receiverId', '==', userId);
        var sent = Bmob.Query('Messages');
        sent.equalTo('senderId', '==', userId);
        var recRes = await received.find();
        var sentRes = await sent.find();
        var allMsgs = (recRes || []).concat(sentRes || []);
        var contactMap = {};
        allMsgs.forEach(function(m) {
            var contactId, contactName;
            if (m.senderId === userId) {
                contactId = m.receiverId;
                contactName = m.receiverName || '未知';
            } else {
                contactId = m.senderId;
                contactName = m.senderName || '未知';
            }
            if (!contactMap[contactId]) {
                contactMap[contactId] = { id: contactId, name: contactName, time: m.time || '', preview: m.content || '' };
            }
            var existing = contactMap[contactId];
            if (m.createdAt && (!existing.createdAt || m.createdAt > existing.createdAt)) {
                existing.time = m.time || '';
                existing.preview = m.content || '';
                existing.createdAt = m.createdAt;
            }
        });
        var contacts = Object.values(contactMap);
        contacts.sort(function(a, b) { return (b.createdAt || '').localeCompare(a.createdAt || ''); });
        renderContactList(contacts);
    } catch (e) {
        list.innerHTML = '<div class="chat-empty" style="font-size:13px;padding:40px 0;">加载失败</div>';
    }
}

function renderContactList(contacts) {
    var list = document.getElementById('contact-list');
    if (!list) return;
    if (!contacts || contacts.length === 0) {
        list.innerHTML = '<div class="chat-empty" style="font-size:13px;padding:40px 0;">暂无联系人</div>';
        return;
    }
    list.innerHTML = '';
    contacts.forEach(function(c) {
        var div = document.createElement('div');
        div.className = 'contact-item';
        if (c.id === _currentChatUserId) div.classList.add('active');
        div.onclick = function() { selectContact(c.id, c.name); };
        div.innerHTML =
            '<div class="contact-avatar" style="background:' + getAvatarBg(c.name) + ';">' + getAvatarHtml(c.name) + '</div>' +
            '<div class="contact-info">' +
                '<div class="contact-name">' + c.name + '</div>' +
                '<div class="contact-preview">' + (c.preview || '') + '</div>' +
            '</div>';
        list.appendChild(div);
    });
}

async function selectContact(userId, userName) {
    _currentChatUserId = userId;
    _currentChatUserName = userName;
    document.getElementById('chat-empty').style.display = 'none';
    document.getElementById('chat-header').style.display = 'block';
    document.getElementById('chat-messages').style.display = 'flex';
    var isSystem = (userId === 'system');
    document.getElementById('chat-input-area').style.display = isSystem ? 'none' : 'flex';
    document.getElementById('chat-header').textContent = userName;
    var items = document.querySelectorAll('.contact-item');
    items.forEach(function(item) {
        item.classList.remove('active');
        var nameEl = item.querySelector('.contact-name');
        if (nameEl && nameEl.textContent === userName) item.classList.add('active');
    });
    await loadMessages(userId);
}

async function loadMessages(contactId) {
    var user = getCurrentUser();
    if (!user) return;
    var userId = user.objectId || user.id;
    var container = document.getElementById('chat-messages');
    container.innerHTML = '<div class="chat-empty" style="font-size:13px;padding:20px;">加载中…</div>';
    try {
        var q1 = Bmob.Query('Messages');
        q1.equalTo('senderId', '==', userId);
        q1.equalTo('receiverId', '==', contactId);
        var res1 = await q1.find();
        var q2 = Bmob.Query('Messages');
        q2.equalTo('senderId', '==', contactId);
        q2.equalTo('receiverId', '==', userId);
        var res2 = await q2.find();
        var allMsgs = (res1 || []).concat(res2 || []);
        allMsgs.sort(function(a, b) { return (a.createdAt || '').localeCompare(b.createdAt || ''); });
        renderMessages(allMsgs);
        scrollToBottom();
        allMsgs.filter(function(m) { return m.senderId === contactId && !m.isRead; }).forEach(function(m) { markAsRead(m.objectId); });
    } catch (e) {
        container.innerHTML = '<div class="chat-empty" style="font-size:13px;padding:20px;">加载失败</div>';
    }
}

function renderMessages(messages) {
    var container = document.getElementById('chat-messages');
    var user = getCurrentUser();
    var userId = user.objectId || user.id;
    container.innerHTML = '';
    if (!messages || messages.length === 0) {
        container.innerHTML = '<div class="chat-empty" style="font-size:13px;padding:40px;">暂无消息，发送第一条吧</div>';
        return;
    }
    messages.forEach(function(m) {
        var isSelf = m.senderId === userId;
        var row = document.createElement('div');
        row.className = 'msg-row ' + (isSelf ? 'self' : 'other');
        var name = isSelf ? user.username : (m.senderName || '未知');
        var contentHtml = (m.content || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/```([\s\S]*?)```/g, '<pre>$1</pre>').replace(/\n/g, '<br>');
        row.innerHTML =
            '<div class="msg-avatar" style="background:' + getAvatarBg(name) + ';">' + getAvatarHtml(name) + '</div>' +
            '<div class="msg-bubble">' + contentHtml + '<div class="msg-time">' + (m.time || '') + '</div></div>';
        container.appendChild(row);
    });
}

function scrollToBottom() {
    var c = document.getElementById('chat-messages');
    setTimeout(function() { c.scrollTop = c.scrollHeight; }, 100);
}

async function sendChatMsg() {
    var input = document.getElementById('chat-input');
    var content = input.value.trim();
    if (!content) return;
    if (!_currentChatUserId) { showToast('请先选择联系人', 'warning'); return; }
    var user = getCurrentUser();
    var now = new Date().toLocaleString();
    input.value = '';
    input.disabled = true;
    try {
        var query = Bmob.Query('Messages');
        query.set('senderId', user.objectId || user.id);
        query.set('senderName', user.username);
        query.set('receiverId', _currentChatUserId);
        query.set('receiverName', _currentChatUserName);
        query.set('content', content);
        query.set('time', now);
        query.set('isRead', false);
        await query.save();
        await loadMessages(_currentChatUserId);
        loadContacts();
    } catch (e) { showToast('发送失败', 'error'); }
    input.disabled = false;
    input.focus();
}

async function markAsRead(msgId) {
    try {
        var query = Bmob.Query('Messages');
        query.set('objectId', msgId);
        query.set('isRead', true);
        await query.save();
        updateUnreadBadge();
    } catch (e) {}
}

function openSearchModal() {
    var overlay = document.createElement('div');
    overlay.className = 'search-modal-overlay';
    overlay.id = 'search-modal-overlay';
    overlay.innerHTML =
        '<div class="search-modal"><div class="search-modal-header"><span>🔍 查找用户</span><span class="search-modal-close" onclick="closeSearchModal()">&times;</span></div>' +
        '<div class="search-modal-body"><input type="text" id="search-user-input" placeholder="输入用户名搜索…" oninput="searchUsers()" autofocus><div id="search-result-list"></div></div></div>';
    overlay.onclick = function(e) { if (e.target === overlay) closeSearchModal(); };
    document.body.appendChild(overlay);
    setTimeout(function() { var inp = document.getElementById('search-user-input'); if (inp) inp.focus(); }, 100);
}

function closeSearchModal() {
    var overlay = document.getElementById('search-modal-overlay');
    if (overlay) overlay.remove();
}

async function searchUsers() {
    var keyword = document.getElementById('search-user-input').value.trim();
    var list = document.getElementById('search-result-list');
    if (!keyword) { list.innerHTML = ''; return; }
    var user = getCurrentUser();
    var userId = user.objectId || user.id;
    list.innerHTML = '<div style="padding:8px;color:#909399;font-size:13px;">搜索中…</div>';
    try {
        var query = Bmob.Query('Users');
        var res = await query.find();
        var filtered = (res || []).filter(function(u) { return u.objectId !== userId && u.username && u.username.indexOf(keyword) !== -1; });
        if (filtered.length === 0) { list.innerHTML = '<div style="padding:8px;color:#909399;font-size:13px;">未找到用户</div>'; return; }
        list.innerHTML = '';
        filtered.forEach(function(u) {
            var div = document.createElement('div');
            div.className = 'search-user-item';
            div.innerHTML = '<div class="search-avatar" style="background:' + getAvatarBg(u.username) + ';">' + getAvatarHtml(u.username) + '</div><div style="font-weight:600;color:#1a237e;">' + u.username + '</div>';
            div.onclick = function() { closeSearchModal(); selectContact(u.objectId, u.username); };
            list.appendChild(div);
        });
    } catch (e) { list.innerHTML = '<div style="padding:8px;color:#ef4444;font-size:13px;">搜索失败</div>'; }
}