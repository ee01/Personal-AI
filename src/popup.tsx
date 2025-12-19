import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { useState, useEffect } from 'react';
import { sendMessageToActiveTab } from './popup';
import { getEnvConfig } from './utils';
import { getAuthToken } from './slide';
import { getTaskEnabled } from './services/TaskScheduler';

const WIKI_URL = 'https://wiki.ringcentral.com/spaces/XTO/pages/911054301/Personal+AI+-+Tools';

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
            // 获取定时任务状态 - 使用辅助函数
            const messageAnalysisEnabled = await getTaskEnabled('message_analysis');
            setIsScheduleActive(messageAnalysisEnabled);

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
            type: 'CONTROL_TASK',
            taskId: 'message_analysis',
            action: 'toggle',
            enabled: newState
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
    
    const _openProjectDashboard = () => {
        chrome.windows.create({
            url: 'project-dashboard.html',
            type: 'popup',
            width: 1200,
            height: 900,
            focused: true
        });
    };
    
    const openMemoryInterface = () => {
        chrome.tabs.create({
            url: chrome.runtime.getURL('memory-exploring.html'),
            active: true
        });
    };
    
    const openPromptConfigWindow = () => {
        chrome.windows.create({
            url: 'prompt-config.html',
            type: 'popup',
            width: 900,
            height: 800,
            focused: true
        });
    };
    
    const openScheduledMessagesManager = () => {
        chrome.windows.create({
            url: 'scheduled-messages.html',
            type: 'popup',
            width: 1280,
            height: 700,
            focused: true
        });
    };
    
    // Help 图标点击处理
    const handleOpenHelp = () => {
        chrome.tabs.create({ url: WIKI_URL, active: true });
    };
    
    // Share 图标点击处理 - 打开独立窗口
    const handleOpenShare = () => {
        chrome.windows.create({
            url: 'share-modal.html',
            type: 'popup',
            width: 560,
            height: 680,
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
                alert('无法获取Google认证，请检查账号授权');
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
                    }, (_response) => {
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
                    }, (_response) => {
                        // close the popup window
                        window.close();
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
                        }, (_response) => {
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
        const handleMessage = async (message: any, _sender: chrome.runtime.MessageSender, _sendResponse: (response?: any) => void) => {
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
            {/* 顶部工具栏：包含开关和图标 */}
            <div className="header-toolbar">
                <Toggle 
                    checked={isScheduleActive}
                    onChange={toggleSchedule}
                    label={`每隔 ${getIntervalHours()} 小时静默消息分析`}
                />
                <div className="header-icons">
                    <button 
                        className="header-icon-btn" 
                        onClick={handleOpenHelp}
                        title="查看帮助文档"
                    >
                        ❓
                    </button>
                    <button 
                        className="header-icon-btn"
                        onClick={handleOpenShare}
                        title="分享给同事"
                    >
                        ↗️
                    </button>
                </div>
            </div>

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
                <div className="slides-button-group">
                    <button 
                        onClick={analyzeSlidesProjects}
                        className="slides-button main-button"
                        disabled={isAnalyzingSlides}
                    >
                        {isAnalyzingSlides ? (
                            <span className="loading-text">正在分析 Slide 项目信息...</span>
                        ) : (
                            '分析 Slide 项目信息并更新'
                        )}
                    </button>
                    <button 
                        onClick={openPromptConfigWindow}
                        className="slides-button config-button"
                        title="配置自定义提示词和用户上下文"
                    >
                        ⚙️
                    </button>
                </div>
            )}

            <button onClick={openMemoryInterface} className="memory-button">
                🧠 实体记忆查询
            </button>

            {/* <button onClick={openProjectDashboard} className="dashboard-button">
                📊 项目进度仪表盘
            </button> */}
            
            <button onClick={openScheduledMessagesManager} className="scheduled-button">
                ⏰ 定时消息管理
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
                .popup-container {
                    padding-bottom: 8px; /* Add padding at the bottom */
                    min-width: 300px;
                }
                
                /* 顶部工具栏样式 */
                .header-toolbar {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 4px 8px;
                    border-bottom: 1px solid #eee;
                    margin-bottom: 4px;
                }
                
                .header-toolbar .toggle-container {
                    flex: 1;
                    margin-bottom: 0;
                    padding: 4px 0;
                }
                
                .header-icons {
                    display: flex;
                    gap: 4px;
                    margin-left: 8px;
                }
                
                .header-icon-btn {
                    width: 28px !important;
                    min-width: 28px !important;
                    height: 28px;
                    padding: 0 !important;
                    margin: 0 !important;
                    border: none;
                    border-radius: 6px;
                    background: #f0f0f0;
                    cursor: pointer;
                    font-size: 14px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s ease;
                }
                
                .header-icon-btn:hover {
                    background: #e0e0e0;
                    transform: scale(1.1);
                }

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

                 .dashboard-button {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    font-weight: 600;
                    box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
                    transition: all 0.3s ease;
                 }
                 
                 .dashboard-button:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
                 }
                 
                 .memory-button {
                    background: linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%);
                    color: white;
                    font-weight: 600;
                    box-shadow: 0 2px 8px rgba(139, 92, 246, 0.3);
                    transition: all 0.3s ease;
                 }
                 
                 .memory-button:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(139, 92, 246, 0.4);
                 }

                 .message-button { /* Example specific style if needed */
                    background-color: #ff9900; /* Example orange */
                    color: white;
                 }
                 .message-button:hover {
                    background-color: #e68a00;
                 }
                 
                 .scheduled-button {
                    background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
                    color: white;
                    font-weight: 600;
                    box-shadow: 0 2px 8px rgba(245, 87, 108, 0.3);
                    transition: all 0.3s ease;
                 }
                 
                 .scheduled-button:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(245, 87, 108, 0.4);
                 }
                 
                 .slides-button-group {
                    display: flex;
                    gap: 4px;
                    margin: 8px 8px 0 8px;
                 }
                 
                 .slides-button.main-button {
                    flex: 1;
                    background-color: #4285F4; /* Google blue */
                    color: white;
                 }
                 
                 .slides-button.config-button {
                    width: 36px;
                    min-width: 36px;
                    background-color: #6c757d;
                    color: white;
                    font-size: 16px;
                    padding: 8px 4px;
                 }
                 
                 .slides-button.config-button:hover {
                    background-color: #5a6268;
                 }
                 
                 .slides-button.main-button:hover {
                    background-color: #2a75f3;
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
