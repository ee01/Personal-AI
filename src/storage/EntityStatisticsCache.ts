/**
 * 实体统计缓存管理器
 * 负责缓存和管理实体统计信息到 localStorage
 */

import HybridGraphStore from './HybridGraphStore';

export interface CachedEntityStatistics {
  // 统计数据
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
  
  // 缓存元信息
  cacheTimestamp: number;
  cacheDuration: number; // 缓存有效期（毫秒）
  dataHash: string; // 数据哈希，用于检测变化
}

export interface QuickEntityInfo {
  id: string;
  name: string;
  type: string;
  relationCount: number;
  lastActivity: number;
  accessCount: number;
  importance: number;
}

export interface EntityTypeStatistics {
  type: string;
  count: number;
  entities: QuickEntityInfo[];
  averageRelations: number;
  mostActive: QuickEntityInfo | null;
  recentlyCreated: number; // 最近创建的数量
}

/**
 * 实体统计缓存管理器
 */
export class EntityStatisticsCache {
  private hybridGraphStore: HybridGraphStore;
  private readonly CACHE_KEY = 'entity_statistics_cache';
  private readonly QUICK_CACHE_KEY = 'entity_quick_cache';
  private readonly DEFAULT_CACHE_DURATION = 30 * 60 * 1000; // 30分钟
  private readonly QUICK_CACHE_DURATION = 5 * 60 * 1000; // 5分钟

  constructor(hybridGraphStore: HybridGraphStore) {
    this.hybridGraphStore = hybridGraphStore;
  }

  /**
   * 获取缓存的统计信息（如果有效）
   */
  async getCachedStatistics(): Promise<CachedEntityStatistics | null> {
    try {
      const result = await chrome.storage.local.get(this.CACHE_KEY);
      const cached = result[this.CACHE_KEY] as CachedEntityStatistics;
      
      if (!cached) {
        console.log('📊 未找到缓存的统计信息');
        return null;
      }

      // 检查缓存是否过期
      const now = Date.now();
      if (now - cached.cacheTimestamp > cached.cacheDuration) {
        console.log('📊 统计缓存已过期，需要刷新');
        return null;
      }

      // 检查数据是否有变化
      const currentHash = await this.calculateDataHash();
      if (currentHash !== cached.dataHash) {
        console.log('📊 数据已变化，缓存无效');
        return null;
      }

      console.log('📊 使用缓存的统计信息');
      return cached;

    } catch (error) {
      console.error('获取缓存统计失败:', error);
      return null;
    }
  }

