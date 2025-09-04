/**
 * 用户画像管理器
 * 负责分散式向量存储的用户画像管理
 */

import { 
  UserProfile, 
  UserInterestItem, 
  UserAction, 
  UserProfileQuery, 
  UserProfileUpdate,
  UserProfileAnalysis
} from '../types/userProfile';
import { 
  UserProfileRecord,
  InterestItemRecord,
  BehaviorPatternRecord,
  SocialRelationshipRecord,
  ExpertiseAreaRecord,
  UserProfileQueryOptions,
  UserProfileQueryResult,
  UserSimilarityResult,
  UserSummaryRecord
} from '../types/userProfile';
import { CloudStorage } from '../storage/CloudStorage';

export class UserProfileManager {
  private cloudStorage: CloudStorage;
  public userId: string;
  private recordsCache: Map<string, UserProfileRecord> = new Map();
  private lastCacheUpdate = 0;
  private cacheExpiryTime = 5 * 60 * 1000; // 5分钟缓存过期

  constructor(userId: string, cloudStorage?: CloudStorage) {
    this.userId = userId;
    this.cloudStorage = cloudStorage || new CloudStorage();
  }

  /**
   * 初始化管理器
   */
  async initialize(): Promise<boolean> {
    try {
      // 确保CloudStorage已连接
      if (!await this.cloudStorage.isConnected()) {
        await this.cloudStorage.initialize();
      }

      // 初始化缓存
      await this.refreshCache();
      
      console.log(`✅ 用户画像管理器初始化成功: ${this.userId}`);
      return true;
    } catch (error) {
      console.error('用户画像管理器初始化失败:', error);
      return false;
    }
  }


  /**
   * 更新用户画像（兼容旧接口）
   */
  async updateProfile(update: UserProfileUpdate): Promise<void> {
    try {
      // 1. 更新兴趣项
      const interestSuccess = await this.updateInterestItem(update);
      if (!interestSuccess) {
        console.warn(`Failed to update interest item for ${update.targetItem.name}`);
      }

      // 2. 更新行为模式
      await this.updateBehaviorPattern({
        userId: update.userId,
        actionType: update.action.actionType,
        timestamp: update.action.timestamp,
        context: update.action.context || '',
        targetType: update.targetItem.type,
        targetId: update.targetItem.id
      });

      // 3. 更新统计数据（通过行为记录自动统计）
      await this.updateUserStatistics(update.action);

      // 4. 重新计算衍生偏好（基于最新的向量化数据）
      await this.recalculateDerivedPreferences();

      console.log(`✅ Profile updated successfully for ${update.targetItem.name}`);
    } catch (error) {
      console.error('Failed to update profile:', error);
      throw new Error(`Failed to update profile for ${update.targetItem.name}: ${error.message}`);
    }
  }

  /**
   * 更新用户统计数据
   */
  private async updateUserStatistics(action: UserAction): Promise<void> {
    try {
      const statsRecordId = `${this.userId}_user_summary_statistics`;
      
      // 查找现有统计记录
      let existingStats = this.recordsCache.get(statsRecordId) as UserSummaryRecord | undefined;
      
      if (!existingStats) {
        // 尝试从云端获取
        const queryResult = await this.cloudStorage.queryVectorizedRecords('user statistics', {
          user_id: this.userId,
          record_types: ['user_summary'],
          metadata_filters: { summary_type: 'statistics' }
        });
        
        if (queryResult.records.length > 0) {
          existingStats = queryResult.records[0] as UserSummaryRecord;
          this.recordsCache.set(statsRecordId, existingStats);
        }
      }

      if (!existingStats) {
        // 创建新的统计记录
        existingStats = {
          id: statsRecordId,
          document: `用户 ${this.userId} 的统计数据汇总`,
          metadata: {
            record_type: 'user_summary',
            user_id: this.userId,
            created_at: Date.now(),
            updated_at: Date.now(),
            summary_type: 'statistics',
            total_interactions: 1,
            daily_activity_average: 1,
            most_active_day: new Date().toISOString().split('T')[0],
            top_interaction_types: { [action.actionType]: 1 },
            last_activity: action.timestamp
          }
        };
      } else {
        // 更新统计数据
        const metadata = existingStats.metadata;
        metadata.total_interactions = (metadata.total_interactions || 0) + 1;
        metadata.updated_at = Date.now();
        metadata.last_activity = action.timestamp;
        
        // 更新交互类型统计
        const topTypes = metadata.top_interaction_types || {};
        topTypes[action.actionType] = (topTypes[action.actionType] || 0) + 1;
        metadata.top_interaction_types = topTypes;
        
        // 计算日平均活动
        const daysSinceCreated = Math.max(1, Math.floor((Date.now() - metadata.created_at) / (24 * 60 * 60 * 1000)));
        metadata.daily_activity_average = metadata.total_interactions / daysSinceCreated;
        
        // 更新文档描述
        existingStats.document = `用户 ${this.userId} 的统计数据汇总：总交互${metadata.total_interactions}次，日均活动${metadata.daily_activity_average.toFixed(1)}次`;
      }

      // 存储更新后的统计记录
      await this.cloudStorage.storeVectorizedRecord(existingStats);
      this.recordsCache.set(statsRecordId, existingStats);
      
    } catch (error) {
      console.error('Failed to update user statistics:', error);
    }
  }

