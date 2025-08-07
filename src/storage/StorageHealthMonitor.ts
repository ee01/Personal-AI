/**
 * 存储健康监控服务
 * 监控混合图存储系统的健康状态，执行定期维护任务
 */

import HybridGraphStore from './HybridGraphStore';
import { MemoryLifecycleManager } from '../memory-management/MemoryLifecycleManager';
import { getEnvConfig } from '../utils';

export interface StorageHealthMetrics {
  timestamp: number;
  vectorStore: {
    available: boolean;
    collections: number;
    documents: number;
    lastCleanup: number;
    avgResponseTime: number;
    errors: string[];
  };
  hybridGraph: {
    available: boolean;
    cloudConnected: boolean;
    localRelationships: number;
    localEntityTypes: number;
    lastSync: number;
    lastBackup: number;
    syncErrors: string[];
  };
  memory: {
    totalMemories: number;
    forgottenToday: number;
    lastCleanup: number;
    cleanupErrors: string[];
  };
  overall: {
    status: 'healthy' | 'warning' | 'critical' | 'offline';
    score: number; // 0-100
    issues: string[];
    recommendations: string[];
  };
}

export interface MaintenanceTask {
  id: string;
  name: string;
  type: 'cleanup' | 'sync' | 'backup' | 'health_check';
  interval: number; // minutes
  lastRun: number;
  nextRun: number;
  enabled: boolean;
  runCount: number;
  avgDuration: number;
  lastResult?: any;
  errors: string[];
}

/**
 * 存储健康监控器
 */
export class StorageHealthMonitor {
  private hybridGraph: HybridGraphStore;
  private memoryManager: MemoryLifecycleManager;
  private isRunning = false;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private maintenanceTasks: Map<string, MaintenanceTask> = new Map();
  private healthHistory: StorageHealthMetrics[] = [];
  private readonly MAX_HISTORY = 100; // 保留最近100次健康检查记录

  constructor() {
    this.hybridGraph = new HybridGraphStore();
    this.memoryManager = new MemoryLifecycleManager();
    this.initializeMaintenanceTasks();
  }

  /**
   * 初始化监控器
   */
  async initialize(): Promise<boolean> {
    try {
      console.log('🔄 初始化存储健康监控器...');

      // 初始化混合图存储
      const graphInitialized = await this.hybridGraph.initialize();
      if (!graphInitialized) {
        console.warn('⚠️ 混合图存储初始化失败，但监控器将继续运行');
      }

      console.log('✅ 存储健康监控器初始化完成');
      return true;

    } catch (error) {
      console.error('❌ 存储健康监控器初始化失败:', error);
      return false;
    }
  }

  /**
   * 启动健康监控
   */
  startMonitoring(intervalMinutes: number = 10): void {
    if (this.isRunning) {
      console.log('⚠️ 健康监控已在运行中');
      return;
    }

    console.log(`🚀 启动存储健康监控，检查间隔: ${intervalMinutes}分钟`);
    
    this.isRunning = true;
    
    // 立即执行一次健康检查
    this.performHealthCheck();
    
    // 设置定期检查
    this.monitoringInterval = setInterval(() => {
      this.performHealthCheck();
      this.runMaintenanceTasks();
    }, intervalMinutes * 60 * 1000);

    // 设置维护任务定时器
    this.scheduleMaintenanceTasks();
  }

