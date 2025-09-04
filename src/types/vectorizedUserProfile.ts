/**
 * 向量化用户画像存储类型定义
 * 用于支持分散式向量存储和相似性查询
 */

import { UserAction, UserInterestItem } from './userProfile';

/**
 * 向量化记录的基础接口
 */
export interface VectorizedRecord {
  id: string;                    // 唯一标识符
  document: string;              // 可搜索的文本内容
  embedding?: number[];          // 向量表示（由系统生成）
  metadata: VectorizedRecordMetadata;
}

/**
 * 向量化记录的元数据基础接口
 */
export interface VectorizedRecordMetadata {
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
export interface InterestItemRecord extends VectorizedRecord {
  metadata: InterestItemMetadata;
}

export interface InterestItemMetadata extends VectorizedRecordMetadata {
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
  jira_priority?: string;        // JIRA优先级
  document_type?: string;        // 文档类型
  
  // 行为统计 (简化版，保留最重要的统计)
  recent_action_types: string[]; // 最近行为类型 ['view', 'edit', 'create']
  interaction_frequency: number; // 交互频率 (次/天)
  trend: 'increasing' | 'stable' | 'decreasing'; // 关注趋势
  
  // 关联数据引用
  related_records?: string[];    // 关联的其他记录ID
}

/**
 * 行为模式记录
 */
export interface BehaviorPatternRecord extends VectorizedRecord {
  metadata: BehaviorPatternMetadata;
}

export interface BehaviorPatternMetadata extends VectorizedRecordMetadata {
  record_type: 'behavior_pattern';
  pattern_type: 'time_preference' | 'communication_style' | 'work_rhythm' | 'tool_usage' | 'interaction_pattern';
  
  // 时间偏好数据
  active_hours?: number[];       // [9, 10, 11, 14, 15]
  peak_productivity_time?: 'morning' | 'afternoon' | 'evening' | 'night';
  work_days_preference?: number[]; // [1,2,3,4,5] 周一到周五
  
  // 沟通风格数据
  formality_level?: 'formal' | 'semi-formal' | 'casual';
  detail_preference?: 'high' | 'medium' | 'low';
  response_speed?: 'immediate' | 'quick' | 'normal' | 'delayed';
  preferred_channels?: string[]; // ['email', 'chat', 'meeting']
  
  // 工具使用数据
  primary_tools?: Array<{
    name: string;
    frequency: number;          // 使用频率
    proficiency: number;        // 熟练度 (0-1)
    last_used: number;
  }>;
  
  // 工作节奏数据
  deep_work_duration?: number;   // 深度工作时长偏好（分钟）
  break_frequency?: number;      // 休息频率（分钟间隔）
  multitasking_preference?: number; // 多任务偏好 (0-1)
  
  // 统计数据
  pattern_confidence: number;    // 模式置信度 (0-1)
  data_points: number;           // 用于生成模式的数据点数量
  pattern_stability: number;     // 模式稳定性 (0-1)
}

/**
 * 社交关系记录
 */
export interface SocialRelationshipRecord extends VectorizedRecord {
  metadata: SocialRelationshipMetadata;
}

export interface SocialRelationshipMetadata extends VectorizedRecordMetadata {
  record_type: 'social_relationship';
  relationship_type: 'collaboration' | 'mentorship' | 'friendship' | 'professional' | 'team_member';
  
  // 核心关系数据
  target_person?: string;        // 关系对象（单一关系）
  relationship_group?: string;   // 关系组（团队/群组关系）
  
  // 协作数据
  interaction_frequency: number; // 交互频率 (次/天)
  collaboration_quality: number; // 协作质量评分 (0-1)
  shared_projects: string[];     // 共同项目
  communication_channels: string[]; // 沟通渠道
  
  // 团队信息
  team_info?: {
    team_name: string;
    role_in_team: string;
    team_size: number;
    collaboration_style: string;
  };
  
  // 关系强度指标
  relationship_strength: number; // 关系强度 (0-1)
  trust_level: number;           // 信任度 (0-1)
  influence_level: number;       // 影响力 (0-1)
  
  // 社交活动
  meeting_frequency: number;     // 会议频率
  informal_interaction: number;  // 非正式交流频率
  knowledge_sharing_events: number; // 知识分享次数
  
  last_interaction: number;
}

/**
 * 专业技能记录
 */
export interface ExpertiseAreaRecord extends VectorizedRecord {
  metadata: ExpertiseAreaMetadata;
}

export interface ExpertiseAreaMetadata extends VectorizedRecordMetadata {
  record_type: 'expertise_area';
  expertise_type: 'technical' | 'domain' | 'soft_skill' | 'industry' | 'methodology';
  
