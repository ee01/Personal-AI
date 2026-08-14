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
    buildSourceMemoryRecallReceiptItems,
    formatContextRecallDisplayPriorityLabel,
    formatContextRecallEvidenceRole,
    formatContextRecallReasonType,
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
    buildInteractionSceneSnapshot,
    buildPassiveContextSnapshot,
    type OwnerAuthoredLearningPayload,
} from './composer-guard/siteContextAdapters';
import type { InteractionSceneSnapshot, SiteContextSnapshot } from './composer-guard/types';
import {
    buildPassiveWebpageAnalysisKey,
    type PassiveWebpageAnalysisResult,
} from './web-intelligence/passiveWebpageAnalysis';
interface SimplePageContent {
    title: string;
    url: string;
    domain: string;
    mainContent: string;
    wordCount: number;
    timestamp: number;
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
    currentContext?: {
        title?: string;
        url?: string;
        conversationId?: string;
        groupId?: string;
        issueKey?: string;
        participants?: string[];
        visibleFields?: Array<{ name: string; value: string; rawText?: string }>;
        verifiedSourceFields?: Array<{
            propertyKey: string;
            name: string;
            value: string | null;
            source: 'jira_rest';
            checkedAt: number;
        }>;
        sourceAnchorHints?: string[];
    };
    interactionScene?: InteractionSceneSnapshot;
    exclude?: {
        ids?: string[];
        urls?: string[];
        groupIds?: string[];
        conversationIds?: string[];
    };
    sourceTypes?: string[];
    ownerAuthoredLearningPayloads?: OwnerAuthoredLearningPayload[];
}

interface ContextBubbleRecallContext {
    surface?: ContextMatchPayload['surface'];
    contextType?: ContextMatchPayload['contextType'];
    title?: string;
    url?: string;
    sourceContext?: ContextMatchPayload['sourceContext'];
    currentContext?: ContextMatchPayload['currentContext'];
}

interface SelectedTextContextPayload extends ContextMatchPayload {
    // First visible line rect of the selection; used to place the recall icon beside the selection.
    rect: DOMRect;
    // Last visible line rect of the selection; the memory-capture dock anchors to this so multi-line
    // selections attach the right-edge "记住" + at the end of the selection rather than the first line.
    captureRect: DOMRect;
    selectionRecallEligible: boolean;
}

interface ClaimAttributionReceiptItem {
    claimId: string;
    sourceMessageId: string;
    revision: number;
    excerpt: string;
    ownerKind: string;
    ownerLabel: string;
    speechMode: string;
    verification: string;
    commitment: string;
    effect: 'used' | 'background_only' | 'blocked';
    displayLabel: string;
    consequence: string;
    correctionAllowed: boolean;
    corrected: boolean;
}

interface ContextRecallMatch {
    id: string;
    type: 'message' | 'chunk' | 'entity' | 'rehearsal' | 'source_memory' | 'reflection_thread';
    score: number;
    scope?: 'work' | 'personal';
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
    cue?: {
        id: string;
        cueKey?: string;
        cueText: string;
        actionType: 'remember' | 'ask' | 'draft_hint' | 'warning' | 'open_source';
        surfaceEligibility: string[];
        sourceRefs?: Array<{
            type: string;
            id: string;
            title?: string;
            url?: string;
            timestamp?: number;
        }>;
        evidenceMatchIds?: string[];
        whyNow?: string;
        confidence?: number;
        riskLevel?: 'low' | 'medium' | 'high';
        compileStatus: 'compiled' | 'suppressed' | 'needs_more_evidence';
        suppressReason?: string;
        outcomePolicy?: {
            action: 'boost' | 'suppress' | 'send_to_skill_foundry';
            patchId: string;
            strength: number;
            reasonCodes: string[];
            positiveCount: number;
            negativeCount: number;
            signalCount: number;
            expiresAt?: number;
        };
    };
    lensPresentation?: {
        status: 'ready' | 'partial' | 'blocked';
        informationValue: 'high' | 'medium' | 'low';
        title: string;
        extractedInfo?: string;
        suggestedAction?: string;
        novelty: 'new_to_current_surface' | 'already_visible' | 'anchor_only' | 'unknown';
        sourceBoundary: 'reviewable_memory' | 'derived_summary' | 'raw_source';
        suppressReason?: string;
        presentationId?: string;
    };
    claimAttribution?: ClaimAttributionReceiptItem[];
}

interface KeystoneBriefClaim {
    text: string;
    sourceRefs: string[];
    confidence?: 'high' | 'medium' | 'low';
    authority?: string;
    validAsOf?: number;
    staleRisk?: 'low' | 'medium' | 'high';
    projection?: 'local_only' | 'summary_ok' | 'blocked_external';
}

interface KeystoneBriefPresentationPayload {
    brief: {
        id: string;
        briefKey: string;
        title: string;
        status: 'candidate' | 'ready' | 'partial' | 'blocked' | 'stale' | 'hidden';
        summary: string;
        externalSummary?: string;
        sourceAsOf: number;
        freshness: {
            state: 'fresh' | 'watching' | 'stale_risk' | 'blocked_source';
            reason: string;
            expiresAt?: number;
        };
        slots: {
            whyItMatters: string;
            currentState: string;
            stableFacts: KeystoneBriefClaim[];
            decisions: KeystoneBriefClaim[];
            constraints: KeystoneBriefClaim[];
            traps: KeystoneBriefClaim[];
            nextUseCases: string[];
            openQuestions: string[];
        };
        sourceMap: Array<{
            ref: string;
            sourceType: string;
            sourceId: string;
            role: 'authority' | 'supporting' | 'derived' | 'prior';
            title?: string;
            url?: string;
            timestamp?: number;
            authority?: string;
            projection: 'local_only' | 'summary_ok' | 'blocked_external';
            hidden?: boolean;
            snippet?: string;
        }>;
        displayPolicy: {
            defaultMode: 'silent' | 'chip' | 'card';
            maxLines: number;
            canCopyToDraft: boolean;
            externalSummaryOnly: boolean;
            hiddenSourceCount: number;
        };
        writeReceipt: {
            writesProfile: false;
            sendsExternal: false;
            createsTask: false;
            updatesFacts: false;
            writesOutcomeEvent: true;
        };
        repairState: 'clean' | 'needs_repair';
        blockedReason?: string;
        compositionVersion?: string;
    };
    presentationMode: 'primary' | 'conflict' | 'stale_notice';
    whyNow: string;
    evidenceMatchIds: string[];
    relatedMemoryCount: number;
}

interface MemoryChangeValue {
    kind: 'text' | 'number' | 'date' | 'boolean' | 'status' | 'entity_ref' | 'set';
    display: string;
    normalized: string | number | boolean | string[] | null;
    raw?: string;
}

interface MemoryChangeEvent {
    id: string;
    previousValue?: MemoryChangeValue;
    nextValue: MemoryChangeValue;
    authorityRole: string;
    sourceRef: { type: string; id: string; title?: string; url?: string };
    reason?: string;
    observedAt: number;
    isReversal: boolean;
}

interface MemoryChangeProjection {
    chainKey: string;
    subjectKey: string;
    subjectLabel: string;
    subjectKind: string;
    propertyKey: string;
    propertyLabel: string;
    currentValue?: MemoryChangeValue;
    previousValue?: MemoryChangeValue;
    visiblePageValue?: MemoryChangeValue;
    status:
        | 'confirmed_current'
        | 'last_observed'
        | 'conflicted'
        | 'historical_only'
        | 'superseded_on_page'
        | 'superseded_at_source';
    summary: string;
    boundary: string;
    eventCount: number;
    reversalCount: number;
    conflictCount: number;
    firstObservedAt?: number;
    lastObservedAt?: number;
    currentEvent?: MemoryChangeEvent;
    history: MemoryChangeEvent[];
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
    actions?: ContextToastAction[];
}

type ContextRecallFeedbackResultHandler = (success: boolean, error?: string) => void;
type ContextFeedbackCardReceiptStatus = 'pending' | 'confirmed' | 'failed';

interface ContextFeedbackCardReceipt {
    status: ContextFeedbackCardReceiptStatus;
    message: string;
}

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

type MemoryClaimCorrectionAction =
    | 'not_my_view'
    | 'my_decision'
    | 'reported_speech'
    | 'hypothesis';

