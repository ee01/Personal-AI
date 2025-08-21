/**
 * 混合图存储管理器
 * 结合ChromaDB和Chrome Storage的优势
 * 解决数据持久化和设备同步问题
 */

import { ChromaClient, Collection } from 'chromadb';
import { getEmbeddingViaOffscreen } from '../embeddings';
import { getEnvConfig, EnvConfigType } from '../utils';

export interface GraphEntity {
  id: string;
  type: 'Person' | 'Project' | 'Task' | 'Organization' | 'Document' | 'Technology' | 'Topic';
  name: string;
  properties: Record<string, any>;
  description?: string;
  created: number;
  updated: number;
  
  // 扩展的统计信息字段
  accessCount?: number;         // 访问次数
  lastAccessed?: number;        // 最后访问时间
  importance?: number;          // 重要性评分 (0-1)
  tags?: string[];              // 标签列表
  status?: string;              // 状态 (active, inactive, archived, etc.)
  avatarUrl?: string;           // 头像URL（用于显示）
  
  // 关联统计（动态计算，不存储）
  relatedMessagesCount?: number;  // 相关消息数量
  relatedWebpagesCount?: number;  // 相关网页数量
  relationshipsCount?: number;    // 关系数量
}

export interface GraphRelationship {
  id: string;
  type: string;
  fromId: string;
  toId: string;
  properties: Record<string, any>;
  strength: number; // 0-1
  created: number;
  updated: number;
}

export interface GraphSyncStatus {
  lastSync: number;
  localEntities: number;
  cloudEntities: number;
  localRelationships: number;
  pendingSync: number;
  conflicts: number;
}

export interface EntityTypeInfo {
  type: string;
  name: string;
  icon: string;
  count: number;
  description?: string;
}

/**
 * 实体类型配置（中文映射）
 */
