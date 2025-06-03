import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { useState, useEffect } from 'react';
import { sendMessageToActiveTab } from './popup';
import { getEnvConfig } from './utils';
import { getAuthToken } from './slide';

const Toggle = ({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) => (
    <div className="toggle-container">
        <span className="toggle-label">{label}</span>
        <label className="toggle-switch">
            <input type="checkbox" checked={checked} onChange={onChange} />
            <span className="toggle-slider"></span>
        </label>
    </div>
);

const Popup = () => {
    const [isScheduleActive, setIsScheduleActive] = useState(false);
    const [envConfig, setEnvConfig] = useState<any>(null);
    const [isGoogleSheets, setIsGoogleSheets] = useState(false);
    const [isGoogleSlides, setIsGoogleSlides] = useState(false);
    const [isRingCentral, setIsRingCentral] = useState(false);
    const [isExpandingEpic, setIsExpandingEpic] = useState(false);
    const [isAnalyzingSlides, setIsAnalyzingSlides] = useState(false);

    useEffect(() => {
        (async () => {
            // 获取定时任务状态
            const { scheduleActive } = await chrome.storage.local.get('scheduleActive');
            setIsScheduleActive(scheduleActive === true);

            // 检查当前标签页是否是 Google Sheets 或 Google Slides
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab?.url?.includes('docs.google.com/spreadsheets')) {
                setIsGoogleSheets(true);
            }
            if (tab?.url?.includes('docs.google.com/presentation')) {
                setIsGoogleSlides(true);
            }
            if (tab?.url?.includes('app.ringcentral.com')) {
                setIsRingCentral(true);
            }
        })();
    }, []);

    useEffect(() => {
        (async () => {
            const envConfigData = await getEnvConfig();
            setEnvConfig(envConfigData);
        })();
    }, []);

    const toggleSchedule = () => {
        const newState = !isScheduleActive;
        setIsScheduleActive(newState);
        chrome.runtime.sendMessage({
            type: 'CONTROL_SCHEDULED_CHECK',
            action: newState ? 'start' : 'stop'
        });
    };

    const handleOpenRadar = () => {
        sendMessageToActiveTab({type: 'RADAR-POC-OPEN-PANEL'}, 'RADAR-POC-OPEN-PANEL');
    };

    const openTopicWindow = () => {
        chrome.windows.create({
            url: 'topic-modal.html',
            type: 'popup',
            width: 500,
            height: 800,
            focused: true
        });
    };
    
    const openKnowledgeQueryWindow = () => {
        chrome.windows.create({
            url: 'knowledge-query.html',
            type: 'popup',
            width: 800,
            height: 700,
            focused: true
        });
    };
    
    const analyzeSlidesProjects = async () => {
        try {
            setIsAnalyzingSlides(true);
            // 先获取OAuth token
            const token = await getAuthToken();
            if (!token) {
                console.error('无法获取Google认证，请检查账号授权');
                // 可以在界面上显示错误消息
                setIsAnalyzingSlides(false);
                return;
            }

            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                const activeTab = tabs[0];
                if (activeTab?.id) {
                    chrome.tabs.sendMessage(activeTab.id, { 
                        type: 'ANALYZE_SLIDES_PROJECTS',
                        token
                    }, (response) => {
                        // 当收到响应时关闭loading状态
                        setIsAnalyzingSlides(false);
                    });
                } else {
                    setIsAnalyzingSlides(false);
                }
            });
        } catch (error) {
            console.error('获取认证失败:', error);
            // 可以在界面上显示错误消息
            setIsAnalyzingSlides(false);
        }
    };

    // 计算分析时间间隔的小时数
    const getIntervalHours = () => {
        if (envConfig) {
            return (Number(envConfig.SCHEDULED_INTERVAL) / 60).toFixed(1);
        }
        return '2.0'; // 默认值
    };

    const openJiraQueryDialog = () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const activeTab = tabs[0];
            if (activeTab?.id && activeTab.url) { // Check for both id and url
                const tabId = activeTab.id; // Store ID in a local constant
                chrome.identity.getAuthToken({ interactive: true }, (token) => {
                    if (chrome.runtime.lastError) {
                        console.error('获取 token 失败: ', chrome.runtime.lastError);
                        // Consider showing an error message to the user here
                    }
                    // Ensure token is not null/undefined before sending
                    if (!token) {
                         console.error('获取到的 token 无效');
                         // Consider showing an error message to the user here
                    }
                    chrome.tabs.sendMessage(tabId, { // Use the local constant
                        type: 'OPEN_JIRA_QUERY_DIALOG',
                        url: activeTab.url, // Pass the URL
                        sheetToken: token
                    });
                });
            } else {
                console.error("无法获取活动标签页 ID 或 URL");
                // Consider showing an error message to the user here
            }
        });
    };

    const expandEpicTickets = () => {
        setIsExpandingEpic(true);
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const activeTab = tabs[0];
            if (activeTab?.id && activeTab.url) {
                const tabId = activeTab.id;
                chrome.identity.getAuthToken({ interactive: true }, (token) => {
                    if (chrome.runtime.lastError) {
                        console.error('获取 token 失败: ', chrome.runtime.lastError);
                        setIsExpandingEpic(false);
                        return;
                    }
                    if (token) {
                        chrome.tabs.sendMessage(tabId, {
                            type: 'EXPAND_EPIC_TICKETS',
                            url: activeTab.url,
                            sheetToken: token
                        }, (response) => {
                            // 当收到响应时（无论成功失败）都关闭 loading
                            setIsExpandingEpic(false);
                        });
                    } else {
                        console.error('获取到的 token 无效');
                        setIsExpandingEpic(false);
                    }
                });
            } else {
                console.error("无法获取活动标签页 ID 或 URL");
                setIsExpandingEpic(false);
            }
        });
    };

    // 监听内容脚本发来的请求
    useEffect(() => {
        const handleMessage = async (message: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => {
            if (message.type === 'REQUEST_SLIDES_ANALYSIS') {
                // 获取当前标签页
                const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
                const activeTab = tabs[0];
                
                if (activeTab?.id && activeTab.url?.includes('docs.google.com/presentation')) {
                    // 获取token并发送回内容脚本
                    const token = await getAuthToken();
                    if (token) {
                        chrome.tabs.sendMessage(activeTab.id, { 
                            type: 'ANALYZE_SLIDES_PROJECTS',
                            token
                        });
                    } else {
                        console.error('获取Google认证失败');
                    }
                }
            }
        };
        
        chrome.runtime.onMessage.addListener(handleMessage);
        return () => {
            chrome.runtime.onMessage.removeListener(handleMessage);
        };
    }, []);

    return (
        <div className="popup-container">
            <Toggle 
                checked={isScheduleActive}
                onChange={toggleSchedule}
                label={`每隔 ${getIntervalHours()} 小时静默消息分析`}
            />

            {isGoogleSheets && (
                <>
                    <button 
                        onClick={openJiraQueryDialog}
                        className="jira-button"
                    >
                        抓取 Jira Tickets 到 Sheet
                    </button>
                    <button 
                        onClick={expandEpicTickets}
                        className="jira-button expand-button"
                        disabled={isExpandingEpic}
                    >
                        {isExpandingEpic ? (
                            <span className="loading-text">正在查找 Epic 子任务...</span>
                        ) : (
                            '展开 Epic 下面所有的 tickets'
                        )}
                    </button>
                </>
            )}
            
            {isGoogleSlides && (
                <button 
                    onClick={analyzeSlidesProjects}
                    className="slides-button"
                    disabled={isAnalyzingSlides}
                >
                    {isAnalyzingSlides ? (
                        <span className="loading-text">正在分析 Slide 项目信息...</span>
                    ) : (
                        '分析 Slide 项目信息并更新'
                    )}
                </button>
            )}

            <button onClick={openKnowledgeQueryWindow} className="message-button">
                知识库查询
            </button>
            
            <button onClick={openTopicWindow} className="message-button">
                配置感兴趣的话题
            </button>

            {isRingCentral && (
                <button 
                    onClick={handleOpenRadar}
                    className="radar-button"
                >
                    Open Radar Sidebar
                </button>
            )}
            
            {/* <button onClick={openOptionsPage}>
                设置
            </button> */}

            <style>{`
                .toggle-container {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 8px;
                    margin-bottom: 5px; /* Added margin */
                }

                .toggle-label {
                    margin-right: 10px;
                    font-size: 12px; /* Adjusted font size */
                }

                .toggle-switch {
                    position: relative;
                    display: inline-block;
                    width: 40px; /* Slightly wider */
                    height: 20px; /* Slightly taller */
                }

                .toggle-switch input {
                    opacity: 0;
                    width: 0;
                    height: 0;
                }

                .toggle-slider {
                    position: absolute;
                    cursor: pointer;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background-color: #ccc;
                    transition: .4s;
                    border-radius: 20px; /* Match height */
                }

                .toggle-slider:before {
                    position: absolute;
                    content: "";
                    height: 16px; /* Adjusted size */
                    width: 16px;  /* Adjusted size */
                    left: 2px;    /* Adjusted position */
                    bottom: 2px;  /* Adjusted position */
                    background-color: white;
                    transition: .4s;
                    border-radius: 50%;
                }

                input:checked + .toggle-slider {
                    background-color: #2196F3;
                }

                input:checked + .toggle-slider:before {
                    transform: translateX(20px); /* Adjusted translation */
                }

                button { /* General button styling */
                    display: block; /* Make buttons take full width */
                    width: calc(100% - 16px); /* Account for padding */
                    padding: 8px 16px;
                    margin: 8px 8px 0 8px; /* Adjust margins */
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                    text-align: center;
                    box-sizing: border-box;
                }

                button:hover {
                    opacity: 0.9;
                }

                .jira-button {
                    background-color: #0052CC;
                    color: white;
                }

                .jira-button:hover {
                    background-color: #0065FF;
                }

                .expand-button { /* Style for the new button */
                    background-color: #5bc0de; /* Example info blue */
                    color: white;
                }

                .expand-button:hover {
                     background-color: #31b0d5;
                }

                 .message-button { /* Example specific style if needed */
                    background-color: #ff9900; /* Example orange */
                    color: white;
                 }
                 .message-button:hover {
                    background-color: #e68a00;
                 }
                 
                 .slides-button {
                    background-color: #4285F4; /* Google blue */
                    color: white;
                 }
                 
                 .slides-button:hover {
                    background-color: #2a75f3;
                 }

                 .popup-container {
                    padding-bottom: 8px; /* Add padding at the bottom */
                 }

                 .loading-text {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                 }
            `}</style>
        </div>
    );
};

ReactDOM.render(
    <React.StrictMode> {/* Added StrictMode */}
        <Popup />
    </React.StrictMode>,
    document.getElementById('popup-root')
); 