/**
 * Jira Automation 导入功能 Content Script
 * 在Jira automation管理页面添加导入功能
 */

import { getUserInfo } from "./utils";
import { getLocalStorageItem, setLocalStorageItem } from "./storage";

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

// 检测是否在Jira automation管理页面
function isJiraAutomationPage(): boolean {
  // 检查主页面URL
  if (window.location.pathname.includes('/secure/AutomationProjectAdminAction')) {
    return true;
  }
  
  // 检查iframe内的URL
  if (window.location.pathname.includes('/secure/AutomationProjectAdminAction!iframe.jspa')) {
    return true;
  }
  
  return false;
}

// 从localStorage获取当前ownerId
function getCurrentOwnerId(): string {
  // 首先尝试从localStorage获取
  const ownerId = getLocalStorageItem('ownerId', '');
  if (ownerId && ownerId !== 'radar-poc') {
    console.log('Found ownerId from localStorage:', ownerId);
    return ownerId;
  }
  
  // 如果localStorage中没有，尝试从页面获取（仅在主页面）
  if (window === window.top) {
    const userProfileElement = document.querySelector('#header-details-user-fullname');
    if (userProfileElement) {
      // 从img标签的src属性中获取ownerId
      const imgElement = userProfileElement.querySelector('img');
      if (imgElement) {
        const src = imgElement.getAttribute('src');
        if (src) {
          const ownerIdMatch = src.match(/ownerId=([^&]+)/);
          if (ownerIdMatch && ownerIdMatch[1]) {
            const ownerId = ownerIdMatch[1];
            console.log('Found ownerId from profile image src:', ownerId);
            // 保存到localStorage
            setLocalStorageItem('ownerId', ownerId);
            return ownerId;
          }
        }
      }
    }
    
    // 备选方案：尝试其他可能的选择器
    const alternativeSelectors = [
      '[data-username] img',
      '.user-profile[data-username] img',
      '.aui-dropdown2-trigger[data-username] img'
    ];
    
    for (const selector of alternativeSelectors) {
      const imgElement = document.querySelector(selector);
      if (imgElement) {
        const src = imgElement.getAttribute('src');
        if (src) {
          const ownerIdMatch = src.match(/ownerId=([^&]+)/);
          if (ownerIdMatch && ownerIdMatch[1]) {
            const ownerId = ownerIdMatch[1];
            console.log('Found ownerId from alternative selector:', ownerId);
            // 保存到localStorage
            setLocalStorageItem('ownerId', ownerId);
            return ownerId;
          }
        }
      }
    }
  }
  
  // 如果都找不到，使用默认值
  console.warn('Could not find ownerId, using default');
  return 'esone.qiu2';
}

// 全局变量存储当前项目ID
declare global {
  interface Window {
    __PERSONAL_AI_PROJECT_ID__?: string;
  }
}

// 从页面动态获取项目ID
function getProjectId(): string {
  // 如果是iframe，尝试从父页面获取全局变量
  if (window !== window.top) {
    try {
      const parentProjectId = (window.top as any)?.__PERSONAL_AI_PROJECT_ID__;
      if (parentProjectId) {
        console.log('Found project ID from parent window global variable:', parentProjectId);
        return parentProjectId;
      }
    } catch (error) {
      console.log('Cannot access parent window, trying local detection...');
    }
  }
  
  // 动态从页面获取项目ID
  let projectId = '';
  
  // 方案1：从页面全局变量获取
  if (typeof (window as any).WRM !== 'undefined' && (window as any).WRM._unparsedData && (window as any).WRM._unparsedData["project-id"]) {
    projectId = (window as any).WRM._unparsedData["project-id"];
    console.log('Found project ID from WRM._unparsedData:', projectId);
  }
  
  // 方案2：从项目编辑链接中获取projectId
  if (!projectId) {
    const editProjectLink = document.querySelector('#edit_project');
    if (editProjectLink) {
      const href = editProjectLink.getAttribute('href');
      if (href) {
        const pidMatch = href.match(/pid=(\d+)/);
        if (pidMatch && pidMatch[1]) {
          projectId = pidMatch[1];
          console.log('Found project ID from edit project link:', projectId);
        }
      }
    }
  }
  
  // 方案3：尝试其他可能包含projectId的链接
  if (!projectId) {
    const projectLinks = document.querySelectorAll('a[href*="pid="]');
    for (const link of Array.from(projectLinks)) {
      const href = link.getAttribute('href');
      if (href) {
        const pidMatch = href.match(/pid=(\d+)/);
        if (pidMatch && pidMatch[1]) {
          projectId = pidMatch[1];
          console.log('Found project ID from project link:', projectId);
          break;
        }
      }
    }
  }
  
  // 方案4：从URL获取projectKey
  if (!projectId) {
    const urlParams = new URLSearchParams(window.location.search);
    const projectKey = urlParams.get('projectKey') || '';
    if (projectKey) {
      projectId = projectKey;
      console.log('Using projectKey from URL as fallback:', projectId);
    }
  }
  
  // 如果在主页面且找到了项目ID，存储到全局变量供iframe使用
  if (projectId && window === window.top) {
    (window as any).__PERSONAL_AI_PROJECT_ID__ = projectId;
    console.log('Stored project ID in global variable:', projectId);
  }
  
  // 如果都找不到，返回空字符串
  if (!projectId) {
    console.warn('Could not find project ID');
  }
  
  return projectId;
}

