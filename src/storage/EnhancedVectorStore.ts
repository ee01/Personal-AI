/**
 * 增强向量存储管理器
 * 支持多Collection和不同数据类型的向量化存储
 */

import { ChromaClient, Collection } from 'chromadb';
import { getEmbeddingViaOffscreen } from '../embeddings';
import { getEnvConfig } from '../utils';

export interface VectorStoreConfig {
  enableChroma: boolean;
  chromaApiUrl: string;
  username: string;
}

export interface StorageMetrics {
  totalCollections: number;
  totalDocuments: number;
  storageUsed: number; // bytes
  lastCleanup: number;
  collections: {
    [key: string]: {
      documentCount: number;
      lastAccessed: number;
      avgConfidence: number;
    }
  };
}

/**
 * 增强向量存储管理器
 */
export class EnhancedVectorStore {
  private chromaClient: ChromaClient | null = null;
  private collections: Map<string, Collection> = new Map();
  private config: VectorStoreConfig | null = null;

  // Collection类型定义
  private readonly COLLECTION_TYPES = {
    MESSAGES: 'messages',           // 聊天消息
    WEBPAGES: 'webpages',          // 网页内容
    PROJECTS: 'projects',          // 项目文档
    DOCUMENTS: 'documents',        // 技术文档
    MEMORIES: 'memories',          // 综合记忆
    KNOWLEDGE: 'knowledge'         // 知识条目
  };

  /**
   * 初始化增强向量存储
   */
  async initialize(): Promise<boolean> {
    try {
      const envConfig = await getEnvConfig();
      if (!envConfig.ENABLE_CHROMA) {
        console.log('ChromaDB已禁用');
        return false;
      }

      // 获取用户信息
      const username = await this.getUsernameFromStorage();
      
      this.config = {
        enableChroma: envConfig.ENABLE_CHROMA,
        chromaApiUrl: envConfig.CHROMA_API_URL || 'http://localhost:8000',
        username
      };

      // 初始化ChromaDB客户端
      this.chromaClient = new ChromaClient({
        path: this.config.chromaApiUrl
      });

      // 初始化所有collection
      await this.initializeCollections();

      console.log('✅ 增强向量存储初始化完成');
      return true;

    } catch (error) {
      console.error('❌ 增强向量存储初始化失败:', error);
      return false;
    }
  }

  /**
   * 初始化所有collection
   */
  private async initializeCollections(): Promise<void> {
    const embeddingFunction = {
      generate: async (texts: string[]) => {
        return new Array(texts.length).fill(new Array(384).fill(0));
      }
    };

    const username = this.config!.username;
    
    // 定义collection配置
    const collectionConfigs = [
      {
        type: this.COLLECTION_TYPES.MESSAGES,
        name: `${username}-messages`,
        description: '存储聊天消息和对话内容',
        metadata: { dataType: 'message', version: '2.0' }
      },
      {
        type: this.COLLECTION_TYPES.WEBPAGES,
        name: `${username}-webpages`,
        description: '存储网页分析结果和内容',
        metadata: { dataType: 'webpage', version: '2.0' }
      },
      {
        type: this.COLLECTION_TYPES.PROJECTS,
        name: `${username}-projects`,
        description: '存储项目相关文档和分析结果',
        metadata: { dataType: 'project', version: '2.0' }
      },
      {
        type: this.COLLECTION_TYPES.DOCUMENTS,
        name: `${username}-documents`,
        description: '存储技术文档和知识文档',
        metadata: { dataType: 'document', version: '2.0' }
      },
      {
        type: this.COLLECTION_TYPES.MEMORIES,
        name: `${username}-memories`,
        description: '存储综合记忆和知识条目',
        metadata: { dataType: 'memory', version: '2.0' }
      }
    ];

    // 获取现有collection列表
    const existingCollections = await this.chromaClient!.listCollections();

    // 创建或获取collection
    for (const config of collectionConfigs) {
      try {
        let collection: Collection;
        
        if (existingCollections.includes(config.name)) {
          collection = await this.chromaClient!.getCollection({
            name: config.name,
            embeddingFunction
          });
          console.log(`📂 获取已存在的collection: ${config.name}`);
        } else {
          collection = await this.chromaClient!.createCollection({
            name: config.name,
            metadata: { 
              description: config.description,
              ...config.metadata
            },
            embeddingFunction
          });
          console.log(`🆕 创建新collection: ${config.name}`);
        }

        this.collections.set(config.type, collection);

      } catch (error) {
        console.error(`❌ 初始化collection ${config.name} 失败:`, error);
      }
    }
  }

  /**
   * 存储消息数据
   */
  async storeMessage(
    messageId: string,
    content: string,
    metadata: any
  ): Promise<boolean> {
    return await this.storeDocument(
      this.COLLECTION_TYPES.MESSAGES,
      messageId,
      content,
      metadata
    );
  }

