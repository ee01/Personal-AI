/**
 * 向量化用户画像管理器
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
  VectorizedRecord,
  InterestItemRecord,
  BehaviorPatternRecord,
  SocialRelationshipRecord,
  ExpertiseAreaRecord,
  VectorizedQueryOptions,
  VectorizedQueryResult,
  UserSimilarityResult
} from '../types/vectorizedUserProfile';
import { CloudStorage } from '../storage/CloudStorage';

export class VectorizedUserProfileManager {
  private cloudStorage: CloudStorage;
  public userId: string;
  private recordsCache: Map<string, VectorizedRecord> = new Map();
  private lastCacheUpdate = 0;
  private cacheValidityPeriod = 5 * 60 * 1000; // 5分钟缓存有效期

  constructor(userId: string, cloudStorage?: CloudStorage) {
    this.userId = userId;
    this.cloudStorage = cloudStorage || new CloudStorage();
  }

  /**
   * 初始化向量化用户画像
   */
  async initialize(): Promise<boolean> {
    try {
      // 确保CloudStorage已连接
      const isConnected = await this.cloudStorage.isConnected();
      if (!isConnected) {
        console.warn('CloudStorage 未连接，向量化用户画像功能将受限');
        return false;
      }

      // 加载用户的向量化记录到缓存
      await this.refreshCache();
      
      console.log(`✅ 向量化用户画像管理器初始化完成，用户: ${this.userId}`);
      return true;
    } catch (error) {
      console.error('向量化用户画像管理器初始化失败:', error);
      return false;
    }
  }


  /**
   * 更新用户画像（兼容旧接口）
   */
  async updateProfile(update: UserProfileUpdate): Promise<void> {
    const success = await this.updateInterestItem(update);
    if (!success) {
      throw new Error(`Failed to update profile for ${update.targetItem.name}`);
    }
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
        }
      }

      let record: InterestItemRecord;
      const now = Date.now();

      if (existingRecord) {
        // 更新现有记录
        record = this.updateExistingInterestRecord(existingRecord, action, now);
      } else {
        // 创建新记录
        record = this.createNewInterestRecord(targetItem, action, now);
      }

      // 存储更新的记录
      const success = await this.cloudStorage.storeVectorizedRecord(record);
      
      if (success) {
        // 更新缓存
        this.recordsCache.set(record.id, record);
        console.log(`✅ 兴趣项记录已更新: ${record.metadata.name}`);
        return true;
      }

      return false;
    } catch (error) {
      console.error('更新兴趣项失败:', error);
      return false;
    }
  }

  /**
   * 更新行为模式
   */
  async updateBehaviorPattern(
    patternType: 'time_preference' | 'communication_style' | 'tool_usage',
    data: any
  ): Promise<boolean> {
    try {
      const recordId = `${this.userId}_behavior_${patternType}`;
      const now = Date.now();

      // 查找现有记录
      let existingRecord = this.recordsCache.get(recordId) as BehaviorPatternRecord | undefined;

      if (!existingRecord) {
        const queryResult = await this.cloudStorage.queryVectorizedRecords('', {
          user_id: this.userId,
          record_types: ['behavior_pattern'],
          metadata_filters: { pattern_type: patternType }
        });

        if (queryResult.records.length > 0) {
          existingRecord = queryResult.records[0] as BehaviorPatternRecord;
        }
      }

      const record: BehaviorPatternRecord = existingRecord || {
        id: recordId,
        document: '',
        metadata: {
          record_type: 'behavior_pattern',
          pattern_type: patternType,
          user_id: this.userId,
          created_at: now,
          updated_at: now,
          pattern_confidence: 0.5,
          data_points: 1,
          pattern_stability: 0.5
        }
      };

      // 更新记录数据
      record.metadata.updated_at = now;
      record.metadata.data_points = (record.metadata.data_points || 0) + 1;
      
      // 根据模式类型更新特定数据
      switch (patternType) {
        case 'time_preference':
          this.updateTimePreferenceData(record, data);
          break;
        case 'communication_style':
          this.updateCommunicationStyleData(record, data);
          break;
        case 'tool_usage':
          this.updateToolUsageData(record, data);
          break;
      }

      // 重新生成文档文本
      record.document = this.generateBehaviorPatternDocument(record);

      // 存储记录
      const success = await this.cloudStorage.storeVectorizedRecord(record);
      
      if (success) {
        this.recordsCache.set(record.id, record);
        console.log(`✅ 行为模式记录已更新: ${patternType}`);
        return true;
      }

      return false;
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
    minWeight?: number;
    limit?: number;
    searchQuery?: string;
  } = {}): Promise<InterestItemRecord[]> {
    try {
      const { category, minWeight = 0, limit = 20, searchQuery = '' } = options;

      const queryOptions: VectorizedQueryOptions = {
        user_id: this.userId,
        record_types: ['interest_item'],
        limit,
        metadata_filters: {}
      };

      if (category) {
        queryOptions.metadata_filters!.interest_category = category;
      }

      if (minWeight > 0) {
        queryOptions.metadata_filters!.current_weight = { $gte: minWeight };
      }

      const result = await this.cloudStorage.queryVectorizedRecords(searchQuery, queryOptions);
      
      return result.records as InterestItemRecord[];
    } catch (error) {
      console.error('查询兴趣项失败:', error);
      return [];
    }
  }

  /**
   * 查找相似用户
   */
  async findSimilarUsers(options: {
    interestCategory?: string;
    behaviorType?: string;
    limit?: number;
    similarityThreshold?: number;
  } = {}): Promise<UserSimilarityResult[]> {
    try {
      const { interestCategory, behaviorType, limit = 10, similarityThreshold = 0.6 } = options;

      // 构建查询字符串
      const queryParts = [];
      
      if (interestCategory) {
        // 获取用户在该分类下的兴趣项
        const userInterests = await this.queryInterestItems({ category: interestCategory, limit: 5 });
        const interestNames = userInterests.map(item => item.metadata.name).join(' ');
        queryParts.push(interestNames);
      }

      if (behaviorType) {
        // 获取用户的行为模式
        const behaviorRecord = this.recordsCache.get(`${this.userId}_behavior_${behaviorType}`);
        if (behaviorRecord) {
          queryParts.push(behaviorRecord.document);
        }
      }

      if (queryParts.length === 0) {
        queryParts.push('用户兴趣和行为模式');
      }

      const query = queryParts.join(' ');
      const recordTypes = [];
      
      if (interestCategory) recordTypes.push('interest_item');
      if (behaviorType) recordTypes.push('behavior_pattern');
      if (recordTypes.length === 0) recordTypes.push('interest_item', 'behavior_pattern');

      return await this.cloudStorage.findSimilarUsers(this.userId, query, {
        record_types: recordTypes,
        limit,
        similarity_threshold: similarityThreshold
      });
    } catch (error) {
      console.error('查找相似用户失败:', error);
      return [];
    }
  }

  /**
   * 查找特定行为模式的用户（如：喜欢聊八卦的人）
   */
  async findUsersByBehaviorPattern(
    behaviorQuery: string,
    options: { limit?: number; threshold?: number } = {}
  ): Promise<UserSimilarityResult[]> {
    try {
      const { limit = 10, threshold = 0.5 } = options;

      return await this.cloudStorage.findSimilarUsers(this.userId, behaviorQuery, {
        record_types: ['behavior_pattern', 'social_relationship'],
        limit,
        similarity_threshold: threshold
      });
    } catch (error) {
      console.error('按行为模式查找用户失败:', error);
      return [];
    }
  }

  /**
   * 查找与特定话题相关的高频兴趣项
   */
  async findTopicRelatedInterests(
    topicQuery: string,
    options: { limit?: number; minWeight?: number } = {}
  ): Promise<InterestItemRecord[]> {
    try {
      const { limit = 10, minWeight = 0.3 } = options;

      const result = await this.cloudStorage.queryVectorizedRecords(topicQuery, {
        user_id: this.userId,
        record_types: ['interest_item'],
        limit: limit * 2, // 获取更多结果用于过滤
        metadata_filters: {
          current_weight: { $gte: minWeight }
        }
      });

      // 按权重和访问频率排序
      return (result.records as InterestItemRecord[])
        .sort((a, b) => {
          const scoreA = a.metadata.current_weight * a.metadata.access_count;
          const scoreB = b.metadata.current_weight * b.metadata.access_count;
          return scoreB - scoreA;
        })
        .slice(0, limit);
    } catch (error) {
      console.error('查找话题相关兴趣项失败:', error);
      return [];
    }
  }

  /**
   * 生成用户画像分析
   */
  async generateAnalysis(): Promise<UserProfileAnalysis | null> {
    try {
      await this.refreshCacheIfNeeded();

      const userRecords = Array.from(this.recordsCache.values());
      
      if (userRecords.length === 0) {
        return null;
      }

      // 分析兴趣分布
      const interestRecords = userRecords.filter(r => r.metadata.record_type === 'interest_item') as InterestItemRecord[];
      const topInterests = {
        projects: this.getTopItemsByCategory(interestRecords, 'project', 3),
        people: this.getTopItemsByCategory(interestRecords, 'person', 3),
        topics: this.getTopItemsByCategory(interestRecords, 'topic', 3)
      };

      // 生成预测兴趣
      const predictedInterests = await this.predictInterests();

      // 分析行为模式
      const behaviorRecords = userRecords.filter(r => r.metadata.record_type === 'behavior_pattern') as BehaviorPatternRecord[];
      const insights = {
        workingPattern: this.analyzeBehaviorPatterns(behaviorRecords, 'time_preference'),
        collaborationStyle: this.analyzeBehaviorPatterns(behaviorRecords, 'communication_style'),
        focusAreas: this.getTopItemsByCategory(interestRecords, 'technology', 5),
        suggestedContent: await this.generateContentSuggestions()
      };

      return {
        userId: this.userId,
        timestamp: Date.now(),
        topInterests,
        predictedInterests,
        insights
      };
    } catch (error) {
      console.error('生成用户画像分析失败:', error);
      return null;
    }
  }

  /**
   * 获取用户画像统计信息
   */
  async getProfileStats(): Promise<{
    totalRecords: number;
    recordsByType: Record<string, number>;
    lastUpdate: number;
    healthScore: number;
  }> {
    try {
      await this.refreshCacheIfNeeded();

      const records = Array.from(this.recordsCache.values());
      const recordsByType = records.reduce((acc, record) => {
        const type = record.metadata.record_type;
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const lastUpdate = Math.max(...records.map(r => r.metadata.updated_at));
      
      // 计算健康度（基于记录分布和时效性）
      const typeCount = Object.keys(recordsByType).length;
      const expectedTypes = 4; // interest_item, behavior_pattern, social_relationship, expertise_area
      const typeHealthScore = typeCount / expectedTypes;
      
      const now = Date.now();
      const daysSinceUpdate = (now - lastUpdate) / (24 * 60 * 60 * 1000);
      const timelinessScore = Math.max(0, 1 - (daysSinceUpdate / 30)); // 30天内更新为满分
      
      const healthScore = (typeHealthScore + timelinessScore) / 2;

      return {
        totalRecords: records.length,
        recordsByType,
        lastUpdate,
        healthScore
      };
    } catch (error) {
      console.error('获取用户画像统计失败:', error);
      return {
        totalRecords: 0,
        recordsByType: {},
        lastUpdate: 0,
        healthScore: 0
      };
    }
  }

  // =================== 私有方法 ===================

  /**
   * 刷新缓存
   */
  private async refreshCache(): Promise<void> {
    try {
      const result = await this.cloudStorage.queryVectorizedRecords('', {
        user_id: this.userId,
        limit: 1000 // 获取用户所有记录
      });

      this.recordsCache.clear();
      result.records.forEach(record => {
        this.recordsCache.set(record.id, record);
      });

      this.lastCacheUpdate = Date.now();
      console.log(`📋 缓存已刷新，加载 ${result.records.length} 条记录`);
    } catch (error) {
      console.error('刷新缓存失败:', error);
    }
  }

  /**
   * 根据需要刷新缓存
   */
  private async refreshCacheIfNeeded(): Promise<void> {
    const now = Date.now();
    if (now - this.lastCacheUpdate > this.cacheValidityPeriod) {
      await this.refreshCache();
    }
  }

  /**
   * 更新现有兴趣记录
   */
  private updateExistingInterestRecord(
    existingRecord: InterestItemRecord,
    action: UserAction,
    timestamp: number
  ): InterestItemRecord {
    const metadata = existingRecord.metadata;
    
    // 更新基础字段
    metadata.updated_at = timestamp;
    metadata.last_accessed = timestamp;
    metadata.access_count = metadata.access_count + 1;

    // 更新权重（简化权重计算）
    const actionWeight = this.getActionWeight(action.actionType);
    metadata.current_weight = Math.min(1, metadata.current_weight + actionWeight * 0.1);

    // 更新最近行为
    if (!metadata.recent_action_types.includes(action.actionType)) {
      metadata.recent_action_types.push(action.actionType);
      if (metadata.recent_action_types.length > 5) {
        metadata.recent_action_types.shift();
      }
    }

    // 重新计算交互频率
    const daysSinceFirst = Math.max(1, (timestamp - metadata.first_seen) / (24 * 60 * 60 * 1000));
    metadata.interaction_frequency = metadata.access_count / daysSinceFirst;

    // 重新生成文档文本
    existingRecord.document = this.generateInterestItemDocument(metadata);

    return existingRecord;
  }

  /**
   * 创建新兴趣记录
   */
  private createNewInterestRecord(
    targetItem: UserProfileUpdate['targetItem'],
    action: UserAction,
    timestamp: number
  ): InterestItemRecord {
    const recordId = `${this.userId}_interest_${targetItem.type}_${this.sanitizeId(targetItem.id)}`;
    const actionWeight = this.getActionWeight(action.actionType);

    const metadata = {
      record_type: 'interest_item' as const,
      interest_category: targetItem.type as any,
      user_id: this.userId,
      created_at: timestamp,
      updated_at: timestamp,
      last_accessed: timestamp,
      confidence_score: 0.5,
      
      name: targetItem.name,
      current_weight: actionWeight,
      access_count: 1,
      first_seen: timestamp,
      
      recent_action_types: [action.actionType],
      interaction_frequency: 1,
      trend: 'increasing' as const
    };

    const document = this.generateInterestItemDocument(metadata);

    return {
      id: recordId,
      document,
      metadata
    };
  }

  /**
   * 生成兴趣项文档文本
   */
  private generateInterestItemDocument(metadata: any): string {
    return `${metadata.interest_category}: ${metadata.name}, 权重: ${metadata.current_weight.toFixed(2)}, 访问: ${metadata.access_count}次, 趋势: ${metadata.trend}`;
  }

  /**
   * 生成行为模式文档文本
   */
  private generateBehaviorPatternDocument(record: BehaviorPatternRecord): string {
    const { pattern_type } = record.metadata;
    
    switch (pattern_type) {
      case 'time_preference':
        return `时间偏好: 活跃时段 ${record.metadata.active_hours?.join(', ')}时, 峰值: ${record.metadata.peak_productivity_time}`;
      case 'communication_style':
        return `沟通风格: ${record.metadata.formality_level}正式度, ${record.metadata.detail_preference}详细度, ${record.metadata.response_speed}响应`;
      case 'tool_usage':
        return `工具使用: ${record.metadata.primary_tools?.map(t => t.name).join(', ')}`;
      default:
        return `行为模式: ${pattern_type}`;
    }
  }

  /**
   * 更新时间偏好数据
   */
  private updateTimePreferenceData(record: BehaviorPatternRecord, data: any): void {
    const metadata = record.metadata;
    metadata.active_hours = data.activeHours || metadata.active_hours || [];
    metadata.peak_productivity_time = data.peakTime || metadata.peak_productivity_time;
    metadata.work_days_preference = data.workDays || metadata.work_days_preference || [];
  }

  /**
   * 更新沟通风格数据
   */
  private updateCommunicationStyleData(record: BehaviorPatternRecord, data: any): void {
    const metadata = record.metadata;
    metadata.formality_level = data.formality || metadata.formality_level;
    metadata.detail_preference = data.detailLevel || metadata.detail_preference;
    metadata.response_speed = data.responseSpeed || metadata.response_speed;
    metadata.preferred_channels = data.channels || metadata.preferred_channels || [];
  }

  /**
   * 更新工具使用数据
   */
  private updateToolUsageData(record: BehaviorPatternRecord, data: any): void {
    const metadata = record.metadata;
    if (data.toolName) {
      const tools = metadata.primary_tools || [];
      const tool = tools.find(t => t.name === data.toolName);
      
      if (tool) {
        tool.frequency = (tool.frequency || 0) + 1;
        tool.last_used = Date.now();
      } else {
        tools.push({
          name: data.toolName,
          frequency: 1,
          proficiency: data.proficiency || 0.5,
          last_used: Date.now()
        });
      }
      
      metadata.primary_tools = tools.slice(0, 10); // 保留前10个工具
    }
  }

  /**
   * 获取行为权重
   */
  private getActionWeight(actionType: string): number {
    const weights: Record<string, number> = {
      'view': 0.1,
      'edit': 0.3,
      'create': 0.4,
      'link': 0.25,
      'mention': 0.2,
      'search': 0.15,
      'favorite': 0.5
    };
    return weights[actionType] || 0.1;
  }

  /**
   * 按分类获取顶级项目
   */
  private getTopItemsByCategory(
    records: InterestItemRecord[], 
    category: string, 
    limit: number
  ): string[] {
    return records
      .filter(r => r.metadata.interest_category === category)
      .sort((a, b) => b.metadata.current_weight - a.metadata.current_weight)
      .slice(0, limit)
      .map(r => r.metadata.name);
  }

  /**
   * 分析行为模式
   */
  private analyzeBehaviorPatterns(records: BehaviorPatternRecord[], patternType: string): string {
    const record = records.find(r => r.metadata.pattern_type === patternType);
    if (!record) return '数据不足';
    
    return record.document;
  }

  /**
   * 预测兴趣
   */
  private async predictInterests(): Promise<Array<{
    item: string;
    type: UserInterestItem['type'];
    confidence: number;
    reason: string;
  }>> {
    // 简化实现：基于相似用户的兴趣推荐
    const similarUsers = await this.findSimilarUsers({ limit: 5 });
    
    const predictions = [];
    for (const user of similarUsers.slice(0, 3)) {
      predictions.push({
        item: `与${user.user_id}类似的兴趣项`,
        type: 'topic' as const,
        confidence: user.similarity_score,
        reason: `基于相似用户推荐`
      });
    }
    
    return predictions;
  }

  /**
   * 生成内容建议
   */
  private async generateContentSuggestions(): Promise<string[]> {
    const interestRecords = Array.from(this.recordsCache.values())
      .filter(r => r.metadata.record_type === 'interest_item') as InterestItemRecord[];
    
    return interestRecords
      .sort((a, b) => b.metadata.current_weight - a.metadata.current_weight)
      .slice(0, 3)
      .map(r => `关注 ${r.metadata.name} 的最新动态`);
  }

  /**
   * 获取当前用户画像（兼容旧接口）
   */
  async getProfile(): Promise<UserProfile | null> {
    try {
      await this.refreshCacheIfNeeded();
      
      // 从向量化记录重构传统UserProfile格式
      const records = Array.from(this.recordsCache.values());
      
      if (records.length === 0) {
        return null;
      }

      // 分类记录
      const interestRecords = records.filter(r => r.metadata.record_type === 'interest_item') as InterestItemRecord[];
      const behaviorRecords = records.filter(r => r.metadata.record_type === 'behavior_pattern') as BehaviorPatternRecord[];
      const socialRecords = records.filter(r => r.metadata.record_type === 'social_relationship') as SocialRelationshipRecord[];
      const expertiseRecords = records.filter(r => r.metadata.record_type === 'expertise_area') as ExpertiseAreaRecord[];

      // 重构兴趣数据
      const interests = {
        projects: this.reconstructInterestItems(interestRecords, 'project'),
        people: this.reconstructInterestItems(interestRecords, 'person'),
        topics: this.reconstructInterestItems(interestRecords, 'topic'),
        jiraTickets: this.reconstructInterestItems(interestRecords, 'jira'),
        technologies: this.reconstructInterestItems(interestRecords, 'technology'),
        documents: this.reconstructInterestItems(interestRecords, 'document')
      };

      // 重构行为模式
      const behaviorPatterns = this.reconstructBehaviorPatterns(behaviorRecords);

      // 重构衍生偏好
      const derivedPreferences = this.reconstructDerivedPreferences(interestRecords, expertiseRecords);

      // 计算统计数据
      const statistics = this.calculateStatistics(records);

      const now = Date.now();
      const profile: UserProfile = {
        userId: this.userId,
        createdAt: Math.min(...records.map(r => r.metadata.created_at)),
        lastUpdated: Math.max(...records.map(r => r.metadata.updated_at)),
        interests,
        behaviorPatterns,
        derivedPreferences,
        statistics
      };

      return profile;
    } catch (error) {
      console.error('获取用户画像失败:', error);
      return null;
    }
  }

  /**
   * 设置用户明确的重要性标记
   */
  async setExplicitImportance(
    itemId: string,
    type: UserInterestItem['type'],
    importance: number
  ): Promise<boolean> {
    try {
      const recordId = `${this.userId}_interest_${type}_${this.sanitizeId(itemId)}`;
      let record = this.recordsCache.get(recordId) as InterestItemRecord;

      if (!record) {
        // 尝试从云端获取
        const queryResult = await this.cloudStorage.queryVectorizedRecords('', {
          user_id: this.userId,
          record_types: ['interest_item'],
          metadata_filters: { interest_category: type }
        });

        const foundRecord = queryResult.records.find(r => 
          (r.metadata as any).name === itemId || r.id.includes(this.sanitizeId(itemId))
        ) as InterestItemRecord;

        if (!foundRecord) {
          return false;
        }
        record = foundRecord;
      }

      // 更新重要性
      record.metadata.explicit_importance = Math.max(0, Math.min(1, importance));
      record.metadata.updated_at = Date.now();

      // 重新生成文档（可能需要更新向量）
      record.document = this.generateInterestItemDocument(record.metadata);

      // 保存到云端
      const success = await this.cloudStorage.storeVectorizedRecord(record);
      
      if (success) {
        this.recordsCache.set(record.id, record);
        console.log(`✅ 设置重要性成功: ${itemId} = ${importance}`);
      }

      return success;
    } catch (error) {
      console.error('设置用户重要性失败:', error);
      return false;
    }
  }

  /**
   * 应用权重衰变
   */
  async applyWeightDecay(): Promise<void> {
    try {
      await this.refreshCacheIfNeeded();

      const now = Date.now();
      const records = Array.from(this.recordsCache.values());
      const interestRecords = records.filter(r => r.metadata.record_type === 'interest_item') as InterestItemRecord[];
      
      let hasChanges = false;
      const decayRate = 0.05; // 5% 衰变率
      const minWeight = 0.01;

      for (const record of interestRecords) {
        const oldWeight = record.metadata.current_weight;
        const daysSinceLastAccess = (now - (record.metadata.last_accessed || now)) / (24 * 60 * 60 * 1000);
        
        // 计算衰变
        let decay = decayRate;
        
        // 明确重要性降低衰变
        if (record.metadata.explicit_importance && record.metadata.explicit_importance > 0.5) {
          decay *= 0.5;
        }
        
        // 最近访问降低衰变
        if (daysSinceLastAccess < 7) {
          decay *= 0.7;
        }

        // 应用衰变
        record.metadata.current_weight = Math.max(minWeight, oldWeight * (1 - decay));
        
        if (record.metadata.current_weight !== oldWeight) {
          hasChanges = true;
          record.metadata.updated_at = now;
          record.document = this.generateInterestItemDocument(record.metadata);
        }
      }

      if (hasChanges) {
        // 批量更新
        const updatedRecords = interestRecords.filter(r => r.metadata.updated_at === now);
        await this.cloudStorage.storeVectorizedRecordsBatch(updatedRecords);
        
        // 更新缓存
        updatedRecords.forEach(record => {
          this.recordsCache.set(record.id, record);
        });

        console.log(`✅ 权重衰变完成，更新了 ${updatedRecords.length} 条记录`);
      }
    } catch (error) {
      console.error('权重衰变失败:', error);
    }
  }

  /**
   * 融合用户上下文配置
   */
  async fuseUserContextConfig(userContextConfig: any): Promise<boolean> {
    try {
      // 创建或更新用户概要记录来存储显式配置
      const summaryId = `${this.userId}_config_summary_${Date.now()}`;
      
      const summaryText = `用户配置信息: 
        个人信息: ${userContextConfig.personalInfo?.title || ''} (${userContextConfig.personalInfo?.department || ''})
        团队: ${userContextConfig.teamInfo?.teamName || ''}
        工作重点: ${userContextConfig.workFocus?.primaryConcerns?.join(', ') || ''}
        沟通风格: ${userContextConfig.communicationContext?.communicationStyle || ''}`;

      const summaryRecord: UserSummaryRecord = {
        id: summaryId,
        document: summaryText,
        metadata: {
          record_type: 'user_summary',
          summary_type: 'overall',
          user_id: this.userId,
          created_at: Date.now(),
          updated_at: Date.now(),
          total_records: 1,
          summary_period: { start: Date.now(), end: Date.now() },
          weight_distribution: { high_weight_items: 0, medium_weight_items: 0, low_weight_items: 0 },
          activity_metrics: {
            daily_average_interactions: 0,
            peak_activity_hours: [],
            most_active_categories: []
          },
          growth_trends: {
            new_interests_per_month: 0,
            skill_development_rate: 0,
            social_network_growth: 0
          },
          auto_generated: false,
          generation_algorithm: 'user_config_v1.0'
        }
      };

      const success = await this.cloudStorage.storeVectorizedRecord(summaryRecord);
      
      if (success) {
        this.recordsCache.set(summaryId, summaryRecord);
        console.log('✅ 用户配置融合成功');
        return true;
      }

      return false;
    } catch (error) {
      console.error('融合用户上下文配置失败:', error);
      return false;
    }
  }

  /**
   * 权重自适应调整
   */
  async adaptiveWeightAdjustment(): Promise<void> {
    try {
      await this.refreshCacheIfNeeded();

      const records = Array.from(this.recordsCache.values());
      const interestRecords = records.filter(r => r.metadata.record_type === 'interest_item') as InterestItemRecord[];
      
      const totalInteractions = interestRecords.reduce((sum, r) => sum + r.metadata.access_count, 0);
      const profileAge = (Date.now() - Math.min(...records.map(r => r.metadata.created_at))) / (24 * 60 * 60 * 1000);

      // 根据使用经验调整权重
      let adjustmentFactor = 1.0;
      
      if (profileAge > 30 && totalInteractions > 200) {
        // 成熟用户：增强显式重要性的影响
        adjustmentFactor = 1.3;
      } else if (profileAge > 7 && totalInteractions > 50) {
        // 学习阶段：平衡权重
        adjustmentFactor = 1.1;
      }

      // 应用调整
      let hasChanges = false;
      for (const record of interestRecords) {
        if (record.metadata.explicit_importance && record.metadata.explicit_importance > 0) {
          const oldWeight = record.metadata.current_weight;
          const explicitBoost = record.metadata.explicit_importance * adjustmentFactor * 0.2;
          record.metadata.current_weight = Math.min(1, oldWeight + explicitBoost);
          
          if (record.metadata.current_weight !== oldWeight) {
            hasChanges = true;
            record.metadata.updated_at = Date.now();
            record.document = this.generateInterestItemDocument(record.metadata);
          }
        }
      }

      if (hasChanges) {
        const updatedRecords = interestRecords.filter(r => r.metadata.updated_at === Date.now());
        await this.cloudStorage.storeVectorizedRecordsBatch(updatedRecords);
        
        updatedRecords.forEach(record => {
          this.recordsCache.set(record.id, record);
        });

        console.log(`✅ 权重自适应调整完成，调整了 ${updatedRecords.length} 条记录`);
      }
    } catch (error) {
      console.error('权重自适应调整失败:', error);
    }
  }

  /**
   * 生成主动推荐内容
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
    try {
      await this.refreshCacheIfNeeded();

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

      const interestRecords = Array.from(this.recordsCache.values())
        .filter(r => r.metadata.record_type === 'interest_item') as InterestItemRecord[];

      // 基于高权重兴趣生成推荐
      const topInterests = interestRecords
        .sort((a, b) => b.metadata.current_weight - a.metadata.current_weight)
        .slice(0, 3);

      topInterests.forEach((interest, index) => {
        recommendations.push({
          id: `rec_${interest.id}_${index}`,
          type: 'content',
          title: `深入了解 ${interest.metadata.name}`,
          description: `基于你对 ${interest.metadata.name} 的高关注度，建议获取最新相关信息`,
          confidence: interest.metadata.current_weight,
          reason: `权重分数: ${interest.metadata.current_weight.toFixed(2)}`,
          priority: interest.metadata.current_weight > 0.7 ? 'high' : 'medium'
        });
      });

      // 基于长时间未访问的项目生成提醒
      const staleInterests = interestRecords
        .filter(r => {
          const daysSinceAccess = (Date.now() - (r.metadata.last_accessed || 0)) / (24 * 60 * 60 * 1000);
          return daysSinceAccess > 7 && r.metadata.current_weight > 0.3;
        })
        .slice(0, 2);

      staleInterests.forEach((interest, index) => {
        recommendations.push({
          id: `action_stale_${interest.id}_${index}`,
          type: 'action',
          title: `跟进 ${interest.metadata.name}`,
          description: `你已经一段时间没有关注 ${interest.metadata.name}，建议检查最新进展`,
          confidence: 0.6,
          reason: '基于访问间隔和权重分析',
          priority: 'medium'
        });
      });

      return recommendations
        .sort((a, b) => {
          const priorityOrder = { high: 3, medium: 2, low: 1 };
          const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
          return priorityDiff !== 0 ? priorityDiff : b.confidence - a.confidence;
        })
        .slice(0, 5);
    } catch (error) {
      console.error('生成主动推荐失败:', error);
      return [];
    }
  }

  /**
   * 获取融合兴趣列表
   */
  getFusedInterestItems<T extends { weight?: number; currentWeight?: number; explicitImportance?: number }>(items: T[]): T[] {
    return items.map(item => {
      const baseWeight = item.weight || item.currentWeight || 0;
      const explicitImportance = item.explicitImportance || 0;
      
      // 简单融合算法：70%隐式权重 + 30%显式重要性
      const fusedWeight = baseWeight * 0.7 + explicitImportance * 0.3;
      
      return {
        ...item,
        weight: fusedWeight,
        currentWeight: fusedWeight
      };
    }).sort((a, b) => (b.weight || b.currentWeight || 0) - (a.weight || a.currentWeight || 0));
  }

  // =================== 辅助重构方法 ===================

  /**
   * 重构兴趣项
   */
  private reconstructInterestItems(records: InterestItemRecord[], category: string): UserInterestItem[] {
    return records
      .filter(r => r.metadata.interest_category === category)
      .map(r => ({
        id: r.id,
        type: category as UserInterestItem['type'],
        name: r.metadata.name,
        metadata: {
          category: r.metadata.interest_category,
          trend: r.metadata.trend
        },
        firstSeen: r.metadata.first_seen,
        lastAccessed: r.metadata.last_accessed || r.metadata.updated_at,
        accessCount: r.metadata.access_count,
        totalEngagementTime: r.metadata.total_engagement_time,
        userActions: r.metadata.recent_action_types.map(actionType => ({
          actionType: actionType as UserAction['actionType'],
          timestamp: r.metadata.updated_at,
          weight: this.getActionWeight(actionType),
          context: 'reconstructed'
        })),
        currentWeight: r.metadata.current_weight,
        decayFactor: 1.0,
        explicitImportance: r.metadata.explicit_importance
      }));
  }

  /**
   * 重构行为模式
   */
  private reconstructBehaviorPatterns(records: BehaviorPatternRecord[]): any {
    const timePattern = records.find(r => r.metadata.pattern_type === 'time_preference');
    const commPattern = records.find(r => r.metadata.pattern_type === 'communication_style');
    const toolPattern = records.find(r => r.metadata.pattern_type === 'tool_usage');

    return {
      activeTimeZones: timePattern?.metadata.active_hours?.map(hour => ({
        hour,
        dayOfWeek: 1, // 简化处理
        activityLevel: 0.7
      })) || [],
      primaryWorkAreas: ['general'],
      communicationStyle: {
        formality: commPattern?.metadata.formality_level || 'semi-formal',
        detailLevel: commPattern?.metadata.detail_preference || 'medium',
        responseSpeed: commPattern?.metadata.response_speed || 'normal',
        preferredChannels: commPattern?.metadata.preferred_channels || []
      },
      toolUsageFrequency: toolPattern?.metadata.primary_tools?.map(tool => ({
        toolName: tool.name,
        frequency: tool.frequency,
        lastUsed: tool.last_used,
        primaryUseCase: 'work'
      })) || []
    };
  }

  /**
   * 重构衍生偏好
   */
  private reconstructDerivedPreferences(interestRecords: InterestItemRecord[], expertiseRecords: ExpertiseAreaRecord[]): any {
    const projects = interestRecords.filter(r => r.metadata.interest_category === 'project');
    const people = interestRecords.filter(r => r.metadata.interest_category === 'person');
    
    return {
      preferredProjectTypes: projects.slice(0, 3).map(p => p.metadata.project_type || 'general'),
      keyCollaborators: people.slice(0, 5).map(p => p.metadata.name),
      expertiseAreas: expertiseRecords.slice(0, 5).map(e => e.metadata.skill_name),
      riskSensitivity: 'medium' as const,
      updateFrequency: 'daily' as const
    };
  }

  /**
   * 计算统计数据
   */
  private calculateStatistics(records: VectorizedRecord[]): any {
    const interestRecords = records.filter(r => r.metadata.record_type === 'interest_item') as InterestItemRecord[];
    
    const totalInteractions = interestRecords.reduce((sum, r) => sum + r.metadata.access_count, 0);
    const avgDailyActivity = totalInteractions / 30; // 简化计算

    const actionTypes: Record<string, number> = {};
    interestRecords.forEach(r => {
      r.metadata.recent_action_types.forEach(actionType => {
        actionTypes[actionType] = (actionTypes[actionType] || 0) + 1;
      });
    });

    return {
      totalInteractions,
      averageDailyActivity: avgDailyActivity,
      mostActiveDay: new Date().toDateString(),
      topInteractionTypes: actionTypes
    };
  }

  /**
   * 清理ID字符串
   */
  private sanitizeId(id: string): string {
    return id.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
  }
}
