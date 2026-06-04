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
    isMemoryCaptureSelectionTextEligible,
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
    removeContextSiteRecordConflicts,
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

interface SelectedTextContextPayload extends ContextMatchPayload {
    rect: DOMRect;
    selectionRecallEligible: boolean;
}

interface ContextRecallMatch {
    id: string;
    type: 'message' | 'chunk' | 'entity' | 'rehearsal' | 'source_memory';
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

interface ContextToastOptions {
    durationMs?: number;
    variant?: 'memory-capture-auto';
    detailMessage?: string;
}

type ContextRecallFeedbackResultHandler = (success: boolean, error?: string) => void;
type ContextRecallNegativeFeedbackReason =
    | 'generic_topic_overlap'
    | 'wrong_group_or_project'
    | 'empty_meeting_shell';

interface ContextRecallFeedbackDetailOptions {
    reason?: ContextRecallNegativeFeedbackReason;
    note?: string;
    surface?: string;
    selectedText?: string;
    interaction?: 'context_recall_feedback' | 'memory_relevance_trainer';
    autoApplied?: boolean;
    restoreBubbleOptions?: ContextBubbleOptions;
}

const CONTEXT_RECALL_NEGATIVE_FEEDBACK_REASONS: Array<{
    value: ContextRecallNegativeFeedbackReason;
    label: string;
    detail: string;
}> = [
    {
        value: 'generic_topic_overlap',
        label: '只是主题相似',
        detail: '不要只因工具、产品或宽泛关键词就提示',
    },
    {
        value: 'wrong_group_or_project',
        label: '群组或项目不对',
        detail: '当前场景和这条记忆的归属不一致',
    },
    {
        value: 'empty_meeting_shell',
        label: '空页面误触发',
        detail: '页面缺少具体人物、工单、行动或结论',
    },
];

const CONTEXT_THUMB_UP_ICON_HTML = `
    <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M7 10v12"></path>
        <path d="M15 5.9 14 10h5.8a2 2 0 0 1 2 2.4l-1.4 7A2 2 0 0 1 18.4 21H9a2 2 0 0 1-2-2v-8a2 2 0 0 1 .6-1.4L13 4.7a1.4 1.4 0 0 1 2 .1c.4.4.5 1 .4 1.5Z"></path>
        <path d="M3 10h4"></path>
    </svg>
`;

const CONTEXT_THUMB_DOWN_ICON_HTML = `
    <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M7 14V2"></path>
        <path d="M15 18.1 14 14h5.8a2 2 0 0 0 2-2.4l-1.4-7A2 2 0 0 0 18.4 3H9a2 2 0 0 0-2 2v8a2 2 0 0 0 .6 1.4L13 19.3a1.4 1.4 0 0 0 2-.1c.4-.4.5-1 .4-1.5Z"></path>
        <path d="M3 14h4"></path>
    </svg>
`;

function getContextRecallNegativeFeedbackReasonLabel(
    reason?: ContextRecallNegativeFeedbackReason,
): string | undefined {
    return CONTEXT_RECALL_NEGATIVE_FEEDBACK_REASONS.find((item) => item.value === reason)?.label;
}

function buildSourceMemoryDetailToastAction(capsuleId?: unknown): ContextToastAction | undefined {
    const normalizedId = normalizeText(
        typeof capsuleId === 'string' ? capsuleId : String(capsuleId || ''),
    );
    if (!normalizedId) return undefined;

    return {
        label: '查看',
        ariaLabel: '查看资料记忆详情',
        onClick: () => {
            const url = chrome.runtime.getURL(
                `memory-exploring.html#/source-memory/${encodeURIComponent(normalizedId)}`,
            );
            window.open(url, '_blank', 'noopener');
        },
    };
}

type ContextBubbleMode = 'lens' | 'selectionSearch';

interface ContextBubbleOptions {
    mode?: ContextBubbleMode;
    selectedText?: string;
}

interface MemoryCaptureCandidateResult {
    eligible: boolean;
    score: number;
    suggestedAction: 'auto_save' | 'suggest' | 'ignore' | 'blocked';
    reasons?: string[];
    blockedReason?: string;
    captureMode?: 'auto' | 'suggested' | 'manual';
}

interface VisualMemoryCandidate {
    kind: 'chart' | 'canvas' | 'image' | 'table' | 'figure';
    tagName: string;
    label: string;
    previewText: string;
    nearbyText: string;
    source?: string;
    selectorHint: string;
    table?: VisualMemoryTableSnapshot;
    svg?: VisualMemorySvgSnapshot;
    rect: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    score: number;
}

interface VisualMemorySvgSnapshot {
    markup: string;
    width: number;
    height: number;
}

interface VisualMemoryTableSnapshot {
    headers: string[];
    rows: string[][];
    rowCount: number;
    columnCount: number;
    truncated: boolean;
}

interface ContextMatchViewCopy {
    whySectionLabel: string;
    whyRowLabel: string;
    contentSectionLabel: string;
    footerSectionLabel: string;
    positiveAriaLabel: string;
    negativeAriaLabel: string;
    evidenceLabel: string;
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

function asPlainObject(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null;
    }
    return value as Record<string, unknown>;
}

function isContextRehearsalMatch(match: ContextRecallMatch): boolean {
    return (
        match.type === 'rehearsal' ||
        normalizeText(match.sourceLabel).toLowerCase() === 'rehearsal' ||
        match.reasonType === 'prospective_cue' ||
        match.evidenceRole === 'rehearsal_cue'
    );
}

function getContextRehearsalActivationId(match: ContextRecallMatch): string | undefined {
    const metadata = asPlainObject(match.metadata);
    const rehearsal = asPlainObject(metadata?.rehearsal);
    const activationId = rehearsal?.activationId;
    return typeof activationId === 'string' && activationId.trim()
        ? activationId.trim()
        : undefined;
}

function clipContextFeedbackDetailValue(value?: string | null, maxLength = 160): string | undefined {
    const normalized = normalizeText(value);
    if (!normalized) return undefined;
    return normalized.length > maxLength
        ? `${normalized.slice(0, maxLength).trimEnd()}…`
        : normalized;
}

function stringifyContextRecallFeedbackDetail(
    detail: Record<string, string | undefined>,
    maxLength = 1100,
): string {
    const compact = Object.fromEntries(
        Object.entries(detail).filter(([, value]) => Boolean(value)),
    ) as Record<string, string>;
    let serialized = JSON.stringify(compact);
    if (serialized.length <= maxLength) return serialized;

    const shorten: Array<[string, number]> = [
        ['feedback_note', 90],
        ['selected_text', 90],
        ['source_url', 120],
        ['current_url', 120],
        ['scene_anchor_signature', 120],
        ['source_title', 90],
        ['sender', 80],
    ];
    for (const [key, limit] of shorten) {
        if (!compact[key]) continue;
        compact[key] = clipContextFeedbackDetailValue(compact[key], limit) || compact[key];
        serialized = JSON.stringify(compact);
        if (serialized.length <= maxLength) return serialized;
    }

    for (const key of ['selected_text', 'source_url', 'current_url', 'feedback_note']) {
        delete compact[key];
        serialized = JSON.stringify(compact);
        if (serialized.length <= maxLength) return serialized;
    }

    return JSON.stringify({
        version: compact.version,
        surface: compact.surface,
        interaction: compact.interaction,
        action: compact.action,
        feedback_reason: compact.feedback_reason,
        scene_anchor_signature: compact.scene_anchor_signature,
        target_type: compact.target_type,
        source_label: compact.source_label,
        group_id: compact.group_id,
    });
}

function getContextRecallFeedbackTargetId(match: ContextRecallMatch): string {
    if (match.type === 'source_memory') {
        const metadataId = getContextMatchMetadataText(match, 'sourceMemoryCapsuleId');
        if (metadataId) return metadataId;
        return normalizeText(match.id).replace(/^source-memory:/, '');
    }
    return String(match.id || '').trim();
}

function buildContextRecallFeedbackDetail(
    match: ContextRecallMatch,
    action: 'positive' | 'negative',
    contextKey: string | null | undefined,
    host: string,
    options: ContextRecallFeedbackDetailOptions = {},
): string {
    const detail: Record<string, string | undefined> = {
        version: '1',
        surface: clipContextFeedbackDetailValue(
            options.surface ||
            (normalizeText(contextKey).startsWith('selected_text:') ? 'selection_memory_search_card' : 'web_passive_bubble'),
            80,
        ),
        interaction: options.interaction ||
            (options.reason ? 'memory_relevance_trainer' : 'context_recall_feedback'),
        host: clipContextFeedbackDetailValue(host, 80),
        action,
        scene_anchor_signature: clipContextFeedbackDetailValue(contextKey, 180),
        feedback_reason: clipContextFeedbackDetailValue(options.reason, 80),
        feedback_reason_label: clipContextFeedbackDetailValue(
            getContextRecallNegativeFeedbackReasonLabel(options.reason),
            80,
        ),
        feedback_note: clipContextFeedbackDetailValue(options.note, 260),
        auto_applied: options.autoApplied ? 'true' : undefined,
        target_type: clipContextFeedbackDetailValue(match.type, 40),
        reason_type: clipContextFeedbackDetailValue(match.reasonType, 60),
        evidence_role: clipContextFeedbackDetailValue(match.evidenceRole, 60),
        display_priority: clipContextFeedbackDetailValue(match.displayPriority, 20),
        source_label: clipContextFeedbackDetailValue(match.sourceLabel, 80),
        source_title: clipContextFeedbackDetailValue(match.sourceTitle, 120),
        source_url: clipContextFeedbackDetailValue(match.sourceUrl, 180),
        current_url: clipContextFeedbackDetailValue(window.location.href, 180),
        current_title: clipContextFeedbackDetailValue(document.title, 120),
        selected_text: clipContextFeedbackDetailValue(options.selectedText, 160),
        source_memory_capsule_id: clipContextFeedbackDetailValue(
            getContextMatchMetadataText(match, 'sourceMemoryCapsuleId'),
            120,
        ),
        group_id: clipContextFeedbackDetailValue(
            getContextMatchMetadataText(match, 'groupId') ||
            getContextMatchMetadataText(match, 'group_id'),
            80,
        ),
        sender: clipContextFeedbackDetailValue(
            getContextMatchMetadataText(match, 'sender') ||
            getContextMatchMetadataText(match, 'senderName') ||
            getContextMatchMetadataText(match, 'author'),
            120,
        ),
    };

    return stringifyContextRecallFeedbackDetail(detail);
}

function getContextMatchMetadataLayers(match: ContextRecallMatch): Record<string, unknown>[] {
    const metadata = asPlainObject(match.metadata);
    if (!metadata) return [];

    const nested = asPlainObject(metadata.metadata);
    return nested ? [metadata, nested] : [metadata];
}

function getContextMatchMetadataText(
    match: ContextRecallMatch,
    key: string,
): string {
    for (const metadata of getContextMatchMetadataLayers(match)) {
        const value = metadata[key];
        if (typeof value === 'string') {
            const normalized = normalizeText(value);
            if (normalized) return normalized;
        }
    }
    return '';
}

function getContextMatchMetadataArray(
    match: ContextRecallMatch,
    key: string,
): unknown[] {
    for (const metadata of getContextMatchMetadataLayers(match)) {
        const value = metadata[key];
        if (Array.isArray(value)) return value;
    }
    return [];
}

function cleanContextLensDisplayText(value?: string | null): string {
    let text = normalizeText(value);
    if (!text) return '';

    text = text
        .replace(/^@?[\p{L}\p{N}._\- ]{1,80}\s+wrote\s*[:：]\s*/iu, '')
        .replace(/^[-–—]?\s*\d{1,2}:\d{2}(?::\d{2})?\s*(?:\[[^\]]+\])?\s*/u, '')
        .replace(/^\d+[.)、]\s*/u, '')
        .replace(/^[-*•]\s*/u, '')
        .trim();

    return text;
}

function clipContextLensTitle(value: string): string {
    const text = cleanContextLensDisplayText(value);
    if (!text) return '';
    if (text.length <= 72) return text;
    return `${text.slice(0, 72).trim()}...`;
}

function getContextMatchFirstContextMessage(match: ContextRecallMatch): string {
    const messages = getContextMatchMetadataArray(match, 'contextMessages');
    for (const message of messages) {
        if (typeof message === 'string') {
            const text = cleanContextLensDisplayText(message);
            if (text) return text;
            continue;
        }

        const record = asPlainObject(message);
        if (!record) continue;
        for (const key of ['content', 'text', 'message']) {
            const value = record[key];
            if (typeof value !== 'string') continue;
            const text = cleanContextLensDisplayText(value);
            if (text) return text;
        }
    }
    return '';
}

function selectContextLensTitle(match: ContextRecallMatch, sourceLabel: string): string {
    const candidates = [
        getContextMatchMetadataText(match, 'summary'),
        getContextMatchFirstContextMessage(match),
        match.title,
        match.sourceTitle,
        match.uiSummary,
        match.snippet,
        sourceLabel,
    ];

    for (const candidate of candidates) {
        const title = clipContextLensTitle(candidate || '');
        if (title) return title;
    }

    return '相关记忆';
}

function selectContextLensSummary(match: ContextRecallMatch, titleText: string): string {
    const candidates = [
        getContextMatchMetadataText(match, 'summary'),
        match.uiSummary,
        match.snippet,
        titleText,
    ];

    for (const candidate of candidates) {
        const summary = cleanContextLensDisplayText(candidate || '');
        if (summary) return summary;
    }

    return titleText;
}

