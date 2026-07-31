/**
 * Jira Automation 导入功能 Content Script
 * 在Jira automation管理页面添加导入功能
 */

import { getLocalStorageItem, setLocalStorageItem } from "./storage";
import {
  JIRA_AUTOMATION_IMPORT_MAX_FILE_BYTES,
  buildJiraAutomationImportedRuleName,
  buildJiraAutomationImportEnablementPlan,
  buildJiraAutomationImportCredentialRestoreGateSummary,
  buildJiraAutomationImportSecretReentryQueueGroups,
  buildJiraAutomationImportRule,
  buildJiraAutomationImportReviewFindings,
  buildJiraAutomationImportReviewChecklist,
  collectJiraAutomationImportSecretReentrySlots,
  buildJiraAutomationImportNameCheckReceipt,
  buildJiraAutomationImportReviewPacket,
  buildJiraAutomationImportWarnings,
  buildJiraAutomationUniqueImportedRuleName,
  collectJiraAutomationImportReviewSignals,
  formatJiraAutomationImportSourceFormat,
  formatJiraAutomationImportSecretReentryQueue,
  formatJiraAutomationImportSecretReentrySummary,
  isJiraAutomationImportFileSizeAllowed,
  parseJiraAutomationExport,
  redactJiraAutomationImportErrorText,
  sanitizeJiraAutomationImportDisplayText,
  summarizeJiraAutomationImportRule,
  type ExportedData,
  type ImportRule,
  type JiraAutomationImportEnablementStep,
  type JiraAutomationImportNameCheck,
  type JiraAutomationRuleSummary,
  type JiraAutomationImportReviewFinding,
  type JiraAutomationImportReviewChecklistItem,
  type JiraAutomationImportSecretReentrySlot,
} from './jira-automation-import/transform';
import { 
  parseCronExpression, 
  getNextScheduleDate,
  parseFixedRateConfig,
  formatDaysOfWeekDisplay,
  jiraDaysToJsDays
} from './scheduled-messages/scheduleUtils';
import { jiraFetch } from './jira';
import {
  getContentScriptUiLanguage,
  initContentScriptI18n,
} from './i18n/contentScript';

const JIRA_AUTOMATION_IMPORT_POST_SUCCESS_NAVIGATION_DELAY_MS = 3500;

initContentScriptI18n(() => {
  refreshJiraImportButtonLanguage(document);
});

function isJiraAutomationImportEnglish(): boolean {
  return getContentScriptUiLanguage() === 'en-US';
}

function jiraImportText(en: string, zh: string): string {
  return isJiraAutomationImportEnglish() ? en : zh;
}

function buildJiraImportEntryButtonBoundary(projectKey: string): string {
  const targetProject = projectKey || jiraImportText('the current Jira project', '当前 Jira 项目');
  return jiraImportText(
    `Opens a local JSON picker and prepares a disabled-copy preview for ${targetProject}; this click does not create, edit, enable, run Jira automation, activate schedules, or restore secrets.`,
    `只打开本机 JSON 选择器，并为 ${targetProject} 准备禁用副本预览；本次点击不会创建、编辑、启用、运行 Jira automation、激活 schedule 或恢复 secret。`,
  );
}

function refreshJiraImportButtonLanguage(doc: Document): void {
  const buttons = doc.querySelectorAll<HTMLButtonElement>('#import-rule-button');
  buttons.forEach((button) => {
    const projectKey = button.getAttribute('data-project-key') || '';
    const entryBoundary = buildJiraImportEntryButtonBoundary(projectKey);
    button.textContent = jiraImportText('Import rule', '导入规则');
    button.title = entryBoundary;
    button.setAttribute('aria-label', entryBoundary);
  });
}

function formatJiraImportSeverity(severity: JiraAutomationImportReviewChecklistItem['severity']): string {
  if (isJiraAutomationImportEnglish()) {
    return severity.toUpperCase();
  }

  return {
    high: '高',
    medium: '中',
    low: '低',
  }[severity];
}

function formatJiraImportSourceFormat(sourceCloud: boolean | undefined): string {
  if (isJiraAutomationImportEnglish()) {
    return formatJiraAutomationImportSourceFormat(sourceCloud);
  }

  if (sourceCloud === false) {
    return 'Jira Server / Data Center 导出 (cloud=false)';
  }

  if (sourceCloud === true) {
    return 'Jira Cloud 导出';
  }

  return '未知 Jira Automation 导出格式';
}

function formatJiraImportSecretSummary(
  slots: JiraAutomationImportSecretReentrySlot[],
  maxSlots = 4,
): string {
  if (isJiraAutomationImportEnglish()) {
    return formatJiraAutomationImportSecretReentrySummary(slots, maxSlots);
  }

  if (slots.length === 0) {
    return '没有发现需要替换或脱敏的 secret 字段。';
  }

  const visibleSlots = slots.slice(0, maxSlots).map((slot) => (
    `${slot.path}${slot.label ? ` (${slot.label})` : ''}`
  ));
  const hiddenCount = Math.max(0, slots.length - visibleSlots.length);
  return `${slots.length} 个位置：${visibleSlots.join(' | ')}${hiddenCount > 0 ? `，另有 ${hiddenCount} 个` : ''}`;
}

function formatJiraImportCredentialRestoreGateSummary(
  slots: JiraAutomationImportSecretReentrySlot[],
): string {
  if (isJiraAutomationImportEnglish()) {
    return buildJiraAutomationImportCredentialRestoreGateSummary(slots);
  }

  if (slots.length === 0) {
    return '凭据恢复门控：本次未检测到被替换或脱敏的凭据位置；外部连接仍需在 Jira 启用前按常规复核。';
  }

  return [
    `凭据恢复门控：启用前仍未完成；${formatJiraImportSecretSummary(slots, 3)}。`,
    '禁用副本只带 PERSONAL_AI_REENTER_SECRET 或 REDACTED 占位，启用前请在 Jira 里重新录入或明确留空。',
  ].join(' ');
}

function formatJiraImportSecretReentryQueue(
  slots: JiraAutomationImportSecretReentrySlot[],
  maxSlotsPerGroup = 3,
): string {
  if (isJiraAutomationImportEnglish()) {
    return formatJiraAutomationImportSecretReentryQueue(slots, maxSlotsPerGroup);
  }

  if (slots.length === 0) {
    return '凭据重录队列：本次禁用副本没有检测到被脱敏的凭据位置。';
  }

  const groupLabels: Record<string, string> = {
    'hidden-jira-secrets': '隐藏 Jira secret',
    'url-credentials': 'URL 与签名 query 凭据',
    'inline-secret-text': '内嵌 secret 文本',
    'named-credential-fields': '命名凭据字段',
    'other-redacted-fields': '其它脱敏字段',
  };
  const groupActions: Record<string, string> = {
    'hidden-jira-secrets': '在导入后的规则里重新录入或重建这些 masked Jira secret 字段。',
    'url-credentials': '为目标环境重新生成 signed URL、webhook token、function key 或 API gateway query 凭据。',
    'inline-secret-text': '确认这段文本是否仍需要凭据；只恢复目标环境安全值，或保留占位。',
    'named-credential-fields': '在目标 Jira 里重新录入 API key、JWT/client assertion、Authorization header 或 password/token 字段。',
    'other-redacted-fields': '启用前在 Jira 里复核这些占位字段。',
  };
  const groups = buildJiraAutomationImportSecretReentryQueueGroups(slots);
  const groupText = groups.map((group) => {
    const visibleSlots = group.slots.slice(0, maxSlotsPerGroup).map((slot) => (
      `${slot.path}${slot.label ? ` (${slot.label})` : ''}`
    ));
    const hiddenCount = Math.max(0, group.slots.length - visibleSlots.length);
    return `${groupLabels[group.id] || group.label} (${group.slots.length})：${visibleSlots.join(' | ')}${hiddenCount > 0 ? `，另有 ${hiddenCount} 个` : ''}。${groupActions[group.id] || group.action}`;
  });

  return [
    `凭据重录队列：${groups.length} 组，共 ${slots.length} 个脱敏位置。`,
    ...groupText,
    '创建禁用副本可以继续；但在 Jira 启用前，只重建、重录或明确留空真正需要的目标字段，占位符不是可工作的凭据。',
  ].join(' ');
}

function formatJiraImportButtonCredentialQueueSummary(
  slots: JiraAutomationImportSecretReentrySlot[],
): string {
  if (slots.length === 0) {
    return jiraImportText(
      'No redacted credential slots were detected in this preview; ordinary Jira review still applies.',
      '当前预览未检测到被脱敏的凭据位置；仍需按普通 Jira 复核处理。',
    );
  }

  const groups = buildJiraAutomationImportSecretReentryQueueGroups(slots);
  const groupLabels: Record<string, string> = {
    'hidden-jira-secrets': '隐藏 Jira secret',
    'url-credentials': 'URL 与签名 query 凭据',
    'inline-secret-text': '内嵌 secret 文本',
    'named-credential-fields': '命名凭据字段',
    'other-redacted-fields': '其它脱敏字段',
  };
  const visibleGroups = groups.slice(0, 3).map((group) => {
    const label = isJiraAutomationImportEnglish()
      ? group.label
      : (groupLabels[group.id] || group.label);
    return `${label} ${group.slots.length}`;
  });
  const hiddenGroupCount = Math.max(0, groups.length - visibleGroups.length);
  const hiddenText = hiddenGroupCount > 0
    ? jiraImportText(`, ${hiddenGroupCount} more group(s)`, `，另有 ${hiddenGroupCount} 组`)
    : '';

  return jiraImportText(
    `${groups.length} credential re-entry group(s), ${slots.length} redacted credential slot(s): ${visibleGroups.join(', ')}${hiddenText}.`,
    `${groups.length} 个凭据重录组，共 ${slots.length} 个脱敏位置：${visibleGroups.join('、')}${hiddenText}。`,
  );
}

function buildJiraImportCreateButtonBoundaryLabel(options: {
  buttonPrefix: string;
  importedRuleName: string;
  projectKey: string;
  highRiskCount: number;
  secretReentrySlots: JiraAutomationImportSecretReentrySlot[];
  sourceAllowsChainedTrigger: boolean;
  preventChainedTrigger: boolean;
  disableAfterImport: boolean;
}): string {
  const importedRuleName = sanitizeJiraAutomationImportDisplayText(options.importedRuleName);
  const projectKey = sanitizeJiraAutomationImportDisplayText(options.projectKey);
  const reviewText = options.highRiskCount > 0
    ? jiraImportText(
      `${options.highRiskCount} high-risk review item(s) and the Jira-side Activation plan remain open${options.disableAfterImport ? ' before enablement' : ' even though this import will be enabled'}.`,
      `${options.highRiskCount} 个高风险复核项和 Jira 侧启用计划仍未完成${options.disableAfterImport ? '，需在启用前处理' : '，但本次导入将直接启用规则'}。`,
    )
    : jiraImportText(
      'Jira-side review still remains open before enablement.',
      'Jira 侧复核仍需在启用前完成。',
    );
  const chainingText = options.sourceAllowsChainedTrigger
    ? (options.preventChainedTrigger
      ? jiraImportText(
        `This preview blocks rule chaining in the ${options.disableAfterImport ? 'disabled' : 'enabled'} copy.`,
        `当前预览会在${options.disableAfterImport ? '禁用' : '启用'}副本中阻止链式触发。`,
      )
      : jiraImportText(
        'This preview preserves source rule chaining after you later enable the disabled copy.',
        '当前预览会保留源规则链式触发；以后启用禁用副本后其它规则可能触发它。',
      ))
    : jiraImportText(
      'Rule chaining stays disabled in the imported copy.',
      '导入副本会保持链式触发禁用。',
    );
  const credentialText = formatJiraImportButtonCredentialQueueSummary(options.secretReentrySlots);
  const importedState = options.disableAfterImport ? 'DISABLED' : 'ENABLED';
  const noSideEffectText = options.disableAfterImport
    ? jiraImportText(
      'Sends one sanitized POST only; does not enable, run, activate schedules, restore secrets, edit the source rule, or create working credentials.',
      '只发送一个已清洗的 POST；不会启用、运行、激活 schedule、恢复 secret、编辑源规则或创建可工作的凭据。',
    )
    : jiraImportText(
      'Sends one sanitized POST that creates the rule enabled; it does not run the rule immediately, restore secrets, edit the source rule, or create working credentials.',
      '发送一个已清洗的 POST，并以启用状态创建规则；不会立即运行规则、恢复 secret、编辑源规则或创建可工作的凭据。',
    );

  return jiraImportText(
    `${options.buttonPrefix}: create "${importedRuleName}" with ${importedState} state in ${projectKey}. ${reviewText} ${credentialText} ${chainingText} ${noSideEffectText}`,
    `${options.buttonPrefix}：在 ${projectKey} 中创建 "${importedRuleName}" 的 Jira ${options.disableAfterImport ? '禁用' : '启用'}副本。${reviewText}${credentialText}${chainingText}${noSideEffectText}`,
  );
}

function translateJiraImportReviewLabel(item: JiraAutomationImportReviewChecklistItem): string {
  if (isJiraAutomationImportEnglish()) {
    return item.label;
  }

  return {
    'target-project': '目标项目范围',
    'source-format': '来源格式兼容性',
    'jql-filters': 'JQL 与过滤器',
    'source-project-references': '源项目引用',
    'external-effects': '外部动作与凭据',
    'custom-components': '自定义 / app 组件',
    'environment-bindings': '目标环境绑定',
    'smart-values': 'Smart value 行为',
    schedule: '定时计划与时区',
    'rule-chaining': '规则链式触发',
    'version-compatibility': 'Jira Automation 版本',
  }[item.id] || item.label;
}

function translateJiraImportReviewDetail(item: JiraAutomationImportReviewChecklistItem): string {
  if (isJiraAutomationImportEnglish()) {
    return item.detail;
  }

  return {
    'target-project':
      '导入副本会限定在当前 Jira 项目；嵌入的项目 key、项目 id、filter 和自定义文本不会自动改写。',
    'source-format':
      '来源文件标记为 cloud=false。启用前确认源 / 目标 Jira Automation 版本兼容，必要时在目标规则里重建 Web request header、app 组件或凭据。',
    'jql-filters':
      '规则里有 JQL 或 filter 依赖；导入后需要确认它们在目标项目仍然指向正确范围。',
    'source-project-references':
      '检测到源项目引用；Personal AI 只重映射规则项目范围，不会自动改写所有内嵌引用。',
    'external-effects':
      'Web request、外部动作、账号、连接或 secret 需要在目标 Jira 里重新连接、重录或确认。',
    'custom-components':
      '目标 Jira 项目必须存在相同的 app-provided component，导入副本才可信。',
    'environment-bindings':
      '检测到 custom field、saved filter、connection 或账号等环境绑定；启用前需要在目标项目确认。',
    'smart-values':
      'Smart value 依赖运行时上下文；启用前用受控 issue 或 audit run 验证。',
    schedule:
      '检测到定时触发器。启用前确认频率、时区、JQL 窗口和重复运行风险。',
    'rule-chaining':
      '源规则允许被其它 automation rule 触发；Personal AI 默认阻止导入副本继承这个能力。',
    'version-compatibility':
      '尽量使用同版本 Jira Automation 的导出文件；Jira 可能拒绝不兼容 JSON。',
  }[item.id] || item.detail;
}

function translateJiraImportEnablementLabel(step: JiraAutomationImportEnablementStep): string {
  if (isJiraAutomationImportEnglish()) {
    return step.label;
  }

  return {
    'keep-disabled': '保持导入副本禁用',
    'confirm-source-format': '确认来源格式兼容',
    'map-target-search': '映射目标项目查询依赖',
    'reconnect-external-effects': '重连外部动作与凭据',
    'confirm-app-components': '确认 app 组件可用',
    'test-dynamic-behavior': '测试动态触发行为',
    'confirm-actor-and-audit': '确认执行人权限与 audit 结果',
  }[step.id] || step.label;
}

function translateJiraImportEnablementDetail(step: JiraAutomationImportEnablementStep): string {
  if (isJiraAutomationImportEnglish()) {
    return step.detail;
  }

  return {
    'keep-disabled': '先把规则作为禁用副本创建，完成下面的复核后再在 Jira 里启用。',
    'confirm-source-format':
      '启用前确认源 / 目标 Jira Automation 版本和导出格式兼容；不兼容的 Web request、app 组件或凭据需要在目标规则里重建。',
    'map-target-search':
      'JQL、filter、custom field 或源项目引用需要在目标项目验证；项目 scope 重映射不会自动改写这些内嵌值。',
    'reconnect-external-effects':
      '外部请求、连接、账号、收件人和 secret 需要在目标 Jira 项目里重新连接、重录或确认。',
    'confirm-app-components':
      '确认目标 Jira 项目安装并授权了同样的 app-provided component。',
    'test-dynamic-behavior':
      '用受控 issue 或 audit run 检查 schedule、smart value 和链式触发行为。',
    'confirm-actor-and-audit':
      '确认当前 Jira 执行人有权限完成每个动作，启用后检查第一次 audit log。',
  }[step.id] || step.detail;
}

