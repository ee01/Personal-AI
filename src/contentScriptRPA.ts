/**
 * RPA 站点内容脚本
 * 在 https://rpa.int.rclabenv.com/ 添加"导入到我的定时消息"按钮
 */

import { 
  analyzeTriggerForScheduledMessages, 
  buildScheduleMessageFields 
} from './scheduled-messages/scheduleUtils';

// 类型定义
interface ExportedRule {
  id?: number;
  clientKey?: string;
  name: string;
  state: string;
  description?: string;
  canOtherRuleTrigger: boolean;
  notifyOnError: string;
  authorAccountId: string;
  actorAccountId?: string;
  created?: number;
  updated?: number;
  trigger: any;
  components: any[];
  projects: Array<{
    projectId: string;
    projectTypeKey: string;
  }>;
  labels: any[];
  tags?: any[];
}

interface ExportedData {
  rules: ExportedRule[];
  cloud: boolean;
}

interface ImportRule {
  name: string;
  isNewRule: boolean;
  state: string;
  canOtherRuleTrigger: boolean;
  notifyOnError: string;
  authorAccountId: string;
  created: number;
  updated: number;
  components: any[];
  trigger: any;
  labels: any[];
  description?: string;
  projects: Array<{
    projectId: string;
    projectTypeKey: string;
  }>;
}

interface RPACardData {
  title: string;
  author: string;
  ability: string;
  scope: string;
  description?: string;
  scriptData?: string;
  jiraAutomationUrl?: string;
}

// 存储已添加按钮的卡片，避免重复添加
const addedImportButtons = new Set<string>();

// 检测是否在 RPA 站点
function isRPASite(): boolean {
  return window.location.hostname === 'rpa.int.rclabenv.com';
}

// 显示成功消息
function showSuccessMessage(message: string, onOpenClick?: () => void): void {
  const successDiv = document.createElement('div');
  successDiv.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background-color: #4CAF50;
    color: white;
    padding: 20px 24px;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    z-index: 10001;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    max-width: 450px;
    text-align: center;
  `;
  
  const messageText = document.createElement('p');
  messageText.style.cssText = 'margin: 0 0 16px 0; font-size: 16px;';
  messageText.textContent = message;
  successDiv.appendChild(messageText);
  
  const buttonsContainer = document.createElement('div');
  buttonsContainer.style.cssText = 'display: flex; gap: 12px; justify-content: center;';
  
  if (onOpenClick) {
    const openButton = document.createElement('button');
    openButton.textContent = '打开定时消息管理';
    openButton.style.cssText = `
      padding: 10px 20px;
      background-color: white;
      color: #4CAF50;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
    `;
    openButton.addEventListener('click', () => {
      document.body.removeChild(successDiv);
      onOpenClick();
    });
    buttonsContainer.appendChild(openButton);
  }
  
  const closeButton = document.createElement('button');
  closeButton.textContent = '关闭';
  closeButton.style.cssText = `
    padding: 10px 20px;
    background-color: rgba(255, 255, 255, 0.2);
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.4);
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
  `;
  closeButton.addEventListener('click', () => {
    document.body.removeChild(successDiv);
  });
  buttonsContainer.appendChild(closeButton);
  
  successDiv.appendChild(buttonsContainer);
  document.body.appendChild(successDiv);
}

// 显示错误消息
function showErrorMessage(message: string): void {
  const errorDiv = document.createElement('div');
  errorDiv.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background-color: #f44336;
    color: white;
    padding: 16px 24px;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    z-index: 10001;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    max-width: 450px;
    word-wrap: break-word;
    text-align: center;
  `;
  
  const messageText = document.createElement('p');
  messageText.style.cssText = 'margin: 0 0 16px 0;';
  messageText.textContent = message;
  errorDiv.appendChild(messageText);
  
  const closeButton = document.createElement('button');
  closeButton.textContent = '关闭';
  closeButton.style.cssText = `
    padding: 8px 16px;
    background-color: rgba(255, 255, 255, 0.2);
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.4);
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
  `;
  closeButton.addEventListener('click', () => {
    document.body.removeChild(errorDiv);
  });
  errorDiv.appendChild(closeButton);
  
  document.body.appendChild(errorDiv);
}

// 显示加载消息
function showLoadingMessage(message: string): HTMLElement {
  const loadingDiv = document.createElement('div');
  loadingDiv.id = 'personal-ai-rpa-loading';
  loadingDiv.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background-color: #0052cc;
    color: white;
    padding: 16px 24px;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    z-index: 10002;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    display: flex;
    align-items: center;
    gap: 12px;
  `;
  loadingDiv.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 20 20" style="animation: spin 1s linear infinite;">
      <circle cx="10" cy="10" r="8" fill="none" stroke="white" stroke-width="2" stroke-dasharray="40" stroke-dashoffset="10"/>
    </svg>
    <span>${message}</span>
  `;
  
  // 添加旋转动画
  if (!document.getElementById('personal-ai-rpa-spin-style')) {
    const style = document.createElement('style');
    style.id = 'personal-ai-rpa-spin-style';
    style.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
    document.head.appendChild(style);
  }
  
  document.body.appendChild(loadingDiv);
  return loadingDiv;
}

// 隐藏加载消息
function hideLoadingMessage(): void {
  const loadingDiv = document.getElementById('personal-ai-rpa-loading');
  if (loadingDiv) {
    loadingDiv.remove();
  }
}

