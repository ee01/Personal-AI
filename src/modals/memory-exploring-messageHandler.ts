/**
 * 记忆系统消息处理器
 * 专门处理来自前端的记忆系统相关请求
 * 
 * 使用对象/Map 方式定义处理器，类型和处理逻辑在同一个地方，
 * 添加新消息类型时只需在 messageHandlers 中添加一个属性即可。
 */

import { memorySystem } from '../memory';
import { CloudStorage } from '../storage/CloudStorage';
import { LocalStorage } from '../storage/LocalStorage';

// 创建存储层实例
const cloudStorage = new CloudStorage();
const localStorage = new LocalStorage();

// 存储层初始化状态
let storageInitialized = false;

/**
 * 确保存储层已初始化
 */
async function ensureStorageInitialized(): Promise<void> {
    if (!storageInitialized) {
        await cloudStorage.initialize();
        await localStorage.initialize();
        storageInitialized = true;
    }
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
    
    'GET_ENTITY_STATISTICS': async (_request) => {
        try {
            const stats = await localStorage.getEntityStatistics();
            return { success: true, data: stats };
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
                    topEntitiesByType: {}
                }
            };
        }
    },

    'GET_ENTITY_TYPES': async (_request) => {
        try {
            await memorySystem.initialize();
            const entityTypes = await memorySystem.getEntityTypes();
            return {
                success: true,
                data: {
                    entityTypes,
                    totalCount: entityTypes.length
                }
            };
        } catch (error: any) {
            console.error('获取实体类型失败:', error);
            return {
                success: false,
                error: error.message,
                data: { entityTypes: [], totalCount: 0 }
            };
        }
    },

    'GET_ENTITIES_BY_TYPE': async (request) => {
        try {
            const { entityType, limit = 50, offset = 0, sortBy = 'importance', sortOrder = 'desc' } = request;
            const result = await cloudStorage.queryEntities(entityType, undefined, {
                limit, offset, sortBy, sortOrder
            });
            
            // 将 relatedData 映射到 recentDataDetails，供前端 UI 使用
            const entitiesWithDetails = result.data.map(entity => ({
                ...entity,
                recentDataDetails: entity.relatedData || {
                    conversations: [],
                    webpages: [],
                    resources: [],
                    projects: [],
                    people: [],
                    topics: [],
                    jiraTickets: [],
                    cooccurringEntities: []
                }
            }));
            
            return { success: true, data: entitiesWithDetails };
        } catch (error: any) {
            console.error('获取实体列表失败:', error);
            return { success: false, error: error.message, data: [] };
        }
    },

    'SEARCH_ENTITIES': async (request) => {
        try {
            const { query, entityType, limit = 30 } = request;
            const searchResults = await cloudStorage.searchByVector(query, entityType, { limit });
            
            // 将 relatedData 映射到 recentDataDetails，供前端 UI 使用
            const entitiesWithDetails = searchResults.data.map(entity => ({
                ...entity,
                recentDataDetails: entity.relatedData || {
                    conversations: [],
                    webpages: [],
                    resources: [],
                    projects: [],
                    people: [],
                    topics: [],
                    jiraTickets: [],
                    cooccurringEntities: []
                }
            }));
            
            return {
                success: true,
                data: entitiesWithDetails,
                total: searchResults.total,
                source: searchResults.source
            };
        } catch (error: any) {
            console.error('搜索实体失败:', error);
            return { success: false, error: error.message, data: [], total: 0 };
        }
    },

    'GET_RECENT_TIMELINE': async (request) => {
        try {
            const { limit = 50 } = request;
            const timeline = await cloudStorage.getTimeline(limit);
            return { success: true, data: timeline };
        } catch (error: any) {
            console.error('获取时间轴失败:', error);
            return { success: false, error: error.message, data: [] };
        }
    },

    'UPDATE_ENTITY_ACCESS': async (request) => {
        try {
            const { entityId } = request;
            await cloudStorage.getEntity(entityId);
            return { success: true, message: '实体访问已记录' };
        } catch (error: any) {
            console.error('更新实体访问失败:', error);
            return { success: false, error: error.message };
        }
    },

    'GET_ENTITY_DETAILS': async (request) => {
        try {
            const { entityId } = request;
            const entity = await cloudStorage.getEntity(entityId);
            
            // 将 relatedData 映射到 recentDataDetails，供前端 UI 使用
            const entityWithDetails = entity ? {
                ...entity,
                recentDataDetails: entity.relatedData || {
                    conversations: [],
                    webpages: [],
                    resources: [],
                    projects: [],
                    people: [],
                    topics: [],
                    jiraTickets: [],
                    cooccurringEntities: []
                }
            } : null;
            
            return { success: true, data: entityWithDetails };
        } catch (error: any) {
            console.error('获取实体详情失败:', error);
            return { success: false, error: error.message, data: null };
        }
    },

    'GET_ENTITY_TIMELINE': async (request) => {
        try {
            const { entityId: _entityId, limit: _limit = 50 } = request;
            // 简化：直接返回空数组，因为实体时间轴功能暂未完全实现
            return { success: true, data: [] };
        } catch (error: any) {
            console.error('获取实体时间轴失败:', error);
            return { success: false, error: error.message, data: [] };
        }
    },

    'GET_ENTITY_MESSAGES': async (request) => {
        try {
            const { entityId: _entityId2, limit: _limit2 = 20 } = request;
            // 简化：直接返回空数组
            return { success: true, data: [] };
        } catch (error: any) {
            console.error('获取实体消息失败:', error);
            return { success: false, error: error.message, data: [] };
        }
    },

    'GET_ENTITY_WEBPAGES': async (request) => {
        try {
            const { entityId: _entityId3, limit: _limit3 = 10 } = request;
            // 简化：直接返回空数组
            return { success: true, data: [] };
        } catch (error: any) {
            console.error('获取实体网页失败:', error);
            return { success: false, error: error.message, data: [] };
        }
    },

    'SET_ENTITY_TAGS': async (request) => {
        try {
            const { entityId, tags } = request;
            const result = await cloudStorage.updateEntity(entityId, { tags });
            return {
                success: result,
                message: result ? '标签设置成功' : '标签设置失败'
            };
        } catch (error: any) {
            console.error('设置实体标签失败:', error);
            return { success: false, error: error.message };
        }
    },

    'SET_ENTITY_STATUS': async (request) => {
        try {
            const { entityId, status } = request;
            const result = await cloudStorage.updateEntity(entityId, { status });
            return {
                success: result,
                message: result ? '状态设置成功' : '状态设置失败'
            };
        } catch (error: any) {
            console.error('设置实体状态失败:', error);
            return { success: false, error: error.message };
        }
    },

    'DIAGNOSE_ENTITY_DATA': async (_request) => {
        try {
            await memorySystem.initialize();
            const healthStatus = await memorySystem.performHealthCheck();
            return {
                success: true,
                data: {
                    status: healthStatus.overall.status,
                    score: healthStatus.overall.score,
                    issues: healthStatus.overall.issues,
                    recommendations: healthStatus.overall.recommendations,
                    cloudStorage: healthStatus.cloudStorage,
                    localCache: healthStatus.localCache
                }
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
                    recommendations: ['请检查系统状态']
                }
            };
        }
    },

    'REBUILD_ENTITY_INDEXES': async (_request) => {
        try {
            await memorySystem.initialize();
            await memorySystem.syncCache();
            return {
                success: true,
                data: { rebuilt: true, message: '索引重建完成' }
            };
        } catch (error: any) {
            console.error('重建实体索引失败:', error);
            return {
                success: false,
                error: error.message,
                data: { rebuilt: false, message: '索引重建失败' }
            };
        }
    },

    'CLEAR_ALL_ENTITY_DATA': async (_request) => {
        try {
            await localStorage.clearExpiredCache();
            return {
                success: true,
                data: { cleared: true, message: '实体数据清理完成' }
            };
        } catch (error: any) {
            console.error('清空实体数据失败:', error);
            return {
                success: false,
                error: error.message,
                data: { cleared: false, message: '数据清理失败' }
            };
        }
    },

    'GET_TOPIC_DETAIL': async (request) => {
        return handleGetTopicDetail(request);
    },

    'INITIALIZE_SAMPLE_DATA': async (_request) => {
        return handleInitializeSampleData();
    },

    'CACHE_ENTITY': async (request) => {
        try {
            const { entity } = request;
            await localStorage.cacheEntity(entity);
            return { success: true, message: '实体已缓存到本地' };
        } catch (error: any) {
            console.error('缓存实体失败:', error);
            return { success: false, error: error.message };
        }
    }
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
        // 确保存储层已初始化
        await ensureStorageInitialized();
        
        // 调用对应的处理器
        return handler(request);
    })();
}

