/**
 * 智能Agent系统 - 新版实现
 * 基于新的接口设计，提供通用分析框架
 */

import { callLLMJsonAPI } from './llm';
import { naturalLanguageQuery } from './vectorStore';
import { getEnvConfig } from './utils';
import { 
  AnalysisConfig, 
  AnalysisContext,
  AnalysisResult,
  MessageAnalysisResult,
  ProjectAnalysisResult,
  MeetingAnalysisResult,
  GenericAnalysisResult
} from './interfaces/analysisInterfaces';
import { v4 as uuidv4 } from 'uuid';

/**
 * 工具接口定义
 */
interface Tool {
  id: string;
  name: string;
  description: string;
  execute: (params: any, state?: any) => Promise<{
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
 * 工具注册表
 */
const toolRegistry: Record<string, Tool> = {};

/**
 * 注册工具
 */
function registerTool(tool: Tool): void {
  toolRegistry[tool.id] = tool;
  console.log(`工具已注册: ${tool.name} (${tool.id})`);
}

// 导入旧版IntelligentAgent相关接口以支持兼容层
// 从旧版intelligentAgent.ts文件导出的接口
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
  originalMessage?: any;
  matchedRule?: string;
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
  // 新增项目分析相关字段
  riskLevel?: 'low' | 'normal' | 'high' | 'critical';
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
}

/**
 * 思考步骤
 */
interface ThoughtStep {
  timestamp: number;
  thought: string;
  action: string;
  toolUsed?: string;
  toolResult?: string;
}

/**
 * 核心智能Agent类，提供通用分析框架
 */
export class IntelligentAgent {
  private thoughtProcess: ThoughtStep[] = [];
  private aggregateLlmCallCount = 0;
  private aggregateLlmCallTokens = 0;
  
  constructor() {
    // 确保工具已注册
    this.initializeDefaultTools();
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
      description: '直接调用JIRA REST API查询任务、需求和bug信息。如果有issueId可直接查询结果，否则用其他参数进行JQL查询',
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
          description: 'JIRA项目代号，一般是大写字母，例如 PROJ',
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
            resultMessage = result.issues.map((issue: any) => `[${issue.key}][${issue.fields.status.name}]${issue.fields.summary}`).join('\n');
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
  }
  
  /**
   * 分析任何类型的输入并返回适当的分析结果
   */
  async analyze(
    input: any,
    config: AnalysisConfig,
    context?: AnalysisContext,
    onStepCompleted?: (results: AnalysisResult[]) => void
  ): Promise<AnalysisResult | AnalysisResult[]> {
    // 根据配置选择合适的分析流程
    switch(config.type) {
      case 'message':
        return this.analyzeMessage(input, config, context, onStepCompleted);
      case 'project':
        return this.analyzeProject(input, config, context);
      case 'meeting':
        return this.analyzeMeeting(input, config, context);
      case 'document':
        return this.analyzeDocument(input, config, context);
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
    onProgress?: (result: AnalysisResult | MessageAnalysisResult[]) => void
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
    onEveryGroupCompleted?: (results: MessageAnalysisResult[]) => void
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
          const group = input[i];
          const groupContext = {
            ...context,
            groupInfo: {
              id: group.groupId,
              index: i,
              name: group.groupName,
              members: (group.members || []) as string[]
            }
          };
          
          // 提取组中的消息并标准化
          const groupMessages = group.posts.map((post: any) => ({
            messageContent: post.content,
            sender: post.sender,
            datetime: post.datetime,
            groupName: group.groupName,
            groupId: group.groupId,
            postId: post.post_id
          }));
          
          // 分析该组的消息
          const groupResults = await this.analyzeGroupMessages(
            groupMessages,
            config,
            groupContext,
            onEveryGroupCompleted
          );
          
          results.push(...groupResults);
        }
      } else {
        // 将所有消息组合并处理
        const allMessages: any[] = [];
        
        for (const group of input) {
          const groupMessages = group.posts.map((post: any) => ({
            messageContent: post.content,
            sender: post.sender,
            datetime: post.datetime,
            groupName: group.groupName,
            groupId: group.groupId,
            postId: post.post_id
          }));
          
          allMessages.push(...groupMessages);
        }
        
        const globalContext = {
          ...context,
          groupInfo: {
            id: '',
            name: '多群组分析',
            members: [] as string[]
          }
        };
        
        const groupResults = await this.analyzeGroupMessages(
          allMessages,
          config,
          globalContext,
          onEveryGroupCompleted
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
          members: (input.members || []) as string[]
        }
      };
      
      // 提取消息并标准化
      const messages = input.posts.map((post: any) => ({
        messageContent: post.content,
        sender: post.sender,
        datetime: post.datetime,
        groupName: input.groupName,
        groupId: input.groupId,
        postId: post.post_id
      }));
      
