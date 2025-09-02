/**
 * 记忆系统消息处理器
 * 专门处理来自前端的记忆系统相关请求
 */

import { memorySystem } from './memory';
import { CloudStorage, MemoryEntity } from './storage/CloudStorage';
import { LocalStorage } from './storage/LocalStorage';

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
        await memorySystem.initialize();
        storageInitialized = true;
    }
}

/**
 * 格式化时间为相对时间
 */
function formatTimeAgo(timestamp: number): string {
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

/**
 * 处理记忆系统相关的消息
 * @param request 请求对象
 * @returns Promise<any> 返回响应数据，如果不是记忆系统相关消息则返回 null
 */
export function handleMemoryMessage(request: any): Promise<any> | null {
    // 返回一个包装的异步函数
    return (async () => {
        // 确保存储层已初始化
        await ensureStorageInitialized();

        switch (request.type) {
            case 'GET_ENTITY_STATISTICS':
                try {
                    const stats = await localStorage.getEntityStatistics();
                    return { success: true, data: stats };
                } catch (error) {
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

            case 'GET_ENTITY_TYPES':
                try {
                    const entityTypes = await memorySystem.getEntityTypes();
                    return {
                        success: true,
                        data: {
                            entityTypes,
                            totalCount: entityTypes.length
                        }
                    };
                } catch (error) {
                    console.error('获取实体类型失败:', error);
                    return {
                    success: false,
                    error: error.message,
                        data: { entityTypes: [], totalCount: 0 }
                    };
                }

            case 'GET_ENTITIES_BY_TYPE':
                try {
                    const { entityType, limit = 50, offset = 0, sortBy = 'importance', sortOrder = 'desc' } = request;
                    const result = await cloudStorage.queryEntities(entityType, undefined, {
                        limit, offset, sortBy, sortOrder
                    });
                    return { success: true, data: result.data };
                } catch (error) {
                    console.error('获取实体列表失败:', error);
                    return { success: false, error: error.message, data: [] };
                }

            case 'SEARCH_ENTITIES':
                try {
                    const { query, entityType, limit = 30 } = request;
                    const searchResults = await cloudStorage.searchByVector(query, entityType, { limit });
                    return {
                        success: true,
                        data: searchResults.data,
                        total: searchResults.total,
                        source: searchResults.source
                    };
                } catch (error) {
                    console.error('搜索实体失败:', error);
                    return { success: false, error: error.message, data: [], total: 0 };
                }

            case 'GET_RECENT_TIMELINE':
                try {
                    const { limit = 50 } = request;
                    const timeline = await cloudStorage.getTimeline(limit);
                    return { success: true, data: timeline };
                } catch (error) {
                    console.error('获取时间轴失败:', error);
                    return { success: false, error: error.message, data: [] };
                }

            case 'UPDATE_ENTITY_ACCESS':
                try {
                    const { entityId } = request;
                    await cloudStorage.getEntity(entityId);
                    return { success: true, message: '实体访问已记录' };
                } catch (error) {
                    console.error('更新实体访问失败:', error);
                    return { success: false, error: error.message };
                }

            case 'GET_ENTITY_DETAILS':
                try {
                    const { entityId } = request;
                    const entityDetails = await cloudStorage.getEntity(entityId);
                    return { success: true, data: entityDetails };
                } catch (error) {
                    console.error('获取实体详情失败:', error);
                    return { success: false, error: error.message, data: null };
                }

            case 'GET_ENTITY_TIMELINE':
                try {
                    const { entityId, limit = 50 } = request;
                    // 简化：直接返回空数组，因为实体时间轴功能暂未完全实现
                    return { success: true, data: [] };
        } catch (error) {
            console.error('获取实体时间轴失败:', error);
                    return { success: false, error: error.message, data: [] };
                }

            case 'GET_ENTITY_MESSAGES':
                try {
                    const { entityId, limit = 20 } = request;
                    // 简化：直接返回空数组
                    return { success: true, data: [] };
        } catch (error) {
            console.error('获取实体消息失败:', error);
                    return { success: false, error: error.message, data: [] };
                }

            case 'GET_ENTITY_WEBPAGES':
                try {
                    const { entityId, limit = 10 } = request;
                    // 简化：直接返回空数组
                    return { success: true, data: [] };
        } catch (error) {
            console.error('获取实体网页失败:', error);
                    return { success: false, error: error.message, data: [] };
                }

            case 'SET_ENTITY_TAGS':
                try {
        const { entityId, tags } = request;
                    const result = await cloudStorage.updateEntity(entityId, { tags });
            return {
                        success: result,
                        message: result ? '标签设置成功' : '标签设置失败'
            };
        } catch (error) {
            console.error('设置实体标签失败:', error);
                    return { success: false, error: error.message };
                }

            case 'SET_ENTITY_STATUS':
                try {
        const { entityId, status } = request;
                    const result = await cloudStorage.updateEntity(entityId, { status });
            return {
                        success: result,
                        message: result ? '状态设置成功' : '状态设置失败'
            };
        } catch (error) {
            console.error('设置实体状态失败:', error);
                    return { success: false, error: error.message };
                }

            case 'DIAGNOSE_ENTITY_DATA':
                try {
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
        } catch (error) {
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

            case 'REBUILD_ENTITY_INDEXES':
                try {
                    await memorySystem.syncCache();
                    return {
                        success: true,
                        data: { rebuilt: true, message: '索引重建完成' }
                    };
                } catch (error) {
                    console.error('重建实体索引失败:', error);
                    return {
                        success: false,
                        error: error.message,
                        data: { rebuilt: false, message: '索引重建失败' }
                    };
                }

            case 'CLEAR_ALL_ENTITY_DATA':
                try {
                    await localStorage.clearExpiredCache();
                    return {
                        success: true,
                        data: { cleared: true, message: '实体数据清理完成' }
                    };
                } catch (error) {
                    console.error('清空实体数据失败:', error);
                    return {
                        success: false,
                        error: error.message,
                        data: { cleared: false, message: '数据清理失败' }
                    };
                }

            case 'GET_TOPIC_DETAIL':
                return handleGetTopicDetail(request);

            case 'INITIALIZE_SAMPLE_DATA':
                return handleInitializeSampleData();

            default:
                return null; // 不是记忆系统相关的消息
        }
    })();
}

// ========== 复杂逻辑处理函数 ==========

async function handleGetTopicDetail(request: any): Promise<any> {
    const { topicId } = request;
    
    try {
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

        // 直接使用 CloudStorage 的方法将基础实体扩展为详细缓存实体
        const topicDetail = await cloudStorage.extendEntityToDetailCache(topicEntity);

        // 直接缓存整个主题详情实体（包含完整的 recentDataDetails）
        await localStorage.cacheEntity(topicDetail);

        return { success: true, data: topicDetail };
    } catch (error) {
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
        const results = [];

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
            } catch (error) {
                failedCount++;
                results.push({ success: false, entityId: 'unknown', errors: [error.message] });
            }
        }
        
        return {
            success: true,
            data: { created: successCount, failed: failedCount, details: results }
        };
    } catch (error) {
        console.error('初始化示例数据失败:', error);
        return {
            success: false,
            error: error.message,
            data: { created: 0, failed: 0, details: [] }
        };
    }
}
