/**
 * 用户画像查询服务
 * 实现各种复杂的查询场景和用户相似性分析
 */

import { CloudStorage } from '../storage/CloudStorage';
import { 
  UserprofilesRecord,
  InterestItemRecord,
  BehaviorPatternRecord,
  UserSimilarityResult
} from '../types/userProfile';

export interface UserCompatibilityResult {
  user_id: string;
  compatibility_score: number;
  compatibility_reasons: Array<{
    category: string;
    score: number;
    shared_items: string[];
  }>;
  collaboration_potential: 'high' | 'medium' | 'low';
  recommended_interaction_type: string[];
}

export interface TrendingInterestResult {
  interest_name: string;
  interest_category: string;
  trending_score: number;
  user_count: number;
  recent_growth_rate: number;
  representative_users: string[];
}

export interface SkillGapAnalysisResult {
  user_id: string;
  skill_gaps: Array<{
    skill_name: string;
    gap_level: 'critical' | 'important' | 'nice-to-have';
    recommended_mentors: string[];
    estimated_learning_time: string;
  }>;
  skill_strengths: Array<{
    skill_name: string;
    proficiency_level: number;
    uniqueness_score: number;
  }>;
  learning_recommendations: string[];
}

export interface InterestRelevanceResult {
  record: InterestItemRecord;
  relevance_score: number;
  frequency_score: number;
  combined_score: number;
}

export class UserProfileQueryService {
  constructor(private cloudStorage: CloudStorage) {}

  /**
   * 查找兴趣偏好相似的用户
   */
  async findUsersWithSimilarInterests(
    userId: string, 
    options: {
      limit?: number;
      similarityThreshold?: number;
      includeReasons?: boolean;
    } = {}
  ): Promise<UserSimilarityResult[]> {
    const { limit = 10, similarityThreshold = 0.3, includeReasons = false } = options;
    
    try {
      // 获取目标用户的兴趣项
      const userInterests = await this.cloudStorage.queryUserprofiles({
        user_id: userId,
        record_types: ['interest_item'],
        limit: 100
      });

      if (userInterests.records.length === 0) {
        return [];
      }

      // 构建查询字符串（基于用户的兴趣描述）
      const interestDescriptions = userInterests.records
        .map(record => record.document)
        .join(' ');

      // 查找相似用户
      const similarUsers = await this.cloudStorage.findSimilarUsers(
        userId,
        interestDescriptions,
        {
          record_types: ['interest_item'],
          limit: limit * 2, // 获取更多候选，后面筛选
          similarity_threshold: similarityThreshold
        }
      );

      // 如果需要详细原因，增强结果
      if (includeReasons) {
        return this.enhanceSimilarityResults(similarUsers, userInterests.records as InterestItemRecord[]);
      }

      return similarUsers.slice(0, limit);
    } catch (error) {
      console.error('查找相似用户失败:', error);
      return [];
    }
  }

