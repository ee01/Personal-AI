/**
 * 统一记忆系统接口层
 * 提供清晰的读取和存储接口，管理本地缓存和云端存储
 */

import { CloudStorage, MemoryEntity, MemoryMessage } from './storage/CloudStorage';
import { GraphRelationship, LocalStorage, CachedEntityDetail } from './storage/LocalStorage';
import { EntitySimilarityTool, ProcessedEntity, EntityMergePair } from './storage/EntitySimilarityTool';
import { SystemMaintenanceTool, SystemHealthStatus, MaintenanceResult, createSystemMaintenanceTool } from './storage/SystemMaintenanceTool';
import { UserProfileManager } from './services/UserProfileManager';
import { UserProfile, UserProfileAnalysis, UserAction, UserProfileUpdate } from './types/userProfile';
import { extractEntitiesForQuery } from './services/entityExtraction';
import { v4 as uuidv4 } from 'uuid';


// 重新导出接口供其他模块使用
export { MemoryEntity } from './storage/CloudStorage';
export { CachedEntityDetail } from './storage/LocalStorage';



// 查询结果接口
export interface QueryResult<T> {
  data: T[];
  total: number;
  source: 'local' | 'cloud' | 'hybrid';
  cached: boolean;
  queryTime: number;
}

// 存储结果接口
export interface StoreResult {
  success: boolean;
  entityId: string;
  cloudStored: boolean;
  localCached: boolean;
  relationshipsCreated: number;
  processingTime: number;
  errors?: string[];
}



// 查询选项
export interface QueryOptions {
  limit?: number;
  offset?: number;
  sortBy?: 'name' | 'created' | 'updated' | 'importance' | 'relevance';
  sortOrder?: 'asc' | 'desc';
  useCache?: boolean;
  includeCounts?: boolean;
}

// 向量搜索选项
export interface VectorSearchOptions extends Omit<QueryOptions, 'sortBy'> {
  includeMetadata?: boolean;
  nResults?: number;
  collections?: ('entities' | 'messages' | 'webpages' | 'userprofiles')[]; // 指定搜索的集合
  returnType?: 'entities' | 'messages' | 'userprofiles' | 'raw';  // 返回类型：实体对象、原始数据或用户档案
  sortBy?: 'relevance' | 'time' | 'importance'; // 向量搜索特定的排序方式
  timeRange?: { start: number; end: number }; // 时间范围过滤
  minRelevanceScore?: number; // 最低相关度阈值
  where?: Record<string, any>; // 通用过滤条件，支持ChromaDB的where语法
}

// 实体类型信息接口
export interface EntityTypeInfo {
  type: string;
  name: string;
  icon: string;
  count: number;
  description: string;
}

// 实体类型配置
const ENTITY_TYPE_CONFIG: Record<string, { name: string; icon: string; description: string }> = {
  'Person': { 
    name: '人物', 
    icon: '👥', 
    description: '团队成员、联系人、项目相关人员等'
  },
  'Project': { 
    name: '项目', 
    icon: '🚀', 
    description: '工作项目、产品开发、研究项目等'
  },
  'Task': { 
    name: '任务', 
    icon: '📋', 
    description: '具体工作任务、待办事项、行动项等'
  },
  'Organization': { 
    name: '组织', 
    icon: '🏢', 
    description: '公司、部门、团队、客户组织等'
  },
  'Document': { 
    name: '文档', 
    icon: '📄', 
    description: '文件、资料、规范、报告等'
  },
  'Technology': { 
    name: '技术', 
    icon: '🔧', 
    description: '技术栈、工具、框架、平台等'
  },
  'Topic': { 
    name: '主题', 
    icon: '💡', 
    description: '讨论话题、知识领域、专业概念等'
  }
};

// 策略配置
interface StrategyConfig {
  preferLocalForEntityQueries: boolean;
  localSearchThreshold: number;
  cloudFallbackTimeout: number;
  requireCloudSuccess: boolean;
  retryAttempts: number;
  retryDelay: number;
  syncInterval: number;
  maxSyncBatchSize: number;
  prioritizeRecentData: boolean;
}

// 性能指标
interface PerformanceMetrics {
  totalQueries: number;
  localHits: number;
  cloudHits: number;
  averageLocalTime: number;
  averageCloudTime: number;
  cacheHitRate: number;
  lastReset: number;
}

/**
 * 统一记忆系统管理器 - 现在直接充当策略层
 */
export class MemorySystem {
  public cloudStorage: CloudStorage;  // 🔓 改为 public，供 llm.ts 等模块访问
  private localStorage: LocalStorage;
  private entitySimilarityTool: EntitySimilarityTool;
  private systemMaintenanceTool: SystemMaintenanceTool;
  public userProfileManager: UserProfileManager | null = null;
  private isInitialized = false;
  
  // 策略配置和性能指标
  private config: StrategyConfig;
  private metrics: PerformanceMetrics;
  private alarmListenerAdded = false;
  private backgroundSyncStarted = false;
  private isSyncing = false;
  private initializationPromise: Promise<boolean> | null = null; // 添加初始化Promise
  
  // 🆕 智能检索配置（ask() 方法专用）
  private readonly ASK_CONFIG = {
    MIN_RELEVANCE_SCORE: 0.5,           // 实体相关度阈值（可调整）
    MAX_CONTEXT_LENGTH: 100000,         // 最大上下文长度（~25K tokens）
    ENABLE_2HOP_THRESHOLD: 5,           // 当 1-hop 结果少于此值时触发 2-hop
    MIN_2HOP_RELEVANCE: 0.4,            // 2-hop 实体的最低相关度
    ENTITY_LIMIT_PER_TYPE: 20,          // 每种类型最多返回实体数
    CONTEXT_COMPRESSION_RATIO: 0.7,     // 上下文压缩比例
  }

  constructor() {
    this.cloudStorage = new CloudStorage();
    this.localStorage = new LocalStorage();
    this.entitySimilarityTool = new EntitySimilarityTool();
    // 暂时延迟初始化 systemMaintenanceTool，在 initialize 方法中初始化
    this.systemMaintenanceTool = null as any;
    
    // 初始化策略配置
    this.config = {
      preferLocalForEntityQueries: true,
      localSearchThreshold: 5,
      cloudFallbackTimeout: 5000,
      requireCloudSuccess: false,
      retryAttempts: 3,
      retryDelay: 1000,
      syncInterval: 30 * 60 * 1000, // 30分钟
      maxSyncBatchSize: 50,
      prioritizeRecentData: true
    };

    // 初始化性能指标
    this.metrics = {
      totalQueries: 0,
      localHits: 0,
      cloudHits: 0,
      averageLocalTime: 0,
      averageCloudTime: 0,
      cacheHitRate: 0,
      lastReset: Date.now()
    };
  }

  /**
   * 初始化记忆系统（纯粹的初始化逻辑）
   */
  private async performInitialization(): Promise<boolean> {
    try {
      console.log('🧠 初始化记忆系统...');
      
      // 并行初始化各组件
      const [cloudInit, localInit] = await Promise.all([
        this.cloudStorage.initialize(),
        this.localStorage.initialize()
      ]);

      // 加载配置和指标
      await this.loadConfig();
      await this.loadMetrics();

      this.isInitialized = cloudInit && localInit;
      
      if (this.isInitialized) {
        console.log('✅ 记忆系统初始化完成');
        
        // 初始化系统维护工具（需要 memorySystem 实例，所以在这里初始化）
        this.systemMaintenanceTool = createSystemMaintenanceTool(
          this.cloudStorage, 
          this.localStorage, 
          this as any // 传入自身作为策略层
        );
        
        // 启动后台同步
        this.startBackgroundSync();
        // 启动系统监控
        this.systemMaintenanceTool.startMonitoring();
        
        // 初始化用户画像管理器
        await this.initializeUserProfile();
      } else {
        console.error('❌ 记忆系统初始化失败');
      }

      return this.isInitialized;
    } catch (error) {
      console.error('❌ 记忆系统初始化异常:', error);
      this.isInitialized = false; // 确保失败时重置状态
      return false;
    }
  }

  /**
   * 初始化记忆系统（公共接口）
   */
  async initialize(): Promise<boolean> {
    // 如果已经在初始化中，返回现有的Promise
    if (this.initializationPromise) {
      console.log('⚠️ 记忆系统正在初始化中，等待完成...');
      return this.initializationPromise;
    }

    // 防止重复初始化
    if (this.isInitialized) {
      console.log('⚠️ 记忆系统已初始化，跳过重复初始化');
      return true;
    }

    // 创建并缓存初始化Promise
    this.initializationPromise = this.performInitialization().finally(() => {
      // 无论成功失败，都清除Promise缓存
      this.initializationPromise = null;
    });

    return this.initializationPromise;
  }

  // ==================== 读取接口 ====================

  /**
   * 查询实体（普通查询，智能策略）
   */
  async queryEntities(
    type?: string,
    searchTerm?: string,
    options: QueryOptions = {}
  ): Promise<QueryResult<CachedEntityDetail>> {
    const success = await this.initialize();
    if (!success) {
      throw new Error('记忆系统初始化失败');
    }

    const startTime = Date.now();
    this.metrics.totalQueries++;

    try {
      // 如果有搜索词且长度大于2，考虑使用向量搜索
      if (searchTerm && searchTerm.length > 2) {
        const cloudResult = await this.cloudStorage.searchByVector(searchTerm, type, options as VectorSearchOptions);
        // 缓存结果到本地
        await this.cacheCloudResults(cloudResult.data);
        // 扩展实体信息
        const extendedData = await this.extendEntitiesFromCache(cloudResult.data);
        return {
          ...cloudResult,
          data: extendedData
        };
      }

      // 设置默认分页参数（第一页30条数据）
      const queryOptions = {
        ...options,
        limit: options.limit || 30,
        offset: options.offset || 0
      };

      // 优先查询云端获取分页数据
      const cloudResult = await this.queryFromCloud(type, searchTerm, queryOptions);
      this.updateMetrics('cloud', Date.now() - startTime);
      
      // 缓存结果到本地
      await this.cacheCloudResults(cloudResult.data);
      
      // 扩展实体信息：合并recent data
      const extendedData = await this.extendEntitiesFromCache(cloudResult.data);
      
      console.log(`🎯 MemorySystem.queryEntities: 查询到 ${cloudResult.data.length} 个实体，扩展信息后 ${extendedData.length} 个`);
      
      return {
        ...cloudResult,
        data: extendedData
      };

    } catch (error) {
      console.error('查询实体失败:', error);
      
      // 出错时尝试返回本地结果
      if (type) {
        const fallbackResult = await this.queryFromLocal(type, searchTerm, options);
        const extendedData = await this.extendEntitiesFromCache(fallbackResult.data);
        return {
          ...fallbackResult,
          data: extendedData,
          source: 'local'
        };
      }

      return {
        data: [],
        total: 0,
        source: 'local',
        cached: true,
        queryTime: Date.now() - startTime
      };
    }
  }

  /**
   * 向量搜索（直接云端查询）
   */
  async searchByVector(
    query: string,
    type?: string,
    options: VectorSearchOptions = {}
  ): Promise<QueryResult<MemoryEntity>> {
    const success = await this.initialize();
    if (!success) {
      throw new Error('记忆系统初始化失败');
    }
    return this.cloudStorage.searchByVector(query, type, options);
  }

  /**
   * 获取实体详情（优先本地，包含详细信息补充）
   */
  async getEntityDetails(entityId: string): Promise<CachedEntityDetail | null> {
    const success = await this.initialize();
    if (!success) {
      throw new Error('记忆系统初始化失败');
    }

    try {
      // 先从本地获取
      const localEntity = await this.localStorage.getEntity(entityId);
      if (localEntity) {
        this.metrics.localHits++;
        // 检查是否需要补充详细信息
        return await this.enrichEntityWithDetails(localEntity);
      }

      // 本地没有，从云端获取
      const entity = await this.cloudStorage.getEntity(entityId);
      if (entity) {
        // 缓存到本地并补充详细信息
        await this.localStorage.cacheEntity(entity);
        this.metrics.cloudHits++;
        return await this.enrichEntityWithDetails(entity);
      }

      return null;

    } catch (error) {
      console.error('获取实体详情失败:', error);
      return null;
    }
  }

  /**
   * 为实体补充详细信息（特别是 recent data）
   */
  async enrichEntityWithDetails(entity: MemoryEntity): Promise<CachedEntityDetail> {
    const success = await this.initialize();
    if (!success) {
      throw new Error('记忆系统初始化失败');
    }
    
    try {
      // 首先尝试从本地缓存获取详细信息
      const cachedDetails = await this.localStorage.getEntity(entity.id);
      
      // 检查是否缺少 recent data（没有讨论、资源、项目）
      const hasRecentData = cachedDetails && (
        (cachedDetails.recentDataDetails?.conversations && cachedDetails.recentDataDetails.conversations.length > 0) ||
        (cachedDetails.recentDataDetails?.resources && cachedDetails.recentDataDetails.resources.length > 0) ||
        (cachedDetails.recentDataDetails?.projects && cachedDetails.recentDataDetails.projects.length > 0)
      );
      
      if (hasRecentData && cachedDetails) {
        return cachedDetails;
      }
      
      // 如果缺少详细信息，从云端扩展实体信息
      console.log(`🔍 为实体 ${entity.id} 补充详细信息...`);
      const extendedEntity = await this.cloudStorage.extendEntityToDetailCache(entity);
      
      // 更新本地缓存
      await this.localStorage.cacheEntity(extendedEntity);
      
      return extendedEntity;
      
    } catch (error) {
      console.error(`补充实体 ${entity.id} 详细信息失败:`, error);
      
      // 失败时返回基础扩展版本
      return {
        ...entity,
        cachedAt: Date.now(),
        recentDataDetails: {
          conversations: [],
          webpages: [],
          resources: [],
          projects: [],
          people: [],
          topics: [],
          jiraTickets: [],
          cooccurringEntities: []
        },
        relatedParticipants: []
      };
    }
  }

