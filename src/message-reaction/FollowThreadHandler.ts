/**
 * 关注后续功能核心处理器
 */

import {
  FollowThreadMatch,
  MessageBasicInfo,
  MessageInfo,
  RelatedMessageMeta,
  StoreData
} from '../types/followThread';
import { TopicItemWithAutoReply } from './AutoReplyHandler';
import { getMemoryServiceClient } from '../services/MemoryServiceClient';
import { digestQueueService } from '../services/DigestQueueService';
import { DigestQueueItem, DigestProcessor, DigestNotifyConfig } from '../types/digestQueue';
import { concernedItemsSyncService } from '../services/ConcernedItemsSyncService';
// 注：通知逻辑已移至 NotificationService，此文件只处理数据更新

// 语义匹配相似度阈值
const SEMANTIC_SIMILARITY_THRESHOLD = 0.7;

// 语义匹配缓存（1小时过期）
const semanticCache = new Map<string, { result: boolean; timestamp: number }>();
const CACHE_DURATION = 60 * 60 * 1000; // 1小时

/**
 * 检测新消息与关注项的关联关系
 */
export async function checkFollowThreadRelation(
  message: MessageBasicInfo,
  followItems: TopicItemWithAutoReply[]
): Promise<FollowThreadMatch[]> {
  const matches: FollowThreadMatch[] = [];

  for (const item of followItems) {
    if (!item.followConfig) continue;

    const config = item.followConfig;
    const originalMsg = config.originalMessage;

    // 检查是否在同一群组
    const isSameTeam = String(message.teamId) === String(originalMsg.teamId);
    if (!isSameTeam) {
      continue; // 不在同一群组，跳过
    }

    // 1. 🆕 parentId 匹配：回复消息的 parentId === 原消息的 postId
    // 这是最准确的线程回复判断方式
    const messageParentId = message.parentId || message.threadId;
    if (messageParentId && String(messageParentId) === String(originalMsg.postId)) {
      console.log(`✅ 关注后续匹配成功 [parentId]: ${message.postId} -> ${originalMsg.postId}`);
      matches.push({
        followItemId: item.id,
        followConfig: config,
        relationType: 'thread_reply'
      });
      continue;
    }

    // 2. 线程匹配（兼容旧逻辑）：thread_id 相同
    if (message.threadId && originalMsg.threadId && message.threadId === originalMsg.threadId) {
      matches.push({
        followItemId: item.id,
        followConfig: config,
        relationType: 'thread_reply'
      });
      continue;
    }

    // 3. @提及匹配：提到原消息发送者
    if (message.messageContent.includes(`@${originalMsg.sender}`)) {
      matches.push({
        followItemId: item.id,
        followConfig: config,
        relationType: 'mention'
      });
      continue;
    }

    // 4. 引用匹配：包含原消息内容片段（至少20个字符）
    const quotedText = originalMsg.content.substring(0, 100);
    if (quotedText.length >= 20 && message.messageContent.includes(quotedText.substring(0, 50))) {
      matches.push({
        followItemId: item.id,
        followConfig: config,
        relationType: 'quote'
      });
      continue;
    }

    // 5. 关键词过滤（如果配置了）
    if (config.keywordFilter && config.keywordFilter.length > 0) {
      const hasKeyword = config.keywordFilter.some(keyword =>
        message.messageContent.toLowerCase().includes(keyword.toLowerCase())
      );
      if (!hasKeyword) {
        continue; // 不满足关键词过滤，跳过
      }
    }

    // 6. 语义匹配：使用 ChromaDB 向量相似度
    const similarity = await checkSemanticSimilarity(
      item.id,
      message.postId,
      message.messageContent,
      originalMsg.content
    );

    if (similarity >= SEMANTIC_SIMILARITY_THRESHOLD) {
      matches.push({
        followItemId: item.id,
        followConfig: config,
        relationType: 'semantic',
        similarity
      });
    }
  }

  return matches;
}

/**
 * 检查语义相似度（使用 Memory Service recall API）
 */
async function checkSemanticSimilarity(
  followItemId: string,
  messagePostId: string,
  messageContent: string,
  _originalContent: string
): Promise<number> {
  // 检查缓存
  const cacheKey = `${followItemId}_${messagePostId}`;
  const cached = semanticCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.result ? 1.0 : 0.0;
  }

  try {
    const client = getMemoryServiceClient();

    // Use the recall API to find similar messages via vector search
    const recallResult = await client.recall(messageContent, {
      topK: 1,
      channels: ['vector']
    });

    let similarity = 0;
    if (recallResult && recallResult.items && recallResult.items.length > 0) {
      // The recall API returns a score (higher = more similar)
      similarity = recallResult.items[0].score;
    }

    // 缓存结果
    semanticCache.set(cacheKey, {
      result: similarity >= SEMANTIC_SIMILARITY_THRESHOLD,
      timestamp: Date.now()
    });

    return similarity;
  } catch (error) {
    console.error('❌ 语义相似度检测失败:', error);
    return 0;
  }
}

