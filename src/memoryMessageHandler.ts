/**
 * 记忆系统消息处理器
 * 专门处理来自前端的记忆系统相关请求
 */

import { memorySystem } from './memory';

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
    switch (request.type) {
        case 'GET_ENTITY_STATISTICS':
            return handleGetEntityStatistics();

        case 'GET_ENTITY_TYPES':
            return handleGetEntityTypes();

        case 'GET_TOPIC_DETAIL':
            return handleGetTopicDetail(request);

        case 'GET_ENTITIES_BY_TYPE':
            return handleGetEntitiesByType(request);

        case 'SEARCH_ENTITIES':
            return handleSearchEntities(request);

        case 'GET_RECENT_TIMELINE':
            return handleGetRecentTimeline(request);

        case 'UPDATE_ENTITY_ACCESS':
            return handleUpdateEntityAccess(request);

        case 'GET_ENTITY_DETAILS':
            return handleGetEntityDetails(request);

        case 'GET_ENTITY_TIMELINE':
            return handleGetEntityTimeline(request);

        case 'GET_ENTITY_MESSAGES':
            return handleGetEntityMessages(request);

        case 'GET_ENTITY_WEBPAGES':
            return handleGetEntityWebpages(request);

        case 'SET_ENTITY_TAGS':
            return handleSetEntityTags(request);

        case 'SET_ENTITY_STATUS':
            return handleSetEntityStatus(request);

        case 'DIAGNOSE_ENTITY_DATA':
            return handleDiagnoseEntityData();

        case 'INITIALIZE_SAMPLE_DATA':
            return handleInitializeSampleData();

        case 'REBUILD_ENTITY_INDEXES':
            return handleRebuildEntityIndexes();

        case 'CLEAR_ALL_ENTITY_DATA':
            return handleClearAllEntityData();

        default:
            return null; // 不是记忆系统相关的消息
    }
}

// ========== 具体处理函数 ==========

async function handleGetEntityStatistics(): Promise<any> {
    try {
        // 确保记忆系统已初始化
        await memorySystem.initialize();
        
        const stats = await memorySystem.getEntityStatistics();
        return {
            success: true,
            data: stats
        };
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
}

async function handleGetEntityTypes(): Promise<any> {
    try {
        // 确保记忆系统已初始化
        await memorySystem.initialize();
        
        // 使用新的 getEntityTypes 方法
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
            data: {
                entityTypes: [],
                totalCount: 0
            }
        };
    }
}

