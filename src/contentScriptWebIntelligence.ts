/**
 * 智能网页分析 Content Script
 * 在所有网页中运行，自动分析相关内容与相关记忆提示
 */

interface SimplePageContent {
    title: string;
    url: string;
    domain: string;
    mainContent: string;
    wordCount: number;
    timestamp: number;
}

interface SimpleAnalysisResult {
    isRelevant: boolean;
    confidence: number;
    suggestedStorage: boolean;
    extractedInfo: {
        projects?: string[];
        people?: string[];
        technologies?: string[];
        actionItems?: string[];
    };
    reasoning: string;
    categories: string[];
}

interface ContextMatchPayload {
    contextKey: string;
    stabilityKey: string;
    title: string;
    keywords?: string[];
    snippet?: string;
}

interface ContextMatchResult {
    content: string;
    source: string;
    score: number;
}

function escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function normalizeText(text?: string | null): string {
    return (text || '').replace(/\s+/g, ' ').trim();
}

const contextMatchCache = new Map<string, { match: ContextMatchResult | null; ts: number }>();
const CONTEXT_MATCH_CACHE_TTL_MS = 5 * 60 * 1000;
const URL_WATCH_INTERVAL_MS = 500;
const GENERIC_CONTEXT_STABLE_MS = 250;
const RINGCENTRAL_CONTEXT_STABLE_MS = 700;

class WebIntelligenceContentScript {
    private isAnalyzing = false;
    private lastAnalysisTime = 0;
    private analysisCount = 0;
    private readonly MIN_ANALYSIS_INTERVAL = 5000;
    private readonly BLOCKED_DOMAINS = [
        'google.com', 'facebook.com', 'twitter.com', 'youtube.com',
        'amazon.com', 'netflix.com', 'spotify.com'
    ];

    private lastSeenUrl = window.location.href;
    private urlWatcherId: number | null = null;
    private contextMatchTimer: number | null = null;
    private observedContextStabilityKey: string | null = null;
    private observedContextSince = 0;
    private pendingContextRequestId = 0;
    private pendingContextKey: string | null = null;
    private activeBubbleContextKey: string | null = null;
    private bubbleElement: HTMLDivElement | null = null;
    private cardElement: HTMLDivElement | null = null;
    private outsideClickListener: ((event: MouseEvent) => void) | null = null;

    constructor() {
        this.initialize();
    }

    private initialize(): void {
        if (!this.shouldRunOnCurrentDomain()) {
            console.log('🚫 智能网页分析: 当前域名被跳过');
            return;
        }

        console.log('🧠 智能网页分析已启动:', window.location.href);

        this.setupEventListeners();

        this.scheduleAnalysis(2000);
        this.scheduleContextMatch(2000);
    }

    private shouldRunOnCurrentDomain(): boolean {
        const domain = window.location.hostname;
        const url = window.location.href;

        if (url.startsWith('chrome-extension://') || url.startsWith('chrome://')) {
            return false;
        }

        return !this.BLOCKED_DOMAINS.some(blocked => domain.includes(blocked));
    }