  // 技能详情
  skill_name: string;
  skill_category: string;        // 技能分类
  proficiency_level: number;     // 熟练度 (0-1)
  years_of_experience?: number;
  certification_level?: 'none' | 'basic' | 'intermediate' | 'advanced' | 'expert';
  
  // 技能标签和关联
  skill_tags: string[];          // ["React", "JavaScript", "Frontend", "UI/UX"]
  related_skills: string[];      // 相关技能
  prerequisite_skills?: string[]; // 前置技能
  
  // 证据数据
  evidence_sources: Array<{
    type: 'project' | 'discussion' | 'document' | 'code_review' | 'mentoring' | 'presentation';
    source_id: string;
    relevance_score: number;     // 相关性分数 (0-1)
    evidence_date: number;
  }>;
  
  // 技能发展
  skill_growth_trend: 'rapid_growth' | 'steady_growth' | 'stable' | 'declining' | 'dormant';
  recent_usage_frequency: number; // 最近使用频率
  learning_activity: number;     // 学习活跃度 (0-1)
  teaching_activity?: number;    // 教学/指导活跃度 (0-1)
  
  // 市场相关性
  market_demand?: number;        // 市场需求度 (0-1)
  industry_relevance?: number;   // 行业相关性 (0-1)
  
  confidence_score: number;      // 技能评估置信度 (0-1)
  last_evidence_update: number;
}

/**
 * 用户概要记录（聚合信息）
 */
export interface UserSummaryRecord extends VectorizedRecord {
  metadata: UserSummaryMetadata;
}

export interface UserSummaryMetadata extends VectorizedRecordMetadata {
  record_type: 'user_summary';
  summary_type: 'overall' | 'interests' | 'behavior' | 'social' | 'expertise';
  
  // 概要数据
  total_records: number;         // 关联记录总数
  summary_period: {              // 概要时间范围
    start: number;
    end: number;
  };
  
  // 权重分布
  weight_distribution: {
    high_weight_items: number;   // 高权重项目数量 (>0.7)
    medium_weight_items: number; // 中权重项目数量 (0.3-0.7)
    low_weight_items: number;    // 低权重项目数量 (<0.3)
  };
  
  // 活跃度指标
  activity_metrics: {
    daily_average_interactions: number;
    peak_activity_hours: number[];
    most_active_categories: string[];
  };
  
  // 成长趋势
  growth_trends: {
    new_interests_per_month: number;
    skill_development_rate: number;
    social_network_growth: number;
  };
  
  auto_generated: boolean;       // 是否为自动生成的概要
  generation_algorithm: string;  // 生成算法版本
}

/**
 * 向量化查询选项
 */
export interface VectorizedQueryOptions {
  record_types?: Array<VectorizedRecordMetadata['record_type']>;
  user_id?: string;
  limit?: number;
  similarity_threshold?: number;  // 相似度阈值 (0-1)
  time_range?: {
    start: number;
    end: number;
  };
  metadata_filters?: Record<string, any>; // 元数据过滤条件
  include_embeddings?: boolean;   // 是否返回向量数据
  sort_by?: 'similarity' | 'weight' | 'recency' | 'frequency';
  sort_order?: 'asc' | 'desc';
}

/**
 * 向量化查询结果
 */
export interface VectorizedQueryResult {
  records: VectorizedRecord[];
  total_count: number;
  query_metadata: {
    query_time: number;
    similarity_scores?: number[];
    processing_time_ms: number;
  };
}

/**
 * 用户相似性查询结果
 */
export interface UserSimilarityResult {
  user_id: string;
  similarity_score: number;
  matching_categories: Array<{
    category: string;
    similarity: number;
    matching_items: string[];
  }>;
  total_matches: number;
}

/**
 * 向量数据维护配置
 */
export interface VectorMaintenanceConfig {
  // 数据清理配置
  cleanup_thresholds: {
    min_weight: number;          // 最小权重阈值
    max_age_days: number;        // 最大保留天数
    min_access_count: number;    // 最小访问次数
  };
  
  // 聚合配置
  aggregation_rules: {
    enable_auto_summary: boolean;
    summary_frequency_days: number;
    max_records_per_user: number;
  };
  
  // 向量更新配置
  vector_update: {
    enable_batch_update: boolean;
    batch_size: number;
    update_frequency_hours: number;
  };
}

/**
 * 向量化存储统计信息
 */
export interface VectorStorageStats {
  total_records: number;
  records_by_type: Record<string, number>;
  records_by_user: Record<string, number>;
  storage_size_mb: number;
  last_maintenance: number;
  health_score: number;         // 存储健康度 (0-1)
}
