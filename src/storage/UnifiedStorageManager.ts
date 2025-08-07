/**
 * 统一存储管理器
 * 协调所有存储层，提供统一的数据访问接口
 */

import EnhancedVectorStore from './EnhancedVectorStore';
import KnowledgeGraphStore from './KnowledgeGraphStore';
import { MemoryLifecycleManager } from '../memory-management/MemoryLifecycleManager';

export interface StorageConfig {
  vectorStore: {
    enabled: boolean;
    chromaUrl?: string;
  };
  knowledgeGraph: {
    enabled: boolean;
    engine?: 'chrome_storage' | 'neo4j' | 'arangodb';
  };
  memoryLifecycle: {
    enabled: boolean;
    retentionDays?: number;
    cleanupInterval?: number; // hours
  };
}

export interface UnifiedSearchOptions {
  query: string;
  searchTargets: ('vector' | 'graph' | 'memory')[];
  filters?: {
    contentType?: string[];
    dateRange?: { start: number; end: number };
    entities?: string[];
    collections?: string[];
  };
  limit?: number;
  includeRelations?: boolean;
}

export interface UnifiedSearchResult {
  vectorResults?: any[];
  graphResults?: any[];
  memoryResults?: any[];
  combinedScore?: number;
  totalResults: number;
  searchTime: number;
}

export interface StorageHealthStatus {
  vectorStore: {
    status: 'healthy' | 'warning' | 'error';
    collections: number;
    documents: number;
    lastCleanup: number;
    issues?: string[];
  };
  knowledgeGraph: {
    status: 'healthy' | 'warning' | 'error';
    entities: number;
    relationships: number;
    lastUpdate: number;
    issues?: string[];
  };
  memoryLifecycle: {
    status: 'healthy' | 'warning' | 'error';
    totalMemories: number;
    forgottenToday: number;
    nextCleanup: number;
    issues?: string[];
  };
  overall: 'healthy' | 'warning' | 'error';
}

/**
 * 统一存储管理器
 */
export class UnifiedStorageManager {
  private vectorStore: EnhancedVectorStore;
  private knowledgeGraph: KnowledgeGraphStore;
  private memoryManager: MemoryLifecycleManager;
  private config: StorageConfig;
  private isInitialized = false;

  constructor(config: StorageConfig) {
    this.config = config;
    this.vectorStore = new EnhancedVectorStore();
    this.knowledgeGraph = new KnowledgeGraphStore();
    this.memoryManager = new MemoryLifecycleManager();
  }

  /**
   * 初始化所有存储层
   */
  async initialize(): Promise<boolean> {
    console.log('🚀 初始化统一存储管理器...');
    
    try {
      const results: boolean[] = [];

      // 初始化向量存储
      if (this.config.vectorStore.enabled) {
        console.log('📊 初始化向量存储...');
        const vectorResult = await this.vectorStore.initialize();
        results.push(vectorResult);
        if (!vectorResult) {
          console.warn('⚠️ 向量存储初始化失败');
        }
      }

      // 初始化知识图谱
      if (this.config.knowledgeGraph.enabled) {
        console.log('🕸️ 初始化知识图谱...');
        const graphResult = await this.knowledgeGraph.initialize();
        results.push(graphResult);
        if (!graphResult) {
          console.warn('⚠️ 知识图谱初始化失败');
        }
      }

      // 初始化记忆管理器
      if (this.config.memoryLifecycle.enabled) {
        console.log('🧠 初始化记忆生命周期管理...');
        // MemoryLifecycleManager不需要异步初始化
        results.push(true);
      }

      this.isInitialized = results.some(r => r); // 至少一个存储层成功初始化
      
      if (this.isInitialized) {
        console.log('✅ 统一存储管理器初始化完成');
        
        // 启动定期维护任务
        this.startMaintenanceTasks();
      } else {
        console.error('❌ 所有存储层初始化失败');
      }

      return this.isInitialized;

    } catch (error) {
      console.error('❌ 统一存储管理器初始化失败:', error);
      return false;
    }
  }

