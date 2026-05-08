/**
 * 智能网页分析 Content Script
 * 在所有网页中运行，自动分析相关内容与相关记忆提示
 */

import {
    CONTEXT_SITE_MUTE_STORAGE_KEY,
    formatRecallTimestamp,
    isContextSiteMuteActive,
    hasSensitiveUrlSignal,
    isLowValueContextHost,
    isSensitiveControlDescriptor,
    normalizeContextSiteMuteHost,
    normalizeContextPageUrl,
    pruneContextSiteMuteRecord,
    sanitizeContextExternalUrl,
    sanitizeExploreRoute,
} from './web-intelligence/contextRecallGuards';
import { startComposerGuardController } from './composer-guard/ComposerGuardController';
import { buildPassiveContextSnapshot } from './composer-guard/siteContextAdapters';
import type { SiteContextSnapshot } from './composer-guard/types';

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
    surface: 'web_passive' | 'meeting_passive';
    contextType: 'webpage' | 'message_thread' | 'jira_issue' | 'document';
    title: string;
    url: string;
    keywords?: string[];
    snippet?: string;
    entityHints?: Array<{ kind: string; value: string }>;
    sourceTypes?: string[];
}

interface ContextRecallMatch {
    id: string;
    type: 'message' | 'chunk' | 'entity';
    score: number;
    title?: string;
    snippet: string;
    sourceLabel?: string;
    sourceUrl?: string;
    sourceTitle?: string;
    exploreLink?: string;
    links: Array<{ label: string; url: string }>;
    whyMatched?: string;
    timestamp?: number;
}

function escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function escapeHtmlAttribute(text: string): string {
    return text.replace(/[&<>"']/g, (char) => {
        switch (char) {
            case '&':
                return '&amp;';
            case '<':
                return '&lt;';
            case '>':
                return '&gt;';
            case '"':
                return '&quot;';
            case '\'':
                return '&#39;';
            default:
                return char;
        }
    });
}

function normalizeText(text?: string | null): string {
    return (text || '').replace(/\s+/g, ' ').trim();
}