  /**
   * 停止健康监控
   */
  stopMonitoring(): void {
    console.log('🛑 停止存储健康监控');
    
    this.isRunning = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  /**
   * 执行健康检查
   */
  async performHealthCheck(): Promise<StorageHealthMetrics> {
    const startTime = Date.now();
    const metrics: StorageHealthMetrics = {
      timestamp: startTime,
      vectorStore: {
        available: false,
        collections: 0,
        documents: 0,
        lastCleanup: 0,
        avgResponseTime: 0,
        errors: []
      },
      hybridGraph: {
        available: false,
        cloudConnected: false,
        localRelationships: 0,
        localEntityTypes: 0,
        lastSync: 0,
        lastBackup: 0,
        syncErrors: []
      },
      memory: {
        totalMemories: 0,
        forgottenToday: 0,
        lastCleanup: 0,
        cleanupErrors: []
      },
      overall: {
        status: 'offline',
        score: 0,
        issues: [],
        recommendations: []
      }
    };

    try {
      // 1. 检查混合图存储
      await this.checkHybridGraphHealth(metrics);

      // 2. 检查记忆管理
      await this.checkMemoryHealth(metrics);

      // 3. 计算整体健康状态
      this.calculateOverallHealth(metrics);

      // 4. 保存健康记录
      this.saveHealthMetrics(metrics);

      // 5. 输出健康报告
      this.logHealthReport(metrics);

      return metrics;

    } catch (error) {
      console.error('❌ 健康检查失败:', error);
      metrics.overall.status = 'critical';
      metrics.overall.issues.push(`健康检查失败: ${error.message}`);
      return metrics;
    }
  }

  /**
   * 检查混合图存储健康状态
   */
  private async checkHybridGraphHealth(metrics: StorageHealthMetrics): Promise<void> {
    try {
      const startTime = Date.now();
      const stats = this.hybridGraph.getStatistics();
      
      metrics.hybridGraph.available = true;
      metrics.hybridGraph.cloudConnected = stats.isCloudAvailable;
      metrics.hybridGraph.localRelationships = stats.localRelationships;
      metrics.hybridGraph.localEntityTypes = stats.localEntityTypes;
      metrics.hybridGraph.lastSync = stats.lastSync;

      // 测试基本操作响应时间
      const responseTime = Date.now() - startTime;
      
      // 健康检查
      if (!stats.isCloudAvailable) {
        metrics.hybridGraph.syncErrors.push('云端连接不可用');
      }

      if (stats.localRelationships > 50000) {
        metrics.hybridGraph.syncErrors.push('本地关系数量过多，建议清理');
      }

      if (Date.now() - stats.lastSync > 24 * 60 * 60 * 1000) {
        metrics.hybridGraph.syncErrors.push('超过24小时未同步');
      }

    } catch (error) {
      metrics.hybridGraph.available = false;
      metrics.hybridGraph.syncErrors.push(`图存储检查失败: ${error.message}`);
    }
  }

  /**
   * 检查记忆管理健康状态
   */
  private async checkMemoryHealth(metrics: StorageHealthMetrics): Promise<void> {
    try {
      const memoryStats = this.memoryManager.getStats();
      
      metrics.memory.totalMemories = memoryStats.totalProcessed || 0;
      metrics.memory.forgottenToday = memoryStats.totalForgotten || 0;
      metrics.memory.lastCleanup = memoryStats.lastRun || 0;

      // 健康检查
      if (Date.now() - metrics.memory.lastCleanup > 12 * 60 * 60 * 1000) {
        metrics.memory.cleanupErrors.push('超过12小时未执行记忆清理');
      }

    } catch (error) {
      metrics.memory.cleanupErrors.push(`记忆管理检查失败: ${error.message}`);
    }
  }

  /**
   * 计算整体健康状态
   */
  private calculateOverallHealth(metrics: StorageHealthMetrics): void {
    let score = 100;
    const issues: string[] = [];
    const recommendations: string[] = [];

    // 图存储评分
    if (!metrics.hybridGraph.available) {
      score -= 40;
      issues.push('图存储不可用');
      recommendations.push('检查ChromaDB连接和配置');
    } else {
      if (!metrics.hybridGraph.cloudConnected) {
        score -= 15;
        issues.push('图存储云端连接失败');
        recommendations.push('检查ChromaDB服务状态');
      }
      
      if (metrics.hybridGraph.syncErrors.length > 0) {
        score -= 10;
        issues.push(...metrics.hybridGraph.syncErrors);
      }
    }

    // 记忆管理评分
    if (metrics.memory.cleanupErrors.length > 0) {
      score -= 10;
      issues.push(...metrics.memory.cleanupErrors);
      recommendations.push('执行记忆清理任务');
    }

    // 确定状态等级
    if (score >= 90) {
      metrics.overall.status = 'healthy';
    } else if (score >= 70) {
      metrics.overall.status = 'warning';
    } else if (score >= 30) {
      metrics.overall.status = 'critical';
    } else {
      metrics.overall.status = 'offline';
    }

    metrics.overall.score = Math.max(0, score);
    metrics.overall.issues = issues;
    metrics.overall.recommendations = recommendations;
  }

  /**
   * 初始化维护任务
   */
  private initializeMaintenanceTasks(): void {
    const tasks: Omit<MaintenanceTask, 'lastRun' | 'nextRun' | 'runCount' | 'avgDuration' | 'errors'>[] = [
      {
        id: 'graph-sync',
        name: '图数据同步',
        type: 'sync',
        interval: 360, // 6小时
        enabled: true
      },
      {
        id: 'graph-backup',
        name: '图数据备份',
        type: 'backup',
        interval: 1440, // 24小时
        enabled: true
      },
      {
        id: 'graph-cleanup',
        name: '图数据清理',
        type: 'cleanup',
        interval: 4320, // 3天
        enabled: true
      },
      {
        id: 'memory-cleanup',
        name: '记忆生命周期管理',
        type: 'cleanup',
        interval: 360, // 6小时
        enabled: true
      },
      {
        id: 'health-check',
        name: '深度健康检查',
        type: 'health_check',
        interval: 60, // 1小时
        enabled: true
      }
    ];

    const now = Date.now();
    for (const task of tasks) {
      const fullTask: MaintenanceTask = {
        ...task,
        lastRun: 0,
        nextRun: now + task.interval * 60 * 1000,
        runCount: 0,
        avgDuration: 0,
        errors: []
      };
      this.maintenanceTasks.set(task.id, fullTask);
    }

    console.log(`📋 初始化了 ${tasks.length} 个维护任务`);
  }

  /**
   * 调度维护任务
   */
  private scheduleMaintenanceTasks(): void {
    // 每分钟检查一次是否有需要执行的维护任务
    setInterval(() => {
      this.runMaintenanceTasks();
    }, 60 * 1000);
  }

  /**
   * 运行维护任务
   */
  private async runMaintenanceTasks(): Promise<void> {
    const now = Date.now();
    
    for (const [taskId, task] of this.maintenanceTasks) {
      if (!task.enabled || now < task.nextRun) {
        continue;
      }

      console.log(`🔧 执行维护任务: ${task.name}`);
      
      const startTime = Date.now();
      try {
        await this.executeMaintenanceTask(task);
        
        // 更新任务状态
        const duration = Date.now() - startTime;
        task.lastRun = now;
        task.nextRun = now + task.interval * 60 * 1000;
        task.runCount++;
        task.avgDuration = (task.avgDuration * (task.runCount - 1) + duration) / task.runCount;
        
        console.log(`✅ 维护任务 ${task.name} 完成，用时 ${duration}ms`);

      } catch (error) {
        console.error(`❌ 维护任务 ${task.name} 失败:`, error);
        task.errors.push(`${new Date().toISOString()}: ${error.message}`);
        
        // 保留最近10个错误
        if (task.errors.length > 10) {
          task.errors = task.errors.slice(-10);
        }
      }
    }
  }

  /**
   * 执行具体的维护任务
   */
  private async executeMaintenanceTask(task: MaintenanceTask): Promise<void> {
    switch (task.type) {
      case 'sync':
        if (task.id === 'graph-sync') {
          await this.hybridGraph.performSync();
        }
        break;

      case 'backup':
        if (task.id === 'graph-backup') {
          await this.hybridGraph.backupToCloud();
        }
        break;

      case 'cleanup':
        if (task.id === 'graph-cleanup') {
          await this.hybridGraph.cleanup(90); // 清理90天前的数据
        } else if (task.id === 'memory-cleanup') {
          await this.memoryManager.executeMemoryLifecycle();
        }
        break;

      case 'health_check':
        if (task.id === 'health-check') {
          await this.performHealthCheck();
        }
        break;

      default:
        throw new Error(`未知的维护任务类型: ${task.type}`);
    }
  }

  /**
   * 保存健康指标
   */
  private saveHealthMetrics(metrics: StorageHealthMetrics): void {
    this.healthHistory.push(metrics);
    
    // 保持历史记录数量限制
    if (this.healthHistory.length > this.MAX_HISTORY) {
      this.healthHistory = this.healthHistory.slice(-this.MAX_HISTORY);
    }

    // 保存到Chrome Storage
    try {
      chrome.storage.local.set({
        storageHealthMetrics: {
          latest: metrics,
          lastUpdate: Date.now(),
          historyCount: this.healthHistory.length
        }
      });
    } catch (error) {
      console.error('保存健康指标失败:', error);
    }
  }

  /**
   * 输出健康报告
   */
  private logHealthReport(metrics: StorageHealthMetrics): void {
    const { overall, hybridGraph, memory } = metrics;
    
    console.log(`📊 存储健康报告 [${overall.status.toUpperCase()}] 评分: ${overall.score}/100`);
    
    if (overall.status === 'healthy') {
      console.log('✅ 所有存储系统运行正常');
    } else {
      console.log('⚠️ 发现问题:');
      overall.issues.forEach(issue => console.log(`  • ${issue}`));
      
      if (overall.recommendations.length > 0) {
        console.log('💡 建议:');
        overall.recommendations.forEach(rec => console.log(`  • ${rec}`));
      }
    }

    console.log(`📈 统计: 图关系 ${hybridGraph.localRelationships}, 图实体类型 ${hybridGraph.localEntityTypes}, 已遗忘记忆 ${memory.forgottenToday}`);
  }

  /**
   * 获取健康指标历史
   */
  getHealthHistory(limit?: number): StorageHealthMetrics[] {
    const history = limit ? this.healthHistory.slice(-limit) : this.healthHistory;
    return history;
  }

  /**
   * 获取最新健康指标
   */
  getLatestHealthMetrics(): StorageHealthMetrics | null {
    return this.healthHistory.length > 0 ? this.healthHistory[this.healthHistory.length - 1] : null;
  }

  /**
   * 获取维护任务状态
   */
  getMaintenanceTasksStatus(): MaintenanceTask[] {
    return Array.from(this.maintenanceTasks.values());
  }

  /**
   * 手动执行维护任务
   */
  async runMaintenanceTask(taskId: string): Promise<boolean> {
    const task = this.maintenanceTasks.get(taskId);
    if (!task) {
      throw new Error(`维护任务不存在: ${taskId}`);
    }

    try {
      console.log(`🔧 手动执行维护任务: ${task.name}`);
      await this.executeMaintenanceTask(task);
      
      // 更新任务状态
      task.lastRun = Date.now();
      task.runCount++;
      
      console.log(`✅ 维护任务 ${task.name} 手动执行完成`);
      return true;

    } catch (error) {
      console.error(`❌ 手动执行维护任务 ${task.name} 失败:`, error);
      task.errors.push(`${new Date().toISOString()}: 手动执行失败 - ${error.message}`);
      return false;
    }
  }

  /**
   * 启用/禁用维护任务
   */
  setMaintenanceTaskEnabled(taskId: string, enabled: boolean): boolean {
    const task = this.maintenanceTasks.get(taskId);
    if (!task) {
      return false;
    }

    task.enabled = enabled;
    console.log(`${enabled ? '启用' : '禁用'} 维护任务: ${task.name}`);
    return true;
  }

  /**
   * 销毁监控器
   */
  destroy(): void {
    this.stopMonitoring();
    
    if (this.hybridGraph) {
      this.hybridGraph.destroy();
    }
  }
}

// 创建全局监控实例
let globalMonitor: StorageHealthMonitor | null = null;

/**
 * 获取全局存储健康监控器实例
 */
export async function getStorageHealthMonitor(): Promise<StorageHealthMonitor> {
  if (!globalMonitor) {
    globalMonitor = new StorageHealthMonitor();
    await globalMonitor.initialize();
  }
  return globalMonitor;
}

export default StorageHealthMonitor;