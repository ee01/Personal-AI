/**
 * 智能Agent系统接口定义文件
 * 包含所有与分析相关的接口类型
 */

/**
 * 思考步骤接口
 * 记录分析过程中的思考步骤
 */
export interface ThoughtStep {
  /** 步骤时间戳 */
  timestamp: number;
  
  /** 思考内容 */
  thought: string;
  
  /** 执行的行动 */
  action: string;
  
  /** 使用的工具 */
  toolUsed?: string;
  
  /** 工具执行结果 */
  result?: any;
}

/**
 * 基础分析结果接口
 * 所有具体分析结果都继承自此接口
 */
export interface BaseAnalysisResult {
  /** 分析结果的可信度，0-1之间 */
  confidence: number;
  
  /** 分析内容的简短摘要 */
  summary: string;
  
  /** 元数据信息，包含分析过程相关统计信息 */
  metaData?: {
    /** LLM调用次数 */
    llmCallCount: number;
    
    /** LLM调用消耗的tokens数量 */
    llmCallTokens: number;
    
    /** 使用的工具列表 */
    usedTools: string[];
    
    /** 分析结束时间戳 */
    timestamp: number;
    
    /** 其他扩展元数据 */
    [key: string]: any;
  };
  
  /** 其他可选属性 */
  [key: string]: any;
}

/**
 * 消息分析结果接口
 * 用于聊天消息和通知的分析
 */
export interface MessageAnalysisResult extends BaseAnalysisResult {
  /** 标识结果类型为消息分析 */
  type: 'message';
  
  /** 消息是否重要 */
  isImportant: boolean;
  
  /** 是否应该存储该消息 */
  shouldStore: boolean;
  
  /** 是否应该发送通知 */
  shouldNotify: boolean;
  
  /** 存储消息的原因列表 */
  reasonsToStore: string[];
  
  /** 通知优先级 */
  notificationPriority?: 'high' | 'medium' | 'low';
  
  /** 回复建议 */
  replyAdvice?: string;
  
  /** 思考过程记录 */
  thoughtProcess?: ThoughtStep[];

  /** 消息索引 */
  messageIndex: number;
  
  /** 群组索引 */
  groupIndex?: number;
  
  /** 消息上下文信息 */
  messageContext?: {
    /** 群组ID */
    groupId?: string;
    
    /** 群组名称 */
    groupName?: string;
    
    /** 消息内容 */
    messageContent?: string;
    
    /** 发送者 */
    sender?: string;
    
    /** 发送时间 */
    datetime?: string;
  };
  
  /** 提取的实体信息 */
  entities?: {
    people?: Array<{
      name: string;
      role?: string;
      mentioned_context?: string;
    }>;
    time?: Array<{
      raw: string;
      normalized?: string;
      type?: 'deadline' | 'schedule' | 'mentioned';
    }>;
    projects?: Array<{
      name: string;
      status?: string;
      related_people?: string[];
    }>;
    topics?: Array<{
      name: string;
      category?: string;
      keywords?: string[];
    }>;
    [key: string]: any;
  };
  
  /** 实体间关系 */
  relationships?: Array<{
    source: string;
    target: string;
    type: string;
    context?: string;
  }>;
  
  /** 建议的行动项 */
  actions?: Array<{
    type: string;
    description: string;
    priority?: string;
    assignee?: string;
    deadline?: string;
  }>;
  
  /** 情感分析结果 */
  sentiment?: 'positive' | 'negative' | 'neutral';
  
  /** 消息分类 */
  category?: string[];
}

/**
 * 项目分析结果接口
 * 用于项目状态和风险的分析
 */
export interface ProjectAnalysisResult extends BaseAnalysisResult {
  /** 标识结果类型为项目分析 */
  type: 'project';
  
  /** 项目ID */
  projectId: string;
  
  /** 项目名称 */
  projectName: string;
  
  /** 项目风险等级 */
  riskLevel: 'critical' | 'high' | 'normal' | 'low';
  
  /** 里程碑状态 */
  milestones?: Array<{
    name: string;
    status: 'completed' | 'in_progress' | 'at_risk' | 'delayed';
    dueDate?: string;
    completionPercentage?: number;
    owner?: string;
  }>;
  
  /** 项目的关键问题 */
  issues?: Array<{
    id: string;
    title: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    status: 'open' | 'in_progress' | 'resolved';
    owner?: string;
    description?: string;
  }>;
  
  /** 改进建议 */
  suggestions: {
    status?: string;
    statusReason?: string;
    owner?: string;
    ownerReason?: string;
    track?: string;
    highlights?: Array<string>;
    highlightsReason?: string;
    timeline?: string[];
    resources?: string[];
    documentation?: string[];
    risks?: string[];
    actionItems?: string[];
    actionItemsReason?: string;
    followUp?: string[];
  };
  
