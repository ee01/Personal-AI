/**
 * Tab 操作相关的辅助函数
 * 从 background.ts 中提取,供多个模块共享使用
 */

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
export function sendMessageWithRetry(tabId: number, message: any, maxRetries = 3, retryInterval = 10000): Promise<any> {
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

