/**
 * 用户画像管理器
 * 负责用户画像的创建、更新、查询和权重衰变计算
 */

import { 
  UserProfile, 
  UserInterestItem, 
  UserAction, 
  UserProfileQuery, 
  UserProfileUpdate,
  UserProfileAnalysis,
  WeightDecayConfig,
  DEFAULT_WEIGHT_DECAY_CONFIG,
  TimeZoneActivity
} from '../types/userProfile';
import { CloudStorage } from '../storage/CloudStorage';

export class UserProfileManager {
  private profile: UserProfile | null = null;
  private decayConfig: WeightDecayConfig;
  private lastDecayUpdate: number = Date.now();
  private updateThrottleMap: Map<string, number> = new Map();
  private cloudStorage: CloudStorage | null = null;
  
  constructor(
    private userId: string,
    decayConfig: Partial<WeightDecayConfig> = {},
    cloudStorage?: CloudStorage
  ) {
    this.decayConfig = { ...DEFAULT_WEIGHT_DECAY_CONFIG, ...decayConfig };
    this.cloudStorage = cloudStorage || new CloudStorage();
  }
  
  /**
   * 初始化或加载用户画像
   */
  async initialize(): Promise<UserProfile> {
    try {
      // 如果传入了外部的 CloudStorage 实例，检查其连接状态
      // 不要重复初始化，避免资源竞争
      if (this.cloudStorage && !await this.cloudStorage.isConnected()) {
        console.log('⚠️ CloudStorage 未连接，用户画像将仅使用本地存储');
      }
      
      // 尝试从存储中加载
      const stored = await this.loadFromStorage();
      if (stored) {
        this.profile = stored;
        // 延迟应用权重衰变，避免在初始化时造成额外负载
        setTimeout(() => {
          this.applyWeightDecay().catch(error => {
            console.error('权重衰变失败:', error);
          });
        }, 5000); // 5秒后执行
      } else {
        // 创建新的用户画像
        this.profile = this.createEmptyProfile();
      }
      return this.profile;
    } catch (error) {
      console.error('Failed to initialize user profile:', error);
      this.profile = this.createEmptyProfile();
      return this.profile;
    }
  }
  
  /**
   * 创建空的用户画像
   */
  private createEmptyProfile(): UserProfile {
    return {
      userId: this.userId,
      createdAt: Date.now(),
      lastUpdated: Date.now(),
      interests: {
        projects: [],
        people: [],
        topics: [],
        jiraTickets: [],
        technologies: [],
        documents: []
      },
      behaviorPatterns: {
        activeTimeZones: [],
        primaryWorkAreas: [],
        communicationStyle: {
          formality: 'semi-formal',
          detailLevel: 'medium',
          responseSpeed: 'normal',
          preferredChannels: []
        },
        toolUsageFrequency: []
      },
      derivedPreferences: {
        preferredProjectTypes: [],
        keyCollaborators: [],
        expertiseAreas: [],
        riskSensitivity: 'medium',
        updateFrequency: 'daily'
      },
      statistics: {
        totalInteractions: 0,
        averageDailyActivity: 0,
        mostActiveDay: '',
        topInteractionTypes: {}
      }
    };
  }
  
  /**
   * 更新用户画像
   */
  async updateProfile(update: UserProfileUpdate): Promise<void> {
    if (!this.profile) {
      await this.initialize();
    }
    
    // 节流控制，避免过于频繁的更新
    const throttleKey = `${update.targetItem.type}-${update.targetItem.id}`;
    const lastUpdate = this.updateThrottleMap.get(throttleKey) || 0;
    const now = Date.now();
    
    if (now - lastUpdate < 5000 && update.action.actionType === 'view') {
      // 5秒内的重复查看行为不记录
      return;
    }
    
    this.updateThrottleMap.set(throttleKey, now);
    
    // 更新兴趣项
    const interestItem = this.updateInterestItem(update);
    
    // 更新行为模式
    this.updateBehaviorPatterns(update.action);
    
    // 更新统计数据
    this.updateStatistics(update.action);
    
    // 重新计算衍生偏好
    this.recalculateDerivedPreferences();
    
    // 保存到存储
    await this.saveToStorage();
  }
  
