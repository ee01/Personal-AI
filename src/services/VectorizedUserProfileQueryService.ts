/**
 * 向量化用户画像查询服务
 * 实现各种复杂的查询场景和用户相似性分析
 */

import { CloudStorage } from '../storage/CloudStorage';
import { 
  VectorizedRecord,
  InterestItemRecord,
  BehaviorPatternRecord,
  SocialRelationshipRecord,
  ExpertiseAreaRecord,
  VectorizedQueryOptions,
  UserSimilarityResult
} from '../types/vectorizedUserProfile';

export interface UserCompatibilityResult {
  user_id: string;
  compatibility_score: number;
  compatibility_reasons: Array<{
    category: string;
    score: number;
    shared_items: string[];
    complementary_items: string[];
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
  related_topics: string[];
}

export interface SkillGapAnalysisResult {
  user_id: string;
  skill_gaps: Array<{
    skill_name: string;
    gap_level: 'critical' | 'important' | 'nice-to-have';
    learning_priority: number;
    recommended_mentors: string[];
    estimated_learning_time: string;
  }>;
  skill_strengths: Array<{
    skill_name: string;
    proficiency_level: number;
    mentoring_potential: number;
  }>;
}

export class VectorizedUserProfileQueryService {
  private cloudStorage: CloudStorage;

  constructor(cloudStorage?: CloudStorage) {
    this.cloudStorage = cloudStorage || new CloudStorage();
  }

  /**
   * 查询场景1：找到兴趣偏好最相似的用户
   */
  async findUsersWithSimilarInterests(
    currentUserId: string,
    options: {
      interestCategory?: string;
      limit?: number;
      similarityThreshold?: number;
      includeReasons?: boolean;
    } = {}
  ): Promise<UserSimilarityResult[]> {
    const { interestCategory, limit = 10, similarityThreshold = 0.6, includeReasons = true } = options;

    try {
      // 获取当前用户的兴趣项
      const queryOptions: VectorizedQueryOptions = {
        user_id: currentUserId,
        record_types: ['interest_item'],
        limit: 20
      };

      if (interestCategory) {
        queryOptions.metadata_filters = { interest_category: interestCategory };
      }

      const userInterests = await this.cloudStorage.queryVectorizedRecords('', queryOptions);
      
      if (userInterests.records.length === 0) {
        console.log(`用户 ${currentUserId} 没有找到兴趣项记录`);
        return [];
      }

      // 构建查询字符串（基于用户的高权重兴趣）
      const topInterests = (userInterests.records as InterestItemRecord[])
        .filter(item => item.metadata.current_weight > 0.3)
        .sort((a, b) => b.metadata.current_weight - a.metadata.current_weight)
        .slice(0, 5);

      const queryText = topInterests.map(item => item.metadata.name).join(' ');

      // 查找相似用户
      const similarUsers = await this.cloudStorage.findSimilarUsers(currentUserId, queryText, {
        record_types: ['interest_item'],
        limit,
        similarity_threshold: similarityThreshold
      });

      // 如果需要详细原因，增强结果
      if (includeReasons) {
        return await this.enhanceSimilarityResults(similarUsers, currentUserId);
      }

      return similarUsers;
    } catch (error) {
      console.error('查找相似兴趣用户失败:', error);
      return [];
    }
  }

