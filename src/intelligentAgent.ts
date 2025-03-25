import { callLLMJsonAPI } from './llm';
import { storeMessage } from './vectorStore';
import { extractEntitiesToStore } from './entityExtraction';
import { naturalLanguageQuery, getAllKnownPeople, getAllKnownProjects, getAllKnownTopics } from './vectorStore';
import { getEnvConfig } from './utils';
import { v4 as uuidv4 } from 'uuid';

/**
 * 工具接口定义
 */
interface Tool {
  id: string;
  name: string;
  description: string;
  execute: (params: any) => Promise<any>;
  parameterDefs?: ParameterDefinition[]; // 参数定义列表
}

/**
 * 参数定义接口
 */
interface ParameterDefinition {
  name: string;
  description: string;
  required: boolean;
  type?: string;
  defaultValue?: any;
  options?: string[]; // 可选值列表，用于枚举类型
}

/**
 * 思考结果接口
 */
interface ThoughtResult {
  thought: string;
  nextAction: string;
  tools: string[];
  params: Record<string, any>;
  messageIndex?: number;
  isImportant?: boolean;
  shouldStore?: boolean;
  shouldNotify?: boolean;
  confidence?: number;
  summary?: string;
  reasons?: string[];
  notificationPriority?: 'high' | 'medium' | 'low';
  replyAdvice?: string;
  extractedEntities?: any;
}

/**
 * 消息处理结果接口
 */
interface MessageProcessResult {
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
}

/**
 * 思考步骤接口，用于记录Agent思考过程
 */
export interface ThoughtStep {
  timestamp: number;
  thought: string;
  action: string;
  toolUsed?: string;
  result?: any;
}

/**
 * 工具注册表
 */
const toolRegistry: Record<string, Tool> = {};

/**
 * 注册工具
 */
export function registerTool(tool: Tool): void {
  toolRegistry[tool.id] = tool;
  console.log(`工具已注册: ${tool.name} (${tool.id})`);
}

/**
 * 获取工具列表
 */
export function getAvailableTools(): Tool[] {
  return Object.values(toolRegistry);
}

/**
 * 基础工具实现
 */
// 实体提取工具
registerTool({
  id: 'entityExtractor',
  name: '实体提取',
  description: '从消息中提取人物、项目、时间等实体信息',
  parameterDefs: [
    {
      name: 'content',
      description: '需要提取实体的文本内容',
      required: true,
      type: 'string'
    },
    {
      name: 'metadata',
      description: '额外的元数据信息',
      required: false,
      type: 'object'
    }
  ],
  execute: async (params) => {
    return await extractEntitiesToStore(params.content, params.metadata || {});
  }
});

// 历史消息搜索工具
registerTool({
  id: 'historySearch',
  name: '历史消息搜索',
  description: '搜索与当前消息相关的历史消息',
  parameterDefs: [
    {
      name: 'content',
      description: '作为搜索上下文的消息内容',
      required: true,
      type: 'string'
    },
    {
      name: 'customQuery',
      description: '自定义搜索查询',
      required: false,
      type: 'string'
    },
    {
      name: 'people',
      description: '需要包含的人物名称数组',
      required: false,
      type: 'string[]'
    },
    {
      name: 'projects',
      description: '需要包含的项目名称数组',
      required: false,
      type: 'string[]'
    },
    {
      name: 'timeRange',
      description: '时间范围',
      required: false,
      type: 'object'
    },
    {
      name: 'limit',
      description: '返回结果数量限制',
      required: false,
      type: 'number',
      defaultValue: 5
    }
  ],
  execute: async (params) => {
    // 构建搜索查询
    const query = params.customQuery || `与以下内容相关的消息: ${params.content.substring(0, 100)}...`;
    const filters: any = {};
    
    // 如果提供了特定筛选条件
    if (params.people?.length) {
      filters.entities = {
        people: params.people.map((name: string) => ({ name, required: true }))
      };
    }
    
    if (params.projects?.length) {
      if (!filters.entities) filters.entities = {};
      filters.entities.projects = params.projects.map((name: string) => ({ name, required: true }));
    }
    
    if (params.timeRange) {
      filters.timeRange = params.timeRange;
    }
    
    return await naturalLanguageQuery(query, filters, {
      limit: params.limit || 5,
      sort: {
        field: 'timestamp',
        order: 'desc'
      }
    });
  }
});

