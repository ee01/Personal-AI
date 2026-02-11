
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { useState, useEffect } from 'react';
import { analyzeMessages } from '../messageDealing';
import { findRingCentralTab, createRingCentralTab, waitForTabLoad, sendMessageWithRetry } from '../utils/tabHelpers';
import { getEnvConfig } from '../utils';
import { generateAutoReply } from '../llm';
import { getTaskEnabled } from '../services/TaskScheduler';

// 自动答复配置接口
interface AutoReplyConfig {
    enabled: boolean;
    replyContent: string;           // 答复内容模板
    useAIGenerate: boolean;         // 每次AI生成类似答复
    reviewMode: 'immediate' | 'delayed' | 'manual';  // 审核模式
    delayHours?: number;            // 延迟小时数（仅 delayed 模式使用）
}

// reviewMode 说明：
// - 'immediate': 直接发送（不审核，立即执行）
// - 'delayed': 延迟可拦截（默认，答复前 X 小时可拦截）
// - 'manual': 仅添加到审核列表（PendingReview 状态，需手动批准）

interface FollowThreadConfigType {
    originalMessage: {
        postId: string;
        teamId: string;
        teamName: string;
        sender: string;
        content: string;
        datetime: string | number;
        messageUrl: string;
    };
    createdAt: string;
    // 🆕 移除 expiresAt，使用 TopicItem.expiredAt
    // 🆕 移除 notifyMethod/notifyFrequency，移到 TopicItem 外层
    keywordFilter?: string[];
    relatedMessages: any[];
    lastCheckedAt?: string;
    lastNotifiedAt?: string;
}

interface DigestConfigType {
    enabled: boolean;
    frequency: 'daily' | 'weekly';
    preferredHour?: number;
}

interface TopicItem {
    id: string;
    text: string;
    expiredAt: number;
    /** @deprecated 使用 notifyMethod 替代 */
    pushToGlip?: boolean;
    mentionMe?: boolean;
    // 通用匹配条件（可编辑）
    filterSender?: string;      // 匹配的发送者（可编辑）
    filterGroup?: string;       // 匹配的群组名（可编辑）
    // 🆕 通用通知配置（适用于所有类型）
    // notifyMethod 使用逗号分隔格式，如 'bot,chrome'
    notifyMethod?: string;
    notifyFrequency?: 'immediate' | 'merged';
    // 🆕 每日/每周摘要配置
    digestConfig?: DigestConfigType;
    // 自动答复相关字段
    autoReply?: boolean;        // 是否启用自动答复
    autoReplyConfig?: AutoReplyConfig;
    // 关注后续相关字段
    followThread?: boolean;     // 是否启用关注后续
    followConfig?: FollowThreadConfigType;
}

interface TabResponse {
    success: boolean;
    error?: string;
    data?: any;
    config?: any;
}

