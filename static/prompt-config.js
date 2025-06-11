// 配置数据结构
let configData = {
    customPrompts: {
        message: {
            enabled: false,
            content: '',
            position: 'after_analysis_guide'
        },
        project: {
            enabled: false,
            content: '',
            position: 'after_analysis_guide'
        }
    },
    userContextConfig: {
        personalInfo: {
            name: '',
            email: '',
            title: '',
            department: '',
            location: '',
            timezone: 'GMT+8'
        },
        stakeholders: {
            directManager: '',
            keyStakeholders: [],
            reportingFrequency: '每周'
        },
        teamInfo: {
            teamName: '',
            teamMission: '',
            teamSize: 0,
            members: [],
            workingHours: '',
            timezone: 'GMT+8'
        },
        workFocus: {
            primaryConcerns: [],
            businessDomains: [],
            keyMetrics: [],
            riskTolerance: 'medium'
        },
        communicationContext: {
            audienceType: [],
            communicationStyle: '简洁直接',
            culturalContext: '',
            languagePreference: '中英文混合',
            reportingFormat: '项目状态报告'
        },
        analysisPreferences: {
            messageAnalysis: {
                focusAreas: [],
                ignoredTopics: [],
                urgencyKeywords: []
            },
            projectAnalysis: {
                riskFactors: [],
                successCriteria: [],
                reviewCycle: 'weekly'
            }
        },
        lastUpdated: 0,
        version: '1.0'
    }
};

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    initializeTabs();
    loadFromStorage();
    loadCurrentUserInfo();
    initializeEventListeners();
});

// 初始化标签页功能
function initializeTabs() {
    const tabs = document.querySelectorAll('.config-tab');
    const sections = document.querySelectorAll('.config-section');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            const targetTab = this.getAttribute('data-tab');
            
            // 移除所有活动状态
            tabs.forEach(t => t.classList.remove('active'));
            sections.forEach(s => s.classList.remove('active'));
            
            // 激活当前标签页
            this.classList.add('active');
            document.querySelector(`[data-section="${targetTab}"]`).classList.add('active');
        });
    });
}

// 从localStorage加载当前用户信息
async function loadCurrentUserInfo() {
    try {
        const { userinfo } = await chrome.storage.local.get('userinfo');
        if (userinfo) {
            const displayName = userinfo.fullName || userinfo.username || '未知用户';
            const displayEmail = userinfo.userEmail || '未知邮箱';
            
            document.getElementById('display-name').textContent = displayName;
            document.getElementById('display-email').textContent = displayEmail;
            
            // 更新配置数据中的基本信息
            configData.userContextConfig.personalInfo.name = displayName;
            configData.userContextConfig.personalInfo.email = displayEmail;
        }
    } catch (error) {
        console.error('加载用户信息失败:', error);
    }
}

// 从存储加载配置
async function loadFromStorage() {
    try {
        const result = await chrome.storage.local.get(['customPrompts', 'userContextConfig']);
        
        if (result.customPrompts) {
            configData.customPrompts = { ...configData.customPrompts, ...result.customPrompts };
        }
        
        if (result.userContextConfig) {
            configData.userContextConfig = { ...configData.userContextConfig, ...result.userContextConfig };
        }
        
        // 填充表单
        populateForm();
        showStatusMessage('配置已加载', 'success');
    } catch (error) {
        console.error('加载配置失败:', error);
        showStatusMessage('加载配置失败: ' + error.message, 'error');
    }
}

// 保存配置到存储
async function saveConfiguration() {
    try {
        // 从表单收集数据
        collectFormData();
        
        // 更新时间戳
        configData.userContextConfig.lastUpdated = Date.now();
        
        // 保存到localStorage
        await chrome.storage.local.set({
            customPrompts: configData.customPrompts,
            userContextConfig: configData.userContextConfig
        });
        
        showStatusMessage('配置已保存成功', 'success');
    } catch (error) {
        console.error('保存配置失败:', error);
        showStatusMessage('保存配置失败: ' + error.message, 'error');
    }
}

