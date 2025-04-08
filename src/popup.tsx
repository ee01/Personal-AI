import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { useState, useEffect } from 'react';
import { sendMessageToActiveTab } from './popup';
import { analyzeMessages } from './messageDealing'; // 请确保路径正确
import { findRingCentralTab, createRingCentralTab, waitForTabLoad } from './background';
import { getEnvConfig } from './utils';

// 类型定义，帮助解决 lint 错误
interface TabResponse {
    success: boolean;
    error?: string;
    data?: any;
    config?: any;
}

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

    useEffect(() => {
        (async () => {
            // 获取定时任务状态
            const { scheduleActive } = await chrome.storage.local.get('scheduleActive');
            setIsScheduleActive(scheduleActive === true);

            // 检查当前标签页是否是 Google Sheets
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab?.url?.includes('docs.google.com/spreadsheets')) {
                setIsGoogleSheets(true);
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
    
    // const openOptionsPage = () => {
    //     chrome.runtime.openOptionsPage();
    // };

    // 计算分析时间间隔的小时数
    const getIntervalHours = () => {
        if (envConfig) {
            return (Number(envConfig.SCHEDULED_INTERVAL) / 60).toFixed(1);
        }
        return '2.0'; // 默认值
    };

    const openJiraQueryDialog = () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]?.id) {
                chrome.tabs.sendMessage(tabs[0].id, { type: 'OPEN_JIRA_QUERY_DIALOG' });
            }
        });
    };

    return (
        <div className="popup-container">
            <Toggle 
                checked={isScheduleActive}
                onChange={toggleSchedule}
                label={`每隔 ${getIntervalHours()} 小时静默消息分析`}
            />

            {isGoogleSheets && (
                <button 
                    onClick={openJiraQueryDialog}
                    className="jira-button"
                >
                    查询 Jira Tickets
                </button>
            )}

            <button onClick={openKnowledgeQueryWindow}>
                知识库查询
            </button>
            
            <button onClick={openTopicWindow}>
                配置感兴趣的话题
            </button>

            <button 
                onClick={handleOpenRadar}
                className="radar-button"
            >
                Open Radar Sidebar
            </button>
            
            {/* <button onClick={openOptionsPage}>
                设置
            </button> */}

            <style>{`
                .toggle-container {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 8px;
                }

                .toggle-label {
                    margin-right: 10px;
                }

                .toggle-switch {
                    position: relative;
                    display: inline-block;
                    width: 40px;
                    height: 20px;
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
                    border-radius: 20px;
                }

                .toggle-slider:before {
                    position: absolute;
                    content: "";
                    height: 16px;
                    width: 16px;
                    left: 2px;
                    bottom: 2px;
                    background-color: white;
                    transition: .4s;
                    border-radius: 50%;
                }

                input:checked + .toggle-slider {
                    background-color: #2196F3;
                }

                input:checked + .toggle-slider:before {
                    transform: translateX(20px);
                }

                .jira-button {
                    background-color: #0052CC;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                    margin: 8px;
                    width: calc(100% - 16px);
                }

                .jira-button:hover {
                    background-color: #0065FF;
                }
            `}</style>
        </div>
    );
};

ReactDOM.render(
    <Popup />,
    document.getElementById('popup-root')
); 