  /**
   * 更新兴趣项
   */
  private updateInterestItem(update: UserProfileUpdate): UserInterestItem {
    const { targetItem, action } = update;
    const interestCategory = this.getInterestCategory(targetItem.type);
    
    if (!interestCategory) {
      throw new Error(`Invalid interest type: ${targetItem.type}`);
    }
    
    let item = interestCategory.find(i => i.id === targetItem.id);
    
    if (!item) {
      // 创建新的兴趣项
      item = {
        id: targetItem.id,
        type: targetItem.type,
        name: targetItem.name,
        metadata: targetItem.metadata,
        firstSeen: Date.now(),
        lastAccessed: Date.now(),
        accessCount: 1,
        userActions: [action],
        currentWeight: this.decayConfig.actionWeights[action.actionType] || 0.1,
        decayFactor: 1.0
      };
      interestCategory.push(item);
    } else {
      // 更新现有兴趣项
      item.lastAccessed = Date.now();
      item.accessCount++;
      item.userActions.push(action);
      
      // 更新权重
      const actionWeight = this.decayConfig.actionWeights[action.actionType] || 0.1;
      item.currentWeight = Math.min(
        this.decayConfig.maxWeight,
        item.currentWeight + actionWeight * item.decayFactor
      );
      
      // 更新总互动时间
      if (action.metadata?.duration) {
        item.totalEngagementTime = (item.totalEngagementTime || 0) + action.metadata.duration;
      }
    }
    
    // 根据兴趣项排序（按权重降序）
    interestCategory.sort((a, b) => b.currentWeight - a.currentWeight);
    
    return item;
  }
  
  /**
   * 获取兴趣分类
   */
  private getInterestCategory(type: UserInterestItem['type']): UserInterestItem[] | null {
    if (!this.profile) return null;
    
    switch (type) {
      case 'project': return this.profile.interests.projects;
      case 'person': return this.profile.interests.people;
      case 'topic': return this.profile.interests.topics;
      case 'jira': return this.profile.interests.jiraTickets;
      case 'technology': return this.profile.interests.technologies;
      case 'document': return this.profile.interests.documents;
      default: return null;
    }
  }
  
  /**
   * 更新行为模式
   */
  private updateBehaviorPatterns(action: UserAction): void {
    if (!this.profile) return;
    
    const now = new Date(action.timestamp);
    const hour = now.getHours();
    const dayOfWeek = now.getDay();
    
    // 更新活跃时间段
    let timeZoneActivity = this.profile.behaviorPatterns.activeTimeZones.find(
      tz => tz.hour === hour && tz.dayOfWeek === dayOfWeek
    );
    
    if (!timeZoneActivity) {
      timeZoneActivity = { hour, dayOfWeek, activityLevel: 0.1 };
      this.profile.behaviorPatterns.activeTimeZones.push(timeZoneActivity);
    } else {
      timeZoneActivity.activityLevel = Math.min(
        1.0,
        timeZoneActivity.activityLevel + 0.05
      );
    }
    
    // 更新工具使用频率
    if (action.metadata?.tool) {
      const tool = this.profile.behaviorPatterns.toolUsageFrequency.find(
        t => t.toolName === action.metadata.tool
      );
      
      if (tool) {
        tool.frequency++;
        tool.lastUsed = action.timestamp;
      } else {
        this.profile.behaviorPatterns.toolUsageFrequency.push({
          toolName: action.metadata.tool,
          frequency: 1,
          lastUsed: action.timestamp,
          primaryUseCase: action.context || ''
        });
      }
    }
  }
  
