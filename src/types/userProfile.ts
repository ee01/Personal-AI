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
 * 用户画像主体
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
