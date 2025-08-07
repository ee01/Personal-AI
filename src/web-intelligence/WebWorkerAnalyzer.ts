/**
 * Web Worker增强分析器
 * 在Web Worker中执行复杂的文本分析任务，避免阻塞主线程
 */

import { PageContent, WebAnalysisResult } from './WebIntelligenceAnalyzer';

interface WorkerAnalysisTask {
    id: string;
    pageContent: PageContent;
    analysisType: 'quick' | 'deep' | 'batch';
    context?: any;
    priority: 'low' | 'medium' | 'high';
}

interface WorkerAnalysisResult {
    id: string;
    success: boolean;
    result?: WebAnalysisResult;
    error?: string;
    processingTime: number;
}

interface WorkerStats {
    tasksCompleted: number;
    averageProcessingTime: number;
    errorCount: number;
    queueSize: number;
    isActive: boolean;
}

export class WebWorkerAnalyzer {
    private worker: Worker | null = null;
    private taskQueue: WorkerAnalysisTask[] = [];
    private pendingTasks: Map<string, {
        resolve: (result: WorkerAnalysisResult) => void;
        reject: (error: Error) => void;
        timeout: number;
    }> = new Map();
    
    private readonly WORKER_TIMEOUT = 10000; // 10秒超时
    private readonly MAX_QUEUE_SIZE = 50;
    
    private stats: WorkerStats = {
        tasksCompleted: 0,
        averageProcessingTime: 0,
        errorCount: 0,
        queueSize: 0,
        isActive: false
    };

    constructor() {
        this.initializeWorker();
    }

    /**
     * 初始化Web Worker
     */
    private initializeWorker(): void {
        try {
            // 创建Worker代码
            const workerCode = this.generateWorkerCode();
            const blob = new Blob([workerCode], { type: 'application/javascript' });
            this.worker = new Worker(URL.createObjectURL(blob));

            // 设置消息处理器
            this.worker.onmessage = (event) => {
                this.handleWorkerMessage(event.data);
            };

            // 设置错误处理器
            this.worker.onerror = (error) => {
                console.error('Web Worker错误:', error);
                this.stats.errorCount++;
            };

            this.stats.isActive = true;
            console.log('✅ Web Worker分析器初始化成功');

        } catch (error) {
            console.error('❌ Web Worker初始化失败:', error);
            this.stats.isActive = false;
        }
    }

