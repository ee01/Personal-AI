import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { useState, useEffect } from 'react';

// 配置选项接口
interface ConfigOptions {
    // 定时任务配置
    SCHEDULED_INTERVAL: string;
    
    // LLM 配置
    LLM_TYPE: string;
    LLM_GROUP_ANALYSIS: boolean;
    
    // Ollama 配置
    OLLAMA_BASE_URL: string;
    OLLAMA_MODEL: string;
    OLLAMA_REVIEW_MODEL: string;
    OLLAMA_QUERY_MODEL: string;
    
    // Dify API 配置
    DIFY_API_KEY: string;
    DIFY_REVIEW_API_KEY: string;
    DIFY_API_BASE_URL: string;
    
    // OpenAI 配置
    OPENAI_API_KEY: string;
    OPENAI_MODEL: string;
    OPENAI_REVIEW_MODEL: string;
    OPENAI_API_BASE_URL: string;
    
    // Groq 配置
    GROQ_API_KEY: string;
    GROQ_MODEL: string;
    GROQ_REVIEW_MODEL: string;
    
    // Bot 配置
    BOT_API_BASE_URL: string;
    BOT_ID: string;
    BOT_TYPE: string;
    BOT_TOKEN: string;
    TEAM_ID: string;
    
    // 功能开关
    ENABLE_BOT: boolean;
    LLM_REVIEW_BEFORE_SEND: boolean;
    
    // Chroma 配置
    ENABLE_CHROMA: boolean;
    CHROMA_API_URL: string;
    CHROMA_PORT: string;
    CHROMA_COLLECTION_NAME: string;
}

// 默认配置
const defaultConfig: ConfigOptions = {
    SCHEDULED_INTERVAL: "120",
    LLM_TYPE: "dify",
    LLM_GROUP_ANALYSIS: false,
    OLLAMA_BASE_URL: "http://localhost:11434",
    OLLAMA_MODEL: "deepseek-r1",
    OLLAMA_REVIEW_MODEL: "llama3.1",
    OLLAMA_QUERY_MODEL: "llama3.1",
    DIFY_API_KEY: "",
    DIFY_REVIEW_API_KEY: "",
    DIFY_API_BASE_URL: "",
    OPENAI_API_KEY: "",
    OPENAI_MODEL: "",
    OPENAI_REVIEW_MODEL: "",
    OPENAI_API_BASE_URL: "",
    GROQ_API_KEY: "",
    GROQ_MODEL: "",
    GROQ_REVIEW_MODEL: "",
    BOT_API_BASE_URL: "https://botman.int.rclabenv.com/v2",
    BOT_ID: "4700372020@37439510.bot.glip.net",
    BOT_TYPE: "user",
    BOT_TOKEN: "",
    TEAM_ID: "",
    ENABLE_BOT: true,
    LLM_REVIEW_BEFORE_SEND: true,
    ENABLE_CHROMA: true,
    CHROMA_API_URL: "http://localhost:8000",
    CHROMA_PORT: "8000",
    CHROMA_COLLECTION_NAME: ""
};

const Options = () => {
    const [config, setConfig] = useState<ConfigOptions>({...defaultConfig});
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
            } else {
                // 如果没有保存过配置，则尝试从 .env 加载
                loadEnvDefaults();
            }
        });
    }, []);

    // 从.env加载默认值（通过background脚本）
    const loadEnvDefaults = async () => {
        try {
            const response = await chrome.runtime.sendMessage({
                type: 'GET_ENV_CONFIG'
            });
            
            if (response && response.success) {
                setConfig(response.config);
                setStatus({
                    message: '已从.env文件加载默认配置',
                    type: 'success'
                });
            }
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
        setConfig({...defaultConfig});
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
                        onChange={handleInputChange}
                    />
                </div>

                <div className="form-group">
                    <label>
                        <input
                            type="checkbox"
                            name="ENABLE_BOT"
                            checked={config.ENABLE_BOT}
                            onChange={handleInputChange}
                        />
                        启用消息提醒
                    </label>
                </div>

                <div className="form-group">
                    <label>
                        <input
                            type="checkbox"
                            name="LLM_REVIEW_BEFORE_SEND"
                            checked={config.LLM_REVIEW_BEFORE_SEND}
                            onChange={handleInputChange}
                        />
                        启用消息审核
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

                <div className="form-group">
                    <label>
                        <input
                            type="checkbox"
                            name="LLM_GROUP_ANALYSIS"
                            checked={config.LLM_GROUP_ANALYSIS}
                            onChange={handleInputChange}
                        />
                        拆开每个群组独立分析
                    </label>
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
                <h2>Chroma 设置</h2>
                <div className="form-group">
                    <label>
                        <input
                            type="checkbox"
                            name="ENABLE_CHROMA"
                            checked={config.ENABLE_CHROMA}
                            onChange={handleInputChange}
                        />
                        启用 Chroma
                    </label>
                </div>
                <div className="form-group">
                    <label htmlFor="CHROMA_API_URL">Chroma API URL</label>
                    <input
                        type="url"
                        id="CHROMA_API_URL"
                        name="CHROMA_API_URL"
                        value={config.CHROMA_API_URL}
                        onChange={handleInputChange}
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="CHROMA_PORT">Chroma 端口</label>
                    <input
                        type="text"
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
                            name="ENABLE_CUSTOM_COLLECTION"
                            checked={enableCustomCollection}
                            onChange={(e) => setEnableCustomCollection(e.target.checked)}
                        />
                        自定义集合名称
                    </label>
                    {enableCustomCollection && (
                        <input
                            type="text"
                            id="CHROMA_COLLECTION_NAME"
                            name="CHROMA_COLLECTION_NAME"
                            value={config.CHROMA_COLLECTION_NAME}
                            onChange={handleInputChange}
                        />
                    )}
                </div>
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

ReactDOM.render(
    <Options />,
    document.getElementById('options-root')
); 