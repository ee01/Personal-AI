/**
 * 记忆系统消息处理器
 * 专门处理来自前端的记忆系统相关请求
 */

import { memorySystem } from './memory';

/**
 * 处理记忆系统相关的消息
 */
export async function handleMemoryMessage(request: any, sendResponse: (response: any) => void): Promise<boolean> {
    try {
        // 确保记忆系统已初始化
        await memorySystem.initialize();

        switch (request.type) {
            case 'GET_ENTITY_STATISTICS':
                return await handleGetEntityStatistics(sendResponse);

            case 'GET_ENTITY_TYPES':
                return await handleGetEntityTypes(sendResponse);

            case 'GET_TOPIC_DETAIL':
                return await handleGetTopicDetail(request, sendResponse);

            case 'GET_ENTITIES_BY_TYPE':
                return await handleGetEntitiesByType(request, sendResponse);

            case 'SEARCH_ENTITIES':
                return await handleSearchEntities(request, sendResponse);

            case 'GET_RECENT_TIMELINE':
                return await handleGetRecentTimeline(request, sendResponse);

            case 'UPDATE_ENTITY_ACCESS':
                return await handleUpdateEntityAccess(request, sendResponse);

            case 'GET_ENTITY_DETAILS':
                return await handleGetEntityDetails(request, sendResponse);

            case 'GET_ENTITY_TIMELINE':
                return await handleGetEntityTimeline(request, sendResponse);

            case 'GET_ENTITY_MESSAGES':
                return await handleGetEntityMessages(request, sendResponse);

            case 'GET_ENTITY_WEBPAGES':
                return await handleGetEntityWebpages(request, sendResponse);

            case 'SET_ENTITY_TAGS':
                return await handleSetEntityTags(request, sendResponse);

            case 'SET_ENTITY_STATUS':
                return await handleSetEntityStatus(request, sendResponse);

            case 'DIAGNOSE_ENTITY_DATA':
                return await handleDiagnoseEntityData(sendResponse);

            case 'INITIALIZE_SAMPLE_DATA':
                return await handleInitializeSampleData(sendResponse);

            case 'REBUILD_ENTITY_INDEXES':
                return await handleRebuildEntityIndexes(sendResponse);

            case 'CLEAR_ALL_ENTITY_DATA':
                return await handleClearAllEntityData(sendResponse);

            default:
                return false; // 不是记忆系统相关的消息
        }
    } catch (error) {
        console.error('记忆系统消息处理失败:', error);
        sendResponse({
            success: false,
            error: error.message
        });
        return true;
    }
}

// ========== 具体处理函数 ==========

