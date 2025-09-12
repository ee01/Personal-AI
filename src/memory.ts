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
  collections?: ('entities' | 'messages' | 'webpages')[]; // 指定搜索的集合
  returnType?: 'entities' | 'raw';  // 返回类型：实体对象或原始数据
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
  private cloudStorage: CloudStorage;
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
      returnType: 'raw',         // 返回原始数据格式
      limit: options?.limit,
      sortBy: options?.sortBy,
      sortOrder: options?.sortOrder,
      timeRange: options?.timeRange,
      minRelevanceScore: options?.minRelevanceScore
    });
    
    return result.data || [];
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
  }): Promise<MaintenanceResult> {
    const success = await this.initialize();
    if (!success) {
      throw new Error('记忆系统初始化失败');
    }
    return this.systemMaintenanceTool.performFullMaintenance(options);
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
    const isBackground = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getManifest;
    if (!isBackground) {
      console.log('⚠️ 非background环境，跳过后台同步启动');
      return;
    }

    // 使用 Chrome alarms API 进行后台同步和权重衰变
    const syncAlarmName = 'memory-system-sync';
    const decayAlarmName = 'user-profile-decay';
    
    chrome.alarms.clear(syncAlarmName, () => {
      // 创建同步 alarm，每5分钟同步一次
      chrome.alarms.create(syncAlarmName, {
        periodInMinutes: this.config.syncInterval / (60 * 1000)
      });
      
      console.log(`🔄 后台同步已启动，间隔: ${this.config.syncInterval / (60 * 1000)} 分钟`);
    });
    
    chrome.alarms.clear(decayAlarmName, () => {
      // 创建权重衰变 alarm，每24小时执行一次
      chrome.alarms.create(decayAlarmName, {
        periodInMinutes: 24 * 60 // 24小时
      });
      
      console.log(`🧠 用户画像权重衰变已启动，间隔: 24小时`);
    });
    
    // 标记为已启动
    this.backgroundSyncStarted = true;
    
    // 在启动定时任务时直接运行一次，但添加防抖
    console.log('🔄 首次执行定时同步...');
    this.syncCache().catch(error => {
      console.error('后台同步失败:', error);
    });
    
    // 首次执行权重衰变
    console.log('🧠 首次执行权重衰变...');
    this.applyUserProfileDecay().catch((error: any) => {
      console.error('权重衰变失败:', error);
    });

    // 监听 alarm 事件
    this.setupAlarmListener();
  }

  /**
   * 设置 alarm 监听器
   */
  private setupAlarmListener(): void {
    // 避免重复添加监听器
    if (this.alarmListenerAdded) {
      return;
    }

    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === 'memory-system-sync') {
        console.log('🔄 执行定时同步...');
        this.syncCache().catch(error => {
          console.error('后台同步失败:', error);
        });
      } else if (alarm.name === 'user-profile-decay') {
        console.log('🧠 执行定时权重衰变...');
        this.applyUserProfileDecay().catch((error: any) => {
          console.error('定时权重衰变失败:', error);
        });
      }
    });

    this.alarmListenerAdded = true;
    console.log('🎯 alarm 监听器已设置（同步 + 权重衰变）');
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
