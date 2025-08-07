/**
 * 知识图谱存储管理器
 * 处理实体关系和复杂查询
 */

export interface Entity {
  id: string;
  type: 'Person' | 'Project' | 'Task' | 'Organization' | 'Document' | 'Technology' | 'Topic';
  name: string;
  properties: Record<string, any>;
  created: number;
  updated: number;
}

export interface Relationship {
  id: string;
  type: string;
  fromId: string;
  toId: string;
  properties: Record<string, any>;
  strength: number; // 0-1
  created: number;
  updated: number;
}

export interface GraphQueryResult {
  entities: Entity[];
  relationships: Relationship[];
  paths?: any[];
}

/**
 * 轻量级知识图谱存储 (基于Chrome Storage)
 * 后续可以升级为Neo4j或ArangoDB
 */
export class KnowledgeGraphStore {
  private entities: Map<string, Entity> = new Map();
  private relationships: Map<string, Relationship> = new Map();
  private entityIndex: Map<string, Set<string>> = new Map(); // type -> entity ids
  private relationshipIndex: Map<string, Set<string>> = new Map(); // type -> relationship ids

  /**
   * 初始化知识图谱存储
   */
  async initialize(): Promise<boolean> {
    try {
      await this.loadFromStorage();
      console.log('✅ 知识图谱存储初始化完成');
      return true;
    } catch (error) {
      console.error('❌ 知识图谱存储初始化失败:', error);
      return false;
    }
  }

  /**
   * 创建或更新实体
   */
  async upsertEntity(entity: Omit<Entity, 'created' | 'updated'>): Promise<Entity> {
    const now = Date.now();
    const existingEntity = this.entities.get(entity.id);
    
    const fullEntity: Entity = {
      ...entity,
      created: existingEntity?.created || now,
      updated: now
    };

    this.entities.set(entity.id, fullEntity);
    
    // 更新类型索引
    if (!this.entityIndex.has(entity.type)) {
      this.entityIndex.set(entity.type, new Set());
    }
    this.entityIndex.get(entity.type)!.add(entity.id);

    await this.saveToStorage();
    console.log(`📝 实体已保存: ${entity.type}(${entity.name})`);
    
    return fullEntity;
  }

  /**
   * 创建关系
   */
  async createRelationship(relationship: Omit<Relationship, 'id' | 'created' | 'updated'>): Promise<Relationship> {
    const now = Date.now();
    const id = `rel_${relationship.fromId}_${relationship.toId}_${relationship.type}_${now}`;
    
    const fullRelationship: Relationship = {
      ...relationship,
      id,
      created: now,
      updated: now
    };

    this.relationships.set(id, fullRelationship);
    
    // 更新关系类型索引
    if (!this.relationshipIndex.has(relationship.type)) {
      this.relationshipIndex.set(relationship.type, new Set());
    }
    this.relationshipIndex.get(relationship.type)!.add(id);

    await this.saveToStorage();
    console.log(`🔗 关系已创建: ${relationship.type}(${relationship.fromId} -> ${relationship.toId})`);
    
    return fullRelationship;
  }

  /**
   * 查询实体
   */
  queryEntities(options: {
    type?: string;
    name?: string;
    properties?: Record<string, any>;
    limit?: number;
  }): Entity[] {
    let results: Entity[] = [];

    if (options.type) {
      const entityIds = this.entityIndex.get(options.type) || new Set();
      results = Array.from(entityIds).map(id => this.entities.get(id)!).filter(Boolean);
    } else {
      results = Array.from(this.entities.values());
    }

    // 按名称过滤
    if (options.name) {
      const searchName = options.name.toLowerCase();
      results = results.filter(entity => 
        entity.name.toLowerCase().includes(searchName)
      );
    }

    // 按属性过滤
    if (options.properties) {
      results = results.filter(entity => {
        return Object.entries(options.properties!).every(([key, value]) => {
          return entity.properties[key] === value;
        });
      });
    }

    // 限制结果数量
    if (options.limit) {
      results = results.slice(0, options.limit);
    }

    return results;
  }

