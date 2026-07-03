/**
 * 智能Agent系统 - 新版实现
 * 基于新的接口设计，提供通用分析框架
 */

import { callLLMJsonAPI } from './llm';
import { getMemoryServiceClient } from './services/MemoryServiceClient';
import { getIndependentUserConfig } from './services/UserConfigStore';
import {
  sanitizeIndependentUserConfig,
} from './services/userConfigSanitizer';
import {
  buildCustomPromptPreferenceSection,
  buildUserContextPreferenceSection,
  isCustomPromptScopeInjectionEnabled,
  isCustomPromptsInjectionEnabled,
  isPreferenceInjectionEnabled,
  isUserContextInjectionEnabled,
  type UserContextPreferenceScope,
} from './services/userConfigPreview';
import { getEnvConfig } from './utils';
import { jiraFetch, getJiraBaseUrl, getJiraToken } from './jira';
import {
  AnalysisConfig,
  AnalysisContext,
  AnalysisResult,
  MessageAnalysisResult,
  ProjectAnalysisResult,
  MeetingAnalysisResult,
  WebpageAnalysisResult,
  WebpageAnalysisInput,
  GenericAnalysisResult,
  ProjectInput,
} from './interfaces/analysisInterfaces';
import { buildRuleText } from './utils/ruleTextBuilder';
import {
  filterWatchRulesForMessageGroups,
  resolveMatchedWatchRules,
  type WatchRule,
} from './watchRules';
import {
  recordRejectedManualRuleDiagnostics,
} from './messageAnalysisRuleDiagnostics';
// uuid 已移除，如需要请重新导入

/**
 * 工具接口定义
 */
export type ToolEffectType = 'read' | 'external_read' | 'write' | 'notify' | 'delete';
export type ToolRiskLevel = 'low' | 'medium' | 'high';

interface Tool {
  id: string;
  name: string;
  description: string;
  effect?: ToolEffectType;
  riskLevel?: ToolRiskLevel;
  requiresHumanApproval?: boolean;
  safetyNote?: string;
  execute: (
    params: any,
    state?: any,
  ) => Promise<{
    message: string;
    result?: Record<string, any>;
  }>;
  parameterDefs?: ParameterDefinition[]; // 参数定义列表
}

/**
 * 参数定义接口
 */
export interface ParameterDefinition {
  name: string;
  description: string;
  required: boolean;
  type?: string;
  defaultValue?: any;
  options?: string[]; // 可选值列表，用于枚举类型
}

export interface AgentToolDescription {
  id: string;
  name: string;
  description: string;
  parameters: ParameterDefinition[];
  effect: ToolEffectType;
  riskLevel: ToolRiskLevel;
  requiresHumanApproval: boolean;
  safetyNote?: string;
}

/**
 * 工具注册表
 */
const toolRegistry: Record<string, Tool> = {};

const TOOL_EFFECT_LABELS: Record<ToolEffectType, string> = {
  read: '只读',
  external_read: '外部只读',
  write: '写入',
  notify: '通知',
  delete: '删除',
};

const TOOL_RISK_LABELS: Record<ToolRiskLevel, string> = {
  low: '低风险',
  medium: '中风险',
  high: '高风险',
};

function normalizeRuleRefs(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .map((item) => String(item || '').trim())
        .filter(Boolean)
    : [];
}

function normalizeRuleIds(value: unknown): number[] {
  return Array.isArray(value)
    ? value
        .map((item) => Number(item))
        .filter((item) => Number.isInteger(item) && item >= 0)
    : [];
}

function getAnalysisMessageDatetime(message: any): string {
  return (
    message?.datetime ||
    message?.time ||
    message?.messageContext?.datetime ||
    new Date().toISOString()
  );
}

function normalizeMatchedRules(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .map((item) => String(item || '').trim())
        .filter(Boolean)
    : [];
}

function getToolSafety(tool: Tool): {
  effect: ToolEffectType;
  riskLevel: ToolRiskLevel;
  requiresHumanApproval: boolean;
  safetyNote?: string;
} {
  const effect = tool.effect || 'read';
  const riskLevel = tool.riskLevel || 'low';
  return {
    effect,
    riskLevel,
    requiresHumanApproval:
      tool.requiresHumanApproval === true ||
      riskLevel !== 'low' ||
      !['read', 'external_read'].includes(effect),
    safetyNote: tool.safetyNote,
  };
}

function formatToolSafety(tool: Tool): string {
  const safety = getToolSafety(tool);
  const approvalText = safety.requiresHumanApproval
    ? '需要人工确认'
    : '无需人工确认';
  const note = safety.safetyNote ? `；${safety.safetyNote}` : '';
  return `${TOOL_EFFECT_LABELS[safety.effect]} / ${TOOL_RISK_LABELS[safety.riskLevel]} / ${approvalText}${note}`;
}

/**
 * 注册工具
 */
function registerTool(tool: Tool): void {
  toolRegistry[tool.id] = tool;
  console.log(`工具已注册: ${tool.name} (${tool.id})`);
}

export interface MessageProcessResult {
  isImportant: boolean;
  shouldStore: boolean;
  shouldNotify: boolean;
  confidence: number;
  summary: string;
  enrichedData?: Record<string, any>;
  reasonsToStore?: string[];
  notificationPriority?: 'high' | 'medium' | 'low';
  replyAdvice?: string;
  thoughtProcess?: ThoughtStep[];
  messageIndex?: number;
  groupIndex?: number;
  groupId?: string;
  groupName?: string;
  matchedRule?: string;
  matchedRuleRefs?: string[];
  llmCallCount?: number;
  llmCallTokens?: number;
  aggregateLlmCallCount?: number;
  aggregateLlmCallTokens?: number;
  useTools?: string[];
}

/**
 * 思考结果接口
 */
interface ThoughtResult {
  /** 给用户界面展示的简短决策摘要，不应包含完整逐步推理 */
  thought: string;
  nextAction: string;
  tools: {
    id: string;
    params: Record<string, any>;
  }[];
  messageIndex?: number;
  isImportant?: boolean;
  shouldStore?: boolean;
  shouldNotify?: boolean;
  confidence?: number;
  summary?: string;
  reasonsToStore?: string[];
  notificationPriority?: 'high' | 'medium' | 'low';
  replyAdvice?: string;
  user_relation_type?: string;
  extractedEntities?: any;
  // 新增项目分析相关字段
  riskLevel?: 'low' | 'medium' | 'normal' | 'high' | 'critical';
  suggestions?: Record<string, any>;
  timeline?: {
    onTrack: boolean;
    concerns: string[];
  };
  resourceAllocation?: {
    concerns: string[];
  };
}

/**
 * 行动历史记录项
 */
interface ActionHistoryItem {
  tool: string;
  params: Record<string, any>;
  result: string;
  actionKey?: string;
  skipped?: boolean;
  blocked?: boolean;
  approvalRequired?: boolean;
}

type ToolCallValidationResult =
  | { ok: true; tool: Tool }
  | {
      ok: false;
      message: string;
      reason?: 'unknown_tool' | 'missing_params' | 'approval_required';
      effect?: ToolEffectType;
      riskLevel?: ToolRiskLevel;
      safetyNote?: string;
      approvalKey?: string;
    };

/**
 * 思考步骤
 */
export interface ThoughtStep {
  timestamp: number;
  thought: string;
  /** 用户可见的简短决策摘要；UI 应优先展示该字段而不是完整 thought */
  publicSummary?: string;
  action: string;
  toolUsed?: string;
  toolResult?: string;
  result?: any;
  stepNumber?: number;
  tools?: { id: string; params: Record<string, any> }[];
}

interface WebpageThinkingStats {
  llmCallCount: number;
  llmCallTokens: number;
}