function translateJiraImportFindingLabel(finding: JiraAutomationImportReviewFinding): string {
  if (isJiraAutomationImportEnglish()) {
    return finding.label;
  }

  return {
    'custom-components': '自定义 / app 组件',
    'jql-filters': 'JQL / 过滤器',
    'source-project-references': '源项目引用',
    'web-requests': 'Web request',
    'hard-coded-urls': '硬编码 URL',
    secrets: 'Secret',
    'sensitive-values': '敏感 / 隐藏值',
    'custom-fields': 'Custom field',
    'saved-filters': 'Saved filter',
    connections: '连接 / 凭据',
    accounts: '账号 / 收件人',
    'smart-values': 'Smart value',
  }[finding.id] || finding.label;
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
async function getCurrentOwnerId(): Promise<string> {
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
  }

  // 如果页面元素中也获取不到，尝试通过API获取（使用统一的认证方法）
  try {
    console.log('Trying to get ownerId from JIRA API...');
    const response = await jiraFetch(window.location.origin + '/rest/api/2/myself', {
      authMode: 'cookie-always',
      requestLabel: 'fetch Jira current user for automation import',
    });
    
    if (response.ok) {
      const userInfo = await response.json();
      const resolvedOwnerId = userInfo.key || userInfo.name || userInfo.accountId;
      if (resolvedOwnerId) {
        console.log('Found ownerId from JIRA API:', resolvedOwnerId);
        // 保存到localStorage
        setLocalStorageItem('ownerId', resolvedOwnerId);
        return resolvedOwnerId;
      }
    } else {
      console.warn('Failed to fetch user info from JIRA API:', response.status, response.statusText);
    }
  } catch (error) {
    console.warn('Error fetching user info from JIRA API:', error);
  }
  
  console.warn('Could not find ownerId');
  return '';
}

// 全局变量存储当前项目ID
interface JiraAutomationProjectContext {
  projectId: string;
  projectKey: string;
  projectTypeKey?: string;
}

declare global {
  interface Window {
    __PERSONAL_AI_PROJECT_ID__?: string;
    __PERSONAL_AI_PROJECT_CONTEXT__?: JiraAutomationProjectContext;
    __PERSONAL_AI_PENDING_NAVIGATION__?: string | null;
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
  if (window !== window.top) {
    try {
      const parentProjectKey = window.top?.__PERSONAL_AI_PROJECT_CONTEXT__?.projectKey;
      if (parentProjectKey) {
        console.log('Found projectKey from parent window context:', parentProjectKey);
        return parentProjectKey;
      }
    } catch (error) {
      console.log('Cannot access parent projectKey, trying local detection...');
    }
  }

  // 首先尝试从URL参数获取projectKey
  const urlParams = new URLSearchParams(window.location.search);
  const projectKey = urlParams.get('projectKey');
  if (projectKey) {
    console.log('Found projectKey from URL params:', projectKey);
    return projectKey;
  }
  
  if (typeof (window as any).WRM !== 'undefined' && (window as any).WRM._unparsedData) {
    const wrmProjectKey = (window as any).WRM._unparsedData['project-key'];
    if (wrmProjectKey) {
      console.log('Found projectKey from WRM._unparsedData:', wrmProjectKey);
      return wrmProjectKey;
    }
  }

  try {
    if (window.top && window.top !== window) {
      const parentUrl = new URL(window.top.location.href);
      const parentProjectKey = parentUrl.searchParams.get('projectKey');
      if (parentProjectKey) {
        console.log('Found projectKey from parent URL:', parentProjectKey);
        return parentProjectKey;
      }
    }
  } catch (error) {
    console.log('Cannot access parent URL for projectKey detection');
  }

  console.warn('Could not find projectKey');
  return '';
}

async function resolveCurrentProjectContext(): Promise<JiraAutomationProjectContext | null> {
  if (window !== window.top) {
    try {
      const parentContext = window.top?.__PERSONAL_AI_PROJECT_CONTEXT__;
      if (parentContext?.projectId && parentContext.projectKey) {
        return parentContext;
      }
    } catch (error) {
      console.log('Cannot access parent project context, resolving locally...');
    }
  }

  let projectId = getProjectId();
  let projectKey = getProjectKey();
  let projectTypeKey: string | undefined;

  if (!projectKey && projectId && !/^\d+$/.test(projectId)) {
    projectKey = projectId;
  }

  if (projectKey) {
    try {
      const response = await jiraFetch(`${window.location.origin}/rest/api/2/project/${encodeURIComponent(projectKey)}`, {
        authMode: 'cookie-when-safe',
        requestLabel: `resolve Jira project ${projectKey}`,
      });

      if (!response.ok) {
        console.warn('Failed to resolve project by key:', response.status, response.statusText);
        if (!/^\d+$/.test(projectId)) {
          return null;
        }
      } else {
        const projectInfo = await response.json();
        projectId = String(projectInfo.id || projectId);
        projectKey = String(projectInfo.key || projectKey);
        projectTypeKey = projectInfo.projectTypeKey;
      }
    } catch (error) {
      console.warn('Error resolving project by key:', error);
      if (!/^\d+$/.test(projectId)) {
        return null;
      }
    }
  } else if (!/^\d+$/.test(projectId)) {
    console.warn('Cannot resolve Jira project context without projectKey');
    return null;
  }

  if (!projectId || !/^\d+$/.test(projectId) || !projectKey) {
    console.warn('Resolved Jira project context is incomplete:', { projectId, projectKey });
    return null;
  }

  const context: JiraAutomationProjectContext = { projectId, projectKey, projectTypeKey };
  try {
    window.__PERSONAL_AI_PROJECT_ID__ = projectId;
    window.__PERSONAL_AI_PROJECT_CONTEXT__ = context;
  } catch (error) {
    console.log('Could not store project context on current window:', error);
  }

  return context;
}

// 等待元素出现（预留功能）
function _waitForElement(selector: string, timeout = 10000): Promise<Element> {
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

// 创建automation rule的API调用（使用统一的认证方法）
async function createAutomationRule(ruleData: ImportRule, projectId: string): Promise<any> {
  try {
    const response = await jiraFetch(`/rest/cb-automation/latest/project/${projectId}/rule`, {
      method: 'POST',
      body: ruleData,
      authMode: 'cookie-when-safe',
      requestLabel: 'create Jira automation rule',
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      const safeErrorText = redactJiraAutomationImportErrorText(errorText);
      console.warn('Jira Automation import create request failed:', {
        status: response.status,
        statusText: response.statusText,
        detail: safeErrorText,
      });
      throw new Error(`API call failed: ${response.status} ${response.statusText}${safeErrorText ? `\n${safeErrorText}` : ''}`);
    }
    
    return await response.json();
  } catch (error) {
    const safeErrorMessage = redactJiraAutomationImportErrorText(error);
    console.error('Error creating automation rule:', safeErrorMessage);
    throw new Error(safeErrorMessage);
  }
}

// 显示成功消息
function showSuccessMessage(message: string): void {
  const successDiv = document.createElement('div');
  successDiv.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background-color: #4CAF50;
    color: white;
    padding: 16px;
    border-radius: 4px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    z-index: 10000;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    line-height: 1.45;
    max-width: min(520px, calc(100vw - 40px));
    word-break: break-word;
  `;
  successDiv.textContent = message;
  document.body.appendChild(successDiv);
  
  setTimeout(() => {
    document.body.removeChild(successDiv);
  }, 5000);
}

function navigateToImportedJiraAutomationRule(ruleUrl: string): void {
  console.log('Storing navigation URL and refreshing iframe:', ruleUrl);

  if (window.top) {
    try {
      (window.top as any).__PERSONAL_AI_PENDING_NAVIGATION__ = ruleUrl;
      console.log('Stored navigation URL in parent window:', ruleUrl);
    } catch (error) {
      console.error('Failed to store navigation URL in parent window:', error);
    }
  }

  window.location.reload();
}

function getJiraAutomationImportMessageDocuments(doc: Document = document): Document[] {
  const docs = new Set<Document>([doc, document]);
  [window.parent, window.top].forEach((targetWindow) => {
    try {
      if (targetWindow?.document) {
        docs.add(targetWindow.document);
      }
    } catch {
      // Cross-origin parent windows cannot be inspected; local Jira frames normally share origin.
    }
  });
  return Array.from(docs);
}

function clearJiraAutomationImportTransientMessages(doc: Document = document): void {
  getJiraAutomationImportMessageDocuments(doc).forEach((targetDoc) => {
    targetDoc
      .querySelectorAll('[data-personal-ai-jira-import-error="true"]')
      .forEach((element) => element.parentElement?.removeChild(element));
  });
}

function showJiraAutomationImportSuccessReceipt(
  doc: Document,
  message: string,
  options: {
    ruleUrl?: string;
    fallbackReload?: boolean;
    delayMs?: number;
  } = {},
): void {
  clearJiraAutomationImportTransientMessages(doc);
  const previousReceipt = doc.querySelector('[data-personal-ai-jira-import-success-receipt="true"]');
  previousReceipt?.parentElement?.removeChild(previousReceipt);

  const hostWindow = doc.defaultView || window;
  const delayMs = options.delayMs ?? JIRA_AUTOMATION_IMPORT_POST_SUCCESS_NAVIGATION_DELAY_MS;
  let navigationTimer: number | undefined;
  let navigationStarted = false;

  const receipt = doc.createElement('div');
  receipt.setAttribute('role', 'status');
  receipt.setAttribute('aria-live', 'polite');
  receipt.setAttribute('data-personal-ai-jira-import-success-receipt', 'true');
  receipt.style.cssText = `
    position: fixed;
    top: 18px;
    right: 18px;
    width: min(560px, calc(100vw - 36px));
    max-height: calc(100vh - 36px);
    overflow: auto;
    padding: 14px 16px;
    border-radius: 6px;
    border: 1px solid #BAF3DB;
    background: #E3FCEF;
    color: #172B4D;
    box-shadow: 0 6px 18px rgba(9, 30, 66, 0.2);
    z-index: 10002;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    box-sizing: border-box;
  `;

  const title = doc.createElement('div');
  title.textContent = jiraImportText('Post-import navigation receipt', '导入后跳转回执');
  title.style.cssText = 'font-weight: 700; font-size: 13px; line-height: 1.35; margin-bottom: 5px;';

  const body = doc.createElement('div');
  body.textContent = message;
  body.style.cssText = 'font-size: 12px; line-height: 1.45; color: #172B4D; word-break: break-word;';

  receipt.appendChild(title);
  receipt.appendChild(body);

  const runNavigation = () => {
    if (navigationStarted) {
      return;
    }
    navigationStarted = true;
    if (navigationTimer !== undefined) {
      hostWindow.clearTimeout(navigationTimer);
      navigationTimer = undefined;
    }

    if (options.ruleUrl) {
      navigateToImportedJiraAutomationRule(options.ruleUrl);
      return;
    }

    if (options.fallbackReload) {
      hostWindow.location.reload();
    }
  };

  if (options.ruleUrl || options.fallbackReload) {
    const navigationStatus = doc.createElement('div');
    navigationStatus.style.cssText = 'margin-top: 8px; font-size: 12px; line-height: 1.45; color: #44546F;';
    navigationStatus.textContent = options.ruleUrl
      ? jiraImportText(
        'Auto navigation will open the imported rule details shortly. Staying here only cancels navigation; it does not undo the disabled copy, enable the rule, run automation, or complete Jira-side review.',
        '稍后会自动打开导入后的规则详情。留在当前页只会取消跳转；不会撤销禁用副本、启用规则、运行自动化或完成 Jira 侧复核。',
      )
      : jiraImportText(
        'Jira did not return a rule id, so Personal AI will refresh this page shortly. Staying here only cancels refresh; it does not undo the disabled copy or confirm enablement review.',
        'Jira 没有返回规则 id，稍后只会刷新当前页。留在当前页只会取消刷新；不会撤销禁用副本或确认启用复核。',
      );

    const actions = doc.createElement('div');
    actions.style.cssText = 'display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-top: 10px;';

    const primaryAction = createDialogButton(
      doc,
      options.ruleUrl
        ? jiraImportText('Open rule details now', '现在打开规则详情')
        : jiraImportText('Refresh now', '现在刷新'),
      'primary',
    );
    primaryAction.style.padding = '6px 10px';
    primaryAction.style.fontSize = '12px';
    primaryAction.addEventListener('click', runNavigation);

    const stayAction = createDialogButton(
      doc,
      jiraImportText('Stay here', '留在当前页'),
      'secondary',
    );
    stayAction.style.padding = '6px 10px';
    stayAction.style.fontSize = '12px';
    stayAction.addEventListener('click', () => {
      if (navigationTimer !== undefined) {
        hostWindow.clearTimeout(navigationTimer);
        navigationTimer = undefined;
      }
      navigationStatus.textContent = jiraImportText(
        'Auto navigation canceled. The disabled copy still exists; finish the Activation plan in Jira before enabling it.',
        '已取消自动跳转。禁用副本仍已创建；启用前仍要在 Jira 里完成 Activation plan。',
      );
      setDialogButtonDisabled(stayAction, true);
    });

    actions.appendChild(primaryAction);
    actions.appendChild(stayAction);
    receipt.appendChild(navigationStatus);
    receipt.appendChild(actions);
    navigationTimer = hostWindow.setTimeout(runNavigation, delayMs);
  } else {
    hostWindow.setTimeout(() => {
      if (doc.body.contains(receipt)) {
        doc.body.removeChild(receipt);
      }
    }, 7000);
  }

  doc.body.appendChild(receipt);
}

function showInfoMessage(
  message: string,
  options: {
    durationMs?: number;
    dataAttribute?: string;
  } = {},
): () => void {
  const infoDiv = document.createElement('div');
  if (options.dataAttribute) {
    infoDiv.setAttribute(options.dataAttribute, 'true');
  }
  infoDiv.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background-color: #0747A6;
    color: white;
    padding: 16px;
    border-radius: 4px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    z-index: 10000;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    max-width: 400px;
  `;
  infoDiv.textContent = message;
  document.body.appendChild(infoDiv);

  let timeoutId: number | undefined;
  if (options.durationMs !== 0) {
    timeoutId = window.setTimeout(() => {
      if (document.body.contains(infoDiv)) {
        document.body.removeChild(infoDiv);
      }
    }, options.durationMs ?? 5000);
  }

  return () => {
    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId);
    }
    if (document.body.contains(infoDiv)) {
      document.body.removeChild(infoDiv);
    }
  };
}

function showImportPreflightReceipt(
  doc: Document,
  file: File,
  projectContext: JiraAutomationProjectContext,
): () => void {
  const receipt = doc.createElement('div');
  receipt.setAttribute('role', 'status');
  receipt.setAttribute('aria-live', 'polite');
  receipt.setAttribute('data-personal-ai-jira-import-preflight', 'true');
  receipt.style.cssText = `
    position: fixed;
    top: 18px;
    right: 18px;
    max-width: min(420px, calc(100vw - 36px));
    padding: 14px 16px;
    border-radius: 6px;
    border: 1px solid #CCE0FF;
    background: #E9F2FF;
    color: #172B4D;
    box-shadow: 0 6px 18px rgba(9, 30, 66, 0.18);
    z-index: 10001;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    box-sizing: border-box;
  `;

  const title = doc.createElement('div');
  title.textContent = jiraImportText('Preparing disabled-copy preview', '正在准备禁用副本预览');
  title.style.cssText = 'font-weight: 700; font-size: 13px; line-height: 1.35; margin-bottom: 4px;';

  const body = doc.createElement('div');
  body.textContent = jiraImportText(
    `Reading ${file.name} locally and checking target rule names in ${projectContext.projectKey}. No Jira create, edit, enable, run, schedule activation, or secret restoration has happened.`,
    `正在本机读取 ${file.name}，并检查 ${projectContext.projectKey} 的目标规则名。尚未创建、编辑、启用、运行 Jira 规则，也没有激活 schedule 或恢复 secret。`,
  );
  body.style.cssText = 'font-size: 12px; line-height: 1.45; color: #44546F; word-break: break-word;';

  receipt.appendChild(title);
  receipt.appendChild(body);
  doc.body.appendChild(receipt);

  return () => {
    if (doc.body.contains(receipt)) {
      doc.body.removeChild(receipt);
    }
  };
}

// 显示错误消息
function showErrorMessage(
  message: string,
  options: {
    dataAttribute?: string;
    doc?: Document;
  } = {},
): void {
  const targetDoc = options.doc || document;
  const errorDiv = targetDoc.createElement('div');
  if (options.dataAttribute) {
    errorDiv.setAttribute(options.dataAttribute, 'true');
  }
  errorDiv.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
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
  targetDoc.body.appendChild(errorDiv);
  
  setTimeout(() => {
    if (targetDoc.body.contains(errorDiv)) {
      targetDoc.body.removeChild(errorDiv);
    }
  }, 10000);
}

function buildImportFailureReceipt(errorMessage: string): string {
  if (isJiraAutomationImportEnglish()) {
    return [
      'Jira import failed or could not be confirmed.',
      errorMessage,
      'Personal AI did not auto-enable, run, activate schedules, or restore secrets.',
      'Check Jira for a disabled copy before retrying; re-enter hidden secrets in Jira before enabling.',
    ].filter(Boolean).join(' ');
  }

  return [
    'Jira 导入失败，或尚未确认创建成功。',
    errorMessage,
    'Personal AI 没有自动启用、运行、激活 schedule 或恢复 secret。',
    '重试前先检查 Jira 是否已经出现 disabled copy；启用前需要在 Jira 里重新录入隐藏 secret。',
  ].filter(Boolean).join(' ');
}

function createDialogButton(doc: Document, text: string, variant: 'primary' | 'secondary'): HTMLButtonElement {
  const button = doc.createElement('button');
  button.type = 'button';
  button.textContent = text;
  button.style.cssText =
    variant === 'primary'
      ? `
        padding: 8px 16px;
        border: none;
        border-radius: 4px;
        background: #0052cc;
        color: white;
        cursor: pointer;
        font-weight: 500;
      `
      : `
        padding: 8px 16px;
        border: 1px solid #DFE1E6;
        border-radius: 4px;
        background: white;
        color: #172B4D;
        cursor: pointer;
        font-weight: 500;
      `;
  return button;
}

function setDialogButtonDisabled(button: HTMLButtonElement | null, disabled: boolean): void {
  if (!button) {
    return;
  }

  button.disabled = disabled;
  button.style.opacity = disabled ? '0.55' : '1';
  button.style.cursor = disabled ? 'not-allowed' : 'pointer';
}

async function copyTextToClipboard(doc: Document, text: string): Promise<boolean> {
  const clipboard = doc.defaultView?.navigator?.clipboard || navigator.clipboard;
  if (clipboard?.writeText) {
    try {
      await clipboard.writeText(text);
      return true;
    } catch (error) {
      console.debug('Clipboard API copy failed, falling back to textarea copy:', error);
    }
  }

  const textarea = doc.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', 'true');
  textarea.style.cssText = `
    position: fixed;
    top: -9999px;
    left: -9999px;
    width: 1px;
    height: 1px;
    opacity: 0;
  `;
  doc.body.appendChild(textarea);

  try {
    textarea.focus();
    textarea.select();
    return doc.execCommand('copy');
  } catch (error) {
    console.debug('Textarea clipboard copy failed:', error);
    return false;
  } finally {
    doc.body.removeChild(textarea);
  }
}

function getFocusableDialogElements(container: HTMLElement): HTMLElement[] {
  const elements = container.querySelectorAll<HTMLElement>(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
  );

  return Array.from(elements).filter((element) => (
    !element.hasAttribute('disabled') &&
    element.getAttribute('aria-hidden') !== 'true' &&
    element.getClientRects().length > 0
  ));
}

function trapDialogFocus(event: KeyboardEvent, dialog: HTMLElement, doc: Document): void {
  if (event.key !== 'Tab') {
    return;
  }

  const focusableElements = getFocusableDialogElements(dialog);
  if (focusableElements.length === 0) {
    event.preventDefault();
    dialog.focus();
    return;
  }

  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];
  const activeElement = doc.activeElement;

  if (!dialog.contains(activeElement)) {
    event.preventDefault();
    firstElement.focus();
    return;
  }

  if (event.shiftKey && activeElement === firstElement) {
    event.preventDefault();
    lastElement.focus();
    return;
  }

  if (!event.shiftKey && activeElement === lastElement) {
    event.preventDefault();
    firstElement.focus();
  }
}

