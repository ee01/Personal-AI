/**
 * 实体相似性管理工具
 * 负责实体的相似性判断、自动合并和用户确认流程
 */

import { MemoryEntity } from '../memory';

export interface SimilarityResult {
  action: 'auto_merge' | 'mark_candidate' | 'create_new';
  targetEntity?: MemoryEntity;
  confidence: number;
  reasoning?: string;
}

export interface EntityMergePair {
  id: string;
  sourceEntity: MemoryEntity;
  targetEntity: MemoryEntity;
  similarity: number;
  suggestedAction: 'merge' | 'keep_separate';
  reasoning: string;
  created: number;
  status: 'pending' | 'approved' | 'rejected';
}

export interface ProcessedEntity extends MemoryEntity {
  action: 'auto_merge' | 'mark_candidate' | 'create_new';
  targetId?: string;
  mergeReason?: string;
}

/**
 * 实体ID生成器
 */
export class EntityIdGenerator {
  private counter = 0;

  generateId(entity: Pick<MemoryEntity, 'type' | 'name'>): string {
    const timestamp = Date.now();
    const readable = this.generateReadablePart(entity.name);
    const shortUuid = this.generateShortUuid();
    return `${entity.type.toLowerCase()}_${readable}_${timestamp}_${shortUuid}`;
  }

  private generateReadablePart(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^\w\u4e00-\u9fff]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .substring(0, 10);
  }

  private generateShortUuid(): string {
    return Math.random().toString(36).substr(2, 8);
  }
}

/**
 * 实体相似性管理器
 */
export class EntitySimilarityTool {
  private idGenerator: EntityIdGenerator;
  private pendingMerges: Map<string, EntityMergePair> = new Map();
  private mergeCandidatesCache: Map<string, MemoryEntity[]> = new Map();
  
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
  async processEntity(entity: Omit<MemoryEntity, 'id' | 'created' | 'updated'>): Promise<ProcessedEntity> {
    const now = Date.now();
    const generatedId = this.idGenerator.generateId(entity);
    
    const fullEntity: MemoryEntity = {
      ...entity,
      id: generatedId,
      created: now,
      updated: now,
      accessCount: 0,
      lastAccessed: now,
      importance: entity.importance || 0.5
    };

    // 进行相似性检查
    const similarityResult = await this.quickSimilarityCheck(fullEntity);
    
    const processedEntity: ProcessedEntity = {
      ...fullEntity,
      action: similarityResult.action,
      targetId: similarityResult.targetEntity?.id,
      mergeReason: similarityResult.reasoning
    };

    return processedEntity;
  }

  /**
   * 批量处理实体
   */
  async processEntities(entities: Array<Omit<MemoryEntity, 'id' | 'created' | 'updated'>>): Promise<ProcessedEntity[]> {
    const results: ProcessedEntity[] = [];
    
    for (const entity of entities) {
      try {
        const processed = await this.processEntity(entity);
        results.push(processed);
      } catch (error) {
        console.error('处理实体失败:', error);
        // 继续处理其他实体
      }
    }

    return results;
  }

