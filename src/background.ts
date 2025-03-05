import { analyzeMessages, reviewMessageByLLMAndSendToBot } from './messageDealing';
import { initChromaClient } from './vectorStore';
import { knowledgeQuery } from './llm';
import { createOffscreenDocument, handleEmbeddingResult } from './embeddings';
const scheduledInterval = process.env.SCHEDULED_INTERVAL || 120;  // 每2小时执行一次

console.log('Background script loaded');

// 扩展安装或更新时，立即创建定时任务
chrome.runtime.onInstalled.addListener(async () => {
    try {
        console.log('Extension installed/updated');

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
                {text:'聊到关于公司政策，也可以是政策相关的八卦消息'},
                {text:'任何明确 @我 的消息，或者提到我的名字的消息'},
            ]});
        }

        // 查找并刷新 RingCentral 标签页
        try {
            const rcTab = await findRingCentralTab();
            if (rcTab && rcTab.id) {
                await chrome.tabs.reload(rcTab.id);
                console.log('RingCentral tab refreshed');

                // 延迟获取 RC Radar 配置
                await getConfigFromWebpage()
            }
        } catch (error) {
            console.error('Failed to refresh RingCentral tab:', error);
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
        console.error('Error in onInstalled handler:', error);
    }
});

// 监听定时任务
chrome.alarms.onAlarm.addListener((alarm) => {
    console.log('alarm', alarm);
    if (alarm.name === 'checkMessages') {
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
        reviewMessageByLLMAndSendToBot(body).then(raw => {
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

    // 监听来自离屏文档的消息
    handleEmbeddingResult(request);
});

// 启动定时任务
let timerFirstRunAlarms: NodeJS.Timeout | null = null;
export function startScheduledCheck() {
    timerFirstRunAlarms = setTimeout(() => {
        runScheduledTask(); // 立即执行一次
    }, 10000);
    chrome.alarms.create('checkMessages', {
        periodInMinutes: Number(scheduledInterval)
    });
    chrome.storage.local.set({ scheduleActive: true });
    console.log('Scheduled message check started');
}

// 停止定时任务
export function stopScheduledCheck() {
    clearTimeout(timerFirstRunAlarms);
    chrome.alarms.clear('checkMessages');
    chrome.storage.local.set({ scheduleActive: false });
    console.log('Scheduled message check stopped');
}

// 定时抓取分析消息
async function runScheduledTask() {
    try {
        // 查找或创建 RingCentral 标签页
        let rcTab = await findRingCentralTab();
        if (!rcTab) {
            rcTab = await createRingCentralTab();
            // 等待页面加载完成
            await waitForTabLoad(rcTab.id);
        }

        let { config } = await chrome.storage.local.get(['config'])
        if (!config || config.username === '') config = await getConfigFromWebpage();
        const startTime = new Date(Date.now() - (Number(scheduledInterval) + 5) * 60 * 1000);

        // 尝试发送消息，如果失败则重试
        const response = await sendMessageWithRetry(rcTab.id, {
            type: 'FETCH_USER_DATA',
            startTime,
            config
        });
        await analyzeMessages(response.data, config);
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
        url: "https://app.ringcentral.com/video",
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
function sendMessageWithRetry(tabId: number, message: any, maxRetries = 3): Promise<any> {
    return new Promise((resolve, reject) => {
        let attempts = 0;

        const trySendMessage = () => {
            attempts++;
            chrome.tabs.sendMessage(tabId, message, response => {
                if (chrome.runtime.lastError) {
                    console.log(`Attempt ${attempts} failed:`, chrome.runtime.lastError);
                    if (attempts < maxRetries) {
                        setTimeout(trySendMessage, 5000); // 5秒后重试
                    } else {
                        reject(new Error('Failed to send message after multiple attempts'));
                    }
                } else {
                    if (response && !response.error) {
                        resolve(response);
                    } else {
                        reject(new Error('Failed to fetch user data: ' + response?.error));
                    }
                }
            });
        };

        trySendMessage();
    });
}

async function getConfigFromWebpage() {
    let rcTab = await findRingCentralTab();
    if (!rcTab) {
        rcTab = await createRingCentralTab();
        // 等待页面加载完成
        await waitForTabLoad(rcTab.id);
    }
    
    try {
        const response = await sendMessageWithRetry(rcTab.id, {
            type: 'GET_CONFIG'
        });
        chrome.storage.local.set({
            config: response.config || {
                selectGroupNames: "",
                enableMessage: true,
                enableSms: false,
                enableVoicemail: false,
                enableCallTranscript: false,
                enableCalendar: false,
                enableCandidateQuestions: false,
                selectFolderGroupIds: "",
                username: "",
                extensionId: "",
                apiKey: "",
                model: "4o"
            }
        });
        return response.config;
    } catch (error) {
        console.error('Failed to get config:', error);
        return null;
    }
}