  /**
   * 存储网页分析结果
   */
  async storeWebpage(
    webpageId: string,
    content: string,
    analysisResult: any
  ): Promise<boolean> {
    const enhancedMetadata = {
      ...analysisResult,
      contentType: 'webpage',
      url: analysisResult.pageInfo?.url,
      domain: analysisResult.pageInfo?.domain,
      extractedAt: analysisResult.pageInfo?.extractedAt || Date.now(),
      
      // 标准化实体数据
      entities: JSON.stringify(analysisResult.extractedEntities || {}),
      projects: JSON.stringify(analysisResult.extractedEntities?.projects || []),
      people: JSON.stringify(analysisResult.extractedEntities?.people || []),
      topics: JSON.stringify(analysisResult.extractedEntities?.topics || []),
      
      // 分析结果
      contentRelevance: analysisResult.contentRelevance || 0,
      shouldStore: analysisResult.shouldStore || false,
      shouldNotify: analysisResult.shouldNotify || false,
      contentCategory: analysisResult.contentCategory || 'general',
      
      // Chrome AI分析结果
      chromeAIAnalysis: analysisResult.chromeAIAnalysis ? 
        JSON.stringify(analysisResult.chromeAIAnalysis) : undefined
    };

    return await this.storeDocument(
      this.COLLECTION_TYPES.WEBPAGES,
      webpageId,
      content,
      enhancedMetadata
    );
  }

  /**
   * 存储项目分析结果
   */
  async storeProject(
    projectId: string,
    content: string,
    analysisResult: any
  ): Promise<boolean> {
    const enhancedMetadata = {
      ...analysisResult,
      contentType: 'project',
      projectId: analysisResult.projectId,
      projectName: analysisResult.projectName,
      riskLevel: analysisResult.riskLevel || 'normal',
      
      // 时间线数据
      timeline: JSON.stringify(analysisResult.timeline || {}),
      resourceAllocation: JSON.stringify(analysisResult.resourceAllocation || {}),
      suggestions: JSON.stringify(analysisResult.suggestions || {}),
      
      // JIRA集成数据
      jiraIssues: JSON.stringify(analysisResult.jiraIssues || {}),
      
      // 思考过程
      thoughtProcess: JSON.stringify(analysisResult.thoughtProcess || [])
    };

    return await this.storeDocument(
      this.COLLECTION_TYPES.PROJECTS,
      projectId,
      content,
      enhancedMetadata
    );
  }

  /**
   * 存储综合记忆数据
   */
  async storeMemory(
    memoryId: string,
    content: string,
    memoryMetadata: any
  ): Promise<boolean> {
    const enhancedMetadata = {
      ...memoryMetadata,
      contentType: 'memory',
      memoryType: memoryMetadata.type || 'general',
      importance: memoryMetadata.importance || 0.5,
      lastAccessed: memoryMetadata.lastAccessed || Date.now(),
      accessCount: memoryMetadata.accessCount || 0,
      
      // 记忆生命周期数据
      consolidationLevel: memoryMetadata.consolidationLevel || 'temporary',
      forgettingScore: memoryMetadata.forgettingScore || 0,
      userMarked: memoryMetadata.userMarked || false,
      protectedUntil: memoryMetadata.protectedUntil,
      
      // 关联数据
      relatedMemories: JSON.stringify(memoryMetadata.relatedMemories || []),
      tags: JSON.stringify(memoryMetadata.tags || [])
    };

    return await this.storeDocument(
      this.COLLECTION_TYPES.MEMORIES,
      memoryId,
      content,
      enhancedMetadata
    );
  }

  /**
   * 通用文档存储方法
   */
  private async storeDocument(
    collectionType: string,
    documentId: string,
    content: string,
    metadata: any
  ): Promise<boolean> {
    try {
      if (!this.config?.enableChroma) {
        console.log('ChromaDB已禁用，跳过存储');
        return false;
      }

      const collection = this.collections.get(collectionType);
      if (!collection) {
        console.error(`Collection ${collectionType} 未初始化`);
        return false;
      }

      // 生成嵌入向量
      const embedding = await getEmbeddingViaOffscreen(content);

      // 标准化元数据
      const standardizedMetadata = this.standardizeMetadata(metadata);

      // 存储到ChromaDB
      await collection.add({
        ids: [documentId],
        embeddings: [embedding],
        documents: [content],
        metadatas: [standardizedMetadata]
      });

      console.log(`✅ 文档已存储到 ${collectionType}: ${documentId}`);
      return true;

    } catch (error) {
      console.error(`❌ 存储文档到 ${collectionType} 失败:`, error);
      return false;
    }
  }