// 更新加载消息文本
function updateLoadingMessage(message: string): void {
  const loadingDiv = document.getElementById('personal-ai-rpa-loading');
  if (loadingDiv) {
    const span = loadingDiv.querySelector('span');
    if (span) {
      span.textContent = message;
    }
  }
}

// 显示项目选择对话框（只需填写 projectKey，自动获取 projectId）
function showProjectSelectionDialog(ruleName: string): Promise<{ confirmed: boolean; projectKey: string } | null> {
  return new Promise((resolve) => {
    // 创建遮罩
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(0, 0, 0, 0.5);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    
    // 创建对话框
    const dialog = document.createElement('div');
    dialog.style.cssText = `
      background: white;
      border-radius: 12px;
      padding: 28px;
      max-width: 450px;
      width: 90%;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    
    dialog.innerHTML = `
      <h3 style="margin: 0 0 20px; font-size: 20px; color: #172B4D;">导入到我的定时消息</h3>
      <div style="margin-bottom: 20px; padding: 16px; background: #F4F5F7; border-radius: 8px;">
        <p style="margin: 0 0 8px; color: #5E6C84; font-size: 13px;">规则名称</p>
        <p style="margin: 0; font-weight: 500; color: #172B4D;">${ruleName}</p>
      </div>
      <div style="margin-bottom: 24px;">
        <label style="display: block; margin-bottom: 8px; font-weight: 500; color: #172B4D;">
          输入要导入的 JIRA 项目 Key
        </label>
        <input type="text" id="project-key-input" placeholder="项目 Key (如 MTR, RPC, NOVA)" 
          style="width: 100%; padding: 12px 14px; border: 2px solid #DFE1E6; border-radius: 6px; font-size: 14px; outline: none; transition: border-color 0.2s; box-sizing: border-box;"
          onfocus="this.style.borderColor='#0052cc'" onblur="this.style.borderColor='#DFE1E6'">
        <p id="project-error" style="margin: 8px 0 0; font-size: 12px; color: #f44336; display: none;"></p>
        <p style="margin: 8px 0 0; font-size: 12px; color: #6B778C;">
          💡 项目 Key 通常是 JIRA ticket 的前缀，如 MTR-1234 中的 MTR
        </p>
      </div>
      <div style="margin-bottom: 20px; padding: 14px; background: #FFFAE6; border-radius: 8px; border-left: 4px solid #FFAB00;">
        <p style="margin: 0; font-size: 13px; color: #172B4D;">
          ⚠️ 导入后规则将设置为 <strong>暂停</strong> 状态，你可以在定时消息管理中启用
        </p>
      </div>
      <div style="display: flex; gap: 12px; justify-content: flex-end;">
        <button id="cancel-btn" style="padding: 10px 20px; border: 1px solid #DFE1E6; border-radius: 6px; background: white; cursor: pointer; font-size: 14px; color: #5E6C84;">取消</button>
        <button id="confirm-btn" style="padding: 10px 24px; border: none; border-radius: 6px; background: #0052cc; color: white; cursor: pointer; font-size: 14px; font-weight: 500;">确认导入</button>
      </div>
    `;
    
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    
    // 事件处理
    const cancelBtn = dialog.querySelector('#cancel-btn') as HTMLButtonElement;
    const confirmBtn = dialog.querySelector('#confirm-btn') as HTMLButtonElement;
    const projectKeyInput = dialog.querySelector('#project-key-input') as HTMLInputElement;
    const projectError = dialog.querySelector('#project-error') as HTMLParagraphElement;
    
    cancelBtn.addEventListener('click', () => {
      document.body.removeChild(overlay);
      resolve(null);
    });
    
    confirmBtn.addEventListener('click', () => {
      const projectKey = projectKeyInput.value.trim().toUpperCase();
      
      if (!projectKey) {
        projectKeyInput.style.borderColor = '#f44336';
        projectError.textContent = '请输入项目 Key';
        projectError.style.display = 'block';
        return;
      }
      
      // 验证项目 Key 格式（字母和数字组成）
      if (!/^[A-Z][A-Z0-9]*$/.test(projectKey)) {
        projectKeyInput.style.borderColor = '#f44336';
        projectError.textContent = '项目 Key 格式不正确，应以字母开头，只包含字母和数字';
        projectError.style.display = 'block';
        return;
      }
      
      document.body.removeChild(overlay);
      resolve({ confirmed: true, projectKey });
    });
    
    // 输入时清除错误
    projectKeyInput.addEventListener('input', () => {
      projectError.style.display = 'none';
      projectKeyInput.style.borderColor = '#DFE1E6';
    });
    
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        document.body.removeChild(overlay);
        resolve(null);
      }
    });
  });
}

// 转换导出的JSON格式为API所需格式
async function convertExportedRuleToImportFormat(exportedRule: ExportedRule, projectId: string, ownerId: string): Promise<ImportRule> {
  const now = Date.now();
  
  // 为components生成新的ID
  const convertedComponents = exportedRule.components.map((component, index) => ({
    ...component,
    id: `__NEW__COMPONENT__${now + index}`
  }));
  
  // 为trigger设置新的ID
  const convertedTrigger = {
    ...exportedRule.trigger,
    id: '__NEW__TRIGGER'
  };
  
  // 确保项目ID正确
  const projects = [{
    projectId: projectId,
    projectTypeKey: 'software'
  }];
  
  return {
    name: '(Imported by Personal AI from RPA) ' + exportedRule.name,
    isNewRule: true,
    state: 'DISABLED', // 设置为暂停状态
    canOtherRuleTrigger: exportedRule.canOtherRuleTrigger,
    notifyOnError: exportedRule.notifyOnError,
    authorAccountId: ownerId,
    created: now,
    updated: now,
    components: convertedComponents,
    trigger: convertedTrigger,
    labels: exportedRule.labels || [],
    description: exportedRule.description,
    projects: projects
  };
}

// 通过 background script 创建 automation rule
async function createAutomationRule(ruleData: ImportRule, projectId: string, projectKey: string): Promise<any> {
  try {
    const result = await chrome.runtime.sendMessage({
      type: 'RPA_CREATE_JIRA_AUTOMATION_RULE',
      data: { ruleData, projectId, projectKey }
    });
    
    if (!result?.success) {
      throw new Error(result?.error || '创建规则失败');
    }
    
    return result.data;
  } catch (error) {
    console.error('Error creating automation rule:', error);
    throw error;
  }
}

// 通过 background script 获取当前用户 ID
async function getCurrentOwnerId(): Promise<string> {
  try {
    const result = await chrome.runtime.sendMessage({
      type: 'RPA_GET_JIRA_CURRENT_USER'
    });
    
    if (result?.success && result.ownerId) {
      return result.ownerId;
    }
  } catch (error) {
    console.warn('Error fetching user info from JIRA API:', error);
  }
  
  return '';
}

// 通过 background script 获取项目 ID
async function getProjectIdByKey(projectKey: string): Promise<string | null> {
  try {
    const result = await chrome.runtime.sendMessage({
      type: 'RPA_GET_JIRA_PROJECT_ID',
      data: { projectKey }
    });
    
    if (result?.success && result.projectId) {
      return result.projectId;
    }
    
    if (result?.error) {
      console.warn('获取项目 ID 失败:', result.error);
    }
    
    return null;
  } catch (error) {
    console.error('获取项目 ID 失败:', error);
    return null;
  }
}

// 添加到 Scheduled Messages
async function addToScheduledMessages(ruleInfo: {
  id: string;
  name: string;
  trigger: any;
  projectKey: string;
}): Promise<boolean> {
  try {
    const ruleUrl = `https://jira.ringcentral.com/secure/AutomationProjectAdminAction!default.jspa?projectKey=${ruleInfo.projectKey}#/rule/${ruleInfo.id}`;
    
    // 分析 trigger 获取调度配置
    const scheduleConfig = analyzeTriggerForScheduledMessages(ruleInfo.trigger);
    console.log('[Personal AI RPA] 解析的调度配置:', scheduleConfig);
    
    // 准备消息数据
    const messageData: Record<string, any> = {
      Topic: ruleInfo.name,
      Content: `从 RPA 平台导入的 Jira Automation 规则: ${ruleInfo.name}`,
      Push_Method: 'JiraAutomation',
      Target_Type: 'api',
      Status: 'Paused', // 设置为暂停状态
      Automation_Link: ruleUrl,
      Category: ruleInfo.projectKey
    };
    
    // 根据调度配置填充调度字段
    if (scheduleConfig.executionMode === 'nosearch' || scheduleConfig.executionMode === 'jql') {
      // 有调度信息，填充到 messageData
      const scheduleFields = buildScheduleMessageFields(scheduleConfig);
      Object.assign(messageData, scheduleFields);
      
      console.log('[Personal AI RPA] 添加调度字段:', scheduleFields);
      
      // 如果是 jql 模式，更新 Content 说明
      if (scheduleConfig.executionMode === 'jql') {
        messageData.Content = `从 RPA 平台导入 (JQL Mode, View Only): ${ruleInfo.name}`;
      }
    }
    // 其他类型（如 incoming webhook）- 仅添加引用，不设置调度信息
    
    // 发送到 background script 添加消息
    const result = await chrome.runtime.sendMessage({
      type: 'ADD_SCHEDULED_MESSAGE',
      data: messageData
    });
    
    return result?.success || false;
  } catch (error) {
    console.error('添加到 Scheduled Messages 失败:', error);
    return false;
  }
}

// 打开定时消息管理界面
function openScheduledMessagesManager(): void {
  chrome.runtime.sendMessage({
    type: 'OPEN_SCHEDULED_MESSAGES'
  });
}

// 从卡片元素获取 script 数据
async function _getScriptDataFromCard(cardElement: Element): Promise<string | null> {
  // 查找卡片中的"查看工作流"按钮
  const viewWorkflowBtn = cardElement.querySelector('button') as HTMLElement;
  if (!viewWorkflowBtn) {
    return null;
  }
  
  // 点击查看工作流按钮触发预览
  viewWorkflowBtn.click();
  
  // 等待弹窗出现
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // 从弹窗中获取数据
  // 尝试从页面的数据存储中获取 script 数据
  // RPA 站点使用 Vue/React，数据可能在组件状态中
  
  // 查找"下载 JSON"按钮
  const dialog = document.querySelector('dialog, [role="dialog"]');
  if (!dialog) {
    return null;
  }
  
  // 尝试从控制台日志中获取数据（RPA 站点会在控制台打印）
  // 由于无法直接获取控制台数据，我们需要拦截或模拟下载
  
  // 查找下载按钮并模拟点击获取数据
  const downloadBtn = dialog.querySelector('button:has(+ button)') as HTMLElement;
  if (downloadBtn && downloadBtn.textContent?.includes('下载')) {
    // 创建临时的 XMLHttpRequest 拦截器
    // 或者通过 RPA API 获取数据
  }
  
  // 关闭弹窗
  const closeBtn = dialog.querySelector('button[aria-label*="Close"], button:last-child') as HTMLElement;
  if (closeBtn) {
    closeBtn.click();
  }
  
  return null;
}

// 从 RPA 站点获取规则数据
async function _fetchRuleDataFromRPA(caseTitle: string): Promise<ExportedData | null> {
  try {
    // RPA 站点的数据 API
    const dataUrl = 'https://rpa.int.rclabenv.com/data/showcases.json';
    const response = await fetch(dataUrl);
    
    if (!response.ok) {
      console.warn('无法获取 RPA 数据');
      return null;
    }
    
    const showcases = await response.json();
    
    // 查找匹配的案例
    const matchingCase = showcases.find((c: any) => c.title === caseTitle || c.name === caseTitle);
    
    if (matchingCase && matchingCase.scriptData) {
      try {
        return JSON.parse(matchingCase.scriptData);
      } catch (e) {
        console.warn('解析 scriptData 失败:', e);
      }
    }
    
    return null;
  } catch (error) {
    console.error('获取 RPA 数据失败:', error);
    return null;
  }
}

// 通过点击下载按钮获取规则数据
async function _getRuleDataViaDownload(cardTitle: string): Promise<ExportedData | null> {
  return new Promise((resolve) => {
    (async () => {
    // 先找到对应的卡片
    const cards = document.querySelectorAll('[cursor=pointer], [style*="cursor: pointer"]');
    let targetCard: Element | null = null;
    
    for (const card of Array.from(cards)) {
      const title = card.querySelector('h3')?.textContent?.trim();
      if (title === cardTitle) {
        targetCard = card;
        break;
      }
    }
    
    if (!targetCard) {
      resolve(null);
      return;
    }
    
    // 查找并点击"查看工作流"按钮
    const buttons = targetCard.querySelectorAll('button');
    let viewWorkflowBtn: HTMLElement | null = null;
    
    for (const btn of Array.from(buttons)) {
      if (btn.textContent?.includes('查看工作流')) {
        viewWorkflowBtn = btn as HTMLElement;
        break;
      }
    }
    
    if (!viewWorkflowBtn) {
      resolve(null);
      return;
    }
    
    // 拦截下载
    let capturedData: ExportedData | null = null;
    
    // 监听 blob URL 创建
    const originalCreateObjectURL = URL.createObjectURL;
    URL.createObjectURL = function(blob: Blob) {
      if (blob instanceof Blob) {
        blob.text().then(text => {
          try {
            capturedData = JSON.parse(text);
          } catch (e) {
            console.warn('解析下载数据失败');
          }
        });
      }
      return originalCreateObjectURL(blob);
    };
    
    // 点击查看工作流
    viewWorkflowBtn.click();
    
    // 等待弹窗出现
    await new Promise(r => setTimeout(r, 1500));
    
    // 查找并点击下载按钮
    const dialog = document.querySelector('[role="dialog"], dialog');
    if (dialog) {
      const downloadBtn = Array.from(dialog.querySelectorAll('button')).find(
        btn => btn.textContent?.includes('下载 JSON')
      ) as HTMLElement;
      
      if (downloadBtn) {
        downloadBtn.click();
        await new Promise(r => setTimeout(r, 500));
      }
      
      // 关闭弹窗
      const closeBtn = dialog.querySelector('button[aria-label*="Close"]') as HTMLElement ||
                       Array.from(dialog.querySelectorAll('button')).find(btn => {
                         const img = btn.querySelector('img');
                         return img && !btn.textContent?.trim();
                       }) as HTMLElement;
      
      if (closeBtn) {
        closeBtn.click();
      }
    }
    
    // 恢复原始函数
    URL.createObjectURL = originalCreateObjectURL;
    
    // 等待数据捕获
    await new Promise(r => setTimeout(r, 300));
    
    resolve(capturedData);
    })();
  });
}

// 从全局变量获取规则数据（RPA 站点可能将数据存储在 window 对象中）
function _getRuleDataFromWindow(cardTitle: string): ExportedData | null {
  // 尝试从 window 对象获取
  const win = window as any;
  
  // 尝试不同的可能变量名
  const possibleKeys = ['__RPA_DATA__', '__SHOWCASES__', 'showcases', 'rpaData', 'cases'];
  
  for (const key of possibleKeys) {
    if (win[key] && Array.isArray(win[key])) {
      const matchingCase = win[key].find((c: any) => 
        c.title === cardTitle || c.name === cardTitle
      );
      if (matchingCase?.scriptData) {
        try {
          return JSON.parse(matchingCase.scriptData);
        } catch (e) {
          console.warn('解析数据失败');
        }
      }
    }
  }
  
  return null;
}

// 处理导入操作
async function handleImport(cardElement: Element, cardData: RPACardData): Promise<void> {
  // 首先检查是否有 scriptData
  if (!cardData.scriptData) {
    showErrorMessage('此工作流没有可导入的自动化脚本');
    return;
  }
  
  // 显示项目选择对话框（只需填写 projectKey）
  const projectSelection = await showProjectSelectionDialog(cardData.title);
  if (!projectSelection) {
    return; // 用户取消
  }
  
  const projectKey = projectSelection.projectKey;
  
  showLoadingMessage(`正在验证项目 ${projectKey}...`);
  
  try {
    // 通过 projectKey 获取 projectId
    const projectId = await getProjectIdByKey(projectKey);
    if (!projectId) {
      hideLoadingMessage();
      showErrorMessage(`无法找到项目 ${projectKey}，请确认项目 Key 是否正确`);
      return;
    }
    
    console.log(`[Personal AI RPA] 项目 ${projectKey} 的 ID: ${projectId}`);
    
    // 更新加载消息
    updateLoadingMessage('正在获取用户信息...');
    
    // 解析 scriptData
    let exportedData: ExportedData;
    try {
      exportedData = JSON.parse(cardData.scriptData);
    } catch (e) {
      hideLoadingMessage();
      showErrorMessage('规则数据格式错误，无法解析');
      return;
    }
    
    if (!exportedData.rules || exportedData.rules.length === 0) {
      hideLoadingMessage();
      showErrorMessage('没有找到可导入的规则');
      return;
    }
    
    // 获取当前用户 ID
    const ownerId = await getCurrentOwnerId();
    if (!ownerId) {
      hideLoadingMessage();
      showErrorMessage('无法获取 JIRA 用户信息，请确保已登录 JIRA（在另一个标签页打开 jira.ringcentral.com）');
      return;
    }
    
    // 更新加载消息
    updateLoadingMessage('正在创建 JIRA Automation 规则...');
    
    // 转换并创建规则
    const ruleToImport = exportedData.rules[0];
    const convertedRule = await convertExportedRuleToImportFormat(
      ruleToImport, 
      projectId,
      ownerId
    );
    
    // 创建规则（传递 projectKey 给 background script）
    const createResult = await createAutomationRule(convertedRule, projectId, projectKey);
    
    if (!createResult || !createResult.id) {
      hideLoadingMessage();
      showErrorMessage('创建规则失败，请检查是否有权限在此项目创建 Automation 规则');
      return;
    }
    
    // 更新加载消息
    updateLoadingMessage('正在添加到定时消息...');
    
    // 添加到 Scheduled Messages
    const addResult = await addToScheduledMessages({
      id: String(createResult.id),
      name: convertedRule.name,
      trigger: createResult.trigger,
      projectKey: projectKey
    });
    
    hideLoadingMessage();
    
    if (addResult) {
      showSuccessMessage(
        `✅ 导入成功！\n规则已添加到项目 ${projectKey}，并已设置为暂停状态。`,
        () => openScheduledMessagesManager()
      );
    } else {
      showSuccessMessage(
        `✅ 规则已导入到 JIRA 项目 ${projectKey}，但添加到定时消息失败。\n你可以手动在定时消息管理中添加。`,
        () => openScheduledMessagesManager()
      );
    }
    
  } catch (error) {
    hideLoadingMessage();
    const errorMsg = error instanceof Error ? error.message : '未知错误';
    showErrorMessage(`导入失败: ${errorMsg}`);
  }
}

// 创建导入按钮
function createImportButton(cardData: RPACardData, cardElement: Element): HTMLElement {
  const button = document.createElement('button');
  button.className = 'personal-ai-import-btn';
  button.textContent = '导入到我的定时消息';
  button.style.cssText = `
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    margin-left: 8px;
    background: linear-gradient(135deg, #0052cc 0%, #0747a6 100%);
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    transition: all 0.2s ease;
    box-shadow: 0 2px 4px rgba(0, 82, 204, 0.3);
  `;
  
  // 添加图标
  const iconUrl = chrome.runtime.getURL('icons/icon16.png');
  const icon = document.createElement('img');
  icon.src = iconUrl;
  icon.style.cssText = 'width: 14px; height: 14px;';
  button.insertBefore(icon, button.firstChild);
  
  // 悬停效果
  button.addEventListener('mouseenter', () => {
    button.style.transform = 'translateY(-1px)';
    button.style.boxShadow = '0 4px 8px rgba(0, 82, 204, 0.4)';
  });
  
  button.addEventListener('mouseleave', () => {
    button.style.transform = 'translateY(0)';
    button.style.boxShadow = '0 2px 4px rgba(0, 82, 204, 0.3)';
  });
  
  // 点击事件
  button.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    await handleImport(cardElement, cardData);
  });
  
  return button;
}

