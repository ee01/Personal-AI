import { getMemoryServiceClient } from './MemoryServiceClient';
import {
    getIndependentUserConfig,
    storeExplicitUserContextConfig,
    storeIndependentUserConfig,
} from './UserConfigStore';
import { buildUserProfileViewModel } from './userProfileViewModel';

export type ProfileItemsPage = {
    items: any[];
    total: number;
    truncated: boolean;
    viewLimit?: number;
};

type ProfileItemsMaxItems = number | 'all' | undefined;
type ProfileItemsFilters = {
    type?: string;
    status?: string;
    key?: string;
    confirmedOnly?: boolean;
};

function normalizeProfileItemsMaxItems(value: ProfileItemsMaxItems): number {
    if (value === 'all') return Number.POSITIVE_INFINITY;
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return 1000;
    return Math.max(1, Math.floor(numericValue));
}

export async function getProfileItemsForView(
    client: ReturnType<typeof getMemoryServiceClient>,
    maxItems: ProfileItemsMaxItems = 1000,
    filters: ProfileItemsFilters = {},
): Promise<ProfileItemsPage> {
    const pageSize = 200;
    const itemLimit = Number.isFinite(maxItems)
        ? Math.max(1, Math.floor(maxItems))
        : Number.POSITIVE_INFINITY;
    const firstPage = await client.getProfileItems({
        ...filters,
        limit: Math.min(pageSize, itemLimit),
        offset: 0,
    });
    const items = [...firstPage.items];
    const total = firstPage.total;

    for (let offset = items.length; offset < total && items.length < itemLimit; offset = items.length) {
        const nextPage = await client.getProfileItems({
            ...filters,
            limit: Math.min(pageSize, itemLimit - items.length),
            offset,
        });
        if (nextPage.items.length === 0) break;
        items.push(...nextPage.items);
    }

    return {
        items,
        total,
        truncated: items.length < total,
        viewLimit: Number.isFinite(itemLimit) ? itemLimit : undefined,
    };
}

type OptionalExportSection<T> = {
    value: T;
    warning?: string;
};

type ProfileExportAudit = {
    exportedProfileItems: number;
    activeItems: number;
    retractedItems: number;
    archivedItems: number;
    supersededItems: number;
    inactiveAuditItems: number;
    confirmedItems: number;
    pendingConfirmationItems: number;
    usableProfileItems: number;
    heldForConfirmationItems: number;
    withoutEvidenceItems: number;
    confirmationRate: number;
    evidenceCoverageRate: number;
    byStatus: Record<string, number>;
    byItemType: Record<string, number>;
    bySourceKind: Record<string, number>;
    personalizationBoundary: {
        rule: string;
        usableProfileItems: number;
        heldForConfirmationItems: number;
    };
};

function getExportErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message) return error.message;
    if (typeof error === 'string' && error.trim()) return error.trim();
    return 'unknown error';
}

async function getOptionalExportSection<T>(
    promise: Promise<T>,
    fallback: T,
    sectionName: string,
): Promise<OptionalExportSection<T>> {
    try {
        return { value: await promise };
    } catch (error) {
        return {
            value: fallback,
            warning: `${sectionName} 暂不可用：${getExportErrorMessage(error)}`,
        };
    }
}

function incrementCount(target: Record<string, number>, rawKey: unknown, fallback: string): void {
    const key = String(rawKey ?? '').trim() || fallback;
    target[key] = (target[key] ?? 0) + 1;
}

function getProfileItemEvidenceCount(item: any): number {
    if (Array.isArray(item?.evidenceRefs)) return item.evidenceRefs.length;
    if (typeof item?.evidenceRefs === 'string') {
        try {
            const parsed = JSON.parse(item.evidenceRefs);
            return Array.isArray(parsed) ? parsed.length : 0;
        } catch {
            return 0;
        }
    }
    if (Array.isArray(item?.evidence_refs)) return item.evidence_refs.length;
    if (typeof item?.evidence_refs === 'string') {
        try {
            const parsed = JSON.parse(item.evidence_refs);
            return Array.isArray(parsed) ? parsed.length : 0;
        } catch {
            return 0;
        }
    }
    return 0;
}