  /**
   * 查询场景2：找到最喜欢聊八卦的人
   */
  async findGossipLovers(
    currentUserId: string,
    options: { limit?: number; threshold?: number } = {}
  ): Promise<UserSimilarityResult[]> {
    const { limit = 10, threshold = 0.5 } = options;

    try {
      // 多维度查询：社交关系 + 沟通风格 + 话题兴趣
      const gossipQueries = [
        '八卦 闲聊 讨论 分享 社交话题',
        '非正式交流 轻松沟通 友好聊天',
        '人际关系 团队文化 社交活动'
      ];

      const allResults: UserSimilarityResult[] = [];

      for (const query of gossipQueries) {
        const results = await this.cloudStorage.findSimilarUsers(currentUserId, query, {
          record_types: ['social_relationship', 'behavior_pattern', 'interest_item'],
          limit: limit * 2,
          similarity_threshold: threshold
        });
        
        allResults.push(...results);
      }

      // 合并和去重结果
      const userScores = new Map<string, { scores: number[]; user: UserSimilarityResult }>();
      
      allResults.forEach(result => {
        if (userScores.has(result.user_id)) {
          userScores.get(result.user_id)!.scores.push(result.similarity_score);
        } else {
          userScores.set(result.user_id, { scores: [result.similarity_score], user: result });
        }
      });

      // 计算综合分数并排序
      const rankedResults = Array.from(userScores.values())
        .map(({ scores, user }) => ({
          ...user,
          similarity_score: scores.reduce((sum, score) => sum + score, 0) / scores.length,
          matching_dimensions: scores.length
        }))
        .sort((a, b) => b.similarity_score - a.similarity_score)
        .slice(0, limit);

      console.log(`🗣️ 找到 ${rankedResults.length} 个可能喜欢聊八卦的用户`);
      return rankedResults;
    } catch (error) {
      console.error('查找八卦爱好者失败:', error);
      return [];
    }
  }

  /**
   * 查询场景3：找到与特定话题相关的高频兴趣项
   */
  async findTopicRelatedHighFrequencyInterests(
    userId: string,
    topicEntity: string,
    options: {
      limit?: number;
      minWeight?: number;
      minAccessCount?: number;
      timeRange?: { start: number; end: number };
    } = {}
  ): Promise<Array<InterestItemRecord & { relevance_score: number; frequency_score: number }>> {
    const { limit = 10, minWeight = 0.2, minAccessCount = 3, timeRange } = options;

    try {
      // 查询与话题相关的兴趣项
      const queryOptions: VectorizedQueryOptions = {
        user_id: userId,
        record_types: ['interest_item'],
        limit: 50, // 获取更多结果用于排序
        metadata_filters: {
          current_weight: { $gte: minWeight },
          access_count: { $gte: minAccessCount }
        }
      };

      if (timeRange) {
        queryOptions.time_range = timeRange;
      }

      const result = await this.cloudStorage.queryVectorizedRecords(
        `${topicEntity} 相关话题 讨论 关注`,
        queryOptions
      );

      // 计算相关性和频率分数
      const enhancedResults = (result.records as InterestItemRecord[]).map((record, index) => {
        const relevanceScore = result.query_metadata.similarity_scores?.[index] || 0;
        const frequencyScore = this.calculateFrequencyScore(record.metadata);
        
        return {
          ...record,
          relevance_score: relevanceScore,
          frequency_score: frequencyScore
        };
      });

      // 按综合分数排序（相关性 + 频率）
      enhancedResults.sort((a, b) => {
        const scoreA = a.relevance_score * 0.6 + a.frequency_score * 0.4;
        const scoreB = b.relevance_score * 0.6 + b.frequency_score * 0.4;
        return scoreB - scoreA;
      });

      const topResults = enhancedResults.slice(0, limit);
      
      console.log(`🎯 找到 ${topResults.length} 个与"${topicEntity}"相关的高频兴趣项`);
      return topResults;
    } catch (error) {
      console.error('查找话题相关兴趣项失败:', error);
      return [];
    }
  }

  /**
   * 查询场景4：用户兼容性分析（适合协作的用户）
   */
  async analyzeUserCompatibility(
    currentUserId: string,
    targetUserIds: string[],
    options: { includeSkillGaps?: boolean; includeWorkStyle?: boolean } = {}
  ): Promise<UserCompatibilityResult[]> {
    const { includeSkillGaps = true, includeWorkStyle = true } = options;

    try {
      const results: UserCompatibilityResult[] = [];

      for (const targetUserId of targetUserIds) {
        const compatibility = await this.calculateUserCompatibility(
          currentUserId, 
          targetUserId, 
          { includeSkillGaps, includeWorkStyle }
        );
        if (compatibility) {
          results.push(compatibility);
        }
      }

      return results.sort((a, b) => b.compatibility_score - a.compatibility_score);
    } catch (error) {
      console.error('用户兼容性分析失败:', error);
      return [];
    }
  }