function appendInfoRow(doc: Document, container: HTMLElement, label: string, value: string): void {
  const row = doc.createElement('div');
  row.style.cssText = 'display: flex; gap: 8px; margin-bottom: 6px;';

  const labelEl = doc.createElement('span');
  labelEl.textContent = label;
  labelEl.style.cssText = 'flex: 0 0 110px; color: #6B778C; font-size: 13px;';

  const valueEl = doc.createElement('span');
  valueEl.textContent = value || jiraImportText('Not provided', '未提供');
  valueEl.style.cssText = 'flex: 1; color: #172B4D; font-size: 13px; word-break: break-word;';

  row.appendChild(labelEl);
  row.appendChild(valueEl);
  container.appendChild(row);
}

async function getExistingAutomationRuleNames(projectId: string): Promise<string[]> {
  const response = await jiraFetch(`/rest/cb-automation/latest/project/${projectId}/rule`, {
    authMode: 'cookie-when-safe',
    requestLabel: 'fetch Jira automation rule names for import collision check',
  });

  if (!response.ok) {
    const errorText = await response.text();
    const safeErrorText = redactJiraAutomationImportErrorText(errorText);
    throw new Error(`Rule name lookup failed: ${response.status} ${response.statusText}${safeErrorText ? `\n${safeErrorText}` : ''}`);
  }

  const rules = await response.json();
  if (!Array.isArray(rules)) {
    throw new Error('Rule name lookup failed: unexpected Jira response shape');
  }

  return rules
    .map((rule) => (typeof rule?.name === 'string' ? rule.name.trim() : ''))
    .filter(Boolean);
}

async function getExistingAutomationRuleNameCheck(
  projectId: string,
): Promise<{ existingRuleNames: string[]; nameCheck: JiraAutomationImportNameCheck }> {
  try {
    const existingRuleNames = await getExistingAutomationRuleNames(projectId);
    return {
      existingRuleNames,
      nameCheck: {
        status: 'confirmed',
        checkedRuleCount: existingRuleNames.length,
      },
    };
  } catch (error) {
    const failureReason = redactJiraAutomationImportErrorText(
      error instanceof Error ? error.message : String(error ?? 'Unknown rule-list lookup failure'),
    );
    console.warn('Jira Automation import name collision check failed:', failureReason);
    return {
      existingRuleNames: [],
      nameCheck: {
        status: 'unconfirmed',
        checkedRuleCount: 0,
        failureReason: failureReason || 'Target rule list unavailable',
      },
    };
  }
}

function formatReviewSignalValue(count: number, samples: string[]): string {
  if (count === 0) {
    return jiraImportText('None detected', '未检测到');
  }

  const visibleSamples = samples.slice(0, 2);
  const sampleText = visibleSamples.join(' | ');
  if (isJiraAutomationImportEnglish()) {
    const moreText = count > visibleSamples.length ? `, ${count - visibleSamples.length} more` : '';
    return sampleText ? `${count} to review: ${sampleText}${moreText}` : `${count} to review`;
  }

  const moreText = count > visibleSamples.length ? `，另有 ${count - visibleSamples.length} 个` : '';
  return sampleText ? `${count} 个待复核：${sampleText}${moreText}` : `${count} 个待复核`;
}

function getChecklistSeverityStyle(severity: JiraAutomationImportReviewChecklistItem['severity']): string {
  if (severity === 'high') {
    return 'background: #FFEBE6; color: #AE2E24; border-color: #FFD2CC;';
  }

  if (severity === 'medium') {
    return 'background: #FFF7D6; color: #7F5F01; border-color: #F5CD47;';
  }

  return 'background: #E9F2FF; color: #0C66E4; border-color: #CCE0FF;';
}

function renderReviewChecklist(
  doc: Document,
  container: HTMLElement,
  items: JiraAutomationImportReviewChecklistItem[],
): void {
  container.textContent = '';

  const title = doc.createElement('div');
  title.textContent = jiraImportText('Review before enabling', '启用前复核');
  title.style.cssText = 'font-weight: 700; font-size: 13px; margin-bottom: 4px; color: #172B4D;';
  container.appendChild(title);

  const help = doc.createElement('div');
  help.textContent = jiraImportText(
    'The import stays disabled. Use this checklist before enabling the copy in Jira.',
    '导入副本会保持禁用。启用前请在 Jira 里按这份清单复核。',
  );
  help.style.cssText = 'font-size: 12px; line-height: 1.45; color: #44546F; margin-bottom: 10px;';
  container.appendChild(help);

  items.forEach((item) => {
    const row = doc.createElement('div');
    row.style.cssText = `
      display: grid;
      grid-template-columns: 76px minmax(0, 1fr);
      gap: 10px;
      padding: 9px 0;
      border-top: 1px solid #EBECF0;
    `;

    const severity = doc.createElement('span');
    severity.textContent = formatJiraImportSeverity(item.severity);
    severity.style.cssText = `
      align-self: start;
      justify-self: start;
      min-width: 54px;
      text-align: center;
      padding: 2px 6px;
      border: 1px solid;
      border-radius: 3px;
      font-size: 11px;
      line-height: 1.4;
      font-weight: 700;
      ${getChecklistSeverityStyle(item.severity)}
    `;

    const content = doc.createElement('div');
    content.style.cssText = 'min-width: 0;';

    const label = doc.createElement('div');
    label.textContent = translateJiraImportReviewLabel(item);
    label.style.cssText = 'font-size: 13px; line-height: 1.35; font-weight: 600; color: #172B4D;';

    const detail = doc.createElement('div');
    detail.textContent = translateJiraImportReviewDetail(item);
    detail.style.cssText = 'font-size: 12px; line-height: 1.45; color: #44546F; margin-top: 2px; word-break: break-word;';

    content.appendChild(label);
    content.appendChild(detail);
    row.appendChild(severity);
    row.appendChild(content);
    container.appendChild(row);
  });
}

function renderEnablementPlan(
  doc: Document,
  container: HTMLElement,
  steps: JiraAutomationImportEnablementStep[],
): void {
  container.textContent = '';

  const title = doc.createElement('div');
  title.textContent = jiraImportText('Activation plan', '启用计划');
  title.style.cssText = 'font-weight: 700; font-size: 13px; margin-bottom: 4px; color: #172B4D;';
  container.appendChild(title);

  const help = doc.createElement('div');
  help.textContent = jiraImportText(
    'Follow these steps after the disabled copy is created and before enabling it in Jira.',
    '禁用副本创建后、在 Jira 启用前，按这些步骤处理。',
  );
  help.style.cssText = 'font-size: 12px; line-height: 1.45; color: #44546F; margin-bottom: 10px;';
  container.appendChild(help);

  steps.forEach((step, index) => {
    const row = doc.createElement('div');
    row.style.cssText = `
      display: grid;
      grid-template-columns: 34px minmax(0, 1fr);
      gap: 10px;
      padding: 9px 0;
      border-top: 1px solid #EBECF0;
    `;

    const stepNumber = doc.createElement('span');
    stepNumber.textContent = String(index + 1);
    stepNumber.style.cssText = `
      align-self: start;
      justify-self: start;
      width: 22px;
      height: 22px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 1px solid #DFE1E6;
      border-radius: 50%;
      background: #F7F8F9;
      color: #172B4D;
      font-size: 12px;
      line-height: 1;
      font-weight: 700;
    `;

    const content = doc.createElement('div');
    content.style.cssText = 'min-width: 0;';

    const labelRow = doc.createElement('div');
    labelRow.style.cssText = 'display: flex; align-items: center; gap: 8px; flex-wrap: wrap;';

    const label = doc.createElement('span');
    label.textContent = translateJiraImportEnablementLabel(step);
    label.style.cssText = 'font-size: 13px; line-height: 1.35; font-weight: 600; color: #172B4D;';

    const severity = doc.createElement('span');
    severity.textContent = formatJiraImportSeverity(step.severity);
    severity.style.cssText = `
      padding: 1px 5px;
      border: 1px solid;
      border-radius: 3px;
      font-size: 10px;
      line-height: 1.35;
      font-weight: 700;
      ${getChecklistSeverityStyle(step.severity)}
    `;

    const detail = doc.createElement('div');
    detail.textContent = translateJiraImportEnablementDetail(step);
    detail.style.cssText = 'font-size: 12px; line-height: 1.45; color: #44546F; margin-top: 2px; word-break: break-word;';

    labelRow.appendChild(label);
    labelRow.appendChild(severity);
    content.appendChild(labelRow);
    content.appendChild(detail);
    row.appendChild(stepNumber);
    row.appendChild(content);
    container.appendChild(row);
  });
}

function formatCreateRequestReferenceScope(summary: JiraAutomationRuleSummary): string {
  const parts = [
    summary.jqlReferenceCount > 0 ? `${summary.jqlReferenceCount} ${jiraImportText('JQL/filter', 'JQL/filter')}` : '',
    summary.hardcodedUrlCount > 0 ? `${summary.hardcodedUrlCount} URL` : '',
    summary.customFieldReferenceCount > 0 ? `${summary.customFieldReferenceCount} ${jiraImportText('custom field', 'custom field')}` : '',
    summary.savedFilterReferenceCount > 0 ? `${summary.savedFilterReferenceCount} ${jiraImportText('saved filter', 'saved filter')}` : '',
    summary.connectionReferenceCount > 0 ? `${summary.connectionReferenceCount} ${jiraImportText('connection/credential', 'connection/credential')}` : '',
    summary.emailReferenceCount + summary.accountReferenceCount > 0
      ? `${summary.emailReferenceCount + summary.accountReferenceCount} ${jiraImportText('account/recipient', '账号/收件人')}`
      : '',
    summary.sourceProjectReferenceCount > 0 ? `${summary.sourceProjectReferenceCount} ${jiraImportText('source project reference', '源项目引用')}` : '',
    summary.smartValueReferenceCount > 0 ? `${summary.smartValueReferenceCount} smart value` : '',
  ].filter(Boolean);

  if (parts.length === 0) {
    return jiraImportText(
      'No embedded environment-bound references were detected; Personal AI still only remaps the Jira project scope for the disabled copy.',
      '未检测到内嵌环境绑定引用；Personal AI 仍然只会为禁用副本重映射 Jira 项目范围。',
    );
  }

  return jiraImportText(
    `Project scope is remapped to the target Jira project, but embedded ${parts.join(', ')} reference(s) remain review items and are not automatically rewritten.`,
    `项目 scope 会重映射到目标 Jira 项目，但内嵌的 ${parts.join('、')} 仍然只是复核项，不会被自动改写。`,
  );
}

function renderImportOutcomeSummary(
  doc: Document,
  container: HTMLElement,
  importedRuleName: string,
  projectContext: JiraAutomationProjectContext,
  summary: JiraAutomationRuleSummary,
  checklist: JiraAutomationImportReviewChecklistItem[],
  enablementPlan: JiraAutomationImportEnablementStep[],
  sourceAllowsChainedTrigger: boolean,
  preventChainedTrigger: boolean,
  nameCheck: JiraAutomationImportNameCheck,
  disableAfterImport: boolean,
): void {
  container.textContent = '';

  const highCount = checklist.filter((item) => item.severity === 'high').length;
  const chainingState = sourceAllowsChainedTrigger
    ? (preventChainedTrigger ? 'chained triggers blocked' : 'chained triggers preserved')
    : 'chained triggers disabled';

  const title = doc.createElement('div');
  title.textContent = disableAfterImport
    ? jiraImportText('Disabled import preview', '禁用副本导入预览')
    : jiraImportText('Enabled import preview', '启用规则导入预览');
  title.style.cssText = 'font-weight: 700; font-size: 14px; margin-bottom: 4px; color: #172B4D;';

  const body = doc.createElement('div');
  const firstAction = enablementPlan.find((step) => step.severity === 'high') || enablementPlan[0];
  const nextActionText = firstAction
    ? jiraImportText(` Next: ${firstAction.label}.`, ` 下一步：${translateJiraImportEnablementLabel(firstAction)}。`)
    : '';
  const nameCheckText = nameCheck.status === 'unconfirmed'
    ? jiraImportText(
      ' Target name collision check is not confirmed; verify the disabled copy in Jira before retrying or enabling.',
      ' 目标规则名冲突检查未确认；重试或启用前请先在 Jira 检查 disabled copy。',
    )
    : '';
  body.textContent = jiraImportText(
    `${importedRuleName} will be created ${disableAfterImport ? 'disabled' : 'enabled'} in ${projectContext.projectKey}. ${formatChecklistSeverityCounts(checklist)}; ${highCount} high-risk item(s); ${chainingState}.${nextActionText}${nameCheckText}`,
    `${importedRuleName} 将在 ${projectContext.projectKey} 中创建为${disableAfterImport ? '禁用' : '启用'}状态。${formatChecklistSeverityCounts(checklist)}；${highCount} 个高风险项；${chainingState === 'chained triggers blocked' ? '已阻止链式触发' : chainingState === 'chained triggers preserved' ? '将保留链式触发' : '链式触发为禁用状态'}。${nextActionText}${nameCheckText}`,
  );
  body.style.cssText = 'font-size: 12px; line-height: 1.45; color: #44546F; word-break: break-word;';

  container.appendChild(title);
  container.appendChild(body);
  appendInfoRow(
    doc,
    container,
    jiraImportText('Current step', '当前步骤'),
    jiraImportText(
      'Preview only; no Jira create request has been sent yet. Cancel or Escape closes this dialog without writing to Jira.',
      '仅预览；尚未发送 Jira create request。取消或按 Escape 会关闭弹窗，不会写入 Jira。',
    ),
  );
  appendInfoRow(
    doc,
    container,
    jiraImportText('Create request', '创建请求'),
    jiraImportText(
      `On import, Personal AI sends one sanitized POST to create "${importedRuleName}" as ${disableAfterImport ? 'DISABLED' : 'ENABLED'} in ${projectContext.projectKey}; the source rule is not edited or run.`,
      `点击导入后，Personal AI 会发送一个已清洗的 POST，在 ${projectContext.projectKey} 中创建 ${disableAfterImport ? 'DISABLED' : 'ENABLED'} 状态的 "${importedRuleName}"；源规则不会被编辑或运行。`,
    ),
  );
  appendInfoRow(doc, container, jiraImportText('Reference scope', '引用范围'), formatCreateRequestReferenceScope(summary));
}

