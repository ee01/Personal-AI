/**
 * 智能网页分析集成器
 * 统一管理和协调所有智能分析组件
 */

import { WebIntelligenceAnalyzer, PageContent, WebAnalysisResult } from './WebIntelligenceAnalyzer';
import { ChromeBuiltInAIAnalyzer, ChromeAIAnalysisResult } from './ChromeBuiltInAI';
import { WebWorkerAnalyzer } from './WebWorkerAnalyzer';
import { AnalysisCacheManager, BatchAnalysisManager } from './AnalysisCacheManager';

interface IntegratorConfig {
    enableChromeAI: boolean;
    enableWebWorker: boolean;
    enableCaching: boolean;
    enableBatchProcessing: boolean;
    analysisStrategy: 'fast' | 'balanced' | 'thorough';
    fallbackChain: string[];
}

interface AnalysisRequest {
    pageContent: PageContent;
    priority: 'low' | 'medium' | 'high';
    analysisType: 'quick' | 'deep' | 'comprehensive';
    context?: any;
}

interface IntegratedAnalysisResult extends WebAnalysisResult {
    processingChain: string[];
    processingTime: number;
    cacheHit: boolean;
    analysisMethod: string;
    performance: {
        chromeAITime?: number;
        workerTime?: number;
        totalTime: number;
        memoryUsage?: number;
    };
}

interface SystemStats {
    totalAnalyses: number;
    cacheHitRate: number;
    averageProcessingTime: number;
    chromeAIAvailable: boolean;
    workerAvailable: boolean;
    activeComponents: string[];
    errorCount: number;
    lastError?: string;
}

export class WebIntelligenceIntegrator {
    private mainAnalyzer: WebIntelligenceAnalyzer;
    private chromeAI: ChromeBuiltInAIAnalyzer | null = null;
    private workerAnalyzer: WebWorkerAnalyzer | null = null;
    private cacheManager: AnalysisCacheManager | null = null;
    private batchManager: BatchAnalysisManager | null = null;
    
    private config: IntegratorConfig;
    private isInitialized = false;
    private stats: SystemStats;
    private errorLog: Array<{ timestamp: number; error: string; component: string }> = [];

    constructor(config: Partial<IntegratorConfig> = {}) {
        this.config = {
            enableChromeAI: true,
            enableWebWorker: true,
            enableCaching: true,
            enableBatchProcessing: true,
            analysisStrategy: 'balanced',
            fallbackChain: ['chromeAI', 'worker', 'main'],
            ...config
        };

        this.stats = {
            totalAnalyses: 0,
            cacheHitRate: 0,
            averageProcessingTime: 0,
            chromeAIAvailable: false,
            workerAvailable: false,
            activeComponents: [],
            errorCount: 0
        };

        this.initialize();
    }

    /**
     * 初始化集成器
     */
    private async initialize(): Promise<void> {
        try {
            console.log('🚀 初始化智能网页分析集成器...');

            // 初始化主分析器
            await this.initializeMainAnalyzer();

            // 初始化可选组件
            if (this.config.enableChromeAI) {
                await this.initializeChromeAI();
            }

            if (this.config.enableWebWorker) {
                await this.initializeWebWorker();
            }

            if (this.config.enableCaching) {
                this.initializeCacheManager();
            }

            if (this.config.enableBatchProcessing) {
                this.initializeBatchManager();
            }

            this.updateActiveComponents();
            this.isInitialized = true;

            console.log('✅ 智能网页分析集成器初始化完成', {
                strategy: this.config.analysisStrategy,
                activeComponents: this.stats.activeComponents
            });

        } catch (error) {
            console.error('❌ 集成器初始化失败:', error);
            this.recordError('integrator', error.message);
            throw error;
        }
    }

    /**
     * 初始化主分析器
     */
    private async initializeMainAnalyzer(): Promise<void> {
        try {
            // 获取分析上下文
            const context = await this.loadAnalysisContext();
            this.mainAnalyzer = new WebIntelligenceAnalyzer();
            
            if (context) {
                this.mainAnalyzer.updateContext(context);
            }

            console.log('🧠 主分析器初始化完成');
        } catch (error) {
            console.error('主分析器初始化失败:', error);
            throw error;
        }
    }

