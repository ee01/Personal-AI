/**
 * 增强知识查询处理器
 * 处理来自增强查询界面的请求，协调向量搜索和图查询
 * 重构版本 - 使用新的记忆系统
 */

import { knowledgeQuery } from './llm';
import { memorySystem } from './memory';
import { getEnvConfig } from './utils';

export interface EnhancedQueryOptions {
    searchTargets: ('vector' | 'graph')[];
    entityTypes: string[];
    includeNeighbors: boolean;
    maxDepth: number;
    limit: number;
}

/**
 * 执行增强知识查询
 */
export async function executeEnhancedKnowledgeQuery(
    query: string,
    options: EnhancedQueryOptions
): Promise<{
    success: boolean;
    searchResults: any[];
    vectorResults: any[];
    graphResults: any[];
    reasoning: string;
    confidence: number;
    processingTime: number;
    error?: string;
}> {
    const startTime = Date.now();
    
    try {
        console.log('🔍 开始增强知识查询:', query);
        console.log('查询选项:', options);
        
        // 确保记忆系统已初始化
        await memorySystem.initialize();
        
        const searchResults: any[] = [];
        const vectorResults: any[] = [];
        const graphResults: any[] = [];
        
        // 1. 向量搜索
        if (options.searchTargets.includes('vector')) {
            try {
                console.log('🎯 执行向量搜索...');
                
                if (options.entityTypes.length > 0) {
                    // 分类型搜索
                    for (const entityType of options.entityTypes) {
                        const results = await memorySystem.searchByVector(query, entityType, {
                            nResults: Math.floor(options.limit / options.entityTypes.length),
                            threshold: 0.7
                        });
                        vectorResults.push(...results.data);
                    }
                } else {
                    // 全类型搜索
                    const results = await memorySystem.searchByVector(query, undefined, {
                        nResults: options.limit,
                        threshold: 0.7
                    });
                    vectorResults.push(...results.data);
                }
                
                console.log(`📊 向量搜索结果: ${vectorResults.length} 个实体`);
            } catch (error) {
                console.error('向量搜索失败:', error);
            }
        }
        
        // 2. 图查询
        if (options.searchTargets.includes('graph')) {
            try {
                console.log('🕸️ 执行图查询...');
                
                // 普通实体查询
                const entityResults = await memorySystem.queryEntities(
                    options.entityTypes.length > 0 ? options.entityTypes[0] : undefined,
                    query,
                    { limit: options.limit }
                );
                
                graphResults.push(...entityResults.data);
                
                // 如果需要包含邻居，获取关系网络
                if (options.includeNeighbors && graphResults.length > 0) {
                    const topEntity = graphResults[0];
                    const relationshipNetwork = await memorySystem.getRelationships(
                        topEntity.id, 
                        options.maxDepth
                    );
                    
                    // 添加相关实体
                    graphResults.push(...relationshipNetwork.entities);
                }
                
                console.log(`📊 图查询结果: ${graphResults.length} 个实体`);
            } catch (error) {
                console.error('图查询失败:', error);
            }
        }
        
        // 3. 合并去重结果
        const allResults = [...vectorResults, ...graphResults];
        const uniqueResults = allResults.filter((item, index, self) => 
            index === self.findIndex(t => t.id === item.id)
        );
        
        searchResults.push(...uniqueResults);
        
        // 4. 使用 LLM 分析结果
        let reasoning = '';
        let confidence = 0.5;
        
        try {
            if (searchResults.length > 0) {
                const analysisPrompt = `
查询问题: ${query}

搜索结果:
${searchResults.slice(0, 5).map((item, index) => `
${index + 1}. ${item.name || item.title || '未知'}
   类型: ${item.type || '未知'}
   描述: ${item.description || '无描述'}
`).join('')}

请分析这些搜索结果与查询问题的相关性，并给出：
1. 推理过程（150字以内）
2. 置信度评分（0-1之间的数字）

格式：
推理：[你的分析]
置信度：[0-1的数字]
`;

                const analysisResult = await knowledgeQuery(analysisPrompt);
                
                // 解析 LLM 响应
                const analysisText = typeof analysisResult === 'string' ? analysisResult : analysisResult.analysis || '';
                const reasoningMatch = analysisText.match(/推理：(.+?)(?=置信度：|$)/s);
                const confidenceMatch = analysisText.match(/置信度：([0-9.]+)/);
                
                reasoning = reasoningMatch?.[1]?.trim() || '搜索结果分析中...';
                confidence = parseFloat(confidenceMatch?.[1] || '0.5');
                
                console.log('🧠 LLM 分析完成:', { reasoning: reasoning.slice(0, 50) + '...', confidence });
            } else {
                reasoning = '未找到相关结果，建议尝试不同的关键词或搜索条件。';
                confidence = 0.1;
            }
        } catch (error) {
            console.error('LLM 分析失败:', error);
            reasoning = '结果分析失败，但搜索结果仍然可用。';
        }
        
        const processingTime = Date.now() - startTime;
        
        console.log(`✅ 增强查询完成: ${searchResults.length} 个结果，耗时 ${processingTime}ms`);
        
        return {
            success: true,
            searchResults,
            vectorResults,
            graphResults,
            reasoning,
            confidence,
            processingTime
        };
        
    } catch (error) {
        console.error('❌ 增强知识查询失败:', error);
        
        return {
            success: false,
            searchResults: [],
            vectorResults: [],
            graphResults: [],
            reasoning: `查询处理失败: ${error.message}`,
            confidence: 0,
            processingTime: Date.now() - startTime,
            error: error.message
        };
    }
}