  /**
   * 查找喜欢聊八卦的用户
   */
  async findGossipLovers(
    excludeUserId?: string,
    options: { limit?: number } = {}
  ): Promise<UserSimilarityResult[]> {
    const { limit = 5 } = options;
    
    try {
      // 构建八卦相关的查询
      const gossipQuery = '八卦 闲聊 社交 非正式交流 团队文化 聊天 趣事 传闻';
      
      const results = await this.cloudStorage.searchByVector(gossipQuery, undefined, {
        collections: ['userprofiles'],
        returnType: 'userprofiles',
        where: { record_type: { $in: ['interest_item', 'behavior_pattern'] } },
        minRelevanceScore: 0.4,
        limit: limit * 3
      });

      // 按用户分组并计算八卦倾向分数
      const userGossipScores = new Map<string, number>();
      
      results.data.forEach(record => {
        const userId = record.metadata.user_id;
        if (excludeUserId && userId === excludeUserId) return;
        
        let score = 0;
        
        // 兴趣项评分
        if (record.metadata.record_type === 'interest_item') {
          const interestRecord = record as InterestItemRecord;
          if (interestRecord.metadata.interest_category === 'topic') {
            const keywords = interestRecord.metadata.topic_keywords || [];
            const socialKeywords = ['八卦', '社交', '聊天', '闲聊', '文化'];
            const matchCount = keywords.filter(k => 
              socialKeywords.some(sk => k.includes(sk) || sk.includes(k))
            ).length;
            score += matchCount * 0.3 + interestRecord.metadata.current_weight * 0.7;
          }
        }
        
        // 行为模式评分
        if (record.metadata.record_type === 'behavior_pattern') {
          const behaviorRecord = record as BehaviorPatternRecord;
          if (behaviorRecord.metadata.pattern_type === 'communication_style') {
            if (behaviorRecord.metadata.formality_level === 'casual') score += 0.4;
            if (behaviorRecord.metadata.response_speed === 'quick') score += 0.2;
            
            const channels = behaviorRecord.metadata.communication_channels || [];
            if (channels.includes('chat') || channels.includes('informal')) score += 0.3;
          }
        }
        
        userGossipScores.set(userId, (userGossipScores.get(userId) || 0) + score);
      });

      // 转换为结果格式
      const gossipResults: UserSimilarityResult[] = Array.from(userGossipScores.entries())
        .sort(([,a], [,b]) => b - a)
        .slice(0, limit)
        .map(([user_id, score]) => ({
          user_id,
          similarity_score: Math.min(score / 2, 1), // 标准化到0-1
          total_matches: 1,
          matching_categories: [{
            category: 'social_interaction',
            similarity: score,
            matching_items: ['社交互动', '非正式交流']
          }]
        }));

      return gossipResults;
    } catch (error) {
      console.error('查找八卦爱好者失败:', error);
      return [];
    }
  }

  /**
   * 查找与特定话题相关的高频兴趣项
   */
  async findTopicRelatedHighFrequencyInterests(
    userId: string,
    topic: string,
    options: { limit?: number } = {}
  ): Promise<InterestRelevanceResult[]> {
    const { limit = 10 } = options;
    
    try {
      // 查询与话题相关的兴趣项
      const topicResults = await this.cloudStorage.searchByVector(topic, undefined, {
        collections: ['userprofiles'],
        returnType: 'userprofiles',
        where: { 
          user_id: userId,
          record_type: { $in: ['interest_item'] }
        },
        minRelevanceScore: 0.2,
        limit: limit * 2
      });

      // 计算相关性和频率分数
      const relevanceResults: InterestRelevanceResult[] = topicResults.data
        .map(record => {
          const interestRecord = record as InterestItemRecord;
          const metadata = interestRecord.metadata;
          
          // 相关性分数（基于向量相似度和关键词匹配）
          let relevanceScore = 0.5; // 基础分数
          
          // 关键词匹配加分
          const keywords = metadata.topic_keywords || [];
          const nameWords = metadata.name.toLowerCase().split(/\s+/);
          const topicWords = topic.toLowerCase().split(/\s+/);
          
          const keywordMatches = keywords.filter(k => 
            topicWords.some(tw => k.toLowerCase().includes(tw) || tw.includes(k.toLowerCase()))
          ).length;
          
          const nameMatches = nameWords.filter(nw =>
            topicWords.some(tw => nw.includes(tw) || tw.includes(nw))
          ).length;
          
          relevanceScore += (keywordMatches * 0.15) + (nameMatches * 0.2);
          
          // 频率分数（基于访问次数和权重）
          const maxAccessCount = 100; // 假设的最大访问次数
          const frequencyScore = Math.min(metadata.access_count / maxAccessCount, 1) * 0.7 + 
                                metadata.current_weight * 0.3;
          
          // 综合分数
          const combinedScore = relevanceScore * 0.6 + frequencyScore * 0.4;
          
          return {
            record: interestRecord,
            relevance_score: relevanceScore,
            frequency_score: frequencyScore,
            combined_score: combinedScore
          };
        })
        .sort((a, b) => b.combined_score - a.combined_score)
        .slice(0, limit);

      return relevanceResults;
    } catch (error) {
      console.error('查找话题相关兴趣失败:', error);
      return [];
    }
  }

