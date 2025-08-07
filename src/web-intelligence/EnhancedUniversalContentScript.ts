/**
 * 增强版通用内容脚本
 * 在网页中静默运行，进行智能内容分析和处理
 */

interface ContentExtractionConfig {
    enableAutoAnalysis: boolean;
    analysisDelay: number;
    maxContentLength: number;
    includeImages: boolean;
    includeLinks: boolean;
    respectPrivacy: boolean;
    allowedDomains: string[];
    blockedDomains: string[];
    minWordCount: number;
    maxAnalysisFrequency: number;
}

interface PageAnalysisEvent {
    type: 'page_analyzed' | 'relevant_content_found' | 'analysis_error';
    data: any;
    timestamp: number;
}

interface PageContent {
    title: string;
    url: string;
    domain: string;
    mainContent: string;
    metadata: Record<string, any>;
    pageType: string;
    timestamp: number;
    wordCount: number;
    language: string;
}

interface WebAnalysisResult {
    isRelevant: boolean;
    confidence: number;
    extractedInfo: {
        projects?: string[];
        people?: string[];
        deadlines?: Date[];
        actionItems?: string[];
        topics?: string[];
        technologies?: string[];
        organizations?: string[];
    };
    suggestedStorage: boolean;
    relevantContent: string;
    reasoning: string;
    categories: string[];
}

export class EnhancedUniversalContentScript {
    private config: ContentExtractionConfig;
    private isAnalyzing = false;
    private analysisTimer: number | null = null;
    private lastAnalysisTime = 0;
    private analysisCount = 0;
    private readonly MIN_ANALYSIS_INTERVAL = 5000;
    private contentObserver: MutationObserver | null = null;
    private pageEvents: PageAnalysisEvent[] = [];

    constructor() {
        this.config = {
            enableAutoAnalysis: true,
            analysisDelay: 2000,
            maxContentLength: 50000,
            includeImages: false,
            includeLinks: true,
            respectPrivacy: true,
            allowedDomains: [],
            blockedDomains: ['google.com', 'facebook.com', 'twitter.com', 'youtube.com'],
            minWordCount: 100,
            maxAnalysisFrequency: 10
        };

        this.initialize();
    }

    /**
     * 初始化内容脚本
     */
    private async initialize(): Promise<void> {
        try {
            console.log('🎯 初始化增强版通用内容脚本...');
            
            await this.loadConfig();
            
            if (!this.shouldRunOnCurrentDomain()) {
                console.log('🚫 当前域名被排除，跳过智能分析');
                return;
            }

            if (!this.checkAnalysisRateLimit()) {
                console.log('⏰ 达到分析频率限制，暂时跳过');
                return;
            }

            this.setupEventListeners();
            
            if (this.config.enableAutoAnalysis) {
                this.scheduleAnalysis();
            }

            console.log('✅ 增强版通用内容脚本初始化完成');
            
        } catch (error) {
            console.error('❌ 内容脚本初始化失败:', error);
            this.recordEvent('analysis_error', { error: error.message });
        }
    }

    /**
     * 加载配置
     */
    private async loadConfig(): Promise<void> {
        try {
            const result = await chrome.storage.local.get('webIntelligenceConfig');
            if (result.webIntelligenceConfig) {
                this.config = { ...this.config, ...result.webIntelligenceConfig };
                console.log('📋 已加载配置:', this.config);
            }
        } catch (error) {
            console.warn('加载配置失败，使用默认配置:', error);
        }
    }

    /**
     * 检查是否应该在当前域名运行
     */
    private shouldRunOnCurrentDomain(): boolean {
        const currentDomain = window.location.hostname;
        const currentUrl = window.location.href;
        
        // 检查特殊协议
        if (currentUrl.startsWith('chrome://') || 
            currentUrl.startsWith('chrome-extension://') ||
            currentUrl.startsWith('moz-extension://') ||
            currentUrl.startsWith('file://')) {
            return false;
        }

        // 检查隐私设置
        if (this.config.respectPrivacy) {
            const sensitivePatterns = [
                /.*\.google\.com$/,
                /.*\.facebook\.com$/,
                /.*\.twitter\.com$/,
                /.*\.youtube\.com$/,
                /.*\.bank.*$/,
                /.*\.paypal\.com$/,
                /localhost/,
                /127\.0\.0\.1/,
                /192\.168\./
            ];
            
            if (sensitivePatterns.some(pattern => pattern.test(currentDomain))) {
                return false;
            }
        }

        // 检查阻止列表
        if (this.config.blockedDomains.some(domain => currentDomain.includes(domain))) {
            return false;
        }

        // 检查允许列表
        if (this.config.allowedDomains.length > 0) {
            return this.config.allowedDomains.some(domain => currentDomain.includes(domain));
        }

        return true;
    }

