/**
 * 实体相似性管理器
 * 负责实体的相似性判断、自动合并和用户确认流程
 */

import { v4 as uuidv4 } from 'uuid';
import { callLLMJsonAPI } from '../llm';

export interface Entity {
  id: string;
  type: 'Person' | 'Project' | 'Task' | 'Topic' | 'Organization' | 'Document';
  name: string;
  properties: Record<string, any>;
  created: number;
  lastAccessed: number;
  accessCount: number;
  importance: number; // 0-1
}

export interface SimilarityResult {
  action: 'auto_merge' | 'mark_candidate' | 'create_new';
  targetEntity?: Entity;
  confidence: number;
  reasoning?: string;
}

export interface EntityMergePair {
  id: string;
  sourceEntity: Entity;
  targetEntity: Entity;
  similarity: number;
  suggestedAction: 'merge' | 'keep_separate';
  reasoning: string;
  created: number;
  status: 'pending' | 'approved' | 'rejected';
}

export interface ProcessedEntity extends Entity {
  action: 'auto_merge' | 'mark_candidate' | 'create_new';
  targetId?: string;
  mergeReason?: string;
}

/**
 * 实体ID生成器 - 混合策略实现
 */
export class EntityIdGenerator {
  /**
   * 生成实体ID：type_readable_name_uuid_suffix
   */
  generateId(entity: Pick<Entity, 'type' | 'name'>): string {
    const readablePart = this.generateReadablePart(entity.name);
    const uuidSuffix = this.generateShortUuid();
    
    return `${entity.type.toLowerCase()}_${readablePart}_${uuidSuffix}`;
  }

  private generateReadablePart(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fa5]/g, '_')  // 支持中文，替换特殊字符
      .replace(/_+/g, '_')  // 合并多个下划线
      .substring(0, 20)     // 限制长度
      .replace(/_$/, '');   // 移除末尾下划线
  }

  private generateShortUuid(): string {
    return uuidv4().split('-')[0];  // 使用UUID前8位
  }
}

/**
 * 实体相似性管理器
 */
export class EntitySimilarityManager {
  private idGenerator: EntityIdGenerator;
  private pendingMerges: Map<string, EntityMergePair> = new Map();
  private mergeCandidatesCache: Map<string, Entity[]> = new Map();
  
  // 相似性阈值配置
  private readonly THRESHOLDS = {
    AUTO_MERGE: 0.9,      // 自动合并阈值
    CANDIDATE_MARK: 0.7,  // 候选标记阈值
    DEEP_ANALYSIS: 0.75   // 深度分析确认阈值
  };

  constructor() {
    this.idGenerator = new EntityIdGenerator();
    this.loadPendingMerges();
  }

  /**
   * 处理新实体（主入口）
   */
  async processEntity(entity: Omit<Entity, 'id' | 'created' | 'lastAccessed' | 'accessCount'>): Promise<ProcessedEntity> {
    // 1. 生成ID和完整实体对象
    const fullEntity: Entity = {
      ...entity,
      id: this.idGenerator.generateId(entity),
      created: Date.now(),
      lastAccessed: Date.now(),
      accessCount: 1
    };

    // 2. 执行相似性检查
    const similarityResult = await this.quickSimilarityCheck(fullEntity);

    // 3. 根据结果返回处理后的实体
    const processedEntity: ProcessedEntity = {
      ...fullEntity,
      action: similarityResult.action
    };

    if (similarityResult.targetEntity) {
      processedEntity.targetId = similarityResult.targetEntity.id;
      processedEntity.mergeReason = `相似度: ${similarityResult.confidence.toFixed(2)} - ${similarityResult.reasoning}`;
    }

    // 4. 处理候选标记
    if (similarityResult.action === 'mark_candidate' && similarityResult.targetEntity) {
      await this.markAsCandidate(fullEntity, similarityResult.targetEntity, similarityResult.confidence);
    }

    console.log(`🔍 实体处理完成: ${fullEntity.name} -> ${similarityResult.action}`, {
      entityId: fullEntity.id,
      confidence: similarityResult.confidence,
      targetEntity: similarityResult.targetEntity?.name
    });

    return processedEntity;
  }