    /**
     * 生成Worker代码
     */
    private generateWorkerCode(): string {
        return `
            // Web Worker中的分析逻辑
            class WorkerTextAnalyzer {
                constructor() {
                    this.initializeNLP();
                }

                // 初始化自然语言处理工具
                initializeNLP() {
                    // 常见停用词
                    this.stopWords = new Set([
                        'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
                        '的', '了', '是', '在', '有', '和', '就', '不', '人', '都', '一', '一个', '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好', '自己', '这'
                    ]);

                    // 技术关键词映射
                    this.techKeywords = {
                        'frontend': ['react', 'vue', 'angular', 'javascript', 'typescript', 'html', 'css', 'scss', 'webpack', 'vite'],
                        'backend': ['node.js', 'python', 'java', 'c#', 'php', 'ruby', 'go', 'rust', 'spring', 'django', 'express'],
                        'database': ['mysql', 'postgresql', 'mongodb', 'redis', 'elasticsearch', 'oracle', 'sqlite'],
                        'devops': ['docker', 'kubernetes', 'jenkins', 'gitlab', 'github', 'aws', 'azure', 'gcp', 'terraform'],
                        'mobile': ['ios', 'android', 'react native', 'flutter', 'swift', 'kotlin', 'xamarin'],
                        'ai_ml': ['tensorflow', 'pytorch', 'opencv', 'nlp', 'machine learning', 'deep learning', 'neural network']
                    };

                    // 项目管理关键词
                    this.projectKeywords = [
                        'sprint', 'scrum', 'agile', 'kanban', 'milestone', 'roadmap', 'backlog',
                        'epic', 'story', 'task', 'bug', 'feature', 'release', 'deployment',
                        '冲刺', '敏捷', '看板', '里程碑', '路线图', '待办事项', '史诗', '用户故事', '任务', '缺陷', '功能', '发布', '部署'
                    ];

                    // 紧急程度关键词
                    this.urgencyKeywords = {
                        'critical': ['critical', 'urgent', 'emergency', 'asap', 'immediately', '紧急', '立即', '马上', '火急'],
                        'high': ['high priority', 'important', 'soon', 'quickly', '重要', '尽快', '优先', '高优先级'],
                        'medium': ['normal', 'medium', 'regular', '正常', '中等', '一般'],
                        'low': ['low priority', 'later', 'when possible', '低优先级', '稍后', '有时间']
                    };
                }

                // 主要分析函数
                analyze(pageContent, analysisType, context) {
                    const startTime = Date.now();
                    
                    try {
                        let result;
                        
                        switch(analysisType) {
                            case 'quick':
                                result = this.quickAnalysis(pageContent, context);
                                break;
                            case 'deep':
                                result = this.deepAnalysis(pageContent, context);
                                break;
                            case 'batch':
                                result = this.batchAnalysis(pageContent, context);
                                break;
                            default:
                                throw new Error('Unknown analysis type: ' + analysisType);
                        }

                        return {
                            success: true,
                            result: {
                                ...result,
                                processingTime: Date.now() - startTime
                            }
                        };

                    } catch (error) {
                        return {
                            success: false,
                            error: error.message,
                            processingTime: Date.now() - startTime
                        };
                    }
                }

                // 快速分析
                quickAnalysis(pageContent, context) {
                    const content = (pageContent.title + ' ' + pageContent.mainContent).toLowerCase();
                    const words = this.tokenize(content);
                    const cleanWords = this.removeStopWords(words);

                    return {
                        isRelevant: this.assessRelevance(content, context),
                        confidence: this.calculateConfidence(content, context),
                        extractedInfo: this.extractBasicInfo(content),
                        suggestedStorage: this.shouldStore(content, context),
                        relevantContent: this.extractRelevantSnippets(content, 3),
                        reasoning: this.generateReasoning(content, context),
                        categories: this.categorizeContent(content),
                        wordCount: cleanWords.length,
                        topKeywords: this.getTopKeywords(cleanWords, 10),
                        sentiment: this.analyzeSentiment(content),
                        complexity: this.assessComplexity(content)
                    };
                }

                // 深度分析
                deepAnalysis(pageContent, context) {
                    const quickResult = this.quickAnalysis(pageContent, context);
                    const content = pageContent.mainContent;

                    // 扩展分析
                    const advancedInfo = {
                        namedEntities: this.extractNamedEntities(content),
                        technicalTerms: this.extractTechnicalTerms(content),
                        projectStructure: this.analyzeProjectStructure(content),
                        timelineAnalysis: this.extractTimeline(content),
                        dependencyAnalysis: this.analyzeDependencies(content),
                        riskFactors: this.identifyRisks(content)
                    };

                    return {
                        ...quickResult,
                        summary: this.generateSummary(content, quickResult),
                        keyInsights: this.generateInsights(content, quickResult),
                        relationships: this.extractRelationships(content),
                        actionableItems: this.extractActionItems(content),
                        relevantMemories: [], // 将由主线程处理
                        advancedInfo
                    };
                }

                // 批量分析
                batchAnalysis(pageContents, context) {
                    const results = [];
                    
                    for (const pageContent of pageContents) {
                        try {
                            const result = this.quickAnalysis(pageContent, context);
                            results.push({
                                url: pageContent.url,
                                success: true,
                                result
                            });
                        } catch (error) {
                            results.push({
                                url: pageContent.url,
                                success: false,
                                error: error.message
                            });
                        }
                    }

                    return {
                        batchResults: results,
                        summary: this.generateBatchSummary(results)
                    };
                }

                // 分词
                tokenize(text) {
                    return text.match(/\\b\\w+\\b/g) || [];
                }

                // 移除停用词
                removeStopWords(words) {
                    return words.filter(word => !this.stopWords.has(word.toLowerCase()));
                }

                // 评估相关性
                assessRelevance(content, context) {
                    let score = 0;
                    
                    // 检查用户项目
                    if (context?.userProjects) {
                        for (const project of context.userProjects) {
                            if (content.includes(project.toLowerCase())) {
                                score += 0.3;
                                break;
                            }
                        }
                    }

                    // 检查技术关键词
                    for (const category in this.techKeywords) {
                        for (const keyword of this.techKeywords[category]) {
                            if (content.includes(keyword)) {
                                score += 0.1;
                                break;
                            }
                        }
                    }

                    // 检查项目管理关键词
                    for (const keyword of this.projectKeywords) {
                        if (content.includes(keyword)) {
                            score += 0.15;
                            break;
                        }
                    }

                    return score > 0.3;
                }

                // 计算置信度
                calculateConfidence(content, context) {
                    let confidence = 0;
                    const factors = [];

                    // URL模式匹配
                    if (context?.url) {
                        const url = context.url.toLowerCase();
                        if (/github|gitlab|jira|confluence|notion|slack/i.test(url)) {
                            confidence += 0.3;
                            factors.push('platform_match');
                        }
                    }

                    // 内容长度
                    const wordCount = content.split(/\\s+/).length;
                    if (wordCount > 100 && wordCount < 5000) {
                        confidence += 0.1;
                        factors.push('appropriate_length');
                    }

                    // 结构化内容
                    if (/\\n\\s*[-*]|\\d+\\.|#{1,6}\\s/.test(content)) {
                        confidence += 0.1;
                        factors.push('structured_content');
                    }

                    // 技术内容
                    const techScore = this.calculateTechScore(content);
                    confidence += Math.min(techScore, 0.3);
                    if (techScore > 0) factors.push('technical_content');

                    // 项目相关内容
                    const projectScore = this.calculateProjectScore(content);
                    confidence += Math.min(projectScore, 0.2);
                    if (projectScore > 0) factors.push('project_content');

                    return Math.min(confidence, 1);
                }

                // 计算技术得分
                calculateTechScore(content) {
                    let score = 0;
                    for (const category in this.techKeywords) {
                        for (const keyword of this.techKeywords[category]) {
                            if (content.includes(keyword)) {
                                score += 0.05;
                            }
                        }
                    }
                    return score;
                }

                // 计算项目得分
                calculateProjectScore(content) {
                    let score = 0;
                    for (const keyword of this.projectKeywords) {
                        if (content.includes(keyword)) {
                            score += 0.03;
                        }
                    }
                    return score;
                }

                // 提取基础信息
                extractBasicInfo(content) {
                    const info = {};

                    // 提取项目名称
                    const projectPatterns = [
                        /项目[：:]?\\s*([^\\s,，。]{2,20})/g,
                        /project[:\\s]+([a-zA-Z0-9\\s-]{2,30})/gi
                    ];
                    
                    const projects = new Set();
                    for (const pattern of projectPatterns) {
                        let match;
                        while ((match = pattern.exec(content)) !== null) {
                            if (match[1] && match[1].trim().length > 1) {
                                projects.add(match[1].trim());
                            }
                        }
                    }
                    if (projects.size > 0) info.projects = Array.from(projects);

                    // 提取人员
                    const peoplePatterns = [
                        /@([a-zA-Z0-9\\u4e00-\\u9fa5]{2,20})/g,
                        /负责人[：:]?\\s*([^\\s,，。]{2,10})/g
                    ];
                    
                    const people = new Set();
                    for (const pattern of peoplePatterns) {
                        let match;
                        while ((match = pattern.exec(content)) !== null) {
                            if (match[1] && match[1].trim().length > 1) {
                                people.add(match[1].trim());
                            }
                        }
                    }
                    if (people.size > 0) info.people = Array.from(people);

                    // 提取技术栈
                    const technologies = new Set();
                    for (const category in this.techKeywords) {
                        for (const keyword of this.techKeywords[category]) {
                            if (content.includes(keyword)) {
                                technologies.add(keyword);
                            }
                        }
                    }
                    if (technologies.size > 0) info.technologies = Array.from(technologies);

                    return info;
                }

                // 判断是否应该存储
                shouldStore(content, context) {
                    const relevance = this.assessRelevance(content, context);
                    const confidence = this.calculateConfidence(content, context);
                    const hasActionableContent = this.hasActionableContent(content);
                    
                    return relevance && confidence > 0.5 || hasActionableContent;
                }

                // 检查是否有可执行内容
                hasActionableContent(content) {
                    const actionPatterns = [
                        /todo|action|task|deadline|due/i,
                        /需要|要求|必须|应该|建议/,
                        /待办|任务|截止|截至/
                    ];
                    
                    return actionPatterns.some(pattern => pattern.test(content));
                }

                // 提取相关片段
                extractRelevantSnippets(content, maxSnippets) {
                    const sentences = content.split(/[。！？.!?]/).filter(s => s.trim().length > 10);
                    const scoredSentences = sentences.map(sentence => ({
                        sentence: sentence.trim(),
                        score: this.scoreSentence(sentence)
                    }));
                    
                    scoredSentences.sort((a, b) => b.score - a.score);
                    return scoredSentences
                        .slice(0, maxSnippets)
                        .map(item => item.sentence)
                        .join(' ... ');
                }

                // 句子评分
                scoreSentence(sentence) {
                    let score = 0;
                    
                    // 长度评分
                    if (sentence.length > 20 && sentence.length < 200) {
                        score += 0.3;
                    }
                    
                    // 关键词评分
                    for (const keyword of this.projectKeywords) {
                        if (sentence.toLowerCase().includes(keyword)) {
                            score += 0.2;
                        }
                    }
                    
                    // 技术词汇评分
                    for (const category in this.techKeywords) {
                        for (const keyword of this.techKeywords[category]) {
                            if (sentence.toLowerCase().includes(keyword)) {
                                score += 0.1;
                                break;
                            }
                        }
                    }
                    
                    return score;
                }

                // 生成推理
                generateReasoning(content, context) {
                    const reasons = [];
                    
                    if (context?.userProjects) {
                        for (const project of context.userProjects) {
                            if (content.includes(project.toLowerCase())) {
                                reasons.push(\`匹配用户项目: \${project}\`);
                            }
                        }
                    }
                    
                    const techCount = this.calculateTechScore(content) / 0.05;
                    if (techCount > 0) {
                        reasons.push(\`包含 \${Math.floor(techCount)} 个技术关键词\`);
                    }
                    
                    const projectCount = this.calculateProjectScore(content) / 0.03;
                    if (projectCount > 0) {
                        reasons.push(\`包含 \${Math.floor(projectCount)} 个项目管理关键词\`);
                    }
                    
                    return reasons.length > 0 ? reasons.join('; ') : '基于内容特征分析';
                }

                // 内容分类
                categorizeContent(content) {
                    const categories = [];
                    
                    // 技术类别
                    for (const category in this.techKeywords) {
                        for (const keyword of this.techKeywords[category]) {
                            if (content.includes(keyword)) {
                                categories.push(category);
                                break;
                            }
                        }
                    }
                    
                    // 项目管理
                    if (this.projectKeywords.some(keyword => content.includes(keyword))) {
                        categories.push('project_management');
                    }
                    
                    // 文档类型
                    if (/specification|requirements|design|architecture/i.test(content)) {
                        categories.push('documentation');
                    }
                    
                    if (/bug|issue|problem|error/i.test(content)) {
                        categories.push('issue_tracking');
                    }
                    
                    return categories.length > 0 ? categories : ['general'];
                }

                // 获取顶级关键词
                getTopKeywords(words, count) {
                    const frequency = {};
                    words.forEach(word => {
                        frequency[word] = (frequency[word] || 0) + 1;
                    });
                    
                    return Object.entries(frequency)
                        .sort(([,a], [,b]) => b - a)
                        .slice(0, count)
                        .map(([word, freq]) => ({ word, frequency: freq }));
                }

                // 情感分析
                analyzeSentiment(content) {
                    const positiveWords = ['good', 'great', 'excellent', 'perfect', 'success', '好', '优秀', '成功', '完美'];
                    const negativeWords = ['bad', 'terrible', 'fail', 'error', 'problem', '坏', '错误', '失败', '问题'];
                    
                    let positiveScore = 0;
                    let negativeScore = 0;
                    
                    positiveWords.forEach(word => {
                        positiveScore += (content.match(new RegExp(word, 'gi')) || []).length;
                    });
                    
                    negativeWords.forEach(word => {
                        negativeScore += (content.match(new RegExp(word, 'gi')) || []).length;
                    });
                    
                    if (positiveScore > negativeScore) return 'positive';
                    if (negativeScore > positiveScore) return 'negative';
                    return 'neutral';
                }

                // 复杂度评估
                assessComplexity(content) {
                    const sentences = content.split(/[。！？.!?]/).length;
                    const words = content.split(/\\s+/).length;
                    const avgWordsPerSentence = words / sentences;
                    
                    if (avgWordsPerSentence > 25) return 'high';
                    if (avgWordsPerSentence > 15) return 'medium';
                    return 'low';
                }

                // 生成摘要
                generateSummary(content, quickResult) {
                    const { extractedInfo } = quickResult;
                    const parts = [];
                    
                    if (extractedInfo.projects) {
                        parts.push(\`项目: \${extractedInfo.projects.join(', ')}\`);
                    }
                    
                    if (extractedInfo.people) {
                        parts.push(\`人员: \${extractedInfo.people.join(', ')}\`);
                    }
                    
                    if (extractedInfo.technologies) {
                        parts.push(\`技术: \${extractedInfo.technologies.slice(0, 3).join(', ')}\`);
                    }
                    
                    return parts.length > 0 ? parts.join('; ') : '项目相关内容摘要';
                }

                // 生成洞察
                generateInsights(content, quickResult) {
                    const insights = [];
                    
                    if (quickResult.extractedInfo.technologies?.length > 5) {
                        insights.push('涉及多种技术栈，可能是复杂项目');
                    }
                    
                    if (quickResult.extractedInfo.people?.length > 3) {
                        insights.push('涉及多名团队成员，团队协作项目');
                    }
                    
                    if (content.includes('deadline') || content.includes('截止')) {
                        insights.push('包含时间敏感信息');
                    }
                    
                    return insights.length > 0 ? insights : ['发现项目相关内容'];
                }

                // 提取关系
                extractRelationships(content) {
                    // 简化的关系提取
                    return [];
                }

                // 提取行动项
                extractActionItems(content) {
                    const actionPatterns = [
                        /todo[:\\s]*([^\\n]{10,100})/gi,
                        /action[:\\s]*([^\\n]{10,100})/gi,
                        /需要[：:]?([^。！？]{10,100})/g
                    ];
                    
                    const items = [];
                    for (const pattern of actionPatterns) {
                        let match;
                        while ((match = pattern.exec(content)) !== null) {
                            if (match[1]) {
                                items.push({
                                    type: 'task',
                                    content: match[1].trim(),
                                    priority: this.assessPriority(match[1])
                                });
                            }
                        }
                    }
                    
                    return items;
                }

                // 评估优先级
                assessPriority(text) {
                    for (const [level, keywords] of Object.entries(this.urgencyKeywords)) {
                        if (keywords.some(keyword => text.toLowerCase().includes(keyword))) {
                            return level === 'critical' ? 'high' : level;
                        }
                    }
                    return 'medium';
                }

                // 批量摘要
                generateBatchSummary(results) {
                    const successful = results.filter(r => r.success);
                    const failed = results.filter(r => !r.success);
                    
                    return {
                        total: results.length,
                        successful: successful.length,
                        failed: failed.length,
                        averageConfidence: successful.length > 0 ? 
                            successful.reduce((sum, r) => sum + (r.result?.confidence || 0), 0) / successful.length : 0
                    };
                }
            }

            // Worker实例
            const analyzer = new WorkerTextAnalyzer();

            // 消息处理
            self.onmessage = function(e) {
                const { id, pageContent, analysisType, context } = e.data;
                
                try {
                    const result = analyzer.analyze(pageContent, analysisType, context);
                    self.postMessage({
                        id,
                        ...result
                    });
                } catch (error) {
                    self.postMessage({
                        id,
                        success: false,
                        error: error.message,
                        processingTime: 0
                    });
                }
            };
        `;
    }