// 消息存储工具
registerTool({
  id: 'messageStore',
  name: '消息存储',
  description: '将重要消息存储到向量数据库',
  parameterDefs: [
    {
      name: 'messageId',
      description: '消息唯一标识符，不提供时会自动生成',
      required: false,
      type: 'string'
    },
    {
      name: 'content',
      description: '需要存储的消息内容',
      required: true,
      type: 'string'
    },
    {
      name: 'messageContent',
      description: '需要存储的消息内容（content的别名）',
      required: false,
      type: 'string'
    },
    {
      name: 'message_content',
      description: '需要存储的消息内容（content的别名）',
      required: false,
      type: 'string'
    },
    {
      name: 'sender',
      description: '消息发送者',
      required: true,
      type: 'string'
    },
    {
      name: 'timestamp',
      description: '消息发送时间戳',
      required: false,
      type: 'number'
    },
    {
      name: 'summary',
      description: '消息摘要',
      required: false,
      type: 'string'
    },
    {
      name: 'teamName',
      description: '团队名称',
      required: false,
      type: 'string'
    },
    {
      name: 'team_name',
      description: '团队名称（teamName的别名）',
      required: false,
      type: 'string'
    },
    {
      name: 'teamId',
      description: '团队ID',
      required: false,
      type: 'string'
    },
    {
      name: 'team_id',
      description: '团队ID（teamId的别名）',
      required: false,
      type: 'string'
    },
    {
      name: 'matchedRules',
      description: '匹配的规则数组',
      required: false,
      type: 'string[]'
    },
    {
      name: 'importance',
      description: '消息重要性',
      required: false,
      type: 'string',
      options: ['high', 'medium', 'low']
    },
    {
      name: 'reasons',
      description: '存储原因',
      required: false,
      type: 'string[]'
    },
    {
      name: 'entities',
      description: '实体信息',
      required: false,
      type: 'object'
    },
    {
      name: 'sentiment',
      description: '情感倾向',
      required: false,
      type: 'string',
      options: ['positive', 'negative', 'neutral']
    },
    {
      name: 'priority',
      description: '优先级',
      required: false,
      type: 'string',
      options: ['high', 'medium', 'low']
    },
    {
      name: 'category',
      description: '分类标签',
      required: false,
      type: 'string[]'
    },
    {
      name: 'tags',
      description: '标签',
      required: false,
      type: 'string[]'
    }
  ],
  execute: async (params) => {
    if (!params.messageId) params.messageId = uuidv4();
    
    // 确保参数兼容性
    const content = params.content || params.messageContent || params.message_content || '';
    const sender = params.sender || 'unknown';
    const timestamp = params.timestamp || Date.now();
    const summary = params.summary || '';
    
    // 构建正确的元数据结构
    const metadata: any = {
      source: sender,
      timestamp: timestamp,
      matchedRules: params.matchedRules || [],
      summary: summary,
      teamName: params.teamName || params.team_name,
      teamId: params.teamId || params.team_id,
      reply_advice: params.replyAdvice || params.reply_advice || ''
    };
    
    // 添加实体信息
    if (params.entities) {
      metadata.entities = params.entities;
    }
    
    // 添加元数据信息
    metadata.metadata = {
      sentiment: params.sentiment || (params.metadata?.sentiment || 'neutral'),
      priority: params.priority || (params.metadata?.priority || 'medium'),
      category: params.category || (params.metadata?.category || []),
      tags: params.tags || (params.metadata?.tags || [])
    };
    
    // 处理自定义字段，保存到metadata对象
    if (params.importance) {
      metadata.importance = params.importance;
    }
    
    if (params.reasons) {
      metadata.reasons = params.reasons;
    }
    
    if (params.extractedData) {
      metadata.extractedData = params.extractedData;
    }
    
    // 添加关系信息
    if (params.relationships) {
      metadata.relationships = params.relationships;
    }
    
    // 添加行动信息
    if (params.actions) {
      metadata.actions = params.actions;
    }
    
    await storeMessage(
      params.messageId,
      content,
      metadata
    );
    
    return {
      success: true,
      messageId: params.messageId
    };
  }
});

// 消息通知工具
registerTool({
  id: 'notifier',
  name: '消息通知',
  description: '通过bot向用户发送重要消息通知',
  parameterDefs: [
    {
      name: 'messageId',
      description: '消息唯一标识符',
      required: false,
      type: 'string'
    },
    {
      name: 'content',
      description: '需要通知的消息内容',
      required: true,
      type: 'string'
    },
    {
      name: 'summary',
      description: '消息摘要',
      required: false,
      type: 'string'
    },
    {
      name: 'sender',
      description: '原始消息发送者',
      required: false,
      type: 'string'
    },
    {
      name: 'teamName',
      description: '团队名称',
      required: false,
      type: 'string'
    },
    {
      name: 'priority',
      description: '通知优先级',
      required: false,
      type: 'string',
      options: ['high', 'medium', 'low'],
      defaultValue: 'medium'
    },
    {
      name: 'replyAdvice',
      description: '回复建议',
      required: false,
      type: 'string'
    }
  ],
  execute: async (params) => {
    // 这里可以集成发送消息到bot的逻辑
    console.log(`将通过Bot发送通知: ${params.content}`);
    // 实际实现可能需要调用sendBotMessage等函数
    return {
      success: true,
      notified: true,
      messageId: params.messageId
    };
  }
});

// JIRA查询工具
registerTool({
  id: 'jiraQuery',
  name: 'JIRA信息查询',
  description: '查询JIRA中的任务、需求和bug信息',
  execute: async (params) => {
    // 模拟实现，实际环境中需要集成JIRA API
    console.log(`查询JIRA信息: ${JSON.stringify(params)}`);
    
    if (params.issueId) {
      return {
        success: true,
        issue: {
          id: params.issueId,
          title: `模拟JIRA任务 ${params.issueId}`,
          status: '进行中',
          assignee: '开发人员',
          reporter: '产品经理',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          description: '这是一个模拟的JIRA任务描述'
        }
      };
    }
    
    // 根据关键词搜索JIRA
    if (params.keywords) {
      return {
        success: true,
        issues: [
          {
            id: 'PROJ-1001',
            title: `与"${params.keywords}"相关的任务1`,
            status: '待处理',
            assignee: '开发人员A'
          },
          {
            id: 'PROJ-1002',
            title: `与"${params.keywords}"相关的任务2`,
            status: '进行中',
            assignee: '开发人员B'
          }
        ]
      };
    }
    
    return {
      success: false,
      message: '缺少必要的JIRA查询参数'
    };
  }
});

