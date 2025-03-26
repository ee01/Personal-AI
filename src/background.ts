import { analyzeMessages, analyzeMessagesInBackground } from './messageDealing';
import { initChromaClient } from './vectorStore';
import { knowledgeQuery } from './llm';
import { createOffscreenDocument, handleEmbeddingResult } from './embeddings';
import { getEnvConfig } from './utils';

console.log('Background script loaded');

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
                {text:'可能是回复我的消息，比如在我发完消息之后的答复。排除发送者是我', pushToGlip: true},
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
            await initChromaClient();
            console.log('Chroma client initialized');
        } catch (error) {
            console.error('Failed to initialize Chroma:', error);
        }

        // 预先创建离屏文档
        await createOffscreenDocument();
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
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Background received message:', request);

    // 如果不是 background 定时程序，会从页面发送请求到这里执行
    if (request.type === 'MESSAGE_DEALING') {
        const { body } = request.data;
        console.log('Sending request to LLM:', body);
        analyzeMessagesInBackground(body.data, body.username).then(raw => {
            sendResponse({ data: raw });
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
    
    // 获取环境配置
    if (request.type === 'GET_ENV_CONFIG') {
        getEnvConfig().then(config => {
            sendResponse({ success: true, config: config });
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
        await analyzeMessages(response.data, userinfo.fullName);
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
