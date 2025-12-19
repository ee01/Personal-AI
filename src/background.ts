import { analyzeMessagesInBackground } from './messageDealing';
import { createOffscreenDocument, getEmbeddingInBackground, handleEmbeddingResult } from './embeddings';
import { getEnvConfig } from './utils';
import { FETCH_JIRA_TICKETS } from './jira';
import { getAuthToken } from './slide';
import { IntelligentAgent } from './agentThinking';
import { ProjectAnalysisResult } from './interfaces/analysisInterfaces';
import { memorySystem } from './memory';
import { handleMemoryMessage } from './modals/memory-exploring-messageHandler';
// 旧的存储健康监控器已删除，使用新的系统维护工具
import { getWebIntelligenceIntegrator } from './web-intelligence/WebIntelligenceIntegrator';
import { DashboardMessageHandler } from './utils/dashboardIntegration';
import { taskScheduler, TaskScheduler } from './services/TaskScheduler';
import { UserProfileMessageHandler } from './services/UserProfileMessageHandler';
import { findRingCentralTab, createRingCentralTab, waitForTabLoad, sendMessageWithRetry } from './utils/tabHelpers';
import { AppScriptUpdater } from './scheduled-messages/AppScriptUpdater';
import { JiraRuleUpdater } from './scheduled-messages/JiraRuleUpdater';
import { SheetSchemaUpdater } from './scheduled-messages/SheetSchemaUpdater';
import { ScheduledMessageService } from './scheduled-messages/ScheduledMessageService';
import { JiraAutomationService } from './scheduled-messages/JiraAutomationService';

console.log('Background script loaded');

// Background script 加载时检查并初始化任务调度器
// 
// 根据 Chrome Extension 官方文档:
// - chrome.management.onEnabled/onDisabled 只能监听其他扩展，无法监听自身
// - chrome.runtime.onInstalled 不会在扩展重新启用时触发
// - chrome.runtime.onStartup 只在浏览器启动时触发
// 
// 因此，当扩展被禁用后重新启用时，background script 会重新加载，
// 但不会触发任何生命周期事件。唯一可靠的方法是在 script 加载时主动检查。
// 
// 这会处理以下场景:
// 1. 扩展被禁用后重新启用 (重新加载 background script)
// 2. Chrome 浏览器重启 (配合 onStartup 的延迟)
// 3. 扩展被手动重新加载 (开发者工具中)
(async () => {
    try {
        // 延迟初始化，避免与 onInstalled 冲突
        setTimeout(async () => {
            await taskScheduler.startAllTasks();
        }, 5000); // 5秒延迟，确保扩展环境完全就绪
    } catch (error) {
        console.error('❌ Background script 初始化检查失败:', error);
    }
})();

// 浏览器启动时恢复任务调度器
chrome.runtime.onStartup.addListener(async () => {
    try {
        setTimeout(async () => {
            console.log('🔄 浏览器启动，恢复任务调度器...');
            await taskScheduler.startAllTasks();
        }, 10000);
    } catch (error) {
        console.error('❌ onStartup 监听器错误:', error);
    }
});

