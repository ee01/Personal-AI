/**
 * 统一记忆系统接口层
 * 提供清晰的读取和存储接口，管理本地缓存和云端存储
 */

import { CloudStorage, MemoryEntity } from './storage/CloudStorage';
import { GraphRelationship, LocalStorage, CachedEntityDetail } from './storage/LocalStorage';
import { CacheStrategy } from './storage/CacheStrategy';
import { EntitySimilarityTool, ProcessedEntity, EntityMergePair } from './storage/EntitySimilarityTool';
import { SystemMaintenanceTool, SystemHealthStatus, MaintenanceResult, createSystemMaintenanceTool } from './storage/SystemMaintenanceTool';
import { UserProfileManager } from './services/UserProfileManager';
import { UserProfile, UserProfileAnalysis, UserAction, UserProfileUpdate } from './types/userProfile';

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

/**
 * 统一记忆系统管理器
 */
export class MemorySystem {
  private cloudStorage: CloudStorage;
  private localStorage: LocalStorage;
  private cacheStrategy: CacheStrategy;
  private entitySimilarityTool: EntitySimilarityTool;
  private systemMaintenanceTool: SystemMaintenanceTool;
  private userProfileManager: UserProfileManager | null = null;
  private isInitialized = false;

  constructor() {
    this.cloudStorage = new CloudStorage();
    this.localStorage = new LocalStorage();
    this.cacheStrategy = new CacheStrategy(this.cloudStorage, this.localStorage);
    this.entitySimilarityTool = new EntitySimilarityTool();
    this.systemMaintenanceTool = createSystemMaintenanceTool(
      this.cloudStorage, 
      this.localStorage, 
      this.cacheStrategy
    );
  }

