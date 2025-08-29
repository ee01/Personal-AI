/**
 * 本地缓存管理器
 * 专门管理 Chrome Storage 缓存，包括实体基础信息、关系索引和最近数据
 */

import { QueryResult, QueryOptions } from '../memory';
import { MemoryEntity } from './CloudStorage';

// 统一的缓存实体详情接口 - 包含所有本地缓存数据
export interface CachedEntityDetail extends MemoryEntity {
  cachedAt: number;
  
  // 🆕 使用扩展的关联数据接口，只存储最近5条详细数据
  recentDataDetails: {
    conversations: (MemoryEntity['relatedData']['conversations'][0] & {
      originalContent: string; // 完整的消息内容
      matchedRules: string[]; // 匹配的过滤规则
      contextMessages: Array<{
        id: string;
        sender: string;
        content: string;
        datetime: string;
        isMainMessage: boolean;
      }>; // 上下文消息
    })[];
    webpages: MemoryEntity['relatedData']['webpages'];
    resources: MemoryEntity['relatedData']['resources'];
    projects: MemoryEntity['relatedData']['projects'];
    people: MemoryEntity['relatedData']['people'];
    topics: MemoryEntity['relatedData']['topics'];
    jiraTickets: MemoryEntity['relatedData']['jiraTickets'];
    cooccurringEntities: MemoryEntity['relatedData']['cooccurringEntities'];
  };
  
  // 本地特有的参与者关系（通过关系表快速查询）
  relatedParticipants: {
    id: string;
    name: string;
    role: string;
    team: string;
    lastContact: number;
  }[];
  
  // 额外的 UI 字段（向后兼容）
  lastUpdated?: number;
}

// 关系类型定义
export interface GraphRelationship {
  id: string;
  type: string;
  fromId: string;
  toId: string;
  properties: Record<string, any>;
  strength: number;
  created: number;
  updated: number;
}

// 缓存键前缀
const CACHE_KEYS = {
  ENTITIES: 'cache_entities', // 统一存储 CachedEntityDetail 格式，移除 RECENT_DATA
  ENTITY_INDEX: 'cache_entity_index',
  TYPE_INDEX: 'cache_type_index',
  RELATIONSHIPS: 'cache_relationships',
  RELATIONSHIP_INDEX: 'cache_relationship_index',
  STATISTICS: 'cache_statistics'
};

// 缓存配置
interface CacheConfig {
  maxEntitiesInMemory: number;
  maxRecentDataPerEntity: number;
  statisticsCacheDuration: number; // 统计信息缓存时长
  recentDataCacheDuration: number; // 最近数据缓存时长
  // 新增：最近数据同步配置
  enableRecentDataSync: boolean; // 是否启用基于关系的最近数据同步
  recentDataSyncBatchSize: number; // 最近数据同步批次大小
  recentDataQueryLimit: number; // 单个实体最近数据查询限制
}



// 实体索引
interface EntityIndex {
  [entityId: string]: {
    type: string;
    name: string;
    lastAccessed: number;
    inMemory: boolean;
  };
}

// 类型索引
interface TypeIndex {
  [type: string]: string[]; // 实体ID列表
}

// 关系索引
interface RelationshipIndex {
  [entityId: string]: string[]; // 关联的关系ID列表
}

/**
 * 本地存储管理器
 */
export class LocalStorage {
  private config: CacheConfig;
  private memoryEntities: Map<string, MemoryEntity> = new Map();
  private memoryRelationships: Map<string, GraphRelationship> = new Map();
  private isInitialized = false;

  constructor() {
    this.config = {
      maxEntitiesInMemory: 1000, // 内存中最多保存1000个实体
      maxRecentDataPerEntity: 5, // 每个实体最多保存5条最近数据
      statisticsCacheDuration: 30 * 60 * 1000, // 30分钟
      recentDataCacheDuration: 6 * 60 * 60 * 1000, // 6小时
      // 新增：最近数据同步配置
      enableRecentDataSync: true, // 启用基于关系的最近数据同步
      recentDataSyncBatchSize: 10, // 每批处理10个实体的最近数据
      recentDataQueryLimit: 5 // 每个实体最多查询5条最近数据
    };
  }

  /**
   * 初始化本地缓存
   */
  async initialize(): Promise<boolean> {
    try {
      console.log('💾 初始化本地缓存...');

      // 加载实体到内存
      await this.loadEntitiesToMemory();
      
      // 加载关系到内存
      await this.loadRelationshipsToMemory();

      // 启动定期清理
      this.startPeriodicCleanup();

      this.isInitialized = true;
      console.log('✅ 本地缓存初始化完成');
      return true;

    } catch (error) {
      console.error('❌ 本地缓存初始化失败:', error);
      return false;
    }
  }

  // ==================== 实体缓存管理 ====================

  /**
   * 获取实体详情（统一的CachedEntityDetail格式，先内存后存储）
   */
  async getEntity(entityId: string): Promise<CachedEntityDetail | null> {
    this.ensureInitialized();

    // 从存储获取完整的 CachedEntityDetail
    try {
      const result = await chrome.storage.local.get(`${CACHE_KEYS.ENTITIES}_${entityId}`);
      const entity = result[`${CACHE_KEYS.ENTITIES}_${entityId}`] as CachedEntityDetail;
      
      if (entity) {
        // 更新访问时间
        entity.lastAccessed = Date.now();
        entity.accessCount = (entity.accessCount || 0) + 1;
        
        // 确保实体包含所有必要的字段
        this.ensureDetailEntityFields(entity);
        
        // 同步基础实体到内存（如果空间允许）
        if (this.memoryEntities.size < this.config.maxEntitiesInMemory) {
          const baseEntity = this.convertToBaseEntity(entity);
          this.memoryEntities.set(entityId, baseEntity);
        }
        
        return entity;
      }
    } catch (error) {
      console.error('从存储获取实体失败:', error);
    }

    return null;
  }

