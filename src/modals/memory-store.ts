import { defineStore } from 'pinia';
import { ref, nextTick, toRaw } from 'vue';
import {
  getMemoryServiceClient,
  type RecallChannelDiagnostic,
  type RecallItem,
  type RecallScope,
} from '../services/MemoryServiceClient';
import {
  getTopicMessageIdentityCandidates,
  getTopicMessageIdentityValues,
} from './topic-detail-data';
import { getTopicUnreadTotalCount } from './topic-unread-preview';

// 实体类型配置
export const ENTITY_TYPE_CONFIG = {
  Person: {
    name: '人物',
    icon: '👥',
    description: '团队成员、联系人、项目相关人员等',
  },
  Project: {
    name: '项目',
    icon: '🚀',
    description: '工作项目、产品开发、研究项目等',
  },
  Task: {
    name: '任务',
    icon: '📋',
    description: '具体工作任务、待办事项、行动项等',
  },
  Organization: {
    name: '组织',
    icon: '🏢',
    description: '公司、部门、团队、客户组织等',
  },
  Document: {
    name: '文档',
    icon: '📄',
    description: '文件、资料、规范、报告等',
  },
  Technology: {
    name: '技术',
    icon: '🔧',
    description: '技术栈、工具、框架、平台等',
  },
  Topic: {
    name: '主题',
    icon: '💡',
    description: '讨论话题、知识领域、专业概念等',
  },
};

// Chrome Extension API 封装
export const chromeAPI = {
  async sendMessage(message: any) {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      return new Promise((resolve) => {
        chrome.runtime.sendMessage(message, resolve);
      });
    }
    console.log('模拟Chrome API调用:', message);
    return { success: true, data: null };
  },
};

// 阅读状态接口（预留扩展用）
interface _ReadStatus {
  isRead: boolean;
  lastReadTime: number | null;
  unreadCount: number;
  lastUpdateTime: number;
}

interface _ConversationMessage {
  id: string;
  isRead?: boolean;
  [key: string]: any;
}

interface _DeferredTopicState {
  until: number;
  createdAt: number;
}

interface _MutedTopicState {
  until: number | null;
  createdAt: number;
  reason?: TopicMuteReasonKey;
}

interface _TopicReadUndoConversationState {
  conversation: any;
  hadIsRead: boolean;
  isRead: any;
  hadReadTimestamp: boolean;
  readTimestamp: any;
}

interface _TopicReadUndoTarget {
  topic: any;
  hadReadStatus: boolean;
  readStatus: any;
  hadUnreadDiscussions: boolean;
  unreadDiscussions: any;
  conversations: _TopicReadUndoConversationState[];
}

interface _TopicReadUndoState {
  topicId: string;
  topicName: string;
  capturedAt: number;
  targets: _TopicReadUndoTarget[];
}

interface _ConversationReadUndoState {
  topicId: string;
  topicName: string;
  conversationId: string;
  conversationLabel: string;
  capturedAt: number;
  targets: _TopicReadUndoTarget[];
}

export interface MemorySearchFailureReceipt {
  mode: 'overview' | 'entity';
  query: string;
  scope: RecallScope;
  entityType?: string;
  source: 'ask' | 'recall';
  message: string;
  occurredAt: number;
}

export interface MemorySearchEmptyResultReceipt {
  mode: 'overview' | 'entity';
  query: string;
  scope: RecallScope;
  entityType?: string;
  source: 'ask' | 'recall';
  totalFound: number;
  queryTimeMs?: number;
  channelDiagnostics: RecallChannelDiagnostic[];
  occurredAt: number;
}

export interface EntityLoadFailureReceipt {
  entityType: string;
  message: string;
  occurredAt: number;
  previousDataRetained: boolean;
  retainedCount: number;
}

export interface AskContinuationReceipt {
  source: 'candidate_clarification';
  originalQuery: string;
  selectedCandidateIndex: number;
  selectedCandidateLabel: string;
  contextAttached: boolean;
}

export type TopicDeferPresetKey =
  | 'one-hour'
  | 'this-evening'
  | 'tomorrow-morning'
  | 'next-monday';

export interface TopicDeferPresetOption {
  key: TopicDeferPresetKey;
  label: string;
  until: number;
}

export type TopicMutePresetKey = 'one-day' | 'one-week' | 'indefinite';

export interface TopicMutePresetOption {
  key: TopicMutePresetKey;
  label: string;
  until: number | null;
}

export type TopicMuteReasonKey =
  | 'low-relevance'
  | 'duplicate-discussion'
  | 'not-now';

export interface TopicMuteReasonOption {
  key: TopicMuteReasonKey;
  label: string;
  description: string;
}

const TOPIC_DEFER_STORAGE_KEY = 'personal-ai-deferred-topics-v1';
const TOPIC_MUTE_STORAGE_KEY = 'personal-ai-muted-topics-v1';
const DEFAULT_TOPIC_DEFER_HOUR = 9;
const TOPIC_DEFER_EVENING_HOUR = 18;
const TOPIC_DEFER_MONDAY = 1;
const TOPIC_READ_UNDO_WINDOW_MS = 10_000;

const EMPTY_SEARCH_RESULT_DETAILS = {
  conversations: [],
  webpages: [],
  resources: [],
  projects: [],
  people: [],
  topics: [],
  jiraTickets: [],
  cooccurringEntities: [],
};

const getDateAtTime = (timestamp: number, hour: number, minute = 0) => {
  const date = new Date(timestamp);
  date.setHours(hour, minute, 0, 0);
  return date;
};

const getNextWeekdayAtTime = (
  timestamp: number,
  weekday: number,
  hour: number,
  minute = 0,
) => {
  const date = getDateAtTime(timestamp, hour, minute);
  const currentWeekday = date.getDay();
  let daysUntilTarget = (weekday - currentWeekday + 7) % 7;
  if (daysUntilTarget === 0 && date.getTime() <= timestamp) {
    daysUntilTarget += 7;
  }
  date.setDate(date.getDate() + daysUntilTarget);
  return date;
};

const getRecallItemTitle = (item: RecallItem): string => {
  const title =
    item.displayTitle ||
    item.sourceTitle ||
    item.entity?.name ||
    item.source ||
    item.previewText ||
    item.content;
  return String(title || item.id).slice(0, 80);
};

const getRecallItemDescription = (item: RecallItem): string => {
  return (
    item.previewText ||
    item.displayText ||
    item.entity?.description ||
    item.content ||
    ''
  );
};

const mapRecallItemToSearchResult = (item: RecallItem) => {
  const metadata = item.metadata || {};
  const entityType =
    item.type === 'entity'
      ? item.entity?.type || String(metadata.entityType || 'entity')
      : item.type;

  return {
    ...(metadata || {}),
    id: item.id,
    resultKey: `${item.type}:${item.id}`,
    name: getRecallItemTitle(item),
    type: entityType,
    recallType: item.type,
    description: getRecallItemDescription(item),
    relevanceScore: item.score,
    scope: item.scope || metadata.scope,
    source: item.source || metadata.source,
    sourceUrl: item.sourceUrl || metadata.sourceUrl,
    sourceTitle: item.sourceTitle || metadata.sourceTitle,
    displayTitle: item.displayTitle,
    displayText: item.displayText,
    previewText: item.previewText,
    exploreLink: item.exploreLink,
    timestamp: item.timestamp,
    channels: Array.isArray(metadata.channels) ? metadata.channels : [],
    feedbackAction:
      metadata.recallFeedback === 'positive' ||
      metadata.recallFeedback === 'negative'
        ? metadata.recallFeedback
        : undefined,
    recentDataDetails: { ...EMPTY_SEARCH_RESULT_DETAILS },
  };
};

export const getTopicDeferPresetOptions = (
  now = Date.now(),
): TopicDeferPresetOption[] => {
  const oneHour = now + 60 * 60 * 1000;
  const thisEvening = getDateAtTime(now, TOPIC_DEFER_EVENING_HOUR).getTime();
  const tomorrowMorning = getDateAtTime(now, DEFAULT_TOPIC_DEFER_HOUR);
  tomorrowMorning.setDate(tomorrowMorning.getDate() + 1);

  return [
    {
      key: 'one-hour',
      label: '1小时后',
      until: oneHour,
    },
    {
      key: 'this-evening',
      label: thisEvening > now ? '今天晚些时候' : '明天上午',
      until: thisEvening > now ? thisEvening : tomorrowMorning.getTime(),
    },
    {
      key: 'tomorrow-morning',
      label: '明天上午',
      until: tomorrowMorning.getTime(),
    },
    {
      key: 'next-monday',
      label: '下周一',
      until: getNextWeekdayAtTime(
        now,
        TOPIC_DEFER_MONDAY,
        DEFAULT_TOPIC_DEFER_HOUR,
      ).getTime(),
    },
  ];
};

export const getTopicMutePresetOptions = (
  now = Date.now(),
): TopicMutePresetOption[] => {
  return [
    {
      key: 'one-day',
      label: '静音1天',
      until: now + 24 * 60 * 60 * 1000,
    },
    {
      key: 'one-week',
      label: '静音1周',
      until: now + 7 * 24 * 60 * 60 * 1000,
    },
    {
      key: 'indefinite',
      label: '一直静音',
      until: null,
    },
  ];
};

const TOPIC_MUTE_REASON_OPTIONS: TopicMuteReasonOption[] = [
  {
    key: 'not-now',
    label: '暂不关注',
    description: '以后再回到未读流',
  },
  {
    key: 'low-relevance',
    label: '低相关度',
    description: '减少弱相关主题干扰',
  },
  {
    key: 'duplicate-discussion',
    label: '重复讨论',
    description: '合并同类噪声主题',
  },
];

const TOPIC_MUTE_REASON_KEYS = new Set(
  TOPIC_MUTE_REASON_OPTIONS.map((option) => option.key),
);

export const getTopicMuteReasonOptions = (): TopicMuteReasonOption[] =>
  TOPIC_MUTE_REASON_OPTIONS.map((option) => ({ ...option }));

export const getTopicMuteReasonLabel = (reason?: string): string => {
  return (
    TOPIC_MUTE_REASON_OPTIONS.find((option) => option.key === reason)?.label ||
    '手动静音'
  );
};