// 解析卡片数据
function parseCardData(cardElement: Element): RPACardData | null {
  const title = cardElement.querySelector('h3')?.textContent?.trim() || '';
  
  if (!title) {
    return null;
  }
  
  // 获取作者
  const authorEl = cardElement.querySelector('h3')?.parentElement?.querySelector('div:not(h3)');
  const author = authorEl?.textContent?.trim() || '';
  
  // 获取使用能力
  let ability = '';
  const abilityContainer = Array.from(cardElement.querySelectorAll('div')).find(
    div => div.textContent?.includes('使用能力')
  );
  if (abilityContainer) {
    const nextSibling = abilityContainer.nextElementSibling;
    ability = nextSibling?.textContent?.trim() || '';
  }
  
  // 获取应用范围
  let scope = '';
  const scopeContainer = Array.from(cardElement.querySelectorAll('div')).find(
    div => div.textContent?.includes('应用范围')
  );
  if (scopeContainer) {
    const nextSibling = scopeContainer.nextElementSibling;
    scope = nextSibling?.textContent?.trim() || '';
  }
  
  // 检查是否有"查看工作流"按钮（表示有 scriptData）
  const hasViewWorkflowBtn = Array.from(cardElement.querySelectorAll('button')).some(
    btn => btn.textContent?.includes('查看工作流')
  );
  
  // 如果没有查看工作流按钮，可能显示"暂无自动化脚本"
  const noScriptText = cardElement.textContent?.includes('暂无自动化脚本');
  
  return {
    title,
    author,
    ability,
    scope,
    scriptData: hasViewWorkflowBtn && !noScriptText ? 'pending' : undefined
  };
}

