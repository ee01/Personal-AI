/**
 * 数据迁移工具
 * 将现有向量数据库中的消息数据迁移到混合图存储系统
 */

import { ChromaClient, Collection } from 'chromadb';
import HybridGraphStore from './HybridGraphStore';
import { getEnvConfig } from '../utils';

export interface MigrationProgress {
  totalMessages: number;
  processedMessages: number;
  migratedEntities: number;
  migratedRelationships: number;
  errors: number;
  currentCollection: string;
  startTime: number;
  estimatedTimeRemaining: number;
  isCompleted: boolean;
}

export interface MigrationResult {
  success: boolean;
  totalProcessed: number;
  totalEntities: number;
  totalRelationships: number;
  totalErrors: number;
  migrationTime: number;
  errorDetails: string[];
}

/**
 * 数据迁移工具类
 */
export class DataMigrationTool {
  private chromaClient: ChromaClient | null = null;
  private hybridGraph: HybridGraphStore;
  private progressCallback?: (progress: MigrationProgress) => void;

  constructor(progressCallback?: (progress: MigrationProgress) => void) {
    this.hybridGraph = new HybridGraphStore();
    this.progressCallback = progressCallback;
  }

  /**
   * 初始化迁移工具
   */
  async initialize(): Promise<boolean> {
    try {
      console.log('🔄 初始化数据迁移工具...');

      // 初始化混合图存储
      const graphInitialized = await this.hybridGraph.initialize();
      if (!graphInitialized) {
        console.error('❌ 混合图存储初始化失败');
        return false;
      }

      // 初始化ChromaDB客户端
      const config = await getEnvConfig();
      if (!config.ENABLE_CHROMA) {
        console.error('❌ ChromaDB未启用，无法执行迁移');
        return false;
      }

      this.chromaClient = new ChromaClient({
        path: config.CHROMA_API_URL || 'http://localhost:8000'
      });

      console.log('✅ 数据迁移工具初始化完成');
      return true;

    } catch (error) {
      console.error('❌ 数据迁移工具初始化失败:', error);
      return false;
    }
  }

  /**
   * 执行完整数据迁移
   */
  async performFullMigration(): Promise<MigrationResult> {
    const startTime = Date.now();
    const result: MigrationResult = {
      success: false,
      totalProcessed: 0,
      totalEntities: 0,
      totalRelationships: 0,
      totalErrors: 0,
      migrationTime: 0,
      errorDetails: []
    };

    try {
      console.log('🚀 开始完整数据迁移...');

      if (!this.chromaClient) {
        throw new Error('ChromaDB客户端未初始化');
      }

      // 1. 获取所有collections
      const collections = await this.chromaClient.listCollections();
      console.log(`📂 发现 ${collections.length} 个collections:`, collections);

      // 2. 过滤出消息相关的collections
      const messageCollections = collections.filter(name => 
        name.includes('-messages') || name.includes('message')
      );

      if (messageCollections.length === 0) {
        console.log('📭 没有找到消息相关的collections');
        result.success = true;
        return result;
      }

      console.log(`📊 将迁移 ${messageCollections.length} 个消息collections:`, messageCollections);

      // 3. 逐个迁移collections
      for (const collectionName of messageCollections) {
        const collectionResult = await this.migrateCollection(collectionName);
        
        result.totalProcessed += collectionResult.totalProcessed;
        result.totalEntities += collectionResult.totalEntities;
        result.totalRelationships += collectionResult.totalRelationships;
        result.totalErrors += collectionResult.totalErrors;
        result.errorDetails.push(...collectionResult.errorDetails);
      }

      // 4. 执行图数据备份
      console.log('☁️ 执行迁移后备份...');
      const backupResult = await this.hybridGraph.backupToCloud();
      if (!backupResult) {
        console.warn('⚠️ 迁移后备份失败');
      }

      result.success = true;
      result.migrationTime = Date.now() - startTime;

      console.log('✅ 完整数据迁移完成:', result);
      return result;

    } catch (error) {
      console.error('❌ 完整数据迁移失败:', error);
      result.errorDetails.push(`迁移失败: ${error.message}`);
      result.migrationTime = Date.now() - startTime;
      return result;
    }
  }