  /**
   * 实时简单相似性判断
   */
  async quickSimilarityCheck(newEntity: MemoryEntity): Promise<SimilarityResult> {
    try {
      // 1. 查找候选实体
      const candidates = await this.findCandidateEntities(newEntity);
      
      if (candidates.length === 0) {
        return { action: 'create_new', confidence: 0 };
      }

      // 2. 计算与每个候选的相似度
      let bestMatch: { entity: MemoryEntity; similarity: number } | null = null;

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
   * 查找候选实体（简化版本）
   */
  private async findCandidateEntities(entity: MemoryEntity): Promise<MemoryEntity[]> {
    // 这里是简化版本，实际实现中需要从缓存中查找相同类型的实体
    const cacheKey = `candidates_${entity.type}`;
    
    if (this.mergeCandidatesCache.has(cacheKey)) {
      return this.mergeCandidatesCache.get(cacheKey)!;
    }

    // 在实际实现中，这里应该从 LocalCache 中获取相同类型的实体
    // 暂时返回空数组
    return [];
  }

  /**
   * 计算快速相似度
   */
  private calculateQuickSimilarity(entity1: MemoryEntity, entity2: MemoryEntity): number {
    let similarity = 0;

    // 类型必须相同
    if (entity1.type !== entity2.type) {
      return 0;
    }

    // 名称相似度（权重50%）
    const nameSimilarity = this.stringSimilarity(entity1.name, entity2.name);
    similarity += nameSimilarity * 0.5;

    // 描述相似度（权重30%）
    if (entity1.description && entity2.description) {
      const descSimilarity = this.stringSimilarity(entity1.description, entity2.description);
      similarity += descSimilarity * 0.3;
    }

    // 属性相似度（权重20%）
    const propsSimilarity = this.propertiesSimilarity(entity1.properties, entity2.properties);
    similarity += propsSimilarity * 0.2;

    return similarity;
  }

  /**
   * 字符串相似度计算
   */
  private stringSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 1;
    if (!str1 || !str2) return 0;

    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1;

    // 简化的编辑距离算法
    const editDistance = this.levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * 计算编辑距离
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * 属性相似度计算
   */
  private propertiesSimilarity(props1: Record<string, any>, props2: Record<string, any>): number {
    const keys1 = Object.keys(props1);
    const keys2 = Object.keys(props2);
    const allKeys = new Set([...keys1, ...keys2]);

    if (allKeys.size === 0) return 1;

    let matchingProps = 0;
    for (const key of allKeys) {
      const val1 = props1[key];
      const val2 = props2[key];

      if (val1 !== undefined && val2 !== undefined) {
        if (typeof val1 === 'string' && typeof val2 === 'string') {
          const similarity = this.stringSimilarity(val1, val2);
          if (similarity > 0.8) matchingProps++;
        } else if (val1 === val2) {
          matchingProps++;
        }
      }
    }

    return matchingProps / allKeys.size;
  }

  /**
   * 获取待处理的合并候选
   */
  async getPendingMerges(): Promise<EntityMergePair[]> {
    return Array.from(this.pendingMerges.values());
  }

  /**
   * 确认合并
   */
  async confirmMerge(mergeId: string): Promise<boolean> {
    const mergePair = this.pendingMerges.get(mergeId);
    if (!mergePair) return false;

    try {
      mergePair.status = 'approved';
      await this.savePendingMerges();
      return true;
    } catch (error) {
      console.error('确认合并失败:', error);
      return false;
    }
  }

  /**
   * 拒绝合并
   */
  async rejectMerge(mergeId: string): Promise<boolean> {
    const mergePair = this.pendingMerges.get(mergeId);
    if (!mergePair) return false;

    try {
      mergePair.status = 'rejected';
      this.pendingMerges.delete(mergeId);
      await this.savePendingMerges();
      return true;
    } catch (error) {
      console.error('拒绝合并失败:', error);
      return false;
    }
  }

  /**
   * 保存待处理合并到存储
   */
  private async savePendingMerges(): Promise<void> {
    try {
      const data = Array.from(this.pendingMerges.entries());
      await chrome.storage.local.set({ 'pending_entity_merges': data });
    } catch (error) {
      console.error('保存待处理合并失败:', error);
    }
  }

  /**
   * 从存储加载待处理合并
   */
  private async loadPendingMerges(): Promise<void> {
    try {
      const result = await chrome.storage.local.get('pending_entity_merges');
      if (result.pending_entity_merges) {
        this.pendingMerges = new Map(result.pending_entity_merges);
      }
    } catch (error) {
      console.error('加载待处理合并失败:', error);
    }
  }

  /**
   * 调整阈值
   */
  adjustThresholds(newThresholds: Partial<typeof this.THRESHOLDS>): void {
    Object.assign(this.THRESHOLDS, newThresholds);
  }

  /**
   * 获取统计信息
   */
  getStatistics(): {
    pendingMerges: number;
    thresholds: typeof this.THRESHOLDS;
  } {
    return {
      pendingMerges: this.pendingMerges.size,
      thresholds: { ...this.THRESHOLDS }
    };
  }
}

// 导出单例实例
export const entitySimilarityTool = new EntitySimilarityTool();