// 组织架构查询工具
registerTool({
  id: 'orgChart',
  name: '组织架构查询',
  description: '查询人员的组织架构关系',
  execute: async (params) => {
    // 模拟实现，实际环境中需要集成组织架构API
    console.log(`查询组织架构信息: ${JSON.stringify(params)}`);
    
    if (params.person) {
      return {
        success: true,
        person: params.person,
        role: '高级工程师',
        department: '研发部',
        manager: '张经理',
        directReports: ['李工程师', '王工程师'],
        peers: ['高工程师', '刘工程师']
      };
    }
    
    if (params.department) {
      return {
        success: true,
        department: params.department,
        head: '李总监',
        members: ['张经理', '高工程师', '李工程师', '王工程师', '刘工程师']
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
      success: true,
      sprintId: 'S-2023-10',
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
    };
  }
});

/**
 * 智能Agent核心类
 */
class IntelligentAgent {
  private thoughtProcess: ThoughtStep[] = [];
  
  /**
   * 处理新消息
   */
  async processSingleMessage(message: any): Promise<MessageProcessResult> {
    console.log('智能Agent开始处理消息:', message);
    
    // 初始化思考过程记录
    this.thoughtProcess = [];
    
    // 初始化处理结果
    const result: MessageProcessResult = {
      isImportant: false,
      shouldStore: false,
      shouldNotify: false,
      confidence: 0,
      summary: '',
      enrichedData: {},
      reasonsToStore: [],
      thoughtProcess: this.thoughtProcess
    };
    
    try {
      // 标准化消息字段，确保兼容不同格式
      const normalizedMessage = this.normalizeMessageFormat(message);
      
      // 1. 先进行消息基本分析
      const initialAnalysis = await this.analyzeMessage(normalizedMessage);
      
      // 2. 进入思考-行动循环
      const currentState: {
        message: any;
        analysis: any;
        result: MessageProcessResult;
        memory: Record<string, any>;
        actionCount: number;
        currentDecision: {
          isImportant: boolean;
          shouldStore: boolean;
          shouldNotify: boolean;
          confidence: number;
          summary: string;
          reasons: string[];
          notificationPriority?: 'high' | 'medium' | 'low';
          replyAdvice?: string;
        };
      } = {
        message: normalizedMessage,
        analysis: initialAnalysis,
        result,
        memory: {} as Record<string, any>,
        actionCount: 0,
        currentDecision: {
          isImportant: false,
          shouldStore: false,
          shouldNotify: false,
          confidence: 0,
          summary: '',
          reasons: [],
          notificationPriority: 'low',
          replyAdvice: ''
        }
      };
      
      // 最多执行10轮思考-行动循环，避免无限循环
      const MAX_ACTIONS = 10;
      
      while (currentState.actionCount < MAX_ACTIONS) {
        // 思考下一步该做什么
        const thoughtResult = await this.think(currentState);
        
        // 记录思考过程
        const thoughtStep: ThoughtStep = {
          timestamp: Date.now(),
          thought: thoughtResult.thought,
          action: thoughtResult.nextAction
        };
        this.thoughtProcess.push(thoughtStep);
        
        // 如果决定结束处理，则跳出循环
        if (thoughtResult.nextAction === 'finish') {
          // 使用最后一次思考的结果作为最终决策
          result.isImportant = currentState.currentDecision.isImportant;
          result.shouldStore = currentState.currentDecision.shouldStore;
          result.shouldNotify = currentState.currentDecision.shouldNotify;
          result.confidence = currentState.currentDecision.confidence;
          result.summary = currentState.currentDecision.summary;
          result.reasonsToStore = currentState.currentDecision.reasons;
          result.notificationPriority = currentState.currentDecision.notificationPriority;
          result.replyAdvice = currentState.currentDecision.replyAdvice;
          break;
        }
        
        // 执行工具调用
        if (thoughtResult.tools && thoughtResult.tools.length > 0) {
          thoughtStep.toolUsed = thoughtResult.tools.join(', '); // 记录所有使用的工具
          
          // 并发执行所有选择的工具
          const toolPromises = thoughtResult.tools.map(async (toolId: string) => {
            const tool = toolRegistry[toolId];
            
            if (!tool) {
              console.warn(`未找到工具: ${toolId}`);
              return {
                toolId,
                error: `未找到工具: ${toolId}`
              };
            }
            
            console.log(`执行工具: ${tool.name} (${tool.id})`);
            
            try {
              const toolResult = await tool.execute(thoughtResult.params);
              
              // 特殊处理：如果是存储或通知工具，更新最终结果
              if (tool.id === 'messageStore') {
                result.shouldStore = true;
              } else if (tool.id === 'notifier') {
                result.shouldNotify = true;
              }
              
              return {
                toolId: tool.id,
                result: toolResult
              };
            } catch (error) {
              console.error(`工具执行失败: ${tool.id}`, error);
              return {
                toolId: tool.id,
                error: `工具执行失败: ${error.message}`
              };
            }
          });
          
          // 等待所有工具执行完毕
          const toolResults = await Promise.all(toolPromises);
          
          // 更新思考步骤结果和当前状态内存
          thoughtStep.result = toolResults.reduce((acc, curr) => {
            acc[curr.toolId] = curr.error ? { error: curr.error } : curr.result;
            return acc;
          }, {} as Record<string, any>);
          
          // 将所有工具结果存入内存
          toolResults.forEach(tr => {
            if (!tr.error) {
              currentState.memory[tr.toolId] = tr.result;
            }
          });
        }
        
        // 增加行动计数
        currentState.actionCount++;
      }
      
      // 处理存储和通知
      if (currentState.currentDecision.shouldStore && !result.shouldStore) {
        // 执行存储逻辑
      }
      
      if (currentState.currentDecision.shouldNotify && !result.shouldNotify) {
        // 执行通知逻辑
      }
      
      console.log('智能Agent处理完成:', result);
      return result;
      
    } catch (error) {
      console.error('智能Agent处理消息失败:', error);
      
      // 记录错误
      this.thoughtProcess.push({
        timestamp: Date.now(),
        thought: '处理过程中发生错误',
        action: '终止处理',
        result: { error: error.message }
      });
      
      // 返回错误结果
      return {
        isImportant: false,
        shouldStore: false,
        shouldNotify: false,
        confidence: 0,
        summary: `处理失败: ${error.message}`,
        thoughtProcess: this.thoughtProcess
      };
    }
  }
  
  /**
   * 标准化消息格式，确保关键字段的一致性
   */
  private normalizeMessageFormat(message: any): any {
    const normalized = { ...message };
    
    // 确保message_content字段存在
    if (!normalized.message_content && normalized.content) {
      normalized.message_content = normalized.content;
    }
    
    // 确保team_name和team_id字段存在
    if (!normalized.team_name && normalized.teamName) {
      normalized.team_name = normalized.teamName;
    }
    if (!normalized.team_id && normalized.teamId) {
      normalized.team_id = normalized.teamId;
    }
    
    // 确保datetime字段存在
    if (!normalized.datetime && normalized.timestamp) {
      normalized.datetime = new Date(normalized.timestamp).toISOString();
    }
    
    // 如果username字段存在但没有current_user字段，添加它
    if (normalized.username && !normalized.current_user) {
      normalized.current_user = normalized.username;
    }
    
    return normalized;
  }
  
  /**
   * 初步分析消息
   */
  private async analyzeMessage(message: any): Promise<any> {
    // 构建消息内容部分
    const messageContent = message.message_content || '无消息内容';
    
    // 构建上下文信息
    const contextInfo = [
      `发送者: ${message.sender || '未知发送者'}`,
      message.team_name ? `群组名称: ${message.team_name}` : '',
      message.datetime ? `发送时间: ${message.datetime}` : '',
      message.current_user ? `当前用户: ${message.current_user}` : ''
    ].filter(Boolean).join('\n');
    
    // 构建过滤规则信息
    let filterRulesInfo = '';
    if (message.concernedItems && Array.isArray(message.concernedItems)) {
      filterRulesInfo = `
关注规则:
${message.concernedItems.map((item: any, i: number) => `- 规则${i+1}: ${item.text || item}`).join('\n')}
      `;
    }
    
    // 构建分析提示
    const analysisPrompt = `
分析以下消息，提取关键信息并判断其重要性:

消息内容:
${messageContent}

上下文信息:
${contextInfo}
${filterRulesInfo}

请分析:
1. 这条消息是关于什么的？简要总结。
2. 消息中提到了哪些人物、项目、时间点或其他关键实体？
3. 消息的情感是正面、负面还是中性的？
4. 消息是否匹配任何上述关注规则？如果是，请指出匹配的规则和原因。
5. 消息的重要程度如何？(低/中/高)
6. 消息是否需要特别关注或回复？
7. 这条消息可能与哪些其他信息或系统(如JIRA, Wiki)相关？

以JSON格式返回:
{
  "summary": "消息简述",
  "topics": ["主题1", "主题2"],
  "matchedRules": ["匹配的规则1", "匹配的规则2"],
  "matchReasons": ["匹配原因1", "匹配原因2"],
  "importanceLevel": "low|medium|high",
  "needsAttention": true|false,
  "sentiment": "positive|negative|neutral",
  "mentionedSystems": ["系统1", "系统2"],
  "potentialNextSteps": ["可能的下一步操作1", "操作2"]
}
    `;
    
    try {
      const analysis = await callLLMJsonAPI({
        prompt: analysisPrompt,
        type: 'analysis'
      });
      
      return analysis;
    } catch (error) {
      console.error('分析消息失败:', error);
      // 返回基本分析结果以避免流程中断
      return {
        summary: `分析失败: ${error.message}`,
        topics: [],
        importanceLevel: "low",
        needsAttention: false,
        sentiment: "neutral",
        mentionedSystems: [],
        potentialNextSteps: []
      };
    }
  }
  
  /**
   * 思考下一步行动
   */
  private async think(state: any): Promise<ThoughtResult> {
    // 构建思考提示
    const toolDescriptions = Object.entries(toolRegistry).map(([id, tool]: [string, Tool]) => {
      let description = `- ${tool.name} (${id}): ${tool.description}`;
      
      // 添加参数描述
      if (tool.parameterDefs && tool.parameterDefs.length > 0) {
        description += '\n  参数:';
        for (const param of tool.parameterDefs) {
          const requiredMark = param.required ? '(必填)' : '(可选)';
          const typeMark = param.type ? `[${param.type}]` : '';
          const optionsMark = param.options ? ` 可选值:${param.options.join('/')}` : '';
          description += `\n    - ${param.name} ${requiredMark} ${typeMark}: ${param.description}${optionsMark}`;
        }
      }
      
      return description;
    }).join('\n');

    // 增强已收集信息的显示，明确标出已执行过的工具
    const memoryContent = Object.entries(state.memory).map(([key, value]: [string, any]) => 
      `- ${key} [已执行]: ${JSON.stringify(value).substring(0, 200)}${JSON.stringify(value).length > 200 ? '...' : ''}`
    ).join('\n');

    // 获取关注规则匹配信息
    let matchedRulesInfo = '';
    if (state.analysis && state.analysis.matchedRules && state.analysis.matchedRules.length > 0) {
      matchedRulesInfo = `
# 匹配的关注规则
${state.analysis.matchedRules.map((rule: string, i: number) => 
  `- 规则: ${rule}
   原因: ${state.analysis.matchReasons && state.analysis.matchReasons[i] ? state.analysis.matchReasons[i] : '未提供'}`
).join('\n')}
      `;
    } else if (state.message.matched_rule) {
      // 兼容旧的匹配规则字段
      matchedRulesInfo = `
# 匹配的关注规则
- 规则: ${state.message.matched_rule}
      `;
    }
    
    // 构建群组上下文信息（如果存在）
    let groupContextInfo = '';
    if (state.groupContext && state.groupContext.allMessages && state.groupContext.allMessages.length > 0) {
      const currentIndex = state.groupContext.currentMessageIndex;
      const otherMessages = state.groupContext.allMessages
        .filter((_: any, idx: number) => idx !== currentIndex)
        .map((msg: any, idx: number) => {
          const analysis = state.groupContext.allAnalyses.find((a: any) => a.messageIndex === idx);
          return `消息 #${idx + 1}:
发送者: ${msg.sender || '未知'}
内容: ${(msg.message_content || '').substring(0, 100)}${(msg.message_content || '').length > 100 ? '...' : ''}
重要性: ${analysis?.importanceLevel || '未知'}
摘要: ${analysis?.summary?.substring(0, 100) || '无摘要'}`;
      }).join('\n\n');
      
      groupContextInfo = `
# 群组中的其他消息作为上下文
群组名称: ${state.groupContext.groupName || '未知群组'}
${otherMessages}
      `;
    }
    
    // 定义可用工具列表
    const availableTools = [
      'entityExtractor',
      'historySearch',
      'messageStore',
      'notifier',
      'jiraQuerier',
      'orgStructure',
      'taskFetcher',
      'sprintDataFetcher'
    ];

    // 获取已执行的工具ID列表
    const executedTools = Object.keys(state.memory);

    // 构建思考提示
    const thinkPrompt = `
作为智能Agent系统，你需要分析消息并决定下一步行动。

# 当前消息
消息内容:
${state.message.message_content || '无消息内容'}

发送者: ${state.message.sender || '未知发送者'}
${state.message.team_name ? `群组: ${state.message.team_name}` : ''}
${state.message.current_user ? `当前用户: ${state.message.current_user}` : ''}

# 已有分析结果
${JSON.stringify(state.analysis, null, 2)}
${matchedRulesInfo}

# 已执行的工具和收集的信息
${memoryContent || '尚未收集任何信息'}

${groupContextInfo}

# 可用工具
${toolDescriptions}

# 处理进度
已执行 ${state.actionCount} 个行动
已使用工具: ${executedTools.length > 0 ? executedTools.join(', ') : '无'}

# 当前最新判断（思考过程中可以更新这些字段）
重要性: ${state.currentDecision?.isImportant !== undefined ? (state.currentDecision.isImportant ? '重要' : '不重要') : '未确定'}
是否存储: ${state.currentDecision?.shouldStore !== undefined ? (state.currentDecision.shouldStore ? '是' : '否') : '未确定'}
是否通知: ${state.currentDecision?.shouldNotify !== undefined ? (state.currentDecision.shouldNotify ? '是' : '否') : '未确定'}
消息摘要: ${state.currentDecision?.summary || '未提供'}

# 思考任务
1. 思考该消息的重要性和紧迫性，结合群组中其他消息的上下文。
${matchedRulesInfo ? '2. 该消息已匹配关注规则，应重点关注并考虑存储和通知。' : '2. 考虑消息是否符合关注条件。'}
3. 考虑是否需要提取更多信息或查询特定系统。
4. 决定下一步最合适的行动，可以选择一个或多个适合的工具或结束处理。
5. 不要重复执行已经执行过的工具（标记为[已执行]的工具）。
6. 基于当前信息，对消息做出综合判断，包括重要性、是否存储、是否通知等。

# 工具选择建议
- 如果消息提到项目进度或问题，考虑使用jiraQuerier
- 如果消息涉及组织关系或人员，考虑使用orgStructure
- 如果需要了解历史上下文，考虑使用historySearch

# 思考输出
请用JSON格式返回你的思考过程和决定的下一步行动:
{
  "thought": "分析当前情况和下一步行动的详细思考过程",
  "nextAction": "使用工具名或'finish'表示完成处理",
  "tools": ["选择的一个或多个工具ID，如entityExtractor"],
  "params": {
    // 工具所需的参数
  },
  // 决策相关字段（每次思考都需要提供，可随着思考进展更新）
  "isImportant": true或false,
  "shouldStore": true或false,
  "shouldNotify": true或false,
  "confidence": 0-1之间的数字,
  "summary": "消息总结",
  "reasons": ["存储/忽略的理由1", "理由2"],
  "notificationPriority": "high/medium/low",
  "replyAdvice": "可能的回复建议"
}
    `;
    
    // 处理结果时，保留决策相关字段
    try {
      const thinkResult = await callLLMJsonAPI({
        prompt: thinkPrompt,
        type: 'think'
      });
      
      // 确保工具ID是可用的且尚未执行过
      if (thinkResult.tools && Array.isArray(thinkResult.tools)) {
        thinkResult.tools = thinkResult.tools.filter((tool: string) => 
          (availableTools.includes(tool) || Object.keys(toolRegistry).includes(tool)) && 
          !executedTools.includes(tool)
        );
      }
      
      // 更新当前决策状态，存入state
      state.currentDecision = {
        isImportant: thinkResult.isImportant !== undefined ? thinkResult.isImportant : state.currentDecision?.isImportant,
        shouldStore: thinkResult.shouldStore !== undefined ? thinkResult.shouldStore : state.currentDecision?.shouldStore,
        shouldNotify: thinkResult.shouldNotify !== undefined ? thinkResult.shouldNotify : state.currentDecision?.shouldNotify,
        confidence: thinkResult.confidence !== undefined ? thinkResult.confidence : state.currentDecision?.confidence,
        summary: thinkResult.summary || state.currentDecision?.summary,
        reasons: thinkResult.reasons || state.currentDecision?.reasons,
        notificationPriority: thinkResult.notificationPriority || state.currentDecision?.notificationPriority,
        replyAdvice: thinkResult.replyAdvice || state.currentDecision?.replyAdvice
      };
      
      return thinkResult;
    } catch (error) {
      console.error('思考过程失败:', error);
      // 如果思考失败，返回直接结束处理的决定和当前决策
      return {
        thought: `思考过程中出错: ${error.message}，决定结束处理`,
        nextAction: 'finish',
        tools: [],
        params: {},
        ...state.currentDecision // 添加当前决策状态
      };
    }
  }
  
  /**
   * 批量分析多条消息，作为群组一次性分析
   * 这允许LLM在分析时考虑消息间的上下文关系
   */
  private async analyzeBatchMessages(messages: any[], groupContext: any): Promise<any[]> {
    if (messages.length === 0) {
      return [];
    }
    
    // 构建消息内容部分
    const messagesContent = messages.map((msg, index) => {
      return `消息 #${index + 1}:
发送者: ${msg.sender || '未知发送者'}
时间: ${msg.datetime || '未知时间'}
内容: ${msg.message_content || '无内容'}`;
    }).join('\n\n');
    
    // 构建群组上下文信息
    const groupInfo = [
      `群组名称: ${groupContext.groupName || '未知群组'}`,
      `群组ID: ${groupContext.groupId || '未知ID'}`,
      groupContext.username ? `当前用户: ${groupContext.username}` : ''
    ].filter(Boolean).join('\n');
    
    // 构建过滤规则信息
    let filterRulesInfo = '';
    if (messages[0]?.concernedItems && Array.isArray(messages[0].concernedItems)) {
      filterRulesInfo = `
关注规则:
${messages[0].concernedItems.map((item: any, i: number) => `- 规则${i+1}: ${item.text || item}`).join('\n')}
      `;
    }
    
    // 构建批量分析提示
    const batchAnalysisPrompt = `
分析以下群组中的一组消息，提取关键信息并判断各消息的重要性:

群组信息:
${groupInfo}

消息列表:
${messagesContent}

${filterRulesInfo}

请分析:
1. 这组消息的整体讨论主题是什么？
2. 每条消息的关键内容和重要程度如何？
3. 哪些消息可能需要特别关注或存储？哪些是不重要的闲聊或确认类消息？
4. 消息是否匹配任何上述关注规则？如果是，匹配哪些规则？
5. 消息间存在什么关联？后续消息是否是对前面消息的回应？
6. 每条消息中提到的人物、项目、时间等实体信息
7. 是否需要执行进一步处理，如果需要，推荐使用哪些工具及参数

请以JSON数组格式返回分析结果，每个元素对应一条消息:
[
  {
    "messageIndex": 0,
    "summary": "第一条消息的简述",
    "topics": ["主题1", "主题2"],
    "matchedRules": ["匹配的规则1", "匹配的规则2"],
    "matchReasons": ["匹配原因1", "匹配原因2"],
    "importanceLevel": "low|medium|high",
    "needsAttention": true|false,
    "needsProcessing": true|false,
    "isNoiseMessage": false,
    "sentiment": "positive|negative|neutral",
    "context": "消息在对话中的角色，如'提问','回答','确认'等",
    "mentionedSystems": ["系统1", "系统2"],
    
    // 新增字段，提供初始思考和决策结果
    "nextAction": "use_tool|finish",
    "tools": ["entityExtractor"], // 推荐的初始工具，可以为空数组
    "params": {}, // 工具参数
    "shouldStore": false,
    "shouldNotify": false,
    "confidence": 0.7,
    "reasons": [],
    "notificationPriority": "low",
    "replyAdvice": "",
    
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
]

特别说明:
1. 'needsProcessing'字段表示消息是否需要进一步处理(如存储、通知等)
2. 'isNoiseMessage'字段标识是否为噪音消息(如单纯的"好的"、"谢谢"等)
3. 'nextAction'应该是'use_tool'或'finish'，表示是否需要进一步处理
4. 如果不需要处理(nextAction为finish)，请提供完整的决策信息(shouldStore, shouldNotify等)
5. 对于entities字段，请尽可能完整提取实体信息
    `;
    
    try {
      const analysisResults = await callLLMJsonAPI({
        prompt: batchAnalysisPrompt,
        type: 'batchAnalysis'
      });
      
      // 确保结果是数组格式
      if (Array.isArray(analysisResults)) {
        return analysisResults.map((result, index) => {
          // 确保每个结果都有messageIndex字段，与消息数组索引对应
          if (result.messageIndex === undefined) {
            result.messageIndex = index;
          }
          return result;
        });
      } else {
        console.error('批量分析返回的不是数组格式:', analysisResults);
        // 创建默认分析结果
        return messages.map((_, index) => ({
          messageIndex: index,
          summary: "分析失败，无法获取有效结果",
          topics: [] as string[],
          matchedRules: [] as string[],
          matchReasons: [] as string[],
          importanceLevel: "low",
          needsAttention: false,
          needsProcessing: false,
          isNoiseMessage: false,
          sentiment: "neutral",
          context: "未知",
          mentionedSystems: [] as string[],
          potentialNextSteps: [] as string[]
        }));
      }
    } catch (error) {
      console.error('批量分析消息失败:', error);
      // 返回默认分析结果
      return messages.map((_, index) => ({
        messageIndex: index,
        summary: `分析失败: ${error.message}`,
        topics: [] as string[],
        importanceLevel: "low",
        needsAttention: false,
        needsProcessing: false,
        isNoiseMessage: true,
        sentiment: "neutral",
        context: "未知",
        mentionedSystems: [] as string[],
        potentialNextSteps: [] as string[]
      }));
    }
  }
  
  /**
   * 批量处理多条消息
   */
  async processBatchMessages(messages: any[], groupContext: any): Promise<MessageProcessResult[]> {
    console.log(`智能Agent开始批量处理 ${messages.length} 条消息`);
    
    if (messages.length === 0) {
      return [];
    }
    
    // 初始化思考过程记录
    this.thoughtProcess = [];
    
    try {
      // 1. 标准化所有消息格式
      const normalizedMessages = messages.map(msg => this.normalizeMessageFormat(msg));
      
      // 2. 批量分析所有消息，一次性分析所有消息以获取上下文
      console.log("开始批量分析消息...");
      const batchAnalysisResults = await this.analyzeBatchMessages(normalizedMessages, groupContext);
      
      // 记录批量处理开始
      const batchStartStep: ThoughtStep = {
        timestamp: Date.now(),
        thought: `开始批量处理 ${messages.length} 条消息，${batchAnalysisResults.filter((r: any) => r.needsProcessing !== false).length} 条需要进一步处理`,
        action: '初始化批量处理'
      };
      this.thoughtProcess.push(batchStartStep);
      
      // 4. 为每条消息执行工具和做出决策
      const results: MessageProcessResult[] = [];
      
      // 定义最大思考-行动循环次数
      const MAX_ACTIONS = 10;
      
      for (let i = 0; i < normalizedMessages.length; i++) {
        const message = normalizedMessages[i];
        const analysis = batchAnalysisResults.find(r => r.messageIndex === i) || {
          summary: "没有分析结果",
          importanceLevel: "low",
          needsProcessing: false,
          isNoiseMessage: false
        };
        
        // 如果是噪音消息且不需要处理，创建简化的结果
        if (analysis.isNoiseMessage === true && analysis.needsProcessing === false) {
          results.push({
            isImportant: false,
            shouldStore: false,
            shouldNotify: false,
            confidence: 1.0, // 高确信度，这是噪音消息
            summary: analysis.summary || "噪音消息",
            reasonsToStore: [],
            thoughtProcess: [{
              timestamp: Date.now(),
              thought: "经分析，这是噪音消息，无需进一步处理",
              action: "跳过处理"
            }]
          });
          continue;
        }
        
        // 为需要处理的消息创建消息处理结果
        const messageThoughtProcess: ThoughtStep[] = [];
        const result: MessageProcessResult = {
          isImportant: analysis.importanceLevel === "high",
          shouldStore: false,
          shouldNotify: false,
          confidence: 0,
          summary: analysis.summary || "",
          enrichedData: {},
          reasonsToStore: [],
          thoughtProcess: messageThoughtProcess
        };
        
        // 准备当前消息的状态
        const currentState: {
          message: any;
          analysis: any;
          result: MessageProcessResult;
          memory: Record<string, any>;
          actionCount: number;
          groupContext: any;
          currentDecision: {
            isImportant: boolean;
            shouldStore: boolean;
            shouldNotify: boolean;
            confidence: number;
            summary: string;
            reasons: string[];
            notificationPriority?: 'high' | 'medium' | 'low';
            replyAdvice?: string;
          };
        } = {
          message,
          analysis,
          result,
          memory: {} as Record<string, any>,
          actionCount: 0,
          // 添加群组上下文信息，使思考过程可以参考其他消息
          groupContext: {
            ...groupContext,
            allMessages: normalizedMessages,
            allAnalyses: batchAnalysisResults,
            currentMessageIndex: i
          },
          currentDecision: {
            isImportant: analysis.importanceLevel === "high",
            shouldStore: false,
            shouldNotify: false,
            confidence: 0,
            summary: analysis.summary || "",
            reasons: [],
            notificationPriority: 'low',
            replyAdvice: ''
          }
        };
        
        // 如果初始分析提供了实体信息，立即放入内存
        if (analysis.entities) {
          currentState.memory.entityExtractor = analysis.entities;
        }
        
        // 开始思考-行动循环，与单条消息处理保持一致
        while (currentState.actionCount < MAX_ACTIONS) {
          // 思考下一步该做什么(使用通用思考方法，支持群组上下文)
          const thoughtResult = await this.think(currentState);
          
          // 记录思考过程
          const thoughtStep: ThoughtStep = {
            timestamp: Date.now(),
            thought: thoughtResult.thought,
            action: thoughtResult.nextAction
          };
          messageThoughtProcess.push(thoughtStep);
          this.thoughtProcess.push(thoughtStep);
          
          // 如果决定结束处理，则跳出循环
          if (thoughtResult.nextAction === 'finish') {
            // 使用最后一次思考的结果作为最终决策
            result.isImportant = currentState.currentDecision.isImportant;
            result.shouldStore = currentState.currentDecision.shouldStore;
            result.shouldNotify = currentState.currentDecision.shouldNotify;
            result.confidence = currentState.currentDecision.confidence;
            result.summary = currentState.currentDecision.summary;
            result.reasonsToStore = currentState.currentDecision.reasons;
            result.notificationPriority = currentState.currentDecision.notificationPriority;
            result.replyAdvice = currentState.currentDecision.replyAdvice;
            break;
          }
          
          // 执行工具调用
          if (thoughtResult.tools && thoughtResult.tools.length > 0) {
            thoughtStep.toolUsed = thoughtResult.tools.join(', '); // 记录所有使用的工具
            
            // 并发执行所有选择的工具
            const toolPromises = thoughtResult.tools.map(async (toolId: string) => {
              const tool = toolRegistry[toolId];
              
              if (!tool) {
                console.warn(`未找到工具: ${toolId}`);
                return {
                  toolId,
                  error: `未找到工具: ${toolId}`
                };
              }
              
              console.log(`执行工具: ${tool.name} (${tool.id})`);
              
              try {
                const toolResult = await tool.execute(thoughtResult.params);
                
                // 特殊处理：如果是存储或通知工具，更新最终结果
                if (tool.id === 'messageStore') {
                  result.shouldStore = true;
                } else if (tool.id === 'notifier') {
                  result.shouldNotify = true;
                }
                
                return {
                  toolId: tool.id,
                  result: toolResult
                };
              } catch (error) {
                console.error(`工具执行失败: ${tool.id}`, error);
                return {
                  toolId: tool.id,
                  error: `工具执行失败: ${error.message}`
                };
              }
            });
            
            // 等待所有工具执行完毕
            const toolResults = await Promise.all(toolPromises);
            
            // 更新思考步骤结果和当前状态内存
            thoughtStep.result = toolResults.reduce((acc, curr) => {
              acc[curr.toolId] = curr.error ? { error: curr.error } : curr.result;
              return acc;
            }, {} as Record<string, any>);
            
            // 将所有工具结果存入内存
            toolResults.forEach(tr => {
              if (!tr.error) {
                currentState.memory[tr.toolId] = tr.result;
              }
            });
          }
          
          // 增加行动计数
          currentState.actionCount++;
        }
        
        // 处理存储和通知
        if (currentState.currentDecision.shouldStore && !result.shouldStore) {
          const messageId = uuidv4();
          await toolRegistry.messageStore.execute({
            messageId,
            content: message.message_content,
            sender: message.sender,
            timestamp: new Date(message.datetime).getTime() || Date.now(),
            matchedRules: message.matched_rule 
              ? [message.matched_rule].filter(Boolean) 
              : [],
            summary: currentState.currentDecision.summary,
            teamName: message.team_name,
            teamId: message.team_id,
            metadata: {
              ...currentState.memory.entityExtractor,
              importance: currentState.currentDecision.isImportant ? 'high' : 'medium',
              reasons: currentState.currentDecision.reasons,
              extractedData: currentState.memory
            }
          });
          result.shouldStore = true;
        }
        
        // 如果需要通知且尚未通知
        if (currentState.currentDecision.shouldNotify && !result.shouldNotify) {
          await toolRegistry.notifier.execute({
            messageId: uuidv4(),
            content: message.message_content,
            summary: currentState.currentDecision.summary,
            sender: message.sender,
            teamName: message.team_name,
            priority: currentState.currentDecision.notificationPriority,
            replyAdvice: currentState.currentDecision.replyAdvice
          });
          result.shouldNotify = true;
        }
        
        results.push(result);
      }
      
      // 记录批量处理完成
      const batchEndStep: ThoughtStep = {
        timestamp: Date.now(),
        thought: `完成批量处理 ${messages.length} 条消息，其中 ${results.filter((r: MessageProcessResult) => r.shouldStore).length} 条被存储，${results.filter((r: MessageProcessResult) => r.shouldNotify).length} 条需要通知`,
        action: '完成批量处理'
      };
      this.thoughtProcess.push(batchEndStep);
      
      console.log(`智能Agent批量处理完成，共处理 ${results.length} 条消息`);
      return results;
      
    } catch (error) {
      console.error('智能Agent批量处理消息失败:', error);
      
      // 记录错误
      this.thoughtProcess.push({
        timestamp: Date.now(),
        thought: '批量处理过程中发生错误',
        action: '终止处理',
        result: { error: error.message }
      });
      
      // 返回错误结果
      return messages.map(() => ({
        isImportant: false,
        shouldStore: false,
        shouldNotify: false,
        confidence: 0,
        summary: `批量处理失败: ${error.message}`,
        thoughtProcess: this.thoughtProcess
      }));
    }
  }
}

// 创建单例实例
const intelligentAgent = new IntelligentAgent();

/**
 * 检测输入的消息格式
 * @returns 格式类型: 'single_message', 'message_group', 'message_groups'
 */
function detectMessageFormat(input: any): string {
  if (input.messageGroups && Array.isArray(input.messageGroups)) {
    return 'message_groups'; // 多个消息组
  } else if (input.posts && Array.isArray(input.posts)) {
    return 'message_group';  // 单个消息组
  } else if (input.message_content || input.content) {
    return 'single_message'; // 单个消息
  } else {
    console.warn('未知的消息格式:', input);
    return 'unknown';
  }
}

/**
 * 从消息组中提取单个消息
 * 将消息组(或多个消息组)转换为单个消息数组，以便逐个处理
 */
function extractMessagesFromGroups(input: any): any[] {
  const format = detectMessageFormat(input);
  const messages: any[] = [];
  
  if (format === 'message_groups') {
    // 多个消息组
    for (const group of input.messageGroups) {
      const groupName = group.groupName;
      const groupId = group.groupId;
      
      for (const post of group.posts) {
        messages.push({
          message_content: post.content,
          sender: post.sender,
          datetime: post.datetime,
          team_name: groupName,
          team_id: groupId,
          post_id: post.post_id,
          raw_post: post,
          concernedItems: input.concernedItems,
          username: input.username
        });
      }
    }
  } else if (format === 'message_group') {
    // 单个消息组
    const groupName = input.groupName;
    const groupId = input.groupId;
    
    for (const post of input.posts) {
      messages.push({
        message_content: post.content,
        sender: post.sender,
        datetime: post.datetime,
        team_name: groupName,
        team_id: groupId,
        post_id: post.post_id,
        raw_post: post,
        concernedItems: input.concernedItems,
        username: input.username
      });
    }
  } else if (format === 'single_message') {
    // 已经是单个消息格式
    messages.push(input);
  }
  
  return messages;
}

/**
 * 处理新消息(支持多种消息格式，支持批量处理)
 */
export async function processMessage(input: any): Promise<MessageProcessResult | MessageProcessResult[]> {
  const envConfig = await getEnvConfig();
  if (!envConfig.ENABLE_INTELLIGENT_AGENT) {
    console.log('智能Agent系统未启用，跳过处理');
    return {
      isImportant: false,
      shouldStore: false,
      shouldNotify: false,
      confidence: 0,
      summary: '智能Agent未启用'
    };
  }
  
  // 检测输入格式
  const format = detectMessageFormat(input);
  console.log(`检测到消息格式: ${format}`);
  
  // 根据不同的消息格式和LLM_GROUP_ANALYSIS设置决定处理方式
  if (format === 'message_groups') {
    // 处理多个消息组
    const envConfig = await getEnvConfig();
    
    if (envConfig.LLM_GROUP_ANALYSIS) {
      // 为每个消息组单独批量处理
      const results: MessageProcessResult[] = [];
      
      for (const group of input.messageGroups) {
        const groupMessages = group.posts.map((post: any) => ({
          message_content: post.content,
          sender: post.sender,
          datetime: post.datetime,
          team_name: group.groupName,
          team_id: group.groupId,
          post_id: post.post_id,
          raw_post: post,
          concernedItems: input.concernedItems,
          username: input.username
        }));
        
        const groupContext = {
          groupName: group.groupName,
          groupId: group.groupId,
          username: input.username
        };
        
        try {
          const groupResults = await intelligentAgent.processBatchMessages(groupMessages, groupContext);
          results.push(...groupResults);
        } catch (error) {
          console.error(`处理消息组失败: ${group.groupName}`, error);
          // 为该组中的每条消息添加一个错误结果
          results.push(...groupMessages.map(() => ({
            isImportant: false,
            shouldStore: false,
            shouldNotify: false,
            confidence: 0,
            summary: `批量处理消息组失败: ${error.message}`
          })));
        }
      }
      
      return results;
    } else {
      // 将所有消息组中的消息一起批量处理
      const allMessages: any[] = [];
      
      for (const group of input.messageGroups) {
        const groupMessages = group.posts.map((post: any) => ({
          message_content: post.content,
          sender: post.sender,
          datetime: post.datetime,
          team_name: group.groupName,
          team_id: group.groupId,
          post_id: post.post_id,
          raw_post: post,
          concernedItems: input.concernedItems,
          username: input.username
        }));
        
        allMessages.push(...groupMessages);
      }
      
      const globalContext = {
        groupCount: input.messageGroups.length,
        username: input.username,
        concernedItems: input.concernedItems
      };
      
      try {
        return await intelligentAgent.processBatchMessages(allMessages, globalContext);
      } catch (error) {
        console.error('批量处理所有消息组失败:', error);
        return allMessages.map(() => ({
          isImportant: false,
          shouldStore: false,
          shouldNotify: false,
          confidence: 0,
          summary: `批量处理失败: ${error.message}`
        }));
      }
    }
  } else if (format === 'message_group') {
    // 处理单个消息组
    const messages = input.posts.map((post: any) => ({
      message_content: post.content,
      sender: post.sender,
      datetime: post.datetime,
      team_name: input.groupName,
      team_id: input.groupId,
      post_id: post.post_id,
      raw_post: post,
      concernedItems: input.concernedItems,
      username: input.username
    }));
    
    const groupContext = {
      groupName: input.groupName,
      groupId: input.groupId,
      username: input.username
    };
    
    try {
      const results = await intelligentAgent.processBatchMessages(messages, groupContext);
      return results.length === 1 ? results[0] : results;
    } catch (error) {
      console.error('批量处理消息组失败:', error);
      return messages.map(() => ({
        isImportant: false,
        shouldStore: false,
        shouldNotify: false,
        confidence: 0,
        summary: `批量处理失败: ${error.message}`
      }));
    }
  } else {
    // 单个消息，直接处理
    return await intelligentAgent.processSingleMessage(input);
  }
}

/**
 * 获取工具描述，用于配置界面
 */
export function getToolDescriptions(): any[] {
  return Object.values(toolRegistry).map(tool => ({
    id: tool.id,
    name: tool.name,
    description: tool.description,
    parameters: tool.parameterDefs ? tool.parameterDefs.map(param => ({
      name: param.name,
      description: param.description,
      required: param.required,
      type: param.type,
      defaultValue: param.defaultValue,
      options: param.options
    })) : []
  }));
}

/**
 * 导出接口
 */
export { intelligentAgent }; 