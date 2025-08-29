/**
 * 系统维护工具
 * 负责健康监控、定时维护、数据清理等任务
 */

import { CloudStorage } from './CloudStorage';
import { LocalStorage } from './LocalStorage';

// 策略层接口定义（用于与 MemorySystem 交互）
interface StrategyLayer {
  getLastSyncTime(): Promise<number>;
  performInitialSyncIfNeeded(): Promise<{
    isNewDevice: boolean;
    syncPerformed: boolean;
    entitiesDownloaded: number;
    relationshipsRestored: number;
  }>;
  syncCache(): Promise<void>;
}

export interface SystemHealthStatus {
  timestamp: number;
  cloudStorage: {
    available: boolean;
    connected: boolean;
    entityCount: number;
    lastSync: number;
    errors: string[];
  };
  localCache: {
    available: boolean;
    entityCount: number;
    relationshipCount: number;
    cacheSize: number;
    lastCleanup: number;
    errors: string[];
  };
  overall: {
    status: 'healthy' | 'warning' | 'critical' | 'offline';
    score: number; // 0-100
    issues: string[];
    recommendations: string[];
  };
}

export interface MaintenanceResult {
  success: boolean;
  tasksCompleted: string[];
  tasksFailed: string[];
  cleanedEntities: number;
  cleanedRelationships: number;
  freedSpace: number;
  totalTime: number;
  nextMaintenanceTime: number;
}

/**
 * 系统维护工具
 */
export class SystemMaintenanceTool {
  private cloudStorage: CloudStorage;
  private localStorage: LocalStorage;
  private strategyLayer: StrategyLayer;
  
  private isMonitoringActive = false;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private maintenanceInterval: NodeJS.Timeout | null = null;
  
  private readonly MONITORING_INTERVAL = 5 * 60 * 1000; // 5分钟
  private readonly MAINTENANCE_INTERVAL = 6 * 60 * 60 * 1000; // 6小时
  private readonly CACHE_CLEANUP_THRESHOLD = 1000; // 实体数量阈值

  constructor(cloudStorage: CloudStorage, localStorage: LocalStorage, strategyLayer: StrategyLayer) {
    this.cloudStorage = cloudStorage;
    this.localStorage = localStorage;
    this.strategyLayer = strategyLayer;
  }

