// 从URL参数获取数据
let analysisResult = null;
let presentationId = '';
let token = '';

// 初始化函数
function initAnalysisPage() {
  try {
    // 获取URL查询参数
    const urlParams = new URLSearchParams(window.location.search);
    const dataParam = urlParams.get('data');
    
    if (!dataParam) {
      showToast('未找到分析数据', 'error');
      return;
    }
    
    // 解码并解析数据
    const decodedData = decodeURIComponent(dataParam);
    const data = JSON.parse(decodedData);
    
    // 保存数据到全局变量
    analysisResult = data.result;
    presentationId = data.presentationId;
    token = data.token;
    
    // 更新UI
    updateUI();
    
    // 初始化事件处理
    initEventHandlers();
    
    // 告知父窗口页面已加载完成
    if (window.opener) {
      window.opener.postMessage({ type: 'POPUP_READY' }, '*');
    }
  } catch (err) {
    console.error('初始化分析页面时出错:', err);
    showToast('初始化页面失败: ' + err.message, 'error');
  }
}

// 更新UI
function updateUI() {
  if (!analysisResult) {
    showToast('无效的分析结果数据', 'error');
    return;
  }
  
  // 更新摘要信息
  const summaryInfoEl = document.getElementById('summary-info');
  if (summaryInfoEl) {
    summaryInfoEl.innerHTML = `
      <p>检测到 ${analysisResult.summary.totalProjects} 个项目，${analysisResult.summary.projectsNeedingUpdate} 个需要更新</p>
    `;
  }
  
  // 更新项目建议
  const suggestionsContainerEl = document.getElementById('suggestions-container');
  if (suggestionsContainerEl) {
    if (analysisResult.updateSuggestions && analysisResult.updateSuggestions.length > 0) {
      let suggestionsHtml = '';
      
      analysisResult.updateSuggestions.forEach((suggestion, index) => {
        // 获取可用列信息
        const hasStatusColumn = suggestion.columnIndices && suggestion.columnIndices.status !== undefined && suggestion.columnIndices.status !== -1;
        const hasOwnerColumn = suggestion.columnIndices && suggestion.columnIndices.owner !== undefined && suggestion.columnIndices.owner !== -1;
        const hasTrackColumn = suggestion.columnIndices && suggestion.columnIndices.track !== undefined && suggestion.columnIndices.track !== -1;
        const hasCommentsColumn = suggestion.columnIndices && suggestion.columnIndices.comments !== undefined && suggestion.columnIndices.comments !== -1;
        
        suggestionsHtml += `
          <div class="project-item">
            <div style="margin-bottom: 10px;">
              <span style="font-weight: bold;">项目 ${suggestion.projectId}: ${suggestion.projectName}</span>
              
              <!-- Jira信息显示区域 -->
              ${suggestion.sourceInfo.jiraIssues && suggestion.sourceInfo.jiraIssues.length > 0 ? `
              <div class="jira-issues-container" style="margin-top: 8px; margin-bottom: 10px; padding: 8px; background: #f5f5f5; border-radius: 4px; font-size: 13px;">
                <div style="font-weight: bold; margin-bottom: 5px;">相关Jira问题:</div>
                ${suggestion.sourceInfo.jiraIssues.map(issue => `
                  <div class="jira-issue-item" style="margin-bottom: 8px; padding: 5px; border-left: 3px solid #0052CC;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                      <a href="${issue.url || '#'}" target="_blank" style="color: #0052CC; font-weight: bold; text-decoration: none;">${issue.key}</a>
                      <div style="display: flex; align-items: center;">
                        ${issue.priority ? `
                          <span class="jira-priority" style="padding: 2px 6px; margin-right: 5px; border-radius: 3px; font-size: 11px; background-color: ${getPriorityColor(issue.priority)}; color: white;">${issue.priority}</span>
                        ` : ''}
                        <span class="jira-status" style="padding: 2px 6px; border-radius: 3px; font-size: 11px; background-color: ${getStatusColor(issue.status)}; color: white;">${issue.status}</span>
                      </div>
                    </div>
                    <div style="margin-top: 3px; font-weight: 500;">${issue.summary}</div>
                    <div style="display: flex; flex-wrap: wrap; margin-top: 5px; font-size: 11px; color: #555;">
                      ${issue.assignee ? `
                        <div style="margin-right: 10px; display: flex; align-items: center;">
                          <span style="color: #777; margin-right: 3px;">处理人:</span>
                          <span style="background: #dfe1e6; padding: 1px 5px; border-radius: 3px;">${issue.assignee}</span>
                        </div>
                      ` : ''}
                      ${issue.reporter ? `
                        <div style="margin-right: 10px; display: flex; align-items: center;">
                          <span style="color: #777; margin-right: 3px;">报告人:</span>
                          <span style="background: #dfe1e6; padding: 1px 5px; border-radius: 3px;">${issue.reporter}</span>
                        </div>
                      ` : ''}
                      ${issue.dueDate ? `
                        <div style="margin-right: 10px; display: flex; align-items: center;">
                          <span style="color: #777; margin-right: 3px;">截止日期:</span>
                          <span style="color: ${new Date(issue.dueDate) < new Date() ? '#FF5630' : '#333'}; font-weight: ${new Date(issue.dueDate) < new Date() ? 'bold' : 'normal'};">${formatDate(issue.dueDate)}</span>
                        </div>
                      ` : ''}
                    </div>
                  </div>
                `).join('')}
              </div>
              ` : ''}
              
              <div style="margin-top: 5px; margin-bottom: 10px; font-size: 12px; color: #666;">
                <span style="display: inline-block; margin-right: 10px;">
                  <input type="checkbox" id="select-all-${index}" class="select-all-checkbox" data-index="${index}">
                  <label for="select-all-${index}">全选</label>
                </span>
              </div>
            </div>
            
            ${hasStatusColumn && suggestion.suggestedStatus && suggestion.suggestedStatus !== suggestion.currentStatus ? `
            <div class="update-item">
              <input type="checkbox" id="update-status-${index}" class="update-item-checkbox" 
                data-project-index="${index}" data-field="status" data-current="${suggestion.currentStatus}" 
                data-suggested="${suggestion.suggestedStatus}" style="margin-right: 8px;">
              <div>
                <div>状态: <span style="color: #999;">${suggestion.currentStatus}</span> → 
                <span style="color: #0066cc; font-weight: bold;">${suggestion.suggestedStatus}</span></div>
                <div class="update-tag">
                  🔄 更新: Status列从"${suggestion.currentStatus}"更新为"${suggestion.suggestedStatus}"
                </div>
                ${suggestion.statusReason ? `<div class="reason-tag" style="margin-top: 5px; font-size: 12px; color: #555; font-style: italic;">📝 理由: ${suggestion.statusReason}</div>` : ''}
              </div>
            </div>
            ` : ''}
            
            ${hasCommentsColumn && suggestion.suggestedComments ? `
            <div class="update-item">
              <input type="checkbox" id="update-comments-${index}" class="update-item-checkbox" 
                data-project-index="${index}" data-field="comments" data-current="${suggestion.currentComments || ''}" 
                data-suggested="${suggestion.suggestedComments}" style="margin-right: 8px;">
              <div>
                <div class="update-tag">
                  🔄 更新: Comment列${suggestion.currentComments ? '添加' : '设置为'}"${suggestion.suggestedComments}"
                </div>
                ${suggestion.suggestedCommentsReason ? `<div class="reason-tag" style="margin-top: 5px; font-size: 12px; color: #555; font-style: italic;">📝 理由: ${suggestion.suggestedCommentsReason}</div>` : ''}
              </div>
            </div>
            ` : ''}
            
            ${hasOwnerColumn && suggestion.suggestedOwner && suggestion.suggestedOwner !== suggestion.currentOwner ? `
            <div class="update-item">
              <input type="checkbox" id="update-owner-${index}" class="update-item-checkbox" 
                data-project-index="${index}" data-field="owner" data-current="${suggestion.currentOwner || ''}" 
                data-suggested="${suggestion.suggestedOwner}" style="margin-right: 8px;">
              <div>
                <div>负责人: <span style="color: #999;">${suggestion.currentOwner || '无'}</span> → 
                <span style="color: #0066cc; font-weight: bold;">${suggestion.suggestedOwner}</span></div>
                <div class="update-tag">
                  🔄 更新: Owner列从"${suggestion.currentOwner || '无'}"更新为"${suggestion.suggestedOwner}"
                </div>
                ${suggestion.ownerReason ? `<div class="reason-tag" style="margin-top: 5px; font-size: 12px; color: #555; font-style: italic;">📝 理由: ${suggestion.ownerReason}</div>` : ''}
              </div>
            </div>
            ` : ''}
            
            ${hasTrackColumn && suggestion.suggestedTrack && suggestion.suggestedTrack !== suggestion.currentTrack ? `
            <div class="update-item">
              <input type="checkbox" id="update-track-${index}" class="update-item-checkbox" 
                data-project-index="${index}" data-field="track" data-current="${suggestion.currentTrack || ''}" 
                data-suggested="${suggestion.suggestedTrack}" style="margin-right: 8px;">
              <div>
                <div>赛道: <span style="color: #999;">${suggestion.currentTrack || '无'}</span> → 
                <span style="color: #0066cc; font-weight: bold;">${suggestion.suggestedTrack}</span></div>
                <div class="update-tag">
                  🔄 更新: Track列${suggestion.currentTrack ? `从"${suggestion.currentTrack}"更新为` : '设置为'}"${suggestion.suggestedTrack}"
                </div>
              </div>
            </div>
            ` : ''}
          </div>
        `;
      });
      
      suggestionsContainerEl.innerHTML = suggestionsHtml;
    } else {
      suggestionsContainerEl.innerHTML = `
        <div class="center" style="padding: 20px; background: #f9f9f9; border-radius: 8px;">
          <p>所有项目信息均已是最新，无需更新。</p>
        </div>
      `;
    }
  }
  
  // 更新应用按钮
  const applyButtonContainerEl = document.getElementById('apply-button-container');
  if (applyButtonContainerEl) {
    if (analysisResult.updateSuggestions && analysisResult.updateSuggestions.length > 0) {
      applyButtonContainerEl.innerHTML = `
        <button id="apply-updates-button" class="btn-primary">应用选定更新</button>
      `;
    } else {
      applyButtonContainerEl.innerHTML = '';
    }
  }
  
  // 更新项目统计
  const projectStatsEl = document.getElementById('project-statistics');
  if (projectStatsEl) {
    projectStatsEl.innerHTML = `
      <div style="margin-bottom: 8px;">● 正常进行: ${analysisResult.summary.normalProjects}个项目</div>
      <div style="margin-bottom: 8px;">● 需要关注: ${analysisResult.summary.attentionProjects}个项目</div>
      <div style="margin-bottom: 8px;">● 严重风险: ${analysisResult.summary.riskProjects}个项目</div>
    `;
  }
  
  // 更新关键发现
  const keyFindingsEl = document.getElementById('key-findings');
  if (keyFindingsEl) {
    if (analysisResult.summary.keyFindings && analysisResult.summary.keyFindings.length > 0) {
      let findingsHtml = '';
      analysisResult.summary.keyFindings.forEach(finding => {
        findingsHtml += `<li style="margin-bottom: 5px;">${finding}</li>`;
      });
      keyFindingsEl.innerHTML = findingsHtml;
    } else {
      keyFindingsEl.innerHTML = '<li>没有关键发现</li>';
    }
  }
}

