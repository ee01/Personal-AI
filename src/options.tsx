import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { useState, useEffect } from 'react';
import {
    BotPushTargetMode,
    defaultEnvConfig,
    EnvConfigType,
    getDefaultEnvConfig,
    normalizeBotPushTarget,
} from './utils';
import { agentCoordinator } from './agentWorkflow';
import { IntelligentAgent } from './agentThinking';
import { AgentVisualizer, AgentFlowVisualizer, AgentResultSummary } from './agent-visualizer';

type PushTargetField =
    | 'MESSAGE_ANALYSIS_PUSH_TARGET'
    | 'FOLLOW_UP_PUSH_TARGET'
    | 'DREAM_INSIGHT_PUSH_TARGET'
    | 'WEEKLY_REPORT_PUSH_TARGET'
    | 'DECISION_CENTER_PUSH_TARGET';

type PushGroupField =
    | 'MESSAGE_ANALYSIS_PUSH_GROUP_ID'
    | 'FOLLOW_UP_PUSH_GROUP_ID'
    | 'DREAM_INSIGHT_PUSH_GROUP_ID'
    | 'WEEKLY_REPORT_PUSH_GROUP_ID'
    | 'DECISION_CENTER_PUSH_GROUP_ID';

const PUSH_TARGET_RULES: Array<{
    targetKey: PushTargetField;
    groupKey: PushGroupField;
    label: string;
    allowNone?: boolean;
}> = [
    { targetKey: 'MESSAGE_ANALYSIS_PUSH_TARGET', groupKey: 'MESSAGE_ANALYSIS_PUSH_GROUP_ID', label: '消息分析推送' },
    { targetKey: 'FOLLOW_UP_PUSH_TARGET', groupKey: 'FOLLOW_UP_PUSH_GROUP_ID', label: '关注后续推送' },
    { targetKey: 'DREAM_INSIGHT_PUSH_TARGET', groupKey: 'DREAM_INSIGHT_PUSH_GROUP_ID', label: '梦境重放报表推送', allowNone: true },
    { targetKey: 'WEEKLY_REPORT_PUSH_TARGET', groupKey: 'WEEKLY_REPORT_PUSH_GROUP_ID', label: '周报推送', allowNone: true },
    { targetKey: 'DECISION_CENTER_PUSH_TARGET', groupKey: 'DECISION_CENTER_PUSH_GROUP_ID', label: '决策中心推送' },
];

