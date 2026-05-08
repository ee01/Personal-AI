import { callLLMJsonAPI } from './llm';
import { extractEntitiesFromMessage } from './services/entityExtraction';
import { getMemoryServiceClient } from './services/MemoryServiceClient';
import { buildMessageFilterSystemPrompt } from './prompts';
import { getEnvConfig } from './utils';
import {
  getFirstManualItemFromMatchedRules,
  isManualConcernedItem,
  filterWatchRulesForMessageContext,
  loadRuntimeWatchRules,
  resolveMatchedWatchRules,
} from './watchRules';
import type { TopicItemWithAutoReply } from './message-reaction/AutoReplyHandler';

const AGENT_WORKFLOW_NOTIFY_CONFIDENCE_THRESHOLD = 0.7;

// Agent配置接口
interface AgentConfig {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  priority: number;
  tools: string[];
}

// 定义Agent工具接口
interface AgentTool {
  name: string;
  description: string;
  execute: (params: any) => Promise<any>;
}

interface AgentWorkflowTraceTool {
  name: string;
  displayName: string;
  status: 'success' | 'skipped' | 'error';
  durationMs?: number;
  summary: string;
  error?: string;
}

interface AgentWorkflowTraceStep {
  agentId: string;
  agentName: string;
  priority: number;
  status: 'success' | 'skipped' | 'error';
  startedAt: string;
  durationMs: number;
  inputSummary: string;
  outputSummary: string;
  tools: AgentWorkflowTraceTool[];
  error?: string;
}

interface AgentStorageReview {
  generatedAt: string;
  summary: string;
  primaryReason: string;
  reasonSource:
    | 'concernedItemMatcher'
    | 'relevanceJudgment'
    | 'message'
    | 'workflow';
  shouldStore: boolean;
  shouldNotify: boolean;
  confidence: number;
  matchedRuleRefs: string[];
  matchedRuleIds: number[];
  entitySummary: {
    people: number;
    projects: number;
    topics: number;
    resources: number;
    webpages: number;
    jiraTickets: number;
    actions: number;
  };
  relationshipCount: number;
  replyAdviceAvailable: boolean;
  traceStatus: 'complete' | 'partial' | 'missing';
  agentCount: number;
  failedAgents: string[];
  toolErrorCount: number;
  notificationReviewRequired?: boolean;
  notificationReviewReason?: string;
  notificationConfidenceThreshold?: number;
}

interface AgentNotificationReview {
  required: boolean;
  status: 'pending' | 'not_required';
  reason: 'low_confidence_notification';
  confidence: number;
  threshold: number;
  originalShouldNotify: boolean;
  matchedRule?: string;
  matchedRuleRefs: string[];
  matchedRuleIds: number[];
  message: string;
}

// 消息处理接口
interface MessageProcessResult {
  isRelevant: boolean;
  shouldStore: boolean;
  shouldNotify: boolean; // 新增：是否需要发送通知
  confidence: number; // 新增：置信度
  summary: string; // 新增：消息摘要
  matchedRule?: string; // 新增：匹配的规则
  matchedRuleRefs?: string[];
  matchedRuleIds?: number[];
  messageContext?: {
    // 新增：消息上下文信息
    groupId?: string; // 群组ID (team_id)
    groupName?: string; // 群组名称 (team_name)
    messageContent?: string; // 消息内容 (message_content)
    sender?: string; // 发送者 (sender)
    datetime?: string; // 发送时间 (datetime)
  };
  enrichedData?: any;
  actions?: any[];
  replyAdvice?: string;
  agentWorkflowTrace?: AgentWorkflowTraceStep[];
  storageReview?: AgentStorageReview;
  notificationReview?: AgentNotificationReview;
}

function getMessageContent(message: any): string {
  return (
    message?.message_content ||
    message?.messageContent ||
    message?.content ||
    message?.text ||
    ''
  );
}

function getMessageDatetime(message: any): string {
  return message?.datetime || message?.time || new Date().toISOString();
}

function getMessageTimestamp(message: any): number {
  const timestamp = new Date(getMessageDatetime(message)).getTime();
  return Number.isFinite(timestamp) ? timestamp : Date.now();
}

function getEntityMap(entityExtraction: any): Record<string, any> {
  if (!entityExtraction || typeof entityExtraction !== 'object') {
    return {};
  }
  const entities = entityExtraction.entities || entityExtraction;
  return entities && typeof entities === 'object' ? entities : {};
}