// 获取项目Key (用于URL构建)
function getProjectKey(): string {
  // 首先尝试从URL参数获取projectKey
  const urlParams = new URLSearchParams(window.location.search);
  const projectKey = urlParams.get('projectKey');
  if (projectKey) {
    console.log('Found projectKey from URL params:', projectKey);
    return projectKey;
  }
  
  // 如果URL中没有projectKey，尝试从其他地方获取
  // 这里可以根据需要添加更多的获取逻辑
  console.warn('Could not find projectKey, using default');
  return 'MTR'; // 默认值
}

// 等待元素出现
function waitForElement(selector: string, timeout = 10000): Promise<Element> {
  return new Promise((resolve, reject) => {
    const element = document.querySelector(selector);
    if (element) {
      return resolve(element);
    }
    
    const observer = new MutationObserver(() => {
      const element = document.querySelector(selector);
      if (element) {
        observer.disconnect();
        resolve(element);
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Timeout waiting for element: ${selector}`));
    }, timeout);
  });
}

// 等待iframe加载完成
function waitForIframe(): Promise<Document> {
  return new Promise((resolve, reject) => {
    const iframe = document.querySelector('iframe.automation-page-container') as HTMLIFrameElement;
    if (!iframe) {
      reject(new Error('Iframe not found'));
      return;
    }

    const checkIframeContent = () => {
      try {
        const iframeDoc = iframe.contentDocument;
        if (iframeDoc && iframeDoc.readyState === 'complete') {
          resolve(iframeDoc);
        } else {
          setTimeout(checkIframeContent, 100);
        }
      } catch (error) {
        setTimeout(checkIframeContent, 100);
      }
    };

    iframe.addEventListener('load', () => {
      // 检查是否有待跳转的URL
      try {
        if (window.top) {
          const pendingUrl = (window.top as any).__PERSONAL_AI_PENDING_NAVIGATION__;
          if (pendingUrl) {
            console.log('Found pending navigation URL on iframe load:', pendingUrl);
            
            // 清除存储的URL
            (window.top as any).__PERSONAL_AI_PENDING_NAVIGATION__ = null;
            
            console.log('Executing navigation from iframe load event to:', pendingUrl);
            window.top.location.href = pendingUrl;
            
            return; // 有待跳转URL时，不需要继续执行其他逻辑
          }
        }
      } catch (error) {
        console.error('Error checking pending navigation on iframe load:', error);
      }
      
      checkIframeContent();
    });

    // 如果iframe已经加载，直接检查
    checkIframeContent();
  });
}

// 转换导出的JSON格式为API所需格式
function convertExportedRuleToImportFormat(exportedRule: ExportedRule, projectId: string): ImportRule {
  const now = Date.now();
  const ownerId = getCurrentOwnerId();
  
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
  const projects = exportedRule.projects.map(project => ({
    ...project,
    projectId: projectId // 使用当前项目ID
  }));
  
  return {
    name: '(Imported by Personal AI) ' + exportedRule.name,
    isNewRule: true,
    state: exportedRule.state,
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

// 创建automation rule的API调用
async function createAutomationRule(ruleData: ImportRule, projectId: string): Promise<any> {
  try {
    const response = await fetch(`/rest/cb-automation/latest/project/${projectId}/rule`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      },
      body: JSON.stringify(ruleData)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API call failed: ${response.status} ${response.statusText}\n${errorText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error creating automation rule:', error);
    throw error;
  }
}

// 显示成功消息
function showSuccessMessage(message: string): void {
  const successDiv = document.createElement('div');
  successDiv.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background-color: #4CAF50;
    color: white;
    padding: 16px;
    border-radius: 4px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    z-index: 10000;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    max-width: 400px;
  `;
  successDiv.textContent = message;
  document.body.appendChild(successDiv);
  
  setTimeout(() => {
    document.body.removeChild(successDiv);
  }, 5000);
}

// 显示错误消息
function showErrorMessage(message: string): void {
  const errorDiv = document.createElement('div');
  errorDiv.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background-color: #f44336;
    color: white;
    padding: 16px;
    border-radius: 4px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    z-index: 10000;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    max-width: 400px;
    word-wrap: break-word;
  `;
  errorDiv.textContent = message;
  document.body.appendChild(errorDiv);
  
  setTimeout(() => {
    if (document.body.contains(errorDiv)) {
      document.body.removeChild(errorDiv);
    }
  }, 10000);
}

// 处理文件导入
function handleFileImport(file: File, projectId: string): void {
  const reader = new FileReader();
  
  reader.onload = async (e) => {
    try {
      const content = e.target?.result as string;
      const exportedData: ExportedData = JSON.parse(content);
      
      if (!exportedData.rules || !Array.isArray(exportedData.rules)) {
        throw new Error('Invalid JSON format: Missing rules array');
      }
      
      if (exportedData.rules.length === 0) {
        throw new Error('No rules found in the imported file');
      }
      
      // 只导入第一个rule（如果有多个的话）
      const ruleToImport = exportedData.rules[0];
      const convertedRule = convertExportedRuleToImportFormat(ruleToImport, projectId);
      
      console.log('Importing rule:', convertedRule);
      
      // 调用API创建rule
      const result = await createAutomationRule(convertedRule, projectId);
      console.log('Rule created successfully:', result);
      
      showSuccessMessage(`Automation rule "${ruleToImport.name}" imported successfully!`);
      
      // 跳转到导入后的automation脚本页面
      if (result && result.id) {
        const projectKey = getProjectKey();
        const ruleUrl = `https://jira.ringcentral.com/secure/AutomationProjectAdminAction!default.jspa?projectKey=${projectKey}#/rule/${result.id}`;
        console.log('Navigating to rule page:', ruleUrl);
        
        setTimeout(() => {
          console.log('Storing navigation URL and refreshing iframe:', ruleUrl);
          
          // 将跳转URL存储到父窗口的属性中
          if (window.top) {
            try {
              (window.top as any).__PERSONAL_AI_PENDING_NAVIGATION__ = ruleUrl;
              console.log('Stored navigation URL in parent window:', ruleUrl);
            } catch (error) {
              console.error('Failed to store navigation URL in parent window:', error);
            }
          }
          
          // 刷新当前iframe页面
          window.location.reload();
        }, 2000);
      } else {
        console.warn('Rule ID not found in response, falling back to page refresh');
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      }
      
    } catch (error) {
      console.error('Error importing rule:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      showErrorMessage(`Import failed: ${errorMessage}`);
    }
  };
  
  reader.onerror = () => {
    showErrorMessage('Error reading file');
  };
  
  reader.readAsText(file);
}

// 创建Import按钮
function createImportButton(iframeDoc: Document, projectId: string): void {
  if (iframeDoc.getElementById('import-rule-button')) {
    console.log('Import rule button already exists');
    return;
  }

  console.log('Looking for Create rule button...');
  
  // 首先尝试通过文本内容查找按钮
  const buttons = iframeDoc.querySelectorAll('button');
  let foundButton = null;
  
  buttons.forEach(button => {
    const text = button.textContent?.trim();
    console.log('Button text:', text);
    if (text && text.toLowerCase().includes('create rule')) {
      foundButton = button;
      console.log('Found Create rule button by text:', text);
    }
  });
  
  // if (!foundButton) {
  //   console.warn('Create rule button not found by text, trying CSS selectors...');
    
  //   // 尝试CSS选择器作为备选方案
  //   const createButton = iframeDoc.querySelector('button[data-testid="create-rule-button"], .create-rule-button, [class*="create"], [class*="Create"]');
    
  //   if (createButton) {
  //     foundButton = createButton;
  //     console.log('Found Create rule button by CSS selector');
  //   }
  // }
  
  // if (!foundButton) {
  //   console.warn('Could not find Create rule button, will append to first available container');
  //   const container = iframeDoc.querySelector('div[class*="header"], .page-header, .toolbar, .actions') 
  //                    || iframeDoc.body.firstElementChild;
  //   if (container) {
  //     appendImportButton(container as HTMLElement, projectId, iframeDoc);
  //   }
  //   return;
  // }

  if (!foundButton) {
    console.warn('Could not find Create import rule button!');
    return;
  }
  
  appendImportButtonNearElement(foundButton as HTMLElement, projectId, iframeDoc);
}

function appendImportButtonNearElement(referenceElement: HTMLElement, projectId: string, iframeDoc: Document): void {
  const importButton = createImportButtonElement(projectId, iframeDoc);
  
  // 尝试在Create button旁边插入
  if (referenceElement.parentNode) {
    referenceElement.parentNode.insertBefore(importButton, referenceElement.nextSibling);
  }
}

function appendImportButton(container: HTMLElement, projectId: string, iframeDoc: Document): void {
  const importButton = createImportButtonElement(projectId, iframeDoc);
  container.appendChild(importButton);
}

function createImportButtonElement(projectId: string, iframeDoc: Document): HTMLElement {
  // 创建隐藏的文件输入元素
  const fileInput = iframeDoc.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.json';
  fileInput.style.display = 'none';
  
  // 创建Import按钮
  const importButton = iframeDoc.createElement('button');
  importButton.textContent = 'Import rule';
  importButton.id = 'import-rule-button';
  importButton.style.cssText = `
    margin-left: 8px;
    padding: 8px 16px;
    background-color: #0052cc;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;
  
  // 悬停效果
  importButton.addEventListener('mouseenter', () => {
    importButton.style.backgroundColor = '#0065ff';
  });
  
  importButton.addEventListener('mouseleave', () => {
    importButton.style.backgroundColor = '#0052cc';
  });
  
  // 点击事件
  importButton.addEventListener('click', () => {
    fileInput.click();
  });
  
  // 文件选择事件
  fileInput.addEventListener('change', (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
      handleFileImport(file, projectId);
    }
  });
  
  // 创建容器
  const container = iframeDoc.createElement('div');
  container.style.display = 'inline-block';
  container.appendChild(fileInput);
  container.appendChild(importButton);
  
  return container;
}



// 主函数
async function main(): Promise<void> {
  if (!isJiraAutomationPage()) {
    return;
  }
  
  try {
    console.log('Jira Automation Import: Initializing...');
    console.log('Current URL:', window.location.href);
    console.log('Is in iframe:', window !== window.top);
    
    // 如果在iframe内，直接在当前文档中执行
    if (window !== window.top) {
      console.log('Running inside iframe, executing directly...');
      
      const projectId = getProjectId();
      if (!projectId) {
        console.warn('Project ID not found');
        return;
      }
      
      console.log('Project ID:', projectId);
      
      // 等待页面内容加载
      setTimeout(() => {
        createImportButton(document, projectId);
        console.log('Import button created in iframe');
      }, 2000);
      
    } else {
      // 如果在主页面，等待iframe加载
      console.log('Running in main page, waiting for iframe...');

      const ownerId = getCurrentOwnerId();
      console.log('OwnerId:', ownerId);
      
      const projectId = getProjectId();
      if (!projectId) {
        console.warn('Project ID not found');
        return;
      }
      console.log('Project ID:', projectId);
      
      // 等待iframe加载完成
      const iframeDoc = await waitForIframe();
      console.log('Iframe loaded successfully');
      
      // 等待页面内容加载
      setTimeout(() => {
        createImportButton(iframeDoc, projectId);
        console.log('Import button created in main page');
      }, 2000);
    }
    
  } catch (error) {
    console.error('Error initializing Jira Automation Import:', error);
  }
}

// 页面加载时执行
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}

// 处理SPA导航
let currentUrl = location.href;
const observer = new MutationObserver(() => {
  if (currentUrl !== location.href) {
    currentUrl = location.href;
    if (isJiraAutomationPage()) {
      setTimeout(main, 1000);
    }
  }
});

observer.observe(document, { subtree: true, childList: true }); 