function renderImportBoundaryReceipt(
  doc: Document,
  container: HTMLElement,
  importedRuleName: string,
  projectContext: JiraAutomationProjectContext,
  sourceCloud: boolean | undefined,
  summary: JiraAutomationRuleSummary,
  secretReentrySlots: JiraAutomationImportSecretReentrySlot[],
  checklist: JiraAutomationImportReviewChecklistItem[],
  enablementPlan: JiraAutomationImportEnablementStep[],
  sourceAllowsChainedTrigger: boolean,
  preventChainedTrigger: boolean,
  nameCheckReceipt: string,
  disableAfterImport: boolean,
): void {
  container.textContent = '';

  const highCount = checklist.filter((item) => item.severity === 'high').length;
  const firstAction = enablementPlan.find((step) => step.severity === 'high') || enablementPlan[0];
  const secretText = summary.secretReferenceCount > 0 || summary.sensitiveReferenceCount > 0
    ? 're-enter hidden secrets, '
    : '';
  const chainText = sourceAllowsChainedTrigger
    ? (preventChainedTrigger ? 'Other-rule triggers stay blocked in the copy.' : 'Other-rule triggers will be preserved from the source.')
    : 'The source rule does not allow other rules to trigger it.';

  const title = doc.createElement('div');
  title.textContent = jiraImportText('Import boundary receipt', '导入边界回执');
  title.style.cssText = 'font-weight: 700; font-size: 13px; margin-bottom: 4px; color: #172B4D;';
  container.appendChild(title);

  const help = doc.createElement('div');
  help.textContent = highCount > 0
    ? jiraImportText(
      'High-risk review items were detected. You can import the disabled copy now, but finish the review in Jira before enabling it.',
      '已检测到高风险复核项。你可以现在导入禁用副本，但启用前仍要在 Jira 里完成复核。',
    )
    : jiraImportText(
      'This receipt summarizes the create-stage boundary before Jira receives the import request.',
      '这条回执总结 Jira 收到导入请求前的创建边界。',
    );
  help.style.cssText = 'font-size: 12px; line-height: 1.45; color: #44546F; margin-bottom: 10px;';
  container.appendChild(help);

  const rows = [
    {
      label: jiraImportText('Creates', '创建内容'),
      value: jiraImportText(
        `"${importedRuleName}" as a ${disableAfterImport ? 'disabled' : 'enabled'} copy in ${projectContext.projectKey} (${projectContext.projectId}).`,
        `在 ${projectContext.projectKey} (${projectContext.projectId}) 中创建 "${importedRuleName}" ${disableAfterImport ? '禁用' : '启用'}副本。`,
      ),
    },
    {
      label: jiraImportText('Source format', '来源格式'),
      value: formatJiraImportSourceFormat(sourceCloud),
    },
    {
      label: jiraImportText('Name check', '名称检查'),
      value: nameCheckReceipt.replace(/^Name collision check:\s*/i, ''),
    },
    {
      label: jiraImportText('Does not', '不会执行'),
      value: jiraImportText(
        'No auto-enable, run, schedule activation, or secret restoration.',
        '不会自动启用、运行、激活 schedule 或恢复 secret。',
      ),
    },
    {
      label: jiraImportText('Secret map', 'Secret 重录图'),
      value: secretReentrySlots.length > 0
        ? jiraImportText(
          `${formatJiraAutomationImportSecretReentrySummary(secretReentrySlots)}. Placeholder or REDACTED values are not working credentials.`,
          `${formatJiraImportSecretSummary(secretReentrySlots)}。占位符或 REDACTED 值不是可工作的凭据。`,
        )
        : formatJiraImportSecretSummary(secretReentrySlots),
    },
    {
      label: jiraImportText('Credential restore gate', '凭据恢复门控'),
      value: formatJiraImportCredentialRestoreGateSummary(secretReentrySlots),
    },
    {
      label: jiraImportText('Re-entry queue', '凭据重录队列'),
      value: formatJiraImportSecretReentryQueue(secretReentrySlots, 2),
    },
    {
      label: jiraImportText('Carries over', '会带入'),
      value: jiraImportText(
        'Sanitized review note and Activation plan stay in the Jira description.',
        '已清洗的复核备注和启用计划会保留在 Jira 描述中。',
      ),
    },
    {
      label: jiraImportText('Next in Jira', 'Jira 中下一步'),
      value: jiraImportText(
        `Open the imported rule details, ${secretText}test manually, then enable in Jira. ${firstAction ? `First check: ${firstAction.label}. ` : ''}${chainText}`,
        `打开导入后的规则详情，${secretText ? '重新录入隐藏 secret，' : ''}手动测试后再在 Jira 中启用。${firstAction ? `优先检查：${translateJiraImportEnablementLabel(firstAction)}。` : ''}${sourceAllowsChainedTrigger ? (preventChainedTrigger ? '副本会继续阻止其它规则触发。' : '副本会保留源规则的链式触发能力。') : '源规则本身不允许其它规则触发它。'}`,
      ),
    },
  ];

  rows.forEach((row) => appendInfoRow(doc, container, row.label, row.value));
}

function buildPostImportSuccessReceipt(
  importedRuleName: string,
  projectContext: JiraAutomationProjectContext,
  sourceCloud: boolean | undefined,
  summary: JiraAutomationRuleSummary,
  secretReentrySlots: JiraAutomationImportSecretReentrySlot[],
  enablementPlan: JiraAutomationImportEnablementStep[],
  nameCheck: JiraAutomationImportNameCheck,
): string {
  const firstAction = enablementPlan.find((step) => step.severity === 'high') || enablementPlan[0];
  if (!isJiraAutomationImportEnglish()) {
    const nextAction = summary.secretReferenceCount > 0 || summary.sensitiveReferenceCount > 0
      ? '重新录入隐藏 secret，手动测试后再在 Jira 中启用。'
      : '手动测试后再在 Jira 中启用。';
    const firstCheckText = firstAction ? ` 优先检查：${translateJiraImportEnablementLabel(firstAction)}。` : '';
    const secretMapText = secretReentrySlots.length > 0
      ? ` Secret 重录图：${formatJiraImportSecretSummary(secretReentrySlots)}。占位符不是可工作的凭据。`
      : '';
    const credentialGateText = secretReentrySlots.length > 0
      ? ' 凭据恢复门控仍未完成；这些字段需要在 Jira 中重新录入或明确留空后再启用。'
      : '';
    const credentialQueueText = secretReentrySlots.length > 0
      ? ` ${formatJiraImportSecretReentryQueue(secretReentrySlots, 2)}`
      : '';

    return [
      `已导入禁用副本："${importedRuleName}"，目标项目 ${projectContext.projectKey}。`,
      nameCheck.status === 'unconfirmed'
        ? '创建前未确认目标规则名冲突；重试或启用前请先检查 Jira 规则列表是否重复。'
        : '',
      sourceCloud === false
        ? '来源文件是 cloud=false；启用前请确认 Web request、app 组件和凭据等格式敏感部分。'
        : '',
      '没有自动启用、运行、激活 schedule 或恢复 secret。',
      nextAction,
      secretMapText,
      credentialGateText,
      credentialQueueText,
      '已清洗的复核备注和启用计划已写入 Jira 描述。',
      `${firstCheckText}正在跳转到导入规则。`,
    ].filter(Boolean).join(' ');
  }

  const nextAction = summary.secretReferenceCount > 0 || summary.sensitiveReferenceCount > 0
    ? 'Re-enter hidden secrets, test manually, then enable in Jira.'
    : 'Test manually, then enable in Jira.';
  const firstCheckText = firstAction ? ` First check: ${firstAction.label}.` : '';
  const secretMapText = secretReentrySlots.length > 0
    ? ` Secret map: ${formatJiraAutomationImportSecretReentrySummary(secretReentrySlots)}. Placeholders are not working credentials.`
    : '';
  const credentialGateText = secretReentrySlots.length > 0
    ? ' Credential restore gate remains open until those fields are re-entered or intentionally left blank in Jira.'
    : '';
  const credentialQueueText = secretReentrySlots.length > 0
    ? ` ${formatJiraAutomationImportSecretReentryQueue(secretReentrySlots, 2)}`
    : '';

  return [
    `Imported disabled copy: "${importedRuleName}" in ${projectContext.projectKey}.`,
    nameCheck.status === 'unconfirmed'
      ? 'Target name collision check was not confirmed before create; verify the rules list for duplicates before retrying or enabling.'
      : '',
    sourceCloud === false
      ? 'Source file was cloud=false; confirm format-sensitive web request, app, and credential pieces before enabling.'
      : '',
    'No auto-enable, run, schedule activation, or secret restoration happened.',
    nextAction,
    secretMapText,
    credentialGateText,
    credentialQueueText,
    'Sanitized review note and Activation plan are in the Jira description.',
    `${firstCheckText}Redirecting to the imported rule.`,
  ].filter(Boolean).join(' ');
}

function buildCreateRequestPendingReceipt(
  importedRuleName: string,
  projectContext: JiraAutomationProjectContext,
  ruleData: ImportRule,
): string {
  const chainingText = ruleData.canOtherRuleTrigger
    ? jiraImportText(
      'Chained triggers are preserved by this preview choice.',
      '根据当前预览选择，链式触发会被保留。',
    )
    : jiraImportText(
      'Chained triggers are blocked or disabled in the imported copy.',
      '导入副本中链式触发会被阻止或保持禁用。',
    );

  if (!isJiraAutomationImportEnglish()) {
    return [
      `创建请求处理中：正在为 ${projectContext.projectKey} 发送一个已清洗的 POST，用来创建 "${importedRuleName}"。`,
      `Payload 状态是 ${ruleData.state || 'DISABLED'}；Jira 尚未确认创建成功。`,
      chainingText,
      '这条等待回执会保留到 Jira 返回成功或失败；关闭或刷新页面不会撤销已经发送的 create request。',
      '没有自动启用、运行、激活 schedule 或恢复 secret。',
    ].join(' ');
  }

  return [
    `Create request pending: sending one sanitized POST for "${importedRuleName}" in ${projectContext.projectKey}.`,
    `Payload state is ${ruleData.state || 'DISABLED'}; Jira has not confirmed creation yet.`,
    chainingText,
    'This pending receipt stays until Jira returns success or failure; closing or refreshing the page does not undo an already-sent create request.',
    'No auto-enable, run, schedule activation, or secret restoration is happening.',
  ].join(' ');
}

function renderReviewFindings(
  doc: Document,
  container: HTMLElement,
  findings: JiraAutomationImportReviewFinding[],
): void {
  container.textContent = '';

  const title = doc.createElement('div');
  title.textContent = jiraImportText('Detected environment bindings and components', '检测到的环境绑定与组件');
  title.style.cssText = 'font-weight: 700; font-size: 13px; margin-bottom: 4px; color: #172B4D;';
  container.appendChild(title);

  const help = doc.createElement('div');
  help.textContent = jiraImportText(
    'These values and component types are copied into the disabled rule description so they are still visible after import.',
    '这些值和组件类型会写入禁用副本的描述中，导入后仍可查看。',
  );
  help.style.cssText = 'font-size: 12px; line-height: 1.45; color: #44546F; margin-bottom: 10px;';
  container.appendChild(help);

  if (findings.length === 0) {
    const empty = doc.createElement('div');
    empty.textContent = jiraImportText(
      'No JQL, URL, account, sensitive value, custom field, saved filter, connection, smart value, custom/app component, or source-project binding was detected.',
      '未检测到 JQL、URL、账号、敏感值、custom field、saved filter、connection、smart value、自定义/app 组件或源项目绑定。',
    );
    empty.style.cssText = 'font-size: 12px; line-height: 1.45; color: #44546F;';
    container.appendChild(empty);
    return;
  }

  findings.forEach((finding) => {
    const row = doc.createElement('div');
    row.style.cssText = `
      display: grid;
      grid-template-columns: 96px minmax(0, 1fr);
      gap: 10px;
      padding: 9px 0;
      border-top: 1px solid #EBECF0;
    `;

    const severity = doc.createElement('span');
    severity.textContent = formatJiraImportSeverity(finding.severity);
    severity.style.cssText = `
      align-self: start;
      justify-self: start;
      min-width: 54px;
      text-align: center;
      padding: 2px 6px;
      border: 1px solid;
      border-radius: 3px;
      font-size: 11px;
      line-height: 1.4;
      font-weight: 700;
      ${getChecklistSeverityStyle(finding.severity)}
    `;

    const content = doc.createElement('div');
    content.style.cssText = 'min-width: 0;';

    const label = doc.createElement('div');
    label.textContent = `${translateJiraImportFindingLabel(finding)} (${finding.count})`;
    label.style.cssText = 'font-size: 13px; line-height: 1.35; font-weight: 600; color: #172B4D;';
    content.appendChild(label);

    const samples = finding.samples.length > 0
      ? finding.samples.join(' | ')
      : jiraImportText(
        'Review the rule component that owns this binding.',
        '请复核拥有这个绑定的规则组件。',
      );
    const detail = doc.createElement('div');
    detail.textContent = samples;
    detail.style.cssText = 'font-size: 12px; line-height: 1.45; color: #44546F; margin-top: 2px; word-break: break-word;';
    content.appendChild(detail);

    row.appendChild(severity);
    row.appendChild(content);
    container.appendChild(row);
  });
}

function formatChecklistSeverityCounts(items: JiraAutomationImportReviewChecklistItem[]): string {
  const counts = items.reduce(
    (acc, item) => {
      acc[item.severity] += 1;
      return acc;
    },
    { high: 0, medium: 0, low: 0 },
  );

  if (isJiraAutomationImportEnglish()) {
    return [
      counts.high > 0 ? `${counts.high} high` : '',
      counts.medium > 0 ? `${counts.medium} medium` : '',
      counts.low > 0 ? `${counts.low} low` : '',
    ].filter(Boolean).join(', ') || 'No blocking checks detected';
  }

  return [
    counts.high > 0 ? `${counts.high} 高` : '',
    counts.medium > 0 ? `${counts.medium} 中` : '',
    counts.low > 0 ? `${counts.low} 低` : '',
  ].filter(Boolean).join('，') || '未检测到阻塞检查';
}

function formatHighRiskReviewDetail(
  items: JiraAutomationImportReviewChecklistItem[],
  enablementPlan: JiraAutomationImportEnablementStep[],
): string {
  const highRiskItems = items.filter((item) => item.severity === 'high');
  if (highRiskItems.length === 0) {
    return '';
  }

  const visibleLabels = highRiskItems.slice(0, 4).map(translateJiraImportReviewLabel);
  const hiddenCount = Math.max(0, highRiskItems.length - visibleLabels.length);
  const labelsText = [
    visibleLabels.join(', '),
    hiddenCount > 0 ? jiraImportText(`${hiddenCount} more`, `另有 ${hiddenCount} 个`) : '',
  ].filter(Boolean).join(', ');
  const firstHighRiskStep = enablementPlan.find((step) => step.severity === 'high');
  const nextText = firstHighRiskStep
    ? jiraImportText(
      ` Next: ${firstHighRiskStep.label}.`,
      ` 下一步：${translateJiraImportEnablementLabel(firstHighRiskStep)}。`,
    )
    : '';

  return jiraImportText(
    `${highRiskItems.length} high-risk item(s): ${labelsText}.${nextText} You can import the disabled copy now; complete these checks in Jira before enabling the rule.`,
    `${highRiskItems.length} 个高风险项：${labelsText}。${nextText}你可以直接导入禁用副本；启用规则前仍要在 Jira 里完成这些检查。`,
  );
}