  /**
   * 查询场景5：发现趋势兴趣（跨用户分析）
   */
  async discoverTrendingInterests(
    options: {
      timeWindow?: number; // 时间窗口（天）
      minUsers?: number;   // 最少用户数
      limit?: number;
      categories?: string[];
    } = {}
  ): Promise<TrendingInterestResult[]> {
    const { timeWindow = 30, minUsers = 3, limit = 10, categories } = options;

    try {
      const cutoffTime = Date.now() - (timeWindow * 24 * 60 * 60 * 1000);
      
      // 查询最近的兴趣项记录
      const queryOptions: VectorizedQueryOptions = {
        record_types: ['interest_item'],
        limit: 1000,
        time_range: { start: cutoffTime, end: Date.now() }
      };

      if (categories) {
        queryOptions.metadata_filters = { interest_category: { $in: categories } };
      }

      const recentRecords = await this.cloudStorage.queryVectorizedRecords('', queryOptions);
      
      // 分析趋势
      const interestStats = new Map<string, {
        users: Set<string>;
        totalWeight: number;
        recentGrowth: number;
        category: string;
        relatedTopics: Set<string>;
      }>();

      (recentRecords.records as InterestItemRecord[]).forEach(record => {
        const name = record.metadata.name;
        const userId = record.metadata.user_id;
        
        if (!interestStats.has(name)) {
          interestStats.set(name, {
            users: new Set(),
            totalWeight: 0,
            recentGrowth: 0,
            category: record.metadata.interest_category,
            relatedTopics: new Set()
          });
        }
        
        const stats = interestStats.get(name)!;
        stats.users.add(userId);
        stats.totalWeight += record.metadata.current_weight;
        
        // 计算增长率（简化）
        if (record.metadata.trend === 'increasing') {
          stats.recentGrowth += 1;
        }
        
        // 收集相关话题
        if (record.metadata.topic_keywords) {
          record.metadata.topic_keywords.forEach(keyword => stats.relatedTopics.add(keyword));
        }
      });

      // 转换为结果格式
      const trendingResults: TrendingInterestResult[] = [];
      
      for (const [name, stats] of interestStats.entries()) {
        if (stats.users.size >= minUsers) {
          const trendingScore = (stats.totalWeight / stats.users.size) * Math.log(stats.users.size + 1) * (1 + stats.recentGrowth * 0.1);
          
          trendingResults.push({
            interest_name: name,
            interest_category: stats.category,
            trending_score: trendingScore,
            user_count: stats.users.size,
            recent_growth_rate: stats.recentGrowth / stats.users.size,
            related_topics: Array.from(stats.relatedTopics).slice(0, 5)
          });
        }
      }

      const sortedResults = trendingResults
        .sort((a, b) => b.trending_score - a.trending_score)
        .slice(0, limit);

      console.log(`📈 发现 ${sortedResults.length} 个趋势兴趣项`);
      return sortedResults;
    } catch (error) {
      console.error('发现趋势兴趣失败:', error);
      return [];
    }
  }

