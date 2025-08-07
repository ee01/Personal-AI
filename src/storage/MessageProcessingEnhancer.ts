/**
 * 消息处理增强器
 * 集成混合图存储到现有消息处理流程
 */

import HybridGraphStore from './HybridGraphStore';
import { storeMessage } from '../vectorStore';
import { getEnvConfig } from '../utils';

export interface EnhancedMessageResult {
  // 原有向量存储结果
  vectorStored: boolean;
  vectorId?: string;
  
  // 新增图存储结果
  graphEntities: number;
  graphRelationships: number;
  graphStorageUsed: 'hybrid' | 'none' | 'fallback';
  
  // 处理统计
  processingTime: number;
  errors?: string[];
}

/**
 * 增强的消息处理器
 */
export class MessageProcessingEnhancer {
  private hybridGraph: HybridGraphStore;
  private isInitialized = false;

  constructor() {
    this.hybridGraph = new HybridGraphStore();
  }

  /**
   * 初始化增强器
   */
  async initialize(): Promise<boolean> {
    try {
      const config = await getEnvConfig();
      if (!config.ENABLE_CHROMA) {
        console.log('⚠️ ChromaDB已禁用，混合图存储将使用纯本地模式');
      }

      this.isInitialized = await this.hybridGraph.initialize();
      
      if (this.isInitialized) {
        console.log('✅ 消息处理增强器初始化成功');
      } else {
        console.warn('⚠️ 消息处理增强器初始化失败，将禁用图功能');
      }

      return this.isInitialized;
    } catch (error) {
      console.error('❌ 消息处理增强器初始化失败:', error);
      return false;
    }
  }

  /**
   * 增强的消息存储处理
   */
  async processMessage(messageData: {
    messageId: string;
    content: string;
    metadata: any;
  }): Promise<EnhancedMessageResult> {
    const startTime = Date.now();
    const result: EnhancedMessageResult = {
      vectorStored: false,
      graphEntities: 0,
      graphRelationships: 0,
      graphStorageUsed: 'none',
      processingTime: 0,
      errors: []
    };

    try {
      // 1. 执行原有向量存储（保持兼容性）
      try {
        result.vectorStored = await storeMessage(
          messageData.messageId,
          messageData.content,
          messageData.metadata
        );
        
        if (result.vectorStored) {
          result.vectorId = messageData.messageId;
          console.log(`📊 向量存储成功: ${messageData.messageId}`);
        }
      } catch (vectorError) {
        console.error('向量存储失败:', vectorError);
        result.errors?.push(`向量存储错误: ${vectorError.message}`);
      }

      // 2. 执行图存储增强
      if (this.isInitialized) {
        try {
          const graphData = await this.hybridGraph.extractFromMessage({
            messageId: messageData.messageId,
            content: messageData.content,
            source: messageData.metadata.source || 'unknown',
            entities: messageData.metadata.entities,
            relationships: messageData.metadata.relationships,
            timestamp: messageData.metadata.timestamp || Date.now()
          });

          result.graphEntities = graphData.entities.length;
          result.graphRelationships = graphData.relationships.length;
          result.graphStorageUsed = 'hybrid';

          console.log(`🕸️ 图存储成功: ${result.graphEntities}个实体, ${result.graphRelationships}个关系`);

        } catch (graphError) {
          console.error('图存储失败:', graphError);
          result.errors?.push(`图存储错误: ${graphError.message}`);
          result.graphStorageUsed = 'fallback';
        }
      }

      // 3. 处理完成统计
      result.processingTime = Date.now() - startTime;
      
      console.log(`✅ 消息处理完成: ${messageData.messageId}`, {
        vectorStored: result.vectorStored,
        graphEntities: result.graphEntities,
        graphRelationships: result.graphRelationships,
        processingTime: result.processingTime
      });

      return result;

    } catch (error) {
      console.error('❌ 消息处理失败:', error);
      result.errors?.push(`处理错误: ${error.message}`);
      result.processingTime = Date.now() - startTime;
      return result;
    }
  }

  /**
   * 批量处理消息（用于数据迁移）
   */
  async batchProcessMessages(messages: Array<{
    messageId: string;
    content: string;
    metadata: any;
  }>): Promise<{
    processed: number;
    failed: number;
    totalEntities: number;
    totalRelationships: number;
    processingTime: number;
  }> {
    const startTime = Date.now();
    const stats = {
      processed: 0,
      failed: 0,
      totalEntities: 0,
      totalRelationships: 0,
      processingTime: 0
    };

    console.log(`🔄 开始批量处理 ${messages.length} 条消息...`);

    for (const message of messages) {
      try {
        const result = await this.processMessage(message);
        
        if (result.vectorStored || result.graphEntities > 0) {
          stats.processed++;
          stats.totalEntities += result.graphEntities;
          stats.totalRelationships += result.graphRelationships;
        } else {
          stats.failed++;
        }

        // 每处理100条消息输出一次进度
        if ((stats.processed + stats.failed) % 100 === 0) {
          console.log(`📊 批量处理进度: ${stats.processed + stats.failed}/${messages.length}`);
        }

      } catch (error) {
        console.error(`处理消息 ${message.messageId} 失败:`, error);
        stats.failed++;
      }
    }

    stats.processingTime = Date.now() - startTime;
    
    console.log(`✅ 批量处理完成:`, stats);
    return stats;
  }