function showImportPreviewDialog(
  exportedData: ExportedData,
  file: File,
  projectContext: JiraAutomationProjectContext,
  doc: Document,
  existingRuleNames: string[],
  nameCheck: JiraAutomationImportNameCheck,
): Promise<{ confirmed: boolean; selectedRuleIndex: number; allowOtherRuleTrigger: boolean; disableAfterImport: boolean }> {
  return new Promise((resolve) => {
    const previousActiveElement = doc.activeElement instanceof HTMLElement ? doc.activeElement : null;
    const overlay = doc.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(9, 30, 66, 0.54);
      z-index: 10000;
      display: flex;
      align-items: flex-start;
      justify-content: center;
      overflow-y: auto;
      padding: 24px 24px 12px;
      box-sizing: border-box;
    `;

    const dialog = doc.createElement('div');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'personal-ai-jira-import-title');
    dialog.tabIndex = -1;
    dialog.style.cssText = `
      width: min(640px, 100%);
      max-height: min(720px, 92vh);
      overflow: auto;
      background: white;
      border-radius: 8px;
      box-shadow: 0 8px 28px rgba(9, 30, 66, 0.28);
      color: #172B4D;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      padding: 24px;
      box-sizing: border-box;
    `;

    const header = doc.createElement('div');
    header.style.cssText = `
      position: sticky;
      top: -24px;
      z-index: 1;
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 12px;
      margin: -24px -24px 12px;
      padding: 16px 24px 12px;
      background: white;
      border-bottom: 1px solid #EBECF0;
    `;

    const title = doc.createElement('h3');
    title.id = 'personal-ai-jira-import-title';
    title.textContent = jiraImportText('Import Jira Automation Rule', '导入 Jira Automation 规则');
    title.style.cssText = 'margin: 0; font-size: 18px; line-height: 1.3;';
    header.appendChild(title);
    dialog.appendChild(header);

    const intro = doc.createElement('p');
    intro.textContent = jiraImportText(
      `Found ${exportedData.rules.length} rule(s) in ${file.name}. Review what the selected rule does, then import it into ${projectContext.projectKey}.`,
      `在 ${file.name} 中找到 ${exportedData.rules.length} 条规则。检查所选规则后，可导入到 ${projectContext.projectKey}。`,
    );
    intro.style.cssText = 'margin: 0 0 16px; color: #44546F; font-size: 13px; line-height: 1.5;';
    dialog.appendChild(intro);

    const outcomeBox = doc.createElement('div');
    outcomeBox.style.cssText = `
      margin-bottom: 16px;
      padding: 12px;
      border: 1px solid #CCE0FF;
      border-radius: 6px;
      background: #E9F2FF;
    `;
    dialog.appendChild(outcomeBox);

    const boundaryReceiptBox = doc.createElement('div');
    boundaryReceiptBox.style.cssText = `
      margin-bottom: 16px;
      padding: 12px;
      border: 1px solid #DFE1E6;
      border-radius: 6px;
      background: white;
    `;
    dialog.appendChild(boundaryReceiptBox);

    let selectedRuleIndex = 0;
    let select: HTMLSelectElement | null = null;
    let preventChainedTrigger = Boolean(exportedData.rules[0]?.canOtherRuleTrigger);
    let disableAfterImport = true;
    let topConfirmButton: HTMLButtonElement | null = null;
    let currentReviewPacket = '';
    let currentHighRiskCount = 0;
    let currentImportedRuleName = '';
    let currentSecretReentrySlots: JiraAutomationImportSecretReentrySlot[] = [];
    let currentSourceAllowsChainedTrigger = false;
    let currentPreventChainedTrigger = false;
    let createStageStatus: HTMLSpanElement | null = null;

    const updateCreateStageControls = () => {
      setDialogButtonDisabled(topConfirmButton, false);

      const headerButtonLabel = buildJiraImportCreateButtonBoundaryLabel(
        {
          buttonPrefix: jiraImportText('Import rule', '导入规则'),
          importedRuleName: currentImportedRuleName,
          projectKey: projectContext.projectKey,
          highRiskCount: currentHighRiskCount,
          secretReentrySlots: currentSecretReentrySlots,
          sourceAllowsChainedTrigger: currentSourceAllowsChainedTrigger,
          preventChainedTrigger: currentPreventChainedTrigger,
          disableAfterImport,
        },
      );

      [
        { button: topConfirmButton, label: headerButtonLabel },
      ].forEach(({ button, label }) => {
        if (!button) {
          return;
        }
        button.title = label;
        button.setAttribute('aria-label', label);
        if (createStageStatus?.id) {
          button.setAttribute('aria-describedby', createStageStatus.id);
        }
      });

      if (!createStageStatus) {
        return;
      }

      createStageStatus.textContent = currentHighRiskCount > 0
        ? jiraImportText(
          `Create-stage ready: direct import is allowed; Jira-side Activation plan review remains open${disableAfterImport ? ' before enablement' : ', and this import will be enabled immediately'}.`,
          `创建阶段就绪：可直接导入；Jira 侧启用计划复核仍未完成${disableAfterImport ? '，需在启用前处理' : '，本次导入将立即启用规则'}。`,
        )
        : jiraImportText(
          `Create-stage ready: the imported rule will be ${disableAfterImport ? 'disabled' : 'enabled'}.`,
          `创建阶段就绪：导入规则将处于${disableAfterImport ? '不启用' : '启用'}状态。`,
        );
      createStageStatus.style.color = '#216E4E';
    };

    if (exportedData.rules.length > 1) {
      const selectLabel = doc.createElement('label');
      selectLabel.textContent = jiraImportText('Rule to import', '要导入的规则');
      selectLabel.style.cssText = 'display: block; margin-bottom: 6px; font-weight: 600; font-size: 13px;';
      dialog.appendChild(selectLabel);

      select = doc.createElement('select');
      select.style.cssText = `
        width: 100%;
        box-sizing: border-box;
        margin-bottom: 16px;
        padding: 8px 10px;
        border: 1px solid #DFE1E6;
        border-radius: 4px;
        background: white;
        color: #172B4D;
        font-size: 14px;
      `;

      exportedData.rules.forEach((rule, index) => {
        const option = doc.createElement('option');
        option.value = String(index);
        option.textContent = `${index + 1}. ${sanitizeJiraAutomationImportDisplayText(rule.name)}`;
        select?.appendChild(option);
      });

      dialog.appendChild(select);
    }

    const details = doc.createElement('div');
    details.style.cssText = `
      margin-bottom: 16px;
      padding: 12px;
      border: 1px solid #DFE1E6;
      border-radius: 6px;
      background: #F7F8F9;
    `;
    dialog.appendChild(details);

    const findingsBox = doc.createElement('div');
    findingsBox.style.cssText = `
      margin-bottom: 16px;
      padding: 12px;
      border: 1px solid #DFE1E6;
      border-radius: 6px;
      background: white;
    `;
    dialog.appendChild(findingsBox);

    const checklistBox = doc.createElement('div');
    checklistBox.style.cssText = `
      margin-bottom: 16px;
      padding: 12px;
      border: 1px solid #DFE1E6;
      border-radius: 6px;
      background: white;
    `;
    dialog.appendChild(checklistBox);

    const enablementPlanBox = doc.createElement('div');
    enablementPlanBox.style.cssText = `
      margin-bottom: 16px;
      padding: 12px;
      border: 1px solid #DFE1E6;
      border-radius: 6px;
      background: white;
    `;
    dialog.appendChild(enablementPlanBox);

    const safeguardBox = doc.createElement('div');
    safeguardBox.style.cssText = `
      margin-bottom: 16px;
      padding: 12px;
      border: 1px solid #DFE1E6;
      border-radius: 6px;
      background: white;
    `;

    const chainedTriggerLabel = doc.createElement('label');
    chainedTriggerLabel.style.cssText = 'display: flex; align-items: flex-start; gap: 8px; color: #172B4D; font-size: 13px; line-height: 1.45;';

    const chainedTriggerCheckbox = doc.createElement('input');
    chainedTriggerCheckbox.type = 'checkbox';
    chainedTriggerCheckbox.checked = preventChainedTrigger;
    chainedTriggerCheckbox.style.cssText = 'margin-top: 2px;';

    const chainedTriggerText = doc.createElement('span');
    chainedTriggerText.textContent = jiraImportText(
      'Prevent other automation rules from triggering this imported copy until it has been reviewed.',
      '复核完成前，阻止其它 automation rule 触发这个导入副本。',
    );

    chainedTriggerLabel.appendChild(chainedTriggerCheckbox);
    chainedTriggerLabel.appendChild(chainedTriggerText);
    safeguardBox.appendChild(chainedTriggerLabel);

    const chainedTriggerReceipt = doc.createElement('div');
    chainedTriggerReceipt.setAttribute('role', 'status');
    chainedTriggerReceipt.setAttribute('aria-live', 'polite');
    chainedTriggerReceipt.setAttribute('data-personal-ai-jira-import-chaining-choice-receipt', 'true');
    chainedTriggerReceipt.style.cssText = `
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px solid #EBECF0;
    `;
    safeguardBox.appendChild(chainedTriggerReceipt);
    dialog.appendChild(safeguardBox);

    const highRiskReviewBox = doc.createElement('div');
    highRiskReviewBox.style.cssText = `
      display: none;
      margin-bottom: 16px;
      padding: 12px;
      border: 1px solid #FFD2CC;
      border-radius: 6px;
      background: #FFEBE6;
    `;

    const highRiskAcknowledgementContent = doc.createElement('span');
    const highRiskAcknowledgementTitle = doc.createElement('span');
    highRiskAcknowledgementTitle.textContent = jiraImportText('High-risk review items detected', '检测到高风险复核项');
    highRiskAcknowledgementTitle.style.cssText = 'display: block; font-weight: 700; color: #AE2E24;';

    const highRiskAcknowledgementText = doc.createElement('span');
    highRiskAcknowledgementText.style.cssText = 'display: block; margin-top: 2px; color: #44546F;';

    highRiskAcknowledgementContent.appendChild(highRiskAcknowledgementTitle);
    highRiskAcknowledgementContent.appendChild(highRiskAcknowledgementText);
    highRiskReviewBox.appendChild(highRiskAcknowledgementContent);

    const highRiskAcknowledgementStatus = doc.createElement('span');
    highRiskAcknowledgementStatus.setAttribute('role', 'status');
    highRiskAcknowledgementStatus.style.cssText = 'display: block; margin-top: 8px; color: #44546F; font-size: 12px; line-height: 1.45;';
    highRiskReviewBox.appendChild(highRiskAcknowledgementStatus);
    dialog.appendChild(highRiskReviewBox);

    const reviewPacketBox = doc.createElement('div');
    reviewPacketBox.style.cssText = `
      margin-bottom: 16px;
      padding: 12px;
      border: 1px solid #DFE1E6;
      border-radius: 6px;
      background: white;
    `;

    const reviewPacketTitle = doc.createElement('div');
    reviewPacketTitle.textContent = jiraImportText('Enablement review packet', '启用复核包');
    reviewPacketTitle.style.cssText = 'font-weight: 700; font-size: 13px; margin-bottom: 4px; color: #172B4D;';

    const reviewPacketHelp = doc.createElement('div');
    reviewPacketHelp.textContent = jiraImportText(
      'Copy the sanitized checklist and detected bindings before you leave the preview. This is a handoff packet, not an approval.',
      '离开预览前可以复制已清洗的检查清单和检测到的绑定。这只是交接包，不是启用批准。',
    );
    reviewPacketHelp.style.cssText = 'font-size: 12px; line-height: 1.45; color: #44546F; margin-bottom: 10px;';

    const reviewPacketScope = doc.createElement('div');
    reviewPacketScope.style.cssText = 'margin-bottom: 10px;';
    appendInfoRow(
      doc,
      reviewPacketScope,
      jiraImportText('Clipboard only', '仅本机剪贴板'),
      jiraImportText(
        'Copy writes a sanitized local clipboard packet for review handoff.',
        '复制只会把已清洗的复核交接包写入本机剪贴板。',
      ),
    );
    appendInfoRow(
      doc,
      reviewPacketScope,
      jiraImportText('Does not', '不会执行'),
      jiraImportText(
        'It does not create or edit Jira rules, enable automation, run schedules, or restore secrets.',
        '不会创建或编辑 Jira 规则，不会启用自动化、运行 schedule 或恢复 secret。',
      ),
    );

    const reviewPacketActions = doc.createElement('div');
    reviewPacketActions.style.cssText = 'display: flex; align-items: center; gap: 10px; flex-wrap: wrap;';

    const copyReviewPacketButton = createDialogButton(doc, jiraImportText('Copy review packet', '复制复核包'), 'secondary');
    const copyReviewPacketStatus = doc.createElement('span');
    copyReviewPacketStatus.setAttribute('role', 'status');
    copyReviewPacketStatus.style.cssText = 'font-size: 12px; color: #44546F;';

    reviewPacketActions.appendChild(copyReviewPacketButton);
    reviewPacketActions.appendChild(copyReviewPacketStatus);
    reviewPacketBox.appendChild(reviewPacketTitle);
    reviewPacketBox.appendChild(reviewPacketHelp);
    reviewPacketBox.appendChild(reviewPacketScope);
    reviewPacketBox.appendChild(reviewPacketActions);
    dialog.appendChild(reviewPacketBox);

    const warningBox = doc.createElement('div');
    warningBox.style.cssText = `
      margin-bottom: 18px;
      padding: 12px;
      border-radius: 6px;
      background: #FFFAE6;
      border-left: 3px solid #FFAB00;
    `;
    dialog.appendChild(warningBox);

    const triggerImport = () => {
      const selectedRule = exportedData.rules[selectedRuleIndex];
      close({
        confirmed: true,
        selectedRuleIndex,
        allowOtherRuleTrigger: Boolean(selectedRule.canOtherRuleTrigger) && !preventChainedTrigger,
        disableAfterImport,
      });
    };

    const renderRuleDetails = () => {
      const rule = exportedData.rules[selectedRuleIndex];
      const summary = summarizeJiraAutomationImportRule(rule);
      const reviewSignals = collectJiraAutomationImportReviewSignals(rule);
      const secretReentrySlots = collectJiraAutomationImportSecretReentrySlots(rule);
      const reviewChecklist = buildJiraAutomationImportReviewChecklist(rule, exportedData.cloud);
      const reviewFindings = buildJiraAutomationImportReviewFindings(rule);
      const enablementPlan = buildJiraAutomationImportEnablementPlan(rule, exportedData.cloud);
      const highRiskCount = reviewChecklist.filter((item) => item.severity === 'high').length;
      currentHighRiskCount = highRiskCount;
      const defaultImportedRuleName = buildJiraAutomationImportedRuleName(rule.name);
      const importedRuleName = buildJiraAutomationUniqueImportedRuleName(rule.name, existingRuleNames);
      const importNameWasNumbered = importedRuleName !== defaultImportedRuleName;
      const nameCheckReceipt = buildJiraAutomationImportNameCheckReceipt(rule, {
        projectId: projectContext.projectId,
        projectKey: projectContext.projectKey,
        projectTypeKey: projectContext.projectTypeKey,
        existingRuleNames,
        nameCheck,
      }, importedRuleName);
      const accountReferenceSamples = [
        ...reviewSignals.emailReferences,
        ...reviewSignals.accountReferences,
      ];
      const accountReferenceCount = summary.emailReferenceCount + summary.accountReferenceCount;
      const sourceAllowsChainedTrigger = Boolean(rule.canOtherRuleTrigger);
      const allowOtherRuleTrigger = sourceAllowsChainedTrigger && !preventChainedTrigger;
      currentImportedRuleName = importedRuleName;
      currentSecretReentrySlots = secretReentrySlots;
      currentSourceAllowsChainedTrigger = sourceAllowsChainedTrigger;
      currentPreventChainedTrigger = preventChainedTrigger;
      currentReviewPacket = buildJiraAutomationImportReviewPacket(rule, {
        projectId: projectContext.projectId,
        projectKey: projectContext.projectKey,
        projectTypeKey: projectContext.projectTypeKey,
        allowOtherRuleTrigger,
        existingRuleNames,
        nameCheck,
        importedRuleName,
        sourceCloud: exportedData.cloud,
      });
      copyReviewPacketStatus.textContent = '';
      chainedTriggerCheckbox.disabled = !sourceAllowsChainedTrigger;
      chainedTriggerCheckbox.checked = sourceAllowsChainedTrigger && preventChainedTrigger;
      chainedTriggerText.textContent = sourceAllowsChainedTrigger
        ? jiraImportText(
          'Prevent other automation rules from triggering this imported copy until it has been reviewed.',
          '复核完成前，阻止其它 automation rule 触发这个导入副本。',
        )
        : jiraImportText(
          'The source rule does not allow other automation rules to trigger it.',
          '源规则不允许其它 automation rule 触发它。',
        );
      chainedTriggerReceipt.textContent = '';
      appendInfoRow(
        doc,
        chainedTriggerReceipt,
        jiraImportText('Rule chaining choice', '规则链式触发选择'),
        sourceAllowsChainedTrigger
          ? (preventChainedTrigger
            ? jiraImportText(
              `Current preview will block rule chaining in the imported ${disableAfterImport ? 'DISABLED' : 'ENABLED'} copy. Toggling only recalculates the preview, review packet, and create payload; no Jira create request is sent until Import rule.`,
              `当前预览会在导入的 ${disableAfterImport ? 'DISABLED' : 'ENABLED'} 副本中阻止链式触发。切换只会重算预览、复核包和 create payload；点击导入规则前不会发送 Jira create request。`,
            )
            : jiraImportText(
              'Current preview preserves source rule chaining; after you later enable this disabled copy in Jira, other automation rules may trigger it. Toggling only recalculates the preview, review packet, and create payload.',
              '当前预览会保留源规则链式触发；以后你在 Jira 中启用这个禁用副本后，其它 automation rule 可能触发它。切换只会重算预览、复核包和 create payload。',
            ))
          : jiraImportText(
            'Source rule chaining is disabled. The imported copy keeps it disabled; no Jira create request is sent until Import rule.',
            '源规则未开启链式触发；导入副本也会保持禁用。点击导入规则前不会发送 Jira create request。',
          ),
      );
      highRiskReviewBox.style.display = highRiskCount > 0 ? 'block' : 'none';
      highRiskAcknowledgementText.textContent = highRiskCount > 0
        ? formatHighRiskReviewDetail(reviewChecklist, enablementPlan)
        : '';
      highRiskAcknowledgementStatus.textContent = highRiskCount > 0
        ? jiraImportText(
          disableAfterImport
            ? 'Import is available now; the imported copy will remain disabled until you enable it in Jira.'
            : 'Import is available now; this rule will be enabled immediately even though high-risk review remains open.',
          disableAfterImport
            ? '现在可以直接导入；导入副本会保持禁用，直到你在 Jira 中手动启用。'
            : '现在可以直接导入；即使高风险复核尚未完成，本次导入也会立即启用规则。',
        )
        : '';
      updateCreateStageControls();
      renderImportOutcomeSummary(
        doc,
        outcomeBox,
        importedRuleName,
        projectContext,
        summary,
        reviewChecklist,
        enablementPlan,
        sourceAllowsChainedTrigger,
        preventChainedTrigger,
        nameCheck,
        disableAfterImport,
      );
      renderImportBoundaryReceipt(
        doc,
        boundaryReceiptBox,
        importedRuleName,
        projectContext,
        exportedData.cloud,
        summary,
        secretReentrySlots,
        reviewChecklist,
        enablementPlan,
        sourceAllowsChainedTrigger,
        preventChainedTrigger,
        nameCheckReceipt,
        disableAfterImport,
      );

      details.textContent = '';
      appendInfoRow(doc, details, jiraImportText('Rule name', '规则名称'), sanitizeJiraAutomationImportDisplayText(rule.name));
      appendInfoRow(doc, details, jiraImportText('Imported name', '导入名称'), importedRuleName);
      appendInfoRow(
        doc,
        details,
        jiraImportText('Name collision', '名称冲突'),
        importNameWasNumbered
          ? jiraImportText(
            'Existing import name found; Personal AI will create a numbered copy.',
            '发现已有导入名；Personal AI 会创建带编号的副本。',
          )
          : nameCheck.status === 'unconfirmed'
            ? jiraImportText(
              'Target rule list unavailable; imported name is best-effort and must be checked in Jira.',
              '目标规则列表不可用；导入名是 best-effort，必须在 Jira 中检查。',
            )
            : jiraImportText('None detected', '未检测到'),
      );
      appendInfoRow(doc, details, jiraImportText('Name check', '名称检查'), nameCheckReceipt.replace(/^Name collision check:\s*/i, ''));
      appendInfoRow(doc, details, jiraImportText('Source export', '来源导出'), formatJiraImportSourceFormat(exportedData.cloud));
      appendInfoRow(doc, details, jiraImportText('Source state', '来源状态'), rule.state || 'UNKNOWN');
      appendInfoRow(doc, details, jiraImportText('Trigger', '触发器'), rule.trigger?.type || 'UNKNOWN');
      appendInfoRow(doc, details, jiraImportText('Components', '组件'), jiraImportText(`${summary.componentCount} total`, `共 ${summary.componentCount} 个`));
      appendInfoRow(doc, details, jiraImportText('Custom/app components', '自定义/app 组件'), formatReviewSignalValue(summary.customComponentCount, reviewSignals.customComponentReferences));
      appendInfoRow(doc, details, jiraImportText('Enablement checks', '启用前检查'), formatChecklistSeverityCounts(reviewChecklist));
      appendInfoRow(doc, details, jiraImportText('Review note', '复核备注'), jiraImportText('Added to imported rule description', '会写入导入规则描述'));
      appendInfoRow(doc, details, jiraImportText('Actions', '动作'), String(summary.actionCount));
      appendInfoRow(doc, details, jiraImportText('Conditions', '条件'), String(summary.conditionCount));
      appendInfoRow(doc, details, jiraImportText('Web requests', 'Web request'), summary.webRequestCount > 0 ? jiraImportText(`${summary.webRequestCount} to review`, `${summary.webRequestCount} 个待复核`) : jiraImportText('None detected', '未检测到'));
      appendInfoRow(doc, details, jiraImportText('External actions', '外部动作'), summary.externalIntegrationCount > 0 ? jiraImportText(`${summary.externalIntegrationCount} to review`, `${summary.externalIntegrationCount} 个待复核`) : jiraImportText('None detected', '未检测到'));
      appendInfoRow(doc, details, jiraImportText('Secrets', 'Secrets'), formatReviewSignalValue(summary.secretReferenceCount, reviewSignals.secretReferences));
      appendInfoRow(doc, details, jiraImportText('Secret re-entry map', 'Secret 重录图'), formatJiraImportSecretSummary(secretReentrySlots));
      appendInfoRow(doc, details, jiraImportText('Credential restore gate', '凭据恢复门控'), formatJiraImportCredentialRestoreGateSummary(secretReentrySlots));
      appendInfoRow(doc, details, jiraImportText('Credential re-entry queue', '凭据重录队列'), formatJiraImportSecretReentryQueue(secretReentrySlots, 2));
      appendInfoRow(doc, details, 'JQL / filters', formatReviewSignalValue(summary.jqlReferenceCount, reviewSignals.jqlReferences));
      appendInfoRow(doc, details, jiraImportText('Hard-coded URLs', '硬编码 URL'), formatReviewSignalValue(summary.hardcodedUrlCount, reviewSignals.hardcodedUrls));
      appendInfoRow(doc, details, jiraImportText('Custom fields', 'Custom field'), formatReviewSignalValue(summary.customFieldReferenceCount, reviewSignals.customFieldReferences));
      appendInfoRow(doc, details, jiraImportText('Saved filters', 'Saved filter'), formatReviewSignalValue(summary.savedFilterReferenceCount, reviewSignals.savedFilterReferences));
      appendInfoRow(doc, details, jiraImportText('Connections', '连接'), formatReviewSignalValue(summary.connectionReferenceCount, reviewSignals.connectionReferences));
      appendInfoRow(doc, details, jiraImportText('Sensitive values', '敏感值'), formatReviewSignalValue(summary.sensitiveReferenceCount, reviewSignals.sensitiveReferences));
      appendInfoRow(doc, details, 'Smart values', formatReviewSignalValue(summary.smartValueReferenceCount, reviewSignals.smartValueReferences));
      appendInfoRow(doc, details, jiraImportText('Accounts', '账号'), formatReviewSignalValue(accountReferenceCount, accountReferenceSamples));
      appendInfoRow(doc, details, jiraImportText('Source project refs', '源项目引用'), formatReviewSignalValue(summary.sourceProjectReferenceCount, reviewSignals.sourceProjectReferences));
      appendInfoRow(doc, details, jiraImportText('Schedule', '定时计划'), summary.scheduledTrigger ? jiraImportText('Scheduled trigger', '定时触发器') : jiraImportText('No scheduled trigger', '无定时触发器'));
      appendInfoRow(
        doc,
        details,
        jiraImportText('Rule chaining', '规则链式触发'),
        sourceAllowsChainedTrigger
          ? (preventChainedTrigger
            ? jiraImportText('Blocked in imported copy', '导入副本中阻止')
            : jiraImportText('Preserved from source', '保留源规则设置'))
          : jiraImportText('Disabled in source', '源规则中禁用'),
      );
      appendInfoRow(doc, details, jiraImportText('Target project', '目标项目'), `${projectContext.projectKey} (${projectContext.projectId})`);
      appendInfoRow(doc, details, jiraImportText('Imported state', '导入状态'), disableAfterImport ? 'DISABLED' : 'ENABLED');
      renderReviewFindings(doc, findingsBox, reviewFindings);
      renderReviewChecklist(doc, checklistBox, reviewChecklist);
      renderEnablementPlan(doc, enablementPlanBox, enablementPlan);

      warningBox.textContent = '';
      const warnings = buildJiraAutomationImportWarnings(rule, exportedData.cloud);
      if (nameCheck.status === 'unconfirmed') {
        warnings.unshift('Target rule names could not be read. The imported name is a best-effort preview; check Jira for an existing or newly created disabled copy before retrying or enabling.');
      }
      if (importNameWasNumbered) {
        warnings.unshift('An existing rule already uses the default imported name. The new copy will be numbered so it stays easy to find.');
      }
      warnings.forEach((warning) => {
        const item = doc.createElement('p');
        item.textContent = warning;
        item.style.cssText = 'margin: 0 0 6px; font-size: 13px; line-height: 1.45;';
        warningBox.appendChild(item);
      });
    };

    select?.addEventListener('change', () => {
      selectedRuleIndex = Number(select?.value || '0');
      preventChainedTrigger = Boolean(exportedData.rules[selectedRuleIndex]?.canOtherRuleTrigger);
      renderRuleDetails();
    });

    chainedTriggerCheckbox.addEventListener('change', () => {
      preventChainedTrigger = chainedTriggerCheckbox.checked;
      renderRuleDetails();
    });

    copyReviewPacketButton.addEventListener('click', async () => {
      copyReviewPacketButton.disabled = true;
      copyReviewPacketStatus.textContent = jiraImportText('Copying review packet...', '正在复制复核包...');
      const copied = await copyTextToClipboard(doc, currentReviewPacket);
      copyReviewPacketStatus.textContent = copied
        ? jiraImportText(
          'Review packet copied to local clipboard only; no Jira create, enable, run, or secret restore happened.',
          '复核包已复制到本机剪贴板；没有创建、启用、运行 Jira 规则或恢复 secret。',
        )
        : jiraImportText(
          'Copy failed; no Jira create happened. Select and copy from the review note after import.',
          '复制失败；没有创建 Jira 规则。导入后可从复核备注中选择并复制。',
        );
      copyReviewPacketButton.disabled = false;
    });

    const footer = doc.createElement('div');
    footer.style.cssText = `
      position: sticky;
      bottom: 0;
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      flex-wrap: wrap;
      margin: 12px -24px -24px;
      padding: 12px 24px 24px;
      background: white;
      border-top: 1px solid #EBECF0;
    `;

    const cancelButton = createDialogButton(doc, jiraImportText('Cancel', '取消'), 'secondary');
    topConfirmButton = createDialogButton(doc, jiraImportText('Import rule', '导入规则'), 'primary');
    topConfirmButton.style.padding = '6px 12px';
    topConfirmButton.style.fontSize = '13px';
    const headerActions = doc.createElement('div');
    headerActions.style.cssText = `
      display: flex;
      align-items: flex-start;
      justify-content: flex-end;
      gap: 8px;
      flex-wrap: wrap;
      margin-left: auto;
    `;

    createStageStatus = doc.createElement('span');
    createStageStatus.id = 'personal-ai-jira-import-create-stage-status';
    createStageStatus.setAttribute('role', 'status');
    createStageStatus.setAttribute('aria-live', 'polite');
    createStageStatus.style.cssText = `
      max-width: 250px;
      font-size: 11px;
      line-height: 1.35;
      text-align: right;
    `;

    const disableAfterImportLabel = doc.createElement('label');
    disableAfterImportLabel.style.cssText = 'display: inline-flex; align-items: center; gap: 6px; max-width: 260px; font-size: 12px; line-height: 1.35; color: #44546F; cursor: pointer;';
    const disableAfterImportCheckbox = doc.createElement('input');
    disableAfterImportCheckbox.type = 'checkbox';
    disableAfterImportCheckbox.checked = true;
    disableAfterImportCheckbox.setAttribute('data-personal-ai-jira-import-disable-after-import', 'true');
    const disableAfterImportText = doc.createElement('span');
    disableAfterImportText.textContent = jiraImportText(
      'Set this rule disable after import',
      '导入后规则设为不启用状态',
    );
    disableAfterImportLabel.appendChild(disableAfterImportCheckbox);
    disableAfterImportLabel.appendChild(disableAfterImportText);

    headerActions.appendChild(createStageStatus);
    headerActions.appendChild(disableAfterImportLabel);
    headerActions.appendChild(topConfirmButton);
    header.appendChild(headerActions);
    footer.appendChild(cancelButton);
    dialog.appendChild(footer);

    const close = (result: { confirmed: boolean; selectedRuleIndex: number; allowOtherRuleTrigger: boolean; disableAfterImport: boolean }) => {
      doc.removeEventListener('keydown', onKeyDown);
      if (doc.body.contains(overlay)) {
        doc.body.removeChild(overlay);
      }
      try {
        previousActiveElement?.focus();
      } catch (error) {
        console.debug('Could not restore Jira import dialog focus:', error);
      }
      resolve(result);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close({ confirmed: false, selectedRuleIndex, allowOtherRuleTrigger: false, disableAfterImport });
        return;
      }
      trapDialogFocus(event, dialog, doc);
    };

    doc.addEventListener('keydown', onKeyDown);
    cancelButton.addEventListener('click', () => close({ confirmed: false, selectedRuleIndex, allowOtherRuleTrigger: false, disableAfterImport }));
    disableAfterImportCheckbox.addEventListener('change', () => {
      disableAfterImport = disableAfterImportCheckbox.checked;
      renderRuleDetails();
    });
    topConfirmButton.addEventListener('click', triggerImport);
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) {
        close({ confirmed: false, selectedRuleIndex, allowOtherRuleTrigger: false, disableAfterImport });
      }
    });

    overlay.appendChild(dialog);
    doc.body.appendChild(overlay);
    renderRuleDetails();
    (select || cancelButton).focus();
  });
}

// 处理文件导入
function handleFileImport(file: File, projectContext: JiraAutomationProjectContext, doc: Document): void {
  clearJiraAutomationImportTransientMessages(doc);

  if (!isJiraAutomationImportFileSizeAllowed(file.size)) {
    showErrorMessage(jiraImportText(
      `Import failed: JSON file must be ${JIRA_AUTOMATION_IMPORT_MAX_FILE_BYTES / 1024 / 1024}MB or smaller`,
      `导入失败：JSON 文件必须小于等于 ${JIRA_AUTOMATION_IMPORT_MAX_FILE_BYTES / 1024 / 1024}MB`,
    ), { doc });
    return;
  }

  const clearPreflightReceipt = showImportPreflightReceipt(doc, file, projectContext);
  const reader = new FileReader();
  
  reader.onload = async (e) => {
    let clearPendingCreateReceipt: (() => void) | null = null;
    try {
      const content = e.target?.result as string;
      const exportedData = parseJiraAutomationExport(JSON.parse(content));
      const { existingRuleNames, nameCheck } = await getExistingAutomationRuleNameCheck(projectContext.projectId);
      clearPreflightReceipt();
      const previewResult = await showImportPreviewDialog(
        exportedData,
        file,
        projectContext,
        doc,
        existingRuleNames,
        nameCheck,
      );

      if (!previewResult.confirmed) {
        return;
      }

      const ownerId = await getCurrentOwnerId();
      const ruleToImport = exportedData.rules[previewResult.selectedRuleIndex];
      const importSummary = summarizeJiraAutomationImportRule(ruleToImport);
      const importSecretReentrySlots = collectJiraAutomationImportSecretReentrySlots(ruleToImport);
      const importEnablementPlan = buildJiraAutomationImportEnablementPlan(ruleToImport, exportedData.cloud);
      const convertedRule = buildJiraAutomationImportRule(ruleToImport, {
        projectId: projectContext.projectId,
        projectKey: projectContext.projectKey,
        projectTypeKey: projectContext.projectTypeKey,
        ownerId,
        allowOtherRuleTrigger: previewResult.allowOtherRuleTrigger,
        disableAfterImport: previewResult.disableAfterImport,
        existingRuleNames,
        nameCheck,
        sourceCloud: exportedData.cloud,
      });

      console.log('Importing Jira Automation rule:', {
        name: convertedRule.name,
        projectId: projectContext.projectId,
        componentCount: convertedRule.components.length,
        state: convertedRule.state,
        canOtherRuleTrigger: convertedRule.canOtherRuleTrigger,
      });
      clearPendingCreateReceipt = showInfoMessage(
        buildCreateRequestPendingReceipt(convertedRule.name, projectContext, convertedRule),
        {
          durationMs: 0,
          dataAttribute: 'data-personal-ai-jira-import-pending-receipt',
        },
      );

      // 调用API创建rule
      const result = await createAutomationRule(convertedRule, projectContext.projectId);
      console.log('Rule created successfully:', result);
      clearPendingCreateReceipt?.();
      clearPendingCreateReceipt = null;
      
      // 跳转到导入后的automation脚本页面
      if (result && result.id) {
        const ruleUrl = `${window.location.origin}/secure/AutomationProjectAdminAction!default.jspa?projectKey=${encodeURIComponent(projectContext.projectKey)}#/rule/${encodeURIComponent(String(result.id))}`;
        console.log('Navigating to rule page:', ruleUrl);
        showJiraAutomationImportSuccessReceipt(
          doc,
          buildPostImportSuccessReceipt(
            convertedRule.name,
            projectContext,
            exportedData.cloud,
            importSummary,
            importSecretReentrySlots,
            importEnablementPlan,
            nameCheck,
          ),
          { ruleUrl },
        );
      } else {
        console.warn('Rule ID not found in response, falling back to page refresh');
        showJiraAutomationImportSuccessReceipt(
          doc,
          buildPostImportSuccessReceipt(
            convertedRule.name,
            projectContext,
            exportedData.cloud,
            importSummary,
            importSecretReentrySlots,
            importEnablementPlan,
            nameCheck,
          ),
          { fallbackReload: true },
        );
      }
      
    } catch (error) {
      clearPreflightReceipt();
      clearPendingCreateReceipt?.();
      const errorMessage = redactJiraAutomationImportErrorText(
        error instanceof Error ? error.message : 'Unknown error occurred',
      );
      console.error('Error importing rule:', errorMessage);
      showErrorMessage(
        buildImportFailureReceipt(errorMessage),
        { dataAttribute: 'data-personal-ai-jira-import-error', doc },
      );
    }
  };
  
  reader.onerror = () => {
    clearPreflightReceipt();
    showErrorMessage(jiraImportText('Error reading file', '读取文件失败'), { doc });
  };
  
  reader.readAsText(file);
}