  /**
   * 查询场景6：技能缺口分析
   */
  async analyzeSkillGaps(
    userId: string,
    options: {
      targetRole?: string;
      comparisonUserIds?: string[];
      skillCategories?: string[];
    } = {}
  ): Promise<SkillGapAnalysisResult> {
    const { targetRole, comparisonUserIds = [], skillCategories = ['technical', 'domain'] } = options;

    try {
      // 获取用户当前技能
      const userSkills = await this.cloudStorage.queryVectorizedRecords('', {
        user_id: userId,
        record_types: ['expertise_area'],
        metadata_filters: { expertise_type: { $in: skillCategories } }
      });

      // 获取对比用户的技能（如果提供）
      const comparisonSkills = new Map<string, ExpertiseAreaRecord[]>();
      
      for (const compareUserId of comparisonUserIds) {
        const skills = await this.cloudStorage.queryVectorizedRecords('', {
          user_id: compareUserId,
          record_types: ['expertise_area'],
          metadata_filters: { expertise_type: { $in: skillCategories } }
        });
        comparisonSkills.set(compareUserId, skills.records as ExpertiseAreaRecord[]);
      }

      // 分析技能缺口
      const userSkillMap = new Map((userSkills.records as ExpertiseAreaRecord[]).map(skill => 
        [skill.metadata.skill_name, skill.metadata.proficiency_level]
      ));

      const allSkills = new Set<string>();
      const skillDemand = new Map<string, { count: number; avgProficiency: number }>();

      // 收集所有技能并计算需求
      comparisonSkills.forEach(skills => {
        skills.forEach(skill => {
          const skillName = skill.metadata.skill_name;
          allSkills.add(skillName);
          
          if (!skillDemand.has(skillName)) {
            skillDemand.set(skillName, { count: 0, avgProficiency: 0 });
          }
          
          const demand = skillDemand.get(skillName)!;
          demand.count++;
          demand.avgProficiency = (demand.avgProficiency * (demand.count - 1) + skill.metadata.proficiency_level) / demand.count;
        });
      });

      // 识别缺口
      const skillGaps = [];
      const skillStrengths = [];

      for (const skillName of allSkills) {
        const userProficiency = userSkillMap.get(skillName) || 0;
        const demand = skillDemand.get(skillName);
        
        if (demand && demand.count >= 2) { // 至少2个用户有这个技能
          const gap = demand.avgProficiency - userProficiency;
          
          if (gap > 0.3) { // 显著缺口
            skillGaps.push({
              skill_name: skillName,
              gap_level: gap > 0.7 ? 'critical' as const : gap > 0.5 ? 'important' as const : 'nice-to-have' as const,
              learning_priority: gap * demand.count,
              recommended_mentors: await this.findSkillMentors(skillName, userId),
              estimated_learning_time: this.estimateLearningTime(gap)
            });
          } else if (userProficiency > 0.7) { // 技能优势
            skillStrengths.push({
              skill_name: skillName,
              proficiency_level: userProficiency,
              mentoring_potential: userProficiency - (demand?.avgProficiency || 0)
            });
          }
        }
      }

      // 排序
      skillGaps.sort((a, b) => b.learning_priority - a.learning_priority);
      skillStrengths.sort((a, b) => b.mentoring_potential - a.mentoring_potential);

      console.log(`🎯 技能分析完成：发现 ${skillGaps.length} 个缺口，${skillStrengths.length} 个优势`);

      return {
        user_id: userId,
        skill_gaps: skillGaps.slice(0, 10),
        skill_strengths: skillStrengths.slice(0, 10)
      };
    } catch (error) {
      console.error('技能缺口分析失败:', error);
      return { user_id: userId, skill_gaps: [], skill_strengths: [] };
    }
  }

  // =================== 私有方法 ===================

  /**
   * 增强相似性结果
   */
  private async enhanceSimilarityResults(
    results: UserSimilarityResult[],
    currentUserId: string
  ): Promise<UserSimilarityResult[]> {
    // 为每个相似用户添加详细的匹配原因
    const enhancedResults = [];
    
    for (const result of results) {
      const detailedCategories = [];
      
      for (const category of result.matching_categories) {
        // 获取具体的匹配项目
        const userItems = await this.getUserItemsByCategory(currentUserId, category.category);
        const targetItems = await this.getUserItemsByCategory(result.user_id, category.category);
        
        const sharedItems = userItems.filter(item => 
          targetItems.some(target => target.toLowerCase() === item.toLowerCase())
        );
        
        detailedCategories.push({
          ...category,
          matching_items: sharedItems
        });
      }
      
      enhancedResults.push({
        ...result,
        matching_categories: detailedCategories
      });
    }
    
    return enhancedResults;
  }