// ========== 复杂逻辑处理函数 ==========

async function handleGetTopicDetail(request: any): Promise<any> {
    const { topicId } = request;
    
    try {
        await memorySystem.initialize();
        // 优先从本地缓存获取主题详情
        const cachedDetails = await memorySystem.getEntityDetails(topicId);
        if (cachedDetails) {
            return { success: true, data: cachedDetails };
        }

        // 获取主题基础信息
        const topicEntity = await cloudStorage.getEntity(topicId);
        if (!topicEntity) {
            throw new Error('主题不存在');
        }

        // 直接使用 relatedData 映射为 recentDataDetails，不需要额外抓取
        const topicDetail = {
            ...topicEntity,
            recentDataDetails: topicEntity.relatedData || {
                conversations: [],
                webpages: [],
                resources: [],
                projects: [],
                people: [],
                topics: [],
                jiraTickets: [],
                cooccurringEntities: []
            },
            cachedAt: Date.now()
        };

        // 缓存主题详情
        await localStorage.cacheEntity(topicDetail);

        return { success: true, data: topicDetail };
    } catch (error: any) {
        console.error('获取主题详情失败:', error);
        return { success: false, error: error.message };
    }
}

async function handleInitializeSampleData(): Promise<any> {
    try {
        // 创建一些示例实体（添加必需的 relatedData 字段）
        const sampleEntities = [
            {
                type: 'Person' as const,
                name: '张三',
                description: '示例人员实体',
                properties: { role: '开发者', team: '前端团队' },
                importance: 0.8,
                accessCount: 0,
                lastAccessed: Date.now(),
                tags: ['示例', '开发者'],
                statistic: {
                    conversations: 5,
                    projects: 2,
                    participants: 1,
                    resources: 3,
                    documents: 2,
                    webpages: 1,
                    relationships: 4,
                    topics: 0,
                    jiraTickets: 0
                },
                relatedData: {
                    conversations: [] as any[],
                    webpages: [] as any[],
                    resources: [] as any[],
                    projects: [] as any[],
                    people: [] as any[],
                    topics: [] as any[],
                    jiraTickets: [] as any[],
                    cooccurringEntities: [] as any[]
                }
            },
            {
                type: 'Project' as const,
                name: '示例项目',
                description: '这是一个示例项目',
                properties: { status: '进行中', priority: '高' },
                importance: 0.9,
                accessCount: 0,
                lastAccessed: Date.now(),
                tags: ['示例', '项目'],
                statistic: {
                    conversations: 12,
                    projects: 1,
                    participants: 8,
                    resources: 15,
                    documents: 10,
                    webpages: 5,
                    relationships: 6,
                    topics: 0,
                    jiraTickets: 0
                },
                relatedData: {
                    conversations: [] as any[],
                    webpages: [] as any[],
                    resources: [] as any[],
                    projects: [] as any[],
                    people: [] as any[],
                    topics: [] as any[],
                    jiraTickets: [] as any[],
                    cooccurringEntities: [] as any[]
                }
            }
        ];

        let successCount = 0;
        let failedCount = 0;
        const results: any[] = [];

        for (const entity of sampleEntities) {
            try {
                // 生成实体ID
                const fullEntity = { ...entity, created: Date.now(), updated: Date.now() };
                
                const entityId = await cloudStorage.storeEntity(fullEntity as any);
                if (entityId) {
                    await localStorage.cacheEntity(fullEntity as any);
                    successCount++;
                    results.push({ success: true, entityId, cloudStored: true, localCached: true });
                } else {
                    failedCount++;
                    results.push({ success: false, entityId, cloudStored: false, localCached: false });
                }
            } catch (error: any) {
                failedCount++;
                results.push({ success: false, entityId: 'unknown', errors: [error.message] });
            }
        }
        
        return {
            success: true,
            data: { created: successCount, failed: failedCount, details: results }
        };
    } catch (error: any) {
        console.error('初始化示例数据失败:', error);
        return {
            success: false,
            error: error.message,
            data: { created: 0, failed: 0, details: [] }
        };
    }
}