// 重置为默认配置
function resetToDefaults() {
    if (confirm('确定要重置所有配置为默认值吗？此操作不可撤销。')) {
        // 重置配置数据（保留用户基本信息）
        const savedUserInfo = {
            name: configData.userContextConfig.personalInfo.name,
            email: configData.userContextConfig.personalInfo.email
        };
        
        configData = {
            customPrompts: {
                message: { enabled: false, content: '', position: 'after_analysis_guide' },
                project: { enabled: false, content: '', position: 'after_analysis_guide' }
            },
            userContextConfig: {
                personalInfo: {
                    name: savedUserInfo.name,
                    email: savedUserInfo.email,
                    title: '',
                    department: '',
                    location: '',
                    timezone: 'GMT+8'
                },
                stakeholders: {
                    directManager: '',
                    keyStakeholders: [],
                    reportingFrequency: '每周'
                },
                teamInfo: {
                    teamName: '',
                    teamMission: '',
                    teamSize: 0,
                    members: [],
                    workingHours: '',
                    timezone: 'GMT+8'
                },
                workFocus: {
                    primaryConcerns: [],
                    businessDomains: [],
                    keyMetrics: [],
                    riskTolerance: 'medium'
                },
                communicationContext: {
                    audienceType: [],
                    communicationStyle: '简洁直接',
                    culturalContext: '',
                    languagePreference: '中英文混合',
                    reportingFormat: '项目状态报告'
                },
                analysisPreferences: {
                    messageAnalysis: {
                        focusAreas: [],
                        ignoredTopics: [],
                        urgencyKeywords: []
                    },
                    projectAnalysis: {
                        riskFactors: [],
                        successCriteria: [],
                        reviewCycle: 'weekly'
                    }
                },
                lastUpdated: Date.now(),
                version: '1.0'
            }
        };
        
        populateForm();
        showStatusMessage('配置已重置为默认值', 'success');
    }
}

// 填充表单数据
function populateForm() {
    // 自定义提示词
    document.getElementById('enable-message-prompt').checked = configData.customPrompts.message.enabled;
    document.getElementById('message-prompt').value = configData.customPrompts.message.content;
    document.getElementById('enable-project-prompt').checked = configData.customPrompts.project.enabled;
    document.getElementById('project-prompt').value = configData.customPrompts.project.content;
    
    // 个人信息
    const personalInfo = configData.userContextConfig.personalInfo;
    document.getElementById('user-title').value = personalInfo.title || '';
    document.getElementById('user-department').value = personalInfo.department || '';
    document.getElementById('user-location').value = personalInfo.location || '';
    document.getElementById('user-timezone').value = personalInfo.timezone || 'GMT+8';
    document.getElementById('direct-manager').value = configData.userContextConfig.stakeholders.directManager || '';
    
    // 团队信息
    const teamInfo = configData.userContextConfig.teamInfo;
    document.getElementById('team-name').value = teamInfo.teamName || '';
    document.getElementById('team-mission').value = teamInfo.teamMission || '';
    document.getElementById('team-size').value = teamInfo.teamSize || '';
    document.getElementById('working-hours').value = teamInfo.workingHours || '';
    
    // 工作关注点
    document.getElementById('risk-tolerance').value = configData.userContextConfig.workFocus.riskTolerance || 'medium';
    
    // 分析偏好
    document.getElementById('review-cycle').value = configData.userContextConfig.analysisPreferences.projectAnalysis.reviewCycle || 'weekly';
    
    // 填充动态列表
    populateDynamicLists();
}

// 收集表单数据
function collectFormData() {
    // 自定义提示词
    configData.customPrompts.message.enabled = document.getElementById('enable-message-prompt').checked;
    configData.customPrompts.message.content = document.getElementById('message-prompt').value;
    configData.customPrompts.project.enabled = document.getElementById('enable-project-prompt').checked;
    configData.customPrompts.project.content = document.getElementById('project-prompt').value;
    
    // 个人信息
    configData.userContextConfig.personalInfo.title = document.getElementById('user-title').value;
    configData.userContextConfig.personalInfo.department = document.getElementById('user-department').value;
    configData.userContextConfig.personalInfo.location = document.getElementById('user-location').value;
    configData.userContextConfig.personalInfo.timezone = document.getElementById('user-timezone').value;
    configData.userContextConfig.stakeholders.directManager = document.getElementById('direct-manager').value;
    
    // 团队信息
    configData.userContextConfig.teamInfo.teamName = document.getElementById('team-name').value;
    configData.userContextConfig.teamInfo.teamMission = document.getElementById('team-mission').value;
    configData.userContextConfig.teamInfo.teamSize = parseInt(document.getElementById('team-size').value) || 0;
    configData.userContextConfig.teamInfo.workingHours = document.getElementById('working-hours').value;
    
    // 工作关注点
    configData.userContextConfig.workFocus.riskTolerance = document.getElementById('risk-tolerance').value;
    
    // 分析偏好
    configData.userContextConfig.analysisPreferences.projectAnalysis.reviewCycle = document.getElementById('review-cycle').value;
    
    // 收集动态列表数据
    collectDynamicListsData();
}

