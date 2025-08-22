/**
 * 增强的知识查询界面
 * 支持向量搜索 + 图查询的混合搜索
 */

import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { useState, useEffect, useRef } from 'react';

// 扩展查询结果接口，支持图数据
interface EnhancedQueryResult {
    id: string;
    type: 'vector' | 'entity' | 'relationship' | 'conversation';
    summary: string;
    details: string;
    timestamp: string;
    source: string;
    relevance: number;
    tags: string[];
    
    // 向量搜索结果
    reply_advice?: string;
    team?: {
        name: string;
        id: string;
        url: string;
    };
    
    // 图搜索结果 - 实体
    entityInfo?: {
        entityId: string;
        entityType: string;
        entityName: string;
        properties: Record<string, any>;
        connections: number; // 连接数
    };
    
    // 图搜索结果 - 关系
    relationshipInfo?: {
        relationshipId: string;
        relationshipType: string;
        fromEntity: { id: string; name: string; type: string };
        toEntity: { id: string; name: string; type: string };
        properties: Record<string, any>;
        strength: number;
    };
    
    // 邻居信息
    neighbors?: Array<{
        entity: { id: string; name: string; type: string };
        relationship: { type: string; strength: number };
        depth: number;
    }>;
}

interface QueryOptions {
    searchTargets: ('vector' | 'graph')[];
    entityTypes: string[];
    relationshipTypes: string[];
    timeRange: { start: number; end: number } | null;
    includeNeighbors: boolean;
    maxDepth: number;
    limit: number;
}

interface GraphVisualizationData {
    nodes: Array<{
        id: string;
        name: string;
        type: string;
        size: number;
        color: string;
        properties: Record<string, any>;
    }>;
    edges: Array<{
        id: string;
        source: string;
        target: string;
        type: string;
        strength: number;
        color: string;
        properties: Record<string, any>;
    }>;
}