// 使用从utils.ts导入的类型
const Options = () => {
    const [config, setConfig] = useState<EnvConfigType>({...defaultEnvConfig});
    const [status, setStatus] = useState<{message: string, type: 'success' | 'error' | ''}>({
        message: '',
        type: ''
    });
    const [isDreamDigestPushing, setIsDreamDigestPushing] = useState(false);
    const [isWeeklyReportPushing, setIsWeeklyReportPushing] = useState(false);

    // Weekly Report backend state (synced with memory-service)
    const [weeklyReportCron, setWeeklyReportCron] = useState<string>('0 18 * * 5');
    const [weeklyReportMinMessages, setWeeklyReportMinMessages] = useState<number>(20);
    const [weeklyReportSaving, setWeeklyReportSaving] = useState(false);

    const resolvePushTargetValue = (
        target: string | undefined,
        fallback: BotPushTargetMode = 'me',
        allowNone = false,
        enabled?: boolean
    ): BotPushTargetMode => {
        const normalizedFallback = allowNone && enabled === false ? 'none' : fallback;
        return normalizeBotPushTarget(target, allowNone, normalizedFallback);
    };

    const validatePushTargets = (targetConfig: EnvConfigType, targetKeys?: PushTargetField[]): string | null => {
        const rules = targetKeys
            ? PUSH_TARGET_RULES.filter(rule => targetKeys.includes(rule.targetKey))
            : PUSH_TARGET_RULES;

        for (const rule of rules) {
            const mode = resolvePushTargetValue(
                String(targetConfig[rule.targetKey] || ''),
                'me',
                rule.allowNone
            );
            if (mode === 'group' && !String(targetConfig[rule.groupKey] || '').trim()) {
                return `${rule.label} 已选择自定义群组，请填写群组 ID`;
            }
        }
        return null;
    };

    // Load weekly report settings from backend
    const loadWeeklyReportSettingsFromBackend = async (targetConfig: EnvConfigType) => {
        try {
            if (!targetConfig.MEMORY_SERVICE_BASE_URL) return;
            const headers = await getRequestHeaders(targetConfig);
            const res = await fetch(`${targetConfig.MEMORY_SERVICE_BASE_URL}/config`, { headers });
            if (res.ok) {
                const data = await res.json();
                if (data.weeklyReportCron) {
                    setWeeklyReportCron(data.weeklyReportCron);
                }
                if (data.weeklyReportMinMessages !== undefined) {
                    setWeeklyReportMinMessages(Number(data.weeklyReportMinMessages));
                }
                setConfig(prev => ({
                    ...prev,
                    WEEKLY_REPORT_CRON: data.weeklyReportCron || prev.WEEKLY_REPORT_CRON,
                    WEEKLY_REPORT_MIN_MESSAGES: data.weeklyReportMinMessages !== undefined
                        ? Number(data.weeklyReportMinMessages)
                        : prev.WEEKLY_REPORT_MIN_MESSAGES,
                    WEEKLY_REPORT_PUSH_TARGET: resolvePushTargetValue(
                        data.weeklyReportPushTarget,
                        prev.WEEKLY_REPORT_PUSH_TARGET || 'me',
                        true,
                        data.weeklyReportEnabled
                    ),
                    WEEKLY_REPORT_PUSH_GROUP_ID: data.weeklyReportPushGroupId || prev.WEEKLY_REPORT_PUSH_GROUP_ID || '',
                }));
            }
        } catch (err) {
            console.warn('Failed to load weekly report settings from backend:', err);
        }
    };

    // Save weekly report settings to backend
    const saveWeeklyReportSettings = async () => {
        const pushTarget = resolvePushTargetValue(config.WEEKLY_REPORT_PUSH_TARGET, 'me', true);
        const validationError = validatePushTargets(config, ['WEEKLY_REPORT_PUSH_TARGET']);
        if (validationError) {
            setStatus({ message: validationError, type: 'error' });
            return;
        }
        setWeeklyReportSaving(true);
        try {
            await chrome.storage.local.set({ envConfig: config });
            await chrome.runtime.sendMessage({
                type: 'UPDATE_ENV_CONFIG',
                config
            });

            const headers = await getRequestHeaders(config);
            const res = await fetch(`${config.MEMORY_SERVICE_BASE_URL}/config`, {
                method: 'PUT',
                headers,
                body: JSON.stringify({
                    weeklyReportEnabled: pushTarget !== 'none',
                    weeklyReportCron,
                    weeklyReportMinMessages,
                    weeklyReportPushTarget: pushTarget,
                    weeklyReportPushGroupId: (config.WEEKLY_REPORT_PUSH_GROUP_ID || '').trim() || undefined,
                }),
            });
            if (res.ok) {
                setStatus({ message: '周报设置已保存到后端', type: 'success' });
            } else {
                setStatus({ message: '保存周报设置失败: ' + res.statusText, type: 'error' });
            }
        } catch (err) {
            console.error('Save weekly report settings failed:', err);
            setStatus({ message: '保存周报设置失败', type: 'error' });
        } finally {
            setWeeklyReportSaving(false);
            setTimeout(() => setStatus({ message: '', type: '' }), 3000);
        }
    };

    // 页面加载时从 Chrome 存储中获取配置
    useEffect(() => {
        chrome.storage.local.get(['envConfig'], (result) => {
            console.log('result', result);
            if (result.envConfig) {
                const merged = { ...defaultEnvConfig, ...result.envConfig };
                setConfig(merged);
                setWeeklyReportCron(merged.WEEKLY_REPORT_CRON || '0 18 * * 5');
                setWeeklyReportMinMessages(Number(merged.WEEKLY_REPORT_MIN_MESSAGES) || 20);
                loadDreamDigestSettingsFromBackend(merged);
            } else {
                // 如果没有保存过配置，则尝试从 .env 加载
                loadEnvDefaults();
            }
        });
    }, []);

    // Load weekly report settings from backend when config is ready
    useEffect(() => {
        if (config.MEMORY_SERVICE_BASE_URL) {
            loadWeeklyReportSettingsFromBackend(config);
        }
    }, [config.MEMORY_SERVICE_BASE_URL, config.MEMORY_SERVICE_API_KEY]);

    // 从.env加载默认值（通过background脚本）
    const loadEnvDefaults = async () => {
        try {
            const config = getDefaultEnvConfig();
            setConfig(config);
            setWeeklyReportCron(config.WEEKLY_REPORT_CRON || '0 18 * * 5');
            setWeeklyReportMinMessages(Number(config.WEEKLY_REPORT_MIN_MESSAGES) || 20);
            await loadDreamDigestSettingsFromBackend(config);
            setStatus({
                message: '已从.env文件加载默认配置',
                type: 'success'
            });
        } catch (error) {
            console.error('加载环境配置失败:', error);
            setStatus({
                message: '加载环境配置失败',
                type: 'error'
            });
        }
    };

    const getRequestHeaders = async (targetConfig: EnvConfigType): Promise<Record<string, string>> => {
        const result = await chrome.storage.local.get(['userinfo']);
        const username = result?.userinfo?.username?.trim();
        const userId = username || 'default';
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-User-Id': userId,
        };
        if (targetConfig.MEMORY_SERVICE_API_KEY) {
            headers['Authorization'] = `Bearer ${targetConfig.MEMORY_SERVICE_API_KEY}`;
        }
        return headers;
    };

    const loadDreamDigestSettingsFromBackend = async (targetConfig: EnvConfigType) => {
        if (!targetConfig.MEMORY_SERVICE_BASE_URL) return;
        try {
            const headers = await getRequestHeaders(targetConfig);
            const response = await fetch(`${targetConfig.MEMORY_SERVICE_BASE_URL}/config`, {
                method: 'GET',
                headers,
            });
            if (!response.ok) return;
            const serverConfig = await response.json();
            const scheduleType = serverConfig?.dreamDigestScheduleType;
            const intervalDays = Number(serverConfig?.dreamDigestIntervalDays) || (Number(serverConfig?.dreamDigestIntervalWeeks) || 0) * 7;
            const resolvedScheduleType = scheduleType === 'every_x_weeks' ? 'every_x_days' : scheduleType;
            setConfig(prev => ({
                ...prev,
                DREAM_DIGEST_SCHEDULE_TYPE:
                    resolvedScheduleType === 'every_x_days' || resolvedScheduleType === 'monthly'
                        ? resolvedScheduleType
                        : (prev.DREAM_DIGEST_SCHEDULE_TYPE || 'every_x_days'),
                DREAM_DIGEST_INTERVAL_DAYS: Number.isFinite(intervalDays)
                    ? Math.max(1, Math.floor(intervalDays))
                    : (prev.DREAM_DIGEST_INTERVAL_DAYS || 1),
                DREAM_INSIGHT_PUSH_TARGET: resolvePushTargetValue(
                    serverConfig?.dreamDigestPushTarget,
                    prev.DREAM_INSIGHT_PUSH_TARGET || 'me',
                    true,
                    serverConfig?.dreamDigestEnabled
                ),
                DREAM_INSIGHT_PUSH_GROUP_ID: serverConfig?.dreamDigestPushGroupId || prev.DREAM_INSIGHT_PUSH_GROUP_ID || '',
                SELF_REFLECTION_ENABLED: serverConfig?.reflectionEnabled !== undefined
                    ? Boolean(serverConfig.reflectionEnabled)
                    : prev.SELF_REFLECTION_ENABLED,
                SELF_REFLECTION_HEARTBEAT_MINUTES: Number.isFinite(Number(serverConfig?.reflectionHeartbeatMinutes))
                    ? Math.max(1, Math.floor(Number(serverConfig.reflectionHeartbeatMinutes)))
                    : (prev.SELF_REFLECTION_HEARTBEAT_MINUTES || 15),
                DECISION_CENTER_PUSH_TARGET: resolvePushTargetValue(
                    serverConfig?.decisionCenterPushTarget,
                    prev.DECISION_CENTER_PUSH_TARGET || 'me',
                    false
                ),
                DECISION_CENTER_PUSH_GROUP_ID: serverConfig?.decisionCenterPushGroupId || prev.DECISION_CENTER_PUSH_GROUP_ID || '',
            }));
        } catch (error) {
            console.warn('加载梦境重放报表配置失败:', error);
        }
    };

    // 保存配置到 Chrome 存储
    const saveConfig = async () => {
        try {
            // 验证配置：检查是否会导致消息遗漏
            if (config.MESSAGE_CONTEXT_WINDOW < config.MESSAGE_ANALYSIS_INTERVAL) {
                const confirmed = window.confirm(
                    `⚠️ 警告：当前配置可能导致消息遗漏！\n\n` +
                    `消息上下文窗口（${config.MESSAGE_CONTEXT_WINDOW}分钟）小于分析频度（${config.MESSAGE_ANALYSIS_INTERVAL}分钟）\n\n` +
                    `建议：将上下文窗口设置为至少 ${config.MESSAGE_ANALYSIS_INTERVAL} 分钟或更大。\n\n` +
                    `是否仍要保存此配置？`
                );
                
                if (!confirmed) {
                    setStatus({
                        message: '已取消保存',
                        type: 'error'
                    });
                    setTimeout(() => {
                        setStatus({message: '', type: ''});
                    }, 3000);
                    return;
                }
            }

            if (
                config.DREAM_DIGEST_SCHEDULE_TYPE === 'every_x_days' &&
                (Number(config.DREAM_DIGEST_INTERVAL_DAYS) < 1 || Number.isNaN(Number(config.DREAM_DIGEST_INTERVAL_DAYS)))
            ) {
                setStatus({
                    message: '梦境重放报表间隔天数必须 >= 1',
                    type: 'error'
                });
                return;
            }

            if (Number(config.SELF_REFLECTION_HEARTBEAT_MINUTES) < 1 || Number.isNaN(Number(config.SELF_REFLECTION_HEARTBEAT_MINUTES))) {
                setStatus({
                    message: '自我反思频率必须 >= 1 分钟',
                    type: 'error'
                });
                return;
            }

            const pushTargetValidationError = validatePushTargets(config);
            if (pushTargetValidationError) {
                setStatus({
                    message: pushTargetValidationError,
                    type: 'error'
                });
                return;
            }
            
            await chrome.storage.local.set({ envConfig: config });
            // 通知background脚本更新配置
            await chrome.runtime.sendMessage({
                type: 'UPDATE_ENV_CONFIG',
                config
            });

            // 同步梦境重放报表计划到 memory-service 运行时配置
            const headers = await getRequestHeaders(config);
            const dreamInsightPushTarget = resolvePushTargetValue(config.DREAM_INSIGHT_PUSH_TARGET, 'me', true);
            const syncResponse = await fetch(`${config.MEMORY_SERVICE_BASE_URL}/config`, {
                method: 'PUT',
                headers,
                body: JSON.stringify({
                    dreamDigestScheduleType: config.DREAM_DIGEST_SCHEDULE_TYPE || 'every_x_days',
                    dreamDigestIntervalDays: Math.max(1, Number(config.DREAM_DIGEST_INTERVAL_DAYS) || 1),
                    dreamDigestEnabled: dreamInsightPushTarget !== 'none',
                    dreamDigestPushTarget: dreamInsightPushTarget,
                    dreamDigestPushGroupId: (config.DREAM_INSIGHT_PUSH_GROUP_ID || '').trim() || undefined,
                    reflectionEnabled: config.SELF_REFLECTION_ENABLED !== false,
                    reflectionHeartbeatMinutes: Math.max(1, Number(config.SELF_REFLECTION_HEARTBEAT_MINUTES) || 15),
                    decisionCenterPushTarget: resolvePushTargetValue(config.DECISION_CENTER_PUSH_TARGET, 'me', false),
                    decisionCenterPushGroupId: (config.DECISION_CENTER_PUSH_GROUP_ID || '').trim() || undefined,
                    weeklyReportEnabled: resolvePushTargetValue(config.WEEKLY_REPORT_PUSH_TARGET, 'me', true) !== 'none',
                    weeklyReportCron,
                    weeklyReportMinMessages,
                    weeklyReportPushTarget: resolvePushTargetValue(config.WEEKLY_REPORT_PUSH_TARGET, 'me', true),
                    weeklyReportPushGroupId: (config.WEEKLY_REPORT_PUSH_GROUP_ID || '').trim() || undefined,
                }),
            });
            if (!syncResponse.ok) {
                const errorText = await syncResponse.text();
                throw new Error(`同步梦境重放报表配置失败: ${syncResponse.status} ${errorText}`);
            }

            setStatus({
                message: '配置已保存',
                type: 'success'
            });
            // 3秒后清除状态消息
            setTimeout(() => {
                setStatus({message: '', type: ''});
            }, 3000);
        } catch (error) {
            console.error('保存配置失败:', error);
            setStatus({
                message: '保存配置失败',
                type: 'error'
            });
        }
    };

    const handlePushDreamDigestNow = async () => {
        const validationError = validatePushTargets(config, ['DREAM_INSIGHT_PUSH_TARGET']);
        if (validationError) {
            setStatus({ message: validationError, type: 'error' });
            return;
        }
        setIsDreamDigestPushing(true);
        try {
            const headers = await getRequestHeaders(config);
            const dreamInsightPushTarget = resolvePushTargetValue(config.DREAM_INSIGHT_PUSH_TARGET, 'me', true);
            const response = await fetch(`${config.MEMORY_SERVICE_BASE_URL}/dream-digest/push-now`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    force: true,
                    dreamDigestPushTarget: dreamInsightPushTarget,
                    dreamDigestPushGroupId: (config.DREAM_INSIGHT_PUSH_GROUP_ID || '').trim() || undefined,
                }),
            });
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result?.error || '推送失败');
            }
            if (result?.generated) {
                setStatus({
                    message: dreamInsightPushTarget === 'none'
                        ? '梦境重放报表已立即生成（当前配置为不推送）'
                        : result?.botSent
                        ? '梦境重放报表已立即推送（Chrome + Bot）'
                        : '梦境重放报表已立即推送（Chrome 通知已写入）',
                    type: 'success',
                });
            } else {
                setStatus({
                    message: result?.reason || '未生成简报（可能暂无 dreams 内容）',
                    type: 'error',
                });
            }
        } catch (error) {
            console.error('立即推送梦境重放报表失败:', error);
            setStatus({
                message: `立即推送失败: ${(error as Error).message}`,
                type: 'error',
            });
        } finally {
            setIsDreamDigestPushing(false);
        }
    };

    const handlePushWeeklyReportNow = async () => {
        const validationError = validatePushTargets(config, ['WEEKLY_REPORT_PUSH_TARGET']);
        if (validationError) {
            setStatus({ message: validationError, type: 'error' });
            return;
        }
        setIsWeeklyReportPushing(true);
        try {
            const headers = await getRequestHeaders(config);
            const weeklyReportPushTarget = resolvePushTargetValue(config.WEEKLY_REPORT_PUSH_TARGET, 'me', true);
            const response = await fetch(`${config.MEMORY_SERVICE_BASE_URL}/weekly-report/push-now`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    force: true,
                    weeklyReportPushTarget,
                    weeklyReportPushGroupId: (config.WEEKLY_REPORT_PUSH_GROUP_ID || '').trim() || undefined,
                }),
            });
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result?.error || '推送失败');
            }
            if (result?.generated) {
                setStatus({
                    message: weeklyReportPushTarget === 'none'
                        ? '周报已立即生成（当前配置为不推送）'
                        : result?.botSent
                        ? '周报已立即推送（Chrome + Bot）'
                        : '周报已立即生成（Chrome 通知已写入）',
                    type: 'success',
                });
            } else {
                setStatus({
                    message: result?.reason || '未生成周报',
                    type: 'error',
                });
            }
        } catch (error) {
            console.error('立即推送周报失败:', error);
            setStatus({
                message: `立即推送周报失败: ${(error as Error).message}`,
                type: 'error',
            });
        } finally {
            setIsWeeklyReportPushing(false);
        }
    };

    // 重置配置为默认值
    const resetConfig = () => {
        setConfig({...defaultEnvConfig});
        setWeeklyReportCron(defaultEnvConfig.WEEKLY_REPORT_CRON || '0 18 * * 5');
        setWeeklyReportMinMessages(Number(defaultEnvConfig.WEEKLY_REPORT_MIN_MESSAGES) || 20);
        setStatus({
            message: '配置已重置为默认值',
            type: 'success'
        });
    };

    // 处理输入变化
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        
        setConfig(prev => ({
            ...prev,
            [name]: type === 'checkbox' 
                ? (e.target as HTMLInputElement).checked 
                : name === 'SCHEDULED_INTERVAL' ||
                  name === 'MESSAGE_ANALYSIS_INTERVAL' ||
                  name === 'MESSAGE_CONTEXT_WINDOW' ||
                  name === 'MEMORY_SERVICE_TIMEOUT' ||
                  name === 'DREAM_DIGEST_INTERVAL_DAYS' ||
                  name === 'SELF_REFLECTION_HEARTBEAT_MINUTES'
                    ? Number(value)
                    : value
        }));
    };

    // 处理导入配置
    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const importedConfig = JSON.parse(event.target?.result as string);
                setConfig({ ...defaultEnvConfig, ...importedConfig });
                setWeeklyReportCron(importedConfig.WEEKLY_REPORT_CRON || defaultEnvConfig.WEEKLY_REPORT_CRON || '0 18 * * 5');
                setWeeklyReportMinMessages(Number(importedConfig.WEEKLY_REPORT_MIN_MESSAGES) || Number(defaultEnvConfig.WEEKLY_REPORT_MIN_MESSAGES) || 20);
                setStatus({
                    message: '配置已导入',
                    type: 'success'
                });
            } catch (error) {
                console.error('导入配置失败:', error);
                setStatus({
                    message: '导入配置失败，文件格式错误',
                    type: 'error'
                });
            }
        };
        reader.readAsText(file);
    };

    // 处理导出配置
    const handleExport = () => {
        const configJson = JSON.stringify(config, null, 2);
        const blob = new Blob([configJson], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = 'personal-ai-config.json';
        a.click();
        
        URL.revokeObjectURL(url);
    };

    const renderPushTargetFields = (
        label: string,
        targetKey: PushTargetField,
        groupKey: PushGroupField,
        allowNone = false,
        description?: string
    ) => {
        const targetValue = resolvePushTargetValue(
            String(config[targetKey] || ''),
            'me',
            allowNone
        );

        return (
            <>
                <div className="form-group">
                    <label htmlFor={targetKey}>{label}</label>
                    <select
                        id={targetKey}
                        name={targetKey}
                        value={targetValue}
                        onChange={handleInputChange}
                    >
                        {allowNone && <option value="none">不推送</option>}
                        <option value="me">推送给 Me（user）</option>
                        <option value="group">自定义群组</option>
                    </select>
                    {description && (
                        <small style={{ color: '#666', display: 'block', marginTop: '5px' }}>
                            {description}
                        </small>
                    )}
                </div>
                {targetValue === 'group' && (
                    <div className="form-group">
                        <label htmlFor={groupKey}>{label}群组 ID</label>
                        <input
                            type="text"
                            id={groupKey}
                            name={groupKey}
                            value={String(config[groupKey] || '')}
                            onChange={handleInputChange}
                            placeholder="输入 RingCentral 群组 ID"
                        />
                        <small style={{ color: '#666', display: 'block', marginTop: '5px' }}>
                            仅在选择「自定义群组」时生效。
                        </small>
                    </div>
                )}
            </>
        );
    };

    return (
        <div>
            <div className="form-section">
                <h2>功能 Demo</h2>
                <div className="quick-access-buttons" style={{ 
                    display: 'flex', 
                    gap: '10px', 
                    flexWrap: 'wrap',
                    marginBottom: '15px' 
                }}>
                    <button 
                        onClick={() => window.open('http://eexx.me/Personal-AI/demo/%E5%AE%9E%E4%BD%93%E8%AE%B0%E5%BF%86%E6%9F%A5%E8%AF%A2%E7%95%8C%E9%9D%A2.html', '_blank')}
                        style={{ 
                            backgroundColor: '#667eea', 
                            color: 'white',
                            padding: '10px 20px',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: 'bold'
                        }}
                    >
                        🧠 实体记忆查询
                    </button>
                    <button 
                        onClick={() => window.open('http://eexx.me/Personal-AI/demo/项目进展图-缩放版.html', '_blank')}
                        style={{ 
                            backgroundColor: '#2ecc71', 
                            color: 'white',
                            padding: '10px 20px',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: 'bold'
                        }}
                    >
                        📊 项目进展图
                    </button>
                </div>
            </div>

            <div className="form-section">
                <h2>常规设置</h2>
                <div className="form-group">
                    <label htmlFor="MESSAGE_ANALYSIS_INTERVAL">
                        消息分析频度（分钟）
                    </label>
                    <input
                        type="number"
                        id="MESSAGE_ANALYSIS_INTERVAL"
                        name="MESSAGE_ANALYSIS_INTERVAL"
                        value={config.MESSAGE_ANALYSIS_INTERVAL}
                        onChange={(e) => {
                            const numValue = Number(e.target.value);
                            setConfig(prev => ({
                                ...prev,
                                MESSAGE_ANALYSIS_INTERVAL: numValue
                            }));
                            
                            // 检查是否会导致消息遗漏
                            if (numValue > config.MESSAGE_CONTEXT_WINDOW) {
                                setStatus({
                                    message: '⚠️ 警告：消息上下文窗口小于分析频度，可能会遗漏消息！建议将上下文窗口设置为大于等于分析频度。',
                                    type: 'error'
                                });
                                setTimeout(() => {
                                    setStatus({message: '', type: ''});
                                }, 8000);
                            }
                        }}
                        min="1"
                    />
                    <small style={{ color: '#666', display: 'block', marginTop: '5px' }}>
                        每隔多久执行一次消息分析（默认: 120分钟）
                    </small>
                </div>
                
                <div className="form-group">
                    <label htmlFor="MESSAGE_CONTEXT_WINDOW">
                        消息上下文窗口（分钟）
                    </label>
                    <input
                        type="number"
                        id="MESSAGE_CONTEXT_WINDOW"
                        name="MESSAGE_CONTEXT_WINDOW"
                        value={config.MESSAGE_CONTEXT_WINDOW}
                        onChange={(e) => {
                            const numValue = Number(e.target.value);
                            setConfig(prev => ({
                                ...prev,
                                MESSAGE_CONTEXT_WINDOW: numValue
                            }));
                            
                            // 检查是否会导致消息遗漏
                            if (numValue < config.MESSAGE_ANALYSIS_INTERVAL) {
                                setStatus({
                                    message: '⚠️ 警告：消息上下文窗口小于分析频度，可能会遗漏消息！建议将上下文窗口设置为大于等于分析频度。',
                                    type: 'error'
                                });
                                setTimeout(() => {
                                    setStatus({message: '', type: ''});
                                }, 8000);
                            }
                        }}
                        min="1"
                    />
                    <small style={{ color: '#666', display: 'block', marginTop: '5px' }}>
                        每次分析时获取距离此刻的历史消息时间范围（默认: 125分钟）
                    </small>
                    {config.MESSAGE_CONTEXT_WINDOW < config.MESSAGE_ANALYSIS_INTERVAL && (
                        <small style={{ color: '#d32f2f', display: 'block', marginTop: '5px', fontWeight: 'bold' }}>
                            ⚠️ 当前设置可能导致消息遗漏！上下文窗口（{config.MESSAGE_CONTEXT_WINDOW}分钟）小于分析频度（{config.MESSAGE_ANALYSIS_INTERVAL}分钟）
                        </small>
                    )}
                </div>
                
                <div className="form-group">
                    <label htmlFor="ANALYSIS_TYPE">分析系统类型</label>
                    <select
                        id="ANALYSIS_TYPE"
                        name="ANALYSIS_TYPE"
                        value={config.ANALYSIS_TYPE}
                        onChange={handleInputChange}
                    >
                        <option value="filter">根据关注列表直接过滤</option>
                        <option value="agentWorkflow">标准Agent工作流（按流程分析消息中的实体、关系，自动判断消息重要性）</option>
                        <option value="agentThinking">智能Agent思考（具有独立思考能力，按需调用工具分析消息）</option>
                    </select>
                </div>

                <div className="form-group">
                    <label>
                        <input
                            type="checkbox"
                            name="ANALYZE_BY_GROUP"
                            checked={config.ANALYZE_BY_GROUP}
                            onChange={handleInputChange}
                        />
                        拆开每个群组独立分析
                    </label>
                </div>

                <div className="form-group">
                    <label>
                        <input
                            type="checkbox"
                            name="LLM_REVIEW_BEFORE_SEND"
                            hidden={config.ANALYSIS_TYPE === 'agentThinking' || config.ANALYSIS_TYPE === 'agentWorkflow'}
                            checked={config.LLM_REVIEW_BEFORE_SEND}
                            onChange={handleInputChange}
                        />
                        启用消息审核（若不启用审核，会推送所有关注消息）
                    </label>
                </div>
            </div>

            <div className="form-section">
                <h2>Bot 推送设置</h2>
                <small style={{ color: '#666', display: 'block', marginBottom: '15px' }}>
                    Bot Key 和 Base URL 从 env 读取，这里只配置各场景推送到 Me（user）还是自定义群组。
                </small>
                {renderPushTargetFields(
                    '消息分析推送',
                    'MESSAGE_ANALYSIS_PUSH_TARGET',
                    'MESSAGE_ANALYSIS_PUSH_GROUP_ID',
                    false,
                    '命中关注项后的即时提醒。默认推送给 Me。'
                )}
                {renderPushTargetFields(
                    '关注后续推送',
                    'FOLLOW_UP_PUSH_TARGET',
                    'FOLLOW_UP_PUSH_GROUP_ID',
                    false,
                    '与消息分析拆开配置，关注后续汇总和相关提醒走这一套。'
                )}
                {renderPushTargetFields(
                    '决策中心推送',
                    'DECISION_CENTER_PUSH_TARGET',
                    'DECISION_CENTER_PUSH_GROUP_ID',
                    false,
                    '用于冲突/待确认类的决策中心提醒。默认推送给 Me。'
                )}
            </div>

            <div className="form-section">
                <h2>消息过滤设置</h2>
                <div className="form-group">
                    <label>
                        <input
                            type="checkbox"
                            name="FILTER_OWN_MESSAGES"
                            checked={config.FILTER_OWN_MESSAGES}
                            onChange={handleInputChange}
                        />
                        过滤自己发送的消息（消息分析时会自动忽略自己发送的消息）
                    </label>
                </div>
            </div>

            <div className="form-section">
                <h2>消息交互功能</h2>
                <p style={{ color: '#666', fontSize: '13px', marginBottom: '15px' }}>
                    在 RingCentral 消息页面，悬停在消息上时会显示交互工具栏。可以选择启用/禁用以下功能：
                </p>
                <div className="form-group">
                    <label>
                        <input
                            type="checkbox"
                            name="ENABLE_SNOOZE"
                            checked={config.ENABLE_SNOOZE}
                            onChange={handleInputChange}
                        />
                        启用「稍后处理」功能（设置提醒时间，到时 Bot 会推送消息提醒您）
                    </label>
                </div>
                <div className="form-group">
                    <label>
                        <input
                            type="checkbox"
                            name="ENABLE_AUTO_REPLY"
                            checked={config.ENABLE_AUTO_REPLY}
                            onChange={handleInputChange}
                        />
                        启用「自动答复」功能（配置自动答复规则，匹配消息时自动发送回复）
                    </label>
                </div>
            </div>

            <div className="form-section">
                <h2>记忆系统 (Memory Service)</h2>
                <div className="form-group">
                    <label htmlFor="MEMORY_SERVICE_BASE_URL">记忆服务 API 地址</label>
                    <input
                        type="url"
                        id="MEMORY_SERVICE_BASE_URL"
                        name="MEMORY_SERVICE_BASE_URL"
                        value={config.MEMORY_SERVICE_BASE_URL}
                        onChange={handleInputChange}
                        placeholder="http://localhost:3210/api/v1"
                    />
                    <small style={{ color: '#666', display: 'block', marginTop: '5px' }}>
                        记忆系统后端地址，需包含 /api/v1 路径。默认 localhost:3210
                    </small>
                </div>
                <div className="form-group">
                    <label htmlFor="MEMORY_SERVICE_API_KEY">API 密钥（可选）</label>
                    <input
                        type="password"
                        id="MEMORY_SERVICE_API_KEY"
                        name="MEMORY_SERVICE_API_KEY"
                        value={config.MEMORY_SERVICE_API_KEY || ''}
                        onChange={handleInputChange}
                        placeholder="后端配置 API_KEY 时填写"
                    />
                    <small style={{ color: '#666', display: 'block', marginTop: '5px' }}>
                        后端配置 API_KEY 时需填写相同密钥；本地开发通常留空
                    </small>
                </div>
                <div className="form-group">
                    <label htmlFor="MEMORY_SERVICE_TIMEOUT">请求超时（毫秒）</label>
                    <input
                        type="number"
                        id="MEMORY_SERVICE_TIMEOUT"
                        name="MEMORY_SERVICE_TIMEOUT"
                        value={config.MEMORY_SERVICE_TIMEOUT || 30000}
                        onChange={handleInputChange}
                        min="1000"
                        step="1000"
                    />
                    <small style={{ color: '#666', display: 'block', marginTop: '5px' }}>
                        对 ask 等长耗时接口建议 {'>='} 60000。保存后会写入扩展配置。
                    </small>
                </div>
                <div className="form-group">
                    <label>
                        <input
                            type="checkbox"
                            name="SELF_REFLECTION_ENABLED"
                            checked={config.SELF_REFLECTION_ENABLED !== false}
                            onChange={handleInputChange}
                        />
                        启用自我反思
                    </label>
                    <small style={{ color: '#666', display: 'block', marginTop: '5px' }}>
                        每个用户可以单独关闭自我反思；关闭后不会影响梦境重放的持续生成。
                    </small>
                </div>
                <div className="form-group">
                    <label htmlFor="SELF_REFLECTION_HEARTBEAT_MINUTES">自我反思频率（分钟）</label>
                    <input
                        type="number"
                        id="SELF_REFLECTION_HEARTBEAT_MINUTES"
                        name="SELF_REFLECTION_HEARTBEAT_MINUTES"
                        value={config.SELF_REFLECTION_HEARTBEAT_MINUTES || 15}
                        onChange={handleInputChange}
                        min="1"
                        step="1"
                        disabled={config.SELF_REFLECTION_ENABLED === false}
                    />
                    <small style={{ color: '#666', display: 'block', marginTop: '5px' }}>
                        保存后会同步到 memory-service，按用户分别生效。
                    </small>
                </div>
                {renderPushTargetFields(
                    '梦境重放报表推送',
                    'DREAM_INSIGHT_PUSH_TARGET',
                    'DREAM_INSIGHT_PUSH_GROUP_ID',
                    true,
                    '梦境重放会持续运行；这里仅控制报表推送到 Me、自定义群组，或完全不推送。'
                )}
                <div className="form-group">
                    <label htmlFor="DREAM_DIGEST_SCHEDULE_TYPE">梦境重放报表推送频率</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <select
                            id="DREAM_DIGEST_SCHEDULE_TYPE"
                            name="DREAM_DIGEST_SCHEDULE_TYPE"
                            value={config.DREAM_DIGEST_SCHEDULE_TYPE || 'every_x_days'}
                            onChange={handleInputChange}
                        >
                            <option value="every_x_days">每天 / 每隔 X 天</option>
                            <option value="weekly">每周</option>
                            <option value="monthly">每月</option>
                        </select>
                        {config.DREAM_DIGEST_SCHEDULE_TYPE === 'every_x_days' && (
                            <>
                                <span>每隔</span>
                                <input
                                    type="number"
                                    id="DREAM_DIGEST_INTERVAL_DAYS"
                                    name="DREAM_DIGEST_INTERVAL_DAYS"
                                    value={config.DREAM_DIGEST_INTERVAL_DAYS || 1}
                                    onChange={handleInputChange}
                                    min="1"
                                    style={{ width: '80px' }}
                                />
                                <span>天</span>
                            </>
                        )}
                        <button
                            type="button"
                            onClick={handlePushDreamDigestNow}
                            disabled={isDreamDigestPushing}
                        >
                            {isDreamDigestPushing ? '推送中...' : '立即推送'}
                        </button>
                    </div>
                    <small style={{ color: '#666', display: 'block', marginTop: '5px' }}>
                        点击「保存配置」后会同步到 memory-service。选择「不推送」时只会关闭报表推送，不会停止梦境重放本身；点击「立即推送」会跳过时间窗口，直接触发 Dream Digest。
                    </small>
                </div>
            </div>

            <div className="form-section">
                <h2>自动周报 (Weekly Report)</h2>
                <small style={{ color: '#666', display: 'block', marginBottom: '15px' }}>
                    自动周报功能会在指定时间自动生成本周工作总结。默认每周推送给 Me，也可以切到自定义群组或不推送。
                </small>
                {renderPushTargetFields(
                    '周报推送',
                    'WEEKLY_REPORT_PUSH_TARGET',
                    'WEEKLY_REPORT_PUSH_GROUP_ID',
                    true,
                    '选择「不推送」时，保存到后端会自动按禁用处理。'
                )}
                <div className="form-group">
                    <label htmlFor="WEEKLY_REPORT_CRON">Cron 表达式</label>
                    <input
                        type="text"
                        id="WEEKLY_REPORT_CRON"
                        value={weeklyReportCron}
                        onChange={(e) => {
                            setWeeklyReportCron(e.target.value);
                            setConfig(prev => ({
                                ...prev,
                                WEEKLY_REPORT_CRON: e.target.value
                            }));
                        }}
                        placeholder="0 18 * * 5"
                    />
                    <small style={{ color: '#666', display: 'block', marginTop: '5px' }}>
                        默认: 每周五 18:00 (0 18 * * 5)。格式: 分 时 日 月 周几
                    </small>
                </div>
                <div className="form-group">
                    <label htmlFor="WEEKLY_REPORT_MIN_MESSAGES">最少消息数阈值</label>
                    <input
                        type="number"
                        id="WEEKLY_REPORT_MIN_MESSAGES"
                        value={weeklyReportMinMessages}
                        onChange={(e) => {
                            const value = Number(e.target.value);
                            setWeeklyReportMinMessages(value);
                            setConfig(prev => ({
                                ...prev,
                                WEEKLY_REPORT_MIN_MESSAGES: value
                            }));
                        }}
                        min={0}
                        placeholder="20"
                    />
                    <small style={{ color: '#666', display: 'block', marginTop: '5px' }}>
                        本周消息数低于此阈值时不生成周报。默认 20
                    </small>
                </div>
                <button
                    onClick={saveWeeklyReportSettings}
                    disabled={weeklyReportSaving}
                    style={{
                        backgroundColor: '#2ecc71',
                        color: 'white',
                        padding: '8px 16px',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: weeklyReportSaving ? 'not-allowed' : 'pointer',
                        fontSize: '14px',
                    }}
                >
                    {weeklyReportSaving ? '保存中...' : '保存周报设置到后端'}
                </button>
                <button
                    onClick={handlePushWeeklyReportNow}
                    disabled={isWeeklyReportPushing}
                    style={{
                        backgroundColor: '#667eea',
                        color: 'white',
                        padding: '8px 16px',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: isWeeklyReportPushing ? 'not-allowed' : 'pointer',
                        fontSize: '14px',
                        marginLeft: '8px',
                    }}
                >
                    {isWeeklyReportPushing ? '推送中...' : '立即推送周报'}
                </button>
            </div>

            <div className="form-section">
                <h2>LLM 设置</h2>
                <div className="form-group">
                    <label htmlFor="LLM_TYPE">LLM 类型</label>
                    <select
                        id="LLM_TYPE"
                        name="LLM_TYPE"
                        value={config.LLM_TYPE}
                        onChange={handleInputChange}
                    >
                        <option value="local">本地</option>
                        <option value="openai">OpenAI</option>
                        <option value="groq">Groq</option>
                        <option value="dify">Dify</option>
                    </select>
                </div>
            </div>

            {config.LLM_TYPE === 'local' && (
                <div className="form-section">
                    <h2>Ollama 设置</h2>
                    <div className="form-group">
                        <label htmlFor="OLLAMA_BASE_URL">Ollama 基础 URL</label>
                        <input
                            type="url"
                            id="OLLAMA_BASE_URL"
                            name="OLLAMA_BASE_URL"
                            value={config.OLLAMA_BASE_URL}
                            onChange={handleInputChange}
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="OLLAMA_MODEL">Ollama 模型</label>
                        <input
                            type="text"
                            id="OLLAMA_MODEL"
                            name="OLLAMA_MODEL"
                            value={config.OLLAMA_MODEL}
                            onChange={handleInputChange}
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="OLLAMA_REVIEW_MODEL">Ollama 审核模型</label>
                        <input
                            type="text"
                            id="OLLAMA_REVIEW_MODEL"
                            name="OLLAMA_REVIEW_MODEL"
                            value={config.OLLAMA_REVIEW_MODEL}
                            onChange={handleInputChange}
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="OLLAMA_QUERY_MODEL">Ollama 查询模型</label>
                        <input
                            type="text"
                            id="OLLAMA_QUERY_MODEL"
                            name="OLLAMA_QUERY_MODEL"
                            value={config.OLLAMA_QUERY_MODEL}
                            onChange={handleInputChange}
                        />
                    </div>
                </div>
            )}

            {config.LLM_TYPE === 'dify' && (
                <div className="form-section">
                    <h2>Dify 设置</h2>
                    <div className="form-group">
                        <label htmlFor="DIFY_API_KEY">Dify API Key</label>
                        <input
                            type="text"
                            id="DIFY_API_KEY"
                            name="DIFY_API_KEY"
                            value={config.DIFY_API_KEY}
                            onChange={handleInputChange}
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="DIFY_REVIEW_API_KEY">Dify 审核 API Key</label>
                        <input
                            type="text"
                            id="DIFY_REVIEW_API_KEY"
                            name="DIFY_REVIEW_API_KEY"
                            value={config.DIFY_REVIEW_API_KEY}
                            onChange={handleInputChange}
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="DIFY_API_BASE_URL">Dify API 基础 URL</label>
                        <input
                            type="url"
                            id="DIFY_API_BASE_URL"
                            name="DIFY_API_BASE_URL"
                            value={config.DIFY_API_BASE_URL}
                            onChange={handleInputChange}
                        />
                    </div>
                </div>
            )}

            {config.LLM_TYPE === 'openai' && (
                <div className="form-section">
                    <h2>OpenAI 设置</h2>
                    <div className="form-group">
                        <label htmlFor="OPENAI_API_KEY">OpenAI API Key</label>
                        <input
                            type="text"
                            id="OPENAI_API_KEY"
                            name="OPENAI_API_KEY"
                            value={config.OPENAI_API_KEY}
                            onChange={handleInputChange}
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="OPENAI_MODEL">OpenAI 模型</label>
                        <input
                            type="text"
                            id="OPENAI_MODEL"
                            name="OPENAI_MODEL"
                            value={config.OPENAI_MODEL}
                            onChange={handleInputChange}
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="OPENAI_REVIEW_MODEL">OpenAI 审核模型</label>
                        <input
                            type="text"
                            id="OPENAI_REVIEW_MODEL"
                            name="OPENAI_REVIEW_MODEL"
                            value={config.OPENAI_REVIEW_MODEL}
                            onChange={handleInputChange}
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="OPENAI_API_BASE_URL">OpenAI API 基础 URL</label>
                        <input
                            type="url"
                            id="OPENAI_API_BASE_URL"
                            name="OPENAI_API_BASE_URL"
                            value={config.OPENAI_API_BASE_URL}
                            onChange={handleInputChange}
                        />
                    </div>
                </div>
            )}

            {config.LLM_TYPE === 'groq' && (
                <div className="form-section">
                    <h2>Groq 设置</h2>
                    <div className="form-group">
                        <label htmlFor="GROQ_API_KEY">Groq API Key</label>
                        <input
                            type="text"
                            id="GROQ_API_KEY"
                            name="GROQ_API_KEY"
                            value={config.GROQ_API_KEY}
                            onChange={handleInputChange}
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="GROQ_MODEL">Groq 模型</label>
                        <input
                            type="text"
                            id="GROQ_MODEL"
                            name="GROQ_MODEL"
                            value={config.GROQ_MODEL}
                            onChange={handleInputChange}
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="GROQ_REVIEW_MODEL">Groq 审核模型</label>
                        <input
                            type="text"
                            id="GROQ_REVIEW_MODEL"
                            name="GROQ_REVIEW_MODEL"
                            value={config.GROQ_REVIEW_MODEL}
                            onChange={handleInputChange}
                        />
                    </div>
                </div>
            )}

            <div className="form-section">
                <h2>Jira 设置</h2>
                <div className="form-group">
                    <label htmlFor="JIRA_BASE_URL">Jira Base URL</label>
                    <input
                        type="url"
                        id="JIRA_BASE_URL"
                        name="JIRA_BASE_URL"
                        value={config.JIRA_BASE_URL}
                        onChange={handleInputChange}
                        placeholder="https://jira.example.com"
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="JIRA_USERNAME">Jira Email</label>
                    <input
                        type="text"
                        id="JIRA_USERNAME"
                        name="JIRA_USERNAME"
                        value={config.JIRA_USERNAME}
                        onChange={handleInputChange}
                        placeholder="your.email@example.com"
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="JIRA_API_TOKEN">Jira Token (<a href="https://jira.ringcentral.com/secure/ViewProfile.jspa?selectedTab=com.atlassian.pats.pats-plugin:jira-user-personal-access-tokens" target="_blank" rel="noopener noreferrer">点击这里生成</a>)</label>
                    <input
                        type="text"
                        id="JIRA_API_TOKEN"
                        name="JIRA_API_TOKEN"
                        value={config.JIRA_API_TOKEN}
                        onChange={handleInputChange}
                        placeholder="输入你的 Jira API Token"
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="DESIGN_JIRA_PROJECT">Design JIRA Project 前缀</label>
                    <input
                        type="text"
                        id="DESIGN_JIRA_PROJECT"
                        name="DESIGN_JIRA_PROJECT"
                        value={config.DESIGN_JIRA_PROJECT || ''}
                        onChange={handleInputChange}
                        placeholder="UX"
                    />
                    <small style={{ color: '#666', display: 'block', marginTop: '5px' }}>
                        设计相关的 JIRA 项目匹配规则。使用 "UX*" 前缀匹配（匹配 UX-123, UXDES-456 等），"UX" 完全匹配（只匹配 UX-xxx）
                    </small>
                </div>

                <div className="form-group">
                    <label htmlFor="DEPENDENCIES_JIRA_PROJECT">Dependencies JIRA Project 前缀</label>
                    <input
                        type="text"
                        id="DEPENDENCIES_JIRA_PROJECT"
                        name="DEPENDENCIES_JIRA_PROJECT"
                        value={config.DEPENDENCIES_JIRA_PROJECT || ''}
                        onChange={handleInputChange}
                        placeholder="RCV"
                    />
                    <small style={{ color: '#666', display: 'block', marginTop: '5px' }}>
                        外部依赖的 JIRA 项目匹配规则，用于显示 Backend Progress。"RCV" 完全匹配（只匹配 RCV-xxx），"RCV*" 前缀匹配
                    </small>
                </div>
            </div>

            {config.ANALYSIS_TYPE === 'agentThinking' && (
                <div className="form-section">
                    <h2>智能Agent系统设置</h2>
                    <IntelligentAgentSettings />
                </div>
            )}

            {config.ANALYSIS_TYPE === 'agentWorkflow' && (
                <div className="form-section">
                    <h2>标准Agent系统设置</h2>
                    <AgentSettings />
                </div>
            )}

            <div className="form-section">
                <h2>配置导入/导出</h2>
                <div className="form-group">
                    <label htmlFor="import-config">导入配置</label>
                    <input 
                        type="file" 
                        id="import-config" 
                        accept=".json" 
                        onChange={handleImport}
                    />
                </div>
                <button onClick={handleExport}>导出配置</button>
            </div>

            {status.message && (
                <div className={`status-message ${status.type}`}>
                    {status.message}
                </div>
            )}

            <div className="buttons">
                <button onClick={resetConfig}>重置为默认值</button>
                <button onClick={loadEnvDefaults}>从.env文件加载</button>
                <button className="save-button" onClick={saveConfig}>保存配置</button>
            </div>
        </div>
    );
};

