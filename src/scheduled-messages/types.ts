/**
 * 定时消息类型定义
 */

// 消息类型
export type MessageType = 'Daily' | 'Hourly' | 'Periodic';

// 推送方式
export type PushMethod = 'Email' | 'Bot_API' | 'Both';

// 消息状态
export type MessageStatus = 'Active' | 'Paused' | 'Completed';

// 重复周期单位
export type RepeatUnit = 'Day' | 'Week' | 'Month' | 'Year';

// 定时消息接口
export interface ScheduledMessage {
  ID: string;
  Type: MessageType;
  Topic: string;
  Content: string;
  Schedule_Date: string;  // YYYY-MM-DD
  Schedule_Time: string;  // HH:mm
  End_Date?: string;      // YYYY-MM-DD
  Repeat_Every?: number;  // 重复间隔数字
  Repeat_Unit?: RepeatUnit; // 重复单位
  Repeat_Count?: number;  // 重复次数，留空表示无限
  Push_Method: PushMethod;
  Glip_User_Name?: string;
  Glip_Team_ID?: string;
  Bot_Endpoint?: string;
  Attachment?: string;
  Owner: string;
  Status: MessageStatus;
  Last_Exec?: string;     // YYYY-MM-DD HH:mm
  Next_Exec?: string;     // YYYY-MM-DD HH:mm
  Exec_Count?: number;
  Exec_Log?: string;
}

// 创建消息的表单数据
export interface CreateMessageFormData {
  Type: MessageType;
  Topic: string;
  Content: string;
  Schedule_Date: string;
  Schedule_Time: string;
  End_Date?: string;
  Repeat_Every?: number;
  Repeat_Unit?: RepeatUnit;
  Repeat_Count?: number;
  Push_Method: PushMethod;
  Glip_User_Name?: string;
  Glip_Team_ID?: string;
  Bot_Endpoint?: string;
  Attachment?: string;
}

// Sheet 配置接口
export interface SheetConfig {
  sheetId: string;
  sheetUrl: string;
  scriptId?: string;
  webAppUrl?: string;
  minute_trigger_id?: string;
  daily_trigger_id?: string;
  jira_executor_rule_id?: string;
  sheet_version: string;
  created_by: string;
  created_at: string;
  last_sync_time?: string;
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
  executedToday: number;
}