const EnhancedKnowledgeQuery = () => {
    const [query, setQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [results, setResults] = useState<EnhancedQueryResult[]>([]);
    const [queryOptions, setQueryOptions] = useState<QueryOptions>({
        searchTargets: ['vector', 'graph'],
        entityTypes: [],
        relationshipTypes: [],
        timeRange: null,
        includeNeighbors: true,
        maxDepth: 2,
        limit: 20
    });
    
    // 图可视化相关状态
    const [showGraphView, setShowGraphView] = useState(false);
    const [graphData, setGraphData] = useState<GraphVisualizationData>({ nodes: [], edges: [] });
    
    // 统计信息
    const [queryStats, setQueryStats] = useState({
        vectorResults: 0,
        entityResults: 0,
        relationshipResults: 0,
        queryTime: 0,
        graphConnections: 0
    });
    
    // 过滤和排序
    const [resultFilter, setResultFilter] = useState<'all' | 'vector' | 'entity' | 'relationship'>('all');
    const [sortBy, setSortBy] = useState<'relevance' | 'timestamp' | 'connections'>('relevance');
    
    // 历史和推荐
    const [historyQueries, setHistoryQueries] = useState<string[]>([]);
    const [expandedResults, setExpandedResults] = useState<string[]>([]);

    useEffect(() => {
        loadHistoryQueries();
        loadGraphStatistics();
    }, []);

    const loadHistoryQueries = async () => {
        try {
            const result = await chrome.storage.local.get('enhancedHistoryQueries');
            if (result.enhancedHistoryQueries) {
                setHistoryQueries(result.enhancedHistoryQueries);
            }
        } catch (error) {
            console.error('加载历史查询失败:', error);
        }
    };

    const loadGraphStatistics = async () => {
        try {
            const response = await chrome.runtime.sendMessage({
                type: 'GET_GRAPH_STATISTICS'
            });
            
            if (response && response.statistics) {
                console.log('📊 图存储统计:', response.statistics);
            }
        } catch (error) {
            console.error('加载图统计失败:', error);
        }
    };

    const handleEnhancedSearch = async () => {
        if (!query.trim()) return;
        
        setIsLoading(true);
        const startTime = Date.now();
        
        try {
            // 保存查询历史
            await saveHistoryQuery(query);
            
            console.log('🔍 执行增强搜索:', { query, options: queryOptions });
            
            // 发送增强查询请求
            const response = await chrome.runtime.sendMessage({
                type: 'ENHANCED_KNOWLEDGE_QUERY',
                query: query,
                options: queryOptions
            });

            const queryTime = Date.now() - startTime;
            
            if (response && response.success) {
                const enhancedResults = transformResponseToEnhancedResults(response.data);
                setResults(enhancedResults);
                
                // 更新统计信息
                setQueryStats({
                    vectorResults: enhancedResults.filter(r => r.type === 'vector').length,
                    entityResults: enhancedResults.filter(r => r.type === 'entity').length,
                    relationshipResults: enhancedResults.filter(r => r.type === 'relationship').length,
                    queryTime: queryTime,
                    graphConnections: response.graphConnections || 0
                });
                
                // 构建图可视化数据
                if (queryOptions.includeNeighbors) {
                    buildGraphVisualization(enhancedResults);
                }
                
                console.log('✅ 增强搜索完成:', {
                    总结果: enhancedResults.length,
                    向量结果: enhancedResults.filter(r => r.type === 'vector').length,
                    实体结果: enhancedResults.filter(r => r.type === 'entity').length,
                    关系结果: enhancedResults.filter(r => r.type === 'relationship').length,
                    查询用时: `${queryTime}ms`
                });
                
            } else {
                console.warn('❌ 增强搜索失败:', response);
                setResults([]);
            }
            
        } catch (error) {
            console.error('增强搜索失败:', error);
            setResults([]);
        } finally {
            setIsLoading(false);
        }
    };

    const transformResponseToEnhancedResults = (responseData: any): EnhancedQueryResult[] => {
        const results: EnhancedQueryResult[] = [];
        
        // 处理向量搜索结果
        if (responseData.vectorResults) {
            responseData.vectorResults.forEach((vectorResult: any) => {
                results.push({
                    id: `vector_${vectorResult.id || Math.random()}`,
                    type: 'vector',
                    summary: vectorResult.summary || '',
                    details: vectorResult.details || vectorResult.content || '',
                    timestamp: vectorResult.timestamp || '',
                    source: vectorResult.source || 'unknown',
                    relevance: 1 - (vectorResult.distance || 0), // 余弦距离转换为相关度评分
                    tags: vectorResult.tags || [],
                    reply_advice: vectorResult.reply_advice,
                    team: vectorResult.team
                });
            });
        }
        
        // 处理图实体结果
        if (responseData.entityResults) {
            responseData.entityResults.forEach((entityResult: any) => {
                results.push({
                    id: `entity_${entityResult.id || Math.random()}`,
                    type: 'entity',
                    summary: `实体: ${entityResult.name} (${entityResult.type})`,
                    details: JSON.stringify(entityResult.properties, null, 2),
                    timestamp: new Date(entityResult.updated || entityResult.created || Date.now()).toISOString(),
                    source: entityResult.properties?.source || 'graph',
                    relevance: entityResult.relevance || 0.8,
                    tags: [`实体-${entityResult.type}`],
                    entityInfo: {
                        entityId: entityResult.id,
                        entityType: entityResult.type,
                        entityName: entityResult.name,
                        properties: entityResult.properties || {},
                        connections: entityResult.connections || 0
                    },
                    neighbors: entityResult.neighbors || []
                });
            });
        }
        
        // 处理图关系结果
        if (responseData.relationshipResults) {
            responseData.relationshipResults.forEach((relationshipResult: any) => {
                results.push({
                    id: `relationship_${relationshipResult.id || Math.random()}`,
                    type: 'relationship',
                    summary: `关系: ${relationshipResult.fromEntity?.name} ${relationshipResult.type} ${relationshipResult.toEntity?.name}`,
                    details: JSON.stringify(relationshipResult.properties, null, 2),
                    timestamp: new Date(relationshipResult.updated || relationshipResult.created || Date.now()).toISOString(),
                    source: relationshipResult.properties?.source || 'graph',
                    relevance: relationshipResult.strength || 0.7,
                    tags: [`关系-${relationshipResult.type}`],
                    relationshipInfo: {
                        relationshipId: relationshipResult.id,
                        relationshipType: relationshipResult.type,
                        fromEntity: relationshipResult.fromEntity || { id: '', name: '', type: '' },
                        toEntity: relationshipResult.toEntity || { id: '', name: '', type: '' },
                        properties: relationshipResult.properties || {},
                        strength: relationshipResult.strength || 0
                    }
                });
            });
        }
        
        return results;
    };

    const buildGraphVisualization = (results: EnhancedQueryResult[]) => {
        const nodes = new Map();
        const edges: GraphVisualizationData['edges'] = [];
        
        results.forEach(result => {
            if (result.type === 'entity' && result.entityInfo) {
                const entity = result.entityInfo;
                nodes.set(entity.entityId, {
                    id: entity.entityId,
                    name: entity.entityName,
                    type: entity.entityType,
                    size: Math.max(10, entity.connections * 2),
                    color: getEntityColor(entity.entityType),
                    properties: entity.properties
                });
                
                // 添加邻居节点
                if (result.neighbors) {
                    result.neighbors.forEach(neighbor => {
                        nodes.set(neighbor.entity.id, {
                            id: neighbor.entity.id,
                            name: neighbor.entity.name,
                            type: neighbor.entity.type,
                            size: 8,
                            color: getEntityColor(neighbor.entity.type),
                            properties: {}
                        });
                        
                        // 添加边
                        edges.push({
                            id: `${entity.entityId}_${neighbor.entity.id}`,
                            source: entity.entityId,
                            target: neighbor.entity.id,
                            type: neighbor.relationship.type,
                            strength: neighbor.relationship.strength,
                            color: getRelationshipColor(neighbor.relationship.type),
                            properties: {}
                        });
                    });
                }
            }
            
            if (result.type === 'relationship' && result.relationshipInfo) {
                const rel = result.relationshipInfo;
                
                // 添加起始和结束节点
                nodes.set(rel.fromEntity.id, {
                    id: rel.fromEntity.id,
                    name: rel.fromEntity.name,
                    type: rel.fromEntity.type,
                    size: 10,
                    color: getEntityColor(rel.fromEntity.type),
                    properties: {}
                });
                
                nodes.set(rel.toEntity.id, {
                    id: rel.toEntity.id,
                    name: rel.toEntity.name,
                    type: rel.toEntity.type,
                    size: 10,
                    color: getEntityColor(rel.toEntity.type),
                    properties: {}
                });
                
                // 添加边
                edges.push({
                    id: rel.relationshipId,
                    source: rel.fromEntity.id,
                    target: rel.toEntity.id,
                    type: rel.relationshipType,
                    strength: rel.strength,
                    color: getRelationshipColor(rel.relationshipType),
                    properties: rel.properties
                });
            }
        });
        
        setGraphData({
            nodes: Array.from(nodes.values()),
            edges: edges
        });
    };

    const getEntityColor = (entityType: string): string => {
        const colors = {
            'Person': '#4CAF50',
            'Project': '#2196F3',
            'Task': '#FF9800',
            'Organization': '#9C27B0',
            'Document': '#607D8B',
            'Technology': '#E91E63',
            'Topic': '#795548'
        };
        return colors[entityType] || '#666666';
    };

    const getRelationshipColor = (relationshipType: string): string => {
        const colors = {
            'WORKS_ON': '#4CAF50',
            'ASSIGNED_TO': '#FF9800',
            'BELONGS_TO': '#2196F3',
            'COLLABORATES_WITH': '#9C27B0',
            'MENTIONS': '#607D8B',
            'DEPENDS_ON': '#F44336'
        };
        return colors[relationshipType] || '#999999';
    };

    const saveHistoryQuery = async (newQuery: string) => {
        try {
            const updatedHistory = [newQuery, ...historyQueries.filter(q => q !== newQuery)].slice(0, 10);
            await chrome.storage.local.set({ enhancedHistoryQueries: updatedHistory });
            setHistoryQueries(updatedHistory);
        } catch (error) {
            console.error('保存历史查询失败:', error);
        }
    };

    const getFilteredResults = () => {
        let filtered = results;
        
        // 按类型过滤
        if (resultFilter !== 'all') {
            filtered = filtered.filter(result => result.type === resultFilter);
        }
        
        // 排序
        filtered.sort((a, b) => {
            switch (sortBy) {
                case 'relevance':
                    return b.relevance - a.relevance;
                case 'timestamp':
                    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
                case 'connections':
                    const aConnections = a.entityInfo?.connections || a.neighbors?.length || 0;
                    const bConnections = b.entityInfo?.connections || b.neighbors?.length || 0;
                    return bConnections - aConnections;
                default:
                    return 0;
            }
        });
        
        return filtered;
    };

    const renderResultCard = (result: EnhancedQueryResult) => {
        const isExpanded = expandedResults.includes(result.id);
        
        return (
            <div key={result.id} className="result-card" data-type={result.type}>
                <div className="result-header">
                    <div className="result-type-badge" data-type={result.type}>
                        {result.type === 'vector' && '📄'}
                        {result.type === 'entity' && '🔵'}
                        {result.type === 'relationship' && '🔗'}
                    </div>
                    <div className="result-title">
                        <h4>{result.summary}</h4>
                        <div className="result-meta">
                            <span className="relevance">相关性: {(result.relevance * 100).toFixed(0)}%</span>
                            <span className="source">来源: {result.source}</span>
                            <span className="timestamp">{new Date(result.timestamp).toLocaleDateString()}</span>
                        </div>
                    </div>
                    <button 
                        className="expand-button"
                        onClick={() => toggleResultExpand(result.id)}
                    >
                        {isExpanded ? '收起' : '展开'}
                    </button>
                </div>
                
                {isExpanded && (
                    <div className="result-details">
                        <div className="result-content">
                            <pre>{result.details}</pre>
                        </div>
                        
                        {result.tags.length > 0 && (
                            <div className="result-tags">
                                {result.tags.map((tag, index) => (
                                    <span key={index} className="tag">{tag}</span>
                                ))}
                            </div>
                        )}
                        
                        {result.entityInfo && (
                            <div className="entity-info">
                                <h5>实体详情</h5>
                                <p><strong>类型:</strong> {result.entityInfo.entityType}</p>
                                <p><strong>连接数:</strong> {result.entityInfo.connections}</p>
                            </div>
                        )}
                        
                        {result.relationshipInfo && (
                            <div className="relationship-info">
                                <h5>关系详情</h5>
                                <p><strong>类型:</strong> {result.relationshipInfo.relationshipType}</p>
                                <p><strong>强度:</strong> {(result.relationshipInfo.strength * 100).toFixed(0)}%</p>
                                <p><strong>起点:</strong> {result.relationshipInfo.fromEntity.name}</p>
                                <p><strong>终点:</strong> {result.relationshipInfo.toEntity.name}</p>
                            </div>
                        )}
                        
                        {result.neighbors && result.neighbors.length > 0 && (
                            <div className="neighbors-info">
                                <h5>相关实体 ({result.neighbors.length})</h5>
                                <div className="neighbors-list">
                                    {result.neighbors.slice(0, 5).map((neighbor, index) => (
                                        <div key={index} className="neighbor-item">
                                            <span className="neighbor-name">{neighbor.entity.name}</span>
                                            <span className="neighbor-relation">({neighbor.relationship.type})</span>
                                        </div>
                                    ))}
                                    {result.neighbors.length > 5 && (
                                        <div className="neighbor-more">
                                            还有 {result.neighbors.length - 5} 个相关实体...
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                        
                        {result.reply_advice && (
                            <div className="reply-advice">
                                <h5>回复建议</h5>
                                <p>{result.reply_advice}</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    };

    const toggleResultExpand = (resultId: string) => {
        if (expandedResults.includes(resultId)) {
            setExpandedResults(expandedResults.filter(id => id !== resultId));
        } else {
            setExpandedResults([...expandedResults, resultId]);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleEnhancedSearch();
        }
    };

    const filteredResults = getFilteredResults();

    return (
        <div className="enhanced-knowledge-query">
            <div className="search-section">
                <div className="search-header">
                    <h2>🧠 智能知识查询</h2>
                    <div className="search-stats">
                        {queryStats.queryTime > 0 && (
                            <span>查询用时: {queryStats.queryTime}ms</span>
                        )}
                    </div>
                </div>
                
                <div className="search-input-container">
                    <textarea
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="输入您的问题（支持语义搜索和关系查询）..."
                        className="search-input"
                        rows={2}
                    />
                    <button 
                        onClick={handleEnhancedSearch}
                        disabled={isLoading || !query.trim()}
                        className="search-button"
                    >
                        {isLoading ? '搜索中...' : '🔍 搜索'}
                    </button>
                </div>
                
                {/* 搜索选项 */}
                <div className="search-options">
                    <div className="option-group">
                        <label>搜索范围:</label>
                        <div className="checkbox-group">
                            <label>
                                <input
                                    type="checkbox"
                                    checked={queryOptions.searchTargets.includes('vector')}
                                    onChange={(e) => {
                                        const targets = e.target.checked 
                                            ? [...queryOptions.searchTargets, 'vector']
                                            : queryOptions.searchTargets.filter(t => t !== 'vector');
                                        setQueryOptions({...queryOptions, searchTargets: targets});
                                    }}
                                />
                                📄 向量搜索
                            </label>
                            <label>
                                <input
                                    type="checkbox"
                                    checked={queryOptions.searchTargets.includes('graph')}
                                    onChange={(e) => {
                                        const targets = e.target.checked 
                                            ? [...queryOptions.searchTargets, 'graph']
                                            : queryOptions.searchTargets.filter(t => t !== 'graph');
                                        setQueryOptions({...queryOptions, searchTargets: targets});
                                    }}
                                />
                                🕸️ 图搜索
                            </label>
                        </div>
                    </div>
                    
                    <div className="option-group">
                        <label>
                            <input
                                type="checkbox"
                                checked={queryOptions.includeNeighbors}
                                onChange={(e) => setQueryOptions({
                                    ...queryOptions, 
                                    includeNeighbors: e.target.checked
                                })}
                            />
                            包含关联实体
                        </label>
                    </div>
                    
                    <div className="option-group">
                        <label>最大关联深度:</label>
                        <select
                            value={queryOptions.maxDepth}
                            onChange={(e) => setQueryOptions({
                                ...queryOptions,
                                maxDepth: Number(e.target.value)
                            })}
                        >
                            <option value={1}>1层</option>
                            <option value={2}>2层</option>
                            <option value={3}>3层</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* 结果统计 */}
            {results.length > 0 && (
                <div className="results-summary">
                    <div className="summary-stats">
                        <span>总结果: {results.length}</span>
                        <span>向量: {queryStats.vectorResults}</span>
                        <span>实体: {queryStats.entityResults}</span>
                        <span>关系: {queryStats.relationshipResults}</span>
                        {queryStats.graphConnections > 0 && (
                            <span>图连接: {queryStats.graphConnections}</span>
                        )}
                    </div>
                    
                    <div className="view-options">
                        <div className="filter-options">
                            <select 
                                value={resultFilter} 
                                onChange={(e) => setResultFilter(e.target.value as any)}
                            >
                                <option value="all">所有结果</option>
                                <option value="vector">向量结果</option>
                                <option value="entity">实体结果</option>
                                <option value="relationship">关系结果</option>
                            </select>
                            
                            <select 
                                value={sortBy} 
                                onChange={(e) => setSortBy(e.target.value as any)}
                            >
                                <option value="relevance">按相关性</option>
                                <option value="timestamp">按时间</option>
                                <option value="connections">按连接数</option>
                            </select>
                        </div>
                        
                        {graphData.nodes.length > 0 && (
                            <button 
                                onClick={() => setShowGraphView(!showGraphView)}
                                className="graph-view-toggle"
                            >
                                {showGraphView ? '📋 列表视图' : '🕸️ 图视图'}
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* 结果展示区域 */}
            <div className="results-section">
                {showGraphView && graphData.nodes.length > 0 ? (
                    <div className="graph-visualization">
                        <div className="graph-info">
                            <p>📊 图可视化: {graphData.nodes.length} 个节点, {graphData.edges.length} 条边</p>
                            <p>💡 提示: 节点大小表示连接数，颜色表示实体类型</p>
                        </div>
                        <div className="graph-container">
                            {/* 这里可以集成图可视化库，如 D3.js 或 vis.js */}
                            <div className="graph-placeholder">
                                <p>🚧 图可视化组件待集成</p>
                                <p>节点: {graphData.nodes.map(n => n.name).join(', ')}</p>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="results-list">
                        {filteredResults.length > 0 ? (
                            filteredResults.map(renderResultCard)
                        ) : (
                            <div className="no-results">
                                {results.length === 0 ? (
                                    isLoading ? (
                                        <p>🔍 搜索中...</p>
                                    ) : (
                                        <p>暂无结果，请尝试其他关键词</p>
                                    )
                                ) : (
                                    <p>当前过滤条件下无结果</p>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* 历史查询 */}
            {historyQueries.length > 0 && (
                <div className="history-section">
                    <h3>📚 历史查询</h3>
                    <div className="history-list">
                        {historyQueries.slice(0, 5).map((historyQuery, index) => (
                            <button
                                key={index}
                                onClick={() => {
                                    setQuery(historyQuery);
                                    setTimeout(handleEnhancedSearch, 100);
                                }}
                                className="history-item"
                            >
                                {historyQuery}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

// 渲染到页面
const container = document.getElementById('enhanced-knowledge-query-root');
if (container) {
    ReactDOM.render(<EnhancedKnowledgeQuery />, container);
}

export default EnhancedKnowledgeQuery;