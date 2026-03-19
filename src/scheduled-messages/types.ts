/**
 * 定时消息类型定义
 */

import type { TimelineProject } from './timelineProjects';

// 消息类型（用于内部判断，不在 Sheet 中存储）
export type MessageType = 'Daily' | 'Hourly' | 'Periodic';

// 推送方式
export type PushMethod = 'AsMe' | 'Bot' | 'AI' | 'JiraAutomation';

// 消息状态
// PendingReview: 待审核状态，用于自动答复的审核模式，需手动确认后才会执行
export type MessageStatus = 'Active' | 'Paused' | 'Completed' | 'Done' | 'PendingReview';

// 重复周期单位
export type RepeatUnit = 'Day' | 'Week' | 'Month' | 'Year';

// 推送目标类型
export type TargetType = 'private' | 'group' | 'api';

// Timeline Milestone 类型
export type TimelineMilestone = 'DoR' | 'Embedded' | 'FF' | 'Regression' | 'CF' | 'Release';

// 推送日志状态
export type PushLogStatus = 'Success' | 'Failed';

// 推送日志接口
export interface PushLog {
  Timestamp: string;      // YYYY-MM-DD HH:mm:ss
  Message_ID: string;
  Topic: string;
  Content: string;
  Push_Method: PushMethod;
  Target: string;         // 目标用户/团队/API
  Status: PushLogStatus;
  Error: string;          // 错误信息（如果有）
  Exec_Count: number;     // 第几次执行
}

// 定时消息接口
export interface ScheduledMessage {
  ID: string;
  Type?: MessageType;  // 可选，由程序自动计算
  Topic: string;
  Content: string;
  Schedule_Date?: string;  // YYYY-MM-DD，Timeline 触发时可为空
  Schedule_Time?: string;  // HH:mm
  End_Date?: string;      // YYYY-MM-DD
  Repeat_Every?: number;  // 重复间隔数字
  Repeat_Unit?: RepeatUnit; // 重复单位
  Repeat_Count?: number;  // 重复次数，留空表示无限
  Repeat_Days?: string;   // 多选日期，逗号分隔的数字（周：0=周日,1=周一...6=周六；月：1-31）
  Push_Method: PushMethod;
  Glip_User_Name?: string;
  Glip_Team_ID?: string;
  Attachment?: string;
  Target_Type?: TargetType;
  // AI Report 字段
  AI_Endpoint?: string;    // "POST url" 或 "GET url" 或 "url"
  AI_Headers?: string;     // "key: value\nkey2: value2"
  AI_Body?: string;        // JSON 字符串，支持 {Topic} 和 {Content} 变量
  // Timeline 触发字段
  Timeline_Project?: TimelineProject;  // 项目名称
  Timeline_Milestone?: TimelineMilestone;  // Milestone 名称
  Timeline_Offset?: number;  // 偏移天数（负数=之前，0=当天，正数=之后）
  Status: MessageStatus;
  Last_Exec?: string;     // YYYY-MM-DD HH:mm
  Next_Exec?: string;     // YYYY-MM-DD HH:mm
  Exec_Count?: number;
  Exec_Log?: string;
  Category?: string;      // 逗号分隔的标签，如 "工作,提醒,日常"
  Automation_Link?: string;  // Jira Automation Rule 链接
}

// 创建消息的表单数据
export interface CreateMessageFormData {
  Topic: string;
  Content: string;
  Schedule_Date?: string;  // Timeline 触发时可为空
  Schedule_Time?: string;  // 可选：留空则每日早上9点执行
  End_Date?: string;
  Repeat_Every?: number;
  Repeat_Unit?: RepeatUnit;
  Repeat_Count?: number;
  Repeat_Days?: string;   // 多选日期，逗号分隔的数字（周：0=周日,1=周一...6=周六；月：1-31）
  Push_Method: PushMethod;
  Target_Type: TargetType;  // 私发或群组
  Glip_User_Name?: string;  // 支持多个人名，用逗号分隔
  Glip_Team_ID?: string;
  Attachment?: string;
  // AI Report 字段
  AI_Endpoint?: string;
  AI_Headers?: string;
  AI_Body?: string;
  // Timeline 触发字段
  Timeline_Project?: TimelineProject;
  Timeline_Milestone?: TimelineMilestone;
  Timeline_Offset?: number;
  // 分类标签
  Category?: string;  // 逗号分隔的标签，如 "工作,提醒,日常"
  // Jira Automation 链接
  Automation_Link?: string;  // Jira Automation Rule 链接
}

export interface BotAutomationRule {
  ruleId: string;
  ruleName: string;
  webhookUrl: string;
  projectKey: string;
  jiraUrl: string;
  createdAt: string;
  ruleVersion?: string;      // Jira Rule 版本号
  ruleLastUpdated?: string;  // Jira Rule 最后更新时间
}

export interface BotAutomationConfig {
  executorRule?: BotAutomationRule;
  timelineSyncRule?: BotAutomationRule;
}

// Sheet 配置接口
export interface SheetConfig {
  sheetId: string;
  sheetUrl: string;
  messagesSheetId?: number;  // Messages 工作表的 Sheet ID
  logsSheetId?: number;      // Logs 工作表的 Sheet ID
  scriptId?: string;
  webAppUrl?: string;
  deploymentId?: string;     // Web App deployment ID（用于更新部署）
  minute_trigger_id?: string;
  daily_trigger_id?: string;
  jira_executor_rule_id?: string;
  sheet_version: string;
  appScriptVersion?: string; // App Script 版本号
  appScriptLastUpdated?: string; // App Script 最后更新时间
  created_by: string;
  created_at: string;
  last_sync_time?: string;
  // 新版 Bot 配置（双 Jira Automation Rule）
  botAutomation?: BotAutomationConfig;
  // 旧版兼容字段：仅 executor rule
  botExecutor?: BotAutomationRule;
}

// 初始化结果
export interface InitializationResult {
  success: boolean;
  sheetId: string;
  sheetUrl: string;
  scriptId: string;
  webAppUrl: string;
  error?: string;
  needsAuthorization?: boolean;  // 是否需要用户授权
  authUrl?: string;              // 授权 URL
  needsAppScriptAPI?: boolean;   // 是否需要开启 AppScript API
  appScriptAPIUrl?: string;      // AppScript API 设置页面 URL
}

// 筛选选项
export interface FilterOptions {
  type?: MessageType | 'All';
  status?: MessageStatus | 'All';
  pushMethod?: PushMethod | 'All';
  searchText?: string;
}

// 统计信息
export interface Statistics {
  total: number;
  active: number;
  paused: number;
  completed: number;
  done: number;
  pendingReview: number;  // 待审核的自动答复消息数量
  executedToday: number;
}