  /**
   * 分析用户间的协作兼容性
   */
  async analyzeUserCompatibility(
    userId: string,
    targetUserIds: string[]
  ): Promise<UserCompatibilityResult[]> {
    try {
      const results: UserCompatibilityResult[] = [];
      
      // 获取源用户的所有记录
      const sourceRecords = await this.cloudStorage.queryUserprofiles({
        user_id: userId,
        record_types: ['interest_item', 'behavior_pattern', 'expertise_area'],
        limit: 200
      });

      for (const targetUserId of targetUserIds) {
        // 获取目标用户的记录
        const targetRecords = await this.cloudStorage.queryUserprofiles({
          user_id: targetUserId,
          record_types: ['interest_item', 'behavior_pattern', 'expertise_area'],
          limit: 200
        });

        const compatibility = this.calculateCompatibility(
          sourceRecords.records,
          targetRecords.records
        );

        results.push({
          user_id: targetUserId,
          ...compatibility
        });
      }

      return results.sort((a, b) => b.compatibility_score - a.compatibility_score);
    } catch (error) {
      console.error('分析用户兼容性失败:', error);
      return [];
    }
  }

  /**
   * 发现趋势兴趣
   */
  async discoverTrendingInterests(options: {
    timeWindow?: number; // 天数
    minUsers?: number;
    limit?: number;
  } = {}): Promise<TrendingInterestResult[]> {
    const { timeWindow = 7, minUsers = 2, limit = 10 } = options;
    
    try {
      const cutoffTime = Date.now() - (timeWindow * 24 * 60 * 60 * 1000);
      
      // 获取最近的兴趣项记录
      const recentRecords = await this.cloudStorage.queryUserprofiles({
        record_types: ['interest_item'],
        limit: 1000 // 获取大量记录用于分析
      });

      // 按兴趣名称分组统计
      const interestStats = new Map<string, {
        users: Set<string>;
        totalWeight: number;
        recentActivity: number;
        categories: Set<string>;
      }>();

      recentRecords.records.forEach(record => {
        const interestRecord = record as InterestItemRecord;
        const metadata = interestRecord.metadata;
        
        if (metadata.last_accessed && metadata.last_accessed < cutoffTime) return;
        
        const key = `${metadata.name}_${metadata.interest_category}`;
        
        if (!interestStats.has(key)) {
          interestStats.set(key, {
            users: new Set(),
            totalWeight: 0,
            recentActivity: 0,
            categories: new Set()
          });
        }
        
        const stats = interestStats.get(key)!;
        stats.users.add(metadata.user_id);
        stats.totalWeight += metadata.current_weight;
        stats.categories.add(metadata.interest_category);
        
        if (metadata.last_accessed && metadata.last_accessed > cutoffTime) {
          stats.recentActivity += 1;
        }
      });

      // 计算趋势分数并筛选
      const trendingResults: TrendingInterestResult[] = Array.from(interestStats.entries())
        .filter(([, stats]) => stats.users.size >= minUsers)
        .map(([key, stats]) => {
          const [name, category] = key.split('_');
          
          // 趋势分数 = 用户数量 * 平均权重 * 最近活跃度
          const avgWeight = stats.totalWeight / stats.users.size;
          const trendingScore = stats.users.size * avgWeight * (stats.recentActivity / stats.users.size);
          
          // 计算增长率（简化版本）
          const recentGrowthRate = stats.recentActivity / Math.max(stats.users.size - stats.recentActivity, 1);
          
          return {
            interest_name: name,
            interest_category: category,
            trending_score: trendingScore,
            user_count: stats.users.size,
            recent_growth_rate: recentGrowthRate,
            representative_users: Array.from(stats.users).slice(0, 5)
          };
        })
        .sort((a, b) => b.trending_score - a.trending_score)
        .slice(0, limit);

      return trendingResults;
    } catch (error) {
      console.error('发现趋势兴趣失败:', error);
      return [];
    }
  }