  /**
   * 计算用户兼容性
   */
  private async calculateUserCompatibility(
    userId1: string,
    userId2: string,
    options: { includeSkillGaps: boolean; includeWorkStyle: boolean }
  ): Promise<UserCompatibilityResult | null> {
    try {
      const compatibility_reasons = [];
      let totalScore = 0;
      let categoryCount = 0;

      // 1. 兴趣匹配分析
      const interestMatch = await this.analyzeInterestCompatibility(userId1, userId2);
      if (interestMatch) {
        compatibility_reasons.push(interestMatch);
        totalScore += interestMatch.score;
        categoryCount++;
      }

      // 2. 技能互补分析
      if (options.includeSkillGaps) {
        const skillMatch = await this.analyzeSkillCompatibility(userId1, userId2);
        if (skillMatch) {
          compatibility_reasons.push(skillMatch);
          totalScore += skillMatch.score;
          categoryCount++;
        }
      }

      // 3. 工作风格匹配
      if (options.includeWorkStyle) {
        const workStyleMatch = await this.analyzeWorkStyleCompatibility(userId1, userId2);
        if (workStyleMatch) {
          compatibility_reasons.push(workStyleMatch);
          totalScore += workStyleMatch.score;
          categoryCount++;
        }
      }

      if (categoryCount === 0) return null;

      const compatibility_score = totalScore / categoryCount;
      const collaboration_potential = compatibility_score > 0.7 ? 'high' : 
                                    compatibility_score > 0.4 ? 'medium' : 'low';

      return {
        user_id: userId2,
        compatibility_score,
        compatibility_reasons,
        collaboration_potential,
        recommended_interaction_type: this.getRecommendedInteractionTypes(compatibility_reasons)
      };
    } catch (error) {
      console.error('计算用户兼容性失败:', error);
      return null;
    }
  }

  /**
   * 分析兴趣兼容性
   */
  private async analyzeInterestCompatibility(userId1: string, userId2: string): Promise<{
    category: string;
    score: number;
    shared_items: string[];
    complementary_items: string[];
  } | null> {
    try {
      const user1Interests = await this.getUserAllInterests(userId1);
      const user2Interests = await this.getUserAllInterests(userId2);

      const user1Items = new Set(user1Interests.map(i => i.toLowerCase()));
      const user2Items = new Set(user2Interests.map(i => i.toLowerCase()));

      const shared = user1Interests.filter(item => user2Items.has(item.toLowerCase()));
      const user1Unique = user1Interests.filter(item => !user2Items.has(item.toLowerCase()));
      const user2Unique = user2Interests.filter(item => !user1Items.has(item.toLowerCase()));

      const sharedScore = shared.length / Math.max(user1Interests.length, user2Interests.length);
      const complementaryScore = Math.min(user1Unique.length, user2Unique.length) / 
                                Math.max(user1Interests.length, user2Interests.length);

      const totalScore = sharedScore * 0.7 + complementaryScore * 0.3;

      return {
        category: 'interests',
        score: totalScore,
        shared_items: shared,
        complementary_items: [...user1Unique.slice(0, 3), ...user2Unique.slice(0, 3)]
      };
    } catch (error) {
      console.error('分析兴趣兼容性失败:', error);
      return null;
    }
  }

  /**
   * 分析技能兼容性
   */
  private async analyzeSkillCompatibility(userId1: string, userId2: string): Promise<{
    category: string;
    score: number;
    shared_items: string[];
    complementary_items: string[];
  } | null> {
    try {
      const user1Skills = await this.getUserSkills(userId1);
      const user2Skills = await this.getUserSkills(userId2);

      const skillCompatibility = this.calculateSkillCompatibilityScore(user1Skills, user2Skills);

      return {
        category: 'skills',
        score: skillCompatibility.score,
        shared_items: skillCompatibility.shared,
        complementary_items: skillCompatibility.complementary
      };
    } catch (error) {
      console.error('分析技能兼容性失败:', error);
      return null;
    }
  }

