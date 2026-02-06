/**
 * 关注后续功能核心处理器
 */

import {
  FollowThreadConfig,
  FollowThreadMatch,
  MessageBasicInfo,
  MessageInfo,
  RelatedMessageMeta,
  StoreData
} from '../types/followThread';
import { TopicItemWithAutoReply } from './AutoReplyHandler';
import { memorySystem } from '../memory';
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
 * 检查语义相似度（使用 ChromaDB）
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
    const cloudStorage = memorySystem.cloudStorage;

    // 使用 LLM 生成嵌入向量
    const embedding = await generateEmbedding(messageContent);

    // 查询 ChromaDB 中原消息的相似度
    // 访问私有属性构建 collection name
    const username = (cloudStorage as any).username || '';
    const collectionName = `${username}-followed_thread_messages`;
    const collection = (cloudStorage as any).collections?.get(collectionName);

    if (!collection) {
      console.warn('❌ followed_thread_messages 集合未初始化');
      return 0;
    }

    const results = await collection.query({
      queryEmbeddings: [embedding],
      nResults: 1,
      where: {
        followItemId: followItemId,
        isOriginal: true
      }
    });

    let similarity = 0;
    if (results.distances && results.distances[0] && results.distances[0][0] !== undefined) {
      // ChromaDB 返回的是距离，需要转换为相似度（cosine距离: similarity = 1 - distance）
      similarity = 1 - results.distances[0][0];
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
 * 生成文本嵌入向量（使用简单的词频统计方法）
 */
async function generateEmbedding(text: string): Promise<number[]> {
  try {
    // 文本预处理：分词和清理
    const words = text
      .toLowerCase()
      .replace(/[^\w\s\u4e00-\u9fff]/g, ' ') // 保留字母、数字、中文
      .split(/\s+/)
      .filter(word => word.length > 1); // 过滤单字符

    const embedding = new Array(384).fill(0); // 384 维向量

    // 使用词频和位置信息生成向量
    words.forEach((word, idx) => {
      // 为每个词生成多个哈希位置（提高区分度）
      for (let i = 0; i < 3; i++) {
        const hash = word.split('').reduce((acc, char) =>
          acc + char.charCodeAt(0) * (i + 1), 0
        );
        const position = hash % 384;
        // 权重：较早出现的词权重更高
        const weight = 1 / Math.sqrt(idx + 1);
        embedding[position] = (embedding[position] || 0) + weight;
      }
    });

    // 归一化
    const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return norm > 0 ? embedding.map(val => val / norm) : embedding;

  } catch (error) {
    console.error('❌ 生成嵌入向量失败:', error);
    // 返回零向量
    return new Array(384).fill(0);
  }
}

/**
 * 处理关注后续数据更新
 * 注：通知推送已移至 messageDealing.ts 中统一使用 NotificationService 处理
 * 此函数仅用于更新关联消息记录和存储到 ChromaDB
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
 * 将消息加入合并通知队列
 */
async function queueMergedNotification(
  followItemId: string,
  message: MessageInfo,
  relationType: string
): Promise<void> {
  try {
    const result = await chrome.storage.local.get('mergedNotificationQueue');
    const queue = result.mergedNotificationQueue || {};

    if (!queue[followItemId]) {
      queue[followItemId] = [];
    }

    queue[followItemId].push({
      message,
      relationType,
      timestamp: Date.now()
    });

    await chrome.storage.local.set({ mergedNotificationQueue: queue });
  } catch (error) {
    console.error('❌ 加入合并通知队列失败:', error);
  }
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
 * 存储关联消息到 ChromaDB
 */
export async function storeRelatedMessage(data: StoreData): Promise<void> {
  try {
    const cloudStorage = memorySystem.cloudStorage;

    // 访问私有属性构建 collection name
    const username = (cloudStorage as any).username || '';
    const collectionName = `${username}-followed_thread_messages`;
    const collection = (cloudStorage as any).collections?.get(collectionName);

    if (!collection) {
      console.warn('❌ followed_thread_messages 集合未初始化');
      return;
    }

    // 生成嵌入向量
    const embedding = await generateEmbedding(data.message.content);

    const documentId = `followItem_${data.followItemId}_${data.message.postId}`;

    await collection.add({
      ids: [documentId],
      embeddings: [embedding],
      documents: [data.message.content],
      metadatas: [{
        followItemId: data.followItemId,
        postId: data.message.postId,
        teamId: data.message.teamId,
        sender: data.message.sender,
        datetime: new Date(data.message.datetime).getTime(),
        relationType: data.relationType || 'original',
        isOriginal: data.isOriginal
      }]
    });

    console.log(`✅ 关联消息已存储: ${documentId}`);
  } catch (error) {
    console.error('❌ 存储关联消息到 ChromaDB 失败:', error);
  }
}

/**
 * 清理过期的关注项
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

    // 2. 删除 ChromaDB 中的关联记录
    if (expiredItems.length > 0) {
      const cloudStorage = memorySystem.cloudStorage;
      // 访问私有属性构建 collection name
      const username = (cloudStorage as any).username || '';
      const collectionName = `${username}-followed_thread_messages`;
      const collection = (cloudStorage as any).collections?.get(collectionName);

      if (collection) {
        for (const itemId of expiredItems) {
          try {
            // 删除该关注项的所有消息
            await collection.delete({
              where: { followItemId: itemId }
            });
          } catch (error) {
            console.error(`❌ 删除 ChromaDB 记录失败 (${itemId}):`, error);
          }
        }
      }

      // 3. 清理90天前的旧数据
      const ninetyDaysAgo = now - 90 * 24 * 60 * 60 * 1000;
      if (collection) {
        try {
          await collection.delete({
            where: {
              datetime: { $lt: ninetyDaysAgo }
            }
          });
        } catch (error) {
          console.error('❌ 清理90天前旧数据失败:', error);
        }
      }

      // 4. 更新 chrome.storage
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