  /**
   * 重新计算衍生偏好
   */
  private async recalculateDerivedPreferences(): Promise<void> {
    try {
      const preferencesRecordId = `${this.userId}_user_summary_preferences`;
      
      // 获取用户的所有兴趣项记录
      const interestRecords = Array.from(this.recordsCache.values())
        .filter(record => record.metadata.record_type === 'interest_item' && 
                         record.metadata.user_id === this.userId) as InterestItemRecord[];
      
      if (interestRecords.length === 0) return;

      // 分析偏好项目类型
      const projectTypes = new Map<string, number>();
      const expertiseAreas = new Map<string, number>();
      const collaborators = new Map<string, number>();
      
      interestRecords.forEach(record => {
        const metadata = record.metadata;
        
        // 统计项目类型偏好
        if (metadata.interest_category === 'project' && metadata.project_type) {
          projectTypes.set(metadata.project_type, 
            (projectTypes.get(metadata.project_type) || 0) + metadata.current_weight);
        }
        
        // 统计专业领域
        if (metadata.interest_category === 'technology' && metadata.technology_stack) {
          metadata.technology_stack.forEach(tech => {
            expertiseAreas.set(tech, 
              (expertiseAreas.get(tech) || 0) + metadata.current_weight);
          });
        }
        
        // 统计协作者
        if (metadata.interest_category === 'person') {
          collaborators.set(metadata.name, 
            (collaborators.get(metadata.name) || 0) + metadata.current_weight);
        }
      });

      // 生成偏好记录
      const preferencesRecord: UserSummaryRecord = {
        id: preferencesRecordId,
        document: `用户 ${this.userId} 的衍生偏好分析：` +
          `偏好项目类型${Array.from(projectTypes.keys()).slice(0, 3).join('、')}，` +
          `专业领域包括${Array.from(expertiseAreas.keys()).slice(0, 5).join('、')}，` +
          `主要协作者有${Array.from(collaborators.keys()).slice(0, 3).join('、')}`,
        metadata: {
          record_type: 'user_summary',
          user_id: this.userId,
          created_at: this.recordsCache.get(preferencesRecordId)?.metadata.created_at || Date.now(),
          updated_at: Date.now(),
          summary_type: 'derived_preferences',
          preferred_project_types: Array.from(projectTypes.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([type]) => type),
          expertise_areas: Array.from(expertiseAreas.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([area]) => area),
          key_collaborators: Array.from(collaborators.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([name]) => name),
          risk_sensitivity: this.calculateRiskSensitivity(interestRecords),
          update_frequency: this.calculateUpdateFrequency(interestRecords)
        }
      };

      // 存储偏好记录
      await this.cloudStorage.storeVectorizedRecord(preferencesRecord);
      this.recordsCache.set(preferencesRecordId, preferencesRecord);
      
    } catch (error) {
      console.error('Failed to recalculate derived preferences:', error);
    }
  }

  /**
   * 计算风险敏感度
   */
  private calculateRiskSensitivity(interestRecords: InterestItemRecord[]): 'low' | 'medium' | 'high' {
    const totalWeight = interestRecords.reduce((sum, record) => sum + record.metadata.current_weight, 0);
    const diversityScore = new Set(interestRecords.map(r => r.metadata.interest_category)).size;
    
    if (diversityScore >= 4 && totalWeight > 5) return 'low';
    if (diversityScore >= 2 && totalWeight > 3) return 'medium';
    return 'high';
  }

  /**
   * 计算更新频率模式
   */
  private calculateUpdateFrequency(interestRecords: InterestItemRecord[]): 'daily' | 'weekly' | 'monthly' {
    const now = Date.now();
    const recentUpdates = interestRecords.filter(record => 
      now - record.metadata.last_accessed < 7 * 24 * 60 * 60 * 1000
    ).length;
    
    if (recentUpdates >= 10) return 'daily';
    if (recentUpdates >= 3) return 'weekly';
    return 'monthly';
  }