  /**
   * 迁移单个collection
   */
  async migrateCollection(collectionName: string): Promise<MigrationResult> {
    const startTime = Date.now();
    const result: MigrationResult = {
      success: false,
      totalProcessed: 0,
      totalEntities: 0,
      totalRelationships: 0,
      totalErrors: 0,
      migrationTime: 0,
      errorDetails: []
    };

    try {
      console.log(`📂 开始迁移collection: ${collectionName}`);

      if (!this.chromaClient) {
        throw new Error('ChromaDB客户端未初始化');
      }

      // 1. 获取collection
      const collection = await this.chromaClient.getCollection({ name: collectionName });
      
      // 2. 获取所有文档
      const batchSize = 100; // 每批处理100个文档
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const batch = await collection.get({
          limit: batchSize,
          offset: offset
        });

        if (!batch.ids || batch.ids.length === 0) {
          hasMore = false;
          break;
        }

        console.log(`📊 处理第 ${Math.floor(offset / batchSize) + 1} 批数据: ${batch.ids.length} 个文档`);

        // 3. 处理当前批次
        for (let i = 0; i < batch.ids.length; i++) {
          try {
            const messageData = this.extractMessageDataFromChroma(
              batch.ids[i],
              batch.documents?.[i] || '',
              batch.metadatas?.[i] as any || {}
            );

            if (messageData) {
              const extractResult = await this.hybridGraph.extractFromMessage(messageData);
              
              result.totalProcessed++;
              result.totalEntities += extractResult.entities.length;
              result.totalRelationships += extractResult.relationships.length;

              // 更新进度
              if (this.progressCallback) {
                this.progressCallback({
                  totalMessages: 0, // 无法预先知道总数
                  processedMessages: result.totalProcessed,
                  migratedEntities: result.totalEntities,
                  migratedRelationships: result.totalRelationships,
                  errors: result.totalErrors,
                  currentCollection: collectionName,
                  startTime: startTime,
                  estimatedTimeRemaining: 0,
                  isCompleted: false
                });
              }

              // 每处理10个文档输出一次日志
              if (result.totalProcessed % 10 === 0) {
                console.log(`📈 已处理 ${result.totalProcessed} 个消息, 提取 ${result.totalEntities} 个实体, ${result.totalRelationships} 个关系`);
              }
            }

          } catch (error) {
            console.error(`处理消息 ${batch.ids[i]} 失败:`, error);
            result.totalErrors++;
            result.errorDetails.push(`消息 ${batch.ids[i]}: ${error.message}`);
          }
        }

        offset += batchSize;

        // 防止过度请求，每批之间延迟100ms
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      result.success = true;
      result.migrationTime = Date.now() - startTime;

      console.log(`✅ Collection ${collectionName} 迁移完成:`, {
        处理消息: result.totalProcessed,
        提取实体: result.totalEntities,
        提取关系: result.totalRelationships,
        错误数量: result.totalErrors,
        用时: `${result.migrationTime}ms`
      });

      return result;

    } catch (error) {
      console.error(`❌ Collection ${collectionName} 迁移失败:`, error);
      result.errorDetails.push(`Collection ${collectionName} 迁移失败: ${error.message}`);
      result.migrationTime = Date.now() - startTime;
      return result;
    }
  }

  /**
   * 从ChromaDB数据中提取消息信息
   */
  private extractMessageDataFromChroma(
    id: string,
    document: string,
    metadata: any
  ): {
    messageId: string;
    content: string;
    source: string;
    entities?: any;
    relationships?: any;
    timestamp?: number;
  } | null {
    try {
      // 检查是否为有效的消息数据
      if (!document || !metadata) {
        return null;
      }

      // 尝试解析metadata中的实体信息
      let entities = null;
      let relationships = null;

      if (metadata.entities) {
        try {
          entities = typeof metadata.entities === 'string' ? 
            JSON.parse(metadata.entities) : metadata.entities;
        } catch (e) {
          console.warn(`解析实体数据失败 ${id}:`, e);
        }
      }

      if (metadata.relationships) {
        try {
          relationships = typeof metadata.relationships === 'string' ? 
            JSON.parse(metadata.relationships) : metadata.relationships;
        } catch (e) {
          console.warn(`解析关系数据失败 ${id}:`, e);
        }
      }

      return {
        messageId: id,
        content: document,
        source: metadata.source || 'migrated',
        entities: entities,
        relationships: relationships,
        timestamp: metadata.timestamp || Date.now()
      };

    } catch (error) {
      console.error(`提取消息数据失败 ${id}:`, error);
      return null;
    }
  }

