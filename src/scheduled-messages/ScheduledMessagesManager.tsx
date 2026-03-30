/**
 * 定时消息管理主页面
 */

import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { useState, useEffect, useRef, useMemo } from 'react';
import { OneClickSetup } from './components/OneClickSetup';
import { ScheduledMessageService } from './ScheduledMessageService';
import { ScheduledMessage, SheetConfig, InitializationResult, Statistics, CreateMessageFormData, BotAutomationConfig } from './types';
import { AppScriptUpdater, APP_SCRIPT_PROJECT_HISTORY_LIMIT_ERROR } from './AppScriptUpdater';
import { SheetSchemaUpdater } from './SheetSchemaUpdater';
import { JiraRuleUpdater } from './JiraRuleUpdater';
import Select, { StylesConfig, MultiValue, SingleValue } from 'react-select';
import CreatableSelect from 'react-select/creatable';
import { jiraFetch } from '../jira';
import { getGoogleAuthToken, getGoogleAuthTokenSilently } from '../utils/googleAuth';
import {
  DEFAULT_TIMELINE_PROJECT,
  TIMELINE_PROJECT_OPTIONS,
  getTimelineProjectOption,
} from './timelineProjects';
import {
  BotConfigDialogMode,
  BotConfigValidityStatus,
  getBotDialogModeForStatus,
  getExecutorRule,
  getTimelineSyncRule,
  hasExecutorRule,
  hasTimelineSyncRule,
  normalizeSheetConfig,
  withBotAutomation,
} from './botAutomationConfig';
import {
  formatTimelineFrequencyText,
  formatTimelineNextExecutionText,
} from './timelineFormatting';
import {
  getMemoryServiceClient,
  type OutreachTemplateRuntimeStatusItem,
} from '../services/MemoryServiceClient';

// react-select 选项类型
interface SelectOption {
  value: string;
  label: string;
}

interface BotConfigWarningState {
  status: BotConfigValidityStatus;
  title: string;
  description: string;
  dialogMode: BotConfigDialogMode;
}

interface OutreachRuntimeState {
  enabled: boolean;
  ringCentralReady: boolean;
}

// react-select 自定义样式
const selectStyles: StylesConfig<SelectOption, true> = {
  control: (base, state) => ({
    ...base,
    minHeight: '38px',
    borderColor: state.isFocused ? '#007bff' : '#ddd',
    boxShadow: state.isFocused ? '0 0 0 2px rgba(0, 123, 255, 0.25)' : 'none',
    '&:hover': {
      borderColor: '#007bff',
    },
  }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isSelected ? '#007bff' : state.isFocused ? '#e7f3ff' : 'white',
    color: state.isSelected ? 'white' : '#333',
    cursor: 'pointer',
    '&:active': {
      backgroundColor: '#0056b3',
    },
  }),
  multiValue: (base) => ({
    ...base,
    backgroundColor: '#e7f3ff',
    borderRadius: '4px',
  }),
  multiValueLabel: (base) => ({
    ...base,
    color: '#007bff',
    fontWeight: 500,
  }),
  multiValueRemove: (base) => ({
    ...base,
    color: '#007bff',
    '&:hover': {
      backgroundColor: '#007bff',
      color: 'white',
    },
  }),
  placeholder: (base) => ({
    ...base,
    color: '#999',
  }),
  menu: (base) => ({
    ...base,
    zIndex: 9999,
  }),
};

// 单选样式
const singleSelectStyles: StylesConfig<SelectOption, false> = {
  control: (base, state) => ({
    ...base,
    minHeight: '38px',
    borderColor: state.isFocused ? '#007bff' : '#ddd',
    boxShadow: state.isFocused ? '0 0 0 2px rgba(0, 123, 255, 0.25)' : 'none',
    '&:hover': {
      borderColor: '#007bff',
    },
  }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isSelected ? '#007bff' : state.isFocused ? '#e7f3ff' : 'white',
    color: state.isSelected ? 'white' : '#333',
    cursor: 'pointer',
    '&:active': {
      backgroundColor: '#0056b3',
    },
  }),
  singleValue: (base) => ({
    ...base,
    color: '#333',
  }),
  placeholder: (base) => ({
    ...base,
    color: '#999',
  }),
  menu: (base) => ({
    ...base,
    zIndex: 9999,
  }),
};

/**
 * 解析 CRON 表达式中的 dayOfWeek 字段
 * 支持格式：1-5, 1,3,5, MON-FRI, MON,WED,FRI, 2,4,6
 * 返回数字数组：1=周日, 2=周一, ..., 7=周六（Jira CRON 使用 1-7）
 */
function parseCronDaysOfWeek(dayOfWeek: string): number[] {
  const dayMap: Record<string, number> = {
    'SUN': 1, 'MON': 2, 'TUE': 3, 'WED': 4, 'THU': 5, 'FRI': 6, 'SAT': 7,
    '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7
  };
  
  const result: number[] = [];
  
  // 处理范围和逗号分隔
  const segments = dayOfWeek.split(',');
  for (const segment of segments) {
    const trimmed = segment.trim().toUpperCase();
    
    // 检查是否是范围（如 1-5, MON-FRI）
    if (trimmed.includes('-')) {
      const [start, end] = trimmed.split('-');
      const startNum = dayMap[start.trim()] || parseInt(start.trim(), 10);
      const endNum = dayMap[end.trim()] || parseInt(end.trim(), 10);
      
      if (!isNaN(startNum) && !isNaN(endNum)) {
        for (let i = startNum; i <= endNum; i++) {
          if (!result.includes(i)) result.push(i);
        }
      }
    } else {
      const num = dayMap[trimmed] || parseInt(trimmed, 10);
      if (!isNaN(num) && !result.includes(num)) {
        result.push(num);
      }
    }
  }
  
  return result.sort((a, b) => a - b);
}

function isTimelineTriggeredMessage(message: ScheduledMessage): boolean {
  return Boolean(message.Timeline_Milestone && !message.Schedule_Date);
}

function requiresBotAutomation(message: ScheduledMessage): boolean {
  return message.Push_Method === 'Bot' || message.Push_Method === 'AI';
}

function isOutreachMessage(message: ScheduledMessage): boolean {
  return message.Push_Method === 'Outreach';
}

function buildOutreachSessionsUrl(templateId?: string, sessionId?: string): string {
  if (sessionId) {
    return chrome.runtime.getURL(`memory-exploring.html#/outreach/${encodeURIComponent(sessionId)}`);
  }

  const params = new URLSearchParams();
  if (templateId) params.set('templateId', templateId);
  const query = params.toString();
  return chrome.runtime.getURL(`memory-exploring.html#/outreach${query ? `?${query}` : ''}`);
}

function formatOutreachTarget(message: ScheduledMessage): string {
  if (message.Outreach_Target_Ref && message.Outreach_Target_Ref.trim()) {
    return message.Outreach_Target_Ref.trim();
  }

  if (message.Outreach_Target_Type === 'group' && message.Glip_Team_ID && message.Glip_Team_ID.trim()) {
    return message.Glip_Team_ID.trim();
  }

  if (message.Outreach_Target_Type === 'private' && message.Glip_User_Name && message.Glip_User_Name.trim()) {
    return message.Glip_User_Name.trim();
  }

  return '-';
}

function formatOutreachSummary(message: ScheduledMessage): string {
  const parts: string[] = [];

  if (message.Outreach_Sync_State && message.Outreach_Sync_State.trim()) {
    parts.push(`同步:${formatOutreachSyncState(message.Outreach_Sync_State)}`);
  }

  if (message.Outreach_Runtime_Status && message.Outreach_Runtime_Status.trim()) {
    parts.push(`会话:${formatOutreachRuntimeStatus(message.Outreach_Runtime_Status)}`);
  }

  if (message.Outreach_Last_Result && message.Outreach_Last_Result.trim()) {
    const result = message.Outreach_Last_Result.trim();
    parts.push(`结果:${result.length > 18 ? `${result.substring(0, 18)}…` : result}`);
  }

  return parts.join(' · ');
}

function normalizeOutreachTimestamp(value?: number): string | undefined {
  if (!value || !Number.isFinite(value)) return undefined;
  const ms = value > 1_000_000_000_000 ? value : value * 1000;
  return new Date(ms).toISOString();
}

function summarizeOutreachResult(item: OutreachTemplateRuntimeStatusItem): string | undefined {
  const session = item.latestSession;
  if (!session) return undefined;
  if (session.errorMessage?.trim()) return session.errorMessage.trim();
  if (session.replyClassification?.trim()) {
    return formatOutreachReplyClassification(session.replyClassification.trim());
  }
  if (session.replyRawText?.trim()) return session.replyRawText.trim();
  if (session.outcome && typeof session.outcome === 'object') {
    const summaryCandidate = (session.outcome.summary ||
      session.outcome.reason ||
      session.outcome.classification) as string | undefined;
    if (typeof summaryCandidate === 'string' && summaryCandidate.trim().length > 0) {
      return summaryCandidate.trim();
    }
  }
  return undefined;
}

function formatOutreachSyncState(value?: string): string {
  if (value === 'synced') return '已同步';
  if (value === 'sync_error') return '同步失败';
  if (value === 'paused') return '已暂停';
  if (value === 'cancelled') return '已取消';
  return value || '未知';
}

function formatOutreachRuntimeStatus(value?: string): string {
  if (value === 'pending_approval') return '待审批';
  if (value === 'scheduled') return '已排程';
  if (value === 'waiting_reply') return '等待回复';
  if (value === 'deferred') return '延期等待';
  if (value === 'resolved') return '已拿到结果';
  if (value === 'no_reply') return '无回复';
  if (value === 'escalated') return '已升级';
  if (value === 'cancelled') return '已取消';
  if (value === 'failed') return '失败';
  return value || '未知';
}

function formatOutreachReplyClassification(value?: string): string {
  if (value === 'answer') return '已答复';
  if (value === 'defer') return '稍后回复';
  if (value === 'irrelevant') return '回复不相关';
  if (value === 'decline') return '明确拒绝';
  if (value === 'unclear') return '回复不明确';
  return value || '未知';
}

async function overlayOutreachRuntimeStatus(messages: ScheduledMessage[]): Promise<ScheduledMessage[]> {
  const outreachIds = messages
    .filter((message) => isOutreachMessage(message))
    .map((message) => message.ID)
    .filter(Boolean);
  if (outreachIds.length === 0) {
    return messages;
  }

  try {
    const client = getMemoryServiceClient();
    const runtime = await client.getOutreachTemplateRuntimeStatus(outreachIds, outreachIds.length);
    const mapping = new Map<string, OutreachTemplateRuntimeStatusItem>();
    for (const item of runtime.items) {
      if (item.template?.id) {
        mapping.set(item.template.id, item);
      }
    }

    return messages.map((message) => {
      if (!isOutreachMessage(message)) {
        return message;
      }
      const runtimeItem = mapping.get(message.ID);
      if (!runtimeItem) {
        return message;
      }

      const latestSession = runtimeItem.latestSession;
      return {
        ...message,
        Outreach_Sync_State: runtimeItem.template.syncState || message.Outreach_Sync_State,
        Outreach_Runtime_Status: latestSession?.status || message.Outreach_Runtime_Status,
        Outreach_Last_Session_ID: latestSession?.id || message.Outreach_Last_Session_ID,
        Outreach_Last_Result: summarizeOutreachResult(runtimeItem) || message.Outreach_Last_Result,
        Outreach_Last_Updated:
          normalizeOutreachTimestamp(latestSession?.updatedAt || runtimeItem.template.updatedAt) ||
          message.Outreach_Last_Updated,
      };
    });
  } catch (error) {
    console.info('加载 Outreach runtime 状态失败，使用 Sheet 数据兜底:', error);
    return messages;
  }
}

function buildBotConfigWarningState(
  status: BotConfigValidityStatus,
  config?: SheetConfig | null
): BotConfigWarningState {
  switch (status) {
    case 'missing_timeline_sync_rule':
      return {
        status,
        title: 'Timeline Sync Rule 缺失',
        description: '检测到您有 Timeline Bot/AI 消息，但缺少 Timeline Sync Rule，相关消息不会触发。',
        dialogMode: 'upgrade-sync-only',
      };
    case 'missing_executor_rule':
      return {
        status,
        title: 'Bot 推送配置失效',
        description: '检测到您有待推送的 Bot/AI 消息，但执行规则已不存在，需要重新配置。',
        dialogMode: getBotDialogModeForStatus(status, config),
      };
    case 'missing_both':
      return {
        status,
        title: 'Bot 推送配置失效',
        description: '检测到您有待推送的 Bot/AI 消息，但执行规则和 Timeline Sync Rule 都缺失，需要重新配置。',
        dialogMode: getBotDialogModeForStatus(status, config),
      };
    default:
      return {
        status: 'ok',
        title: '',
        description: '',
        dialogMode: getBotDialogModeForStatus('ok', config),
      };
  }
}