// 创建Import按钮
const importButtonObservers = new WeakSet<Document>();

function findCreateRuleButton(doc: Document): HTMLElement | null {
  const selectorMatch = doc.querySelector(
    'button[data-testid*="create"][data-testid*="rule"], button[aria-label*="Create rule"], button[title*="Create rule"]',
  );
  if (selectorMatch instanceof HTMLElement) {
    return selectorMatch;
  }

  const buttons = doc.querySelectorAll('button');
  for (const button of Array.from(buttons)) {
    const text = button.textContent?.replace(/\s+/g, ' ').trim();
    if (text && text.toLowerCase().includes('create rule')) {
      return button;
    }
  }

  return null;
}

function waitForCreateRuleButton(
  doc: Document,
  projectContext: JiraAutomationProjectContext,
  attempt = 0,
): void {
  if (importButtonObservers.has(doc) || doc.getElementById('import-rule-button') || !doc.body) {
    return;
  }

  importButtonObservers.add(doc);
  const observer = new MutationObserver(() => {
    if (doc.getElementById('import-rule-button')) {
      stopObserving();
      return;
    }

    const button = findCreateRuleButton(doc);
    if (button) {
      stopObserving();
      appendImportButtonNearElement(button, projectContext, doc);
    }
  });

  function stopObserving(): void {
    observer.disconnect();
    importButtonObservers.delete(doc);
  }

  observer.observe(doc.body, { childList: true, subtree: true });
  setTimeout(() => {
    stopObserving();

    if (doc.getElementById('import-rule-button') || !doc.body) {
      return;
    }

    const button = findCreateRuleButton(doc);
    if (button) {
      appendImportButtonNearElement(button, projectContext, doc);
      return;
    }

    if (attempt < 3) {
      waitForCreateRuleButton(doc, projectContext, attempt + 1);
    }
  }, 15000);
}

function createImportButton(iframeDoc: Document, projectContext: JiraAutomationProjectContext): void {
  if (iframeDoc.getElementById('import-rule-button')) {
    console.log('Import rule button already exists');
    return;
  }

  console.log('Looking for Create rule button...');
  const foundButton = findCreateRuleButton(iframeDoc);

  if (!foundButton) {
    console.warn('Create rule button not found yet; waiting for Jira Automation toolbar to render');
    waitForCreateRuleButton(iframeDoc, projectContext);
    return;
  }
  
  appendImportButtonNearElement(foundButton, projectContext, iframeDoc);
}

function appendImportButtonNearElement(referenceElement: HTMLElement, projectContext: JiraAutomationProjectContext, iframeDoc: Document): void {
  const importButton = createImportButtonElement(projectContext, iframeDoc);
  
  // 尝试在Create button旁边插入
  if (referenceElement.parentNode) {
    referenceElement.parentNode.insertBefore(importButton, referenceElement.nextSibling);
  }
}

function _appendImportButton(container: HTMLElement, projectContext: JiraAutomationProjectContext, iframeDoc: Document): void {
  const importButton = createImportButtonElement(projectContext, iframeDoc);
  container.appendChild(importButton);
}

