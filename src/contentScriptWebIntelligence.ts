/**
 * 智能网页分析 Content Script
 * 在所有网页中运行，自动分析相关内容
 */

// 简化的页面内容接口
interface SimplePageContent {
    title: string;
    url: string;
    domain: string;
    mainContent: string;
    wordCount: number;
    timestamp: number;
}

// 简化的分析结果接口
interface SimpleAnalysisResult {
    isRelevant: boolean;
    confidence: number;
    suggestedStorage: boolean; // 新增：是否建议存储
    extractedInfo: {
        projects?: string[];
        people?: string[];
        technologies?: string[];
        actionItems?: string[];
    };
    reasoning: string;
    categories: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ---------------------------------------------------------------------------
// Context Match: URL-based cache and domain debounce
// ---------------------------------------------------------------------------
const contextMatchCache = new Map<string, { match: any; ts: number }>();
const domainLastRequest = new Map<string, number>();
const CONTEXT_MATCH_DOMAIN_DEBOUNCE_MS = 5 * 60 * 1000; // 5 minutes

class WebIntelligenceContentScript {
    private isAnalyzing = false;
    private lastAnalysisTime = 0;
    private analysisCount = 0;
    private readonly MIN_ANALYSIS_INTERVAL = 5000; // 5秒
    private readonly BLOCKED_DOMAINS = [
        'google.com', 'facebook.com', 'twitter.com', 'youtube.com',
        'amazon.com', 'netflix.com', 'spotify.com'
    ];

    constructor() {
        this.initialize();
    }

    private initialize(): void {
        // 检查是否应该在当前域名运行
        if (!this.shouldRunOnCurrentDomain()) {
            console.log('🚫 智能网页分析: 当前域名被跳过');
            return;
        }

        console.log('🧠 智能网页分析已启动:', window.location.href);

        // 设置事件监听
        this.setupEventListeners();
        
        // 延迟执行初始分析
        setTimeout(() => {
            this.scheduleAnalysis();
        }, 2000);

        // Context match: check for related reflections/dreams after page loads
        setTimeout(() => {
            this.tryContextMatch();
        }, 2000);
    }

    private shouldRunOnCurrentDomain(): boolean {
        const domain = window.location.hostname;
        const url = window.location.href;

        // 跳过扩展页面
        if (url.startsWith('chrome-extension://') || url.startsWith('chrome://')) {
            return false;
        }

        // 跳过被阻止的域名
        return !this.BLOCKED_DOMAINS.some(blocked => domain.includes(blocked));
    }