  /**
   * 验证迁移结果
   */
  async verifyMigration(): Promise<{
    isValid: boolean;
    vectorMessages: number;
    graphEntities: number;
    graphRelationships: number;
    issues: string[];
  }> {
    const verification = {
      isValid: true,
      vectorMessages: 0,
      graphEntities: 0,
      graphRelationships: 0,
      issues: []
    };

    try {
      console.log('🔍 开始验证迁移结果...');

      // 1. 统计向量数据库中的消息数量
      if (this.chromaClient) {
        try {
          const collections = await this.chromaClient.listCollections();
          for (const collectionName of collections) {
            if (collectionName.includes('-messages')) {
              const collection = await this.chromaClient.getCollection({ name: collectionName });
              const data = await collection.get();
              verification.vectorMessages += data.ids?.length || 0;
            }
          }
        } catch (error) {
          verification.issues.push(`统计向量数据失败: ${error.message}`);
        }
      }

      // 2. 统计图数据库中的实体和关系数量
      const graphStats = this.hybridGraph.getStatistics();
      verification.graphEntities = graphStats.localEntityTypes;
      verification.graphRelationships = graphStats.localRelationships;

      // 3. 检查是否有合理的数据迁移
      if (verification.vectorMessages > 0 && verification.graphEntities === 0) {
        verification.isValid = false;
        verification.issues.push('有向量消息但没有图实体，可能迁移失败');
      }

      if (verification.graphRelationships === 0 && verification.graphEntities > 1) {
        verification.issues.push('有多个实体但没有关系，可能实体间关系提取失败');
      }

      // 4. 检查图存储健康状态
      if (!graphStats.isCloudAvailable) {
        verification.issues.push('云端存储不可用，数据仅在本地');
      }

      console.log('📊 迁移验证结果:', verification);
      return verification;

    } catch (error) {
      console.error('❌ 迁移验证失败:', error);
      verification.isValid = false;
      verification.issues.push(`验证失败: ${error.message}`);
      return verification;
    }
  }

  /**
   * 执行增量迁移（仅迁移新数据）
   */
  async performIncrementalMigration(since: number): Promise<MigrationResult> {
    console.log(`🔄 开始增量迁移 (since: ${new Date(since).toISOString()})...`);
    
    // TODO: 实现增量迁移逻辑
    // 这需要根据timestamp过滤向量数据库中的数据
    
    return {
      success: false,
      totalProcessed: 0,
      totalEntities: 0,
      totalRelationships: 0,
      totalErrors: 0,
      migrationTime: 0,
      errorDetails: ['增量迁移功能待实现']
    };
  }

  /**
   * 清理迁移工具资源
   */
  destroy(): void {
    if (this.hybridGraph) {
      this.hybridGraph.destroy();
    }
    this.chromaClient = null;
  }
}

/**
 * 执行数据迁移的便捷函数
 */
export async function migrateExistingData(
  progressCallback?: (progress: MigrationProgress) => void
): Promise<MigrationResult> {
  const migrationTool = new DataMigrationTool(progressCallback);
  
  try {
    const initialized = await migrationTool.initialize();
    if (!initialized) {
      return {
        success: false,
        totalProcessed: 0,
        totalEntities: 0,
        totalRelationships: 0,
        totalErrors: 1,
        migrationTime: 0,
        errorDetails: ['迁移工具初始化失败']
      };
    }

    const result = await migrationTool.performFullMigration();
    
    // 验证迁移结果
    const verification = await migrationTool.verifyMigration();
    if (!verification.isValid) {
      console.warn('⚠️ 迁移验证发现问题:', verification.issues);
    }

    return result;

  } finally {
    migrationTool.destroy();
  }
}

export default DataMigrationTool;