    /**
     * 初始化Chrome AI
     */
    private async initializeChromeAI(): Promise<void> {
        try {
            this.chromeAI = new ChromeBuiltInAIAnalyzer();
            
            // 等待初始化完成
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            this.stats.chromeAIAvailable = this.chromeAI.isAvailable();
            
            if (this.stats.chromeAIAvailable) {
                console.log('🧠 Chrome AI初始化成功');
            } else {
                console.log('⚠️ Chrome AI不可用，将使用备选方案');
            }
        } catch (error) {
            console.warn('Chrome AI初始化失败:', error);
            this.recordError('chromeAI', error.message);
            this.chromeAI = null;
        }
    }

    /**
     * 初始化Web Worker
     */
    private async initializeWebWorker(): Promise<void> {
        try {
            this.workerAnalyzer = new WebWorkerAnalyzer();
            
            // 健康检查
            const isHealthy = await this.workerAnalyzer.healthCheck();
            this.stats.workerAvailable = isHealthy;
            
            if (isHealthy) {
                console.log('⚡ Web Worker分析器初始化成功');
            } else {
                console.log('⚠️ Web Worker不可用');
                this.workerAnalyzer = null;
            }
        } catch (error) {
            console.warn('Web Worker初始化失败:', error);
            this.recordError('worker', error.message);
            this.workerAnalyzer = null;
        }
    }

    /**
     * 初始化缓存管理器
     */
    private initializeCacheManager(): void {
        try {
            this.cacheManager = new AnalysisCacheManager({
                maxEntries: 500,
                maxSize: 25 * 1024 * 1024, // 25MB
                ttl: 12 * 60 * 60 * 1000, // 12小时
                evictionPolicy: 'lru',
                compressionEnabled: true
            });

            console.log('📋 缓存管理器初始化完成');
        } catch (error) {
            console.warn('缓存管理器初始化失败:', error);
            this.recordError('cache', error.message);
            this.cacheManager = null;
        }
    }

    /**
     * 初始化批量处理管理器
     */
    private initializeBatchManager(): void {
        try {
            this.batchManager = new BatchAnalysisManager(this, this.cacheManager);
            console.log('📦 批量处理管理器初始化完成');
        } catch (error) {
            console.warn('批量处理管理器初始化失败:', error);
            this.recordError('batch', error.message);
            this.batchManager = null;
        }
    }

    /**
     * 加载分析上下文
     */
    private async loadAnalysisContext(): Promise<any> {
        try {
            const result = await chrome.storage.local.get([
                'userProjects', 'userKeywords', 'recentTopics', 'organizationContext'
            ]);

            return {
                userProjects: result.userProjects || [],
                userKeywords: result.userKeywords || [],
                recentTopics: result.recentTopics || [],
                organizationContext: result.organizationContext || []
            };
        } catch (error) {
            console.warn('加载分析上下文失败:', error);
            return null;
        }
    }

    /**
     * 执行智能分析
     */
    async analyzeWebPage(request: AnalysisRequest): Promise<IntegratedAnalysisResult> {
        if (!this.isInitialized) {
            throw new Error('集成器未初始化');
        }

        const startTime = Date.now();
        const processingChain: string[] = [];
        let result: WebAnalysisResult | null = null;
        let cacheHit = false;
        let analysisMethod = 'unknown';

        try {
            this.stats.totalAnalyses++;

            // 1. 检查缓存
            if (this.cacheManager) {
                const cached = this.cacheManager.get(request.pageContent, request.analysisType);
                if (cached) {
                    cacheHit = true;
                    result = cached;
                    processingChain.push('cache');
                    analysisMethod = 'cache';
                }
            }

            // 2. 如果没有缓存，执行分析
            if (!result) {
                result = await this.performAnalysis(request, processingChain);
                analysisMethod = processingChain[processingChain.length - 1] || 'fallback';

                // 存储到缓存
                if (this.cacheManager && result) {
                    this.cacheManager.set(request.pageContent, result, request.analysisType);
                }
            }

            const totalTime = Date.now() - startTime;
            this.updateStats(totalTime, cacheHit);

            return {
                ...result,
                processingChain,
                processingTime: totalTime,
                cacheHit,
                analysisMethod,
                performance: {
                    totalTime,
                    memoryUsage: this.estimateMemoryUsage()
                }
            };

        } catch (error) {
            console.error('智能分析失败:', error);
            this.recordError('analysis', error.message);
            throw error;
        }
    }

    /**
     * 执行实际分析
     */
    private async performAnalysis(
        request: AnalysisRequest,
        processingChain: string[]
    ): Promise<WebAnalysisResult> {
        const { pageContent, priority, analysisType, context } = request;

        // 根据策略选择分析方法
        switch (this.config.analysisStrategy) {
            case 'fast':
                return this.performFastAnalysis(pageContent, processingChain, context);
            
            case 'balanced':
                return this.performBalancedAnalysis(pageContent, priority, analysisType, processingChain, context);
            
            case 'thorough':
                return this.performThoroughAnalysis(pageContent, processingChain, context);
            
            default:
                return this.performBalancedAnalysis(pageContent, priority, analysisType, processingChain, context);
        }
    }

