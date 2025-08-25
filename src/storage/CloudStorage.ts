/**
 * 云端存储管理器
 * 专门管理 ChromaDB 操作，包括向量搜索和完整数据存储
 */

import { ChromaClient, Collection } from 'chromadb';
import { getEmbeddingViaOffscreen } from '../embeddings';
import { getEnvConfig } from '../utils';
import { MemoryEntity, QueryResult, VectorSearchOptions } from '../memory';
import { GraphEntity } from './HybridGraphStore';
import { UserProfile } from '../types/userProfile';

export interface CloudStorageConfig {
  chromaUrl: string;
  collections: string[];
  batchSize: number;
  timeout: number;
}

/**
 * 云端存储管理器
 */
export class CloudStorage {
  private client: ChromaClient | null = null;
  private collections: Map<string, Collection> = new Map();
  private config: CloudStorageConfig;
  private username: string = '';
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
      const userInfo = await this.getUserInfo();
      this.username = userInfo.username;

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
   * 向量搜索
   */
  async searchByVector(
    query: string,
    type?: string,
    options: VectorSearchOptions = {}
  ): Promise<QueryResult<MemoryEntity>> {
    this.ensureInitialized();
    
    const startTime = Date.now();
    const { limit = 20, threshold = 0.7, nResults = 10 } = options;

    try {
      // 生成查询向量
      const queryEmbedding = await getEmbeddingViaOffscreen(query);
      
      // 确定搜索的集合
      const collectionsToSearch = type ? [`${this.username}-graph-entities`] : [
        `${this.username}-graph-entities`,
        `${this.username}-messages`,
        `${this.username}-webpages`
      ];

      const allResults: MemoryEntity[] = [];

      // 在多个集合中搜索
      for (const collectionName of collectionsToSearch) {
        const collection = this.collections.get(collectionName);
        if (!collection) continue;

        try {
          const searchResults = await collection.query({
            queryEmbeddings: [queryEmbedding],
            nResults,
            include: ['metadatas', 'documents', 'distances']
          });

          // 处理搜索结果
          if (searchResults.metadatas?.[0]) {
            for (let i = 0; i < searchResults.metadatas[0].length; i++) {
              const metadata = searchResults.metadatas[0][i];
              const distance = searchResults.distances?.[0]?.[i] || 1;
              
              // 过滤低相关性结果
              if (distance > (1 - threshold)) continue;
              
              // 根据集合类型构建实体
              const entity = await this.buildEntityFromMetadata(metadata, collectionName);
              if (entity && (!type || entity.type === type)) {
                allResults.push(entity);
              }
            }
          }
        } catch (error) {
          console.warn(`搜索集合 ${collectionName} 失败:`, error);
        }
      }

      // 排序和分页
      const sortedResults = allResults
        .sort((a, b) => b.importance - a.importance)
        .slice(0, limit);

      return {
        data: sortedResults,
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
   * 存储实体到云端
   */
  async storeEntity(entity: GraphEntity): Promise<boolean> {
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

      await collection.add({
        ids: [messageData.id],
        documents: [messageData.content],
        embeddings: [embedding],
        metadatas: [messageData.metadata]
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
  async updateEntity(entityId: string, updates: Partial<GraphEntity>): Promise<boolean> {
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
      const currentMetadata = existing.metadatas[0][0];
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
      const description = `${updates.name || currentMetadata.name} ${updates.description || currentMetadata.description || ''} ${JSON.stringify(updates.properties || JSON.parse(currentMetadata.properties || '{}'))}`;
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
   * 新设备同步检测
   */
  async detectNewDevice(): Promise<boolean> {
    this.ensureInitialized();

    try {
      // 检查本地是否有同步历史
      const result = await chrome.storage.local.get('cloud_last_sync_time');
      const lastSyncTime = result.cloud_last_sync_time || 0;
      
      // 如果从未同步过，检查云端是否有数据
      if (lastSyncTime === 0) {
        const entityCount = await this.getEntityCount();
        return entityCount > 0; // 云端有数据但本地没有同步记录 = 新设备
      }
      
      return false;
    } catch (error) {
      console.error('新设备检测失败:', error);
      return false;
    }
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
        
        const entity = await this.buildEntityFromMetadata(metadata, 'graph-entities');
        return entity;
      }

      return null;
    } catch (error) {
      console.error(`获取实体 ${entityId} 失败:`, error);
      return null;
    }
  }

  /**
   * 获取所有云端实体（用于新设备初始同步）
   */
  async getAllEntities(): Promise<MemoryEntity[]> {
    this.ensureInitialized();

    try {
      const collection = this.collections.get(`${this.username}-graph-entities`);
      if (!collection) return [];

      const result = await collection.get({
        include: ['metadatas', 'documents']
      });

      const entities: MemoryEntity[] = [];
      if (result.ids && result.metadatas) {
        for (let i = 0; i < result.ids.length; i++) {
          const metadata = result.metadatas[i] as any;
          
          // 跳过备份数据
          if (metadata.type === 'graph_backup') continue;
          
          const entity = await this.buildEntityFromMetadata(metadata, 'graph-entities');
          if (entity) {
            entities.push(entity);
          }
        }
      }

      console.log(`📥 从云端获取了 ${entities.length} 个实体`);
      return entities;
    } catch (error) {
      console.error('获取所有实体失败:', error);
      return [];
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
      
      if (!collections.includes(messagesCollectionName)) {
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

    for (const collectionType of this.config.collections) {
      const collectionName = `${this.username}-${collectionType}`;
      
      try {
        const collection = await this.client.getOrCreateCollection({ 
          name: collectionName 
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
      const result = await chrome.storage.local.get(['userInfo']);
      return result.userInfo || { username: 'default-user' };
    } catch (error) {
      console.warn('获取用户信息失败，使用默认值');
      return { username: 'default-user' };
    }
  }

  private async buildEntityFromMetadata(metadata: any, collectionName: string): Promise<MemoryEntity | null> {
    try {
      if (collectionName.includes('graph-entities')) {
        return {
          id: metadata.id || `entity_${Date.now()}`,
          type: metadata.type || 'Document',
          name: metadata.name || '未知实体',
          description: metadata.description,
          properties: JSON.parse(metadata.properties || '{}'),
          created: metadata.created || Date.now(),
          updated: metadata.updated || Date.now(),
          accessCount: metadata.accessCount || 0,
          lastAccessed: metadata.lastAccessed || Date.now(),
          importance: metadata.importance || 0.5,
          tags: JSON.parse(metadata.tags || '[]'),
          status: metadata.status || 'active'
        };
      }

      // 从其他集合构建虚拟实体
      return {
        id: `virtual_${Date.now()}_${Math.random()}`,
        type: 'Document',
        name: metadata.title || metadata.summary || '相关内容',
        description: metadata.summary || '相关内容',
        properties: metadata,
        created: metadata.timestamp || metadata.extractedAt || Date.now(),
        updated: metadata.timestamp || metadata.extractedAt || Date.now(),
        accessCount: 1,
        lastAccessed: Date.now(),
        importance: 0.3,
        tags: metadata.tags || [],
        status: 'active'
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
          metadata: { type: 'user_profiles' }
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

  private ensureInitialized(): void {
    if (!this.isInitialized || !this.client) {
      throw new Error('云端存储未初始化');
    }
  }
}