const TopicModal = () => {
    const [topics, setTopics] = useState<TopicItem[]>([]);
    const [editingTopic, setEditingTopic] = useState<TopicItem | null>(null);
    const [showAddForm, setShowAddForm] = useState(false);
    const [newTopic, setNewTopic] = useState('');
    const [newExpiry, setNewExpiry] = useState('30');
    const [newMentionMe, setNewMentionMe] = useState(false);
    // 自动答复相关状态
    const [newAutoReply, setNewAutoReply] = useState(false);
    const [newAutoReplyConfig, setNewAutoReplyConfig] = useState<AutoReplyConfig>({
        enabled: false,
        replyContent: '',
        useAIGenerate: true,
        reviewMode: 'delayed',  // 默认延迟可拦截
        delayHours: 1
    });
    // 关注后续相关状态
    const [newFollowThread, setNewFollowThread] = useState(false);
    const [newFollowConfig, setNewFollowConfig] = useState<any>(null);
    // 🆕 通用通知配置状态（适用于所有类型）
    // notifyMethod 使用逗号分隔格式，如 'bot,chrome'
    const [newNotifyMethod, setNewNotifyMethod] = useState<string>('bot');
    const [newNotifyFrequency, setNewNotifyFrequency] = useState<'immediate' | 'merged'>('immediate');
    // 🆕 每日摘要配置状态
    const [newDigestEnabled, setNewDigestEnabled] = useState(false);
    const [newDigestFrequency, setNewDigestFrequency] = useState<'daily' | 'weekly'>('daily');
    const [newDigestHour, setNewDigestHour] = useState(18);
    // 新增：通用匹配条件状态
    const [newFilterSender, setNewFilterSender] = useState('');
    const [newFilterGroup, setNewFilterGroup] = useState('');
    const [isGeneratingReply, setIsGeneratingReply] = useState(false);
    const [draggedItem, setDraggedItem] = useState<number | null>(null);
    const [dragOverItem, setDragOverItem] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [envConfig, setEnvConfig] = useState<any>(null);
    const [analysisProgress, setAnalysisProgress] = useState<{
        total: number;
        lastAnalyzedIndex: number;
        lastAnalyzedTime: string;
    } | null>(null);
    const [isSilentAnalysisEnabled, setIsSilentAnalysisEnabled] = useState(false);

    useEffect(() => {
        loadTopics();
        checkSilentAnalysisStatus();
    }, []);

    // 检查静默消息分析状态
    const checkSilentAnalysisStatus = async () => {
        const isEnabled = await getTaskEnabled('message_analysis');
        setIsSilentAnalysisEnabled(isEnabled);
    };

    useEffect(() => {
        (async () => {
            const envConfigData = await getEnvConfig();
            setEnvConfig(envConfigData);
        })();
    }, []);

    // 检查是否有从消息悬浮菜单传来的自动答复配置请求
    useEffect(() => {
        (async () => {
            const result = await chrome.storage.local.get('pendingAutoReplyConfig');
            if (result.pendingAutoReplyConfig) {
                const config = result.pendingAutoReplyConfig;
                // 检查是否是最近5分钟内的请求
                if (Date.now() - config.timestamp < 5 * 60 * 1000) {
                    console.log('🤖 检测到自动答复配置请求:', config);
                    
                    // 自动填充表单 - 使用新的数据结构
                    // text 存储内容描述，filterSender/filterGroup 存储匹配条件
                    setNewTopic(config.content ? `发送了内容与以下语义相似："${config.content}"` : '发送的消息');
                    setNewFilterSender(config.sender || '');
                    setNewFilterGroup(config.groupName || '');
                    setNewAutoReply(true);
                    setNewAutoReplyConfig({
                        enabled: true,
                        replyContent: '',
                        useAIGenerate: true,
                        reviewMode: 'delayed',  // 默认延迟可拦截
                        delayHours: 1
                    });
                    setShowAddForm(true);
                    
                    // 尝试自动生成答复建议
                    try {
                        const reply = await generateAutoReply({
                            messageContent: config.content,
                            sender: config.sender,
                            groupName: config.groupName,
                            summary: `原始消息：${config.content}`
                        });
                        setNewAutoReplyConfig(prev => ({
                            ...prev,
                            replyContent: reply
                        }));
                    } catch (error) {
                        console.error('自动生成答复失败:', error);
                    }
                }
                
                // 清除 pending 配置
                await chrome.storage.local.remove('pendingAutoReplyConfig');
            }
        })();
    }, []);

    // 检查是否有从消息悬浮菜单传来的关注后续配置请求
    useEffect(() => {
        (async () => {
            const result = await chrome.storage.local.get('pendingFollowThreadConfig');
            if (result.pendingFollowThreadConfig) {
                const config = result.pendingFollowThreadConfig;
                // 检查是否是最近5分钟内的请求
                if (Date.now() - config.timestamp < 5 * 60 * 1000) {
                    console.log('👁 检测到关注后续配置请求:', config);

                    // 自动填充表单
                    // 🆕 预先生成规则主体文本，类似自动答复的做法
                    setNewTopic(`关于以下内容的后续讨论："${config.content}"`);
                    // 🔧 关注后续应该捕获所有人的讨论，所以发送人留空（允许用户自定义）
                    setNewFilterSender('');
                    setNewFilterGroup(config.groupName || '');
                    setNewFollowThread(true);
                    // 🆕 设置通用通知配置（外层）
                    setNewNotifyMethod('bot');
                    setNewNotifyFrequency('immediate');
                    // 🆕 followConfig 只保留原消息和关键词等特有配置
                    setNewFollowConfig({
                        originalMessage: {
                            postId: config.postId,
                            teamId: config.groupId,
                            teamName: config.groupName,
                            sender: config.sender,
                            content: config.content,
                            datetime: config.timestamp,
                            messageUrl: config.messageLink
                        },
                        createdAt: new Date().toISOString(),
                        keywordFilter: [],
                        relatedMessages: []
                    });
                    setShowAddForm(true);
                }

                // 清除 pending 配置
                await chrome.storage.local.remove('pendingFollowThreadConfig');
            }
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
                setIsLoading(changes.ollamaAnalysisProgress.newValue && changes.ollamaAnalysisProgress.newValue.lastAnalyzedIndex < changes.ollamaAnalysisProgress.newValue.total);
                if (changes.ollamaAnalysisProgress.newValue && changes.ollamaAnalysisProgress.newValue.lastAnalyzedIndex >= changes.ollamaAnalysisProgress.newValue.total) {
                    chrome.storage.local.remove('ollamaAnalysisProgress');
                }
            }
            
            // 监听任务状态变化
            if (changes.taskStates) {
                const taskStates = changes.taskStates.newValue;
                if (taskStates && taskStates.message_analysis) {
                    setIsSilentAnalysisEnabled(taskStates.message_analysis.enabled);
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

    const loadTopics = async () => {
        const result = await chrome.storage.local.get('concernedItems');
        if (result.concernedItems) {
            let needsMigration = false;
            const topicsWithIds = result.concernedItems.map((topic: TopicItem) => {
                const migrated = {
                    ...topic,
                    id: topic.id || Math.random().toString(36).substr(2, 9),
                    mentionMe: topic.mentionMe || false,
                    // 兼容旧数据：自动答复相关字段
                    autoReply: topic.autoReply || false,
                    autoReplyConfig: topic.autoReplyConfig || undefined
                };
                
                // 🆕 迁移 pushToGlip 到 notifyMethod
                if (topic.pushToGlip !== undefined && !topic.notifyMethod) {
                    migrated.notifyMethod = topic.pushToGlip ? 'bot' : '';
                    needsMigration = true;
                }
                // 删除已废弃的 pushToGlip 字段
                delete (migrated as any).pushToGlip;
                
                return migrated;
            });
            setTopics(topicsWithIds);
            
            // 如果有数据需要迁移，自动保存
            if (needsMigration) {
                await chrome.storage.local.set({ concernedItems: topicsWithIds });
                console.log('✅ 已迁移 pushToGlip 到 notifyMethod');
            }
        }
    };

    const saveTopics = async (newTopics: TopicItem[]) => {
        await chrome.storage.local.set({ concernedItems: newTopics });
        setTopics(newTopics);
    };

    const handleDelete = async (index: number) => {
        const newTopics = topics.filter((_, i) => i !== index);
        await saveTopics(newTopics);
    };

    const handleEdit = (topic: TopicItem) => {
        setEditingTopic(topic);
    };

    const handleSaveEdit = async () => {
        if (!editingTopic) return;
        
        // 🔧 在保存之前，保存需要检查的状态
        const savedAutoReply = editingTopic.autoReply;
        const savedFollowThread = editingTopic.followThread;
        
        // 🆕 直接保存，不再需要同步 expiresAt（已移除）
        const newTopics = topics.map(t => 
            t.id === editingTopic.id ? editingTopic : t
        );
        await saveTopics(newTopics);
        setEditingTopic(null);

        // 如果保存的是自动答复或关注后续，检查静默消息分析是否启用
        if ((savedAutoReply || savedFollowThread) && !isSilentAnalysisEnabled) {
            const shouldEnable = confirm(
                '✅ 保存成功！\n\n⚠️ 检测到您尚未开启"静默消息分析"功能。\n\n如果不开启此功能，系统将无法捕获消息并触发自动答复或关注后续。\n\n是否立即开启静默消息分析？'
            );
            if (shouldEnable) {
                chrome.runtime.sendMessage({
                    type: 'CONTROL_TASK',
                    taskId: 'message_analysis',
                    action: 'toggle',
                    enabled: true
                });
                setIsSilentAnalysisEnabled(true);
            }
        }
    };

    const handleAdd = async () => {
        if (!newTopic) return;

        const newTopicItem: TopicItem = {
            id: Math.random().toString(36).substr(2, 9),
            text: newTopic,
            expiredAt: newExpiry ? Date.now() + (parseInt(newExpiry) * 24 * 60 * 60 * 1000) : 0,
            mentionMe: newMentionMe,
            // 新增：通用匹配条件
            filterSender: newFilterSender || undefined,
            filterGroup: newFilterGroup || undefined,
            // 🆕 通用通知配置（notifyMethod 使用逗号分隔格式）
            notifyMethod: newNotifyMethod || undefined,
            notifyFrequency: (newFollowThread || newAutoReply) ? newNotifyFrequency : undefined,
            // 🆕 每日摘要配置
            digestConfig: newDigestEnabled ? {
                enabled: true,
                frequency: newDigestFrequency,
                preferredHour: newDigestHour
            } : undefined,
            // 自动答复配置
            autoReply: newAutoReply,
            autoReplyConfig: newAutoReply ? { ...newAutoReplyConfig, enabled: true } : undefined,
            // 关注后续配置
            followThread: newFollowThread,
            followConfig: newFollowThread && newFollowConfig ? {
                ...newFollowConfig,
                createdAt: new Date().toISOString()
                // 🆕 移除 expiresAt，使用外层 expiredAt
            } : undefined
        };

        await saveTopics([...topics, newTopicItem]);

        // 如果启用了关注后续，存储原消息到 ChromaDB
        if (newFollowThread && newFollowConfig) {
            try {
                await chrome.runtime.sendMessage({
                    type: 'STORE_FOLLOWED_MESSAGE',
                    data: {
                        followItemId: newTopicItem.id,
                        message: newFollowConfig.originalMessage,
                        isOriginal: true
                    }
                });
                console.log('✅ 原消息已存储到 ChromaDB');
            } catch (error) {
                console.error('❌ 存储原消息失败:', error);
            }
        }

        // 🔧 在重置表单之前，保存需要检查的状态
        const savedAutoReply = newAutoReply;
        const savedFollowThread = newFollowThread;

        // 重置表单
        setNewTopic('');
        setNewExpiry('30');
        setNewMentionMe(false);
        setNewFilterSender('');
        setNewFilterGroup('');
        setNewNotifyMethod('bot');
        setNewNotifyFrequency('immediate');
        setNewDigestEnabled(false);
        setNewDigestFrequency('daily');
        setNewDigestHour(18);
        setNewAutoReply(false);
        setNewAutoReplyConfig({
            enabled: false,
            replyContent: '',
            useAIGenerate: true,
            reviewMode: 'delayed',
            delayHours: 1
        });
        setNewFollowThread(false);
        setNewFollowConfig(null);
        setShowAddForm(false);

        // 如果保存的是自动答复或关注后续，检查静默消息分析是否启用
        if ((savedAutoReply || savedFollowThread) && !isSilentAnalysisEnabled) {
            const shouldEnable = confirm(
                '✅ 保存成功！\n\n⚠️ 检测到您尚未开启"静默消息分析"功能。\n\n如果不开启此功能，系统将无法捕获消息并触发自动答复或关注后续。\n\n是否立即开启静默消息分析？'
            );
            if (shouldEnable) {
                chrome.runtime.sendMessage({
                    type: 'CONTROL_TASK',
                    taskId: 'message_analysis',
                    action: 'toggle',
                    enabled: true
                });
                setIsSilentAnalysisEnabled(true);
            }
        }
    };

    const getDaysRemaining = (expiredAt: number) => {
        const days = Math.ceil((expiredAt - Date.now()) / (1000 * 60 * 60 * 24));
        return days > 0 ? days : 0;
    };

    // 拖拽相关函数
    const handleDragStart = (index: number) => {
        setDraggedItem(index);
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        setDragOverItem(index);
    };

    const handleDragEnd = async () => {
        if (draggedItem === null || dragOverItem === null || draggedItem === dragOverItem) {
            setDraggedItem(null);
            setDragOverItem(null);
            return;
        }

        // 创建新的排序后的列表
        const newTopicList = [...topics];
        const draggedTopic = newTopicList[draggedItem];
        
        // 从原位置删除
        newTopicList.splice(draggedItem, 1);
        // 在新位置插入
        newTopicList.splice(dragOverItem, 0, draggedTopic);
        
        // 保存新排序
        await saveTopics(newTopicList);
        
        // 重置拖拽状态
        setDraggedItem(null);
        setDragOverItem(null);
    };

    const exportToXML = () => {
        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<topics>\n';
        topics.forEach(topic => {
            xml += `  <topic>\n`;
            xml += `    <id>${topic.id}</id>\n`;
            xml += `    <text>${encodeXML(topic.text)}</text>\n`;
            xml += `    <expiredAt>${topic.expiredAt}</expiredAt>\n`;
            xml += `    <notifyMethod>${topic.notifyMethod || ''}</notifyMethod>\n`;
            xml += `    <mentionMe>${topic.mentionMe || false}</mentionMe>\n`;
            xml += `    <autoReply>${topic.autoReply || false}</autoReply>\n`;
            if (topic.autoReplyConfig) {
                xml += `    <autoReplyConfig>${encodeXML(JSON.stringify(topic.autoReplyConfig))}</autoReplyConfig>\n`;
            }
            xml += `  </topic>\n`;
        });
        xml += '</topics>';
        
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        const dateString = `${year}-${month}-${day}`;
        const fileName = `Personal AI - topics ${dateString}.xml`;
        
        const blob = new Blob([xml], { type: 'text/xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
    };

    const importFromXML = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = async (e) => {
            const xml = e.target?.result as string;
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xml, "text/xml");
            
            const topicElements = xmlDoc.getElementsByTagName("topic");
            const importedTopics: TopicItem[] = [];
            
            for (let i = 0; i < topicElements.length; i++) {
                const topicEl = topicElements[i];
                const id = topicEl.getElementsByTagName("id")[0]?.textContent || Math.random().toString(36).substr(2, 9);
                const text = topicEl.getElementsByTagName("text")[0]?.textContent || "";
                const expiredAtStr = topicEl.getElementsByTagName("expiredAt")[0]?.textContent || "0";
                const expiredAt = parseInt(expiredAtStr);
                
                // 🆕 支持新的 notifyMethod 格式，同时兼容旧的 pushToGlip
                let notifyMethod = topicEl.getElementsByTagName("notifyMethod")[0]?.textContent || "";
                const pushToGlipStr = topicEl.getElementsByTagName("pushToGlip")[0]?.textContent || "false";
                // 如果没有 notifyMethod 但有 pushToGlip，进行迁移
                if (!notifyMethod && pushToGlipStr === "true") {
                    notifyMethod = 'bot';
                }
                
                const mentionMeStr = topicEl.getElementsByTagName("mentionMe")[0]?.textContent || "false";
                const mentionMe = mentionMeStr === "true";
                const autoReplyStr = topicEl.getElementsByTagName("autoReply")[0]?.textContent || "false";
                const autoReply = autoReplyStr === "true";
                const autoReplyConfigStr = topicEl.getElementsByTagName("autoReplyConfig")[0]?.textContent || "";
                let autoReplyConfig: AutoReplyConfig | undefined;
                if (autoReplyConfigStr) {
                    try {
                        autoReplyConfig = JSON.parse(autoReplyConfigStr);
                    } catch (e) {
                        console.warn('Failed to parse autoReplyConfig:', e);
                    }
                }
                
                if (text) {
                    importedTopics.push({
                        id,
                        text,
                        expiredAt,
                        notifyMethod,
                        mentionMe,
                        autoReply,
                        autoReplyConfig
                    });
                }
            }
            
            if (importedTopics.length > 0) {
                await saveTopics(importedTopics);
            }
        };
        reader.readAsText(file);
    };

    const encodeXML = (str: string): string => {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    };

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
            if (!userinfo || userinfo.fullName === '') {
                const userInfoResponse = await sendMessageWithRetry(rcTab.id, { type: 'GET_USER_INFO' }) as unknown as TabResponse;
                userinfo = userInfoResponse.data;
            }
            if (!userinfo || !userinfo.fullName) {
                throw new Error('Failed to get page config');
            }
            
            // MESSAGE_CONTEXT_WINDOW 是从此刻往前推的绝对时间窗口
            const contextWindow = envConfig ? Number(envConfig.MESSAGE_CONTEXT_WINDOW) : 125;
            const startTime = new Date(Date.now() - contextWindow * 60 * 1000);
            
            // 获取用户数据
            const response = await sendMessageWithRetry(rcTab.id, {
                type: 'FETCH_USER_MESSAGES',
                startTime,
            }) as unknown as TabResponse;
            
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

    const getIntervalHours = () => {
        if (envConfig) {
            return (Number(envConfig.MESSAGE_CONTEXT_WINDOW) / 60).toFixed(1);
        }
        return '2.1'; // 默认 125 分钟 ≈ 2.1 小时
    };

    // AI 生成答复建议（新增表单）
    const handleGenerateReplyForNew = async () => {
        if (!newTopic) {
            alert('请先输入关注话题');
            return;
        }
        setIsGeneratingReply(true);
        try {
            const reply = await generateAutoReply({
                messageContent: newTopic,
                sender: newFilterSender || '未知发送者',
                groupName: newFilterGroup || '未知群组',
                summary: `用户关注的话题：${newTopic}`,
                replyTemplate: newAutoReplyConfig.replyContent  // 传递现有模板作为参考
            });
            setNewAutoReplyConfig({
                ...newAutoReplyConfig,
                replyContent: reply
            });
        } catch (error) {
            console.error('生成答复失败:', error);
            alert('生成答复失败，请稍后重试');
        } finally {
            setIsGeneratingReply(false);
        }
    };

    // AI 生成答复建议（编辑表单）
    const handleGenerateReplyForEdit = async () => {
        if (!editingTopic) return;
        setIsGeneratingReply(true);
        try {
            const reply = await generateAutoReply({
                messageContent: editingTopic.text,
                sender: editingTopic.filterSender || '未知发送者',
                groupName: editingTopic.filterGroup || '未知群组',
                summary: `用户关注的话题：${editingTopic.text}`,
                replyTemplate: editingTopic.autoReplyConfig?.replyContent  // 传递现有模板作为参考
            });
            setEditingTopic({
                ...editingTopic,
                autoReplyConfig: {
                    ...editingTopic.autoReplyConfig!,
                    replyContent: reply
                }
            });
        } catch (error) {
            console.error('生成答复失败:', error);
            alert('生成答复失败，请稍后重试');
        } finally {
            setIsGeneratingReply(false);
        }
    };

    // 启用静默消息分析
    const enableSilentAnalysis = () => {
        chrome.runtime.sendMessage({
            type: 'CONTROL_TASK',
            taskId: 'message_analysis',
            action: 'toggle',
            enabled: true
        });
        setIsSilentAnalysisEnabled(true);
    };

    return (
        <div className="topic-modal">
            <h2>关注话题管理</h2>
            
            {/* 静默消息分析警告横幅 */}
            {!isSilentAnalysisEnabled && (
                <div className="warning-banner">
                    <div className="warning-content">
                        <span className="warning-icon">⚠️</span>
                        <span className="warning-text">
                            静默消息分析未启用！自动答复和关注后续功能需要开启此功能才能正常工作。
                        </span>
                        <button 
                            className="warning-action-btn"
                            onClick={enableSilentAnalysis}
                        >
                            立即启用
                        </button>
                    </div>
                </div>
            )}
            
            <div className="topic-list">
                {topics.map((topic, index) => (
                    <div 
                        key={topic.id} 
                        className={`topic-item ${dragOverItem === index ? 'drag-over' : ''}`}
                        draggable={editingTopic?.id !== topic.id}
                        onDragStart={() => handleDragStart(index)}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDragEnd={handleDragEnd}
                    >
                        {editingTopic?.id === topic.id ? (
                            <div className="topic-edit-form">
                                <div className="edit-text-field">
                                    <input
                                        className="text-input"
                                        value={editingTopic.text}
                                        onChange={e => setEditingTopic({
                                            ...editingTopic,
                                            text: e.target.value
                                        })}
                                    />
                                </div>
                                <div className="edit-controls">
                                    <div className="expiry-field">
                                        <input
                                            type="number"
                                            className="expiry-input"
                                            value={editingTopic.expiredAt ? Math.ceil((editingTopic.expiredAt - Date.now()) / (1000 * 60 * 60 * 24)) : ''}
                                            onChange={e => setEditingTopic({
                                                ...editingTopic,
                                                expiredAt: e.target.value ? Date.now() + (parseInt(e.target.value) * 24 * 60 * 60 * 1000) : 0
                                            })}
                                            min="1"
                                            placeholder="天数"
                                        />
                                        <div className="tooltip-container">
                                            <span className="info-icon">i</span>
                                            <span className="tooltip-text">不自动过期请留空</span>
                                        </div>
                                    </div>
                                    <div className="checkbox-container">
                                        <input
                                            type="checkbox"
                                            id={`notify-bot-${topic.id}`}
                                            checked={(editingTopic.notifyMethod || '').includes('bot')}
                                            onChange={e => {
                                                const methods = (editingTopic.notifyMethod || '').split(',').filter(m => m);
                                                if (e.target.checked) {
                                                    if (!methods.includes('bot')) methods.push('bot');
                                                } else {
                                                    const idx = methods.indexOf('bot');
                                                    if (idx > -1) methods.splice(idx, 1);
                                                }
                                                setEditingTopic({
                                                    ...editingTopic,
                                                    notifyMethod: methods.join(','),
                                                    mentionMe: methods.includes('bot') ? (editingTopic.mentionMe || false) : false
                                                });
                                            }}
                                        />
                                        <label htmlFor={`notify-bot-${topic.id}`}>Glip推送</label>
                                    </div>
                                    <div className="checkbox-container">
                                        <input
                                            type="checkbox"
                                            id={`notify-chrome-${topic.id}`}
                                            checked={(editingTopic.notifyMethod || '').includes('chrome')}
                                            onChange={e => {
                                                const methods = (editingTopic.notifyMethod || '').split(',').filter(m => m);
                                                if (e.target.checked) {
                                                    if (!methods.includes('chrome')) methods.push('chrome');
                                                } else {
                                                    const idx = methods.indexOf('chrome');
                                                    if (idx > -1) methods.splice(idx, 1);
                                                }
                                                setEditingTopic({
                                                    ...editingTopic,
                                                    notifyMethod: methods.join(',')
                                                });
                                            }}
                                        />
                                        <label htmlFor={`notify-chrome-${topic.id}`}>Chrome通知</label>
                                    </div>
                                    <div className="checkbox-container">
                                        <input
                                            type="checkbox"
                                            id={`mention-me-${topic.id}`}
                                            checked={editingTopic.mentionMe || false}
                                            disabled={!(editingTopic.notifyMethod || '').includes('bot')}
                                            onChange={e => setEditingTopic({
                                                ...editingTopic,
                                                mentionMe: e.target.checked
                                            })}
                                        />
                                        <label htmlFor={`mention-me-${topic.id}`}>@我</label>
                                    </div>
                                    <div className="checkbox-container">
                                        <input
                                            type="checkbox"
                                            id={`auto-reply-${topic.id}`}
                                            checked={editingTopic.autoReply || false}
                                            onChange={e => setEditingTopic({
                                                ...editingTopic,
                                                autoReply: e.target.checked,
                                                autoReplyConfig: e.target.checked ? (editingTopic.autoReplyConfig || {
                                                    enabled: true,
                                                    replyContent: '',
                                                    useAIGenerate: true,
                                                    reviewMode: 'delayed',
                                                    delayHours: 1
                                                }) : undefined
                                            })}
                                        />
                                        <label htmlFor={`auto-reply-${topic.id}`}>自动答复</label>
                                    </div>
                                    <div className="checkbox-container">
                                        <input
                                            type="checkbox"
                                            id={`follow-thread-${topic.id}`}
                                            checked={editingTopic.followThread || false}
                                            onChange={e => setEditingTopic({
                                                ...editingTopic,
                                                followThread: e.target.checked
                                            })}
                                        />
                                        <label htmlFor={`follow-thread-${topic.id}`}>关注后续</label>
                                    </div>
                                </div>
                                
                                {/* 通用匹配条件（可编辑） */}
                                <div className="filter-conditions">
                                    <div className="filter-item">
                                        <label htmlFor={`filter-sender-${topic.id}`}>匹配发送人:</label>
                                        <input
                                            type="text"
                                            id={`filter-sender-${topic.id}`}
                                            placeholder="留空表示不限发送人"
                                            value={editingTopic.filterSender || ''}
                                            onChange={e => setEditingTopic({
                                                ...editingTopic,
                                                filterSender: e.target.value || undefined
                                            })}
                                        />
                                    </div>
                                    <div className="filter-item">
                                        <label htmlFor={`filter-group-${topic.id}`}>匹配群组:</label>
                                        <input
                                            type="text"
                                            id={`filter-group-${topic.id}`}
                                            placeholder="留空表示不限群组"
                                            value={editingTopic.filterGroup || ''}
                                            onChange={e => setEditingTopic({
                                                ...editingTopic,
                                                filterGroup: e.target.value || undefined
                                            })}
                                        />
                                    </div>
                                </div>
                                
                                {/* 编辑时的自动答复配置区域 */}
                                {editingTopic.autoReply && (
                                    <div className="auto-reply-config">
                                        
                                        <div className="config-section">
                                            <div className="config-title">回复内容：</div>
                                            <textarea
                                                className="reply-content-input"
                                                placeholder="输入回复内容模板"
                                                value={editingTopic.autoReplyConfig?.replyContent || ''}
                                                onChange={e => setEditingTopic({
                                                    ...editingTopic,
                                                    autoReplyConfig: {
                                                        ...editingTopic.autoReplyConfig!,
                                                        replyContent: e.target.value
                                                    }
                                                })}
                                                rows={3}
                                            />
                                            <div className="reply-options">
                                                <button
                                                    type="button"
                                                    className="ai-generate-btn"
                                                    onClick={handleGenerateReplyForEdit}
                                                    disabled={isGeneratingReply}
                                                >
                                                    {isGeneratingReply ? '生成中...' : '🤖 AI 生成建议'}
                                                </button>
                                                <div className="checkbox-container">
                                                    <input
                                                        type="checkbox"
                                                        id={`use-ai-${topic.id}`}
                                                        checked={editingTopic.autoReplyConfig?.useAIGenerate || false}
                                                        onChange={e => setEditingTopic({
                                                            ...editingTopic,
                                                            autoReplyConfig: {
                                                                ...editingTopic.autoReplyConfig!,
                                                                useAIGenerate: e.target.checked
                                                            }
                                                        })}
                                                    />
                                                    <label htmlFor={`use-ai-${topic.id}`}>每次AI生成类似答复</label>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div className="config-section">
                                            <div className="config-title">答复模式：</div>
                                            <div className="radio-group">
                                                <div className="radio-option">
                                                    <input
                                                        type="radio"
                                                        id={`review-immediate-${topic.id}`}
                                                        name={`review-mode-${topic.id}`}
                                                        checked={editingTopic.autoReplyConfig?.reviewMode === 'immediate'}
                                                        onChange={() => setEditingTopic({
                                                            ...editingTopic,
                                                            autoReplyConfig: {
                                                                ...editingTopic.autoReplyConfig!,
                                                                reviewMode: 'immediate'
                                                            }
                                                        })}
                                                    />
                                                    <label htmlFor={`review-immediate-${topic.id}`}>直接发送（不审核）</label>
                                                </div>
                                                <div className="radio-option">
                                                    <input
                                                        type="radio"
                                                        id={`review-delayed-${topic.id}`}
                                                        name={`review-mode-${topic.id}`}
                                                        checked={editingTopic.autoReplyConfig?.reviewMode === 'delayed'}
                                                        onChange={() => setEditingTopic({
                                                            ...editingTopic,
                                                            autoReplyConfig: {
                                                                ...editingTopic.autoReplyConfig!,
                                                                reviewMode: 'delayed'
                                                            }
                                                        })}
                                                    />
                                                    <label htmlFor={`review-delayed-${topic.id}`}>
                                                        答复前 
                                                        <input
                                                            type="number"
                                                            className="delay-hours-input"
                                                            value={editingTopic.autoReplyConfig?.delayHours || 1}
                                                            onChange={e => setEditingTopic({
                                                                ...editingTopic,
                                                                autoReplyConfig: {
                                                                    ...editingTopic.autoReplyConfig!,
                                                                    delayHours: parseInt(e.target.value) || 1
                                                                }
                                                            })}
                                                            min="1"
                                                            max="72"
                                                        />
                                                        小时可拦截
                                                    </label>
                                                </div>
                                                <div className="radio-option">
                                                    <input
                                                        type="radio"
                                                        id={`review-manual-${topic.id}`}
                                                        name={`review-mode-${topic.id}`}
                                                        checked={editingTopic.autoReplyConfig?.reviewMode === 'manual'}
                                                        onChange={() => setEditingTopic({
                                                            ...editingTopic,
                                                            autoReplyConfig: {
                                                                ...editingTopic.autoReplyConfig!,
                                                                reviewMode: 'manual'
                                                            }
                                                        })}
                                                    />
                                                    <label htmlFor={`review-manual-${topic.id}`}>仅添加到审核列表（需手动确认）</label>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* 编辑时的每日摘要配置区域 */}
                                {(editingTopic.notifyMethod || '').includes('bot') && !editingTopic.followThread && (
                                    <div className="digest-config">
                                        <div className="config-section">
                                            <div className="checkbox-container">
                                                <input
                                                    type="checkbox"
                                                    id={`digest-enabled-${topic.id}`}
                                                    checked={editingTopic.digestConfig?.enabled || false}
                                                    onChange={e => setEditingTopic({
                                                        ...editingTopic,
                                                        digestConfig: e.target.checked ? {
                                                            enabled: true,
                                                            frequency: editingTopic.digestConfig?.frequency || 'daily',
                                                            preferredHour: editingTopic.digestConfig?.preferredHour ?? 18
                                                        } : undefined
                                                    })}
                                                />
                                                <label htmlFor={`digest-enabled-${topic.id}`}>使用定时摘要推送（替代即时通知）</label>
                                            </div>
                                        </div>
                                        {editingTopic.digestConfig?.enabled && (
                                            <div className="digest-options">
                                                <div className="config-section">
                                                    <div className="config-title">推送频率：</div>
                                                    <div className="radio-group horizontal">
                                                        <div className="radio-option">
                                                            <input
                                                                type="radio"
                                                                id={`digest-daily-${topic.id}`}
                                                                name={`digest-freq-${topic.id}`}
                                                                checked={editingTopic.digestConfig?.frequency === 'daily'}
                                                                onChange={() => setEditingTopic({
                                                                    ...editingTopic,
                                                                    digestConfig: { ...editingTopic.digestConfig!, frequency: 'daily' }
                                                                })}
                                                            />
                                                            <label htmlFor={`digest-daily-${topic.id}`}>每日</label>
                                                        </div>
                                                        <div className="radio-option">
                                                            <input
                                                                type="radio"
                                                                id={`digest-weekly-${topic.id}`}
                                                                name={`digest-freq-${topic.id}`}
                                                                checked={editingTopic.digestConfig?.frequency === 'weekly'}
                                                                onChange={() => setEditingTopic({
                                                                    ...editingTopic,
                                                                    digestConfig: { ...editingTopic.digestConfig!, frequency: 'weekly' }
                                                                })}
                                                            />
                                                            <label htmlFor={`digest-weekly-${topic.id}`}>每周</label>
                                                        </div>
                                                        <div className="radio-option">
                                                            <label>
                                                                推送时间：
                                                                <input
                                                                    type="number"
                                                                    className="delay-hours-input"
                                                                    value={editingTopic.digestConfig?.preferredHour ?? 18}
                                                                    onChange={e => setEditingTopic({
                                                                        ...editingTopic,
                                                                        digestConfig: { ...editingTopic.digestConfig!, preferredHour: parseInt(e.target.value) || 18 }
                                                                    })}
                                                                    min="0"
                                                                    max="23"
                                                                />
                                                                :00
                                                            </label>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="hint-text">
                                                    匹配到的消息不会立即推送，而是在指定时间汇总推送
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* 编辑时的关注后续配置区域 */}
                                {editingTopic.followThread && editingTopic.followConfig && (
                                    <div className="follow-thread-config">
                                        {/* 原消息预览卡片 */}
                                        <div className="config-section">
                                            <div className="config-title">原消息：</div>
                                            <div className="original-message-preview">
                                                <div className="message-meta">
                                                    <span className="sender">{editingTopic.followConfig.originalMessage.sender}</span>
                                                    <span className="datetime">{new Date(editingTopic.followConfig.originalMessage.datetime).toLocaleString()}</span>
                                                </div>
                                                <div className="message-content">
                                                    {editingTopic.followConfig.originalMessage.content}
                                                </div>
                                                <a
                                                    href={editingTopic.followConfig.originalMessage.messageUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="message-link"
                                                >
                                                    🔗 查看原消息
                                                </a>
                                            </div>
                                        </div>

                                        {/* 过期时间提示（使用外层 expiredAt） */}
                                        <div className="config-section">
                                            <div className="config-title">过期时间：</div>
                                            <div className="hint-text">
                                                剩余 {editingTopic.expiredAt ? Math.ceil((editingTopic.expiredAt - Date.now()) / (1000 * 60 * 60 * 24)) : 0} 天（修改上方"天数"可调整）
                                            </div>
                                        </div>

                                        {/* 🆕 通知方式（使用外层字段，多选） */}
                                        <div className="config-section">
                                            <div className="config-title">通知方式：</div>
                                            <div className="checkbox-group">
                                                <div className="checkbox-option">
                                                    <input
                                                        type="checkbox"
                                                        id={`edit-notify-bot-followthread-${topic.id}`}
                                                        checked={(editingTopic.notifyMethod || '').includes('bot')}
                                                        onChange={e => {
                                                            const methods = (editingTopic.notifyMethod || '').split(',').filter(m => m);
                                                            if (e.target.checked) {
                                                                if (!methods.includes('bot')) methods.push('bot');
                                                            } else {
                                                                const idx = methods.indexOf('bot');
                                                                if (idx > -1) methods.splice(idx, 1);
                                                            }
                                                            setEditingTopic({
                                                                ...editingTopic,
                                                                notifyMethod: methods.join(',')
                                                            });
                                                        }}
                                                    />
                                                    <label htmlFor={`edit-notify-bot-followthread-${topic.id}`}>Glip推送</label>
                                                </div>
                                                <div className="checkbox-option">
                                                    <input
                                                        type="checkbox"
                                                        id={`edit-notify-chrome-followthread-${topic.id}`}
                                                        checked={(editingTopic.notifyMethod || '').includes('chrome')}
                                                        onChange={e => {
                                                            const methods = (editingTopic.notifyMethod || '').split(',').filter(m => m);
                                                            if (e.target.checked) {
                                                                if (!methods.includes('chrome')) methods.push('chrome');
                                                            } else {
                                                                const idx = methods.indexOf('chrome');
                                                                if (idx > -1) methods.splice(idx, 1);
                                                            }
                                                            setEditingTopic({
                                                                ...editingTopic,
                                                                notifyMethod: methods.join(',')
                                                            });
                                                        }}
                                                    />
                                                    <label htmlFor={`edit-notify-chrome-followthread-${topic.id}`}>Chrome通知</label>
                                                </div>
                                            </div>
                                        </div>

                                        {/* 🆕 通知频率（使用外层字段） */}
                                        <div className="config-section">
                                            <div className="config-title">通知频率：</div>
                                            <div className="radio-group">
                                                <div className="radio-option">
                                                    <input
                                                        type="radio"
                                                        id={`edit-freq-immediate-${topic.id}`}
                                                        name={`edit-notify-frequency-${topic.id}`}
                                                        checked={editingTopic.notifyFrequency === 'immediate'}
                                                        onChange={() => setEditingTopic({
                                                            ...editingTopic,
                                                            notifyFrequency: 'immediate'
                                                        })}
                                                    />
                                                    <label htmlFor={`edit-freq-immediate-${topic.id}`}>立即通知（每条新消息）</label>
                                                </div>
                                                <div className="radio-option">
                                                    <input
                                                        type="radio"
                                                        id={`edit-freq-merged-${topic.id}`}
                                                        name={`edit-notify-frequency-${topic.id}`}
                                                        checked={editingTopic.notifyFrequency === 'merged'}
                                                        onChange={() => setEditingTopic({
                                                            ...editingTopic,
                                                            notifyFrequency: 'merged'
                                                        })}
                                                    />
                                                    <label htmlFor={`edit-freq-merged-${topic.id}`}>合并通知（定期汇总）</label>
                                                </div>
                                            </div>
                                        </div>

                                        {/* 关键词过滤（可选） */}
                                        <div className="config-section">
                                            <div className="config-title">关键词过滤（可选）：</div>
                                            <input
                                                type="text"
                                                className="keyword-filter-input"
                                                placeholder="输入关键词，用逗号分隔（留空表示不过滤）"
                                                value={editingTopic.followConfig.keywordFilter?.join(', ') || ''}
                                                onChange={e => setEditingTopic({
                                                    ...editingTopic,
                                                    followConfig: {
                                                        ...editingTopic.followConfig!,
                                                        keywordFilter: e.target.value.split(',').map(k => k.trim()).filter(k => k.length > 0)
                                                    }
                                                })}
                                            />
                                            <div className="hint-text">
                                                只有包含这些关键词的回复才会触发通知
                                            </div>
                                        </div>

                                        {/* 关联消息统计 */}
                                        {editingTopic.followConfig.relatedMessages && editingTopic.followConfig.relatedMessages.length > 0 && (
                                            <div className="config-section">
                                                <div className="config-title">关联消息：</div>
                                                <div className="hint-text">
                                                    已捕获 {editingTopic.followConfig.relatedMessages.length} 条关联消息
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                                
                                <div className="form-buttons">
                                    <button onClick={handleSaveEdit}>保存</button>
                                    <button onClick={() => setEditingTopic(null)}>取消</button>
                                </div>
                            </div>
                        ) : (
                            <div className="topic-display">
                                <div className="drag-handle">⋮⋮</div>
                                <span className="topic-text">{topic.text}</span>
                                {topic.expiredAt > 0 && getDaysRemaining(topic.expiredAt) > 0 && (
                                    <span className="topic-expiry">
                                        还剩 {getDaysRemaining(topic.expiredAt)} 天
                                    </span>
                                )}
                                {(topic.notifyMethod || '').includes('bot') && (
                                    <span className="glip-indicator">
                                        Glip ✓{topic.mentionMe && <span className="mention-indicator"> @</span>}
                                    </span>
                                )}
                                {(topic.notifyMethod || '').includes('chrome') && (
                                    <span className="chrome-indicator">
                                        🔔
                                    </span>
                                )}
                                {topic.digestConfig?.enabled && (
                                    <span className="digest-indicator" title={`定时摘要 (${topic.digestConfig.frequency === 'daily' ? '每日' : '每周'} ${topic.digestConfig.preferredHour ?? 18}:00)`}>
                                        📊
                                    </span>
                                )}
                                {topic.autoReply && (
                                    <span className="auto-reply-indicator" title="已启用自动答复">
                                        🤖
                                    </span>
                                )}
                                {topic.followThread && (
                                    <span className="follow-thread-indicator" title="正在关注后续">
                                        👁
                                    </span>
                                )}
                                <button onClick={() => handleEdit(topic)}>✏️</button>
                                <button onClick={() => handleDelete(topics.indexOf(topic))}>🗑️</button>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {showAddForm ? (
                <div className="add-topic-form">
                    <div className="add-text-field">
                        <input
                            className="text-input"
                            placeholder="输入关注话题"
                            value={newTopic}
                            onChange={e => setNewTopic(e.target.value)}
                        />
                    </div>
                    <div className="add-controls">
                        <div className="expiry-field">
                            <input
                                type="number"
                                className="expiry-input"
                                value={newExpiry}
                                onChange={e => setNewExpiry(e.target.value)}
                                min="1"
                                placeholder="过期天数"
                            />
                            <div className="tooltip-container">
                                <span className="info-icon">i</span>
                                <span className="tooltip-text">不自动过期请留空</span>
                            </div>
                        </div>
                        <div className="checkbox-container">
                            <input
                                type="checkbox"
                                id="new-notify-bot"
                                checked={(newNotifyMethod || '').includes('bot')}
                                onChange={e => {
                                    const methods = (newNotifyMethod || '').split(',').filter(m => m);
                                    if (e.target.checked) {
                                        if (!methods.includes('bot')) methods.push('bot');
                                    } else {
                                        const idx = methods.indexOf('bot');
                                        if (idx > -1) methods.splice(idx, 1);
                                        setNewMentionMe(false);
                                    }
                                    setNewNotifyMethod(methods.join(','));
                                }}
                            />
                            <label htmlFor="new-notify-bot">Glip推送</label>
                        </div>
                        <div className="checkbox-container">
                            <input
                                type="checkbox"
                                id="new-notify-chrome"
                                checked={(newNotifyMethod || '').includes('chrome')}
                                onChange={e => {
                                    const methods = (newNotifyMethod || '').split(',').filter(m => m);
                                    if (e.target.checked) {
                                        if (!methods.includes('chrome')) methods.push('chrome');
                                    } else {
                                        const idx = methods.indexOf('chrome');
                                        if (idx > -1) methods.splice(idx, 1);
                                    }
                                    setNewNotifyMethod(methods.join(','));
                                }}
                            />
                            <label htmlFor="new-notify-chrome">Chrome通知</label>
                        </div>
                        <div className="checkbox-container">
                            <input
                                type="checkbox"
                                id="new-mention-me"
                                checked={newMentionMe}
                                disabled={!(newNotifyMethod || '').includes('bot')}
                                onChange={e => setNewMentionMe(e.target.checked)}
                            />
                            <label htmlFor="new-mention-me">@我</label>
                        </div>
                        <div className="checkbox-container">
                            <input
                                type="checkbox"
                                id="new-auto-reply"
                                checked={newAutoReply}
                                onChange={e => setNewAutoReply(e.target.checked)}
                            />
                            <label htmlFor="new-auto-reply">自动答复</label>
                        </div>
                        <div className="checkbox-container">
                            <input
                                type="checkbox"
                                id="new-follow-thread"
                                checked={newFollowThread}
                                onChange={e => setNewFollowThread(e.target.checked)}
                            />
                            <label htmlFor="new-follow-thread">关注后续</label>
                        </div>
                    </div>

                    {/* 通用匹配条件（可编辑） */}
                    <div className="filter-conditions">
                        <div className="filter-item">
                            <label htmlFor="new-filter-sender">匹配发送人:</label>
                            <input
                                type="text"
                                id="new-filter-sender"
                                placeholder="留空表示不限发送人"
                                value={newFilterSender}
                                onChange={e => setNewFilterSender(e.target.value)}
                            />
                        </div>
                        <div className="filter-item">
                            <label htmlFor="new-filter-group">匹配群组:</label>
                            <input
                                type="text"
                                id="new-filter-group"
                                placeholder="留空表示不限群组"
                                value={newFilterGroup}
                                onChange={e => setNewFilterGroup(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* 每日摘要配置区域（仅在启用 Glip 推送且非关注后续模式时显示） */}
                    {(newNotifyMethod || '').includes('bot') && !newFollowThread && (
                        <div className="digest-config">
                            <div className="config-section">
                                <div className="checkbox-container">
                                    <input
                                        type="checkbox"
                                        id="new-digest-enabled"
                                        checked={newDigestEnabled}
                                        onChange={e => setNewDigestEnabled(e.target.checked)}
                                    />
                                    <label htmlFor="new-digest-enabled">使用定时摘要推送（替代即时通知）</label>
                                </div>
                            </div>
                            {newDigestEnabled && (
                                <div className="digest-options">
                                    <div className="config-section">
                                        <div className="config-title">推送频率：</div>
                                        <div className="radio-group horizontal">
                                            <div className="radio-option">
                                                <input
                                                    type="radio"
                                                    id="new-digest-daily"
                                                    name="new-digest-freq"
                                                    checked={newDigestFrequency === 'daily'}
                                                    onChange={() => setNewDigestFrequency('daily')}
                                                />
                                                <label htmlFor="new-digest-daily">每日</label>
                                            </div>
                                            <div className="radio-option">
                                                <input
                                                    type="radio"
                                                    id="new-digest-weekly"
                                                    name="new-digest-freq"
                                                    checked={newDigestFrequency === 'weekly'}
                                                    onChange={() => setNewDigestFrequency('weekly')}
                                                />
                                                <label htmlFor="new-digest-weekly">每周</label>
                                            </div>
                                            <div className="radio-option">
                                                <label>
                                                    推送时间：
                                                    <input
                                                        type="number"
                                                        className="delay-hours-input"
                                                        value={newDigestHour}
                                                        onChange={e => setNewDigestHour(parseInt(e.target.value) || 18)}
                                                        min="0"
                                                        max="23"
                                                    />
                                                    :00
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="hint-text">
                                        匹配到的消息不会立即推送，而是在指定时间汇总推送
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                    
                    {/* 自动答复配置区域 */}
                    {newAutoReply && (
                        <div className="auto-reply-config">
                            
                            <div className="config-section">
                                <div className="config-title">回复内容：</div>
                                <textarea
                                    className="reply-content-input"
                                    placeholder="输入回复内容模板，或点击AI生成"
                                    value={newAutoReplyConfig.replyContent}
                                    onChange={e => setNewAutoReplyConfig({
                                        ...newAutoReplyConfig,
                                        replyContent: e.target.value
                                    })}
                                    rows={3}
                                />
                                <div className="reply-options">
                                    <button
                                        type="button"
                                        className="ai-generate-btn"
                                        onClick={handleGenerateReplyForNew}
                                        disabled={isGeneratingReply}
                                    >
                                        {isGeneratingReply ? '生成中...' : '🤖 AI 生成建议'}
                                    </button>
                                    <div className="checkbox-container">
                                        <input
                                            type="checkbox"
                                            id="new-use-ai"
                                            checked={newAutoReplyConfig.useAIGenerate}
                                            onChange={e => setNewAutoReplyConfig({
                                                ...newAutoReplyConfig,
                                                useAIGenerate: e.target.checked
                                            })}
                                        />
                                        <label htmlFor="new-use-ai">每次AI生成类似答复</label>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="config-section">
                                <div className="config-title">答复模式：</div>
                                <div className="radio-group">
                                    <div className="radio-option">
                                        <input
                                            type="radio"
                                            id="new-review-immediate"
                                            name="new-review-mode"
                                            checked={newAutoReplyConfig.reviewMode === 'immediate'}
                                            onChange={() => setNewAutoReplyConfig({
                                                ...newAutoReplyConfig,
                                                reviewMode: 'immediate'
                                            })}
                                        />
                                        <label htmlFor="new-review-immediate">直接发送（不审核）</label>
                                    </div>
                                    <div className="radio-option">
                                        <input
                                            type="radio"
                                            id="new-review-delayed"
                                            name="new-review-mode"
                                            checked={newAutoReplyConfig.reviewMode === 'delayed'}
                                            onChange={() => setNewAutoReplyConfig({
                                                ...newAutoReplyConfig,
                                                reviewMode: 'delayed'
                                            })}
                                        />
                                        <label htmlFor="new-review-delayed">
                                            答复前 
                                            <input
                                                type="number"
                                                className="delay-hours-input"
                                                value={newAutoReplyConfig.delayHours || 1}
                                                onChange={e => setNewAutoReplyConfig({
                                                    ...newAutoReplyConfig,
                                                    delayHours: parseInt(e.target.value) || 1
                                                })}
                                                min="1"
                                                max="72"
                                            />
                                            小时可拦截
                                        </label>
                                    </div>
                                    <div className="radio-option">
                                        <input
                                            type="radio"
                                            id="new-review-manual"
                                            name="new-review-mode"
                                            checked={newAutoReplyConfig.reviewMode === 'manual'}
                                            onChange={() => setNewAutoReplyConfig({
                                                ...newAutoReplyConfig,
                                                reviewMode: 'manual'
                                            })}
                                        />
                                        <label htmlFor="new-review-manual">仅添加到审核列表（需手动确认）</label>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 关注后续配置区域 */}
                    {newFollowThread && newFollowConfig && (
                        <div className="follow-thread-config">
                            {/* 原消息预览卡片 */}
                            <div className="config-section">
                                <div className="config-title">原消息：</div>
                                <div className="original-message-preview">
                                    <div className="message-meta">
                                        <span className="sender">{newFollowConfig.originalMessage.sender}</span>
                                        <span className="datetime">{new Date(newFollowConfig.originalMessage.datetime).toLocaleString()}</span>
                                    </div>
                                    <div className="message-content">
                                        {newFollowConfig.originalMessage.content}
                                    </div>
                                    <a
                                        href={newFollowConfig.originalMessage.messageUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="message-link"
                                    >
                                        🔗 查看原消息
                                    </a>
                                </div>
                            </div>

                            {/* 🆕 通知方式（使用外层状态） */}
                            <div className="config-section">
                                <div className="config-title">通知方式：</div>
                                <div className="radio-group">
                                    <div className="radio-option">
                                        <input
                                            type="radio"
                                            id="notify-bot"
                                            name="notify-method"
                                            checked={newNotifyMethod === 'bot'}
                                            onChange={() => setNewNotifyMethod('bot')}
                                        />
                                        <label htmlFor="notify-bot">Glip推送</label>
                                    </div>
                                    <div className="radio-option">
                                        <input
                                            type="radio"
                                            id="notify-chrome"
                                            name="notify-method"
                                            checked={newNotifyMethod === 'chrome'}
                                            onChange={() => setNewNotifyMethod('chrome')}
                                        />
                                        <label htmlFor="notify-chrome">Chrome通知</label>
                                    </div>
                                    <div className="radio-option">
                                        <input
                                            type="radio"
                                            id="notify-both"
                                            name="notify-method"
                                            checked={newNotifyMethod === 'both'}
                                            onChange={() => setNewNotifyMethod('both')}
                                        />
                                        <label htmlFor="notify-both">两者都推送</label>
                                    </div>
                                </div>
                            </div>

                            {/* 🆕 通知频率（使用外层状态） */}
                            <div className="config-section">
                                <div className="config-title">通知频率：</div>
                                <div className="radio-group">
                                    <div className="radio-option">
                                        <input
                                            type="radio"
                                            id="freq-immediate"
                                            name="notify-frequency"
                                            checked={newNotifyFrequency === 'immediate'}
                                            onChange={() => setNewNotifyFrequency('immediate')}
                                        />
                                        <label htmlFor="freq-immediate">立即通知（每条新消息）</label>
                                    </div>
                                    <div className="radio-option">
                                        <input
                                            type="radio"
                                            id="freq-merged"
                                            name="notify-frequency"
                                            checked={newNotifyFrequency === 'merged'}
                                            onChange={() => setNewNotifyFrequency('merged')}
                                        />
                                        <label htmlFor="freq-merged">合并通知（定期汇总）</label>
                                    </div>
                                </div>
                            </div>

                            {/* 关键词过滤（可选） */}
                            <div className="config-section">
                                <div className="config-title">关键词过滤（可选）：</div>
                                <input
                                    type="text"
                                    className="keyword-filter-input"
                                    placeholder="输入关键词，用逗号分隔（留空表示不过滤）"
                                    value={newFollowConfig.keywordFilter?.join(', ') || ''}
                                    onChange={e => setNewFollowConfig({
                                        ...newFollowConfig,
                                        keywordFilter: e.target.value.split(',').map(k => k.trim()).filter(k => k.length > 0)
                                    })}
                                />
                                <div className="hint-text">
                                    只有包含这些关键词的回复才会触发通知
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="form-buttons">
                        <button onClick={handleAdd}>确认</button>
                        <button onClick={() => setShowAddForm(false)}>取消</button>
                    </div>
                </div>
            ) : (
                <button onClick={() => setShowAddForm(true)}>新增关注项</button>
            )}

            <div className="import-export-buttons">
                <button onClick={exportToXML}>导出XML</button>
                <label className="import-button">
                    导入XML
                    <input 
                        type="file" 
                        accept=".xml" 
                        style={{ display: 'none' }}
                        onChange={importFromXML} 
                    />
                </label>
            </div>

            <div className="analyze-button-container" style={{ marginTop: '16px' }}>
                <button 
                    onClick={handleSendToLLM}
                    disabled={isLoading}
                    style={{ width: '100%', padding: '8px', fontSize: '14px' }}
                >
                    {isLoading 
                        ? `正在分析 ${(analysisProgress?.lastAnalyzedIndex||0)+1}/${analysisProgress?.total||1} 条消息...` 
                        : `将最近 ${getIntervalHours()} 小时 Glip 消息发给 LLM 分析`}
                </button>
            </div>

            <style>{`
                .topic-modal {
                    padding: 16px;
                }

                .warning-banner {
                    background: linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%);
                    border: 2px solid #ffc107;
                    border-radius: 8px;
                    padding: 12px 16px;
                    margin-bottom: 16px;
                    box-shadow: 0 2px 8px rgba(255, 193, 7, 0.2);
                }

                .warning-content {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }

                .warning-icon {
                    font-size: 24px;
                    flex-shrink: 0;
                }

                .warning-text {
                    flex: 1;
                    color: #856404;
                    font-size: 14px;
                    font-weight: 500;
                    line-height: 1.5;
                }

                .warning-action-btn {
                    background-color: #ff9800;
                    color: white;
                    border: none;
                    border-radius: 6px;
                    padding: 8px 16px;
                    font-size: 13px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                    white-space: nowrap;
                    box-shadow: 0 2px 4px rgba(255, 152, 0, 0.3);
                }

                .warning-action-btn:hover {
                    background-color: #f57c00;
                    transform: translateY(-1px);
                    box-shadow: 0 4px 8px rgba(255, 152, 0, 0.4);
                }

                .warning-action-btn:active {
                    transform: translateY(0);
                    box-shadow: 0 2px 4px rgba(255, 152, 0, 0.3);
                }
                
                .topic-list {
                    margin-bottom: 16px;
                }
                
                .topic-item {
                    display: flex;
                    padding: 8px;
                    border-bottom: 1px solid #eee;
                    cursor: grab;
                    transition: background-color 0.2s;
                }
                
                .topic-item.drag-over {
                    background-color: #f0f0f0;
                    border: 1px dashed #aaa;
                }
                
                .topic-display {
                    display: flex;
                    width: 100%;
                    justify-content: space-between;
                    align-items: center;
                }
                
                .drag-handle {
                    color: #999;
                    margin-right: 8px;
                    cursor: grab;
                    font-size: 16px;
                    user-select: none;
                }
                
                .topic-edit-form {
                    display: flex;
                    flex-direction: column;
                    width: 100%;
                    gap: 8px;
                }
                
                .edit-text-field, .add-text-field {
                    width: 100%;
                }
                
                .text-input {
                    width: 100%;
                    box-sizing: border-box;
                }
                
                .edit-controls, .add-controls {
                    display: flex;
                    gap: 8px;
                    align-items: center;
                    flex-wrap: wrap;
                }
                
                .expiry-field {
                    display: flex;
                    align-items: center;
                    position: relative;
                }
                
                .expiry-input {
                    width: 60px;
                    text-align: center;
                }
                
                .tooltip-container {
                    position: relative;
                    display: inline-block;
                    margin-left: 5px;
                }
                
                .info-icon {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    width: 16px;
                    height: 16px;
                    border-radius: 50%;
                    background-color: #ccc;
                    color: white;
                    font-size: 12px;
                    font-style: italic;
                    cursor: help;
                }
                
                .tooltip-text {
                    visibility: hidden;
                    width: 120px;
                    background-color: #555;
                    color: #fff;
                    text-align: center;
                    border-radius: 6px;
                    padding: 5px;
                    position: absolute;
                    z-index: 1;
                    bottom: 125%;
                    left: 50%;
                    margin-left: -60px;
                    opacity: 0;
                    transition: opacity 0.3s;
                    font-size: 12px;
                }
                
                .tooltip-text::after {
                    content: "";
                    position: absolute;
                    top: 100%;
                    left: 50%;
                    margin-left: -5px;
                    border-width: 5px;
                    border-style: solid;
                    border-color: #555 transparent transparent transparent;
                }
                
                .tooltip-container:hover .tooltip-text {
                    visibility: visible;
                    opacity: 1;
                }
                
                .topic-text {
                    flex: 1;
                }
                
                .topic-expiry {
                    margin: 0 16px;
                    color: #666;
                }

                .glip-indicator {
                    color: #4CAF50;
                    font-weight: bold;
                    font-size: 0.9em;
                }

                .mention-indicator {
                    color: #f44336;
                    font-weight: bold;
                }
                
                button {
                    margin: 0 4px;
                    padding: 4px 8px;
                    cursor: pointer;
                }
                
                input {
                    padding: 4px 8px;
                }
                
                .add-topic-form {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    margin-top: 16px;
                    width: 100%;
                }

                .checkbox-container {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                }

                .import-export-buttons {
                    margin-top: 16px;
                    display: flex;
                    gap: 8px;
                }

                .import-button {
                    display: inline-block;
                    padding: 4px 8px;
                    background-color: #f1f1f1;
                    border: 1px solid #ccc;
                    border-radius: 4px;
                    cursor: pointer;
                }

                .import-button:hover {
                    background-color: #e8e8e8;
                }

                /* 通用匹配条件样式 */
                .filter-conditions {
                    margin-top: 12px;
                    padding: 10px 12px;
                    background-color: #f5f5f5;
                    border: 1px solid #e0e0e0;
                    border-radius: 6px;
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }

                .filter-item {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .filter-item label {
                    font-size: 13px;
                    color: #555;
                    min-width: 80px;
                    white-space: nowrap;
                }

                .filter-item input[type="text"] {
                    flex: 1;
                    padding: 6px 10px;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    font-size: 13px;
                }

                .filter-item input[type="text"]:focus {
                    border-color: #4CAF50;
                    outline: none;
                }

                /* 自动答复配置样式 */
                .auto-reply-config {
                    margin-top: 12px;
                    padding: 12px;
                    background-color: #f9f9f9;
                    border: 1px solid #e0e0e0;
                    border-radius: 6px;
                }

                .follow-thread-config {
                    margin-top: 12px;
                    padding: 12px;
                    background-color: #faf5ff;
                    border: 1px solid #e1bee7;
                    border-radius: 6px;
                }

                .original-message-preview {
                    padding: 10px;
                    background-color: white;
                    border: 1px solid #e1bee7;
                    border-radius: 4px;
                    font-size: 12px;
                }

                .message-meta {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 8px;
                    padding-bottom: 6px;
                    border-bottom: 1px solid #f0f0f0;
                }

                .message-meta .sender {
                    font-weight: 600;
                    color: #9c27b0;
                }

                .message-meta .datetime {
                    color: #666;
                    font-size: 11px;
                }

                .message-content {
                    color: #333;
                    line-height: 1.4;
                    margin-bottom: 8px;
                    max-height: 80px;
                    overflow-y: auto;
                    white-space: pre-wrap;
                    word-wrap: break-word;
                }

                .message-link {
                    color: #9c27b0;
                    text-decoration: none;
                    font-size: 11px;
                }

                .message-link:hover {
                    text-decoration: underline;
                }

                .keyword-filter-input {
                    width: 100%;
                    box-sizing: border-box;
                    padding: 6px;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    font-family: inherit;
                    font-size: 12px;
                }

                .hint-text {
                    margin-top: 4px;
                    font-size: 11px;
                    color: #666;
                    font-style: italic;
                }

                .config-section {
                    margin-bottom: 12px;
                }

                .config-section:last-child {
                    margin-bottom: 0;
                }

                .config-title {
                    font-weight: 500;
                    margin-bottom: 6px;
                    color: #333;
                    font-size: 13px;
                }

                .config-options {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 12px;
                }

                .reply-content-input {
                    width: 100%;
                    box-sizing: border-box;
                    padding: 8px;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    font-family: inherit;
                    font-size: 13px;
                    resize: vertical;
                }

                .reply-options {
                    margin-top: 8px;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }

                .ai-generate-btn {
                    padding: 4px 12px;
                    background-color: #4CAF50;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 12px;
                }

                .ai-generate-btn:hover {
                    background-color: #45a049;
                }

                .ai-generate-btn:disabled {
                    background-color: #ccc;
                    cursor: not-allowed;
                }

                .radio-group {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }

                .radio-option {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }

                .radio-option input[type="radio"] {
                    margin: 0;
                }

                .delay-hours-input {
                    width: 50px;
                    text-align: center;
                    margin: 0 4px;
                    padding: 2px 4px;
                }

                .form-buttons {
                    margin-top: 12px;
                    display: flex;
                    gap: 8px;
                }

                .auto-reply-indicator {
                    color: #2196F3;
                    font-weight: bold;
                    font-size: 0.9em;
                    margin-left: 8px;
                }

                .follow-thread-indicator {
                    color: #9c27b0;
                    font-weight: bold;
                    font-size: 0.9em;
                    margin-left: 8px;
                }

                .triggered-by-info {
                    font-size: 11px;
                    color: #666;
                    margin-top: 4px;
                    padding: 4px 8px;
                    background-color: #f5f5f5;
                    border-radius: 4px;
                }

                /* 每日摘要配置样式 */
                .digest-config {
                    margin-top: 12px;
                    padding: 12px;
                    background-color: #f0f7ff;
                    border: 1px solid #b3d4fc;
                    border-radius: 6px;
                }

                .digest-options {
                    margin-top: 8px;
                }

                .digest-indicator {
                    color: #1976d2;
                    font-weight: bold;
                    font-size: 0.9em;
                    margin-left: 8px;
                }

                .radio-group.horizontal {
                    flex-direction: row;
                    flex-wrap: wrap;
                    gap: 16px;
                }
            `}</style>
        </div>
    );
};

ReactDOM.render(
    <TopicModal />,
    document.getElementById('topic-modal-root')
); 