/**
 * 缓存策略管理器
 * 管理数据在本地缓存和云端存储之间的流转规则
 */

import { CloudStorage } from './CloudStorage';
import { LocalCache } from './LocalCache';
import { MemoryEntity, QueryResult, StoreResult, QueryOptions } from '../memory';

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
  private localCache: LocalCache;
  private config: StrategyConfig;
  private metrics: PerformanceMetrics;
  private alarmListenerAdded: boolean = false;
  private isInitialized = false;
  private backgroundSyncStarted = false;
  private isSyncing = false;

  constructor(cloudStorage: CloudStorage, localCache: LocalCache) {
    this.cloudStorage = cloudStorage;
    this.localCache = localCache;
    
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
  ): Promise<QueryResult<MemoryEntity>> {
    this.ensureInitialized();

    const startTime = Date.now();
    this.metrics.totalQueries++;

    try {
      // 如果有搜索词且长度大于2，考虑使用向量搜索
      if (searchTerm && searchTerm.length > 2) {
        return await this.handleVectorSearch(searchTerm, type, options);
      }

      // 普通实体查询，先尝试本地
      if (this.config.preferLocalForEntityQueries && type) {
        const localResult = await this.queryFromLocal(type, searchTerm, options);
        
        // 如果本地结果充足，直接返回
        if (localResult.data.length >= this.config.localSearchThreshold || !options.useCache) {
          this.updateMetrics('local', Date.now() - startTime);
          return localResult;
        }

        // 本地结果不足，尝试云端补充
        const cloudResult = await this.queryFromCloud(type, searchTerm, options);
        
        // 合并结果
        const mergedResult = this.mergeQueryResults(localResult, cloudResult);
        this.updateMetrics('hybrid', Date.now() - startTime);
        
        // 将云端新结果缓存到本地
        await this.cacheCloudResults(cloudResult.data);
        
        return mergedResult;
      }

      // 直接查询云端
      const cloudResult = await this.queryFromCloud(type, searchTerm, options);
      this.updateMetrics('cloud', Date.now() - startTime);
      
      // 缓存结果到本地
      await this.cacheCloudResults(cloudResult.data);
      
      return cloudResult;

    } catch (error) {
      console.error('查询实体失败:', error);
      
      // 出错时尝试返回本地结果
      if (type) {
        const fallbackResult = await this.queryFromLocal(type, searchTerm, options);
        fallbackResult.source = 'local';
        return fallbackResult;
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
      const localEntity = await this.localCache.getEntity(entityId);
      if (localEntity) {
        this.metrics.localHits++;
        return localEntity;
      }

      // 本地没有，从云端获取
      const cloudResult = await this.cloudStorage.searchByVector(`id:${entityId}`, undefined, { limit: 1 });
      if (cloudResult.data.length > 0) {
        const entity = cloudResult.data[0];
        // 缓存到本地
        await this.localCache.cacheEntity(entity);
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
    const entityId = `entity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
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
        await this.localCache.cacheEntity(fullEntity);
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
            await this.localCache.updateRecentData(
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
            await this.localCache.updateRecentData(
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
      const localEntity = await this.localCache.getEntity(entityId);
      if (localEntity) {
        const updatedEntity = { ...localEntity, ...updatedData };
        await this.localCache.cacheEntity(updatedEntity);
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
      await this.localCache.storeRelationship(relationship);
      
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
        
        await this.localCache.restoreRelationshipData(relationshipData);
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

      // 清理过期缓存
      await this.localCache.clearExpiredCache();

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
      const cloudEntities = await this.cloudStorage.getAllEntities();
      
      // 2. 批量同步云端实体到本地
      const cloudBatches = this.chunkArray(cloudEntities, 20); // 每批最多20个
      const entitiesToUpdate: MemoryEntity[] = [];
      
      for (const batch of cloudBatches) {
        for (const entity of batch) {
          const localEntity = await this.localCache.getEntity(entity.id);
          if (!localEntity || localEntity.updated < entity.updated) {
            // 🔄 缓存实体到本地
            await this.localCache.cacheEntity(entity);
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
        const recentDataCount = await this.localCache.batchUpdateRecentDataCacheFromRelations(entitiesToUpdate);
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
        await this.localCache.restoreRelationshipData(relationshipData);
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

  private async handleVectorSearch(
    searchTerm: string,
    type?: string,
    options: QueryOptions = {}
  ): Promise<QueryResult<MemoryEntity>> {
    // 向量搜索直接查询云端
    const cloudResult = await this.cloudStorage.searchByVector(searchTerm, type, options);
    
    // 缓存结果到本地
    await this.cacheCloudResults(cloudResult.data);
    
    return cloudResult;
  }

  private async queryFromLocal(
    type?: string,
    searchTerm?: string,
    options: QueryOptions = {}
  ): Promise<QueryResult<MemoryEntity>> {
    if (type) {
      return this.localCache.queryEntitiesByType(type, options);
    } else if (searchTerm) {
      return this.localCache.searchEntities(searchTerm, type, options);
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
    if (searchTerm) {
      return this.cloudStorage.searchByVector(searchTerm, type, options);
    } else {
      // 云端没有按类型的直接查询接口，返回空结果
      return {
        data: [],
        total: 0,
        source: 'cloud',
        cached: false,
        queryTime: 0
      };
    }
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
        await this.localCache.batchCacheEntities(entities);
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

  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('缓存策略未初始化');
    }
  }
}