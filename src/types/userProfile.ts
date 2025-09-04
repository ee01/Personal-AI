/**
 * 用户画像系统的类型定义
 * 用于追踪和分析用户的兴趣、行为模式和偏好
 */

/**
 * 用户关注项的基础接口
 */
export interface UserInterestItem {
  id: string;
  type: 'project' | 'person' | 'topic' | 'jira' | 'technology' | 'document';
  name: string;
  metadata?: Record<string, any>;
  
  // 行为追踪
  firstSeen: number;          // 首次关注时间
  lastAccessed: number;       // 最后访问时间
  accessCount: number;        // 访问次数
  totalEngagementTime?: number; // 总互动时间（毫秒）
  
  // 用户行为
  userActions: UserAction[];  // 用户对该项的具体行为
  
  // 权重和衰变
  currentWeight: number;      // 当前权重（0-1）
  decayFactor: number;        // 衰变因子
  explicitImportance?: number; // 用户明确设置的重要性（0-1）
}

/**
 * 用户行为记录
 */
export interface UserAction {
  actionType: 'view' | 'edit' | 'create' | 'link' | 'mention' | 'search' | 'favorite';
  timestamp: number;
  context?: string;           // 行为发生的上下文
  weight: number;            // 该行为的权重贡献
  metadata?: Record<string, any>;
}

/**
 * 用户画像主体 - 增强版本，融合显式和隐式数据
 */
export interface UserProfile {
  userId: string;
  createdAt: number;
  lastUpdated: number;
  
  // 核心兴趣点
  interests: {
    projects: UserInterestItem[];
    people: UserInterestItem[];
    topics: UserInterestItem[];
    jiraTickets: UserInterestItem[];
    technologies: UserInterestItem[];
    documents: UserInterestItem[];
  };
  
  // 行为模式
  behaviorPatterns: {
    activeTimeZones: TimeZoneActivity[];     // 活跃时间段
    primaryWorkAreas: string[];              // 主要工作领域
    communicationStyle: CommunicationStyle;  // 沟通风格
    toolUsageFrequency: ToolUsage[];        // 工具使用频率
  };
  
  // 计算得出的偏好
  derivedPreferences: {
    preferredProjectTypes: string[];         // 偏好的项目类型
    keyCollaborators: string[];             // 关键协作者
    expertiseAreas: string[];               // 专业领域
    riskSensitivity: 'high' | 'medium' | 'low'; // 风险敏感度
    updateFrequency: 'realtime' | 'daily' | 'weekly'; // 更新频率偏好
  };
  
  // 统计数据
  statistics: {
    totalInteractions: number;
    averageDailyActivity: number;
    mostActiveDay: string;
    topInteractionTypes: Record<string, number>;
  };

  // 🆕 显式配置数据（来自用户手动输入）
  explicitPreferences?: {
    personalInfo: {
      title: string;
      department: string;
      location: string;
      timezone: string;
    };
    workContext: {
      teamName: string;
      teamMission: string;
      teamMembers: Array<{
        name: string;
        position: string;
        role: string;
        speciality: string;
      }>;
      workingHours: string;
      primaryConcerns: string[];
      businessDomains: string[];
      keyMetrics: string[];
    };
    communicationPreferences: {
      style: string;
      languagePreference: string;
    };
  };

  // 🆕 权重计算配置
  weightCalculation?: {
    explicitWeight: number;     // 显式反馈权重 (0-1)
    implicitWeight: number;     // 隐式反馈权重 (0-1)
    adaptiveMode: 'cold_start' | 'learning' | 'mature';
    lastAdaptation: number;     // 上次自适应调整时间
  };
}

/**
 * 时区活动模式
 */
export interface TimeZoneActivity {
  hour: number;              // 0-23
  dayOfWeek: number;        // 0-6 (Sunday-Saturday)
  activityLevel: number;    // 活动强度（0-1）
}

/**
 * 沟通风格
 */
export interface CommunicationStyle {
  formality: 'formal' | 'semi-formal' | 'casual';
  detailLevel: 'high' | 'medium' | 'low';
  responseSpeed: 'immediate' | 'quick' | 'normal' | 'slow';
  preferredChannels: string[];
}

/**
 * 工具使用情况
 */
export interface ToolUsage {
  toolName: string;
  frequency: number;         // 每天平均使用次数
  lastUsed: number;
  primaryUseCase: string;
}

/**
 * 权重衰变配置
 */
export interface WeightDecayConfig {
  baseDecayRate: number;     // 基础衰变率（每天）
  minWeight: number;         // 最小权重阈值
  maxWeight: number;         // 最大权重值
  
  // 不同行为的权重贡献
  actionWeights: {
    view: number;           // 查看
    edit: number;           // 编辑
    create: number;         // 创建
    link: number;           // 建立关联
    mention: number;        // 提及
    search: number;         // 搜索
    favorite: number;       // 收藏
  };
  
