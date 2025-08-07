// 项目进度仪表盘 - 外部脚本文件
// 全局状态管理
let currentProject = null;
let projectData = [];

// DOM 元素
let loadingEl;
let dashboardRoot;
let projectSelect;
let errorContainer;
let refreshBtn;
let syncBtn;
let exportBtn;

// 初始化DOM元素引用
function initializeElements() {
    loadingEl = document.getElementById('loading');
    dashboardRoot = document.getElementById('dashboard-root');
    projectSelect = document.getElementById('project-select');
    errorContainer = document.getElementById('error-container');
    refreshBtn = document.getElementById('refresh-btn');
    syncBtn = document.getElementById('sync-btn');
    exportBtn = document.getElementById('export-btn');
}

// 显示错误消息
function showError(message) {
    errorContainer.innerHTML = `<div class="error-message">❌ ${message}</div>`;
    setTimeout(() => {
        errorContainer.innerHTML = '';
    }, 5000);
}

// 显示成功消息
function showSuccess(message) {
    errorContainer.innerHTML = `<div class="success-message">✅ ${message}</div>`;
    setTimeout(() => {
        errorContainer.innerHTML = '';
    }, 3000);
}

// 加载项目数据
async function loadProjectData() {
    try {
        loadingEl.style.display = 'block';
        dashboardRoot.style.display = 'none';

        const response = await new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({
                type: 'GET_PROJECT_DATA'
            }, (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve(response);
                }
            });
        });

        if (response.success) {
            projectData = response.projects;
            updateProjectSelector();
            if (projectData.length > 0) {
                currentProject = projectData[0];
                renderDashboard();
            }
        } else {
            throw new Error(response.error || '获取项目数据失败');
        }
    } catch (error) {
        console.error('加载项目数据失败:', error);
        showError(error.message);
    } finally {
        loadingEl.style.display = 'none';
    }
}

// 更新项目选择器
function updateProjectSelector() {
    projectSelect.innerHTML = '';
    
    if (projectData.length === 0) {
        projectSelect.innerHTML = '<option value="">没有找到项目</option>';
        return;
    }

    projectData.forEach(project => {
        const option = document.createElement('option');
        option.value = project.id;
        option.textContent = project.name;
        if (currentProject && project.id === currentProject.id) {
            option.selected = true;
        }
        projectSelect.appendChild(option);
    });
}

// 渲染仪表盘
function renderDashboard() {
    if (!currentProject) {
        dashboardRoot.innerHTML = '<p>请选择一个项目</p>';
        dashboardRoot.style.display = 'block';
        return;
    }

    // 确保必要的字段存在
    const progress = currentProject.overallProgress || 0;
    const milestones = currentProject.milestones || [];
    const team = currentProject.team || [];
    const risks = currentProject.risks || [];
    const dependencies = currentProject.dependencies || [];

    // 渲染基础仪表盘
    dashboardRoot.innerHTML = `
        <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h3>🎯 ${currentProject.name}</h3>
            <p>${currentProject.description || '暂无描述'}</p>
            <div style="margin: 20px 0;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span>整体进度</span>
                    <span>${progress}%</span>
                </div>
                <div style="background: #ecf0f1; height: 8px; border-radius: 4px; overflow: hidden;">
                    <div style="background: #3498db; height: 100%; width: ${progress}%; transition: width 0.3s ease;"></div>
                </div>
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-top: 20px;">
                <div style="background: #f8f9fa; padding: 16px; border-radius: 8px; border-left: 4px solid #3498db;">
                    <h4 style="margin: 0 0 8px 0; color: #2c3e50;">📋 里程碑</h4>
                    <p style="margin: 0; font-size: 24px; font-weight: bold; color: #3498db;">${milestones.length}</p>
                </div>
                
                <div style="background: #f8f9fa; padding: 16px; border-radius: 8px; border-left: 4px solid #27ae60;">
                    <h4 style="margin: 0 0 8px 0; color: #2c3e50;">👥 团队成员</h4>
                    <p style="margin: 0; font-size: 24px; font-weight: bold; color: #27ae60;">${team.length}</p>
                </div>
                
                <div style="background: #f8f9fa; padding: 16px; border-radius: 8px; border-left: 4px solid #e74c3c;">
                    <h4 style="margin: 0 0 8px 0; color: #2c3e50;">⚠️ 风险</h4>
                    <p style="margin: 0; font-size: 24px; font-weight: bold; color: #e74c3c;">${risks.length}</p>
                </div>
                
                <div style="background: #f8f9fa; padding: 16px; border-radius: 8px; border-left: 4px solid #f39c12;">
                    <h4 style="margin: 0 0 8px 0; color: #2c3e50;">🔗 依赖</h4>
                    <p style="margin: 0; font-size: 24px; font-weight: bold; color: #f39c12;">${dependencies.length}</p>
                </div>
            </div>
            
            <div style="margin-top: 24px; padding: 16px; background: #e8f6f3; border-radius: 8px; border: 1px solid #d5e8e4;">
                <p style="margin: 0; color: #2c3e50;"><strong>💡 提示:</strong> React组件版本的完整仪表盘正在加载中，包含甘特图、依赖关系图、燃尽图等高级可视化功能。</p>
            </div>
        </div>
    `;
    
    dashboardRoot.style.display = 'block';
}

