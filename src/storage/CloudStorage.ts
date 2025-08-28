/**
 * 云端存储管理器
 * 专门管理 ChromaDB 操作，包括向量搜索和完整数据存储
 */

import { ChromaClient, Collection, EmbeddingFunction } from 'chromadb';
import { getEmbeddingViaOffscreen } from '../embeddings';
import { getEnvConfig } from '../utils';
import { QueryResult, VectorSearchOptions, QueryOptions } from '../memory';

// 基础实体接口 - CloudStorage 专用
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
  // 搜索相关字段（可选）
  searchDistance?: number;
  relevanceScore?: number;
  statistic: {
    conversations: number;
    projects: number;
    participants: number;
    resources: number; 
    documents: number;
    webpages: number;
    relationships: number;
  };
}
// GraphEntity 替换为 MemoryEntity，类型兼容
import { UserProfile } from '../types/userProfile';

export interface CloudStorageConfig {
  chromaUrl: string;
  collections: string[];
  batchSize: number;
  timeout: number;
}

/**
 * 自定义空嵌入函数 - 禁用 ChromaDB v3 的默认嵌入
 * 实际嵌入计算通过离屏文档完成
 */
class NullEmbeddingFunction implements EmbeddingFunction {
  async generate(texts: string[]): Promise<number[][]> {
    // 不实际计算嵌入向量，因为我们使用离屏文档方案
    throw new Error('嵌入计算应通过离屏文档完成，不应调用此函数');
  }
}

/**
 * 云端存储管理器
 */
export class CloudStorage {
  private client: ChromaClient | null = null;
  private collections: Map<string, Collection> = new Map();
  private config: CloudStorageConfig;
  private username = '';
  private isInitialized = false;

  constructor() {
    this.config = {
      chromaUrl: 'http://localhost:8000',
      collections: ['messages', 'webpages', 'projects', 'documents', 'graph-entities'],
      batchSize: 100,
      timeout: 10000
    };
  }

  /**
   * 初始化云端存储
   */
  async initialize(): Promise<boolean> {
    try {
      console.log('☁️ 初始化云端存储...');

      const envConfig = await getEnvConfig();
      if (!envConfig.ENABLE_CHROMA) {
        console.log('⚠️ ChromaDB 已禁用，云端存储功能不可用');
        return false;
      }

      // 获取用户信息
      const userinfo = await this.getUserInfo();
      this.username = userinfo.username;

      // 初始化 ChromaDB 客户端
      this.client = new ChromaClient({
        path: envConfig.CHROMA_API_URL || this.config.chromaUrl
      });

      // 初始化集合
      await this.initializeCollections();

      this.isInitialized = true;
      console.log('✅ 云端存储初始化完成');
      return true;

    } catch (error) {
      console.error('❌ 云端存储初始化失败:', error);
      return false;
    }
  }