    /**
     * 快速分析策略
     */
    private async performFastAnalysis(
        pageContent: PageContent,
        processingChain: string[],
        context?: any
    ): Promise<WebAnalysisResult> {
        // 优先使用Web Worker进行快速分析
        if (this.workerAnalyzer) {
            try {
                const workerResult = await this.workerAnalyzer.analyzeInWorker(pageContent, 'quick', context);
                if (workerResult.success && workerResult.result) {
                    processingChain.push('worker');
                    return workerResult.result;
                }
            } catch (error) {
                console.warn('Worker快速分析失败，回退到主分析器:', error);
            }
        }

        // 回退到主分析器
        processingChain.push('main');
        return this.mainAnalyzer.analyzeWebPage(pageContent);
    }

    /**
     * 平衡分析策略
     */
    private async performBalancedAnalysis(
        pageContent: PageContent,
        priority: string,
        analysisType: string,
        processingChain: string[],
        context?: any
    ): Promise<WebAnalysisResult> {
        // 高优先级或深度分析时使用Chrome AI
        if ((priority === 'high' || analysisType === 'deep') && this.stats.chromeAIAvailable && this.chromeAI) {
            try {
                const chromeAIResult = await this.chromeAI.analyzeWithChromeAI(
                    pageContent.mainContent,
                    pageContent.title,
                    pageContent.url
                );
                
                if (chromeAIResult.success) {
                    processingChain.push('chromeAI');
                    return this.convertChromeAIResult(chromeAIResult);
                }
            } catch (error) {
                console.warn('Chrome AI分析失败，尝试其他方法:', error);
            }
        }

        // 中等优先级使用Web Worker
        if (this.workerAnalyzer && priority !== 'low') {
            try {
                const workerResult = await this.workerAnalyzer.analyzeInWorker(
                    pageContent, 
                    analysisType === 'deep' ? 'deep' : 'quick', 
                    context
                );
                
                if (workerResult.success && workerResult.result) {
                    processingChain.push('worker');
                    return workerResult.result;
                }
            } catch (error) {
                console.warn('Worker分析失败，回退到主分析器:', error);
            }
        }

        // 最后回退到主分析器
        processingChain.push('main');
        return this.mainAnalyzer.analyzeWebPage(pageContent);
    }

    /**
     * 全面分析策略
     */
    private async performThoroughAnalysis(
        pageContent: PageContent,
        processingChain: string[],
        context?: any
    ): Promise<WebAnalysisResult> {
        const results: Array<{ source: string; result: WebAnalysisResult }> = [];

        // 1. Chrome AI分析
        if (this.stats.chromeAIAvailable && this.chromeAI) {
            try {
                const chromeAIResult = await this.chromeAI.analyzeWithChromeAI(
                    pageContent.mainContent,
                    pageContent.title,
                    pageContent.url
                );
                
                if (chromeAIResult.success) {
                    results.push({
                        source: 'chromeAI',
                        result: this.convertChromeAIResult(chromeAIResult)
                    });
                }
            } catch (error) {
                console.warn('Chrome AI全面分析失败:', error);
            }
        }

        // 2. Web Worker深度分析
        if (this.workerAnalyzer) {
            try {
                const workerResult = await this.workerAnalyzer.analyzeInWorker(pageContent, 'deep', context);
                if (workerResult.success && workerResult.result) {
                    results.push({
                        source: 'worker',
                        result: workerResult.result
                    });
                }
            } catch (error) {
                console.warn('Worker全面分析失败:', error);
            }
        }

        // 3. 主分析器分析
        try {
            const mainResult = await this.mainAnalyzer.analyzeWebPage(pageContent);
            results.push({
                source: 'main',
                result: mainResult
            });
        } catch (error) {
            console.warn('主分析器全面分析失败:', error);
        }

        // 4. 合并结果
        if (results.length === 0) {
            throw new Error('所有分析方法都失败了');
        }

        processingChain.push(...results.map(r => r.source));
        return this.mergeAnalysisResults(results.map(r => r.result));
    }

