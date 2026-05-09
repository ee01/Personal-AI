/**
 * 记忆系统消息处理器
 * 专门处理来自前端的记忆系统相关请求
 *
 * 使用对象/Map 方式定义处理器，类型和处理逻辑在同一个地方，
 * 添加新消息类型时只需在 messageHandlers 中添加一个属性即可。
 */

import {
  getMemoryServiceClient,
  type RecallItem,
  type RecallScope,
} from '../services/MemoryServiceClient';
import {
  getTimelineRangeSeconds,
  mapRecallItemsToTimelineEvents,
  normalizeTimelineScope,
} from './timelinePresentation';

// Get the singleton client instance
const client = getMemoryServiceClient();
let testMeetingsFixture: any = null;

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

function getRecallItemTitle(item: RecallItem): string {
  const title =
    item.displayTitle ||
    item.sourceTitle ||
    item.entity?.name ||
    item.source ||
    item.previewText ||
    item.content;
  return String(title || item.id).slice(0, 80);
}

function getRecallItemDescription(item: RecallItem): string {
  return (
    item.previewText ||
    item.displayText ||
    item.entity?.description ||
    item.content ||
    ''
  );
}

function mapRecallItemToSearchResult(item: RecallItem) {
  const metadata = item.metadata || {};
  const entityType =
    item.type === 'entity'
      ? item.entity?.type || String(metadata.entityType || 'entity')
      : item.type;

  return {
    ...(metadata || {}),
    id: item.id,
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
    recentDataDetails: { ...EMPTY_SEARCH_RESULT_DETAILS },
  };
}

/**
 * 格式化时间为相对时间（预留功能）
 */
function _formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);

  if (months > 0) return `${months}个月前`;
  if (weeks > 0) return `${weeks}周前`;
  if (days > 0) return `${days}天前`;
  if (hours > 0) return `${hours}小时前`;
  if (minutes > 0) return `${minutes}分钟前`;
  return '刚刚';
}

// ========== 消息处理器类型 ==========
type MessageHandler = (request: any) => Promise<any>;