  /**
   * 更新统计数据
   */
  private updateStatistics(action: UserAction): void {
    if (!this.profile) return;
    
    const stats = this.profile.statistics;
    stats.totalInteractions++;
    
    // 更新交互类型统计
    stats.topInteractionTypes[action.actionType] = 
      (stats.topInteractionTypes[action.actionType] || 0) + 1;
    
    // 更新最活跃的日期
    const today = new Date().toDateString();
    if (!stats.mostActiveDay || action.timestamp > Date.now() - 86400000) {
      stats.mostActiveDay = today;
    }
    
    // 计算平均每日活动量（基于最近30天）
    const thirtyDaysAgo = Date.now() - 30 * 86400000;
    const recentActions = this.getAllUserActions().filter(
      a => a.timestamp > thirtyDaysAgo
    ).length;
    stats.averageDailyActivity = recentActions / 30;
  }
  
  /**
   * 重新计算衍生偏好
   */
  private recalculateDerivedPreferences(): void {
    if (!this.profile) return;
    
    const prefs = this.profile.derivedPreferences;
    const interests = this.profile.interests;
    
    // 计算偏好的项目类型
    prefs.preferredProjectTypes = this.extractTopMetadata(
      interests.projects,
      'projectType',
      3
    );
    
    // 计算关键协作者（高频互动的人员）
    prefs.keyCollaborators = interests.people
      .filter(p => p.currentWeight > 0.5)
      .slice(0, 5)
      .map(p => p.name);
    
    // 计算专业领域（基于技术和主题）
    const techAreas = interests.technologies
      .filter(t => t.currentWeight > 0.3)
      .map(t => t.name);
    const topicAreas = interests.topics
      .filter(t => t.currentWeight > 0.3)
      .map(t => t.name);
    prefs.expertiseAreas = Array.from(new Set([...techAreas, ...topicAreas])).slice(0, 5);
    
    // 计算风险敏感度（基于关注的JIRA类型）
    const criticalJiraCount = interests.jiraTickets.filter(
      j => j.metadata?.priority === 'critical' || j.metadata?.severity === 'high'
    ).length;
    
    if (criticalJiraCount > interests.jiraTickets.length * 0.3) {
      prefs.riskSensitivity = 'high';
    } else if (criticalJiraCount < interests.jiraTickets.length * 0.1) {
      prefs.riskSensitivity = 'low';
    }
    
    // 计算更新频率偏好
    const avgTimeBetweenActions = this.calculateAverageTimeBetweenActions();
    if (avgTimeBetweenActions < 3600000) { // 1小时
      prefs.updateFrequency = 'realtime';
    } else if (avgTimeBetweenActions < 86400000) { // 1天
      prefs.updateFrequency = 'daily';
    } else {
      prefs.updateFrequency = 'weekly';
    }
  }
  