  /**
   * 存储消息数据（完整流程）
   */
  async storeMessage(messageData: {
    messageId: string;
    content: string;
    metadata: any;
  }): Promise<{
    vectorStored: boolean;
    graphEntities: number;
    graphRelationships: number;
    memoryStored: boolean;
  }> {
    const result = {
      vectorStored: false,
      graphEntities: 0,
      graphRelationships: 0,
      memoryStored: false
    };

    try {
      // 1. 存储到向量数据库
      if (this.config.vectorStore.enabled) {
        result.vectorStored = await this.vectorStore.storeMessage(
          messageData.messageId,
          messageData.content,
          messageData.metadata
        );
      }

      // 2. 提取实体和关系到知识图谱
      if (this.config.knowledgeGraph.enabled) {
        const graphData = await this.knowledgeGraph.extractFromMessage({
          messageId: messageData.messageId,
          content: messageData.content,
          source: messageData.metadata.source,
          entities: messageData.metadata.entities,
          relationships: messageData.metadata.relationships
        });
        
        result.graphEntities = graphData.entities.length;
        result.graphRelationships = graphData.relationships.length;
      }

      // 3. 创建记忆条目
      if (this.config.memoryLifecycle.enabled && result.vectorStored) {
        // 记忆管理器会在定时任务中处理
        result.memoryStored = true;
      }

      console.log(`💾 消息存储完成: ${messageData.messageId}`, result);
      return result;

    } catch (error) {
      console.error('❌ 消息存储失败:', error);
      return result;
    }
  }

  /**
   * 存储网页分析结果
   */
  async storeWebpage(webpageData: {
    webpageId: string;
    content: string;
    analysisResult: any;
  }): Promise<{
    vectorStored: boolean;
    graphEntities: number;
    memoryStored: boolean;
  }> {
    const result = {
      vectorStored: false,
      graphEntities: 0,
      memoryStored: false
    };

    try {
      // 1. 存储到向量数据库
      if (this.config.vectorStore.enabled) {
        result.vectorStored = await this.vectorStore.storeWebpage(
          webpageData.webpageId,
          webpageData.content,
          webpageData.analysisResult
        );
      }

      // 2. 提取实体到知识图谱
      if (this.config.knowledgeGraph.enabled && webpageData.analysisResult.extractedEntities) {
        const entities = webpageData.analysisResult.extractedEntities;
        
        // 创建网页实体
        await this.knowledgeGraph.upsertEntity({
          id: `webpage_${webpageData.webpageId}`,
          type: 'Document',
          name: webpageData.analysisResult.pageInfo?.title || 'Untitled',
          properties: {
            url: webpageData.analysisResult.pageInfo?.url,
            domain: webpageData.analysisResult.pageInfo?.domain,
            contentCategory: webpageData.analysisResult.contentCategory,
            contentRelevance: webpageData.analysisResult.contentRelevance
          }
        });

        result.graphEntities++;

        // 处理提取的实体
        for (const project of entities.projects || []) {
          await this.knowledgeGraph.upsertEntity({
            id: `project_${project.replace(/\s+/g, '_').toLowerCase()}`,
            type: 'Project',
            name: project,
            properties: { lastMentioned: Date.now() }
          });
          result.graphEntities++;
        }

        for (const person of entities.people || []) {
          await this.knowledgeGraph.upsertEntity({
            id: `person_${person.replace(/\s+/g, '_').toLowerCase()}`,
            type: 'Person',
            name: person,
            properties: { lastMentioned: Date.now() }
          });
          result.graphEntities++;
        }
      }

      // 3. 记忆存储
      if (this.config.memoryLifecycle.enabled && result.vectorStored) {
        result.memoryStored = true;
      }

      console.log(`🌐 网页存储完成: ${webpageData.webpageId}`, result);
      return result;

    } catch (error) {
      console.error('❌ 网页存储失败:', error);
      return result;
    }
  }

  /**
   * 统一搜索接口
   */
  async unifiedSearch(options: UnifiedSearchOptions): Promise<UnifiedSearchResult> {
    const startTime = Date.now();
    const result: UnifiedSearchResult = {
      totalResults: 0,
      searchTime: 0
    };

    try {
      const searchPromises: Promise<any>[] = [];

      // 向量搜索
      if (options.searchTargets.includes('vector') && this.config.vectorStore.enabled) {
        searchPromises.push(
          this.vectorStore.semanticSearch(options.query, {
            collections: options.filters?.collections,
            limit: options.limit,
            filters: this.buildVectorFilters(options.filters)
          }).then(results => ({ type: 'vector', results }))
        );
      }

      // 图谱搜索
      if (options.searchTargets.includes('graph') && this.config.knowledgeGraph.enabled) {
        searchPromises.push(
          this.searchKnowledgeGraph(options).then(results => ({ type: 'graph', results }))
        );
      }

      // 等待所有搜索完成
      const searchResults = await Promise.allSettled(searchPromises);

      // 处理搜索结果
      for (const promiseResult of searchResults) {
        if (promiseResult.status === 'fulfilled') {
          const { type, results } = promiseResult.value;
          
          switch (type) {
            case 'vector':
              result.vectorResults = results;
              result.totalResults += results.length;
              break;
            case 'graph':
              result.graphResults = results;
              result.totalResults += results.length;
              break;
          }
        }
      }

      result.searchTime = Date.now() - startTime;
      
      // 计算综合评分
      result.combinedScore = this.calculateCombinedScore(result);

      console.log(`🔍 统一搜索完成: 查询"${options.query}", 找到${result.totalResults}个结果, 用时${result.searchTime}ms`);
      
      return result;

    } catch (error) {
      console.error('❌ 统一搜索失败:', error);
      result.searchTime = Date.now() - startTime;
      return result;
    }
  }