  // 衰变调节因子
  decayModifiers: {
    explicitImportance: number;    // 用户明确标记的重要性影响
    recentActivity: number;        // 近期活动影响
    consistentEngagement: number;  // 持续互动影响
  };
}

/**
 * 用户画像查询参数
 */
export interface UserProfileQuery {
  userId?: string;
  interestTypes?: Array<UserInterestItem['type']>;
  minWeight?: number;
  timeRange?: {
    start: number;
    end: number;
  };
  sortBy?: 'weight' | 'recency' | 'frequency';
  limit?: number;
}

/**
 * 用户画像更新参数
 */
export interface UserProfileUpdate {
  userId: string;
  action: UserAction;
  targetItem: {
    id: string;
    type: UserInterestItem['type'];
    name: string;
    metadata?: Record<string, any>;
  };
}

/**
 * 用户画像分析结果
 */
export interface UserProfileAnalysis {
  userId: string;
  timestamp: number;
  
  // 当前最关注的内容
  topInterests: {
    projects: string[];
    people: string[];
    topics: string[];
  };
  
  // 预测的兴趣
  predictedInterests: {
    item: string;
    type: UserInterestItem['type'];
    confidence: number;
    reason: string;
  }[];
  
  // 行为洞察
  insights: {
    workingPattern: string;
    collaborationStyle: string;
    focusAreas: string[];
    suggestedContent: string[];
  };
}

/**
 * 保留的独立配置（不直接影响UserProfile，但系统其他地方使用）
 */
export interface IndependentUserConfig {
  // 自定义Prompt设置
  customPrompts: {
    message: {
      enabled: boolean;
      content: string;
      position: string;
    };
    project: {
      enabled: boolean;
      content: string;
      position: string;
    };
  };

  // 分析偏好设置（用于AI分析逻辑）
  analysisPreferences: {
    messageAnalysis: {
      focusAreas: string[];
      ignoredTopics: string[];
      urgencyKeywords: string[];
    };
    projectAnalysis: {
      riskFactors: string[];
      successCriteria: string[];
      reviewCycle: string;
    };
  };

  // 元数据
  lastUpdated: number;
  version: string;
}

/**
 * 权重融合计算器接口
 */
export interface WeightFusionCalculator {
  calculateFusedWeight(
    explicitWeight: number,
    implicitWeight: number,
    adaptiveMode: 'cold_start' | 'learning' | 'mature',
    userActivityLevel: number
  ): number;
}

/**
 * 默认权重衰变配置
 */
export const DEFAULT_WEIGHT_DECAY_CONFIG: WeightDecayConfig = {
  baseDecayRate: 0.05,      // 每天衰减5%
  minWeight: 0.01,          // 最小权重1%
  maxWeight: 1.0,           // 最大权重100%
  
  actionWeights: {
    view: 0.1,              // 查看贡献10%权重
    edit: 0.3,              // 编辑贡献30%权重
    create: 0.4,            // 创建贡献40%权重
    link: 0.25,             // 关联贡献25%权重
    mention: 0.2,           // 提及贡献20%权重
    search: 0.15,           // 搜索贡献15%权重
    favorite: 0.5           // 收藏贡献50%权重
  },
  
  decayModifiers: {
    explicitImportance: 0.5,     // 明确标记减缓50%衰变
    recentActivity: 0.3,         // 近期活动减缓30%衰变
    consistentEngagement: 0.4    // 持续互动减缓40%衰变
  }
};

// ========================================
// 向量化用户画像存储类型定义
// 用于支持分散式向量存储和相似性查询
// ========================================

/**
 * 用户画像记录的基础接口（向量化存储）
 */
export interface UserProfileRecord {
  id: string;                    // 唯一标识符
  document: string;              // 可搜索的文本内容
  embedding?: number[];          // 向量表示（由系统生成）
  metadata: UserProfileRecordMetadata;
}

/**
 * 用户画像记录的元数据基础接口
 */
export interface UserProfileRecordMetadata {
  record_type: 'interest_item' | 'behavior_pattern' | 'social_relationship' | 'expertise_area' | 'user_summary';
  user_id: string;
  created_at: number;
  updated_at: number;
  last_accessed?: number;
  confidence_score?: number;     // 数据置信度 (0-1)
}

/**
 * 兴趣项记录
 */
export interface InterestItemRecord extends UserProfileRecord {
  metadata: InterestItemMetadata;
}

export interface InterestItemMetadata extends UserProfileRecordMetadata {
  record_type: 'interest_item';
  interest_category: 'project' | 'person' | 'topic' | 'technology' | 'document' | 'jira';
  
  // 核心兴趣数据
  name: string;
  current_weight: number;        // 当前权重 (0-1)
  access_count: number;          // 访问次数
  first_seen: number;            // 首次发现时间
  total_engagement_time?: number; // 总参与时间（毫秒）
  explicit_importance?: number;   // 用户明确标记的重要性 (0-1)
  