  /**
   * 更新兴趣项
   */
  async updateInterestItem(update: UserProfileUpdate): Promise<boolean> {
    try {
      const { targetItem, action } = update;
      const recordId = `${this.userId}_interest_${targetItem.type}_${this.sanitizeId(targetItem.id)}`;

      // 查找现有记录
      let existingRecord = this.recordsCache.get(recordId) as InterestItemRecord | undefined;

      if (!existingRecord) {
        // 尝试从云端获取
        const queryResult = await this.cloudStorage.queryVectorizedRecords('', {
          user_id: this.userId,
          record_types: ['interest_item'],
          metadata_filters: { name: targetItem.name, interest_category: targetItem.type }
        });

        if (queryResult.records.length > 0) {
          existingRecord = queryResult.records[0] as InterestItemRecord;
          this.recordsCache.set(recordId, existingRecord);
        }
      }

      if (existingRecord) {
        // 更新现有记录
        await this.updateExistingInterestRecord(existingRecord, action);
      } else {
        // 创建新记录
        await this.createNewInterestRecord(recordId, targetItem, action);
      }

      return true;
    } catch (error) {
      console.error('更新兴趣项失败:', error);
      return false;
    }
  }

  /**
   * 更新行为模式
   */
  async updateBehaviorPattern(data: {
    userId: string;
    actionType: string;
    timestamp: number;
    context: string;
    targetType: string;
    targetId: string;
  }): Promise<boolean> {
    try {
      const recordId = `${this.userId}_behavior_pattern_${data.actionType}_${Date.now()}`;
      
      // 创建行为模式记录
      const behaviorRecord: BehaviorPatternRecord = {
        id: recordId,
        document: this.generateBehaviorPatternDocument(data),
        metadata: {
          record_type: 'behavior_pattern',
          user_id: this.userId,
          created_at: data.timestamp,
          updated_at: data.timestamp,
          pattern_type: this.getPatternType(data.actionType),
          // 根据行为类型设置相应的元数据
          ...this.getBehaviorSpecificMetadata(data)
        }
      };

      // 存储记录
      await this.cloudStorage.storeVectorizedRecord(behaviorRecord);
      this.recordsCache.set(recordId, behaviorRecord);

      return true;
    } catch (error) {
      console.error('更新行为模式失败:', error);
      return false;
    }
  }

  /**
   * 查询兴趣项
   */
  async queryInterestItems(options: {
    category?: string;
    searchQuery?: string;
    limit?: number;
    sortBy?: 'weight' | 'frequency' | 'recent';
  } = {}): Promise<InterestItemRecord[]> {
    try {
      const { category, searchQuery = '', limit = 20, sortBy = 'weight' } = options;
      
      // 构建查询选项
      const queryOptions: UserProfileQueryOptions = {
        user_id: this.userId,
        record_types: ['interest_item'],
        limit
      };

      if (category) {
        queryOptions.metadata_filters = { interest_category: category };
      }

      // 执行查询
      const result = await this.cloudStorage.queryVectorizedRecords(searchQuery, queryOptions);
      
      // 类型转换和排序
      const interestRecords = result.records as InterestItemRecord[];
      
      return this.sortInterestItems(interestRecords, sortBy);
    } catch (error) {
      console.error('查询兴趣项失败:', error);
      return [];
    }
  }

  /**
   * 查找相似用户
   */
  async findSimilarUsers(options: {
    limit?: number;
    similarityThreshold?: number;
  } = {}): Promise<UserSimilarityResult[]> {
    try {
      const { limit = 10, similarityThreshold = 0.3 } = options;
      
      // 获取用户的主要兴趣描述
      const userInterests = await this.queryInterestItems({ limit: 10, sortBy: 'weight' });
      const queryText = userInterests.map(item => item.document).join(' ');
      
      if (!queryText.trim()) {
        return [];
      }

      // 查找相似用户
      return await this.cloudStorage.findSimilarUsers(this.userId, queryText, {
        record_types: ['interest_item'],
        limit,
        similarity_threshold: similarityThreshold
      });
    } catch (error) {
      console.error('查找相似用户失败:', error);
      return [];
    }
  }

  /**
   * 根据行为模式查找用户
   */
  async findUsersByBehaviorPattern(patternType: string, options: { limit?: number } = {}): Promise<UserSimilarityResult[]> {
    // 占位符实现，后续可扩展
    return [];
  }

  /**
   * 查找话题相关兴趣
   */
  async findTopicRelatedInterests(topic: string, options: { limit?: number } = {}): Promise<InterestItemRecord[]> {
    try {
      const { limit = 10 } = options;
      
      const result = await this.cloudStorage.queryVectorizedRecords(topic, {
        user_id: this.userId,
        record_types: ['interest_item'],
        limit
      });
      
      return result.records as InterestItemRecord[];
    } catch (error) {
      console.error('查找话题相关兴趣失败:', error);
      return [];
    }
  }

