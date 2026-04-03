import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { useState, useEffect, useRef } from 'react';
import {
    BotPushTargetMode,
    defaultEnvConfig,
    EnvConfigType,
    getDefaultEnvConfig,
    normalizeConcernedItemsDigestHour,
    normalizeBotPushTarget,
} from './utils';
import {
    MemoryServiceClient,
    type OutreachDirectoryStatus,
    type RuntimeConfigResponse,
    type UpdateRuntimeConfigPayload,
} from './services/MemoryServiceClient';
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

interface MemoryImportResponse {
    mode: 'merge' | 'replace';
    importedAt: string;
    restoredLayers: Array<'A' | 'B'>;
    database: {
        action: 'merged' | 'replaced';
        changedRows?: number;
        tableChanges?: Record<string, number>;
        skippedTables?: string[];
    };
    files: {
        written: number;
        overwritten: number;
        preserved: number;
        deleted: number;
        writtenPaths: string[];
        overwrittenPaths: string[];
        preservedPaths: string[];
        deletedPaths: string[];
    };
    warnings: string[];
}

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

const sanitizeLocalEnvConfig = (targetConfig: EnvConfigType): EnvConfigType => ({
    ...targetConfig,
    CONCERNED_ITEMS_DIGEST_HOUR: normalizeConcernedItemsDigestHour(targetConfig.CONCERNED_ITEMS_DIGEST_HOUR, 8),
    OPENCLAW_API_KEY: '',
    OPENCLAW_CLEAR_API_KEY: false,
    RINGCENTRAL_CLIENT_SECRET: '',
    RINGCENTRAL_JWT: '',
    RINGCENTRAL_CLEAR_CLIENT_SECRET: false,
    RINGCENTRAL_CLEAR_JWT: false,
});

interface ToggleFieldProps {
    id: string;
    name: string;
    checked: boolean;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    label: string;
    description?: React.ReactNode;
    disabled?: boolean;
}

const ToggleField = ({
    id,
    name,
    checked,
    onChange,
    label,
    description,
    disabled = false,
}: ToggleFieldProps) => (
    <div className="form-group">
        <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '16px',
        }}>
            <div style={{ flex: 1 }}>
                <label htmlFor={id} style={{ display: 'block', fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer' }}>
                    {label}
                </label>
                {description && (
                    <small style={{ color: '#666', display: 'block', marginTop: '5px' }}>
                        {description}
                    </small>
                )}
            </div>
            <label
                htmlFor={id}
                style={{
                    position: 'relative',
                    display: 'inline-flex',
                    width: '46px',
                    height: '28px',
                    flexShrink: 0,
                    cursor: disabled ? 'not-allowed' : 'pointer',
                }}
            >
                <input
                    type="checkbox"
                    id={id}
                    name={name}
                    checked={checked}
                    onChange={onChange}
                    disabled={disabled}
                    style={{
                        opacity: 0,
                        width: 0,
                        height: 0,
                        position: 'absolute',
                    }}
                />
                <span
                    aria-hidden="true"
                    style={{
                        position: 'absolute',
                        inset: 0,
                        borderRadius: '999px',
                        backgroundColor: disabled ? '#d0d7de' : (checked ? '#2ecc71' : '#c7ccd1'),
                        transition: 'background-color 0.2s ease',
                    }}
                />
                <span
                    aria-hidden="true"
                    style={{
                        position: 'absolute',
                        top: '3px',
                        left: checked ? '21px' : '3px',
                        width: '22px',
                        height: '22px',
                        borderRadius: '50%',
                        backgroundColor: '#fff',
                        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.24)',
                        transition: 'left 0.2s ease',
                    }}
                />
            </label>
        </div>
    </div>
);