  /**
   * 分析技能缺口
   */
  async analyzeSkillGaps(
    userId: string,
    options: {
      comparisonUserIds?: string[];
      targetRole?: string;
    } = {}
  ): Promise<SkillGapAnalysisResult> {
    try {
      // 获取用户的专业技能记录
      const userSkills = await this.cloudStorage.queryUserprofiles({
        user_id: userId,
        record_types: ['expertise_area', 'interest_item'],
        limit: 100
      });

      // 获取比较用户的技能
      const comparisonSkills: UserprofilesRecord[] = [];
      if (options.comparisonUserIds && options.comparisonUserIds.length > 0) {
        for (const compUserId of options.comparisonUserIds) {
          const skills = await this.cloudStorage.queryUserprofiles({
            user_id: compUserId,
            record_types: ['expertise_area', 'interest_item'],
            limit: 100
          });
          comparisonSkills.push(...skills.records);
        }
      }

      // 分析技能缺口和优势
      const skillAnalysis = this.performSkillGapAnalysis(userSkills.records, comparisonSkills);
      
      return {
        user_id: userId,
        ...skillAnalysis
      };
    } catch (error) {
      console.error('分析技能缺口失败:', error);
      return {
        user_id: userId,
        skill_gaps: [],
        skill_strengths: [],
        learning_recommendations: []
      };
    }
  }

  // =================== 私有辅助方法 ===================

  /**
   * 增强相似性结果，添加详细原因
   */
  private enhanceSimilarityResults(
    results: UserSimilarityResult[],
    userInterests: InterestItemRecord[]
  ): UserSimilarityResult[] {
    return results.map(result => {
      // 简化版本：基于兴趣类别匹配
      const userCategories = new Set(userInterests.map(i => i.metadata.interest_category));
      const matchingCategories = Array.from(userCategories).map(category => ({
        category,
        similarity: result.similarity_score,
        matching_items: userInterests
          .filter(i => i.metadata.interest_category === category)
          .map(i => i.metadata.name)
          .slice(0, 3)
      }));

      return {
        ...result,
        matching_categories: matchingCategories
      };
    });
  }

  /**
   * 计算用户间兼容性
   */
  private calculateCompatibility(
    sourceRecords: UserprofilesRecord[],
    targetRecords: UserprofilesRecord[]
  ): Omit<UserCompatibilityResult, 'user_id'> {
    // 简化的兼容性计算
    let totalScore = 0;
    const reasons: Array<{ category: string; score: number; shared_items: string[] }> = [];

    // 兴趣匹配
    const sourceInterests = sourceRecords.filter(r => r.metadata.record_type === 'interest_item') as InterestItemRecord[];
    const targetInterests = targetRecords.filter(r => r.metadata.record_type === 'interest_item') as InterestItemRecord[];
    
    const sharedInterests = sourceInterests.filter(si => 
      targetInterests.some(ti => ti.metadata.name === si.metadata.name)
    );
    
    const interestScore = sharedInterests.length / Math.max(sourceInterests.length, 1);
    totalScore += interestScore * 0.4;
    
    if (sharedInterests.length > 0) {
      reasons.push({
        category: 'shared_interests',
        score: interestScore,
        shared_items: sharedInterests.map(i => i.metadata.name).slice(0, 3)
      });
    }

    // 行为模式匹配
    const sourceBehaviors = sourceRecords.filter(r => r.metadata.record_type === 'behavior_pattern') as BehaviorPatternRecord[];
    const targetBehaviors = targetRecords.filter(r => r.metadata.record_type === 'behavior_pattern') as BehaviorPatternRecord[];
    
    let behaviorScore = 0;
    const behaviorMatches: string[] = [];
    
    sourceBehaviors.forEach(sb => {
      const matchingBehavior = targetBehaviors.find(tb => 
        tb.metadata.pattern_type === sb.metadata.pattern_type
      );
      
      if (matchingBehavior) {
        if (sb.metadata.pattern_type === 'communication_style') {
          if (sb.metadata.formality_level === matchingBehavior.metadata.formality_level) {
            behaviorScore += 0.3;
            behaviorMatches.push('沟通风格匹配');
          }
        }
      }
    });
    
    totalScore += behaviorScore;
    
    if (behaviorMatches.length > 0) {
      reasons.push({
        category: 'behavior_patterns',
        score: behaviorScore,
        shared_items: behaviorMatches
      });
    }

    // 确定协作潜力
    let collaborationPotential: 'high' | 'medium' | 'low' = 'low';
    if (totalScore > 0.7) collaborationPotential = 'high';
    else if (totalScore > 0.4) collaborationPotential = 'medium';

    // 推荐交互类型
    const recommendedInteractionType: string[] = [];
    if (sharedInterests.length > 3) recommendedInteractionType.push('项目协作');
    if (behaviorScore > 0.5) recommendedInteractionType.push('日常交流');
    if (totalScore > 0.6) recommendedInteractionType.push('知识分享');

    return {
      compatibility_score: totalScore,
      compatibility_reasons: reasons,
      collaboration_potential: collaborationPotential,
      recommended_interaction_type: recommendedInteractionType
    };
  }