// RPA API 配置
const RPA_API_CONFIG = {
  baseUrl: 'https://script.google.com/macros/s/AKfycbwuZvmS4tL8B0dUsAcBRsDpJNGQegx6JvSba7kfr_SEEJHEUPkUHJOFDghRF90GjS3I5A/exec',
  token: 'testTokenHere',
  spreadsheetId: '1zkdOv4L8Nhh0hIp6EHRvtoHiWdKxP29vY9RkptDtPq8',
  sheetName: 'Show cases',
  range: 'A1:K100'
};

// 缓存 RPA 数据
let cachedRPAData: any[] | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 分钟缓存

// 获取 RPA 所有案例数据
async function fetchAllRPACases(): Promise<any[]> {
  // 检查缓存
  if (cachedRPAData && Date.now() - cacheTimestamp < CACHE_DURATION) {
    console.log('[Personal AI RPA] 使用缓存数据');
    return cachedRPAData;
  }
  
  try {
    const url = `${RPA_API_CONFIG.baseUrl}?token=${RPA_API_CONFIG.token}&spreadsheetId=${RPA_API_CONFIG.spreadsheetId}&sheetName=${encodeURIComponent(RPA_API_CONFIG.sheetName)}&range=${encodeURIComponent(RPA_API_CONFIG.range)}`;
    
    console.log('[Personal AI RPA] 获取 RPA 数据...');
    const response = await fetch(url);
    
    if (!response.ok) {
      console.warn('[Personal AI RPA] API 请求失败:', response.status);
      return [];
    }
    
    const data = await response.json();
    console.log('[Personal AI RPA] 获取到数据:', data);
    
    if (Array.isArray(data)) {
      cachedRPAData = data;
      cacheTimestamp = Date.now();
      return data;
    }
    
    return [];
  } catch (error) {
    console.error('[Personal AI RPA] 获取数据失败:', error);
    return [];
  }
}

