/**
 * 关注后续功能的类型定义
 */

export interface FollowThreadConfig {
  originalMessage: {
    postId: string;
    threadId?: string;
    teamId: string;
    teamName: string;
    sender: string;
    content: string;
    datetime: string | number;  // 支持字符串和时间戳格式
    messageUrl: string;
  };
  createdAt: string;
  // 🆕 移除 expiresAt，直接使用 concernedItem.expiredAt
  // 🆕 移除 notifyMethod/notifyFrequency，移到 concernedItem 外层（通用配置）
  keywordFilter?: string[];
  relatedMessages: RelatedMessageMeta[];
  lastCheckedAt?: string;
  lastNotifiedAt?: string;
}

// 通用通知配置（适用于所有 concernedItem 类型）
// NotifyMethod 使用逗号分隔的字符串格式，如 'bot,chrome'
export type NotifyMethod = string;
export type NotifyFrequency = 'immediate' | 'merged';

export interface RelatedMessageMeta {
  postId: string;
  sender: string;
  datetime: string;
  relationType: 'thread_reply' | 'mention' | 'quote' | 'semantic' | 'direct_reply' | 'same_thread' | 'semantic_related';
  notifiedAt?: string;
  summary?: string;
}

// TopicItemWithAutoReply 类型统一从 message-reaction/AutoReplyHandler.ts 导出
// 这里不再重复定义，避免类型冲突

export interface FollowedThreadDocument {
  id: string; // followItem_{followItemId}_{postId}
  embedding: number[];
  metadata: {
    followItemId: string;
    postId: string;
    teamId: string;
    sender: string;
    datetime: number;
    relationType: 'original' | 'thread_reply' | 'mention' | 'quote' | 'semantic';
    isOriginal: boolean;
    notifiedAt?: number;
  };
  document: string; // 消息内容
}

export interface FollowThreadMatch {
  followItemId: string;
  followConfig: FollowThreadConfig;
  relationType: 'thread_reply' | 'mention' | 'quote' | 'semantic' | 'direct_reply' | 'same_thread' | 'semantic_related';
  similarity?: number;
  // 🆕 从外层传递的通知配置（notifyMethod 使用逗号分隔格式，如 'bot,chrome'）
  notifyMethod?: string;
  notifyFrequency?: NotifyFrequency;
}

export interface MessageBasicInfo {
  postId: string;
  teamId: string;
  teamName: string;
  sender: string;
  messageContent: string;
  datetime: string;
  threadId?: string;   // 保留兼容（等同于 parentId）
  parentId?: string;   // 父消息 ID，用于关联线程回复
}

export interface MessageInfo {
  postId: string;
  sender: string;
  messageContent: string;
  datetime: string;
  summary?: string;
}

export interface StoreData {
  followItemId: string;
  message: {
    postId: string;
    threadId?: string;
    teamId: string;
    teamName?: string;
    sender: string;
    content: string;
    datetime: string;
    messageUrl?: string;
  };
  isOriginal: boolean;
  relationType?: 'original' | 'thread_reply' | 'mention' | 'quote' | 'semantic' | 'direct_reply' | 'same_thread' | 'semantic_related';
}
