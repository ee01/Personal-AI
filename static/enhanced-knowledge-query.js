/**
 * 增强知识查询界面的JavaScript逻辑
 */

// 全局状态
let currentResults = [];
let queryStats = {
    vectorResults: 0,
    entityResults: 0,
    relationshipResults: 0,
    queryTime: 0,
    graphConnections: 0
};
let expandedResults = new Set();
let historyQueries = [];
let showGraphView = false;
let graphData = { nodes: [], edges: [] };

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 增强知识查询页面加载完成');
    initializeEnhancedQuery();
    bindEventListeners();
    loadHistoryQueries();
    checkSystemStatus();
});

// 初始化增强查询
function initializeEnhancedQuery() {
    updateSearchStats('loading', '正在初始化...');
    
    // 检查Chrome扩展API
    if (typeof chrome === 'undefined' || !chrome.runtime) {
        updateSearchStats('error', '❌ Chrome扩展API不可用');
        return;
    }
    
    updateSearchStats('healthy', '✅ 系统就绪');
}

// 绑定事件监听器
function bindEventListeners() {
    // 搜索按钮
    document.getElementById('search-button').addEventListener('click', handleEnhancedSearch);
    
    // 回车键搜索
    document.getElementById('query-input').addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleEnhancedSearch();
        }
    });
    
    // 过滤器变化
    document.getElementById('result-filter').addEventListener('change', updateResultsDisplay);
    document.getElementById('sort-by').addEventListener('change', updateResultsDisplay);
    
    // 图视图切换
    document.getElementById('graph-view-toggle').addEventListener('click', toggleGraphView);
    
    // 搜索选项变化
    document.getElementById('search-vector').addEventListener('change', updateSearchButton);
    document.getElementById('search-graph').addEventListener('change', updateSearchButton);
}

// 更新搜索状态显示
function updateSearchStats(status, message) {
    const statsElement = document.getElementById('search-stats');
    const indicator = statsElement.querySelector('.status-indicator');
    
    indicator.className = `status-indicator status-${status}`;
    statsElement.innerHTML = `<span class="status-indicator status-${status}"></span>${message}`;
}

// 检查系统状态
async function checkSystemStatus() {
    try {
        const response = await chrome.runtime.sendMessage({
            type: 'GET_GRAPH_STATISTICS'
        });
        
        if (response && response.success) {
            const stats = response.statistics;
            updateSearchStats('healthy', `✅ 系统就绪 (${stats.localEntityTypes || 0} 个实体类型, ${stats.localRelationships || 0} 个关系)`);
        } else {
            updateSearchStats('warning', '⚠️ 部分功能可能不可用');
        }
    } catch (error) {
        console.error('检查系统状态失败:', error);
        updateSearchStats('warning', '⚠️ 无法获取系统状态');
    }
}

// 执行增强搜索
async function handleEnhancedSearch() {
    const query = document.getElementById('query-input').value.trim();
    if (!query) {
        alert('请输入查询内容');
        return;
    }

    const searchVector = document.getElementById('search-vector').checked;
    const searchGraph = document.getElementById('search-graph').checked;
    const includeNeighbors = document.getElementById('include-neighbors').checked;
    const maxDepth = parseInt(document.getElementById('max-depth').value);
    const limit = parseInt(document.getElementById('result-limit').value);

    if (!searchVector && !searchGraph) {
        alert('请至少选择一种搜索方式');
        return;
    }

    // 禁用搜索按钮并显示加载状态
    const searchButton = document.getElementById('search-button');
    const originalText = searchButton.textContent;
    searchButton.disabled = true;
    searchButton.innerHTML = '<span class="loading"></span> 搜索中...';

    try {
        updateSearchStats('loading', '🔍 正在执行智能搜索...');

        const options = {
            searchTargets: [],
            entityTypes: [],
            relationshipTypes: [],
            timeRange: null,
            includeNeighbors: includeNeighbors,
            maxDepth: maxDepth,
            limit: limit
        };

        if (searchVector) options.searchTargets.push('vector');
        if (searchGraph) options.searchTargets.push('graph');

        console.log('🔍 发送查询请求:', { query, options });

        const response = await chrome.runtime.sendMessage({
            type: 'ENHANCED_KNOWLEDGE_QUERY',
            query: query,
            options: options
        });

        console.log('📥 收到查询响应:', response);

        if (response && response.success) {
            await saveHistoryQuery(query);
            displayQueryResults(response);
            updateSearchStats('healthy', `✅ 查询完成 (${response.queryTime}ms)`);
        } else {
            throw new Error(response?.error || '查询失败');
        }

    } catch (error) {
        console.error('查询失败:', error);
        updateSearchStats('error', `❌ 查询失败: ${error.message}`);
        displayError(error.message);
    } finally {
        // 恢复搜索按钮
        searchButton.disabled = false;
        searchButton.textContent = originalText;
    }
}

