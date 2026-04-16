import { callLLMJsonAPI } from './llm';
import { extractEntitiesFromMessage } from './services/entityExtraction';
import { getMemoryServiceClient } from './services/MemoryServiceClient';
import { buildMessageFilterSystemPrompt } from './prompts';
import { getEnvConfig } from './utils';
import {
  getFirstManualItemFromMatchedRules,
  isManualConcernedItem,
  loadRuntimeWatchRules,
  resolveMatchedWatchRules,
} from './watchRules';
import type { TopicItemWithAutoReply } from './message-reaction/AutoReplyHandler';

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
}

// 定义可用工具列表
const availableTools: Record<string, AgentTool> = {
  entityExtraction: {
    name: '实体提取工具',
    description: '从消息中提取人物、时间、地点、项目等实体信息',
    execute: async (params) => {
      return await extractEntitiesFromMessage(
        params.message_content || params.content,
        params.metadata,
      );
    },
  },
  relationshipAnalysis: {
    name: '关系分析工具',
    description: '分析消息中提到的人物之间的关系',
    execute: async (params) => {
      const people = params.entities?.people || [];
      if (people.length < 2) return { relationships: [] };

      // 构建关系分析提示
      const relationshipPrompt = `
      分析以下人物之间可能的关系:
      ${people.map((p: { name: string }) => p.name).join(', ')}
      
      消息上下文:
      ${params.message_content || params.content}
      
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
      const searchQuery = `与"${params.person || ''}"相关的最近消息`;

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
      ${params.message_content || params.content}
      
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
      ${params.message_content || params.content}
      
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

      if (items.length === 0) {
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

      const envConfig = await getEnvConfig();
      const runtimeWatchRules = await loadRuntimeWatchRules(items);
      const systemPrompt = buildMessageFilterSystemPrompt({
        concernedItems: runtimeWatchRules,
        username: params.username || userinfo?.fullName || '',
        envConfig,
      });
      const xmlMessage = `<message_group team_name="${params.team_name || ''}" team_id="${params.team_id || ''}">\n  <standalone>\n    <message sender="${params.sender || ''}" datetime="${params.datetime || new Date().toISOString()}" post_id="${params.post_id || ''}">${escapeXml(params.message_content || params.content || '')}</message>\n  </standalone>\n</message_group>`;
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
      });
      const matchedManualItem = getFirstManualItemFromMatchedRules(
        resolvedMatch.watchRules,
      );

      return {
        shouldNotify: Boolean(matchedManualItem?.notifyMethod),
        shouldStore: resolvedMatch.watchRules.length > 0,
        matchedRule: firstMatch.matched_rule || '',
        matchedRuleRefs: resolvedMatch.matchedRuleRefs,
        matchedRuleIds: resolvedMatch.matchedRuleIds,
        summary: firstMatch.summary || firstMatch.filter_reason || '',
        confidence:
          typeof firstMatch.confidence === 'number'
            ? firstMatch.confidence
            : 0.7,
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
        messageContent:
          message.message_content || message.content || message.text,
        sender: message.sender || message.creator,
        datetime: message.datetime || message.time,
      },
      enrichedData: {},
      actions: [],
    };

    // 存储每个Agent的处理结果
    const agentResults: Record<string, any> = {};

    // 逐个运行Agent
    for (const agent of sortedAgents) {
      console.log(`运行Agent: ${agent.name}`);
      try {
        // 收集之前Agent的结果作为上下文
        const context = {
          ...message,
          ...result.enrichedData,
          previousResults: agentResults,
        };

        // 执行该Agent可用的工具
        const toolResults: Record<string, any> = {};
        for (const toolName of agent.tools) {
          if (availableTools[toolName]) {
            const tool = availableTools[toolName];
            console.log(`执行工具: ${tool.name}`);
            toolResults[toolName] = await tool.execute(context);
          }
        }

        // 存储该Agent的处理结果
        agentResults[agent.id] = toolResults;

        // 合并结果
        if (toolResults.entityExtraction) {
          result.enrichedData.entities = toolResults.entityExtraction;
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

  // 🆕 如果消息需要存储到向量数据库（通过 MemoryServiceClient HTTP 后端）
  if (processResult.shouldStore) {
    try {
      const client = getMemoryServiceClient();
      const ingestResult = await client.ingest({
        content: message.message_content,
        sourceType: 'glip',
        sender: message.sender || 'unknown',
        groupId: message.team_id,
        groupName: message.team_name,
        timestamp: new Date(message.datetime).getTime() || Date.now(),
        metadata: {
          datetime: message.datetime || new Date().toISOString(),
          matchedRules: processResult.matchedRule
            ? [processResult.matchedRule]
            : [],
          matchedRuleRefs: processResult.matchedRuleRefs || [],
          summary: message.summary || '',
          replyAdvice: processResult.replyAdvice || message.reply_advice || '',
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
