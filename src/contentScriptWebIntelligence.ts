/**
 * 智能网页分析 Content Script
 * 在所有网页中运行，自动分析相关内容与相关记忆提示
 */

import {
    CONTEXT_PAGE_BLOCK_STORAGE_KEY,
    CONTEXT_SITE_ALLOW_STORAGE_KEY,
    CONTEXT_SITE_ALLOWLIST_MODE_STORAGE_KEY,
    CONTEXT_SITE_BLOCK_STORAGE_KEY,
    CONTEXT_SITE_MUTE_STORAGE_KEY,
    buildContextRecallCompactMetaItems,
    buildContextRecallPeekFooterItems,
    formatContextRecallDisplayPriorityLabel,
    formatContextRecallSourceLabel,
    isContextSiteMuteActive,
    isContextHostCoveredBySiteRecord,
    isContextPageUrlBlockedByPrefix,
    hasSensitiveUrlSignal,
    isDisplayableContextRecallMatch,
    isContextSelectionTextEligible,
    isLowValueContextHost,
    isSensitiveControlDescriptor,
    normalizeContextPageBlockPrefix,
    normalizeContextSiteMuteHost,
    normalizeContextPageUrl,
    normalizeContextSelectionText,
    pruneContextPageBlockRecord,
    pruneContextSiteAllowRecord,
    pruneContextSiteBlockRecord,
    pruneContextSiteMuteRecord,
    sanitizeContextExternalUrl,
    sanitizeExploreRoute,
} from './web-intelligence/contextRecallGuards';
import { startComposerGuardController } from './composer-guard/ComposerGuardController';
import {
    buildJiraOwnerCommentLearningPayloads,
    buildPassiveContextSnapshot,
    type OwnerAuthoredLearningPayload,
} from './composer-guard/siteContextAdapters';
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
    surface: 'web_passive' | 'meeting_passive' | 'follow_thread';
    contextType: 'webpage' | 'message_thread' | 'jira_issue' | 'document' | 'selected_text';
    title: string;
    url: string;
    keywords?: string[];
    snippet?: string;
    entityHints?: Array<{ kind: string; value: string }>;
    sourceContext?: {
        contextType?: string;
        sourceType?: string;
        host?: string;
        url?: string;
        title?: string;
        participants?: string[];
        groupId?: string;
        conversationId?: string;
        messageId?: string;
        issueKey?: string;
    };
    exclude?: {
        ids?: string[];
        urls?: string[];
        groupIds?: string[];
        conversationIds?: string[];
    };
    sourceTypes?: string[];
    ownerAuthoredLearningPayloads?: OwnerAuthoredLearningPayload[];
}

interface ContextRecallMatch {
    id: string;
    type: 'message' | 'chunk' | 'entity';
    score: number;
    title?: string;
    uiSummary?: string;
    snippet: string;
    sourceLabel?: string;
    sourceUrl?: string;
    sourceTitle?: string;
    exploreLink?: string;
    links: Array<{ label: string; url: string }>;
    whyMatched?: string;
    whyRelevant?: string[];
    matchedAnchors?: {
        people?: string[];
        topics?: string[];
        projects?: string[];
        source?: string[];
    };
    suppressionReason?: string;
    reasonType?: string;
    evidenceRole?: string;
    displayPriority?: 'p1' | 'p2' | 'hidden';
    metadata?: Record<string, unknown>;
    mergedCount?: number;
    mergedIds?: string[];
    sourceClusterKey?: string;
    sourceContext?: string;
    timestamp?: number;
}

interface ContextToastAction {
    label: string;
    ariaLabel?: string;
    onClick: () => void;
}

type ContextBubbleMode = 'lens' | 'selectionSearch';

interface ContextBubbleOptions {
    mode?: ContextBubbleMode;
    selectedText?: string;
}