const normalizeTopicMuteReason = (
  reason: unknown,
): TopicMuteReasonKey | undefined => {
  const normalized = String(reason || '').trim();
  return TOPIC_MUTE_REASON_KEYS.has(normalized as TopicMuteReasonKey)
    ? (normalized as TopicMuteReasonKey)
    : undefined;
};

const TOPIC_CONVERSATION_CONTAINERS = [
  'recentDataDetails',
  'relatedData',
] as const;

const TOPIC_TOP_LEVEL_CONVERSATION_KEYS = [
  'conversations',
  'latestConversations',
] as const;

const getConversationIdentitySet = (conversation: any): Set<string> => {
  const identitySet = new Set(getTopicMessageIdentityValues(conversation));
  const contextMessages = Array.isArray(conversation?.contextMessages)
    ? conversation.contextMessages
    : [];

  contextMessages.forEach((contextMessage: any) => {
    getTopicMessageIdentityValues(contextMessage).forEach((value) =>
      identitySet.add(value),
    );
  });

  return identitySet;
};

const getMessageIdentityQuerySet = (value: unknown): Set<string> =>
  new Set(getTopicMessageIdentityCandidates(value));

const doesConversationIdentityMatch = (
  conversation: any,
  identity: unknown,
): boolean => {
  const identitySet = getConversationIdentitySet(conversation);
  const querySet = getMessageIdentityQuerySet(identity);
  return Array.from(querySet).some((value) => identitySet.has(value));
};

const getConversationReadStateNodes = (conversation: any): any[] => {
  const nodes = conversation ? [conversation] : [];
  const contextMessages = Array.isArray(conversation?.contextMessages)
    ? conversation.contextMessages
    : [];

  contextMessages.forEach((contextMessage: any) => {
    if (contextMessage && !nodes.includes(contextMessage)) {
      nodes.push(contextMessage);
    }
  });

  return nodes;
};

const hasExplicitUnreadReadStateNode = (conversation: any): boolean => {
  return getConversationReadStateNodes(conversation).some(
    (message) => message?.isRead === false,
  );
};

const markConversationReadStateNodesAsRead = (
  conversation: any,
  timestamp: number,
): boolean => {
  let changed = false;

  getConversationReadStateNodes(conversation).forEach((message) => {
    if (message.isRead !== true) {
      changed = true;
      message.isRead = true;
      message.readTimestamp = timestamp;
      return;
    }
  });

  return changed;
};

const getTopicConversationLists = (topic: any): any[][] => {
  if (!topic) return [];

  const lists: any[][] = [];
  TOPIC_CONVERSATION_CONTAINERS.forEach((containerKey) => {
    const conversations = topic[containerKey]?.conversations;
    if (Array.isArray(conversations) && !lists.includes(conversations)) {
      lists.push(conversations);
    }
  });
  TOPIC_TOP_LEVEL_CONVERSATION_KEYS.forEach((conversationKey) => {
    const conversations = topic[conversationKey];
    if (Array.isArray(conversations) && !lists.includes(conversations)) {
      lists.push(conversations);
    }
  });
  return lists;
};

const inferUnreadCountFromConversations = (topic: any): number => {
  const lists = getTopicConversationLists(topic);
  if (lists.length === 0) return Number(topic?.readStatus?.unreadCount || 0);

  return Math.max(
    0,
    ...lists.map(
      (conversations) =>
        conversations.filter((conversation: any) =>
          hasExplicitUnreadReadStateNode(conversation),
        ).length,
    ),
  );
};

const inferUnreadCountFromTopic = (topic: any): number => {
  return Math.max(
    inferUnreadCountFromConversations(topic),
    Array.isArray(topic?.unreadDiscussions)
      ? topic.unreadDiscussions.length
      : 0,
  );
};

const getTopicUnreadSignalCount = (topic: any): number => {
  return getTopicUnreadTotalCount(topic);
};

const setTopicReadStatus = (
  topic: any,
  unreadCount: number,
  timestamp: number,
) => {
  if (!topic) return;

  topic.readStatus = {
    ...(topic.readStatus || {}),
    isRead: unreadCount === 0,
    unreadCount,
    lastReadTime:
      unreadCount === 0 ? timestamp : topic.readStatus?.lastReadTime || null,
    lastUpdateTime:
      topic.readStatus?.lastUpdateTime || topic.updated || timestamp,
  };
};

const markKnownConversationsAsRead = (topic: any, timestamp: number) => {
  getTopicConversationLists(topic).forEach((conversations) => {
    conversations.forEach((conversation: any) => {
      markConversationReadStateNodesAsRead(conversation, timestamp);
    });
  });
};

const markKnownConversationAsRead = (
  topic: any,
  conversationId: string,
  timestamp: number,
): boolean => {
  let changed = false;
  const normalizedConversationId = String(conversationId);

  getTopicConversationLists(topic).forEach((conversations) => {
    conversations.forEach((conversation: any) => {
      if (!doesConversationIdentityMatch(conversation, normalizedConversationId)) {
        return;
      }
      if (markConversationReadStateNodesAsRead(conversation, timestamp)) {
        changed = true;
      }
    });
  });

  return changed;
};

const getTopicConversationMatchingIds = (
  topic: any,
  conversationId: string,
): Set<string> => {
  const matchingIds = getMessageIdentityQuerySet(conversationId);
  getTopicConversationLists(topic).forEach((conversations) => {
    conversations.forEach((conversation: any) => {
      if (!doesConversationIdentityMatch(conversation, conversationId)) {
        return;
      }

      getConversationIdentitySet(conversation).forEach((value) =>
        matchingIds.add(value),
      );
    });
  });

  return matchingIds;
};

const hasUnreadConversationMatch = (
  topic: any,
  conversationId: string,
): boolean => {
  const normalizedConversationId = String(conversationId);
  return getTopicConversationLists(topic).some((conversations) =>
    conversations.some(
      (conversation: any) =>
        doesConversationIdentityMatch(conversation, normalizedConversationId) &&
        hasExplicitUnreadReadStateNode(conversation),
    ),
  );
};

const hasUnreadDiscussionMatch = (
  topic: any,
  conversationId: string,
): boolean => {
  if (!Array.isArray(topic?.unreadDiscussions)) return false;

  const matchingIds = getTopicConversationMatchingIds(topic, conversationId);
  return topic.unreadDiscussions.some((discussion: any) => {
    return getTopicMessageIdentityValues(discussion).some((discussionId) =>
      matchingIds.has(discussionId),
    );
  });
};

const getConversationDisplayLabel = (
  topic: any,
  conversationId: string,
): string => {
  const normalizedConversationId = String(conversationId);
  for (const conversations of getTopicConversationLists(topic)) {
    const conversation = conversations.find((candidate: any) =>
      doesConversationIdentityMatch(candidate, normalizedConversationId),
    );
    const summary =
      conversation?.summary ||
      conversation?.highlightText ||
      conversation?.originalContent ||
      conversation?.content;
    if (summary) return String(summary);
  }
  return normalizedConversationId;
};

const pruneReadDiscussion = (topic: any, conversationId: string): number => {
  if (!Array.isArray(topic?.unreadDiscussions)) return 0;

  const matchingIds = getTopicConversationMatchingIds(topic, conversationId);
  const previousLength = topic.unreadDiscussions.length;
  topic.unreadDiscussions = topic.unreadDiscussions.filter(
    (discussion: any) => {
      const discussionIds = getTopicMessageIdentityValues(discussion);
      return (
        discussionIds.length === 0 ||
        !discussionIds.some((discussionId) => matchingIds.has(discussionId))
      );
    },
  );
  return previousLength - topic.unreadDiscussions.length;
};

const cloneTopicReadState = (value: any) => {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(toRaw(value)));
};

const captureTopicReadUndoTarget = (topic: any): _TopicReadUndoTarget => {
  const conversationStates: _TopicReadUndoConversationState[] = [];
  const seenReadStateNodes = new Set<any>();

  getTopicConversationLists(topic).forEach((conversations) => {
    conversations.forEach((conversation: any) => {
      if (!conversation || seenReadStateNodes.has(conversation)) return;
      getConversationReadStateNodes(conversation).forEach((message) => {
        if (!message || seenReadStateNodes.has(message)) return;
        seenReadStateNodes.add(message);
        conversationStates.push({
          conversation: message,
          hadIsRead: Object.prototype.hasOwnProperty.call(message, 'isRead'),
          isRead: message.isRead,
          hadReadTimestamp: Object.prototype.hasOwnProperty.call(
            message,
            'readTimestamp',
          ),
          readTimestamp: message.readTimestamp,
        });
      });
    });
  });

  return {
    topic,
    hadReadStatus: Object.prototype.hasOwnProperty.call(topic, 'readStatus'),
    readStatus: cloneTopicReadState(topic.readStatus),
    hadUnreadDiscussions: Object.prototype.hasOwnProperty.call(
      topic,
      'unreadDiscussions',
    ),
    unreadDiscussions: cloneTopicReadState(topic.unreadDiscussions),
    conversations: conversationStates,
  };
};

const restoreTopicReadUndoTarget = (target: _TopicReadUndoTarget) => {
  if (target.hadReadStatus) {
    target.topic.readStatus = cloneTopicReadState(target.readStatus);
  } else {
    delete target.topic.readStatus;
  }

  if (target.hadUnreadDiscussions) {
    target.topic.unreadDiscussions = cloneTopicReadState(
      target.unreadDiscussions,
    );
  } else {
    delete target.topic.unreadDiscussions;
  }

  target.conversations.forEach((state) => {
    if (state.hadIsRead) {
      state.conversation.isRead = state.isRead;
    } else {
      delete state.conversation.isRead;
    }

    if (state.hadReadTimestamp) {
      state.conversation.readTimestamp = state.readTimestamp;
    } else {
      delete state.conversation.readTimestamp;
    }
  });
};