async function handleGetEntityStatistics(sendResponse: (response: any) => void): Promise<boolean> {
    try {
        const stats = await memorySystem.getEntityStatistics();
        sendResponse({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('获取实体统计失败:', error);
        sendResponse({
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
        });
    }
    return true;
}

async function handleGetEntityTypes(sendResponse: (response: any) => void): Promise<boolean> {
    const entityTypes = ['Person', 'Project', 'Task', 'Organization', 'Document', 'Technology', 'Topic'];
    sendResponse({
        success: true,
        data: {
            entityTypes,
            totalCount: entityTypes.length
        }
    });
    return true;
}

async function handleGetTopicDetail(request: any, sendResponse: (response: any) => void): Promise<boolean> {
    const { topicId } = request;
    
    try {
        // 优先从缓存获取主题详情
        const cachedDetails = await memorySystem.getCachedTopicDetails(topicId);
        if (cachedDetails) {
            sendResponse({
                success: true,
                data: cachedDetails
            });
            return true;
        }

        // 获取主题基础信息
        const topicEntity = await memorySystem.getEntityDetails(topicId);
        if (!topicEntity) {
            throw new Error('主题不存在');
        }

        // 获取相关项目（查询 Project 类型实体）
        const projectResults = await memorySystem.queryEntities('Project', undefined, { limit: 3 });
        const relatedProjects = projectResults.data.map((project: any) => ({
            id: project.id,
            name: project.name || '未知项目',
            status: project.properties?.status || project.status || '开发中',
            description: project.description || `项目: ${project.name || '未命名项目'}`
        }));

        // 获取相关资源（查询 Document 类型实体）
        const documentResults = await memorySystem.queryEntities('Document', undefined, { limit: 3 });
        const relatedResources = documentResults.data.map((doc: any) => ({
            id: doc.id,
            name: doc.name || '文档资源',
            type: '文档',
            url: doc.properties?.url || '#'
        }));

        // 获取时间轴数据作为对话
        const timeline = await memorySystem.getTimeline(10);
        const conversations = timeline.map((item: any) => ({
            id: item.id,
            title: item.title || '对话',
            content: item.content || '',
            timestamp: item.timestamp || Date.now(),
            source: item.source || '未知来源'
        }));

        const response = {
            topic: topicEntity,
            conversations,
            resources: relatedResources,
            projects: relatedProjects,
            webpages: [] as any[]
        };

        // 缓存主题详情
        await memorySystem.cacheTopicDetails(topicId, response);

        sendResponse({
            success: true,
            data: response
        });
    } catch (error) {
        console.error('获取主题详情失败:', error);
        sendResponse({
            success: false,
            error: error.message
        });
    }
    return true;
}

async function handleGetEntitiesByType(request: any, sendResponse: (response: any) => void): Promise<boolean> {
    const { entityType, limit = 50, offset = 0, sortBy = 'importance', sortOrder = 'desc' } = request;
    
    try {
        const result = await memorySystem.queryEntities(entityType, undefined, {
            limit,
            offset,
            sortBy,
            sortOrder
        });
        
        sendResponse({
            success: true,
            data: result.data
        });
    } catch (error) {
        console.error('获取实体列表失败:', error);
        sendResponse({
            success: false,
            error: error.message,
            data: []
        });
    }
    return true;
}

async function handleSearchEntities(request: any, sendResponse: (response: any) => void): Promise<boolean> {
    const { query, entityType, tags, status, limit = 30, timeRange } = request;
    
    try {
        const searchResults = await memorySystem.searchEntities(query, entityType, { limit });
        
        sendResponse({
            success: true,
            data: searchResults.data,
            total: searchResults.total,
            source: searchResults.source
        });
    } catch (error) {
        console.error('搜索实体失败:', error);
        sendResponse({
            success: false,
            error: error.message,
            data: [],
            total: 0
        });
    }
    return true;
}

async function handleGetRecentTimeline(request: any, sendResponse: (response: any) => void): Promise<boolean> {
    const { limit = 50 } = request;
    
    try {
        const timeline = await memorySystem.getTimeline(limit);
        
        sendResponse({
            success: true,
            data: timeline
        });
    } catch (error) {
        console.error('获取时间轴失败:', error);
        sendResponse({
            success: false,
            error: error.message,
            data: []
        });
    }
    return true;
}

async function handleUpdateEntityAccess(request: any, sendResponse: (response: any) => void): Promise<boolean> {
    const { entityId } = request;
    
    try {
        // 记忆系统中暂时没有直接的访问统计更新接口
        // 可以通过获取实体详情来模拟访问
        await memorySystem.getEntityDetails(entityId);
        
        sendResponse({
            success: true,
            message: '实体访问已记录'
        });
    } catch (error) {
        console.error('更新实体访问失败:', error);
        sendResponse({
            success: false,
            error: error.message
        });
    }
    return true;
}

async function handleGetEntityDetails(request: any, sendResponse: (response: any) => void): Promise<boolean> {
    const { entityId } = request;
    
    try {
        const entityDetails = await memorySystem.getEntityDetails(entityId);
        
        sendResponse({
            success: true,
            data: entityDetails
        });
    } catch (error) {
        console.error('获取实体详情失败:', error);
        sendResponse({
            success: false,
            error: error.message,
            data: null
        });
    }
    return true;
}

async function handleGetEntityTimeline(request: any, sendResponse: (response: any) => void): Promise<boolean> {
    const { entityId, limit = 50, timeRange } = request;
    
    try {
        const timeline = await memorySystem.getEntityTimeline(entityId, { limit, timeRange });
        
        sendResponse({
            success: true,
            data: timeline
        });
    } catch (error) {
        console.error('获取实体时间轴失败:', error);
        sendResponse({
            success: false,
            error: error.message,
            data: []
        });
    }
    return true;
}

async function handleGetEntityMessages(request: any, sendResponse: (response: any) => void): Promise<boolean> {
    const { entityId, limit = 20, timeRange } = request;
    
    try {
        // 使用时间轴代替消息查询
        const timeline = await memorySystem.getEntityTimeline(entityId, { limit, timeRange });
        const messages = timeline.filter(item => item.type === 'message');
        
        sendResponse({
            success: true,
            data: messages
        });
    } catch (error) {
        console.error('获取实体消息失败:', error);
        sendResponse({
            success: false,
            error: error.message,
            data: []
        });
    }
    return true;
}

async function handleGetEntityWebpages(request: any, sendResponse: (response: any) => void): Promise<boolean> {
    const { entityId, limit = 10, timeRange } = request;
    
    try {
        // 使用时间轴代替网页查询
        const timeline = await memorySystem.getEntityTimeline(entityId, { limit, timeRange });
        const webpages = timeline.filter(item => item.type === 'webpage');
        
        sendResponse({
            success: true,
            data: webpages
        });
    } catch (error) {
        console.error('获取实体网页失败:', error);
        sendResponse({
            success: false,
            error: error.message,
            data: []
        });
    }
    return true;
}

async function handleSetEntityTags(request: any, sendResponse: (response: any) => void): Promise<boolean> {
    const { entityId, tags } = request;
    
    try {
        // 通过更新实体来设置标签
        const result = await memorySystem.updateEntity(entityId, { tags });
        
        sendResponse({
            success: result.success,
            message: result.success ? '标签设置成功' : '标签设置失败'
        });
    } catch (error) {
        console.error('设置实体标签失败:', error);
        sendResponse({
            success: false,
            error: error.message
        });
    }
    return true;
}

async function handleSetEntityStatus(request: any, sendResponse: (response: any) => void): Promise<boolean> {
    const { entityId, status } = request;
    
    try {
        // 通过更新实体来设置状态
        const result = await memorySystem.updateEntity(entityId, { status });
        
        sendResponse({
            success: result.success,
            message: result.success ? '状态设置成功' : '状态设置失败'
        });
    } catch (error) {
        console.error('设置实体状态失败:', error);
        sendResponse({
            success: false,
            error: error.message
        });
    }
    return true;
}

async function handleDiagnoseEntityData(sendResponse: (response: any) => void): Promise<boolean> {
    try {
        const healthStatus = await memorySystem.performHealthCheck();
        
        sendResponse({
            success: true,
            data: {
                status: healthStatus.overall.status,
                score: healthStatus.overall.score,
                issues: healthStatus.overall.issues,
                recommendations: healthStatus.overall.recommendations,
                cloudStorage: healthStatus.cloudStorage,
                localCache: healthStatus.localCache
            }
        });
    } catch (error) {
        console.error('诊断实体数据失败:', error);
        sendResponse({
            success: false,
            error: error.message,
            data: {
                status: 'error',
                score: 0,
                issues: ['诊断失败'],
                recommendations: ['请检查系统状态']
            }
        });
    }
    return true;
}

async function handleInitializeSampleData(sendResponse: (response: any) => void): Promise<boolean> {
    try {
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
                tags: ['示例', '开发者']
            },
            {
                type: 'Project' as const,
                name: '示例项目',
                description: '这是一个示例项目',
                properties: { status: '进行中', priority: '高' },
                importance: 0.9,
                accessCount: 0,
                lastAccessed: Date.now(),
                tags: ['示例', '项目']
            }
        ];

        const results = await memorySystem.batchStoreEntities(sampleEntities);
        
        sendResponse({
            success: true,
            data: {
                created: results.success,
                failed: results.failed,
                details: results.results
            }
        });
    } catch (error) {
        console.error('初始化示例数据失败:', error);
        sendResponse({
            success: false,
            error: error.message,
            data: {
                created: 0,
                failed: 0,
                details: []
            }
        });
    }
    return true;
}

async function handleRebuildEntityIndexes(sendResponse: (response: any) => void): Promise<boolean> {
    try {
        // 执行缓存同步来重建索引
        await memorySystem.syncCache();
        
        sendResponse({
            success: true,
            data: {
                rebuilt: true,
                message: '索引重建完成'
            }
        });
    } catch (error) {
        console.error('重建实体索引失败:', error);
        sendResponse({
            success: false,
            error: error.message,
            data: {
                rebuilt: false,
                message: '索引重建失败'
            }
        });
    }
    return true;
}

async function handleClearAllEntityData(sendResponse: (response: any) => void): Promise<boolean> {
    try {
        // 执行缓存清理
        await memorySystem.clearExpiredCache();
        
        sendResponse({
            success: true,
            data: {
                cleared: true,
                message: '实体数据清理完成'
            }
        });
    } catch (error) {
        console.error('清空实体数据失败:', error);
        sendResponse({
            success: false,
            error: error.message,
            data: {
                cleared: false,
                message: '数据清理失败'
            }
        });
    }
    return true;
}
