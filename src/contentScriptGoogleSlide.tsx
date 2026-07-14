// 在文件顶部添加全局声明
declare global {
  interface Window {
    analysisPopupWindow?: Window | null;
    analysisPopupOrigin?: string;
    analysisPopupMessageCleanup?: () => void;
    slidesAnalyzerToolbarObserver?: MutationObserver;
    slidesAnalyzerToolbarCheckTimer?: number;
    slidesAnalyzerRunState?: SlidesAnalyzerRunState;
    slidesAnalyzerRequestTimeout?: number;
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
import { 
  getProjectsFromSlideWithMetadata,
  applyProjectUpdates as applySlideUpdates, 
  getPresentationIdFromUrl,
  ProjectData,
  SlideProjectExtractionMetadata,
  ProjectUpdateSuggestion
} from './slide';
import { JiraTicket } from './types';
import {
  extractJiraTicketKeys,
} from './utils/slidesAnalyzerSuggestions';
import {
  createProjectReviewSuggestion,
  createProjectUpdateSuggestion,
} from './utils/slidesAnalyzerUpdateSuggestions';
import {
  hasAttentionRiskLevelSignal,
  hasProjectRiskSignal,
} from './utils/slidesAnalyzerRisk';

const ANALYSIS_BUTTON_ID = 'analyze-projects-button';
const GOOGLE_SLIDES_TOOLBAR_SELECTOR = '.goog-toolbar-horizontal';
const SLIDES_ANALYZER_REQUEST_TIMEOUT_MS = 15000;

type SlidesAnalyzerRunState = 'idle' | 'requesting' | 'analyzing';

const SLIDES_ANALYZER_BUTTON_LABELS: Record<SlidesAnalyzerRunState, string> = {
  idle: '📊 分析项目',
  requesting: '⏳ 获取授权...',
  analyzing: '⏳ 正在分析...'
};

const SLIDES_ANALYZER_BUTTON_TITLES: Record<SlidesAnalyzerRunState, string> = {
  idle: '分析当前 Google Slides 项目信息：只生成审阅快照和可写字段建议；不会立即写回 Slides，也不会反写 Jira 或 Memory Service。',
  requesting: '正在获取授权并启动分析：仅请求当前 Slides 分析快照，重复点击不会再次授权、不会打开多份结果页，也不会写回 Slides 或反写 Jira / Memory Service。',
  analyzing: '正在分析当前 Google Slides 项目信息：请等待结果页；重复点击只提示等待，不会重复跑分析、不会写回 Slides 或反写 Jira / Memory Service。'
};

const SLIDES_ANALYZER_BUSY_TOASTS: Record<Exclude<SlidesAnalyzerRunState, 'idle'>, string> = {
  requesting: 'Slides 分析正在获取授权，请等待当前请求完成；重复点击不会再次授权、不会打开多份结果页，也不会写回 Slides 或反写 Jira / Memory Service。',
  analyzing: 'Slides 分析正在进行，请等待当前结果页打开后再重试；重复点击不会重复跑分析、不会写回 Slides 或反写 Jira / Memory Service。'
};

function hasSuggestedWritebackField(suggestion: ProjectUpdateSuggestion): boolean {
  return Boolean(
    suggestion.suggestedStatus ||
    suggestion.suggestedOwner ||
    suggestion.suggestedTrack ||
    suggestion.suggestedComments
  );
}

function getSlidesAnalyzerRunState(): SlidesAnalyzerRunState {
  return window.slidesAnalyzerRunState || 'idle';
}

function clearSlidesAnalyzerRequestTimeout() {
  if (window.slidesAnalyzerRequestTimeout === undefined) {
    return;
  }

  window.clearTimeout(window.slidesAnalyzerRequestTimeout);
  window.slidesAnalyzerRequestTimeout = undefined;
}

function updateAnalysisButtonState(targetButton?: HTMLElement | null) {
  const button = targetButton || document.getElementById(ANALYSIS_BUTTON_ID);
  if (!button) {
    return;
  }

  const state = getSlidesAnalyzerRunState();
  const isBusy = state !== 'idle';
  const title = SLIDES_ANALYZER_BUTTON_TITLES[state];

  button.textContent = SLIDES_ANALYZER_BUTTON_LABELS[state];
  button.setAttribute('aria-label', title);
  button.setAttribute('title', title);
  button.setAttribute('aria-disabled', isBusy ? 'true' : 'false');
  if (isBusy) {
    button.setAttribute('aria-busy', 'true');
  } else {
    button.removeAttribute('aria-busy');
  }
  button.style.cursor = isBusy ? 'wait' : 'pointer';
  button.style.opacity = isBusy ? '0.68' : '1';
}

function setSlidesAnalyzerRunState(state: SlidesAnalyzerRunState) {
  window.slidesAnalyzerRunState = state;

  if (state !== 'requesting') {
    clearSlidesAnalyzerRequestTimeout();
  }

  updateAnalysisButtonState();
}

function isSlidesAnalyzerBusy(): boolean {
  return getSlidesAnalyzerRunState() !== 'idle';
}

function getSlidesAnalyzerBusyToastMessage(): string {
  const state = getSlidesAnalyzerRunState();
  return state === 'idle'
    ? 'Slides 分析尚未启动；点击入口只会生成审阅快照，不会直接写回 Slides。'
    : SLIDES_ANALYZER_BUSY_TOASTS[state];
}

// 分析结果接口
export interface DisplaySlideAnalysisResult {
  projects: ProjectData[];
  updateSuggestions: ProjectUpdateSuggestion[];
  summary: {
    totalProjects: number;
    projectsNeedingUpdate: number;
    normalProjects: number;
    attentionProjects: number;
    riskProjects: number;
    keyFindings: string[];
    analysisWarnings?: string[];
    analyzedSlideCount?: number;
    totalSlideCount?: number;
    requestedSlideId?: string;
  };
}

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
      setSlidesAnalyzerRunState('idle');
      sendResponse({ success: false, error: '未提供认证token' });
      return true;
    }

    if (getSlidesAnalyzerRunState() === 'analyzing') {
      const errorMessage = '已有 Slides 分析正在进行，请等待当前结果页打开后再重试';
      showToast(errorMessage, 'warning');
      sendResponse({ success: false, error: errorMessage });
      return true;
    }

    setSlidesAnalyzerRunState('analyzing');
    
    analyzeSlideProjects(token).then(() => {
      sendResponse({ success: true });
    }).catch((error) => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      sendResponse({ success: false, error: errorMessage });
    });
  } else if (type === 'SLIDES_ANALYSIS_AUTH_FAILED') {
    const errorMessage = message.error || '获取 Google 认证失败，请重新授权后再试';
    console.error('Slides分析认证失败:', errorMessage);
    if (getSlidesAnalyzerRunState() === 'analyzing') {
      console.warn('忽略分析进行中的重复授权失败消息:', errorMessage);
      sendResponse({ success: true });
      return true;
    }

    setSlidesAnalyzerRunState('idle');
    showToast(errorMessage, 'error');
    sendResponse({ success: true });
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

  installAnalysisButtonWhenReady();
  window.addEventListener('load', installAnalysisButtonWhenReady, { once: true });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installAnalysisButtonWhenReady, { once: true });
  }

  if (window.slidesAnalyzerToolbarObserver) {
    return;
  }

  window.slidesAnalyzerToolbarObserver = new MutationObserver(scheduleAnalysisButtonCheck);

  const startObservingToolbarHost = () => {
    if (!document.body || !window.slidesAnalyzerToolbarObserver) {
      return;
    }

    window.slidesAnalyzerToolbarObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  };

  if (document.body) {
    startObservingToolbarHost();
  } else {
    document.addEventListener('DOMContentLoaded', startObservingToolbarHost, { once: true });
  }
}