// 初始化事件处理
function initEventHandlers() {
  // 全选/取消全选功能
  document.querySelectorAll('.select-all-checkbox').forEach(checkbox => {
    checkbox.addEventListener('change', (e) => {
      const target = e.target;
      const projectIndex = target.dataset.index;
      const isChecked = target.checked;
      
      document.querySelectorAll(`.update-item-checkbox[data-project-index="${projectIndex}"]`)
        .forEach((itemCheckbox) => {
          itemCheckbox.checked = isChecked;
        });
    });
  });
  
  // 应用更新按钮事件
  const applyButton = document.getElementById('apply-updates-button');
  if (applyButton) {
    applyButton.addEventListener('click', handleApplyUpdates);
  }
  
  // 接收来自父窗口的消息
  window.addEventListener('message', handleParentMessage);
}

// 处理应用更新
function handleApplyUpdates() {
  try {
    debugLog('应用更新按钮被点击');
    
    // 收集选中的更新项
    const selectedItems = Array.from(document.querySelectorAll('.update-item-checkbox:checked'));
    
    if (selectedItems.length === 0) {
      showToast('请选择至少一个更新项', 'warning');
      return;
    }
    
    debugLog('选择了 ' + selectedItems.length + ' 个更新项');
    
    // 按项目组织选中的更新项
    const groupedUpdates = new Map();
    
    selectedItems.forEach(item => {
      const checkbox = item;
      const projectIndex = parseInt(checkbox.dataset.projectIndex || '0', 10);
      const field = checkbox.dataset.field;
      const suggested = checkbox.dataset.suggested;
      
      if (!groupedUpdates.has(projectIndex)) {
        // 复制原始项目数据
        const originalSuggestion = analysisResult.updateSuggestions[projectIndex];
        const partialUpdate = {
          projectId: originalSuggestion.projectId,
          projectName: originalSuggestion.projectName,
          slideId: originalSuggestion.slideId,
          tableId: originalSuggestion.tableId,
          rowIndex: originalSuggestion.rowIndex,
          columnIndices: originalSuggestion.columnIndices,
          currentStatus: originalSuggestion.currentStatus,
          currentOwner: originalSuggestion.currentOwner,
          currentTrack: originalSuggestion.currentTrack,
          currentComments: originalSuggestion.currentComments,
          reason: originalSuggestion.reason,
          sourceInfo: originalSuggestion.sourceInfo,
          confidence: originalSuggestion.confidence
        };
        groupedUpdates.set(projectIndex, partialUpdate);
      }
      
      // 添加选中的更新字段
      const update = groupedUpdates.get(projectIndex);
      switch (field) {
        case 'status':
          update.suggestedStatus = suggested;
          break;
        case 'owner':
          update.suggestedOwner = suggested;
          break;
        case 'track':
          update.suggestedTrack = suggested;
          break;
        case 'comments':
          update.suggestedComments = suggested;
          break;
      }
    });
    
    // 转换为数组
    const selectedUpdates = Array.from(groupedUpdates.values());
    
    debugLog('准备发送 ' + selectedUpdates.length + ' 个项目更新到父窗口');
    
    // 通知父窗口应用更新
    const message = {
      type: 'APPLY_PROJECT_UPDATES',
      presentationId,
      token,
      selectedUpdates
    };
    
    debugLog('发送消息到父窗口: ' + JSON.stringify({
      type: message.type,
      projectCount: selectedUpdates.length
    }));
    
    // 确保父窗口存在并可以接收消息
    if (window.opener) {
      window.opener.postMessage(message, '*');
      showToast('正在应用更新...', 'info');
      
      // 禁用应用更新按钮，防止重复提交
      const applyButton = document.getElementById('apply-updates-button');
      if (applyButton) {
        applyButton.disabled = true;
        applyButton.textContent = '正在更新...';
      }
      
      // 设置超时检查，如果一段时间后仍未收到响应，则恢复按钮状态
      setTimeout(() => {
        const currentApplyButton = document.getElementById('apply-updates-button');
        if (currentApplyButton && currentApplyButton.textContent === '正在更新...') {
          currentApplyButton.disabled = false;
          currentApplyButton.textContent = '应用选定更新';
          showToast('未收到更新确认，请重试或检查父窗口状态', 'warning');
          debugLog('等待更新确认超时');
        }
      }, 10000); // 10秒超时
    } else {
      showToast('无法与父窗口通信，请重新打开分析窗口', 'error');
      debugLog('父窗口引用不存在');
    }
  } catch (err) {
    showToast('更新操作失败: ' + err.message, 'error');
    debugLog('错误: ' + err.message);
    console.error(err);
  }
}