function createImportButtonElement(projectContext: JiraAutomationProjectContext, iframeDoc: Document): HTMLElement {
  // 创建隐藏的文件输入元素
  const fileInput = iframeDoc.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'application/json,.json';
  fileInput.style.display = 'none';
  
  // 创建Import按钮
  const importButton = iframeDoc.createElement('button');
  importButton.textContent = jiraImportText('Import rule', '导入规则');
  importButton.id = 'import-rule-button';
  importButton.setAttribute('data-project-key', projectContext.projectKey);
  const entryBoundary = buildJiraImportEntryButtonBoundary(projectContext.projectKey);
  importButton.title = entryBoundary;
  importButton.setAttribute('aria-label', entryBoundary);
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
      handleFileImport(file, projectContext, iframeDoc);
    }
    fileInput.value = '';
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
      
      const projectContext = await resolveCurrentProjectContext();
      if (!projectContext) {
        console.warn('Project context not found');
        return;
      }
      
      console.log('Project context:', projectContext);
      
      // 等待页面内容加载
      setTimeout(async () => {
        createImportButton(document, projectContext);
        console.log('Import button created in iframe');
        
        // 同时初始化 Schedule 按钮（异步）
        await initScheduleButtons(document, projectContext.projectId);
        console.log('Schedule buttons initialization completed in iframe');
      }, 2000);
      
    } else {
      // 如果在主页面，等待iframe加载
      console.log('Running in main page, waiting for iframe...');

      const ownerId = await getCurrentOwnerId();
      console.log('OwnerId:', ownerId);
      
      const projectContext = await resolveCurrentProjectContext();
      if (!projectContext) {
        console.warn('Project context not found');
        return;
      }
      console.log('Project context:', projectContext);
      
      // 等待iframe加载完成
      const iframeDoc = await waitForIframe();
      console.log('Iframe loaded successfully');
      
      // 等待页面内容加载
      setTimeout(async () => {
        createImportButton(iframeDoc, projectContext);
        console.log('Import button created in main page');
        
        // 同时初始化 Schedule 按钮（异步）
        await initScheduleButtons(iframeDoc, projectContext.projectId);
        console.log('Schedule buttons initialization completed in main page');
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

// =====================================================
// Add to Scheduled Messages 功能
// =====================================================

// 存储已添加按钮的规则 ID，避免重复添加
const addedScheduleButtons = new Set<string>();

// 存储已被 Personal AI 管理的规则 ID（预加载）
const managedRuleIds = new Set<string>();

// 规则信息缓存
interface RuleInfo {
  id: string;
  name: string;
  trigger: any;
  state: string;
}

/**
 * 获取项目的所有规则（直接调用 Jira API）
 */
async function getAllProjectRules(projectId: string): Promise<any[]> {
  try {
    // 使用统一的认证方法
    const response = await jiraFetch(`/rest/cb-automation/latest/project/${projectId}/rule`, {
      authMode: 'cookie-when-safe',
      requestLabel: 'fetch Jira automation rules',
    });
    
    if (!response.ok) {
      console.error('获取规则列表失败:', response.status);
      return [];
    }
    
    return await response.json();
  } catch (error) {
    console.error('获取规则列表失败:', error);
    return [];
  }
}

/**
 * 预加载已被 Personal AI 管理的规则 ID
 * 通过 Jira API 获取所有规则，然后批量检查哪些已在 Scheduled Messages 中
 */
async function preloadManagedRules(projectId: string, projectKey: string): Promise<void> {
  console.log('[Personal AI] 预加载已被管理的规则...');
  
  // 1. 获取项目的所有规则
  const rules = await getAllProjectRules(projectId);
  console.log(`[Personal AI] 获取到 ${rules.length} 个规则`);
  
  if (rules.length === 0) {
    return;
  }
  
  // 2. 为每个规则构建 Automation_Link URL
  const automationLinks = rules.map(rule => {
    const ruleId = String(rule.id);
    return `${window.location.origin}/secure/AutomationProjectAdminAction!default.jspa?projectKey=${projectKey}#/rule/${ruleId}`;
  });
  
  // 3. 批量检查哪些规则已被管理
  const existsMap = await batchCheckAutomationLinksExist(automationLinks);
  
  // 4. 存储已被管理的规则 ID
  managedRuleIds.clear();
  rules.forEach((rule, index) => {
    const ruleUrl = automationLinks[index];
    if (existsMap.get(ruleUrl)) {
      managedRuleIds.add(String(rule.id));
    }
  });
  
  console.log(`[Personal AI] 已被管理的规则 ID: [${Array.from(managedRuleIds).join(', ')}]`);
}

/**
 * 获取规则详情（通过 background script）
 */
async function getRuleDetails(ruleId: string, projectId: string): Promise<RuleInfo | null> {
  try {
    const rules = await getAllProjectRules(projectId);
    const rule = rules.find((r: any) => String(r.id) === String(ruleId));
    
    if (rule) {
      return {
        id: String(rule.id),
        name: rule.name,
        trigger: rule.trigger,
        state: rule.state
      };
    }
    
    return null;
  } catch (error) {
    console.error('获取规则详情失败:', error);
    return null;
  }
}

/**
 * 获取规则的 Audit Log
 */
async function getRuleAuditLog(ruleId: string, projectId: string): Promise<any[]> {
  try {
    // 使用正确的 API 路径：/rest/cb-automation/latest/audit/{projectId}?limit=50&ruleId={ruleId}&offset=0
    // 使用统一的认证方法
    const response = await jiraFetch(`/rest/cb-automation/latest/audit/${projectId}?limit=50&ruleId=${ruleId}&offset=0`, {
      authMode: 'cookie-when-safe',
      requestLabel: `fetch Jira automation audit log for rule ${ruleId}`,
    });
    
    if (!response.ok) {
      console.warn('获取 Audit Log 失败:', response.status, response.statusText);
      return [];
    }
    
    const data = await response.json();
    return data.items || data || [];
  } catch (error) {
    console.error('获取 Audit Log 失败:', error);
    return [];
  }
}

// 以下函数已移至 scheduleUtils.ts：
// - parseCronExpression
// - parseDaysOfWeek
// - getNextScheduleDate

/**
 * 创建 "Add to Scheduled Messages" 按钮
 * @param isManaged - 是否已被 Personal AI 管理（true = 红色常亮，false = 灰色悬停显示）
 */
function createScheduleButton(ruleId: string, projectId: string, doc: Document, isManaged = false): HTMLElement {
  const button = doc.createElement('button');
  button.className = 'personal-ai-schedule-btn';
  button.setAttribute('data-rule-id', ruleId);
  
  // 使用同一个 icon，通过 CSS filter 实现灰色效果
  const iconUrl = chrome.runtime.getURL('icons/icon32.png');
  
  // 根据管理状态设置不同的样式和提示
  if (isManaged) {
    // 已管理：红色常亮
    button.title = 'Already managed by Personal AI';
    button.style.cssText = `
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
      margin-left: 8px;
      border: none;
      border-radius: 4px;
      background-color: transparent;
      background-image: url('${iconUrl}');
      background-size: 16px 16px;
      background-position: center;
      background-repeat: no-repeat;
      cursor: pointer;
      opacity: 1;
      filter: none;
      transition: opacity 0.2s ease, transform 0.2s ease;
      vertical-align: middle;
    `;
    
    // 红色常亮 icon 悬停时放大
    button.addEventListener('mouseenter', () => {
      button.style.transform = 'scale(1.2)';
    });
    
    button.addEventListener('mouseleave', () => {
      button.style.transform = 'scale(1)';
    });
    
    // 点击红色常亮 icon 时提示已存在
    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      showErrorMessage('此规则已在 Scheduled Messages 中管理');
    });
  } else {
    // 未管理：灰色悬停显示
    button.title = 'Add to Scheduled Messages';
    button.style.cssText = `
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
      margin-left: 8px;
      border: none;
      border-radius: 4px;
      background-color: transparent;
      background-image: url('${iconUrl}');
      background-size: 16px 16px;
      background-position: center;
      background-repeat: no-repeat;
      cursor: pointer;
      opacity: 0;
      filter: grayscale(100%) brightness(1.2);
      transition: opacity 0.2s ease, filter 0.2s ease, transform 0.2s ease;
      vertical-align: middle;
    `;
    
    // 灰色 icon 悬停时显示并变为红色+放大
    button.addEventListener('mouseenter', () => {
      button.style.opacity = '1';
      button.style.filter = 'none';
      button.style.transform = 'scale(1.2)';
    });
    
    button.addEventListener('mouseleave', () => {
      button.style.opacity = '0';
      button.style.filter = 'grayscale(100%) brightness(1.2)';
      button.style.transform = 'scale(1)';
    });
    
    // 点击灰色 icon 时执行添加操作
    button.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      await handleAddToScheduledMessages(ruleId, projectId, doc);
    });
  }
  
  return button;
}

/**
 * 更新按钮状态为已管理状态（红色常亮）
 */
function updateButtonToManagedState(button: HTMLElement, _doc: Document): void {
  button.title = 'Already managed by Personal AI';
  button.style.opacity = '1';
  button.style.transform = 'scale(1)';
  button.style.filter = 'none';
  button.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
  
  // 移除所有旧的事件监听器（通过克隆节点）
  const newButton = button.cloneNode(true) as HTMLElement;
  button.parentNode?.replaceChild(newButton, button);
  
  // 添加新的事件监听器
  newButton.addEventListener('mouseenter', () => {
    newButton.style.transform = 'scale(1.2)';
  });
  
  newButton.addEventListener('mouseleave', () => {
    newButton.style.transform = 'scale(1)';
  });
  
  newButton.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    showErrorMessage('此规则已在 Scheduled Messages 中管理');
  });
}

/**
 * 格式化星期显示（用于弹窗展示）
 * @param daysOfWeek Jira格式的星期数组 (1=周日, 2=周一...7=周六)
 */
// formatDaysOfWeekDisplay 已移至 scheduleUtils.ts

/**
 * 显示导入对话框（带 AI 总结）
 */
function showImportDialog(
  ruleInfo: RuleInfo,
  scheduleConfig: any,
  projectId: string,
  doc: Document
): Promise<{ confirmed: boolean; scheduleDate?: string; ruleSummary: string }> {
  return new Promise((resolve) => {
    // 创建遮罩
    const overlay = doc.createElement('div');
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
    const dialog = doc.createElement('div');
    dialog.style.cssText = `
      background: white;
      border-radius: 8px;
      padding: 24px;
      max-width: 600px;
      width: 90%;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    
    const projectKey = getProjectKey();
    // ruleUrl 用于可能的未来功能扩展
    const _ruleUrl = `${window.location.origin}/jira/software/c/projects/${projectKey}/automation#/rule/${ruleInfo.id}`;
    
    // 根据配置显示不同内容
    let scheduleInfo = '';
    const showDateInput = false;
    let warningMessage = '';
    
    if (scheduleConfig) {
      // 格式化重复周期显示
      const formatRepeatCycle = () => {
        const daysDisplay = formatDaysOfWeekDisplay(scheduleConfig.daysOfWeek);
        if (daysDisplay) {
          return `${daysDisplay} ${scheduleConfig.scheduleTime || ''}`;
        }
        const unitText = scheduleConfig.repeatUnit === 'Day' ? '天' : scheduleConfig.repeatUnit === 'Week' ? '周' : '月';
        return `每 ${scheduleConfig.repeatEvery} ${unitText} ${scheduleConfig.scheduleTime || ''}`;
      };
      
      // 情况一: scheduled + nosearch - 完整导入，需要转换为 webhook
      if (scheduleConfig.needsWebhookConversion && scheduleConfig.scheduleDate) {
        // FIXED 模式没有 scheduleTime，显示开始日期
        const hasScheduleTime = !!scheduleConfig.scheduleTime;
        scheduleInfo = hasScheduleTime ? `
          <p><strong>执行时间:</strong> ${scheduleConfig.scheduleTime}</p>
          <p><strong>重复周期:</strong> ${formatRepeatCycle()}</p>
        ` : `
          <p><strong>开始日期:</strong> ${scheduleConfig.scheduleDate}</p>
          <p><strong>重复周期:</strong> ${formatRepeatCycle()}</p>
        `;
        warningMessage = '✅ 此规则可以在[定时消息管理]中管理 schedule';
      }
      // 情况三: scheduled + jql - 仅展示，不可编辑
      else if (scheduleConfig.executionMode === 'jql' && scheduleConfig.scheduleDate) {
        scheduleInfo = `
          <p><strong>执行时间:</strong> ${scheduleConfig.scheduleTime || '未指定'}</p>
          <p><strong>重复周期:</strong> ${formatRepeatCycle()}</p>
          <p><strong>执行模式:</strong> JQL 查询模式（仅作为引用记录）</p>
        `;
        warningMessage = 'ℹ️ 该规则将以 JQL 模式执行，添加到 Scheduled Messages 后仅可查看和跳转';
      }
      // 其他情况: 仅添加引用
      else {
        scheduleInfo = `
          <p><strong>规则类型:</strong> ${scheduleConfig.executionMode || '其他'} 模式</p>
          <p>此规则将仅作为引用添加，不会导入调度配置</p>
        `;
        warningMessage = 'ℹ️ 仅添加规则链接作为引用，不会修改原规则';
      }
    }
    
    dialog.innerHTML = `
      <h3 style="margin: 0 0 16px; font-size: 18px; color: #172B4D;">Add to Scheduled Messages</h3>
      <div style="margin-bottom: 16px; padding: 12px; background: #F4F5F7; border-radius: 4px;">
        <p style="margin: 0 0 8px;"><strong>规则名称:</strong> ${ruleInfo.name}</p>
        ${scheduleInfo}
      </div>
      <div id="ai-summary-container" style="margin-bottom: 16px; padding: 12px; background: #E3F2FD; border-radius: 4px; border-left: 3px solid #2196F3;">
        <p style="margin: 0 0 4px; font-weight: 500; color: #1976D2;">🤖 AI 规则总结:</p>
        <p id="ai-summary-text" style="margin: 0; font-size: 13px; color: #424242; font-style: italic;">
          正在分析规则内容...
        </p>
      </div>
      ${showDateInput ? `
        <div style="margin-bottom: 16px;">
          <label style="display: block; margin-bottom: 4px; font-weight: 500;">开始日期:</label>
          <input type="date" id="schedule-date-input" 
            value="${scheduleConfig.scheduleDate || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]}"
            style="width: 100%; padding: 8px; border: 1px solid #DFE1E6; border-radius: 4px; box-sizing: border-box;">
        </div>
      ` : ''}
      <div style="margin-bottom: 16px; padding: 12px; background: #FFFAE6; border-radius: 4px; border-left: 3px solid #FFAB00;">
        <p style="margin: 0; font-size: 13px; color: #172B4D;">
          ${warningMessage}
        </p>
      </div>
      <div style="display: flex; gap: 8px; justify-content: flex-end;">
        <button id="cancel-btn" style="padding: 8px 16px; border: 1px solid #DFE1E6; border-radius: 4px; background: white; cursor: pointer;">取消</button>
        <button id="confirm-btn" style="padding: 8px 16px; border: none; border-radius: 4px; background: #0052cc; color: white; cursor: pointer;">确认添加</button>
      </div>
    `;
    
    overlay.appendChild(dialog);
    doc.body.appendChild(overlay);
    
    // 异步获取 AI 总结
    let ruleSummary = `关联的 Jira Automation 规则: ${ruleInfo.name}`;
    const summaryElement = dialog.querySelector('#ai-summary-text') as HTMLParagraphElement;
    
    (async () => {
      try {
        ruleSummary = await summarizeRuleWithLLM(ruleInfo);
        if (summaryElement) {
          summaryElement.textContent = ruleSummary;
          summaryElement.style.fontStyle = 'normal';
        }
      } catch (error) {
        console.error('AI 总结失败:', error);
        if (summaryElement) {
          summaryElement.textContent = `关联的 Jira Automation 规则: ${ruleInfo.name}`;
          summaryElement.style.fontStyle = 'normal';
        }
      }
    })();
    
    // 事件处理
    const cancelBtn = dialog.querySelector('#cancel-btn') as HTMLButtonElement;
    const confirmBtn = dialog.querySelector('#confirm-btn') as HTMLButtonElement;
    const dateInput = dialog.querySelector('#schedule-date-input') as HTMLInputElement;
    
    cancelBtn.addEventListener('click', () => {
      doc.body.removeChild(overlay);
      resolve({ confirmed: false, scheduleDate: undefined, ruleSummary });
    });
    
    confirmBtn.addEventListener('click', () => {
      const scheduleDate = dateInput ? dateInput.value : scheduleConfig?.scheduleDate;
      doc.body.removeChild(overlay);
      resolve({ confirmed: true, scheduleDate, ruleSummary });
    });
    
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        doc.body.removeChild(overlay);
        resolve({ confirmed: false, scheduleDate: undefined, ruleSummary });
      }
    });
  });
}

/**
 * 检查 Automation_Link 是否已存在于 Scheduled Messages 中
 */
async function checkAutomationLinkExists(automationLink: string): Promise<boolean> {
  try {
    const result = await chrome.runtime.sendMessage({
      type: 'CHECK_AUTOMATION_LINK_EXISTS',
      data: { automationLink }
    });
    return result?.exists || false;
  } catch (error) {
    console.error('检查 Automation_Link 是否存在失败:', error);
    return false;
  }
}

/**
 * 批量检查多个 Automation_Link 是否已存在于 Scheduled Messages 中
 */
async function batchCheckAutomationLinksExist(automationLinks: string[]): Promise<Map<string, boolean>> {
  try {
    const result = await chrome.runtime.sendMessage({
      type: 'BATCH_CHECK_AUTOMATION_LINKS_EXIST',
      data: { automationLinks }
    });
    
    // 将结果转换为 Map
    const resultMap = new Map<string, boolean>();
    if (result?.results) {
      Object.entries(result.results).forEach(([link, exists]) => {
        resultMap.set(link, exists as boolean);
      });
    }
    return resultMap;
  } catch (error) {
    console.error('批量检查 Automation_Link 失败:', error);
    return new Map();
  }
}

/**
 * 使用 LLM 总结 Jira Rule 的功能
 * 通过 background script 调用 LLM（content script 无法直接导入模块）
 */