function isMeetingPilotPage(): boolean {
    return (
        window.location.hostname === 'v.ringcentral.com' &&
        /^\/conf\/on\/[^/?#]+/.test(window.location.pathname)
    );
}

const contextMatchCache = new Map<string, { match: ContextRecallMatch | null; ts: number }>();
const CONTEXT_MATCH_CACHE_TTL_MS = 5 * 60 * 1000;
const CONTEXT_MATCH_CACHE_MAX_ENTRIES = 80;
const DISMISSED_CONTEXT_TTL_MS = 30 * 60 * 1000;
const URL_WATCH_INTERVAL_MS = 500;
const GENERIC_CONTEXT_STABLE_MS = 250;
const RINGCENTRAL_CONTEXT_STABLE_MS = 700;
const CONTEXT_UI_EXCLUDE_SELECTOR = [
    'script',
    'style',
    'noscript',
    'nav',
    'header',
    'footer',
    'iframe',
    '.sidebar',
    '.ads',
    '.pai-context-bubble',
    '.pai-context-card',
    '.pai-context-toast',
    '#pai-context-bubble-styles',
].join(', ');

function pruneContextMatchCache(now = Date.now()): void {
    for (const [key, entry] of contextMatchCache.entries()) {
        if (now - entry.ts >= CONTEXT_MATCH_CACHE_TTL_MS) {
            contextMatchCache.delete(key);
        }
    }

    if (contextMatchCache.size <= CONTEXT_MATCH_CACHE_MAX_ENTRIES) {
        return;
    }

    const overflow = contextMatchCache.size - CONTEXT_MATCH_CACHE_MAX_ENTRIES;
    const oldestKeys = Array.from(contextMatchCache.entries())
        .sort((a, b) => a[1].ts - b[1].ts)
        .slice(0, overflow)
        .map(([key]) => key);
    oldestKeys.forEach((key) => contextMatchCache.delete(key));
}

class WebIntelligenceContentScript {
    private isAnalyzing = false;
    private lastAnalysisTime = 0;
    private analysisCount = 0;
    private readonly MIN_ANALYSIS_INTERVAL = 5000;
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
    private toastElement: HTMLDivElement | null = null;
    private toastTimer: number | null = null;
    private outsideClickListener: ((event: MouseEvent) => void) | null = null;
    private dismissedContextKeys = new Map<string, number>();
    private mutedSiteHosts = new Map<string, number>();
    private siteMutesLoaded = false;
    private siteMutesLoadPromise: Promise<void> | null = null;

    constructor() {
        this.initialize();
    }

    private initialize(): void {
        if (this.isPrivateBrowsingContext()) {
            console.log('🚫 智能网页分析: 隐身窗口中不启用网页记忆探测');
            return;
        }

        if (isMeetingPilotPage()) {
            console.log('🚫 智能网页分析: RingCentral meeting 页面由 Meeting Pilot 接管');
            return;
        }

        if (!this.shouldRunOnCurrentDomain()) {
            console.log('🚫 智能网页分析: 当前域名被跳过');
            return;
        }

        console.log('🧠 智能网页分析已启动:', window.location.href);

        startComposerGuardController();
        this.setupEventListeners();
        void this.loadSiteMutes().then(() => this.scheduleContextMatch(200));

        this.scheduleAnalysis(2000);
        this.scheduleContextMatch(2000);
    }

    private shouldRunOnCurrentDomain(): boolean {
        const domain = window.location.hostname;
        const url = window.location.href;

        if (url.startsWith('chrome-extension://') || url.startsWith('chrome://')) {
            return false;
        }

        return !isLowValueContextHost(domain);
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
                if (this.mutationMayAffectSensitiveContext(mutations)) {
                    this.handleSensitiveContextMutation();
                }

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
                subtree: true,
                attributes: true,
                attributeFilter: [
                    'type',
                    'autocomplete',
                    'name',
                    'id',
                    'aria-label',
                    'placeholder',
                    'inputmode',
                    'contenteditable',
                    'class',
                    'style',
                    'hidden',
                ],
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
            node.classList.contains('pai-context-toast') ||
            node.id === 'pai-context-bubble-styles' ||
            !!node.closest('.pai-context-bubble, .pai-context-card, .pai-context-toast')
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

    private invalidatePendingContextRequest(): void {
        this.pendingContextRequestId++;
        this.pendingContextKey = null;
    }

    private mutationMayAffectSensitiveContext(mutations: MutationRecord[]): boolean {
        return mutations.some((mutation) => {
            if (mutation.type === 'attributes') {
                const target = mutation.target instanceof HTMLElement ? mutation.target : null;
                return !!target && !this.isOwnedContextUiNode(target) && this.elementMayAffectSensitiveContext(target);
            }

            if (mutation.type !== 'childList') {
                return false;
            }

            const nodes = [...Array.from(mutation.addedNodes), ...Array.from(mutation.removedNodes)];
            return nodes.some((node) => {
                if (!(node instanceof HTMLElement)) return false;
                if (this.isOwnedContextUiNode(node)) return false;
                return this.elementMayAffectSensitiveContext(node);
            });
        });
    }

    private elementMayAffectSensitiveContext(element: HTMLElement): boolean {
        return (
            element.matches('input, textarea, [contenteditable="true"], [contenteditable]') ||
            !!element.querySelector?.('input, textarea, [contenteditable="true"], [contenteditable]')
        );
    }

    private handleSensitiveContextMutation(): void {
        if (this.isSensitiveContextPage()) {
            this.invalidatePendingContextRequest();
            this.resetContextStability();
            this.clearContextBubble();
            return;
        }

        this.scheduleContextMatch(400);
    }

    private getContextChangeDelayMs(): number {
        return this.isRingCentralMessagePage() ? 800 : 1200;
    }

    private getContextStabilityMs(): number {
        return this.isRingCentralMessagePage() ? RINGCENTRAL_CONTEXT_STABLE_MS : GENERIC_CONTEXT_STABLE_MS;
    }

    private async performAnalysis(): Promise<SimpleAnalysisResult | null> {
        if (this.isAnalyzing) return null;
        if (this.isSensitiveContextPage()) {
            console.log('🔒 当前页面处于敏感场景，跳过网页智能分析');
            return null;
        }

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
        const unwanted = clone.querySelectorAll(CONTEXT_UI_EXCLUDE_SELECTOR);
        unwanted.forEach(el => el.remove());
        return normalizeText(clone.textContent);
    }

    private getContextTextContent(element: Element | null | undefined): string {
        if (!element) return '';
        const clone = element.cloneNode(true) as Element;
        clone.querySelectorAll(CONTEXT_UI_EXCLUDE_SELECTOR).forEach(el => el.remove());
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
        if (this.isSensitiveContextPage()) {
            this.clearContextBubble();
            return;
        }

        if (!this.siteMutesLoaded) {
            void this.loadSiteMutes().then(() => {
                this.scheduleContextMatch(0);
            });
            return;
        } else if (this.isCurrentSiteMuted()) {
            this.clearContextBubble();
            return;
        }

        const payload = this.buildContextMatchPayload();
        if (!payload) {
            this.clearContextBubble();
            return;
        }

        const now = Date.now();
        pruneContextMatchCache(now);
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
        if (this.isContextDismissed(payload.contextKey)) {
            this.clearContextBubble();
            return;
        }

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
            type: 'CONTEXT_RECALL_REQUEST',
            request: {
                surface: payload.surface,
                contextType: payload.contextType,
                title: payload.title,
                url: payload.url,
                primaryText: payload.snippet,
                secondaryTexts: payload.keywords,
                entityHints: payload.entityHints,
                sourceTypes: payload.sourceTypes,
                limit: 1,
            },
        }, (response) => {
            if (requestId !== this.pendingContextRequestId) {
                return;
            }

            this.pendingContextKey = null;

            if (chrome.runtime.lastError) {
                console.warn('Context recall message error:', chrome.runtime.lastError.message);
                return;
            }

            const currentPayload = this.buildContextMatchPayload();
            if (!currentPayload || currentPayload.contextKey !== payload.contextKey) {
                return;
            }

            if (
                this.isSensitiveContextPage() ||
                this.isCurrentSiteMuted() ||
                this.isContextDismissed(payload.contextKey)
            ) {
                this.clearContextBubble();
                return;
            }

            const match = (response?.topMatch ?? null) as ContextRecallMatch | null;
            contextMatchCache.set(payload.contextKey, { match, ts: Date.now() });
            pruneContextMatchCache();

            if (match) {
                this.showContextBubble(match, payload.contextKey, true);
            } else {
                this.clearContextBubble();
            }
        });
    }

    private buildContextMatchPayload(): ContextMatchPayload | null {
        const snapshot = buildPassiveContextSnapshot(document, window.location);
        if (snapshot) {
            return {
                contextKey: snapshot.contextKey,
                stabilityKey: snapshot.contextKey,
                surface: this.toPassiveRecallSurface(snapshot),
                contextType: this.toPassiveRecallContextType(snapshot),
                title: snapshot.title,
                url: snapshot.url,
                keywords: snapshot.keywords,
                snippet: snapshot.primaryText,
                entityHints: this.toPassiveRecallEntityHints(snapshot),
                sourceTypes: snapshot.sourceTypes,
            };
        }

        return null;
    }

    private toPassiveRecallSurface(
        snapshot: SiteContextSnapshot,
    ): 'web_passive' | 'meeting_passive' {
        return snapshot.contextType === 'message_thread'
            ? 'meeting_passive'
            : 'web_passive';
    }

    private toPassiveRecallContextType(
        snapshot: SiteContextSnapshot,
    ): 'webpage' | 'message_thread' | 'jira_issue' | 'document' {
        if (snapshot.contextType === 'message_thread') {
            return 'message_thread';
        }
        if (snapshot.contextType === 'jira_issue') {
            return 'jira_issue';
        }
        return 'webpage';
    }

    private toPassiveRecallEntityHints(
        snapshot: SiteContextSnapshot,
    ): Array<{ kind: string; value: string }> | undefined {
        const hints: Array<{ kind: string; value: string }> = [];
        const identifiers = snapshot.identifiers || {};
        if (identifiers.conversationId) {
            hints.push({ kind: 'conversation_id', value: identifiers.conversationId });
        }
        if (identifiers.groupId) {
            hints.push({ kind: 'group_id', value: identifiers.groupId });
        }
        if (identifiers.threadRootPostId) {
            hints.push({ kind: 'thread_root_post_id', value: identifiers.threadRootPostId });
        }
        if (identifiers.issueKey) {
            hints.push({ kind: 'jira_issue_key', value: identifiers.issueKey });
        }
        if (identifiers.provider) {
            hints.push({ kind: 'web_agent_provider', value: identifiers.provider });
        }
        return hints.length > 0 ? hints : undefined;
    }

    private buildGenericContextPayload(): ContextMatchPayload | null {
        const contextUrl = normalizeContextPageUrl(window.location.href);
        if (!contextUrl) {
            return null;
        }

        const title = normalizeText(document.title);
        const metaKeywords = document.querySelector('meta[name="keywords"]')?.getAttribute('content');
        const mainEl = document.querySelector('main, article, [role="main"]');
        const snippet = this.getContextTextContent(mainEl || document.body).slice(0, 500);
        if (!title && !snippet) {
            return null;
        }

        const keywords = this.collectKeywords([
            ...(metaKeywords ? metaKeywords.split(',').map(k => normalizeText(k)) : []),
            title,
            snippet
        ]);
        const snippetToken = normalizeText(snippet).slice(0, 160);
        const contextKey = `page:${contextUrl}|${title}|${snippetToken}`;

        return {
            contextKey,
            stabilityKey: contextKey,
            surface: 'web_passive',
            contextType: 'webpage',
            title: title || contextUrl,
            url: contextUrl,
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
        const contextUrl = normalizeContextPageUrl(window.location.href);
        if (!contextUrl) {
            return null;
        }

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

        const messageIds = cardsForSnippet
            .map(card => card.getAttribute('data-id'))
            .filter((id): id is string => !!id);
        const selectedTabText = normalizeText(document.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.textContent);
        const snippetSignature = this.createContextSignature(snippet);
        const contextKey = `ringcentral:${conversationId}|${title}|${messageIds.slice(-3).join(',')}|${snippetSignature}`;
        const stabilityKey = contextKey;

        return {
            contextKey,
            stabilityKey,
            surface: 'meeting_passive',
            contextType: 'message_thread',
            title,
            url: contextUrl,
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
        return sourceCards.slice(-6);
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

    private createContextSignature(text: string): string {
        const compact = normalizeText(text).slice(-500);
        let hash = 0;
        for (let i = 0; i < compact.length; i++) {
            hash = ((hash << 5) - hash + compact.charCodeAt(i)) | 0;
        }
        return Math.abs(hash).toString(36);
    }

    private isSensitiveContextPage(): boolean {
        if (this.isPrivateBrowsingContext()) {
            return true;
        }

        if (hasSensitiveUrlSignal(window.location.href)) {
            return true;
        }

        return this.hasVisibleSensitiveInput();
    }

    private isPrivateBrowsingContext(): boolean {
        return !!chrome.extension?.inIncognitoContext;
    }

    private hasVisibleSensitiveInput(): boolean {
        const controls = Array.from(document.querySelectorAll<HTMLElement>('input, textarea, [contenteditable="true"]'));
        return controls.some((control) => {
            if (!this.isVisibleElement(control)) {
                return false;
            }

            return isSensitiveControlDescriptor({
                type: control.getAttribute('type'),
                autocomplete: control.getAttribute('autocomplete'),
                name: control.getAttribute('name'),
                id: control.id,
                ariaLabel: control.getAttribute('aria-label'),
                placeholder: control.getAttribute('placeholder'),
                inputMode: control.getAttribute('inputmode'),
            });
        });
    }

    private isVisibleElement(element: HTMLElement): boolean {
        const rect = element.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) {
            return false;
        }

        const style = window.getComputedStyle(element);
        return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
    }

    private loadSiteMutes(): Promise<void> {
        if (this.siteMutesLoaded) {
            return Promise.resolve();
        }
        if (this.siteMutesLoadPromise) {
            return this.siteMutesLoadPromise;
        }

        this.siteMutesLoadPromise = new Promise((resolve) => {
            try {
                let settled = false;
                const finish = (result?: Record<string, any>): void => {
                    if (settled) return;
                    settled = true;
                    const pruned = pruneContextSiteMuteRecord(
                        result?.[CONTEXT_SITE_MUTE_STORAGE_KEY],
                    );
                    this.mutedSiteHosts = new Map(Object.entries(pruned.record));
                    if (pruned.changed) {
                        this.saveSiteMutes();
                    }
                    this.siteMutesLoaded = true;
                    resolve();
                };

                const maybePromise = chrome.storage.local.get(
                    CONTEXT_SITE_MUTE_STORAGE_KEY,
                    finish,
                ) as unknown as Promise<Record<string, any>> | undefined;
                if (maybePromise && typeof maybePromise.then === 'function') {
                    maybePromise.then(finish).catch(() => finish());
                }
            } catch (_error) {
                this.siteMutesLoaded = true;
                resolve();
            }
        });

        return this.siteMutesLoadPromise;
    }

    private saveSiteMutes(): void {
        const payload: Record<string, number> = {};
        for (const [host, mutedAt] of this.mutedSiteHosts.entries()) {
            payload[host] = mutedAt;
        }

        try {
            chrome.storage.local.set({ [CONTEXT_SITE_MUTE_STORAGE_KEY]: payload });
        } catch (_error) {
            // Storage is best-effort; in-memory mute still applies until reload.
        }
    }

    private getCurrentSiteMuteHost(): string {
        return normalizeContextSiteMuteHost(window.location.hostname);
    }

    private isCurrentSiteMuted(): boolean {
        this.pruneMutedSiteHosts();
        const host = this.getCurrentSiteMuteHost();
        const mutedAt = this.mutedSiteHosts.get(host);
        return mutedAt !== undefined && isContextSiteMuteActive(mutedAt);
    }

    private muteCurrentSite(): void {
        this.mutedSiteHosts.set(this.getCurrentSiteMuteHost(), Date.now());
        this.pruneMutedSiteHosts();
        this.saveSiteMutes();
        this.clearContextBubble();
        this.showContextToast('已暂停此网站记忆提示 24 小时');
    }

    private pruneMutedSiteHosts(): void {
        const now = Date.now();
        let changed = false;
        for (const [host, mutedAt] of this.mutedSiteHosts.entries()) {
            if (!isContextSiteMuteActive(mutedAt, now)) {
                this.mutedSiteHosts.delete(host);
                changed = true;
            }
        }
        if (changed) {
            this.saveSiteMutes();
        }
    }

    private isContextDismissed(contextKey: string): boolean {
        this.pruneDismissedContextKeys();
        const dismissedAt = this.dismissedContextKeys.get(contextKey);
        return dismissedAt !== undefined && Date.now() - dismissedAt < DISMISSED_CONTEXT_TTL_MS;
    }

    private dismissContext(contextKey: string): void {
        this.dismissedContextKeys.set(contextKey, Date.now());
        this.pruneDismissedContextKeys();
        this.clearContextBubble();
        this.showContextToast('已隐藏此条记忆提示 30 分钟');
    }

    private pruneDismissedContextKeys(): void {
        const now = Date.now();
        for (const [key, dismissedAt] of this.dismissedContextKeys.entries()) {
            if (now - dismissedAt >= DISMISSED_CONTEXT_TTL_MS) {
                this.dismissedContextKeys.delete(key);
            }
        }
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
                bottom: max(16px, env(safe-area-inset-bottom));
                right: max(16px, env(safe-area-inset-right));
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
                bottom: calc(max(16px, env(safe-area-inset-bottom)) + 52px);
                right: max(16px, env(safe-area-inset-right));
                width: min(320px, calc(100vw - 32px));
                max-height: 280px;
                box-sizing: border-box;
                background: rgba(255, 255, 255, 0.98);
                border-radius: 8px;
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

            .pai-context-card a,
            .pai-context-card button {
                font: inherit;
            }

            .pai-context-card a:focus-visible,
            .pai-context-card button:focus-visible,
            .pai-context-bubble:focus-visible {
                outline: 2px solid #2563eb;
                outline-offset: 2px;
            }

            .pai-context-action-button {
                border: 1px solid #cbd5e1;
                background: #fff;
                color: #334155;
                border-radius: 6px;
                cursor: pointer;
                font-size: 11px;
                line-height: 1;
                padding: 6px 8px;
            }

            .pai-context-action-button:hover {
                background: #f8fafc;
                border-color: #94a3b8;
            }

            .pai-context-toast {
                position: fixed;
                bottom: max(16px, env(safe-area-inset-bottom));
                right: max(16px, env(safe-area-inset-right));
                max-width: min(280px, calc(100vw - 32px));
                box-sizing: border-box;
                border-radius: 8px;
                background: rgba(15, 23, 42, 0.94);
                color: #fff;
                padding: 10px 12px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                font-size: 12px;
                line-height: 1.45;
                box-shadow: 0 12px 30px rgba(15, 23, 42, 0.22);
                z-index: 2147483646;
                animation: pai-context-toast-enter 0.18s ease-out;
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

            @keyframes pai-context-toast-enter {
                from {
                    opacity: 0;
                    transform: translateY(6px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }

            @media (prefers-reduced-motion: reduce) {
                .pai-context-bubble,
                .pai-context-bubble::after,
                .pai-context-bubble--fresh::after,
                .pai-context-bubble--fresh img,
                .pai-context-toast {
                    animation: none !important;
                    transition: none !important;
                }

                .pai-context-bubble:hover {
                    transform: none !important;
                }
            }
        `;

        document.head.appendChild(style);
    }

    private clearContextToast(): void {
        if (this.toastTimer !== null) {
            window.clearTimeout(this.toastTimer);
            this.toastTimer = null;
        }

        this.toastElement?.remove();
        this.toastElement = null;
    }

    private showContextToast(message: string): void {
        this.clearContextToast();
        this.ensureContextBubbleStyles();

        if (!document.body) {
            return;
        }

        const toast = document.createElement('div');
        toast.className = 'pai-context-toast';
        toast.setAttribute('role', 'status');
        toast.textContent = message;

        document.body.appendChild(toast);
        this.toastElement = toast;
        this.toastTimer = window.setTimeout(() => {
            this.clearContextToast();
        }, 2400);
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

    private showContextBubble(match: ContextRecallMatch, contextKey: string, animate: boolean): void {
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
        bubble.title = '发现相关记忆';

        const iconImg = document.createElement('img');
        iconImg.src = chrome.runtime.getURL('icons/icon48.png');
        iconImg.alt = '相关记忆';
        iconImg.style.cssText = 'width: 28px; height: 28px; object-fit: contain;';
        bubble.appendChild(iconImg);

        const card = document.createElement('div');
        card.className = 'pai-context-card';
        card.id = `pai-context-card-${Math.random().toString(36).slice(2)}`;
        card.setAttribute('role', 'dialog');
        card.setAttribute('aria-label', '相关记忆详情');
        card.setAttribute('aria-hidden', 'true');

        const sourceLabel = match.sourceLabel || match.sourceTitle || '记忆来源';
        const titleText = match.title || sourceLabel;
        const safeExploreRoute = sanitizeExploreRoute(match.exploreLink);
        const exploreUrl = safeExploreRoute
            ? chrome.runtime.getURL(`memory-exploring.html${safeExploreRoute}`)
            : '';
        const sourceMeta = [
            sourceLabel,
            formatRecallTimestamp(match.timestamp),
            match.whyMatched
        ].filter(Boolean).join(' · ');

        const linksHtml = (match.links || [])
            .map((link) => ({
                label: link.label,
                url: sanitizeContextExternalUrl(link.url, window.location.href),
            }))
            .filter((link): link is { label: string; url: string } => !!link.url)
            .map((link) => `<a href="${escapeHtmlAttribute(link.url)}" target="_blank" rel="noopener" style="color:#2563eb;text-decoration:none;font-size:11px;margin-right:8px;">${escapeHtml(link.label)}</a>`)
            .join('');

        card.innerHTML = `
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:8px;">
                <div style="min-width:0;">
                    <div style="font-size:11px;font-weight:600;color:#475569;margin-bottom:2px;">相关记忆</div>
                    <div style="font-weight:600;color:#0f172a;overflow-wrap:anywhere;">${escapeHtml(titleText)}</div>
                </div>
                <div style="display:flex;align-items:center;gap:8px;">
                    <span style="font-size:11px;color:#64748b;white-space:nowrap;">${Math.round(match.score * 100)}%</span>
                    <button type="button" class="pai-context-dismiss" aria-label="隐藏此记忆提示" title="隐藏此记忆提示" style="border:0;background:transparent;color:#64748b;cursor:pointer;font-size:16px;line-height:1;padding:0;width:20px;height:20px;">×</button>
                </div>
            </div>
            <div style="line-height:1.5;color:#334155;white-space:pre-wrap;overflow-wrap:anywhere;">${escapeHtml(match.snippet)}</div>
            <div style="margin-top:8px;font-size:11px;color:#64748b;">${escapeHtml(sourceMeta)}</div>
            <div style="margin-top:10px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
                ${exploreUrl ? `<a href="${escapeHtmlAttribute(exploreUrl)}" target="_blank" rel="noopener" style="color:#2563eb;text-decoration:none;font-size:11px;font-weight:600;">在记忆中查看</a>` : ''}
                ${linksHtml}
                <button type="button" class="pai-context-action-button pai-context-site-mute" aria-label="此网站今天不再显示记忆提示">此网站今天不提示</button>
            </div>
        `;

        let expanded = false;
        const setExpanded = (nextExpanded: boolean): void => {
            expanded = nextExpanded;
            card.style.display = expanded ? 'block' : 'none';
            card.setAttribute('aria-hidden', String(!expanded));
            bubble.setAttribute('aria-expanded', String(expanded));
        };

        bubble.addEventListener('click', (event) => {
            event.stopPropagation();
            setExpanded(!expanded);
        });

        bubble.setAttribute('role', 'button');
        bubble.setAttribute('aria-label', '打开相关记忆提示');
        bubble.setAttribute('aria-expanded', 'false');
        bubble.setAttribute('aria-controls', card.id);
        bubble.setAttribute('aria-haspopup', 'dialog');
        bubble.tabIndex = 0;
        bubble.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                setExpanded(false);
                return;
            }

            if (event.key !== 'Enter' && event.key !== ' ') {
                return;
            }
            event.preventDefault();
            bubble.click();
        });

        card.addEventListener('click', (event) => {
            event.stopPropagation();
        });
        card.addEventListener('keydown', (event) => {
            if (event.key !== 'Escape') {
                return;
            }
            event.preventDefault();
            setExpanded(false);
            bubble.focus();
        });

        card.querySelector<HTMLButtonElement>('.pai-context-dismiss')?.addEventListener('click', (event) => {
            event.stopPropagation();
            this.dismissContext(contextKey);
        });

        card.querySelector<HTMLButtonElement>('.pai-context-site-mute')?.addEventListener('click', (event) => {
            event.stopPropagation();
            this.muteCurrentSite();
        });

        this.outsideClickListener = (event: MouseEvent) => {
            const target = event.target as Node | null;
            if (!target) return;
            if (bubble.contains(target) || card.contains(target)) {
                return;
            }

            setExpanded(false);
        };

        document.addEventListener('click', this.outsideClickListener, true);

        document.body.appendChild(bubble);
        document.body.appendChild(card);

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
                ${escapeHtml(result.reasoning.substring(0, 60))}...
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