// Agent系统设置组件
const AgentSettings = () => {
    const [agents, setAgents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState('');
    
    // 新Agent表单状态
    const [newAgent, setNewAgent] = useState({
        id: '',
        name: '',
        description: '',
        enabled: true,
        priority: 50,
        tools: []
    });
    
    // 获取可用工具列表
    const availableTools = [
        'entityExtraction',
        'relationshipAnalysis',
        'historySearch',
        'relevanceJudgment',
        'externalServiceQuery',
        'replyAdviser',
        'concernedItemMatcher'  // 新增：关注项匹配工具
    ];
    
    // 工具名称映射
    const toolNameMap: Record<string, string> = {
        'entityExtraction': '实体提取工具',
        'relationshipAnalysis': '关系分析工具',
        'historySearch': '历史消息搜索工具',
        'relevanceJudgment': '重要性判断工具',
        'externalServiceQuery': '外部服务查询工具',
        'replyAdviser': '回复建议工具',
        'concernedItemMatcher': '关注项匹配工具'
    };
    
    // 加载当前Agent列表
    useEffect(() => {
        const loadAgents = async () => {
            try {
                setLoading(true);
                const agentList = await agentCoordinator.getAgents();
                setAgents(agentList);
                setLoading(false);
            } catch (error) {
                console.error('加载Agent失败:', error);
                setErrorMsg('加载Agent失败');
                setLoading(false);
            }
        };
        
        loadAgents();
    }, []);
    
    // 处理新Agent表单变化
    const handleNewAgentChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        setNewAgent(prev => ({
            ...prev,
            [name]: type === 'checkbox' 
                ? (e.target as HTMLInputElement).checked 
                : name === 'priority'
                    ? Number(value)
                    : value
        }));
    };
    
    // 处理工具选择变化
    const handleToolChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const tool = e.target.name;
        const isChecked = e.target.checked;
        
        setNewAgent(prev => {
            const tools = isChecked
                ? [...prev.tools, tool]
                : prev.tools.filter(t => t !== tool);
            
            return {
                ...prev,
                tools
            };
        });
    };
    
    // 添加新Agent
    const handleAddAgent = async () => {
        try {
            if (!newAgent.id || !newAgent.name) {
                setErrorMsg('请填写Agent ID和名称');
                return;
            }
            
            // 检查ID是否重复
            if (agents.some(a => a.id === newAgent.id)) {
                setErrorMsg('Agent ID已存在');
                return;
            }
            
            const success = await agentCoordinator.addAgent(newAgent);
            if (success) {
                // 重新加载Agent列表
                const agentList = await agentCoordinator.getAgents();
                setAgents(agentList);
                
                // 重置表单
                setNewAgent({
                    id: '',
                    name: '',
                    description: '',
                    enabled: true,
                    priority: 50,
                    tools: []
                });
                
                setErrorMsg('');
            } else {
                setErrorMsg('添加Agent失败');
            }
        } catch (error) {
            console.error('添加Agent失败:', error);
            setErrorMsg('添加Agent失败');
        }
    };
    
    return (
        <div className="agent-settings">
            <h3>当前 Agent 列表</h3>
            {loading ? (
                <p>加载中...</p>
            ) : (
                <table className="agent-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>名称</th>
                            <th>描述</th>
                            <th>优先级</th>
                            <th>工具</th>
                        </tr>
                    </thead>
                    <tbody>
                        {agents.map(agent => (
                            <tr key={agent.id}>
                                <td>{agent.id}</td>
                                <td>{agent.name}</td>
                                <td>{agent.description}</td>
                                <td>{agent.priority}</td>
                                <td>{agent.tools.map((tool: string) => toolNameMap[tool] || tool).join(', ')}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
            
            <h3>添加自定义 Agent</h3>
            {errorMsg && <p className="error-message">{errorMsg}</p>}
            
            <div className="form-group">
                <label htmlFor="agentId">Agent ID</label>
                <input
                    type="text"
                    id="agentId"
                    name="id"
                    value={newAgent.id}
                    onChange={handleNewAgentChange}
                    placeholder="自定义Agent的唯一标识符"
                />
            </div>
            
            <div className="form-group">
                <label htmlFor="agentName">名称</label>
                <input
                    type="text"
                    id="agentName"
                    name="name"
                    value={newAgent.name}
                    onChange={handleNewAgentChange}
                    placeholder="Agent的显示名称"
                />
            </div>
            
            <div className="form-group">
                <label htmlFor="agentDescription">描述</label>
                <textarea
                    id="agentDescription"
                    name="description"
                    value={newAgent.description}
                    onChange={handleNewAgentChange}
                    placeholder="Agent的功能描述"
                />
            </div>
            
            <div className="form-group">
                <label htmlFor="agentPriority">优先级</label>
                <input
                    type="number"
                    id="agentPriority"
                    name="priority"
                    value={newAgent.priority}
                    onChange={handleNewAgentChange}
                    min="1"
                    max="100"
                />
                <span className="form-note">1-100，值越大优先级越高</span>
            </div>
            
            <div className="form-group">
                <label>可用工具</label>
                <div className="tools-list">
                    {availableTools.map(tool => (
                        <div key={tool} className="tool-item">
                            <label>
                                <input
                                    type="checkbox"
                                    name={tool}
                                    checked={newAgent.tools.includes(tool)}
                                    onChange={handleToolChange}
                                />
                                {toolNameMap[tool] || tool}
                            </label>
                        </div>
                    ))}
                </div>
            </div>
            
            <button onClick={handleAddAgent}>添加 Agent</button>
        </div>
    );
};

const agent = new IntelligentAgent();

// 智能Agent系统设置组件
const IntelligentAgentSettings = () => {
    const [tools, setTools] = useState<any[]>([]);
    const [demoMode, setDemoMode] = useState(false);
    const [demoThoughtProcess, setDemoThoughtProcess] = useState<any[]>([]);
    const [demoResult, setDemoResult] = useState<any>(null);
    
    // 获取可用工具
    useEffect(() => {
        try {
            const availableTools = agent.getToolDescriptions();
            setTools(availableTools);
        } catch (error) {
            console.error('加载工具失败:', error);
        }
    }, []);
    
    // 启动演示模式
    const startDemo = () => {
        setDemoMode(true);
        setDemoThoughtProcess([]);
        setDemoResult(null);
        
        // 模拟思考过程
        const simulateThoughtProcess = async () => {
            // 模拟初始思考
            await new Promise(resolve => setTimeout(resolve, 1000));
            setDemoThoughtProcess([{
                timestamp: Date.now(),
                thought: '收到一条新消息，需要对其进行分析。首先我应该提取消息中的关键实体信息，了解消息的基本内容。',
                action: '执行工具',
                toolUsed: 'entityExtractor'
            }]);
            
            // 模拟实体提取结果
            await new Promise(resolve => setTimeout(resolve, 2000));
            setDemoThoughtProcess(prev => [...prev, {
                timestamp: Date.now(),
                thought: '我已经提取了消息中的实体信息。发现消息提及了一个项目和几个人物。接下来，我应该检查这个项目在JIRA中的状态，以便了解更多上下文。',
                action: '执行工具',
                toolUsed: 'jiraQuery',
                result: {
                    success: true,
                    issue: {
                        id: 'PROJ-1001',
                        title: '示例项目任务',
                        status: '进行中',
                        assignee: '开发人员A'
                    }
                }
            }]);
            
            // 模拟JIRA查询后的思考
            await new Promise(resolve => setTimeout(resolve, 2000));
            setDemoThoughtProcess(prev => [...prev, {
                timestamp: Date.now(),
                thought: '我找到了与消息相关的JIRA任务。从任务状态来看，这是一个正在进行中的项目。消息中提到的人物可能与这个项目有关，接下来我应该查询他们之间的组织关系。',
                action: '执行工具',
                toolUsed: 'orgChart',
                result: {
                    success: true,
                    person: '张工程师',
                    role: '高级工程师',
                    department: '研发部',
                    manager: '李经理'
                }
            }]);
            
            // 模拟组织架构查询后的思考
            await new Promise(resolve => setTimeout(resolve, 2000));
            setDemoThoughtProcess(prev => [...prev, {
                timestamp: Date.now(),
                thought: '我已经了解了消息中提到的人物的组织关系。综合JIRA任务信息和组织关系，我认为这条消息是关于项目进展的重要更新，应该存储下来并通知用户。',
                action: 'finish'
            }]);
            
            // 设置最终结果
            await new Promise(resolve => setTimeout(resolve, 1000));
            setDemoResult({
                isImportant: true,
                shouldStore: true,
                shouldNotify: true,
                confidence: 0.85,
                summary: '项目PROJ-1001的进展更新：开发工作正在按计划进行，预计下周完成。',
                reasonsToStore: [
                    '消息包含重要项目的进展信息',
                    '涉及关键团队成员的工作状态',
                    '有助于跟踪项目时间线'
                ]
            });
        };
        
        simulateThoughtProcess();
    };
    
    // 停止演示
    const stopDemo = () => {
        setDemoMode(false);
    };
    
    return (
        <div className="intelligent-agent-settings">
            <h3>可用工具列表</h3>
            <div className="tools-table-container">
                <table className="tools-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>名称</th>
                            <th>描述</th>
                        </tr>
                    </thead>
                    <tbody>
                        {tools.map(tool => (
                            <tr key={tool.id}>
                                <td>{tool.id}</td>
                                <td>{tool.name}</td>
                                <td>{tool.description}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            
            <div className="demo-section">
                <h3>流程演示</h3>
                <div className="demo-controls">
                    {!demoMode ? (
                        <button onClick={startDemo}>启动演示</button>
                    ) : (
                        <button onClick={stopDemo}>停止演示</button>
                    )}
                </div>
                
                {demoMode && (
                    <>
                        <AgentVisualizer 
                            thoughtProcess={demoThoughtProcess} 
                            isProcessing={demoResult === null}
                        />
                        
                        <AgentFlowVisualizer 
                            thoughtProcess={demoThoughtProcess}
                        />
                        
                        {demoResult && (
                            <AgentResultSummary result={demoResult} />
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

ReactDOM.render(
    <Options />,
    document.getElementById('options-root')
); 