// 处理来自父窗口的消息
function handleParentMessage(event) {
  debugLog('收到消息: ' + JSON.stringify({
    type: event.data?.type,
    source: event.origin
  }));
  
  try {
    if (!event.data) {
      debugLog('接收到空消息数据');
      return;
    }
    
    if (event.data.type === 'UPDATE_SUCCESS') {
      debugLog('收到更新成功消息: ' + JSON.stringify(event.data));
      
      // 显示成功消息
      const successMessage = document.getElementById('success-message');
      const successDetails = document.getElementById('success-details');
      
      if (successMessage && successDetails) {
        successDetails.textContent = `已成功更新 ${event.data.updatedCount || '0'} 个项目信息`;
        successMessage.style.display = 'block';
        
        // 滚动到顶部
        window.scrollTo(0, 0);
      } else {
        showToast(`更新成功: 已更新 ${event.data.updatedCount || '0'} 个项目`, 'success');
      }
      
      // 更新应用按钮状态
      const applyButton = document.getElementById('apply-updates-button');
      if (applyButton) {
        applyButton.disabled = false;
        applyButton.textContent = '应用已完成';
      }
      
      // 标记已更新的项目
      if (event.data.updates && Array.isArray(event.data.updates)) {
        event.data.updates.forEach(update => {
          // 找到对应的项目条目，添加已更新标记
          const projectItems = document.querySelectorAll('.project-item');
          projectItems.forEach(item => {
            const titleEl = item.querySelector('span[style*="font-weight: bold"]');
            if (titleEl && titleEl.textContent.includes(update.projectId)) {
              item.style.borderLeft = '4px solid #4CAF50';
              
              // 禁用该项目的全部复选框
              const checkboxes = item.querySelectorAll('input[type="checkbox"]');
              checkboxes.forEach(cb => {
                cb.disabled = true;
                cb.checked = true;
              });
            }
          });
        });
      }
    } else if (event.data.type === 'UPDATE_ERROR') {
      // 处理更新错误消息
      showToast('更新失败: ' + (event.data.errorMessage || '未知错误'), 'error');
      debugLog('收到更新错误消息: ' + JSON.stringify(event.data));
      
      // 恢复按钮状态
      const applyButton = document.getElementById('apply-updates-button');
      if (applyButton) {
        applyButton.disabled = false;
        applyButton.textContent = '应用选定更新';
      }
    }
  } catch (err) {
    debugLog('处理消息时出错: ' + err.message);
    console.error('处理父窗口消息时出错:', err);
    
    // 恢复按钮状态
    const applyButton = document.getElementById('apply-updates-button');
    if (applyButton && applyButton.textContent === '正在更新...') {
      applyButton.disabled = false;
      applyButton.textContent = '应用选定更新';
    }
  }
}