  /**
   * 批量为实体补充详细信息
   */
  async enrichEntitiesWithDetails(entities: MemoryEntity[]): Promise<CachedEntityDetail[]> {
    const success = await this.initialize();
    if (!success) {
      throw new Error('记忆系统初始化失败');
    }
    
    const enrichedEntities: CachedEntityDetail[] = [];
    
    for (const entity of entities) {
      const enrichedEntity = await this.enrichEntityWithDetails(entity);
      enrichedEntities.push(enrichedEntity);
    }
    
    return enrichedEntities;
  }

  /**
   * 获取实体类型统计
   */
  async getEntityStatistics(): Promise<{
    entityCounts: Record<string, number>;
    totalEntities: number;
    totalRelationships: number;
    entitiesCreatedToday: number;
    entitiesCreatedThisWeek: number;
    entitiesCreatedThisMonth: number;
    topEntitiesByType: Record<string, MemoryEntity[]>;
  }> {
    const success = await this.initialize();
    if (!success) {
      throw new Error('记忆系统初始化失败');
    }
    return this.localStorage.getEntityStatistics();
  }

  /**
   * 获取实体类型信息列表
   */
  async getEntityTypes(): Promise<EntityTypeInfo[]> {
    try {
      const entityTypes: EntityTypeInfo[] = [];
      
      // 获取实体统计信息，包含各类型的数量
      const statistics = await this.getEntityStatistics();
      const entityCounts = statistics.entityCounts;
      
      // 遍历所有已知的实体类型
      for (const [type, count] of Object.entries(entityCounts)) {
        const config = ENTITY_TYPE_CONFIG[type];
        if (config) {
          entityTypes.push({
            type,
            name: config.name,
            icon: config.icon,
            count,
            description: config.description
          });
        } else {
          // 未知类型，使用默认配置
          entityTypes.push({
            type,
            name: type,
            icon: '📂',
            count,
            description: `自定义类型: ${type}`
          });
        }
      }
      
      // 按数量排序
      entityTypes.sort((a, b) => b.count - a.count);
      
      console.log(`📋 获取实体类型列表: ${entityTypes.length}个类型`);
      return entityTypes;
      
    } catch (error) {
      console.error('获取实体类型失败:', error);
      return [];
    }
  }

  /**
   * 搜索实体
   */
  async searchEntities(
    query: string,
    entityType?: string,
    options: QueryOptions = {}
  ): Promise<QueryResult<MemoryEntity>> {
    const success = await this.initialize();
    if (!success) {
      throw new Error('记忆系统初始化失败');
    }
    
    if (query.length > 2) {
      // 使用向量搜索 - 确保返回实体格式
      const vectorOptions: VectorSearchOptions = {
        ...options,
        returnType: 'entities',  // 确保返回实体格式
        sortBy: 'relevance'      // 默认按相关度排序
      };
      return this.searchByVector(query, entityType, vectorOptions);
    } else {
      // 使用普通查询
      return this.queryEntities(entityType, query, options);
    }
  }

  /**
   * 获取关系网络
   */
  async getRelationships(entityId: string, depth = 1): Promise<{
    entities: MemoryEntity[];
    relationships: GraphRelationship[];
  }> {
    const success = await this.initialize();
    if (!success) {
      throw new Error('记忆系统初始化失败');
    }
    return this.localStorage.getRelationshipNetwork(entityId, depth);
  }

  /**
   * 获取时间轴数据
   */
  async getTimeline(limit = 50): Promise<Array<{
    id: string;
    type: string;
    title: string;
    content: string;
    timestamp: number;
    source?: string;
    metadata?: any;
  }>> {
    const success = await this.initialize();
    if (!success) {
      throw new Error('记忆系统初始化失败');
    }
    return this.cloudStorage.getTimeline(limit);
  }

  /**
   * 查询实体相关的详细消息（包含contextMessages等完整数据）
   */
  async queryEntityMessages(entityName: string, options?: {
    limit?: number;
    timeRange?: { start: number; end: number };
    sortBy?: 'relevance' | 'time';
    sortOrder?: 'desc' | 'asc';
    minRelevanceScore?: number;
  }): Promise<Array<{
    messageId: string;
    content: string;
    source: string;
    timestamp: number;
    relevanceScore: number;
    metadata?: any;
  }>> {
    const success = await this.initialize();
    if (!success) {
      throw new Error('记忆系统初始化失败');
    }
    
    // 使用增强的 searchByVector 方法，专门搜索消息并返回原始数据格式
    const result = await this.cloudStorage.searchByVector(entityName, undefined, {
      collections: ['messages'], // 只搜索消息集合
      returnType: 'messages',         // 返回原始数据格式
      limit: options?.limit,
      sortBy: options?.sortBy,
      sortOrder: options?.sortOrder,
      timeRange: options?.timeRange,
      minRelevanceScore: options?.minRelevanceScore
    });
    
    return result.data || [];
  }

  // ==================== 🆕 高级查询接口 ====================

  /**
   * 🆕 通过关系查找相关实体
   * 例如：查找所有与 "alex" 相关的 Topic
   * 
   * @param targetName 目标实体名称，例如: "alex", "厦门"
   * @param targetType 目标实体类型
   * @param relatedType 要查找的相关实体类型
   * @param options 查询选项
   * @returns 相关实体列表，按相关度排序
   */
  async findRelatedEntitiesByName(
    targetName: string,
    targetType: 'Person' | 'Project' | 'Topic' | 'Organization',
    relatedType: 'Topic' | 'Project' | 'Person',
    options: {
      minRelevanceScore?: number;
      timeRange?: {start: number, end: number};
      limit?: number;
    } = {}
  ): Promise<MemoryEntity[]> {
    const success = await this.initialize();
    if (!success) {
      throw new Error('记忆系统初始化失败');
    }
    
    const { minRelevanceScore = 0.5, timeRange, limit = 20 } = options;
    
    console.log(`🔗 查找与 "${targetName}" (${targetType}) 相关的所有 ${relatedType}`);
    
    try {
      // Step 1: 获取所有目标类型的实体（使用分批查询避免内存问题）
      const batchSize = 50;
      let offset = 0;
      const relatedEntities: MemoryEntity[] = [];
      let hasMore = true;
      
      while (hasMore && relatedEntities.length < limit * 2) { // 查询足够多以应对过滤
        const batch = await this.cloudStorage.queryEntities(relatedType, undefined, {
          limit: batchSize,
          offset: offset
        });
        
        if (batch.data.length === 0) {
          hasMore = false;
          break;
        }
        
        // Step 2: 过滤出包含目标实体的实体
        for (const entity of batch.data) {
          let isRelated = false;
          let relationScore = 0;
          
          // 检查 relatedData 中是否包含目标实体
          if (targetType === 'Person' && entity.relatedData?.people) {
            const match = entity.relatedData.people.find(
              p => p.name.toLowerCase().includes(targetName.toLowerCase())
            );
            if (match) {
              isRelated = true;
              relationScore = match.relevanceScore || 0.5;
            }
          } else if (targetType === 'Project' && entity.relatedData?.projects) {
            const match = entity.relatedData.projects.find(
              p => p.name.toLowerCase().includes(targetName.toLowerCase())
            );
            if (match) {
              isRelated = true;
              relationScore = match.relevanceScore || 0.5;
            }
          } else if (targetType === 'Topic' && entity.relatedData?.topics) {
            const match = entity.relatedData.topics.find(
              t => t.name.toLowerCase().includes(targetName.toLowerCase())
            );
            if (match) {
              isRelated = true;
              relationScore = match.relevanceScore || 0.5;
            }
          }
          
          // 检查共现实体
          if (!isRelated && entity.relatedData?.cooccurringEntities) {
            const match = entity.relatedData.cooccurringEntities.find(
              e => e.name.toLowerCase().includes(targetName.toLowerCase())
            );
            if (match) {
              isRelated = true;
              relationScore = match.relevanceScore || 0.3;
            }
          }
          
          // 如果相关且满足条件，加入结果
          if (isRelated && relationScore >= minRelevanceScore) {
            // 时间过滤
            if (timeRange) {
              const entityTime = entity.updated || entity.created;
              if (entityTime < timeRange.start || entityTime > timeRange.end) {
                continue;
              }
            }
            
            // 添加关系分数
            entity.relevanceScore = relationScore;
            relatedEntities.push(entity);
          }
        }
        
        offset += batchSize;
      }
      
      // Step 3: 按相关度排序
      relatedEntities.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
      
      // Step 4: 限制结果数量
      const results = limit ? relatedEntities.slice(0, limit) : relatedEntities;
      
      console.log(`✅ 找到 ${results.length} 个相关 ${relatedType}`);
      
      return results;
    } catch (error) {
      console.error(`🚨 关系查询失败:`, error);
      return [];
    }
  }

  /**
   * 🆕 知识查询 - 智能路由的高级查询接口
   * 
   * 这个方法是记忆系统的智能查询入口，它会：
   * 1. 使用 LLM 分析用户问题，提取查询意图和实体
   * 2. 执行实体模糊匹配，找到数据库中的准确实体
   * 3. 并行搜索：实体 + 消息 + 关系扩展
   * 4. 智能融合结果，优先使用实体信息
   * 5. 使用 LLM 生成最终答案
   * 
   * @param question 用户的自然语言问题
   * @returns 查询结果，包含分析答案和相关上下文
   */
  async ask(question: string): Promise<{
    success: boolean;
    answer?: string;
    structuredAnswer?: {
      summary?: string;
      keyFindings?: string[];
      timeline?: Array<{ date: string; event: string }>;
      insights?: string[];
    };
    entitiesByType?: {
      topics: MemoryEntity[];
      people: MemoryEntity[];
      projects: MemoryEntity[];
      jiraTickets: MemoryEntity[];
      organizations: MemoryEntity[];
      documents: MemoryEntity[];
      technologies: MemoryEntity[];
    };
    metadata?: {
      totalEntities: number;
      expandDepth: number;
      processingTime: number;
      queryIntent?: any;
    };
    message?: string;
  }> {
    const startTime = Date.now();
    
    const success = await this.initialize();
    if (!success) {
      return {
        success: false,
        message: '记忆系统初始化失败'
      };
    }

    console.log('🌟 MemorySystem.ask:', question, Date.now());
    
    try {
      // Step 1: 使用 LLM 分析查询意图
      const queryIntent = await extractEntitiesForQuery(question);
      console.log('📊 查询意图:', queryIntent, Date.now());
      
      // Step 2: 时间范围处理和实体模糊匹配
      this.processTimeRange(queryIntent);
      await this.fuzzyMatchEntities(queryIntent);
      console.log('✅ 最终查询意图:', queryIntent);
      
      // Step 3: 🆕 混合检索策略 - 向量搜索实体
      let initialEntities: MemoryEntity[] = [];
      
      const hasEntities = queryIntent?.query?.filters?.entities && (
        queryIntent.query.filters.entities.people?.length > 0 ||
        queryIntent.query.filters.entities.projects?.length > 0 ||
        queryIntent.query.filters.entities.topics?.length > 0
      );
      
      if (hasEntities) {
        console.log('🔍 执行混合检索（向量 + 关系）...');
        
        // 方式A: 向量搜索各类实体
        const searchPromises: Promise<any>[] = [];
        
        if (queryIntent.query.filters.entities.topics?.length > 0) {
          searchPromises.push(
            this.searchByVector(question, 'Topic', {
              collections: ['entities'],
              limit: 10,
              minRelevanceScore: this.ASK_CONFIG.MIN_RELEVANCE_SCORE,
              returnType: 'entities'
            })
          );
        }
        
        if (queryIntent.query.filters.entities.people?.length > 0) {
          searchPromises.push(
            this.searchByVector(question, 'Person', {
              collections: ['entities'],
              limit: 5,
              minRelevanceScore: this.ASK_CONFIG.MIN_RELEVANCE_SCORE,
              returnType: 'entities'
            })
          );
        }
        
        if (queryIntent.query.filters.entities.projects?.length > 0) {
          searchPromises.push(
            this.searchByVector(question, 'Project', {
              collections: ['entities'],
              limit: 5,
              minRelevanceScore: this.ASK_CONFIG.MIN_RELEVANCE_SCORE,
              returnType: 'entities'
            })
          );
        }
        
        // 并行执行所有搜索
        const searchResults = await Promise.all(searchPromises);
        
        // 合并所有搜索结果
        for (const result of searchResults) {
          initialEntities.push(...result.data);
        }
        
        console.log(`✅ 混合检索完成: 找到 ${initialEntities.length} 个初始实体`);
      } else {
        // 如果没有提取到实体，直接进行向量搜索
        console.log('🔍 执行通用向量搜索...');
        const result = await this.searchByVector(question, undefined, {
          collections: ['entities'],
          limit: 15,
          minRelevanceScore: this.ASK_CONFIG.MIN_RELEVANCE_SCORE - 0.1,
          returnType: 'entities'
        });
        initialEntities = result.data;
        console.log(`✅ 通用搜索完成: 找到 ${initialEntities.length} 个实体`);
      }
      
      // Step 4: 🆕 动态多跳扩展
      console.log('🔄 开始多跳实体扩展...');
      const entityMap = await this.expandEntitiesMultiHop(initialEntities, queryIntent);
      const expandDepth = entityMap.size > initialEntities.length + 10 ? 2 : 1;
      console.log(`✅ 实体扩展完成: ${entityMap.size} 个实体 (${expandDepth}-hop)`);
      
      // Step 5: 构建增强上下文
      const context = await this.buildAskContext(entityMap, queryIntent);
      console.log(`📄 上下文构建完成: ${context.length} 字符`);
      
      // Step 6: LLM 推理 - 返回结构化 JSON
      const { handleLLMRequest } = await import('./llm');
      const prompt = this.buildAskPrompt(question, context);
      const llmResponse = await handleLLMRequest({ prompt });
      
      // Step 7: 解析 LLM 返回的 JSON
      let parsedResponse: any;
      try {
        // 尝试提取 JSON（可能被包裹在代码块中）
        const jsonMatch = llmResponse.match(/```json\s*([\s\S]*?)\s*```/);
        const jsonStr = jsonMatch ? jsonMatch[1] : llmResponse;
        parsedResponse = JSON.parse(jsonStr.trim());
      } catch (error) {
        console.warn('⚠️  LLM 返回格式解析失败，使用默认格式:', error);
        parsedResponse = {
          answer: llmResponse,
          relatedEntityIds: {
            topics: [],
            people: [],
            projects: [],
            jiraTickets: [],
            organizations: [],
            documents: [],
            technologies: []
          }
        };
      }
      
      // Step 8: 根据 LLM 返回的 ID 匹配完整实体
      const entitiesByType: any = {
        topics: [],
        people: [],
        projects: [],
        jiraTickets: [],
        organizations: [],
        documents: [],
        technologies: []
      };
      
      // 构建ID到实体的映射
      const idToEntity = new Map<string, MemoryEntity>();
      for (const entity of Array.from(entityMap.values())) {
        idToEntity.set(entity.id, entity);
      }
      
      // 匹配实体
      if (parsedResponse.relatedEntityIds) {
        for (const [typeKey, ids] of Object.entries(parsedResponse.relatedEntityIds)) {
          if (Array.isArray(ids)) {
            for (const id of ids) {
              const entity = idToEntity.get(id);
              if (entity) {
                entitiesByType[typeKey].push(entity);
              } else {
                console.warn(`⚠️  未找到实体 ID: ${id}`);
              }
            }
          }
        }
      }
      
      // Step 9: 按相关度排序并限制数量
      for (const typeKey of Object.keys(entitiesByType)) {
        entitiesByType[typeKey].sort((a: MemoryEntity, b: MemoryEntity) => 
          (b.relevanceScore || 0) - (a.relevanceScore || 0)
        );
        entitiesByType[typeKey] = entitiesByType[typeKey].slice(0, this.ASK_CONFIG.ENTITY_LIMIT_PER_TYPE);
      }
      
      const totalEntities = Object.values(entitiesByType)
        .reduce((sum: number, arr: any) => sum + arr.length, 0);
      
      const processingTime = Date.now() - startTime;
      console.log(`✅ ask() 完成: ${totalEntities} 个相关实体, 耗时 ${processingTime}ms`);
      
      return {
        success: true,
        answer: parsedResponse.answer,
        structuredAnswer: parsedResponse.structuredAnswer,
        entitiesByType,
        metadata: {
          totalEntities: totalEntities as number,
          expandDepth,
          processingTime,
          queryIntent
        }
      };
      
    } catch (error) {
      console.error('💥 智能查询失败:', error);
      return {
        success: false,
        message: '查询时发生错误，请稍后再试。'
      };
    }
  }