// 填充动态列表
function populateDynamicLists() {
    // 利益相关者
    renderStakeholders();
    // 团队成员
    renderTeamMembers();
    // 主要关注点
    renderGenericList('primary-concerns-list', configData.userContextConfig.workFocus.primaryConcerns, 'removePrimaryConcern');
    // 业务领域
    renderGenericList('business-domains-list', configData.userContextConfig.workFocus.businessDomains, 'removeBusinessDomain');
    // 关键指标
    renderGenericList('key-metrics-list', configData.userContextConfig.workFocus.keyMetrics, 'removeKeyMetric');
    // 消息分析关注领域
    renderGenericList('message-focus-areas-list', configData.userContextConfig.analysisPreferences.messageAnalysis.focusAreas, 'removeMessageFocusArea');
    // 忽略话题
    renderGenericList('ignored-topics-list', configData.userContextConfig.analysisPreferences.messageAnalysis.ignoredTopics, 'removeIgnoredTopic');
    // 紧急关键词
    renderGenericList('urgency-keywords-list', configData.userContextConfig.analysisPreferences.messageAnalysis.urgencyKeywords, 'removeUrgencyKeyword');
    // 风险因素
    renderGenericList('risk-factors-list', configData.userContextConfig.analysisPreferences.projectAnalysis.riskFactors, 'removeRiskFactor');
    // 成功标准
    renderGenericList('success-criteria-list', configData.userContextConfig.analysisPreferences.projectAnalysis.successCriteria, 'removeSuccessCriteria');
}

// 渲染利益相关者列表
function renderStakeholders() {
    const container = document.getElementById('stakeholders-list');
    const stakeholders = configData.userContextConfig.stakeholders.keyStakeholders;
    
    container.innerHTML = '';
    stakeholders.forEach((stakeholder, index) => {
        const div = document.createElement('div');
        div.className = 'input-group';
        div.innerHTML = `
            <input type="text" placeholder="姓名" value="${stakeholder.name || ''}" data-field="name" data-index="${index}">
            <input type="text" placeholder="职位" value="${stakeholder.position || ''}" data-field="position" data-index="${index}">
            <input type="text" placeholder="关系" value="${stakeholder.relationship || ''}" data-field="relationship" data-index="${index}">
            <select data-field="priority" data-index="${index}">
                <option value="">选择优先级</option>
                <option value="高" ${stakeholder.priority === '高' ? 'selected' : ''}>高</option>
                <option value="中" ${stakeholder.priority === '中' ? 'selected' : ''}>中</option>
                <option value="低" ${stakeholder.priority === '低' ? 'selected' : ''}>低</option>
            </select>
            <button class="remove-btn remove-stakeholder" data-index="${index}">删除</button>
        `;
        container.appendChild(div);
    });
}

// 渲染团队成员列表
function renderTeamMembers() {
    const container = document.getElementById('team-members-list');
    const members = configData.userContextConfig.teamInfo.members;
    
    container.innerHTML = '';
    members.forEach((member, index) => {
        const div = document.createElement('div');
        div.className = 'input-group';
        div.innerHTML = `
            <input type="text" placeholder="姓名" value="${member.name || ''}" data-field="name" data-index="${index}">
            <input type="text" placeholder="职位" value="${member.position || ''}" data-field="position" data-index="${index}">
            <input type="text" placeholder="角色" value="${member.role || ''}" data-field="role" data-index="${index}">
            <input type="text" placeholder="专长" value="${member.speciality || ''}" data-field="speciality" data-index="${index}">
            <button class="remove-btn remove-team-member" data-index="${index}">删除</button>
        `;
        container.appendChild(div);
    });
}

// 渲染通用列表
function renderGenericList(containerId, items, removeClassName) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    
    items.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'input-group';
        div.innerHTML = `
            <input type="text" value="${item}" data-index="${index}">
            <button class="remove-btn ${removeClassName}" data-index="${index}">删除</button>
        `;
        container.appendChild(div);
    });
}