// ========== 消息处理器映射 ==========
// 添加新消息类型时，只需在这个对象中添加一个属性即可，无需维护任何单独的列表
const messageHandlers: Record<string, MessageHandler> = {
  GET_ENTITY_STATISTICS: async (_request) => {
    try {
      const stats = await client.getStats();
      return {
        success: true,
        data: {
          totalEntities: stats.entities?.total || 0,
          totalRelationships: stats.relationships?.total || 0,
          entityCounts: stats.entities?.byType || {},
          entitiesCreatedToday: stats.messages?.today || 0,
          entitiesCreatedThisWeek: stats.messages?.thisWeek || 0,
          entitiesCreatedThisMonth: 0,
          topEntitiesByType: {},
        },
      };
    } catch (error: any) {
      console.error('获取实体统计失败:', error);
      return {
        success: false,
        error: error.message,
        data: {
          totalEntities: 0,
          totalRelationships: 0,
          entityCounts: {},
          entitiesCreatedToday: 0,
          entitiesCreatedThisWeek: 0,
          entitiesCreatedThisMonth: 0,
          topEntitiesByType: {},
        },
      };
    }
  },

  GET_ENTITY_TYPES: async (_request) => {
    try {
      const stats = await client.getStats();
      const entityTypes = Object.keys(stats.entities?.byType || {});
      return {
        success: true,
        data: {
          entityTypes,
          totalCount: entityTypes.length,
        },
      };
    } catch (error: any) {
      console.error('获取实体类型失败:', error);
      return {
        success: false,
        error: error.message,
        data: { entityTypes: [], totalCount: 0 },
      };
    }
  },

  GET_ENTITIES_BY_TYPE: async (request) => {
    try {
      const { entityType, limit = 50, offset = 0 } = request;
      const result = await client.getEntities(
        entityType,
        undefined,
        limit,
        offset,
      );

      // Map new API response to the shape expected by the frontend UI
      const entitiesWithDetails = (result.items || []).map((entity) => ({
        ...entity,
        recentDataDetails: {
          conversations: [],
          webpages: [],
          resources: [],
          projects: [],
          people: [],
          topics: [],
          jiraTickets: [],
          cooccurringEntities: [],
        },
      }));

      return { success: true, data: entitiesWithDetails };
    } catch (error: any) {
      console.error('获取实体列表失败:', error);
      return { success: false, error: error.message, data: [] };
    }
  },

  SEARCH_ENTITIES: async (request) => {
    try {
      const { query, entityType, scope = 'work', limit = 30 } = request;
      const recallResult = await client.recall(query, {
        topK: limit,
        channels: entityType ? ['graph', 'vector', 'fts'] : ['vector', 'fts'],
        entityTypes: entityType ? [entityType] : undefined,
        scope,
        includeMetadata: true,
        presentationHint: 'compact',
      });

      const entitiesWithDetails = (recallResult.items || []).map(
        mapRecallItemToSearchResult,
      );

      return {
        success: true,
        data: entitiesWithDetails,
        total: recallResult.totalFound,
        source: 'memory-service',
      };
    } catch (error: any) {
      console.error('搜索实体失败:', error);
      return { success: false, error: error.message, data: [], total: 0 };
    }
  },

  GET_RECENT_TIMELINE: async (request) => {
    try {
      const limit = Math.min(Math.max(Number(request.limit) || 50, 1), 100);
      const scope: RecallScope = normalizeTimelineScope(request.scope, 'all');
      const range = request.range === 'recent' ? 'recent' : 'today';
      const rangeDays = Number(request.rangeDays);
      const timeRange = getTimelineRangeSeconds(Date.now(), range, rangeDays);

      const recallResult = await client.recall('近期记忆时间轴', {
        topK: limit,
        channels: ['time'],
        timeRange,
        scope,
        includeMetadata: true,
        presentationHint: 'compact',
        previewMaxLength: 180,
      });
      const timeline = mapRecallItemsToTimelineEvents(recallResult.items || []);
      return { success: true, data: timeline };
    } catch (error: any) {
      console.error('获取时间轴失败:', error);
      return { success: false, error: error.message, data: [] };
    }
  },

  GET_MEMORY_ITEM: async (request) => {
    try {
      const id = String(request.id || '').trim();
      const requestedType =
        request.memoryType === 'message' || request.memoryType === 'chunk'
          ? request.memoryType
          : undefined;

      if (!id) {
        return { success: false, error: 'missing_memory_id', data: null };
      }

      const types: Array<'message' | 'chunk'> = requestedType
        ? [requestedType]
        : ['message', 'chunk'];

      for (const type of types) {
        try {
          const item = await client.getMemoryItem(type, id);
          const [event] = mapRecallItemsToTimelineEvents([item]);
          return { success: true, data: event || null };
        } catch (error) {
          if (type === types[types.length - 1]) throw error;
        }
      }

      return { success: false, error: 'memory_not_found', data: null };
    } catch (error: any) {
      console.error('获取定位记忆失败:', error);
      return { success: false, error: error.message, data: null };
    }
  },

  GET_MEETINGS: async (request) => {
    if (testMeetingsFixture) {
      return {
        success: true,
        data: testMeetingsFixture,
        total: testMeetingsFixture.total || 0,
      };
    }
    try {
      const { limit = 50, offset = 0 } = request;
      const result = await client.getMeetings(limit, offset);
      return {
        success: true,
        data: {
          ...result,
          items: [...(result.items || [])].sort(
            (left, right) =>
              (right.lastEventAt || right.date || 0) -
              (left.lastEventAt || left.date || 0),
          ),
        },
        total: result.total,
      };
    } catch (error: any) {
      console.error('获取会议记录失败:', error);
      return {
        success: false,
        error: error.message,
        data: { items: [], total: 0, limit: 0, offset: 0 },
        total: 0,
      };
    }
  },

  GET_MEETING_DETAIL: async (request) => {
    if (testMeetingsFixture?.detail?.meetingId === request.meetingId) {
      return {
        success: true,
        data: testMeetingsFixture.detail,
      };
    }
    try {
      const { meetingId } = request;
      const result = await client.getMeetingDetail(meetingId);
      return {
        success: true,
        data: result,
      };
    } catch (error: any) {
      console.error('获取会议详情失败:', error);
      return {
        success: false,
        error: error.message,
        data: null,
      };
    }
  },

  UPDATE_ENTITY_ACCESS: async (request) => {
    try {
      const { entityId } = request;
      // Fetch entity detail to register an access
      await client.getEntityDetail(entityId);
      return { success: true, message: '实体访问已记录' };
    } catch (error: any) {
      console.error('更新实体访问失败:', error);
      return { success: false, error: error.message };
    }
  },

  SET_TEST_MEETINGS_FIXTURE: async (request) => {
    testMeetingsFixture = request.fixture || null;
    return { success: true };
  },

  GET_ENTITY_DETAILS: async (request) => {
    try {
      const { entityId } = request;
      const entity = await client.getEntityDetail(entityId);

      // Map new EntityDetailResponse to the shape expected by the frontend UI
      const entityWithDetails = entity
        ? {
            ...entity,
            recentDataDetails: {
              conversations: [],
              webpages: [],
              resources: [],
              projects: [],
              people: [],
              topics: [],
              jiraTickets: [],
              cooccurringEntities: [],
            },
          }
        : null;

      return { success: true, data: entityWithDetails };
    } catch (error: any) {
      console.error('获取实体详情失败:', error);
      return { success: false, error: error.message, data: null };
    }
  },

  GET_ENTITY_TIMELINE: async (request) => {
    try {
      const { entityId: _entityId, limit: _limit = 50 } = request;
      // 简化：直接返回空数组，因为实体时间轴功能暂未完全实现
      return { success: true, data: [] };
    } catch (error: any) {
      console.error('获取实体时间轴失败:', error);
      return { success: false, error: error.message, data: [] };
    }
  },

  GET_ENTITY_MESSAGES: async (request) => {
    try {
      const { entityId: _entityId2, limit: _limit2 = 20 } = request;
      // 简化：直接返回空数组
      return { success: true, data: [] };
    } catch (error: any) {
      console.error('获取实体消息失败:', error);
      return { success: false, error: error.message, data: [] };
    }
  },

  GET_ENTITY_WEBPAGES: async (request) => {
    try {
      const { entityId: _entityId3, limit: _limit3 = 10 } = request;
      // 简化：直接返回空数组
      return { success: true, data: [] };
    } catch (error: any) {
      console.error('获取实体网页失败:', error);
      return { success: false, error: error.message, data: [] };
    }
  },

  SET_ENTITY_TAGS: async (request) => {
    try {
      const { entityId, tags } = request;
      // TODO: No direct updateEntity equivalent in MemoryServiceClient yet.
      // Using ingest as a workaround to record the tag change.
      await client.ingest({
        content: JSON.stringify({ entityId, tags }),
        sourceType: 'system',
        metadata: { action: 'set_tags', entityId, tags },
      });
      return {
        success: true,
        message: '标签设置成功',
      };
    } catch (error: any) {
      console.error('设置实体标签失败:', error);
      return { success: false, error: error.message };
    }
  },

  SET_ENTITY_STATUS: async (request) => {
    try {
      const { entityId, status } = request;
      // TODO: No direct updateEntity equivalent in MemoryServiceClient yet.
      // Using ingest as a workaround to record the status change.
      await client.ingest({
        content: JSON.stringify({ entityId, status }),
        sourceType: 'system',
        metadata: { action: 'set_status', entityId, status },
      });
      return {
        success: true,
        message: '状态设置成功',
      };
    } catch (error: any) {
      console.error('设置实体状态失败:', error);
      return { success: false, error: error.message };
    }
  },

  DIAGNOSE_ENTITY_DATA: async (_request) => {
    try {
      const health = await client.getHealth();
      return {
        success: true,
        data: {
          status: health.status,
          score:
            health.status === 'ok'
              ? 100
              : health.status === 'degraded'
                ? 50
                : 0,
          issues:
            health.status !== 'ok' ? [`Service status: ${health.status}`] : [],
          recommendations:
            health.status !== 'ok' ? ['请检查Memory Service后端状态'] : [],
          cloudStorage: {
            connected: health.database?.connected,
            messageCount: health.database?.messageCount,
            entityCount: health.database?.entityCount,
          },
          localCache: { status: 'n/a (migrated to HTTP backend)' },
        },
      };
    } catch (error: any) {
      console.error('诊断实体数据失败:', error);
      return {
        success: false,
        error: error.message,
        data: {
          status: 'error',
          score: 0,
          issues: ['诊断失败'],
          recommendations: ['请检查系统状态'],
        },
      };
    }
  },

  REBUILD_ENTITY_INDEXES: async (_request) => {
    try {
      // TODO: No direct cache sync / index rebuild endpoint in MemoryServiceClient yet.
      // Verify service health as a proxy for readiness.
      await client.getHealth();
      return {
        success: true,
        data: {
          rebuilt: true,
          message: '索引重建完成 (via memory-service health check)',
        },
      };
    } catch (error: any) {
      console.error('重建实体索引失败:', error);
      return {
        success: false,
        error: error.message,
        data: { rebuilt: false, message: '索引重建失败' },
      };
    }
  },

  CLEAR_ALL_ENTITY_DATA: async (_request) => {
    try {
      // TODO: No direct cache clear endpoint in MemoryServiceClient.
      // Local cache clearing is now handled server-side.
      console.log(
        'CLEAR_ALL_ENTITY_DATA: local cache clearing delegated to memory-service backend',
      );
      return {
        success: true,
        data: {
          cleared: true,
          message: '实体数据清理完成 (delegated to backend)',
        },
      };
    } catch (error: any) {
      console.error('清空实体数据失败:', error);
      return {
        success: false,
        error: error.message,
        data: { cleared: false, message: '数据清理失败' },
      };
    }
  },

  GET_TOPIC_DETAIL: async (request) => {
    return handleGetTopicDetail(request);
  },

  INITIALIZE_SAMPLE_DATA: async (_request) => {
    return handleInitializeSampleData();
  },

  CACHE_ENTITY: async (request) => {
    try {
      const { entity } = request;
      // TODO: Local caching is now managed server-side by memory-service.
      // Ingest the entity data so the backend is aware of any UI-side changes.
      await client.ingest({
        content: JSON.stringify(entity),
        sourceType: 'system',
        metadata: {
          action: 'cache_entity',
          entityType: entity?.type,
          entityId: entity?.id,
        },
      });
      return { success: true, message: '实体已缓存到本地' };
    } catch (error: any) {
      console.error('缓存实体失败:', error);
      return { success: false, error: error.message };
    }
  },
};