  /** 项目依赖关系 */
  dependencies?: Array<{
    projectId: string;
    projectName: string;
    status: 'blocked' | 'dependent' | 'independent';
    impactLevel: 'high' | 'medium' | 'low';
  }>;
}

/**
 * 会议分析结果接口
 * 用于会议记录和摘要的分析
 */
export interface MeetingAnalysisResult extends BaseAnalysisResult {
  /** 标识结果类型为会议分析 */
  type: 'meeting';
  
  /** 讨论的主题列表 */
  topics: Array<{
    title: string;
    summary: string;
    duration?: number; // 单位：分钟
    participants?: string[];
    sentiment?: 'positive' | 'negative' | 'neutral';
  }>;
  
  /** 会议中做出的决策 */
  decisions: Array<{
    topic: string;
    decision: string;
    rationale?: string;
    stakeholders?: string[];
  }>;
  
  /** 会议产生的行动项 */
  actionItems: Array<{
    description: string;
    assignee: string;
    dueDate?: string;
    priority?: 'high' | 'medium' | 'low';
    status?: 'pending' | 'in_progress' | 'completed';
  }>;
  
  /** 需要跟进的项目 */
  followups?: Array<{
    topic: string;
    description: string;
    owner?: string;
    deadline?: string;
  }>;
  
  /** 会议效率评估 */
  efficiency?: {
    rating: number; // 1-10分
    issues?: string[];
    improvements?: string[];
  };
}

/**
 * 文档分析结果接口
 * 用于分析文档内容和结构
 */
export interface DocumentAnalysisResult extends BaseAnalysisResult {
  /** 标识结果类型为文档分析 */
  type: 'document';
  
  /** 文档标题 */
  title: string;
  
  /** 文档类型 */
  documentType: 'specification' | 'report' | 'email' | 'contract' | 'other';
  
  /** 主要章节摘要 */
  sections: Array<{
    title: string;
    summary: string;
    importance: 'high' | 'medium' | 'low';
  }>;
  
  /** 关键点列表 */
  keyPoints: string[];
  
  /** 问题和不明确之处 */
  issues?: Array<{
    description: string;
    location?: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
  }>;
  
  /** 相关实体参考 */
  references?: Array<{
    entity: string;
    context: string;
    location: string;
  }>;
}

/**
 * 通用分析结果接口
 * 用于未指定具体类型的通用分析
 */
export interface GenericAnalysisResult extends BaseAnalysisResult {
  /** 标识结果类型为通用分析 */
  type: 'generic';
}

/**
 * 分析结果联合类型
 * 表示所有可能的分析结果类型
 */
export type AnalysisResult = 
  | MessageAnalysisResult
  | ProjectAnalysisResult
  | MeetingAnalysisResult
  | DocumentAnalysisResult
  | GenericAnalysisResult;

/**
 * 分析配置接口
 * 控制分析行为和参数
 */
export interface AnalysisConfig {
  /** 分析类型 */
  type: 'message' | 'project' | 'meeting' | 'document' | 'generic';
  
  /** 分析深度 */
  analysisDepth?: 'quick' | 'normal' | 'deep';
  
  /** 最大行动次数 */
  maxActions?: number;
  
  /** 首选工具列表 */
  preferredTools?: string[];
  
  /** 自定义提示模板 */
  customPrompts?: {
    /** 初始分析提示 */
    analysis?: string;
    
    /** 思考提示 */
    thinking?: string;
    
    /** 总结提示 */
    summary?: string;
  };
  
  /** 额外配置 */
  [key: string]: any;
}

/**
 * 分析上下文接口
 * 提供分析所需的上下文信息
 */
export interface AnalysisContext {
  /** 当前用户 */
  currentUser?: string;
  
  /** 群组信息 */
  groupInfo?: {
    id: string;
    name: string;
    members: string[];
    type?: 'team' | 'department' | 'project';
    index?: number;
  };
  
  /** 关注规则列表 */
  concernedRules?: {text: string}[];
  
  /** 用户偏好 */
  userPreferences?: {
    notificationLevel?: 'all' | 'important' | 'critical';
    storagePreference?: 'all' | 'selected' | 'minimal';
    responseStyle?: 'detailed' | 'concise';
    [key: string]: any;
  };
  
  /** 系统状态 */
  systemState?: {
    availableApps: string[];
    activeProjects: string[];
    recentActivity: Array<{
      type: string;
      timestamp: number;
      summary: string;
    }>;
  };
  
  /** 额外上下文 */
  [key: string]: any;
} 


/* 
 * 项目输入接口
 * 用于分析项目状态和风险
 */
export interface ProjectInput {
  name?: string;
  type?: string;
  project: {
    id: string;
    name: string;
    status: string;
    owner: string;
    [key: string]: any;
  };
  jiraData?: {
    key: string;
    summary: string;
    status: string;
    assignee: string;
    duedate: string;
    [key: string]: any;
  };
}