    private setupEventListeners(): void {
        // 页面加载完成后分析
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.scheduleAnalysis();
            });
        }

        // 监听内容变化
        const observer = new MutationObserver((mutations) => {
            const hasSignificantChanges = mutations.some(mutation => 
                mutation.type === 'childList' && 
                mutation.addedNodes.length > 3
            );
            
            if (hasSignificantChanges) {
                this.scheduleAnalysis();
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        // 监听扩展消息
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.type === 'TRIGGER_MANUAL_ANALYSIS') {
                this.performAnalysis()
                    .then(result => sendResponse({ success: true, result }))
                    .catch(error => sendResponse({ success: false, error: error.message }));
                return true;
            }

            if (request.type === 'GET_ANALYSIS_STATS') {
                sendResponse({
                    success: true,
                    stats: {
                        analysisCount: this.analysisCount,
                        lastAnalysisTime: this.lastAnalysisTime,
                        isAnalyzing: this.isAnalyzing,
                        currentDomain: window.location.hostname
                    }
                });
            }
        });
    }

    private scheduleAnalysis(): void {
        const now = Date.now();
        if (now - this.lastAnalysisTime < this.MIN_ANALYSIS_INTERVAL || this.isAnalyzing) {
            return;
        }

        setTimeout(() => {
            this.performAnalysis();
        }, 1000);
    }

    private async performAnalysis(): Promise<SimpleAnalysisResult | null> {
        if (this.isAnalyzing) return null;

        this.isAnalyzing = true;
        this.lastAnalysisTime = Date.now();
        this.analysisCount++;

        try {
            console.log(`🔍 开始智能分析 #${this.analysisCount}:`, window.location.href);

            // 提取页面内容
            const pageContent = this.extractPageContent();
            if (!pageContent || pageContent.wordCount < 50) {
                console.log('📄 页面内容不足，跳过分析');
                return null;
            }

            // 执行快速本地分析
            const analysisResult = this.quickAnalyze(pageContent);

            // 如果相关且置信度高，发送到后台处理
            if (analysisResult.isRelevant && analysisResult.confidence > 0.5) {
                console.log('📤 准备发送到后台处理:', {
                    相关性: analysisResult.isRelevant,
                    置信度: analysisResult.confidence,
                    建议存储: analysisResult.suggestedStorage,
                    提取信息: Object.keys(analysisResult.extractedInfo)
                });

                chrome.runtime.sendMessage({
                    type: 'WEB_INTELLIGENCE_ANALYSIS',
                    pageContent,
                    analysisResult,
                    timestamp: Date.now()
                }).then(response => {
                    if (response && response.success) {
                        console.log('✅ 后台处理响应:', response);
                        if (response.processed) {
                            console.log('🎯 内容已通过agentThinking处理并存储');
                        }
                    } else {
                        console.warn('⚠️ 后台处理未成功:', response);
                    }
                }).catch(error => {
                    console.error('❌ 发送分析结果失败:', error);
                });

                // 显示用户提示
                if (analysisResult.confidence > 0.8) {
                    // 暂时禁用弹窗提示
                    // this.showNotification(analysisResult);
                }
            } else {
                console.log('⏭️ 跳过后台处理:', {
                    相关性: analysisResult.isRelevant,
                    置信度: analysisResult.confidence,
                    阈值: '0.5'
                });
            }

            console.log('✅ 分析完成:', {
                相关性: (analysisResult.confidence * 100).toFixed(1) + '%',
                是否相关: analysisResult.isRelevant ? '是' : '否',
                分类: analysisResult.categories.join(', ')
            });

            return analysisResult;

        } catch (error) {
            console.error('❌ 智能分析失败:', error);
            return null;
        } finally {
            this.isAnalyzing = false;
        }
    }

    private extractPageContent(): SimplePageContent | null {
        try {
            const title = document.title || '';
            const url = window.location.href;
            const domain = window.location.hostname;

            // 提取主要内容
            const mainContent = this.extractMainContent();
            if (!mainContent) return null;

            const wordCount = this.countWords(mainContent);

            return {
                title,
                url,
                domain,
                mainContent: mainContent.length > 10000 ? 
                    mainContent.substring(0, 10000) + '...' : mainContent,
                wordCount,
                timestamp: Date.now()
            };
        } catch (error) {
            console.error('提取页面内容失败:', error);
            return null;
        }
    }

    private extractMainContent(): string {
        // 优先选择器列表
        const selectors = [
            'main', 'article', '[role="main"]',
            '#main', '#content', '.content', '.main-content',
            '.markdown-body', '.wiki-content', '.notion-page-content'
        ];

        for (const selector of selectors) {
            try {
                const element = document.querySelector(selector);
                if (element) {
                    const content = this.getTextContent(element);
                    if (content.length > 200) {
                        return content;
                    }
                }
            } catch (error) {
                continue;
            }
        }

        // 回退到body
        return this.getTextContent(document.body);
    }

    private getTextContent(element: Element): string {
        // 移除脚本和样式
        const clone = element.cloneNode(true) as Element;
        const unwanted = clone.querySelectorAll('script, style, nav, header, footer, .sidebar, .ads');
        unwanted.forEach(el => el.remove());

        return (clone.textContent || '').replace(/\s+/g, ' ').trim();
    }

    private countWords(text: string): number {
        const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
        const englishWords = text.replace(/[\u4e00-\u9fff]/g, '').split(/\s+/).filter(word => word.length > 0).length;
        return chineseChars + englishWords;
    }

    private quickAnalyze(pageContent: SimplePageContent): SimpleAnalysisResult {
        const content = pageContent.mainContent.toLowerCase();
        let confidence = 0;
        const categories: string[] = [];
        const extractedInfo: any = {};
        const reasons: string[] = [];

        // URL模式分析
        const urlAnalysis = this.analyzeUrl(pageContent.url);
        confidence += urlAnalysis.score;
        categories.push(...urlAnalysis.categories);
        reasons.push(...urlAnalysis.reasons);

        // 关键词分析
        const keywordAnalysis = this.analyzeKeywords(content);
        confidence += keywordAnalysis.score;
        reasons.push(...keywordAnalysis.reasons);

        // 实体提取
        const entities = this.extractSimpleEntities(pageContent.mainContent);
        Object.assign(extractedInfo, entities);

        const finalConfidence = Math.min(confidence, 1);
        const isRelevant = finalConfidence > 0.3;
        const suggestedStorage = isRelevant && finalConfidence > 0.4; // 添加存储建议逻辑

        return {
            isRelevant,
            confidence: finalConfidence,
            suggestedStorage, // 新增字段
            extractedInfo,
            reasoning: reasons.join('; ') || '基于内容特征分析',
            categories: Array.from(new Set(categories))
        };
    }

    private analyzeUrl(url: string): { score: number; categories: string[]; reasons: string[] } {
        const categories: string[] = [];
        const reasons: string[] = [];
        let score = 0;

        const patterns = [
            { pattern: /github\.com/i, score: 0.4, reason: 'GitHub平台', category: 'development' },
            { pattern: /jira.*\/browse/i, score: 0.5, reason: 'Jira任务', category: 'project_management' },
            { pattern: /confluence/i, score: 0.4, reason: 'Confluence文档', category: 'documentation' },
            { pattern: /notion\.so/i, score: 0.4, reason: 'Notion页面', category: 'documentation' },
            { pattern: /slack\.com/i, score: 0.3, reason: 'Slack对话', category: 'communication' },
            { pattern: /figma\.com/i, score: 0.3, reason: 'Figma设计', category: 'design' },
            { pattern: /docs\.google\.com/i, score: 0.3, reason: 'Google文档', category: 'documentation' },
            { pattern: /trello\.com/i, score: 0.3, reason: 'Trello看板', category: 'project_management' },
            { pattern: /linear\.app/i, score: 0.4, reason: 'Linear任务', category: 'project_management' }
        ];

        for (const { pattern, score: patternScore, reason, category } of patterns) {
            if (pattern.test(url)) {
                score += patternScore;
                reasons.push(reason);
                categories.push(category);
                break;
            }
        }

        return { score, categories, reasons };
    }

    private analyzeKeywords(content: string): { score: number; reasons: string[] } {
        const reasons: string[] = [];
        let score = 0;

        const keywordGroups = [
            { keywords: ['项目', 'project', '任务', 'task', 'issue', '功能'], score: 0.2, reason: '项目管理相关' },
            { keywords: ['开发', 'development', '代码', 'code', 'api', '接口', 'bug'], score: 0.2, reason: '开发相关' },
            { keywords: ['设计', 'design', 'ui', 'ux', '界面', '原型'], score: 0.15, reason: '设计相关' },
            { keywords: ['测试', 'test', 'qa', '质量'], score: 0.1, reason: '测试相关' },
            { keywords: ['发布', 'release', '部署', 'deploy', '上线'], score: 0.15, reason: '发布相关' },
            { keywords: ['sprint', 'scrum', 'agile', '敏捷', '冲刺'], score: 0.2, reason: '敏捷开发' }
        ];

        for (const group of keywordGroups) {
            if (group.keywords.some(keyword => content.includes(keyword))) {
                score += group.score;
                reasons.push(group.reason);
            }
        }

        return { score, reasons };
    }

    private extractSimpleEntities(content: string): any {
        const entities: any = {};

        // 项目名称
        const projects = this.extractWithPattern(content, [
            /项目[：:]?\s*([^\s,，。]{2,20})/g,
            /Project[:\s]+([A-Za-z0-9\s-]{2,30})/gi,
            /\[([A-Z]+-\d+)\]/g // Jira格式
        ]);
        if (projects.length > 0) entities.projects = projects;

        // 人员
        const people = this.extractWithPattern(content, [
            /@([a-zA-Z0-9\u4e00-\u9fa5]{2,20})/g,
            /负责人[：:]?\s*([^\s,，。]{2,10})/g,
            /Assignee[:\s]*([^\s,，。]{2,20})/gi
        ]);
        if (people.length > 0) entities.people = people;

        // 技术栈
        const techKeywords = [
            'react', 'vue', 'angular', 'javascript', 'typescript', 'node.js', 'python', 
            'java', 'spring', 'docker', 'kubernetes', 'aws', 'mongodb', 'mysql', 'redis'
        ];
        const technologies = techKeywords.filter(tech => 
            content.toLowerCase().includes(tech)
        );
        if (technologies.length > 0) entities.technologies = technologies;

        // 行动项
        const actions = this.extractWithPattern(content, [
            /TODO[:\s]*([^。！!.\n]{5,50})/gi,
            /需要\s*([^。！!.]{5,50})/g,
            /- \[ \]\s*([^。！!.\n]{5,50})/g
        ]);
        if (actions.length > 0) entities.actionItems = actions;

        return entities;
    }

    private extractWithPattern(content: string, patterns: RegExp[]): string[] {
        const results = new Set<string>();
        
        for (const pattern of patterns) {
            let match;
            while ((match = pattern.exec(content)) !== null) {
                if (match[1] && match[1].trim().length > 1) {
                    results.add(match[1].trim());
                }
            }
        }
        
        return Array.from(results).slice(0, 10); // 限制数量
    }

    // -----------------------------------------------------------------------
    // Context Match — surface related reflections/dreams as a floating bubble
    // -----------------------------------------------------------------------

    private tryContextMatch(): void {
        const url = window.location.href;
        const domain = window.location.hostname;

        // URL-level cache check
        const cached = contextMatchCache.get(url);
        if (cached && Date.now() - cached.ts < CONTEXT_MATCH_DOMAIN_DEBOUNCE_MS) {
            if (cached.match) this.showContextBubble(cached.match);
            return;
        }

        // Domain-level debounce
        const lastReq = domainLastRequest.get(domain);
        if (lastReq && Date.now() - lastReq < CONTEXT_MATCH_DOMAIN_DEBOUNCE_MS) {
            return;
        }
        domainLastRequest.set(domain, Date.now());

        // Extract lightweight page context
        const title = document.title || '';
        const metaKeywords = document.querySelector('meta[name="keywords"]')?.getAttribute('content');
        const keywords = metaKeywords ? metaKeywords.split(',').map(k => k.trim()).filter(Boolean) : undefined;

        // First 300 chars of visible text as snippet
        const mainEl = document.querySelector('main, article, [role="main"]');
        const snippet = (mainEl || document.body)?.textContent?.replace(/\s+/g, ' ').trim().slice(0, 300) || undefined;

        if (!title.trim() && !snippet?.trim()) return;

        chrome.runtime.sendMessage({
            type: 'CONTEXT_MATCH_REQUEST',
            title,
            keywords,
            snippet,
        }, (response) => {
            if (chrome.runtime.lastError) {
                console.warn('Context match message error:', chrome.runtime.lastError.message);
                return;
            }
            const match = response?.match ?? null;
            contextMatchCache.set(url, { match, ts: Date.now() });
            if (match) {
                this.showContextBubble(match);
            }
        });
    }

    private showContextBubble(match: { content: string; source: string; score: number }): void {
        // Don't inject twice
        if (document.querySelector('.pai-context-bubble')) return;

        const bubble = document.createElement('div');
        bubble.className = 'pai-context-bubble';
        bubble.style.cssText = `
            position: fixed;
            bottom: 24px;
            right: 24px;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            z-index: 2147483646;
            box-shadow: 0 2px 10px rgba(0,0,0,0.25);
            font-size: 20px;
            transition: transform 0.2s ease, box-shadow 0.2s ease;
            user-select: none;
        `;
        bubble.textContent = '\uD83D\uDCA1'; // 💡
        bubble.title = 'Related memory found';

        // Expanded card (hidden initially)
        const card = document.createElement('div');
        card.className = 'pai-context-card';
        card.style.cssText = `
            position: fixed;
            bottom: 72px;
            right: 24px;
            width: 320px;
            max-height: 260px;
            background: #fff;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.18);
            padding: 16px;
            z-index: 2147483646;
            display: none;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 13px;
            color: #333;
            overflow-y: auto;
        `;

        const sourceLabel = match.source.startsWith('reflections/') ? 'Reflection' : 'Dream';
        card.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
                <span style="font-weight:600;color:#764ba2;">\uD83E\uDDE0 ${sourceLabel}</span>
                <span style="font-size:11px;color:#999;">score ${(match.score * 100).toFixed(0)}%</span>
            </div>
            <div style="line-height:1.5;color:#555;white-space:pre-wrap;">${escapeHtml(match.content)}</div>
            <div style="margin-top:8px;font-size:11px;color:#aaa;">${escapeHtml(match.source)}</div>
        `;

        let expanded = false;

        bubble.addEventListener('mouseenter', () => {
            bubble.style.transform = 'scale(1.1)';
            bubble.style.boxShadow = '0 4px 16px rgba(0,0,0,0.3)';
        });
        bubble.addEventListener('mouseleave', () => {
            if (!expanded) {
                bubble.style.transform = 'scale(1)';
                bubble.style.boxShadow = '0 2px 10px rgba(0,0,0,0.25)';
            }
        });

        bubble.addEventListener('click', () => {
            expanded = !expanded;
            card.style.display = expanded ? 'block' : 'none';
        });

        // Close card when clicking outside
        document.addEventListener('click', (e) => {
            if (expanded && !bubble.contains(e.target as Node) && !card.contains(e.target as Node)) {
                expanded = false;
                card.style.display = 'none';
                bubble.style.transform = 'scale(1)';
            }
        });

        document.body.appendChild(card);
        document.body.appendChild(bubble);
    }

    private showNotification(result: SimpleAnalysisResult): void {
        // 检查是否已存在通知
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
            padding: 12px 16px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 2147483647;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 13px;
            max-width: 280px;
            cursor: pointer;
            transform: translateX(300px);
            transition: transform 0.3s ease;
        `;

        const confidencePercent = Math.round(result.confidence * 100);
        notification.innerHTML = `
            <div style="display: flex; align-items: center; margin-bottom: 6px;">
                <span style="margin-right: 8px;">🧠</span>
                <span style="font-weight: 600;">发现相关内容</span>
                <span style="margin-left: auto; font-size: 11px; opacity: 0.8;">${confidencePercent}%</span>
            </div>
            <div style="font-size: 11px; opacity: 0.9;">
                ${result.reasoning.substring(0, 60)}...
            </div>
        `;

        document.body.appendChild(notification);

        // 显示动画
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);

        // 点击关闭
        notification.addEventListener('click', () => {
            notification.style.transform = 'translateX(300px)';
            setTimeout(() => notification.remove(), 300);
        });

        // 自动关闭
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.transform = 'translateX(300px)';
                setTimeout(() => notification.remove(), 300);
            }
        }, 6000);
    }
}