  /**
   * 检查连接状态
   */
  async isConnected(): Promise<boolean> {
    if (!this.client) return false;
    
    try {
      await this.client.heartbeat();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 增强向量搜索 - 支持多种搜索模式和返回格式
   */
  async searchByVector(
    query: string,
    type?: string,
    options: VectorSearchOptions = {}
  ): Promise<QueryResult<any>> {
    this.ensureInitialized();
    
    const startTime = Date.now();
    const { 
      limit = 20, 
      nResults = 20,
      collections = ['entities', 'messages', 'webpages'],
      returnType = 'entities',
      sortBy = 'relevance',
      sortOrder = 'desc',
      timeRange,
      minRelevanceScore
    } = options;

    try {
      // 生成查询向量
      const queryEmbedding = await getEmbeddingViaOffscreen(query);
      
      // 确定搜索的集合
      const collectionMap = {
        'entities': `${this.username}-graph-entities`,
        'messages': `${this.username}-messages`, 
        'webpages': `${this.username}-webpages`
      };
      
      const collectionsToSearch = type ? [`${this.username}-graph-entities`] : 
        collections.map(c => collectionMap[c]).filter(Boolean);

      const allResults: any[] = [];

      // 在多个集合中搜索
      for (const collectionName of collectionsToSearch) {
        const collection = this.collections.get(collectionName);
        if (!collection) continue;

        try {
          // 构建查询参数
          const queryParams: any = {
            queryEmbeddings: [queryEmbedding],
            nResults,
            include: ['metadatas', 'documents', 'distances']
          };

          // 添加时间范围过滤（仅对 messages 和 webpages 有效）
          if (timeRange && (collectionName.includes('messages') || collectionName.includes('webpages'))) {
            const timeField = collectionName.includes('messages') ? 'timestamp' : 'extractedAt';
            queryParams.where = {
              [timeField]: {
                $gte: timeRange.start,
                $lte: timeRange.end
              }
            };
          }
          
          const searchResults = await collection.query(queryParams);

          // 处理搜索结果
          if (searchResults.metadatas?.[0]) {
            for (let i = 0; i < searchResults.metadatas[0].length; i++) {
              const metadata = searchResults.metadatas[0][i];
              const distance = searchResults.distances?.[0]?.[i] || 1;
              const relevanceScore = 1 / (1 + distance); // 转换为0-1的相关度评分
              
              // 过滤低相关性结果
              if (minRelevanceScore && relevanceScore < minRelevanceScore) continue;
              
              if (returnType === 'entities') {
                // 返回实体格式
                const entity = await this.buildEntity({
                  metadata,
                  id: searchResults.ids?.[0]?.[i],
                  document: searchResults.documents?.[0]?.[i],
                  distance,
                  relevanceScore,
                  collectionName
                });
                if (entity && (!type || entity.type === type)) {
                  allResults.push(entity);
                }
              } else {
                // 返回原始数据格式（用于消息查询）
                const processedMetadata = this.deserializeMetadata(metadata || {});
                allResults.push({
                  id: searchResults.ids?.[0]?.[i] || `result_${i}`,
                  messageId: searchResults.ids?.[0]?.[i],
                  content: searchResults.documents?.[0]?.[i] || '',
                  source: metadata?.source || 'unknown',
                  timestamp: metadata?.timestamp || metadata?.extractedAt || Date.now(),
                  relevanceScore,
                  distance,
                  collectionType: this.getCollectionType(collectionName),
                  metadata: processedMetadata
                });
              }
            }
          }
        } catch (error) {
          console.warn(`搜索集合 ${collectionName} 失败:`, error);
        }
      }

      // 应用排序
      allResults.sort((a, b) => {
        let valueA: number, valueB: number;
        
        switch (sortBy) {
          case 'relevance':
            valueA = a.relevanceScore || 0;
            valueB = b.relevanceScore || 0;
            break;
          case 'time':
            valueA = a.timestamp || a.updated || a.created || 0;
            valueB = b.timestamp || b.updated || b.created || 0;
            break;
          case 'importance':
            valueA = a.importance || 0;
            valueB = b.importance || 0;
            break;
          default:
            // 默认按相关度排序
            valueA = a.relevanceScore || 0;
            valueB = b.relevanceScore || 0;
        }
        
        return sortOrder === 'desc' ? valueB - valueA : valueA - valueB;
      });

      // 分页
      const paginatedResults = allResults.slice(0, limit);
      
      console.log(`🔍 向量搜索完成: "${query}" -> ${paginatedResults.length}/${allResults.length} 条结果 (${returnType}, 排序:${sortBy})`);

      return {
        data: paginatedResults,
        total: allResults.length,
        source: 'cloud',
        cached: false,
        queryTime: Date.now() - startTime
      };

    } catch (error) {
      console.error('向量搜索失败:', error);
      return {
        data: [],
        total: 0,
        source: 'cloud',
        cached: false,
        queryTime: Date.now() - startTime
      };
    }
  }

  /**
   * 获取集合类型
   */
  private getCollectionType(collectionName: string): string {
    if (collectionName.includes('messages')) return 'message';
    if (collectionName.includes('webpages')) return 'webpage';
    if (collectionName.includes('entities')) return 'entity';
    return 'unknown';
  }

  /**
   * 存储实体到云端
   */
  async storeEntity(entity: MemoryEntity): Promise<boolean> {
    this.ensureInitialized();

    try {
      const collection = this.collections.get(`${this.username}-graph-entities`);
      if (!collection) return false;

      // 生成实体描述文本用于向量化
      const description = `${entity.name} ${entity.description || ''} ${JSON.stringify(entity.properties)}`;
      const embedding = await getEmbeddingViaOffscreen(description);

      await collection.add({
        ids: [entity.id],
        documents: [description],
        embeddings: [embedding],
        metadatas: [{
          type: entity.type,
          name: entity.name,
          created: entity.created,
          updated: entity.updated,
          properties: JSON.stringify(entity.properties),
          description: entity.description || '',
          accessCount: entity.accessCount || 0,
          lastAccessed: entity.lastAccessed || Date.now(),
          importance: entity.importance || 0.5,
          tags: JSON.stringify(entity.tags || []),
          status: entity.status || 'active'
        }]
      });

      return true;
    } catch (error) {
      console.error('存储实体到云端失败:', error);
      return false;
    }
  }

  /**
   * 存储消息到云端
   */
  async storeMessage(messageData: {
    id: string;
    content: string;
    metadata: any;
  }): Promise<boolean> {
    this.ensureInitialized();

    try {
      const collection = this.collections.get(`${this.username}-messages`);
      if (!collection) return false;

      const embedding = await getEmbeddingViaOffscreen(messageData.content);

      // 转换复杂元数据为 ChromaDB 兼容格式
      const chromaMetadata = this.convertMetadataForChroma(messageData.metadata);

      await collection.add({
        ids: [messageData.id],
        documents: [messageData.content],
        embeddings: [embedding],
        metadatas: [chromaMetadata]
      });

      return true;
    } catch (error) {
      console.error('存储消息到云端失败:', error);
      return false;
    }
  }

  /**
   * 存储网页到云端
   */
  async storeWebpage(webpageData: {
    id: string;
    url: string;
    title: string;
    content: string;
    metadata: any;
  }): Promise<boolean> {
    this.ensureInitialized();

    try {
      const collection = this.collections.get(`${this.username}-webpages`);
      if (!collection) return false;

      const content = `${webpageData.title} ${webpageData.content}`;
      const embedding = await getEmbeddingViaOffscreen(content);

      await collection.add({
        ids: [webpageData.id],
        documents: [content],
        embeddings: [embedding],
        metadatas: [{
          ...webpageData.metadata,
          title: webpageData.title,
          url: webpageData.url
        }]
      });

      return true;
    } catch (error) {
      console.error('存储网页到云端失败:', error);
      return false;
    }
  }

  /**
   * 更新实体
   */
  async updateEntity(entityId: string, updates: Partial<MemoryEntity>): Promise<boolean> {
    this.ensureInitialized();

    try {
      const collection = this.collections.get(`${this.username}-graph-entities`);
      if (!collection) return false;

      // 获取现有实体
      const existing = await collection.get({
        ids: [entityId],
        include: ['metadatas', 'documents']
      });

      if (!existing.metadatas?.[0]?.[0]) return false;

      // 合并更新
      const currentMetadata = existing.metadatas[0][0] as any;
      const updatedMetadata = {
        ...currentMetadata,
        ...Object.fromEntries(
          Object.entries(updates).map(([key, value]) => [
            key,
            typeof value === 'object' ? JSON.stringify(value) : value
          ])
        ),
        updated: Date.now()
      };

      // 更新文档
      const description = `${updates.name || currentMetadata.name || ''} ${updates.description || currentMetadata.description || ''} ${JSON.stringify(updates.properties || JSON.parse(currentMetadata.properties || '{}'))}`;
      const embedding = await getEmbeddingViaOffscreen(description);

      await collection.update({
        ids: [entityId],
        documents: [description],
        embeddings: [embedding],
        metadatas: [updatedMetadata]
      });

      return true;
    } catch (error) {
      console.error('更新实体失败:', error);
      return false;
    }
  }

  /**
   * 删除实体
   */
  async deleteEntity(entityId: string): Promise<boolean> {
    this.ensureInitialized();

    try {
      const collection = this.collections.get(`${this.username}-graph-entities`);
      if (!collection) return false;

      await collection.delete({
        ids: [entityId]
      });

      return true;
    } catch (error) {
      console.error('删除实体失败:', error);
      return false;
    }
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

    try {
      const results: any[] = [];

      // 从消息集合获取最近数据
      const messageCollection = this.collections.get(`${this.username}-messages`);
      if (messageCollection) {
        const messageResults = await messageCollection.get({
          limit: limit / 2,
          include: ['metadatas', 'documents']
        });

        if (messageResults.metadatas && messageResults.documents) {
          for (let i = 0; i < messageResults.metadatas.length; i++) {
            const metadata = messageResults.metadatas[i];
            const document = messageResults.documents[i];
            
            results.push({
              id: `msg_${i}`,
              type: 'message',
              title: metadata.summary || '消息记录',
              content: document.substring(0, 200) + '...',
              timestamp: metadata.timestamp || Date.now(),
              source: metadata.source || 'unknown',
              metadata
            });
          }
        }
      }

      // 从网页集合获取最近数据
      const webpageCollection = this.collections.get(`${this.username}-webpages`);
      if (webpageCollection) {
        const webpageResults = await webpageCollection.get({
          limit: limit / 2,
          include: ['metadatas', 'documents']
        });

        if (webpageResults.metadatas && webpageResults.documents) {
          for (let i = 0; i < webpageResults.metadatas.length; i++) {
            const metadata = webpageResults.metadatas[i];
            const document = webpageResults.documents[i];
            
            results.push({
              id: `web_${i}`,
              type: 'webpage',
              title: metadata.title || '网页访问',
              content: document.substring(0, 200) + '...',
              timestamp: metadata.extractedAt || Date.now(),
              source: metadata.domain || 'unknown',
              metadata
            });
          }
        }
      }

      // 按时间排序
      return results
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, limit);

    } catch (error) {
      console.error('获取时间轴数据失败:', error);
      return [];
    }
  }

  /**
   * 反序列化 metadata 中的对象字段
   */
  private deserializeMetadata(metadata: any): any {
    const processed = { ...metadata };
    
    try {
      // 反序列化 contextMessages 字段
      if (processed.contextMessages && typeof processed.contextMessages === 'string') {
        processed.contextMessages = JSON.parse(processed.contextMessages);
      }
    } catch (error) {
      // 忽略解析错误
    }
      
    try {
      // 反序列化 matchedRules 字段
      if (processed.matchedRules && typeof processed.matchedRules === 'string') {
        processed.matchedRules = JSON.parse(processed.matchedRules);
      }
    } catch (error) {
      // 忽略解析错误
    }
      
    try {
      // 反序列化 entities 字段
      if (processed.entities && typeof processed.entities === 'string') {
        processed.entities = JSON.parse(processed.entities);
      }
    } catch (error) {
      // 忽略解析错误
    }
      
    try {
      // 反序列化 relationships 字段
      if (processed.relationships && typeof processed.relationships === 'string') {
        processed.relationships = JSON.parse(processed.relationships);
      }
    } catch (error) {
      // 忽略解析错误
    }
      
    try {
      // 反序列化 metadata 嵌套字段
      if (processed.metadata && typeof processed.metadata === 'string') {
        processed.metadata = JSON.parse(processed.metadata);
      }
    } catch (error) {
      // 忽略解析错误
    }
      
    try {
      // 反序列化 actions 字段
      if (processed.actions && typeof processed.actions === 'string') {
        processed.actions = JSON.parse(processed.actions);
      }
    } catch (error) {
      // 忽略解析错误
    }
    
    return processed;
  }

  /**
   * 获取云端实体数量
   */
  async getEntityCount(): Promise<number> {
    if (!this.client) return 0;
    
    try {
      const collection = this.collections.get(`${this.username}-graph-entities`);
      if (!collection) return 0;
      
      const result = await collection.get({ limit: 1 });
      return result.ids?.length || 0;
    } catch (error) {
      console.error('获取实体数量失败:', error);
      return 0;
    }
  }

  /**
   * 获取单个实体
   */
  async getEntity(entityId: string): Promise<MemoryEntity | null> {
    this.ensureInitialized();

    try {
      const collection = this.collections.get(`${this.username}-graph-entities`);
      if (!collection) return null;

      const result = await collection.get({
        ids: [entityId],
        include: ['metadatas', 'documents']
      });

      if (result.ids && result.ids.length > 0 && result.metadatas) {
        const metadata = result.metadatas[0] as any;
        
        // 跳过备份数据
        if (metadata.type === 'graph_backup') return null;
        
        const entity = await this.buildEntity({
          metadata,
          id: result.ids[0],
          document: result.documents?.[0],
          collectionName: 'graph-entities'
        });
        return entity;
      }

      return null;
    } catch (error) {
      console.error(`获取实体 ${entityId} 失败:`, error);
      return null;
    }
  }

  /**
   * 查询云端实体（支持按type过滤和真正的分页）
   */
  async queryEntities(
    type?: string,
    searchTerm?: string,
    options: QueryOptions = {}
  ): Promise<QueryResult<MemoryEntity>> {
    this.ensureInitialized();

    const startTime = Date.now();
    const limit = options.limit || 30; // 默认30条
    const offset = options.offset || 0;

    try {
      const collection = this.collections.get(`${this.username}-graph-entities`);
      if (!collection) {
        return {
          data: [],
          total: 0,
          source: 'cloud',
          cached: false,
          queryTime: Date.now() - startTime
        };
      }

      // 如果有搜索词，使用向量搜索
      if (searchTerm && searchTerm.length > 2) {
        // 转换 sortBy 参数为向量搜索支持的类型
        let vectorSortBy: 'relevance' | 'time' | 'importance' = 'relevance';
        if (options.sortBy === 'importance') {
          vectorSortBy = 'importance';
        } else if (options.sortBy === 'created' || options.sortBy === 'updated') {
          vectorSortBy = 'time';
        }
        
        return await this.searchByVector(searchTerm, type, {
          limit,
          nResults: limit * 2, // 获取更多结果以应对过滤
          collections: ['entities'],
          returnType: 'entities',
          sortBy: vectorSortBy,
          sortOrder: options.sortOrder
        });
      }

      // 构建 where 查询条件
      const whereCondition: any = {
        type: { $ne: 'graph_backup' } // 排除备份数据
      };
      
      // 如果指定了实体类型，添加类型过滤
      if (type) {
        whereCondition.type = type;
      }

      // 直接使用 where 查询，真正的分页
      const result = await collection.get({
        where: whereCondition,
        include: ['metadatas', 'documents'],
        limit,
        offset
      });

      if (!result.ids || result.ids.length === 0) {
        return {
          data: [],
          total: 0,
          source: 'cloud',
          cached: false,
          queryTime: Date.now() - startTime
        };
      }

      // 构建实体列表
      const entities: MemoryEntity[] = [];
      for (let i = 0; i < result.ids.length; i++) {
        const metadata = result.metadatas![i] as any;
        
        const entity = await this.buildEntity({
          metadata,
          id: result.ids[i],
          document: result.documents?.[i],
          collectionName: 'graph-entities'
        });
        
        if (entity) {
          entities.push(entity);
        }
      }

      // 应用排序
      if (options.sortBy && entities.length > 0) {
        entities.sort((a, b) => {
          const order = options.sortOrder === 'desc' ? -1 : 1;
          switch (options.sortBy) {
            case 'name':
              return order * a.name.localeCompare(b.name);
            case 'created':
              return order * (a.created - b.created);
            case 'updated':
              return order * (a.updated - b.updated);
            case 'importance':
              return order * (a.importance - b.importance);
            default:
              return 0;
          }
        });
      }

      // 获取总数 (这里需要单独查询总数，因为分页查询不返回总数)
      const countResult = await collection.get({
        where: whereCondition,
        include: [] // 只获取 ID，不需要其他数据
      });
      const total = countResult.ids?.length || 0;

      console.log(`📥 从云端分页查询了 ${entities.length} 个实体 (offset: ${offset}, limit: ${limit}, type: ${type || '全部'})`);
      
      return {
        data: entities,
        total: total,
        source: 'cloud',
        cached: false,
        queryTime: Date.now() - startTime
      };
    } catch (error) {
      console.error('查询云端实体失败:', error);
      return {
        data: [],
        total: 0,
        source: 'cloud',
        cached: false,
        queryTime: Date.now() - startTime
      };
    }
  }

  /**
   * 备份关系数据到云端
   */
  async backupRelationships(relationshipData: {
    relationships: any[];
    entityToRelations: any[];
    typeToEntities: any[];
  }): Promise<boolean> {
    this.ensureInitialized();

    try {
      const collection = this.collections.get(`${this.username}-graph-entities`);
      if (!collection) return false;

      const backupId = `graph-backup-${Date.now()}`;
      const backupContent = JSON.stringify({
        ...relationshipData,
        backupTime: Date.now()
      });
      
      const embedding = await getEmbeddingViaOffscreen(backupContent);

      await collection.add({
        ids: [backupId],
        documents: [backupContent],
        embeddings: [embedding],
        metadatas: [{
          type: 'graph_backup',
          backupTime: Date.now(),
          relationshipCount: relationshipData.relationships.length
        }]
      });

      console.log(`☁️ 关系数据已备份: ${backupId}`);
      return true;
    } catch (error) {
      console.error('备份关系数据失败:', error);
      return false;
    }
  }

  /**
   * 从云端恢复关系数据
   */
  async restoreRelationships(): Promise<{
    relationships: any[];
    entityToRelations: any[];
    typeToEntities: any[];
  } | null> {
    this.ensureInitialized();

    try {
      const collection = this.collections.get(`${this.username}-graph-entities`);
      if (!collection) return null;

      // 查找最新备份
      const result = await collection.get({
        where: { type: 'graph_backup' },
        include: ['metadatas', 'documents']
      });

      if (!result.ids || result.ids.length === 0) {
        console.log('📭 云端没有找到关系数据备份');
        return null;
      }

      // 获取最新备份
      const latestBackupIndex = result.metadatas!
        .map((meta: any, index: number) => ({ meta, index }))
        .sort((a, b) => (b.meta.backupTime || 0) - (a.meta.backupTime || 0))[0].index;

      const backupContent = result.documents![latestBackupIndex];
      const backupData = JSON.parse(backupContent);

      console.log(`📥 恢复关系数据: ${backupData.relationships?.length || 0} 个关系`);
      return {
        relationships: backupData.relationships || [],
        entityToRelations: backupData.entityToRelations || [],
        typeToEntities: backupData.typeToEntities || []
      };
    } catch (error) {
      console.error('恢复关系数据失败:', error);
      return null;
    }
  }

  /**
   * 获取消息集合（用于从消息重建关系）
   */
  async getMessagesCollection() {
    try {
      if (!this.client) return null;
      
      const messagesCollectionName = `${this.username}-messages`;
      const collections = await this.client.listCollections();
      
      // ChromaDB 3.x returns Collection objects, not strings
      const collectionNames = collections.map(c => c.name);
      if (!collectionNames.includes(messagesCollectionName)) {
        return null;
      }

      return this.collections.get(messagesCollectionName) || null;
    } catch (error) {
      console.error('获取消息集合失败:', error);
      return null;
    }
  }

  /**
   * 批量操作
   */
  async batchStore(items: Array<{
    type: 'entity' | 'message' | 'webpage';
    data: any;
  }>): Promise<{ success: number; failed: number }> {
    this.ensureInitialized();

    let success = 0;
    let failed = 0;

    const batches = this.chunkArray(items, this.config.batchSize);

    for (const batch of batches) {
      try {
        await Promise.all(batch.map(async (item) => {
          try {
            switch (item.type) {
              case 'entity':
                await this.storeEntity(item.data);
                break;
              case 'message':
                await this.storeMessage(item.data);
                break;
              case 'webpage':
                await this.storeWebpage(item.data);
                break;
            }
            success++;
          } catch (error) {
            failed++;
            console.error(`批量存储失败 (${item.type}):`, error);
          }
        }));
      } catch (error) {
        failed += batch.length;
        console.error('批量存储失败:', error);
      }
    }

    return { success, failed };
  }

  // ==================== 私有方法 ====================

  private async initializeCollections(): Promise<void> {
    if (!this.client) throw new Error('ChromaDB 客户端未初始化');

    // ChromaDB v3: 显式指定嵌入函数，防止默认加载 @chroma-core/default-embed
    const nullEmbeddingFunction = new NullEmbeddingFunction();

    for (const collectionType of this.config.collections) {
      const collectionName = `${this.username}-${collectionType}`;
      
      try {
        const collection = await this.client.getOrCreateCollection({ 
          name: collectionName,
          embeddingFunction: nullEmbeddingFunction
        });
        this.collections.set(collectionName, collection);
        console.log(`✅ 集合已初始化: ${collectionName}`);
      } catch (error) {
        console.error(`❌ 初始化集合失败: ${collectionName}`, error);
      }
    }
  }

  private async getUserInfo(): Promise<{ username: string }> {
    try {
      const result = await chrome.storage.local.get(['userinfo']);
      return result.userinfo || { username: 'default-user' };
    } catch (error) {
      console.warn('获取用户信息失败，使用默认值');
      return { username: 'default-user' };
    }
  }

  private async buildEntity(entityData: {
    metadata?: any;
    id?: string;
    document?: string;
    distance?: number;
    relevanceScore?: number;
    collectionName: string;
  }): Promise<MemoryEntity | null> {
    try {
      const { metadata, id, document, distance, relevanceScore, collectionName } = entityData;
      
      if (collectionName.includes('graph-entities')) {
        return {
          id,
          type: metadata.type || 'Document',
          name: metadata.name || '未知实体',
          description: metadata.description || metadata.summary || document,
          properties: typeof metadata.properties === 'string' ? JSON.parse(metadata.properties || '{}') : (metadata.properties || {}),
          created: metadata.created || Date.now(),
          updated: metadata.updated || Date.now(),
          accessCount: metadata.accessCount || 0,
          lastAccessed: metadata.lastAccessed || Date.now(),
          importance: metadata.importance || 0.5,
          tags: typeof metadata.tags === 'string' ? JSON.parse(metadata.tags || '[]') : (metadata.tags || []),
          status: metadata.status || 'active',
          statistic: {
            conversations: 0,
            projects: 0,
            participants: 0,
            resources: 0,
            documents: 0,
            webpages: 0,
            relationships: 0
          },
          // 添加搜索相关信息
          ...(distance !== undefined && { searchDistance: distance }),
          ...(relevanceScore !== undefined && { relevanceScore })
        };
      }

      // 从其他集合构建虚拟实体
      return {
        id: id || `virtual_${Date.now()}_${Math.random()}`,
        type: 'Document',
        name: metadata.title || metadata.summary || metadata.name || '相关内容',
        description: metadata.summary || metadata.description || document || '相关内容',
        properties: {
          ...metadata,
          ...(document && { originalDocument: document }),
          collectionSource: collectionName
        },
        created: metadata.timestamp || metadata.extractedAt || metadata.created || Date.now(),
        updated: metadata.timestamp || metadata.extractedAt || metadata.updated || Date.now(),
        accessCount: metadata.accessCount || 1,
        lastAccessed: metadata.lastAccessed || Date.now(),
        importance: metadata.importance || 0.3,
        tags: metadata.tags || [],
        status: metadata.status || 'active',
        statistic: {
          conversations: 0,
          projects: 0,
          participants: 0,
          resources: 0,
          documents: 0,
          webpages: 0,
          relationships: 0
        },
        // 添加搜索相关信息
        ...(distance !== undefined && { searchDistance: distance }),
        ...(relevanceScore !== undefined && { relevanceScore })
      };
    } catch (error) {
      console.error('构建实体失败:', error);
      return null;
    }
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * 存储用户画像到云端
   */
  async storeUserProfile(userId: string, profile: UserProfile): Promise<boolean> {
    this.ensureInitialized();

    try {
      // 获取或创建用户画像集合
      const collectionName = `${this.username}-userprofiles`;
      let collection = this.collections.get(collectionName);
      
      if (!collection) {
        collection = await this.client!.getOrCreateCollection({
          name: collectionName,
          metadata: { type: 'user_profiles' },
          embeddingFunction: new NullEmbeddingFunction()
        });
        this.collections.set(collectionName, collection);
      }

      // 为用户画像创建向量表示
      const profileText = this.createProfileText(profile);
      const embedding = await getEmbeddingViaOffscreen(profileText);

      // 存储用户画像
      await collection.upsert({
        ids: [userId],
        documents: [profileText],
        embeddings: [embedding],
        metadatas: [{
          userId: userId,
          lastUpdated: profile.lastUpdated,
          createdAt: profile.createdAt,
          totalInteractions: profile.statistics.totalInteractions,
          profileData: JSON.stringify(profile)
        }]
      });

      console.log(`✅ 用户画像 ${userId} 已存储到云端`);
      return true;
    } catch (error) {
      console.error('存储用户画像到云端失败:', error);
      return false;
    }
  }

  /**
   * 从云端获取用户画像
   */
  async getUserProfile(userId: string): Promise<UserProfile | null> {
    this.ensureInitialized();

    try {
      const collectionName = `${this.username}-userprofiles`;
      const collection = this.collections.get(collectionName);
      
      if (!collection) {
        return null;
      }

      const result = await collection.get({
        ids: [userId],
        include: ['metadatas']
      });

      if (result.metadatas && result.metadatas.length > 0) {
        const metadata = result.metadatas[0] as any;
        if (metadata.profileData) {
          return JSON.parse(metadata.profileData) as UserProfile;
        }
      }

      return null;
    } catch (error) {
      console.error('从云端获取用户画像失败:', error);
      return null;
    }
  }

  /**
   * 创建用户画像的文本表示（用于向量化）
   */
  private createProfileText(profile: UserProfile): string {
    const parts: string[] = [];
    
    // 用户ID和基本信息
    parts.push(`用户: ${profile.userId}`);
    
    // 兴趣项目
    if (profile.interests.projects.length > 0) {
      parts.push('关注项目: ' + profile.interests.projects
        .slice(0, 5)
        .map(p => `${p.name}(权重:${p.currentWeight.toFixed(2)})`)
        .join(', '));
    }
    
    // 关注人员
    if (profile.interests.people.length > 0) {
      parts.push('关注人员: ' + profile.interests.people
        .slice(0, 5)
        .map(p => `${p.name}(权重:${p.currentWeight.toFixed(2)})`)
        .join(', '));
    }
    
    // 技术栈
    if (profile.interests.technologies.length > 0) {
      parts.push('技术栈: ' + profile.interests.technologies
        .slice(0, 5)
        .map(t => `${t.name}(权重:${t.currentWeight.toFixed(2)})`)
        .join(', '));
    }
    
    // 主题
    if (profile.interests.topics.length > 0) {
      parts.push('关注主题: ' + profile.interests.topics
        .slice(0, 5)
        .map(t => `${t.name}(权重:${t.currentWeight.toFixed(2)})`)
        .join(', '));
    }
    
    // 专业领域
    if (profile.derivedPreferences.expertiseAreas.length > 0) {
      parts.push('专业领域: ' + profile.derivedPreferences.expertiseAreas.join(', '));
    }
    
    // 统计信息
    parts.push(`总交互次数: ${profile.statistics.totalInteractions}`);
    parts.push(`日均活动: ${profile.statistics.averageDailyActivity.toFixed(1)}`);
    
    return parts.join('\n');
  }

  /**
   * 备份关系数据到独立的关系集合
   */
  async backupRelationshipsToCollection(relationshipData: any): Promise<boolean> {
    this.ensureInitialized();

    try {
      if (!relationshipData.relationships || relationshipData.relationships.length === 0) {
        console.log('📭 没有关系数据需要备份');
        return true;
      }

      const relationshipCollectionName = `${this.username}-graph-relationships`;

      // 获取或创建关系集合
      let relationshipCollection;
      try {
        relationshipCollection = await this.client!.getOrCreateCollection({
          name: relationshipCollectionName,
          metadata: { type: 'relationships' },
          embeddingFunction: new NullEmbeddingFunction()
        });
      } catch (error) {
        console.error('❌ 无法创建关系集合:', error);
        return false;
      }

      const relationships = relationshipData.relationships || [];
      let storedCount = 0;

      // 按实体类型和时间进行分组存储，减少数据量
      const groupedRelationships = this.groupRelationshipsForStorage(relationships);

      for (const [groupKey, groupData] of Object.entries(groupedRelationships)) {
        try {
          const groupDoc = {
            id: `rel-group-${groupKey}-${Date.now()}`,
            groupKey,
            relationshipCount: groupData.relationships.length,
            timeRange: groupData.timeRange,
            entityTypes: groupData.entityTypes,
            relationshipTypes: groupData.relationshipTypes,
            createdAt: Date.now(),
            data: JSON.stringify(groupData.relationships)
          };

          // 为文档内容生成向量（用于检索）
          const searchableContent = [
            `关系组 ${groupKey}`,
            `实体类型: ${groupData.entityTypes.join(', ')}`,
            `关系类型: ${groupData.relationshipTypes.join(', ')}`,
            `时间范围: ${new Date(groupData.timeRange.start).toLocaleDateString()} - ${new Date(groupData.timeRange.end).toLocaleDateString()}`
          ].join('\n');

          const embedding = await getEmbeddingViaOffscreen(searchableContent);

          await relationshipCollection.add({
            ids: [groupDoc.id],
            documents: [searchableContent],
            embeddings: [embedding],
            metadatas: [groupDoc]
          });

          storedCount += groupData.relationships.length;
        } catch (error) {
          console.error(`❌ 存储关系组 ${groupKey} 失败:`, error);
        }
      }

      console.log(`☁️ 关系数据已备份到独立集合: ${storedCount} 个关系，${Object.keys(groupedRelationships).length} 个分组`);
      return true;
      
    } catch (error) {
      console.error('❌ 云端备份关系数据失败:', error);
      return false;
    }
  }

  /**
   * 按类型和时间对关系进行分组，优化存储和检索
   */
  private groupRelationshipsForStorage(relationships: any[]): Record<string, any> {
    const groups: Record<string, any> = {};
    const timeSpan = 7 * 24 * 60 * 60 * 1000; // 7天为一组

    for (const [id, relationship] of relationships) {
      if (!relationship) continue;

      // 计算时间分组
      const timestamp = relationship.created || Date.now();
      const timeGroup = Math.floor(timestamp / timeSpan);
      
      // 获取实体类型（从 ID 推断）
      const fromType = this.getEntityTypeFromId(relationship.fromId);
      const toType = this.getEntityTypeFromId(relationship.toId);
      const entityTypesKey = [fromType, toType].sort().join('-');
      
      // 生成分组键：实体类型_关系类型_时间组
      const groupKey = `${entityTypesKey}_${relationship.type}_${timeGroup}`;

      if (!groups[groupKey]) {
        groups[groupKey] = {
          relationships: [],
          timeRange: {
            start: timeGroup * timeSpan,
            end: (timeGroup + 1) * timeSpan
          },
          entityTypes: [fromType, toType],
          relationshipTypes: new Set()
        };
      }

      groups[groupKey].relationships.push([id, relationship]);
      groups[groupKey].relationshipTypes.add(relationship.type);
    }

    // 转换 Set 为 Array
    Object.values(groups).forEach((group: any) => {
      group.relationshipTypes = Array.from(group.relationshipTypes);
    });

    return groups;
  }

  /**
   * 从实体ID推断实体类型
   */
  private getEntityTypeFromId(entityId: string): string {
    if (!entityId) return 'Unknown';
    const parts = entityId.split('_');
    return parts[0] || 'Unknown';
  }

  /**
   * 将复杂元数据转换为 ChromaDB 兼容的格式
   * ChromaDB 只支持 string, number, boolean, null 类型
   */
  private convertMetadataForChroma(metadata: any): Record<string, string | number | boolean | null> {
    const converted: Record<string, string | number | boolean | null> = {};
    
    if (!metadata) return converted;

    // 递归处理函数
    const processValue = (key: string, value: any): void => {
      if (value === null || value === undefined) {
        converted[key] = null;
      } else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        converted[key] = value;
      } else if (Array.isArray(value)) {
        // 数组转换为JSON字符串
        converted[key] = JSON.stringify(value);
      } else if (typeof value === 'object') {
        // 对象转换为JSON字符串
        converted[key] = JSON.stringify(value);
      } else {
        // 其他类型转换为字符串
        converted[key] = String(value);
      }
    };

    // 处理顶级字段
    for (const [key, value] of Object.entries(metadata)) {
      processValue(key, value);
    }

    return converted;
  }

  /**
   * 将基础 MemoryEntity 扩展为包含完整缓存数据的实体
   */
  async extendEntityToDetailCache(entity: MemoryEntity): Promise<any> {
    this.ensureInitialized();

    try {
      // 获取相关项目（查询 Project 类型实体）
      const projectResults = await this.queryEntities('Project');
      const relatedProjects = projectResults.data.slice(0, 5).map((project: MemoryEntity) => ({
        id: project.id,
        name: project.name || '未知项目',
        status: project.properties?.status || project.status || '开发中',
        description: project.description || `项目: ${project.name || '未命名项目'}`
      }));

      // 获取相关资源（查询 Document 类型实体）
      const documentResults = await this.queryEntities('Document');
      const relatedResources = documentResults.data.slice(0, 5).map((doc: MemoryEntity) => ({
        id: doc.id,
        name: doc.name || '文档资源',
        type: '文档',
        url: doc.properties?.url || '#'
      }));

      // 使用向量搜索获取相关对话详细信息
      const conversationResults = await this.searchByVector(entity.name, undefined, {
        collections: ['messages'],
        returnType: 'raw',
        limit: 100,
        sortBy: 'relevance',
        sortOrder: 'desc'
      });

      // 转换为前端需要的格式，包含完整的contextMessages
      const latestConversations = conversationResults.data.map((msg: any) => {
        // 处理上下文消息：从metadata中提取contextMessages
        let context: any[] = [];
        if (msg.metadata?.contextMessages && Array.isArray(msg.metadata.contextMessages)) {
          context = msg.metadata.contextMessages.map((ctx: any) => ({
            id: ctx.id,
            sender: ctx.sender,
            content: ctx.content,
            datetime: ctx.datetime,
            isMainMessage: ctx.isMainMessage || false
          }));
        }

        return {
          id: msg.messageId,
          sender: msg.source,
          group: msg.metadata?.teamName || '聊天记录',
          datetime: new Date(msg.timestamp).toISOString(),
          summary: msg.metadata?.summary || msg.content.substring(0, 100) + '...',
          originalContent: msg.content,
          highlightText: msg.metadata?.highlightText || msg.content,
          teamUrl: msg.metadata?.team_url || '#',
          matchedRules: msg.metadata?.matchedRules || [],
          relevanceScore: msg.relevanceScore,
          context: context
        };
      });

      // 获取相关网页记录
      const latestWebpages = latestConversations
        .filter(conv => conv.context && conv.context.length > 0)
        .slice(0, 3)
        .map(conv => ({
          id: `web-${conv.id}`,
          title: `${entity.name}相关网页`,
          url: conv.teamUrl || '#',
          type: 'webpage',
          visitTime: this.formatTimeAgo(new Date(conv.datetime).getTime()),
          summary: `与${entity.name}相关的内容`,
          tags: [entity.name, '聊天记录']
        }));

      // 统计参与者
      const participants = new Set(latestConversations.map(conv => conv.sender)).size;

      // 构建扩展后的实体详情
      return {
        ...entity,
        statistic: {
          conversations: latestConversations.length,
          projects: relatedProjects.length,
          participants: participants || 1,
          resources: relatedResources.length,
          documents: relatedResources.filter(r => r.type === '文档').length,
          webpages: latestWebpages.length,
          relationships: 0
        },
        latestConversations: latestConversations.slice(0, 5), // 只保留前5条
        latestWebpages: latestWebpages,
        relatedResources: relatedResources,
        relatedProjects: relatedProjects,
        relatedParticipants: [], // 由 LocalStorage 在本地填充
        cachedAt: Date.now()
      };
    } catch (error) {
      console.error('扩展实体详情失败:', error);
      // 返回基础实体和默认值
      return {
        ...entity,
        statistic: {
          conversations: 0,
          projects: 0,
          participants: 1,
          resources: 0,
          documents: 0,
          webpages: 0,
          relationships: 0
        },
        latestConversations: [],
        latestWebpages: [],
        relatedResources: [],
        relatedProjects: [],
        relatedParticipants: [],
        cachedAt: Date.now()
      };
    }
  }

  /**
   * 格式化时间为相对时间
   */
  private formatTimeAgo(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;
    
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    const weeks = Math.floor(diff / 604800000);
    
    if (hours < 1) return '刚刚';
    if (hours < 24) return `${hours}小时前`;
    if (days < 7) return `${days}天前`;
    if (weeks < 4) return `${weeks}周前`;
    return new Date(timestamp).toLocaleDateString();
  }

  /**
   * 批量更新实体的统计信息
   */
  async batchUpdateEntityStatistics(updates: Array<{
    entityId: string;
    statistic: {
      conversations: number;
      projects: number;
      participants: number;
      resources: number;
      documents: number;
      webpages: number;
      relationships: number;
    };
    lastUpdated: number;
  }>): Promise<void> {
    this.ensureInitialized();

    if (!updates || updates.length === 0) {
      console.log('📊 没有统计信息需要更新');
      return;
    }

    try {
      const collection = this.collections.get(`${this.username}-graph-entities`);
      if (!collection) {
        throw new Error('graph-entities 集合未找到');
      }

      console.log(`📊 开始批量更新 ${updates.length} 个实体的统计信息...`);

      // 分批处理，避免一次性操作过多
      const batchSize = 50;
      for (let i = 0; i < updates.length; i += batchSize) {
        const batch = updates.slice(i, i + batchSize);
        
        try {
          // 获取当前批次的实体
          const entityIds = batch.map(u => u.entityId);
          const existingEntities = await collection.get({
            ids: entityIds,
            include: ['metadatas']
          });

          if (!existingEntities.ids || existingEntities.ids.length === 0) {
            console.log(`📊 批次 ${i / batchSize + 1}: 没有找到对应的实体`);
            continue;
          }

          // 准备更新的元数据
          const updateMetadatas = [];
          const updateIds = [];

          for (let j = 0; j < existingEntities.ids.length; j++) {
            const entityId = existingEntities.ids[j];
            const updateInfo = batch.find(u => u.entityId === entityId);
            
            if (updateInfo && existingEntities.metadatas) {
              const currentMetadata = existingEntities.metadatas[j] as any;
              
              // 更新统计信息
              const updatedMetadata = {
                ...currentMetadata,
                statistic: updateInfo.statistic,
                lastStatisticUpdate: updateInfo.lastUpdated,
                updated: Date.now()
              };

              updateMetadatas.push(updatedMetadata);
              updateIds.push(entityId);
            }
          }

          if (updateIds.length > 0) {
            // 执行批量更新
            await collection.update({
              ids: updateIds,
              metadatas: updateMetadatas
            });

            console.log(`📊 批次 ${i / batchSize + 1}: 成功更新 ${updateIds.length} 个实体的统计信息`);
          }

        } catch (batchError) {
          console.error(`📊 批次 ${i / batchSize + 1} 更新失败:`, batchError);
        }
      }

      console.log(`📊 批量统计信息更新完成`);

    } catch (error) {
      console.error('📊 批量更新实体统计信息失败:', error);
      throw error;
    }
  }

  private ensureInitialized(): void {
    if (!this.isInitialized || !this.client) {
      throw new Error('云端存储未初始化');
    }
  }
}
