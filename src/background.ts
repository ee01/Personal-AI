import { analyzeMessages, analyzeMessagesInBackground } from './messageDealing';
import { CloudStorage } from './storage/CloudStorage';
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
import { memorySystem } from './memory';
import { handleMemoryMessage } from './memoryMessageHandler';
// 旧的存储健康监控器已删除，使用新的系统维护工具
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

        // 获取用户信息
        try {
            let userinfo = null;
            // 查找并刷新 RingCentral 标签页
            const rcTab = await findRingCentralTab();
            if (rcTab && rcTab.id) {
                await chrome.tabs.reload(rcTab.id);
                console.log('RingCentral tab refreshed');
                
                // 延迟获取 RC Radar 配置
                userinfo = await getUserinfoFromRCpage();
            }
            // 如果获取不到用户信息，则从 jira.ringcentral.com 获取用户信息
            const cacheUserinfo = await chrome.storage.local.get(['userinfo']);
            if (!userinfo && !cacheUserinfo.userinfo) {
                userinfo = await getUserinfoFromJiraPage();
            }
        } catch (error) {
            console.error('Error refreshing RingCentral tab:', error);
        }

        // 安全地初始化Chroma - 使用新的CloudStorage系统
        try {
            const cloudStorage = new CloudStorage();
            if (await cloudStorage.initialize()) {
                console.log('ChromaDB cloud storage initialized');
            }
        } catch (error) {
            console.error('Failed to initialize ChromaDB cloud storage:', error);
        }

        // 预先创建离屏文档
        await createOffscreenDocument();

        // 初始化混合图存储和健康监控
        try {
            console.log('🔄 初始化记忆系统...');
            
            // 初始化记忆系统
            const initResult = await memorySystem.initialize();
            if (initResult) {
                const systemStatus = await memorySystem.getSystemStatus();
                console.log('📊 记忆系统状态:', systemStatus);
            } else {
                console.error('❌ 记忆系统初始化失败');
            }
            
            // 记忆系统已包含自动健康监控
            console.log('🎯 记忆系统监控已启动（内置于系统中）');
            
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

    // 数据迁移功能已移除，使用新的记忆系统
    if (request.type === 'MIGRATE_DATA_TO_GRAPH') {
        sendResponse({
            success: false,
            error: '数据迁移功能已弃用，请使用新的记忆系统进行数据管理'
        });
        return true;
    }

    // 处理存储健康检查请求
    if (request.type === 'GET_STORAGE_HEALTH') {
        memorySystem.performHealthCheck()
            .then(healthStatus => sendResponse({
                success: true,
                healthMetrics: healthStatus
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
        memorySystem.performSystemMaintenance()
            .then(maintenanceResult => sendResponse({
                success: maintenanceResult.success,
                data: maintenanceResult,
                message: maintenanceResult.success ? '维护任务执行成功' : '维护任务执行失败'
            }))
            .catch(error => sendResponse({
                success: false,
                error: error.message
            }));
        return true;
    }
    
    // 记忆界面相关消息处理
    const memoryResult = handleMemoryMessage(request);
    if (memoryResult !== null) {
        // 是记忆相关消息，处理异步结果
        memoryResult
            .then(response => sendResponse(response))
            .catch(error => {
                console.error('记忆消息处理失败:', error);
                sendResponse({
                    success: false,
                    error: error.message
                });
            });
        return true; // 保持消息通道开放
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

// 查找已打开的 JIRA 标签页
async function findJiraTab() {
    const tabs = await chrome.tabs.query({
        url: "*://jira.ringcentral.com/browse/*"
    });
    return tabs[0];
}

// 创建新的 JIRA 标签页
async function createJiraTab() {
    return await chrome.tabs.create({
        url: "https://jira.ringcentral.com/browse/MTR-1",
        active: false
    });
}

// 从 JIRA 页面获取用户信息
async function getUserinfoFromJiraPage() {
    let jiraTab = await findJiraTab();
    let shouldCloseTab = false;
    
    if (!jiraTab) {
        jiraTab = await createJiraTab();
        shouldCloseTab = true; // 标记需要关闭这个新创建的tab
        // 等待页面加载完成
        await waitForTabLoad(jiraTab.id);
    }
    
    try {
        const response = await sendMessageWithRetry(jiraTab.id, {
            type: 'GET_USER_INFO'
        });
        
        const userinfo = response.data || {
            fullName: "",
            username: "",
            userEmail: "",
            extensionId: "",
        };
        
        chrome.storage.local.set({ userinfo });
        if (userinfo.ownerId) chrome.storage.local.set({ ownerId: userinfo.ownerId });
        
        // 如果是新创建的tab，关闭它
        if (shouldCloseTab && jiraTab.id) {
            setTimeout(() => {
                chrome.tabs.remove(jiraTab.id);
            }, 1000); // 延迟1秒关闭，确保数据已保存
        }
        
        return userinfo;
    } catch (error) {
        console.error('Failed to get userinfo from JIRA:', error);
        
        // 如果出错且是新创建的tab，也要关闭它
        if (shouldCloseTab && jiraTab.id) {
            chrome.tabs.remove(jiraTab.id);
        }
        
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
                    dependencies: [] as string[],
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
                            dependencies: [] as string[],
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
            type: 'generic',
            analysisDepth: 'quick'
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
            type: 'generic',
            analysisDepth: 'quick'
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
                    dependencies: [] as string[],
                    assignees: [] as any[],
                    tasks: [] as any[]
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
                    dependencies: [] as string[],
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
            type: 'project',
            analysisDepth: 'quick'
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