// 收集动态列表数据
function collectDynamicListsData() {
    // 利益相关者
    const stakeholders = [];
    document.querySelectorAll('#stakeholders-list .input-group').forEach(item => {
        const name = item.querySelector('[data-field="name"]').value;
        const position = item.querySelector('[data-field="position"]').value;
        const relationship = item.querySelector('[data-field="relationship"]').value;
        const priority = item.querySelector('[data-field="priority"]').value;
        if (name) {
            stakeholders.push({ name, position, relationship, priority });
        }
    });
    configData.userContextConfig.stakeholders.keyStakeholders = stakeholders;
    
    // 团队成员
    const members = [];
    document.querySelectorAll('#team-members-list .input-group').forEach(item => {
        const name = item.querySelector('[data-field="name"]').value;
        const position = item.querySelector('[data-field="position"]').value;
        const role = item.querySelector('[data-field="role"]').value;
        const speciality = item.querySelector('[data-field="speciality"]').value;
        if (name) {
            members.push({ name, position, role, speciality });
        }
    });
    configData.userContextConfig.teamInfo.members = members;
    
    // 其他简单列表
    configData.userContextConfig.workFocus.primaryConcerns = collectSimpleList('primary-concerns-list');
    configData.userContextConfig.workFocus.businessDomains = collectSimpleList('business-domains-list');
    configData.userContextConfig.workFocus.keyMetrics = collectSimpleList('key-metrics-list');
    configData.userContextConfig.analysisPreferences.messageAnalysis.focusAreas = collectSimpleList('message-focus-areas-list');
    configData.userContextConfig.analysisPreferences.messageAnalysis.ignoredTopics = collectSimpleList('ignored-topics-list');
    configData.userContextConfig.analysisPreferences.messageAnalysis.urgencyKeywords = collectSimpleList('urgency-keywords-list');
    configData.userContextConfig.analysisPreferences.projectAnalysis.riskFactors = collectSimpleList('risk-factors-list');
    configData.userContextConfig.analysisPreferences.projectAnalysis.successCriteria = collectSimpleList('success-criteria-list');
}

// 收集简单列表数据
function collectSimpleList(containerId) {
    const items = [];
    document.querySelectorAll(`#${containerId} .input-group input`).forEach(input => {
        if (input.value.trim()) {
            items.push(input.value.trim());
        }
    });
    return items;
}

// 添加利益相关者
function addStakeholder() {
    configData.userContextConfig.stakeholders.keyStakeholders.push({
        name: '',
        position: '',
        relationship: '',
        priority: '中'
    });
    renderStakeholders();
}

// 删除利益相关者
function removeStakeholder(index) {
    configData.userContextConfig.stakeholders.keyStakeholders.splice(index, 1);
    renderStakeholders();
}

// 添加团队成员
function addTeamMember() {
    configData.userContextConfig.teamInfo.members.push({
        name: '',
        position: '',
        role: '',
        speciality: ''
    });
    renderTeamMembers();
}

// 删除团队成员
function removeTeamMember(index) {
    configData.userContextConfig.teamInfo.members.splice(index, 1);
    renderTeamMembers();
}

// 通用添加函数
function addToList(listKey, containerId, populateFunction) {
    const path = listKey.split('.');
    let target = configData.userContextConfig;
    
    for (let i = 0; i < path.length - 1; i++) {
        target = target[path[i]];
    }
    
    target[path[path.length - 1]].push('');
    populateFunction();
}

// 通用删除函数
function removeFromList(listKey, index, populateFunction) {
    const path = listKey.split('.');
    let target = configData.userContextConfig;
    
    for (let i = 0; i < path.length - 1; i++) {
        target = target[path[i]];
    }
    
    target[path[path.length - 1]].splice(index, 1);
    populateFunction();
}

// 具体的添加/删除函数
function addPrimaryConcern() {
    addToList('workFocus.primaryConcerns', 'primary-concerns-list', () => renderGenericList('primary-concerns-list', configData.userContextConfig.workFocus.primaryConcerns, 'removePrimaryConcern'));
}

function removePrimaryConcern(index) {
    removeFromList('workFocus.primaryConcerns', index, () => renderGenericList('primary-concerns-list', configData.userContextConfig.workFocus.primaryConcerns, 'removePrimaryConcern'));
}

function addBusinessDomain() {
    addToList('workFocus.businessDomains', 'business-domains-list', () => renderGenericList('business-domains-list', configData.userContextConfig.workFocus.businessDomains, 'removeBusinessDomain'));
}

function removeBusinessDomain(index) {
    removeFromList('workFocus.businessDomains', index, () => renderGenericList('business-domains-list', configData.userContextConfig.workFocus.businessDomains, 'removeBusinessDomain'));
}

