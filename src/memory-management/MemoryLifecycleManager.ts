/**
 * 记忆生命周期管理器
 * 负责智能记忆遗忘、记忆巩固和生命周期维护
 */

import { naturalLanguageQuery } from '../vectorStore';

export interface MemoryItem {
  id: string;
  content: string;
  vector: number[];
  metadata: MemoryMetadata;
  created: number;
  lastAccessed: number;
  accessCount: number;
  source: 'chat' | 'webpage' | 'jira' | 'manual' | 'document';
  importance: number; // 0-1
  userMarked: boolean;
}

export interface MemoryMetadata {
  type: 'message' | 'project' | 'person' | 'task' | 'knowledge';
  tags: string[];
  relatedMemories: string[];
  userImportance: number; // 用户标记的重要性 0-1
  systemImportance: number; // 系统计算的重要性 0-1
  consolidationLevel: 'temporary' | 'short_term' | 'long_term' | 'permanent';
  forgettingScore: number; // 遗忘评分 0-1，越高越容易被遗忘
  lastConsolidation: number;
  expiryDate?: number; // 过期时间
  protectedUntil?: number; // 保护期限
}

export interface ForgettingRule {
  id: string;
  name: string;
  enabled: boolean;
  priority: number; // 1-10，越高优先级越高
  condition: (memory: MemoryItem) => boolean;
  action: 'forget' | 'downgrade' | 'archive' | 'protect';
  description: string;
}

export interface ForgettingResult {
  totalProcessed: number;
  forgotten: number;
  downgraded: number;
  archived: number;
  spaceSaved: number; // bytes
  processingTime: number;
  nextScheduledRun: number;
}

/**
 * 记忆生命周期管理器
 */
export class MemoryLifecycleManager {
  private forgettingRules: ForgettingRule[] = [];
  private isRunning = false;
  private lastRun = 0;
  private stats = {
    totalRuns: 0,
    totalForgotten: 0,
    totalSpaceSaved: 0,
    averageProcessingTime: 0
  };

  constructor() {
    this.initializeDefaultRules();
  }

