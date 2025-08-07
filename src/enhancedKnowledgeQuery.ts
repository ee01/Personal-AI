/**
 * 增强知识查询处理器
 * 处理来自增强查询界面的请求，协调向量搜索和图查询
 */

import { knowledgeQuery } from './llm';
import { getMessageProcessingEnhancer } from './storage/MessageProcessingEnhancer';
import { getEnvConfig } from './utils';

export interface EnhancedQueryOptions {
    searchTargets: ('vector' | 'graph')[];
    entityTypes: string[];
    relationshipTypes: string[];
    timeRange: { start: number; end: number } | null;
    includeNeighbors: boolean;
    maxDepth: number;
    limit: number;
}

export interface EnhancedQueryResponse {
    success: boolean;
    query: string;
    options: EnhancedQueryOptions;
    data: {
        vectorResults?: any[];
        entityResults?: any[];
        relationshipResults?: any[];
        graphConnections: number;
        totalResults: number;
    };
    queryTime: number;
    analysis?: string;
    error?: string;
}

/**
 * 执行增强的知识查询
 */
export async function executeEnhancedKnowledgeQuery(
    query: string,
    options: EnhancedQueryOptions
): Promise<EnhancedQueryResponse> {
    const startTime = Date.now();
    const response: EnhancedQueryResponse = {
        success: false,
        query,
        options,
        data: {
            vectorResults: [],
            entityResults: [],
            relationshipResults: [],
            graphConnections: 0,
            totalResults: 0
        },
        queryTime: 0
    };

    try {
        console.log('🔍 开始执行增强知识查询:', { query, options });

        const searchPromises: Promise<any>[] = [];

        // 1. 向量搜索（原有的语义搜索）
        if (options.searchTargets.includes('vector')) {
            console.log('📄 执行向量搜索...');
            searchPromises.push(
                executeVectorSearch(query, options).then(results => ({
                    type: 'vector',
                    results
                }))
            );
        }

        // 2. 图搜索（实体和关系查询）
        if (options.searchTargets.includes('graph')) {
            console.log('🕸️ 执行图搜索...');
            searchPromises.push(
                executeGraphSearch(query, options).then(results => ({
                    type: 'graph',
                    results
                }))
            );
        }

        // 3. 并行执行所有搜索
        const searchResults = await Promise.allSettled(searchPromises);

        // 4. 处理搜索结果
        for (const promiseResult of searchResults) {
            if (promiseResult.status === 'fulfilled') {
                const { type, results } = promiseResult.value;
                
                if (type === 'vector') {
                    response.data.vectorResults = results.results || [];
                    response.analysis = results.analysis;
                } else if (type === 'graph') {
                    response.data.entityResults = results.entities || [];
                    response.data.relationshipResults = results.relationships || [];
                    response.data.graphConnections = results.totalConnections || 0;
                }
            } else {
                console.error(`${promiseResult.reason?.type || '未知'}搜索失败:`, promiseResult.reason);
            }
        }

        // 5. 计算总结果数
        response.data.totalResults = 
            (response.data.vectorResults?.length || 0) +
            (response.data.entityResults?.length || 0) +
            (response.data.relationshipResults?.length || 0);

        response.success = true;
        response.queryTime = Date.now() - startTime;

        console.log('✅ 增强知识查询完成:', {
            向量结果: response.data.vectorResults?.length || 0,
            实体结果: response.data.entityResults?.length || 0,
            关系结果: response.data.relationshipResults?.length || 0,
            图连接: response.data.graphConnections,
            总用时: `${response.queryTime}ms`
        });

        return response;

    } catch (error) {
        console.error('❌ 增强知识查询失败:', error);
        response.error = error.message;
        response.queryTime = Date.now() - startTime;
        return response;
    }
}

/**
 * 执行向量搜索
 */