      // 分析消息
      return await this.analyzeGroupMessages(
        messages,
        config,
        groupContext,
        onEveryGroupCompleted
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
        onEveryGroupCompleted
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
    onGroupCompleted?: (results: MessageAnalysisResult[]) => void
  ): Promise<MessageAnalysisResult[]> {
    try {
      if (messages.length === 0) {
        return [];
      }
      
      // 初始化统计
      let llmCallCount = 0;
      let llmCallTokens = 0;
      let groupIndex = 0;
      const usedTools = new Set<string>();
      
      // 调用LLM分析
      const analysisResult = await this.initialAnalysis(messages, config, context);
      
      // 记录初始LLM调用
      llmCallCount += 1;
      llmCallTokens += this.estimateTokens(messages, analysisResult);
      
      // 准备最终结果数组
      const finalResults: MessageAnalysisResult[] = [];
      
      // 为每条消息进行深度分析（思考-行动循环）
      for (let i = 0; i < messages.length; i++) {
        const message = messages[i];
        const analysis = analysisResult.find((r:any) => r.messageIndex === i) || {
          summary: "没有分析结果",
          importanceLevel: "low",
          needsProcessing: false,
          isNoiseMessage: false
        };
        
        // 如果是噪音消息且不需要处理，创建简化的结果
        if (analysis.isNoiseMessage === true && analysis.needsProcessing === false) {
          finalResults.push({
            type: 'message',
            messageIndex: i,
            groupIndex: context.groupInfo?.index || groupIndex,
            messageContext: message,
            isImportant: false,
            shouldNotify: false,
            shouldStore: false,
            reasonsToStore: [],
            confidence: 1.0, // 高确信度，这是噪音消息
            summary: analysis.summary || "噪音消息",
            thoughtProcess: [{
              timestamp: Date.now(),
              thought: "经分析，这是噪音消息，无需进一步处理",
              action: "跳过处理"
            }]
          });
          if (i === messages.length - 1 || messages[i].team_id !== messages[i+1]?.team_id) {
            groupIndex++;
            // 找出当前组的所有消息结果
            const currentGroupResults = finalResults.filter(r => r.groupId === message.team_id);
            // 调用回调函数
            if (onGroupCompleted && currentGroupResults.length > 0) {
              onGroupCompleted(currentGroupResults);
            }
          }
          continue;
        }
        
        const messageThoughtProcess: ThoughtStep[] = [];
        const messageUsedTools: string[] = [];
        
        const result: MessageAnalysisResult = {
          type: 'message',
          messageIndex: i,
          groupIndex: context.groupInfo?.index || groupIndex,
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
          messageContext: message,
          matchedRule: analysis.matchedRules && analysis.matchedRules.length > 0 
            ? analysis.matchedRules.join('; ') 
            : '',
          metaData: {
            llmCallCount: 0,
            llmCallTokens: 0,
            usedTools: messageUsedTools,
            timestamp: Date.now()
          }
        };

        // 执行思考-行动循环
        this.loopThinking(result, message, analysis, config, context, usedTools);
        
        // 添加到最终结果列表
        finalResults.push(result);
        
        // 每条消息处理完成后，检查是否所有同一组的消息都已处理完毕
        if (i === messages.length - 1 || messages[i].team_id !== messages[i+1]?.team_id) {
          groupIndex++;
          // 找出当前组的所有消息结果
          const currentGroupResults = finalResults.filter(r => r.groupId === message.team_id);
          // 调用回调函数
          if (onGroupCompleted && currentGroupResults.length > 0) {
            onGroupCompleted(currentGroupResults);
          }
        }
      
        // 记录批量处理完成
        const batchEndStep: ThoughtStep = {
          timestamp: Date.now(),
          thought: `完成批量处理 ${messages.length} 条消息，其中 ${finalResults.filter((r: MessageAnalysisResult) => r.shouldStore).length} 条被存储，${finalResults.filter((r: MessageAnalysisResult) => r.shouldNotify).length} 条需要通知。共调用 LLM ${this.aggregateLlmCallCount} 次，估计使用 ${this.aggregateLlmCallTokens} tokens，使用工具：${Array.from(usedTools).join(', ')}`,
          action: '完成批量处理'
        };
        this.thoughtProcess.push(batchEndStep);
        result.thoughtProcess.push(batchEndStep);
        
        console.log(`智能Agent批量处理完成，共处理 ${finalResults.length} 条消息，其中 ${finalResults.filter((r: MessageAnalysisResult) => r.shouldStore).length} 条被存储，${finalResults.filter((r: MessageAnalysisResult) => r.shouldNotify).length} 条需要通知。共调用 LLM ${this.aggregateLlmCallCount} 次，估计使用 ${this.aggregateLlmCallTokens} tokens，使用工具：${Array.from(usedTools).join(', ')}`);
        return finalResults;
      }
    } catch (error) {
      console.error('智能Agent批量处理消息失败:', error);
      
      // 记录错误
      this.thoughtProcess.push({
        timestamp: Date.now(),
        thought: error.message,
        action: '终止处理',
      });
      
      // 返回错误结果
      const errorResults = messages.map((message, index) => ({
        type: 'message' as const,
        messageIndex: index,
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
          timestamp: Date.now()
        }
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
  
  /**
   * 获取工具描述文本
   */
  private getToolDescriptionsText(): string {
    return this.getAvailableTools().map(tool => {
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
  }
  
  /**
   * 估算token数量
   */
  private estimateTokens(input: any, output: any): number {
    // 一个简单的估算方法是计算字符数，然后按照一定比例转换为tokens
    // 英文中大约每4个字符为1个token，为了简化我们使用字符数/4作为token估算
    const inputStr = typeof input === 'string' ? input : JSON.stringify(input);
    const outputStr = typeof output === 'string' ? output : JSON.stringify(output);
    
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
    usedTools: Set<string> = new Set()
  ): Promise<void> {
    // 初始化统计
    let llmCallCount = result.metaData.llmCallCount || 0;
    let llmCallTokens = result.metaData.llmCallTokens || 0;
      
    // 思考-行动循环
    const maxActions = config.maxActions || 5;
    const currentState = {
      message: normalizedInput,
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
        reasons: result.reasonsToStore || [],
        isImportant: !!result.isImportant,
        shouldStore: !!result.shouldStore,
        shouldNotify: !!result.shouldNotify,
        notificationPriority: result.notificationPriority,
        replyAdvice: result.replyAdvice,
        // project
        riskLevel: result.riskLevel,
        suggestions: result.suggestions || {}
      }
    };
    
    while (currentState.actionCount < maxActions) {
      // 思考下一步
      let thoughtResult: ThoughtResult;
      if (currentState.actionCount > 0) {
        thoughtResult = await this.think(currentState);
        llmCallCount += 1;
        llmCallTokens += this.estimateTokens(currentState, thoughtResult);
      } else {
        thoughtResult = {
          thought: initialAnalysis.thought || '',
          nextAction: initialAnalysis.nextAction || 'finish',
          tools: initialAnalysis.tools || [],
          params: initialAnalysis.params || {}
        };
      }
      
      // 记录思考过程
      const thoughtStep: ThoughtStep = {
        timestamp: Date.now(),
        thought: thoughtResult.thought,
        action: thoughtResult.nextAction
      };
      this.thoughtProcess.push(thoughtStep);
      result.thoughtProcess.push(thoughtStep);
      
      // 检查是否结束
      if (thoughtResult.nextAction === 'finish') {
        // 更新最终决策
        this.updateFinalDecision(result, thoughtResult, currentState);
        break;
      }
      
      // 执行工具
      if (thoughtResult.tools && thoughtResult.tools.length > 0) {
        await this.executeTools(
          thoughtResult.tools,
          thoughtResult.params,
          currentState,
          thoughtStep,
          usedTools
        );
        
        // 特殊处理某些工具的结果
        thoughtResult.tools.forEach(toolId => {
          // 如果是存储或通知工具，更新最终结果
          if (toolId === 'messageStore') {
            result.shouldStore = true;
            currentState.currentDecision.shouldStore = true;
          } else if (toolId === 'notifier') {
            result.shouldNotify = true;
            currentState.currentDecision.shouldNotify = true;
          }
        });
        if (thoughtResult.tools.includes('jiraQuery') && currentState.memory['jiraQuery']) {
          const latestJiraResult = currentState.memory['jiraQuery'][currentState.memory['jiraQuery'].length - 1];
          if (latestJiraResult && latestJiraResult.result) {
            result.jiraData = {
              ...result.jiraData,
              ...latestJiraResult.result
            };
          }
        }
      }
      
      // 增加行动计数
      currentState.actionCount++;
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
    if (Array.isArray(input) && input[0].posts && Array.isArray(input[0].posts)) {
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
   * 更新最终决策
   */
  private updateFinalDecision(result: any, thoughtResult: ThoughtResult, state: any): void {
    // 更新消息分析结果
    if (result.type === 'message') {
      if (thoughtResult.isImportant !== undefined) {
        result.isImportant = thoughtResult.isImportant;
        state.currentDecision.isImportant = thoughtResult.isImportant;
      }
      
      if (thoughtResult.shouldStore !== undefined) {
        result.shouldStore = thoughtResult.shouldStore;
        state.currentDecision.shouldStore = thoughtResult.shouldStore;
      }
      
      if (thoughtResult.shouldNotify !== undefined) {
        result.shouldNotify = thoughtResult.shouldNotify;
        state.currentDecision.shouldNotify = thoughtResult.shouldNotify;
      }
      
      if (thoughtResult.confidence !== undefined) {
        result.confidence = thoughtResult.confidence;
        state.currentDecision.confidence = thoughtResult.confidence;
      }
      
      if (thoughtResult.summary) {
        result.summary = thoughtResult.summary;
        state.currentDecision.summary = thoughtResult.summary;
      }
      
      if (thoughtResult.reasons) {
        result.reasonsToStore = thoughtResult.reasons;
        state.currentDecision.reasons = thoughtResult.reasons;
      }
      
      if (thoughtResult.notificationPriority) {
        result.notificationPriority = thoughtResult.notificationPriority;
        state.currentDecision.notificationPriority = thoughtResult.notificationPriority;
      }
      
      if (thoughtResult.replyAdvice) {
        result.replyAdvice = thoughtResult.replyAdvice;
        state.currentDecision.replyAdvice = thoughtResult.replyAdvice;
      }
    }
    // 更新项目分析结果
    else if (result.type === 'project') {
      if (thoughtResult.riskLevel) {
        result.riskLevel = thoughtResult.riskLevel;
        state.currentDecision.riskLevel = thoughtResult.riskLevel;
      }
      
      if (thoughtResult.confidence !== undefined) {
        result.confidence = thoughtResult.confidence;
        state.currentDecision.confidence = thoughtResult.confidence;
      }
      
      if (thoughtResult.summary) {
        result.summary = thoughtResult.summary;
        state.currentDecision.summary = thoughtResult.summary;
      }
      
      if (thoughtResult.suggestions) {
        result.suggestions = {
          ...result.suggestions,
          ...thoughtResult.suggestions
        };
        state.currentDecision.suggestions = result.suggestions;
      }
      
      if (thoughtResult.timeline) {
        result.timeline = thoughtResult.timeline;
      }
      
      if (thoughtResult.resourceAllocation) {
        result.resourceAllocation = thoughtResult.resourceAllocation;
      }
    }
    // 如果需要，可以添加其他类型的结果更新逻辑
  }
  
  /**
   * 分析项目
   */
  private async analyzeProject(
    input: any,
    config: AnalysisConfig,
    context?: AnalysisContext
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
      const initialAnalysis = await this.initialAnalysis(normalizedInput, config, context);
      llmCallCount += 1;
      llmCallTokens += this.estimateTokens(normalizedInput, initialAnalysis);
      
      // 创建初始结果对象
      const result: ProjectAnalysisResult = {
        type: 'project',
        confidence: initialAnalysis.confidence || 0,
        summary: initialAnalysis.summary || '',
        projectId: normalizedInput.id || normalizedInput.project_data?.project?.id || '',
        projectName: normalizedInput.name || normalizedInput.project_data?.project?.name || '',
        riskLevel: initialAnalysis.riskLevel || 'normal',
        timeline: initialAnalysis.timeline || { onTrack: true, concerns: [] },
        resourceAllocation: initialAnalysis.resourceAllocation || { concerns: [] },
        suggestions: initialAnalysis.suggestions || {},
        thoughtProcess: [] as ThoughtStep[],
        metaData: {
          llmCallCount,
          llmCallTokens,
          usedTools: Array.from(usedTools),
          timestamp: Date.now()
        }
      };
      
      // 如果有Jira数据，添加到结果
      if (initialAnalysis.jiraData) {
        result.jiraData = initialAnalysis.jiraData;
      }

      // 执行思考-行动循环
      this.loopThinking(result, normalizedInput, initialAnalysis, config, context, usedTools);
      
      return result;
    } catch (error) {
      console.error('项目分析失败:', error);
      
      return {
        type: 'project',
        confidence: 0,
        summary: `分析失败: ${error.message}`,
        projectId: input.id || input.project_data?.project?.id || '',
        projectName: input.name || input.project_data?.project?.name || '',
        riskLevel: 'normal',
        metaData: {
          llmCallCount,
          llmCallTokens,
          usedTools: Array.from(usedTools),
          timestamp: Date.now()
        },
        suggestions: {}
      };
    }
  }
  
  /**
   * 执行工具
   */
  private async executeTool(toolId: string, params: Record<string, any>, state: any): Promise<any> {
    // 检查工具是否存在
    if (!toolRegistry[toolId]) {
      throw new Error(`未找到工具: ${toolId}`);
    }
    
    const tool = toolRegistry[toolId];
    
    // 验证必填参数
    if (tool.parameterDefs) {
      for (const param of tool.parameterDefs) {
        if (param.required && (params[param.name] === undefined || params[param.name] === null)) {
          throw new Error(`工具 ${toolId} 缺少必填参数: ${param.name}`);
        }
      }
    }
    
    // 执行工具
    try {
      const result = await tool.execute(params, state);
      return result;
    } catch (error) {
      console.error(`工具 ${toolId} 执行错误:`, error);
      throw error;
    }
  }
  
  /**
   * 批量执行多个工具
   */
  private async executeTools(
    tools: string[], 
    params: Record<string, any>, 
    state: any, 
    thoughtStep: ThoughtStep,
    usedTools: Set<string>
  ): Promise<Record<string, any>> {
    if (!tools || tools.length === 0) {
      return {};
    }
    
    thoughtStep.toolUsed = tools.join(', '); // 记录所有使用的工具
    
    // 并发执行所有选择的工具
    const toolPromises = tools.map(async (toolId: string) => {
      const tool = toolRegistry[toolId];
      
      if (!tool) {
        console.warn(`未找到工具: ${toolId}`);
        return {
          toolId,
          error: `未找到工具: ${toolId}`
        };
      }
      
      const toolParams = params[tool.id] || params;
      console.log(`执行工具: ${tool.name} (${tool.id})`, toolParams);
      
      try {
        const toolResult = await tool.execute(toolParams, state);
        
        // 添加到已使用工具集合
        usedTools.add(toolId);
        
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
    
    // 更新思考步骤结果
    const resultMap = toolResults.reduce((acc, curr) => {
      acc[curr.toolId] = curr.error ? { error: curr.error } : curr.result;
      return acc;
    }, {} as Record<string, any>);
    
    // 将执行结果添加到思考步骤
    thoughtStep.toolResult = JSON.stringify(resultMap);
    
    // 将所有工具结果存入内存
    toolResults.forEach(tr => {
      if (!tr.error) {
        if (!state.memory[tr.toolId]) {
          state.memory[tr.toolId] = [];
        }
        state.memory[tr.toolId].push({params: tr.params, result: tr.result});
        
        // 记录到动作历史
        state.actionHistory.push({
          tool: tr.toolId,
          params: tr.params,
          result: JSON.stringify(tr.result).substring(0, 500) // 限制长度
        });
      }
    });
    
    return resultMap;
  }
  
  /**
   * 分析会议
   */
  private async analyzeMeeting(
    input: any,
    config: AnalysisConfig,
    context?: AnalysisContext
  ): Promise<MeetingAnalysisResult> {
    // 会议分析的具体实现
    // 实际类似于analyzeMessage，但返回MeetingAnalysisResult
    
    // 示例实现（实际项目中需要完善）
    return {
      type: 'meeting',
      confidence: 0.8,
      summary: "会议分析结果",
      topics: [],
      decisions: [],
      actionItems: [],
      followups: [],
      metaData: {
        llmCallCount: 1,
        llmCallTokens: 1000,
        usedTools: [],
        timestamp: Date.now()
      }
    };
  }
  
  /**
   * 分析文档
   */
  private async analyzeDocument(
    input: any,
    config: AnalysisConfig,
    context?: AnalysisContext
  ): Promise<any> {
    // 文档分析的具体实现
    // 未来需要完善
    
    return {
      type: 'document',
      confidence: 0.8,
      summary: "文档分析结果",
      title: input.title || "未知文档",
      documentType: input.type || "other",
      sections: [],
      keyPoints: [],
      metaData: {
        llmCallCount: 1,
        llmCallTokens: 1000,
        usedTools: [],
        timestamp: Date.now()
      }
    };
  }
  
  /**
   * 通用分析（当未指定具体类型时）
   */
  private async analyzeGeneric(
    input: any,
    config: AnalysisConfig,
    context?: AnalysisContext
  ): Promise<GenericAnalysisResult> {
    // 通用分析的具体实现
    return {
      type: 'generic',
      confidence: 0.5,
      summary: "通用分析结果",
      metaData: {
        llmCallCount: 1,
        llmCallTokens: 500,
        usedTools: [],
        timestamp: Date.now()
      }
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
    context?: AnalysisContext
  ): Promise<any> {
    // 根据分析类型构建提示
    let analysisPrompt = '';
    
    switch (config.type) {
      case 'message':
        analysisPrompt = await this.buildMessageAnalysisPrompt(normalizedInput, config, context);
        break;
      case 'project':
        analysisPrompt = this.buildProjectAnalysisPrompt(normalizedInput, config, context);
        break;
      case 'meeting':
        analysisPrompt = this.buildMeetingAnalysisPrompt(normalizedInput, config, context);
        break;
      case 'document':
        analysisPrompt = this.buildDocumentAnalysisPrompt(normalizedInput, config, context);
        break;
      default:
        analysisPrompt = this.buildGenericAnalysisPrompt(normalizedInput, config, context);
    }
    
    // 如果存在自定义分析提示，则使用自定义提示
    if (config.customPrompts?.analysis) {
      analysisPrompt = config.customPrompts.analysis;
    }
    
    try {
      // 调用LLM API进行分析
      const analysis = await callLLMJsonAPI({
        prompt: analysisPrompt,
        type: 'analysis'
      });
      
      return analysis;
    } catch (error) {
      console.error('初始分析失败:', error);
      // 返回基本分析结果以避免流程中断
      return {
        summary: `分析失败: ${error.message}`,
        importanceLevel: "low",
        needsAttention: false,
        sentiment: "neutral",
        nextAction: "finish",
        tools: [],
        params: {},
        shouldStore: false,
        shouldNotify: false,
        confidence: 0,
        reasons: ["分析失败"],
        entities: {}
      };
    }
  }

  /**
   * 构建消息分析提示
   * 修改以支持不同数量的消息
   */
  private async buildMessageAnalysisPrompt(
    messages: any[],
    config: AnalysisConfig,
    context?: AnalysisContext
  ): Promise<string> {
    // 获取环境配置
    const envConfig = await getEnvConfig();
    const analyzeByGroup = envConfig.ANALYZE_BY_GROUP === true;
    
    // 构建消息内容部分
    const messagesContent = messages.map((msg, index) => {
      return `消息 #${index + 1}:
发送者: ${msg.sender || '未知发送者'}
${messages.length > 1 && !analyzeByGroup ? `所在群组: ${msg.groupName || '未知群组'}` : ''}
时间: ${msg.datetime || '未知时间'}
内容: ${msg.messageContent || '无内容'}`;
    }).join('\n\n');
    
    // 构建群组上下文信息
    let contextInfo = '';
    if (messages.length > 1 && analyzeByGroup) {
      // 如果是批量分析且按群组分析
      contextInfo = [
        `群组名称: ${context?.groupInfo?.name || messages[0].groupName || '未知群组'}`,
        `群组ID: ${context?.groupInfo?.id || messages[0].groupId || '未知ID'}`,
        context?.currentUser ? `当前用户: ${context.currentUser}` : ''
      ].filter(Boolean).join('\n');
    } else if (messages.length === 1) {
      // 单条消息的上下文
      contextInfo = [
        `发送者: ${messages[0].sender || '未知发送者'}`,
        messages[0].groupName ? `群组名称: ${messages[0].groupName}` : '',
        messages[0].datetime ? `发送时间: ${messages[0].datetime}` : '',
        context?.currentUser ? `当前用户: ${context.currentUser}` : ''
      ].filter(Boolean).join('\n');
    }
    
    // 构建关注规则
    const concernedRules = context?.concernedRules || [];
    const filterRulesInfo = concernedRules.length > 0 
      ? `关注规则:\n${concernedRules.map((rule, i) => `- 规则${i+1}: ${rule.text}`).join('\n')}`
      : '';
    
    // 获取工具描述
    const toolDescriptions = this.getToolDescriptionsText();
    
    // 构造分析深度提示
    let depthNote = '';
    if (config.analysisDepth === 'quick') {
      depthNote = '注意：这是快速分析，无需使用工具，直接返回基本判断。';
    } else if (config.analysisDepth === 'deep') {
      depthNote = '注意：这是深度分析，尽可能使用多个工具收集完整信息，做出全面判断。';
    }
    
    // 构建提示前缀
    const promptPrefix = messages.length > 1 
      ? `分析以下群组中的一组消息，提取关键信息并判断各消息的重要性:` 
      : `分析以下消息，提取关键信息并判断其重要性:`;
    
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
${messages.length > 1 ? `9. 消息间存在什么关联？后续消息是否是对前面消息的回应？` : ''}`;
    
    // 构建返回格式说明
    const returnFormat = `请以JSON数组格式返回分析结果，每个元素对应一条消息:
[
  {
    ${messages.length > 1 ? '"messageIndex": 0,' : ''}
    "summary": "根据消息上下文，总结消息的简要内容",
    "matchedRules": ["匹配的关注规则1", "匹配的关注规则2"],
    "matchReasons": ["匹配原因1", "匹配原因2"],
    "importanceLevel": "low|medium|high",
    "needsAttention": true|false,
    "needsProcessing": true|false,
    "isNoiseMessage": false,
    "sentiment": "positive|negative|neutral",
    "context": "消息在对话中的角色，如'提问','回答','确认'等",
    "mentionedSystems": ["系统1", "系统2"],
    
    // 决策和工具字段
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
  },
  // ... 其他消息的分析结果
]`
    
    // 构建特别说明
    const specialNotes = `特别说明:
1. 'needsProcessing'字段表示消息是否需要进一步处理(如存储、通知等)
2. 'isNoiseMessage'字段标识是否为噪音消息(如单纯的"好的"、"谢谢"等)
3. 'nextAction'应该是'use_tool'或'finish'，表示是否需要进一步处理
4. 如果不需要处理(nextAction为finish)，请提供完整的决策信息(shouldStore, shouldNotify等)
5. 对于entities字段，请尽可能完整提取实体信息
6. 'tools'字段中只能包含上面列出的可用工具ID
7. 'params'字段应该根据选择的工具提供合适的参数，参考工具描述中的参数定义`
    
    // 构建最终提示
    return `
${promptPrefix}

${messages.length > 1 ? `群组信息:\n${contextInfo}` : `上下文信息:\n${contextInfo}`}

${messages.length > 1 ? `消息列表:\n${messagesContent}` : `消息内容:\n${messagesContent}`}

${filterRulesInfo}

${depthNote}

# 可用工具
以下是可用于处理消息的工具，可以在分析时考虑是否需要使用这些工具：
${toolDescriptions}
${config.preferredTools && config.preferredTools.length > 0 ? `\n推荐优先考虑使用这些工具: ${config.preferredTools.join(', ')}` : ''}

${analysisPoints}

${returnFormat}

${specialNotes}

工具选择建议:
- 如果消息提到项目进度或问题，考虑使用jiraQuery
- 如果消息涉及组织关系或人员，考虑使用orgStructure
- 如果需要了解历史上下文，考虑使用historySearch
`;
  }
  
  /**
   * 构建项目分析提示
   */
  private buildProjectAnalysisPrompt(normalizedInput: any, config: AnalysisConfig, context?: AnalysisContext): string {
    // 获取项目基本信息
    const projectId = normalizedInput.id || normalizedInput.projectId || normalizedInput.project_data?.project?.id || '未知项目ID';
    const projectName = normalizedInput.name || normalizedInput.projectName || normalizedInput.project_data?.project?.name || normalizedInput.title || '未知项目';
    const projectType = normalizedInput.type || 'generic'; // 可能的类型：jira_ticket, release, sprint, project
    
    // 处理可能的Jira数据
    const jiraData = normalizedInput.jiraData || normalizedInput.project_data?.jiraData || null;
    
    // 构建上下文信息
    const contextInfo = [
      `项目ID: ${projectId}`,
      `项目名称: ${projectName}`,
      `项目类型: ${projectType}`,
      context?.currentUser ? `当前用户: ${context.currentUser}` : '',
      normalizedInput.owner || normalizedInput.project_data?.project?.owner ? `负责人: ${normalizedInput.owner || normalizedInput.project_data?.project?.owner}` : '',
      normalizedInput.status || normalizedInput.project_data?.project?.status ? `当前状态: ${normalizedInput.status || normalizedInput.project_data?.project?.status}` : '',
      normalizedInput.dueDate ? `截止日期: ${normalizedInput.dueDate}` : '',
      normalizedInput.project_data?.project?.track ? `赛道: ${normalizedInput.project_data?.project?.track}` : '',
      normalizedInput.project_data?.project?.comments ? `备注: ${normalizedInput.project_data?.project?.comments}` : '',
    ].filter(Boolean).join('\n');
    
    // 构建Jira数据信息
    let jiraInfo = '';
    if (jiraData) {
      jiraInfo = `
Jira工单信息:
- 工单ID: ${jiraData.key || jiraData.id || '未知'}
- 工单状态: ${jiraData.status || jiraData.fields?.status?.name || '未知'}
- 负责人: ${jiraData.assignee || jiraData.fields?.assignee?.displayName || '未知'}
- 更新时间: ${jiraData.updated || jiraData.fields?.updated || '未知'}
${jiraData.summary || jiraData.fields?.summary ? `- 摘要: ${jiraData.summary || jiraData.fields?.summary}` : ''}
`;
    }
    
    // 构建项目内容描述
    let contentDescription = '';
    if (normalizedInput.description) {
      contentDescription = `项目描述:\n${normalizedInput.description}`;
    } else if (normalizedInput.content || normalizedInput.message_content) {
      contentDescription = `项目内容:\n${normalizedInput.content || normalizedInput.message_content}`;
    } else if (normalizedInput.tickets && Array.isArray(normalizedInput.tickets)) {
      contentDescription = `相关工单:\n${normalizedInput.tickets.map((ticket: any, i: number) => 
        `- 工单${i+1}: ${ticket.id || ''} ${ticket.title || ''} [${ticket.status || ''}]`
      ).join('\n')}`;
    }
    
    // 获取工具描述
    const toolDescriptions = this.getToolDescriptionsText();
    
    // 添加分析深度相关内容
    let depthNote = '';
    if (config.analysisDepth === 'quick') {
      depthNote = '注意：这是快速分析，无需使用工具，直接返回基本判断。';
    } else if (config.analysisDepth === 'deep') {
      depthNote = '注意：这是深度分析，尽可能使用多个工具收集完整信息，做出全面判断。';
    }
    
    // 构建最终提示
    return `
分析以下项目信息，评估项目状态与风险:

项目基本信息:
${contextInfo}

${jiraInfo}

${contentDescription}

${depthNote}

# 可用工具
以下是可用于分析项目的工具:
${toolDescriptions}
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
  "thought": "分析当前情况和下一步行动的详细思考过程",
  "nextAction": "use_tool|finish",
  "tools": ["选择的工具ID"],
  "params": {}, // 工具参数
  "confidence": 0.7,
  
  // 建议
  "suggestions": {
    "status": "(In Progress|Done|Blocked|Released)", // 用英文直接填入具体的状态值（如：进行中、已完成、阻塞中）
    "owner": "", // 用英文直接填入具体的人名
    "track": "", // 用英文直接填入具体的赛道名称或团队名
    "highlights": ["highlight1", "highlight2"], // 用英文直接填入具体的备注内容
    "actionItems": ["actionItem1", "actionItem2"],  // 用英文直接填入具体的行动项
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
  
  // Jira相关数据
  "jiraData": {
    "status": "Jira工单状态",
    "assignee": "Jira负责人",
    "updated": "最后更新时间",
    "comments": ["Jira评论1", "Jira评论2"],
    "statusMatch": true|false
  }
}
`;
  }
  
  /**
   * 构建会议分析提示
   */
  private buildMeetingAnalysisPrompt(normalizedInput: any, config: AnalysisConfig, context?: AnalysisContext): string {
    // 获取会议基本信息
    const meetingId = normalizedInput.id || normalizedInput.meetingId || '未知会议ID';
    const meetingTitle = normalizedInput.title || normalizedInput.name || '未知会议';
    const meetingType = normalizedInput.type || 'generic'; // 可能的类型：daily, weekly, review, planning
    
    // 构建会议上下文信息
    const contextInfo = [
      `会议ID: ${meetingId}`,
      `会议标题: ${meetingTitle}`,
      `会议类型: ${meetingType}`,
      normalizedInput.organizer ? `组织者: ${normalizedInput.organizer}` : '',
      normalizedInput.datetime ? `会议时间: ${normalizedInput.datetime}` : '',
      normalizedInput.duration ? `会议时长: ${normalizedInput.duration}分钟` : '',
      normalizedInput.location ? `会议地点: ${normalizedInput.location}` : '',
      normalizedInput.attendees ? `参会人员: ${Array.isArray(normalizedInput.attendees) ? normalizedInput.attendees.join(', ') : normalizedInput.attendees}` : '',
      context?.currentUser ? `当前用户: ${context.currentUser}` : ''
    ].filter(Boolean).join('\n');
    
    // 构建会议内容描述
    let contentDescription = '';
    if (normalizedInput.transcript) {
      contentDescription = `会议记录:\n${normalizedInput.transcript}`;
    } else if (normalizedInput.content) {
      contentDescription = `会议内容:\n${normalizedInput.content}`;
    } else if (normalizedInput.agenda) {
      contentDescription = `会议议程:\n${Array.isArray(normalizedInput.agenda) ? 
        normalizedInput.agenda.map((item: any, i: number) => `- 议题${i+1}: ${item}`).join('\n') : 
        normalizedInput.agenda}`;
    }
    
    // 获取工具描述
    const toolDescriptions = this.getToolDescriptionsText();;
    
    // 添加分析深度相关内容
    let depthNote = '';
    if (config.analysisDepth === 'quick') {
      depthNote = '注意：这是快速分析，无需使用工具，直接返回基本会议摘要。';
    } else if (config.analysisDepth === 'deep') {
      depthNote = '注意：这是深度分析，请尽可能提取详细的会议信息，包括决策点、行动项和跟进事项。';
    }
    
    // 构建最终提示
    return `
分析以下会议内容，提取关键信息并总结重要决策与行动项:

会议基本信息:
${contextInfo}

${contentDescription}

${depthNote}

# 可用工具
以下是可用于分析会议的工具:
${toolDescriptions}
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
   - 提取资源分配决策
   - 识别关键里程碑和时间点
   - 总结风险评估结果

请提取会议中讨论的所有主题，识别关键决策，列出所有行动项及其负责人和截止日期，并总结需要跟进的事项。

以JSON格式返回:
{
  "summary": "会议总体摘要",
  "meetingType": "识别出的会议类型",
  "attendees": ["参会人员1", "参会人员2"],
  "topics": [
    {
      "title": "讨论主题",
      "summary": "讨论内容摘要",
      "keyPoints": ["要点1", "要点2"]
    }
  ],
  "decisions": [
    {
      "topic": "相关主题",
      "decision": "决策内容",
      "rationale": "决策理由",
      "stakeholders": ["相关人员"]
    }
  ],
  "actionItems": [
    {
      "description": "行动项描述",
      "assignee": "负责人",
      "dueDate": "截止日期",
      "priority": "high|medium|low",
      "relatedTopic": "相关主题"
    }
  ],
  "followups": [
    {
      "description": "需要跟进的事项",
      "by": "跟进人",
      "byWhen": "跟进时间"
    }
  ],
  
  // 决策和工具字段
  "thought": "分析当前情况和下一步行动的详细思考过程",
  "nextAction": "use_tool|finish",
  "tools": ["选择的工具ID"],
  "params": {}, // 工具参数
  "confidence": 0.7,
  
  // 会议效果评估
  "meetingEffectiveness": {
    "clarity": "high|medium|low", // 会议目标清晰度
    "participation": "high|medium|low", // 参与度
    "decisions": "effective|mixed|ineffective", // 决策有效性
    "timeUsage": "efficient|adequate|inefficient" // 时间利用
  },
  
  // 实体提取
  "entities": {
    "projects": [{"name": "项目名", "status": "状态"}],
    "issues": [{"id": "问题ID", "description": "问题描述"}],
    "deadlines": [{"event": "事件", "date": "日期"}]
  }
}
`;
  }
  
  /**
   * 构建文档分析提示
   */
  private buildDocumentAnalysisPrompt(normalizedInput: any, config: AnalysisConfig, context?: AnalysisContext): string {
    // 获取文档基本信息
    const documentId = normalizedInput.id || normalizedInput.documentId || '未知文档ID';
    const documentTitle = normalizedInput.title || normalizedInput.name || '未知文档';
    const documentType = normalizedInput.type || normalizedInput.format || 'generic'; // 可能的类型：report, spec, proposal, presentation
    
    // 构建文档上下文信息
    const contextInfo = [
      `文档ID: ${documentId}`,
      `文档标题: ${documentTitle}`,
      `文档类型: ${documentType}`,
      normalizedInput.author ? `作者: ${normalizedInput.author}` : '',
      normalizedInput.createdAt ? `创建时间: ${normalizedInput.createdAt}` : '',
      normalizedInput.lastModified ? `最后修改: ${normalizedInput.lastModified}` : '',
      normalizedInput.version ? `版本: ${normalizedInput.version}` : '',
      normalizedInput.tags ? `标签: ${Array.isArray(normalizedInput.tags) ? normalizedInput.tags.join(', ') : normalizedInput.tags}` : '',
      context?.currentUser ? `当前用户: ${context.currentUser}` : ''
    ].filter(Boolean).join('\n');
    
    // 构建文档内容描述
    let contentDescription = '';
    if (normalizedInput.content) {
      contentDescription = `文档内容:\n${normalizedInput.content}`;
    } else if (normalizedInput.summary) {
      contentDescription = `文档摘要:\n${normalizedInput.summary}`;
    } else if (normalizedInput.sections && Array.isArray(normalizedInput.sections)) {
      contentDescription = `文档章节:\n${normalizedInput.sections.map((section: any, i: number) => 
        `## ${section.title || `章节${i+1}`}\n${section.content || '无内容'}`
      ).join('\n\n')}`;
    }
    
    // 获取工具描述
    const toolDescriptions = this.getToolDescriptionsText();;
    
    // 添加分析深度相关内容
    let depthNote = '';
    if (config.analysisDepth === 'quick') {
      depthNote = '注意：这是快速分析，直接返回文档基本摘要和关键点。';
    } else if (config.analysisDepth === 'deep') {
      depthNote = '注意：这是深度分析，请详细提取文档结构、主题、观点、论据和建议等内容。';
    }
    
    // 构建最终提示
    return `
分析以下文档内容，提取关键信息和主要观点:

文档基本信息:
${contextInfo}

${contentDescription}

${depthNote}

# 可用工具
以下是可用于分析文档的工具:
${toolDescriptions}
${config.preferredTools && config.preferredTools.length > 0 ? `\n推荐优先考虑使用这些工具: ${config.preferredTools.join(', ')}` : ''}

# 分析指南
根据文档类型进行有针对性的分析:

1. 如果是技术规格/设计文档:
   - 分析功能需求和技术要求
   - 提取架构设计和组件关系
   - 总结技术限制和依赖条件
   - 识别可能的实现风险
   
2. 如果是项目报告/提案:
   - 提取项目背景和问题定义
   - 分析解决方案和论据支持
   - 总结建议行动和预期结果
   - 识别资源需求和时间线
   
3. 如果是演示文稿/培训材料:
   - 提取主要观点和教学目标
   - 分析内容组织和逻辑流程
   - 总结关键示例和案例研究
   - 识别适用场景和预期受众

请分析文档的整体结构、主要主题、关键论点和支持证据，并总结文档的主要目的和关键发现。

以JSON格式返回:
{
  "summary": "文档整体摘要",
  "documentType": "识别出的文档类型",
  "purpose": "文档目的",
  "audience": "目标受众",
  "structure": {
    "sections": [
      {
        "title": "章节标题",
        "summary": "章节内容摘要",
        "keyPoints": ["关键点1", "关键点2"]
      }
    ]
  },
  "keyThemes": [
    {
      "theme": "主题名称",
      "description": "主题描述",
      "relatedSections": ["相关章节"]
    }
  ],
  "arguments": [
    {
      "claim": "论点",
      "evidence": ["支持证据1", "支持证据2"],
      "strength": "strong|moderate|weak"
    }
  ],
  "findings": ["发现1", "发现2"],
  "recommendations": ["建议1", "建议2"],
  
  // 决策和工具字段
  "thought": "分析当前情况和下一步行动的详细思考过程",
  "nextAction": "use_tool|finish",
  "tools": ["选择的工具ID"],
  "params": {}, // 工具参数
  "confidence": 0.7,
  
  // 质量评估
  "documentQuality": {
    "clarity": "high|medium|low", // 清晰度
    "completeness": "high|medium|low", // 完整性
    "consistency": "high|medium|low", // 一致性
    "supportedClaims": "well|partially|poorly" // 观点支持程度
  },
  
  // 实体提取
  "entities": {
    "concepts": [{"name": "概念名", "definition": "定义"}],
    "technologies": [{"name": "技术名", "context": "使用上下文"}],
    "references": [{"text": "引用文本", "source": "来源"}]
  }
}
`;
  }
  
  /**
   * 构建通用分析提示
   */
  private buildGenericAnalysisPrompt(normalizedInput: any, config: AnalysisConfig, context?: AnalysisContext): string {
    // 尝试确定输入类型
    let inputType = 'unknown';
    let inputTitle = '未命名内容';
    
    // 基于输入属性尝试推断类型
    if (normalizedInput.message_content || normalizedInput.content && normalizedInput.sender) {
      inputType = 'message';
    } else if (normalizedInput.transcript || normalizedInput.attendees) {
      inputType = 'meeting';
    } else if (normalizedInput.tickets || normalizedInput.release) {
      inputType = 'project';
    } else if (normalizedInput.sections || normalizedInput.author) {
      inputType = 'document';
    }
    
    // 尝试获取标题
    if (normalizedInput.title) {
      inputTitle = normalizedInput.title;
    } else if (normalizedInput.name) {
      inputTitle = normalizedInput.name;
    } else if (normalizedInput.subject) {
      inputTitle = normalizedInput.subject;
    }
    
    // 构建上下文信息
    const contextInfo = [
      `内容标题: ${inputTitle}`,
      `推测类型: ${inputType}`,
      normalizedInput.datetime ? `时间: ${normalizedInput.datetime}` : '',
      normalizedInput.source ? `来源: ${normalizedInput.source}` : '',
      context?.currentUser ? `当前用户: ${context.currentUser}` : ''
    ].filter(Boolean).join('\n');
    
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
      if (inputStr.length < 5000) { // 避免过长内容
        contentDescription = `原始内容:\n${inputStr}`;
      } else {
        contentDescription = `原始内容过长，请使用工具查看完整内容。`;
      }
    }
    
    // 获取工具描述
    const toolDescriptions = this.getToolDescriptionsText();;
    
    // 添加分析深度相关内容
    let depthNote = '';
    if (config.analysisDepth === 'quick') {
      depthNote = '注意：这是快速分析，直接返回基本总结。';
    } else if (config.analysisDepth === 'deep') {
      depthNote = '注意：这是深度分析，请尽可能详细地提取信息和见解。';
    }
    
    // 构建最终提示
    return `
分析以下内容，提取关键信息和见解:

基本信息:
${contextInfo}

${contentDescription}

${depthNote}

# 可用工具
以下是可用于分析的工具:
${toolDescriptions}
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
  "thought": "分析当前情况和下一步行动的详细思考过程",
  "nextAction": "use_tool|finish",
  "tools": ["选择的工具ID"],
  "params": {}, // 工具参数
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
    if (state.config.customPrompts?.thinking) {
      const customThinkPrompt = state.config.customPrompts.thinking;
    }
    
    try {
      // 调用LLM API进行思考
      const thoughtResult = await callLLMJsonAPI({
        prompt: thinkPrompt,
        type: 'think'
      });
      
      return thoughtResult;
    } catch (error) {
      console.error('思考过程失败:', error);
      // 返回直接结束处理的决定
      return {
        thought: `思考过程中出错: ${error.message}，决定结束处理`,
        nextAction: 'finish',
        tools: [],
        params: {},
        ...state.currentDecision
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
当前分析的消息内容: ${state.message.message_content || state.message.content || '无内容'}
发送者: ${state.message.sender || '未知'}
发送时间: ${state.message.datetime || '未知'}
群组/团队: ${state.message.groupName || '未知'}

当前决策:
- 重要性: ${state.currentDecision.isImportant ? '重要' : '不重要'}
- 需要存储: ${state.currentDecision.shouldStore ? '是' : '否'}
- 需要通知: ${state.currentDecision.shouldNotify ? '是' : '否'}
- 置信度: ${state.currentDecision.confidence || 0}
- 摘要: ${state.currentDecision.summary || '无摘要'}
- 理由: ${state.currentDecision.reasons?.join(', ') || '无理由'}
- 通知优先级: ${state.currentDecision.notificationPriority || 'low'}
- 回复建议: ${state.currentDecision.replyAdvice || '无建议'}
`;
        break;
        
      case 'project':
        stateDescription = `
当前分析的项目: ${state.message.name || state.message.title || '未命名项目'}
项目ID: ${state.message.id || state.message.projectId || '未知ID'}
状态: ${state.message.status || '未知状态'}
负责人: ${state.message.owner || '未知'}

当前分析结果:
- 风险级别: ${currentResult.riskLevel || '未评估'}
- 时间线状态: ${currentResult.timeline?.onTrack ? '正常' : '有风险'}
- 建议操作: ${currentResult.suggestions?.actionItems?.join(', ') || '无'}
`;
        break;
        
      case 'meeting':
        stateDescription = `
当前分析的会议: ${state.message.title || '未命名会议'}
会议时间: ${state.message.datetime || '未知时间'}
参会人员: ${Array.isArray(state.message.attendees) ? state.message.attendees.join(', ') : (state.message.attendees || '未知')}

当前分析结果:
- 主题数量: ${currentResult.topics?.length || 0}
- 决策数量: ${currentResult.decisions?.length || 0}
- 行动项数量: ${currentResult.actionItems?.length || 0}
- 需要跟进项: ${currentResult.followups?.length || 0}
`;
        break;
        
      case 'document':
        stateDescription = `
当前分析的文档: ${state.message.title || '未命名文档'}
文档类型: ${state.message.type || '未知类型'}
作者: ${state.message.author || '未知'}

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
${state.actionHistory.map((action: any, index: number) => 
  `${index + 1}. 工具: ${action.tool || '无'}, 参数: ${JSON.stringify(action.params || {})}, 结果: ${action.result || '无结果'}`
).join('\n')}
`;
    }
    
    // 添加记忆内容
    let memoryContent = '';
    if (Object.keys(memory).length > 0) {
      memoryContent = `
已执行的工具和收集的信息:
${Object.entries(memory).map(([key, results]: [string, any]) => results.map((r:any) => `- ${key} [已执行]: ${r.result.message.substring(0, 500)}${r.result.message.length > 300 ? '...' : ''}`)).join('\n')}
`;
    }
    
    // 获取工具描述
    const toolDescriptions = this.getToolDescriptionsText();;
    
    // 构建最终提示
    return `
作为智能分析助手，你正在分析一个${analysisType}类型的内容。你已经执行了${currentActionCount}个操作，最多可以执行${maxActions}个操作。

## 当前状态
${stateDescription}

${actionHistory}

${memoryContent}

## 可用工具
${toolDescriptions}
${state.config.preferredTools && state.config.preferredTools.length > 0 ? `\n推荐优先考虑使用这些工具: ${state.config.preferredTools.join(', ')}` : ''}

## 思考指南
请仔细思考当前状态和已有信息，决定下一步行动:

1. 评估已获取的信息是否足够做出决策
2. 考虑是否需要使用工具获取更多信息
3. 如果需要使用工具，选择最合适的工具并确定参数
4. 如果已有足够信息，可以结束分析并给出最终决策

请以JSON格式返回你的思考结果:
{
  "thought": "详细解释你的思考过程，包括对当前状态的分析和决策理由",
  "nextAction": "use_tool或finish",
  "tools": ["选择的工具ID"], // 如果nextAction为use_tool
  "params": {}, // 工具所需参数
  
  // 如果决定结束，更新当前决策
  "isImportant": true|false,
  "shouldStore": true|false,
  "shouldNotify": true|false,
  "confidence": 0.9,
  "summary": "最终摘要",
  "reasons": ["理由1", "理由2"],
  "notificationPriority": "high|medium|low",
  "replyAdvice": "回复建议"
}
`;
  }
}

// 导出所有需要的接口和函数
export {
  Tool,
  ParameterDefinition,
  registerTool
};