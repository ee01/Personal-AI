/**
 * 分析缓存管理器
 * 提供智能缓存机制，优化分析性能
 */

import { PageContent, WebAnalysisResult } from './WebIntelligenceAnalyzer';

interface CacheEntry {
    result: WebAnalysisResult;
    timestamp: number;
    accessCount: number;
    lastAccessed: number;
    size: number; // 字节大小
    tags: string[]; // 用于分类和快速查找
}

interface CacheStats {
    totalEntries: number;
    totalSize: number; // 字节
    hitRate: number;
    missRate: number;
    evictionCount: number;
    oldestEntry: number;
    newestEntry: number;
}

interface CacheConfig {
    maxEntries: number;
    maxSize: number; // 字节
    ttl: number; // 生存时间(毫秒)
    evictionPolicy: 'lru' | 'lfu' | 'ttl' | 'size';
    compressionEnabled: boolean;
}

export class AnalysisCacheManager {
    private cache = new Map<string, CacheEntry>();
    private accessOrder: string[] = []; // LRU追踪
    private config: CacheConfig;
    private stats = {
        hits: 0,
        misses: 0,
        evictions: 0,
        compressions: 0
    };

    constructor(config: Partial<CacheConfig> = {}) {
        this.config = {
            maxEntries: 1000,
            maxSize: 50 * 1024 * 1024, // 50MB
            ttl: 24 * 60 * 60 * 1000, // 24小时
            evictionPolicy: 'lru',
            compressionEnabled: true,
            ...config
        };

        console.log('📋 分析缓存管理器初始化完成', this.config);
    }

    /**
     * 生成缓存键
     */
    private generateCacheKey(pageContent: PageContent, analysisType?: string): string {
        const urlHash = this.simpleHash(pageContent.url);
        const contentHash = this.simpleHash(pageContent.mainContent.substring(0, 500));
        const typePrefix = analysisType ? `${analysisType}_` : '';
        return `${typePrefix}${urlHash}_${contentHash}`;
    }