    /**
     * 转换Chrome AI结果
     */
    private convertChromeAIResult(chromeAIResult: ChromeAIAnalysisResult): WebAnalysisResult {
        return {
            isRelevant: chromeAIResult.shouldStore,
            confidence: chromeAIResult.relevance,
            extractedInfo: chromeAIResult.entities || {},
            suggestedStorage: chromeAIResult.shouldStore,
            relevantContent: '',
            reasoning: chromeAIResult.reasoning,
            categories: []
        };
    }

    /**
     * 合并多个分析结果
     */
    private mergeAnalysisResults(results: WebAnalysisResult[]): WebAnalysisResult {
        if (results.length === 1) {
            return results[0];
        }

        // 取最高置信度的结果作为基础
        const bestResult = results.reduce((prev, current) => 
            current.confidence > prev.confidence ? current : prev
        );

        // 合并其他信息
        const mergedExtractedInfo: any = {};
        const allCategories = new Set<string>();
        const allReasons = [];

        for (const result of results) {
            // 合并提取的信息
            Object.keys(result.extractedInfo).forEach(key => {
                if (result.extractedInfo[key]) {
                    if (!mergedExtractedInfo[key]) {
                        mergedExtractedInfo[key] = [];
                    }
                    mergedExtractedInfo[key].push(...result.extractedInfo[key]);
                }
            });

            // 合并分类
            result.categories.forEach(cat => allCategories.add(cat));
            
            // 合并推理
            if (result.reasoning) {
                allReasons.push(result.reasoning);
            }
        }

        // 去重
        Object.keys(mergedExtractedInfo).forEach(key => {
            mergedExtractedInfo[key] = [...new Set(mergedExtractedInfo[key])];
        });

        return {
            ...bestResult,
            extractedInfo: mergedExtractedInfo,
            categories: Array.from(allCategories),
            reasoning: allReasons.join('; ')
        };
    }

    /**
     * 批量分析
     */
    async batchAnalyze(pageContents: PageContent[]): Promise<IntegratedAnalysisResult[]> {
        if (!this.batchManager) {
            // 如果没有批量管理器，逐个分析
            const results = [];
            for (const pageContent of pageContents) {
                try {
                    const result = await this.analyzeWebPage({
                        pageContent,
                        priority: 'low',
                        analysisType: 'quick'
                    });
                    results.push(result);
                } catch (error) {
                    console.error(`批量分析失败 ${pageContent.url}:`, error);
                }
            }
            return results;
        }

        // 使用批量管理器
        this.batchManager.addToBatch(pageContents);
        
        // 等待批量处理完成（这里简化处理）
        return [];
    }

    /**
     * 优先级分析
     */
    async priorityAnalyze(pageContents: PageContent[]): Promise<IntegratedAnalysisResult[]> {
        const results = [];
        
        for (const pageContent of pageContents) {
            try {
                const result = await this.analyzeWebPage({
                    pageContent,
                    priority: 'high',
                    analysisType: 'deep'
                });
                results.push(result);
            } catch (error) {
                console.error(`优先级分析失败 ${pageContent.url}:`, error);
            }
        }
        
        return results;
    }

    /**
     * 更新统计信息
     */
    private updateStats(processingTime: number, _cacheHit: boolean): void {
        // 更新平均处理时间
        const totalTime = this.stats.averageProcessingTime * (this.stats.totalAnalyses - 1) + processingTime;
        this.stats.averageProcessingTime = totalTime / this.stats.totalAnalyses;

        // 更新缓存命中率
        if (this.cacheManager) {
            const cacheStats = this.cacheManager.getStats();
            this.stats.cacheHitRate = cacheStats.hitRate;
        }
    }

    /**
     * 更新活跃组件
     */
    private updateActiveComponents(): void {
        this.stats.activeComponents = ['main'];
        
        if (this.stats.chromeAIAvailable) {
            this.stats.activeComponents.push('chromeAI');
        }
        
        if (this.stats.workerAvailable) {
            this.stats.activeComponents.push('worker');
        }
        
        if (this.cacheManager) {
            this.stats.activeComponents.push('cache');
        }
        
        if (this.batchManager) {
            this.stats.activeComponents.push('batch');
        }
    }

    /**
     * 记录错误
     */
    private recordError(component: string, error: string): void {
        this.stats.errorCount++;
        this.stats.lastError = error;
        
        this.errorLog.push({
            timestamp: Date.now(),
            error,
            component
        });

        // 限制错误日志大小
        if (this.errorLog.length > 100) {
            this.errorLog.splice(0, 50);
        }
    }

