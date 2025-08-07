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
      
      // 2. 加载本地关系索引
      await this.loadLocalRelationships();
      
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

      // 2. 更新本地类型索引
      if (!this.typeToEntities.has(entity.type)) {
        this.typeToEntities.set(entity.type, new Set());
      }
      this.typeToEntities.get(entity.type)!.add(entity.id);

      // 3. 保存本地索引
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
        
        for (const relationId of entityRelations) {
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
        for (const relation of this.relationshipIndex.values()) {
          localEntityIds.add(relation.fromId);
          localEntityIds.add(relation.toId);
        }

        // 3. 为不存在的实体创建占位符并上传
        for (const entityId of localEntityIds) {
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
        localEntities: this.typeToEntities.size,
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
          entityCount: this.typeToEntities.size
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
    // 本地只有类型索引，无法进行复杂搜索
    // 这里返回类型匹配的实体ID，实际实体数据需要从ChromaDB获取
    const results: GraphEntity[] = [];
    
    if (options.type) {
      const entityIds = this.typeToEntities.get(options.type) || new Set();
      // 注意：这里需要从ChromaDB获取实际实体数据
      // 为了简化，这里返回空数组，实际应用中需要实现
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
   * 保存本地索引
   */
  private async saveLocalIndexes(): Promise<void> {
    try {
      const data = {
        typeToEntities: Array.from(this.typeToEntities.entries())
          .map(([key, value]) => [key, Array.from(value)])
      };
      
      await chrome.storage.local.set({ graphIndexes: data });
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

    // 如果超过24小时未同步，自动执行同步
    if (Date.now() - this.lastSyncTime > 24 * 60 * 60 * 1000) {
      console.log('⏰ 超过24小时未同步，执行自动同步...');
      await this.performSync();
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
      localEntities: this.typeToEntities.size,
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
   * 清理过期数据
   */
  async cleanup(retentionDays: number = 180): Promise<number> {
    const cutoffTime = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);
    let cleanedCount = 0;

    // 清理过期关系
    for (const [id, relationship] of this.relationshipIndex) {
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
    
    for (const relationship of this.relationshipIndex.values()) {
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
   * 销毁存储
   */
  destroy(): void {
    this.relationshipIndex.clear();
    this.entityToRelations.clear();
    this.typeToEntities.clear();
    this.chromaClient = null;
    this.entitiesCollection = null;
  }
}

export default HybridGraphStore;