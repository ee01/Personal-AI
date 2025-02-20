import { sendDataToOllama } from './api';
import { handleLLMRequest } from './llm';
import { sendBotMessage } from './bot';
const scheduledInterval = 120;  // 每2小时执行一次

console.log('Background script loaded');

// 扩展安装或更新时，立即创建定时任务
chrome.runtime.onInstalled.addListener(async () => {
    console.log('Extension installed/updated');

    // 查找并刷新 RingCentral 标签页
    try {
        const rcTab = await findRingCentralTab();
        if (rcTab && rcTab.id) {
            await chrome.tabs.reload(rcTab.id);
            console.log('RingCentral tab refreshed');

            // 延迟获取 RC Radar 配置
            console.log('getConfigFromWebpage', await getConfigFromWebpage());
            chrome.storage.local.set({
                config: await getConfigFromWebpage() || {
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
                },
            });
            if (!((await chrome.storage.local.get('concernedItems')).concernedItems)) {
                chrome.storage.local.set({concernedItems: [
                    {text:'聊到关于公司政策，也可以是政策相关的八卦消息'},
                    {text:'任何明确 @我 的消息，或者提到我的名字的消息'},
                ]});
            }
        }
    } catch (error) {
        console.error('Failed to refresh RingCentral tab:', error);
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

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Background received message:', request);

    if (request.type === 'LLM_REQUEST') {
        const { body } = request.data;
        
        console.log('Sending request to LLM:', body);
        
        handleLLMRequest(body)
            .then(([raw, jsonArray]) => {
                console.log('LLM response:', raw);
                console.log('LLM jsonArray:', jsonArray);
                // 发送 bot 消息，遍历数组中的每个项目
                if (jsonArray && jsonArray.length > 0) {
                    jsonArray.forEach(json => {
                        sendBotMessage({
                            matched_rule: json.matched_rule,
                            team_name: json.team_name,
                            sender: json.sender,
                            message_content: json.message_content,
                            summary: json.summary
                        }).catch(console.error);
                    });
                }
                sendResponse({ data: raw });
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
let timerFirstRunAlarms: NodeJS.Timeout | null = null;
export function startScheduledCheck() {
    timerFirstRunAlarms = setTimeout(() => {
        runScheduledTask(); // 立即执行一次
    }, 10000);
    chrome.alarms.create('checkMessages', {
        periodInMinutes: scheduledInterval
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
    chrome.storage.local.get(['config'], async (result) => {
        console.log('chrome.storage.local.result', result);
        if (result.config) {
            const config = result.config;
            const startTime = new Date(Date.now() - (scheduledInterval + 5) * 60 * 1000);
            
            try {
                // 查找或创建 RingCentral 标签页
                let rcTab = await findRingCentralTab();
                if (!rcTab) {
                    rcTab = await createRingCentralTab();
                    // 等待页面加载完成
                    await waitForTabLoad(rcTab.id);
                }

                // 尝试发送消息，如果失败则重试
                const response = await sendMessageWithRetry(rcTab.id, {
                    type: 'FETCH_USER_DATA',
                    startTime,
                    config
                });
                await sendDataToOllama(response.data, config);
            } catch (error) {
                console.error('Background task error:', error);
            }
        }
    });
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
    const tab = await findRingCentralTab();
    if (!tab) {
        return null;
    }
    
    try {
        const response = await sendMessageWithRetry(tab.id, {
            type: 'GET_CONFIG'
        });
        return response.config;
    } catch (error) {
        console.error('Failed to get config:', error);
        return null;
    }
} 