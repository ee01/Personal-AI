/**
 * 云端存储管理器
 * 专门管理 ChromaDB 操作，包括向量搜索和完整数据存储
 */

import { ChromaClient, Collection, EmbeddingFunction } from 'chromadb';
import { getEmbeddingViaOffscreen } from '../embeddings';
import { getEnvConfig } from '../utils';
import { QueryResult, VectorSearchOptions, QueryOptions } from '../memory';

// 基础实体接口 - CloudStorage 专用，包含所有关联数据
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
  
  // 统计概览
  statistic: {
    conversations: number;
    projects: number;
    participants: number;
    resources: number; 
    documents: number;
    webpages: number;
    relationships: number;
    topics: number;
    jiraTickets: number;
  };
  
  // 🆕 关联数据存储（在向量数据库中直接存储，最多50条）
  relatedData: {
    // 关联的聊天消息
    conversations: Array<{
      id: string;
      summary: string;
      sender: string;
      group: string;
      datetime: string;
      relevanceScore: number;
      context: Array<{
        id: string;
        sender: string;
        content: string;
        datetime: string;
        isMainMessage: boolean;
      }>;
    }>;
    
    // 关联的网页浏览记录
    webpages: Array<{
      id: string;
      summary: string;
      title: string;
      url: string;
      domain: string;
      visitTime: string;
      relevanceScore: number;
    }>;
    
    // 关联的资源
    resources: Array<{
      id: string;
      summary: string;
      name: string;
      type: string;
      url?: string;
      relevanceScore: number;
    }>;
    
    // 关联的项目
    projects: Array<{
      id: string;
      name: string;
      description: string;
      status: string;
      relevanceScore: number;
    }>;
    
    // 关联的人员
    people: Array<{
      id: string;
      name: string;
      role: string;
      team: string;
      expertise: string[];
      lastContact: number;
      relevanceScore: number;
    }>;
    
    // 关联的话题
    topics: Array<{
      id: string;
      name: string;
      summary: string;
      category: string;
      relevanceScore: number;
    }>;
    
    // 🆕 关联的JIRA ticket
    jiraTickets: Array<{
      id: string;
      key: string;
      summary: string;
      status: string;
      assignee: string;
      priority: string;
      relevanceScore: number;
    }>;
    
    // 关联的其他实体（从同一消息中提取的实体）
    cooccurringEntities: Array<{
      id: string;
      name: string;
      type: string;
      relevanceScore: number;
    }>;
  };
  
  // Person类型特有字段
  role?: string;
  team?: string;
  lastContact?: number;
  expertise?: string[];
  
  // Project类型特有字段
  isHighlighted?: boolean;
  
  // 🆕 实体热度和重要性评分（用于决定是否立即更新documents）
  hotness?: number; // 0-1，基于最近活动频率
  criticalityScore?: number; // 0-1，基于用户标记和系统判断
  lastDocumentUpdate?: number; // 最后一次documents更新时间
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
   * 存储实体到云端 - 新的关联数据存储
   */
  async storeEntity(entity: MemoryEntity): Promise<boolean> {
    this.ensureInitialized();

    try {
      const collection = this.collections.get(`${this.username}-graph-entities`);
      if (!collection) return false;

      // 🆕 生成丰富的自然语言描述文本
      const naturalDescription = await this.generateNaturalLanguageDescription(entity);
      const embedding = await getEmbeddingViaOffscreen(naturalDescription);

      // 转换关联数据为ChromaDB兼容格式
      const chromaMetadata = this.convertEntityMetadataForChroma(entity);

      await collection.add({
        ids: [entity.id],
        documents: [naturalDescription],
        embeddings: [embedding],
        metadatas: [chromaMetadata]
      });

      console.log(`✅ 实体存储完成: ${entity.name} (${entity.type}), documents长度: ${naturalDescription.length}字符`);
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
   * 🆕 智能更新实体 - 支持关联数据和智能documents更新
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

      // 反序列化现有实体数据
      const currentMetadata = existing.metadatas[0][0] as any;
      const currentEntity = this.deserializeEntityFromMetadata(currentMetadata);
      
      // 🆕 智能合并更新：特别处理relatedData
      const mergedEntity: MemoryEntity = {
        ...currentEntity,
        ...updates,
        updated: Date.now(),
        // 🆕 智能合并关联数据
        relatedData: this.mergeRelatedData(currentEntity.relatedData, updates.relatedData),
        // 🆕 重新计算统计信息
        statistic: this.recalculateStatistics(currentEntity, updates)
      };

      // 🆕 判断是否需要立即更新documents
      const shouldUpdateDocuments = this.shouldUpdateDocuments(mergedEntity, updates);
      
      let documents = existing.documents?.[0] || '';
      let embedding: number[] = [];
      
      if (shouldUpdateDocuments) {
        console.log(`📝 重要实体${mergedEntity.name}立即更新documents...`);
        documents = await this.generateNaturalLanguageDescription(mergedEntity);
        embedding = await getEmbeddingViaOffscreen(documents);
        mergedEntity.lastDocumentUpdate = Date.now();
      } else {
        console.log(`⏳ 普通实体${mergedEntity.name}延迟更新documents`);
        // 保持原有embedding，不重新计算
        const existingResult = await collection.get({
          ids: [entityId], 
          include: ['embeddings']
        });
        embedding = existingResult.embeddings?.[0] || [];
      }

      // 转换为ChromaDB格式
      const chromaMetadata = this.convertEntityMetadataForChroma(mergedEntity);

      // 执行更新
      await collection.update({
        ids: [entityId],
        documents: [documents],
        embeddings: [embedding],
        metadatas: [chromaMetadata]
      });

      console.log(`✅ 实体更新完成: ${mergedEntity.name}, documents更新: ${shouldUpdateDocuments ? '是' : '否'}`);
      return true;
    } catch (error) {
      console.error('更新实体失败:', error);
      return false;
    }
  }

  /**
   * 🆕 判断是否应该立即更新documents
   */
  private shouldUpdateDocuments(entity: MemoryEntity, updates: Partial<MemoryEntity>): boolean {
    // 1. 高重要性实体 (importance > 0.7)
    if (entity.importance && entity.importance > 0.7) return true;
    
    // 2. 高热度实体 (hotness > 0.6)  
    if (entity.hotness && entity.hotness > 0.6) return true;
    
    // 3. 关键性评分高的实体 (criticalityScore > 0.8)
    if (entity.criticalityScore && entity.criticalityScore > 0.8) return true;
    
    // 4. 长时间未更新documents的实体 (超过24小时)
    const daysSinceLastUpdate = entity.lastDocumentUpdate ? 
      (Date.now() - entity.lastDocumentUpdate) / (1000 * 60 * 60 * 24) : 999;
    if (daysSinceLastUpdate > 1) return true;
    
    // 5. 如果关联数据有重大变化（新增5条以上记录）
    const hasSignificantDataChanges = updates.relatedData && (
      (updates.relatedData.conversations && updates.relatedData.conversations.length > 5) ||
      (updates.relatedData.projects && updates.relatedData.projects.length > 2) ||
      (updates.relatedData.jiraTickets && updates.relatedData.jiraTickets.length > 3)
    );
    if (hasSignificantDataChanges) return true;
    
    return false;
  }

  /**
   * 🆕 智能合并关联数据
   */
  private mergeRelatedData(current: any = {}, updates: any = {}): any {
    const merged = { ...current };
    
    // 合并各类关联数据，保持最多50条记录
    const dataTypes = ['conversations', 'webpages', 'resources', 'projects', 'people', 'topics', 'jiraTickets', 'cooccurringEntities'];
    
    for (const type of dataTypes) {
      if (updates[type]) {
        // 合并并去重（基于id）
        const currentItems = merged[type] || [];
        const newItems = updates[type] || [];
        
        const allItems = [...currentItems];
        newItems.forEach((newItem: any) => {
          const existingIndex = allItems.findIndex((item: any) => item.id === newItem.id);
          if (existingIndex >= 0) {
            // 更新现有项目
            allItems[existingIndex] = { ...allItems[existingIndex], ...newItem };
          } else {
            // 添加新项目
            allItems.push(newItem);
          }
        });
        
        // 按相关性和时间排序，保留最多50条
        allItems.sort((a: any, b: any) => {
          // 优先按相关性排序，然后按时间
          const scoreA = (a.relevanceScore || 0) * 100 + (new Date(a.datetime || a.visitTime || Date.now()).getTime() / 1000000);
          const scoreB = (b.relevanceScore || 0) * 100 + (new Date(b.datetime || b.visitTime || Date.now()).getTime() / 1000000);
          return scoreB - scoreA;
        });
        
        merged[type] = allItems.slice(0, 50);
      }
    }
    
    return merged;
  }

  /**
   * 🆕 重新计算统计信息
   */
  private recalculateStatistics(current: MemoryEntity, updates: Partial<MemoryEntity>): any {
    const relatedData = updates.relatedData || current.relatedData || {
      conversations: [],
      webpages: [],
      resources: [],
      projects: [],
      people: [],
      topics: [],
      jiraTickets: [],
      cooccurringEntities: []
    };
    
    return {
      conversations: relatedData.conversations?.length || 0,
      projects: relatedData.projects?.length || 0,
      participants: relatedData.people?.length || 0,
      resources: relatedData.resources?.length || 0,
      documents: relatedData.resources?.filter((r: any) => r.type === 'document')?.length || 0,
      webpages: relatedData.webpages?.length || 0,
      topics: relatedData.topics?.length || 0,
      jiraTickets: relatedData.jiraTickets?.length || 0,
      relationships: relatedData.cooccurringEntities?.length || 0
    };
  }

  /**
   * 🆕 从ChromaDB metadata反序列化实体
   */
  private deserializeEntityFromMetadata(metadata: any): MemoryEntity {
    try {
      return {
        id: metadata.id || '',
        type: metadata.type || 'Document',
        name: metadata.name || '',
        description: metadata.description || '',
        properties: metadata.properties ? JSON.parse(metadata.properties) : {},
        created: metadata.created || Date.now(),
        updated: metadata.updated || Date.now(),
        accessCount: metadata.accessCount || 0,
        lastAccessed: metadata.lastAccessed || Date.now(),
        importance: metadata.importance || 0.5,
        tags: metadata.tags ? JSON.parse(metadata.tags) : [],
        status: metadata.status || 'active',
        statistic: metadata.statistic ? JSON.parse(metadata.statistic) : {
          conversations: 0, projects: 0, participants: 0, resources: 0,
          documents: 0, webpages: 0, relationships: 0, topics: 0, jiraTickets: 0
        },
        relatedData: metadata.relatedData ? JSON.parse(metadata.relatedData) : {
          conversations: [],
          webpages: [],
          resources: [],
          projects: [],
          people: [],
          topics: [],
          jiraTickets: [],
          cooccurringEntities: []
        },
        hotness: metadata.hotness || 0,
        criticalityScore: metadata.criticalityScore || 0,
        lastDocumentUpdate: metadata.lastDocumentUpdate || Date.now(),
        // Person特有字段
        ...(metadata.type === 'Person' && {
          role: metadata.role,
          team: metadata.team,
          lastContact: metadata.lastContact,
          expertise: metadata.expertise ? JSON.parse(metadata.expertise) : []
        }),
        // Project特有字段
        ...(metadata.type === 'Project' && {
          isHighlighted: metadata.isHighlighted
        })
      };
    } catch (error) {
      console.error('反序列化实体失败:', error);
      // 返回基础实体结构
      return {
        id: metadata.id || '',
        type: metadata.type || 'Document',
        name: metadata.name || '',
        properties: {},
        created: Date.now(),
        updated: Date.now(),
        accessCount: 0,
        lastAccessed: Date.now(),
        importance: 0.5,
        statistic: {
          conversations: 0, projects: 0, participants: 0, resources: 0,
          documents: 0, webpages: 0, relationships: 0, topics: 0, jiraTickets: 0
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
        }
      };
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

  /**
   * 🆕 生成自然语言描述 - 用于向量搜索的丰富上下文
   */
  private async generateNaturalLanguageDescription(entity: MemoryEntity): Promise<string> {
    const parts: string[] = [];
    
    // 基础信息
    parts.push(`${entity.name}是一个${entity.type}实体。`);
    if (entity.description) {
      parts.push(entity.description);
    }
    
    // 类型特定信息
    switch (entity.type) {
      case 'Person':
        if (entity.role) parts.push(`担任${entity.role}角色。`);
        if (entity.team) parts.push(`属于${entity.team}团队。`);
        if (entity.expertise && entity.expertise.length > 0) {
          parts.push(`专业领域包括：${entity.expertise.join('、')}。`);
        }
        break;
      case 'Project':
        if (entity.properties?.status) parts.push(`项目状态：${entity.properties.status}。`);
        break;
      case 'Topic':
        if (entity.properties?.category) parts.push(`话题分类：${entity.properties.category}。`);
        break;
    }
    
    // 🆕 关联数据的自然语言描述
    const { relatedData } = entity;
    
    // 最近的对话情况
    if (relatedData?.conversations && relatedData.conversations.length > 0) {
      const recentConversations = relatedData.conversations.slice(0, 5); // 取最近5条
      parts.push(`最近的相关讨论包括：`);
      recentConversations.forEach(conv => {
        parts.push(`- ${conv.sender}在${conv.group}中提到：${conv.summary}`);
      });
    }
    
    // 关联的项目
    if (relatedData?.projects && relatedData.projects.length > 0) {
      const topProjects = relatedData.projects.slice(0, 3);
      parts.push(`与以下项目相关：${topProjects.map(p => `${p.name}(${p.status})`).join('、')}。`);
    }
    
    // 关联的人员
    if (relatedData?.people && relatedData.people.length > 0) {
      const topPeople = relatedData.people.slice(0, 5);
      parts.push(`经常与这些人员合作：${topPeople.map(p => `${p.name}(${p.role})`).join('、')}。`);
    }
    
    // 关联的话题
    if (relatedData?.topics && relatedData.topics.length > 0) {
      const topTopics = relatedData.topics.slice(0, 3);
      parts.push(`相关讨论话题：${topTopics.map(t => t.name).join('、')}。`);
    }
    
    // JIRA工作项
    if (relatedData?.jiraTickets && relatedData.jiraTickets.length > 0) {
      const activeTickets = relatedData.jiraTickets.filter(t => t.status !== 'Done').slice(0, 3);
      if (activeTickets.length > 0) {
        parts.push(`相关的工作项：${activeTickets.map(t => `${t.key}: ${t.summary}`).join('；')}。`);
      }
    }
    
    // 网页资源
    if (relatedData?.webpages && relatedData.webpages.length > 0) {
      const recentPages = relatedData.webpages.slice(0, 3);
      parts.push(`相关网页资源：${recentPages.map(w => w.title).join('、')}。`);
    }
    
    // 其他相关实体
    if (relatedData?.cooccurringEntities && relatedData.cooccurringEntities.length > 0) {
      const topEntities = relatedData.cooccurringEntities.slice(0, 5);
      parts.push(`经常与这些概念一起出现：${topEntities.map(e => e.name).join('、')}。`);
    }
    
    // 统计信息
    const stats = entity.statistic;
    if (stats) {
      const activeParts = [];
      if (stats.conversations > 0) activeParts.push(`${stats.conversations}次对话`);
      if (stats.projects > 0) activeParts.push(`${stats.projects}个项目`);
      if (stats.participants > 0) activeParts.push(`${stats.participants}位参与者`);
      if (stats.jiraTickets > 0) activeParts.push(`${stats.jiraTickets}个工作项`);
      
      if (activeParts.length > 0) {
        parts.push(`总体活跃度：${activeParts.join('、')}。`);
      }
    }
    
    // 重要性和标签
    if (entity.importance > 0.7) {
      parts.push(`这是一个高优先级项目。`);
    }
    if (entity.tags && entity.tags.length > 0) {
      parts.push(`标签：${entity.tags.join('、')}。`);
    }
    
    return parts.join(' ');
  }

  /**
   * 🆕 转换实体元数据为ChromaDB兼容格式
   */
  private convertEntityMetadataForChroma(entity: MemoryEntity): Record<string, string | number | boolean | null> {
    const metadata: Record<string, string | number | boolean | null> = {
      // 基础字段
      type: entity.type,
      name: entity.name,
      created: entity.created,
      updated: entity.updated,
      description: entity.description || '',
      importance: entity.importance || 0.5,
      accessCount: entity.accessCount || 0,
      lastAccessed: entity.lastAccessed || Date.now(),
      status: entity.status || 'active',
      
      // 🆕 热度和重要性评分
      hotness: entity.hotness || 0,
      criticalityScore: entity.criticalityScore || 0,
      lastDocumentUpdate: entity.lastDocumentUpdate || Date.now(),
      
      // 序列化复杂字段
      properties: JSON.stringify(entity.properties || {}),
      tags: JSON.stringify(entity.tags || []),
      statistic: JSON.stringify(entity.statistic),
      relatedData: JSON.stringify(entity.relatedData || {}),
      
      // Person特有字段
      ...(entity.type === 'Person' && {
        role: entity.role || '',
        team: entity.team || '',
        lastContact: entity.lastContact || 0,
        expertise: JSON.stringify(entity.expertise || [])
      }),
      
      // Project特有字段
      ...(entity.type === 'Project' && {
        isHighlighted: entity.isHighlighted || false
      })
    };
    
    return metadata;
  }

  /**
   * 🆕 计算实体热度评分 (0-1)
   */
  static calculateEntityHotness(entity: MemoryEntity): number {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    
    // 1. 最近活动频率（权重40%）
    let recentActivityScore = 0;
    const recentConversations = entity.relatedData?.conversations?.filter(c => 
      (now - new Date(c.datetime).getTime()) < 7 * dayMs
    ).length || 0;
    recentActivityScore = Math.min(recentConversations / 10, 1); // 7天内10条消息=满分
    
    // 2. 访问频率（权重30%）
    const daysSinceCreated = Math.max(1, (now - entity.created) / dayMs);
    const accessFrequency = (entity.accessCount || 0) / daysSinceCreated;
    const accessScore = Math.min(accessFrequency * 5, 1); // 每天5次访问=满分
    
    // 3. 关联数据丰富度（权重20%）
    const totalRelations = (entity.relatedData?.conversations?.length || 0) +
                          (entity.relatedData?.projects?.length || 0) * 2 +
                          (entity.relatedData?.people?.length || 0) +
                          (entity.relatedData?.jiraTickets?.length || 0);
    const richnessScore = Math.min(totalRelations / 30, 1); // 30个关联=满分
    
    // 4. 最近更新（权重10%）
    const daysSinceUpdate = (now - entity.updated) / dayMs;
    const freshnessScore = Math.max(0, 1 - daysSinceUpdate / 7); // 7天内=满分
    
    return recentActivityScore * 0.4 + accessScore * 0.3 + richnessScore * 0.2 + freshnessScore * 0.1;
  }

  /**
   * 🆕 计算实体关键性评分 (0-1)
   */
  static calculateEntityCriticality(entity: MemoryEntity, userImportanceBoost = 0): number {
    // 1. 基础重要性（权重50%）
    const baseImportance = entity.importance || 0.5;
    
    // 2. 用户明确标记（权重30%）
    const userBoostScore = Math.min(userImportanceBoost, 1);
    
    // 3. 关联项目重要性（权重15%）
    let projectImportanceScore = 0;
    if (entity.relatedData?.projects && entity.relatedData.projects.length > 0) {
      const activeProjects = entity.relatedData.projects.filter(p => p.status !== 'Completed');
      projectImportanceScore = Math.min(activeProjects.length / 3, 1); // 3个活跃项目=满分
    }
    
    // 4. 关联人员重要性（权重5%）
    const peopleImportanceScore = Math.min((entity.relatedData?.people?.length || 0) / 10, 1);
    
    return baseImportance * 0.5 + userBoostScore * 0.3 + projectImportanceScore * 0.15 + peopleImportanceScore * 0.05;
  }

  /**
   * 🆕 更新实体热度和关键性评分
   */
  static updateEntityScores(entity: MemoryEntity, userImportanceBoost = 0): MemoryEntity {
    const updatedEntity = { ...entity };
    updatedEntity.hotness = this.calculateEntityHotness(entity);
    updatedEntity.criticalityScore = this.calculateEntityCriticality(entity, userImportanceBoost);
    return updatedEntity;
  }

  /**
   * 🆕 从消息元数据构建实体关联数据
   */
  static buildEntityRelatedDataFromMessage(
    entityId: string,
    entityType: string,
    messageMetadata: any,
    extractedEntities: any[],
    messageId: string
  ): MemoryEntity['relatedData'] {
    const relatedData: MemoryEntity['relatedData'] = {
      conversations: [],
      webpages: [],
      resources: [],
      projects: [],
      people: [],
      topics: [],
      jiraTickets: [],
      cooccurringEntities: []
    };

    // 1. 添加当前消息
    if (messageMetadata) {
      relatedData.conversations.push({
        id: messageId,
        summary: messageMetadata.summary || messageMetadata.content?.substring(0, 100) + '...',
        sender: messageMetadata.source || 'unknown',
        group: messageMetadata.teamName || '未知群组',
        datetime: messageMetadata.datetime || new Date().toISOString(),
        relevanceScore: 0.9, // 来源消息相关性最高
        context: messageMetadata.contextMessages || []
      });
    }

    // 2. 添加同消息中的其他实体作为共现实体
    extractedEntities.forEach(otherEntity => {
      if (otherEntity.id !== entityId) {
        relatedData.cooccurringEntities.push({
          id: otherEntity.id,
          name: otherEntity.name,
          type: otherEntity.type,
          relevanceScore: 0.8 // 同消息共现的相关性较高
        });

        // 根据类型添加到对应的关联数据中
        switch (otherEntity.type) {
          case 'Person':
            relatedData.people.push({
              id: otherEntity.id,
              name: otherEntity.name,
              role: otherEntity.properties?.role || '',
              team: otherEntity.properties?.team || '',
              expertise: otherEntity.properties?.expertise || [],
              lastContact: Date.now(),
              relevanceScore: 0.8
            });
            break;
          case 'Project':
            relatedData.projects.push({
              id: otherEntity.id,
              name: otherEntity.name,
              description: otherEntity.description || '',
              status: otherEntity.properties?.status || 'Active',
              relevanceScore: 0.8
            });
            break;
          case 'Topic':
            relatedData.topics.push({
              id: otherEntity.id,
              name: otherEntity.name,
              summary: otherEntity.description || `关于${otherEntity.name}的讨论`,
              category: otherEntity.properties?.category || '技术讨论',
              relevanceScore: 0.8
            });
            break;
          case 'Task':
            // 假设Task类型是JIRA ticket
            relatedData.jiraTickets.push({
              id: otherEntity.id,
              key: otherEntity.properties?.key || otherEntity.name,
              summary: otherEntity.description || otherEntity.name,
              status: otherEntity.properties?.status || 'In Progress',
              assignee: otherEntity.properties?.assignee || '',
              priority: otherEntity.properties?.priority || 'Medium',
              relevanceScore: 0.8
            });
            break;
          case 'Document':
            relatedData.resources.push({
              id: otherEntity.id,
              summary: otherEntity.description || `文档：${otherEntity.name}`,
              name: otherEntity.name,
              type: 'document',
              url: otherEntity.properties?.url,
              relevanceScore: 0.7
            });
            break;
        }
      }
    });

    return relatedData;
  }

  /**
   * 🆕 从消息元数据提取实体信息
   */
  private static extractEntitiesFromMetadata(metadata: any, messageId?: string): Array<Omit<MemoryEntity, 'id' | 'created' | 'updated'>> {
    const entities: Array<Omit<MemoryEntity, 'id' | 'created' | 'updated'>> = [];
    
    if (metadata.entities) {
      // 提取人员实体
      if (metadata.entities.people) {
        for (const person of metadata.entities.people) {
          entities.push({
            type: 'Person',
            name: person.name,
            description: `人员: ${person.name}`,
            properties: {
              role: person.role,
              mentioned_context: person.mentioned_context,
              source: 'message_analysis',
              teamName: metadata.teamName || '',
              messageId: messageId,
              timestamp: metadata.timestamp || Date.now()
            },
            importance: 0.7,
            accessCount: 1,
            lastAccessed: Date.now(),
            tags: [],
            statistic: {
              conversations: 0, projects: 0, participants: 0, resources: 0,
              documents: 0, webpages: 0, relationships: 0, topics: 0, jiraTickets: 0
            },
            relatedData: {
              conversations: [], webpages: [], resources: [], projects: [], people: [],
              topics: [], jiraTickets: [], cooccurringEntities: []
            }
          });
        }
      }
      
      // 提取项目实体
      if (metadata.entities.projects) {
        for (const project of metadata.entities.projects) {
          entities.push({
            type: 'Project',
            name: project.name,
            description: `项目: ${project.name}`,
            properties: {
              status: project.status,
              related_people: project.related_people,
              source: 'message_analysis',
              teamName: metadata.teamName || '',
              messageId: messageId,
              timestamp: metadata.timestamp || Date.now()
            },
            importance: 0.8,
            accessCount: 1,
            lastAccessed: Date.now(),
            tags: [],
            statistic: {
              conversations: 0, projects: 0, participants: 0, resources: 0,
              documents: 0, webpages: 0, relationships: 0, topics: 0, jiraTickets: 0
            },
            relatedData: {
              conversations: [], webpages: [], resources: [], projects: [], people: [],
              topics: [], jiraTickets: [], cooccurringEntities: []
            }
          });
        }
      }
      
      // 提取话题实体
      if (metadata.entities.topics) {
        for (const topic of metadata.entities.topics) {
          entities.push({
            type: 'Topic',
            name: topic.name,
            description: `话题: ${topic.name}`,
            properties: {
              category: topic.category,
              keywords: topic.keywords,
              source: 'message_analysis',
              teamName: metadata.teamName || '',
              messageId: messageId,
              timestamp: metadata.timestamp || Date.now()
            },
            importance: 0.5,
            accessCount: 1,
            lastAccessed: Date.now(),
            tags: [],
            statistic: {
              conversations: 0, projects: 0, participants: 0, resources: 0,
              documents: 0, webpages: 0, relationships: 0, topics: 0, jiraTickets: 0
            },
            relatedData: {
              conversations: [], webpages: [], resources: [], projects: [], people: [],
              topics: [], jiraTickets: [], cooccurringEntities: []
            }
          });
        }
      }
      
      // 提取文档/资源实体
      if (metadata.entities.documents || metadata.entities.resources) {
        const documentsList = [...(metadata.entities.documents || []), ...(metadata.entities.resources || [])];
        for (const doc of documentsList) {
          entities.push({
            type: 'Document',
            name: doc.name || doc.title,
            description: `文档: ${doc.name || doc.title}`,
            properties: {
              url: doc.url,
              type: doc.type || 'document',
              description: doc.description,
              source: 'message_analysis',
              teamName: metadata.teamName || '',
              messageId: messageId,
              timestamp: metadata.timestamp || Date.now()
            },
            importance: 0.6,
            accessCount: 1,
            lastAccessed: Date.now(),
            tags: [],
            statistic: {
              conversations: 0, projects: 0, participants: 0, resources: 0,
              documents: 0, webpages: 0, relationships: 0, topics: 0, jiraTickets: 0
            },
            relatedData: {
              conversations: [], webpages: [], resources: [], projects: [], people: [],
              topics: [], jiraTickets: [], cooccurringEntities: []
            }
          });
        }
      }

      // 提取技术实体
      if (metadata.entities.technologies || metadata.entities.tools) {
        const techList = [...(metadata.entities.technologies || []), ...(metadata.entities.tools || [])];
        for (const tech of techList) {
          entities.push({
            type: 'Technology',
            name: tech.name,
            description: `技术: ${tech.name}`,
            properties: {
              category: tech.category,
              version: tech.version,
              usage_context: tech.usage_context,
              source: 'message_analysis',
              teamName: metadata.teamName || '',
              type: 'technology',
              messageId: messageId,
              timestamp: metadata.timestamp || Date.now()
            },
            importance: 0.6,
            accessCount: 1,
            lastAccessed: Date.now(),
            tags: [],
            statistic: {
              conversations: 0, projects: 0, participants: 0, resources: 0,
              documents: 0, webpages: 0, relationships: 0, topics: 0, jiraTickets: 0
            },
            relatedData: {
              conversations: [], webpages: [], resources: [], projects: [], people: [],
              topics: [], jiraTickets: [], cooccurringEntities: []
            }
          });
        }
      }
      
      // 提取组织实体
      if (metadata.teamName && metadata.teamName !== 'SM AI') {
        entities.push({
          type: 'Organization',
          name: metadata.teamName,
          description: `组织: ${metadata.teamName}`,
          properties: {
            teamId: metadata.teamId,
            source: 'message_analysis',
            type: 'team',
            messageId: messageId,
            timestamp: metadata.timestamp || Date.now()
          },
          importance: 0.6,
          accessCount: 1,
          lastAccessed: Date.now(),
          tags: [],
          statistic: {
            conversations: 0, projects: 0, participants: 0, resources: 0,
            documents: 0, webpages: 0, relationships: 0, topics: 0, jiraTickets: 0
          },
          relatedData: {
            conversations: [], webpages: [], resources: [], projects: [], people: [],
            topics: [], jiraTickets: [], cooccurringEntities: []
          }
        });
      }
    }
    
    return entities;
  }

  /**
   * 🆕 更新实体关联数据 - 从消息分析中提取实体并更新其关联信息
   */
  async updateEntitiesWithRelatedData(
    messageMetadata: any,
    messageId: string,
    memorySystemInstance: any // 避免循环依赖，通过参数传入
  ): Promise<void> {
    console.log(`🔗 开始从消息 ${messageId} 更新实体关联数据...`);
    
    try {
      // 1. 从消息元数据提取实体
      const extractedEntities = CloudStorage.extractEntitiesFromMetadata(messageMetadata, messageId);
      
      if (extractedEntities.length === 0) {
        console.log('📭 消息中未发现实体，跳过关联数据更新');
        return;
      }

      console.log(`📝 从消息中提取到 ${extractedEntities.length} 个实体: ${extractedEntities.map(e => `${e.name}(${e.type})`).join(', ')}`);
      
      // 2. 为每个实体构建和更新关联数据
      for (const entity of extractedEntities) {
        try {
          // 生成实体ID
          const entityId = `${entity.type.toLowerCase()}_${entity.name.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`;
          
          // 为当前实体构建关联数据
          const relatedDataForEntity = CloudStorage.buildEntityRelatedDataFromMessage(
            entityId,
            entity.type,
            messageMetadata,
            extractedEntities,
            messageId
          );

          // 计算实体热度和重要性
          const entityWithRelatedData: MemoryEntity = {
            ...entity,
            id: entityId, // 确保有ID
            created: Date.now(), // 确保有created属性
            updated: Date.now(),
            relatedData: relatedDataForEntity
          };
          
          // 更新热度和关键性评分
          const scoredEntity = CloudStorage.updateEntityScores(entityWithRelatedData);
          
          // 检查实体是否已存在
          let existingEntity;
          try {
            existingEntity = await memorySystemInstance.getEntityDetails(entityId);
          } catch (error) {
            // 实体不存在，这是新实体
            console.log(`📝 创建新实体: ${entity.name} (${entity.type})`);
            existingEntity = null;
          }
          
          if (existingEntity) {
            // 更新现有实体的关联数据
            const updateData: Partial<MemoryEntity> = {
              relatedData: relatedDataForEntity,
              hotness: scoredEntity.hotness,
              criticalityScore: scoredEntity.criticalityScore,
              lastAccessed: Date.now(),
              accessCount: (existingEntity.accessCount || 0) + 1
            };
            
            const updateResult = await memorySystemInstance.updateEntity(entityId, updateData);
            console.log(`🔄 实体关联数据更新: ${entity.name}, 成功: ${updateResult.success ? '✅' : '❌'}`);
            
          } else {
            // 存储新实体（包含完整关联数据）
            const newEntity = {
              ...scoredEntity,
              created: Date.now(),
              updated: Date.now(),
              accessCount: 1,
              lastAccessed: Date.now(),
              statistic: {
                conversations: relatedDataForEntity.conversations?.length || 0,
                projects: relatedDataForEntity.projects?.length || 0,
                participants: relatedDataForEntity.people?.length || 0,
                resources: relatedDataForEntity.resources?.length || 0,
                documents: relatedDataForEntity.resources?.filter((r: any) => r.type === 'document')?.length || 0,
                webpages: relatedDataForEntity.webpages?.length || 0,
                topics: relatedDataForEntity.topics?.length || 0,
                jiraTickets: relatedDataForEntity.jiraTickets?.length || 0,
                relationships: relatedDataForEntity.cooccurringEntities?.length || 0
              }
            };
            
            const storeResult = await memorySystemInstance.storeEntity(newEntity);
            console.log(`🆕 新实体存储: ${entity.name}, 成功: ${storeResult.success ? '✅' : '❌'}`);
          }
          
        } catch (entityError) {
          console.error(`❌ 更新实体 ${entity.name} 关联数据失败:`, entityError);
        }
      }
      
      console.log(`✅ 所有实体关联数据更新完成`);
      
    } catch (error) {
      console.error('🚨 更新实体关联数据过程中发生错误:', error);
    }
  }

  private ensureInitialized(): void {
    if (!this.isInitialized || !this.client) {
      throw new Error('云端存储未初始化');
    }
  }
}