function stableSerialize(value: any, seen = new WeakSet<object>()): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (seen.has(value)) {
    return '"[Circular]"';
  }

  seen.add(value);

  if (Array.isArray(value)) {
    const serialized = `[${value.map((item) => stableSerialize(item, seen)).join(',')}]`;
    seen.delete(value);
    return serialized;
  }

  const serialized = `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key], seen)}`)
    .join(',')}}`;
  seen.delete(value);
  return serialized;
}

export function buildAgentToolCallKey(tool: {
  id: string;
  params?: Record<string, any>;
}): string {
  return `${tool.id}:${stableSerialize(tool.params || {})}`;
}

/**
 * 核心智能Agent类，提供通用分析框架
 */
export class IntelligentAgent {
  private tools: Map<string, Tool> = new Map();
  private thoughtProcess: ThoughtStep[] = [];
  private aggregateLlmCallCount = 0;
  private aggregateLlmCallTokens = 0;
  private stopRequested = false;

  constructor() {
    this.initializeDefaultTools();
  }

  /**
   * 构建 matchedRule 字符串
   * 优先使用稳定 RULE_REF 标识符；RULE_ID 仅保留为兼容层
   */
  private buildMatchedRuleString(
    matchedRuleRefs?: string[],
    matchedRules?: string[],
    matchedRuleIds?: number[],
  ): string {
    if (matchedRuleRefs && matchedRuleRefs.length > 0) {
      const ruleRefParts = matchedRuleRefs.map(
        (ruleRef) => `[RULE_REF:${ruleRef}]`,
      );
      if (matchedRules && matchedRules.length > 0) {
        return `${ruleRefParts.join(' ')} ${matchedRules.join('; ')}`;
      }
      return ruleRefParts.join(' ');
    }

    if (matchedRuleIds && matchedRuleIds.length > 0) {
      const ruleIdParts = matchedRuleIds.map((id) => `[RULE_ID:${id}]`);
      if (matchedRules && matchedRules.length > 0) {
        return `${ruleIdParts.join(' ')} ${matchedRules.join('; ')}`;
      }
      return ruleIdParts.join(' ');
    }

    if (matchedRules && matchedRules.length > 0) {
      return matchedRules.join('; ');
    }

    return '';
  }

  private async applyMessageRuleScopeGuard(
    result: MessageAnalysisResult,
    message: any,
    initialAnalysis: any,
    context?: AnalysisContext,
  ): Promise<void> {
    const watchRules = (context?.concernedRules || []) as WatchRule[];
    if (watchRules.length === 0) {
      return;
    }

    const matchedRuleRefs = normalizeRuleRefs(result.matchedRuleRefs);
    const matchedRuleIds = normalizeRuleIds(result.matchedRuleIds);
    const matchedRules = normalizeMatchedRules(initialAnalysis?.matchedRules);
    const matchedRule =
      result.matchedRule ||
      this.buildMatchedRuleString(matchedRuleRefs, matchedRules, matchedRuleIds);
    const hasRuleSignal =
      matchedRuleRefs.length > 0 ||
      matchedRuleIds.length > 0 ||
      matchedRules.length > 0 ||
      matchedRule.length > 0;

    if (!hasRuleSignal) {
      return;
    }

    const messageContext = {
      sender: message?.sender || message?.creator,
      creator: message?.creator || message?.sender,
      groupId: result.groupId || message?.groupId || context?.groupInfo?.id,
      groupName:
        result.groupName || message?.groupName || context?.groupInfo?.name,
      datetime: getAnalysisMessageDatetime(message),
    };
    const resolvedMatch = resolveMatchedWatchRules({
      watchRules,
      matchedRule,
      matchedRuleRefs,
      matchedRuleIds: matchedRuleRefs.length > 0 ? [] : matchedRuleIds,
      messageContext,
    });

    if (resolvedMatch.watchRules.length > 0) {
      result.matchedRuleRefs = resolvedMatch.matchedRuleRefs;
      result.matchedRuleIds =
        matchedRuleRefs.length > 0
          ? matchedRuleIds
          : resolvedMatch.matchedRuleIds;
      result.matchedRule = this.buildMatchedRuleString(
        resolvedMatch.matchedRuleRefs,
        matchedRules,
        result.matchedRuleIds,
      );
      return;
    }

    await recordRejectedManualRuleDiagnostics({
      runtimeWatchRules: watchRules,
      matchedRuleRefs: resolvedMatch.matchedRuleRefs,
      matchedRule,
      messageContext,
      postId: result.postId || message?.post_id || message?.id,
      messageDatetime: messageContext.datetime,
    });

    result.matchedRule = '';
    result.matchedRuleRefs = [];
    result.matchedRuleIds = [];
    result.shouldStore = false;
    result.shouldNotify = false;
    result.notificationPriority = 'low';
    result.reasonsToStore = [
      ...(result.reasonsToStore || []),
      '未通过记忆入口规则最终范围校验',
    ];

    const guardStep: ThoughtStep = {
      timestamp: Date.now(),
      thought:
        '模型返回了规则命中，但该命中未通过记忆入口规则的最终范围校验，已跳过入库和通知。',
      publicSummary: '未通过规则范围校验，已跳过入库和通知。',
      action: 'invalid_rule_scope',
    };
    this.thoughtProcess.push(guardStep);
    result.thoughtProcess?.push(guardStep);
  }

  /**
   * 从本地缓存和记忆服务备份加载用户自定义配置。
   * 本地配置优先，记忆服务用于跨页面/跨设备恢复。
   */
  private async loadUserConfiguration(): Promise<{
    preferenceInjection: any;
    customPrompts: any;
    userContextConfig: any;
    userProfile?: any;
    userProfileAnalysis?: any;
  }> {
    const defaultConfig = {
      customPrompts: {
        message: {
          enabled: false,
          content: '',
          position: 'after_analysis_guide',
        },
        project: {
          enabled: false,
          content: '',
          position: 'after_analysis_guide',
        },
      },
      preferenceInjection: {
        enabled: true,
        customPromptsEnabled: true,
        messagePromptEnabled: true,
        projectPromptEnabled: true,
        userContextEnabled: true,
      },
      userContextConfig: {
        personalInfo: {
          name: '',
          email: '',
          title: '',
          department: '',
          location: '',
          timezone: 'GMT+8',
        },
        stakeholders: {
          directManager: '',
          keyStakeholders: [] as any[],
          reportingFrequency: '每周',
        },
        teamInfo: {
          teamName: '',
          teamMission: '',
          teamSize: 0,
          members: [] as any[],
          workingHours: '',
          timezone: 'GMT+8',
        },
        workFocus: {
          primaryConcerns: [] as string[],
          businessDomains: [] as string[],
          keyMetrics: [] as string[],
          riskTolerance: 'medium',
        },
        communicationContext: {
          audienceType: [] as string[],
          communicationStyle: '简洁直接',
          culturalContext: '',
          languagePreference: '中英文混合',
          reportingFormat: '项目状态报告',
        },
        analysisPreferences: {
          messageAnalysis: {
            focusAreas: [] as string[],
            ignoredTopics: [] as string[],
            urgencyKeywords: [] as string[],
          },
          projectAnalysis: {
            riskFactors: [] as string[],
            successCriteria: [] as string[],
            reviewCycle: 'weekly',
          },
        },
      },
    };

    const deepMerge = (base: any, override: any): any => {
      if (override === undefined || override === null) return base;
      if (Array.isArray(base) || Array.isArray(override)) return override;
      if (typeof base !== 'object' || typeof override !== 'object') {
        return override;
      }

      const merged: Record<string, any> = { ...base };
      for (const key of Object.keys(override)) {
        merged[key] = deepMerge(base[key], override[key]);
      }
      return merged;
    };

    const getTimestamp = (config: any): number => {
      const candidates = [
        config?.lastUpdated,
        config?.cloudSyncTime,
        config?.userContextConfig?.lastUpdated,
      ];
      for (const candidate of candidates) {
        const value = Number(candidate);
        if (Number.isFinite(value) && value > 0) return value;
      }
      return 0;
    };

    const hasConfig = (config: any): boolean =>
      Boolean(
        config?.preferenceInjection ||
          config?.customPrompts ||
          config?.userContextConfig,
      );

    const withTimeout = async <T>(
      promise: Promise<T>,
      fallback: T,
      timeoutMs = 1500,
    ): Promise<T> => {
      return new Promise<T>((resolve) => {
        const timer = setTimeout(() => resolve(fallback), timeoutMs);
        promise
          .then((value) => {
            clearTimeout(timer);
            resolve(value);
          })
          .catch(() => {
            clearTimeout(timer);
            resolve(fallback);
          });
      });
    };

    const chromeApi = (globalThis as any).chrome;
    const localConfig = await new Promise<any>((resolve) => {
      if (!chromeApi?.storage?.local?.get) {
        resolve({});
        return;
      }
      chromeApi.storage.local.get(
        ['preferenceInjection', 'customPrompts', 'userContextConfig', 'cloudSyncTime'],
        resolve,
      );
    });

    const messageConfig = hasConfig(localConfig)
      ? null
      : await withTimeout(
          (async () => {
            try {
              const response = await chromeApi?.runtime?.sendMessage?.({
                type: 'GET_INDEPENDENT_USER_CONFIG',
              });
              return response?.success && hasConfig(response.data)
                ? response.data
                : null;
            } catch {
              return null;
            }
          })(),
          null,
        );

    const serviceConfig =
      messageConfig ||
      (!hasConfig(localConfig)
        ? await withTimeout(
            getIndependentUserConfig(getMemoryServiceClient()).catch(() => null),
            null,
          )
        : null);

    const chosenConfig =
      serviceConfig &&
      (!hasConfig(localConfig) || getTimestamp(serviceConfig) > getTimestamp(localConfig))
        ? serviceConfig
        : localConfig;

    const mergedConfig = sanitizeIndependentUserConfig(
      deepMerge(defaultConfig, chosenConfig || {}),
    );
    const preferenceInjectionEnabled = isPreferenceInjectionEnabled(mergedConfig);
    const customPromptsInjectionEnabled =
      isCustomPromptsInjectionEnabled(mergedConfig);
    const messagePromptInjectionEnabled =
      isCustomPromptScopeInjectionEnabled(mergedConfig, 'message');
    const projectPromptInjectionEnabled =
      isCustomPromptScopeInjectionEnabled(mergedConfig, 'project');
    const userContextInjectionEnabled = isUserContextInjectionEnabled(mergedConfig);
    const injectableCustomPrompts =
      preferenceInjectionEnabled && customPromptsInjectionEnabled
        ? {
            ...mergedConfig.customPrompts,
            message: messagePromptInjectionEnabled
              ? mergedConfig.customPrompts.message
              : defaultConfig.customPrompts.message,
            project: projectPromptInjectionEnabled
              ? mergedConfig.customPrompts.project
              : defaultConfig.customPrompts.project,
          }
        : defaultConfig.customPrompts;

    return {
      preferenceInjection: mergedConfig.preferenceInjection,
      customPrompts: injectableCustomPrompts,
      userContextConfig: preferenceInjectionEnabled && userContextInjectionEnabled
        ? mergedConfig.userContextConfig
        : defaultConfig.userContextConfig,
      userProfile: null,
      userProfileAnalysis: null,
    };
  }

  /**
   * 构建用户上下文信息字符串
   */
  private buildUserContextInfo(
    userContextConfig: any,
    scope: UserContextPreferenceScope = 'all',
  ): string {
    return buildUserContextPreferenceSection(userContextConfig, { scope });
  }

  private buildUserContextPromptBlock(
    userContextConfig: any,
    scope: UserContextPreferenceScope = 'all',
  ): string {
    const section = this.buildUserContextInfo(userContextConfig, scope);
    return section ? `${section}\n\n` : '';
  }

  private resolveGenericUserContextScope(
    inputType: string,
  ): UserContextPreferenceScope {
    if (inputType === 'message') return 'message';
    if (['project', 'meeting', 'document'].includes(inputType)) return 'project';
    return 'all';
  }

  private buildCustomPromptSection(
    customPrompt: any,
    scopeLabel: string,
  ): string {
    const section = buildCustomPromptPreferenceSection(customPrompt, scopeLabel);
    return section ? `\n${section}\n` : '';
  }

  /**
   * 初始化并注册默认工具
   */
  private initializeDefaultTools(): void {
    // 检查工具是否已经注册，避免重复注册
    if (Object.keys(toolRegistry).length > 0) {
      return;
    }

    // 历史消息搜索工具
    registerTool({
      id: 'historySearch',
      name: '历史消息搜索',
      description: '搜索与当前消息相关的历史消息',
      effect: 'read',
      riskLevel: 'low',
      requiresHumanApproval: false,
      safetyNote: '仅查询本地/后端记忆，不写入外部系统。',
      parameterDefs: [
        {
          name: 'content',
          description: '作为搜索上下文的消息内容',
          required: true,
          type: 'string',
        },
        {
          name: 'customQuery',
          description: '自定义搜索查询',
          required: false,
          type: 'string',
        },
        {
          name: 'people',
          description: '需要包含的人物名称数组',
          required: false,
          type: 'string[]',
        },
        {
          name: 'projects',
          description: '需要包含的项目名称数组',
          required: false,
          type: 'string[]',
        },
        {
          name: 'timeRange',
          description: '时间范围',
          required: false,
          type: 'object',
        },
        {
          name: 'limit',
          description: '返回结果数量限制',
          required: false,
          type: 'number',
          defaultValue: 5,
        },
      ],
      execute: async (params) => {
        // 构建搜索查询
        const query =
          params.customQuery ||
          `与以下内容相关的消息: ${params.content.substring(0, 100)}...`;
        const filters: any = {};

        // 如果提供了特定筛选条件
        if (params.people?.length) {
          filters.entities = {
            people: params.people.map((name: string) => ({
              name,
              required: true,
            })),
          };
        }

        if (params.projects?.length) {
          if (!filters.entities) filters.entities = {};
          filters.entities.projects = params.projects.map((name: string) => ({
            name,
            required: true,
          }));
        }

        if (params.timeRange) {
          filters.timeRange = params.timeRange;
        }

        // 🔄 使用 MemoryServiceClient HTTP 后端搜索
        const timeRange =
          filters.timeRange && filters.timeRange.start && filters.timeRange.end
            ? { start: filters.timeRange.start, end: filters.timeRange.end }
            : undefined;

        try {
          const client = getMemoryServiceClient();
          const recallResult = await client.recall(query, {
            topK: params.limit || 5,
            channels: ['vector', 'fts'],
            timeRange,
          });

          const items = recallResult.items || [];
          console.log('历史消息搜索结果:', items);
          return {
            message: `「${params.content.substring(0, 100)}...」相关历史消息：\n  - ${items.map((m) => `${m.metadata?.summary || m.content.substring(0, 80)}——${m.metadata?.sender || 'unknown'}`).join('\n  - ')}`,
            result: items.map((m) => ({
              summary: m.metadata?.summary || m.content.substring(0, 100),
              sender: m.metadata?.sender || 'unknown',
            })),
          };
        } catch (error) {
          console.error('历史消息搜索失败:', error);
          return {
            message: `历史消息搜索失败: ${error.message || error}`,
            result: [],
          };
        }
      },
    });

    // 添加JIRA查询缓存
    const jiraCache: {
      [key: string]: {
        data: any;
        timestamp: number;
        expiresAt: number;
      };
    } = {};

    // 缓存有效期（毫秒）
    const JIRA_CACHE_TTL = 30 * 60 * 1000; // 30分钟

    registerTool({
      id: 'jiraQuery',
      name: 'JIRA信息查询',
      description:
        '直接调用JIRA REST API查询任务、需求和bug信息。如果有issueId可直接查询单issue结果，否则用其他参数进行多issues查询',
      effect: 'external_read',
      riskLevel: 'low',
      requiresHumanApproval: false,
      safetyNote: '只读取 JIRA 数据，不修改 issue。',
      parameterDefs: [
        {
          name: 'issueId',
          description: 'JIRA任务ID/key，例如 PROJ-1234',
          required: false,
          type: 'string',
        },
        {
          name: 'issueIds',
          description: '多个JIRA任务ID/key，例如 ["PROJ-1234", "PROJ-1235"]',
          required: false,
          type: 'array',
        },
        {
          name: 'keywords',
          description: '搜索关键词，使用JQL中的text搜索',
          required: false,
          type: 'string',
        },
        {
          name: 'forceRefresh',
          description: '强制刷新缓存，不使用已缓存的数据',
          required: false,
          type: 'boolean',
          defaultValue: false,
        },
      ],
      execute: async (params) => {
        try {
          // 从环境配置或公共方法获取 JIRA 连接信息（token 优先，必要时使用受控 cookie fallback）
          const jiraBaseUrl = await getJiraBaseUrl();
          const apiToken = await getJiraToken();
          const excludeCommentKeyworkds = ["Esone's AI", 'SDET bot'];

          // 生成缓存键
          let cacheKey = '';
          if (params.issueId) {
            cacheKey = `issue-${params.issueId}`;
          } else {
            // 使用JQL参数生成缓存键
            const jqlParams = [
              params.project ? `project=${params.project}` : '',
              params.status ? `status=${params.status}` : '',
              params.keywords ? `keywords=${params.keywords}` : '',
            ]
              .filter(Boolean)
              .join('&');
            cacheKey = `search-${jqlParams}`;
          }

          // 检查缓存是否有效且未过期
          const now = Date.now();
          const cacheEntry = jiraCache[cacheKey];

          if (
            !params.forceRefresh &&
            cacheEntry &&
            cacheEntry.expiresAt > now
          ) {
            console.log(`使用缓存的JIRA数据: ${cacheKey}`);
            return cacheEntry.data;
          }

          let result;
          let resultMessage = '';
          let type = 'single';
          // 处理不同的查询类型
          if (params.issueId) {
            // 查询单个JIRA问题（使用统一的 jiraFetch，自动处理 token 和 cookie）
            const issueUrl = `${jiraBaseUrl}/rest/api/2/issue/${params.issueId}`;

            const response = await jiraFetch(issueUrl, {
              token: apiToken || undefined,
            });

            if (!response.ok) {
              const errorText = await response.text();
              throw new Error(
                `查询JIRA问题失败 (${response.status}): ${errorText}`,
              );
            }

            const responseData = await response.json();
            result = {
              key: responseData.key,
              summary: responseData.fields.summary,
              status: responseData.fields.status.name,
              assignee: responseData.fields.assignee?.displayName || '',
              reporter: responseData.fields.reporter?.displayName || '',
              priority: responseData.fields.priority.name,
              issuetype: responseData.fields.issuetype.name,
              duedate: responseData.fields.duedate,
              comments: responseData.fields.comment.comments
                .splice(-3)
                .map(
                  (comment: any) =>
                    comment.author.displayName + ': ' + comment.body,
                )
                .filter(
                  (comment: string) =>
                    !excludeCommentKeyworkds.some((keyword) =>
                      comment.includes(keyword),
                    ),
                ),
              description: responseData.fields.description,
              url: `${jiraBaseUrl}/browse/${responseData.key}`,
            };
            resultMessage = `[${params.issueId}][${result.status}]的查询数据: ${result.summary}\n - 执行者: ${result.assignee}\n - 预计完成时间: ${result.duedate}\n - 评论:\n  - ${result.comments.join('\n  - ').replace('\n', '')}`;
          } else {
            // 构建JQL查询
            let jql = '';

            if (params.issueIds) {
              jql += jql
                ? ` AND key IN (${params.issueIds.map((id: string) => `"${id}"`).join(',')})`
                : `key IN (${params.issueIds.map((id: string) => `"${id}"`).join(',')})`;
            }

            if (params.status) {
              jql += jql
                ? ` AND status = "${params.status}"`
                : `status = "${params.status}"`;
            }

            if (params.keywords) {
              const keywordQuery = `text ~ "${params.keywords}"`;
              jql += jql ? ` AND ${keywordQuery}` : keywordQuery;
            }

            // 如果没有任何条件，搜索最近更新的问题
            if (!jql) {
              jql = 'updated >= -30d ORDER BY updated DESC';
            }

            console.log(`执行JQL查询: ${jql}`);

            // 使用POST方法进行搜索以处理可能较长的JQL（使用统一的 jiraFetch）
            const searchUrl = `${jiraBaseUrl}/rest/api/2/search`;
            const response = await jiraFetch(searchUrl, {
              method: 'POST',
              body: {
                jql: jql,
                maxResults: 10,
                fields: [
                  'summary',
                  'status',
                  'assignee',
                  'description',
                  'priority',
                  'issuetype',
                  'created',
                  'updated',
                  'duedate',
                  'reporter',
                ],
              },
              token: apiToken || undefined,
            });

            if (!response.ok) {
              const errorText = await response.text();
              throw new Error(
                `JIRA搜索查询失败 (${response.status}): ${errorText}`,
              );
            }

            const responseData = await response.json();
            type = 'multiple';
            result = responseData.issues.map((issue: any) => ({
              key: issue.key,
              issuetype: issue.fields.issuetype.name,
              summary: issue.fields.summary,
              status: issue.fields.status.name,
              assignee: issue.fields.assignee?.displayName || '',
              reporter: issue.fields.reporter?.displayName || '',
              priority: issue.fields.priority.name,
              duedate: issue.fields.duedate,
              description: issue.fields.description,
              url: `${jiraBaseUrl}/browse/${issue.key}`,
            }));
            resultMessage = `[${result.map((issue: any) => `[${issue.key}][${issue.status}]${issue.summary}`).join('\n')}`;
          }

          // 存储结果到缓存
          jiraCache[cacheKey] = {
            data: {
              message: resultMessage,
              result,
            },
            timestamp: now,
            expiresAt: now + JIRA_CACHE_TTL,
          };

          return {
            message: resultMessage,
            type,
            result,
          };
        } catch (error) {
          console.error('JIRA API查询失败:', error);

          // 增强错误消息
          let errorMessage = '查询JIRA时发生错误';

          if (error.message) {
            errorMessage = error.message;

            // 细化错误消息
            if (error.message.includes('401')) {
              errorMessage = `JIRA认证失败: ${error.message}。请检查用户名和API令牌是否正确。`;
            } else if (error.message.includes('403')) {
              errorMessage = `JIRA权限不足: ${error.message}。请确保用户有权访问请求的资源。`;
            } else if (error.message.includes('404')) {
              errorMessage = `JIRA资源未找到: ${error.message}。请检查JIRA基础URL和问题ID是否正确。`;
            } else if (error.message.includes('400')) {
              errorMessage = `JIRA请求无效: ${error.message}。请检查JQL查询语法。`;
            }
          }

          return {
            success: false,
            source: 'jira-api',
            message: errorMessage,
            originalError: error,
          };
        }
      },
    });
    /* 
    // 组织架构查询工具
    registerTool({
      id: 'orgStructure',
      name: '组织架构查询',
      description: '查询人员的组织架构关系',
      execute: async (params) => {
        // 模拟实现，实际环境中需要集成组织架构API
        console.log(`查询组织架构信息: ${JSON.stringify(params)}`);
        
        if (params.person) {
          return {
            message: `人员 ${params.person} 的查询数据: 角色: 高级工程师, 部门: 研发部, 经理: 张经理, 下属: 李工程师, 王工程师, 同事: 高工程师, 刘工程师`,
            result: {
              success: true,
              person: params.person,
              role: '高级工程师',
              department: '研发部',
              manager: '张经理',
              directReports: ['李工程师', '王工程师'],
              peers: ['高工程师', '刘工程师']
            }
          };
        }
        
        if (params.department) {
          return {
            message: `部门 ${params.department} 的查询数据: 部门负责人: 李总监, 成员: 张经理, 高工程师, 李工程师, 王工程师, 刘工程师`,
            result: {
              success: true,
              department: params.department,
              head: '李总监',
              members: ['张经理', '高工程师', '李工程师', '王工程师', '刘工程师']
            }
          };
        }
        
        return {
          success: false,
          message: '缺少必要的组织架构查询参数'
        };
      }
    });

    // 发布任务查询工具
    registerTool({
      id: 'releaseTaskQuery',
      name: '发布任务查询',
      description: '查询本月发布任务信息',
      execute: async (params) => {
        // 模拟实现，实际环境中需要集成相关API
        console.log(`查询发布任务信息: ${JSON.stringify(params)}`);
        
        const now = new Date();
        const thisMonth = now.getMonth() + 1;
        const thisYear = now.getFullYear();
        
        return {
          message: `本月发布任务信息: ${thisYear}-${thisMonth}`,
          result: {
            success: true,
            month: `${thisYear}-${thisMonth}`,
            releases: [
              {
                id: 'REL-2023-001',
                name: '产品A 3.5版本',
                scheduledDate: '2023-10-15',
                status: '准备中',
                features: ['功能1', '功能2', '功能3'],
                owner: '张发布经理'
              },
              {
                id: 'REL-2023-002',
                name: '产品B 2.0版本',
                scheduledDate: '2023-10-25',
                status: '规划中',
                features: ['新功能A', '性能优化'],
                owner: '李发布经理'
              }
            ]
          }
        };
      }
    });

    // Sprint数据查询工具
    registerTool({
      id: 'sprintDataQuery',
      name: 'Sprint数据查询',
      description: '查询当前Sprint的进度和bug数据',
      execute: async (params) => {
        // 模拟实现，实际环境中需要集成相关API
        console.log(`查询Sprint数据: ${JSON.stringify(params)}`);
        
        return {
          message: `当前Sprint数据: ${params.sprintId}`,
          result: {
            success: true,
            sprintId: params.sprintId,
            name: '2023年10月第2个Sprint',
            startDate: '2023-10-09',
            endDate: '2023-10-20',
            progress: {
              totalStoryPoints: 120,
              completedStoryPoints: 45,
              completionPercentage: 37.5
            },
            bugs: {
              total: 24,
              critical: 2,
              major: 8,
              minor: 14,
              resolved: 10,
              pending: 14
            },
            topContributors: ['张工程师', '李工程师', '王测试']
          }
        };
      }
    }); */
  }

  /**
   * 分析任何类型的输入并返回适当的分析结果
   */
  async analyze(
    input: any,
    config: AnalysisConfig,
    context?: AnalysisContext,
    onStepCompleted?: (results: AnalysisResult[]) => void,
  ): Promise<AnalysisResult | AnalysisResult[]> {
    // 根据配置选择合适的分析流程
    switch (config.type) {
      case 'message':
        return this.analyzeMessage(input, config, context, onStepCompleted);
      case 'project':
        return this.analyzeProject(input, config, context);
      case 'meeting':
        return this.analyzeMeeting(input, config, context);
      case 'document':
        return this.analyzeDocument(input, config, context);
      case 'webpage':
        return this.analyzeWebpage(input, config, context);
      default:
        return this.analyzeGeneric(input, config, context);
    }
  }

  /**
   * 批量分析多个项目
   */
  async analyzeBatch(
    items: any[],
    config: AnalysisConfig,
    context?: AnalysisContext,
    onProgress?: (result: AnalysisResult | MessageAnalysisResult[]) => void,
  ): Promise<AnalysisResult[]> {
    const results: AnalysisResult[] = [];

    for (let i = 0; i < items.length; i++) {
      const result = await this.analyze(items[i], config, context);

      if (onProgress) {
        onProgress(result as MessageAnalysisResult);
      }

      results.push(result as AnalysisResult);
    }

    return results;
  }

  /**
   * 分析消息
   */
  private async analyzeMessage(
    input: any,
    config: AnalysisConfig,
    context?: AnalysisContext,
    onEveryGroupCompleted?: (results: MessageAnalysisResult[]) => void,
  ): Promise<MessageAnalysisResult | MessageAnalysisResult[]> {
    // 检测输入格式
    const format = this.detectMessageFormat(input);
    console.log(`检测到消息格式: ${format}`);

    // 根据消息格式决定处理方式
    if (format === 'message_groups') {
      // 处理多个消息组
      const results: MessageAnalysisResult[] = [];

      // 获取环境配置
      const envConfig = await getEnvConfig();

      if (envConfig.ANALYZE_BY_GROUP === true) {
        // 为每个消息组单独批量处理
        for (let i = 0; i < input.length; i++) {
          // 检查是否需要继续分析
          if (this.stopRequested) {
            console.log('分析任务已被终止');
            break;
          }
          const group = input[i];
          const groupContext = {
            ...context,
            groupInfo: {
              id: group.groupId,
              index: i,
              name: group.groupName,
              members: (group.members || []) as string[],
            },
          };

          // 提取组中的消息并标准化。当前采集链路可能只提供 standalone
          // 或 threads，不能再假设旧版 posts 一定存在。
          const groupMessages = this.normalizeMessageGroupMessages(group);

          // 分析该组的消息
          const groupResults = await this.analyzeGroupMessages(
            groupMessages,
            config,
            groupContext,
            onEveryGroupCompleted,
          );

          results.push(...groupResults);
        }
      } else {
        // 将所有消息组合并处理
        const allMessages: any[] = [];

        for (const group of input) {
          const groupMessages = this.normalizeMessageGroupMessages(group);

          allMessages.push(...groupMessages);
        }

        const globalContext = {
          ...context,
          groupInfo: {
            id: '',
            name: '多群组分析',
            members: [] as string[],
          },
        };

        const groupResults = await this.analyzeGroupMessages(
          allMessages,
          config,
          globalContext,
          onEveryGroupCompleted,
        );

        results.push(...groupResults);
      }

      return results;
    } else if (format === 'message_group') {
      // 处理单个消息组
      const groupContext = {
        ...context,
        groupInfo: {
          id: input.groupId,
          name: input.groupName,
          members: (input.members || []) as string[],
        },
      };

      // 提取消息并标准化
      const messages = this.normalizeMessageGroupMessages(input);

      // 分析消息
      return await this.analyzeGroupMessages(
        messages,
        config,
        groupContext,
        onEveryGroupCompleted,
      );
    } else {
      // 处理单条消息
      // 标准化
      const normalizedInput = this.normalizeInput(input, config);

      // 将单条消息转换为数组进行处理
      const results = await this.analyzeGroupMessages(
        [normalizedInput],
        config,
        context,
        onEveryGroupCompleted,
      );

      // 返回第一个结果
      return results[0];
    }
  }

  /**
   * 分析消息组
   * 处理标准化后的消息数组
   * 降噪处理
   */
  private async analyzeGroupMessages(
    messages: any[],
    config: AnalysisConfig,
    context?: AnalysisContext,
    onGroupCompleted?: (results: MessageAnalysisResult[]) => void,
  ): Promise<MessageAnalysisResult[]> {
    try {
      if (messages.length === 0) {
        return [];
      }

      let groupIndex = 0;
      const usedTools = new Set<string>();
      const fixedGroupIndex = context?.groupInfo?.index;
      const getMessageGroupKey = (message: any): string =>
        String(
          message.groupId ||
            message.group_id ||
            message.team_id ||
            message.teamId ||
            message.groupName ||
            message.team_name ||
            '',
        );
      const isGroupEnd = (index: number): boolean => {
        if (index >= messages.length - 1) return true;
        return getMessageGroupKey(messages[index]) !== getMessageGroupKey(messages[index + 1]);
      };

      // 调用LLM分析
      const analysisResult = await this.initialAnalysis(
        messages,
        config,
        context,
      );
      const analysisItems = Array.isArray(analysisResult)
        ? analysisResult
        : [analysisResult];

      // 准备最终结果数组
      const finalResults: MessageAnalysisResult[] = [];

      // 为每条消息进行深度分析（思考-行动循环）
      for (let i = 0; i < messages.length; i++) {
        const message = messages[i];
        const messagePostId =
          message.post_id || message.postId || message.id || '';
        const messageGroupId =
          message.groupId || message.group_id || message.team_id || message.teamId || '';
        const messageGroupName =
          message.groupName || message.team_name || context?.groupInfo?.name || '';
        const messageGroupKey = getMessageGroupKey(message);
        const resolvedGroupIndex = fixedGroupIndex ?? groupIndex;

        // 🆕 使用 post_id 精确匹配 LLM 返回的分析结果
        const analysis = analysisItems.find(
          (r: any) => r.post_id === messagePostId,
        ) || {
          summary: '没有分析结果',
          importanceLevel: 'low',
          needsProcessing: false,
          isNoiseMessage: false,
        };

        // 如果是噪音消息且不需要处理，创建简化的结果
        if (
          analysis.isNoiseMessage === true &&
          analysis.needsProcessing === false
        ) {
          finalResults.push({
            type: 'message',
            postId: messagePostId,
            groupIndex: resolvedGroupIndex,
            groupId: messageGroupId,
            groupName: messageGroupName,
            messageContext: message,
            isImportant: false,
            shouldNotify: false,
            shouldStore: false,
            reasonsToStore: [],
            user_relation_type: 'general_interest',
            confidence: 1.0, // 高确信度，这是噪音消息
            summary: analysis.summary || '噪音消息',
            thoughtProcess: [
              {
                timestamp: Date.now(),
                thought: '经分析，这是噪音消息，无需进一步处理',
                action: '跳过处理',
              },
            ],
          });
          if (isGroupEnd(i)) {
            const currentGroupResults = finalResults.filter((r) => {
              const resultGroupKey = getMessageGroupKey(r.messageContext || r);
              return (
                resultGroupKey === messageGroupKey &&
                r.groupIndex === resolvedGroupIndex
              );
            });
            if (onGroupCompleted && currentGroupResults.length > 0) {
              onGroupCompleted(currentGroupResults);
            }
            if (fixedGroupIndex === undefined) {
              groupIndex++;
            }
          }
          continue;
        }

        const messageThoughtProcess: ThoughtStep[] = [];
        const messageUsedTools: string[] = [];

        const result: MessageAnalysisResult = {
          type: 'message',
          postId: messagePostId,
          groupIndex: resolvedGroupIndex,
          groupId: messageGroupId,
          groupName: messageGroupName,
          isImportant: analysis.importanceLevel === 'high',
          shouldStore: false,
          shouldNotify: false,
          confidence: 0,
          summary: analysis.summary || '',
          user_relation_type: analysis.user_relation_type || 'general_interest',
          enrichedData: {
            entities: analysis.entities || {},
            relationships: analysis.relationships || [],
            actions: analysis.actions || [],
            sentiment: analysis.sentiment || 'neutral',
            category: analysis.category || [],
          },
          reasonsToStore: [],
          thoughtProcess: messageThoughtProcess,
          messageContext: message,
          // 优先使用 matchedRuleRefs 构建 matchedRule；RULE_ID 仅保留为兼容层
          matchedRule: this.buildMatchedRuleString(
            analysis.matchedRuleRefs,
            analysis.matchedRules,
            analysis.matchedRuleIds,
          ),
          matchedRuleRefs: Array.isArray(analysis.matchedRuleRefs)
            ? analysis.matchedRuleRefs
            : [],
          matchedRuleIds: Array.isArray(analysis.matchedRuleIds)
            ? analysis.matchedRuleIds
            : [],
          metaData: {
            llmCallCount: 0,
            llmCallTokens: 0,
            usedTools: messageUsedTools,
            timestamp: Date.now(),
          },
        };

        // 执行思考-行动循环
        await this.loopThinking(
          result,
          message,
          analysis,
          config,
          context,
          usedTools,
        );
        await this.applyMessageRuleScopeGuard(
          result,
          message,
          analysis,
          context,
        );

        // 添加到最终结果列表
        finalResults.push(result);

        // 每条消息处理完成后，检查是否所有同一组的消息都已处理完毕
        if (isGroupEnd(i)) {
          const currentGroupResults = finalResults.filter((r) => {
            const resultGroupKey = getMessageGroupKey(r.messageContext || r);
            return (
              resultGroupKey === messageGroupKey &&
              r.groupIndex === resolvedGroupIndex
            );
          });
          if (onGroupCompleted && currentGroupResults.length > 0) {
            onGroupCompleted(currentGroupResults);
          }
          if (fixedGroupIndex === undefined) {
            groupIndex++;
          }
        }
      }

      // 记录批量处理完成
      const batchEndStep: ThoughtStep = {
        timestamp: Date.now(),
        thought: `完成批量处理 ${messages.length} 条消息，其中 ${finalResults.filter((r: MessageAnalysisResult) => r.shouldStore).length} 条被存储，${finalResults.filter((r: MessageAnalysisResult) => r.shouldNotify).length} 条需要通知。共调用 LLM ${this.aggregateLlmCallCount} 次，估计使用 ${this.aggregateLlmCallTokens} tokens，使用工具：${Array.from(usedTools).join(', ')}`,
        action: '完成批量处理',
      };
      this.thoughtProcess.push(batchEndStep);
      const lastResult = finalResults[finalResults.length - 1];
      if (lastResult?.thoughtProcess) {
        lastResult.thoughtProcess.push(batchEndStep);
      }

      console.log(
        `智能Agent批量处理完成，共处理 ${finalResults.length} 条消息，其中 ${finalResults.filter((r: MessageAnalysisResult) => r.shouldStore).length} 条被存储，${finalResults.filter((r: MessageAnalysisResult) => r.shouldNotify).length} 条需要通知。共调用 LLM ${this.aggregateLlmCallCount} 次，估计使用 ${this.aggregateLlmCallTokens} tokens，使用工具：${Array.from(usedTools).join(', ')}`,
      );
      return finalResults;
    } catch (error) {
      console.error('智能Agent批量处理消息失败:', error);

      // 记录错误
      this.thoughtProcess.push({
        timestamp: Date.now(),
        thought: error.message,
        action: '终止处理',
      });

      // 返回错误结果
      const errorResults = messages.map((message) => ({
        type: 'message' as const,
        postId: message.post_id || message.id || '',
        isImportant: false,
        shouldStore: false,
        shouldNotify: false,
        confidence: 0,
        summary: `批量处理失败: ${error.message}`,
        reasonsToStore: [] as string[],
        messageContext: message,
        metaData: {
          llmCallCount: this.aggregateLlmCallCount,
          llmCallTokens: this.aggregateLlmCallTokens,
          usedTools: Array.from(new Set<string>()),
          timestamp: Date.now(),
        },
      }));

      // 调用回调函数，通知处理失败
      if (onGroupCompleted) {
        onGroupCompleted(errorResults);
      }

      return errorResults;
    }
  }

  /**
   * 获取可用工具列表
   */
  private getAvailableTools(): Tool[] {
    // 根据配置返回工具列表
    return Object.values(toolRegistry);
  }

  private getAvailableToolIdList(): string {
    const ids = this.getAvailableTools().map((tool) => tool.id);
    return ids.length > 0 ? ids.join(', ') : '无';
  }

  /**
   * 获取可用于 UI 展示的工具目录
   */
  public getToolCatalog(): AgentToolDescription[] {
    return this.getAvailableTools().map((tool) => {
      const safety = getToolSafety(tool);
      return {
        id: tool.id,
        name: tool.name,
        description: tool.description,
        parameters: tool.parameterDefs || [],
        effect: safety.effect,
        riskLevel: safety.riskLevel,
        requiresHumanApproval: safety.requiresHumanApproval,
        safetyNote: safety.safetyNote,
      };
    });
  }

  /**
   * 获取工具描述文本
   */
  public getToolDescriptions(): string[] {
    return this.getAvailableTools().map((tool) => {
      let description = `- ${tool.name} (${tool.id}): ${tool.description}`;
      description += `\n  安全: ${formatToolSafety(tool)}`;

      // 添加参数描述
      if (tool.parameterDefs && tool.parameterDefs.length > 0) {
        description += '\n  参数:';
        for (const param of tool.parameterDefs) {
          const requiredMark = param.required ? '(必填)' : '(可选)';
          const typeMark = param.type ? `[${param.type}]` : '';
          const optionsMark = param.options
            ? ` 可选值:${param.options.join('/')}`
            : '';
          description += `\n    - ${param.name} ${requiredMark} ${typeMark}: ${param.description}${optionsMark}`;
        }
      }

      return description;
    });
  }

  private getToolSafetyPromptGuidance(): string {
    return `\n工具安全规则:\n- 只能直接调用“无需人工确认”的工具。\n- 如果工具标记为“需要人工确认”，或工具效果是写入、通知、删除，未获得明确批准前不要调用；请先结束本轮并把需要确认的动作写入摘要或建议。\n- 如果调用方已经提供批准，系统仍会按 tool id + 参数生成的批准 key 做执行前校验；批准 key 必须精确匹配本次工具和参数。`;
  }

  /**
   * 估算token数量
   */
  private estimateTokens(input: any, output: any): number {
    // 一个简单的估算方法是计算字符数，然后按照一定比例转换为tokens
    // 英文中大约每4个字符为1个token，为了简化我们使用字符数/4作为token估算
    const inputStr = typeof input === 'string' ? input : JSON.stringify(input);
    const outputStr =
      typeof output === 'string' ? output : JSON.stringify(output);

    const totalChars = inputStr.length + outputStr.length;
    const estimatedTokens = Math.ceil(totalChars / 4);

    return estimatedTokens;
  }

  /**
   * 执行思考-行动循环
   * 抽取自原analyzeMessage方法，用于单条消息的深度分析
   */
  private async loopThinking(
    result: AnalysisResult,
    normalizedInput: any,
    initialAnalysis: any,
    config: AnalysisConfig,
    context?: AnalysisContext,
    usedTools: Set<string> = new Set(),
  ): Promise<void> {
    // 初始化统计
    let llmCallCount = result.metaData.llmCallCount || 0;
    let llmCallTokens = result.metaData.llmCallTokens || 0;

    // 思考-行动循环
    const maxActions = config.maxActions || 5;
    const currentState = {
      input: normalizedInput,
      analysis: initialAnalysis,
      result,
      memory: {} as Record<string, any>,
      actionCount: 0,
      config,
      context,
      actionHistory: [] as ActionHistoryItem[],
      currentDecision: {
        confidence: result.confidence,
        summary: result.summary,
        // message
        reasonsToStore: result.reasonsToStore || [],
        isImportant: !!result.isImportant,
        shouldStore: !!result.shouldStore,
        shouldNotify: !!result.shouldNotify,
        notificationPriority: result.notificationPriority,
        replyAdvice: result.replyAdvice,
        // project
        riskLevel: result.riskLevel,
        suggestions: result.suggestions || {},
      },
    };

    let finished = false;

    while (currentState.actionCount < maxActions) {
      if (this.stopRequested) {
        const stopStep: ThoughtStep = {
          timestamp: Date.now(),
          thought: '用户已请求停止，保留当前分析结果并结束本轮处理。',
          publicSummary: '用户已请求停止，保留当前分析结果并结束本轮处理。',
          action: 'stopped',
        };
        this.thoughtProcess.push(stopStep);
        result.thoughtProcess.push(stopStep);
        finished = true;
        break;
      }

      // 思考下一步
      let thoughtResult: ThoughtResult;
      if (currentState.actionCount > 0) {
        thoughtResult = await this.think(currentState);
        llmCallCount += 1;
        llmCallTokens += this.estimateTokens(currentState, thoughtResult); // todo: 评估buildPromptTokens
      } else {
        thoughtResult = {
          thought: initialAnalysis.thought || '',
          nextAction: initialAnalysis.nextAction || 'finish',
          tools: initialAnalysis.tools || [],
          isImportant: initialAnalysis.isImportant,
          shouldStore: initialAnalysis.shouldStore,
          shouldNotify: initialAnalysis.shouldNotify,
          confidence: initialAnalysis.confidence,
          summary: initialAnalysis.summary,
          reasonsToStore: initialAnalysis.reasonsToStore,
          notificationPriority: initialAnalysis.notificationPriority,
          replyAdvice: initialAnalysis.replyAdvice,
          user_relation_type: initialAnalysis.user_relation_type,
        };
      }

      // 记录思考过程
      const thoughtStep: ThoughtStep = {
        timestamp: Date.now(),
        thought: thoughtResult.thought,
        publicSummary: this.buildThoughtStepPublicSummary(
          thoughtResult,
          currentState,
        ),
        action: thoughtResult.nextAction,
      };
      this.thoughtProcess.push(thoughtStep);
      result.thoughtProcess.push(thoughtStep);

      // 检查是否结束
      if (thoughtResult.nextAction === 'finish') {
        // 更新最终决策
        this.updateFinalDecision(result, thoughtResult, currentState);
        finished = true;
        break;
      }

      // 执行工具
      if (thoughtResult.tools && thoughtResult.tools.length > 0) {
        const toolExecutionResults = await this.executeTools(
          thoughtResult.tools,
          currentState,
          thoughtStep,
          usedTools,
        );

        // 特殊处理某些工具的结果
        thoughtResult.tools.forEach((tool) => {
          const toolCompleted = this.hasCompletedToolExecution(
            toolExecutionResults,
            tool.id,
          );

          if (!toolCompleted) {
            return;
          }

          // 如果是存储或通知工具，更新最终结果
          if (tool.id === 'messageStore' || tool.id === 'storeMessage') {
            result.shouldStore = true;
            currentState.currentDecision.shouldStore = true;
          } else if (tool.id === 'notifier' || tool.id === 'messageNotification') {
            result.shouldNotify = true;
            currentState.currentDecision.shouldNotify = true;
          }
        });
        if (
          thoughtResult.tools.some((tool) => tool.id === 'jiraQuery') &&
          currentState.memory['jiraQuery']
        ) {
          const latestJiraResult =
            currentState.memory['jiraQuery'][
              currentState.memory['jiraQuery'].length - 1
            ];
          if (
            latestJiraResult &&
            latestJiraResult.result &&
            latestJiraResult.result.result
          ) {
            if (!result.jiraIssues) result.jiraIssues = {};
            // 如果是多个Jira issues，添加到jiraIssues
            if (
              latestJiraResult.result.type === 'multiple' &&
              Array.isArray(latestJiraResult.result.result)
            ) {
              latestJiraResult.result.result.forEach((issue: any) => {
                if (issue.key) {
                  result.jiraIssues[issue.key] = issue;
                }
              });
            } else {
              result.jiraIssues[latestJiraResult.result.result.key] =
                latestJiraResult.result.result;
            }
          }
        }
      }

      // 增加行动计数
      currentState.actionCount++;
    }

    if (!finished && currentState.actionCount >= maxActions) {
      const budgetStep: ThoughtStep = {
        timestamp: Date.now(),
        thought: `已达到最大行动次数 ${maxActions}，使用当前已收集的信息结束本轮分析。`,
        publicSummary: `已达到最大行动次数 ${maxActions}，使用当前已收集的信息结束本轮分析。`,
        action: 'max_actions_reached',
      };
      this.thoughtProcess.push(budgetStep);
      result.thoughtProcess.push(budgetStep);
      this.updateFinalDecision(
        result,
        {
          thought: budgetStep.thought,
          nextAction: 'finish',
          tools: [],
          ...currentState.currentDecision,
        },
        currentState,
      );
    }

    // 更新元数据
    result.metaData.llmCallCount = llmCallCount;
    result.metaData.llmCallTokens = llmCallTokens;
    result.metaData.usedTools = Array.from(usedTools);
    this.aggregateLlmCallCount += llmCallCount;
    this.aggregateLlmCallTokens += llmCallTokens;
  }

  /**
   * 检测消息格式
   * 从全局函数移动到类方法
   */
  private detectMessageFormat(input: any): string {
    if (Array.isArray(input) && input[0] && this.isMessageGroupLike(input[0])) {
      return 'message_groups'; // 多个消息组
    } else if (this.isMessageGroupLike(input)) {
      return 'message_group'; // 单个消息组
    } else if (input.message_content || input.content || input.text) {
      return 'single_message'; // 单个消息
    } else {
      console.warn('未知的消息格式:', input);
      return 'unknown';
    }
  }

  private isMessageGroupLike(input: any): boolean {
    return Boolean(
      input &&
        (Array.isArray(input.posts) ||
          Array.isArray(input.standalone) ||
          Array.isArray(input.threads)),
    );
  }

  private normalizeMessageGroupMessages(group: any): any[] {
    const posts: Array<{
      id: string;
      sender: string;
      datetime: string;
      content: string;
      parentId?: string;
      threadRootPostId?: string;
      messageType?: 'root' | 'reply' | 'standalone' | 'message';
      raw: any;
    }> = [];
    const seen = new Set<string>();

    const addPost = (
      post: any,
      messageType: 'root' | 'reply' | 'standalone' | 'message',
      fallback?: { parentId?: string; threadRootPostId?: string },
    ) => {
      if (!post) return;
      const raw = post.raw ?? post;
      const id = String(
        post.post_id ??
          post.postId ??
          post.id ??
          raw.post_id ??
          raw.postId ??
          raw.id ??
          fallback?.threadRootPostId ??
          '',
      ).trim();
      const sender = String(
        post.sender ?? post.creator ?? raw.sender ?? raw.creator ?? '',
      ).trim();
      const datetime = String(
        post.datetime ?? post.time ?? raw.datetime ?? raw.time ?? '',
      ).trim();
      const content = String(
        post.messageContent ??
          post.message_content ??
          post.content ??
          post.text ??
          raw.messageContent ??
          raw.message_content ??
          raw.content ??
          raw.text ??
          '',
      );
      if (!id && !content.trim()) return;

      const parentId = String(
        post.parentId ??
          post.parent_id ??
          post.reply_to ??
          raw.parentId ??
          raw.parent_id ??
          raw.reply_to ??
          fallback?.parentId ??
          '',
      ).trim();
      const threadRootPostId = String(
        post.threadRootPostId ??
          post.rootPostId ??
          raw.threadRootPostId ??
          raw.rootPostId ??
          fallback?.threadRootPostId ??
          '',
      ).trim();
      const dedupeKey = id || [sender, datetime, content].join('\n');
      if (seen.has(dedupeKey)) return;
      seen.add(dedupeKey);
      posts.push({
        id,
        sender,
        datetime,
        content,
        parentId: parentId || undefined,
        threadRootPostId: threadRootPostId || undefined,
        messageType,
        raw,
      });
    };

    for (const post of group?.posts || []) {
      addPost(post, 'message');
    }
    for (const post of group?.standalone || []) {
      addPost(post, 'standalone');
    }
    for (const thread of group?.threads || []) {
      const rootId = String(thread?.rootPostId || thread?.rootId || '').trim();
      addPost(thread?.rootPost, 'root', { threadRootPostId: rootId });
      for (const reply of thread?.replies || []) {
        addPost(reply, 'reply', {
          parentId: reply?.parentId || reply?.parent_id || rootId,
          threadRootPostId: rootId,
        });
      }
    }

    return posts.map((post) => ({
      messageContent: post.content,
      message_content: post.content,
      content: post.content,
      sender: post.sender,
      datetime: post.datetime,
      groupName: group.groupName,
      team_name: group.groupName,
      groupId: group.groupId,
      team_id: group.groupId,
      postId: post.id,
      post_id: post.id,
      id: post.id,
      parentId: post.parentId,
      parent_id: post.parentId,
      threadRootPostId: post.threadRootPostId,
      messageType: post.messageType,
      raw: post.raw,
    }));
  }

  /**
   * 更新最终决策
   */
  private updateFinalDecision(
    result: any,
    thoughtResult: ThoughtResult,
    state: any,
  ): void {
    // 更新消息分析结果
    if (thoughtResult.isImportant !== undefined) {
      result.isImportant = thoughtResult.isImportant;
      state.currentDecision.isImportant = thoughtResult.isImportant;
    }

    if (thoughtResult.confidence !== undefined) {
      result.confidence = thoughtResult.confidence;
      state.currentDecision.confidence = thoughtResult.confidence;
    }

    if (thoughtResult.summary) {
      result.summary = thoughtResult.summary;
      state.currentDecision.summary = thoughtResult.summary;
    }

    if (result.type === 'message') {
      if (thoughtResult.shouldStore !== undefined) {
        result.shouldStore = thoughtResult.shouldStore;
        state.currentDecision.shouldStore = thoughtResult.shouldStore;
      }

      if (thoughtResult.shouldNotify !== undefined) {
        result.shouldNotify = thoughtResult.shouldNotify;
        state.currentDecision.shouldNotify = thoughtResult.shouldNotify;
      }

      if (thoughtResult.reasonsToStore) {
        result.reasonsToStore = thoughtResult.reasonsToStore;
        state.currentDecision.reasonsToStore = thoughtResult.reasonsToStore;
      }

      if (thoughtResult.notificationPriority) {
        result.notificationPriority = thoughtResult.notificationPriority;
        state.currentDecision.notificationPriority =
          thoughtResult.notificationPriority;
      }

      if (thoughtResult.replyAdvice) {
        result.replyAdvice = thoughtResult.replyAdvice;
        state.currentDecision.replyAdvice = thoughtResult.replyAdvice;
      }

      if (thoughtResult.user_relation_type) {
        result.user_relation_type = thoughtResult.user_relation_type;
        state.currentDecision.user_relation_type =
          thoughtResult.user_relation_type;
      }
    }
    // 更新项目分析结果
    else if (result.type === 'project') {
      if (thoughtResult.riskLevel) {
        result.riskLevel = thoughtResult.riskLevel;
        state.currentDecision.riskLevel = thoughtResult.riskLevel;
      }

      if (
        thoughtResult.suggestions &&
        Object.keys(thoughtResult.suggestions).length > 0
      ) {
        result.suggestions = {
          ...result.suggestions,
          ...thoughtResult.suggestions,
        };
        state.currentDecision.suggestions = result.suggestions;
      }

      if (thoughtResult.timeline) {
        result.timeline = thoughtResult.timeline;
        state.currentDecision.timeline = thoughtResult.timeline;
      }
    }
    // 如果需要，可以添加其他类型的结果更新逻辑
  }

  private clipAgentDisplayText(text: any, maxLength = 160): string {
    const cleanText = String(text || '')
      .replace(/\s+/g, ' ')
      .trim();
    if (cleanText.length <= maxLength) return cleanText;
    return `${cleanText.substring(0, maxLength)}...`;
  }

  private buildThoughtStepPublicSummary(
    thoughtResult: Partial<ThoughtResult> & { reasoning?: string },
    state?: any,
  ): string {
    const nextAction = thoughtResult.nextAction || 'finish';
    const tools = Array.isArray(thoughtResult.tools)
      ? thoughtResult.tools
          .map((tool) => tool?.id)
          .filter(Boolean)
      : [];

    if (nextAction === 'finish') {
      const summary =
        thoughtResult.summary ||
        state?.currentDecision?.summary ||
        thoughtResult.reasoning;
      return summary
        ? `已有足够信息，准备输出结果：${this.clipAgentDisplayText(summary)}`
        : '已有足够信息，准备输出当前分析结果。';
    }

    if (tools.length > 0) {
      return `准备调用 ${tools.join('、')} 补充证据或上下文。`;
    }

    return (
      this.clipAgentDisplayText(
        thoughtResult.summary || thoughtResult.reasoning || thoughtResult.thought,
      ) || '已记录当前分析判断。'
    );
  }

  /**
   * 分析项目
   */
  private async analyzeProject(
    input: any,
    config: AnalysisConfig,
    context?: AnalysisContext,
  ): Promise<ProjectAnalysisResult> {
    // 初始化思考过程记录
    this.thoughtProcess = [];

    // 初始化统计
    let llmCallCount = 0;
    let llmCallTokens = 0;
    const usedTools = new Set<string>();

    try {
      // 标准化输入
      const normalizedInput = this.normalizeInput(input, config);

      // 初始分析
      const initialAnalysis = await this.initialAnalysis(
        normalizedInput,
        config,
        context,
      );
      llmCallCount += 1;
      llmCallTokens += this.estimateTokens(normalizedInput, initialAnalysis);

      // 创建初始结果对象
      const result: ProjectAnalysisResult = {
        type: 'project',
        confidence: initialAnalysis.confidence || 0,
        summary: initialAnalysis.summary || '',
        projectId: normalizedInput.id || normalizedInput.project?.id || '',
        projectName:
          normalizedInput.name || normalizedInput.project?.name || '',
        riskLevel: initialAnalysis.riskLevel || 'normal',
        timeline: initialAnalysis.timeline || { onTrack: true, concerns: [] },
        resourceAllocation: initialAnalysis.resourceAllocation || {
          concerns: [],
        },
        suggestions: initialAnalysis.suggestions || {},
        thoughtProcess: [] as ThoughtStep[],
        jiraIssues: normalizedInput.jiraIssues || {},
        metaData: {
          llmCallCount,
          llmCallTokens,
          usedTools: Array.from(usedTools),
          timestamp: Date.now(),
        },
      };

      // 如果有Jira数据，添加到结果

      // 执行思考-行动循环
      await this.loopThinking(
        result,
        normalizedInput,
        initialAnalysis,
        config,
        context,
        usedTools,
      );

      return result;
    } catch (error) {
      console.error('项目分析失败:', error);

      return {
        type: 'project',
        confidence: 0,
        summary: `分析失败: ${error.message}`,
        projectId: input.id || input.project?.id || '',
        projectName: input.name || input.project?.name || '',
        riskLevel: 'normal',
        metaData: {
          llmCallCount,
          llmCallTokens,
          usedTools: Array.from(usedTools),
          timestamp: Date.now(),
        },
        suggestions: {},
      };
    }
  }

  /**
   * 网页内容分析
   * 分析网页内容并提取项目管理相关信息
   */
  private async analyzeWebpage(
    input: WebpageAnalysisInput,
    config: AnalysisConfig,
    context?: AnalysisContext,
  ): Promise<WebpageAnalysisResult> {
    // 初始化思考过程记录
    this.thoughtProcess = [];

    // 初始化统计
    let llmCallCount = 0;
    let llmCallTokens = 0;
    const usedTools = new Set<string>();

    try {
      const pageTitle = input.title || (input as any).sourceTitle || '未命名网页';
      const pageUrl = input.url || (input as any).sourceUrl || '';
      const mainContent =
        input.mainContent || (input as any).content || (input as any).text || '';
      const rawChromeAIResult =
        input.chromeAIResult || (input as any).quickAnalysis || undefined;
      const chromeAIResult = rawChromeAIResult
        ? {
            ...rawChromeAIResult,
            relevance:
              rawChromeAIResult.relevance ?? rawChromeAIResult.confidence ?? 0,
            shouldStore:
              rawChromeAIResult.shouldStore ??
              rawChromeAIResult.suggestedStorage ??
              false,
            entities:
              rawChromeAIResult.entities ||
              rawChromeAIResult.extractedInfo ||
              {},
            reasoning:
              rawChromeAIResult.reasoning ||
              rawChromeAIResult.summary ||
              '快速分析未提供理由',
          }
        : undefined;
      const domain =
        input.domain ||
        (() => {
          try {
            return pageUrl ? new URL(pageUrl).hostname : '';
          } catch (_error) {
            return '';
          }
        })();
      const normalizedInput: WebpageAnalysisInput = {
        ...input,
        title: pageTitle,
        url: pageUrl,
        domain,
        mainContent,
        chromeAIResult,
      };

      console.log('🌐 开始分析网页内容:', pageTitle);

      // 提取基本页面信息
      const pageInfo = {
        title: pageTitle,
        url: pageUrl,
        domain,
        extractedAt: Date.now(),
      };

      // 构建分析上下文
      const analysisContext = `
网页标题: ${pageTitle}
网页URL: ${pageUrl}
网页域名: ${pageInfo.domain}
主要内容: ${mainContent.substring(0, 2000)}...

${
  chromeAIResult
    ? `
Chrome AI 预分析结果:
- 相关性评分: ${chromeAIResult.relevance}
- 建议存储: ${chromeAIResult.shouldStore}
- 分析理由: ${chromeAIResult.reasoning}
- 关键洞察: ${chromeAIResult.keyInsights?.join(', ') || '无'}
- 可执行项: ${chromeAIResult.actionableItems?.join(', ') || '无'}
`
    : ''
}

用户上下文:
- 当前项目: ${input.userContext?.currentProjects?.join(', ') || '未知'}
- 关注话题: ${input.userContext?.concernedTopics?.join(', ') || '未知'}
- 团队成员: ${input.userContext?.teamMembers?.join(', ') || '未知'}
      `;

      // 初始LLM分析
      const initialAnalysis = await this.performWebpageInitialAnalysis(
        analysisContext,
        config,
      );
      llmCallCount += 1;
      llmCallTokens += this.estimateTokens(
        analysisContext,
        JSON.stringify(initialAnalysis),
      );

      // 创建初始结果对象
      const result: WebpageAnalysisResult = {
        type: 'webpage',
        confidence: initialAnalysis.confidence || 0,
        summary: initialAnalysis.summary || '',

        pageInfo,

        chromeAIAnalysis: chromeAIResult
          ? {
              relevance: chromeAIResult.relevance,
              reasoning: chromeAIResult.reasoning,
              initialEntities: chromeAIResult.entities || {},
            }
          : undefined,

        contentRelevance:
          initialAnalysis.contentRelevance ||
          chromeAIResult?.relevance ||
          0,
        shouldStore:
          initialAnalysis.shouldStore !== undefined
            ? initialAnalysis.shouldStore
            : chromeAIResult?.shouldStore || false,
        shouldNotify: initialAnalysis.shouldNotify || false,

        extractedEntities: initialAnalysis.extractedEntities || {},
        relatedProjects: [],
        relatedMemories: [],

        contentCategory: initialAnalysis.contentCategory || 'general',
        tags: initialAnalysis.tags || [],

        storageRecommendation: initialAnalysis.storageRecommendation || {
          priority: 'low',
          importanceScore: 0.3,
        },

        actionSuggestions: initialAnalysis.actionSuggestions || [],

        thoughtProcess: [],
        metaData: {
          llmCallCount,
          llmCallTokens,
          usedTools: Array.from(usedTools),
          timestamp: Date.now(),
        },
      };

      // 执行思考-行动循环进行深度分析
      const webpageThinkingStats = await this.loopWebpageThinking(
        result,
        normalizedInput,
        initialAnalysis,
        config,
        context,
        usedTools,
      );
      llmCallCount += webpageThinkingStats.llmCallCount;
      llmCallTokens += webpageThinkingStats.llmCallTokens;

      // 更新最终统计
      result.metaData.llmCallCount = llmCallCount;
      result.metaData.llmCallTokens = llmCallTokens;
      result.metaData.usedTools = Array.from(usedTools);

      console.log(`✅ 网页分析完成: ${result.summary}`);
      return result;
    } catch (error) {
      console.error('❌ 网页分析失败:', error);

      return {
        type: 'webpage',
        confidence: 0,
        summary: `网页分析失败: ${error.message}`,

        pageInfo: {
          title: input.title || (input as any).sourceTitle || '未命名网页',
          url: input.url || (input as any).sourceUrl || '',
          domain: input.domain || '',
          extractedAt: Date.now(),
        },

        contentRelevance: 0,
        shouldStore: false,
        shouldNotify: false,

        extractedEntities: {},

        contentCategory: 'general',
        tags: [],

        storageRecommendation: {
          priority: 'low',
          importanceScore: 0,
        },

        thoughtProcess: [],
        metaData: {
          llmCallCount,
          llmCallTokens,
          usedTools: Array.from(usedTools),
          timestamp: Date.now(),
        },
      };
    }
  }

  /**
   * 网页内容初始分析
   */
  private async performWebpageInitialAnalysis(
    context: string,
    _config: AnalysisConfig,
  ): Promise<any> {
    const prompt = `你是一个专业的项目管理智能助手。请分析以下网页内容，判断其与项目管理的相关性，并提取关键信息。

${context}

请分析并返回JSON格式的结果，包含以下字段：
{
  "confidence": 0.85, // 分析可信度 0-1
  "summary": "网页内容的简要总结",
  "contentRelevance": 0.7, // 与项目管理的相关性 0-1
  "shouldStore": true, // 是否建议存储到知识库
  "shouldNotify": false, // 是否需要通知用户
  
  "extractedEntities": {
    "projects": ["项目A", "模块B"], // 识别的项目
    "people": ["张三", "李四"], // 识别的人员
    "deadlines": ["2024-12-31"], // 截止日期（ISO格式）
    "actionItems": ["完成需求评审", "更新设计文档"], // 行动项
    "technologies": ["React", "Node.js"], // 技术栈
    "organizations": ["前端团队", "产品组"], // 组织/团队
    "topics": ["性能优化", "用户体验"] // 主要话题
  },
  
  "contentCategory": "project_update", // project_update|technical_doc|meeting_notes|planning|announcement|general
  "tags": ["前端", "性能", "紧急"], // 标签
  
  "storageRecommendation": {
    "priority": "high", // high|medium|low
    "importanceScore": 0.8, // 重要性评分 0-1
    "retentionReason": "包含重要的项目进度信息",
    "expiryDate": "2025-01-31" // 可选的过期日期
  },
  
  "actionSuggestions": [
    {
      "type": "notify_team", // notify_team|update_project|schedule_follow_up|create_task
      "description": "通知团队最新进度",
      "priority": "important", // urgent|important|normal
      "suggestedDate": "2024-12-21" // 建议执行日期
    }
  ]
}

请确保返回有效的JSON格式。`;

    try {
      const response = await callLLMJsonAPI({ prompt, type: 'query' });
      return response;
    } catch (error) {
      console.error('网页初始分析失败:', error);
      return {
        confidence: 0.3,
        summary: '分析失败，使用默认结果',
        contentRelevance: 0.2,
        shouldStore: false,
        shouldNotify: false,
        extractedEntities: {},
        contentCategory: 'general',
        tags: [],
        storageRecommendation: { priority: 'low', importanceScore: 0.2 },
        actionSuggestions: [],
      };
    }
  }

  /**
   * 网页分析的思考-行动循环
   */
  private async loopWebpageThinking(
    result: WebpageAnalysisResult,
    input: WebpageAnalysisInput,
    initialAnalysis: any,
    config: AnalysisConfig,
    context?: AnalysisContext,
    usedTools?: Set<string>,
  ): Promise<WebpageThinkingStats> {
    const maxActions = config.maxActions || 3;
    let actionCount = 0;
    let llmCallCount = 0;
    let llmCallTokens = 0;
    const executedActionKeys = new Set<string>();

    while (actionCount < maxActions) {
      try {
        // 构建思考上下文
        const thinkingContext = this.buildWebpageThinkingContext(
          result,
          input,
          initialAnalysis,
        );

        // LLM思考下一步行动
        const thoughtResult = await this.webpageThinkAndDecide(
          thinkingContext,
          config,
        );
        llmCallCount += 1;
        llmCallTokens += this.estimateTokens(thinkingContext, thoughtResult);

        // 记录思考过程
        const thoughtStep: ThoughtStep = {
          timestamp: Date.now(),
          stepNumber: actionCount + 1,
          thought: thoughtResult.thought,
          publicSummary: this.buildThoughtStepPublicSummary({
            ...thoughtResult,
            nextAction:
              thoughtResult.nextAction === 'continue'
                ? 'use_tool'
                : thoughtResult.nextAction,
          }),
          action: thoughtResult.nextAction,
          tools: thoughtResult.tools,
          result: thoughtResult.reasoning || '',
        };
        this.thoughtProcess.push(thoughtStep);

        // 如果决定不需要更多行动，退出循环
        if (
          thoughtResult.nextAction === 'finish' ||
          !thoughtResult.tools ||
          thoughtResult.tools.length === 0
        ) {
          console.log('🎯 网页分析决策完成');
          break;
        }

        // 执行工具
        const toolResults: Record<string, any> = {};
        thoughtStep.toolUsed = thoughtResult.tools
          .map((toolCall: { id: string }) => toolCall.id)
          .join(', ');

        for (const toolCall of thoughtResult.tools) {
          const actionKey = buildAgentToolCallKey({
            id: toolCall.id,
            params: toolCall.params || {},
          });

          if (executedActionKeys.has(actionKey)) {
            this.appendToolResult(toolResults, toolCall.id, {
              skipped: true,
              message: '已跳过重复工具调用',
              params: toolCall.params,
              actionKey,
            });
            continue;
          }

          executedActionKeys.add(actionKey);

          const validation = this.validateToolCall(
            toolCall.id,
            toolCall.params || {},
            { result, config, context },
            actionKey,
          );

          if (validation.ok === false) {
            this.appendToolResult(toolResults, toolCall.id, {
              blocked: true,
              approvalRequired: validation.reason === 'approval_required',
              reason: validation.reason,
              message: validation.message,
              params: toolCall.params,
              actionKey,
              effect: validation.effect,
              riskLevel: validation.riskLevel,
              safetyNote: validation.safetyNote,
              approvalKey: validation.approvalKey,
            });
            continue;
          }

          if (usedTools) {
            usedTools.add(toolCall.id);
          }

          try {
            const toolResult = await this.executeTool(
              toolCall.id,
              toolCall.params || {},
              { result, config, context },
            );
            // console.log(`🔧 工具 ${toolCall.id} 执行结果:`, toolResult.message);
            this.appendToolResult(toolResults, toolCall.id, toolResult);

            // 根据工具结果更新分析结果
            this.updateWebpageResultFromTool(result, toolCall.id, toolResult);
          } catch (toolError) {
            console.error(`工具 ${toolCall.id} 执行失败:`, toolError);
            this.appendToolResult(toolResults, toolCall.id, {
              error: `工具执行失败: ${toolError.message || toolError}`,
              params: toolCall.params,
              actionKey,
            });
          }
        }
        thoughtStep.toolResult = JSON.stringify(toolResults);

        actionCount++;
      } catch (error) {
        console.error(`思考循环第 ${actionCount + 1} 步失败:`, error);
        break;
      }
    }

    if (actionCount >= maxActions) {
      this.thoughtProcess.push({
        timestamp: Date.now(),
        stepNumber: actionCount + 1,
        thought: `已达到最大行动次数 ${maxActions}，使用当前网页分析结果结束本轮处理。`,
        publicSummary: `已达到最大行动次数 ${maxActions}，使用当前网页分析结果结束本轮处理。`,
        action: 'max_actions_reached',
      });
    }

    // 将思考过程添加到结果中
    result.thoughtProcess = this.thoughtProcess;
    return { llmCallCount, llmCallTokens };
  }

  /**
   * 构建网页分析思考上下文
   */
  private buildWebpageThinkingContext(
    result: WebpageAnalysisResult,
    input: WebpageAnalysisInput,
    _initialAnalysis: any,
  ): string {
    const formatDeadline = (deadline: Date | string): string => {
      if (deadline instanceof Date) {
        return deadline.toISOString().split('T')[0];
      }
      return String(deadline);
    };

    return `当前网页分析状态:
网页: ${result.pageInfo.title} (${result.pageInfo.url})
相关性: ${result.contentRelevance}
建议存储: ${result.shouldStore}
内容分类: ${result.contentCategory}

已提取实体:
- 项目: ${result.extractedEntities.projects?.join(', ') || '无'}
- 人员: ${result.extractedEntities.people?.join(', ') || '无'}
- 截止日期: ${result.extractedEntities.deadlines?.map(formatDeadline).join(', ') || '无'}
- 行动项: ${result.extractedEntities.actionItems?.join(', ') || '无'}

Chrome AI预分析: ${input.chromeAIResult ? '已完成，相关性' + input.chromeAIResult.relevance : '未进行'}

当前分析总结: ${result.summary}

可用工具:
${this.getToolDescriptions().join('\n')}
${this.getToolSafetyPromptGuidance()}`;
  }

  /**
   * 网页分析思考和决策
   */
  private async webpageThinkAndDecide(
    context: string,
    _config: AnalysisConfig,
  ): Promise<any> {
    const prompt = `你是一个智能网页分析助手。基于当前分析状态，决定下一步行动。

${context}

请思考并决定下一步行动，返回JSON格式：
{
  "thought": "给用户看的简短决策摘要（一句话），不要输出完整逐步推理或隐藏思考",
  "nextAction": "continue|finish", // continue继续分析，finish完成分析
  "reasoning": "决策理由",
  "tools": [
    {
      "id": "工具名称",
      "params": {
        "参数名": "参数值"
      }
    }
  ]
}

可选工具及其用途：
${this.getToolDescriptions().join('\n')}
${this.getToolSafetyPromptGuidance()}

只允许使用上述工具ID: ${this.getAvailableToolIdList()}。不要调用未列出的工具。

请确保返回有效的JSON。`;

    try {
      return await callLLMJsonAPI({ prompt, type: 'query' });
    } catch (error) {
      console.error('网页思考决策失败:', error);
      return {
        thought: '分析遇到错误，结束处理',
        nextAction: 'finish',
        reasoning: '由于错误而结束',
        tools: [],
      };
    }
  }

  /**
   * 根据工具结果更新网页分析结果
   */
  private updateWebpageResultFromTool(
    result: WebpageAnalysisResult,
    toolId: string,
    toolResult: any,
  ): void {
    switch (toolId) {
      case 'entityExtraction':
        if (toolResult.result?.entities) {
          // 合并提取的实体
          const entities = toolResult.result.entities;
          const extractedEntities: Record<string, (string | Date)[]> =
            result.extractedEntities;
          Object.keys(entities).forEach((key) => {
            if (entities[key] && Array.isArray(entities[key])) {
              if (!extractedEntities[key]) {
                extractedEntities[key] = [];
              }
              extractedEntities[key] = [
                ...new Set([...extractedEntities[key], ...entities[key]]),
              ];
            }
          });
        }
        break;

      case 'historySearch':
        if (toolResult.result?.memories) {
          result.relatedMemories = toolResult.result.memories.map((memory: any) => ({
            memoryId: memory.id,
            summary: memory.summary || memory.content?.substring(0, 100) || '',
            relevanceScore: memory.score || 0.5,
            type: memory.type || 'webpage',
          }));
        }
        break;

      case 'storeMessage':
        result.shouldStore = true;
        result.storageRecommendation.priority = 'high';
        break;

      case 'messageNotification':
        result.shouldNotify = true;
        break;

      case 'jiraQuery':
        if (toolResult.result?.projects) {
          result.relatedProjects = toolResult.result.projects.map(
            (project: any) => ({
              projectId: project.id,
              projectName: project.name,
              relevanceScore: 0.8,
              relationshipType: 'reference' as const,
            }),
          );
        }
        break;
    }
  }

  /**
   * 执行工具
   */
  private async executeTool(
    toolId: string,
    params: Record<string, any>,
    state: any,
  ): Promise<any> {
    const validation = this.validateToolCall(toolId, params, state);
    if (validation.ok === false) {
      throw new Error(validation.message);
    }

    const tool = validation.tool;

    // 执行工具
    try {
      const result = await tool.execute(params, state);
      return result;
    } catch (error) {
      console.error(`工具 ${toolId} 执行错误:`, error);
      throw error;
    }
  }

  private validateToolCall(
    toolId: string,
    params: Record<string, any> = {},
    state?: any,
    actionKey = buildAgentToolCallKey({ id: toolId, params }),
  ): ToolCallValidationResult {
    const tool = toolRegistry[toolId];

    if (!tool) {
      return {
        ok: false,
        reason: 'unknown_tool',
        message: `工具 ${toolId} 未注册，已阻断调用。当前可用工具: ${this.getAvailableToolIdList()}`,
      };
    }

    const missingParams = (tool.parameterDefs || [])
      .filter((param) => {
        const value = params[param.name];
        return (
          param.required &&
          (value === undefined || value === null || value === '')
        );
      })
      .map((param) => param.name);

    if (missingParams.length > 0) {
      return {
        ok: false,
        reason: 'missing_params',
        message: `工具 ${toolId} 缺少必填参数 ${missingParams.join(', ')}，已阻断调用。`,
      };
    }

    const safety = getToolSafety(tool);
    if (
      safety.requiresHumanApproval &&
      !this.isToolActionApproved(toolId, actionKey, state)
    ) {
      return {
        ok: false,
        reason: 'approval_required',
        effect: safety.effect,
        riskLevel: safety.riskLevel,
        safetyNote: safety.safetyNote,
        approvalKey: actionKey,
        message:
          `工具 ${toolId} 属于${TOOL_RISK_LABELS[safety.riskLevel]}${TOOL_EFFECT_LABELS[safety.effect]}动作，需要人工确认，已阻断执行。` +
          ` 批准 key: ${actionKey}`,
      };
    }

    return { ok: true, tool };
  }

  private isToolActionApproved(
    _toolId: string,
    actionKey: string,
    state?: any,
  ): boolean {
    const approvalSources = [
      state?.approvedToolActionKeys,
      state?.toolApprovalKeys,
      state?.config?.approvedToolActionKeys,
      state?.config?.toolApprovalKeys,
      state?.context?.approvedToolActionKeys,
      state?.context?.toolApprovalKeys,
    ];

    return approvalSources.some((source) => {
      if (Array.isArray(source)) return source.includes(actionKey);
      if (source instanceof Set) return source.has(actionKey);
      if (!source || typeof source !== 'object') return false;
      return source[actionKey] === true;
    });
  }

  private appendToolResult(
    resultMap: Record<string, any>,
    toolId: string,
    result: any,
  ): void {
    if (Object.prototype.hasOwnProperty.call(resultMap, toolId)) {
      const existing = resultMap[toolId];
      resultMap[toolId] = Array.isArray(existing)
        ? [...existing, result]
        : [existing, result];
      return;
    }

    resultMap[toolId] = result;
  }

  private flattenToolExecutionResultValues(value: any): any[] {
    if (Array.isArray(value)) {
      return value.flatMap((item) =>
        this.flattenToolExecutionResultValues(item),
      );
    }
    return [value];
  }

  private isCompletedToolExecutionResult(value: any): boolean {
    if (!value || typeof value !== 'object') return false;
    return !(
      value.error ||
      value.blocked ||
      value.skipped ||
      value.approvalRequired ||
      value.success === false ||
      value.result?.success === false
    );
  }

  private hasCompletedToolExecution(
    resultMap: Record<string, any>,
    toolId: string,
  ): boolean {
    if (!Object.prototype.hasOwnProperty.call(resultMap, toolId)) {
      return false;
    }

    return this.flattenToolExecutionResultValues(resultMap[toolId]).some(
      (value) => this.isCompletedToolExecutionResult(value),
    );
  }

  /**
   * 批量执行多个工具
   */
  private async executeTools(
    tools: { id: string; params: Record<string, any> }[],
    state: any,
    thoughtStep: ThoughtStep,
    usedTools: Set<string>,
  ): Promise<Record<string, any>> {
    if (!tools || tools.length === 0) {
      return {};
    }

    thoughtStep.toolUsed = tools.map((tool) => tool.id).join(', '); // 记录所有使用的工具

    const existingActionKeys = new Set<string>(
      (state.actionHistory || [])
        .map((action: ActionHistoryItem) => {
          const actionKey =
            action.actionKey ||
            buildAgentToolCallKey({
              id: action.tool,
              params: action.params || {},
            });
          if (
            action.approvalRequired &&
            this.isToolActionApproved(action.tool, actionKey, state)
          ) {
            return '';
          }
          return actionKey;
        })
        .filter(Boolean),
    );

    // 并发执行所有选择的工具
    const toolPromises = tools.map(
      async (t: { id: string; params: Record<string, any> }) => {
        const toolId = t.id;
        const actionKey = buildAgentToolCallKey({
          id: toolId,
          params: t.params || {},
        });

        if (existingActionKeys.has(actionKey)) {
          console.warn(`跳过重复工具调用: ${toolId}`, t.params);
          return {
            toolId,
            params: t.params,
            actionKey,
            skipped: true,
            message: '已跳过重复工具调用',
          };
        }

        existingActionKeys.add(actionKey);

        const validation = this.validateToolCall(
          toolId,
          t.params || {},
          state,
          actionKey,
        );
        if (validation.ok === false) {
          console.warn(`阻断无效工具调用: ${toolId}`, t.params);
          return {
            toolId,
            params: t.params,
            actionKey,
            blocked: true,
            approvalRequired: validation.reason === 'approval_required',
            reason: validation.reason,
            message: validation.message,
            effect: validation.effect,
            riskLevel: validation.riskLevel,
            safetyNote: validation.safetyNote,
            approvalKey: validation.approvalKey,
          };
        }

        const tool = validation.tool;
        console.log(`执行工具: ${tool.name} (${tool.id})`, t.params);

        try {
          const toolResult = await this.executeTool(
            toolId,
            t.params || {},
            state,
          );

          // 添加到已使用工具集合
          usedTools.add(toolId);

          return {
            toolId: tool.id,
            params: t.params,
            result: toolResult,
            actionKey,
          };
        } catch (error) {
          console.error(`工具执行失败: ${tool.id}`, error);
          return {
            toolId: tool.id,
            params: t.params,
            actionKey,
            error: `工具执行失败: ${error.message}`,
          };
        }
      },
    );

    // 等待所有工具执行完毕
    const toolResults = await Promise.all(toolPromises);

    // 更新思考步骤结果
    const resultMap = toolResults.reduce(
      (acc, curr) => {
        this.appendToolResult(
          acc,
          curr.toolId,
          curr.error
            ? { error: curr.error, params: curr.params, actionKey: curr.actionKey }
            : curr.blocked
              ? {
                  blocked: true,
                  approvalRequired: curr.approvalRequired,
                  reason: curr.reason,
                  message: curr.message,
                  params: curr.params,
                  actionKey: curr.actionKey,
                  effect: curr.effect,
                  riskLevel: curr.riskLevel,
                  safetyNote: curr.safetyNote,
                  approvalKey: curr.approvalKey,
                }
            : curr.skipped
              ? {
                  skipped: true,
                  message: curr.message,
                  params: curr.params,
                  actionKey: curr.actionKey,
                }
              : curr.result,
        );
        return acc;
      },
      {} as Record<string, any>,
    );

    // 将执行结果添加到思考步骤
    thoughtStep.toolResult = JSON.stringify(resultMap);

    // 将所有工具结果存入内存
    toolResults.forEach((tr) => {
      if (!tr.error && !tr.skipped && !tr.blocked) {
        if (!state.memory[tr.toolId]) {
          state.memory[tr.toolId] = [];
        }
        state.memory[tr.toolId].push({ params: tr.params, result: tr.result });
      }

      if (!tr.error) {
        state.actionHistory.push({
          tool: tr.toolId,
          params: tr.params,
          result: tr.skipped
            ? '已跳过重复工具调用'
            : tr.blocked
              ? tr.message || '已阻断无效工具调用'
            : JSON.stringify(tr.result).substring(0, 500), // 限制长度
          actionKey: tr.actionKey,
          skipped: tr.skipped,
          blocked: tr.blocked,
          approvalRequired: tr.approvalRequired,
        });
      }
    });

    return resultMap;
  }

  /**
   * 分析会议
   */
  private async analyzeMeeting(
    _input: any,
    _config: AnalysisConfig,
    _context?: AnalysisContext,
  ): Promise<MeetingAnalysisResult> {
    // 会议分析的具体实现
    // 实际类似于analyzeMessage，但返回MeetingAnalysisResult

    // 示例实现（实际项目中需要完善）
    return {
      type: 'meeting',
      confidence: 0.8,
      summary: '会议分析结果',
      topics: [],
      decisions: [],
      actionItems: [],
      followups: [],
      metaData: {
        llmCallCount: 1,
        llmCallTokens: 1000,
        usedTools: [],
        timestamp: Date.now(),
      },
    };
  }

  /**
   * 分析文档
   */
  private async analyzeDocument(
    input: any,
    _config: AnalysisConfig,
    _context?: AnalysisContext,
  ): Promise<any> {
    // 文档分析的具体实现
    // 未来需要完善

    return {
      type: 'document',
      confidence: 0.8,
      summary: '文档分析结果',
      title: input?.title || '未知文档',
      documentType: input?.type || 'other',
      sections: [],
      keyPoints: [],
      metaData: {
        llmCallCount: 1,
        llmCallTokens: 1000,
        usedTools: [],
        timestamp: Date.now(),
      },
    };
  }

  /**
   * 通用分析（当未指定具体类型时）
   */
  private async analyzeGeneric(
    _input: any,
    _config: AnalysisConfig,
    _context?: AnalysisContext,
  ): Promise<GenericAnalysisResult> {
    // 通用分析的具体实现
    return {
      type: 'generic',
      confidence: 0.5,
      summary: '通用分析结果',
      metaData: {
        llmCallCount: 1,
        llmCallTokens: 500,
        usedTools: [],
        timestamp: Date.now(),
      },
    };
  }

  /**
   * 标准化输入数据格式
   */
  private normalizeInput(input: any, config: AnalysisConfig): any {
    // 根据分析类型标准化输入
    const normalized = { ...input };

    // 消息类型的标准化处理
    if (config.type === 'message') {
      // 确保message_content字段存在
      if (!normalized.message_content && normalized.content) {
        normalized.message_content = normalized.content;
      }

      // 确保groupName和groupId字段存在
      if (!normalized.groupName && normalized.team_name) {
        normalized.groupName = normalized.team_name;
      }
      if (!normalized.groupId && normalized.team_id) {
        normalized.groupId = normalized.team_id;
      }

      // 确保datetime字段存在
      if (!normalized.datetime && normalized.timestamp) {
        normalized.datetime = new Date(normalized.timestamp).toISOString();
      }

      // 如果username字段存在但没有current_user字段，添加它
      if (normalized.username && !normalized.current_user) {
        normalized.current_user = normalized.username;
      }
    }

    return normalized;
  }

  /**
   * 初始LLM分析
   */
  private async initialAnalysis(
    normalizedInput: any,
    config: AnalysisConfig,
    context?: AnalysisContext,
  ): Promise<any> {
    // 根据分析类型构建提示
    let analysisPrompt = '';

    switch (config.type) {
      case 'message':
        analysisPrompt = await this.buildMessageAnalysisPrompt(
          normalizedInput,
          config,
          context,
        );
        break;
      case 'project':
        analysisPrompt = await this.buildProjectAnalysisPrompt(
          normalizedInput,
          config,
          context,
        );
        break;
      case 'meeting':
        analysisPrompt = await this.buildMeetingAnalysisPrompt(
          normalizedInput,
          config,
          context,
        );
        break;
      case 'document':
        analysisPrompt = await this.buildDocumentAnalysisPrompt(
          normalizedInput,
          config,
          context,
        );
        break;
      default:
        analysisPrompt = await this.buildGenericAnalysisPrompt(
          normalizedInput,
          config,
          context,
        );
    }

    // 如果存在自定义分析提示，则使用自定义提示
    if (config.customPrompts?.analysis) {
      analysisPrompt = config.customPrompts.analysis;
    }

    try {
      // 调用LLM API进行分析
      const analysis = await callLLMJsonAPI({
        prompt: analysisPrompt,
        type: 'analysis',
      });

      return analysis;
    } catch (error) {
      console.error('初始分析失败:', error);
      // 返回基本分析结果以避免流程中断
      return {
        summary: `分析失败: ${error.message}`,
        importanceLevel: 'low',
        needsAttention: false,
        sentiment: 'neutral',
        nextAction: 'finish',
        tools: [],
        shouldStore: false,
        shouldNotify: false,
        confidence: 0,
        reasonsToStore: ['分析失败'],
        entities: {},
      };
    }
  }

  /**
   * 构建消息分析提示
   * 修改以支持不同数量的消息和 Thread 结构
   */
  private async buildMessageAnalysisPrompt(
    messages: any[],
    config: AnalysisConfig,
    context?: AnalysisContext,
  ): Promise<string> {
    // 加载用户自定义配置
    const userConfig = await this.loadUserConfiguration();

    // 获取环境配置
    const envConfig = await getEnvConfig();
    const analyzeByGroup = envConfig.ANALYZE_BY_GROUP === true;

    // 构建消息内容部分（支持 Thread 结构）
    const messagesContent = this.buildMessagesContentWithThreads(
      messages,
      analyzeByGroup,
    );

    // 构建群组上下文信息
    let contextInfo = '';
    if (messages.length > 1 && analyzeByGroup) {
      // 如果是批量分析且按群组分析
      contextInfo = [
        `群组名称: ${context?.groupInfo?.name || messages[0].groupName || '未知群组'}`,
        `群组ID: ${context?.groupInfo?.id || messages[0].groupId || '未知ID'}`,
        context?.currentUser ? `当前用户: ${context.currentUser}` : '',
      ]
        .filter(Boolean)
        .join('\n');
    } else if (messages.length === 1) {
      // 单条消息的上下文
      contextInfo = [
        `发送者: ${messages[0].sender || '未知发送者'}`,
        messages[0].groupName ? `群组名称: ${messages[0].groupName}` : '',
        messages[0].datetime ? `发送时间: ${messages[0].datetime}` : '',
        context?.currentUser ? `当前用户: ${context.currentUser}` : '',
      ]
        .filter(Boolean)
        .join('\n');
    }

    // 构建用户上下文信息
    const userContextInfo = this.buildUserContextInfo(
      userConfig.userContextConfig,
      'message',
    );

    // 构建关注规则：RULE_REF 是主协议，RULE_ID 仅保留手动规则兼容层
    const rawConcernedRules = (context?.concernedRules || []) as WatchRule[];
    const messageRuleContexts = messages.flatMap((message) => {
      const groupContext = {
        groupId: message.groupId || context?.groupInfo?.id,
        groupName: message.groupName || context?.groupInfo?.name,
        sender: message.sender || message.creator,
        datetime: message.datetime || message.time,
      };
      if (Array.isArray(message.posts) && message.posts.length > 0) {
        return message.posts.map((post: any) => ({
          groupId: message.groupId || context?.groupInfo?.id,
          groupName: message.groupName || context?.groupInfo?.name,
          sender: post.sender || post.creator,
          datetime: post.datetime || post.time,
        }));
      }
      return [groupContext];
    });
    const concernedRules = filterWatchRulesForMessageGroups(
      rawConcernedRules,
      messageRuleContexts,
    );
    const formatConcernedRuleText = (
      rule: any,
      ruleRef?: string,
      manualRuleIndex?: number,
    ): string => {
      // 🔧 通用前缀构建：处理 filterSender 和 filterGroup
      const buildPrefix = (): string => {
        const prefixParts: string[] = [];
        if (rule.filterSender) prefixParts.push(rule.filterSender);
        if (rule.filterGroup) prefixParts.push(`在 ${rule.filterGroup} 中`);
        if (rule.filterSender) prefixParts.push(`发送的`);
        return prefixParts.join(' ');
      };

      let ruleText = '';

      // 🆕 关注后续类型：使用预先生成的主体文本 + 补充匹配细节
      if (rule.followThread && rule.followConfig) {
        const config = rule.followConfig;
        const original = config.originalMessage;
        const originalDatetime = new Date(original.datetime).toLocaleString(
          'zh-CN',
        );

        // 1️⃣ 添加通用前缀（如果有 filterSender 或 filterGroup）
        const prefix = buildPrefix();
        if (prefix) {
          ruleText = prefix + ' ';
        }

        // 2️⃣ 使用 rule.text 作为主体（已在创建时预先生成）
        // 例如："关注后续讨论：原消息 \"过年什么时候放假？\""
        ruleText +=
          rule.text ||
          `关注后续讨论：原消息 "${(original.content || '').substring(0, 50)}"`;

        // 3️⃣ 补充匹配细节和技术说明
        ruleText += `。【匹配细节】在 ${original.teamName} 群组中，`;
        ruleText += `检测所有与 post_id="${original.postId}" 相关的后续讨论。`;
        ruleText += `原消息由 "${original.sender}" 在 ${originalDatetime} 发送。`;
        ruleText += `匹配条件（满足任一）：`;
        ruleText += `(1) reply_to 属性指向 "${original.postId}" 的直接回复；`;
        ruleText += `(2) 在同一 Thread 中且时间在原消息之后的消息；`;
        ruleText += `(3) 虽然不在同一 thread，但语义上是在讨论或回应原消息内容的消息；`;
        ruleText += `(4) @提及原消息发送者 "${original.sender}" 且内容与原话题相关的消息。`;
        ruleText += `【注意】排除原消息本身（post_id="${original.postId}"），只识别后续的讨论消息。`;
      }
      // 📋 普通规则类型：使用通用前缀 + 规则文本
      else {
        const prefix = buildPrefix();
        const mainText = rule.text || '';

        if (prefix && mainText) {
          ruleText = `${prefix} ${mainText}`;
        } else {
          ruleText = prefix || mainText;
        }
      }

      return buildRuleText(rule, true, manualRuleIndex, ruleRef) || ruleText;
    };
    const manualRules = concernedRules.filter(
      (rule) => rule.source === 'manual',
    );
    const filterRulesInfo =
      concernedRules.length > 0
        ? `关注规则:\n${concernedRules
            .map((rule, i) => {
              const manualRuleIndex =
                rule.source === 'manual'
                  ? manualRules.findIndex(
                      (currentRule) => currentRule.ruleRef === rule.ruleRef,
                    )
                  : undefined;
              return `- 规则${i + 1}: ${formatConcernedRuleText(rule, rule.ruleRef, manualRuleIndex)}`;
            })
            .join('\n')}`
        : '';

    // 获取工具描述
    const toolDescriptions = this.getToolDescriptions().join('\n');
    const availableToolIds = this.getAvailableToolIdList();

    // 构造分析深度提示
    let depthNote = '';
    if (config.analysisDepth === 'quick') {
      depthNote = '注意：这是快速分析，无需使用工具，直接返回基本判断。';
    } else if (config.analysisDepth === 'deep') {
      depthNote =
        '注意：这是深度分析，尽可能使用多个工具收集完整信息，做出全面判断。';
    }

    // 构建提示前缀
    const promptPrefix =
      messages.length > 1
        ? `分析以下群组中的一组消息，提取关键信息并判断各消息的重要性:`
        : `分析以下消息，提取关键信息并判断其重要性:`;

    // 构建消息结构说明
    const messageStructureNote = `
## 消息结构说明
消息可能包含以下结构：
- **对话线程 (Thread)**: 包含明确的回复关系
  - root: 线程的根消息（发起话题的消息）
  - reply: 对根消息的回复，包含 reply_to 指向被回复消息的 post_id
- **独立消息 (Standalone)**: 没有明确的回复关系
  - 注意：standalone 消息虽然没有明确点击"回复"，但可能在语义上是对同一群组中时间相近的对话线程的隐式回应。分析时请结合时间顺序和内容语义判断其是否属于某个对话线程的一部分。

群组类型判断：如果群组名称是单个人名则视为私聊，多个人名则是临时会话，否则视为群聊。

## 特殊规则说明：关注后续讨论
规则中带有【关注后续讨论】标记的是"关注后续"类型规则，需要特别注意：
1. 这类规则关注的是**某条特定消息的后续讨论**，规则中会提供原消息的 post_id 和内容
2. 匹配时需要综合判断：直接回复（reply_to 指向原消息）、同 Thread 后续、语义相关的隐式回复
3. **排除原消息本身**，只识别后续的讨论消息
4. 对于这类规则匹配的消息，需要额外填写 followThreadInfo 字段
`;

    // 构建分析要点
    const analysisPoints = `请分析:
1. 这条消息是关于什么的？简要总结。
2. 消息中提到了哪些人物、项目、时间点或其他关键实体？
3. 消息的情感是正面、负面还是中性的？
4. 消息是否匹配任何上述关注规则？如果是，请指出匹配的规则和原因。
5. 消息的重要程度如何？(低/中/高)
6. 消息是否需要特别关注或回复？
7. 这条消息可能与哪些其他信息或系统(如JIRA, Wiki)相关？
8. 是否建议使用某些工具来进一步处理这条消息？如果是，请推荐工具和参数。
${
  messages.length > 1
    ? `9. 【线程关系分析】消息间存在什么关联？
   - 如果消息在 Thread 中，请分析 root 和 reply 的关系
   - 如果消息是 Standalone，请判断它是否可能是对附近 Thread 消息的隐式回复
   - 考虑时间顺序和内容语义进行判断`
    : ''
}`;

    const customPromptSection = this.buildCustomPromptSection(
      userConfig.customPrompts?.message,
      '消息分析',
    );

    // 构建返回格式说明
    const returnFormat = `请以JSON数组格式返回分析结果，每个元素对应一条消息:
[
  {
    "post_id": "消息的post_id（必填，用于精确关联消息）",
    "summary": "根据消息上下文，总结消息的简要内容",
    "matchedRuleRefs": ["manual:topic-1", "outreach:session-1"],  // 【重要】匹配的稳定规则引用数组，使用 [RULE_REF:xxx] 中的 xxx 值
    "matchedRuleIds": [0, 2],  // 兼容字段，仅当命中带 [RULE_ID:X] 的手动规则时返回
    "matchedRules": ["匹配的关注规则1（备用参考）", "匹配的关注规则2"],
    "matchReasons": ["匹配原因1", "匹配原因2"],
    "importanceLevel": "low|medium|high",
    "needsAttention": true|false,
    "needsProcessing": true|false,
    "isNoiseMessage": false,
    "sentiment": "positive|negative|neutral",
    "context": "消息在对话中的角色，如'提问','回答','确认'等",
    "mentionedSystems": ["系统1", "系统2"],
    
    // 线程上下文信息
    "threadContext": {
      "rootId": "所属线程的根消息ID（如果适用）",
      "messageType": "root|reply|standalone",
      "replyTo": "被回复消息的post_id（如果是reply）",
      "isImplicitReply": false,  // 如果是 standalone 但判断为隐式回复，设为 true
      "implicitReplyToRootId": null  // 如果 isImplicitReply 为 true，填写相关的 thread root_id
    },
    
    // 关注后续讨论信息（仅当匹配"关注后续讨论"规则时填写）
    "followThreadInfo": {
      "originalPostId": "被关注的原消息post_id",
      "relationType": "direct_reply|same_thread|semantic_related|mention",  // 与原消息的关系类型
      "relevanceScore": 0.9  // 0-1 之间的相关度评分
    },
    
    // 决策和工具字段
    "thought": "给用户看的简短决策摘要（一句话），不要输出完整逐步推理或隐藏思考",
    "nextAction": "use_tool|finish",
    "tools": [{
      "id": "工具ID",
      "params": {}, // 工具所需参数
    }], // 如果nextAction为use_tool
    "shouldStore": false,
    "shouldNotify": false,
    "confidence": 0.7,
    "reasonsToStore": ["存储/忽略的理由1", "理由2"],
    "notificationPriority": "low|medium|high",
    "replyAdvice": "",
    "user_relation_type": "mention_me|mention_team|project_related|policy_related|person_tracking|general_interest",
    
    // 实体提取结果
    "entities": {
      "people": [{"name": "人名", "role": "角色", "mentioned_context": "提及上下文"}],
      "time": [{"raw": "原始表述", "normalized": "标准化时间", "type": "deadline|schedule|mentioned"}],
      "projects": [{"name": "项目名", "status": "状态", "related_people": []}],
      "topics": [{"name": "主题名", "category": "类别", "keywords": []}],
      "location": [],
      "resources": []
    },
    "relationships": [],
    "actions": []
  },
  // ... 其他消息的分析结果
]`;

    // 构建特别说明
    const specialNotes = `特别说明:
1. 'post_id'字段必填，用于精确关联消息，请从输入消息的 post_id 属性中获取
2. 'needsProcessing'字段表示消息是否需要进一步处理(如存储、通知等)
3. 'isNoiseMessage'字段标识是否为噪音消息(如单纯的"好的"、"谢谢"等)
4. 'nextAction'应该是'use_tool'或'finish'，表示是否需要进一步处理
5. 如果不需要处理(nextAction为finish)，请提供完整的决策信息(shouldStore, shouldNotify等)
6. 对于entities字段，请尽可能完整提取实体信息
7. 'tools'字段中只能包含上面列出的可用工具ID（当前: ${availableToolIds}）
8. 'params'字段应该根据选择的工具提供合适的参数，参考工具描述中的参数定义
9. 【重要】'matchedRuleRefs'字段必须优先使用规则定义中的 [RULE_REF:xxx] 中的 xxx，这是精确匹配规则的主协议
10. 'matchedRuleIds'仅作为手动规则兼容字段，只有命中带 [RULE_ID:X] 的手动规则时才返回对应数字
11. 【关注后续讨论】如果消息匹配了带有【关注后续讨论】标记的规则，必须填写'followThreadInfo'字段，包括原消息ID、关系类型和相关度评分
12. 'thought'字段只写可展示的简短决策摘要，不要写完整逐步推理或隐藏思考`;

    // 构建最终提示
    return `
${promptPrefix}
${messageStructureNote}

${messages.length > 1 ? `群组信息:\n${contextInfo}` : `上下文信息:\n${contextInfo}`}

${messages.length > 1 ? `消息列表:\n${messagesContent}` : `消息内容:\n${messagesContent}`}

${filterRulesInfo}

${depthNote}

${userContextInfo}

# 可用工具
以下是可用于处理消息的工具，可以在分析时考虑是否需要使用这些工具：
${toolDescriptions}
${this.getToolSafetyPromptGuidance()}
${config.preferredTools && config.preferredTools.length > 0 ? `\n推荐优先考虑使用这些工具: ${config.preferredTools.join(', ')}` : ''}

${analysisPoints}
${customPromptSection}
${returnFormat}

${specialNotes}

工具选择建议:
- 如果消息提到项目进度或问题，考虑使用jiraQuery
- 如果消息涉及组织关系、人员或历史上下文，考虑使用historySearch
- 不要调用未列出的工具；参数不完整时不要生成工具调用
`;
  }

  /**
   * 构建支持 Thread 结构的消息内容
   */
  private buildMessagesContentWithThreads(
    messages: any[],
    analyzeByGroup: boolean,
  ): string {
    // 检查是否有 thread 结构数据
    const hasThreadStructure = messages.some(
      (msg) =>
        (msg.threads && msg.threads.length > 0) ||
        (msg.standalone && msg.standalone.length > 0),
    );

    if (!hasThreadStructure) {
      // 回退到旧的扁平格式
      return messages
        .map((msg, index) => {
          const parentInfo =
            msg.parentId || msg.parent_id
              ? `\n回复: ${msg.parentId || msg.parent_id}`
              : '';
          return `消息 #${index + 1}:
发送者: ${msg.sender || '未知发送者'}
${messages.length > 1 && !analyzeByGroup ? `所在群组: ${msg.groupName || '未知群组'}` : ''}
时间: ${msg.datetime || '未知时间'}${parentInfo}
内容: ${msg.messageContent || msg.message_content || msg.content || '无内容'}`;
        })
        .join('\n\n');
    }

    // 使用 Thread 结构化格式
    let output = '';
    let messageIndex = 0;

    for (const group of messages) {
      const threads = group.threads || [];
      const standalone = group.standalone || [];

      // 如果是多群组分析，添加群组分隔
      if (messages.length > 1 && !analyzeByGroup) {
        output += `\n【群组: ${group.groupName || '未知群组'}】\n`;
      }

      // 输出对话线程
      if (threads.length > 0) {
        output += '\n--- 对话线程 ---\n';
        for (const thread of threads) {
          output += `\n[Thread root_id=${thread.rootPostId}]\n`;

          // 根消息
          if (thread.rootPost) {
            const root = thread.rootPost;
            output += `  [ROOT] 消息 #${++messageIndex}:\n`;
            output += `    发送者: ${root.creator || root.sender || 'Unknown'}\n`;
            output += `    时间: ${root.time || root.datetime}\n`;
            output += `    post_id: ${root.id}\n`;
            output += `    内容: ${root.text || root.content || ''}\n`;
          } else {
            output += `  [ROOT] post_id=${thread.rootPostId}: [原消息不在当前时间窗口内]\n`;
          }

          // 回复消息
          for (const reply of thread.replies || []) {
            output += `  [REPLY → ${reply.parentId}] 消息 #${++messageIndex}:\n`;
            output += `    发送者: ${reply.creator || reply.sender}\n`;
            output += `    时间: ${reply.time || reply.datetime}\n`;
            output += `    post_id: ${reply.id}\n`;
            output += `    内容: ${reply.text || reply.content || ''}\n`;
          }
        }
      }

      // 输出独立消息
      if (standalone.length > 0) {
        output +=
          '\n--- 独立消息（可能是对上述线程的隐式回复，请根据时间和内容判断）---\n';
        for (const msg of standalone) {
          output += `  [STANDALONE] 消息 #${++messageIndex}:\n`;
          output += `    发送者: ${msg.creator || msg.sender}\n`;
          output += `    时间: ${msg.time || msg.datetime}\n`;
          output += `    post_id: ${msg.id}\n`;
          output += `    内容: ${msg.text || msg.content || ''}\n`;
        }
      }
    }

    return output;
  }

  /**
   * 构建项目分析提示
   */
  private async buildProjectAnalysisPrompt(
    normalizedInput: ProjectInput,
    config: AnalysisConfig,
    context?: AnalysisContext,
  ): Promise<string> {
    // 加载用户自定义配置
    const userConfig = await this.loadUserConfiguration();

    // 获取项目基本信息
    const projectId = normalizedInput.project?.id || '未知项目ID';
    const projectName =
      normalizedInput.name || normalizedInput.project?.name || '未知项目';
    const projectType = normalizedInput.type || 'generic'; // 可能的类型：jira_ticket, release, sprint, project

    // 处理可能的Jira数据
    const jiraIssues = normalizedInput.jiraIssues || {}; // 新增支持多个JIRA issues

    // 构建上下文信息
    const contextInfo = [
      `项目ID: ${projectId}`,
      `项目名称: ${projectName}`,
      `项目类型: ${projectType}`,
      context?.currentUser ? `当前用户: ${context.currentUser}` : '',
      normalizedInput.project?.owner
        ? `负责人: ${normalizedInput.project?.owner}`
        : '',
      normalizedInput.project?.status
        ? `当前状态: ${normalizedInput.project?.status}`
        : '',
      normalizedInput.project?.dueDate
        ? `截止日期: ${normalizedInput.project?.dueDate}`
        : '',
      normalizedInput.project?.track
        ? `赛道: ${normalizedInput.project?.track}`
        : '',
      normalizedInput.project?.comments
        ? `备注: ${normalizedInput.project?.comments}`
        : '',
    ]
      .filter(Boolean)
      .join('\n');

    // 构建用户上下文信息
    const userContextInfo = this.buildUserContextInfo(
      userConfig.userContextConfig,
      'project',
    );

    // 构建Jira数据信息
    let jiraInfo = '';
    // 处理多个Jira工单信息
    if (jiraIssues && Object.keys(jiraIssues).length > 0) {
      const jiraKeys = Object.keys(jiraIssues);
      jiraInfo += `
多个Jira工单信息:`;

      jiraKeys.forEach((key) => {
        const issue = jiraIssues[key];
        jiraInfo += `
- 工单ID: ${issue.key || issue.id || key}
${issue.summary || issue.fields?.summary ? `  - 摘要: ${issue.summary || issue.fields?.summary}` : ''}
  - 工单状态: ${issue.status || issue.fields?.status?.name || '未知'}
  - 负责人: ${issue.assignee || issue.fields?.assignee?.displayName || '未知'}
  - 预计完成时间: ${issue.duedate || issue.fields?.duedate || '未知'}`;
      });
    }

    // 构建项目内容描述
    let contentDescription = '';
    if (normalizedInput.project?.description) {
      contentDescription = `项目描述:\n${normalizedInput.project?.description}`;
    } else if (
      normalizedInput.project?.content ||
      normalizedInput.project?.message_content
    ) {
      contentDescription = `项目内容:\n${normalizedInput.project?.content || normalizedInput.project?.message_content}`;
    } else if (
      normalizedInput.project?.tickets &&
      Array.isArray(normalizedInput.project?.tickets)
    ) {
      contentDescription = `相关工单:\n${normalizedInput.project?.tickets
        .map(
          (ticket: any, i: number) =>
            `- 工单${i + 1}: ${ticket.id || ''} ${ticket.title || ''} [${ticket.status || ''}]`,
        )
        .join('\n')}`;
    }

    // 获取工具描述
    const toolDescriptions = this.getToolDescriptions().join('\n');

    // 添加分析深度相关内容
    let depthNote = '';
    if (config.analysisDepth === 'quick') {
      depthNote = '注意：这是快速分析，无需使用工具，直接返回基本判断。';
    } else if (config.analysisDepth === 'deep') {
      depthNote =
        '注意：这是深度分析，尽可能使用多个工具收集完整信息，做出全面判断。';
    }

    const customPromptSection = this.buildCustomPromptSection(
      userConfig.customPrompts?.project,
      '项目分析',
    );

    // 构建最终提示
    return `
分析以下项目信息，评估项目状态与风险:

项目基本信息:
${contextInfo}

${jiraInfo}

${contentDescription}

${depthNote}

${userContextInfo}
# 可用工具
以下是可用于分析项目的工具:
${toolDescriptions}
${this.getToolSafetyPromptGuidance()}
${config.preferredTools && config.preferredTools.length > 0 ? `\n推荐优先考虑使用这些工具: ${config.preferredTools.join(', ')}` : ''}

# 分析指南
请根据项目信息的结构类型进行分析:

1. 如果是单个JIRA工单(ticket)，请分析:
   - 工单的当前状态是否合理
   - 负责人分配是否合适
   - 截止日期是否存在风险
   - 评论/行动项是否需要更新
   - 是否需要关联其他信息源(如JIRA评论、聊天历史)来做更全面判断

2. 如果是发布/迭代(release/sprint)信息，请分析:
   - 整体发布状态和健康度
   - 包含的各个工单状态是否一致
   - 是否存在时间风险或资源冲突
   - 是否有工单可能会延迟整体发布
   - 行动项是否完整，是否需要添加新的行动项

3. 如果是项目级别信息，请分析:
   - 项目整体状态和健康度
   - 关键里程碑是否存在风险
   - 资源分配是否合理
   - 是否有需要特别关注的子项目或工单
   - 项目文档是否需要更新
${customPromptSection}
请分析项目中可能存在的风险点，并提出相应的建议。如果需要更多信息来做判断，请指出可以使用哪些工具获取这些信息。

以JSON格式返回:
{
  "summary": "项目简要总结",
  "projectType": "识别出的项目类型(jira_ticket|release|sprint|project)",
  "status": "项目当前状态评估",
  "riskLevel": "low|medium|high",
  "riskPoints": ["风险点1", "风险点2"],
  "timeline": {
    "onTrack": true|false,
    "concerns": ["时间线问题1", "时间线问题2"]
  },
  "resourceAllocation": {
    "concerns": ["资源问题1", "资源问题2"]
  },
  
  // 决策和工具字段
  "thought": "给用户看的简短决策摘要（一句话），不要输出完整逐步推理或隐藏思考",
  "nextAction": "use_tool|finish",
  "tools": [{
    "id": "工具ID",
    "params": {}, // 工具所需参数
  }], // 如果nextAction为use_tool
  "confidence": 0.7,
  
  // 建议
  "suggestions": {
    "status": "(In Progress|Done|Blocked|Released)", // 用英文直接填入具体的状态值（如：进行中、已完成、阻塞中），没有变化可留空
    "statusReason": "建议修改状态的原因", // 用中文给出状态变化的原因
    "owner": "", // 用英文直接填入具体的人名，没有变化可留空
    "ownerReason": "建议修改负责人的原因", // 用中文给出修改负责人的原因
    "track": "", // 用英文直接填入具体的赛道名称或团队名，没有变化可留空
    "trackReason": "建议修改赛道的原因", // 用中文给出修改赛道的原因
    "highlights": ["highlight1", "highlight2"], // 用英文直接填入具体的备注内容，没有变化可留空
    "highlightsReason": "建议修改备注的原因", // 用中文给出备注变化的原因
    "actionItems": ["actionItem1", "actionItem2"],  // 用英文直接填入具体的行动项，没有变化可留空
    "actionItemsReason": "建议修改行动项的原因", // 用中文给出行动项变化的原因
    "documentation": ["文档更新建议"],
    "risks": ["风险描述1", "风险描述2"],
    "followUp": ["后续跟进项1", "后续跟进项2"]
  },
  
  // 提取的实体
  "entities": {
    "tickets": [{"id": "JIRA-123", "status": "状态", "owner": "负责人", "dueDate": "日期"}],
    "milestones": [{"name": "里程碑名称", "date": "日期", "status": "状态"}],
    "dependencies": [{"from": "项目A", "to": "项目B", "type": "类型"}]
  },
  }
}
`;
  }

  /**
   * 构建会议分析提示
   */
  private async buildMeetingAnalysisPrompt(
    normalizedInput: any,
    config: AnalysisConfig,
    context?: AnalysisContext,
  ): Promise<string> {
    // 加载用户自定义配置
    const userConfig = await this.loadUserConfiguration();

    // 获取会议基本信息
    const meetingId =
      normalizedInput.id || normalizedInput.meetingId || '未知会议ID';
    const meetingTitle =
      normalizedInput.title || normalizedInput.name || '未知会议';
    const meetingType = normalizedInput.type || 'generic'; // 可能的类型：daily, weekly, review, planning

    // 构建会议上下文信息
    const contextInfo = [
      `会议ID: ${meetingId}`,
      `会议标题: ${meetingTitle}`,
      `会议类型: ${meetingType}`,
      normalizedInput.organizer ? `组织者: ${normalizedInput.organizer}` : '',
      normalizedInput.datetime ? `会议时间: ${normalizedInput.datetime}` : '',
      normalizedInput.duration
        ? `会议时长: ${normalizedInput.duration}分钟`
        : '',
      normalizedInput.location ? `会议地点: ${normalizedInput.location}` : '',
      normalizedInput.attendees
        ? `参会人员: ${Array.isArray(normalizedInput.attendees) ? normalizedInput.attendees.join(', ') : normalizedInput.attendees}`
        : '',
      context?.currentUser ? `当前用户: ${context.currentUser}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    // 构建用户上下文信息
    const userContextInfo = this.buildUserContextPromptBlock(
      userConfig.userContextConfig,
      'project',
    );

    // 构建会议内容描述
    let contentDescription = '';
    if (normalizedInput.transcript) {
      contentDescription = `会议记录:\n${normalizedInput.transcript}`;
    } else if (normalizedInput.content) {
      contentDescription = `会议内容:\n${normalizedInput.content}`;
    } else if (normalizedInput.agenda) {
      contentDescription = `会议议程:\n${
        Array.isArray(normalizedInput.agenda)
          ? normalizedInput.agenda
              .map((item: any, i: number) => `- 议题${i + 1}: ${item}`)
              .join('\n')
          : normalizedInput.agenda
      }`;
    }

    // 获取工具描述
    const toolDescriptions = this.getToolDescriptions().join('\n');

    // 添加分析深度相关内容
    let depthNote = '';
    if (config.analysisDepth === 'quick') {
      depthNote = '注意：这是快速分析，无需使用工具，直接返回基本会议摘要。';
    } else if (config.analysisDepth === 'deep') {
      depthNote =
        '注意：这是深度分析，请尽可能提取详细的会议信息，包括决策点、行动项和跟进事项。';
    }

    const customPromptSection = this.buildCustomPromptSection(
      userConfig.customPrompts?.project,
      '会议分析',
    );

    // 构建最终提示
    return `
${userContextInfo}分析以下会议内容，提取关键信息并总结重要决策与行动项:

会议基本信息:
${contextInfo}

${contentDescription}

${depthNote}

# 可用工具
以下是可用于分析会议的工具:
${toolDescriptions}
${this.getToolSafetyPromptGuidance()}
${config.preferredTools && config.preferredTools.length > 0 ? `\n推荐优先考虑使用这些工具: ${config.preferredTools.join(', ')}` : ''}

# 分析指南
根据会议类型进行有针对性的分析:

1. 如果是日常/周常会议:
   - 识别团队进展更新
   - 提取遇到的阻碍和问题
   - 总结需要协助的事项
   - 跟踪行动项的完成情况
   
2. 如果是评审会议:
   - 提取关键决策和批准事项
   - 识别需要修改的内容
   - 总结评审结果和后续步骤
   
3. 如果是规划会议:
   - 总结确定的目标和优先级
   - 识别资源分配决策
   - 总结时间线和里程碑
   - 明确责任分工和下一步行动${customPromptSection}
请根据会议内容提取关键信息，重点关注决策点、行动项和后续跟进事项。

以JSON格式返回分析结果:
{
  "summary": "会议主要内容总结",
  "meetingType": "识别出的会议类型",
  "keyDecisions": ["决策1", "决策2"],
  "actionItems": [
    {
      "item": "行动项描述",
      "owner": "负责人",
      "dueDate": "截止日期",
      "priority": "high|medium|low"
    }
  ],
  "followUpMeetings": [
    {
      "topic": "会议主题",
      "participants": ["参与者1", "参与者2"],
      "scheduledDate": "计划日期"
    }
  ],
  "risks": ["风险点1", "风险点2"],
  "blockers": ["阻碍1", "阻碍2"],
  
  // 决策和工具字段
  "thought": "给用户看的简短决策摘要（一句话），不要输出完整逐步推理或隐藏思考",
  "nextAction": "use_tool|finish",
  "tools": [{
    "id": "工具ID",
    "params": {}
  }],
  "confidence": 0.8,
  
  // 提取的实体
  "entities": {
    "people": [{"name": "人名", "role": "角色在会议中的作用"}],
    "projects": [{"name": "项目名", "status": "讨论的状态"}],
    "deadlines": [{"item": "事项", "date": "截止日期"}],
    "decisions": [{"topic": "决策主题", "decision": "具体决策", "rationale": "决策理由"}]
  }
}
`;
  }

  /**
   * 构建文档分析提示
   */
  private async buildDocumentAnalysisPrompt(
    normalizedInput: any,
    config: AnalysisConfig,
    context?: AnalysisContext,
  ): Promise<string> {
    // 加载用户自定义配置
    const userConfig = await this.loadUserConfiguration();

    // 获取文档基本信息
    const documentId =
      normalizedInput.id || normalizedInput.documentId || '未知文档ID';
    const documentTitle =
      normalizedInput.title || normalizedInput.name || '未知文档';
    const documentType = normalizedInput.type || 'generic'; // 可能的类型：specification, report, policy, guide

    // 构建文档上下文信息
    const contextInfo = [
      `文档ID: ${documentId}`,
      `文档标题: ${documentTitle}`,
      `文档类型: ${documentType}`,
      normalizedInput.author ? `作者: ${normalizedInput.author}` : '',
      normalizedInput.lastModified
        ? `最后修改: ${normalizedInput.lastModified}`
        : '',
      normalizedInput.version ? `版本: ${normalizedInput.version}` : '',
      normalizedInput.status ? `状态: ${normalizedInput.status}` : '',
      context?.currentUser ? `当前用户: ${context.currentUser}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    // 构建用户上下文信息
    const userContextInfo = this.buildUserContextPromptBlock(
      userConfig.userContextConfig,
      'project',
    );

    // 构建文档内容描述
    let contentDescription = '';
    if (normalizedInput.content) {
      contentDescription = `文档内容:\n${normalizedInput.content}`;
    } else if (normalizedInput.summary) {
      contentDescription = `文档摘要:\n${normalizedInput.summary}`;
    } else if (
      normalizedInput.sections &&
      Array.isArray(normalizedInput.sections)
    ) {
      contentDescription = `文档章节:\n${normalizedInput.sections
        .map(
          (section: any, i: number) =>
            `- 第${i + 1}章: ${section.title || section.name || ''} ${section.summary || ''}`,
        )
        .join('\n')}`;
    }

    // 获取工具描述
    const toolDescriptions = this.getToolDescriptions().join('\n');

    // 添加分析深度相关内容
    let depthNote = '';
    if (config.analysisDepth === 'quick') {
      depthNote = '注意：这是快速分析，无需使用工具，直接返回基本文档摘要。';
    } else if (config.analysisDepth === 'deep') {
      depthNote =
        '注意：这是深度分析，请尽可能提取详细的文档信息，包括关键决策、行动项和风险点。';
    }

    const customPromptSection = this.buildCustomPromptSection(
      userConfig.customPrompts?.project,
      '文档分析',
    );

    // 构建最终提示
    return `
${userContextInfo}分析以下文档内容，提取关键信息并总结重要洞察:

文档基本信息:
${contextInfo}

${contentDescription}

${depthNote}

# 可用工具
以下是可用于分析文档的工具:
${toolDescriptions}
${this.getToolSafetyPromptGuidance()}
${config.preferredTools && config.preferredTools.length > 0 ? `\n推荐优先考虑使用这些工具: ${config.preferredTools.join(', ')}` : ''}

# 分析指南
根据文档类型进行有针对性的分析:

1. 如果是技术规范文档:
   - 提取关键技术要求和约束
   - 识别实施风险和依赖项
   - 总结接口定义和数据结构
   
2. 如果是报告文档:
   - 总结主要发现和结论
   - 提取数据洞察和趋势
   - 识别推荐的行动项
   
3. 如果是政策指南文档:
   - 总结关键政策条款
   - 识别合规要求
   - 提取流程和程序要点${customPromptSection}
请根据文档内容提取关键信息，重点关注可执行的洞察和行动项。

以JSON格式返回分析结果:
{
  "summary": "文档主要内容总结",
  "documentType": "识别出的文档类型",
  "keyInsights": ["洞察1", "洞察2"],
  "actionItems": [
    {
      "item": "行动项描述",
      "priority": "high|medium|low",
      "timeline": "时间线"
    }
  ],
  "risks": ["风险点1", "风险点2"],
  "dependencies": ["依赖项1", "依赖项2"],
  
  // 决策和工具字段
  "thought": "给用户看的简短决策摘要（一句话），不要输出完整逐步推理或隐藏思考",
  "nextAction": "use_tool|finish",
  "tools": [{
    "id": "工具ID",
    "params": {}
  }],
  "confidence": 0.8,
  
  // 提取的实体
  "entities": {
    "requirements": [{"item": "需求", "priority": "优先级", "status": "状态"}],
    "stakeholders": [{"name": "干系人", "role": "角色", "responsibility": "职责"}],
    "timelines": [{"milestone": "里程碑", "date": "日期", "status": "状态"}],
    "resources": [{"type": "资源类型", "name": "资源名称", "allocation": "分配情况"}]
  }
}
`;
  }

  /**
   * 构建通用分析提示
   */
  private async buildGenericAnalysisPrompt(
    normalizedInput: any,
    config: AnalysisConfig,
    context?: AnalysisContext,
  ): Promise<string> {
    // 加载用户自定义配置
    const userConfig = await this.loadUserConfiguration();

    // 尝试确定输入类型
    let inputType = 'unknown';
    let inputTitle = '未知内容';

    // 根据输入特征推断类型
    if (normalizedInput.message_content || normalizedInput.messageContent) {
      inputType = 'message';
    } else if (normalizedInput.project || normalizedInput.id) {
      inputType = 'project';
    } else if (normalizedInput.title && normalizedInput.content) {
      inputType = 'document';
    } else if (normalizedInput.transcript || normalizedInput.attendees) {
      inputType = 'meeting';
    } else if (typeof normalizedInput === 'string') {
      inputType = 'text';
    } else if (normalizedInput.url) {
      inputType = 'url';
    }

    // 尝试获取标题
    if (normalizedInput.title) {
      inputTitle = normalizedInput.title;
    } else if (normalizedInput.name) {
      inputTitle = normalizedInput.name;
    } else if (normalizedInput.subject) {
      inputTitle = normalizedInput.subject;
    }

    // 构建用户上下文信息
    const userContextInfo = this.buildUserContextPromptBlock(
      userConfig.userContextConfig,
      this.resolveGenericUserContextScope(inputType),
    );

    // 构建上下文信息
    const contextInfo = [
      `内容标题: ${inputTitle}`,
      `推测类型: ${inputType}`,
      normalizedInput.datetime ? `时间: ${normalizedInput.datetime}` : '',
      normalizedInput.source ? `来源: ${normalizedInput.source}` : '',
      context?.currentUser ? `当前用户: ${context.currentUser}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    // 构建内容描述
    let contentDescription = '';
    if (typeof normalizedInput === 'string') {
      contentDescription = `内容:\n${normalizedInput}`;
    } else if (normalizedInput.content) {
      contentDescription = `内容:\n${normalizedInput.content}`;
    } else if (normalizedInput.text) {
      contentDescription = `内容:\n${normalizedInput.text}`;
    } else {
      // 尝试将整个输入作为内容
      const inputStr = JSON.stringify(normalizedInput, null, 2);
      if (inputStr.length < 5000) {
        // 避免过长内容
        contentDescription = `原始内容:\n${inputStr}`;
      } else {
        contentDescription = `原始内容过长，请使用工具查看完整内容。`;
      }
    }

    // 获取工具描述
    const toolDescriptions = this.getToolDescriptions().join('\n');

    // 添加分析深度相关内容
    let depthNote = '';
    if (config.analysisDepth === 'quick') {
      depthNote = '注意：这是快速分析，直接返回基本总结。';
    } else if (config.analysisDepth === 'deep') {
      depthNote = '注意：这是深度分析，请尽可能详细地提取信息和见解。';
    }

    const customPromptSection = [
      this.buildCustomPromptSection(
        userConfig.customPrompts?.message,
        '消息分析',
      ),
      this.buildCustomPromptSection(
        userConfig.customPrompts?.project,
        '项目分析',
      ),
    ].join('');

    // 构建最终提示
    return `
${userContextInfo}分析以下内容，提取关键信息和见解:

基本信息:
${contextInfo}

${contentDescription}

${depthNote}
${customPromptSection}
# 可用工具
以下是可用于分析的工具:
${toolDescriptions}
${this.getToolSafetyPromptGuidance()}
${config.preferredTools && config.preferredTools.length > 0 ? `\n推荐优先考虑使用这些工具: ${config.preferredTools.join(', ')}` : ''}

# 分析指南
由于输入类型不明确，请进行通用分析:

1. 首先，尝试确定内容的类型和性质
2. 提取关键信息、主题和要点
3. 分析内容的重要性和相关性
4. 识别任何需要关注、跟进或行动的项目
5. 总结内容的主要价值和见解

请根据内容类型的最佳做法进行分析，并根据需要使用工具获取更多信息。

以JSON格式返回:
{
  "summary": "内容总结",
  "contentType": "识别出的内容类型",
  "keyPoints": ["要点1", "要点2"],
  "topics": ["主题1", "主题2"],
  "importance": "high|medium|low",
  "relevance": "内容相关性描述",
  "insightValue": "内容提供的见解价值",
  
  // 决策和工具字段
  "thought": "给用户看的简短决策摘要（一句话），不要输出完整逐步推理或隐藏思考",
  "nextAction": "use_tool|finish",
  "tools": [{
    "id": "工具ID",
    "params": {}, // 工具所需参数
  }], // 如果nextAction为use_tool
  "confidence": 0.7,
  
  // 建议
  "suggestions": {
    "actionItems": ["建议行动项1", "建议行动项2"],
    "followUp": ["后续跟进项1", "后续跟进项2"]
  },
  
  // 实体提取
  "entities": {
    "people": [{"name": "人名", "role": "角色"}],
    "organizations": [{"name": "组织名", "type": "类型"}],
    "dates": [{"text": "日期文本", "normalized": "标准化日期"}],
    "locations": [{"name": "位置名", "type": "类型"}],
    "concepts": [{"name": "概念名", "description": "描述"}]
  }
}
`;
  }

  /**
   * 思考下一步行动
   */
  private async think(state: any): Promise<ThoughtResult> {
    // 构建思考提示
    const thinkPrompt = this.buildThinkingPrompt(state);

    // 如果存在自定义思考提示，则使用自定义提示
    // TODO: 实现自定义思考提示逻辑
    // if (state.config.customPrompts?.thinking) {
    //   thinkPrompt = state.config.customPrompts.thinking;
    // }

    try {
      // 调用LLM API进行思考
      const thoughtResult = await callLLMJsonAPI({
        prompt: thinkPrompt,
        type: 'think',
      });

      return thoughtResult;
    } catch (error) {
      console.error('思考过程失败:', error);
      // 返回直接结束处理的决定
      return {
        thought: `思考过程中出错: ${error.message}，决定结束处理`,
        nextAction: 'finish',
        tools: [],
        ...state.currentDecision,
      };
    }
  }

  /**
   * 构建思考提示
   */
  private buildThinkingPrompt(state: any): string {
    // 获取当前状态信息
    const currentActionCount = state.actionCount || 0;
    const maxActions = state.config.maxActions || 5;
    const analysisType = state.config.type || 'generic';

    // 获取已有分析信息
    const currentResult = state.result || {};
    const currentAnalysis = state.analysis || {};
    const memory = state.memory || {};

    // 构建当前状态描述
    let stateDescription = '';

    // 根据分析类型构建不同的状态描述
    switch (analysisType) {
      case 'message':
        stateDescription = `
当前分析的消息内容: ${state.input.message_content || state.input.content || '无内容'}
发送者: ${state.input.sender || '未知'}
发送时间: ${state.input.datetime || '未知'}
群组/团队: ${state.input.groupName || '未知'}

当前决策:
- 重要性: ${state.currentDecision.isImportant ? '重要' : '不重要'}
- 需要存储: ${state.currentDecision.shouldStore ? '是' : '否'}
- 需要通知: ${state.currentDecision.shouldNotify ? '是' : '否'}
- 置信度: ${state.currentDecision.confidence || 0}
- 摘要: ${state.currentDecision.summary || '无摘要'}
- 理由: ${state.currentDecision.reasonsToStore?.join(', ') || '无理由'}
- 通知优先级: ${state.currentDecision.notificationPriority || 'low'}
- 回复建议: ${state.currentDecision.replyAdvice || '无建议'}
`;
        break;

      case 'project':
        stateDescription = `
当前分析的项目: ${state.input.project?.name || '未命名项目'}
项目ID: ${state.input.project?.id || '未知ID'}
状态: ${state.input.project?.status || '未知状态'}
负责人: ${state.input.project?.owner || '未知'}

当前分析结果:
- 风险级别: ${currentResult.riskLevel || '未评估'}
- 时间线状态: ${currentResult.timeline?.onTrack ? '正常' : '有风险'}
- 建议操作: ${currentResult.suggestions?.actionItems?.join(', ') || '无'}
`;
        break;

      // Todo: 未命名会议
      case 'meeting':
        stateDescription = `
当前分析的会议: ${state.input.title || '未命名会议'}
会议时间: ${state.input.datetime || '未知时间'}
参会人员: ${Array.isArray(state.input.attendees) ? state.input.attendees.join(', ') : state.input.attendees || '未知'}

当前分析结果:
- 主题数量: ${currentResult.topics?.length || 0}
- 决策数量: ${currentResult.decisions?.length || 0}
- 行动项数量: ${currentResult.actionItems?.length || 0}
- 需要跟进项: ${currentResult.followups?.length || 0}
`;
        break;

      // Todo: 未命名文档
      case 'document':
        stateDescription = `
当前分析的文档: ${state.input.title || '未命名文档'}
文档类型: ${state.input.type || '未知类型'}
作者: ${state.input.author || '未知'}

当前分析结果:
- 文档目的: ${currentResult.purpose || '未确定'}
- 提取的主题数: ${currentResult.keyThemes?.length || 0}
- 提取的论点数: ${currentResult.arguments?.length || 0}
- 主要发现: ${currentResult.findings?.join(', ') || '无'}
`;
        break;

      default:
        stateDescription = `
当前分析的内容类型: ${analysisType || '未知类型'}
内容摘要: ${currentResult.summary || '无摘要'}
当前分析状态: 已执行${currentActionCount}个操作，最多可执行${maxActions}个操作
当前分析置信度: ${currentResult.confidence || currentAnalysis.confidence || 0}
`;
    }

    // 添加历史行动记录
    let actionHistory = '';
    if (state.actionHistory && state.actionHistory.length > 0) {
      actionHistory = `
过去采取的行动:
${state.actionHistory
  .map(
    (action: any, index: number) =>
      `${index + 1}. 工具: ${action.tool || '无'}, 参数: ${JSON.stringify(action.params || {})}, 结果: 参见[已执行的工具和收集的信息]`,
  )
  .join('\n')}
`;
    }

    // 添加记忆内容
    let memoryContent = '';
    if (Object.keys(memory).length > 0) {
      memoryContent = `
已执行的工具和收集的信息:
	${Object.entries(memory)
	  .map(([key, results]: [string, any]) =>
	    results.map(
	      (r: any) => {
	        const rawMessage =
	          typeof r.result?.message === 'string'
	            ? r.result.message
	            : JSON.stringify(r.result || r);
	        return `- ${key} [已执行]: ${rawMessage.substring(0, 500)}${rawMessage.length > 300 ? '...' : ''}`;
	      },
	    ),
	  )
	  .join('\n')}
`;
    }

    // 获取工具描述
    const toolDescriptions = this.getToolDescriptions().join('\n');

    // 构建最终提示
    return `
作为智能分析助手，你正在分析一个${analysisType}类型的内容。你已经执行了${currentActionCount}个操作，最多可以执行${maxActions}个操作。

## 当前状态
${stateDescription}

${actionHistory}

${memoryContent}

## 可用工具
${toolDescriptions}
${this.getToolSafetyPromptGuidance()}
${state.config.preferredTools && state.config.preferredTools.length > 0 ? `\n推荐优先考虑使用这些工具: ${state.config.preferredTools.join(', ')}` : ''}

## 思考指南
请仔细思考当前状态和已有信息，决定下一步行动:

1. 评估已获取的信息是否足够做出决策
2. 考虑是否需要使用工具获取更多信息(如果已经执行过同样或类似参数的工具，则不需要重复执行)
3. 如果需要使用工具，选择最合适的工具并确定参数
4. 如果已有足够信息，可以结束分析并给出最终决策

请以JSON格式返回你的思考结果:
{
  "thought": "给用户看的简短决策摘要（一句话），不要输出完整逐步推理或隐藏思考",
  "nextAction": "use_tool或finish",
  "tools": [{
    "id": "工具ID",
    "params": {}, // 工具所需参数
  }], // 如果nextAction为use_tool
  
  // 如果决定结束，更新当前决策
  "isImportant": true|false,
  "shouldStore": true|false,
  "shouldNotify": true|false,
  "summary": "最终摘要",
  "reasonsToStore": ["理由1", "理由2"],
  "notificationPriority": "high|medium|low",
  ${analysisType === 'message' ? '"replyAdvice": "回复建议",' : ''}
  ${analysisType === 'meeting' ? '"topics": ["topic1", "topic2"],' : ''}
  ${analysisType === 'document' ? '"keyThemes": ["theme1", "theme2"],' : ''}
  ${analysisType === 'project' ? '"riskLevel": "low|medium|high",' : ''}
  ${analysisType === 'project' ? '"timeline": {onTrack: true|false, concerns: []},' : ''}
  ${
    analysisType === 'project'
      ? `"suggestions": {
    "status": "(In Progress|Done|Blocked|Released)", // 用英文直接填入具体的状态值（如：进行中、已完成、阻塞中），没有变化可留空
    "statusReason": "建议修改状态的原因", // 用中文给出状态变化的原因
    "owner": "", // 用英文直接填入具体的人名，没有变化可留空
    "ownerReason": "建议修改负责人的原因", // 用中文给出修改负责人的原因
    "track": "", // 用英文直接填入具体的赛道名称或团队名，没有变化可留空
    "highlights": ["highlight1", "highlight2"], // 用英文直接填入具体的备注内容，没有变化可留空
    "highlightsReason": "建议修改备注的原因", // 用中文给出备注变化的原因
    "actionItems": ["actionItem1", "actionItem2"],  // 用英文直接填入具体的行动项，没有变化可留空
    "actionItemsReason": "建议修改行动项的原因", // 用中文给出行动项变化的原因
    "documentation": ["文档更新建议"],
    "risks": ["风险描述1", "风险描述2"],
    "followUp": ["后续跟进项1", "后续跟进项2"]
  },`
      : ''
  }
  "confidence": 0.9
}
`;
  }

  public stop() {
    this.stopRequested = true;
  }
}

// 导出所有需要的接口和函数
export { Tool, registerTool };