/**
 * 执行图数据查询（兼容旧接口）
 */
export async function executeGraphQuery(
    query: string,
    options: EnhancedQueryOptions
): Promise<{
    entities: any[];
    relationships: any[];
    totalConnections: number;
}> {
    try {
        await memorySystem.initialize();
        
        // 使用新的记忆系统进行搜索
        const searchResults = await memorySystem.searchByVector(query, undefined, {
            nResults: options.limit || 20
        });
        
        // 获取关系网络（如果需要）
        let relationships: any[] = [];
        if (options.includeNeighbors && searchResults.data.length > 0) {
            const topEntityId = searchResults.data[0].id;
            const relationshipNetwork = await memorySystem.getRelationships(topEntityId, options.maxDepth || 1);
            relationships = relationshipNetwork.relationships;
        }
        
        return {
            entities: searchResults.data,
            relationships,
            totalConnections: searchResults.data.length
        };
    } catch (error) {
        console.error('图查询失败:', error);
        return {
            entities: [],
            relationships: [],
            totalConnections: 0
        };
    }
}

/**
 * 获取图统计信息
 */
export async function getGraphStatistics(): Promise<{
    success: boolean;
    totalEntities: number;
    totalRelationships: number;
    entityTypes: Record<string, number>;
    lastUpdated: number;
    error?: string;
}> {
    try {
        await memorySystem.initialize();
        const statistics = await memorySystem.getEntityStatistics();
        
        return {
            success: true,
            totalEntities: statistics.totalEntities,
            totalRelationships: statistics.totalRelationships,
            entityTypes: statistics.entityCounts,
            lastUpdated: Date.now()
        };
    } catch (error) {
        console.error('获取图统计信息失败:', error);
        return {
            success: false,
            totalEntities: 0,
            totalRelationships: 0,
            entityTypes: {},
            lastUpdated: Date.now(),
            error: error.message
        };
    }
}

/**
 * 同步图数据
 */
export async function syncGraphData(): Promise<{
    success: boolean;
    synced: boolean;
    syncedEntities: number;
    syncedRelationships: number;
    syncTime: number;
    error?: string;
}> {
    try {
        console.log('🔄 开始图数据同步...');
        
        await memorySystem.initialize();
        const syncResult = await memorySystem.performInitialSyncIfNeeded();
        
        if (syncResult.syncPerformed) {
            console.log(`✅ 同步完成: ${syncResult.entitiesDownloaded} 个实体, ${syncResult.relationshipsRestored} 个关系`);
            return {
                success: true,
                synced: true,
                syncedEntities: syncResult.entitiesDownloaded,
                syncedRelationships: syncResult.relationshipsRestored,
                syncTime: Date.now()
            };
        } else {
            console.log('📝 无需同步，数据已是最新');
            return {
                success: true,
                synced: false,
                syncedEntities: 0,
                syncedRelationships: 0,
                syncTime: Date.now()
            };
        }
    } catch (error) {
        console.error('❌ 图数据同步失败:', error);
        return {
            success: false,
            synced: false,
            syncedEntities: 0,
            syncedRelationships: 0,
            syncTime: Date.now(),
            error: error.message
        };
    }
}

/**
 * 备份图数据
 */
export async function backupGraphData(): Promise<{
    success: boolean;
    backed: boolean;
    backedEntities: number;
    backedRelationships: number;
    backupTime: number;
    error?: string;
}> {
    try {
        console.log('☁️ 开始图数据备份...');
        
        await memorySystem.initialize();
        const backupSuccess = await memorySystem.backupRelationships();
        
        if (backupSuccess) {
            const statistics = await memorySystem.getEntityStatistics();
            console.log(`✅ 备份完成: ${statistics.totalEntities} 个实体, ${statistics.totalRelationships} 个关系`);
            
            return {
                success: true,
                backed: true,
                backedEntities: statistics.totalEntities,
                backedRelationships: statistics.totalRelationships,
                backupTime: Date.now()
            };
        } else {
            console.log('⚠️ 备份失败或无数据需要备份');
            return {
                success: true,
                backed: false,
                backedEntities: 0,
                backedRelationships: 0,
                backupTime: Date.now()
            };
        }
    } catch (error) {
        console.error('❌ 图数据备份失败:', error);
        return {
            success: false,
            backed: false,
            backedEntities: 0,
            backedRelationships: 0,
            backupTime: Date.now(),
            error: error.message
        };
    }
}