  /**
   * 核心方法：执行记忆生命周期管理
   * 这是主要的触发入口，由定时任务调用
   */
  async executeMemoryLifecycle(): Promise<ForgettingResult> {
    if (this.isRunning) {
      console.warn('⚠️ Memory lifecycle already running, skipping...');
      return this.getEmptyResult();
    }

    this.isRunning = true;
    const startTime = Date.now();
    
    try {
      console.log('🧠 开始执行记忆生命周期管理...');

      // 1. 获取所有记忆
      const allMemories = await this.getAllMemories();
      console.log(`📊 总记忆数量: ${allMemories.length}`);

      // 2. 更新记忆访问统计
      await this.updateAccessStatistics(allMemories);

      // 3. 执行遗忘规则
      const forgettingResult = await this.applyForgettingRules(allMemories);

      // 4. 执行记忆巩固
      await this.consolidateMemories(allMemories);

      // 5. 清理孤立的向量
      await this.cleanupOrphanedVectors();

      // 6. 更新统计信息
      const processingTime = Date.now() - startTime;
      await this.updateStats(forgettingResult, processingTime);

      this.lastRun = Date.now();
      
      console.log(`✅ 记忆生命周期管理完成: 遗忘${forgettingResult.forgotten}条, 用时${processingTime}ms`);
      
      return {
        ...forgettingResult,
        processingTime,
        nextScheduledRun: this.calculateNextRun()
      };

    } catch (error) {
      console.error('❌ 记忆生命周期管理失败:', error);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * 应用遗忘规则
   */
  private async applyForgettingRules(memories: MemoryItem[]): Promise<ForgettingResult> {
    const result: ForgettingResult = {
      totalProcessed: memories.length,
      forgotten: 0,
      downgraded: 0,
      archived: 0,
      spaceSaved: 0,
      processingTime: 0,
      nextScheduledRun: 0
    };

    // 按优先级排序规则
    const sortedRules = this.forgettingRules
      .filter(rule => rule.enabled)
      .sort((a, b) => b.priority - a.priority);

    for (const memory of memories) {
      // 跳过用户标记为重要的记忆
      if (memory.userMarked || memory.metadata.userImportance > 0.8) {
        continue;
      }

      // 跳过受保护的记忆
      if (memory.metadata.protectedUntil && Date.now() < memory.metadata.protectedUntil) {
        continue;
      }

      // 应用遗忘规则
      for (const rule of sortedRules) {
        if (rule.condition(memory)) {
          await this.executeAction(memory, rule.action);
          
          switch (rule.action) {
            case 'forget':
              result.forgotten++;
              result.spaceSaved += this.calculateMemorySize(memory);
              break;
            case 'downgrade':
              result.downgraded++;
              break;
            case 'archive':
              result.archived++;
              break;
          }
          
          // 只应用第一个匹配的规则
          break;
        }
      }
    }

    return result;
  }

  /**
   * 执行遗忘动作
   */
  private async executeAction(memory: MemoryItem, action: string): Promise<void> {
    switch (action) {
      case 'forget':
        await this.forgetMemory(memory.id);
        break;
      case 'downgrade':
        await this.downgradeMemory(memory);
        break;
      case 'archive':
        await this.archiveMemory(memory);
        break;
      case 'protect':
        await this.protectMemory(memory);
        break;
    }
  }

  /**
   * 彻底删除记忆
   */
  private async forgetMemory(memoryId: string): Promise<void> {
    try {
      // 从向量数据库删除
      await this.deleteFromVectorStore(memoryId);
      
      // 从本地存储删除相关数据
      await this.deleteLocalMemoryData(memoryId);
      
      // 更新关联记忆的引用
      await this.updateRelatedMemoryReferences(memoryId);
      
      console.log(`🗑️ 已遗忘记忆: ${memoryId}`);
    } catch (error) {
      console.error(`❌ 遗忘记忆失败 ${memoryId}:`, error);
    }
  }

  /**
   * 降级记忆（降低重要性等级）
   */
  private async downgradeMemory(memory: MemoryItem): Promise<void> {
    const newLevel = this.getDowngradedLevel(memory.metadata.consolidationLevel);
    
    await this.updateMemoryMetadata(memory.id, {
      consolidationLevel: newLevel,
      systemImportance: Math.max(0, memory.metadata.systemImportance - 0.2),
      lastConsolidation: Date.now()
    });
    
    console.log(`📉 记忆降级: ${memory.id} -> ${newLevel}`);
  }

  /**
   * 归档记忆（移到低优先级存储）
   */
  private async archiveMemory(memory: MemoryItem): Promise<void> {
    // 将记忆移动到归档存储
    const archivedMemory = {
      ...memory,
      metadata: {
        ...memory.metadata,
        consolidationLevel: 'archived' as any,
        archivedAt: Date.now()
      }
    };

    await this.saveToArchive(archivedMemory);
    await this.deleteFromVectorStore(memory.id);
    
    console.log(`📦 记忆归档: ${memory.id}`);
  }

  /**
   * 保护记忆（延长保护期）
   */
  private async protectMemory(memory: MemoryItem): Promise<void> {
    const protectionPeriod = 30 * 24 * 60 * 60 * 1000; // 30天
    
    await this.updateMemoryMetadata(memory.id, {
      protectedUntil: Date.now() + protectionPeriod,
      userImportance: Math.max(memory.metadata.userImportance, 0.8)
    });
    
    console.log(`🛡️ 记忆保护: ${memory.id}`);
  }

  /**
   * 初始化默认遗忘规则
   */
  private initializeDefaultRules(): void {
    this.forgettingRules = [
      // 规则1: 过期任务记忆
      {
        id: 'expired-tasks',
        name: '已过期任务清理',
        enabled: true,
        priority: 9,
        condition: (memory) => {
          if (memory.metadata.type !== 'task') return false;
          if (memory.metadata.expiryDate && Date.now() > memory.metadata.expiryDate) {
            return Date.now() - memory.metadata.expiryDate > 30 * 24 * 60 * 60 * 1000; // 过期30天
          }
          return false;
        },
        action: 'forget',
        description: '删除已过期超过30天的任务记忆'
      },

      // 规则2: 长期未访问的低重要性记忆
      {
        id: 'unused-low-importance',
        name: '长期未使用低重要性记忆',
        enabled: true,
        priority: 8,
        condition: (memory) => {
          const daysSinceLastAccess = (Date.now() - memory.lastAccessed) / (1000 * 60 * 60 * 24);
          const isLowImportance = memory.importance < 0.3 && memory.metadata.userImportance < 0.3;
          const isRarelyAccessed = memory.accessCount < 3;
          
          return daysSinceLastAccess > 90 && isLowImportance && isRarelyAccessed;
        },
        action: 'forget',
        description: '删除90天未访问的低重要性记忆'
      },

      // 规则3: 临时记忆老化
      {
        id: 'temporary-aging',
        name: '临时记忆老化',
        enabled: true,
        priority: 7,
        condition: (memory) => {
          const ageInDays = (Date.now() - memory.created) / (1000 * 60 * 60 * 24);
          const isTemporary = memory.metadata.consolidationLevel === 'temporary';
          const notRecentlyAccessed = (Date.now() - memory.lastAccessed) > 7 * 24 * 60 * 60 * 1000;
          
          return ageInDays > 30 && isTemporary && notRecentlyAccessed;
        },
        action: 'forget',
        description: '删除30天以上的临时记忆'
      },

      // 规则4: 短期记忆降级
      {
        id: 'short-term-downgrade',
        name: '短期记忆降级',
        enabled: true,
        priority: 6,
        condition: (memory) => {
          const daysSinceLastAccess = (Date.now() - memory.lastAccessed) / (1000 * 60 * 60 * 24);
          const isShortTerm = memory.metadata.consolidationLevel === 'short_term';
          const lowAccess = memory.accessCount < 5;
          
          return daysSinceLastAccess > 60 && isShortTerm && lowAccess;
        },
        action: 'downgrade',
        description: '降级60天未访问的短期记忆'
      },

      // 规则5: 重复内容合并
      {
        id: 'duplicate-content',
        name: '重复内容处理',
        enabled: true,
        priority: 5,
        condition: (memory) => {
          // 这里需要更复杂的重复检测逻辑
          return memory.metadata.systemImportance < 0.2 && memory.accessCount === 0;
        },
        action: 'archive',
        description: '归档重复或低价值内容'
      },

      // 规则6: 项目完成后清理
      {
        id: 'completed-project',
        name: '已完成项目清理',
        enabled: true,
        priority: 4,
        condition: (memory) => {
          const isProjectMemory = memory.metadata.type === 'project';
          const hasCompletionTag = memory.metadata.tags.includes('completed');
          const ageAfterCompletion = Date.now() - (memory.metadata.expiryDate || memory.created);
          
          return isProjectMemory && hasCompletionTag && ageAfterCompletion > 365 * 24 * 60 * 60 * 1000; // 1年
        },
        action: 'archive',
        description: '归档完成1年以上的项目记忆'
      }
    ];
  }

  /**
   * 记忆巩固：将重要的记忆提升等级
   */
  private async consolidateMemories(memories: MemoryItem[]): Promise<void> {
    const consolidationCandidates = memories.filter(memory => {
      const isFrequentlyAccessed = memory.accessCount > 10;
      const isRecentlyAccessed = (Date.now() - memory.lastAccessed) < 7 * 24 * 60 * 60 * 1000;
      const isImportant = memory.importance > 0.7 || memory.metadata.userImportance > 0.7;
      
      return (isFrequentlyAccessed || isImportant) && isRecentlyAccessed;
    });

    for (const memory of consolidationCandidates) {
      await this.promoteMemory(memory);
    }

    console.log(`🧠 记忆巩固完成: ${consolidationCandidates.length} 条记忆被提升`);
  }

  /**
   * 提升记忆等级
   */
  private async promoteMemory(memory: MemoryItem): Promise<void> {
    const newLevel = this.getPromotedLevel(memory.metadata.consolidationLevel);
    
    if (newLevel !== memory.metadata.consolidationLevel) {
      await this.updateMemoryMetadata(memory.id, {
        consolidationLevel: newLevel,
        systemImportance: Math.min(1, memory.metadata.systemImportance + 0.1),
        lastConsolidation: Date.now()
      });
      
      console.log(`📈 记忆提升: ${memory.id} -> ${newLevel}`);
    }
  }

  /**
   * 更新访问统计
   */
  private async updateAccessStatistics(memories: MemoryItem[]): Promise<void> {
    const accessStats = await this.getRecentAccessStats();
    
    for (const memory of memories) {
      const recentAccess = accessStats.get(memory.id);
      if (recentAccess) {
        await this.updateMemoryMetadata(memory.id, {
          systemImportance: Math.min(1, memory.metadata.systemImportance + 0.05),
          forgettingScore: Math.max(0, memory.metadata.forgettingScore - 0.1)
        });
      } else {
        // 增加遗忘评分
        await this.updateMemoryMetadata(memory.id, {
          forgettingScore: Math.min(1, memory.metadata.forgettingScore + 0.01)
        });
      }
    }
  }

  /**
   * 计算下次运行时间
   */
  private calculateNextRun(): number {
    // 根据记忆数量和系统负载动态调整运行频率
    const baseInterval = 6 * 60 * 60 * 1000; // 基础6小时
    return Date.now() + baseInterval;
  }

  /**
   * 获取所有记忆（模拟实现）
   */
  private async getAllMemories(): Promise<MemoryItem[]> {
    try {
      // 这里应该从实际的向量数据库获取
      const result = await chrome.storage.local.get('memoryIndex');
      const memoryIndex = result.memoryIndex || [];
      
      return memoryIndex.map(item => ({
        ...item,
        metadata: {
          forgettingScore: 0,
          ...item.metadata
        }
      }));
    } catch (error) {
      console.error('获取记忆列表失败:', error);
      return [];
    }
  }

  /**
   * 辅助方法
   */
  private getDowngradedLevel(currentLevel: string): string {
    const levels = ['permanent', 'long_term', 'short_term', 'temporary'];
    const currentIndex = levels.indexOf(currentLevel);
    return levels[Math.min(levels.length - 1, currentIndex + 1)];
  }

  private getPromotedLevel(currentLevel: string): string {
    const levels = ['temporary', 'short_term', 'long_term', 'permanent'];
    const currentIndex = levels.indexOf(currentLevel);
    return levels[Math.max(0, currentIndex + 1)];
  }

  private calculateMemorySize(memory: MemoryItem): number {
    return JSON.stringify(memory).length * 2; // 估算字节数
  }

  private getEmptyResult(): ForgettingResult {
    return {
      totalProcessed: 0,
      forgotten: 0,
      downgraded: 0,
      archived: 0,
      spaceSaved: 0,
      processingTime: 0,
      nextScheduledRun: Date.now() + 6 * 60 * 60 * 1000
    };
  }

  // 需要实现的辅助方法
  private async deleteFromVectorStore(memoryId: string): Promise<void> {
    // 实现向量数据库删除
  }

  private async deleteLocalMemoryData(memoryId: string): Promise<void> {
    // 实现本地数据删除
  }

  private async updateRelatedMemoryReferences(memoryId: string): Promise<void> {
    // 更新相关记忆的引用
  }

  private async updateMemoryMetadata(memoryId: string, updates: Partial<MemoryMetadata>): Promise<void> {
    // 更新记忆元数据
  }

  private async saveToArchive(memory: MemoryItem): Promise<void> {
    // 保存到归档存储
  }

  private async getRecentAccessStats(): Promise<Map<string, number>> {
    // 获取最近的访问统计
    return new Map();
  }

  private async cleanupOrphanedVectors(): Promise<void> {
    // 清理孤立的向量
  }

  private async updateStats(result: ForgettingResult, processingTime: number): Promise<void> {
    this.stats.totalRuns++;
    this.stats.totalForgotten += result.forgotten;
    this.stats.totalSpaceSaved += result.spaceSaved;
    this.stats.averageProcessingTime = 
      (this.stats.averageProcessingTime * (this.stats.totalRuns - 1) + processingTime) / this.stats.totalRuns;

    await chrome.storage.local.set({ memoryLifecycleStats: this.stats });
  }

  /**
   * 获取遗忘统计信息
   */
  getStats() {
    return {
      ...this.stats,
      lastRun: this.lastRun,
      isRunning: this.isRunning,
      totalRules: this.forgettingRules.length,
      enabledRules: this.forgettingRules.filter(r => r.enabled).length
    };
  }

  /**
   * 手动触发记忆整理
   */
  async manualCleanup(): Promise<ForgettingResult> {
    console.log('🔧 手动触发记忆整理...');
    return await this.executeMemoryLifecycle();
  }

  /**
   * 添加自定义遗忘规则
   */
  addForgettingRule(rule: ForgettingRule): void {
    this.forgettingRules.push(rule);
    this.saveForgettingRules();
  }

  /**
   * 移除遗忘规则
   */
  removeForgettingRule(ruleId: string): void {
    this.forgettingRules = this.forgettingRules.filter(rule => rule.id !== ruleId);
    this.saveForgettingRules();
  }

  /**
   * 保存遗忘规则到存储
   */
  private async saveForgettingRules(): Promise<void> {
    await chrome.storage.sync.set({ forgettingRules: this.forgettingRules });
  }
}

export default MemoryLifecycleManager;