    /**
     * 简单哈希函数
     */
    private simpleHash(str: string): string {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // 转换为32位整数
        }
        return Math.abs(hash).toString(36);
    }

    /**
     * 计算对象大小（粗略估算）
     */
    private calculateSize(obj: any): number {
        return JSON.stringify(obj).length * 2; // 粗略估算Unicode字符大小
    }

    /**
     * 压缩数据
     */
    private compressData(data: WebAnalysisResult): WebAnalysisResult {
        if (!this.config.compressionEnabled) return data;

        try {
            // 简化压缩：移除不必要的字段，截断长字符串
            const compressed = { ...data };
            
            // 截断长文本
            if (compressed.relevantContent && compressed.relevantContent.length > 500) {
                compressed.relevantContent = compressed.relevantContent.substring(0, 500) + '...';
            }
            
            if (compressed.reasoning && compressed.reasoning.length > 200) {
                compressed.reasoning = compressed.reasoning.substring(0, 200) + '...';
            }

            // 限制数组大小
            if (compressed.extractedInfo?.actionItems && compressed.extractedInfo.actionItems.length > 10) {
                compressed.extractedInfo.actionItems = compressed.extractedInfo.actionItems.slice(0, 10);
            }

            this.stats.compressions++;
            return compressed;
        } catch (error) {
            console.warn('数据压缩失败:', error);
            return data;
        }
    }

    /**
     * 生成标签
     */
    private generateTags(pageContent: PageContent, result: WebAnalysisResult): string[] {
        const tags = [];
        
        // 域名标签
        tags.push(`domain:${pageContent.domain}`);
        
        // 页面类型标签
        tags.push(`type:${pageContent.pageType}`);
        
        // 语言标签
        tags.push(`lang:${pageContent.language}`);
        
        // 相关性标签
        if (result.confidence > 0.8) tags.push('high_confidence');
        else if (result.confidence > 0.5) tags.push('medium_confidence');
        else tags.push('low_confidence');
        
        // 存储建议标签
        if (result.suggestedStorage) tags.push('suggested_storage');
        
        // 内容分类标签
        result.categories.forEach(category => tags.push(`category:${category}`));
        
        // 项目标签
        if (result.extractedInfo.projects) {
            result.extractedInfo.projects.forEach(project => 
                tags.push(`project:${project.toLowerCase()}`)
            );
        }
        
        // 技术栈标签
        if (result.extractedInfo.technologies) {
            result.extractedInfo.technologies.forEach(tech => 
                tags.push(`tech:${tech.toLowerCase()}`)
            );
        }

        return tags;
    }

    /**
     * 缓存分析结果
     */
    set(pageContent: PageContent, result: WebAnalysisResult, analysisType?: string): void {
        const key = this.generateCacheKey(pageContent, analysisType);
        const compressedResult = this.compressData(result);
        const size = this.calculateSize(compressedResult);
        const tags = this.generateTags(pageContent, result);
        
        const entry: CacheEntry = {
            result: compressedResult,
            timestamp: Date.now(),
            accessCount: 1,
            lastAccessed: Date.now(),
            size,
            tags
        };

        // 检查是否需要清理空间
        this.ensureSpace(size);
        
        // 添加到缓存
        this.cache.set(key, entry);
        this.updateAccessOrder(key);
        
        console.log(`📋 缓存分析结果: ${key} (${this.formatSize(size)})`);
    }

    /**
     * 获取缓存结果
     */
    get(pageContent: PageContent, analysisType?: string): WebAnalysisResult | null {
        const key = this.generateCacheKey(pageContent, analysisType);
        const entry = this.cache.get(key);
        
        if (!entry) {
            this.stats.misses++;
            return null;
        }

        // 检查TTL
        if (Date.now() - entry.timestamp > this.config.ttl) {
            this.cache.delete(key);
            this.removeFromAccessOrder(key);
            this.stats.misses++;
            return null;
        }

        // 更新访问信息
        entry.accessCount++;
        entry.lastAccessed = Date.now();
        this.updateAccessOrder(key);
        
        this.stats.hits++;
        console.log(`📋 缓存命中: ${key}`);
        
        return entry.result;
    }

    /**
     * 确保有足够空间
     */
    private ensureSpace(requiredSize: number): void {
        while (this.shouldEvict(requiredSize)) {
            this.evictOne();
        }
    }

    /**
     * 判断是否需要清理
     */
    private shouldEvict(requiredSize: number): boolean {
        const currentSize = this.getCurrentSize();
        const currentEntries = this.cache.size;
        
        return (
            currentEntries >= this.config.maxEntries ||
            currentSize + requiredSize > this.config.maxSize
        );
    }

    /**
     * 清理一个条目
     */
    private evictOne(): void {
        if (this.cache.size === 0) return;

        let keyToEvict: string;

        switch (this.config.evictionPolicy) {
            case 'lru':
                keyToEvict = this.accessOrder[0];
                break;
            case 'lfu':
                keyToEvict = this.findLFUKey();
                break;
            case 'ttl':
                keyToEvict = this.findOldestKey();
                break;
            case 'size':
                keyToEvict = this.findLargestKey();
                break;
            default:
                keyToEvict = this.accessOrder[0];
        }

        if (keyToEvict) {
            this.cache.delete(keyToEvict);
            this.removeFromAccessOrder(keyToEvict);
            this.stats.evictions++;
            console.log(`📋 清理缓存条目: ${keyToEvict}`);
        }
    }

    /**
     * 查找最少使用的键
     */
    private findLFUKey(): string {
        let minAccessCount = Infinity;
        let lfuKey = '';
        
        for (const [key, entry] of this.cache) {
            if (entry.accessCount < minAccessCount) {
                minAccessCount = entry.accessCount;
                lfuKey = key;
            }
        }
        
        return lfuKey;
    }

    /**
     * 查找最旧的键
     */
    private findOldestKey(): string {
        let oldestTime = Infinity;
        let oldestKey = '';
        
        for (const [key, entry] of this.cache) {
            if (entry.timestamp < oldestTime) {
                oldestTime = entry.timestamp;
                oldestKey = key;
            }
        }
        
        return oldestKey;
    }

    /**
     * 查找最大的键
     */
    private findLargestKey(): string {
        let maxSize = 0;
        let largestKey = '';
        
        for (const [key, entry] of this.cache) {
            if (entry.size > maxSize) {
                maxSize = entry.size;
                largestKey = key;
            }
        }
        
        return largestKey;
    }

    /**
     * 更新访问顺序
     */
    private updateAccessOrder(key: string): void {
        this.removeFromAccessOrder(key);
        this.accessOrder.push(key);
    }

    /**
     * 从访问顺序中移除
     */
    private removeFromAccessOrder(key: string): void {
        const index = this.accessOrder.indexOf(key);
        if (index > -1) {
            this.accessOrder.splice(index, 1);
        }
    }

    /**
     * 获取当前缓存大小
     */
    private getCurrentSize(): number {
        let totalSize = 0;
        for (const entry of this.cache.values()) {
            totalSize += entry.size;
        }
        return totalSize;
    }

    /**
     * 格式化大小显示
     */
    private formatSize(bytes: number): string {
        if (bytes < 1024) return `${bytes}B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
    }

    /**
     * 按标签查找
     */
    findByTags(tags: string[]): WebAnalysisResult[] {
        const results = [];
        
        for (const [key, entry] of this.cache) {
            const hasAllTags = tags.every(tag => entry.tags.includes(tag));
            if (hasAllTags) {
                results.push(entry.result);
            }
        }
        
        return results;
    }

    /**
     * 按域名查找
     */
    findByDomain(domain: string): WebAnalysisResult[] {
        return this.findByTags([`domain:${domain}`]);
    }

    /**
     * 按项目查找
     */
    findByProject(project: string): WebAnalysisResult[] {
        return this.findByTags([`project:${project.toLowerCase()}`]);
    }

    /**
     * 获取高置信度结果
     */
    getHighConfidenceResults(): WebAnalysisResult[] {
        return this.findByTags(['high_confidence']);
    }

    /**
     * 获取建议存储的结果
     */
    getSuggestedStorageResults(): WebAnalysisResult[] {
        return this.findByTags(['suggested_storage']);
    }

    /**
     * 预热缓存
     */
    async warmUp(pageContents: PageContent[]): Promise<void> {
        console.log(`🔥 开始预热缓存，共 ${pageContents.length} 个页面`);
        
        // 这里应该调用实际的分析器进行预热
        // 现在只是模拟
        for (const pageContent of pageContents.slice(0, 10)) { // 限制预热数量
            const mockResult: WebAnalysisResult = {
                isRelevant: true,
                confidence: 0.8,
                extractedInfo: {},
                suggestedStorage: true,
                relevantContent: pageContent.mainContent.substring(0, 200),
                reasoning: '预热缓存模拟结果',
                categories: ['warmup']
            };
            
            this.set(pageContent, mockResult, 'warmup');
        }
        
        console.log('🔥 缓存预热完成');
    }

    /**
     * 获取缓存统计
     */
    getStats(): CacheStats {
        const entries = Array.from(this.cache.values());
        const totalRequests = this.stats.hits + this.stats.misses;
        
        return {
            totalEntries: this.cache.size,
            totalSize: this.getCurrentSize(),
            hitRate: totalRequests > 0 ? this.stats.hits / totalRequests : 0,
            missRate: totalRequests > 0 ? this.stats.misses / totalRequests : 0,
            evictionCount: this.stats.evictions,
            oldestEntry: entries.length > 0 ? Math.min(...entries.map(e => e.timestamp)) : 0,
            newestEntry: entries.length > 0 ? Math.max(...entries.map(e => e.timestamp)) : 0
        };
    }

    /**
     * 清理过期条目
     */
    cleanupExpired(): number {
        const now = Date.now();
        let cleanedCount = 0;
        
        for (const [key, entry] of this.cache) {
            if (now - entry.timestamp > this.config.ttl) {
                this.cache.delete(key);
                this.removeFromAccessOrder(key);
                cleanedCount++;
            }
        }
        
        if (cleanedCount > 0) {
            console.log(`🗑️ 清理了 ${cleanedCount} 个过期缓存条目`);
        }
        
        return cleanedCount;
    }

    /**
     * 清空缓存
     */
    clear(): void {
        this.cache.clear();
        this.accessOrder = [];
        
        // 重置统计
        this.stats = {
            hits: 0,
            misses: 0,
            evictions: 0,
            compressions: 0
        };
        
        console.log('🗑️ 缓存已清空');
    }

    /**
     * 导出缓存数据
     */
    export(): any {
        const data = {
            config: this.config,
            stats: this.stats,
            entries: Array.from(this.cache.entries()).map(([key, entry]) => ({
                key,
                ...entry
            })),
            accessOrder: this.accessOrder,
            timestamp: Date.now()
        };
        
        console.log(`📤 导出缓存数据: ${this.cache.size} 个条目`);
        return data;
    }

    /**
     * 导入缓存数据
     */
    import(data: any): boolean {
        try {
            if (!data || !data.entries) {
                throw new Error('无效的缓存数据');
            }

            this.clear();
            
            // 导入配置
            if (data.config) {
                this.config = { ...this.config, ...data.config };
            }
            
            // 导入条目
            for (const item of data.entries) {
                const { key, ...entry } = item;
                this.cache.set(key, entry);
            }
            
            // 导入访问顺序
            if (data.accessOrder) {
                this.accessOrder = [...data.accessOrder];
            }
            
            console.log(`📥 导入缓存数据: ${data.entries.length} 个条目`);
            return true;
            
        } catch (error) {
            console.error('导入缓存数据失败:', error);
            return false;
        }
    }

    /**
     * 设置配置
     */
    updateConfig(newConfig: Partial<CacheConfig>): void {
        this.config = { ...this.config, ...newConfig };
        console.log('📋 缓存配置已更新', this.config);
        
        // 如果缩小了限制，需要立即清理
        this.ensureSpace(0);
    }

    /**
     * 获取配置
     */
    getConfig(): CacheConfig {
        return { ...this.config };
    }
}

/**
 * 批量处理管理器
 * 优化大量页面的分析处理
 */
export class BatchAnalysisManager {
    private processingQueue: PageContent[] = [];
    private isProcessing = false;
    private readonly BATCH_SIZE = 10;
    private readonly BATCH_DELAY = 100; // 毫秒
    private readonly MAX_CONCURRENT = 3;
    
    private stats = {
        totalProcessed: 0,
        successCount: 0,
        errorCount: 0,
        averageProcessingTime: 0,
        batchesProcessed: 0
    };

    constructor(
        private analyzer: any, // 分析器实例
        private cacheManager?: AnalysisCacheManager
    ) {}

    /**
     * 添加到批量处理队列
     */
    addToBatch(pageContents: PageContent[]): void {
        this.processingQueue.push(...pageContents);
        console.log(`📦 添加 ${pageContents.length} 个页面到批量处理队列，当前队列长度: ${this.processingQueue.length}`);
        
        // 如果没有在处理，开始处理
        if (!this.isProcessing) {
            this.processBatch();
        }
    }

    /**
     * 处理批量队列
     */
    private async processBatch(): Promise<void> {
        if (this.isProcessing || this.processingQueue.length === 0) {
            return;
        }

        this.isProcessing = true;
        console.log(`🚀 开始批量处理，队列长度: ${this.processingQueue.length}`);

        try {
            while (this.processingQueue.length > 0) {
                // 取出一批数据
                const batch = this.processingQueue.splice(0, this.BATCH_SIZE);
                const batchStartTime = Date.now();
                
                console.log(`📦 处理批次: ${batch.length} 个页面`);
                
                // 并发处理批次
                const batchPromises = this.createBatchPromises(batch);
                const results = await Promise.allSettled(batchPromises);
                
                // 统计结果
                this.updateBatchStats(results, Date.now() - batchStartTime);
                
                // 批次间延迟
                if (this.processingQueue.length > 0) {
                    await new Promise(resolve => setTimeout(resolve, this.BATCH_DELAY));
                }
            }
            
        } catch (error) {
            console.error('批量处理失败:', error);
        } finally {
            this.isProcessing = false;
            console.log('✅ 批量处理完成');
        }
    }

    /**
     * 创建批次Promise
     */
    private createBatchPromises(batch: PageContent[]): Promise<any>[] {
        const promises = [];
        
        // 分组并发处理
        for (let i = 0; i < batch.length; i += this.MAX_CONCURRENT) {
            const concurrentGroup = batch.slice(i, i + this.MAX_CONCURRENT);
            
            const groupPromises = concurrentGroup.map(async (pageContent) => {
                try {
                    // 检查缓存
                    if (this.cacheManager) {
                        const cached = this.cacheManager.get(pageContent);
                        if (cached) {
                            return { pageContent, result: cached, fromCache: true };
                        }
                    }
                    
                    // 执行分析
                    const result = await this.analyzer.analyzeWebPage(pageContent);
                    
                    // 存储到缓存
                    if (this.cacheManager && result) {
                        this.cacheManager.set(pageContent, result);
                    }
                    
                    return { pageContent, result, fromCache: false };
                    
                } catch (error) {
                    console.error(`分析失败 ${pageContent.url}:`, error);
                    return { pageContent, error: error.message, fromCache: false };
                }
            });
            
            promises.push(...groupPromises);
        }
        
        return promises;
    }

    /**
     * 更新批次统计
     */
    private updateBatchStats(results: PromiseSettledResult<any>[], processingTime: number): void {
        this.stats.batchesProcessed++;
        
        const successful = results.filter(r => r.status === 'fulfilled' && !r.value.error);
        const failed = results.filter(r => r.status === 'rejected' || r.value?.error);
        
        this.stats.successCount += successful.length;
        this.stats.errorCount += failed.length;
        this.stats.totalProcessed += results.length;
        
        // 更新平均处理时间
        const totalTime = this.stats.averageProcessingTime * (this.stats.batchesProcessed - 1) + processingTime;
        this.stats.averageProcessingTime = totalTime / this.stats.batchesProcessed;
        
        console.log(`📊 批次统计: 成功 ${successful.length}, 失败 ${failed.length}, 用时 ${processingTime}ms`);
    }

    /**
     * 优先处理
     */
    async priorityProcess(pageContents: PageContent[]): Promise<WebAnalysisResult[]> {
        console.log(`⚡ 优先处理 ${pageContents.length} 个页面`);
        
        const results = [];
        for (const pageContent of pageContents) {
            try {
                // 检查缓存
                let result = this.cacheManager?.get(pageContent);
                
                if (!result) {
                    // 执行分析
                    result = await this.analyzer.analyzeWebPage(pageContent);
                    
                    // 存储到缓存
                    if (this.cacheManager && result) {
                        this.cacheManager.set(pageContent, result);
                    }
                }
                
                results.push(result);
                
            } catch (error) {
                console.error(`优先处理失败 ${pageContent.url}:`, error);
                results.push(null);
            }
        }
        
        return results.filter(r => r !== null) as WebAnalysisResult[];
    }

    /**
     * 获取处理统计
     */
    getStats() {
        return {
            ...this.stats,
            queueLength: this.processingQueue.length,
            isProcessing: this.isProcessing,
            successRate: this.stats.totalProcessed > 0 ? 
                this.stats.successCount / this.stats.totalProcessed : 0
        };
    }

    /**
     * 清空队列
     */
    clearQueue(): void {
        this.processingQueue = [];
        console.log('🗑️ 批量处理队列已清空');
    }

    /**
     * 暂停处理
     */
    pause(): void {
        this.isProcessing = false;
        console.log('⏸️ 批量处理已暂停');
    }

    /**
     * 恢复处理
     */
    resume(): void {
        if (!this.isProcessing && this.processingQueue.length > 0) {
            this.processBatch();
        }
    }
}

// 导出类型
export type { CacheEntry, CacheStats, CacheConfig };