// 获取卡片的 scriptData
async function fetchCardScriptData(cardTitle: string): Promise<string | null> {
  try {
    const cases = await fetchAllRPACases();
    
    if (cases.length === 0) {
      console.warn('[Personal AI RPA] 数据为空');
      return null;
    }
    
    console.log('[Personal AI RPA] 搜索案例:', cardTitle, '在', cases.length, '条记录中');
    
    // API 返回的是对象数组，每个对象包含：
    // - Situation: 标题
    // - JIRA automation script: 脚本 JSON
    // - Owner: 作者
    // - Use capabilities: 使用能力
    // - Now adopted to: 应用范围
    
    // 查找匹配的案例
    const matchingCase = cases.find((item: any) => {
      if (!item || typeof item !== 'object') return false;
      
      // 尝试不同的标题字段名
      const title = item['Situation'] || item['title'] || item['case'] || item['标题'];
      if (!title) return false;
      
      // 标题匹配（去除空白后比较）
      return String(title).trim() === cardTitle.trim();
    });
    
    if (!matchingCase) {
      console.warn('[Personal AI RPA] 未找到匹配的案例:', cardTitle);
      // 打印一些可用的标题用于调试
      const availableTitles = cases.slice(0, 5).map((item: any) => 
        item['Situation'] || item['title'] || '未知'
      );
      console.log('[Personal AI RPA] 可用标题示例:', availableTitles);
      return null;
    }
    
    console.log('[Personal AI RPA] 找到匹配案例:', matchingCase['Situation']);
    
    // 获取脚本数据
    const scriptData = matchingCase['JIRA automation script'] || 
                       matchingCase['scriptData'] || 
                       matchingCase['script'];
    
    if (!scriptData) {
      console.warn('[Personal AI RPA] 案例没有脚本数据');
      return null;
    }
    
    // 验证是否是有效的 JSON 格式
    if (typeof scriptData === 'string' && scriptData.includes('"rules"')) {
      console.log('[Personal AI RPA] 成功获取脚本数据，长度:', scriptData.length);
      return scriptData;
    }
    
    console.warn('[Personal AI RPA] 脚本数据格式无效');
    return null;
  } catch (e) {
    console.error('[Personal AI RPA] 获取数据失败:', e);
    return null;
  }
}