// 使用从utils.ts导入的类型
const Options = () => {
    const [config, setConfig] = useState<EnvConfigType>({...defaultEnvConfig});
    const [status, setStatus] = useState<{message: string, type: 'success' | 'error' | ''}>({
        message: '',
        type: ''
    });
    const memoryImportInputRef = useRef<HTMLInputElement | null>(null);
    const [isDreamDigestPushing, setIsDreamDigestPushing] = useState(false);
    const [isWeeklyReportPushing, setIsWeeklyReportPushing] = useState(false);
    const [isMemoryExporting, setIsMemoryExporting] = useState(false);
    const [isMemoryImporting, setIsMemoryImporting] = useState(false);
    const [replaceMemoryOnImport, setReplaceMemoryOnImport] = useState(false);
    const [outreachDirectoryStatus, setOutreachDirectoryStatus] = useState<OutreachDirectoryStatus[]>([]);
    const [outreachDirectoryRefreshing, setOutreachDirectoryRefreshing] = useState(false);

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
            const data = await getRuntimeConfigFromBackend(targetConfig);
            if (!data) return;
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
            const persistedConfig = sanitizeLocalEnvConfig(config);
            await chrome.storage.local.set({ envConfig: persistedConfig });
            await chrome.runtime.sendMessage({
                type: 'UPDATE_ENV_CONFIG',
                config: persistedConfig
            });

            const client = await createMemoryServiceClient(config);
            await client.updateRuntimeConfig({
                weeklyReportEnabled: pushTarget !== 'none',
                weeklyReportCron,
                weeklyReportMinMessages,
                weeklyReportPushTarget: pushTarget,
                weeklyReportPushGroupId: (config.WEEKLY_REPORT_PUSH_GROUP_ID || '').trim() || undefined,
            });
            setStatus({ message: '周报设置已保存到后端', type: 'success' });
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
                const merged = sanitizeLocalEnvConfig({ ...defaultEnvConfig, ...result.envConfig });
                setConfig(merged);
                setWeeklyReportCron(merged.WEEKLY_REPORT_CRON || '0 18 * * 5');
                setWeeklyReportMinMessages(Number(merged.WEEKLY_REPORT_MIN_MESSAGES) || 20);
                loadDreamDigestSettingsFromBackend(merged);
                loadOutreachDirectoryStatusFromBackend(merged);
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
            await loadOutreachDirectoryStatusFromBackend(config);
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

    const getRequestHeaders = async (
        targetConfig: EnvConfigType,
        options?: {
            accept?: string;
            contentType?: string | null;
        }
    ): Promise<Record<string, string>> => {
        const result = await chrome.storage.local.get(['userinfo']);
        const username = result?.userinfo?.username?.trim();
        const userId = username || 'default';
        const headers: Record<string, string> = {
            'Accept': options?.accept || 'application/json',
            'X-User-Id': userId,
        };
        if (options?.contentType !== null) {
            headers['Content-Type'] = options?.contentType || 'application/json';
        }
        if (targetConfig.MEMORY_SERVICE_API_KEY) {
            headers['Authorization'] = `Bearer ${targetConfig.MEMORY_SERVICE_API_KEY}`;
        }
        return headers;
    };

    const createMemoryServiceClient = async (targetConfig: EnvConfigType) => {
        const result = await chrome.storage.local.get(['userinfo']);
        const userId = result?.userinfo?.username?.trim() || 'default';
        return new MemoryServiceClient({
            baseUrl: targetConfig.MEMORY_SERVICE_BASE_URL,
            apiKey: targetConfig.MEMORY_SERVICE_API_KEY || undefined,
            timeout: targetConfig.MEMORY_SERVICE_TIMEOUT || 30_000,
            userId,
        });
    };

    const getRuntimeConfigFromBackend = async (targetConfig: EnvConfigType): Promise<RuntimeConfigResponse | null> => {
        if (!targetConfig.MEMORY_SERVICE_BASE_URL) return null;
        try {
            const client = await createMemoryServiceClient(targetConfig);
            return await client.getRuntimeConfig();
        } catch (err) {
            console.warn('Failed to load runtime config from backend:', err);
            return null;
        }
    };

    const downloadJson = (payload: unknown, filename: string) => {
        const json = JSON.stringify(payload, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        downloadBlob(blob, filename);
    };

    const downloadBlob = (blob: Blob, filename: string) => {
        const url = URL.createObjectURL(blob);

        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = filename;
        anchor.click();

        URL.revokeObjectURL(url);
    };

    const parseContentDispositionFilename = (contentDisposition: string | null) => {
        if (!contentDisposition) {
            return null;
        }

        const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
        if (utf8Match?.[1]) {
            try {
                return decodeURIComponent(utf8Match[1]);
            } catch {
                return utf8Match[1];
            }
        }

        const filenameMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
        return filenameMatch?.[1] || null;
    };

    const readResponseErrorMessage = async (response: Response) => {
        const rawText = await response.text();
        try {
            const payload = JSON.parse(rawText);
            return payload?.error || payload?.message || response.statusText || '请求失败';
        } catch {
            return rawText || response.statusText || '请求失败';
        }
    };

    const formatExportTimestamp = (iso?: string) => {
        const source = iso || new Date().toISOString();
        return source.replace(/\.\d{3}Z$/, 'Z').replace(/[:]/g, '-');
    };

    const ensureMemoryServiceConfigured = () => {
        if (!config.MEMORY_SERVICE_BASE_URL) {
            setStatus({
                message: '请先配置 Memory Service API 地址',
                type: 'error'
            });
            return false;
        }
        return true;
    };

    const loadDreamDigestSettingsFromBackend = async (targetConfig: EnvConfigType) => {
        if (!targetConfig.MEMORY_SERVICE_BASE_URL) return;
        try {
            const serverConfig = await getRuntimeConfigFromBackend(targetConfig);
            if (!serverConfig) return;
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
                OPENCLAW_ENABLED: serverConfig?.openClawEnabled !== undefined
                    ? Boolean(serverConfig.openClawEnabled)
                    : prev.OPENCLAW_ENABLED,
                OPENCLAW_BASE_URL: typeof serverConfig?.openClawBaseUrl === 'string'
                    ? serverConfig.openClawBaseUrl
                    : prev.OPENCLAW_BASE_URL,
                OPENCLAW_TIMEOUT_MS: Number.isFinite(Number(serverConfig?.openClawTimeoutMs))
                    ? Math.max(1000, Math.floor(Number(serverConfig.openClawTimeoutMs)))
                    : (prev.OPENCLAW_TIMEOUT_MS || 600000),
                OPENCLAW_API_KEY_CONFIGURED: Boolean(serverConfig?.openClawApiKeyConfigured),
                OUTREACH_ENABLED: serverConfig?.outreachEnabled !== undefined
                    ? Boolean(serverConfig.outreachEnabled)
                    : prev.OUTREACH_ENABLED,
                OUTREACH_INTERVAL_MS: Number.isFinite(Number(serverConfig?.outreachIntervalMs))
                    ? Math.max(1000, Math.floor(Number(serverConfig.outreachIntervalMs)))
                    : (prev.OUTREACH_INTERVAL_MS || 60000),
                OUTREACH_REQUIRE_APPROVAL_FOR_REFLECTION: serverConfig?.outreachRequireApprovalForReflection !== undefined
                    ? Boolean(serverConfig.outreachRequireApprovalForReflection)
                    : prev.OUTREACH_REQUIRE_APPROVAL_FOR_REFLECTION,
                OUTREACH_REQUIRE_APPROVAL_FOR_MANUAL: serverConfig?.outreachRequireApprovalForManual !== undefined
                    ? Boolean(serverConfig.outreachRequireApprovalForManual)
                    : prev.OUTREACH_REQUIRE_APPROVAL_FOR_MANUAL,
                RINGCENTRAL_SERVER_URL: typeof serverConfig?.ringCentralServerUrl === 'string'
                    ? serverConfig.ringCentralServerUrl
                    : prev.RINGCENTRAL_SERVER_URL,
                RINGCENTRAL_CLIENT_ID: typeof serverConfig?.ringCentralClientId === 'string'
                    ? serverConfig.ringCentralClientId
                    : prev.RINGCENTRAL_CLIENT_ID,
                RINGCENTRAL_CLIENT_SECRET_CONFIGURED: Boolean(serverConfig?.ringCentralClientSecretConfigured),
                RINGCENTRAL_JWT_CONFIGURED: Boolean(serverConfig?.ringCentralJwtConfigured),
            }));
        } catch (error) {
            console.warn('加载梦境重放报表配置失败:', error);
        }
    };

    const loadOutreachDirectoryStatusFromBackend = async (targetConfig: EnvConfigType) => {
        if (!targetConfig.MEMORY_SERVICE_BASE_URL) return;
        try {
            const client = await createMemoryServiceClient(targetConfig);
            const response = await client.getOutreachDirectoryStatus();
            setOutreachDirectoryStatus(Array.isArray(response?.items) ? response.items : []);
        } catch (error) {
            console.warn('加载主动询问目录状态失败:', error);
            setOutreachDirectoryStatus([]);
        }
    };

    const handleRefreshOutreachDirectory = async () => {
        try {
            setOutreachDirectoryRefreshing(true);
            const client = await createMemoryServiceClient(config);
            const response = await client.syncOutreachDirectory(true);
            setOutreachDirectoryStatus(Array.isArray(response?.items) ? response.items : []);
            setStatus({
                message: '已触发 RingCentral 目录刷新',
                type: 'success'
            });
        } catch (error) {
            console.error('刷新主动询问目录失败:', error);
            setStatus({
                message: `刷新目录失败: ${(error as Error).message}`,
                type: 'error'
            });
        } finally {
            setOutreachDirectoryRefreshing(false);
        }
    };

    const getOutreachDirectoryScopeStatus = (scope: 'users' | 'teams') =>
        outreachDirectoryStatus.find(item => item.scope === scope);

    const formatOutreachDirectoryScopeStatus = (scope: 'users' | 'teams') => {
        const item = getOutreachDirectoryScopeStatus(scope);
        if (!item) {
            return '未同步';
        }
        const staleText = item.stale ? '（缓存过期）' : '';
        const errorText = item.lastError ? `：${item.lastError}` : '';
        if (item.status === 'ready') {
            return `已就绪，${item.recordCount} 条${staleText}`;
        }
        if (item.status === 'syncing') {
            return `同步中，当前 ${item.recordCount} 条${staleText}`;
        }
        if (item.status === 'error') {
            return `同步失败${staleText}${errorText}`;
        }
        return `未同步${staleText}`;
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

            if (config.OPENCLAW_ENABLED && !(config.OPENCLAW_BASE_URL || '').trim()) {
                setStatus({
                    message: '启用 OpenClaw 时，需填写 OpenClaw Base URL',
                    type: 'error'
                });
                return;
            }

            if (Number(config.OPENCLAW_TIMEOUT_MS) < 1000 || Number.isNaN(Number(config.OPENCLAW_TIMEOUT_MS))) {
                setStatus({
                    message: 'OpenClaw 超时必须 >= 1000 毫秒',
                    type: 'error'
                });
                return;
            }

            if (Number(config.OUTREACH_INTERVAL_MS) < 1000 || Number.isNaN(Number(config.OUTREACH_INTERVAL_MS))) {
                setStatus({
                    message: '主动询问轮询间隔必须 >= 1000 毫秒',
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
            
            const persistedConfig = sanitizeLocalEnvConfig(config);
            await chrome.storage.local.set({ envConfig: persistedConfig });
            // 通知background脚本更新配置
            await chrome.runtime.sendMessage({
                type: 'UPDATE_ENV_CONFIG',
                config: persistedConfig
            });

            // 同步梦境重放/自我反思/OpenClaw配置到 memory-service 运行时配置
            const dreamInsightPushTarget = resolvePushTargetValue(config.DREAM_INSIGHT_PUSH_TARGET, 'me', true);
            const openClawApiKey = (config.OPENCLAW_API_KEY || '').trim();
            const clearOpenClawApiKey = Boolean(config.OPENCLAW_CLEAR_API_KEY) && openClawApiKey.length === 0;
            const ringCentralClientSecret = (config.RINGCENTRAL_CLIENT_SECRET || '').trim();
            const ringCentralJwt = (config.RINGCENTRAL_JWT || '').trim();
            const clearRingCentralClientSecret =
                Boolean(config.RINGCENTRAL_CLEAR_CLIENT_SECRET) && ringCentralClientSecret.length === 0;
            const clearRingCentralJwt =
                Boolean(config.RINGCENTRAL_CLEAR_JWT) && ringCentralJwt.length === 0;
            const payload: UpdateRuntimeConfigPayload = {
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
                openClawEnabled: config.OPENCLAW_ENABLED,
                openClawBaseUrl: (config.OPENCLAW_BASE_URL || '').trim(),
                openClawTimeoutMs: Math.max(1000, Number(config.OPENCLAW_TIMEOUT_MS) || 600000),
                clearOpenClawApiKey,
                outreachEnabled: config.OUTREACH_ENABLED,
                outreachIntervalMs: Math.max(1000, Number(config.OUTREACH_INTERVAL_MS) || 60000),
                outreachRequireApprovalForReflection: config.OUTREACH_REQUIRE_APPROVAL_FOR_REFLECTION,
                outreachRequireApprovalForManual: config.OUTREACH_REQUIRE_APPROVAL_FOR_MANUAL,
                ringCentralServerUrl: (config.RINGCENTRAL_SERVER_URL || '').trim(),
                ringCentralClientId: (config.RINGCENTRAL_CLIENT_ID || '').trim(),
                clearRingCentralClientSecret,
                clearRingCentralJwt,
            };
            if (openClawApiKey.length > 0) {
                payload.openClawApiKey = openClawApiKey;
            }
            if (ringCentralClientSecret.length > 0) {
                payload.ringCentralClientSecret = ringCentralClientSecret;
            }
            if (ringCentralJwt.length > 0) {
                payload.ringCentralJwt = ringCentralJwt;
            }
            const client = await createMemoryServiceClient(config);
            await client.updateRuntimeConfig(payload);
            await loadDreamDigestSettingsFromBackend(config);
            await loadOutreachDirectoryStatusFromBackend(config);
            setConfig(prev => ({
                ...prev,
                OPENCLAW_API_KEY: '',
                OPENCLAW_CLEAR_API_KEY: false,
                OPENCLAW_API_KEY_CONFIGURED: clearOpenClawApiKey
                    ? false
                    : (openClawApiKey.length > 0 ? true : prev.OPENCLAW_API_KEY_CONFIGURED),
                RINGCENTRAL_CLIENT_SECRET: '',
                RINGCENTRAL_JWT: '',
                RINGCENTRAL_CLEAR_CLIENT_SECRET: false,
                RINGCENTRAL_CLEAR_JWT: false,
                RINGCENTRAL_CLIENT_SECRET_CONFIGURED: clearRingCentralClientSecret
                    ? false
                    : (ringCentralClientSecret.length > 0 ? true : prev.RINGCENTRAL_CLIENT_SECRET_CONFIGURED),
                RINGCENTRAL_JWT_CONFIGURED: clearRingCentralJwt
                    ? false
                    : (ringCentralJwt.length > 0 ? true : prev.RINGCENTRAL_JWT_CONFIGURED),
            }));

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
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        
        setConfig(prev => ({
            ...prev,
            [name]: type === 'checkbox' 
                ? (e.target as HTMLInputElement).checked 
                : name === 'SCHEDULED_INTERVAL' ||
                  name === 'MESSAGE_ANALYSIS_INTERVAL' ||
                  name === 'MESSAGE_CONTEXT_WINDOW' ||
                  name === 'CONCERNED_ITEMS_DIGEST_HOUR' ||
                  name === 'MEMORY_SERVICE_TIMEOUT' ||
                  name === 'DREAM_DIGEST_INTERVAL_DAYS' ||
                  name === 'SELF_REFLECTION_HEARTBEAT_MINUTES' ||
                  name === 'OPENCLAW_TIMEOUT_MS' ||
                  name === 'OUTREACH_INTERVAL_MS'
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
                setConfig(sanitizeLocalEnvConfig({ ...defaultEnvConfig, ...importedConfig }));
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
        downloadJson(config, 'personal-ai-config.json');
    };

    const handleMemoryExport = async () => {
        if (!ensureMemoryServiceConfigured()) {
            return;
        }

        setIsMemoryExporting(true);
        try {
            const headers = await getRequestHeaders(config, {
                accept: 'application/zip',
            });
            const response = await fetch(`${config.MEMORY_SERVICE_BASE_URL}/export`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    format: 'backup_zip'
                })
            });

            if (!response.ok) {
                throw new Error(await readResponseErrorMessage(response));
            }

            const backupBlob = await response.blob();
            const filename =
                parseContentDispositionFilename(response.headers.get('content-disposition')) ||
                `personal-ai-memory-backup-${formatExportTimestamp()}.zip`;
            downloadBlob(backupBlob, filename);

            setStatus({
                message: `记忆导出完成，已下载备份包 ${filename}`,
                type: 'success'
            });
        } catch (error) {
            console.error('导出记忆失败:', error);
            setStatus({
                message: error instanceof Error ? `导出记忆失败: ${error.message}` : '导出记忆失败',
                type: 'error'
            });
        } finally {
            setIsMemoryExporting(false);
        }
    };

    const handleOpenMemoryImport = () => {
        memoryImportInputRef.current?.click();
    };

    const handleMemoryImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = '';

        if (!file) {
            return;
        }
        if (!ensureMemoryServiceConfigured()) {
            return;
        }

        const memoryImportMode = replaceMemoryOnImport ? 'replace' : 'merge';

        if (memoryImportMode === 'replace') {
            const confirmed = window.confirm(
                'replace 会覆盖当前用户的记忆数据库，并删除备份包中不存在的本地文件。确定继续吗？'
            );
            if (!confirmed) {
                return;
            }
        }

        setIsMemoryImporting(true);
        try {
            const headers = await getRequestHeaders(config, {
                accept: 'application/json',
                contentType: null
            });
            const formData = new FormData();
            formData.append('file', file, file.name || 'personal-ai-memory-backup.zip');
            formData.append('mode', memoryImportMode);

            const response = await fetch(`${config.MEMORY_SERVICE_BASE_URL}/import`, {
                method: 'POST',
                headers,
                body: formData
            });

            if (!response.ok) {
                throw new Error(await readResponseErrorMessage(response));
            }

            const result = await response.json() as MemoryImportResponse;
            const warningText = result.warnings.length > 0
                ? `，警告 ${result.warnings.length} 项`
                : '';
            const dbSummary = result.database.action === 'merged' && typeof result.database.changedRows === 'number'
                ? `，数据库变更 ${result.database.changedRows} 行`
                : '';

            setStatus({
                message:
                    `记忆导入完成（${result.mode}）：写入 ${result.files.written} 个文件，覆盖 ${result.files.overwritten} 个，保留 ${result.files.preserved} 个，删除 ${result.files.deleted} 个${dbSummary}${warningText}`,
                type: 'success'
            });
        } catch (error) {
            console.error('导入记忆失败:', error);
            setStatus({
                message: error instanceof Error ? `导入记忆失败: ${error.message}` : '导入记忆失败',
                type: 'error'
            });
        } finally {
            setIsMemoryImporting(false);
        }
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
                            仅在选择「自定义群组」时生效。配置后，该群组会自动从消息分析输入中排除，避免推送回流导致重复分析。
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

                <ToggleField
                    id="ANALYZE_BY_GROUP"
                    name="ANALYZE_BY_GROUP"
                    checked={config.ANALYZE_BY_GROUP}
                    onChange={handleInputChange}
                    label="拆开每个群组独立分析"
                    description="开启后，不同群组的消息会分别进入独立分析流程。"
                />

                {config.ANALYSIS_TYPE !== 'agentThinking' && config.ANALYSIS_TYPE !== 'agentWorkflow' && (
                    <ToggleField
                        id="LLM_REVIEW_BEFORE_SEND"
                        name="LLM_REVIEW_BEFORE_SEND"
                        checked={config.LLM_REVIEW_BEFORE_SEND}
                        onChange={handleInputChange}
                        label="启用消息审核"
                        description="关闭后，会直接推送所有命中关注项的消息。"
                    />
                )}
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
                <div className="form-group">
                    <label htmlFor="CONCERNED_ITEMS_DIGEST_HOUR">ConcernedItems 摘要推送时间（小时）</label>
                    <input
                        type="number"
                        id="CONCERNED_ITEMS_DIGEST_HOUR"
                        name="CONCERNED_ITEMS_DIGEST_HOUR"
                        value={normalizeConcernedItemsDigestHour(config.CONCERNED_ITEMS_DIGEST_HOUR, 8)}
                        onChange={(e) => {
                            const value = normalizeConcernedItemsDigestHour(e.target.value, 8);
                            setConfig(prev => ({
                                ...prev,
                                CONCERNED_ITEMS_DIGEST_HOUR: value
                            }));
                        }}
                        min="0"
                        max="23"
                        step="1"
                    />
                    <small style={{ color: '#666', display: 'block', marginTop: '5px' }}>
                        仅影响在 concerned item 中启用了「使用定时摘要推送」的规则。默认每天 8:00 左右汇总推送。
                    </small>
                </div>
            </div>

            <div className="form-section">
                <h2>消息过滤设置</h2>
                <ToggleField
                    id="FILTER_OWN_MESSAGES"
                    name="FILTER_OWN_MESSAGES"
                    checked={config.FILTER_OWN_MESSAGES}
                    onChange={handleInputChange}
                    label="过滤自己发送的消息"
                    description="开启后，消息分析会自动忽略自己发出的消息。"
                />
            </div>

            <div className="form-section">
                <h2>消息交互功能</h2>
                <p style={{ color: '#666', fontSize: '13px', marginBottom: '15px' }}>
                    在 RingCentral 消息页面，悬停在消息上时会显示交互工具栏。可以选择启用/禁用以下功能：
                </p>
                <ToggleField
                    id="ENABLE_SNOOZE"
                    name="ENABLE_SNOOZE"
                    checked={config.ENABLE_SNOOZE}
                    onChange={handleInputChange}
                    label="启用「稍后处理」功能"
                    description="设置提醒时间，到时 Bot 会推送消息提醒您。"
                />
                <ToggleField
                    id="ENABLE_AUTO_REPLY"
                    name="ENABLE_AUTO_REPLY"
                    checked={config.ENABLE_AUTO_REPLY}
                    onChange={handleInputChange}
                    label="启用「自动答复」功能"
                    description="配置自动答复规则，匹配消息时自动发送回复。"
                />
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
                <ToggleField
                    id="SELF_REFLECTION_ENABLED"
                    name="SELF_REFLECTION_ENABLED"
                    checked={config.SELF_REFLECTION_ENABLED !== false}
                    onChange={handleInputChange}
                    label="启用自我反思"
                    description="每个用户可以单独关闭自我反思；关闭后不会影响梦境重放的持续生成。"
                />
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
                <div className="form-group">
                    <label>记忆备份导入/导出</label>
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                        <button
                            type="button"
                            onClick={handleMemoryExport}
                            disabled={isMemoryExporting || isMemoryImporting}
                        >
                            {isMemoryExporting ? '导出中...' : '导出记忆'}
                        </button>
                        <button
                            type="button"
                            onClick={handleOpenMemoryImport}
                            disabled={isMemoryExporting || isMemoryImporting}
                        >
                            {isMemoryImporting ? '导入中...' : '导入记忆'}
                        </button>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                            <input
                                type="checkbox"
                                checked={replaceMemoryOnImport}
                                onChange={(e) => setReplaceMemoryOnImport(e.target.checked)}
                                disabled={isMemoryImporting}
                            />
                            覆盖替换现有记忆
                        </label>
                    </div>
                    <input
                        ref={memoryImportInputRef}
                        type="file"
                        accept=".zip,application/zip"
                        onChange={handleMemoryImport}
                        style={{ display: 'none' }}
                    />
                    <small style={{ color: '#666', display: 'block', marginTop: '5px' }}>
                        默认不勾选时按 merge 导入 zip 备份，保留本地未冲突内容；勾选后按 replace 导入，会替换数据库并删除备份包中不存在的本地记忆文件。
                    </small>
                </div>
            </div>

            <div className="form-section">
                <h2>OpenClaw 对接</h2>
                <small style={{ color: '#666', display: 'block', marginBottom: '15px' }}>
                    自我反思中的外部委派动作会走这里的 OpenClaw 配置。启用后才会真正调用外部系统。
                </small>
                <ToggleField
                    id="OPENCLAW_ENABLED"
                    name="OPENCLAW_ENABLED"
                    checked={config.OPENCLAW_ENABLED === true}
                    onChange={handleInputChange}
                    label="启用 OpenClaw 外部委派"
                    description="开启后，自我反思动作可把外部系统查询/执行委派给 OpenClaw（OpenAI 兼容 Responses）。"
                />
                <div className="form-group">
                    <label htmlFor="OPENCLAW_BASE_URL">OpenClaw Base URL</label>
                    <input
                        type="url"
                        id="OPENCLAW_BASE_URL"
                        name="OPENCLAW_BASE_URL"
                        value={config.OPENCLAW_BASE_URL || ''}
                        onChange={handleInputChange}
                        placeholder="https://openclaw.example.com"
                        disabled={config.OPENCLAW_ENABLED !== true}
                    />
                    <small style={{ color: '#666', display: 'block', marginTop: '5px' }}>
                        示例：`https://openclaw.example.com`，后端会自动拼接 `/v1/responses`。
                    </small>
                </div>
                <div className="form-group">
                    <label htmlFor="OPENCLAW_TIMEOUT_MS">OpenClaw 超时（毫秒）</label>
                    <input
                        type="number"
                        id="OPENCLAW_TIMEOUT_MS"
                        name="OPENCLAW_TIMEOUT_MS"
                        value={config.OPENCLAW_TIMEOUT_MS || 600000}
                        onChange={handleInputChange}
                        min="1000"
                        step="1000"
                        disabled={config.OPENCLAW_ENABLED !== true}
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="OPENCLAW_API_KEY">OpenClaw API Key（写入后不回显）</label>
                    <input
                        type="password"
                        id="OPENCLAW_API_KEY"
                        name="OPENCLAW_API_KEY"
                        value={config.OPENCLAW_API_KEY || ''}
                        onChange={handleInputChange}
                        placeholder={config.OPENCLAW_API_KEY_CONFIGURED ? '已配置（如需更新请输入新 key）' : '输入新的 OpenClaw API Key'}
                        autoComplete="new-password"
                        disabled={config.OPENCLAW_ENABLED !== true}
                    />
                    <small style={{ color: '#666', display: 'block', marginTop: '5px' }}>
                        当前状态：{config.OPENCLAW_API_KEY_CONFIGURED ? '后端已配置 key' : '后端未配置 key'}。
                    </small>
                </div>
                <div className="form-group">
                    <label>
                        <input
                            type="checkbox"
                            name="OPENCLAW_CLEAR_API_KEY"
                            checked={config.OPENCLAW_CLEAR_API_KEY === true}
                            onChange={handleInputChange}
                            disabled={config.OPENCLAW_ENABLED !== true}
                        />
                        清除后端已保存的 OpenClaw API Key（仅当上方 key 输入为空时生效）
                    </label>
                </div>
            </div>

            <div className="form-section">
                <h2>主动询问</h2>
                <small style={{ color: '#666', display: 'block', marginBottom: '15px' }}>
                    Scheduled Messages 的 Outreach 模板和反思动作 `ask_external_user` 都由主动询问引擎推进。
                </small>
                <ToggleField
                    id="OUTREACH_ENABLED"
                    name="OUTREACH_ENABLED"
                    checked={config.OUTREACH_ENABLED === true}
                    onChange={handleInputChange}
                    label="启用主动询问引擎"
                    description="开启后，模板派发、等待回复、追问和升级才会真正运行。"
                />
                <div className="form-group">
                    <label htmlFor="OUTREACH_INTERVAL_MS">主动询问轮询间隔（毫秒）</label>
                    <input
                        type="number"
                        id="OUTREACH_INTERVAL_MS"
                        name="OUTREACH_INTERVAL_MS"
                        value={config.OUTREACH_INTERVAL_MS || 60000}
                        onChange={handleInputChange}
                        min="1000"
                        step="1000"
                        disabled={config.OUTREACH_ENABLED !== true}
                    />
                    <small style={{ color: '#666', display: 'block', marginTop: '5px' }}>
                        决定模板派发和回复轮询频率。开发调试时可临时调小，例如 5000。
                    </small>
                </div>
                <ToggleField
                    id="OUTREACH_REQUIRE_APPROVAL_FOR_REFLECTION"
                    name="OUTREACH_REQUIRE_APPROVAL_FOR_REFLECTION"
                    checked={config.OUTREACH_REQUIRE_APPROVAL_FOR_REFLECTION === true}
                    onChange={handleInputChange}
                    label="反思发起的主动询问默认先审批"
                    description="开启后，反思生成的外联会先进入待审批，不会直接发出。"
                    disabled={config.OUTREACH_ENABLED !== true}
                />
                <ToggleField
                    id="OUTREACH_REQUIRE_APPROVAL_FOR_MANUAL"
                    name="OUTREACH_REQUIRE_APPROVAL_FOR_MANUAL"
                    checked={config.OUTREACH_REQUIRE_APPROVAL_FOR_MANUAL === true}
                    onChange={handleInputChange}
                    label="手动/定时模板发起的主动询问默认先审批"
                    description="开启后，Scheduled Messages 里的手动模板也会进入待审批。"
                    disabled={config.OUTREACH_ENABLED !== true}
                />
                <div className="form-group">
                    <label htmlFor="RINGCENTRAL_SERVER_URL">RingCentral Server URL</label>
                    <input
                        type="url"
                        id="RINGCENTRAL_SERVER_URL"
                        name="RINGCENTRAL_SERVER_URL"
                        value={config.RINGCENTRAL_SERVER_URL || ''}
                        onChange={handleInputChange}
                        placeholder="https://platform.ringcentral.com"
                        disabled={config.OUTREACH_ENABLED !== true}
                    />
                    <small style={{ color: '#666', display: 'block', marginTop: '5px' }}>
                        还没有 RingCentral app？可前往
                        {' '}
                        <a
                            href="https://developer.ringcentral.com/"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            developer.ringcentral.com
                        </a>
                        {' '}
                        注册并创建应用，获取 Client ID / Secret / JWT。
                    </small>
                </div>
                <div className="form-group">
                    <label htmlFor="RINGCENTRAL_CLIENT_ID">RingCentral Client ID</label>
                    <input
                        type="text"
                        id="RINGCENTRAL_CLIENT_ID"
                        name="RINGCENTRAL_CLIENT_ID"
                        value={config.RINGCENTRAL_CLIENT_ID || ''}
                        onChange={handleInputChange}
                        placeholder="输入 RingCentral app client id"
                        disabled={config.OUTREACH_ENABLED !== true}
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="RINGCENTRAL_CLIENT_SECRET">RingCentral Client Secret（写入后不回显）</label>
                    <input
                        type="password"
                        id="RINGCENTRAL_CLIENT_SECRET"
                        name="RINGCENTRAL_CLIENT_SECRET"
                        value={config.RINGCENTRAL_CLIENT_SECRET || ''}
                        onChange={handleInputChange}
                        placeholder={config.RINGCENTRAL_CLIENT_SECRET_CONFIGURED ? '已配置（如需更新请输入新 secret）' : '输入新的 client secret'}
                        autoComplete="new-password"
                        disabled={config.OUTREACH_ENABLED !== true}
                    />
                    <small style={{ color: '#666', display: 'block', marginTop: '5px' }}>
                        当前状态：{config.RINGCENTRAL_CLIENT_SECRET_CONFIGURED ? '后端已配置 secret' : '后端未配置 secret'}。
                    </small>
                </div>
                <div className="form-group">
                    <label htmlFor="RINGCENTRAL_JWT">RingCentral JWT（写入后不回显）</label>
                    <textarea
                        id="RINGCENTRAL_JWT"
                        name="RINGCENTRAL_JWT"
                        value={config.RINGCENTRAL_JWT || ''}
                        onChange={handleInputChange}
                        placeholder={config.RINGCENTRAL_JWT_CONFIGURED ? '已配置（如需更新请输入新的 JWT）' : '输入新的 JWT'}
                        autoComplete="new-password"
                        rows={4}
                        disabled={config.OUTREACH_ENABLED !== true}
                    />
                    <small style={{ color: '#666', display: 'block', marginTop: '5px' }}>
                        当前状态：{config.RINGCENTRAL_JWT_CONFIGURED ? '后端已配置 JWT' : '后端未配置 JWT'}。
                    </small>
                </div>
                <div className="form-group">
                    <label>
                        <input
                            type="checkbox"
                            name="RINGCENTRAL_CLEAR_CLIENT_SECRET"
                            checked={config.RINGCENTRAL_CLEAR_CLIENT_SECRET === true}
                            onChange={handleInputChange}
                            disabled={config.OUTREACH_ENABLED !== true}
                        />
                        清除后端已保存的 RingCentral Client Secret（仅当上方 secret 输入为空时生效）
                    </label>
                </div>
                <div className="form-group">
                    <label>
                        <input
                            type="checkbox"
                            name="RINGCENTRAL_CLEAR_JWT"
                            checked={config.RINGCENTRAL_CLEAR_JWT === true}
                            onChange={handleInputChange}
                            disabled={config.OUTREACH_ENABLED !== true}
                        />
                        清除后端已保存的 RingCentral JWT（仅当上方 JWT 输入为空时生效）
                    </label>
                </div>
                <div className="form-group">
                    <label>RingCentral 目录缓存状态</label>
                    <div style={{
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        padding: '12px',
                        background: '#fafafa',
                    }}>
                        <div style={{ marginBottom: '8px' }}>
                            <strong>联系人目录：</strong>{formatOutreachDirectoryScopeStatus('users')}
                        </div>
                        <div style={{ marginBottom: '12px' }}>
                            <strong>群组目录：</strong>{formatOutreachDirectoryScopeStatus('teams')}
                        </div>
                        <button
                            type="button"
                            className="secondary-button"
                            onClick={handleRefreshOutreachDirectory}
                            disabled={config.OUTREACH_ENABLED !== true || outreachDirectoryRefreshing}
                        >
                            {outreachDirectoryRefreshing ? '刷新中...' : '立即刷新 RingCentral 目录'}
                        </button>
                        <small style={{ color: '#666', display: 'block', marginTop: '8px' }}>
                            开启主动询问后，系统会后台同步联系人和群组目录；搜索时会优先使用本地缓存，聊天链接 / chat ID 仍可实时解析。
                        </small>
                    </div>
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