  /**
   * 批量处理实体
   */
  async processEntities(entities: Array<Omit<Entity, 'id' | 'created' | 'lastAccessed' | 'accessCount'>>): Promise<ProcessedEntity[]> {
    const results: ProcessedEntity[] = [];
    
    for (const entity of entities) {
      try {
        const processed = await this.processEntity(entity);
        results.push(processed);
        
        // 为避免API频率限制，添加小延迟
        if (entities.length > 5) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (error) {
        console.error(`处理实体失败: ${entity.name}`, error);
        // 失败时创建新实体
        results.push({
          ...entity,
          id: this.idGenerator.generateId(entity),
          created: Date.now(),
          lastAccessed: Date.now(),
          accessCount: 1,
          action: 'create_new'
        });
      }
    }

    return results;
  }

  /**
   * 实时简单相似性判断
   */
  async quickSimilarityCheck(newEntity: Entity): Promise<SimilarityResult> {
    try {
      // 1. 查找候选实体
      const candidates = await this.findCandidateEntities(newEntity);
      
      if (candidates.length === 0) {
        return { action: 'create_new', confidence: 0 };
      }

      // 2. 计算与每个候选的相似度
      let bestMatch: { entity: Entity; similarity: number } | null = null;

      for (const candidate of candidates) {
        const similarity = this.calculateQuickSimilarity(newEntity, candidate);
        
        if (!bestMatch || similarity > bestMatch.similarity) {
          bestMatch = { entity: candidate, similarity };
        }
      }

      if (!bestMatch) {
        return { action: 'create_new', confidence: 0 };
      }

      // 3. 根据阈值决定行动
      if (bestMatch.similarity > this.THRESHOLDS.AUTO_MERGE) {
        return {
          action: 'auto_merge',
          targetEntity: bestMatch.entity,
          confidence: bestMatch.similarity,
          reasoning: '高相似度自动合并'
        };
      } else if (bestMatch.similarity > this.THRESHOLDS.CANDIDATE_MARK) {
        return {
          action: 'mark_candidate',
          targetEntity: bestMatch.entity,
          confidence: bestMatch.similarity,
          reasoning: '中等相似度，标记为候选'
        };
      } else {
        return {
          action: 'create_new',
          confidence: bestMatch.similarity,
          reasoning: '相似度较低，创建新实体'
        };
      }

    } catch (error) {
      console.error('快速相似性检查失败:', error);
      return { action: 'create_new', confidence: 0, reasoning: '检查失败，创建新实体' };
    }
  }

  /**
   * 异步深度相似性分析
   */
  async deepSimilarityAnalysis(candidatePair: EntityMergePair): Promise<void> {
    try {
      console.log(`🧠 开始深度分析实体对: ${candidatePair.sourceEntity.name} vs ${candidatePair.targetEntity.name}`);
      
      const deepSimilarity = await this.calculateDeepSimilarity(
        candidatePair.sourceEntity,
        candidatePair.targetEntity
      );

      // 更新候选对信息
      candidatePair.similarity = deepSimilarity;

      if (deepSimilarity > this.THRESHOLDS.DEEP_ANALYSIS) {
        // 确认相似：自动合并并通知
        candidatePair.suggestedAction = 'merge';
        candidatePair.reasoning = `深度分析确认相似 (${deepSimilarity.toFixed(2)})`;
        
        await this.autoMergeWithNotification(candidatePair);
      } else {
        // 不确定：推送到用户界面
        candidatePair.suggestedAction = 'keep_separate';
        candidatePair.reasoning = `深度分析结果不确定 (${deepSimilarity.toFixed(2)})`;
        
        await this.pushToUserReview(candidatePair);
      }

    } catch (error) {
      console.error('深度相似性分析失败:', error);
      candidatePair.status = 'rejected';
      candidatePair.reasoning = `分析失败: ${error.message}`;
    }
  }

  /**
   * 查找候选实体
   */
  private async findCandidateEntities(entity: Entity): Promise<Entity[]> {
    // 从缓存中查找
    const cacheKey = `${entity.type}_${entity.name.substring(0, 10)}`;
    if (this.mergeCandidatesCache.has(cacheKey)) {
      return this.mergeCandidatesCache.get(cacheKey)!;
    }

    // 这里应该从实际的图存储中查询相同类型的实体
    // 暂时返回空数组，实际实现时需要连接到HybridGraphStore
    const candidates: Entity[] = [];
    
    // 缓存结果
    this.mergeCandidatesCache.set(cacheKey, candidates);
    
    return candidates;
  }

  /**
   * 计算快速相似度（基于规则）
   */
  private calculateQuickSimilarity(entity1: Entity, entity2: Entity): number {
    // 类型必须相同
    if (entity1.type !== entity2.type) {
      return 0;
    }

    // 名称相似度 (70%权重)
    const nameSimilarity = this.stringSimilarity(entity1.name, entity2.name);
    
    // 属性相似度 (30%权重)
    const propSimilarity = this.propertiesSimilarity(entity1.properties, entity2.properties);
    
    return nameSimilarity * 0.7 + propSimilarity * 0.3;
  }

  /**
   * 计算深度相似度（使用LLM）
   */
  private async calculateDeepSimilarity(entity1: Entity, entity2: Entity): Promise<number> {
    try {
      const prompt = `请分析这两个实体的相似度：

实体1:
- 类型: ${entity1.type}
- 名称: ${entity1.name}
- 属性: ${JSON.stringify(entity1.properties, null, 2)}

实体2:
- 类型: ${entity2.type}
- 名称: ${entity2.name}
- 属性: ${JSON.stringify(entity2.properties, null, 2)}

请返回0-1之间的相似度分数，并简要说明理由。格式：
{
  "similarity": 0.85,
  "reasoning": "两个实体都是同一个人，只是名字的写法不同"
}`;

      const response = await callLLMJsonAPI({ prompt });
      
      if (response && response.similarity !== undefined) {
        return Math.min(1, Math.max(0, response.similarity));
      }
      
      // 回退到快速相似度
      return this.calculateQuickSimilarity(entity1, entity2);

    } catch (error) {
      console.error('LLM深度分析失败:', error);
      return this.calculateQuickSimilarity(entity1, entity2);
    }
  }

  /**
   * 字符串相似度计算（简化版编辑距离）
   */
  private stringSimilarity(str1: string, str2: string): number {
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();
    
    if (s1 === s2) return 1.0;
    if (s1.length === 0 || s2.length === 0) return 0;
    
    // 包含关系
    if (s1.includes(s2) || s2.includes(s1)) {
      return 0.8;
    }
    
    // 简化的Jaccard相似度
    const set1 = new Set(s1.split(''));
    const set2 = new Set(s2.split(''));
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
  }

  /**
   * 属性相似度计算
   */
  private propertiesSimilarity(props1: Record<string, any>, props2: Record<string, any>): number {
    const keys1 = Object.keys(props1);
    const keys2 = Object.keys(props2);
    
    if (keys1.length === 0 && keys2.length === 0) return 1.0;
    if (keys1.length === 0 || keys2.length === 0) return 0.5;
    
    let matches = 0;
    let total = 0;
    
    const allKeys = new Set([...keys1, ...keys2]);
    
    for (const key of allKeys) {
      total++;
      if (props1[key] && props2[key]) {
        if (typeof props1[key] === 'string' && typeof props2[key] === 'string') {
          matches += this.stringSimilarity(props1[key], props2[key]);
        } else if (props1[key] === props2[key]) {
          matches += 1;
        } else {
          matches += 0.3; // 有值但不同
        }
      } else if (props1[key] || props2[key]) {
        matches += 0.1; // 只有一方有值
      }
    }
    
    return total > 0 ? matches / total : 0;
  }

  /**
   * 标记为候选（待深度分析）
   */
  private async markAsCandidate(sourceEntity: Entity, targetEntity: Entity, similarity: number): Promise<void> {
    const candidatePair: EntityMergePair = {
      id: uuidv4(),
      sourceEntity,
      targetEntity,
      similarity,
      suggestedAction: 'merge',
      reasoning: '初步相似性检查标记为候选',
      created: Date.now(),
      status: 'pending'
    };

    this.pendingMerges.set(candidatePair.id, candidatePair);
    
    // 异步执行深度分析
    setTimeout(() => {
      this.deepSimilarityAnalysis(candidatePair).catch(console.error);
    }, 1000);
  }

  /**
   * 自动合并并通知用户
   */
  private async autoMergeWithNotification(candidatePair: EntityMergePair): Promise<void> {
    console.log(`🔄 自动合并实体: ${candidatePair.sourceEntity.name} -> ${candidatePair.targetEntity.name}`);
    
    candidatePair.status = 'approved';
    
    // 这里应该发送通知给用户
    // 暂时只记录日志
    console.log(`✅ 实体自动合并完成: ${candidatePair.reasoning}`);
  }

  /**
   * 推送到用户审核界面
   */
  private async pushToUserReview(candidatePair: EntityMergePair): Promise<void> {
    console.log(`📋 推送到用户审核: ${candidatePair.sourceEntity.name} vs ${candidatePair.targetEntity.name}`);
    
    // 存储到Chrome storage供实体记忆查询界面使用
    try {
      const { pendingEntityMerges = [] } = await chrome.storage.local.get('pendingEntityMerges');
      pendingEntityMerges.push(candidatePair);
      
      await chrome.storage.local.set({ pendingEntityMerges });
      
      console.log(`📝 候选合并已保存到用户审核队列`);
    } catch (error) {
      console.error('保存待审核合并失败:', error);
    }
  }

  /**
   * 获取待审核的合并
   */
  async getPendingMerges(): Promise<EntityMergePair[]> {
    try {
      const { pendingEntityMerges = [] } = await chrome.storage.local.get('pendingEntityMerges');
      return pendingEntityMerges;
    } catch (error) {
      console.error('获取待审核合并失败:', error);
      return [];
    }
  }

  /**
   * 用户确认合并
   */
  async confirmMerge(mergeId: string): Promise<boolean> {
    try {
      const { pendingEntityMerges = [] } = await chrome.storage.local.get('pendingEntityMerges');
      const mergeIndex = pendingEntityMerges.findIndex((m: EntityMergePair) => m.id === mergeId);
      
      if (mergeIndex !== -1) {
        pendingEntityMerges[mergeIndex].status = 'approved';
        await chrome.storage.local.set({ pendingEntityMerges });
        
        console.log(`✅ 用户确认合并: ${pendingEntityMerges[mergeIndex].sourceEntity.name}`);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('确认合并失败:', error);
      return false;
    }
  }

  /**
   * 用户拒绝合并
   */
  async rejectMerge(mergeId: string): Promise<boolean> {
    try {
      const { pendingEntityMerges = [] } = await chrome.storage.local.get('pendingEntityMerges');
      const mergeIndex = pendingEntityMerges.findIndex((m: EntityMergePair) => m.id === mergeId);
      
      if (mergeIndex !== -1) {
        pendingEntityMerges[mergeIndex].status = 'rejected';
        await chrome.storage.local.set({ pendingEntityMerges });
        
        console.log(`❌ 用户拒绝合并: ${pendingEntityMerges[mergeIndex].sourceEntity.name}`);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('拒绝合并失败:', error);
      return false;
    }
  }

  /**
   * 加载待处理的合并
   */
  private async loadPendingMerges(): Promise<void> {
    try {
      const merges = await this.getPendingMerges();
      for (const merge of merges) {
        if (merge.status === 'pending') {
          this.pendingMerges.set(merge.id, merge);
        }
      }
    } catch (error) {
      console.error('加载待处理合并失败:', error);
    }
  }

  /**
   * 调整合并阈值
   */
  adjustThresholds(newThresholds: Partial<typeof this.THRESHOLDS>): void {
    Object.assign(this.THRESHOLDS, newThresholds);
    console.log('🔧 实体合并阈值已调整:', this.THRESHOLDS);
  }

  /**
   * 获取统计信息
   */
  getStatistics(): {
    pendingMerges: number;
    autoMerged: number;
    userReviewed: number;
    thresholds: typeof this.THRESHOLDS;
  } {
    return {
      pendingMerges: this.pendingMerges.size,
      autoMerged: 0, // 需要从存储中统计
      userReviewed: 0, // 需要从存储中统计
      thresholds: { ...this.THRESHOLDS }
    };
  }
}

export default EntitySimilarityManager;
