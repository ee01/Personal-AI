import { callLLMJsonAPI } from './llm';
import { naturalLanguageQuery } from './vectorStore';
import { getEnvConfig } from './utils';

/**
 * 工具接口定义
 */
interface Tool {
  id: string;
  name: string;
  description: string;
  execute: (params: any) => Promise<{
    message: string;
    result?: Record<string, any>;
  }>;
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
  messageIndex?: number;
  groupIndex?: number;
  groupId?: string;
  groupName?: string;
  originalMessage?: any;
  matchedRule?: string;
  llmCallCount?: number;       // 添加LLM调用次数
  llmCallTokens?: number;      // 添加估计的token使用量
  aggregateLlmCallCount?: number;  // 添加全局LLM调用次数
  aggregateLlmCallTokens?: number; // 添加全局估计的token使用量
  useTools?: string[];         // 添加使用过的工具列表
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
    
    const result = await naturalLanguageQuery(query, filters, {
      limit: params.limit || 5,
      sort: {
        field: 'timestamp',
        order: 'desc'
      }
    });

    console.log('历史消息搜索结果:', result);
    return {
      message: `相关历史消息：\n  - ${result.results.documents.map((doc: string, index: number ) => `[${result.results.metadatas[index].summary}](${result.results.metadatas[index].source})`).join('\n  - ')}`,
      result: result.results.documents.map((doc: string, index: number ) => ({
        summary: result.results.metadatas[index].summary,
        sender: result.results.metadatas[index].source,
      }))
    };
  }
});

// 添加JIRA查询缓存
const jiraCache: {
  [key: string]: {
    data: any;
    timestamp: number;
    expiresAt: number;
  }
} = {};

// 缓存有效期（毫秒）
const JIRA_CACHE_TTL = 30 * 60 * 1000; // 30分钟

