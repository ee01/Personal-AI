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
   * 应用权重衰变 - 使用持久化存储的lastDecayUpdate
   */
  async applyWeightDecay(): Promise<void> {
    if (!this.profile) return;
    
    const now = Date.now();
    
    // 从localStorage获取上次衰变时间
    const lastDecayKey = `userProfile_lastDecayUpdate_${this.userId}`;
    const result = await chrome.storage.local.get(lastDecayKey);
    const lastDecayUpdate = result[lastDecayKey] || now;
    
    const daysSinceLastDecay = (now - lastDecayUpdate) / 86400000;
    
    if (daysSinceLastDecay < 1) {
      // 一天内已经衰变过，跳过
      console.log(`⏭️ 跳过权重衰变 - 距离上次衰变仅 ${(daysSinceLastDecay * 24).toFixed(1)} 小时`);
      return;
    }
    
    console.log(`🔄 开始权重衰变 - 距离上次衰变 ${daysSinceLastDecay.toFixed(1)} 天`);
    
    const interests = this.profile.interests;
    let hasChanges = false;
    let totalItemsProcessed = 0;
    let totalItemsDecayed = 0;
    
    Object.values(interests).forEach(category => {
      category.forEach(item => {
        totalItemsProcessed++;
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
          totalItemsDecayed++;
        }
      });
      
      // 移除权重过低的项
      const originalLength = category.length;
      const filteredCategory = category.filter(item => item.currentWeight > this.decayConfig.minWeight);
      if (filteredCategory.length !== originalLength) {
        hasChanges = true;
        console.log(`🗑️ 移除 ${originalLength - filteredCategory.length} 个权重过低的兴趣项`);
      }
    });
    
    if (hasChanges) {
      // 更新localStorage中的lastDecayUpdate
      await chrome.storage.local.set({ [lastDecayKey]: now });
      this.profile.lastUpdated = now;
      await this.saveToStorage();
      console.log(`✅ 权重衰变完成 - 处理了 ${totalItemsProcessed} 项，衰变了 ${totalItemsDecayed} 项`);
    } else {
      // 即使没有变化也要更新时间，避免重复计算
      await chrome.storage.local.set({ [lastDecayKey]: now });
      console.log(`✅ 权重衰变完成 - 无需更新`);
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

  /**
   * 🆕 数据融合：将 UserContextConfig 融合到 UserProfile
   * 实现显式用户输入与隐式系统学习的加权融合
   */
  async fuseUserContextConfig(userContextConfig: any): Promise<boolean> {
    try {
      if (!this.profile) {
        await this.initialize();
      }

      console.log('开始融合用户上下文配置到用户画像...', userContextConfig);

      // 1. 融合个人信息
      if (userContextConfig.personalInfo) {
        if (!this.profile.explicitPreferences) {
          this.profile.explicitPreferences = {
            personalInfo: {
              title: '',
              department: '',
              location: '',
              timezone: 'GMT+8'
            },
            workContext: {
              teamName: '',
              teamMission: '',
              teamMembers: [],
              workingHours: '',
              primaryConcerns: [],
              businessDomains: [],
              keyMetrics: []
            },
            communicationPreferences: {
              style: '',
              languagePreference: 'zh-CN'
            }
          };
        }
        
        this.profile.explicitPreferences.personalInfo = {
          title: userContextConfig.personalInfo.title || '',
          department: userContextConfig.personalInfo.department || '',
          location: userContextConfig.personalInfo.location || '',
          timezone: userContextConfig.personalInfo.timezone || 'GMT+8'
        };
      }

      // 2. 融合工作上下文（团队信息 + 工作重点）
      if (!this.profile.explicitPreferences) {
        this.profile.explicitPreferences = {
          personalInfo: {
            title: '',
            department: '',
            location: '',
            timezone: 'GMT+8'
          },
          workContext: {
            teamName: '',
            teamMission: '',
            teamMembers: [],
            workingHours: '',
            primaryConcerns: [],
            businessDomains: [],
            keyMetrics: []
          },
          communicationPreferences: {
            style: '',
            languagePreference: 'zh-CN'
          }
        };
      }
      
      this.profile.explicitPreferences.workContext = {
        teamName: userContextConfig.teamInfo?.teamName || '',
        teamMission: userContextConfig.teamInfo?.teamMission || '',
        teamMembers: userContextConfig.teamInfo?.members || [],
        workingHours: userContextConfig.teamInfo?.workingHours || '',
        primaryConcerns: userContextConfig.workFocus?.primaryConcerns || [],
        businessDomains: userContextConfig.workFocus?.businessDomains || [],
        keyMetrics: userContextConfig.workFocus?.keyMetrics || []
      };

      // 3. 融合沟通偏好（保留有用部分）
      this.profile.explicitPreferences.communicationPreferences = {
        style: userContextConfig.communicationContext?.communicationStyle || '',
        languagePreference: userContextConfig.communicationContext?.languagePreference || 'zh-CN'
      };

      // 4. 初始化权重计算配置
      this.profile.weightCalculation = this.profile.weightCalculation || {
        explicitWeight: 0.3,    // 初始状态：30%显式，70%隐式
        implicitWeight: 0.7,
        adaptiveMode: 'cold_start',
        lastAdaptation: Date.now()
      };

      // 5. 保存融合结果
      await this.saveToStorage();

      console.log('用户上下文配置融合完成', this.profile.explicitPreferences);
      return true;

    } catch (error) {
      console.error('融合用户上下文配置失败:', error);
      return false;
    }
  }

  /**
   * 🆕 权重自适应调整
   * 根据用户使用时长和互动频率调整显式/隐式权重比例
   */
  async adaptiveWeightAdjustment(): Promise<void> {
    if (!this.profile || !this.profile.weightCalculation) return;

    const now = Date.now();
    const profileAge = (now - this.profile.createdAt) / (1000 * 60 * 60 * 24); // 天数
    const totalInteractions = this.profile.statistics?.totalInteractions || 0;
    const averageDailyActivity = this.profile.statistics?.averageDailyActivity || 0;

    let newMode = this.profile.weightCalculation.adaptiveMode;
    let explicitWeight = this.profile.weightCalculation.explicitWeight;
    let implicitWeight = this.profile.weightCalculation.implicitWeight;

    // 根据使用经验调整模式和权重
    if (profileAge > 30 && totalInteractions > 200) {
      // 成熟用户：更信任显式反馈
      newMode = 'mature';
      explicitWeight = 0.7;
      implicitWeight = 0.3;
    } else if (profileAge > 7 && totalInteractions > 50) {
      // 学习阶段：平衡权重
      newMode = 'learning';  
      explicitWeight = 0.5;
      implicitWeight = 0.5;
    } else {
      // 冷启动：更依赖系统学习
      newMode = 'cold_start';
      explicitWeight = 0.3;
      implicitWeight = 0.7;
    }

    // 更新权重配置
    this.profile.weightCalculation = {
      explicitWeight,
      implicitWeight,
      adaptiveMode: newMode,
      lastAdaptation: now
    };

    console.log(`权重自适应调整: ${newMode} 模式，显式权重: ${explicitWeight}, 隐式权重: ${implicitWeight}`);
    await this.saveToStorage();
  }

  /**
   * 🆕 加权融合计算兴趣权重
   * 将显式用户标记与隐式系统学习结合
   */
  calculateFusedWeight(implicitWeight: number, explicitImportance?: number): number {
    if (!this.profile?.weightCalculation) {
      return implicitWeight; // 降级处理
    }

    const { explicitWeight, implicitWeight: implicitRatio } = this.profile.weightCalculation;

    if (explicitImportance === undefined || explicitImportance === 0) {
      // 没有显式标记，使用纯隐式权重
      return implicitWeight;
    }

    // 加权融合：融合显式反馈和隐式学习
    const fusedWeight = (explicitImportance * explicitWeight) + (implicitWeight * implicitRatio);
    
    // 确保权重在有效范围内
    return Math.max(0, Math.min(1, fusedWeight));
  }

  /**
   * 🆕 获取融合后的兴趣列表
   * 应用加权融合算法重新计算所有兴趣权重
   */
  getFusedInterestItems<T extends { weight: number; explicitImportance?: number }>(items: T[]): T[] {
    return items.map(item => ({
      ...item,
      weight: this.calculateFusedWeight(item.weight, item.explicitImportance)
    })).sort((a, b) => b.weight - a.weight);
  }

  /**
   * 🆕 处理冲突解决
   * 当显式和隐式数据冲突时使用加权平均
   */
  resolveDataConflict(explicitValue: number, implicitValue: number): number {
    if (!this.profile?.weightCalculation) {
      return implicitValue;
    }

    const { explicitWeight, implicitWeight } = this.profile.weightCalculation;
    return (explicitValue * explicitWeight) + (implicitValue * implicitWeight);
  }

  /**
   * 🆕 生成个性化Prompt
   * 基于用户画像和显式配置生成个性化的分析提示
   */
  generatePersonalizedPrompt(context: string, analysisType: 'message' | 'project' | 'webpage' | 'document' | 'generic' = 'generic'): string {
    if (!this.profile) {
      return context;
    }

    const parts: string[] = [];
    
    // 1. 基础上下文信息
    if (this.profile.explicitPreferences?.personalInfo) {
      const personalInfo = this.profile.explicitPreferences.personalInfo;
      if (personalInfo.title || personalInfo.department) {
        parts.push(`作为${personalInfo.title}${personalInfo.department ? `（${personalInfo.department}）` : ''}`);
      }
    }

    // 2. 工作环境和团队信息
    if (this.profile.explicitPreferences?.workContext) {
      const workContext = this.profile.explicitPreferences.workContext;
      if (workContext.teamName) {
        parts.push(`在${workContext.teamName}团队中工作`);
      }
      if (workContext.primaryConcerns && workContext.primaryConcerns.length > 0) {
        parts.push(`主要关注：${workContext.primaryConcerns.slice(0, 3).join('、')}`);
      }
    }

    // 3. 兴趣重点（基于融合权重排序）
    const topInterests = this.getFusedInterestItems([
      ...this.profile.interests.projects.map(p => ({ ...p, weight: p.currentWeight })),
      ...this.profile.interests.topics.map(t => ({ ...t, weight: t.currentWeight })),
      ...this.profile.interests.technologies.map(tech => ({ ...tech, weight: tech.currentWeight }))
    ]).slice(0, 5);

    if (topInterests.length > 0) {
      parts.push(`当前重点关注：${topInterests.map(i => i.name).join('、')}`);
    }

    // 4. 行为模式和工作风格
    if (this.profile.behaviorPatterns?.communicationStyle) {
      const style = this.profile.behaviorPatterns.communicationStyle;
      if (style.formality !== 'semi-formal') {
        parts.push(`偏好${style.formality === 'formal' ? '正式' : '轻松'}的沟通风格`);
      }
      if (style.detailLevel !== 'medium') {
        parts.push(`需要${style.detailLevel === 'high' ? '详细' : '简洁'}的信息`);
      }
    }

    // 5. 专业领域
    if (this.profile.derivedPreferences?.expertiseAreas && this.profile.derivedPreferences.expertiseAreas.length > 0) {
      parts.push(`专业领域：${this.profile.derivedPreferences.expertiseAreas.slice(0, 3).join('、')}`);
    }

    // 6. 构建个性化前缀
    let personalizedPrefix = '';
    if (parts.length > 0) {
      personalizedPrefix = `\n## 🎯 个人化上下文\n${parts.join('，')}。\n\n请基于以上个人背景和关注重点来分析以下内容：\n\n`;
    }

    // 7. 根据分析类型添加特定指导
    let typeSpecificGuidance = '';
    switch (analysisType) {
      case 'message':
        if (this.profile.explicitPreferences?.workContext?.primaryConcerns) {
          typeSpecificGuidance = `\n重点关注与以下方面相关的信息：${this.profile.explicitPreferences.workContext.primaryConcerns.join('、')}\n`;
        }
        break;
      case 'project':
        if (this.profile.derivedPreferences?.riskSensitivity) {
          typeSpecificGuidance = `\n风险敏感度：${this.profile.derivedPreferences.riskSensitivity}，请相应调整分析深度。\n`;
        }
        break;
      case 'webpage':
        if (topInterests.length > 0) {
          typeSpecificGuidance = `\n特别关注与以下主题相关的内容：${topInterests.slice(0, 3).map(i => i.name).join('、')}\n`;
        }
        break;
    }

    return personalizedPrefix + context + typeSpecificGuidance;
  }

  /**
   * 🆕 生成回复建议
   * 基于用户画像生成个性化的回复建议
   */
  generateReplyAdvice(messageContext: any): string[] {
    if (!this.profile) {
      return [];
    }

    const advice: string[] = [];
    
    // 1. 基于沟通风格的建议
    const communicationStyle = this.profile.behaviorPatterns?.communicationStyle;
    if (communicationStyle) {
      if (communicationStyle.formality === 'formal') {
        advice.push('建议使用正式的语言和称谓，保持专业的沟通风格');
      } else if (communicationStyle.formality === 'casual') {
        advice.push('可以使用相对轻松的语调，但仍需保持礼貌和专业');
      }
      
      if (communicationStyle.detailLevel === 'high') {
        advice.push('提供详细的解释和背景信息，包含必要的数据支撑');
      } else if (communicationStyle.detailLevel === 'low') {
        advice.push('保持回复简洁明了，突出重点，避免冗长的说明');
      }
    }

    // 2. 基于专业领域的建议
    const expertiseAreas = this.profile.derivedPreferences?.expertiseAreas;
    if (expertiseAreas && expertiseAreas.length > 0) {
      advice.push(`可以引用你在${expertiseAreas.slice(0, 2).join('、')}方面的专业知识`);
    }

    // 3. 基于当前关注重点的建议
    const topInterests = this.getFusedInterestItems([
      ...this.profile.interests.projects.map(p => ({ ...p, weight: p.currentWeight })),
      ...this.profile.interests.topics.map(t => ({ ...t, weight: t.currentWeight }))
    ]).slice(0, 3);

    if (topInterests.length > 0 && messageContext) {
      // 检查消息是否与用户关注的项目/主题相关
      const relevantInterests = topInterests.filter(interest => 
        messageContext.toLowerCase().includes(interest.name.toLowerCase())
      );
      
      if (relevantInterests.length > 0) {
        advice.push(`这涉及到你正在关注的${relevantInterests.map(i => i.name).join('、')}，可以分享相关的见解或进展`);
      }
    }

    // 4. 基于工作重点的建议
    const primaryConcerns = this.profile.explicitPreferences?.workContext?.primaryConcerns;
    if (primaryConcerns && primaryConcerns.length > 0 && messageContext) {
      const relevantConcerns = primaryConcerns.filter(concern =>
        messageContext.toLowerCase().includes(concern.toLowerCase())
      );
      
      if (relevantConcerns.length > 0) {
        advice.push(`这与你的工作重点${relevantConcerns.join('、')}相关，建议从这个角度进行回应`);
      }
    }

    // 5. 基于团队协作的建议
    const keyCollaborators = this.profile.derivedPreferences?.keyCollaborators;
    if (keyCollaborators && keyCollaborators.length > 0 && messageContext) {
      const mentionedCollaborators = keyCollaborators.filter(collab =>
        messageContext.toLowerCase().includes(collab.toLowerCase())
      );
      
      if (mentionedCollaborators.length > 0) {
        advice.push(`提到了你的协作伙伴${mentionedCollaborators.join('、')}，可以考虑协调或跟进相关事项`);
      }
    }

    return advice.length > 0 ? advice : ['基于上下文和你的工作背景，提供专业和有建设性的回复'];
  }

  /**
   * 🆕 生成主动推荐内容
   * 基于用户画像和行为模式生成个性化推荐
   */
  async generateProactiveRecommendations(): Promise<Array<{
    id: string;
    type: 'content' | 'action' | 'connection' | 'learning';
    title: string;
    description: string;
    confidence: number;
    reason: string;
    actionUrl?: string;
    priority: 'high' | 'medium' | 'low';
  }>> {
    if (!this.profile) {
      return [];
    }

    const recommendations: Array<{
      id: string;
      type: 'content' | 'action' | 'connection' | 'learning';
      title: string;
      description: string;
      confidence: number;
      reason: string;
      actionUrl?: string;
      priority: 'high' | 'medium' | 'low';
    }> = [];

    // 1. 基于兴趣预测的内容推荐
    const predictedInterests = this.predictInterests();
    predictedInterests.forEach((prediction, index) => {
      if (prediction.confidence > 0.6) {
        recommendations.push({
          id: `content_${prediction.type}_${index}`,
          type: 'content',
          title: `探索 ${prediction.item}`,
          description: `基于你对相关领域的关注，${prediction.item} 可能对你有价值`,
          confidence: prediction.confidence,
          reason: prediction.reason,
          priority: prediction.confidence > 0.8 ? 'high' : 'medium'
        });
      }
    });

    // 2. 基于最近活动的行动建议
    const recentItems = this.getRecentlyAccessedItems();
    if (recentItems.length > 0) {
      const mostActive = recentItems[0];
      if (Date.now() - mostActive.lastAccessed > 7 * 24 * 60 * 60 * 1000) { // 7天未访问
        recommendations.push({
          id: `action_followup_${mostActive.id}`,
          type: 'action',
          title: `跟进 ${mostActive.name}`,
          description: `你已经一周没有关注 ${mostActive.name} 了，建议检查最新进展`,
          confidence: 0.7,
          reason: `基于你的关注历史和访问模式`,
          priority: mostActive.currentWeight > 0.5 ? 'high' : 'medium'
        });
      }
    }

    // 3. 基于工作模式的时间建议
    const workingPattern = this.analyzeWorkingPattern();
    const currentHour = new Date().getHours();
    const isInActiveTime = this.profile.behaviorPatterns.activeTimeZones.some(
      tz => Math.abs(tz.hour - currentHour) <= 1 && tz.activityLevel > 0.6
    );

    if (isInActiveTime && this.profile.statistics.averageDailyActivity > 0) {
      recommendations.push({
        id: `action_peak_time`,
        type: 'action',
        title: '高效时段建议',
        description: `当前是你的高效时段，建议处理重要的${this.profile.derivedPreferences.expertiseAreas[0] || '工作'}任务`,
        confidence: 0.8,
        reason: `基于你的活动模式分析，${workingPattern}`,
        priority: 'high'
      });
    }

    // 4. 基于协作关系的连接建议
    const keyCollaborators = this.profile.derivedPreferences.keyCollaborators;
    if (keyCollaborators && keyCollaborators.length > 0) {
      const collaboratorRecommendation = keyCollaborators.slice(0, 2);
      recommendations.push({
        id: `connection_sync`,
        type: 'connection',
        title: `与 ${collaboratorRecommendation.join('、')} 同步`,
        description: `建议主动与关键协作伙伴同步项目进展和工作重点`,
        confidence: 0.6,
        reason: `基于你们的协作频率和项目关联度`,
        priority: 'medium'
      });
    }

    // 5. 基于技能缺口的学习建议
    const topTechnologies = this.profile.interests.technologies
      .filter(t => t.currentWeight > 0.3)
      .slice(0, 3);
    
    if (topTechnologies.length > 0) {
      const techName = topTechnologies[0].name;
      const relatedSkills = this.suggestRelatedSkills(techName);
      
      if (relatedSkills.length > 0) {
        recommendations.push({
          id: `learning_${techName.toLowerCase()}`,
          type: 'learning',
          title: `学习 ${relatedSkills[0]}`,
          description: `基于你对 ${techName} 的关注，学习 ${relatedSkills[0]} 将有助于技能提升`,
          confidence: 0.7,
          reason: `技能栈扩展建议，与你当前关注的技术高度相关`,
          priority: 'medium'
        });
      }
    }

    // 6. 基于风险敏感度的预警建议
    if (this.profile.derivedPreferences.riskSensitivity === 'high') {
      const criticalProjects = this.profile.interests.projects.filter(
        p => p.metadata?.priority === 'high' || p.metadata?.status === 'at-risk'
      );
      
      if (criticalProjects.length > 0) {
        recommendations.push({
          id: `action_risk_review`,
          type: 'action',
          title: '风险项目检查',
          description: `你有 ${criticalProjects.length} 个高风险或高优先级项目需要关注`,
          confidence: 0.9,
          reason: `基于你的高风险敏感度设置和项目状态`,
          priority: 'high'
        });
      }
    }

    // 7. 按优先级和置信度排序
    return recommendations
      .sort((a, b) => {
        // 先按优先级排序
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
        if (priorityDiff !== 0) return priorityDiff;
        
        // 再按置信度排序
        return b.confidence - a.confidence;
      })
      .slice(0, 8); // 最多返回8个推荐
  }

  /**
   * 获取最近访问的项目
   */
  private getRecentlyAccessedItems(): any[] {
    if (!this.profile) return [];
    
    const allItems = [
      ...this.profile.interests.projects,
      ...this.profile.interests.topics,
      ...this.profile.interests.technologies,
      ...this.profile.interests.documents
    ];
    
    return allItems
      .sort((a, b) => b.lastAccessed - a.lastAccessed)
      .slice(0, 10);
  }

  /**
   * 根据技术建议相关技能
   */
  private suggestRelatedSkills(technology: string): string[] {
    const skillMap: Record<string, string[]> = {
      'React': ['Next.js', 'Redux', 'TypeScript', 'GraphQL'],
      'Vue': ['Nuxt.js', 'Vuex', 'Vue Router', 'TypeScript'],
      'Python': ['Django', 'FastAPI', 'Pandas', 'TensorFlow'],
      'JavaScript': ['Node.js', 'Express', 'React', 'Vue'],
      'TypeScript': ['React', 'Angular', 'NestJS', 'Express'],
      'Docker': ['Kubernetes', 'DevOps', 'CI/CD', 'Microservices'],
      'AWS': ['Azure', 'Google Cloud', 'Terraform', 'Serverless'],
      'Git': ['GitHub Actions', 'DevOps', 'CI/CD', 'Docker']
    };
    
    return skillMap[technology] || [];
  }
}
