// 在文件顶部添加全局声明
declare global {
  interface Window {
    analysisPopupWindow?: Window | null;
  }
}

import { fetchJiraTickets } from './jira';
import { 
  IntelligentAgent,
} from './agentThinking';
import { 
  AnalysisConfig,
  AnalysisContext,
  ProjectAnalysisResult
} from './interfaces/analysisInterfaces';
import { naturalLanguageQuery } from './vectorStore';
import { getEnvConfig } from './utils';
import { 
  getProjectsFromSlide, 
  applyProjectUpdates as applySlideUpdates, 
  getPresentationIdFromUrl,
  ProjectData,
  ProjectUpdateSuggestion
} from './slide';

// 分析结果接口
interface AnalysisResult {
  projects: ProjectData[];
  updateSuggestions: ProjectUpdateSuggestion[];
  summary: {
    totalProjects: number;
    projectsNeedingUpdate: number;
    normalProjects: number;
    attentionProjects: number;
    riskProjects: number;
    keyFindings: string[];
  };
}

// 不再需要扩展MessageProcessResult接口
// 使用ProjectAnalysisResult代替
// interface ExtendedMessageProcessResult extends MessageProcessResult {
//   enrichedData?: {
//     suggestedStatus?: string;
//     suggestedOwner?: string;
//     suggestedTrack?: string;
//     suggestedComments?: string;
//     [key: string]: any;
//   };
// }

// 主监听器
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('收到消息:', message, '发送者:', sender);

  if (!message || !message.type) {
    console.warn('收到无效消息格式');
    sendResponse({ success: false, error: '无效消息格式' });
    return true;
  }

  const { type, token } = message;

  if (type === 'ANALYZE_SLIDES_PROJECTS') {
    if (!token) {
      console.error('未提供认证token');
      sendResponse({ success: false, error: '未提供认证token' });
      return true;
    }
    
    analyzeSlideProjects(token).then(() => {
      sendResponse({ success: true });
    });
  } else {
    console.log('未处理的消息类型:', type);
  }

  return true;
});

// 初始化，添加分析按钮
function initializeSlidesAnalyzer() {
  // 确认我们在Google Slides页面
  if (!window.location.href.includes('docs.google.com/presentation')) {
    return;
  }

  console.log('Google Slides项目分析器初始化');

  // 监听页面加载完成
  window.addEventListener('load', () => {
    // 添加分析按钮到Google Slides界面
    setTimeout(addAnalysisButton, 2000);
  });
}

// 添加分析按钮到Google Slides界面
function addAnalysisButton() {
  // 查找Google Slides工具栏
  const toolbar = document.querySelector('.goog-toolbar-horizontal');
  if (!toolbar) {
    console.warn('未找到Google Slides工具栏，尝试延迟添加');
    setTimeout(addAnalysisButton, 2000);
    return;
  }

  // 检查按钮是否已存在
  if (document.getElementById('analyze-projects-button')) {
    return;
  }

  // 创建按钮
  const button = document.createElement('div');
  button.id = 'analyze-projects-button';
  button.className = 'goog-toolbar-button';
  button.setAttribute('role', 'button');
  button.setAttribute('aria-disabled', 'false');
  button.style.display = 'inline-flex';
  button.style.alignItems = 'center';
  button.style.padding = '0 8px';
  button.style.cursor = 'pointer';
  button.style.color = '#444';
  button.style.fontWeight = 'bold';
  button.innerHTML = '📊 分析项目';
  
  // 添加事件监听
  button.addEventListener('click', () => {
    // 通知background脚本或popup我们需要token
    chrome.runtime.sendMessage({ type: 'REQUEST_SLIDES_ANALYSIS' });
  });
  
  // 添加到工具栏
  toolbar.appendChild(button);
  console.log('已添加项目分析按钮');
}