  /**
   * 启动系统监控
   */
  startMonitoring(): void {
    if (this.isMonitoringActive) {
      console.log('⚠️ 系统监控已经在运行');
      return;
    }

    this.isMonitoringActive = true;
    
    // 启动健康监控
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.performHealthCheck();
      } catch (error) {
        console.error('健康检查失败:', error);
      }
    }, this.MONITORING_INTERVAL);

    // 启动定期维护
    this.maintenanceInterval = setInterval(async () => {
      try {
        await this.performAutomaticMaintenance();
      } catch (error) {
        console.error('自动维护失败:', error);
      }
    }, this.MAINTENANCE_INTERVAL);

    console.log('🔍 系统监控已启动');
  }

  /**
   * 停止系统监控
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    if (this.maintenanceInterval) {
      clearInterval(this.maintenanceInterval);
      this.maintenanceInterval = null;
    }

    this.isMonitoringActive = false;
    console.log('🔍 系统监控已停止');
  }

  /**
   * 执行健康检查
   */
  async performHealthCheck(): Promise<SystemHealthStatus> {
    const startTime = Date.now();
    const status: SystemHealthStatus = {
      timestamp: startTime,
      cloudStorage: {
        available: false,
        connected: false,
        entityCount: 0,
        lastSync: 0,
        errors: []
      },
      localCache: {
        available: false,
        entityCount: 0,
        relationshipCount: 0,
        cacheSize: 0,
        lastCleanup: 0,
        errors: []
      },
      overall: {
        status: 'offline',
        score: 0,
        issues: [],
        recommendations: []
      }
    };

    try {
      // 1. 检查云端存储
      await this.checkCloudStorageHealth(status);

      // 2. 检查本地缓存
      await this.checkLocalCacheHealth(status);

      // 3. 计算整体健康状态
      this.calculateOverallHealth(status);

      // 4. 生成建议
      this.generateRecommendations(status);

      // 5. 保存健康记录
      await this.saveHealthMetrics(status);

      console.log(`🏥 健康检查完成 - 状态: ${status.overall.status}, 评分: ${status.overall.score}`);

      return status;

    } catch (error) {
      console.error('❌ 健康检查失败:', error);
      status.overall.status = 'critical';
      status.overall.issues.push(`健康检查失败: ${error.message}`);
      return status;
    }
  }

  /**
   * 检查云端存储健康状态
   */
  private async checkCloudStorageHealth(status: SystemHealthStatus): Promise<void> {
    try {
      status.cloudStorage.available = true;
      status.cloudStorage.connected = await this.cloudStorage.isConnected();

      if (status.cloudStorage.connected) {
        status.cloudStorage.entityCount = await this.cloudStorage.getEntityCount();
        status.cloudStorage.lastSync = await this.strategyLayer.getLastSyncTime();
      } else {
        status.cloudStorage.errors.push('云端存储连接失败');
      }
    } catch (error) {
      status.cloudStorage.errors.push(`云端存储检查失败: ${error.message}`);
    }
  }

  /**
   * 检查本地缓存健康状态
   */
  private async checkLocalCacheHealth(status: SystemHealthStatus): Promise<void> {
    try {
      status.localCache.available = true;
      status.localCache.cacheSize = await this.localStorage.getCacheSize();
      
      // 获取实体统计
      const entityStats = await this.localStorage.getEntityStatistics();
      status.localCache.entityCount = entityStats.totalEntities;
      status.localCache.relationshipCount = entityStats.totalRelationships;

      // 检查缓存大小
      if (status.localCache.cacheSize > 4 * 1024 * 1024) { // 4MB
        status.localCache.errors.push('本地缓存大小超过4MB，建议清理');
      }

      // 检查实体数量
      if (status.localCache.entityCount > this.CACHE_CLEANUP_THRESHOLD) {
        status.localCache.errors.push(`实体数量过多(${status.localCache.entityCount})，建议清理`);
      }

    } catch (error) {
      status.localCache.errors.push(`本地缓存检查失败: ${error.message}`);
    }
  }

  /**
   * 计算整体健康状态
   */
  private calculateOverallHealth(status: SystemHealthStatus): void {
    let score = 100;
    const issues: string[] = [];

    // 云端存储健康度检查
    if (!status.cloudStorage.connected) {
      score -= 30;
      issues.push('云端存储连接异常');
    }

    // 本地缓存健康度检查
    if (status.localCache.errors.length > 0) {
      score -= 20;
      issues.push('本地缓存存在问题');
    }

    // 同步状态检查
    const lastSyncAge = Date.now() - status.cloudStorage.lastSync;
    if (lastSyncAge > 24 * 60 * 60 * 1000) { // 超过24小时
      score -= 25;
      issues.push('超过24小时未同步');
    }

    // 缓存大小检查
    if (status.localCache.cacheSize > 3 * 1024 * 1024) { // 3MB
      score -= 15;
      issues.push('本地缓存占用空间过大');
    }

    // 确定状态
    if (score >= 90) {
      status.overall.status = 'healthy';
    } else if (score >= 70) {
      status.overall.status = 'warning';
    } else if (score >= 40) {
      status.overall.status = 'critical';
    } else {
      status.overall.status = 'offline';
    }

    status.overall.score = Math.max(0, score);
    status.overall.issues = issues;
  }

  /**
   * 生成维护建议
   */
  private generateRecommendations(status: SystemHealthStatus): void {
    const recommendations: string[] = [];

    if (!status.cloudStorage.connected) {
      recommendations.push('检查网络连接，重新连接云端存储');
    }

    if (status.localCache.cacheSize > 3 * 1024 * 1024) {
      recommendations.push('执行缓存清理，释放本地存储空间');
    }

    if (status.localCache.entityCount > this.CACHE_CLEANUP_THRESHOLD) {
      recommendations.push('清理旧实体数据，保持缓存效率');
    }

    const lastSyncAge = Date.now() - status.cloudStorage.lastSync;
    if (lastSyncAge > 12 * 60 * 60 * 1000) { // 超过12小时
      recommendations.push('执行数据同步，保持数据一致性');
    }

    if (status.localCache.relationshipCount > 500) {
      recommendations.push('备份关系数据到云端，防止数据丢失');
    }

    status.overall.recommendations = recommendations;
  }

  /**
   * 执行自动维护
   */
  async performAutomaticMaintenance(): Promise<MaintenanceResult> {
    const startTime = Date.now();
    const result: MaintenanceResult = {
      success: false,
      tasksCompleted: [],
      tasksFailed: [],
      cleanedEntities: 0,
      cleanedRelationships: 0,
      freedSpace: 0,
      totalTime: 0,
      nextMaintenanceTime: Date.now() + this.MAINTENANCE_INTERVAL
    };

    try {
      console.log('🔧 开始自动维护...');

      // 1. 清理过期缓存
      try {
        await this.localStorage.clearExpiredCache();
        result.tasksCompleted.push('清理过期缓存');
      } catch (error) {
        result.tasksFailed.push('清理过期缓存失败');
      }

      // 2. 检查并执行新设备同步
      try {
        const syncResult = await this.strategyLayer.performInitialSyncIfNeeded();
        if (syncResult.syncPerformed) {
          result.tasksCompleted.push(`新设备同步: ${syncResult.entitiesDownloaded} 个实体`);
        }
      } catch (error) {
        result.tasksFailed.push('新设备同步检查失败');
      }

      // 3. 备份关系数据（每天一次）
      try {
        const lastBackup = await this.getLastBackupTime();
        if (Date.now() - lastBackup > 24 * 60 * 60 * 1000) {
          const relationshipData = await this.localStorage.getRelationshipBackupData();
          if (relationshipData) {
            const backupSuccess = await this.cloudStorage.backupRelationships(relationshipData);
            if (backupSuccess) {
              result.tasksCompleted.push('备份关系数据');
              await this.setLastBackupTime(Date.now());
            } else {
              result.tasksFailed.push('备份关系数据失败');
            }
          }
        }
      } catch (error) {
        result.tasksFailed.push('关系数据备份失败');
      }

      // 4. 计算释放的空间
      const finalCacheSize = await this.localStorage.getCacheSize();
      result.freedSpace = Math.max(0, finalCacheSize);

      result.success = result.tasksFailed.length === 0;
      result.totalTime = Date.now() - startTime;

      console.log(`🔧 自动维护完成 - 成功: ${result.tasksCompleted.length}, 失败: ${result.tasksFailed.length}`);

      return result;

    } catch (error) {
      console.error('❌ 自动维护失败:', error);
      result.tasksFailed.push(`维护过程异常: ${error.message}`);
      result.totalTime = Date.now() - startTime;
      return result;
    }
  }

  /**
   * 手动执行完整维护
   */
  async performFullMaintenance(options?: {
    cleanupEntities?: boolean;
    cleanupRelationships?: boolean;
    forceSync?: boolean;
    backupData?: boolean;
  }): Promise<MaintenanceResult> {
    const startTime = Date.now();
    const opts = {
      cleanupEntities: true,
      cleanupRelationships: true,
      forceSync: false,
      backupData: true,
      ...options
    };

    const result: MaintenanceResult = {
      success: false,
      tasksCompleted: [],
      tasksFailed: [],
      cleanedEntities: 0,
      cleanedRelationships: 0,
      freedSpace: 0,
      totalTime: 0,
      nextMaintenanceTime: Date.now() + this.MAINTENANCE_INTERVAL
    };

    try {
      console.log('🔧 开始完整维护...');

      const initialCacheSize = await this.localStorage.getCacheSize();

      // 1. 清理过期缓存
      try {
        await this.localStorage.clearExpiredCache();
        result.tasksCompleted.push('清理过期缓存');
      } catch (error) {
        result.tasksFailed.push('清理过期缓存失败');
      }

      // 2. 强制同步（如果请求）
      if (opts.forceSync) {
        try {
          await this.strategyLayer.syncCache();
          result.tasksCompleted.push('强制同步缓存');
        } catch (error) {
          result.tasksFailed.push('强制同步失败');
        }
      }

      // 3. 备份数据（如果请求）
      if (opts.backupData) {
        try {
          const relationshipData = await this.localStorage.getRelationshipBackupData();
          if (relationshipData) {
            const backupSuccess = await this.cloudStorage.backupRelationships(relationshipData);
            if (backupSuccess) {
              result.tasksCompleted.push('备份关系数据');
            } else {
              result.tasksFailed.push('备份关系数据失败');
            }
          }
        } catch (error) {
          result.tasksFailed.push('数据备份失败');
        }
      }

      // 4. 计算释放的空间
      const finalCacheSize = await this.localStorage.getCacheSize();
      result.freedSpace = initialCacheSize - finalCacheSize;

      result.success = result.tasksFailed.length === 0;
      result.totalTime = Date.now() - startTime;

      console.log(`🔧 完整维护完成 - 成功: ${result.tasksCompleted.length}, 失败: ${result.tasksFailed.length}`);

      return result;

    } catch (error) {
      console.error('❌ 完整维护失败:', error);
      result.tasksFailed.push(`维护过程异常: ${error.message}`);
      result.totalTime = Date.now() - startTime;
      return result;
    }
  }

  /**
   * 保存健康指标
   */
  private async saveHealthMetrics(status: SystemHealthStatus): Promise<void> {
    try {
      await chrome.storage.local.set({
        'system_health_status': status,
        'system_health_timestamp': status.timestamp
      });
    } catch (error) {
      console.error('保存健康指标失败:', error);
    }
  }

  /**
   * 获取最后备份时间
   */
  private async getLastBackupTime(): Promise<number> {
    try {
      const result = await chrome.storage.local.get('last_backup_time');
      return result.last_backup_time || 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * 设置最后备份时间
   */
  private async setLastBackupTime(time: number): Promise<void> {
    try {
      await chrome.storage.local.set({ 'last_backup_time': time });
    } catch (error) {
      console.error('设置备份时间失败:', error);
    }
  }

  /**
   * 获取系统状态
   */
  getSystemStatus(): {
    isMonitoring: boolean;
    monitoringInterval: number;
    maintenanceInterval: number;
    nextMaintenance: number;
  } {
    return {
      isMonitoring: this.isMonitoringActive,
      monitoringInterval: this.MONITORING_INTERVAL,
      maintenanceInterval: this.MAINTENANCE_INTERVAL,
      nextMaintenance: Date.now() + this.MAINTENANCE_INTERVAL
    };
  }
}

// 创建工厂函数
export function createSystemMaintenanceTool(
  cloudStorage: CloudStorage,
  localStorage: LocalStorage,
  strategyLayer: StrategyLayer
): SystemMaintenanceTool {
  return new SystemMaintenanceTool(cloudStorage, localStorage, strategyLayer);
}