/**
 * 处理关注后续数据更新
 * 注：通知推送已移至 messageDealing.ts 中统一使用 NotificationService 处理
 * 此函数仅用于更新关联消息记录和存储到 Memory Service
 */
export async function handleFollowThreadNotifications(
  matches: FollowThreadMatch[],
  message: MessageInfo
): Promise<void> {
  for (const match of matches) {
    const config = match.followConfig;

    // 更新关联消息记录
    const relatedMsg: RelatedMessageMeta = {
      postId: message.postId,
      sender: message.sender,
      datetime: message.datetime,
      relationType: match.relationType,
      notifiedAt: new Date().toISOString(),
      summary: message.summary
    };

    await updateRelatedMessages(match.followItemId, relatedMsg);

    // 存储关联消息到 ChromaDB
    await storeRelatedMessage({
      followItemId: match.followItemId,
      message: {
        postId: message.postId,
        teamId: config.originalMessage.teamId,
        sender: message.sender,
        content: message.messageContent,
        datetime: message.datetime
      },
      isOriginal: false,
      relationType: match.relationType
    });

    await concernedItemsSyncService.enqueueFollowThreadHit({
      followItemId: match.followItemId,
      postId: message.postId,
      sender: message.sender,
      datetime: message.datetime,
      relationType: match.relationType,
      summary: message.summary,
      teamId: config.originalMessage.teamId,
    });

    // 处理合并通知队列（如果是 merged 频率）
    const notifyFrequency = match.notifyFrequency || 'immediate';
    if (notifyFrequency !== 'immediate') {
      await queueMergedNotification(match.followItemId, message, match.relationType);
    }
    
    // 更新最后通知时间
    config.lastNotifiedAt = new Date().toISOString();
  }
}

/**
 * 将消息加入合并通知队列（通过 DigestQueueService）
 */
async function queueMergedNotification(
  followItemId: string,
  message: MessageInfo,
  relationType: string
): Promise<void> {
  try {
    await digestQueueService.enqueue(FOLLOW_THREAD_DIGEST_TASK_ID, {
      id: `${followItemId}_${message.postId}_${Date.now()}`,
      data: {
        followItemId,
        message,
        relationType
      },
      createdAt: new Date().toISOString(),
      sourceId: followItemId
    });
  } catch (error) {
    console.error('❌ 加入合并通知队列失败:', error);
  }
}

// ==================== Digest 处理器 ====================

/** 关注后续合并通知的任务 ID */
export const FOLLOW_THREAD_DIGEST_TASK_ID = 'follow_thread_merged';

/**
 * 关注后续合并通知处理器
 * 实现 DigestProcessor 接口，负责收集、格式化和推送合并通知
 */
export class FollowThreadDigestProcessor implements DigestProcessor {
  async collect(items: DigestQueueItem[]): Promise<DigestQueueItem[]> {
    // 直接返回所有条目，不做额外过滤
    return items;
  }