// 显示查询结果
function displayQueryResults(response) {
    const data = response.data;
    
    // 更新统计信息
    queryStats = {
        vectorResults: data.vectorResults?.length || 0,
        entityResults: data.entityResults?.length || 0,
        relationshipResults: data.relationshipResults?.length || 0,
        queryTime: response.queryTime,
        graphConnections: data.graphConnections || 0
    };

    // 转换结果格式
    currentResults = [];
    
    // 处理向量搜索结果
    if (data.vectorResults) {
        data.vectorResults.forEach((result, index) => {
            currentResults.push({
                id: `vector_${index}`,
                type: 'vector',
                summary: result.summary || '无标题',
                details: result.details || result.content || '',
                timestamp: result.timestamp || new Date().toISOString(),
                source: result.source || 'unknown',
                relevance: 1 - (result.distance || 0),
                tags: result.tags || [],
                reply_advice: result.reply_advice,
                team: result.team
            });
        });
    }
    
    // 处理实体结果
    if (data.entityResults) {
        data.entityResults.forEach((entity, index) => {
            currentResults.push({
                id: `entity_${index}`,
                type: 'entity',
                summary: `实体: ${entity.name} (${entity.type})`,
                details: JSON.stringify(entity.properties || {}, null, 2),
                timestamp: new Date(entity.updated || entity.created || Date.now()).toISOString(),
                source: entity.properties?.source || 'graph',
                relevance: entity.relevance || 0.8,
                tags: [`实体-${entity.type}`],
                entityInfo: {
                    entityId: entity.id,
                    entityType: entity.type,
                    entityName: entity.name,
                    properties: entity.properties || {},
                    connections: entity.connections || 0
                },
                neighbors: entity.neighbors || []
            });
        });
    }
    
    // 处理关系结果
    if (data.relationshipResults) {
        data.relationshipResults.forEach((rel, index) => {
            currentResults.push({
                id: `relationship_${index}`,
                type: 'relationship',
                summary: `关系: ${rel.fromEntity?.name || '?'} ${rel.type} ${rel.toEntity?.name || '?'}`,
                details: JSON.stringify(rel.properties || {}, null, 2),
                timestamp: new Date(rel.updated || rel.created || Date.now()).toISOString(),
                source: rel.properties?.source || 'graph',
                relevance: rel.strength || 0.7,
                tags: [`关系-${rel.type}`],
                relationshipInfo: {
                    relationshipId: rel.id,
                    relationshipType: rel.type,
                    fromEntity: rel.fromEntity || { id: '', name: '', type: '' },
                    toEntity: rel.toEntity || { id: '', name: '', type: '' },
                    properties: rel.properties || {},
                    strength: rel.strength || 0
                }
            });
        });
    }

    // 构建图数据
    buildGraphData();
    
    // 更新显示
    updateResultsSummary();
    updateResultsDisplay();
    
    console.log('📊 查询结果处理完成:', {
        总结果: currentResults.length,
        向量: queryStats.vectorResults,
        实体: queryStats.entityResults,
        关系: queryStats.relationshipResults
    });
}