function selectContextLensEvidence(match: ContextRecallMatch, summaryText: string): string {
    const actions = getContextMatchMetadataArray(match, 'actions');
    for (const action of actions) {
        const record = asPlainObject(action);
        if (!record) continue;

        const description = normalizeText(
            typeof record.description === 'string'
                ? record.description
                : typeof record.title === 'string'
                    ? record.title
                    : '',
        );
        if (!description) continue;

        const assignee = normalizeText(
            typeof record.assignee === 'string' ? record.assignee : '',
        );
        const deadline = normalizeText(
            typeof record.deadline === 'string' ? record.deadline : '',
        );
        const parts = [assignee, description, deadline].filter(Boolean);
        const suffix = actions.length > 1 ? `待办 ${actions.length}` : '';
        return [...parts, suffix].filter(Boolean).join(' · ');
    }

    const replyAdvice = getContextMatchMetadataText(match, 'replyAdvice');
    if (replyAdvice) return replyAdvice;

    const snippet = cleanContextLensDisplayText(match.snippet);
    if (snippet && snippet !== cleanContextLensDisplayText(summaryText)) {
        return snippet;
    }

    return '';
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

function isExplainablePassiveContextMatch(match: ContextRecallMatch): boolean {
    if (!hasContextWhyRelevant(match)) return false;
    return match.displayPriority === 'p1' || match.displayPriority === 'p2';
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

function buildContextRecallSourceLinks(
    match: ContextRecallMatch,
    baseUrl: string,
    sourceLabel: string,
): Array<{ label: string; url: string }> {
    const links: Array<{ label: string; url: string }> = [];
    const seenUrls = new Set<string>();
    const addLink = (rawLabel?: string | null, rawUrl?: string | null): void => {
        const url = sanitizeContextExternalUrl(rawUrl, baseUrl);
        if (!url || seenUrls.has(url)) return;

        const label = clipContextLensTitle(rawLabel || '');
        seenUrls.add(url);
        links.push({
            label: label && label !== '记忆来源' ? label : '打开来源',
            url,
        });
    };

    addLink(match.sourceTitle || sourceLabel, match.sourceUrl);
    for (const link of Array.isArray(match.links) ? match.links : []) {
        addLink(link.label, link.url);
    }

    return links.slice(0, 3);
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
const PAGE_MEMORY_CAPTURE_MIN_DWELL_MS = 45_000;
const PAGE_MEMORY_CAPTURE_COPY_DELAY_MS = 300;
const PAGE_MEMORY_CAPTURE_INTERACTION_DELAY_MS = 1200;
const PAGE_MEMORY_CAPTURE_MIN_WORDS = 80;
const PAGE_MEMORY_CAPTURE_AUTO_MIN_WORDS = 260;
const PAGE_MEMORY_CAPTURE_AUTO_COPY_DWELL_MS = 90_000;
const PAGE_MEMORY_CAPTURE_AUTO_DEEP_READ_MS = 240_000;
const PAGE_MEMORY_CAPTURE_AUTO_LONG_READ_MS = 480_000;
const PAGE_MEMORY_CAPTURE_AUTO_RECHECK_MS = 30_000;
const PAGE_VISUAL_MEMORY_MIN_AREA = 28_000;
const PAGE_VISUAL_MEMORY_MIN_TEXT_CHARS = 16;
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
    '.pai-context-feedback-layer',
    '.pai-context-selection-trigger',
    '.pai-memory-capture-selection-dock',
    '.pai-memory-capture-note-panel',
    '.pai-visual-memory-preview-panel',
    '.pai-memory-capture-page-chip',
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
    private feedbackDrawerElement: HTMLDivElement | null = null;
    private feedbackDrawerKeydownListener: ((event: KeyboardEvent) => void) | null = null;
    private peekShowTimer: number | null = null;
    private peekHideTimer: number | null = null;
    private selectionTriggerElement: HTMLElement | null = null;
    private selectionCaptureDockElement: HTMLElement | null = null;
    private selectionCaptureReviewElement: HTMLElement | null = null;
    private selectionTriggerTimer: number | null = null;
    private selectedTextPendingContextKey: string | null = null;
    private selectedTextRequestId = 0;
    private pageCaptureChipElement: HTMLElement | null = null;
    private visualMemoryPreviewElement: HTMLElement | null = null;
    private pageCaptureTimer: number | null = null;
    private pageCaptureRequestId = 0;
    private pageCapturePendingContextKey: string | null = null;
    private pageCaptureShownContextKey: string | null = null;
    private pageCaptureStoredContextKey: string | null = null;
    private pageCaptureStartedAt = Date.now();
    private pageCaptureMaxScrollDepth = 0;
    private pageCaptureCopiedText = false;
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
        this.setupSiteControlStorageListener();
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
            this.updatePageMemoryCaptureScrollDepth();
            if (
                this.pageCaptureMaxScrollDepth >= 0.6 &&
                this.getPageMemoryCaptureDwellMs() >= 10_000
            ) {
                this.schedulePageMemoryCaptureEvaluation(PAGE_MEMORY_CAPTURE_INTERACTION_DELAY_MS);
            }
            this.clearSelectedTextTrigger();
        }, true);
        window.addEventListener('resize', () => {
            this.clearSelectedTextTrigger();
        });
        document.addEventListener('copy', () => {
            this.pageCaptureCopiedText = true;
            this.schedulePageMemoryCaptureEvaluation(PAGE_MEMORY_CAPTURE_COPY_DELAY_MS);
        });
        this.schedulePageMemoryCaptureEvaluation(PAGE_MEMORY_CAPTURE_MIN_DWELL_MS);

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
            this.resetPageMemoryCaptureState();
            this.clearContextBubble();
            this.clearSelectedTextTrigger();
            this.clearPageMemoryCaptureChip();
        }

        this.scheduleAnalysis(1000);
        this.scheduleContextMatch(this.getContextChangeDelayMs());
        this.schedulePageMemoryCaptureEvaluation(PAGE_MEMORY_CAPTURE_MIN_DWELL_MS);
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
            node.classList.contains('pai-context-feedback-layer') ||
            node.classList.contains('pai-context-selection-trigger') ||
            node.classList.contains('pai-memory-capture-selection-dock') ||
            node.classList.contains('pai-memory-capture-note-panel') ||
            node.classList.contains('pai-memory-capture-page-chip') ||
            node.classList.contains('pai-context-toast') ||
            node.id === 'pai-context-bubble-styles' ||
            !!node.closest('.pai-context-bubble, .pai-context-card, .pai-context-peek, .pai-context-feedback-layer, .pai-context-selection-trigger, .pai-memory-capture-selection-dock, .pai-memory-capture-note-panel, .pai-visual-memory-preview-panel, .pai-memory-capture-page-chip, .pai-context-toast')
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
        await this.loadSiteControls();
        if (this.isPassiveContextSuppressedBySiteControls()) {
            console.log('🚫 当前站点已关闭被动网页记忆处理，跳过网页智能分析');
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

    private findVisualMemoryCandidate(): VisualMemoryCandidate | null {
        if (!document.body) {
            return null;
        }

        let elements: Element[] = [];
        try {
            elements = Array.from(new Set(document.querySelectorAll([
                'svg',
                'canvas',
                'img',
                'table',
                'figure',
                '[role="img"]',
                '[role="figure"]',
                '[class*="chart" i]',
                '[id*="chart" i]',
                '[class*="graph" i]',
                '[id*="graph" i]',
                '[class*="plot" i]',
                '[id*="plot" i]',
                '[class*="dashboard" i]',
                '[id*="dashboard" i]',
            ].join(', '))));
        } catch (_error) {
            elements = Array.from(new Set(document.querySelectorAll('svg, canvas, img, table, figure, [role="img"], [role="figure"]')));
        }

        const candidates = elements
            .map((element) => this.buildVisualMemoryCandidate(element))
            .filter((candidate): candidate is VisualMemoryCandidate => Boolean(candidate))
            .sort((a, b) => b.score - a.score);

        return candidates[0] || null;
    }

    private buildVisualMemoryCandidate(element: Element): VisualMemoryCandidate | null {
        if (
            element === document.body ||
            element === document.documentElement ||
            element.closest('.pai-context-bubble, .pai-context-card, .pai-context-peek, .pai-context-feedback-layer, .pai-context-selection-trigger, .pai-memory-capture-selection-dock, .pai-memory-capture-note-panel, .pai-visual-memory-preview-panel, .pai-memory-capture-page-chip, .pai-context-toast')
        ) {
            return null;
        }

        const rect = element.getBoundingClientRect();
        if (!this.isVisibleVisualMemoryElement(element, rect)) {
            return null;
        }

        const area = rect.width * rect.height;
        const kind = this.inferVisualMemoryKind(element);
        const table = kind === 'table' ? this.extractVisualMemoryTable(element) : undefined;
        const svg = this.extractVisualMemorySvg(element, rect);
        const previewText = table
            ? this.formatVisualMemoryTableText(table)
            : this.extractVisualMemoryText(element);
        const nearbyText = this.extractVisualMemoryNearbyText(element, previewText);
        const source = this.extractVisualMemorySource(element);
        const label = this.selectVisualMemoryLabel(element, kind, previewText, nearbyText);
        const signalText = normalizeText([label, previewText, nearbyText, source].filter(Boolean).join(' '));
        if (area < PAGE_VISUAL_MEMORY_MIN_AREA && signalText.length < PAGE_VISUAL_MEMORY_MIN_TEXT_CHARS) {
            return null;
        }
        if (signalText.length < PAGE_VISUAL_MEMORY_MIN_TEXT_CHARS && kind !== 'canvas') {
            return null;
        }

        let score = Math.min(0.32, area / 320000);
        if (kind === 'chart' || kind === 'table') score += 0.28;
        if (kind === 'canvas') score += 0.16;
        if (previewText.length >= PAGE_VISUAL_MEMORY_MIN_TEXT_CHARS) score += 0.24;
        if (nearbyText.length >= 48) score += 0.12;
        if (source) score += 0.06;

        return {
            kind,
            tagName: element.tagName.toLowerCase(),
            label,
            previewText: previewText.slice(0, 900),
            nearbyText: nearbyText.slice(0, 900),
            source,
            selectorHint: this.buildVisualMemorySelectorHint(element),
            table,
            svg,
            rect: {
                x: Math.round(rect.left + window.scrollX),
                y: Math.round(rect.top + window.scrollY),
                width: Math.round(rect.width),
                height: Math.round(rect.height),
            },
            score: Math.round(Math.min(1, score) * 100) / 100,
        };
    }

    private isVisibleVisualMemoryElement(element: Element, rect: DOMRect): boolean {
        if (rect.width < 120 || rect.height < 72) {
            return false;
        }
        if (rect.bottom < 0 || rect.top > window.innerHeight) {
            return false;
        }
        const style = window.getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden') {
            return false;
        }
        const opacity = Number(style.opacity || '1');
        return Number.isNaN(opacity) || opacity > 0.05;
    }

    private inferVisualMemoryKind(element: Element): VisualMemoryCandidate['kind'] {
        const tagName = element.tagName.toLowerCase();
        if (tagName === 'canvas') return 'canvas';
        if (tagName === 'table') return 'table';
        if (tagName === 'img' || element instanceof HTMLImageElement) return 'image';
        const descriptor = normalizeText([
            tagName,
            (element as HTMLElement).id,
            this.getElementClassName(element),
            element.getAttribute('role'),
            element.getAttribute('aria-label'),
        ].join(' ')).toLowerCase();
        if (/chart|graph|plot|histogram|recharts|echarts|highcharts|vega|d3|数据|图表/.test(descriptor)) {
            return 'chart';
        }
        if (element.querySelector('svg, canvas, table')) {
            return 'chart';
        }
        return 'figure';
    }

    private extractVisualMemoryText(element: Element): string {
        const parts: string[] = [];
        const push = (value?: string | null, maxLength = 700) => {
            const text = normalizeText(value).slice(0, maxLength);
            if (!text) return;
            if (parts.some((part) => part === text || part.includes(text))) return;
            parts.push(text);
        };

        push(element.getAttribute('aria-label'));
        push(element.getAttribute('title'));
        if (element instanceof HTMLImageElement) {
            push(element.alt);
        }
        const firstImage = element.querySelector('img');
        if (firstImage instanceof HTMLImageElement) {
            push(firstImage.alt);
            push(firstImage.title);
        }

        const figure = element.closest('figure');
        push(figure?.querySelector('figcaption')?.textContent, 420);

        const tagName = element.tagName.toLowerCase();
        if (tagName === 'svg' || tagName === 'table' || tagName === 'figure' || element.getAttribute('role') === 'figure') {
            push(this.getContextTextContent(element), tagName === 'table' ? 900 : 640);
        }
        if (tagName !== 'img' && tagName !== 'canvas') {
            for (const item of Array.from(element.querySelectorAll('text, title, desc, caption')).slice(0, 36)) {
                push(item.textContent, 300);
            }
        }

        return normalizeText(parts.join(' · '));
    }

    private extractVisualMemoryNearbyText(element: Element, previewText: string): string {
        const scope =
            element.closest('figure, section, article, aside, main, [role="main"], [role="figure"]') ||
            element.parentElement;
        const scopedText = scope && scope !== document.body && scope !== document.documentElement
            ? this.getContextTextContent(scope)
            : '';
        const siblingText = [
            element.previousElementSibling ? this.getContextTextContent(element.previousElementSibling) : '',
            element.nextElementSibling ? this.getContextTextContent(element.nextElementSibling) : '',
            element.parentElement ? this.getContextTextContent(element.parentElement) : '',
        ].filter(Boolean).join(' ');
        const text = normalizeText(scopedText || siblingText);
        if (!text || text === previewText) {
            return '';
        }
        return text.slice(0, 900);
    }

    private extractVisualMemorySource(element: Element): string | undefined {
        const image = element instanceof HTMLImageElement
            ? element
            : element.querySelector('img');
        const src = image instanceof HTMLImageElement
            ? normalizeText(image.currentSrc || image.src)
            : '';
        return src ? src.slice(0, 500) : undefined;
    }

    private extractVisualMemorySvg(element: Element, rect: DOMRect): VisualMemorySvgSnapshot | undefined {
        const svg = element instanceof SVGSVGElement
            ? element
            : element.querySelector('svg');
        if (!(svg instanceof SVGSVGElement)) {
            return undefined;
        }

        const clone = svg.cloneNode(true) as SVGSVGElement;
        clone.querySelectorAll('script, foreignObject, iframe, object, embed').forEach((node) => node.remove());

        for (const node of Array.from(clone.querySelectorAll('*'))) {
            for (const attr of Array.from(node.attributes)) {
                const name = attr.name.toLowerCase();
                const value = attr.value.trim();
                const lowerValue = value.toLowerCase();
                if (name.startsWith('on') || lowerValue.includes('javascript:')) {
                    node.removeAttribute(attr.name);
                    continue;
                }
                if (name === 'style') {
                    const safeStyle = sanitizeVisualMemorySvgStyleValue(value);
                    if (safeStyle) {
                        node.setAttribute(attr.name, safeStyle);
                    } else {
                        node.removeAttribute(attr.name);
                    }
                }
            }
        }

        for (const attr of Array.from(clone.attributes)) {
            const name = attr.name.toLowerCase();
            const value = attr.value.trim();
            const lowerValue = value.toLowerCase();
            if (name.startsWith('on') || lowerValue.includes('javascript:')) {
                clone.removeAttribute(attr.name);
                continue;
            }
            if (name === 'style') {
                const safeStyle = sanitizeVisualMemorySvgStyleValue(value);
                if (safeStyle) {
                    clone.setAttribute(attr.name, safeStyle);
                } else {
                    clone.removeAttribute(attr.name);
                }
            }
        }

        if (!clone.getAttribute('xmlns')) {
            clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        }

        const width = Math.max(1, Math.round(rect.width));
        const height = Math.max(1, Math.round(rect.height));
        if (!clone.getAttribute('width')) {
            clone.setAttribute('width', String(width));
        }
        if (!clone.getAttribute('height')) {
            clone.setAttribute('height', String(height));
        }
        if (!clone.getAttribute('viewBox')) {
            clone.setAttribute('viewBox', `0 0 ${width} ${height}`);
        }

        const markup = new XMLSerializer().serializeToString(clone);
        if (!markup) {
            return undefined;
        }
        if (markup.length > 300000) {
            return this.extractCompactVisualMemorySvg(svg, width, height);
        }

        return {
            markup,
            width,
            height,
        };
    }

    private extractCompactVisualMemorySvg(
        svg: SVGSVGElement,
        width: number,
        height: number,
    ): VisualMemorySvgSnapshot | undefined {
        const previewHeight = Math.min(height, 1200);
        const compact = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        compact.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        compact.setAttribute('width', String(width));
        compact.setAttribute('height', String(previewHeight));
        compact.setAttribute('viewBox', `0 0 ${width} ${previewHeight}`);

        for (const child of Array.from(svg.childNodes)) {
            const cloned = this.cloneSvgNodeWithinBounds(child, previewHeight);
            if (cloned) {
                compact.appendChild(cloned);
            }
        }

        const markup = new XMLSerializer().serializeToString(compact);
        if (!markup || markup.length > 300000 || compact.childNodes.length === 0) {
            return undefined;
        }

        return {
            markup,
            width,
            height: previewHeight,
        };
    }

    private cloneSvgNodeWithinBounds(node: Node, maxBottom: number): Node | null {
        if (node.nodeType === Node.TEXT_NODE) {
            const text = normalizeText(node.textContent);
            return text ? document.createTextNode(text) : null;
        }
        if (!(node instanceof SVGElement)) {
            return null;
        }

        const originalTagName = node.tagName;
        const tagName = originalTagName.toLowerCase();
        if (tagName === 'script' || tagName === 'foreignobject' || tagName === 'iframe' || tagName === 'object' || tagName === 'embed') {
            return null;
        }

        const isContainer = tagName === 'g' || tagName === 'svg' || tagName === 'defs' || tagName === 'style' || tagName === 'clippath' || tagName === 'lineargradient' || tagName === 'radialgradient' || tagName === 'pattern' || tagName === 'mask';
        if (!isContainer && !this.svgElementIntersectsTopRegion(node, maxBottom)) {
            return null;
        }

        const clone = document.createElementNS('http://www.w3.org/2000/svg', originalTagName);
        for (const attr of Array.from(node.attributes)) {
            const name = attr.name;
            const lowerName = name.toLowerCase();
            const value = attr.value;
            const lowerValue = value.trim().toLowerCase();
            if (lowerName.startsWith('on') || lowerValue.includes('javascript:')) {
                continue;
            }
            if (lowerName === 'style') {
                const safeStyle = sanitizeVisualMemorySvgStyleValue(value);
                if (safeStyle) {
                    clone.setAttribute(name, safeStyle);
                }
                continue;
            }
            clone.setAttribute(name, value);
        }

        if (tagName === 'style') {
            clone.textContent = sanitizeVisualMemorySvgStyleText(node.textContent || '');
            return clone.textContent ? clone : null;
        }

        for (const child of Array.from(node.childNodes)) {
            const clonedChild = this.cloneSvgNodeWithinBounds(child, maxBottom);
            if (clonedChild) {
                clone.appendChild(clonedChild);
            }
        }

        if (clone.childNodes.length === 0 && isContainer) {
            return null;
        }
        return clone;
    }

    private svgElementIntersectsTopRegion(element: SVGElement, maxBottom: number): boolean {
        try {
            if (element instanceof SVGGraphicsElement) {
                const box = element.getBBox();
                if (!Number.isFinite(box.y) || !Number.isFinite(box.height)) {
                    return true;
                }
                return box.y < maxBottom && box.y + box.height >= 0;
            }
        } catch (_error) {
            return true;
        }
        return true;
    }

    private selectVisualMemoryLabel(
        element: Element,
        kind: VisualMemoryCandidate['kind'],
        previewText: string,
        nearbyText: string,
    ): string {
        const candidates = [
            element.getAttribute('aria-label'),
            element.getAttribute('title'),
            element.closest('figure')?.querySelector('figcaption')?.textContent,
            previewText,
            nearbyText,
            this.formatVisualMemoryKind(kind),
        ];
        for (const candidate of candidates) {
            const text = normalizeText(candidate).slice(0, 96);
            if (text) return text;
        }
        return this.formatVisualMemoryKind(kind);
    }

    private buildVisualMemoryEvidenceText(
        pageTitle: string,
        candidate: VisualMemoryCandidate,
    ): string {
        const title = normalizeText(pageTitle) || '当前网页';
        const kindLabel = this.formatVisualMemoryKind(candidate.kind);
        return [
            `视觉证据：${candidate.label || kindLabel}`,
            `类型：${kindLabel} · ${candidate.tagName}`,
            `页面：${title}`,
            candidate.previewText ? `可读文本：${candidate.previewText}` : '',
            candidate.nearbyText ? `附近上下文：${candidate.nearbyText}` : '',
            candidate.source ? `图片来源：${candidate.source}` : '',
            `区域：${candidate.rect.width}x${candidate.rect.height}px，位置 ${candidate.rect.x},${candidate.rect.y}`,
        ].filter(Boolean).join('\n');
    }

    private buildVisualMemorySelectorHint(element: Element): string {
        const tagName = element.tagName.toLowerCase();
        const id = normalizeText((element as HTMLElement).id);
        if (id) return `${tagName}#${id.slice(0, 80)}`;
        const classes = this.getElementClassName(element)
            .split(/\s+/)
            .map((item) => item.trim())
            .filter(Boolean)
            .slice(0, 3);
        return classes.length ? `${tagName}.${classes.join('.')}` : tagName;
    }

    private getElementClassName(element: Element): string {
        const rawClassName = (element as HTMLElement | SVGElement).className;
        if (typeof rawClassName === 'string') {
            return rawClassName;
        }
        const animatedClassName = rawClassName as SVGAnimatedString | undefined;
        return typeof animatedClassName?.baseVal === 'string' ? animatedClassName.baseVal : '';
    }

    private formatVisualMemoryKind(kind: VisualMemoryCandidate['kind']): string {
        switch (kind) {
            case 'chart':
                return '图表';
            case 'canvas':
                return '画布图表';
            case 'image':
                return '图片';
            case 'table':
                return '表格';
            case 'figure':
            default:
                return '视觉区域';
        }
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
        } else if (this.isPassiveContextSuppressedBySiteControls()) {
            this.clearPassiveContextBubble();
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
                const shouldAnimateCachedMatch =
                    cached.match.displayPriority === 'p1' &&
                    this.activeBubbleContextKey !== payload.contextKey;
                this.showContextBubble(
                    cached.matches.length ? cached.matches : [cached.match],
                    payload.contextKey,
                    shouldAnimateCachedMatch,
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
                this.isPassiveContextSuppressedBySiteControls() ||
                this.isContextDismissed(payload.contextKey)
            ) {
                this.clearPassiveContextBubble();
                return;
            }

            const matches = selectContextRecallMatches(response)
                .filter(isExplainablePassiveContextMatch);
            const match = matches[0] || null;
            contextMatchCache.set(payload.contextKey, { match, matches, ts: Date.now() });
            pruneContextMatchCache();

            if (match) {
                this.showContextBubble(
                    matches,
                    payload.contextKey,
                    match.displayPriority === 'p1',
                );
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
        const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        if (activeElement && this.isOwnedContextUiNode(activeElement)) {
            return;
        }

        const payload = this.buildSelectedTextPayload();
        const nextContextKey = payload?.contextKey || null;
        const visibleContextKey =
            this.selectionTriggerElement?.dataset.contextKey ||
            this.selectionCaptureDockElement?.dataset.contextKey ||
            this.selectionCaptureReviewElement?.dataset.contextKey ||
            null;

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
        const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        if (activeElement && this.isOwnedContextUiNode(activeElement)) {
            return;
        }

        const payload = this.buildSelectedTextPayload();
        if (!payload) {
            this.clearSelectedTextTrigger();
            return;
        }

        const existingKey =
            this.selectionTriggerElement?.dataset.contextKey ||
            this.selectionCaptureDockElement?.dataset.contextKey ||
            this.selectionCaptureReviewElement?.dataset.contextKey;
        if (existingKey === payload.contextKey) {
            if (this.selectionTriggerElement) {
                this.placeSelectedTextTrigger(this.selectionTriggerElement, payload.rect);
            }
            if (this.selectionCaptureDockElement) {
                this.placeSelectionMemoryCaptureDock(this.selectionCaptureDockElement, payload.rect);
            }
            return;
        }

        if (this.selectedTextPendingContextKey === payload.contextKey) {
            return;
        }

        this.clearSelectedTextTrigger();
        this.requestSelectedTextTrigger(payload);
    }

    private buildSelectedTextPayload(): SelectedTextContextPayload | null {
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
        const selectionRecallEligible = isContextSelectionTextEligible(selectedText);
        const memoryCaptureEligible = isMemoryCaptureSelectionTextEligible(selectedText);
        if (!selectionRecallEligible && !memoryCaptureEligible) {
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
            selectionRecallEligible,
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
            return !!element?.closest('.pai-context-bubble, .pai-context-card, .pai-context-peek, .pai-context-feedback-layer, .pai-context-selection-trigger, .pai-memory-capture-selection-dock, .pai-memory-capture-note-panel, .pai-visual-memory-preview-panel, .pai-memory-capture-page-chip, .pai-context-toast');
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
        this.clearSelectionMemoryCaptureDock();
        this.clearSelectionMemoryCaptureReview();
    }

    private clearSelectionMemoryCaptureDock(): void {
        this.selectionCaptureDockElement?.remove();
        this.selectionCaptureDockElement = null;
    }

    private clearSelectionMemoryCaptureReview(): void {
        this.selectionCaptureReviewElement?.remove();
        this.selectionCaptureReviewElement = null;
    }

    private showSelectedTextTrigger(
        payload: SelectedTextContextPayload,
        matches: ContextRecallMatch[],
        captureCandidate?: MemoryCaptureCandidateResult | null,
    ): void {
        this.ensureContextBubbleStyles();
        if (!document.body) {
            return;
        }

        const shouldShowRecall = matches.length > 0;
        const shouldShowCapture = Boolean(captureCandidate?.eligible);
        if (!shouldShowRecall && !shouldShowCapture) {
            this.clearSelectedTextTrigger();
            return;
        }

        const existingRecallKey = this.selectionTriggerElement?.dataset.contextKey;
        const existingCaptureKey = this.selectionCaptureDockElement?.dataset.contextKey;
        if (
            (shouldShowRecall ? existingRecallKey === payload.contextKey : !this.selectionTriggerElement) &&
            (shouldShowCapture ? existingCaptureKey === payload.contextKey : !this.selectionCaptureDockElement)
        ) {
            if (this.selectionTriggerElement) {
                this.placeSelectedTextTrigger(this.selectionTriggerElement, payload.rect);
            }
            if (this.selectionCaptureDockElement) {
                this.placeSelectionMemoryCaptureDock(this.selectionCaptureDockElement, payload.rect);
            }
            return;
        }

        this.clearSelectedTextTrigger();

        if (shouldShowRecall) {
            const trigger = document.createElement('div');
            trigger.className = 'pai-context-selection-trigger';
            trigger.dataset.contextKey = payload.contextKey;
            trigger.addEventListener('mousedown', (event) => {
                event.preventDefault();
                event.stopPropagation();
            });

            const recallButton = document.createElement('button');
            recallButton.type = 'button';
            recallButton.className = 'pai-context-selection-action pai-context-selection-recall';
            recallButton.setAttribute('aria-label', '用 Personal AI 查找关联记忆');
            recallButton.title = '用 Personal AI 查找关联记忆';

            const iconImg = document.createElement('img');
            iconImg.src = chrome.runtime.getURL('icons/icon48.png');
            iconImg.alt = '';
            iconImg.setAttribute('aria-hidden', 'true');
            recallButton.appendChild(iconImg);

            recallButton.addEventListener('click', (event) => {
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
            trigger.appendChild(recallButton);

            document.body.appendChild(trigger);
            this.selectionTriggerElement = trigger;
            this.placeSelectedTextTrigger(trigger, payload.rect);
        }

        if (shouldShowCapture && captureCandidate) {
            this.showSelectionMemoryCaptureDock(payload, captureCandidate);
        }
    }

    private placeSelectedTextTrigger(trigger: HTMLElement, rect: DOMRect): void {
        const size = Math.max(28, trigger.offsetWidth || 28);
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

    private showSelectionMemoryCaptureDock(
        payload: SelectedTextContextPayload,
        candidate: MemoryCaptureCandidateResult,
    ): void {
        this.ensureContextBubbleStyles();
        if (!document.body) {
            return;
        }

        this.clearSelectionMemoryCaptureDock();

        const dock = document.createElement('button');
        dock.type = 'button';
        dock.className = 'pai-memory-capture-selection-dock';
        dock.dataset.contextKey = payload.contextKey;
        dock.setAttribute('aria-label', '入库这段资料');
        dock.title = `入库这段资料${candidate.reasons?.length ? `：${candidate.reasons.slice(0, 2).join('，')}` : ''}`;

        const plus = document.createElement('span');
        plus.className = 'pai-memory-capture-selection-dock-plus';
        plus.textContent = '+';
        dock.appendChild(plus);

        const label = document.createElement('span');
        label.className = 'pai-memory-capture-selection-dock-label';
        label.textContent = '入库';
        dock.appendChild(label);

        const logo = document.createElement('img');
        logo.className = 'pai-memory-capture-selection-dock-logo';
        logo.src = chrome.runtime.getURL('icons/icon48.png');
        logo.alt = '';
        logo.setAttribute('aria-hidden', 'true');
        dock.appendChild(logo);

        dock.addEventListener('mousedown', (event) => {
            event.preventDefault();
            event.stopPropagation();
        });
        dock.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            this.showSelectedTextCaptureReview(payload, candidate);
        });

        document.body.appendChild(dock);
        this.selectionCaptureDockElement = dock;
        this.placeSelectionMemoryCaptureDock(dock, payload.rect);
    }

    private placeSelectionMemoryCaptureDock(dock: HTMLElement, rect: DOMRect): void {
        const top = Math.max(
            24,
            Math.min(window.innerHeight - 24, rect.top + rect.height / 2),
        );
        dock.style.top = `${Math.round(top)}px`;
    }

    private showSelectedTextCaptureReview(
        payload: SelectedTextContextPayload,
        candidate: MemoryCaptureCandidateResult,
    ): void {
        this.ensureContextBubbleStyles();
        if (!document.body) {
            return;
        }

        if (this.selectionCaptureReviewElement?.dataset.contextKey === payload.contextKey) {
            const textarea = this.selectionCaptureReviewElement.querySelector('textarea');
            textarea?.focus();
            return;
        }

        if (this.selectionTriggerTimer !== null) {
            window.clearTimeout(this.selectionTriggerTimer);
            this.selectionTriggerTimer = null;
        }
        this.clearSelectionMemoryCaptureReview();

        const panel = document.createElement('form');
        panel.className = 'pai-memory-capture-note-panel';
        panel.dataset.contextKey = payload.contextKey;
        panel.setAttribute('aria-label', '保存选中资料');
        panel.addEventListener('mousedown', (event) => {
            event.stopPropagation();
        });
        panel.addEventListener('submit', (event) => {
            event.preventDefault();
            event.stopPropagation();
            const note = noteInput.value.trim();
            this.submitSelectedTextCapture(payload, note, panel);
        });

        const title = document.createElement('div');
        title.className = 'pai-memory-capture-note-title';
        title.textContent = '保存这段资料';
        panel.appendChild(title);

        const preview = document.createElement('div');
        preview.className = 'pai-memory-capture-note-preview';
        preview.textContent = normalizeText(payload.snippet).slice(0, 180);
        panel.appendChild(preview);

        if (candidate.reasons?.length) {
            const reasons = document.createElement('div');
            reasons.className = 'pai-memory-capture-note-reasons';
            reasons.textContent = candidate.reasons.slice(0, 2).join('，');
            panel.appendChild(reasons);
        }

        const noteInput = document.createElement('textarea');
        noteInput.className = 'pai-memory-capture-note-input';
        noteInput.name = 'note';
        noteInput.rows = 3;
        noteInput.maxLength = 800;
        noteInput.placeholder = '备注（可选）';
        panel.appendChild(noteInput);

        const error = document.createElement('div');
        error.className = 'pai-memory-capture-note-error';
        error.setAttribute('role', 'alert');
        error.hidden = true;
        panel.appendChild(error);

        const actions = document.createElement('div');
        actions.className = 'pai-memory-capture-note-actions';

        const cancel = document.createElement('button');
        cancel.type = 'button';
        cancel.className = 'pai-memory-capture-note-button pai-memory-capture-note-cancel';
        cancel.textContent = '取消';
        cancel.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            this.clearSelectionMemoryCaptureReview();
            this.selectionCaptureDockElement?.focus();
        });
        actions.appendChild(cancel);

        const save = document.createElement('button');
        save.type = 'submit';
        save.className = 'pai-memory-capture-note-button pai-memory-capture-note-save';
        save.textContent = '保存';
        actions.appendChild(save);
        panel.appendChild(actions);

        document.body.appendChild(panel);
        this.selectionCaptureReviewElement = panel;
        this.placeSelectionMemoryCaptureReview(panel, payload.rect);
        window.requestAnimationFrame(() => noteInput.focus());
    }

    private placeSelectionMemoryCaptureReview(panel: HTMLElement, rect: DOMRect): void {
        const panelHeight = Math.max(180, panel.offsetHeight || 180);
        const top = Math.max(
            16,
            Math.min(window.innerHeight - panelHeight - 16, rect.top + rect.height / 2 - 88),
        );
        panel.style.top = `${Math.round(top)}px`;
    }

    private requestSelectedTextTrigger(payload: SelectedTextContextPayload): void {
        const requestId = ++this.selectedTextRequestId;
        this.selectedTextPendingContextKey = payload.contextKey;
        if (!payload.selectionRecallEligible) {
            this.requestMemoryCaptureSelectionCandidate(payload, [], requestId);
            return;
        }

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
                const currentPayload = this.buildSelectedTextPayload();
                if (currentPayload && currentPayload.contextKey === payload.contextKey) {
                    this.requestMemoryCaptureSelectionCandidate(currentPayload, [], requestId);
                }
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
            this.requestMemoryCaptureSelectionCandidate(currentPayload, matches);
        });
    }

    private requestMemoryCaptureSelectionCandidate(
        payload: SelectedTextContextPayload,
        matches: ContextRecallMatch[],
        requestId = this.selectedTextRequestId,
    ): void {
        chrome.runtime.sendMessage({
            type: 'MEMORY_CAPTURE_SCORE_SELECTION',
            request: this.buildMemoryCaptureSelectionRequest(payload),
        }, (response) => {
            if (requestId !== this.selectedTextRequestId) {
                return;
            }
            this.selectedTextPendingContextKey = null;
            const currentPayload = this.buildSelectedTextPayload();
            if (!currentPayload || currentPayload.contextKey !== payload.contextKey) {
                this.clearSelectedTextTrigger();
                return;
            }

            let captureCandidate: MemoryCaptureCandidateResult | null = null;
            if (!chrome.runtime.lastError && response?.success) {
                captureCandidate = response.result || null;
            }

            if (matches.length === 0 && !captureCandidate?.eligible) {
                this.clearSelectedTextTrigger();
                return;
            }

            this.showSelectedTextTrigger(currentPayload, matches, captureCandidate);
        });
    }

    private buildMemoryCaptureSelectionRequest(
        payload: ContextMatchPayload,
    ): Record<string, unknown> {
        const sourceContext = payload.sourceContext || {};
        return {
            sourceKind: 'selection',
            sourceUrl: payload.url,
            sourceTitle: payload.title,
            selectedText: payload.snippet,
            nearbyText: payload.keywords?.slice(1).join('\n'),
            entityHints: payload.entityHints,
            scope: 'work',
            interactions: {
                selectedText: true,
            },
            metadata: {
                contextType: payload.contextType,
                host: sourceContext.host || window.location.hostname,
                groupId: sourceContext.groupId,
                conversationId: sourceContext.conversationId,
                messageId: sourceContext.messageId,
                issueKey: sourceContext.issueKey,
            },
        };
    }

    private extractVisualMemoryTable(element: Element): VisualMemoryTableSnapshot | undefined {
        const table = element.tagName.toLowerCase() === 'table'
            ? element
            : element.querySelector('table');
        if (!table) {
            return undefined;
        }

        const rawRows = Array.from(table.querySelectorAll('tr'))
            .map((row) => Array.from(row.querySelectorAll('th, td'))
                .map((cell) => normalizeText(cell.textContent).slice(0, 220)))
            .filter((row) => row.some(Boolean));
        if (rawRows.length === 0) {
            return undefined;
        }

        const headerRow = table.querySelector('tr');
        const hasHeaderCells = Boolean(headerRow?.querySelector('th'));
        const headers = hasHeaderCells ? rawRows[0] : [];
        const rows = (hasHeaderCells ? rawRows.slice(1) : rawRows).slice(0, 20);
        const columnCount = Math.max(
            headers.length,
            ...rows.map((row) => row.length),
        );

        return {
            headers,
            rows: rows.map((row) => row.slice(0, 12)),
            rowCount: rawRows.length - (hasHeaderCells ? 1 : 0),
            columnCount: Math.min(columnCount, 12),
            truncated: rawRows.length - (hasHeaderCells ? 1 : 0) > rows.length || columnCount > 12,
        };
    }

    private formatVisualMemoryTableText(table: VisualMemoryTableSnapshot): string {
        const lines: string[] = [];
        if (table.headers.length) {
            lines.push(table.headers.join(' | '));
        }
        for (const row of table.rows) {
            lines.push(row.join(' | '));
        }
        if (table.truncated) {
            lines.push(`... 共 ${table.rowCount} 行，${table.columnCount} 列，已截取前 ${table.rows.length} 行`);
        }
        return normalizeText(lines.join('\n'));
    }

    private submitSelectedTextCapture(
        payload: SelectedTextContextPayload,
        note: string,
        panel: HTMLElement,
    ): void {
        const error = panel.querySelector<HTMLElement>('.pai-memory-capture-note-error');
        const saveButton = panel.querySelector<HTMLButtonElement>('.pai-memory-capture-note-save');
        if (
            normalizeContextPageUrl(window.location.href) !== payload.url ||
            this.isSensitiveContextPage() ||
            this.isContextDismissed(payload.contextKey)
        ) {
            if (error) {
                error.textContent = '当前页面上下文已变化，未保存。';
                error.hidden = false;
            }
            return;
        }

        if (error) {
            error.textContent = '';
            error.hidden = true;
        }
        if (saveButton) {
            saveButton.disabled = true;
            saveButton.textContent = '保存中...';
        }

        chrome.runtime.sendMessage({
            type: 'MEMORY_CAPTURE_SAVE_SELECTION',
            request: {
                ...this.buildMemoryCaptureSelectionRequest(payload),
                captureMode: 'manual',
                captureReason: '用户点击右侧半露出 + 入库按钮',
                note,
            },
        }, (response) => {
            if (chrome.runtime.lastError || !response?.success) {
                const message = chrome.runtime.lastError?.message || response?.error || '保存失败';
                if (saveButton) {
                    saveButton.disabled = false;
                    saveButton.textContent = '保存';
                }
                if (error) {
                    error.textContent = `资料记忆保存失败：${message}`;
                    error.hidden = false;
                } else {
                    this.showContextToast(`资料记忆保存失败：${message}`);
                }
                return;
            }

            this.clearSelectedTextTrigger();
            const duplicate = Boolean(response.result?.capsule?.duplicate);
            this.showContextToast(
                duplicate ? '这段资料已在记忆中' : '已保存为资料记忆',
                buildSourceMemoryDetailToastAction(response.result?.capsule?.id),
                { durationMs: 5000 },
            );
        });
    }

    private resetPageMemoryCaptureState(): void {
        this.pageCaptureStartedAt = Date.now();
        this.pageCaptureMaxScrollDepth = 0;
        this.pageCaptureCopiedText = false;
        this.pageCaptureShownContextKey = null;
        this.pageCaptureStoredContextKey = null;
        this.clearVisualMemoryPreview();
        this.invalidatePageMemoryCaptureRequest();
    }

    private invalidatePageMemoryCaptureRequest(): void {
        this.pageCaptureRequestId++;
        this.pageCapturePendingContextKey = null;
    }

    private schedulePageMemoryCaptureEvaluation(delayMs: number): void {
        if (this.pageCaptureTimer !== null) {
            window.clearTimeout(this.pageCaptureTimer);
        }

        this.pageCaptureTimer = window.setTimeout(() => {
            this.pageCaptureTimer = null;
            this.evaluatePageMemoryCaptureCandidate();
        }, delayMs);
    }

    private updatePageMemoryCaptureScrollDepth(): void {
        const scrollTop = Math.max(window.scrollY, document.documentElement.scrollTop, 0);
        const viewportHeight = Math.max(window.innerHeight, 1);
        const scrollHeight = Math.max(
            document.documentElement.scrollHeight,
            document.body?.scrollHeight || 0,
            viewportHeight,
        );
        const depth = Math.min(1, (scrollTop + viewportHeight) / Math.max(scrollHeight, 1));
        this.pageCaptureMaxScrollDepth = Math.max(this.pageCaptureMaxScrollDepth, depth);
    }

    private getPageMemoryCaptureDwellMs(): number {
        return Math.max(0, Date.now() - this.pageCaptureStartedAt);
    }

    private evaluatePageMemoryCaptureCandidate(): void {
        const payload = this.buildPageMemoryCaptureRequest();
        if (!payload) {
            return;
        }
        if (this.pageCaptureStoredContextKey === payload.contextKey) {
            return;
        }
        if (this.pageCapturePendingContextKey === payload.contextKey) {
            return;
        }

        const requestId = ++this.pageCaptureRequestId;
        this.pageCapturePendingContextKey = payload.contextKey;
        chrome.runtime.sendMessage({
            type: 'MEMORY_CAPTURE_SCORE_PAGE',
            request: payload.request,
        }, (response) => {
            if (requestId !== this.pageCaptureRequestId) {
                return;
            }
            this.pageCapturePendingContextKey = null;
            const currentPayload = this.buildPageMemoryCaptureRequest();
            if (!currentPayload || currentPayload.contextKey !== payload.contextKey) {
                this.clearPageMemoryCaptureChip();
                return;
            }
            if (chrome.runtime.lastError || !response?.success || !response.result?.eligible) {
                this.clearPageMemoryCaptureChip();
                return;
            }
            const autoDecision = this.getPageMemoryCaptureAutoDecision(response.result, currentPayload.request);
            if (autoDecision.shouldAutoSave) {
                this.autoSavePageMemoryCapture(currentPayload, autoDecision.reason);
                return;
            }
            this.showPageMemoryCaptureChip(currentPayload, response.result);
            this.schedulePageMemoryCaptureAutoRecheck(currentPayload.request);
        });
    }

    private buildPageMemoryCaptureRequest(): { contextKey: string; request: Record<string, unknown> } | null {
        if (this.isSensitiveContextPage()) {
            return null;
        }
        if (this.isPassiveContextSuppressedBySiteControls()) {
            return null;
        }

        this.updatePageMemoryCaptureScrollDepth();
        const dwellMs = this.getPageMemoryCaptureDwellMs();
        const hasIntentSignal =
            this.pageCaptureCopiedText ||
            this.pageCaptureMaxScrollDepth >= 0.6 ||
            dwellMs >= PAGE_MEMORY_CAPTURE_MIN_DWELL_MS;
        if (!hasIntentSignal) {
            return null;
        }

        const pageContent = this.extractPageContent();
        const visualCandidate = this.findVisualMemoryCandidate();
        if (
            (!pageContent || pageContent.wordCount < PAGE_MEMORY_CAPTURE_MIN_WORDS) &&
            !visualCandidate
        ) {
            return null;
        }

        const sourceUrl = normalizeContextPageUrl(pageContent?.url || window.location.href);
        if (!sourceUrl) {
            return null;
        }

        const snapshot = buildPassiveContextSnapshot(document, window.location);
        const sourceTitle = normalizeText(pageContent?.title) || normalizeText(document.title) || sourceUrl;
        if (visualCandidate) {
            const visualText = this.buildVisualMemoryEvidenceText(sourceTitle, visualCandidate);
            const contextKey = [
                'visual-capture',
                sourceUrl,
                this.createContextSignature(`${sourceTitle}:${visualCandidate.selectorHint}:${visualText.slice(0, 600)}`),
            ].join(':');

            return {
                contextKey,
                request: {
                    sourceKind: 'visual_memory',
                    sourceUrl,
                    sourceTitle,
                    text: visualText,
                    entityHints: snapshot ? this.toPassiveRecallEntityHints(snapshot) : undefined,
                    scope: 'work',
                    interactions: {
                        dwellMs,
                        activeMs: dwellMs,
                        scrollDepth: this.pageCaptureMaxScrollDepth,
                        copiedText: this.pageCaptureCopiedText,
                    },
                    metadata: {
                        contextType: 'webpage_visual',
                        host: window.location.hostname,
                        wordCount: this.countWords(visualText),
                        visualMemory: {
                            kind: visualCandidate.kind,
                            tagName: visualCandidate.tagName,
                            label: visualCandidate.label,
                            selectorHint: visualCandidate.selectorHint,
                            rect: visualCandidate.rect,
                            score: visualCandidate.score,
                            source: visualCandidate.source,
                            previewText: visualCandidate.previewText,
                            nearbyText: visualCandidate.nearbyText,
                            table: visualCandidate.table,
                            svg: visualCandidate.svg,
                            detection: 'dom_visual_candidate',
                        },
                    },
                },
            };
        }

        if (!pageContent) {
            return null;
        }

        const contextKey = [
            'page-capture',
            sourceUrl,
            this.createContextSignature(`${pageContent.title}:${pageContent.mainContent.slice(0, 600)}`),
        ].join(':');

        return {
            contextKey,
            request: {
                sourceKind: 'webpage',
                sourceUrl,
                sourceTitle,
                text: pageContent.mainContent,
                entityHints: snapshot ? this.toPassiveRecallEntityHints(snapshot) : undefined,
                scope: 'work',
                interactions: {
                    dwellMs,
                    activeMs: dwellMs,
                    scrollDepth: this.pageCaptureMaxScrollDepth,
                    copiedText: this.pageCaptureCopiedText,
                },
                metadata: {
                    contextType: 'webpage',
                    host: window.location.hostname,
                    wordCount: pageContent.wordCount,
                },
            },
        };
    }

    private getPageMemoryCaptureAutoDecision(
        candidate: MemoryCaptureCandidateResult,
        request: Record<string, unknown>,
    ): { shouldAutoSave: boolean; reason: string } {
        const interactions = (request.interactions || {}) as Record<string, unknown>;
        const metadata = (request.metadata || {}) as Record<string, unknown>;
        if (request.sourceKind === 'visual_memory') {
            return { shouldAutoSave: false, reason: '' };
        }
        const dwellMs = Number(interactions.dwellMs || 0);
        const scrollDepth = Number(interactions.scrollDepth || 0);
        const copiedText = Boolean(interactions.copiedText);
        const wordCount = Number(metadata.wordCount || 0);
        const score = Number(candidate.score || 0);

        if (wordCount < PAGE_MEMORY_CAPTURE_AUTO_MIN_WORDS) {
            return { shouldAutoSave: false, reason: '' };
        }

        if (
            copiedText &&
            dwellMs >= PAGE_MEMORY_CAPTURE_AUTO_COPY_DWELL_MS &&
            scrollDepth >= 0.85 &&
            score >= 0.78
        ) {
            return {
                shouldAutoSave: true,
                reason: '你复制了页面内容、停留较久并阅读到很深位置',
            };
        }

        if (dwellMs >= PAGE_MEMORY_CAPTURE_AUTO_DEEP_READ_MS && scrollDepth >= 0.9 && score >= 0.78) {
            return {
                shouldAutoSave: true,
                reason: '浏览时间很久且阅读到页面深处',
            };
        }

        if (dwellMs >= PAGE_MEMORY_CAPTURE_AUTO_LONG_READ_MS && scrollDepth >= 0.75 && score >= 0.78) {
            return {
                shouldAutoSave: true,
                reason: '在当前页面停留非常久',
            };
        }

        return { shouldAutoSave: false, reason: '' };
    }

    private schedulePageMemoryCaptureAutoRecheck(request: Record<string, unknown>): void {
        const interactions = (request.interactions || {}) as Record<string, unknown>;
        const metadata = (request.metadata || {}) as Record<string, unknown>;
        if (request.sourceKind === 'visual_memory') {
            return;
        }
        const dwellMs = Number(interactions.dwellMs || 0);
        const wordCount = Number(metadata.wordCount || 0);
        if (wordCount < PAGE_MEMORY_CAPTURE_AUTO_MIN_WORDS) {
            return;
        }
        if (dwellMs >= PAGE_MEMORY_CAPTURE_AUTO_LONG_READ_MS) {
            return;
        }
        let nextThreshold = PAGE_MEMORY_CAPTURE_AUTO_LONG_READ_MS;
        if (dwellMs < PAGE_MEMORY_CAPTURE_AUTO_COPY_DWELL_MS) {
            nextThreshold = PAGE_MEMORY_CAPTURE_AUTO_COPY_DWELL_MS;
        } else if (dwellMs < PAGE_MEMORY_CAPTURE_AUTO_DEEP_READ_MS) {
            nextThreshold = PAGE_MEMORY_CAPTURE_AUTO_DEEP_READ_MS;
        }
        const delayMs = Math.max(
            5_000,
            Math.min(nextThreshold - dwellMs + 500, PAGE_MEMORY_CAPTURE_AUTO_RECHECK_MS),
        );
        this.schedulePageMemoryCaptureEvaluation(delayMs);
    }

    private showPageMemoryCaptureChip(
        payload: { contextKey: string; request: Record<string, unknown> },
        candidate: MemoryCaptureCandidateResult,
    ): void {
        this.ensureContextBubbleStyles();
        if (!document.body) {
            return;
        }

        const existingKey = this.pageCaptureChipElement?.dataset.contextKey;
        if (existingKey === payload.contextKey) {
            return;
        }

        this.clearPageMemoryCaptureChip();
        const isVisualCapture = payload.request.sourceKind === 'visual_memory';
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'pai-memory-capture-page-chip';
        chip.dataset.contextKey = payload.contextKey;
        chip.dataset.captureKind = isVisualCapture ? 'visual' : 'webpage';
        chip.setAttribute('aria-label', '入库当前页面资料');
        chip.title = `入库当前页面资料${candidate.reasons?.length ? `：${candidate.reasons.slice(0, 2).join('，')}` : ''}`;

        const plus = document.createElement('span');
        plus.className = 'pai-memory-capture-selection-dock-plus';
        plus.textContent = '+';
        chip.appendChild(plus);

        const label = document.createElement('span');
        label.className = 'pai-memory-capture-selection-dock-label';
        label.textContent = '入库';
        chip.appendChild(label);

        const logo = document.createElement('img');
        logo.className = 'pai-memory-capture-selection-dock-logo';
        logo.src = chrome.runtime.getURL('icons/icon48.png');
        logo.alt = '';
        logo.setAttribute('aria-hidden', 'true');
        chip.appendChild(logo);

        chip.addEventListener('mousedown', (event) => {
            event.preventDefault();
            event.stopPropagation();
        });
        chip.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            this.savePageMemoryCapture(payload);
        });

        document.body.appendChild(chip);
        this.pageCaptureChipElement = chip;
        this.pageCaptureShownContextKey = payload.contextKey;
        this.placePageMemoryCaptureDock(chip);
    }

    private clearPageMemoryCaptureChip(): void {
        this.pageCaptureChipElement?.remove();
        this.pageCaptureChipElement = null;
    }

    private clearVisualMemoryPreview(): void {
        this.visualMemoryPreviewElement?.remove();
        this.visualMemoryPreviewElement = null;
    }

    private placePageMemoryCaptureDock(dock: HTMLElement): void {
        const top = Math.max(
            72,
            Math.min(window.innerHeight - 24, 112),
        );
        dock.style.top = `${Math.round(top)}px`;
    }

    private autoSavePageMemoryCapture(
        payload: { contextKey: string; request: Record<string, unknown> },
        reason: string,
    ): void {
        if (this.pageCaptureStoredContextKey === payload.contextKey) {
            return;
        }

        chrome.runtime.sendMessage({
            type: 'MEMORY_CAPTURE_SAVE_PAGE',
            request: {
                ...payload.request,
                captureMode: 'auto',
                captureReason: `自动入库：${reason}`,
                note: '',
            },
        }, (response) => {
            if (chrome.runtime.lastError || !response?.success) {
                return;
            }

            this.pageCaptureStoredContextKey = payload.contextKey;
            this.clearPageMemoryCaptureChip();
            const capsuleId = response.result?.capsule?.id;
            const duplicate = Boolean(response.result?.capsule?.duplicate);
            if (duplicate) {
                this.showContextToast(
                    '当前页面已在记忆中',
                    buildSourceMemoryDetailToastAction(capsuleId),
                    { durationMs: 5000 },
                );
                return;
            }

            this.showContextToast(
                '已存入记忆',
                capsuleId
                    ? {
                        label: '撤销',
                        ariaLabel: '撤销本次自动入库',
                        onClick: () => this.dismissAutoPageMemoryCapture(capsuleId, payload.contextKey),
                    }
                    : undefined,
                {
                    durationMs: 5000,
                    variant: 'memory-capture-auto',
                    detailMessage: `因为${reason}，本网页信息已自动存入记忆库`,
                },
            );
        });
    }

    private dismissAutoPageMemoryCapture(capsuleId: string, contextKey: string): void {
        chrome.runtime.sendMessage({
            type: 'MEMORY_CAPTURE_DISMISS_CAPSULE',
            capsuleId,
            reason: '用户撤销自动入库',
        }, (response) => {
            if (chrome.runtime.lastError || !response?.success) {
                const message = chrome.runtime.lastError?.message || response?.error || '撤销失败';
                this.showContextToast(`撤销自动入库失败：${message}`);
                return;
            }

            if (this.pageCaptureStoredContextKey === contextKey) {
                this.pageCaptureStoredContextKey = null;
            }
            this.clearContextToast();
            this.showContextToast('已撤销本网页自动入库');
        });
    }

    private saveVisualMemoryCapture(payload: { contextKey: string; request: Record<string, unknown> }): void {
        if (this.pageCaptureStoredContextKey === payload.contextKey) {
            return;
        }

        const chip = this.pageCaptureChipElement instanceof HTMLButtonElement
            ? this.pageCaptureChipElement
            : null;
        if (chip) {
            chip.disabled = true;
            chip.setAttribute('aria-busy', 'true');
            chip.title = '正在保存视觉证据...';
        }

        chrome.runtime.sendMessage({
            type: 'MEMORY_CAPTURE_SAVE_PAGE',
            request: {
                ...payload.request,
                captureMode: 'manual',
                captureReason: '用户点击网页 + 入库保存视觉证据',
                note: '',
            },
        }, (response) => {
            if (chrome.runtime.lastError || !response?.success) {
                const message = chrome.runtime.lastError?.message || response?.error || '保存失败';
                if (chip) {
                    chip.disabled = false;
                    chip.removeAttribute('aria-busy');
                    chip.title = '入库当前页面资料';
                }
                this.showContextToast(`视觉证据保存失败：${message}`);
                return;
            }

            this.clearPageMemoryCaptureChip();
            this.pageCaptureStoredContextKey = payload.contextKey;
            const result = asPlainObject(response.result);
            const capsule = asPlainObject(result?.capsule);
            const capsuleId = typeof capsule?.id === 'string' ? capsule.id : '';
            const duplicate = Boolean(capsule?.duplicate);
            this.showContextToast(
                duplicate ? '这条视觉证据已在记忆中' : '已保存视觉证据',
                capsuleId
                    ? {
                        label: '预览',
                        ariaLabel: '预览已入库视觉证据并补充备注',
                        onClick: () => this.showVisualMemorySavedPreview(payload, capsule),
                    }
                    : undefined,
                { durationMs: 6500 },
            );
        });
    }

    private showVisualMemorySavedPreview(
        payload: { contextKey: string; request: Record<string, unknown> },
        capsule: Record<string, unknown> | null,
    ): void {
        this.ensureContextBubbleStyles();
        if (!document.body) {
            return;
        }

        this.clearVisualMemoryPreview();

        const capsuleId = typeof capsule?.id === 'string' ? capsule.id : '';
        const metadata = asPlainObject(payload.request.metadata);
        const visualMemory = asPlainObject(metadata?.visualMemory);
        const rect = asPlainObject(visualMemory?.rect);
        const visualKind = normalizeText(
            typeof visualMemory?.kind === 'string'
                ? this.formatVisualMemoryKind(visualMemory.kind as VisualMemoryCandidate['kind'])
                : '视觉证据',
        );
        const tagName = normalizeText(typeof visualMemory?.tagName === 'string' ? visualMemory.tagName : '');
        const titleText = normalizeText(
            typeof payload.request.sourceTitle === 'string' ? payload.request.sourceTitle : document.title,
        ) || '当前网页';
        const sourceUrl = normalizeText(
            typeof payload.request.sourceUrl === 'string' ? payload.request.sourceUrl : window.location.href,
        );
        const previewText = normalizeText(
            typeof capsule?.contentPreview === 'string'
                ? capsule.contentPreview
                : typeof payload.request.text === 'string'
                    ? payload.request.text
                    : '',
        );
        const summaryText = normalizeText(typeof capsule?.summary === 'string' ? capsule.summary : '');
        const sizeText = rect
            ? `${Math.round(Number(rect.width || 0))}x${Math.round(Number(rect.height || 0))} px`
            : '';

        const panel = document.createElement('form');
        panel.className = 'pai-memory-capture-note-panel pai-visual-memory-preview-panel';
        panel.dataset.contextKey = payload.contextKey;
        panel.setAttribute('aria-label', '已保存视觉证据');
        panel.addEventListener('mousedown', (event) => {
            event.stopPropagation();
        });
        panel.addEventListener('submit', (event) => {
            event.preventDefault();
            event.stopPropagation();
            this.submitVisualMemoryNote(capsuleId, noteInput.value.trim(), panel);
        });

        const header = document.createElement('div');
        header.className = 'pai-visual-memory-preview-header';
        const heading = document.createElement('div');
        heading.className = 'pai-memory-capture-note-title';
        heading.textContent = '已入库：视觉证据';
        header.appendChild(heading);
        const close = document.createElement('button');
        close.type = 'button';
        close.className = 'pai-visual-memory-preview-close';
        close.setAttribute('aria-label', '关闭视觉证据预览');
        close.textContent = '×';
        close.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            this.clearVisualMemoryPreview();
        });
        header.appendChild(close);
        panel.appendChild(header);

        const source = document.createElement('div');
        source.className = 'pai-visual-memory-preview-source';
        source.textContent = sourceUrl ? `${titleText} · ${sourceUrl}` : titleText;
        panel.appendChild(source);

        const visualCard = document.createElement('div');
        visualCard.className = 'pai-visual-memory-preview-card';
        const visualBadge = document.createElement('div');
        visualBadge.className = 'pai-visual-memory-preview-badge';
        visualBadge.textContent = visualKind;
        visualCard.appendChild(visualBadge);
        const visualMeta = document.createElement('div');
        visualMeta.className = 'pai-visual-memory-preview-meta';
        visualMeta.textContent = [tagName, sizeText].filter(Boolean).join(' · ') || '网页视觉区域';
        visualCard.appendChild(visualMeta);
        panel.appendChild(visualCard);

        const preview = document.createElement('div');
        preview.className = 'pai-memory-capture-note-preview pai-visual-memory-preview-text';
        preview.textContent = previewText || summaryText || '已保存当前网页中的视觉证据。';
        panel.appendChild(preview);

        if (summaryText && summaryText !== previewText) {
            const summary = document.createElement('div');
            summary.className = 'pai-visual-memory-preview-summary';
            summary.textContent = `当前摘要：${summaryText}`;
            panel.appendChild(summary);
        }

        const noteInput = document.createElement('textarea');
        noteInput.className = 'pai-memory-capture-note-input';
        noteInput.name = 'note';
        noteInput.rows = 3;
        noteInput.maxLength = 800;
        noteInput.placeholder = '给这条视觉证据补充备注（可选）';
        panel.appendChild(noteInput);

        const error = document.createElement('div');
        error.className = 'pai-memory-capture-note-error';
        error.setAttribute('role', 'alert');
        error.hidden = true;
        panel.appendChild(error);

        const status = document.createElement('div');
        status.className = 'pai-visual-memory-preview-status';
        status.hidden = true;
        panel.appendChild(status);

        const actions = document.createElement('div');
        actions.className = 'pai-memory-capture-note-actions';

        const detail = document.createElement('button');
        detail.type = 'button';
        detail.className = 'pai-memory-capture-note-button';
        detail.textContent = '查看详情';
        detail.disabled = !capsuleId;
        detail.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            if (!capsuleId) return;
            const url = chrome.runtime.getURL(
                `memory-exploring.html#/source-memory/${encodeURIComponent(capsuleId)}`,
            );
            window.open(url, '_blank', 'noopener');
        });
        actions.appendChild(detail);

        const save = document.createElement('button');
        save.type = 'submit';
        save.className = 'pai-memory-capture-note-button pai-memory-capture-note-save';
        save.textContent = '保存备注';
        save.disabled = !capsuleId;
        actions.appendChild(save);
        panel.appendChild(actions);

        document.body.appendChild(panel);
        this.visualMemoryPreviewElement = panel;
        this.placeVisualMemoryPreview(panel);
        window.requestAnimationFrame(() => noteInput.focus());
    }

    private submitVisualMemoryNote(capsuleId: string, note: string, panel: HTMLElement): void {
        const error = panel.querySelector<HTMLElement>('.pai-memory-capture-note-error');
        const status = panel.querySelector<HTMLElement>('.pai-visual-memory-preview-status');
        const saveButton = panel.querySelector<HTMLButtonElement>('.pai-memory-capture-note-save');
        if (!capsuleId) {
            if (error) {
                error.textContent = '缺少入库记录 ID，暂时无法保存备注。';
                error.hidden = false;
            }
            return;
        }
        if (!note) {
            if (error) {
                error.textContent = '备注为空；可以直接关闭预览，或输入备注后保存。';
                error.hidden = false;
            }
            return;
        }

        if (error) {
            error.textContent = '';
            error.hidden = true;
        }
        if (status) {
            status.textContent = '';
            status.hidden = true;
        }
        if (saveButton) {
            saveButton.disabled = true;
            saveButton.textContent = '保存中...';
        }

        chrome.runtime.sendMessage({
            type: 'MEMORY_CAPTURE_UPDATE_CAPSULE_NOTE',
            capsuleId,
            note,
        }, (response) => {
            if (chrome.runtime.lastError || !response?.success) {
                const message = chrome.runtime.lastError?.message || response?.error || '保存失败';
                if (saveButton) {
                    saveButton.disabled = false;
                    saveButton.textContent = '保存备注';
                }
                if (error) {
                    error.textContent = `备注保存失败：${message}`;
                    error.hidden = false;
                } else {
                    this.showContextToast(`备注保存失败：${message}`);
                }
                return;
            }

            if (saveButton) {
                saveButton.disabled = false;
                saveButton.textContent = '已保存';
            }
            if (status) {
                status.textContent = '备注已写入这条视觉证据，后续检索会带上这条说明。';
                status.hidden = false;
            }
            this.showContextToast('视觉证据备注已保存');
            window.setTimeout(() => {
                if (saveButton && this.visualMemoryPreviewElement === panel) {
                    saveButton.textContent = '保存备注';
                }
            }, 1200);
        });
    }

    private placeVisualMemoryPreview(panel: HTMLElement): void {
        const panelHeight = Math.max(260, panel.offsetHeight || 260);
        const top = Math.max(
            72,
            Math.min(window.innerHeight - panelHeight - 16, 92),
        );
        panel.style.top = `${Math.round(top)}px`;
    }

    private savePageMemoryCapture(payload: { contextKey: string; request: Record<string, unknown> }): void {
        if (payload.request.sourceKind === 'visual_memory') {
            this.saveVisualMemoryCapture(payload);
            return;
        }

        const note = window.prompt('给当前页面资料加个备注（可选）', '');
        if (note === null) {
            this.showContextToast('已取消保存当前页面资料');
            return;
        }

        chrome.runtime.sendMessage({
            type: 'MEMORY_CAPTURE_SAVE_PAGE',
            request: {
                ...payload.request,
                captureMode: 'manual',
                captureReason: '用户点击右侧半露出 + 入库当前页面',
                note: note.trim(),
            },
        }, (response) => {
            if (chrome.runtime.lastError || !response?.success) {
                const message = chrome.runtime.lastError?.message || response?.error || '保存失败';
                this.showContextToast(`页面资料保存失败：${message}`);
                return;
            }

            this.clearPageMemoryCaptureChip();
            this.pageCaptureStoredContextKey = payload.contextKey;
            const duplicate = Boolean(response.result?.capsule?.duplicate);
            this.showContextToast(
                duplicate ? '当前页面已在记忆中' : '已保存当前页面资料',
                buildSourceMemoryDetailToastAction(response.result?.capsule?.id),
                { durationMs: 5000 },
            );
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
            sourceTypes: ['glip', 'manual', 'markdown', 'web', 'jira', 'system', 'rehearsal'],
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

    private setupSiteControlStorageListener(): void {
        try {
            if (!chrome.storage?.onChanged?.addListener) {
                return;
            }
            chrome.storage.onChanged.addListener((changes, areaName) => {
                if (areaName !== 'local') {
                    return;
                }
                this.applySiteControlStorageChanges(
                    changes as Record<string, chrome.storage.StorageChange>,
                );
            });
        } catch (_error) {
            // Storage change updates are a convenience; reload still reads controls.
        }
    }

    private applySiteControlStorageChanges(
        changes: Record<string, chrome.storage.StorageChange>,
    ): void {
        const watchedKeys = [
            CONTEXT_SITE_MUTE_STORAGE_KEY,
            CONTEXT_SITE_BLOCK_STORAGE_KEY,
            CONTEXT_PAGE_BLOCK_STORAGE_KEY,
            CONTEXT_SITE_ALLOW_STORAGE_KEY,
            CONTEXT_SITE_ALLOWLIST_MODE_STORAGE_KEY,
        ];
        if (!watchedKeys.some((key) => Object.prototype.hasOwnProperty.call(changes, key))) {
            return;
        }

        if (Object.prototype.hasOwnProperty.call(changes, CONTEXT_SITE_MUTE_STORAGE_KEY)) {
            const pruned = pruneContextSiteMuteRecord(
                changes[CONTEXT_SITE_MUTE_STORAGE_KEY]?.newValue,
            );
            this.mutedSiteHosts = new Map(Object.entries(pruned.record));
            this.siteMutesLoaded = true;
            this.siteMutesLoadPromise = null;
            if (pruned.changed) {
                this.saveSiteMutes();
            }
        }

        if (Object.prototype.hasOwnProperty.call(changes, CONTEXT_SITE_BLOCK_STORAGE_KEY)) {
            const pruned = pruneContextSiteBlockRecord(
                changes[CONTEXT_SITE_BLOCK_STORAGE_KEY]?.newValue,
            );
            this.blockedSiteHosts = new Map(Object.entries(pruned.record));
            this.siteBlocksLoaded = true;
            this.siteBlocksLoadPromise = null;
            if (pruned.changed) {
                this.saveSiteBlocks();
            }
        }

        if (Object.prototype.hasOwnProperty.call(changes, CONTEXT_PAGE_BLOCK_STORAGE_KEY)) {
            const pruned = pruneContextPageBlockRecord(
                changes[CONTEXT_PAGE_BLOCK_STORAGE_KEY]?.newValue,
            );
            this.blockedPagePrefixes = new Map(Object.entries(pruned.record));
            this.pageBlocksLoaded = true;
            this.pageBlocksLoadPromise = null;
            if (pruned.changed) {
                this.savePageBlocks();
            }
        }

        if (Object.prototype.hasOwnProperty.call(changes, CONTEXT_SITE_ALLOW_STORAGE_KEY)) {
            const pruned = pruneContextSiteAllowRecord(
                changes[CONTEXT_SITE_ALLOW_STORAGE_KEY]?.newValue,
            );
            this.allowedSiteHosts = new Map(Object.entries(pruned.record));
            this.siteAllowlistLoaded = true;
            this.siteAllowlistLoadPromise = null;
            if (pruned.changed) {
                this.saveSiteAllowlist();
            }
        }

        if (
            Object.prototype.hasOwnProperty.call(
                changes,
                CONTEXT_SITE_ALLOWLIST_MODE_STORAGE_KEY,
            )
        ) {
            this.siteAllowlistMode =
                changes[CONTEXT_SITE_ALLOWLIST_MODE_STORAGE_KEY]?.newValue === true;
            this.siteAllowlistLoaded = true;
            this.siteAllowlistLoadPromise = null;
        }

        this.handleSiteControlsChanged();
    }

    private handleSiteControlsChanged(): void {
        this.invalidatePendingContextRequest();
        this.resetContextStability();

        if (this.isPassiveContextSuppressedBySiteControls()) {
            this.clearPassiveContextBubble();
            return;
        }

        this.scheduleContextMatch(0);
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

    private isCurrentSiteAllowed(): boolean {
        const host = this.getCurrentSiteMuteHost();
        const payload: Record<string, number> = {};
        for (const [allowedHost, allowedAt] of this.allowedSiteHosts.entries()) {
            payload[allowedHost] = allowedAt;
        }
        return isContextHostCoveredBySiteRecord(host, payload);
    }

    private isPassiveContextSuppressedBySiteControls(): boolean {
        return (
            this.isCurrentSiteMuted() ||
            this.isCurrentSiteBlocked() ||
            this.isCurrentPageBlocked() ||
            this.isCurrentSiteOutsideAllowlist()
        );
    }

    private clearPassiveContextBubble(): void {
        if (this.isSelectedTextContextKey(this.activeBubbleContextKey)) {
            return;
        }
        this.clearContextBubble();
    }

    private siteMapToRecord(map: Map<string, number>): Record<string, number> {
        return Object.fromEntries(map.entries());
    }

    private collectSiteEntries(
        map: Map<string, number>,
        hosts: string[],
    ): Map<string, number> {
        const entries = new Map<string, number>();
        for (const host of hosts) {
            const value = map.get(host);
            if (value !== undefined) {
                entries.set(host, value);
            }
        }
        return entries;
    }

    private restoreSiteEntries(
        map: Map<string, number>,
        entries: Map<string, number>,
    ): void {
        for (const [host, value] of entries.entries()) {
            map.set(host, value);
        }
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
        const blockConflicts = removeContextSiteRecordConflicts(
            host,
            this.siteMapToRecord(this.blockedSiteHosts),
        );
        const previousBlockedEntries = this.collectSiteEntries(
            this.blockedSiteHosts,
            blockConflicts.removedHosts,
        );
        const muteConflicts = removeContextSiteRecordConflicts(
            host,
            this.siteMapToRecord(this.mutedSiteHosts),
        );
        const previousMutedEntries = this.collectSiteEntries(
            this.mutedSiteHosts,
            muteConflicts.removedHosts,
        );
        const allowConflicts = removeContextSiteRecordConflicts(
            host,
            this.siteMapToRecord(this.allowedSiteHosts),
        );
        const previousAllowedEntries = this.collectSiteEntries(
            this.allowedSiteHosts,
            allowConflicts.removedHosts,
        );

        this.blockedSiteHosts = new Map(Object.entries(blockConflicts.record));
        this.mutedSiteHosts = new Map(Object.entries(muteConflicts.record));
        this.allowedSiteHosts = new Map(Object.entries(allowConflicts.record));
        this.blockedSiteHosts.set(host, Date.now());
        this.saveSiteBlocks();
        this.saveSiteMutes();
        this.saveSiteAllowlist();
        this.clearContextBubble();
        this.showContextToast('已永久关闭此网站记忆提示', {
            label: '撤销',
            ariaLabel: '撤销永久不提示此站点',
            onClick: () => {
                this.blockedSiteHosts.delete(host);
                this.restoreSiteEntries(this.blockedSiteHosts, previousBlockedEntries);
                this.restoreSiteEntries(this.mutedSiteHosts, previousMutedEntries);
                this.restoreSiteEntries(this.allowedSiteHosts, previousAllowedEntries);
                this.saveSiteBlocks();
                this.saveSiteMutes();
                this.saveSiteAllowlist();
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
        const blockConflicts = removeContextSiteRecordConflicts(
            host,
            this.siteMapToRecord(this.blockedSiteHosts),
        );
        const previousBlockedEntries = this.collectSiteEntries(
            this.blockedSiteHosts,
            blockConflicts.removedHosts,
        );
        const muteConflicts = removeContextSiteRecordConflicts(
            host,
            this.siteMapToRecord(this.mutedSiteHosts),
        );
        const previousMutedEntries = this.collectSiteEntries(
            this.mutedSiteHosts,
            muteConflicts.removedHosts,
        );

        this.allowedSiteHosts.set(host, Date.now());
        this.siteAllowlistMode = true;
        this.blockedSiteHosts = new Map(Object.entries(blockConflicts.record));
        this.mutedSiteHosts = new Map(Object.entries(muteConflicts.record));
        this.saveSiteAllowlist();
        this.saveSiteBlocks();
        this.saveSiteMutes();
        const removedConflictCount =
            blockConflicts.removedHosts.length + muteConflicts.removedHosts.length;
        this.showContextToast(
            removedConflictCount > 0
                ? `已开启白名单并允许此网站，已移除 ${removedConflictCount} 条覆盖规则`
                : '已开启白名单并允许此网站',
            {
            label: '撤销',
            ariaLabel: '撤销此站点白名单快捷设置',
            onClick: () => {
                this.siteAllowlistMode = previousAllowlistMode;
                if (hadPreviousAllow && previousAllowedAt !== undefined) {
                    this.allowedSiteHosts.set(host, previousAllowedAt);
                } else {
                    this.allowedSiteHosts.delete(host);
                }
                this.restoreSiteEntries(this.blockedSiteHosts, previousBlockedEntries);
                this.restoreSiteEntries(this.mutedSiteHosts, previousMutedEntries);
                this.saveSiteAllowlist();
                this.saveSiteBlocks();
                this.saveSiteMutes();
                this.showContextToast('已恢复白名单设置');
                this.scheduleContextMatch(0);
            },
            },
        );
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

    private markContextMatchIrrelevant(
        match: ContextRecallMatch,
        contextKey: string,
        detailOptions: ContextRecallFeedbackDetailOptions = {},
    ): void {
        const previousDismissedAt = this.dismissedContextKeys.get(contextKey);
        const hadPreviousDismissal = previousDismissedAt !== undefined;
        const previousCachedMatch = contextMatchCache.get(contextKey);

        this.dismissedContextKeys.set(contextKey, Date.now());
        this.pruneDismissedContextKeys();
        contextMatchCache.set(contextKey, { match: null, matches: [], ts: Date.now() });
        pruneContextMatchCache();
        this.clearContextBubble();
        this.showContextToast(
            isContextRehearsalMatch(match)
                ? '已记录为预演提醒不相关，后续会减少类似提示'
                : '已记录为不相关，后续会减少类似提示',
        );

        this.submitContextRecallFeedback(match, 'negative', contextKey, detailOptions, (success) => {
            if (success) return;

            this.showContextToast('反馈记录失败，已仅在本页隐藏 30 分钟', {
                label: '重新显示',
                ariaLabel: '重新显示这条记忆提示',
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
                    pruneContextMatchCache();
                    this.showContextBubble(
                        [match],
                        contextKey,
                        false,
                        true,
                        detailOptions.restoreBubbleOptions || {},
                    );
                },
            }, { durationMs: 7000 });
        });
    }

    private markContextMatchRelevant(
        match: ContextRecallMatch,
        contextKey: string,
        onResult?: ContextRecallFeedbackResultHandler,
        detailOptions: ContextRecallFeedbackDetailOptions = {},
    ): void {
        this.showContextToast(
            isContextRehearsalMatch(match)
                ? '已记录为预演提醒有用，后续会优先保留类似提示'
                : '已记录为有用，后续会优先保留类似提示',
        );
        this.submitContextRecallFeedback(match, 'positive', contextKey, detailOptions, (success, error) => {
            if (!success) {
                this.showContextToast(
                    `反馈记录失败：${error || '请稍后再试'}`,
                    undefined,
                    { durationMs: 5000 },
                );
            }
            onResult?.(success, error);
        });
    }

    private submitContextRecallFeedback(
        match: ContextRecallMatch,
        action: 'positive' | 'negative',
        contextKey?: string,
        detailOptions: ContextRecallFeedbackDetailOptions = {},
        onResult?: ContextRecallFeedbackResultHandler,
    ): void {
        chrome.runtime.sendMessage(
            {
                type: 'CONTEXT_RECALL_FEEDBACK',
                feedback: {
                    type: 'recall_quality',
                    targetId: getContextRecallFeedbackTargetId(match),
                    targetType: match.type,
                    action,
                    detail: buildContextRecallFeedbackDetail(
                        match,
                        action,
                        contextKey || this.activeBubbleContextKey,
                        this.getCurrentSiteMuteHost(),
                        detailOptions,
                    ),
                    rehearsalActivationId: getContextRehearsalActivationId(match),
                },
            },
            (response) => {
                if (chrome.runtime.lastError) {
                    const error = chrome.runtime.lastError.message || 'runtime_error';
                    console.warn(
                        'Context recall feedback failed:',
                        error,
                    );
                    onResult?.(false, error);
                    return;
                }
                if (response?.success === false) {
                    console.warn('Context recall feedback rejected:', response.error);
                    onResult?.(false, String(response.error || 'feedback_rejected'));
                    return;
                }
                onResult?.(true);
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
                min-width: 28px;
                height: 28px;
                border-radius: 999px;
                border: 1px solid rgba(203, 213, 225, 0.9);
                background: rgba(255, 255, 255, 0.98);
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 2px;
                padding: 0;
                z-index: 2147483646;
                box-shadow: 0 8px 20px rgba(15, 23, 42, 0.22);
                backdrop-filter: blur(10px);
                overflow: hidden;
            }

            .pai-context-selection-action {
                width: 28px;
                height: 28px;
                border: 0;
                background: transparent;
                color: #0f172a;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 0;
                cursor: pointer;
                font: 700 18px/1 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            }

            .pai-context-selection-action + .pai-context-selection-action {
                border-left: 1px solid rgba(226, 232, 240, 0.95);
            }

            .pai-context-selection-action img {
                width: 20px;
                height: 20px;
                object-fit: contain;
                pointer-events: none;
            }

            .pai-context-selection-capture {
                color: #2563eb;
            }

            .pai-memory-capture-selection-dock,
            .pai-memory-capture-page-chip {
                position: fixed;
                right: 0;
                top: 0;
                width: 46px;
                height: 36px;
                border-radius: 999px;
                border: 1px solid rgba(37, 99, 235, 0.28);
                background: rgba(255, 255, 255, 0.98);
                color: #2563eb;
                display: flex;
                align-items: center;
                justify-content: flex-start;
                gap: 6px;
                padding: 0 8px 0 8px;
                cursor: pointer;
                z-index: 2147483645;
                box-shadow: 0 8px 22px rgba(15, 23, 42, 0.2);
                font: 800 14px/1 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
                letter-spacing: 0;
                overflow: hidden;
                box-sizing: border-box;
                backdrop-filter: blur(10px);
                transform: translate(50%, -50%);
                transition: width 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease, background 0.18s ease;
            }

            .pai-memory-capture-selection-dock:hover,
            .pai-memory-capture-selection-dock:focus-visible,
            .pai-memory-capture-page-chip:hover,
            .pai-memory-capture-page-chip:focus-visible {
                width: 104px;
                transform: translate(0, -50%);
                border-color: rgba(37, 99, 235, 0.48);
                box-shadow: 0 10px 26px rgba(15, 23, 42, 0.24);
                background: #eff6ff;
            }

            .pai-memory-capture-page-chip--visual {
                border-color: rgba(14, 116, 144, 0.34);
                color: #0e7490;
            }

            .pai-memory-capture-page-chip--visual:hover,
            .pai-memory-capture-page-chip--visual:focus-visible {
                width: 104px;
                border-color: rgba(14, 116, 144, 0.58);
                background: #ecfeff;
            }

            .pai-memory-capture-selection-dock-plus {
                flex: 0 0 14px;
                width: 14px;
                text-align: center;
                font-size: 19px;
                line-height: 1;
            }

            .pai-memory-capture-selection-dock-label {
                flex: 0 0 auto;
                width: 0;
                opacity: 0;
                white-space: nowrap;
                overflow: hidden;
                transition: width 0.18s ease, opacity 0.12s ease;
            }

            .pai-memory-capture-selection-dock:hover .pai-memory-capture-selection-dock-label,
            .pai-memory-capture-selection-dock:focus-visible .pai-memory-capture-selection-dock-label,
            .pai-memory-capture-page-chip:hover .pai-memory-capture-selection-dock-label,
            .pai-memory-capture-page-chip:focus-visible .pai-memory-capture-selection-dock-label {
                width: 2em;
                opacity: 1;
            }

            .pai-memory-capture-selection-dock-logo {
                flex: 0 0 18px;
                width: 18px;
                height: 18px;
                object-fit: contain;
                opacity: 0;
                transform: scale(0.82);
                transition: opacity 0.12s ease, transform 0.18s ease;
            }

            .pai-memory-capture-selection-dock:hover .pai-memory-capture-selection-dock-logo,
            .pai-memory-capture-selection-dock:focus-visible .pai-memory-capture-selection-dock-logo,
            .pai-memory-capture-page-chip:hover .pai-memory-capture-selection-dock-logo,
            .pai-memory-capture-page-chip:focus-visible .pai-memory-capture-selection-dock-logo {
                opacity: 1;
                transform: scale(1);
            }

            .pai-memory-capture-note-panel {
                position: fixed;
                right: max(14px, env(safe-area-inset-right));
                width: min(340px, calc(100vw - 28px));
                box-sizing: border-box;
                z-index: 2147483646;
                display: flex;
                flex-direction: column;
                gap: 8px;
                padding: 12px;
                border-radius: 14px;
                border: 1px solid rgba(37, 99, 235, 0.22);
                background: rgba(255, 255, 255, 0.99);
                box-shadow: 0 18px 48px rgba(15, 23, 42, 0.24);
                color: #172033;
                font: 13px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                letter-spacing: 0;
                backdrop-filter: blur(12px);
            }

            .pai-memory-capture-note-title {
                font-weight: 800;
                color: #0f172a;
            }

            .pai-memory-capture-note-preview {
                max-height: 64px;
                overflow: auto;
                padding: 8px;
                border-radius: 10px;
                background: #f8fafc;
                color: #334155;
                border: 1px solid rgba(226, 232, 240, 0.9);
            }

            .pai-memory-capture-note-reasons {
                color: #475569;
                font-size: 12px;
            }

            .pai-visual-memory-preview-panel {
                border-color: rgba(14, 116, 144, 0.26);
                max-height: min(560px, calc(100vh - 104px));
                overflow-y: auto;
            }

            .pai-visual-memory-preview-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 8px;
            }

            .pai-visual-memory-preview-close {
                width: 26px;
                height: 26px;
                border: 1px solid rgba(148, 163, 184, 0.72);
                border-radius: 8px;
                background: #ffffff;
                color: #334155;
                cursor: pointer;
                font: 800 16px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                padding: 0;
            }

            .pai-visual-memory-preview-source {
                color: #475569;
                font-size: 12px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .pai-visual-memory-preview-card {
                min-height: 86px;
                border-radius: 10px;
                border: 1px solid rgba(14, 116, 144, 0.24);
                background:
                    linear-gradient(135deg, rgba(236, 254, 255, 0.96), rgba(248, 250, 252, 0.98));
                display: flex;
                flex-direction: column;
                justify-content: center;
                gap: 7px;
                padding: 12px;
                box-sizing: border-box;
            }

            .pai-visual-memory-preview-badge {
                width: fit-content;
                max-width: 100%;
                border-radius: 999px;
                border: 1px solid rgba(14, 116, 144, 0.24);
                background: rgba(14, 116, 144, 0.1);
                color: #155e75;
                padding: 4px 9px;
                font-weight: 800;
                font-size: 12px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .pai-visual-memory-preview-meta,
            .pai-visual-memory-preview-summary,
            .pai-visual-memory-preview-status {
                color: #475569;
                font-size: 12px;
            }

            .pai-visual-memory-preview-text {
                max-height: 108px;
            }

            .pai-visual-memory-preview-status {
                color: #0f766e;
            }

            .pai-memory-capture-note-input {
                width: 100%;
                min-height: 72px;
                resize: vertical;
                box-sizing: border-box;
                border: 1px solid rgba(148, 163, 184, 0.82);
                border-radius: 10px;
                padding: 8px;
                color: #0f172a;
                background: #ffffff;
                font: inherit;
            }

            .pai-memory-capture-note-input:focus {
                outline: 2px solid rgba(37, 99, 235, 0.32);
                border-color: rgba(37, 99, 235, 0.62);
            }

            .pai-memory-capture-note-error {
                color: #b91c1c;
                font-size: 12px;
            }

            .pai-memory-capture-note-actions {
                display: flex;
                justify-content: flex-end;
                gap: 8px;
            }

            .pai-memory-capture-note-button {
                border: 1px solid rgba(148, 163, 184, 0.7);
                border-radius: 999px;
                padding: 6px 12px;
                cursor: pointer;
                color: #172033;
                background: #ffffff;
                font: 700 12px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                letter-spacing: 0;
            }

            .pai-memory-capture-note-save {
                color: #ffffff;
                background: #2563eb;
                border-color: #2563eb;
            }

            .pai-memory-capture-note-button:hover,
            .pai-memory-capture-note-button:focus-visible {
                box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.14);
            }

            .pai-memory-capture-note-button:disabled {
                cursor: progress;
                opacity: 0.72;
            }

            .pai-context-selection-action:hover,
            .pai-context-selection-action:focus-visible {
                background: rgba(37, 99, 235, 0.08);
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
            .pai-context-selection-action:focus-visible,
            .pai-context-selection-trigger:focus-visible,
            .pai-memory-capture-selection-dock:focus-visible,
            .pai-memory-capture-note-button:focus-visible,
            .pai-visual-memory-preview-close:focus-visible,
            .pai-memory-capture-page-chip:focus-visible,
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

            .pai-context-action-button svg {
                width: 16px;
                height: 16px;
                pointer-events: none;
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

            .pai-context-feedback-layer {
                position: fixed;
                inset: 0;
                z-index: 2147483647;
                display: flex;
                justify-content: flex-end;
                background: rgba(23, 32, 51, 0.16);
                pointer-events: auto;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                color: #172033;
                line-height: 1.5;
            }

            .pai-context-feedback-scrim {
                position: absolute;
                inset: 0;
                border: 0;
                padding: 0;
                background: transparent;
                cursor: default;
                pointer-events: auto;
            }

            .pai-context-feedback-sheet {
                position: relative;
                z-index: 1;
                width: 410px;
                max-width: calc(100vw - 56px);
                height: 100vh;
                height: 100dvh;
                display: flex;
                flex-direction: column;
                gap: 12px;
                box-sizing: border-box;
                padding: 16px;
                border-left: 1px solid rgba(177, 153, 125, 0.42);
                background: rgba(255, 253, 248, 0.99);
                box-shadow: -18px 0 54px rgba(23, 32, 51, 0.18);
                pointer-events: auto;
                overflow-y: auto;
                backdrop-filter: blur(14px);
            }

            .pai-context-feedback-sheet-head {
                display: flex;
                align-items: flex-start;
                justify-content: space-between;
                gap: 12px;
                padding-bottom: 11px;
                border-bottom: 1px solid rgba(222, 204, 178, 0.72);
            }

            .pai-context-feedback-sheet-title {
                margin: 0;
                color: #172033;
                font-size: 15px;
                font-weight: 800;
                line-height: 1.3;
            }

            .pai-context-feedback-sheet-subtitle {
                margin-top: 4px;
                color: #6b5a49;
                font-size: 12px;
                line-height: 1.45;
                overflow-wrap: anywhere;
            }

            .pai-context-feedback-scene {
                display: grid;
                gap: 6px;
                padding: 11px;
                border-radius: 10px;
                border: 1px solid rgba(222, 204, 178, 0.74);
                background: rgba(255, 249, 240, 0.82);
            }

            .pai-context-feedback-scene-label {
                color: #8a6b52;
                font-size: 11px;
                font-weight: 800;
            }

            .pai-context-feedback-scene-text {
                color: #334155;
                font-size: 12px;
                line-height: 1.45;
                overflow-wrap: anywhere;
            }

            .pai-context-feedback-close {
                flex: 0 0 30px;
                width: 30px;
                height: 30px;
                border: 1px solid rgba(177, 153, 125, 0.62);
                border-radius: 8px;
                background: rgba(255, 255, 255, 0.74);
                color: #5f4a38;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                padding: 0;
                line-height: 1;
            }

            .pai-context-feedback-reasons {
                display: grid;
                gap: 8px;
            }

            .pai-context-feedback-reason {
                width: 100%;
                min-height: 48px;
                box-sizing: border-box;
                border: 1px solid rgba(177, 153, 125, 0.38);
                border-radius: 9px;
                background: rgba(255, 255, 255, 0.78);
                color: #172033;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 8px;
                padding: 9px 10px;
                text-align: left;
            }

            .pai-context-feedback-reason:hover,
            .pai-context-feedback-reason:focus-visible {
                background: #ffffff;
                border-color: rgba(45, 112, 100, 0.36);
                box-shadow: 0 0 0 3px rgba(45, 112, 100, 0.1);
            }

            .pai-context-feedback-reason-label {
                font-size: 12px;
                font-weight: 800;
                line-height: 1.25;
            }

            .pai-context-feedback-reason-detail {
                color: #6b7280;
                font-size: 11px;
                line-height: 1.28;
            }

            .pai-context-feedback-reason-icon {
                color: #2d7064;
                font-weight: 900;
            }

            .pai-context-feedback-note-toggle {
                width: fit-content;
                border: 0;
                background: transparent;
                color: #2d7064;
                cursor: pointer;
                font-size: 12px;
                font-weight: 800;
                padding: 0;
            }

            .pai-context-feedback-note {
                width: 100%;
                min-height: 74px;
                resize: vertical;
                box-sizing: border-box;
                border: 1px solid rgba(148, 163, 184, 0.78);
                border-radius: 9px;
                padding: 8px 9px;
                color: #172033;
                background: #ffffff;
                font: 12px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                letter-spacing: 0;
            }

            .pai-context-feedback-status {
                color: #7a6654;
                font-size: 11px;
                line-height: 1.35;
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
                top: max(16px, env(safe-area-inset-top));
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

            .pai-context-toast--memory-capture-auto {
                max-width: min(420px, calc(100vw - 32px));
                min-height: 30px;
                border-radius: 999px;
                padding: 6px 8px;
                gap: 6px;
                font-size: 11px;
                line-height: 1.2;
                background: rgba(15, 23, 42, 0.92);
                overflow: hidden;
                justify-content: flex-start;
            }

            .pai-context-toast-icon {
                width: 16px;
                height: 16px;
                flex: 0 0 16px;
                object-fit: contain;
            }

            .pai-context-toast-message {
                min-width: 0;
                overflow-wrap: anywhere;
            }

            .pai-context-toast--memory-capture-auto .pai-context-toast-message {
                flex: 0 0 auto;
                white-space: nowrap;
                font-size: 11px;
                font-weight: 700;
            }

            .pai-context-toast-detail {
                display: none;
            }

            .pai-context-toast--memory-capture-auto .pai-context-toast-detail {
                display: inline-block;
                max-width: 0;
                opacity: 0;
                overflow: hidden;
                white-space: nowrap;
                color: rgba(255, 255, 255, 0.82);
                transition: max-width 0.18s ease, opacity 0.14s ease, margin-left 0.18s ease;
            }

            .pai-context-toast--memory-capture-auto:hover .pai-context-toast-detail,
            .pai-context-toast--memory-capture-auto:focus-within .pai-context-toast-detail {
                max-width: 260px;
                opacity: 1;
                margin-left: 2px;
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

            .pai-context-toast--memory-capture-auto .pai-context-toast-button {
                max-width: 0;
                opacity: 0;
                padding: 0;
                border-width: 0;
                pointer-events: none;
                overflow: hidden;
                font-size: 11px;
                transition: max-width 0.18s ease, opacity 0.14s ease, padding 0.18s ease, border-width 0.18s ease;
            }

            .pai-context-toast--memory-capture-auto:hover .pai-context-toast-button,
            .pai-context-toast--memory-capture-auto:focus-within .pai-context-toast-button {
                max-width: 52px;
                opacity: 1;
                padding: 3px 7px;
                border-width: 1px;
                pointer-events: auto;
            }

            .pai-context-toast-button:hover,
            .pai-context-toast-button:focus-visible {
                background: rgba(255, 255, 255, 0.2);
            }

            @media (max-width: 640px) {
                .pai-context-feedback-layer {
                    align-items: flex-end;
                    justify-content: center;
                    background: rgba(23, 32, 51, 0.22);
                }

                .pai-context-feedback-sheet {
                    width: 100%;
                    max-width: none;
                    height: min(80vh, 720px);
                    height: min(80dvh, 720px);
                    border-left: 0;
                    border-top: 1px solid rgba(177, 153, 125, 0.42);
                    border-radius: 14px 14px 0 0;
                    box-shadow: 0 -18px 48px rgba(23, 32, 51, 0.22);
                    padding: 14px;
                }
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
                    transform: translateY(-6px);
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
                .pai-memory-capture-selection-dock,
                .pai-memory-capture-selection-dock-label,
                .pai-memory-capture-selection-dock-logo,
                .pai-memory-capture-note-panel,
                .pai-visual-memory-preview-panel,
                .pai-memory-capture-page-chip,
                .pai-context-feedback-layer,
                .pai-context-feedback-sheet,
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

    private showContextToast(
        message: string,
        action?: ContextToastAction,
        options: ContextToastOptions = {},
    ): void {
        this.clearContextToast();
        this.ensureContextBubbleStyles();

        if (!document.body) {
            return;
        }

        const toast = document.createElement('div');
        const isAutoMemoryCapture = options.variant === 'memory-capture-auto';
        toast.className = isAutoMemoryCapture
            ? 'pai-context-toast pai-context-toast--memory-capture-auto'
            : 'pai-context-toast';
        toast.setAttribute('role', 'status');

        if (isAutoMemoryCapture) {
            const icon = document.createElement('img');
            icon.className = 'pai-context-toast-icon';
            icon.src = chrome.runtime.getURL('icons/icon48.png');
            icon.alt = '';
            icon.setAttribute('aria-hidden', 'true');
            toast.appendChild(icon);
        }

        const text = document.createElement('span');
        text.className = 'pai-context-toast-message';
        text.textContent = message;
        toast.appendChild(text);

        if (isAutoMemoryCapture && options.detailMessage) {
            const detail = document.createElement('span');
            detail.className = 'pai-context-toast-detail';
            detail.textContent = options.detailMessage;
            toast.appendChild(detail);
        }

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

        const durationMs = options.durationMs ?? 2400;
        const clearToastTimer = () => {
            if (this.toastTimer !== null) {
                window.clearTimeout(this.toastTimer);
                this.toastTimer = null;
            }
        };
        const scheduleToastClear = () => {
            clearToastTimer();
            this.toastTimer = window.setTimeout(() => {
                if (this.toastElement !== toast) {
                    return;
                }
                if (toast.matches(':hover') || toast.contains(document.activeElement)) {
                    scheduleToastClear();
                    return;
                }
                this.clearContextToast();
            }, durationMs);
        };
        const resumeToastClear = () => {
            window.setTimeout(() => {
                if (this.toastElement !== toast) {
                    return;
                }
                if (toast.matches(':hover') || toast.contains(document.activeElement)) {
                    return;
                }
                scheduleToastClear();
            }, 0);
        };

        toast.addEventListener('mouseenter', clearToastTimer);
        toast.addEventListener('focusin', clearToastTimer);
        toast.addEventListener('mouseleave', resumeToastClear);
        toast.addEventListener('focusout', resumeToastClear);
        scheduleToastClear();
    }

    private clearContextFeedbackDrawer(): void {
        if (this.feedbackDrawerKeydownListener) {
            document.removeEventListener('keydown', this.feedbackDrawerKeydownListener, true);
            this.feedbackDrawerKeydownListener = null;
        }
        this.feedbackDrawerElement?.remove();
        this.feedbackDrawerElement = null;
    }

    private clearContextBubble(): void {
        if (this.outsideClickListener) {
            document.removeEventListener('click', this.outsideClickListener, true);
            this.outsideClickListener = null;
        }
        this.clearContextFeedbackDrawer();
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
        const currentSiteAlreadyAllowed = this.siteAllowlistMode && this.isCurrentSiteAllowed();
        const siteAllowActionLabel = currentSiteAlreadyAllowed
            ? '此站点已在白名单'
            : this.siteAllowlistMode
                ? '允许此站点'
                : '开启白名单并允许此站点';
        const siteAllowActionDisabled = currentSiteAlreadyAllowed;

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
        let negativeFeedbackMatchId: string | null = null;
        let negativeFeedbackNoteExpanded = false;
        let negativeFeedbackNote = '';
        const feedbackSurface = isSelectionSearch ? 'selection_memory_search_card' : 'web_passive_bubble';

        const getViewCopy = (match: ContextRecallMatch): ContextMatchViewCopy => {
            if (isSelectionSearch) {
                return {
                    whySectionLabel: '为什么匹配',
                    whyRowLabel: '匹配到',
                    contentSectionLabel: '找到的相关记忆',
                    footerSectionLabel: '操作',
                    positiveAriaLabel: '标记这条检索结果有用',
                    negativeAriaLabel: '标记这条检索结果不相关',
                    evidenceLabel: '证据',
                };
            }

            if (isContextRehearsalMatch(match)) {
                return {
                    whySectionLabel: '为什么此刻相关',
                    whyRowLabel: '因为',
                    contentSectionLabel: '预演内容',
                    footerSectionLabel: '我能做什么',
                    positiveAriaLabel: '标记这条预演提醒有用',
                    negativeAriaLabel: '标记这条预演提醒不相关',
                    evidenceLabel: '线索',
                };
            }

            return {
                whySectionLabel: '为什么相关',
                whyRowLabel: '因为',
                contentSectionLabel: '它说了什么',
                footerSectionLabel: '我应该做什么',
                positiveAriaLabel: '标记这条记忆提示有用',
                negativeAriaLabel: '标记这条记忆提示不相关',
                evidenceLabel: '证据',
            };
        };

        const buildMatchView = (match: ContextRecallMatch) => {
            const sourceLabel =
                formatContextRecallSourceLabel(match.sourceLabel) ||
                normalizeText(match.sourceTitle) ||
                '记忆来源';
            const titleText = selectContextLensTitle(match, sourceLabel);
            const summaryText = selectContextLensSummary(match, titleText);
            const evidenceText = selectContextLensEvidence(match, summaryText);
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
            const sourceLinks = buildContextRecallSourceLinks(
                match,
                window.location.href,
                sourceLabel,
            );

            return {
                copy: getViewCopy(match),
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
            const copy = getViewCopy(match);

            return `
                <div class="pai-context-why-row" aria-label="${escapeHtmlAttribute(copy.whySectionLabel)}">
                    <span class="pai-context-why-label">${escapeHtml(copy.whyRowLabel)}</span>
                    ${chips.map((chip) => `<span class="pai-context-chip">${escapeHtml(chip)}</span>`).join('')}
                </div>
            `;
        };

        const closeNegativeFeedbackDrawer = (focusTrigger = true): void => {
            this.clearContextFeedbackDrawer();
            negativeFeedbackMatchId = null;
            negativeFeedbackNoteExpanded = false;
            negativeFeedbackNote = '';
            if (focusTrigger && this.cardElement === card) {
                window.setTimeout(() => {
                    card.querySelector<HTMLButtonElement>('.pai-context-recall-negative')?.focus();
                }, 0);
            }
        };

        const openNegativeFeedbackDrawer = (
            match: ContextRecallMatch,
            view: ReturnType<typeof buildMatchView>,
        ): void => {
            negativeFeedbackMatchId = match.id;
            negativeFeedbackNoteExpanded = false;
            negativeFeedbackNote = '';
            moreMenuOpen = false;
            renderCard();

            const renderDrawer = (): void => {
                this.clearContextFeedbackDrawer();
                if (!document.body) return;

                const drawer = document.createElement('div');
                drawer.className = 'pai-context-feedback-layer';
                drawer.setAttribute('role', 'dialog');
                drawer.setAttribute('aria-label', '这条记忆哪里不对');
                drawer.setAttribute('aria-modal', 'false');

            const clippedTitle = clipContextLensTitle(view.titleText);
                const sceneText = clipContextFeedbackDetailValue(
                    [
                        document.title,
                        window.location.hostname,
                        isSelectionSearch ? '划词检索' : 'Memory Lens',
                    ].map((item) => normalizeText(item)).filter(Boolean).join(' · '),
                    180,
                );
            const reasonButtonsHtml = CONTEXT_RECALL_NEGATIVE_FEEDBACK_REASONS
                .map((reason) => `
                    <button type="button" class="pai-context-feedback-reason" data-feedback-reason="${escapeHtmlAttribute(reason.value)}">
                        <span>
                            <span class="pai-context-feedback-reason-label">${escapeHtml(reason.label)}</span>
                            <span class="pai-context-feedback-reason-detail">${escapeHtml(reason.detail)}</span>
                        </span>
                        <span class="pai-context-feedback-reason-icon" aria-hidden="true">›</span>
                    </button>
                `)
                .join('');

                drawer.innerHTML = `
                    <button type="button" class="pai-context-feedback-scrim" aria-label="关闭反馈原因选择"></button>
                    <aside class="pai-context-feedback-sheet" tabindex="-1">
                        <div class="pai-context-feedback-sheet-head">
                            <div>
                                <h4 class="pai-context-feedback-sheet-title">这条记忆不是这个意思</h4>
                                <div class="pai-context-feedback-sheet-subtitle">选一个原因就会记录，不需要提交。</div>
                            </div>
                            <button type="button" class="pai-context-feedback-close" aria-label="关闭反馈原因选择">×</button>
                        </div>
                        <div class="pai-context-feedback-scene">
                            <div class="pai-context-feedback-scene-label">当前场景</div>
                            <div class="pai-context-feedback-scene-text">${escapeHtml(sceneText || '当前页面')}</div>
                            <div class="pai-context-feedback-scene-label">误触发的记忆</div>
                            <div class="pai-context-feedback-scene-text">${escapeHtml(clippedTitle || view.sourceLabel || '当前提示')}</div>
                        </div>
                        <div class="pai-context-feedback-reasons">
                            ${reasonButtonsHtml}
                        </div>
                        ${negativeFeedbackNoteExpanded ? `
                            <textarea class="pai-context-feedback-note" maxlength="260" placeholder="补充原因（可选，不填也会生效）">${escapeHtml(negativeFeedbackNote)}</textarea>
                        ` : `
                            <button type="button" class="pai-context-feedback-note-toggle">补充一句原因（可选）</button>
                        `}
                        <div class="pai-context-feedback-status">选择后会生成场景级修正；点旁边空白或按 Esc 可关闭。</div>
                    </aside>
                `;

                drawer.addEventListener('click', (event) => {
                    event.stopPropagation();
                    const target = event.target instanceof Element ? event.target : null;
                    if (!target) return;

                    if (
                        target.closest('.pai-context-feedback-scrim') ||
                        target.closest('.pai-context-feedback-close')
                    ) {
                        event.preventDefault();
                        closeNegativeFeedbackDrawer();
                        return;
                    }

                    if (target.closest('.pai-context-feedback-note-toggle')) {
                        event.preventDefault();
                        negativeFeedbackNoteExpanded = true;
                        renderDrawer();
                        window.setTimeout(() => {
                            this.feedbackDrawerElement
                                ?.querySelector<HTMLTextAreaElement>('.pai-context-feedback-note')
                                ?.focus();
                        }, 0);
                        return;
                    }

                    const feedbackReasonButton = target.closest<HTMLButtonElement>('.pai-context-feedback-reason');
                    if (feedbackReasonButton) {
                        event.preventDefault();
                        const feedbackReason = CONTEXT_RECALL_NEGATIVE_FEEDBACK_REASONS.find(
                            (reason) => reason.value === feedbackReasonButton.dataset.feedbackReason,
                        )?.value;
                        if (!feedbackReason) return;
                        const note = clipContextFeedbackDetailValue(negativeFeedbackNote, 260);
                        closeNegativeFeedbackDrawer(false);
                        this.markContextMatchIrrelevant(match, contextKey, {
                            reason: feedbackReason,
                            note,
                            surface: feedbackSurface,
                            selectedText,
                            interaction: 'memory_relevance_trainer',
                            autoApplied: true,
                            restoreBubbleOptions: { mode, selectedText },
                        });
                    }
                });

                drawer.addEventListener('input', (event) => {
                    const target = event.target;
                    if (!(target instanceof HTMLTextAreaElement)) return;
                    if (!target.matches('.pai-context-feedback-note')) return;
                    negativeFeedbackNote = target.value.slice(0, 260);
                });

                this.feedbackDrawerKeydownListener = (event: KeyboardEvent) => {
                    if (this.feedbackDrawerElement !== drawer) return;
                    if (event.key !== 'Escape') return;
                    event.preventDefault();
                    closeNegativeFeedbackDrawer();
                };
                document.addEventListener('keydown', this.feedbackDrawerKeydownListener, true);

                document.body.appendChild(drawer);
                this.feedbackDrawerElement = drawer;
                window.setTimeout(() => {
                    drawer.querySelector<HTMLButtonElement>('.pai-context-feedback-reason')?.focus();
                }, 0);
            };

            renderDrawer();
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
            const moreMenuHtml = isSelectionSearch
                ? `
                    <button type="button" class="pai-context-menu-item pai-context-selection-close" role="menuitem">关闭本次划词结果</button>
                `
                : `
                    <button type="button" class="pai-context-menu-item pai-context-dismiss" role="menuitem">隐藏此条记忆 30 分钟</button>
                    <button type="button" class="pai-context-menu-item pai-context-site-allow" role="menuitem" ${siteAllowActionDisabled ? 'disabled aria-disabled="true"' : ''}>${escapeHtml(siteAllowActionLabel)}</button>
                    <button type="button" class="pai-context-menu-item pai-context-site-mute" role="menuitem">此网站今天不提示</button>
                    <button type="button" class="pai-context-menu-item pai-context-page-block" role="menuitem">此页面永久不提示</button>
                    <button type="button" class="pai-context-menu-item pai-context-menu-item--danger pai-context-site-block" role="menuitem">永久不提示此站点</button>
                `;

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
                                    ${moreMenuHtml}
                                </div>
                            </div>
                        </div>
                    </div>

                    ${selectedTextHtml}
                    <div class="pai-context-section-label">${escapeHtml(view.copy.whySectionLabel)}</div>
                    ${renderWhyChips(match)}

                    <div class="pai-context-section-label">${escapeHtml(view.copy.contentSectionLabel)}</div>
                    <h3 class="pai-context-title">${escapeHtml(view.titleText)}</h3>
                    <div class="pai-context-summary">${escapeHtml(view.summaryText)}</div>
                    ${view.shouldShowEvidence ? `
                        <div class="pai-context-evidence-block">
                            <span class="pai-context-evidence-label">${escapeHtml(view.copy.evidenceLabel)}</span>
                            <span class="pai-context-evidence-text">${escapeHtml(view.evidenceText)}</span>
                        </div>
                    ` : ''}

                    <div class="pai-context-meta-row" aria-label="记忆来源摘要">
                        ${metaHtml}
                        ${sourceLinksHtml}
                    </div>
                </div>
                <div class="pai-context-footer-wrap">
                    <div class="pai-context-section-label pai-context-section-label--footer">${escapeHtml(view.copy.footerSectionLabel)}</div>
                    <div class="pai-context-footer">
                        <div class="pai-context-feedback" aria-label="反馈">
                            <button type="button" class="pai-context-action-button pai-context-recall-positive" aria-label="${isPositiveLocked ? '已标记有用' : escapeHtmlAttribute(view.copy.positiveAriaLabel)}" title="${isPositiveLocked ? '已标记有用' : '这条有用'}" ${isPositiveLocked ? 'disabled' : ''}>${CONTEXT_THUMB_UP_ICON_HTML}<span class="pai-sr-only">这条有用</span></button>
                            <button type="button" class="pai-context-action-button pai-context-recall-negative" aria-label="${escapeHtmlAttribute(view.copy.negativeAriaLabel)}" title="不是这个意思" ${isPositiveLocked ? 'disabled' : ''}>${CONTEXT_THUMB_DOWN_ICON_HTML}<span class="pai-sr-only">不是这个意思</span></button>
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
            if (!expanded) {
                this.clearContextFeedbackDrawer();
                negativeFeedbackMatchId = null;
                negativeFeedbackNoteExpanded = false;
                negativeFeedbackNote = '';
            }
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
                negativeFeedbackMatchId = null;
                negativeFeedbackNoteExpanded = false;
                negativeFeedbackNote = '';
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
                    this.clearContextFeedbackDrawer();
                    negativeFeedbackMatchId = null;
                    negativeFeedbackNoteExpanded = false;
                    negativeFeedbackNote = '';
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
                    this.clearContextFeedbackDrawer();
                    negativeFeedbackMatchId = null;
                    negativeFeedbackNoteExpanded = false;
                    negativeFeedbackNote = '';
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

            if (target.closest('.pai-context-selection-close')) {
                event.preventDefault();
                this.clearContextBubble();
                return;
            }

            if (target.closest('.pai-context-recall-positive')) {
                event.preventDefault();
                const currentMatch = matches[currentIndex];
                const previousLockedMatchId = positiveLockedMatchId;
                positiveLockedMatchId = currentMatch.id;
                moreMenuOpen = false;
                this.clearContextFeedbackDrawer();
                negativeFeedbackMatchId = null;
                negativeFeedbackNoteExpanded = false;
                negativeFeedbackNote = '';
                renderCard();
                this.markContextMatchRelevant(currentMatch, contextKey, (success) => {
                    if (success || positiveLockedMatchId !== currentMatch.id) return;
                    positiveLockedMatchId = previousLockedMatchId;
                    renderCard();
                }, {
                    surface: feedbackSurface,
                    selectedText,
                    interaction: 'context_recall_feedback',
                    restoreBubbleOptions: { mode, selectedText },
                });
                return;
            }

            if (target.closest('.pai-context-recall-negative')) {
                event.preventDefault();
                const currentMatch = matches[currentIndex];
                openNegativeFeedbackDrawer(currentMatch, buildMatchView(currentMatch));
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
            if (this.feedbackDrawerElement || negativeFeedbackMatchId) {
                closeNegativeFeedbackDrawer();
                return;
            }
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
                Boolean(this.feedbackDrawerElement?.contains(target)) ||
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

function sanitizeVisualMemorySvgStyleValue(value: string): string {
    const safeDeclarations = value
        .split(';')
        .map((declaration) => declaration.trim())
        .filter((declaration) => {
            if (!declaration || declaration.toLowerCase().includes('javascript:')) {
                return false;
            }
            const property = declaration.split(':')[0]?.trim().toLowerCase();
            return property ? !isBlockedVisualMemorySvgStyleProperty(property) : false;
        });
    return safeDeclarations.join('; ');
}

function sanitizeVisualMemorySvgStyleText(value: string): string {
    if (!value || value.toLowerCase().includes('javascript:')) {
        return '';
    }
    let sanitized = value;
    const blockedProperties = [
        'position',
        'inset',
        'inset-block',
        'inset-block-start',
        'inset-block-end',
        'inset-inline',
        'inset-inline-start',
        'inset-inline-end',
        'top',
        'right',
        'bottom',
        'left',
        'z-index',
        'float',
        'clear',
        'transform',
        'translate',
        'scale',
        'rotate',
        'margin',
        'margin-top',
        'margin-right',
        'margin-bottom',
        'margin-left',
    ];
    for (const property of blockedProperties) {
        sanitized = sanitized.replace(
            new RegExp(`${property.replace(/-/g, '\\-')}\\s*:[^;{}]+;?`, 'gi'),
            '',
        );
    }
    return sanitized.trim();
}

function isBlockedVisualMemorySvgStyleProperty(property: string): boolean {
    return (
        property === 'position' ||
        property === 'inset' ||
        property === 'inset-block' ||
        property === 'inset-block-start' ||
        property === 'inset-block-end' ||
        property === 'inset-inline' ||
        property === 'inset-inline-start' ||
        property === 'inset-inline-end' ||
        property === 'top' ||
        property === 'right' ||
        property === 'bottom' ||
        property === 'left' ||
        property === 'z-index' ||
        property === 'float' ||
        property === 'clear' ||
        property === 'transform' ||
        property === 'translate' ||
        property === 'scale' ||
        property === 'rotate' ||
        property === 'margin' ||
        property === 'margin-top' ||
        property === 'margin-right' ||
        property === 'margin-bottom' ||
        property === 'margin-left'
    );
}

try {
    new WebIntelligenceContentScript();
} catch (error) {
    console.error('智能网页分析启动失败:', error);
}

console.log('🧠 智能网页分析 Content Script 已加载');
