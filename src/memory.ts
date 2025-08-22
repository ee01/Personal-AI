/**
 * 统一记忆系统接口层
 * 提供清晰的读取和存储接口，管理本地缓存和云端存储
 */

import { CloudStorage } from './storage/CloudStorage';
import { GraphRelationship, LocalCache } from './storage/LocalCache';
import { CacheStrategy } from './storage/CacheStrategy';
import { EntitySimilarityTool, ProcessedEntity, EntityMergePair } from './storage/EntitySimilarityTool';
import { SystemMaintenanceTool, SystemHealthStatus, MaintenanceResult, createSystemMaintenanceTool } from './storage/SystemMaintenanceTool';

// 统一的实体接口
export interface MemoryEntity {
  id: string;
  type: 'Person' | 'Project' | 'Task' | 'Organization' | 'Document' | 'Technology' | 'Topic';
  name: string;
  description?: string;
  properties: Record<string, any>;
  created: number;
  updated: number;
  accessCount: number;
  lastAccessed: number;
  importance: number;
  tags?: string[];
  status?: string;
  avatarUrl?: string;
}

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

// 最近数据接口
export interface RecentData {
  entityId: string;
  conversations: any[];  // 最近5条聊天记录
  resources: any[];      // 最近5条资源
  projects: any[];       // 最近5条项目
  webpages: any[];       // 最近5条浏览历史
  lastUpdated: number;
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
export interface VectorSearchOptions extends QueryOptions {
  threshold?: number;
  includeMetadata?: boolean;
  nResults?: number;
}

/**
 * 统一记忆系统管理器
 */
export class MemorySystem {
  private cloudStorage: CloudStorage;
  private localCache: LocalCache;
  private cacheStrategy: CacheStrategy;
  private entitySimilarityTool: EntitySimilarityTool;
  private systemMaintenanceTool: SystemMaintenanceTool;
  private isInitialized = false;

  constructor() {
    this.cloudStorage = new CloudStorage();
    this.localCache = new LocalCache();
    this.cacheStrategy = new CacheStrategy(this.cloudStorage, this.localCache);
    this.entitySimilarityTool = new EntitySimilarityTool();
    this.systemMaintenanceTool = createSystemMaintenanceTool(
      this.cloudStorage, 
      this.localCache, 
      this.cacheStrategy
    );
  }

  /**
   * 初始化记忆系统
   */
  async initialize(): Promise<boolean> {
    try {
      console.log('🧠 初始化记忆系统...');
      
      // 并行初始化各组件
      const [cloudInit, localInit, strategyInit] = await Promise.all([
        this.cloudStorage.initialize(),
        this.localCache.initialize(),
        this.cacheStrategy.initialize()
      ]);

      this.isInitialized = cloudInit && localInit && strategyInit;
      
      if (this.isInitialized) {
        console.log('✅ 记忆系统初始化完成');
        // 启动后台同步
        this.cacheStrategy.startBackgroundSync();
        // 启动系统监控
        this.systemMaintenanceTool.startMonitoring();
      } else {
        console.error('❌ 记忆系统初始化失败');
      }

      return this.isInitialized;
    } catch (error) {
      console.error('❌ 记忆系统初始化异常:', error);
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
  ): Promise<QueryResult<MemoryEntity>> {
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
  async getRecentData(entityId: string): Promise<RecentData | null> {
    this.ensureInitialized();
    return this.localCache.getRecentData(entityId);
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
    return this.localCache.getEntityStatistics();
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
      // 使用向量搜索
      return this.searchByVector(query, entityType, options);
    } else {
      // 使用普通查询
      return this.queryEntities(entityType, query, options);
    }
  }

  /**
   * 获取关系网络
   */
  async getRelationships(entityId: string, depth: number = 1): Promise<{
    entities: MemoryEntity[];
    relationships: GraphRelationship[];
  }> {
    this.ensureInitialized();
    return this.localCache.getRelationshipNetwork(entityId, depth);
  }

  /**
   * 获取时间轴数据
   */
  async getTimeline(limit: number = 50): Promise<Array<{
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

  // ==================== 存储接口 ====================

  /**
   * 存储实体（先云端后本地）
   */
  async storeEntity(entity: Omit<MemoryEntity, 'id' | 'created' | 'updated'>): Promise<StoreResult> {
    this.ensureInitialized();
    return this.cacheStrategy.storeEntity(entity);
  }

  /**
   * 存储消息（先云端后本地）
   */
  async storeMessage(messageData: {
    id: string;
    content: string;
    metadata: any;
    entities?: Array<Omit<MemoryEntity, 'id' | 'created' | 'updated'>>;
  }): Promise<StoreResult> {
    this.ensureInitialized();
    return this.cacheStrategy.storeMessage(messageData);
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
    return this.cacheStrategy.storeWebpage(webpageData);
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
    return this.localCache.updateRecentData(entityId, type, data);
  }

  /**
   * 缓存主题详情数据（用于主题列表优化）
   */
  async cacheTopicDetails(topicId: string, details: {
    conversations: any[];
    resources: any[];
    projects: any[];
    webpages: any[];
  }): Promise<void> {
    this.ensureInitialized();
    return this.localCache.cacheTopicDetails(topicId, details);
  }

  /**
   * 获取缓存的主题详情
   */
  async getCachedTopicDetails(topicId: string): Promise<{
    conversations: any[];
    resources: any[];
    projects: any[];
    webpages: any[];
  } | null> {
    this.ensureInitialized();
    return this.localCache.getCachedTopicDetails(topicId);
  }

  /**
   * 清理过期缓存
   */
  async clearExpiredCache(): Promise<void> {
    this.ensureInitialized();
    return this.localCache.clearExpiredCache();
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
      const relationshipData = await this.localCache.getRelationshipBackupData();
      
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

      await this.localCache.cacheRelationship(fullRelationship);
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
      localCacheSize: await this.localCache.getCacheSize(),
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

  // ==================== 私有方法 ====================

  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('记忆系统未初始化，请先调用 initialize() 方法');
    }
  }
}

// 导出单例实例
export const memorySystem = new MemorySystem();