async function summarizeRuleWithLLM(ruleInfo: RuleInfo): Promise<string> {
  try {
    // 构建规则描述
    const triggerType = ruleInfo.trigger?.type || '未知';
    const triggerValue = JSON.stringify(ruleInfo.trigger?.value || {}, null, 2);
    
    const prompt = `请用一句简洁的中文描述以下 Jira Automation 规则的功能：

规则名称：${ruleInfo.name}
触发器类型：${triggerType}
触发器配置：${triggerValue}

要求：用 20-50 字描述这个规则的主要功能，不要包含技术细节。`;
    
    // 通过 background script 调用 LLM
    const result = await chrome.runtime.sendMessage({
      type: 'CALL_LLM_SUMMARIZE',
      data: { prompt }
    });
    
    if (result?.success && result.summary) {
      return result.summary.trim();
    }
    
    // 如果 LLM 调用失败，返回默认描述
    return `关联的 Jira Automation 规则: ${ruleInfo.name}`;
  } catch (error) {
    console.error('LLM 总结规则失败:', error);
    return `关联的 Jira Automation 规则: ${ruleInfo.name}`;
  }
}

/**
 * 处理添加到 Scheduled Messages
 */
async function handleAddToScheduledMessages(ruleId: string, projectId: string, doc: Document): Promise<void> {
  try {
    showLoadingMessage('正在读取规则信息...', doc);
    
    // 获取规则详情
    const ruleInfo = await getRuleDetails(ruleId, projectId);
    if (!ruleInfo) {
      showErrorMessage('无法获取规则信息');
      return;
    }
    
    // 构建 Automation_Link
    const projectKey = getProjectKey();
    const ruleUrl = `${window.location.origin}/secure/AutomationProjectAdminAction!default.jspa?projectKey=${projectKey}#/rule/${ruleId}`;
    
    // 检查是否已存在
    showLoadingMessage('正在检查是否已添加...', doc);
    const alreadyExists = await checkAutomationLinkExists(ruleUrl);
    if (alreadyExists) {
      hideLoadingMessage(doc);
      showErrorMessage('已经添加过了，你可以在定时消息管理界面查看！');
      return;
    }
    
    hideLoadingMessage(doc);
    
    // 分析 trigger 类型
    const trigger = ruleInfo.trigger;
    const isScheduledTrigger = trigger?.type === 'jira.jql.scheduled';
    const executionMode = trigger?.value?.executionMode;
    const schedule = trigger?.value?.schedule;
    
    let scheduleConfig: any = null;
    
    if (isScheduledTrigger && executionMode === 'nosearch') {
      // 情况一：scheduled + nosearch - 完整导入，需要转换为 webhook
      if (schedule?.method === 'CRON') {
        // Cron 模式 - 可以完整解析
        const cronConfig = parseCronExpression(schedule.cronExpression);
        if (cronConfig) {
          const [hours, minutes] = cronConfig.time.split(':').map(Number);
          scheduleConfig = {
            scheduleDate: getNextScheduleDate(hours, minutes, cronConfig.repeatUnit, cronConfig.daysOfWeek),
            scheduleTime: cronConfig.time,
            repeatEvery: cronConfig.repeatEvery,
            repeatUnit: cronConfig.repeatUnit,
            daysOfWeek: cronConfig.daysOfWeek, // 传递解析的星期配置
            executionMode: 'nosearch',
            needsWebhookConversion: true
          };
        }
      } else if (schedule?.method === 'FIXED') {
        // FIXED 模式 - 需要从 audit log 获取日期或让用户输入
        showLoadingMessage('正在获取执行历史...', doc);
        const auditLogs = await getRuleAuditLog(ruleId, projectId);
        hideLoadingMessage(doc);
        
        const successLog = auditLogs.find((log: any) => log.category === 'SUCCESS');
        let scheduleDate: string | undefined;
        
        if (successLog && successLog.created) {
          const date = new Date(successLog.created);
          scheduleDate = date.toISOString().split('T')[0];
        }
        
        // 使用共享的 FIXED 配置解析函数
        const fixedConfig = parseFixedRateConfig(schedule);
        
        // 如果 audit log 没有日期，使用今天作为默认值
        const defaultScheduleDate = scheduleDate || new Date().toISOString().split('T')[0];
        
        scheduleConfig = {
          scheduleDate: defaultScheduleDate,
          repeatEvery: fixedConfig.repeatEvery,
          repeatUnit: fixedConfig.repeatUnit,
          executionMode: 'nosearch',
          needsWebhookConversion: true
        };
      }
    } else if (isScheduledTrigger && executionMode === 'jql') {
      // 情况二：scheduled + jql - 仅展示，读取日期和周期到 sheet
      if (schedule?.method === 'CRON') {
        const cronConfig = parseCronExpression(schedule.cronExpression);
        if (cronConfig) {
          const [hours, minutes] = cronConfig.time.split(':').map(Number);
          scheduleConfig = {
            scheduleDate: getNextScheduleDate(hours, minutes, cronConfig.repeatUnit, cronConfig.daysOfWeek),
            scheduleTime: cronConfig.time,
            repeatEvery: cronConfig.repeatEvery,
            repeatUnit: cronConfig.repeatUnit,
            daysOfWeek: cronConfig.daysOfWeek, // 传递解析的星期配置
            executionMode: 'jql',
            needsWebhookConversion: false
          };
        }
      } else if (schedule?.method === 'FIXED') {
        // FIXED 模式
        showLoadingMessage('正在获取执行历史...', doc);
        const auditLogs = await getRuleAuditLog(ruleId, projectId);
        hideLoadingMessage(doc);
        
        const successLog = auditLogs.find((log: any) => log.state === 'COMPLETED' || log.state === 'SUCCESS');
        let scheduleDate: string | undefined;
        
        if (successLog && successLog.created) {
          const date = new Date(successLog.created);
          scheduleDate = date.toISOString().split('T')[0];
        }
        
        // 使用共享的 FIXED 配置解析函数
        const fixedConfig = parseFixedRateConfig(schedule);
        
        // 如果 audit log 没有日期，使用今天作为默认值
        const defaultScheduleDate = scheduleDate || new Date().toISOString().split('T')[0];
        
        scheduleConfig = {
          scheduleDate: defaultScheduleDate,
          repeatEvery: fixedConfig.repeatEvery,
          repeatUnit: fixedConfig.repeatUnit,
          executionMode: 'jql',
          needsWebhookConversion: false
        };
      }
    } else {
      // 情况三：其他类型 - 仅添加引用
      scheduleConfig = {
        executionMode: executionMode || 'other',
        needsWebhookConversion: false
      };
    }
    
    // 显示确认对话框（已包含 AI 总结）
    const dialogResult = await showImportDialog(ruleInfo, scheduleConfig, projectId, doc);
    
    if (!dialogResult.confirmed) {
      return;
    }
    
    // 使用弹窗中已生成的 AI 总结
    const ruleSummary = dialogResult.ruleSummary;
    
    showLoadingMessage('正在添加到 Scheduled Messages...', doc);
    
    // 准备消息数据 - 注意 ruleUrl 已在前面定义
    const messageData: any = {
      Topic: `${ruleInfo.name}`,
      Content: ruleSummary,
      Push_Method: 'JiraAutomation',
      Target_Type: 'api',
      // 根据 Jira Rule 的状态设置 Status：ENABLED -> Active, DISABLED -> Paused
      Status: ruleInfo.state === 'ENABLED' ? 'Active' : 'Paused',
      Automation_Link: ruleUrl,
      // 添加 Category，使用项目 key
      Category: projectKey
    };
    scheduleConfig.scheduleDate = dialogResult.scheduleDate || scheduleConfig.scheduleDate;
    
    if (scheduleConfig?.needsWebhookConversion && scheduleConfig.scheduleDate) {
      // 情况一：scheduled + nosearch - 完整导入调度信息，但不立即转换为 webhook
      // webhook 转换延迟到用户在 ScheduledMessagesManager 中确认托管时再执行
      messageData.Schedule_Date = scheduleConfig.scheduleDate;
      messageData.Schedule_Time = scheduleConfig.scheduleTime;
      messageData.Repeat_Every = scheduleConfig.repeatEvery;
      messageData.Repeat_Unit = scheduleConfig.repeatUnit;
      // 如果有多星期配置，转换 Jira 格式 (1-7) 到 JS 格式 (0-6) 并保存
      if (scheduleConfig.daysOfWeek && scheduleConfig.daysOfWeek.length > 0) {
        const jsDays = jiraDaysToJsDays(scheduleConfig.daysOfWeek);
        messageData.Repeat_Days = jsDays.join(',');
        console.log('[Personal AI] 保存多星期配置:', { jiraDays: scheduleConfig.daysOfWeek, jsDays, Repeat_Days: messageData.Repeat_Days });
      }
      // 不设置 AI_Endpoint，留待用户在管理界面确认后再转换
      // 用户可以在 ScheduledMessagesManager 中点击编辑按钮来激活 Personal AI 托管
    } else if (scheduleConfig?.executionMode === 'jql') {
      // 情况二：scheduled + jql - 读取日期和周期到 sheet，作为展示使用
      messageData.Schedule_Date = scheduleConfig.scheduleDate;
      messageData.Schedule_Time = scheduleConfig.scheduleTime;
      messageData.Repeat_Every = scheduleConfig.repeatEvery;
      messageData.Repeat_Unit = scheduleConfig.repeatUnit;
      // 如果有多星期配置，转换并保存
      if (scheduleConfig.daysOfWeek && scheduleConfig.daysOfWeek.length > 0) {
        const jsDays = jiraDaysToJsDays(scheduleConfig.daysOfWeek);
        messageData.Repeat_Days = jsDays.join(',');
      }
      // 不设置 AI_Endpoint，表示仅作为引用
      messageData.Content = `Linked to Jira Automation Rule (JQL Mode, View Only): ${ruleInfo.name}`;
    }
    // 情况三：其他类型 - 仅添加引用，不设置调度信息
    
    // 发送到 background script 添加消息
    console.log('[Personal AI] 发送 ADD_SCHEDULED_MESSAGE 消息:', messageData);
    
    let result: any;
    try {
      result = await chrome.runtime.sendMessage({
        type: 'ADD_SCHEDULED_MESSAGE',
        data: messageData
      });
      console.log('[Personal AI] ADD_SCHEDULED_MESSAGE 响应:', result);
    } catch (sendError) {
      console.error('[Personal AI] 发送消息失败:', sendError);
      hideLoadingMessage(doc);
      showErrorMessage(`发送消息失败: ${sendError instanceof Error ? sendError.message : '未知错误'}`);
      return;
    }
    
    hideLoadingMessage(doc);
    
    if (result && result.success) {
      showSuccessMessage(`已添加到 Scheduled Messages: ${ruleInfo.name}`);
      
      // 将规则 ID 加入已管理列表
      managedRuleIds.add(ruleId);
      console.log(`[Personal AI] 规则 ${ruleId} 已加入 managedRuleIds`);
      
      // 立即更新当前按钮为已管理状态（红色常亮）
      const currentButton = doc.querySelector(`.personal-ai-schedule-btn[data-rule-id="${ruleId}"]`) as HTMLElement;
      if (currentButton) {
        console.log('[Personal AI] 更新按钮为已管理状态（红色常亮）');
        updateButtonToManagedState(currentButton, doc);
      }
    } else {
      const errorMsg = result?.error || (result === undefined ? '未收到响应（可能 background script 未正确处理）' : '未知错误');
      console.error('[Personal AI] 添加失败:', errorMsg, result);
      showErrorMessage(`添加失败: ${errorMsg}`);
    }
    
  } catch (error) {
    hideLoadingMessage(doc);
    console.error('添加到 Scheduled Messages 失败:', error);
    showErrorMessage(`添加失败: ${error instanceof Error ? error.message : '未知错误'}`);
  }
}

/**
 * 显示加载消息
 */
function showLoadingMessage(message: string, doc: Document): void {
  hideLoadingMessage(doc);
  
  const loadingDiv = doc.createElement('div');
  loadingDiv.id = 'personal-ai-loading';
  loadingDiv.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background-color: #0052cc;
    color: white;
    padding: 12px 16px;
    border-radius: 4px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    z-index: 10001;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    display: flex;
    align-items: center;
    gap: 8px;
  `;
  loadingDiv.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 16 16" style="animation: spin 1s linear infinite;">
      <circle cx="8" cy="8" r="6" fill="none" stroke="white" stroke-width="2" stroke-dasharray="32" stroke-dashoffset="8"/>
    </svg>
    <span>${message}</span>
  `;
  
  // 添加旋转动画
  const style = doc.createElement('style');
  style.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
  doc.head.appendChild(style);
  
  doc.body.appendChild(loadingDiv);
}

/**
 * 隐藏加载消息
 */
function hideLoadingMessage(doc: Document): void {
  const loadingDiv = doc.getElementById('personal-ai-loading');
  if (loadingDiv) {
    loadingDiv.remove();
  }
}

/**
 * 为规则列表添加悬停按钮
 * 
 * DOM 结构参考:
 * <tr class="css-1wodie7">
 *   <td class="css-1edgzzu">
 *     <div>
 *       <div draggable="true">
 *         <div class="sc-hzNEM cMGECf">
 *           <div class="sc-LKuAh dxEdMv">...</div>
 *           <span role="presentation">
 *             <span style="display: inline-flex; ...">
 *               <a href="...#/rule/1685">[Esone] AI notify...</a>
 *               <span style="margin-left: 5px;"></span>  <!-- 插入点 -->
 *             </span>
 *           </span>
 *         </div>
 *       </div>
 *     </div>
 *   </td>
 *   ...
 * </tr>
 */
function addScheduleButtonsToRules(doc: Document, projectId: string): void {
  // 查找所有规则链接
  const allLinks = doc.querySelectorAll('a[href*="#/rule/"]');
  
  allLinks.forEach((link) => {
    const href = link.getAttribute('href');
    const match = href?.match(/#\/rule\/(\d+)/);
    
    if (!match) return;
    
    const ruleId = match[1];
    
    // 检查该链接是否已经有按钮了（通过查找父元素中是否已有按钮）
    const linkParent = link.parentElement;
    if (linkParent) {
      const existingButton = linkParent.querySelector('.personal-ai-schedule-btn') as HTMLElement;
      if (existingButton) {
        // 检查按钮的 data-rule-id 是否与当前链接的规则 ID 匹配
        // 如果不匹配，说明 Jira SPA 翻页时复用了 DOM 元素，需要移除旧按钮重新创建
        const buttonRuleId = existingButton.getAttribute('data-rule-id');
        if (buttonRuleId === ruleId) {
          // ID 匹配，保持现有按钮
          return;
        } else {
          // ID 不匹配，移除旧按钮（包括其容器 div）
          const buttonContainer = existingButton.parentElement;
          if (buttonContainer && buttonContainer.style.display === 'inline-block') {
            buttonContainer.remove();
          } else {
            existingButton.remove();
          }
        }
      }
    }
    
    // 找到规则行 <tr>
    const ruleRow = link.closest('tr');
    if (!ruleRow) {
      return;
    }
    
    // 根据预加载的 managedRuleIds 判断是否已被管理
    const isManaged = managedRuleIds.has(ruleId);
    
    // 创建按钮（根据管理状态决定样式）
    const button = createScheduleButton(ruleId, projectId, doc, isManaged);
    
    // 在链接后面的 span 中插入按钮
    if (linkParent) {
      const spacerSpan = linkParent.querySelector('span[style*="margin-left"]');
      if (spacerSpan) {
        spacerSpan.appendChild(button);
      } else {
        link.insertAdjacentElement('afterend', button);
      }
    }
    
    // 添加悬停效果 - 监听整个表格行（仅对灰色未管理按钮）
    if (!isManaged) {
      ruleRow.addEventListener('mouseenter', () => {
        if (button.style.opacity === '0') {
          button.style.opacity = '1';
        }
      });
      
      ruleRow.addEventListener('mouseleave', () => {
        if (button.title === 'Add to Scheduled Messages') {
          button.style.opacity = '0';
        }
      });
    }
    
    addedScheduleButtons.add(ruleId);
  });
}

/**
 * 检查是否已初始化 Scheduled Messages 配置
 */
async function checkScheduledMessagesInitialized(): Promise<boolean> {
  try {
    const result = await chrome.storage.local.get(['scheduledMessagesConfig']);
    const config = result.scheduledMessagesConfig;
    
    if (config && config.sheetId) {
      console.log('[Personal AI] Scheduled Messages 已初始化，sheetId:', config.sheetId);
      return true;
    }
    
    console.log('[Personal AI] Scheduled Messages 未初始化，跳过注入添加按钮');
    return false;
  } catch (error) {
    console.error('[Personal AI] 检查 Scheduled Messages 配置失败:', error);
    return false;
  }
}

/**
 * 初始化 Schedule 按钮功能
 */
async function initScheduleButtons(doc: Document, projectId: string): Promise<void> {
  // 先检查是否已初始化 Scheduled Messages
  const isInitialized = await checkScheduledMessagesInitialized();
  if (!isInitialized) {
    console.log('[Personal AI] 跳过 Schedule 按钮注入（未初始化 Scheduled Messages）');
    return;
  }
  
  // 预加载已被管理的规则 ID（通过 Jira API 获取所有规则，批量检查）
  const projectKey = getProjectKey();
  await preloadManagedRules(projectId, projectKey);
  
  // 初始添加按钮
  addScheduleButtonsToRules(doc, projectId);
  
  // 监听 DOM 变化，为新加载的规则添加按钮
  const scheduleObserver = new MutationObserver(() => {
    addScheduleButtonsToRules(doc, projectId);
  });
  
  scheduleObserver.observe(doc.body, {
    childList: true,
    subtree: true
  });
}

// Schedule 按钮初始化已集成到 main() 函数中
// 与 Import button 共享同一个初始化时机，无需额外的独立入口
