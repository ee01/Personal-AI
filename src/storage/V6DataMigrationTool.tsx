import * as React from 'react';
import { useState } from 'react';
import { CloudStorage, MemoryEntity } from './CloudStorage';

// ====== 数据结构定义 ======

// V6版本的messages metadata数据结构
interface V6MessageMetadata {
    source: string;
    relationships: string;  // JSON字符串: '[{"source":"","target":"","relationship":""}]'
    category: string;       // JSON字符串: '["分类1","分类2"]'
    projects: string;       // JSON字符串: '["项目1","项目2"]'
    sentiment: string;      // 'positive' | 'negative' | 'neutral'
    topics: string;         // JSON字符串: '["话题1","话题2"]'
    teamName: string;
    timestamp: number;
    searchTags: string;     // JSON字符串: '["标签1","标签2"]'
    priority: string;       // 'high' | 'medium' | 'low'
    details: string;        // 消息原文
    tags: string;           // JSON字符串: '["标签1","标签2"]'
    people: string;         // JSON字符串: '["人员1","人员2"]'
    locations: string;      // JSON字符串: '["地点1","地点2"]'
    entities: string;       // JSON字符串: 复杂实体对象
    teamId: string;
    matchedRules: string;   // JSON字符串: '["规则1","规则2"]'
    actions: string;        // JSON字符串: '[{"type":"task","description":"..."}]'
    summary: string;
}

// V6版本的entities结构（从JSON字符串解析）
interface V6Entities {
    people?: Array<{
        name: string;
        role?: string;
        mentioned_context?: string;
    }>;
    time?: Array<{
        expression: string;
        normalized?: string;
    }>;
    location?: Array<{
        name: string;
        type?: string;
    }>;
    projects?: Array<{
        name: string;
        status?: string;
        related_people?: string[];
    }>;
    topics?: Array<{
        name: string;
        category?: string;
        keywords?: string[];
    }>;
    resources?: Array<{
        type: string;
        name: string;
        location?: string;
    }>;
    [key: string]: any; // 添加索引签名支持动态属性
}