function addKeyMetric() {
    addToList('workFocus.keyMetrics', 'key-metrics-list', () => renderGenericList('key-metrics-list', configData.userContextConfig.workFocus.keyMetrics, 'removeKeyMetric'));
}

function removeKeyMetric(index) {
    removeFromList('workFocus.keyMetrics', index, () => renderGenericList('key-metrics-list', configData.userContextConfig.workFocus.keyMetrics, 'removeKeyMetric'));
}

function addMessageFocusArea() {
    addToList('analysisPreferences.messageAnalysis.focusAreas', 'message-focus-areas-list', () => renderGenericList('message-focus-areas-list', configData.userContextConfig.analysisPreferences.messageAnalysis.focusAreas, 'removeMessageFocusArea'));
}

function removeMessageFocusArea(index) {
    removeFromList('analysisPreferences.messageAnalysis.focusAreas', index, () => renderGenericList('message-focus-areas-list', configData.userContextConfig.analysisPreferences.messageAnalysis.focusAreas, 'removeMessageFocusArea'));
}

function addIgnoredTopic() {
    addToList('analysisPreferences.messageAnalysis.ignoredTopics', 'ignored-topics-list', () => renderGenericList('ignored-topics-list', configData.userContextConfig.analysisPreferences.messageAnalysis.ignoredTopics, 'removeIgnoredTopic'));
}

function removeIgnoredTopic(index) {
    removeFromList('analysisPreferences.messageAnalysis.ignoredTopics', index, () => renderGenericList('ignored-topics-list', configData.userContextConfig.analysisPreferences.messageAnalysis.ignoredTopics, 'removeIgnoredTopic'));
}

function addUrgencyKeyword() {
    addToList('analysisPreferences.messageAnalysis.urgencyKeywords', 'urgency-keywords-list', () => renderGenericList('urgency-keywords-list', configData.userContextConfig.analysisPreferences.messageAnalysis.urgencyKeywords, 'removeUrgencyKeyword'));
}

function removeUrgencyKeyword(index) {
    removeFromList('analysisPreferences.messageAnalysis.urgencyKeywords', index, () => renderGenericList('urgency-keywords-list', configData.userContextConfig.analysisPreferences.messageAnalysis.urgencyKeywords, 'removeUrgencyKeyword'));
}

function addRiskFactor() {
    addToList('analysisPreferences.projectAnalysis.riskFactors', 'risk-factors-list', () => renderGenericList('risk-factors-list', configData.userContextConfig.analysisPreferences.projectAnalysis.riskFactors, 'removeRiskFactor'));
}

function removeRiskFactor(index) {
    removeFromList('analysisPreferences.projectAnalysis.riskFactors', index, () => renderGenericList('risk-factors-list', configData.userContextConfig.analysisPreferences.projectAnalysis.riskFactors, 'removeRiskFactor'));
}

function addSuccessCriteria() {
    addToList('analysisPreferences.projectAnalysis.successCriteria', 'success-criteria-list', () => renderGenericList('success-criteria-list', configData.userContextConfig.analysisPreferences.projectAnalysis.successCriteria, 'removeSuccessCriteria'));
}

function removeSuccessCriteria(index) {
    removeFromList('analysisPreferences.projectAnalysis.successCriteria', index, () => renderGenericList('success-criteria-list', configData.userContextConfig.analysisPreferences.projectAnalysis.successCriteria, 'removeSuccessCriteria'));
}

// 显示状态消息
function showStatusMessage(message, type) {
    const statusElement = document.getElementById('status-message');
    statusElement.textContent = message;
    statusElement.className = `status-message status-${type}`;
    statusElement.style.display = 'block';
    
    // 3秒后自动隐藏
    setTimeout(() => {
        statusElement.style.display = 'none';
    }, 3000);
}