    /**
     * 处理Worker消息
     */
    private handleWorkerMessage(data: WorkerAnalysisResult): void {
        const pending = this.pendingTasks.get(data.id);
        if (pending) {
            clearTimeout(pending.timeout);
            this.pendingTasks.delete(data.id);
            
            // 更新统计
            this.stats.tasksCompleted++;
            const totalTime = this.stats.averageProcessingTime * (this.stats.tasksCompleted - 1) + data.processingTime;
            this.stats.averageProcessingTime = totalTime / this.stats.tasksCompleted;
            
            if (data.success) {
                pending.resolve(data);
            } else {
                this.stats.errorCount++;
                pending.reject(new Error(data.error || 'Worker analysis failed'));
            }
        }
    }

    /**
     * 执行分析任务
     */
    async analyzeInWorker(
        pageContent: PageContent,
        analysisType: 'quick' | 'deep' | 'batch' = 'quick',
        context?: any
    ): Promise<WorkerAnalysisResult> {
        if (!this.worker || !this.stats.isActive) {
            throw new Error('Web Worker不可用');
        }

        // 检查队列大小
        if (this.taskQueue.length >= this.MAX_QUEUE_SIZE) {
            throw new Error('Worker任务队列已满');
        }

        const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        return new Promise((resolve, reject) => {
            // 设置超时
            const timeout = setTimeout(() => {
                this.pendingTasks.delete(taskId);
                this.stats.errorCount++;
                reject(new Error('Worker任务超时'));
            }, this.WORKER_TIMEOUT);

            // 保存待处理任务
            this.pendingTasks.set(taskId, { resolve, reject, timeout });

            // 发送任务到Worker
            this.worker!.postMessage({
                id: taskId,
                pageContent,
                analysisType,
                context
            });

            // 更新队列统计
            this.stats.queueSize = this.pendingTasks.size;
        });
    }

