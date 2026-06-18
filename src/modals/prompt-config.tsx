/**
 * 提示词和用户上下文配置管理界面
 * 支持自定义提示词、用户信息、团队配置等
 */

import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { useState, useEffect, useMemo } from 'react';
import {
    sanitizeIndependentUserConfig,
    USER_CONFIG_CONTEXT_TEXT_CHAR_LIMIT,
    USER_CONFIG_PROMPT_CHAR_LIMIT
} from '../services/userConfigSanitizer';
import {
    buildIndependentUserConfigFootprint,
    buildIndependentUserConfigSummary,
    buildIndependentUserConfigPreview,
    buildPreferenceChangeImpact,
    buildPreferenceDraftPreviewReceipt,
    buildPreferenceInjectionReceipt,
    buildUserContextSectionReceipts,
    createConfigHistoryEntry,
    describeIndependentUserConfigChange,
    detectPromptImprovementHints,
    detectPromptRiskHints,
    detectUserContextSensitiveHints,
    isCustomPromptScopeInjectionEnabled,
    mergeConfigHistory,
    normalizeConfigHistoryEntries,
    USER_CONFIG_HISTORY_KEY,
    type ConfigHistoryEntry,
    type UserContextSensitiveHint,
    type UserContextSectionReceiptId,
    type UserContextPreferenceScope
} from '../services/userConfigPreview';

// 数据类型定义
interface CustomPrompts {
    message: {
        enabled: boolean;
        content: string;
        position: string;
    };
    project: {
        enabled: boolean;
        content: string;
        position: string;
    };
}

interface PersonalInfo {
    name: string;
    email: string;
    title: string;
    department: string;
    location: string;
    timezone: string;
}

interface Stakeholder {
    name: string;
    position: string;
    relationship: string;
    priority: string;
}

interface TeamMember {
    name: string;
    position: string;
    role: string;
    speciality: string;
}

interface UserContextConfig {
    personalInfo: PersonalInfo;
    stakeholders: {
        directManager: string;
        keyStakeholders: Stakeholder[];
        reportingFrequency: string;
    };
    teamInfo: {
        teamName: string;
        teamMission: string;
        teamSize: number;
        members: TeamMember[];
        workingHours: string;
        timezone: string;
    };
    workFocus: {
        primaryConcerns: string[];
        businessDomains: string[];
        keyMetrics: string[];
        riskTolerance: string;
    };
    communicationContext: {
        audienceType: string[];
        communicationStyle: string;
        culturalContext: string;
        languagePreference: string;
        reportingFormat: string;
    };
    analysisPreferences: {
        messageAnalysis: {
            focusAreas: string[];
            ignoredTopics: string[];
            urgencyKeywords: string[];
        };
        projectAnalysis: {
            riskFactors: string[];
            successCriteria: string[];
            reviewCycle: string;
        };
    };
    lastUpdated: number;
    version: string;
}

interface ConfigData {
    preferenceInjection: {
        enabled: boolean;
        customPromptsEnabled: boolean;
        messagePromptEnabled: boolean;
        projectPromptEnabled: boolean;
        userContextEnabled: boolean;
    };
    customPrompts: CustomPrompts;
    userContextConfig: UserContextConfig;
}

type TabType = 'prompts' | 'personal' | 'team' | 'work' | 'communication' | 'analysis';
type PromptScope = keyof CustomPrompts;
type CurrentUserInfo = { name: string; email: string };
type ConfigBaselineStatus = 'default' | 'local' | 'memory' | 'backed-up';
type PreviewCopyReceiptStatus = 'copied' | 'error';

interface ConfigBaselineReceipt {
    sourceLabel: string;
    savedAt: number;
    loadedAt: number;
    status: ConfigBaselineStatus;
}

interface PreviewCopyReceipt {
    status: PreviewCopyReceiptStatus;
    title: string;
    detail: string;
}

interface HistoryRestoreDraftReceipt {
    restoredAt: number;
    sourceSavedAt: number;
    sourceSummary: string;
    sourceChangeSummary: string;
}

const PROMPT_EXAMPLES: Record<PromptScope, Array<{ label: string; content: string }>> = {
    message: [
        {
            label: '风险升级',
            content: '优先识别客户升级、阻塞项、明确责任人和需要当天跟进的行动。'
        },
        {
            label: '低噪声',
            content: '忽略寒暄、重复确认和无行动价值的 FYI，除非它们包含截止时间或负责人。'
        },
        {
            label: '结论优先',
            content: '输出时先给结论，再列行动项、风险和需要我确认的问题。'
        }
    ],
    project: [
        {
            label: '依赖检查',
            content: '项目分析时优先检查跨团队依赖、外部阻塞和 owner 不清晰的事项。'
        },
        {
            label: '里程碑可信度',
            content: '评估里程碑时关注时间线是否有证据、风险是否被量化、缓冲是否足够。'
        },
        {
            label: '汇报格式',
            content: '用状态、风险、下一步、需要决策四段来组织项目分析结果。'
        }
    ]
};

const PREVIEW_SCOPE_OPTIONS: Array<{ value: UserContextPreferenceScope; label: string }> = [
    { value: 'all', label: '全部' },
    { value: 'message', label: '消息' },
    { value: 'project', label: '项目' }
];

const USER_CONTEXT_SECTION_TAB: Record<UserContextSectionReceiptId, TabType> = {
    personal: 'personal',
    team: 'team',
    work: 'work',
    communication: 'communication',
    analysis: 'analysis'
};

const getPreviewScopeLabel = (scope: UserContextPreferenceScope): string => (
    PREVIEW_SCOPE_OPTIONS.find((option) => option.value === scope)?.label || '全部'
);

const createDefaultConfig = (): ConfigData => ({
    preferenceInjection: {
        enabled: true,
        customPromptsEnabled: true,
        messagePromptEnabled: true,
        projectPromptEnabled: true,
        userContextEnabled: true
    },
    customPrompts: {
        message: {
            enabled: false,
            content: '',
            position: 'after_analysis_guide'
        },
        project: {
            enabled: false,
            content: '',
            position: 'after_analysis_guide'
        }
    },
    userContextConfig: {
        personalInfo: {
            name: '',
            email: '',
            title: '',
            department: '',
            location: '',
            timezone: 'GMT+8'
        },
        stakeholders: {
            directManager: '',
            keyStakeholders: [],
            reportingFrequency: '每周'
        },
        teamInfo: {
            teamName: '',
            teamMission: '',
            teamSize: 0,
            members: [],
            workingHours: '',
            timezone: 'GMT+8'
        },
        workFocus: {
            primaryConcerns: [],
            businessDomains: [],
            keyMetrics: [],
            riskTolerance: 'medium'
        },
        communicationContext: {
            audienceType: [],
            communicationStyle: '简洁直接',
            culturalContext: '',
            languagePreference: '中英文混合',
            reportingFormat: '项目状态报告'
        },
        analysisPreferences: {
            messageAnalysis: {
                focusAreas: [],
                ignoredTopics: [],
                urgencyKeywords: []
            },
            projectAnalysis: {
                riskFactors: [],
                successCriteria: [],
                reviewCycle: 'weekly'
            }
        },
        lastUpdated: 0,
        version: '1.0'
    }
});

const deepMerge = <T,>(base: T, override: any): T => {
    if (override === undefined || override === null) return base;
    if (Array.isArray(base) || Array.isArray(override)) return override as T;
    if (typeof base !== 'object' || typeof override !== 'object') return override as T;

    const merged: Record<string, any> = { ...(base as Record<string, any>) };
    Object.keys(override).forEach((key) => {
        merged[key] = deepMerge(merged[key], override[key]);
    });
    return merged as T;
};

const normalizeConfig = (config: any): ConfigData => {
    const source = config || {};
    return sanitizeIndependentUserConfig(deepMerge(createDefaultConfig(), {
        preferenceInjection: source.preferenceInjection || {},
        customPrompts: source.customPrompts || {},
        userContextConfig: source.userContextConfig || {}
    })) as ConfigData;
};

const getConfigTimestamp = (config: any): number => {
    const candidates = [
        config?.lastUpdated,
        config?.cloudSyncTime,
        config?.userContextConfig?.lastUpdated
    ];
    for (const candidate of candidates) {
        const value = Number(candidate);
        if (Number.isFinite(value) && value > 0) return value;
    }
    return 0;
};

const hasStoredConfig = (config: any): boolean => (
    Boolean(config?.preferenceInjection || config?.customPrompts || config?.userContextConfig)
);

const isUsableIdentityValue = (value: string): boolean => (
    Boolean(value && !value.startsWith('未知'))
);

const formatHistoryTimestamp = (timestamp: number): string => (
    new Intl.DateTimeFormat('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    }).format(new Date(timestamp))
);

const formatBaselineTimestamp = (timestamp: number): string => (
    timestamp > 0 ? formatHistoryTimestamp(timestamp) : '暂无保存时间'
);

const createBaselineReceipt = (
    sourceLabel: string,
    status: ConfigBaselineStatus,
    savedAt = 0
): ConfigBaselineReceipt => ({
    sourceLabel,
    savedAt,
    loadedAt: Date.now(),
    status
});

const getBaselineBoundary = (receipt: ConfigBaselineReceipt): string => {
    if (receipt.status === 'backed-up') {
        return '本机已保存，记忆服务已有恢复备份；真实分析读取这份已保存配置。';
    }
    if (receipt.status === 'memory') {
        return '已从记忆服务备份恢复到本机；真实分析读取这份已保存配置。';
    }
    if (receipt.status === 'local') {
        return '真实分析读取本机配置；记忆服务备份不可用、未恢复或不是最新。';
    }
    return '当前是默认配置；保存前不会写入本机或记忆服务。';
};

const copyTextToClipboard = async (text: string): Promise<boolean> => {
    if (!text) return false;

    if (navigator.clipboard?.writeText) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (error) {
            console.warn('navigator.clipboard 写入失败，尝试降级复制:', error);
        }
    }

    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.setAttribute('readonly', 'true');
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    document.body.appendChild(textArea);
    textArea.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(textArea);
    return copied;
};

const mergeIdentityFallback = (
    config: ConfigData,
    userInfo: CurrentUserInfo
): ConfigData => ({
    ...config,
    userContextConfig: {
        ...config.userContextConfig,
        personalInfo: {
            ...config.userContextConfig.personalInfo,
            name: config.userContextConfig.personalInfo.name ||
                (isUsableIdentityValue(userInfo.name) ? userInfo.name : ''),
            email: config.userContextConfig.personalInfo.email ||
                (isUsableIdentityValue(userInfo.email) ? userInfo.email : '')
        }
    }
});

const createEmptyStakeholder = (): Stakeholder => ({
    name: '',
    position: '',
    relationship: '',
    priority: 'medium'
});

const createEmptyTeamMember = (): TeamMember => ({
    name: '',
    position: '',
    role: '',
    speciality: ''
});

