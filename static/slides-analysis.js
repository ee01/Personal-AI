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
              <div style="margin-top: 5px; margin-bottom: 10px; font-size: 12px; color: #666;">
                <span style="display: inline-block; margin-right: 10px;">
                  <input type="checkbox" id="select-all-${index}" class="select-all-checkbox" data-index="${index}">
                  <label for="select-all-${index}">全选</label>
                </span>
              </div>
            </div>
            
            ${hasStatusColumn && suggestion.suggestedStatus ? `
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
              </div>
            </div>
            ` : ''}
            
            ${hasOwnerColumn && suggestion.suggestedOwner ? `
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
              </div>
            </div>
            ` : ''}
            
            ${hasTrackColumn && suggestion.suggestedTrack ? `
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
      document.getElementById('apply-updates-button').disabled = true;
      document.getElementById('apply-updates-button').textContent = '正在更新...';
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
  
  if (event.data && event.data.type === 'UPDATE_SUCCESS') {
    // 显示成功消息
    const successMessage = document.getElementById('success-message');
    const successDetails = document.getElementById('success-details');
    
    if (successMessage && successDetails) {
      successDetails.textContent = `已成功更新 ${event.data.updatedCount} 个项目信息`;
      successMessage.style.display = 'block';
      
      // 滚动到顶部
      window.scrollTo(0, 0);
      
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

// 页面加载完成后初始化
window.addEventListener('DOMContentLoaded', initAnalysisPage); 