  /**
   * 生成用户画像分析
   */
  async generateAnalysis(): Promise<UserProfileAnalysis> {
    try {
      await this.refreshCacheIfNeeded();
      
      const interestRecords = Array.from(this.recordsCache.values())
        .filter(record => record.metadata.record_type === 'interest_item') as InterestItemRecord[];
      
      const behaviorRecords = Array.from(this.recordsCache.values())
        .filter(record => record.metadata.record_type === 'behavior_pattern') as BehaviorPatternRecord[];

      return {
        userId: this.userId,
        generatedAt: Date.now(),
        
        // 兴趣分析
        topInterestsByCategory: this.getTopItemsByCategory(interestRecords),
        interestDistribution: this.calculateInterestDistribution(interestRecords),
        
        // 行为分析
        behaviorPatterns: this.analyzeBehaviorPatterns(behaviorRecords),
        
        // 预测和建议
        predictedInterests: this.predictInterests(interestRecords),
        contentSuggestions: this.generateContentSuggestions(interestRecords),
        
        // 统计信息
        totalItems: interestRecords.length,
        lastUpdated: Math.max(...interestRecords.map(r => r.metadata.updated_at), 0),
        
        confidence: this.calculateAnalysisConfidence(interestRecords)
      };
    } catch (error) {
      console.error('生成用户画像分析失败:', error);
      throw error;
    }
  }

  /**
   * 获取画像统计信息
   */
  async getProfileStats(): Promise<{
    totalRecords: number;
    recordsByType: Record<string, number>;
    lastActivity: number;
    healthScore: number;
  }> {
    try {
      await this.refreshCacheIfNeeded();
      
      const records = Array.from(this.recordsCache.values());
      const recordsByType: Record<string, number> = {};
      let lastActivity = 0;
      
      records.forEach(record => {
        const type = record.metadata.record_type;
        recordsByType[type] = (recordsByType[type] || 0) + 1;
        
        if (record.metadata.last_accessed && record.metadata.last_accessed > lastActivity) {
          lastActivity = record.metadata.last_accessed;
        }
      });

      // 简单的健康度计算
      const healthScore = Math.min(records.length / 50, 1); // 假设50个记录为满分

      return {
        totalRecords: records.length,
        recordsByType,
        lastActivity,
        healthScore
      };
    } catch (error) {
      console.error('获取画像统计失败:', error);
      return {
        totalRecords: 0,
        recordsByType: {},
        lastActivity: 0,
        healthScore: 0
      };
    }
  }

  /**
   * 刷新缓存
   */
  async refreshCache(): Promise<void> {
    try {
      const result = await this.cloudStorage.queryVectorizedRecords('', {
        user_id: this.userId,
        limit: 1000 // 获取用户的所有记录
      });

      this.recordsCache.clear();
      result.records.forEach(record => {
        this.recordsCache.set(record.id, record);
      });

      this.lastCacheUpdate = Date.now();
      console.log(`缓存已刷新，加载了 ${result.records.length} 条记录`);
    } catch (error) {
      console.error('刷新缓存失败:', error);
    }
  }

  /**
   * 按需刷新缓存
   */
  private async refreshCacheIfNeeded(): Promise<void> {
    if (Date.now() - this.lastCacheUpdate > this.cacheExpiryTime) {
      await this.refreshCache();
    }
  }

  // =================== 以下为兼容旧接口的方法 ===================

  /**
   * 获取用户画像（向后兼容）
   */
  async getProfile(): Promise<UserProfile | null> {
    try {
      await this.refreshCacheIfNeeded();
      
      const interestRecords = Array.from(this.recordsCache.values())
        .filter(record => record.metadata.record_type === 'interest_item') as InterestItemRecord[];
      
      const behaviorRecords = Array.from(this.recordsCache.values())
        .filter(record => record.metadata.record_type === 'behavior_pattern') as BehaviorPatternRecord[];
      
      const summaryRecords = Array.from(this.recordsCache.values())
        .filter(record => record.metadata.record_type === 'user_summary') as UserSummaryRecord[];

      if (interestRecords.length === 0) {
        return null;
      }

      // 重构用户画像对象
      return {
        userId: this.userId,
        createdAt: Math.min(...interestRecords.map(r => r.metadata.created_at)),
        lastUpdated: Math.max(...interestRecords.map(r => r.metadata.updated_at)),
        
        interests: this.reconstructInterestItems(interestRecords),
        behaviorPatterns: this.reconstructBehaviorPatterns(behaviorRecords),
        derivedPreferences: this.reconstructDerivedPreferences(summaryRecords),
        statistics: this.calculateStatistics(interestRecords, summaryRecords)
      };
    } catch (error) {
      console.error('获取用户画像失败:', error);
      return null;
    }
  }

