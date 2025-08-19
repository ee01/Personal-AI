/**
 * 存储系统辅助工具
 * 提供便利的存储接口和使用示例
 */

import UnifiedStorageManager from './UnifiedStorageManager';
import { Entity } from './EntitySimilarityManager';
import { getEnvConfig } from '../utils';

// 全局存储管理器实例（单例模式）
let globalStorageManager: UnifiedStorageManager | null = null;

/**
 * 获取全局存储管理器实例
 */
export async function getGlobalStorageManager(): Promise<UnifiedStorageManager> {
  if (!globalStorageManager) {
    const envConfig = await getEnvConfig();
    
    globalStorageManager = new UnifiedStorageManager({
      vectorStore: {
        enabled: envConfig.ENABLE_CHROMA || true,
        chromaUrl: envConfig.CHROMA_API_URL || 'http://localhost:8000'
      },
      knowledgeGraph: {
        enabled: true,
        engine: 'chrome_storage'
      },
      memoryLifecycle: {
        enabled: true,
        retentionDays: 90,
        cleanupInterval: 6
      }
    });
    
    const initialized = await globalStorageManager.initialize();
    if (!initialized) {
      console.error('❌ 统一存储管理器初始化失败');
    }
  }
  
  return globalStorageManager;
}

/**
 * 便利接口：存储网页分析结果
 */
export async function storeWebpageAnalysis(
  pageUrl: string,
  pageContent: string,
  analysisResult: {
    extractedEntities?: any;
    pageInfo?: any;
    contentCategory?: string;
    contentRelevance?: number;
  }
): Promise<boolean> {
  try {
    const storage = await getGlobalStorageManager();
    
    // 提取实体信息
    const entities: Array<Omit<Entity, 'id' | 'created' | 'lastAccessed' | 'accessCount'>> = [];
    
    if (analysisResult.extractedEntities) {
      // 处理项目实体
      if (analysisResult.extractedEntities.projects) {
        for (const project of analysisResult.extractedEntities.projects) {
          entities.push({
            type: 'Project',
            name: project,
            properties: {
              source: 'webpage_analysis',
              url: pageUrl,
              domain: analysisResult.pageInfo?.domain
            },
            importance: 0.8
          });
        }
      }
      
      // 处理人员实体
      if (analysisResult.extractedEntities.people) {
        for (const person of analysisResult.extractedEntities.people) {
          entities.push({
            type: 'Person',
            name: person,
            properties: {
              source: 'webpage_analysis',
              url: pageUrl
            },
            importance: 0.7
          });
        }
      }
    }
    
    const result = await storage.storeContent({
      type: 'webpage',
      id: `webpage_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      content: pageContent,
      metadata: {
        url: pageUrl,
        pageInfo: analysisResult.pageInfo,
        contentCategory: analysisResult.contentCategory,
        contentRelevance: analysisResult.contentRelevance,
        extractedEntities: analysisResult.extractedEntities,
        timestamp: Date.now(),
        source: 'web_intelligence'
      },
      entities
    });
    
    console.log(`🌐 网页分析结果存储完成: ${pageUrl}`, result);
    return result.success;
    
  } catch (error) {
    console.error('存储网页分析结果失败:', error);
    return false;
  }
}

/**
 * 便利接口：存储项目信息
 */
export async function storeProjectInfo(
  projectName: string,
  projectData: {
    description?: string;
    status?: string;
    team?: string[];
    milestones?: any[];
    dependencies?: any[];
  }
): Promise<boolean> {
  try {
    const storage = await getGlobalStorageManager();
    
    // 构建项目实体
    const entities: Array<Omit<Entity, 'id' | 'created' | 'lastAccessed' | 'accessCount'>> = [
      {
        type: 'Project',
        name: projectName,
        properties: {
          ...projectData,
          source: 'manual_input'
        },
        importance: 1.0 // 手动输入的项目重要性最高
      }
    ];
    
    // 添加团队成员实体
    if (projectData.team) {
      for (const member of projectData.team) {
        entities.push({
          type: 'Person',
          name: member,
          properties: {
            project: projectName,
            source: 'project_team'
          },
          importance: 0.8
        });
      }
    }
    
    const result = await storage.storeContent({
      type: 'project',
      id: `project_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      content: `项目: ${projectName}\n描述: ${projectData.description || ''}\n状态: ${projectData.status || ''}`,
      metadata: {
        projectName,
        ...projectData,
        timestamp: Date.now(),
        source: 'project_dashboard'
      },
      entities
    });
    
    console.log(`📊 项目信息存储完成: ${projectName}`, result);
    return result.success;
    
  } catch (error) {
    console.error('存储项目信息失败:', error);
    return false;
  }
}

/**
 * 便利接口：搜索相关内容
 */