const ScheduledMessagesManager: React.FC = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [needsReauth, setNeedsReauth] = useState(false);  // 🔧 新增：是否需要重新授权
  const [config, setConfig] = useState<SheetConfig | null>(null);
  const [messages, setMessages] = useState<ScheduledMessage[]>([]);
  const [statistics, setStatistics] = useState<Statistics>({
    total: 0,
    active: 0,
    paused: 0,
    completed: 0,
    done: 0,
    pendingReview: 0,
    executedToday: 0
  });
  const [service, setService] = useState<ScheduledMessageService | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showBotConfigDialog, setShowBotConfigDialog] = useState(false);
  const [botConfigDialogMode, setBotConfigDialogMode] = useState<BotConfigDialogMode>('create');
  const [botConfigured, setBotConfigured] = useState(false);
  const [timelineBotConfigured, setTimelineBotConfigured] = useState(false);
  const [showBotConfigWarning, setShowBotConfigWarning] = useState(false);
  const [botConfigWarningState, setBotConfigWarningState] = useState<BotConfigWarningState>(
    buildBotConfigWarningState('ok')
  );
  const [filterSelfOnly, setFilterSelfOnly] = useState(false);
  const [filterPendingReview, setFilterPendingReview] = useState(false);  // 仅过滤待审核推送
  const [selectedCategories, setSelectedCategories] = useState<SelectOption[]>([]);
  const [currentUsername, setCurrentUsername] = useState<string>('');
  const [hoveredMessage, setHoveredMessage] = useState<ScheduledMessage | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [isReminderMode, setIsReminderMode] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [appScriptVersion, setAppScriptVersion] = useState<string>('');
  const [editingMessage, setEditingMessage] = useState<ScheduledMessage | null>(null);
  const [outreachRuntime, setOutreachRuntime] = useState<OutreachRuntimeState>({
    enabled: false,
    ringCentralReady: false,
  });
  
  useEffect(() => {
    initializeApp();
    getCurrentUserName();
    void loadOutreachRuntime();
  }, []);
  
  // 从所有消息中提取 category 选项
  const availableCategories = useMemo(() => {
    const categorySet = new Set<string>();
    messages.forEach(msg => {
      if (msg.Category) {
        msg.Category.split(',').forEach(cat => {
          const trimmed = cat.trim();
          if (trimmed) categorySet.add(trimmed);
        });
      }
    });
    return Array.from(categorySet).sort().map(cat => ({
      value: cat,
      label: cat
    }));
  }, [messages]);
  
  const initializeApp = async () => {
    try {
      // 检查是否已初始化
      const result = await chrome.storage.local.get(['scheduledMessagesConfig']);
      const savedConfig = result.scheduledMessagesConfig
        ? normalizeSheetConfig(result.scheduledMessagesConfig)
        : null;
      
      if (savedConfig && savedConfig.sheetId) {
        setConfig(savedConfig);
        setIsInitialized(true);
        
        setBotConfigured(hasExecutorRule(savedConfig));
        setTimelineBotConfigured(hasTimelineSyncRule(savedConfig));
        
        // 🔧 优先使用缓存的 token，避免在页面加载时弹出授权窗口
        const token = await getGoogleAuthTokenSilently({ caller: 'ScheduledMessagesManager.init' });
        if (!token) {
          // 如果没有缓存的 token，显示提示让用户手动授权
          console.warn('⚠️ 无缓存的 Google 认证 token，需要用户手动授权');
          setNeedsReauth(true);
        }
        
        if (token) {
          const messageService = new ScheduledMessageService(token);
          setService(messageService);
          await loadMessages(messageService);
          
          // 加载消息后，验证 Bot 配置是否仍然有效
          await checkBotConfigValidity(savedConfig, messageService);
        }
      } else {
        setIsInitialized(false);
      }
    } catch (error) {
      console.error('初始化应用失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadOutreachRuntime = async () => {
    try {
      const client = getMemoryServiceClient();
      const runtime = await client.getRuntimeConfig();
      const ringCentralReady =
        Boolean(runtime.ringCentralServerUrl?.trim()) &&
        Boolean(runtime.ringCentralClientId?.trim()) &&
        Boolean(runtime.ringCentralClientSecretConfigured) &&
        Boolean(runtime.ringCentralJwtConfigured);
      setOutreachRuntime({
        enabled: Boolean(runtime.outreachEnabled),
        ringCentralReady,
      });
    } catch (error) {
      console.info('加载 Outreach runtime 配置失败，按未配置处理:', error);
      setOutreachRuntime({
        enabled: false,
        ringCentralReady: false,
      });
    }
  };

  const openOptionsPage = () => {
    if (chrome?.runtime?.openOptionsPage) {
      void chrome.runtime.openOptionsPage();
    }
  };
  
  /**
   * 加载消息列表
   * @param messageService 消息服务
   * @param skipJiraSync 是否跳过 Jira 状态同步（保存消息后可跳过以提升性能）
   */
  const loadMessages = async (messageService: ScheduledMessageService, skipJiraSync = false) => {
    try {
      const msgs = await messageService.getAllMessages();
      
      // 同步 JiraAutomation 状态（可跳过以提升性能）
      const jiraSyncedMsgs = skipJiraSync ? msgs : await syncJiraAutomationStatus(msgs, messageService);
      const updatedMsgs = await overlayOutreachRuntimeStatus(jiraSyncedMsgs);
      
      setMessages(updatedMsgs);
      
      const stats = await messageService.getStatistics();
      setStatistics(stats);
    } catch (error) {
      console.error('加载消息失败:', error);
    }
  };
  
  // projectId 缓存，避免重复请求
  const projectIdCacheRef = useRef<Map<string, string>>(new Map());
  
  /**
   * 获取项目 ID（带缓存）
   */
  const getProjectIdFromKeyWithCache = async (jiraUrl: string, projectKey: string): Promise<string | null> => {
    const cacheKey = `${jiraUrl}::${projectKey}`;
    if (projectIdCacheRef.current.has(cacheKey)) {
      return projectIdCacheRef.current.get(cacheKey)!;
    }
    const projectId = await getProjectIdFromKey(jiraUrl, projectKey);
    if (projectId) {
      projectIdCacheRef.current.set(cacheKey, projectId);
    }
    return projectId;
  };
  
  /**
   * 同步 JiraAutomation 状态（优化版本）
   * 按项目分组，每个项目只请求一次 API，大幅减少网络请求
   */
  const syncJiraAutomationStatus = async (
    msgs: ScheduledMessage[], 
    messageService: ScheduledMessageService
  ): Promise<ScheduledMessage[]> => {
    const updatedMsgs = [...msgs];
    let hasUpdates = false;
    
    // 1. 筛选需要同步的消息，并按项目分组
    interface MessageToSync {
      index: number;
      msg: ScheduledMessage;
      linkInfo: { jiraUrl: string; projectKey: string; ruleId: string };
    }
    
    const messagesGroupedByProject = new Map<string, MessageToSync[]>();
    
    for (let i = 0; i < updatedMsgs.length; i++) {
      const msg = updatedMsgs[i];
      
      // 只处理 JiraAutomation 类型的消息
      if (msg.Push_Method !== 'JiraAutomation' || !msg.Automation_Link) {
        continue;
      }
      
      const linkInfo = parseAutomationLink(msg.Automation_Link);
      if (!linkInfo) continue;
      
      const { jiraUrl, projectKey } = linkInfo;
      const groupKey = `${jiraUrl}::${projectKey}`;
      
      if (!messagesGroupedByProject.has(groupKey)) {
        messagesGroupedByProject.set(groupKey, []);
      }
      messagesGroupedByProject.get(groupKey)!.push({ index: i, msg, linkInfo });
    }
    
    // 如果没有需要同步的消息，直接返回
    if (messagesGroupedByProject.size === 0) {
      return msgs;
    }
    
    console.log(`[同步] 需要同步 ${messagesGroupedByProject.size} 个项目的 Jira 规则状态`);
    
    // 2. 并行获取每个项目的所有规则
    const syncTasks = Array.from(messagesGroupedByProject.entries()).map(
      async ([groupKey, messagesToSync]) => {
        const [jiraUrl, projectKey] = groupKey.split('::');
        
        try {
          // 获取项目 ID（带缓存）
          const projectId = await getProjectIdFromKeyWithCache(jiraUrl, projectKey);
          if (!projectId) {
            console.warn(`[同步] 无法获取项目 ${projectKey} 的 ID`);
            return;
          }
          
          // 批量获取该项目的所有规则（单次请求）
          const result = await chrome.runtime.sendMessage({
            type: 'GET_ALL_JIRA_RULES',
            data: { jiraUrl, projectId }
          });
          
          if (!result?.success || !result.rules) {
            console.warn(`[同步] 获取项目 ${projectKey} 的规则失败:`, result?.error);
            return;
          }
          
          // 构建规则 ID 到规则的映射
          const rulesMap = new Map<string, any>();
          for (const rule of result.rules) {
            rulesMap.set(String(rule.id), rule);
          }
          
          // 3. 在本地匹配并更新状态
          const updatePromises: Promise<void>[] = [];
          
          for (const { index, msg, linkInfo } of messagesToSync) {
            const ruleData = rulesMap.get(linkInfo.ruleId);
            if (!ruleData) {
              console.warn(`[同步] 未找到规则 ${linkInfo.ruleId}`);
              continue;
            }
            
            const jiraState = ruleData.state; // 'ENABLED' 或 'DISABLED'
            const expectedStatus = jiraState === 'ENABLED' ? 'Active' : 'Paused';
            
            // 如果状态不一致，更新
            if (msg.Status !== expectedStatus) {
              console.log(`[同步] Jira Rule ${linkInfo.ruleId} 状态不一致: Sheet=${msg.Status}, Jira=${jiraState}, 更新为 ${expectedStatus}`);
              
              // 更新本地状态
              updatedMsgs[index] = { ...msg, Status: expectedStatus };
              hasUpdates = true;
              
              // 异步更新 Sheet（收集到数组中）
              updatePromises.push(
                messageService.updateMessage(msg.ID, { Status: expectedStatus })
                  .then(() => { return; })  // 转换返回类型为 void
                  .catch(err => {
                    console.warn(`[同步] 更新消息 ${msg.ID} 状态失败:`, err);
                  })
              );
            }
          }
          
          // 等待所有 Sheet 更新完成
          await Promise.all(updatePromises);
          
        } catch (error) {
          console.warn(`[同步] 同步项目 ${projectKey} 的规则状态失败:`, error);
        }
      }
    );
    
    // 并行执行所有项目的同步任务
    await Promise.all(syncTasks);
    
    return hasUpdates ? updatedMsgs : msgs;
  };
  
  const checkBotConfigValidity = async (savedConfig: SheetConfig, messageService: ScheduledMessageService) => {
    try {
      // 获取所有消息
      const msgs = await messageService.getAllMessages();
      
      const normalizedConfig = normalizeSheetConfig(savedConfig);
      const executorRule = getExecutorRule(normalizedConfig);
      const timelineSyncRule = getTimelineSyncRule(normalizedConfig);

      const hasPendingAutomationMessages = msgs.some(
        msg => msg.Status === 'Active' && requiresBotAutomation(msg)
      );
      const hasPendingTimelineAutomationMessages = msgs.some(
        msg => msg.Status === 'Active' && requiresBotAutomation(msg) && isTimelineTriggeredMessage(msg)
      );

      const executorConfigured = Boolean(executorRule?.ruleId);
      const timelineSyncConfigured = Boolean(timelineSyncRule?.ruleId);

      setBotConfigured(executorConfigured);
      setTimelineBotConfigured(timelineSyncConfigured);

      if (!hasPendingAutomationMessages) {
        setShowBotConfigWarning(false);
        setBotConfigWarningState(buildBotConfigWarningState('ok', normalizedConfig));
        return;
      }

      const { JiraAutomationService } = await import('./JiraAutomationService');
      const jiraService = new JiraAutomationService();

      let executorExists = executorConfigured;
      if (executorRule?.ruleId && executorRule?.jiraUrl) {
        executorExists = await jiraService.checkRuleExists(
          {
            jiraUrl: executorRule.jiraUrl,
            projectKey: executorRule.projectKey
          },
          executorRule.ruleId
        );
      }

      let timelineSyncExists = timelineSyncConfigured;
      if (timelineSyncRule?.ruleId && timelineSyncRule?.jiraUrl) {
        timelineSyncExists = await jiraService.checkRuleExists(
          {
            jiraUrl: timelineSyncRule.jiraUrl,
            projectKey: timelineSyncRule.projectKey
          },
          timelineSyncRule.ruleId
        );
      }

      setBotConfigured(executorExists);
      setTimelineBotConfigured(timelineSyncExists);

      let status: BotConfigValidityStatus = 'ok';
      if (!executorExists && hasPendingTimelineAutomationMessages) {
        status = timelineSyncExists ? 'missing_executor_rule' : 'missing_both';
      } else if (!executorExists) {
        status = 'missing_executor_rule';
      } else if (!timelineSyncExists && hasPendingTimelineAutomationMessages) {
        status = 'missing_timeline_sync_rule';
      }

      const nextWarningState = buildBotConfigWarningState(status, normalizedConfig);
      setBotConfigWarningState(nextWarningState);
      setShowBotConfigWarning(status !== 'ok');
    } catch (error) {
      console.error('检查 Bot 配置有效性失败:', error);
      // 检查失败不影响正常使用，不显示警告
    }
  };
  
  const handleInitializationComplete = (result: InitializationResult) => {
    if (result.success) {
      // 刷新页面重新加载
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    }
  };
  
  const handleSync = async () => {
    if (!service || !config) return;
    
    setIsLoading(true);
    try {
      await loadMessages(service);
      
      // 检查并补充 logsSheetId（如果缺失）
      if (config.logsSheetId === undefined || config.logsSheetId === null) {
        console.log('⏳ 同步时发现 logsSheetId 缺失，尝试获取...');
        try {
          const token = await getGoogleAuthToken({ caller: 'ScheduledMessagesManager.syncLogsSheetId' });
          if (token) {
            const logsSheetId = await fetchLogsSheetId(token, config.sheetId);
            if (logsSheetId !== null) {
              // 保存到配置
              const updatedConfig = { ...config, logsSheetId };
              await chrome.storage.local.set({ scheduledMessagesConfig: updatedConfig });
              setConfig(updatedConfig);
              console.log('✅ 已补充 logsSheetId:', logsSheetId);
            }
          }
        } catch (error) {
          console.error('补充 logsSheetId 失败:', error);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  // 检查 App Script 更新
  const checkForUpdates = async () => {
    try {
      if (!config || !config.webAppUrl) {
        return;
      }
      
      const token = await getGoogleAuthToken({ caller: 'ScheduledMessagesManager.checkForUpdates' });
      if (!token) {
        return;
      }
      
      const updater = new AppScriptUpdater(token, config);
      const result = await updater.checkForUpdates();
      
      if (result.needsUpdate) {
        setUpdateAvailable(true);
        setAppScriptVersion(result.currentVersion);
        console.log(`发现新版本: ${result.latestVersion}`);
      } else {
        setUpdateAvailable(false);
        setAppScriptVersion(result.currentVersion);
      }
    } catch (error) {
      console.error('检查更新失败:', error);
    }
  };
  
  // 执行升级版本（包含 Sheet Schema、App Script、Jira Rule 三项更新）
  const handleUpgradeVersion = async () => {
    if (!config) return;
    
    if (!confirm('确定要升级到最新版本吗？\n\n将依次执行以下升级：\n1. Sheet 表结构升级\n2. App Script 代码升级\n3. Jira Automation 规则升级\n\n整个过程可能需要几分钟时间。')) {
      return;
    }
    
    setIsUpdating(true);
    const updateResults: string[] = [];
    let appScriptHelpUrl = '';
    let appScriptHelpMessage = '';
    
    try {
      const token = await getGoogleAuthToken({ caller: 'ScheduledMessagesManager.handleUpgrade' });
      if (!token) {
        throw new Error('无法获取 Google 授权');
      }
      
      // 1. 升级 Sheet Schema
      console.log('🔄 开始升级 Sheet Schema...');
      try {
        const schemaUpdater = new SheetSchemaUpdater(token, config);
        const schemaResult = await schemaUpdater.checkAndUpdate();
        
        if (schemaResult.updated) {
          updateResults.push(`✅ Sheet 表结构已升级\n   新增列: ${schemaResult.addedColumns.join(', ')}`);
        } else {
          updateResults.push('✓ Sheet 表结构已是最新');
        }
      } catch (error) {
        console.error('Sheet Schema 升级失败:', error);
        updateResults.push(`⚠️ Sheet 表结构升级失败: ${error.message}`);
      }
      
      // 2. 升级 App Script（延迟 3 秒，等待 Schema 更新完成）
      await new Promise(resolve => setTimeout(resolve, 3000));
      console.log('🔄 开始升级 App Script...');
      try {
        const appScriptUpdater = new AppScriptUpdater(token, config);
        const appScriptResult = await appScriptUpdater.updateAppScript();
        
        if (appScriptResult.success) {
          updateResults.push(`✅ App Script 已升级到 ${appScriptResult.newVersion}`);
          setUpdateAvailable(false);
          setAppScriptVersion(appScriptResult.newVersion || '');
        } else if (
          appScriptResult.errorCode === APP_SCRIPT_PROJECT_HISTORY_LIMIT_ERROR &&
          appScriptResult.helpUrl
        ) {
          appScriptHelpUrl = appScriptResult.helpUrl;
          appScriptHelpMessage = appScriptResult.helpMessage || '请先清理旧的历史版本后重试升级。';
          updateResults.push(
            `⚠️ App Script 升级失败：历史版本已达到 200 个上限\n   处理方式：${appScriptHelpMessage}\n   清理页面：${appScriptHelpUrl}`
          );
        } else {
          throw new Error(appScriptResult.error || '更新失败');
        }
      } catch (error) {
        console.error('App Script 升级失败:', error);
        updateResults.push(`⚠️ App Script 升级失败: ${error.message}`);
      }
      
      // 3. 升级 Jira Automation Rule（延迟 5 秒，避免与上面的更新冲突）
      await new Promise(resolve => setTimeout(resolve, 5000));
      console.log('🔄 开始升级 Jira Automation Rule...');
      try {
        const jiraUpdater = new JiraRuleUpdater(config);
        const checkResult = await jiraUpdater.checkForUpdates();
        
        if (checkResult.needsUpdate) {
          const jiraResult = await jiraUpdater.updateJiraRule();
          if (jiraResult.success) {
            updateResults.push(`✅ Jira Automation 规则已升级到 ${jiraResult.newVersion}`);
          } else {
            throw new Error(jiraResult.error || '更新失败');
          }
        } else {
          updateResults.push('✓ Jira Automation 规则已是最新');
        }
      } catch (error) {
        console.error('Jira Rule 升级失败:', error);
        updateResults.push(`⚠️ Jira Automation 规则升级失败: ${error.message}`);
      }
      
      // 显示升级结果
      const hasWarnings = updateResults.some(result => result.includes('⚠️'));
      alert(`${hasWarnings ? '⚠️ 升级流程已执行完毕（含失败项）' : '🎉 版本升级完成！'}\n\n${updateResults.join('\n\n')}\n\n页面将重新加载以应用更新...`);

      if (appScriptHelpUrl) {
        const shouldOpenProjectHistory = confirm(
          `App Script 历史版本已达到 200 个上限。\n\n${appScriptHelpMessage}\n\n是否立即打开 Project History 清理页面？`
        );
        if (shouldOpenProjectHistory) {
          window.open(appScriptHelpUrl, '_blank');
        }
      }
      
      // 重新加载配置
      await initializeApp();
      
    } catch (error) {
      console.error('版本升级失败:', error);
      alert(`❌ 升级失败: ${error.message}\n\n请稍后重试或联系管理员。`);
    } finally {
      setIsUpdating(false);
    }
  };
  
  // 组件加载时检查更新
  useEffect(() => {
    if (isInitialized && config) {
      checkForUpdates();
    }
  }, [isInitialized, config]);
  
  const handleOpenSheet = async () => {
    if (config && config.sheetUrl) {
      // 如果有 logsSheetId，直接打开 Logs 表
      if (config.logsSheetId !== undefined && config.logsSheetId !== null) {
        const url = `${config.sheetUrl.replace('/edit', '')}#gid=${config.logsSheetId}`;
        window.open(url, '_blank');
      } else {
        // 没有 logsSheetId，尝试获取并保存
        console.log('⏳ logsSheetId 未记录，尝试获取...');
        try {
          const token = await getGoogleAuthToken({ caller: 'ScheduledMessagesManager.openLogsSheet' });
          if (token && service) {
            const logsSheetId = await fetchLogsSheetId(token, config.sheetId);
            if (logsSheetId !== null) {
              // 保存到配置
              const updatedConfig = { ...config, logsSheetId };
              await chrome.storage.local.set({ scheduledMessagesConfig: updatedConfig });
              setConfig(updatedConfig);
              
              // 打开 Logs 表
              const url = `${config.sheetUrl.replace('/edit', '')}#gid=${logsSheetId}`;
              window.open(url, '_blank');
              console.log('✅ 已获取并保存 logsSheetId:', logsSheetId);
            } else {
              // 找不到 Logs 表，打开默认页
              window.open(config.sheetUrl, '_blank');
            }
          } else {
            window.open(config.sheetUrl, '_blank');
          }
        } catch (error) {
          console.error('获取 logsSheetId 失败:', error);
          // 出错时打开默认页
          window.open(config.sheetUrl, '_blank');
        }
      }
    }
  };
  
  // 获取 Logs Sheet ID
  const fetchLogsSheetId = async (token: string, sheetId: string): Promise<number | null> => {
    try {
      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      if (!response.ok) {
        throw new Error(`获取 Sheet 信息失败: ${response.status}`);
      }
      
      const data = await response.json();
      const logsSheet = data.sheets.find((s: any) => s.properties.title === 'Logs');
      
      if (!logsSheet) {
        console.warn('未找到 Logs 工作表');
        return null;
      }
      
      return logsSheet.properties.sheetId;
    } catch (error) {
      console.error('fetchLogsSheetId 失败:', error);
      return null;
    }
  };

  const openBotConfigDialog = (mode?: BotConfigDialogMode) => {
    const nextMode = mode || getBotDialogModeForStatus(botConfigWarningState.status, config);
    setBotConfigDialogMode(nextMode);
    setShowBotConfigDialog(true);
  };
  
  const handleAddMessage = () => {
    setIsReminderMode(false);
    setEditingMessage(null);
    setShowAddDialog(true);
  };
  
  const handleAddReminder = () => {
    setIsReminderMode(true);
    setEditingMessage(null);
    setShowAddDialog(true);
  };
  
  // 托管确认弹窗状态
  const [showTakeoverDialog, setShowTakeoverDialog] = useState(false);
  const [takeoverMessage, setTakeoverMessage] = useState<ScheduledMessage | null>(null);
  const [takeoverLoading, setTakeoverLoading] = useState(false);
  const [takeoverError, setTakeoverError] = useState<string>('');
  
  const handleEditMessage = async (message: ScheduledMessage) => {
    // 检查是否是需要托管确认的 JiraAutomation 消息
    // 条件：Push_Method 是 JiraAutomation，有 Schedule_Date，但没有 AI_Endpoint
    const needsTakeoverConfirmation = 
      message.Push_Method === 'JiraAutomation' && 
      message.Schedule_Date && 
      !message.AI_Endpoint &&
      message.Automation_Link;
    
    if (needsTakeoverConfirmation) {
      // 显示托管确认弹窗
      setTakeoverMessage(message);
      setTakeoverError('');
      setShowTakeoverDialog(true);
      return;
    }
    
    // 正常编辑流程
    setIsReminderMode(false);
    setEditingMessage(message);
    setShowAddDialog(true);
  };
  
  // 处理托管确认
  const handleTakeoverConfirm = async () => {
    if (!takeoverMessage || !service) return;
    
    // 检查 Bot 是否已配置
    if (!botConfigured) {
      alert('⚠️ 托管 Jira 规则需要先配置 Bot 推送功能\n\n托管后的规则将通过 Bot 推送触发执行，请先完成 Bot 配置。');
      setShowTakeoverDialog(false);
      setTakeoverMessage(null);
      openBotConfigDialog();
      return;
    }
    
    setTakeoverLoading(true);
    setTakeoverError('');
    
    try {
      const linkInfo = parseAutomationLink(takeoverMessage.Automation_Link!);
      if (!linkInfo) {
        throw new Error('无法解析 Automation_Link');
      }
      
      const { jiraUrl, projectKey, ruleId } = linkInfo;
      // 使用带缓存的版本
      const projectId = await getProjectIdFromKeyWithCache(jiraUrl, projectKey);
      
      if (!projectId) {
        throw new Error('无法获取项目 ID');
      }
      
      // 获取规则详情，检查 executionMode
      console.log('🔍 检查规则 executionMode...');
      const detailResult = await chrome.runtime.sendMessage({
        type: 'GET_JIRA_RULE_DETAILS',
        data: { jiraUrl, projectId, ruleId }
      });
      
      if (!detailResult?.success || !detailResult.ruleData) {
        throw new Error('无法获取规则详情');
      }
      
      const ruleData = detailResult.ruleData;
      const trigger = ruleData.trigger;
      const executionMode = trigger?.value?.executionMode;
      
      // 检查执行频率是否小于 1 天
      if (trigger && trigger.type === 'jira.jql.scheduled') {
        const schedule = trigger.value?.schedule;
        
        if (schedule) {
          let intervalTooShort = false;
          let intervalDescription = '';
          
          // 检查 method=FIXED
          if (schedule.method === 'FIXED') {
            const rateInterval = schedule.rateInterval || 0;
            
            // rateInterval 单位是分钟，86400 分钟 = 1 天
            if (rateInterval < 86400) {
              intervalTooShort = true;
              const hours = Math.floor(rateInterval / 60);
              const minutes = rateInterval % 60;
              intervalDescription = hours > 0 
                ? `每 ${hours} 小时 ${minutes > 0 ? minutes + ' 分钟' : ''}`
                : `每 ${minutes} 分钟`;
            }
          } 
          // 检查 method=CRON
          else if (schedule.method === 'CRON') {
            const cronExpression = schedule.cronExpression || '';
            
            // 解析 CRON 表达式判断频率
            // CRON 格式: 秒 分 时 日 月 周
            // 例如: "0 0 */12 * * ?" = 每 12 小时执行一次
            // 例如: "0 0 9 ? * MON-FRI" = 每工作日 9:00
            // 例如: "0 0 9 ? * 2,4,6" = 每周一、三、五 9:00
            const parts = cronExpression.split(' ');
            if (parts.length >= 6) {
              const dayOfMonth = parts[3];
              const hours = parts[2];
              const dayOfWeek = parts[5];
              
              // 检查是否是小时级别的执行（时字段包含 */N）
              if (hours.includes('*/')) {
                const hourMatch = hours.match(/^\*\/(\d+)$/);
                if (hourMatch) {
                  const hourInterval = parseInt(hourMatch[1], 10);
                  if (hourInterval < 24) {
                    intervalTooShort = true;
                    intervalDescription = `每 ${hourInterval} 小时`;
                  }
                }
              } else if (hours.includes(',')) {
                // 多个小时执行（例如 "0,6,12,18"）
                const hourList = hours.split(',');
                if (hourList.length > 1) {
                  intervalTooShort = true;
                  intervalDescription = '每天多次执行';
                }
              }
              
              // 检查是否是每 N 天执行（日字段包含 */N，且 N < 1）
              if (dayOfMonth.includes('*/')) {
                const dayMatch = dayOfMonth.match(/^\*\/(\d+)$/);
                if (dayMatch) {
                  const dayInterval = parseInt(dayMatch[1], 10);
                  if (dayInterval < 1) {
                    intervalTooShort = true;
                    intervalDescription = '小于 1 天';
                  }
                }
              }
              
              // 检查是否是一周多天模式（如 MON-FRI, 1,3,5, 2,4,6 等）
              // 这种模式是支持的，每天最多执行一次，不应视为"间隔过短"
              if (!intervalTooShort && dayOfWeek && dayOfWeek !== '*' && dayOfWeek !== '?') {
                // 解析多星期配置，转换为 JS 格式 (0=周日, 1=周一...6=周六)
                const jiraDays = parseCronDaysOfWeek(dayOfWeek);
                if (jiraDays.length > 0) {
                  // 转换 Jira 格式 (1=周日, 2=周一...7=周六) 到 JS 格式 (0=周日, 1=周一...6=周六)
                  const jsDays = jiraDays.map(d => (d - 1) % 7);
                  
                  // 保存解析的星期到消息中
                  (takeoverMessage as any)._parsedRepeatDays = jsDays.join(',');
                  (takeoverMessage as any)._parsedRepeatUnit = 'Week';
                  (takeoverMessage as any)._parsedRepeatEvery = 1;
                  
                  console.log('📅 检测到一周多天模式:', {
                    cronDayOfWeek: dayOfWeek,
                    jiraDays,
                    jsDays,
                    repeatDays: jsDays.join(',')
                  });
                }
              }
            }
          }
          
          // 如果间隔小于 1 天，显示错误并返回
          if (intervalTooShort) {
            setTakeoverError(
              `⚠️ 该规则的执行间隔小于 1 天（${intervalDescription}），无法在 Personal AI 中托管。\n\n` +
              'Personal AI 的调度系统基于 Google Sheets 和 Apps Script，仅支持每天最多执行一次。\n\n' +
              '如果需要更高频率的执行，请保持规则在 Jira Automation 中运行。'
            );
            setTakeoverLoading(false);
            return;
          }
        }
      }
      
      // 检查是否是 nosearch 模式
      if (executionMode !== 'nosearch') {
        setTakeoverError(
          '⚠️ 该规则的触发器使用了 JQL 查询模式（' + (executionMode || 'unknown') + '）。\n\n' +
          '要使用 Personal AI 托管，请先在 Jira 中修改该规则的 Scheduled trigger 为：\n' +
          '"Simply run the conditions and actions without providing issues" 模式，\n' +
          '并使用 JQL branch 替代原有的 Jira 查询功能。\n\n' +
          '修改完成后，请重新尝试托管。'
        );
        setTakeoverLoading(false);
        return;
      }
      
      // 执行 webhook 转换
      console.log('🔄 转换规则为 incoming webhook...');
      const webhookResult = await chrome.runtime.sendMessage({
        type: 'CONVERT_JIRA_RULE_TO_WEBHOOK',
        data: {
          ruleId,
          projectId,
          jiraUrl
        }
      });
      
      if (!webhookResult?.success || !webhookResult.webhookUrl) {
        throw new Error(webhookResult?.error || '转换 webhook 失败');
      }
      
      // 更新 Sheet 中的 AI_Endpoint 和解析的调度配置
      console.log('📝 更新消息的 AI_Endpoint 和调度配置...');
      const aiEndpoint = `POST ${webhookResult.webhookUrl}`;
      
      // 构建更新数据，包含解析的多星期配置
      const updateData: any = { AI_Endpoint: aiEndpoint };
      
      // 如果从 CRON 解析出了多星期配置，一并更新
      if ((takeoverMessage as any)._parsedRepeatDays) {
        updateData.Repeat_Days = (takeoverMessage as any)._parsedRepeatDays;
        updateData.Repeat_Unit = (takeoverMessage as any)._parsedRepeatUnit || 'Week';
        updateData.Repeat_Every = (takeoverMessage as any)._parsedRepeatEvery || 1;
        console.log('📅 同时更新多星期配置:', {
          Repeat_Days: updateData.Repeat_Days,
          Repeat_Unit: updateData.Repeat_Unit,
          Repeat_Every: updateData.Repeat_Every
        });
      }
      
      await service.updateMessage(takeoverMessage.ID, updateData);
      
      // 获取更新后的消息列表用于查找（不更新 state，避免重复请求）
      const updatedMessages = await service.getAllMessages();
      
      // 更新 state（跳过 Jira 同步，因为状态刚刚被手动更新）
      setMessages(updatedMessages);
      const stats = await service.getStatistics();
      setStatistics(stats);
      
      // 关闭弹窗并进入编辑模式
      setShowTakeoverDialog(false);
      setTakeoverMessage(null);
      
      // 找到更新后的消息并进入编辑模式
      const updatedMessage = updatedMessages.find(m => m.ID === takeoverMessage.ID);
      
      if (updatedMessage) {
        setIsReminderMode(false);
        setEditingMessage(updatedMessage);
        setShowAddDialog(true);
        alert('✅ 已成功将规则托管给 Personal AI！\n现在可以编辑调度配置了。');
      }
      
    } catch (error: any) {
      console.error('托管失败:', error);
      setTakeoverError(`托管失败: ${error.message}`);
    } finally {
      setTakeoverLoading(false);
    }
  };
  
  // 取消托管确认
  const handleTakeoverCancel = () => {
    setShowTakeoverDialog(false);
    setTakeoverMessage(null);
    setTakeoverError('');
  };
  
  // 批准自动答复消息（将状态改为 Active，并设置下一分钟执行）
  const handleApproveAutoReply = async (message: ScheduledMessage) => {
    if (!service) return;
    
    try {
      const now = new Date();
      const nextMinute = new Date(now.getTime() + 60 * 1000);
      const scheduleDate = nextMinute.toISOString().split('T')[0];
      const scheduleTime = nextMinute.toTimeString().substring(0, 5);
      
      await service.updateMessage(message.ID, {
        Status: 'Active',
        Schedule_Date: scheduleDate,
        Schedule_Time: scheduleTime
      });
      
      // 刷新消息列表（跳过 Jira 同步，因为状态已手动更新）
      await loadMessages(service, true);
      
      console.log(`✅ 自动答复已批准: ${message.Topic}`);
    } catch (error) {
      console.error('批准自动答复失败:', error);
      alert('批准失败，请稍后重试');
    }
  };
  
  // 拒绝自动答复消息（将状态改为 Done）
  const handleRejectAutoReply = async (message: ScheduledMessage) => {
    if (!service) return;
    
    const confirmReject = window.confirm(
      `确定要拒绝此自动答复吗？\n\n主题: ${message.Topic}\n内容: ${message.Content.substring(0, 100)}...`
    );
    
    if (!confirmReject) return;
    
    try {
      await service.updateMessage(message.ID, {
        Status: 'Done'
      });
      
      // 刷新消息列表（跳过 Jira 同步，因为状态已手动更新）
      await loadMessages(service, true);
      
      console.log(`❌ 自动答复已拒绝: ${message.Topic}`);
    } catch (error) {
      console.error('拒绝自动答复失败:', error);
      alert('拒绝失败，请稍后重试');
    }
  };
  
  const handleDeleteMessage = async (id: string, topic: string) => {
    if (!service) return;
    
    // 查找消息，检查是否是托管中的 JiraAutomation 消息
    const message = messages.find(m => m.ID === id);
    const isManagedJiraAutomation = message && 
      message.Push_Method === 'JiraAutomation' && 
      message.Schedule_Date && 
      message.AI_Endpoint &&
      message.Automation_Link;
    
    if (isManagedJiraAutomation) {
      // 托管消息需要特殊处理
      const confirmMessage = 
        `⚠️ 删除托管消息\n\n` +
        `消息: "${topic}"\n\n` +
        `此消息正在由 Personal AI 托管，删除后将：\n` +
        `1. 将 Jira Rule 的 trigger 恢复为 Scheduled 模式\n` +
        `2. 从 Personal AI 中移除此消息\n\n` +
        `确定要撤销托管并删除吗？`;
      
      if (!confirm(confirmMessage)) {
        return;
      }
      
      setIsLoading(true);
      try {
        // 先恢复 Jira Rule 的 trigger
        const linkInfo = parseAutomationLink(message.Automation_Link!);
        if (linkInfo) {
          const { jiraUrl, projectKey, ruleId } = linkInfo;
          // 使用带缓存的版本
          const projectId = await getProjectIdFromKeyWithCache(jiraUrl, projectKey);
          
          if (projectId) {
            console.log('🔄 恢复 Jira Rule 的 scheduled trigger...');
            
            // 构建调度配置
            // 解析 Repeat_Days：JS 格式 (0=周日, 1=周一...6=周六) 转换回 Jira 格式 (1=周日, 2=周一...7=周六)
            let scheduleDaysOfWeek: number[] | undefined;
            if (message.Repeat_Days && message.Repeat_Unit === 'Week') {
              scheduleDaysOfWeek = message.Repeat_Days.split(',')
                .map(d => parseInt(d.trim(), 10))
                .filter(d => !isNaN(d))
                .map(d => d + 1);  // JS格式 -> Jira格式
              console.log('📅 恢复多星期配置:', { 
                jsDays: message.Repeat_Days, 
                jiraDays: scheduleDaysOfWeek 
              });
            }
            
            // 将本地时间转换为 UTC 时间（Jira Automation Server 使用 UTC）
            // 本地时间是 UTC+8，所以需要减去 8 小时
            const localTime = message.Schedule_Time || '09:00';
            const [localHours, localMinutes] = localTime.split(':').map(Number);
            const utcHours = (localHours - 8 + 24) % 24;
            const utcTime = `${String(utcHours).padStart(2, '0')}:${String(localMinutes).padStart(2, '0')}`;
            console.log('🕐 时间转换:', { localTime, utcTime, offset: -8 });
            
            const scheduleConfig = {
              scheduleTime: utcTime,  // 使用 UTC 时间
              repeatEvery: Number(message.Repeat_Every) || 1,  // 确保转换为数字
              repeatUnit: (message.Repeat_Unit || 'Day') as 'Day' | 'Week' | 'Month',
              scheduleDaysOfWeek
            };
            
            const convertResult = await chrome.runtime.sendMessage({
              type: 'CONVERT_WEBHOOK_TO_SCHEDULED',
              data: {
                ruleId,
                projectId,
                jiraUrl,
                scheduleConfig
              }
            });
            
            if (!convertResult?.success) {
              const errorMsg = convertResult?.error || '未知错误';
              // 恢复失败，不删除消息
              alert(
                `❌ 恢复 Jira Rule 失败: ${errorMsg}\n\n` +
                `为了数据安全，不会删除 Personal AI 中的消息记录。\n` +
                `请先手动检查并修复 Jira Rule，然后再尝试删除。`
              );
              setIsLoading(false);
              return;
            }
          }
        }
        
        // 只有在恢复成功后才删除消息
        await service.deleteMessage(id);
        if (message && isOutreachMessage(message)) {
          await cancelOutreachTemplateMirror(message.ID);
        }
        await loadMessages(service);
        
        alert(
          '✅ 消息已删除，Jira Rule 已恢复为 Scheduled 模式。\n\n' +
          '请前往 Jira Automation 页面确认规则是否正常运作。'
        );
        
      } catch (error: any) {
        console.error('删除托管消息失败:', error);
        alert(`删除失败: ${error.message}`);
      } finally {
        setIsLoading(false);
      }
      
    } else {
      // 普通消息的删除流程
      if (!confirm(`确定要删除消息 "${topic}" 吗？此操作无法撤销。`)) {
        return;
      }
      
      setIsLoading(true);
      try {
        await service.deleteMessage(id);
        if (message && isOutreachMessage(message)) {
          await cancelOutreachTemplateMirror(message.ID);
        }
        await loadMessages(service);
        alert('消息已删除');
      } catch (error: any) {
        console.error('删除消息失败:', error);
        alert(`删除失败: ${error.message}`);
      } finally {
        setIsLoading(false);
      }
    }
  };
  
  // 从 Automation_Link 解析 Jira 信息
  const parseAutomationLink = (link: string): { jiraUrl: string; projectKey: string; ruleId: string } | null => {
    try {
      // 格式: https://jira.ringcentral.com/secure/AutomationProjectAdminAction!default.jspa?projectKey=MTR#/rule/1646
      const url = new URL(link);
      const jiraUrl = url.origin;
      const projectKey = url.searchParams.get('projectKey') || '';
      const ruleIdMatch = link.match(/#\/rule\/(\d+)/);
      const ruleId = ruleIdMatch ? ruleIdMatch[1] : '';
      
      if (jiraUrl && projectKey && ruleId) {
        return { jiraUrl, projectKey, ruleId };
      }
      return null;
    } catch (error) {
      console.error('解析 Automation_Link 失败:', error);
      return null;
    }
  };
  
  // 获取项目 ID（从项目 key，使用统一的 jiraFetch）
  const getProjectIdFromKey = async (jiraUrl: string, projectKey: string): Promise<string | null> => {
    try {
      const response = await jiraFetch(`${jiraUrl}/rest/api/2/project/${projectKey}`);
      
      if (response.ok) {
        const data = await response.json();
        return data.id;
      }
      return null;
    } catch (error) {
      console.error('获取项目 ID 失败:', error);
      return null;
    }
  };
  
  const handleToggleStatus = async (message: ScheduledMessage) => {
    if (!service) return;
    
    setIsLoading(true);
    try {
      // 如果有 Automation_Link，同时更新 Jira Rule 状态
      if (message.Automation_Link) {
        const linkInfo = parseAutomationLink(message.Automation_Link);
        if (linkInfo) {
          const { jiraUrl, projectKey, ruleId } = linkInfo;
          // 使用带缓存的版本
          const projectId = await getProjectIdFromKeyWithCache(jiraUrl, projectKey);
          
          if (projectId) {
            // 获取规则详情
            const detailResult = await chrome.runtime.sendMessage({
              type: 'GET_JIRA_RULE_DETAILS',
              data: { jiraUrl, projectId, ruleId }
            });
            
            if (detailResult?.success && detailResult.ruleData) {
              // 更新 Jira Rule 状态
              const newState = message.Status === 'Active' ? 'DISABLED' : 'ENABLED';
              const updateResult = await chrome.runtime.sendMessage({
                type: 'UPDATE_JIRA_RULE_STATE',
                data: {
                  jiraUrl,
                  projectId,
                  ruleId,
                  newState,
                  ruleData: detailResult.ruleData
                }
              });
              
              if (!updateResult?.success) {
                console.warn('更新 Jira Rule 状态失败:', updateResult?.error);
                // 不阻止本地状态更新，只是给个警告
              }
            }
          }
        }
      }
      
      const updatedMessage = await service.toggleMessageStatus(message.ID);
      await syncOutreachTemplateMirror(updatedMessage);
      // 跳过 Jira 同步，因为状态刚刚被手动更新了
      await loadMessages(service, true);
    } catch (error) {
      console.error('切换状态失败:', error);
      alert(`切换状态失败: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleSubmitNewMessage = async (formData: CreateMessageFormData) => {
    if (!service) return;
    
    setIsSubmitting(true);
    try {
      if (editingMessage) {
        // 编辑模式：更新消息
        const savedMessage = await service.updateMessage(editingMessage.ID, formData);
        
        // 如果是 JiraAutomation 类型且 Topic 发生变化，同步更新 Jira Rule 名称
        if (editingMessage.Push_Method === 'JiraAutomation' && 
            editingMessage.Automation_Link &&
            formData.Topic && 
            formData.Topic !== editingMessage.Topic) {
          try {
            await syncJiraRuleName(editingMessage.Automation_Link, formData.Topic);
          } catch (syncError: any) {
            console.warn('同步 Jira Rule 名称失败:', syncError);
            // 不阻塞主流程，只是警告
          }
        }

        if (isOutreachMessage(editingMessage) && !isOutreachMessage(savedMessage)) {
          await cancelOutreachTemplateMirror(editingMessage.ID);
        } else {
          await syncOutreachTemplateMirror(savedMessage);
        }
        
        // 跳过 Jira 状态同步，因为刚保存的消息状态是一致的
        await loadMessages(service, true);
        setShowAddDialog(false);
        setEditingMessage(null);
        alert('消息更新成功！');
      } else {
        // 新建模式：创建消息
        const savedMessage = await service.createMessage(formData);
        await syncOutreachTemplateMirror(savedMessage);
        // 跳过 Jira 状态同步，因为新建的消息不需要同步
        await loadMessages(service, true);
        setShowAddDialog(false);
        alert('消息创建成功！');
      }
    } catch (error) {
      console.error(editingMessage ? '更新消息失败:' : '创建消息失败:', error);
      alert(`${editingMessage ? '更新' : '创建'}失败: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const syncOutreachTemplateMirror = async (message: ScheduledMessage) => {
    if (!isOutreachMessage(message)) {
      return;
    }

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'SYNC_OUTREACH_TEMPLATE_MIRROR',
        data: {
          message
        }
      });

      if (response && response.success === false) {
        console.info('Outreach template mirror sync skipped:', response.error || 'backend unavailable');
      }
    } catch (error) {
      console.info('Outreach template mirror sync unavailable, ignoring:', error);
    }
  };

  const cancelOutreachTemplateMirror = async (messageId: string) => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'CANCEL_OUTREACH_TEMPLATE_MIRROR',
        data: {
          messageId
        }
      });

      if (response && response.success === false) {
        console.info('Outreach template mirror cancel skipped:', response.error || 'backend unavailable');
      }
    } catch (error) {
      console.info('Outreach template mirror cancel unavailable, ignoring:', error);
    }
  };
  
  /**
   * 同步 Topic 到 Jira Automation Rule 名称
   */
  const syncJiraRuleName = async (automationLink: string, newTopic: string) => {
    const linkInfo = parseAutomationLink(automationLink);
    if (!linkInfo) {
      console.warn('无法解析 Automation_Link，跳过同步');
      return;
    }
    
    const { jiraUrl, projectKey, ruleId } = linkInfo;
    // 使用带缓存的版本
    const projectId = await getProjectIdFromKeyWithCache(jiraUrl, projectKey);
    
    if (!projectId) {
      console.warn('无法获取项目 ID，跳过同步');
      return;
    }
    
    // 获取规则详情
    const detailResult = await chrome.runtime.sendMessage({
      type: 'GET_JIRA_RULE_DETAILS',
      data: { jiraUrl, projectId, ruleId }
    });
    
    if (!detailResult?.success || !detailResult.ruleData) {
      throw new Error('无法获取规则详情');
    }
    
    // 更新规则名称
    console.log(`📝 同步 Topic 到 Jira Rule: ${newTopic}`);
    const updateResult = await chrome.runtime.sendMessage({
      type: 'UPDATE_JIRA_RULE_NAME',
      data: {
        jiraUrl,
        projectId,
        ruleId,
        newName: newTopic,
        ruleData: detailResult.ruleData
      }
    });
    
    if (!updateResult?.success) {
      throw new Error(updateResult?.error || '更新规则名称失败');
    }
    
    console.log('✅ Jira Rule 名称同步成功');
  };
  
  const handleCleanupCompleted = async () => {
    if (!service) return;
    
    if (!confirm(`确定要删除所有已完成的消息吗？\n共 ${statistics.done} 条消息将被永久删除。`)) {
      return;
    }
    
    try {
      const deletedCount = await service.deleteCompletedMessages();
      // 跳过 Jira 同步，因为删除的是已完成的消息
      await loadMessages(service, true);
      alert(`成功清理 ${deletedCount} 条已完成的消息！`);
    } catch (error) {
      console.error('清理已完成消息失败:', error);
      alert(`清理失败: ${error.message}`);
    }
  };
  
  // Google Auth Token 已迁移到 utils/googleAuth.ts
  // 使用 getGoogleAuthToken（会弹窗）和 getGoogleAuthTokenSilently（静默）
  
  const getCurrentUserName = async () => {
    try {
      const token = await getGoogleAuthToken({ caller: 'ScheduledMessagesManager.getCurrentUserName' });
      const response = await fetch('https://www.googleapis.com/oauth2/v1/userinfo?alt=json', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const userInfo = await response.json();
        // userInfo.email 格式如：esone.qiu@ringcentral.com
        const email = userInfo.email || '';
        const username = email.split('@')[0]; // 提取 esone.qiu
        setCurrentUsername(username);
      }
    } catch (error) {
      console.error('获取用户信息失败:', error);
    }
  };
  
  // 格式化下次执行时间
  const formatNextExec = (message: ScheduledMessage): string => {
    // 检查是否为 Timeline 触发
    if (!message.Schedule_Date && message.Timeline_Milestone) {
      return `下次 ${formatTimelineNextExecutionText(message)}`;
    }
    
    // 时间触发：返回原有的 Next_Exec 值
    return message.Next_Exec || '-';
  };
  
  // 频率格式化函数
  const formatFrequency = (message: ScheduledMessage): string => {
    // 检查是否为只有 Automation_Link 而没有 Schedule_Date 的 Jira Automation 规则
    if (message.Automation_Link && !message.Schedule_Date) {
      return 'JIRA触发器';
    }
    
    // 检查是否为 Timeline 触发
    if (!message.Schedule_Date && message.Timeline_Milestone) {
      return formatTimelineFrequencyText(message);
    }
    
    // 判断是否有重复规则
    if (!message.Repeat_Every || !message.Repeat_Unit) {
      // 一次性任务
      return '推送一次';
    }
    
    const every = message.Repeat_Every;
    const unit = message.Repeat_Unit;
    const scheduleDate = message.Schedule_Date;
    const scheduleTime = message.Schedule_Time;
    
    // 根据单位构建频率描述
    let freq = '';
    
    if (unit === 'Day') {
      if (every === 1) {
        freq = '每天';
      } else {
        freq = `每 ${every} 天`;
      }
    } else if (unit === 'Week') {
      const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
      
      // 检查是否有多星期配置
      if (message.Repeat_Days) {
        const days = message.Repeat_Days.split(',')
          .map(d => parseInt(d.trim(), 10))
          .filter(d => !isNaN(d) && d >= 0 && d <= 6)
          .sort((a, b) => a - b);
        
        if (days.length > 0) {
          // 检查是否是工作日 (1,2,3,4,5)
          if (days.length === 5 && 
              days[0] === 1 && days[1] === 2 && days[2] === 3 && 
              days[3] === 4 && days[4] === 5) {
            freq = '工作日';
          }
          // 检查是否是周末 (0,6)
          else if (days.length === 2 && days[0] === 0 && days[1] === 6) {
            freq = '周末';
          }
          // 其他情况，显示具体星期
          else {
            const dayNames = days.map(d => weekdays[d]).join('、');
            freq = `每周${dayNames}`;
          }
        } else {
          freq = `每周`;
        }
      } else if (every === 1) {
        // 无 Repeat_Days，从 Schedule_Date 获取星期几（兼容旧数据）
        const date = new Date(scheduleDate);
        const weekday = weekdays[date.getDay()];
        freq = `每周${weekday}`;
      } else {
        freq = `每 ${every} 周`;
      }
    } else if (unit === 'Month') {
      // 从 Schedule_Date 提取日期
      const day = new Date(scheduleDate).getDate();
      if (every === 1) {
        freq = `每月 ${day} 号`;
      } else {
        freq = `每 ${every} 月的 ${day} 号`;
      }
    } else if (unit === 'Year') {
      if (every === 1) {
        const date = new Date(scheduleDate);
        const month = date.getMonth() + 1;
        const day = date.getDate();
        freq = `每年 ${month}/${day}`;
      } else {
        freq = `每 ${every} 年`;
      }
    }
    
    // 添加时间
    if (scheduleTime) {
      freq += ` ${scheduleTime}`;
    } else {
      freq += ' 早上';
    }
    
    return freq;
  };
  
  // 判断消息是否只发给自己
  const isSelfOnlyMessage = (message: ScheduledMessage): boolean => {
    if (!message.Glip_User_Name || !currentUsername) {
      return false;
    }
    
    // Glip_User_Name 格式：esone.qiu 或 esone.qiu+john.doe
    const usernames = message.Glip_User_Name.split('+');
    
    // 只有一个人且是自己
    return usernames.length === 1 && usernames[0] === currentUsername;
  };
  
  // 根据 Push_Method 显示类型
  const getMessageTypeDisplay = (message: ScheduledMessage): string => {
    // 特殊逻辑：sync.service 显示为系统消息
    if (message.Glip_User_Name === 'sync.service') {
      return '系统消息';
    }
    
    switch (message.Push_Method) {
      case 'AI':
        return 'AI Report';
      case 'AsMe':
        return '假装我发的';
      case 'Bot':
        return 'Bot 定时';
      case 'Outreach':
        return '主动询问';
      case 'JiraAutomation':
        return 'JIRA自动化';
      default:
        return message.Push_Method;
    }
  };
  
  // 格式化"发给"列的显示
  const formatRecipient = (message: ScheduledMessage): string => {
    if (message.Push_Method === 'Outreach') {
      return formatOutreachTarget(message);
    }
    
    // 优先显示用户名
    if (message.Glip_User_Name && message.Glip_User_Name.trim()) {
      const usernames = message.Glip_User_Name.split('+');
      const formattedNames = usernames.map(name => {
        // esone.qiu -> Esone
        const parts = name.split('.');
        if (parts.length > 0) {
          return parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
        }
        return name;
      });
      return formattedNames.join(', ');
    }
    
    // 否则显示群组 ID
    if (message.Glip_Team_ID && message.Glip_Team_ID.trim()) {
      return message.Glip_Team_ID;
    }
    
    return '-';
  };

  const openOutreachSessionsPage = (message: ScheduledMessage) => {
    const url = buildOutreachSessionsUrl(message.ID, message.Outreach_Last_Session_ID);
    window.open(url, '_blank');
  };
  
  if (isLoading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner}></div>
        <p>加载中...</p>
      </div>
    );
  }
  
  if (!isInitialized) {
    return <OneClickSetup onComplete={handleInitializationComplete} />;
  }
  
  // 🔧 需要重新授权的提示
  if (needsReauth) {
    const handleReauth = async () => {
      try {
        const token = await getGoogleAuthToken({ caller: 'ScheduledMessagesManager.handleReauth' });
        if (token) {
          setNeedsReauth(false);
          const messageService = new ScheduledMessageService(token);
          setService(messageService);
          await loadMessages(messageService);
          if (config) {
            await checkBotConfigValidity(config, messageService);
          }
        }
      } catch (error) {
        console.error('重新授权失败:', error);
        alert('授权失败，请重试');
      }
    };
    
    return (
      <div style={styles.loadingContainer}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '18px', marginBottom: '16px' }}>🔐 需要 Google 授权</p>
          <p style={{ color: '#666', marginBottom: '24px' }}>
            您的 Google 授权已过期，请点击下方按钮重新授权以继续使用定时消息功能。
          </p>
          <button 
            onClick={handleReauth}
            style={{
              padding: '12px 24px',
              fontSize: '16px',
              backgroundColor: '#4285f4',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            🔓 重新授权
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>⏰ 定时消息管理</h1>
        <div style={styles.headerActions}>
          <button style={styles.reminderButton} onClick={handleAddReminder} title="快速创建个人提醒">
            ⏰ 提醒我
          </button>
          <button style={styles.addButton} onClick={handleAddMessage} title="新增消息">
            ➕ 新增
          </button>
          <button style={styles.syncButton} onClick={handleSync} title="同步数据">
            🔄 同步
          </button>
          {updateAvailable && (
            <button 
              style={styles.updateButton} 
              onClick={handleUpgradeVersion} 
              disabled={isUpdating}
              title={`当前版本: ${appScriptVersion}，点击升级到最新版本（包含 Sheet、Script、Jira Rule）`}
            >
              {isUpdating ? '⏳ 升级中...' : '🚀 升级版本'}
            </button>
          )}
          <button style={styles.configButton} onClick={handleOpenSheet} title="查看推送记录">
            📊 推送记录
          </button>
        </div>
      </header>
      
      {/* Bot 配置失效警告 */}
      {showBotConfigWarning && (
        <div style={styles.warningBanner}>
          <div style={styles.warningContent}>
            <span style={styles.warningIcon}>⚠️</span>
            <div style={styles.warningText}>
              <strong>{botConfigWarningState.title}</strong>
              <p style={styles.warningDescription}>
                {botConfigWarningState.description}
              </p>
            </div>
          </div>
          <button 
            style={styles.warningButton}
            onClick={() => openBotConfigDialog(botConfigWarningState.dialogMode)}
          >
            {botConfigWarningState.status === 'missing_timeline_sync_rule' ? '🔧 立即升级' : '🔧 重新配置'}
          </button>
        </div>
      )}
      
      <div style={styles.statusBar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flex: 1 }}>
          <span style={styles.statusItem}>
            📊 状态：<strong>已初始化</strong>
          </span>
          <span style={styles.statusItem}>
            总计: <strong>{statistics.total}</strong>
          </span>
          <span style={styles.statusItem}>
            活跃: <strong style={{ color: '#28a745' }}>{statistics.active}</strong>
          </span>
          <span style={styles.statusItem}>
            暂停: <strong style={{ color: '#ffc107' }}>{statistics.paused}</strong>
          </span>
          <span style={styles.statusItem}>
            已完成: <strong style={{ color: '#6c757d' }}>{statistics.done}</strong>
          </span>
          {statistics.pendingReview > 0 && (
            <span style={styles.statusItem}>
              待审核: <strong style={{ color: '#ff9800' }}>{statistics.pendingReview}</strong>
            </span>
          )}
          <span style={styles.statusItem}>
            今日已执行: <strong style={{ color: '#007bff' }}>{statistics.executedToday}</strong>
          </span>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {/* 仅过滤待审核推送 */}
          {statistics.pendingReview > 0 && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={filterPendingReview}
                onChange={(e) => setFilterPendingReview(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              <span style={{ color: '#ff9800', fontWeight: 500 }}>仅过滤待审核推送</span>
            </label>
          )}
          {statistics.done > 0 && (
            <button
              onClick={handleCleanupCompleted}
              style={{
                padding: '6px 12px',
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 500
              }}
              title={`清理 ${statistics.done} 条已完成的消息`}
            >
              🗑️ 清理已完成 ({statistics.done})
            </button>
          )}
          {/* Category 筛选框 */}
          <div style={{ minWidth: '200px' }}>
            <Select<SelectOption, true>
              isMulti
              options={availableCategories}
              value={selectedCategories}
              onChange={(newValue: MultiValue<SelectOption>) => setSelectedCategories([...newValue])}
              placeholder="🏷️ 筛选类别..."
              styles={selectStyles}
              noOptionsMessage={() => '暂无类别'}
              isClearable
            />
          </div>
          <label style={{ 
            display: 'flex', 
            alignItems: 'center', 
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 500,
            color: '#666',
            userSelect: 'none'
          }}>
            <input 
              type="checkbox"
              checked={filterSelfOnly}
              onChange={(e) => setFilterSelfOnly(e.target.checked)}
              style={{ marginRight: '6px', cursor: 'pointer' }}
            />
            过滤掉仅发我的
          </label>
        </div>
      </div>
      
      <div style={styles.content}>
        {messages.length === 0 ? (
          <div style={styles.emptyState}>
            <p style={styles.emptyText}>暂无定时消息</p>
            <p style={styles.emptyHint}>
              请在 <a href="#" onClick={handleOpenSheet}>Google Sheet</a> 中添加消息
            </p>
          </div>
        ) : (
          <div style={styles.messageList}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>类型</th>
                  <th style={styles.th}>主题</th>
                  <th style={styles.th}>类别</th>
                  <th style={styles.th}>发给</th>
                  <th style={styles.th}>频率</th>
                  <th style={styles.th}>下次执行</th>
                  <th style={styles.th}>已发</th>
                  <th style={styles.th}>状态</th>
                  <th style={styles.th}>操作</th>
                </tr>
              </thead>
              <tbody>
                {messages
                  .filter(message => {
                    // 应用过滤条件
                    if (filterSelfOnly && isSelfOnlyMessage(message)) {
                      return false;
                    }
                    // 仅显示待审核消息
                    if (filterPendingReview && message.Status !== 'PendingReview') {
                      return false;
                    }
                    // Category 筛选（并集逻辑）
                    if (selectedCategories.length > 0) {
                      const messageCategories = message.Category 
                        ? message.Category.split(',').map(c => c.trim())
                        : [];
                      const hasMatchingCategory = selectedCategories.some(
                        selected => messageCategories.includes(selected.value)
                      );
                      if (!hasMatchingCategory) {
                        return false;
                      }
                    }
                    return true;
                  })
                  .map((message) => {
                    const displayTitle = message.Topic || (message.Content.length > 30 ? message.Content.substring(0, 30) + '...' : message.Content);
                    return (
                      <tr 
                        key={message.ID} 
                        style={styles.tr}
                        onMouseMove={(e) => {
                          setHoveredMessage(message);
                          setTooltipPosition({ x: e.clientX, y: e.clientY });
                        }}
                        onMouseLeave={() => {
                          setHoveredMessage(null);
                        }}
                      >
                        <td style={styles.td}>
                          <span style={getTypeStyle(message.Push_Method)}>
                            {getMessageTypeDisplay(message)}
                          </span>
                        </td>
                        <td style={styles.td}>
                          <span style={styles.topicText}>
                            {message.Category?.includes('自动答复') && (
                              <span title="自动答复消息" style={{ marginRight: '4px' }}>🤖</span>
                            )}
                            {displayTitle}
                          </span>
                        </td>
                        <td style={styles.td}>
                          {message.Category ? (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                              {message.Category.split(',').map((cat, idx) => (
                                <span key={idx} style={styles.categoryTag}>
                                  {cat.trim()}
                                </span>
                              ))}
                            </div>
                          ) : '-'}
                        </td>
                        <td style={styles.td}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <span>{formatRecipient(message)}</span>
                            {message.Push_Method === 'Outreach' && formatOutreachSummary(message) && (
                              <small style={{ color: '#6c757d', lineHeight: 1.4 }}>
                                {formatOutreachSummary(message)}
                              </small>
                            )}
                          </div>
                        </td>
                        <td style={styles.td}>{formatFrequency(message)}</td>
                        <td style={styles.td}>{formatNextExec(message)}</td>
                        <td style={styles.td}>{message.Exec_Count || 0} 次</td>
                        <td style={styles.td}>
                          <span 
                            style={{...getStatusStyle(message.Status), cursor: 'pointer'}} 
                            onClick={() => handleToggleStatus(message)}
                            title={`点击切换为${message.Status === 'Active' ? '禁用' : '启用'}`}
                          >
                            {message.Status}
                          </span>
                        </td>
                        <td style={styles.td}>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            {/* 待审核消息的快速操作按钮 */}
                            {message.Status === 'PendingReview' && (
                              <>
                                <button 
                                  style={{
                                    padding: '4px 8px',
                                    backgroundColor: '#28a745',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '11px',
                                    fontWeight: 500
                                  }}
                                  onClick={() => handleApproveAutoReply(message)}
                                  title="批准发送（将在下一分钟执行）"
                                >
                                  ✓ 批准
                                </button>
                                <button 
                                  style={{
                                    padding: '4px 8px',
                                    backgroundColor: '#dc3545',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '11px',
                                    fontWeight: 500
                                  }}
                                  onClick={() => handleRejectAutoReply(message)}
                                  title="拒绝此自动答复"
                                >
                                  ✗ 拒绝
                                </button>
                              </>
                            )}
                            {message.Automation_Link && (
                              <button 
                                style={styles.jiraLinkButton}
                                onClick={() => window.open(message.Automation_Link, '_blank')}
                                title="打开 Jira Automation Rule"
                              >
                                🔗
                              </button>
                            )}
                            {message.Push_Method === 'Outreach' && (
                              <button
                                style={{
                                  ...styles.jiraLinkButton,
                                  color: '#0b7285',
                                  borderColor: '#0b7285',
                                }}
                                onClick={() => openOutreachSessionsPage(message)}
                                title="打开主动询问会话页面"
                              >
                                💬 会话
                              </button>
                            )}
                            {/* 如果只有 Automation_Link 而没有 Schedule_Date，不显示编辑按钮 */}
                            {!(message.Automation_Link && !message.Schedule_Date) && (
                              <button 
                                style={{
                                  ...styles.editButton,
                                  // 未托管的 JiraAutomation 消息（有 Automation_Link 但没有 AI_Endpoint）显示为灰度
                                  filter: message.Push_Method === 'JiraAutomation' && 
                                          message.Automation_Link && 
                                          message.Schedule_Date && 
                                          !message.AI_Endpoint 
                                    ? 'grayscale(1) opacity(0.5)' 
                                    : 'none'
                                }}
                                onClick={() => handleEditMessage(message)}
                                title={
                                  message.Push_Method === 'JiraAutomation' && 
                                  message.Automation_Link && 
                                  message.Schedule_Date && 
                                  !message.AI_Endpoint
                                    ? '点击托管此规则'
                                    : '编辑消息'
                                }
                              >
                                ✏️
                              </button>
                            )}
                            <button 
                              style={styles.deleteButton}
                              onClick={() => handleDeleteMessage(message.ID, displayTitle)}
                              title="删除消息"
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      
      <footer style={styles.footer}>
        <p style={styles.footerText}>
          提示：编辑消息请在 <a href="#" onClick={handleOpenSheet}>Google Sheet</a> 中操作
        </p>
      </footer>
      
       {showAddDialog && (
         <AddMessageDialog 
           onSubmit={handleSubmitNewMessage}
           onCancel={() => {
             setShowAddDialog(false);
             setEditingMessage(null);
           }}
           isSubmitting={isSubmitting}
           botConfigured={botConfigured}
           timelineBotConfigured={timelineBotConfigured}
           outreachEnabled={outreachRuntime.enabled}
           outreachConfigured={outreachRuntime.enabled && outreachRuntime.ringCentralReady}
           onConfigureBot={(mode) => openBotConfigDialog(mode)}
           onConfigureOutreach={openOptionsPage}
           isReminderMode={isReminderMode}
           currentUsername={currentUsername}
           availableCategories={availableCategories}
           editingMessage={editingMessage}
         />
       )}
       
       {showBotConfigDialog && config && (
         <BotConfigDialog
           config={config}
           mode={botConfigDialogMode}
           onClose={() => setShowBotConfigDialog(false)}
           onSuccess={(updatedConfig) => {
             const normalizedConfig = normalizeSheetConfig(updatedConfig);
             setConfig(normalizedConfig);
             setBotConfigured(hasExecutorRule(normalizedConfig));
           setTimelineBotConfigured(hasTimelineSyncRule(normalizedConfig));
           setShowBotConfigWarning(false);
           setBotConfigWarningState(buildBotConfigWarningState('ok', normalizedConfig));
           setShowBotConfigDialog(false);
           void initializeApp();
            alert(
              'Bot 推送配置成功！\n\n' +
              '执行规则会立即按分钟运行；Timeline Sync Rule 会在每天清晨刷新缓存。\n' +
              '如果刚补齐 Timeline 配置，相关 Timeline Bot/AI 消息会在下一次日同步后开始生效。'
            );
          }}
        />
      )}
       
       {/* 托管确认弹窗 */}
       {showTakeoverDialog && takeoverMessage && (
         <div style={{
           position: 'fixed',
           top: 0,
           left: 0,
           right: 0,
           bottom: 0,
           backgroundColor: 'rgba(0, 0, 0, 0.5)',
           display: 'flex',
           justifyContent: 'center',
           alignItems: 'center',
           zIndex: 1000
         }}>
           <div style={{
             backgroundColor: 'white',
             borderRadius: '12px',
             padding: '24px',
             maxWidth: '500px',
             width: '90%',
             boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)'
           }}>
             <h3 style={{ margin: '0 0 16px', fontSize: '18px', color: '#172B4D' }}>
               🤖 使用 Personal AI 托管此规则？
             </h3>
             
             <div style={{
               marginBottom: '16px',
               padding: '12px',
               backgroundColor: '#F4F5F7',
               borderRadius: '8px'
             }}>
               <p style={{ margin: '0 0 8px', fontSize: '14px' }}>
                 <strong>规则：</strong> {takeoverMessage.Topic}
               </p>
               <p style={{ margin: '0', fontSize: '13px', color: '#666' }}>
                 当前调度：{takeoverMessage.Schedule_Time} | {(() => {
                   // 检查是否有多星期配置
                   if (takeoverMessage.Repeat_Days && takeoverMessage.Repeat_Unit === 'Week') {
                     const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                     const days = takeoverMessage.Repeat_Days.split(',')
                       .map(d => parseInt(d.trim(), 10))
                       .filter(d => !isNaN(d) && d >= 0 && d <= 6)
                       .sort((a, b) => a - b);
                     // 检查是否是工作日
                     if (days.length === 5 && days[0] === 1 && days[1] === 2 && days[2] === 3 && days[3] === 4 && days[4] === 5) {
                       return '工作日 (Mon-Fri)';
                     }
                     // 检查是否是周末
                     if (days.length === 2 && days[0] === 0 && days[1] === 6) {
                       return '周末 (Sat, Sun)';
                     }
                     return `每周 ${days.map(d => dayNames[d]).join(', ')}`;
                   }
                   // 默认显示
                   return `每 ${takeoverMessage.Repeat_Every} ${takeoverMessage.Repeat_Unit === 'Day' ? '天' : takeoverMessage.Repeat_Unit === 'Week' ? '周' : '月'}`;
                 })()}
               </p>
             </div>
             
             <div style={{
               marginBottom: '16px',
               padding: '12px',
               backgroundColor: '#FFFAE6',
               borderRadius: '8px',
               borderLeft: '3px solid #FFAB00'
             }}>
               <p style={{ margin: '0', fontSize: '13px', color: '#172B4D' }}>
                 ⚠️ <strong>注意：</strong>确认后，规则的 Scheduled Trigger 将被转换为 Incoming Webhook 模式，
                 由 Personal AI 接管调度时间管理。原有的定时触发将被替换。
               </p>
             </div>
             
             {takeoverError && (
               <div style={{
                 marginBottom: '16px',
                 padding: '12px',
                 backgroundColor: '#FFEBE6',
                 borderRadius: '8px',
                 borderLeft: '3px solid #FF5630'
               }}>
                 <p style={{ margin: '0', fontSize: '13px', color: '#BF2600', whiteSpace: 'pre-wrap' }}>
                   {takeoverError}
                 </p>
               </div>
             )}
             
             <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
               <button
                 onClick={handleTakeoverCancel}
                 disabled={takeoverLoading}
                 style={{
                   padding: '10px 20px',
                   border: '1px solid #DFE1E6',
                   borderRadius: '6px',
                   backgroundColor: 'white',
                   cursor: takeoverLoading ? 'not-allowed' : 'pointer',
                   fontSize: '14px',
                   fontWeight: 500
                 }}
               >
                 取消
               </button>
               <button
                 onClick={handleTakeoverConfirm}
                 disabled={takeoverLoading}
                 style={{
                   padding: '10px 20px',
                   border: 'none',
                   borderRadius: '6px',
                   backgroundColor: takeoverLoading ? '#ccc' : '#0052cc',
                   color: 'white',
                   cursor: takeoverLoading ? 'not-allowed' : 'pointer',
                   fontSize: '14px',
                   fontWeight: 500
                 }}
               >
                 {takeoverLoading ? '⏳ 处理中...' : '✅ 确认托管'}
               </button>
             </div>
           </div>
         </div>
       )}
       
       {/* 浮动 Tooltip */}
       {hoveredMessage && (
         <div style={{
           ...styles.tooltip,
           left: `${tooltipPosition.x + 15}px`,
           top: `${tooltipPosition.y + 15}px`,
         }}>
           <div style={styles.tooltipHeader}>消息内容</div>
           <div style={styles.tooltipContent}>{hoveredMessage.Content}</div>
         </div>
       )}
    </div>
  );
};

// 变量选择器组件
const VariableSelector: React.FC<{
  onInsert: (variable: string) => void;
  excludeVariables?: string[];
}> = ({ onInsert, excludeVariables = [] }) => {
  // 项目变量列表（用于检测是否插入了项目变量）- 预留扩展用
  const _projectVariables = [
    '{currentRelease}',
    '{currentPhase}',
    '{currentPhaseStartDate}',
    '{currentPhaseStartedWorkdays}',
    '{nextPhase}',
    '{nextPhaseStartDate}',
    '{nextPhaseCountdownWorkdays}'
  ];
  
  const variables = [
    { key: '{Topic}', label: '消息主题' },
    { key: '{Content}', label: '消息内容' },
    { key: '{TeamID}', label: '群组 ID' },
    { key: '{currentRelease}', label: '当前 Release', isProjectVar: true },
    { key: '{currentPhase}', label: '当前 Phase', isProjectVar: true },
    { key: '{currentPhaseStartDate}', label: '当前 Phase 日期', isProjectVar: true },
    { key: '{currentPhaseStartedWorkdays}', label: '已过天数', isProjectVar: true },
    { key: '{nextPhase}', label: '下个 Phase', isProjectVar: true },
    { key: '{nextPhaseStartDate}', label: '下个 Phase 日期', isProjectVar: true },
    { key: '{nextPhaseCountdownWorkdays}', label: '距离天数', isProjectVar: true }
  ].filter(v => !excludeVariables.includes(v.key));

  if (variables.length === 0) return null;

  return (
    <div style={{
      marginTop: '8px',
      padding: '8px 10px',
      backgroundColor: '#f8f9fa',
      borderRadius: '4px',
      border: '1px solid #e0e0e0',
      fontSize: '12px',
      color: '#666',
    }}>
      <span style={{ marginRight: '8px' }}>💡 插入变量：</span>
      {variables.map((variable, index) => (
        <React.Fragment key={variable.key}>
          {index > 0 && <span style={{ margin: '0 4px', color: '#ccc' }}>|</span>}
          <button
            type="button"
            onClick={() => onInsert(variable.key)}
            style={{
              padding: '2px 8px',
              backgroundColor: '#e0e0e0',
              color: '#555',
              border: 'none',
              borderRadius: '12px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: '500',
              transition: 'background-color 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#d0d0d0';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#e0e0e0';
            }}
            title={`插入 ${variable.key}`}
          >
            {variable.label}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
};

// 用户名格式化工具函数
const formatUserName = {
  /**
   * 验证用户名格式（必须包含 first name 和 last name）
   */
  validate: (input: string): boolean => {
    const trimmed = input.trim();
    if (!trimmed) return false;
    
    // 支持两种格式：
    // 1. "Esone Qiu" - 空格分隔
    // 2. "esone.qiu" - 点号分隔
    const parts = trimmed.includes('.') 
      ? trimmed.split('.') 
      : trimmed.split(/\s+/);
    
    // 必须至少有两个部分（first name 和 last name）
    return parts.length >= 2 && parts.every(p => p.length > 0);
  },
  
  /**
   * 转换为显示格式："Esone Qiu"
   */
  toDisplayFormat: (input: string): string => {
    const trimmed = input.trim().toLowerCase();
    
    // 分割：支持空格或点号
    const parts = trimmed.includes('.') 
      ? trimmed.split('.') 
      : trimmed.split(/\s+/);
    
    // 首字母大写
    return parts
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  },
  
  /**
   * 转换为存储格式："esone.qiu"
   */
  toStorageFormat: (input: string): string => {
    const trimmed = input.trim().toLowerCase();
    
    // 分割：支持空格或点号
    const parts = trimmed.includes('.') 
      ? trimmed.split('.') 
      : trimmed.split(/\s+/);
    
    // 用点号连接
    return parts.join('.');
  },
  
  /**
   * 将多个用户名转换为存储格式（用+连接，用于 Glip_User_Name）
   */
  joinForStorage: (displayNames: string[]): string => {
    return displayNames
      .map(name => formatUserName.toStorageFormat(name))
      .join('+');
  },
  
  /**
   * 将多个用户名转换为 mentionList 格式（用,连接，用于 AI Report）
   */
  joinForMentionList: (displayNames: string[]): string => {
    return displayNames
      .map(name => formatUserName.toStorageFormat(name))
      .join(',');
  }
};

// Tags 输入框组件
const TagsInput: React.FC<{
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  maxTags?: number;
  disabled?: boolean;
}> = ({ tags, onChange, placeholder, maxTags, disabled }) => {
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState('');
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      e.preventDefault();
      
      // 验证格式
      if (!formatUserName.validate(inputValue)) {
        setError('请输入完整的姓名（如：Esone Qiu 或 esone.qiu）');
        return;
      }
      
      if (maxTags && tags.length >= maxTags) {
        setError(`最多只能添加 ${maxTags} 个`);
        return;
      }
      
      // 转换为显示格式
      const displayName = formatUserName.toDisplayFormat(inputValue);
      
      // 检查是否已存在（避免重复）
      if (tags.includes(displayName)) {
        setError('该用户已添加');
        return;
      }
      
      onChange([...tags, displayName]);
      setInputValue('');
      setError('');
    } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      onChange(tags.slice(0, -1));
      setError('');
    }
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    if (error) setError(''); // 清除错误提示
  };
  
  const removeTag = (indexToRemove: number) => {
    onChange(tags.filter((_, index) => index !== indexToRemove));
    setError('');
  };
  
  return (
    <div>
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '8px',
        padding: '8px',
        border: `1px solid ${error ? '#dc3545' : '#ddd'}`,
        borderRadius: '4px',
        minHeight: '42px',
        backgroundColor: disabled ? '#f5f5f5' : '#fff',
      }}>
        {tags.map((tag, index) => (
          <span key={index} style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '4px 8px',
            backgroundColor: '#007bff',
            color: '#fff',
            borderRadius: '4px',
            fontSize: '14px',
          }}>
            {tag}
            <button
              onClick={() => removeTag(index)}
              disabled={disabled}
              style={{
                marginLeft: '6px',
                background: 'none',
                border: 'none',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '16px',
                padding: '0',
              }}
            >
              ×
            </button>
          </span>
        ))}
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={tags.length === 0 ? placeholder : ''}
          disabled={disabled}
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            minWidth: '120px',
            fontSize: '14px',
            backgroundColor: 'transparent',
          }}
        />
      </div>
      {error && (
        <div style={{
          color: '#dc3545',
          fontSize: '12px',
          marginTop: '4px',
        }}>
          {error}
        </div>
      )}
    </div>
  );
};

// AI Header 选项
const AVAILABLE_AI_HEADERS = [
  { value: 'Authorization', label: 'Authorization (认证)', placeholder: 'Bearer token 或 Basic xxx' },
  { value: 'Content-Type', label: 'Content-Type (内容类型)', placeholder: 'application/json' },
  { value: 'Accept', label: 'Accept (接受类型)', placeholder: 'application/json' },
  { value: 'X-API-Key', label: 'X-API-Key (API密钥)', placeholder: 'sk-xxxxxxx' },
  { value: 'User-Agent', label: 'User-Agent (用户代理)', placeholder: 'MyApp/1.0' },
  { value: 'X-Request-ID', label: 'X-Request-ID (请求ID)', placeholder: 'req-12345' },
  { value: 'X-Custom-Header', label: 'X-Custom-Header (自定义)', placeholder: '自定义值' }
];

// AI Header 类型
interface AIHeader {
  name: string;
  value: string;
}

// 新增/编辑消息对话框组件
const AddMessageDialog: React.FC<{
  onSubmit: (data: CreateMessageFormData) => void;
  onCancel: () => void;
  isSubmitting: boolean;
  botConfigured: boolean;
  timelineBotConfigured: boolean;
  outreachEnabled: boolean;
  outreachConfigured: boolean;
  onConfigureBot: (mode?: BotConfigDialogMode) => void;
  onConfigureOutreach: () => void;
  isReminderMode?: boolean;
  currentUsername?: string;
  availableCategories: SelectOption[];
  editingMessage?: ScheduledMessage | null;
}> = ({
  onSubmit,
  onCancel,
  isSubmitting,
  botConfigured,
  timelineBotConfigured,
  outreachEnabled,
  outreachConfigured,
  onConfigureBot,
  onConfigureOutreach,
  isReminderMode = false,
  currentUsername = '',
  availableCategories,
  editingMessage = null
}) => {
  const isEditMode = !!editingMessage;
  // 格式化时间为 HH:MM 格式（确保两位数）
  const formatTimeToHHMM = (time: string | undefined): string => {
    if (!time) return '';
    // 如果已经是 HH:MM 格式，直接返回
    if (/^\d{2}:\d{2}$/.test(time)) return time;
    // 如果是 H:MM 或 H:M 格式，补零
    const parts = time.split(':');
    if (parts.length === 2) {
      const hours = parts[0].padStart(2, '0');
      const minutes = parts[1].padStart(2, '0');
      return `${hours}:${minutes}`;
    }
    return time;
  };
  
  // 初始化表单数据（编辑模式时使用现有数据）
  const getInitialFormData = (): CreateMessageFormData => {
    if (editingMessage) {
      const outreachTargetType = editingMessage.Outreach_Target_Type || editingMessage.Target_Type || 'private';
      return {
        Topic: editingMessage.Topic || '',
        Content: editingMessage.Content || '',
        Schedule_Date: editingMessage.Schedule_Date || '',
        Schedule_Time: formatTimeToHHMM(editingMessage.Schedule_Time),
        Push_Method: editingMessage.Push_Method || 'AsMe',
        Target_Type: editingMessage.Outreach_Target_Type || (editingMessage.Glip_Team_ID ? 'group' : 'private'),
        Glip_User_Name: editingMessage.Glip_User_Name || '',
        Glip_Team_ID: editingMessage.Glip_Team_ID || '',
        Outreach_Target_Type: outreachTargetType,
        Outreach_Target_Ref: editingMessage.Outreach_Target_Ref || '',
        Outreach_Context: editingMessage.Outreach_Context || '',
        Outreach_Max_Followup: typeof editingMessage.Outreach_Max_Followup === 'number'
          ? editingMessage.Outreach_Max_Followup
          : editingMessage.Outreach_Max_Followup
            ? parseInt(String(editingMessage.Outreach_Max_Followup), 10)
            : undefined,
        Outreach_Followup_Interval_Hours: typeof editingMessage.Outreach_Followup_Interval_Hours === 'number'
          ? editingMessage.Outreach_Followup_Interval_Hours
          : editingMessage.Outreach_Followup_Interval_Hours
            ? parseInt(String(editingMessage.Outreach_Followup_Interval_Hours), 10)
            : undefined,
        Repeat_Every: editingMessage.Repeat_Every,
        Repeat_Unit: editingMessage.Repeat_Unit,
        Repeat_Count: editingMessage.Repeat_Count,
        End_Date: editingMessage.End_Date,
        AI_Endpoint: editingMessage.AI_Endpoint,
        AI_Headers: editingMessage.AI_Headers,
        AI_Body: editingMessage.AI_Body,
        Timeline_Project: editingMessage.Timeline_Project,
        Timeline_Milestone: editingMessage.Timeline_Milestone,
        Timeline_Offset: editingMessage.Timeline_Offset,
        Category: editingMessage.Category,
      };
    }
    return {
      Topic: '',
      Content: '',
      Schedule_Date: new Date().toISOString().split('T')[0],
      Schedule_Time: '',
      Push_Method: 'AsMe',
      Target_Type: 'private',
      Glip_User_Name: '',
      Glip_Team_ID: '',
      Outreach_Target_Type: 'private',
      Outreach_Target_Ref: '',
      Outreach_Context: '',
      Outreach_Max_Followup: 2,
      Outreach_Followup_Interval_Hours: 24
    };
  };
  
  // 初始化用户标签（编辑模式时解析现有用户名）
  const getInitialUserTags = (): string[] => {
    if (editingMessage && editingMessage.Glip_User_Name) {
      // esone.qiu+john.doe -> ['Esone Qiu', 'John Doe']
      return editingMessage.Glip_User_Name.split('+').map(name => formatUserName.toDisplayFormat(name));
    }
    return [];
  };
  
  // 初始化分类标签
  const getInitialCategoryTags = (): SelectOption[] => {
    if (editingMessage && editingMessage.Category) {
      return editingMessage.Category.split(',').map(cat => ({
        value: cat.trim(),
        label: cat.trim()
      }));
    }
    return [];
  };
  
  const [formData, setFormData] = useState<CreateMessageFormData>(getInitialFormData);
  const [userTags, setUserTags] = useState<string[]>(getInitialUserTags);
  const [isRepeating, setIsRepeating] = useState(editingMessage ? !!(editingMessage.Repeat_Every && editingMessage.Repeat_Unit) : false);
  const [aiReportTemplate, setAiReportTemplate] = useState<'ai-report' | 'pep-report' | 'multiple-jira-query' | 'custom'>(() => {
    // 编辑模式时，根据 AI_Endpoint 判断模板类型
    if (editingMessage && editingMessage.Push_Method === 'AI' && editingMessage.AI_Endpoint) {
      if (editingMessage.AI_Endpoint.includes('dify.int.rclabenv.com')) {
        return 'ai-report';
      } else if (editingMessage.AI_Endpoint.includes('pep_daily_report')) {
        return 'pep-report';
      } else if (editingMessage.AI_Endpoint.includes('multiple_jira_query_notify')) {
        return 'multiple-jira-query';
      }
      return 'custom';
    }
    return 'ai-report';
  });
  const [aiHeaders, setAiHeaders] = useState<AIHeader[]>([]);
  const [isTimelineTrigger, setIsTimelineTrigger] = useState(editingMessage ? !!(editingMessage.Timeline_Milestone && !editingMessage.Schedule_Date) : false);
  
  // 多星期选择状态（0=周日, 1=周一...6=周六）
  const [selectedWeekDays, setSelectedWeekDays] = useState<number[]>(() => {
    if (editingMessage && editingMessage.Repeat_Days && editingMessage.Repeat_Unit === 'Week') {
      return editingMessage.Repeat_Days.split(',').map(d => parseInt(d.trim(), 10)).filter(d => !isNaN(d));
    }
    // 默认根据 Schedule_Date 的星期初始化
    if (editingMessage && editingMessage.Schedule_Date) {
      const dayOfWeek = new Date(editingMessage.Schedule_Date).getDay();
      return [dayOfWeek];
    }
    return [];
  });
  
  // 解析编辑模式下 AI Report Body 的辅助函数
  const parseAiReportBody = () => {
    if (!editingMessage || editingMessage.Push_Method !== 'AI' || !editingMessage.AI_Body) {
      return {
        jql: '',
        outputs: { noduedate: false, overdue: true, toTest: false, tickets: true },
        ticketIncludes: ['summary', 'status', 'assignee', 'reporter'],
        customOutputs: [] as {name: string; prompt: string}[],
        teamId: '',
        mentionList: [] as string[],
        extraText: ''
      };
    }
    
    try {
      const body = JSON.parse(editingMessage.AI_Body);
      const inputs = body.inputs || {};
      
      // 解析 outputs
      const outputsStr = inputs.outputs || '';
      const outputsArr = outputsStr.split(',').map((s: string) => s.trim());
      
      // 解析 ticketIncludes
      const ticketIncludesStr = inputs.ticketIncludes || 'summary, status, assignee, reporter';
      const ticketIncludesArr = ticketIncludesStr.split(',').map((s: string) => s.trim());
      
      // 解析 customOutputs（格式：name1:prompt1 | prompt2）
      const customOutputsStr = inputs.customOutputs || '';
      const customOutputsArr = customOutputsStr ? customOutputsStr.split(' | ').map((item: string) => {
        const colonIndex = item.indexOf(':');
        if (colonIndex > 0) {
          return { name: item.substring(0, colonIndex), prompt: item.substring(colonIndex + 1) };
        }
        return { name: '', prompt: item };
      }) : [];
      
      // 解析 mentionList
      const mentionListStr = inputs.mentionList || '';
      const mentionListArr = mentionListStr ? mentionListStr.split(',').map((s: string) => formatUserName.toDisplayFormat(s.trim())) : [];
      
      return {
        jql: editingMessage.Content || inputs.jql || '',
        outputs: {
          noduedate: outputsArr.includes('noduedate'),
          overdue: outputsArr.includes('overdue'),
          toTest: outputsArr.includes('toTest'),
          tickets: outputsArr.includes('tickets')
        },
        ticketIncludes: ticketIncludesArr,
        customOutputs: customOutputsArr,
        teamId: editingMessage.Glip_Team_ID || inputs.teamId || '',
        mentionList: mentionListArr,
        extraText: inputs.extraText || ''
      };
    } catch (e) {
      console.error('解析 AI Report Body 失败:', e);
      return {
        jql: editingMessage.Content || '',
        outputs: { noduedate: false, overdue: true, toTest: false, tickets: true },
        ticketIncludes: ['summary', 'status', 'assignee', 'reporter'],
        customOutputs: [] as {name: string; prompt: string}[],
        teamId: editingMessage.Glip_Team_ID || '',
        mentionList: [] as string[],
        extraText: ''
      };
    }
  };
  
  const initialAiReportData = parseAiReportBody();
  
  // AI Report 可视化字段
  const [aiReportJql, setAiReportJql] = useState(initialAiReportData.jql);
  const [aiReportOutputs, setAiReportOutputs] = useState(initialAiReportData.outputs);
  const [ticketIncludes, setTicketIncludes] = useState<string[]>(initialAiReportData.ticketIncludes);
  const [customOutputs, setCustomOutputs] = useState<{name: string; prompt: string}[]>(initialAiReportData.customOutputs);
  const [showCustomOutputDialog, setShowCustomOutputDialog] = useState(false);
  const [editingCustomOutputIndex, setEditingCustomOutputIndex] = useState<number | null>(null);
  const [customOutputName, setCustomOutputName] = useState('');
  const [customOutputPrompt, setCustomOutputPrompt] = useState('');
  const [aiReportTeamId, setAiReportTeamId] = useState(initialAiReportData.teamId);
  const [aiReportMentionList, setAiReportMentionList] = useState<string[]>(initialAiReportData.mentionList);
  const [aiReportExtraText, setAiReportExtraText] = useState(initialAiReportData.extraText);
  const [pepReportTeamId, setPepReportTeamId] = useState(() => {
    // 编辑模式时，如果是 pep-report 类型，初始化 TeamID
    if (editingMessage && editingMessage.Push_Method === 'AI' && editingMessage.AI_Endpoint?.includes('pep_daily_report')) {
      return editingMessage.Glip_Team_ID || '';
    }
    return '';
  });
  const [multipleJiraQueryTeamId, setMultipleJiraQueryTeamId] = useState(() => {
    // 编辑模式时，如果是 multiple-jira-query 类型，初始化 TeamID
    if (editingMessage && editingMessage.Push_Method === 'AI' && editingMessage.AI_Endpoint?.includes('multiple_jira_query_notify')) {
      return editingMessage.Glip_Team_ID || '';
    }
    return '';
  });
  const [categoryTags, setCategoryTags] = useState<SelectOption[]>(getInitialCategoryTags);
  
  // Body 输入框的 ref，用于插入变量
  const bodyTextareaRef = useRef<HTMLTextAreaElement>(null);
  const contentTextareaRef = useRef<HTMLTextAreaElement>(null);
  const jqlTextareaRef = useRef<HTMLTextAreaElement>(null);
  
  // 提醒模式：展开高级选项的状态
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  
  // Topic 自动生成相关状态
  const [isGeneratingTopic, setIsGeneratingTopic] = useState(false);
  const generateTopicRequestIdRef = useRef<number>(0); // 用于追踪请求，处理竞态条件
  
  // 当 Content blur 时自动生成 Topic
  const handleContentBlur = async () => {
    const content = formData.Content?.trim();
    const topic = formData.Topic?.trim();
    
    // 如果 Content 为空或 Topic 已有值，不处理
    if (!content || topic) {
      return;
    }
    
    // 生成唯一请求 ID，用于处理竞态条件
    const currentRequestId = ++generateTopicRequestIdRef.current;
    setIsGeneratingTopic(true);
    
    try {
      // 构建 prompt
      const prompt = `请根据以下消息内容，生成一个简短的主题标题（不超过20个字，不要加引号或标点）：

${content}

主题：`;
      
      // 调用 LLM 生成主题
      const response = await chrome.runtime.sendMessage({
        type: 'CALL_LLM_SUMMARIZE',
        data: { prompt }
      });
      
      // 检查是否是最新的请求（处理竞态条件）
      if (currentRequestId !== generateTopicRequestIdRef.current) {
        console.log('🔄 Topic 生成请求已过期，放弃填充');
        return;
      }
      
      // 检查用户是否已经开始输入 Topic
      if (formData.Topic?.trim()) {
        console.log('📝 用户已输入 Topic，放弃自动填充');
        return;
      }
      
      if (response?.success && response.summary) {
        // 清理生成的主题（去除可能的引号、换行等）
        let generatedTopic = response.summary
          .replace(/^["'""'']+|["'""'']+$/g, '') // 去除引号
          .replace(/\n/g, ' ') // 换行替换为空格
          .trim();
        
        // 限制长度
        if (generatedTopic.length > 30) {
          generatedTopic = generatedTopic.substring(0, 30);
        }
        
        // 再次检查 Topic 是否仍为空（双重保险）
        if (!formData.Topic?.trim()) {
          handleChange('Topic', generatedTopic);
          console.log('✅ 自动生成 Topic:', generatedTopic);
        }
      }
    } catch (error) {
      console.error('❌ 自动生成 Topic 失败:', error);
    } finally {
      // 只有当前请求才能关闭 loading 状态
      if (currentRequestId === generateTopicRequestIdRef.current) {
        setIsGeneratingTopic(false);
      }
    }
  };
  
  // 提醒模式初始化（仅新建模式时生效）
  React.useEffect(() => {
    if (isReminderMode && !isEditMode) {
      // 自动填充提醒模式的数据
      handleChange('Topic', '个人提醒事项');
      handleChange('Push_Method', 'Bot');
      handleChange('Target_Type', 'private');
      
      // 填充当前用户名
      if (currentUsername) {
        const displayName = formatUserName.toDisplayFormat(currentUsername);
        setUserTags([displayName]);
      }
    }
  }, [isReminderMode, isEditMode]);
  
  // 四个模板的数据缓存（内存中，关闭页面后失效）
  const templateCacheRef = React.useRef<{
    'ai-report': { AI_Endpoint: string; AI_Headers: string; AI_Body: string };
    'pep-report': { AI_Endpoint: string; AI_Headers: string; AI_Body: string };
    'multiple-jira-query': { AI_Endpoint: string; AI_Headers: string; AI_Body: string };
    'custom': { AI_Endpoint: string; AI_Headers: string; AI_Body: string };
  }>({
    'ai-report': { AI_Endpoint: '', AI_Headers: '', AI_Body: '' },
    'pep-report': { AI_Endpoint: '', AI_Headers: '', AI_Body: '' },
    'multiple-jira-query': { AI_Endpoint: '', AI_Headers: '', AI_Body: '' },
    'custom': { AI_Endpoint: '', AI_Headers: '', AI_Body: '' }
  });
  
  // AI Report 预设值
  const aiReportPresets = {
    'ai-report': {
      AI_Endpoint: 'POST https://dify.int.rclabenv.com/v1/chat-messages',
      AI_Headers: 'Authorization: Bearer app-hTAaR1jaLnYDITixXRP5qi4Y\nContent-Type: application/json',
      AI_Body: JSON.stringify({
        response_mode: 'blocking',
        user: 'default-user',
        query: '{Topic}',
        inputs: {
          title: '{Topic}',
          outputs: 'noduedate, overdue, toTest, tickets',
          jql: '{Content}',
          extraText: '',
          teamId: '{TeamID}',
          mentionList: '',
          ticketIncludes: 'summary, status, assignee, reporter'
        }
      }, null, 2)
    },
    'pep-report': {
      AI_Endpoint: 'POST https://gitlab-reviewer.int.rclabenv.com/pep_daily_report',
      AI_Headers: 'Content-Type: application/json',
      AI_Body: JSON.stringify({
        jql: '',
        jira_query_id: 111,
        sheet_id: '',
        sheet_name: '',
        team_id: '{TeamID}',
        mention_list: [],
        overallFilterId: '',
        bugFilterid: '',
        ignore_due_soon: true,
        force_running: true,
        missing_due_check_scope: 'all',
        language: '',
        milestones: [
          {
            abbreviation: 'MR',
            full_name: 'Code Merge',
            goal: '提测所有功能及安排在本Release的Production Bug'
          },
          {
            abbreviation: 'FF',
            full_name: 'Feature Freeze',
            goal: '1）完成所有功能测试；2）完成安排在本Release的所有Production和Release Bug (接近FF 2天内的P2 bug可以Regression阶段修复）'
          },
          {
            abbreviation: 'CF',
            full_name: 'Code Freeze',
            goal: '完成所有本Release的功能开发、测试和Bug修复。完成Sign off。提供Dogfooding Build'
          }
        ]
      }, null, 2)
    },
    'multiple-jira-query': {
      AI_Endpoint: 'POST https://pep.int.rclabenv.com/multiple_jira_query_notify',
      AI_Headers: 'Content-Type: application/json',
      AI_Body: JSON.stringify({
        team_id: '{TeamID}',
        queries: [
          {
            query_id: 2253,
            intro_text: 'High priority issues:',
            mention: ['reporter', 'assignee'],
            show_status: true
          },
          {
            query: 'project = RCVR AND status = Open',
            intro_text: 'Open RCVR issues:',
            mention: ['firstof(assignee, reporter)']
          }
        ]
      }, null, 2)
    }
  };
  
  // 处理模板切换
  const handleTemplateChange = (newTemplate: 'ai-report' | 'pep-report' | 'multiple-jira-query' | 'custom') => {
    // 保存当前模板的数据到缓存
    if (aiReportTemplate === 'ai-report') {
      // ai-report 使用可视化字段，不需要保存 Body
      templateCacheRef.current[aiReportTemplate] = {
        AI_Endpoint: formData.AI_Endpoint || '',
        AI_Headers: formData.AI_Headers || '',
        AI_Body: '' // ai-report 的 Body 会动态生成
      };
    } else {
      templateCacheRef.current[aiReportTemplate] = {
        AI_Endpoint: formData.AI_Endpoint || '',
        AI_Headers: formData.AI_Headers || '',
        AI_Body: formData.AI_Body || ''
      };
    }
    
    // 切换到新模板
    setAiReportTemplate(newTemplate);
    
    // 如果新模板有预设值且缓存为空，使用预设值
    if (newTemplate === 'ai-report' && !templateCacheRef.current['ai-report'].AI_Endpoint) {
      const headersStr = aiReportPresets['ai-report'].AI_Headers;
      handleChange('AI_Endpoint', aiReportPresets['ai-report'].AI_Endpoint);
      handleChange('AI_Headers', headersStr);
      // ai-report 的 Body 会通过可视化字段自动生成，不需要手动设置
      setAiHeaders(parseHeadersString(headersStr));
    } else if (newTemplate === 'pep-report' && !templateCacheRef.current['pep-report'].AI_Endpoint) {
      const headersStr = aiReportPresets['pep-report'].AI_Headers;
      handleChange('AI_Endpoint', aiReportPresets['pep-report'].AI_Endpoint);
      handleChange('AI_Headers', headersStr);
      handleChange('AI_Body', aiReportPresets['pep-report'].AI_Body);
      setAiHeaders(parseHeadersString(headersStr));
    } else if (newTemplate === 'multiple-jira-query' && !templateCacheRef.current['multiple-jira-query']?.AI_Endpoint) {
      const headersStr = aiReportPresets['multiple-jira-query'].AI_Headers;
      handleChange('AI_Endpoint', aiReportPresets['multiple-jira-query'].AI_Endpoint);
      handleChange('AI_Headers', headersStr);
      handleChange('AI_Body', aiReportPresets['multiple-jira-query'].AI_Body);
      setAiHeaders(parseHeadersString(headersStr));
    } else {
      // 从缓存恢复数据
      const cached = templateCacheRef.current[newTemplate];
      handleChange('AI_Endpoint', cached.AI_Endpoint);
      handleChange('AI_Headers', cached.AI_Headers);
      if (newTemplate !== 'ai-report') {
        handleChange('AI_Body', cached.AI_Body);
      }
      if (newTemplate === 'custom') {
        setAiHeaders(parseHeadersString(cached.AI_Headers));
      }
    }
  };
  
  // 构建 AI Report Body JSON
  const buildAiReportBody = (): string => {
    const outputs = Object.entries(aiReportOutputs)
      .filter(([, enabled]) => enabled)
      .map(([key]) => key)
      .join(', ');
    
    const inputs: any = {
      title: '{Topic}',
      outputs: outputs,
      jql: '{Content}',
      extraText: aiReportExtraText,
      teamId: '{TeamID}',
      mentionList: formatUserName.joinForMentionList(aiReportMentionList)
    };
    
    // 如果选择了列出JQL查询结果，添加 ticketIncludes（逗号分隔字符串）
    if (aiReportOutputs.tickets) {
      inputs.ticketIncludes = ticketIncludes.join(', ');
    }
    
    // 如果有自定义版块，添加 customOutputs（格式：name1:prompt1 | prompt2）
    if (customOutputs.length > 0) {
      inputs.customOutputs = customOutputs
        .map(output => output.name ? `${output.name}:${output.prompt}` : output.prompt)
        .join(' | ');
    }
    
    return JSON.stringify({
      response_mode: 'blocking',
      user: 'default-user',
      query: '{Topic}',
      inputs: inputs
    }, null, 2);
  };
  
  // 解析 headers 字符串为数组
  const parseHeadersString = (headersStr: string): AIHeader[] => {
    if (!headersStr) return [];
    const lines = headersStr.split('\n');
    const headers: AIHeader[] = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      
      const colonIndex = trimmed.indexOf(':');
      if (colonIndex === -1) continue;
      
      const name = trimmed.substring(0, colonIndex).trim();
      const value = trimmed.substring(colonIndex + 1).trim();
      
      if (name && value) {
        headers.push({ name, value });
      }
    }
    
    return headers;
  };
  
  // 将 headers 数组转换为字符串
  const formatHeadersToString = (headers: AIHeader[]): string => {
    return headers
      .filter(h => h.name && h.value)
      .map(h => `${h.name}: ${h.value}`)
      .join('\n');
  };
  
  // 当 Push_Method 切换到 AI 时，初始化模板（仅新建模式时）
  React.useEffect(() => {
    if (formData.Push_Method === 'AI' && !formData.AI_Endpoint && !isEditMode) {
      setAiReportTemplate('ai-report');
      const headersStr = aiReportPresets['ai-report'].AI_Headers;
      handleChange('AI_Endpoint', aiReportPresets['ai-report'].AI_Endpoint);
      handleChange('AI_Headers', headersStr);
      // ai-report 模板不需要初始化 AI_Body，会通过可视化字段动态生成
      setAiHeaders(parseHeadersString(headersStr));
    }
  }, [formData.Push_Method, isEditMode]);
  
  // 编辑模式下，初始化 AI Headers
  React.useEffect(() => {
    if (isEditMode && editingMessage?.AI_Headers) {
      setAiHeaders(parseHeadersString(editingMessage.AI_Headers));
    }
  }, [isEditMode, editingMessage]);
  
  // 当 ai-report 的可视化字段变化时，自动更新 Content 和 AI_Body
  React.useEffect(() => {
    if (formData.Push_Method === 'AI' && aiReportTemplate === 'ai-report') {
      // 同步 JQL 到 Content
      handleChange('Content', aiReportJql);
      // 动态构建 AI_Body
      handleChange('AI_Body', buildAiReportBody());
    }
  }, [aiReportJql, aiReportOutputs, aiReportTeamId, aiReportMentionList, aiReportExtraText, ticketIncludes, customOutputs]);
  
  // Header 管理函数
  const addAIHeader = () => {
    setAiHeaders([...aiHeaders, { name: '', value: '' }]);
  };
  
  const updateAIHeaderName = (index: number, name: string) => {
    const newHeaders = [...aiHeaders];
    newHeaders[index].name = name;
    setAiHeaders(newHeaders);
    handleChange('AI_Headers', formatHeadersToString(newHeaders));
  };
  
  const updateAIHeaderValue = (index: number, value: string) => {
    const newHeaders = [...aiHeaders];
    newHeaders[index].value = value;
    setAiHeaders(newHeaders);
    handleChange('AI_Headers', formatHeadersToString(newHeaders));
  };
  
  const removeAIHeader = (index: number) => {
    const newHeaders = aiHeaders.filter((_, i) => i !== index);
    setAiHeaders(newHeaders);
    handleChange('AI_Headers', formatHeadersToString(newHeaders));
  };
  
  // 检查是否是项目变量
  const isProjectVariable = (variable: string) => {
    const projectVariables = [
      '{currentRelease}',
      '{currentPhase}',
      '{currentPhaseStartDate}',
      '{currentPhaseStartedWorkdays}',
      '{nextPhase}',
      '{nextPhaseStartDate}',
      '{nextPhaseCountdownWorkdays}'
    ];
    return projectVariables.includes(variable);
  };
  
  // 检查内容中是否包含项目变量
  const hasProjectVariables = () => {
    const content = formData.Content || '';
    const aiBody = formData.AI_Body || '';
    const topic = formData.Topic || '';
    const combinedText = content + aiBody + topic;
    
    const projectVariables = [
      '{currentRelease}',
      '{currentPhase}',
      '{currentPhaseStartDate}',
      '{currentPhaseStartedWorkdays}',
      '{nextPhase}',
      '{nextPhaseStartDate}',
      '{nextPhaseCountdownWorkdays}'
    ];
    
    return projectVariables.some(v => combinedText.includes(v));
  };
  
  // 插入变量到 Body 输入框
  const insertVariableToBody = (variable: string) => {
    const textarea = bodyTextareaRef.current;
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = formData.AI_Body || '';
    const newText = text.substring(0, start) + variable + text.substring(end);
    
    handleChange('AI_Body', newText);
    
    // 如果插入的是项目变量，自动设置默认项目（如果还没设置）
    if (isProjectVariable(variable) && !formData.Timeline_Project) {
      handleChange('Timeline_Project', DEFAULT_TIMELINE_PROJECT);
    }
    
    // 设置光标位置到插入变量之后
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + variable.length, start + variable.length);
    }, 0);
  };
  
  // 插入变量到消息内容输入框
  const insertVariableToContent = (variable: string) => {
    const textarea = contentTextareaRef.current;
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = formData.Content || '';
    const newText = text.substring(0, start) + variable + text.substring(end);
    
    handleChange('Content', newText);
    
    // 如果插入的是项目变量，自动设置默认项目（如果还没设置）
    if (isProjectVariable(variable) && !formData.Timeline_Project) {
      handleChange('Timeline_Project', DEFAULT_TIMELINE_PROJECT);
    }
    
    // 设置光标位置到插入变量之后
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + variable.length, start + variable.length);
    }, 0);
  };
  
  // 插入变量到 JQL 输入框
  const insertVariableToJql = (variable: string) => {
    const textarea = jqlTextareaRef.current;
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = aiReportJql || '';
    const newText = text.substring(0, start) + variable + text.substring(end);
    
    setAiReportJql(newText);
    
    // 如果插入的是项目变量，自动设置默认项目（如果还没设置）
    if (isProjectVariable(variable) && !formData.Timeline_Project) {
      handleChange('Timeline_Project', DEFAULT_TIMELINE_PROJECT);
    }
    
    // 设置光标位置到插入变量之后
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + variable.length, start + variable.length);
    }, 0);
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // 提醒模式：检查 Bot 是否已配置
    if (isReminderMode && !botConfigured) {
      alert('请先配置 Bot 推送功能才能创建个人提醒');
      return;
    }
    
    // 验证必填字段
    if (!formData.Topic) {
      alert('请填写消息主题');
      return;
    }
    
    // 验证触发方式
    if (isTimelineTrigger) {
      const requiresTimelineSync = formData.Push_Method !== 'AsMe';

      // Timeline 触发验证：必须先配置执行 rule
      if (!botConfigured) {
        alert('Timeline 触发功能需要先配置 Bot 推送（需要通过 Jira Automation 规则访问 Release 信息）');
        return;
      }

      if (requiresTimelineSync && !timelineBotConfigured) {
        alert('Timeline 触发功能需要先补齐 Timeline Sync Rule，相关消息才能按项目 Milestone 触发。');
        return;
      }
      
      if (!formData.Timeline_Project || !formData.Timeline_Milestone || formData.Timeline_Offset === undefined) {
        alert('请完整填写 Timeline 触发配置');
        return;
      }
    } else {
      // 时间触发验证
      if (!formData.Schedule_Date) {
        alert('请填写执行日期');
        return;
      }
    }
    
    // 验证推送目标
    if (formData.Push_Method === 'Outreach') {
      if (!outreachEnabled) {
        alert('主动询问引擎尚未开启，请先到 Options 页面启用后再创建 Outreach 模板。');
        return;
      }

      if (!outreachConfigured) {
        alert('主动询问依赖的 RingCentral 配置尚未完成，请先到 Options 页面补齐后再创建 Outreach 模板。');
        return;
      }

      if (!formData.Outreach_Target_Type) {
        alert('请填写主动询问目标类型');
        return;
      }

      if (!formData.Outreach_Target_Ref || !formData.Outreach_Target_Ref.trim()) {
        alert('请填写主动询问目标');
        return;
      }

      const normalizedTargetRef = formData.Outreach_Target_Ref.trim().toLowerCase();
      const normalizedCurrentUsername = currentUsername.trim().toLowerCase();
      const targetsSelf =
        formData.Outreach_Target_Type !== 'group' &&
        (
          normalizedTargetRef === 'user' ||
          normalizedTargetRef === 'me' ||
          normalizedTargetRef === 'self' ||
          (normalizedCurrentUsername.length > 0 && normalizedTargetRef === normalizedCurrentUsername)
        );
      if (targetsSelf) {
        alert('主动询问只用于对外询问，不应把自己作为目标。请改用“提醒我”或等待决策中心处理。');
        return;
      }

      if (!formData.Outreach_Context || !formData.Outreach_Context.trim()) {
        alert('请填写主动询问上下文');
        return;
      }

      if (formData.Outreach_Max_Followup === undefined || formData.Outreach_Max_Followup < 0) {
        alert('请填写有效的最大追问次数');
        return;
      }

      if (!formData.Outreach_Followup_Interval_Hours || formData.Outreach_Followup_Interval_Hours < 1) {
        alert('请填写有效的追问间隔（小时）');
        return;
      }
    } else if (formData.Push_Method === 'AI') {
      // AI 消息验证
      if (aiReportTemplate === 'ai-report') {
        // ai-report 模板验证 JQL
        if (!aiReportJql.trim()) {
          alert('请填写 JQL 查询');
          return;
        }
      } else {
        // 其他模板验证 Content 和 Body
        if (!formData.Content) {
          alert('请填写消息内容');
          return;
        }
        if (!formData.AI_Endpoint || !formData.AI_Body) {
          alert('请填写 AI Endpoint 和 Body');
          return;
        }
      }
    } else {
      // Bot/AsMe 消息验证
      if (!formData.Content) {
        alert('请填写消息内容');
        return;
      }
      
      // 非提醒模式才需要验证推送目标（提醒模式已自动配置）
      if (!isReminderMode && formData.Push_Method !== 'JiraAutomation') {
        if (formData.Target_Type === 'private' && userTags.length === 0) {
          alert('请至少添加一个接收人');
          return;
        }
        
        if (formData.Target_Type === 'group' && !formData.Glip_Team_ID) {
          alert('请填写群组 ID');
          return;
        }
      }
    }
    
    // 验证周期性消息
    if (isRepeating) {
      if (!formData.Repeat_Every || !formData.Repeat_Unit) {
        alert('请完整填写重复设置');
        return;
      }
      // 验证周模式下必须选择至少一天
      if (formData.Repeat_Unit === 'Week' && selectedWeekDays.length === 0) {
        alert('请至少选择一个执行的星期');
        return;
      }
    }
    
    // 合并 userTags 到 Glip_User_Name（转换为存储格式：esone.qiu+john.doe）
    // 注意：不传递 Target_Type，由 AppScript 动态判断
    
    // 处理 AI Report 的 Glip_Team_ID
    let glipTeamId = formData.Glip_Team_ID;
    if (formData.Push_Method === 'AI') {
      if (aiReportTemplate === 'ai-report') {
        // ai-report 模板：使用可视化输入框的值
        glipTeamId = aiReportTeamId;
      } else if (aiReportTemplate === 'pep-report') {
        // pep-report 模板：使用专用的输入框值
        glipTeamId = pepReportTeamId;
      } else if (aiReportTemplate === 'multiple-jira-query') {
        // multiple-jira-query 模板：使用专用的输入框值
        glipTeamId = multipleJiraQueryTeamId;
      }
      // custom 模板：不处理，用户自己负责
    }
    
    const finalFormData: CreateMessageFormData = {
      ...formData,
      Target_Type: formData.Push_Method === 'Outreach'
        ? formData.Outreach_Target_Type || 'private'
        : formData.Target_Type,
      Glip_User_Name: formData.Push_Method === 'AI' || formData.Push_Method === 'Outreach'
        ? undefined
        : formatUserName.joinForStorage(userTags),
      Glip_Team_ID: formData.Push_Method === 'Outreach'
        ? undefined
        : glipTeamId,
      Outreach_Target_Type: formData.Push_Method === 'Outreach'
        ? formData.Outreach_Target_Type || 'private'
        : undefined,
      Outreach_Target_Ref: formData.Push_Method === 'Outreach'
        ? formData.Outreach_Target_Ref?.trim()
        : undefined,
      Outreach_Context: formData.Push_Method === 'Outreach'
        ? formData.Outreach_Context?.trim()
        : undefined,
      Outreach_Max_Followup: formData.Push_Method === 'Outreach'
        ? formData.Outreach_Max_Followup
        : undefined,
      Outreach_Followup_Interval_Hours: formData.Push_Method === 'Outreach'
        ? formData.Outreach_Followup_Interval_Hours
        : undefined,
      AI_Endpoint: formData.Push_Method === 'Outreach' ? undefined : formData.AI_Endpoint,
      AI_Headers: formData.Push_Method === 'Outreach' ? undefined : formData.AI_Headers,
      AI_Body: formData.Push_Method === 'Outreach' ? undefined : formData.AI_Body,
      Automation_Link: formData.Push_Method === 'Outreach' ? undefined : formData.Automation_Link,
      Repeat_Every: isRepeating ? formData.Repeat_Every : undefined,
      Repeat_Unit: isRepeating ? formData.Repeat_Unit : undefined,
      Repeat_Count: isRepeating && formData.Repeat_Unit !== 'Week' ? formData.Repeat_Count : undefined,
      Repeat_Days: isRepeating && formData.Repeat_Unit === 'Week' && selectedWeekDays.length > 0
        ? selectedWeekDays.join(',')
        : undefined,
      End_Date: isRepeating ? formData.End_Date : undefined,
      Category: categoryTags.length > 0 ? categoryTags.map(t => t.value).join(',') : undefined,
    };
    
    onSubmit(finalFormData);
  };
  
  const handleChange = (field: keyof CreateMessageFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };
  
  const handleUserTagsChange = (tags: string[]) => {
    setUserTags(tags);
  };
  
  return (
    <div style={dialogStyles.overlay}>
      <div style={dialogStyles.dialog}>
        <div style={dialogStyles.header}>
          <h2 style={dialogStyles.title}>
            {isEditMode ? '✏️ 编辑定时消息' : isReminderMode ? '⏰ 新增个人提醒' : '➕ 新增定时消息'}
          </h2>
          <button style={dialogStyles.closeButton} onClick={onCancel}>✕</button>
        </div>
        
        <form onSubmit={handleSubmit} style={dialogStyles.form}>
          {/* 提醒模式说明 */}
          {isReminderMode && (
            <div style={{
              padding: '12px 16px',
              backgroundColor: '#e7f3ff',
              borderRadius: '8px',
              marginBottom: '16px',
              border: '1px solid #b3d7ff',
            }}>
              <div style={{ fontSize: '14px', color: '#0066cc', lineHeight: '1.6' }}>
                <strong>💡 个人提醒模式</strong>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px' }}>
                  此模式会通过 Bot 向您发送私信提醒，无需配置推送方式和接收人。
                </p>
              </div>
            </div>
          )}
          
          {/* 消息内容（提醒模式始终显示） */}
          {!(formData.Push_Method === 'AI' && aiReportTemplate === 'ai-report' && !isReminderMode) && (
            <div style={dialogStyles.formGroup}>
              <label style={dialogStyles.label}>消息内容 *</label>
              <textarea 
                ref={contentTextareaRef}
                style={dialogStyles.textarea}
                value={formData.Content}
                onChange={(e) => handleChange('Content', e.target.value)}
                onBlur={handleContentBlur}
                placeholder={isReminderMode ? "输入提醒内容" : "输入消息内容"}
                rows={4}
              />
              {/* 提醒模式下隐藏变量选择器，AsMe 模式也隐藏（无法获取 releaseInfo）*/}
              {!isReminderMode && formData.Push_Method !== 'AsMe' && (
                <VariableSelector 
                  onInsert={insertVariableToContent}
                  excludeVariables={['{Topic}', '{Content}', '{TeamID}']}
                />
              )}
            </div>
          )}
          
          {/* 提醒模式：高级选项折叠容器 */}
          {isReminderMode && (
            <div 
              style={{
                overflow: 'hidden',
                transition: 'max-height 0.3s ease-in-out, opacity 0.3s ease-in-out',
                maxHeight: showAdvancedOptions ? '2000px' : '0px',
                opacity: showAdvancedOptions ? 1 : 0,
              }}
            >
              {/* 变量选择器（AsMe 模式隐藏，无法获取 releaseInfo）*/}
              {!(formData.Push_Method === 'AI' && aiReportTemplate === 'ai-report') && formData.Push_Method !== 'AsMe' && (
                <div style={dialogStyles.formGroup}>
                  <VariableSelector 
                    onInsert={insertVariableToContent}
                    excludeVariables={['{Topic}', '{Content}', '{TeamID}']}
                  />
                </div>
              )}
              
              {/* 消息主题 */}
              <div style={dialogStyles.formGroup}>
                <label style={dialogStyles.label}>
                  消息主题（可选）
                  {isGeneratingTopic && (
                    <span style={{ marginLeft: '8px', color: '#007bff', fontSize: '12px' }}>
                      ✨ AI 生成中...
                    </span>
                  )}
                </label>
                <input 
                  style={dialogStyles.input}
                  type="text"
                  value={formData.Topic}
                  onChange={(e) => {
                    handleChange('Topic', e.target.value);
                    // 用户开始输入时，取消正在进行的自动生成
                    if (e.target.value.trim()) {
                      generateTopicRequestIdRef.current++;
                      setIsGeneratingTopic(false);
                    }
                  }}
                  placeholder={isGeneratingTopic ? "AI 正在生成主题..." : "输入消息主题"}
                />
              </div>
              
              {/* 触发类型选择 */}
              <div style={dialogStyles.formGroup}>
                <label style={dialogStyles.label}>触发方式 *</label>
                <div style={dialogStyles.buttonGroup}>
                  <button
                    type="button"
                    style={getButtonStyle(!isTimelineTrigger)}
                    onClick={() => {
                      setIsTimelineTrigger(false);
                      handleChange('Schedule_Date', new Date().toISOString().split('T')[0]);
                      handleChange('Timeline_Project', undefined);
                      handleChange('Timeline_Milestone', undefined);
                      handleChange('Timeline_Offset', undefined);
                    }}
                  >
                    ⏰ 时间触发
                  </button>
                  <button
                    type="button"
                    style={getButtonStyle(isTimelineTrigger)}
                    onClick={() => {
                      setIsTimelineTrigger(true);
                      handleChange('Schedule_Date', '');
                      handleChange('Timeline_Project', DEFAULT_TIMELINE_PROJECT);
                      handleChange('Timeline_Milestone', 'FF');
                      handleChange('Timeline_Offset', 0);
                    }}
                  >
                    📅 Timeline 触发
                  </button>
                </div>
              </div>
              
              {/* 是否重复推送（仅时间触发） */}
              {!isTimelineTrigger && (
                <div style={dialogStyles.formGroup}>
                  <label style={{...dialogStyles.label, display: 'flex', alignItems: 'center', cursor: 'pointer'}}>
                    <input 
                      type="checkbox"
                      checked={isRepeating}
                      onChange={(e) => {
                        setIsRepeating(e.target.checked);
                        if (e.target.checked) {
                          handleChange('Repeat_Every', 1);
                          handleChange('Repeat_Unit', 'Week');
                        }
                      }}
                      style={{marginRight: '8px'}}
                    />
                    是否重复推送
                  </label>
                </div>
              )}
            </div>
          )}
          
          {/* 非提醒模式：正常显示消息主题和触发方式 */}
          {!isReminderMode && (
            <>
              {/* 消息主题 */}
              <div style={dialogStyles.formGroup}>
                <label style={dialogStyles.label}>
                  消息主题 *
                  {isGeneratingTopic && (
                    <span style={{ marginLeft: '8px', color: '#007bff', fontSize: '12px', fontWeight: 'normal' }}>
                      ✨ AI 生成中...
                    </span>
                  )}
                </label>
                <input 
                  style={dialogStyles.input}
                  type="text"
                  value={formData.Topic}
                  onChange={(e) => {
                    handleChange('Topic', e.target.value);
                    // 用户开始输入时，取消正在进行的自动生成
                    if (e.target.value.trim()) {
                      generateTopicRequestIdRef.current++;
                      setIsGeneratingTopic(false);
                    }
                  }}
                  placeholder={isGeneratingTopic ? "AI 正在生成主题..." : "输入消息主题"}
                />
              </div>
              
              {/* 触发类型选择 */}
              <div style={dialogStyles.formGroup}>
                <label style={dialogStyles.label}>触发方式 *</label>
                <div style={dialogStyles.buttonGroup}>
                  <button
                    type="button"
                    style={getButtonStyle(!isTimelineTrigger)}
                    onClick={() => {
                      setIsTimelineTrigger(false);
                      handleChange('Schedule_Date', new Date().toISOString().split('T')[0]);
                      handleChange('Timeline_Project', undefined);
                      handleChange('Timeline_Milestone', undefined);
                      handleChange('Timeline_Offset', undefined);
                    }}
                  >
                    ⏰ 时间触发
                  </button>
                  <button
                    type="button"
                    style={getButtonStyle(isTimelineTrigger)}
                    onClick={() => {
                      setIsTimelineTrigger(true);
                      handleChange('Schedule_Date', '');
                      handleChange('Timeline_Project', DEFAULT_TIMELINE_PROJECT);
                      handleChange('Timeline_Milestone', 'FF');
                      handleChange('Timeline_Offset', 0);
                    }}
                  >
                    📅 Timeline 触发
                  </button>
                </div>
              </div>
            </>
          )}
          
          {/* 时间触发：执行日期 */}
          {!isTimelineTrigger && (
            <div style={dialogStyles.formRow}>
              <div style={dialogStyles.formGroup}>
                <label style={dialogStyles.label}>执行日期 *</label>
                <input 
                  style={dialogStyles.input}
                  type="date"
                  value={formData.Schedule_Date || ''}
                  onChange={(e) => handleChange('Schedule_Date', e.target.value)}
                />
              </div>
              
              <div style={dialogStyles.formGroup}>
                <label style={dialogStyles.label}>执行时间</label>
                <input 
                  style={dialogStyles.input}
                  type="time"
                  value={formData.Schedule_Time || ''}
                  onChange={(e) => handleChange('Schedule_Time', e.target.value)}
                  placeholder="09:00"
                />
                <small style={dialogStyles.hint}>留空则每日早上 9 点左右推送</small>
              </div>
            </div>
          )}
          
          {/* Timeline 触发：项目和 Milestone 配置 */}
          {isTimelineTrigger && (
            <div style={{...dialogStyles.section, backgroundColor: '#f0f7ff', padding: '16px', borderRadius: '8px', marginBottom: '16px'}}>
              {/* Timeline 模式 Bot 配置检查 */}
              {(!botConfigured || (formData.Push_Method !== 'AsMe' && !timelineBotConfigured)) && (
                <div style={{
                  padding: '12px',
                  backgroundColor: '#fff3cd',
                  borderRadius: '6px',
                  border: '1px solid #ffc107',
                  marginBottom: '16px',
                }}>
                  <p style={{ margin: '0 0 10px 0', color: '#856404', fontSize: '14px' }}>
                    {!botConfigured
                      ? '⚠️ Timeline 触发功能需要先配置 Bot 推送才能使用（需要通过 Jira Automation 规则访问 Release 信息）'
                      : '⚠️ 当前缺少 Timeline Sync Rule，Timeline Bot/AI 消息不会按项目 Milestone 触发，请先补齐配置。'}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      onConfigureBot(!botConfigured ? 'create' : 'upgrade-sync-only');
                    }}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#ffc107',
                      color: '#000',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: 'bold',
                    }}
                  >
                    🔧 配置 Bot 后启用
                  </button>
                </div>
              )}
              
              <div style={dialogStyles.formRow}>
                <div style={dialogStyles.formGroup}>
                  <label style={dialogStyles.label}>项目 *</label>
                  <Select<SelectOption, false>
                    options={TIMELINE_PROJECT_OPTIONS}
                    value={getTimelineProjectOption(formData.Timeline_Project)}
                    onChange={(option: SingleValue<SelectOption>) => option && handleChange('Timeline_Project', option.value)}
                    styles={singleSelectStyles}
                    isDisabled={!botConfigured || (formData.Push_Method !== 'AsMe' && !timelineBotConfigured)}
                    isSearchable={false}
                  />
                  <small style={dialogStyles.hint}>
                    新增请联系项目组所在 SDET 完善 <a href="https://heimdall-xmn02.int.rclabenv.com/api/swagger/#/bot/bot_get_release_info_retrieve" target="_blank" rel="noopener noreferrer" style={{color: '#007bff', textDecoration: 'underline'}}>API</a>
                  </small>
                </div>
                
                <div style={dialogStyles.formGroup}>
                  <label style={dialogStyles.label}>Milestone *</label>
                  <Select<SelectOption, false>
                    options={[
                      { value: 'DoR', label: '📋 DoR' },
                      { value: 'Embedded', label: '🔧 Embedded' },
                      { value: 'FF', label: '🎯 FF' },
                      { value: 'Regression', label: '🔄 Regression' },
                      { value: 'CF', label: '❄️ CF' },
                      { value: 'Release', label: '🚀 Release' }
                    ]}
                    value={{ 
                      value: formData.Timeline_Milestone || 'FF',
                      label: formData.Timeline_Milestone === 'DoR' ? '📋 DoR' :
                             formData.Timeline_Milestone === 'Embedded' ? '🔧 Embedded' :
                             formData.Timeline_Milestone === 'Regression' ? '🔄 Regression' :
                             formData.Timeline_Milestone === 'CF' ? '❄️ CF' :
                             formData.Timeline_Milestone === 'Release' ? '🚀 Release' : '🎯 FF'
                    }}
                    onChange={(option: SingleValue<SelectOption>) => option && handleChange('Timeline_Milestone', option.value)}
                    styles={singleSelectStyles}
                    isDisabled={!botConfigured || (formData.Push_Method !== 'AsMe' && !timelineBotConfigured)}
                    isSearchable={false}
                  />
                </div>
              </div>
              
              <div style={dialogStyles.formRow}>
                <div style={dialogStyles.formGroup}>
                  <label style={dialogStyles.label}>偏移天数 *</label>
                  <input 
                    style={dialogStyles.input}
                    type="number"
                    min="-30"
                    max="30"
                    value={formData.Timeline_Offset ?? 0}
                    onChange={(e) => handleChange('Timeline_Offset', parseInt(e.target.value))}
                    disabled={!botConfigured || (formData.Push_Method !== 'AsMe' && !timelineBotConfigured)}
                  />
                  <small style={dialogStyles.hint}>
                    负数=之前，0=当天，正数=之后。例如：-1 表示 Milestone 前1天，1 表示后1天
                  </small>
                </div>
                
                <div style={dialogStyles.formGroup}>
                  <label style={dialogStyles.label}>执行时间</label>
                  <input 
                    style={dialogStyles.input}
                    type="time"
                    value={formData.Schedule_Time || ''}
                    onChange={(e) => handleChange('Schedule_Time', e.target.value)}
                    placeholder="09:00"
                    disabled={!botConfigured || (formData.Push_Method !== 'AsMe' && !timelineBotConfigured)}
                  />
                  <small style={dialogStyles.hint}>留空则每日早上 9 点左右推送</small>
                </div>
              </div>
            </div>
          )}
          
          {/* 项目选择器（非 Timeline 模式下，检测到项目变量时显示）*/}
          {!isTimelineTrigger && hasProjectVariables() && formData.Push_Method !== 'AsMe' && (
            <div style={{...dialogStyles.section, backgroundColor: '#fff8e1', padding: '12px', borderRadius: '8px', marginBottom: '16px'}}>
              <div style={{marginBottom: '8px', color: '#856404', fontSize: '13px', fontWeight: '500'}}>
                💡 检测到项目变量，请选择项目
              </div>
              <div style={dialogStyles.formGroup}>
                <label style={dialogStyles.label}>项目 *</label>
                <Select<SelectOption, false>
                  options={TIMELINE_PROJECT_OPTIONS}
                  value={getTimelineProjectOption(formData.Timeline_Project)}
                  onChange={(option: SingleValue<SelectOption>) => option && handleChange('Timeline_Project', option.value)}
                  styles={singleSelectStyles}
                  isSearchable={false}
                />
                <small style={dialogStyles.hint}>
                  选择项目以替换消息中的变量（如 {'{currentRelease}'}、{'{nextPhase}'} 等）
                </small>
              </div>
            </div>
          )}
          
          {/* 是否重复 Toggle（仅非提醒模式显示，提醒模式已在高级选项中） */}
          {!isReminderMode && !isTimelineTrigger && (
            <div style={dialogStyles.formGroup}>
              <label style={{...dialogStyles.label, display: 'flex', alignItems: 'center', cursor: 'pointer'}}>
                <input 
                  type="checkbox"
                  checked={isRepeating}
                  onChange={(e) => {
                    setIsRepeating(e.target.checked);
                    if (e.target.checked) {
                      handleChange('Repeat_Every', 1);
                      handleChange('Repeat_Unit', 'Week');
                    }
                  }}
                  style={{marginRight: '8px'}}
                />
                是否重复推送
              </label>
            </div>
          )}
          
          {/* 重复设置（仅时间触发模式显示） */}
          {!isTimelineTrigger && isRepeating && (
            <div style={{...dialogStyles.section, backgroundColor: '#f8f9fa', padding: '16px', borderRadius: '8px'}}>
              <div style={dialogStyles.formRow}>
                <div style={dialogStyles.formGroup}>
                  <label style={dialogStyles.label}>每隔 *</label>
                  <input 
                    style={dialogStyles.input}
                    type="number"
                    min="1"
                    value={formData.Repeat_Every || 1}
                    onChange={(e) => handleChange('Repeat_Every', parseInt(e.target.value))}
                  />
                </div>
                
                <div style={dialogStyles.formGroup}>
                  <label style={dialogStyles.label}>重复单位 *</label>
                  <div style={dialogStyles.buttonGroup}>
                    {['Day', 'Week', 'Month', 'Year'].map((unit) => (
                      <button
                        key={unit}
                        type="button"
                        style={getButtonStyle(formData.Repeat_Unit === unit)}
                        onClick={() => {
                          handleChange('Repeat_Unit', unit);
                          // 切换到 Week 时，根据 Schedule_Date 初始化选中的星期
                          if (unit === 'Week' && formData.Schedule_Date) {
                            const dayOfWeek = new Date(formData.Schedule_Date).getDay();
                            if (selectedWeekDays.length === 0) {
                              setSelectedWeekDays([dayOfWeek]);
                            }
                          }
                        }}
                      >
                        {unit === 'Day' ? '天' : unit === 'Week' ? '周' : unit === 'Month' ? '月' : '年'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              
              <div style={dialogStyles.formRow}>
                <div style={dialogStyles.formGroup}>
                  <label style={dialogStyles.label}>结束日期（可选）</label>
                  <input 
                    style={dialogStyles.input}
                    type="date"
                    value={formData.End_Date || ''}
                    onChange={(e) => handleChange('End_Date', e.target.value)}
                  />
                </div>
                
                {/* 多星期选择器（仅当重复单位为"周"时显示，与结束日期并列） */}
                {formData.Repeat_Unit === 'Week' && (
                  <div style={dialogStyles.formGroup}>
                    <label style={dialogStyles.label}>每周几 *</label>
                    <div style={{display: 'flex', gap: '4px', flexWrap: 'wrap'}}>
                      {[
                        { day: 0, label: 'Sun' },
                        { day: 1, label: 'Mon' },
                        { day: 2, label: 'Tue' },
                        { day: 3, label: 'Wed' },
                        { day: 4, label: 'Thu' },
                        { day: 5, label: 'Fri' },
                        { day: 6, label: 'Sat' },
                      ].map(({ day, label }) => (
                        <button
                          key={day}
                          type="button"
                          style={{
                            padding: '4px 8px',
                            backgroundColor: selectedWeekDays.includes(day) ? '#007bff' : '#fff',
                            color: selectedWeekDays.includes(day) ? '#fff' : '#666',
                            border: `1px solid ${selectedWeekDays.includes(day) ? '#007bff' : '#ccc'}`,
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: selectedWeekDays.includes(day) ? '600' : 'normal',
                            transition: 'all 0.15s',
                            minWidth: '36px',
                          }}
                          onClick={() => {
                            const newSelection = selectedWeekDays.includes(day)
                              ? selectedWeekDays.filter(d => d !== day)
                              : [...selectedWeekDays, day].sort((a, b) => a - b);
                            setSelectedWeekDays(newSelection);
                            
                            // 自动调整执行日期到最近的符合条件的日期
                            if (newSelection.length > 0) {
                              const today = new Date();
                              const currentDayOfWeek = today.getDay();
                              
                              // 找今天或之后最近的一个符合条件的日期
                              for (let offset = 0; offset < 7; offset++) {
                                const checkDay = (currentDayOfWeek + offset) % 7;
                                if (newSelection.includes(checkDay)) {
                                  const targetDate = new Date(today);
                                  targetDate.setDate(today.getDate() + offset);
                                  handleChange('Schedule_Date', targetDate.toISOString().split('T')[0]);
                                  break;
                                }
                              }
                            }
                          }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* 重复次数（周模式下隐藏） */}
                {formData.Repeat_Unit !== 'Week' && (
                  <div style={dialogStyles.formGroup}>
                    <label style={dialogStyles.label}>重复次数（可选）</label>
                    <input 
                      style={dialogStyles.input}
                      type="number"
                      min="1"
                      value={formData.Repeat_Count || ''}
                      onChange={(e) => handleChange('Repeat_Count', e.target.value ? parseInt(e.target.value) : undefined)}
                      placeholder="留空表示无限"
                    />
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* 提醒模式：展开更多选项按钮 */}
          {isReminderMode && (
            <div style={{
              marginBottom: '16px',
              textAlign: 'center',
            }}>
              <button
                type="button"
                onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                style={{
                  padding: '10px 20px',
                  backgroundColor: 'transparent',
                  color: '#007bff',
                  border: '1px dashed #007bff',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  margin: '0 auto',
                  transition: 'all 0.2s ease-in-out',
                  width: '100%',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f0f7ff';
                  e.currentTarget.style.borderColor = '#0056b3';
                  e.currentTarget.style.color = '#0056b3';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.borderColor = '#007bff';
                  e.currentTarget.style.color = '#007bff';
                }}
              >
                <span style={{
                  display: 'inline-block',
                  transition: 'transform 0.3s ease-in-out',
                  transform: showAdvancedOptions ? 'rotate(180deg)' : 'rotate(0deg)',
                }}>
                  ▼
                </span>
                {showAdvancedOptions ? '收起高级选项' : '展开更多选项'}
              </button>
            </div>
          )}
          
          {/* 提醒模式：Bot 配置检查 */}
          {isReminderMode && !botConfigured && (
            <div style={{
              padding: '16px',
              backgroundColor: '#fff3cd',
              borderRadius: '8px',
              border: '1px solid #ffc107',
              marginBottom: '16px',
            }}>
              <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#856404', fontSize: '15px' }}>
                ⚠️ Bot 推送功能未配置
              </div>
              <p style={{ margin: '0 0 12px 0', color: '#856404', fontSize: '14px', lineHeight: '1.6' }}>
                个人提醒功能需要通过 Bot 发送消息。请先配置 Bot 推送功能才能使用。
              </p>
                  <button
                    type="button"
                    onClick={() => {
                      onConfigureBot();
                    }}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#ffc107',
                  color: '#000',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold',
                }}
              >
                🔧 立即配置 Bot
              </button>
            </div>
          )}
          
          {/* 非提醒模式：显示完整的推送配置 */}
          {!isReminderMode && (
            <>
           {/* 推送方式 */}
           <div style={dialogStyles.formGroup}>
             <label style={dialogStyles.label}>推送方式 *</label>
             {/* JiraAutomation 模式只显示一个选中的选项 */}
             {formData.Push_Method === 'JiraAutomation' ? (
               <div style={dialogStyles.buttonGroup}>
                 <button
                   type="button"
                   style={{
                     ...getButtonStyle(true),
                     cursor: 'default',
                   }}
                   disabled
                 >
                   🔧 JIRA 自动化
                 </button>
               </div>
             ) : (
             <div style={dialogStyles.buttonGroup}>
               <button
                 type="button"
                 style={getButtonStyle(formData.Push_Method === 'AsMe')}
                 onClick={() => handleChange('Push_Method', 'AsMe')}
               >
                 👤 AsMe（以我的身份）
               </button>
               <button
                 type="button"
                 style={getButtonStyle(formData.Push_Method === 'Bot', !botConfigured)}
                 onClick={() => handleChange('Push_Method', 'Bot')}
                 disabled={!botConfigured}
               >
                 🤖 Bot（机器人）
               </button>
               <button
                 type="button"
                 style={getButtonStyle(formData.Push_Method === 'AI', !botConfigured)}
                 onClick={() => handleChange('Push_Method', 'AI')}
                 disabled={!botConfigured}
               >
                 🤖 AI Report
               </button>
               <button
                 type="button"
                 style={getButtonStyle(formData.Push_Method === 'Outreach', !outreachEnabled || !outreachConfigured)}
                 onClick={() => {
                   handleChange('Push_Method', 'Outreach');
                   handleChange('Target_Type', formData.Outreach_Target_Type || 'private');
                   if (!formData.Outreach_Target_Type) {
                     handleChange('Outreach_Target_Type', 'private');
                   }
                   if (formData.Outreach_Max_Followup === undefined) {
                     handleChange('Outreach_Max_Followup', 2);
                   }
                   if (formData.Outreach_Followup_Interval_Hours === undefined) {
                     handleChange('Outreach_Followup_Interval_Hours', 24);
                   }
                 }}
                 disabled={!outreachEnabled || !outreachConfigured}
               >
                 💬 帮询问
               </button>
             </div>
             )}
             {formData.Push_Method === 'Bot' && !botConfigured && (
               <div style={{
                 marginTop: '12px',
                 padding: '12px',
                 backgroundColor: '#fff3cd',
                 borderRadius: '6px',
                 border: '1px solid #ffc107',
               }}>
                 <p style={{ margin: '0 0 10px 0', color: '#856404', fontSize: '14px' }}>
                   ⚠️ 您还未配置 Bot 推送功能，需要先配置才能使用。
                 </p>
                 <button
                   type="button"
                   onClick={() => {
                     onConfigureBot();
                   }}
                   style={{
                     padding: '8px 16px',
                     backgroundColor: '#ffc107',
                     color: '#000',
                     border: 'none',
                     borderRadius: '4px',
                     cursor: 'pointer',
                     fontSize: '14px',
                     fontWeight: 'bold',
                   }}
                 >
                   🔧 配置 Bot 后启用
                 </button>
               </div>
             )}
             {formData.Push_Method === 'AI' && !botConfigured && (
               <div style={{
                 marginTop: '12px',
                 padding: '12px',
                 backgroundColor: '#fff3cd',
                 borderRadius: '6px',
                 border: '1px solid #ffc107',
               }}>
                 <p style={{ margin: '0 0 10px 0', color: '#856404', fontSize: '14px' }}>
                   ⚠️ AI Report 功能需要配置 Bot 推送功能才能使用。
                 </p>
                 <button
                   type="button"
                   onClick={() => {
                     onConfigureBot();
                   }}
                   style={{
                     padding: '8px 16px',
                     backgroundColor: '#ffc107',
                     color: '#000',
                     border: 'none',
                     borderRadius: '4px',
                     cursor: 'pointer',
                     fontSize: '14px',
                     fontWeight: 'bold',
                   }}
                 >
                   🔧 配置 Bot 后启用
                 </button>
               </div>
             )}
             {formData.Push_Method === 'Outreach' && (!outreachEnabled || !outreachConfigured) && (
               <div style={{
                 marginTop: '12px',
                 padding: '12px',
                 backgroundColor: '#fff3cd',
                 borderRadius: '6px',
                 border: '1px solid #ffc107',
               }}>
                 <p style={{ margin: '0 0 10px 0', color: '#856404', fontSize: '14px' }}>
                   {!outreachEnabled
                     ? '⚠️ 主动询问引擎尚未开启，当前模板不会真正派发。'
                     : '⚠️ RingCentral 配置尚未完成，当前模板即使同步成功也无法真正发出消息。'}
                 </p>
                 <button
                   type="button"
                   onClick={onConfigureOutreach}
                   style={{
                     padding: '8px 16px',
                     backgroundColor: '#ffc107',
                     color: '#000',
                     border: 'none',
                     borderRadius: '4px',
                     cursor: 'pointer',
                     fontSize: '14px',
                     fontWeight: 'bold',
                   }}
                 >
                   🔧 前往 Options 配置主动询问
                 </button>
               </div>
             )}
           </div>
          
          {/* AI Report 配置 */}
          {formData.Push_Method === 'AI' && (
            <>
              {/* 模板选择 */}
              <div style={dialogStyles.formGroup}>
                <label style={dialogStyles.label}>报告模板 *</label>
                <Select<SelectOption, false>
                  options={[
                    { value: 'ai-report', label: '🤖 AI Report' },
                    { value: 'pep-report', label: '📊 PEP Report' },
                    { value: 'multiple-jira-query', label: '🔍 Multiple Jira Query' },
                    { value: 'custom', label: '⚙️ 自定义' }
                  ]}
                  value={{ 
                    value: aiReportTemplate, 
                    label: aiReportTemplate === 'ai-report' ? '🤖 AI Report' : 
                           aiReportTemplate === 'pep-report' ? '📊 PEP Report' : 
                           aiReportTemplate === 'multiple-jira-query' ? '🔍 Multiple Jira Query' : '⚙️ 自定义' 
                  }}
                  onChange={(option: SingleValue<SelectOption>) => option && handleTemplateChange(option.value as 'ai-report' | 'pep-report' | 'multiple-jira-query' | 'custom')}
                  styles={singleSelectStyles}
                  isSearchable={false}
                />
                {/* PEP Report 文档提示 */}
                {aiReportTemplate === 'pep-report' && (
                  <small style={{...dialogStyles.hint, marginTop: '8px'}}>
                    📖 参数说明请参考文档：
                    <a 
                      href="https://wiki.ringcentral.com/spaces/XTO/pages/958780959/PEP+Daily+Report" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{color: '#007bff', textDecoration: 'underline', marginLeft: '4px'}}
                    >
                      PEP Daily Report 文档
                    </a>
                  </small>
                )}
                {/* Multiple Jira Query 文档提示 */}
                {aiReportTemplate === 'multiple-jira-query' && (
                  <small style={{...dialogStyles.hint, marginTop: '8px'}}>
                    📖 参数说明请参考 API 文档：
                    <a 
                      href="https://pep.int.rclabenv.com/usage/multiple_jira_query_notify" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{color: '#007bff', textDecoration: 'underline', marginLeft: '4px'}}
                    >
                      Multiple Jira Query Notify
                    </a>
                  </small>
                )}
              </div>
              
              {/* AI Endpoint */}
              {(aiReportTemplate === 'custom') && (
                <div style={dialogStyles.formGroup}>
                  <label style={dialogStyles.label}>API Endpoint *</label>
                  <input 
                    style={dialogStyles.input}
                    type="text"
                    value={formData.AI_Endpoint || ''}
                    onChange={(e) => handleChange('AI_Endpoint', e.target.value)}
                    placeholder="POST https://example.com/api 或 GET https://example.com/api 或 https://example.com/api"
                  />
                  <small style={dialogStyles.hint}>格式：POST/GET URL 或仅 URL（默认为 GET）</small>
                </div>
              )}
              
              {/* AI Headers */}
              {(aiReportTemplate === 'custom') && (
                <div style={dialogStyles.formGroup}>
                  <label style={dialogStyles.label}>Headers</label>
                  <div style={{ border: '1px solid #ddd', borderRadius: '4px', padding: '12px', backgroundColor: '#f9f9f9' }}>
                    {aiHeaders.map((header, index) => (
                      <div key={index} style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'flex-start' }}>
                        <div style={{ flex: '0 0 200px' }}>
                          <Select<SelectOption, false>
                            options={AVAILABLE_AI_HEADERS.map(h => ({ value: h.value, label: h.label }))}
                            value={header.name ? { value: header.name, label: AVAILABLE_AI_HEADERS.find(h => h.value === header.name)?.label || header.name } : null}
                            onChange={(option: SingleValue<SelectOption>) => updateAIHeaderName(index, option?.value || '')}
                            placeholder="选择 Header"
                            styles={singleSelectStyles}
                            isClearable
                          />
                        </div>
                        <input
                          type="text"
                          value={header.value}
                          onChange={(e) => updateAIHeaderValue(index, e.target.value)}
                          placeholder={
                            header.name
                              ? AVAILABLE_AI_HEADERS.find(h => h.value === header.name)?.placeholder || 'Header 值'
                              : 'Header 值'
                          }
                          style={{
                            ...dialogStyles.input,
                            flex: 1,
                            marginBottom: 0
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => removeAIHeader(index)}
                          style={{
                            padding: '8px 12px',
                            backgroundColor: '#dc3545',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '14px',
                            whiteSpace: 'nowrap'
                          }}
                          title="删除此 Header"
                        >
                          🗑️
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={addAIHeader}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: '#28a745',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        width: '100%',
                        marginTop: aiHeaders.length > 0 ? '4px' : '0'
                      }}
                    >
                      ➕ 添加 Header
                    </button>
                  </div>
                  <small style={dialogStyles.hint}>
                    💡 提示：只支持预定义的 7 个 header 名称，选择后填写对应的值即可
                  </small>
                </div>
              )}
              
              {/* AI Body */}
              {aiReportTemplate === 'ai-report' ? (
                /* AI Report 可视化配置 */
                <div style={{...dialogStyles.section, backgroundColor: '#f8f9fa', padding: '16px', borderRadius: '8px'}}>
                  <h3 style={{margin: '0 0 16px 0', fontSize: '16px', fontWeight: 'bold', color: '#333'}}>
                    📊 AI Report 配置
                  </h3>
                  
                  {/* JQL 输入框 */}
                  <div style={dialogStyles.formGroup}>
                    <label style={dialogStyles.label}>JQL 查询 *</label>
                    <textarea 
                      ref={jqlTextareaRef}
                      style={dialogStyles.textarea}
                      value={aiReportJql}
                      onChange={(e) => setAiReportJql(e.target.value)}
                      placeholder='例如：project = MTR AND status = "In Progress"'
                      rows={3}
                    />
                    {/* JQL 变量选择器 - 只显示当前 Release */}
                    <div style={{
                      marginTop: '8px',
                      padding: '8px 10px',
                      backgroundColor: '#f8f9fa',
                      borderRadius: '4px',
                      border: '1px solid #e0e0e0',
                      fontSize: '12px',
                      color: '#666',
                    }}>
                      <span style={{ marginRight: '8px' }}>💡 插入变量：</span>
                      <button
                        type="button"
                        onClick={() => insertVariableToJql('{currentRelease}')}
                        style={{
                          padding: '2px 8px',
                          backgroundColor: '#e0e0e0',
                          color: '#555',
                          border: 'none',
                          borderRadius: '12px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: '500',
                          transition: 'background-color 0.2s',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#d0d0d0';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = '#e0e0e0';
                        }}
                        title="插入 {currentRelease}"
                      >
                        当前 Release
                      </button>
                    </div>
                  </div>
                  
                  {/* 版块自定义 */}
                  <div style={dialogStyles.formGroup}>
                    <label style={dialogStyles.label}>版块自定义</label>
                    <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
                      
                      {/* 列出JQL查询结果 */}
                      <label style={{display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '14px'}}>
                        <input 
                          type="checkbox"
                          checked={aiReportOutputs.tickets}
                          onChange={(e) => setAiReportOutputs({...aiReportOutputs, tickets: e.target.checked})}
                          style={{marginRight: '8px'}}
                        />
                        列出JQL查询结果
                      </label>
                      {/* ticket 字段多选 */}
                      {aiReportOutputs.tickets && (
                        <div style={{
                          marginLeft: '24px',
                          padding: '12px',
                          backgroundColor: '#f8f9fa',
                          borderRadius: '6px',
                          border: '1px solid #e0e0e0',
                        }}>
                          <div style={{fontSize: '13px', color: '#666', marginBottom: '8px'}}>
                            选择要展示的 ticket 字段：
                          </div>
                          <div style={{display: 'flex', flexWrap: 'wrap', gap: '8px'}}>
                            {[
                              { key: 'summary', label: 'Summary' },
                              { key: 'status', label: 'Status' },
                              { key: 'assignee', label: 'Assignee' },
                              { key: 'reporter', label: 'Reporter' },
                              { key: 'priority', label: 'Priority' },
                              { key: 'duedate', label: 'Due Date' },
                              { key: 'created', label: 'Created' },
                              { key: 'updated', label: 'Updated' },
                              { key: 'labels', label: 'Labels' },
                              { key: 'components', label: 'Components' },
                              { key: 'fixVersions', label: 'Fix Versions' },
                              { key: 'sprint', label: 'Sprint' },
                              { key: 'team', label: 'Team' },
                            ].map(field => (
                              <label 
                                key={field.key}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  cursor: 'pointer',
                                  fontSize: '13px',
                                  padding: '4px 8px',
                                  backgroundColor: ticketIncludes.includes(field.key) ? '#e3f2fd' : '#fff',
                                  border: `1px solid ${ticketIncludes.includes(field.key) ? '#1976d2' : '#ddd'}`,
                                  borderRadius: '4px',
                                }}
                              >
                                <input 
                                  type="checkbox"
                                  checked={ticketIncludes.includes(field.key)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setTicketIncludes([...ticketIncludes, field.key]);
                                    } else {
                                      setTicketIncludes(ticketIncludes.filter(f => f !== field.key));
                                    }
                                  }}
                                  style={{marginRight: '4px'}}
                                />
                                {field.label}
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                      <label style={{display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '14px'}}>
                        <input 
                          type="checkbox"
                          checked={aiReportOutputs.noduedate}
                          onChange={(e) => setAiReportOutputs({...aiReportOutputs, noduedate: e.target.checked})}
                          style={{marginRight: '8px'}}
                        />
                        展示没填 Duedate 的 tickets
                      </label>
                      <label style={{display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '14px'}}>
                        <input 
                          type="checkbox"
                          checked={aiReportOutputs.overdue}
                          onChange={(e) => setAiReportOutputs({...aiReportOutputs, overdue: e.target.checked})}
                          style={{marginRight: '8px'}}
                        />
                        展示 Duedate 超时的 tickets
                      </label>
                      <label style={{display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '14px'}}>
                        <input 
                          type="checkbox"
                          checked={aiReportOutputs.toTest}
                          onChange={(e) => setAiReportOutputs({...aiReportOutputs, toTest: e.target.checked})}
                          style={{marginRight: '8px'}}
                        />
                        展示待 QA 验证的 tickets
                      </label>
                      
                      {/* 已添加的自定义版块列表 */}
                      {customOutputs.map((output, index) => (
                        <div 
                          key={index}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 12px',
                            backgroundColor: '#e8f5e9',
                            borderRadius: '6px',
                            border: '1px solid #a5d6a7',
                          }}
                        >
                          <div style={{flex: 1, overflow: 'hidden'}}>
                            <div style={{fontWeight: 'bold', color: '#2e7d32', fontSize: '14px'}}>
                              {output.name ? `📋 ${output.name}` : '📋 自定义版块'}
                            </div>
                            <div style={{
                              color: '#666', 
                              fontSize: '12px', 
                              marginTop: '4px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}>
                              {output.prompt}
                            </div>
                          </div>
                          <div style={{display: 'flex', gap: '8px'}}>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingCustomOutputIndex(index);
                                setCustomOutputName(output.name);
                                setCustomOutputPrompt(output.prompt);
                                setShowCustomOutputDialog(true);
                              }}
                              style={{
                                padding: '4px 10px',
                                backgroundColor: '#fff',
                                color: '#1976d2',
                                border: '1px solid #1976d2',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '12px',
                              }}
                            >
                              编辑
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setCustomOutputs(customOutputs.filter((_, i) => i !== index));
                              }}
                              style={{
                                padding: '4px 10px',
                                backgroundColor: '#fff',
                                color: '#dc3545',
                                border: '1px solid #dc3545',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '12px',
                              }}
                            >
                              删除
                            </button>
                          </div>
                        </div>
                      ))}
                      
                      {/* 添加自定义版块按钮 */}
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCustomOutputIndex(null);
                          setCustomOutputName('');
                          setCustomOutputPrompt('');
                          setShowCustomOutputDialog(true);
                        }}
                        style={{
                          padding: '8px 16px',
                          backgroundColor: '#fff',
                          color: '#28a745',
                          border: '1px dashed #28a745',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '14px',
                          fontWeight: '500',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          marginTop: '4px',
                        }}
                      >
                        ➕ 添加自定义版块
                      </button>
                      
                      {/* 自定义版块的 ticket 字段选择器（仅当有自定义版块且未勾选"列出JQL查询结果"时显示） */}
                      {customOutputs.length > 0 && !aiReportOutputs.tickets && (
                        <div style={{
                          marginTop: '12px',
                          padding: '12px',
                          backgroundColor: '#f8f9fa',
                          borderRadius: '6px',
                          border: '1px solid #e0e0e0',
                        }}>
                          <div style={{fontSize: '13px', color: '#666', marginBottom: '8px'}}>
                            选择要提供给自定义版块分析的 ticket 字段：
                          </div>
                          <div style={{display: 'flex', flexWrap: 'wrap', gap: '8px'}}>
                            {[
                              { key: 'summary', label: 'Summary' },
                              { key: 'status', label: 'Status' },
                              { key: 'assignee', label: 'Assignee' },
                              { key: 'reporter', label: 'Reporter' },
                              { key: 'priority', label: 'Priority' },
                              { key: 'duedate', label: 'Due Date' },
                              { key: 'created', label: 'Created' },
                              { key: 'updated', label: 'Updated' },
                              { key: 'labels', label: 'Labels' },
                              { key: 'components', label: 'Components' },
                              { key: 'fixVersions', label: 'Fix Versions' },
                              { key: 'sprint', label: 'Sprint' },
                              { key: 'team', label: 'Team' },
                            ].map(field => (
                              <label 
                                key={field.key}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  cursor: 'pointer',
                                  fontSize: '13px',
                                  padding: '4px 8px',
                                  backgroundColor: ticketIncludes.includes(field.key) ? '#e3f2fd' : '#fff',
                                  border: `1px solid ${ticketIncludes.includes(field.key) ? '#1976d2' : '#ddd'}`,
                                  borderRadius: '4px',
                                }}
                              >
                                <input 
                                  type="checkbox"
                                  checked={ticketIncludes.includes(field.key)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setTicketIncludes([...ticketIncludes, field.key]);
                                    } else {
                                      setTicketIncludes(ticketIncludes.filter(f => f !== field.key));
                                    }
                                  }}
                                  style={{marginRight: '4px'}}
                                />
                                {field.label}
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* 自定义版块对话框 */}
                  {showCustomOutputDialog && (
                    <div style={{
                      position: 'fixed',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      backgroundColor: 'rgba(0, 0, 0, 0.5)',
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      zIndex: 2000,
                    }}>
                      <div style={{
                        backgroundColor: '#fff',
                        borderRadius: '12px',
                        padding: '20px',
                        maxWidth: '500px',
                        width: '90%',
                        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)',
                      }}>
                        <h3 style={{margin: '0 0 16px 0', fontSize: '18px', color: '#333'}}>
                          {editingCustomOutputIndex !== null ? '📝 编辑自定义版块' : '➕ 添加自定义版块'}
                        </h3>
                        
                        <div style={{marginBottom: '16px'}}>
                          <label style={{display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 'bold', color: '#333'}}>
                            版块名称（可选）
                          </label>
                          <input 
                            type="text"
                            value={customOutputName}
                            onChange={(e) => setCustomOutputName(e.target.value)}
                            placeholder="例如：风险分析（可留空）"
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              border: '1px solid #ddd',
                              borderRadius: '4px',
                              fontSize: '14px',
                              boxSizing: 'border-box',
                            }}
                          />
                          <small style={{display: 'block', marginTop: '4px', fontSize: '12px', color: '#999'}}>
                            留空时不会显示标题，直接输出分析结果
                          </small>
                        </div>
                        
                        <div style={{marginBottom: '16px'}}>
                          <label style={{display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 'bold', color: '#333'}}>
                            Prompt *
                          </label>
                          <textarea 
                            value={customOutputPrompt}
                            onChange={(e) => setCustomOutputPrompt(e.target.value)}
                            placeholder="例如：分析这些 tickets 中可能存在的风险点，并给出建议"
                            rows={4}
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              border: '1px solid #ddd',
                              borderRadius: '4px',
                              fontSize: '14px',
                              resize: 'vertical',
                              boxSizing: 'border-box',
                            }}
                          />
                          <small style={{display: 'block', marginTop: '4px', fontSize: '12px', color: '#999'}}>
                            描述 AI 应该如何处理这个版块的内容
                          </small>
                        </div>
                        
                        <div style={{display: 'flex', justifyContent: 'flex-end', gap: '10px'}}>
                          <button
                            type="button"
                            onClick={() => {
                              setShowCustomOutputDialog(false);
                              setEditingCustomOutputIndex(null);
                              setCustomOutputName('');
                              setCustomOutputPrompt('');
                            }}
                            style={{
                              padding: '10px 20px',
                              backgroundColor: '#6c757d',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '14px',
                            }}
                          >
                            取消
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (!customOutputPrompt.trim()) {
                                alert('请填写 Prompt');
                                return;
                              }
                              
                              const newOutput = { 
                                name: customOutputName.trim(), 
                                prompt: customOutputPrompt.trim() 
                              };
                              
                              if (editingCustomOutputIndex !== null) {
                                // 编辑模式
                                const newOutputs = [...customOutputs];
                                newOutputs[editingCustomOutputIndex] = newOutput;
                                setCustomOutputs(newOutputs);
                              } else {
                                // 添加模式
                                setCustomOutputs([...customOutputs, newOutput]);
                              }
                              
                              setShowCustomOutputDialog(false);
                              setEditingCustomOutputIndex(null);
                              setCustomOutputName('');
                              setCustomOutputPrompt('');
                            }}
                            style={{
                              padding: '10px 20px',
                              backgroundColor: '#28a745',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '14px',
                            }}
                          >
                            {editingCustomOutputIndex !== null ? '保存修改' : '添加版块'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Team ID */}
                  <div style={dialogStyles.formGroup}>
                    <label style={dialogStyles.label}>Team ID</label>
                    <input 
                      style={dialogStyles.input}
                      type="text"
                      value={aiReportTeamId}
                      onChange={(e) => setAiReportTeamId(e.target.value)}
                      placeholder="例如：148192141318"
                    />
                    <small style={dialogStyles.hint}>
                      如何获取 Team ID 请参考 <a href="https://drive.google.com/file/d/1t6KrOK7OZL3f8X2LBIM02H5OsIl38_QC/view" target="_blank" rel="noopener noreferrer" style={{color: '#007bff', textDecoration: 'underline'}}>教程</a>
                    </small>
                  </div>
                  
                  {/* @ 成员 */}
                  <div style={dialogStyles.formGroup}>
                    <label style={dialogStyles.label}>@ 成员</label>
                    <TagsInput
                      tags={aiReportMentionList}
                      onChange={setAiReportMentionList}
                      placeholder="输入人名后按 Enter 添加，例如：Esone Qiu 或 esone.qiu"
                    />
                    <small style={dialogStyles.hint}>
                      支持格式：<strong>Esone Qiu</strong> 或 <strong>esone.qiu</strong>，按 Enter 添加
                    </small>
                  </div>
                  
                  {/* 尾部添加文本 */}
                  <div style={dialogStyles.formGroup}>
                    <label style={dialogStyles.label}>尾部添加文本</label>
                    <textarea 
                      style={dialogStyles.textarea}
                      value={aiReportExtraText}
                      onChange={(e) => setAiReportExtraText(e.target.value)}
                      placeholder="可选，在报告末尾添加自定义文本"
                      rows={2}
                    />
                  </div>
                </div>
              ) : (
                /* PEP Report 和自定义模板：显示 JSON 输入框 */
                  <>
                   {/* PEP Report 专用：群组 ID 输入框 */}
                   {aiReportTemplate === 'pep-report' && (
                     <div style={dialogStyles.formGroup}>
                       <label style={dialogStyles.label}>群组 ID</label>
                       <input 
                         style={dialogStyles.input}
                         type="text"
                         value={pepReportTeamId}
                         onChange={(e) => setPepReportTeamId(e.target.value)}
                         placeholder="例如：148192141318"
                       />
                       <small style={dialogStyles.hint}>
                         如何获取 Team ID 请参考 <a href="https://drive.google.com/file/d/1t6KrOK7OZL3f8X2LBIM02H5OsIl38_QC/view" target="_blank" rel="noopener noreferrer" style={{color: '#007bff', textDecoration: 'underline'}}>教程</a>
                       </small>
                     </div>
                   )}

                   {/* Multiple Jira Query 专用：群组 ID 输入框 */}
                   {aiReportTemplate === 'multiple-jira-query' && (
                     <div style={dialogStyles.formGroup}>
                       <label style={dialogStyles.label}>群组 ID</label>
                       <input 
                         style={dialogStyles.input}
                         type="text"
                         value={multipleJiraQueryTeamId}
                         onChange={(e) => setMultipleJiraQueryTeamId(e.target.value)}
                         placeholder="例如：148192141318"
                       />
                       <small style={dialogStyles.hint}>
                         如何获取 Team ID 请参考 <a href="https://drive.google.com/file/d/1t6KrOK7OZL3f8X2LBIM02H5OsIl38_QC/view" target="_blank" rel="noopener noreferrer" style={{color: '#007bff', textDecoration: 'underline'}}>教程</a>
                       </small>
                     </div>
                   )}

                    <div style={dialogStyles.formGroup}>
                    <label style={dialogStyles.label}>Body *</label>
                    <textarea 
                      ref={bodyTextareaRef}
                      style={dialogStyles.textarea}
                      value={formData.AI_Body || ''}
                      onChange={(e) => handleChange('AI_Body', e.target.value)}
                      placeholder='{"key": "value"}'
                      rows={8}
                    />
                    {/* AI 模式支持变量插入 */}
                    <VariableSelector 
                      onInsert={insertVariableToBody}
                    />
                  </div>
                </>
              )}
            </>
          )}
          
          {/* Outreach 模板配置 */}
          {formData.Push_Method === 'Outreach' && (
            <div style={{...dialogStyles.section, backgroundColor: '#f8fbff', padding: '16px', borderRadius: '8px', border: '1px solid #d7e7ff'}}>
              <h3 style={{margin: '0 0 16px 0', fontSize: '16px', fontWeight: 'bold', color: '#1f4e79'}}>
                💬 主动询问模板
              </h3>
              
              <div style={dialogStyles.formGroup}>
                <label style={dialogStyles.label}>主动询问对象类型 *</label>
                <div style={dialogStyles.buttonGroup}>
                  <button
                    type="button"
                    style={getButtonStyle(formData.Outreach_Target_Type === 'private')}
                    onClick={() => handleChange('Outreach_Target_Type', 'private')}
                  >
                    👤 某个人
                  </button>
                  <button
                    type="button"
                    style={getButtonStyle(formData.Outreach_Target_Type === 'group')}
                    onClick={() => handleChange('Outreach_Target_Type', 'group')}
                  >
                    👥 某个群
                  </button>
                </div>
                <small style={dialogStyles.hint}>
                  这里只需要先判断“问某个人”还是“问某个群”。如果选择某个人，系统后续会自动识别成联系人或已有私聊。
                </small>
              </div>

              <div style={dialogStyles.formGroup}>
                <label style={dialogStyles.label}>
                  {formData.Outreach_Target_Type === 'group' ? '群组对象 *' : '目标对象 *'}
                </label>
                <input
                  style={dialogStyles.input}
                  type="text"
                  value={formData.Outreach_Target_Ref || ''}
                  onChange={(e) => handleChange('Outreach_Target_Ref', e.target.value)}
                  placeholder={formData.Outreach_Target_Type === 'group'
                    ? '例如：RCV Mobile VT3、54490570758 或聊天链接'
                    : '例如：AI Service、esone.qiu@ringcentral.com、1463750737922 或聊天链接'}
                />
                <small style={dialogStyles.hint}>
                  {formData.Outreach_Target_Type === 'group'
                    ? '群组模式用于“问某个群”。支持群名、群聊 chat ID，或直接粘贴 RingCentral 聊天链接；审批时仍可改目标。通过链接或 chat ID 确认过一次后，后续可直接按群名搜。'
                    : '某个人模式用于“问某个人”。支持人名、邮箱、私聊 chat ID，或直接粘贴 RingCentral 聊天链接；如果命中的是联系人，系统会自动建立或定位私聊；如果命中的是已有私聊，也会直接使用。'}
                </small>
              </div>

              <div style={dialogStyles.formGroup}>
                <label style={dialogStyles.label}>主动询问上下文 *</label>
                <textarea
                  style={dialogStyles.textarea}
                  value={formData.Outreach_Context || ''}
                  onChange={(e) => handleChange('Outreach_Context', e.target.value)}
                  placeholder="补充为什么要问、背景是什么、希望拿到什么信息"
                  rows={4}
                />
                <small style={dialogStyles.hint}>
                  这部分会帮助后续生成更稳定的问题，也方便运行态展示摘要
                </small>
              </div>

              <div style={dialogStyles.formRow}>
                <div style={dialogStyles.formGroup}>
                  <label style={dialogStyles.label}>最大追问次数 *</label>
                  <input
                    style={dialogStyles.input}
                    type="number"
                    min="0"
                    value={formData.Outreach_Max_Followup ?? 0}
                    onChange={(e) => handleChange('Outreach_Max_Followup', e.target.value ? parseInt(e.target.value, 10) : undefined)}
                  />
                  <small style={dialogStyles.hint}>留空按默认值，0 表示不追问</small>
                </div>
                <div style={dialogStyles.formGroup}>
                  <label style={dialogStyles.label}>追问间隔（小时） *</label>
                  <input
                    style={dialogStyles.input}
                    type="number"
                    min="1"
                    value={formData.Outreach_Followup_Interval_Hours ?? 24}
                    onChange={(e) => handleChange('Outreach_Followup_Interval_Hours', e.target.value ? parseInt(e.target.value, 10) : undefined)}
                  />
                  <small style={dialogStyles.hint}>用于后续自动追问的等待间隔</small>
                </div>
              </div>
            </div>
          )}
          
          {/* 推送目标（仅 Bot/AsMe 时显示，JiraAutomation / Outreach 不显示） */}
          {formData.Push_Method !== 'AI' && formData.Push_Method !== 'JiraAutomation' && formData.Push_Method !== 'Outreach' && (
            <>
              <div style={dialogStyles.formGroup}>
                <label style={dialogStyles.label}>推送目标 *</label>
                <div style={dialogStyles.buttonGroup}>
                  <button
                    type="button"
                    style={getButtonStyle(formData.Target_Type === 'private')}
                    onClick={() => handleChange('Target_Type', 'private')}
                  >
                    💬 私发消息
                  </button>
                  <button
                    type="button"
                    style={getButtonStyle(formData.Target_Type === 'group')}
                    onClick={() => handleChange('Target_Type', 'group')}
                  >
                    👥 群组消息
                  </button>
                </div>
              </div>
              
              {/* 私发消息 - 用户名 */}
              {formData.Target_Type === 'private' && (
                <div style={dialogStyles.formGroup}>
                  <label style={dialogStyles.label}>
                    接收人 * 
                    {formData.Push_Method === 'Bot' && <span style={{color: '#dc3545', marginLeft: '8px'}}>（Bot 模式只能填一个人名）</span>}
                  </label>
                  <TagsInput
                    tags={userTags}
                    onChange={handleUserTagsChange}
                    placeholder="输入人名后按 Enter 添加，例如：Esone Qiu 或 esone.qiu"
                    maxTags={formData.Push_Method === 'Bot' ? 1 : undefined}
                  />
                  <small style={dialogStyles.hint}>
                    支持格式：<strong>Esone Qiu</strong> 或 <strong>esone.qiu</strong>，按 Enter 添加
                  </small>
                </div>
              )}
              
              {/* 群组消息 - 群组 ID */}
              {formData.Target_Type === 'group' && (
                <div style={dialogStyles.formGroup}>
                  <label style={dialogStyles.label}>群组 ID *</label>
                  <input 
                    style={dialogStyles.input}
                    type="text"
                    value={formData.Glip_Team_ID || ''}
                    onChange={(e) => handleChange('Glip_Team_ID', e.target.value)}
                    placeholder="例如：148192141318"
                  />
                  <small style={dialogStyles.hint}>
                    如何获取 Team ID 请参考 <a href="https://drive.google.com/file/d/1t6KrOK7OZL3f8X2LBIM02H5OsIl38_QC/view" target="_blank" rel="noopener noreferrer" style={{color: '#007bff', textDecoration: 'underline'}}>教程</a>
                  </small>
                </div>
              )}
            </>
          )}
          </>
          )}
          
          {/* 分类标签 */}
          <div style={dialogStyles.formGroup}>
            <label style={dialogStyles.label}>类别（可选）</label>
            <CreatableSelect<SelectOption, true>
              isMulti
              options={availableCategories}
              value={categoryTags}
              onChange={(newValue: MultiValue<SelectOption>) => setCategoryTags([...newValue])}
              placeholder="选择或输入类别，按 Enter 添加..."
              styles={selectStyles}
              noOptionsMessage={() => '输入新类别并按 Enter 添加'}
              formatCreateLabel={(inputValue: string) => `创建 "${inputValue}"`}
              isClearable
            />
            <small style={dialogStyles.hint}>
              可选择已有类别，或输入新类别按 Enter 创建
            </small>
          </div>
          
          {/* 提交按钮 */}
          <div style={dialogStyles.actions}>
            <button 
              type="button" 
              style={dialogStyles.cancelButton}
              onClick={onCancel}
              disabled={isSubmitting}
            >
              取消
            </button>
            <button 
              type="submit" 
              style={dialogStyles.submitButton}
              disabled={isSubmitting}
            >
              {isSubmitting ? (isEditMode ? '保存中...' : '创建中...') : (isEditMode ? '✅ 保存修改' : '✅ 创建消息')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// 按钮选择器样式辅助函数
const getButtonStyle = (isSelected: boolean, isDisabled = false): React.CSSProperties => ({
  flex: 1,
  padding: '10px 16px',
  backgroundColor: isDisabled ? '#f5f5f5' : (isSelected ? '#007bff' : '#fff'),
  color: isDisabled ? '#999' : (isSelected ? '#fff' : '#333'),
  border: `2px solid ${isDisabled ? '#e0e0e0' : (isSelected ? '#007bff' : '#ddd')}`,
  borderRadius: '6px',
  cursor: isDisabled ? 'not-allowed' : 'pointer',
  fontSize: '14px',
  fontWeight: isSelected ? 'bold' : 'normal',
  transition: 'all 0.2s',
  opacity: isDisabled ? 0.7 : 1,
});

const getTypeStyle = (pushMethod: string): React.CSSProperties => {
  const baseStyle: React.CSSProperties = {
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 'bold',
  };
  
  switch (pushMethod) {
    case 'AI':
      return { ...baseStyle, backgroundColor: '#e3f2fd', color: '#1976d2' }; // 蓝色 - AI Report
    case 'AsMe':
      return { ...baseStyle, backgroundColor: '#f3e5f5', color: '#7b1fa2' }; // 紫色 - 假装我发的
    case 'Bot':
      return { ...baseStyle, backgroundColor: '#fff3e0', color: '#f57c00' }; // 橙色 - Bot 定时
    case 'Outreach':
      return { ...baseStyle, backgroundColor: '#e0f7fa', color: '#006064' }; // 青色 - 主动询问
    case 'JiraAutomation':
      return { ...baseStyle, backgroundColor: '#e8f5e9', color: '#388e3c' }; // 绿色 - JIRA自动化
    default:
      return { ...baseStyle, backgroundColor: '#f5f5f5', color: '#666' };
  }
};

const getStatusStyle = (status: string): React.CSSProperties => {
  const baseStyle: React.CSSProperties = {
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 'bold',
  };
  
  switch (status) {
    case 'Active':
      return { ...baseStyle, backgroundColor: '#d4edda', color: '#155724' };
    case 'Paused':
      return { ...baseStyle, backgroundColor: '#fff3cd', color: '#856404' };
    case 'Completed':
      return { ...baseStyle, backgroundColor: '#d1ecf1', color: '#0c5460' };
    case 'PendingReview':
      return { ...baseStyle, backgroundColor: '#ffe0b2', color: '#e65100' };
    default:
      return { ...baseStyle, backgroundColor: '#f5f5f5', color: '#666' };
  }
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
  },
  spinner: {
    width: '50px',
    height: '50px',
    border: '4px solid #f3f3f3',
    borderTop: '4px solid #007bff',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  topicText: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: '300px',
    display: 'inline-block',
  },
  categoryTag: {
    display: 'inline-block',
    padding: '2px 8px',
    backgroundColor: '#e7f3ff',
    color: '#007bff',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: 500,
  },
  header: {
    backgroundColor: '#fff',
    padding: '20px',
    borderBottom: '1px solid #e0e0e0',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    margin: 0,
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#333',
  },
  headerActions: {
    display: 'flex',
    gap: '10px',
  },
  reminderButton: {
    padding: '8px 16px',
    backgroundColor: '#ffc107',
    color: '#000',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold',
  },
  addButton: {
    padding: '8px 16px',
    backgroundColor: '#28a745',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
  },
  syncButton: {
    padding: '8px 16px',
    backgroundColor: '#007bff',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
  },
  updateButton: {
    padding: '8px 16px',
    backgroundColor: '#ff5722',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold',
    animation: 'pulse 2s infinite',
  },
  configButton: {
    padding: '8px 16px',
    backgroundColor: '#6c757d',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
  },
  editButton: {
    padding: '4px 8px',
    backgroundColor: 'transparent',
    color: '#007bff',
    border: '1px solid #007bff',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'all 0.2s',
  },
  jiraLinkButton: {
    padding: '4px 8px',
    backgroundColor: 'transparent',
    color: '#0052cc',
    border: '1px solid #0052cc',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'all 0.2s',
  },
  deleteButton: {
    padding: '4px 8px',
    backgroundColor: 'transparent',
    color: '#dc3545',
    border: '1px solid #dc3545',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'all 0.2s',
  },
  warningBanner: {
    backgroundColor: '#fff3cd',
    borderLeft: '4px solid #ffc107',
    padding: '16px 20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid #ffc107',
    animation: 'slideDown 0.3s ease-out',
  },
  warningContent: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    flex: 1,
  },
  warningIcon: {
    fontSize: '24px',
    lineHeight: 1,
  },
  warningText: {
    flex: 1,
  },
  warningDescription: {
    margin: '4px 0 0 0',
    fontSize: '13px',
    color: '#856404',
  },
  warningButton: {
    padding: '8px 16px',
    backgroundColor: '#ffc107',
    color: '#000',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold',
    whiteSpace: 'nowrap',
    marginLeft: '16px',
  },
  statusBar: {
    backgroundColor: '#fff',
    padding: '15px 20px',
    borderBottom: '1px solid #e0e0e0',
    display: 'flex',
    gap: '20px',
  },
  statusItem: {
    fontSize: '14px',
    color: '#666',
  },
  content: {
    padding: '20px',
  },
  emptyState: {
    textAlign: 'center',
    padding: '60px 20px',
    backgroundColor: '#fff',
    borderRadius: '8px',
  },
  emptyText: {
    fontSize: '18px',
    color: '#666',
    marginBottom: '10px',
  },
  emptyHint: {
    fontSize: '14px',
    color: '#999',
  },
  messageList: {
    backgroundColor: '#fff',
    borderRadius: '8px',
    overflow: 'hidden',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    padding: '12px',
    textAlign: 'left',
    backgroundColor: '#f8f9fa',
    borderBottom: '2px solid #e0e0e0',
    fontWeight: 'bold',
    fontSize: '14px',
    color: '#333',
  },
  tr: {
    borderBottom: '1px solid #e0e0e0',
  },
  td: {
    padding: '12px',
    fontSize: '14px',
    color: '#666',
  },
  footer: {
    padding: '20px',
    textAlign: 'center',
  },
  footerText: {
    fontSize: '12px',
    color: '#999',
  },
  tooltip: {
    position: 'fixed',
    backgroundColor: '#333',
    color: '#fff',
    padding: '8px 12px',
    borderRadius: '6px',
    fontSize: '13px',
    maxWidth: '400px',
    zIndex: 10000,
    pointerEvents: 'none',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
  },
  tooltipHeader: {
    fontWeight: 'bold',
    marginBottom: '4px',
    fontSize: '12px',
    color: '#ffc107',
  },
  tooltipContent: {
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
};