    /**
     * 批量分析
     */
    async batchAnalyze(pageContents: PageContent[], context?: any): Promise<WorkerAnalysisResult[]> {
        const batchSize = 10; // 每批处理10个
        const results: WorkerAnalysisResult[] = [];
        
        for (let i = 0; i < pageContents.length; i += batchSize) {
            const batch = pageContents.slice(i, i + batchSize);
            
            const batchPromises = batch.map(pageContent => 
                this.analyzeInWorker(pageContent, 'quick', context)
                    .catch(error => ({
                        id: `batch_error_${i}`,
                        success: false,
                        error: error.message,
                        processingTime: 0
                    } as WorkerAnalysisResult))
            );
            
            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);
            
            // 批次间短暂暂停，避免过载
            if (i + batchSize < pageContents.length) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }
        
        return results;
    }

    /**
     * 优先级分析
     */
    async analyzeWithPriority(
        pageContent: PageContent,
        priority: 'low' | 'medium' | 'high' = 'medium',
        context?: any
    ): Promise<WorkerAnalysisResult> {
        // 高优先级任务使用深度分析
        const analysisType = priority === 'high' ? 'deep' : 'quick';
        return this.analyzeInWorker(pageContent, analysisType, context);
    }

    /**
     * 获取Worker统计信息
     */
    getStats(): WorkerStats {
        return {
            ...this.stats,
            queueSize: this.pendingTasks.size
        };
    }

    /**
     * 清空队列
     */
    clearQueue(): void {
        // 清理所有待处理任务
        this.pendingTasks.forEach(({ reject, timeout }) => {
            clearTimeout(timeout);
            reject(new Error('队列已清空'));
        });
        
        this.pendingTasks.clear();
        this.taskQueue = [];
        this.stats.queueSize = 0;
        
        console.log('🗑️ Worker任务队列已清空');
    }

    /**
     * 检查Worker健康状态
     */
    async healthCheck(): Promise<boolean> {
        if (!this.worker || !this.stats.isActive) {
            return false;
        }

        try {
            // 发送测试任务
            const testPageContent: PageContent = {
                title: 'Test Page',
                url: 'http://test.com',
                domain: 'test.com',
                mainContent: 'This is a test page for React project development.',
                metadata: {},
                pageType: 'test',
                timestamp: Date.now(),
                wordCount: 10,
                language: 'en'
            };

            const result = await this.analyzeInWorker(testPageContent, 'quick');
            return result.success;
            
        } catch (error) {
            console.error('Worker健康检查失败:', error);
            return false;
        }
    }

    /**
     * 重启Worker
     */
    restart(): void {
        console.log('🔄 重启Web Worker...');
        
        this.destroy();
        setTimeout(() => {
            this.initializeWorker();
        }, 100);
    }

    /**
     * 清理资源
     */
    destroy(): void {
        // 清空队列
        this.clearQueue();
        
        // 终止Worker
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
        
        this.stats.isActive = false;
        console.log('🔄 Web Worker分析器已清理');
    }
}

// 导出类型定义
export type { WorkerAnalysisTask, WorkerAnalysisResult, WorkerStats };