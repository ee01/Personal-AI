import * as React from 'react';
import { useState } from 'react';
import { CloudStorage, MemoryEntity } from './CloudStorage';

// V6数据迁移工具组件
const V6DataMigrationTool = () => {
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<{message: string, type: 'info' | 'success' | 'error' | 'warning'}>({
        message: '',
        type: 'info'
    });
    const [migrationProgress, setMigrationProgress] = useState<{processed: number, total: number, errors: number}>({
        processed: 0,
        total: 0,
        errors: 0
    });
    const [chromaUrl, setChromaUrl] = useState('http://10.32.56.212:8000');
    const [showProgress, setShowProgress] = useState(false);

    // V6数据迁移器类
    class V6DataMigrator {
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

        async getEnvConfig() {
            try {
                const result = await chrome.storage.local.get(['envConfig']);
                return result.envConfig || {};
            } catch (error) {
                console.warn('获取环境配置失败，使用默认值');
                return {};
            }
        }

        calculateImportanceFromV6(type: string, entityName: string, metadata: any): number {
            // 根据V6数据特点计算重要性
            let importance = 0.5; // 默认重要性

            // 根据实体类型调整
            switch (type) {
                case 'projects':
                    importance = 0.8;
                    break;
                case 'people':
                    importance = 0.7;
                    break;
                case 'topics':
                    importance = 0.6;
                    break;
                case 'resources':
                    importance = 0.6;
                    break;
                case 'location':
                    importance = 0.5;
                    break;
                case 'time':
                    importance = 0.4;
                    break;
            }

            // 根据消息优先级调整
            if (metadata.priority === 'high') {
                importance += 0.2;
            } else if (metadata.priority === 'low') {
                importance -= 0.1;
            }

            return Math.max(0.1, Math.min(1.0, importance));
        }

        async delay(ms: number) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }
    }

    // 扫描V6数据
    const scanV6Data = async () => {
        setLoading(true);
        setStatus({message: '正在扫描V6数据...', type: 'info'});
        
        try {
            // 动态加载 ChromaDB 客户端
            let ChromaClient;
            try {
                const chromaModule = await import('chromadb');
                ChromaClient = chromaModule.ChromaClient;
            } catch (error) {
                throw new Error('无法加载 ChromaDB 客户端，请确保应用正在运行');
            }

            const migrator = new V6DataMigrator(chromaUrl);
            const userinfo = await migrator.getUserInfo();
            const envConfig = await migrator.getEnvConfig();

            // 初始化 ChromaDB 客户端
            const client = new ChromaClient({
                path: chromaUrl
            });

            // 测试连接
            await client.heartbeat();

            // 检查V6 messages集合是否存在
            const collections = await client.listCollections();
            const messagesCollectionName = envConfig.CHROMA_COLLECTION_NAME;
            const hasMessagesCollection = collections.some(c => c.name === messagesCollectionName);

            if (!hasMessagesCollection) {
                setStatus({
                    message: `未找到V6消息集合: ${messagesCollectionName}`,
                    type: 'warning'
                });
                return;
            }

            // 获取messages集合
            const messagesCollection = await client.getCollection({ 
                name: messagesCollectionName,
                embeddingFunction: undefined
            });

            // 获取所有消息
            const result = await messagesCollection.get({
                include: ['metadatas', 'documents'] as any
            });

            if (!result.ids || !result.metadatas) {
                setStatus({message: 'V6消息集合中没有数据', type: 'info'});
                return;
            }

            setMigrationProgress({ processed: 0, total: result.ids.length, errors: 0 });
            setStatus({
                message: `发现 ${result.ids.length} 条V6消息，可以开始迁移`,
                type: 'success'
            });

        } catch (error: any) {
            console.error('扫描V6数据失败:', error);
            setStatus({
                message: `扫描失败: ${error.message}`,
                type: 'error'
            });
        } finally {
            setLoading(false);
        }
    };

    // 执行V6数据迁移
    const migrateV6Data = async () => {
        const confirmed = window.confirm('确定要迁移V6数据吗？这将从V6的messages集合中提取实体数据并迁移到新的graph-entities集合中。');
        if (!confirmed) return;

        setLoading(true);
        setShowProgress(true);
        setStatus({message: '正在迁移V6数据...', type: 'info'});
        
        try {
            // 动态加载必要的模块
            let ChromaClient;
            try {
                const chromaModule = await import('chromadb');
                ChromaClient = chromaModule.ChromaClient;
            } catch (error) {
                throw new Error('无法加载 ChromaDB 客户端');
            }
            const cloudStorage = new CloudStorage();
            await cloudStorage.initialize();

            const migrator = new V6DataMigrator(chromaUrl);
            const userinfo = await migrator.getUserInfo();
            const envConfig = await migrator.getEnvConfig();

            // 初始化 CloudStorage（需要为迁移创建实例）
            const { memorySystem } = await import('../memory');
            
            // 确保memory系统已初始化
            await memorySystem.initialize();

            // 初始化 ChromaDB 客户端
            const client = new ChromaClient({
                path: chromaUrl
            });

            // 获取V6 messages集合
            const messagesCollectionName = envConfig.CHROMA_COLLECTION_NAME;
            const messagesCollection = await client.getCollection({ 
                name: messagesCollectionName,
                embeddingFunction: undefined
            });

            // 获取所有消息
            const result = await messagesCollection.get({
                include: ['metadatas', 'documents'] as any
            });

            if (!result.ids || !result.metadatas || !result.documents) {
                throw new Error('V6消息集合数据不完整');
            }

            setMigrationProgress({ processed: 0, total: result.ids.length, errors: 0 });

            let processed = 0;
            let errors = 0;
            const batchSize = 10; // 批处理大小

            for (let i = 0; i < result.ids.length; i += batchSize) {
                const batch = [];
                const endIndex = Math.min(i + batchSize, result.ids.length);
                
                for (let j = i; j < endIndex; j++) {
                    const messageId = result.ids[j];
                    const metadata = deserializeEntityFromMetadata(result.metadatas[j]);
                    const document = result.documents[j];

                    try {
                        // 从V6 metadata中提取实体
                        const extractedEntities = memorySystem.extractEntitiesFromMetadata(metadata, messageId);
                        
                        if (extractedEntities.length > 0) {
                            // 调用updateEntitiesWithRelatedData迁移实体数据
                            await cloudStorage.updateEntitiesWithRelatedData(
                                metadata,
                                messageId
                            );

                            // 更新用户画像（如果启用）
                            if (memorySystem.userProfileManager && extractedEntities.length > 0) {
                                try {
                                    await memorySystem.updateUserProfileFromEntities(extractedEntities, {
                                        actionType: 'mention',
                                        timestamp: metadata.timestamp as number || Date.now(),
                                        context: 'v6_migration',
                                        metadata: {
                                            messageId: messageId,
                                            source: metadata.source || 'unknown'
                                        }
                                    });
                                } catch (profileError) {
                                    console.warn(`更新用户画像失败 (${messageId}):`, profileError);
                                }
                            }

                            console.log(`✅ 迁移消息完成: ${messageId}, 实体数量: ${extractedEntities.length}`);
                        }

                        processed++;
                        
                    } catch (messageError) {
                        console.error(`迁移消息失败 (${messageId}):`, messageError);
                        errors++;
                    }

                    // 更新进度
                    setMigrationProgress({ processed, total: result.ids.length, errors });
                    setStatus({
                        message: `正在迁移... ${processed}/${result.ids.length} (错误: ${errors})`,
                        type: 'info'
                    });
                }

                // 批次间延迟，避免过载
                if (i + batchSize < result.ids.length) {
                    await migrator.delay(200);
                }
            }

            const successCount = processed - errors;
            setStatus({
                message: `迁移完成！成功处理 ${successCount} 条消息，错误 ${errors} 条`,
                type: successCount > 0 ? 'success' : 'warning'
            });

        } catch (error: any) {
            console.error('V6数据迁移失败:', error);
            setStatus({
                message: `迁移失败: ${error.message}`,
                type: 'error'
            });
        } finally {
            setLoading(false);
        }
    };

    /**
     * 🆕 从ChromaDB metadata反序列化实体
     */
    const deserializeEntityFromMetadata = (metadata: any): MemoryEntity => {
        // 默认值定义
        const defaults:MemoryEntity = {
          id: '',
          type: 'Document' as const,
          name: '',
          description: '',
          properties: {} as Record<string, any>,
          created: Date.now(),
          updated: Date.now(),
          accessCount: 0,
          lastAccessed: Date.now(),
          importance: 0.5,
          tags: [] as string[],
          status: 'active',
          statistic: {
            conversations: 0, projects: 0, participants: 0, resources: 0,
            documents: 0, webpages: 0, relationships: 0, topics: 0, jiraTickets: 0
          },
          relatedData: {
            conversations: [],
            webpages: [],
            resources: [] as Array<{
              id: string; summary: string; name: string; type: string;
              datetime: string; relevanceScore: number;
            }>,
            projects: [],
            people: [],
            topics: [],
            jiraTickets: [],
            cooccurringEntities: []
          },
          hotness: 0,
          criticalityScore: 0,
          lastDocumentUpdate: Date.now(),
          expertise: [] as string[]
        };
    
        try {
          // 基础字段处理
          const entity: any = { ...defaults };
          for (const key in metadata) {
            if (metadata[key] !== undefined) {
              entity[key] = processField(metadata[key], key);
            }
          }
    
          return entity as MemoryEntity;
        } catch (error) {
          console.error('反序列化实体失败:', error);
          // 返回基础实体结构
          return defaults;
        }

        /**
         * 通用字段处理：自动判断字段类型并进行相应转换
         */
        function processField(value: any, fieldName: string, defaultValue?: any): any {
            // 如果值为空，返回默认值
            if (value === null || value === undefined || value === '') {
            return defaultValue;
            }

            // 如果已经是正确类型，直接返回
            if (typeof value !== 'string') {
            return value;
            }

            // 尝试解析为 JSON（数组或对象）
            if ((value.startsWith('{') && value.endsWith('}')) || 
                (value.startsWith('[') && value.endsWith(']'))) {
            try {
                return JSON.parse(value);
            } catch (error) {
                console.warn(`字段 ${fieldName} JSON解析失败:`, error);
                return defaultValue;
            }
            }

            // 判断是否为时间戳字段，如果是数字字符串且字段名包含时间相关词汇
            const timeFields = ['created', 'updated', 'lastAccessed', 'lastContact', 'lastDocumentUpdate'];
            if (timeFields.includes(fieldName) && /^\d+$/.test(value)) {
            return parseInt(value, 10);
            }

            // 判断是否为数字字段
            const numberFields = ['accessCount', 'importance', 'hotness', 'criticalityScore'];
            if (numberFields.includes(fieldName) && /^-?\d*\.?\d+$/.test(value)) {
            return parseFloat(value);
            }

            // 布尔字段处理
            if (value === 'true') return true;
            if (value === 'false') return false;

            // 其他情况保持字符串
            return value;
        }
      }

    return (
        <div className="v6-migration-tool" style={{ marginBottom: '20px' }}>
            <h3>V6数据迁移工具</h3>
            
            <div className="form-group">
                <label htmlFor="migrationChromaUrl">ChromaDB 地址</label>
                <input
                    type="text"
                    id="migrationChromaUrl"
                    value={chromaUrl}
                    onChange={(e) => setChromaUrl(e.target.value)}
                    placeholder="http://localhost:8000"
                />
            </div>

            <div className="migration-actions">
                <button 
                    onClick={scanV6Data} 
                    disabled={loading}
                    style={{ marginRight: '10px' }}
                >
                    {loading ? '扫描中...' : '扫描V6数据'}
                </button>
                
                <button 
                    onClick={migrateV6Data} 
                    disabled={loading || migrationProgress.total === 0}
                    style={{ 
                        backgroundColor: migrationProgress.total > 0 ? '#4caf50' : undefined,
                        color: migrationProgress.total > 0 ? 'white' : undefined
                    }}
                >
                    {loading ? '迁移中...' : `开始迁移${migrationProgress.total > 0 ? ` (${migrationProgress.total}条)` : ''}`}
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

            {showProgress && migrationProgress.total > 0 && (
                <div className="migration-progress" style={{ 
                    margin: '15px 0',
                    padding: '15px',
                    backgroundColor: '#f8f9fa',
                    border: '1px solid #dee2e6',
                    borderRadius: '4px'
                }}>
                    <h4 style={{ margin: '0 0 10px 0' }}>迁移进度</h4>
                    <div style={{ 
                        width: '100%', 
                        backgroundColor: '#e9ecef',
                        height: '20px',
                        borderRadius: '10px',
                        overflow: 'hidden',
                        marginBottom: '10px'
                    }}>
                        <div style={{
                            width: `${(migrationProgress.processed / migrationProgress.total) * 100}%`,
                            height: '100%',
                            backgroundColor: migrationProgress.errors > 0 ? '#ffc107' : '#28a745',
                            transition: 'width 0.3s ease'
                        }}></div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                        <span>已处理: {migrationProgress.processed}/{migrationProgress.total}</span>
                        <span>错误: {migrationProgress.errors}</span>
                        <span>进度: {((migrationProgress.processed / migrationProgress.total) * 100).toFixed(1)}%</span>
                    </div>
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
                    <li><strong>扫描V6数据：</strong>检查V6版本的messages集合中的数据量</li>
                    <li><strong>迁移过程：</strong>从V6的metadata中提取entities数据，创建新的graph-entities实体</li>
                    <li><strong>数据转换：</strong>V6的entities JSON字符串格式转换为新的实体结构</li>
                    <li><strong>关联数据：</strong>为每个实体构建完整的关联数据（消息、项目、人员等）</li>
                    <li><strong>用户画像：</strong>同时更新用户画像数据</li>
                    <li>⚠️ 迁移过程可能需要较长时间，请确保网络连接稳定</li>
                    <li>💡 迁移后原V6数据不会被删除，可以安全进行</li>
                </ul>
            </div>
        </div>
    );
};

export default V6DataMigrationTool;
