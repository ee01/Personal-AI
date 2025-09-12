import { memorySystem } from '../memory';

/**
 * 用户画像相关消息处理器
 * 处理所有与用户画像、权重配置、数据融合等相关的消息
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
        
        // 🆕 处理用户画像相关请求
        if (request.type === 'GET_USER_PROFILE') {
            console.log('处理用户画像获取请求');
            memorySystem.initialize().then(() => {
                memorySystem.getUserProfile()
                .then(result => {
                    console.log('用户画像获取成功:', result);
                    sendResponse({
                        success: true,
                        data: result
                    });
                })
                .catch(error => {
                    console.error('用户画像获取失败:', error);
                    sendResponse({
                        success: false,
                        error: error.message
                    });
                });
            });
            return true;
        }

        // 🆕 处理显式重要性标记请求
        if (request.type === 'SET_EXPLICIT_IMPORTANCE') {
            console.log('处理显式重要性标记请求:', request);
            const { itemId, itemType, importance } = request;
            
            memorySystem.initialize().then(() => {
                memorySystem.setUserExplicitImportance(itemId, itemType, importance)
                .then(success => {
                    console.log('重要性标记设置结果:', success);
                    sendResponse({
                        success: success,
                        message: success ? '重要性标记设置成功' : '重要性标记设置失败'
                    });
                })
                .catch(error => {
                    console.error('重要性标记设置失败:', error);
                    sendResponse({
                        success: false,
                        error: error.message
                    });
                });
            });
            return true;
        }

        // 🆕 处理用户画像导出请求
        if (request.type === 'EXPORT_USER_PROFILE') {
            console.log('处理用户画像导出请求');
            
            memorySystem.initialize().then(() => {
                Promise.all([
                    memorySystem.getUserProfile(),
                    memorySystem.getSystemStatus(),
                    memorySystem.getEntityStatistics()
                ])
                .then(([profileResult, systemStatus, entityStats]) => {
                    console.log('用户画像导出数据准备完成');
                    
                    // 构建导出数据结构
                    const exportData = {
                        // 基本信息
                        exportInfo: {
                            exportTime: new Date().toISOString(),
                            exportTimestamp: Date.now(),
                            version: '1.0',
                            exportType: 'complete_user_profile'
                        },
                        
                        // 用户画像核心数据
                        userProfile: profileResult.profile,
                        userProfileAnalysis: profileResult.analysis,
                        
                        // 系统状态信息
                        systemStatus: {
                            isInitialized: systemStatus.isInitialized,
                            cloudConnected: systemStatus.cloudConnected,
                            lastSyncTime: systemStatus.lastSyncTime,
                            performance: systemStatus.performance
                        },
                        
                        // 实体统计信息
                        entityStatistics: {
                            entityCounts: entityStats.entityCounts,
                            totalEntities: entityStats.totalEntities,
                            totalRelationships: entityStats.totalRelationships,
                            entitiesCreatedToday: entityStats.entitiesCreatedToday,
                            entitiesCreatedThisWeek: entityStats.entitiesCreatedThisWeek,
                            entitiesCreatedThisMonth: entityStats.entitiesCreatedThisMonth
                        },
                        
                        // 生成用户友好的总结
                        exportSummary: {
                            profileCompleteness: profileResult.profile ? '完整' : '部分',
                            totalInteractions: profileResult.profile?.statistics?.totalInteractions || 0,
                            averageDailyActivity: profileResult.profile?.statistics?.averageDailyActivity || 0,
                            topInterestCategories: profileResult.analysis?.topInterests ? Object.keys(profileResult.analysis.topInterests) : [],
                            dataQuality: systemStatus.cloudConnected ? '良好' : '离线模式'
                        }
                    };
                    
                    sendResponse({
                        success: true,
                        data: exportData,
                        message: '用户画像导出数据准备成功'
                    });
                })
                .catch(error => {
                    console.error('用户画像导出失败:', error);
                    sendResponse({
                        success: false,
                        error: error.message,
                        message: '用户画像导出失败'
                    });
                });
            });
            return true;
        }

        // 🆕 处理权重衰变配置更新请求
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

        // 🆕 处理用户上下文配置融合请求
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
                    await memorySystem.initialize()
                    // 执行数据融合
                    const success = await memorySystem.fuseUserContextConfig(userContextConfig);
                    
                    if (success) {
                        console.log('用户上下文配置融合成功');
                        
                        // 可选：获取融合后的用户画像
                        const fusedProfile = await memorySystem.getFusedUserProfile();
                        
                        sendResponse({
                            success: true,
                            message: '用户上下文配置融合成功',
                            data: {
                                fusedProfile: fusedProfile.profile,
                                fusedInterests: fusedProfile.fusedInterests
                            }
                        });
                    } else {
                        sendResponse({
                            success: false,
                            error: '融合操作执行失败',
                            message: '数据融合失败'
                        });
                    }
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

        // 🆕 处理获取融合用户画像请求
        if (request.type === 'GET_FUSED_USER_PROFILE') {
            console.log('处理获取融合用户画像请求');
            
            (async () => {
                try {
                    await memorySystem.initialize()
                    const result = await memorySystem.getFusedUserProfile();
                    
                    console.log('融合用户画像获取成功');
                    sendResponse({
                        success: true,
                        data: result,
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

        // 🆕 处理权重自适应调整请求
        if (request.type === 'ADAPTIVE_WEIGHT_ADJUSTMENT') {
            console.log('处理权重自适应调整请求');
            
            (async () => {
                try {
                    await memorySystem.initialize()
                    await memorySystem.adaptiveWeightAdjustment();
                    
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

        // 🆕 处理独立用户配置存储请求
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
                    await memorySystem.initialize()
                    // 添加时间戳和版本信息
                    const configWithMetadata = {
                        ...config,
                        lastUpdated: Date.now(),
                        version: config.version || '1.0'
                    };

                    const success = await memorySystem.storeIndependentUserConfig(configWithMetadata);
                    
                    if (success) {
                        console.log('独立用户配置存储成功');
                        sendResponse({
                            success: true,
                            message: '独立用户配置存储成功',
                            data: configWithMetadata
                        });
                    } else {
                        sendResponse({
                            success: false,
                            error: '存储操作失败',
                            message: '独立用户配置存储失败'
                        });
                    }
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

        // 🆕 处理独立用户配置获取请求
        if (request.type === 'GET_INDEPENDENT_USER_CONFIG') {
            console.log('处理独立用户配置获取请求');
            
            (async () => {
                try {
                    await memorySystem.initialize()
                    const config = await memorySystem.getIndependentUserConfig();
                    
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

        // 🆕 处理主动推荐生成请求
        if (request.type === 'GENERATE_PROACTIVE_RECOMMENDATIONS') {
            console.log('处理主动推荐生成请求');
            
            (async () => {
                try {
                    await memorySystem.initialize()
                    const recommendations = await memorySystem.generateProactiveRecommendations();
                    
                    console.log('主动推荐生成成功');
                    sendResponse({
                        success: true,
                        data: recommendations,
                        message: `生成了 ${recommendations.length} 个个性化推荐`
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