    /**
     * 检查分析频率限制
     */
    private checkAnalysisRateLimit(): boolean {
        const now = Date.now();
        const oneHour = 60 * 60 * 1000;
        
        const recentAnalyses = this.pageEvents.filter(event => 
            event.type === 'page_analyzed' && 
            now - event.timestamp < oneHour
        );

        return recentAnalyses.length < this.config.maxAnalysisFrequency;
    }

    /**
     * 设置事件监听器
     */
    private setupEventListeners(): void {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.scheduleAnalysis();
            });
        } else {
            this.scheduleAnalysis();
        }

        // 内容变化监听
        this.contentObserver = new MutationObserver((mutations) => {
            if (this.hasSignificantContentChanges(mutations)) {
                this.scheduleAnalysis();
            }
        });

        this.contentObserver.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: false,
            characterData: false
        });

        // 其他事件监听
        window.addEventListener('focus', () => this.scheduleAnalysis());
        window.addEventListener('hashchange', () => this.scheduleAnalysis());
        window.addEventListener('popstate', () => this.scheduleAnalysis());

        // 滚动事件
        let scrollTimeout: number;
        window.addEventListener('scroll', () => {
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                if (this.isNearBottomOfPage()) {
                    this.scheduleAnalysis();
                }
            }, 1000);
        });
    }

    /**
     * 检查是否有重要内容变化
     */
    private hasSignificantContentChanges(mutations: MutationRecord[]): boolean {
        let addedTextContent = 0;
        let addedElements = 0;

        mutations.forEach(mutation => {
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        const element = node as Element;
                        addedElements++;
                        addedTextContent += (element.textContent || '').length;
                    }
                });
            }
        });

        return addedTextContent > 200 || addedElements > 5;
    }

    /**
     * 检查是否接近页面底部
     */
    private isNearBottomOfPage(): boolean {
        const threshold = 1000;
        return window.innerHeight + window.scrollY >= document.body.offsetHeight - threshold;
    }

    /**
     * 调度分析
     */
    private scheduleAnalysis(): void {
        if (!this.checkAnalysisRateLimit()) {
            console.log('⏰ 达到分析频率限制');
            return;
        }

        const now = Date.now();
        if (now - this.lastAnalysisTime < this.MIN_ANALYSIS_INTERVAL) {
            return;
        }

        if (this.analysisTimer) {
            clearTimeout(this.analysisTimer);
        }

        this.analysisTimer = setTimeout(() => {
            this.performAnalysis();
        }, this.config.analysisDelay);
    }

    /**
     * 执行智能分析
     */
    private async performAnalysis(): Promise<void> {
        if (this.isAnalyzing) {
            return;
        }

        this.isAnalyzing = true;
        this.lastAnalysisTime = Date.now();
        this.analysisCount++;

        try {
            console.log(`🔍 开始智能网页分析 (#${this.analysisCount})...`);
            
            const pageContent = this.extractPageContent();
            
            if (!pageContent || pageContent.wordCount < this.config.minWordCount) {
                console.log(`📄 页面内容不足 (${pageContent?.wordCount || 0} 词)，跳过分析`);
                return;
            }

            // 执行快速本地分析
            const analysisResult = await this.performQuickAnalysis(pageContent);
            
            this.recordEvent('page_analyzed', {
                url: pageContent.url,
                title: pageContent.title,
                wordCount: pageContent.wordCount,
                confidence: analysisResult.confidence,
                isRelevant: analysisResult.isRelevant
            });
            
            await this.handleAnalysisResult(pageContent, analysisResult);
            
            console.log('✅ 智能分析完成', {
                confidence: analysisResult.confidence,
                isRelevant: analysisResult.isRelevant,
                categories: analysisResult.categories
            });
            
        } catch (error) {
            console.error('❌ 智能分析失败:', error);
            this.recordEvent('analysis_error', { 
                error: error.message,
                url: window.location.href 
            });
        } finally {
            this.isAnalyzing = false;
        }
    }

    /**
     * 执行快速分析
     */
    private async performQuickAnalysis(pageContent: PageContent): Promise<WebAnalysisResult> {
        const content = pageContent.mainContent.toLowerCase();
        let confidence = 0;
        const reasons = [];
        const extractedInfo: any = {};
        const categories = [];

        // URL模式分析
        const urlAnalysis = this.analyzeUrl(pageContent.url);
        confidence += urlAnalysis.score;
        reasons.push(...urlAnalysis.reasons);
        categories.push(...urlAnalysis.categories);

        // 内容关键词分析
        const keywordAnalysis = this.analyzeKeywords(content);
        confidence += keywordAnalysis.score;
        reasons.push(...keywordAnalysis.reasons);

        // 实体提取
        const entities = this.extractEntities(pageContent.mainContent);
        Object.assign(extractedInfo, entities);

        // 页面类型分析
        const typeAnalysis = this.analyzePageType(pageContent.pageType);
        confidence += typeAnalysis.score;
        categories.push(...typeAnalysis.categories);

        const finalConfidence = Math.min(confidence, 1);
        const isRelevant = finalConfidence > 0.3;
        const suggestedStorage = finalConfidence > 0.5;

        return {
            isRelevant,
            confidence: finalConfidence,
            extractedInfo,
            suggestedStorage,
            relevantContent: this.extractRelevantSnippets(pageContent.mainContent),
            reasoning: reasons.join('; ') || '基于内容特征分析',
            categories: [...new Set(categories)]
        };
    }

    /**
     * URL分析
     */
    private analyzeUrl(url: string): { score: number; reasons: string[]; categories: string[] } {
        const reasons = [];
        const categories = [];
        let score = 0;

        const patterns = [
            { pattern: /github\.com/i, score: 0.3, reason: 'GitHub平台', category: 'development' },
            { pattern: /jira.*\/browse\//i, score: 0.4, reason: 'Jira任务', category: 'project_management' },
            { pattern: /confluence/i, score: 0.3, reason: 'Confluence文档', category: 'documentation' },
            { pattern: /notion\.so/i, score: 0.3, reason: 'Notion页面', category: 'documentation' },
            { pattern: /slack\.com/i, score: 0.2, reason: 'Slack对话', category: 'communication' },
            { pattern: /figma\.com/i, score: 0.2, reason: 'Figma设计', category: 'design' },
            { pattern: /docs\.google\.com/i, score: 0.2, reason: 'Google文档', category: 'documentation' }
        ];

        for (const { pattern, score: patternScore, reason, category } of patterns) {
            if (pattern.test(url)) {
                score += patternScore;
                reasons.push(reason);
                categories.push(category);
                break;
            }
        }

        return { score, reasons, categories };
    }

    /**
     * 关键词分析
     */
    private analyzeKeywords(content: string): { score: number; reasons: string[] } {
        const reasons = [];
        let score = 0;

        const keywordGroups = [
            { 
                keywords: ['项目', 'project', '任务', 'task', '功能', 'feature'], 
                score: 0.2, 
                reason: '包含项目相关词汇' 
            },
            { 
                keywords: ['开发', 'development', '代码', 'code', 'api', '接口'], 
                score: 0.2, 
                reason: '包含开发相关词汇' 
            },
            { 
                keywords: ['设计', 'design', 'ui', 'ux', '界面', '原型'], 
                score: 0.15, 
                reason: '包含设计相关词汇' 
            },
            { 
                keywords: ['测试', 'test', 'bug', '缺陷', 'qa'], 
                score: 0.15, 
                reason: '包含测试相关词汇' 
            },
            { 
                keywords: ['部署', 'deploy', '发布', 'release', '上线'], 
                score: 0.15, 
                reason: '包含部署相关词汇' 
            }
        ];

        for (const group of keywordGroups) {
            const hasKeyword = group.keywords.some(keyword => content.includes(keyword));
            if (hasKeyword) {
                score += group.score;
                reasons.push(group.reason);
            }
        }

        return { score, reasons };
    }

    /**
     * 页面类型分析
     */
    private analyzePageType(pageType: string): { score: number; categories: string[] } {
        const typeScores: Record<string, { score: number; category: string }> = {
            'github_issue': { score: 0.4, category: 'development' },
            'github_pull_request': { score: 0.4, category: 'development' },
            'jira_issue': { score: 0.4, category: 'project_management' },
            'confluence_page': { score: 0.3, category: 'documentation' },
            'notion_page': { score: 0.3, category: 'documentation' },
            'api_documentation': { score: 0.3, category: 'documentation' },
            'technical_doc': { score: 0.2, category: 'documentation' },
            'blog_post': { score: 0.1, category: 'content' }
        };

        const typeInfo = typeScores[pageType];
        if (typeInfo) {
            return { score: typeInfo.score, categories: [typeInfo.category] };
        }

        return { score: 0, categories: [] };
    }

    /**
     * 提取页面内容
     */
    private extractPageContent(): PageContent | null {
        try {
            const title = document.title || '';
            const url = window.location.href;
            const domain = window.location.hostname;
            
            const mainContent = this.extractMainContent();
            if (!mainContent) {
                return null;
            }

            const wordCount = this.countWords(mainContent);
            const truncatedContent = mainContent.length > this.config.maxContentLength 
                ? mainContent.substring(0, this.config.maxContentLength) + '...'
                : mainContent;

            const metadata = this.extractMetadata();
            const pageType = this.detectPageType(url, mainContent);
            const language = this.detectLanguage(mainContent);

            return {
                title,
                url,
                domain,
                mainContent: truncatedContent,
                metadata,
                pageType,
                timestamp: Date.now(),
                wordCount,
                language
            };
            
        } catch (error) {
            console.error('提取页面内容失败:', error);
            return null;
        }
    }

    /**
     * 提取主要内容
     */
    private extractMainContent(): string {
        const selectors = [
            'main', 'article', '[role="main"]',
            '#main', '#content', '.content', '.main-content',
            '.markdown-body', '.notion-page-content', '.wiki-content',
            'body'
        ];

        let bestContent = '';
        let maxScore = 0;

        for (const selector of selectors) {
            try {
                const element = document.querySelector(selector);
                if (element) {
                    const content = this.extractTextFromElement(element);
                    const score = this.scoreContent(content, element);
                    
                    if (score > maxScore && content.length > 100) {
                        maxScore = score;
                        bestContent = content;
                    }
                }
            } catch (error) {
                // 忽略选择器错误
            }
        }

        return bestContent;
    }

    /**
     * 从元素中提取文本
     */
    private extractTextFromElement(element: Element): string {
        const clone = element.cloneNode(true) as Element;
        
        // 移除不需要的元素
        const unwanted = clone.querySelectorAll('script, style, noscript, .ads, .sidebar, .navigation');
        unwanted.forEach(el => el.remove());

        let text = clone.textContent || '';
        return text.replace(/\s+/g, ' ').trim();
    }

    /**
     * 内容评分
     */
    private scoreContent(content: string, element: Element): number {
        let score = Math.min(content.length / 200, 50);
        
        score += element.querySelectorAll('p').length * 2;
        score += element.querySelectorAll('h1, h2, h3, h4, h5, h6').length * 5;
        score += element.querySelectorAll('ul, ol').length * 3;
        
        if (['main', 'article'].includes(element.tagName.toLowerCase())) {
            score += 30;
        }
        
        const className = element.className.toLowerCase();
        if (['content', 'main', 'article'].some(name => className.includes(name))) {
            score += 20;
        }
        
        return score;
    }

    /**
     * 计算单词数
     */
    private countWords(text: string): number {
        if (!text) return 0;
        
        const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
        const englishWords = text.replace(/[\u4e00-\u9fff]/g, '').split(/\s+/).filter(word => word.length > 0).length;
        
        return chineseChars + englishWords;
    }

    /**
     * 提取实体
     */
    private extractEntities(content: string): any {
        const entities: any = {};
        
        // 提取项目名称
        const projects = this.extractWithPatterns(content, [
            /项目[：:]?\s*([^\s,，。]{2,20})/g,
            /Project[:\s]+([A-Za-z0-9\s-]{2,30})/gi
        ]);
        if (projects.length > 0) entities.projects = projects;

        // 提取人员
        const people = this.extractWithPatterns(content, [
            /@([a-zA-Z0-9\u4e00-\u9fa5]{2,20})/g,
            /负责人[：:]?\s*([^\s,，。]{2,10})/g
        ]);
        if (people.length > 0) entities.people = people;

        // 提取技术栈
        const technologies = [];
        const techKeywords = ['react', 'vue', 'angular', 'node.js', 'python', 'java', 'docker'];
        for (const tech of techKeywords) {
            if (content.toLowerCase().includes(tech)) {
                technologies.push(tech);
            }
        }
        if (technologies.length > 0) entities.technologies = technologies;

        return entities;
    }

    /**
     * 使用模式提取内容
     */
    private extractWithPatterns(content: string, patterns: RegExp[]): string[] {
        const results = new Set<string>();
        
        for (const pattern of patterns) {
            let match;
            while ((match = pattern.exec(content)) !== null) {
                if (match[1] && match[1].trim().length > 1) {
                    results.add(match[1].trim());
                }
            }
        }
        
        return Array.from(results);
    }

    /**
     * 提取相关片段
     */
    private extractRelevantSnippets(content: string): string {
        const sentences = content.split(/[。！？.!?]/).filter(s => s.trim().length > 20);
        return sentences.slice(0, 3).join(' ... ');
    }

    /**
     * 提取元数据
     */
    private extractMetadata(): Record<string, any> {
        const metadata: Record<string, any> = {};
        
        const description = document.querySelector('meta[name="description"]')?.getAttribute('content');
        if (description) metadata.description = description;
        
        return metadata;
    }

    /**
     * 检测页面类型
     */
    private detectPageType(url: string, content: string): string {
        const lowerUrl = url.toLowerCase();
        
        if (/github\.com.*\/issues?\//.test(lowerUrl)) return 'github_issue';
        if (/jira.*\/browse\//.test(lowerUrl)) return 'jira_issue';
        if (/confluence/.test(lowerUrl)) return 'confluence_page';
        if (/notion\.so/.test(lowerUrl)) return 'notion_page';
        
        return 'webpage';
    }

    /**
     * 检测语言
     */
    private detectLanguage(content: string): string {
        const chineseChars = (content.match(/[\u4e00-\u9fff]/g) || []).length;
        return chineseChars / content.length > 0.1 ? 'zh' : 'en';
    }

    /**
     * 处理分析结果
     */
    private async handleAnalysisResult(pageContent: PageContent, analysisResult: WebAnalysisResult): Promise<void> {
        try {
            if (analysisResult.isRelevant && analysisResult.suggestedStorage) {
                console.log('📝 发现相关内容，准备存储');
                
                this.recordEvent('relevant_content_found', {
                    url: pageContent.url,
                    title: pageContent.title,
                    confidence: analysisResult.confidence,
                    categories: analysisResult.categories
                });
                
                // 发送到后台脚本
                await this.sendToBackground({
                    type: 'WEB_INTELLIGENCE_ANALYSIS',
                    pageContent,
                    analysisResult,
                    timestamp: Date.now()
                });
                
                if (analysisResult.confidence > 0.8) {
                    this.showUserNotification(analysisResult);
                }
            }
            
            await this.recordAnalysisHistory(pageContent, analysisResult);
            
        } catch (error) {
            console.error('处理分析结果失败:', error);
        }
    }

    /**
     * 发送消息到后台脚本
     */
    private async sendToBackground(message: any): Promise<any> {
        try {
            return await chrome.runtime.sendMessage(message);
        } catch (error) {
            console.error('发送后台消息失败:', error);
            return null;
        }
    }

    /**
     * 显示用户通知
     */
    private showUserNotification(analysisResult: WebAnalysisResult): void {
        if (document.querySelector('.web-intelligence-notification')) {
            return;
        }
        
        const notification = document.createElement('div');
        notification.className = 'web-intelligence-notification';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 16px 20px;
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.2);
            z-index: 2147483647;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
            max-width: 320px;
            cursor: pointer;
            transform: translateX(400px);
            transition: transform 0.3s ease-out;
        `;
        
        const confidencePercent = Math.round(analysisResult.confidence * 100);
        
        notification.innerHTML = `
            <div style="display: flex; align-items: center; margin-bottom: 8px;">
                <div style="font-size: 20px; margin-right: 10px;">🧠</div>
                <div style="font-weight: 600;">发现相关内容</div>
                <div style="margin-left: auto; font-size: 12px; opacity: 0.8;">${confidencePercent}%</div>
            </div>
            <div style="font-size: 13px; opacity: 0.9; line-height: 1.4;">
                ${analysisResult.reasoning}
            </div>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);
        
        notification.addEventListener('click', () => {
            notification.style.transform = 'translateX(400px)';
            setTimeout(() => notification.remove(), 300);
        });
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.transform = 'translateX(400px)';
                setTimeout(() => notification.remove(), 300);
            }
        }, 8000);
    }

    /**
     * 记录事件
     */
    private recordEvent(type: PageAnalysisEvent['type'], data: any): void {
        this.pageEvents.push({
            type,
            data,
            timestamp: Date.now()
        });
        
        if (this.pageEvents.length > 100) {
            this.pageEvents.splice(0, 50);
        }
    }

    /**
     * 记录分析历史
     */
    private async recordAnalysisHistory(pageContent: PageContent, analysisResult: WebAnalysisResult): Promise<void> {
        try {
            const historyEntry = {
                url: pageContent.url,
                title: pageContent.title,
                domain: pageContent.domain,
                confidence: analysisResult.confidence,
                isRelevant: analysisResult.isRelevant,
                categories: analysisResult.categories,
                timestamp: Date.now()
            };
            
            const result = await chrome.storage.local.get('webAnalysisHistory');
            const history = result.webAnalysisHistory || [];
            
            history.unshift(historyEntry);
            if (history.length > 1000) {
                history.splice(1000);
            }
            
            await chrome.storage.local.set({ webAnalysisHistory: history });
            
        } catch (error) {
            console.error('记录分析历史失败:', error);
        }
    }

    /**
     * 手动触发分析
     */
    public async triggerAnalysis(): Promise<WebAnalysisResult | null> {
        try {
            const pageContent = this.extractPageContent();
            if (!pageContent) {
                return null;
            }
            
            const result = await this.performQuickAnalysis(pageContent);
            await this.handleAnalysisResult(pageContent, result);
            
            return result;
        } catch (error) {
            console.error('手动分析失败:', error);
            return null;
        }
    }

    /**
     * 获取分析统计
     */
    public getAnalysisStats() {
        return {
            totalAnalyses: this.analysisCount,
            lastAnalysisTime: this.lastAnalysisTime,
            isAnalyzing: this.isAnalyzing,
            currentDomain: window.location.hostname,
            canAnalyze: this.shouldRunOnCurrentDomain() && this.checkAnalysisRateLimit()
        };
    }

    /**
     * 更新配置
     */
    public updateConfig(newConfig: Partial<ContentExtractionConfig>): void {
        this.config = { ...this.config, ...newConfig };
        chrome.storage.local.set({ webIntelligenceConfig: this.config });
    }

    /**
     * 销毁内容脚本
     */
    public destroy(): void {
        if (this.analysisTimer) {
            clearTimeout(this.analysisTimer);
        }
        
        if (this.contentObserver) {
            this.contentObserver.disconnect();
        }
        
        const notifications = document.querySelectorAll('.web-intelligence-notification');
        notifications.forEach(notification => notification.remove());
    }
}

// 全局实例
let enhancedContentScript: EnhancedUniversalContentScript | null = null;

// 初始化
if (typeof window !== 'undefined' && window.location && typeof chrome !== 'undefined' && chrome.runtime) {
    if (!window.location.href.startsWith('chrome-extension://')) {
        enhancedContentScript = new EnhancedUniversalContentScript();
        
        (window as any).__webIntelligence = enhancedContentScript;
        
        // 监听扩展消息
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.type === 'TRIGGER_MANUAL_ANALYSIS') {
                enhancedContentScript?.triggerAnalysis()
                    .then(result => sendResponse({ success: true, result }))
                    .catch(error => sendResponse({ success: false, error: error.message }));
                return true;
            }
            
            if (request.type === 'GET_ANALYSIS_STATS') {
                const stats = enhancedContentScript?.getAnalysisStats();
                sendResponse({ success: true, stats });
            }
            
            if (request.type === 'UPDATE_CONFIG') {
                enhancedContentScript?.updateConfig(request.config);
                sendResponse({ success: true });
            }
        });
    }
}

export default enhancedContentScript;