const MEMORY_CLAIM_CORRECTION_ACTIONS: Array<{
    value: MemoryClaimCorrectionAction;
    label: string;
}> = [
    { value: 'not_my_view', label: '这不是我的观点' },
    { value: 'reported_speech', label: '这是引用或转述' },
    { value: 'hypothesis', label: '这是建议或假设' },
    { value: 'my_decision', label: '这是我的决定' },
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

interface ContextRecallSceneSummary {
    people?: string[];
    topics?: string[];
    projects?: string[];
    source?: string[];
}

interface ContextRecallAutopilotQuietReason {
    reason: string;
    label: string;
    count: number;
}

interface ContextRecallAutopilotDecision {
    mode: 'silent' | 'chip' | 'card' | 'context_pack';
    summary: string;
    candidateCount: number;
    shownCount: number;
    strongCount: number;
    possibleCount: number;
    quietedCount: number;
    hiddenCount: number;
    lowInformationCount: number;
    sourceExcludedCount: number;
    duplicateMergedCount: number;
    quietReasons: ContextRecallAutopilotQuietReason[];
    sceneAnchors?: ContextRecallSceneSummary;
    gates?: string[];
}

interface ContextRecallResponsePayload {
    uiLanguage?: 'zh-CN' | 'en-US';
    matches?: ContextRecallMatch[];
    topMatch?: ContextRecallMatch | null;
    autopilot?: ContextRecallAutopilotDecision | null;
    changeProjections?: MemoryChangeProjection[];
    keystoneBrief?: KeystoneBriefPresentationPayload;
}

type ContextBubbleMode = 'lens' | 'selectionSearch';

interface ContextBubbleOptions {
    uiLanguage?: 'zh-CN' | 'en-US';
    mode?: ContextBubbleMode;
    selectedText?: string;
    autopilot?: ContextRecallAutopilotDecision | null;
    recallBasis?: string;
    recallContext?: ContextBubbleRecallContext;
    changeProjections?: MemoryChangeProjection[];
    keystoneBrief?: KeystoneBriefPresentationPayload;
}

interface MemoryCaptureCandidateResult {
    eligible: boolean;
    score: number;
    suggestedAction: 'auto_save' | 'suggest' | 'ignore' | 'blocked';
    reasons?: string[];
    blockedReason?: string;
    captureMode?: 'auto' | 'suggested' | 'manual';
    policyReceipt?: MemoryCapturePolicyReceipt;
}

interface MemoryCapturePolicyReceipt {
    state: 'blocked' | 'ignored_low_signal' | 'suggested_review' | 'auto_save_candidate';
    label: string;
    detail: string;
    evidence?: string[];
    nextStep?: string;
}

interface MemoryCaptureWriteReceipt {
    state: 'saved_with_recall_signal' | 'saved_without_recall_signal' | 'dismissed_no_recall';
    label: string;
    detail: string;
    evidence?: string[];
    nextStep?: string;
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

interface ContextSourceOpenReceipt {
    matchId: string;
    kind: 'memory_detail' | 'original_source';
    targetLabel: string;
    reviewScope: string;
    sourceStatus: string;
    boundary: string;
}

interface ContextMatchCacheEntry {
    match: ContextRecallMatch | null;
    matches: ContextRecallMatch[];
    autopilot?: ContextRecallAutopilotDecision | null;
    changeProjections?: MemoryChangeProjection[];
    keystoneBrief?: KeystoneBriefPresentationPayload;
    uiLanguage?: 'zh-CN' | 'en-US';
    /** The source-read snapshot used to build this cache entry, when present. */
    jiraFreshnessCheckedAt?: number;
    ts: number;
}

function escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Weave provenance chip (P0-5) for the Memory Lens bubble. Computed client-side
 * from the matches actually shown (mirrors backend weaveStats: ≥2 distinct
 * sources or a ≥7-day span). Returns a short label or null when there is no
 * cross-source stitching to surface (anti-inflation).
 */
function computeLensWeaveLabel(matches: ContextRecallMatch[]): string | null {
    const sources = new Set<string>();
    const timestamps: number[] = [];
    for (const m of matches) {
        const s = (m.sourceLabel ?? '').trim().toLowerCase();
        if (s) sources.add(s);
        if (typeof m.timestamp === 'number' && Number.isFinite(m.timestamp)) {
            timestamps.push(m.timestamp);
        }
    }
    const daySpanDays =
        timestamps.length >= 2
            ? Math.floor((Math.max(...timestamps) - Math.min(...timestamps)) / 86400)
            : 0;
    const parts: string[] = [];
    if (sources.size >= 2) parts.push(`${sources.size} 来源`);
    if (daySpanDays >= 7) parts.push(`${daySpanDays} 天`);
    return parts.length > 0 ? `⊕ 缝合 ${parts.join(' × ')}` : null;
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

type KeystoneBriefUiEventType =
    | 'shown'
    | 'opened'
    | 'evidence_opened'
    | 'copied'
    | 'useful'
    | 'hidden'
    | 'not_accurate';

function submitKeystoneBriefUiEvent(
    briefId: string,
    eventType: KeystoneBriefUiEventType,
    contextKey: string,
    callback?: (success: boolean, error?: string) => void,
    reason?: string,
): void {
    chrome.runtime.sendMessage(
        {
            type: 'KEYSTONE_BRIEF_EVENT',
            briefId,
            event: {
                eventType,
                surface: 'memory_lens',
                context: {
                    contextKey,
                    pageHost: window.location.hostname,
                    pageTitle: document.title,
                },
                reason,
            },
        },
        (response) => {
            if (chrome.runtime.lastError) {
                callback?.(false, chrome.runtime.lastError.message);
                return;
            }
            callback?.(
                response?.success === true,
                response?.success === true ? undefined : response?.error,
            );
        },
    );
}

function formatMemoryCaptureCandidateReceipt(
    candidate: MemoryCaptureCandidateResult,
    evidenceLimit = 2,
): string {
    const receipt = candidate.policyReceipt;
    if (receipt) {
        const label = normalizeText(receipt.label);
        const evidence = Array.isArray(receipt.evidence)
            ? receipt.evidence.map((item) => normalizeText(item)).filter(Boolean).slice(0, evidenceLimit)
            : [];
        if (label && evidence.length) {
            return `${label}：${evidence.join('，')}`;
        }
        const detail = normalizeText(receipt.detail);
        if (label && detail) return `${label}：${detail}`;
        if (label) return label;
        if (detail) return detail;
    }
    return (candidate.reasons || [])
        .map((item) => normalizeText(item))
        .filter(Boolean)
        .slice(0, evidenceLimit)
        .join('，');
}

function formatMemoryCaptureSourceBoundaryReceipt(request: Record<string, unknown>): string {
    const sourceKind = normalizeText(
        typeof request.sourceKind === 'string' ? request.sourceKind : 'webpage',
    );
    const sourceUrl = normalizeText(typeof request.sourceUrl === 'string' ? request.sourceUrl : '');
    let sourceHost = '';
    if (sourceUrl) {
        try {
            sourceHost = new URL(sourceUrl).host;
        } catch {
            sourceHost = '';
        }
    }

    const scope = normalizeText(typeof request.scope === 'string' ? request.scope : 'work');
    const scopeLabel =
        scope === 'personal'
            ? '个人记忆'
            : scope === 'all'
                ? '全部范围'
                : '工作记忆';
    const sourceKindLabel =
        sourceKind === 'visual_memory'
            ? '视觉证据'
            : sourceKind === 'selection'
                ? '选区资料'
                : '当前页面资料';
    const writeSignal =
        sourceKind === 'visual_memory'
            ? '会写入资料记忆和视觉证据检索信号'
            : '会写入资料记忆和网页检索信号';
    const parts = [`保存范围：${sourceKindLabel}`, scopeLabel];
    if (sourceHost) {
        parts.push(`来源 ${sourceHost}`);
    }
    return `${parts.join(' · ')}；${writeSignal}。`;
}

function formatMemoryCapturePreReviewReceipt(
    request: Record<string, unknown>,
    candidate?: MemoryCaptureCandidateResult | null,
): string {
    const sourceKind = normalizeText(
        typeof request.sourceKind === 'string' ? request.sourceKind : 'webpage',
    );
    const sourceKindLabel =
        sourceKind === 'visual_memory'
            ? '当前页面视觉证据'
            : sourceKind === 'selection'
                ? '这段选中资料'
                : '当前页面资料';
    const candidateReceipt = candidate ? formatMemoryCaptureCandidateReceipt(candidate, 1) : '';
    const base = `${sourceKindLabel}尚未写入；点击后先复核，不会因点击直接保存、外发或同步。`;
    const pageReceipts =
        sourceKind === 'webpage'
            ? `${formatMemoryCapturePageSnapshotReceipt(request)} ${formatMemoryCapturePageTriggerReceipt(request, candidate)}`
            : '';
    return [base, pageReceipts, candidateReceipt ? `候选依据：${candidateReceipt}` : '']
        .filter(Boolean)
        .join('');
}

function formatMemoryCaptureSelectionSnapshotReceipt(
    request: Record<string, unknown>,
): string {
    const selectedText = normalizeText(
        typeof request.selectedText === 'string' ? request.selectedText : '',
    );
    const charCount = selectedText.length;
    const countText = charCount > 0 ? `约 ${charCount} 字` : '当前预览';
    return `选区快照：将保存下方${countText}的选中文字；备注只补充保存原因，不会重新抓取页面或改成当前新的选区。若页面或选区已变化，请取消后重新选择再点 + 记住。`;
}

function clipMemoryCaptureReceiptValue(text: string, maxLength = 46): string {
    const value = normalizeText(text);
    if (value.length <= maxLength) return value;
    return `${value.slice(0, maxLength - 1)}…`;
}

function formatMemoryCaptureDuration(ms: number): string {
    const totalSeconds = Math.max(0, Math.round(ms / 1000));
    if (totalSeconds < 60) return `${totalSeconds} 秒`;
    const minutes = Math.round(totalSeconds / 60);
    if (minutes < 60) return `${minutes} 分钟`;
    const hours = Math.floor(minutes / 60);
    const restMinutes = minutes % 60;
    return restMinutes > 0 ? `${hours} 小时 ${restMinutes} 分钟` : `${hours} 小时`;
}

function formatMemoryCapturePageSnapshotReceipt(
    request?: Record<string, unknown>,
): string {
    const metadata = asPlainObject(request?.metadata);
    const sourceTitle = clipMemoryCaptureReceiptValue(
        typeof request?.sourceTitle === 'string' ? request.sourceTitle : '当前页面',
        42,
    ) || '当前页面';
    const sourceUrl = normalizeText(typeof request?.sourceUrl === 'string' ? request.sourceUrl : '');
    let sourceHost = '';
    if (sourceUrl) {
        try {
            sourceHost = new URL(sourceUrl).host;
        } catch {
            sourceHost = '';
        }
    }
    const wordCount = Number(metadata?.wordCount || 0);
    const wordText = Number.isFinite(wordCount) && wordCount > 0 ? `，约 ${Math.round(wordCount)} 词` : '';
    const hostText = sourceHost ? `（${sourceHost}）` : '';
    return `页面快照：将保存「${sourceTitle}」${hostText}当前提取的正文快照${wordText}；备注只补充保存原因，不会重新抓取页面或改成之后滚动、跳转后的内容。若页面内容已变化，请取消后重新触发 + 记住。`;
}

function formatMemoryCapturePageTriggerReceipt(
    request?: Record<string, unknown>,
    candidate?: MemoryCaptureCandidateResult | null,
    autoReason?: string,
): string {
    const interactions = asPlainObject(request?.interactions);
    const evidence: string[] = [];
    const reason = normalizeText(autoReason);
    if (reason) {
        evidence.push(`自动触发：${reason}`);
    }
    if (interactions?.copiedText) {
        evidence.push('复制过页面内容');
    }
    const dwellMs = Number(interactions?.dwellMs || interactions?.activeMs || 0);
    if (Number.isFinite(dwellMs) && dwellMs > 0) {
        evidence.push(`停留约 ${formatMemoryCaptureDuration(dwellMs)}`);
    }
    const scrollDepth = Number(interactions?.scrollDepth || 0);
    if (Number.isFinite(scrollDepth) && scrollDepth > 0) {
        evidence.push(`阅读深度 ${Math.round(Math.min(1, Math.max(0, scrollDepth)) * 100)}%`);
    }
    const candidateReceipt = candidate ? formatMemoryCaptureCandidateReceipt(candidate, 1) : '';
    if (candidateReceipt) {
        evidence.push(`候选评分：${candidateReceipt}`);
    }
    const basis = evidence.length > 0 ? evidence.join(' · ') : '当前页面有本机阅读/复制信号';
    return `触发依据：${basis}。这是当前浏览器本地行为信号，不代表系统确认页面事实，也不会单独写画像、任务或外部系统。`;
}

function getMemoryCaptureWriteSignalLabel(request?: Record<string, unknown>): string {
    const sourceKind = normalizeText(
        typeof request?.sourceKind === 'string' ? request.sourceKind : 'webpage',
    );
    return sourceKind === 'visual_memory' ? '视觉证据检索信号' : '网页检索信号';
}

function getMemoryCaptureCapsuleSignalLabel(capsule: unknown): string {
    const capsuleObject = asPlainObject(capsule);
    return getMemoryCaptureWriteSignalLabel({
        sourceKind:
            typeof capsuleObject?.sourceKind === 'string'
                ? capsuleObject.sourceKind
                : 'webpage',
    });
}

function formatMemoryCaptureSaveFailureReceipt(
    targetLabel: string,
    message: string,
    request?: Record<string, unknown>,
): string {
    const reason = normalizeText(message) || '保存请求未完成';
    const snapshotReceipt =
        targetLabel === '页面资料' && request?.sourceKind !== 'visual_memory'
            ? `${formatMemoryCapturePageSnapshotReceipt(request)} `
            : '';
    return `${targetLabel}未写入：${reason}。${snapshotReceipt}没有创建资料记忆或${getMemoryCaptureWriteSignalLabel(request)}；入口仍保留，可重试或稍后再保存。`;
}

function formatMemoryCaptureAutoSavePendingReceipt(
    request?: Record<string, unknown>,
    autoReason?: string,
): string {
    const sourceKind = normalizeText(
        typeof request?.sourceKind === 'string' ? request.sourceKind : 'webpage',
    );
    const sourceKindLabel =
        sourceKind === 'visual_memory'
            ? '当前页面视觉证据'
            : sourceKind === 'selection'
                ? '选区资料'
                : '当前页面资料';
    const scope = normalizeText(typeof request?.scope === 'string' ? request.scope : 'work');
    const scopeLabel =
        scope === 'personal'
            ? '个人记忆'
            : scope === 'all'
                ? '全部范围'
                : '工作记忆';
    const sourceUrl = normalizeText(typeof request?.sourceUrl === 'string' ? request.sourceUrl : '');
    let sourceHost = '';
    if (sourceUrl) {
        try {
            sourceHost = new URL(sourceUrl).host;
        } catch {
            sourceHost = '';
        }
    }
    const scopeParts = [sourceKindLabel, scopeLabel, sourceHost ? `来源 ${sourceHost}` : ''].filter(Boolean);
    const pageReceipts =
        sourceKind === 'webpage'
            ? `${formatMemoryCapturePageTriggerReceipt(request, null, autoReason)} ${formatMemoryCapturePageSnapshotReceipt(request)} `
            : '';
    return `${scopeParts.join(' · ')}：${pageReceipts}本机自动入库请求已提交，尚未确认创建 source-memory capsule 或写入${getMemoryCaptureWriteSignalLabel(request)}；成功或失败会用最终回执替换。提交中不会外发、插入输入框、同步其他平台、写 confirmed profile 或创建任务。`;
}

function asPlainObject(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null;
    }
    return value as Record<string, unknown>;
}

function getMemoryCaptureWriteReceipt(capsule: unknown): MemoryCaptureWriteReceipt | null {
    const capsuleObject = asPlainObject(capsule);
    const receipt = asPlainObject(capsuleObject?.writeReceipt);
    if (!receipt) return null;
    const label = normalizeText(typeof receipt.label === 'string' ? receipt.label : '');
    const detail = normalizeText(typeof receipt.detail === 'string' ? receipt.detail : '');
    if (!label && !detail) return null;
    return {
        state:
            receipt.state === 'saved_without_recall_signal' || receipt.state === 'dismissed_no_recall'
                ? receipt.state
                : 'saved_with_recall_signal',
        label,
        detail,
        evidence: Array.isArray(receipt.evidence)
            ? receipt.evidence.map((item) => normalizeText(String(item))).filter(Boolean)
            : undefined,
        nextStep: normalizeText(typeof receipt.nextStep === 'string' ? receipt.nextStep : ''),
    };
}

function formatMemoryCaptureWriteReceipt(
    capsule: unknown,
    fallback = '已写入资料记忆和网页检索信号；不会自动外发、插入或同步。',
): string {
    const receipt = getMemoryCaptureWriteReceipt(capsule);
    if (!receipt) return fallback;
    const parts: string[] = [];
    if (receipt.label && receipt.detail) {
        parts.push(`${receipt.label}：${receipt.detail}`);
    } else {
        parts.push(receipt.label || receipt.detail);
    }
    if (receipt.nextStep) {
        parts.push(receipt.nextStep);
    }
    return parts.filter(Boolean).join(' ');
}

function formatMemoryCaptureDuplicateWriteReceipt(
    capsule: unknown,
    updatedNote: boolean,
): string {
    const signalLabel = getMemoryCaptureCapsuleSignalLabel(capsule);
    const receipt = getMemoryCaptureWriteReceipt(capsule);
    const signalText =
        receipt?.state === 'saved_without_recall_signal'
            ? `已有资料仍保留，但关联${signalLabel}当前缺失。`
            : receipt?.state === 'dismissed_no_recall'
                ? `已有资料已撤销，关联${signalLabel}已关闭。`
                : `已有资料和关联${signalLabel}保持启用。`;
    const changeText = updatedNote
        ? `本次更新了已有资料的备注、summary 和关联${signalLabel}；没有新建第二条资料。`
        : '本次没有新建第二条资料，也没有更新备注或正文；只记录一次重复入库事件。';
    const nextStep =
        receipt?.nextStep ||
        '可在资料详情复核、补备注或撤销；不会自动外发、插入输入框或同步到其他平台。';
    return `${changeText}${signalText}${nextStep}`;
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

function getContextRehearsalMetadataText(
    match: ContextRecallMatch,
    key: 'summary' | 'content',
): string {
    const metadata = asPlainObject(match.metadata);
    const rehearsal = asPlainObject(metadata?.rehearsal);
    const value = rehearsal?.[key];
    return typeof value === 'string' ? normalizeText(value) : '';
}

function getContextRehearsalMetadata(match: ContextRecallMatch): Record<string, unknown> | null {
    const metadata = asPlainObject(match.metadata);
    return asPlainObject(metadata?.rehearsal);
}

function formatContextRehearsalStatus(value?: string): string {
    switch (normalizeText(value).toLowerCase()) {
        case 'active':
            return 'Active';
        case 'candidate':
            return 'Candidate / 候选';
        case 'stale':
            return 'Stale / 已降权';
        case 'paused':
            return 'Paused / 已暂停';
        case 'used':
            return 'Used / 已使用';
        case 'dismissed':
            return 'Dismissed / 不相关';
        case 'archived':
            return 'Archived / 已归档';
        default:
            return value ? normalizeText(value) : '状态未返回';
    }
}

function formatContextRehearsalDisplayEligibility(match: ContextRecallMatch): string {
    const status = formatContextRehearsalStatus(
        String(getContextRehearsalMetadata(match)?.status || ''),
    );
    const priority = formatContextRecallDisplayPriorityLabel(match.displayPriority);
    if (!priority) return status;
    return `${status} · ${priority}`;
}

function collectContextRehearsalCueRows(match: ContextRecallMatch): string[] {
    const rows: string[] = [];
    const add = (label: string, rawValue: unknown): void => {
        const values = Array.isArray(rawValue) ? rawValue : [rawValue];
        const normalized = values
            .map((item) => normalizeText(String(item || '')))
            .filter(Boolean)
            .slice(0, 2);
        if (!normalized.length) return;
        const row = `${label}：${normalized.join(' / ')}`;
        if (!rows.includes(row)) rows.push(row);
    };

    const metadata = asPlainObject(match.metadata);
    const matchedCues = asPlainObject(metadata?.matchedCues);
    const activationCues = asPlainObject(getContextRehearsalMetadata(match)?.activationCues);
    const anchors = match.matchedAnchors || {};
    const cueSources = [matchedCues, activationCues, anchors].filter(Boolean);

    const keyLabels: Array<[string, string]> = [
        ['people', '人物'],
        ['persons', '人物'],
        ['projects', '项目'],
        ['issues', 'Issue'],
        ['issueKeys', 'Issue'],
        ['groups', '群组'],
        ['groupIds', '群组'],
        ['conversations', '会话'],
        ['conversationIds', '会话'],
        ['meetings', '会议'],
        ['urls', 'URL'],
        ['surfaces', 'Surface'],
        ['topics', '主题'],
        ['keywords', '关键词'],
        ['source', '来源'],
    ];

    for (const source of cueSources) {
        if (!source) continue;
        for (const [key, label] of keyLabels) {
            add(label, source[key]);
            if (rows.length >= 4) return rows;
        }
    }

    for (const item of match.whyRelevant || []) {
        const value = stripContextReasonNoise(item);
        if (value && !rows.includes(value)) rows.push(value);
        if (rows.length >= 4) break;
    }

    return rows.slice(0, 4);
}

function buildContextRehearsalReceiptItems(
    match: ContextRecallMatch,
    exploreUrl: string,
): Array<[string, string]> {
    if (!isContextRehearsalMatch(match)) return [];
    const cues = collectContextRehearsalCueRows(match);
    return [
        ['触发线索', cues.length ? cues.join(' · ') : '后端未返回结构化线索，先按当前 why 说明弱提示处理'],
        ['提示资格', formatContextRehearsalDisplayEligibility(match)],
        [
            '复核入口',
            exploreUrl
                ? '可打开 Rehearsal 管理页复核脚本、来源和激活历史'
                : '没有可打开的 Rehearsal 管理入口，先按只读提示处理',
        ],
        ['操作边界', '只读预演，不生成/插入/发送/执行'],
        ['反馈影响', '有用/不相关只调整这条预演后续命中，不发送消息或执行脚本'],
    ];
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
        cue_id: clipContextFeedbackDetailValue(match.cue?.id, 120),
        cue_key: clipContextFeedbackDetailValue(match.cue?.cueKey, 220),
        cue_action_type: clipContextFeedbackDetailValue(match.cue?.actionType, 60),
        cue_compile_status: clipContextFeedbackDetailValue(
            match.cue?.compileStatus,
            60,
        ),
        cue_confidence: clipContextFeedbackDetailValue(
            typeof match.cue?.confidence === 'number'
                ? String(match.cue.confidence)
                : undefined,
            40,
        ),
        cue_why_now: clipContextFeedbackDetailValue(match.cue?.whyNow, 180),
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

function summarizeContextCueForTrace(match: ContextRecallMatch): Record<string, unknown> | undefined {
    const cue = match.cue;
    if (!cue?.id) return undefined;
    return {
        id: cue.id,
        cueKey: cue.cueKey,
        actionType: cue.actionType,
        compileStatus: cue.compileStatus,
        confidence: cue.confidence,
        whyNow: cue.whyNow,
    };
}

function submitContextRecallAmbientTrace(
    match: ContextRecallMatch,
    contextKey: string | undefined,
    action: 'expanded' | 'opened_source',
    surface: string,
): void {
    if (typeof chrome === 'undefined' || !chrome?.runtime?.sendMessage) {
        return;
    }
    const cueIds = match.cue?.id ? [match.cue.id] : [];
    const cueKeys = match.cue?.cueKey ? [match.cue.cueKey] : [];
    try {
        chrome.runtime.sendMessage(
            {
                type: 'AMBIENT_CALIBRATION_TRACE',
                trace: {
                    surface: 'memory_lens',
                    sceneKey: contextKey || window.location.href,
                    action,
                    strength: action === 'expanded' ? 'medium' : 'weak',
                    polarity: action === 'expanded' ? 'positive' : 'neutral',
                    evidenceRefs: [
                        {
                            id: getContextRecallFeedbackTargetId(match),
                            type: match.type,
                            title: match.title || match.sourceTitle,
                            sourceLabel: match.sourceLabel,
                            role: 'used',
                            score: typeof match.score === 'number' ? match.score : undefined,
                            cueId: match.cue?.id,
                            cueKey: match.cue?.cueKey,
                            cue: summarizeContextCueForTrace(match),
                        },
                    ],
                    privacyClass: 'sensitive_redacted',
                    metadata: {
                        contextSurface: surface,
                        displayPriority: match.displayPriority,
                        reasonType: match.reasonType,
                        evidenceRole: match.evidenceRole,
                        cueIds,
                        cueKeys,
                    },
                    createdAt: Date.now(),
                },
            },
            () => {
                void chrome.runtime.lastError;
            },
        );
    } catch (error) {
        console.warn('Context recall ambient trace failed:', error);
    }
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

function getContextLensPresentation(match: ContextRecallMatch): NonNullable<ContextRecallMatch['lensPresentation']> | null {
    const presentation = match.lensPresentation;
    if (!presentation || typeof presentation !== 'object') return null;
    return presentation;
}

function selectContextLensTitle(match: ContextRecallMatch, sourceLabel: string): string {
    const presentationTitle = clipContextLensTitle(
        getContextLensPresentation(match)?.title || '',
    );
    if (presentationTitle) return presentationTitle;

    const candidates = [
        getContextMatchMetadataText(match, 'summary'),
        getContextMatchFirstContextMessage(match),
        match.title,
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
    const presentationInfo = cleanContextLensDisplayText(
        getContextLensPresentation(match)?.extractedInfo || '',
    );
    if (presentationInfo) return presentationInfo;

    const cueText = cleanContextLensDisplayText(
        match.cue?.compileStatus === 'compiled' &&
            match.cue.surfaceEligibility?.includes('memory_lens')
            ? match.cue.cueText
            : '',
    );
    if (cueText) return cueText;

    if (isContextRehearsalMatch(match)) {
        const rehearsalContent = cleanContextLensDisplayText(
            getContextRehearsalMetadataText(match, 'content'),
        );
        if (rehearsalContent) return rehearsalContent;

        const rehearsalSummary = cleanContextLensDisplayText(
            getContextRehearsalMetadataText(match, 'summary'),
        );
        if (rehearsalSummary) return rehearsalSummary;
    }

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
    if (isContextRehearsalMatch(match)) {
        const rehearsalSummary = cleanContextLensDisplayText(
            getContextRehearsalMetadataText(match, 'summary'),
        );
        return rehearsalSummary &&
            rehearsalSummary !== cleanContextLensDisplayText(summaryText)
            ? rehearsalSummary
            : '';
    }

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

function selectContextLensSuggestedAction(match: ContextRecallMatch): string {
    return cleanContextLensDisplayText(
        getContextLensPresentation(match)?.suggestedAction || '',
    );
}

function formatContextMatchStrength(match: ContextRecallMatch): string {
    const presentation = getContextLensPresentation(match);
    if (presentation) {
        if (presentation.status === 'ready' && presentation.informationValue !== 'low') {
            return '强相关';
        }
        if (presentation.status === 'partial') return '同场景线索';
        return '低信息';
    }
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
    response: ContextRecallResponsePayload | null | undefined,
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

function selectMemoryChangeProjections(
    response: ContextRecallResponsePayload | null | undefined,
): MemoryChangeProjection[] {
    if (!Array.isArray(response?.changeProjections)) return [];
    return response.changeProjections
        .filter((projection) =>
            Boolean(
                normalizeText(projection?.chainKey) &&
                normalizeText(projection?.subjectLabel) &&
                normalizeText(projection?.propertyLabel) &&
                normalizeText(projection?.summary),
            ),
        )
        .slice(0, 3);
}

function buildChangeProjectionPresentationMatch(
    projections: MemoryChangeProjection[],
): ContextRecallMatch | null {
    const projection = projections[0];
    if (!projection) return null;
    const sourceRef = projection.currentEvent?.sourceRef;
    const sourceUrl = normalizeText(sourceRef?.url);
    const sourceTitle = normalizeText(sourceRef?.title) || '变化证据';
    const exploreLink = sourceRef?.type === 'source_memory' && normalizeText(sourceRef.id)
        ? `#/source-memory/${encodeURIComponent(sourceRef.id)}`
        : undefined;
    return {
        id: `change:${projection.chainKey}`,
        type: 'source_memory',
        score: projection.status === 'conflicted' ? 0.97 : 0.93,
        title: `${projection.subjectLabel} · 变化脉络`,
        uiSummary: projection.summary,
        snippet: projection.summary,
        sourceLabel: '变化脉络',
        sourceUrl: sourceUrl || undefined,
        sourceTitle,
        exploreLink,
        links: sourceUrl ? [{ label: '核对变化来源', url: sourceUrl }] : [],
        whyMatched: `当前页面与 ${projection.subjectLabel} 是同一稳定对象`,
        whyRelevant: [
            `${projection.propertyLabel} 有 ${projection.eventCount} 条状态变化证据`,
            projection.boundary,
        ],
        matchedAnchors: {
            topics: [projection.subjectLabel, projection.propertyLabel],
        },
        reasonType: 'prior_decision',
        evidenceRole: 'context',
        displayPriority: projection.status === 'conflicted' ? 'p1' : 'p2',
        metadata: {
            changeLedgerPresentation: true,
            changeProjectionCount: projections.length,
        },
        timestamp: projection.lastObservedAt,
        lensPresentation: {
            status: 'ready',
            informationValue: projection.status === 'conflicted' ? 'high' : 'medium',
            title: `${projection.subjectLabel} · 变化脉络`,
            extractedInfo: projection.summary,
            suggestedAction: projection.status === 'conflicted' ? '先核对当前值' : '展开查看历史',
            novelty: 'new_to_current_surface',
            sourceBoundary: 'reviewable_memory',
        },
    };
}

function formatMemoryChangeProjectionStatus(
    status: MemoryChangeProjection['status'],
    currentValue?: MemoryChangeValue,
): string {
    if (status === 'confirmed_current') return '已确认当前';
    if (status === 'last_observed') return '最后观测';
    if (status === 'conflicted') return '存在冲突';
    if (status === 'historical_only') return '仅历史';
    if (status === 'superseded_at_source') {
        return currentValue?.normalized === null ? 'Jira 当前为空' : 'Jira 当前不同';
    }
    return '页面已有新值';
}

function formatMemoryChangeAuthority(role: string): string {
    if (role === 'authoritative_source') return '权威来源';
    if (role === 'owner_authored') return '用户本人';
    if (role === 'team_message') return '团队消息';
    if (role === 'ai_generated') return 'AI 生成';
    if (role === 'source_snapshot') return '来源快照';
    return '推断证据';
}

function formatMemoryChangeDate(timestamp?: number): string {
    if (!timestamp || !Number.isFinite(timestamp)) return '时间未记录';
    try {
        return new Date(timestamp * 1000).toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        });
    } catch (_error) {
        return '时间未记录';
    }
}

function renderMemoryChangeProjectionSection(
    projections: MemoryChangeProjection[],
): string {
    if (!projections.length) return '';
    const subjectLabel = projections[0]?.subjectLabel || '当前对象';
    const rows = projections.map((projection) => {
        const statusLabel = formatMemoryChangeProjectionStatus(projection.status, projection.currentValue);
        const currentValue = projection.status === 'superseded_on_page' || projection.status === 'superseded_at_source'
            ? projection.visiblePageValue?.display || projection.currentValue?.display || '未知'
            : projection.currentValue?.display || '未知';
        const previousValue = projection.previousValue?.display || '未记录';
        const history = [...(projection.history || [])]
            .reverse()
            .map((event) => {
                const transition = `${event.previousValue?.display || '未记录'} → ${event.nextValue?.display || '未知'}`;
                const reason = normalizeText(event.reason) || '未记录原因';
                const source = normalizeText(event.sourceRef?.title) || normalizeText(event.sourceRef?.type) || '来源未标记';
                return `
                    <li class="pai-context-change-event">
                        <div class="pai-context-change-event-main">
                            <time>${escapeHtml(formatMemoryChangeDate(event.observedAt))}</time>
                            <strong>${escapeHtml(transition)}</strong>
                            ${event.isReversal ? '<span class="pai-context-change-reversal">回退</span>' : ''}
                        </div>
                        <div class="pai-context-change-event-meta">${escapeHtml(`${formatMemoryChangeAuthority(event.authorityRole)} · ${source} · 原因：${reason}`)}</div>
                    </li>
                `;
            })
            .join('');
        return `
            <div class="pai-context-change-row">
                <div class="pai-context-change-current">
                    <div>
                        <strong class="pai-context-change-property">${escapeHtml(projection.propertyLabel)}</strong>
                        <div class="pai-context-change-transition">
                            <span>${escapeHtml(previousValue)}</span>
                            <span aria-hidden="true">→</span>
                            <b>${escapeHtml(currentValue)}</b>
                        </div>
                    </div>
                    <span class="pai-context-change-status pai-context-change-status--${escapeHtmlAttribute(projection.status)}">${escapeHtml(statusLabel)}</span>
                </div>
                <div class="pai-context-change-boundary">${escapeHtml(projection.boundary)}</div>
                <details class="pai-context-change-history">
                    <summary>查看 ${projection.history.length} 条历史证据${projection.reversalCount ? ` · ${projection.reversalCount} 次回退` : ''}</summary>
                    <ol>${history}</ol>
                </details>
            </div>
        `;
    }).join('');
    return `
        <section class="pai-context-change-ledger" aria-label="变化脉络">
            <div class="pai-context-change-head">
                <span>变化脉络</span>
                <span>${escapeHtml(subjectLabel)}</span>
            </div>
            ${rows}
        </section>
    `;
}

function formatAutopilotModeLabel(mode?: ContextRecallAutopilotDecision['mode']): string {
    switch (mode) {
        case 'card':
            return '强相关卡片';
        case 'chip':
            return '低打扰入口';
        case 'context_pack':
            return '上下文证据';
        case 'silent':
            return '保持安静';
        default:
            return '展示前过滤';
    }
}

function summarizeAutopilotSceneAnchors(
    anchors?: ContextRecallSceneSummary,
): string {
    if (!anchors) return '';
    const groups: string[] = [];
    const add = (label: string, values?: string[]): void => {
        const cleaned = (values || [])
            .map((item) => normalizeText(item))
            .filter(Boolean)
            .slice(0, 3);
        if (cleaned.length) groups.push(`${label} ${cleaned.join(' / ')}`);
    };
    add('人物', anchors.people);
    add('项目', anchors.projects);
    add('主题', anchors.topics);
    add('来源', anchors.source);
    return groups.slice(0, 3).join(' · ');
}

function buildContextAutopilotReceiptItems(
    autopilot?: ContextRecallAutopilotDecision | null,
): Array<[string, string]> {
    if (!autopilot) return [];

    const items: Array<[string, string]> = [];
    const summary = normalizeText(autopilot.summary);
    const modeLabel = formatAutopilotModeLabel(autopilot.mode);
    items.push([
        '展示判断',
        summary || `${modeLabel}：${autopilot.shownCount || 0} 条进入当前提示。`,
    ]);

    const filteredParts: string[] = [];
    if (autopilot.quietedCount > 0) {
        filteredParts.push(`静默 ${autopilot.quietedCount} 条弱候选`);
    }
    const quietReason = autopilot.quietReasons?.[0];
    if (quietReason?.label) {
        filteredParts.push(`${quietReason.label}${quietReason.count > 1 ? ` x${quietReason.count}` : ''}`);
    }
    if (autopilot.duplicateMergedCount > 0) {
        filteredParts.push(`合并 ${autopilot.duplicateMergedCount} 组同源重复`);
    }
    if (filteredParts.length) {
        items.push(['过滤', filteredParts.slice(0, 3).join(' · ')]);
    }

    const sceneAnchors = summarizeAutopilotSceneAnchors(autopilot.sceneAnchors);
    if (sceneAnchors) {
        items.push(['场景锚点', sceneAnchors]);
    }

    items.push([
        '边界',
        '只读展示前过滤；不写入记忆、不强化访问计数、不外发来源',
    ]);

    return items.slice(0, 4);
}

function buildContextAutopilotCompactSummaryText(
    autopilot?: ContextRecallAutopilotDecision | null,
): string {
    if (!autopilot) return '';

    const visibleParts: string[] = [];
    if (autopilot.strongCount > 0 && autopilot.possibleCount > 0) {
        visibleParts.push(`${autopilot.strongCount + autopilot.possibleCount} 条进入当前提示`);
    } else if (autopilot.strongCount > 0) {
        visibleParts.push(`${autopilot.strongCount} 条强相关`);
    } else if (autopilot.possibleCount > 0) {
        visibleParts.push(`${autopilot.possibleCount} 条可能相关`);
    } else if (autopilot.shownCount > 0) {
        const shownLabel = autopilot.mode === 'chip'
            ? '可能相关'
            : autopilot.mode === 'context_pack'
                ? '上下文证据'
                : '进入当前提示';
        visibleParts.push(`${autopilot.shownCount} 条${shownLabel}`);
    }

    const quietedCount = autopilot.quietedCount || autopilot.hiddenCount || 0;
    if (quietedCount > 0) {
        visibleParts.push(`${quietedCount} 条静默`);
    }

    if (!visibleParts.length && autopilot.candidateCount > 0) {
        visibleParts.push(`${autopilot.candidateCount} 条候选`);
    }

    return visibleParts.slice(0, 2).join('，');
}

function formatContextRecallCacheAgeLabel(ageMs: number): string {
    const safeAgeMs = Math.max(0, ageMs);
    if (safeAgeMs < 15_000) return '刚刚';
    if (safeAgeMs < 60_000) {
        return `${Math.max(1, Math.floor(safeAgeMs / 1000))} 秒前`;
    }
    return `${Math.max(1, Math.floor(safeAgeMs / 60_000))} 分钟前`;
}

function buildContextRecallCurrentBasisReceipt(): string {
    return '本轮召回 · 页面稳定后重新请求';
}

function getJiraFreshnessCheckedAt(payload: ContextMatchPayload): number | undefined {
    const checkedAt = payload.currentContext?.verifiedSourceFields
        ?.map((field) => field.checkedAt)
        .filter((value) => Number.isFinite(value))
        .reduce((latest, value) => Math.max(latest, value), 0);
    return checkedAt && checkedAt > 0 ? checkedAt : undefined;
}

function buildContextRecallCachedBasisReceipt(cachedAtMs: number, now = Date.now()): string {
    return `本地缓存 · ${formatContextRecallCacheAgeLabel(now - cachedAtMs)}召回；未重新请求`;
}

function buildContextBubbleRecallContext(
    payload: ContextMatchPayload,
): ContextBubbleRecallContext {
    return {
        surface: payload.surface,
        contextType: payload.contextType,
        title: payload.title,
        url: payload.url,
        sourceContext: payload.sourceContext,
        currentContext: payload.currentContext,
    };
}

function hasContextWhyRelevant(match: ContextRecallMatch): boolean {
    return Array.isArray(match.whyRelevant) && match.whyRelevant.some((item) => normalizeText(item));
}

function isExplainablePassiveContextMatch(match: ContextRecallMatch): boolean {
    if (!hasContextWhyRelevant(match)) return false;
    return match.displayPriority === 'p1' || match.displayPriority === 'p2';
}

function getContextStrengthClass(match: ContextRecallMatch): string {
    const presentation = getContextLensPresentation(match);
    if (presentation) {
        if (presentation.status === 'ready' && presentation.informationValue !== 'low') {
            return 'strong';
        }
        if (presentation.status === 'partial') return 'maybe';
        return 'weak';
    }
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
    add(formatContextRecallReasonType(match.reasonType));
    add(formatContextRecallEvidenceRole(match.evidenceRole));
    add(formatContextRecallSourceLabel(match.sourceLabel));
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

function buildSelectionSearchOpenReceipt(
    match: ContextRecallMatch,
    selectedText: string,
    matchCount: number,
    currentIndex: number,
): Array<[string, string]> {
    const safeCount = Math.max(1, matchCount);
    const matchedTerm = getSelectionSearchMatchedTerm(match, selectedText);
    const currentLabel = safeCount > 1
        ? `本轮 ${safeCount} 条强相关候选；当前第 ${currentIndex + 1} 条`
        : '本轮 1 条强相关候选';
    return [
        ['打开', '点击只打开已命中的本轮划词结果；不二次召回、不保存、不插入、不发送、不调用外部 AI'],
        ['候选', matchedTerm ? `${currentLabel}，选中文本锚点：${matchedTerm}` : currentLabel],
    ];
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

function buildContextRecallSourceReceipts(
    match: ContextRecallMatch,
    exploreUrl: string,
    sourceLinks: Array<{ label: string; url: string }>,
): string[] {
    const receipts: string[] = [];
    const rawExploreRoute = normalizeText(match.exploreLink);
    const rawSourceUrls = [
        normalizeText(match.sourceUrl),
        ...(Array.isArray(match.links) ? match.links : [])
            .map((link) => normalizeText(link?.url))
            .filter(Boolean),
    ].filter(Boolean);

    if (!exploreUrl && rawExploreRoute) {
        receipts.push('记忆入口已隐藏');
    } else if (!exploreUrl && !sourceLinks.length) {
        receipts.push('记忆入口缺失');
    }

    if (!sourceLinks.length && rawSourceUrls.length) {
        receipts.push('原始来源已隐藏');
    } else if (!sourceLinks.length) {
        receipts.push('原始来源缺失');
    }

    return receipts.slice(0, 2);
}

function normalizeContextSourceUrlKey(rawUrl: string): string {
    const normalizedUrl =
        normalizeContextPageUrl(rawUrl) ||
        sanitizeContextExternalUrl(rawUrl);
    if (!normalizedUrl) return '';

    try {
        const parsed = new URL(normalizedUrl);
        return parsed.toString();
    } catch (_error) {
        return '';
    }
}

function getContextMatchTimestampMs(match: ContextRecallMatch): number | null {
    if (!match.timestamp || !Number.isFinite(match.timestamp)) return null;
    return match.timestamp > 10_000_000_000
        ? match.timestamp
        : match.timestamp * 1000;
}

function formatContextSourceAgeReceipt(match: ContextRecallMatch): string {
    const timestampMs = getContextMatchTimestampMs(match);
    if (!timestampMs) return '';

    const ageMs = Date.now() - timestampMs;
    if (!Number.isFinite(ageMs) || ageMs < 0) return '';

    const ageDays = Math.floor(ageMs / (24 * 60 * 60 * 1000));
    if (ageDays >= 365) {
        const ageYears = Math.max(1, Math.floor(ageDays / 365));
        return `${ageYears}年前记录，行动前复核`;
    }

    if (ageDays >= 90) {
        return `${ageDays}天前记录，行动前复核`;
    }

    return '';
}

function buildContextRecallSourceStatusReceipts(
    match: ContextRecallMatch,
    sourceLinks: Array<{ label: string; url: string }>,
    exploreUrl: string,
    currentUrl: string,
): string[] {
    const receipts: string[] = [];
    const primarySourceUrl = sourceLinks[0]?.url || '';

    if (match.scope === 'personal') {
        receipts.push('个人记忆已进入本次提示');
    }

    if (primarySourceUrl) {
        try {
            const sourceUrl = new URL(primarySourceUrl);
            const pageUrl = new URL(currentUrl);
            const samePage =
                normalizeContextSourceUrlKey(sourceUrl.toString()) ===
                normalizeContextSourceUrlKey(pageUrl.toString());
            if (samePage) {
                receipts.push('当前页面来源可复核');
            } else if (sourceUrl.hostname === pageUrl.hostname) {
                if (match.type === 'source_memory') {
                    receipts.push('已保存资料来源可复核');
                    receipts.push(`同站 ${sourceUrl.hostname}`);
                } else {
                    receipts.push('同站来源可复核');
                }
            } else if (match.type === 'source_memory') {
                receipts.push('已保存资料来源可复核');
            } else {
                receipts.push('外部来源可复核');
            }
        } catch (_error) {
            // Sanitized source URLs should parse, but keep the card resilient.
        }
    }

    if (exploreUrl) {
        receipts.push(match.type === 'source_memory' ? '资料详情可复核' : '记忆详情可复核');
    }

    const ageReceipt = formatContextSourceAgeReceipt(match);
    if (ageReceipt) {
        receipts.push(ageReceipt);
    }

    return Array.from(new Set(receipts)).slice(0, 4);
}

function isMeetingPilotPage(): boolean {
    return (
        window.location.hostname === 'v.ringcentral.com' &&
        /^\/conf\/on\/[^/?#]+/.test(window.location.pathname)
    );
}

const contextMatchCache = new Map<string, ContextMatchCacheEntry>();
const CONTEXT_MATCH_CACHE_TTL_MS = 5 * 60 * 1000;
const JIRA_MEMORY_FRESHNESS_CACHE_TTL_MS = 60_000;
const jiraMemoryFreshnessCache = new Map<string, {
    fields: NonNullable<NonNullable<ContextMatchPayload['currentContext']>['verifiedSourceFields']>;
    ts: number;
}>();
const CONTEXT_MATCH_CACHE_MAX_ENTRIES = 80;
const DISMISSED_CONTEXT_TTL_MS = 30 * 60 * 1000;
const URL_WATCH_INTERVAL_MS = 500;
const GENERIC_CONTEXT_STABLE_MS = 250;
const RINGCENTRAL_CONTEXT_STABLE_MS = 700;
const CONTEXT_RECALL_IN_FLIGHT_TTL_MS = 35 * 1000;
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
const PAGE_VISUAL_MEMORY_MIN_AREA = 28_000;
const PAGE_VISUAL_MEMORY_MIN_TEXT_CHARS = 16;
const COMPOSER_GUARD_ROOT_SELECTOR = '#pai-composer-guard-root';
const COMPOSER_GUARD_ICON_SELECTOR =
    '#pai-composer-guard-root .pai-composer-guard-icon-button';
const COMPOSE_ASSIST_VISIBILITY_EVENT = 'personal-ai-compose-assist-visibility';
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
    private lastSeenUrl = window.location.href;
    private urlWatcherId: number | null = null;
    private contextMatchTimer: number | null = null;
    private observedContextStabilityKey: string | null = null;
    private observedContextSince = 0;
    private pendingContextRequestId = 0;
    private pendingContextKey: string | null = null;
    private contextRecallInFlightStartedAtByKey = new Map<
        string,
        { startedAt: number; requestId: number }
    >();
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
    private pageCaptureReviewElement: HTMLElement | null = null;
    private visualMemoryPreviewElement: HTMLElement | null = null;
    private pageCaptureTimer: number | null = null;
    private pageCaptureRequestId = 0;
    private pageCapturePendingContextKey: string | null = null;
    private pageCaptureShownContextKey: string | null = null;
    private pageCaptureStoredContextKey: string | null = null;
    private pageAnalysisResultByKey = new Map<string, PassiveWebpageAnalysisResult>();
    private pageCaptureCandidateByContextKey = new Map<string, MemoryCaptureCandidateResult>();
    private pageCaptureScoreSignalByContextKey = new Map<string, string>();
    private pageCaptureEvaluationSignalByContextKey = new Map<string, string>();
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
    private siteControlSyncToastSuppressedUntil = 0;
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
                this.scheduleContextMatch(1500);
            });
        } else {
            this.scheduleContextMatch(1500);
        }

        if (document.body) {
            const observer = new MutationObserver((mutations) => {
                if (this.mutationMayAffectSensitiveContext(mutations)) {
                    this.handleSensitiveContextMutation();
                }

                if (this.mutationMayAffectComposerAssistAffordance(mutations)) {
                    const currentPayload = this.buildContextMatchPayload();
                    if (
                        this.shouldSuppressContextBubbleForComposerAssist(
                            currentPayload || undefined,
                        )
                    ) {
                        this.invalidatePendingContextRequest();
                        this.clearContextBubble();
                    }
                    this.scheduleContextMatch(0);
                }

                const hasSignificantChanges = this.hasSignificantAnalysisChanges(mutations);
                if (
                    hasSignificantChanges &&
                    (
                        this.getPageMemoryCaptureDwellMs() >= PAGE_MEMORY_CAPTURE_MIN_DWELL_MS ||
                        this.pageCaptureCopiedText ||
                        this.pageCaptureMaxScrollDepth >= 0.6
                    )
                ) {
                    this.schedulePageMemoryCaptureEvaluation(PAGE_MEMORY_CAPTURE_INTERACTION_DELAY_MS);
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
            this.scheduleContextMatch(400);
        });

        window.addEventListener(COMPOSE_ASSIST_VISIBILITY_EVENT, (event) => {
            const visible = Boolean((event as CustomEvent<{ visible?: boolean }>).detail?.visible);
            const currentPayload = this.buildContextMatchPayload();
            if (
                visible &&
                this.shouldSuppressContextBubbleForComposerAssist(
                    currentPayload || undefined,
                )
            ) {
                this.invalidatePendingContextRequest();
                this.clearPassiveContextBubble();
                return;
            }
            this.scheduleContextMatch(visible ? 0 : 250);
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
                this.performAnalysis({ force: true })
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

    private pruneContextRecallInFlight(now = Date.now()): void {
        for (const [contextKey, request] of this.contextRecallInFlightStartedAtByKey) {
            if (now - request.startedAt >= CONTEXT_RECALL_IN_FLIGHT_TTL_MS) {
                this.contextRecallInFlightStartedAtByKey.delete(contextKey);
            }
        }
    }

    private isContextRecallRequestInFlight(
        contextKey: string,
        now = Date.now(),
    ): boolean {
        this.pruneContextRecallInFlight(now);
        return this.contextRecallInFlightStartedAtByKey.has(contextKey);
    }

    private markContextRecallRequestStarted(
        contextKey: string,
        requestId: number,
        now = Date.now(),
    ): void {
        this.pruneContextRecallInFlight(now);
        this.contextRecallInFlightStartedAtByKey.set(contextKey, {
            startedAt: now,
            requestId,
        });
    }

    private markContextRecallRequestFinished(
        contextKey: string,
        requestId: number,
    ): void {
        const current = this.contextRecallInFlightStartedAtByKey.get(contextKey);
        if (current?.requestId === requestId) {
            this.contextRecallInFlightStartedAtByKey.delete(contextKey);
        }
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

    private async performAnalysis(
        options: { force?: boolean } = {},
    ): Promise<PassiveWebpageAnalysisResult | null> {
        if (this.isAnalyzing) return null;
        if (this.isSensitiveContextPage()) {
            console.log('🔒 当前页面处于敏感场景，跳过网页智能分析');
            return null;
        }

        this.isAnalyzing = true;

        try {
            await this.loadSiteControls();
            if (this.isPassiveContextSuppressedBySiteControls()) {
                console.log('🚫 当前站点已关闭被动网页记忆处理，跳过网页智能分析');
                return null;
            }

            const pageContent = this.extractPageContent();
            if (!pageContent || pageContent.wordCount < 50) {
                console.log('📄 页面内容不足，跳过分析');
                return null;
            }

            this.lastAnalysisTime = Date.now();
            this.analysisCount++;
            console.log(`🔍 开始单次网页资料分析 #${this.analysisCount}:`, window.location.href);
            const analysisKey = buildPassiveWebpageAnalysisKey(pageContent);
            const response = await chrome.runtime.sendMessage({
                type: 'WEB_INTELLIGENCE_ANALYSIS',
                pageContent,
                analysisKey,
                force: Boolean(options.force),
                triggerSource: 'manual',
            });
            if (!response?.success) {
                throw new Error(response?.error || '网页分析未返回成功结果');
            }
            console.log('✅ 单次网页资料分析完成（尚未写入记忆）:', {
                decision: response.result?.decision,
                requestReuse: response.requestReuse,
                storageBoundary: response.storageBoundary,
            });
            return response.result || null;
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
            elements = Array.from(new Set(Array.from(document.querySelectorAll([
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
            ].join(', ')))));
        } catch (_error) {
            elements = Array.from(new Set(Array.from(document.querySelectorAll('svg, canvas, img, table, figure, [role="img"], [role="figure"]'))));
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

    private async tryContextMatch(): Promise<void> {
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

        const freshnessPayload = await this.enrichJiraMemoryFreshness(payload);
        const currentPayloadAfterFreshness = this.buildContextMatchPayload();
        if (!currentPayloadAfterFreshness || currentPayloadAfterFreshness.contextKey !== payload.contextKey) {
            return;
        }
        payload.currentContext = freshnessPayload.currentContext;

        this.sendOwnerAuthoredLearningSignals(payload);

        const cached = contextMatchCache.get(payload.contextKey);
        const jiraFreshnessCheckedAt = getJiraFreshnessCheckedAt(payload);
        if (this.isContextDismissed(payload.contextKey)) {
            this.clearContextBubble();
            return;
        }

        if (
            cached &&
            now - cached.ts < CONTEXT_MATCH_CACHE_TTL_MS &&
            (!jiraFreshnessCheckedAt || cached.jiraFreshnessCheckedAt === jiraFreshnessCheckedAt)
        ) {
            const cachedChangeProjections = cached.changeProjections || [];
            if (cached.match || cachedChangeProjections.length) {
                const shouldAnimateCachedMatch =
                    cached.match?.displayPriority === 'p1' &&
                    this.activeBubbleContextKey !== payload.contextKey;
                const cachedMatches = cached.matches.length
                    ? cached.matches
                    : cached.match
                        ? [cached.match]
                        : [];
                this.showContextBubble(
                    cachedMatches,
                    payload.contextKey,
                    shouldAnimateCachedMatch,
                    false,
                    {
                        autopilot: cached.autopilot,
                        changeProjections: cachedChangeProjections,
                        keystoneBrief: cached.keystoneBrief,
                        uiLanguage: cached.uiLanguage,
                        recallBasis: buildContextRecallCachedBasisReceipt(cached.ts, now),
                        recallContext: buildContextBubbleRecallContext(payload),
                    },
                );
            } else {
                this.clearContextBubble();
            }
            return;
        }

        if (this.pendingContextKey === payload.contextKey) {
            return;
        }

        if (this.isContextRecallRequestInFlight(payload.contextKey, now)) {
            return;
        }

        if (this.activeBubbleContextKey && this.activeBubbleContextKey !== payload.contextKey) {
            this.clearContextBubble();
        }

        this.pendingContextKey = payload.contextKey;
        const requestId = ++this.pendingContextRequestId;
        this.markContextRecallRequestStarted(payload.contextKey, requestId, now);

        chrome.runtime.sendMessage({
            type: 'CONTEXT_RECALL_REQUEST',
            request: {
                surface: payload.surface,
                contextType: payload.contextType,
                title: payload.title,
                url: payload.url,
                sourceContext: payload.sourceContext,
                currentContext: payload.currentContext,
                interactionScene: payload.interactionScene,
                exclude: payload.exclude,
                primaryText: payload.snippet,
                secondaryTexts: payload.keywords,
                entityHints: payload.entityHints,
                sourceTypes: payload.sourceTypes,
                limit: 3,
            },
        }, (response) => {
            this.markContextRecallRequestFinished(payload.contextKey, requestId);

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
            const changeProjections = selectMemoryChangeProjections(response);
            const presentationMatch = buildChangeProjectionPresentationMatch(changeProjections);
            // A ledger leads ordinary recall, but a ready/partial Keystone
            // brief still owns the Lens first screen and exposes this slot in
            // its evidence drill-down.
            const displayMatches = presentationMatch
                ? [presentationMatch, ...matches].slice(0, 3)
                : matches;
            const match = displayMatches[0] || null;
            const autopilot = response?.autopilot || null;
            const keystoneBrief = response?.keystoneBrief;
            contextMatchCache.set(payload.contextKey, {
                match,
                matches: displayMatches,
                autopilot,
                changeProjections,
                keystoneBrief,
                uiLanguage: response?.uiLanguage,
                jiraFreshnessCheckedAt,
                ts: Date.now(),
            });
            pruneContextMatchCache();

            if (match) {
                this.showContextBubble(
                    displayMatches,
                    payload.contextKey,
                    match.displayPriority === 'p1',
                    false,
                    {
                        autopilot,
                        changeProjections,
                        keystoneBrief,
                        uiLanguage: response?.uiLanguage,
                        recallBasis: buildContextRecallCurrentBasisReceipt(),
                        recallContext: buildContextBubbleRecallContext(payload),
                    },
                );
            } else {
                this.clearContextBubble();
            }
        });
    }

    private async enrichJiraMemoryFreshness(
        payload: ContextMatchPayload,
    ): Promise<ContextMatchPayload> {
        const issueKey = normalizeText(payload.currentContext?.issueKey);
        if (payload.contextType !== 'jira_issue' || !issueKey) return payload;

        const cacheKey = issueKey.toUpperCase();
        const now = Date.now();
        const cached = jiraMemoryFreshnessCache.get(cacheKey);
        let fields = cached && now - cached.ts < JIRA_MEMORY_FRESHNESS_CACHE_TTL_MS
            ? cached.fields
            : undefined;
        if (!fields) {
            try {
                const response = await chrome.runtime.sendMessage({
                    type: 'FETCH_JIRA_MEMORY_FRESHNESS_FIELDS',
                    ticketKey: issueKey,
                });
                if (response?.success && Array.isArray(response.fields)) {
                    fields = response.fields
                        .filter((field: any) =>
                            field &&
                            typeof field.propertyKey === 'string' &&
                            typeof field.name === 'string' &&
                            (typeof field.value === 'string' || field.value === null) &&
                            field.source === 'jira_rest' &&
                            Number.isFinite(field.checkedAt),
                        )
                        .slice(0, 12);
                    jiraMemoryFreshnessCache.set(cacheKey, { fields, ts: now });
                }
            } catch (error) {
                console.warn('Jira memory freshness read failed:', error);
            }
        }
        if (!fields?.length) return payload;
        return {
            ...payload,
            currentContext: {
                ...payload.currentContext,
                verifiedSourceFields: fields,
            },
        };
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
            const lensContextKey = this.getLensContextKey(snapshot);
            return {
                contextKey: lensContextKey,
                stabilityKey: lensContextKey,
                surface: this.toPassiveRecallSurface(snapshot),
                contextType: this.toPassiveRecallContextType(snapshot),
                title: snapshot.title,
                url: snapshot.url,
                keywords: snapshot.keywords,
                snippet: snapshot.primaryText,
                entityHints: this.toPassiveRecallEntityHints(snapshot),
                sourceContext: this.toPassiveRecallSourceContext(snapshot),
                currentContext: this.toPassiveRecallCurrentContext(snapshot),
                interactionScene: buildInteractionSceneSnapshot(snapshot, {
                    surface: 'memory_lens',
                    activeElement: document.activeElement,
                }),
                exclude: this.toPassiveRecallExclude(snapshot),
                sourceTypes: snapshot.sourceTypes,
                ownerAuthoredLearningPayloads: buildJiraOwnerCommentLearningPayloads(snapshot),
            };
        }

        return null;
    }

    /** Keep Lens state on one Jira issue while its fields finish rendering. */
    private getLensContextKey(snapshot: SiteContextSnapshot): string {
        const issueKey = normalizeText(snapshot.identifiers?.issueKey);
        if (snapshot.contextType === 'jira_issue' && issueKey) {
            return `jira:${issueKey.toUpperCase()}`;
        }
        return snapshot.contextKey;
    }

    private shouldSuppressContextBubbleForComposerAssist(payload?: Pick<ContextMatchPayload, 'contextType'>): boolean {
        if (payload && payload.contextType === 'selected_text') {
            return false;
        }

        if (!this.hasVisibleComposerAssistAffordance()) {
            return false;
        }

        // Jira keeps an Add comment surface mounted while the issue is read.
        // A pre-rendered Compose Assist icon must not displace Lens until the
        // user has actually entered that comment editor.
        if (payload?.contextType === 'jira_issue') {
            const activeElement = document.activeElement;
            return activeElement instanceof HTMLElement && activeElement.matches(
                'textarea, [contenteditable="true"], iframe',
            );
        }

        return true;
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

    private toPassiveRecallCurrentContext(
        snapshot: SiteContextSnapshot,
    ): ContextMatchPayload['currentContext'] {
        const identifiers = snapshot.identifiers || {};
        const participants = snapshot.audience?.people?.slice(0, 8);
        return this.compactContextRecallObject({
            title: snapshot.title,
            url: snapshot.url,
            participants,
            groupId: identifiers.groupId,
            conversationId: identifiers.conversationId,
            issueKey: identifiers.issueKey,
            visibleFields: snapshot.visibleFields,
            sourceAnchorHints: snapshot.keywords,
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
        const captureRect = this.getSelectionLastLineRect(range) || rect;

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
            this.createContextSignature(`${title}:${selectedText}:${nearbyText}`),
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
            interactionScene: buildInteractionSceneSnapshot(
                snapshot || {
                    adapterId: 'selection',
                    surface: 'generic_agent',
                    contextType: 'web_agent_prompt',
                    contextKey,
                    title,
                    url: contextUrl,
                    primaryText: selectedText.slice(0, 500),
                    identifiers,
                    audience: { people: participants },
                    sourceTypes: snapshot?.sourceTypes,
                },
                {
                    surface: 'memory_lens',
                    selectedText,
                    nearbyText,
                    activeElement: document.activeElement,
                },
            ),
            rect,
            captureRect,
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

    private getSelectionLastLineRect(range: Range): DOMRect | null {
        const rects = Array.from(range.getClientRects()).filter(
            (rect) => rect.width > 0 && rect.height > 0,
        );
        const rect = rects[rects.length - 1] || range.getBoundingClientRect();
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

        // The recall icon and the memory-capture entry are deliberately separate surfaces. The Personal
        // AI recall icon follows the selection and only opens Memory Lens; the "记住" capture dock is a
        // half-revealed + pinned to the page's right edge (same treatment as the page/visual capture
        // chips). They must never share one toolbar.
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
                this.placeSelectionMemoryCaptureDock(this.selectionCaptureDockElement, payload.captureRect);
            }
            return;
        }

        this.clearSelectedTextTrigger();

        if (shouldShowRecall) {
            const trigger = document.createElement('div');
            trigger.className = 'pai-context-selection-trigger';
            trigger.dataset.contextKey = payload.contextKey;
            trigger.setAttribute('role', 'toolbar');
            trigger.setAttribute('aria-label', '选区操作：查找关联记忆');
            trigger.addEventListener('mousedown', (event) => {
                event.preventDefault();
                event.stopPropagation();
            });

            const recallButton = document.createElement('button');
            recallButton.type = 'button';
            recallButton.className = 'pai-context-selection-action pai-context-selection-recall';
            recallButton.setAttribute('aria-label', '用 Personal AI 查找已有记忆，不保存、不插入、不发送、不调用外部 AI');
            recallButton.title = '查已有记忆；不保存、不插入、不发送、不调用外部 AI';

            const tooltipId = `pai-context-selection-tooltip-${Math.random().toString(36).slice(2)}`;
            recallButton.setAttribute('aria-describedby', tooltipId);

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

            const tooltip = document.createElement('span');
            tooltip.id = tooltipId;
            tooltip.className = 'pai-context-selection-tooltip';
            tooltip.setAttribute('role', 'tooltip');
            tooltip.textContent = '查已有记忆 · 不保存、不插入、不发送、不调用外部 AI';
            trigger.appendChild(tooltip);

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
        const triggerCenter = left + size / 2;
        const tooltipHalfWidth = 116;
        trigger.dataset.tooltipPlacement = top < 58 ? 'bottom' : 'top';
        trigger.dataset.tooltipSide =
            triggerCenter < tooltipHalfWidth + 12
                ? 'left'
                : triggerCenter > window.innerWidth - tooltipHalfWidth - 12
                    ? 'right'
                    : 'center';
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
        dock.className = 'pai-memory-capture-selection-dock pai-memory-capture-selection-dock--pending-review';
        dock.dataset.contextKey = payload.contextKey;
        const preReviewReceipt = formatMemoryCapturePreReviewReceipt(
            this.buildMemoryCaptureSelectionRequest(payload),
            candidate,
        );
        dock.setAttribute('aria-label', `记住这段选中资料，尚未写入；点击后先复核`);
        dock.title = preReviewReceipt;

        const plus = document.createElement('span');
        plus.className = 'pai-memory-capture-selection-dock-plus';
        plus.setAttribute('aria-hidden', 'true');
        plus.textContent = '+';
        dock.appendChild(plus);

        const label = document.createElement('span');
        label.className = 'pai-memory-capture-selection-dock-label';
        label.textContent = '记住';
        dock.appendChild(label);

        const pendingReceipt = document.createElement('span');
        pendingReceipt.className = 'pai-memory-capture-selection-dock-receipt';
        pendingReceipt.textContent = '未写入 · 先复核';
        dock.appendChild(pendingReceipt);

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
        this.placeSelectionMemoryCaptureDock(dock, payload.captureRect);
    }

    private placeSelectionMemoryCaptureDock(dock: HTMLElement, rect: DOMRect): void {
        // CSS pins the dock to the viewport's right edge (right: 0; translate(50%, -50%)); we only set
        // the vertical anchor so the half-revealed "记住" + sits at the selection's (last) line height.
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

        const boundaryReceipt = document.createElement('div');
        boundaryReceipt.className = 'pai-memory-capture-source-boundary';
        boundaryReceipt.textContent = formatMemoryCaptureSourceBoundaryReceipt(
            this.buildMemoryCaptureSelectionRequest(payload),
        );
        panel.appendChild(boundaryReceipt);

        const snapshotReceipt = document.createElement('div');
        snapshotReceipt.className = 'pai-memory-capture-selection-snapshot';
        snapshotReceipt.textContent = formatMemoryCaptureSelectionSnapshotReceipt(
            this.buildMemoryCaptureSelectionRequest(payload),
        );
        panel.appendChild(snapshotReceipt);

        const preview = document.createElement('div');
        preview.className = 'pai-memory-capture-note-preview';
        preview.textContent = normalizeText(payload.snippet).slice(0, 180);
        panel.appendChild(preview);

        const candidateReceipt = formatMemoryCaptureCandidateReceipt(candidate, 2);
        if (candidateReceipt) {
            const reasons = document.createElement('div');
            reasons.className = 'pai-memory-capture-note-reasons';
            reasons.textContent = candidateReceipt;
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
                interactionScene: payload.interactionScene,
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
            const failureReceipt = formatMemoryCaptureSaveFailureReceipt(
                '选区资料',
                '页面上下文已变化，请重新选择要保存的资料',
                this.buildMemoryCaptureSelectionRequest(payload),
            );
            if (error) {
                error.textContent = failureReceipt;
                error.hidden = false;
            } else {
                this.showContextToast(failureReceipt);
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
                captureReason: '用户点击选区右侧半露出 + 记住资料',
                note,
            },
        }, (response) => {
            if (chrome.runtime.lastError || !response?.success) {
                const message = chrome.runtime.lastError?.message || response?.error || '保存失败';
                const failureReceipt = formatMemoryCaptureSaveFailureReceipt(
                    '选区资料',
                    message,
                    this.buildMemoryCaptureSelectionRequest(payload),
                );
                if (saveButton) {
                    saveButton.disabled = false;
                    saveButton.textContent = '保存';
                }
                if (error) {
                    error.textContent = failureReceipt;
                    error.hidden = false;
                } else {
                    this.showContextToast(failureReceipt);
                }
                return;
            }

            this.clearSelectedTextTrigger();
            const capsule = response.result?.capsule;
            const duplicate = Boolean(capsule?.duplicate);
            const updatedDuplicateNote = duplicate && note.length > 0;
            this.showContextToast(
                updatedDuplicateNote
                    ? '这段资料已在记忆中，备注已更新'
                    : duplicate
                        ? '这段资料已在记忆中'
                        : '已保存为资料记忆',
                buildSourceMemoryDetailToastAction(capsule?.id),
                {
                    durationMs: 6500,
                    detailMessage: duplicate
                        ? formatMemoryCaptureDuplicateWriteReceipt(capsule, updatedDuplicateNote)
                        : formatMemoryCaptureWriteReceipt(capsule),
                },
            );
        });
    }

    private resetPageMemoryCaptureState(): void {
        this.pageCaptureStartedAt = Date.now();
        this.pageCaptureMaxScrollDepth = 0;
        this.pageCaptureCopiedText = false;
        this.pageCaptureShownContextKey = null;
        this.pageCaptureStoredContextKey = null;
        this.pageCaptureCandidateByContextKey.clear();
        this.pageCaptureScoreSignalByContextKey.clear();
        this.pageCaptureEvaluationSignalByContextKey.clear();
        this.clearPageMemoryCaptureReview();
        this.clearVisualMemoryPreview();
        this.invalidatePageMemoryCaptureRequest();
    }

    private invalidatePageMemoryCaptureRequest(): void {
        this.pageCaptureRequestId++;
        this.pageCapturePendingContextKey = null;
        this.pageCaptureEvaluationSignalByContextKey.clear();
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
        if (this.pageCaptureReviewElement?.dataset.contextKey === payload.contextKey) {
            return;
        }
        if (this.pageCapturePendingContextKey === payload.contextKey) {
            return;
        }
        if (payload.contextKey.startsWith('page-capture:')) {
            const completedAnalysis = this.pageAnalysisResultByKey.get(
                payload.contextKey.slice('page-capture:'.length),
            );
            if (completedAnalysis?.decision === 'skip') {
                return;
            }
        }

        const evaluationSignal = this.buildPageMemoryCaptureEvaluationSignal(payload);
        if (
            this.pageCaptureEvaluationSignalByContextKey.get(payload.contextKey) ===
            evaluationSignal
        ) {
            return;
        }
        this.pageCaptureEvaluationSignalByContextKey.set(
            payload.contextKey,
            evaluationSignal,
        );

        const scoreSignal = this.buildPageMemoryCaptureScoreSignal(payload);
        const cachedCandidate = this.pageCaptureCandidateByContextKey.get(
            payload.contextKey,
        );
        if (
            cachedCandidate &&
            this.pageCaptureScoreSignalByContextKey.get(payload.contextKey) ===
                scoreSignal
        ) {
            const requestId = ++this.pageCaptureRequestId;
            this.pageCapturePendingContextKey = payload.contextKey;
            if (!cachedCandidate.eligible) {
                this.pageCapturePendingContextKey = null;
                this.schedulePageMemoryCaptureScoreRecheck(payload.request);
                return;
            }
            void this.completePageMemoryCaptureCandidate(
                requestId,
                payload,
                cachedCandidate,
            );
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
            const currentPayload = this.buildPageMemoryCaptureRequest();
            if (!currentPayload || currentPayload.contextKey !== payload.contextKey) {
                this.pageCapturePendingContextKey = null;
                this.clearPageMemoryCaptureChip();
                return;
            }
            const currentScoreSignal = this.buildPageMemoryCaptureScoreSignal(
                currentPayload,
            );
            if (currentScoreSignal !== scoreSignal) {
                this.pageCapturePendingContextKey = null;
                this.pageCaptureEvaluationSignalByContextKey.delete(payload.contextKey);
                this.schedulePageMemoryCaptureEvaluation(0);
                return;
            }
            if (chrome.runtime.lastError || !response?.success || !response.result) {
                this.pageCapturePendingContextKey = null;
                this.clearPageMemoryCaptureChip();
                this.schedulePageMemoryCaptureScoreRecheck(currentPayload.request);
                return;
            }
            this.pageCaptureCandidateByContextKey.set(
                payload.contextKey,
                response.result,
            );
            this.pageCaptureScoreSignalByContextKey.set(
                payload.contextKey,
                scoreSignal,
            );
            if (!response.result.eligible) {
                this.pageCapturePendingContextKey = null;
                this.clearPageMemoryCaptureChip();
                this.schedulePageMemoryCaptureScoreRecheck(currentPayload.request);
                return;
            }
            void this.completePageMemoryCaptureCandidate(
                requestId,
                currentPayload,
                response.result,
            );
        });
    }

    private buildPageMemoryCaptureScoreSignal(
        payload: { contextKey: string; request: Record<string, unknown> },
    ): string {
        const interactions = (payload.request.interactions || {}) as Record<string, unknown>;
        return [
            payload.contextKey,
            payload.request.sourceKind,
            Boolean(interactions.copiedText),
            Number(interactions.dwellMs || 0) >= PAGE_MEMORY_CAPTURE_AUTO_COPY_DWELL_MS,
            Number(interactions.scrollDepth || 0) >= 0.6,
        ].join(':');
    }

    private buildPageMemoryCaptureEvaluationSignal(
        payload: { contextKey: string; request: Record<string, unknown> },
    ): string {
        const interactions = (payload.request.interactions || {}) as Record<string, unknown>;
        const dwellMs = Number(interactions.dwellMs || 0);
        const scrollDepth = Number(interactions.scrollDepth || 0);
        return [
            this.buildPageMemoryCaptureScoreSignal(payload),
            dwellMs >= PAGE_MEMORY_CAPTURE_AUTO_DEEP_READ_MS,
            dwellMs >= PAGE_MEMORY_CAPTURE_AUTO_LONG_READ_MS,
            scrollDepth >= 0.75,
            scrollDepth >= 0.85,
            scrollDepth >= 0.9,
        ].join(':');
    }

    private async completePageMemoryCaptureCandidate(
        requestId: number,
        payload: { contextKey: string; request: Record<string, unknown> },
        candidate: MemoryCaptureCandidateResult,
    ): Promise<void> {
        try {
            if (payload.request.sourceKind === 'webpage') {
                const analysis = await this.requestPassiveWebpageAnalysis(payload);
                if (requestId !== this.pageCaptureRequestId) return;
                const currentPayload = this.buildPageMemoryCaptureRequest();
                if (!currentPayload || currentPayload.contextKey !== payload.contextKey) {
                    this.clearPageMemoryCaptureChip();
                    return;
                }
                if (analysis?.decision === 'skip') {
                    console.log('⏭️ 单次网页分析判断无需进入资料候选:', {
                        contextKey: payload.contextKey,
                        reason: analysis.reason,
                    });
                    this.clearPageMemoryCaptureChip();
                    return;
                }
            }

            const autoDecision = this.getPageMemoryCaptureAutoDecision(
                candidate,
                payload.request,
            );
            if (autoDecision.shouldAutoSave) {
                this.autoSavePageMemoryCapture(payload, autoDecision.reason);
                return;
            }
            this.showPageMemoryCaptureChip(payload, candidate);
            this.schedulePageMemoryCaptureAutoRecheck(payload.request);
        } finally {
            if (
                requestId === this.pageCaptureRequestId &&
                this.pageCapturePendingContextKey === payload.contextKey
            ) {
                this.pageCapturePendingContextKey = null;
            }
        }
    }

    private async requestPassiveWebpageAnalysis(
        payload: { contextKey: string; request: Record<string, unknown> },
    ): Promise<PassiveWebpageAnalysisResult | null> {
        const sourceTitle = String(payload.request.sourceTitle || '');
        const sourceUrl = String(payload.request.sourceUrl || '');
        const text = String(payload.request.text || '');
        const metadata = (payload.request.metadata || {}) as Record<string, unknown>;
        const pageContent: SimplePageContent = {
            title: sourceTitle,
            url: sourceUrl,
            domain: String(metadata.host || window.location.hostname),
            mainContent: text,
            wordCount: Number(metadata.wordCount || this.countWords(text)),
            timestamp: Date.now(),
        };
        const analysisKey = buildPassiveWebpageAnalysisKey(pageContent);
        const cached = this.pageAnalysisResultByKey.get(analysisKey);
        if (cached) return cached;

        this.lastAnalysisTime = Date.now();
        this.analysisCount++;
        try {
            const response = await Promise.race([
                chrome.runtime.sendMessage({
                    type: 'WEB_INTELLIGENCE_ANALYSIS',
                    pageContent,
                    analysisKey,
                    force: false,
                    triggerSource: 'memory_capture_candidate',
                }),
                new Promise<never>((_resolve, reject) => {
                    window.setTimeout(
                        () => reject(new Error('passive_webpage_analysis_timeout')),
                        30_000,
                    );
                }),
            ]);
            if (!response?.success || !response.result) {
                if (response?.requestReuse === 'failure_cooldown') {
                    console.debug('⏸️ 网页分析处于失败退避期，沿用确定性候选评分:', {
                        retryAfterMs: response.retryAfterMs,
                        errorKind: response.errorKind,
                    });
                    return null;
                }
                throw new Error(response?.error || 'passive_webpage_analysis_failed');
            }
            this.pageAnalysisResultByKey.delete(analysisKey);
            this.pageAnalysisResultByKey.set(analysisKey, response.result);
            while (this.pageAnalysisResultByKey.size > 30) {
                const oldestKey = this.pageAnalysisResultByKey.keys().next().value;
                if (typeof oldestKey !== 'string') break;
                this.pageAnalysisResultByKey.delete(oldestKey);
            }
            console.log('✅ 网页候选已完成单次分析（写入仍由 Memory Capture 决定）:', {
                decision: response.result.decision,
                requestReuse: response.requestReuse,
                stored: response.stored,
            });
            return response.result;
        } catch (error) {
            console.warn('⚠️ 单次网页分析不可用，沿用确定性候选评分:', error);
            return null;
        }
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

        const contextKey = `page-capture:${buildPassiveWebpageAnalysisKey({
            title: pageContent.title,
            url: sourceUrl,
            mainContent: pageContent.mainContent,
            domain: pageContent.domain,
            wordCount: pageContent.wordCount,
        })}`;

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
            nextThreshold - dwellMs + 500,
        );
        this.schedulePageMemoryCaptureEvaluation(delayMs);
    }

    private schedulePageMemoryCaptureScoreRecheck(request: Record<string, unknown>): void {
        if (request.sourceKind === 'visual_memory') {
            return;
        }
        const interactions = (request.interactions || {}) as Record<string, unknown>;
        const dwellMs = Number(interactions.dwellMs || 0);
        if (dwellMs >= PAGE_MEMORY_CAPTURE_AUTO_COPY_DWELL_MS) {
            return;
        }
        this.schedulePageMemoryCaptureEvaluation(
            Math.max(
                5_000,
                PAGE_MEMORY_CAPTURE_AUTO_COPY_DWELL_MS - dwellMs + 500,
            ),
        );
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
        chip.className = isVisualCapture
            ? 'pai-memory-capture-page-chip pai-memory-capture-page-chip--visual'
            : 'pai-memory-capture-page-chip';
        if (!isVisualCapture) {
            chip.classList.add('pai-memory-capture-page-chip--pending-review');
        }
        chip.dataset.contextKey = payload.contextKey;
        chip.dataset.captureKind = isVisualCapture ? 'visual' : 'webpage';
        const preReviewReceipt = formatMemoryCapturePreReviewReceipt(payload.request, candidate);
        chip.setAttribute(
            'aria-label',
            isVisualCapture
                ? '记住当前页面视觉证据'
                : '建议记住当前页面资料，尚未写入，点击后先复核',
        );
        const chipTitle = isVisualCapture ? '记住当前页面视觉证据' : '记住当前页面资料';
        const candidateReceipt = formatMemoryCaptureCandidateReceipt(candidate, 2);
        chip.title = isVisualCapture
            ? `${chipTitle}${candidateReceipt ? `：${candidateReceipt}` : ''}`
            : `${chipTitle}：${preReviewReceipt}`;

        const plus = document.createElement('span');
        plus.className = 'pai-memory-capture-selection-dock-plus';
        plus.textContent = '+';
        chip.appendChild(plus);

        const label = document.createElement('span');
        label.className = 'pai-memory-capture-selection-dock-label';
        label.textContent = '记住';
        chip.appendChild(label);

        if (!isVisualCapture) {
            const receipt = document.createElement('span');
            receipt.className = 'pai-memory-capture-page-chip-receipt';
            receipt.textContent = '未写入 · 先复核';
            chip.appendChild(receipt);
        }

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
            if (isVisualCapture) {
                this.savePageMemoryCapture(payload);
                return;
            }
            this.showPageMemoryCaptureReview(payload, candidate);
        });

        document.body.appendChild(chip);
        this.pageCaptureChipElement = chip;
        this.pageCaptureShownContextKey = payload.contextKey;
        this.placePageMemoryCaptureDock(chip);
    }

    private clearPageMemoryCaptureChip(): void {
        this.pageCaptureChipElement?.remove();
        this.pageCaptureChipElement = null;
        this.clearPageMemoryCaptureReview();
    }

    private clearPageMemoryCaptureReview(): void {
        this.pageCaptureReviewElement?.remove();
        this.pageCaptureReviewElement = null;
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

    private showPageMemoryCaptureReview(
        payload: { contextKey: string; request: Record<string, unknown> },
        candidate: MemoryCaptureCandidateResult,
    ): void {
        this.ensureContextBubbleStyles();
        if (!document.body) {
            return;
        }

        if (this.pageCaptureReviewElement?.dataset.contextKey === payload.contextKey) {
            const textarea = this.pageCaptureReviewElement.querySelector('textarea');
            textarea?.focus();
            return;
        }

        this.clearPageMemoryCaptureReview();

        const sourceTitle = normalizeText(
            typeof payload.request.sourceTitle === 'string'
                ? payload.request.sourceTitle
                : document.title,
        ) || '当前页面';
        const previewText = normalizeText(
            typeof payload.request.text === 'string'
                ? payload.request.text
                : '',
        ).slice(0, 220);

        const panel = document.createElement('form');
        panel.className = 'pai-memory-capture-note-panel pai-page-memory-capture-review-panel';
        panel.dataset.contextKey = payload.contextKey;
        panel.setAttribute('aria-label', '保存当前页面资料');
        panel.addEventListener('mousedown', (event) => {
            event.stopPropagation();
        });
        panel.addEventListener('submit', (event) => {
            event.preventDefault();
            event.stopPropagation();
            this.submitPageMemoryCapture(payload, noteInput.value.trim(), panel);
        });

        const title = document.createElement('div');
        title.className = 'pai-memory-capture-note-title';
        title.textContent = '保存当前页面资料';
        panel.appendChild(title);

        const source = document.createElement('div');
        source.className = 'pai-visual-memory-preview-source';
        source.textContent = sourceTitle;
        panel.appendChild(source);

        const boundaryReceipt = document.createElement('div');
        boundaryReceipt.className = 'pai-memory-capture-source-boundary';
        boundaryReceipt.textContent = formatMemoryCaptureSourceBoundaryReceipt(payload.request);
        panel.appendChild(boundaryReceipt);

        const snapshotReceipt = document.createElement('div');
        snapshotReceipt.className = 'pai-memory-capture-page-snapshot';
        snapshotReceipt.textContent = formatMemoryCapturePageSnapshotReceipt(payload.request);
        panel.appendChild(snapshotReceipt);

        const triggerReceipt = document.createElement('div');
        triggerReceipt.className = 'pai-memory-capture-page-trigger';
        triggerReceipt.textContent = formatMemoryCapturePageTriggerReceipt(payload.request, candidate);
        panel.appendChild(triggerReceipt);

        const preview = document.createElement('div');
        preview.className = 'pai-memory-capture-note-preview';
        preview.textContent = previewText || sourceTitle;
        panel.appendChild(preview);

        const candidateReceipt = formatMemoryCaptureCandidateReceipt(candidate, 3);
        if (candidateReceipt) {
            const reasons = document.createElement('div');
            reasons.className = 'pai-memory-capture-note-reasons';
            reasons.textContent = candidateReceipt;
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
            this.clearPageMemoryCaptureReview();
            this.pageCaptureChipElement?.focus();
        });
        actions.appendChild(cancel);

        const save = document.createElement('button');
        save.type = 'submit';
        save.className = 'pai-memory-capture-note-button pai-memory-capture-note-save';
        save.textContent = '保存';
        actions.appendChild(save);
        panel.appendChild(actions);

        document.body.appendChild(panel);
        this.pageCaptureReviewElement = panel;
        this.placePageMemoryCaptureReview(panel);
        window.requestAnimationFrame(() => noteInput.focus());
    }

    private placePageMemoryCaptureReview(panel: HTMLElement): void {
        const panelHeight = Math.max(210, panel.offsetHeight || 210);
        const top = Math.max(
            72,
            Math.min(window.innerHeight - panelHeight - 16, 92),
        );
        panel.style.top = `${Math.round(top)}px`;
    }

    private autoSavePageMemoryCapture(
        payload: { contextKey: string; request: Record<string, unknown> },
        reason: string,
    ): void {
        if (this.pageCaptureStoredContextKey === payload.contextKey) {
            return;
        }

        this.showContextToast('页面资料入库提交中', undefined, {
            durationMs: 10_000,
            variant: 'memory-capture-auto',
            detailMessage: formatMemoryCaptureAutoSavePendingReceipt(payload.request, reason),
        });

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
                const message = chrome.runtime.lastError?.message || response?.error || '保存失败';
                this.showContextToast(
                    formatMemoryCaptureSaveFailureReceipt(
                        '页面资料',
                        `自动入库失败：${message}`,
                        payload.request,
                    ),
                    undefined,
                    { durationMs: 6500 },
                );
                return;
            }

            this.pageCaptureStoredContextKey = payload.contextKey;
            this.clearPageMemoryCaptureChip();
            const capsule = response.result?.capsule;
            const capsuleId = capsule?.id;
            const duplicate = Boolean(capsule?.duplicate);
            if (duplicate) {
                this.showContextToast(
                    '当前页面已在记忆中',
                    buildSourceMemoryDetailToastAction(capsuleId),
                    {
                        durationMs: 6500,
                        detailMessage: formatMemoryCaptureDuplicateWriteReceipt(capsule, false),
                    },
                );
                return;
            }

            this.showContextToast(
                '已存入记忆',
                buildSourceMemoryDetailToastAction(capsuleId),
                {
                    durationMs: 5000,
                    variant: 'memory-capture-auto',
                    detailMessage: `${formatMemoryCapturePageTriggerReceipt(
                        payload.request,
                        null,
                        reason,
                    )} ${formatMemoryCapturePageSnapshotReceipt(payload.request)} ${formatMemoryCaptureWriteReceipt(
                        capsule,
                        formatMemoryCaptureSourceBoundaryReceipt(payload.request),
                    )}`,
                    actions: capsuleId
                        ? [
                            {
                                label: '撤销',
                                ariaLabel: '撤销本次自动入库',
                                onClick: () => this.dismissAutoPageMemoryCapture(capsuleId, payload.contextKey),
                            },
                        ]
                        : undefined,
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
            this.showContextToast('已撤销本网页自动入库', undefined, {
                durationMs: 6500,
                detailMessage: formatMemoryCaptureWriteReceipt(response.result?.capsule),
            });
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
                captureReason: '用户点击网页 + 记住保存视觉证据',
                note: '',
            },
        }, (response) => {
            if (chrome.runtime.lastError || !response?.success) {
                const message = chrome.runtime.lastError?.message || response?.error || '保存失败';
                const failureReceipt = formatMemoryCaptureSaveFailureReceipt(
                    '视觉证据',
                    message,
                    payload.request,
                );
                if (chip) {
                    chip.disabled = false;
                    chip.removeAttribute('aria-busy');
                    chip.title = '记住当前页面视觉证据';
                }
                this.showContextToast(failureReceipt);
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
                {
                    durationMs: 6500,
                    detailMessage: duplicate
                        ? formatMemoryCaptureDuplicateWriteReceipt(capsule, false)
                        : formatMemoryCaptureWriteReceipt(
                            capsule,
                            '已写入资料记忆和视觉证据检索信号；不会自动外发、插入或同步。',
                        ),
                },
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

        this.showContextToast('请先在页面复核面板确认保存');
    }

    private submitPageMemoryCapture(
        payload: { contextKey: string; request: Record<string, unknown> },
        note: string,
        panel: HTMLElement,
    ): void {
        const error = panel.querySelector<HTMLElement>('.pai-memory-capture-note-error');
        const saveButton = panel.querySelector<HTMLButtonElement>('.pai-memory-capture-note-save');
        const currentPayload = this.buildPageMemoryCaptureRequest();
        if (
            !currentPayload ||
            currentPayload.contextKey !== payload.contextKey ||
            this.isSensitiveContextPage() ||
            this.isContextDismissed(payload.contextKey)
        ) {
            const failureReceipt = formatMemoryCaptureSaveFailureReceipt(
                '页面资料',
                '页面上下文已变化，请重新选择要保存的资料',
                payload.request,
            );
            if (error) {
                error.textContent = failureReceipt;
                error.hidden = false;
            } else {
                this.showContextToast(failureReceipt);
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
            type: 'MEMORY_CAPTURE_SAVE_PAGE',
            request: {
                ...payload.request,
                captureMode: 'manual',
                captureReason: '用户点击右侧半露出 + 记住当前页面',
                note,
            },
        }, (response) => {
            if (chrome.runtime.lastError || !response?.success) {
                const message = chrome.runtime.lastError?.message || response?.error || '保存失败';
                const failureReceipt = formatMemoryCaptureSaveFailureReceipt(
                    '页面资料',
                    message,
                    payload.request,
                );
                if (saveButton) {
                    saveButton.disabled = false;
                    saveButton.textContent = '保存';
                }
                if (error) {
                    error.textContent = failureReceipt;
                    error.hidden = false;
                } else {
                    this.showContextToast(failureReceipt);
                }
                return;
            }

            this.clearPageMemoryCaptureReview();
            this.clearPageMemoryCaptureChip();
            this.pageCaptureStoredContextKey = payload.contextKey;
            const capsule = response.result?.capsule;
            const duplicate = Boolean(capsule?.duplicate);
            const updatedDuplicateNote = duplicate && note.length > 0;
            this.showContextToast(
                updatedDuplicateNote
                    ? '当前页面已在记忆中，备注已更新'
                    : duplicate
                        ? '当前页面已在记忆中'
                        : '已保存当前页面资料',
                buildSourceMemoryDetailToastAction(capsule?.id),
                {
                    durationMs: 6500,
                    detailMessage: duplicate
                        ? formatMemoryCaptureDuplicateWriteReceipt(capsule, updatedDuplicateNote)
                        : `${formatMemoryCapturePageSnapshotReceipt(payload.request)} ${formatMemoryCaptureWriteReceipt(capsule)}`,
                },
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

        const hadLoadedSiteControls = this.areSiteControlsLoaded();
        const wasPassiveSuppressed = hadLoadedSiteControls
            ? this.isPassiveContextSuppressedBySiteControls()
            : undefined;

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

        this.handleSiteControlsChanged(wasPassiveSuppressed);
    }

    private handleSiteControlsChanged(wasPassiveSuppressed?: boolean): void {
        this.invalidatePendingContextRequest();
        this.invalidatePageMemoryCaptureRequest();
        this.resetContextStability();

        const isPassiveSuppressed = this.isPassiveContextSuppressedBySiteControls();
        if (isPassiveSuppressed) {
            this.clearPassiveContextBubble();
            this.clearPageMemoryCaptureChip();
            this.clearVisualMemoryPreview();
            if (wasPassiveSuppressed === false) {
                this.showSiteControlSyncSuppressedReceipt();
            }
            return;
        }

        if (wasPassiveSuppressed === true) {
            this.showSiteControlSyncRestoredReceipt();
        }
        this.scheduleContextMatch(0);
        this.schedulePageMemoryCaptureEvaluation(PAGE_MEMORY_CAPTURE_INTERACTION_DELAY_MS);
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

    private countCurrentHostControlConflicts(map: Map<string, number>): number {
        const host = this.getCurrentSiteMuteHost();
        if (!host) return 0;

        return removeContextSiteRecordConflicts(
            host,
            this.siteMapToRecord(map),
        ).removedHosts.length;
    }

    private buildCurrentSiteControlStatusText(): string {
        const host = this.getCurrentSiteMuteHost() || '当前网站';
        if (this.isCurrentPageBlocked()) {
            return `页面路径已屏蔽：${host}`;
        }
        if (this.isCurrentSiteBlocked()) {
            return `站点已永久屏蔽：${host}`;
        }
        if (this.isCurrentSiteMuted()) {
            return `站点临时静默中：${host}`;
        }
        if (this.siteAllowlistMode) {
            return this.isCurrentSiteAllowed()
                ? `白名单已包含此站点：${host}`
                : `白名单未包含此站点：${host}`;
        }

        return '当前未被静默/屏蔽；被动提示可继续评估';
    }

    private buildSiteAllowActionDiagnostic(): string {
        if (this.siteAllowlistMode && this.isCurrentSiteAllowed()) {
            return '此站点已经允许；不会重复改写规则';
        }

        const conflictCount =
            this.countCurrentHostControlConflicts(this.blockedSiteHosts) +
            this.countCurrentHostControlConflicts(this.mutedSiteHosts);
        const action = this.siteAllowlistMode
            ? '会允许此站点进入白名单'
            : '会开启白名单并允许此站点';
        return conflictCount > 0
            ? `${action}；将移除 ${conflictCount} 条覆盖此站点的静默/屏蔽规则`
            : `${action}；只影响被动网页处理`;
    }

    private buildSiteMuteActionDiagnostic(): string {
        return '会保存 24 小时临时静默；只暂停被动 Lens、页面召回和被动入库候选';
    }

    private buildPageBlockActionDiagnostic(): string {
        const prefix = normalizeContextPageBlockPrefix(window.location.href);
        return prefix
            ? `会保存当前路径屏蔽：${clipContextFeedbackDetailValue(prefix, 72)}`
            : '当前 URL 不能保存为页面路径屏蔽';
    }

    private buildSiteBlockActionDiagnostic(): string {
        const conflictCount =
            this.countCurrentHostControlConflicts(this.blockedSiteHosts) +
            this.countCurrentHostControlConflicts(this.mutedSiteHosts) +
            this.countCurrentHostControlConflicts(this.allowedSiteHosts);
        return conflictCount > 0
            ? `会保存当前站点屏蔽设置，并移除 ${conflictCount} 条允许/静默/旧屏蔽覆盖规则`
            : '会保存当前站点屏蔽设置；只停止被动网页处理';
    }

    private suppressSiteControlSyncReceipt(): void {
        this.siteControlSyncToastSuppressedUntil = Date.now() + 1800;
    }

    private shouldSuppressSiteControlSyncReceipt(): boolean {
        return Date.now() < this.siteControlSyncToastSuppressedUntil;
    }

    private getCurrentSiteControlSuppressionReason(): string {
        const host = this.getCurrentSiteMuteHost() || '当前网站';
        if (this.isCurrentPageBlocked()) {
            return `页面路径已屏蔽：${host}`;
        }
        if (this.isCurrentSiteBlocked()) {
            return `站点已永久屏蔽：${host}`;
        }
        if (this.isCurrentSiteMuted()) {
            return `站点临时静默：${host}`;
        }
        if (this.isCurrentSiteOutsideAllowlist()) {
            return `白名单未包含此站点：${host}`;
        }
        return `当前站点控制已生效：${host}`;
    }

    private showSiteControlSyncSuppressedReceipt(): void {
        if (this.shouldSuppressSiteControlSyncReceipt()) {
            return;
        }
        this.showContextToast('站点控制已生效：已停止此页被动记忆提示', undefined, {
            detailMessage: `${this.getCurrentSiteControlSuppressionReason()}；已清除右下角 Lens、页面召回和被动入库候选。主动划词仍可用；不会删除、同步或外发已有记忆。`,
            durationMs: 7200,
        });
    }

    private showSiteControlSyncRestoredReceipt(): void {
        if (this.shouldSuppressSiteControlSyncReceipt()) {
            return;
        }
        this.showContextToast('站点控制已恢复：重新评估此页记忆提示', undefined, {
            detailMessage: '当前页不再被站点控制阻断；会重新评估右下角 Lens、页面召回和被动入库候选。主动划词仍受敏感页保护；不会写入、删除或外发记忆。',
            durationMs: 6400,
        });
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
        this.suppressSiteControlSyncReceipt();
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
                this.suppressSiteControlSyncReceipt();
                this.saveSiteMutes();
                this.showContextToast('已恢复此网站记忆提示', undefined, {
                    detailMessage: '仅恢复被动网页提示与候选评估；不会写入、删除或外发记忆。',
                    durationMs: 5200,
                });
                this.scheduleContextMatch(0);
            },
        }, {
            detailMessage: '只暂停右下角 Lens、页面召回和被动入库候选；主动划词仍可用。',
            durationMs: 6400,
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
        this.suppressSiteControlSyncReceipt();
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
                this.suppressSiteControlSyncReceipt();
                this.saveSiteBlocks();
                this.saveSiteMutes();
                this.saveSiteAllowlist();
                this.showContextToast('已恢复此网站记忆提示', undefined, {
                    detailMessage: '仅恢复被动网页提示与候选评估；不会写入、删除或外发记忆。',
                    durationMs: 5200,
                });
                this.scheduleContextMatch(0);
            },
        }, {
            detailMessage: '只关闭被动网页处理，不删除已有记忆；主动划词仍受敏感页保护。',
            durationMs: 6400,
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
        this.suppressSiteControlSyncReceipt();
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
                this.suppressSiteControlSyncReceipt();
                this.savePageBlocks();
                this.showContextToast('已恢复此页面路径记忆提示', undefined, {
                    detailMessage: '仅恢复这个路径的被动提示与候选评估；主动划词仍受敏感页保护，不会写入、删除或外发记忆。',
                    durationMs: 5200,
                });
                this.scheduleContextMatch(0);
            },
        }, {
            detailMessage: '只关闭此路径下的被动 Lens、页面召回和整页/视觉入库候选；不影响同域名其他路径，主动划词仍可用，且不会删除、同步或外发已有记忆。',
            durationMs: 6400,
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
        this.suppressSiteControlSyncReceipt();
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
                    this.suppressSiteControlSyncReceipt();
                    this.saveSiteAllowlist();
                    this.saveSiteBlocks();
                    this.saveSiteMutes();
                    this.showContextToast('已恢复白名单设置', undefined, {
                        detailMessage: '仅恢复被动网页提示规则；不会写入、删除或外发记忆。',
                        durationMs: 5200,
                    });
                    this.scheduleContextMatch(0);
                },
            },
            {
                detailMessage: '白名单只控制被动网页处理；主动划词仍可用，已有记忆不被外发。',
                durationMs: 6400,
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
        const successMessage = isContextRehearsalMatch(match)
            ? '已记录为预演提醒有用，后续会优先保留类似提示'
            : '已记录为有用，后续会优先保留类似提示';
        this.showContextToast(
            isContextRehearsalMatch(match)
                ? '正在记录预演提醒有用反馈...'
                : '正在记录有用反馈...',
        );
        this.submitContextRecallFeedback(match, 'positive', contextKey, detailOptions, (success, error) => {
            if (success) {
                this.showContextToast(successMessage);
            } else {
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
                cursor: grab;
                z-index: 2147483646;
                box-shadow:
                    0 10px 28px rgba(48, 24, 13, 0.18),
                    0 0 0 4px rgba(248, 113, 113, 0.08);
                transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
                user-select: none;
                touch-action: none;
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

            .pai-context-bubble--dragging,
            .pai-context-bubble--dragging:hover {
                cursor: grabbing;
                transform: none;
                transition: none;
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
                left: var(--pai-context-arrow-left, auto);
                right: var(--pai-context-arrow-right, 16px);
                top: var(--pai-context-arrow-top, auto);
                bottom: var(--pai-context-arrow-bottom, -7px);
                width: 14px;
                height: 14px;
                background: rgba(255, 252, 246, 0.98);
                border-right: 1px solid rgba(222, 204, 178, 0.92);
                border-bottom: 1px solid rgba(222, 204, 178, 0.92);
                transform: rotate(45deg);
            }

            .pai-context-peek[data-pai-placement='below']::after {
                border-right: 0;
                border-bottom: 0;
                border-left: 1px solid rgba(222, 204, 178, 0.92);
                border-top: 1px solid rgba(222, 204, 178, 0.92);
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

            .pai-context-peek-slice {
                margin-top: 5px;
                font-size: 10.5px;
                font-weight: 650;
                color: #526070;
                overflow-wrap: anywhere;
            }

            .pai-context-peek-basis {
                margin-top: 5px;
                font-size: 10.5px;
                font-weight: 650;
                color: #5f5a50;
                overflow-wrap: anywhere;
            }

            .pai-context-peek-boundary {
                margin-top: 4px;
                font-size: 10.5px;
                font-weight: 650;
                color: #6a5544;
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
                left: var(--pai-context-arrow-left, auto);
                right: var(--pai-context-arrow-right, 17px);
                top: var(--pai-context-arrow-top, auto);
                bottom: var(--pai-context-arrow-bottom, -8px);
                width: 16px;
                height: 16px;
                background: rgba(255, 252, 246, 0.99);
                border-right: 1px solid rgba(222, 204, 178, 0.95);
                border-bottom: 1px solid rgba(222, 204, 178, 0.95);
                transform: rotate(45deg);
            }

            .pai-context-card[data-pai-placement='below']::after {
                border-right: 0;
                border-bottom: 0;
                border-left: 1px solid rgba(222, 204, 178, 0.95);
                border-top: 1px solid rgba(222, 204, 178, 0.95);
            }

            .pai-context-card-scroll {
                flex: 1 1 auto;
                min-height: 0;
                overflow-y: auto;
                padding-right: 2px;
            }

            .pai-context-selection-trigger {
                position: fixed;
                min-width: 34px;
                height: 34px;
                border-radius: 999px;
                border: 1px solid rgba(203, 213, 225, 0.9);
                background: rgba(255, 255, 255, 0.98);
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 3px;
                padding: 3px;
                z-index: 2147483646;
                box-shadow: 0 8px 20px rgba(15, 23, 42, 0.22);
                backdrop-filter: blur(10px);
                overflow: visible;
                box-sizing: border-box;
                transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
            }

            .pai-context-selection-tooltip {
                position: absolute;
                left: 50%;
                bottom: calc(100% + 8px);
                width: max-content;
                max-width: min(232px, calc(100vw - 24px));
                transform: translate(-50%, 4px);
                border-radius: 8px;
                border: 1px solid rgba(15, 23, 42, 0.18);
                background: #0f172a;
                color: #ffffff;
                padding: 6px 8px;
                box-shadow: 0 12px 28px rgba(15, 23, 42, 0.28);
                font: 700 11px/1.35 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
                letter-spacing: 0;
                text-align: left;
                white-space: normal;
                overflow-wrap: anywhere;
                opacity: 0;
                visibility: hidden;
                pointer-events: none;
                transition: opacity 0.14s ease, transform 0.14s ease, visibility 0.14s ease;
            }

            .pai-context-selection-tooltip::after {
                content: "";
                position: absolute;
                left: 50%;
                bottom: -5px;
                width: 10px;
                height: 10px;
                transform: translateX(-50%) rotate(45deg);
                background: #0f172a;
                border-right: 1px solid rgba(15, 23, 42, 0.18);
                border-bottom: 1px solid rgba(15, 23, 42, 0.18);
            }

            .pai-context-selection-trigger[data-tooltip-side='left'] .pai-context-selection-tooltip {
                left: 0;
                transform: translate(0, 4px);
            }

            .pai-context-selection-trigger[data-tooltip-side='left'] .pai-context-selection-tooltip::after {
                left: 17px;
            }

            .pai-context-selection-trigger[data-tooltip-side='right'] .pai-context-selection-tooltip {
                left: auto;
                right: 0;
                transform: translate(0, 4px);
            }

            .pai-context-selection-trigger[data-tooltip-side='right'] .pai-context-selection-tooltip::after {
                left: auto;
                right: 12px;
            }

            .pai-context-selection-trigger[data-tooltip-placement='bottom'] .pai-context-selection-tooltip {
                top: calc(100% + 8px);
                bottom: auto;
                transform: translate(-50%, -4px);
            }

            .pai-context-selection-trigger[data-tooltip-placement='bottom'] .pai-context-selection-tooltip::after {
                top: -5px;
                bottom: auto;
                border-top: 1px solid rgba(15, 23, 42, 0.18);
                border-left: 1px solid rgba(15, 23, 42, 0.18);
                border-right: 0;
                border-bottom: 0;
            }

            .pai-context-selection-trigger[data-tooltip-placement='bottom'][data-tooltip-side='left'] .pai-context-selection-tooltip,
            .pai-context-selection-trigger[data-tooltip-placement='bottom'][data-tooltip-side='right'] .pai-context-selection-tooltip {
                transform: translate(0, -4px);
            }

            .pai-context-selection-trigger:hover .pai-context-selection-tooltip,
            .pai-context-selection-trigger:focus-within .pai-context-selection-tooltip {
                opacity: 1;
                visibility: visible;
                transform: translate(-50%, 0);
            }

            .pai-context-selection-trigger[data-tooltip-side='left']:hover .pai-context-selection-tooltip,
            .pai-context-selection-trigger[data-tooltip-side='left']:focus-within .pai-context-selection-tooltip,
            .pai-context-selection-trigger[data-tooltip-side='right']:hover .pai-context-selection-tooltip,
            .pai-context-selection-trigger[data-tooltip-side='right']:focus-within .pai-context-selection-tooltip {
                transform: translate(0, 0);
            }

            .pai-context-selection-action {
                width: 28px;
                height: 28px;
                border-radius: 999px;
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

            .pai-context-selection-action img {
                width: 20px;
                height: 20px;
                object-fit: contain;
                pointer-events: none;
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

            .pai-memory-capture-page-chip--pending-review:hover,
            .pai-memory-capture-page-chip--pending-review:focus-visible {
                width: 184px;
            }

            .pai-memory-capture-selection-dock--pending-review:hover,
            .pai-memory-capture-selection-dock--pending-review:focus-visible {
                width: 184px;
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

            .pai-memory-capture-page-chip-receipt {
                flex: 0 0 auto;
                width: 0;
                opacity: 0;
                white-space: nowrap;
                overflow: hidden;
                color: #1d4ed8;
                font: 700 11px/1 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
                transition: width 0.18s ease, opacity 0.12s ease;
            }

            .pai-memory-capture-page-chip--pending-review:hover .pai-memory-capture-page-chip-receipt,
            .pai-memory-capture-page-chip--pending-review:focus-visible .pai-memory-capture-page-chip-receipt {
                width: 7.2em;
                opacity: 1;
            }

            .pai-memory-capture-selection-dock-receipt {
                flex: 0 0 auto;
                width: 0;
                opacity: 0;
                white-space: nowrap;
                overflow: hidden;
                color: #1d4ed8;
                font: 700 11px/1 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
                transition: width 0.18s ease, opacity 0.12s ease;
            }

            .pai-memory-capture-selection-dock--pending-review:hover .pai-memory-capture-selection-dock-receipt,
            .pai-memory-capture-selection-dock--pending-review:focus-visible .pai-memory-capture-selection-dock-receipt {
                width: 7.2em;
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
                max-height: min(560px, calc(100vh - 32px));
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
                overflow-y: auto;
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

            .pai-memory-capture-source-boundary {
                padding: 7px 8px;
                border-radius: 9px;
                border: 1px solid rgba(37, 99, 235, 0.16);
                background: #eff6ff;
                color: #1e3a8a;
                font-size: 12px;
                line-height: 1.4;
            }

            .pai-memory-capture-selection-snapshot {
                padding: 7px 8px;
                border-radius: 8px;
                border: 1px solid rgba(99, 102, 241, 0.16);
                background: #eef2ff;
                color: #3730a3;
                font-size: 12px;
                line-height: 1.4;
            }

            .pai-memory-capture-page-snapshot {
                padding: 7px 8px;
                border-radius: 8px;
                border: 1px solid rgba(59, 130, 246, 0.16);
                background: #eef6ff;
                color: #1e3a8a;
                font-size: 12px;
                line-height: 1.4;
            }

            .pai-memory-capture-page-trigger {
                padding: 7px 8px;
                border-radius: 8px;
                border: 1px solid rgba(20, 184, 166, 0.18);
                background: #ecfdf5;
                color: #065f46;
                font-size: 12px;
                line-height: 1.4;
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

            .pai-keystone-notice {
                margin-bottom: 10px;
                border-left: 3px solid #b7791f;
                border-radius: 6px;
                background: #fff8e8;
                color: #744210;
                padding: 8px 10px;
                font-size: 11.5px;
                line-height: 1.45;
                overflow-wrap: anywhere;
            }

            .pai-keystone-notice--conflict {
                border-left-color: #c2410c;
                background: #fff3ed;
                color: #7c2d12;
            }

            .pai-keystone-kicker {
                color: #2d7064;
                font-size: 11px;
                font-weight: 760;
            }

            .pai-keystone-meta {
                margin-top: 8px;
                display: flex;
                flex-wrap: wrap;
                gap: 5px 10px;
                color: #6b6258;
                font-size: 11px;
                line-height: 1.4;
            }

            .pai-keystone-why {
                margin-top: 8px;
                color: #255f55;
                font-size: 12px;
                line-height: 1.45;
            }

            .pai-keystone-slot {
                margin-top: 11px;
                border-top: 1px solid rgba(177, 153, 125, 0.22);
                padding-top: 9px;
            }

            .pai-keystone-slot-title {
                margin-bottom: 5px;
                color: #6a5544;
                font-size: 11px;
                font-weight: 760;
            }

            .pai-keystone-list {
                margin: 0;
                padding-left: 18px;
                color: #344357;
                font-size: 12px;
                line-height: 1.5;
            }

            .pai-keystone-list li + li {
                margin-top: 4px;
            }

            .pai-keystone-evidence-toggle,
            .pai-keystone-back,
            .pai-keystone-action {
                border: 1px solid rgba(45, 112, 100, 0.26);
                border-radius: 6px;
                background: #f6fbf8;
                color: #255f55;
                cursor: pointer;
                font: inherit;
                font-size: 11.5px;
                font-weight: 700;
                line-height: 1.2;
                padding: 7px 9px;
            }

            .pai-keystone-evidence-toggle:hover,
            .pai-keystone-evidence-toggle:focus-visible,
            .pai-keystone-back:hover,
            .pai-keystone-back:focus-visible,
            .pai-keystone-action:hover,
            .pai-keystone-action:focus-visible {
                background: #eaf5ef;
                outline: none;
            }

            .pai-keystone-evidence {
                margin-top: 11px;
            }

            .pai-keystone-evidence-list {
                margin-top: 7px;
                display: grid;
                gap: 6px;
            }

            .pai-keystone-evidence-item {
                width: 100%;
                border: 0;
                border-top: 1px solid rgba(177, 153, 125, 0.2);
                background: transparent;
                color: #344357;
                cursor: pointer;
                display: grid;
                gap: 2px;
                padding: 7px 2px 3px;
                text-align: left;
            }

            .pai-keystone-evidence-item-title {
                color: #172033;
                font-size: 12px;
                font-weight: 720;
                overflow-wrap: anywhere;
            }

            .pai-keystone-evidence-item-summary {
                color: #657287;
                display: -webkit-box;
                font-size: 11px;
                line-height: 1.4;
                -webkit-box-orient: vertical;
                -webkit-line-clamp: 2;
                overflow: hidden;
                overflow-wrap: anywhere;
            }

            .pai-keystone-actions {
                display: flex;
                flex-wrap: wrap;
                gap: 6px;
            }

            .pai-keystone-action--quiet {
                border-color: rgba(100, 116, 139, 0.24);
                background: #fff;
                color: #526070;
            }

            .pai-keystone-action[disabled] {
                cursor: not-allowed;
                opacity: 0.52;
            }

            .pai-keystone-feedback-receipt {
                margin-top: 7px;
                color: #526070;
                font-size: 11px;
                line-height: 1.4;
            }

            .pai-keystone-back-wrap {
                margin-bottom: 10px;
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

            .pai-context-selection-receipt {
                margin-top: 6px;
                border: 1px solid rgba(37, 99, 235, 0.16);
                background: rgba(239, 246, 255, 0.74);
                border-radius: 8px;
                padding: 7px 9px;
                color: #334155;
                font-size: 11px;
                line-height: 1.42;
                display: flex;
                flex-direction: column;
                gap: 3px;
            }

            .pai-context-selection-receipt-row {
                display: flex;
                align-items: flex-start;
                gap: 6px;
                min-width: 0;
            }

            .pai-context-selection-receipt-label {
                flex: 0 0 auto;
                color: #1d4ed8;
                font-weight: 760;
            }

            .pai-context-selection-receipt-value {
                min-width: 0;
                overflow-wrap: anywhere;
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

            .pai-context-rehearsal-receipt {
                margin-top: 8px;
                border: 1px solid rgba(91, 86, 165, 0.18);
                border-left: 2px solid rgba(91, 86, 165, 0.56);
                border-radius: 8px;
                background: rgba(239, 246, 255, 0.72);
                color: #334155;
                padding: 7px 9px;
                display: flex;
                flex-direction: column;
                gap: 4px;
                font-size: 11.5px;
                line-height: 1.4;
            }

            .pai-context-rehearsal-receipt-title {
                color: #312e81;
                font-size: 11px;
                font-weight: 780;
            }

            .pai-context-rehearsal-receipt-row {
                display: flex;
                align-items: flex-start;
                gap: 7px;
                min-width: 0;
            }

            .pai-context-rehearsal-receipt-label {
                flex: 0 0 auto;
                color: #4338ca;
                font-weight: 760;
            }

            .pai-context-rehearsal-receipt-value {
                min-width: 0;
                overflow-wrap: anywhere;
            }

            .pai-context-source-memory-receipt {
                margin-top: 8px;
                border: 1px solid rgba(14, 116, 144, 0.18);
                border-left: 2px solid rgba(14, 116, 144, 0.56);
                border-radius: 8px;
                background: rgba(236, 254, 255, 0.72);
                color: #164e63;
                padding: 7px 9px;
                display: flex;
                flex-direction: column;
                gap: 4px;
                font-size: 11.5px;
                line-height: 1.4;
            }

            .pai-context-source-memory-receipt-title {
                color: #155e75;
                font-size: 11px;
                font-weight: 780;
            }

            .pai-context-source-memory-receipt-row {
                display: flex;
                align-items: flex-start;
                gap: 7px;
                min-width: 0;
            }

            .pai-context-source-memory-receipt-label {
                flex: 0 0 auto;
                color: #0e7490;
                font-weight: 760;
            }

            .pai-context-source-memory-receipt-value {
                min-width: 0;
                overflow-wrap: anywhere;
            }

            .pai-context-change-ledger {
                margin-top: 10px;
                border: 1px solid rgba(13, 148, 136, 0.24);
                border-radius: 8px;
                background: rgba(240, 253, 250, 0.84);
                color: #134e4a;
                overflow: hidden;
            }

            .pai-context-change-head {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 8px;
                padding: 7px 9px;
                border-bottom: 1px solid rgba(13, 148, 136, 0.16);
                color: #115e59;
                font-size: 11px;
                font-weight: 780;
            }

            .pai-context-change-head span:last-child {
                min-width: 0;
                color: #475569;
                font-weight: 650;
                overflow-wrap: anywhere;
                text-align: right;
            }

            .pai-context-change-row {
                padding: 9px;
                border-bottom: 1px solid rgba(13, 148, 136, 0.13);
            }

            .pai-context-change-row:last-child {
                border-bottom: 0;
            }

            .pai-context-change-current,
            .pai-context-change-event-main {
                display: flex;
                align-items: flex-start;
                justify-content: space-between;
                gap: 8px;
            }

            .pai-context-change-property {
                display: block;
                color: #134e4a;
                font-size: 12px;
                line-height: 1.35;
                overflow-wrap: anywhere;
            }

            .pai-context-change-transition {
                display: flex;
                flex-wrap: wrap;
                gap: 5px;
                margin-top: 3px;
                color: #64748b;
                font-size: 12px;
                line-height: 1.35;
            }

            .pai-context-change-transition b {
                color: #0f172a;
            }

            .pai-context-change-status,
            .pai-context-change-reversal,
            .pai-context-change-readonly {
                flex: 0 0 auto;
                border: 1px solid rgba(13, 148, 136, 0.3);
                border-radius: 999px;
                background: rgba(204, 251, 241, 0.9);
                color: #115e59;
                padding: 2px 6px;
                font-size: 10px;
                font-weight: 780;
                line-height: 1.35;
                white-space: nowrap;
            }

            .pai-context-change-status--conflicted {
                border-color: rgba(220, 38, 38, 0.28);
                background: rgba(254, 226, 226, 0.9);
                color: #991b1b;
            }

            .pai-context-change-status--historical_only,
            .pai-context-change-status--superseded_on_page,
            .pai-context-change-status--superseded_at_source {
                border-color: rgba(234, 88, 12, 0.28);
                background: rgba(255, 237, 213, 0.92);
                color: #9a3412;
            }

            .pai-context-change-boundary {
                margin-top: 6px;
                color: #475569;
                font-size: 11px;
                line-height: 1.45;
                overflow-wrap: anywhere;
            }

            .pai-context-change-history {
                margin-top: 7px;
                color: #334155;
                font-size: 11px;
            }

            .pai-context-change-history summary {
                color: #0f766e;
                cursor: pointer;
                font-weight: 760;
                line-height: 1.4;
            }

            .pai-context-change-history ol {
                margin: 7px 0 0;
                padding: 0;
                list-style: none;
            }

            .pai-context-change-event {
                border-left: 2px solid rgba(45, 212, 191, 0.62);
                padding: 5px 0 7px 8px;
            }

            .pai-context-change-event-main {
                justify-content: flex-start;
                flex-wrap: wrap;
                color: #334155;
            }

            .pai-context-change-event-main time {
                color: #64748b;
                font-variant-numeric: tabular-nums;
            }

            .pai-context-change-event-meta {
                margin-top: 3px;
                color: #64748b;
                line-height: 1.4;
                overflow-wrap: anywhere;
            }

            .pai-context-change-reversal {
                border-color: rgba(202, 138, 4, 0.32);
                background: rgba(254, 249, 195, 0.92);
                color: #854d0e;
            }

            .pai-context-change-readonly {
                border-color: rgba(100, 116, 139, 0.25);
                background: rgba(248, 250, 252, 0.94);
                color: #475569;
                padding: 4px 8px;
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

            .pai-context-source-receipt {
                border: 1px solid rgba(217, 119, 6, 0.26);
                background: rgba(254, 243, 199, 0.82);
                color: #92400e;
            }

            .pai-context-weave-chip {
                border: 1px solid rgba(36, 89, 166, 0.3);
                background: rgba(219, 234, 254, 0.85);
                color: #1d4ed8;
                font-weight: 600;
            }

            .pai-context-attribution-chip {
                border: 1px solid rgba(124, 58, 237, 0.24);
                background: rgba(245, 243, 255, 0.9);
                color: #6d28d9;
                font-weight: 650;
            }

            .pai-context-source-status {
                border: 1px solid rgba(14, 116, 144, 0.22);
                background: rgba(236, 254, 255, 0.82);
                color: #155e75;
            }

            .pai-context-source-open-receipt {
                margin-top: 8px;
                border: 1px solid rgba(20, 83, 45, 0.18);
                border-radius: 8px;
                background: rgba(240, 253, 244, 0.92);
                color: #14532d;
                padding: 7px 8px;
                font-size: 11px;
                line-height: 1.45;
            }

            .pai-context-source-open-title {
                font-weight: 750;
                margin-bottom: 4px;
            }

            .pai-context-source-open-row {
                display: grid;
                grid-template-columns: 58px minmax(0, 1fr);
                gap: 6px;
            }

            .pai-context-source-open-label {
                color: #166534;
                font-weight: 650;
            }

            .pai-context-source-open-value {
                color: #14532d;
                overflow-wrap: anywhere;
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
                flex-wrap: wrap;
            }

            .pai-context-action-boundary-wrap {
                flex: 1 1 160px;
                min-width: 0;
                position: relative;
            }

            .pai-context-action-boundary {
                box-sizing: border-box;
                width: 100%;
                min-width: 0;
                border: 1px solid rgba(100, 116, 139, 0.22);
                border-radius: 999px;
                background: rgba(248, 250, 252, 0.92);
                color: #334155;
                padding: 4px 9px;
                font-size: 11px;
                font-weight: 680;
                line-height: 1.35;
                overflow-wrap: anywhere;
                text-align: left;
            }

            button.pai-context-action-boundary {
                appearance: none;
                -webkit-appearance: none;
                cursor: pointer;
            }

            button.pai-context-action-boundary:hover,
            button.pai-context-action-boundary:focus-visible,
            .pai-context-action-boundary-wrap--open > .pai-context-action-boundary {
                border-color: rgba(45, 112, 100, 0.26);
                background: rgba(255, 255, 255, 0.98);
                color: #255f55;
                outline: none;
            }

            button.pai-context-action-boundary:focus-visible {
                box-shadow: 0 0 0 2px rgba(45, 112, 100, 0.14);
            }

            .pai-context-action-boundary-detail {
                box-sizing: border-box;
                position: absolute;
                left: 0;
                bottom: calc(100% + 7px);
                z-index: 2;
                width: min(360px, calc(100vw - 72px));
                display: none;
                border: 1px solid rgba(100, 116, 139, 0.18);
                border-radius: 8px;
                background: rgba(255, 255, 255, 0.98);
                box-shadow: 0 14px 34px rgba(15, 23, 42, 0.16);
                color: #334155;
                padding: 8px 9px;
                font-size: 11px;
                line-height: 1.42;
            }

            .pai-context-action-boundary-wrap:hover .pai-context-action-boundary-detail,
            .pai-context-action-boundary-wrap:focus-within .pai-context-action-boundary-detail,
            .pai-context-action-boundary-wrap--open .pai-context-action-boundary-detail {
                display: flex;
                flex-direction: column;
                gap: 4px;
            }

            .pai-context-action-boundary-detail-row {
                display: flex;
                align-items: flex-start;
                gap: 6px;
                min-width: 0;
            }

            .pai-context-action-boundary-detail-label {
                flex: 0 0 auto;
                color: #0f766e;
                font-weight: 760;
            }

            .pai-context-action-boundary-detail-value {
                min-width: 0;
                overflow-wrap: anywhere;
            }

            .pai-context-feedback {
                display: flex;
                align-items: center;
                gap: 7px;
                flex: 0 0 auto;
            }

            .pai-context-feedback-receipt {
                margin-top: 7px;
                border: 1px solid rgba(100, 116, 139, 0.18);
                border-radius: 8px;
                background: rgba(248, 250, 252, 0.96);
                color: #334155;
                padding: 5px 7px;
                font-size: 11px;
                font-weight: 650;
                line-height: 1.38;
                overflow-wrap: anywhere;
            }

            .pai-context-feedback-receipt--pending {
                border-color: rgba(37, 99, 235, 0.24);
                background: rgba(239, 246, 255, 0.96);
                color: #1d4ed8;
            }

            .pai-context-feedback-receipt--confirmed {
                border-color: rgba(22, 163, 74, 0.24);
                background: rgba(240, 253, 244, 0.96);
                color: #15803d;
            }

            .pai-context-feedback-receipt--failed {
                border-color: rgba(217, 119, 6, 0.26);
                background: rgba(255, 251, 235, 0.98);
                color: #92400e;
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

            .pai-context-claim-correction {
                display: grid;
                gap: 8px;
                margin-top: 4px;
                padding-top: 10px;
                border-top: 1px solid rgba(177, 153, 125, 0.28);
            }

            .pai-context-claim-correction-item {
                display: grid;
                gap: 7px;
                padding: 9px 10px;
                border: 1px solid rgba(124, 58, 237, 0.2);
                border-radius: 9px;
                background: rgba(245, 243, 255, 0.72);
            }

            .pai-context-claim-correction-copy {
                display: grid;
                gap: 2px;
                color: #475569;
                font-size: 11px;
                line-height: 1.4;
            }

            .pai-context-claim-correction-copy strong {
                color: #5b21b6;
                font-size: 12px;
            }

            .pai-context-claim-correction-actions {
                display: flex;
                flex-wrap: wrap;
                gap: 5px;
            }

            .pai-context-claim-correction-actions button {
                border: 1px solid rgba(124, 58, 237, 0.25);
                border-radius: 7px;
                background: rgba(255, 255, 255, 0.84);
                color: #5b21b6;
                cursor: pointer;
                font-size: 11px;
                padding: 5px 7px;
            }

            .pai-context-claim-correction-actions button:disabled {
                cursor: wait;
                opacity: 0.55;
            }

            .pai-context-claim-correction-status {
                color: #64748b;
                font-size: 10px;
                line-height: 1.4;
            }

            .pai-context-claim-correction-status[data-state="success"] {
                color: #166534;
            }

            .pai-context-claim-correction-status[data-state="error"] {
                color: #b91c1c;
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
                width: 256px;
                max-width: calc(100vw - 32px);
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

            .pai-context-site-control-receipt {
                margin: 4px 4px 6px;
                border: 1px solid rgba(14, 116, 144, 0.22);
                border-radius: 8px;
                background: rgba(236, 254, 255, 0.86);
                color: #155e75;
                padding: 8px 9px;
                font-size: 11px;
                line-height: 1.42;
                display: grid;
                gap: 4px;
            }

            .pai-context-site-control-title {
                color: #0f4c5c;
                font-weight: 760;
            }

            .pai-context-site-control-row {
                display: flex;
                align-items: flex-start;
                gap: 6px;
                min-width: 0;
            }

            .pai-context-site-control-label {
                flex: 0 0 auto;
                color: #0e7490;
                font-weight: 700;
            }

            .pai-context-site-control-value {
                min-width: 0;
                overflow-wrap: anywhere;
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

            .pai-context-toast--with-detail {
                max-width: min(360px, calc(100vw - 32px));
                align-items: flex-start;
                justify-content: flex-start;
                flex-direction: column;
                gap: 4px;
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

            .pai-context-toast--memory-capture-auto:hover,
            .pai-context-toast--memory-capture-auto:focus-within {
                border-radius: 8px;
                padding: 8px 10px;
                align-items: flex-start;
                flex-wrap: wrap;
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

            .pai-context-toast--with-detail .pai-context-toast-detail {
                display: block;
                color: rgba(255, 255, 255, 0.78);
                font-size: 11px;
                line-height: 1.38;
            }

            .pai-context-toast--memory-capture-auto .pai-context-toast-detail {
                display: block;
                order: 3;
                flex: 1 1 100%;
                max-width: 0;
                max-height: 0;
                opacity: 0;
                overflow: hidden;
                white-space: normal;
                color: rgba(255, 255, 255, 0.82);
                transition: max-width 0.18s ease, max-height 0.18s ease, opacity 0.14s ease, margin-left 0.18s ease;
            }

            .pai-context-toast--memory-capture-auto:hover .pai-context-toast-detail,
            .pai-context-toast--memory-capture-auto:focus-within .pai-context-toast-detail {
                max-width: calc(100% - 22px);
                max-height: 88px;
                opacity: 1;
                margin-left: 22px;
                overflow-y: auto;
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
                order: 2;
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
        const hasDetail = Boolean(options.detailMessage);
        toast.className = isAutoMemoryCapture
            ? 'pai-context-toast pai-context-toast--memory-capture-auto'
            : hasDetail
                ? 'pai-context-toast pai-context-toast--with-detail'
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

        if (options.detailMessage) {
            const detail = document.createElement('span');
            detail.className = 'pai-context-toast-detail';
            detail.textContent = options.detailMessage;
            toast.appendChild(detail);
        }

        const actions = [action, ...(options.actions || [])].filter(
            (item): item is ContextToastAction => Boolean(item),
        );
        for (const actionItem of actions) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'pai-context-toast-button';
            button.textContent = actionItem.label;
            if (actionItem.ariaLabel) {
                button.setAttribute('aria-label', actionItem.ariaLabel);
            }
            button.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                actionItem.onClick();
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
        const keystoneEnglish = options.uiLanguage === 'en-US';
        const keystoneText = {
            brief: keystoneEnglish ? 'Keystone Brief' : '关键简报',
            synthesized: keystoneEnglish ? 'Synthesized' : '已综合',
            conflict: keystoneEnglish ? 'Conflicting evidence' : '有证据冲突',
            shortConflict: keystoneEnglish ? 'Conflict' : '有冲突',
            currentState: keystoneEnglish ? 'Current state' : '当前状态',
            openQuestions: keystoneEnglish ? 'Still to confirm' : '仍待确认',
            sourceMap: keystoneEnglish ? 'Source map' : '来源图',
            relatedMemories: keystoneEnglish ? 'Related memories this time' : '本轮相关记忆',
            collapseEvidence: keystoneEnglish ? 'Hide evidence' : '收起证据',
            viewEvidence: keystoneEnglish ? 'View evidence and related memories' : '查看证据与相关记忆',
            constraints: keystoneEnglish ? 'Constraints and boundaries' : '约束与边界',
            stableFacts: keystoneEnglish ? 'Key facts' : '关键事实',
            decisions: keystoneEnglish ? 'Existing judgments' : '已有判断',
            traps: keystoneEnglish ? 'Pitfalls' : '易错点',
            actions: keystoneEnglish ? 'Actions' : '操作',
            copySummary: keystoneEnglish ? 'Copy redacted summary' : '复制脱敏摘要',
            useful: keystoneEnglish ? 'Useful' : '有用',
            inaccurate: keystoneEnglish ? 'Inaccurate, show original memories' : '不准，改看原始记忆',
            hideBrief: keystoneEnglish ? 'Hide this Keystone Brief' : '隐藏这份关键简报',
            whyNow: keystoneEnglish ? 'Relevant now' : '此刻相关',
            matchedScene: keystoneEnglish ? 'Matches the current context' : '命中当前场景',
            unknownTime: keystoneEnglish ? 'Unknown time' : '未知时间',
            originalOnly: keystoneEnglish ? 'Local-only evidence' : '仅本机证据',
            summaryAllowed: keystoneEnglish ? 'Allowed in external summary' : '可进入外发摘要',
            viewOriginalCard: keystoneEnglish ? 'View original memory card' : '查看原始记忆卡',
            backToBrief: keystoneEnglish ? '‹ Back to Keystone Brief' : '‹ 返回关键简报',
            moreControls: keystoneEnglish ? 'More controls' : '更多控制',
            sourceAsOf: keystoneEnglish ? 'Sources as of' : '来源截至',
            localOnly: keystoneEnglish ? 'local-only' : '只用于本机',
            readOnlyBoundary: keystoneEnglish
                ? 'Read-only brief · Does not write profile/tasks, insert, or send; feedback only records a brief event'
                : '只读简报 · 不写画像/任务，不插入或发送；反馈只写简报事件',
        };
        const keystoneSourceCount = (count: number): string =>
            keystoneEnglish ? `${count} source${count === 1 ? '' : 's'}` : `${count} 条来源`;
        if (
            !isSelectionSearch &&
            this.shouldSuppressContextBubbleForComposerAssist(options.recallContext)
        ) {
            this.clearPassiveContextBubble();
            return;
        }
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

        let activeKeystoneBrief =
            !isSelectionSearch && !isContextRehearsalMatch(matches[0])
                ? options.keystoneBrief
                : undefined;
        let briefEvidenceOpen = false;
        let briefRawCardOpen = false;
        let briefShownEventRecorded = false;
        let briefOpenedEventRecorded = false;
        let briefFeedbackReceipt: { status: 'pending' | 'confirmed' | 'failed'; message: string } | null = null;

        const hasPrimaryKeystoneBrief = (): boolean => {
            return Boolean(
                activeKeystoneBrief &&
                (activeKeystoneBrief.presentationMode === 'primary' ||
                    activeKeystoneBrief.presentationMode === 'conflict') &&
                (activeKeystoneBrief.brief.status === 'ready' ||
                    activeKeystoneBrief.brief.status === 'partial'),
            );
        };

        const hasStaleKeystoneBrief = (): boolean => {
            return Boolean(
                activeKeystoneBrief &&
                (activeKeystoneBrief.presentationMode === 'stale_notice' ||
                    activeKeystoneBrief.brief.status === 'stale'),
            );
        };

        this.clearContextBubble();
        this.ensureContextBubbleStyles();

        if (!document.body) {
            return;
        }

        const brandLabel = isSelectionSearch ? '划词记忆检索' : 'Memory Lens';
        const recallBasis = isSelectionSearch
            ? ''
            : normalizeText(options.recallBasis) || buildContextRecallCurrentBasisReceipt();
        const cardAriaLabel = isSelectionSearch
            ? 'Selection Memory Search 划词记忆检索结果'
            : 'Memory Lens 相关记忆详情';
        const currentSiteHost = this.getCurrentSiteMuteHost();
        const currentSiteAlreadyAllowed = this.siteAllowlistMode && this.isCurrentSiteAllowed();
        const siteAllowActionLabel = currentSiteAlreadyAllowed
            ? '此站点已在白名单'
            : this.siteAllowlistMode
                ? '允许此站点'
                : '开启白名单并允许此站点';
        const siteAllowActionDisabled = currentSiteAlreadyAllowed;
        const siteControlReceiptItems = isSelectionSearch
            ? []
            : [
                ['当前站点', currentSiteHost || '当前网页'],
                ['当前模式', this.siteAllowlistMode ? '白名单模式：只允许列表内站点被动提示' : '默认模式：未屏蔽站点可被动提示'],
                ['当前状态', this.buildCurrentSiteControlStatusText()],
                ['控制范围', '只影响右下角 Lens、页面召回、整页/视觉入库候选'],
                ['允许操作', this.buildSiteAllowActionDiagnostic()],
                ['今天不提示', this.buildSiteMuteActionDiagnostic()],
                ['页面屏蔽', this.buildPageBlockActionDiagnostic()],
                ['屏蔽操作', this.buildSiteBlockActionDiagnostic()],
                ['仍可使用', '主动划词检索仍可用；敏感页和密钥选区继续拦截'],
                ['不会执行', '不删除、不同步、不外发已有记忆'],
            ];
        const siteControlReceiptHtml = siteControlReceiptItems.length
            ? `
                <div class="pai-context-site-control-receipt" aria-label="站点控制回执">
                    <div class="pai-context-site-control-title">站点控制回执</div>
                    ${siteControlReceiptItems.map(([label, value]) => `
                        <div class="pai-context-site-control-row">
                            <span class="pai-context-site-control-label">${escapeHtml(label)}</span>
                            <span class="pai-context-site-control-value">${escapeHtml(value)}</span>
                        </div>
                    `).join('')}
                </div>
            `
            : '';
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
        let actionBoundaryOpen = false;
        const positiveFeedbackReceipts = new Map<string, ContextFeedbackCardReceipt>();
        let negativeFeedbackMatchId: string | null = null;
        let negativeFeedbackNoteExpanded = false;
        let negativeFeedbackNote = '';
        let sourceOpenReceipt: ContextSourceOpenReceipt | null = null;
        const feedbackSurface = isSelectionSearch ? 'selection_memory_search_card' : 'web_passive_bubble';
        const dragViewportMargin = 8;
        const dragPanelGap = 10;
        const dragThresholdPx = 4;
        let hasDraggedBubble = false;
        let suppressNextBubbleClick = false;
        let bubbleDragState: {
            pointerId: number;
            startClientX: number;
            startClientY: number;
            startLeft: number;
            startTop: number;
            moved: boolean;
            previousBodyUserSelect: string;
        } | null = null;

        const clampDragValue = (value: number, min: number, max: number): number => {
            if (max < min) {
                return min;
            }
            return Math.min(Math.max(value, min), max);
        };

        const positionAnchoredPanel = (panel: HTMLDivElement): void => {
            if (!hasDraggedBubble || !panel.isConnected) {
                return;
            }
            if (window.getComputedStyle(panel).display === 'none') {
                return;
            }

            const bubbleRect = bubble.getBoundingClientRect();
            const panelRect = panel.getBoundingClientRect();
            const panelWidth = panelRect.width || panel.offsetWidth;
            const panelHeight = panelRect.height || panel.offsetHeight;
            if (!panelWidth || !panelHeight) {
                return;
            }

            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            const bubbleCenterX = bubbleRect.left + bubbleRect.width / 2;
            const roomAbove = bubbleRect.top - dragViewportMargin;
            const roomBelow = viewportHeight - bubbleRect.bottom - dragViewportMargin;
            const placeBelow = roomAbove < panelHeight + dragPanelGap && roomBelow > roomAbove;
            const maxLeft = viewportWidth - panelWidth - dragViewportMargin;
            const maxTop = viewportHeight - panelHeight - dragViewportMargin;
            const left = clampDragValue(
                bubbleCenterX - panelWidth / 2,
                dragViewportMargin,
                maxLeft,
            );
            const top = clampDragValue(
                placeBelow
                    ? bubbleRect.bottom + dragPanelGap
                    : bubbleRect.top - panelHeight - dragPanelGap,
                dragViewportMargin,
                maxTop,
            );
            const arrowSize = panel === card ? 16 : 14;
            const arrowInset = panel === card ? 17 : 16;
            const arrowOutsideOffset = panel === card ? 8 : 7;
            const arrowOffset = clampDragValue(
                bubbleCenterX - left - arrowSize / 2,
                arrowInset,
                panelWidth - arrowSize - arrowInset,
            );

            panel.style.left = `${Math.round(left)}px`;
            panel.style.top = `${Math.round(top)}px`;
            panel.style.right = 'auto';
            panel.style.bottom = 'auto';
            panel.style.setProperty('--pai-context-arrow-left', `${Math.round(arrowOffset)}px`);
            panel.style.setProperty('--pai-context-arrow-right', 'auto');
            panel.style.setProperty('--pai-context-arrow-top', placeBelow ? `-${arrowOutsideOffset}px` : 'auto');
            panel.style.setProperty('--pai-context-arrow-bottom', placeBelow ? 'auto' : `-${arrowOutsideOffset}px`);
            panel.dataset.paiPlacement = placeBelow ? 'below' : 'above';
        };

        const updateAnchoredPanels = (): void => {
            if (!hasDraggedBubble) {
                return;
            }
            positionAnchoredPanel(peek);
            positionAnchoredPanel(card);
        };

        const buildPassivePeekSliceReceipt = (): string => {
            if (hasPrimaryKeystoneBrief() && activeKeystoneBrief) {
                const sourceCount = activeKeystoneBrief.brief.sourceMap.length;
                return keystoneEnglish
                    ? `${keystoneSourceCount(sourceCount)} · ${matches.length} related memor${matches.length === 1 ? 'y' : 'ies'} available for review`
                    : `${sourceCount} 条来源 · ${matches.length} 条相关记忆可展开复核`;
            }
            if (isSelectionSearch || matches.length <= 1) {
                return '';
            }
            return `当前预览第 ${currentIndex + 1}/${matches.length} 条；点击后可翻页查看本轮其他候选`;
        };

        const setDraggedBubblePosition = (left: number, top: number): void => {
            const bubbleWidth = bubble.offsetWidth || 44;
            const bubbleHeight = bubble.offsetHeight || 44;
            const maxLeft = window.innerWidth - bubbleWidth - dragViewportMargin;
            const maxTop = window.innerHeight - bubbleHeight - dragViewportMargin;
            const nextLeft = clampDragValue(left, dragViewportMargin, maxLeft);
            const nextTop = clampDragValue(top, dragViewportMargin, maxTop);
            hasDraggedBubble = true;
            bubble.style.left = `${Math.round(nextLeft)}px`;
            bubble.style.top = `${Math.round(nextTop)}px`;
            bubble.style.right = 'auto';
            bubble.style.bottom = 'auto';
            updateAnchoredPanels();
        };

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
                    evidenceLabel: '摘要',
                };
            }

            return {
                whySectionLabel: '为什么相关',
                whyRowLabel: '因为',
                contentSectionLabel: '可提取信息',
                footerSectionLabel: '建议动作',
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
            const suggestedActionText = selectContextLensSuggestedAction(match);
            const strengthLabel = formatContextMatchStrength(match);
            const strengthClass = getContextStrengthClass(match);
            const whyChips = isSelectionSearch
                ? buildSelectionSearchWhyChips(match, selectedText)
                : buildContextWhyChips(match);
            const peekFooter = buildContextRecallPeekFooterItems(match).join(' · ');
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
            const sourceReceipts = buildContextRecallSourceReceipts(
                match,
                exploreUrl,
                sourceLinks,
            );
            const sourceStatusReceipts = buildContextRecallSourceStatusReceipts(
                match,
                sourceLinks,
                exploreUrl,
                window.location.href,
            );
            const sourceMemoryReceiptItems = buildSourceMemoryRecallReceiptItems(match, {
                sourceLinks,
                exploreUrl,
            });
            const rehearsalReceiptItems = buildContextRehearsalReceiptItems(
                match,
                exploreUrl,
            );

            return {
                copy: getViewCopy(match),
                sourceLabel,
                titleText,
                summaryText,
                evidenceText,
                shouldShowEvidence,
                suggestedActionText,
                strengthLabel,
                strengthClass,
                whyChips,
                peekFooter,
                exploreUrl,
                compactMetaItems,
                sourceLinks,
                sourceReceipts,
                sourceStatusReceipts,
                sourceMemoryReceiptItems,
                rehearsalReceiptItems,
                recallBasis,
            };
        };

        const formatKeystoneDate = (timestamp: number): string => {
            if (!Number.isFinite(timestamp) || timestamp <= 0) return keystoneText.unknownTime;
            const milliseconds = timestamp > 10_000_000_000 ? timestamp : timestamp * 1000;
            return new Intl.DateTimeFormat(keystoneEnglish ? 'en-US' : 'zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
            }).format(new Date(milliseconds));
        };

        const formatKeystoneAuthority = (authority?: string): string => {
            const labels: Record<string, string> = {
                user_owned: keystoneEnglish ? 'User confirmed' : '用户确认',
                direct_message: keystoneEnglish ? 'Direct message' : '直接消息',
                source_memory: keystoneEnglish ? 'Source memory' : '资料记忆',
                jira: 'Jira',
                meeting: keystoneEnglish ? 'Meeting' : '会议',
                reflection: keystoneEnglish ? 'Reflection signal' : '反思线索',
                derived: keystoneEnglish ? 'System inference' : '系统推断',
            };
            return authority ? labels[authority] || authority : '';
        };

        const getSafeKeystoneSourceUrl = (url?: string): string => {
            if (!url) return '';
            try {
                const parsed = new URL(url);
                return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.href : '';
            } catch (_error) {
                return '';
            }
        };

        const renderKeystoneClaimSection = (
            label: string,
            claims: KeystoneBriefClaim[] | undefined,
        ): string => {
            const items = (claims || []).filter((claim) => normalizeText(claim.text));
            if (!items.length) return '';
            return `
                <section class="pai-keystone-slot">
                    <div class="pai-keystone-slot-title">${escapeHtml(label)}</div>
                    <ul class="pai-keystone-list">
                        ${items.map((claim) => {
                            const receipt = [
                                formatKeystoneAuthority(claim.authority),
                                claim.staleRisk === 'high'
                                    ? keystoneEnglish ? 'High freshness risk' : '高时效风险'
                                    : '',
                            ].filter(Boolean).join(' · ');
                            return `<li>${escapeHtml(claim.text)}${receipt ? ` <span class="pai-keystone-kicker">${escapeHtml(receipt)}</span>` : ''}</li>`;
                        }).join('')}
                    </ul>
                </section>
            `;
        };

        const buildStaleKeystoneNoticeHtml = (): string => {
            if (!hasStaleKeystoneBrief() || !activeKeystoneBrief) return '';
            const brief = activeKeystoneBrief.brief;
            return `
                <div class="pai-keystone-notice" role="status">
                    ${keystoneEnglish
                        ? `An older brief exists, with sources as of ${escapeHtml(formatKeystoneDate(brief.sourceAsOf))}. ${escapeHtml(brief.freshness.reason)} Original memories are shown first; the old summary is not treated as a current fact.`
                        : `有旧简报，来源截至 ${escapeHtml(formatKeystoneDate(brief.sourceAsOf))}。${escapeHtml(brief.freshness.reason)}；当前先展示原始记忆，不把旧摘要当作当前事实。`}
                </div>
            `;
        };

        const renderKeystoneBriefCard = (): boolean => {
            if (!hasPrimaryKeystoneBrief() || briefRawCardOpen || !activeKeystoneBrief) {
                return false;
            }
            const presentation = activeKeystoneBrief;
            const brief = presentation.brief;
            const isConflict = presentation.presentationMode === 'conflict' || brief.status === 'partial';
            const statusLabel = isConflict ? keystoneText.conflict : keystoneText.synthesized;
            const sourceCount = brief.sourceMap.length;
            const hiddenSourceCount = brief.displayPolicy.hiddenSourceCount;
            const conflictHtml = isConflict
                ? `
                    <div class="pai-keystone-notice pai-keystone-notice--conflict" role="status">
                        ${keystoneEnglish
                            ? 'Conflicting sources were detected. Existing conclusions are retained for review and cannot be copied as an external summary; inspect the evidence first.'
                            : '检测到来源冲突。以下内容保留已有结论供复核，不能复制为外发摘要；请先查看证据。'}
                    </div>
                `
                : '';
            const currentStateHtml = normalizeText(brief.slots.currentState)
                ? `
                    <section class="pai-keystone-slot">
                        <div class="pai-keystone-slot-title">${keystoneText.currentState}</div>
                        <div class="pai-context-summary">${escapeHtml(brief.slots.currentState)}</div>
                    </section>
                `
                : '';
            const openQuestions = brief.slots.openQuestions || [];
            const openQuestionsHtml = openQuestions.length
                ? `
                    <section class="pai-keystone-slot">
                        <div class="pai-keystone-slot-title">${keystoneText.openQuestions}</div>
                        <ul class="pai-keystone-list">
                            ${openQuestions.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
                        </ul>
                    </section>
                `
                : '';
            const sourceMapHtml = brief.sourceMap.map((source) => {
                const title = normalizeText(source.title) || `${source.sourceType}:${source.sourceId}`;
                const sourceMeta = [
                    formatKeystoneAuthority(source.authority),
                    source.projection === 'summary_ok' ? keystoneText.summaryAllowed : keystoneText.originalOnly,
                ].filter(Boolean).join(' · ');
                const safeUrl = getSafeKeystoneSourceUrl(source.url);
                const labelHtml = safeUrl
                    ? `<a href="${escapeHtmlAttribute(safeUrl)}" target="_blank" rel="noopener" title="${escapeHtmlAttribute(keystoneEnglish ? 'Open the original source for review only; does not write or send' : '只打开原始来源复核，不写入或发送')}">${escapeHtml(title)}</a>`
                    : escapeHtml(title);
                return `<li>${labelHtml}${sourceMeta ? ` · ${escapeHtml(sourceMeta)}` : ''}</li>`;
            }).join('');
            const rawEvidenceHtml = matches.map((match, index) => {
                const view = buildMatchView(match);
                return `
                    <button type="button" class="pai-keystone-evidence-item" data-keystone-evidence-index="${index}" aria-label="${escapeHtmlAttribute(keystoneText.viewOriginalCard)}: ${escapeHtmlAttribute(view.titleText)}">
                        <span class="pai-keystone-evidence-item-title">${escapeHtml(view.titleText)}</span>
                        <span class="pai-keystone-evidence-item-summary">${escapeHtml(view.summaryText)}</span>
                    </button>
                `;
            }).join('');
            const evidenceDetailHtml = briefEvidenceOpen
                ? `
                    <div class="pai-keystone-evidence-list">
                        <div class="pai-keystone-slot-title">${keystoneText.sourceMap}</div>
                        <ul class="pai-keystone-list">${sourceMapHtml}</ul>
                        <div class="pai-keystone-slot-title">${keystoneText.relatedMemories}</div>
                        ${rawEvidenceHtml}
                    </div>
                `
                : '';
            const copyDisabled = !brief.displayPolicy.canCopyToDraft || isConflict;
            const copyActionLabel = copyDisabled
                ? keystoneEnglish
                    ? 'This brief has a conflict or freshness risk and cannot be copied as an external summary'
                    : '当前简报存在冲突或时效风险，不能复制外发摘要'
                : keystoneEnglish
                    ? `Copy the redacted summary to the clipboard; ${hiddenSourceCount} local-only source${hiddenSourceCount === 1 ? '' : 's'} will be excluded and nothing is sent automatically`
                    : `复制已脱敏摘要到剪贴板；${hiddenSourceCount} 条仅本机来源不会进入摘要，不会自动发送`;
            const moreMenuHtml = `
                ${siteControlReceiptHtml}
                <button type="button" class="pai-context-menu-item pai-keystone-hide" role="menuitem">${keystoneText.hideBrief}</button>
                <button type="button" class="pai-context-menu-item pai-context-site-allow" role="menuitem" ${siteAllowActionDisabled ? 'disabled aria-disabled="true"' : ''}>${escapeHtml(siteAllowActionLabel)}</button>
                <button type="button" class="pai-context-menu-item pai-context-site-mute" role="menuitem">此网站今天不提示</button>
                <button type="button" class="pai-context-menu-item pai-context-page-block" role="menuitem">此页面永久不提示</button>
                <button type="button" class="pai-context-menu-item pai-context-menu-item--danger pai-context-site-block" role="menuitem">永久不提示此站点</button>
            `;
            const feedbackReceiptHtml = briefFeedbackReceipt
                ? `<div class="pai-keystone-feedback-receipt" role="status">${escapeHtml(briefFeedbackReceipt.message)}</div>`
                : '';

            card.innerHTML = `
                <div class="pai-context-card-scroll">
                    <div class="pai-context-head">
                        <div class="pai-context-brand">
                            <span class="pai-context-mark"><img src="${escapeHtmlAttribute(lensIconUrl)}" alt=""></span>
                            <span>${escapeHtml(brandLabel)}</span>
                        </div>
                        <div class="pai-context-head-actions">
                            <span class="pai-context-relevance pai-context-relevance--${isConflict ? 'maybe' : 'strong'}">${escapeHtml(statusLabel)}</span>
                            <div class="pai-context-more-wrap">
                                <button type="button" class="pai-context-icon-button pai-context-more" aria-label="${keystoneText.moreControls}" title="${keystoneText.moreControls}" aria-haspopup="menu" aria-expanded="${String(moreMenuOpen)}">⋯</button>
                                <div class="pai-context-more-menu" role="menu" ${moreMenuOpen ? '' : 'hidden'}>${moreMenuHtml}</div>
                            </div>
                        </div>
                    </div>
                    ${conflictHtml}
                    <div class="pai-keystone-kicker">${keystoneText.brief}</div>
                    <h3 class="pai-context-title">${escapeHtml(brief.title)}</h3>
                    <div class="pai-context-summary">${escapeHtml(brief.summary)}</div>
                    ${normalizeText(presentation.whyNow) || normalizeText(brief.slots.whyItMatters) ? `
                        <div class="pai-keystone-why">${keystoneText.whyNow}: ${escapeHtml(normalizeText(presentation.whyNow) || normalizeText(brief.slots.whyItMatters))}</div>
                    ` : ''}
                    <div class="pai-keystone-meta">
                        <span>${keystoneSourceCount(sourceCount)}</span>
                        <span>${keystoneText.sourceAsOf} ${escapeHtml(formatKeystoneDate(brief.sourceAsOf))}</span>
                        <span>${keystoneEnglish ? `${hiddenSourceCount} ${keystoneText.localOnly}` : `${hiddenSourceCount} 条${keystoneText.localOnly}`}</span>
                    </div>
                    ${currentStateHtml}
                    ${renderKeystoneClaimSection(keystoneText.constraints, brief.slots.constraints)}
                    ${renderKeystoneClaimSection(keystoneText.stableFacts, brief.slots.stableFacts)}
                    ${renderKeystoneClaimSection(keystoneText.decisions, brief.slots.decisions)}
                    ${renderKeystoneClaimSection(keystoneText.traps, brief.slots.traps)}
                    ${openQuestionsHtml}
                    <section class="pai-keystone-evidence">
                        <button type="button" class="pai-keystone-evidence-toggle" aria-expanded="${String(briefEvidenceOpen)}">
                            ${briefEvidenceOpen ? keystoneText.collapseEvidence : keystoneText.viewEvidence} (${sourceCount})
                        </button>
                        ${evidenceDetailHtml}
                    </section>
                </div>
                <div class="pai-context-footer-wrap">
                    <div class="pai-context-section-label pai-context-section-label--footer">${keystoneText.actions}</div>
                    <div class="pai-keystone-actions">
                        <button type="button" class="pai-keystone-action pai-keystone-copy" aria-label="${escapeHtmlAttribute(copyActionLabel)}" title="${escapeHtmlAttribute(copyActionLabel)}" ${copyDisabled ? 'disabled' : ''}>${keystoneText.copySummary}</button>
                        <button type="button" class="pai-keystone-action pai-keystone-useful">${keystoneText.useful}</button>
                        <button type="button" class="pai-keystone-action pai-keystone-action--quiet pai-keystone-inaccurate">${keystoneText.inaccurate}</button>
                    </div>
                    <div class="pai-context-action-boundary" aria-label="${keystoneEnglish ? 'Action boundary' : '操作边界'}">${keystoneText.readOnlyBoundary}</div>
                    ${feedbackReceiptHtml}
                </div>
            `;
            updateAnchoredPanels();
            return true;
        };

        const buildContextBubbleRestReceipt = (
            match: ContextRecallMatch,
            view = buildMatchView(match),
        ): string => {
            if (hasPrimaryKeystoneBrief() && activeKeystoneBrief) {
                const brief = activeKeystoneBrief.brief;
                const status = brief.status === 'partial' ? keystoneText.conflict : keystoneText.synthesized;
                return clipContextFeedbackDetailValue(
                    [
                        brandLabel,
                        `${keystoneText.brief}: ${status}`,
                        brief.title,
                        keystoneSourceCount(brief.sourceMap.length),
                        recallBasis,
                        keystoneEnglish
                            ? 'Read-only cue; does not write, insert, or send'
                            : '只读提示，不写入/插入/发送',
                    ].filter(Boolean).join('。'),
                    180,
                );
            }
            const reason = view.whyChips[0]
                ? `因为${view.whyChips[0]}`
                : view.peekFooter
                    ? view.peekFooter.split(' · ')[0]
                    : '';
            const title = clipContextFeedbackDetailValue(view.titleText, 56);
            const parts = [
                brandLabel,
                hasStaleKeystoneBrief()
                    ? keystoneEnglish ? 'An older brief exists; original memories are shown' : '有旧简报，当前展示原始记忆'
                    : '',
                view.strengthLabel,
                reason,
                title,
                buildPassivePeekSliceReceipt(),
                view.recallBasis,
                '只读提示，不写入/插入/发送',
            ].filter(Boolean);
            return clipContextFeedbackDetailValue(parts.join('。'), 180) || brandLabel;
        };

        const updateBubbleRestReceipt = (
            match = matches[currentIndex],
            view?: ReturnType<typeof buildMatchView>,
        ): void => {
            if (isSelectionSearch || !match) return;
            const receipt = buildContextBubbleRestReceipt(match, view);
            bubble.title = receipt;
            bubble.setAttribute('aria-label', `打开相关记忆提示：${receipt}`);
        };

        const getSourceMemoryActionTargetLabel = (label?: string | null): string => {
            return clipContextFeedbackDetailValue(label, 80) || '已保存资料';
        };

        const getContextSourceLinkHost = (url?: string | null): string => {
            try {
                return url ? new URL(url).hostname : '';
            } catch (_error) {
                return '';
            }
        };

        const buildSourceMemoryOriginalSourceActionLabel = (
            link: { label: string; url: string },
        ): string => {
            const targetLabel = getSourceMemoryActionTargetLabel(link.label);
            const host = getContextSourceLinkHost(link.url);
            const target = host ? `${targetLabel}（${host}）` : targetLabel;
            return `打开已保存资料的原始来源：${target}。只打开新标签核对，不写入记忆、不插入输入框、不发送内容、不确认事实。`;
        };

        const getContextSourceActionTargetLabel = (label?: string | null): string => {
            return clipContextFeedbackDetailValue(label, 80) || '原始来源';
        };

        const buildOriginalSourceActionLabel = (
            link: { label: string; url: string },
            match: ContextRecallMatch,
        ): string => {
            if (match.type === 'source_memory') {
                return buildSourceMemoryOriginalSourceActionLabel(link);
            }
            const targetLabel = getContextSourceActionTargetLabel(link.label);
            const host = getContextSourceLinkHost(link.url);
            const target = host ? `${targetLabel}（${host}）` : targetLabel;
            const targetKind = isSelectionSearch
                ? '这条划词检索结果'
                : isContextRehearsalMatch(match)
                    ? '这条预演提醒'
                    : '这条记忆提示';
            return `打开原始来源：${target}。只打开新标签核对${targetKind}摘要；不会重新召回、写入记忆、插入输入框、发送内容或确认事实。`;
        };

        const buildMemoryDetailActionLabel = (
            match: ContextRecallMatch,
            view: ReturnType<typeof buildMatchView>,
        ): string => {
            if (match.type !== 'source_memory') return '在记忆中查看';
            const targetLabel = getSourceMemoryActionTargetLabel(view.titleText || match.sourceTitle);
            return `打开资料详情复核：${targetLabel}。本次点击只打开新标签；不会新增或撤销资料记忆，不写画像或任务，不插入或发送内容。`;
        };

        const getContextFeedbackTargetLabel = (match: ContextRecallMatch): string => {
            if (isSelectionSearch) return '这条划词检索结果';
            if (isContextRehearsalMatch(match)) return '这条预演提醒';
            if (match.type === 'source_memory') return '这条资料记忆提示';
            return '这条记忆提示';
        };

        const buildPositiveFeedbackActionLabel = (
            match: ContextRecallMatch,
            view: ReturnType<typeof buildMatchView>,
            receipt?: ContextFeedbackCardReceipt,
        ): string => {
            const target = getContextFeedbackTargetLabel(match);
            if (receipt?.status === 'pending') {
                return `正在记录${target}有用反馈；服务确认前不会当作已学习，不会插入输入框、发送内容或确认事实。`;
            }
            if (receipt?.status === 'confirmed') {
                return `${target}有用反馈已确认写入；后续类似提示会优先保留，不会插入输入框、发送内容或确认事实。`;
            }
            return `${view.copy.positiveAriaLabel}：提交 recall-quality 有用反馈，服务确认后才会影响后续类似提示；不会插入输入框、发送内容或确认事实。`;
        };

        const buildNegativeFeedbackActionLabel = (
            match: ContextRecallMatch,
            view: ReturnType<typeof buildMatchView>,
        ): string => {
            const target = getContextFeedbackTargetLabel(match);
            const boundary = isSelectionSearch
                ? '不会保存选区、插入输入框、发送内容、调用外部 AI 或确认事实'
                : '不会删除原始记忆、插入输入框、发送内容或确认事实';
            return `${view.copy.negativeAriaLabel}：打开原因面板；选择原因后提交 recall-quality 修正并隐藏${target}，写入失败时只保留本页 30 分钟隐藏；${boundary}。`;
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
            actionBoundaryOpen = false;
            renderCard();

            const renderDrawer = (): void => {
                this.clearContextFeedbackDrawer();
                if (!document.body) return;

                const drawer = document.createElement('div');
                drawer.className = 'pai-context-feedback-layer';
                drawer.setAttribute('role', 'dialog');
                drawer.setAttribute('aria-label', '这条记忆哪里不对');
                drawer.setAttribute('aria-modal', 'false');

                const isRehearsalFeedback = isContextRehearsalMatch(match);
                const feedbackTitle = isRehearsalFeedback
                    ? '这条预演提醒不适合当前场景'
                    : '这条记忆不是这个意思';
                const feedbackSubtitle = isRehearsalFeedback
                    ? '选一个原因就会记录到这条预演，后续减少类似现场提示。'
                    : '选一个原因就会记录，不需要提交。';
                const feedbackTargetLabel = isRehearsalFeedback
                    ? '误触发的预演提醒'
                    : '误触发的记忆';
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
                const correctableClaims = (match.claimAttribution || []).filter(
                    (claim) => claim.correctionAllowed,
                );
                const attributionCorrectionHtml = correctableClaims.length
                    ? `
                        <div class="pai-context-claim-correction" aria-label="内容归属纠正">
                            <div class="pai-context-feedback-scene-label">内容归属</div>
                            ${correctableClaims.map((claim) => `
                                <div class="pai-context-claim-correction-item" data-claim-id="${escapeHtmlAttribute(claim.claimId)}">
                                    <div class="pai-context-claim-correction-copy">
                                        <strong>${escapeHtml(claim.displayLabel)}</strong>
                                        <span>${escapeHtml(claim.consequence)}</span>
                                    </div>
                                    <div class="pai-context-claim-correction-actions">
                                        ${MEMORY_CLAIM_CORRECTION_ACTIONS.map((action) => `
                                            <button type="button" data-claim-correction="${escapeHtmlAttribute(action.value)}" data-claim-id="${escapeHtmlAttribute(claim.claimId)}">${escapeHtml(action.label)}</button>
                                        `).join('')}
                                    </div>
                                    <div class="pai-context-claim-correction-status" role="status">只修改 Personal AI 的派生归属，不改原始消息或外部系统。</div>
                                </div>
                            `).join('')}
                        </div>
                    `
                    : '';

                drawer.innerHTML = `
                    <button type="button" class="pai-context-feedback-scrim" aria-label="关闭反馈原因选择"></button>
                    <aside class="pai-context-feedback-sheet" tabindex="-1">
                        <div class="pai-context-feedback-sheet-head">
                            <div>
                                <h4 class="pai-context-feedback-sheet-title">${escapeHtml(feedbackTitle)}</h4>
                                <div class="pai-context-feedback-sheet-subtitle">${escapeHtml(feedbackSubtitle)}</div>
                            </div>
                            <button type="button" class="pai-context-feedback-close" aria-label="关闭反馈原因选择">×</button>
                        </div>
                        <div class="pai-context-feedback-scene">
                            <div class="pai-context-feedback-scene-label">当前场景</div>
                            <div class="pai-context-feedback-scene-text">${escapeHtml(sceneText || '当前页面')}</div>
                            <div class="pai-context-feedback-scene-label">${escapeHtml(feedbackTargetLabel)}</div>
                            <div class="pai-context-feedback-scene-text">${escapeHtml(clippedTitle || view.sourceLabel || '当前提示')}</div>
                        </div>
                        <div class="pai-context-feedback-reasons">
                            ${reasonButtonsHtml}
                        </div>
                        ${attributionCorrectionHtml}
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
                        return;
                    }

                    const claimCorrectionButton = target.closest<HTMLButtonElement>(
                        '[data-claim-correction][data-claim-id]',
                    );
                    if (claimCorrectionButton) {
                        event.preventDefault();
                        const claimId = claimCorrectionButton.dataset.claimId || '';
                        const correction = claimCorrectionButton.dataset
                            .claimCorrection as MemoryClaimCorrectionAction | undefined;
                        const claim = correctableClaims.find(
                            (item) => item.claimId === claimId,
                        );
                        if (!claim || !correction) return;
                        const item = claimCorrectionButton.closest<HTMLElement>(
                            '.pai-context-claim-correction-item',
                        );
                        const buttons = item?.querySelectorAll<HTMLButtonElement>('button') || [];
                        const status = item?.querySelector<HTMLElement>(
                            '.pai-context-claim-correction-status',
                        );
                        buttons.forEach((button) => {
                            button.disabled = true;
                        });
                        if (status) status.textContent = '正在更新派生归属…';
                        chrome.runtime.sendMessage(
                            {
                                type: 'MEMORY_CLAIM_CORRECTION',
                                claimId,
                                correction: {
                                    correction,
                                    expectedRevision: claim.revision,
                                    source: 'memory_lens',
                                    idempotencyKey:
                                        (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
                                            ? crypto.randomUUID()
                                            : '') ||
                                        `lens-claim-${Date.now()}-${Math.random().toString(16).slice(2)}`,
                                },
                            },
                            (response) => {
                                const error = chrome.runtime.lastError?.message || response?.error;
                                if (!response?.success || error) {
                                    buttons.forEach((button) => {
                                        button.disabled = false;
                                    });
                                    if (status) {
                                        status.textContent = `未更新：${error || '服务未确认写入'}`;
                                        status.dataset.state = 'error';
                                    }
                                    return;
                                }
                                claim.revision = response.result.revision;
                                claim.corrected = true;
                                if (status) {
                                    status.textContent = response.result.rawSourceChanged === false
                                        ? '已更新派生归属；原始消息未修改。'
                                        : '归属已更新。';
                                    status.dataset.state = 'success';
                                }
                            },
                        );
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
            if (hasPrimaryKeystoneBrief() && activeKeystoneBrief) {
                const presentation = activeKeystoneBrief;
                const brief = presentation.brief;
                const isConflict = brief.status === 'partial';
                const peekBoundaryText = isConflict
                    ? keystoneEnglish
                        ? 'Conflict · Click to inspect evidence; external copy is disabled'
                        : '存在冲突 · 点击看证据，不能复制外发'
                    : keystoneEnglish
                        ? 'Read-only brief · Click to inspect evidence; does not write or send automatically'
                        : '只读简报 · 点击查看证据，不自动写入或发送';
                peek.innerHTML = `
                    <div class="pai-context-peek-header">
                        <span>${escapeHtml(brandLabel)}</span>
                        <span class="pai-context-relevance pai-context-relevance--${isConflict ? 'maybe' : 'strong'}">${isConflict ? keystoneText.shortConflict : keystoneText.brief}</span>
                    </div>
                    <div class="pai-keystone-kicker">${escapeHtml(normalizeText(presentation.whyNow) || keystoneText.matchedScene)}</div>
                    <div class="pai-context-peek-title">${escapeHtml(brief.title)}</div>
                    <div class="pai-context-peek-summary">${escapeHtml(brief.summary)}</div>
                    <div class="pai-context-peek-footer">${escapeHtml(`${keystoneSourceCount(brief.sourceMap.length)} · ${keystoneText.sourceAsOf} ${formatKeystoneDate(brief.sourceAsOf)}`)}</div>
                    <div class="pai-context-peek-slice">${escapeHtml(buildPassivePeekSliceReceipt())}</div>
                    ${recallBasis ? `<div class="pai-context-peek-basis">${escapeHtml(recallBasis)}</div>` : ''}
                    <div class="pai-context-peek-boundary">${escapeHtml(peekBoundaryText)}</div>
                `;
                updateBubbleRestReceipt(matches[currentIndex]);
                updateAnchoredPanels();
                return;
            }
            const match = matches[currentIndex];
            const view = buildMatchView(match);
            const peekBoundaryText = '只读提示 · 点击查看详情，不写入/插入/发送';
            const peekSliceReceipt = buildPassivePeekSliceReceipt();
            peek.innerHTML = `
                <div class="pai-context-peek-header">
                    <span>${escapeHtml(brandLabel)}</span>
                    <span class="pai-context-relevance pai-context-relevance--${escapeHtmlAttribute(view.strengthClass)}">${escapeHtml(view.strengthLabel)}</span>
                </div>
                ${renderWhyChips(match)}
                ${hasStaleKeystoneBrief() ? `<div class="pai-keystone-kicker">${keystoneEnglish ? 'An older brief exists; original memories are shown' : '有旧简报，当前展示原始记忆'}</div>` : ''}
                <div class="pai-context-peek-title">${escapeHtml(view.titleText)}</div>
                <div class="pai-context-peek-summary">${escapeHtml(view.summaryText)}</div>
                ${view.peekFooter ? `<div class="pai-context-peek-footer">${escapeHtml(view.peekFooter)}</div>` : ''}
                ${peekSliceReceipt ? `<div class="pai-context-peek-slice">${escapeHtml(peekSliceReceipt)}</div>` : ''}
                ${view.recallBasis ? `<div class="pai-context-peek-basis">${escapeHtml(view.recallBasis)}</div>` : ''}
                <div class="pai-context-peek-boundary">${escapeHtml(peekBoundaryText)}</div>
            `;
            updateBubbleRestReceipt(match, view);
            updateAnchoredPanels();
        };

        const renderCard = (): void => {
            if (renderKeystoneBriefCard()) return;
            const match = matches[currentIndex];
            const view = buildMatchView(match);
            const briefBackHtml = briefRawCardOpen && hasPrimaryKeystoneBrief()
                ? `
                    <div class="pai-keystone-back-wrap">
                        <button type="button" class="pai-keystone-back">${keystoneText.backToBrief}</button>
                    </div>
                `
                : '';
            const staleKeystoneNoticeHtml = buildStaleKeystoneNoticeHtml();
            const isChangePresentation = match.metadata?.changeLedgerPresentation === true;
            const changeProjectionHtml = isSelectionSearch || !isChangePresentation
                ? ''
                : renderMemoryChangeProjectionSection(options.changeProjections || []);
            const positiveFeedbackReceipt = positiveFeedbackReceipts.get(match.id);
            const isPositiveLocked =
                positiveFeedbackReceipt?.status === 'pending' ||
                positiveFeedbackReceipt?.status === 'confirmed';
            const positiveFeedbackActionLabel = buildPositiveFeedbackActionLabel(
                match,
                view,
                positiveFeedbackReceipt,
            );
            const negativeFeedbackActionLabel = buildNegativeFeedbackActionLabel(match, view);
            const memoryDetailActionLabel = buildMemoryDetailActionLabel(match, view);
            const metaHtml = view.compactMetaItems
                .map((item) => `<span class="pai-context-meta-item">${escapeHtml(item)}</span>`)
                .join('');
            const sourceLinksHtml = view.sourceLinks
                .map((link) => {
                    const sourceActionLabel = buildOriginalSourceActionLabel(link, match);
                    const sourceActionAttributes =
                        ` aria-label="${escapeHtmlAttribute(sourceActionLabel)}" title="${escapeHtmlAttribute(sourceActionLabel)}"`;
                    return `<a class="pai-context-source-link" href="${escapeHtmlAttribute(link.url)}" target="_blank" rel="noopener"${sourceActionAttributes}>${escapeHtml(link.label)}</a>`;
                })
                .join('');
            const sourceStatusHtml = view.sourceStatusReceipts
                .map((item) => `<span class="pai-context-meta-item pai-context-source-status">${escapeHtml(item)}</span>`)
                .join('');
            const sourceReceiptHtml = view.sourceReceipts
                .map((item) => `<span class="pai-context-meta-item pai-context-source-receipt">${escapeHtml(item)}</span>`)
                .join('');
            const sourceOpenReceiptForMatch =
                sourceOpenReceipt?.matchId === match.id ? sourceOpenReceipt : null;
            const sourceOpenReceiptHtml = sourceOpenReceiptForMatch
                ? `
                    <div class="pai-context-source-open-receipt" role="status" aria-label="来源打开回执">
                        <div class="pai-context-source-open-title">来源打开回执</div>
                        <div class="pai-context-source-open-row">
                            <span class="pai-context-source-open-label">打开</span>
                            <span class="pai-context-source-open-value">${escapeHtml(sourceOpenReceiptForMatch.targetLabel)}</span>
                        </div>
                        <div class="pai-context-source-open-row">
                            <span class="pai-context-source-open-label">复核</span>
                            <span class="pai-context-source-open-value">${escapeHtml(sourceOpenReceiptForMatch.reviewScope)}</span>
                        </div>
                        <div class="pai-context-source-open-row">
                            <span class="pai-context-source-open-label">状态</span>
                            <span class="pai-context-source-open-value">${escapeHtml(sourceOpenReceiptForMatch.sourceStatus)}</span>
                        </div>
                        <div class="pai-context-source-open-row">
                            <span class="pai-context-source-open-label">边界</span>
                            <span class="pai-context-source-open-value">${escapeHtml(sourceOpenReceiptForMatch.boundary)}</span>
                        </div>
                    </div>
                `
                : '';
            const rehearsalReceiptHtml = view.rehearsalReceiptItems.length
                ? `
                    <div class="pai-context-rehearsal-receipt" aria-label="预演回执">
                        <div class="pai-context-rehearsal-receipt-title">预演回执</div>
                        ${view.rehearsalReceiptItems.map(([label, value]) => `
                            <div class="pai-context-rehearsal-receipt-row">
                                <span class="pai-context-rehearsal-receipt-label">${escapeHtml(label)}</span>
                                <span class="pai-context-rehearsal-receipt-value">${escapeHtml(value)}</span>
                            </div>
                        `).join('')}
                    </div>
                `
                : '';
            const sourceMemoryReceiptHtml = !isChangePresentation && view.sourceMemoryReceiptItems.length
                ? `
                    <div class="pai-context-source-memory-receipt" aria-label="资料回执">
                        <div class="pai-context-source-memory-receipt-title">资料回执</div>
                        ${view.sourceMemoryReceiptItems.map(([label, value]) => `
                            <div class="pai-context-source-memory-receipt-row">
                                <span class="pai-context-source-memory-receipt-label">${escapeHtml(label)}</span>
                                <span class="pai-context-source-memory-receipt-value">${escapeHtml(value)}</span>
                            </div>
                        `).join('')}
                    </div>
                `
                : '';
            const weaveLabel = computeLensWeaveLabel(matches);
            const weaveChipHtml = weaveLabel
                ? `<span class="pai-context-meta-item pai-context-weave-chip" title="跨来源缝合证据">${escapeHtml(weaveLabel)}</span>`
                : '';
            const attributionItem = (match.claimAttribution || []).find(
                (item) => item.corrected || item.effect !== 'used',
            );
            const attributionChipHtml = attributionItem
                ? `<span class="pai-context-meta-item pai-context-attribution-chip" title="${escapeHtmlAttribute(`${attributionItem.consequence}；只影响 Personal AI 的派生使用，不修改原始消息。`)}">${escapeHtml(attributionItem.displayLabel)} · ${escapeHtml(attributionItem.effect === 'background_only' ? '仅作背景' : attributionItem.effect === 'blocked' ? '未使用' : '已纠正')}</span>`
                : '';
            const pagerHtml = matches.length > 1
                ? `
                    <div class="pai-context-pager" aria-label="相关记忆候选分页">
                        <button type="button" class="pai-context-pager-button pai-context-prev" aria-label="上一条相关记忆" ${currentIndex === 0 ? 'disabled' : ''}>‹</button>
                        <span>${currentIndex + 1} / ${matches.length}</span>
                        <button type="button" class="pai-context-pager-button pai-context-next" aria-label="下一条相关记忆" ${currentIndex >= matches.length - 1 ? 'disabled' : ''}>›</button>
                    </div>
                `
                : '';
            const selectionReceiptItems = isSelectionSearch
                ? [
                    ...buildSelectionSearchOpenReceipt(
                        match,
                        selectedText,
                        matches.length,
                        currentIndex,
                    ),
                    ['查询', '只用选中文字作为主检索文本'],
                    [
                        '背景',
                        [
                            '页面标题/附近段落只作辅助上下文',
                            clipContextFeedbackDetailValue(document.title, 70),
                            clipContextFeedbackDetailValue(window.location.hostname, 60),
                        ].filter(Boolean).join(' · '),
                    ],
                    ['命中门槛', '只有选中文字本身有具体锚点才显示入口；背景命中不会单独弹出'],
                    ['边界', '主动划词，不受被动站点静默或屏蔽控制影响'],
                    ['安全', '敏感页/密钥类选区仍拦截；不自动入库、插入或发给外部 AI'],
                ]
                : [];
            const selectionReceiptHtml = selectionReceiptItems.length
                ? `
                    <div class="pai-context-selection-receipt" aria-label="划词检索范围">
                        ${selectionReceiptItems.map(([label, value]) => `
                            <div class="pai-context-selection-receipt-row">
                                <span class="pai-context-selection-receipt-label">${escapeHtml(label)}</span>
                                <span class="pai-context-selection-receipt-value">${escapeHtml(value)}</span>
                            </div>
                        `).join('')}
                    </div>
                `
                : '';
            const selectedTextHtml = isSelectionSearch && selectedText
                ? `
                    <div class="pai-context-section-label">选中的内容</div>
                    <div class="pai-context-selected-text">${escapeHtml(selectedText)}</div>
                    ${selectionReceiptHtml}
                `
                : '';
            const moreMenuHtml = isSelectionSearch
                ? `
                    <button type="button" class="pai-context-menu-item pai-context-selection-close" role="menuitem">关闭本次划词结果</button>
                `
                : `
                    ${siteControlReceiptHtml}
                    <button type="button" class="pai-context-menu-item pai-context-dismiss" role="menuitem">${isChangePresentation ? '隐藏本次变化提示 30 分钟' : '隐藏此条记忆 30 分钟'}</button>
                    <button type="button" class="pai-context-menu-item pai-context-site-allow" role="menuitem" ${siteAllowActionDisabled ? 'disabled aria-disabled="true"' : ''}>${escapeHtml(siteAllowActionLabel)}</button>
                    <button type="button" class="pai-context-menu-item pai-context-site-mute" role="menuitem">此网站今天不提示</button>
                    <button type="button" class="pai-context-menu-item pai-context-page-block" role="menuitem">此页面永久不提示</button>
                    <button type="button" class="pai-context-menu-item pai-context-menu-item--danger pai-context-site-block" role="menuitem">永久不提示此站点</button>
                `;
            const actionBoundaryBaseText = isSelectionSearch
                ? '只读检索，不保存/插入/外发'
                : isChangePresentation
                    ? '只读变化证据，不确认当前值/写入/插入/发送'
                : isContextRehearsalMatch(match)
                    ? '只读预演，不生成/插入/发送/执行'
                    : match.type === 'source_memory'
                            ? '只读资料，不写入/插入/发送'
                            : '只读提示，不写入/插入/发送';
            const actionBoundaryBaseWithSuggestion = view.suggestedActionText
                ? `${view.suggestedActionText} · ${actionBoundaryBaseText}`
                : actionBoundaryBaseText;
            const actionBoundaryDetailItems: Array<[string, string]> = isSelectionSearch
                ? []
                : buildContextAutopilotReceiptItems(options.autopilot);
            if (actionBoundaryDetailItems.length) {
                if (view.suggestedActionText) {
                    actionBoundaryDetailItems.push(['建议动作', view.suggestedActionText]);
                }
                actionBoundaryDetailItems.push(['操作边界', actionBoundaryBaseText]);
            } else {
                actionBoundaryOpen = false;
            }
            const actionBoundaryText = actionBoundaryDetailItems.length
                ? view.suggestedActionText || buildContextAutopilotCompactSummaryText(options.autopilot) || actionBoundaryBaseWithSuggestion
                : actionBoundaryBaseWithSuggestion;
            const actionBoundaryDetailId = `${card.id}-action-boundary-detail`;
            const actionBoundaryHtml = actionBoundaryDetailItems.length
                ? `
                    <div class="pai-context-action-boundary-wrap${actionBoundaryOpen ? ' pai-context-action-boundary-wrap--open' : ''}">
                        <button type="button" class="pai-context-action-boundary pai-context-action-boundary-button" aria-label="查看展示过滤与操作边界" aria-expanded="${String(actionBoundaryOpen)}" aria-describedby="${escapeHtmlAttribute(actionBoundaryDetailId)}">
                            ${escapeHtml(actionBoundaryText)}
                        </button>
                        <div class="pai-context-action-boundary-detail" id="${escapeHtmlAttribute(actionBoundaryDetailId)}" role="tooltip">
                            ${actionBoundaryDetailItems.map(([label, value]) => `
                                <div class="pai-context-action-boundary-detail-row">
                                    <span class="pai-context-action-boundary-detail-label">${escapeHtml(label)}</span>
                                    <span class="pai-context-action-boundary-detail-value">${escapeHtml(value)}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `
                : `
                    <div class="pai-context-action-boundary-wrap">
                        <div class="pai-context-action-boundary" aria-label="操作边界">${escapeHtml(actionBoundaryText)}</div>
                    </div>
                `;
            const positiveFeedbackReceiptHtml = positiveFeedbackReceipt
                ? `
                    <div class="pai-context-feedback-receipt pai-context-feedback-receipt--${escapeHtmlAttribute(positiveFeedbackReceipt.status)}" role="status">
                        ${escapeHtml(positiveFeedbackReceipt.message)}
                    </div>
                `
                : '';
            const feedbackHtml = isChangePresentation
                ? '<div class="pai-context-change-readonly" aria-label="变化脉络只读边界">链级只读</div>'
                : `
                    <div class="pai-context-feedback" aria-label="反馈">
                        <button type="button" class="pai-context-action-button pai-context-recall-positive" aria-label="${escapeHtmlAttribute(positiveFeedbackActionLabel)}" title="${escapeHtmlAttribute(positiveFeedbackActionLabel)}" ${isPositiveLocked ? 'disabled' : ''}>${CONTEXT_THUMB_UP_ICON_HTML}<span class="pai-sr-only">这条有用</span></button>
                        <button type="button" class="pai-context-action-button pai-context-recall-negative" aria-label="${escapeHtmlAttribute(negativeFeedbackActionLabel)}" title="${escapeHtmlAttribute(negativeFeedbackActionLabel)}" ${isPositiveLocked ? 'disabled' : ''}>${CONTEXT_THUMB_DOWN_ICON_HTML}<span class="pai-sr-only">不是这个意思</span></button>
                    </div>
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
                            ${view.exploreUrl ? `<a class="pai-context-icon-button pai-context-open-memory" href="${escapeHtmlAttribute(view.exploreUrl)}" target="_blank" rel="noopener" aria-label="${escapeHtmlAttribute(memoryDetailActionLabel)}" title="${escapeHtmlAttribute(memoryDetailActionLabel)}">↗<span class="pai-sr-only">在记忆中查看</span></a>` : ''}
                            <div class="pai-context-more-wrap">
                                <button type="button" class="pai-context-icon-button pai-context-more" aria-label="更多控制" title="更多控制" aria-haspopup="menu" aria-expanded="${String(moreMenuOpen)}">⋯</button>
                                <div class="pai-context-more-menu" role="menu" ${moreMenuOpen ? '' : 'hidden'}>
                                    ${moreMenuHtml}
                                </div>
                            </div>
                        </div>
                    </div>

                    ${briefBackHtml}
                    ${staleKeystoneNoticeHtml}
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
                    ${rehearsalReceiptHtml}
                    ${sourceMemoryReceiptHtml}
                    ${changeProjectionHtml}

                    <div class="pai-context-meta-row" aria-label="记忆来源摘要">
                        ${attributionChipHtml}
                        ${weaveChipHtml}
                        ${metaHtml}
                        ${sourceLinksHtml}
                        ${sourceStatusHtml}
                        ${sourceReceiptHtml}
                    </div>
                    ${sourceOpenReceiptHtml}
                </div>
                <div class="pai-context-footer-wrap">
                    <div class="pai-context-section-label pai-context-section-label--footer">${escapeHtml(view.copy.footerSectionLabel)}</div>
                    <div class="pai-context-footer">
                        ${actionBoundaryHtml}
                        ${feedbackHtml}
                        ${pagerHtml}
                    </div>
                    ${positiveFeedbackReceiptHtml}
                </div>
            `;
            updateAnchoredPanels();
        };

        const buildSourceOpenReceipt = (
            match: ContextRecallMatch,
            view: ReturnType<typeof buildMatchView>,
            kind: ContextSourceOpenReceipt['kind'],
            href: string,
            label: string,
        ): ContextSourceOpenReceipt => {
            let targetHost = '';
            try {
                targetHost = new URL(href).hostname;
            } catch (_error) {
                targetHost = '';
            }

            const detailStatus = view.sourceStatusReceipts.find((item) => /详情可复核/.test(item));
            const sourceStatus = view.sourceStatusReceipts.find(
                (item) => !/详情可复核|个人记忆已进入/.test(item),
            );
            const targetLabel = clipContextFeedbackDetailValue(
                label || targetHost || (kind === 'memory_detail' ? '记忆详情' : '原始来源'),
                90,
            );
            const reviewScope = kind === 'memory_detail'
                ? match.type === 'source_memory'
                    ? '打开资料详情，用于复核保存的资料 capsule、来源和撤销入口'
                    : '打开记忆详情，用于复核原始记忆、时间线和来源'
                : `打开原始来源${targetHost ? `（${targetHost}）` : ''}，用于核对卡片摘要`;

            return {
                matchId: match.id,
                kind,
                targetLabel,
                reviewScope,
                sourceStatus:
                    kind === 'memory_detail'
                        ? detailStatus || '记忆详情可复核'
                        : sourceStatus || '来源可复核',
                boundary: '只打开新标签；不写入记忆、不插入输入框、不发送内容、不确认事实',
            };
        };

        const recordSourceOpen = (
            match: ContextRecallMatch,
            kind: ContextSourceOpenReceipt['kind'],
            href: string,
            label: string,
        ): void => {
            const view = buildMatchView(match);
            sourceOpenReceipt = buildSourceOpenReceipt(match, view, kind, href, label);
            moreMenuOpen = false;
            actionBoundaryOpen = false;
            submitContextRecallAmbientTrace(
                match,
                contextKey,
                'opened_source',
                feedbackSurface,
            );
            window.setTimeout(() => {
                if (this.cardElement !== card) return;
                renderCard();
            }, 0);
        };

        const removeKeystoneBriefFromCurrentCache = (): void => {
            const cached = contextMatchCache.get(contextKey);
            if (!cached) return;
            cached.keystoneBrief = undefined;
            contextMatchCache.set(contextKey, cached);
        };

        const fallBackFromKeystoneBrief = (
            eventType: 'hidden' | 'not_accurate',
            reason: string,
        ): void => {
            const presentation = activeKeystoneBrief;
            if (!presentation) return;
            const briefId = presentation.brief.id;
            activeKeystoneBrief = undefined;
            briefRawCardOpen = false;
            briefEvidenceOpen = false;
            briefFeedbackReceipt = null;
            moreMenuOpen = false;
            removeKeystoneBriefFromCurrentCache();
            renderPeek();
            renderCard();
            submitKeystoneBriefUiEvent(
                briefId,
                eventType,
                contextKey,
                (success, error) => {
                    if (success) return;
                    this.showContextToast(
                        keystoneEnglish
                            ? 'Switched to original memories, but brief feedback could not be saved'
                            : '已切换到原始记忆，但简报反馈写入失败',
                        undefined,
                        { detailMessage: clipContextFeedbackDetailValue(error || (keystoneEnglish ? 'Try again later' : '请稍后重试'), 100) },
                    );
                },
                reason,
            );
        };

        const copyKeystoneSummary = async (text: string): Promise<void> => {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(text);
                return;
            }
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            const copied = document.execCommand('copy');
            textarea.remove();
            if (!copied) throw new Error('clipboard_unavailable');
        };

        renderPeek();
        renderCard();

        let expanded = false;
        let expandedTraceRecordedForMatchId: string | null = null;
        const setPeekVisible = (visible: boolean): void => {
            if (expanded) {
                visible = false;
            }
            peek.classList.toggle('pai-context-peek--visible', visible);
            peek.setAttribute('aria-hidden', String(!visible));
            updateAnchoredPanels();
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
            const wasExpanded = expanded;
            expanded = nextExpanded;
            moreMenuOpen = false;
            actionBoundaryOpen = false;
            if (!expanded) {
                this.clearContextFeedbackDrawer();
                negativeFeedbackMatchId = null;
                negativeFeedbackNoteExpanded = false;
                negativeFeedbackNote = '';
                briefRawCardOpen = false;
                briefEvidenceOpen = false;
            }
            renderCard();
            setPeekVisible(false);
            card.style.display = expanded ? 'flex' : 'none';
            card.setAttribute('aria-hidden', String(!expanded));
            bubble.setAttribute('aria-expanded', String(expanded));
            updateAnchoredPanels();
            if (!wasExpanded && expanded) {
                if (activeKeystoneBrief && !briefOpenedEventRecorded) {
                    briefOpenedEventRecorded = true;
                    submitKeystoneBriefUiEvent(
                        activeKeystoneBrief.brief.id,
                        'opened',
                        contextKey,
                    );
                }
                const currentMatch = matches[currentIndex];
                if (
                    currentMatch &&
                    (!hasPrimaryKeystoneBrief() || briefRawCardOpen) &&
                    expandedTraceRecordedForMatchId !== currentMatch.id
                ) {
                    expandedTraceRecordedForMatchId = currentMatch.id;
                    submitContextRecallAmbientTrace(
                        currentMatch,
                        contextKey,
                        'expanded',
                        feedbackSurface,
                    );
                }
            }
        };

        const finishBubbleDrag = (): void => {
            if (!bubbleDragState) {
                return;
            }
            const { pointerId, moved, previousBodyUserSelect } = bubbleDragState;
            if (bubble.hasPointerCapture(pointerId)) {
                bubble.releasePointerCapture(pointerId);
            }
            document.body.style.userSelect = previousBodyUserSelect;
            bubble.classList.remove('pai-context-bubble--dragging');
            bubbleDragState = null;
            if (moved) {
                suppressNextBubbleClick = true;
                schedulePeekVisible(false, 0);
                window.setTimeout(() => {
                    suppressNextBubbleClick = false;
                }, 250);
            }
        };

        if (!isSelectionSearch) {
            bubble.addEventListener('pointerdown', (event) => {
                if (event.button !== 0) {
                    return;
                }
                const rect = bubble.getBoundingClientRect();
                bubbleDragState = {
                    pointerId: event.pointerId,
                    startClientX: event.clientX,
                    startClientY: event.clientY,
                    startLeft: rect.left,
                    startTop: rect.top,
                    moved: false,
                    previousBodyUserSelect: document.body.style.userSelect,
                };
                bubble.setPointerCapture(event.pointerId);
            });

            bubble.addEventListener('pointermove', (event) => {
                if (!bubbleDragState || bubbleDragState.pointerId !== event.pointerId) {
                    return;
                }
                const deltaX = event.clientX - bubbleDragState.startClientX;
                const deltaY = event.clientY - bubbleDragState.startClientY;
                if (
                    !bubbleDragState.moved &&
                    Math.hypot(deltaX, deltaY) < dragThresholdPx
                ) {
                    return;
                }
                if (!bubbleDragState.moved) {
                    bubbleDragState.moved = true;
                    document.body.style.userSelect = 'none';
                    bubble.classList.add('pai-context-bubble--dragging');
                    schedulePeekVisible(false, 0);
                }
                event.preventDefault();
                setDraggedBubblePosition(
                    bubbleDragState.startLeft + deltaX,
                    bubbleDragState.startTop + deltaY,
                );
            });

            bubble.addEventListener('pointerup', (event) => {
                if (!bubbleDragState || bubbleDragState.pointerId !== event.pointerId) {
                    return;
                }
                finishBubbleDrag();
            });

            bubble.addEventListener('pointercancel', (event) => {
                if (!bubbleDragState || bubbleDragState.pointerId !== event.pointerId) {
                    return;
                }
                finishBubbleDrag();
            });
        }

        bubble.addEventListener('click', (event) => {
            event.stopPropagation();
            if (suppressNextBubbleClick) {
                event.preventDefault();
                suppressNextBubbleClick = false;
                return;
            }
            setExpanded(!expanded);
        });

        bubble.setAttribute('role', 'button');
        bubble.setAttribute('aria-expanded', 'false');
        bubble.setAttribute('aria-controls', card.id);
        bubble.setAttribute('aria-haspopup', 'dialog');
        bubble.tabIndex = 0;
        updateBubbleRestReceipt();
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

            if (target.closest('.pai-keystone-evidence-toggle')) {
                event.preventDefault();
                const wasOpen = briefEvidenceOpen;
                briefEvidenceOpen = !briefEvidenceOpen;
                moreMenuOpen = false;
                renderCard();
                card.querySelector<HTMLButtonElement>('.pai-keystone-evidence-toggle')?.focus();
                if (!wasOpen && activeKeystoneBrief) {
                    submitKeystoneBriefUiEvent(
                        activeKeystoneBrief.brief.id,
                        'evidence_opened',
                        contextKey,
                    );
                }
                return;
            }

            const keystoneEvidenceItem = target.closest<HTMLButtonElement>('.pai-keystone-evidence-item');
            if (keystoneEvidenceItem) {
                event.preventDefault();
                const index = Number.parseInt(
                    keystoneEvidenceItem.dataset.keystoneEvidenceIndex || '',
                    10,
                );
                if (Number.isFinite(index) && index >= 0 && index < matches.length) {
                    currentIndex = index;
                    briefRawCardOpen = true;
                    moreMenuOpen = false;
                    renderCard();
                    card.querySelector<HTMLButtonElement>('.pai-keystone-back')?.focus();
                }
                return;
            }

            if (target.closest('.pai-keystone-back')) {
                event.preventDefault();
                briefRawCardOpen = false;
                moreMenuOpen = false;
                renderCard();
                card.querySelector<HTMLButtonElement>('.pai-keystone-evidence-toggle')?.focus();
                return;
            }

            if (target.closest('.pai-keystone-copy')) {
                event.preventDefault();
                const presentation = activeKeystoneBrief;
                if (!presentation || !presentation.brief.displayPolicy.canCopyToDraft) return;
                briefFeedbackReceipt = {
                    status: 'pending',
                    message: keystoneEnglish
                        ? 'Copying the redacted summary; nothing will be sent automatically.'
                        : '正在复制脱敏摘要；不会自动发送。',
                };
                renderCard();
                void copyKeystoneSummary(
                    presentation.brief.externalSummary || presentation.brief.summary,
                ).then(() => {
                    briefFeedbackReceipt = {
                        status: 'confirmed',
                        message: keystoneEnglish
                            ? `Redacted summary copied; ${presentation.brief.displayPolicy.hiddenSourceCount} local-only source${presentation.brief.displayPolicy.hiddenSourceCount === 1 ? '' : 's'} excluded.`
                            : `已复制脱敏摘要；${presentation.brief.displayPolicy.hiddenSourceCount} 条仅本机来源未进入摘要。`,
                    };
                    submitKeystoneBriefUiEvent(
                        presentation.brief.id,
                        'copied',
                        contextKey,
                    );
                    renderCard();
                }).catch((error) => {
                    briefFeedbackReceipt = {
                        status: 'failed',
                        message: `${keystoneEnglish ? 'Copy failed' : '复制失败'}：${clipContextFeedbackDetailValue(String(error?.message || error), 80)}`,
                    };
                    renderCard();
                });
                return;
            }

            if (target.closest('.pai-keystone-useful')) {
                event.preventDefault();
                const presentation = activeKeystoneBrief;
                if (!presentation || briefFeedbackReceipt?.status === 'pending') return;
                briefFeedbackReceipt = {
                    status: 'pending',
                    message: keystoneEnglish
                        ? 'Recording useful feedback; it is not treated as learned until the service confirms it.'
                        : '正在记录简报有用反馈；服务确认前不会当作已学习。',
                };
                renderCard();
                submitKeystoneBriefUiEvent(
                    presentation.brief.id,
                    'useful',
                    contextKey,
                    (success, error) => {
                        briefFeedbackReceipt = success
                            ? {
                                status: 'confirmed',
                                message: keystoneEnglish
                                    ? 'Useful feedback confirmed; original memories were not modified.'
                                    : '简报有用反馈已确认写入；原始记忆未被修改。',
                            }
                            : {
                                status: 'failed',
                                message: `${keystoneEnglish ? 'Feedback write failed' : '反馈写入失败'}：${clipContextFeedbackDetailValue(error || (keystoneEnglish ? 'Try again later' : '请稍后重试'), 80)}`,
                            };
                        renderCard();
                    },
                );
                return;
            }

            if (target.closest('.pai-keystone-inaccurate')) {
                event.preventDefault();
                fallBackFromKeystoneBrief('not_accurate', 'user_reported_inaccurate');
                return;
            }

            if (target.closest('.pai-keystone-hide')) {
                event.preventDefault();
                fallBackFromKeystoneBrief('hidden', 'user_hidden_from_memory_lens');
                return;
            }

            if (target.closest('.pai-context-more')) {
                event.preventDefault();
                negativeFeedbackMatchId = null;
                negativeFeedbackNoteExpanded = false;
                negativeFeedbackNote = '';
                actionBoundaryOpen = false;
                moreMenuOpen = !moreMenuOpen;
                renderCard();
                card.querySelector<HTMLButtonElement>('.pai-context-more')?.focus();
                return;
            }

            if (target.closest('.pai-context-action-boundary-button')) {
                event.preventDefault();
                moreMenuOpen = false;
                actionBoundaryOpen = !actionBoundaryOpen;
                renderCard();
                card.querySelector<HTMLButtonElement>('.pai-context-action-boundary-button')?.focus();
                return;
            }

            const sourceLink = target.closest<HTMLAnchorElement>('.pai-context-source-link');
            if (sourceLink) {
                const currentMatch = matches[currentIndex];
                recordSourceOpen(
                    currentMatch,
                    'original_source',
                    sourceLink.href,
                    sourceLink.textContent || sourceLink.getAttribute('aria-label') || '原始来源',
                );
                return;
            }

            const memoryDetailLink = target.closest<HTMLAnchorElement>('.pai-context-open-memory');
            if (memoryDetailLink) {
                const currentMatch = matches[currentIndex];
                recordSourceOpen(
                    currentMatch,
                    'memory_detail',
                    memoryDetailLink.href,
                    currentMatch.type === 'source_memory' ? '资料详情' : '记忆详情',
                );
                return;
            }

            if (target.closest('.pai-context-prev')) {
                event.preventDefault();
                if (currentIndex > 0) {
                    currentIndex -= 1;
                    moreMenuOpen = false;
                    actionBoundaryOpen = false;
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
                    actionBoundaryOpen = false;
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
                const previousFeedbackReceipt = positiveFeedbackReceipts.get(currentMatch.id);
                positiveFeedbackReceipts.set(currentMatch.id, {
                    status: 'pending',
                    message: isContextRehearsalMatch(currentMatch)
                        ? '正在记录预演有用反馈；确认前不会当作已学习。'
                        : '正在记录有用反馈；确认前不会当作已学习。',
                });
                moreMenuOpen = false;
                actionBoundaryOpen = false;
                this.clearContextFeedbackDrawer();
                negativeFeedbackMatchId = null;
                negativeFeedbackNoteExpanded = false;
                negativeFeedbackNote = '';
                renderCard();
                this.markContextMatchRelevant(currentMatch, contextKey, (success, error) => {
                    if (success) {
                        positiveFeedbackReceipts.set(currentMatch.id, {
                            status: 'confirmed',
                            message: isContextRehearsalMatch(currentMatch)
                                ? '有用反馈已确认写入；后续类似预演会优先保留。'
                                : '有用反馈已确认写入；后续类似提示会优先保留。',
                        });
                    } else {
                        const failureReason = clipContextFeedbackDetailValue(error || '请稍后重试', 80);
                        const failureMessage = `反馈写入失败：${failureReason}；本次没有学习成功。`;
                        if (previousFeedbackReceipt) {
                            positiveFeedbackReceipts.set(currentMatch.id, previousFeedbackReceipt);
                        } else {
                            positiveFeedbackReceipts.set(currentMatch.id, {
                                status: 'failed',
                                message: failureMessage,
                            });
                        }
                    }
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
                actionBoundaryOpen = false;
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
            if (actionBoundaryOpen) {
                actionBoundaryOpen = false;
                renderCard();
                card.focus();
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

        if (activeKeystoneBrief && !briefShownEventRecorded) {
            briefShownEventRecorded = true;
            submitKeystoneBriefUiEvent(
                activeKeystoneBrief.brief.id,
                'shown',
                contextKey,
            );
        }

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

const PERSONAL_AI_AR_BINDINGS_KEY = 'personalAiArBindings';
const PERSONAL_AI_AR_SESSION_DISABLED_KEY = 'personalAiArDisabledForPage';
const PERSONAL_AI_AR_SESSION_HIDDEN_BINDING_KEY = 'personalAiArHiddenBindingForPage';
const PERSONAL_AI_AR_TOGGLE_DEFAULT_RIGHT = 100;
const PERSONAL_AI_AR_TOGGLE_EDGE_MARGIN = 8;
const PERSONAL_AI_AR_RUNTIME_VERSION = 'ar-execute-v1';
const PERSONAL_AI_AR_TRANSIENT_CLASS_NAMES = new Set([
    'active',
    'expanded',
    'focus',
    'focused',
    'hover',
    'hovered',
    'open',
    'selected',
    'show',
    'shown',
    'visible',
]);

interface PersonalAiArBinding {
    id: string;
    urlPattern: string;
    selector: string;
    tagName: string;
    sectionLabel: string;
    nearbyText: string;
    oldValue: string;
    displayMode: 'dom_text' | 'visual_overlay';
    linkedAgentTaskId?: string;
    lastResult?: {
        text: string;
        updatedAt: string;
    };
    lastRunStatus?: string;
    lastRunError?: string;
    lastRunAt?: string;
    agentTaskPrompt?: string;
    notifyTemplate?: string;
}

interface PersonalAiArAppliedBinding {
    element: Element;
    originalText: string;
    badge: HTMLDivElement;
    overlay?: HTMLDivElement;
    displayMode: PersonalAiArBinding['displayMode'];
    binding: PersonalAiArBinding;
}

let personalAiArContextTarget: Element | null = null;
let personalAiArToggle: HTMLButtonElement | null = null;
let personalAiArToggleLeftPx: number | null = null;
let personalAiArToggleDragging = false;
let personalAiArToggleMoved = false;
let personalAiArToggleDragStartX = 0;
let personalAiArToggleDragStartLeft = 0;
const PERSONAL_AI_AR_TOGGLE_DRAG_THRESHOLD = 6;
let personalAiArApplyScheduled = false;
let personalAiArPageBindingLogged = false;
const personalAiArAppliedBindings = new Map<string, PersonalAiArAppliedBinding>();
const personalAiArLoadingBindingIds = new Set<string>();
const personalAiArAutoRefreshRequestedIds = new Set<string>();

function normalizePersonalAiArUrl(value: string): string {
    try {
        const url = new URL(value);
        url.hash = '';
        url.search = '';
        return url.href;
    } catch {
        return value.split(/[?#]/)[0];
    }
}

function getPersonalAiArPageKey(): string {
    return normalizePersonalAiArUrl(window.location.href);
}

function isPersonalAiArEnabledForPage(): boolean {
    return sessionStorage.getItem(`${PERSONAL_AI_AR_SESSION_DISABLED_KEY}:${getPersonalAiArPageKey()}`) !== 'true';
}

function setPersonalAiArEnabledForPage(enabled: boolean): void {
    const key = `${PERSONAL_AI_AR_SESSION_DISABLED_KEY}:${getPersonalAiArPageKey()}`;
    if (enabled) {
        sessionStorage.removeItem(key);
    } else {
        sessionStorage.setItem(key, 'true');
    }
}

function getPersonalAiArSessionHiddenBindingKey(bindingId: string): string {
    return `${PERSONAL_AI_AR_SESSION_HIDDEN_BINDING_KEY}:${getPersonalAiArPageKey()}:${bindingId}`;
}

function isPersonalAiArBindingHiddenForPage(binding: PersonalAiArBinding): boolean {
    return sessionStorage.getItem(getPersonalAiArSessionHiddenBindingKey(binding.id)) === 'true';
}

function setPersonalAiArBindingHiddenForPage(bindingId: string, hidden: boolean): void {
    const key = getPersonalAiArSessionHiddenBindingKey(bindingId);
    if (hidden) {
        sessionStorage.setItem(key, 'true');
    } else {
        sessionStorage.removeItem(key);
    }
}

function escapePersonalAiArSelectorPart(value: string): string {
    const cssEscape = window.CSS?.escape;
    return cssEscape ? cssEscape(value) : value.replace(/([^\w-])/g, '\\$1');
}

function isPersonalAiArTransientClassName(className: string): boolean {
    return PERSONAL_AI_AR_TRANSIENT_CLASS_NAMES.has(className.toLowerCase());
}

function stripPersonalAiArTransientSelectorClasses(selector: string): string {
    let normalized = selector;
    PERSONAL_AI_AR_TRANSIENT_CLASS_NAMES.forEach((className) => {
        const escaped = className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        normalized = normalized.replace(
            new RegExp(`\\.${escaped}(?=\\.|#|:|\\[|\\s|>|\\+|~|$)`, 'g'),
            '',
        );
    });
    return normalized.replace(/\s+/g, ' ').trim();
}

function getPersonalAiArBindingTargetKey(binding: PersonalAiArBinding): string {
    return `${normalizePersonalAiArUrl(binding.urlPattern)}::${stripPersonalAiArTransientSelectorClasses(binding.selector)}`;
}

function getPersonalAiArBindingUpdatedAtMs(binding: PersonalAiArBinding, fallback: number): number {
    const parsed = Date.parse(binding.lastResult?.updatedAt || '');
    return Number.isFinite(parsed) ? parsed : fallback;
}

function getPersonalAiArLocalDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function isPersonalAiArResultFromToday(binding: PersonalAiArBinding): boolean {
    const timestamp = Date.parse(binding.lastResult?.updatedAt || '');
    if (!Number.isFinite(timestamp)) {
        return false;
    }
    return getPersonalAiArLocalDateKey(new Date(timestamp)) === getPersonalAiArLocalDateKey(new Date());
}

type PersonalAiArResultState = 'current' | 'stale' | 'loading' | 'failed';

function clipPersonalAiArStatusText(value: string, maxLength = 72): string {
    const normalized = value.replace(/\s+/g, ' ').trim();
    return normalized.length <= maxLength ? normalized : `${normalized.slice(0, maxLength - 1).trim()}...`;
}

function getPersonalAiArResultState(binding: PersonalAiArBinding): PersonalAiArResultState {
    if (personalAiArLoadingBindingIds.has(binding.id)) {
        return 'loading';
    }
    if (binding.lastRunStatus === 'failed') {
        return 'failed';
    }
    return isPersonalAiArResultFromToday(binding) ? 'current' : 'stale';
}

function buildPersonalAiArStatusChipLabel(binding: PersonalAiArBinding): string {
    const state = getPersonalAiArResultState(binding);
    if (state === 'loading') return '刷新中';
    if (state === 'failed') return '失败';
    if (state === 'stale') return '旧';
    return '';
}

function buildPersonalAiArResultBasisText(binding: PersonalAiArBinding): string {
    const state = getPersonalAiArResultState(binding);
    if (state === 'loading') {
        return '历史结果 · 正在刷新；完成前不是当前事实';
    }
    if (state === 'failed') {
        const reason = clipPersonalAiArStatusText(binding.lastRunError || '未返回可替换文本');
        return `刷新失败 · 仍显示历史结果：${reason}`;
    }
    if (state === 'stale') {
        return '历史结果 · 今日未确认；不是当前页面事实';
    }
    return '今日结果 · 只替换本页展示，不写回原网页';
}

function buildPersonalAiArToggleBoundaryLabel(enabled: boolean): string {
    return enabled
        ? 'AR ON：点击只关闭本页 AR 展示并还原当前 DOM；不删除 binding、不暂停重复 AgentTask、不清历史结果。拖动只改变按钮横向位置。'
        : 'AR OFF：点击只重新应用本页 AR binding；不创建新 binding、不刷新 AgentTask、不写回原网页。拖动只改变按钮横向位置。';
}

function buildPersonalAiArEditBoundaryLabel(binding: PersonalAiArBinding): string {
    const repeatDetail = binding.linkedAgentTaskId
        ? `；当前绑定 AgentTask ${binding.linkedAgentTaskId}，只有保存编辑器里的取消重复才会暂停它`
        : '；当前没有绑定重复 AgentTask';
    return `编辑 AR 数据：只打开当前 binding 的编辑器，不会立即保存、刷新、删除、暂停任务或改写原网页${repeatDetail}。`;
}

function buildPersonalAiArRefreshBoundaryLabel(binding: PersonalAiArBinding): string {
    if (!binding.agentTaskPrompt?.trim()) {
        return '刷新 AR 数据不可用：当前 binding 没有 Agent 任务描述；点击不会发送请求、删除 binding 或改写原网页。';
    }
    return '刷新 AR 数据：请求 Memory Service / OpenClaw 更新这个 binding；完成前继续显示历史结果，不删除 binding、不暂停重复 AgentTask、不写回原网页。';
}

function buildPersonalAiArHideBoundaryLabel(binding: PersonalAiArBinding): string {
    const repeatDetail = binding.linkedAgentTaskId
        ? `，也不会暂停 AgentTask ${binding.linkedAgentTaskId}`
        : '';
    return `隐藏本页 AR 展示：只恢复当前页面会话并保留 binding、历史结果${repeatDetail}；要取消重复执行请打开编辑器并保存取消重复。`;
}

function getPersonalAiArStatusChipStyle(binding: PersonalAiArBinding): string {
    const state = getPersonalAiArResultState(binding);
    const palette = state === 'loading'
        ? { bg: '#f59e0b', color: '#422006' }
        : state === 'failed'
            ? { bg: '#dc2626', color: '#ffffff' }
            : { bg: '#facc15', color: '#422006' };
    return [
        'display:inline-flex',
        'align-items:center',
        'height:14px',
        'border-radius:999px',
        'padding:0 4px',
        `background:${palette.bg}`,
        `color:${palette.color}`,
        'font-size:9px',
        'font-weight:800',
        'letter-spacing:0',
        'white-space:nowrap',
    ].join(';');
}

function updatePersonalAiArBadgeStatus(badge: HTMLDivElement, binding: PersonalAiArBinding): void {
    const chip = badge.querySelector<HTMLElement>('[data-pai-ar-status-chip="true"]');
    if (!chip) return;

    const label = buildPersonalAiArStatusChipLabel(binding);
    chip.textContent = label;
    chip.title = buildPersonalAiArResultBasisText(binding);
    chip.style.cssText = label ? getPersonalAiArStatusChipStyle(binding) : 'display:none';
}

function updatePersonalAiArVisualOverlayBasis(overlay: HTMLDivElement, binding: PersonalAiArBinding): void {
    const basis = overlay.querySelector<HTMLElement>('[data-pai-ar-result-basis="true"]');
    if (basis) {
        basis.textContent = buildPersonalAiArResultBasisText(binding);
    }
    updatePersonalAiArVisualOverlayAccessibility(overlay, binding);
}

function updatePersonalAiArVisualOverlayAccessibility(overlay: HTMLDivElement, binding: PersonalAiArBinding): void {
    const value = binding.lastResult?.text?.trim() || '无展示结果';
    overlay.setAttribute('role', 'status');
    overlay.setAttribute(
        'aria-label',
        `Personal AI AR 视觉叠加：${value}。${buildPersonalAiArResultBasisText(binding)}。不改写原页面媒体。`,
    );
}

function updatePersonalAiArAppliedPresentation(bindingId: string): void {
    const applied = personalAiArAppliedBindings.get(bindingId);
    if (!applied) return;

    updatePersonalAiArBadgeStatus(applied.badge, applied.binding);
    if (applied.overlay) {
        updatePersonalAiArVisualOverlayBasis(applied.overlay, applied.binding);
    }
}

function dedupePersonalAiArBindings(bindings: PersonalAiArBinding[]): PersonalAiArBinding[] {
    const byTarget = new Map<string, { binding: PersonalAiArBinding; index: number; updatedAt: number }>();
    bindings.forEach((binding, index) => {
        if (!binding || !binding.id || !binding.urlPattern || !binding.selector) {
            return;
        }
        const key = getPersonalAiArBindingTargetKey(binding);
        const updatedAt = getPersonalAiArBindingUpdatedAtMs(binding, index);
        const existing = byTarget.get(key);
        if (!existing || updatedAt >= existing.updatedAt || index > existing.index) {
            byTarget.set(key, { binding, index, updatedAt });
        }
    });
    return Array.from(byTarget.values())
        .sort((a, b) => a.index - b.index)
        .map(item => item.binding);
}

function buildPersonalAiArSelector(element: Element): string {
    if (element.id) {
        return `#${escapePersonalAiArSelectorPart(element.id)}`;
    }

    const parts: string[] = [];
    let current: Element | null = element;
    while (current && current !== document.body && parts.length < 6) {
        const tag = current.tagName.toLowerCase();
        const stableAttr =
            current.getAttribute('data-testid') ||
            current.getAttribute('data-id') ||
            current.getAttribute('aria-label');
        if (stableAttr) {
            parts.unshift(`${tag}[${stableAttr === current.getAttribute('aria-label') ? 'aria-label' : stableAttr === current.getAttribute('data-id') ? 'data-id' : 'data-testid'}="${stableAttr.replace(/"/g, '\\"')}"]`);
            break;
        }

        const parent = current.parentElement;
        if (!parent) {
            parts.unshift(tag);
            break;
        }

        const sameTagSiblings = Array.from(parent.children).filter(child => child.tagName === current!.tagName);
        const nth = sameTagSiblings.length > 1
            ? `:nth-of-type(${sameTagSiblings.indexOf(current) + 1})`
            : '';
        const stableClasses = Array.from(current.classList)
            .filter(className => !isPersonalAiArTransientClassName(className))
            .slice(0, 2);
        const className = stableClasses.length > 0
            ? `.${stableClasses.map(escapePersonalAiArSelectorPart).join('.')}`
            : '';
        parts.unshift(`${tag}${className}${nth}`);
        current = parent;
    }

    return parts.join(' > ');
}

function getPersonalAiArElementText(element: Element): string {
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
        return element.value.trim();
    }
    return (element.textContent || '').replace(/\s+/g, ' ').trim();
}

function getPersonalAiArNearbyText(element: Element): string {
    const parts: string[] = [];
    let current: Element | null = element;
    for (let depth = 0; current && depth < 3; depth += 1) {
        const text = getPersonalAiArElementText(current);
        if (text) parts.push(text);
        current = current.parentElement;
    }
    return Array.from(new Set(parts)).join(' | ').slice(0, 500);
}

function isPersonalAiArDomTextReplaceable(element: Element): boolean {
    const tag = element.tagName.toLowerCase();
    if (['img', 'canvas', 'video', 'svg', 'picture'].includes(tag)) {
        return false;
    }
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
        return true;
    }
    return getPersonalAiArElementText(element).length <= 500;
}

async function readPersonalAiArBindings(): Promise<PersonalAiArBinding[]> {
    const stored = await chrome.storage.local.get([PERSONAL_AI_AR_BINDINGS_KEY]);
    const raw = stored[PERSONAL_AI_AR_BINDINGS_KEY];
    return Array.isArray(raw) ? raw : [];
}

async function writePersonalAiArBindings(bindings: PersonalAiArBinding[]): Promise<void> {
    await chrome.storage.local.set({ [PERSONAL_AI_AR_BINDINGS_KEY]: dedupePersonalAiArBindings(bindings) });
}

interface PersonalAiArExecutionRequestOptions {
    triggerSource?: 'ar_manual' | 'ar_auto_page_open';
    autoRefreshDate?: string;
}

function updatePersonalAiArBadgeLoading(bindingId: string): void {
    const applied = personalAiArAppliedBindings.get(bindingId);
    const badge = applied?.badge;
    if (!badge) return;

    const loading = badge.querySelector<HTMLElement>('[data-pai-ar-loading="true"]');
    if (!loading) return;

    loading.style.display = personalAiArLoadingBindingIds.has(bindingId) ? 'inline-block' : 'none';
}

function setPersonalAiArBindingLoading(bindingId: string, loading: boolean): void {
    if (loading) {
        personalAiArLoadingBindingIds.add(bindingId);
    } else {
        personalAiArLoadingBindingIds.delete(bindingId);
    }
    updatePersonalAiArBadgeLoading(bindingId);
    updatePersonalAiArAppliedPresentation(bindingId);
}

function requestPersonalAiArExecution(
    binding: PersonalAiArBinding,
    options: PersonalAiArExecutionRequestOptions = {},
): void {
    if (!binding.agentTaskPrompt?.trim()) {
        return;
    }

    const triggerSource = options.triggerSource || 'ar_manual';
    setPersonalAiArBindingLoading(binding.id, true);
    console.info('[Personal AI AR] request execution', {
        id: binding.id,
        urlPattern: binding.urlPattern,
        selector: binding.selector,
        triggerSource,
    });

    void chrome.runtime.sendMessage({
        type: 'EXECUTE_PERSONAL_AI_AR_BINDING',
        data: {
            arBindingId: binding.id,
            title: binding.sectionLabel || binding.oldValue || 'AR 数据更新',
            agentTaskPrompt: binding.agentTaskPrompt,
            notifyTemplate: binding.notifyTemplate || '',
            urlPattern: binding.urlPattern,
            selector: binding.selector,
            oldValue: binding.oldValue,
            nearbyText: binding.nearbyText,
            sectionLabel: binding.sectionLabel,
            lastResultText: binding.lastResult?.text || '',
            triggerSource,
            autoRefreshDate: options.autoRefreshDate,
        },
    }).then((response) => {
        if (response?.success === true) {
            console.info('[Personal AI AR] execution completed', {
                id: binding.id,
                replacementText: response.replacementText,
                queueStatus: response.response?.queueStatus,
            });
            if (response.replacementText && isPersonalAiArEnabledForPage()) {
                applyPersonalAiArBinding({
                    ...binding,
                    lastResult: {
                        text: response.replacementText,
                        updatedAt: new Date().toISOString(),
                    },
                    lastRunStatus: response.response?.queueStatus || 'succeeded',
                });
            }
            return;
        }
        if (response && response.success === false) {
            console.warn('AR 数据执行失败:', response.error || response);
        }
    }).catch((error) => {
        console.warn('AR 数据执行请求失败:', error);
    }).finally(() => {
        setPersonalAiArBindingLoading(binding.id, false);
    });
}

function matchesPersonalAiArBindingCurrentPage(binding: PersonalAiArBinding): boolean {
    const currentPageKey = getPersonalAiArPageKey();
    const bindingPageKey = normalizePersonalAiArUrl(binding.urlPattern);
    if (!bindingPageKey) {
        return false;
    }
    return bindingPageKey === currentPageKey || currentPageKey.startsWith(bindingPageKey);
}

function queryPersonalAiArSelector(selector: string): Element | null {
    if (!selector) return null;
    try {
        return document.querySelector(selector);
    } catch {
        return null;
    }
}

function findPersonalAiArBindingElement(binding: PersonalAiArBinding): Element | null {
    return queryPersonalAiArSelector(binding.selector) ||
        queryPersonalAiArSelector(stripPersonalAiArTransientSelectorClasses(binding.selector));
}

function restorePersonalAiArBinding(bindingId: string): void {
    const applied = personalAiArAppliedBindings.get(bindingId);
    if (!applied) return;

    if (applied.displayMode === 'dom_text') {
        if (applied.element instanceof HTMLInputElement || applied.element instanceof HTMLTextAreaElement) {
            applied.element.value = applied.originalText;
        } else {
            applied.element.textContent = applied.originalText;
        }
    }
    applied.overlay?.remove();
    applied.badge.remove();
    personalAiArAppliedBindings.delete(bindingId);
}

function restoreAllPersonalAiArBindings(): void {
    Array.from(personalAiArAppliedBindings.keys()).forEach(restorePersonalAiArBinding);
}

function removePersonalAiArToggle(): void {
    personalAiArToggle?.remove();
    personalAiArToggle = null;
}

function clampPersonalAiArToggleLeft(left: number): number {
    const width = personalAiArToggle?.offsetWidth || 90;
    const maxLeft = Math.max(
        PERSONAL_AI_AR_TOGGLE_EDGE_MARGIN,
        window.innerWidth - width - PERSONAL_AI_AR_TOGGLE_EDGE_MARGIN,
    );
    return Math.min(Math.max(PERSONAL_AI_AR_TOGGLE_EDGE_MARGIN, left), maxLeft);
}

function positionPersonalAiArToggle(): void {
    if (!personalAiArToggle) return;

    if (personalAiArToggleLeftPx === null) {
        personalAiArToggleLeftPx = window.innerWidth
            - personalAiArToggle.offsetWidth
            - PERSONAL_AI_AR_TOGGLE_DEFAULT_RIGHT;
    }
    personalAiArToggleLeftPx = clampPersonalAiArToggleLeft(personalAiArToggleLeftPx);
    personalAiArToggle.style.left = `${personalAiArToggleLeftPx}px`;
}

function togglePersonalAiArForPage(): void {
    const nextEnabled = !isPersonalAiArEnabledForPage();
    setPersonalAiArEnabledForPage(nextEnabled);
    createOrUpdatePersonalAiArToggle();
    if (nextEnabled) {
        void applyPersonalAiArBindings();
    } else {
        restoreAllPersonalAiArBindings();
    }
}

function positionPersonalAiArBadge(badge: HTMLDivElement, element: Element): void {
    const rect = element.getBoundingClientRect();
    badge.style.top = `${Math.max(8, rect.top + window.scrollY - 10)}px`;
    badge.style.left = `${Math.max(8, rect.right + window.scrollX - 18)}px`;
}

function positionPersonalAiArVisualOverlay(overlay: HTMLDivElement, element: Element): void {
    const rect = element.getBoundingClientRect();
    const minWidth = 140;
    const maxWidth = Math.min(360, Math.max(minWidth, window.innerWidth - 16));
    const targetWidth = Math.max(minWidth, Math.min(maxWidth, rect.width - 12 || minWidth));
    const left = Math.min(
        Math.max(8, rect.left + window.scrollX + 8),
        Math.max(8, window.scrollX + window.innerWidth - targetWidth - 8),
    );
    const top = Math.max(8, rect.top + window.scrollY + 8);
    overlay.style.width = `${targetWidth}px`;
    overlay.style.left = `${left}px`;
    overlay.style.top = `${top}px`;
}

function updatePersonalAiArVisualOverlayText(overlay: HTMLDivElement, replacementText: string): void {
    const value = overlay.querySelector<HTMLElement>('[data-pai-ar-visual-value="true"]');
    if (value) {
        value.textContent = replacementText;
    }
}

function createPersonalAiArVisualOverlay(
    binding: PersonalAiArBinding,
    element: Element,
    replacementText: string,
): HTMLDivElement {
    const overlay = document.createElement('div');
    overlay.className = 'pai-ar-data-visual-overlay';
    overlay.dataset.paiArVisualOverlay = 'true';
    overlay.dataset.paiArBindingId = binding.id;
    overlay.style.cssText = [
        'position:absolute',
        'z-index:2147483645',
        'box-sizing:border-box',
        'display:flex',
        'flex-direction:column',
        'gap:3px',
        'padding:7px 9px',
        'border:1px solid rgba(34,197,94,0.55)',
        'border-radius:6px',
        'background:rgba(240,253,244,0.96)',
        'box-shadow:0 8px 24px rgba(15,23,42,0.16)',
        'color:#14532d',
        'font:12px/1.35 -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif',
        'letter-spacing:0',
        'pointer-events:none',
        'overflow-wrap:anywhere',
    ].join(';');

    const label = document.createElement('div');
    label.textContent = 'Personal AI AR';
    label.style.cssText = [
        'font-size:10px',
        'font-weight:800',
        'text-transform:uppercase',
        'color:#166534',
        'opacity:0.82',
    ].join(';');
    overlay.appendChild(label);

    const value = document.createElement('div');
    value.dataset.paiArVisualValue = 'true';
    value.textContent = replacementText;
    value.style.cssText = 'font-size:13px;font-weight:750;color:#052e16';
    overlay.appendChild(value);

    const boundary = document.createElement('div');
    boundary.textContent = '视觉叠加，不改写原页面媒体';
    boundary.style.cssText = 'font-size:10.5px;color:#3f6212';

    const basis = document.createElement('div');
    basis.dataset.paiArResultBasis = 'true';
    basis.textContent = buildPersonalAiArResultBasisText(binding);
    basis.style.cssText = 'font-size:10.5px;color:#166534;font-weight:650';
    overlay.appendChild(basis);

    overlay.appendChild(boundary);

    document.body.appendChild(overlay);
    updatePersonalAiArVisualOverlayAccessibility(overlay, binding);
    positionPersonalAiArVisualOverlay(overlay, element);
    return overlay;
}

function createPersonalAiArBadge(binding: PersonalAiArBinding, element: Element): HTMLDivElement {
    const badge = document.createElement('div');
    badge.className = 'pai-ar-data-badge';
    badge.dataset.paiArBindingId = binding.id;
    badge.style.cssText = [
        'position:absolute',
        'z-index:2147483646',
        'display:flex',
        'align-items:center',
        'gap:4px',
        'padding:2px',
        'border-radius:999px',
        'background:rgba(17,24,39,0.92)',
        'box-shadow:0 4px 12px rgba(0,0,0,0.18)',
        'color:white',
        'font:12px/1.2 -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif',
    ].join(';');

    const icon = document.createElement('img');
    icon.src = chrome.runtime.getURL('icons/icon32.png');
    icon.alt = 'Personal AI';
    icon.style.cssText = 'width:18px;height:18px;display:block;cursor:pointer';
    icon.title = buildPersonalAiArEditBoundaryLabel(binding);
    icon.setAttribute('role', 'button');
    icon.setAttribute('tabindex', '0');
    icon.setAttribute('aria-label', buildPersonalAiArEditBoundaryLabel(binding));
    const openEditor = (event: Event) => {
        event.preventDefault();
        event.stopPropagation();
        void showPersonalAiArEditor(element, binding);
    };
    icon.addEventListener('click', openEditor);
    icon.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            openEditor(event);
        }
    });
    badge.appendChild(icon);

    const loading = document.createElement('span');
    loading.dataset.paiArLoading = 'true';
    loading.title = 'AR 数据刷新中';
    loading.style.cssText = [
        'display:none',
        'width:10px',
        'height:10px',
        'border:2px solid rgba(255,255,255,0.35)',
        'border-top-color:#fff',
        'border-radius:999px',
        'animation:pai-ar-spin 0.8s linear infinite',
    ].join(';');
    badge.appendChild(loading);

    const statusChip = document.createElement('span');
    statusChip.dataset.paiArStatusChip = 'true';
    badge.appendChild(statusChip);

    const actions = document.createElement('span');
    actions.style.cssText = 'display:none;align-items:center;gap:2px';

    const refresh = document.createElement('button');
    refresh.type = 'button';
    refresh.textContent = '↻';
    refresh.title = buildPersonalAiArRefreshBoundaryLabel(binding);
    refresh.setAttribute('aria-label', buildPersonalAiArRefreshBoundaryLabel(binding));
    refresh.style.cssText = 'border:0;background:transparent;color:white;cursor:pointer;font-size:12px;padding:1px 3px';
    refresh.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        requestPersonalAiArExecution(binding);
    });

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = '×';
    remove.title = buildPersonalAiArHideBoundaryLabel(binding);
    remove.setAttribute('aria-label', buildPersonalAiArHideBoundaryLabel(binding));
    remove.style.cssText = 'border:0;background:transparent;color:white;cursor:pointer;font-size:14px;padding:0 4px';
    remove.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        setPersonalAiArBindingHiddenForPage(binding.id, true);
        restorePersonalAiArBinding(binding.id);
    });

    actions.appendChild(refresh);
    actions.appendChild(remove);
    badge.appendChild(actions);
    const showActions = () => {
        actions.style.display = 'inline-flex';
    };
    const hideActions = () => {
        if (!badge.matches(':focus-within')) {
            actions.style.display = 'none';
        }
    };
    badge.addEventListener('mouseenter', showActions);
    badge.addEventListener('mouseleave', () => {
        hideActions();
    });
    badge.addEventListener('focusin', showActions);
    badge.addEventListener('focusout', () => {
        window.setTimeout(hideActions, 0);
    });

    document.body.appendChild(badge);
    if (!document.getElementById('pai-ar-spin-style')) {
        const style = document.createElement('style');
        style.id = 'pai-ar-spin-style';
        style.textContent = '@keyframes pai-ar-spin{to{transform:rotate(360deg)}}';
        document.documentElement.appendChild(style);
    }
    positionPersonalAiArBadge(badge, element);
    updatePersonalAiArBadgeLoading(binding.id);
    updatePersonalAiArBadgeStatus(badge, binding);
    return badge;
}

function applyPersonalAiArBinding(binding: PersonalAiArBinding): void {
    const element = findPersonalAiArBindingElement(binding);
    if (!element) {
        return;
    }

    const replacementText = binding.lastResult?.text?.trim();
    if (!replacementText) {
        return;
    }

    const existing = personalAiArAppliedBindings.get(binding.id);
    if (existing) {
        existing.binding = binding;
        if (existing.displayMode === 'dom_text') {
            if (existing.element instanceof HTMLInputElement || existing.element instanceof HTMLTextAreaElement) {
                existing.element.value = replacementText;
            } else {
                existing.element.textContent = replacementText;
            }
        } else if (existing.overlay) {
            updatePersonalAiArVisualOverlayText(existing.overlay, replacementText);
            positionPersonalAiArVisualOverlay(existing.overlay, existing.element);
            updatePersonalAiArVisualOverlayBasis(existing.overlay, binding);
        }
        positionPersonalAiArBadge(existing.badge, existing.element);
        updatePersonalAiArBadgeLoading(binding.id);
        updatePersonalAiArBadgeStatus(existing.badge, binding);
        return;
    }

    const displayMode = binding.displayMode === 'dom_text' && isPersonalAiArDomTextReplaceable(element)
        ? 'dom_text'
        : 'visual_overlay';
    const originalText = getPersonalAiArElementText(element);

    if (displayMode === 'dom_text') {
        if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
            element.value = replacementText;
        } else {
            element.textContent = replacementText;
        }
    }

    const overlay = displayMode === 'visual_overlay'
        ? createPersonalAiArVisualOverlay(binding, element, replacementText)
        : undefined;
    const badge = createPersonalAiArBadge(binding, element);
    personalAiArAppliedBindings.set(binding.id, {
        element,
        originalText,
        badge,
        overlay,
        displayMode,
        binding,
    });
}

function triggerPersonalAiArAutoRefreshes(bindings: PersonalAiArBinding[]): void {
    if (!isPersonalAiArEnabledForPage()) {
        return;
    }

    const todayKey = getPersonalAiArLocalDateKey(new Date());
    bindings.forEach((binding) => {
        if (!binding.agentTaskPrompt?.trim()) {
            return;
        }
        if (isPersonalAiArResultFromToday(binding)) {
            return;
        }
        const requestKey = `${binding.id}:${todayKey}`;
        if (personalAiArAutoRefreshRequestedIds.has(requestKey)) {
            return;
        }
        personalAiArAutoRefreshRequestedIds.add(requestKey);
        requestPersonalAiArExecution(binding, {
            triggerSource: 'ar_auto_page_open',
            autoRefreshDate: todayKey,
        });
    });
}

async function applyPersonalAiArBindings(): Promise<void> {
    const bindings = dedupePersonalAiArBindings(await readPersonalAiArBindings())
        .filter(matchesPersonalAiArBindingCurrentPage)
        .filter(binding => !isPersonalAiArBindingHiddenForPage(binding));
    if (bindings.length === 0) {
        restoreAllPersonalAiArBindings();
        removePersonalAiArToggle();
        return;
    }

    if (!personalAiArPageBindingLogged) {
        personalAiArPageBindingLogged = true;
        console.info('[Personal AI AR] page bindings loaded', {
            version: PERSONAL_AI_AR_RUNTIME_VERSION,
            count: bindings.length,
            pageKey: getPersonalAiArPageKey(),
        });
    }

    const pageBindings = bindings.filter(binding => Boolean(findPersonalAiArBindingElement(binding)));
    if (pageBindings.length === 0) {
        restoreAllPersonalAiArBindings();
        removePersonalAiArToggle();
        return;
    }

    createOrUpdatePersonalAiArToggle();
    if (!isPersonalAiArEnabledForPage()) {
        restoreAllPersonalAiArBindings();
        return;
    }

    pageBindings.forEach(applyPersonalAiArBinding);
    triggerPersonalAiArAutoRefreshes(pageBindings);
}

function schedulePersonalAiArBindingsApply(): void {
    if (personalAiArApplyScheduled) {
        return;
    }
    personalAiArApplyScheduled = true;
    window.setTimeout(() => {
        personalAiArApplyScheduled = false;
        void applyPersonalAiArBindings();
    }, 120);
}

function createOrUpdatePersonalAiArToggle(): void {
    const enabled = isPersonalAiArEnabledForPage();
    if (!personalAiArToggle) {
        personalAiArToggle = document.createElement('button');
        personalAiArToggle.type = 'button';
        personalAiArToggle.style.cssText = [
            'position:fixed',
            'top:0',
            'right:auto',
            'z-index:2147483647',
            'display:flex',
            'align-items:center',
            'border:0',
            'border-radius:0 0 4px 4px',
            'padding:0',
            'overflow:hidden',
            'background:#f8fafc',
            'box-shadow:0 5px 14px rgba(15,23,42,0.16)',
            'font:10px/1 -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif',
            'font-weight:700',
            'cursor:pointer',
            'user-select:none',
            'height:18px',
            'letter-spacing:0',
        ].join(';');
        personalAiArToggle.addEventListener('pointerdown', (event) => {
            if (!personalAiArToggle) return;
            event.preventDefault();
            event.stopPropagation();
            personalAiArToggleDragging = true;
            personalAiArToggleMoved = false;
            personalAiArToggleDragStartX = event.clientX;
            personalAiArToggleDragStartLeft = personalAiArToggle.getBoundingClientRect().left;
            try {
                personalAiArToggle.setPointerCapture(event.pointerId);
            } catch {
                // Ignore capture failures; pointerup still handles the click path.
            }
        });
        personalAiArToggle.addEventListener('pointermove', (event) => {
            if (!personalAiArToggleDragging || !personalAiArToggle) return;
            event.preventDefault();
            event.stopPropagation();
            const dx = event.clientX - personalAiArToggleDragStartX;
            if (Math.abs(dx) >= PERSONAL_AI_AR_TOGGLE_DRAG_THRESHOLD) {
                personalAiArToggleMoved = true;
                personalAiArToggleLeftPx = clampPersonalAiArToggleLeft(personalAiArToggleDragStartLeft + dx);
                personalAiArToggle.style.left = `${personalAiArToggleLeftPx}px`;
            }
        });
        personalAiArToggle.addEventListener('pointerup', (event) => {
            if (!personalAiArToggle) return;
            event.preventDefault();
            event.stopPropagation();
            const dx = event.clientX - personalAiArToggleDragStartX;
            const wasDrag = personalAiArToggleMoved || Math.abs(dx) >= PERSONAL_AI_AR_TOGGLE_DRAG_THRESHOLD;
            personalAiArToggleDragging = false;
            try {
                personalAiArToggle.releasePointerCapture(event.pointerId);
            } catch {
                // Pointer capture can be absent if the browser already released it.
            }
            personalAiArToggleMoved = false;
            if (!wasDrag) {
                togglePersonalAiArForPage();
            }
        });
        personalAiArToggle.addEventListener('pointercancel', () => {
            personalAiArToggleDragging = false;
            personalAiArToggleMoved = false;
        });
        personalAiArToggle.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                event.stopPropagation();
                togglePersonalAiArForPage();
            }
        });
        document.documentElement.appendChild(personalAiArToggle);
    }

    personalAiArToggle.setAttribute('aria-label', buildPersonalAiArToggleBoundaryLabel(enabled));
    personalAiArToggle.title = buildPersonalAiArToggleBoundaryLabel(enabled);
    personalAiArToggle.innerHTML = '';
    const label = document.createElement('span');
    label.style.cssText = 'display:flex;align-items:center;gap:3px;height:18px;padding:0 5px 0 4px;color:#111827;background:#f8fafc';
    const icon = document.createElement('img');
    icon.src = chrome.runtime.getURL('icons/icon48.png');
    icon.alt = 'Personal AI';
    icon.style.cssText = 'width:12px;height:12px;display:block;flex:none';
    const labelText = document.createElement('span');
    labelText.textContent = 'AR';
    label.appendChild(icon);
    label.appendChild(labelText);
    const state = document.createElement('span');
    state.textContent = enabled ? 'ON' : 'OFF';
    state.style.cssText = [
        'display:flex',
        'align-items:center',
        'justify-content:center',
        'height:18px',
        'min-width:24px',
        'padding:0 5px',
        'color:#fff',
        `background:${enabled ? '#16a34a' : '#64748b'}`,
    ].join(';');
    personalAiArToggle.appendChild(label);
    personalAiArToggle.appendChild(state);
    positionPersonalAiArToggle();
}

function createPersonalAiArField(labelText: string, child: HTMLElement, hint?: string): HTMLDivElement {
    const group = document.createElement('div');
    group.style.cssText = 'display:flex;flex-direction:column;gap:6px;margin-bottom:12px';
    const label = document.createElement('label');
    label.textContent = labelText;
    label.style.cssText = 'font-weight:600;color:#111827;font-size:13px';
    group.appendChild(label);
    group.appendChild(child);
    if (hint) {
        const hintElement = document.createElement('small');
        hintElement.textContent = hint;
        hintElement.style.cssText = 'color:#6b7280;line-height:1.4';
        group.appendChild(hintElement);
    }
    return group;
}

function updatePersonalAiArRepeatReceipt(
    receipt: HTMLElement,
    repeatCheckbox: HTMLInputElement,
    repeatSelect: HTMLSelectElement,
    existingBinding?: PersonalAiArBinding,
): void {
    const linkedAgentTaskId = existingBinding?.linkedAgentTaskId?.trim();
    repeatSelect.disabled = !repeatCheckbox.checked;
    repeatSelect.style.opacity = repeatCheckbox.checked ? '1' : '0.55';

    if (linkedAgentTaskId && repeatCheckbox.checked) {
        receipt.textContent = `重复执行回执：保存会更新 AgentTask ${linkedAgentTaskId} 的任务描述、通知模板和周期；不会立即删除历史结果。`;
        receipt.style.color = '#166534';
        return;
    }
    if (linkedAgentTaskId && !repeatCheckbox.checked) {
        receipt.textContent = `取消重复回执：保存会先暂停 AgentTask ${linkedAgentTaskId}，并清空该行的 AR binding id；成功前不会只改本地 binding。`;
        receipt.style.color = '#92400e';
        return;
    }
    if (repeatCheckbox.checked) {
        receipt.textContent = '重复执行回执：保存会创建 Scheduled Messages AgentTask 行，并把它绑定到这个 AR 位置。';
        receipt.style.color = '#166534';
        return;
    }
    receipt.textContent = '本地展示回执：保存为当前网页 AR binding；不写入 Scheduled Messages，不创建重复任务。';
    receipt.style.color = '#4b5563';
}

async function showPersonalAiArEditor(target: Element, existingBinding?: PersonalAiArBinding): Promise<void> {
    const oldValue = existingBinding?.oldValue || getPersonalAiArElementText(target);
    const nearbyText = existingBinding?.nearbyText || getPersonalAiArNearbyText(target);
    const selector = existingBinding?.selector || buildPersonalAiArSelector(target);
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:rgba(17,24,39,0.38);display:flex;align-items:center;justify-content:center;padding:24px';

    const panel = document.createElement('div');
    panel.style.cssText = 'width:min(560px,calc(100vw - 32px));max-height:calc(100vh - 48px);overflow:auto;background:white;border-radius:10px;box-shadow:0 24px 70px rgba(0,0,0,0.28);padding:18px;color:#111827;font:14px/1.5 -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif';
    modal.appendChild(panel);

    const title = document.createElement('h2');
    title.textContent = 'AR 数据';
    title.style.cssText = 'margin:0 0 12px;font-size:18px;line-height:1.3';
    panel.appendChild(title);

    const preview = document.createElement('div');
    preview.style.cssText = 'padding:10px 12px;border:1px solid #e5e7eb;border-radius:8px;background:#f9fafb;margin-bottom:12px;color:#374151';
    preview.textContent = oldValue ? `已选择: ${oldValue}` : `已选择 ${target.tagName.toLowerCase()} 元素；没有稳定文本，将以追加/overlay 模式保存。`;
    panel.appendChild(preview);

    const resultInput = document.createElement('input');
    resultInput.type = 'text';
    resultInput.value = existingBinding?.lastResult?.text || oldValue || 'AR 数据待执行';
    resultInput.placeholder = '这里填写当前先展示的占位结果';
    resultInput.style.cssText = 'box-sizing:border-box;width:100%;border:1px solid #d1d5db;border-radius:6px;padding:8px 10px;font:inherit';
    panel.appendChild(createPersonalAiArField('当前展示内容', resultInput, '页面打开时先显示这份历史/占位结果；不会因当天重复打开自动刷新。'));

    const taskInput = document.createElement('textarea');
    taskInput.value = existingBinding?.agentTaskPrompt || `查找「${oldValue || nearbyText || '此处'}」相关数据，并输出适合替换到这个页面位置的简短结果。`;
    taskInput.rows = 4;
    taskInput.style.cssText = 'box-sizing:border-box;width:100%;border:1px solid #d1d5db;border-radius:6px;padding:8px 10px;font:inherit;resize:vertical';
    panel.appendChild(createPersonalAiArField('需要展示的内容 / Agent 任务', taskInput, '例如：查找 xxx JQL 数据并输出 issues 总数到这里。'));

    const notifyInput = document.createElement('textarea');
    notifyInput.value = existingBinding?.notifyTemplate || '';
    notifyInput.rows = 2;
    notifyInput.placeholder = '可选：用 3 行告诉我结果、风险和下一步';
    notifyInput.style.cssText = 'box-sizing:border-box;width:100%;border:1px solid #d1d5db;border-radius:6px;padding:8px 10px;font:inherit;resize:vertical';
    panel.appendChild(createPersonalAiArField('结果按如下模板通知我（可选）', notifyInput));

    const repeatRow = document.createElement('div');
    repeatRow.style.cssText = 'display:flex;align-items:center;gap:10px;margin:8px 0 14px';
    const repeatLabel = document.createElement('label');
    repeatLabel.style.cssText = 'display:flex;align-items:center;gap:6px;font-weight:600';
    const repeatCheckbox = document.createElement('input');
    repeatCheckbox.type = 'checkbox';
    repeatCheckbox.checked = Boolean(existingBinding?.linkedAgentTaskId);
    repeatLabel.appendChild(repeatCheckbox);
    repeatLabel.appendChild(document.createTextNode('重复执行'));
    const repeatSelect = document.createElement('select');
    repeatSelect.style.cssText = 'border:1px solid #d1d5db;border-radius:6px;padding:7px 9px;font:inherit';
    [
        ['week', '每周一次'],
        ['month', '每月一次'],
        ['quarter', '每个季度一次'],
    ].forEach(([value, label]) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = label;
        repeatSelect.appendChild(option);
    });
    repeatRow.appendChild(repeatLabel);
    repeatRow.appendChild(repeatSelect);
    panel.appendChild(repeatRow);

    const repeatReceipt = document.createElement('div');
    repeatReceipt.dataset.paiArRepeatReceipt = 'true';
    repeatReceipt.style.cssText = 'margin:-6px 0 12px;font-size:12px;line-height:1.45';
    panel.appendChild(repeatReceipt);
    const refreshRepeatReceipt = () => {
        updatePersonalAiArRepeatReceipt(repeatReceipt, repeatCheckbox, repeatSelect, existingBinding);
    };
    repeatCheckbox.addEventListener('change', refreshRepeatReceipt);
    refreshRepeatReceipt();

    const status = document.createElement('div');
    status.style.cssText = 'min-height:18px;color:#6b7280;font-size:12px;margin-bottom:10px';
    panel.appendChild(status);

    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;justify-content:flex-end;gap:8px';
    const cancelButton = document.createElement('button');
    cancelButton.type = 'button';
    cancelButton.textContent = '取消';
    cancelButton.style.cssText = 'border:1px solid #d1d5db;background:white;border-radius:6px;padding:8px 12px;cursor:pointer';
    const saveButton = document.createElement('button');
    saveButton.type = 'button';
    saveButton.textContent = '保存';
    saveButton.style.cssText = 'border:0;background:#111827;color:white;border-radius:6px;padding:8px 14px;cursor:pointer;font-weight:600';
    actions.appendChild(cancelButton);
    actions.appendChild(saveButton);
    panel.appendChild(actions);

    const close = () => modal.remove();
    cancelButton.addEventListener('click', close);

    saveButton.addEventListener('click', async () => {
        const bindings = await readPersonalAiArBindings();
        const pageKey = getPersonalAiArPageKey();
        const targetKey = `${pageKey}::${stripPersonalAiArTransientSelectorClasses(selector)}`;
        const sameTargetBinding = existingBinding
            ? undefined
            : bindings.find(item => getPersonalAiArBindingTargetKey(item) === targetKey);
        const bindingId = existingBinding?.id ||
            sameTargetBinding?.id ||
            `ar_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const displayMode: PersonalAiArBinding['displayMode'] = isPersonalAiArDomTextReplaceable(target)
            ? 'dom_text'
            : 'visual_overlay';
        let linkedAgentTaskId = existingBinding?.linkedAgentTaskId || sameTargetBinding?.linkedAgentTaskId;
        saveButton.disabled = true;
        status.style.color = '#6b7280';
        status.textContent = repeatCheckbox.checked
            ? '正在同步重复任务...'
            : '正在保存本机 AR binding...';
        const linkedAgentTaskIdToDetach = !repeatCheckbox.checked
            ? (existingBinding?.linkedAgentTaskId || sameTargetBinding?.linkedAgentTaskId || '')
            : '';

        if (repeatCheckbox.checked) {
            const repeatValue = repeatSelect.value;
            const repeatEvery = repeatValue === 'quarter' ? 3 : 1;
            const repeatUnit = repeatValue === 'week' ? 'Week' : 'Month';
            const response = await chrome.runtime.sendMessage({
                type: 'UPSERT_AGENT_TASK_FROM_AR_BINDING',
                data: {
                    arBindingId: bindingId,
                    agentTaskId: `agent_task_${bindingId}`,
                    messageId: linkedAgentTaskId,
                    title: `AR 数据：${oldValue || target.tagName.toLowerCase()}`,
                    taskPrompt: taskInput.value.trim(),
                    notifyTemplate: notifyInput.value.trim(),
                    repeatEvery,
                    repeatUnit,
                },
            });
            if (!response?.success) {
                saveButton.disabled = false;
                status.textContent = response?.error || '重复任务创建失败，AR binding 未保存。';
                return;
            }
            linkedAgentTaskId = response.message?.ID || linkedAgentTaskId;
        } else if (linkedAgentTaskIdToDetach) {
            status.textContent = '正在暂停原重复任务...';
            let response: any;
            try {
                response = await chrome.runtime.sendMessage({
                    type: 'DETACH_AGENT_TASK_FROM_AR_BINDING',
                    data: {
                        messageId: linkedAgentTaskIdToDetach,
                        arBindingId: bindingId,
                    },
                });
            } catch (error) {
                response = {
                    success: false,
                    error: error instanceof Error ? error.message : String(error),
                };
            }
            if (!response?.success) {
                saveButton.disabled = false;
                status.style.color = '#b91c1c';
                status.textContent = response?.error || '重复任务暂停失败，AR binding 未改成本地-only。';
                return;
            }
            linkedAgentTaskId = undefined;
        } else {
            linkedAgentTaskId = undefined;
        }

        const previousResult = existingBinding?.lastResult || sameTargetBinding?.lastResult;
        const displayText =
            resultInput.value.trim() ||
            previousResult?.text ||
            oldValue ||
            'AR 数据待执行';
        const nextBinding: PersonalAiArBinding = {
            id: bindingId,
            urlPattern: pageKey,
            selector,
            tagName: target.tagName.toLowerCase(),
            sectionLabel: oldValue || target.getAttribute('aria-label') || target.tagName.toLowerCase(),
            nearbyText,
            oldValue,
            displayMode,
            linkedAgentTaskId,
            lastResult: {
                text: displayText,
                updatedAt: previousResult?.updatedAt || '1970-01-01T00:00:00.000Z',
            },
            agentTaskPrompt: taskInput.value.trim(),
            notifyTemplate: notifyInput.value.trim(),
        };

        const nextBindings = bindings
            .filter(item => item.id !== bindingId && getPersonalAiArBindingTargetKey(item) !== targetKey)
            .concat(nextBinding);
        await writePersonalAiArBindings(nextBindings);
        setPersonalAiArBindingHiddenForPage(bindingId, false);
        restorePersonalAiArBinding(bindingId);
        close();
        personalAiArAutoRefreshRequestedIds.add(`${bindingId}:${getPersonalAiArLocalDateKey(new Date())}`);
        await applyPersonalAiArBindings();
        requestPersonalAiArExecution(nextBinding);
    });

    document.documentElement.appendChild(modal);
    resultInput.focus();
}

function initPersonalAiArRuntime(): void {
    (window as any).__personalAiArRuntimeVersion = PERSONAL_AI_AR_RUNTIME_VERSION;
    document.documentElement.dataset.personalAiArRuntimeVersion = PERSONAL_AI_AR_RUNTIME_VERSION;

    document.addEventListener('contextmenu', (event) => {
        personalAiArContextTarget = event.target instanceof Element ? event.target : null;
    }, true);

    chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
        if (request.type !== 'PERSONAL_AI_AR_CONTEXT_MENU') {
            return false;
        }

        const selected = window.getSelection()?.toString().trim();
        let target = personalAiArContextTarget;
        if (!target && selected) {
            target = window.getSelection()?.anchorNode?.parentElement || null;
        }
        if (!target) {
            sendResponse({ success: false, error: '未找到可绑定的 DOM 元素' });
            return false;
        }

        void showPersonalAiArEditor(target)
            .then(() => sendResponse({ success: true }))
            .catch(error => sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) }));
        return true;
    });

    window.addEventListener('scroll', () => {
        personalAiArAppliedBindings.forEach((applied) => {
            positionPersonalAiArBadge(applied.badge, applied.element);
            if (applied.overlay) {
                positionPersonalAiArVisualOverlay(applied.overlay, applied.element);
            }
        });
    }, { passive: true });
    window.addEventListener('resize', () => {
        personalAiArAppliedBindings.forEach((applied) => {
            positionPersonalAiArBadge(applied.badge, applied.element);
            if (applied.overlay) {
                positionPersonalAiArVisualOverlay(applied.overlay, applied.element);
            }
        });
        positionPersonalAiArToggle();
    });

    if (chrome.storage?.onChanged?.addListener) {
        chrome.storage.onChanged.addListener((changes, areaName) => {
            if (areaName === 'local' && changes[PERSONAL_AI_AR_BINDINGS_KEY]) {
                schedulePersonalAiArBindingsApply();
            }
        });
    }

    const observerRoot = document.body || document.documentElement;
    if (observerRoot) {
        const observer = new MutationObserver((mutations) => {
            const shouldReapply = mutations.some((mutation) => {
                const target = mutation.target;
                if (!(target instanceof Element)) {
                    return true;
                }
                return !target.closest('.pai-ar-data-badge') &&
                    !target.closest('.pai-ar-data-visual-overlay') &&
                    target !== personalAiArToggle;
            });
            if (shouldReapply) {
                schedulePersonalAiArBindingsApply();
            }
        });
        observer.observe(observerRoot, {
            attributes: true,
            attributeFilter: ['class', 'id', 'style', 'aria-label', 'data-id', 'data-testid'],
            childList: true,
            subtree: true,
        });
    }

    void applyPersonalAiArBindings();
}

try {
    new WebIntelligenceContentScript();
    initPersonalAiArRuntime();
} catch (error) {
    console.error('智能网页分析启动失败:', error);
}

console.log('🧠 智能网页分析 Content Script 已加载');