  /**
   * 按类型查询实体
   */
  async queryEntitiesByType(
    type: string,
    options: QueryOptions = {}
  ): Promise<QueryResult<MemoryEntity>> {
    this.ensureInitialized();
    
    const startTime = Date.now();
    const { limit = 50, offset = 0, sortBy = 'lastAccessed', sortOrder = 'desc' } = options;

    try {
      // 获取类型索引
      const typeIndex = await this.getTypeIndex();
      const entityIds = typeIndex[type] || [];

      const entities: MemoryEntity[] = [];

      // 获取实体数据
      for (const entityId of entityIds) {
        const entity = await this.getEntity(entityId);
        if (entity) {
          entities.push(entity);
        }
      }

      // 排序
      entities.sort((a, b) => {
        const aValue = a[sortBy as keyof MemoryEntity] as number;
        const bValue = b[sortBy as keyof MemoryEntity] as number;
        return sortOrder === 'desc' ? bValue - aValue : aValue - bValue;
      });

      // 分页
      const paginatedEntities = entities.slice(offset, offset + limit);

      return {
        data: paginatedEntities,
        total: entities.length,
        source: 'local',
        cached: true,
        queryTime: Date.now() - startTime
      };

    } catch (error) {
      console.error('按类型查询实体失败:', error);
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
   * 搜索实体（本地模糊搜索）
   */
  async searchEntities(
    searchTerm: string,
    type?: string,
    options: QueryOptions = {}
  ): Promise<QueryResult<MemoryEntity>> {
    this.ensureInitialized();
    
    const startTime = Date.now();
    const { limit = 20 } = options;

    try {
      const entities: MemoryEntity[] = [];
      const searchLower = searchTerm.toLowerCase();

      // 从内存搜索
      for (const entity of Array.from(this.memoryEntities.values())) {
        if (type && entity.type !== type) continue;
        
        const matchesName = entity.name.toLowerCase().includes(searchLower);
        const matchesDescription = entity.description?.toLowerCase().includes(searchLower);
        const matchesTags = entity.tags?.some((tag: string) => tag.toLowerCase().includes(searchLower));
        
        if (matchesName || matchesDescription || matchesTags) {
          entities.push(entity);
        }
      }

      // 如果内存中结果不够，从存储搜索
      if (entities.length < limit) {
        // 这里可以实现更复杂的存储搜索逻辑
        // 暂时先返回内存结果
      }

      // 按相关性排序（简单实现）
      entities.sort((a, b) => {
        const aScore = this.calculateRelevanceScore(a, searchTerm);
        const bScore = this.calculateRelevanceScore(b, searchTerm);
        return bScore - aScore;
      });

      return {
        data: entities.slice(0, limit),
        total: entities.length,
        source: 'local',
        cached: true,
        queryTime: Date.now() - startTime
      };

    } catch (error) {
      console.error('搜索实体失败:', error);
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
   * 缓存实体（统一存储为CachedEntityDetail格式）
   */
  async cacheEntity(entity: MemoryEntity | CachedEntityDetail): Promise<void> {
    this.ensureInitialized();

    try {
      // 转换为 CachedEntityDetail 格式
      const detailEntity = this.isCachedEntityDetail(entity) 
        ? entity 
        : this.convertToDetailEntity(entity as MemoryEntity);
      
      // 确保包含所有必要字段
      this.ensureDetailEntityFields(detailEntity);
      
      // 存储到持久化存储（统一使用 CachedEntityDetail 格式）
      await chrome.storage.local.set({
        [`${CACHE_KEYS.ENTITIES}_${entity.id}`]: detailEntity
      });

      // 加载基础实体到内存（如果空间允许）
      const baseEntity = this.convertToBaseEntity(detailEntity);
      if (this.memoryEntities.size < this.config.maxEntitiesInMemory) {
        this.memoryEntities.set(entity.id, baseEntity);
      } else {
        // 移除最少使用的实体
        const lruEntity = this.findLRUEntity();
        if (lruEntity) {
          this.memoryEntities.delete(lruEntity.id);
        }
        this.memoryEntities.set(entity.id, baseEntity);
      }

      // 更新索引
      await this.updateEntityIndex(baseEntity);

    } catch (error) {
      console.error('缓存实体失败:', error);
    }
  }

  /**
   * 获取所有缓存的实体
   */
  async getAllEntities(): Promise<MemoryEntity[]> {
    this.ensureInitialized();

    try {
      const entities: MemoryEntity[] = [];
      
      // 从内存获取所有实体
      for (const entity of Array.from(this.memoryEntities.values())) {
        entities.push(entity);
      }
      
      // 如果内存中没有实体，从存储中加载
      if (entities.length === 0) {
        const entityIndex = await this.getEntityIndex();
        for (const entityId of Object.keys(entityIndex)) {
          const entity = await this.getEntity(entityId);
          if (entity) {
            entities.push(entity);
          }
        }
      }

      console.log(`📦 从本地缓存获取了 ${entities.length} 个实体`);
      return entities;
    } catch (error) {
      console.error('获取所有本地实体失败:', error);
      return [];
    }
  }

  /**
   * 批量缓存实体
   */
  async batchCacheEntities(entities: MemoryEntity[]): Promise<void> {
    this.ensureInitialized();

    try {
      // 批量存储
      const storageData: { [key: string]: MemoryEntity } = {};
      for (const entity of entities) {
        storageData[`${CACHE_KEYS.ENTITIES}_${entity.id}`] = entity;
      }
      
      await chrome.storage.local.set(storageData);

      // 更新内存和索引
      for (const entity of entities) {
        if (this.memoryEntities.size < this.config.maxEntitiesInMemory) {
          this.memoryEntities.set(entity.id, entity);
        }
        await this.updateEntityIndex(entity);
      }

    } catch (error) {
      console.error('批量缓存实体失败:', error);
    }
  }

  // ==================== 关系缓存管理 ====================

  /**
   * 获取关系网络
   */
  async getRelationshipNetwork(entityId: string, depth = 1): Promise<{
    entities: MemoryEntity[];
    relationships: GraphRelationship[];
  }> {
    this.ensureInitialized();

    try {
      const visitedEntities = new Set<string>();
      const foundEntities: MemoryEntity[] = [];
      const foundRelationships: GraphRelationship[] = [];
      
      await this.traverseRelationships(entityId, depth, visitedEntities, foundEntities, foundRelationships);

      return {
        entities: foundEntities,
        relationships: foundRelationships
      };

    } catch (error) {
      console.error('获取关系网络失败:', error);
      return { entities: [], relationships: [] };
    }
  }

  /**
   * 🆕 存储关系（对外接口）
   */
  async storeRelationship(relationship: GraphRelationship): Promise<void> {
    await this.cacheRelationship(relationship);
  }

  /**
   * 缓存关系
   */
  async cacheRelationship(relationship: GraphRelationship): Promise<void> {
    this.ensureInitialized();

    try {
      // 存储到持久化存储
      await chrome.storage.local.set({
        [`${CACHE_KEYS.RELATIONSHIPS}_${relationship.id}`]: relationship
      });

      // 加载到内存
      this.memoryRelationships.set(relationship.id, relationship);

      // 更新关系索引
      await this.updateRelationshipIndex(relationship);

      // 🆕 更新聚合关系数据（用于同步）
      await this.updateAggregatedRelationshipData();

    } catch (error) {
      console.error('缓存关系失败:', error);
    }
  }

  /**
   * 恢复关系数据（新设备同步）- 简化版
   */
  async restoreRelationshipData(relationshipData: {
    relationships: any[];
    typeToEntities: any[];
    entityToRelations?: any[]; // 🆕 向后兼容，可选
  }): Promise<void> {
    this.ensureInitialized();

    try {
      console.log('🔄 恢复关系数据到本地缓存...');

      // 1. 恢复关系数据
      const relationshipMap = new Map<string, GraphRelationship>();
      const entityRelationsMap = new Map<string, Set<string>>();

      for (const [id, relationship] of relationshipData.relationships) {
        relationshipMap.set(id, relationship);
        
        // 构建实体-关系映射
        if (!entityRelationsMap.has(relationship.fromId)) {
          entityRelationsMap.set(relationship.fromId, new Set());
        }
        if (!entityRelationsMap.has(relationship.toId)) {
          entityRelationsMap.set(relationship.toId, new Set());
        }
        
        entityRelationsMap.get(relationship.fromId)!.add(id);
        entityRelationsMap.get(relationship.toId)!.add(id);
      }

      // 2. 批量保存关系到存储
      const relationshipStorageData: { [key: string]: GraphRelationship } = {};
      for (const [id, relationship] of Array.from(relationshipMap.entries())) {
        relationshipStorageData[`${CACHE_KEYS.RELATIONSHIPS}_${id}`] = relationship;
      }
      
      await chrome.storage.local.set(relationshipStorageData);

      // 3. 更新内存中的关系
      this.memoryRelationships = relationshipMap;

      // 4. 保存关系索引
      const relationshipIndexData = {
        relationships: Array.from(relationshipMap.entries()),
        entityToRelations: Array.from(entityRelationsMap.entries())
          .map(([key, value]) => [key, Array.from(value)])
      };
      
      await chrome.storage.local.set({ 
        [CACHE_KEYS.RELATIONSHIP_INDEX]: relationshipIndexData 
      });

      console.log(`✅ 恢复了 ${relationshipMap.size} 个关系到本地缓存`);
      
      // 🆕 更新聚合关系数据（用于同步）
      await this.updateAggregatedRelationshipData();
    } catch (error) {
      console.error('恢复关系数据失败:', error);
    }
  }

  /**
   * 🆕 获取简化的关系数据备份
   */
  async getSimplifiedRelationshipData(): Promise<{
    relationships: any[];
    typeToEntities: any[];
  } | null> {
    const fullData = await this.getRelationshipBackupData();
    if (!fullData) return null;
    
    return {
      relationships: fullData.relationships,
      typeToEntities: fullData.typeToEntities
    };
  }

  /**
   * 获取完整的关系数据备份（包含entityToRelations）
   */
  async getRelationshipBackupData(): Promise<{
    relationships: any[];
    entityToRelations: any[];
    typeToEntities: any[];
  } | null> {
    this.ensureInitialized();

    try {
      // 1. 获取关系数据
      const relationships = Array.from(this.memoryRelationships.entries());
      
      if (relationships.length === 0) {
        return null;
      }

      // 2. 获取类型索引
      const typeIndex = await this.getTypeIndex();
      const typeToEntities = Array.from(Object.entries(typeIndex))
        .map(([key, value]) => [key, Array.from(value)]);

      // 3. 获取关系索引（entityToRelations）
      const relationshipIndex = await this.getRelationshipIndex();
      const entityToRelations = Array.from(Object.entries(relationshipIndex));

      return {
        relationships,
        entityToRelations,
        typeToEntities
      };
    } catch (error) {
      console.error('获取关系备份数据失败:', error);
      return null;
    }
  }

  // ==================== 最近数据缓存 ====================

  /**
   * 获取实体详情（别名方法，保持向后兼容）
   * @deprecated 推荐使用 getEntity() 替代
   */
  async getRecentData(entityId: string): Promise<CachedEntityDetail | null> {
    return this.getEntity(entityId);
  }

  /**
   * 更新实体的详细数据（统一存储到ENTITIES）
   */
  async updateRecentData(
    entityId: string,
    type: 'conversation' | 'resource' | 'project' | 'webpage',
    data: any
  ): Promise<void> {
    this.ensureInitialized();

    try {
      let entityDetail = await this.getEntity(entityId);
      
      if (!entityDetail) {
        // 如果实体不存在，创建一个基础的 CachedEntityDetail
        entityDetail = {
          id: entityId,
          type: 'Topic', // 默认类型，后续可以根据需要调整
          name: entityId,
          description: '',
          properties: {},
          created: Date.now(),
          updated: Date.now(),
          accessCount: 0,
          lastAccessed: Date.now(),
          importance: 0.5,
          statistic: {
            conversations: 0,
            projects: 0,
            participants: 1,
            resources: 0,
            documents: 0,
            webpages: 0,
            relationships: 0,
            topics: 0,
            jiraTickets: 0
          },
          relatedData: {
            conversations: [],
            webpages: [],
            resources: [],
            projects: [],
            people: [],
            topics: [],
            jiraTickets: [],
            cooccurringEntities: []
          },
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
          relatedParticipants: [],
          lastUpdated: Date.now()
        };
      }

      // 添加新数据到对应数组的开头（只保留最近5条）
      if (type === 'conversation') {
        entityDetail.recentDataDetails.conversations.unshift(data);
        if (entityDetail.recentDataDetails.conversations.length > 5) {
          entityDetail.recentDataDetails.conversations = entityDetail.recentDataDetails.conversations.slice(0, 5);
        }
      } else if (type === 'resource') {
        entityDetail.recentDataDetails.resources.unshift(data);
        if (entityDetail.recentDataDetails.resources.length > 5) {
          entityDetail.recentDataDetails.resources = entityDetail.recentDataDetails.resources.slice(0, 5);
        }
      } else if (type === 'project') {
        entityDetail.recentDataDetails.projects.unshift(data);
        if (entityDetail.recentDataDetails.projects.length > 5) {
          entityDetail.recentDataDetails.projects = entityDetail.recentDataDetails.projects.slice(0, 5);
        }
      } else { // webpage
        entityDetail.recentDataDetails.webpages.unshift(data);
        if (entityDetail.recentDataDetails.webpages.length > 5) {
          entityDetail.recentDataDetails.webpages = entityDetail.recentDataDetails.webpages.slice(0, 5);
        }
      }

      entityDetail.lastUpdated = Date.now();
      entityDetail.updated = Date.now();

      // 重新计算统计字段
      this.recalculateUIFields(entityDetail);

      // 保存更新到统一的ENTITIES存储
      await this.cacheEntity(entityDetail);

    } catch (error) {
      console.error('更新实体详细数据失败:', error);
    }
  }

  /**
   * 🆕 基于本地关系数据批量更新实体的最近数据缓存
   */
  async batchUpdateRecentDataCacheFromRelations(entities: MemoryEntity[]): Promise<number> {
    if (!this.config.enableRecentDataSync) {
      return 0;
    }

    let updatedCount = 0;
    const batches = this.chunkArray(entities, this.config.recentDataSyncBatchSize);
    
    for (const batch of batches) {
      // 并行处理批内实体，但控制并发数量
      const promises = batch.map(entity => this.updateEntityRecentDataFromRelations(entity));
      const results = await Promise.allSettled(promises);
      
      // 统计成功更新的数量
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          updatedCount++;
        }
      }
      
      // 批间延迟，避免过度负载
      if (batches.length > 1) {
        await this.delay(50); // 减少延迟，因为本地查询更快
      }
    }
    
    return updatedCount;
  }

  /**
   * 🆕 基于本地关系数据更新单个实体的最近数据缓存
   */
  private async updateEntityRecentDataFromRelations(entity: MemoryEntity): Promise<boolean> {
    try {
      const entityName = entity.name;
      let hasUpdates = false;

      // 🔗 1. 获取实体的关系网络（深度1，只获取直接相关的实体）
      const relationshipNetwork = await this.getRelationshipNetwork(entity.id, 1);
      
      if (relationshipNetwork.relationships.length === 0) {
        // console.log(`实体 ${entityName} 没有发现关系数据`);
        return false;
      }

      // 📊 2. 按数据来源分类关系
      const relationshipsBySource = {
        conversations: [] as any[],
        webpages: [] as any[],
        projects: [] as any[],
        resources: [] as any[]
      };

      for (const relationship of relationshipNetwork.relationships) {
        const properties = relationship.properties || {};
        const source = properties.source;
        const discoveredAt = properties.discoveredAt || relationship.created;
        
        // 构建基础数据对象
        const baseData = {
          id: properties.messageId || properties.webpageId || properties.projectId || relationship.id,
          relationshipId: relationship.id,
          timestamp: discoveredAt,
          relationType: relationship.type,
          strength: relationship.strength
        };

        // 根据数据来源分类
        switch (source) {
          case 'message':
            relationshipsBySource.conversations.push({
              ...baseData,
              content: `通过关系"${relationship.type}"发现的相关消息`,
              summary: `与${this.getRelatedEntityName(relationship, entity.id)}的关系`,
              sender: 'system', // 可以后续优化为从原始消息获取
              messageId: properties.messageId
            });
            break;
            
          case 'webpage':
            relationshipsBySource.webpages.push({
              ...baseData,
              title: `通过关系"${relationship.type}"发现的相关网页`,
              url: properties.url || '',
              summary: `与${this.getRelatedEntityName(relationship, entity.id)}的关系`,
              visitTime: discoveredAt,
              domain: properties.domain || 'unknown'
            });
            break;
            
          case 'project':
            relationshipsBySource.projects.push({
              ...baseData,
              name: `通过关系"${relationship.type}"发现的相关项目`,
              description: `与${this.getRelatedEntityName(relationship, entity.id)}的关系`,
              status: properties.status || 'active'
            });
            break;
            
          default:
            // 其他类型归类为资源
            relationshipsBySource.resources.push({
              ...baseData,
              name: `通过关系"${relationship.type}"发现的相关资源`,
              description: `与${this.getRelatedEntityName(relationship, entity.id)}的关系`,
              type: source || 'unknown'
            });
            break;
        }
      }

      // 📝 3. 批量更新最近数据缓存
      const updatePromises = [];
      
      // 更新conversations
      if (relationshipsBySource.conversations.length > 0) {
        const sortedConversations = relationshipsBySource.conversations
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, this.config.recentDataQueryLimit);
        
        for (const conversation of sortedConversations) {
          updatePromises.push(
            this.updateRecentData(entity.id, 'conversation', conversation)
          );
        }
        hasUpdates = true;
      }

      // 更新webpages
      if (relationshipsBySource.webpages.length > 0) {
        const sortedWebpages = relationshipsBySource.webpages
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, this.config.recentDataQueryLimit);
        
        for (const webpage of sortedWebpages) {
          updatePromises.push(
            this.updateRecentData(entity.id, 'webpage', webpage)
          );
        }
        hasUpdates = true;
      }

      // 更新projects
      if (relationshipsBySource.projects.length > 0) {
        const sortedProjects = relationshipsBySource.projects
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, this.config.recentDataQueryLimit);
        
        for (const project of sortedProjects) {
          updatePromises.push(
            this.updateRecentData(entity.id, 'project', project)
          );
        }
        hasUpdates = true;
      }

      // 更新resources
      if (relationshipsBySource.resources.length > 0) {
        const sortedResources = relationshipsBySource.resources
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, this.config.recentDataQueryLimit);
        
        for (const resource of sortedResources) {
          updatePromises.push(
            this.updateRecentData(entity.id, 'resource', resource)
          );
        }
        hasUpdates = true;
      }

