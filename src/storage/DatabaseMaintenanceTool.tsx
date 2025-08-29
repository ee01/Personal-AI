import * as React from 'react';
import { useState } from 'react';

// 数据库维护工具组件
export const DatabaseMaintenanceTool = () => {
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

            // 分析备份文件内容
            const collectionsInfo = Object.entries(backupData.collections).map(([name, data]: [string, any]) => ({
                name,
                recordCount: data?.ids?.length || 0,
                hasError: !!(data as any)?.error
            }));
            
            const totalRecordsInBackup = collectionsInfo.reduce((sum, c) => sum + c.recordCount, 0);
            const validCollections = collectionsInfo.filter(c => !c.hasError);

            setStatus({
                message: `分析备份文件：${validCollections.length}/${collectionsInfo.length} 个有效集合，共 ${totalRecordsInBackup} 条记录`,
                type: 'info'
            });

            const confirmed = window.confirm(
                `确定要还原备份文件吗？\n\n文件信息:\n- 用户: ${backupData.username}\n- 备份时间: ${new Date(backupData.backupTime).toLocaleString()}\n- 总集合数: ${collectionsInfo.length}\n- 有效集合数: ${validCollections.length}\n- 总记录数: ${totalRecordsInBackup}\n\n⚠️ 这将覆盖现有的同名集合！`
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
                        name: collectionName,
                        metadata: { "hnsw:space": "cosine" }
                    });

                    // 添加数据（如果有的话）
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
                    
                    setStatus({
                        message: `已还原集合: ${collectionName} (${data.ids?.length || 0} 条记录)`,
                        type: 'info'
                    });
                } catch (error) {
                    console.error(`还原集合 ${collectionName} 失败:`, error);
                    failedCollections++;
                }
            }

            const totalCollections = Object.keys(backupData.collections).length;
            const successRate = restoredCollections / totalCollections;
            
            if (restoredCollections > 0) {
                let statusType: 'success' | 'warning' = 'success';
                let message = `还原完成！成功还原 ${restoredCollections}/${totalCollections} 个集合，共 ${totalRecords} 条记录`;
                
                if (failedCollections > 0) {
                    message += `。失败: ${failedCollections} 个集合`;
                    statusType = 'warning';
                }
                
                setStatus({
                    message,
                    type: statusType
                });
                
                // 重新获取统计
                setTimeout(() => getUserStats(), 1000);
            } else {
                setStatus({
                    message: `还原失败，没有成功还原任何集合。失败原因：${failedCollections > 0 ? '所有集合都创建失败' : '备份文件中没有有效的集合数据'}`,
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

            {/* 清空数据设置 - 只有在获取了用户数据统计后才显示 */}
            {userStats && (
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
                        disabled={loading}
                        style={{ 
                            backgroundColor: '#f44336',
                            color: 'white',
                            fontSize: '13px',
                            padding: '6px 12px'
                        }}
                    >
                        {loading ? '清理中...' : clearMode === 'all' ? '清空所有数据' : '清理时间范围数据'}
                    </button>
                </div>
            )}

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