// 初始化事件监听器
function initializeEventListeners() {
    // 主要操作按钮
    document.getElementById('save-config-btn').addEventListener('click', saveConfiguration);
    document.getElementById('reload-config-btn').addEventListener('click', loadFromStorage);
    document.getElementById('reset-config-btn').addEventListener('click', resetToDefaults);
    
    // 添加按钮
    document.getElementById('add-stakeholder-btn').addEventListener('click', addStakeholder);
    document.getElementById('add-team-member-btn').addEventListener('click', addTeamMember);
    document.getElementById('add-primary-concern-btn').addEventListener('click', addPrimaryConcern);
    document.getElementById('add-business-domain-btn').addEventListener('click', addBusinessDomain);
    document.getElementById('add-key-metric-btn').addEventListener('click', addKeyMetric);
    document.getElementById('add-message-focus-area-btn').addEventListener('click', addMessageFocusArea);
    document.getElementById('add-ignored-topic-btn').addEventListener('click', addIgnoredTopic);
    document.getElementById('add-urgency-keyword-btn').addEventListener('click', addUrgencyKeyword);
    document.getElementById('add-risk-factor-btn').addEventListener('click', addRiskFactor);
    document.getElementById('add-success-criteria-btn').addEventListener('click', addSuccessCriteria);
    
    // 事件委托处理动态生成的删除按钮
    document.addEventListener('click', function(event) {
        if (event.target.classList.contains('remove-stakeholder')) {
            const index = parseInt(event.target.getAttribute('data-index'));
            removeStakeholder(index);
        } else if (event.target.classList.contains('remove-team-member')) {
            const index = parseInt(event.target.getAttribute('data-index'));
            removeTeamMember(index);
        } else if (event.target.classList.contains('removePrimaryConcern')) {
            const index = parseInt(event.target.getAttribute('data-index'));
            removePrimaryConcern(index);
        } else if (event.target.classList.contains('removeBusinessDomain')) {
            const index = parseInt(event.target.getAttribute('data-index'));
            removeBusinessDomain(index);
        } else if (event.target.classList.contains('removeKeyMetric')) {
            const index = parseInt(event.target.getAttribute('data-index'));
            removeKeyMetric(index);
        } else if (event.target.classList.contains('removeMessageFocusArea')) {
            const index = parseInt(event.target.getAttribute('data-index'));
            removeMessageFocusArea(index);
        } else if (event.target.classList.contains('removeIgnoredTopic')) {
            const index = parseInt(event.target.getAttribute('data-index'));
            removeIgnoredTopic(index);
        } else if (event.target.classList.contains('removeUrgencyKeyword')) {
            const index = parseInt(event.target.getAttribute('data-index'));
            removeUrgencyKeyword(index);
        } else if (event.target.classList.contains('removeRiskFactor')) {
            const index = parseInt(event.target.getAttribute('data-index'));
            removeRiskFactor(index);
        } else if (event.target.classList.contains('removeSuccessCriteria')) {
            const index = parseInt(event.target.getAttribute('data-index'));
            removeSuccessCriteria(index);
        }
    });
    
    // 事件委托处理动态生成的输入字段变化
    document.addEventListener('change', function(event) {
        const index = parseInt(event.target.getAttribute('data-index'));
        const field = event.target.getAttribute('data-field');
        
        if (event.target.closest('#stakeholders-list')) {
            if (field && index >= 0 && configData.userContextConfig.stakeholders.keyStakeholders[index]) {
                configData.userContextConfig.stakeholders.keyStakeholders[index][field] = event.target.value;
            }
        } else if (event.target.closest('#team-members-list')) {
            if (field && index >= 0 && configData.userContextConfig.teamInfo.members[index]) {
                configData.userContextConfig.teamInfo.members[index][field] = event.target.value;
            }
        } else if (event.target.closest('#primary-concerns-list') && index >= 0) {
            configData.userContextConfig.workFocus.primaryConcerns[index] = event.target.value;
        } else if (event.target.closest('#business-domains-list') && index >= 0) {
            configData.userContextConfig.workFocus.businessDomains[index] = event.target.value;
        } else if (event.target.closest('#key-metrics-list') && index >= 0) {
            configData.userContextConfig.workFocus.keyMetrics[index] = event.target.value;
        } else if (event.target.closest('#message-focus-areas-list') && index >= 0) {
            configData.userContextConfig.analysisPreferences.messageAnalysis.focusAreas[index] = event.target.value;
        } else if (event.target.closest('#ignored-topics-list') && index >= 0) {
            configData.userContextConfig.analysisPreferences.messageAnalysis.ignoredTopics[index] = event.target.value;
        } else if (event.target.closest('#urgency-keywords-list') && index >= 0) {
            configData.userContextConfig.analysisPreferences.messageAnalysis.urgencyKeywords[index] = event.target.value;
        } else if (event.target.closest('#risk-factors-list') && index >= 0) {
            configData.userContextConfig.analysisPreferences.projectAnalysis.riskFactors[index] = event.target.value;
        } else if (event.target.closest('#success-criteria-list') && index >= 0) {
            configData.userContextConfig.analysisPreferences.projectAnalysis.successCriteria[index] = event.target.value;
        }
    });
}