      // 🚀 4. 并行执行所有更新
      if (updatePromises.length > 0) {
        await Promise.allSettled(updatePromises);
        console.log(`📝 基于${relationshipNetwork.relationships.length}个关系更新了实体 ${entityName} 的最近数据缓存`);
      }

      return hasUpdates;

    } catch (error) {
      console.error(`基于关系数据更新实体 ${entity.name} 的最近数据缓存失败:`, error);
      return false;
    }
  }

  /**
   * 🔗 获取关系中相关实体的名称
   */
  private getRelatedEntityName(relationship: GraphRelationship, currentEntityId: string): string {
    const relatedEntityId = relationship.fromId === currentEntityId 
      ? relationship.toId 
      : relationship.fromId;
    
    // 从实体ID中提取可读名称（简化版）
    const namePart = relatedEntityId.split('_').slice(1).join(' ');
    return namePart || relatedEntityId;
  }

  /**
   * 🆕 更新聚合关系数据到本地存储（用于云端同步）- 简化版
   */
  private async updateAggregatedRelationshipData(): Promise<void> {
    this.ensureInitialized();

    try {
      // 🆕 获取简化的关系数据
      const backupData = await this.getSimplifiedRelationshipData();
      
      if (backupData) {
        // 存储简化的关系数据
        await chrome.storage.local.set({
          'cache_graph_relationships': {
            relationships: backupData.relationships,
            typeToEntities: backupData.typeToEntities,
            lastUpdated: Date.now()
            // 🚫 移除冗余的 entityToRelations
          }
        });
        
        console.log(`📊 更新聚合关系数据: ${backupData.relationships.length} 个关系`);
      }
    } catch (error) {
      console.error('更新聚合关系数据失败:', error);
    }
  }

  // ==================== 主题详情缓存 ====================

  // ==================== 实体格式转换辅助方法 ====================

  /**
   * 确保 CachedEntityDetail 包含所有必要字段
   */
  private ensureDetailEntityFields(entity: CachedEntityDetail): void {
    if (!entity.recentDataDetails) {
      entity.recentDataDetails = {
        conversations: [],
        webpages: [],
        resources: [],
        projects: [],
        people: [],
        topics: [],
        jiraTickets: [],
        cooccurringEntities: []
      };
    }
    if (!entity.relatedParticipants) entity.relatedParticipants = [];
    if (!entity.statistic) {
      entity.statistic = {
        conversations: entity.recentDataDetails.conversations.length,
        projects: entity.recentDataDetails.projects.length,
        participants: entity.relatedParticipants.length,
        resources: entity.recentDataDetails.resources.length,
        documents: entity.recentDataDetails.resources.filter(r => r.type === '文档').length,
        webpages: entity.recentDataDetails.webpages.length,
        relationships: 0,
        topics: entity.recentDataDetails.topics.length,
        jiraTickets: entity.recentDataDetails.jiraTickets.length
      };
    }
    if (!entity.cachedAt) entity.cachedAt = Date.now();
    if (!entity.lastUpdated) entity.lastUpdated = Date.now();
  }

  /**
   * 将 CachedEntityDetail 转换为基础的 MemoryEntity（用于内存存储）
   */
  private convertToBaseEntity(detailEntity: CachedEntityDetail): MemoryEntity {
    return {
      id: detailEntity.id,
      type: detailEntity.type,
      name: detailEntity.name,
      description: detailEntity.description,
      properties: detailEntity.properties,
      created: detailEntity.created,
      updated: detailEntity.updated,
      accessCount: detailEntity.accessCount,
      lastAccessed: detailEntity.lastAccessed,
      importance: detailEntity.importance,
      tags: detailEntity.tags,
      status: detailEntity.status,
      searchDistance: detailEntity.searchDistance,
      relevanceScore: detailEntity.relevanceScore,
      statistic: detailEntity.statistic,
      relatedData: detailEntity.relatedData
    };
  }

  /**
   * 将基础 MemoryEntity 转换为 CachedEntityDetail
   */
  private convertToDetailEntity(baseEntity: MemoryEntity): CachedEntityDetail {
    const detailEntity: CachedEntityDetail = {
      ...baseEntity,
      cachedAt: Date.now(),
      recentDataDetails: {
        conversations: [] as (MemoryEntity['relatedData']['conversations'][0] & {
          originalContent: string;
          matchedRules: string[];
          contextMessages: Array<{
            id: string;
            sender: string;
            content: string;
            datetime: string;
            isMainMessage: boolean;
          }>;
        })[],
        webpages: [] as MemoryEntity['relatedData']['webpages'],
        resources: [] as MemoryEntity['relatedData']['resources'],
        projects: [] as MemoryEntity['relatedData']['projects'],
        people: [] as MemoryEntity['relatedData']['people'],
        topics: [] as MemoryEntity['relatedData']['topics'],
        jiraTickets: [] as MemoryEntity['relatedData']['jiraTickets'],
        cooccurringEntities: [] as MemoryEntity['relatedData']['cooccurringEntities']
      },
      relatedParticipants: [],
      lastUpdated: Date.now()
    };
    
    this.ensureDetailEntityFields(detailEntity);
    return detailEntity;
  }

  /**
   * 检查实体是否为 CachedEntityDetail 格式
   */
  private isCachedEntityDetail(entity: MemoryEntity | CachedEntityDetail): entity is CachedEntityDetail {
    return 'latestConversations' in entity && 'cachedAt' in entity;
  }

  // ==================== 统计信息缓存 ====================

  /**
   * 获取实体统计信息
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

    try {
      const result = await chrome.storage.local.get(CACHE_KEYS.STATISTICS);
      const cached = result[CACHE_KEYS.STATISTICS];

      if (cached && Date.now() - cached.cachedAt < this.config.statisticsCacheDuration) {
        return cached.data;
      }

      // 重新计算统计信息
      return await this.calculateStatistics();

    } catch (error) {
      console.error('获取统计信息失败:', error);
      return {
        entityCounts: {},
        totalEntities: 0,
        totalRelationships: 0,
        entitiesCreatedToday: 0,
        entitiesCreatedThisWeek: 0,
        entitiesCreatedThisMonth: 0,
        topEntitiesByType: {}
      };
    }
  }

  // ==================== 缓存管理 ====================

  /**
   * 清理过期缓存
   */
  async clearExpiredCache(): Promise<void> {
    this.ensureInitialized();

    try {
      const now = Date.now();
      const allKeys = await this.getAllCacheKeys();
      const keysToRemove: string[] = [];

      for (const key of allKeys) {
        if (key.startsWith(CACHE_KEYS.ENTITIES)) {
          const result = await chrome.storage.local.get(key);
          const data = result[key] as CachedEntityDetail;
          
          // 只清理有 cachedAt 字段的 CachedEntityDetail 实体（表示有详细缓存数据）
          if (data && data.cachedAt && this.isCachedEntityDetail(data)) {
            const age = now - data.cachedAt;
            const maxAge = this.config.recentDataCacheDuration;
            
            if (age > maxAge) {
              keysToRemove.push(key);
            }
          }
        }
      }

      if (keysToRemove.length > 0) {
        await chrome.storage.local.remove(keysToRemove);
        console.log(`🧹 清理了 ${keysToRemove.length} 个过期缓存项`);
      }

    } catch (error) {
      console.error('清理过期缓存失败:', error);
    }
  }

  /**
   * 获取缓存大小
   */
  async getCacheSize(): Promise<number> {
    try {
      const result = await chrome.storage.local.getBytesInUse();
      return result;
    } catch (error) {
      console.error('获取缓存大小失败:', error);
      return 0;
    }
  }

  // ==================== 私有方法 ====================

  private async loadEntitiesToMemory(): Promise<void> {
    try {
      const entityIndex = await this.getEntityIndex();
      const entityIds = Object.keys(entityIndex);
      
      let loadedCount = 0;
      for (const entityId of entityIds) {
        if (loadedCount >= this.config.maxEntitiesInMemory) break;
        
        const result = await chrome.storage.local.get(`${CACHE_KEYS.ENTITIES}_${entityId}`);
        const entity = result[`${CACHE_KEYS.ENTITIES}_${entityId}`] as MemoryEntity;
        
        if (entity) {
          this.memoryEntities.set(entityId, entity);
          loadedCount++;
        }
      }
      
      console.log(`📥 加载了 ${loadedCount} 个实体到内存`);
    } catch (error) {
      console.error('加载实体到内存失败:', error);
    }
  }

  private async loadRelationshipsToMemory(): Promise<void> {
    try {
      const relationshipIndex = await this.getRelationshipIndex();
      const allRelationshipIds = Object.values(relationshipIndex).flat();
      
      for (const relationshipId of allRelationshipIds) {
        const result = await chrome.storage.local.get(`${CACHE_KEYS.RELATIONSHIPS}_${relationshipId}`);
        const relationship = result[`${CACHE_KEYS.RELATIONSHIPS}_${relationshipId}`] as GraphRelationship;
        
        if (relationship) {
          this.memoryRelationships.set(relationshipId, relationship);
        }
      }
      
      console.log(`📥 加载了 ${this.memoryRelationships.size} 个关系到内存`);
    } catch (error) {
      console.error('加载关系到内存失败:', error);
    }
  }

  private async getEntityIndex(): Promise<EntityIndex> {
    try {
      const result = await chrome.storage.local.get(CACHE_KEYS.ENTITY_INDEX);
      return result[CACHE_KEYS.ENTITY_INDEX] || {};
    } catch (error) {
      console.error('获取实体索引失败:', error);
      return {};
    }
  }

  private async getTypeIndex(): Promise<TypeIndex> {
    try {
      const result = await chrome.storage.local.get(CACHE_KEYS.TYPE_INDEX);
      return result[CACHE_KEYS.TYPE_INDEX] || {};
    } catch (error) {
      console.error('获取类型索引失败:', error);
      return {};
    }
  }

  private async getRelationshipIndex(): Promise<RelationshipIndex> {
    try {
      const result = await chrome.storage.local.get(CACHE_KEYS.RELATIONSHIP_INDEX);
      return result[CACHE_KEYS.RELATIONSHIP_INDEX] || {};
    } catch (error) {
      console.error('获取关系索引失败:', error);
      return {};
    }
  }

  private async updateEntityIndex(entity: MemoryEntity): Promise<void> {
    try {
      const entityIndex = await this.getEntityIndex();
      const typeIndex = await this.getTypeIndex();

      // 更新实体索引
      entityIndex[entity.id] = {
        type: entity.type,
        name: entity.name,
        lastAccessed: entity.lastAccessed,
        inMemory: this.memoryEntities.has(entity.id)
      };

      // 更新类型索引
      if (!typeIndex[entity.type]) {
        typeIndex[entity.type] = [];
      }
      if (!typeIndex[entity.type].includes(entity.id)) {
        typeIndex[entity.type].push(entity.id);
      }

      await chrome.storage.local.set({
        [CACHE_KEYS.ENTITY_INDEX]: entityIndex,
        [CACHE_KEYS.TYPE_INDEX]: typeIndex
      });

    } catch (error) {
      console.error('更新实体索引失败:', error);
    }
  }

  private async updateRelationshipIndex(relationship: GraphRelationship): Promise<void> {
    try {
      const relationshipIndex = await this.getRelationshipIndex();

      // 为源实体和目标实体添加关系引用
      if (!relationshipIndex[relationship.fromId]) {
        relationshipIndex[relationship.fromId] = [];
      }
      if (!relationshipIndex[relationship.fromId].includes(relationship.id)) {
        relationshipIndex[relationship.fromId].push(relationship.id);
      }

      if (!relationshipIndex[relationship.toId]) {
        relationshipIndex[relationship.toId] = [];
      }
      if (!relationshipIndex[relationship.toId].includes(relationship.id)) {
        relationshipIndex[relationship.toId].push(relationship.id);
      }

      await chrome.storage.local.set({
        [CACHE_KEYS.RELATIONSHIP_INDEX]: relationshipIndex
      });

    } catch (error) {
      console.error('更新关系索引失败:', error);
    }
  }

  private findLRUEntity(): MemoryEntity | null {
    let lruEntity: MemoryEntity | null = null;
    let lruTime = Date.now();

    for (const entity of Array.from(this.memoryEntities.values())) {
      if (entity.lastAccessed < lruTime) {
        lruTime = entity.lastAccessed;
        lruEntity = entity;
      }
    }

    return lruEntity;
  }

  private calculateRelevanceScore(entity: MemoryEntity, searchTerm: string): number {
    let score = 0;
    const searchLower = searchTerm.toLowerCase();

    // 名称匹配（权重最高）
    if (entity.name.toLowerCase().includes(searchLower)) {
      score += 10;
      if (entity.name.toLowerCase().startsWith(searchLower)) {
        score += 5; // 前缀匹配加分
      }
    }

    // 描述匹配
    if (entity.description?.toLowerCase().includes(searchLower)) {
      score += 3;
    }

    // 标签匹配
    entity.tags?.forEach(tag => {
      if (tag.toLowerCase().includes(searchLower)) {
        score += 2;
      }
    });

    // 重要性加权
    score *= (entity.importance || 0.5);

    return score;
  }

  private async traverseRelationships(
    entityId: string,
    remainingDepth: number,
    visited: Set<string>,
    foundEntities: MemoryEntity[],
    foundRelationships: GraphRelationship[]
  ): Promise<void> {
    if (remainingDepth <= 0 || visited.has(entityId)) return;

    visited.add(entityId);

    // 获取当前实体（可能不存在）
    const entity = await this.getEntity(entityId);
    if (entity) {
      foundEntities.push(entity);
    } else {
      console.warn(`关系遍历中发现缺失实体: ${entityId}`);
    }

    // 获取相关关系
    const relationshipIndex = await this.getRelationshipIndex();
    const relationshipIds = relationshipIndex[entityId] || [];

    for (const relationshipId of relationshipIds) {
      const relationship = this.memoryRelationships.get(relationshipId);
      if (relationship) {
        // 🆕 优化：区分实体-实体关系和实体-消息关系
        const isEntityMessageRelation = relationship.type === 'discovered_in';
        
        if (isEntityMessageRelation) {
          // 对于实体-消息关系，只验证实体端
          const entitySideId = relationship.fromId === entityId ? relationship.fromId : relationship.toId;
          const messageSideId = relationship.fromId === entityId ? relationship.toId : relationship.fromId;
          
          if (await this.getEntity(entitySideId)) {
            foundRelationships.push(relationship);
            console.log(`🔗 发现实体-消息关系: ${entitySideId} -> ${messageSideId.slice(0, 8)}`);
          }
          
          // 实体-消息关系不继续递归遍历
        } else {
          // 对于实体-实体关系，验证两端实体
          const fromEntity = await this.getEntity(relationship.fromId);
          const toEntity = await this.getEntity(relationship.toId);
          
          if (fromEntity || toEntity) {
            foundRelationships.push(relationship);

            // 递归遍历相关实体
            const relatedEntityId = relationship.fromId === entityId 
              ? relationship.toId 
              : relationship.fromId;
            
            if (await this.getEntity(relatedEntityId)) {
              await this.traverseRelationships(
                relatedEntityId,
                remainingDepth - 1,
                visited,
                foundEntities,
                foundRelationships
              );
            }
          }
        }
      }
    }
  }

  private async calculateStatistics(): Promise<any> {
    const now = Date.now();
    const today = new Date().toDateString();
    const thisWeek = now - 7 * 24 * 60 * 60 * 1000;
    const thisMonth = now - 30 * 24 * 60 * 60 * 1000;

    const entityCounts: Record<string, number> = {};
    let totalEntities = 0;
    let entitiesCreatedToday = 0;
    let entitiesCreatedThisWeek = 0;
    let entitiesCreatedThisMonth = 0;
    const topEntitiesByType: Record<string, MemoryEntity[]> = {};

    // 统计内存中的实体
    for (const entity of Array.from(this.memoryEntities.values())) {
      totalEntities++;
      entityCounts[entity.type] = (entityCounts[entity.type] || 0) + 1;

      // 时间统计
      const entityDate = new Date(entity.created).toDateString();
      if (entityDate === today) entitiesCreatedToday++;
      if (entity.created >= thisWeek) entitiesCreatedThisWeek++;
      if (entity.created >= thisMonth) entitiesCreatedThisMonth++;

      // 顶级实体
      if (!topEntitiesByType[entity.type]) {
        topEntitiesByType[entity.type] = [];
      }
      topEntitiesByType[entity.type].push(entity);
    }

    // 对每种类型的实体按重要性排序，取前5个
    for (const type in topEntitiesByType) {
      topEntitiesByType[type] = topEntitiesByType[type]
        .sort((a, b) => b.importance - a.importance)
        .slice(0, 5);
    }

    const statistics = {
      entityCounts,
      totalEntities,
      totalRelationships: this.memoryRelationships.size,
      entitiesCreatedToday,
      entitiesCreatedThisWeek,
      entitiesCreatedThisMonth,
      topEntitiesByType
    };

    // 缓存统计信息
    await chrome.storage.local.set({
      [CACHE_KEYS.STATISTICS]: {
        data: statistics,
        cachedAt: now
      }
    });

    return statistics;
  }

  private async getAllCacheKeys(): Promise<string[]> {
    try {
      const allKeys = await chrome.storage.local.get();
      return Object.keys(allKeys).filter(key => 
        key.startsWith('cache_')
      );
    } catch (error) {
      console.error('获取所有缓存键失败:', error);
      return [];
    }
  }



  private startPeriodicCleanup(): void {
    // 每小时清理一次过期缓存
    setInterval(() => {
      this.clearExpiredCache();
    }, 60 * 60 * 1000);
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 创建空的扩展缓存对象
   */
  private createEmptyExtendedCache(entityId: string): Partial<CachedEntityDetail> {
    return {
      lastUpdated: Date.now(),
      cachedAt: Date.now(),
      
      // 关联数据字段
      relatedData: {
        conversations: [],
        webpages: [],
        resources: [],
        projects: [],
        people: [],
        topics: [],
        jiraTickets: [],
        cooccurringEntities: []
      },
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
      expertise: [],
      
      // 统计字段
      statistic: {
        conversations: 0,
        projects: 0,
        participants: 0,
        resources: 0,
        documents: 0,
        webpages: 0,
        relationships: 0,
        topics: 0,
        jiraTickets: 0
      }
    };
  }

  /**
   * 确保缓存数据包含所有必要的UI字段
   */
  private ensureUIFields(cache: CachedEntityDetail): void {
    // 如果缺少UI字段，重新计算
    if (!cache.statistic || 
        !cache.recentDataDetails) {
      this.recalculateUIFields(cache);
    }
  }

  /**
   * 重新计算UI字段
   */
  private recalculateUIFields(cache: CachedEntityDetail): void {
    // 确保缓存字段存在（使用正确的字段名）
    if (!cache.recentDataDetails) {
      cache.recentDataDetails = {
        conversations: [],
        webpages: [],
        resources: [],
        projects: [],
        people: [],
        topics: [],
        jiraTickets: [],
        cooccurringEntities: []
      };
    }

    // 更新统计字段到 statistic 对象中
    if (!cache.statistic) {
      cache.statistic = {
        conversations: 0,
        projects: 0,
        participants: 0,
        resources: 0,
        documents: 0,
        webpages: 0,
        relationships: 0,
        topics: 0,
        jiraTickets: 0
      };
    }

    // 重新计算统计字段
    cache.statistic.conversations = cache.recentDataDetails.conversations.length;
    cache.statistic.webpages = cache.recentDataDetails.webpages.length;
    cache.statistic.resources = cache.recentDataDetails.resources.length;
    cache.statistic.projects = cache.recentDataDetails.projects.length;
    cache.statistic.topics = cache.recentDataDetails.topics.length;
    cache.statistic.jiraTickets = cache.recentDataDetails.jiraTickets.length;

    // 确保必要字段存在
    if (!cache.expertise) cache.expertise = [];
    if (!cache.lastUpdated) cache.lastUpdated = Date.now();
  }

  /**
   * 获取所有本地缓存的实体数据（用于统计信息上传）
   */
  async getAllRecentDataEntries(): Promise<CachedEntityDetail[]> {
    this.ensureInitialized();

    try {
      const entityEntries: CachedEntityDetail[] = [];
      
      // 获取所有键，然后过滤出 ENTITIES 相关的键
      const allKeys = await this.getAllCacheKeys();
      
      for (const key of allKeys) {
        if (key.startsWith(CACHE_KEYS.ENTITIES + '_')) {
          try {
            const result = await chrome.storage.local.get(key);
            const data = result[key] as CachedEntityDetail;
            
            if (data && this.isCachedEntityDetail(data)) {
              // 检查数据是否过期
              const now = Date.now();
              if (data.cachedAt && now - data.cachedAt < this.config.recentDataCacheDuration) {
                entityEntries.push(data);
              }
            }
          } catch (error) {
            console.error(`解析缓存数据失败 (${key}):`, error);
          }
        }
      }

      console.log(`📊 找到 ${entityEntries.length} 个本地缓存实体`);
      return entityEntries;

    } catch (error) {
      console.error('获取所有本地缓存数据失败:', error);
      return [];
    }
  }

  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('本地缓存未初始化');
    }
  }
}
