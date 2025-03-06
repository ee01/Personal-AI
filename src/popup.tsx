import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { useState, useEffect } from 'react';
import { sendMessageToActiveTab } from './popup';
import { analyzeMessages } from './messageDealing'; // 请确保路径正确
import { findRingCentralTab, createRingCentralTab, waitForTabLoad } from './background';

const Popup = () => {
    const [isScheduleActive, setIsScheduleActive] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
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
        };

        chrome.storage.local.onChanged.addListener(handleStorageChange);

        return () => {
            chrome.storage.local.onChanged.removeListener(handleStorageChange);
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
            let { config } = await chrome.storage.local.get(['config'])
            if (!config || config.username === '') config = (await chrome.tabs.sendMessage(rcTab.id, { type: 'GET_CONFIG' })).config;
            const startTime = new Date(Date.now() - (Number(process.env.SCHEDULED_INTERVAL || 120) + 5) * 60 * 1000);
            const response = await chrome.tabs.sendMessage(rcTab.id, {
                type: 'FETCH_USER_DATA',
                startTime,
                config
            });
            if (!response.success) {
                throw new Error(response.error);
            }
            const userData = response.data;
            await analyzeMessages(userData, config);
        } catch (error) {
            console.error('Error sending data to Ollama:', error);
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
                    : `将最近 ${(Number(process.env.SCHEDULED_INTERVAL || 120)/60).toFixed(1)} 小时 Glip 消息发给 LLM 分析`}
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
        </div>
    );
};

ReactDOM.render(
    <Popup />,
    document.getElementById('popup-root')
); 