  async format(items: DigestQueueItem[]): Promise<string> {
    if (items.length === 0) return '';

    // 按 followItemId 分组
    const grouped: Record<string, Array<{ message: MessageInfo; relationType: string }>> = {};
    for (const item of items) {
      const { followItemId, message, relationType } = item.data;
      if (!grouped[followItemId]) {
        grouped[followItemId] = [];
      }
      grouped[followItemId].push({ message, relationType });
    }

    // 加载关注项配置用于展示原消息信息
    const { concernedItems = [] } = await chrome.storage.local.get('concernedItems');

    const sections: string[] = [];

    for (const [followItemId, messages] of Object.entries(grouped)) {
      const item: TopicItemWithAutoReply | undefined = concernedItems.find(
        (i: TopicItemWithAutoReply) => i.id === followItemId
      );
      const originalMsg = item?.followConfig?.originalMessage;

      // 统计关系类型
      const relationStats = messages.reduce((acc, m) => {
        acc[m.relationType] = (acc[m.relationType] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const relationSummary = Object.entries(relationStats)
        .map(([type, count]) => {
          const typeText: Record<string, string> = {
            thread_reply: '线程回复',
            mention: '提及',
            quote: '引用',
            semantic: '相关讨论'
          };
          return `${typeText[type] || '后续回复'} ${count}条`;
        })
        .join('、');

      const latestMsg = messages[messages.length - 1].message;
      
      let section = `**关注话题**: ${item?.text || followItemId}\n`;
      if (originalMsg) {
        section += `**原消息**: ${originalMsg.sender}: ${originalMsg.content.substring(0, 80)}...\n`;
      }
      section += `**新增 ${messages.length} 条后续** (${relationSummary})\n`;
      section += `**最新**: ${latestMsg.sender}: ${latestMsg.messageContent?.substring(0, 100) || latestMsg.summary || ''}`;

      sections.push(section);
    }

    return `📌 **关注后续汇总** (${items.length} 条新消息)\n\n${sections.join('\n\n---\n\n')}`;
  }

  getNotifyConfig(): DigestNotifyConfig {
    return {
      notifyMethod: 'bot',
      mention: false,
      pushScenario: 'follow_up'
    };
  }
}

/**
 * 注册关注后续合并通知任务到 DigestQueueService
 * 应在扩展启动时调用
 */
export function registerFollowThreadDigestTask(): void {
  digestQueueService.register({
    id: FOLLOW_THREAD_DIGEST_TASK_ID,
    name: '关注后续合并通知',
    frequency: { type: 'hourly' },
    processor: new FollowThreadDigestProcessor(),
    enabled: true
  });
}

/**
 * 更新关注项的关联消息记录
 */
export async function updateRelatedMessages(
  itemId: string,
  relatedMsg: RelatedMessageMeta
): Promise<void> {
  try {
    const result = await chrome.storage.local.get('concernedItems');
    const concernedItems: TopicItemWithAutoReply[] = result.concernedItems || [];

    const item = concernedItems.find(i => i.id === itemId);
    if (item && item.followConfig) {
      if (!item.followConfig.relatedMessages) {
        item.followConfig.relatedMessages = [];
      }

      // 避免重复添加
      const exists = item.followConfig.relatedMessages.some(msg => msg.postId === relatedMsg.postId);
      if (!exists) {
        item.followConfig.relatedMessages.push(relatedMsg);
        item.followConfig.lastCheckedAt = new Date().toISOString();

        await chrome.storage.local.set({ concernedItems });
      }
    }
  } catch (error) {
    console.error('❌ 更新关联消息记录失败:', error);
  }
}

/**
 * 存储关联消息到 Memory Service
 */
export async function storeRelatedMessage(data: StoreData): Promise<void> {
  try {
    const client = getMemoryServiceClient();

    await client.ingest({
      content: data.message.content,
      sourceType: 'glip',
      sender: data.message.sender,
      groupId: data.message.teamId,
      timestamp: new Date(data.message.datetime).getTime(),
      metadata: {
        followItemId: data.followItemId,
        postId: data.message.postId,
        teamId: data.message.teamId,
        relationType: data.relationType || 'original',
        isOriginal: data.isOriginal,
        type: 'followed_thread_message'
      }
    });

    const documentId = `followItem_${data.followItemId}_${data.message.postId}`;
    console.log(`✅ 关联消息已存储: ${documentId}`);
  } catch (error) {
    console.error('❌ 存储关联消息到 Memory Service 失败:', error);
  }
}

/**
 * 清理过期的关注项
 * Note: With the new Memory Service backend, ingested data cleanup is managed
 * by the backend's ForgettingEngine. This function now only cleans up the local
 * chrome.storage entries for expired follow-thread items.
 */
export async function cleanupExpiredFollowThreads(): Promise<void> {
  try {
    console.log('🧹 开始清理过期的关注后续项...');

    const result = await chrome.storage.local.get('concernedItems');
    const concernedItems: TopicItemWithAutoReply[] = result.concernedItems || [];

    const now = Date.now();
    const expiredItems: string[] = [];

    // 1. 筛选出过期的项
    const activeItems = concernedItems.filter(item => {
      if (!item.followConfig) return true;

      // 🆕 使用外层 expiredAt（时间戳）
      if (item.expiredAt && item.expiredAt < now) {
        expiredItems.push(item.id);
        return false;
      }
      return true;
    });

    // 2. 更新 chrome.storage（后端 Memory Service 自动管理过期数据清理）
    if (expiredItems.length > 0) {
      await chrome.storage.local.set({ concernedItems: activeItems });
      console.log(`✅ 已清理 ${expiredItems.length} 个过期的关注后续项`);
    } else {
      console.log('✅ 没有过期的关注后续项');
    }
  } catch (error) {
    console.error('❌ 清理过期关注项失败:', error);
  }
}

/**
 * 获取下一次清理时间（明天凌晨2点）
 */
export function getNextCleanupTime(): number {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(2, 0, 0, 0);
  return tomorrow.getTime();
}