  /**
   * 执行图数据同步
   */
  async syncGraphData(): Promise<{
    synced: boolean;
    syncStatus?: any;
    error?: string;
  }> {
    if (!this.isInitialized) {
      return { synced: false, error: '图存储未初始化' };
    }

    try {
      const syncStatus = await this.hybridGraph.performSync(true);
      
      console.log('🔄 图数据同步完成:', syncStatus);
      
      return {
        synced: true,
        syncStatus
      };

    } catch (error) {
      console.error('❌ 图数据同步失败:', error);
      return {
        synced: false,
        error: error.message
      };
    }
  }

  /**
   * 执行图数据备份
   */
  async backupGraphData(): Promise<{
    backed: boolean;
    backupTime?: number;
    error?: string;
  }> {
    if (!this.isInitialized) {
      return { backed: false, error: '图存储未初始化' };
    }

    try {
      const backupResult = await this.hybridGraph.backupToCloud();
      
      if (backupResult) {
        console.log('☁️ 图数据备份成功');
        return {
          backed: true,
          backupTime: Date.now()
        };
      } else {
        return {
          backed: false,
          error: '备份失败，可能是云端不可用'
        };
      }

    } catch (error) {
      console.error('❌ 图数据备份失败:', error);
      return {
        backed: false,
        error: error.message
      };
    }
  }

  /**
   * 查询图数据
   */
  async queryGraphData(options: {
    entityName?: string;
    entityType?: string;
    relationshipType?: string;
    textQuery?: string;
    includeNeighbors?: boolean;
    maxDepth?: number;
    limit?: number;
  }): Promise<{
    entities: any[];
    relationships: any[];
    neighbors?: any[];
    queryTime: number;
  }> {
    const startTime = Date.now();
    const result = {
      entities: [],
      relationships: [],
      neighbors: [],
      queryTime: 0
    };

    if (!this.isInitialized) {
      console.warn('⚠️ 图存储未初始化，返回空结果');
      result.queryTime = Date.now() - startTime;
      return result;
    }

    try {
      // 查询实体
      if (options.entityName || options.entityType || options.textQuery) {
        result.entities = await this.hybridGraph.queryEntities({
          name: options.entityName,
          type: options.entityType,
          textQuery: options.textQuery,
          limit: options.limit || 20
        });
      }

      // 查询关系
      if (options.relationshipType) {
        result.relationships = this.hybridGraph.queryRelationships({
          type: options.relationshipType,
          limit: options.limit || 20
        });
      }

      // 查询邻居
      if (options.includeNeighbors && result.entities.length > 0) {
        for (const entity of result.entities.slice(0, 5)) { // 最多查询5个实体的邻居
          const neighbors = this.hybridGraph.findNeighbors(entity.id, {
            maxDepth: options.maxDepth || 2
          });
          result.neighbors?.push({
            entityId: entity.id,
            neighbors
          });
        }
      }

      result.queryTime = Date.now() - startTime;
      
      console.log(`🔍 图查询完成: ${result.entities.length}个实体, ${result.relationships.length}个关系, 用时${result.queryTime}ms`);
      
      return result;

    } catch (error) {
      console.error('❌ 图查询失败:', error);
      result.queryTime = Date.now() - startTime;
      return result;
    }
  }

  /**
   * 获取图存储统计信息
   */
  getGraphStatistics(): {
    isInitialized: boolean;
    isCloudAvailable: boolean;
    localRelationships: number;
    localEntityTypes: number;
    lastSync: number;
  } {
    if (!this.isInitialized) {
      return {
        isInitialized: false,
        isCloudAvailable: false,
        localRelationships: 0,
        localEntityTypes: 0,
        lastSync: 0
      };
    }

    const stats = this.hybridGraph.getStatistics();
    return {
      isInitialized: this.isInitialized,
      isCloudAvailable: stats.isCloudAvailable,
      localRelationships: stats.localRelationships,
      localEntityTypes: stats.localEntityTypes,
      lastSync: stats.lastSync
    };
  }

  /**
   * 执行图数据清理
   */
  async cleanupGraphData(retentionDays: number = 90): Promise<{
    cleaned: number;
    cleanupTime: number;
    error?: string;
  }> {
    if (!this.isInitialized) {
      return { cleaned: 0, cleanupTime: 0, error: '图存储未初始化' };
    }

    try {
      const startTime = Date.now();
      const cleaned = await this.hybridGraph.cleanup(retentionDays);
      const cleanupTime = Date.now() - startTime;

      console.log(`🧹 图数据清理完成: 删除${cleaned}个过期项, 用时${cleanupTime}ms`);
      
      return { cleaned, cleanupTime };

    } catch (error) {
      console.error('❌ 图数据清理失败:', error);
      return {
        cleaned: 0,
        cleanupTime: 0,
        error: error.message
      };
    }
  }

  /**
   * 销毁增强器
   */
  destroy(): void {
    if (this.hybridGraph) {
      this.hybridGraph.destroy();
    }
    this.isInitialized = false;
  }
}

// 创建全局实例
let globalEnhancer: MessageProcessingEnhancer | null = null;

/**
 * 获取全局消息处理增强器实例
 */
export async function getMessageProcessingEnhancer(): Promise<MessageProcessingEnhancer> {
  if (!globalEnhancer) {
    globalEnhancer = new MessageProcessingEnhancer();
    await globalEnhancer.initialize();
  }
  return globalEnhancer;
}

/**
 * 增强的消息存储函数（向后兼容）
 */
export async function storeMessageEnhanced(
  messageId: string,
  content: string,
  metadata: any
): Promise<EnhancedMessageResult> {
  const enhancer = await getMessageProcessingEnhancer();
  return enhancer.processMessage({ messageId, content, metadata });
}

export default MessageProcessingEnhancer;