// 为卡片添加导入按钮（保留作为备用方案）
async function _addImportButtonToCards(): Promise<void> {
  console.log('[Personal AI RPA] 开始添加导入按钮...');
  
  // 查找所有卡片
  // RPA 站点的卡片结构：cursor=pointer 的 div 元素，包含 h3 标题
  // 注：此变量用于调试，暂未在主逻辑中使用
  const _cards = document.querySelectorAll('div[cursor="pointer"], [style*="cursor: pointer"], [class*="cursor-pointer"]');
  console.log('[Personal AI RPA] 找到', _cards.length, '个可能的卡片元素');
  
  // 也尝试查找包含"查看工作流"按钮的容器
  const viewWorkflowBtns = document.querySelectorAll('button');
  const cardContainers = new Set<Element>();
  
  viewWorkflowBtns.forEach(btn => {
    if (btn.textContent?.includes('查看工作流')) {
      // 向上查找卡片容器
      let parent = btn.parentElement;
      while (parent) {
        if (parent.querySelector('h3')) {
          cardContainers.add(parent);
          break;
        }
        parent = parent.parentElement;
      }
    }
  });
  
  console.log(`[Personal AI RPA] 找到 ${cardContainers.size} 个包含工作流的卡片`);
  
  for (const card of Array.from(cardContainers)) {
    const title = card.querySelector('h3')?.textContent?.trim();
    if (!title) continue;
    
    // 检查是否已添加按钮
    if (addedImportButtons.has(title)) continue;
    if (card.querySelector('.personal-ai-import-btn')) continue;
    
    // 检查是否有"暂无自动化脚本"提示
    if (card.textContent?.includes('暂无自动化脚本')) {
      console.log(`[Personal AI RPA] 跳过没有脚本的卡片: ${title}`);
      continue;
    }
    
    // 查找"查看工作流"按钮
    const viewWorkflowBtn = Array.from(card.querySelectorAll('button')).find(
      btn => btn.textContent?.includes('查看工作流')
    );
    
    if (!viewWorkflowBtn) {
      console.log(`[Personal AI RPA] 未找到查看工作流按钮: ${title}`);
      continue;
    }
    
    // 解析卡片数据
    const cardData = parseCardData(card);
    if (!cardData) continue;
    
    // 创建导入按钮
    const importBtn = createImportButton(cardData, card);
    
    // 在"查看工作流"按钮旁边插入
    viewWorkflowBtn.parentElement?.insertBefore(importBtn, viewWorkflowBtn.nextSibling);
    
    // 标记已添加
    addedImportButtons.add(title);
    console.log(`[Personal AI RPA] 已为卡片添加导入按钮: ${title}`);
  }
}