// 新版本的messages metadata数据结构（基于messageDealing.ts）
interface NewMessageMetadata {
    sender: string;
    datetime: number;       // 原始时间戳
    postId?: string;        // 原始消息ID
    matchedRules: string[];
    summary: string;
    groupName: string;
    groupId: string;
    groupUrl?: string;
    contextMessages?: Array<{
        id: string;
        sender: string;
        content: string;
        datetime: string;
        isMainMessage: boolean;
    }>;
    messagePosition?: number;
    entities: {
        people?: Array<{ name: string; role?: string; mentioned_context?: string; }>;
        projects?: Array<{ name: string; status?: string; related_people?: string[]; }>;
        topics?: Array<{ name: string; category?: string; keywords?: string[]; }>;
        resources?: Array<{ type: string; name: string; location?: string; }>;
        time?: Array<{ expression: string; normalized?: string; }>;
        location?: Array<{ name: string; type?: string; }>;
    };
    metadata: {
        sentiment: string;
        priority: string;
        category: string[];
        tags: string[];
    };
    relationships?: Array<{
        source: string;
        target: string;
        relationship: string;
    }>;
    actions?: Array<{
        type: string;
        description: string;
        assignee?: string;
        deadline?: string;
        status?: string;
    }>;
    replyAdvice: string;
    [key: string]: any; // 添加索引签名支持ChromaDB的Metadata类型
}

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

        // 🆕 转换V6 metadata为新格式
        convertV6ToNewMetadata(v6Metadata: V6MessageMetadata): NewMessageMetadata {
            try {
                // 解析V6中的JSON字符串字段
                const parseJsonField = (field: string): any => {
                    try {
                        return field ? JSON.parse(field) : [];
                    } catch {
                        return field ? [field] : [];
                    }
                };

                // 解析entities
                let entities = {};
                try {
                    entities = v6Metadata.entities ? JSON.parse(v6Metadata.entities) : {};
                } catch {
                    entities = {};
                }

                // 解析relationships
                let relationships = [];
                try {
                    relationships = v6Metadata.relationships ? JSON.parse(v6Metadata.relationships) : [];
                } catch {
                    relationships = [];
                }

                // 解析actions
                let actions = [];
                try {
                    actions = v6Metadata.actions ? JSON.parse(v6Metadata.actions) : [];
                } catch {
                    actions = [];
                }

                // 构建新格式的metadata
                const newMetadata: NewMessageMetadata = {
                    sender: v6Metadata.source || v6Metadata.sender || 'unknown',
                    datetime: v6Metadata.timestamp || Date.now(),
                    matchedRules: parseJsonField(v6Metadata.matchedRules),
                    summary: v6Metadata.summary || '',
                    groupName: v6Metadata.teamName || '',
                    groupId: v6Metadata.teamId || '',
                    groupUrl: `https://app.ringcentral.com/messages/${v6Metadata.teamId}`,
                    entities: entities,
                    metadata: {
                        sentiment: v6Metadata.sentiment || 'neutral',
                        priority: v6Metadata.priority || 'medium',
                        category: parseJsonField(v6Metadata.category),
                        tags: parseJsonField(v6Metadata.tags)
                    },
                    relationships: relationships,
                    actions: actions,
                    replyAdvice: '' // V6中没有这个字段，设为空
                };

                return newMetadata;
            } catch (error) {
                console.error('转换V6 metadata失败:', error);
                // 返回基本结构
                return {
                    sender: v6Metadata.source || v6Metadata.sender || 'unknown',
                    datetime: v6Metadata.timestamp || Date.now(),
                    matchedRules: [],
                    summary: v6Metadata.summary || '',
                    groupName: v6Metadata.teamName || '',
                    groupId: v6Metadata.teamId || '',
                    entities: {},
                    metadata: {
                        sentiment: 'neutral',
                        priority: 'medium',
                        category: [],
                        tags: []
                    },
                    relationships: [],
                    actions: [],
                    replyAdvice: ''
                };
            }
        }

        // 🆕 从V6格式的metadata中提取实体
        extractV6Entities(v6Metadata: V6MessageMetadata, messageId: string): any[] {
            const entities = [];
            
            try {
                // 解析V6版本的entities JSON字符串
                let entitiesData: V6Entities = {};
                if (v6Metadata.entities) {
                    try {
                        entitiesData = JSON.parse(v6Metadata.entities);
                    } catch {
                        console.warn(`解析entities失败: ${messageId}`);
                    }
                }

                // 从entities对象中提取各类实体
                const entityTypes = ['people', 'time', 'location', 'projects', 'topics', 'resources'];
                
                for (const type of entityTypes) {
                    if (entitiesData[type] && Array.isArray(entitiesData[type])) {
                        for (const entityData of entitiesData[type]) {
                            if (entityData && typeof entityData === 'object' && entityData.name) {
                                entities.push({
                                    name: entityData.name.trim(),
                                    type: type.slice(0, -1), // 去掉复数形式
                                    importance: this.calculateImportanceFromV6(type, entityData.name, v6Metadata),
                                    confidence: 0.8,
                                    source: 'v6_migration',
                                    description: `从V6数据迁移的${type}实体`,
                                    role: entityData.role,
                                    mentioned_context: entityData.mentioned_context,
                                    status: entityData.status,
                                    related_people: entityData.related_people,
                                    category: entityData.category,
                                    keywords: entityData.keywords,
                                    location: entityData.location
                                });
                            }
                        }
                    }
                }

                // 从其他字段提取实体（兼容V6数据结构）
                const parseAndExtract = (field: string, type: string) => {
                    try {
                        const items = field ? JSON.parse(field) : [];
                        if (Array.isArray(items)) {
                            for (const item of items) {
                                if (item && typeof item === 'string' && item.trim()) {
                                    entities.push({
                                        name: item.trim(),
                                        type: type,
                                        importance: this.calculateImportanceFromV6(type + 's', item, v6Metadata),
                                        confidence: 0.8,
                                        source: 'v6_migration',
                                        description: `从V6数据迁移的${type}实体`
                                    });
                                }
                            }
                        }
                    } catch {
                        // 如果不是JSON，尝试作为单个字符串处理
                        if (field && field.trim()) {
                            entities.push({
                                name: field.trim(),
                                type: type,
                                importance: this.calculateImportanceFromV6(type + 's', field, v6Metadata),
                                confidence: 0.8,
                                source: 'v6_migration',
                                description: `从V6数据迁移的${type}实体`
                            });
                        }
                    }
                };

                parseAndExtract(v6Metadata.people, 'person');
                parseAndExtract(v6Metadata.topics, 'topic');
                parseAndExtract(v6Metadata.projects, 'project');
                parseAndExtract(v6Metadata.locations, 'location');

                console.log(`📝 从V6消息 ${messageId} 提取到 ${entities.length} 个实体`);
                return entities;
                
            } catch (error) {
                console.error(`解析V6实体数据失败 (${messageId}):`, error);
                return [];
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

        serializeMetadataForChroma(metadata: any): Record<string, string | number | boolean | null> {
            const converted: Record<string, string | number | boolean | null> = {};
            
            if (!metadata) return converted;

            // 递归处理函数
            const processValue = (key: string, value: any): void => {
            if (value === null || value === undefined) {
                converted[key] = '';
            } else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
                converted[key] = value;
            } else if (Array.isArray(value)) {
                // 数组转换为JSON字符串
                converted[key] = JSON.stringify(value);
            } else if (typeof value === 'object') {
                // 对象转换为JSON字符串
                converted[key] = JSON.stringify(value);
            } else {
                // 其他类型转换为字符串
                converted[key] = String(value);
            }
            };

            // 处理顶级字段
            for (const [key, value] of Object.entries(metadata)) {
            processValue(key, value);
            }

            return converted;
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

            // 🆕 检查多个可能的V6 messages集合名称
            const collections = await client.listCollections();
            const collectionNames = collections.map(c => c.name);
            
            // 可能的V6集合名称
            const possibleV6Collections = [
                envConfig.CHROMA_COLLECTION_NAME, // 从配置获取
                `${userinfo.username}-messages`,   // 标准格式
                'messages',                        // 简单格式
                userinfo.username                  // 用户名格式
            ].filter(name => name && name.trim()); // 过滤空值

            let v6CollectionName = '';
            const newCollectionName = `${userinfo.username}-messages`;

            // 查找V6集合
            for (const name of possibleV6Collections) {
                if (collectionNames.includes(name)) {
                    v6CollectionName = name;
                    break;
                }
            }

            if (!v6CollectionName) {
                setStatus({
                    message: `未找到V6消息集合。检查的集合名称: ${possibleV6Collections.join(', ')}`,
                    type: 'warning'
                });
                return;
            }

            // 检查是否为同一张表
            const isSameCollection = v6CollectionName === newCollectionName;

            // 获取V6 messages集合
            const v6Collection = await client.getCollection({ 
                name: v6CollectionName,
                embeddingFunction: undefined
            });

            // 获取所有消息
            const result = await v6Collection.get({
                include: ['metadatas', 'documents'] as any
            });

            if (!result.ids || !result.metadatas) {
                setStatus({message: 'V6消息集合中没有数据', type: 'info'});
                return;
            }

            setMigrationProgress({ processed: 0, total: result.ids.length, errors: 0 });
            setStatus({
                message: `发现 ${result.ids.length} 条V6消息 (集合: ${v6CollectionName})
                ${isSameCollection ? 
                    '⚠️ 与新版本使用同一集合，将进行数据结构更新' : 
                    '✓ 使用不同集合，将复制数据到新集合'}`,
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
        const confirmed = window.confirm('确定要迁移V6数据吗？这将分两步进行：\n1. 迁移消息数据结构\n2. 迁移实体关联数据');
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

            const migrator = new V6DataMigrator(chromaUrl);
            const userinfo = await migrator.getUserInfo();
            const envConfig = await migrator.getEnvConfig();

            // 初始化 ChromaDB 客户端
            const client = new ChromaClient({
                path: chromaUrl
            });

            // 🆕 第一步：确定V6集合和新集合
            const v6CollectionName = envConfig.CHROMA_COLLECTION_NAME;

            if (!v6CollectionName) {
                throw new Error('未找到V6消息集合');
            }

            const newCollectionName = `${userinfo.username}-messages`;
            const isSameCollection = v6CollectionName === newCollectionName;

            // 获取V6集合数据
            const v6Collection = await client.getCollection({ 
                name: v6CollectionName,
                embeddingFunction: undefined
            });

            const result = await v6Collection.get({
                include: ['metadatas', 'documents', 'embeddings'] as any
            });

            if (!result.ids || !result.metadatas || !result.documents) {
                throw new Error('V6消息集合数据不完整');
            }

            setMigrationProgress({ processed: 0, total: result.ids.length * 2, errors: 0 }); // 两步迁移，总数翻倍

            let processed = 0;
            let errors = 0;
            const batchSize = 10;

            // 🆕 第一步：消息数据结构迁移
            setStatus({message: '第一步：正在迁移消息数据结构...', type: 'info'});

            let newCollection;
            if (!isSameCollection) {
                // 创建新集合（如果不存在）
                try {
                    newCollection = await client.getCollection({ 
                        name: newCollectionName,
                        embeddingFunction: undefined
                    });
                } catch {
                    // 集合不存在，创建新集合
                    newCollection = await client.createCollection({ 
                        name: newCollectionName,
                        embeddingFunction: undefined
                    });
                    console.log(`✅ 创建新集合: ${newCollectionName}`);
                }
            } else {
                newCollection = v6Collection;
            }

            // 批量处理消息数据结构迁移
            for (let i = 0; i < result.ids.length; i += batchSize) {
                const endIndex = Math.min(i + batchSize, result.ids.length);
                const batchIds = [];
                const batchDocuments = [];
                const batchMetadatas = [];
                const batchEmbeddings = [];
                
                for (let j = i; j < endIndex; j++) {
                    const messageId = result.ids[j];
                    const v6Metadata = result.metadatas[j] as unknown as V6MessageMetadata;
                    const document = result.documents[j];

                    try {
                        // 转换V6 metadata为新格式
                        const newMetadata = migrator.serializeMetadataForChroma(migrator.convertV6ToNewMetadata(v6Metadata));
                        
                        if (!isSameCollection) {
                            // 不同集合：复制到新集合
                            batchIds.push(messageId);
                            batchDocuments.push(document);
                            batchMetadatas.push(newMetadata as any);
                            batchEmbeddings.push(result.embeddings[j]);
                        } else {
                            // 同一集合：更新数据结构
                            await newCollection.update({
                                ids: [messageId],
                                documents: [document],
                                embeddings: [result.embeddings[j]],
                                metadatas: [newMetadata as any]
                            });
                        }

                        processed++;
                        console.log(`✅ 消息数据结构迁移: ${messageId}`);
                        
                    } catch (messageError) {
                        console.error(`消息数据结构迁移失败 (${messageId}):`, messageError);
                        errors++;
                    }

                    // 更新进度
                    setMigrationProgress({ processed, total: result.ids.length * 2, errors });
                    setStatus({
                        message: `第一步：消息数据结构迁移 ${processed}/${result.ids.length} (错误: ${errors})`,
                        type: 'info'
                    });
                }

                // 批量添加到新集合（如果是不同集合）
                if (!isSameCollection && batchIds.length > 0) {
                    try {
                        await newCollection.add({
                            ids: batchIds,
                            documents: batchDocuments,
                            embeddings: batchEmbeddings,
                            metadatas: batchMetadatas
                        });
                        console.log(`✅ 批量复制 ${batchIds.length} 条消息到新集合`);
                    } catch (batchError) {
                        console.error('批量复制失败:', batchError);
                        errors += batchIds.length;
                    }
                }

                // 批次间延迟
                if (i + batchSize < result.ids.length) {
                    await migrator.delay(100);
                }
            }

            console.log(`✅ 第一步完成：消息数据结构迁移 ${processed - errors}/${result.ids.length}`);

            // 🆕 第二步：实体数据迁移（保留现有逻辑）
            setStatus({message: '第二步：正在迁移实体关联数据...', type: 'info'});

            // 初始化CloudStorage和memory系统
            const cloudStorage = new CloudStorage();
            await cloudStorage.initialize();
            const { memorySystem } = await import('../memory');
            await memorySystem.initialize();

            processed = result.ids.length; // 从第一步结束开始计算

            for (let i = 0; i < result.ids.length; i += batchSize) {
                const endIndex = Math.min(i + batchSize, result.ids.length);
                
                for (let j = i; j < endIndex; j++) {
                    const messageId = result.ids[j];
                    const v6Metadata = result.metadatas[j] as unknown as V6MessageMetadata;

                    try {
                        // 从V6 metadata中提取实体
                        const extractedEntities = migrator.extractV6Entities(v6Metadata, messageId);
                        
                        if (extractedEntities.length > 0) {
                            // 调用updateEntitiesWithRelatedData迁移实体数据
                            await cloudStorage.updateEntitiesWithRelatedData(
                                migrator.convertV6ToNewMetadata(v6Metadata),
                                messageId
                            );

                            // 更新用户画像（如果启用）
                            if (memorySystem.userProfileManager && extractedEntities.length > 0) {
                                try {
                                    await memorySystem.updateUserProfileFromEntities(extractedEntities, {
                                        actionType: 'mention',
                                        timestamp: v6Metadata.timestamp || Date.now(),
                                        context: 'v6_migration',
                                        metadata: {
                                            messageId: messageId,
                                            sender: v6Metadata.source || v6Metadata.sender || 'unknown'
                                        }
                                    });
                                } catch (profileError) {
                                    console.warn(`更新用户画像失败 (${messageId}):`, profileError);
                                }
                            }

                            console.log(`✅ 实体迁移完成: ${messageId}, 实体数量: ${extractedEntities.length}`);
                        }

                        processed++;
                        
                    } catch (messageError) {
                        console.error(`实体迁移失败 (${messageId}):`, messageError);
                        errors++;
                    }

                    // 更新进度
                    setMigrationProgress({ processed, total: result.ids.length * 2, errors });
                    setStatus({
                        message: `第二步：实体数据迁移 ${processed - result.ids.length}/${result.ids.length} (错误: ${errors})`,
                        type: 'info'
                    });
                }

                // 批次间延迟
                if (i + batchSize < result.ids.length) {
                    await migrator.delay(200);
                }
            }

            const successCount = processed - errors;
            setStatus({
                message: `V6数据迁移完成！
                第一步：消息数据结构 ${isSameCollection ? '更新' : '复制'}完成
                第二步：实体关联数据迁移完成
                总计处理: ${successCount}/${result.ids.length * 2}, 错误: ${errors}`,
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
                <h4 style={{ margin: '0 0 10px 0' }}>迁移说明:</h4>
                <ul style={{ margin: '0', paddingLeft: '20px' }}>
                    <li><strong>扫描V6数据：</strong>检查V6版本的messages集合，确定迁移策略</li>
                    <li><strong>两步迁移流程：</strong></li>
                    <ul style={{ paddingLeft: '20px' }}>
                        <li><strong>第一步-消息结构迁移：</strong>转换V6的metadata格式为新版本格式</li>
                        <li><strong>第二步-实体数据迁移：</strong>从V6 entities字段提取实体到graph-entities集合</li>
                    </ul>
                    <li><strong>集合策略：</strong></li>
                    <ul style={{ paddingLeft: '20px' }}>
                        <li>如果V6与新版本使用相同集合名，则直接更新数据结构</li>
                        <li>如果使用不同集合名，则复制数据到新集合</li>
                    </ul>
                    <li><strong>支持的V6实体：</strong>people、projects、topics、resources、location、time</li>
                    <li><strong>用户画像：</strong>同时更新用户画像数据</li>
                    <li>⚠️ 迁移过程可能需要较长时间，分批处理确保稳定性</li>
                    <li>💡 迁移后原V6数据保持完整，可以安全进行</li>
                </ul>
            </div>
        </div>
    );
};

export default V6DataMigrationTool;
