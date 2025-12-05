import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { useState, useEffect } from 'react';
import { defaultEnvConfig, EnvConfigType, getDefaultEnvConfig } from './utils';
import { agentCoordinator } from './agentWorkflow';
import { IntelligentAgent } from './agentThinking';
import { AgentVisualizer, AgentFlowVisualizer, AgentResultSummary } from './agent-visualizer';
import { DatabaseMaintenanceTool } from './storage/DatabaseMaintenanceTool';
import { EntityEmbeddingRebuildTool } from './storage/EntityEmbeddingRebuildTool';
import V6DataMigrationTool from './storage/V6DataMigrationTool';
import EntityRebuildTool from './storage/EntityRebuildTool';
import { runUserProfileDemo, runUserProfilePerformanceTest } from './services/UserProfileDemo';

// 使用从utils.ts导入的类型
const Options = () => {
    const [config, setConfig] = useState<EnvConfigType>({...defaultEnvConfig});
    const [status, setStatus] = useState<{message: string, type: 'success' | 'error' | ''}>({
        message: '',
        type: ''
    });

    // 页面加载时从 Chrome 存储中获取配置
    useEffect(() => {
        chrome.storage.local.get(['envConfig'], (result) => {
            console.log('result', result);
            if (result.envConfig) {
                setConfig(result.envConfig);
            } else {
                // 如果没有保存过配置，则尝试从 .env 加载
                loadEnvDefaults();
            }
        });
    }, []);

    // 从.env加载默认值（通过background脚本）
    const loadEnvDefaults = async () => {
        try {
            const config = getDefaultEnvConfig();
            setConfig(config);
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

    // 保存配置到 Chrome 存储
    const saveConfig = async () => {
        try {
            await chrome.storage.local.set({ envConfig: config });
            // 通知background脚本更新配置
            await chrome.runtime.sendMessage({
                type: 'UPDATE_ENV_CONFIG',
                config
            });
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

    // 重置配置为默认值
    const resetConfig = () => {
        setConfig({...defaultEnvConfig});
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
                : name === 'SCHEDULED_INTERVAL' || name === 'MESSAGE_ANALYSIS_INTERVAL' || name === 'MESSAGE_CONTEXT_WINDOW' || name === 'CHROMA_PORT'
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
                setConfig(importedConfig);
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
                        }}
                        min="1"
                    />
                    <small style={{ color: '#666', display: 'block', marginTop: '5px' }}>
                        每次分析时额外获取的历史消息时间范围（默认: 5分钟）
                    </small>
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
                            name="ENABLE_BOT"
                            checked={config.ENABLE_BOT}
                            disabled={config.ANALYSIS_TYPE === 'agentThinking'}
                            onChange={handleInputChange}
                        />
                        启用消息提醒 {config.ANALYSIS_TYPE === 'agentThinking' ? '(Agent思考模式下自我决断)' : ''}
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
                <h2>推送设置</h2>
                <div className="form-group">
                    <label htmlFor="BOT_TYPE">消息推送对象</label>
                    <select
                        id="BOT_TYPE"
                        name="BOT_TYPE"
                        value={config.BOT_TYPE}
                        onChange={handleInputChange}
                    >
                        <option value="user">我</option>
                        <option value="team">团队</option>
                    </select>
                </div>
                <div className="form-group">
                    <label htmlFor="BOT_TOKEN">Bot Token</label>
                    <input
                        type="text"
                        id="BOT_TOKEN"
                        name="BOT_TOKEN"
                        value={config.BOT_TOKEN}
                        onChange={handleInputChange}
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="TEAM_ID">团队 ID</label>
                    <input
                        type="text"
                        id="TEAM_ID"
                        name="TEAM_ID"
                        value={config.TEAM_ID}
                        onChange={handleInputChange}
                    />
                </div>
            </div>

            <div className="form-section">
                <h2>向量数据库设置</h2>
                <div className="form-group">
                    <label>
                        <input
                            type="checkbox"
                            name="ENABLE_CHROMA"
                            checked={config.ENABLE_CHROMA}
                            onChange={handleInputChange}
                        />
                        启用 Chroma 向量数据库
                    </label>
                </div>

                {config.ENABLE_CHROMA && (
                    <>
                        <div className="form-group">
                            <label htmlFor="CHROMA_HOST">Chroma 主机地址</label>
                            <input
                                type="text"
                                id="CHROMA_HOST"
                                name="CHROMA_HOST"
                                value={config.CHROMA_HOST}
                                onChange={handleInputChange}
                                placeholder="localhost"
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="CHROMA_PORT">Chroma 端口</label>
                            <input
                                type="number"
                                id="CHROMA_PORT"
                                name="CHROMA_PORT"
                                value={config.CHROMA_PORT}
                                onChange={handleInputChange}
                                placeholder="8000"
                            />
                        </div>

                        <div className="form-group">
                            <label>
                                <input
                                    type="checkbox"
                                    name="CHROMA_SSL"
                                    checked={config.CHROMA_SSL}
                                    onChange={handleInputChange}
                                />
                                启用 SSL 连接
                            </label>
                        </div>
                    </>
                )}
            </div>

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
                <h2>数据库维护</h2>
                <DatabaseMaintenanceTool />
                <EntityRebuildTool />
                <EntityEmbeddingRebuildTool />
                <div className="form-group">
                    <label htmlFor="CHROMA_COLLECTION_NAME">集合名称</label>
                    <input
                        type="text"
                        id="CHROMA_COLLECTION_NAME"
                        name="CHROMA_COLLECTION_NAME"
                        value={config.CHROMA_COLLECTION_NAME}
                        onChange={handleInputChange}
                        placeholder="默认为 <username>-messages"
                    />
                </div>
                <V6DataMigrationTool />
                <UserProfileDemoTool />
            </div>

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



// 用户画像演示工具组件
const UserProfileDemoTool = () => {
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<{message: string, type: 'info' | 'success' | 'error' | 'warning'}>({
        message: '',
        type: 'info'
    });

    // 生成示例用户画像数据
    const generateDemoData = async () => {
        setLoading(true);
        setStatus({message: '正在生成用户画像示例数据...', type: 'info'});
        
        try {
            await runUserProfileDemo();
            
            setStatus({
                message: '✅ 用户画像示例数据生成完成！已创建多个示例用户的向量化画像数据，包含兴趣项、行为模式等信息。',
                type: 'success'
            });
        } catch (error: any) {
            console.error('生成示例数据失败:', error);
            setStatus({
                message: `❌ 生成示例数据失败: ${error.message}`,
                type: 'error'
            });
        } finally {
            setLoading(false);
        }
    };

    // 运行性能测试
    const runPerformanceTest = async () => {
        setLoading(true);
        setStatus({message: '正在运行用户画像性能测试...', type: 'info'});
        
        try {
            await runUserProfilePerformanceTest();
            
            setStatus({
                message: '✅ 性能测试完成！请查看控制台了解详细的性能数据和测试结果。',
                type: 'success'
            });
        } catch (error: any) {
            console.error('性能测试失败:', error);
            setStatus({
                message: `❌ 性能测试失败: ${error.message}`,
                type: 'error'
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="user-profile-demo-tool" style={{ marginTop: '20px', padding: '15px', border: '1px solid #e0e0e0', borderRadius: '8px' }}>
            <h3 style={{ margin: '0 0 15px 0', color: '#333' }}>用户画像系统演示</h3>
            
            <div className="demo-actions" style={{ marginBottom: '15px' }}>
                <button 
                    onClick={generateDemoData} 
                    disabled={loading}
                    style={{ 
                        marginRight: '10px',
                        padding: '8px 16px',
                        backgroundColor: '#4CAF50',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        opacity: loading ? 0.6 : 1
                    }}
                >
                    {loading ? '生成中...' : '生成用户画像示例数据'}
                </button>
                
                <button 
                    onClick={runPerformanceTest} 
                    disabled={loading}
                    style={{ 
                        padding: '8px 16px',
                        backgroundColor: '#2196F3',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        opacity: loading ? 0.6 : 1
                    }}
                >
                    {loading ? '测试中...' : '运行性能测试'}
                </button>
            </div>

            {status.message && (
                <div 
                    className={`status-message ${status.type}`}
                    style={{
                        padding: '10px',
                        border: '1px solid',
                        borderRadius: '4px',
                        backgroundColor: 
                            status.type === 'error' ? '#ffebee' :
                            status.type === 'success' ? '#e8f5e8' :
                            status.type === 'warning' ? '#fff3cd' : '#e3f2fd',
                        borderColor:
                            status.type === 'error' ? '#f44336' :
                            status.type === 'success' ? '#4caf50' :
                            status.type === 'warning' ? '#ff9800' : '#2196f3',
                        color:
                            status.type === 'error' ? '#c62828' :
                            status.type === 'success' ? '#2e7d32' :
                            status.type === 'warning' ? '#ef6c00' : '#1565c0'
                    }}
                >
                    {status.message}
                </div>
            )}

            <div style={{ 
                marginTop: '15px', 
                padding: '10px', 
                backgroundColor: '#f9f9f9', 
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px'
            }}>
                <h4 style={{ margin: '0 0 10px 0' }}>功能说明:</h4>
                <ul style={{ margin: '0', paddingLeft: '20px' }}>
                    <li><strong>生成示例数据：</strong>创建4个不同类型的用户画像示例（React开发者、Python工程师、全栈开发者、八卦达人），展示向量化存储功能</li>
                    <li><strong>性能测试：</strong>测试向量化查询和存储的性能，包括查询速度、批量存储效率等</li>
                    <li><strong>查看结果：</strong>打开浏览器控制台可以看到详细的演示过程和测试结果</li>
                    <li>💡 生成的示例数据包含兴趣项、行为模式、社交关系等向量化记录</li>
                    <li>🔍 可以在内存管理界面中查看生成的用户画像数据</li>
                </ul>
            </div>
        </div>
    );
};

ReactDOM.render(
    <Options />,
    document.getElementById('options-root')
); 