  // 分类特定数据
  project_type?: string;         // 项目类型
  person_role?: string;          // 人员角色
  technology_stack?: string[];   // 技术栈
  topic_keywords?: string[];     // 话题关键词
  
  // 行为数据简化版本
  recent_action_types: string[]; // 最近的行为类型
  interaction_patterns: {
    view_frequency: number;      // 查看频率
    edit_frequency: number;      // 编辑频率  
    share_frequency: number;     // 分享频率
  };
  
  // 趋势数据
  trend?: 'increasing' | 'decreasing' | 'stable';
}

/**
 * 行为模式记录
 */
export interface BehaviorPatternRecord extends UserProfileRecord {
  metadata: BehaviorPatternMetadata;
}

export interface BehaviorPatternMetadata extends UserProfileRecordMetadata {
  record_type: 'behavior_pattern';
  pattern_type: 'time_preference' | 'communication_style' | 'tool_usage' | 'work_pattern';
  
  // 时间偏好数据
  active_hours?: number[];       // 活跃时间段
  preferred_days?: number[];     // 偏好工作日
  timezone?: string;             // 时区
  
  // 沟通风格数据
  formality_level?: 'casual' | 'semi-formal' | 'formal';
  response_speed?: 'immediate' | 'quick' | 'normal' | 'slow';
  communication_channels?: string[]; // 偏好的沟通渠道
  
  // 工具使用数据
  primary_tools?: Array<{
    name: string;
    frequency: number;
    last_used: number;
  }>;
  
  // 工作模式数据
  focus_periods?: Array<{
    start_hour: number;
    end_hour: number;
    productivity_score: number;
  }>;
}

/**
 * 社交关系记录
 */
export interface SocialRelationshipRecord extends UserProfileRecord {
  metadata: SocialRelationshipMetadata;
}

export interface SocialRelationshipMetadata extends UserProfileRecordMetadata {
  record_type: 'social_relationship';
  
  target_person: string;         // 关系目标人员
  relationship_type: 'colleague' | 'manager' | 'subordinate' | 'collaborator' | 'mentor' | 'mentee';
  interaction_strength: number;  // 互动强度 (0-1)
  communication_frequency: number; // 沟通频率
  collaboration_contexts: string[]; // 合作场景
  
  last_interaction: number;      // 最后互动时间
  interaction_quality_score: number; // 互动质量评分 (0-1)
}

/**
 * 专业领域记录
 */
export interface ExpertiseAreaRecord extends UserProfileRecord {
  metadata: ExpertiseAreaMetadata;
}

export interface ExpertiseAreaMetadata extends UserProfileRecordMetadata {
  record_type: 'expertise_area';
  
  expertise_domain: string;      // 专业领域
  proficiency_level: number;     // 熟练程度 (0-1)
  evidence_sources: string[];    // 证据来源
  
  skill_keywords: string[];      // 技能关键词
  learning_trajectory: Array<{   // 学习轨迹
    timestamp: number;
    skill: string;
    level_change: number;
  }>;
  
  teaching_ability: number;      // 教学能力评分 (0-1)
  mentoring_history: string[];   // 指导历史
}

/**
 * 用户摘要记录
 */
export interface UserSummaryRecord extends UserProfileRecord {
  metadata: UserSummaryMetadata;
}

export interface UserSummaryMetadata extends UserProfileRecordMetadata {
  record_type: 'user_summary';
  summary_type: 'derived_preferences' | 'statistics' | 'user_context_config';
  
  // 统计数据
  total_interactions?: number;
  daily_activity_average?: number;
  most_active_day?: string;
  top_interaction_types?: Record<string, number>;
  last_activity?: number;
  
  // 衍生偏好
  preferred_project_types?: string[];
  expertise_areas?: string[];
  key_collaborators?: string[];
  risk_sensitivity?: 'low' | 'medium' | 'high';
  update_frequency?: 'daily' | 'weekly' | 'monthly';
  
  // 用户上下文配置
  user_context_config?: any;
}

/**
 * 向量化查询选项
 */
export interface UserProfileQueryOptions {
  user_id?: string;
  record_types?: string[];
  metadata_filters?: Record<string, any>;
  limit?: number;
  similarity_threshold?: number;
  include_embeddings?: boolean;
}

/**
 * 向量化查询结果
 */
export interface UserProfileQueryResult {
  records: UserProfileRecord[];
  total_count: number;
  query_time_ms: number;
  similarity_scores?: number[];
}

/**
 * 用户相似度结果
 */
export interface UserSimilarityResult {
  user_id: string;
  similarity_score: number;
  matching_categories: Array<{
    category: string;
    similarity: number;
    matching_items: string[];
  }>;
}

/**
 * 向量存储统计信息
 */
export interface VectorStorageStats {
  total_records: number;
  records_by_user: Record<string, number>;
  records_by_type: Record<string, number>;
  storage_size_mb: number;
  last_maintenance: number;
  health_score: number;
};
