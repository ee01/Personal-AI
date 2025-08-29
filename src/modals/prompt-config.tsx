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
            const result = await chrome.storage.local.get(['customPrompts', 'userContextConfig']);
            
            if (result.customPrompts || result.userContextConfig) {
                setConfigData(prev => ({
                    customPrompts: { ...prev.customPrompts, ...result.customPrompts },
                    userContextConfig: { ...prev.userContextConfig, ...result.userContextConfig }
                }));
                showStatusMessage('配置已加载', 'success');
            }
        } catch (error) {
            console.error('加载配置失败:', error);
            showStatusMessage('加载配置失败: ' + error.message, 'error');
        }
    };

    const saveConfiguration = async () => {
        try {
            const updatedConfig = {
                ...configData,
                userContextConfig: {
                    ...configData.userContextConfig,
                    lastUpdated: Date.now()
                }
            };
            
            await chrome.storage.local.set({
                customPrompts: updatedConfig.customPrompts,
                userContextConfig: updatedConfig.userContextConfig
            });
            
            setConfigData(updatedConfig);
            showStatusMessage('配置已保存成功', 'success');
        } catch (error) {
            console.error('保存配置失败:', error);
            showStatusMessage('保存配置失败: ' + error.message, 'error');
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