// 对话框样式
const dialogStyles: { [key: string]: React.CSSProperties } = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  dialog: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '0',
    maxWidth: '600px',
    width: '90%',
    maxHeight: '90vh',
    overflow: 'auto',
    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px',
    borderBottom: '1px solid #e0e0e0',
  },
  title: {
    margin: 0,
    fontSize: '20px',
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    background: 'transparent',
    border: 'none',
    fontSize: '24px',
    cursor: 'pointer',
    color: '#666',
    padding: '0',
    width: '30px',
    height: '30px',
  },
  form: {
    padding: '20px',
  },
  formGroup: {
    marginBottom: '16px',
    flex: '1',
  },
  formRow: {
    display: 'flex',
    gap: '16px',
  },
  section: {
    marginBottom: '16px',
  },
  buttonGroup: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  label: {
    display: 'block',
    marginBottom: '6px',
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#333',
  },
  input: {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '14px',
    boxSizing: 'border-box',
  },
  textarea: {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '14px',
    resize: 'vertical',
    boxSizing: 'border-box',
  },
  select: {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '14px',
    boxSizing: 'border-box',
  },
  hint: {
    display: 'block',
    marginTop: '4px',
    fontSize: '12px',
    color: '#999',
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    marginTop: '24px',
    paddingTop: '20px',
    borderTop: '1px solid #e0e0e0',
  },
  cancelButton: {
    padding: '10px 20px',
    backgroundColor: '#6c757d',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
  },
  submitButton: {
    padding: '10px 20px',
    backgroundColor: '#28a745',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
  },
};