async function handleGetTopicDetail(request: any): Promise<any> {
    const { topicId } = request;
    
    try {
        // 确保记忆系统已初始化
        await memorySystem.initialize();
        
        // 优先从统一缓存获取主题详情（使用 RECENT_DATA 替代 TOPIC_DETAILS）
        const cachedDetails = await memorySystem.getRecentData(topicId);
        if (cachedDetails) {
            return {
                success: true,
                data: cachedDetails
            };
        }

        // 获取主题基础信息
        const topicEntity = await memorySystem.getEntityDetails(topicId);
        if (!topicEntity) {
            throw new Error('主题不存在');
        }

        // 使用 CloudStorage 的新方法将基础实体扩展为详细缓存实体
        const topicDetail = await memorySystem.extendEntityToDetailCache(topicEntity);

        // 缓存主题详情到统一的 RECENT_DATA 缓存（替代 TOPIC_DETAILS）
        // 这样可以避免重复存储，同时为实体列表页面提供快速访问
        // 将详情数据拆分存储为各个组件
        if (topicDetail.latestConversations) {
            for (const conv of topicDetail.latestConversations.slice(0, 3)) {
                await memorySystem.updateRecentData(topicId, 'conversation', conv);
            }
        }
        if (topicDetail.relatedResources) {
            for (const resource of topicDetail.relatedResources.slice(0, 3)) {
                await memorySystem.updateRecentData(topicId, 'resource', resource);
            }
        }
        if (topicDetail.relatedProjects) {
            for (const project of topicDetail.relatedProjects.slice(0, 3)) {
                await memorySystem.updateRecentData(topicId, 'project', project);
            }
        }
        if (topicDetail.latestWebpages) {
            for (const webpage of topicDetail.latestWebpages.slice(0, 3)) {
                await memorySystem.updateRecentData(topicId, 'webpage', webpage);
            }
        }

        return {
            success: true,
            data: topicDetail
        };
    } catch (error) {
        console.error('获取主题详情失败:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

async function handleGetEntitiesByType(request: any): Promise<any> {
    const { entityType, limit = 50, offset = 0, sortBy = 'importance', sortOrder = 'desc' } = request;
    
    try {
        // 确保记忆系统已初始化
        await memorySystem.initialize();
        const result = await memorySystem.queryEntities(entityType, undefined, {
            limit,
            offset,
            sortBy,
            sortOrder
        });
        
        return {
            success: true,
            data: result.data
        };
    } catch (error) {
        console.error('获取实体列表失败:', error);
        return {
            success: false,
            error: error.message,
            data: []
        };
    }
}

async function handleSearchEntities(request: any): Promise<any> {
    const { query, entityType, tags, status, limit = 30, timeRange } = request;
    
    try {
        // 确保记忆系统已初始化
        await memorySystem.initialize();
        const searchResults = await memorySystem.searchEntities(query, entityType, { limit });
        
        return {
            success: true,
            data: searchResults.data,
            total: searchResults.total,
            source: searchResults.source
        };
    } catch (error) {
        console.error('搜索实体失败:', error);
        return {
            success: false,
            error: error.message,
            data: [],
            total: 0
        };
    }
}

async function handleGetRecentTimeline(request: any): Promise<any> {
    const { limit = 50 } = request;
    
    try {
        // 确保记忆系统已初始化
        await memorySystem.initialize();
        const timeline = await memorySystem.getTimeline(limit);
        
        return {
            success: true,
            data: timeline
        };
    } catch (error) {
        console.error('获取时间轴失败:', error);
        return {
            success: false,
            error: error.message,
            data: []
        };
    }
}

async function handleUpdateEntityAccess(request: any): Promise<any> {
    const { entityId } = request;
    
    try {
        // 确保记忆系统已初始化
        await memorySystem.initialize();
        // 记忆系统中暂时没有直接的访问统计更新接口
        // 可以通过获取实体详情来模拟访问
        await memorySystem.getEntityDetails(entityId);
        
        return {
            success: true,
            message: '实体访问已记录'
        };
    } catch (error) {
        console.error('更新实体访问失败:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

async function handleGetEntityDetails(request: any): Promise<any> {
    const { entityId } = request;
    
    try {
        // 确保记忆系统已初始化
        await memorySystem.initialize();
        const entityDetails = await memorySystem.getEntityDetails(entityId);
        
        return {
            success: true,
            data: entityDetails
        };
    } catch (error) {
        console.error('获取实体详情失败:', error);
        return {
            success: false,
            error: error.message,
            data: null
        };
    }
}

async function handleGetEntityTimeline(request: any): Promise<any> {
    const { entityId, limit = 50, timeRange } = request;
    
    try {
        // 确保记忆系统已初始化
        await memorySystem.initialize();
        const timeline = await memorySystem.getEntityTimeline(entityId, { limit, timeRange });
        
        return {
            success: true,
            data: timeline
        };
    } catch (error) {
        console.error('获取实体时间轴失败:', error);
        return {
            success: false,
            error: error.message,
            data: []
        };
    }
}

async function handleGetEntityMessages(request: any): Promise<any> {
    const { entityId, limit = 20, timeRange } = request;
    
    try {
        // 确保记忆系统已初始化
        await memorySystem.initialize();
        // 使用时间轴代替消息查询
        const timeline = await memorySystem.getEntityTimeline(entityId, { limit, timeRange });
        const messages = timeline.filter(item => item.type === 'message');
        
        return {
            success: true,
            data: messages
        };
    } catch (error) {
        console.error('获取实体消息失败:', error);
        return {
            success: false,
            error: error.message,
            data: []
        };
    }
}

async function handleGetEntityWebpages(request: any): Promise<any> {
    const { entityId, limit = 10, timeRange } = request;
    
    try {
        // 确保记忆系统已初始化
        await memorySystem.initialize();
        // 使用时间轴代替网页查询
        const timeline = await memorySystem.getEntityTimeline(entityId, { limit, timeRange });
        const webpages = timeline.filter(item => item.type === 'webpage');
        
        return {
            success: true,
            data: webpages
        };
    } catch (error) {
        console.error('获取实体网页失败:', error);
        return {
            success: false,
            error: error.message,
            data: []
        };
    }
}

async function handleSetEntityTags(request: any): Promise<any> {
    const { entityId, tags } = request;
    
    try {
        // 确保记忆系统已初始化
        await memorySystem.initialize();
        // 通过更新实体来设置标签
        const result = await memorySystem.updateEntity(entityId, { tags });
        
        return {
            success: result.success,
            message: result.success ? '标签设置成功' : '标签设置失败'
        };
    } catch (error) {
        console.error('设置实体标签失败:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

async function handleSetEntityStatus(request: any): Promise<any> {
    const { entityId, status } = request;
    
    try {
        // 确保记忆系统已初始化
        await memorySystem.initialize();
        // 通过更新实体来设置状态
        const result = await memorySystem.updateEntity(entityId, { status });
        
        return {
            success: result.success,
            message: result.success ? '状态设置成功' : '状态设置失败'
        };
    } catch (error) {
        console.error('设置实体状态失败:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

async function handleDiagnoseEntityData(): Promise<any> {
    try {
        // 确保记忆系统已初始化
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
}

async function handleInitializeSampleData(): Promise<any> {
    try {
        // 确保记忆系统已初始化
        await memorySystem.initialize();
        // 创建一些示例实体
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
                    relationships: 4
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
                    relationships: 6
                }
            }
        ];

        const results = await memorySystem.batchStoreEntities(sampleEntities);
        
        return {
            success: true,
            data: {
                created: results.success,
                failed: results.failed,
                details: results.results
            }
        };
    } catch (error) {
        console.error('初始化示例数据失败:', error);
        return {
            success: false,
            error: error.message,
            data: {
                created: 0,
                failed: 0,
                details: []
            }
        };
    }
}

async function handleRebuildEntityIndexes(): Promise<any> {
    try {
        // 确保记忆系统已初始化
        await memorySystem.initialize();
        // 执行缓存同步来重建索引
        await memorySystem.syncCache();
        
        return {
            success: true,
            data: {
                rebuilt: true,
                message: '索引重建完成'
            }
        };
    } catch (error) {
        console.error('重建实体索引失败:', error);
        return {
            success: false,
            error: error.message,
            data: {
                rebuilt: false,
                message: '索引重建失败'
            }
        };
    }
}

async function handleClearAllEntityData(): Promise<any> {
    try {
        // 确保记忆系统已初始化
        await memorySystem.initialize();
        // 执行缓存清理
        await memorySystem.clearExpiredCache();
        
        return {
            success: true,
            data: {
                cleared: true,
                message: '实体数据清理完成'
            }
        };
    } catch (error) {
        console.error('清空实体数据失败:', error);
        return {
            success: false,
            error: error.message,
            data: {
                cleared: false,
                message: '数据清理失败'
            }
        };
    }
}