  /**
   * 分析工作风格兼容性
   */
  private async analyzeWorkStyleCompatibility(userId1: string, userId2: string): Promise<{
    category: string;
    score: number;
    shared_items: string[];
    complementary_items: string[];
  } | null> {
    try {
      const user1Style = await this.getUserWorkStyle(userId1);
      const user2Style = await this.getUserWorkStyle(userId2);

      if (!user1Style || !user2Style) return null;

      const compatibility = this.calculateWorkStyleCompatibility(user1Style, user2Style);

      return {
        category: 'work_style',
        score: compatibility.score,
        shared_items: compatibility.similarities,
        complementary_items: compatibility.differences
      };
    } catch (error) {
      console.error('分析工作风格兼容性失败:', error);
      return null;
    }
  }

  /**
   * 计算频率分数
   */
  private calculateFrequencyScore(metadata: any): number {
    const weight = metadata.current_weight || 0;
    const accessCount = metadata.access_count || 0;
    const frequency = metadata.interaction_frequency || 0;
    
    return (weight * 0.4 + Math.min(accessCount / 20, 1) * 0.3 + Math.min(frequency, 1) * 0.3);
  }

  /**
   * 查找技能导师
   */
  private async findSkillMentors(skillName: string, excludeUserId: string): Promise<string[]> {
    try {
      const result = await this.cloudStorage.queryVectorizedRecords(`技能专家 ${skillName}`, {
        record_types: ['expertise_area'],
        limit: 10,
        metadata_filters: {
          skill_name: skillName,
          proficiency_level: { $gte: 0.7 },
          user_id: { $ne: excludeUserId }
        }
      });

      return (result.records as ExpertiseAreaRecord[])
        .map(record => record.metadata.user_id)
        .slice(0, 3);
    } catch (error) {
      console.error('查找技能导师失败:', error);
      return [];
    }
  }

  /**
   * 估算学习时间
   */
  private estimateLearningTime(gap: number): string {
    if (gap > 0.7) return '6-12个月';
    if (gap > 0.5) return '3-6个月';
    if (gap > 0.3) return '1-3个月';
    return '2-4周';
  }

  /**
   * 获取用户分类项目
   */
  private async getUserItemsByCategory(userId: string, category: string): Promise<string[]> {
    try {
      const result = await this.cloudStorage.queryVectorizedRecords('', {
        user_id: userId,
        record_types: ['interest_item'],
        metadata_filters: { interest_category: category },
        limit: 20
      });

      return (result.records as InterestItemRecord[]).map(record => record.metadata.name);
    } catch (error) {
      console.error('获取用户分类项目失败:', error);
      return [];
    }
  }

  /**
   * 获取用户所有兴趣
   */
  private async getUserAllInterests(userId: string): Promise<string[]> {
    try {
      const result = await this.cloudStorage.queryVectorizedRecords('', {
        user_id: userId,
        record_types: ['interest_item'],
        limit: 50
      });

      return (result.records as InterestItemRecord[]).map(record => record.metadata.name);
    } catch (error) {
      console.error('获取用户所有兴趣失败:', error);
      return [];
    }
  }

  /**
   * 获取用户技能
   */
  private async getUserSkills(userId: string): Promise<ExpertiseAreaRecord[]> {
    try {
      const result = await this.cloudStorage.queryVectorizedRecords('', {
        user_id: userId,
        record_types: ['expertise_area'],
        limit: 30
      });

      return result.records as ExpertiseAreaRecord[];
    } catch (error) {
      console.error('获取用户技能失败:', error);
      return [];
    }
  }

  /**
   * 获取用户工作风格
   */
  private async getUserWorkStyle(userId: string): Promise<BehaviorPatternRecord | null> {
    try {
      const result = await this.cloudStorage.queryVectorizedRecords('', {
        user_id: userId,
        record_types: ['behavior_pattern'],
        metadata_filters: { pattern_type: 'communication_style' },
        limit: 1
      });

      return result.records.length > 0 ? result.records[0] as BehaviorPatternRecord : null;
    } catch (error) {
      console.error('获取用户工作风格失败:', error);
      return null;
    }
  }

