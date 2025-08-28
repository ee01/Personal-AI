/**
 * 缓存策略管理器
 * 管理数据在本地缓存和云端存储之间的流转规则
 */

import { CloudStorage } from './CloudStorage';
import { LocalStorage } from './LocalStorage';
import { QueryResult, StoreResult, QueryOptions, VectorSearchOptions } from '../memory';
import { MemoryEntity } from './CloudStorage';
import { CachedEntityDetail } from './LocalStorage';
import { v4 as uuidv4 } from 'uuid';

// 策略配置
interface StrategyConfig {
  // 读取策略
  preferLocalForEntityQueries: boolean;
  localSearchThreshold: number; // 本地搜索结果低于此数量时查询云端
  cloudFallbackTimeout: number; // 云端查询超时时间
  
  // 存储策略
  requireCloudSuccess: boolean; // 是否必须云端存储成功
  retryAttempts: number; // 重试次数
  retryDelay: number; // 重试延迟
  
  // 同步策略
  syncInterval: number; // 同步间隔
  maxSyncBatchSize: number; // 单次同步最大数量
  prioritizeRecentData: boolean; // 是否优先同步最近数据
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
 * 缓存策略管理器
 */
export class CacheStrategy {
  private cloudStorage: CloudStorage;
  private localStorage: LocalStorage;
  private config: StrategyConfig;
  private metrics: PerformanceMetrics;
  private alarmListenerAdded: boolean = false;
  private isInitialized = false;
  private backgroundSyncStarted = false;
  private isSyncing = false;