// 分析幻灯片中的项目信息
async function analyzeSlideProjects(token: string) {
  try {
    showToast('正在分析项目信息...');
    
    // 获取当前URL
    const currentUrl = window.location.href;
    
    // 从URL获取演示文稿ID
    const presentationId = getPresentationIdFromUrl(currentUrl);
    
    // 获取幻灯片内容，传入当前URL以便只分析当前幻灯片
    const projectsData = await getProjectsFromSlide(presentationId, token, undefined, currentUrl, {useLLMFallback: true});
    
    if (!projectsData || projectsData.length === 0) {
      showToast('未找到项目信息', 'warning');
      return;
    }
    
    showToast(`找到 ${projectsData.length} 个项目，正在分析...`);
    console.log('需求处理的目标projects数据: ', projectsData);
    
    // 分析项目数据
    const analysisResult = await analyzeProjectsData(projectsData);
    
    // 显示分析结果
    showAnalysisResults(analysisResult, presentationId, token);
  } catch (error) {
    console.error('分析项目信息时出错:', error);
    showToast(`分析失败: ${error instanceof Error ? error.message : String(error)}`, 'error');
  }
}

// 分析项目数据
async function analyzeProjectsData(projectsData: ProjectData[]): Promise<AnalysisResult> {
  // 初始化分析结果
  const analysisResult: AnalysisResult = {
    projects: projectsData,
    updateSuggestions: [],
    summary: {
      totalProjects: projectsData.length,
      projectsNeedingUpdate: 0,
      normalProjects: 0,
      attentionProjects: 0,
      riskProjects: 0,
      keyFindings: []
    }
  };
  
  // 检查是否在 background script 环境中
  const isBackground = typeof window === 'undefined';
  
  // 准备批量处理项目数据
  const projectAnalysisRequests = [];
  
  // 逐个准备项目分析请求
  for (const project of projectsData) {
    // 获取Jira工单信息
    let jiraData: Record<string, any> | null = null;
    if (project.id && project.id.match(/[A-Z]+-\d+/)) {
      try {
        // 使用封装的Jira API获取数据
        const jiraTickets = await fetchJiraTickets(`key = ${project.id}`);
        if (jiraTickets && jiraTickets.length > 0) {
          jiraData = jiraTickets[0];
        }
      } catch (error) {
        console.warn(`获取Jira工单信息失败: ${project.id}`, error);
      }
    }
    
    // 直接构建结构化数据，不再构建具体的消息内容
    // agentThinking.ts中的buildProjectAnalysisPrompt将处理提示构建
    const analysisRequest = {
      name: project.name,
      project: project,
      jiraData: jiraData
    };
    
    projectAnalysisRequests.push(analysisRequest);
  }
  
  try {
    // 创建分析配置
    const config: AnalysisConfig = {
      type: 'project',
      analysisDepth: 'normal',
      maxActions: 5,
      preferredTools: ['jiraQuery', 'historySearch']
    };
    
    // 创建分析上下文
    const context: AnalysisContext = {
      currentUser: 'system'
    };
    
    // 分析结果数组
    let analysisResults = [];
    
    // 使用agentThinking的批量分析功能
    if (isBackground) {
      // 在background环境使用新版API批量处理
      const agent = new IntelligentAgent();
      analysisResults = await agent.analyzeBatch(
        projectAnalysisRequests,
        config,
        context
      );
    } else {
      // 在content script环境通过message passing处理
      analysisResults = await Promise.all(
        projectAnalysisRequests.map(request => 
          chrome.runtime.sendMessage({
            type: 'ANALYZE_PROJECT',
            data: {
              request,
              config,
              context
            }
          })
        )
      );
    }
    
    // 处理分析结果
    for (let i = 0; i < projectsData.length; i++) {
      const project = projectsData[i];
      const result = analysisResults[i] as ProjectAnalysisResult;
      
      if (result && result.suggestions) {
        // 获取建议更新值 - 简化结构，直接获取数组的第一个元素作为建议值
        // 注意: 新结构中suggestions中的每个字段应该直接是字符串数组
        
        // 只为存在的列创建建议
        const hasStatusColumn = project.columnIndices?.status !== undefined;
        const hasOwnerColumn = project.columnIndices?.owner !== undefined;
        const hasTrackColumn = project.columnIndices?.track !== undefined;
        const hasCommentsColumn = project.columnIndices?.comments !== undefined;
        
        // 根据实际存在的列获取建议值
        const suggestedStatus = hasStatusColumn && result.suggestions.status;
        const suggestedOwner = hasOwnerColumn && result.suggestions.owner;
        const suggestedTrack = hasTrackColumn && result.suggestions.track;
        const comments = Array.isArray(result.suggestions.highlights) && result.suggestions.highlights.length > 0 
        ? result.suggestions.highlights.join('\n') : result.suggestions.highlights
        const actions = Array.isArray(result.suggestions.actionItems) && result.suggestions.actionItems.length > 0 
        ? result.suggestions.actionItems.join('\n') : result.suggestions.actionItems
        const suggestedComments = hasCommentsColumn && (comments + '\n' + actions);
        
        // 获取更新理由
        const reasons = Array.isArray(result.suggestions.risks) ? result.suggestions.risks : [];
        
        // 标记是否需要更新
        const needsUpdate = 
          (hasStatusColumn && suggestedStatus && suggestedStatus !== project.status) ||
          (hasOwnerColumn && suggestedOwner && suggestedOwner !== project.owner) ||
          (hasTrackColumn && suggestedTrack && suggestedTrack !== project.track) ||
          (hasCommentsColumn && suggestedComments && !project.comments?.includes(suggestedComments));
        
        if (needsUpdate) {
          const suggestion: ProjectUpdateSuggestion = {
            projectId: project.id,
            projectName: project.name,
            currentStatus: project.status,
            currentOwner: project.owner,
            currentTrack: project.track,
            currentComments: project.comments,
            reason: reasons,
            sourceInfo: {
              jiraStatus: result.jiraData?.status || '',
              jiraComments: Array.isArray(result.jiraData?.comments) ? result.jiraData?.comments : [],
              chatHistory: []
            },
            confidence: result.confidence || 0.5,
            // 添加幻灯片位置信息
            slideId: project.slideId,
            tableId: project.tableId,
            rowIndex: project.row,
            columnIndices: {
              status: project.columnIndices?.status,
              owner: project.columnIndices?.owner,
              track: project.columnIndices?.track,
              comments: project.columnIndices?.comments
            }
          };
          
          // 只添加实际存在列的建议更新字段
          if (hasStatusColumn && suggestedStatus) {
            suggestion.suggestedStatus = suggestedStatus;
            suggestion.suggestedStatusReason = (result.suggestions.statusReason || '');
          }
          
          if (hasOwnerColumn && suggestedOwner) {
            suggestion.suggestedOwner = suggestedOwner;
            suggestion.suggestedOwnerReason = (result.suggestions.ownerReason || '');
          }
          
          if (hasTrackColumn && suggestedTrack) {
            suggestion.suggestedTrack = suggestedTrack;
          }
          
          if (hasCommentsColumn && suggestedComments) {
            suggestion.suggestedComments = suggestedComments;
            suggestion.suggestedCommentsReason = (result.suggestions.highlightsReason || '');
            suggestion.suggestedCommentsReason += '\n' + (result.suggestions.actionItemsReason || '');
          }
          
          analysisResult.updateSuggestions.push(suggestion);
        }
        
        // 更新统计数据
        const statusHasRisk = project.status.toLowerCase().includes('risk');
        const suggestedStatusHasRisk = suggestedStatus && suggestedStatus.toLowerCase().includes('risk');
        
        if (statusHasRisk || (needsUpdate && suggestedStatusHasRisk) || result.riskLevel === 'critical' || result.riskLevel === 'high') {
          analysisResult.summary.riskProjects++;
        } else if (needsUpdate || result.riskLevel === 'normal') {
          analysisResult.summary.attentionProjects++;
        } else {
          analysisResult.summary.normalProjects++;
        }
      }
    }
    
    // 设置需要更新的项目总数
    analysisResult.summary.projectsNeedingUpdate = analysisResult.updateSuggestions.length;
    
    // 生成关键发现
    if (analysisResult.updateSuggestions.length > 0) {
      // 提取主要的发现点
      analysisResult.updateSuggestions.forEach(suggestion => {
        if (suggestion.suggestedStatus && suggestion.suggestedStatus !== suggestion.currentStatus) {
          analysisResult.summary.keyFindings.push(
            `${suggestion.projectName}(${suggestion.projectId})项目状态需要从"${suggestion.currentStatus}"更新为"${suggestion.suggestedStatus}"`
          );
        }
        
        // 添加其他重要发现
        if (suggestion.reason && suggestion.reason.length > 0) {
          const mainReason = suggestion.reason[0];
          if (mainReason && !analysisResult.summary.keyFindings.includes(mainReason)) {
            analysisResult.summary.keyFindings.push(mainReason);
          }
        }
      });
    }
    
    // 限制关键发现数量
    if (analysisResult.summary.keyFindings.length > 5) {
      analysisResult.summary.keyFindings = analysisResult.summary.keyFindings.slice(0, 5);
    }
    
    return analysisResult;
  } catch (error) {
    console.error('项目分析失败:', error);
    throw error;
  }
}