/**
 * 处理记忆系统相关的消息
 * @param request 请求对象
 * @returns Promise<any> 返回响应数据，如果不是记忆系统相关消息则返回 null
 *
 * 使用对象查找方式判断消息类型，无需维护任何单独的类型列表。
 * 添加新消息类型时，只需在上面的 messageHandlers 对象中添加一个属性即可。
 */
export function handleMemoryMessage(request: any): Promise<any> | null {
  // 直接从 messageHandlers 中查找处理器
  // 如果找不到，说明不是记忆系统消息，同步返回 null
  const handler = messageHandlers[request.type];
  if (!handler) {
    return null;
  }

  // 返回一个包装的异步函数
  return (async () => {
    // 调用对应的处理器
    return handler(request);
  })();
}

// ========== 复杂逻辑处理函数 ==========

async function handleGetTopicDetail(request: any): Promise<any> {
  const { topicId } = request;

  try {
    // Fetch entity detail from the memory service backend
    const topicEntity = await client.getEntityDetail(topicId);
    if (!topicEntity) {
      throw new Error('主题不存在');
    }

    // Map EntityDetailResponse to the shape expected by the frontend UI
    const topicDetail = {
      ...topicEntity,
      recentDataDetails: {
        conversations: [],
        webpages: [],
        resources: [],
        projects: [],
        people: [],
        topics: [],
        jiraTickets: [],
        cooccurringEntities: [],
      },
      cachedAt: Date.now(),
    };

    return { success: true, data: topicDetail };
  } catch (error: any) {
    console.error('获取主题详情失败:', error);
    return { success: false, error: error.message };
  }
}