    private setupEventListeners(): void {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.scheduleAnalysis(1000);
                this.scheduleContextMatch(1500);
            });
        } else {
            this.scheduleAnalysis(1000);
            this.scheduleContextMatch(1500);
        }

        if (document.body) {
            const observer = new MutationObserver((mutations) => {
                const hasSignificantChanges = this.hasSignificantAnalysisChanges(mutations);
                if (hasSignificantChanges) {
                    this.scheduleAnalysis(1000);
                }

                if (this.shouldReevaluateContext(mutations)) {
                    this.scheduleContextMatch(this.getContextChangeDelayMs());
                }
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        }

        window.addEventListener('focus', () => {
            this.scheduleAnalysis(1000);
            this.scheduleContextMatch(400);
        });

        window.addEventListener('hashchange', () => {
            this.handleUrlMaybeChanged();
        });

        window.addEventListener('popstate', () => {
            this.handleUrlMaybeChanged();
        });

        this.startUrlWatcher();

        chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
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
                        currentDomain: window.location.hostname,
                        currentContextKey: this.activeBubbleContextKey
                    }
                });
            }
        });
    }

    private startUrlWatcher(): void {
        if (this.urlWatcherId !== null) return;

        this.urlWatcherId = window.setInterval(() => {
            if (window.location.href !== this.lastSeenUrl) {
                this.handleUrlMaybeChanged();
            }
        }, URL_WATCH_INTERVAL_MS);
    }

    private handleUrlMaybeChanged(): void {
        const currentUrl = window.location.href;
        const hasChanged = currentUrl !== this.lastSeenUrl;
        this.lastSeenUrl = currentUrl;

        if (hasChanged) {
            this.resetContextStability();
            this.clearContextBubble();
        }

        this.scheduleAnalysis(1000);
        this.scheduleContextMatch(this.getContextChangeDelayMs());
    }

    private hasSignificantAnalysisChanges(mutations: MutationRecord[]): boolean {
        return mutations.some((mutation) => {
            if (mutation.type !== 'childList') return false;

            const nodes = Array.from(mutation.addedNodes);
            if (nodes.length > 3) return true;

            return nodes.some((node) => {
                if (!(node instanceof HTMLElement)) return false;
                if (this.isOwnedContextUiNode(node)) return false;
                return normalizeText(node.textContent).length > 200;
            });
        });
    }

    private shouldReevaluateContext(mutations: MutationRecord[]): boolean {
        if (this.isRingCentralMessagePage()) {
            return this.hasRingCentralConversationChanges(mutations);
        }

        return mutations.some((mutation) => {
            if (mutation.type !== 'childList') return false;
            return Array.from(mutation.addedNodes).some((node) => {
                if (!(node instanceof HTMLElement)) return false;
                if (this.isOwnedContextUiNode(node)) return false;
                return normalizeText(node.textContent).length > 200;
            });
        });
    }

    private hasRingCentralConversationChanges(mutations: MutationRecord[]): boolean {
        for (const mutation of mutations) {
            if (mutation.type !== 'childList') continue;

            const touchedNodes = [...Array.from(mutation.addedNodes), ...Array.from(mutation.removedNodes)];
            for (const node of touchedNodes) {
                if (!(node instanceof HTMLElement)) continue;
                if (this.isOwnedContextUiNode(node)) continue;

                if (
                    node.id === 'message-chat-stream-wrapper' ||
                    node.matches('[role="tab"], [role="tablist"], .conversation-card-wrapper, [data-id]') ||
                    node.querySelector?.('#message-chat-stream-wrapper, [role="tab"], [role="tablist"], .conversation-card-wrapper, [data-id]')
                ) {
                    return true;
                }
            }

            const target = mutation.target instanceof HTMLElement ? mutation.target : null;
            if (!target) continue;

            if (
                target.closest('#leftRail') ||
                target.closest('#message-chat-stream-wrapper') ||
                target.closest('main')
            ) {
                return true;
            }
        }

        return false;
    }

    private isOwnedContextUiNode(node: HTMLElement): boolean {
        return (
            node.classList.contains('pai-context-bubble') ||
            node.classList.contains('pai-context-card') ||
            node.id === 'pai-context-bubble-styles' ||
            !!node.closest('.pai-context-bubble, .pai-context-card')
        );
    }

    private scheduleAnalysis(delayMs = 1000): void {
        const now = Date.now();
        if (now - this.lastAnalysisTime < this.MIN_ANALYSIS_INTERVAL || this.isAnalyzing) {
            return;
        }

        window.setTimeout(() => {
            void this.performAnalysis();
        }, delayMs);
    }

    private scheduleContextMatch(delayMs = 0): void {
        if (this.contextMatchTimer !== null) {
            window.clearTimeout(this.contextMatchTimer);
        }

        this.contextMatchTimer = window.setTimeout(() => {
            this.contextMatchTimer = null;
            this.tryContextMatch();
        }, delayMs);
    }

    private resetContextStability(): void {
        this.observedContextStabilityKey = null;
        this.observedContextSince = 0;
        this.pendingContextKey = null;
    }

    private getContextChangeDelayMs(): number {
        return this.isRingCentralMessagePage() ? 800 : 1200;
    }

    private getContextStabilityMs(): number {
        return this.isRingCentralMessagePage() ? RINGCENTRAL_CONTEXT_STABLE_MS : GENERIC_CONTEXT_STABLE_MS;
    }

    private async performAnalysis(): Promise<SimpleAnalysisResult | null> {
        if (this.isAnalyzing) return null;

        this.isAnalyzing = true;
        this.lastAnalysisTime = Date.now();
        this.analysisCount++;

        try {
            console.log(`🔍 开始智能分析 #${this.analysisCount}:`, window.location.href);

            const pageContent = this.extractPageContent();
            if (!pageContent || pageContent.wordCount < 50) {
                console.log('📄 页面内容不足，跳过分析');
                return null;
            }

            const analysisResult = this.quickAnalyze(pageContent);

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

                if (analysisResult.confidence > 0.8) {
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

            const mainContent = this.extractMainContent();
            if (!mainContent) return null;

            const wordCount = this.countWords(mainContent);

            return {
                title,
                url,
                domain,
                mainContent: mainContent.length > 10000
                    ? mainContent.substring(0, 10000) + '...'
                    : mainContent,
                wordCount,
                timestamp: Date.now()
            };
        } catch (error) {
            console.error('提取页面内容失败:', error);
            return null;
        }
    }

    private extractMainContent(): string {
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
            } catch (_error) {
                continue;
            }
        }

        return this.getTextContent(document.body);
    }

    private getTextContent(element: Element): string {
        const clone = element.cloneNode(true) as Element;
        const unwanted = clone.querySelectorAll('script, style, nav, header, footer, .sidebar, .ads');
        unwanted.forEach(el => el.remove());
        return normalizeText(clone.textContent);
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
        const extractedInfo: SimpleAnalysisResult['extractedInfo'] = {};
        const reasons: string[] = [];

        const urlAnalysis = this.analyzeUrl(pageContent.url);
        confidence += urlAnalysis.score;
        categories.push(...urlAnalysis.categories);
        reasons.push(...urlAnalysis.reasons);

        const keywordAnalysis = this.analyzeKeywords(content);
        confidence += keywordAnalysis.score;
        reasons.push(...keywordAnalysis.reasons);

        const entities = this.extractSimpleEntities(pageContent.mainContent);
        Object.assign(extractedInfo, entities);

        const finalConfidence = Math.min(confidence, 1);
        const isRelevant = finalConfidence > 0.3;
        const suggestedStorage = isRelevant && finalConfidence > 0.4;

        return {
            isRelevant,
            confidence: finalConfidence,
            suggestedStorage,
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

    private extractSimpleEntities(content: string): SimpleAnalysisResult['extractedInfo'] {
        const entities: SimpleAnalysisResult['extractedInfo'] = {};

        const projects = this.extractWithPattern(content, [
            /项目[：:]?\s*([^\s,，。]{2,20})/g,
            /Project[:\s]+([A-Za-z0-9\s-]{2,30})/gi,
            /\[([A-Z]+-\d+)\]/g
        ]);
        if (projects.length > 0) entities.projects = projects;

        const people = this.extractWithPattern(content, [
            /@([a-zA-Z0-9\u4e00-\u9fa5]{2,20})/g,
            /负责人[：:]?\s*([^\s,，。]{2,10})/g,
            /Assignee[:\s]*([^\s,，。]{2,20})/gi
        ]);
        if (people.length > 0) entities.people = people;

        const techKeywords = [
            'react', 'vue', 'angular', 'javascript', 'typescript', 'node.js', 'python',
            'java', 'spring', 'docker', 'kubernetes', 'aws', 'mongodb', 'mysql', 'redis'
        ];
        const technologies = techKeywords.filter(tech => content.toLowerCase().includes(tech));
        if (technologies.length > 0) entities.technologies = technologies;

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

        return Array.from(results).slice(0, 10);
    }

    private tryContextMatch(): void {
        const payload = this.buildContextMatchPayload();
        if (!payload) {
            this.clearContextBubble();
            return;
        }

        const now = Date.now();
        if (payload.stabilityKey !== this.observedContextStabilityKey) {
            this.observedContextStabilityKey = payload.stabilityKey;
            this.observedContextSince = now;
            this.scheduleContextMatch(this.getContextStabilityMs());
            return;
        }

        const stableForMs = now - this.observedContextSince;
        const requiredStableMs = this.getContextStabilityMs();
        if (stableForMs < requiredStableMs) {
            this.scheduleContextMatch(requiredStableMs - stableForMs);
            return;
        }

        const cached = contextMatchCache.get(payload.contextKey);
        if (cached && now - cached.ts < CONTEXT_MATCH_CACHE_TTL_MS) {
            if (cached.match) {
                this.showContextBubble(cached.match, payload.contextKey, this.activeBubbleContextKey !== payload.contextKey);
            } else {
                this.clearContextBubble();
            }
            return;
        }

        if (this.pendingContextKey === payload.contextKey) {
            return;
        }

        if (this.activeBubbleContextKey && this.activeBubbleContextKey !== payload.contextKey) {
            this.clearContextBubble();
        }

        this.pendingContextKey = payload.contextKey;
        const requestId = ++this.pendingContextRequestId;

        chrome.runtime.sendMessage({
            type: 'CONTEXT_MATCH_REQUEST',
            title: payload.title,
            keywords: payload.keywords,
            snippet: payload.snippet,
        }, (response) => {
            if (requestId !== this.pendingContextRequestId) {
                return;
            }

            this.pendingContextKey = null;

            if (chrome.runtime.lastError) {
                console.warn('Context match message error:', chrome.runtime.lastError.message);
                return;
            }

            const currentPayload = this.buildContextMatchPayload();
            if (!currentPayload || currentPayload.contextKey !== payload.contextKey) {
                return;
            }

            const match = (response?.match ?? null) as ContextMatchResult | null;
            contextMatchCache.set(payload.contextKey, { match, ts: Date.now() });

            if (match) {
                this.showContextBubble(match, payload.contextKey, true);
            } else {
                this.clearContextBubble();
            }
        });
    }

    private buildContextMatchPayload(): ContextMatchPayload | null {
        if (this.isRingCentralMessagePage()) {
            return this.buildRingCentralContextPayload();
        }

        return this.buildGenericContextPayload();
    }

    private buildGenericContextPayload(): ContextMatchPayload | null {
        const title = normalizeText(document.title);
        const metaKeywords = document.querySelector('meta[name="keywords"]')?.getAttribute('content');
        const mainEl = document.querySelector('main, article, [role="main"]');
        const snippet = normalizeText((mainEl || document.body)?.textContent).slice(0, 500);
        if (!title && !snippet) {
            return null;
        }

        const keywords = this.collectKeywords([
            ...(metaKeywords ? metaKeywords.split(',').map(k => normalizeText(k)) : []),
            title,
            snippet
        ]);
        const snippetToken = normalizeText(snippet).slice(0, 160);
        const contextKey = `page:${window.location.href}|${title}|${snippetToken}`;

        return {
            contextKey,
            stabilityKey: contextKey,
            title: title || window.location.href,
            keywords,
            snippet
        };
    }

    private isRingCentralMessagePage(): boolean {
        return (
            window.location.hostname === 'app.ringcentral.com' &&
            /^\/messages\/[^/?#]+/.test(window.location.pathname)
        );
    }

    private buildRingCentralContextPayload(): ContextMatchPayload | null {
        const conversationId = this.getRingCentralConversationId();
        const title = this.getRingCentralConversationTitle();
        const stream = document.querySelector<HTMLElement>('#message-chat-stream-wrapper');
        const messageCards = Array.from(document.querySelectorAll<HTMLElement>('.conversation-card-wrapper[data-id]'));

        if (!conversationId || !title || !stream || messageCards.length === 0) {
            return null;
        }

        const cardsForSnippet = this.getRingCentralSnippetCards(stream, messageCards);
        const snippet = normalizeText(cardsForSnippet.map(card => card.textContent || '').join('\n')).slice(0, 1400);
        if (!snippet) {
            return null;
        }

        const messageIds = messageCards
            .slice(0, 3)
            .map(card => card.getAttribute('data-id'))
            .filter((id): id is string => !!id);
        const selectedTabText = normalizeText(document.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.textContent);
        const contextKey = `ringcentral:${conversationId}|${title}`;
        const stabilityKey = `${contextKey}|${messageIds.join(',')}`;

        return {
            contextKey,
            stabilityKey,
            title,
            keywords: this.collectKeywords([title, selectedTabText, snippet]),
            snippet
        };
    }

    private getRingCentralConversationId(): string | null {
        const match = window.location.pathname.match(/^\/messages\/([^/?#]+)/);
        return match?.[1] || null;
    }

    private getRingCentralConversationTitle(): string {
        const heading = document.querySelector<HTMLElement>('main h1, main [role="heading"]');
        return normalizeText(heading?.textContent || document.title);
    }

    private getRingCentralSnippetCards(
        stream: HTMLElement,
        messageCards: HTMLElement[]
    ): HTMLElement[] {
        const streamRect = stream.getBoundingClientRect();
        const visibleCards = messageCards.filter((card) => {
            const rect = card.getBoundingClientRect();
            return rect.bottom > streamRect.top && rect.top < streamRect.bottom;
        });

        const sourceCards = visibleCards.length > 0 ? visibleCards : messageCards;
        return sourceCards.slice(0, 6);
    }

    private collectKeywords(parts: string[]): string[] | undefined {
        const keywords = new Set<string>();

        for (const part of parts) {
            const text = normalizeText(part);
            if (!text) continue;

            const jiraKeys = text.match(/\b[A-Z][A-Z0-9]{1,9}-\d+\b/g) || [];
            jiraKeys.forEach(key => keywords.add(key));

            const mentions = text.match(/@[a-zA-Z0-9._-]+/g) || [];
            mentions.forEach(mention => keywords.add(mention));
        }

        const list = Array.from(keywords).slice(0, 8);
        return list.length > 0 ? list : undefined;
    }

    private ensureContextBubbleStyles(): void {
        if (document.getElementById('pai-context-bubble-styles')) {
            return;
        }

        const style = document.createElement('style');
        style.id = 'pai-context-bubble-styles';
        style.textContent = `
            .pai-context-bubble {
                position: fixed;
                bottom: 24px;
                right: 24px;
                width: 44px;
                height: 44px;
                border-radius: 999px;
                background: rgba(255, 255, 255, 0.96);
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                z-index: 2147483646;
                box-shadow: 0 6px 18px rgba(15, 23, 42, 0.22);
                transition: transform 0.18s ease, box-shadow 0.18s ease;
                user-select: none;
                backdrop-filter: blur(10px);
                animation: pai-context-bubble-enter 0.28s ease-out;
            }

            .pai-context-bubble:hover {
                transform: translateY(-1px) scale(1.06);
                box-shadow: 0 10px 24px rgba(15, 23, 42, 0.28);
            }

            .pai-context-bubble::after {
                content: '';
                position: absolute;
                inset: -6px;
                border-radius: inherit;
                border: 2px solid rgba(102, 126, 234, 0);
                pointer-events: none;
            }

            .pai-context-bubble--fresh::after {
                animation: pai-context-bubble-ring 1s ease-out 2;
            }

            .pai-context-bubble--fresh img {
                animation: pai-context-bubble-pulse 0.9s ease-in-out 2;
            }

            .pai-context-card {
                position: fixed;
                bottom: 76px;
                right: 24px;
                width: 320px;
                max-height: 280px;
                background: rgba(255, 255, 255, 0.98);
                border-radius: 12px;
                box-shadow: 0 16px 40px rgba(15, 23, 42, 0.22);
                padding: 16px;
                z-index: 2147483646;
                display: none;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                font-size: 13px;
                color: #333;
                overflow-y: auto;
                line-height: 1.5;
                backdrop-filter: blur(12px);
            }

            @keyframes pai-context-bubble-enter {
                from {
                    opacity: 0;
                    transform: translateY(8px) scale(0.88);
                }
                to {
                    opacity: 1;
                    transform: translateY(0) scale(1);
                }
            }

            @keyframes pai-context-bubble-pulse {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.14); }
            }

            @keyframes pai-context-bubble-ring {
                0% {
                    opacity: 0.65;
                    transform: scale(0.92);
                    border-color: rgba(102, 126, 234, 0.48);
                }
                100% {
                    opacity: 0;
                    transform: scale(1.22);
                    border-color: rgba(102, 126, 234, 0);
                }
            }
        `;

        document.head.appendChild(style);
    }

    private clearContextBubble(): void {
        if (this.outsideClickListener) {
            document.removeEventListener('click', this.outsideClickListener, true);
            this.outsideClickListener = null;
        }

        this.cardElement?.remove();
        this.bubbleElement?.remove();
        this.cardElement = null;
        this.bubbleElement = null;
        this.activeBubbleContextKey = null;
    }

    private showContextBubble(match: ContextMatchResult, contextKey: string, animate: boolean): void {
        if (this.activeBubbleContextKey === contextKey && this.bubbleElement && this.cardElement) {
            return;
        }

        this.clearContextBubble();
        this.ensureContextBubbleStyles();

        if (!document.body) {
            return;
        }

        const bubble = document.createElement('div');
        bubble.className = 'pai-context-bubble';
        if (animate) {
            bubble.classList.add('pai-context-bubble--fresh');
        }
        bubble.title = 'Related memory found';

        const iconImg = document.createElement('img');
        iconImg.src = chrome.runtime.getURL('icons/icon48.png');
        iconImg.alt = 'Related memory';
        iconImg.style.cssText = 'width: 28px; height: 28px; object-fit: contain;';
        bubble.appendChild(iconImg);

        const card = document.createElement('div');
        card.className = 'pai-context-card';

        const sourceLabel =
            match.source.startsWith('reflections/') || match.source.startsWith('reflection-threads/')
                ? 'Reflection'
                : 'Dream';

        card.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
                <span style="font-weight:600;color:#5b5bd6;">🧠 ${sourceLabel}</span>
                <span style="font-size:11px;color:#999;">score ${(match.score * 100).toFixed(0)}%</span>
            </div>
            <div style="line-height:1.5;color:#555;white-space:pre-wrap;">${escapeHtml(match.content)}</div>
            <div style="margin-top:8px;font-size:11px;color:#aaa;">${escapeHtml(match.source)}</div>
        `;

        let expanded = false;
        bubble.addEventListener('click', (event) => {
            event.stopPropagation();
            expanded = !expanded;
            card.style.display = expanded ? 'block' : 'none';
        });

        card.addEventListener('click', (event) => {
            event.stopPropagation();
        });

        this.outsideClickListener = (event: MouseEvent) => {
            const target = event.target as Node | null;
            if (!target) return;
            if (bubble.contains(target) || card.contains(target)) {
                return;
            }

            expanded = false;
            card.style.display = 'none';
        };

        document.addEventListener('click', this.outsideClickListener, true);

        document.body.appendChild(card);
        document.body.appendChild(bubble);

        this.bubbleElement = bubble;
        this.cardElement = card;
        this.activeBubbleContextKey = contextKey;

        if (animate) {
            window.setTimeout(() => {
                bubble.classList.remove('pai-context-bubble--fresh');
            }, 2200);
        }
    }

    private showNotification(result: SimpleAnalysisResult): void {
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

        window.setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);

        notification.addEventListener('click', () => {
            notification.style.transform = 'translateX(300px)';
            window.setTimeout(() => notification.remove(), 300);
        });

        window.setTimeout(() => {
            if (notification.parentNode) {
                notification.style.transform = 'translateX(300px)';
                window.setTimeout(() => notification.remove(), 300);
            }
        }, 6000);
    }
}

try {
    new WebIntelligenceContentScript();
} catch (error) {
    console.error('智能网页分析启动失败:', error);
}

console.log('🧠 智能网页分析 Content Script 已加载');