  /**
   * @deprecated 请使用 ask() 方法代替
   * 
   * 🆕 高级知识查询接口（兼容旧接口）
   * 
   * 这个方法是记忆系统的智能查询入口，它会：
   * 1. 使用 LLM 分析用户问题，提取查询意图和实体
   * 2. 执行实体模糊匹配，找到数据库中的准确实体
   * 3. 并行搜索：实体 + 消息 + 关系扩展
   * 4. 智能融合结果，优先使用实体信息
   * 5. 使用 LLM 生成最终答案
   * 
   * @param question 用户的自然语言问题
   * @returns 查询结果，包含分析答案和相关上下文
   */
  async knowledgeQuery(question: string): Promise<{
    success: boolean;
    analysis?: string;
    relatedMessages?: number;
    queryIntent?: any;
    results?: any[];
    message?: string;
  }> {
    const success = await this.initialize();
    if (!success) {
      throw new Error('记忆系统初始化失败');
    }

    console.log('🔍 MemorySystem.knowledgeQuery:', question, Date.now());
    
    try {
      // 导入必要的函数
      const { extractEntitiesForQuery } = await import('./services/entityExtraction');
      const { handleLLMRequest } = await import('./llm');
      
      // Step 1: 使用 LLM 分析查询意图
      const queryIntent = await extractEntitiesForQuery(question);
      console.log('📊 查询意图:', queryIntent, Date.now());
      
      // Step 2: 时间范围处理（与原来的 knowledgeQuery 逻辑相同）
      this.processTimeRange(queryIntent);
      
      // Step 3: 实体模糊匹配
      await this.fuzzyMatchEntities(queryIntent);
      
      console.log('✅ 最终查询意图:', queryIntent);
      
      // Step 4: 🆕 并行搜索：实体 + 消息
      let entityResults: MemoryEntity[] = [];
      let messageResults: any = null;
      
      const hasEntities = queryIntent?.query?.filters?.entities && (
        queryIntent.query.filters.entities.people?.length > 0 ||
        queryIntent.query.filters.entities.projects?.length > 0 ||
        queryIntent.query.filters.entities.topics?.length > 0
      );
      
      if (hasEntities) {
        console.log('🔍 尝试直接搜索 Topic 实体...');
        
        // 🆕 方式A: 向量搜索 Topic 实体
        const topicSearchResult = await this.searchByVector(
          question,
          'Topic',
          {
            collections: ['entities'],
            limit: 5,
            minRelevanceScore: 0.6,
            returnType: 'entities'
          }
        );
        
        // 🆕 方式B: 关系扩展查询
        const relationResults: MemoryEntity[] = [];
        
        // 如果查询中包含人物，通过关系查找相关Topic
        if (queryIntent.query.filters.entities.people?.length > 0) {
          const personName = queryIntent.query.filters.entities.people[0].name;
          console.log(`🔗 通过关系查找 ${personName} 相关的 Topic...`);
          
          const timeRange = queryIntent.query.filters.time_range && 
                          queryIntent.query.filters.time_range.start && 
                          queryIntent.query.filters.time_range.end
            ? {
                start: queryIntent.query.filters.time_range.start,
                end: queryIntent.query.filters.time_range.end
              }
            : undefined;
          
          const relatedTopics = await this.findRelatedEntitiesByName(
            personName,
            'Person',
            'Topic',
            {
              timeRange,
              minRelevanceScore: 0.5,
              limit: 5
            }
          );
          
          console.log(`  找到 ${relatedTopics.length} 个通过关系找到的Topic`);
          relationResults.push(...relatedTopics);
        }
        
        // 🆕 合并向量搜索和关系查询的结果
        const allTopics = [...topicSearchResult.data];
        
        // 去重合并（基于ID）
        const topicIds = new Set(allTopics.map(t => t.id));
        for (const topic of relationResults) {
          if (!topicIds.has(topic.id)) {
            allTopics.push(topic);
            topicIds.add(topic.id);
          }
        }
        
        // 按相关度重新排序
        allTopics.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
        
        entityResults = allTopics.slice(0, 5); // 取前5个
        console.log(`✅ 最终找到 ${entityResults.length} 个Topic实体`);
      }
      
      // Step 5: 搜索相关消息
      const filters: any = {};
      if (queryIntent?.query?.filters) {
        if (queryIntent.query.filters.entities) {
          filters.entities = queryIntent.query.filters.entities;
        }
        if (queryIntent.query.filters.time_range) {
          filters.time_range = queryIntent.query.filters.time_range;
        }
      }
      
      const output = queryIntent?.query?.output || {
        format: "list",
        limit: 20,
        sort: { field: "timestamp", order: "desc" as const }
      };
      
      try {
        const timeRange = filters.time_range && filters.time_range.start && filters.time_range.end
          ? { start: filters.time_range.start, end: filters.time_range.end }
          : undefined;
        
        const messages = await this.cloudStorage.getSimilarMessages(question, {
          limit: output.limit || 20,
          minRelevanceScore: 0.3,
          timeRange,
          sortBy: output.sort?.field === 'timestamp' ? 'time' : 'relevance',
          sortOrder: output.sort?.order || 'desc',
          filters: {
            entities: filters.entities
          }
        });
        
        messageResults = {
          question: question,
          results: {
            ids: messages.map(m => m.id),
            documents: messages.map(m => m.content),
            metadatas: messages.map(m => ({
              sender: m.sender,
              source: m.sender,
              groupName: m.groupName,
              groupUrl: m.groupUrl,
              datetime: m.datetime,
              summary: m.summary,
              matchedRules: m.matchedRules,
              contextMessages: m.contextMessages
            })),
            distances: messages.map(m => 1 - (m.relevanceScore || 0))
          }
        };
      } catch (error) {
        console.error('💥 消息查询失败:', error);
        messageResults = {
          question: question,
          results: { ids: [], documents: [], metadatas: [], distances: [] }
        };
      }
      
      // Step 6: 🆕 智能融合结果
      const contextSources = await this.buildContextFromResults(entityResults, messageResults);
      
      if (contextSources.length === 0) {
        return {
          success: false,
          message: `没有找到关于"${question}"的相关信息。`
        };
      }
      
      // Step 7: 构建 LLM prompt 并生成答案
      const prompt = this.buildLLMPrompt(question, contextSources, queryIntent);
      const llmResponse = await handleLLMRequest({ prompt });
      
      // Step 8: 返回结果
      return {
        success: true,
        analysis: llmResponse,
        relatedMessages: messageResults?.results?.documents?.length || 0,
        queryIntent: queryIntent,
        results: this.formatResults(messageResults?.results)
      };
      
    } catch (error) {
      console.error('💥 知识查询失败:', error);
      return {
        success: false,
        message: '查询时发生错误，请稍后再试。'
      };
    }
  }

  // ==================== 私有辅助方法 ====================

  /**
   * 处理时间范围
   */
  private processTimeRange(queryIntent: any): void {
    if (!queryIntent?.query?.filters?.time_range) return;
    
    const timeRange = queryIntent.query.filters.time_range;
    
    // 处理时间疑问词
    if (timeRange.type === 'specific' && typeof timeRange.start === 'string') {
      const timeQuestionWords = ["什么时候", "何时", "几点", "哪天", "什么日期", "什么时间", "几号", "什么时段", "几月", "哪一天", "什么季节"];
      
      if (timeQuestionWords.some(word => timeRange.start.includes(word))) {
        console.log(`检测到时间疑问词: "${timeRange.start}"，将time_range.type设为"all"`);
        timeRange.type = "all";
        timeRange.start = null;
        timeRange.end = null;
        return;
      }
    }
    
    // 根据时间描述设置具体的时间范围
    if (timeRange.type === 'range' && timeRange.description) {
      const now = new Date();
      const thisYear = now.getFullYear();
      const thisMonth = now.getMonth();
      
      if (/今年|本年|今年度|本年度/.test(timeRange.description)) {
        const startOfYear = new Date(thisYear, 0, 1).getTime();
        timeRange.start = startOfYear;
        timeRange.end = now.getTime();
      } else if (/这个月|本月|当月/.test(timeRange.description)) {
        const startOfMonth = new Date(thisYear, thisMonth, 1).getTime();
        timeRange.start = startOfMonth;
        timeRange.end = now.getTime();
      } else if (/过去(\d+)天|最近(\d+)天/.test(timeRange.description)) {
        const matches = timeRange.description.match(/过去(\d+)天|最近(\d+)天/);
        if (matches) {
          const days = parseInt(matches[1] || matches[2]);
          if (!isNaN(days)) {
            timeRange.start = now.getTime() - (days * 24 * 60 * 60 * 1000);
            timeRange.end = now.getTime();
          }
        }
      }
    }
    
    // 如果是recent类型，设置默认为过去7天
    if (timeRange.type === 'recent') {
      const now = new Date();
      timeRange.start = now.getTime() - (7 * 24 * 60 * 60 * 1000);
      timeRange.end = now.getTime();
    }
  }

  /**
   * 实体模糊匹配
   */
  private async fuzzyMatchEntities(queryIntent: any): Promise<void> {
    // 导入模糊匹配函数
    const fuzzyMatchPerson = (name: string, knownPeople: string[]): string | null => {
      const normalizedName = name.toLowerCase().trim();
      for (const knownName of knownPeople) {
        if (knownName.toLowerCase().includes(normalizedName) || 
            normalizedName.includes(knownName.toLowerCase())) {
          return knownName;
        }
      }
      return null;
    };
    
    const fuzzyMatchEntityName = (name: string, knownNames: string[]): string | null => {
      return fuzzyMatchPerson(name, knownNames);
    };
    
    // 获取所有已知实体
    const [knownPeople, knownProjects, knownTopics] = await Promise.all([
      this.cloudStorage.getAllKnownPeople(),
      this.cloudStorage.getAllKnownProjects(),
      this.cloudStorage.getAllKnownTopics()
    ]);
    
    console.log('📋 已知实体:', {
      people: knownPeople.length,
      projects: knownProjects.length,
      topics: knownTopics.length
    });
    
    // 人名模糊匹配
    if (queryIntent?.query?.filters?.entities?.people?.length > 0) {
      const matchedPeople = [];
      for (const person of queryIntent.query.filters.entities.people) {
        const matchedPerson = fuzzyMatchPerson(person.name, knownPeople);
        if (matchedPerson) {
          console.log(`人名匹配: "${person.name}" => "${matchedPerson}"`);
          matchedPeople.push({ ...person, name: matchedPerson });
        } else {
          matchedPeople.push(person);
        }
      }
      queryIntent.query.filters.entities.people = matchedPeople;
    }
    
    // 项目和主题模糊匹配
    if (queryIntent?.query?.filters?.entities?.projects?.length > 0) {
      const matchedProjects = [];
      for (const project of queryIntent.query.filters.entities.projects) {
        const matchedName = fuzzyMatchEntityName(project.name, knownProjects);
        if (matchedName) {
          console.log(`项目匹配: "${project.name}" => "${matchedName}"`);
          matchedProjects.push({ ...project, name: matchedName });
        } else {
          matchedProjects.push(project);
        }
      }
      queryIntent.query.filters.entities.projects = matchedProjects;
    }
    
    if (queryIntent?.query?.filters?.entities?.topics?.length > 0) {
      const matchedTopics = [];
      for (const topic of queryIntent.query.filters.entities.topics) {
        const matchedName = fuzzyMatchEntityName(topic.name, knownTopics);
        if (matchedName) {
          console.log(`主题匹配: "${topic.name}" => "${matchedName}"`);
          matchedTopics.push({ ...topic, name: matchedName });
        } else {
          matchedTopics.push(topic);
        }
      }
      queryIntent.query.filters.entities.topics = matchedTopics;
    }
  }

