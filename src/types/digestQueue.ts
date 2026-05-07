/**
 * DigestQueueService 类型定义
 * 
 * 通用定时汇总推送队列服务的类型系统。
 * 支持多种场景：关注后续合并通知、concernedItems 每日摘要、Jira 周报等。
 */

import type { BotPushScenario } from '../utils';

// ==================== 频率配置 ====================

/**
 * 推送频率配置
 * - hourly: 每小时推送
 * - daily: 每天指定小时推送
 * - weekly: 每周指定星期和小时推送
 * - custom: 自定义间隔（分钟）
 */
export type DigestFrequency =
  | { type: 'hourly' }
  | { type: 'daily'; hour: number }           // hour: 0-23
  | { type: 'weekly'; dayOfWeek: number; hour: number }  // dayOfWeek: 0(Sun)-6(Sat)
  | { type: 'custom'; intervalMinutes: number };

/**
 * 每条关注项自己的摘要配置
 */
export interface DigestConfig {
  /** 是否启用摘要 */
  enabled: boolean;
  /** 推送频率 */
  frequency: 'daily' | 'weekly';
  /** 推送小时（24小时制），默认 8 */
  preferredHour?: number;
  /** 每周推送日：0=周日, 1=周一, ... 6=周六；默认周一 */
  preferredDayOfWeek?: number;
}

// ==================== 队列数据 ====================

/**
 * 队列中的单个条目
 */
export interface DigestQueueItem {
  /** 条目唯一 ID */
  id: string;
  /** 业务数据（由各处理器定义结构） */
  data: Record<string, any>;
  /** 入队时间 ISO string */
  createdAt: string;
  /** 来源标识（如 followItemId、concernedItemId） */
  sourceId?: string;
}

/**
 * 存储在 chrome.storage 中的单个任务队列
 */
export interface DigestQueueBucket {
  /** 所属任务 ID */
  taskId: string;
  /** 待处理条目 */
  items: DigestQueueItem[];
  /** 上次处理时间 ISO string */
  lastProcessedAt?: string;
}

/**
 * chrome.storage 中 digestQueues 的完整数据结构
 * key = taskId, value = DigestQueueBucket
 */
export type DigestQueuesStorage = Record<string, DigestQueueBucket>;

// ==================== 处理器接口 ====================

/**
 * Digest 处理器接口
 * 各场景需要实现此接口来定义自己的数据收集、格式化和通知逻辑
 */
export interface DigestProcessor {
  /**
   * 收集/过滤待推送数据
   * 可在此步骤做额外的数据聚合或过滤
   * @param items 队列中的原始条目
   * @returns 经过处理后的条目
   */
  collect(items: DigestQueueItem[]): Promise<DigestQueueItem[]>;

  /**
   * 将条目格式化为推送消息文本
   * @param items 经过 collect 处理的条目
   * @returns 格式化后的消息字符串
   */
  format(items: DigestQueueItem[]): Promise<string>;

  /**
   * 获取该处理器的通知配置
   * @returns notifyMethod 如 'bot,chrome'，mention 是否 @用户
   */
  getNotifyConfig(): DigestNotifyConfig;
}

/**
 * 处理器的通知配置
 */
export interface DigestNotifyConfig {
  /** 通知方法，逗号分隔如 'bot,chrome' */
  notifyMethod: string;
  /** 是否 @用户 */
  mention?: boolean;
  /** Bot 推送场景，用于选择独立的推送目标 */
  pushScenario?: BotPushScenario;
}

// ==================== 任务注册 ====================

/**
 * 注册到 DigestQueueService 的任务定义
 */
export interface DigestTaskRegistration {
  /** 任务唯一 ID，如 'follow_thread_merged' */
  id: string;
  /** 任务显示名称 */
  name: string;
  /** 推送频率 */
  frequency: DigestFrequency;
  /** 数据处理器实例 */
  processor: DigestProcessor;
  /** 是否启用 */
  enabled: boolean;
  /** 上次执行时间 ISO string */
  lastExecutedAt?: string;
}

// ==================== 执行结果 ====================

/**
 * 单个 Digest 任务的处理结果
 */
export interface DigestProcessResult {
  /** 任务 ID */
  taskId: string;
  /** 是否成功 */
  success: boolean;
  /** 处理的条目数 */
  itemsProcessed: number;
  /** 错误信息（如有） */
  error?: string;
}

// ==================== ConcernedItems 扩展 ====================

// DigestConfig 挂载在 TopicItemWithAutoReply 上，由具体处理器解释。