  /**
   * 获取或刷新统计信息
   */
  async getStatistics(forceRefresh: boolean = false): Promise<CachedEntityStatistics> {
    try {
      // 如果不强制刷新，先尝试使用缓存
      if (!forceRefresh) {
        const cached = await this.getCachedStatistics();
        if (cached) {
          return cached;
        }
      }

      // 获取最新统计信息
      console.log('📊 刷新实体统计信息...');
      const stats = await this.hybridGraphStore.getEntityStatistics();
      
      // 计算数据哈希
      const dataHash = await this.calculateDataHash();
      
      // 创建缓存对象
      const cachedStats: CachedEntityStatistics = {
        ...stats,
        cacheTimestamp: Date.now(),
        cacheDuration: this.DEFAULT_CACHE_DURATION,
        dataHash
      };

      // 保存到缓存
      await chrome.storage.local.set({
        [this.CACHE_KEY]: cachedStats
      });

      console.log('📊 统计信息已缓存');
      return cachedStats;

    } catch (error) {
      console.error('获取统计信息失败:', error);
      // 返回空的统计信息
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
        },
        cacheTimestamp: Date.now(),
        cacheDuration: this.DEFAULT_CACHE_DURATION,
        dataHash: ''
      };
    }
  }

  /**
   * 获取快速实体信息（用于列表显示）
   */
  async getQuickEntityInfo(entityType?: string): Promise<QuickEntityInfo[]> {
    try {
      const cacheKey = entityType ? `${this.QUICK_CACHE_KEY}_${entityType}` : this.QUICK_CACHE_KEY;
      const result = await chrome.storage.local.get(cacheKey);
      const cached = result[cacheKey];
      
      // 检查快速缓存
      if (cached && cached.timestamp && 
          (Date.now() - cached.timestamp < this.QUICK_CACHE_DURATION)) {
        console.log(`📊 使用快速缓存的实体信息 (${entityType || 'all'})`);
        return cached.data as QuickEntityInfo[];
      }

      // 重新计算快速信息
      console.log(`📊 刷新快速实体信息 (${entityType || 'all'})`);
      const quickInfo = await this.buildQuickEntityInfo(entityType);
      
      // 缓存快速信息
      await chrome.storage.local.set({
        [cacheKey]: {
          data: quickInfo,
          timestamp: Date.now()
        }
      });

      return quickInfo;

    } catch (error) {
      console.error('获取快速实体信息失败:', error);
      return [];
    }
  }

  /**
   * 获取按类型分组的统计信息
   */
  async getEntityTypeStatistics(): Promise<EntityTypeStatistics[]> {
    try {
      const stats = await this.getStatistics();
      const typeStats: EntityTypeStatistics[] = [];

      for (const [type, count] of Object.entries(stats.entityCounts)) {
        const entities = await this.getQuickEntityInfo(type);
        
        // 计算平均关系数
        const totalRelations = entities.reduce((sum, entity) => sum + entity.relationCount, 0);
        const averageRelations = entities.length > 0 ? totalRelations / entities.length : 0;
        
        // 找到最活跃的实体
        const mostActive = entities.length > 0 
          ? entities.reduce((prev, current) => 
              (current.lastActivity > prev.lastActivity) ? current : prev) 
          : null;

        // 统计最近创建的实体
        const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
        const recentlyCreated = entities.filter(entity => entity.lastActivity > oneDayAgo).length;

        typeStats.push({
          type,
          count,
          entities: entities.slice(0, 10), // 只返回前10个
          averageRelations,
          mostActive,
          recentlyCreated
        });
      }

      // 按实体数量排序
      typeStats.sort((a, b) => b.count - a.count);
      
      return typeStats;

    } catch (error) {
      console.error('获取类型统计失败:', error);
      return [];
    }
  }

  /**
   * 清除所有缓存
   */
  async clearCache(): Promise<void> {
    try {
      const keysToRemove = [this.CACHE_KEY];
      
      // 获取所有相关的快速缓存键
      const allData = await chrome.storage.local.get();
      for (const key of Object.keys(allData)) {
        if (key.startsWith(this.QUICK_CACHE_KEY)) {
          keysToRemove.push(key);
        }
      }

      await chrome.storage.local.remove(keysToRemove);
      console.log('📊 已清除所有实体统计缓存');

    } catch (error) {
      console.error('清除缓存失败:', error);
    }
  }

  /**
   * 获取缓存状态信息
   */
  async getCacheStatus(): Promise<{
    hasMainCache: boolean;
    mainCacheAge: number; // 毫秒
    quickCacheCount: number;
    totalCacheSize: number; // 估计大小（字节）
  }> {
    try {
      const allData = await chrome.storage.local.get();
      
      let hasMainCache = false;
      let mainCacheAge = 0;
      let quickCacheCount = 0;
      let totalCacheSize = 0;

      // 检查主缓存
      if (allData[this.CACHE_KEY]) {
        hasMainCache = true;
        mainCacheAge = Date.now() - allData[this.CACHE_KEY].cacheTimestamp;
        totalCacheSize += JSON.stringify(allData[this.CACHE_KEY]).length;
      }

      // 检查快速缓存
      for (const key of Object.keys(allData)) {
        if (key.startsWith(this.QUICK_CACHE_KEY)) {
          quickCacheCount++;
          totalCacheSize += JSON.stringify(allData[key]).length;
        }
      }

      return {
        hasMainCache,
        mainCacheAge,
        quickCacheCount,
        totalCacheSize
      };

    } catch (error) {
      console.error('获取缓存状态失败:', error);
      return {
        hasMainCache: false,
        mainCacheAge: 0,
        quickCacheCount: 0,
        totalCacheSize: 0
      };
    }
  }

  /**
   * 构建快速实体信息
   */
  private async buildQuickEntityInfo(entityType?: string): Promise<QuickEntityInfo[]> {
    try {
      const entities = entityType 
        ? this.hybridGraphStore.queryEntities({ type: entityType, limit: 100 })
        : this.hybridGraphStore.queryEntities({ limit: 500 });

      const quickInfo: QuickEntityInfo[] = [];

      for (const entity of entities) {
        // 计算关系数量
        const relationships = this.hybridGraphStore.queryRelationships({ 
          fromId: entity.id 
        });
        const incomingRelationships = this.hybridGraphStore.queryRelationships({ 
          toId: entity.id 
        });
        const relationCount = relationships.length + incomingRelationships.length;

        // 计算重要性（基于关系数量和最近活动）
        const daysSinceActivity = (Date.now() - entity.updated) / (24 * 60 * 60 * 1000);
        const importance = Math.min(1.0, (relationCount * 0.1) + (1 / (daysSinceActivity + 1)));

        quickInfo.push({
          id: entity.id,
          name: entity.name,
          type: entity.type,
          relationCount,
          lastActivity: entity.updated,
          accessCount: entity.properties?.accessCount || 0,
          importance
        });
      }

      // 按重要性和活动时间排序
      quickInfo.sort((a, b) => {
        if (Math.abs(a.importance - b.importance) < 0.1) {
          return b.lastActivity - a.lastActivity; // 相近重要性时按时间排序
        }
        return b.importance - a.importance; // 按重要性排序
      });

      return quickInfo;

    } catch (error) {
      console.error('构建快速实体信息失败:', error);
      return [];
    }
  }

  /**
   * 计算数据哈希值（简单版本）
   */
  private async calculateDataHash(): Promise<string> {
    try {
      const basicStats = this.hybridGraphStore.getStatistics();
      const hashInput = JSON.stringify({
        entities: basicStats.localEntityTypes,
        relationships: basicStats.localRelationships,
        timestamp: Math.floor(Date.now() / (60 * 1000)) // 分钟级精度
      });
      
      // 简单哈希算法
      let hash = 0;
      for (let i = 0; i < hashInput.length; i++) {
        const char = hashInput.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // 转换为32位整数
      }
      
      return Math.abs(hash).toString(36);

    } catch (error) {
      console.error('计算数据哈希失败:', error);
      return Date.now().toString(36);
    }
  }

  /**
   * 定期清理过期缓存
   */
  async cleanupExpiredCache(): Promise<void> {
    try {
      const allData = await chrome.storage.local.get();
      const keysToRemove: string[] = [];
      const now = Date.now();

      for (const [key, value] of Object.entries(allData)) {
        if (key.startsWith(this.QUICK_CACHE_KEY) && value && value.timestamp) {
          if (now - value.timestamp > this.QUICK_CACHE_DURATION * 2) { // 超过2倍缓存时间
            keysToRemove.push(key);
          }
        }
      }

      if (keysToRemove.length > 0) {
        await chrome.storage.local.remove(keysToRemove);
        console.log(`📊 清理了 ${keysToRemove.length} 个过期缓存`);
      }

    } catch (error) {
      console.error('清理过期缓存失败:', error);
    }
  }
}

export default EntityStatisticsCache;