// 显示分析结果
function showAnalysisResults(result: AnalysisResult, presentationId: string, token: string) {
  // 准备要传递的数据
  const analysisData = {
    result,
    presentationId,
    token
  };
  
  // 将数据转为JSON字符串并编码
  const encodedData = encodeURIComponent(JSON.stringify(analysisData));
  
  // 获取扩展URL
  const extensionUrl = chrome.runtime.getURL('slides-analysis.html');
  
  // 打开新窗口，带上数据作为URL参数
  const newWindow = window.open(`${extensionUrl}?data=${encodedData}`, '_blank', 'width=800,height=800,resizable=yes,scrollbars=yes');
  
  if (!newWindow) {
    showToast('弹出窗口被阻止，请允许弹出窗口并重试', 'error');
    return;
  }
  
  // 保存弹窗引用到全局变量
  window.analysisPopupWindow = newWindow;
  console.log('保存分析窗口引用到全局变量');
  
  // 添加消息监听器，处理来自新窗口的消息
  const messageHandler = async (event: MessageEvent) => {
    console.log('收到来自弹出窗口的消息:', event.data);
    
    if (event.data && event.data.type === 'APPLY_PROJECT_UPDATES') {
      console.log('处理项目更新请求', event.data.selectedUpdates?.length || 0);
      try {
        const { presentationId, token, selectedUpdates } = event.data;
        // 确保所有需要的字段都存在
        if (!presentationId || !token || !selectedUpdates || !Array.isArray(selectedUpdates)) {
          console.error('收到无效的更新请求', event.data);
          return;
        }
    
        await applyProjectUpdates(presentationId, token, selectedUpdates);
      } catch (error) {
        console.error('处理项目更新请求时出错:', error);
        showToast(`处理更新失败: ${error instanceof Error ? error.message : String(error)}`, 'error');
      }
    } else if (event.data && event.data.type === 'POPUP_READY') {
      console.log('弹出窗口已准备好接收消息');
    }
  };
  
  // 移除任何现有的消息处理程序，以避免重复
  window.removeEventListener('message', messageHandler);
  window.addEventListener('message', messageHandler);
}