  /**
   * 查询关系
   */
  queryRelationships(options: {
    type?: string;
    fromId?: string;
    toId?: string;
    limit?: number;
  }): Relationship[] {
    let results: Relationship[] = [];

    if (options.type) {
      const relationshipIds = this.relationshipIndex.get(options.type) || new Set();
      results = Array.from(relationshipIds).map(id => this.relationships.get(id)!).filter(Boolean);
    } else {
      results = Array.from(this.relationships.values());
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
   * 查找实体的所有邻居
   */
  findNeighbors(entityId: string, options?: {
    relationTypes?: string[];
    direction?: 'in' | 'out' | 'both';
    maxDepth?: number;
  }): GraphQueryResult {
    const direction = options?.direction || 'both';
    const maxDepth = options?.maxDepth || 1;
    const relationTypes = options?.relationTypes;

    const visitedEntities = new Set<string>();
    const visitedRelationships = new Set<string>();
    const resultEntities: Entity[] = [];
    const resultRelationships: Relationship[] = [];

    const traverse = (currentEntityId: string, depth: number) => {
      if (depth > maxDepth || visitedEntities.has(currentEntityId)) {
        return;
      }

      visitedEntities.add(currentEntityId);
      const entity = this.entities.get(currentEntityId);
      if (entity) {
        resultEntities.push(entity);
      }

      if (depth < maxDepth) {
        // 查找出向关系
        if (direction === 'out' || direction === 'both') {
          const outRelations = this.queryRelationships({ fromId: currentEntityId });
          for (const rel of outRelations) {
            if (relationTypes && !relationTypes.includes(rel.type)) continue;
            if (!visitedRelationships.has(rel.id)) {
              visitedRelationships.add(rel.id);
              resultRelationships.push(rel);
              traverse(rel.toId, depth + 1);
            }
          }
        }

        // 查找入向关系
        if (direction === 'in' || direction === 'both') {
          const inRelations = this.queryRelationships({ toId: currentEntityId });
          for (const rel of inRelations) {
            if (relationTypes && !relationTypes.includes(rel.type)) continue;
            if (!visitedRelationships.has(rel.id)) {
              visitedRelationships.add(rel.id);
              resultRelationships.push(rel);
              traverse(rel.fromId, depth + 1);
            }
          }
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
   * 查找两个实体之间的路径
   */
  findPath(fromId: string, toId: string, maxDepth: number = 3): GraphQueryResult | null {
    const visited = new Set<string>();
    const path: { entities: Entity[], relationships: Relationship[] } = {
      entities: [],
      relationships: []
    };

    const dfs = (currentId: string, targetId: string, depth: number): boolean => {
      if (depth > maxDepth || visited.has(currentId)) {
        return false;
      }

      visited.add(currentId);
      const entity = this.entities.get(currentId);
      if (entity) {
        path.entities.push(entity);
      }

      if (currentId === targetId) {
        return true; // 找到目标
      }

      // 探索所有出向关系
      const relations = this.queryRelationships({ fromId: currentId });
      for (const rel of relations) {
        path.relationships.push(rel);
        if (dfs(rel.toId, targetId, depth + 1)) {
          return true;
        }
        path.relationships.pop(); // 回溯
      }

      path.entities.pop(); // 回溯
      visited.delete(currentId);
      return false;
    };

    if (dfs(fromId, toId, 0)) {
      return {
        entities: [...path.entities],
        relationships: [...path.relationships],
        paths: [{ entities: path.entities, relationships: path.relationships }]
      };
    }

    return null;
  }

  /**
   * 从消息中提取实体和关系
   */
  async extractFromMessage(messageData: {
    messageId: string;
    content: string;
    source: string;
    entities?: any;
    relationships?: any[];
  }): Promise<{ entities: Entity[], relationships: Relationship[] }> {
    const createdEntities: Entity[] = [];
    const createdRelationships: Relationship[] = [];

    try {
      // 创建发送者实体
      const senderEntity = await this.upsertEntity({
        id: `person_${messageData.source}`,
        type: 'Person',
        name: messageData.source,
        properties: {
          lastActive: Date.now(),
          messageCount: 1
        }
      });
      createdEntities.push(senderEntity);

      // 处理提取的实体
      if (messageData.entities) {
        // 处理项目实体
        if (messageData.entities.projects) {
          for (const project of messageData.entities.projects) {
            const projectEntity = await this.upsertEntity({
              id: `project_${project.name.replace(/\s+/g, '_').toLowerCase()}`,
              type: 'Project',
              name: project.name,
              properties: {
                status: project.status || 'unknown',
                lastMentioned: Date.now()
              }
            });
            createdEntities.push(projectEntity);

            // 创建人员-项目关系
            const relationship = await this.createRelationship({
              type: 'MENTIONS',
              fromId: senderEntity.id,
              toId: projectEntity.id,
              properties: {
                messageId: messageData.messageId,
                context: messageData.content.substring(0, 200)
              },
              strength: 0.8
            });
            createdRelationships.push(relationship);
          }
        }

        // 处理人员实体
        if (messageData.entities.people) {
          for (const person of messageData.entities.people) {
            const personEntity = await this.upsertEntity({
              id: `person_${person.name.replace(/\s+/g, '_').toLowerCase()}`,
              type: 'Person',
              name: person.name,
              properties: {
                role: person.role,
                lastMentioned: Date.now()
              }
            });
            createdEntities.push(personEntity);

            // 创建人员间关系
            if (personEntity.id !== senderEntity.id) {
              const relationship = await this.createRelationship({
                type: 'MENTIONS',
                fromId: senderEntity.id,
                toId: personEntity.id,
                properties: {
                  messageId: messageData.messageId,
                  context: person.mentioned_context || ''
                },
                strength: 0.7
              });
              createdRelationships.push(relationship);
            }
          }
        }

        // 处理话题实体
        if (messageData.entities.topics) {
          for (const topic of messageData.entities.topics) {
            const topicEntity = await this.upsertEntity({
              id: `topic_${topic.name.replace(/\s+/g, '_').toLowerCase()}`,
              type: 'Topic',
              name: topic.name,
              properties: {
                category: topic.category,
                lastDiscussed: Date.now()
              }
            });
            createdEntities.push(topicEntity);

            // 创建人员-话题关系
            const relationship = await this.createRelationship({
              type: 'DISCUSSES',
              fromId: senderEntity.id,
              toId: topicEntity.id,
              properties: {
                messageId: messageData.messageId
              },
              strength: 0.6
            });
            createdRelationships.push(relationship);
          }
        }
      }

      // 处理显式关系
      if (messageData.relationships) {
        for (const rel of messageData.relationships) {
          const relationship = await this.createRelationship({
            type: rel.relationship.toUpperCase(),
            fromId: `person_${rel.source.replace(/\s+/g, '_').toLowerCase()}`,
            toId: `person_${rel.target.replace(/\s+/g, '_').toLowerCase()}`,
            properties: {
              messageId: messageData.messageId,
              context: messageData.content.substring(0, 200)
            },
            strength: 0.9
          });
          createdRelationships.push(relationship);
        }
      }

    } catch (error) {
      console.error('从消息提取实体关系失败:', error);
    }

    return { entities: createdEntities, relationships: createdRelationships };
  }

  /**
   * 获取图谱统计信息
   */
  getStatistics(): {
    entityCount: number;
    relationshipCount: number;
    entityTypes: Record<string, number>;
    relationshipTypes: Record<string, number>;
  } {
    const entityTypes: Record<string, number> = {};
    const relationshipTypes: Record<string, number> = {};

    // 统计实体类型
    for (const entity of this.entities.values()) {
      entityTypes[entity.type] = (entityTypes[entity.type] || 0) + 1;
    }

    // 统计关系类型
    for (const relationship of this.relationships.values()) {
      relationshipTypes[relationship.type] = (relationshipTypes[relationship.type] || 0) + 1;
    }

    return {
      entityCount: this.entities.size,
      relationshipCount: this.relationships.size,
      entityTypes,
      relationshipTypes
    };
  }

  /**
   * 保存到Chrome Storage
   */
  private async saveToStorage(): Promise<void> {
    try {
      const data = {
        entities: Array.from(this.entities.entries()),
        relationships: Array.from(this.relationships.entries()),
        entityIndex: Array.from(this.entityIndex.entries()).map(([key, value]) => [key, Array.from(value)]),
        relationshipIndex: Array.from(this.relationshipIndex.entries()).map(([key, value]) => [key, Array.from(value)])
      };

      await chrome.storage.local.set({ knowledgeGraph: data });
    } catch (error) {
      console.error('保存知识图谱失败:', error);
    }
  }

  /**
   * 从Chrome Storage加载
   */
  private async loadFromStorage(): Promise<void> {
    try {
      const { knowledgeGraph } = await chrome.storage.local.get('knowledgeGraph');
      
      if (knowledgeGraph) {
        // 恢复实体
        this.entities = new Map(knowledgeGraph.entities || []);
        
        // 恢复关系
        this.relationships = new Map(knowledgeGraph.relationships || []);
        
        // 恢复索引
        this.entityIndex = new Map(
          (knowledgeGraph.entityIndex || []).map(([key, value]) => [key, new Set(value)])
        );
        this.relationshipIndex = new Map(
          (knowledgeGraph.relationshipIndex || []).map(([key, value]) => [key, new Set(value)])
        );

        console.log(`📚 已加载知识图谱: ${this.entities.size}个实体, ${this.relationships.size}个关系`);
      }
    } catch (error) {
      console.error('加载知识图谱失败:', error);
    }
  }

  /**
   * 清理过期数据
   */
  async cleanup(retentionDays: number = 180): Promise<number> {
    const cutoffTime = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);
    let cleanedCount = 0;

    // 清理过期关系
    for (const [id, relationship] of this.relationships) {
      if (relationship.created < cutoffTime && relationship.strength < 0.3) {
        this.relationships.delete(id);
        cleanedCount++;
      }
    }

    // 清理孤立实体
    const referencedEntities = new Set<string>();
    for (const relationship of this.relationships.values()) {
      referencedEntities.add(relationship.fromId);
      referencedEntities.add(relationship.toId);
    }

    for (const [id, entity] of this.entities) {
      if (!referencedEntities.has(id) && entity.created < cutoffTime) {
        this.entities.delete(id);
        cleanedCount++;
      }
    }

    // 重建索引
    await this.rebuildIndexes();
    await this.saveToStorage();

    console.log(`🧹 知识图谱清理完成，删除${cleanedCount}个过期项`);
    return cleanedCount;
  }

  /**
   * 重建索引
   */
  private async rebuildIndexes(): Promise<void> {
    this.entityIndex.clear();
    this.relationshipIndex.clear();

    // 重建实体索引
    for (const entity of this.entities.values()) {
      if (!this.entityIndex.has(entity.type)) {
        this.entityIndex.set(entity.type, new Set());
      }
      this.entityIndex.get(entity.type)!.add(entity.id);
    }

    // 重建关系索引
    for (const relationship of this.relationships.values()) {
      if (!this.relationshipIndex.has(relationship.type)) {
        this.relationshipIndex.set(relationship.type, new Set());
      }
      this.relationshipIndex.get(relationship.type)!.add(relationship.id);
    }
  }

  /**
   * 销毁图谱存储
   */
  destroy(): void {
    this.entities.clear();
    this.relationships.clear();
    this.entityIndex.clear();
    this.relationshipIndex.clear();
  }
}

export default KnowledgeGraphStore;