  /**
   * 计算技能兼容性分数
   */
  private calculateSkillCompatibilityScore(skills1: ExpertiseAreaRecord[], skills2: ExpertiseAreaRecord[]): {
    score: number;
    shared: string[];
    complementary: string[];
  } {
    const skills1Map = new Map(skills1.map(s => [s.metadata.skill_name, s.metadata.proficiency_level]));
    const skills2Map = new Map(skills2.map(s => [s.metadata.skill_name, s.metadata.proficiency_level]));

    const allSkills = new Set([...skills1Map.keys(), ...skills2Map.keys()]);
    
    const shared = [];
    const complementary = [];
    let totalCompatibility = 0;

    for (const skill of allSkills) {
      const level1 = skills1Map.get(skill) || 0;
      const level2 = skills2Map.get(skill) || 0;

      if (level1 > 0 && level2 > 0) {
        shared.push(skill);
        // 相似技能等级加分
        totalCompatibility += 1 - Math.abs(level1 - level2);
      } else if ((level1 > 0.7 && level2 < 0.3) || (level2 > 0.7 && level1 < 0.3)) {
        complementary.push(skill);
        // 技能互补加分
        totalCompatibility += 0.6;
      }
    }

    const score = allSkills.size > 0 ? totalCompatibility / allSkills.size : 0;

    return { score, shared, complementary };
  }

  /**
   * 计算工作风格兼容性
   */
  private calculateWorkStyleCompatibility(style1: BehaviorPatternRecord, style2: BehaviorPatternRecord): {
    score: number;
    similarities: string[];
    differences: string[];
  } {
    const similarities = [];
    const differences = [];
    let compatibilityScore = 0;
    let factors = 0;

    // 正式度对比
    if (style1.metadata.formality_level && style2.metadata.formality_level) {
      factors++;
      if (style1.metadata.formality_level === style2.metadata.formality_level) {
        similarities.push(`都偏好${style1.metadata.formality_level}沟通`);
        compatibilityScore += 1;
      } else {
        differences.push(`沟通正式度不同: ${style1.metadata.formality_level} vs ${style2.metadata.formality_level}`);
        compatibilityScore += 0.3;
      }
    }

    // 详细度对比
    if (style1.metadata.detail_preference && style2.metadata.detail_preference) {
      factors++;
      if (style1.metadata.detail_preference === style2.metadata.detail_preference) {
        similarities.push(`都偏好${style1.metadata.detail_preference}详细度`);
        compatibilityScore += 1;
      } else {
        differences.push(`详细度偏好不同: ${style1.metadata.detail_preference} vs ${style2.metadata.detail_preference}`);
        compatibilityScore += 0.4;
      }
    }

    // 响应速度对比
    if (style1.metadata.response_speed && style2.metadata.response_speed) {
      factors++;
      if (style1.metadata.response_speed === style2.metadata.response_speed) {
        similarities.push(`都偏好${style1.metadata.response_speed}响应`);
        compatibilityScore += 1;
      } else {
        differences.push(`响应速度不同: ${style1.metadata.response_speed} vs ${style2.metadata.response_speed}`);
        compatibilityScore += 0.5;
      }
    }

    const score = factors > 0 ? compatibilityScore / factors : 0;
    return { score, similarities, differences };
  }

  /**
   * 获取推荐的交互类型
   */
  private getRecommendedInteractionTypes(reasons: any[]): string[] {
    const types = [];
    
    const hasSharedInterests = reasons.some(r => r.category === 'interests' && r.shared_items.length > 0);
    const hasComplementarySkills = reasons.some(r => r.category === 'skills' && r.complementary_items.length > 0);
    const hasCompatibleWorkStyle = reasons.some(r => r.category === 'work_style' && r.score > 0.6);

    if (hasSharedInterests) {
      types.push('项目协作', '知识分享');
    }
    
    if (hasComplementarySkills) {
      types.push('技能互补', '导师关系');
    }
    
    if (hasCompatibleWorkStyle) {
      types.push('团队合作', '长期协作');
    }
    
    return types.length > 0 ? types : ['一般交流'];
  }
}