// 添加分析按钮到Google Slides界面
function installAnalysisButtonWhenReady() {
  addAnalysisButton();
  window.setTimeout(addAnalysisButton, 1000);
  window.setTimeout(addAnalysisButton, 2500);
}

function scheduleAnalysisButtonCheck() {
  if (window.slidesAnalyzerToolbarCheckTimer !== undefined) {
    return;
  }

  window.slidesAnalyzerToolbarCheckTimer = window.setTimeout(() => {
    window.slidesAnalyzerToolbarCheckTimer = undefined;
    addAnalysisButton();
  }, 100);
}

function addAnalysisButton(): boolean {
  // 查找Google Slides工具栏
  const toolbar = document.querySelector(GOOGLE_SLIDES_TOOLBAR_SELECTOR);
  if (!toolbar) {
    console.debug('未找到Google Slides工具栏，等待界面渲染');
    return false;
  }

  // 检查按钮是否已存在
  const existingButton = document.getElementById(ANALYSIS_BUTTON_ID);
  if (existingButton && toolbar.contains(existingButton)) {
    return true;
  }
  existingButton?.remove();

  // 创建按钮
  const button = document.createElement('div');
  button.id = ANALYSIS_BUTTON_ID;
  button.className = 'goog-toolbar-button';
  button.setAttribute('role', 'button');
  button.setAttribute('tabindex', '0');
  button.style.display = 'inline-flex';
  button.style.alignItems = 'center';
  button.style.padding = '0 8px';
  button.style.color = '#444';
  button.style.fontWeight = 'bold';
  updateAnalysisButtonState(button);

  const requestAnalysis = () => {
    if (isSlidesAnalyzerBusy()) {
      showToast(getSlidesAnalyzerBusyToastMessage(), 'warning');
      return;
    }

    setSlidesAnalyzerRunState('requesting');
    window.slidesAnalyzerRequestTimeout = window.setTimeout(() => {
      window.slidesAnalyzerRequestTimeout = undefined;
      if (getSlidesAnalyzerRunState() !== 'requesting') {
        return;
      }

      setSlidesAnalyzerRunState('idle');
      showToast(
        '分析启动超时，请确认扩展仍在运行后重试；本次没有打开结果页、没有写回 Slides，也没有反写 Jira 或 Memory Service。',
        'warning',
      );
    }, SLIDES_ANALYZER_REQUEST_TIMEOUT_MS);

    // 通知background脚本或popup我们需要token
    chrome.runtime.sendMessage({ type: 'REQUEST_SLIDES_ANALYSIS' });
  };

  // 添加事件监听
  button.addEventListener('click', requestAnalysis);
  button.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();
    requestAnalysis();
  });
  
  // 添加到工具栏
  toolbar.appendChild(button);
  console.log('已添加项目分析按钮');
  return true;
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
    const extractionResult = await getProjectsFromSlideWithMetadata(presentationId, token, undefined, currentUrl, {useLLMFallback: true});
    const projectsData = extractionResult.projects;
    
    if (!projectsData || projectsData.length === 0) {
      const extractionWarning = extractionResult.metadata.warnings[0];
      showToast(extractionWarning ? `未找到项目信息：${extractionWarning}` : '未找到项目信息', 'warning');
      return;
    }
    
    showToast(`找到 ${projectsData.length} 个项目，正在分析...`);
    console.log('需求处理的目标projects数据: ', projectsData);
    
    // 分析项目数据
    const analysisResult = await analyzeProjectsData(projectsData, extractionResult.metadata);
    
    // 显示分析结果
    showAnalysisResults(analysisResult, presentationId, token);
  } catch (error) {
    console.error('分析项目信息时出错:', error);
    showToast(`分析失败: ${error instanceof Error ? error.message : String(error)}`, 'error');
    throw error;
  } finally {
    setSlidesAnalyzerRunState('idle');
  }
}