registerTool({
  id: 'jiraQuery',
  name: 'JIRA信息查询',
  description: '直接调用JIRA REST API查询任务、需求和bug信息',
  parameterDefs: [
    {
      name: 'issueId',
      description: 'JIRA任务ID，例如 PROJ-1234',
      required: false,
      type: 'string'
    },
    {
      name: 'keywords',
      description: '搜索关键词，使用JQL中的text搜索',
      required: false,
      type: 'string'
    },
    {
      name: 'project',
      description: 'JIRA项目代号，例如 PROJ',
      required: false,
      type: 'string'
    },
    {
      name: 'status',
      description: '任务状态过滤，例如 "In Progress", "Done"',
      required: false,
      type: 'string'
    },
    {
      name: 'forceRefresh',
      description: '强制刷新缓存，不使用已缓存的数据',
      required: false,
      type: 'boolean',
      defaultValue: false
    }
  ],
  execute: async (params) => {
    console.log('执行JIRA REST API查询:', params);
    
    try {
      // 从环境配置或参数中获取JIRA连接信息
      const envConfig = await getEnvConfig();
      const jiraBaseUrl = envConfig.JIRA_BASE_URL || 'https://your-domain.atlassian.net';
      const apiToken = envConfig.JIRA_API_TOKEN;
      
      // 检查认证信息是否可用
      if (!apiToken) {
        return {
          success: false,
          source: 'jira-api',
          error: '缺少JIRA认证信息，请在参数中提供username和apiToken或在环境配置中设置'
        };
      }
      
      // 生成缓存键
      let cacheKey = '';
      if (params.issueId) {
        cacheKey = `issue-${params.issueId}`;
      } else {
        // 使用JQL参数生成缓存键
        const jqlParams = [
          params.project ? `project=${params.project}` : '',
          params.status ? `status=${params.status}` : '',
          params.keywords ? `keywords=${params.keywords}` : ''
        ].filter(Boolean).join('&');
        cacheKey = `search-${jqlParams}`;
      }
      
      // 检查缓存是否有效且未过期
      const now = Date.now();
      const cacheEntry = jiraCache[cacheKey];
      
      if (!params.forceRefresh && cacheEntry && cacheEntry.expiresAt > now) {
        console.log(`使用缓存的JIRA数据: ${cacheKey}`);
        return cacheEntry.data;
      }
      
      // 为Basic认证创建Authorization头
      const authHeader = `Bearer ${apiToken}`;
      
      let result;
      let resultMessage = '';
      // 处理不同的查询类型
      if (params.issueId) {
        // 查询单个JIRA问题
        const issueUrl = `${jiraBaseUrl}/rest/api/2/issue/${params.issueId}`;
        console.log(`查询JIRA问题: ${issueUrl}`);
        
        const response = await fetch(issueUrl, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Authorization': authHeader
          }
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`查询JIRA问题失败 (${response.status}): ${errorText}`);
        }
        
        const responseData = await response.json();
        result = {
          summary: responseData.fields.summary,
          status: responseData.fields.status.name,
          assignee: responseData.fields.assignee?.displayName,
          reporter: responseData.fields.reporter?.displayName,
          priority: responseData.fields.priority.name,
          issuetype: responseData.fields.issuetype.name,
          duedate: responseData.fields.duedate,
          comments: responseData.fields.comment.comments.splice(-3).map((comment: any) => comment.author.displayName + ': ' + comment.body),
          description: responseData.fields.description,
        };
        resultMessage = `[${params.issueId}][${result.status}]的查询数据: ${result.summary}\n - 执行者: ${result.assignee}\n - 预计完成时间: ${result.duedate}\n - 评论:\n  - ${result.comments.join('\n  - ').replace('\n', '')}`;
      } else {
        // 构建JQL查询
        let jql = '';
        
        if (params.project) {
          jql += `project = ${params.project}`;
        }
          
        if (params.status) {
          jql += jql ? ` AND status = "${params.status}"` : `status = "${params.status}"`;
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
        
        // 使用POST方法进行搜索以处理可能较长的JQL
        const searchUrl = `${jiraBaseUrl}/rest/api/2/search`;
        const response = await fetch(searchUrl, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': authHeader
          },
          body: JSON.stringify({
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
              'reporter'
            ]
          })
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`JIRA搜索查询失败 (${response.status}): ${errorText}`);
        }
        
        result = await response.json();
        resultMessage = `[${result.issues.map((issue: any) => issue.fields.summary).join(', ')}][${result.issues[0].fields.status.name}]的查询数据: ${result.issues[0].fields.summary}\n - 执行者: ${result.issues[0].fields.assignee?.displayName}\n - 预计完成时间: ${result.issues[0].fields.duedate}\n - 评论:\n  - ${result.issues[0].fields.comment.comments.map((comment: any) => comment.author.displayName + ': ' + comment.body).join('\n  - ').replace('\n', '')}`;
      }
      
      // 存储结果到缓存
      jiraCache[cacheKey] = {
        data: result,
        timestamp: now,
        expiresAt: now + JIRA_CACHE_TTL
      };
      
      return {
        message: resultMessage,
        result
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
        originalError: error
      };
    }
  }
});

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
    // 初始化 LLM 调用统计
    let llmCallCount = 0;
    let llmCallTokens = 0;
    const usedTools = new Set<string>();
    
    // 初始化处理结果
    const result: MessageProcessResult = {
      isImportant: false,
      shouldStore: false,
      shouldNotify: false,
      confidence: 0,
      summary: '',
      enrichedData: {},
      reasonsToStore: [],
      thoughtProcess: this.thoughtProcess,
      llmCallCount: 0,
      llmCallTokens: 0,
      useTools: [] as string[]
    };
    
    try {
      // 标准化消息字段，确保兼容不同格式
      const normalizedMessage = this.normalizeMessageFormat(message);
      
      // 1. 先进行消息基本分析
      const initialAnalysis = await this.analyzeMessage(normalizedMessage);
      llmCallCount += 1;
      llmCallTokens += this.estimateTokens(normalizedMessage, initialAnalysis);
      
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
      const MAX_ACTIONS = 5;
      
      while (currentState.actionCount < MAX_ACTIONS) {
        // 思考下一步该做什么
        let thoughtResult:ThoughtResult;
        if (currentState.actionCount > 0) {
          thoughtResult = await this.think(currentState);
        }else{
          thoughtResult = {
            thought: initialAnalysis.thought,
            nextAction: initialAnalysis.nextAction,
            tools: initialAnalysis.tools,
            params: initialAnalysis.params
          }
        }
        
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
              const toolParams = thoughtResult.params[tool.id] || thoughtResult.params;
              const toolResult = await tool.execute(toolParams);
              
              // 特殊处理：如果是存储或通知工具，更新最终结果
              if (tool.id === 'messageStore') {
                result.shouldStore = true;
              } else if (tool.id === 'notifier') {
                result.shouldNotify = true;
              }
              
              return {
                toolId: tool.id,
                params: toolParams,
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
              currentState.memory[tr.toolId] = {params: tr.params, result: tr.result};
            }
          });
        }
        
        // 增加行动计数
        currentState.actionCount++;
      }
      
      // 收集处理结果，包含所有工具调用结果和提取的实体
      result.enrichedData = {
        ...currentState.memory,
        thoughtProcess: this.thoughtProcess.slice(),
        entities: currentState.memory.entityExtractor?.entities || message.entities || {},
        relationships: currentState.memory.entityExtractor?.relationships || message.relationships || [] as Record<string, any>[],
        actions: currentState.memory.entityExtractor?.actions || message.actions || [] as Record<string, any>[],
        sentiment: initialAnalysis.sentiment || 'neutral',
        category: initialAnalysis.category || []
      };
      
      // 在返回结果前更新统计数据
      result.llmCallCount = llmCallCount;
      result.llmCallTokens = llmCallTokens;
      result.useTools = Array.from(usedTools);
      
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
        thoughtProcess: this.thoughtProcess,
        llmCallCount,
        llmCallTokens,
        useTools: Array.from(usedTools) as string[],
        reasonsToStore: [] as string[]
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
    
    // 获取可用工具列表及其描述
    const toolDescriptions = getAvailableTools().map(tool => {
      let description = `- ${tool.name} (${tool.id}): ${tool.description}`;
      
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
    
    // 构建分析提示
    const analysisPrompt = `
分析以下消息，提取关键信息并判断其重要性:

消息内容:
${messageContent}

上下文信息:
${contextInfo}
${filterRulesInfo}

# 可用工具
以下是可用于处理消息的工具，可以在分析时考虑是否需要使用这些工具：
${toolDescriptions}

请分析:
1. 这条消息是关于什么的？简要总结。
2. 消息中提到了哪些人物、项目、时间点或其他关键实体？
3. 消息的情感是正面、负面还是中性的？
4. 消息是否匹配任何上述关注规则？如果是，请指出匹配的规则和原因。
5. 消息的重要程度如何？(低/中/高)
6. 消息是否需要特别关注或回复？
7. 这条消息可能与哪些其他信息或系统(如JIRA, Wiki)相关？
8. 是否建议使用某些工具来进一步处理这条消息？如果是，请推荐工具和参数。

以JSON格式返回:
{
  "summary": "消息简述",
  "matchedRules": ["匹配的规则1", "匹配的规则2"],
  "matchReasons": ["匹配原因1", "匹配原因2"],
  "importanceLevel": "low|medium|high",
  "needsAttention": true|false,
  "sentiment": "positive|negative|neutral",
  "mentionedSystems": ["系统1", "系统2"],
  
  // 与批量分析保持一致的决策和工具字段
  "thought": "分析当前情况和下一步行动的详细思考过程",
  "nextAction": "use_tool|finish",
  "tools": ["选择的工具ID，如orgStructure"],
  "params": {}, // 工具参数
  "shouldStore": false,
  "shouldNotify": false,
  "confidence": 0.7,
  "reasons": ["存储/忽略的理由1", "理由2"],
  "notificationPriority": "low|medium|high",
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
}

特别说明:
1. 'nextAction'应该是'use_tool'或'finish'，表示是否需要进一步处理
2. 如果不需要处理(nextAction为finish)，请提供完整的决策信息(shouldStore, shouldNotify等)
3. 'tools'字段中只能包含上面列出的可用工具ID
4. 'params'字段应该根据选择的工具提供合适的参数，参考工具描述中的参数定义
5. 对于entities字段，请尽可能完整提取实体信息

工具选择建议:
- 如果消息提到项目进度或问题，考虑使用jiraQuery
- 如果消息涉及组织关系或人员，考虑使用orgStructure
- 如果需要了解历史上下文，考虑使用historySearch
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
        importanceLevel: "low",
        needsAttention: false,
        sentiment: "neutral",
        mentionedSystems: [],
        thought: "分析失败，无法提供有效思考",
        nextAction: "finish",
        tools: [],
        params: {},
        shouldStore: false,
        shouldNotify: false,
        confidence: 0,
        reasons: ["分析失败"],
        notificationPriority: "low",
        replyAdvice: "",
        entities: {
          people: [] as Record<string, any>[],
          time: [] as Record<string, any>[],
          projects: [] as Record<string, any>[],
          topics: [] as Record<string, any>[],
          location: [] as Record<string, any>[],
          resources: [] as Record<string, any>[]
        },
        relationships: [] as Record<string, any>[],
        actions: [] as Record<string, any>[]
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
      `- ${key} [已执行]: ${value.result.message.substring(0, 500)}${value.result.message.length > 300 ? '...' : ''}`
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
        .map((msg: any, idx: number) => ({
          ...msg,
          messageIndex: idx
        }))
        .filter((_: any, idx: number) => idx !== currentIndex)
        .filter((msg: any) => msg.team_id == state.message.team_id)
        .map((msg: any, i: number) => {
          const analysis = state.groupContext.allAnalyses.find((a: any) => a.messageIndex === msg.messageIndex);
          return `消息 #${i + 1}:
发送者: ${msg.sender || '未知'}
内容: ${(msg.message_content || '').substring(0, 100)}${(msg.message_content || '').length > 100 ? '...' : ''}
重要性: ${analysis?.importanceLevel || '未知'}
摘要: ${analysis?.summary?.substring(0, 100) || '无摘要'}`;
      }).join('\n\n');
      
      groupContextInfo = `
# 群组中的其他消息作为上下文
群组名称: ${state.groupContext.groupName || state.message.team_name || '未知群组'}
${otherMessages}
      `;
    }
    
    // 获取可用工具列表
    const availableTools = getAvailableTools().map(tool => tool.id);

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
  "tools": ["选择的一个或多个工具ID，如orgStructure"],
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
        tools: [] as string[],
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
    const envConfig = await getEnvConfig();
    
    // 构建消息内容部分
    const messagesContent = messages.map((msg, index) => {
      return `消息 #${index + 1}:
发送者: ${msg.sender || '未知发送者'}
时间: ${msg.datetime || '未知时间'}
内容: ${msg.message_content || '无内容'}
${envConfig.ANALYZE_BY_GROUP ? '' : `所在群组: ${msg.team_name || '未知群组'}`}`;
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
    
    // 获取可用工具列表及其描述
    const toolDescriptions = getAvailableTools().map(tool => {
      let description = `- ${tool.name} (${tool.id}): ${tool.description}`;
      
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
    
    // 构建批量分析提示
    const batchAnalysisPrompt = `
分析以下群组中的一组消息，提取关键信息并判断各消息的重要性:

群组信息:
${envConfig.ANALYZE_BY_GROUP ? groupInfo : '(多群组处理群组信息体现在消息列表中)'}

消息列表:
${messagesContent}

${filterRulesInfo}

# 可用工具
以下是可用于处理消息的工具，当你推荐工具时请从这些工具中选择：
${toolDescriptions}

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
    "thought": "分析当前情况和下一步行动的详细思考过程",
    "nextAction": "使用工具名或'finish'表示完成处理",
    "tools": ["选择的一个或多个工具ID，如orgStructure"],
    "params": {}, // 工具参数，根据选择的工具提供适当的参数
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
6. 'tools'字段中只能包含上面列出的可用工具ID
7. 'params'字段应该根据选择的工具提供合适的参数，参考工具描述中的参数定义

工具选择建议:
- 如果消息提到项目进度或问题，考虑使用jiraQuery
- 如果消息涉及组织关系或人员，考虑使用orgStructure
- 如果需要了解历史上下文，考虑使用historySearch
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
          
          // 确保实体信息字段存在
          if (!result.entities) {
            result.entities = {
              people: [] as Record<string, any>[],
              time: [] as Record<string, any>[],
              projects: [] as Record<string, any>[],
              topics: [] as Record<string, any>[],
              location: [] as Record<string, any>[],
              resources: [] as Record<string, any>[]
            };
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
          potentialNextSteps: [] as string[],
          thought: "分析失败，无法提供有效思考",
          nextAction: "finish",
          tools: [] as string[],
          params: {},
          shouldStore: false,
          shouldNotify: false,
          confidence: 0,
          reasons: ["分析失败"],
          notificationPriority: "low",
          replyAdvice: "",
          entities: {
            people: [] as Record<string, any>[],
            time: [] as Record<string, any>[],
            projects: [] as Record<string, any>[],
            topics: [] as Record<string, any>[],
            location: [] as Record<string, any>[],
            resources: [] as Record<string, any>[]
          },
          relationships: [] as Record<string, any>[],
          actions: [] as Record<string, any>[]
        }));
      }
    } catch (error) {
      console.error('批量分析消息失败:', error);
      // 返回默认分析结果
      return messages.map((_, index) => ({
        messageIndex: index,
        summary: `分析失败: ${error.message}`,
        topics: [] as string[],
        matchedRules: [] as string[],
        matchReasons: [] as string[],
        importanceLevel: "low",
        needsAttention: false,
        needsProcessing: false,
        isNoiseMessage: true,
        sentiment: "neutral",
        context: "未知",
        mentionedSystems: [] as string[],
        potentialNextSteps: [] as string[],
        thought: "分析失败，无法提供有效思考",
        nextAction: "finish",
        tools: [] as string[],
        params: {},
        shouldStore: false,
        shouldNotify: false,
        confidence: 0,
        reasons: ["分析失败"],
        notificationPriority: "low",
        replyAdvice: "",
        entities: {
          people: [] as Record<string, any>[],
          time: [] as Record<string, any>[],
          projects: [] as Record<string, any>[],
          topics: [] as Record<string, any>[],
          location: [] as Record<string, any>[],
          resources: [] as Record<string, any>[]
        },
        relationships: [] as Record<string, any>[],
        actions: [] as Record<string, any>[]
      }));
    }
  }
  
  /**
   * 批量处理多条消息
   */
  async processBatchMessages(messages: any[], groupContext: any, onGroupCompleted?: (results: MessageProcessResult[]) => void): Promise<MessageProcessResult[]> {
    console.log(`智能Agent开始批量处理 ${messages.length} 条消息`);
    
    if (messages.length === 0) {
      return [];
    }
    
    // 初始化思考过程记录
    this.thoughtProcess = [];
    // 初始化 LLM 调用统计
    const usedTools = new Set<string>();
    let groupIndex = 0;
    
    try {
      // 1. 标准化所有消息格式
      const normalizedMessages = messages.map(msg => this.normalizeMessageFormat(msg));
      
      // 2. 批量分析所有消息，一次性分析所有消息以获取上下文
      console.log("开始批量分析消息...", normalizedMessages, groupContext);
      const batchAnalysisResults = await this.analyzeBatchMessages(normalizedMessages, groupContext);
      // 记录第一次 LLM 调用
      const analysisLlmCallTokens = this.estimateTokens(normalizedMessages, batchAnalysisResults);
      groupContext.aggregateLlmCallCount += 1;
      groupContext.aggregateLlmCallTokens += analysisLlmCallTokens;
      
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
      const MAX_ACTIONS = 5;
      
      for (let i = 0; i < normalizedMessages.length; i++) {
        const message = normalizedMessages[i];
        const analysis = batchAnalysisResults.find(r => r.messageIndex === i) || {
          summary: "没有分析结果",
          importanceLevel: "low",
          needsProcessing: false,
          isNoiseMessage: false
        };
        let thoughtLlmCallCount = 0;
        let thoughtLlmCallTokens = 0;
        
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
            }],
            messageIndex: i,
            groupIndex: groupContext.groupIndex || groupIndex,
            groupId: message.team_id || '',
            groupName: message.team_name || '',
            originalMessage: message,
            matchedRule: '', // 噪音消息一般不匹配任何规则
            llmCallCount: 1,
            llmCallTokens: analysisLlmCallTokens,
            aggregateLlmCallCount: groupContext.aggregateLlmCallCount,
            aggregateLlmCallTokens: groupContext.aggregateLlmCallTokens,
            useTools: [] as string[]
          });
          if (i === normalizedMessages.length - 1 || normalizedMessages[i].team_id !== normalizedMessages[i+1]?.team_id) {
            groupIndex++;
            // 找出当前组的所有消息结果
            const currentGroupResults = results.filter(r => r.groupId === message.team_id);
            // 调用回调函数
            if (onGroupCompleted && currentGroupResults.length > 0) {
              onGroupCompleted(currentGroupResults);
            }
          }
          continue;
        }
        
        // 为需要处理的消息创建消息处理结果
        const messageThoughtProcess: ThoughtStep[] = [];
        const messageUsedTools: string[] = [];
        const result: MessageProcessResult = {
          isImportant: analysis.importanceLevel === "high",
          shouldStore: false,
          shouldNotify: false,
          confidence: 0,
          summary: analysis.summary || "",
          enrichedData: {
            entities: analysis.entities || {},
            relationships: analysis.relationships || [],
            actions: analysis.actions || [],
            sentiment: analysis.sentiment || 'neutral',
            category: analysis.category || []
          },
          reasonsToStore: [],
          thoughtProcess: messageThoughtProcess,
          messageIndex: i,
          groupIndex: groupContext.groupIndex || groupIndex,
          groupId: message.team_id || '',
          groupName: message.team_name || '',
          originalMessage: message,
          matchedRule: analysis.matchedRules && analysis.matchedRules.length > 0 
            ? analysis.matchedRules.join('; ') 
            : '',
          llmCallCount: thoughtLlmCallCount,
          llmCallTokens: thoughtLlmCallTokens,
          aggregateLlmCallCount: groupContext.aggregateLlmCallCount,
          aggregateLlmCallTokens: groupContext.aggregateLlmCallTokens,
          useTools: messageUsedTools as string[]
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
          let thoughtResult:ThoughtResult;
          if (currentState.actionCount > 0) {
            thoughtResult = await this.think(currentState);
            // 记录思考的 LLM 调用
            thoughtLlmCallCount += 1;
            thoughtLlmCallTokens += this.estimateTokens(currentState, thoughtResult);
          } else {
            thoughtResult = {
              thought: analysis.thought,
              nextAction: analysis.nextAction,
              tools: analysis.tools,
              params: analysis.params
            }
          }
          
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
            if (currentState.analysis.matchedRules && currentState.analysis.matchedRules.length > 0) {
              result.matchedRule = currentState.analysis.matchedRules.join('; ');
            }
            break;
          }
          
          // 执行工具调用
          if (thoughtResult.tools && thoughtResult.tools.length > 0) {
            thoughtStep.toolUsed = thoughtResult.tools.join(', '); // 记录所有使用的工具
            
            // 记录使用的工具
            thoughtResult.tools.forEach(toolId => {
              messageUsedTools.push(toolId);
              usedTools.add(toolId);
            });
            
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
              
              console.log(`执行工具: ${tool.name} (${tool.id})`, thoughtResult.params);
              
              try {
                const toolParams = thoughtResult.params[tool.id] || thoughtResult.params;
                const toolResult = await tool.execute(toolParams);
                
                // 特殊处理：如果是存储或通知工具，更新最终结果
                if (tool.id === 'messageStore') {
                  result.shouldStore = true;
                } else if (tool.id === 'notifier') {
                  result.shouldNotify = true;
                }
                
                return {
                  toolId: tool.id,
                  params: toolParams,
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
                currentState.memory[tr.toolId] = {params: tr.params, result: tr.result};
              }
            });
          }
          
          // 增加行动计数
          currentState.actionCount++;
        }
        
        // 收集完整的结果
        result.enrichedData = {
          ...result.enrichedData,
          ...currentState.memory,
          thoughtProcess: messageThoughtProcess.slice(),
          entities: currentState.memory.entityExtractor?.entities || 
                    result.enrichedData.entities || 
                    message.entities || {},
          relationships: currentState.memory.entityExtractor?.relationships || 
                        result.enrichedData.relationships || 
                        message.relationships || [],
          actions: currentState.memory.entityExtractor?.actions || 
                  result.enrichedData.actions || 
                  message.actions || [],
          message_content: message.message_content,
          sender: message.sender,
          team_id: message.team_id,
          team_name: message.team_name
        };
        
        // 更新 LLM 调用统计
        result.llmCallCount = 1 + thoughtLlmCallCount;
        result.llmCallTokens = analysisLlmCallTokens + thoughtLlmCallTokens;
        result.useTools = Array.from(new Set(messageUsedTools)); // 去重
        groupContext.aggregateLlmCallCount += thoughtLlmCallCount;
        groupContext.aggregateLlmCallTokens += thoughtLlmCallTokens;
        result.aggregateLlmCallCount = groupContext.aggregateLlmCallCount;
        result.aggregateLlmCallTokens = groupContext.aggregateLlmCallTokens;
        
        results.push(result);
        
        // 每条消息处理完成后，检查是否所有同一组的消息都已处理完毕
        if (i === normalizedMessages.length - 1 || normalizedMessages[i].team_id !== normalizedMessages[i+1]?.team_id) {
          groupIndex++;
          // 找出当前组的所有消息结果
          const currentGroupResults = results.filter(r => r.groupId === message.team_id);
          // 调用回调函数
          if (onGroupCompleted && currentGroupResults.length > 0) {
            onGroupCompleted(currentGroupResults);
          }
        }
      }
      
      // 记录批量处理完成
      const batchEndStep: ThoughtStep = {
        timestamp: Date.now(),
        thought: `完成批量处理 ${messages.length} 条消息，其中 ${results.filter((r: MessageProcessResult) => r.shouldStore).length} 条被存储，${results.filter((r: MessageProcessResult) => r.shouldNotify).length} 条需要通知。共调用 LLM ${groupContext.aggregateLlmCallCount} 次，估计使用 ${groupContext.aggregateLlmCallTokens} tokens，使用工具：${Array.from(usedTools).join(', ')}`,
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
      const errorResults = messages.map(() => ({
        isImportant: false,
        shouldStore: false,
        shouldNotify: false,
        confidence: 0,
        summary: `批量处理失败: ${error.message}`,
        thoughtProcess: this.thoughtProcess,
        llmCallCount: groupContext.aggregateLlmCallCount,
        llmCallTokens: groupContext.aggregateLlmCallTokens,
        useTools: Array.from(usedTools) as string[],
        reasonsToStore: [] as string[]
      }));
      
      // 调用回调函数，通知处理失败
      if (onGroupCompleted) {
        onGroupCompleted(errorResults);
      }
      
      return errorResults;
    }
  }

  /**
   * 粗略估算处理消息所用的tokens数量
   */
  private estimateTokens(input: any, output: any): number {
    // 一个简单的估算方法是计算字符数，然后按照一定比例转换为tokens
    // 英文中大约每4个字符为1个token，为了简化我们使用字符数/3作为token估算
    const inputStr = JSON.stringify(input);
    const outputStr = JSON.stringify(output);
    
    const totalChars = inputStr.length + outputStr.length;
    const estimatedTokens = Math.ceil(totalChars / 3);
    
    return estimatedTokens;
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
 * 处理新消息(支持多种消息格式，支持批量处理)
 */
export async function processMessage(input: any, onEveryGroupCompleted?: (results: MessageProcessResult[]) => void): Promise<MessageProcessResult | MessageProcessResult[]> {
  // 检测输入格式
  const format = detectMessageFormat(input);
  console.log(`检测到消息格式: ${format}`);
  
  // 根据不同的消息格式和 ANALYZE_BY_GROUP 设置决定处理方式
  if (format === 'message_groups') {
    // 处理多个消息组
    const envConfig = await getEnvConfig();
    
    if (envConfig.ANALYZE_BY_GROUP) {
      // 为每个消息组单独批量处理
      const results: MessageProcessResult[] = [];
      
      // 添加 groupIndex 计数器
      const groupContext = {
        groupName: '',
        groupId: '',
        groupIndex: 0,
        username: input.username,
        aggregateLlmCallCount: 0,
        aggregateLlmCallTokens: 0,
      };
      
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

        groupContext.groupId = group.groupId;
        groupContext.groupName = group.groupName;
        
        try {
          const groupResults = await intelligentAgent.processBatchMessages(groupMessages, groupContext, onEveryGroupCompleted);
          results.push(...groupResults);
          groupContext.aggregateLlmCallCount = groupResults[groupResults.length - 1].aggregateLlmCallCount;
          groupContext.aggregateLlmCallTokens = groupResults[groupResults.length - 1].aggregateLlmCallTokens;
        } catch (error) {
          console.error(`处理消息组失败: ${group.groupName}`, error);
          // 为该组中的每条消息添加一个错误结果
          const errorResults = groupMessages.map(() => ({
            isImportant: false,
            shouldStore: false,
            shouldNotify: false,
            confidence: 0,
            summary: `批量处理消息组失败: ${error.message}`,
            llmCallCount: 0,
            llmCallTokens: 0,
            useTools: [] as string[],
            reasonsToStore: [] as string[],
            thoughtProcess: [{
              timestamp: Date.now(),
              thought: "批量处理消息组失败",
              action: "跳过处理"
            }],
            messageIndex: 0,
            groupIndex: groupContext.groupIndex,
            groupId: '',
            groupName: '',
            originalMessage: {},
            matchedRule: ''
          }));
          results.push(...errorResults);
          if (onEveryGroupCompleted) {
            onEveryGroupCompleted(errorResults);
          }
        }
        
        // 每处理完一个组，增加 groupIndex
        groupContext.groupIndex++;
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
        concernedItems: input.concernedItems,
        aggregateLlmCallCount: 0,
        aggregateLlmCallTokens: 0,
      };
      
      try {
        return await intelligentAgent.processBatchMessages(allMessages, globalContext, onEveryGroupCompleted);
      } catch (error) {
        console.error('批量处理所有消息组失败:', error);
        const errorResults = allMessages.map(() => ({
          isImportant: false,
          shouldStore: false,
          shouldNotify: false,
          confidence: 0,
          summary: `批量处理失败: ${error.message}`,
          llmCallCount: 0,
          llmCallTokens: 0,
          useTools: [] as string[],
          reasonsToStore: [] as string[],
          thoughtProcess: [{
            timestamp: Date.now(),
            thought: "批量处理失败",
            action: "终止处理"
          }],
          messageIndex: 0,
          groupIndex: 0,
          groupId: '',
          groupName: '',
          originalMessage: {},
          matchedRule: ''
        }));
        if (onEveryGroupCompleted) {
          onEveryGroupCompleted(errorResults);
        }
        return errorResults;
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
      groupIndex: 0,
      username: input.username,
      aggregateLlmCallCount: 0,
      aggregateLlmCallTokens: 0,
    };
    
    try {
      const results = await intelligentAgent.processBatchMessages(messages, groupContext, onEveryGroupCompleted);
      return results.length === 1 ? results[0] : results;
    } catch (error) {
      console.error('批量处理消息组失败:', error);
      const errorResults = messages.map(() => ({
        isImportant: false,
        shouldStore: false,
        shouldNotify: false,
        confidence: 0,
        summary: `批量处理失败: ${error.message}`,
        llmCallCount: 0,
        llmCallTokens: 0,
        useTools: [] as string[],
        reasonsToStore: [] as string[],
        thoughtProcess: [{
          timestamp: Date.now(),
          thought: "批量处理失败",
          action: "终止处理"
        }],
        messageIndex: 0,
        groupIndex: 0,
        groupId: '',
        groupName: '',
        originalMessage: {},
        matchedRule: ''
      }));
      if (onEveryGroupCompleted) {
        onEveryGroupCompleted(errorResults);
      }
      return errorResults;
    }
  } else {
    // 单个消息，直接处理
    const result = await intelligentAgent.processSingleMessage(input);
    if (onEveryGroupCompleted) {
      onEveryGroupCompleted([result]);
    }
    return result;
  }
}

/**
 * 获取工具描述，用于配置界面
 */
export function getToolDescriptions(): any[] {
  return Object.values(toolRegistry).map(tool => {
    let description = `- ${tool.name} (${tool.id}): ${tool.description}`;
    
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
  });
}

/**
 * 导出接口
 */
export { intelligentAgent }; 