// 构建图数据
function buildGraphData() {
    const nodes = new Map();
    const edges = [];
    
    currentResults.forEach(result => {
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
    
    graphData = {
        nodes: Array.from(nodes.values()),
        edges: edges
    };
}

// 获取实体颜色
function getEntityColor(entityType) {
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
}

// 获取关系颜色
function getRelationshipColor(relationshipType) {
    const colors = {
        'WORKS_ON': '#4CAF50',
        'ASSIGNED_TO': '#FF9800',
        'BELONGS_TO': '#2196F3',
        'COLLABORATES_WITH': '#9C27B0',
        'MENTIONS': '#607D8B',
        'DEPENDS_ON': '#F44336'
    };
    return colors[relationshipType] || '#999999';
}

// 更新结果摘要
function updateResultsSummary() {
    const summaryElement = document.getElementById('results-summary');
    const statsElement = document.getElementById('summary-stats');
    
    if (currentResults.length > 0) {
        summaryElement.style.display = 'flex';
        
        statsElement.innerHTML = `
            <span>总结果: ${currentResults.length}</span>
            <span>向量: ${queryStats.vectorResults}</span>
            <span>实体: ${queryStats.entityResults}</span>
            <span>关系: ${queryStats.relationshipResults}</span>
            ${queryStats.graphConnections > 0 ? `<span>图连接: ${queryStats.graphConnections}</span>` : ''}
        `;
        
        // 显示图视图切换按钮
        const graphToggle = document.getElementById('graph-view-toggle');
        if (graphData.nodes.length > 0) {
            graphToggle.style.display = 'block';
        }
    } else {
        summaryElement.style.display = 'none';
    }
}

// 更新结果显示
function updateResultsDisplay() {
    const filter = document.getElementById('result-filter').value;
    const sortBy = document.getElementById('sort-by').value;
    
    // 过滤结果
    let filteredResults = currentResults;
    if (filter !== 'all') {
        filteredResults = currentResults.filter(result => result.type === filter);
    }
    
    // 排序结果
    filteredResults.sort((a, b) => {
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
    
    // 显示结果
    const resultsContainer = document.getElementById('results-list');
    
    if (filteredResults.length === 0) {
        resultsContainer.innerHTML = `
            <div class="no-results">
                ${currentResults.length === 0 ? 
                    '<p>暂无结果，请尝试其他关键词</p>' : 
                    '<p>当前过滤条件下无结果</p>'
                }
            </div>
        `;
        return;
    }
    
    resultsContainer.innerHTML = filteredResults.map(result => renderResultCard(result)).join('');
    
    // 绑定展开/收起事件
    resultsContainer.querySelectorAll('.expand-button').forEach(button => {
        button.addEventListener('click', function() {
            const resultId = this.dataset.resultId;
            toggleResultExpand(resultId);
        });
    });
}

// 渲染结果卡片
function renderResultCard(result) {
    const isExpanded = expandedResults.has(result.id);
    
    return `
        <div class="result-card" data-type="${result.type}">
            <div class="result-header">
                <div class="result-type-badge" data-type="${result.type}">
                    ${result.type === 'vector' ? '📄' : 
                      result.type === 'entity' ? '🔵' : '🔗'}
                </div>
                <div class="result-title">
                    <h4>${result.summary}</h4>
                    <div class="result-meta">
                        <span class="relevance">相关性: ${(result.relevance * 100).toFixed(0)}%</span>
                        <span class="source">来源: ${result.source}</span>
                        <span class="timestamp">${new Date(result.timestamp).toLocaleDateString()}</span>
                    </div>
                </div>
                <button class="expand-button" data-result-id="${result.id}">
                    ${isExpanded ? '收起' : '展开'}
                </button>
            </div>
            
            ${isExpanded ? renderResultDetails(result) : ''}
        </div>
    `;
}

// 渲染结果详情
function renderResultDetails(result) {
    let detailsHtml = `
        <div class="result-details">
            <div class="result-content">
                <pre>${result.details}</pre>
            </div>
    `;
    
    // 标签
    if (result.tags.length > 0) {
        detailsHtml += `
            <div class="result-tags">
                ${result.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
            </div>
        `;
    }
    
    // 实体信息
    if (result.entityInfo) {
        detailsHtml += `
            <div class="entity-info">
                <h5>实体详情</h5>
                <p><strong>类型:</strong> ${result.entityInfo.entityType}</p>
                <p><strong>连接数:</strong> ${result.entityInfo.connections}</p>
            </div>
        `;
    }
    
    // 关系信息
    if (result.relationshipInfo) {
        detailsHtml += `
            <div class="relationship-info">
                <h5>关系详情</h5>
                <p><strong>类型:</strong> ${result.relationshipInfo.relationshipType}</p>
                <p><strong>强度:</strong> ${(result.relationshipInfo.strength * 100).toFixed(0)}%</p>
                <p><strong>起点:</strong> ${result.relationshipInfo.fromEntity.name}</p>
                <p><strong>终点:</strong> ${result.relationshipInfo.toEntity.name}</p>
            </div>
        `;
    }
    
    // 邻居信息
    if (result.neighbors && result.neighbors.length > 0) {
        detailsHtml += `
            <div class="neighbors-info">
                <h5>相关实体 (${result.neighbors.length})</h5>
                <div class="neighbors-list">
                    ${result.neighbors.slice(0, 5).map(neighbor => `
                        <div class="neighbor-item">
                            <span class="neighbor-name">${neighbor.entity.name}</span>
                            <span class="neighbor-relation">(${neighbor.relationship.type})</span>
                        </div>
                    `).join('')}
                    ${result.neighbors.length > 5 ? `
                        <div class="neighbor-more">
                            还有 ${result.neighbors.length - 5} 个相关实体...
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }
    
    // 回复建议
    if (result.reply_advice) {
        detailsHtml += `
            <div class="reply-advice">
                <h5>回复建议</h5>
                <p>${result.reply_advice}</p>
            </div>
        `;
    }
    
    detailsHtml += '</div>';
    return detailsHtml;
}

// 切换结果展开/收起
function toggleResultExpand(resultId) {
    if (expandedResults.has(resultId)) {
        expandedResults.delete(resultId);
    } else {
        expandedResults.add(resultId);
    }
    updateResultsDisplay();
}

// 切换图视图
function toggleGraphView() {
    showGraphView = !showGraphView;
    const button = document.getElementById('graph-view-toggle');
    const resultsList = document.getElementById('results-list');
    const graphViz = document.getElementById('graph-visualization');
    
    if (showGraphView) {
        button.textContent = '📋 列表视图';
        resultsList.style.display = 'none';
        graphViz.style.display = 'block';
        updateGraphVisualization();
    } else {
        button.textContent = '🕸️ 图视图';
        resultsList.style.display = 'block';
        graphViz.style.display = 'none';
    }
}

// 更新图可视化
function updateGraphVisualization() {
    const infoText = document.getElementById('graph-info-text');
    const textDisplay = document.getElementById('graph-text-display');
    
    infoText.textContent = `📊 图可视化: ${graphData.nodes.length} 个节点, ${graphData.edges.length} 条边`;
    
    // 显示文本版本的图数据
    let textContent = '<h4>节点:</h4>';
    graphData.nodes.forEach(node => {
        textContent += `<p style="margin: 5px 0;"><strong>${node.name}</strong> (${node.type})</p>`;
    });
    
    if (graphData.edges.length > 0) {
        textContent += '<h4>关系:</h4>';
        graphData.edges.forEach(edge => {
            const sourceNode = graphData.nodes.find(n => n.id === edge.source);
            const targetNode = graphData.nodes.find(n => n.id === edge.target);
            textContent += `<p style="margin: 5px 0;">${sourceNode?.name || edge.source} <strong>${edge.type}</strong> ${targetNode?.name || edge.target}</p>`;
        });
    }
    
    textDisplay.innerHTML = textContent;
}

// 显示错误
function displayError(errorMessage) {
    const resultsContainer = document.getElementById('results-list');
    resultsContainer.innerHTML = `
        <div class="no-results">
            <p>❌ 查询失败: ${errorMessage}</p>
            <p>请检查网络连接或稍后重试</p>
        </div>
    `;
    
    // 隐藏结果摘要
    document.getElementById('results-summary').style.display = 'none';
}

// 加载历史查询
async function loadHistoryQueries() {
    try {
        const result = await chrome.storage.local.get('enhancedHistoryQueries');
        if (result.enhancedHistoryQueries) {
            historyQueries = result.enhancedHistoryQueries;
            updateHistoryDisplay();
        }
    } catch (error) {
        console.error('加载历史查询失败:', error);
    }
}

// 保存历史查询
async function saveHistoryQuery(newQuery) {
    try {
        const updatedHistory = [newQuery, ...historyQueries.filter(q => q !== newQuery)].slice(0, 10);
        await chrome.storage.local.set({ enhancedHistoryQueries: updatedHistory });
        historyQueries = updatedHistory;
        updateHistoryDisplay();
    } catch (error) {
        console.error('保存历史查询失败:', error);
    }
}

// 更新历史显示
function updateHistoryDisplay() {
    const historySection = document.getElementById('history-section');
    const historyList = document.getElementById('history-list');
    
    if (historyQueries.length > 0) {
        historySection.style.display = 'block';
        historyList.innerHTML = historyQueries.slice(0, 5).map(query => `
            <button class="history-item" onclick="selectHistoryQuery('${query.replace(/'/g, "\\'")}')">
                ${query}
            </button>
        `).join('');
    } else {
        historySection.style.display = 'none';
    }
}

// 选择历史查询
function selectHistoryQuery(query) {
    document.getElementById('query-input').value = query;
    setTimeout(handleEnhancedSearch, 100);
}

// 更新搜索按钮状态
function updateSearchButton() {
    const searchVector = document.getElementById('search-vector').checked;
    const searchGraph = document.getElementById('search-graph').checked;
    const searchButton = document.getElementById('search-button');
    
    if (!searchVector && !searchGraph) {
        searchButton.disabled = true;
        searchButton.textContent = '请选择搜索方式';
    } else {
        searchButton.disabled = false;
        searchButton.textContent = '🔍 搜索';
    }
}

// 错误处理
window.addEventListener('error', function(e) {
    console.error('页面错误:', e.error);
    updateSearchStats('error', `❌ 页面错误: ${e.error.message}`);
});

// 导出全局函数
window.selectHistoryQuery = selectHistoryQuery;