import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { useState, useEffect } from 'react';
import { defaultEnvConfig, EnvConfigType, getDefaultEnvConfig } from './utils';
import { agentCoordinator } from './agentWorkflow';
import { IntelligentAgent } from './agentThinking';
import { AgentVisualizer, AgentFlowVisualizer, AgentResultSummary } from './agent-visualizer';

// 使用从utils.ts导入的类型
const Options = () => {
    const [config, setConfig] = useState<EnvConfigType>({...defaultEnvConfig});
    const [status, setStatus] = useState<{message: string, type: 'success' | 'error' | ''}>({
        message: '',
        type: ''
    });
    const [enableCustomCollection, setEnableCustomCollection] = useState(false);

    // 页面加载时从 Chrome 存储中获取配置
    useEffect(() => {
        chrome.storage.local.get(['envConfig'], (result) => {
            console.log('result', result);
            if (result.envConfig) {
                setConfig(result.envConfig);
                if (result.envConfig.CHROMA_COLLECTION_NAME) setEnableCustomCollection(true);
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
            if (!enableCustomCollection) {
                config.CHROMA_COLLECTION_NAME = '';
            }
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
                : name === 'SCHEDULED_INTERVAL' || name === 'CHROMA_PORT'
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
                <h2>常规设置</h2>
                <div className="form-group">
                    <label htmlFor="SCHEDULED_INTERVAL">
                        定时分析消息间隔（分钟）
                    </label>
                    <input
                        type="number"
                        id="SCHEDULED_INTERVAL"
                        name="SCHEDULED_INTERVAL"
                        value={config.SCHEDULED_INTERVAL}
                        onChange={(e) => {
                            const numValue = Number(e.target.value);
                            setConfig(prev => ({
                                ...prev,
                                SCHEDULED_INTERVAL: numValue
                            }));
                        }}
                    />
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
                            <label htmlFor="CHROMA_API_URL">Chroma API URL</label>
                            <input
                                type="text"
                                id="CHROMA_API_URL"
                                name="CHROMA_API_URL"
                                value={config.CHROMA_API_URL}
                                onChange={handleInputChange}
                                placeholder="http://localhost:8000"
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
                            />
                        </div>

                        <div className="form-group">
                            <label>
                                <input
                                    type="checkbox"
                                    checked={enableCustomCollection}
                                    onChange={(e) => setEnableCustomCollection(e.target.checked)}
                                />
                                自定义集合名称
                            </label>
                        </div>

                        {enableCustomCollection && (
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
                        )}
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
                <PlaceholderCleanupTool />
                <DatabaseMaintenanceTool />
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

// 占位符清理工具组件
const PlaceholderCleanupTool = () => {
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<{message: string, type: 'info' | 'success' | 'error' | 'warning'}>({
        message: '',
        type: 'info'
    });
    const [placeholders, setPlaceholders] = useState<any[]>([]);
    const [backupEntities, setBackupEntities] = useState<any[]>([]);
    const [showDetails, setShowDetails] = useState(false);
    const [showBackupDetails, setShowBackupDetails] = useState(false);
    const [chromaUrl, setChromaUrl] = useState('http://10.32.56.212:8000');

    // 占位符清理器类
    class PlaceholderCleaner {
        constructor(private chromaUrl: string) {}

        async getUserInfo() {
            try {
                const result = await chrome.storage.local.get(['userinfo']);
                return result.userinfo || { username: 'default-user' };
            } catch (error) {
                console.warn('获取用户信息失败，使用默认值');
                return { username: 'default-user' };
            }
        }

        isPlaceholder(metadata: any) {
            // 方法1: 检查 properties.placeholder 字段
            if (metadata.properties) {
                try {
                    const properties = typeof metadata.properties === 'string' 
                        ? JSON.parse(metadata.properties) 
                        : metadata.properties;
                    
                    if (properties.placeholder === true || properties.createdBy === 'system') {
                        return true;
                    }
                } catch (e) {
                    // 解析失败，继续其他检查
                }
            }

            // 方法2: 检查描述是否为占位符描述
            if (metadata.description === '自动生成的占位符实体' || 
                metadata.description === '本地占位符实体（缺失的关系引用）') {
                return true;
            }

            // 方法3: 检查 importance 是否为占位符的低权重值
            if (metadata.importance === 0.1 && metadata.accessCount === 0) {
                return true;
            }

            // 方法4: 检查名称是否符合占位符模式
            if (metadata.name && metadata.id) {
                const [type, name] = metadata.id.split('_', 2);
                const expectedName = name?.replace(/_/g, ' ') || metadata.id;
                if (metadata.name === expectedName && metadata.importance <= 0.1) {
                    return true;
                }
            }

            return false;
        }

        isBackupEntity(metadata: any) {
            // 检查是否为图关系数据备份实体
            if (metadata.name === '图关系数据备份' || 
                metadata.description === '自动备份的图关系数据') {
                return true;
            }

            // 检查properties中的backupType
            if (metadata.properties) {
                try {
                    const properties = typeof metadata.properties === 'string' 
                        ? JSON.parse(metadata.properties) 
                        : metadata.properties;
                    
                    if (properties.backupType === 'graph_relationships') {
                        return true;
                    }
                } catch (e) {
                    // 解析失败，继续其他检查
                }
            }

            // 检查ID模式
            if (metadata.id && metadata.id.startsWith('graph-backup-')) {
                return true;
            }

            return false;
        }

        async delay(ms: number) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }
    }

    // 扫描占位符
    const scanPlaceholders = async () => {
        setLoading(true);
        setStatus({message: '正在扫描占位符实体...', type: 'info'});
        
        try {
            // 动态加载 ChromaDB 客户端
            let ChromaClient;
            try {
                const chromaModule = await import('chromadb');
                ChromaClient = chromaModule.ChromaClient;
            } catch (error) {
                throw new Error('无法加载 ChromaDB 客户端，请确保应用正在运行');
            }

            const cleaner = new PlaceholderCleaner(chromaUrl);
            const userinfo = await cleaner.getUserInfo();

            // 初始化 ChromaDB 客户端
            const client = new ChromaClient({
                path: chromaUrl
            });

            // 测试连接
            await client.heartbeat();

            // 获取实体集合
            const collectionName = `${userinfo.username}-graph-entities`;
            const collection = await client.getCollection({ 
                name: collectionName,
                embeddingFunction: undefined
            });

            // 获取所有实体
            const result = await collection.get({
                include: ['metadatas' as any]
            });

            if (!result.ids || !result.metadatas) {
                setStatus({message: '集合中没有数据', type: 'info'});
                setPlaceholders([]);
                return;
            }

            // 分别找出占位符实体和备份实体
            const placeholderInfo = [];
            const backupInfo = [];
            
            for (let i = 0; i < result.ids.length; i++) {
                const metadata = result.metadatas[i];
                
                if (cleaner.isPlaceholder(metadata)) {
                    placeholderInfo.push({
                        id: result.ids[i],
                        name: metadata.name,
                        type: metadata.type,
                        description: metadata.description,
                        importance: metadata.importance,
                        properties: metadata.properties
                    });
                } else if (cleaner.isBackupEntity(metadata)) {
                    backupInfo.push({
                        id: result.ids[i],
                        name: metadata.name,
                        type: metadata.type,
                        description: metadata.description,
                        importance: metadata.importance,
                        properties: metadata.properties,
                        created: metadata.created,
                        relationshipCount: metadata.relationshipCount || 0
                    });
                }
            }

            setPlaceholders(placeholderInfo);
            setBackupEntities(backupInfo);
            
            const totalProblemEntities = placeholderInfo.length + backupInfo.length;
            if (totalProblemEntities > 0) {
                setStatus({
                    message: `扫描完成！发现 ${placeholderInfo.length} 个占位符实体，${backupInfo.length} 个备份实体（总共 ${result.ids.length} 个实体）`,
                    type: 'warning'
                });
            } else {
                setStatus({
                    message: `扫描完成！没有发现需要清理的实体（总共 ${result.ids.length} 个实体）`,
                    type: 'success'
                });
            }

        } catch (error: any) {
            console.error('扫描失败:', error);
            setStatus({
                message: `扫描失败: ${error.message}`,
                type: 'error'
            });
            setPlaceholders([]);
            setBackupEntities([]);
        } finally {
            setLoading(false);
        }
    };

    // 清理占位符
    const cleanPlaceholders = async () => {
        if (placeholders.length === 0) {
            setStatus({message: '没有发现占位符，无需清理', type: 'info'});
            return;
        }

        const confirmed = window.confirm(`确定要删除 ${placeholders.length} 个占位符实体吗？此操作不可撤销！`);
        if (!confirmed) return;

        setLoading(true);
        setStatus({message: '正在清理占位符实体...', type: 'info'});

        try {
            // 动态加载 ChromaDB 客户端
            let ChromaClient;
            try {
                const chromaModule = await import('chromadb');
                ChromaClient = chromaModule.ChromaClient;
            } catch (error) {
                throw new Error('无法加载 ChromaDB 客户端');
            }

            const cleaner = new PlaceholderCleaner(chromaUrl);
            const userinfo = await cleaner.getUserInfo();

            // 初始化 ChromaDB 客户端
            const client = new ChromaClient({
                path: chromaUrl
            });

            // 获取实体集合
            const collectionName = `${userinfo.username}-graph-entities`;
            const collection = await client.getCollection({ 
                name: collectionName,
                embeddingFunction: undefined
            });

            // 批量删除占位符
            const placeholderIds = placeholders.map(p => p.id);
            const batchSize = 50;
            let deletedCount = 0;

            for (let i = 0; i < placeholderIds.length; i += batchSize) {
                const batch = placeholderIds.slice(i, i + batchSize);
                
                try {
                    await collection.delete({
                        ids: batch
                    });
                    
                    deletedCount += batch.length;
                    setStatus({
                        message: `已删除 ${deletedCount}/${placeholderIds.length} 个占位符`,
                        type: 'info'
                    });
                    
                    // 批间延迟
                    if (i + batchSize < placeholderIds.length) {
                        await cleaner.delay(100);
                    }
                } catch (error) {
                    console.error(`删除批次失败:`, error);
                }
            }

            setStatus({
                message: `清理完成！删除了 ${deletedCount} 个占位符实体`,
                type: 'success'
            });
            
            // 清空占位符列表
            setPlaceholders([]);

        } catch (error: any) {
            console.error('清理失败:', error);
            setStatus({
                message: `清理失败: ${error.message}`,
                type: 'error'
            });
        } finally {
            setLoading(false);
        }
    };

    // 清理备份实体
    const cleanBackupEntities = async () => {
        if (backupEntities.length === 0) {
            setStatus({message: '没有发现备份实体，无需清理', type: 'info'});
            return;
        }

        const confirmed = window.confirm(`确定要删除 ${backupEntities.length} 个图关系数据备份实体吗？此操作不可撤销！`);
        if (!confirmed) return;

        setLoading(true);
        setStatus({message: '正在清理备份实体...', type: 'info'});

        try {
            // 动态加载 ChromaDB 客户端
            let ChromaClient;
            try {
                const chromaModule = await import('chromadb');
                ChromaClient = chromaModule.ChromaClient;
            } catch (error) {
                throw new Error('无法加载 ChromaDB 客户端');
            }

            const cleaner = new PlaceholderCleaner(chromaUrl);
            const userinfo = await cleaner.getUserInfo();

            // 初始化 ChromaDB 客户端
            const client = new ChromaClient({
                path: chromaUrl
            });

            // 获取实体集合
            const collectionName = `${userinfo.username}-graph-entities`;
            const collection = await client.getCollection({ 
                name: collectionName,
                embeddingFunction: undefined
            });

            // 批量删除备份实体
            const backupIds = backupEntities.map(b => b.id);
            const batchSize = 50;
            let deletedCount = 0;

            for (let i = 0; i < backupIds.length; i += batchSize) {
                const batch = backupIds.slice(i, i + batchSize);
                
                try {
                    await collection.delete({
                        ids: batch
                    });
                    
                    deletedCount += batch.length;
                    setStatus({
                        message: `已删除 ${deletedCount}/${backupIds.length} 个备份实体`,
                        type: 'info'
                    });
                    
                    // 批间延迟
                    if (i + batchSize < backupIds.length) {
                        await cleaner.delay(100);
                    }
                } catch (error) {
                    console.error(`删除批次失败:`, error);
                }
            }

            setStatus({
                message: `清理完成！删除了 ${deletedCount} 个备份实体`,
                type: 'success'
            });
            
            // 清空备份实体列表
            setBackupEntities([]);

        } catch (error: any) {
            console.error('清理失败:', error);
            setStatus({
                message: `清理失败: ${error.message}`,
                type: 'error'
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="placeholder-cleanup-tool">
            <div className="form-group">
                <label htmlFor="chromaUrl">ChromaDB 地址</label>
                <input
                    type="text"
                    id="chromaUrl"
                    value={chromaUrl}
                    onChange={(e) => setChromaUrl(e.target.value)}
                    placeholder="http://localhost:8000"
                />
            </div>

            <div className="cleanup-actions">
                <button 
                    onClick={scanPlaceholders} 
                    disabled={loading}
                    style={{ marginRight: '10px' }}
                >
                    {loading ? '扫描中...' : '扫描占位符'}
                </button>
                
                <button 
                    onClick={cleanPlaceholders} 
                    disabled={loading || placeholders.length === 0}
                    style={{ 
                        backgroundColor: placeholders.length > 0 ? '#ff4444' : undefined,
                        color: placeholders.length > 0 ? 'white' : undefined,
                        marginRight: '10px'
                    }}
                >
                    {loading ? '清理中...' : `清理占位符 (${placeholders.length})`}
                </button>
                
                <button 
                    onClick={cleanBackupEntities} 
                    disabled={loading || backupEntities.length === 0}
                    style={{ 
                        backgroundColor: backupEntities.length > 0 ? '#ff8800' : undefined,
                        color: backupEntities.length > 0 ? 'white' : undefined
                    }}
                >
                    {loading ? '清理中...' : `清理备份实体 (${backupEntities.length})`}
                </button>
            </div>

            {status.message && (
                <div 
                    className={`status-message ${status.type}`}
                    style={{
                        padding: '10px',
                        margin: '10px 0',
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

            {(placeholders.length > 0 || backupEntities.length > 0) && (
                <div className="cleanup-results-section">
                    {placeholders.length > 0 && (
                        <div style={{ marginTop: '20px' }}>
                            <button 
                                onClick={() => setShowDetails(!showDetails)}
                                style={{ marginBottom: '10px' }}
                            >
                                {showDetails ? '隐藏占位符详情' : `显示占位符详情 (${placeholders.length})`}
                            </button>
                            
                            {showDetails && (
                                <div style={{ 
                                    maxHeight: '300px', 
                                    overflowY: 'auto', 
                                    border: '1px solid #ddd', 
                                    padding: '10px',
                                    backgroundColor: '#fff5f5',
                                    marginBottom: '15px'
                                }}>
                                    <h4>占位符实体详情:</h4>
                                    {placeholders.slice(0, 20).map((placeholder, index) => (
                                        <div key={placeholder.id} style={{ 
                                            marginBottom: '10px', 
                                            padding: '8px', 
                                            backgroundColor: 'white',
                                            border: '1px solid #ffcccc',
                                            borderRadius: '4px'
                                        }}>
                                            <div><strong>#{index + 1}</strong></div>
                                            <div><strong>ID:</strong> {placeholder.id}</div>
                                            <div><strong>名称:</strong> {placeholder.name}</div>
                                            <div><strong>类型:</strong> {placeholder.type}</div>
                                            <div><strong>描述:</strong> {placeholder.description}</div>
                                            <div><strong>重要性:</strong> {placeholder.importance}</div>
                                        </div>
                                    ))}
                                    {placeholders.length > 20 && (
                                        <div style={{ textAlign: 'center', padding: '10px', fontStyle: 'italic' }}>
                                            ... 还有 {placeholders.length - 20} 个占位符
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {backupEntities.length > 0 && (
                        <div style={{ marginTop: '20px' }}>
                            <button 
                                onClick={() => setShowBackupDetails(!showBackupDetails)}
                                style={{ marginBottom: '10px' }}
                            >
                                {showBackupDetails ? '隐藏备份详情' : `显示备份详情 (${backupEntities.length})`}
                            </button>
                            
                            {showBackupDetails && (
                                <div style={{ 
                                    maxHeight: '300px', 
                                    overflowY: 'auto', 
                                    border: '1px solid #ddd', 
                                    padding: '10px',
                                    backgroundColor: '#fffaf0'
                                }}>
                                    <h4>图关系数据备份实体详情:</h4>
                                    {backupEntities.slice(0, 20).map((backup, index) => (
                                        <div key={backup.id} style={{ 
                                            marginBottom: '10px', 
                                            padding: '8px', 
                                            backgroundColor: 'white',
                                            border: '1px solid #ffcc99',
                                            borderRadius: '4px'
                                        }}>
                                            <div><strong>#{index + 1}</strong></div>
                                            <div><strong>ID:</strong> {backup.id}</div>
                                            <div><strong>名称:</strong> {backup.name}</div>
                                            <div><strong>类型:</strong> {backup.type}</div>
                                            <div><strong>描述:</strong> {backup.description}</div>
                                            <div><strong>关系数量:</strong> {backup.relationshipCount}</div>
                                            <div><strong>创建时间:</strong> {backup.created ? new Date(backup.created).toLocaleString() : '未知'}</div>
                                        </div>
                                    ))}
                                    {backupEntities.length > 20 && (
                                        <div style={{ textAlign: 'center', padding: '10px', fontStyle: 'italic' }}>
                                            ... 还有 {backupEntities.length - 20} 个备份实体
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            <div style={{ 
                marginTop: '20px', 
                padding: '10px', 
                backgroundColor: '#f0f8ff', 
                border: '1px solid #b3d9ff',
                borderRadius: '4px',
                fontSize: '14px'
            }}>
                <h4 style={{ margin: '0 0 10px 0' }}>使用说明:</h4>
                <ul style={{ margin: '0', paddingLeft: '20px' }}>
                    <li><strong>扫描占位符：</strong>查看当前云端数据库中的占位符实体和备份实体</li>
                    <li><strong>占位符实体：</strong>系统自动创建的临时实体，用于维护关系完整性</li>
                    <li><strong>备份实体：</strong>旧版本的图关系数据备份，现在使用独立集合存储</li>
                    <li><strong>清理占位符：</strong>删除占位符实体，保持云端数据库干净</li>
                    <li><strong>清理备份实体：</strong>删除旧的图关系数据备份实体</li>
                    <li>⚠️ 清理操作不可撤销，建议先备份重要数据</li>
                    <li>💡 清理后系统会自动使用新的存储方案，不影响系统功能</li>
                </ul>
            </div>
        </div>
    );
};

// 数据库维护工具组件
const DatabaseMaintenanceTool = () => {
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<{message: string, type: 'info' | 'success' | 'error' | 'warning'}>({
        message: '',
        type: 'info'
    });
    const [chromaUrl, setChromaUrl] = useState('http://10.32.56.212:8000');
    const [userStats, setUserStats] = useState<any>(null);
    const [clearMode, setClearMode] = useState<'all' | 'timeRange'>('all');
    const [timeRange, setTimeRange] = useState({
        from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30天前
        to: new Date().toISOString().split('T')[0] // 今天
    });

    // 数据库管理器类
    class DatabaseManager {
        constructor(private chromaUrl: string) {}

        async getUserInfo() {
            try {
                const result = await chrome.storage.local.get(['userinfo']);
                return result.userinfo || { username: 'default-user' };
            } catch (error) {
                console.warn('获取用户信息失败，使用默认值');
                return { username: 'default-user' };
            }
        }

        async getAllUserCollections(client: any, username: string) {
            const collections = await client.listCollections();
            return collections.filter((collection: any) => 
                collection.name.startsWith(username + '-')
            );
        }

        async getCollectionStats(client: any, collectionName: string) {
            try {
                const collection = await client.getCollection({ 
                    name: collectionName,
                    embeddingFunction: undefined
                });
                
                const result = await collection.get({
                    include: ['metadatas' as any]
                });
                
                return {
                    name: collectionName,
                    count: result.ids?.length || 0,
                    size: this.calculateCollectionSize(result)
                };
            } catch (error) {
                console.error(`获取集合 ${collectionName} 统计失败:`, error);
                return {
                    name: collectionName,
                    count: 0,
                    size: 0,
                    error: error.message
                };
            }
        }

        calculateCollectionSize(result: any) {
            // 估算数据大小（字节）
            let size = 0;
            if (result.ids) {
                size += result.ids.length * 50; // ID大概50字节
            }
            if (result.metadatas) {
                size += JSON.stringify(result.metadatas).length;
            }
            if (result.documents) {
                size += JSON.stringify(result.documents).length;
            }
            if (result.embeddings) {
                size += result.embeddings.length * 1536 * 4; // 假设1536维度，float32
            }
            return size;
        }

        formatSize(bytes: number) {
            if (bytes === 0) return '0 B';
            const k = 1024;
            const sizes = ['B', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        }

        async delay(ms: number) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }

        async isWithinTimeRange(metadata: any, timeRange: {from: string, to: string}) {
            if (!metadata.created && !metadata.timestamp) return false;
            
            const itemDate = new Date(metadata.created || metadata.timestamp);
            const fromDate = new Date(timeRange.from);
            const toDate = new Date(timeRange.to + 'T23:59:59'); // 包含当天结束
            
            return itemDate >= fromDate && itemDate <= toDate;
        }
    }

    // 获取用户数据统计
    const getUserStats = async () => {
        setLoading(true);
        setStatus({message: '正在获取用户数据统计...', type: 'info'});
        
        try {
            // 动态加载 ChromaDB 客户端
            let ChromaClient;
            try {
                const chromaModule = await import('chromadb');
                ChromaClient = chromaModule.ChromaClient;
            } catch (error) {
                throw new Error('无法加载 ChromaDB 客户端，请确保应用正在运行');
            }

            const manager = new DatabaseManager(chromaUrl);
            const userinfo = await manager.getUserInfo();

            // 初始化 ChromaDB 客户端
            const client = new ChromaClient({
                path: chromaUrl
            });

            // 测试连接
            await client.heartbeat();

            // 获取用户相关的所有集合
            const userCollections = await manager.getAllUserCollections(client, userinfo.username);
            
            // 获取每个集合的统计信息
            const stats = [];
            let totalCount = 0;
            let totalSize = 0;

            for (const collection of userCollections) {
                const stat = await manager.getCollectionStats(client, collection.name);
                stats.push(stat);
                totalCount += stat.count;
                totalSize += stat.size;
            }

            // 获取本地存储统计
            const localStorageData = await chrome.storage.local.get(null);
            const localStorageSize = JSON.stringify(localStorageData).length;

            const userStatsData = {
                username: userinfo.username,
                collections: stats,
                totalCollections: userCollections.length,
                totalRecords: totalCount,
                totalSize: totalSize,
                localStorageSize: localStorageSize,
                lastUpdated: new Date().toLocaleString()
            };

            setUserStats(userStatsData);
            setStatus({
                message: `统计完成！用户 ${userinfo.username} 共有 ${userCollections.length} 个集合，${totalCount} 条记录`,
                type: 'success'
            });

        } catch (error: any) {
            console.error('获取统计失败:', error);
            setStatus({
                message: `获取统计失败: ${error.message}`,
                type: 'error'
            });
            setUserStats(null);
        } finally {
            setLoading(false);
        }
    };

    // 备份用户数据
    const backupUserData = async () => {
        if (!userStats) {
            setStatus({message: '请先获取用户数据统计', type: 'warning'});
            return;
        }

        setLoading(true);
        setStatus({message: '正在备份用户数据...', type: 'info'});

        try {
            // 动态加载 ChromaDB 客户端
            let ChromaClient;
            try {
                const chromaModule = await import('chromadb');
                ChromaClient = chromaModule.ChromaClient;
            } catch (error) {
                throw new Error('无法加载 ChromaDB 客户端');
            }

            const manager = new DatabaseManager(chromaUrl);
            const userinfo = await manager.getUserInfo();

            // 初始化 ChromaDB 客户端
            const client = new ChromaClient({
                path: chromaUrl
            });

            const backupData: {
                username: string;
                backupTime: string;
                version: string;
                collections: {[key: string]: any};
            } = {
                username: userinfo.username,
                backupTime: new Date().toISOString(),
                version: '1.0',
                collections: {}
            };

            // 备份所有用户集合
            for (const collectionStat of userStats.collections) {
                if (collectionStat.error) continue;

                setStatus({
                    message: `正在备份集合: ${collectionStat.name}...`,
                    type: 'info'
                });

                try {
                    const collection = await client.getCollection({ 
                        name: collectionStat.name,
                        embeddingFunction: undefined
                    });
                    
                    const result = await collection.get({
                        include: ['metadatas' as any, 'documents' as any, 'embeddings' as any]
                    });
                    
                    backupData.collections[collectionStat.name] = {
                        ids: result.ids,
                        metadatas: result.metadatas,
                        documents: result.documents,
                        embeddings: result.embeddings
                    };
                } catch (error) {
                    console.error(`备份集合 ${collectionStat.name} 失败:`, error);
                    backupData.collections[collectionStat.name] = {
                        error: error.message
                    };
                }
            }

            // 创建备份文件
            const backupJson = JSON.stringify(backupData, null, 2);
            const blob = new Blob([backupJson], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `personal-ai-backup-${userinfo.username}-${timestamp}.json`;
            
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            
            URL.revokeObjectURL(url);

            setStatus({
                message: `备份完成！文件已下载: ${filename}`,
                type: 'success'
            });

        } catch (error: any) {
            console.error('备份失败:', error);
            setStatus({
                message: `备份失败: ${error.message}`,
                type: 'error'
            });
        } finally {
            setLoading(false);
        }
    };

    // 还原用户数据
    const restoreUserData = async (file: File) => {
        setLoading(true);
        setStatus({message: '正在还原用户数据...', type: 'info'});

        try {
            // 读取和验证备份文件
            const fileContent = await file.text();
            let backupData;
            
            try {
                backupData = JSON.parse(fileContent);
            } catch (error) {
                throw new Error('备份文件格式无效');
            }

            // 验证备份文件结构
            if (!backupData.username || !backupData.collections || !backupData.version) {
                throw new Error('备份文件结构不正确');
            }

            const confirmed = window.confirm(
                `确定要还原备份文件吗？\n\n文件信息:\n- 用户: ${backupData.username}\n- 备份时间: ${new Date(backupData.backupTime).toLocaleString()}\n- 集合数: ${Object.keys(backupData.collections).length}\n\n⚠️ 这将覆盖现有的同名集合！`
            );

            if (!confirmed) {
                setStatus({message: '还原操作已取消', type: 'info'});
                return;
            }

            // 动态加载 ChromaDB 客户端
            let ChromaClient;
            try {
                const chromaModule = await import('chromadb');
                ChromaClient = chromaModule.ChromaClient;
            } catch (error) {
                throw new Error('无法加载 ChromaDB 客户端');
            }

            const manager = new DatabaseManager(chromaUrl);
            
            // 初始化 ChromaDB 客户端
            const client = new ChromaClient({
                path: chromaUrl
            });

            let restoredCollections = 0;
            let failedCollections = 0;
            let totalRecords = 0;

            // 还原每个集合
            for (const [collectionName, collectionData] of Object.entries(backupData.collections)) {
                if (!collectionData || (collectionData as any).error) {
                    failedCollections++;
                    continue;
                }

                setStatus({
                    message: `正在还原集合: ${collectionName}...`,
                    type: 'info'
                });

                try {
                    // 先删除现有集合（如果存在）
                    try {
                        await client.deleteCollection({ name: collectionName });
                        await manager.delay(100);
                    } catch (error) {
                        // 集合不存在，忽略错误
                    }

                    // 创建新集合
                    const collection = await client.createCollection({
                        name: collectionName
                    });

                    // 添加数据
                    const data = collectionData as any;
                    if (data.ids && data.ids.length > 0) {
                        await collection.add({
                            ids: data.ids,
                            metadatas: data.metadatas,
                            documents: data.documents,
                            embeddings: data.embeddings
                        });
                        totalRecords += data.ids.length;
                    }

                    restoredCollections++;
                } catch (error) {
                    console.error(`还原集合 ${collectionName} 失败:`, error);
                    failedCollections++;
                }
            }

            if (restoredCollections > 0) {
                setStatus({
                    message: `还原完成！成功还原 ${restoredCollections} 个集合，${totalRecords} 条记录。${failedCollections > 0 ? `失败: ${failedCollections}` : ''}`,
                    type: restoredCollections === Object.keys(backupData.collections).length ? 'success' : 'warning'
                });
                // 重新获取统计
                await getUserStats();
            } else {
                setStatus({
                    message: '还原失败，没有成功还原任何集合',
                    type: 'error'
                });
            }

        } catch (error: any) {
            console.error('还原失败:', error);
            setStatus({
                message: `还原失败: ${error.message}`,
                type: 'error'
            });
        } finally {
            setLoading(false);
        }
    };

    // 处理文件上传
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            restoreUserData(file);
        }
    };

    // 清空用户数据
    const clearUserData = async () => {
        if (!userStats) {
            setStatus({message: '请先获取用户数据统计', type: 'warning'});
            return;
        }

        let confirmMessage = '';
        if (clearMode === 'all') {
            confirmMessage = `⚠️ 危险操作 ⚠️\n\n确定要清空用户 ${userStats.username} 的所有数据吗？\n\n这将删除:\n- ${userStats.totalCollections} 个数据集合\n- ${userStats.totalRecords} 条记录\n- 所有本地存储数据（包括用户配置）\n\n此操作不可撤销！强烈建议先备份数据！`;
        } else {
            confirmMessage = `确定要清空时间范围内的数据吗？\n\n时间范围: ${timeRange.from} 至 ${timeRange.to}\n\n这将删除该时间范围内的数据记录，但保留用户配置和集合结构\n\n此操作不可撤销！`;
        }

        const confirmed = window.confirm(confirmMessage);
        if (!confirmed) return;

        if (clearMode === 'all') {
            const userInput = prompt('请输入 "DELETE" 来最终确认删除所有数据（区分大小写）:');
            if (userInput !== 'DELETE') {
                setStatus({message: '删除操作已取消', type: 'info'});
                return;
            }
        }

        setLoading(true);
        setStatus({message: clearMode === 'all' ? '正在清空所有数据...' : '正在清理时间范围数据...', type: 'info'});

        try {
            // 动态加载 ChromaDB 客户端
            let ChromaClient;
            try {
                const chromaModule = await import('chromadb');
                ChromaClient = chromaModule.ChromaClient;
            } catch (error) {
                throw new Error('无法加载 ChromaDB 客户端');
            }

            const manager = new DatabaseManager(chromaUrl);

            // 初始化 ChromaDB 客户端
            const client = new ChromaClient({
                path: chromaUrl
            });

            let deletedCollections = 0;
            let clearedRecords = 0;
            
            if (clearMode === 'all') {
                // 删除所有用户集合
                for (const collectionStat of userStats.collections) {
                    if (collectionStat.error) continue;

                    setStatus({
                        message: `正在删除集合: ${collectionStat.name}...`,
                        type: 'info'
                    });

                    try {
                        await client.deleteCollection({
                            name: collectionStat.name
                        });
                        deletedCollections++;
                        
                        await manager.delay(100); // 避免操作过快
                    } catch (error) {
                        console.error(`删除集合 ${collectionStat.name} 失败:`, error);
                    }
                }

                // 清空本地存储（包括用户配置）
                setStatus({
                    message: '正在清空本地存储...',
                    type: 'info'
                });
                
                await chrome.storage.local.clear();

                setStatus({
                    message: `清空完成！删除了 ${deletedCollections} 个集合和所有本地存储数据`,
                    type: 'success'
                });
                
                // 清空统计信息
                setUserStats(null);
            } else {
                // 按时间范围清理，保留userprofiles集合
                for (const collectionStat of userStats.collections) {
                    if (collectionStat.error) continue;
                    
                    // 跳过userprofiles集合
                    if (collectionStat.name.includes('-userprofiles')) {
                        continue;
                    }

                    setStatus({
                        message: `正在清理集合: ${collectionStat.name}...`,
                        type: 'info'
                    });

                    try {
                        const collection = await client.getCollection({ 
                            name: collectionStat.name,
                            embeddingFunction: undefined
                        });
                        
                        const result = await collection.get({
                            include: ['metadatas' as any]
                        });
                        
                        if (result.ids && result.metadatas) {
                            const idsToDelete = [];
                            
                            for (let i = 0; i < result.ids.length; i++) {
                                const metadata = result.metadatas[i];
                                if (await manager.isWithinTimeRange(metadata, timeRange)) {
                                    idsToDelete.push(result.ids[i]);
                                }
                            }
                            
                            if (idsToDelete.length > 0) {
                                await collection.delete({
                                    ids: idsToDelete
                                });
                                clearedRecords += idsToDelete.length;
                            }
                        }
                        
                        await manager.delay(100);
                    } catch (error) {
                        console.error(`清理集合 ${collectionStat.name} 失败:`, error);
                    }
                }

                setStatus({
                    message: `时间范围清理完成！清理了 ${clearedRecords} 条记录`,
                    type: 'success'
                });
                
                // 重新获取统计
                await getUserStats();
            }

        } catch (error: any) {
            console.error('清空失败:', error);
            setStatus({
                message: `清空失败: ${error.message}`,
                type: 'error'
            });
        } finally {
            setLoading(false);
        }
    };

    const manager = new DatabaseManager(chromaUrl);

    return (
        <div className="database-maintenance-tool" style={{ marginTop: '30px' }}>
            <hr style={{ margin: '20px 0', borderColor: '#ddd' }} />
            <h3>数据库管理工具</h3>
            
            <div className="form-group">
                <label htmlFor="chromaUrlMaintenance">ChromaDB 地址</label>
                <input
                    type="text"
                    id="chromaUrlMaintenance"
                    value={chromaUrl}
                    onChange={(e) => setChromaUrl(e.target.value)}
                    placeholder="http://localhost:8000"
                />
            </div>

            <div className="maintenance-actions" style={{ marginBottom: '20px' }}>
                <button 
                    onClick={getUserStats} 
                    disabled={loading}
                    style={{ 
                        marginRight: '10px',
                        backgroundColor: '#2196f3',
                        color: 'white'
                    }}
                >
                    {loading ? '获取中...' : '获取数据统计'}
                </button>
                
                <button 
                    onClick={backupUserData} 
                    disabled={loading || !userStats}
                    style={{ 
                        backgroundColor: userStats ? '#4caf50' : undefined,
                        color: userStats ? 'white' : undefined,
                        marginRight: '10px'
                    }}
                >
                    {loading ? '备份中...' : '备份云端数据'}
                </button>
                
                <label style={{ 
                    backgroundColor: '#ff9800',
                    color: 'white',
                    padding: '6px 12px',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    marginRight: '10px',
                    display: 'inline-block',
                    opacity: loading ? 0.6 : 1
                }}>
                    {loading ? '还原中...' : '还原数据'}
                    <input 
                        type="file" 
                        accept=".json" 
                        onChange={handleFileUpload}
                        disabled={loading}
                        style={{ display: 'none' }}
                    />
                </label>
            </div>

            {/* 清空数据设置 */}
            <div className="clear-data-section" style={{ 
                padding: '10px', 
                backgroundColor: '#fff5f5', 
                border: '1px solid #ffcccc',
                borderRadius: '4px',
                marginBottom: '20px'
            }}>
                <h4 style={{ margin: '0 0 10px 0', color: '#d32f2f', fontSize: '14px' }}>清空数据设置</h4>
                
                <div style={{ display: 'flex', gap: '15px', alignItems: 'center', marginBottom: '10px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', fontSize: '13px' }}>
                        <input
                            type="radio"
                            name="clearMode"
                            value="timeRange"
                            checked={clearMode === 'timeRange'}
                            onChange={(e) => setClearMode(e.target.value as 'all' | 'timeRange')}
                            style={{ marginRight: '5px' }}
                        />
                        按时间范围清理
                    </label>
                    
                    <label style={{ display: 'flex', alignItems: 'center', fontSize: '13px' }}>
                        <input
                            type="radio"
                            name="clearMode"
                            value="all"
                            checked={clearMode === 'all'}
                            onChange={(e) => setClearMode(e.target.value as 'all' | 'timeRange')}
                            style={{ marginRight: '5px' }}
                        />
                        清空所有数据
                    </label>
                </div>

                {clearMode === 'timeRange' && (
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px' }}>
                        <label style={{ fontSize: '12px' }}>
                            从: <input 
                                type="date" 
                                value={timeRange.from}
                                onChange={(e) => setTimeRange(prev => ({ ...prev, from: e.target.value }))}
                                style={{ marginLeft: '5px' }}
                            />
                        </label>
                        <label style={{ fontSize: '12px' }}>
                            到: <input 
                                type="date" 
                                value={timeRange.to}
                                onChange={(e) => setTimeRange(prev => ({ ...prev, to: e.target.value }))}
                                style={{ marginLeft: '5px' }}
                            />
                        </label>
                    </div>
                )}

                <button 
                    onClick={clearUserData} 
                    disabled={loading || !userStats}
                    style={{ 
                        backgroundColor: userStats ? '#f44336' : undefined,
                        color: userStats ? 'white' : undefined,
                        fontSize: '13px',
                        padding: '6px 12px'
                    }}
                >
                    {loading ? '清理中...' : clearMode === 'all' ? '清空所有数据' : '清理时间范围数据'}
                </button>
            </div>

            {status.message && (
                <div 
                    className={`status-message ${status.type}`}
                    style={{
                        padding: '10px',
                        margin: '10px 0',
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

            {userStats && (
                <div className="user-stats-section">
                    <div style={{ 
                        padding: '15px', 
                        backgroundColor: '#f8f9fa', 
                        border: '1px solid #dee2e6',
                        borderRadius: '4px',
                        marginBottom: '15px'
                    }}>
                        <h4 style={{ margin: '0 0 15px 0' }}>用户数据统计</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                            <div><strong>用户名:</strong> {userStats.username}</div>
                            <div><strong>集合数量:</strong> {userStats.totalCollections}</div>
                            <div><strong>总记录数:</strong> {userStats.totalRecords.toLocaleString()}</div>
                            <div><strong>云端数据大小:</strong> {manager.formatSize(userStats.totalSize)}</div>
                            <div><strong>统计时间:</strong> {userStats.lastUpdated}</div>
                        </div>
                        
                        <div style={{ marginTop: '15px' }}>
                            <h5>集合详情:</h5>
                            <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                    <thead>
                                        <tr style={{ backgroundColor: '#e9ecef' }}>
                                            <th style={{ padding: '5px', border: '1px solid #ddd', textAlign: 'left' }}>集合名称</th>
                                            <th style={{ padding: '5px', border: '1px solid #ddd', textAlign: 'right' }}>记录数</th>
                                            <th style={{ padding: '5px', border: '1px solid #ddd', textAlign: 'right' }}>大小</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {userStats.collections.map((collection: any, index: number) => (
                                            <tr key={index}>
                                                <td style={{ padding: '5px', border: '1px solid #ddd' }}>
                                                    {collection.name}
                                                    {collection.error && <span style={{ color: 'red' }}> (错误)</span>}
                                                </td>
                                                <td style={{ padding: '5px', border: '1px solid #ddd', textAlign: 'right' }}>
                                                    {collection.error ? '-' : collection.count.toLocaleString()}
                                                </td>
                                                <td style={{ padding: '5px', border: '1px solid #ddd', textAlign: 'right' }}>
                                                    {collection.error ? '-' : manager.formatSize(collection.size)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div style={{ 
                marginTop: '20px', 
                padding: '15px', 
                backgroundColor: '#fff3cd', 
                border: '1px solid #ffc107',
                borderRadius: '4px',
                fontSize: '14px'
            }}>
                <h4 style={{ margin: '0 0 10px 0', color: '#856404' }}>⚠️ 重要说明</h4>
                <ul style={{ margin: '0', paddingLeft: '20px', color: '#856404' }}>
                    <li><strong>获取数据统计：</strong>分析当前用户在云端和本地的所有数据</li>
                    <li><strong>备份云端数据：</strong>导出所有云端集合数据到JSON文件（不包含本地存储）</li>
                    <li><strong>还原数据：</strong>从备份文件还原云端集合数据</li>
                    <li><strong>按时间范围清理：</strong>清理指定时间段的数据记录（保留用户配置和userprofiles）</li>
                    <li><strong>清空所有数据：</strong>⚠️ 危险操作！删除所有云端集合和本地存储（包括用户配置）</li>
                    <li><strong>建议流程：</strong>先获取统计 → 备份数据 → 再进行清理操作</li>
                    <li><strong>安全提示：</strong>清空所有数据需要输入确认码，时间范围清理相对安全</li>
                </ul>
            </div>
        </div>
    );
};

ReactDOM.render(
    <Options />,
    document.getElementById('options-root')
); 