import { analyzeMessagesInBackground } from './messageDealing';
import { createOffscreenDocument, getEmbeddingInBackground, handleEmbeddingResult } from './embeddings';
import { getEnvConfig } from './utils';
import { FETCH_JIRA_TICKETS } from './jira';
import { getGoogleAuthToken, getGoogleAuthTokenSilently } from './utils/googleAuth';
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
import { getCurrentUser, getProjectByKey, jiraFetch, getTicketDetail } from './jira';
import { handleLLMRequest } from './llm';

import { Logger } from './utils/logger';
import { cleanupExpiredFollowThreads, getNextCleanupTime, storeRelatedMessage, registerFollowThreadDigestTask } from './message-reaction/FollowThreadHandler';
import { registerConcernedItemsDigestTask } from './services/DigestQueueService';

console.log('Background script loaded');

// 注册 Digest 任务（关注后续合并通知、concernedItems 每日摘要等）
registerFollowThreadDigestTask();
registerConcernedItemsDigestTask();

// 记录扩展启动
Logger.lifecycle('startup', 'Background script loaded');

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
        
        // 记录生命周期事件
        const manifest = chrome.runtime.getManifest();
        Logger.lifecycle(details.reason, `扩展 ${details.reason}`, {
            version: manifest.version,
            previousVersion: details.previousVersion,
        });
        
        // 如果是更新，记录版本升级日志
        if (details.reason === 'update' && details.previousVersion) {
            Logger.upgrade(manifest.version, true, `从 v${details.previousVersion} 升级到 v${manifest.version}`);
        } else if (details.reason === 'install') {
            Logger.upgrade(manifest.version, true, `首次安装 v${manifest.version}`);
        }
        
        // 加载配置
        const config = await getEnvConfig();
        console.log('Global config loaded:', config);

        // 启动统一任务调度器
        await taskScheduler.startAllTasks();
        
        // 如果是扩展更新，检查并更新 Sheet Schema、App Script 和 Jira Rule
        // 注意：使用 getCachedAuthToken 避免在无用户操作时弹出授权窗口
        if (details.reason === 'update') {
            console.log('🔄 检测到扩展更新，检查 Sheet Schema、App Script 和 Jira Rule 是否需要更新...');
            
            // 1. 检查并更新 Sheet Schema（先更新表结构，再更新脚本）
            // 使用静默方法：只使用缓存的 token，不弹出授权窗口
            SheetSchemaUpdater.checkAndAutoUpdate(() => getGoogleAuthTokenSilently({ caller: 'background.autoUpdateSchema' }), {
                showNotification: true
            }).then(() => {
                Logger.upgrade(manifest.version, true, 'Sheet Schema 更新成功', { component: 'SheetSchema' });
            }).catch(error => {
                console.error('❌ Sheet Schema 自动更新失败:', error);
                Logger.upgrade(manifest.version, false, 'Sheet Schema 更新失败', { component: 'SheetSchema', error: error.message });
            });
            
            // 2. 检查并更新 App Script（延迟 3 秒，等待 Schema 更新完成）
            // 使用静默方法：只使用缓存的 token，不弹出授权窗口
            setTimeout(() => {
                AppScriptUpdater.checkAndAutoUpdate(() => getGoogleAuthTokenSilently({ caller: 'background.autoUpdateAppScript' })).then(() => {
                    Logger.upgrade(manifest.version, true, 'App Script 更新成功', { component: 'AppScript' });
                }).catch(error => {
                    console.error('❌ App Script 自动更新失败:', error);
                    Logger.upgrade(manifest.version, false, 'App Script 更新失败', { component: 'AppScript', error: error.message });
                });
            }, 3000);
            
            // 3. 检查并更新 Jira Automation Rule（延迟 8 秒，避免与上面的更新冲突）
            // 使用静默方法：只使用缓存的 token，不弹出授权窗口
            JiraRuleUpdater.checkAndAutoUpdate(() => getGoogleAuthTokenSilently({ caller: 'background.autoUpdateJiraRule' }), {
                delay: 8000,
                showNotification: true
            }).then(() => {
                Logger.upgrade(manifest.version, true, 'Jira Rule 更新成功', { component: 'JiraRule' });
            }).catch(error => {
                console.error('❌ Jira Rule 自动更新失败:', error);
                Logger.upgrade(manifest.version, false, 'Jira Rule 更新失败', { component: 'JiraRule', error: error.message });
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
        // notifyMethod 使用逗号分隔格式，如 'bot,chrome'
        if (!concernedItems || concernedItems.length === 0) {
            chrome.storage.local.set({concernedItems: [
                {id: '1', text:'聊到关于公司政策，也可以是政策相关的八卦消息', expiredAt: 0, notifyMethod: 'bot'},
                {id: '2', text:'任何提到我的名字的消息，排除 @Team，排除明确@{我的名字}，排除发送者是我', expiredAt: 0, notifyMethod: 'chrome'},
                {id: '3', text:'可能是回复我的消息，比如在我发完消息之后的答复。排除发送者是我，排除明确@{我的名字}', expiredAt: 0, notifyMethod: 'bot', mentionMe: true},
            ]});
        } else {
            // 迁移旧的 pushToGlip 到 notifyMethod
            let needsMigration = false;
            const migratedItems = concernedItems.map((item: any) => {
                if (item.pushToGlip !== undefined && !item.notifyMethod) {
                    needsMigration = true;
                    return {
                        ...item,
                        notifyMethod: item.pushToGlip ? 'bot' : '',
                        pushToGlip: undefined  // 移除旧字段
                    };
                }
                return item;
            });
            if (needsMigration) {
                await chrome.storage.local.set({ concernedItems: migratedItems });
                console.log('✅ 已迁移 pushToGlip 到 notifyMethod');
            }
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

        // 处理关注后续清理任务
        if (alarm.name === 'cleanupFollowThreads') {
            await cleanupExpiredFollowThreads();
            // 设置下一次清理时间
            chrome.alarms.create('cleanupFollowThreads', {
                when: getNextCleanupTime()
            });
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
            sendResponse(raw);
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

    // 获取单个 Jira ticket 的详细信息（用于消息中的 Jira 链接预览）
    if (request.type === 'FETCH_JIRA_TICKET_DETAIL') {
        (async () => {
            const { ticketKey } = request;
            console.log(`📋 获取 Jira Ticket 详情: ${ticketKey}`);
            const result = await getTicketDetail(ticketKey);
            sendResponse(result);
        })();
        return true; // 保持消息通道开放
    }

    // 获取 DORA Metrics Rollout Date（避免 CORS 问题）
    if (request.type === 'FETCH_ROLLOUT_DATE') {
        (async () => {
            const { fixVersion } = request;
            console.log(`📊 获取 Rollout Date: ${fixVersion}`);
            try {
                const url = `https://rcv-dora-metrics.int.rclabenv.com/api/releases/${encodeURIComponent(fixVersion)}/lead-time`;
                const response = await fetch(url, { method: 'GET' });
                if (!response.ok) {
                    sendResponse({ success: false, data: null });
                    return;
                }
                const data = await response.json();
                const rolloutDate = data.metrics?.lastMrMergedTimestamp || null;
                sendResponse({ success: true, data: rolloutDate });
            } catch (error) {
                console.error('获取 Rollout Date 失败:', error);
                sendResponse({ success: false, data: null });
            }
        })();
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
                
                // 获取项目 Key（使用统一的 jiraFetch，自动支持 token 和 cookie）
                const projectResponse = await jiraFetch(`${jiraUrl}/rest/api/2/project/${projectId}`);
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
                
                // 获取项目 Key（使用统一的 jiraFetch）
                const projectResponse = await jiraFetch(`${jiraUrl}/rest/api/2/project/${projectId}`);
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
                
                // 获取 auth token（用户主动操作，可以弹窗）
                console.log('🔐 获取 Google 认证 token...');
                const token = await getGoogleAuthToken({ caller: 'background.createScheduledMessage' });
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
                
                // 🔧 使用静默方法，避免在后台检查时弹出授权窗口
                console.log('🔐 [background.CHECK_AUTOMATION_LINK_EXISTS] 使用静默方法（自动检查）');
                const token = await getGoogleAuthTokenSilently({ caller: 'background.checkAutomationLink' });
                if (!token) {
                    console.warn('🔐 [background.CHECK_AUTOMATION_LINK_EXISTS] 无缓存 token，返回不存在');
                    sendResponse({ exists: false });
                    return;
                }
                
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
                
                // 🔧 使用静默方法，避免在后台批量检查时弹出授权窗口
                console.log('🔐 [background.BATCH_CHECK_AUTOMATION_LINKS] 使用静默方法（自动预加载）');
                const token = await getGoogleAuthTokenSilently({ caller: 'background.batchCheckAutomationLinks' });
                if (!token) {
                    console.warn('🔐 [background.BATCH_CHECK_AUTOMATION_LINKS] 无缓存 token，返回空结果');
                    const emptyResults: Record<string, boolean> = {};
                    automationLinks.forEach((link: string) => {
                        emptyResults[link] = false;
                    });
                    sendResponse({ results: emptyResults });
                    return;
                }
                
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
                
                // 发送请求更新规则状态（使用统一的 jiraFetch）
                const response = await jiraFetch(`${jiraUrl}/rest/cb-automation/latest/project/${projectId}/rule/${ruleId}`, {
                    method: 'PUT',
                    body: {
                        ...ruleData,
                        state: newState
                    }
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
    
    // 批量获取某个项目的所有 Jira Automation Rules（用于状态同步优化）
    if (request.type === 'GET_ALL_JIRA_RULES') {
        (async () => {
            try {
                const { jiraUrl, projectId } = request.data;
                console.log(`📖 批量获取项目 ${projectId} 的所有 Jira Rules...`);
                
                const response = await jiraFetch(`${jiraUrl}/rest/cb-automation/latest/project/${projectId}/rule`);
                
                if (!response.ok) {
                    throw new Error(`获取失败 (${response.status})`);
                }
                
                const rules = await response.json();
                console.log(`✅ 获取项目 ${projectId} 的 ${rules.length} 条规则成功`);
                sendResponse({ success: true, rules });
            } catch (error: any) {
                console.error('❌ 批量获取 Jira Rules 失败:', error);
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
                
                // 使用获取规则列表的接口（使用统一的 jiraFetch）
                const response = await jiraFetch(`${jiraUrl}/rest/cb-automation/latest/project/${projectId}/rule`);
                
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
    
    // 更新 Jira Automation Rule 名称（同步 Topic）
    if (request.type === 'UPDATE_JIRA_RULE_NAME') {
        (async () => {
            try {
                const { jiraUrl, projectId, ruleId, newName, ruleData } = request.data;
                console.log(`📝 更新 Jira Rule ${ruleId} 名称为: ${newName}`);
                
                // 发送请求更新规则名称（使用统一的 jiraFetch）
                const response = await jiraFetch(`${jiraUrl}/rest/cb-automation/latest/project/${projectId}/rule/${ruleId}`, {
                    method: 'PUT',
                    body: {
                        ...ruleData,
                        name: newName
                    }
                });
                
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`更新失败 (${response.status}): ${errorText}`);
                }
                
                console.log(`✅ Jira Rule ${ruleId} 名称更新成功`);
                sendResponse({ success: true });
            } catch (error: any) {
                console.error('❌ 更新 Jira Rule 名称失败:', error);
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true;
    }
    
    // 打开定时消息管理界面
    if (request.type === 'OPEN_SCHEDULED_MESSAGES') {
        (async () => {
            try {
                console.log('📅 打开定时消息管理界面...');
                const url = chrome.runtime.getURL('scheduled-messages.html');
                await chrome.tabs.create({ url });
                sendResponse({ success: true });
            } catch (error: any) {
                console.error('❌ 打开定时消息管理界面失败:', error);
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true;
    }
    
    // 打开自动答复配置界面（从消息悬浮菜单触发）
    if (request.type === 'OPEN_AUTO_REPLY_CONFIG') {
        (async () => {
            try {
                console.log('🤖 打开自动答复配置界面...', request.data);
                
                // 将消息上下文存储到 storage，供 topic-modal 使用
                if (request.data) {
                    await chrome.storage.local.set({
                        pendingAutoReplyConfig: {
                            sender: request.data.sender,
                            groupId: request.data.groupId,
                            groupName: request.data.groupName,
                            content: request.data.content,
                            messageId: request.data.messageId,
                            timestamp: Date.now()
                        }
                    });
                }
                
                // 使用独立窗口打开 topic-modal 页面
                const url = chrome.runtime.getURL('topic-modal.html');
                await chrome.windows.create({
                    url,
                    type: 'popup',
                    width: 920,
                    height: 720
                });
                sendResponse({ success: true });
            } catch (error: any) {
                console.error('❌ 打开自动答复配置界面失败:', error);
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true;
    }
    
    // RPA: 获取 JIRA 当前用户信息（使用 jira.ts 的通用方法）
    if (request.type === 'RPA_GET_JIRA_CURRENT_USER') {
        (async () => {
            console.log('👤 RPA: 获取 JIRA 当前用户...');
            const result = await getCurrentUser();
            if (result.success) {
                console.log('✅ 获取到用户:', result.ownerId);
            } else {
                console.error('❌ 获取 JIRA 用户信息失败:', result.error);
            }
            sendResponse(result);
        })();
        return true;
    }
    
    // RPA: 通过 projectKey 获取 projectId（使用 jira.ts 的通用方法）
    if (request.type === 'RPA_GET_JIRA_PROJECT_ID') {
        (async () => {
            const { projectKey } = request.data;
            console.log(`🔍 RPA: 获取项目 ${projectKey} 的 ID...`);
            const result = await getProjectByKey(projectKey);
            if (result.success) {
                console.log(`✅ 项目 ${projectKey} 的 ID: ${result.projectId}`);
            } else {
                console.error('❌ 获取项目 ID 失败:', result.error);
            }
            sendResponse(result);
        })();
        return true;
    }
    
    // =====================================================
    // Snooze 稍后处理功能
    // =====================================================
    
    // 创建 Snooze 提醒（从 RingCentral 消息页面调用）
    // 注意：MV3 Service Worker 有严格的生命周期管理，需要快速返回响应
    if (request.type === 'CREATE_SNOOZE_REMINDER') {
        console.log('🔔 Background: 收到 CREATE_SNOOZE_REMINDER 请求');
        
        // 使用同步方式获取必要数据，然后快速响应
        const { messageInfo, remindAt, note } = request.data;
        console.log('🔔 Background: Snooze 请求数据:', {
            messageId: messageInfo?.id,
            groupName: messageInfo?.groupName,
            remindAt: remindAt
        });
        
        // 快速处理核心逻辑，然后立即响应
        (async () => {
            try {
                // 获取配置
                console.log('🔔 Background: 获取配置...');
                const result = await chrome.storage.local.get(['scheduledMessagesConfig', 'userinfo']);
                const config = result.scheduledMessagesConfig;
                const userinfo = result.userinfo;
                
                console.log('🔔 Background: 配置状态:', {
                    hasConfig: !!config,
                    hasSheetId: !!config?.sheetId,
                    hasUserinfo: !!userinfo
                });
                
                if (!config || !config.sheetId) {
                    console.error('❌ Background: 未配置 Scheduled Messages');
                    sendResponse({ success: false, error: '请先在设置中初始化定时消息系统' });
                    return;
                }
                
                // 获取 auth token（用户主动操作，可以弹窗）
                console.log('🔔 Background: 获取 Google Auth Token...');
                const token = await getGoogleAuthToken({ caller: 'background.createSnoozeMessage' });
                console.log('🔔 Background: Token 获取成功');
                
                const service = new ScheduledMessageService(token);
                
                // 格式化提醒时间
                const remindDate = new Date(remindAt);
                const dateStr = remindDate.toISOString().split('T')[0];  // YYYY-MM-DD
                const timeStr = remindDate.toTimeString().slice(0, 5);   // HH:mm
                
                console.log('🔔 Background: 提醒时间:', dateStr, timeStr);
                
                // 直接使用群组名作为 Topic，跳过耗时的 LLM 调用
                // LLM 摘要会在后台异步更新
                const topicSummary = messageInfo.groupName || '消息提醒';
                
                // 构建提醒内容
                const contentParts = [
                    `📌 **您设置了一个稍后处理提醒**`,
                    ``,
                    `**来自**: ${messageInfo.senderName}`,
                    `**群组**: ${messageInfo.groupName}`,
                    `**原文摘要**:`,
                    `> ${messageInfo.content}`,
                    ``,
                    `🔗 [点击查看原消息](${messageInfo.messageLink})`
                ];
                
                if (note) {
                    contentParts.splice(2, 0, `**备注**: ${note}`);
                }
                
                // 创建定时消息（核心操作）
                console.log('🔔 Background: 创建定时消息...');
                const newMessage = await service.createMessage({
                    Topic: `稍后处理: ${topicSummary}`,
                    Content: contentParts.join('\n'),
                    Schedule_Date: dateStr,
                    Schedule_Time: timeStr,
                    Push_Method: 'Bot',
                    Target_Type: 'private',
                    Glip_User_Name: userinfo?.fullName || userinfo?.username || '',
                    Category: 'Snooze,提醒'
                });
                
                console.log('✅ Background: Snooze 定时消息创建成功:', newMessage.ID);
                
                // 🔥 立即发送成功响应，避免消息通道超时
                sendResponse({ success: true, messageId: newMessage.ID });
                
                // ========== 以下为后台异步任务，不阻塞响应 ==========
                
                // 异步生成 LLM 摘要并更新 Topic（可选，失败不影响主功能）
                setTimeout(async () => {
                    try {
                        console.log('🔔 Background: 后台生成消息摘要...');
                        const summaryPrompt = `请用不超过15个字概括以下消息的核心内容，直接输出摘要，不要任何前缀或解释：

消息内容：${messageInfo.content}`;
                        
                        const summaryResult = await handleLLMRequest({ prompt: summaryPrompt });
                        if (summaryResult && summaryResult.trim()) {
                            const newTopicSummary = summaryResult.trim().substring(0, 20);
                            console.log('✅ Background: 后台摘要生成成功:', newTopicSummary);
                            
                            // 更新已创建消息的 Topic
                            try {
                                const freshToken = await getGoogleAuthToken({ caller: 'background.updateMessageTopic' });
                                const freshService = new ScheduledMessageService(freshToken);
                                await freshService.updateMessage(newMessage.ID, {
                                    Topic: `稍后处理: ${newTopicSummary}`
                                });
                                console.log('✅ Background: 消息 Topic 已更新');
                            } catch (updateError) {
                                console.warn('⚠️ Background: 更新 Topic 失败（不影响功能）:', updateError);
                            }
                        }
                    } catch (summaryError) {
                        console.warn('⚠️ Background: 后台摘要生成失败（不影响功能）:', summaryError);
                    }
                }, 100);
                
                // 异步存储到云端记忆系统
                setTimeout(async () => {
                    try {
                        console.log('🔔 Background: 后台存储 Snooze 消息到云端记忆...');
                        
                        const messageId = `snooze_${messageInfo.id}_${Date.now()}`;
                        const messageContent = `[稍后处理] ${messageInfo.senderName}: ${messageInfo.content}`;
                        
                        await memorySystem.storeMessage({
                            id: messageId,
                            content: messageContent,
                            metadata: {
                                sender: messageInfo.senderName,
                                groupId: messageInfo.groupId,
                                groupName: messageInfo.groupName,
                                groupUrl: messageInfo.messageLink,
                                datetime: Date.now(),
                                summary: `用户主动关注的消息：${messageInfo.content.substring(0, 100)}`,
                                matchedRules: ['user_snooze'],
                                replyAdvice: '',
                                contextMessages: [{
                                    id: messageInfo.id,
                                    sender: messageInfo.senderName,
                                    content: messageInfo.content,
                                    datetime: messageInfo.timestamp,
                                    isMainMessage: true
                                }],
                                entities: {
                                    people: messageInfo.senderName ? [{
                                        name: messageInfo.senderName,
                                        type: 'Person',
                                        relevanceScore: 0.9
                                    }] : [],
                                    topics: [{
                                        name: messageInfo.groupName,
                                        type: 'Topic',
                                        relevanceScore: 0.8
                                    }]
                                },
                                metadata: {
                                    snoozeInfo: {
                                        remindAt: remindAt,
                                        scheduledMessageId: newMessage.ID,
                                        note: note || ''
                                    }
                                }
                            }
                        });
                        
                        console.log('✅ Background: Snooze 消息已存储到云端记忆');
                        
                        // 更新用户画像
                        if (memorySystem.userProfileManager) {
                            console.log('🔔 Background: 后台更新用户画像...');
                            
                            if (messageInfo.senderName) {
                                await memorySystem.updateUserProfile({
                                    userId: userinfo?.userId || userinfo?.id || 'unknown',
                                    action: {
                                        actionType: 'favorite',
                                        timestamp: Date.now(),
                                        context: 'snooze_reminder',
                                        weight: 0.3,
                                        metadata: {
                                            messageId: messageInfo.id,
                                            groupName: messageInfo.groupName,
                                            remindAt: remindAt
                                        }
                                    },
                                    targetItem: {
                                        id: messageInfo.senderName.replace(/\s+/g, '_').toLowerCase(),
                                        type: 'person',
                                        name: messageInfo.senderName,
                                        metadata: {
                                            source: 'snooze',
                                            groupName: messageInfo.groupName
                                        }
                                    }
                                });
                            }
                            
                            if (messageInfo.groupName) {
                                await memorySystem.updateUserProfile({
                                    userId: userinfo?.userId || userinfo?.id || 'unknown',
                                    action: {
                                        actionType: 'favorite',
                                        timestamp: Date.now(),
                                        context: 'snooze_reminder',
                                        weight: 0.2,
                                        metadata: {
                                            messageId: messageInfo.id,
                                            senderName: messageInfo.senderName
                                        }
                                    },
                                    targetItem: {
                                        id: messageInfo.groupName.replace(/\s+/g, '_').toLowerCase(),
                                        type: 'topic',
                                        name: messageInfo.groupName,
                                        metadata: {
                                            source: 'snooze',
                                            groupId: messageInfo.groupId
                                        }
                                    }
                                });
                            }
                            
                            console.log('✅ Background: 用户画像已更新');
                        }
                    } catch (memoryError) {
                        console.error('⚠️ Background: 后台存储到记忆系统失败（不影响提醒功能）:', memoryError);
                    }
                }, 200);
                
            } catch (error: any) {
                console.error('❌ Background: 创建 Snooze 提醒失败:', error);
                console.error('❌ Background: 错误堆栈:', error.stack);
                sendResponse({ success: false, error: error.message || '创建失败' });
            }
        })();
        return true;
    }
    
    // RPA: 创建 JIRA Automation 规则（使用 JiraAutomationService）
    if (request.type === 'RPA_CREATE_JIRA_AUTOMATION_RULE') {
        (async () => {
            try {
                const { ruleData, projectId, projectKey } = request.data;
                console.log(`📝 RPA: 创建 Automation 规则到项目 ${projectKey} (ID: ${projectId})...`);
                
                // 创建 JiraAutomationService 实例
                const service = new JiraAutomationService();
                const config = {
                    jiraUrl: 'https://jira.ringcentral.com',
                    projectKey: projectKey
                };
                
                // 调用 createRule 方法（会自动处理 webhook trigger）
                const result = await service.createRule(config, ruleData);
                console.log(`✅ 规则创建成功，ID: ${result.id}`);
                sendResponse({ success: true, data: result });
            } catch (error: any) {
                console.error('❌ 创建 Automation 规则失败:', error);
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true;
    }

    // 存储关注后续的原消息到 ChromaDB
    if (request.type === 'STORE_FOLLOWED_MESSAGE') {
        storeRelatedMessage(request.data)
            .then(() => sendResponse({ success: true }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true;
    }

    // 打开关注后续配置表单
    if (request.type === 'OPEN_FOLLOW_THREAD_CONFIG') {
        (async () => {
            try {
                await chrome.storage.local.set({
                    pendingFollowThreadConfig: {
                        ...request.data,
                        timestamp: Date.now()
                    }
                });

                // 打开 topic-modal
                await chrome.windows.create({
                    url: chrome.runtime.getURL('topic-modal.html'),
                    type: 'popup',
                    width: 800,
                    height: 700
                });

                sendResponse({ success: true });
            } catch (error: any) {
                console.error('❌ 打开关注后续配置失败:', error);
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true;
    }

    return false;
});

// 处理 Chrome 通知点击事件
chrome.notifications.onClicked.addListener(async (notificationId) => {
    // 处理新的统一通知格式 (msg_xxx)
    if (notificationId.startsWith('msg_')) {
        try {
            const result = await chrome.storage.local.get(`notification_link_${notificationId}`);
            const link = result[`notification_link_${notificationId}`];
            
            if (link) {
                await chrome.tabs.create({ url: link });
                await chrome.storage.local.remove(`notification_link_${notificationId}`);
            }
        } catch (error) {
            console.error('❌ 处理通知点击失败:', error);
        }
        chrome.notifications.clear(notificationId);
        return;
    }
    
    // 处理旧的关注后续通知格式 (followThread_xxx)
    if (notificationId.startsWith('followThread_')) {
        const parts = notificationId.split('_');
        if (parts.length >= 3) {
            const originalPostId = parts[1];
            const relatedPostId = parts[2];

            try {
                // 获取关注项配置以获取 teamId
                const result = await chrome.storage.local.get('concernedItems');
                const concernedItems = result.concernedItems || [];
                const followItem = concernedItems.find((item: any) =>
                    item.followConfig?.originalMessage.postId === originalPostId
                );

                if (followItem && followItem.followConfig) {
                    const teamId = followItem.followConfig.originalMessage.teamId;
                    const messageUrl = `https://app.ringcentral.com/l/messages/${teamId}/${relatedPostId}`;
                    await chrome.tabs.create({ url: messageUrl });
                }
            } catch (error) {
                console.error('❌ 处理通知点击失败:', error);
            }
        }
        chrome.notifications.clear(notificationId);
    }
});

// 处理 Chrome 通知按钮点击事件
chrome.notifications.onButtonClicked.addListener(async (notificationId, buttonIndex) => {
    // 处理新的统一通知格式 (msg_xxx)
    if (notificationId.startsWith('msg_')) {
        if (buttonIndex === 0) {
            // 查看消息
            try {
                const result = await chrome.storage.local.get(`notification_link_${notificationId}`);
                const link = result[`notification_link_${notificationId}`];
                
                if (link) {
                    await chrome.tabs.create({ url: link });
                    await chrome.storage.local.remove(`notification_link_${notificationId}`);
                }
            } catch (error) {
                console.error('❌ 处理通知按钮点击失败:', error);
            }
        }
        chrome.notifications.clear(notificationId);
        return;
    }
    
    // 处理旧的关注后续通知格式 (followThread_xxx)
    if (notificationId.startsWith('followThread_')) {
        const parts = notificationId.split('_');
        if (parts.length >= 3) {
            const originalPostId = parts[1];

            if (buttonIndex === 0) {
                // 查看消息（与点击通知相同）
                // 手动触发点击处理逻辑
                try {
                    const result = await chrome.storage.local.get('concernedItems');
                    const concernedItems = result.concernedItems || [];
                    const followItem = concernedItems.find((item: any) =>
                        item.followConfig?.originalMessage.postId === originalPostId
                    );
                    if (followItem && followItem.followConfig) {
                        const teamId = followItem.followConfig.originalMessage.teamId;
                        const relatedPostId = parts[2];
                        const messageUrl = `https://app.ringcentral.com/l/messages/${teamId}/${relatedPostId}`;
                        await chrome.tabs.create({ url: messageUrl });
                    }
                } catch (error) {
                    console.error('❌ 查看消息失败:', error);
                }
            } else if (buttonIndex === 1) {
                // 取消关注
                try {
                    const result = await chrome.storage.local.get('concernedItems');
                    const concernedItems = result.concernedItems || [];
                    const updatedItems = concernedItems.filter((item: any) =>
                        item.followConfig?.originalMessage.postId !== originalPostId
                    );
                    await chrome.storage.local.set({ concernedItems: updatedItems });
                    console.log('✅ 已取消关注');
                } catch (error) {
                    console.error('❌ 取消关注失败:', error);
                }
            }
        }
        chrome.notifications.clear(notificationId);
    }
});

// 初始化关注后续清理任务
chrome.alarms.create('cleanupFollowThreads', {
    when: getNextCleanupTime()
});
console.log('✅ 关注后续清理任务已设置');

// 监听扩展命令
chrome.commands.onCommand.addListener(async (command) => {
    console.log('Command received:', command);
    
    if (command === 'open-memory-interface') {
        try {
            // 获取当前活跃的标签页
            const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (activeTab?.id) {
                // 打开记忆查询界面
                const memoryUrl = chrome.runtime.getURL('memory-exploring.html');
                
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
        // 获取认证token（用户主动操作，可以弹窗）
        const token = await getGoogleAuthToken({ caller: 'background.analyzeSlides' });
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