  /**
   * 设置明确重要性
   */
  async setExplicitImportance(itemId: string, type: UserInterestItem['type'], importance: number): Promise<boolean> {
    try {
      const recordId = `${this.userId}_interest_${type}_${this.sanitizeId(itemId)}`;
      const record = this.recordsCache.get(recordId) as InterestItemRecord;
      
      if (record) {
        record.metadata.explicit_importance = importance;
        record.metadata.updated_at = Date.now();
        
        await this.cloudStorage.storeVectorizedRecord(record);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('设置明确重要性失败:', error);
      return false;
    }
  }

  /**
   * 应用权重衰减
   */
  async applyWeightDecay(): Promise<void> {
    try {
      const interestRecords = Array.from(this.recordsCache.values())
        .filter(record => record.metadata.record_type === 'interest_item') as InterestItemRecord[];
      
      const now = Date.now();
      const oneDay = 24 * 60 * 60 * 1000;
      
      for (const record of interestRecords) {
        const daysSinceLastAccess = (now - (record.metadata.last_accessed || record.metadata.created_at)) / oneDay;
        
        // 简单的衰减公式
        const decayFactor = Math.exp(-daysSinceLastAccess / 30); // 30天为衰减周期
        record.metadata.current_weight *= decayFactor;
        record.metadata.updated_at = now;
        
        await this.cloudStorage.storeVectorizedRecord(record);
      }
      
      console.log(`权重衰减应用完成，更新了 ${interestRecords.length} 条记录`);
    } catch (error) {
      console.error('应用权重衰减失败:', error);
    }
  }

  /**
   * 融合用户上下文配置
   */
  async fuseUserContextConfig(userContextConfig: any): Promise<boolean> {
    try {
      const configRecordId = `${this.userId}_user_summary_context_config`;
      
      const configRecord: UserSummaryRecord = {
        id: configRecordId,
        document: `用户 ${this.userId} 的上下文配置：${JSON.stringify(userContextConfig)}`,
        metadata: {
          record_type: 'user_summary',
          user_id: this.userId,
          created_at: Date.now(),
          updated_at: Date.now(),
          summary_type: 'user_context_config',
          user_context_config: userContextConfig
        }
      };

      await this.cloudStorage.storeVectorizedRecord(configRecord);
      this.recordsCache.set(configRecordId, configRecord);
      
      return true;
    } catch (error) {
      console.error('融合用户上下文配置失败:', error);
      return false;
    }
  }

  /**
   * 自适应权重调整
   */
  async adaptiveWeightAdjustment(): Promise<void> {
    try {
      // 这是一个简化的实现，真实场景下会更复杂
      const interestRecords = Array.from(this.recordsCache.values())
        .filter(record => record.metadata.record_type === 'interest_item') as InterestItemRecord[];
      
      // 基于访问频率调整权重
      for (const record of interestRecords) {
        const accessFrequency = record.metadata.access_count / Math.max(1, 
          (Date.now() - record.metadata.first_seen) / (24 * 60 * 60 * 1000));
        
        // 高频访问的项目增加权重
        if (accessFrequency > 1) {
          record.metadata.current_weight = Math.min(1, record.metadata.current_weight * 1.1);
        }
        
        record.metadata.updated_at = Date.now();
        await this.cloudStorage.storeVectorizedRecord(record);
      }
    } catch (error) {
      console.error('自适应权重调整失败:', error);
    }
  }

  /**
   * 生成主动推荐
   */
  async generateProactiveRecommendations(): Promise<Array<{
    type: 'project' | 'person' | 'topic' | 'technology';
    item: string;
    reason: string;
    confidence: number;
  }>> {
    try {
      const interestRecords = Array.from(this.recordsCache.values())
        .filter(record => record.metadata.record_type === 'interest_item') as InterestItemRecord[];
      
      // 简化的推荐算法
      const recommendations = [];
      
      // 基于技术栈推荐相关技术
      const techItems = interestRecords.filter(r => r.metadata.interest_category === 'technology');
      const topTech = techItems.sort((a, b) => b.metadata.current_weight - a.metadata.current_weight)[0];
      
      if (topTech) {
        recommendations.push({
          type: 'technology' as const,
          item: `${topTech.metadata.name} 高级特性`,
          reason: `基于您对 ${topTech.metadata.name} 的高度关注`,
          confidence: 0.8
        });
      }
      
      return recommendations.slice(0, 5);
    } catch (error) {
      console.error('生成主动推荐失败:', error);
      return [];
    }
  }

  /**
   * 融合兴趣项权重
   */
  getFusedInterestItems<T extends { weight?: number; currentWeight?: number; explicitImportance?: number }>(items: T[]): T[] {
    return items.map(item => {
      const explicitWeight = item.explicitImportance || 0;
      const implicitWeight = item.currentWeight || item.weight || 0;
      
      // 融合公式：明确重要性占40%，隐式权重占60%
      const fusedWeight = explicitWeight * 0.4 + implicitWeight * 0.6;
      
      return {
        ...item,
        weight: fusedWeight,
        currentWeight: fusedWeight
      };
    });
  }

  // =================== 私有辅助方法 ===================

  /**
   * 更新现有兴趣记录
   */
  private async updateExistingInterestRecord(record: InterestItemRecord, action: UserAction): Promise<void> {
    const metadata = record.metadata;
    
    // 更新访问统计
    metadata.access_count += 1;
    metadata.last_accessed = action.timestamp;
    metadata.updated_at = action.timestamp;
    
    // 更新权重
    const actionWeight = this.getActionWeight(action.actionType);
    metadata.current_weight = Math.min(1, metadata.current_weight + actionWeight * 0.1);
    
    // 更新最近行为
    if (!metadata.recent_action_types.includes(action.actionType)) {
      metadata.recent_action_types.push(action.actionType);
      // 保持最近5种行为类型
      if (metadata.recent_action_types.length > 5) {
        metadata.recent_action_types.shift();
      }
    }
    
    // 更新交互模式
    metadata.interaction_patterns.view_frequency += action.actionType === 'view' ? 1 : 0;
    metadata.interaction_patterns.edit_frequency += action.actionType === 'edit' ? 1 : 0;
    metadata.interaction_patterns.share_frequency += action.actionType === 'mention' ? 1 : 0;
    
    // 重新生成文档描述
    record.document = this.generateInterestItemDocument(metadata);
    
    // 存储更新
    await this.cloudStorage.storeVectorizedRecord(record);
    this.recordsCache.set(record.id, record);
  }

  /**
   * 创建新兴趣记录
   */
  private async createNewInterestRecord(recordId: string, targetItem: any, action: UserAction): Promise<void> {
    const actionWeight = this.getActionWeight(action.actionType);
    
    const newRecord: InterestItemRecord = {
      id: recordId,
      document: '', // 将在下面生成
      metadata: {
        record_type: 'interest_item',
        user_id: this.userId,
        created_at: action.timestamp,
        updated_at: action.timestamp,
        last_accessed: action.timestamp,
        
        interest_category: targetItem.type,
        name: targetItem.name,
        current_weight: actionWeight,
        access_count: 1,
        first_seen: action.timestamp,
        
        recent_action_types: [action.actionType],
        interaction_patterns: {
          view_frequency: action.actionType === 'view' ? 1 : 0,
          edit_frequency: action.actionType === 'edit' ? 1 : 0,
          share_frequency: action.actionType === 'mention' ? 1 : 0
        },
        
        trend: 'stable',
        
        // 从targetItem.metadata复制特定字段
        ...(targetItem.metadata?.projectType && { project_type: targetItem.metadata.projectType }),
        ...(targetItem.metadata?.role && { person_role: targetItem.metadata.role }),
        ...(targetItem.metadata?.stack && { technology_stack: [targetItem.metadata.stack] }),
        ...(targetItem.metadata?.keywords && { topic_keywords: targetItem.metadata.keywords })
      }
    };
    
    // 生成文档描述
    newRecord.document = this.generateInterestItemDocument(newRecord.metadata);
    
    // 存储记录
    await this.cloudStorage.storeVectorizedRecord(newRecord);
    this.recordsCache.set(recordId, newRecord);
  }

  /**
   * 生成兴趣项文档描述
   */
  private generateInterestItemDocument(metadata: any): string {
    const category = metadata.interest_category;
    const name = metadata.name;
    const weight = metadata.current_weight;
    
    let description = `${category}: ${name}`;
    
    // 添加类型特定信息
    if (category === 'project' && metadata.project_type) {
      description += ` (项目类型: ${metadata.project_type})`;
    } else if (category === 'person' && metadata.person_role) {
      description += ` (角色: ${metadata.person_role})`;
    } else if (category === 'technology' && metadata.technology_stack) {
      description += ` (技术栈: ${metadata.technology_stack.join(', ')})`;
    } else if (category === 'topic' && metadata.topic_keywords) {
      description += ` (关键词: ${metadata.topic_keywords.join(', ')})`;
    }
    
    description += ` - 权重: ${weight.toFixed(2)}, 访问次数: ${metadata.access_count}`;
    
    return description;
  }

  /**
   * 生成行为模式文档描述
   */
  private generateBehaviorPatternDocument(data: any): string {
    return `用户行为: ${data.actionType} 在 ${data.targetType} "${data.targetId}" 上，上下文: ${data.context}`;
  }

  /**
   * 获取行为模式类型
   */
  private getPatternType(actionType: string): 'time_preference' | 'communication_style' | 'tool_usage' | 'work_pattern' {
    // 简化的映射
    if (['view', 'edit', 'create'].includes(actionType)) return 'work_pattern';
    if (['mention', 'search'].includes(actionType)) return 'communication_style';
    return 'time_preference';
  }

  /**
   * 获取行为特定元数据
   */
  private getBehaviorSpecificMetadata(data: any): any {
    const hour = new Date(data.timestamp).getHours();
    
    return {
      active_hours: [hour],
      formality_level: 'semi-formal',
      response_speed: 'normal'
    };
  }

  /**
   * 排序兴趣项
   */
  private sortInterestItems(records: InterestItemRecord[], sortBy: string): InterestItemRecord[] {
    return records.sort((a, b) => {
      switch (sortBy) {
        case 'weight':
          return b.metadata.current_weight - a.metadata.current_weight;
        case 'frequency':
          return b.metadata.access_count - a.metadata.access_count;
        case 'recent':
          return (b.metadata.last_accessed || 0) - (a.metadata.last_accessed || 0);
        default:
          return 0;
      }
    });
  }

  /**
   * 获取行为权重
   */
  private getActionWeight(actionType: string): number {
    const weights: Record<string, number> = {
      'view': 0.1,
      'edit': 0.3,
      'create': 0.5,
      'link': 0.2,
      'mention': 0.2,
      'search': 0.15,
      'favorite': 0.4
    };
    
    return weights[actionType] || 0.1;
  }

  /**
   * 按类别获取顶级项目
   */
  private getTopItemsByCategory(records: InterestItemRecord[]): Record<string, any[]> {
    const byCategory: Record<string, InterestItemRecord[]> = {};
    
    records.forEach(record => {
      const category = record.metadata.interest_category;
      if (!byCategory[category]) {
        byCategory[category] = [];
      }
      byCategory[category].push(record);
    });
    
    const result: Record<string, any[]> = {};
    Object.keys(byCategory).forEach(category => {
      result[category] = byCategory[category]
        .sort((a, b) => b.metadata.current_weight - a.metadata.current_weight)
        .slice(0, 5)
        .map(record => ({
          name: record.metadata.name,
          weight: record.metadata.current_weight,
          accessCount: record.metadata.access_count
        }));
    });
    
    return result;
  }

  /**
   * 计算兴趣分布
   */
  private calculateInterestDistribution(records: InterestItemRecord[]): Record<string, number> {
    const distribution: Record<string, number> = {};
    const total = records.length;
    
    records.forEach(record => {
      const category = record.metadata.interest_category;
      distribution[category] = (distribution[category] || 0) + 1;
    });
    
    // 转换为百分比
    Object.keys(distribution).forEach(key => {
      distribution[key] = distribution[key] / total;
    });
    
    return distribution;
  }

  /**
   * 分析行为模式
   */
  private analyzeBehaviorPatterns(records: BehaviorPatternRecord[]): any {
    // 简化的行为分析
    const timeData = records.filter(r => r.metadata.pattern_type === 'time_preference');
    const now = Date.now();
    const socialRecords = records.filter(r => r.metadata.pattern_type === 'communication_style');
    
    return {
      activeHours: timeData.length > 0 ? timeData[0].metadata.active_hours : [],
      communicationStyle: socialRecords.length > 0 ? socialRecords[0].metadata.formality_level : 'semi-formal',
      responseSpeed: socialRecords.length > 0 ? socialRecords[0].metadata.response_speed : 'normal'
    };
  }

  /**
   * 预测兴趣
   */
  private predictInterests(records: InterestItemRecord[]): string[] {
    // 基于现有兴趣的简单预测
    const techRecords = records.filter(r => r.metadata.interest_category === 'technology');
    const topTech = techRecords.sort((a, b) => b.metadata.current_weight - a.metadata.current_weight)[0];
    
    if (topTech) {
      return [`${topTech.metadata.name} 进阶应用`];
    }
    
    return [];
  }

  /**
   * 生成内容建议
   */
  private generateContentSuggestions(records: InterestItemRecord[]): string[] {
    const suggestions = [];
    const topRecords = records
      .sort((a, b) => b.metadata.current_weight - a.metadata.current_weight)
      .slice(0, 3);
    
    topRecords.forEach(record => {
      suggestions.push(`关于 ${record.metadata.name} 的深度内容`);
    });
    
    return suggestions;
  }

  /**
   * 计算分析置信度
   */
  private calculateAnalysisConfidence(records: InterestItemRecord[]): number {
    if (records.length === 0) return 0;
    
    const totalInteractions = records.reduce((sum, r) => sum + r.metadata.access_count, 0);
    const avgWeight = records.reduce((sum, r) => sum + r.metadata.current_weight, 0) / records.length;
    
    // 简单的置信度计算
    return Math.min(1, (totalInteractions / 100) * 0.5 + avgWeight * 0.5);
  }

  /**
   * 重构兴趣项（用于向后兼容）
   */
  private reconstructInterestItems(records: InterestItemRecord[]): any {
    const interests: any = {
      projects: [],
      people: [],
      topics: [],
      technologies: [],
      documents: [],
      jiraTickets: []
    };
    
    records.forEach(record => {
      const metadata = record.metadata;
      const item: UserInterestItem = {
        id: record.id,
        type: metadata.interest_category as any,
        name: metadata.name,
        firstSeen: metadata.first_seen,
        lastAccessed: metadata.last_accessed || metadata.updated_at,
        accessCount: metadata.access_count,
        currentWeight: metadata.current_weight,
        decayFactor: 1.0,
        userActions: [], // 简化处理
        explicitImportance: metadata.explicit_importance,
        metadata: {
          projectType: metadata.project_type,
          role: metadata.person_role,
          stack: metadata.technology_stack?.[0],
          keywords: metadata.topic_keywords
        }
      };
      
      const categoryMap: Record<string, string> = {
        'project': 'projects',
        'person': 'people',
        'topic': 'topics',
        'technology': 'technologies',
        'document': 'documents',
        'jira': 'jiraTickets'
      };
      
      const category = categoryMap[metadata.interest_category];
      if (category && interests[category]) {
        interests[category].push(item);
      }
    });
    
    return interests;
  }

  /**
   * 重构行为模式（用于向后兼容）
   */
  private reconstructBehaviorPatterns(records: BehaviorPatternRecord[]): any {
    return {
      activeTimeZones: [],
      primaryWorkAreas: [],
      communicationStyle: {
        formality: 'semi-formal',
        detailLevel: 'medium',
        responseSpeed: 'normal',
        preferredChannels: ['email', 'chat']
      },
      toolUsageFrequency: []
    };
  }

  /**
   * 重构衍生偏好（用于向后兼容）
   */
  private reconstructDerivedPreferences(summaryRecords: UserSummaryRecord[]): any {
    const preferencesRecord = summaryRecords.find(r => r.metadata.summary_type === 'derived_preferences');
    
    if (preferencesRecord) {
      return {
        preferredProjectTypes: preferencesRecord.metadata.preferred_project_types || [],
        keyCollaborators: preferencesRecord.metadata.key_collaborators || [],
        expertiseAreas: preferencesRecord.metadata.expertise_areas || [],
        riskSensitivity: preferencesRecord.metadata.risk_sensitivity || 'medium',
        updateFrequency: preferencesRecord.metadata.update_frequency || 'weekly'
      };
    }
    
    return {
      preferredProjectTypes: [],
      keyCollaborators: [],
      expertiseAreas: [],
      riskSensitivity: 'medium',
      updateFrequency: 'weekly'
    };
  }

  /**
   * 计算统计信息（用于向后兼容）
   */
  private calculateStatistics(interestRecords: InterestItemRecord[], summaryRecords: UserSummaryRecord[]): any {
    const statsRecord = summaryRecords.find(r => r.metadata.summary_type === 'statistics');
    
    if (statsRecord) {
      return {
        totalInteractions: statsRecord.metadata.total_interactions || 0,
        averageDailyActivity: statsRecord.metadata.daily_activity_average || 0,
        mostActiveDay: statsRecord.metadata.most_active_day || '',
        topInteractionTypes: statsRecord.metadata.top_interaction_types || {}
      };
    }
    
    // 从兴趣记录计算基本统计
    const totalInteractions = interestRecords.reduce((sum, r) => sum + r.metadata.access_count, 0);
    
    return {
      totalInteractions,
      averageDailyActivity: totalInteractions / Math.max(1, interestRecords.length),
      mostActiveDay: new Date().toISOString().split('T')[0],
      topInteractionTypes: { view: totalInteractions }
    };
  }

  /**
   * 清理ID用于存储
   */
  private sanitizeId(id: string): string {
    return id.replace(/[^a-zA-Z0-9_-]/g, '_');
  }
}
