import { analyzeMessages, analyzeMessagesInBackground } from './messageDealing';
import { initChromaClient } from './vectorStore';
import { knowledgeQuery } from './llm';
import { createOffscreenDocument, handleEmbeddingResult } from './embeddings';
import { getEnvConfig } from './utils';
import { FETCH_JIRA_TICKETS } from './jira';
import { getAuthToken } from './slide';
import { IntelligentAgent } from './agentThinking';
import { ProjectAnalysisResult } from './interfaces/analysisInterfaces';
import { 
    executeEnhancedKnowledgeQuery, 
    getGraphStatistics, 
    syncGraphData, 
    backupGraphData 
} from './enhancedKnowledgeQuery';
import { EntityDataInitializer } from './storage/EntityDataInitializer';
import { getMessageProcessingEnhancer } from './storage/MessageProcessingEnhancer';
import { getStorageHealthMonitor } from './storage/StorageHealthMonitor';
import { getWebIntelligenceIntegrator } from './web-intelligence/WebIntelligenceIntegrator';
import { DashboardMessageHandler } from './utils/dashboardIntegration';

console.log('Background script loaded');

// 辅助函数：格式化时间为相对时间
function formatTimeAgo(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    if (days < 30) return `${days}天前`;
    return new Date(timestamp).toLocaleDateString();
}

// 监听扩展命令
chrome.commands.onCommand.addListener(async (command) => {
    console.log('Command received:', command);
    
    if (command === 'open-memory-interface') {
        try {
            // 获取当前活跃的标签页
            const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (activeTab?.id) {
                // 打开记忆查询界面
                const memoryUrl = chrome.runtime.getURL('memory.html');
                
                // 使用弹窗方式打开记忆界面
                await chrome.windows.create({
                    url: memoryUrl,
                    type: 'popup',
                    width: 1400,
                    height: 900,
                    focused: true
                });
                
                console.log('Memory interface opened via command shortcut');
            }
        } catch (error) {
            console.error('Failed to open memory interface:', error);
        }
    }
});

// 扩展安装或更新时，立即创建定时任务
chrome.runtime.onInstalled.addListener(async () => {
    try {
        console.log('Extension installed/updated');
        
        // 加载配置
        const config = await getEnvConfig();
        console.log('Global config loaded:', config);

        // 初始化配置
        const { scheduleActive } = await chrome.storage.local.get(['scheduleActive']);
        // 如果之前是激活状态，重新启动定时任务
        if (scheduleActive) {
            startScheduledCheck();
        }
        
        chrome.storage.local.remove('ollamaAnalysisProgress');
        
        // 获取并清理过期的 concernedItems
        const { concernedItems } = await chrome.storage.local.get('concernedItems');
        if (concernedItems) {
            // 过滤掉过期的项目
            const validItems = concernedItems.filter((item:any) => {
                return !item.expiredAt || new Date(item.expiredAt) > new Date();
            });
            
            // 如果有项目被过滤掉，更新存储
            if (validItems.length !== concernedItems.length) {
                await chrome.storage.local.set({ concernedItems: validItems });
            }
        }
        
        // 如果没有 concernedItems 或已清空，设置默认值
        if (!concernedItems || concernedItems.length === 0) {
            chrome.storage.local.set({concernedItems: [
                {text:'聊到关于公司政策，也可以是政策相关的八卦消息', pushToGlip: true},
                {text:'任何提到我的名字的消息，排除 @Team，排除明确@{我的名字}，排除发送者是我', pushToGlip: false},
                {text:'可能是回复我的消息，比如在我发完消息之后的答复。排除发送者是我，排除明确@{我的名字}', pushToGlip: true, mentionMe: true},
            ]});
        }
        console.log('concernedItems', concernedItems);

        // 查找并刷新 RingCentral 标签页
        try {
            const rcTab = await findRingCentralTab();
            if (rcTab && rcTab.id) {
                await chrome.tabs.reload(rcTab.id);
                console.log('RingCentral tab refreshed');
                
                // 延迟获取 RC Radar 配置
                await getUserinfoFromRCpage();
            }
        } catch (error) {
            console.error('Error refreshing RingCentral tab:', error);
        }

        // 安全地初始化Chroma
        try {
            if (await initChromaClient()) console.log('Chroma client initialized');
        } catch (error) {
            console.error('Failed to initialize Chroma:', error);
        }

        // 预先创建离屏文档
        await createOffscreenDocument();

        // 初始化混合图存储和健康监控
        try {
            console.log('🔄 初始化混合图存储系统...');
            
            // 初始化消息处理增强器
            const enhancer = await getMessageProcessingEnhancer();
            const enhancerStats = enhancer.getGraphStatistics();
            console.log('📊 消息处理增强器状态:', enhancerStats);
            
            // 启动存储健康监控
            const healthMonitor = await getStorageHealthMonitor();
            healthMonitor.startMonitoring(10); // 每10分钟检查一次
            console.log('🎯 存储健康监控已启动');
            
        } catch (error) {
            console.error('❌ 混合图存储系统初始化失败:', error);
        }
    } catch (error) {
        console.error('Error in onInstalled listener:', error);
    }
});

// 监听定时任务
chrome.alarms.onAlarm.addListener((alarm) => {
    console.log('alarm', alarm);
    if (alarm.name === 'scheduledTask') {
        console.log('Running scheduled message check...');
        runScheduledTask();
    }
});