// 启动智能网页分析
try {
    new WebIntelligenceContentScript();
} catch (error) {
    console.error('智能网页分析启动失败:', error);
}

console.log('🧠 智能网页分析 Content Script 已加载');

// ===========================================================================
// Context Match — floating insight bubble
// ===========================================================================

(() => {
    const urlCache = new Map<string, boolean>();
    const domainLastRequest = new Map<string, number>();
    const DOMAIN_DEBOUNCE_MS = 5 * 60 * 1000; // 5 minutes

    function requestContextMatch(): void {
        const url = window.location.href;
        if (urlCache.has(url)) return;

        const domain = window.location.hostname;
        const lastReq = domainLastRequest.get(domain);
        if (lastReq && Date.now() - lastReq < DOMAIN_DEBOUNCE_MS) return;

        urlCache.set(url, true);
        domainLastRequest.set(domain, Date.now());

        const title = document.title || '';
        const metaKeywords = document.querySelector('meta[name="keywords"]')?.getAttribute('content') || '';
        const snippet = (document.body?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 300);

        if (!title && !snippet) return;

        chrome.runtime.sendMessage({
            type: 'CONTEXT_MATCH_REQUEST',
            title,
            keywords: metaKeywords,
            snippet,
        }).then((response: any) => {
            if (response?.success && response.match) {
                showInsightBubble(response.match);
            }
        }).catch(() => {
            // silently ignore
        });
    }

    function showInsightBubble(match: { content: string; source: string; score: number }): void {
        if (document.querySelector('.pai-context-bubble')) return;

        // Collapsed bubble (small icon)
        const bubble = document.createElement('div');
        bubble.className = 'pai-context-bubble';
        bubble.style.cssText = `
            position: fixed; bottom: 24px; right: 24px; z-index: 2147483647;
            width: 44px; height: 44px; border-radius: 50%;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white; display: flex; align-items: center; justify-content: center;
            cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            font-size: 22px; transition: transform 0.2s ease;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;
        bubble.textContent = '\u{1F4A1}';
        bubble.title = 'Personal AI found a related insight';

        // Expanded panel
        const panel = document.createElement('div');
        panel.className = 'pai-context-panel';
        panel.style.cssText = `
            position: fixed; bottom: 80px; right: 24px; z-index: 2147483647;
            width: 320px; max-height: 260px; overflow-y: auto;
            background: #1e1e2e; color: #e0e0e0; border-radius: 12px;
            box-shadow: 0 8px 24px rgba(0,0,0,0.4); padding: 16px;
            display: none; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 13px; line-height: 1.5;
        `;

        const sourceLabel = match.source.includes('reflections/') ? 'Reflection' : 'Dream';
        const scorePercent = Math.round(match.score * 100);

        panel.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
                <span style="font-weight:600;font-size:14px;">\u{1F4A1} Related ${escapeHtml(sourceLabel)}</span>
                <span style="font-size:11px;opacity:0.6;">${scorePercent}% match</span>
            </div>
            <div style="font-size:12px;opacity:0.85;white-space:pre-wrap;">${escapeHtml(match.content.slice(0, 500))}</div>
            <div style="margin-top:8px;font-size:11px;opacity:0.5;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                ${escapeHtml(match.source)}
            </div>
        `;

        let expanded = false;

        bubble.addEventListener('click', () => {
            expanded = !expanded;
            panel.style.display = expanded ? 'block' : 'none';
            bubble.style.transform = expanded ? 'scale(1.1)' : 'scale(1)';
        });

        // Close panel when clicking outside
        document.addEventListener('click', (e) => {
            if (expanded && !bubble.contains(e.target as Node) && !panel.contains(e.target as Node)) {
                expanded = false;
                panel.style.display = 'none';
                bubble.style.transform = 'scale(1)';
            }
        });

        document.body.appendChild(panel);
        document.body.appendChild(bubble);
    }

    // Trigger after 2s delay on page load
    setTimeout(requestContextMatch, 2000);
})();