  /**
   * 从实体和消息结果构建上下文
   */
  private async buildContextFromResults(
    entityResults: MemoryEntity[],
    messageResults: any
  ): Promise<Array<{type: string, priority: number, content: string, relevanceScore: number}>> {
    const contextSources: Array<{type: string, priority: number, content: string, relevanceScore: number}> = [];
    
    // 🆕 优先使用 Topic 实体信息
    if (entityResults && entityResults.length > 0) {
      console.log('🎯 使用 Topic 实体作为主要上下文');
      
      for (const entity of entityResults) {
        let entityContext = `### Topic: ${entity.name}\n`;
        
        if (entity.description) {
          entityContext += `描述: ${entity.description}\n`;
        }
        
        // 🔑 从 relatedData 中提取信息
        if (entity.relatedData) {
          if (entity.relatedData.people && entity.relatedData.people.length > 0) {
            const peopleNames = entity.relatedData.people.map(p => p.name).join(', ');
            entityContext += `相关人员: ${peopleNames}\n`;
          }
          
          if (entity.relatedData.projects && entity.relatedData.projects.length > 0) {
            const projectNames = entity.relatedData.projects.map(p => p.name).join(', ');
            entityContext += `相关项目: ${projectNames}\n`;
          }
          
          // 🔑 最近的对话记录（前3条）
          if (entity.relatedData.conversations && entity.relatedData.conversations.length > 0) {
            entityContext += `\n最近讨论:\n`;
            entity.relatedData.conversations.slice(0, 3).forEach((conv, idx) => {
              entityContext += `  ${idx + 1}. [${conv.sender}] ${conv.summary}\n`;
              entityContext += `     时间: ${conv.datetime}\n`;
            });
          }
        }
        
        contextSources.push({
          type: 'topic_entity',
          priority: 1,
          content: entityContext,
          relevanceScore: entity.relevanceScore || 0
        });
      }
    }
    
    // 添加消息上下文
    if (messageResults?.results?.documents && messageResults.results.documents.length > 0) {
      for (let i = 0; i < messageResults.results.documents.length; i++) {
        const doc = messageResults.results.documents[i];
        const metadata = messageResults.results.metadatas[i];
        const distance = messageResults.results.distances[i] || 0;
        const relevanceScore = Math.max(0, 1 - distance);
        
        contextSources.push({
          type: 'message',
          priority: 2,
          content: `### 消息记录\n${doc}\n时间: ${metadata?.datetime || '未知'}\n发送者: ${metadata?.source || '未知'}`,
          relevanceScore
        });
      }
    }
    
    // 按优先级和相关度排序
    contextSources.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return b.relevanceScore - a.relevanceScore;
    });
    
    return contextSources;
  }

  /**
   * 构建 LLM prompt
   */
  private buildLLMPrompt(
    question: string,
    contextSources: Array<{type: string, priority: number, content: string, relevanceScore: number}>,
    queryIntent: any
  ): string {
    // 构建上下文（限制总长度）
    const MAX_CONTEXT_LENGTH = 4000;
    let messagesContext = '';
    let currentLength = 0;
    
    for (const source of contextSources) {
      if (currentLength + source.content.length <= MAX_CONTEXT_LENGTH) {
        messagesContext += source.content + '\n\n---\n\n';
        currentLength += source.content.length;
      } else {
        break;
      }
    }
    
    console.log(`📊 上下文统计: 共${contextSources.length}个来源，使用了${messagesContext.length}字符`);
    
    // 根据查询类型选择模板
    const promptTemplate = `
以下是与问题"${question}"相关的信息:
{{context}}

请基于以上信息提供详细回答。仅使用提供的信息,不要添加额外知识。
如果信息不足,请明确指出。
    `;
    
    return promptTemplate.replace('{{context}}', messagesContext);
  }

  /**
   * 格式化结果
   */
  private formatResults(results: any): any[] {
    if (!results || !results.documents) return [];
    
    return results.documents.map((doc: string, idx: number) => {
      const metadata = results.metadatas[idx] as Record<string, any>;
      const id = String(results.ids[idx]);
      const relevance = Math.max(0, 1 - results.distances[idx]);
      
      return {
        id: id,
        summary: String(metadata.summary) || doc.substring(0, 100) + '...',
        details: String(metadata.details || doc),
        timestamp: metadata.datetime || new Date().toISOString(),
        source: String(metadata.source),
        relevance: relevance,
        tags: metadata.tags || []
      };
    });
  }

  // ==================== ask() 专用辅助方法 ====================

  /**
   * 从 relatedData 中提取关联实体的 ID
   */
  private extractRelatedEntityIds(relatedData: any, minScore: number): Set<string> {
    const ids = new Set<string>();
    
    if (!relatedData) return ids;
    
    // 提取 people
    if (relatedData.people && Array.isArray(relatedData.people)) {
      for (const item of relatedData.people) {
        if (item.id && (item.relevanceScore || 0) >= minScore) {
          ids.add(item.id);
        }
      }
    }
    
    // 提取 projects
    if (relatedData.projects && Array.isArray(relatedData.projects)) {
      for (const item of relatedData.projects) {
        if (item.id && (item.relevanceScore || 0) >= minScore) {
          ids.add(item.id);
        }
      }
    }
    
    // 提取 topics
    if (relatedData.topics && Array.isArray(relatedData.topics)) {
      for (const item of relatedData.topics) {
        if (item.id && (item.relevanceScore || 0) >= minScore) {
          ids.add(item.id);
        }
      }
    }
    
    // 提取 jiraTickets
    if (relatedData.jiraTickets && Array.isArray(relatedData.jiraTickets)) {
      for (const item of relatedData.jiraTickets) {
        if (item.id && (item.relevanceScore || 0) >= minScore) {
          ids.add(item.id);
        }
      }
    }
    
    // 提取 cooccurringEntities
    if (relatedData.cooccurringEntities && Array.isArray(relatedData.cooccurringEntities)) {
      for (const item of relatedData.cooccurringEntities) {
        if (item.id && (item.relevanceScore || 0) >= minScore) {
          ids.add(item.id);
        }
      }
    }
    
    return ids;
  }

  /**
   * 从实体的 relatedData 中提取并加载关联实体
   */
  private async expandRelatedData(
    entities: MemoryEntity[],
    entityMap: Map<string, MemoryEntity>,
    is2Hop = false
  ): Promise<Set<string>> {
    const newEntityIds = new Set<string>();
    const minScore = is2Hop ? this.ASK_CONFIG.MIN_2HOP_RELEVANCE : this.ASK_CONFIG.MIN_RELEVANCE_SCORE;
    
    for (const entity of entities) {
      if (!entity.relatedData) continue;
      
      // 提取所有关联实体 ID
      const relatedIds = this.extractRelatedEntityIds(entity.relatedData, minScore);
      
      for (const id of Array.from(relatedIds)) {
        if (!entityMap.has(id)) {
          newEntityIds.add(id);
        }
      }
    }
    
    // 批量加载新实体
    if (newEntityIds.size > 0) {
      console.log(`  🔍 发现 ${newEntityIds.size} 个新的关联实体`);
      const newEntities = await this.cloudStorage.getEntitiesByIds(Array.from(newEntityIds));
      for (const entity of newEntities) {
        entityMap.set(entity.id, entity);
      }
    }
    
    return newEntityIds;
  }

  /**
   * 判断是否需要进行 2-hop 扩展
   */
  private shouldPerform2Hop(currentSize: number, initialEntities: MemoryEntity[]): boolean {
    // 如果初始实体数量就很多，不需要 2-hop
    if (initialEntities.length >= 10) {
      console.log('  ℹ️  初始实体充足，跳过 2-hop');
      return false;
    }
    
    // 如果 1-hop 后实体数量少于阈值，触发 2-hop
    if (currentSize < this.ASK_CONFIG.ENABLE_2HOP_THRESHOLD) {
      console.log('  ⚠️  1-hop 结果不足，触发 2-hop 扩展');
      return true;
    }
    
    return false;
  }

  /**
   * 多跳实体扩展
   * 从初始实体集合出发，动态决定是否进行 2-hop 扩展
   */
  private async expandEntitiesMultiHop(
    initialEntities: MemoryEntity[],
    queryIntent: any
  ): Promise<Map<string, MemoryEntity>> {
    const entityMap = new Map<string, MemoryEntity>();
    
    // 1-hop: 添加初始实体
    console.log(`🌱 初始实体: ${initialEntities.length} 个`);
    for (const entity of initialEntities) {
      entityMap.set(entity.id, entity);
    }
    
    // 1-hop: 扩展 relatedData 中的关联实体
    await this.expandRelatedData(initialEntities, entityMap);
    console.log(`✅ 1-hop 扩展完成: ${entityMap.size} 个实体`);
    
    // 🔍 动态决策：是否需要 2-hop
    const need2Hop = this.shouldPerform2Hop(entityMap.size, initialEntities);
    
    if (need2Hop) {
      console.log('🔄 触发 2-hop 扩展...');
      await this.expandRelatedData(Array.from(entityMap.values()), entityMap, true);
      console.log(`✅ 2-hop 扩展完成: ${entityMap.size} 个实体`);
    }
    
    return entityMap;
  }

  /**
   * 按类型分组实体
   */
  private groupEntitiesByType(entities: MemoryEntity[]): Record<string, MemoryEntity[]> {
    const grouped: Record<string, MemoryEntity[]> = {
      Topic: [],
      Person: [],
      Project: [],
      Task: [],
      Organization: [],
      Document: [],
      Technology: []
    };
    
    for (const entity of entities) {
      if (grouped[entity.type]) {
        grouped[entity.type].push(entity);
      }
    }
    
    return grouped;
  }

  /**
   * 构建实体上下文字符串
   */
  private buildEntityContext(entitiesByType: Record<string, MemoryEntity[]>): string {
    let context = '# 知识库实体信息\n\n';
    
    // 按类型构建上下文
    const typeNames: Record<string, string> = {
      Topic: '主题',
      Person: '人员',
      Project: '项目',
      Task: 'Jira任务',
      Organization: '组织',
      Document: '文档',
      Technology: '技术'
    };
    
    for (const [type, entities] of Object.entries(entitiesByType)) {
      if (entities.length === 0) continue;
      
      context += `## ${typeNames[type] || type} (${entities.length}个)\n\n`;
      
      for (const entity of entities) {
        context += `### [${entity.type}] ${entity.name} (ID: ${entity.id})\n`;
        
        if (entity.description) {
          context += `**描述**: ${entity.description}\n`;
        }
        
        // 添加重要性和相关度
        if (entity.importance) {
          context += `**重要性**: ${(entity.importance * 100).toFixed(0)}%\n`;
        }
        if (entity.relevanceScore) {
          context += `**相关度**: ${(entity.relevanceScore * 100).toFixed(0)}%\n`;
        }
        
        // 添加关联信息摘要
        if (entity.relatedData) {
          const summaryParts = [];
          if (entity.relatedData.people?.length > 0) {
            summaryParts.push(`${entity.relatedData.people.length}个相关人员`);
          }
          if (entity.relatedData.projects?.length > 0) {
            summaryParts.push(`${entity.relatedData.projects.length}个相关项目`);
          }
          if (entity.relatedData.conversations?.length > 0) {
            summaryParts.push(`${entity.relatedData.conversations.length}条相关对话`);
          }
          if (summaryParts.length > 0) {
            context += `**关联**: ${summaryParts.join(', ')}\n`;
          }
          
          // 添加最近的对话摘要（最多3条）
          if (entity.relatedData.conversations && entity.relatedData.conversations.length > 0) {
            context += `**最近讨论**:\n`;
            entity.relatedData.conversations.slice(0, 3).forEach((conv, idx) => {
              context += `  ${idx + 1}. [${conv.sender}] ${conv.summary} (${conv.datetime})\n`;
            });
          }
        }
        
        context += '\n';
      }
    }
    
    return context;
  }

  /**
   * 智能压缩上下文
   * 当上下文超出限制时，优先保留高相关度实体
   */
  private compressContext(context: string, entitiesByType: Record<string, MemoryEntity[]>): string {
    console.log(`⚠️  上下文过长 (${context.length} 字符)，进行压缩...`);
    
    // 按相关度重新排序所有实体
    const allEntities: MemoryEntity[] = [];
    for (const entities of Object.values(entitiesByType)) {
      allEntities.push(...entities);
    }
    allEntities.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
    
    // 只保留最相关的实体，直到达到长度限制
    const targetLength = Math.floor(this.ASK_CONFIG.MAX_CONTEXT_LENGTH * this.ASK_CONFIG.CONTEXT_COMPRESSION_RATIO);
    const compressedEntitiesByType = this.groupEntitiesByType([]);
    
    let currentLength = 0;
    for (const entity of allEntities) {
      const entityText = this.buildEntityContext({[entity.type]: [entity]});
      if (currentLength + entityText.length <= targetLength) {
        compressedEntitiesByType[entity.type].push(entity);
        currentLength += entityText.length;
      } else {
        break;
      }
    }
    
    const compressedContext = this.buildEntityContext(compressedEntitiesByType);
    console.log(`✂️  压缩完成: ${context.length} → ${compressedContext.length} 字符`);
    
    return compressedContext;
  }

  /**
   * 构建增强型上下文
   * 包含实体摘要、关系网络、对话记录等
   */
  private async buildAskContext(
    entities: Map<string, MemoryEntity>,
    queryIntent: any
  ): Promise<string> {
    // 1. 按相关度排序所有实体
    const sortedEntities = Array.from(entities.values())
      .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
    
    console.log(`📝 构建上下文: ${sortedEntities.length} 个实体`);
    
    // 2. 按类型分组
    const entitiesByType = this.groupEntitiesByType(sortedEntities);
    
    // 3. 构建分层上下文
    let context = this.buildEntityContext(entitiesByType);
    
    // 4. 如果超出限制，进行智能压缩
    if (context.length > this.ASK_CONFIG.MAX_CONTEXT_LENGTH) {
      context = this.compressContext(context, entitiesByType);
    }
    
    return context;
  }

  /**
   * 构建 ask() 的 LLM prompt
   * 要求 LLM 返回结构化 JSON 格式
   */
  private buildAskPrompt(question: string, context: string): string {
    return `你是一个智能知识助手，基于提供的知识库信息回答用户问题。

# 知识库上下文

${context}

# 用户问题

${question}

# 任务要求

1. 基于上述知识库信息，准确回答用户的问题
2. 如果信息不足以完整回答，请明确说明
3. 列出与问题最相关的实体 ID（从上述知识库中提取）
4. 提供结构化的分析结果，包括关键发现、时间线和深度洞察

# 返回格式

请以 JSON 格式返回，包含以下字段：

\`\`\`json
{
  "answer": "详细的主要答案文本（必填，至少100字的完整回答）",
  "structuredAnswer": {
    "summary": "简要总结（1-2句话概括核心要点）",
    "keyFindings": [
      "关键发现1：具体的发现或结论",
      "关键发现2：重要的信息点"
    ],
    "timeline": [
      {"date": "相对时间描述（如：2小时前、昨天）", "event": "发生的事件描述"},
      {"date": "时间", "event": "事件"}
    ],
    "insights": [
      "深度洞察1：基于数据的分析和见解",
      "深度洞察2：趋势、模式或建议"
    ]
  },
  "relatedEntityIds": {
    "topics": ["topic_id_1", "topic_id_2"],
    "people": ["person_id_1"],
    "projects": ["project_id_1"],
    "jiraTickets": [],
    "organizations": [],
    "documents": [],
    "technologies": []
  }
}
\`\`\`

注意：
- answer 必须是完整、连贯的主要回答（这是用户最先看到的内容）
- structuredAnswer 是可选的增强信息，只在有足够信息时提供
  - summary: 用一两句话概括核心要点
  - keyFindings: 提炼2-5个关键发现，每个发现要具体明确
  - timeline: 如果问题涉及时间相关的事件，提供时间线（可选）
  - insights: 提供2-4个深度洞察，包括趋势分析、模式识别或可行建议
- relatedEntityIds 只包含与答案直接相关的实体 ID（必须是上述知识库中存在的ID）
- 如果某个类型没有相关实体，使用空数组 []
- 请确保返回的是有效的 JSON 格式`;
  }

  // ==================== 存储接口 ====================

  /**
   * 存储实体（先云端后本地）
   */
  async storeEntity(entity: Omit<MemoryEntity, 'id' | 'created' | 'updated'>): Promise<StoreResult> {
    const success = await this.initialize();
    if (!success) {
      throw new Error('记忆系统初始化失败');
    }

    const startTime = Date.now();
    
    const result: StoreResult = {
      success: false,
      entityId: '',
      cloudStored: false,
      localCached: false,
      relationshipsCreated: 0,
      processingTime: 0,
      errors: []
    };

    try {
      // 构建完整实体
      const fullEntity: MemoryEntity = {
        ...entity,
        id: '',
        created: Date.now(),
        updated: Date.now(),
        accessCount: 0,
        lastAccessed: Date.now()
      };

      // 1. 先存储到云端
      let attempts = 0;
      while (attempts < this.config.retryAttempts) {
        try {
          const entityId = await this.cloudStorage.storeEntity(fullEntity as any);
          if (entityId) {
            fullEntity.id = entityId;
            result.entityId = entityId;
            result.cloudStored = true;
            break;
          }
        } catch (error) {
          console.warn(`云端存储尝试 ${attempts + 1} 失败:`, error);
          if (attempts < this.config.retryAttempts - 1) {
            await this.delay(this.config.retryDelay * (attempts + 1));
          }
        }
        attempts++;
      }

      // 2. 更新本地缓存
      try {
        await this.localStorage.cacheEntity(fullEntity);
        result.localCached = true;
      } catch (error) {
        console.warn('本地缓存失败:', error);
        result.errors?.push('本地缓存失败');
      }

      // 确定成功条件
      if (this.config.requireCloudSuccess) {
        result.success = result.cloudStored && result.localCached;
      } else {
        result.success = result.cloudStored || result.localCached;
      }

      result.processingTime = Date.now() - startTime;

      console.log(`💾 实体存储完成: ${result.entityId || fullEntity.id}`, {
        cloudStored: result.cloudStored,
        localCached: result.localCached,
        success: result.success
      });

      return result;

    } catch (error) {
      console.error('存储实体失败:', error);
      result.errors?.push(error.message);
      result.processingTime = Date.now() - startTime;
      return result;
    }
  }

  /**
   * 存储消息（先云端后本地）- 🆕 统一接口，包含实体关联数据处理
   */
  async storeMessage(messageData: {
    id: string;
    content: string;
    metadata: Omit<MemoryMessage, 'id' | 'content'>;
  }): Promise<StoreResult> {
    const success = await this.initialize();
    if (!success) {
      throw new Error('记忆系统初始化失败');
    }

    const startTime = Date.now();
    const result: StoreResult = {
      success: false,
      entityId: messageData.id,
      cloudStored: false,
      localCached: false,
      relationshipsCreated: 0,
      processingTime: 0,
      errors: []
    };

    try {
      // 1. 存储消息到云端（实体数据已包含在metadata中）
      const cloudSuccess = await this.cloudStorage.storeMessage(messageData);
      result.cloudStored = cloudSuccess;

      // 2. 🆕 更新实体关联数据（从metadata中提取实体并更新关联信息）
      if (result.cloudStored) {
        try {
          await this.cloudStorage.updateEntitiesWithRelatedData(
            messageData.metadata,
            messageData.id
          );
          console.log(`🔗 实体关联数据更新完成: ${messageData.id}`);
        } catch (entityError) {
          console.error('🚨 更新实体关联数据失败:', entityError);
          result.errors?.push(`Entity update failed: ${entityError.message}`);
          // 不影响整体存储成功状态，仅记录错误
        }
      }

      result.success = result.cloudStored;
      result.processingTime = Date.now() - startTime;

      // 3. 同时更新用户画像
      if (result.success && this.userProfileManager && messageData.metadata?.entities) {
        try {
          // 将实体对象转换为数组格式
          const entitiesArray = this.cloudStorage.extractEntitiesFromMetadata(messageData.metadata, messageData.id);
          if (entitiesArray.length > 0) {
            // 根据消息匹配规则智能推断actionType
            const actionType = this.inferActionTypeFromMessageData(messageData);
            
            await this.updateUserProfileFromEntities(entitiesArray, {
              actionType,
              timestamp: Date.now(),
              context: 'message_analysis',
              metadata: {
                messageId: messageData.id,
                sender: messageData.metadata?.sender || 'unknown',
                matchedRules: messageData.metadata?.matchedRules,
                groupName: messageData.metadata?.groupName
              }
            });
          }
        } catch (profileError) {
          console.error('⚠️ 更新用户画像失败:', profileError);
          result.errors?.push(`Profile update failed: ${profileError.message}`);
          // 不影响整体存储成功状态，仅记录错误
        }
      }

      console.log(`✅ 消息完整存储完成: ${messageData.id}, 成功: ${result.success ? '✅' : '❌'}, 处理时间: ${result.processingTime}ms`);
      return result;

    } catch (error) {
      console.error('存储消息失败:', error);
      result.errors?.push(error.message);
      result.processingTime = Date.now() - startTime;
      return result;
    }
  }

  /**
   * 存储网页数据
   */
  async storeWebpage(webpageData: {
    id: string;
    url: string;
    title: string;
    content: string;
    metadata: any;
    entities?: Array<Omit<MemoryEntity, 'id' | 'created' | 'updated'>>;
  }): Promise<StoreResult> {
    const success = await this.initialize();
    if (!success) {
      throw new Error('记忆系统初始化失败');
    }

    const startTime = Date.now();
    const result: StoreResult = {
      success: false,
      entityId: webpageData.id,
      cloudStored: false,
      localCached: false,
      relationshipsCreated: 0,
      processingTime: 0,
      errors: []
    };

    try {
      // 1. 存储网页到云端
      const cloudSuccess = await this.cloudStorage.storeWebpage(webpageData);
      result.cloudStored = cloudSuccess;

      // 2. 处理实体（如果有）
      if (webpageData.entities && webpageData.entities.length > 0) {
        for (const entityData of webpageData.entities) {
          const entityResult = await this.storeEntity(entityData);
          if (entityResult.success) {
            result.relationshipsCreated++;
            
            // 更新相关实体的最近数据缓存
            await this.localStorage.updateRecentData(
              entityResult.entityId,
              'webpage',
              {
                id: webpageData.id,
                title: webpageData.title,
                url: webpageData.url,
                summary: webpageData.content.substring(0, 200),
                visitTime: Date.now(),
                domain: new URL(webpageData.url).hostname
              }
            );
          }
        }
      }

      result.success = result.cloudStored;
      result.processingTime = Date.now() - startTime;

      // 同时更新用户画像
      if (result.success && this.userProfileManager && webpageData.entities) {
        await this.updateUserProfileFromEntities(webpageData.entities, {
          actionType: 'view',
          timestamp: Date.now(),
          context: 'webpage_analysis',
          metadata: {
            webpageId: webpageData.id,
            url: webpageData.url,
            title: webpageData.title,
            domain: new URL(webpageData.url).hostname
          }
        });
      }

      return result;

    } catch (error) {
      console.error('存储网页失败:', error);
      result.errors?.push(error.message);
      result.processingTime = Date.now() - startTime;
      return result;
    }
  }

  /**
   * 更新实体（同步更新本地和云端）
   */
  async updateEntity(entityId: string, updates: Partial<MemoryEntity>): Promise<StoreResult> {
    const success = await this.initialize();
    if (!success) {
      throw new Error('记忆系统初始化失败');
    }

    const startTime = Date.now();
    const result: StoreResult = {
      success: false,
      entityId,
      cloudStored: false,
      localCached: false,
      relationshipsCreated: 0,
      processingTime: 0,
      errors: []
    };

    try {
      // 添加更新时间
      const updatedData = {
        ...updates,
        updated: Date.now()
      };

      // 1. 更新云端
      const cloudSuccess = await this.cloudStorage.updateEntity(entityId, updatedData as any);
      result.cloudStored = cloudSuccess;

      // 2. 更新本地缓存
      const localEntity = await this.localStorage.getEntity(entityId);
      if (localEntity) {
        const updatedEntity = { ...localEntity, ...updatedData };
        
        // 🆕 同步更新 recentDataDetails.conversations
        // 保留策略：所有未读消息 + 最新5条已读消息
        if (updatedData.relatedData?.conversations) {
          const mergedConversations = this.mergeAndSortConversations(
            localEntity.recentDataDetails?.conversations || [],
            updatedData.relatedData.conversations
          );
          
          updatedEntity.recentDataDetails = {
            ...(updatedEntity.recentDataDetails || {
              conversations: [],
              webpages: [],
              resources: [],
              projects: [],
              people: [],
              topics: [],
              jiraTickets: [],
              cooccurringEntities: []
            }),
            conversations: mergedConversations  // 已在 mergeAndSortConversations 中应用保留策略
          };
        }
        
        await this.localStorage.cacheEntity(updatedEntity);
        result.localCached = true;
      }

      result.success = result.cloudStored || result.localCached;
      result.processingTime = Date.now() - startTime;

      return result;

    } catch (error) {
      console.error('更新实体失败:', error);
      result.errors?.push(error.message);
      result.processingTime = Date.now() - startTime;
      return result;
    }
  }

  /**
   * 删除实体（同步删除本地和云端）
   */
  async deleteEntity(entityId: string): Promise<boolean> {
    const success = await this.initialize();
    if (!success) {
      throw new Error('记忆系统初始化失败');
    }

    try {
      // 并行删除云端和本地
      const [cloudSuccess, localSuccess] = await Promise.allSettled([
        this.cloudStorage.deleteEntity(entityId),
        this.removeFromLocalCache(entityId)
      ]);

      return (cloudSuccess.status === 'fulfilled' && cloudSuccess.value) ||
             (localSuccess.status === 'fulfilled' && localSuccess.value);

    } catch (error) {
      console.error('删除实体失败:', error);
      return false;
    }
  }

  /**
   * 批量存储实体
   */
  async batchStoreEntities(entities: Array<Omit<MemoryEntity, 'id' | 'created' | 'updated'>>): Promise<{
    success: number;
    failed: number;
    results: StoreResult[];
  }> {
    const success = await this.initialize();
    if (!success) {
      throw new Error('记忆系统初始化失败');
    }

    const results: StoreResult[] = [];
    let successCount = 0;
    let failedCount = 0;

    // 分批处理
    const batches = this.chunkArray(entities, this.config.maxSyncBatchSize);

    for (const batch of batches) {
      const batchPromises = batch.map(entity => this.storeEntity(entity));
      const batchResults = await Promise.allSettled(batchPromises);

      for (const settledResult of batchResults) {
        if (settledResult.status === 'fulfilled') {
          const result = settledResult.value;
          results.push(result);
          if (result.success) {
            successCount++;
          } else {
            failedCount++;
          }
        } else {
          failedCount++;
          results.push({
            success: false,
            entityId: `failed_${Date.now()}`,
            cloudStored: false,
            localCached: false,
            relationshipsCreated: 0,
            processingTime: 0,
            errors: [settledResult.reason?.message || '未知错误']
          });
        }
      }
    }

    return {
      success: successCount,
      failed: failedCount,
      results
    };
  }

  // ==================== 缓存管理接口 ====================

  /**
   * 更新实体的最近数据缓存
   */
  async updateRecentData(entityId: string, type: 'conversation' | 'resource' | 'project' | 'webpage', data: any): Promise<void> {
    const success = await this.initialize();
    if (!success) {
      throw new Error('记忆系统初始化失败');
    }
    return this.localStorage.updateRecentData(entityId, type, data);
  }

  /**
   * 🆕 同步实体类型统计数据到本地缓存
   */
  private async syncEntityCountsToCache(entities: MemoryEntity[]): Promise<void> {
    try {
      // 统计各类型实体数量
      const entityCounts: Record<string, number> = {
        'Person': 0,
        'Project': 0,
        'Task': 0,
        'Organization': 0,
        'Document': 0,
        'Technology': 0,
        'Topic': 0
      };

      // 遍历实体并统计
      entities.forEach(entity => {
        if (Object.prototype.hasOwnProperty.call(entityCounts, entity.type)) {
          entityCounts[entity.type]++;
        } else {
          // 如果有新的类型，也记录下来
          entityCounts[entity.type] = (entityCounts[entity.type] || 0) + 1;
        }
      });

      // 保存到本地缓存
      const statistics = {
        entityCounts,
        lastUpdated: Date.now(),
        totalEntities: entities.length
      };

      await chrome.storage.local.set({
        'cache_statistics': statistics
      });

      console.log(`📊 实体统计数据已缓存:`, entityCounts);
      
    } catch (error) {
      console.error('📊 同步实体统计数据失败:', error);
    }
  }

  /**
   * 清理过期缓存
   */
  async clearExpiredCache(): Promise<void> {
    const success = await this.initialize();
    if (!success) {
      throw new Error('记忆系统初始化失败');
    }
    return this.localStorage.clearExpiredCache();
  }

  /**
   * 强制同步缓存
   */
  async syncCache(): Promise<void> {
    if (this.isSyncing) {
      console.log('⏭️ 同步程序还在进行，跳过本次同步');
      return;
    }
    this.isSyncing = true;
    console.log('🔄 执行定时同步...');
    const success = await this.initialize();
    if (!success) {
      throw new Error('记忆系统初始化失败');
    }

    try {
      console.log('🔄 开始同步缓存...');

      // 执行云端到本地单向同步
      await this.performCloudToLocalSync();

      // 上传本地统计信息到云端
      await this.uploadLocalStatisticsToCloud();

      // 上传本地已读状态到云端
      await this.uploadLocalReadStatusToCloud();

      // 清理过期缓存
      await this.localStorage.clearExpiredCache();

      // 更新最后同步时间
      await chrome.storage.local.set({
        'cache_last_sync_time': Date.now()
      });

      console.log('✅ 缓存同步完成');

    } catch (error) {
      console.error('❌ 缓存同步失败:', error);
    }
    this.isSyncing = false;
  }

  /**
   * 新设备初始同步
   */
  async performInitialSyncIfNeeded(): Promise<{
    isNewDevice: boolean;
    syncPerformed: boolean;
    entitiesDownloaded: number;
    relationshipsRestored: number;
  }> {
    const result = {
      isNewDevice: false,
      syncPerformed: false,
      entitiesDownloaded: 0,
      relationshipsRestored: 0
    };

    try {
      // 检查是否是新设备
      const lastSyncData = await chrome.storage.local.get(['cache_last_sync_time', 'cache_device_initialized']);
      const isNewDevice = !lastSyncData.cache_device_initialized;
      result.isNewDevice = isNewDevice;

      if (isNewDevice) {
        console.log('🆕 检测到新设备，开始初始同步...');
        
        // 从云端拉取实体
        const {data: cloudEntities} = await this.cloudStorage.queryEntities();
        result.entitiesDownloaded = cloudEntities.length;
        
        if (cloudEntities.length > 0) {
          await this.localStorage.batchCacheEntities(cloudEntities);
        }

        // 恢复关系数据
        const relationshipData = await this.cloudStorage.restoreRelationships();
        if (relationshipData) {
          await this.localStorage.restoreRelationshipData(relationshipData);
          result.relationshipsRestored = relationshipData.relationships.length;
        }

        // 标记设备已初始化
        await chrome.storage.local.set({
          cache_device_initialized: true,
          cache_last_sync_time: Date.now()
        });

        result.syncPerformed = true;
        console.log(`✅ 新设备初始同步完成: ${result.entitiesDownloaded} 个实体, ${result.relationshipsRestored} 个关系`);
      }

      return result;
    } catch (error) {
      console.error('新设备初始同步失败:', error);
      return result;
    }
  }

  /**
   * 备份关系数据到云端
   */
  async backupRelationships(): Promise<boolean> {
    const success = await this.initialize();
    if (!success) {
      throw new Error('记忆系统初始化失败');
    }
    
    try {
      // 获取本地关系数据
      const relationshipData = await this.localStorage.getRelationshipBackupData();
      
      if (!relationshipData) {
        console.log('⚠️ 没有关系数据需要备份');
        return false;
      }
      
      return await this.cloudStorage.backupRelationships(relationshipData);
    } catch (error) {
      console.error('备份关系数据失败:', error);
      return false;
    }
  }

  /**
   * 创建实体关系
   */
  async createRelationship(relationship: {
    type: string;
    fromId: string;
    toId: string;
    properties?: Record<string, any>;
    strength?: number;
  }): Promise<boolean> {
    const success = await this.initialize();
    if (!success) {
      throw new Error('记忆系统初始化失败');
    }

    try {
      const fullRelationship = {
        id: `rel_${relationship.fromId}_${relationship.toId}_${relationship.type}_${Date.now()}`,
        type: relationship.type,
        fromId: relationship.fromId,
        toId: relationship.toId,
        properties: relationship.properties || {},
        strength: relationship.strength || 0.7,
        created: Date.now(),
        updated: Date.now()
      };

      await this.localStorage.cacheRelationship(fullRelationship);
      return true;
    } catch (error) {
      console.error('创建关系失败:', error);
      return false;
    }
  }

  /**
   * 实体时间轴
   */
  async getEntityTimeline(entityId: string, options?: {
    limit?: number;
    timeRange?: { start: number; end: number };
  }): Promise<Array<{
    id: string;
    type: 'message' | 'webpage' | 'relation_created' | 'entity_updated';
    title: string;
    content: string;
    timestamp: number;
    source?: string;
    metadata?: any;
  }>> {
    const success = await this.initialize();
    if (!success) {
      throw new Error('记忆系统初始化失败');
    }

    // 这里可以根据需要实现时间轴逻辑
    // 目前返回空数组，可以根据实际需求扩展
    return [];
  }

  /**
   * 获取系统状态
   */
  async getSystemStatus(): Promise<{
    isInitialized: boolean;
    cloudConnected: boolean;
    localCacheSize: number;
    lastSyncTime: number;
    performance: {
      averageQueryTime: number;
      cacheHitRate: number;
    };
  }> {
    return {
      isInitialized: this.isInitialized,
      cloudConnected: await this.cloudStorage.isConnected(),
      localCacheSize: await this.localStorage.getCacheSize(),
      lastSyncTime: await this.getLastSyncTime(),
      performance: await this.getPerformanceMetrics()
    };
  }

  // ==================== 实体相似性管理接口 ====================

  /**
   * 处理实体相似性检测
   */
  async processEntitySimilarity(entity: Omit<MemoryEntity, 'id' | 'created' | 'updated'>): Promise<ProcessedEntity> {
    const success = await this.initialize();
    if (!success) {
      throw new Error('记忆系统初始化失败');
    }
    return this.entitySimilarityTool.processEntity(entity);
  }

  /**
   * 批量处理实体相似性
   */
  async processEntitiesSimilarity(entities: Array<Omit<MemoryEntity, 'id' | 'created' | 'updated'>>): Promise<ProcessedEntity[]> {
    const success = await this.initialize();
    if (!success) {
      throw new Error('记忆系统初始化失败');
    }
    return this.entitySimilarityTool.processEntities(entities);
  }

  /**
   * 获取待处理的实体合并候选
   */
  async getPendingEntityMerges(): Promise<EntityMergePair[]> {
    const success = await this.initialize();
    if (!success) {
      throw new Error('记忆系统初始化失败');
    }
    return this.entitySimilarityTool.getPendingMerges();
  }

  /**
   * 确认实体合并
   */
  async confirmEntityMerge(mergeId: string): Promise<boolean> {
    const success = await this.initialize();
    if (!success) {
      throw new Error('记忆系统初始化失败');
    }
    return this.entitySimilarityTool.confirmMerge(mergeId);
  }

  /**
   * 拒绝实体合并
   */
  async rejectEntityMerge(mergeId: string): Promise<boolean> {
    const success = await this.initialize();
    if (!success) {
      throw new Error('记忆系统初始化失败');
    }
    return this.entitySimilarityTool.rejectMerge(mergeId);
  }

  /**
   * 获取实体相似性统计
   */
  getEntitySimilarityStats(): {
    pendingMerges: number;
    thresholds: any;
  } {
    return this.entitySimilarityTool.getStatistics();
  }

  // ==================== 系统维护接口 ====================

  /**
   * 执行系统健康检查
   */
  async performHealthCheck(): Promise<SystemHealthStatus> {
    const success = await this.initialize();
    if (!success) {
      throw new Error('记忆系统初始化失败');
    }
    return this.systemMaintenanceTool.performHealthCheck();
  }

  /**
   * 执行完整系统维护
   */
  async performSystemMaintenance(options?: {
    cleanupEntities?: boolean;
    cleanupRelationships?: boolean;
    forceSync?: boolean;
    backupData?: boolean;
    cleanupExpiredConversations?: boolean;  // 🆕 清理过期已读消息
  }): Promise<MaintenanceResult> {
    const success = await this.initialize();
    if (!success) {
      throw new Error('记忆系统初始化失败');
    }

    return this.systemMaintenanceTool.performFullMaintenance(options);
  }

  /**
   * 🆕 单独清理实体的过期已读消息
   * @param entityId 可选，指定实体ID；不指定则清理所有实体
   */
  async cleanExpiredConversations(entityId?: string): Promise<{
    entitiesProcessed: number;
    conversationsRemoved: number;
    spaceSaved: number;
  }> {
    const success = await this.initialize();
    if (!success) {
      throw new Error('记忆系统初始化失败');
    }
    return this.cloudStorage.cleanExpiredReadConversations(entityId);
  }

  /**
   * 获取维护工具状态
   */
  getMaintenanceStatus(): {
    isMonitoring: boolean;
    monitoringInterval: number;
    maintenanceInterval: number;
    nextMaintenance: number;
  } {
    return this.systemMaintenanceTool.getSystemStatus();
  }

  // ==================== 用户画像接口 ====================

  /**
   * 获取用户画像
   */
  async getUserProfile(): Promise<{ profile: UserProfile | null; analysis: UserProfileAnalysis | null }> {
    const success = await this.initialize();
    if (!success) {
      throw new Error('记忆系统初始化失败');
    }
    
    if (!this.userProfileManager) {
      return { profile: null, analysis: null };
    }
    
    try {
      const profile = await this.userProfileManager.getProfile();
      const analysis = await this.userProfileManager.generateAnalysis();
      return { profile, analysis };
    } catch (error) {
      console.error('获取用户画像失败:', error);
      return { profile: null, analysis: null };
    }
  }

  /**
   * 更新用户画像
   */
  async updateUserProfile(update: UserProfileUpdate): Promise<boolean> {
    const success = await this.initialize();
    if (!success) {
      throw new Error('记忆系统初始化失败');
    }
    
    if (!this.userProfileManager) {
      console.warn('用户画像管理器未初始化');
      return false;
    }
    
    try {
      await this.userProfileManager.updateProfile(update);
      return true;
    } catch (error) {
      console.error('更新用户画像失败:', error);
      return false;
    }
  }

  /**
   * 设置用户明确重要性
   */
  async setUserExplicitImportance(
    itemId: string,
    type: 'project' | 'person' | 'topic' | 'jira' | 'technology' | 'document',
    importance: number
  ): Promise<boolean> {
    const success = await this.initialize();
    if (!success) {
      throw new Error('记忆系统初始化失败');
    }
    
    if (!this.userProfileManager) {
      return false;
    }
    
    try {
      await this.userProfileManager.setExplicitImportance(itemId, type, importance);
      return true;
    } catch (error) {
      console.error('设置用户重要性失败:', error);
      return false;
    }
  }

  /**
   * 应用用户画像权重衰变
   */
  async applyUserProfileDecay(): Promise<void> {
    const success = await this.initialize();
    if (!success) {
      throw new Error('记忆系统初始化失败');
    }
    
    if (this.userProfileManager) {
      await this.userProfileManager.applyWeightDecay();
    }
  }

  /**
   * 🆕 融合用户上下文配置到用户画像
   */
  async fuseUserContextConfig(userContextConfig: any): Promise<boolean> {
    const success = await this.initialize();
    if (!success) {
      throw new Error('记忆系统初始化失败');
    }
    
    if (!this.userProfileManager) {
      return false;
    }
    
    try {
      const success = await this.userProfileManager.fuseUserContextConfig(userContextConfig);
      if (success) {
        // 融合成功后执行自适应权重调整
        await this.userProfileManager.adaptiveWeightAdjustment();
      }
      return success;
    } catch (error) {
      console.error('融合用户上下文配置失败:', error);
      return false;
    }
  }

  /**
   * 🆕 执行权重自适应调整
   */
  async adaptiveWeightAdjustment(): Promise<void> {
    const success = await this.initialize();
    if (!success) {
      throw new Error('记忆系统初始化失败');
    }
    
    if (this.userProfileManager) {
      try {
        await this.userProfileManager.adaptiveWeightAdjustment();
      } catch (error) {
        console.error('权重自适应调整失败:', error);
      }
    }
  }

  /**
   * 🆕 生成主动推荐内容
   */
  async generateProactiveRecommendations(): Promise<Array<{
    id: string;
    type: 'content' | 'action' | 'connection' | 'learning';
    title: string;
    description: string;
    confidence: number;
    reason: string;
    actionUrl?: string;
    priority: 'high' | 'medium' | 'low';
  }>> {
    const success = await this.initialize();
    if (!success) {
      throw new Error('记忆系统初始化失败');
    }
    
    if (!this.userProfileManager) {
      return [];
    }
    
    try {
      return await this.userProfileManager.generateProactiveRecommendations();
    } catch (error) {
      console.error('生成主动推荐失败:', error);
      return [];
    }
  }

  /**
   * 🆕 获取融合后的用户画像
   * 返回应用了加权融合算法的兴趣列表
   */
  async getFusedUserProfile(): Promise<{ 
    profile: any | null, 
    analysis: any | null,
    fusedInterests: any
  }> {
    const success = await this.initialize();
    if (!success) {
      throw new Error('记忆系统初始化失败');
    }
    
    if (!this.userProfileManager) {
      return { profile: null, analysis: null, fusedInterests: null };
    }
    
    try {
      const { profile, analysis } = await this.getUserProfile();
      
      if (!profile) {
        return { profile: null, analysis: null, fusedInterests: null };
      }

      // 应用加权融合算法到各个兴趣类别
      const fusedInterests = {
        projects: this.userProfileManager.getFusedInterestItems(profile.interests.projects || [] as any),
        people: this.userProfileManager.getFusedInterestItems(profile.interests.people || [] as any),
        topics: this.userProfileManager.getFusedInterestItems(profile.interests.topics || [] as any),
        jiraTickets: this.userProfileManager.getFusedInterestItems(profile.interests.jiraTickets || [] as any),
        technologies: this.userProfileManager.getFusedInterestItems(profile.interests.technologies || [] as any),
        documents: this.userProfileManager.getFusedInterestItems(profile.interests.documents || [] as any)
      };

      return {
        profile: {
          ...profile,
          interests: fusedInterests
        },
        analysis,
        fusedInterests
      };
    } catch (error) {
      console.error('获取融合用户画像失败:', error);
      return { profile: null, analysis: null, fusedInterests: null };
    }
  }

  /**
   * 🆕 存储独立用户配置到云端
   */
  async storeIndependentUserConfig(config: any): Promise<boolean> {
    const success = await this.initialize();
    if (!success) {
      throw new Error('记忆系统初始化失败');
    }

    try {
      const success = await this.cloudStorage.storeIndependentUserConfig(config);
      return success;
    } catch (error) {
      console.error('存储独立用户配置失败:', error);
      return false;
    }
  }

  /**
   * 🆕 获取独立用户配置
   */
  async getIndependentUserConfig(): Promise<any | null> {
    const success = await this.initialize();
    if (!success) {
      throw new Error('记忆系统初始化失败');
    }

    try {
      const config = await this.cloudStorage.getIndependentUserConfig();
      return config;
    } catch (error) {
      console.error('获取独立用户配置失败:', error);
      return null;
    }
  }

  /**
   * 获取最后同步时间
   */
  async getLastSyncTime(): Promise<number> {
    try {
      const result = await chrome.storage.local.get('cache_last_sync_time');
      return result.cache_last_sync_time || 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * 获取性能指标
   */
  async getPerformanceMetrics(): Promise<{
    averageQueryTime: number;
    cacheHitRate: number;
  }> {
    return {
      averageQueryTime: (this.metrics.averageLocalTime + this.metrics.averageCloudTime) / 2,
      cacheHitRate: this.metrics.cacheHitRate
    };
  }

  // ==================== 私有方法 ====================

  /**
   * 启动后台同步 - 现在包含用户画像权重衰变逻辑
   */
  startBackgroundSync(): void {
    // 防止重复启动
    if (this.backgroundSyncStarted) {
      console.log('⚠️ 后台同步已启动，跳过重复启动');
      return;
    }

    // 检查是否在background script环境中
    const isBackground = typeof ServiceWorkerGlobalScope !== 'undefined' && self instanceof ServiceWorkerGlobalScope;
    if (!isBackground) {
      console.log('⚠️ 非background环境，跳过后台同步启动');
      return;
    }

    // ✅ 定时任务已统一由 TaskScheduler 管理
    // 不再在这里创建独立的 alarm，避免重复执行
    // 
    // TaskScheduler 中已包含以下任务：
    // - 'memory_sync' (scheduled_task_memory_sync) -> 调用 memorySystem.syncCache()
    // - 'user_profile_decay' (scheduled_task_user_profile_decay) -> 调用 memorySystem.applyUserProfileDecay()
    // 
    // 如需调整间隔时间，请在 TaskScheduler.ts 的 TASK_DEFINITIONS 中修改
    
    // 标记为已启动
    this.backgroundSyncStarted = true;
    
    console.log('✅ 记忆系统定时任务由 TaskScheduler 统一管理');
    console.log('   - memory_sync: 每5分钟执行一次');
    console.log('   - user_profile_decay: 每24小时执行一次');
    
    // 注意：首次执行由 TaskScheduler 的 performInitialRun() 处理
    // 不再在这里手动执行首次同步和衰变

    // 保留 setupAlarmListener 以兼容旧代码，但实际不再创建 alarm
    this.setupAlarmListener();
  }

  /**
   * 设置 alarm 监听器
   * 
   * ⚠️ 已废弃：此方法保留仅用于向后兼容
   * 
   * 所有定时任务现在由 TaskScheduler 统一管理：
   * - 'memory_sync' -> memorySystem.syncCache()
   * - 'user_profile_decay' -> memorySystem.applyUserProfileDecay()
   * 
   * 不再需要独立的 alarm 监听器
   */
  private setupAlarmListener(): void {
    if (this.alarmListenerAdded) {
      return;
    }

    this.alarmListenerAdded = true;
    console.log('✅ 记忆系统定时任务已交由 TaskScheduler 统一管理');
  }

  /**
   * 执行用户画像权重衰变
   */

  /**
   * 清理实体名称，处理中文和特殊字符
   */
  private sanitizeEntityName(name: string): string {
    if (!name || name.trim() === '') {
      return 'entity';
    }

    // 简单的中文转拼音映射（部分常用字符）
    const chineseToPinyin: Record<string, string> = {
      '项目': 'xiangmu',
      '文档': 'wendang',
      '人员': 'renyuan',
      '主题': 'zhuti',
      '任务': 'renwu',
      '团队': 'tuandui',
      '公司': 'gongsi',
      '系统': 'xitong',
      '数据': 'shuju',
      '功能': 'gongneng',
      '需求': 'xuqiu',
      '设计': 'sheji',
      '开发': 'kaifa',
      '测试': 'ceshi',
      '部署': 'bushu',
      '维护': 'weihu',
      '管理': 'guanli',
      '分析': 'fenxi',
      '报告': 'baogao',
      '会议': 'huiyi'
    };

    let cleanName = name.trim();

    // 替换中文词汇为拼音
    for (const [chinese, pinyin] of Object.entries(chineseToPinyin)) {
      cleanName = cleanName.replace(new RegExp(chinese, 'g'), pinyin);
    }

    // 移除其他中文字符（通过Unicode范围）
    cleanName = cleanName.replace(/[\u4e00-\u9fff]/g, '');

    // 只保留字母、数字和连字符
    cleanName = cleanName.replace(/[^a-zA-Z0-9\-_]/g, '');

    // 移除多余的连字符和下划线
    cleanName = cleanName.replace(/[-_]+/g, '_');

    // 移除开头和结尾的连字符和下划线
    cleanName = cleanName.replace(/^[-_]+|[-_]+$/g, '');

    // 限制长度并确保不为空
    if (cleanName.length === 0) {
      cleanName = 'entity';
    } else if (cleanName.length > 20) {
      cleanName = cleanName.substring(0, 20);
    }

    // 确保以字母开头
    if (!/^[a-zA-Z]/.test(cleanName)) {
      cleanName = 'entity_' + cleanName;
    }

    return cleanName.toLowerCase();
  }

  private async queryFromLocal(
    type?: string,
    searchTerm?: string,
    options: QueryOptions = {}
  ): Promise<QueryResult<MemoryEntity>> {
    if (type) {
      return this.localStorage.queryEntitiesByType(type, options);
    } else if (searchTerm) {
      return this.localStorage.searchEntities(searchTerm, type, options);
    } else {
      // 返回所有实体（分页）
      return {
        data: [],
        total: 0,
        source: 'local',
        cached: true,
        queryTime: 0
      };
    }
  }

  private async queryFromCloud(
    type?: string,
    searchTerm?: string,
    options: QueryOptions = {}
  ): Promise<QueryResult<MemoryEntity>> {
    // 如果有搜索词且长度大于2，使用向量搜索获得更好的语义匹配
    if (searchTerm && searchTerm.length > 2 && !type) {
      // 转换为向量搜索选项
      const vectorOptions: VectorSearchOptions = {
        limit: options.limit,
        offset: options.offset,
        useCache: options.useCache,
        includeCounts: options.includeCounts,
        sortBy: options.sortBy === 'relevance' ? 'relevance' : 
                options.sortBy === 'importance' ? 'importance' : 'relevance',
        sortOrder: options.sortOrder
      };
      return this.cloudStorage.searchByVector(searchTerm, type, vectorOptions);
    }
    
    // 使用新的云端实体查询接口，支持按type过滤
    return this.cloudStorage.queryEntities(type, searchTerm, options);
  }

  private async cacheCloudResults(entities: MemoryEntity[]): Promise<void> {
    try {
      if (entities.length > 0) {
        await this.localStorage.batchCacheEntities(entities);
      }
    } catch (error) {
      console.error('缓存云端结果失败:', error);
    }
  }

  private async removeFromLocalCache(entityId: string): Promise<boolean> {
    try {
      await chrome.storage.local.remove(`cache_entities_${entityId}`);
      // 这里还需要更新索引等，但为了简化暂时省略
      return true;
    } catch (error) {
      console.error('从本地缓存删除失败:', error);
      return false;
    }
  }

  private updateMetrics(source: 'local' | 'cloud' | 'hybrid', queryTime: number): void {
    if (source === 'local' || source === 'hybrid') {
      this.metrics.localHits++;
      this.metrics.averageLocalTime = 
        (this.metrics.averageLocalTime * (this.metrics.localHits - 1) + queryTime) / this.metrics.localHits;
    }
    
    if (source === 'cloud' || source === 'hybrid') {
      this.metrics.cloudHits++;
      this.metrics.averageCloudTime = 
        (this.metrics.averageCloudTime * (this.metrics.cloudHits - 1) + queryTime) / this.metrics.cloudHits;
    }

    // 更新缓存命中率
    this.metrics.cacheHitRate = this.metrics.localHits / this.metrics.totalQueries;
  }

  private async loadConfig(): Promise<void> {
    try {
      const result = await chrome.storage.local.get('cache_strategy_config');
      if (result.cache_strategy_config) {
        this.config = { ...this.config, ...result.cache_strategy_config };
      }
    } catch (error) {
      console.warn('加载缓存策略配置失败，使用默认配置');
    }
  }

  private async loadMetrics(): Promise<void> {
    try {
      const result = await chrome.storage.local.get('cache_strategy_metrics');
      if (result.cache_strategy_metrics) {
        this.metrics = { ...this.metrics, ...result.cache_strategy_metrics };
      }
    } catch (error) {
      console.warn('加载性能指标失败，使用默认值');
    }
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * 从缓存扩展实体信息：直接合并缓存数据（简化版）
   */
  private async extendEntitiesFromCache(entities: MemoryEntity[]): Promise<CachedEntityDetail[]> {
    const extendedEntities: CachedEntityDetail[] = [];
    
    for (const entity of entities) {
      const extendedEntity: CachedEntityDetail = {
        ...entity,
        cachedAt: Date.now(),
        // 初始化必要的数组字段
        recentDataDetails: {
          conversations: [] as MemoryMessage[],
          webpages: [] as MemoryEntity['relatedData']['webpages'],
          resources: [] as MemoryEntity['relatedData']['resources'],
          projects: [] as MemoryEntity['relatedData']['projects'],
          people: [] as MemoryEntity['relatedData']['people'],
          topics: [] as MemoryEntity['relatedData']['topics'],
          jiraTickets: [] as MemoryEntity['relatedData']['jiraTickets'],
          cooccurringEntities: [] as MemoryEntity['relatedData']['cooccurringEntities']
        },
        relatedParticipants: []
      };
      
      try {
        // 获取扩展缓存数据
        const cacheData = await this.localStorage.getEntity(entity.id);
        
        if (cacheData) {
          // 直接合并缓存数据到实体对象
          Object.assign(extendedEntity, cacheData);
        } else {
          // 没有缓存数据时，设置默认值  
          this.setDefaultExtendedFields(extendedEntity, entity);
        }
      } catch (error) {
        console.error(`扩展实体 ${entity.id} 信息失败:`, error);
        // 设置默认值
        this.setDefaultExtendedFields(extendedEntity, entity);
      }
      
      extendedEntities.push(extendedEntity);
    }
    
    return extendedEntities;
  }

  /**
   * 设置扩展字段的默认值
   */
  private setDefaultExtendedFields(extendedEntity: CachedEntityDetail, entity: MemoryEntity): void {
    // 设置必要的数组字段默认值
    if (!extendedEntity.recentDataDetails) {
      extendedEntity.recentDataDetails = {
        conversations: [] as MemoryMessage[],
        webpages: [] as MemoryEntity['relatedData']['webpages'],
        resources: [] as MemoryEntity['relatedData']['resources'],
        projects: [] as MemoryEntity['relatedData']['projects'],
        people: [] as MemoryEntity['relatedData']['people'],
        topics: [] as MemoryEntity['relatedData']['topics'],
        jiraTickets: [] as MemoryEntity['relatedData']['jiraTickets'],
        cooccurringEntities: [] as MemoryEntity['relatedData']['cooccurringEntities']
      };
    }
    
    // 确保统计字段存在
    if (!extendedEntity.statistic) {
      extendedEntity.statistic = {
        conversations: 0,
        projects: 0,
        participants: 1,
        resources: 0,
        documents: 0,
        webpages: 0,
        relationships: entity.properties?.relationshipsCount || 0,
        topics: 0,
        jiraTickets: 0
      };
    }
    
    // 根据实体类型设置特定默认值
    if (entity.type === 'Person') {
      extendedEntity.role = entity.properties?.role || '团队成员';
      extendedEntity.team = entity.properties?.team || '';
      extendedEntity.expertise = entity.properties?.expertise || entity.tags || [];
    }
    
    if (entity.type === 'Project') {
      extendedEntity.isHighlighted = entity.properties?.isHighlighted || false;
    }
  }

  /**
   * 执行云端到本地单向同步 - 只从云端拉取数据到本地缓存
   */
  private async performCloudToLocalSync(): Promise<void> {
    try {
      const lastSyncData = await chrome.storage.local.get('cache_last_sync_time');
      const lastSyncTime = lastSyncData.cache_last_sync_time || 0;
      
      // 如果距离上次同步不足5分钟，跳过同步
      if (Date.now() - lastSyncTime < 5 * 60 * 1000) {
        console.log('⏭️ 距离上次单向同步不足5分钟，跳过');
        return;
      }

      console.log('📥 开始云端到本地单向同步...');
      let syncedEntities = 0;
      let recentDataUpdated = 0;

      // 1. 从云端拉取所有实体
      const {data: cloudEntities} = await this.cloudStorage.queryEntities();
      
      // 2. 批量同步云端实体到本地
      const cloudBatches = this.chunkArray(cloudEntities, 20); // 每批最多20个
      const entitiesToUpdate: MemoryEntity[] = [];
      
      for (const batch of cloudBatches) {
        for (const entity of batch) {
          const localEntity = await this.localStorage.getEntity(entity.id);
          if (!localEntity || localEntity.updated < entity.updated) {
            // 🔄 缓存实体到本地
            await this.localStorage.cacheEntity(entity);
            syncedEntities++;
            entitiesToUpdate.push(entity);
          }
        }
        
        // 批间延迟，避免阻塞
        if (cloudBatches.length > 1) {
          await this.delay(100);
        }
      }

      // 3. 🆕 关联数据现在直接存储在 MemoryEntity.relatedData 中，无需单独同步关系
      console.log(`📊 实体关联数据已通过 MemoryEntity.relatedData 同步，无需额外关系处理`);
      
      if (entitiesToUpdate.length > 0) {
        recentDataUpdated = entitiesToUpdate.length;
      }

      // 4. 🆕 统计所有实体类型的数量并缓存到本地
      await this.syncEntityCountsToCache(cloudEntities);

      console.log(`✅ 单向同步完成: 同步了${syncedEntities}个实体，更新了${recentDataUpdated}个实体的最近数据缓存`);

    } catch (error) {
      console.error('❌ 云端到本地同步失败:', error);
    }
  }

  /**
   * 上传本地统计信息到云端
   */
  private async uploadLocalStatisticsToCloud(): Promise<void> {
    try {
      console.log('📊 开始上传本地统计信息到云端...');

      // 获取所有本地缓存的实体
      const recentDataEntries = await this.localStorage.getAllRecentDataEntries();
      
      if (!recentDataEntries || recentDataEntries.length === 0) {
        console.log('📊 没有本地统计信息需要上传');
        return;
      }

      // 收集需要更新的统计信息
      const statisticsUpdates = [];
      
      for (const entry of recentDataEntries) {
        try {
          // 计算当前统计信息
          const updatedStatistic = entry.statistic;

          statisticsUpdates.push({
            entityId: entry.id,
            statistic: updatedStatistic,
            lastUpdated: entry.lastUpdated || Date.now()
          });

        } catch (error) {
          console.error(`处理实体 ${entry.id} 统计信息失败:`, error);
        }
      }

      if (statisticsUpdates.length === 0) {
        console.log('📊 没有有效的统计信息需要上传');
        return;
      }

      // 批量更新云端实体的统计信息
      await this.cloudStorage.batchUpdateEntityStatistics(statisticsUpdates);
      
      console.log(`📊 成功上传 ${statisticsUpdates.length} 个实体的统计信息`);

    } catch (error) {
      console.error('📊 上传统计信息失败:', error);
    }
  }

  /**
   * 上传本地已读状态到云端
   */
  private async uploadLocalReadStatusToCloud(): Promise<void> {
    try {
      console.log('📖 开始上传本地已读状态到云端...');

      // 获取所有本地缓存的实体
      const recentDataEntries = await this.localStorage.getAllRecentDataEntries();
      
      if (!recentDataEntries || recentDataEntries.length === 0) {
        console.log('📖 没有本地已读状态需要上传');
        return;
      }

      // 收集需要更新的已读状态（只处理有 readStatus 的实体）
      const readStatusUpdates = [];
      
      for (const entry of recentDataEntries) {
        try {
          // 只上传有 readStatus 的实体（通常是 Topic 类型）
          if (entry.readStatus) {
            readStatusUpdates.push({
              entityId: entry.id,
              readStatus: entry.readStatus
            });
          }
        } catch (error) {
          console.error(`处理实体 ${entry.id} 已读状态失败:`, error);
        }
      }

      if (readStatusUpdates.length === 0) {
        console.log('📖 没有有效的已读状态需要上传');
        return;
      }

      // 批量更新云端实体的已读状态
      await this.cloudStorage.batchUpdateEntityReadStatus(readStatusUpdates);
      
      console.log(`📖 成功上传 ${readStatusUpdates.length} 个实体的已读状态`);

    } catch (error) {
      console.error('📖 上传已读状态失败:', error);
    }
  }

  /**
   * 初始化用户画像管理器
   */
  private async initializeUserProfile(): Promise<void> {
    try {
      // 重用现有的 CloudStorage 实例，避免重复初始化
      // UserProfileManager 现在会在 initialize() 时自动获取用户信息
      this.userProfileManager = new UserProfileManager(undefined, this.cloudStorage);
      await this.userProfileManager.initialize();
      
      console.log('✅ 用户画像管理器初始化成功');
    } catch (error) {
      console.error('❌ 用户画像管理器初始化失败:', error);
      // 不要抛出异常，允许记忆系统继续运行
    }
  }

  /**
   * 根据消息数据智能推断用户行为类型
   */
  private inferActionTypeFromMessageData(messageData: any): 'view' | 'edit' | 'create' | 'link' | 'mention' | 'search' | 'favorite' {
    // 优先使用LLM分析提供的用户关系类型
    const userRelationType = messageData.metadata?.user_relation_type;
    if (userRelationType) {
      return this.mapUserRelationTypeToActionType(userRelationType);
    }
    
    const matchedRules = messageData.metadata?.matchedRules || [];
    const sender = messageData.metadata?.sender || '';
    const messageContent = messageData.content || '';
    
    // 检查是否明确提到用户
    const mentionKeywords = ['@我', '@你', '提到我', '需要你', '你来', '你的'];
    const hasMention = mentionKeywords.some(keyword => messageContent.includes(keyword));
    
    if (hasMention) {
      return 'mention';
    }
    
    // 根据匹配规则推断行为类型
    for (const rule of matchedRules) {
      const lowerRule = rule.toLowerCase();
      
      // 项目相关消息 - 通常是查看项目进展
      if (lowerRule.includes('recording') || lowerRule.includes('project') || lowerRule.includes('dependencies')) {
        return 'view';
      }
      
      // 政策消息 - 通常需要关注/查看
      if (lowerRule.includes('政策') || lowerRule.includes('policy') || lowerRule.includes('规定')) {
        return 'view';
      }
      
      // 特定人员消息 - 算作查看行为
      if (lowerRule.includes('sophia') || lowerRule.includes('jinmei') || lowerRule.includes('发送的所有消息')) {
        return 'view';
      }
      
      // 明确@我的消息
      if (lowerRule.includes('@我') || lowerRule.includes('mention')) {
        return 'mention';
      }
    }
    
    // 默认返回view（浏览/关注）
    return 'view';
  }

  /**
   * 将LLM分析的用户关系类型映射到actionType
   */
  private mapUserRelationTypeToActionType(userRelationType: string): 'view' | 'edit' | 'create' | 'link' | 'mention' | 'search' | 'favorite' {
    const lowerType = userRelationType.toLowerCase();
    
    if (lowerType.includes('mention')) {
      return 'mention';
    } else if (lowerType.includes('project_related')) {
      return 'view';
    } else if (lowerType.includes('policy_related')) {
      return 'view';
    } else if (lowerType.includes('person_tracking')) {
      return 'view'; // 改为view而不是social
    } else if (lowerType.includes('general_interest')) {
      return 'view';
    }
    
    // 默认返回view
    return 'view';
  }

  /**
   * 🆕 合并并排序conversations，保持isRead状态
   * 保留策略：所有未读消息 + 最新5条已读消息
   */
  private mergeAndSortConversations(
    existingConversations: any[],
    newConversations: any[]
  ): any[] {
    const conversationsMap = new Map();
    
    // 先添加已存在的conversations（保持isRead状态）
    existingConversations.forEach((conv: any) => {
      conversationsMap.set(conv.id, conv);
    });
    
    // 合并新的conversations
    newConversations.forEach((conv: any) => {
      if (conversationsMap.has(conv.id)) {
        // 已存在的conversation，保持其isRead状态
        const existing = conversationsMap.get(conv.id);
        conversationsMap.set(conv.id, {
          ...conv,
          isRead: existing.isRead !== undefined ? existing.isRead : (conv.isRead || false),
          readTimestamp: existing.readTimestamp
        });
      } else {
        // 新conversation
        conversationsMap.set(conv.id, {
          ...conv,
          isRead: conv.isRead !== undefined ? conv.isRead : false
        });
      }
    });
    
    // 🆕 智能保留策略：保留所有未读 + 最新5条已读
    const unreadConversations = Array.from(conversationsMap.values()).filter((c: any) => !c.isRead);
    const readConversations = Array.from(conversationsMap.values()).filter((c: any) => c.isRead);
    
    // 保留所有未读 + 补充已读到5条
    const needReadCount = Math.max(0, 5 - unreadConversations.length);
    const finalConversations = [
      ...unreadConversations,
      ...readConversations.slice(0, needReadCount)
    ];
    
    // 按时间排序（最新的在前）
    finalConversations.sort((a: any, b: any) => {
      const timeA = new Date(a.datetime || 0).getTime();
      const timeB = new Date(b.datetime || 0).getTime();
      return timeB - timeA;
    });
    
    return finalConversations;
  }

  /**
   * 从实体列表更新用户画像
   */
  async updateUserProfileFromEntities(
    entities: Array<Omit<MemoryEntity, 'id' | 'created' | 'updated'>>,
    baseAction: Omit<UserAction, 'weight'>
  ): Promise<void> {
    if (!this.userProfileManager) return;

    try {
      for (const entity of entities) {
        // 映射实体类型到用户画像类型
        let profileType: 'project' | 'person' | 'topic' | 'jira' | 'technology' | 'document';
        switch (entity.type) {
          case 'Person':
            profileType = 'person';
            break;
          case 'Project':
            profileType = 'project';
            break;
          case 'Task':
            profileType = 'jira';
            break;
          case 'Technology':
            profileType = 'technology';
            break;
          case 'Document':
            profileType = 'document';
            break;
          case 'Topic':
          default:
            profileType = 'topic';
            break;
        }

        // 根据实体类型调整权重
        let weight = 0.1; // 默认权重
        switch (profileType) {
          case 'project':
            weight *= 1.5; // 项目权重更高
            break;
          case 'person':
            weight *= 1.3; // 人员权重稍高
            break;
          case 'jira':
            weight *= 1.2; // JIRA 权重稍高
            break;
          default:
            break;
        }

        const action: UserAction = {
          ...baseAction,
          weight,
        };

        await this.userProfileManager.updateProfile({
          userId: this.userProfileManager.userId,
          action,
          targetItem: {
            id: entity.name.replace(/\s+/g, '_').toLowerCase(),
            type: profileType,
            name: entity.name,
            metadata: {
              entityType: entity.type,
              document: entity.document,
              importance: entity.importance,
              tags: entity.tags
            }
          }
        });
      }
    } catch (error) {
      console.error('从实体更新用户画像失败:', error);
    }
  }

}

// 导出单例实例
export const memorySystem = new MemorySystem();
