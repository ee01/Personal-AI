import { sendDataToOllama } from './api';
import { handleLLMRequest } from './llm';

console.log('Background script loaded');

// 扩展安装或更新时，立即创建定时任务
chrome.runtime.onInstalled.addListener(() => {
    console.log('Extension installed/updated');
    chrome.storage.local.set({
        config: {
            recentDays: 1 / 24,
            selectGroupNames: "",
            enableMessage: true,
            enableSms: false,
            enableVoicemail: false,
            enableCallTranscript: false,
            enableCalendar: false,
            enableCandidateQuestions: false,
            selectFolderGroupIds: "",
            username: "Esone Qiu",
            extensionId: "1325046020",
            apiKey: "app-CjA00E2dCpUqlpmqhcRp91gq",
            model: "4o"
        }
    });
    
    setTimeout(() => {
        runScheduledTask(); // 立即执行一次
    }, 10000);
    // 创建定时任务
    chrome.alarms.create('checkMessages', {
        periodInMinutes: 120
    });
});

// 监听定时任务
chrome.alarms.onAlarm.addListener((alarm) => {
    console.log('alarm', alarm);
    if (alarm.name === 'checkMessages') {
        console.log('Running scheduled message check...');
        runScheduledTask();
    }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Background received message:', request);

    if (request.type === 'OLLAMA_REQUEST') {
        const { body } = request.data;
        
        console.log('Sending request to LLM:', body);
        
        handleLLMRequest(body)
            .then(data => {
                console.log('LLM response:', data);
                sendResponse({ data });
            })
            .catch(error => {
                console.error('LLM error:', error);
                sendResponse({ 
                    error: error.message,
                    details: `Failed to connect to ${process.env.LLM_TYPE} service`
                });
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
});

// 启动定时任务
export function startScheduledCheck() {
    chrome.alarms.create('checkMessages', {
        periodInMinutes: 120  // 每2小时执行一次
    });
    console.log('Scheduled message check started');
}

// 停止定时任务
export function stopScheduledCheck() {
    chrome.alarms.clear('checkMessages');
    console.log('Scheduled message check stopped');
}

// 定时抓取分析消息
async function runScheduledTask() {
    chrome.storage.local.get(['config'], async (result) => {
        console.log('chrome.storage.local.result', result);
        if (result.config) {
            const config = result.config;
            const startTime = new Date(Date.now() - config.recentDays * 60 * 60 * 1000);
            
            try {
                // 查找或创建 RingCentral 标签页
                let rcTab = await findRingCentralTab();
                if (!rcTab) {
                    rcTab = await createRingCentralTab();
                    // 等待页面加载完成
                    await waitForTabLoad(rcTab.id);
                }

                // 尝试发送消息，如果失败则重试
                await sendMessageWithRetry(rcTab.id, {
                    type: 'FETCH_USER_DATA',
                    startTime,
                    config
                });
            } catch (error) {
                console.error('Background task error:', error);
            }
        }
    });
}

// 查找已打开的 RingCentral 标签页
async function findRingCentralTab() {
    const tabs = await chrome.tabs.query({
        url: "*://app.ringcentral.com/*"
    });
    return tabs[0];
}

// 创建新的 RingCentral 标签页
async function createRingCentralTab() {
    return await chrome.tabs.create({
        url: "https://app.ringcentral.com/video",
        active: false
    });
}

// 等待标签页加载完成
function waitForTabLoad(tabId: number): Promise<void> {
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
                        setTimeout(trySendMessage, 1000); // 1秒后重试
                    } else {
                        reject(new Error('Failed to send message after multiple attempts'));
                    }
                } else {
                    if (response && response.success) {
                        sendDataToOllama(response.data, message.config);
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