async function executeVectorSearch(
    query: string,
    options: EnhancedQueryOptions
): Promise<{ results: any[]; analysis?: string }> {
    try {
        // 使用现有的 knowledgeQuery 函数
        const vectorResponse = await knowledgeQuery(query);
        
        if (vectorResponse && vectorResponse.results) {
            // 应用时间范围过滤
            let filteredResults = vectorResponse.results;
            
            if (options.timeRange) {
                filteredResults = filteredResults.filter((result: any) => {
                    const resultTime = new Date(result.timestamp).getTime();
                    return resultTime >= options.timeRange!.start && 
                           resultTime <= options.timeRange!.end;
                });
            }
            
            // 限制结果数量
            if (options.limit > 0) {
                filteredResults = filteredResults.slice(0, options.limit);
            }
            
            return {
                results: filteredResults,
                analysis: vectorResponse.analysis
            };
        }
        
        return { results: [] };

    } catch (error) {
        console.error('向量搜索失败:', error);
        throw { type: 'vector', message: error.message };
    }
}

/**
 * 执行图搜索
 */
async function executeGraphSearch(
    query: string,
    options: EnhancedQueryOptions
): Promise<{
    entities: any[];
    relationships: any[];
    totalConnections: number;
}> {
    try {
        const enhancer = await getMessageProcessingEnhancer();
        
        // 构建图查询选项
        const graphQueryOptions = {
            textQuery: query,
            includeNeighbors: options.includeNeighbors,
            maxDepth: options.maxDepth,
            limit: options.limit
        };
        
        // 如果指定了实体类型，分别查询
        if (options.entityTypes.length > 0) {
            const entityPromises = options.entityTypes.map(entityType =>
                enhancer.queryGraphData({
                    ...graphQueryOptions,
                    entityType
                })
            );
            
            const entityResults = await Promise.all(entityPromises);
            
            // 合并结果
            const allEntities: any[] = [];
            const allRelationships: any[] = [];
            let totalConnections = 0;
            
            entityResults.forEach(result => {
                allEntities.push(...result.entities);
                allRelationships.push(...result.relationships);
                
                result.neighbors?.forEach(neighbor => {
                    totalConnections += neighbor.neighbors.relationships?.length || 0;
                });
            });
            
            return {
                entities: removeDuplicates(allEntities, 'id'),
                relationships: removeDuplicates(allRelationships, 'id'),
                totalConnections
            };
        }
        
        // 如果指定了关系类型，查询特定关系
        if (options.relationshipTypes.length > 0) {
            const relationshipPromises = options.relationshipTypes.map(relType =>
                enhancer.queryGraphData({
                    ...graphQueryOptions,
                    relationshipType: relType
                })
            );
            
            const relationshipResults = await Promise.all(relationshipPromises);
            
            const allEntities: any[] = [];
            const allRelationships: any[] = [];
            let totalConnections = 0;
            
            relationshipResults.forEach(result => {
                allEntities.push(...result.entities);
                allRelationships.push(...result.relationships);
                totalConnections += result.relationships.length;
            });
            
            return {
                entities: removeDuplicates(allEntities, 'id'),
                relationships: removeDuplicates(allRelationships, 'id'),
                totalConnections
            };
        }
        
        // 默认的通用图搜索
        const graphResult = await enhancer.queryGraphData(graphQueryOptions);
        
        // 计算连接数
        let totalConnections = graphResult.relationships.length;
        graphResult.neighbors?.forEach(neighbor => {
            totalConnections += neighbor.neighbors.relationships?.length || 0;
        });
        
        return {
            entities: graphResult.entities,
            relationships: graphResult.relationships,
            totalConnections
        };

    } catch (error) {
        console.error('图搜索失败:', error);
        throw { type: 'graph', message: error.message };
    }
}

/**
 * 去除重复项
 */