  /**
   * 获取存储健康状态
   */
  async getHealthStatus(): Promise<StorageHealthStatus> {
    const status: StorageHealthStatus = {
      vectorStore: {
        status: 'error',
        collections: 0,
        documents: 0,
        lastCleanup: 0,
        issues: []
      },
      knowledgeGraph: {
        status: 'error',
        entities: 0,
        relationships: 0,
        lastUpdate: 0,
        issues: []
      },
      memoryLifecycle: {
        status: 'error',
        totalMemories: 0,
        forgottenToday: 0,
        nextCleanup: 0,
        issues: []
      },
      overall: 'error'
    };

    try {
      // 检查向量存储
      if (this.config.vectorStore.enabled) {
        try {
          const metrics = await this.vectorStore.getStorageMetrics();
          status.vectorStore = {
            status: 'healthy',
            collections: metrics.totalCollections,
            documents: metrics.totalDocuments,
            lastCleanup: metrics.lastCleanup,
            issues: []
          };
          
          // 健康检查
          if (metrics.totalDocuments > 50000) {
            status.vectorStore.status = 'warning';
            status.vectorStore.issues?.push('文档数量过多，建议清理');
          }
        } catch (error) {
          status.vectorStore.issues?.push(`向量存储错误: ${error.message}`);
        }
      }

      // 检查知识图谱
      if (this.config.knowledgeGraph.enabled) {
        try {
          const graphStats = this.knowledgeGraph.getStatistics();
          status.knowledgeGraph = {
            status: 'healthy',
            entities: graphStats.entityCount,
            relationships: graphStats.relationshipCount,
            lastUpdate: Date.now(),
            issues: []
          };

          // 健康检查
          if (graphStats.entityCount > 10000) {
            status.knowledgeGraph.status = 'warning';
            status.knowledgeGraph.issues?.push('实体数量过多，建议清理');
          }
        } catch (error) {
          status.knowledgeGraph.issues?.push(`知识图谱错误: ${error.message}`);
        }
      }

      // 检查记忆管理
      if (this.config.memoryLifecycle.enabled) {
        try {
          const memoryStats = this.memoryManager.getStats();
          status.memoryLifecycle = {
            status: 'healthy',
            totalMemories: 0, // 需要从向量存储获取
            forgottenToday: memoryStats.totalForgotten,
            nextCleanup: Date.now() + 6 * 60 * 60 * 1000, // 6小时后
            issues: []
          };
        } catch (error) {
          status.memoryLifecycle.issues?.push(`记忆管理错误: ${error.message}`);
        }
      }

      // 计算整体状态
      const allStatuses = [
        status.vectorStore.status,
        status.knowledgeGraph.status,
        status.memoryLifecycle.status
      ];

      if (allStatuses.includes('error')) {
        status.overall = 'error';
      } else if (allStatuses.includes('warning')) {
        status.overall = 'warning';
      } else {
        status.overall = 'healthy';
      }

      return status;

    } catch (error) {
      console.error('❌ 获取存储健康状态失败:', error);
      return status;
    }
  }