// 检查是否已初始化 Scheduled Messages
async function checkScheduledMessagesInitialized(): Promise<boolean> {
  try {
    const result = await chrome.storage.local.get(['scheduledMessagesConfig']);
    const config = result.scheduledMessagesConfig;
    return !!(config && config.sheetId);
  } catch (error) {
    console.error('[Personal AI RPA] 检查配置失败:', error);
    return false;
  }
}

// 更新 handleImport 函数以获取实际的 scriptData
async function handleImportWithFetch(cardElement: Element, cardData: RPACardData): Promise<void> {
  showLoadingMessage('正在获取规则数据...');
  
  try {
    // 获取 scriptData
    let scriptData: string | null = null;
    
    // 方法1：点击查看工作流，从弹窗获取数据
    const viewWorkflowBtn = Array.from(cardElement.querySelectorAll('button')).find(
      btn => btn.textContent?.includes('查看工作流')
    ) as HTMLElement;
    
    if (viewWorkflowBtn) {
      // 使用事件监听来捕获数据
      const capturePromise = new Promise<string | null>((resolve) => {
        // 监听控制台日志来获取数据
        const originalLog = console.log;
        let captured: string | null = null;
        
        console.log = function(...args) {
          originalLog.apply(console, args);
          const logStr = args.join(' ');
          if (logStr.includes('脚本数据长度:') || logStr.includes('解析成功')) {
            // 尝试从 window 获取
            const win = window as any;
            if (win.__CURRENT_SCRIPT_DATA__) {
              captured = win.__CURRENT_SCRIPT_DATA__;
            }
          }
        };
        
        // 点击查看工作流
        viewWorkflowBtn.click();
        
        // 等待并恢复
        setTimeout(() => {
          console.log = originalLog;
          resolve(captured);
        }, 2000);
      });
      
      scriptData = await capturePromise;
      
      // 关闭弹窗
      const dialog = document.querySelector('[role="dialog"], dialog');
      if (dialog) {
        const closeBtn = Array.from(dialog.querySelectorAll('button')).find(btn => {
          const hasCloseLabel = btn.getAttribute('aria-label')?.includes('Close');
          const hasOnlyImg = btn.children.length === 1 && btn.children[0].tagName === 'IMG';
          return hasCloseLabel || hasOnlyImg;
        }) as HTMLElement;
        
        if (closeBtn) {
          closeBtn.click();
          await new Promise(r => setTimeout(r, 300));
        }
      }
    }
    
    // 如果没有获取到数据，尝试其他方法
    if (!scriptData) {
      // 尝试从 API 获取
      scriptData = await fetchCardScriptData(cardData.title);
    }
    
    hideLoadingMessage();
    
    if (!scriptData) {
      showErrorMessage('无法获取规则数据。请尝试手动下载 JSON 并使用 JIRA Automation 导入功能。');
      return;
    }
    
    // 更新 cardData 并继续导入流程
    cardData.scriptData = scriptData;
    await handleImport(cardElement, cardData);
    
  } catch (error) {
    hideLoadingMessage();
    const errorMsg = error instanceof Error ? error.message : '未知错误';
    showErrorMessage(`获取数据失败: ${errorMsg}`);
  }
}