export const ENTITY_TYPE_CONFIG: Record<string, { name: string; icon: string; description: string }> = {
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
 * 混合图存储：实体存储在ChromaDB，关系索引存储在Chrome Storage
 */
export class HybridGraphStore {
  private chromaClient: ChromaClient | null = null;
  private entitiesCollection: Collection | null = null;
  
  // 本地关系索引 (Chrome Storage)
  private relationshipIndex: Map<string, GraphRelationship> = new Map();
  private entityToRelations: Map<string, Set<string>> = new Map(); // entityId -> relationshipIds
  private typeToEntities: Map<string, Set<string>> = new Map(); // entityType -> entityIds
  
  // 本地实体索引 (用于快速查找，从 ChromaDB 同步)
  private entityIndex: Map<string, GraphEntity> = new Map();
  
  // 同步状态
  private lastSyncTime = 0;
  private syncInProgress = false;

  /**
   * 初始化混合图存储
   */
  async initialize(): Promise<boolean> {
    try {
      console.log('🔄 初始化混合图存储...');
      
      // 1. 初始化ChromaDB (存储实体)
      const chromaInitialized = await this.initializeChromaDB();
      
      // 2. 加载本地关系索引和实体索引
      await this.loadLocalRelationships();
      await this.loadLocalEntities();
      
      // 3. 执行同步检查
      if (chromaInitialized) {
        await this.performSyncCheck();
      }
      
      console.log('✅ 混合图存储初始化完成');
      return true;
      
    } catch (error) {
      console.error('❌ 混合图存储初始化失败:', error);
      return false;
    }
  }

  /**
   * 初始化ChromaDB连接
   */
  private async initializeChromaDB(): Promise<boolean> {
    try {
      const envConfig = await getEnvConfig();
      if (!envConfig.ENABLE_CHROMA) {
        console.log('⚠️ ChromaDB已禁用，仅使用本地存储');
        return false;
      }

      this.chromaClient = new ChromaClient({
        path: envConfig.CHROMA_API_URL || 'http://localhost:8000'
      });

      const embeddingFunction = {
        generate: async (texts: string[]) => {
          return new Array(texts.length).fill(new Array(384).fill(0));
        }
      };

      const username = await this.getUsernameFromStorage();
      const collectionName = `${username}-graph-entities`;

      // 获取现有collections
      const collections = await this.chromaClient.listCollections();
      
      if (collections.includes(collectionName)) {
        this.entitiesCollection = await this.chromaClient.getCollection({
          name: collectionName,
          embeddingFunction
        });
        console.log(`📂 连接到已存在的实体collection: ${collectionName}`);
      } else {
        this.entitiesCollection = await this.chromaClient.createCollection({
          name: collectionName,
          metadata: { 
            description: '图实体数据存储',
            version: '2.0'
          },
          embeddingFunction
        });
        console.log(`🆕 创建新的实体collection: ${collectionName}`);
      }

      return true;

    } catch (error) {
      console.error('ChromaDB初始化失败，回退到纯本地模式:', error);
      return false;
    }
  }

  /**
   * 创建或更新实体
   */
  async upsertEntity(entity: Omit<GraphEntity, 'created' | 'updated'>): Promise<GraphEntity> {
    const now = Date.now();
    const fullEntity: GraphEntity = {
      ...entity,
      created: now,
      updated: now
    };

    try {
      // 1. 存储到ChromaDB (如果可用)
      if (this.entitiesCollection) {
        await this.storeEntityToChroma(fullEntity);
      }

      // 2. 更新本地实体索引
      this.entityIndex.set(entity.id, fullEntity);

      // 3. 更新本地类型索引
      if (!this.typeToEntities.has(entity.type)) {
        this.typeToEntities.set(entity.type, new Set());
      }
      this.typeToEntities.get(entity.type)!.add(entity.id);

      // 4. 保存本地索引
      await this.saveLocalIndexes();

      console.log(`📝 实体已保存: ${entity.type}(${entity.name})`);
      return fullEntity;

    } catch (error) {
      console.error('实体保存失败:', error);
      throw error;
    }
  }

  /**
   * 创建关系 (仅存储在本地)
   */
  async createRelationship(relationship: Omit<GraphRelationship, 'id' | 'created' | 'updated'>): Promise<GraphRelationship> {
    const now = Date.now();
    const id = `rel_${relationship.fromId}_${relationship.toId}_${relationship.type}_${now}`;
    
    const fullRelationship: GraphRelationship = {
      ...relationship,
      id,
      created: now,
      updated: now
    };

    // 存储关系到本地索引
    this.relationshipIndex.set(id, fullRelationship);
    
    // 更新实体-关系映射
    if (!this.entityToRelations.has(relationship.fromId)) {
      this.entityToRelations.set(relationship.fromId, new Set());
    }
    if (!this.entityToRelations.has(relationship.toId)) {
      this.entityToRelations.set(relationship.toId, new Set());
    }
    
    this.entityToRelations.get(relationship.fromId)!.add(id);
    this.entityToRelations.get(relationship.toId)!.add(id);

    // 保存到Chrome Storage
    await this.saveLocalRelationships();

    console.log(`🔗 关系已创建: ${relationship.type}(${relationship.fromId} -> ${relationship.toId})`);
    return fullRelationship;
  }

  /**
   * 查询实体 (优先从ChromaDB，回退到本地)
   */
  async queryEntities(options: {
    type?: string;
    name?: string;
    textQuery?: string;
    limit?: number;
  }): Promise<GraphEntity[]> {
    try {
      // 1. 尝试从ChromaDB搜索
      if (this.entitiesCollection && options.textQuery) {
        return await this.searchEntitiesInChroma(options);
      }

      // 2. 回退到本地类型索引搜索
      return await this.searchEntitiesLocally(options);

    } catch (error) {
      console.error('实体查询失败:', error);
      return [];
    }
  }

  /**
   * 查询关系 (本地索引)
   */
  queryRelationships(options: {
    type?: string;
    fromId?: string;
    toId?: string;
    limit?: number;
  }): GraphRelationship[] {
    let results = Array.from(this.relationshipIndex.values());

    // 按类型过滤
    if (options.type) {
      results = results.filter(rel => rel.type === options.type);
    }

    // 按起始实体过滤
    if (options.fromId) {
      results = results.filter(rel => rel.fromId === options.fromId);
    }

    // 按目标实体过滤
    if (options.toId) {
      results = results.filter(rel => rel.toId === options.toId);
    }

    // 限制结果数量
    if (options.limit) {
      results = results.slice(0, options.limit);
    }

    return results;
  }

  /**
   * 查找实体邻居
   */
  findNeighbors(entityId: string, options?: {
    relationTypes?: string[];
    direction?: 'in' | 'out' | 'both';
    maxDepth?: number;
  }): { entities: GraphEntity[], relationships: GraphRelationship[] } {
    const direction = options?.direction || 'both';
    const maxDepth = options?.maxDepth || 1;
    const relationTypes = options?.relationTypes;

    const visitedEntities = new Set<string>();
    const visitedRelationships = new Set<string>();
    const resultEntities: GraphEntity[] = [];
    const resultRelationships: GraphRelationship[] = [];

    const traverse = async (currentEntityId: string, depth: number) => {
      if (depth > maxDepth || visitedEntities.has(currentEntityId)) {
        return;
      }

      visitedEntities.add(currentEntityId);

      if (depth < maxDepth) {
        const entityRelations = this.entityToRelations.get(currentEntityId) || new Set();
        
        for (const relationId of Array.from(entityRelations)) {
          const relation = this.relationshipIndex.get(relationId);
          if (!relation || visitedRelationships.has(relationId)) continue;
          
          // 检查关系类型过滤
          if (relationTypes && !relationTypes.includes(relation.type)) continue;
          
          // 检查方向
          const isOutgoing = relation.fromId === currentEntityId;
          const isIncoming = relation.toId === currentEntityId;
          
          if ((direction === 'out' && !isOutgoing) || 
              (direction === 'in' && !isIncoming)) {
            continue;
          }

          visitedRelationships.add(relationId);
          resultRelationships.push(relation);

          // 递归遍历邻居
          const nextEntityId = isOutgoing ? relation.toId : relation.fromId;
          await traverse(nextEntityId, depth + 1);
        }
      }
    };

    traverse(entityId, 0);

    return {
      entities: resultEntities,
      relationships: resultRelationships
    };
  }

  /**
   * 新设备初始同步：从云端下载数据到本地
   */
  private async performInitialSync(): Promise<GraphSyncStatus> {
    if (!this.entitiesCollection) {
      console.log('⚠️ ChromaDB不可用，无法执行初始同步');
      return this.getSyncStatus();
    }

    this.syncInProgress = true;
    console.log('🔄 开始新设备初始同步...');

    try {
      let downloadedEntities = 0;
      let restoredRelationships = 0;

      // 1. 下载所有云端实体并建立本地索引
      const cloudEntities = await this.getAllEntitiesFromChroma();
      
      for (const entity of cloudEntities) {
        // 存储到实体索引
        this.entityIndex.set(entity.id, entity);
        
        // 建立实体类型索引
        if (!this.typeToEntities.has(entity.type)) {
          this.typeToEntities.set(entity.type, new Set());
        }
        this.typeToEntities.get(entity.type)!.add(entity.id);
        downloadedEntities++;
      }

      // 2. 尝试从云端恢复关系数据备份
      let relationshipRestored = await this.restoreRelationshipsFromCloud();
      if (relationshipRestored) {
        restoredRelationships = this.relationshipIndex.size;
      }

      // 3. 如果没有备份数据，尝试从消息数据重建关系表
      if (!relationshipRestored) {
        console.log('🔄 尝试从消息数据重建关系表...');
        relationshipRestored = await this.rebuildRelationshipsFromMessages();
        if (relationshipRestored) {
          restoredRelationships = this.relationshipIndex.size;
        }
      }

      // 4. 保存本地索引
      await this.saveLocalIndexes();
      
      // 5. 更新同步状态
      this.lastSyncTime = Date.now();
      await this.saveSyncStatus();

      console.log(`✅ 初始同步完成: 下载${downloadedEntities}个实体, 恢复${restoredRelationships}个关系`);

      return {
        lastSync: this.lastSyncTime,
        localEntities: this.entityIndex.size,
        cloudEntities: cloudEntities.length,
        localRelationships: this.relationshipIndex.size,
        pendingSync: 0,
        conflicts: 0
      };

    } catch (error) {
      console.error('❌ 初始同步失败:', error);
      return this.getSyncStatus();
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * 从云端恢复关系数据（不输出日志，内部使用）
   */
  private async restoreRelationshipsFromCloud(): Promise<boolean> {
    try {
      // 查找最新的备份
      const backups = await this.entitiesCollection!.get({
        where: { type: 'graph_backup' }
      });

      if (!backups.ids || backups.ids.length === 0) {
        console.log('📭 云端没有关系数据备份');
        return false;
      }

      // 获取最新备份
      const latestBackupIndex = backups.metadatas!
        .map((meta: any, index: number) => ({ meta, index }))
        .sort((a, b) => (b.meta.backupTime || 0) - (a.meta.backupTime || 0))[0].index;

      const backupContent = backups.documents![latestBackupIndex];
      const backupData = JSON.parse(backupContent);

      // 恢复关系数据
      this.relationshipIndex = new Map(backupData.relationships);
      this.entityToRelations = new Map(
        backupData.entityToRelations.map(([key, value]: [string, string[]]) => [key, new Set(value)])
      );
      
      // 合并类型索引（保留已下载的实体类型信息）
      if (backupData.typeToEntities) {
        const backupTypeToEntities: [string, string[]][] = backupData.typeToEntities;
        
        for (const [type, entityIds] of backupTypeToEntities) {
          if (!this.typeToEntities.has(type)) {
            this.typeToEntities.set(type, new Set());
          }
          for (const entityId of entityIds) {
            this.typeToEntities.get(type)!.add(entityId);
          }
        }
      }

      // 保存到本地
      await this.saveLocalRelationships();

      console.log(`📥 已恢复关系数据: ${this.relationshipIndex.size}个关系`);
      return true;

    } catch (error) {
      console.error('关系数据恢复失败:', error);
      return false;
    }
  }

  /**
   * 从消息数据重建关系表
   */
  private async rebuildRelationshipsFromMessages(): Promise<boolean> {
    try {
      console.log('🔄 开始从消息数据重建关系表...');
      
      // 获取messages collection
      const messagesCollection = await this.getMessagesCollection();
      if (!messagesCollection) {
        console.log('⚠️ 无法访问messages collection');
        return false;
      }

      // 获取所有消息数据
      const messagesData = await messagesCollection.get();
      if (!messagesData.ids || messagesData.ids.length === 0) {
        console.log('📭 没有找到消息数据');
        return false;
      }

      let rebuiltRelationships = 0;
      const relationshipMap = new Map<string, GraphRelationship>();
      const entityRelationsMap = new Map<string, Set<string>>();

      for (let i = 0; i < messagesData.ids.length; i++) {
        const metadata = messagesData.metadatas![i] as any;
        
        if (metadata.relationships) {
          try {
            const relationships = typeof metadata.relationships === 'string' 
              ? JSON.parse(metadata.relationships) 
              : metadata.relationships;
            
            if (Array.isArray(relationships)) {
              for (const rel of relationships) {
                // 生成关系ID
                const relationshipId = this.generateRelationshipId(rel.source, rel.target, rel.relationship);
                
                // 构建GraphRelationship对象
                const graphRelationship: GraphRelationship = {
                  id: relationshipId,
                  type: rel.relationship,
                  fromId: this.normalizeEntityId(rel.source),
                  toId: this.normalizeEntityId(rel.target),
                  properties: {
                    source: 'message',
                    messageId: messagesData.ids[i],
                    discoveredAt: metadata.timestamp || Date.now()
                  },
                  strength: 0.7, // 默认强度
                  created: metadata.timestamp || Date.now(),
                  updated: metadata.timestamp || Date.now()
                };

                // 避免重复添加相同关系
                if (!relationshipMap.has(relationshipId)) {
                  relationshipMap.set(relationshipId, graphRelationship);
                  
                  // 更新实体-关系映射
                  if (!entityRelationsMap.has(graphRelationship.fromId)) {
                    entityRelationsMap.set(graphRelationship.fromId, new Set());
                  }
                  if (!entityRelationsMap.has(graphRelationship.toId)) {
                    entityRelationsMap.set(graphRelationship.toId, new Set());
                  }
                  
                  entityRelationsMap.get(graphRelationship.fromId)!.add(relationshipId);
                  entityRelationsMap.get(graphRelationship.toId)!.add(relationshipId);
                  
                  rebuiltRelationships++;
                }
              }
            }
          } catch (e) {
            console.warn(`解析消息关系数据失败 ${messagesData.ids[i]}:`, e);
          }
        }
      }

      // 合并到现有关系索引中
      for (const [id, relationship] of Array.from(relationshipMap.entries())) {
        this.relationshipIndex.set(id, relationship);
      }
      
      for (const [entityId, relationIds] of Array.from(entityRelationsMap.entries())) {
        if (!this.entityToRelations.has(entityId)) {
          this.entityToRelations.set(entityId, new Set());
        }
        for (const relationId of Array.from(relationIds)) {
          this.entityToRelations.get(entityId)!.add(relationId);
        }
      }

      // 保存到本地
      await this.saveLocalRelationships();

      console.log(`✅ 从消息数据重建关系表完成: 新增${rebuiltRelationships}个关系`);
      return rebuiltRelationships > 0;

    } catch (error) {
      console.error('❌ 从消息数据重建关系表失败:', error);
      return false;
    }
  }

  /**
   * 获取messages collection
   */
  private async getMessagesCollection(): Promise<Collection | null> {
    try {
      if (!this.chromaClient) return null;
      
      const username = await this.getUsernameFromStorage();
      const messagesCollectionName = `${username}-messages`;
      
      const collections = await this.chromaClient.listCollections();
      if (!collections.includes(messagesCollectionName)) {
        return null;
      }

      const embeddingFunction = {
        generate: async (texts: string[]) => {
          return new Array(texts.length).fill(new Array(384).fill(0));
        }
      };

      return await this.chromaClient.getCollection({
        name: messagesCollectionName,
        embeddingFunction
      });
    } catch (error) {
      console.error('获取messages collection失败:', error);
      return null;
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
    
    // 移除引号和特殊符号，保留中英文字符
    let normalized = name.trim()
      .replace(/["']/g, '')
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^\w\u4e00-\u9fff]/g, '');
    
    // 如果标准化后为空，返回原始名称的hash
    if (!normalized) {
      normalized = `entity_${name.replace(/\s+/g, '_')}`;
    }
    
    return normalized;
  }

  /**
   * 获取同步统计信息
   */
  async getSyncStatistics(): Promise<{
    localEntities: number;
    localRelationships: number;
    localEntityTypes: number;
    lastSyncTime: number;
    isInitialized: boolean;
  }> {
    return {
      localEntities: Array.from(this.typeToEntities.values()).reduce((sum, set) => sum + set.size, 0),
      localRelationships: this.relationshipIndex.size,
      localEntityTypes: this.typeToEntities.size,
      lastSyncTime: this.lastSyncTime,
      isInitialized: this.chromaClient !== null
    };
  }

  /**
   * 公开方法：手动从消息数据重建关系表
   */
  async rebuildRelationshipsFromMessagesManually(): Promise<{
    success: boolean;
    rebuiltCount: number;
    message: string;
  }> {
    try {
      console.log('🛠️ 用户手动触发关系表重建...');
      
      const originalCount = this.relationshipIndex.size;
      const success = await this.rebuildRelationshipsFromMessages();
      const rebuiltCount = this.relationshipIndex.size - originalCount;
      
      if (success) {
        return {
          success: true,
          rebuiltCount,
          message: `✅ 成功重建关系表，新增 ${rebuiltCount} 个关系`
        };
      } else {
        return {
          success: false,
          rebuiltCount: 0,
          message: '❌ 关系表重建失败，请检查消息数据是否存在'
        };
      }
    } catch (error) {
      console.error('手动关系重建失败:', error);
      return {
        success: false,
        rebuiltCount: 0,
        message: `❌ 关系表重建出错: ${error.message}`
      };
    }
  }

  /**
   * 数据同步：本地 ↔ 云端
   */
  async performSync(force: boolean = false): Promise<GraphSyncStatus> {
    if (this.syncInProgress) {
      console.log('⏳ 同步正在进行中...');
      return this.getSyncStatus();
    }

    if (!force && Date.now() - this.lastSyncTime < 5 * 60 * 1000) {
      console.log('⏭️ 距离上次同步不足5分钟，跳过');
      return this.getSyncStatus();
    }

    this.syncInProgress = true;
    console.log('🔄 开始数据同步...');

    try {
      let syncedEntities = 0;
      let conflicts = 0;

      if (this.entitiesCollection) {
        // 1. 从云端拉取新实体
        const cloudEntities = await this.getAllEntitiesFromChroma();
        
        // 2. 检查本地关系中引用的实体是否存在于云端
        const localEntityIds = new Set<string>();
        for (const relation of Array.from(this.relationshipIndex.values())) {
          localEntityIds.add(relation.fromId);
          localEntityIds.add(relation.toId);
        }

        // 3. 为不存在的实体创建占位符并上传
        for (const entityId of Array.from(localEntityIds)) {
          const existsInCloud = cloudEntities.some(e => e.id === entityId);
          if (!existsInCloud) {
            await this.createPlaceholderEntity(entityId);
            syncedEntities++;
          }
        }

        // 4. 更新本地类型索引
        for (const entity of cloudEntities) {
          if (!this.typeToEntities.has(entity.type)) {
            this.typeToEntities.set(entity.type, new Set());
          }
          this.typeToEntities.get(entity.type)!.add(entity.id);
        }
      }

      this.lastSyncTime = Date.now();
      await this.saveSyncStatus();

      console.log(`✅ 同步完成: 同步${syncedEntities}个实体, ${conflicts}个冲突`);

      return {
        lastSync: this.lastSyncTime,
        localEntities: this.entityIndex.size,
        cloudEntities: this.entitiesCollection ? await this.getCloudEntityCount() : 0,
        localRelationships: this.relationshipIndex.size,
        pendingSync: 0,
        conflicts
      };

    } catch (error) {
      console.error('❌ 数据同步失败:', error);
      return this.getSyncStatus();
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * 数据备份到云端
   */
  async backupToCloud(): Promise<boolean> {
    if (!this.entitiesCollection) {
      console.log('⚠️ ChromaDB不可用，无法备份');
      return false;
    }

    try {
      console.log('☁️ 开始备份关系数据到云端...');

      // 将关系数据作为特殊"文档"存储到ChromaDB
      const relationshipData = {
        relationships: Array.from(this.relationshipIndex.entries()),
        entityToRelations: Array.from(this.entityToRelations.entries())
          .map(([key, value]) => [key, Array.from(value)]),
        typeToEntities: Array.from(this.typeToEntities.entries())
          .map(([key, value]) => [key, Array.from(value)]),
        backupTime: Date.now()
      };

      const backupId = `graph-backup-${Date.now()}`;
      const backupContent = JSON.stringify(relationshipData);
      const embedding = await getEmbeddingViaOffscreen(backupContent);

      await this.entitiesCollection.add({
        ids: [backupId],
        embeddings: [embedding],
        documents: [backupContent],
        metadatas: [{
          type: 'graph_backup',
          backupTime: Date.now(),
          relationshipCount: this.relationshipIndex.size,
          entityCount: this.entityIndex.size
        }]
      });

      console.log(`✅ 关系数据已备份到云端: ${backupId}`);
      return true;

    } catch (error) {
      console.error('❌ 云端备份失败:', error);
      return false;
    }
  }

  /**
   * 从云端恢复数据
   */
  async restoreFromCloud(): Promise<boolean> {
    if (!this.entitiesCollection) {
      console.log('⚠️ ChromaDB不可用，无法恢复');
      return false;
    }

    try {
      console.log('📥 开始从云端恢复关系数据...');

      // 查找最新的备份
      const backups = await this.entitiesCollection.get({
        where: { type: 'graph_backup' }
      });

      if (!backups.ids || backups.ids.length === 0) {
        console.log('📭 云端没有找到备份数据');
        return false;
      }

      // 获取最新备份
      const latestBackupIndex = backups.metadatas!
        .map((meta: any, index: number) => ({ meta, index }))
        .sort((a, b) => (b.meta.backupTime || 0) - (a.meta.backupTime || 0))[0].index;

      const backupContent = backups.documents![latestBackupIndex];
      const backupData = JSON.parse(backupContent);

      // 恢复关系数据
      this.relationshipIndex = new Map(backupData.relationships);
      this.entityToRelations = new Map(
        backupData.entityToRelations.map(([key, value]: [string, string[]]) => [key, new Set(value)])
      );
      this.typeToEntities = new Map(
        backupData.typeToEntities.map(([key, value]: [string, string[]]) => [key, new Set(value)])
      );

      // 保存到本地
      await this.saveLocalRelationships();
      await this.saveLocalIndexes();

      console.log(`✅ 已从云端恢复关系数据: ${this.relationshipIndex.size}个关系, ${this.typeToEntities.size}个实体类型`);
      return true;

    } catch (error) {
      console.error('❌ 云端恢复失败:', error);
      return false;
    }
  }

  /**
   * 从消息数据中提取实体和关系
   */
  async extractFromMessage(messageData: {
    messageId: string;
    content: string;
    source: string;
    entities?: any;
    relationships?: any;
    timestamp?: number;
  }): Promise<{ entities: GraphEntity[], relationships: GraphRelationship[] }> {
    const extractedEntities: GraphEntity[] = [];
    const extractedRelationships: GraphRelationship[] = [];
    const timestamp = messageData.timestamp || Date.now();

    try {
      if (messageData.entities) {
        // 提取人员实体
        if (messageData.entities.people) {
          for (const person of messageData.entities.people) {
            const entityId = `person_${this.normalizeId(person.name)}`;
            const entity = await this.upsertEntity({
              id: entityId,
              type: 'Person',
              name: person.name,
              properties: {
                role: person.role || '',
                department: person.department || '',
                source: messageData.source,
                firstMentioned: timestamp,
                lastMentioned: timestamp
              }
            });
            extractedEntities.push(entity);
          }
        }

        // 提取项目实体
        if (messageData.entities.projects) {
          for (const project of messageData.entities.projects) {
            const entityId = `project_${this.normalizeId(project.name)}`;
            const entity = await this.upsertEntity({
              id: entityId,
              type: 'Project',
              name: project.name,
              properties: {
                status: project.status || 'unknown',
                priority: project.priority || '',
                deadline: project.deadline || '',
                source: messageData.source,
                firstMentioned: timestamp,
                lastMentioned: timestamp
              }
            });
            extractedEntities.push(entity);
          }
        }

        // 提取任务实体
        if (messageData.entities.tasks) {
          for (const task of messageData.entities.tasks) {
            const entityId = `task_${this.normalizeId(task.name)}`;
            const entity = await this.upsertEntity({
              id: entityId,
              type: 'Task',
              name: task.name,
              properties: {
                status: task.status || 'unknown',
                assignee: task.assignee || '',
                deadline: task.deadline || '',
                source: messageData.source,
                firstMentioned: timestamp,
                lastMentioned: timestamp
              }
            });
            extractedEntities.push(entity);
          }
        }

        // 提取组织实体
        if (messageData.entities.organizations) {
          for (const org of messageData.entities.organizations) {
            const entityId = `org_${this.normalizeId(org.name)}`;
            const entity = await this.upsertEntity({
              id: entityId,
              type: 'Organization',
              name: org.name,
              properties: {
                type: org.type || '',
                source: messageData.source,
                firstMentioned: timestamp,
                lastMentioned: timestamp
              }
            });
            extractedEntities.push(entity);
          }
        }
      }

      // 创建关系
      if (messageData.relationships) {
        for (const rel of messageData.relationships) {
          const relationship = await this.createRelationship({
            type: rel.type || 'RELATED',
            fromId: rel.fromId,
            toId: rel.toId,
            properties: {
              messageId: messageData.messageId,
              source: messageData.source,
              timestamp: timestamp,
              context: messageData.content.substring(0, 200),
              confidence: rel.confidence || 0.7
            },
            strength: rel.strength || 0.7
          });
          extractedRelationships.push(relationship);
        }
      } else {
        // 自动推断关系
        const autoRelationships = await this.inferRelationshipsFromEntities(
          extractedEntities,
          messageData
        );
        extractedRelationships.push(...autoRelationships);
      }

      console.log(`📊 从消息提取: ${extractedEntities.length}个实体, ${extractedRelationships.length}个关系`);
      return { entities: extractedEntities, relationships: extractedRelationships };

    } catch (error) {
      console.error('从消息提取实体关系失败:', error);
      return { entities: [], relationships: [] };
    }
  }

  /**
   * 自动推断实体间关系
   */
  private async inferRelationshipsFromEntities(
    entities: GraphEntity[],
    messageData: { messageId: string; content: string; source: string; timestamp?: number }
  ): Promise<GraphRelationship[]> {
    const relationships: GraphRelationship[] = [];
    const timestamp = messageData.timestamp || Date.now();

    // 人员与项目的关系
    const people = entities.filter(e => e.type === 'Person');
    const projects = entities.filter(e => e.type === 'Project');
    const tasks = entities.filter(e => e.type === 'Task');

    // 人员参与项目关系
    for (const person of people) {
      for (const project of projects) {
        const relationship = await this.createRelationship({
          type: 'WORKS_ON',
          fromId: person.id,
          toId: project.id,
          properties: {
            messageId: messageData.messageId,
            source: messageData.source,
            timestamp: timestamp,
            context: messageData.content.substring(0, 200),
            inferred: true
          },
          strength: 0.6
        });
        relationships.push(relationship);
      }
    }

    // 人员负责任务关系
    for (const person of people) {
      for (const task of tasks) {
        const relationship = await this.createRelationship({
          type: 'ASSIGNED_TO',
          fromId: task.id,
          toId: person.id,
          properties: {
            messageId: messageData.messageId,
            source: messageData.source,
            timestamp: timestamp,
            context: messageData.content.substring(0, 200),
            inferred: true
          },
          strength: 0.6
        });
        relationships.push(relationship);
      }
    }

    // 任务属于项目关系
    for (const task of tasks) {
      for (const project of projects) {
        const relationship = await this.createRelationship({
          type: 'BELONGS_TO',
          fromId: task.id,
          toId: project.id,
          properties: {
            messageId: messageData.messageId,
            source: messageData.source,
            timestamp: timestamp,
            context: messageData.content.substring(0, 200),
            inferred: true
          },
          strength: 0.5
        });
        relationships.push(relationship);
      }
    }

    // 人员之间的协作关系
    for (let i = 0; i < people.length; i++) {
      for (let j = i + 1; j < people.length; j++) {
        const relationship = await this.createRelationship({
          type: 'COLLABORATES_WITH',
          fromId: people[i].id,
          toId: people[j].id,
          properties: {
            messageId: messageData.messageId,
            source: messageData.source,
            timestamp: timestamp,
            context: messageData.content.substring(0, 200),
            inferred: true
          },
          strength: 0.4
        });
        relationships.push(relationship);
      }
    }

    return relationships;
  }

  /**
   * 规范化ID
   */
  private normalizeId(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^\w\u4e00-\u9fff]/g, '_')  // 保留中文字符
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  }

  /**
   * 将实体存储到ChromaDB
   */
  private async storeEntityToChroma(entity: GraphEntity): Promise<void> {
    if (!this.entitiesCollection) return;

    const content = `${entity.name} ${entity.description || ''} ${JSON.stringify(entity.properties)}`;
    const embedding = await getEmbeddingViaOffscreen(content);

    await this.entitiesCollection.add({
      ids: [entity.id],
      embeddings: [embedding],
      documents: [content],
      metadatas: [{
        type: entity.type,
        name: entity.name,
        created: entity.created,
        updated: entity.updated,
        properties: JSON.stringify(entity.properties)
      }]
    });
  }

  /**
   * 从ChromaDB搜索实体
   */
  private async searchEntitiesInChroma(options: {
    type?: string;
    name?: string;
    textQuery?: string;
    limit?: number;
  }): Promise<GraphEntity[]> {
    if (!this.entitiesCollection) return [];

    const embedding = await getEmbeddingViaOffscreen(options.textQuery || options.name || '');
    
    const queryParams: any = {
      queryEmbeddings: [embedding],
      nResults: options.limit || 10
    };

    if (options.type) {
      queryParams.where = { type: options.type };
    }

    const results = await this.entitiesCollection.query(queryParams);
    
    const entities: GraphEntity[] = [];
    if (results.ids[0]) {
      for (let i = 0; i < results.ids[0].length; i++) {
        const metadata = results.metadatas[0][i] as any;
        entities.push({
          id: results.ids[0][i],
          type: metadata.type,
          name: metadata.name,
          properties: JSON.parse(metadata.properties || '{}'),
          created: metadata.created,
          updated: metadata.updated
        });
      }
    }

    return entities;
  }

  /**
   * 本地搜索实体
   */
  private async searchEntitiesLocally(options: {
    type?: string;
    name?: string;
    limit?: number;
  }): Promise<GraphEntity[]> {
    const results: GraphEntity[] = [];
    const limit = options.limit || 50;
    
    if (options.type) {
      // 按类型搜索
      const entityIds = this.typeToEntities.get(options.type) || new Set();
      
      for (const entityId of Array.from(entityIds)) {
        const entity = this.entityIndex.get(entityId);
        if (entity) {
          // 如果有名称过滤条件，检查名称匹配
          if (options.name) {
            if (entity.name.toLowerCase().includes(options.name.toLowerCase())) {
              results.push(entity);
            }
          } else {
            results.push(entity);
          }
          
          // 达到限制数量时停止
          if (results.length >= limit) {
            break;
          }
        }
      }
    } else if (options.name) {
      // 仅按名称搜索，遍历所有实体
      for (const entity of Array.from(this.entityIndex.values())) {
        if (entity.name.toLowerCase().includes(options.name.toLowerCase())) {
          results.push(entity);
          if (results.length >= limit) {
            break;
          }
        }
      }
    } else {
      // 无过滤条件，返回所有实体（限制数量）
      let count = 0;
      for (const entity of Array.from(this.entityIndex.values())) {
        results.push(entity);
        count++;
        if (count >= limit) {
          break;
        }
      }
    }

    return results;
  }

  /**
   * 获取所有ChromaDB实体
   */
  private async getAllEntitiesFromChroma(): Promise<GraphEntity[]> {
    if (!this.entitiesCollection) return [];

    const data = await this.entitiesCollection.get();
    const entities: GraphEntity[] = [];

    if (data.ids) {
      for (let i = 0; i < data.ids.length; i++) {
        const metadata = data.metadatas![i] as any;
        if (metadata.type !== 'graph_backup') { // 排除备份数据
          entities.push({
            id: data.ids[i],
            type: metadata.type,
            name: metadata.name,
            properties: JSON.parse(metadata.properties || '{}'),
            created: metadata.created,
            updated: metadata.updated
          });
        }
      }
    }

    return entities;
  }

  /**
   * 创建占位符实体
   */
  private async createPlaceholderEntity(entityId: string): Promise<void> {
    const [type, name] = entityId.split('_', 2);
    const entity: GraphEntity = {
      id: entityId,
      type: (type.charAt(0).toUpperCase() + type.slice(1)) as any,
      name: name?.replace(/_/g, ' ') || entityId,
      properties: { placeholder: true },
      created: Date.now(),
      updated: Date.now()
    };

    await this.storeEntityToChroma(entity);
  }

  /**
   * 保存本地关系数据
   */
  private async saveLocalRelationships(): Promise<void> {
    try {
      const data = {
        relationships: Array.from(this.relationshipIndex.entries()),
        entityToRelations: Array.from(this.entityToRelations.entries())
          .map(([key, value]) => [key, Array.from(value)])
      };
      
      await chrome.storage.local.set({ graphRelationships: data });
    } catch (error) {
      console.error('保存本地关系失败:', error);
    }
  }

  /**
   * 加载本地关系数据
   */
  private async loadLocalRelationships(): Promise<void> {
    try {
      const { graphRelationships } = await chrome.storage.local.get('graphRelationships');
      
      if (graphRelationships) {
        this.relationshipIndex = new Map(graphRelationships.relationships || []);
        this.entityToRelations = new Map(
          (graphRelationships.entityToRelations || []).map(([key, value]: [string, string[]]) => [key, new Set(value)])
        );
        
        console.log(`📚 已加载本地关系: ${this.relationshipIndex.size}个关系`);
      }
    } catch (error) {
      console.error('加载本地关系失败:', error);
    }
  }

  /**
   * 加载本地实体数据
   */
  private async loadLocalEntities(): Promise<void> {
    try {
      // 只加载新格式数据
      const storageKeys = ['entityIndex', 'typeToEntities'];
      const storageData = await chrome.storage.local.get(storageKeys);
      
      console.log('🔍 检查localStorage中的实体数据:', {
        entityIndex: storageData.entityIndex ? `${Array.isArray(storageData.entityIndex) ? storageData.entityIndex.length : 'Map数据'}个实体` : '无',
        typeToEntities: storageData.typeToEntities ? `${Array.isArray(storageData.typeToEntities) ? storageData.typeToEntities.length : 'Map数据'}个类型` : '无'
      });
      
      // 加载实体索引
      if (storageData.entityIndex && Array.isArray(storageData.entityIndex)) {
        this.entityIndex = new Map(storageData.entityIndex);
        console.log(`📝 已加载本地实体: ${this.entityIndex.size}个实体`);
      }

      // 加载类型索引
      if (storageData.typeToEntities && Array.isArray(storageData.typeToEntities)) {
        this.typeToEntities = new Map(
          storageData.typeToEntities.map(([key, value]: [string, string[]]) => [key, new Set(value)])
        );
        console.log(`📋 已加载实体类型索引: ${this.typeToEntities.size}个类型`);
      } else if (this.entityIndex.size > 0) {
        // 如果没有类型索引但有实体数据，重建类型索引
        console.log('🔄 重建实体类型索引...');
        this.typeToEntities.clear();
        Array.from(this.entityIndex.entries()).forEach(([entityId, entity]) => {
          if (!this.typeToEntities.has(entity.type)) {
            this.typeToEntities.set(entity.type, new Set());
          }
          this.typeToEntities.get(entity.type)!.add(entityId);
        });
        
        // 保存重建的索引
        await chrome.storage.local.set({
          typeToEntities: Array.from(this.typeToEntities.entries())
            .map(([key, value]) => [key, Array.from(value)])
        });
        
        console.log(`📋 重建了实体类型索引: ${this.typeToEntities.size}个类型`);
      }
      
      console.log(`✅ 实体数据加载完成: ${this.entityIndex.size}个实体, ${this.typeToEntities.size}个类型`);
      
    } catch (error) {
      console.error('❌ 加载本地实体失败:', error);
    }
  }

  /**
   * 保存本地索引
   */
  private async saveLocalIndexes(): Promise<void> {
    try {
      const entityIndexData = Array.from(this.entityIndex.entries());
      const typeToEntitiesData = Array.from(this.typeToEntities.entries())
        .map(([key, value]) => [key, Array.from(value)]);
      
      await chrome.storage.local.set({ 
        entityIndex: entityIndexData,
        typeToEntities: typeToEntitiesData 
      });

      console.log(`💾 已保存本地索引: ${this.entityIndex.size}个实体, ${this.typeToEntities.size}个类型`);
    } catch (error) {
      console.error('保存本地索引失败:', error);
    }
  }

  /**
   * 执行同步检查
   */
  private async performSyncCheck(): Promise<void> {
    const { graphSyncStatus } = await chrome.storage.local.get('graphSyncStatus');
    if (graphSyncStatus) {
      this.lastSyncTime = graphSyncStatus.lastSync || 0;
    }

    // 检测新设备场景：本地无数据但云端可能有数据
    const isNewDevice = await this.detectNewDevice();
    if (isNewDevice) {
      console.log('🆕 检测到新设备，执行初始同步...');
      await this.performInitialSync();
      return;
    }

    // 如果超过24小时未同步，自动执行同步
    if (Date.now() - this.lastSyncTime > 24 * 60 * 60 * 1000) {
      console.log('⏰ 超过24小时未同步，执行自动同步...');
      await this.performSync();
    }
  }

  /**
   * 检测是否为新设备场景
   */
  private async detectNewDevice(): Promise<boolean> {
    try {
      // 1. 检查本地是否有关系数据
      const hasLocalRelationships = this.relationshipIndex.size > 0;
      
      // 2. 检查本地是否有实体类型索引
      const hasLocalEntityTypes = this.typeToEntities.size > 0;
      
      // 3. 检查是否有同步历史
      const hasSyncHistory = this.lastSyncTime > 0;
      
      // 如果本地有任何数据或同步历史，则不是新设备
      if (hasLocalRelationships || hasLocalEntityTypes || hasSyncHistory) {
        return false;
      }
      
      // 4. 检查云端是否有数据
      if (!this.entitiesCollection) {
        return false; // ChromaDB不可用，无法检查云端数据
      }
      
      const cloudEntityCount = await this.getCloudEntityCount();
      
      // 如果云端有数据但本地无数据，认为是新设备
      const isNewDevice = cloudEntityCount > 0;
      
      if (isNewDevice) {
        console.log(`🔍 新设备检测: 本地无数据，云端有${cloudEntityCount}个实体`);
      }
      
      return isNewDevice;
      
    } catch (error) {
      console.error('新设备检测失败:', error);
      return false;
    }
  }

  private async saveSyncStatus(): Promise<void> {
    await chrome.storage.local.set({
      graphSyncStatus: { lastSync: this.lastSyncTime }
    });
  }

  private getSyncStatus(): GraphSyncStatus {
    return {
      lastSync: this.lastSyncTime,
      localEntities: this.entityIndex.size,
      cloudEntities: 0,
      localRelationships: this.relationshipIndex.size,
      pendingSync: 0,
      conflicts: 0
    };
  }

  private async getCloudEntityCount(): Promise<number> {
    if (!this.entitiesCollection) return 0;
    const data = await this.entitiesCollection.get();
    return data.ids?.length || 0;
  }

  private async getUsernameFromStorage(): Promise<string> {
    try {
      const { userinfo } = await chrome.storage.local.get('userinfo');
      return userinfo.username || 'default-user';
    } catch (error) {
      return 'default-user';
    }
  }

  /**
   * 获取存储统计
   */
  getStatistics(): {
    localRelationships: number;
    localEntityTypes: number;
    estimatedCloudEntities: number;
    lastSync: number;
    isCloudAvailable: boolean;
  } {
    return {
      localRelationships: this.relationshipIndex.size,
      localEntityTypes: this.typeToEntities.size,
      estimatedCloudEntities: 0, // 需要异步获取
      lastSync: this.lastSyncTime,
      isCloudAvailable: !!this.entitiesCollection
    };
  }

  /**
   * 按实体查询相关聊天记录
   */
  async queryEntityMessages(entityId: string, options?: {
    limit?: number;
    timeRange?: { start: number; end: number };
  }): Promise<Array<{
    messageId: string;
    content: string;
    source: string;
    timestamp: number;
    relevanceScore: number;
  }>> {
    try {
      if (!this.chromaClient) {
        console.warn('ChromaDB不可用，无法查询聊天记录');
        return [];
      }

      const entity = this.entityIndex.get(entityId);
      if (!entity) {
        console.warn(`实体 ${entityId} 不存在`);
        return [];
      }

      // 获取消息collection
      const messagesCollection = await this.getMessagesCollection();
      if (!messagesCollection) {
        return [];
      }

      // 构建查询条件
      const queryFilters: any = {
        $or: [
          { entities: { $contains: entity.name } },
          { content: { $contains: entity.name } }
        ]
      };

      // 添加时间范围过滤
      if (options?.timeRange) {
        queryFilters.timestamp = {
          $gte: options.timeRange.start,
          $lte: options.timeRange.end
        };
      }

      // 执行查询
      const queryResult = await messagesCollection.query({
        queryTexts: [entity.name],
        nResults: options?.limit || 20,
        where: queryFilters
      });

      const results: Array<{
        messageId: string;
        content: string;
        source: string;
        timestamp: number;
        relevanceScore: number;
      }> = [];

      if (queryResult.ids && queryResult.ids[0]) {
        for (let i = 0; i < queryResult.ids[0].length; i++) {
          const metadata = queryResult.metadatas?.[0]?.[i] as any;
          results.push({
            messageId: queryResult.ids[0][i],
            content: queryResult.documents?.[0]?.[i] || '',
            source: metadata?.source || 'unknown',
            timestamp: metadata?.timestamp || Date.now(),
            relevanceScore: 1 - (queryResult.distances?.[0]?.[i] || 0)
          });
        }
      }

      // 按时间倒序排列
      results.sort((a, b) => b.timestamp - a.timestamp);
      
      console.log(`📱 查询实体 ${entity.name} 的消息记录: ${results.length} 条`);
      return results;

    } catch (error) {
      console.error('查询实体消息失败:', error);
      return [];
    }
  }

  /**
   * 按实体查询相关网页记录
   */
  async queryEntityWebpages(entityId: string, options?: {
    limit?: number;
    timeRange?: { start: number; end: number };
  }): Promise<Array<{
    webpageId: string;
    title: string;
    url: string;
    domain: string;
    content: string;
    visitTime: number;
    relevanceScore: number;
    tags: string[];
  }>> {
    try {
      if (!this.chromaClient) {
        console.warn('ChromaDB不可用，无法查询网页记录');
        return [];
      }

      const entity = this.entityIndex.get(entityId);
      if (!entity) {
        console.warn(`实体 ${entityId} 不存在`);
        return [];
      }

      // 获取网页collection
      const username = await this.getUsernameFromStorage();
      const webpagesCollectionName = `${username}-webpages`;
      
      let webpagesCollection;
      try {
        const embeddingFunction = {
          generate: async (texts: string[]) => {
            return new Array(texts.length).fill(new Array(384).fill(0));
          }
        };
        
        webpagesCollection = await this.chromaClient.getCollection({ 
          name: webpagesCollectionName,
          embeddingFunction
        });
      } catch (error) {
        console.log('网页collection不存在');
        return [];
      }

      // 构建查询条件
      const queryFilters: any = {
        $or: [
          { projects: { $contains: entity.name } },
          { people: { $contains: entity.name } },
          { content: { $contains: entity.name } }
        ]
      };

      // 添加时间范围过滤
      if (options?.timeRange) {
        queryFilters.extractedAt = {
          $gte: options.timeRange.start,
          $lte: options.timeRange.end
        };
      }

      // 执行查询
      const queryResult = await webpagesCollection.query({
        queryTexts: [entity.name],
        nResults: options?.limit || 10,
        where: queryFilters
      });

      const results: Array<{
        webpageId: string;
        title: string;
        url: string;
        domain: string;
        content: string;
        visitTime: number;
        relevanceScore: number;
        tags: string[];
      }> = [];

      if (queryResult.ids && queryResult.ids[0]) {
        for (let i = 0; i < queryResult.ids[0].length; i++) {
          const metadata = queryResult.metadatas?.[0]?.[i] as any;
          results.push({
            webpageId: queryResult.ids[0][i],
            title: metadata?.title || 'Untitled',
            url: metadata?.url || '',
            domain: metadata?.domain || '',
            content: queryResult.documents?.[0]?.[i] || '',
            visitTime: metadata?.extractedAt || Date.now(),
            relevanceScore: 1 - (queryResult.distances?.[0]?.[i] || 0),
            tags: this.parseTagsFromMetadata(metadata)
          });
        }
      }

      // 按访问时间倒序排列
      results.sort((a, b) => b.visitTime - a.visitTime);
      
      console.log(`🌐 查询实体 ${entity.name} 的网页记录: ${results.length} 条`);
      return results;

    } catch (error) {
      console.error('查询实体网页失败:', error);
      return [];
    }
  }

  /**
   * 获取实体时间轴
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
    try {
      const entity = this.entityIndex.get(entityId);
      if (!entity) {
        console.warn(`实体 ${entityId} 不存在`);
        return [];
      }

      const timeline: Array<{
        id: string;
        type: 'message' | 'webpage' | 'relation_created' | 'entity_updated';
        title: string;
        content: string;
        timestamp: number;
        source?: string;
        metadata?: any;
      }> = [];

      // 1. 获取相关消息
      const messages = await this.queryEntityMessages(entityId, options);
      for (const msg of messages) {
        timeline.push({
          id: `msg-${msg.messageId}`,
          type: 'message',
          title: '聊天消息',
          content: msg.content,
          timestamp: msg.timestamp,
          source: msg.source,
          metadata: { relevanceScore: msg.relevanceScore }
        });
      }

      // 2. 获取相关网页
      const webpages = await this.queryEntityWebpages(entityId, options);
      for (const webpage of webpages) {
        timeline.push({
          id: `web-${webpage.webpageId}`,
          type: 'webpage',
          title: webpage.title,
          content: webpage.content,
          timestamp: webpage.visitTime,
          metadata: { 
            url: webpage.url, 
            domain: webpage.domain,
            relevanceScore: webpage.relevanceScore 
          }
        });
      }

      // 3. 获取关系创建记录
      const relationships = this.queryRelationships({ fromId: entityId });
      const incomingRelationships = this.queryRelationships({ toId: entityId });
      
      for (const rel of [...relationships, ...incomingRelationships]) {
        timeline.push({
          id: `rel-${rel.id}`,
          type: 'relation_created',
          title: `建立关系: ${rel.type}`,
          content: `与 ${rel.fromId === entityId ? rel.toId : rel.fromId} 建立了 ${rel.type} 关系`,
          timestamp: rel.created,
          metadata: { relationship: rel }
        });
      }

      // 4. 添加实体更新记录
      timeline.push({
        id: `entity-created-${entity.id}`,
        type: 'entity_updated',
        title: '实体创建',
        content: `${entity.type} "${entity.name}" 被创建`,
        timestamp: entity.created
      });

      if (entity.updated > entity.created) {
        timeline.push({
          id: `entity-updated-${entity.id}`,
          type: 'entity_updated',
          title: '实体更新',
          content: `${entity.type} "${entity.name}" 被更新`,
          timestamp: entity.updated
        });
      }

      // 按时间倒序排列
      timeline.sort((a, b) => b.timestamp - a.timestamp);
      
      // 应用限制
      const limitedTimeline = options?.limit ? timeline.slice(0, options.limit) : timeline;
      
      console.log(`⏰ 生成实体 ${entity.name} 的时间轴: ${limitedTimeline.length} 个事件`);
      return limitedTimeline;

    } catch (error) {
      console.error('生成实体时间轴失败:', error);
      return [];
    }
  }

  /**
   * 获取实体统计信息
   */
  async getEntityStatistics(): Promise<{
    entityCounts: Record<string, number>;
    totalEntities: number;
    totalRelationships: number;
    topEntitiesByType: Record<string, Array<{
      id: string;
      name: string;
      relationCount: number;
      lastActivity: number;
    }>>;
    relationshipTypes: Record<string, number>;
    activityStats: {
      entitiesCreatedToday: number;
      entitiesCreatedThisWeek: number;
      entitiesCreatedThisMonth: number;
    };
  }> {
    try {
      // 确保数据已加载
      if (this.entityIndex.size === 0) {
        console.log('⚠️ 实体索引为空，尝试重新加载数据...');
        await this.loadLocalEntities();
      }
      
      console.log('📊 生成实体统计信息:', {
        entityIndexSize: this.entityIndex.size,
        relationshipIndexSize: this.relationshipIndex.size,
        typeToEntitiesSize: this.typeToEntities.size
      });
      
      const stats = {
        entityCounts: {} as Record<string, number>,
        totalEntities: this.entityIndex.size,
        totalRelationships: this.relationshipIndex.size,
        topEntitiesByType: {} as Record<string, Array<{
          id: string;
          name: string;
          relationCount: number;
          lastActivity: number;
        }>>,
        relationshipTypes: {} as Record<string, number>,
        activityStats: {
          entitiesCreatedToday: 0,
          entitiesCreatedThisWeek: 0,
          entitiesCreatedThisMonth: 0
        }
      };

      const now = Date.now();
      const today = now - 24 * 60 * 60 * 1000;
      const thisWeek = now - 7 * 24 * 60 * 60 * 1000;
      const thisMonth = now - 30 * 24 * 60 * 60 * 1000;

      // 统计实体数量和活动
      Array.from(this.entityIndex.entries()).forEach(([entityId, entity]) => {
        // 按类型统计
        stats.entityCounts[entity.type] = (stats.entityCounts[entity.type] || 0) + 1;

        // 活动统计
        if (entity.created > today) {
          stats.activityStats.entitiesCreatedToday++;
        }
        if (entity.created > thisWeek) {
          stats.activityStats.entitiesCreatedThisWeek++;
        }
        if (entity.created > thisMonth) {
          stats.activityStats.entitiesCreatedThisMonth++;
        }

        // 计算关系数量
        const relations = this.entityToRelations.get(entityId);
        const relationCount = relations ? relations.size : 0;

        // 按类型记录top实体
        if (!stats.topEntitiesByType[entity.type]) {
          stats.topEntitiesByType[entity.type] = [];
        }
        
        stats.topEntitiesByType[entity.type].push({
          id: entityId,
          name: entity.name,
          relationCount,
          lastActivity: Math.max(entity.created, entity.updated)
        });
      });

      // 排序top实体（按关系数量和最近活动时间）
      for (const type in stats.topEntitiesByType) {
        stats.topEntitiesByType[type].sort((a, b) => {
          if (a.relationCount !== b.relationCount) {
            return b.relationCount - a.relationCount; // 关系多的在前
          }
          return b.lastActivity - a.lastActivity; // 最近活动的在前
        });
        // 只保留前10个
        stats.topEntitiesByType[type] = stats.topEntitiesByType[type].slice(0, 10);
      }

      // 统计关系类型
      Array.from(this.relationshipIndex.entries()).forEach(([relationId, relationship]) => {
        stats.relationshipTypes[relationship.type] = 
          (stats.relationshipTypes[relationship.type] || 0) + 1;
      });

      console.log('📊 实体统计信息生成完成:', stats);
      return stats;

    } catch (error) {
      console.error('获取实体统计失败:', error);
      return {
        entityCounts: {},
        totalEntities: 0,
        totalRelationships: 0,
        topEntitiesByType: {},
        relationshipTypes: {},
        activityStats: {
          entitiesCreatedToday: 0,
          entitiesCreatedThisWeek: 0,
          entitiesCreatedThisMonth: 0
        }
      };
    }
  }

  /**
   * 更新实体访问统计
   */
  async updateEntityAccess(entityId: string): Promise<void> {
    try {
      const entity = this.entityIndex.get(entityId);
      if (!entity) {
        console.warn(`实体 ${entityId} 不存在`);
        return;
      }

      // 更新访问统计
      entity.lastAccessed = Date.now();
      entity.accessCount = (entity.accessCount || 0) + 1;
      entity.updated = Date.now();

      // 重新计算重要性评分
      await this.recalculateEntityImportance(entity);

      // 保存更新
      this.entityIndex.set(entityId, entity);
      
      // 如果有云端存储，同步更新
      if (this.entitiesCollection) {
        await this.storeEntityToChroma(entity);
      }

      console.log(`📊 更新实体访问统计: ${entity.name}, 访问次数: ${entity.accessCount}`);

    } catch (error) {
      console.error('更新实体访问统计失败:', error);
    }
  }

  /**
   * 重新计算实体重要性评分
   */
  private async recalculateEntityImportance(entity: GraphEntity): Promise<void> {
    try {
      let importance = 0;

      // 基础分数（基于类型）
      const typeImportance = {
        'Person': 0.3,
        'Project': 0.4,
        'Organization': 0.3,
        'Task': 0.2,
        'Document': 0.2,
        'Technology': 0.2,
        'Topic': 0.3
      };
      importance += typeImportance[entity.type] || 0.2;

      // 关系数量影响（最多+0.3）
      const relations = this.entityToRelations.get(entity.id);
      const relationCount = relations ? relations.size : 0;
      importance += Math.min(0.3, relationCount * 0.05);

      // 访问频率影响（最多+0.2）
      const accessCount = entity.accessCount || 0;
      importance += Math.min(0.2, accessCount * 0.01);

      // 最近活动影响（最多+0.2）
      const daysSinceActivity = (Date.now() - (entity.lastAccessed || entity.updated)) / (24 * 60 * 60 * 1000);
      if (daysSinceActivity < 1) {
        importance += 0.2; // 今天访问过
      } else if (daysSinceActivity < 7) {
        importance += 0.1; // 一周内访问过
      } else if (daysSinceActivity < 30) {
        importance += 0.05; // 一个月内访问过
      }

      // 确保评分在0-1范围内
      entity.importance = Math.min(1.0, Math.max(0.0, importance));

    } catch (error) {
      console.error('计算实体重要性失败:', error);
      entity.importance = 0.5; // 默认值
    }
  }

  /**
   * 批量更新实体的关联统计
   */
  async enrichEntitiesWithStats(entities: GraphEntity[]): Promise<GraphEntity[]> {
    try {
      const enrichedEntities = await Promise.all(
        entities.map(async (entity) => {
          // 计算关系数量
          const relations = this.entityToRelations.get(entity.id);
          entity.relationshipsCount = relations ? relations.size : 0;

          // 查询相关消息数量（如果ChromaDB可用）
          if (this.chromaClient) {
            try {
              const messages = await this.queryEntityMessages(entity.id, { limit: 1 });
              // 这里只是为了获取总数，实际实现中可以优化为只获取计数
              entity.relatedMessagesCount = messages.length > 0 ? Math.min(100, messages.length) : 0;
            } catch (error) {
              entity.relatedMessagesCount = 0;
            }

            try {
              const webpages = await this.queryEntityWebpages(entity.id, { limit: 1 });
              entity.relatedWebpagesCount = webpages.length > 0 ? Math.min(50, webpages.length) : 0;
            } catch (error) {
              entity.relatedWebpagesCount = 0;
            }
          } else {
            entity.relatedMessagesCount = 0;
            entity.relatedWebpagesCount = 0;
          }

          // 确保有默认的统计值
          entity.accessCount = entity.accessCount || 0;
          entity.lastAccessed = entity.lastAccessed || entity.updated;
          entity.importance = entity.importance || 0.5;
          entity.tags = entity.tags || [];
          entity.status = entity.status || 'active';

          return entity;
        })
      );

      return enrichedEntities;

    } catch (error) {
      console.error('丰富实体统计信息失败:', error);
      return entities;
    }
  }

  /**
   * 获取实体详细信息（包含所有统计）
   */
  async getEntityDetails(entityId: string): Promise<GraphEntity | null> {
    try {
      const entity = this.entityIndex.get(entityId);
      if (!entity) {
        return null;
      }

      // 更新访问统计
      await this.updateEntityAccess(entityId);

      // 丰富统计信息
      const enrichedEntities = await this.enrichEntitiesWithStats([entity]);
      
      return enrichedEntities[0] || null;

    } catch (error) {
      console.error('获取实体详情失败:', error);
      return null;
    }
  }

  /**
   * 设置实体标签
   */
  async setEntityTags(entityId: string, tags: string[]): Promise<boolean> {
    try {
      const entity = this.entityIndex.get(entityId);
      if (!entity) {
        console.warn(`实体 ${entityId} 不存在`);
        return false;
      }

      entity.tags = Array.from(new Set(tags)); // 去重
      entity.updated = Date.now();

      this.entityIndex.set(entityId, entity);

      // 同步到云端
      if (this.entitiesCollection) {
        await this.storeEntityToChroma(entity);
      }

      console.log(`🏷️ 设置实体标签: ${entity.name} -> ${tags.join(', ')}`);
      return true;

    } catch (error) {
      console.error('设置实体标签失败:', error);
      return false;
    }
  }

  /**
   * 设置实体状态
   */
  async setEntityStatus(entityId: string, status: string): Promise<boolean> {
    try {
      const entity = this.entityIndex.get(entityId);
      if (!entity) {
        console.warn(`实体 ${entityId} 不存在`);
        return false;
      }

      entity.status = status;
      entity.updated = Date.now();

      this.entityIndex.set(entityId, entity);

      // 同步到云端
      if (this.entitiesCollection) {
        await this.storeEntityToChroma(entity);
      }

      console.log(`📊 设置实体状态: ${entity.name} -> ${status}`);
      return true;

    } catch (error) {
      console.error('设置实体状态失败:', error);
      return false;
    }
  }

  /**
   * 根据重要性排序实体
   */
  getEntitiesByImportance(entityType?: string, limit: number = 20): GraphEntity[] {
    try {
      let entities: GraphEntity[];
      
      if (entityType) {
        const entityIds = this.typeToEntities.get(entityType);
        if (!entityIds) return [];
        entities = Array.from(entityIds).map(id => this.entityIndex.get(id)!).filter(Boolean);
      } else {
        entities = Array.from(this.entityIndex.values());
      }

      // 按重要性排序
      entities.sort((a, b) => {
        const importanceA = a.importance || 0;
        const importanceB = b.importance || 0;
        
        if (Math.abs(importanceA - importanceB) < 0.05) {
          // 重要性相近时，按最近访问时间排序
          return (b.lastAccessed || b.updated) - (a.lastAccessed || a.updated);
        }
        
        return importanceB - importanceA;
      });

      return entities.slice(0, limit);

    } catch (error) {
      console.error('按重要性排序实体失败:', error);
      return [];
    }
  }

  /**
   * 解析标签从元数据
   */
  private parseTagsFromMetadata(metadata: any): string[] {
    const tags: string[] = [];
    
    try {
      if (metadata?.contentCategory) {
        tags.push(metadata.contentCategory);
      }
      if (metadata?.domain) {
        tags.push(metadata.domain);
      }
      if (metadata?.projects) {
        const projects = typeof metadata.projects === 'string' 
          ? JSON.parse(metadata.projects) 
          : metadata.projects;
        if (Array.isArray(projects)) {
          tags.push(...projects);
        }
      }
    } catch (error) {
      console.warn('解析标签失败:', error);
    }
    
    return tags;
  }

  /**
   * 清理过期数据
   */
  async cleanup(retentionDays: number = 180): Promise<number> {
    const cutoffTime = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);
    let cleanedCount = 0;

    // 清理过期关系
    for (const [id, relationship] of Array.from(this.relationshipIndex)) {
      if (relationship.created < cutoffTime && relationship.strength < 0.3) {
        this.relationshipIndex.delete(id);
        cleanedCount++;
      }
    }

    // 重建索引
    await this.rebuildIndexes();
    await this.saveLocalRelationships();

    console.log(`🧹 图数据清理完成，删除${cleanedCount}个过期关系`);
    return cleanedCount;
  }

  private async rebuildIndexes(): Promise<void> {
    this.entityToRelations.clear();
    
    for (const relationship of Array.from(this.relationshipIndex.values())) {
      if (!this.entityToRelations.has(relationship.fromId)) {
        this.entityToRelations.set(relationship.fromId, new Set());
      }
      if (!this.entityToRelations.has(relationship.toId)) {
        this.entityToRelations.set(relationship.toId, new Set());
      }
      
      this.entityToRelations.get(relationship.fromId)!.add(relationship.id);
      this.entityToRelations.get(relationship.toId)!.add(relationship.id);
    }
  }

  /**
   * 获取实体类型信息列表
   */
  async getEntityTypes(): Promise<EntityTypeInfo[]> {
    try {
      const entityTypes: EntityTypeInfo[] = [];
      
      // 遍历所有已知的实体类型
      for (const [type, entityIds] of Array.from(this.typeToEntities.entries())) {
        const config = ENTITY_TYPE_CONFIG[type];
        if (config) {
          entityTypes.push({
            type,
            name: config.name,
            icon: config.icon,
            count: entityIds.size,
            description: config.description
          });
        } else {
          // 未知类型，使用默认配置
          entityTypes.push({
            type,
            name: type,
            icon: '📂',
            count: entityIds.size,
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
   * 按类型获取实体列表（优化的版本）
   */
  async getEntitiesByType(entityType: string, options?: {
    limit?: number;
    offset?: number;
    sortBy?: 'name' | 'importance' | 'lastAccessed' | 'created';
    sortOrder?: 'asc' | 'desc';
  }): Promise<GraphEntity[]> {
    try {
      const {
        limit = 50,
        offset = 0,
        sortBy = 'importance',
        sortOrder = 'desc'
      } = options || {};

      // 获取该类型的所有实体ID
      const entityIds = this.typeToEntities.get(entityType);
      if (!entityIds || entityIds.size === 0) {
        console.log(`⚠️ 类型 ${entityType} 没有找到实体`);
        return [];
      }

      // 获取实体对象
      const entities: GraphEntity[] = [];
      for (const entityId of Array.from(entityIds)) {
        const entity = this.entityIndex.get(entityId);
        if (entity) {
          entities.push(entity);
        }
      }

      // 排序
      entities.sort((a, b) => {
        let valueA: any, valueB: any;
        
        switch (sortBy) {
          case 'name':
            valueA = a.name.toLowerCase();
            valueB = b.name.toLowerCase();
            break;
          case 'importance':
            valueA = a.importance || 0;
            valueB = b.importance || 0;
            break;
          case 'lastAccessed':
            valueA = a.lastAccessed || a.updated;
            valueB = b.lastAccessed || b.updated;
            break;
          case 'created':
            valueA = a.created;
            valueB = b.created;
            break;
          default:
            valueA = a.importance || 0;
            valueB = b.importance || 0;
        }

        if (sortOrder === 'asc') {
          return valueA > valueB ? 1 : -1;
        } else {
          return valueA < valueB ? 1 : -1;
        }
      });

      // 分页
      const paginatedEntities = entities.slice(offset, offset + limit);
      
      // 丰富统计信息
      const enrichedEntities = await this.enrichEntitiesWithStats(paginatedEntities);
      
      console.log(`📊 获取${entityType}类型实体: ${enrichedEntities.length}/${entities.length}个`);
      return enrichedEntities;
      
    } catch (error) {
      console.error(`获取${entityType}类型实体失败:`, error);
      return [];
    }
  }

  /**
   * 通用搜索实体方法（改进版）
   */
  async searchEntities(options: {
    query?: string;
    entityType?: string;
    tags?: string[];
    status?: string;
    limit?: number;
    timeRange?: { start: number; end: number };
  }): Promise<GraphEntity[]> {
    try {
      const { query, entityType, tags, status, limit = 30, timeRange } = options;
      
      let candidates: GraphEntity[] = [];
      
      // 1. 首先按类型过滤
      if (entityType) {
        const entityIds = this.typeToEntities.get(entityType);
        if (entityIds) {
          candidates = Array.from(entityIds)
            .map(id => this.entityIndex.get(id))
            .filter(Boolean) as GraphEntity[];
        }
      } else {
        candidates = Array.from(this.entityIndex.values());
      }
      
      // 2. 按文本查询过滤
      if (query && query.trim()) {
        const lowerQuery = query.toLowerCase();
        candidates = candidates.filter(entity => {
          // 搜索名称
          if (entity.name.toLowerCase().includes(lowerQuery)) return true;
          
          // 搜索描述
          if (entity.description && entity.description.toLowerCase().includes(lowerQuery)) return true;
          
          // 搜索属性
          const propertiesStr = JSON.stringify(entity.properties).toLowerCase();
          if (propertiesStr.includes(lowerQuery)) return true;
          
          return false;
        });
      }
      
      // 3. 按标签过滤
      if (tags && tags.length > 0) {
        candidates = candidates.filter(entity => {
          if (!entity.tags || entity.tags.length === 0) return false;
          return tags.some(tag => entity.tags!.includes(tag));
        });
      }
      
      // 4. 按状态过滤
      if (status) {
        candidates = candidates.filter(entity => entity.status === status);
      }
      
      // 5. 按时间范围过滤
      if (timeRange) {
        candidates = candidates.filter(entity => {
          const entityTime = entity.lastAccessed || entity.updated;
          return entityTime >= timeRange.start && entityTime <= timeRange.end;
        });
      }
      
      // 6. 按重要性排序
      candidates.sort((a, b) => {
        const importanceA = a.importance || 0;
        const importanceB = b.importance || 0;
        
        if (Math.abs(importanceA - importanceB) < 0.01) {
          // 重要性相近时，按最近访问时间排序
          return (b.lastAccessed || b.updated) - (a.lastAccessed || a.updated);
        }
        
        return importanceB - importanceA;
      });
      
      // 7. 限制结果数量
      const results = candidates.slice(0, limit);
      
      // 8. 丰富统计信息
      const enrichedResults = await this.enrichEntitiesWithStats(results);
      
      console.log(`🔍 搜索实体结果: ${enrichedResults.length}个 (查询: "${query || ''}", 类型: ${entityType || 'all'})`);
      return enrichedResults;
      
    } catch (error) {
      console.error('搜索实体失败:', error);
      return [];
    }
  }

  /**
   * 更新实体信息（支持编辑）
   */
  async updateEntity(entityId: string, updates: Partial<GraphEntity>): Promise<boolean> {
    try {
      const entity = this.entityIndex.get(entityId);
      if (!entity) {
        console.warn(`实体 ${entityId} 不存在`);
        return false;
      }

      // 合并更新
      const updatedEntity: GraphEntity = {
        ...entity,
        ...updates,
        id: entityId, // 确保ID不被覆盖
        updated: Date.now()
      };

      // 更新本地索引
      this.entityIndex.set(entityId, updatedEntity);

      // 如果类型发生变化，需要更新类型索引
      if (updates.type && updates.type !== entity.type) {
        // 从旧类型中移除
        const oldTypeEntities = this.typeToEntities.get(entity.type);
        if (oldTypeEntities) {
          oldTypeEntities.delete(entityId);
          if (oldTypeEntities.size === 0) {
            this.typeToEntities.delete(entity.type);
          }
        }
        
        // 添加到新类型
        if (!this.typeToEntities.has(updates.type)) {
          this.typeToEntities.set(updates.type, new Set());
        }
        this.typeToEntities.get(updates.type)!.add(entityId);
      }

      // 保存到本地存储
      await this.saveLocalIndexes();

      // 同步到云端
      if (this.entitiesCollection) {
        await this.storeEntityToChroma(updatedEntity);
      }

      console.log(`✏️ 更新实体: ${updatedEntity.name}`);
      return true;

    } catch (error) {
      console.error('更新实体失败:', error);
      return false;
    }
  }

  /**
   * 创建新实体（从界面编辑）
   */
  async createEntity(entityData: Omit<GraphEntity, 'id' | 'created' | 'updated'>): Promise<GraphEntity | null> {
    try {
      // 生成ID
      const entityId = `${entityData.type.toLowerCase()}_${this.normalizeId(entityData.name)}_${Date.now()}`;
      
      const entity = await this.upsertEntity({
        ...entityData,
        id: entityId
      });

      console.log(`➕ 创建新实体: ${entity.type} - ${entity.name}`);
      return entity;

    } catch (error) {
      console.error('创建实体失败:', error);
      return null;
    }
  }

  /**
   * 删除实体
   */
  async deleteEntity(entityId: string): Promise<boolean> {
    try {
      const entity = this.entityIndex.get(entityId);
      if (!entity) {
        console.warn(`实体 ${entityId} 不存在`);
        return false;
      }

      // 删除相关关系
      const relatedRelations = this.entityToRelations.get(entityId);
      if (relatedRelations) {
        for (const relationId of Array.from(relatedRelations)) {
          this.relationshipIndex.delete(relationId);
        }
        this.entityToRelations.delete(entityId);
      }

      // 从类型索引中移除
      const typeEntities = this.typeToEntities.get(entity.type);
      if (typeEntities) {
        typeEntities.delete(entityId);
        if (typeEntities.size === 0) {
          this.typeToEntities.delete(entity.type);
        }
      }

      // 从实体索引中移除
      this.entityIndex.delete(entityId);

      // 保存更改
      await this.saveLocalIndexes();
      await this.saveLocalRelationships();

      // 从云端删除（如果可用）
      if (this.entitiesCollection) {
        try {
          await this.entitiesCollection.delete({ ids: [entityId] });
        } catch (error) {
          console.warn('从云端删除实体失败:', error);
        }
      }

      console.log(`🗑️ 删除实体: ${entity.name}`);
      return true;

    } catch (error) {
      console.error('删除实体失败:', error);
      return false;
    }
  }

  /**
   * 获取实体关联的JIRA issues（如果配置了相关属性）
   */
  async getEntityJiraIssues(entityId: string): Promise<Array<{
    key: string;
    summary: string;
    status: string;
    assignee?: string;
    url: string;
  }>> {
    try {
      const entity = this.entityIndex.get(entityId);
      if (!entity) return [];

      // 检查实体属性中是否有JIRA相关信息
      const jiraKeys: string[] = [];
      
      if (entity.properties.jiraKeys) {
        jiraKeys.push(...entity.properties.jiraKeys);
      }
      
      if (entity.properties.jiraProjects) {
        // 这里可以根据项目名称查询相关的JIRA issues
        // 实际实现需要调用JIRA API
      }

      // 简化实现：返回存储在属性中的JIRA issues
      if (entity.properties.jiraIssues) {
        return entity.properties.jiraIssues;
      }

      return [];

    } catch (error) {
      console.error('获取实体JIRA issues失败:', error);
      return [];
    }
  }

  /**
   * 更新实体的JIRA关联
   */
  async updateEntityJiraAssociation(entityId: string, jiraData: {
    keys?: string[];
    projects?: string[];
    issues?: Array<{
      key: string;
      summary: string;
      status: string;
      assignee?: string;
      url: string;
    }>;
  }): Promise<boolean> {
    try {
      const entity = this.entityIndex.get(entityId);
      if (!entity) {
        console.warn(`实体 ${entityId} 不存在`);
        return false;
      }

      // 更新JIRA相关属性
      const updatedProperties = {
        ...entity.properties,
        ...jiraData,
        lastJiraSync: Date.now()
      };

      return await this.updateEntity(entityId, {
        properties: updatedProperties
      });

    } catch (error) {
      console.error('更新实体JIRA关联失败:', error);
      return false;
    }
  }

  /**
   * 销毁存储
   */
  destroy(): void {
    this.relationshipIndex.clear();
    this.entityToRelations.clear();
    this.typeToEntities.clear();
    this.entityIndex.clear();
    this.chromaClient = null;
    this.entitiesCollection = null;
  }
}

export default HybridGraphStore;