  /**
   * 执行存储维护
   */
  async performMaintenance(options?: {
    cleanupVector?: boolean;
    cleanupGraph?: boolean;
    runMemoryLifecycle?: boolean;
    retentionDays?: number;
  }): Promise<{
    vectorCleaned: number;
    graphCleaned: number;
    memoriesForgotten: number;
    totalTime: number;
  }> {
    const startTime = Date.now();
    const result = {
      vectorCleaned: 0,
      graphCleaned: 0,
      memoriesForgotten: 0,
      totalTime: 0
    };

    console.log('🧹 开始存储维护...');

    try {
      const retentionDays = options?.retentionDays || 90;

      // 清理向量存储
      if (options?.cleanupVector !== false && this.config.vectorStore.enabled) {
        result.vectorCleaned = await this.vectorStore.cleanupExpiredData(retentionDays);
      }

      // 清理知识图谱
      if (options?.cleanupGraph !== false && this.config.knowledgeGraph.enabled) {
        result.graphCleaned = await this.knowledgeGraph.cleanup(retentionDays);
      }

      // 执行记忆生命周期管理
      if (options?.runMemoryLifecycle !== false && this.config.memoryLifecycle.enabled) {
        const memoryResult = await this.memoryManager.executeMemoryLifecycle();
        result.memoriesForgotten = memoryResult.forgotten;
      }

      result.totalTime = Date.now() - startTime;
      
      console.log(`✅ 存储维护完成: 清理${result.vectorCleaned + result.graphCleaned}个过期项, 遗忘${result.memoriesForgotten}条记忆, 用时${result.totalTime}ms`);
      
      return result;

    } catch (error) {
      console.error('❌ 存储维护失败:', error);
      result.totalTime = Date.now() - startTime;
      return result;
    }
  }

  /**
   * 启动定期维护任务
   */
  private startMaintenanceTasks(): void {
    // 每24小时执行一次维护
    setInterval(async () => {
      console.log('⏰ 执行定期存储维护...');
      await this.performMaintenance();
    }, 24 * 60 * 60 * 1000);

    // 每6小时执行一次记忆生命周期管理
    if (this.config.memoryLifecycle.enabled) {
      setInterval(async () => {
        console.log('🧠 执行记忆生命周期管理...');
        await this.memoryManager.executeMemoryLifecycle();
      }, 6 * 60 * 60 * 1000);
    }
  }

  /**
   * 构建向量搜索过滤器
   */
  private buildVectorFilters(filters?: UnifiedSearchOptions['filters']): Record<string, any> {
    const vectorFilters: Record<string, any> = {};

    if (filters?.contentType) {
      vectorFilters.contentType = { $in: filters.contentType };
    }

    if (filters?.dateRange) {
      vectorFilters.timestamp = {
        $gte: filters.dateRange.start,
        $lte: filters.dateRange.end
      };
    }

    return vectorFilters;
  }

  /**
   * 搜索知识图谱
   */
  private async searchKnowledgeGraph(options: UnifiedSearchOptions): Promise<any[]> {
    const results: any[] = [];

    // 搜索实体
    const entities = this.knowledgeGraph.queryEntities({
      name: options.query,
      limit: options.limit
    });

    for (const entity of entities) {
      results.push({
        type: 'entity',
        data: entity,
        score: this.calculateEntityRelevance(entity, options.query)
      });

      // 如果需要包含关系
      if (options.includeRelations) {
        const neighbors = this.knowledgeGraph.findNeighbors(entity.id, {
          maxDepth: 1
        });
        
        results.push({
          type: 'graph',
          data: neighbors,
          score: 0.8
        });
      }
    }

    return results;
  }

  /**
   * 计算实体相关性
   */
  private calculateEntityRelevance(entity: any, query: string): number {
    const queryLower = query.toLowerCase();
    const nameLower = entity.name.toLowerCase();
    
    if (nameLower === queryLower) return 1.0;
    if (nameLower.includes(queryLower)) return 0.8;
    if (queryLower.includes(nameLower)) return 0.6;
    
    return 0.3;
  }

  /**
   * 计算综合评分
   */
  private calculateCombinedScore(result: UnifiedSearchResult): number {
    let totalScore = 0;
    let totalWeight = 0;

    if (result.vectorResults?.length) {
      const avgScore = result.vectorResults.reduce((sum, r) => sum + (1 - r.distance), 0) / result.vectorResults.length;
      totalScore += avgScore * 0.6; // 向量搜索权重60%
      totalWeight += 0.6;
    }

    if (result.graphResults?.length) {
      const avgScore = result.graphResults.reduce((sum, r) => sum + r.score, 0) / result.graphResults.length;
      totalScore += avgScore * 0.4; // 图谱搜索权重40%
      totalWeight += 0.4;
    }

    return totalWeight > 0 ? totalScore / totalWeight : 0;
  }

  /**
   * 销毁存储管理器
   */
  destroy(): void {
    this.vectorStore?.destroy();
    this.knowledgeGraph?.destroy();
    this.isInitialized = false;
  }
}

export default UnifiedStorageManager;