function removeDuplicates<T>(array: T[], keyField: keyof T): T[] {
    const seen = new Set();
    return array.filter(item => {
        const key = item[keyField];
        if (seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });
}

/**
 * 获取图存储统计信息
 */
export async function getGraphStatistics(): Promise<{
    success: boolean;
    statistics?: any;
    error?: string;
}> {
    try {
        const enhancer = await getMessageProcessingEnhancer();
        const statistics = enhancer.getGraphStatistics();
        
        return {
            success: true,
            statistics
        };

    } catch (error) {
        console.error('获取图统计失败:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * 执行图数据同步
 */
export async function syncGraphData(): Promise<{
    success: boolean;
    syncStatus?: any;
    error?: string;
}> {
    try {
        console.log('🔄 开始图数据同步...');
        
        const enhancer = await getMessageProcessingEnhancer();
        const syncResult = await enhancer.syncGraphData();
        
        if (syncResult.synced) {
            console.log('✅ 图数据同步完成');
            return {
                success: true,
                syncStatus: syncResult.syncStatus
            };
        } else {
            console.warn('⚠️ 图数据同步失败:', syncResult.error);
            return {
                success: false,
                error: syncResult.error
            };
        }

    } catch (error) {
        console.error('❌ 图数据同步失败:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * 执行图数据备份
 */
export async function backupGraphData(): Promise<{
    success: boolean;
    backupTime?: number;
    error?: string;
}> {
    try {
        console.log('☁️ 开始图数据备份...');
        
        const enhancer = await getMessageProcessingEnhancer();
        const backupResult = await enhancer.backupGraphData();
        
        if (backupResult.backed) {
            console.log('✅ 图数据备份完成');
            return {
                success: true,
                backupTime: backupResult.backupTime
            };
        } else {
            console.warn('⚠️ 图数据备份失败:', backupResult.error);
            return {
                success: false,
                error: backupResult.error
            };
        }

    } catch (error) {
        console.error('❌ 图数据备份失败:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * 智能查询意图分析
 */
export async function analyzeQueryIntent(query: string): Promise<{
    intent: 'entity_search' | 'relationship_search' | 'semantic_search' | 'mixed_search';
    entities: {
        people: string[];
        projects: string[];
        topics: string[];
        organizations: string[];
    };
    relationships: string[];
    timeExpressions: string[];
    confidence: number;
}> {
    // 简单的意图分析，可以后续集成更复杂的NLP
    const analysis = {
        intent: 'semantic_search' as const,
        entities: {
            people: [] as string[],
            projects: [] as string[],
            topics: [] as string[],
            organizations: [] as string[]
        },
        relationships: [] as string[],
        timeExpressions: [] as string[],
        confidence: 0.5
    };

    const queryLower = query.toLowerCase();

    // 检测关系查询关键词
    const relationshipKeywords = [
        '关系', '连接', '协作', '依赖', '参与', '负责', '属于',
        'works on', 'assigned to', 'collaborates with', 'depends on'
    ];
    
    if (relationshipKeywords.some(keyword => queryLower.includes(keyword))) {
        analysis.intent = 'relationship_search';
        analysis.confidence = 0.8;
    }

    // 检测实体查询关键词
    const entityKeywords = [
        '谁', '什么', '哪个', '哪些', '人员', '项目', '团队', '组织',
        'who', 'what', 'which', 'person', 'project', 'team', 'organization'
    ];
    
    if (entityKeywords.some(keyword => queryLower.includes(keyword))) {
        analysis.intent = analysis.intent === 'relationship_search' ? 'mixed_search' : 'entity_search';
        analysis.confidence = Math.max(analysis.confidence, 0.7);
    }

    // 简单的实体提取（基于常见模式）
    const namePattern = /([A-Z][a-z]+ [A-Z][a-z]+|[\u4e00-\u9fff]{2,4})/g;
    const names = query.match(namePattern);
    if (names) {
        analysis.entities.people = names;
    }

    // 项目名称模式
    const projectPattern = /(项目|Project|project)\s*[：:]?\s*([^\s,，。.]{2,20})/g;
    const projectMatches = [...query.matchAll(projectPattern)];
    if (projectMatches.length > 0) {
        analysis.entities.projects = projectMatches.map(match => match[2]);
    }

    // 时间表达式
    const timePattern = /(昨天|今天|明天|上周|本周|下周|上月|本月|下月|\d+天前|\d+周前|\d+月前)/g;
    const timeMatches = query.match(timePattern);
    if (timeMatches) {
        analysis.timeExpressions = timeMatches;
    }

    return analysis;
}

export default {
    executeEnhancedKnowledgeQuery,
    getGraphStatistics,
    syncGraphData,
    backupGraphData,
    analyzeQueryIntent
};