// Pinia Store
export const useMemoryStore = defineStore('memory', () => {
  const isLoading = ref(false);
  const isAISearching = ref(false); // AI 搜索动画状态
  const searchQuery = ref('');
  const searchFailureReceipt = ref<MemorySearchFailureReceipt | null>(null);
  const entityLoadFailureReceipt = ref<EntityLoadFailureReceipt | null>(null);
  const lastLoadedEntityType = ref<string | null>(null);
  const entities = ref([]);
  const entityTypes = ref([
    { type: 'Project', name: '项目', icon: '🚀', count: 12 },
    { type: 'Topic', name: '主题', icon: '💡', count: 28 },
    { type: 'Person', name: '人物', icon: '👥', count: 45 },
    { type: 'Organization', name: '组织', icon: '🏢', count: 8 },
    { type: 'Document', name: '文档', icon: '📄', count: 156 },
    { type: 'Technology', name: '技术', icon: '🔧', count: 23 },
  ]);
  const overviewStats = ref({
    totalEntities: 272,
    totalRelationships: 156,
    entitiesCreatedToday: 5,
    entitiesCreatedThisWeek: 23,
    entitiesCreatedThisMonth: 89,
  });
  const topicDetailData = ref(null);
  const personDetailData = ref(null);
  const closedTodayCards = ref(new Set<string>()); // 今日已关闭的卡片
  const deferredTopics = ref<Record<string, _DeferredTopicState>>({});
  const mutedTopics = ref<Record<string, _MutedTopicState>>({});
  const topicReadUndo = ref<_TopicReadUndoState | null>(null);
  const conversationReadUndo = ref<_ConversationReadUndoState | null>(null);
  let topicReadUndoTimer: ReturnType<typeof setTimeout> | null = null;
  let conversationReadUndoTimer: ReturnType<typeof setTimeout> | null = null;

  const initialize = async () => {
    isLoading.value = true;
    try {
      // 恢复已关闭的今日卡片
      loadClosedCardsFromLocalStorage();
      loadDeferredTopicsFromLocalStorage();
      loadMutedTopicsFromLocalStorage();

      const response = await chromeAPI.sendMessage({
        type: 'GET_ENTITY_STATISTICS',
      });
      if (response && (response as any).success) {
        overviewStats.value = (response as any).data;
      }
    } catch (error) {
      console.warn('获取实体统计失败，使用模拟数据');
    } finally {
      isLoading.value = false;
    }
  };

  const loadEntitiesByType = async (
    entityType: string,
    offset = 0,
    limit = 30,
  ) => {
    isLoading.value = true;
    const handleLoadFailure = (message: string) => {
      if (entityType === 'Topic') {
        const canRetainPreviousSnapshot =
          lastLoadedEntityType.value === entityType && entities.value.length > 0;
        const retainedCount = canRetainPreviousSnapshot
          ? entities.value.length
          : 0;

        if (!canRetainPreviousSnapshot) {
          entities.value = [];
        }

        entityLoadFailureReceipt.value = {
          entityType,
          message,
          occurredAt: Date.now(),
          previousDataRetained: canRetainPreviousSnapshot,
          retainedCount,
        };
        lastLoadedEntityType.value = entityType;
        return;
      }

      entities.value = generateMockEntities(entityType);
      entityLoadFailureReceipt.value = null;
      lastLoadedEntityType.value = entityType;
    };

    try {
      const response = await chromeAPI.sendMessage({
        type: 'GET_ENTITIES_BY_TYPE',
        entityType,
        limit,
        offset,
      });

      if (response && (response as any).success) {
        entities.value = (response as any).data || [];
        entityLoadFailureReceipt.value = null;
        lastLoadedEntityType.value = entityType;
        await nextTick();
      } else {
        handleLoadFailure(
          (response as any)?.error ||
            'Memory Service 未返回可用的实体列表。',
        );
      }
    } catch (error) {
      handleLoadFailure(
        error instanceof Error
          ? error.message
          : 'Memory Service 实体列表请求失败。',
      );
    } finally {
      isLoading.value = false;

      // 如果是第一页 Topic 数据，恢复已读状态
      if (offset === 0 && entityType === 'Topic') {
        loadReadStatusFromLocalStorage();
        loadDeferredTopicsFromLocalStorage();
        loadMutedTopicsFromLocalStorage();
        updateTopicUnreadCount();
      }
    }
  };

  const searchEntities = async (query: string) => {
    if (!query.trim()) return;
    isLoading.value = true;
    try {
      const response = await chromeAPI.sendMessage({
        type: 'SEARCH_ENTITIES',
        query,
        limit: 30,
      });
      if (response && (response as any).success) {
        entities.value = (response as any).data || [];
      }
    } catch (error) {
      console.error('搜索失败:', error);
    } finally {
      isLoading.value = false;
    }
  };

  const vectorSearchEntities = async (query: string, entityType?: string) => {
    if (!query.trim()) return;
    isLoading.value = true;
    searchQuery.value = query;
    searchFailureReceipt.value = null;
    try {
      const response = await chromeAPI.sendMessage({
        type: 'SEARCH_ENTITIES',
        query,
        entityType,
        limit: 20,
      });
      if (response && (response as any).success) {
        entities.value = (response as any).data || [];
        console.log(
          '[向量搜索] 成功获取实际数据:',
          entities.value.length,
          '个实体',
        );
        searchFailureReceipt.value = null;
      } else {
        console.warn('[向量搜索] API返回失败，不展示模拟结果');
        entities.value = [];
        searchFailureReceipt.value = {
          mode: 'entity',
          query,
          scope: 'work',
          entityType,
          source: 'recall',
          message:
            (response as any)?.error ||
            'Memory Service 未返回可用的搜索结果。',
          occurredAt: Date.now(),
        };
      }
    } catch (error) {
      console.error('[向量搜索] 搜索失败:', error);
      entities.value = [];
      searchFailureReceipt.value = {
        mode: 'entity',
        query,
        scope: 'work',
        entityType,
        source: 'recall',
        message:
          error instanceof Error
            ? error.message
            : 'Memory Service 搜索请求失败。',
        occurredAt: Date.now(),
      };
    } finally {
      isLoading.value = false;
    }
  };

  const loadTopicDetail = async (topicId: string) => {
    isLoading.value = true;
    try {
      const response = await chromeAPI.sendMessage({
        type: 'GET_TOPIC_DETAIL',
        topicId,
      });
      if (response && (response as any).success && (response as any).data) {
        topicDetailData.value = (response as any).data;
      } else {
        topicDetailData.value = getMockTopicDetail(topicId);
      }
    } catch (error) {
      topicDetailData.value = getMockTopicDetail(topicId);
    } finally {
      isLoading.value = false;
    }
  };

  const generateMockEntities = (entityType: string) => {
    const config =
      ENTITY_TYPE_CONFIG[entityType as keyof typeof ENTITY_TYPE_CONFIG];
    if (!config) return [];

    if (entityType === 'Topic') {
      return [
        {
          id: 'topic-ai-workflow',
          name: 'AI 工作流自动化',
          type: entityType,
          description: '讨论AI在工作流程中的应用和自动化实践',
          importance: 0.9,
          updated: Date.now() - 1800000, // 30分钟前
          readStatus: {
            isRead: false,
            lastReadTime: null as number | null,
            unreadCount: 7,
            lastUpdateTime: Date.now() - 1800000,
          },
          unreadDiscussions: [
            {
              messageId: 'msg-1',
              text: '张三分享了GPT-4 API的Token优化策略,可以减少30%成本',
              time: '30分钟前',
            },
            {
              messageId: 'msg-2',
              text: '李四提出了自动化测试框架的新方案',
              time: '1小时前',
            },
            {
              messageId: 'msg-3',
              text: 'AI工作流中异常处理的最佳实践讨论',
              time: '2小时前',
            },
          ],
          recentDataDetails: {
            conversations: [
              {
                id: 'msg-1',
                sender: '张三',
                groupName: '技术讨论组',
                datetime: Date.now() - 1800000,
                summary: '分享了最新的GPT-4 API集成经验，讨论了Token优化策略',
                originalContent:
                  '我找到了一些优化Token使用的方法，可以减少30%的成本',
                highlightText: 'GPT-4 API Token优化策略',
                teamUrl: '#',
                matchedRules: ['AI', '优化'],
                relevanceScore: 0.95,
                contextMessages: [] as any[],
                isRead: false,
              },
              {
                id: 'msg-2',
                sender: '李四',
                groupName: '产品团队',
                datetime: Date.now() - 7200000,
                summary:
                  '讨论了自动化测试的实现方案，提出了新的测试框架选型建议',
                originalContent:
                  '建议采用Playwright + Jest的组合，覆盖率会更高',
                highlightText: '自动化测试实现方案',
                teamUrl: '#',
                matchedRules: ['测试', '自动化'],
                relevanceScore: 0.88,
                contextMessages: [] as any[],
                isRead: false,
              },
            ],
            resources: [
              {
                id: 'resource-1',
                name: 'GPT-4 API 官方文档',
                url: 'https://platform.openai.com/docs',
                type: 'docs',
              },
              {
                id: 'resource-2',
                name: '自动化实践指南',
                url: '#',
                type: 'docs',
              },
            ],
            projects: [
              {
                id: 'project-1',
                name: 'Personal-AI',
                status: '开发中',
                description: 'Chrome扩展智能助手',
              },
              {
                id: 'project-2',
                name: 'Automation Tools',
                status: '规划中',
                description: 'CI/CD自动化工具链',
              },
            ],
            webpages: [] as any[],
            people: [] as any[],
            topics: [] as any[],
            jiraTickets: [] as any[],
            cooccurringEntities: [] as any[],
          },
          tags: ['AI', '自动化', '工作流'],
          status: 'active',
          cachedAt: Date.now(),
          statistic: {
            conversations: 12,
            projects: 2,
            participants: 8,
            resources: 2,
            documents: 1,
            webpages: 3,
            relationships: 5,
          },
        },
        {
          id: 'topic-frontend-optimization',
          name: '前端性能优化策略',
          type: entityType,
          description: '前端应用性能优化的技术讨论和最佳实践分享',
          importance: 0.8,
          updated: Date.now() - 7200000, // 2小时前
          readStatus: {
            isRead: false,
            lastReadTime: null,
            unreadCount: 4,
            lastUpdateTime: Date.now() - 7200000,
          },
          unreadDiscussions: [
            {
              messageId: 'msg-3',
              text: 'React 18并发模式实战经验分享',
              time: '2小时前',
            },
            {
              messageId: 'msg-4',
              text: 'Webpack Bundle分析工具对比',
              time: '3小时前',
            },
            {
              messageId: 'msg-frontend-lazyload',
              text: '图片懒加载优化方案讨论',
              time: '4小时前',
            },
          ],
          recentDataDetails: {
            conversations: [
              {
                id: 'msg-3',
                sender: '王五',
                groupName: '前端团队',
                datetime: Date.now() - 7200000,
                summary: '分析了React 18的并发特性对性能的影响',
                originalContent: 'React 18的并发特性可以显著提升用户体验',
                highlightText: 'React 18并发特性',
                teamUrl: '#',
                matchedRules: ['React', '性能'],
                relevanceScore: 0.92,
                contextMessages: [] as any[],
                isRead: false,
              },
              {
                id: 'msg-4',
                sender: '张三',
                groupName: '技术讨论组',
                datetime: Date.now() - 14400000,
                summary: 'Bundle体积优化技巧分享，减少30%的包大小',
                originalContent:
                  '通过Webpack配置优化，我们成功减少了30%的Bundle大小',
                highlightText: 'Bundle体积优化',
                teamUrl: '#',
                matchedRules: ['优化', 'Webpack'],
                relevanceScore: 0.89,
                contextMessages: [] as any[],
                isRead: false,
              },
            ],
            resources: [
              {
                id: 'resource-3',
                name: 'React 18 性能指南',
                url: '#',
                type: 'docs',
              },
              {
                id: 'resource-4',
                name: 'Webpack 优化手册',
                url: '#',
                type: 'docs',
              },
            ],
            projects: [
              {
                id: 'project-3',
                name: 'Web Platform',
                status: '优化中',
                description: '前端Web平台',
              },
            ],
            webpages: [] as any[],
            people: [] as any[],
            topics: [] as any[],
            jiraTickets: [] as any[],
            cooccurringEntities: [] as any[],
          },
          tags: ['前端', '性能', 'React'],
          status: 'active',
          cachedAt: Date.now(),
          statistic: {
            conversations: 8,
            projects: 1,
            participants: 5,
            resources: 2,
            documents: 2,
            webpages: 1,
            relationships: 3,
          },
        },
        {
          id: 'topic-design-thinking',
          name: '产品设计思维方法',
          type: entityType,
          description: '产品设计流程、用户体验设计方法论的探讨',
          importance: 0.7,
          updated: Date.now() - 14400000, // 4小时前
          readStatus: {
            isRead: true,
            lastReadTime: Date.now() - 43200000,
            unreadCount: 0,
            lastUpdateTime: Date.now() - 14400000,
          },
          unreadDiscussions: [],
          recentDataDetails: {
            conversations: [
              {
                id: 'msg-5',
                sender: '李四',
                groupName: '设计团队',
                datetime: Date.now() - 14400000,
                summary: '用户研究方法在产品迭代中的应用案例分析',
                originalContent:
                  '通过用户访谈和行为分析，我们发现了几个重要的改进点',
                highlightText: '用户研究方法应用',
                teamUrl: '#',
                matchedRules: ['用户研究', '产品迭代'],
                relevanceScore: 0.87,
                contextMessages: [] as any[],
                isRead: true, // 这个主题已经全部已读
              },
              {
                id: 'msg-6',
                sender: '产品经理',
                groupName: '产品团队',
                datetime: Date.now() - 21600000,
                summary: '设计系统在大型项目中的管理经验分享',
                originalContent:
                  '建立统一的设计系统对大型项目的协作效率有显著提升',
                highlightText: '设计系统管理经验',
                teamUrl: '#',
                matchedRules: ['设计系统', '项目管理'],
                relevanceScore: 0.85,
                contextMessages: [] as any[],
                isRead: true, // 这个主题已经全部已读
              },
            ],
            resources: [
              {
                id: 'resource-5',
                name: '设计思维实践手册',
                url: '#',
                type: 'docs',
              },
            ],
            projects: [
              {
                id: 'project-4',
                name: 'Design System',
                status: '进行中',
                description: '设计系统组件库',
              },
              {
                id: 'project-5',
                name: 'Mobile App',
                status: '设计中',
                description: '移动应用产品',
              },
            ],
            webpages: [] as any[],
            people: [] as any[],
            topics: [] as any[],
            jiraTickets: [] as any[],
            cooccurringEntities: [] as any[],
          },
          tags: ['设计', 'UX', '产品'],
          status: 'active',
          cachedAt: Date.now(),
          statistic: {
            conversations: 6,
            projects: 2,
            participants: 4,
            resources: 1,
            documents: 1,
            webpages: 2,
            relationships: 2,
          },
        },
      ];
    }

    if (entityType === 'Project') {
      return [
        {
          id: 'project-personal-ai',
          name: 'Personal-AI',
          type: entityType,
          description: 'Chrome扩展智能助手，帮助用户管理知识图谱和提升工作效率',
          importance: 0.95,
          accessCount: 156,
          lastAccessed: Date.now() - 7200000, // 2小时前
          tags: ['Chrome扩展', 'AI', '智能助手'],
          status: 'active',
          isHighlighted: true,
          cachedAt: Date.now(),
          statistic: {
            conversations: 67,
            projects: 1,
            participants: 8,
            resources: 15,
            documents: 10,
            webpages: 34,
            relationships: 23,
          },
          recentDataDetails: {
            conversations: [] as any[],
            webpages: [] as any[],
            resources: [] as any[],
            projects: [] as any[],
            people: [] as any[],
            topics: [] as any[],
            jiraTickets: [] as any[],
            cooccurringEntities: [] as any[],
          },
        },
        {
          id: 'project-data-pipeline',
          name: 'Data Pipeline',
          type: entityType,
          description: '数据处理流水线，支持大规模数据的ETL处理和分析',
          importance: 0.8,
          accessCount: 89,
          lastAccessed: Date.now() - 18000000, // 5小时前
          tags: ['数据处理', 'ETL', '大数据'],
          status: 'active',
          isHighlighted: false,
          cachedAt: Date.now(),
          statistic: {
            conversations: 42,
            projects: 1,
            participants: 5,
            resources: 8,
            documents: 5,
            webpages: 18,
            relationships: 15,
          },
          recentDataDetails: {
            conversations: [] as any[],
            webpages: [] as any[],
            resources: [] as any[],
            projects: [] as any[],
            people: [] as any[],
            topics: [] as any[],
            jiraTickets: [] as any[],
            cooccurringEntities: [] as any[],
          },
        },
        {
          id: 'project-web-platform',
          name: 'Web Platform',
          type: entityType,
          description: '前端Web平台，提供统一的用户界面和交互体验',
          importance: 0.7,
          accessCount: 134,
          lastAccessed: Date.now() - 43200000, // 12小时前
          tags: ['前端', 'Web', '用户体验'],
          status: 'active',
          isHighlighted: true,
          cachedAt: Date.now(),
          statistic: {
            conversations: 78,
            projects: 1,
            participants: 12,
            resources: 20,
            documents: 15,
            webpages: 45,
            relationships: 28,
          },
          recentDataDetails: {
            conversations: [] as any[],
            webpages: [] as any[],
            resources: [] as any[],
            projects: [] as any[],
            people: [] as any[],
            topics: [] as any[],
            jiraTickets: [] as any[],
            cooccurringEntities: [] as any[],
          },
        },
        {
          id: 'project-design-system',
          name: 'Design System',
          type: entityType,
          description: '设计系统组件库，统一产品设计语言和组件规范',
          importance: 0.6,
          accessCount: 67,
          lastAccessed: Date.now() - 86400000, // 1天前
          tags: ['设计系统', 'UI组件', '规范'],
          status: 'active',
          isHighlighted: false,
          cachedAt: Date.now(),
          statistic: {
            conversations: 29,
            projects: 1,
            participants: 6,
            resources: 10,
            documents: 8,
            webpages: 16,
            relationships: 12,
          },
          recentDataDetails: {
            conversations: [] as any[],
            webpages: [] as any[],
            resources: [] as any[],
            projects: [] as any[],
            people: [] as any[],
            topics: [] as any[],
            jiraTickets: [] as any[],
            cooccurringEntities: [] as any[],
          },
        },
        {
          id: 'project-automation-tools',
          name: 'Automation Tools',
          type: entityType,
          description: 'CI/CD自动化工具链，提升开发和部署效率',
          importance: 0.75,
          accessCount: 93,
          lastAccessed: Date.now() - 172800000, // 2天前
          tags: ['自动化', 'CI/CD', '工具链'],
          status: 'active',
          isHighlighted: false,
          cachedAt: Date.now(),
          statistic: {
            conversations: 36,
            projects: 1,
            participants: 8,
            resources: 12,
            documents: 7,
            webpages: 22,
            relationships: 18,
          },
          recentDataDetails: {
            conversations: [] as any[],
            webpages: [] as any[],
            resources: [] as any[],
            projects: [] as any[],
            people: [] as any[],
            topics: [] as any[],
            jiraTickets: [] as any[],
            cooccurringEntities: [] as any[],
          },
        },
      ];
    }

    if (entityType === 'Person') {
      return [
        {
          id: 'person-zhangsan',
          name: '张三',
          type: entityType,
          description:
            '前端开发工程师，擅长React和TypeScript开发，团队中的技术专家',
          role: '前端工程师',
          team: '技术团队',
          lastContact: Date.now() - 3600000, // 1小时前
          expertise: ['React', 'TypeScript', '性能优化', '组件设计'],
          recentCollaborations: [
            {
              id: 'collab-1',
              projectId: 'project-personal-ai',
              projectName: 'Personal-AI',
              time: '1小时前',
            },
            {
              id: 'collab-2',
              projectId: 'project-web-platform',
              projectName: 'Web Platform',
              time: '3小时前',
            },
          ],
          recentMessages: [
            {
              id: 'msg-1',
              summary: '代码审查反馈：建议优化组件性能',
              time: '1小时前',
            },
            {
              id: 'msg-2',
              summary: '分享了一个有用的React Hook实现方案',
              time: '2小时前',
            },
          ],
          tags: ['前端', '技术专家', 'React'],
          status: 'active',
          cachedAt: Date.now(),
          statistic: {
            conversations: 25,
            projects: 2,
            participants: 1,
            resources: 5,
            documents: 3,
            webpages: 8,
            relationships: 12,
          },
          recentDataDetails: {
            conversations: [] as any[],
            webpages: [] as any[],
            resources: [] as any[],
            projects: [] as any[],
            people: [] as any[],
            topics: [] as any[],
            jiraTickets: [] as any[],
            cooccurringEntities: [] as any[],
          },
        },
        {
          id: 'person-lisi',
          name: '李四',
          type: entityType,
          description:
            'UI/UX设计师，专注用户体验设计和交互原型，设计团队核心成员',
          role: 'UI/UX设计师',
          team: '设计团队',
          lastContact: Date.now() - 10800000, // 3小时前
          expertise: ['用户体验', 'Figma', '交互设计', '设计系统'],
          recentCollaborations: [
            {
              id: 'collab-3',
              projectId: 'project-design-system',
              projectName: 'Design System',
              time: '3小时前',
            },
            {
              id: 'collab-4',
              projectId: 'project-personal-ai',
              projectName: 'Personal-AI',
              time: '5小时前',
            },
          ],
          recentMessages: [
            {
              id: 'msg-3',
              summary: '设计稿更新通知：新版用户界面已完成',
              time: '3小时前',
            },
            {
              id: 'msg-4',
              summary: '用户体验测试报告分享，发现了几个可改进点',
              time: '4小时前',
            },
          ],
          tags: ['设计', 'UX', '原型'],
          status: 'active',
          cachedAt: Date.now(),
          statistic: {
            conversations: 18,
            projects: 2,
            participants: 1,
            resources: 8,
            documents: 5,
            webpages: 12,
            relationships: 8,
          },
          recentDataDetails: {
            conversations: [] as any[],
            webpages: [] as any[],
            resources: [] as any[],
            projects: [] as any[],
            people: [] as any[],
            topics: [] as any[],
            jiraTickets: [] as any[],
            cooccurringEntities: [] as any[],
          },
        },
        {
          id: 'person-wangwu',
          name: '王五',
          type: entityType,
          description:
            '后端开发工程师，负责系统架构设计和API开发，技术栈涵盖多种语言',
          role: '后端工程师',
          team: '技术团队',
          lastContact: Date.now() - 21600000, // 6小时前
          expertise: ['系统架构', 'API设计', 'Node.js', '数据库'],
          recentCollaborations: [
            {
              id: 'collab-5',
              projectId: 'project-data-pipeline',
              projectName: 'Data Pipeline',
              time: '6小时前',
            },
            {
              id: 'collab-6',
              projectId: 'project-automation-tools',
              projectName: 'Automation Tools',
              time: '1天前',
            },
          ],
          recentMessages: [
            {
              id: 'msg-5',
              summary: '会议纪要分享：API架构优化方案讨论',
              time: '6小时前',
            },
            {
              id: 'msg-6',
              summary: '数据库性能优化建议和实施计划',
              time: '8小时前',
            },
          ],
          tags: ['后端', '架构师', 'API'],
          status: 'active',
          cachedAt: Date.now(),
          statistic: {
            conversations: 22,
            projects: 2,
            participants: 1,
            resources: 12,
            documents: 8,
            webpages: 6,
            relationships: 15,
          },
          recentDataDetails: {
            conversations: [] as any[],
            webpages: [] as any[],
            resources: [] as any[],
            projects: [] as any[],
            people: [] as any[],
            topics: [] as any[],
            jiraTickets: [] as any[],
            cooccurringEntities: [] as any[],
          },
        },
      ];
    }

    // 其他类型实体的原始生成逻辑
    return Array.from({ length: 5 }, (_, i) => ({
      id: `${entityType.toLowerCase()}-${i + 1}`,
      name: `${config.name} ${i + 1}`,
      type: entityType,
      description: `这是一个${config.description}的示例`,
      importance: Math.random(),
      accessCount: Math.floor(Math.random() * 100),
      lastAccessed: Date.now() - Math.floor(Math.random() * 86400000),
      tags: ['示例', '测试'],
      status: 'active',
      cachedAt: Date.now(),
      statistic: {
        conversations: Math.floor(Math.random() * 50),
        projects: Math.floor(Math.random() * 10),
        participants: Math.floor(Math.random() * 15),
        resources: Math.floor(Math.random() * 20),
        documents: Math.floor(Math.random() * 10),
        webpages: Math.floor(Math.random() * 30),
        relationships: Math.floor(Math.random() * 20),
      },
      recentDataDetails: {
        conversations: [] as any[],
        webpages: [] as any[],
        resources: [] as any[],
        projects: [] as any[],
        people: [] as any[],
        topics: [] as any[],
        jiraTickets: [] as any[],
        cooccurringEntities: [] as any[],
      },
    }));
  };

  const getMockTopicDetail = (topicId: string) => {
    const updated = Date.now() - 1800000;
    const legacyDetail = {
      id: topicId,
      title: 'AI 工作流自动化',
      overview: {
        discussions: 12,
        projects: 5,
        participants: 8,
        resources: 15,
      },
      relatedProjects: [
        {
          id: 'project-1',
          name: 'Personal-AI',
          status: '开发中',
          description: 'Chrome扩展智能助手',
        },
        {
          id: 'project-2',
          name: 'Automation Tools',
          status: '规划中',
          description: 'CI/CD自动化工具链',
        },
      ],
      relatedResources: [
        {
          id: 'resource-1',
          name: 'AI开发最佳实践',
          type: '技术文档',
          url: '#',
        },
        { id: 'resource-2', name: '自动化工具指南', type: '教程', url: '#' },
      ],
      relatedTickets: [
        {
          id: 'AI-123',
          title: '实现智能推荐算法',
          status: '进行中',
          assignee: '张三',
          priority: '高',
        },
        {
          id: 'AI-124',
          title: '优化用户界面响应速度',
          status: '待开始',
          assignee: '李四',
          priority: '中',
        },
        {
          id: 'AI-125',
          title: '集成第三方AI服务',
          status: '已完成',
          assignee: '王五',
          priority: '低',
        },
      ],
      conversations: [
        {
          id: 'msg-1',
          sender: '张三',
          group: '技术讨论组',
          time: '30分钟前',
          summary: '分享了最新的GPT-4 API集成经验，讨论了Token优化策略',
          contextMessages: [
            {
              sender: '李四',
              content: '最近GPT-4的API调用成本有点高',
              time: '35分钟前',
            },
            {
              sender: '张三',
              content: '我找到了一些优化Token使用的方法，可以减少30%的成本',
              time: '30分钟前',
              isMainMessage: true,
            },
            {
              sender: '王五',
              content: '能分享一下具体的优化策略吗？',
              time: '28分钟前',
            },
          ],
        },
        {
          id: 'msg-2',
          sender: '李四',
          group: '产品团队',
          time: '2小时前',
          summary: '讨论了自动化测试的实现方案，提出了新的测试框架选型建议',
          contextMessages: [
            {
              sender: '产品经理',
              content: '我们需要一个更好的自动化测试方案',
              time: '2.5小时前',
            },
            {
              sender: '李四',
              content: '建议采用Playwright + Jest的组合，覆盖率会更高',
              time: '2小时前',
              isMainMessage: true,
            },
            {
              sender: '测试负责人',
              content: '这个方案看起来不错，我们可以试试',
              time: '1.5小时前',
            },
          ],
        },
        {
          id: 'msg-3',
          sender: '王五',
          group: 'AI研发团队',
          time: '4小时前',
          summary: '探讨了多模态AI模型在产品中的应用场景',
          contextMessages: [
            {
              sender: '技术总监',
              content: '现在多模态AI技术越来越成熟了',
              time: '4.5小时前',
            },
            {
              sender: '王五',
              content: '我们可以考虑在用户界面中集成图像识别和文本理解',
              time: '4小时前',
              isMainMessage: true,
            },
            {
              sender: '产品经理',
              content: '这样可以大大提升用户体验',
              time: '3.5小时前',
            },
          ],
        },
      ],
      webpages: [
        {
          id: 'webpage-1',
          title: 'OpenAI GPT-4 API 官方文档',
          url: 'https://platform.openai.com/docs/models/gpt-4',
          type: 'docs',
          visitTime: '2小时前',
          relevanceScore: 0.95,
          summary: '详细介绍了GPT-4 API的使用方法、参数配置和最佳实践',
          tags: ['API文档', 'GPT-4', '官方文档'],
        },
        {
          id: 'webpage-2',
          title: 'Chrome Extension Automation Best Practices',
          url: 'https://developer.chrome.com/docs/extensions/mv3/automation',
          type: 'docs',
          visitTime: '昨天',
          relevanceScore: 0.78,
          summary: 'Chrome扩展自动化开发的最佳实践和技术指南',
          tags: ['Chrome扩展', '自动化', '最佳实践'],
        },
        {
          id: 'webpage-3',
          title: 'GitHub Actions 工作流配置指南',
          url: 'https://docs.github.com/en/actions/workflows',
          type: 'github',
          visitTime: '3天前',
          relevanceScore: 0.82,
          summary: 'CI/CD自动化工作流的配置方法和实用技巧',
          tags: ['GitHub Actions', 'CI/CD', '自动化'],
        },
      ],
    };

    return {
      ...legacyDetail,
      id: topicId,
      name: legacyDetail.title,
      type: 'Topic',
      description: '讨论 AI 在工作流程中的应用和自动化实践',
      importance: 0.9,
      updated,
      readStatus: {
        isRead: false,
        lastReadTime: null,
        unreadCount: legacyDetail.conversations.length,
        lastUpdateTime: updated,
      },
      unreadDiscussions: legacyDetail.conversations.map((conversation) => ({
        id: conversation.id,
        text: conversation.summary,
      })),
      statistic: {
        conversations: legacyDetail.overview.discussions,
        projects: legacyDetail.overview.projects,
        participants: legacyDetail.overview.participants,
        resources: legacyDetail.overview.resources,
        documents: 0,
        webpages: legacyDetail.webpages.length,
        relationships: 0,
      },
      recentDataDetails: {
        conversations: legacyDetail.conversations.map((conversation) => ({
          id: conversation.id,
          sender: conversation.sender,
          groupName: conversation.group,
          datetime: updated,
          summary: conversation.summary,
          contextMessages: conversation.contextMessages.map((message) => ({
            sender: message.sender,
            content: message.content,
            datetime: updated,
            isMainMessage: Boolean(message.isMainMessage),
          })),
          isRead: false,
        })),
        webpages: legacyDetail.webpages,
        resources: legacyDetail.relatedResources,
        projects: legacyDetail.relatedProjects,
        people: [],
        topics: [],
        jiraTickets: legacyDetail.relatedTickets,
        cooccurringEntities: [],
      },
    };
  };

  /**
   * ==========================================
   * LocalStorage 持久化函数
   * ==========================================
   */

  /**
   * 保存已读状态到本地缓存 (通过后台脚本)
   * 这会将 readStatus 保存到 chrome.storage.local，并在同步时上传到云端
   */
  const _saveReadStatusToLocalStorage = async () => {
    try {
      let savedCount = 0;
      const savePromises = [];

      // 使用 toRaw 获取原始数组
      const rawEntities = toRaw(entities.value);
      for (const entity of rawEntities) {
        if (entity.type === 'Topic' && entity.readStatus) {
          // 通过后台脚本缓存实体（包括 readStatus）
          // 使用 toRaw 确保实体对象也是原始对象
          const promise = chromeAPI.sendMessage({
            type: 'CACHE_ENTITY',
            entity: toRaw(entity),
          });
          savePromises.push(promise);
          savedCount++;
        }
      }

      // 并行保存所有实体
      await Promise.allSettled(savePromises);
      console.log(
        '[LocalStorage] 已读状态已保存到本地缓存,共',
        savedCount,
        '个主题',
      );
    } catch (error) {
      console.error('[LocalStorage] 保存已读状态失败:', error);
    }
  };

  /**
   * 从LocalStorage恢复已读状态
   * 注意：现在 readStatus 已经包含在实体中，从 chrome.storage.local 加载实体时会自动恢复
   * 此函数保留用于处理实体加载后的 UI 同步
   */
  const loadReadStatusFromLocalStorage = () => {
    try {
      let restoredCount = 0;

      entities.value.forEach((entity: any) => {
        if (entity.type === 'Topic' && entity.readStatus) {
          const unreadSignalCount = getTopicUnreadSignalCount(entity);
          if (entity.readStatus.unreadCount === 0 && unreadSignalCount > 0) {
            setTopicReadStatus(
              entity,
              unreadSignalCount,
              entity.readStatus?.lastUpdateTime || Date.now(),
            );
          }

          // 如果已读,清空未读讨论
          if (unreadSignalCount === 0) {
            entity.unreadDiscussions = [];
            markKnownConversationsAsRead(
              entity,
              entity.readStatus?.lastReadTime || Date.now(),
            );
          }

          restoredCount++;
        }
      });

      console.log('[LocalStorage] 已读状态已恢复,共', restoredCount, '个主题');
    } catch (error) {
      console.error('[LocalStorage] 恢复已读状态失败:', error);
    }
  };

  /**
   * 保存已关闭的今日卡片
   */
  const saveClosedCardsToLocalStorage = () => {
    try {
      const today = new Date().toDateString();
      localStorage.setItem('closed-cards-date', today);
      // 使用 toRaw 确保存储的是原始 Set 对象
      const rawClosedCards = toRaw(closedTodayCards.value);
      localStorage.setItem(
        'closed-cards',
        JSON.stringify(Array.from(rawClosedCards)),
      );
      console.log(
        '[LocalStorage] 已关闭卡片已保存,共',
        rawClosedCards.size,
        '张',
      );
    } catch (error) {
      console.error('[LocalStorage] 保存关闭卡片失败:', error);
    }
  };

  /**
   * 恢复已关闭的今日卡片
   */
  const loadClosedCardsFromLocalStorage = () => {
    try {
      const savedDate = localStorage.getItem('closed-cards-date');
      const today = new Date().toDateString();

      // 如果是新的一天,清空
      if (savedDate !== today) {
        localStorage.removeItem('closed-cards');
        localStorage.removeItem('closed-cards-date');
        console.log('[LocalStorage] 新的一天,清空已关闭卡片');
        closedTodayCards.value = new Set();
        return;
      }

      const saved = localStorage.getItem('closed-cards');
      if (saved) {
        closedTodayCards.value = new Set(JSON.parse(saved));
        console.log(
          '[LocalStorage] 已关闭卡片已恢复,共',
          closedTodayCards.value.size,
          '张',
        );
      }
    } catch (error) {
      console.error('[LocalStorage] 恢复关闭卡片失败:', error);
    }
  };

  const getDefaultTopicDeferUntil = (now = Date.now()) => {
    const tomorrowMorning = new Date(now);
    tomorrowMorning.setDate(tomorrowMorning.getDate() + 1);
    tomorrowMorning.setHours(DEFAULT_TOPIC_DEFER_HOUR, 0, 0, 0);
    return tomorrowMorning.getTime();
  };

  const normalizeTopicMuteUntil = (
    until: number | null | undefined,
    now = Date.now(),
  ): number | null => {
    if (until === null) return null;

    const requestedUntil = Number(until);
    if (Number.isFinite(requestedUntil) && requestedUntil > now) {
      return requestedUntil;
    }

    return getTopicMutePresetOptions(now)[0].until;
  };

  const saveDeferredTopicsToLocalStorage = () => {
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(
        TOPIC_DEFER_STORAGE_KEY,
        JSON.stringify(toRaw(deferredTopics.value)),
      );
    } catch (error) {
      console.error('[Topic Triage] 保存稍后主题失败:', error);
    }
  };

  const loadDeferredTopicsFromLocalStorage = () => {
    try {
      if (typeof localStorage === 'undefined') return;

      const saved = localStorage.getItem(TOPIC_DEFER_STORAGE_KEY);
      if (!saved) {
        deferredTopics.value = {};
        return;
      }

      const parsed = JSON.parse(saved) || {};
      const now = Date.now();
      const next: Record<string, _DeferredTopicState> = {};
      let prunedCount = 0;

      Object.entries(parsed).forEach(([topicId, state]: [string, any]) => {
        const until =
          typeof state === 'number' ? state : Number(state?.until || 0);
        if (!Number.isFinite(until) || until <= now) {
          prunedCount++;
          return;
        }
        const reason = normalizeTopicMuteReason(state?.reason);
        next[topicId] = {
          until,
          createdAt:
            typeof state?.createdAt === 'number' ? state.createdAt : now,
          ...(reason ? { reason } : {}),
        };
      });

      deferredTopics.value = next;
      if (prunedCount > 0) {
        saveDeferredTopicsToLocalStorage();
      }
    } catch (error) {
      console.error('[Topic Triage] 恢复稍后主题失败:', error);
      deferredTopics.value = {};
    }
  };

  const isTopicDeferred = (topicId: string, now = Date.now()) => {
    const state = deferredTopics.value[topicId];
    return Boolean(state && Number.isFinite(state.until) && state.until > now);
  };

  const getTopicDeferredState = (topicId: string) => {
    return isTopicDeferred(topicId) ? deferredTopics.value[topicId] : null;
  };

  const pruneExpiredDeferredTopics = (now = Date.now()) => {
    const next: Record<string, _DeferredTopicState> = {};
    let changed = false;

    Object.entries(deferredTopics.value).forEach(([topicId, state]) => {
      if (Number.isFinite(state.until) && state.until > now) {
        next[topicId] = state;
      } else {
        changed = true;
      }
    });

    if (changed) {
      deferredTopics.value = next;
      saveDeferredTopicsToLocalStorage();
    }

    return changed;
  };

  const refreshDeferredTopics = (now = Date.now()) => {
    const changed = pruneExpiredDeferredTopics(now);
    if (changed) {
      updateTopicUnreadCount();
    }
    return changed;
  };

  const getNextDeferredTopicReleaseAt = (now = Date.now()) => {
    let nextReleaseAt: number | null = null;

    Object.values(deferredTopics.value).forEach((state) => {
      if (!Number.isFinite(state.until) || state.until <= now) return;
      if (nextReleaseAt === null || state.until < nextReleaseAt) {
        nextReleaseAt = state.until;
      }
    });

    return nextReleaseAt;
  };

  const deferTopicForLater = async (
    topicId: string,
    until = getDefaultTopicDeferUntil(),
  ) => {
    const normalizedTopicId = String(topicId || '').trim();
    if (!normalizedTopicId) return;

    const now = Date.now();
    const requestedUntil = Number(until);
    const deferredUntil =
      Number.isFinite(requestedUntil) && requestedUntil > now
        ? requestedUntil
        : getDefaultTopicDeferUntil(now);

    deferredTopics.value = {
      ...deferredTopics.value,
      [normalizedTopicId]: {
        until: deferredUntil,
        createdAt: now,
      },
    };
    saveDeferredTopicsToLocalStorage();
    updateTopicUnreadCount();

    console.log(
      `[Topic Triage] 主题 "${normalizedTopicId}" 已稍后处理至 ${new Date(
        deferredUntil,
      ).toLocaleString()}`,
    );
  };

  const restoreDeferredTopic = (topicId: string) => {
    const normalizedTopicId = String(topicId || '').trim();
    if (!normalizedTopicId || !deferredTopics.value[normalizedTopicId]) return;

    const next = { ...deferredTopics.value };
    delete next[normalizedTopicId];
    deferredTopics.value = next;
    saveDeferredTopicsToLocalStorage();
    updateTopicUnreadCount();
    console.log(`[Topic Triage] 主题 "${normalizedTopicId}" 已恢复到未读流`);
  };

  const getDeferredTopics = () => {
    pruneExpiredDeferredTopics();

    return entities.value
      .filter((e: any) => e.type === 'Topic' && isTopicDeferred(e.id))
      .sort((a: any, b: any) => {
        const untilA = deferredTopics.value[a.id]?.until || 0;
        const untilB = deferredTopics.value[b.id]?.until || 0;
        return untilA - untilB;
      });
  };

  const saveMutedTopicsToLocalStorage = () => {
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(
        TOPIC_MUTE_STORAGE_KEY,
        JSON.stringify(toRaw(mutedTopics.value)),
      );
    } catch (error) {
      console.error('[Topic Triage] 保存静音主题失败:', error);
    }
  };

  const loadMutedTopicsFromLocalStorage = () => {
    try {
      if (typeof localStorage === 'undefined') return;

      const saved = localStorage.getItem(TOPIC_MUTE_STORAGE_KEY);
      if (!saved) {
        mutedTopics.value = {};
        return;
      }

      const parsed = JSON.parse(saved) || {};
      const now = Date.now();
      const next: Record<string, _MutedTopicState> = {};
      let prunedCount = 0;

      Object.entries(parsed).forEach(([topicId, state]: [string, any]) => {
        const until =
          state === null || state?.until === null
            ? null
            : typeof state === 'number'
            ? state
            : Number(state?.until || 0);

        if (until !== null && (!Number.isFinite(until) || until <= now)) {
          prunedCount++;
          return;
        }

        const reason = normalizeTopicMuteReason(state?.reason);
        next[topicId] = {
          until,
          createdAt:
            typeof state?.createdAt === 'number' ? state.createdAt : now,
          ...(reason ? { reason } : {}),
        };
      });

      mutedTopics.value = next;
      if (prunedCount > 0) {
        saveMutedTopicsToLocalStorage();
      }
    } catch (error) {
      console.error('[Topic Triage] 恢复静音主题失败:', error);
      mutedTopics.value = {};
    }
  };

  const isTopicMuted = (topicId: string, now = Date.now()) => {
    const state = mutedTopics.value[topicId];
    return Boolean(
      state &&
        (state.until === null ||
          (Number.isFinite(state.until) && state.until > now)),
    );
  };

  const getTopicMutedState = (topicId: string) => {
    return isTopicMuted(topicId) ? mutedTopics.value[topicId] : null;
  };

  const pruneExpiredMutedTopics = (now = Date.now()) => {
    const next: Record<string, _MutedTopicState> = {};
    let changed = false;

    Object.entries(mutedTopics.value).forEach(([topicId, state]) => {
      if (
        state.until === null ||
        (Number.isFinite(state.until) && state.until > now)
      ) {
        next[topicId] = state;
      } else {
        changed = true;
      }
    });

    if (changed) {
      mutedTopics.value = next;
      saveMutedTopicsToLocalStorage();
    }
  };

  const muteTopic = async (
    topicId: string,
    until: number | null = getTopicMutePresetOptions()[0].until,
    reason?: TopicMuteReasonKey,
  ) => {
    const normalizedTopicId = String(topicId || '').trim();
    if (!normalizedTopicId) return;

    const now = Date.now();
    const mutedUntil = normalizeTopicMuteUntil(until, now);
    const mutedReason = normalizeTopicMuteReason(reason);

    mutedTopics.value = {
      ...mutedTopics.value,
      [normalizedTopicId]: {
        until: mutedUntil,
        createdAt: now,
        ...(mutedReason ? { reason: mutedReason } : {}),
      },
    };
    saveMutedTopicsToLocalStorage();
    updateTopicUnreadCount();

    console.log(
      `[Topic Triage] 主题 "${normalizedTopicId}" 已静音${
        mutedUntil ? `至 ${new Date(mutedUntil).toLocaleString()}` : ''
      }`,
    );
  };

  const restoreMutedTopic = (topicId: string) => {
    const normalizedTopicId = String(topicId || '').trim();
    if (!normalizedTopicId || !mutedTopics.value[normalizedTopicId]) return;

    const next = { ...mutedTopics.value };
    delete next[normalizedTopicId];
    mutedTopics.value = next;
    saveMutedTopicsToLocalStorage();
    updateTopicUnreadCount();
    console.log(`[Topic Triage] 主题 "${normalizedTopicId}" 已恢复到未读流`);
  };

  const getMutedTopics = () => {
    pruneExpiredMutedTopics();

    return entities.value
      .filter((e: any) => e.type === 'Topic' && isTopicMuted(e.id))
      .sort((a: any, b: any) => {
        const untilA = mutedTopics.value[a.id]?.until;
        const untilB = mutedTopics.value[b.id]?.until;

        if (untilA === null && untilB === null) return 0;
        if (untilA === null) return 1;
        if (untilB === null) return -1;
        return (untilA || 0) - (untilB || 0);
      });
  };

  const clearConversationReadUndo = () => {
    conversationReadUndo.value = null;
    if (conversationReadUndoTimer) {
      clearTimeout(conversationReadUndoTimer);
      conversationReadUndoTimer = null;
    }
  };

  /**
   * 标记主题已读并清空所有未读消息
   */
  const markTopicAsRead = async (topicId: string) => {
    const timestamp = Date.now();
    const targets = [
      entities.value.find((e: any) => e.id === topicId),
      topicDetailData.value && (topicDetailData.value as any).id === topicId
        ? topicDetailData.value
        : null,
    ].filter((topic, index, all) => topic && all.indexOf(topic) === index);

    if (targets.length === 0) return;

    clearConversationReadUndo();
    topicReadUndo.value = {
      topicId,
      topicName: (targets[0] as any)?.name || topicId,
      capturedAt: timestamp,
      targets: targets.map((topic: any) => captureTopicReadUndoTarget(topic)),
    };
    if (topicReadUndoTimer) {
      clearTimeout(topicReadUndoTimer);
    }
    topicReadUndoTimer = setTimeout(() => {
      topicReadUndo.value = null;
      topicReadUndoTimer = null;
    }, TOPIC_READ_UNDO_WINDOW_MS);
    (topicReadUndoTimer as any)?.unref?.();

    targets.forEach((topic: any) => {
      setTopicReadStatus(topic, 0, timestamp);
      markKnownConversationsAsRead(topic, timestamp);
      if (Array.isArray(topic.unreadDiscussions)) {
        topic.unreadDiscussions = [];
      }
    });

    await Promise.allSettled(
      targets.map((topic: any) =>
        chromeAPI.sendMessage({
          type: 'CACHE_ENTITY',
          entity: toRaw(topic),
        }),
      ),
    );

    // 更新侧边栏计数
    updateTopicUnreadCount();

    const topicName = (targets[0] as any)?.name || topicId;
    console.log(`[主题阅读] "${topicName}" 已标记为已读`);
  };

  const clearTopicReadUndo = () => {
    topicReadUndo.value = null;
    if (topicReadUndoTimer) {
      clearTimeout(topicReadUndoTimer);
      topicReadUndoTimer = null;
    }
  };

  const undoLastTopicRead = async () => {
    const undoState = topicReadUndo.value;
    if (!undoState) return false;

    clearTopicReadUndo();
    undoState.targets.forEach(restoreTopicReadUndoTarget);

    await Promise.allSettled(
      undoState.targets.map((target) =>
        chromeAPI.sendMessage({
          type: 'CACHE_ENTITY',
          entity: toRaw(target.topic),
        }),
      ),
    );

    updateTopicUnreadCount();
    console.log(`[主题阅读] "${undoState.topicName}" 已恢复为未读状态`);
    return true;
  };

  /**
   * 标记单条消息已读
   */
  const markConversationAsRead = async (
    topicId: string,
    conversationId: string,
  ) => {
    const timestamp = Date.now();
    const targets = [
      entities.value.find((e: any) => e.id === topicId),
      topicDetailData.value && (topicDetailData.value as any).id === topicId
        ? topicDetailData.value
        : null,
    ].filter((topic, index, all) => topic && all.indexOf(topic) === index);

    if (targets.length === 0) return false;

    const changedTargets = targets.filter(
      (topic: any) =>
        hasUnreadConversationMatch(topic, conversationId) ||
        hasUnreadDiscussionMatch(topic, conversationId),
    );

    if (changedTargets.length === 0) return false;

    const conversationLabel = getConversationDisplayLabel(
      changedTargets[0],
      conversationId,
    );
    conversationReadUndo.value = {
      topicId,
      topicName: (changedTargets[0] as any)?.name || topicId,
      conversationId,
      conversationLabel,
      capturedAt: timestamp,
      targets: changedTargets.map((topic: any) =>
        captureTopicReadUndoTarget(topic),
      ),
    };
    if (conversationReadUndoTimer) {
      clearTimeout(conversationReadUndoTimer);
    }
    conversationReadUndoTimer = setTimeout(() => {
      conversationReadUndo.value = null;
      conversationReadUndoTimer = null;
    }, TOPIC_READ_UNDO_WINDOW_MS);
    (conversationReadUndoTimer as any)?.unref?.();

    changedTargets.forEach((topic: any) => {
      const conversationChanged = markKnownConversationAsRead(
        topic,
        conversationId,
        timestamp,
      );
      const prunedDiscussionCount = pruneReadDiscussion(topic, conversationId);
      if (!conversationChanged && prunedDiscussionCount === 0) return;

      const hasExplicitUnreadCount =
        typeof topic.readStatus?.unreadCount === 'number';
      const previousUnreadCount = hasExplicitUnreadCount
        ? topic.readStatus.unreadCount
        : 0;
      const readDelta = Math.max(
        conversationChanged ? 1 : 0,
        prunedDiscussionCount,
      );
      const unreadCount = hasExplicitUnreadCount
        ? Math.max(0, previousUnreadCount - readDelta)
        : inferUnreadCountFromTopic(topic);
      setTopicReadStatus(topic, unreadCount, timestamp);

      if (unreadCount === 0) {
        markKnownConversationsAsRead(topic, timestamp);
        if (Array.isArray(topic.unreadDiscussions)) {
          topic.unreadDiscussions = [];
        }
      }
    });

    await Promise.allSettled(
      changedTargets.map((topic: any) =>
        chromeAPI.sendMessage({
          type: 'CACHE_ENTITY',
          entity: toRaw(topic),
        }),
      ),
    );

    // 更新主题未读计数
    updateTopicUnreadCount();

    console.log(`[消息阅读] 消息 "${conversationId}" 已标记为已读`);
    return true;
  };

  const undoLastConversationRead = async () => {
    const undoState = conversationReadUndo.value;
    if (!undoState) return false;

    clearConversationReadUndo();
    undoState.targets.forEach(restoreTopicReadUndoTarget);

    await Promise.allSettled(
      undoState.targets.map((target) =>
        chromeAPI.sendMessage({
          type: 'CACHE_ENTITY',
          entity: toRaw(target.topic),
        }),
      ),
    );

    updateTopicUnreadCount();
    console.log(
      `[消息阅读] 消息 "${undoState.conversationId}" 已恢复为未读状态`,
    );
    return true;
  };

  /**
   * 关闭今日卡片
   */
  const closeTodayCard = (cardId: string) => {
    closedTodayCards.value.add(cardId);
    saveClosedCardsToLocalStorage();
    console.log(`[今日卡片] "${cardId}" 已关闭`);
  };

  /**
   * 获取未读主题列表
   */
  const getUnreadTopics = () => {
    return entities.value.filter((e: any) => {
      if (e.type !== 'Topic') return false;
      if (isTopicDeferred(e.id)) return false;
      if (isTopicMuted(e.id)) return false;
      return getTopicUnreadSignalCount(e) > 0;
    });
  };

  /**
   * 获取未读主题(按热度排序)
   */
  const getUnreadTopicsByImportance = () => {
    const unreadTopics = getUnreadTopics();
    return unreadTopics.sort((a: any, b: any) => {
      const scoreA =
        (a.importance || 0.5) + (a.statistic?.conversations || 0) / 20;
      const scoreB =
        (b.importance || 0.5) + (b.statistic?.conversations || 0) / 20;
      return scoreB - scoreA;
    });
  };

  /**
   * 获取未读主题(按最新讨论时间排序)
   */
  const getUnreadTopicsByLatestMessage = () => {
    const unreadTopics = getUnreadTopics();
    return unreadTopics.sort((a: any, b: any) => {
      const timeA = a.readStatus?.lastUpdateTime || a.updated || 0;
      const timeB = b.readStatus?.lastUpdateTime || b.updated || 0;
      return timeB - timeA;
    });
  };

  /**
   * 更新主题未读计数(在侧边栏显示)
   */
  const updateTopicUnreadCount = () => {
    const unreadCount = getUnreadTopics().length;
    const topicType = entityTypes.value.find((t) => t.type === 'Topic');
    if (topicType) {
      topicType.count = unreadCount;
    }
  };

  /**
   * ==========================================
   * 智能搜索状态管理
   * ==========================================
   */

  // 搜索上下文状态
  const searchContext = ref<{
    mode: 'overview' | 'entity' | null; // 搜索模式
    query: string; // 搜索关键词
    askResult: any | null; // ask() 的返回结果
    emptyResult: MemorySearchEmptyResultReceipt | null; // 成功空返回的诊断回执
    entityType?: string; // 如果是实体搜索，记录类型
    scope: RecallScope; // 召回范围
  }>({
    mode: null,
    query: '',
    askResult: null,
    emptyResult: null,
    scope: 'work',
  });

  const getSearchFailureMessage = (error: unknown, fallback: string) => {
    if (error instanceof Error && error.message.trim()) {
      return error.message;
    }
    if (typeof error === 'string' && error.trim()) {
      return error.trim();
    }
    if (
      error &&
      typeof error === 'object' &&
      typeof (error as any).message === 'string' &&
      (error as any).message.trim()
    ) {
      return (error as any).message.trim();
    }
    return fallback;
  };

  const readFiniteNumber = (value: unknown): number | undefined =>
    typeof value === 'number' && Number.isFinite(value) ? value : undefined;

  const getSearchResponseChannelDiagnostics = (
    response: any,
  ): RecallChannelDiagnostic[] => {
    const raw =
      response?.channelDiagnostics ||
      response?.data?.channelDiagnostics ||
      response?.result?.channelDiagnostics;
    return Array.isArray(raw)
      ? raw.filter(
          (diagnostic): diagnostic is RecallChannelDiagnostic =>
            Boolean(diagnostic && typeof diagnostic === 'object'),
        )
      : [];
  };

  const getSearchResponseQueryTimeMs = (response: any): number | undefined =>
    readFiniteNumber(response?.queryTimeMs) ??
    readFiniteNumber(response?.data?.queryTimeMs) ??
    readFiniteNumber(response?.result?.queryTimeMs);

  const getSearchResponseTotalFound = (
    response: any,
    fallback: number,
  ): number =>
    readFiniteNumber(response?.totalFound) ??
    readFiniteNumber(response?.data?.totalFound) ??
    readFiniteNumber(response?.result?.totalFound) ??
    fallback;

  /**
   * 执行智能搜索 (使用 ask() 方法)
   * 用于首页概览搜索
   */
  const performAskSearch = async (
    query: string,
    scope: RecallScope = 'work',
    askContext?: string,
    displayQuery?: string,
    continuationReceipt?: AskContinuationReceipt,
  ) => {
    const visibleQuery = displayQuery || query;
    isLoading.value = true;
    isAISearching.value = true; // 显示 AI 搜索动画
    searchContext.value.mode = 'overview';
    searchContext.value.query = visibleQuery;
    searchContext.value.scope = scope;
    searchQuery.value = visibleQuery;
    searchFailureReceipt.value = null;

    try {
      const client = getMemoryServiceClient();
      const result = await client.ask(query, askContext, true, { scope });
      const evidence = result.evidence || [];
      const channelDiagnostics = result.channelDiagnostics || [];
      searchContext.value.askResult = {
        success: true,
        answer: result.answer,
        structuredAnswer: result.structuredAnswer,
        continuationReceipt,
        contextMatch: result.contextMatch,
        answerMemory: result.answerMemory,
        scopeReceipt: result.scopeReceipt,
        cohesionReceipt: result.cohesionReceipt,
        attributionReceipt: result.attributionReceipt,
        resolutionState: result.resolutionState,
        missingInfo: result.missingInfo || [],
        followUpActions: result.followUpActions || [],
        externalEvidence: result.externalEvidence || [],
        evidenceWatch: result.evidenceWatch,
        blocks: result.blocks || [],
        channelDiagnostics,
        evidence,
        entitiesByType: {},
        metadata: {
          totalEntities: evidence.length,
          processingTime: result.queryTimeMs,
        },
      };

      // Evidence items become result cards while preserving recall-specific
      // links, scope and source metadata for the UI.
      const allEntities: any[] = evidence.map(mapRecallItemToSearchResult);
      entities.value = allEntities;
      searchContext.value.emptyResult =
        allEntities.length === 0
          ? {
              mode: 'overview',
              query: visibleQuery,
              scope,
              source: 'ask',
              totalFound: 0,
              queryTimeMs: result.queryTimeMs,
              channelDiagnostics,
              occurredAt: Date.now(),
            }
          : null;
      searchFailureReceipt.value = null;

      console.log('[智能搜索] Ask 搜索完成:', {
        query,
        scope,
        entitiesCount: allEntities.length,
        hasStructuredAnswer: !!result.structuredAnswer,
      });
    } catch (error) {
      console.error('[智能搜索] Ask 搜索异常:', error);
      entities.value = [];
      searchContext.value.askResult = null;
      searchContext.value.emptyResult = null;
      searchFailureReceipt.value = {
        mode: 'overview',
        query,
        scope,
        source: 'ask',
        message: getSearchFailureMessage(
          error,
          'Memory Service Ask 搜索请求失败。',
        ),
        occurredAt: Date.now(),
      };
    } finally {
      isLoading.value = false;
      isAISearching.value = false; // 隐藏 AI 搜索动画
    }
  };

  /**
   * 执行向量搜索 (不使用 ask())
   * 用于实体分栏搜索
   */
  const performEntityVectorSearch = async (
    query: string,
    entityType?: string,
    scope: RecallScope = 'work',
  ) => {
    isLoading.value = true;
    searchContext.value.mode = 'entity';
    searchContext.value.query = query;
    searchContext.value.entityType = entityType;
    searchContext.value.scope = scope;
    searchContext.value.askResult = null; // 清空之前的 AI 结果
    searchContext.value.emptyResult = null;
    searchQuery.value = query;
    searchFailureReceipt.value = null;

    try {
      const response = (await chromeAPI.sendMessage({
        type: 'SEARCH_ENTITIES',
        query,
        entityType, // 如果指定类型，只搜索该类型
        scope,
        limit: 30,
      })) as any;

      if (response && response.success) {
        const results = Array.isArray(response.data) ? response.data : [];
        const channelDiagnostics = getSearchResponseChannelDiagnostics(response);
        entities.value = results;
        searchContext.value.emptyResult =
          results.length === 0
            ? {
                mode: 'entity',
                query,
                scope,
                entityType,
                source: 'recall',
                totalFound: getSearchResponseTotalFound(response, 0),
                queryTimeMs: getSearchResponseQueryTimeMs(response),
                channelDiagnostics,
                occurredAt: Date.now(),
              }
            : null;
        searchFailureReceipt.value = null;
        console.log('[向量搜索] 搜索完成，获取实际数据:', {
          query,
          entityType,
          scope,
          entitiesCount: entities.value.length,
          source: response.source,
        });
      } else {
        console.warn('[向量搜索] API返回失败，不展示模拟结果');
        entities.value = [];
        searchContext.value.emptyResult = null;
        searchFailureReceipt.value = {
          mode: 'entity',
          query,
          scope,
          entityType,
          source: 'recall',
          message:
            response?.error || 'Memory Service 未返回可用的搜索结果。',
          occurredAt: Date.now(),
        };
      }
    } catch (error) {
      console.error('[向量搜索] 搜索异常:', error);
      entities.value = [];
      searchContext.value.emptyResult = null;
      searchFailureReceipt.value = {
        mode: 'entity',
        query,
        scope,
        entityType,
        source: 'recall',
        message: getSearchFailureMessage(
          error,
          'Memory Service 搜索请求失败。',
        ),
        occurredAt: Date.now(),
      };
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * 清空搜索上下文
   */
  const clearSearchContext = () => {
    searchContext.value = {
      mode: null,
      query: '',
      askResult: null,
      emptyResult: null,
      scope: 'work',
    };
    searchQuery.value = '';
    searchFailureReceipt.value = null;
  };

  return {
    isLoading,
    isAISearching,
    searchFailureReceipt,
    entityLoadFailureReceipt,
    searchQuery,
    entities,
    entityTypes,
    overviewStats,
    topicDetailData,
    personDetailData,
    closedTodayCards,
    deferredTopics,
    mutedTopics,
    topicReadUndo,
    conversationReadUndo,
    initialize,
    loadEntitiesByType,
    searchEntities,
    vectorSearchEntities,
    loadTopicDetail,
    markTopicAsRead,
    markConversationAsRead,
    deferTopicForLater,
    restoreDeferredTopic,
    refreshDeferredTopics,
    getNextDeferredTopicReleaseAt,
    muteTopic,
    restoreMutedTopic,
    undoLastTopicRead,
    clearTopicReadUndo,
    undoLastConversationRead,
    clearConversationReadUndo,
    closeTodayCard,
    getUnreadTopics,
    getDeferredTopics,
    getMutedTopics,
    getUnreadTopicsByImportance,
    getUnreadTopicsByLatestMessage,
    isTopicDeferred,
    getTopicDeferredState,
    isTopicMuted,
    getTopicMutedState,
    updateTopicUnreadCount,
    // 智能搜索相关
    searchContext,
    performAskSearch,
    performEntityVectorSearch,
    clearSearchContext,
  };
});