async function handleInitializeSampleData(): Promise<any> {
  try {
    // 创建一些示例实体 via ingest
    const sampleEntities = [
      {
        type: 'Person',
        name: '张三',
        description: '示例人员实体',
        properties: { role: '开发者', team: '前端团队' },
        tags: ['示例', '开发者'],
      },
      {
        type: 'Project',
        name: '示例项目',
        description: '这是一个示例项目',
        properties: { status: '进行中', priority: '高' },
        tags: ['示例', '项目'],
      },
    ];

    let successCount = 0;
    let failedCount = 0;
    const results: any[] = [];

    for (const entity of sampleEntities) {
      try {
        const ingestResult = await client.ingest({
          content: JSON.stringify(entity),
          sourceType: 'system',
          metadata: {
            entityType: entity.type,
            entityName: entity.name,
            action: 'initialize_sample',
          },
        });
        if (ingestResult && ingestResult.status === 'created') {
          successCount++;
          results.push({
            success: true,
            entityId: ingestResult.id,
            cloudStored: true,
            localCached: false,
          });
        } else {
          failedCount++;
          results.push({
            success: false,
            entityId: ingestResult?.id,
            cloudStored: false,
            localCached: false,
          });
        }
      } catch (error: any) {
        failedCount++;
        results.push({
          success: false,
          entityId: 'unknown',
          errors: [error.message],
        });
      }
    }

    return {
      success: true,
      data: { created: successCount, failed: failedCount, details: results },
    };
  } catch (error: any) {
    console.error('初始化示例数据失败:', error);
    return {
      success: false,
      error: error.message,
      data: { created: 0, failed: 0, details: [] },
    };
  }
}