  constructor(cloudStorage: CloudStorage, localStorage: LocalStorage) {
    this.cloudStorage = cloudStorage;
    this.localStorage = localStorage;
    
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
   * 初始化缓存策略
   */
  async initialize(): Promise<boolean> {
    try {
      console.log('🎯 初始化缓存策略...');

      // 加载配置
      await this.loadConfig();
      
      // 加载性能指标
      await this.loadMetrics();

      this.isInitialized = true;
      console.log('✅ 缓存策略初始化完成');
      return true;

    } catch (error) {
      console.error('❌ 缓存策略初始化失败:', error);
      return false;
    }
  }

  // ==================== 查询策略 ====================

  /**
   * 智能查询实体（根据策略选择本地或云端）
   */
  async queryEntities(
    type?: string,
    searchTerm?: string,
    options: QueryOptions = {}
  ): Promise<QueryResult<CachedEntityDetail>> {
    this.ensureInitialized();

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
      
      console.log(`🎯 CacheStrategy.queryEntities: 查询到 ${cloudResult.data.length} 个实体，扩展信息后 ${extendedData.length} 个`);
      
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
   * 获取实体详情（优先本地）
   */
  async getEntityDetails(entityId: string): Promise<MemoryEntity | null> {
    this.ensureInitialized();

    try {
      // 先从本地获取
      const localEntity = await this.localStorage.getEntity(entityId);
      if (localEntity) {
        this.metrics.localHits++;
        return localEntity;
      }

      // 本地没有，从云端获取
      const vectorOptions: VectorSearchOptions = { limit: 1 };
      const cloudResult = await this.cloudStorage.searchByVector(`id:${entityId}`, undefined, vectorOptions);
      if (cloudResult.data.length > 0) {
        const entity = cloudResult.data[0];
        // 缓存到本地
        await this.localStorage.cacheEntity(entity);
        this.metrics.cloudHits++;
        return entity;
      }

      return null;

    } catch (error) {
      console.error('获取实体详情失败:', error);
      return null;
    }
  }

  // ==================== 存储策略 ====================

  /**
   * 存储实体（先云端后本地）
   */
  async storeEntity(entity: Omit<MemoryEntity, 'id' | 'created' | 'updated'>): Promise<StoreResult> {
    this.ensureInitialized();

    const startTime = Date.now();
    const entityId = this.generateEntityId(entity.name);
    
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
      // 构建完整实体
      const fullEntity: MemoryEntity = {
        ...entity,
        id: entityId,
        created: Date.now(),
        updated: Date.now(),
        accessCount: 0,
        lastAccessed: Date.now()
      };

      // 1. 先存储到云端
      let attempts = 0;
      while (attempts < this.config.retryAttempts) {
        try {
          const cloudSuccess = await this.cloudStorage.storeEntity(fullEntity as any);
          if (cloudSuccess) {
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

      console.log(`💾 实体存储完成: ${entityId}`, {
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
   * 存储消息（先云端后本地）
   */
  async storeMessage(messageData: {
    id: string;
    content: string;
    metadata: any;
    entities?: Array<Omit<MemoryEntity, 'id' | 'created' | 'updated'>>;
  }): Promise<StoreResult> {
    this.ensureInitialized();

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
      // 1. 存储消息到云端
      const cloudSuccess = await this.cloudStorage.storeMessage(messageData);
      result.cloudStored = cloudSuccess;

      // 2. 处理实体（如果有）
      if (messageData.entities && messageData.entities.length > 0) {
        for (const entityData of messageData.entities) {
          const entityResult = await this.storeEntity(entityData);
          if (entityResult.success) {
            result.relationshipsCreated++;
            
            // 🆕 创建实体与消息的关系
            await this.createEntityMessageRelationship(
              entityResult.entityId,
              messageData.id,
              messageData.metadata
            );
            
            // 更新相关实体的最近数据缓存
            await this.localStorage.updateRecentData(
              entityResult.entityId,
              'conversation',
              {
                id: messageData.id,
                content: messageData.content.substring(0, 200),
                summary: messageData.metadata.summary || '',
                timestamp: messageData.metadata.timestamp || Date.now(),
                sender: messageData.metadata.sender || 'unknown'
              }
            );
          }
        }
      }

      result.success = result.cloudStored;
      result.processingTime = Date.now() - startTime;

      return result;

    } catch (error) {
      console.error('存储消息失败:', error);
      result.errors?.push(error.message);
      result.processingTime = Date.now() - startTime;
      return result;
    }
  }

  /**
   * 存储网页（先云端后本地）
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
    this.ensureInitialized();

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
    this.ensureInitialized();

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
    this.ensureInitialized();

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

  // ==================== 同步策略 ====================

  /**
   * 启动后台同步
   */
  startBackgroundSync(): void {
    // 防止重复启动
    if (this.backgroundSyncStarted) {
      console.log('⚠️ 后台同步已启动，跳过重复启动');
      return;
    }

    // 使用 Chrome alarms API 进行后台同步
    const alarmName = 'memory-system-sync';
    
    chrome.alarms.clear(alarmName, () => {
      // 创建新的 alarm，每5分钟同步一次
      chrome.alarms.create(alarmName, {
        periodInMinutes: this.config.syncInterval / (60 * 1000)
      });
      
      console.log(`🔄 后台同步已启动，间隔: ${this.config.syncInterval / (60 * 1000)} 分钟`);
    });
    
    // 标记为已启动
    this.backgroundSyncStarted = true;
    
    // 在启动定时任务时直接运行一次，但添加防抖
    console.log('🔄 首次执行定时同步...');
    this.syncCache().catch(error => {
      console.error('后台同步失败:', error);
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
        this.syncCache().catch(error => {
          console.error('后台同步失败:', error);
        });
      }
    });

    this.alarmListenerAdded = true;
  }

  /**
   * 停止后台同步
   */
  stopBackgroundSync(): void {
    // 清除 Chrome alarm
    chrome.alarms.clear('memory-system-sync', (wasCleared) => {
      console.log('⏹️ 后台同步已停止:', wasCleared);
    });
    
    // 重置状态
    this.backgroundSyncStarted = false;
  }



  /**
   * 🆕 创建实体与消息的关系
   */
  private async createEntityMessageRelationship(
    entityId: string,
    messageId: string,
    messageMetadata: any
  ): Promise<void> {
    try {
      const relationship = {
        id: `rel_${entityId}_${messageId}_discovered_in`,
        type: 'discovered_in',
        fromId: entityId,
        toId: messageId,
        properties: {
          source: 'message',
          messageId: messageId,
          discoveredAt: Date.now(),
          sender: messageMetadata.source || 'unknown',
          teamName: messageMetadata.teamName || '',
          teamId: messageMetadata.teamId || ''
        },
        strength: 0.8, // 实体与发现它的消息关系较强
        created: Date.now(),
        updated: Date.now()
      };

      // 存储关系到本地缓存
      await this.localStorage.storeRelationship(relationship);
      
      console.log(`✅ 创建实体-消息关系: ${entityId} -> ${messageId}`);
    } catch (error) {
      console.error('创建实体-消息关系失败:', error);
    }
  }

  /**
   * 从消息数据重建关系表
   */
  private async rebuildRelationshipsFromMessages(): Promise<number> {
    try {
      const messagesCollection = await this.cloudStorage.getMessagesCollection();
      if (!messagesCollection) {
        console.log('⚠️ 无法访问消息集合');
        return 0;
      }

      // 获取所有消息数据
      const messagesData = await messagesCollection.get({
        include: ['metadatas' as any]
      });

      if (!messagesData.ids || messagesData.ids.length === 0) {
        console.log('📭 没有找到消息数据');
        return 0;
      }

      let rebuiltRelationships = 0;
      const relationshipMap = new Map<string, any>();

      for (let i = 0; i < messagesData.ids.length; i++) {
        const metadata = messagesData.metadatas![i] as any;
        
        if (metadata.relationships) {
          try {
            const relationships = typeof metadata.relationships === 'string' 
              ? JSON.parse(metadata.relationships) 
              : metadata.relationships;
            
            if (Array.isArray(relationships)) {
              for (const rel of relationships) {
                const relationshipId = this.generateRelationshipId(rel.source, rel.target, rel.relationship);
                
                if (!relationshipMap.has(relationshipId)) {
                  relationshipMap.set(relationshipId, {
                    id: relationshipId,
                    type: rel.relationship,
                    fromId: this.normalizeEntityId(rel.source),
                    toId: this.normalizeEntityId(rel.target),
                    properties: {
                      source: 'message',
                      messageId: messagesData.ids[i],
                      discoveredAt: metadata.timestamp || Date.now()
                    },
                    strength: 0.7,
                    created: metadata.timestamp || Date.now(),
                    updated: metadata.timestamp || Date.now()
                  });
                  
                  rebuiltRelationships++;
                }
              }
            }
          } catch (e) {
            console.warn(`解析消息关系数据失败 ${messagesData.ids[i]}:`, e);
          }
        }
      }

      // 保存重建的关系到本地
      if (rebuiltRelationships > 0) {
        const relationshipData = {
          relationships: Array.from(relationshipMap.entries()),
          entityToRelations: [] as any[], // 稍后会重建
          typeToEntities: [] as any[]
        };
        
        await this.localStorage.restoreRelationshipData(relationshipData);
      }

      console.log(`🔄 从消息数据重建了 ${rebuiltRelationships} 个关系`);
      return rebuiltRelationships;

    } catch (error) {
      console.error('❌ 从消息数据重建关系失败:', error);
      return 0;
    }
  }

  /**
   * 生成关系ID
   */
  private generateRelationshipId(source: string, target: string, relationType: string): string {
    const fromId = this.normalizeEntityId(source);
    const toId = this.normalizeEntityId(target);
    return `rel_${fromId}_${toId}_${relationType}`;
  }

  /**
   * 标准化实体ID
   */
  private normalizeEntityId(name: string): string {
    if (!name || typeof name !== 'string') {
      return '';
    }
    
    return name.trim()
      .replace(/["']/g, '')
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^\w\u4e00-\u9fff]/g, '');
  }

  /**
   * 检查并执行新设备初始同步
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
   * 同步缓存
   */
  async syncCache(): Promise<void> {
    if (this.isSyncing) {
      // console.log('⏭️ 同步程序还在进行，跳过本次同步');
      return;
    }
    this.isSyncing = true;
    console.log('🔄 执行定时同步...');
    this.ensureInitialized();

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

      // 3. 从云端恢复关系数据
      await this.syncRelationshipsFromCloud();

      // 4. 基于同步的关系数据，批量更新最近数据缓存
      if (entitiesToUpdate.length > 0) {
        console.log(`🔗 开始基于关系数据更新最近数据缓存...`);
        const recentDataCount = await this.localStorage.batchUpdateRecentDataCacheFromRelations(entitiesToUpdate);
        recentDataUpdated += recentDataCount;
      }

      console.log(`✅ 单向同步完成: 同步了${syncedEntities}个实体，更新了${recentDataUpdated}个实体的最近数据缓存`);

    } catch (error) {
      console.error('❌ 云端到本地同步失败:', error);
    }
  }



  /**
   * 从云端同步关系数据到本地
   */
  private async syncRelationshipsFromCloud(): Promise<void> {
    try {
      console.log('🔗 开始从云端恢复关系数据...');
      
      // 尝试从云端恢复关系数据
      const relationshipData = await this.cloudStorage.restoreRelationships();
      
      if (relationshipData) {
        // 将关系数据保存到本地
        await this.localStorage.restoreRelationshipData(relationshipData);
        console.log(`✅ 从云端恢复了 ${relationshipData.relationships.length} 个关系到本地缓存`);
      } else {
        // 如果云端没有关系备份，尝试从消息重建
        console.log('🔄 云端无关系备份，尝试从消息数据重建关系...');
        const rebuiltCount = await this.rebuildRelationshipsFromMessages();
        console.log(`🔄 从消息重建了 ${rebuiltCount} 个关系`);
      }

    } catch (error) {
      console.error('❌ 从云端同步关系数据失败:', error);
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
   * 生成基于实体名称和UUID的实体ID
   */
  private generateEntityId(entityName: string): string {
    // 清理和转换名称
    const cleanName = this.sanitizeEntityName(entityName);
    const uuid = uuidv4().substring(0, 8); // 取UUID的前8位
    return `${cleanName}_${uuid}`;
  }

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

  private mergeQueryResults(
    localResult: QueryResult<MemoryEntity>,
    cloudResult: QueryResult<MemoryEntity>
  ): QueryResult<MemoryEntity> {
    // 去重合并
    const seenIds = new Set<string>();
    const mergedData: MemoryEntity[] = [];

    // 优先保留本地结果
    for (const entity of localResult.data) {
      if (!seenIds.has(entity.id)) {
        seenIds.add(entity.id);
        mergedData.push(entity);
      }
    }

    // 添加云端新结果
    for (const entity of cloudResult.data) {
      if (!seenIds.has(entity.id)) {
        seenIds.add(entity.id);
        mergedData.push(entity);
      }
    }

    return {
      data: mergedData,
      total: localResult.total + cloudResult.total,
      source: 'hybrid',
      cached: true,
      queryTime: Math.max(localResult.queryTime, cloudResult.queryTime)
    };
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
        latestConversations: [],
        latestWebpages: [],
        relatedResources: [],
        relatedProjects: []
      };
      
      try {
        // 获取扩展缓存数据
        const cacheData = await this.localStorage.getRecentData(entity.id);
        
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
    extendedEntity.latestConversations = [];
    extendedEntity.latestWebpages = [];
    extendedEntity.relatedResources = [];
    extendedEntity.relatedProjects = [];
    
    // 确保统计字段存在
    if (!extendedEntity.statistic) {
      extendedEntity.statistic = {
        conversations: 0,
        projects: 0,
        participants: 1,
        resources: 0,
        documents: 0,
        webpages: 0,
        relationships: entity.properties?.relationshipsCount || 0
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
   * 格式化时间为相对时间
   */
  private formatTimeAgo(timestamp: number | string): string {
    const now = Date.now();
    const time = typeof timestamp === 'string' ? new Date(timestamp).getTime() : timestamp;
    const diff = now - time;
    
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    const weeks = Math.floor(diff / 604800000);
    
    if (hours < 1) return '刚刚';
    if (hours < 24) return `${hours}小时前`;
    if (days < 7) return `${days}天前`;
    if (weeks < 4) return `${weeks}周前`;
    return new Date(time).toLocaleDateString();
  }

  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('缓存策略未初始化');
    }
  }
}