// 应用项目更新
async function applyProjectUpdates(presentationId: string, token: string, selectedUpdates: ProjectUpdateSuggestion[]) {
  try {
    showToast('正在应用更新...');
    
    // 使用slide.ts中的函数应用更新
    const result = await applySlideUpdates(presentationId, token, selectedUpdates);
    
    if (result.success) {
      showToast(`成功更新了 ${result.updatedCount} 个项目字段`, 'success');
      console.log('更新成功:', result);
      
      // 显示成功消息并通知弹出窗口
      showSuccessInPopup(selectedUpdates, result.updatedCount);
    } else {
      const errorMessage = result.errors && result.errors.length > 0 
        ? result.errors.join('; ') 
        : '更新失败，请重试';
      
      showToast(`更新失败: ${errorMessage}`, 'error');
      console.error('更新失败:', result.errors);
      
      // 向弹出窗口发送错误消息
      if (window.analysisPopupWindow) {
        window.analysisPopupWindow.postMessage({
          type: 'UPDATE_ERROR',
          errorMessage
        }, '*');
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    showToast(`更新处理错误: ${errorMessage}`, 'error');
    console.error('处理更新时出错:', error);
    
    // 向弹出窗口发送错误消息
    if (window.analysisPopupWindow) {
      window.analysisPopupWindow.postMessage({
        type: 'UPDATE_ERROR',
        errorMessage
      }, '*');
    }
  }
}

// 在弹出窗口中显示成功消息
function showSuccessInPopup(updates: ProjectUpdateSuggestion[], updatedCount: number) {
  // 向所有打开的窗口发送消息
  const message = {
    type: 'UPDATE_SUCCESS',
    updatedCount,
    updates
  };
  
  // 尝试向弹出窗口发送消息
  try {
    console.log('准备发送UPDATE_SUCCESS消息给分析窗口');
    
    // 首先尝试使用已保存的窗口引用
    if (window.analysisPopupWindow) {
      console.log('使用已保存的分析窗口引用发送消息');
      window.analysisPopupWindow.postMessage(message, '*');
      return;
    }
    
    console.log('未找到已保存的分析窗口引用，尝试使用其他方法');
    
    // 如果没有保存的窗口引用，尝试其他方法
    // 检查当前窗口是否有子窗口
    if (window.frames && window.frames.length > 0) {
      console.log(`尝试向 ${window.frames.length} 个子窗口发送消息`);
      for (let i = 0; i < window.frames.length; i++) {
        try {
          window.frames[i].postMessage(message, '*');
          console.log(`向子窗口 ${i} 发送消息成功`);
        } catch (e) {
          console.warn(`向子窗口 ${i} 发送消息失败`, e);
        }
      }
    }
    
    // 尝试向opener窗口发送消息
    if (window.opener) {
      console.log('尝试向opener窗口发送消息');
      window.opener.postMessage(message, '*');
    }
  } catch (e) {
    console.warn('处理弹出窗口引用失败', e);
  }
}

// 显示通知提示
function showToast(message: string, type = 'info') {
  // 移除任何已存在的toast
  const existingToast = document.getElementById('slides-analyzer-toast');
  if (existingToast) {
    document.body.removeChild(existingToast);
  }
  
  // 创建新的toast
  const toast = document.createElement('div');
  toast.id = 'slides-analyzer-toast';
  
  // 设置样式根据消息类型
  let backgroundColor = '#2196F3'; // 默认蓝色(info)
  if (type === 'success') backgroundColor = '#4CAF50'; // 绿色
  if (type === 'warning') backgroundColor = '#FF9800'; // 橙色
  if (type === 'error') backgroundColor = '#F44336'; // 红色
  
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background-color: ${backgroundColor};
    color: white;
    padding: 12px 20px;
    border-radius: 4px;
    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    z-index: 10001;
    font-family: Arial, sans-serif;
    font-size: 14px;
    max-width: 300px;
  `;
  
  toast.textContent = message;
  document.body.appendChild(toast);
  
  // 5秒后自动移除
  setTimeout(() => {
    if (document.body.contains(toast)) {
      document.body.removeChild(toast);
    }
  }, 5000);
}

// 初始化
initializeSlidesAnalyzer(); 