  /**
   * 执行技能缺口分析
   */
  private performSkillGapAnalysis(
    userRecords: UserprofilesRecord[],
    comparisonRecords: UserprofilesRecord[]
  ): Omit<SkillGapAnalysisResult, 'user_id'> {
    // 提取用户技能
    const userSkills = new Map<string, number>();
    const userTechInterests = userRecords
      .filter(r => r.metadata.record_type === 'interest_item') as InterestItemRecord[];
    
    userTechInterests.forEach(record => {
      if (record.metadata.interest_category === 'technology') {
        userSkills.set(record.metadata.name, record.metadata.current_weight);
      }
    });

    // 提取比较用户的技能
    const comparisonSkills = new Map<string, number[]>();
    (comparisonRecords
      .filter(r => r.metadata.record_type === 'interest_item') as InterestItemRecord[])
      .forEach(record => {
        if (record.metadata.interest_category === 'technology') {
          const skill = record.metadata.name;
          if (!comparisonSkills.has(skill)) {
            comparisonSkills.set(skill, []);
          }
          comparisonSkills.get(skill)!.push(record.metadata.current_weight);
        }
      });

    // 计算缺口
    const skillGaps: Array<{
      skill_name: string;
      gap_level: 'critical' | 'important' | 'nice-to-have';
      recommended_mentors: string[];
      estimated_learning_time: string;
    }> = [];

    comparisonSkills.forEach((weights, skill) => {
      const avgWeight = weights.reduce((a, b) => a + b, 0) / weights.length;
      const userWeight = userSkills.get(skill) || 0;
      
      if (avgWeight > userWeight + 0.3) {
        const gapSize = avgWeight - userWeight;
        skillGaps.push({
          skill_name: skill,
          gap_level: gapSize > 0.6 ? 'critical' : gapSize > 0.4 ? 'important' : 'nice-to-have',
          recommended_mentors: [], // 简化版本
          estimated_learning_time: gapSize > 0.6 ? '3-6个月' : gapSize > 0.4 ? '1-3个月' : '2-4周'
        });
      }
    });

    // 计算优势
    const skillStrengths: Array<{
      skill_name: string;
      proficiency_level: number;
      uniqueness_score: number;
    }> = [];

    userSkills.forEach((weight, skill) => {
      const comparisonWeights = comparisonSkills.get(skill) || [];
      const avgComparisonWeight = comparisonWeights.length > 0 
        ? comparisonWeights.reduce((a, b) => a + b, 0) / comparisonWeights.length 
        : 0;
      
      if (weight > avgComparisonWeight + 0.2) {
        skillStrengths.push({
          skill_name: skill,
          proficiency_level: weight,
          uniqueness_score: weight - avgComparisonWeight
        });
      }
    });

    return {
      skill_gaps: skillGaps.slice(0, 10),
      skill_strengths: skillStrengths.slice(0, 10),
      learning_recommendations: skillGaps.slice(0, 3).map(gap => 
        `建议学习 ${gap.skill_name}，预计需要 ${gap.estimated_learning_time}`
      )
    };
  }
}