export async function searchContent(
  query: string,
  options?: {
    searchTargets?: ('vector' | 'graph')[];
    contentTypes?: ('message' | 'webpage' | 'project' | 'document')[];
    limit?: number;
  }
): Promise<any> {
  try {
    const storage = await getGlobalStorageManager();
    
    const searchResult = await storage.unifiedSearch({
      query,
      searchTargets: options?.searchTargets || ['vector', 'graph'],
      filters: {
        contentType: options?.contentTypes,
        collections: options?.contentTypes
      },
      limit: options?.limit || 20,
      includeRelations: true
    });
    
    console.log(`🔍 搜索完成: "${query}"`, {
      totalResults: searchResult.totalResults,
      searchTime: searchResult.searchTime,
      combinedScore: searchResult.combinedScore
    });
    
    return searchResult;
    
  } catch (error) {
    console.error('搜索失败:', error);
    return {
      totalResults: 0,
      searchTime: 0,
      vectorResults: [],
      graphResults: []
    };
  }
}

/**
 * 便利接口：获取实体信息
 */
export async function getEntityInfo(entityId: string): Promise<any> {
  try {
    const storage = await getGlobalStorageManager();
    
    // 通过图查询获取实体信息
    const searchResult = await storage.unifiedSearch({
      query: entityId,
      searchTargets: ['graph'],
      limit: 1,
      includeRelations: true
    });
    
    return searchResult.graphResults?.[0] || null;
    
  } catch (error) {
    console.error('获取实体信息失败:', error);
    return null;
  }
}

/**
 * 便利接口：获取实体相似性管理器
 */
export async function getEntitySimilarityManager() {
  const storage = await getGlobalStorageManager();
  return storage.getEntitySimilarityManager();
}

/**
 * 便利接口：获取性能监控器
 */
export async function getPerformanceMonitor() {
  const storage = await getGlobalStorageManager();
  return storage.getPerformanceMonitor();
}

/**
 * 便利接口：执行存储维护
 */
export async function performStorageMaintenance(options?: {
  enableGradualForgetting?: boolean;
  retentionDays?: number;
}): Promise<any> {
  try {
    const storage = await getGlobalStorageManager();
    
    const result = await storage.performEnhancedMaintenance({
      enableGradualForgetting: options?.enableGradualForgetting !== false,
      retentionDays: options?.retentionDays || 90,
      cleanupVector: true,
      cleanupGraph: true,
      runMemoryLifecycle: true
    });
    
    console.log('🧹 存储维护完成:', result);
    return result;
    
  } catch (error) {
    console.error('存储维护失败:', error);
    return null;
  }
}

/**
 * 便利接口：获取存储健康状态
 */
export async function getStorageHealth(): Promise<any> {
  try {
    const storage = await getGlobalStorageManager();
    const healthStatus = await storage.getEnhancedHealthStatus();
    
    console.log('📊 存储健康状态:', healthStatus.overall);
    return healthStatus;
    
  } catch (error) {
    console.error('获取存储健康状态失败:', error);
    return null;
  }
}

/**
 * 便利接口：获取待审核的实体合并
 */
export async function getPendingEntityMerges(): Promise<any[]> {
  try {
    const entityManager = await getEntitySimilarityManager();
    return await entityManager.getPendingMerges();
  } catch (error) {
    console.error('获取待审核合并失败:', error);
    return [];
  }
}

/**
 * 便利接口：确认实体合并
 */
export async function confirmEntityMerge(mergeId: string): Promise<boolean> {
  try {
    const entityManager = await getEntitySimilarityManager();
    return await entityManager.confirmMerge(mergeId);
  } catch (error) {
    console.error('确认实体合并失败:', error);
    return false;
  }
}

/**
 * 便利接口：拒绝实体合并
 */
export async function rejectEntityMerge(mergeId: string): Promise<boolean> {
  try {
    const entityManager = await getEntitySimilarityManager();
    return await entityManager.rejectMerge(mergeId);
  } catch (error) {
    console.error('拒绝实体合并失败:', error);
    return false;
  }
}

/**
 * 使用示例和最佳实践
 */
export const StorageUsageExamples = {
  
  // 示例1: 存储消息分析结果
  storeMessage: async () => {
    const storage = await getGlobalStorageManager();
    
    return await storage.storeContent({
      type: 'message',
      id: 'msg_' + Date.now(),
      content: 'Zhang San说前端重构项目预计下周完成',
      metadata: {
        source: 'Zhang San',
        timestamp: Date.now(),
        teamName: '开发团队'
      },
      entities: [
        {
          type: 'Person',
          name: 'Zhang San',
          properties: { role: '前端工程师' },
          importance: 0.8
        },
        {
          type: 'Project', 
          name: '前端重构项目',
          properties: { status: '进行中' },
          importance: 0.9
        }
      ]
    });
  },
  
  // 示例2: 搜索项目相关信息
  searchProject: async () => {
    return await searchContent('前端重构项目', {
      searchTargets: ['vector', 'graph'],
      contentTypes: ['message', 'project'],
      limit: 10
    });
  },
  
  // 示例3: 执行定期维护
  performMaintenance: async () => {
    return await performStorageMaintenance({
      enableGradualForgetting: true,
      retentionDays: 60
    });
  }
};

export default {
  getGlobalStorageManager,
  storeWebpageAnalysis,
  storeProjectInfo,
  searchContent,
  getEntityInfo,
  getEntitySimilarityManager,
  getPerformanceMonitor,
  performStorageMaintenance,
  getStorageHealth,
  getPendingEntityMerges,
  confirmEntityMerge,
  rejectEntityMerge,
  StorageUsageExamples
};