// 修改 createImportButton 的点击事件
function createImportButtonWithFetch(cardData: RPACardData, cardElement: Element): HTMLElement {
  const button = document.createElement('button');
  button.className = 'personal-ai-import-btn';
  button.textContent = '导入到我的定时消息';
  button.style.cssText = `
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    margin-left: 8px;
    background: linear-gradient(135deg, #0052cc 0%, #0747a6 100%);
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    transition: all 0.2s ease;
    box-shadow: 0 2px 4px rgba(0, 82, 204, 0.3);
  `;
  
  // 添加图标
  const iconUrl = chrome.runtime.getURL('icons/icon16.png');
  const icon = document.createElement('img');
  icon.src = iconUrl;
  icon.style.cssText = 'width: 14px; height: 14px;';
  button.insertBefore(icon, button.firstChild);
  
  // 悬停效果
  button.addEventListener('mouseenter', () => {
    button.style.transform = 'translateY(-1px)';
    button.style.boxShadow = '0 4px 8px rgba(0, 82, 204, 0.4)';
  });
  
  button.addEventListener('mouseleave', () => {
    button.style.transform = 'translateY(0)';
    button.style.boxShadow = '0 2px 4px rgba(0, 82, 204, 0.3)';
  });
  
  // 点击事件 - 使用带获取功能的处理函数
  button.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    await handleImportWithFetch(cardElement, cardData);
  });
  
  return button;
}

// 更新 addImportButtonToCards 使用新的创建函数
async function addImportButtonToCardsV2(): Promise<void> {
  console.log('[Personal AI RPA] 开始添加导入按钮 V2...');
  
  // 首先检查是否已初始化 Scheduled Messages
  const isInitialized = await checkScheduledMessagesInitialized();
  if (!isInitialized) {
    console.log('[Personal AI RPA] 跳过按钮注入（未初始化 Scheduled Messages）');
    return;
  }
  
  // 查找所有包含"查看工作流"按钮的卡片容器
  const viewWorkflowBtns = document.querySelectorAll('button');
  const cardContainers = new Set<Element>();
  
  viewWorkflowBtns.forEach(btn => {
    if (btn.textContent?.includes('查看工作流')) {
      // 向上查找卡片容器（找到包含 h3 的最近父元素）
      let parent = btn.parentElement;
      while (parent && parent !== document.body) {
        if (parent.querySelector('h3')) {
          // 继续向上找到完整的卡片
          let cardParent = parent;
          while (cardParent.parentElement && 
                 cardParent.parentElement !== document.body && 
                 !cardParent.parentElement.querySelector(':scope > div > h3')) {
            if (cardParent.parentElement.children.length > 1) {
              break;
            }
            cardParent = cardParent.parentElement;
          }
          cardContainers.add(cardParent);
          break;
        }
        parent = parent.parentElement;
      }
    }
  });
  
  console.log(`[Personal AI RPA] 找到 ${cardContainers.size} 个包含工作流的卡片`);
  
  for (const card of Array.from(cardContainers)) {
    const title = card.querySelector('h3')?.textContent?.trim();
    if (!title) continue;
    
    // 检查是否已添加按钮
    if (addedImportButtons.has(title)) continue;
    if (card.querySelector('.personal-ai-import-btn')) continue;
    
    // 检查是否有"暂无自动化脚本"提示
    if (card.textContent?.includes('暂无自动化脚本')) {
      console.log(`[Personal AI RPA] 跳过没有脚本的卡片: ${title}`);
      continue;
    }
    
    // 查找"查看工作流"按钮
    const viewWorkflowBtn = Array.from(card.querySelectorAll('button')).find(
      btn => btn.textContent?.includes('查看工作流')
    );
    
    if (!viewWorkflowBtn) {
      console.log(`[Personal AI RPA] 未找到查看工作流按钮: ${title}`);
      continue;
    }
    
    // 解析卡片数据
    const cardData = parseCardData(card);
    if (!cardData) continue;
    
    // 创建导入按钮（使用带获取功能的版本）
    const importBtn = createImportButtonWithFetch(cardData, card);
    
    // 在"查看工作流"按钮旁边插入
    viewWorkflowBtn.parentElement?.appendChild(importBtn);
    
    // 标记已添加
    addedImportButtons.add(title);
    console.log(`[Personal AI RPA] 已为卡片添加导入按钮: ${title}`);
  }
}

// 主函数
async function main(): Promise<void> {
  if (!isRPASite()) {
    return;
  }
  
  console.log('[Personal AI RPA] Content script 初始化...');
  
  // 等待页面内容加载
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // 添加导入按钮
  await addImportButtonToCardsV2();
  
  // 监听 DOM 变化，为新加载的卡片添加按钮
  const observer = new MutationObserver(() => {
    addImportButtonToCardsV2();
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  console.log('[Personal AI RPA] Content script 初始化完成');
}

// 页面加载时执行
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}

// 处理 SPA 导航
let currentUrl = location.href;
const urlObserver = new MutationObserver(() => {
  if (currentUrl !== location.href) {
    currentUrl = location.href;
    if (isRPASite()) {
      addedImportButtons.clear();
      setTimeout(main, 1000);
    }
  }
});

urlObserver.observe(document, { subtree: true, childList: true });

