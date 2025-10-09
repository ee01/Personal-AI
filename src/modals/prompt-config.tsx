/**
 * 提示词和用户上下文配置管理界面
 * 支持自定义提示词、用户信息、团队配置等
 */

import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { useState, useEffect } from 'react';

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
    customPrompts: CustomPrompts;
    userContextConfig: UserContextConfig;
}

type TabType = 'prompts' | 'personal' | 'team' | 'work' | 'communication' | 'analysis';

const PromptConfig: React.FC = () => {
    const [activeTab, setActiveTab] = useState<TabType>('prompts');
    const [statusMessage, setStatusMessage] = useState('');
    const [statusType, setStatusType] = useState<'success' | 'error' | ''>('');
    const [currentUserInfo, setCurrentUserInfo] = useState({ name: '', email: '' });
    
    const [configData, setConfigData] = useState<ConfigData>({
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

    useEffect(() => {
        loadCurrentUserInfo();
        loadFromStorage();
    }, []);

    const loadCurrentUserInfo = async () => {
        try {
            const { userinfo } = await chrome.storage.local.get('userinfo');
            if (userinfo) {
                const displayName = userinfo.fullName || userinfo.username || '未知用户';
                const displayEmail = userinfo.userEmail || '未知邮箱';
                
                setCurrentUserInfo({ name: displayName, email: displayEmail });
                
                // 更新配置数据中的基本信息
                setConfigData(prev => ({
                    ...prev,
                    userContextConfig: {
                        ...prev.userContextConfig,
                        personalInfo: {
                            ...prev.userContextConfig.personalInfo,
                            name: displayName,
                            email: displayEmail
                        }
                    }
                }));
            }
        } catch (error) {
            console.error('加载用户信息失败:', error);
        }
    };

    const loadFromStorage = async () => {
        try {
            // 🆕 优先从云端加载配置
            console.log('尝试从云端加载独立用户配置...');
            
            const cloudResponse = await chrome.runtime.sendMessage({
                type: 'GET_INDEPENDENT_USER_CONFIG'
            });
            
            if (cloudResponse && cloudResponse.success && cloudResponse.data) {
                // 使用云端配置
                console.log('云端配置加载成功:', cloudResponse.data);
                setConfigData(prev => ({
                    customPrompts: { ...prev.customPrompts, ...cloudResponse.data.customPrompts },
                    userContextConfig: { ...prev.userContextConfig, ...cloudResponse.data.userContextConfig }
                }));
                showStatusMessage('配置已从云端加载', 'success');
            } else {
                // 降级：从本地存储加载并迁移到云端
                console.log('云端配置不存在，尝试从本地加载并迁移...');
                await migrateFromLocalToCloud();
            }
        } catch (error) {
            console.error('加载配置失败:', error);
            showStatusMessage('加载配置失败: ' + error.message, 'error');
            
            // 降级：尝试从本地加载
            try {
                const result = await chrome.storage.local.get(['customPrompts', 'userContextConfig']);
                if (result.customPrompts || result.userContextConfig) {
                    setConfigData(prev => ({
                        customPrompts: { ...prev.customPrompts, ...result.customPrompts },
                        userContextConfig: { ...prev.userContextConfig, ...result.userContextConfig }
                    }));
                    showStatusMessage('已从本地缓存加载配置', 'success');
                }
            } catch (localError) {
                console.error('本地配置加载也失败:', localError);
            }
        }
    };

    // 🆕 数据迁移：从本地存储迁移到云端
    const migrateFromLocalToCloud = async () => {
        try {
            const result = await chrome.storage.local.get(['customPrompts', 'userContextConfig']);
            
            if (result.customPrompts || result.userContextConfig) {
                console.log('发现本地配置，开始迁移到云端...');
                
                const localConfig = {
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
                        customPrompts: { ...prev.customPrompts, ...localConfig.customPrompts },
                        userContextConfig: { ...prev.userContextConfig, ...localConfig.userContextConfig }
                    }));
                    
                    // 删除本地配置（可选）
                    try {
                        await chrome.storage.local.remove(['customPrompts', 'userContextConfig']);
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

    const saveConfiguration = async () => {
        try {
            const updatedConfig = {
                customPrompts: configData.customPrompts,
                userContextConfig: {
                    ...configData.userContextConfig,
                    lastUpdated: Date.now(),
                    version: '1.0'
                }
            };
            
            console.log('保存配置到云端...', updatedConfig);
            
            // 🆕 保存到云端
            const response = await chrome.runtime.sendMessage({
                type: 'STORE_INDEPENDENT_USER_CONFIG',
                config: updatedConfig
            });
            
            if (response && response.success) {
                console.log('配置保存到云端成功');
                setConfigData({
                    customPrompts: updatedConfig.customPrompts,
                    userContextConfig: updatedConfig.userContextConfig
                });
                showStatusMessage('配置已保存到云端', 'success');
                
                // 可选：同时保存到本地作为备份
                try {
                    await chrome.storage.local.set({
                        customPrompts: updatedConfig.customPrompts,
                        userContextConfig: updatedConfig.userContextConfig,
                        cloudSyncTime: Date.now()
                    });
                    console.log('配置也已备份到本地');
                } catch (localError) {
                    console.warn('本地备份失败:', localError);
                }
            } else {
                throw new Error(response?.error || '云端保存失败');
            }
            
        } catch (error) {
            console.error('保存配置失败:', error);
            showStatusMessage('保存配置失败: ' + error.message, 'error');
            
            // 降级：保存到本地
            try {
                console.log('降级到本地保存...');
                await chrome.storage.local.set({
                    customPrompts: configData.customPrompts,
                    userContextConfig: {
                        ...configData.userContextConfig,
                        lastUpdated: Date.now()
                    }
                });
                showStatusMessage('配置已保存到本地（云端暂不可用）', 'success');
            } catch (localError) {
                console.error('本地保存也失败:', localError);
                showStatusMessage('配置保存完全失败: ' + localError.message, 'error');
            }
        }
    };

    // 🆕 触发数据融合到用户画像
    const triggerDataFusion = async () => {
        try {
            console.log('开始将配置融合到用户画像...');
            showStatusMessage('正在融合配置到用户画像...', 'success');
            
            const response = await chrome.runtime.sendMessage({
                type: 'FUSE_USER_CONTEXT_CONFIG',
                userContextConfig: configData.userContextConfig
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
        }
    };

    const resetToDefaults = () => {
        if (confirm('确定要重置所有配置为默认值吗？此操作不可撤销。')) {
            const savedUserInfo = {
                name: configData.userContextConfig.personalInfo.name,
                email: configData.userContextConfig.personalInfo.email
            };
            
            setConfigData({
                customPrompts: {
                    message: { enabled: false, content: '', position: 'after_analysis_guide' },
                    project: { enabled: false, content: '', position: 'after_analysis_guide' }
                },
                userContextConfig: {
                    personalInfo: {
                        name: savedUserInfo.name,
                        email: savedUserInfo.email,
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
                    lastUpdated: Date.now(),
                    version: '1.0'
                }
            });
            
            showStatusMessage('配置已重置为默认值', 'success');
        }
    };

    const showStatusMessage = (message: string, type: 'success' | 'error') => {
        setStatusMessage(message);
        setStatusType(type);
        setTimeout(() => {
            setStatusMessage('');
            setStatusType('');
        }, 3000);
    };

    const addToArray = (path: string, value = '') => {
        const keys = path.split('.');
        setConfigData(prev => {
            const newConfig = { ...prev };
            let current: any = newConfig;
            
            for (let i = 0; i < keys.length - 1; i++) {
                current = current[keys[i]];
            }
            
            const lastKey = keys[keys.length - 1];
            if (Array.isArray(current[lastKey])) {
                current[lastKey] = [...current[lastKey], value];
            }
            
            return newConfig;
        });
    };

    const removeFromArray = (path: string, index: number) => {
        const keys = path.split('.');
        setConfigData(prev => {
            const newConfig = { ...prev };
            let current: any = newConfig;
            
            for (let i = 0; i < keys.length - 1; i++) {
                current = current[keys[i]];
            }
            
            const lastKey = keys[keys.length - 1];
            if (Array.isArray(current[lastKey])) {
                current[lastKey] = current[lastKey].filter((_: any, i: number) => i !== index);
            }
            
            return newConfig;
        });
    };

    const updateValue = (path: string, value: any) => {
        const keys = path.split('.');
        setConfigData(prev => {
            const newConfig = { ...prev };
            let current: any = newConfig;
            
            for (let i = 0; i < keys.length - 1; i++) {
                current = current[keys[i]];
            }
            
            current[keys[keys.length - 1]] = value;
            return newConfig;
        });
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

    const renderTab = () => {
        switch (activeTab) {
            case 'prompts':
                return (
                    <div className="tab-content">
                        <h3>自定义提示词</h3>
                        
                        <div className="field-group">
                            <label>
                                <input
                                    type="checkbox"
                                    checked={configData.customPrompts.message.enabled}
                                    onChange={(e) => updateValue('customPrompts.message.enabled', e.target.checked)}
                                />
                                启用消息分析自定义提示词
                            </label>
                            {configData.customPrompts.message.enabled && (
                                <textarea
                                    value={configData.customPrompts.message.content}
                                    onChange={(e) => updateValue('customPrompts.message.content', e.target.value)}
                                    placeholder="输入消息分析的自定义提示词..."
                                    rows={4}
                                />
                            )}
                        </div>

                        <div className="field-group">
                            <label>
                                <input
                                    type="checkbox"
                                    checked={configData.customPrompts.project.enabled}
                                    onChange={(e) => updateValue('customPrompts.project.enabled', e.target.checked)}
                                />
                                启用项目分析自定义提示词
                            </label>
                            {configData.customPrompts.project.enabled && (
                                <textarea
                                    value={configData.customPrompts.project.content}
                                    onChange={(e) => updateValue('customPrompts.project.content', e.target.value)}
                                    placeholder="输入项目分析的自定义提示词..."
                                    rows={4}
                                />
                            )}
                        </div>
                    </div>
                );

            case 'personal':
                return (
                    <div className="tab-content">
                        <h3>个人信息</h3>
                        <div className="user-info">
                            <p><strong>当前用户:</strong> {currentUserInfo.name}</p>
                            <p><strong>邮箱:</strong> {currentUserInfo.email}</p>
                        </div>
                        
                        <div className="field-group">
                            <label>职位</label>
                            <input
                                type="text"
                                value={configData.userContextConfig.personalInfo.title}
                                onChange={(e) => updateValue('userContextConfig.personalInfo.title', e.target.value)}
                                placeholder="您的职位"
                            />
                        </div>

                        <div className="field-group">
                            <label>部门</label>
                            <input
                                type="text"
                                value={configData.userContextConfig.personalInfo.department}
                                onChange={(e) => updateValue('userContextConfig.personalInfo.department', e.target.value)}
                                placeholder="所在部门"
                            />
                        </div>

                        <div className="field-group">
                            <label>地点</label>
                            <input
                                type="text"
                                value={configData.userContextConfig.personalInfo.location}
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
                                onChange={(e) => updateValue('userContextConfig.stakeholders.directManager', e.target.value)}
                                placeholder="直接主管姓名"
                            />
                        </div>
                    </div>
                );

            case 'work':
                return (
                    <div className="tab-content">
                        <h3>工作关注点</h3>
                        
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

            case 'analysis':
                return (
                    <div className="tab-content">
                        <h3>分析偏好</h3>
                        
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
                <h1>🛠️ 配置管理</h1>
                <div className="config-actions">
                    <button onClick={loadFromStorage} className="reload-btn">重新加载</button>
                    <button onClick={saveConfiguration} className="save-btn">保存配置</button>
                    <button onClick={triggerDataFusion} className="fusion-btn">🔄 融合到用户画像</button>
                    <button onClick={resetToDefaults} className="reset-btn">重置默认</button>
                </div>
            </div>

            {statusMessage && (
                <div className={`status-message ${statusType}`}>
                    {statusMessage}
                </div>
            )}

            <div className="config-tabs">
                {[
                    { id: 'prompts', label: '🤖 提示词' },
                    { id: 'personal', label: '👤 个人信息' },
                    { id: 'work', label: '💼 工作关注' },
                    { id: 'analysis', label: '📊 分析偏好' }
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
                {renderTab()}
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
                    gap: 12px;
                }

                .config-actions button {
                    padding: 8px 16px;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    transition: background-color 0.3s;
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

                .config-tabs {
                    display: flex;
                    margin-bottom: 24px;
                    border-bottom: 1px solid #e0e0e0;
                }

                .config-tab {
                    padding: 12px 24px;
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

                .tab-content h3 {
                    margin-top: 0;
                    color: #2c3e50;
                }

                .field-group {
                    margin-bottom: 20px;
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