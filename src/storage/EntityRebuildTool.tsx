import * as React from 'react';
import { useState } from 'react';
import { CloudStorage } from './CloudStorage';
import { memorySystem } from '../memory';

/**
 * 实体重建工具
 * 提供从不同数据源重建实体的能力
 */
const EntityRebuildTool = () => {
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<{message: string, type: 'info' | 'success' | 'error' | 'warning'}>({
        message: '',
        type: 'info'
    });
    const [progress, setProgress] = useState<{
        current: number;
        total: number;
        phase: string;
        details?: string;
    }>({
        current: 0,
        total: 0,
        phase: ''
    });
    const [showProgress, setShowProgress] = useState(false);
    const [statistics, setStatistics] = useState<{
        totalMessages?: number;
        totalWebpages?: number;
        entitiesCreated?: number;
        entitiesUpdated?: number;
        conversationsAdded?: number;
        errors?: number;
    }>({});

    /**
     * 从聊天消息重建实体
     */
    const rebuildFromMessages = async () => {
        const confirmed = window.confirm(
            '确定要从聊天消息重建实体吗？\n\n' +
            '这将：\n' +
            '1. 扫描所有聊天消息\n' +
            '2. 提取消息中的实体信息\n' +
            '3. 为每个实体建立 conversations 关联\n' +
            '4. 更新实体的统计信息\n\n' +
            '注意：此操作可能需要较长时间，建议在系统空闲时执行。'
        );
        
        if (!confirmed) return;

        setLoading(true);
        setShowProgress(true);
        setStatus({message: '正在从聊天消息重建实体...', type: 'info'});
        setStatistics({});
        
        try {
            // 动态加载 ChromaDB 客户端
            let ChromaClient;
            try {
                const chromaModule = await import('chromadb');
                ChromaClient = chromaModule.ChromaClient;
            } catch (error) {
                throw new Error('无法加载 ChromaDB 客户端');
            }

            // 获取用户信息
            const userResult = await chrome.storage.local.get(['userinfo']);
            const userinfo = userResult.userinfo || { username: 'default-user' };

            // 获取环境配置
            const configResult = await chrome.storage.local.get(['envConfig']);
            const envConfig = configResult.envConfig || {};

            // 初始化 ChromaDB 客户端
            const chromaUrl = envConfig.CHROMA_SSL 
                ? `https://${envConfig.CHROMA_HOST}:${envConfig.CHROMA_PORT}`
                : `http://${envConfig.CHROMA_HOST}:${envConfig.CHROMA_PORT}`;
            
            const client = new ChromaClient({
                path: chromaUrl
            });

            // 测试连接
            await client.heartbeat();

            // 创建空嵌入函数实例
            class NullEmbeddingFunction {
                async generate(texts: string[]): Promise<number[][]> {
                    throw new Error('不应调用嵌入函数');
                }
            }
            const nullEmbeddingFunction = new NullEmbeddingFunction();

            // 获取消息集合
            const messagesCollectionName = `${userinfo.username}-messages`;
            const messagesCollection = await client.getCollection({
                name: messagesCollectionName,
                embeddingFunction: nullEmbeddingFunction
            });

            // 获取所有消息
            setProgress({ current: 0, total: 0, phase: '正在扫描消息...' });
            const messagesResult = await messagesCollection.get({
                include: ['metadatas'] as any
            });

            if (!messagesResult.ids || messagesResult.ids.length === 0) {
                setStatus({
                    message: '未找到任何消息记录',
                    type: 'warning'
                });
                return;
            }

            const totalMessages = messagesResult.ids.length;
            setProgress({ current: 0, total: totalMessages, phase: '准备处理消息...' });

            // 初始化记忆系统
            await memorySystem.initialize();
            const cloudStorage = memorySystem.cloudStorage;

            let conversationsAdded = 0;
            let errors = 0;
            const batchSize = 10; // 每批处理10条消息

            // 批量处理消息
            for (let i = 0; i < messagesResult.ids.length; i += batchSize) {
                const endIndex = Math.min(i + batchSize, messagesResult.ids.length);
                
                for (let j = i; j < endIndex; j++) {
                    const messageId = messagesResult.ids[j];
                    const metadata = messagesResult.metadatas[j] as any;

                    try {
                        setProgress({
                            current: j + 1,
                            total: totalMessages,
                            phase: '处理消息',
                            details: `${messageId.substring(0, 8)}...`
                        });

                        // 检查 metadata 是否包含 entities
                        if (!metadata || !metadata.entities) {
                            console.log(`⏭️ 跳过消息（无实体）: ${messageId}`);
                            continue;
                        }

                        // 解析 entities（可能是 JSON 字符串）
                        let entities;
                        try {
                            entities = typeof metadata.entities === 'string' 
                                ? JSON.parse(metadata.entities)
                                : metadata.entities;
                        } catch (parseError) {
                            console.warn(`⚠️ 解析 entities 失败: ${messageId}`, parseError);
                            continue;
                        }

                        // 检查是否有有效的实体数据
                        const hasEntities = entities && (
                            (entities.people && entities.people.length > 0) ||
                            (entities.projects && entities.projects.length > 0) ||
                            (entities.topics && entities.topics.length > 0) ||
                            (entities.resources && entities.resources.length > 0)
                        );

                        if (!hasEntities) {
                            console.log(`⏭️ 跳过消息（空实体）: ${messageId}`);
                            continue;
                        }

                        // 调用 updateEntitiesWithRelatedData 重建实体关联
                        await cloudStorage.updateEntitiesWithRelatedData(
                            metadata,
                            messageId
                        );

                        // 更新统计
                        conversationsAdded++;
                        console.log(`✅ 消息处理完成: ${messageId}`);

                    } catch (messageError) {
                        console.error(`❌ 处理消息失败 (${messageId}):`, messageError);
                        errors++;
                    }
                }

                // 批次间延迟，避免过载
                if (endIndex < messagesResult.ids.length) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }

                // 更新统计信息
                setStatistics({
                    totalMessages: endIndex,
                    conversationsAdded,
                    errors
                });
            }

            // 完成
            const successRate = ((totalMessages - errors) / totalMessages * 100).toFixed(1);
            setStatus({
                message: `✅ 实体重建完成！\n处理消息: ${totalMessages}\n更新 conversations: ${conversationsAdded}\n错误: ${errors}\n成功率: ${successRate}%`,
                type: 'success'
            });

            setStatistics({
                totalMessages,
                conversationsAdded,
                errors
            });

        } catch (error: any) {
            console.error('从消息重建实体失败:', error);
            setStatus({
                message: `❌ 重建失败: ${error.message}`,
                type: 'error'
            });
        } finally {
            setLoading(false);
        }
    };

    /**
     * 从网页浏览记录重建实体（预留功能）
     */
    const rebuildFromWebpages = async () => {
        setStatus({
            message: '⚠️ 此功能正在开发中，敬请期待...',
            type: 'warning'
        });
    };

    /**
     * 清空所有实体
     */
    const clearAllEntities = async () => {
        const confirmed = window.confirm(
            '⚠️ 危险操作！\n\n' +
            '确定要清空所有实体吗？\n\n' +
            '这将：\n' +
            '1. 删除 entity-graph 集合中的所有实体\n' +
            '2. 清空本地缓存的实体数据\n' +
            '3. 不会影响原始消息和网页数据\n\n' +
            '此操作不可逆！建议先备份数据。\n\n' +
            '请输入 "DELETE" 确认删除：'
        );
        
        if (!confirmed) return;

        const confirmText = prompt('请输入 DELETE 确认删除：');
        if (confirmText !== 'DELETE') {
            setStatus({
                message: '❌ 确认文本不正确，操作已取消',
                type: 'error'
            });
            return;
        }

        setLoading(true);
        setStatus({message: '正在清空实体...', type: 'info'});
        
        try {
            // 动态加载 ChromaDB 客户端
            let ChromaClient;
            try {
                const chromaModule = await import('chromadb');
                ChromaClient = chromaModule.ChromaClient;
            } catch (error) {
                throw new Error('无法加载 ChromaDB 客户端');
            }

            // 获取用户信息
            const userResult = await chrome.storage.local.get(['userinfo']);
            const userinfo = userResult.userinfo || { username: 'default-user' };

            // 获取环境配置
            const configResult = await chrome.storage.local.get(['envConfig']);
            const envConfig = configResult.envConfig || {};

            // 初始化 ChromaDB 客户端
            const chromaUrl = envConfig.CHROMA_SSL 
                ? `https://${envConfig.CHROMA_HOST}:${envConfig.CHROMA_PORT}`
                : `http://${envConfig.CHROMA_HOST}:${envConfig.CHROMA_PORT}`;
            
            const client = new ChromaClient({
                path: chromaUrl
            });

            // 测试连接
            await client.heartbeat();

            // 删除 entity-graph 集合
            const entitiesCollectionName = `${userinfo.username}-graph-entities`;
            
            try {
                await client.deleteCollection({
                    name: entitiesCollectionName
                });
                console.log(`✅ 删除集合: ${entitiesCollectionName}`);
            } catch (error) {
                console.warn('删除集合失败（可能不存在）:', error);
            }

            // 清空本地缓存
            try {
                await chrome.storage.local.remove(['ENTITIES', 'ENTITY_TO_RELATIONS', 'TYPE_TO_ENTITIES']);
                console.log('✅ 清空本地实体缓存');
            } catch (error) {
                console.warn('清空本地缓存失败:', error);
            }

            setStatus({
                message: '✅ 所有实体已清空！\n集合已删除，本地缓存已清空。',
                type: 'success'
            });

        } catch (error: any) {
            console.error('清空实体失败:', error);
            setStatus({
                message: `❌ 清空失败: ${error.message}`,
                type: 'error'
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="entity-rebuild-tool" style={{ 
            marginTop: '20px', 
            padding: '15px', 
            border: '1px solid #e0e0e0', 
            borderRadius: '8px',
            backgroundColor: '#fafafa'
        }}>
            <h3 style={{ margin: '0 0 15px 0', color: '#333' }}>实体重建工具</h3>
            
            <div className="rebuild-actions" style={{ 
                display: 'flex', 
                gap: '10px', 
                flexWrap: 'wrap',
                marginBottom: '15px' 
            }}>
                <button 
                    onClick={rebuildFromMessages} 
                    disabled={loading}
                    style={{ 
                        padding: '10px 20px',
                        backgroundColor: '#4CAF50',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        opacity: loading ? 0.6 : 1,
                        fontSize: '14px',
                        fontWeight: 'bold'
                    }}
                >
                    {loading ? '处理中...' : '📧 从聊天消息重建'}
                </button>
                
                <button 
                    onClick={rebuildFromWebpages} 
                    disabled={true}
                    style={{ 
                        padding: '10px 20px',
                        backgroundColor: '#2196F3',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'not-allowed',
                        opacity: 0.5,
                        fontSize: '14px',
                        fontWeight: 'bold'
                    }}
                >
                    🌐 从网页浏览重建（开发中）
                </button>

                <button 
                    onClick={clearAllEntities} 
                    disabled={loading}
                    style={{ 
                        padding: '10px 20px',
                        backgroundColor: '#f44336',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        opacity: loading ? 0.6 : 1,
                        fontSize: '14px',
                        fontWeight: 'bold'
                    }}
                >
                    🗑️ 清空所有实体
                </button>
            </div>

            {/* 进度显示 */}
            {showProgress && progress.total > 0 && (
                <div className="rebuild-progress" style={{ 
                    margin: '15px 0',
                    padding: '15px',
                    backgroundColor: '#fff',
                    border: '1px solid #ddd',
                    borderRadius: '4px'
                }}>
                    <h4 style={{ margin: '0 0 10px 0', fontSize: '14px' }}>
                        {progress.phase} {progress.details ? `- ${progress.details}` : ''}
                    </h4>
                    <div style={{ 
                        width: '100%', 
                        backgroundColor: '#e0e0e0',
                        height: '20px',
                        borderRadius: '10px',
                        overflow: 'hidden',
                        marginBottom: '10px'
                    }}>
                        <div style={{
                            width: `${(progress.current / progress.total) * 100}%`,
                            height: '100%',
                            backgroundColor: '#4CAF50',
                            transition: 'width 0.3s ease'
                        }}></div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#666' }}>
                        <span>已处理: {progress.current}/{progress.total}</span>
                        <span>进度: {((progress.current / progress.total) * 100).toFixed(1)}%</span>
                    </div>
                </div>
            )}

            {/* 统计信息 */}
            {Object.keys(statistics).length > 0 && (
                <div className="rebuild-statistics" style={{ 
                    margin: '15px 0',
                    padding: '15px',
                    backgroundColor: '#e8f5e9',
                    border: '1px solid #4CAF50',
                    borderRadius: '4px'
                }}>
                    <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#2e7d32' }}>统计信息</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', fontSize: '13px' }}>
                        {statistics.totalMessages !== undefined && (
                            <div>
                                <strong>处理消息：</strong> {statistics.totalMessages}
                            </div>
                        )}
                        {statistics.totalWebpages !== undefined && (
                            <div>
                                <strong>处理网页：</strong> {statistics.totalWebpages}
                            </div>
                        )}
                        {statistics.entitiesCreated !== undefined && (
                            <div>
                                <strong>创建实体：</strong> {statistics.entitiesCreated}
                            </div>
                        )}
                        {statistics.entitiesUpdated !== undefined && (
                            <div>
                                <strong>更新实体：</strong> {statistics.entitiesUpdated}
                            </div>
                        )}
                        {statistics.conversationsAdded !== undefined && (
                            <div>
                                <strong>关联 conversations：</strong> {statistics.conversationsAdded}
                            </div>
                        )}
                        {statistics.errors !== undefined && (
                            <div style={{ color: statistics.errors > 0 ? '#d32f2f' : '#2e7d32' }}>
                                <strong>错误数：</strong> {statistics.errors}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* 状态消息 */}
            {status.message && (
                <div 
                    className={`status-message ${status.type}`}
                    style={{
                        padding: '12px',
                        border: '1px solid',
                        borderRadius: '4px',
                        whiteSpace: 'pre-line',
                        fontSize: '13px',
                        lineHeight: '1.5',
                        backgroundColor: 
                            status.type === 'error' ? '#ffebee' :
                            status.type === 'success' ? '#e8f5e9' :
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

            {/* 功能说明 */}
            <div style={{ 
                marginTop: '15px', 
                padding: '12px', 
                backgroundColor: '#f0f8ff', 
                border: '1px solid #b3d9ff',
                borderRadius: '4px',
                fontSize: '13px'
            }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '14px' }}>功能说明:</h4>
                <ul style={{ margin: '0', paddingLeft: '20px', lineHeight: '1.8' }}>
                    <li>
                        <strong>从聊天消息重建：</strong>
                        <ul style={{ paddingLeft: '20px', marginTop: '5px' }}>
                            <li>扫描所有聊天消息记录</li>
                            <li>提取消息中的实体（人员、项目、话题等）</li>
                            <li>为每个实体建立 <code>conversations</code> 关联</li>
                            <li>更新实体的统计信息和热度评分</li>
                            <li>💡 适用于修复空 conversations 的实体</li>
                        </ul>
                    </li>
                    <li style={{ marginTop: '10px' }}>
                        <strong>从网页浏览重建：</strong>
                        <span style={{ color: '#ff9800', marginLeft: '5px' }}>(开发中)</span>
                        <ul style={{ paddingLeft: '20px', marginTop: '5px' }}>
                            <li>将从浏览历史中提取实体</li>
                            <li>建立实体与网页的关联</li>
                        </ul>
                    </li>
                    <li style={{ marginTop: '10px' }}>
                        <strong>清空所有实体：</strong>
                        <span style={{ color: '#f44336', marginLeft: '5px' }}>(危险操作)</span>
                        <ul style={{ paddingLeft: '20px', marginTop: '5px' }}>
                            <li>删除 entity-graph 集合</li>
                            <li>清空本地实体缓存</li>
                            <li>⚠️ 不影响原始消息和网页数据</li>
                            <li>⚠️ 操作不可逆，请谨慎使用</li>
                        </ul>
                    </li>
                </ul>
                
                <div style={{ 
                    marginTop: '12px', 
                    padding: '10px', 
                    backgroundColor: '#fff3cd',
                    border: '1px solid #ffc107',
                    borderRadius: '4px',
                    fontSize: '12px'
                }}>
                    <strong>⚠️ 使用建议：</strong>
                    <ul style={{ margin: '5px 0 0 0', paddingLeft: '20px' }}>
                        <li>建议在系统空闲时执行重建操作</li>
                        <li>重建过程中可能会占用较多资源</li>
                        <li>首次重建可能需要较长时间（取决于消息数量）</li>
                        <li>建议先备份数据，再执行清空操作</li>
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default EntityRebuildTool;