// 扩展安装、更新或重新启用时，立即创建定时任务，处理一些 Storage 的初始化
chrome.runtime.onInstalled.addListener(async (details) => {
    try {
        console.log('Extension event:', details.reason); // 可能的值: install, update, chrome_update, shared_module_update
        
        // 加载配置
        const config = await getEnvConfig();
        console.log('Global config loaded:', config);

        // 启动统一任务调度器
        await taskScheduler.startAllTasks();
        
        // 如果是扩展更新，检查并更新 Sheet Schema、App Script 和 Jira Rule
        if (details.reason === 'update') {
            console.log('🔄 检测到扩展更新，检查 Sheet Schema、App Script 和 Jira Rule 是否需要更新...');
            
            // 1. 检查并更新 Sheet Schema（先更新表结构，再更新脚本）
            SheetSchemaUpdater.checkAndAutoUpdate(getAuthToken, {
                showNotification: true
            }).catch(error => {
                console.error('❌ Sheet Schema 自动更新失败:', error);
            });
            
            // 2. 检查并更新 App Script（延迟 3 秒，等待 Schema 更新完成）
            setTimeout(() => {
                AppScriptUpdater.checkAndAutoUpdate(getAuthToken).catch(error => {
                    console.error('❌ App Script 自动更新失败:', error);
                });
            }, 3000);
            
            // 3. 检查并更新 Jira Automation Rule（延迟 8 秒，避免与上面的更新冲突）
            JiraRuleUpdater.checkAndAutoUpdate(getAuthToken, {
                delay: 8000,
                showNotification: true
            }).catch(error => {
                console.error('❌ Jira Rule 自动更新失败:', error);
            });
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

        // 预先创建离屏文档
        await createOffscreenDocument();
    } catch (error) {
        console.error('Error in onInstalled listener:', error);
    }
});

// ========================================
// 🔥 关键修复：立即设置 alarm 监听器
// ========================================
// Manifest V3 Service Worker 会在不活动时被终止。
// 当 chrome.alarms 触发时会唤醒 Service Worker，
// 但必须确保监听器在 Service Worker 启动时立即设置，
// 否则 alarm 事件会丢失！
//
// 监听器必须在顶层同步设置，不能延迟或等待异步初始化。
chrome.alarms.onAlarm.addListener(async (alarm) => {
    console.log('🔔 收到 alarm 事件:', alarm.name);
    
    try {
        // 所有定时任务统一由 TaskScheduler 管理
        if (await TaskScheduler.tryHandleAlarm(alarm)) {
            return;
        }
        
        // 如果有其他模块需要处理 alarm，在这里添加
        // if (await OtherModule.tryHandleAlarm(alarm)) {
        //     return;
        // }
        
        // 处理未知 alarm
        console.log(`⚡ 未处理的 alarm 事件: ${alarm.name}`);
    } catch (error) {
        console.error('❌ 处理 alarm 事件失败:', error);
    }
});
console.log('✅ Alarm 监听器已设置（顶层同步）');

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // 全局日志：记录所有收到的消息
    console.log('🔔 Background 收到消息:', request.type, '来自:', sender.tab?.url || sender.url || 'unknown');
    
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

    // 获取任务调度状态
    if (request.type === 'GET_TASK_SCHEDULER_STATUS') {
        const status = taskScheduler.getTaskStatus();
        sendResponse({ success: true, tasks: status });
        return true;
    }

    // 控制特定任务
    if (request.type === 'CONTROL_TASK') {
        const { taskId, action } = request;
        
        (async () => {
            try {
                if (action === 'toggle') {
                    const success = await taskScheduler.toggleTask(taskId, request.enabled);
                    sendResponse({ success, message: success ? '任务状态已更新' : '任务控制失败' });
                } else if (action === 'run') {
                    const success = await taskScheduler.runTaskManually(taskId);
                    sendResponse({ success, message: success ? '任务执行成功' : '任务执行失败' });
                }
            } catch (error) {
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true;
    }

    if (request.type === 'KNOWLEDGE_QUERY') {
        memorySystem.ask(request.question).then(result => {
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
    if (request.type === 'EXEC_EMBEDDING_REQUEST') {
        getEmbeddingInBackground(request.text).then((result: any) => {
          sendResponse(result);
        });
        return true
    }

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
        memorySystem.initialize().then(() => {
            memorySystem.performHealthCheck()
                .then(healthStatus => sendResponse({
                    success: true,
                    healthMetrics: healthStatus
                }))
                .catch(error => sendResponse({
                    success: false,
                    error: error.message
                }));
        });
        return true;
    }

    // 处理维护任务执行请求
    if (request.type === 'RUN_MAINTENANCE_TASK') {
        const { taskId: _taskId } = request;
        memorySystem.initialize().then(() => {
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
        });
        return true;
    }

    // 🆕 处理用户画像相关请求
    const userProfileHandled = UserProfileMessageHandler.handleMessage(request, sender, sendResponse);
    if (userProfileHandled) {
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
        const { pageContent, analysisResult, timestamp: _timestamp } = request;
        
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
        
        (async () => {
            try {
                const dashboardHandler = new DashboardMessageHandler();
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
    
    // =====================================================
    // Jira Automation 导入 Scheduled Messages 功能
    // =====================================================
    
    // 转换 Jira Rule 的 trigger 为 incoming webhook
    if (request.type === 'CONVERT_JIRA_RULE_TO_WEBHOOK') {
        (async () => {
            try {
                const { ruleId, projectId, jiraUrl } = request.data;
                
                // 使用静态导入的 JiraAutomationService（避免 Service Worker 中动态导入问题）
                const service = new JiraAutomationService();
                
                // 获取项目 Key
                const projectResponse = await fetch(`${jiraUrl}/rest/api/2/project/${projectId}`, {
                    credentials: 'include'
                });
                const projectData = await projectResponse.json();
                const projectKey = projectData.key;
                
                const config = {
                    jiraUrl,
                    projectKey
                };
                
                // 转换为 webhook trigger
                const webhookUrl = await service.convertToWebhookTrigger(config, ruleId);
                
                sendResponse({ success: true, webhookUrl });
            } catch (error: any) {
                console.error('转换 Jira Rule 为 webhook 失败:', error);
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true;
    }
    
    // 将 Incoming Webhook Trigger 转换回 Scheduled Trigger（撤销托管）
    if (request.type === 'CONVERT_WEBHOOK_TO_SCHEDULED') {
        (async () => {
            try {
                const { ruleId, projectId, jiraUrl, scheduleConfig } = request.data;
                console.log(`🔄 将规则 ${ruleId} 的 trigger 转换回 scheduled...`);
                
                // 使用 JiraAutomationService
                const service = new JiraAutomationService();
                
                // 获取项目 Key
                const projectResponse = await fetch(`${jiraUrl}/rest/api/2/project/${projectId}`, {
                    credentials: 'include'
                });
                const projectData = await projectResponse.json();
                const projectKey = projectData.key;
                
                const config = {
                    jiraUrl,
                    projectKey
                };
                
                // 转换为 scheduled trigger
                await service.convertToScheduledTrigger(config, ruleId, scheduleConfig);
                
                sendResponse({ success: true });
            } catch (error: any) {
                console.error('转换 Jira Rule 为 scheduled 失败:', error);
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true;
    }
    
    // 添加 Scheduled Message（从 Jira Automation 页面调用）
    if (request.type === 'ADD_SCHEDULED_MESSAGE') {
        (async () => {
            try {
                console.log('📝 收到 ADD_SCHEDULED_MESSAGE 请求:', request.data);
                const messageData = request.data;
                
                // 获取配置和 token
                const result = await chrome.storage.local.get(['scheduledMessagesConfig']);
                const config = result.scheduledMessagesConfig;
                
                console.log('📋 Scheduled Messages 配置:', config);
                
                if (!config || !config.sheetId) {
                    console.error('❌ 未配置 Scheduled Messages');
                    sendResponse({ success: false, error: '未配置 Scheduled Messages，请先在设置中初始化' });
                    return;
                }
                
                // 获取 auth token
                console.log('🔐 获取 Google 认证 token...');
                const token = await getAuthToken();
                console.log('✅ Token 获取成功');
                
                // 使用静态导入的 ScheduledMessageService（避免 Service Worker 中动态导入问题）
                const service = new ScheduledMessageService(token);
                
                console.log('📤 创建消息:', messageData);
                // 创建消息
                const newMessage = await service.createMessage(messageData);
                
                console.log('✅ 消息创建成功:', newMessage);
                sendResponse({ success: true, message: newMessage });
            } catch (error: any) {
                console.error('❌ 添加 Scheduled Message 失败:', error);
                console.error('错误堆栈:', error.stack);
                sendResponse({ success: false, error: error.message || '未知错误' });
            }
        })();
        return true;
    }
    
    // 检查 Automation_Link 是否已存在于 Scheduled Messages 中
    if (request.type === 'CHECK_AUTOMATION_LINK_EXISTS') {
        (async () => {
            try {
                const { automationLink } = request.data;
                console.log('🔍 检查 Automation_Link 是否存在:', automationLink);
                
                // 获取配置和 token
                const result = await chrome.storage.local.get(['scheduledMessagesConfig']);
                const config = result.scheduledMessagesConfig;
                
                if (!config || !config.sheetId) {
                    sendResponse({ exists: false });
                    return;
                }
                
                const token = await getAuthToken();
                const service = new ScheduledMessageService(token);
                const messages = await service.getAllMessages();
                
                // 检查是否有相同的 Automation_Link
                const exists = messages.some(msg => msg.Automation_Link === automationLink);
                console.log('🔍 检查结果:', exists ? '已存在' : '不存在');
                sendResponse({ exists });
            } catch (error: any) {
                console.error('❌ 检查 Automation_Link 失败:', error);
                sendResponse({ exists: false, error: error.message });
            }
        })();
        return true;
    }
    
    // 批量检查多个 Automation_Link 是否已存在于 Scheduled Messages 中
    if (request.type === 'BATCH_CHECK_AUTOMATION_LINKS_EXIST') {
        (async () => {
            try {
                const { automationLinks } = request.data;
                console.log('🔍 批量检查 Automation_Links 是否存在:', automationLinks.length, '个');
                
                // 获取配置和 token
                const result = await chrome.storage.local.get(['scheduledMessagesConfig']);
                const config = result.scheduledMessagesConfig;
                
                if (!config || !config.sheetId) {
                    const emptyResults: Record<string, boolean> = {};
                    automationLinks.forEach((link: string) => {
                        emptyResults[link] = false;
                    });
                    sendResponse({ results: emptyResults });
                    return;
                }
                
                const token = await getAuthToken();
                const service = new ScheduledMessageService(token);
                const messages = await service.getAllMessages();
                
                // 构建 Automation_Link 的 Set 用于快速查找
                const existingLinks = new Set(messages.map(msg => msg.Automation_Link).filter(Boolean));
                
                // 批量检查每个链接
                const results: Record<string, boolean> = {};
                automationLinks.forEach((link: string) => {
                    results[link] = existingLinks.has(link);
                });
                
                const existCount = Object.values(results).filter(Boolean).length;
                console.log(`🔍 批量检查完成: ${existCount}/${automationLinks.length} 个已存在`);
                sendResponse({ results });
            } catch (error: any) {
                console.error('❌ 批量检查 Automation_Links 失败:', error);
                sendResponse({ results: {}, error: error.message });
            }
        })();
        return true;
    }
    
    // 调用 LLM 总结规则内容
    if (request.type === 'CALL_LLM_SUMMARIZE') {
        (async () => {
            try {
                const { prompt } = request.data;
                console.log('🤖 调用 LLM 总结规则...');
                
                const { handleLLMRequest } = await import('./llm');
                const summary = await handleLLMRequest({ prompt });
                
                console.log('✅ LLM 总结完成:', summary);
                sendResponse({ success: true, summary });
            } catch (error: any) {
                console.error('❌ LLM 总结失败:', error);
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true;
    }
    
    // 更新 Jira Automation Rule 状态（启用/禁用）
    if (request.type === 'UPDATE_JIRA_RULE_STATE') {
        (async () => {
            try {
                const { jiraUrl, projectId, ruleId, newState, ruleData } = request.data;
                console.log(`🔄 更新 Jira Rule ${ruleId} 状态为: ${newState}`);
                
                // 发送请求更新规则状态
                const response = await fetch(`${jiraUrl}/rest/cb-automation/latest/project/${projectId}/rule/${ruleId}`, {
                    method: 'PUT',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json',
                        'Cache-Control': 'no-cache'
                    },
                    credentials: 'include',
                    body: JSON.stringify({
                        ...ruleData,
                        state: newState
                    })
                });
                
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`更新失败 (${response.status}): ${errorText}`);
                }
                
                console.log(`✅ Jira Rule ${ruleId} 状态更新成功`);
                sendResponse({ success: true });
            } catch (error: any) {
                console.error('❌ 更新 Jira Rule 状态失败:', error);
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true;
    }
    
    // 获取 Jira Automation Rule 详情
    if (request.type === 'GET_JIRA_RULE_DETAILS') {
        (async () => {
            try {
                const { jiraUrl, projectId, ruleId } = request.data;
                console.log(`📖 获取 Jira Rule ${ruleId} 详情...`);
                
                // 使用获取规则列表的接口（单条规则接口不支持 GET）
                const response = await fetch(`${jiraUrl}/rest/cb-automation/latest/project/${projectId}/rule`, {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json',
                        'Cache-Control': 'no-cache'
                    },
                    credentials: 'include'
                });
                
                if (!response.ok) {
                    throw new Error(`获取失败 (${response.status})`);
                }
                
                const rules = await response.json();
                // 在规则列表中查找指定的 rule ID
                const ruleData = rules.find((r: any) => String(r.id) === String(ruleId));
                
                if (!ruleData) {
                    throw new Error(`未找到规则 ${ruleId}`);
                }
                
                console.log(`✅ 获取 Jira Rule ${ruleId} 成功`);
                sendResponse({ success: true, ruleData });
            } catch (error: any) {
                console.error('❌ 获取 Jira Rule 详情失败:', error);
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true;
    }
    
    return false;
});


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
        url: "https://jira.ringcentral.com/browse/MTR-620",
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

// 同步项目数据（预留功能）
async function _syncProjectData(projectId: string) {
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

// 导出项目报告（预留功能）
async function _exportProjectReport(projectId: string) {
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

// 创建项目项目（预留功能）
async function _createProjectItem(actionType: string, data: any) {
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