  /**
   * 初始化记忆系统
   */
  async initialize(): Promise<boolean> {
    // 防止重复初始化
    if (this.isInitialized) {
      console.log('⚠️ 记忆系统已初始化，跳过重复初始化');
      return true;
    }

    try {
      console.log('🧠 初始化记忆系统...');
      
      // 并行初始化各组件
      const [cloudInit, localInit, strategyInit] = await Promise.all([
        this.cloudStorage.initialize(),
        this.localStorage.initialize(),
        this.cacheStrategy.initialize()
      ]);

      this.isInitialized = cloudInit && localInit && strategyInit;
      
      if (this.isInitialized) {
        console.log('✅ 记忆系统初始化完成');
        // 启动后台同步
        this.cacheStrategy.startBackgroundSync();
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

  // ==================== 读取接口 ====================

  /**
   * 查询实体（普通查询，先本地后云端）
   */
  async queryEntities(
    type?: string,
    searchTerm?: string,
    options: QueryOptions = {}
  ): Promise<QueryResult<CachedEntityDetail>> {
    this.ensureInitialized();
    return this.cacheStrategy.queryEntities(type, searchTerm, options);
  }

  /**
   * 向量搜索（直接云端查询）
   */
  async searchByVector(
    query: string,
    type?: string,
    options: VectorSearchOptions = {}
  ): Promise<QueryResult<MemoryEntity>> {
    this.ensureInitialized();
    return this.cloudStorage.searchByVector(query, type, options);
  }

  /**
   * 获取实体详情
   */
  async getEntityDetails(entityId: string): Promise<MemoryEntity | null> {
    this.ensureInitialized();
    return this.cacheStrategy.getEntityDetails(entityId);
  }

  /**
   * 获取实体的最近数据缓存
   */
  async getRecentData(entityId: string): Promise<CachedEntityDetail | null> {
    this.ensureInitialized();
    return this.localStorage.getRecentData(entityId);
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
    this.ensureInitialized();
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
    this.ensureInitialized();
    
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
    this.ensureInitialized();
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
    this.ensureInitialized();
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
    this.ensureInitialized();
    
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
    this.ensureInitialized();
    return this.cacheStrategy.storeEntity(entity);
  }

  /**
   * 存储消息（先云端后本地）- 🆕 简化版，不再处理实体关联数据
   */
  async storeMessage(messageData: {
    id: string;
    content: string;
    metadata: any;
  }): Promise<StoreResult> {
    this.ensureInitialized();
    
    try {
      // 存储到记忆系统（实体数据已包含在metadata中）
      const result = await this.cacheStrategy.storeMessage(messageData);
      
      // 同时更新用户画像
      if (result.success && this.userProfileManager && messageData.metadata?.entities) {
        await this.updateUserProfileFromEntities(messageData.metadata?.entities, {
          actionType: 'mention',
          timestamp: Date.now(),
          context: 'message_analysis',
          metadata: {
            messageId: messageData.id,
            source: messageData.metadata?.source || 'unknown'
          }
        });
      }
      
      return result;
    } catch (error) {
      console.error('存储消息失败:', error);
      throw error;
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
    this.ensureInitialized();
    
    try {
      // 存储到记忆系统
      const result = await this.cacheStrategy.storeWebpage(webpageData);
      
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
      throw error;
    }
  }

  /**
   * 更新实体（同步更新本地和云端）
   */
  async updateEntity(entityId: string, updates: Partial<MemoryEntity>): Promise<StoreResult> {
    this.ensureInitialized();
    return this.cacheStrategy.updateEntity(entityId, updates);
  }

  /**
   * 删除实体（同步删除本地和云端）
   */
  async deleteEntity(entityId: string): Promise<boolean> {
    this.ensureInitialized();
    return this.cacheStrategy.deleteEntity(entityId);
  }

  /**
   * 批量存储实体
   */
  async batchStoreEntities(entities: Array<Omit<MemoryEntity, 'id' | 'created' | 'updated'>>): Promise<{
    success: number;
    failed: number;
    results: StoreResult[];
  }> {
    this.ensureInitialized();
    return this.cacheStrategy.batchStoreEntities(entities);
  }

  // ==================== 缓存管理接口 ====================

  /**
   * 更新实体的最近数据缓存
   */
  async updateRecentData(entityId: string, type: 'conversation' | 'resource' | 'project' | 'webpage', data: any): Promise<void> {
    this.ensureInitialized();
    return this.localStorage.updateRecentData(entityId, type, data);
  }

  // TOPIC_DETAILS 缓存方法已移除，统一使用 getRecentData() 避免重复存储

  /**
   * 将基础实体扩展为详细缓存实体
   */
  async extendEntityToDetailCache(entity: MemoryEntity): Promise<CachedEntityDetail> {
    this.ensureInitialized();
    return this.cloudStorage.extendEntityToDetailCache(entity);
  }

  /**
   * 清理过期缓存
   */
  async clearExpiredCache(): Promise<void> {
    this.ensureInitialized();
    return this.localStorage.clearExpiredCache();
  }

  /**
   * 强制同步缓存
   */
  async syncCache(): Promise<void> {
    this.ensureInitialized();
    return this.cacheStrategy.syncCache();
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
    this.ensureInitialized();
    return await this.cacheStrategy.performInitialSyncIfNeeded();
  }

  /**
   * 备份关系数据到云端
   */
  async backupRelationships(): Promise<boolean> {
    this.ensureInitialized();
    
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
    this.ensureInitialized();

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
    this.ensureInitialized();

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
      lastSyncTime: await this.cacheStrategy.getLastSyncTime(),
      performance: await this.cacheStrategy.getPerformanceMetrics()
    };
  }

  // ==================== 实体相似性管理接口 ====================

  /**
   * 处理实体相似性检测
   */
  async processEntitySimilarity(entity: Omit<MemoryEntity, 'id' | 'created' | 'updated'>): Promise<ProcessedEntity> {
    this.ensureInitialized();
    return this.entitySimilarityTool.processEntity(entity);
  }

  /**
   * 批量处理实体相似性
   */
  async processEntitiesSimilarity(entities: Array<Omit<MemoryEntity, 'id' | 'created' | 'updated'>>): Promise<ProcessedEntity[]> {
    this.ensureInitialized();
    return this.entitySimilarityTool.processEntities(entities);
  }

  /**
   * 获取待处理的实体合并候选
   */
  async getPendingEntityMerges(): Promise<EntityMergePair[]> {
    this.ensureInitialized();
    return this.entitySimilarityTool.getPendingMerges();
  }

  /**
   * 确认实体合并
   */
  async confirmEntityMerge(mergeId: string): Promise<boolean> {
    this.ensureInitialized();
    return this.entitySimilarityTool.confirmMerge(mergeId);
  }

  /**
   * 拒绝实体合并
   */
  async rejectEntityMerge(mergeId: string): Promise<boolean> {
    this.ensureInitialized();
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
    this.ensureInitialized();
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
    this.ensureInitialized();
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
    this.ensureInitialized();
    
    if (!this.userProfileManager) {
      return { profile: null, analysis: null };
    }
    
    try {
      const profile = this.userProfileManager.getProfile();
      const analysis = await this.userProfileManager.analyzeProfile();
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
    this.ensureInitialized();
    
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
    this.ensureInitialized();
    
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
    this.ensureInitialized();
    
    if (this.userProfileManager) {
      await this.userProfileManager.applyWeightDecay();
    }
  }

  /**
   * 🆕 更新实体关联数据 - 从消息元数据中提取实体并更新其关联信息
   */
  async updateEntitiesWithRelatedData(
    messageMetadata: any,
    messageId: string
  ): Promise<void> {
    this.ensureInitialized();
    return this.cloudStorage.updateEntitiesWithRelatedData(messageMetadata, messageId, this);
  }

  // ==================== 私有方法 ====================

  /**
   * 初始化用户画像管理器
   */
  private async initializeUserProfile(): Promise<void> {
    try {
      // 获取当前用户信息
      const userinfo = await chrome.storage.local.get(['userinfo']);
      const userId = userinfo?.userinfo?.email || 'default_user';
      
      // 重用现有的 CloudStorage 实例，避免重复初始化
      this.userProfileManager = new UserProfileManager(userId, {}, this.cloudStorage);
      await this.userProfileManager.initialize();
      
      console.log('✅ 用户画像管理器初始化成功');
    } catch (error) {
      console.error('❌ 用户画像管理器初始化失败:', error);
      // 不要抛出异常，允许记忆系统继续运行
    }
  }

  /**
   * 从实体列表更新用户画像
   */
  private async updateUserProfileFromEntities(
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
          userId: this.userProfileManager['userId'],
          action,
          targetItem: {
            id: entity.name.replace(/\s+/g, '_').toLowerCase(),
            type: profileType,
            name: entity.name,
            metadata: {
              entityType: entity.type,
              description: entity.description,
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

  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('记忆系统未初始化，请先调用 initialize() 方法');
    }
  }
}

// 导出单例实例
export const memorySystem = new MemorySystem();