// 添加 CSS 动画
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  button:hover {
    opacity: 0.9;
  }
  button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;
document.head.appendChild(styleSheet);

// Bot 配置对话框组件
const BotConfigDialog: React.FC<{
  config: SheetConfig;
  mode: BotConfigDialogMode;
  onClose: () => void;
  onSuccess: (updatedConfig: SheetConfig) => void;
}> = ({ config, mode, onClose, onSuccess }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'input' | 'testing' | 'creating'>('input');
  const [isJiraNotLoggedIn, setIsJiraNotLoggedIn] = useState(false);
  const normalizedConfig = normalizeSheetConfig(config);
  const existingExecutorRule = getExecutorRule(normalizedConfig);
  const existingTimelineSyncRule = getTimelineSyncRule(normalizedConfig);
  const existingBaseRule = existingExecutorRule || existingTimelineSyncRule;
  const isProjectConfigLocked = mode !== 'create' && Boolean(existingBaseRule?.jiraUrl && existingBaseRule?.projectKey);
  const [jiraUrl, setJiraUrl] = useState(existingBaseRule?.jiraUrl || 'https://jira.ringcentral.com');
  const [projectKey, setProjectKey] = useState(existingBaseRule?.projectKey || '');
  
  // 使用 ref 跟踪组件是否已挂载
  const isMountedRef = useRef(true);
  
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  
  // Google Auth Token 已迁移到 utils/googleAuth.ts
  // 使用 getGoogleAuthToken（会弹窗）

  const modeTitle = mode === 'upgrade-sync-only'
    ? '🤖 升级 Timeline Sync'
    : mode === 'repair'
      ? '🤖 修复 Bot 推送'
      : '🤖 配置 Bot 推送';
  const displayedJiraUrl = (isProjectConfigLocked ? existingBaseRule?.jiraUrl : jiraUrl) || jiraUrl;

  const modeDescription = mode === 'upgrade-sync-only'
    ? [
        '将补齐 Timeline Sync Rule，现有执行 rule 保持不变',
        'Jira URL 和 Project Key 将复用现有配置',
        '同步规则每天执行一次，负责刷新项目 Timeline 缓存',
        '如果是首次补齐 Timeline Sync Rule，相关消息会在下一次日同步后开始生效'
      ]
    : mode === 'repair'
      ? [
          '将只重建缺失的 Jira Automation 规则',
          '仍然存在的规则会保留，不会重复创建',
          'Jira URL 和 Project Key 将优先复用现有配置'
        ]
      : [
          '需要您在 Jira 上有管理权限的项目',
          '系统将在该项目下创建 2 条 Automation 规则',
          '执行规则每分钟检查并发送 Bot/AI 消息，Sync 规则每天刷新 Timeline 缓存',
          '首次配置后，Timeline Bot/AI 消息会在下一次日同步完成后开始生效'
        ];

  const submitLabel = mode === 'upgrade-sync-only'
    ? '✅ 补齐 Timeline Sync Rule'
    : mode === 'repair'
      ? '✅ 修复缺失规则'
      : '✅ 开始配置';
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const resolvedJiraUrl = (isProjectConfigLocked ? existingBaseRule?.jiraUrl : jiraUrl)?.trim() || '';
    const resolvedProjectKey = ((isProjectConfigLocked ? existingBaseRule?.projectKey : projectKey) || '').trim().toUpperCase();

    if (!resolvedProjectKey) {
      setError('请输入 Jira Project Key');
      return;
    }

    if (!resolvedJiraUrl) {
      setError('请输入 Jira URL');
      return;
    }
    
    setIsSubmitting(true);
    setError('');
    setIsJiraNotLoggedIn(false);
    
    try {
      // 导入服务类
      const { JiraAutomationService } = await import('./JiraAutomationService');
      const jiraService = new JiraAutomationService();
      const jiraConfig = {
        jiraUrl: resolvedJiraUrl,
        projectKey: resolvedProjectKey
      };
      
      // 步骤 1: 测试连接
      setStep('testing');
      const testResult = await jiraService.testAccess(jiraConfig);
      
      if (!testResult.success) {
        throw new Error(testResult.message);
      }
      
      // 步骤 2: 创建/修复规则
      setStep('creating');
      if (!normalizedConfig.webAppUrl) {
        throw new Error('未找到 Web App URL，请先完成定时消息初始化。');
      }

      const existingBotAutomation = {
        executorRule: existingExecutorRule,
        timelineSyncRule: existingTimelineSyncRule,
      } as BotAutomationConfig;

      let nextBotAutomation: BotAutomationConfig = existingBotAutomation;

      if (mode === 'create') {
        nextBotAutomation = await jiraService.createBotAutomationRules(jiraConfig, normalizedConfig.webAppUrl);
      } else if (mode === 'upgrade-sync-only') {
        if (!existingBotAutomation.executorRule?.ruleId) {
          throw new Error('缺少执行规则，无法仅升级 Timeline Sync Rule，请改用修复模式。');
        }

        const timelineSyncRule = existingBotAutomation.timelineSyncRule?.ruleId
          ? existingBotAutomation.timelineSyncRule
          : await jiraService.createTimelineSyncRule(jiraConfig, normalizedConfig.webAppUrl);

        nextBotAutomation = {
          ...existingBotAutomation,
          timelineSyncRule,
        };
      } else {
        nextBotAutomation = { ...existingBotAutomation };

        if (!nextBotAutomation.executorRule?.ruleId) {
          nextBotAutomation.executorRule = await jiraService.createBotExecutorRule(
            jiraConfig,
            normalizedConfig.webAppUrl
          );
        }

        if (!nextBotAutomation.timelineSyncRule?.ruleId) {
          nextBotAutomation.timelineSyncRule = await jiraService.createTimelineSyncRule(
            jiraConfig,
            normalizedConfig.webAppUrl
          );
        }
      }

      const updatedConfig = withBotAutomation(normalizedConfig, nextBotAutomation);
      
      // 使用 ConfigSyncService 同步配置到 Sheet 和 Chrome Storage
      const token = await getGoogleAuthToken({ caller: 'BotConfigDialog.handleSubmit' });
      const { ConfigSyncService } = await import('./ConfigSyncService');
      const syncService = new ConfigSyncService(token);
      await syncService.syncConfig(updatedConfig);
      
      onSuccess(updatedConfig);
      
    } catch (err: any) {
      console.error('配置 Bot 失败:', err);
      if (isMountedRef.current) {
        const errorMessage = err.message || '配置失败，请重试';
        // 检测未登录状态（通常是 401 错误或包含登录相关关键词）
        const isNotLoggedIn = errorMessage.includes('401') || 
                              errorMessage.includes('未登录') || 
                              errorMessage.includes('登录') ||
                              errorMessage.includes('Unauthorized') ||
                              errorMessage.includes('authentication') ||
                              errorMessage.includes('login');
        setIsJiraNotLoggedIn(isNotLoggedIn);
        setError(isNotLoggedIn ? 'JIRA 未登录，请先登录后再试' : errorMessage);
        setStep('input');
      }
    } finally {
      if (isMountedRef.current) {
        setIsSubmitting(false);
      }
    }
  };
  
  return (
    <div style={dialogStyles.overlay}>
      <div style={dialogStyles.dialog}>
        <div style={dialogStyles.header}>
          <h2 style={dialogStyles.title}>{modeTitle}</h2>
          <button 
            style={dialogStyles.closeButton} 
            onClick={onClose}
            disabled={isSubmitting}
          >
            ✕
          </button>
        </div>
        
        <form onSubmit={handleSubmit} style={dialogStyles.form}>
          {step === 'input' && (
            <>
              <div style={{
                backgroundColor: '#e7f3ff',
                padding: '15px',
                borderRadius: '8px',
                marginBottom: '20px',
                border: '1px solid #b3d7ff',
              }}>
                <p style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 'bold', color: '#333' }}>
                  📋 配置说明
                </p>
                <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: '#666', lineHeight: '1.6' }}>
                  {modeDescription.map(item => (
                    <li key={item}>{item}</li>
                  ))}
                  <li>✅ Bot 配置（API 地址、Token、ID）将自动从扩展设置中读取，无需手动填写</li>
                </ul>
              </div>
              
              <div style={dialogStyles.formGroup}>
                <label style={dialogStyles.label}>Jira URL *</label>
                <input 
                  style={dialogStyles.input}
                  type="text"
                  value={jiraUrl}
                  onChange={(e) => setJiraUrl(e.target.value)}
                  placeholder="https://jira.ringcentral.com"
                  disabled={isProjectConfigLocked}
                />
                <small style={dialogStyles.hint}>
                  {isProjectConfigLocked ? '已复用现有配置，如需变更请先重新配置执行规则' : '请确保您已在浏览器中登录此 Jira 实例'}
                </small>
              </div>
              
              <div style={dialogStyles.formGroup}>
                <label style={dialogStyles.label}>Project Key *</label>
                <input 
                  style={dialogStyles.input}
                  type="text"
                  value={projectKey}
                  onChange={(e) => setProjectKey(e.target.value.toUpperCase())}
                  placeholder="MTR"
                  maxLength={10}
                  disabled={isProjectConfigLocked}
                />
                <small style={dialogStyles.hint}>
                  {isProjectConfigLocked ? '已复用现有 Project Key' : '请输入您有管理权限的项目 Key，如：MTR'}
                </small>
              </div>
              
              {error && (
                <div style={{
                  padding: '12px',
                  backgroundColor: isJiraNotLoggedIn ? '#fff3cd' : '#f8d7da',
                  color: isJiraNotLoggedIn ? '#856404' : '#721c24',
                  borderRadius: '6px',
                  fontSize: '14px',
                  marginTop: '16px',
                  border: `1px solid ${isJiraNotLoggedIn ? '#ffc107' : '#f5c6cb'}`,
                }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '6px' }}>
                    {isJiraNotLoggedIn ? '⚠️ JIRA 未登录' : '❌ 配置失败'}
                  </div>
                  <div style={{ whiteSpace: 'pre-wrap', marginBottom: isJiraNotLoggedIn ? '12px' : '0' }}>
                    {error}
                  </div>
                  {isJiraNotLoggedIn && (
                    <button
                      type="button"
                      onClick={() => window.open(displayedJiraUrl, '_blank')}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: '#ffc107',
                        color: '#000',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: 'bold',
                      }}
                    >
                      🔗 打开 JIRA 登录
                    </button>
                  )}
                </div>
              )}
            </>
          )}
          
          {step === 'testing' && (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <div style={styles.spinner}></div>
              <p style={{ fontSize: '16px', color: '#333', marginTop: '20px' }}>
                正在测试 Jira 连接...
              </p>
            </div>
          )}
          
          {step === 'creating' && (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <div style={styles.spinner}></div>
              <p style={{ fontSize: '16px', color: '#333', marginTop: '20px' }}>
                正在处理 Jira Automation 规则...
              </p>
              <p style={{ fontSize: '13px', color: '#999', marginTop: '10px' }}>
                这可能需要几秒钟，请稍候...
              </p>
            </div>
          )}
          
          {step === 'input' && (
            <div style={dialogStyles.actions}>
              <button 
                type="button" 
                style={dialogStyles.cancelButton}
                onClick={onClose}
                disabled={isSubmitting}
              >
                取消
              </button>
              <button 
                type="submit" 
                style={dialogStyles.submitButton}
                disabled={isSubmitting}
              >
                {isSubmitting ? '处理中...' : submitLabel}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

// 渲染应用
ReactDOM.render(
  <React.StrictMode>
    <ScheduledMessagesManager />
  </React.StrictMode>,
  document.getElementById('root')
);