function buildProfileExportAudit(items: any[]): ProfileExportAudit {
    const byStatus: Record<string, number> = {};
    const byItemType: Record<string, number> = {};
    const bySourceKind: Record<string, number> = {};

    let confirmedItems = 0;
    let pendingConfirmationItems = 0;
    let usableProfileItems = 0;
    let withoutEvidenceItems = 0;
    let activeItems = 0;
    let retractedItems = 0;
    let archivedItems = 0;
    let supersededItems = 0;

    for (const item of items) {
        const status = String(item?.status ?? item?.item_status ?? '').trim() || 'unknown';
        const userConfirmed = Boolean(item?.userConfirmed ?? item?.user_confirmed);

        incrementCount(byStatus, status, 'unknown');
        incrementCount(byItemType, item?.itemType ?? item?.item_type, 'unknown');
        incrementCount(bySourceKind, item?.sourceKind ?? item?.source_kind, 'unknown');

        if (status === 'active') activeItems += 1;
        if (status === 'retracted') retractedItems += 1;
        if (status === 'archived') archivedItems += 1;
        if (status === 'superseded') supersededItems += 1;
        if (userConfirmed) confirmedItems += 1;
        if (!userConfirmed || status === 'pending_confirm') pendingConfirmationItems += 1;
        if (userConfirmed && status === 'active') usableProfileItems += 1;
        if (getProfileItemEvidenceCount(item) === 0) withoutEvidenceItems += 1;
    }

    const exportedProfileItems = items.length;
    const evidenceBackedItems = exportedProfileItems - withoutEvidenceItems;

    return {
        exportedProfileItems,
        activeItems,
        retractedItems,
        archivedItems,
        supersededItems,
        inactiveAuditItems: retractedItems + archivedItems + supersededItems,
        confirmedItems,
        pendingConfirmationItems,
        usableProfileItems,
        heldForConfirmationItems: exportedProfileItems - usableProfileItems,
        withoutEvidenceItems,
        confirmationRate: exportedProfileItems > 0 ? confirmedItems / exportedProfileItems : 0,
        evidenceCoverageRate: exportedProfileItems > 0 ? evidenceBackedItems / exportedProfileItems : 0,
        byStatus,
        byItemType,
        bySourceKind,
        personalizationBoundary: {
            rule: 'Only active profile items with userConfirmed=true are eligible for personalization and provider context.',
            usableProfileItems,
            heldForConfirmationItems: exportedProfileItems - usableProfileItems,
        },
    };
}

/**
 * 用户画像相关消息处理器
 * 处理所有与用户画像、权重配置、数据融合等相关的消息
 *
 * Migrated from memorySystem to MemoryServiceClient HTTP backend.
 */
export class UserProfileMessageHandler {