interface ContextMatchCacheEntry {
    match: ContextRecallMatch | null;
    matches: ContextRecallMatch[];
    ts: number;
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

function formatContextMatchStrength(match: ContextRecallMatch): string {
    return formatContextRecallDisplayPriorityLabel(match.displayPriority) || '可能相关';
}

function getContextMatchDisplayPriorityRank(match: ContextRecallMatch): number {
    switch (match.displayPriority) {
        case 'p1':
            return 2;
        case 'p2':
            return 1;
        case 'hidden':
            return -1;
        default:
            return 0;
    }
}

function selectContextRecallMatches(
    response: { matches?: ContextRecallMatch[]; topMatch?: ContextRecallMatch | null } | null | undefined,
    options: { requireStrong?: boolean } = {},
): ContextRecallMatch[] {
    const matches = Array.isArray(response?.matches) && response?.matches?.length
        ? response.matches
        : response?.topMatch
            ? [response.topMatch]
            : [];
    const displayableMatches = matches
        .filter(isDisplayableContextRecallMatch)
        .filter((match) => {
            if (!options.requireStrong) return true;
            return match.displayPriority === 'p1' && hasContextWhyRelevant(match);
        });
    if (!displayableMatches.length) return [];

    return displayableMatches.sort((left, right) => {
        const priorityDiff =
            getContextMatchDisplayPriorityRank(right) -
            getContextMatchDisplayPriorityRank(left);
        if (priorityDiff !== 0) return priorityDiff;

        const leftScore = Number.isFinite(left.score) ? left.score : 0;
        const rightScore = Number.isFinite(right.score) ? right.score : 0;
        return rightScore - leftScore;
    });
}

function hasContextWhyRelevant(match: ContextRecallMatch): boolean {
    return Array.isArray(match.whyRelevant) && match.whyRelevant.some((item) => normalizeText(item));
}

function getContextStrengthClass(match: ContextRecallMatch): string {
    if (match.displayPriority === 'p1') return 'strong';
    if (match.displayPriority === 'p2') return 'maybe';
    return 'weak';
}

function stripContextReasonNoise(value: string): string {
    return normalizeText(value)
        .replace(/\s*命中\s*(?:当前|网页|会议)?上下文\s*/g, '')
        .replace(/^向量$/, '语义相关')
        .replace(/^关键词$/, '关键词匹配')
        .trim();
}

function buildContextWhyChips(match: ContextRecallMatch): string[] {
    const chips: string[] = [];
    const add = (value?: string | null): void => {
        const normalized = stripContextReasonNoise(value || '');
        if (!normalized || chips.includes(normalized)) return;
        chips.push(normalized);
    };

    for (const item of match.whyRelevant || []) {
        add(item);
    }
    add(match.whyMatched);
    for (const item of buildContextRecallPeekFooterItems(match)) {
        add(item);
    }
    add(match.sourceTitle);
    return chips.slice(0, 3);
}

const SELECTION_SEARCH_STOPWORDS = new Set([
    'and',
    'the',
    'for',
    'with',
    'from',
    'that',
    'this',
    'you',
    'your',
    'about',
    'into',
    'owner',
    'handoff',
    'ready',
    'readiness',
    'launch',
    'using',
    'have',
    'will',
    'should',
    'codex',
    'ai',
    'rc',
    'team',
    'message',
    'meeting',
    '听说',
    '以后',
    '这样',
    '是这样',
    '是不是',
]);

const SELECTION_SEARCH_BROAD_TERMS = new Set([
    'codex',
    'ai',
    'rc',
    'ringcentral',
    'team',
    'message',
    'meeting',
]);

function extractSelectionSearchTerms(selectedText?: string | null): string[] {
    const normalized = normalizeText(selectedText).toLowerCase();
    if (!normalized) return [];

    const terms = new Set<string>();
    const addTerm = (raw: string): void => {
        const value = normalizeText(raw).toLowerCase().replace(/^[-_]+|[-_]+$/g, '');
        if (value.length >= 2 && !SELECTION_SEARCH_STOPWORDS.has(value)) {
            terms.add(value);
        }
    };

    for (const match of normalized.matchAll(/[a-z][a-z0-9_-]{2,}/g)) {
        addTerm(match[0]);
    }
    for (const match of normalized.matchAll(/[\p{Script=Han}]{2,}/gu)) {
        const value = match[0];
        addTerm(value);
        const stripped = value.replace(/(?:好了|了|吗|呢|啊|吧|么|的)$/u, '');
        if (stripped !== value) {
            addTerm(stripped);
        }
    }
    for (const match of selectedText?.matchAll(/[A-Z]+-\d+/gi) || []) {
        addTerm(match[0]);
    }
    for (const match of normalized.matchAll(/\d+(?:\.\d+)?\s*(?:万|k|m|tokens?|刀)?/gi)) {
        addTerm(match[0]);
    }

    return Array.from(terms).slice(0, 12);
}

function isSpecificSelectionSearchTerm(term: string): boolean {
    const normalized = normalizeText(term).toLowerCase();
    if (!normalized || SELECTION_SEARCH_BROAD_TERMS.has(normalized)) return false;
    if (/[a-z]+-\d+/i.test(normalized)) return true;
    if (/\d/.test(normalized)) return true;
    if (/[\p{Script=Han}]/u.test(normalized)) return normalized.length >= 2;
    return normalized.length >= 6;
}

function collectContextMatchAnchorText(match: ContextRecallMatch): string {
    const anchors = match.matchedAnchors;
    return [
        match.title,
        match.uiSummary,
        match.snippet,
        match.sourceTitle,
        match.whyMatched,
        ...(match.whyRelevant || []),
        ...(anchors?.people || []),
        ...(anchors?.topics || []),
        ...(anchors?.projects || []),
        ...(anchors?.source || []),
    ]
        .map((item) => normalizeText(item))
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
}

function getSelectionSearchMatchedTerms(
    match: ContextRecallMatch,
    selectedText?: string | null,
): string[] {
    const selected = normalizeText(selectedText).toLowerCase();
    if (!selected) return [];

    const candidateText = collectContextMatchAnchorText(match);
    const terms = extractSelectionSearchTerms(selectedText);
    const matchedTerms = terms.filter((term) => candidateText.includes(term));

    const anchorValues = [
        ...(match.matchedAnchors?.people || []),
        ...(match.matchedAnchors?.topics || []),
        ...(match.matchedAnchors?.projects || []),
    ]
        .map((item) => normalizeText(item))
        .filter(Boolean);
    for (const anchor of anchorValues) {
        const lower = anchor.toLowerCase();
        if (lower.length >= 2 && selected.includes(lower)) {
            matchedTerms.push(anchor);
        }
    }

    return Array.from(new Set(matchedTerms.map((term) => normalizeText(term)).filter(Boolean)));
}

function getSelectionSearchMatchedTerm(
    match: ContextRecallMatch,
    selectedText?: string | null,
): string {
    const matchedTerms = getSelectionSearchMatchedTerms(match, selectedText);
    return matchedTerms.find(isSpecificSelectionSearchTerm) || matchedTerms[0] || '';
}

function hasSelectionSearchConcreteMatch(
    match: ContextRecallMatch,
    selectedText?: string | null,
): boolean {
    const matchedTerms = getSelectionSearchMatchedTerms(match, selectedText);
    const specificMatches = matchedTerms.filter(isSpecificSelectionSearchTerm);
    return (
        match.displayPriority === 'p1' &&
        hasContextWhyRelevant(match) &&
        (specificMatches.length > 0 || matchedTerms.length >= 2)
    );
}

function isSelectionSearchWhyChipNoise(chip: string): boolean {
    return (
        /网页上下文|同页面|当前页面|页面背景|RingCentral 消息|语义相关|关键词匹配/.test(chip) ||
        chip === 'Web memory' ||
        chip === '记忆来源'
    );
}

function buildSelectionSearchWhyChips(
    match: ContextRecallMatch,
    selectedText?: string | null,
): string[] {
    const chips: string[] = [];
    const matchedTerm = getSelectionSearchMatchedTerm(match, selectedText);
    if (matchedTerm) {
        chips.push(`选中文本命中：${matchedTerm}`);
    }

    for (const chip of buildContextWhyChips(match)) {
        if (chips.length >= 3) break;
        if (!chip || chips.includes(chip) || isSelectionSearchWhyChipNoise(chip)) continue;
        chips.push(chip);
    }

    return chips.slice(0, 3);
}

function formatContextMatchDate(timestamp?: number): string {
    if (!timestamp || !Number.isFinite(timestamp)) return '';
    const date = new Date(timestamp > 10_000_000_000 ? timestamp : timestamp * 1000);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('zh-CN', {
        month: 'numeric',
        day: 'numeric',
    });
}

function isMeetingPilotPage(): boolean {
    return (
        window.location.hostname === 'v.ringcentral.com' &&
        /^\/conf\/on\/[^/?#]+/.test(window.location.pathname)
    );
}

const contextMatchCache = new Map<string, ContextMatchCacheEntry>();
const CONTEXT_MATCH_CACHE_TTL_MS = 5 * 60 * 1000;
const CONTEXT_MATCH_CACHE_MAX_ENTRIES = 80;
const DISMISSED_CONTEXT_TTL_MS = 30 * 60 * 1000;
const URL_WATCH_INTERVAL_MS = 500;
const GENERIC_CONTEXT_STABLE_MS = 250;
const RINGCENTRAL_CONTEXT_STABLE_MS = 700;
const CONTEXT_PEEK_SHOW_DELAY_MS = 200;
const CONTEXT_PEEK_HIDE_DELAY_MS = 160;
const SELECTED_TEXT_TRIGGER_DELAY_MS = 120;
const COMPOSER_GUARD_ROOT_SELECTOR = '#pai-composer-guard-root';
const COMPOSER_GUARD_ICON_SELECTOR =
    '#pai-composer-guard-root .pai-composer-guard-icon-button';
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
    '.pai-context-peek',
    '.pai-context-selection-trigger',
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
    private peekElement: HTMLDivElement | null = null;
    private peekShowTimer: number | null = null;
    private peekHideTimer: number | null = null;
    private selectionTriggerElement: HTMLButtonElement | null = null;
    private selectionTriggerTimer: number | null = null;
    private selectedTextPendingContextKey: string | null = null;
    private selectedTextRequestId = 0;
    private toastElement: HTMLDivElement | null = null;
    private toastTimer: number | null = null;
    private outsideClickListener: ((event: MouseEvent) => void) | null = null;
    private dismissedContextKeys = new Map<string, number>();
    private mutedSiteHosts = new Map<string, number>();
    private blockedSiteHosts = new Map<string, number>();
    private blockedPagePrefixes = new Map<string, number>();
    private allowedSiteHosts = new Map<string, number>();
    private siteAllowlistMode = false;
    private siteMutesLoaded = false;
    private siteMutesLoadPromise: Promise<void> | null = null;
    private siteBlocksLoaded = false;
    private siteBlocksLoadPromise: Promise<void> | null = null;
    private pageBlocksLoaded = false;
    private pageBlocksLoadPromise: Promise<void> | null = null;
    private siteAllowlistLoaded = false;
    private siteAllowlistLoadPromise: Promise<void> | null = null;
    private sentOwnerLearningKeys = new Set<string>();

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
        void this.loadSiteControls().then(() => this.scheduleContextMatch(200));

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

                if (this.mutationMayAffectComposerAssistAffordance(mutations)) {
                    if (this.shouldSuppressContextBubbleForComposerAssist()) {
                        this.invalidatePendingContextRequest();
                        this.clearContextBubble();
                    }
                    this.scheduleContextMatch(0);
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

        document.addEventListener('selectionchange', () => {
            this.handleSelectedTextSelectionChanged(SELECTED_TEXT_TRIGGER_DELAY_MS);
        });
        document.addEventListener('mouseup', () => {
            this.handleSelectedTextSelectionChanged(80);
        });
        document.addEventListener('keyup', (event) => {
            if (event.key === 'Escape') {
                this.clearSelectedTextTrigger();
                return;
            }
            this.handleSelectedTextSelectionChanged(80);
        });
        window.addEventListener('scroll', () => {
            this.clearSelectedTextTrigger();
        }, true);
        window.addEventListener('resize', () => {
            this.clearSelectedTextTrigger();
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
            this.invalidateSelectedTextRequest();
            this.clearContextBubble();
            this.clearSelectedTextTrigger();
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
            node.classList.contains('pai-context-peek') ||
            node.classList.contains('pai-context-selection-trigger') ||
            node.classList.contains('pai-context-toast') ||
            node.id === 'pai-context-bubble-styles' ||
            !!node.closest('.pai-context-bubble, .pai-context-card, .pai-context-peek, .pai-context-selection-trigger, .pai-context-toast')
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

    private invalidateSelectedTextRequest(): void {
        this.selectedTextRequestId++;
        this.selectedTextPendingContextKey = null;
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

    private mutationMayAffectComposerAssistAffordance(mutations: MutationRecord[]): boolean {
        if (!this.isRingCentralMessagePage()) {
            return false;
        }

        return mutations.some((mutation) => {
            const target = mutation.target instanceof HTMLElement ? mutation.target : null;
            if (target && this.isComposerAssistAffordanceNode(target)) {
                return true;
            }

            if (mutation.type !== 'childList') {
                return false;
            }

            return [...Array.from(mutation.addedNodes), ...Array.from(mutation.removedNodes)]
                .some((node) => node instanceof HTMLElement && this.isComposerAssistAffordanceNode(node));
        });
    }

    private isComposerAssistAffordanceNode(element: HTMLElement): boolean {
        return (
            element.matches?.(
                `${COMPOSER_GUARD_ROOT_SELECTOR}, .pai-composer-guard, .pai-composer-guard-icon-button`,
            ) ||
            Boolean(
                element.closest?.(
                    `${COMPOSER_GUARD_ROOT_SELECTOR}, .pai-composer-guard, .pai-composer-guard-icon-button`,
                ),
            ) ||
            Boolean(
                element.querySelector?.(
                    `${COMPOSER_GUARD_ROOT_SELECTOR}, .pai-composer-guard, .pai-composer-guard-icon-button`,
                ),
            )
        );
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
            this.invalidateSelectedTextRequest();
            this.resetContextStability();
            this.clearContextBubble();
            this.clearSelectedTextTrigger();
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

        if (!this.areSiteControlsLoaded()) {
            void this.loadSiteControls().then(() => {
                this.scheduleContextMatch(0);
            });
            return;
        } else if (
            this.isCurrentSiteMuted() ||
            this.isCurrentSiteBlocked() ||
            this.isCurrentPageBlocked() ||
            this.isCurrentSiteOutsideAllowlist()
        ) {
            this.clearContextBubble();
            return;
        }

        const payload = this.buildContextMatchPayload();
        if (!payload) {
            this.clearContextBubble();
            return;
        }

        if (this.shouldSuppressContextBubbleForComposerAssist(payload)) {
            this.invalidatePendingContextRequest();
            this.clearContextBubble();
            return;
        }

        if (this.shouldPreserveOpenSelectedTextBubble(payload)) {
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

        this.sendOwnerAuthoredLearningSignals(payload);

        const cached = contextMatchCache.get(payload.contextKey);
        if (this.isContextDismissed(payload.contextKey)) {
            this.clearContextBubble();
            return;
        }

        if (cached && now - cached.ts < CONTEXT_MATCH_CACHE_TTL_MS) {
            if (cached.match) {
                this.showContextBubble(
                    cached.matches.length ? cached.matches : [cached.match],
                    payload.contextKey,
                    this.activeBubbleContextKey !== payload.contextKey,
                );
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
                sourceContext: payload.sourceContext,
                exclude: payload.exclude,
                primaryText: payload.snippet,
                secondaryTexts: payload.keywords,
                entityHints: payload.entityHints,
                sourceTypes: payload.sourceTypes,
                limit: 3,
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

            if (this.shouldPreserveOpenSelectedTextBubble(payload)) {
                return;
            }

            if (this.shouldSuppressContextBubbleForComposerAssist(currentPayload)) {
                this.clearContextBubble();
                return;
            }

            if (
                this.isSensitiveContextPage() ||
                this.isCurrentSiteMuted() ||
                this.isCurrentSiteBlocked() ||
                this.isCurrentPageBlocked() ||
                this.isCurrentSiteOutsideAllowlist() ||
                this.isContextDismissed(payload.contextKey)
            ) {
                this.clearContextBubble();
                return;
            }

            const matches = selectContextRecallMatches(response, { requireStrong: true });
            const match = matches[0] || null;
            contextMatchCache.set(payload.contextKey, { match, matches, ts: Date.now() });
            pruneContextMatchCache();

            if (match) {
                this.showContextBubble(matches, payload.contextKey, true);
            } else {
                this.clearContextBubble();
            }
        });
    }

    private shouldPreserveOpenSelectedTextBubble(
        payload: Pick<ContextMatchPayload, 'contextKey' | 'contextType'>,
    ): boolean {
        return (
            payload.contextType !== 'selected_text' &&
            this.isSelectedTextContextKey(this.activeBubbleContextKey) &&
            this.activeBubbleContextKey !== payload.contextKey &&
            this.cardElement?.getAttribute('aria-hidden') === 'false'
        );
    }

    private isSelectedTextContextKey(contextKey: string | null | undefined): boolean {
        return Boolean(contextKey?.startsWith('selection:'));
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
                sourceContext: this.toPassiveRecallSourceContext(snapshot),
                exclude: this.toPassiveRecallExclude(snapshot),
                sourceTypes: snapshot.sourceTypes,
                ownerAuthoredLearningPayloads: buildJiraOwnerCommentLearningPayloads(snapshot),
            };
        }

        return null;
    }

    private shouldSuppressContextBubbleForComposerAssist(payload?: Pick<ContextMatchPayload, 'contextType'>): boolean {
        if (!this.isRingCentralMessagePage()) {
            return false;
        }

        if (payload && payload.contextType !== 'message_thread') {
            return false;
        }

        return this.hasVisibleComposerAssistAffordance();
    }

    private hasVisibleComposerAssistAffordance(): boolean {
        const icon = document.querySelector<HTMLElement>(COMPOSER_GUARD_ICON_SELECTOR);
        return Boolean(icon && this.isElementVisible(icon));
    }

    private isElementVisible(element: HTMLElement): boolean {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return (
            rect.width > 0 &&
            rect.height > 0 &&
            style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            style.opacity !== '0'
        );
    }

    private sendOwnerAuthoredLearningSignals(payload: ContextMatchPayload): void {
        const learningPayloads = payload.ownerAuthoredLearningPayloads || [];
        if (!learningPayloads.length) return;

        const unsentPayloads = learningPayloads.filter((item) => {
            const metadata = item.metadata || {};
            const key = [
                item.sourceType,
                metadata.issueKey,
                metadata.commentId,
                item.sourceUrl,
            ].filter(Boolean).join(':');
            if (!key || this.sentOwnerLearningKeys.has(key)) return false;
            this.sentOwnerLearningKeys.add(key);
            return true;
        });
        if (!unsentPayloads.length) return;

        chrome.runtime.sendMessage(
            {
                type: 'OWNER_AUTHORED_LEARNING_SIGNAL',
                payloads: unsentPayloads,
            },
            () => {
                if (chrome.runtime.lastError) {
                    console.warn(
                        'Owner-authored learning signal failed:',
                        chrome.runtime.lastError.message,
                    );
                }
            },
        );
    }

    private toPassiveRecallSurface(
        snapshot: SiteContextSnapshot,
    ): 'web_passive' | 'meeting_passive' | 'follow_thread' {
        return snapshot.contextType === 'message_thread'
            ? 'follow_thread'
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

    private toPassiveRecallSourceContext(
        snapshot: SiteContextSnapshot,
    ): ContextMatchPayload['sourceContext'] {
        const identifiers = snapshot.identifiers || {};
        const participants = snapshot.audience?.people?.slice(0, 8);
        return this.compactContextRecallObject({
            contextType: snapshot.contextType,
            sourceType: snapshot.surface,
            host: window.location.hostname,
            url: snapshot.url,
            title: snapshot.title,
            participants,
            groupId: identifiers.groupId,
            conversationId: identifiers.conversationId,
            messageId: identifiers.threadRootPostId,
            issueKey: identifiers.issueKey,
        });
    }

    private toPassiveRecallExclude(
        snapshot: SiteContextSnapshot,
    ): ContextMatchPayload['exclude'] {
        const identifiers = snapshot.identifiers || {};
        return this.compactContextRecallObject({
            urls: snapshot.url ? [snapshot.url] : undefined,
            groupIds: identifiers.groupId ? [identifiers.groupId] : undefined,
            conversationIds: identifiers.conversationId ? [identifiers.conversationId] : undefined,
        });
    }

    private compactContextRecallObject<T extends Record<string, unknown>>(value: T): T | undefined {
        const entries = Object.entries(value).filter(([, entry]) => {
            if (entry == null) return false;
            if (typeof entry === 'string') return entry.length > 0;
            if (Array.isArray(entry)) return entry.length > 0;
            return true;
        });
        return entries.length ? Object.fromEntries(entries) as T : undefined;
    }

    private scheduleSelectedTextTrigger(delayMs = SELECTED_TEXT_TRIGGER_DELAY_MS): void {
        if (this.selectionTriggerTimer !== null) {
            window.clearTimeout(this.selectionTriggerTimer);
        }

        this.selectionTriggerTimer = window.setTimeout(() => {
            this.selectionTriggerTimer = null;
            this.refreshSelectedTextTrigger();
        }, delayMs);
    }

    private handleSelectedTextSelectionChanged(delayMs = SELECTED_TEXT_TRIGGER_DELAY_MS): void {
        const payload = this.buildSelectedTextPayload();
        const nextContextKey = payload?.contextKey || null;
        const visibleContextKey = this.selectionTriggerElement?.dataset.contextKey || null;

        if (!nextContextKey) {
            this.clearSelectedTextTrigger();
            return;
        }

        if (visibleContextKey && visibleContextKey !== nextContextKey) {
            this.clearSelectedTextTrigger();
        }

        if (
            this.selectedTextPendingContextKey &&
            this.selectedTextPendingContextKey !== nextContextKey
        ) {
            this.invalidateSelectedTextRequest();
        }

        if (
            this.isSelectedTextContextKey(this.activeBubbleContextKey) &&
            this.activeBubbleContextKey !== nextContextKey
        ) {
            this.clearContextBubble();
        }

        this.scheduleSelectedTextTrigger(delayMs);
    }

    private refreshSelectedTextTrigger(): void {
        const payload = this.buildSelectedTextPayload();
        if (!payload) {
            this.clearSelectedTextTrigger();
            return;
        }

        const existingKey = this.selectionTriggerElement?.dataset.contextKey;
        if (existingKey === payload.contextKey) {
            this.placeSelectedTextTrigger(this.selectionTriggerElement, payload.rect);
            return;
        }

        if (this.selectedTextPendingContextKey === payload.contextKey) {
            return;
        }

        this.clearSelectedTextTrigger();
        this.requestSelectedTextTrigger(payload);
    }

    private buildSelectedTextPayload(): (ContextMatchPayload & { rect: DOMRect }) | null {
        if (this.isSensitiveContextPage()) {
            return null;
        }

        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
            return null;
        }
        if (this.selectionTouchesEditable(selection)) {
            return null;
        }
        if (this.selectionTouchesContextUi(selection)) {
            return null;
        }

        const selectedText = normalizeContextSelectionText(selection.toString());
        if (!isContextSelectionTextEligible(selectedText)) {
            return null;
        }

        const range = selection.getRangeAt(0);
        const rect = this.getSelectionRect(range);
        if (!rect) {
            return null;
        }

        const snapshot = buildPassiveContextSnapshot(document, window.location);
        const contextUrl = normalizeContextPageUrl(snapshot?.url || window.location.href);
        if (!contextUrl) {
            return null;
        }

        const nearbyText = this.getSelectionNearbyText(range);
        const title = normalizeText(snapshot?.title) || normalizeText(document.title) || '选中文本';
        const identifiers = snapshot?.identifiers || {};
        const participants = snapshot?.audience?.people?.slice(0, 8);
        const contextKey = [
            'selection',
            contextUrl,
            this.createContextSignature(`${title}:${selectedText}`),
        ].join(':');

        return {
            contextKey,
            stabilityKey: contextKey,
            surface: 'web_passive',
            contextType: 'selected_text',
            title,
            url: contextUrl,
            keywords: [title, nearbyText].filter(Boolean),
            snippet: selectedText.slice(0, 500),
            entityHints: snapshot ? this.toPassiveRecallEntityHints(snapshot) : undefined,
            sourceTypes: snapshot?.sourceTypes,
            sourceContext: this.compactContextRecallObject({
                contextType: 'selected_text',
                sourceType: 'selection',
                host: window.location.hostname,
                url: contextUrl,
                title,
                participants,
                groupId: identifiers.groupId,
                conversationId: identifiers.conversationId,
                messageId: identifiers.threadRootPostId,
                issueKey: identifiers.issueKey,
            }),
            exclude: this.compactContextRecallObject({
                urls: [contextUrl],
            }),
            rect,
        };
    }

    private selectionTouchesEditable(selection: Selection): boolean {
        const nodes = [selection.anchorNode, selection.focusNode].filter(Boolean);
        return nodes.some((node) => {
            const element = node instanceof Element ? node : node?.parentElement;
            return !!element?.closest('input, textarea, [contenteditable="true"], [contenteditable]');
        });
    }

    private selectionTouchesContextUi(selection: Selection): boolean {
        const nodes = [selection.anchorNode, selection.focusNode].filter(Boolean);
        return nodes.some((node) => {
            const element = node instanceof Element ? node : node?.parentElement;
            return !!element?.closest('.pai-context-bubble, .pai-context-card, .pai-context-peek, .pai-context-selection-trigger, .pai-context-toast');
        });
    }

    private getSelectionRect(range: Range): DOMRect | null {
        const rects = Array.from(range.getClientRects()).filter(
            (rect) => rect.width > 0 && rect.height > 0,
        );
        const rect = rects[0] || range.getBoundingClientRect();
        if (!rect || rect.width <= 0 || rect.height <= 0) {
            return null;
        }
        return rect;
    }

    private getSelectionNearbyText(range: Range): string {
        const container = range.commonAncestorContainer instanceof Element
            ? range.commonAncestorContainer
            : range.commonAncestorContainer.parentElement;
        const scoped = container?.closest('p, li, article, section, main, [role="main"]') || container;
        return normalizeText(scoped?.textContent || '').slice(0, 500);
    }

    private clearSelectedTextTrigger(): void {
        this.invalidateSelectedTextRequest();
        if (this.selectionTriggerTimer !== null) {
            window.clearTimeout(this.selectionTriggerTimer);
            this.selectionTriggerTimer = null;
        }
        this.selectionTriggerElement?.remove();
        this.selectionTriggerElement = null;
    }

    private showSelectedTextTrigger(
        payload: ContextMatchPayload & { rect: DOMRect },
        matches: ContextRecallMatch[],
    ): void {
        this.ensureContextBubbleStyles();
        if (!document.body) {
            return;
        }

        const existingKey = this.selectionTriggerElement?.dataset.contextKey;
        if (existingKey === payload.contextKey) {
            this.placeSelectedTextTrigger(this.selectionTriggerElement, payload.rect);
            return;
        }

        this.clearSelectedTextTrigger();
        const trigger = document.createElement('button');
        trigger.type = 'button';
        trigger.className = 'pai-context-selection-trigger';
        trigger.dataset.contextKey = payload.contextKey;
        trigger.setAttribute('aria-label', '用 Personal AI 查找关联记忆');
        trigger.title = '用 Personal AI 查找关联记忆';

        const iconImg = document.createElement('img');
        iconImg.src = chrome.runtime.getURL('icons/icon48.png');
        iconImg.alt = '';
        iconImg.setAttribute('aria-hidden', 'true');
        trigger.appendChild(iconImg);

        trigger.addEventListener('mousedown', (event) => {
            event.preventDefault();
            event.stopPropagation();
        });
        trigger.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            this.clearSelectedTextTrigger();
            if (
                normalizeContextPageUrl(window.location.href) !== payload.url ||
                this.isSensitiveContextPage() ||
                this.isContextDismissed(payload.contextKey)
            ) {
                return;
            }
            this.showContextBubble(matches, payload.contextKey, true, true, {
                mode: 'selectionSearch',
                selectedText: payload.snippet,
            });
        });

        document.body.appendChild(trigger);
        this.selectionTriggerElement = trigger;
        this.placeSelectedTextTrigger(trigger, payload.rect);
    }

    private placeSelectedTextTrigger(trigger: HTMLElement, rect: DOMRect): void {
        const size = 28;
        const gap = 6;
        const left = Math.max(
            8,
            Math.min(window.innerWidth - size - 8, rect.right + gap),
        );
        const top = Math.max(
            8,
            Math.min(window.innerHeight - size - 8, rect.top - 2),
        );
        trigger.style.left = `${Math.round(left)}px`;
        trigger.style.top = `${Math.round(top)}px`;
    }

    private requestSelectedTextTrigger(payload: ContextMatchPayload & { rect: DOMRect }): void {
        const requestId = ++this.selectedTextRequestId;
        this.selectedTextPendingContextKey = payload.contextKey;
        chrome.runtime.sendMessage({
            type: 'CONTEXT_RECALL_REQUEST',
            request: {
                surface: payload.surface,
                contextType: payload.contextType,
                title: payload.title,
                url: payload.url,
                sourceContext: payload.sourceContext,
                exclude: payload.exclude,
                primaryText: payload.snippet,
                secondaryTexts: payload.keywords,
                entityHints: payload.entityHints,
                sourceTypes: payload.sourceTypes,
                limit: 3,
            },
        }, (response) => {
            if (requestId !== this.selectedTextRequestId) {
                return;
            }
            this.selectedTextPendingContextKey = null;
            if (chrome.runtime.lastError) {
                console.warn('Selected text context recall failed:', chrome.runtime.lastError.message);
                return;
            }

            const currentUrl = normalizeContextPageUrl(window.location.href);
            if (
                currentUrl !== payload.url ||
                this.isSensitiveContextPage() ||
                this.isContextDismissed(payload.contextKey)
            ) {
                this.clearContextBubble();
                this.clearSelectedTextTrigger();
                return;
            }

            const currentPayload = this.buildSelectedTextPayload();
            if (!currentPayload || currentPayload.contextKey !== payload.contextKey) {
                this.clearSelectedTextTrigger();
                return;
            }

            const matches = selectContextRecallMatches(response, { requireStrong: true })
                .filter((candidate) => hasSelectionSearchConcreteMatch(candidate, payload.snippet));
            const match = matches[0] || null;
            if (!match) {
                this.clearSelectedTextTrigger();
                return;
            }
            this.showSelectedTextTrigger(currentPayload, matches);
        });
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
            /^\/(?:l\/)?messages\/[^/?#]+/.test(window.location.pathname)
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
            surface: 'follow_thread',
            contextType: 'message_thread',
            title,
            url: contextUrl,
            keywords: this.collectKeywords([title, selectedTabText, snippet]),
            snippet,
            sourceContext: {
                contextType: 'message_thread',
                sourceType: 'ringcentral_message',
                host: window.location.hostname,
                url: contextUrl,
                title,
                groupId: conversationId,
                conversationId,
            },
            exclude: {
                urls: [contextUrl],
                groupIds: [conversationId],
                conversationIds: [conversationId],
            },
            sourceTypes: ['glip', 'manual', 'markdown', 'web', 'jira', 'system'],
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

    private areSiteControlsLoaded(): boolean {
        return (
            this.siteMutesLoaded &&
            this.siteBlocksLoaded &&
            this.pageBlocksLoaded &&
            this.siteAllowlistLoaded
        );
    }

    private loadSiteControls(): Promise<void> {
        return Promise.all([
            this.loadSiteMutes(),
            this.loadSiteBlocks(),
            this.loadPageBlocks(),
            this.loadSiteAllowlist(),
        ]).then(() => undefined);
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

    private loadSiteBlocks(): Promise<void> {
        if (this.siteBlocksLoaded) {
            return Promise.resolve();
        }
        if (this.siteBlocksLoadPromise) {
            return this.siteBlocksLoadPromise;
        }

        this.siteBlocksLoadPromise = new Promise((resolve) => {
            try {
                let settled = false;
                const finish = (result?: Record<string, any>): void => {
                    if (settled) return;
                    settled = true;
                    const pruned = pruneContextSiteBlockRecord(
                        result?.[CONTEXT_SITE_BLOCK_STORAGE_KEY],
                    );
                    this.blockedSiteHosts = new Map(Object.entries(pruned.record));
                    if (pruned.changed) {
                        this.saveSiteBlocks();
                    }
                    this.siteBlocksLoaded = true;
                    resolve();
                };

                const maybePromise = chrome.storage.local.get(
                    CONTEXT_SITE_BLOCK_STORAGE_KEY,
                    finish,
                ) as unknown as Promise<Record<string, any>> | undefined;
                if (maybePromise && typeof maybePromise.then === 'function') {
                    maybePromise.then(finish).catch(() => finish());
                }
            } catch (_error) {
                this.siteBlocksLoaded = true;
                resolve();
            }
        });

        return this.siteBlocksLoadPromise;
    }

    private loadPageBlocks(): Promise<void> {
        if (this.pageBlocksLoaded) {
            return Promise.resolve();
        }
        if (this.pageBlocksLoadPromise) {
            return this.pageBlocksLoadPromise;
        }

        this.pageBlocksLoadPromise = new Promise((resolve) => {
            try {
                let settled = false;
                const finish = (result?: Record<string, any>): void => {
                    if (settled) return;
                    settled = true;
                    const pruned = pruneContextPageBlockRecord(
                        result?.[CONTEXT_PAGE_BLOCK_STORAGE_KEY],
                    );
                    this.blockedPagePrefixes = new Map(Object.entries(pruned.record));
                    if (pruned.changed) {
                        this.savePageBlocks();
                    }
                    this.pageBlocksLoaded = true;
                    resolve();
                };

                const maybePromise = chrome.storage.local.get(
                    CONTEXT_PAGE_BLOCK_STORAGE_KEY,
                    finish,
                ) as unknown as Promise<Record<string, any>> | undefined;
                if (maybePromise && typeof maybePromise.then === 'function') {
                    maybePromise.then(finish).catch(() => finish());
                }
            } catch (_error) {
                this.pageBlocksLoaded = true;
                resolve();
            }
        });

        return this.pageBlocksLoadPromise;
    }

    private loadSiteAllowlist(): Promise<void> {
        if (this.siteAllowlistLoaded) {
            return Promise.resolve();
        }
        if (this.siteAllowlistLoadPromise) {
            return this.siteAllowlistLoadPromise;
        }

        this.siteAllowlistLoadPromise = new Promise((resolve) => {
            try {
                let settled = false;
                const finish = (result?: Record<string, any>): void => {
                    if (settled) return;
                    settled = true;
                    const pruned = pruneContextSiteAllowRecord(
                        result?.[CONTEXT_SITE_ALLOW_STORAGE_KEY],
                    );
                    this.allowedSiteHosts = new Map(Object.entries(pruned.record));
                    this.siteAllowlistMode = result?.[CONTEXT_SITE_ALLOWLIST_MODE_STORAGE_KEY] === true;
                    if (pruned.changed) {
                        this.saveSiteAllowlist();
                    }
                    this.siteAllowlistLoaded = true;
                    resolve();
                };

                const maybePromise = chrome.storage.local.get(
                    [
                        CONTEXT_SITE_ALLOW_STORAGE_KEY,
                        CONTEXT_SITE_ALLOWLIST_MODE_STORAGE_KEY,
                    ],
                    finish,
                ) as unknown as Promise<Record<string, any>> | undefined;
                if (maybePromise && typeof maybePromise.then === 'function') {
                    maybePromise.then(finish).catch(() => finish());
                }
            } catch (_error) {
                this.siteAllowlistLoaded = true;
                resolve();
            }
        });

        return this.siteAllowlistLoadPromise;
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

    private saveSiteBlocks(): void {
        const payload: Record<string, number> = {};
        for (const [host, blockedAt] of this.blockedSiteHosts.entries()) {
            payload[host] = blockedAt;
        }

        try {
            chrome.storage.local.set({ [CONTEXT_SITE_BLOCK_STORAGE_KEY]: payload });
        } catch (_error) {
            // Storage is best-effort; in-memory block still applies until reload.
        }
    }

    private savePageBlocks(): void {
        const payload: Record<string, number> = {};
        for (const [prefix, blockedAt] of this.blockedPagePrefixes.entries()) {
            payload[prefix] = blockedAt;
        }

        try {
            chrome.storage.local.set({ [CONTEXT_PAGE_BLOCK_STORAGE_KEY]: payload });
        } catch (_error) {
            // Storage is best-effort; in-memory block still applies until reload.
        }
    }

    private saveSiteAllowlist(): void {
        const payload: Record<string, number> = {};
        for (const [host, allowedAt] of this.allowedSiteHosts.entries()) {
            payload[host] = allowedAt;
        }

        try {
            chrome.storage.local.set({
                [CONTEXT_SITE_ALLOW_STORAGE_KEY]: payload,
                [CONTEXT_SITE_ALLOWLIST_MODE_STORAGE_KEY]: this.siteAllowlistMode,
            });
        } catch (_error) {
            // Storage is best-effort; in-memory allowlist still applies until reload.
        }
    }

    private getCurrentSiteMuteHost(): string {
        return normalizeContextSiteMuteHost(window.location.hostname);
    }

    private isCurrentSiteMuted(): boolean {
        this.pruneMutedSiteHosts();
        const host = this.getCurrentSiteMuteHost();
        const payload: Record<string, number> = {};
        for (const [mutedHost, mutedAt] of this.mutedSiteHosts.entries()) {
            if (isContextSiteMuteActive(mutedAt)) {
                payload[mutedHost] = mutedAt;
            }
        }
        return isContextHostCoveredBySiteRecord(host, payload);
    }

    private isCurrentSiteBlocked(): boolean {
        const host = this.getCurrentSiteMuteHost();
        const payload: Record<string, number> = {};
        for (const [blockedHost, blockedAt] of this.blockedSiteHosts.entries()) {
            payload[blockedHost] = blockedAt;
        }
        return isContextHostCoveredBySiteRecord(host, payload);
    }

    private isCurrentPageBlocked(): boolean {
        const payload: Record<string, number> = {};
        for (const [prefix, blockedAt] of this.blockedPagePrefixes.entries()) {
            payload[prefix] = blockedAt;
        }
        return isContextPageUrlBlockedByPrefix(window.location.href, payload);
    }

    private isCurrentSiteOutsideAllowlist(): boolean {
        if (!this.siteAllowlistMode) {
            return false;
        }

        const host = this.getCurrentSiteMuteHost();
        const payload: Record<string, number> = {};
        for (const [allowedHost, allowedAt] of this.allowedSiteHosts.entries()) {
            payload[allowedHost] = allowedAt;
        }
        return !isContextHostCoveredBySiteRecord(host, payload);
    }

    private muteCurrentSite(): void {
        const host = this.getCurrentSiteMuteHost();
        const previousMutedAt = this.mutedSiteHosts.get(host);
        const hadPreviousMute = previousMutedAt !== undefined;

        this.mutedSiteHosts.set(host, Date.now());
        this.pruneMutedSiteHosts();
        this.saveSiteMutes();
        this.clearContextBubble();
        this.showContextToast('已暂停此网站记忆提示 24 小时', {
            label: '撤销',
            ariaLabel: '撤销此网站今天不提示',
            onClick: () => {
                if (hadPreviousMute && previousMutedAt !== undefined) {
                    this.mutedSiteHosts.set(host, previousMutedAt);
                } else {
                    this.mutedSiteHosts.delete(host);
                }
                this.saveSiteMutes();
                this.showContextToast('已恢复此网站记忆提示');
                this.scheduleContextMatch(0);
            },
        });
    }

    private blockCurrentSite(): void {
        const host = this.getCurrentSiteMuteHost();
        const previousBlockedAt = this.blockedSiteHosts.get(host);
        const hadPreviousBlock = previousBlockedAt !== undefined;
        const previousMutedAt = this.mutedSiteHosts.get(host);
        const hadPreviousMute = previousMutedAt !== undefined;

        this.blockedSiteHosts.set(host, Date.now());
        this.mutedSiteHosts.delete(host);
        this.saveSiteBlocks();
        this.saveSiteMutes();
        this.clearContextBubble();
        this.showContextToast('已永久关闭此网站记忆提示', {
            label: '撤销',
            ariaLabel: '撤销永久不提示此站点',
            onClick: () => {
                if (hadPreviousBlock && previousBlockedAt !== undefined) {
                    this.blockedSiteHosts.set(host, previousBlockedAt);
                } else {
                    this.blockedSiteHosts.delete(host);
                }
                if (hadPreviousMute && previousMutedAt !== undefined) {
                    this.mutedSiteHosts.set(host, previousMutedAt);
                } else {
                    this.mutedSiteHosts.delete(host);
                }
                this.saveSiteBlocks();
                this.saveSiteMutes();
                this.showContextToast('已恢复此网站记忆提示');
                this.scheduleContextMatch(0);
            },
        });
    }

    private blockCurrentPage(): void {
        const prefix = normalizeContextPageBlockPrefix(window.location.href);
        if (!prefix) {
            this.showContextToast('此页面地址无法添加路径屏蔽');
            return;
        }

        const previousBlockedAt = this.blockedPagePrefixes.get(prefix);
        const hadPreviousBlock = previousBlockedAt !== undefined;

        this.blockedPagePrefixes.set(prefix, Date.now());
        this.savePageBlocks();
        this.clearContextBubble();
        this.showContextToast('已永久关闭此页面路径记忆提示', {
            label: '撤销',
            ariaLabel: '撤销此页面路径不提示',
            onClick: () => {
                if (hadPreviousBlock && previousBlockedAt !== undefined) {
                    this.blockedPagePrefixes.set(prefix, previousBlockedAt);
                } else {
                    this.blockedPagePrefixes.delete(prefix);
                }
                this.savePageBlocks();
                this.showContextToast('已恢复此页面路径记忆提示');
                this.scheduleContextMatch(0);
            },
        });
    }

    private allowCurrentSiteAndEnableAllowlist(): void {
        const host = this.getCurrentSiteMuteHost();
        if (!host) {
            this.showContextToast('此网站地址无法加入允许列表');
            return;
        }

        const previousAllowlistMode = this.siteAllowlistMode;
        const previousAllowedAt = this.allowedSiteHosts.get(host);
        const hadPreviousAllow = previousAllowedAt !== undefined;
        const previousBlockedAt = this.blockedSiteHosts.get(host);
        const hadPreviousBlock = previousBlockedAt !== undefined;
        const previousMutedAt = this.mutedSiteHosts.get(host);
        const hadPreviousMute = previousMutedAt !== undefined;

        this.allowedSiteHosts.set(host, Date.now());
        this.siteAllowlistMode = true;
        this.blockedSiteHosts.delete(host);
        this.mutedSiteHosts.delete(host);
        this.saveSiteAllowlist();
        this.saveSiteBlocks();
        this.saveSiteMutes();
        this.showContextToast('已开启白名单并允许此网站', {
            label: '撤销',
            ariaLabel: '撤销此站点白名单快捷设置',
            onClick: () => {
                this.siteAllowlistMode = previousAllowlistMode;
                if (hadPreviousAllow && previousAllowedAt !== undefined) {
                    this.allowedSiteHosts.set(host, previousAllowedAt);
                } else {
                    this.allowedSiteHosts.delete(host);
                }
                if (hadPreviousBlock && previousBlockedAt !== undefined) {
                    this.blockedSiteHosts.set(host, previousBlockedAt);
                } else {
                    this.blockedSiteHosts.delete(host);
                }
                if (hadPreviousMute && previousMutedAt !== undefined) {
                    this.mutedSiteHosts.set(host, previousMutedAt);
                } else {
                    this.mutedSiteHosts.delete(host);
                }
                this.saveSiteAllowlist();
                this.saveSiteBlocks();
                this.saveSiteMutes();
                this.showContextToast('已恢复白名单设置');
                this.scheduleContextMatch(0);
            },
        });
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
        const previousDismissedAt = this.dismissedContextKeys.get(contextKey);
        const hadPreviousDismissal = previousDismissedAt !== undefined;
        const previousCachedMatch = contextMatchCache.get(contextKey);

        this.dismissedContextKeys.set(contextKey, Date.now());
        this.pruneDismissedContextKeys();
        contextMatchCache.set(contextKey, { match: null, matches: [], ts: Date.now() });
        pruneContextMatchCache();
        this.clearContextBubble();
        this.showContextToast('已隐藏此条记忆提示 30 分钟', {
            label: '撤销',
            ariaLabel: '撤销隐藏此条记忆提示',
            onClick: () => {
                if (hadPreviousDismissal && previousDismissedAt !== undefined) {
                    this.dismissedContextKeys.set(contextKey, previousDismissedAt);
                } else {
                    this.dismissedContextKeys.delete(contextKey);
                }
                if (previousCachedMatch) {
                    contextMatchCache.set(contextKey, previousCachedMatch);
                } else {
                    contextMatchCache.delete(contextKey);
                }
                this.showContextToast('已恢复此条记忆提示');
                this.scheduleContextMatch(0);
            },
        });
    }

    private markContextMatchIrrelevant(match: ContextRecallMatch, contextKey: string): void {
        this.dismissedContextKeys.set(contextKey, Date.now());
        this.pruneDismissedContextKeys();
        contextMatchCache.set(contextKey, { match: null, matches: [], ts: Date.now() });
        pruneContextMatchCache();
        this.clearContextBubble();
        this.showContextToast('已记录为不相关，后续会减少类似提示');

        this.submitContextRecallFeedback(match, 'negative');
    }

    private markContextMatchRelevant(match: ContextRecallMatch): void {
        this.showContextToast('已记录为有用，后续会优先保留类似提示');
        this.submitContextRecallFeedback(match, 'positive');
    }

    private submitContextRecallFeedback(
        match: ContextRecallMatch,
        action: 'positive' | 'negative',
    ): void {
        chrome.runtime.sendMessage(
            {
                type: 'CONTEXT_RECALL_FEEDBACK',
                feedback: {
                    type: 'recall_quality',
                    targetId: String(match.id || ''),
                    targetType: match.type,
                    action,
                    detail: `web_passive_bubble:${this.getCurrentSiteMuteHost()}`,
                },
            },
            (response) => {
                if (chrome.runtime.lastError) {
                    console.warn(
                        'Context recall feedback failed:',
                        chrome.runtime.lastError.message,
                    );
                    return;
                }
                if (response?.success === false) {
                    console.warn('Context recall feedback rejected:', response.error);
                }
            },
        );
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
                border: 1px solid rgba(234, 88, 12, 0.16);
                background:
                    radial-gradient(circle at 32% 24%, rgba(255, 255, 255, 0.96) 0 30%, rgba(250, 245, 235, 0.96) 68%),
                    #fff7ed;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                z-index: 2147483646;
                box-shadow:
                    0 10px 28px rgba(48, 24, 13, 0.18),
                    0 0 0 4px rgba(248, 113, 113, 0.08);
                transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
                user-select: none;
                backdrop-filter: blur(10px);
                animation: pai-context-bubble-enter 0.28s ease-out;
            }

            .pai-context-bubble img {
                width: 30px;
                height: 30px;
                object-fit: contain;
                pointer-events: none;
            }

            .pai-context-bubble:hover {
                transform: translateY(-1px) scale(1.06);
                border-color: rgba(234, 88, 12, 0.32);
                box-shadow:
                    0 14px 34px rgba(48, 24, 13, 0.24),
                    0 0 0 5px rgba(248, 113, 113, 0.12);
            }

            .pai-context-bubble::after {
                content: '';
                position: absolute;
                top: 2px;
                right: 2px;
                width: 8px;
                height: 8px;
                border-radius: 999px;
                background: #ef4444;
                border: 2px solid #fffaf0;
                box-shadow: 0 1px 4px rgba(239, 68, 68, 0.42);
                pointer-events: none;
            }

            .pai-context-bubble::before {
                content: '';
                position: absolute;
                inset: -6px;
                border-radius: inherit;
                border: 2px solid rgba(239, 68, 68, 0);
                pointer-events: none;
            }

            .pai-context-bubble--fresh::before {
                animation: pai-context-bubble-ring 1s ease-out 2;
            }

            .pai-context-bubble--fresh img {
                animation: pai-context-bubble-pulse 0.9s ease-in-out 2;
            }

            .pai-sr-only {
                position: absolute;
                width: 1px;
                height: 1px;
                padding: 0;
                margin: -1px;
                overflow: hidden;
                clip: rect(0, 0, 0, 0);
                white-space: nowrap;
                border: 0;
            }

            .pai-context-peek {
                position: fixed;
                bottom: calc(max(16px, env(safe-area-inset-bottom)) + 52px);
                right: max(16px, env(safe-area-inset-right));
                width: min(328px, calc(100vw - 32px));
                box-sizing: border-box;
                background: rgba(255, 252, 246, 0.98);
                border: 1px solid rgba(222, 204, 178, 0.92);
                border-radius: 14px;
                box-shadow: 0 18px 44px rgba(52, 32, 19, 0.22);
                padding: 12px 14px 13px;
                z-index: 2147483646;
                opacity: 0;
                transform: translateY(4px);
                transition: opacity 0.16s ease, transform 0.16s ease;
                pointer-events: none;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                color: #0f172a;
                line-height: 1.35;
                backdrop-filter: blur(12px);
            }

            .pai-context-peek::after {
                content: '';
                position: absolute;
                right: 16px;
                bottom: -7px;
                width: 14px;
                height: 14px;
                background: rgba(255, 252, 246, 0.98);
                border-right: 1px solid rgba(222, 204, 178, 0.92);
                border-bottom: 1px solid rgba(222, 204, 178, 0.92);
                transform: rotate(45deg);
            }

            .pai-context-peek--visible {
                opacity: 1;
                transform: translateY(0);
            }

            .pai-context-peek-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 10px;
                font-size: 11px;
                font-weight: 700;
                color: #69503d;
                margin-bottom: 7px;
            }

            .pai-context-relevance {
                border-radius: 999px;
                padding: 2px 7px;
                font-size: 11px;
                font-weight: 700;
                white-space: nowrap;
            }

            .pai-context-relevance--strong {
                color: #0f766e;
                background: rgba(20, 184, 166, 0.12);
            }

            .pai-context-relevance--maybe {
                color: #4f46e5;
                background: rgba(99, 102, 241, 0.12);
            }

            .pai-context-relevance--weak {
                color: #8a4b2a;
                background: rgba(234, 179, 8, 0.14);
            }

            .pai-context-why-row {
                display: flex;
                align-items: center;
                gap: 6px;
                min-width: 0;
                flex-wrap: wrap;
                margin-bottom: 8px;
            }

            .pai-context-why-label {
                color: #8a6b52;
                font-size: 11px;
                font-weight: 700;
            }

            .pai-context-chip {
                min-width: 0;
                max-width: 100%;
                border-radius: 999px;
                background: rgba(45, 112, 100, 0.1);
                color: #255f55;
                border: 1px solid rgba(45, 112, 100, 0.16);
                padding: 2px 7px;
                font-size: 11px;
                line-height: 1.35;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .pai-context-peek-title {
                font-size: 14px;
                font-weight: 720;
                color: #172033;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .pai-context-peek-summary {
                margin-top: 5px;
                font-size: 12px;
                color: #4b5b72;
                display: -webkit-box;
                -webkit-line-clamp: 2;
                -webkit-box-orient: vertical;
                overflow: hidden;
                overflow-wrap: anywhere;
            }

            .pai-context-peek-footer {
                margin-top: 7px;
                font-size: 11px;
                color: #7a6654;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .pai-context-card {
                position: fixed;
                bottom: calc(max(16px, env(safe-area-inset-bottom)) + 52px);
                right: max(16px, env(safe-area-inset-right));
                width: min(382px, calc(100vw - 32px));
                max-height: min(520px, calc(100vh - 104px));
                box-sizing: border-box;
                background: rgba(255, 252, 246, 0.99);
                border: 1px solid rgba(222, 204, 178, 0.95);
                border-radius: 16px;
                box-shadow: 0 22px 56px rgba(52, 32, 19, 0.24);
                padding: 14px;
                z-index: 2147483646;
                display: none;
                flex-direction: column;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                font-size: 13px;
                color: #172033;
                overflow: visible;
                line-height: 1.5;
                backdrop-filter: blur(12px);
            }

            .pai-context-card::after {
                content: '';
                position: absolute;
                right: 17px;
                bottom: -8px;
                width: 16px;
                height: 16px;
                background: rgba(255, 252, 246, 0.99);
                border-right: 1px solid rgba(222, 204, 178, 0.95);
                border-bottom: 1px solid rgba(222, 204, 178, 0.95);
                transform: rotate(45deg);
            }

            .pai-context-card-scroll {
                flex: 1 1 auto;
                min-height: 0;
                overflow-y: auto;
                padding-right: 2px;
            }

            .pai-context-selection-trigger {
                position: fixed;
                width: 28px;
                height: 28px;
                border-radius: 999px;
                border: 1px solid rgba(203, 213, 225, 0.9);
                background: rgba(255, 255, 255, 0.98);
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 0;
                cursor: pointer;
                z-index: 2147483646;
                box-shadow: 0 8px 20px rgba(15, 23, 42, 0.22);
                backdrop-filter: blur(10px);
            }

            .pai-context-selection-trigger img {
                width: 20px;
                height: 20px;
                object-fit: contain;
                pointer-events: none;
            }

            .pai-context-selection-trigger:hover,
            .pai-context-selection-trigger:focus-visible {
                transform: translateY(-1px) scale(1.04);
                box-shadow: 0 10px 24px rgba(15, 23, 42, 0.26);
            }

            .pai-context-card a,
            .pai-context-card button {
                font: inherit;
            }

            .pai-context-card a:focus-visible,
            .pai-context-card button:focus-visible,
            .pai-context-selection-trigger:focus-visible,
            .pai-context-bubble:focus-visible {
                outline: 2px solid #2563eb;
                outline-offset: 2px;
            }

            .pai-context-head {
                display: flex;
                align-items: flex-start;
                justify-content: space-between;
                gap: 12px;
                margin-bottom: 10px;
            }

            .pai-context-brand {
                display: flex;
                align-items: center;
                gap: 7px;
                color: #69503d;
                font-size: 12px;
                font-weight: 760;
                letter-spacing: 0;
            }

            .pai-context-mark {
                width: 18px;
                height: 18px;
                border-radius: 999px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                background: #fff;
                box-shadow: inset 0 0 0 1px rgba(234, 88, 12, 0.18);
            }

            .pai-context-mark img {
                width: 14px;
                height: 14px;
                object-fit: contain;
            }

            .pai-context-head-actions {
                display: flex;
                align-items: center;
                justify-content: flex-end;
                gap: 6px;
            }

            .pai-context-icon-button,
            .pai-context-action-button {
                width: 28px;
                height: 28px;
                border: 1px solid rgba(177, 153, 125, 0.72);
                background: rgba(255, 255, 255, 0.64);
                color: #5f4a38;
                border-radius: 8px;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                font-size: 15px;
                line-height: 1;
                padding: 0;
                text-decoration: none;
            }

            .pai-context-icon-button:hover,
            .pai-context-action-button:hover {
                background: #fff;
                border-color: rgba(138, 75, 42, 0.5);
            }

            .pai-context-icon-button[aria-expanded='true'],
            .pai-context-action-button[aria-expanded='true'] {
                background: rgba(45, 112, 100, 0.1);
                border-color: rgba(45, 112, 100, 0.34);
                color: #255f55;
            }

            .pai-context-icon-button:disabled,
            .pai-context-action-button:disabled {
                background: rgba(233, 224, 211, 0.42);
                border-color: rgba(177, 153, 125, 0.36);
                color: #8c7a66;
                cursor: default;
            }

            .pai-context-section-label {
                margin: 11px 0 5px;
                font-size: 11px;
                color: #8a6b52;
                font-weight: 760;
            }

            .pai-context-title {
                margin: 0;
                color: #152033;
                font-size: 16px;
                font-weight: 760;
                line-height: 1.32;
                overflow-wrap: anywhere;
            }

            .pai-context-summary {
                margin-top: 6px;
                color: #3d4d63;
                font-size: 13px;
                line-height: 1.55;
                white-space: pre-wrap;
                overflow-wrap: anywhere;
            }

            .pai-context-selected-text {
                border: 1px solid rgba(177, 153, 125, 0.24);
                background: rgba(255, 248, 237, 0.72);
                border-radius: 8px;
                padding: 7px 9px;
                color: #3d4d63;
                font-size: 12px;
                line-height: 1.45;
                overflow-wrap: anywhere;
                display: -webkit-box;
                -webkit-line-clamp: 3;
                -webkit-box-orient: vertical;
                overflow: hidden;
            }

            .pai-context-evidence-block {
                margin-top: 8px;
                border: 1px solid rgba(45, 112, 100, 0.16);
                border-left: 2px solid rgba(45, 112, 100, 0.5);
                background: rgba(235, 248, 244, 0.68);
                border-radius: 8px;
                padding: 7px 9px;
                color: #324a5f;
                font-size: 12px;
                line-height: 1.42;
                white-space: normal;
                overflow-wrap: anywhere;
            }

            .pai-context-evidence-label {
                display: block;
                margin-bottom: 2px;
                color: #255f55;
                font-size: 11px;
                font-weight: 760;
            }

            .pai-context-evidence-text {
                display: -webkit-box;
                -webkit-line-clamp: 3;
                -webkit-box-orient: vertical;
                overflow: hidden;
            }

            .pai-context-meta-row {
                margin-top: 9px;
                display: flex;
                flex-wrap: wrap;
                align-items: center;
                gap: 5px 7px;
                font-size: 11px;
                color: #7a6654;
            }

            .pai-context-meta-item {
                min-width: 0;
                overflow-wrap: anywhere;
                border-radius: 999px;
                background: rgba(243, 236, 224, 0.78);
                color: #69503d;
                padding: 2px 7px;
                line-height: 1.45;
            }

            .pai-context-source-link {
                color: #4f46e5;
                text-decoration: none;
                font-weight: 650;
            }

            .pai-context-source-link:hover {
                text-decoration: underline;
            }

            .pai-context-footer-wrap {
                flex: 0 0 auto;
                margin-top: 10px;
                padding-top: 8px;
                border-top: 1px solid rgba(222, 204, 178, 0.74);
                background: rgba(255, 252, 246, 0.99);
            }

            .pai-context-section-label--footer {
                margin-top: 0;
            }

            .pai-context-footer {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 10px;
            }

            .pai-context-feedback {
                display: flex;
                align-items: center;
                gap: 7px;
            }

            .pai-context-pager {
                display: flex;
                align-items: center;
                gap: 6px;
                color: #7a6654;
                font-size: 11px;
            }

            .pai-context-pager-button {
                width: 24px;
                height: 24px;
                border-radius: 7px;
                border: 1px solid rgba(177, 153, 125, 0.72);
                background: rgba(255, 255, 255, 0.64);
                color: #5f4a38;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                padding: 0;
                line-height: 1;
            }

            .pai-context-pager-button:disabled {
                opacity: 0.45;
                cursor: default;
            }

            .pai-context-more-wrap {
                position: relative;
            }

            .pai-context-more-menu {
                position: absolute;
                right: 0;
                top: 34px;
                width: 208px;
                padding: 6px;
                border-radius: 12px;
                border: 1px solid rgba(222, 204, 178, 0.95);
                background: rgba(255, 252, 246, 0.99);
                box-shadow: 0 16px 38px rgba(52, 32, 19, 0.22);
                z-index: 1;
            }

            .pai-context-menu-item {
                width: 100%;
                border: 0;
                background: transparent;
                color: #49392d;
                border-radius: 8px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: flex-start;
                gap: 8px;
                padding: 8px 9px;
                font-size: 12px;
                line-height: 1.25;
                text-align: left;
            }

            .pai-context-menu-item:hover,
            .pai-context-menu-item:focus-visible {
                background: rgba(45, 112, 100, 0.09);
            }

            .pai-context-menu-item--danger {
                color: #b45309;
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
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 10px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                font-size: 12px;
                line-height: 1.45;
                box-shadow: 0 12px 30px rgba(15, 23, 42, 0.22);
                z-index: 2147483646;
                animation: pai-context-toast-enter 0.18s ease-out;
            }

            .pai-context-toast-message {
                min-width: 0;
                overflow-wrap: anywhere;
            }

            .pai-context-toast-button {
                border: 1px solid rgba(255, 255, 255, 0.38);
                background: rgba(255, 255, 255, 0.12);
                color: #fff;
                border-radius: 6px;
                cursor: pointer;
                font: inherit;
                font-size: 12px;
                line-height: 1;
                padding: 6px 8px;
                white-space: nowrap;
            }

            .pai-context-toast-button:hover,
            .pai-context-toast-button:focus-visible {
                background: rgba(255, 255, 255, 0.2);
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
                    border-color: rgba(239, 68, 68, 0.42);
                }
                100% {
                    opacity: 0;
                    transform: scale(1.22);
                    border-color: rgba(239, 68, 68, 0);
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
                .pai-context-bubble::before,
                .pai-context-bubble--fresh::before,
                .pai-context-bubble--fresh img,
                .pai-context-peek,
                .pai-context-selection-trigger,
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

    private showContextToast(message: string, action?: ContextToastAction): void {
        this.clearContextToast();
        this.ensureContextBubbleStyles();

        if (!document.body) {
            return;
        }

        const toast = document.createElement('div');
        toast.className = 'pai-context-toast';
        toast.setAttribute('role', 'status');

        const text = document.createElement('span');
        text.className = 'pai-context-toast-message';
        text.textContent = message;
        toast.appendChild(text);

        if (action) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'pai-context-toast-button';
            button.textContent = action.label;
            if (action.ariaLabel) {
                button.setAttribute('aria-label', action.ariaLabel);
            }
            button.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                action.onClick();
            });
            toast.appendChild(button);
        }

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
        if (this.peekShowTimer !== null) {
            window.clearTimeout(this.peekShowTimer);
            this.peekShowTimer = null;
        }
        if (this.peekHideTimer !== null) {
            window.clearTimeout(this.peekHideTimer);
            this.peekHideTimer = null;
        }

        this.cardElement?.remove();
        this.peekElement?.remove();
        this.bubbleElement?.remove();
        this.cardElement = null;
        this.peekElement = null;
        this.bubbleElement = null;
        this.activeBubbleContextKey = null;
    }

    private showContextBubble(
        matchesOrMatch: ContextRecallMatch | ContextRecallMatch[],
        contextKey: string,
        animate: boolean,
        openOnShow = false,
        options: ContextBubbleOptions = {},
    ): void {
        const mode = options.mode || 'lens';
        const isSelectionSearch = mode === 'selectionSearch';
        const selectedText = normalizeText(options.selectedText);
        if (
            this.activeBubbleContextKey === contextKey &&
            this.cardElement &&
            (isSelectionSearch || this.bubbleElement)
        ) {
            return;
        }

        const matches = (Array.isArray(matchesOrMatch) ? matchesOrMatch : [matchesOrMatch])
            .filter(isDisplayableContextRecallMatch);
        if (!matches.length) {
            this.clearContextBubble();
            return;
        }

        this.clearContextBubble();
        this.ensureContextBubbleStyles();

        if (!document.body) {
            return;
        }

        const brandLabel = isSelectionSearch ? '划词记忆检索' : 'Memory Lens';
        const cardAriaLabel = isSelectionSearch
            ? 'Selection Memory Search 划词记忆检索结果'
            : 'Memory Lens 相关记忆详情';
        const whySectionLabel = isSelectionSearch ? '为什么匹配' : '为什么相关';
        const whyRowLabel = isSelectionSearch ? '匹配到' : '因为';
        const contentSectionLabel = isSelectionSearch ? '找到的相关记忆' : '它说了什么';
        const footerSectionLabel = isSelectionSearch ? '操作' : '我应该做什么';
        const positiveAriaLabel = isSelectionSearch ? '标记这条检索结果有用' : '标记这条记忆提示有用';
        const negativeAriaLabel = isSelectionSearch ? '标记这条检索结果不相关' : '标记这条记忆提示不相关';

        const bubble = document.createElement('div');
        bubble.className = 'pai-context-bubble';
        if (animate) {
            bubble.classList.add('pai-context-bubble--fresh');
        }
        bubble.title = brandLabel;

        const iconImg = document.createElement('img');
        iconImg.src = chrome.runtime.getURL('icons/icon48.png');
        iconImg.alt = '相关记忆';
        bubble.appendChild(iconImg);

        const card = document.createElement('div');
        card.className = 'pai-context-card';
        card.id = `pai-context-card-${Math.random().toString(36).slice(2)}`;
        card.setAttribute('role', 'dialog');
        card.setAttribute('aria-label', cardAriaLabel);
        card.setAttribute('aria-hidden', 'true');
        card.tabIndex = -1;

        const peek = document.createElement('div');
        peek.className = 'pai-context-peek';
        peek.setAttribute('role', 'status');
        peek.setAttribute('aria-hidden', 'true');

        const lensIconUrl = chrome.runtime.getURL('icons/icon48.png');
        let currentIndex = 0;
        let moreMenuOpen = false;
        let positiveLockedMatchId: string | null = null;

        const buildMatchView = (match: ContextRecallMatch) => {
            const sourceLabel =
                formatContextRecallSourceLabel(match.sourceLabel) ||
                normalizeText(match.sourceTitle) ||
                '记忆来源';
            const titleText = normalizeText(match.title) || normalizeText(match.sourceTitle) || sourceLabel;
            const summaryText = normalizeText(match.uiSummary) || normalizeText(match.snippet) || titleText;
            const evidenceText = normalizeText(match.snippet);
            const shouldShowEvidence = Boolean(
                evidenceText &&
                normalizeText(summaryText) !== evidenceText
            );
            const strengthLabel = formatContextMatchStrength(match);
            const strengthClass = getContextStrengthClass(match);
            const whyChips = isSelectionSearch
                ? buildSelectionSearchWhyChips(match, selectedText)
                : buildContextWhyChips(match);
            const peekFooter = [
                sourceLabel,
                formatContextMatchDate(match.timestamp),
                normalizeText(match.sourceTitle),
            ].filter(Boolean).join(' · ');
            const safeExploreRoute = sanitizeExploreRoute(match.exploreLink);
            const exploreUrl = safeExploreRoute
                ? chrome.runtime.getURL(`memory-exploring.html${safeExploreRoute}`)
                : '';
            const compactMetaItems = buildContextRecallCompactMetaItems(match)
                .filter((item) => !/^记忆类型：/.test(item));
            const sourceLinks = (match.links || [])
                .map((link) => ({
                    label: normalizeText(link.label) || '来源',
                    url: sanitizeContextExternalUrl(link.url, window.location.href),
                }))
                .filter((link): link is { label: string; url: string } => !!link.url);

            return {
                sourceLabel,
                titleText,
                summaryText,
                evidenceText,
                shouldShowEvidence,
                strengthLabel,
                strengthClass,
                whyChips,
                peekFooter,
                exploreUrl,
                compactMetaItems,
                sourceLinks,
            };
        };

        const renderWhyChips = (match: ContextRecallMatch): string => {
            const chips = isSelectionSearch
                ? buildSelectionSearchWhyChips(match, selectedText)
                : buildContextWhyChips(match);
            if (!chips.length) return '';

            return `
                <div class="pai-context-why-row" aria-label="${escapeHtmlAttribute(whySectionLabel)}">
                    <span class="pai-context-why-label">${escapeHtml(whyRowLabel)}</span>
                    ${chips.map((chip) => `<span class="pai-context-chip">${escapeHtml(chip)}</span>`).join('')}
                </div>
            `;
        };

        const renderPeek = (): void => {
            const match = matches[currentIndex];
            const view = buildMatchView(match);
            peek.innerHTML = `
                <div class="pai-context-peek-header">
                    <span>${escapeHtml(brandLabel)}</span>
                    <span class="pai-context-relevance pai-context-relevance--${escapeHtmlAttribute(view.strengthClass)}">${escapeHtml(view.strengthLabel)}</span>
                </div>
                ${renderWhyChips(match)}
                <div class="pai-context-peek-title">${escapeHtml(view.titleText)}</div>
                <div class="pai-context-peek-summary">${escapeHtml(view.summaryText)}</div>
                ${view.peekFooter ? `<div class="pai-context-peek-footer">${escapeHtml(view.peekFooter)}</div>` : ''}
            `;
        };

        const renderCard = (): void => {
            const match = matches[currentIndex];
            const view = buildMatchView(match);
            const isPositiveLocked = positiveLockedMatchId === match.id;
            const metaHtml = view.compactMetaItems
                .map((item) => `<span class="pai-context-meta-item">${escapeHtml(item)}</span>`)
                .join('');
            const sourceLinksHtml = view.sourceLinks
                .map((link) => `<a class="pai-context-source-link" href="${escapeHtmlAttribute(link.url)}" target="_blank" rel="noopener">${escapeHtml(link.label)}</a>`)
                .join('');
            const pagerHtml = matches.length > 1
                ? `
                    <div class="pai-context-pager" aria-label="相关记忆候选分页">
                        <button type="button" class="pai-context-pager-button pai-context-prev" aria-label="上一条相关记忆" ${currentIndex === 0 ? 'disabled' : ''}>‹</button>
                        <span>${currentIndex + 1} / ${matches.length}</span>
                        <button type="button" class="pai-context-pager-button pai-context-next" aria-label="下一条相关记忆" ${currentIndex >= matches.length - 1 ? 'disabled' : ''}>›</button>
                    </div>
                `
                : '';
            const selectedTextHtml = isSelectionSearch && selectedText
                ? `
                    <div class="pai-context-section-label">选中的内容</div>
                    <div class="pai-context-selected-text">${escapeHtml(selectedText)}</div>
                `
                : '';

            card.innerHTML = `
                <div class="pai-context-card-scroll">
                    <div class="pai-context-head">
                        <div class="pai-context-brand">
                            <span class="pai-context-mark"><img src="${escapeHtmlAttribute(lensIconUrl)}" alt=""></span>
                            <span>${escapeHtml(brandLabel)}</span>
                        </div>
                        <div class="pai-context-head-actions">
                            <span class="pai-context-relevance pai-context-relevance--${escapeHtmlAttribute(view.strengthClass)}">${escapeHtml(view.strengthLabel)}</span>
                            ${view.exploreUrl ? `<a class="pai-context-icon-button pai-context-open-memory" href="${escapeHtmlAttribute(view.exploreUrl)}" target="_blank" rel="noopener" aria-label="在记忆中查看" title="在记忆中查看">↗<span class="pai-sr-only">在记忆中查看</span></a>` : ''}
                            <div class="pai-context-more-wrap">
                                <button type="button" class="pai-context-icon-button pai-context-more" aria-label="更多控制" title="更多控制" aria-haspopup="menu" aria-expanded="${String(moreMenuOpen)}">⋯</button>
                                <div class="pai-context-more-menu" role="menu" ${moreMenuOpen ? '' : 'hidden'}>
                                    <button type="button" class="pai-context-menu-item pai-context-dismiss" role="menuitem">隐藏此条记忆 30 分钟</button>
                                    <button type="button" class="pai-context-menu-item pai-context-site-allow" role="menuitem">允许此站点</button>
                                    <button type="button" class="pai-context-menu-item pai-context-site-mute" role="menuitem">此网站今天不提示</button>
                                    <button type="button" class="pai-context-menu-item pai-context-page-block" role="menuitem">此页面永久不提示</button>
                                    <button type="button" class="pai-context-menu-item pai-context-menu-item--danger pai-context-site-block" role="menuitem">永久不提示此站点</button>
                                </div>
                            </div>
                        </div>
                    </div>

                    ${selectedTextHtml}
                    <div class="pai-context-section-label">${escapeHtml(whySectionLabel)}</div>
                    ${renderWhyChips(match)}

                    <div class="pai-context-section-label">${escapeHtml(contentSectionLabel)}</div>
                    <h3 class="pai-context-title">${escapeHtml(view.titleText)}</h3>
                    <div class="pai-context-summary">${escapeHtml(view.summaryText)}</div>
                    ${view.shouldShowEvidence ? `
                        <div class="pai-context-evidence-block">
                            <span class="pai-context-evidence-label">证据</span>
                            <span class="pai-context-evidence-text">${escapeHtml(view.evidenceText)}</span>
                        </div>
                    ` : ''}

                    <div class="pai-context-meta-row" aria-label="记忆来源摘要">
                        ${metaHtml}
                        ${sourceLinksHtml}
                    </div>
                </div>
                <div class="pai-context-footer-wrap">
                    <div class="pai-context-section-label pai-context-section-label--footer">${escapeHtml(footerSectionLabel)}</div>
                    <div class="pai-context-footer">
                        <div class="pai-context-feedback" aria-label="反馈">
                            <button type="button" class="pai-context-action-button pai-context-recall-positive" aria-label="${isPositiveLocked ? '已标记有用' : escapeHtmlAttribute(positiveAriaLabel)}" title="${isPositiveLocked ? '已标记有用' : '这条有用'}" ${isPositiveLocked ? 'disabled' : ''}>✓<span class="pai-sr-only">这条有用</span></button>
                            <button type="button" class="pai-context-action-button pai-context-recall-negative" aria-label="${escapeHtmlAttribute(negativeAriaLabel)}" title="这条不相关" ${isPositiveLocked ? 'disabled' : ''}>×<span class="pai-sr-only">这条不相关</span></button>
                        </div>
                        ${pagerHtml}
                    </div>
                </div>
            `;
        };

        renderPeek();
        renderCard();

        let expanded = false;
        const setPeekVisible = (visible: boolean): void => {
            if (expanded) {
                visible = false;
            }
            peek.classList.toggle('pai-context-peek--visible', visible);
            peek.setAttribute('aria-hidden', String(!visible));
        };
        const schedulePeekVisible = (visible: boolean, delayMs: number): void => {
            if (this.peekShowTimer !== null) {
                window.clearTimeout(this.peekShowTimer);
                this.peekShowTimer = null;
            }
            if (this.peekHideTimer !== null) {
                window.clearTimeout(this.peekHideTimer);
                this.peekHideTimer = null;
            }
            const timer = window.setTimeout(() => {
                if (visible) {
                    this.peekShowTimer = null;
                } else {
                    this.peekHideTimer = null;
                }
                setPeekVisible(visible);
            }, delayMs);
            if (visible) {
                this.peekShowTimer = timer;
            } else {
                this.peekHideTimer = timer;
            }
        };
        const setExpanded = (nextExpanded: boolean): void => {
            if (isSelectionSearch && !nextExpanded) {
                this.clearContextBubble();
                return;
            }
            expanded = nextExpanded;
            moreMenuOpen = false;
            renderCard();
            setPeekVisible(false);
            card.style.display = expanded ? 'flex' : 'none';
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
        bubble.addEventListener('pointerenter', () => {
            if (!expanded) schedulePeekVisible(true, CONTEXT_PEEK_SHOW_DELAY_MS);
        });
        bubble.addEventListener('pointerleave', () => {
            schedulePeekVisible(false, CONTEXT_PEEK_HIDE_DELAY_MS);
        });
        bubble.addEventListener('focus', () => {
            if (!expanded) schedulePeekVisible(true, CONTEXT_PEEK_SHOW_DELAY_MS);
        });
        bubble.addEventListener('blur', () => {
            schedulePeekVisible(false, CONTEXT_PEEK_HIDE_DELAY_MS);
        });

        card.addEventListener('click', (event) => {
            event.stopPropagation();

            const target = event.target instanceof Element ? event.target : null;
            if (!target) return;

            if (target.closest('.pai-context-more')) {
                event.preventDefault();
                moreMenuOpen = !moreMenuOpen;
                renderCard();
                card.querySelector<HTMLButtonElement>('.pai-context-more')?.focus();
                return;
            }

            if (target.closest('.pai-context-prev')) {
                event.preventDefault();
                if (currentIndex > 0) {
                    currentIndex -= 1;
                    moreMenuOpen = false;
                    renderPeek();
                    renderCard();
                    card.querySelector<HTMLButtonElement>('.pai-context-prev')?.focus();
                }
                return;
            }

            if (target.closest('.pai-context-next')) {
                event.preventDefault();
                if (currentIndex < matches.length - 1) {
                    currentIndex += 1;
                    moreMenuOpen = false;
                    renderPeek();
                    renderCard();
                    card.querySelector<HTMLButtonElement>('.pai-context-next')?.focus();
                }
                return;
            }

            if (target.closest('.pai-context-dismiss')) {
                event.preventDefault();
                this.dismissContext(contextKey);
                return;
            }

            if (target.closest('.pai-context-recall-positive')) {
                event.preventDefault();
                const currentMatch = matches[currentIndex];
                positiveLockedMatchId = currentMatch.id;
                moreMenuOpen = false;
                renderCard();
                this.markContextMatchRelevant(currentMatch);
                return;
            }

            if (target.closest('.pai-context-recall-negative')) {
                event.preventDefault();
                this.markContextMatchIrrelevant(matches[currentIndex], contextKey);
                return;
            }

            if (target.closest('.pai-context-site-allow')) {
                event.preventDefault();
                this.allowCurrentSiteAndEnableAllowlist();
                return;
            }

            if (target.closest('.pai-context-site-mute')) {
                event.preventDefault();
                this.muteCurrentSite();
                return;
            }

            if (target.closest('.pai-context-page-block')) {
                event.preventDefault();
                this.blockCurrentPage();
                return;
            }

            if (target.closest('.pai-context-site-block')) {
                event.preventDefault();
                this.blockCurrentSite();
            }
        });
        card.addEventListener('keydown', (event) => {
            if (event.key !== 'Escape') {
                return;
            }
            event.preventDefault();
            if (isSelectionSearch) {
                this.clearContextBubble();
            } else {
                setExpanded(false);
                bubble.focus();
            }
        });

        this.outsideClickListener = (event: MouseEvent) => {
            const target = event.target as Node | null;
            if (!target) return;
            if (
                bubble.contains(target) ||
                peek.contains(target) ||
                card.contains(target) ||
                this.toastElement?.contains(target)
            ) {
                return;
            }

            if (isSelectionSearch) {
                this.clearContextBubble();
            } else {
                setExpanded(false);
            }
        };

        document.addEventListener('click', this.outsideClickListener, true);

        if (!isSelectionSearch) {
            document.body.appendChild(bubble);
            document.body.appendChild(peek);
        }
        document.body.appendChild(card);

        this.bubbleElement = isSelectionSearch ? null : bubble;
        this.peekElement = isSelectionSearch ? null : peek;
        this.cardElement = card;
        this.activeBubbleContextKey = contextKey;

        if (openOnShow) {
            setExpanded(true);
            window.setTimeout(() => card.focus(), 0);
        }

        if (animate && !isSelectionSearch) {
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