// 分析项目数据
async function analyzeProjectsData(
  projectsData: ProjectData[],
  extractionMetadata?: SlideProjectExtractionMetadata
): Promise<DisplaySlideAnalysisResult> {
  // 初始化分析结果
  const analysisResult: DisplaySlideAnalysisResult = {
    projects: projectsData,
    updateSuggestions: [],
    summary: {
      totalProjects: projectsData.length,
      projectsNeedingUpdate: 0,
      normalProjects: 0,
      attentionProjects: 0,
      riskProjects: 0,
      keyFindings: [],
      analysisWarnings: extractionMetadata?.warnings,
      analyzedSlideCount: extractionMetadata?.analyzedSlideCount,
      totalSlideCount: extractionMetadata?.totalSlideCount,
      requestedSlideId: extractionMetadata?.requestedSlideId
    }
  };
  
  // 检查是否在 background script 环境中
  const isBackground = typeof ServiceWorkerGlobalScope !== 'undefined' && self instanceof ServiceWorkerGlobalScope;
  
  // 准备批量处理项目数据
  const projectAnalysisRequests = [];
  
  // 逐个准备项目分析请求
  for (const project of projectsData) {
    // 获取Jira工单信息
    const jiraIssues: Record<string, JiraTicket> = {};
    
    const jiraKeys = extractJiraTicketKeys(
      ...Object.values(project).filter((value) => typeof value === 'string'),
    );

    for (const jiraKey of jiraKeys) {
      try {
        // 使用封装的Jira API获取数据
        const jiraTickets = await fetchJiraTickets(`key = ${jiraKey}`);
        if (jiraTickets && jiraTickets.length > 0) {
          jiraIssues[jiraKey] = jiraTickets[0];
        }
      } catch (error) {
        console.warn(`获取Jira工单信息失败: ${jiraKey}`, error);
      }
    }
    
    // 直接构建结构化数据，不再构建具体的消息内容
    // agentThinking.ts中的buildProjectAnalysisPrompt将处理提示构建
    const analysisRequest = {
      name: project.name,
      project: project,
      jiraIssues: Object.keys(jiraIssues).length > 0 ? jiraIssues : {}
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
        const requestJiraIssues = projectAnalysisRequests[i]?.jiraIssues || {};
        const resultJiraIssues = result.jiraIssues || requestJiraIssues;
        const jiraIssueList = Object.values(resultJiraIssues);
        const resultWithJiraIssues: ProjectAnalysisResult = {
          ...result,
          jiraIssues: resultJiraIssues
        };
        const suggestion = createProjectUpdateSuggestion(project, resultWithJiraIssues);
        const needsUpdate = Boolean(suggestion);
        const hasRiskSignal = hasProjectRiskSignal({
          currentStatus: project.status,
          suggestedStatus: suggestion?.suggestedStatus,
          reasons: suggestion?.reason || result.suggestions.risks,
          riskLevel: result.riskLevel,
          jiraIssues: jiraIssueList
        });

        if (hasRiskSignal) {
          analysisResult.summary.riskProjects++;
        } else if (needsUpdate || hasAttentionRiskLevelSignal(result.riskLevel)) {
          analysisResult.summary.attentionProjects++;
        } else {
          analysisResult.summary.normalProjects++;
        }

        if (suggestion) {
          analysisResult.updateSuggestions.push(suggestion);
        } else if (hasRiskSignal) {
          analysisResult.updateSuggestions.push(createProjectReviewSuggestion(project, resultWithJiraIssues));
        }
      }
    }
    
    // 设置需要更新的项目总数
    analysisResult.summary.projectsNeedingUpdate = analysisResult.updateSuggestions
      .filter(hasSuggestedWritebackField)
      .length;
    
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
function showAnalysisResults(result: DisplaySlideAnalysisResult, presentationId: string, token: string) {
  // 准备要传递的数据
  const analysisData = {
    result,
    presentationId
  };
  
  // 获取扩展URL (不再使用URL参数)
  const extensionUrl = chrome.runtime.getURL('slides-analysis.html');
  const analysisPageOrigin = new URL(extensionUrl).origin;
  
  // 打开新窗口
  const newWindow = window.open(extensionUrl, '_blank', 'width=1000,height=800,resizable=yes,scrollbars=yes');
  
  if (!newWindow) {
    showToast('弹出窗口被阻止，请允许弹出窗口并重试', 'error');
    return;
  }
  
  // 保存弹窗引用到全局变量
  window.analysisPopupMessageCleanup?.();
  window.analysisPopupWindow = newWindow;
  window.analysisPopupOrigin = analysisPageOrigin;
  console.log('保存分析窗口引用到全局变量');
  
  // 添加消息监听器，处理来自新窗口的消息
  const messageHandler = async (event: MessageEvent) => {
    if (event.source !== newWindow || event.origin !== analysisPageOrigin) {
      return;
    }

    console.log('收到来自弹出窗口的消息:', event.data);
    
    if (event.data && event.data.type === 'REQUEST_ANALYSIS_DATA') {
      // 新窗口请求分析数据
      console.log('向弹出窗口发送分析数据');
      newWindow.postMessage({
        type: 'ANALYSIS_DATA',
        data: analysisData
      }, analysisPageOrigin);
    } else if (event.data && event.data.type === 'APPLY_PROJECT_UPDATES') {
      console.log('处理项目更新请求', event.data.selectedUpdates?.length || 0);
      try {
        const { selectedUpdates } = event.data;
        // 确保所有需要的字段都存在
        if (!selectedUpdates || !Array.isArray(selectedUpdates)) {
          console.error('收到无效的更新请求', event.data);
          postToAnalysisPopup({
            type: 'UPDATE_ERROR',
            errorMessage: '收到无效的更新请求，请重新打开分析窗口后再试',
            errors: ['收到无效的更新请求，请重新打开分析窗口后再试'],
          });
          return;
        }
    
        await applyProjectUpdates(presentationId, token, selectedUpdates);
      } catch (error) {
        console.error('处理项目更新请求时出错:', error);
        showToast(`处理更新失败: ${error instanceof Error ? error.message : String(error)}`, 'error');
      }
    }
  };
  
  window.addEventListener('message', messageHandler);
  const closeCheck = window.setInterval(() => {
    if (!newWindow.closed) {
      return;
    }

    window.analysisPopupMessageCleanup?.();
  }, 30000);

  window.analysisPopupMessageCleanup = () => {
    window.removeEventListener('message', messageHandler);
    window.clearInterval(closeCheck);
    if (window.analysisPopupWindow === newWindow) {
      window.analysisPopupWindow = null;
      window.analysisPopupOrigin = undefined;
    }
    window.analysisPopupMessageCleanup = undefined;
  };
}

// 应用项目更新
async function applyProjectUpdates(presentationId: string, token: string, selectedUpdates: ProjectUpdateSuggestion[]) {
  try {
    showToast('正在应用更新...');
    
    // 使用slide.ts中的函数应用更新
    const result = await applySlideUpdates(presentationId, token, selectedUpdates);
    
    if (result.success) {
      const skippedCount = result.errors?.length || 0;
      const skippedSummary = skippedCount > 0 ? `，跳过 ${skippedCount} 项` : '';
      showToast(`成功更新了 ${result.updatedCount} 个字段${skippedSummary}`, skippedCount > 0 ? 'warning' : 'success');
      console.log('更新成功:', result);
      
      // 显示成功消息并通知弹出窗口
      showSuccessInPopup(selectedUpdates, result.updatedCount, result.errors);
    } else {
      const errorMessage = result.errors && result.errors.length > 0 
        ? result.errors.join('; ') 
        : '更新失败，请重试';
      
      showToast(`更新失败: ${errorMessage}`, 'error');
      console.error('更新失败:', result.errors);
      
      postToAnalysisPopup({
        type: 'UPDATE_ERROR',
        errorMessage,
        errors: result.errors && result.errors.length > 0 ? result.errors : [errorMessage],
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    showToast(`更新处理错误: ${errorMessage}`, 'error');
    console.error('处理更新时出错:', error);
    
    postToAnalysisPopup({
      type: 'UPDATE_ERROR',
      errorMessage,
      errors: [errorMessage],
    });
  }
}

// 在弹出窗口中显示成功消息
function showSuccessInPopup(updates: ProjectUpdateSuggestion[], updatedCount: number, errors?: string[]) {
  // 向所有打开的窗口发送消息
  const message = {
    type: 'UPDATE_SUCCESS',
    updatedCount,
    updates,
    errors
  };
  
  postToAnalysisPopup(message);
}

function postToAnalysisPopup(message: unknown) {
  if (!window.analysisPopupWindow || !window.analysisPopupOrigin) {
    console.warn('未找到可通信的分析窗口');
    return;
  }

  try {
    window.analysisPopupWindow.postMessage(message, window.analysisPopupOrigin);
  } catch (e) {
    console.warn('向分析窗口发送消息失败', e);
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