// 显示通知
function showToast(message, type = 'info') {
  // 移除任何已存在的toast
  const existingToast = document.getElementById('analysis-toast');
  if (existingToast) {
    document.body.removeChild(existingToast);
  }
  
  // 创建新的toast
  const toast = document.createElement('div');
  toast.id = 'analysis-toast';
  toast.className = 'toast toast-' + type;
  toast.textContent = message;
  
  document.body.appendChild(toast);
  
  // 5秒后自动移除
  setTimeout(() => {
    if (document.body.contains(toast)) {
      document.body.removeChild(toast);
    }
  }, 5000);
}

// 调试辅助函数
function debugLog(message) {
  console.log('[分析窗口]', message);
}

// 根据状态返回对应的颜色
function getStatusColor(status) {
  if (!status) return '#999';
  
  status = status.toLowerCase();
  if (status.includes('done') || status.includes('完成') || status.includes('resolved') || status.includes('已解决')) {
    return '#36B37E';  // 绿色
  } else if (status.includes('progress') || status.includes('进行中') || status.includes('处理中') || status.includes('实现中')) {
    return '#0052CC';  // 蓝色
  } else if (status.includes('todo') || status.includes('待办') || status.includes('open') || status.includes('待处理')) {
    return '#6554C0';  // 紫色
  } else if (status.includes('block') || status.includes('阻塞') || status.includes('stuck')) {
    return '#FF5630';  // 红色
  } else if (status.includes('review') || status.includes('审核') || status.includes('待验证')) {
    return '#FF9000';  // 橙色
  } else if (status.includes('test') || status.includes('测试') || status.includes('qa')) {
    return '#00B8D9';  // 青色
  } else if (status.includes('backlog') || status.includes('规划中')) {
    return '#998DD9';  // 淡紫色
  } else if (status.includes('cancel') || status.includes('取消') || status.includes('won\'t')) {
    return '#7A869A';  // 灰色
  } else {
    return '#999';     // 默认灰色
  }
}

// 根据优先级返回对应的颜色
function getPriorityColor(priority) {
  if (!priority) return '#999';
  
  priority = priority.toLowerCase();
  if (priority.includes('highest') || priority.includes('紧急') || priority.includes('critical')) {
    return '#FF5630';  // 红色
  } else if (priority.includes('high') || priority.includes('高')) {
    return '#FF8B00';  // 橙色
  } else if (priority.includes('medium') || priority.includes('中')) {
    return '#FFAB00';  // 黄色
  } else if (priority.includes('low') || priority.includes('低')) {
    return '#36B37E';  // 绿色
  } else if (priority.includes('lowest') || priority.includes('微小')) {
    return '#7A869A';  // 灰色
  } else {
    return '#999';     // 默认灰色
  }
}

// 格式化日期
function formatDate(dateString) {
  if (!dateString) return '';
  
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN');
  } catch (e) {
    return dateString;
  }
}

// 页面加载完成后初始化
window.addEventListener('DOMContentLoaded', initAnalysisPage); 