function normalizePeople(people: any[] = []): Array<{ name: string }> {
  return people
    .map((person) => {
      if (typeof person === 'string') {
        return { name: person.trim() };
      }
      if (person && typeof person.name === 'string') {
        return { ...person, name: person.name.trim() };
      }
      return null;
    })
    .filter(
      (person): person is { name: string } =>
        Boolean(person && person.name.length > 0),
    );
}

function getPeopleFromContext(params: any): Array<{ name: string }> {
  return normalizePeople(getEntityMap(params.entities).people || []);
}

function truncateForTrace(value: any, maxLength = 180): string {
  let rawText = '';
  if (typeof value === 'string') {
    rawText = value;
  } else if (value !== undefined && value !== null) {
    try {
      rawText = JSON.stringify(value);
    } catch {
      rawText = String(value);
    }
  }
  const text = rawText.replace(/\s+/g, ' ').trim();
  return text.length > maxLength
    ? `${text.slice(0, Math.max(0, maxLength - 3))}...`
    : text;
}

function buildAgentInputSummary(context: any): string {
  const sender = context.sender || context.creator || 'unknown';
  const group = context.team_name || context.groupName || 'unknown group';
  const content = truncateForTrace(getMessageContent(context), 120);
  return `${sender} @ ${group}: ${content}`;
}

function summarizeToolResult(toolName: string, result: any): string {
  if (!result || typeof result !== 'object') {
    return truncateForTrace(result || 'empty result');
  }

  if (toolName === 'entityExtraction') {
    const entities = getEntityMap(result);
    const count = (value: any) => (Array.isArray(value) ? value.length : 0);
    return `people=${count(entities.people)}, projects=${count(entities.projects)}, topics=${count(entities.topics)}, actions=${count(result.actions)}`;
  }

  if (toolName === 'concernedItemMatcher') {
    return `store=${Boolean(result.shouldStore)}, notify=${Boolean(result.shouldNotify)}, refs=${(result.matchedRuleRefs || []).join('|') || 'none'}, confidence=${result.confidence ?? 0}`;
  }

  if (toolName === 'relationshipAnalysis') {
    return `relationships=${Array.isArray(result.relationships) ? result.relationships.length : 0}`;
  }

  if (toolName === 'historySearch') {
    const ids = result.results?.ids;
    return `query=${truncateForTrace(result.question || '', 80)}, results=${Array.isArray(ids) ? ids.length : 0}`;
  }

  if (toolName === 'relevanceJudgment') {
    return `important=${Boolean(result.isImportant)}, store=${Boolean(result.shouldStore)}, priority=${result.priority || 'unknown'}`;
  }

  if (toolName === 'externalServiceQuery') {
    return result.success
      ? `success=true, keys=${Object.keys(result.data || {}).join('|') || 'none'}`
      : `success=false, message=${truncateForTrace(result.message || 'unsupported')}`;
  }

  if (toolName === 'replyAdviser') {
    return `needsReply=${Boolean(result.needsReply)}, priority=${result.priority || 'unknown'}`;
  }

  return truncateForTrace(result);
}