  /**
   * 语义搜索 - 跨collection
   */
  async semanticSearch(
    query: string,
    options: {
      collections?: string[];
      limit?: number;
      filters?: Record<string, any>;
      includeMetadata?: boolean;
    } = {}
  ): Promise<any> {
    try {
      const embedding = await getEmbeddingViaOffscreen(query);
      const results: any[] = [];

      // 确定搜索的collection列表
      const searchCollections = options.collections || 
        Array.from(this.collections.keys());

      // 在每个collection中搜索
      for (const collectionType of searchCollections) {
        const collection = this.collections.get(collectionType);
        if (!collection) continue;

        try {
          const queryParams: any = {
            queryEmbeddings: [embedding],
            nResults: options.limit || 10
          };

          if (options.filters) {
            queryParams.where = options.filters;
          }

          const result = await collection.query(queryParams);
          
          // 添加collection类型标识
          if (result.ids[0]) {
            for (let i = 0; i < result.ids[0].length; i++) {
              results.push({
                id: result.ids[0][i],
                document: result.documents[0][i],
                metadata: result.metadatas[0][i],
                distance: result.distances[0][i],
                collection: collectionType
              });
            }
          }

        } catch (error) {
          console.error(`搜索collection ${collectionType} 失败:`, error);
        }
      }

      // 按相似度排序并限制结果数量
      results.sort((a, b) => a.distance - b.distance);
      return results.slice(0, options.limit || 20);

    } catch (error) {
      console.error('语义搜索失败:', error);
      return [];
    }
  }

  /**
   * 获取存储统计信息
   */
  async getStorageMetrics(): Promise<StorageMetrics> {
    const metrics: StorageMetrics = {
      totalCollections: this.collections.size,
      totalDocuments: 0,
      storageUsed: 0,
      lastCleanup: 0,
      collections: {}
    };

    for (const [type, collection] of this.collections) {
      try {
        const data = await collection.get();
        const documentCount = data.ids?.length || 0;
        
        metrics.totalDocuments += documentCount;
        metrics.collections[type] = {
          documentCount,
          lastAccessed: Date.now(),
          avgConfidence: 0.8 // 需要实际计算
        };

      } catch (error) {
        console.error(`获取collection ${type} 统计失败:`, error);
      }
    }

    return metrics;
  }

  /**
   * 清理过期数据
   */
  async cleanupExpiredData(retentionDays: number = 90): Promise<number> {
    let cleanedCount = 0;
    const cutoffTime = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);

    for (const [type, collection] of this.collections) {
      try {
        // 这里需要根据实际需求实现清理逻辑
        // ChromaDB的删除操作需要具体的文档ID
        console.log(`清理collection ${type} 中的过期数据...`);
        
        // 示例：获取所有数据并筛选过期项
        const data = await collection.get();
        if (data.metadatas) {
          const expiredIds: string[] = [];
          
          data.metadatas.forEach((metadata: any, index: number) => {
            const timestamp = metadata.timestamp || metadata.extractedAt || metadata.created;
            if (timestamp && timestamp < cutoffTime) {
              expiredIds.push(data.ids[index]);
            }
          });

          if (expiredIds.length > 0) {
            await collection.delete({ ids: expiredIds });
            cleanedCount += expiredIds.length;
            console.log(`已从 ${type} 清理 ${expiredIds.length} 条过期数据`);
          }
        }

      } catch (error) {
        console.error(`清理collection ${type} 失败:`, error);
      }
    }

    return cleanedCount;
  }

  /**
   * 标准化元数据格式
   */
  private standardizeMetadata(metadata: any): Record<string, string | number | boolean> {
    const standardized: Record<string, string | number | boolean> = {};

    Object.keys(metadata).forEach(key => {
      const value = metadata[key];
      
      if (value === null || value === undefined) {
        return; // 跳过空值
      }

      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        standardized[key] = value;
      } else {
        // 复杂对象序列化为JSON字符串
        standardized[key] = JSON.stringify(value);
      }
    });

    return standardized;
  }

  /**
   * 获取用户名
   */
  private async getUsernameFromStorage(): Promise<string> {
    try {
      const { userinfo } = await chrome.storage.local.get('userinfo');
      return userinfo.username || 
             (userinfo.userEmail ? userinfo.userEmail.trim().split('@')[0] : 
              userinfo.fullName?.trim().split(' ').join('.').toLowerCase().replace(/[^a-z0-9_\-.]/g, '')) || 
             'default-user';
    } catch (error) {
      console.error('获取用户名失败:', error);
      return 'default-user';
    }
  }

  /**
   * 销毁向量存储
   */
  destroy(): void {
    this.collections.clear();
    this.chromaClient = null;
    this.config = null;
  }
}

export default EnhancedVectorStore;