// 同步数据
async function syncData() {
    if (!currentProject) {
        showError('请先选择一个项目');
        return;
    }

    try {
        syncBtn.textContent = '⚡ 同步中...';
        syncBtn.disabled = true;

        const response = await new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({
                type: 'QUICK_ACTION',
                action: 'sync_data',
                data: { projectId: currentProject.id }
            }, (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve(response);
                }
            });
        });

        if (response.success) {
            showSuccess('数据同步完成');
            await loadProjectData(); // 重新加载数据
        } else {
            throw new Error(response.error || '数据同步失败');
        }
    } catch (error) {
        console.error('数据同步失败:', error);
        showError(error.message);
    } finally {
        syncBtn.textContent = '⚡ 同步数据';
        syncBtn.disabled = false;
    }
}

// 导出报告
async function exportReport() {
    if (!currentProject) {
        showError('请先选择一个项目');
        return;
    }

    try {
        exportBtn.textContent = '📄 导出中...';
        exportBtn.disabled = true;

        const response = await new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({
                type: 'QUICK_ACTION',
                action: 'export_report',
                data: { projectId: currentProject.id }
            }, (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve(response);
                }
            });
        });

        if (response.success && response.result && response.result.report) {
            // 创建下载链接
            const blob = new Blob([JSON.stringify(response.result.report, null, 2)], {
                type: 'application/json'
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${currentProject.name}-report-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            showSuccess('报告已导出');
        } else {
            throw new Error(response.error || '报告导出失败');
        }
    } catch (error) {
        console.error('报告导出失败:', error);
        showError(error.message);
    } finally {
        exportBtn.textContent = '📄 导出报告';
        exportBtn.disabled = false;
    }
}

// 初始化事件监听器
function initializeEventListeners() {
    // 项目选择器事件
    projectSelect.addEventListener('change', (e) => {
        const selectedProjectId = e.target.value;
        if (selectedProjectId) {
            currentProject = projectData.find(p => p.id === selectedProjectId);
            renderDashboard();
        }
    });

    // 按钮事件
    refreshBtn.addEventListener('click', loadProjectData);
    syncBtn.addEventListener('click', syncData);
    exportBtn.addEventListener('click', exportReport);
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    initializeElements();
    initializeEventListeners();
    loadProjectData();
});

// 监听来自background的消息
if (typeof chrome !== 'undefined' && chrome.runtime) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'PROJECT_DATA_UPDATED') {
            loadProjectData();
        }
    });
}