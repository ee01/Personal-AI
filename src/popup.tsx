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

const Popup = () => {
    const [isScheduleActive, setIsScheduleActive] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [envConfig, setEnvConfig] = useState<any>(null);
    const [analysisProgress, setAnalysisProgress] = useState<{
        total: number;
        lastAnalyzedIndex: number;
        lastAnalyzedTime: string;
    } | null>(null);

    useEffect(() => {
        (async () => {
            // 获取定时任务状态
            const { scheduleActive } = await chrome.storage.local.get('scheduleActive');
            setIsScheduleActive(scheduleActive === true);
            
            // 获取配置
            const envConfigData = await getEnvConfig();
            setEnvConfig(envConfigData);
        })();
    }, []);

    useEffect(() => {
        // 初始化时获取进度
        chrome.storage.local.get('ollamaAnalysisProgress', (result) => {
            console.log("ollamaAnalysisProgress:", result.ollamaAnalysisProgress);
            if (result.ollamaAnalysisProgress) {
                setAnalysisProgress(result.ollamaAnalysisProgress);
                setIsLoading(result.ollamaAnalysisProgress && result.ollamaAnalysisProgress.lastAnalyzedIndex < result.ollamaAnalysisProgress.total);
            }
        });

        // 监听 storage 变化
        const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }) => {
            if (changes.ollamaAnalysisProgress) {
                setAnalysisProgress(changes.ollamaAnalysisProgress.newValue);
                console.log("ollamaAnalysisProgress:", changes.ollamaAnalysisProgress);
                setIsLoading(changes.ollamaAnalysisProgress.newValue && changes.ollamaAnalysisProgress.newValue.lastAnalyzedIndex < changes.ollamaAnalysisProgress.newValue.total);
                if (changes.ollamaAnalysisProgress.newValue && changes.ollamaAnalysisProgress.newValue.lastAnalyzedIndex >= changes.ollamaAnalysisProgress.newValue.total) {
                    chrome.storage.local.remove('ollamaAnalysisProgress');
                }
            }
            
            // 监听配置变化
            if (changes.envConfig) {
                setEnvConfig(changes.envConfig.newValue);
            }
        };

        chrome.storage.onChanged.addListener(handleStorageChange);

        return () => {
            chrome.storage.onChanged.removeListener(handleStorageChange);
        };
    }, []);

    const handleSendToLLM = async () => {
        setIsLoading(true);
        try {
            // 直接调用 analyzeMessages 方法
            let rcTab = await findRingCentralTab();
            if (!rcTab) {
                rcTab = await createRingCentralTab();
                if (!rcTab.id) {
                    throw new Error('Tab ID is undefined');
                }
                // 等待页面加载完成
                await waitForTabLoad(rcTab.id);
            }
            
            if (!rcTab.id) {
                throw new Error('Tab ID is undefined');
            }
            
            // 获取页面配置
            let { userinfo } = await chrome.storage.local.get(['userinfo'])
            if (!userinfo || userinfo.fullName === '') userinfo = (await chrome.tabs.sendMessage(rcTab.id, { type: 'GET_USER_INFO' }) as TabResponse).data;
            if (!userinfo || !userinfo.fullName) {
                throw new Error('Failed to get page config');
            }
            
            const scheduledInterval = envConfig ? Number(envConfig.SCHEDULED_INTERVAL) : 120;
            const startTime = new Date(Date.now() - (scheduledInterval + 5) * 60 * 1000);
            
            // 获取用户数据
            const response = await chrome.tabs.sendMessage(rcTab.id, {
                type: 'FETCH_USER_MESSAGES',
                startTime,
            }) as TabResponse;
            
            if (!response || !response.success) {
                throw new Error(response?.error || 'Unknown error');
            }
            
            const userData = response.data;
            await analyzeMessages(userData, userinfo.fullName);
        } catch (error) {
            console.error('Error sending data to Ollama:', error);
            setIsLoading(false);
        }
    };

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

    return (
        <div className="popup-container">
            <button onClick={openKnowledgeQueryWindow}>
                知识库查询
            </button>

            <button 
                onClick={handleSendToLLM}
                disabled={isLoading}
            >
                {isLoading 
                    ? `正在分析 ${(analysisProgress?.lastAnalyzedIndex||0)+1}/${analysisProgress?.total||1} 条消息...` 
                    : `将最近 ${getIntervalHours()} 小时 Glip 消息发给 LLM 分析`}
            </button>
            
            <button onClick={toggleSchedule}>
                {isScheduleActive ? '禁用' : '启用'} 静默定时消息分析
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
        </div>
    );
};

ReactDOM.render(
    <Popup />,
    document.getElementById('popup-root')
); 