    /**
     * 处理用户画像相关的消息
     * @param request 消息请求对象
     * @param sender 消息发送者
     * @param sendResponse 响应回调函数
     * @returns boolean 是否处理了该消息
     */
    public static handleMessage(request: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void): boolean {

        // 处理用户画像获取请求
        if (request.type === 'GET_USER_PROFILE') {
            console.log('处理用户画像获取请求');
            const client = getMemoryServiceClient();
            const maxItems = normalizeProfileItemsMaxItems(request.maxItems);
            Promise.all([
                client.getUserCore(),
                getProfileItemsForView(client, maxItems),
                client.getOpinions({ limit: 50 })
            ])
            .then(([coreResult, profileItems, opinions]) => {
                const viewModel = buildUserProfileViewModel({
                    core: coreResult.content,
                    items: profileItems.items,
                    totalItems: profileItems.total,
                    truncated: profileItems.truncated,
                    viewLimit: profileItems.viewLimit,
                    opinions: opinions.items,
                    totalOpinions: opinions.total,
                });
                console.log('用户画像获取成功');
                sendResponse({
                    success: true,
                    data: {
                        profile: {
                            core: coreResult.content,
                            items: profileItems.items,
                            totalItems: profileItems.total,
                            loadedItems: profileItems.items.length,
                            truncated: profileItems.truncated,
                            viewLimit: profileItems.viewLimit,
                        },
                        analysis: {
                            opinions: opinions.items,
                            totalOpinions: opinions.total,
                        },
                        viewModel,
                    }
                });
            })
            .catch(error => {
                console.error('用户画像获取失败:', error);
                sendResponse({
                    success: false,
                    error: error.message
                });
            });
            return true;
        }

        // 处理显式重要性标记请求
        if (request.type === 'SET_EXPLICIT_IMPORTANCE') {
            console.log('处理显式重要性标记请求:', request);
            const { itemId, importance } = request;
            const normalizedImportance = Number(importance);

            if (!itemId || !Number.isFinite(normalizedImportance)) {
                sendResponse({
                    success: false,
                    error: '重要性参数无效',
                });
                return true;
            }

            const clampedImportance = Math.max(0, Math.min(1, normalizedImportance));

            const client = getMemoryServiceClient();
            client.updateProfileItem(itemId, {
                confidence: clampedImportance,
                salienceScore: clampedImportance,
                status: 'active'
            })
            .then(() => client.confirmProfileItem(itemId))
            .then(result => {
                console.log('重要性标记设置结果:', result);
                sendResponse({
                    success: true,
                    data: result,
                    message: '重要性标记设置成功'
                });
            })
            .catch(error => {
                console.error('重要性标记设置失败:', error);
                sendResponse({
                    success: false,
                    error: error.message
                });
            });
            return true;
        }

        if (request.type === 'CONFIRM_PROFILE_ITEM') {
            console.log('处理画像条目确认请求:', request.itemId);
            const { itemId } = request;

            if (!itemId) {
                sendResponse({
                    success: false,
                    error: '缺少画像条目ID',
                });
                return true;
            }

            const client = getMemoryServiceClient();
            client.confirmProfileItem(itemId)
            .then(result => {
                sendResponse({
                    success: true,
                    data: result,
                    message: '画像条目已确认'
                });
            })
            .catch(error => {
                console.error('画像条目确认失败:', error);
                sendResponse({
                    success: false,
                    error: error.message,
                    message: '画像条目确认失败'
                });
            });
            return true;
        }

        if (request.type === 'RETRACT_PROFILE_ITEM') {
            console.log('处理画像条目排除请求:', request.itemId);
            const { itemId } = request;

            if (!itemId) {
                sendResponse({
                    success: false,
                    error: '缺少画像条目ID',
                });
                return true;
            }

            const client = getMemoryServiceClient();
            client.deleteProfileItem(itemId)
            .then(result => {
                sendResponse({
                    success: true,
                    data: result,
                    message: '画像条目已排除'
                });
            })
            .catch(error => {
                console.error('画像条目排除失败:', error);
                sendResponse({
                    success: false,
                    error: error.message,
                    message: '画像条目排除失败'
                });
            });
            return true;
        }

        if (request.type === 'RESTORE_PROFILE_ITEM') {
            console.log('处理画像条目恢复请求:', request.itemId);
            const { itemId } = request;

            if (!itemId) {
                sendResponse({
                    success: false,
                    error: '缺少画像条目ID',
                });
                return true;
            }

            const client = getMemoryServiceClient();
            client.restoreProfileItem(itemId)
            .then(result => {
                sendResponse({
                    success: true,
                    data: result,
                    message: '画像条目已恢复'
                });
            })
            .catch(error => {
                console.error('画像条目恢复失败:', error);
                sendResponse({
                    success: false,
                    error: error.message,
                    message: '画像条目恢复失败'
                });
            });
            return true;
        }

        if (request.type === 'GET_RETRACTED_PROFILE_ITEMS') {
            console.log('处理已排除画像条目获取请求');

            (async () => {
                try {
                    const client = getMemoryServiceClient();
                    const maxItems = normalizeProfileItemsMaxItems(request.maxItems);
                    const profileItems = await getProfileItemsForView(
                        client,
                        maxItems,
                        { status: 'retracted' },
                    );

                    sendResponse({
                        success: true,
                        data: profileItems,
                        message: '已排除画像条目获取成功',
                    });
                } catch (error) {
                    console.error('已排除画像条目获取失败:', error);
                    sendResponse({
                        success: false,
                        error: error.message,
                        message: '已排除画像条目获取失败',
                    });
                }
            })();
            return true;
        }

        if (request.type === 'CREATE_PROFILE_ITEM') {
            console.log('处理显式画像条目创建请求:', request);
            const { itemType, itemKey, itemValue, confidence } = request;
            const normalizedType = String(itemType || '').trim();
            const normalizedKey = String(itemKey || '').trim();
            const normalizedValue = String(itemValue || '').trim();

            if (!normalizedType || !normalizedKey || !normalizedValue) {
                sendResponse({
                    success: false,
                    error: '画像类型、键和值不能为空',
                });
                return true;
            }

            const client = getMemoryServiceClient();
            client.createProfileItem({
                itemType: normalizedType,
                itemKey: normalizedKey,
                itemValue: normalizedValue,
                confidence: Number.isFinite(Number(confidence))
                    ? Math.max(0, Math.min(1, Number(confidence)))
                    : 1,
                evidenceRefs: [{
                    sourceType: 'manual',
                    source: 'user_profile_page',
                    capturedAt: Date.now(),
                }],
            })
            .then(result => {
                sendResponse({
                    success: true,
                    data: result,
                    message: '画像条目已添加'
                });
            })
            .catch(error => {
                console.error('画像条目创建失败:', error);
                sendResponse({
                    success: false,
                    error: error.message,
                    message: '画像条目创建失败'
                });
            });
            return true;
        }

        // 处理用户画像导出请求
        if (request.type === 'EXPORT_USER_PROFILE') {
            console.log('处理用户画像导出请求');

            (async () => {
                try {
                    const client = getMemoryServiceClient();
                    const [coreSection, profileItems, healthSection, statsSection] =
                        await Promise.all([
                        getOptionalExportSection(
                            client.getUserCore(),
                            { content: '' },
                            '核心画像摘要',
                        ),
                        getProfileItemsForView(
                            client,
                            Number.POSITIVE_INFINITY,
                            { status: 'all' },
                        ),
                        getOptionalExportSection<any>(
                            client.getHealth(),
                            null,
                            '系统健康诊断',
                        ),
                        getOptionalExportSection<any>(
                            client.getStats(),
                            null,
                            '实体统计诊断',
                        ),
                    ]);

                    console.log('用户画像导出数据准备完成');

                    const coreResult = coreSection.value;
                    const healthStatus = healthSection.value;
                    const stats = statsSection.value;
                    const profileAudit = buildProfileExportAudit(profileItems.items);
                    const currentProfileItems = profileItems.items.filter((item) => {
                        const status = String(item?.status ?? item?.item_status ?? '').trim();
                        return status === 'active' || status === 'pending_confirm';
                    });
                    const inactiveAuditItems = profileItems.items.filter((item) => {
                        const status = String(item?.status ?? item?.item_status ?? '').trim();
                        return ['retracted', 'archived', 'superseded'].includes(status);
                    });
                    const exportWarnings = [
                        coreSection.warning,
                        healthSection.warning,
                        statsSection.warning,
                        profileItems.truncated
                            ? `画像条目导出被截断：已导出 ${profileItems.items.length}/${profileItems.total} 条`
                            : undefined,
                    ].filter(Boolean) as string[];

                    const viewModel = buildUserProfileViewModel({
                        core: coreResult.content,
                        items: currentProfileItems,
                        totalItems: currentProfileItems.length,
                        truncated: false,
                    });

                    // 构建导出数据结构
                    const exportData = {
                        // 基本信息
                        exportInfo: {
                            exportTime: new Date().toISOString(),
                            exportTimestamp: Date.now(),
                            version: '2.1',
                            exportType: 'complete_user_profile',
                            pagination: {
                                exportedProfileItems: profileItems.items.length,
                                totalProfileItems: profileItems.total,
                                truncated: profileItems.truncated,
                                statusScope: 'all',
                            },
                            warnings: exportWarnings,
                            optionalSections: {
                                userCore: {
                                    available: !coreSection.warning,
                                },
                                systemHealth: {
                                    available: !healthSection.warning,
                                },
                                entityStatistics: {
                                    available: !statsSection.warning,
                                },
                            },
                            profileAudit,
                        },

                        // 用户画像核心数据
                        userProfile: {
                            core: coreResult.content,
                            items: profileItems.items,
                            currentItems: currentProfileItems,
                            inactiveAuditItems,
                            totalItems: profileItems.total,
                            currentTotalItems: currentProfileItems.length,
                            viewModel: viewModel.profile,
                        },

                        // 系统状态信息
                        systemStatus: {
                            healthAvailable: Boolean(healthStatus),
                            isInitialized: healthStatus?.status === 'ok',
                            cloudConnected: Boolean(healthStatus?.database?.connected),
                            databaseStats: {
                                messageCount: healthStatus?.database?.messageCount ?? 0,
                                entityCount: healthStatus?.database?.entityCount ?? 0,
                                chunkCount: healthStatus?.database?.chunkCount ?? 0
                            },
                            warning: healthSection.warning,
                        },

                        // 实体统计信息
                        entityStatistics: {
                            statsAvailable: Boolean(stats),
                            entityCounts: stats?.entities?.byType ?? {},
                            totalEntities: stats?.entities?.total ?? 0,
                            totalRelationships: stats?.relationships?.total ?? 0,
                            messagesTotal: stats?.messages?.total ?? 0,
                            messagesToday: stats?.messages?.today ?? 0,
                            messagesThisWeek: stats?.messages?.thisWeek ?? 0,
                            warning: statsSection.warning,
                        },

                        // 生成用户友好的总结
                        exportSummary: {
                            profileCompleteness: profileItems.truncated
                                ? '已截断'
                                : profileItems.total > 0
                                    ? '完整'
                                    : '部分',
                            totalInteractions: viewModel.profile.statistics.totalInteractions,
                            averageDailyActivity: viewModel.profile.statistics.averageDailyActivity,
                            totalProfileItems: profileItems.total,
                            exportedProfileItems: profileItems.items.length,
                            confirmedProfileItems: profileAudit.confirmedItems,
                            pendingConfirmationItems: profileAudit.pendingConfirmationItems,
                            usableProfileItems: profileAudit.usableProfileItems,
                            heldForConfirmationItems: profileAudit.heldForConfirmationItems,
                            retractedProfileItems: profileAudit.retractedItems,
                            inactiveAuditItems: profileAudit.inactiveAuditItems,
                            withoutEvidenceItems: profileAudit.withoutEvidenceItems,
                            totalEntities: stats?.entities?.total ?? 0,
                            dataQuality: healthStatus?.database?.connected
                                ? '良好'
                                : exportWarnings.length > 0
                                    ? '部分诊断缺失'
                                    : '离线模式'
                        }
                    };

                    sendResponse({
                        success: true,
                        data: exportData,
                        message: '用户画像导出数据准备成功'
                    });
                } catch (error) {
                    console.error('用户画像导出失败:', error);
                    sendResponse({
                        success: false,
                        error: getExportErrorMessage(error),
                        message: '用户画像导出失败'
                    });
                }
            })();
            return true;
        }

        // 处理权重衰变配置更新请求
        if (request.type === 'UPDATE_WEIGHT_DECAY_CONFIG') {
            console.log('处理权重衰变配置更新请求:', request.config);

            // 验证配置参数
            const config = request.config;
            if (!config || typeof config !== 'object') {
                sendResponse({
                    success: false,
                    error: '配置参数无效',
                    message: '权重衰变配置更新失败'
                });
                return true;
            }

            // 参数范围验证
            const validation = {
                baseDecayRate: config.baseDecayRate >= 0.01 && config.baseDecayRate <= 0.2,
                maxWeight: config.maxWeight >= 0.5 && config.maxWeight <= 2.0,
                minWeight: config.minWeight >= 0.001 && config.minWeight <= 0.1,
                actionWeights: config.actionWeights && typeof config.actionWeights === 'object'
            };

            if (!validation.baseDecayRate || !validation.maxWeight || !validation.minWeight || !validation.actionWeights) {
                sendResponse({
                    success: false,
                    error: '配置参数超出有效范围',
                    message: '权重衰变配置更新失败'
                });
                return true;
            }

            try {
                // 构建完整的权重衰变配置
                const weightDecayConfig = {
                    baseDecayRate: config.baseDecayRate,
                    maxWeight: config.maxWeight,
                    minWeight: config.minWeight,
                    actionWeights: config.actionWeights,
                    decayModifiers: {
                        explicitImportance: 0.5,
                        recentActivity: 0.3,
                        consistentEngagement: 0.4
                    }
                };

                // 保存配置到存储
                chrome.storage.local.set({
                    weightDecayConfig: weightDecayConfig,
                    weightDecayConfigUpdated: Date.now()
                }, () => {
                    console.log('权重衰变配置已保存:', weightDecayConfig);

                    sendResponse({
                        success: true,
                        data: weightDecayConfig,
                        message: '权重衰变配置更新成功'
                    });
                });

            } catch (error) {
                console.error('权重衰变配置更新失败:', error);
                sendResponse({
                    success: false,
                    error: error.message,
                    message: '权重衰变配置更新失败'
                });
            }
            return true;
        }

        // 处理用户上下文配置融合请求
        if (request.type === 'FUSE_USER_CONTEXT_CONFIG') {
            console.log('处理用户上下文配置融合请求:', request.userContextConfig);

            // 验证输入数据
            const userContextConfig = request.userContextConfig;
            if (!userContextConfig || typeof userContextConfig !== 'object') {
                sendResponse({
                    success: false,
                    error: '用户上下文配置无效',
                    message: '数据融合失败'
                });
                return true;
            }

            (async () => {
                try {
                    const client = getMemoryServiceClient();
                    await storeExplicitUserContextConfig(userContextConfig, client);

                    console.log('用户上下文配置融合成功');

                    // Retrieve the updated core profile
                    const coreResult = await client.getUserCore();
                    const profileItems = await getProfileItemsForView(client);

                    sendResponse({
                        success: true,
                        message: '用户上下文配置融合成功',
                        data: {
                            fusedProfile: {
                                core: coreResult.content,
                                items: profileItems.items,
                            },
                            fusedInterests: profileItems.items.filter(
                                (item: any) => item.itemType === 'interest' || item.itemType === 'preference'
                            )
                        }
                    });
                } catch (error) {
                    console.error('用户上下文配置融合失败:', error);
                    sendResponse({
                        success: false,
                        error: error.message,
                        message: '数据融合失败'
                    });
                }
            })();
            return true;
        }

        // 处理获取融合用户画像请求
        if (request.type === 'GET_FUSED_USER_PROFILE') {
            console.log('处理获取融合用户画像请求');

            (async () => {
                try {
                    const client = getMemoryServiceClient();
                    const maxItems = normalizeProfileItemsMaxItems(request.maxItems);
                    const [coreResult, profileItems, opinions] = await Promise.all([
                        client.getUserCore(),
                        getProfileItemsForView(client, maxItems),
                        client.getOpinions({ limit: 50 })
                    ]);
                    const viewModel = buildUserProfileViewModel({
                        core: coreResult.content,
                        items: profileItems.items,
                        totalItems: profileItems.total,
                        truncated: profileItems.truncated,
                        viewLimit: profileItems.viewLimit,
                        opinions: opinions.items,
                        totalOpinions: opinions.total,
                    });

                    console.log('融合用户画像获取成功');
                    sendResponse({
                        success: true,
                        data: {
                            profile: {
                                core: coreResult.content,
                                items: profileItems.items,
                                totalItems: profileItems.total,
                                loadedItems: profileItems.items.length,
                                truncated: profileItems.truncated,
                                viewLimit: profileItems.viewLimit,
                            },
                            analysis: {
                                opinions: opinions.items,
                                totalOpinions: opinions.total,
                            },
                            fusedInterests: profileItems.items.filter(
                                (item: any) => item.itemType === 'interest' || item.itemType === 'preference'
                            ),
                            viewModel,
                        },
                        message: '融合用户画像获取成功'
                    });
                } catch (error) {
                    console.error('获取融合用户画像失败:', error);
                    sendResponse({
                        success: false,
                        error: error.message,
                        message: '获取融合用户画像失败'
                    });
                }
            })();
            return true;
        }

        // 处理权重自适应调整请求
        if (request.type === 'ADAPTIVE_WEIGHT_ADJUSTMENT') {
            console.log('处理权重自适应调整请求');

            (async () => {
                try {
                    const client = getMemoryServiceClient();
                    // Fetch all profile items, then re-score and update them
                    const { items } = await getProfileItemsForView(client);

                    for (const item of items) {
                        // Simple adaptive: boost confidence for frequently-accessed items
                        const newConfidence = Math.min(1, (item.confidence || 0.5) * 1.05);
                        await client.updateProfileItem(item.id, {
                            confidence: newConfidence,
                        });
                    }

                    console.log('权重自适应调整完成');
                    sendResponse({
                        success: true,
                        message: '权重自适应调整完成'
                    });
                } catch (error) {
                    console.error('权重自适应调整失败:', error);
                    sendResponse({
                        success: false,
                        error: error.message,
                        message: '权重自适应调整失败'
                    });
                }
            })();
            return true;
        }

        // 处理独立用户配置存储请求
        if (request.type === 'STORE_INDEPENDENT_USER_CONFIG') {
            console.log('处理独立用户配置存储请求:', request.config);

            // 验证配置数据
            const config = request.config;
            if (!config || typeof config !== 'object') {
                sendResponse({
                    success: false,
                    error: '配置数据无效',
                    message: '独立用户配置存储失败'
                });
                return true;
            }

            (async () => {
                try {
                    const client = getMemoryServiceClient();
                    const configWithMetadata = {
                        ...config,
                        lastUpdated: Date.now(),
                        version: config.version || '1.0'
                    };

                    const stored = await storeIndependentUserConfig(
                        configWithMetadata,
                        client,
                    );

                    console.log('独立用户配置存储成功');
                    sendResponse({
                        success: true,
                        message: '独立用户配置存储成功',
                        data: stored.config,
                        operation: stored.operation,
                    });
                } catch (error) {
                    console.error('独立用户配置存储失败:', error);
                    sendResponse({
                        success: false,
                        error: error.message,
                        message: '独立用户配置存储失败'
                    });
                }
            })();
            return true;
        }

        // 处理独立用户配置获取请求
        if (request.type === 'GET_INDEPENDENT_USER_CONFIG') {
            console.log('处理独立用户配置获取请求');

            (async () => {
                try {
                    const client = getMemoryServiceClient();
                    const config = await getIndependentUserConfig(client);

                    if (config) {
                        console.log('独立用户配置获取成功');
                        sendResponse({
                            success: true,
                            data: config,
                            message: '独立用户配置获取成功'
                        });
                    } else {
                        // 配置不存在，返回默认配置
                        console.log('云端配置不存在，返回默认配置');
                        sendResponse({
                            success: true,
                            data: null,
                            message: '未找到云端配置，可以使用默认配置'
                        });
                    }
                } catch (error) {
                    console.error('获取独立用户配置失败:', error);
                    sendResponse({
                        success: false,
                        error: error.message,
                        message: '获取独立用户配置失败'
                    });
                }
            })();
            return true;
        }

        // 处理主动推荐生成请求
        if (request.type === 'GENERATE_PROACTIVE_RECOMMENDATIONS') {
            console.log('处理主动推荐生成请求');

            (async () => {
                try {
                    const client = getMemoryServiceClient();
                    // Fetch profile items to build recommendations from
                    const { items } = await getProfileItemsForView(client);

                    // Simple recommendation algorithm based on profile items
                    const recommendations: Array<{
                        id: string;
                        type: 'content' | 'action' | 'connection' | 'learning';
                        title: string;
                        description: string;
                        confidence: number;
                        reason: string;
                        actionUrl?: string;
                        priority: 'high' | 'medium' | 'low';
                    }> = [];

                    // Find technology-related items for learning recommendations
                    const techItems = items.filter(
                        (item: any) => item.itemType === 'technology' || item.itemType === 'interest'
                    );

                    // Sort by confidence/salience (higher = more relevant)
                    techItems.sort((a: any, b: any) => (b.confidence || 0) - (a.confidence || 0));

                    const topTech = techItems[0];
                    if (topTech) {
                        const name = topTech.itemKey || topTech.itemValue || 'Unknown';
                        recommendations.push({
                            id: `tech_learning_${name}`,
                            type: 'learning',
                            title: `${name} 高级特性`,
                            description: `学习更多关于 ${name} 的高级用法和最佳实践`,
                            reason: `基于您对 ${name} 的高度关注`,
                            confidence: 0.8,
                            priority: 'medium'
                        });
                    }

                    console.log('主动推荐生成成功');
                    sendResponse({
                        success: true,
                        data: recommendations.slice(0, 5),
                        message: `生成了 ${Math.min(recommendations.length, 5)} 个个性化推荐`
                    });
                } catch (error) {
                    console.error('生成主动推荐失败:', error);
                    sendResponse({
                        success: false,
                        error: error.message,
                        message: '生成主动推荐失败'
                    });
                }
            })();
            return true;
        }

        // 没有找到匹配的用户画像相关消息类型
        return false;
    }
}