// 原来的监听器简化为：
// 初始化仪表盘消息处理器
console.log('🚀 初始化仪表盘消息处理器...');
let dashboardHandler: DashboardMessageHandler;
try {
  dashboardHandler = new DashboardMessageHandler();
  console.log('✅ 仪表盘消息处理器初始化成功');
} catch (error) {
  console.error('❌ 仪表盘消息处理器初始化失败:', error);
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Background received message:', request);

    // 如果不是 background 定时程序，会从页面发送请求到这里执行
    if (request.type === 'MESSAGE_DEALING') {
        const { body } = request.data;
        console.log('Sending request to LLM:', body);
        analyzeMessagesInBackground(body.data, body.username, body.isScheduledTask).then(raw => {
            sendResponse({ data: raw });
        });
        return true;
    }

    // 处理Google Slides项目分析请求
    if (request.type === 'ANALYZE_PROJECT') {
        console.log('处理单个项目分析请求:', request.data.request?.project_data?.project?.name, request.data);
        const { request: projectRequest, config, context } = request.data;
        
        const agent = new IntelligentAgent();
        agent.analyze(projectRequest, config, context)
            .then((result: ProjectAnalysisResult) => {
                console.log('单个项目分析结果:', result);
                sendResponse(result);
            })
            .catch((error: Error) => {
                console.error('单个项目分析失败:', error);
                sendResponse({ success: false, error: error.message });
            });
        return true;
    }

    if (request.type === 'CONTROL_SCHEDULED_CHECK') {
        if (request.action === 'start') {
            startScheduledCheck();
            sendResponse({ status: 'started' });
        } else if (request.action === 'stop') {
            stopScheduledCheck();
            sendResponse({ status: 'stopped' });
        }
        return true;
    }

    if (request.type === 'KNOWLEDGE_QUERY') {
        knowledgeQuery(request.question).then(result => {
            console.log('General query result:', result);
            sendResponse(result);
        });
        return true;
    }
    
    // 更新环境配置
    if (request.type === 'UPDATE_ENV_CONFIG') {
        chrome.storage.local.set({ envConfig: request.config });
        console.log('Updated environment config:', request.config);
        sendResponse({ success: true });
        return true;
    }

    // 监听来自离屏文档的消息
    handleEmbeddingResult(request);

    // 处理 Jira tickets 获取
    if (request.type === 'FETCH_JIRA_TICKETS') {
        const { jql, requestId } = request;
        FETCH_JIRA_TICKETS(jql, requestId, sender.tab?.id);
        return true; // 保持消息通道开放
    }

    // 获取当前标签页 URL
    if (request.type === 'GET_CURRENT_TAB_URL') {
        chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
            sendResponse({ url: tab?.url });
        });
        return true; // 保持消息通道开放
    }

    // 处理分析幻灯片项目的请求
    if (request.type === 'REQUEST_SLIDES_ANALYSIS' && sender.tab?.id) {
        handleSlideAnalysisRequest(sender.tab.id);
        return true;
    }

    // 处理增强知识查询请求
    if (request.type === 'ENHANCED_KNOWLEDGE_QUERY') {
        const { query, options } = request;
        executeEnhancedKnowledgeQuery(query, options)
            .then(response => sendResponse(response))
            .catch(error => sendResponse({
                success: false,
                error: error.message,
                query,
                options,
                data: { graphConnections: 0, totalResults: 0 },
                queryTime: 0
            }));
        return true; // 保持消息通道开放
    }

    // 处理图存储统计请求
    if (request.type === 'GET_GRAPH_STATISTICS') {
        getGraphStatistics()
            .then(response => sendResponse(response))
            .catch(error => sendResponse({
                success: false,
                error: error.message
            }));
        return true;
    }

    // 处理图数据同步请求
    if (request.type === 'SYNC_GRAPH_DATA') {
        syncGraphData()
            .then(response => sendResponse(response))
            .catch(error => sendResponse({
                success: false,
                error: error.message
            }));
        return true;
    }

    // 处理图数据备份请求
    if (request.type === 'BACKUP_GRAPH_DATA') {
        backupGraphData()
            .then(response => sendResponse(response))
            .catch(error => sendResponse({
                success: false,
                error: error.message
            }));
        return true;
    }

    // 处理数据迁移请求
    if (request.type === 'MIGRATE_DATA_TO_GRAPH') {
        const { migrateExistingData } = require('./storage/DataMigrationTool');
        migrateExistingData((progress: any) => {
            // 发送进度更新
            chrome.runtime.sendMessage({
                type: 'MIGRATION_PROGRESS',
                progress
            }).catch(() => {}); // 忽略发送失败
        })
            .then((result: any) => sendResponse({
                success: true,
                migrationResult: result
            }))
            .catch((error: any) => sendResponse({
                success: false,
                error: error.message
            }));
        return true;
    }

    // 处理存储健康检查请求
    if (request.type === 'GET_STORAGE_HEALTH') {
        getStorageHealthMonitor()
            .then(monitor => monitor.performHealthCheck())
            .then(healthMetrics => sendResponse({
                success: true,
                healthMetrics
            }))
            .catch(error => sendResponse({
                success: false,
                error: error.message
            }));
        return true;
    }

    // 处理维护任务执行请求
    if (request.type === 'RUN_MAINTENANCE_TASK') {
        const { taskId } = request;
        getStorageHealthMonitor()
            .then(monitor => monitor.runMaintenanceTask(taskId))
            .then(success => sendResponse({
                success,
                message: success ? '维护任务执行成功' : '维护任务执行失败'
            }))
            .catch(error => sendResponse({
                success: false,
                error: error.message
            }));
        return true;
    }

    // ========== 记忆界面相关消息处理 ==========
    
    // 获取实体统计信息
    if (request.type === 'GET_ENTITY_STATISTICS') {
        getMessageProcessingEnhancer()
            .then(enhancer => enhancer.getHybridGraphStore())
            .then(hybridStore => hybridStore.getEntityStatistics())
            .then(stats => sendResponse({
                success: true,
                data: stats
            }))
            .catch(error => {
                console.error('获取实体统计失败:', error);
                sendResponse({
                    success: false,
                    error: error.message,
                    data: {
                        entityCounts: {},
                        totalEntities: 0,
                        totalRelationships: 0,
                        topEntitiesByType: {},
                        relationshipTypes: {},
                        activityStats: {
                            entitiesCreatedToday: 0,
                            entitiesCreatedThisWeek: 0,
                            entitiesCreatedThisMonth: 0
                        }
                    }
                });
            });
        return true;
    }

    // 获取实体类型列表
    if (request.type === 'GET_ENTITY_TYPES') {
        getMessageProcessingEnhancer()
            .then(enhancer => enhancer.getHybridGraphStore())
            .then(hybridStore => hybridStore.getEntityTypes())
            .then(entityTypes => sendResponse({
                success: true,
                data: {
                    entityTypes,
                    // 保持向后兼容性
                    entityCounts: entityTypes.reduce((acc, type) => {
                        acc[type.type] = type.count;
                        return acc;
                    }, {} as Record<string, number>),
                    totalEntities: entityTypes.reduce((sum, type) => sum + type.count, 0)
                }
            }))
            .catch(error => {
                console.error('获取实体类型失败:', error);
                sendResponse({
                    success: false,
                    error: error.message,
                    data: { 
                        entityTypes: [],
                        entityCounts: {}, 
                        totalEntities: 0 
                    }
                });
            });
        return true;
    }

    // 获取主题详情数据
    if (request.type === 'GET_TOPIC_DETAIL') {
        const { topicId } = request;
        
        getMessageProcessingEnhancer()
            .then(enhancer => enhancer.getHybridGraphStore())
            .then(async (hybridStore) => {
                try {
                    // 获取主题基础信息
                    const topicEntity = await hybridStore.getEntityDetails(topicId);
                    if (!topicEntity) {
                        throw new Error('主题不存在');
                    }

                    // 获取相关项目（首先尝试通过关系查询，然后回退到全部项目）
                    let relatedProjects: any[] = [];
                    try {
                        // 暂时跳过关系查询，直接查询所有项目
                        // TODO: 等HybridGraphStore支持关系查询后再启用
                        // const relationships = await hybridStore.getEntityRelationships(topicId);
                        
                        // 如果没有直接关联的项目，查询所有项目实体
                        if (relatedProjects.length === 0) {
                            const allProjects = await hybridStore.getEntitiesByType('Project', { limit: 3 });
                            relatedProjects = allProjects.map((project: any) => ({
                                id: project.id,
                                name: project.name || '未知项目',
                                status: project.properties?.status || project.metadata?.status || '开发中',
                                description: project.description || `项目: ${project.name || '未命名项目'}`
                            }));
                        }
                    } catch (error) {
                        console.warn('获取相关项目失败:', error);
                        relatedProjects = [];
                    }

                    // 获取相关资源（首先尝试通过关系查询，然后查询网页记录）
                    let relatedResources: any[] = [];
                    try {
                        // 尝试获取与主题相关的文档实体
                        const documentEntities = await hybridStore.getEntitiesByType('Document', { limit: 3 });
                        const documentResources = documentEntities.map((doc: any) => ({
                            id: doc.id,
                            name: doc.name || '文档资源',
                            type: '文档',
                            url: doc.properties?.url || doc.metadata?.url || '#'
                        }));

                        // 获取相关网页记录
                        const webpageResults = await hybridStore.queryEntityWebpages(topicId, { 
                            limit: 3,
                            sortBy: 'relevance',
                            sortOrder: 'desc'
                        });
                        const webpageResources = webpageResults.map((webpage: any) => ({
                            id: webpage.webpageId,
                            name: webpage.title || '网页资源',
                            type: '网页',
                            url: webpage.url || '#'
                        }));

                        // 合并所有资源
                        relatedResources = [...documentResources, ...webpageResources].slice(0, 3);
                        
                        // 如果仍然没有资源，提供默认示例
                        if (relatedResources.length === 0) {
                            relatedResources = [{
                                id: 'default-resource',
                                name: `${topicEntity.name} 相关资源`,
                                type: '搜索建议',
                                url: `https://www.google.com/search?q=${encodeURIComponent(topicEntity.name)}`
                            }];
                        }
                    } catch (error) {
                        console.warn('获取相关资源失败:', error);
                        relatedResources = [];
                    }

                    // 获取相关对话（从实际消息数据中查询）
                    const conversations = await hybridStore.queryEntityMessages(topicId, { 
                        limit: 100, 
                        minRelevanceScore: 0.5,  // 余弦距离系统，阈值降低 
                        sortBy: 'relevance',
                        sortOrder: 'desc'
                    });
                    
                    // 转换为前端需要的格式
                    const formattedConversations = conversations.map(msg => {
                        // 处理上下文消息：从metadata中提取contextMessages
                        let context: any[] = [];
                        if (msg.metadata?.contextMessages && Array.isArray(msg.metadata.contextMessages)) {
                            context = msg.metadata.contextMessages.map((ctx: any) => ({
                                id: ctx.id,
                                sender: ctx.sender,
                                content: ctx.content,
                                time: ctx.datetime ? formatTimeAgo(new Date(ctx.datetime).getTime()) : '未知时间',
                                datetime: ctx.datetime,
                                isMainMessage: ctx.isMainMessage || false
                            }));
                        }

                        return {
                            id: msg.messageId,
                            sender: msg.source,
                            group: msg.metadata?.teamName || '聊天记录', // 使用真实群组名称
                            time: formatTimeAgo(msg.timestamp),
                            datetime: new Date(msg.timestamp).toISOString(),
                            summary: msg.metadata?.summary || msg.content.substring(0, 100) + '...',
                            originalContent: msg.content,
                            highlightText: msg.metadata?.highlightText || msg.content,
                            teamUrl: msg.metadata?.team_url || '#', // 使用真实的团队URL
                            matchedRules: msg.metadata?.matchedRules || [], // 使用真实的匹配规则
                            relevanceScore: msg.relevanceScore,
                            context: context // 使用真实的上下文消息
                        };
                    });

                    // 统计参与者（从相关消息中提取不同的发送者）
                    const participants = new Set(formattedConversations.map(conv => conv.sender)).size;

                    const topicDetail = {
                        overview: {
                            discussions: formattedConversations.length,
                            projects: relatedProjects.length,
                            participants: participants || 1, // 至少有一个参与者
                            resources: relatedResources.length
                        },
                        entity: topicEntity,
                        projects: relatedProjects,
                        resources: relatedResources,
                        conversations: formattedConversations,
                        // 使用真实的网页记录而不是demo数据
                        webpages: relatedResources.filter(r => r.type === '网页').map(webpage => ({
                            id: webpage.id,
                            title: webpage.name,
                            url: webpage.url,
                            type: 'webpage',
                            visitTime: '最近访问',
                            summary: `与${topicEntity.name}相关的网页内容`,
                            tags: [topicEntity.name, '网页']
                        }))
                    };

                    sendResponse({
                        success: true,
                        data: topicDetail
                    });
                } catch (error) {
                    console.error('获取主题详情失败:', error);
                    sendResponse({
                        success: false,
                        error: error.message
                    });
                }
            })
            .catch(error => {
                console.error('获取主题详情失败:', error);
                sendResponse({
                    success: false,
                    error: error.message
                });
            });
        return true;
    }

    // 按类型获取实体列表
    if (request.type === 'GET_ENTITIES_BY_TYPE') {
        const { entityType, limit = 50, offset = 0, sortBy = 'importance', sortOrder = 'desc' } = request;
        getMessageProcessingEnhancer()
            .then(enhancer => enhancer.getHybridGraphStore())
            .then(hybridStore => hybridStore.getEntitiesByType(entityType, {
                limit,
                offset,
                sortBy,
                sortOrder
            }))
            .then(entities => sendResponse({
                success: true,
                data: entities
            }))
            .catch(error => {
                console.error('获取实体列表失败:', error);
                sendResponse({
                    success: false,
                    error: error.message,
                    data: []
                });
            });
        return true;
    }

    // 搜索实体
    if (request.type === 'SEARCH_ENTITIES') {
        const { query, entityType, tags, status, limit = 30, timeRange } = request;
        getMessageProcessingEnhancer()
            .then(enhancer => enhancer.getHybridGraphStore())
            .then(hybridStore => hybridStore.searchEntities({
                query,
                entityType,
                tags,
                status,
                limit,
                timeRange
            }))
            .then(entities => sendResponse({
                success: true,
                data: entities
            }))
            .catch(error => {
                console.error('搜索实体失败:', error);
                sendResponse({
                    success: false,
                    error: error.message,
                    data: []
                });
            });
        return true;
    }

    // 获取最近时间轴
    if (request.type === 'GET_RECENT_TIMELINE') {
        const { limit = 50 } = request;
        getMessageProcessingEnhancer()
            .then(enhancer => enhancer.getHybridGraphStore())
            .then(hybridStore => {
                // 获取最重要的几个实体的时间轴
                const topEntities = hybridStore.getEntitiesByImportance(undefined, 10);
                const timelinePromises = topEntities.map(entity => 
                    hybridStore.getEntityTimeline(entity.id, { limit: 5 })
                );
                
                return Promise.all(timelinePromises);
            })
            .then(timelines => {
                // 合并并排序所有时间轴
                const allEvents = timelines.flat();
                allEvents.sort((a, b) => b.timestamp - a.timestamp);
                
                sendResponse({
                    success: true,
                    data: allEvents.slice(0, limit)
                });
            })
            .catch(error => {
                console.error('获取时间轴失败:', error);
                sendResponse({
                    success: false,
                    error: error.message,
                    data: []
                });
            });
        return true;
    }

    // 更新实体访问统计
    if (request.type === 'UPDATE_ENTITY_ACCESS') {
        const { entityId } = request;
        getMessageProcessingEnhancer()
            .then(enhancer => enhancer.getHybridGraphStore())
            .then(hybridStore => hybridStore.updateEntityAccess(entityId))
            .then(() => sendResponse({
                success: true,
                message: '实体访问统计已更新'
            }))
            .catch(error => {
                console.error('更新实体访问失败:', error);
                sendResponse({
                    success: false,
                    error: error.message
                });
            });
        return true;
    }

    // 获取实体详细信息
    if (request.type === 'GET_ENTITY_DETAILS') {
        const { entityId } = request;
        getMessageProcessingEnhancer()
            .then(enhancer => enhancer.getHybridGraphStore())
            .then(hybridStore => hybridStore.getEntityDetails(entityId))
            .then(entityDetails => sendResponse({
                success: true,
                data: entityDetails
            }))
            .catch(error => {
                console.error('获取实体详情失败:', error);
                sendResponse({
                    success: false,
                    error: error.message,
                    data: null
                });
            });
        return true;
    }

    // 获取实体时间轴
    if (request.type === 'GET_ENTITY_TIMELINE') {
        const { entityId, limit = 50, timeRange } = request;
        getMessageProcessingEnhancer()
            .then(enhancer => enhancer.getHybridGraphStore())
            .then(hybridStore => hybridStore.getEntityTimeline(entityId, { limit, timeRange }))
            .then(timeline => sendResponse({
                success: true,
                data: timeline
            }))
            .catch(error => {
                console.error('获取实体时间轴失败:', error);
                sendResponse({
                    success: false,
                    error: error.message,
                    data: []
                });
            });
        return true;
    }

    // 获取实体相关消息
    if (request.type === 'GET_ENTITY_MESSAGES') {
        const { entityId, limit = 20, timeRange } = request;
        getMessageProcessingEnhancer()
            .then(enhancer => enhancer.getHybridGraphStore())
            .then(hybridStore => hybridStore.queryEntityMessages(entityId, { limit, timeRange }))
            .then(messages => sendResponse({
                success: true,
                data: messages
            }))
            .catch(error => {
                console.error('获取实体消息失败:', error);
                sendResponse({
                    success: false,
                    error: error.message,
                    data: []
                });
            });
        return true;
    }

    // 获取实体相关网页
    if (request.type === 'GET_ENTITY_WEBPAGES') {
        const { entityId, limit = 10, timeRange } = request;
        getMessageProcessingEnhancer()
            .then(enhancer => enhancer.getHybridGraphStore())
            .then(hybridStore => hybridStore.queryEntityWebpages(entityId, { limit, timeRange }))
            .then(webpages => sendResponse({
                success: true,
                data: webpages
            }))
            .catch(error => {
                console.error('获取实体网页失败:', error);
                sendResponse({
                    success: false,
                    error: error.message,
                    data: []
                });
            });
        return true;
    }

    // 设置实体标签
    if (request.type === 'SET_ENTITY_TAGS') {
        const { entityId, tags } = request;
        getMessageProcessingEnhancer()
            .then(enhancer => enhancer.getHybridGraphStore())
            .then(hybridStore => hybridStore.setEntityTags(entityId, tags))
            .then(success => sendResponse({
                success,
                message: success ? '实体标签设置成功' : '实体标签设置失败'
            }))
            .catch(error => {
                console.error('设置实体标签失败:', error);
                sendResponse({
                    success: false,
                    error: error.message
                });
            });
        return true;
    }

    // 设置实体状态
    if (request.type === 'SET_ENTITY_STATUS') {
        const { entityId, status } = request;
        getMessageProcessingEnhancer()
            .then(enhancer => enhancer.getHybridGraphStore())
            .then(hybridStore => hybridStore.setEntityStatus(entityId, status))
            .then(success => sendResponse({
                success,
                message: success ? '实体状态设置成功' : '实体状态设置失败'
            }))
            .catch(error => {
                console.error('设置实体状态失败:', error);
                sendResponse({
                    success: false,
                    error: error.message
                });
            });
        return true;
    }

    // ========== 实体数据调试和初始化 ==========
    
    // 诊断实体数据状态
    if (request.type === 'DIAGNOSE_ENTITY_DATA') {
        getMessageProcessingEnhancer()
            .then(enhancer => enhancer.getHybridGraphStore())
            .then(hybridStore => {
                const initializer = new EntityDataInitializer(hybridStore);
                return initializer.diagnoseDataState();
            })
            .then(diagnosis => sendResponse({
                success: true,
                data: diagnosis
            }))
            .catch(error => {
                console.error('诊断实体数据失败:', error);
                sendResponse({
                    success: false,
                    error: error.message,
                    data: null
                });
            });
        return true;
    }

    // 初始化示例数据
    if (request.type === 'INITIALIZE_SAMPLE_DATA') {
        getMessageProcessingEnhancer()
            .then(enhancer => enhancer.getHybridGraphStore())
            .then(hybridStore => {
                const initializer = new EntityDataInitializer(hybridStore);
                return initializer.initializeSampleData();
            })
            .then(result => sendResponse({
                success: result.success,
                data: result,
                message: result.message
            }))
            .catch(error => {
                console.error('初始化示例数据失败:', error);
                sendResponse({
                    success: false,
                    error: error.message,
                    data: {
                        success: false,
                        entitiesCreated: 0,
                        relationshipsCreated: 0,
                        message: `初始化失败: ${error.message}`
                    }
                });
            });
        return true;
    }

    // 重建实体索引
    if (request.type === 'REBUILD_ENTITY_INDEXES') {
        getMessageProcessingEnhancer()
            .then(enhancer => enhancer.getHybridGraphStore())
            .then(hybridStore => {
                const initializer = new EntityDataInitializer(hybridStore);
                return initializer.rebuildIndexes();
            })
            .then(result => sendResponse({
                success: result.success,
                message: result.message
            }))
            .catch(error => {
                console.error('重建实体索引失败:', error);
                sendResponse({
                    success: false,
                    error: error.message,
                    message: `重建失败: ${error.message}`
                });
            });
        return true;
    }

    // 清空所有实体数据
    if (request.type === 'CLEAR_ALL_ENTITY_DATA') {
        getMessageProcessingEnhancer()
            .then(enhancer => enhancer.getHybridGraphStore())
            .then(hybridStore => {
                const initializer = new EntityDataInitializer(hybridStore);
                return initializer.clearAllData();
            })
            .then(result => sendResponse({
                success: result.success,
                message: result.message
            }))
            .catch(error => {
                console.error('清空实体数据失败:', error);
                sendResponse({
                    success: false,
                    error: error.message,
                    message: `清空失败: ${error.message}`
                });
            });
        return true;
    }

    // 处理智能网页分析请求
    if (request.type === 'WEB_INTELLIGENCE_ANALYSIS') {
        const { pageContent, analysisResult, timestamp } = request;
        
        try {
            console.log('🧠 收到智能网页分析结果:', {
                url: pageContent.url,
                title: pageContent.title,
                confidence: analysisResult.confidence,
                isRelevant: analysisResult.isRelevant,
                suggestedStorage: analysisResult.suggestedStorage,
                extractedInfo: Object.keys(analysisResult.extractedInfo || {})
            });

            // 如果分析结果建议存储，进行进一步处理
            if (analysisResult.suggestedStorage || (analysisResult.isRelevant && analysisResult.confidence > 0.5)) {
                console.log('✅ 满足深度处理条件，调用agentThinking...');
                // 调用agentThinking进行深度分析和存储
                const agent = new IntelligentAgent();
                agent.analyze({
                    type: 'webpage',
                    url: pageContent.url,
                    title: pageContent.title,
                    content: pageContent.mainContent,
                    metadata: pageContent.metadata,
                    extractedInfo: analysisResult.extractedInfo
                }, {
                    type: 'webpage',
                    analysisDepth: 'normal'
                })
                .then(result => {
                    console.log('✅ 网页内容已通过agentThinking处理:', result);
                    sendResponse({ success: true, processed: true, result });
                })
                .catch(error => {
                    console.error('❌ agentThinking处理失败:', error);
                    sendResponse({ success: false, error: error.message });
                });
            } else {
                // 记录但不进行深度处理
                console.log('⏭️ 跳过深度处理:', {
                    suggestedStorage: analysisResult.suggestedStorage,
                    isRelevant: analysisResult.isRelevant,
                    confidence: analysisResult.confidence,
                    required: 'suggestedStorage=true OR (isRelevant=true AND confidence>0.5)'
                });
                sendResponse({ success: true, processed: false, reason: 'conditions_not_met' });
            }
        } catch (error) {
            console.error('❌ 处理智能网页分析失败:', error);
            sendResponse({ success: false, error: error.message });
        }
        
        return true; // 保持消息通道开放
    }

    // 获取智能网页分析统计
    if (request.type === 'GET_WEB_INTELLIGENCE_STATS') {
        try {
            const integrator = getWebIntelligenceIntegrator();
            const stats = integrator.getSystemStats();
            const componentStatus = integrator.getComponentStatus();
            
            sendResponse({
                success: true,
                stats,
                componentStatus
            });
        } catch (error) {
            console.error('❌ 获取智能分析统计失败:', error);
            sendResponse({ success: false, error: error.message });
        }
        return true;
    }

    // 智能网页分析健康检查
    if (request.type === 'WEB_INTELLIGENCE_HEALTH_CHECK') {
        try {
            const integrator = getWebIntelligenceIntegrator();
            integrator.healthCheck()
                .then(healthStatus => sendResponse({
                    success: true,
                    health: healthStatus
                }))
                .catch(error => sendResponse({
                    success: false,
                    error: error.message
                }));
        } catch (error) {
            console.error('❌ 智能分析健康检查失败:', error);
            sendResponse({ success: false, error: error.message });
        }
        return true;
    }

    // 使用仪表盘消息处理器处理项目相关消息
    if (request.type === 'GET_PROJECT_DATA' || 
        request.type === 'UPDATE_PROJECT_ITEM' || 
        request.type === 'QUICK_ACTION' ||
        request.type === 'ADD_PROJECT' ||
        request.type === 'SUGGEST_PROJECTS') {
        console.log('📊 仪表盘消息处理开始:', {
            type: request.type,
            projectId: request.projectId,
            timestamp: new Date().toISOString(),
            sender: sender.tab?.url || 'extension',
            request: request
        });
        
        // 检查仪表盘处理器是否已初始化
        if (!dashboardHandler) {
            console.error('❌ 仪表盘处理器未初始化，尝试重新创建...');
            try {
                dashboardHandler = new DashboardMessageHandler();
                console.log('✅ 仪表盘处理器重新创建成功');
            } catch (error) {
                console.error('❌ 无法创建仪表盘处理器:', error);
                sendResponse({ success: false, error: '仪表盘处理器初始化失败' });
                return true;
            }
        }
        
        (async () => {
            try {
                await dashboardHandler.handleMessage(request, sendResponse);
                console.log('✅ 仪表盘消息处理完成:', request.type);
            } catch (error) {
                console.error('❌ 仪表盘消息处理失败:', {
                    type: request.type,
                    error: error.message,
                    stack: error.stack
                });
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true;
    }

    // 深度分析网页内容
    if (request.type === 'DEEP_ANALYZE_WEB_CONTENT') {
        (async () => {
            try {
                const { pageContent, quickResult, userAction } = request.data;
                
                console.log('🔍 深度分析网页内容:', {
                    url: pageContent.url,
                    title: pageContent.title,
                    userAction
                });
                
                // 调用agentThinking进行深度分析
                const agent = new IntelligentAgent();
                const result = await agent.analyze({
                    type: 'webpage_deep',
                    url: pageContent.url,
                    title: pageContent.title,
                    content: pageContent.mainContent,
                    metadata: pageContent.metadata,
                    quickAnalysis: quickResult,
                    userAction
                                }, {
                        type: 'webpage',
                        analysisDepth: 'deep'
                    });
                
                sendResponse({ success: true, result });
            } catch (error) {
                console.error('❌ 深度分析失败:', error);
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true;
    }

    // 快速保存网页内容
    if (request.type === 'QUICK_SAVE_WEB_CONTENT') {
        (async () => {
            try {
                const { pageContent, quickResult, userAction } = request.data;
                
                console.log('💾 快速保存网页内容:', {
                    url: pageContent.url,
                    title: pageContent.title,
                    userAction
                });
                
                // 轻量级保存，不进行深度分析
                const agent = new IntelligentAgent();
                const result = await agent.analyze({
                    type: 'webpage_quick_save',
                    url: pageContent.url,
                    title: pageContent.title,
                    content: pageContent.mainContent,
                    metadata: pageContent.metadata,
                    quickAnalysis: quickResult,
                    userAction
                                }, {
                        type: 'webpage',
                        analysisDepth: 'quick'
                    });
                
                sendResponse({ success: true, result });
            } catch (error) {
                console.error('❌ 快速保存失败:', error);
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true;
    }

    // 记录分析结果
    if (request.type === 'RECORD_ANALYSIS_RESULT') {
        (async () => {
            try {
                const { url, result, timestamp } = request.data;
                
                // 记录到本地存储用于统计
                const analysisHistory = await chrome.storage.local.get('analysisHistory') || { analysisHistory: [] };
                analysisHistory.analysisHistory.push({
                    url,
                    result,
                    timestamp
                });
                
                // 保留最近100条记录
                if (analysisHistory.analysisHistory.length > 100) {
                    analysisHistory.analysisHistory = analysisHistory.analysisHistory.slice(-100);
                }
                
                await chrome.storage.local.set({ analysisHistory: analysisHistory.analysisHistory });
                
                sendResponse({ success: true });
            } catch (error) {
                console.error('❌ 记录分析结果失败:', error);
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true;
    }

    // 记录用户行为
    if (request.type === 'RECORD_USER_ACTION') {
        (async () => {
            try {
                const { action, url, timestamp } = request.data;
                
                // 记录用户行为用于改进推荐
                const userActions = await chrome.storage.local.get('userActions') || { userActions: [] };
                userActions.userActions.push({
                    action,
                    url,
                    timestamp
                });
                
                // 保留最近500条记录
                if (userActions.userActions.length > 500) {
                    userActions.userActions = userActions.userActions.slice(-500);
                }
                
                await chrome.storage.local.set({ userActions: userActions.userActions });
                
                sendResponse({ success: true });
            } catch (error) {
                console.error('❌ 记录用户行为失败:', error);
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true;
    }

    // 更新智能网页分析配置
    if (request.type === 'UPDATE_WEB_INTELLIGENCE_CONFIG') {
        try {
            const { config } = request;
            const integrator = getWebIntelligenceIntegrator();
            integrator.updateConfig(config);
            
            sendResponse({ success: true, message: '配置已更新' });
        } catch (error) {
            console.error('❌ 更新智能分析配置失败:', error);
            sendResponse({ success: false, error: error.message });
        }
        return true;
    }

    // 重启智能网页分析组件
    if (request.type === 'RESTART_WEB_INTELLIGENCE_COMPONENT') {
        try {
            const { component } = request;
            const integrator = getWebIntelligenceIntegrator();
            integrator.restartComponent(component)
                .then(success => sendResponse({
                    success,
                    message: success ? `组件 ${component} 重启成功` : `组件 ${component} 重启失败`
                }))
                .catch(error => sendResponse({
                    success: false,
                    error: error.message
                }));
        } catch (error) {
            console.error('❌ 重启智能分析组件失败:', error);
            sendResponse({ success: false, error: error.message });
        }
        return true;
    }
    
    return false;
});

// 启动定时任务
let timerFirstRunAlarms: NodeJS.Timeout | null = null;
export async function startScheduledCheck() {
    chrome.storage.local.set({ scheduleActive: true });
    
    // 获取最新配置
    const config = await getEnvConfig();
    
    // 先清除可能存在的旧定时任务
    chrome.alarms.clear('scheduledTask', () => {
        console.log('Old alarm cleared');
        
        // 创建新的定时任务
        chrome.alarms.create('scheduledTask', {
            periodInMinutes: Number(config.SCHEDULED_INTERVAL)
        });
        
        console.log(`Scheduled task set to run every ${config.SCHEDULED_INTERVAL} minutes`);
    });
    
    // 在启动定时任务时直接运行一次
    timerFirstRunAlarms = setTimeout(() => {
        runScheduledTask();
    }, 10000);
}

// 停止定时任务
export function stopScheduledCheck() {
    clearTimeout(timerFirstRunAlarms);
    chrome.storage.local.set({ scheduleActive: false });
    chrome.storage.local.remove('ollamaAnalysisProgress');
    chrome.alarms.clear('scheduledTask', (wasCleared) => {
        console.log('Scheduled task stopped:', wasCleared);
    });
}

// 定时抓取分析消息
async function runScheduledTask() {
    console.log('Running scheduled task');
    try {
        // 获取最新配置
        const config = await getEnvConfig();
        
        // 查找或创建 RingCentral 标签页
        let rcTab = await findRingCentralTab();
        if (!rcTab) {
            rcTab = await createRingCentralTab();
            // 等待页面加载完成
            await waitForTabLoad(rcTab.id);
        }

        let { userinfo } = await chrome.storage.local.get(['userinfo'])
        if (!userinfo || userinfo.fullName === '') userinfo = await getUserinfoFromRCpage();
        const startTime = new Date(Date.now() - (Number(config.SCHEDULED_INTERVAL) + 5) * 60 * 1000);

        // 尝试发送消息，如果失败则重试
        const response = await sendMessageWithRetry(rcTab.id, {
            type: 'FETCH_USER_MESSAGES',
            startTime,
        });
        await analyzeMessages(response.data, userinfo.fullName, true);
    } catch (error) {
        console.error('Background task error:', error);
    }
}

// 查找已打开的 RingCentral 标签页
export async function findRingCentralTab() {
    const tabs = await chrome.tabs.query({
        url: "*://app.ringcentral.com/*"
    });
    return tabs[0];
}

// 创建新的 RingCentral 标签页
export async function createRingCentralTab() {
    return await chrome.tabs.create({
        url: "https://app.ringcentral.com/messages",
        active: false
    });
}

// 等待标签页加载完成
export function waitForTabLoad(tabId: number): Promise<void> {
    return new Promise((resolve) => {
        chrome.tabs.onUpdated.addListener(function listener(updatedTabId, info) {
            if (updatedTabId === tabId && info.status === 'complete') {
                chrome.tabs.onUpdated.removeListener(listener);
                // 给页面一些额外时间来初始化 content script
                setTimeout(resolve, 1000);
            }
        });
    });
}

// 带重试机制的消息发送函数
function sendMessageWithRetry(tabId: number, message: any, maxRetries = 3, retryInterval = 10000): Promise<any> {
    return new Promise((resolve, reject) => {
        let attempts = 0;

        const trySendMessage = () => {
            attempts++;
            chrome.tabs.sendMessage(tabId, message, async response => {
                if (chrome.runtime.lastError) {
                    console.log(`Attempt ${attempts} failed:`, chrome.runtime.lastError);
                    if (attempts < maxRetries) {
                        if (chrome.runtime.lastError.message?.includes('Could not establish connection')) {
                            await chrome.tabs.reload(tabId);
                        }
                        setTimeout(trySendMessage, retryInterval); // 10秒后重试
                    } else {
                        reject(new Error('Failed to send message after multiple attempts'));
                    }
                } else {
                    if (response && !response.error) {
                        resolve(response);
                    } else {
                        // 30秒后再尝试一次
                        setTimeout(trySendMessage, retryInterval * 3);
                    }
                }
            });
        };

        trySendMessage();
    });
}

async function getUserinfoFromRCpage() {
    let rcTab = await findRingCentralTab();
    if (!rcTab) {
        rcTab = await createRingCentralTab();
        // 等待页面加载完成
        await waitForTabLoad(rcTab.id);
    }
    
    try {
        const response = await sendMessageWithRetry(rcTab.id, {
            type: 'GET_USER_INFO'
        });
        chrome.storage.local.set({
            userinfo: response.data || {
                fullName: "",
                username: "",
                userEmail: "",
                extensionId: "",
            }
        }); 
        return response.data;
    } catch (error) {
        console.error('Failed to get userinfo:', error);
        return null;
    }
}

// 处理幻灯片分析请求
async function handleSlideAnalysisRequest(tabId: number) {
    try {
        // 获取认证token
        const token = await getAuthToken();
        if (token) {
            // 发送回内容脚本
            chrome.tabs.sendMessage(tabId, { 
                type: 'ANALYZE_SLIDES_PROJECTS',
                token
            });
        } else {
            console.error('获取Google认证失败');
        }
    } catch (error) {
        console.error('处理幻灯片分析请求时出错:', error);
    }
}

// 生成项目数据 (模拟函数)
async function generateProjectData(projectId?: string) {
    // 模拟项目数据 - 实际实现中会从Jira、GitHub等数据源获取
    const mockProjects = [
        {
            id: 'project-1',
            name: '个人AI助手扩展',
            description: '基于Chrome扩展的智能项目管理和信息处理平台',
            status: 'in-progress',
            overallProgress: 75,
            startDate: new Date('2024-01-01'),
            endDate: new Date('2024-12-31'),
            milestones: [
                {
                    id: 'milestone-1',
                    name: '网页智能分析系统',
                    description: '实现通用网页内容智能分析',
                    progress: 90,
                    plannedDate: new Date('2024-03-15'),
                    actualDate: new Date('2024-03-20'),
                    status: 'completed',
                    dependencies: [],
                    assignees: [{ id: 'user1', name: '开发者A', role: '前端工程师' }],
                    tasks: [
                        {
                            id: 'task-1',
                            title: '实现UniversalContentScript',
                            description: '通用内容脚本开发',
                            status: 'done',
                            assignee: 'user1',
                            estimatedHours: 16,
                            actualHours: 18,
                            priority: 'high',
                            dependencies: [],
                            startDate: new Date('2024-03-01'),
                            endDate: new Date('2024-03-10')
                        },
                        {
                            id: 'task-2',
                            title: '集成Chrome AI',
                            description: '集成Chrome内置AI能力',
                            status: 'done',
                            assignee: 'user1',
                            estimatedHours: 12,
                            actualHours: 14,
                            priority: 'medium',
                            dependencies: ['task-1'],
                            startDate: new Date('2024-03-10'),
                            endDate: new Date('2024-03-18')
                        }
                    ]
                },
                {
                    id: 'milestone-2',
                    name: '项目可视化仪表盘',
                    description: '项目进度和团队状态可视化',
                    progress: 60,
                    plannedDate: new Date('2024-06-15'),
                    status: 'in-progress',
                    dependencies: ['milestone-1'],
                    assignees: [{ id: 'user1', name: '开发者A', role: '前端工程师' }],
                    tasks: [
                        {
                            id: 'task-3',
                            title: '甘特图组件开发',
                            description: '实现交互式甘特图',
                            status: 'in-progress',
                            assignee: 'user1',
                            estimatedHours: 24,
                            actualHours: 16,
                            priority: 'high',
                            dependencies: [],
                            startDate: new Date('2024-05-01'),
                            endDate: new Date('2024-05-20')
                        },
                        {
                            id: 'task-4',
                            title: '依赖关系图组件',
                            description: '项目依赖关系可视化',
                            status: 'todo',
                            assignee: 'user1',
                            estimatedHours: 20,
                            priority: 'medium',
                            dependencies: ['task-3'],
                            startDate: new Date('2024-05-20'),
                            endDate: new Date('2024-06-10')
                        }
                    ]
                }
            ],
            dependencies: [
                {
                    id: 'dep-1',
                    type: 'design',
                    source: 'milestone-1',
                    target: 'milestone-2',
                    status: 'completed',
                    criticality: 'high',
                    estimatedCompletion: new Date('2024-03-31'),
                    actualCompletion: new Date('2024-03-20')
                }
            ],
            team: [
                {
                    id: 'user1',
                    name: '开发者A',
                    role: '全栈工程师',
                    currentWorkload: 75,
                    availability: 80,
                    skills: ['React', 'TypeScript', 'Chrome Extensions', 'AI Integration'],
                    status: 'available'
                }
            ],
            risks: [
                {
                    id: 'risk-1',
                    title: 'Chrome AI API变更风险',
                    description: 'Chrome内置AI API仍在实验阶段，可能发生破坏性变更',
                    severity: 'medium',
                    probability: 30,
                    impact: '可能需要重写AI集成部分',
                    mitigation: '维护fallback方案，使用云端AI作为备选',
                    owner: 'user1',
                    status: 'mitigating',
                    identifiedDate: new Date('2024-02-15'),
                    targetResolutionDate: new Date('2024-08-01'),
                    category: 'technical'
                }
            ],
            lastUpdated: new Date()
        }
    ];
    
    if (projectId) {
        return mockProjects.filter(p => p.id === projectId);
    }
    
    return mockProjects;
}

// 同步项目数据
async function syncProjectData(projectId: string) {
    console.log('🔄 同步项目数据:', projectId);
    
    try {
        // 模拟从多个数据源同步
        // 实际实现中会调用Jira API、GitHub API等
        
        const syncResults = {
            jira: { synced: 5, updated: 2, errors: 0 },
            github: { synced: 8, updated: 1, errors: 0 },
            confluence: { synced: 3, updated: 0, errors: 0 }
        };
        
        // 记录同步结果到agentThinking
        const agent = new IntelligentAgent();
        await agent.analyze({
            type: 'data_sync',
            projectId,
            syncResults,
            timestamp: Date.now()
        }, {
            type: 'system_operation',
            analysisDepth: 'light'
        });
        
        return {
            success: true,
            syncResults,
            message: '数据同步完成'
        };
    } catch (error) {
        console.error('❌ 数据同步失败:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// 导出项目报告
async function exportProjectReport(projectId: string) {
    console.log('📊 导出项目报告:', projectId);
    
    try {
        const projectData = await generateProjectData(projectId);
        const project = projectData[0];
        
        if (!project) {
            throw new Error('项目不存在');
        }
        
        // 生成报告数据
        const report = {
            projectName: project.name,
            generatedAt: new Date().toISOString(),
            overallProgress: project.overallProgress,
            milestones: project.milestones.map(m => ({
                name: m.name,
                progress: m.progress,
                status: m.status,
                tasksTotal: m.tasks.length,
                tasksCompleted: m.tasks.filter(t => t.status === 'done').length
            })),
            teamMetrics: {
                totalMembers: project.team.length,
                averageWorkload: project.team.reduce((sum, m) => sum + m.currentWorkload, 0) / project.team.length,
                skillDistribution: project.team.flatMap(m => m.skills)
            },
            riskSummary: {
                totalRisks: project.risks.length,
                highRisks: project.risks.filter(r => r.severity === 'high').length,
                openRisks: project.risks.filter(r => r.status === 'open').length
            }
        };
        
        // 记录导出操作
        const agent = new IntelligentAgent();
        await agent.analyze({
            type: 'report_export',
            projectId,
            reportType: 'project_summary',
            timestamp: Date.now()
        }, {
            type: 'system_operation',
            analysisDepth: 'light'
        });
        
        return {
            success: true,
            report,
            downloadUrl: `data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(report, null, 2))}`
        };
    } catch (error) {
        console.error('❌ 报告导出失败:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// 创建项目项目
async function createProjectItem(actionType: string, data: any) {
    console.log('✅ 创建项目项目:', actionType, data);
    
    try {
        const { projectId, type, content, timestamp } = data;
        
        // 根据类型创建不同的项目
        let newItem = null;
        
        switch (actionType) {
            case 'create_milestone':
                newItem = {
                    id: `milestone-${Date.now()}`,
                    name: content.split('\n')[0] || '新里程碑',
                    description: content,
                    progress: 0,
                    plannedDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30天后
                    status: 'on-track',
                    dependencies: [],
                    assignees: [],
                    tasks: []
                };
                break;
                
            case 'create_task':
                newItem = {
                    id: `task-${Date.now()}`,
                    title: content.split('\n')[0] || '新任务',
                    description: content,
                    status: 'todo',
                    assignee: '',
                    estimatedHours: 8,
                    priority: 'medium',
                    dependencies: [],
                    startDate: new Date(),
                    endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7天后
                };
                break;
                
            case 'log_risk':
                newItem = {
                    id: `risk-${Date.now()}`,
                    title: content.split('\n')[0] || '新风险',
                    description: content,
                    severity: 'medium',
                    probability: 50,
                    impact: '待评估',
                    mitigation: '待制定',
                    owner: '',
                    status: 'open',
                    identifiedDate: new Date(),
                    targetResolutionDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14天后
                    category: 'general'
                };
                break;
        }
        
        // 记录创建操作到agentThinking
        const agent = new IntelligentAgent();
        await agent.analyze({
            type: 'item_creation',
            projectId,
            itemType: type,
            newItem,
            timestamp
        }, {
            type: 'project_management',
            analysisDepth: 'light'
        });
        
        return {
            success: true,
            newItem,
            message: `${type}创建成功`
        };
    } catch (error) {
        console.error('❌ 创建项目项目失败:', error);
        return {
            success: false,
            error: error.message
        };
    }
}