  /**
   * 提取最常见的元数据值
   */
  private extractTopMetadata(
    items: UserInterestItem[],
    metadataKey: string,
    limit: number
  ): string[] {
    const counts: Record<string, number> = {};
    
    items.forEach(item => {
      const value = item.metadata?.[metadataKey];
      if (value) {
        counts[value] = (counts[value] || 0) + item.currentWeight;
      }
    });
    
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([key]) => key);
  }
  
  /**
   * 计算平均行为间隔时间
   */
  private calculateAverageTimeBetweenActions(): number {
    const allActions = this.getAllUserActions();
    if (allActions.length < 2) return Infinity;
    
    allActions.sort((a, b) => a.timestamp - b.timestamp);
    let totalInterval = 0;
    
    for (let i = 1; i < allActions.length; i++) {
      totalInterval += allActions[i].timestamp - allActions[i - 1].timestamp;
    }
    
    return totalInterval / (allActions.length - 1);
  }
  
  /**
   * 获取所有用户行为
   */
  private getAllUserActions(): UserAction[] {
    if (!this.profile) return [];
    
    const allActions: UserAction[] = [];
    const interests = this.profile.interests;
    
    Object.values(interests).forEach(category => {
      category.forEach(item => {
        allActions.push(...item.userActions);
      });
    });
    
    return allActions;
  }
  
  /**
   * 应用权重衰变
   */
  async applyWeightDecay(): Promise<void> {
    if (!this.profile) return;
    
    const now = Date.now();
    const daysSinceLastDecay = (now - this.lastDecayUpdate) / 86400000;
    
    if (daysSinceLastDecay < 1) {
      // 一天内已经衰变过，跳过
      return;
    }
    
    const interests = this.profile.interests;
    let hasChanges = false;
    
    Object.values(interests).forEach(category => {
      category.forEach(item => {
        const oldWeight = item.currentWeight;
        
        // 计算衰变率
        let decayRate = this.decayConfig.baseDecayRate * daysSinceLastDecay;
        
        // 应用衰变调节因子
        if (item.explicitImportance && item.explicitImportance > 0.5) {
          decayRate *= (1 - this.decayConfig.decayModifiers.explicitImportance);
        }
        
        const daysSinceLastAccess = (now - item.lastAccessed) / 86400000;
        if (daysSinceLastAccess < 7) {
          decayRate *= (1 - this.decayConfig.decayModifiers.recentActivity);
        }
        
        if (item.accessCount > 10) {
          decayRate *= (1 - this.decayConfig.decayModifiers.consistentEngagement);
        }
        
        // 应用衰变
        item.currentWeight = Math.max(
          this.decayConfig.minWeight,
          item.currentWeight * (1 - decayRate)
        );
        
        if (oldWeight !== item.currentWeight) {
          hasChanges = true;
        }
      });
      
      // 移除权重过低的项
      const originalLength = category.length;
      category = category.filter(item => item.currentWeight > this.decayConfig.minWeight);
      if (category.length !== originalLength) {
        hasChanges = true;
      }
    });
    
    if (hasChanges) {
      this.lastDecayUpdate = now;
      this.profile.lastUpdated = now;
      await this.saveToStorage();
    }
  }
  
  /**
   * 查询用户画像
   */
  async queryProfile(query: UserProfileQuery): Promise<UserInterestItem[]> {
    if (!this.profile) {
      await this.initialize();
    }
    
    let results: UserInterestItem[] = [];
    const interests = this.profile!.interests;
    
    // 收集指定类型的兴趣项
    if (query.interestTypes && query.interestTypes.length > 0) {
      query.interestTypes.forEach(type => {
        const category = this.getInterestCategory(type);
        if (category) {
          results.push(...category);
        }
      });
    } else {
      // 收集所有兴趣项
      Object.values(interests).forEach(category => {
        results.push(...category);
      });
    }
    
    // 应用权重过滤
    if (query.minWeight !== undefined) {
      results = results.filter(item => item.currentWeight >= query.minWeight);
    }
    
    // 应用时间范围过滤
    if (query.timeRange) {
      results = results.filter(item => {
        const lastAction = item.userActions[item.userActions.length - 1];
        return lastAction && 
          lastAction.timestamp >= query.timeRange!.start &&
          lastAction.timestamp <= query.timeRange!.end;
      });
    }
    
    // 排序
    switch (query.sortBy) {
      case 'weight':
        results.sort((a, b) => b.currentWeight - a.currentWeight);
        break;
      case 'recency':
        results.sort((a, b) => b.lastAccessed - a.lastAccessed);
        break;
      case 'frequency':
        results.sort((a, b) => b.accessCount - a.accessCount);
        break;
      default:
        results.sort((a, b) => b.currentWeight - a.currentWeight);
    }
    
    // 应用限制
    if (query.limit) {
      results = results.slice(0, query.limit);
    }
    
    return results;
  }
  
  /**
   * 分析用户画像，生成洞察
   */
  async analyzeProfile(): Promise<UserProfileAnalysis> {
    if (!this.profile) {
      await this.initialize();
    }
    
    const profile = this.profile!;
    const interests = profile.interests;
    
    // 获取当前最关注的内容
    const topInterests = {
      projects: interests.projects.slice(0, 3).map(p => p.name),
      people: interests.people.slice(0, 3).map(p => p.name),
      topics: interests.topics.slice(0, 3).map(t => t.name)
    };
    
    // 预测可能感兴趣的内容
    const predictedInterests = this.predictInterests();
    
    // 生成行为洞察
    const insights = {
      workingPattern: this.analyzeWorkingPattern(),
      collaborationStyle: this.analyzeCollaborationStyle(),
      focusAreas: profile.derivedPreferences.expertiseAreas,
      suggestedContent: this.generateContentSuggestions()
    };
    
    return {
      userId: profile.userId,
      timestamp: Date.now(),
      topInterests,
      predictedInterests,
      insights
    };
  }
  
  /**
   * 预测用户可能感兴趣的内容
   */
  private predictInterests(): Array<{
    item: string;
    type: UserInterestItem['type'];
    confidence: number;
    reason: string;
  }> {
    const predictions: Array<{
      item: string;
      type: UserInterestItem['type'];
      confidence: number;
      reason: string;
    }> = [];
    
    if (!this.profile) return predictions;
    
    // 基于协作者推荐项目
    const topCollaborators = this.profile.interests.people
      .filter(p => p.currentWeight > 0.5)
      .slice(0, 3);
    
    topCollaborators.forEach(collaborator => {
      if (collaborator.metadata?.currentProjects) {
        collaborator.metadata.currentProjects.forEach((project: string) => {
          const exists = this.profile!.interests.projects.some(p => p.name === project);
          if (!exists) {
            predictions.push({
              item: project,
              type: 'project',
              confidence: collaborator.currentWeight * 0.7,
              reason: `${collaborator.name} 正在参与此项目`
            });
          }
        });
      }
    });
    
    // 基于技术栈推荐相关技术
    const topTechs = this.profile.interests.technologies
      .filter(t => t.currentWeight > 0.4)
      .slice(0, 3);
    
    const techRelations: Record<string, string[]> = {
      'React': ['Redux', 'Next.js', 'TypeScript'],
      'Python': ['Django', 'FastAPI', 'Pandas'],
      'Docker': ['Kubernetes', 'CI/CD', 'DevOps']
    };
    
    topTechs.forEach(tech => {
      const related = techRelations[tech.name] || [];
      related.forEach(relatedTech => {
        const exists = this.profile!.interests.technologies.some(t => t.name === relatedTech);
        if (!exists) {
          predictions.push({
            item: relatedTech,
            type: 'technology',
            confidence: tech.currentWeight * 0.6,
            reason: `与 ${tech.name} 相关的技术`
          });
        }
      });
    });
    
    return predictions.sort((a, b) => b.confidence - a.confidence).slice(0, 5);
  }
  
  /**
   * 分析工作模式
   */
  private analyzeWorkingPattern(): string {
    if (!this.profile) return '数据不足';
    
    const activeHours = this.profile.behaviorPatterns.activeTimeZones
      .filter(tz => tz.activityLevel > 0.5)
      .map(tz => tz.hour);
    
    if (activeHours.length === 0) return '活动模式尚不明确';
    
    const avgHour = activeHours.reduce((sum, h) => sum + h, 0) / activeHours.length;
    
    if (avgHour < 12) {
      return '早起型工作者，上午活跃度高';
    } else if (avgHour < 18) {
      return '标准工作时间，下午效率高';
    } else {
      return '夜猫子型，晚间工作效率高';
    }
  }
  
  /**
   * 分析协作风格
   */
  private analyzeCollaborationStyle(): string {
    if (!this.profile) return '数据不足';
    
    const peopleCount = this.profile.interests.people.length;
    const avgPeopleWeight = peopleCount > 0
      ? this.profile.interests.people.reduce((sum, p) => sum + p.currentWeight, 0) / peopleCount
      : 0;
    
    if (peopleCount > 10 && avgPeopleWeight > 0.3) {
      return '广泛协作者，与多个团队保持联系';
    } else if (peopleCount < 5 && avgPeopleWeight > 0.6) {
      return '深度协作者，与核心团队紧密合作';
    } else {
      return '平衡型协作者，根据需要调整协作深度';
    }
  }
  
  /**
   * 生成内容推荐
   */
  private generateContentSuggestions(): string[] {
    const suggestions: string[] = [];
    
    if (!this.profile) return suggestions;
    
    // 基于最近关注的主题推荐
    const recentTopics = this.profile.interests.topics
      .filter(t => Date.now() - t.lastAccessed < 7 * 86400000)
      .slice(0, 3);
    
    recentTopics.forEach(topic => {
      suggestions.push(`${topic.name} 的最新进展`);
    });
    
    // 基于高优先级JIRA推荐
    const criticalJira = this.profile.interests.jiraTickets
      .filter(j => j.metadata?.priority === 'critical' && j.currentWeight > 0.5)
      .slice(0, 2);
    
    criticalJira.forEach(jira => {
      suggestions.push(`检查 ${jira.name} 的进展`);
    });
    
    return suggestions;
  }
  
  /**
   * 从存储加载用户画像
   */
  private async loadFromStorage(): Promise<UserProfile | null> {
    try {
      // 优先从云端存储加载，但添加超时控制
      if (this.cloudStorage && await this.cloudStorage.isConnected()) {
        try {
          const profileData = await Promise.race([
            this.cloudStorage.getUserProfile(this.userId),
            new Promise<null>((_, reject) => 
              setTimeout(() => reject(new Error('CloudStorage load timeout')), 5000)
            )
          ]);
          if (profileData) {
            return profileData;
          }
        } catch (cloudError) {
          console.warn('云端加载用户画像失败，使用本地存储:', cloudError);
        }
      }
      
      // 回退到本地存储
      const key = `userProfile_${this.userId}`;
      const result = await chrome.storage.local.get(key);
      const localProfile = result[key] || null;
      
      // 如果有本地数据但云端没有，尝试同步到云端（非阻塞）
      if (localProfile && this.cloudStorage && await this.cloudStorage.isConnected()) {
        // 异步同步，不影响主流程
        this.cloudStorage.storeUserProfile(this.userId, localProfile).catch(error => {
          console.warn('同步用户画像到云端失败:', error);
        });
      }
      
      return localProfile;
    } catch (error) {
      console.error('Failed to load user profile from storage:', error);
      return null;
    }
  }
  
  /**
   * 保存用户画像到存储
   */
  private async saveToStorage(): Promise<void> {
    if (!this.profile) return;
    
    try {
      this.profile.lastUpdated = Date.now();
      
      // 始终保存到本地存储（快速且可靠）
      const key = `userProfile_${this.userId}`;
      await chrome.storage.local.set({ [key]: this.profile });
      
      // 异步保存到云端（不阻塞主流程）
      if (this.cloudStorage && await this.cloudStorage.isConnected()) {
        Promise.race([
          this.cloudStorage.storeUserProfile(this.userId, this.profile),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('CloudStorage save timeout')), 3000)
          )
        ]).catch(error => {
          console.warn('保存用户画像到云端失败:', error);
        });
      }
    } catch (error) {
      console.error('Failed to save user profile to storage:', error);
    }
  }
  
  /**
   * 获取当前用户画像（用于调试和导出）
   */
  getProfile(): UserProfile | null {
    return this.profile;
  }
  
  /**
   * 设置用户明确的重要性标记
   */
  async setExplicitImportance(
    itemId: string,
    type: UserInterestItem['type'],
    importance: number
  ): Promise<void> {
    if (!this.profile) {
      await this.initialize();
    }
    
    const category = this.getInterestCategory(type);
    if (!category) return;
    
    const item = category.find(i => i.id === itemId);
    if (item) {
      item.explicitImportance = Math.max(0, Math.min(1, importance));
      await this.saveToStorage();
    }
  }
}