    /**
     * 估算内存使用
     */
    private estimateMemoryUsage(): number {
        try {
            if ('memory' in performance) {
                return (performance as any).memory.usedJSHeapSize;
            }
        } catch (error) {
            // 忽略错误
        }
        return 0;
    }

    /**
     * 获取系统统计
     */
    getSystemStats(): SystemStats {
        return { ...this.stats };
    }

    /**
     * 获取组件状态
     */
    getComponentStatus() {
        return {
            mainAnalyzer: { status: 'active', stats: this.mainAnalyzer?.getAnalysisStats?.() },
            chromeAI: { 
                status: this.stats.chromeAIAvailable ? 'active' : 'inactive',
                stats: this.chromeAI?.getUsageStats?.() 
            },
            workerAnalyzer: { 
                status: this.stats.workerAvailable ? 'active' : 'inactive',
                stats: this.workerAnalyzer?.getStats?.() 
            },
            cacheManager: { 
                status: this.cacheManager ? 'active' : 'inactive',
                stats: this.cacheManager?.getStats?.() 
            },
            batchManager: { 
                status: this.batchManager ? 'active' : 'inactive',
                stats: this.batchManager?.getStats?.() 
            }
        };
    }

    /**
     * 健康检查
     */
    async healthCheck(): Promise<{ healthy: boolean; issues: string[] }> {
        const issues = [];

        // 检查主分析器
        if (!this.mainAnalyzer) {
            issues.push('主分析器不可用');
        }

        // 检查Chrome AI
        if (this.config.enableChromeAI && !this.stats.chromeAIAvailable) {
            issues.push('Chrome AI不可用');
        }

        // 检查Web Worker
        if (this.config.enableWebWorker && !this.stats.workerAvailable) {
            try {
                if (this.workerAnalyzer) {
                    const isHealthy = await this.workerAnalyzer.healthCheck();
                    if (!isHealthy) {
                        issues.push('Web Worker健康检查失败');
                    }
                }
            } catch (error) {
                issues.push('Web Worker健康检查异常');
            }
        }

        // 检查错误率
        if (this.stats.errorCount > 10) {
            issues.push('错误率过高');
        }

        return {
            healthy: issues.length === 0,
            issues
        };
    }

    /**
     * 更新配置
     */
    updateConfig(newConfig: Partial<IntegratorConfig>): void {
        this.config = { ...this.config, ...newConfig };
        console.log('📋 集成器配置已更新:', this.config);
    }

    /**
     * 重启组件
     */
    async restartComponent(component: string): Promise<boolean> {
        try {
            switch (component) {
                case 'chromeAI':
                    if (this.chromeAI) {
                        this.chromeAI.destroy();
                    }
                    await this.initializeChromeAI();
                    break;
                
                case 'worker':
                    if (this.workerAnalyzer) {
                        this.workerAnalyzer.destroy();
                    }
                    await this.initializeWebWorker();
                    break;
                
                default:
                    console.warn('未知组件:', component);
                    return false;
            }
            
            this.updateActiveComponents();
            console.log(`✅ 组件 ${component} 重启成功`);
            return true;
            
        } catch (error) {
            console.error(`❌ 组件 ${component} 重启失败:`, error);
            this.recordError(component, `重启失败: ${error.message}`);
            return false;
        }
    }

    /**
     * 清理资源
     */
    destroy(): void {
        console.log('🔄 清理智能网页分析集成器...');

        if (this.mainAnalyzer) {
            this.mainAnalyzer.destroy();
        }

        if (this.chromeAI) {
            this.chromeAI.destroy();
        }

        if (this.workerAnalyzer) {
            this.workerAnalyzer.destroy();
        }

        if (this.cacheManager) {
            this.cacheManager.clear();
        }

        if (this.batchManager) {
            this.batchManager.clearQueue();
        }

        this.isInitialized = false;
        console.log('✅ 智能网页分析集成器已清理');
    }
}

// 单例实例
let integratorInstance: WebIntelligenceIntegrator | null = null;

/**
 * 获取集成器实例
 */
export function getWebIntelligenceIntegrator(config?: Partial<IntegratorConfig>): WebIntelligenceIntegrator {
    if (!integratorInstance) {
        integratorInstance = new WebIntelligenceIntegrator(config);
    }
    return integratorInstance;
}

/**
 * 销毁集成器实例
 */
export function destroyWebIntelligenceIntegrator(): void {
    if (integratorInstance) {
        integratorInstance.destroy();
        integratorInstance = null;
    }
}

// 导出类型
export type { 
    IntegratorConfig, 
    AnalysisRequest, 
    IntegratedAnalysisResult, 
    SystemStats 
};