const PromptConfig: React.FC = () => {
    const [activeTab, setActiveTab] = useState<TabType>('prompts');
    const [statusMessage, setStatusMessage] = useState('');
    const [statusType, setStatusType] = useState<'success' | 'error' | ''>('');
    const [currentUserInfo, setCurrentUserInfo] = useState({ name: '', email: '' });
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [syncSource, setSyncSource] = useState('');
    const [baselineReceipt, setBaselineReceipt] = useState<ConfigBaselineReceipt>(
        () => createBaselineReceipt('默认配置', 'default')
    );
    const [configData, setConfigData] = useState<ConfigData>(createDefaultConfig);
    const [lastPersistedConfig, setLastPersistedConfig] = useState<ConfigData | null>(null);
    const [configHistory, setConfigHistory] = useState<ConfigHistoryEntry[]>([]);
    const [promptRiskAcknowledgedKey, setPromptRiskAcknowledgedKey] = useState('');
    const [userContextSensitiveAcknowledgedKey, setUserContextSensitiveAcknowledgedKey] = useState('');
    const [previewScope, setPreviewScope] = useState<UserContextPreferenceScope>('all');
    const [previewCopyReceipt, setPreviewCopyReceipt] = useState<PreviewCopyReceipt | null>(null);
    const [historyRestoreReceipt, setHistoryRestoreReceipt] =
        useState<HistoryRestoreDraftReceipt | null>(null);
    const injectedPreview = useMemo(
        () => buildIndependentUserConfigPreview(configData, {
            userContextScope: previewScope
        }),
        [configData, previewScope]
    );
    const preferenceFootprint = useMemo(
        () => buildIndependentUserConfigFootprint(configData, {
            userContextScope: previewScope
        }),
        [configData, previewScope]
    );
    const preferenceReceipt = useMemo(
        () => buildPreferenceInjectionReceipt(configData, {
            userContextScope: previewScope
        }),
        [configData, previewScope]
    );
    const userContextSectionReceipts = useMemo(
        () => buildUserContextSectionReceipts(configData, {
            previewScope
        }),
        [configData, previewScope]
    );
    const preferenceChangeImpact = useMemo(
        () => hasUnsavedChanges
            ? buildPreferenceChangeImpact(lastPersistedConfig, configData, {
                userContextScope: previewScope
            })
            : null,
        [configData, hasUnsavedChanges, lastPersistedConfig, previewScope]
    );
    const draftPreviewReceipt = useMemo(
        () => buildPreferenceDraftPreviewReceipt(lastPersistedConfig, configData, {
            hasUnsavedChanges,
            userContextScope: previewScope
        }),
        [configData, hasUnsavedChanges, lastPersistedConfig, previewScope]
    );
    const configSummary = useMemo(
        () => buildIndependentUserConfigSummary(configData),
        [configData]
    );
    const promptRiskHints = useMemo(
        () => detectPromptRiskHints(configData),
        [configData]
    );
    const activePromptRiskHints = useMemo(
        () => promptRiskHints.filter((hint) =>
            isCustomPromptScopeInjectionEnabled(configData, hint.scope)
        ),
        [configData, promptRiskHints]
    );
    const promptImprovementHints = useMemo(
        () => detectPromptImprovementHints(configData),
        [configData]
    );
    const userContextSensitiveHints = useMemo(
        () => detectUserContextSensitiveHints(configData),
        [configData]
    );
    const userContextSensitiveHintsBySection = useMemo(() => (
        userContextSensitiveHints.reduce((result, hint) => {
            result[hint.section] = [...(result[hint.section] || []), hint];
            return result;
        }, {} as Partial<Record<UserContextSectionReceiptId, UserContextSensitiveHint[]>>)
    ), [userContextSensitiveHints]);
    const promptRiskAcknowledgementKey = useMemo(() => {
        if (activePromptRiskHints.length === 0) return '';
        const riskyPromptContents = activePromptRiskHints.map((hint) => ({
            scope: hint.scope,
            content: configData.customPrompts[hint.scope]?.content || ''
        }));
        return JSON.stringify({
            hints: activePromptRiskHints,
            promptContents: riskyPromptContents
        });
    }, [activePromptRiskHints, configData.customPrompts]);
    const userContextSensitiveAcknowledgementKey = useMemo(() => {
        if (userContextSensitiveHints.length === 0) return '';
        return JSON.stringify(userContextSensitiveHints.map((hint) => hint.fingerprint));
    }, [userContextSensitiveHints]);
    const hasUnacknowledgedPromptRisk = (
        activePromptRiskHints.length > 0 &&
        promptRiskAcknowledgedKey !== promptRiskAcknowledgementKey
    );
    const hasUnacknowledgedUserContextSensitiveHint = (
        userContextSensitiveHints.length > 0 &&
        userContextSensitiveAcknowledgedKey !== userContextSensitiveAcknowledgementKey
    );
    const hasUnacknowledgedSafetyHint = (
        hasUnacknowledgedPromptRisk || hasUnacknowledgedUserContextSensitiveHint
    );
    const pendingChangeDescription = useMemo(() => {
        if (!hasUnsavedChanges) return null;
        return describeIndependentUserConfigChange(lastPersistedConfig, configData);
    }, [configData, hasUnsavedChanges, lastPersistedConfig]);
    const pendingChangeSummary = useMemo(() => {
        if (!pendingChangeDescription) return '';
        return pendingChangeDescription.changedLabels.length > 0
            ? `未保存变更：${pendingChangeDescription.changedLabels.join('、')}`
            : '未保存变更：无实质变化';
    }, [pendingChangeDescription]);

    useEffect(() => {
        initializeConfigPage();
    }, []);

    useEffect(() => {
        setPreviewCopyReceipt(null);
    }, [hasUnsavedChanges, injectedPreview, previewScope]);

    const initializeConfigPage = async () => {
        const userInfo = await loadCurrentUserInfo();
        await Promise.all([
            loadFromStorage(userInfo),
            loadConfigHistoryFromStorage()
        ]);
    };

    const loadCurrentUserInfo = async (): Promise<CurrentUserInfo> => {
        let nextUserInfo: CurrentUserInfo = { name: '', email: '' };
        try {
            const { userinfo } = await chrome.storage.local.get('userinfo');
            if (userinfo) {
                const displayName = userinfo.fullName || userinfo.username || '未知用户';
                const displayEmail = userinfo.userEmail || '未知邮箱';
                nextUserInfo = { name: displayName, email: displayEmail };
                
                setCurrentUserInfo(nextUserInfo);
                
                // 更新配置数据中的基本信息
                setConfigData(prev => mergeIdentityFallback(prev, nextUserInfo));
            }
        } catch (error) {
            console.error('加载用户信息失败:', error);
        }
        return nextUserInfo;
    };

    const loadConfigHistoryFromStorage = async () => {
        try {
            const result = await chrome.storage.local.get(USER_CONFIG_HISTORY_KEY);
            setConfigHistory(
                normalizeConfigHistoryEntries(result?.[USER_CONFIG_HISTORY_KEY])
            );
        } catch (error) {
            console.warn('加载配置版本历史失败:', error);
            setConfigHistory([]);
        }
    };

	const loadFromStorage = async (identityFallback: CurrentUserInfo = currentUserInfo) => {
	    setIsLoading(true);
	    try {
            const localResult = await chrome.storage.local.get([
                'preferenceInjection',
                'customPrompts',
                'userContextConfig',
                'cloudSyncTime'
            ]);
            let nextConfig = normalizeConfig(localResult);
            let sourceLabel = hasStoredConfig(localResult) ? '本机配置' : '默认配置';
            let sourceStatus: ConfigBaselineStatus = hasStoredConfig(localResult)
                ? 'local'
                : 'default';
            let sourceSavedAt = getConfigTimestamp(localResult);

            try {
                const cloudResponse = await chrome.runtime.sendMessage({
                    type: 'GET_INDEPENDENT_USER_CONFIG'
                });

                if (cloudResponse?.success && hasStoredConfig(cloudResponse.data)) {
                    const cloudConfig = normalizeConfig(cloudResponse.data);
                    const shouldUseCloud =
                        !hasStoredConfig(localResult) ||
                        getConfigTimestamp(cloudResponse.data) >= getConfigTimestamp(localResult);

                    if (shouldUseCloud) {
                        nextConfig = cloudConfig;
                        sourceLabel = '记忆服务备份';
                        sourceStatus = 'memory';
                        sourceSavedAt = getConfigTimestamp(cloudResponse.data);
                        await chrome.storage.local.set({
                            preferenceInjection: cloudConfig.preferenceInjection,
                            customPrompts: cloudConfig.customPrompts,
                            userContextConfig: cloudConfig.userContextConfig,
                            cloudSyncTime: Date.now()
                        });
                    }
                }
            } catch (cloudError) {
                console.warn('记忆服务配置读取失败，继续使用本机配置:', cloudError);
            }

            const displayConfig = mergeIdentityFallback(nextConfig, identityFallback);
            setConfigData(displayConfig);
            setLastPersistedConfig(displayConfig);
            setHasUnsavedChanges(false);
            setSyncSource(sourceLabel);
            setBaselineReceipt(createBaselineReceipt(
                sourceLabel,
                sourceStatus,
                sourceSavedAt
            ));
            setHistoryRestoreReceipt(null);
            showStatusMessage(`已加载${sourceLabel}`, 'success');
        } catch (error) {
            console.error('加载配置失败:', error);
            showStatusMessage('加载配置失败: ' + error.message, 'error');
        } finally {
	        setIsLoading(false);
	    }
	};

	const reloadFromStorage = () => {
	    if (
	        hasUnsavedChanges &&
	        !confirm('当前有未保存修改，重新加载会丢弃这些修改。继续重新加载？')
	    ) {
	        return;
	    }
	    loadFromStorage(currentUserInfo);
	};

	// 🆕 数据迁移：从本地存储迁移到云端
	const _migrateFromLocalToCloud = async () => {
        try {
            const result = await chrome.storage.local.get(['preferenceInjection', 'customPrompts', 'userContextConfig']);
            
            if (result.preferenceInjection || result.customPrompts || result.userContextConfig) {
                console.log('发现本地配置，开始迁移到云端...');
                
                const localConfig = {
                    preferenceInjection: result.preferenceInjection || {},
                    customPrompts: result.customPrompts || {},
                    userContextConfig: result.userContextConfig || {}
                };
                
                // 保存到云端
                const migrateResponse = await chrome.runtime.sendMessage({
                    type: 'STORE_INDEPENDENT_USER_CONFIG',
                    config: localConfig
                });
                
                if (migrateResponse && migrateResponse.success) {
                    console.log('配置迁移到云端成功');
                    
                    // 加载迁移后的配置到界面
                    setConfigData(prev => ({
                        preferenceInjection: {
                            ...prev.preferenceInjection,
                            ...localConfig.preferenceInjection
                        },
                        customPrompts: { ...prev.customPrompts, ...localConfig.customPrompts },
                        userContextConfig: { ...prev.userContextConfig, ...localConfig.userContextConfig }
                    }));
                    
                    // 删除本地配置（可选）
                    try {
                        await chrome.storage.local.remove(['preferenceInjection', 'customPrompts', 'userContextConfig']);
                        console.log('本地配置已清理');
                    } catch (cleanupError) {
                        console.warn('清理本地配置失败:', cleanupError);
                    }
                    
                    showStatusMessage('配置已迁移到云端', 'success');
                } else {
                    throw new Error(migrateResponse?.error || '迁移失败');
                }
            } else {
                console.log('未发现本地配置，使用默认配置');
                showStatusMessage('使用默认配置', 'success');
            }
        } catch (error) {
            console.error('数据迁移失败:', error);
            showStatusMessage('数据迁移失败: ' + error.message, 'error');
        }
    };

	const validateConfiguration = (): boolean => {
        const messagePromptContent = configData.customPrompts.message.content.trim();
        const projectPromptContent = configData.customPrompts.project.content.trim();

	    if (
	        configData.customPrompts.message.enabled &&
	        !messagePromptContent
	    ) {
	            showStatusMessage('消息分析提示词为空，已启用时需要填写内容', 'error');
	            setActiveTab('prompts');
	            return false;
	        }

        if (messagePromptContent.length > USER_CONFIG_PROMPT_CHAR_LIMIT) {
            showStatusMessage(`消息分析提示词不能超过 ${USER_CONFIG_PROMPT_CHAR_LIMIT} 字符`, 'error');
            setActiveTab('prompts');
            return false;
        }

	        if (
            configData.customPrompts.project.enabled &&
            !projectPromptContent
        ) {
            showStatusMessage('项目分析提示词为空，已启用时需要填写内容', 'error');
            setActiveTab('prompts');
            return false;
        }

        if (projectPromptContent.length > USER_CONFIG_PROMPT_CHAR_LIMIT) {
            showStatusMessage(`项目分析提示词不能超过 ${USER_CONFIG_PROMPT_CHAR_LIMIT} 字符`, 'error');
            setActiveTab('prompts');
            return false;
        }

        if (hasUnacknowledgedPromptRisk) {
            showStatusMessage('检测到安全提示，请先确认这些语句只作为低优先级偏好保存', 'error');
            setActiveTab('prompts');
            return false;
        }

        if (hasUnacknowledgedUserContextSensitiveHint) {
            showStatusMessage('检测到用户上下文敏感提示，请先确认不会把可用凭据写入长期配置', 'error');
            setActiveTab(
                USER_CONTEXT_SECTION_TAB[userContextSensitiveHints[0]?.section] || 'analysis'
            );
            return false;
        }

	    return true;
	};

	const persistConfiguration = async (): Promise<ConfigData | null> => {
	    if (!validateConfiguration()) return null;

        const savedAt = Date.now();
	        const updatedConfig = sanitizeIndependentUserConfig({
                preferenceInjection: configData.preferenceInjection,
		        customPrompts: configData.customPrompts,
		        userContextConfig: {
	            ...configData.userContextConfig,
	            lastUpdated: savedAt,
	            version: '1.0'
	        }
	    }) as ConfigData;
        const historyResult = await chrome.storage.local.get(USER_CONFIG_HISTORY_KEY);
        const normalizedHistory = normalizeConfigHistoryEntries(
            historyResult?.[USER_CONFIG_HISTORY_KEY]
        );
        const nextHistory = mergeConfigHistory(
            normalizedHistory,
            createConfigHistoryEntry(updatedConfig, savedAt, normalizedHistory[0]?.config)
        );

		    await chrome.storage.local.set({
                preferenceInjection: updatedConfig.preferenceInjection,
		        customPrompts: updatedConfig.customPrompts,
	        userContextConfig: updatedConfig.userContextConfig,
	        cloudSyncTime: savedAt,
            [USER_CONFIG_HISTORY_KEY]: nextHistory
	    });

	    setConfigData(updatedConfig);
        setLastPersistedConfig(updatedConfig);
        setConfigHistory(nextHistory);
	    setHasUnsavedChanges(false);
        setHistoryRestoreReceipt(null);

	    try {
	        const response = await chrome.runtime.sendMessage({
	            type: 'STORE_INDEPENDENT_USER_CONFIG',
	            config: updatedConfig
	        });

	        if (!response?.success) {
	            throw new Error(response?.error || '记忆服务备份失败');
	        }

	        setSyncSource('本机配置 + 记忆服务备份');
            setBaselineReceipt(createBaselineReceipt(
                '本机配置 + 记忆服务备份',
                'backed-up',
                savedAt
            ));
	        showStatusMessage('配置已保存，并已备份到记忆服务', 'success');
	    } catch (cloudError) {
	        console.warn('记忆服务备份失败，本机配置已保存:', cloudError);
	        setSyncSource('本机配置');
            setBaselineReceipt(createBaselineReceipt('本机配置', 'local', savedAt));
	        showStatusMessage('配置已保存到本机，记忆服务备份暂不可用', 'success');
	    }

	    return updatedConfig;
	};

	const saveConfiguration = async () => {
	    setIsSaving(true);
	    try {
	        await persistConfiguration();
	    } catch (error) {
	        console.error('保存配置失败:', error);
	        showStatusMessage('保存配置失败: ' + error.message, 'error');
	    } finally {
	        setIsSaving(false);
	    }
	};

    // 🆕 触发数据融合到用户画像
	const triggerDataFusion = async () => {
	    setIsSaving(true);
	    try {
            if (!validateConfiguration()) return;

	        let configForFusion = configData;
	        if (hasUnsavedChanges) {
	            const savedConfig = await persistConfiguration();
	            if (!savedConfig) return;
	            configForFusion = savedConfig;
	        }

	        console.log('开始将配置融合到用户画像...');
	        showStatusMessage('正在融合配置到用户画像...', 'success');

	        const response = await chrome.runtime.sendMessage({
	            type: 'FUSE_USER_CONTEXT_CONFIG',
	            userContextConfig: configForFusion.userContextConfig
	        });
            
            if (response && response.success) {
                console.log('配置融合成功:', response.data);
                showStatusMessage('配置已成功融合到用户画像', 'success');
                
                // 显示融合结果
                if (response.data && response.data.fusedProfile) {
                    console.log('融合后的用户画像:', response.data.fusedProfile);
                    
                    const message = `
✅ 数据融合完成！

显式偏好已整合到用户画像中：
• 个人信息已融合
• 工作上下文已融合
• 沟通偏好已融合

系统将基于这些显式输入与行为学习进行智能推荐。
                    `.trim();
                    
                    alert(message);
                }
            } else {
                throw new Error(response?.error || '融合失败');
            }
	    } catch (error) {
	        console.error('数据融合失败:', error);
	        showStatusMessage('数据融合失败: ' + error.message, 'error');
	    } finally {
	        setIsSaving(false);
	    }
	};

    const resetToDefaults = () => {
        if (confirm('确定要重置所有配置为默认值吗？此操作不可撤销。')) {
            const savedUserInfo = {
                name: configData.userContextConfig.personalInfo.name,
                email: configData.userContextConfig.personalInfo.email
            };

            const nextConfig = createDefaultConfig();
            nextConfig.userContextConfig.personalInfo.name = savedUserInfo.name;
            nextConfig.userContextConfig.personalInfo.email = savedUserInfo.email;
            nextConfig.userContextConfig.lastUpdated = Date.now();

            setConfigData(nextConfig);
            setHasUnsavedChanges(true);
            setHistoryRestoreReceipt(null);
            showStatusMessage('配置已重置，保存后生效', 'success');
        }
    };

    const restoreHistoryEntry = (entry: ConfigHistoryEntry) => {
        if (
            hasUnsavedChanges &&
            !confirm('当前有未保存修改，恢复历史版本会覆盖页面上的修改。继续恢复？')
        ) {
            return;
        }

        setConfigData(normalizeConfig(entry.config));
        setHasUnsavedChanges(true);
        setHistoryRestoreReceipt({
            restoredAt: Date.now(),
            sourceSavedAt: entry.savedAt,
            sourceSummary: entry.summary,
            sourceChangeSummary: entry.changeSummary || ''
        });
        setSyncSource(`已恢复 ${formatHistoryTimestamp(entry.savedAt)} 的历史版本`);
        showStatusMessage('已恢复历史版本，保存后生效', 'success');
    };

    const showStatusMessage = (message: string, type: 'success' | 'error') => {
        setStatusMessage(message);
        setStatusType(type);
        setTimeout(() => {
            setStatusMessage('');
            setStatusType('');
        }, 3000);
    };

    const copyEffectPreview = async () => {
        const scopeLabel = getPreviewScopeLabel(previewScope);
        const previewStateLabel = draftPreviewReceipt.status === 'active'
            ? '已保存基线'
            : '未保存草稿';

        try {
            const copied = await copyTextToClipboard(injectedPreview);
            if (!copied) {
                throw new Error('浏览器未允许写入剪贴板');
            }

            setPreviewCopyReceipt({
                status: 'copied',
                title: `已复制${scopeLabel}预览`,
                detail: `${previewStateLabel}的清洗后注入文本已复制；这只是审计文本，不会保存配置、不会触发真实分析、不会写入或备份到记忆服务。`
            });
        } catch (error) {
            console.warn('复制生效预览失败:', error);
            setPreviewCopyReceipt({
                status: 'error',
                title: `未能复制${scopeLabel}预览`,
                detail: '浏览器剪贴板不可用；请手动选择生效预览文本复制，当前页面不会自动保存或触发分析。'
            });
        }
    };

	const updateConfigAtPath = (
	    path: string,
	    updater: any | ((currentValue: any) => any)
		) => {
		    const keys = path.split('.');
		    setHasUnsavedChanges(true);
            setHistoryRestoreReceipt(null);
		    setConfigData(prev => {
	        const newConfig: any = { ...prev };
	        let currentNew = newConfig;
	        let currentOld: any = prev;

	        for (let i = 0; i < keys.length - 1; i++) {
	            const key = keys[i];
	            const oldChild = currentOld?.[key];
	            currentNew[key] = Array.isArray(oldChild)
	                ? [...oldChild]
	                : { ...(oldChild || {}) };
	            currentNew = currentNew[key];
	            currentOld = oldChild;
	        }

	        const lastKey = keys[keys.length - 1];
	        const currentValue = currentNew[lastKey];
	        currentNew[lastKey] =
	            typeof updater === 'function' ? updater(currentValue) : updater;
	        return newConfig as ConfigData;
	    });
	};

	const addToArray = (path: string, value: any = '') => {
	    updateConfigAtPath(path, (items: any[]) => (
	        Array.isArray(items) ? [...items, value] : [value]
	    ));
	};

	const removeFromArray = (path: string, index: number) => {
	    updateConfigAtPath(path, (items: any[]) => (
	        Array.isArray(items) ? items.filter((_: any, i: number) => i !== index) : []
	    ));
	};

	const updateValue = (path: string, value: any) => {
	    updateConfigAtPath(path, value);
	};

    const appendPromptExample = (scope: PromptScope, content: string) => {
        const currentContent = configData.customPrompts[scope].content.trim();
        const nextContent = currentContent
            ? `${currentContent}\n\n${content}`
            : content;

        if (nextContent.length > USER_CONFIG_PROMPT_CHAR_LIMIT) {
            showStatusMessage(
                `插入后会超过 ${USER_CONFIG_PROMPT_CHAR_LIMIT} 字符，请先删减现有内容`,
                'error'
            );
            return;
        }

        updateConfigAtPath(`customPrompts.${scope}`, (prompt: CustomPrompts[PromptScope]) => ({
            ...prompt,
            enabled: true,
            content: nextContent,
            position: prompt?.position || 'after_analysis_guide'
        }));
    };

    const getPromptMetaClass = (content: string) => (
        content.length > USER_CONFIG_PROMPT_CHAR_LIMIT * 0.9
            ? 'field-meta warning'
            : 'field-meta'
    );

    const renderConfigSummary = () => (
        <div
            className={`config-summary-strip ${configSummary.riskHintCount > 0 ? 'has-warning' : ''}`}
            aria-live="polite"
        >
            <button
                type="button"
                className="summary-item"
                onClick={() => setActiveTab('prompts')}
            >
                <span>提示词</span>
                <strong>
                    {configSummary.enabledPromptLabels.length > 0
                        ? configSummary.enabledPromptLabels.join('、')
                        : '未启用'}
                </strong>
            </button>
            <button
                type="button"
                className="summary-item"
                onClick={() => setActiveTab('analysis')}
            >
                <span>上下文信号</span>
                <strong>{configSummary.contextSignalCount} 项</strong>
            </button>
            <button
                type="button"
                className="summary-item"
                onClick={() => setActiveTab('prompts')}
            >
                <span>安全提示</span>
                <strong>{configSummary.riskHintCount} 条</strong>
            </button>
            <div className="summary-item passive">
                <span>本机历史</span>
                <strong>{configHistory.length} 版</strong>
            </div>
        </div>
    );

    const renderInjectionControl = () => (
        <div className={`injection-control-row ${configSummary.preferenceInjectionEnabled ? '' : 'paused'}`}>
            <div className="injection-main-control">
                <label className="injection-toggle">
                    <input
                        type="checkbox"
                        checked={configData.preferenceInjection.enabled}
                        onChange={(e) => updateValue('preferenceInjection.enabled', e.target.checked)}
                    />
                    <span>参与分析注入</span>
                </label>
                <strong>{configSummary.preferenceInjectionEnabled ? '开启' : '暂停'}</strong>
            </div>
            <div className="injection-source-controls" aria-label="偏好来源开关">
                <label className="source-toggle">
                    <input
                        type="checkbox"
                        checked={configData.preferenceInjection.customPromptsEnabled}
                        disabled={!configData.preferenceInjection.enabled}
                        onChange={(e) => updateValue('preferenceInjection.customPromptsEnabled', e.target.checked)}
                    />
                    <span>自定义提示词</span>
                </label>
                <label className="source-toggle scope-toggle">
                    <input
                        type="checkbox"
                        checked={configData.preferenceInjection.messagePromptEnabled}
                        disabled={
                            !configData.preferenceInjection.enabled ||
                            !configData.preferenceInjection.customPromptsEnabled
                        }
                        onChange={(e) => updateValue('preferenceInjection.messagePromptEnabled', e.target.checked)}
                    />
                    <span>消息提示词</span>
                </label>
                <label className="source-toggle scope-toggle">
                    <input
                        type="checkbox"
                        checked={configData.preferenceInjection.projectPromptEnabled}
                        disabled={
                            !configData.preferenceInjection.enabled ||
                            !configData.preferenceInjection.customPromptsEnabled
                        }
                        onChange={(e) => updateValue('preferenceInjection.projectPromptEnabled', e.target.checked)}
                    />
                    <span>项目提示词</span>
                </label>
                <label className="source-toggle">
                    <input
                        type="checkbox"
                        checked={configData.preferenceInjection.userContextEnabled}
                        disabled={!configData.preferenceInjection.enabled}
                        onChange={(e) => updateValue('preferenceInjection.userContextEnabled', e.target.checked)}
                    />
                    <span>用户上下文</span>
                </label>
            </div>
        </div>
    );

    const renderBaselineReceipt = () => (
        <div className={`baseline-receipt ${baselineReceipt.status}`}>
            <span>已生效基线</span>
            <strong>{baselineReceipt.sourceLabel}</strong>
            <small>
                保存时间：{formatBaselineTimestamp(baselineReceipt.savedAt)}；本轮加载：{formatBaselineTimestamp(baselineReceipt.loadedAt)}。
                {getBaselineBoundary(baselineReceipt)}
            </small>
            {hasUnsavedChanges && (
                <small className="baseline-draft-note">
                    页面有未保存草稿，真实消息、项目、会议和文档分析仍读取这份已保存基线。
                </small>
            )}
        </div>
    );

    const renderHistoryRestoreReceipt = () => {
        if (!historyRestoreReceipt || !hasUnsavedChanges) return null;
        const scopeLabel = getPreviewScopeLabel(previewScope);

        return (
            <div
                className="history-restore-receipt"
                role="status"
                aria-live="polite"
            >
                <span>恢复草稿</span>
                <strong>
                    已载入 {formatHistoryTimestamp(historyRestoreReceipt.sourceSavedAt)} 的历史版本
                </strong>
                <small>
                    来源摘要：{historyRestoreReceipt.sourceSummary}。
                    {historyRestoreReceipt.sourceChangeSummary
                        ? `历史变更：${historyRestoreReceipt.sourceChangeSummary}。`
                        : ''}
                    本轮恢复：{formatHistoryTimestamp(historyRestoreReceipt.restoredAt)}；当前{scopeLabel}预览显示这份恢复草稿；真实分析仍读取上方已生效基线。点击保存后才会写入本机并尝试备份到记忆服务。
                </small>
            </div>
        );
    };

	const updateStakeholder = (index: number, key: keyof Stakeholder, value: string) => {
	    updateConfigAtPath(
	        'userContextConfig.stakeholders.keyStakeholders',
	        (items: Stakeholder[]) => (Array.isArray(items) ? items : []).map((item, i) => (
	            i === index ? { ...item, [key]: value } : item
	        ))
	    );
	};

	const updateTeamMember = (index: number, key: keyof TeamMember, value: string) => {
	    updateConfigAtPath(
	        'userContextConfig.teamInfo.members',
	        (items: TeamMember[]) => (Array.isArray(items) ? items : []).map((item, i) => (
	            i === index ? { ...item, [key]: value } : item
	        ))
	    );
	};

    const renderArrayField = (label: string, path: string, items: string[]) => (
        <div className="field-group">
            <label>{label}</label>
            <div className="array-field">
                {items.map((item, index) => (
                    <div key={index} className="array-item">
                        <input
                            type="text"
                            value={item}
                            maxLength={USER_CONFIG_CONTEXT_TEXT_CHAR_LIMIT}
                            onChange={(e) => {
                                const newItems = [...items];
                                newItems[index] = e.target.value;
                                updateValue(path, newItems);
                            }}
                            placeholder={`${label} ${index + 1}`}
                        />
                        <button 
                            type="button"
                            onClick={() => removeFromArray(path, index)}
                            className="remove-btn"
                        >
                            删除
                        </button>
                    </div>
                ))}
                <button 
                    type="button"
                    onClick={() => addToArray(path)}
                    className="add-btn"
                >
                    添加{label}
                </button>
            </div>
        </div>
    );

    const renderPromptEditor = (
        scope: PromptScope,
        title: string,
        placeholder: string
    ) => {
        const prompt = configData.customPrompts[scope];
        const scopeInjectionEnabled = isCustomPromptScopeInjectionEnabled(configData, scope);
        const scopedRiskHints = promptRiskHints.filter((hint) => hint.scope === scope);
        const scopedImprovementHints = promptImprovementHints.filter((hint) => hint.scope === scope);

        return (
            <div className="prompt-scope-section">
                <div className="field-group">
                    <label className="prompt-toggle">
                        <input
                            type="checkbox"
                            checked={prompt.enabled}
                            onChange={(e) => updateValue(`customPrompts.${scope}.enabled`, e.target.checked)}
                        />
                        <span>启用{title}自定义提示词</span>
                    </label>
                    {prompt.enabled && (
                        <>
                            <textarea
                                value={prompt.content}
                                onChange={(e) => updateValue(`customPrompts.${scope}.content`, e.target.value)}
                                placeholder={placeholder}
                                rows={4}
                                maxLength={USER_CONFIG_PROMPT_CHAR_LIMIT}
                            />
                            <div className={getPromptMetaClass(prompt.content)}>
                                {prompt.content.length}/{USER_CONFIG_PROMPT_CHAR_LIMIT}
                            </div>
                        </>
                    )}
                </div>

                {((prompt.enabled && !scopeInjectionEnabled) ||
                    scopedRiskHints.length > 0 ||
                    scopedImprovementHints.length > 0) && (
                    <div className="prompt-inline-hints" role="status">
                        {prompt.enabled && !scopeInjectionEnabled && (
                            <div className="prompt-inline-hint muted">
                                <strong>已暂停</strong>
                                <span>{title}内容会保留，但当前不会进入分析注入。</span>
                            </div>
                        )}
                        {scopedRiskHints.map((hint, index) => (
                            <div
                                key={`risk-${scope}-${index}`}
                                className="prompt-inline-hint warning"
                            >
                                <strong>安全提示</strong>
                                <span>{hint.message}</span>
                            </div>
                        ))}
                        {scopedImprovementHints.map((hint, index) => (
                            <div
                                key={`improve-${scope}-${index}`}
                                className="prompt-inline-hint suggestion"
                            >
                                <strong>优化建议</strong>
                                <span>{hint.message}</span>
                            </div>
                        ))}
                    </div>
                )}

                <div className="prompt-example-row" aria-label={`${title}提示词示例`}>
                    <span>快速插入</span>
                    {PROMPT_EXAMPLES[scope].map((example) => (
                        <button
                            key={example.label}
                            type="button"
                            className="example-chip"
                            onClick={() => appendPromptExample(scope, example.content)}
                        >
                            {example.label}
                        </button>
                    ))}
                </div>
                <div className="prompt-scope-note">
                    <strong>作用范围</strong>
                    <span>
                        {scope === 'message'
                            ? '消息重要性判断、规则匹配、行动建议'
                            : '项目、会议、文档和通用内容分析'}
                    </span>
                </div>
            </div>
        );
    };

    const renderEffectPreview = () => (
        <div className="effect-preview-section">
            <div className="section-title-row">
                <div className="preview-title-group">
                    <h4>生效预览</h4>
                    <div className="preview-scope-switch" aria-label="预览注入范围">
                        {PREVIEW_SCOPE_OPTIONS.map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                className={previewScope === option.value ? 'active' : ''}
                                onClick={() => setPreviewScope(option.value)}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="preview-meta-actions">
                    <span>
                        {preferenceFootprint.previewCharCount > 0
                            ? `清洗后 · ${preferenceFootprint.previewCharCount} 字符 · 约 ${preferenceFootprint.estimatedTokenCount} token`
                            : '未注入'}
                    </span>
                    <button
                        type="button"
                        className="copy-preview-btn"
                        onClick={copyEffectPreview}
                    >
                        复制预览
                    </button>
                </div>
            </div>
            {preferenceChangeImpact && (
                <div
                    className={`preference-change-impact ${
                        preferenceChangeImpact.hasChanges ? '' : 'no-change'
                    }`}
                    aria-live="polite"
                >
                    <div className="change-impact-header">
                        <strong>保存影响</strong>
                        <span>{preferenceChangeImpact.summary}</span>
                    </div>
                    <div className="change-impact-grid">
                        {preferenceChangeImpact.items.map((item) => (
                            <div
                                key={item.id}
                                className={`change-impact-item ${item.status}`}
                            >
                                <span>{item.label}</span>
                                <strong>{item.before} → {item.after}</strong>
                                <small>{item.detail}</small>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            {activePromptRiskHints.length > 0 && (
                <div className="preference-warnings" role="status">
                    {activePromptRiskHints.map((hint, index) => (
                        <div key={`${hint.scope}-${index}`}>
                            <strong>{hint.scopeLabel}</strong>
                            <span>{hint.message}</span>
                        </div>
                    ))}
                    <label className="risk-acknowledgement">
                        <input
                            type="checkbox"
                            checked={!hasUnacknowledgedPromptRisk}
                            onChange={(event) => setPromptRiskAcknowledgedKey(
                                event.target.checked ? promptRiskAcknowledgementKey : ''
                            )}
                        />
                        <span>我确认上述语句只作为低优先级偏好保存，不用于覆盖系统规则、工具边界或返回格式。</span>
                    </label>
                </div>
            )}
            {userContextSensitiveHints.length > 0 && (
                <div className="context-sensitive-warning" role="status">
                    <div className="context-sensitive-warning-head">
                        <strong>用户上下文敏感提示</strong>
                        <span>
                            {userContextSensitiveHints.length} 项字段疑似包含凭据；建议删除实际 secret，改成凭据所在系统、owner 或用途说明。
                        </span>
                    </div>
                    <div className="context-sensitive-warning-list">
                        {userContextSensitiveHints.slice(0, 4).map((hint) => (
                            <div key={hint.fingerprint}>
                                <strong>{hint.sectionTitle} · {hint.fieldLabel}</strong>
                                <span>{hint.message}</span>
                            </div>
                        ))}
                        {userContextSensitiveHints.length > 4 && (
                            <div>
                                <strong>其余字段</strong>
                                <span>还有 {userContextSensitiveHints.length - 4} 项敏感提示，请切换对应上下文页签检查。</span>
                            </div>
                        )}
                    </div>
                    <label className="context-sensitive-acknowledgement">
                        <input
                            type="checkbox"
                            checked={!hasUnacknowledgedUserContextSensitiveHint}
                            onChange={(event) => setUserContextSensitiveAcknowledgedKey(
                                event.target.checked ? userContextSensitiveAcknowledgementKey : ''
                            )}
                        />
                        <span>我确认这些内容不是可用凭据，或已改成不可执行的引用；保存只写入本机配置并尝试做记忆服务恢复备份，不会执行、验证或使用这些值调用外部系统。</span>
                    </label>
                </div>
            )}
            <div
                className={`draft-preview-receipt ${draftPreviewReceipt.status}`}
                role="status"
                aria-live="polite"
            >
                <span>{draftPreviewReceipt.statusLabel}</span>
                <strong>{draftPreviewReceipt.title}</strong>
                <small>{draftPreviewReceipt.detail}</small>
            </div>
            {previewCopyReceipt && (
                <div
                    className={`preview-copy-receipt ${previewCopyReceipt.status}`}
                    role="status"
                    aria-live="polite"
                >
                    <span>{previewCopyReceipt.status === 'copied' ? '已复制' : '失败'}</span>
                    <strong>{previewCopyReceipt.title}</strong>
                    <small>{previewCopyReceipt.detail}</small>
                </div>
            )}
            <div className="injection-receipt-grid" aria-label={`${preferenceReceipt.scopeLabel}注入回执`}>
                {preferenceReceipt.items.map((item) => (
                    <div
                        key={item.id}
                        className={`injection-receipt-item ${item.status}`}
                    >
                        <span>{item.statusLabel}</span>
                        <strong>{item.label}</strong>
                        <small>{item.detail}</small>
                    </div>
                ))}
            </div>
            <pre className="prompt-preview">{injectedPreview}</pre>
        </div>
    );

    const renderUserContextSectionReceipt = (section: UserContextSectionReceiptId) => {
        const receipt = userContextSectionReceipts[section];
        const sectionSensitiveHints = userContextSensitiveHintsBySection[section] || [];
        return (
            <>
                <div
                    className={`context-section-receipt ${receipt.status}`}
                    role="status"
                    aria-live="polite"
                >
                    <span>{receipt.statusLabel}</span>
                    <strong>{receipt.title}</strong>
                    <small>{receipt.detail}</small>
                </div>
                {sectionSensitiveHints.length > 0 && (
                    <div
                        className="context-section-sensitive-warning"
                        role="status"
                        aria-live="polite"
                    >
                        <span>敏感提示</span>
                        <strong>{sectionSensitiveHints.length} 项字段疑似包含凭据</strong>
                        <small>
                            {sectionSensitiveHints.map((hint) => `${hint.fieldLabel}：${hint.message}`).join('；')}。保存前需要确认这些值不是可用凭据，或已经改成不可执行的引用。
                        </small>
                    </div>
                )}
            </>
        );
    };

    const renderConfigHistory = () => (
        <div className="config-history-section">
            <div className="section-title-row">
                <h4>版本历史</h4>
                <span>{configHistory.length > 0 ? `最近 ${configHistory.length} 次` : '暂无'}</span>
            </div>
            {configHistory.length === 0 ? (
                <p className="empty-note">保存后会保留最近 10 个本机版本。</p>
            ) : (
                <div className="history-list">
                    {configHistory.map((entry) => (
                        <div key={entry.id} className="history-item">
                            <div>
                                <strong>{formatHistoryTimestamp(entry.savedAt)}</strong>
                                <span>{entry.summary}</span>
                                {entry.changeSummary && (
                                    <span className="history-change">{entry.changeSummary}</span>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={() => restoreHistoryEntry(entry)}
                                disabled={isLoading || isSaving}
                            >
                                恢复
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );

    const renderTab = () => {
        switch (activeTab) {
            case 'prompts':
                return (
                    <div className="tab-content">
                        <h3>自定义提示词</h3>
                        <p className="section-note">
                            内容会作为低优先级偏好注入分析流程，并与系统规则、工具边界和返回格式隔离。
                        </p>
                        {renderPromptEditor(
                            'message',
                            '消息分析',
                            '输入消息分析的自定义提示词...'
                        )}
                        {renderPromptEditor(
                            'project',
                            '项目分析',
                            '输入项目分析的自定义提示词...'
                        )}
                    </div>
                );

            case 'personal':
                return (
                    <div className="tab-content">
                        <h3>个人信息</h3>
                        {renderUserContextSectionReceipt('personal')}
                        <div className="user-info">
                            <p><strong>当前用户:</strong> {currentUserInfo.name}</p>
                            <p><strong>邮箱:</strong> {currentUserInfo.email}</p>
                        </div>
                        
                        <div className="field-group">
                            <label>职位</label>
                            <input
                                type="text"
                                value={configData.userContextConfig.personalInfo.title}
                                maxLength={USER_CONFIG_CONTEXT_TEXT_CHAR_LIMIT}
                                onChange={(e) => updateValue('userContextConfig.personalInfo.title', e.target.value)}
                                placeholder="您的职位"
                            />
                        </div>

                        <div className="field-group">
                            <label>部门</label>
                            <input
                                type="text"
                                value={configData.userContextConfig.personalInfo.department}
                                maxLength={USER_CONFIG_CONTEXT_TEXT_CHAR_LIMIT}
                                onChange={(e) => updateValue('userContextConfig.personalInfo.department', e.target.value)}
                                placeholder="所在部门"
                            />
                        </div>

                        <div className="field-group">
                            <label>地点</label>
                            <input
                                type="text"
                                value={configData.userContextConfig.personalInfo.location}
                                maxLength={USER_CONFIG_CONTEXT_TEXT_CHAR_LIMIT}
                                onChange={(e) => updateValue('userContextConfig.personalInfo.location', e.target.value)}
                                placeholder="工作地点"
                            />
                        </div>

                        <div className="field-group">
                            <label>时区</label>
                            <select
                                value={configData.userContextConfig.personalInfo.timezone}
                                onChange={(e) => updateValue('userContextConfig.personalInfo.timezone', e.target.value)}
                            >
                                <option value="GMT+8">GMT+8 (北京时间)</option>
                                <option value="GMT">GMT (格林尼治时间)</option>
                                <option value="GMT-5">GMT-5 (美东时间)</option>
                                <option value="GMT-8">GMT-8 (美西时间)</option>
                            </select>
                        </div>

	                        <div className="field-group">
	                            <label>直接主管</label>
	                            <input
	                                type="text"
	                                value={configData.userContextConfig.stakeholders.directManager}
                                    maxLength={USER_CONFIG_CONTEXT_TEXT_CHAR_LIMIT}
                                onChange={(e) => updateValue('userContextConfig.stakeholders.directManager', e.target.value)}
	                                placeholder="直接主管姓名"
	                            />
	                        </div>

	                        <div className="field-group">
	                            <label>汇报频率</label>
	                            <select
	                                value={configData.userContextConfig.stakeholders.reportingFrequency}
	                                onChange={(e) => updateValue('userContextConfig.stakeholders.reportingFrequency', e.target.value)}
	                            >
	                                <option value="每日">每日</option>
	                                <option value="每周">每周</option>
	                                <option value="每两周">每两周</option>
	                                <option value="每月">每月</option>
	                                <option value="按需">按需</option>
	                            </select>
	                        </div>

	                        <div className="field-group">
	                            <label>关键干系人</label>
	                            <div className="structured-list">
	                                {configData.userContextConfig.stakeholders.keyStakeholders.map((stakeholder, index) => (
	                                    <div key={index} className="structured-item">
	                                        <div className="structured-grid">
	                                            <input
	                                                type="text"
	                                                value={stakeholder.name}
                                                    maxLength={USER_CONFIG_CONTEXT_TEXT_CHAR_LIMIT}
	                                                onChange={(e) => updateStakeholder(index, 'name', e.target.value)}
	                                                placeholder="姓名"
	                                            />
	                                            <input
	                                                type="text"
	                                                value={stakeholder.position}
                                                    maxLength={USER_CONFIG_CONTEXT_TEXT_CHAR_LIMIT}
	                                                onChange={(e) => updateStakeholder(index, 'position', e.target.value)}
	                                                placeholder="职位"
	                                            />
	                                            <input
	                                                type="text"
	                                                value={stakeholder.relationship}
                                                    maxLength={USER_CONFIG_CONTEXT_TEXT_CHAR_LIMIT}
	                                                onChange={(e) => updateStakeholder(index, 'relationship', e.target.value)}
	                                                placeholder="关系"
	                                            />
	                                            <select
	                                                value={stakeholder.priority}
	                                                onChange={(e) => updateStakeholder(index, 'priority', e.target.value)}
	                                            >
	                                                <option value="high">高优先级</option>
	                                                <option value="medium">中优先级</option>
	                                                <option value="low">低优先级</option>
	                                            </select>
	                                        </div>
	                                        <button
	                                            type="button"
	                                            onClick={() => removeFromArray('userContextConfig.stakeholders.keyStakeholders', index)}
	                                            className="remove-btn"
	                                        >
	                                            删除
	                                        </button>
	                                    </div>
	                                ))}
	                                <button
	                                    type="button"
	                                    onClick={() => addToArray('userContextConfig.stakeholders.keyStakeholders', createEmptyStakeholder())}
	                                    className="add-btn"
	                                >
	                                    添加关键干系人
	                                </button>
	                            </div>
	                        </div>
	                    </div>
	                );

	            case 'team':
	                return (
	                    <div className="tab-content">
	                        <h3>团队信息</h3>
                            {renderUserContextSectionReceipt('team')}

	                        <div className="field-group">
	                            <label>团队名称</label>
	                            <input
	                                type="text"
	                                value={configData.userContextConfig.teamInfo.teamName}
                                    maxLength={USER_CONFIG_CONTEXT_TEXT_CHAR_LIMIT}
	                                onChange={(e) => updateValue('userContextConfig.teamInfo.teamName', e.target.value)}
	                                placeholder="团队名称"
	                            />
	                        </div>

	                        <div className="field-group">
	                            <label>团队使命</label>
	                            <textarea
	                                value={configData.userContextConfig.teamInfo.teamMission}
                                    maxLength={USER_CONFIG_CONTEXT_TEXT_CHAR_LIMIT}
	                                onChange={(e) => updateValue('userContextConfig.teamInfo.teamMission', e.target.value)}
	                                placeholder="团队当前使命或主要目标"
	                                rows={3}
	                            />
	                        </div>

	                        <div className="field-row">
	                            <div className="field-group">
	                                <label>团队规模</label>
	                                <input
	                                    type="number"
	                                    min="0"
	                                    value={configData.userContextConfig.teamInfo.teamSize}
	                                    onChange={(e) => updateValue('userContextConfig.teamInfo.teamSize', Number(e.target.value) || 0)}
	                                />
	                            </div>
	                            <div className="field-group">
	                                <label>工作时间</label>
	                                <input
	                                    type="text"
	                                    value={configData.userContextConfig.teamInfo.workingHours}
                                        maxLength={USER_CONFIG_CONTEXT_TEXT_CHAR_LIMIT}
	                                    onChange={(e) => updateValue('userContextConfig.teamInfo.workingHours', e.target.value)}
	                                    placeholder="例如 10:00-19:00"
	                                />
	                            </div>
	                            <div className="field-group">
	                                <label>团队时区</label>
	                                <select
	                                    value={configData.userContextConfig.teamInfo.timezone}
	                                    onChange={(e) => updateValue('userContextConfig.teamInfo.timezone', e.target.value)}
	                                >
	                                    <option value="GMT+8">GMT+8 (北京时间)</option>
	                                    <option value="GMT">GMT (格林尼治时间)</option>
	                                    <option value="GMT-5">GMT-5 (美东时间)</option>
	                                    <option value="GMT-8">GMT-8 (美西时间)</option>
	                                </select>
	                            </div>
	                        </div>

	                        <div className="field-group">
	                            <label>团队成员</label>
	                            <div className="structured-list">
	                                {configData.userContextConfig.teamInfo.members.map((member, index) => (
	                                    <div key={index} className="structured-item">
	                                        <div className="structured-grid">
	                                            <input
	                                                type="text"
	                                                value={member.name}
                                                    maxLength={USER_CONFIG_CONTEXT_TEXT_CHAR_LIMIT}
	                                                onChange={(e) => updateTeamMember(index, 'name', e.target.value)}
	                                                placeholder="姓名"
	                                            />
	                                            <input
	                                                type="text"
	                                                value={member.position}
                                                    maxLength={USER_CONFIG_CONTEXT_TEXT_CHAR_LIMIT}
	                                                onChange={(e) => updateTeamMember(index, 'position', e.target.value)}
	                                                placeholder="职位"
	                                            />
	                                            <input
	                                                type="text"
	                                                value={member.role}
                                                    maxLength={USER_CONFIG_CONTEXT_TEXT_CHAR_LIMIT}
	                                                onChange={(e) => updateTeamMember(index, 'role', e.target.value)}
	                                                placeholder="职责"
	                                            />
	                                            <input
	                                                type="text"
	                                                value={member.speciality}
                                                    maxLength={USER_CONFIG_CONTEXT_TEXT_CHAR_LIMIT}
	                                                onChange={(e) => updateTeamMember(index, 'speciality', e.target.value)}
	                                                placeholder="专长"
	                                            />
	                                        </div>
	                                        <button
	                                            type="button"
	                                            onClick={() => removeFromArray('userContextConfig.teamInfo.members', index)}
	                                            className="remove-btn"
	                                        >
	                                            删除
	                                        </button>
	                                    </div>
	                                ))}
	                                <button
	                                    type="button"
	                                    onClick={() => addToArray('userContextConfig.teamInfo.members', createEmptyTeamMember())}
	                                    className="add-btn"
	                                >
	                                    添加团队成员
	                                </button>
	                            </div>
	                        </div>
	                    </div>
	                );

	            case 'work':
	                return (
	                    <div className="tab-content">
	                        <h3>工作关注点</h3>
                            {renderUserContextSectionReceipt('work')}
                        
                        {renderArrayField('主要关注点', 'userContextConfig.workFocus.primaryConcerns', configData.userContextConfig.workFocus.primaryConcerns)}
                        {renderArrayField('业务领域', 'userContextConfig.workFocus.businessDomains', configData.userContextConfig.workFocus.businessDomains)}
                        {renderArrayField('关键指标', 'userContextConfig.workFocus.keyMetrics', configData.userContextConfig.workFocus.keyMetrics)}

                        <div className="field-group">
                            <label>风险承受度</label>
                            <select
                                value={configData.userContextConfig.workFocus.riskTolerance}
                                onChange={(e) => updateValue('userContextConfig.workFocus.riskTolerance', e.target.value)}
                            >
                                <option value="low">低</option>
                                <option value="medium">中</option>
                                <option value="high">高</option>
                            </select>
                        </div>
	                    </div>
	                );

	            case 'communication':
	                return (
	                    <div className="tab-content">
	                        <h3>沟通偏好</h3>
                            {renderUserContextSectionReceipt('communication')}

	                        {renderArrayField('受众类型', 'userContextConfig.communicationContext.audienceType', configData.userContextConfig.communicationContext.audienceType)}

	                        <div className="field-group">
	                            <label>沟通风格</label>
	                            <select
	                                value={configData.userContextConfig.communicationContext.communicationStyle}
	                                onChange={(e) => updateValue('userContextConfig.communicationContext.communicationStyle', e.target.value)}
	                            >
	                                <option value="简洁直接">简洁直接</option>
	                                <option value="结构化汇报">结构化汇报</option>
	                                <option value="详细解释">详细解释</option>
	                                <option value="行动项优先">行动项优先</option>
	                            </select>
	                        </div>

	                        <div className="field-group">
	                            <label>文化背景</label>
	                            <input
	                                type="text"
	                                value={configData.userContextConfig.communicationContext.culturalContext}
                                    maxLength={USER_CONFIG_CONTEXT_TEXT_CHAR_LIMIT}
	                                onChange={(e) => updateValue('userContextConfig.communicationContext.culturalContext', e.target.value)}
	                                placeholder="例如 跨时区协作、中文为主"
	                            />
	                        </div>

	                        <div className="field-row">
	                            <div className="field-group">
	                                <label>语言偏好</label>
	                                <select
	                                    value={configData.userContextConfig.communicationContext.languagePreference}
	                                    onChange={(e) => updateValue('userContextConfig.communicationContext.languagePreference', e.target.value)}
	                                >
	                                    <option value="中文">中文</option>
	                                    <option value="英文">英文</option>
	                                    <option value="中英文混合">中英文混合</option>
	                                </select>
	                            </div>
	                            <div className="field-group">
	                                <label>汇报格式</label>
	                                <input
	                                    type="text"
	                                    value={configData.userContextConfig.communicationContext.reportingFormat}
                                        maxLength={USER_CONFIG_CONTEXT_TEXT_CHAR_LIMIT}
	                                    onChange={(e) => updateValue('userContextConfig.communicationContext.reportingFormat', e.target.value)}
	                                    placeholder="例如 项目状态报告"
	                                />
	                            </div>
	                        </div>
	                    </div>
	                );

	            case 'analysis':
	                return (
	                    <div className="tab-content">
                        <h3>分析偏好</h3>
                        {renderUserContextSectionReceipt('analysis')}
                        
                        <h4>消息分析</h4>
                        {renderArrayField('关注领域', 'userContextConfig.analysisPreferences.messageAnalysis.focusAreas', configData.userContextConfig.analysisPreferences.messageAnalysis.focusAreas)}
                        {renderArrayField('忽略话题', 'userContextConfig.analysisPreferences.messageAnalysis.ignoredTopics', configData.userContextConfig.analysisPreferences.messageAnalysis.ignoredTopics)}
                        {renderArrayField('紧急关键词', 'userContextConfig.analysisPreferences.messageAnalysis.urgencyKeywords', configData.userContextConfig.analysisPreferences.messageAnalysis.urgencyKeywords)}

                        <h4>项目分析</h4>
                        {renderArrayField('风险因素', 'userContextConfig.analysisPreferences.projectAnalysis.riskFactors', configData.userContextConfig.analysisPreferences.projectAnalysis.riskFactors)}
                        {renderArrayField('成功标准', 'userContextConfig.analysisPreferences.projectAnalysis.successCriteria', configData.userContextConfig.analysisPreferences.projectAnalysis.successCriteria)}

                        <div className="field-group">
                            <label>审查周期</label>
                            <select
                                value={configData.userContextConfig.analysisPreferences.projectAnalysis.reviewCycle}
                                onChange={(e) => updateValue('userContextConfig.analysisPreferences.projectAnalysis.reviewCycle', e.target.value)}
                            >
                                <option value="daily">每日</option>
                                <option value="weekly">每周</option>
                                <option value="monthly">每月</option>
                            </select>
                        </div>
                    </div>
                );

            default:
                return <div>选择一个标签页</div>;
        }
    };

	    return (
	        <div className="prompt-config">
	            <div className="config-header">
		                <h1>自定义提示词与上下文</h1>
	                <div className="config-actions">
	                    <button
	                        onClick={reloadFromStorage}
	                        className="reload-btn"
	                        disabled={isLoading || isSaving}
	                    >
                        {isLoading ? '加载中...' : '重新加载'}
                    </button>
                    <button
                        onClick={saveConfiguration}
                        className="save-btn"
                        disabled={isLoading || isSaving}
                    >
                        {isSaving ? '保存中...' : hasUnsavedChanges ? '保存配置 *' : '保存配置'}
                    </button>
                    <button
                        onClick={triggerDataFusion}
	                        className={`fusion-btn ${hasUnacknowledgedSafetyHint ? 'needs-review' : ''}`}
                        title={
                            hasUnacknowledgedSafetyHint
                                ? '先确认安全提示只作为低优先级偏好或非凭据引用，再融合到用户画像'
                                : '将当前用户上下文融合到用户画像'
                        }
	                        disabled={isLoading || isSaving}
	                    >
	                        {hasUnacknowledgedSafetyHint ? '确认安全提示后融合' : '融合到用户画像'}
	                    </button>
                    <button
                        onClick={resetToDefaults}
                        className="reset-btn"
                        disabled={isLoading || isSaving}
                    >
                        重置默认
	                    </button>
                </div>
            </div>

            {renderBaselineReceipt()}

            {(syncSource || hasUnsavedChanges) && (
                <div className="sync-summary">
                    <span>{syncSource || '尚未保存'}</span>
                    {hasUnsavedChanges && <strong>有未保存修改</strong>}
                    {pendingChangeSummary && (
                        <span className="pending-change-summary">{pendingChangeSummary}</span>
                    )}
                </div>
            )}

            {renderHistoryRestoreReceipt()}

            {statusMessage && (
                <div className={`status-message ${statusType}`}>
                    {statusMessage}
                </div>
            )}

	            <div className="config-tabs">
	                {[
	                    { id: 'prompts', label: '提示词' },
	                    { id: 'personal', label: '个人信息' },
	                    { id: 'team', label: '团队信息' },
	                    { id: 'work', label: '工作关注' },
	                    { id: 'communication', label: '沟通偏好' },
	                    { id: 'analysis', label: '分析偏好' }
	                ].map(tab => (
                    <button
                        key={tab.id}
                        className={`config-tab ${activeTab === tab.id ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab.id as TabType)}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="config-content">
                {renderInjectionControl()}
                {renderConfigSummary()}
                {renderTab()}
                {renderEffectPreview()}
                {renderConfigHistory()}
            </div>

            <style>{`
                .prompt-config {
                    max-width: 1000px;
                    margin: 0 auto;
                    padding: 20px;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                }

	                .config-header {
	                    display: flex;
	                    justify-content: space-between;
	                    align-items: center;
	                    gap: 16px;
	                    margin-bottom: 24px;
	                    padding-bottom: 16px;
	                    border-bottom: 2px solid #e0e0e0;
	                }

                .config-header h1 {
                    margin: 0;
                    color: #2c3e50;
                }

	                .config-actions {
	                    display: flex;
	                    flex-wrap: wrap;
	                    gap: 12px;
	                }

                .config-actions button {
                    padding: 8px 16px;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    transition: background-color 0.3s;
                }

                .config-actions button:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }

                .save-btn {
                    background: #27ae60;
                    color: white;
                }

                .save-btn:hover {
                    background: #229954;
                }

                .fusion-btn {
                    background: linear-gradient(135deg, #FF9800 0%, #F57C00 100%);
                    color: white;
                    font-weight: 600;
                    transition: all 0.2s ease;
                    box-shadow: 0 2px 4px rgba(255, 152, 0, 0.3);
                }
                
                .fusion-btn:hover {
                    background: linear-gradient(135deg, #F57C00 0%, #FF9800 100%);
                    transform: translateY(-1px);
                    box-shadow: 0 4px 8px rgba(255, 152, 0, 0.4);
                }

                .fusion-btn.needs-review {
                    background: #b45309;
                    box-shadow: 0 2px 4px rgba(180, 83, 9, 0.28);
                }

                .fusion-btn.needs-review:hover {
                    background: #92400e;
                    box-shadow: 0 4px 8px rgba(146, 64, 14, 0.32);
                }

                .reload-btn {
                    background: #3498db;
                    color: white;
                }

                .reload-btn:hover {
                    background: #2980b9;
                }

                .reset-btn {
                    background: #e74c3c;
                    color: white;
                }

                .reset-btn:hover {
                    background: #c0392b;
                }

                .status-message {
                    padding: 12px 16px;
                    border-radius: 4px;
                    margin-bottom: 16px;
                    text-align: center;
                }

                .sync-summary {
                    display: flex;
                    flex-wrap: wrap;
                    align-items: center;
                    gap: 12px;
                    padding: 10px 12px;
                    margin-bottom: 16px;
                    border: 1px solid #dfe6e9;
                    border-radius: 6px;
                    background: #f8f9fa;
                    color: #34495e;
                    font-size: 13px;
                }

                .sync-summary strong {
                    color: #b7791f;
                    font-weight: 600;
                }

                .pending-change-summary {
                    min-width: 0;
                    color: #475569;
                    overflow-wrap: anywhere;
                }

                .status-message.success {
                    background: #d4edda;
                    color: #155724;
                    border: 1px solid #c3e6cb;
                }

                .status-message.error {
                    background: #f8d7da;
                    color: #721c24;
                    border: 1px solid #f5c6cb;
                }

                .baseline-receipt {
                    display: grid;
                    grid-template-columns: auto 1fr;
                    gap: 4px 8px;
                    align-items: start;
                    margin: -4px 0 12px;
                    padding: 10px 12px;
                    border: 1px solid #d8dee4;
                    border-left: 4px solid #64748b;
                    border-radius: 6px;
                    background: #f8fafc;
                    color: #475569;
                    line-height: 1.45;
                }

                .baseline-receipt span {
                    width: fit-content;
                    max-width: 100%;
                    padding: 2px 7px;
                    border-radius: 999px;
                    background: #f1f5f9;
                    color: #475569;
                    font-size: 11px;
                    font-weight: 700;
                    white-space: nowrap;
                }

                .baseline-receipt strong {
                    min-width: 0;
                    color: #1f2937;
                    font-size: 13px;
                    overflow-wrap: anywhere;
                }

                .baseline-receipt small {
                    grid-column: 1 / -1;
                    min-width: 0;
                    color: #64748b;
                    font-size: 12px;
                    overflow-wrap: anywhere;
                }

                .baseline-receipt.backed-up,
                .baseline-receipt.memory {
                    border-left-color: #16a34a;
                }

                .baseline-receipt.backed-up span,
                .baseline-receipt.memory span {
                    background: #dcfce7;
                    color: #166534;
                }

                .baseline-receipt.local {
                    border-left-color: #ca8a04;
                    background: #fffbeb;
                }

                .baseline-receipt.local span {
                    background: #fef3c7;
                    color: #92400e;
                }

	                .baseline-draft-note {
	                    color: #92400e;
	                    font-weight: 600;
	                }

                    .history-restore-receipt {
                        display: grid;
                        grid-template-columns: auto 1fr;
                        gap: 4px 8px;
                        align-items: start;
                        margin: -4px 0 16px;
                        padding: 10px 12px;
                        border: 1px solid #fed7aa;
                        border-left: 4px solid #ca8a04;
                        border-radius: 6px;
                        background: #fff7ed;
                        color: #92400e;
                        line-height: 1.45;
                    }

                    .history-restore-receipt span {
                        width: fit-content;
                        max-width: 100%;
                        padding: 2px 7px;
                        border-radius: 999px;
                        background: #fef3c7;
                        color: #92400e;
                        font-size: 11px;
                        font-weight: 700;
                        white-space: nowrap;
                    }

                    .history-restore-receipt strong {
                        min-width: 0;
                        color: #7c2d12;
                        font-size: 13px;
                        overflow-wrap: anywhere;
                    }

                    .history-restore-receipt small {
                        grid-column: 1 / -1;
                        min-width: 0;
                        color: inherit;
                        font-size: 12px;
                        overflow-wrap: anywhere;
                    }

		                .config-tabs {
	                    display: flex;
	                    flex-wrap: wrap;
	                    margin-bottom: 24px;
	                    border-bottom: 1px solid #e0e0e0;
	                }

	                .config-tab {
	                    padding: 12px 18px;
	                    background: none;
	                    border: none;
	                    cursor: pointer;
                    border-bottom: 3px solid transparent;
                    transition: all 0.3s;
                }

                .config-tab:hover {
                    background: #f8f9fa;
                }

                .config-tab.active {
                    border-bottom-color: #3498db;
                    color: #3498db;
                    font-weight: 600;
                }

                .config-content {
                  background: white;
                  border-radius: 8px;
                  padding: 24px;
                  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                }

                .injection-control-row {
                    display: grid;
                    grid-template-columns: minmax(0, 1fr) auto;
                    align-items: center;
                    gap: 12px;
                    margin: -4px 0 16px;
                    padding: 10px 12px;
                    border: 1px solid #bfdbfe;
                    border-radius: 6px;
                    background: #eff6ff;
                    color: #1e3a8a;
                }

                .injection-control-row.paused {
                    border-color: #fed7aa;
                    background: #fff7ed;
                    color: #9a3412;
                }

                .injection-main-control {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 12px;
                    min-width: 0;
                }

                .injection-toggle {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-weight: 600;
                }

                .injection-toggle input {
                    margin: 0;
                }

                .injection-control-row strong {
                    flex: 0 0 auto;
                    font-size: 13px;
                }

                .injection-source-controls {
                    display: flex;
                    flex-wrap: wrap;
                    justify-content: flex-end;
                    gap: 8px;
                }

                .source-toggle {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    min-height: 28px;
                    padding: 4px 8px;
                    border: 1px solid rgba(59, 130, 246, 0.28);
                    border-radius: 6px;
                    background: rgba(255, 255, 255, 0.7);
                    color: inherit;
                    font-size: 12px;
                    font-weight: 600;
                }

                .source-toggle input {
                    margin: 0;
                }

                .source-toggle:has(input:disabled) {
                    opacity: 0.55;
                }

                .config-summary-strip {
                  display: grid;
                    grid-template-columns: repeat(4, minmax(0, 1fr));
                    gap: 0;
                    margin: -4px 0 24px;
                    border: 1px solid #e5e7eb;
                    border-radius: 6px;
                    overflow: hidden;
                    background: #f8fafc;
                }

                .summary-item {
                    display: grid;
                    gap: 4px;
                    min-width: 0;
                    padding: 12px;
                    border: 0;
                    border-right: 1px solid #e5e7eb;
                    background: transparent;
                    color: #334155;
                    cursor: pointer;
                    text-align: left;
                }

                .summary-item:last-child {
                    border-right: 0;
                }

                .summary-item.passive {
                    cursor: default;
                }

                .summary-item:hover,
                .summary-item:focus-visible {
                    background: #eef6ff;
                    outline: none;
                }

                .summary-item.passive:hover {
                    background: transparent;
                }

                .summary-item span {
                    color: #64748b;
                    font-size: 12px;
                }

                .summary-item strong {
                    min-width: 0;
                    color: #1f2937;
                    font-size: 14px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .config-summary-strip.has-warning .summary-item:nth-child(3) strong {
                    color: #b45309;
                }

                .tab-content h3 {
                    margin-top: 0;
                    color: #2c3e50;
                }

                .section-note {
                    margin: -4px 0 18px;
                    color: #64748b;
                    font-size: 13px;
                    line-height: 1.5;
                }

                .effect-preview-section,
                .config-history-section {
                    margin-top: 24px;
                    padding-top: 18px;
                    border-top: 1px solid #e5e7eb;
                }

                .section-title-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 12px;
                    margin-bottom: 12px;
                }

                .section-title-row h4 {
                    margin: 0;
                }

                .preview-title-group {
                    display: flex;
                    flex-wrap: wrap;
                    align-items: center;
                    gap: 10px;
                    min-width: 0;
                }

                .preview-scope-switch {
                    display: inline-flex;
                    min-height: 30px;
                    overflow: hidden;
                    border: 1px solid #cbd5e1;
                    border-radius: 6px;
                    background: #f8fafc;
                }

                .preview-scope-switch button {
                    min-width: 44px;
                    padding: 5px 10px;
                    border: 0;
                    border-right: 1px solid #cbd5e1;
                    background: transparent;
                    color: #475569;
                    cursor: pointer;
                    font-size: 12px;
                    font-weight: 600;
                }

                .preview-scope-switch button:last-child {
                    border-right: 0;
                }

                .preview-scope-switch button.active {
                    background: #2563eb;
                    color: white;
                }

                .preview-scope-switch button:focus-visible {
                    outline: 2px solid #93c5fd;
                    outline-offset: -2px;
                }

                .section-title-row span {
                    color: #64748b;
                    font-size: 12px;
                }

                .preview-meta-actions {
                    display: flex;
                    flex-wrap: wrap;
                    justify-content: flex-end;
                    align-items: center;
                    gap: 8px;
                    min-width: 0;
                }

                .copy-preview-btn {
                    flex: 0 0 auto;
                    min-height: 30px;
                    padding: 5px 10px;
                    border: 1px solid #cbd5e1;
                    border-radius: 6px;
                    background: #fff;
                    color: #334155;
                    cursor: pointer;
                    font-size: 12px;
                    font-weight: 700;
                }

                .copy-preview-btn:hover {
                    border-color: #94a3b8;
                    background: #f8fafc;
                }

                .copy-preview-btn:focus-visible {
                    outline: 2px solid #93c5fd;
                    outline-offset: 2px;
                }

                .preference-change-impact {
                    display: grid;
                    gap: 10px;
                    margin-bottom: 12px;
                    padding: 10px;
                    border: 1px solid #bfdbfe;
                    border-radius: 6px;
                    background: #eff6ff;
                    color: #1e3a8a;
                }

                .preference-change-impact.no-change {
                    border-color: #cbd5e1;
                    background: #f8fafc;
                    color: #475569;
                }

                .change-impact-header {
                    display: flex;
                    flex-wrap: wrap;
                    align-items: center;
                    gap: 8px;
                    min-width: 0;
                    font-size: 13px;
                }

                .change-impact-header strong {
                    flex: 0 0 auto;
                    color: inherit;
                    font-weight: 700;
                }

                .change-impact-header span {
                    min-width: 0;
                    color: inherit;
                    overflow-wrap: anywhere;
                }

                .change-impact-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(145px, 1fr));
                    gap: 8px;
                }

                .change-impact-item {
                    display: grid;
                    gap: 3px;
                    min-width: 0;
                    padding: 8px 9px;
                    border: 1px solid rgba(37, 99, 235, 0.2);
                    border-left: 4px solid #60a5fa;
                    border-radius: 6px;
                    background: rgba(255, 255, 255, 0.72);
                    line-height: 1.45;
                }

                .change-impact-item.increase {
                    border-left-color: #2563eb;
                }

                .change-impact-item.decrease {
                    border-left-color: #16a34a;
                }

                .change-impact-item.warning {
                    border-color: #fed7aa;
                    border-left-color: #ca8a04;
                    background: #fffbeb;
                    color: #92400e;
                }

                .change-impact-item span {
                    color: inherit;
                    font-size: 11px;
                    font-weight: 700;
                }

                .change-impact-item strong {
                    min-width: 0;
                    color: #1f2937;
                    font-size: 12px;
                    overflow-wrap: anywhere;
                }

                .change-impact-item small {
                    min-width: 0;
                    color: #64748b;
                    font-size: 11px;
                    overflow-wrap: anywhere;
                }

                .change-impact-item.warning strong,
                .change-impact-item.warning small {
                    color: inherit;
                }

                .preference-warnings {
                    display: grid;
                    gap: 8px;
                    margin-bottom: 12px;
                }

                .preference-warnings div {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                    padding: 8px 10px;
                    border: 1px solid #fed7aa;
                    border-radius: 6px;
                    background: #fff7ed;
                    color: #9a3412;
                    font-size: 13px;
                }

                .preference-warnings strong {
                    color: #7c2d12;
                }

                .risk-acknowledgement {
                    display: flex;
                    align-items: flex-start;
                    gap: 8px;
                    padding: 10px 12px;
                    border: 1px solid #fdba74;
                    border-radius: 6px;
                    background: #fffbeb;
                    color: #92400e;
                    font-size: 13px;
                    line-height: 1.45;
                }

                .risk-acknowledgement input {
                    flex: 0 0 auto;
                    margin-top: 2px;
                }

                .context-sensitive-warning {
                    display: grid;
                    gap: 9px;
                    margin-bottom: 12px;
                    padding: 10px 12px;
                    border: 1px solid #fecaca;
                    border-left: 4px solid #dc2626;
                    border-radius: 6px;
                    background: #fef2f2;
                    color: #991b1b;
                    line-height: 1.45;
                }

                .context-sensitive-warning-head {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                    align-items: baseline;
                }

                .context-sensitive-warning-head strong {
                    color: #7f1d1d;
                }

                .context-sensitive-warning-head span {
                    min-width: 0;
                    color: inherit;
                    font-size: 13px;
                    overflow-wrap: anywhere;
                }

                .context-sensitive-warning-list {
                    display: grid;
                    gap: 6px;
                }

                .context-sensitive-warning-list div {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                    min-width: 0;
                    padding: 7px 9px;
                    border: 1px solid rgba(220, 38, 38, 0.16);
                    border-radius: 6px;
                    background: rgba(255, 255, 255, 0.7);
                    font-size: 12px;
                }

                .context-sensitive-warning-list strong {
                    color: #7f1d1d;
                }

                .context-sensitive-warning-list span {
                    min-width: 0;
                    overflow-wrap: anywhere;
                }

                .context-sensitive-acknowledgement {
                    display: flex;
                    align-items: flex-start;
                    gap: 8px;
                    padding: 10px 12px;
                    border: 1px solid #fca5a5;
                    border-radius: 6px;
                    background: #fff;
                    color: #7f1d1d;
                    font-size: 13px;
                    line-height: 1.45;
                }

                .context-sensitive-acknowledgement input {
                    flex: 0 0 auto;
                    margin-top: 2px;
                }

                .draft-preview-receipt {
                    display: grid;
                    grid-template-columns: auto 1fr;
                    gap: 4px 8px;
                    align-items: start;
                    margin-bottom: 12px;
                    padding: 9px 10px;
                    border: 1px solid #d8dee4;
                    border-left: 4px solid #16a34a;
                    border-radius: 6px;
                    background: #f8fafc;
                    color: #475569;
                    line-height: 1.45;
                }

                .draft-preview-receipt span {
                    width: fit-content;
                    max-width: 100%;
                    padding: 2px 7px;
                    border-radius: 999px;
                    background: #dcfce7;
                    color: #166534;
                    font-size: 11px;
                    font-weight: 700;
                    white-space: nowrap;
                }

                .draft-preview-receipt strong {
                    min-width: 0;
                    color: #1f2937;
                    font-size: 13px;
                    overflow-wrap: anywhere;
                }

                .draft-preview-receipt small {
                    grid-column: 1 / -1;
                    min-width: 0;
                    color: #64748b;
                    font-size: 12px;
                    overflow-wrap: anywhere;
                }

                .draft-preview-receipt.draft {
                    border-left-color: #ca8a04;
                    background: #fffbeb;
                }

                .draft-preview-receipt.draft span,
                .draft-preview-receipt.draft-same-scope span {
                    background: #fef3c7;
                    color: #92400e;
                }

                .draft-preview-receipt.draft-same-scope {
                    border-left-color: #64748b;
                }

                .preview-copy-receipt {
                    display: grid;
                    grid-template-columns: auto 1fr;
                    gap: 4px 8px;
                    align-items: start;
                    margin: -2px 0 12px;
                    padding: 9px 10px;
                    border: 1px solid #bbf7d0;
                    border-left: 4px solid #16a34a;
                    border-radius: 6px;
                    background: #f0fdf4;
                    color: #166534;
                    line-height: 1.45;
                }

                .preview-copy-receipt.error {
                    border-color: #fecaca;
                    border-left-color: #dc2626;
                    background: #fef2f2;
                    color: #991b1b;
                }

                .preview-copy-receipt span {
                    width: fit-content;
                    max-width: 100%;
                    padding: 2px 7px;
                    border-radius: 999px;
                    background: rgba(22, 101, 52, 0.1);
                    color: inherit;
                    font-size: 11px;
                    font-weight: 700;
                    white-space: nowrap;
                }

                .preview-copy-receipt strong {
                    min-width: 0;
                    color: #1f2937;
                    font-size: 13px;
                    overflow-wrap: anywhere;
                }

                .preview-copy-receipt small {
                    grid-column: 1 / -1;
                    min-width: 0;
                    color: inherit;
                    font-size: 12px;
                    overflow-wrap: anywhere;
                }

                .injection-receipt-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                    gap: 8px;
                    margin-bottom: 12px;
                }

                .injection-receipt-item {
                    min-width: 0;
                    display: grid;
                    grid-template-columns: auto 1fr;
                    gap: 3px 8px;
                    align-items: start;
                    padding: 9px 10px;
                    border: 1px solid #d8dee4;
                    border-left: 4px solid #8c959f;
                    border-radius: 6px;
                    background: #fff;
                    color: #475569;
                    line-height: 1.45;
                }

                .injection-receipt-item span {
                    width: fit-content;
                    max-width: 100%;
                    padding: 2px 7px;
                    border-radius: 999px;
                    background: #f1f5f9;
                    color: #475569;
                    font-size: 11px;
                    font-weight: 700;
                    white-space: nowrap;
                }

                .injection-receipt-item strong {
                    min-width: 0;
                    color: #1f2937;
                    font-size: 13px;
                    overflow-wrap: anywhere;
                }

                .injection-receipt-item small {
                    grid-column: 1 / -1;
                    min-width: 0;
                    color: #64748b;
                    font-size: 12px;
                    overflow-wrap: anywhere;
                }

                .injection-receipt-item.included {
                    border-left-color: #16a34a;
                }

                .injection-receipt-item.included span {
                    background: #dcfce7;
                    color: #166534;
                }

                .injection-receipt-item.excluded {
                    border-left-color: #64748b;
                    background: #f8fafc;
                }

                .injection-receipt-item.paused {
                    border-left-color: #ca8a04;
                    background: #fffbeb;
                }

                .injection-receipt-item.paused span {
                    background: #fef3c7;
                    color: #92400e;
                }

                .context-section-receipt {
                    display: grid;
                    grid-template-columns: auto 1fr;
                    gap: 4px 8px;
                    align-items: start;
                    margin: -4px 0 14px;
                    padding: 9px 10px;
                    border: 1px solid #d8dee4;
                    border-left: 4px solid #8c959f;
                    border-radius: 6px;
                    background: #fff;
                    color: #475569;
                    line-height: 1.45;
                }

                .context-section-receipt span {
                    width: fit-content;
                    max-width: 100%;
                    padding: 2px 7px;
                    border-radius: 999px;
                    background: #f1f5f9;
                    color: #475569;
                    font-size: 11px;
                    font-weight: 700;
                    white-space: nowrap;
                }

                .context-section-receipt strong {
                    min-width: 0;
                    color: #1f2937;
                    font-size: 13px;
                    overflow-wrap: anywhere;
                }

                .context-section-receipt small {
                    grid-column: 1 / -1;
                    min-width: 0;
                    color: #64748b;
                    font-size: 12px;
                    overflow-wrap: anywhere;
                }

                .context-section-receipt.included {
                    border-left-color: #16a34a;
                }

                .context-section-receipt.included span {
                    background: #dcfce7;
                    color: #166534;
                }

                .context-section-receipt.paused {
                    border-left-color: #ca8a04;
                    background: #fffbeb;
                }

                .context-section-receipt.paused span {
                    background: #fef3c7;
                    color: #92400e;
                }

                .context-section-receipt.empty {
                    border-left-color: #94a3b8;
                    background: #f8fafc;
                }

                .context-section-sensitive-warning {
                    display: grid;
                    grid-template-columns: auto 1fr;
                    gap: 4px 8px;
                    align-items: start;
                    margin: -6px 0 14px;
                    padding: 9px 10px;
                    border: 1px solid #fecaca;
                    border-left: 4px solid #dc2626;
                    border-radius: 6px;
                    background: #fef2f2;
                    color: #991b1b;
                    line-height: 1.45;
                }

                .context-section-sensitive-warning span {
                    width: fit-content;
                    max-width: 100%;
                    padding: 2px 7px;
                    border-radius: 999px;
                    background: #fee2e2;
                    color: #991b1b;
                    font-size: 11px;
                    font-weight: 700;
                    white-space: nowrap;
                }

                .context-section-sensitive-warning strong {
                    min-width: 0;
                    color: #7f1d1d;
                    font-size: 13px;
                    overflow-wrap: anywhere;
                }

                .context-section-sensitive-warning small {
                    grid-column: 1 / -1;
                    min-width: 0;
                    color: inherit;
                    font-size: 12px;
                    overflow-wrap: anywhere;
                }

                .prompt-preview {
                    max-height: 280px;
                    margin: 0;
                    padding: 12px;
                    overflow: auto;
                    border: 1px solid #dbe3ee;
                    border-radius: 6px;
                    background: #f8fafc;
                    color: #1f2937;
                    white-space: pre-wrap;
                    word-break: break-word;
                    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
                    font-size: 12px;
                    line-height: 1.55;
                }

                .history-list {
                    display: grid;
                    gap: 10px;
                }

                .history-item {
                    display: grid;
                    grid-template-columns: 1fr auto;
                    gap: 12px;
                    align-items: center;
                    padding: 10px 0;
                    border-bottom: 1px solid #eef2f7;
                }

                .history-item:last-child {
                    border-bottom: none;
                }

                .history-item div {
                    display: grid;
                    gap: 4px;
                    min-width: 0;
                }

                .history-item strong {
                    color: #1f2937;
                    font-size: 13px;
                }

                .history-item span {
                    color: #64748b;
                    font-size: 12px;
                    overflow-wrap: anywhere;
                }

                .history-item .history-change {
                    color: #475569;
                    font-weight: 500;
                }

                .history-item button {
                    padding: 6px 10px;
                    border: 1px solid #cbd5e1;
                    border-radius: 6px;
                    background: #fff;
                    color: #334155;
                    cursor: pointer;
                }

                .history-item button:hover {
                    background: #f1f5f9;
                }

                .empty-note {
                    margin: 0;
                    color: #64748b;
                    font-size: 13px;
                }

	                .field-group {
	                    margin-bottom: 20px;
	                }

	                .field-row {
	                    display: grid;
	                    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
	                    gap: 16px;
	                    align-items: start;
	                }

                .field-group label {
                    display: block;
                    margin-bottom: 8px;
                    font-weight: 500;
                    color: #555;
                }

                .field-group input, 
                .field-group select, 
                .field-group textarea {
                    width: 100%;
                    padding: 10px;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    font-size: 14px;
                    transition: border-color 0.3s;
                }

                .field-group input:focus, 
                .field-group select:focus, 
                .field-group textarea:focus {
                    outline: none;
                    border-color: #3498db;
                }

                .field-group input[type="checkbox"] {
                    width: auto;
                    padding: 0;
                    margin: 0;
                }

                .prompt-scope-section {
                    padding-bottom: 18px;
                    margin-bottom: 20px;
                    border-bottom: 1px solid #e5e7eb;
                }

                .prompt-scope-section:last-child {
                    padding-bottom: 0;
                    margin-bottom: 0;
                    border-bottom: none;
                }

                .prompt-toggle {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .field-meta {
                    margin-top: 6px;
                    text-align: right;
                    color: #6b7280;
                    font-size: 12px;
                }

                .field-meta.warning {
                    color: #b7791f;
                    font-weight: 600;
                }

                .prompt-inline-hints {
                    display: grid;
                    gap: 8px;
                    margin: -8px 0 14px;
                }

                .prompt-inline-hint {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                    padding: 8px 10px;
                    border-radius: 6px;
                    font-size: 13px;
                    line-height: 1.45;
                }

                .prompt-inline-hint strong {
                    flex: 0 0 auto;
                    font-weight: 600;
                }

                .prompt-inline-hint.warning {
                    border: 1px solid #fed7aa;
                    background: #fff7ed;
                    color: #9a3412;
                }

                .prompt-inline-hint.warning strong {
                    color: #7c2d12;
                }

                .prompt-inline-hint.suggestion {
                    border: 1px solid #bfdbfe;
                    background: #eff6ff;
                    color: #1e3a8a;
                }

                .prompt-inline-hint.suggestion strong {
                    color: #1d4ed8;
                }

                .prompt-inline-hint.muted {
                    border: 1px solid #cbd5e1;
                    background: #f8fafc;
                    color: #475569;
                }

                .prompt-inline-hint.muted strong {
                    color: #334155;
                }

                .prompt-example-row {
                    display: flex;
                    flex-wrap: wrap;
                    align-items: center;
                    gap: 8px;
                    color: #64748b;
                    font-size: 12px;
                }

                .example-chip {
                    width: auto;
                    margin: 0;
                    padding: 6px 10px;
                    border: 1px solid #cbd5e1;
                    border-radius: 6px;
                    background: #fff;
                    color: #334155;
                    cursor: pointer;
                    font-size: 12px;
                }

                .example-chip:hover {
                    background: #f1f5f9;
                    border-color: #94a3b8;
                }

                .prompt-scope-note {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                    margin-top: 10px;
                    color: #64748b;
                    font-size: 12px;
                }

                .prompt-scope-note strong {
                    color: #334155;
                    font-weight: 600;
                }

                .user-info {
                    background: #f8f9fa;
                    padding: 16px;
                    border-radius: 4px;
                    margin-bottom: 20px;
                }

                .user-info p {
                    margin: 4px 0;
                    color: #555;
                }

	                .array-field {
	                    border: 1px solid #e0e0e0;
	                    border-radius: 4px;
                    padding: 12px;
                    background: #f8f9fa;
                }

                .array-item {
                    display: flex;
                    gap: 8px;
                    margin-bottom: 8px;
                    align-items: center;
                }

                .array-item input {
                    flex: 1;
                    margin-bottom: 0;
                }

                .remove-btn {
                    background: #e74c3c;
                    color: white;
                    border: none;
                    padding: 8px 12px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 12px;
                }

                .remove-btn:hover {
                    background: #c0392b;
                }

                .add-btn {
                    background: #27ae60;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                }

	                .add-btn:hover {
	                    background: #229954;
	                }

	                .structured-list {
	                    border: 1px solid #e0e0e0;
	                    border-radius: 4px;
	                    padding: 12px;
	                    background: #f8f9fa;
	                }

	                .structured-item {
	                    display: grid;
	                    grid-template-columns: 1fr auto;
	                    gap: 8px;
	                    align-items: start;
	                    margin-bottom: 8px;
	                }

	                .structured-grid {
	                    display: grid;
	                    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
	                    gap: 8px;
	                }

	                @media (max-width: 720px) {
	                    .prompt-config {
	                        padding: 14px;
	                    }

	                    .config-header {
	                        align-items: stretch;
	                        flex-direction: column;
	                    }

	                    .config-actions button,
	                    .config-tab {
	                        min-height: 40px;
	                    }

	                    .structured-item,
	                    .array-item {
	                        grid-template-columns: 1fr;
	                    }

	                    .array-item {
	                        display: grid;
	                    }

                        .history-item {
                            grid-template-columns: 1fr;
                        }

                        .injection-control-row {
                            grid-template-columns: 1fr;
                        }

                        .injection-source-controls {
                            justify-content: flex-start;
                        }

                        .config-summary-strip {
                            grid-template-columns: repeat(2, minmax(0, 1fr));
                        }

                        .summary-item:nth-child(2) {
                            border-right: 0;
                        }

                        .summary-item:nth-child(-n + 2) {
                            border-bottom: 1px solid #e5e7eb;
                        }
	                }

	                h4 {
                    color: #2c3e50;
                    margin-top: 24px;
                    margin-bottom: 16px;
                    font-size: 16px;
                }
            `}</style>
        </div>
    );
};

ReactDOM.render(
    <PromptConfig />,
    document.getElementById('prompt-config-root') || document.body
);