function summarizeAgentOutput(toolResults: Record<string, any>): string {
  const summaries = Object.entries(toolResults).map(
    ([toolName, result]) => `${toolName}: ${summarizeToolResult(toolName, result)}`,
  );
  return summaries.length > 0 ? summaries.join('; ') : 'no tools executed';
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function getArrayCount(value: any): number {
  return Array.isArray(value) ? value.length : 0;
}

function getNestedToolResult(
  agentResults: Record<string, any>,
  agentId: string,
  toolName: string,
): any {
  return agentResults?.[agentId]?.[toolName];
}

function buildStorageReview(params: {
  message: any;
  result: MessageProcessResult;
  agentResults: Record<string, any>;
}): AgentStorageReview {
  const { message, result, agentResults } = params;
  const relevanceJudgment = getNestedToolResult(
    agentResults,
    'relevanceJudge',
    'relevanceJudgment',
  );
  const matcher = getNestedToolResult(
    agentResults,
    'notificationJudge',
    'concernedItemMatcher',
  );
  const entities = result.enrichedData?.entities || {};
  const relationships = result.enrichedData?.relationships;
  const trace = result.agentWorkflowTrace || [];
  const failedAgents = trace
    .filter((step) => step.status === 'error')
    .map((step) => step.agentName || step.agentId);
  const toolErrorCount = trace.reduce(
    (count, step) =>
      count + step.tools.filter((tool) => tool.status === 'error').length,
    0,
  );

  let reasonSource: AgentStorageReview['reasonSource'] = 'workflow';
  let primaryReason = 'Agent Workflow requested storage';

  if ((result.matchedRuleRefs || []).length > 0 || result.matchedRule) {
    reasonSource = 'concernedItemMatcher';
    primaryReason =
      result.matchedRule ||
      `Matched watch rules: ${(result.matchedRuleRefs || []).join(', ')}`;
  } else if (relevanceJudgment?.reason) {
    reasonSource = 'relevanceJudgment';
    primaryReason = String(relevanceJudgment.reason);
  } else if (relevanceJudgment?.isImportant || relevanceJudgment?.shouldStore) {
    reasonSource = 'relevanceJudgment';
    primaryReason = `Importance=${Boolean(relevanceJudgment.isImportant)}, store=${Boolean(relevanceJudgment.shouldStore)}, priority=${relevanceJudgment.priority || 'unknown'}`;
  } else if (message.summary) {
    reasonSource = 'message';
    primaryReason = String(message.summary);
  }

  const summary =
    truncateForTrace(result.summary, 260) ||
    truncateForTrace(relevanceJudgment?.reason, 260) ||
    truncateForTrace(message.summary, 260) ||
    `Agent Workflow 存储：${truncateForTrace(getMessageContent(message), 180)}`;

  return {
    generatedAt: new Date().toISOString(),
    summary,
    primaryReason: truncateForTrace(primaryReason, 320),
    reasonSource,
    shouldStore: Boolean(result.shouldStore),
    shouldNotify: Boolean(result.shouldNotify),
    confidence:
      typeof result.confidence === 'number'
        ? result.confidence
        : typeof matcher?.confidence === 'number'
          ? matcher.confidence
          : 0,
    matchedRuleRefs: result.matchedRuleRefs || [],
    matchedRuleIds: result.matchedRuleIds || [],
    entitySummary: {
      people: getArrayCount(entities.people),
      projects: getArrayCount(entities.projects),
      topics: getArrayCount(entities.topics),
      resources: getArrayCount(entities.resources),
      webpages: getArrayCount(entities.webpages),
      jiraTickets: getArrayCount(entities.jiraTickets),
      actions: getArrayCount(result.actions),
    },
    relationshipCount: getArrayCount(relationships),
    replyAdviceAvailable: Boolean(result.replyAdvice),
    traceStatus:
      trace.length === 0
        ? 'missing'
        : failedAgents.length > 0 || toolErrorCount > 0
          ? 'partial'
          : 'complete',
    agentCount: trace.length,
    failedAgents,
    toolErrorCount,
    notificationReviewRequired: Boolean(result.notificationReview?.required),
    notificationReviewReason: result.notificationReview?.reason,
    notificationConfidenceThreshold: result.notificationReview?.threshold,
  };
}

function buildNotificationReviewGate(
  result: MessageProcessResult,
): AgentNotificationReview | null {
  if (!result.shouldNotify) {
    return null;
  }

  const confidence =
    typeof result.confidence === 'number' && Number.isFinite(result.confidence)
      ? result.confidence
      : 0;

  if (confidence >= AGENT_WORKFLOW_NOTIFY_CONFIDENCE_THRESHOLD) {
    return null;
  }

  const percentage = Math.round(confidence * 100);
  const thresholdPercentage = Math.round(
    AGENT_WORKFLOW_NOTIFY_CONFIDENCE_THRESHOLD * 100,
  );

  return {
    required: true,
    status: 'pending',
    reason: 'low_confidence_notification',
    confidence,
    threshold: AGENT_WORKFLOW_NOTIFY_CONFIDENCE_THRESHOLD,
    originalShouldNotify: true,
    matchedRule: result.matchedRule,
    matchedRuleRefs: result.matchedRuleRefs || [],
    matchedRuleIds: result.matchedRuleIds || [],
    message: `低置信度关注项命中待复核：${percentage}% < ${thresholdPercentage}%`,
  };
}

function applyNotificationReviewGate(result: MessageProcessResult) {
  const reviewGate = buildNotificationReviewGate(result);
  if (!reviewGate) {
    return;
  }

  result.notificationReview = reviewGate;
  result.shouldNotify = false;
  result.shouldStore = true;
  if (!result.summary) {
    result.summary = reviewGate.message;
  }
}

// 定义可用工具列表
const availableTools: Record<string, AgentTool> = {
  entityExtraction: {
    name: '实体提取工具',
    description: '从消息中提取人物、时间、地点、项目等实体信息',
    execute: async (params) => {
      return await extractEntitiesFromMessage(
        getMessageContent(params),
        params.metadata || {
          sender: params.sender,
          team_name: params.team_name,
          summary: params.summary,
        },
      );
    },
  },
  relationshipAnalysis: {
    name: '关系分析工具',
    description: '分析消息中提到的人物之间的关系',
    execute: async (params) => {
      const people = getPeopleFromContext(params);
      if (people.length < 2) return { relationships: [] };

      // 构建关系分析提示
      const relationshipPrompt = `
      分析以下人物之间可能的关系:
      ${people.map((p) => p.name).join(', ')}
      
      消息上下文:
      ${getMessageContent(params)}
      
      ${params.summary ? `上下文总结: ${params.summary}` : ''}
      
      请识别这些人物之间可能存在的组织关系、协作关系或其他关联。
      返回格式为JSON:
      {
        "relationships": [
          {
            "source": "人物1",
            "target": "人物2",
            "relationship": "关系描述",
            "confidence": 0.8  // 0-1之间的置信度
          }
        ]
      }
      `;

      const relationshipData = await callLLMJsonAPI({
        prompt: relationshipPrompt,
        type: 'query',
      });
      return relationshipData || { relationships: [] };
    },
  },
  historySearch: {
    name: '历史消息搜索工具',
    description: '搜索历史消息以提供上下文',
    execute: async (params) => {
      const primaryPerson = params.person || getPeopleFromContext(params)[0]?.name;
      const searchQuery = primaryPerson
        ? `与"${primaryPerson}"相关的最近消息`
        : `与当前消息"${getMessageContent(params).slice(0, 80)}"相关的最近消息`;

      const timeRange =
        params.time_range && params.time_range.start && params.time_range.end
          ? { start: params.time_range.start, end: params.time_range.end }
          : undefined;

      try {
        const client = getMemoryServiceClient();
        const recallResult = await client.recall(searchQuery, {
          topK: 5,
          channels: ['vector', 'fts'],
          timeRange,
        });

        const items = recallResult.items || [];

        // 转换为兼容格式
        return {
          question: searchQuery,
          results: {
            ids: items.map((m) => m.id),
            documents: items.map((m) => m.content),
            metadatas: items.map((m) => ({
              sender: m.metadata?.sender,
              groupName: m.metadata?.groupName,
              datetime: m.metadata?.datetime,
              summary: m.metadata?.summary,
            })),
            distances: items.map((m) => 1 - (m.score || 0)),
          },
        };
      } catch (error) {
        console.error('历史消息搜索失败:', error);
        return {
          question: searchQuery,
          results: { ids: [], documents: [], metadatas: [], distances: [] },
        };
      }
    },
  },
  relevanceJudgment: {
    name: '重要性判断工具',
    description: '判断消息的重要性及是否需要存储',
    execute: async (params) => {
      // 🔄 使用 MemoryServiceClient 获取相关的人物及项目信息
      let knownPeople: string[] = [];
      let knownProjects: string[] = [];
      try {
        const client = getMemoryServiceClient();
        const [peopleRes, projectsRes] = await Promise.all([
          client.getEntities('Person'),
          client.getEntities('Project'),
        ]);
        knownPeople = (peopleRes.items || []).map((e) => e.name);
        knownProjects = (projectsRes.items || []).map((e) => e.name);
      } catch (error) {
        console.error('获取已知人物/项目失败:', error);
      }

      // 构建重要性判断提示
      const relevancePrompt = `
      分析以下消息的重要性:
      
      消息内容:
      ${getMessageContent(params)}
      
      发送者: ${params.sender}
      ${params.team_name ? `聊天群组: ${params.team_name}` : ''}
      ${params.summary ? `上下文总结: ${params.summary}` : ''}
      
      已知的重要人物: ${knownPeople.join(', ')}
      已知的重要项目: ${knownProjects.join(', ')}
      
      请判断:
      1. 此消息是否包含重要信息
      2. 消息是否应该存储以供将来参考
      3. 消息的优先级(高/中/低)
      
      以JSON格式返回:
      {
        "isImportant": true/false,
        "shouldStore": true/false,
        "priority": "high/medium/low",
        "reason": "判断理由",
        "tags": ["相关标签"]
      }
      `;

      return await callLLMJsonAPI({ prompt: relevancePrompt, type: 'query' });
    },
  },
  externalServiceQuery: {
    name: '外部服务查询工具',
    description: '查询Jira、Wiki等外部服务获取额外信息',
    execute: async (params) => {
      // 目前仅模拟实现，实际应用需要集成相应的API
      if (params.service === 'jira' && params.issueId) {
        // 模拟Jira查询
        return {
          success: true,
          data: {
            status: '进行中',
            assignee: '某人员',
            description: '这是一个模拟的Jira任务',
          },
        };
      }
      if (params.service === 'wiki' && params.topic) {
        // 模拟Wiki查询
        return {
          success: true,
          data: {
            content: '这是关于该主题的Wiki内容',
            lastUpdated: new Date().toISOString(),
          },
        };
      }
      return { success: false, message: '不支持的服务或缺少参数' };
    },
  },
  replyAdviser: {
    name: '回复建议工具',
    description: '根据消息内容和上下文生成回复建议',
    execute: async (params) => {
      // 构建回复建议提示
      const replyPrompt = `
      分析以下消息并提供回复建议:
      
      消息内容:
      ${getMessageContent(params)}
      
      发送者: ${params.sender}
      ${params.team_name ? `聊天群组: ${params.team_name}` : ''}
      ${params.summary ? `上下文总结: ${params.summary}` : ''}
      ${params.entities ? `消息中提到的实体: ${JSON.stringify(params.entities)}` : ''}
      
      请提供:
      1. 是否需要回复(true/false)
      2. 如需回复，提供一个合适的回复建议
      3. 回复的优先级(高/中/低)
      
      以JSON格式返回:
      {
        "needsReply": true/false,
        "replyText": "建议回复内容",
        "priority": "high/medium/low",
        "reason": "建议原因"
      }
      `;

      return await callLLMJsonAPI({ prompt: replyPrompt, type: 'query' });
    },
  },
  concernedItemMatcher: {
    name: '关注项匹配工具',
    description: '检查消息是否匹配用户关注的话题并生成通知',
    execute: async (params) => {
      const { concernedItems = [], userinfo } = await chrome.storage.local.get([
        'concernedItems',
        'userinfo',
      ]);
      const items = (concernedItems as TopicItemWithAutoReply[]).filter(
        isManualConcernedItem,
      );
      const envConfig = await getEnvConfig();
      const runtimeWatchRules = filterWatchRulesForMessageContext(
        await loadRuntimeWatchRules(items),
        {
          sender: params.sender,
          groupId: params.team_id,
          groupName: params.team_name,
        },
      );

      if (runtimeWatchRules.length === 0) {
        return {
          shouldNotify: false,
          shouldStore: false,
          matchedRule: '',
          matchedRuleRefs: [],
          matchedRuleIds: [],
          summary: '',
          confidence: 0,
        };
      }

      const systemPrompt = buildMessageFilterSystemPrompt({
        concernedItems: runtimeWatchRules,
        username: params.username || userinfo?.fullName || '',
        envConfig,
      });
      const xmlMessage = `<message_group team_name="${params.team_name || ''}" team_id="${params.team_id || ''}">\n  <standalone>\n    <message sender="${params.sender || ''}" datetime="${params.datetime || new Date().toISOString()}" post_id="${params.post_id || ''}">${escapeXml(getMessageContent(params))}</message>\n  </standalone>\n</message_group>`;
      const userPrompt = `
我的名字是：<current_user_name>${params.username || userinfo?.fullName || ''}</current_user_name>

---- 这是我收到的最近聊条消息开始 ----
${xmlMessage}
---- 这是我收到的最近聊条消息结束 ----
`;

      const matchResult = await callLLMJsonAPI({
        system_prompt: systemPrompt,
        user_prompt: userPrompt,
        type: 'query',
      });

      const firstMatch = Array.isArray(matchResult?.data)
        ? matchResult.data[0]
        : null;
      if (!firstMatch) {
        return {
          shouldNotify: false,
          shouldStore: false,
          matchedRule: '',
          matchedRuleRefs: [],
          matchedRuleIds: [],
          summary: '无法分析消息内容',
          confidence: 0,
        };
      }

      const resolvedMatch = resolveMatchedWatchRules({
        watchRules: runtimeWatchRules,
        matchedRule: firstMatch.matched_rule,
        matchedRuleRefs: Array.isArray(firstMatch.matched_rule_refs)
          ? firstMatch.matched_rule_refs
          : [],
        matchedRuleIds: Array.isArray(firstMatch.matched_rule_ids)
          ? firstMatch.matched_rule_ids
          : [],
        messageContext: {
          sender: params.sender,
          groupId: params.team_id,
          groupName: params.team_name,
        },
      });
      const matchedManualItem = getFirstManualItemFromMatchedRules(
        resolvedMatch.watchRules,
      );
      const hasResolvedMatch = resolvedMatch.watchRules.length > 0;

      return {
        shouldNotify: Boolean(matchedManualItem?.notifyMethod),
        shouldStore: hasResolvedMatch,
        matchedRule: hasResolvedMatch ? firstMatch.matched_rule || '' : '',
        matchedRuleRefs: hasResolvedMatch ? resolvedMatch.matchedRuleRefs : [],
        matchedRuleIds: hasResolvedMatch ? resolvedMatch.matchedRuleIds : [],
        summary: hasResolvedMatch
          ? firstMatch.summary || firstMatch.filter_reason || ''
          : '',
        confidence:
          hasResolvedMatch && typeof firstMatch.confidence === 'number'
            ? firstMatch.confidence
            : hasResolvedMatch
              ? 0.7
              : 0,
      };
    },
  },
};

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Agent调度器
class AgentCoordinator {
  private agents: AgentConfig[] = [];

  constructor() {
    // 初始化默认agents
    this.agents = [
      {
        id: 'entityRecognizer',
        name: '实体识别Agent',
        description: '负责从消息中识别和提取实体',
        enabled: true,
        priority: 100,
        tools: ['entityExtraction'],
      },
      {
        id: 'relationshipAnalyzer',
        name: '关系分析Agent',
        description: '分析实体之间的关系',
        enabled: true,
        priority: 90,
        tools: ['relationshipAnalysis', 'historySearch'],
      },
      {
        id: 'relevanceJudge',
        name: '重要性判断Agent',
        description: '评估消息的重要性并决定是否存储',
        enabled: true,
        priority: 80,
        tools: ['relevanceJudgment', 'historySearch'],
      },
      {
        id: 'externalInfoFetcher',
        name: '外部信息获取Agent',
        description: '从Jira、Wiki等外部服务获取相关信息',
        enabled: true,
        priority: 70,
        tools: ['externalServiceQuery'],
      },
      {
        id: 'responseAdviser',
        name: '回复建议Agent',
        description: '生成回复建议',
        enabled: true,
        priority: 60,
        tools: ['replyAdviser'],
      },
      {
        id: 'notificationJudge',
        name: '通知判断Agent',
        description: '检查消息是否匹配关注项并决定是否发送通知',
        enabled: true,
        priority: 95, // 高优先级，在实体识别后立即执行
        tools: ['concernedItemMatcher'],
      },
    ];
  }

  // 获取Agent配置
  async getAgents(): Promise<AgentConfig[]> {
    try {
      const { customAgents } = await chrome.storage.local.get('customAgents');
      if (customAgents && Array.isArray(customAgents)) {
        return [...this.agents, ...customAgents];
      }
    } catch (error) {
      console.error('获取自定义Agent失败:', error);
    }
    return this.agents;
  }

  // 添加自定义Agent
  async addAgent(agent: AgentConfig): Promise<boolean> {
    try {
      const { customAgents } = await chrome.storage.local.get('customAgents');
      const updatedAgents = customAgents || [];
      updatedAgents.push(agent);
      await chrome.storage.local.set({ customAgents: updatedAgents });
      return true;
    } catch (error) {
      console.error('添加自定义Agent失败:', error);
      return false;
    }
  }

  // 执行Agent调度流程
  async processMessage(message: any): Promise<MessageProcessResult> {
    const agents = await this.getAgents();
    // 按优先级排序
    const sortedAgents = agents
      .filter((agent) => agent.enabled)
      .sort((a, b) => b.priority - a.priority);

    console.log(`开始处理消息，启用了 ${sortedAgents.length} 个Agent`);

    // 初始化处理结果
    const result: MessageProcessResult = {
      isRelevant: false,
      shouldStore: false,
      shouldNotify: false, // 新增字段
      confidence: 0, // 新增字段
      summary: '', // 新增字段
      matchedRule: '', // 新增字段
      matchedRuleRefs: [],
      matchedRuleIds: [],
      messageContext: {
        // 新增字段：填充消息上下文
        groupId: message.team_id || message.groupId,
        groupName: message.team_name || message.groupName,
        messageContent: getMessageContent(message),
        sender: message.sender || message.creator,
        datetime: getMessageDatetime(message),
      },
      enrichedData: {},
      actions: [],
      agentWorkflowTrace: [],
    };

    // 存储每个Agent的处理结果
    const agentResults: Record<string, any> = {};

    // 逐个运行Agent
    for (const agent of sortedAgents) {
      console.log(`运行Agent: ${agent.name}`);
      const traceStep: AgentWorkflowTraceStep = {
        agentId: agent.id,
        agentName: agent.name,
        priority: agent.priority,
        status: 'success',
        startedAt: new Date().toISOString(),
        durationMs: 0,
        inputSummary: '',
        outputSummary: '',
        tools: [],
      };
      const stepStartedAt = Date.now();
      try {
        // 收集之前Agent的结果作为上下文
        const context = {
          ...message,
          ...result.enrichedData,
          previousResults: agentResults,
        };
        traceStep.inputSummary = buildAgentInputSummary(context);

        // 执行该Agent可用的工具
        const toolResults: Record<string, any> = {};
        for (const toolName of agent.tools) {
          if (availableTools[toolName]) {
            const tool = availableTools[toolName];
            console.log(`执行工具: ${tool.name}`);
            const toolStartedAt = Date.now();
            try {
              toolResults[toolName] = await tool.execute(context);
              traceStep.tools.push({
                name: toolName,
                displayName: tool.name,
                status: 'success',
                durationMs: Date.now() - toolStartedAt,
                summary: summarizeToolResult(toolName, toolResults[toolName]),
              });
            } catch (toolError) {
              traceStep.tools.push({
                name: toolName,
                displayName: tool.name,
                status: 'error',
                durationMs: Date.now() - toolStartedAt,
                summary: 'tool failed',
                error: getErrorMessage(toolError),
              });
              throw toolError;
            }
          } else {
            traceStep.tools.push({
              name: toolName,
              displayName: toolName,
              status: 'skipped',
              summary: 'tool is not registered',
            });
          }
        }
        const allToolsSkipped =
          traceStep.tools.length > 0 &&
          traceStep.tools.every((tool) => tool.status === 'skipped');
        if (traceStep.tools.length === 0 || allToolsSkipped) {
          traceStep.status = 'skipped';
        }
        traceStep.outputSummary = allToolsSkipped
          ? traceStep.tools
              .map((tool) => `${tool.name}: ${tool.summary}`)
              .join('; ')
          : summarizeAgentOutput(toolResults);

        // 存储该Agent的处理结果
        agentResults[agent.id] = toolResults;

        // 合并结果
        if (toolResults.entityExtraction) {
          result.enrichedData.entityExtraction = toolResults.entityExtraction;
          result.enrichedData.entities = getEntityMap(
            toolResults.entityExtraction,
          );
          result.enrichedData.entityMetadata =
            toolResults.entityExtraction.metadata || {};
          if (Array.isArray(toolResults.entityExtraction.actions)) {
            result.actions = toolResults.entityExtraction.actions;
            result.enrichedData.actions = toolResults.entityExtraction.actions;
          }
        }

        if (toolResults.relationshipAnalysis) {
          result.enrichedData.relationships =
            toolResults.relationshipAnalysis.relationships;
        }

        if (toolResults.relevanceJudgment) {
          result.isRelevant =
            toolResults.relevanceJudgment.isImportant || false;
          result.shouldStore =
            result.shouldStore ||
            toolResults.relevanceJudgment.shouldStore ||
            false;
          result.enrichedData.priority =
            toolResults.relevanceJudgment.priority || 'medium';
          result.enrichedData.tags = toolResults.relevanceJudgment.tags || [];
        }

        if (toolResults.externalServiceQuery?.success) {
          result.enrichedData.externalData =
            toolResults.externalServiceQuery.data;
        }

        if (toolResults.replyAdviser) {
          result.replyAdvice = toolResults.replyAdviser.needsReply
            ? toolResults.replyAdviser.replyText
            : '';
        }

        if (toolResults.concernedItemMatcher) {
          result.shouldNotify =
            toolResults.concernedItemMatcher.shouldNotify || false;
          result.shouldStore =
            result.shouldStore ||
            toolResults.concernedItemMatcher.shouldStore ||
            false;
          result.matchedRule =
            toolResults.concernedItemMatcher.matchedRule || '';
          result.matchedRuleRefs =
            toolResults.concernedItemMatcher.matchedRuleRefs || [];
          result.matchedRuleIds =
            toolResults.concernedItemMatcher.matchedRuleIds || [];
          result.summary = toolResults.concernedItemMatcher.summary || '';
          result.confidence = toolResults.concernedItemMatcher.confidence || 0;
        }
      } catch (error) {
        console.error(`Agent "${agent.name}" 执行失败:`, error);
        traceStep.status = 'error';
        traceStep.error = getErrorMessage(error);
        traceStep.outputSummary = traceStep.outputSummary || 'agent failed';
      } finally {
        traceStep.durationMs = Date.now() - stepStartedAt;
        result.agentWorkflowTrace?.push(traceStep);
      }
    }

    applyNotificationReviewGate(result);

    if (result.shouldStore) {
      result.storageReview = buildStorageReview({
        message,
        result,
        agentResults,
      });
      if (!result.summary) {
        result.summary = result.storageReview.summary;
      }
    }

    console.log('所有Agent处理完成，最终结果:', result);
    return result;
  }
}

// 创建全局单例
const agentCoordinator = new AgentCoordinator();

// 主入口函数：处理新消息
export async function processNewMessage(
  message: any,
): Promise<MessageProcessResult> {
  console.log('Agent系统接收到新消息:', message);

  // 调用Agent协调器处理消息，传递完整的消息上下文
  const processResult = await agentCoordinator.processMessage(message);
  const messageContent = getMessageContent(message);

  // 🆕 如果消息需要存储到向量数据库（通过 MemoryServiceClient HTTP 后端）
  if (processResult.shouldStore) {
    if (!messageContent.trim()) {
      console.warn('agentWorkflow跳过空消息存储:', {
        postId: message.post_id,
        teamId: message.team_id,
      });
      return processResult;
    }

    try {
      const client = getMemoryServiceClient();
      const ingestResult = await client.ingest({
        content: messageContent,
        sourceType: 'glip',
        sender: message.sender || 'unknown',
        groupId: message.team_id,
        groupName: message.team_name,
        timestamp: getMessageTimestamp(message),
        metadata: {
          datetime: getMessageDatetime(message),
          matchedRules: processResult.matchedRule
            ? [processResult.matchedRule]
            : [],
          matchedRuleRefs: processResult.matchedRuleRefs || [],
          summary:
            processResult.storageReview?.summary ||
            processResult.summary ||
            message.summary ||
            '',
          replyAdvice: processResult.replyAdvice || message.reply_advice || '',
          agentWorkflowTrace: processResult.agentWorkflowTrace || [],
          storageReview: processResult.storageReview,
          notificationReview: processResult.notificationReview,
          groupUrl: message.team_url,
          contextMessages: [], // agentWorkflow 模式下暂无上下文
          ...processResult.enrichedData,
        },
      });

      console.log(
        `✅ 消息和实体关联存储完成 [agentWorkflow]: ${ingestResult.id}`,
        {
          status: ingestResult.status,
          entitiesExtracted: ingestResult.entitiesExtracted,
          matchedProjects: ingestResult.matchedProjects,
        },
      );
    } catch (error) {
      console.error('🚨 agentWorkflow存储消息失败:', error);
    }
  }

  return processResult;
}

// 公开协调器实例以供配置
export { agentCoordinator };
