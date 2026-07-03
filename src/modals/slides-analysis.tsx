import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { useState, useEffect, useRef } from 'react';
import { ProjectUpdateSuggestion } from '../slide';
import { DisplaySlideAnalysisResult } from '../contentScriptGoogleSlide';
import {
    getNewSuggestionText,
    normalizeComparableText,
} from '../utils/slidesAnalyzerSuggestions';
import {
    formatDisplayDate,
    getRiskEvidenceItems,
    isOpenJiraIssue,
    isPastDueDate,
    isRiskSpotlightSuggestion,
} from '../utils/slidesAnalyzerRisk';
import type { JiraTicket } from '../types';

interface AnalysisData {
    result: DisplaySlideAnalysisResult;
    presentationId: string;
}

type UpdateField = 'status' | 'owner' | 'track' | 'comments';
type ReviewFilter = 'all' | 'selected' | 'review' | 'risk' | 'blocked';
type FieldReviewQueueKind = 'review' | 'blocked';

interface FieldReviewQueueItem {
    suggestion: ProjectUpdateSuggestion;
    projectIndex: number;
    field: UpdateField;
    kind: FieldReviewQueueKind;
    reason: string;
    previewText: string;
    evidenceText: string;
}

interface SelectedFieldPreviewItem {
    projectIndex: number;
    field: UpdateField;
    projectLabel: string;
    fieldLabel: string;
    previewText: string;
    evidenceText: string;
    targetText: string;
    reviewKind: 'ready' | 'review';
    reviewLabel: string;
}

interface BlockedFieldDetailItem {
    field: UpdateField;
    fieldLabel: string;
    previewText: string;
    evidenceText: string;
}

interface ApplyResultReceipt {
    updatedCount: number;
    skippedCount: number;
    errors: string[];
    submittedItems: SelectedFieldPreviewItem[];
}

interface ApplyFailureReceipt {
    errorMessage: string;
    errors: string[];
    submittedItems: SelectedFieldPreviewItem[];
}

interface ReviewPacketCopyReceipt {
    status: 'success' | 'failed';
    copiedAt: string;
    copiedFieldCount: number;
    copiedProjectCount: number;
    visibleSelectedUpdateCount: number;
    hiddenSelectedUpdateCount: number;
    selectedReviewFieldCount: number;
    presentationId: string;
    selectionSignature: string;
}

interface ApplySkippedHandoffItem {
    reason: string;
    projectLabel: string;
    fieldLabel: string;
    previewText: string;
    evidenceText: string;
    targetText: string;
    nextStep: string;
    matched: boolean;
}

interface ApplySkippedMatchSummary {
    matchedKeys: Set<string>;
    unmatchedReasons: string[];
}

const GOOGLE_SLIDES_ORIGIN = 'https://docs.google.com';
const HIGH_CONFIDENCE_THRESHOLD = 0.75;
const APPLY_TIMEOUT_MS = 45000;
const INITIAL_DATA_TIMEOUT_MS = 12000;
const SELECTED_FIELD_PREVIEW_LIMIT = 5;
const APPLY_RESULT_RECEIPT_LIMIT = 6;
const APPLY_SKIPPED_HANDOFF_LIMIT = 6;
const SELECTED_FIELD_PREVIEW_TEXT_LIMIT = 140;
const SELECTED_FIELD_EVIDENCE_TEXT_LIMIT = 180;
const WRITEBACK_SNAPSHOT_STALE_WARNING_MS = 10 * 60 * 1000;
const UPDATE_FIELD_LABELS: Record<UpdateField, string> = {
    status: '状态列',
    owner: '负责人列',
    track: '赛道列',
    comments: '备注列'
};
const UPDATE_FIELD_SHORT_LABELS: Record<UpdateField, string> = {
    status: '状态',
    owner: '负责人',
    track: '赛道',
    comments: '备注'
};
const UPDATE_FIELD_COLUMN_LABELS: Record<UpdateField, string> = {
    status: UPDATE_FIELD_LABELS.status,
    owner: UPDATE_FIELD_LABELS.owner,
    track: UPDATE_FIELD_LABELS.track,
    comments: UPDATE_FIELD_LABELS.comments
};
const UPDATE_FIELD_MATCH_ALIASES: Record<UpdateField, string[]> = {
    status: ['状态', '状态列', 'status', 'status column', 'health', 'rag'],
    owner: ['负责人', '负责人列', 'owner', 'owner column', 'assignee', 'assignee column', 'dri'],
    track: ['赛道', '赛道列', 'track', 'track column', 'workstream', 'workstream column', 'lane'],
    comments: ['备注', '备注列', 'comments', 'comments column', 'comment', 'notes', 'updates', 'blockers', 'actions'],
};
const REVIEW_FILTER_LABELS: Record<ReviewFilter, string> = {
    all: '全部',
    selected: '已选',
    review: '需复核',
    risk: '风险',
    blocked: '无法写回'
};
const fieldKey = (projectIndex: number, field: UpdateField) => `${projectIndex}:${field}`;

const buildAnalysisScopeReceiptLines = (
    analyzedSlideCount: unknown,
    totalSlideCount: unknown,
    requestedSlideId: unknown,
    warningCount: number,
): string[] => {
    const lines: string[] = [];
    const hasSlideCounts = typeof analyzedSlideCount === 'number' && typeof totalSlideCount === 'number';
    const targetText = typeof requestedSlideId === 'string' && requestedSlideId.trim()
        ? `当前目标 ${requestedSlideId.trim()}`
        : '未带明确目标 slide';

    if (hasSlideCounts && totalSlideCount > 0) {
        if (analyzedSlideCount <= 0) {
            lines.push(`范围判定回执: ${targetText} 没有进入本轮分析；当前没有可当作已检查的 slide。`);
        } else if (analyzedSlideCount < totalSlideCount) {
            lines.push(`范围判定回执: 只分析 ${analyzedSlideCount} / ${totalSlideCount} 张 slide，先按 ${targetText} 的项目建议复核；这不是整份 deck 完整扫描。`);
        } else {
            lines.push(`范围判定回执: 已覆盖 ${analyzedSlideCount} / ${totalSlideCount} 张 slide；仍需按字段来源核对建议，不把 AI 草稿当作事实确认。`);
        }
    } else {
        lines.push(`范围判定回执: 本页只展示当前返回的分析结果快照；${targetText}，覆盖范围请以字段来源和解析提醒为准。`);
    }

    lines.push(
        warningCount > 0
            ? `解析提醒 ${warningCount} 条；先处理提醒和字段来源，再决定是否写回。`
            : '没有解析提醒；写回前仍请核对字段来源、目标 slide/table/行列和建议值。',
    );
    lines.push('查看、筛选或复制本页内容不会重新分析 deck、不会写回 Slides，也不会反写 Jira 或 Memory Service。');

    return lines;
};

const formatSnapshotReceivedAt = (timestamp: number): string => {
    try {
        return new Intl.DateTimeFormat('zh-CN', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
        }).format(new Date(timestamp));
    } catch {
        return new Date(timestamp).toLocaleString();
    }
};

const buildAnalysisSnapshotReceiptLines = (
    result: DisplaySlideAnalysisResult,
    presentationId: string,
    receivedAt: string,
    availableUpdateFieldCount: number,
    defaultSelectedFieldCount: number,
    selectedUpdateCount: number,
): string[] => {
    const targetSlide = typeof result.summary.requestedSlideId === 'string' && result.summary.requestedSlideId.trim()
        ? result.summary.requestedSlideId.trim()
        : '未带明确目标 slide';
    const suggestionCount = result.updateSuggestions.length;
    const receivedText = receivedAt || '本次页面加载';

    return [
        `分析快照回执: presentation ${presentationId || 'unknown'}；目标 ${targetSlide}；本页收到 ${receivedText}。`,
        `快照内容: ${result.summary.totalProjects} 个项目，${suggestionCount} 张建议卡，${availableUpdateFieldCount} 个可写字段，高可信默认 ${defaultSelectedFieldCount} 个；当前本页已选 ${selectedUpdateCount} 个字段。`,
        '新鲜度边界: 这是原 Google Slides 页面传来的分析结果快照，不会实时监听 deck 后续改动；如果 Slides 已被编辑、切页或表格重排，请从 Google Slides 重新点击「分析项目」。',
        '非效果: 展示快照不会写回 Slides、不会重新分析 deck，也不会反写 Jira 或 Memory Service。',
    ];
};

const buildWritebackSnapshotBasisLine = (
    result: DisplaySlideAnalysisResult,
    presentationId: string,
    receivedAt: string,
): string => {
    const targetSlide = typeof result.summary.requestedSlideId === 'string' && result.summary.requestedSlideId.trim()
        ? result.summary.requestedSlideId.trim()
        : '未带明确目标 slide';
    const receivedText = receivedAt || '本页加载时';

    return `快照基准: 本次写回依据 ${receivedText} 收到的 presentation ${presentationId || 'unknown'} / 目标 ${targetSlide} 分析快照；应用前不会重新读取 deck、复查当前 slide/table/行列或确认协作编辑，若已切页、改表格或同事更新，请先回 Slides 重新分析。`;
};

const formatWritebackSnapshotAge = (receivedAtMs: number, nowMs = Date.now()): string => {
    if (!Number.isFinite(receivedAtMs) || receivedAtMs <= 0) {
        return '未知';
    }

    const ageMs = Math.max(0, nowMs - receivedAtMs);
    if (ageMs < 60 * 1000) {
        return '不到 1 分钟';
    }

    const ageMinutes = Math.floor(ageMs / (60 * 1000));
    if (ageMinutes < 60) {
        return `约 ${ageMinutes} 分钟`;
    }

    const ageHours = Math.floor(ageMinutes / 60);
    const remainingMinutes = ageMinutes % 60;
    if (ageHours < 24) {
        return remainingMinutes > 0
            ? `约 ${ageHours} 小时 ${remainingMinutes} 分钟`
            : `约 ${ageHours} 小时`;
    }

    const ageDays = Math.floor(ageHours / 24);
    const remainingHours = ageHours % 24;
    return remainingHours > 0
        ? `约 ${ageDays} 天 ${remainingHours} 小时`
        : `约 ${ageDays} 天`;
};

const buildWritebackSnapshotAgeLine = (receivedAtMs: number): string => {
    if (!Number.isFinite(receivedAtMs) || receivedAtMs <= 0) {
        return '快照年龄: 本页没有可靠收到时间；写回前请回 Slides 重新分析，避免基于未知快照覆盖协作编辑。';
    }

    const ageMs = Math.max(0, Date.now() - receivedAtMs);
    const ageText = formatWritebackSnapshotAge(receivedAtMs);
    const actionText = ageMs >= WRITEBACK_SNAPSHOT_STALE_WARNING_MS
        ? '已超过 10 分钟，建议先回 Slides 重新分析再写回。'
        : '若 deck 已切页、表格重排或同事协作编辑，请先回 Slides 重新分析。';

    return `快照年龄: 本页已持有这份分析快照${ageText}；${actionText}`;
};

const hasWritableColumnIndex = (columnIndex: unknown): columnIndex is number => (
    Number.isInteger(columnIndex) && (columnIndex as number) >= 0
);

const hasMeaningfulSuggestedChange = (currentValue: unknown, suggestedValue: unknown): boolean => {
    if (typeof suggestedValue !== 'string' || !suggestedValue.trim()) {
        return false;
    }

    return normalizeComparableText(currentValue) !== normalizeComparableText(suggestedValue);
};

const getNewSuggestedComments = (suggestion: ProjectUpdateSuggestion): string => (
    getNewSuggestionText(suggestion.currentComments, suggestion.suggestedComments)
);

const hasDuplicateOnlySuggestedComments = (suggestion: ProjectUpdateSuggestion): boolean => (
    typeof suggestion.suggestedComments === 'string' &&
    suggestion.suggestedComments.trim().length > 0 &&
    !getNewSuggestedComments(suggestion)
);

const addUniqueEvidenceItem = (items: string[], value: unknown): void => {
    if (typeof value !== 'string') {
        return;
    }

    const trimmed = value.trim();
    if (!trimmed || items.includes(trimmed)) {
        return;
    }

    items.push(trimmed);
};

const getSafeExternalUrl = (value: unknown): string | undefined => {
    if (typeof value !== 'string' || !value.trim()) {
        return undefined;
    }

    try {
        const url = new URL(value);
        return url.protocol === 'https:' || url.protocol === 'http:'
            ? url.toString()
            : undefined;
    } catch {
        return undefined;
    }
};

const getJiraIssueUpdatedLabel = (issue: Pick<JiraTicket, 'updated'>): string => {
    if (!issue.updated) {
        return '';
    }

    return formatDisplayDate(issue.updated);
};

const getJiraIssueFreshnessItems = (jiraIssues: JiraTicket[]): string[] => {
    return jiraIssues
        .filter((issue) => Boolean(issue.key && issue.updated))
        .sort((a, b) => {
            const aTime = new Date(a.updated || '').getTime();
            const bTime = new Date(b.updated || '').getTime();
            const safeATime = Number.isNaN(aTime) ? 0 : aTime;
            const safeBTime = Number.isNaN(bTime) ? 0 : bTime;
            return safeBTime - safeATime;
        })
        .slice(0, 3)
        .map((issue) => `${issue.key} ${getJiraIssueUpdatedLabel(issue)}`.trim());
};

const getFieldEvidenceItems = (suggestion: ProjectUpdateSuggestion, field: UpdateField): string[] => {
    const items: string[] = [];
    const jiraIssues = suggestion.sourceInfo?.jiraIssues || [];
    const chatHistory = suggestion.sourceInfo?.chatHistory || [];

    if (field === 'status') {
        addUniqueEvidenceItem(items, suggestion.suggestedStatusReason);
        jiraIssues.slice(0, 3).forEach((issue) => {
            const updatedLabel = getJiraIssueUpdatedLabel(issue);
            addUniqueEvidenceItem(
                items,
                issue.status
                    ? `Jira ${issue.key}: ${issue.status}${updatedLabel ? ` · 更新 ${updatedLabel}` : ''}`
                    : undefined,
            );
        });
    }

    if (field === 'owner') {
        addUniqueEvidenceItem(items, suggestion.suggestedOwnerReason);
        const suggestedOwner = normalizeComparableText(suggestion.suggestedOwner);
        jiraIssues.slice(0, 3).forEach((issue) => {
            const assignee = normalizeComparableText(issue.assignee);
            if (suggestedOwner && assignee && assignee === suggestedOwner) {
                const updatedLabel = getJiraIssueUpdatedLabel(issue);
                addUniqueEvidenceItem(
                    items,
                    `Jira ${issue.key}: assignee ${issue.assignee}${updatedLabel ? ` · 更新 ${updatedLabel}` : ''}`,
                );
            }
        });
    }

    if (field === 'track') {
        addUniqueEvidenceItem(items, suggestion.suggestedTrackReason);
    }

    if (field === 'comments') {
        addUniqueEvidenceItem(items, suggestion.suggestedCommentsReason);
        if (items.length === 0 && chatHistory.length > 0) {
            addUniqueEvidenceItem(items, `历史上下文: ${chatHistory.length} 条记录`);
        }
    }

    return items.slice(0, 3);
};

const getSuggestionEvidenceItems = (suggestion: ProjectUpdateSuggestion): string[] => {
    const items: string[] = [];
    const jiraIssues = suggestion.sourceInfo?.jiraIssues || [];
    const chatHistory = suggestion.sourceInfo?.chatHistory || [];

    if (jiraIssues.length > 0) {
        const jiraKeys = jiraIssues
            .map((issue) => issue.key)
            .filter(Boolean)
            .slice(0, 3)
            .join(', ');
        addUniqueEvidenceItem(
            items,
            jiraKeys
                ? `Jira: ${jiraKeys}${jiraIssues.length > 3 ? ` 等 ${jiraIssues.length} 个工单` : ''}`
                : `Jira: ${jiraIssues.length} 个相关工单`,
        );
        const freshnessItems = getJiraIssueFreshnessItems(jiraIssues);
        if (freshnessItems.length > 0) {
            addUniqueEvidenceItem(items, `Jira 最近更新: ${freshnessItems.join('；')}`);
        }
    }

    if (chatHistory.length > 0) {
        addUniqueEvidenceItem(items, `历史上下文: ${chatHistory.length} 条记录`);
    }

    suggestion.reason?.forEach((reason) => addUniqueEvidenceItem(items, reason));
    addUniqueEvidenceItem(items, suggestion.suggestedStatusReason);
    addUniqueEvidenceItem(items, suggestion.suggestedOwnerReason);
    addUniqueEvidenceItem(items, suggestion.suggestedTrackReason);
    addUniqueEvidenceItem(items, suggestion.suggestedCommentsReason);

    return items.slice(0, 5);
};

const hasVisibleEvidence = (suggestion: ProjectUpdateSuggestion): boolean => (
    getSuggestionEvidenceItems(suggestion).length > 0
);

const shouldDefaultSelectField = (suggestion: ProjectUpdateSuggestion, field: UpdateField): boolean => (
    (suggestion.confidence || 0) >= HIGH_CONFIDENCE_THRESHOLD &&
    getFieldEvidenceItems(suggestion, field).length > 0
);

const getDefaultSelectableFields = (suggestion: ProjectUpdateSuggestion): UpdateField[] => (
    getAvailableUpdateFields(suggestion).filter((field) => shouldDefaultSelectField(suggestion, field))
);

const getReviewRequiredFields = (suggestion: ProjectUpdateSuggestion): UpdateField[] => (
    getAvailableUpdateFields(suggestion).filter((field) => !shouldDefaultSelectField(suggestion, field))
);

const shouldDefaultSelectSuggestion = (suggestion: ProjectUpdateSuggestion): boolean => (
    getDefaultSelectableFields(suggestion).length > 0
);

const isSuggestionReviewRequired = (suggestion: ProjectUpdateSuggestion): boolean => (
    (suggestion.confidence || 0) < HIGH_CONFIDENCE_THRESHOLD ||
    getReviewRequiredFields(suggestion).length > 0
);

const confidenceReviewText = (suggestion: ProjectUpdateSuggestion): string => {
    const confidence = suggestion.confidence || 0;
    const availableFields = getAvailableUpdateFields(suggestion);
    const defaultSelectableFields = getDefaultSelectableFields(suggestion);

    if (availableFields.length === 0) {
        return getUnavailableUpdateFields(suggestion).length > 0
            ? '缺少可写列 · 需手动处理'
            : '无新增可写字段';
    }

    if (confidence < HIGH_CONFIDENCE_THRESHOLD) {
        return '需复核 · 未默认选中';
    }

    if (!hasVisibleEvidence(suggestion)) {
        return '高可信但缺少来源 · 需复核';
    }

    if (defaultSelectableFields.length === availableFields.length) {
        return '高可信字段有来源 · 已默认选中';
    }

    if (defaultSelectableFields.length > 0) {
        return `部分字段有来源 · 默认 ${defaultSelectableFields.length}/${availableFields.length}`;
    }

    return '高可信但字段来源不足 · 需复核';
};

const getFieldEvidenceSummary = (suggestion: ProjectUpdateSuggestion, field: UpdateField): string => (
    getFieldEvidenceItems(suggestion, field).join('；')
);

const getFieldReviewHint = (suggestion: ProjectUpdateSuggestion, field: UpdateField): string => {
    if (shouldDefaultSelectField(suggestion, field)) {
        return `${UPDATE_FIELD_SHORT_LABELS[field]}来源: ${getFieldEvidenceSummary(suggestion, field)}`;
    }

    if ((suggestion.confidence || 0) < HIGH_CONFIDENCE_THRESHOLD) {
        return `${UPDATE_FIELD_SHORT_LABELS[field]}建议置信度偏低，需人工确认后勾选。`;
    }

    return `${UPDATE_FIELD_SHORT_LABELS[field]}缺少直接来源，不会默认写回。`;
};

const formatWritebackTargetText = (suggestion: ProjectUpdateSuggestion, field: UpdateField): string => {
    const slideLabel = suggestion.slideId
        ? suggestion.slideId
        : 'slide 未确认';
    const tableLabel = suggestion.tableId
        ? suggestion.tableId
        : 'table 未确认';
    const rowLabel = hasWritableColumnIndex(suggestion.rowIndex)
        ? `表格第 ${suggestion.rowIndex + 1} 行`
        : '行定位缺失';
    const columnIndex = suggestion.columnIndices?.[field];
    const columnLabel = hasWritableColumnIndex(columnIndex)
        ? `${UPDATE_FIELD_SHORT_LABELS[field]}第 ${columnIndex + 1} 列`
        : `${UPDATE_FIELD_SHORT_LABELS[field]}列定位缺失`;

    return `写入目标: ${slideLabel} / ${tableLabel} / ${rowLabel} / ${columnLabel}`;
};

const formatUpdateFieldNames = (fields: UpdateField[]): string => (
    fields.map((field) => UPDATE_FIELD_SHORT_LABELS[field]).join('、')
);

const compactPreviewText = (value: unknown, maxLength = SELECTED_FIELD_PREVIEW_TEXT_LIMIT): string => {
    if (typeof value !== 'string' || !value.trim()) {
        return '空';
    }

    const compacted = value.replace(/\s+/g, ' ').trim();
    if (compacted.length <= maxLength) {
        return compacted;
    }

    return `${compacted.slice(0, Math.max(0, maxLength - 3))}...`;
};

const normalizeForSkippedReasonMatch = (value: unknown): string => {
    if (typeof value !== 'string') {
        return '';
    }

    return value
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
};

const uniqueNormalizedMatchTokens = (values: unknown[]): string[] => {
    const tokens: string[] = [];

    values.forEach((value) => {
        const normalized = normalizeForSkippedReasonMatch(value);
        if (normalized && normalized.length > 1 && !tokens.includes(normalized)) {
            tokens.push(normalized);
        }
    });

    return tokens;
};

const getApplySkippedFieldMatchTokens = (item: SelectedFieldPreviewItem): string[] => (
    uniqueNormalizedMatchTokens([
        item.fieldLabel,
        UPDATE_FIELD_LABELS[item.field],
        UPDATE_FIELD_COLUMN_LABELS[item.field],
        item.field,
        ...UPDATE_FIELD_MATCH_ALIASES[item.field],
    ])
);

const getApplySkippedTargetMatchTokens = (item: SelectedFieldPreviewItem): string[] => {
    const targetText = item.targetText.replace(/^写入目标:\s*/, '');
    const targetParts = targetText
        .split('/')
        .map((part) => part.trim())
        .filter((part) => (
            part &&
            !/未确认|缺失/i.test(part)
        ));

    const rowMatch = targetText.match(/表格第\s*(\d+)\s*行/);
    const columnMatch = targetText.match(/第\s*(\d+)\s*列/);
    const rowNumber = rowMatch ? Number(rowMatch[1]) : undefined;
    const columnNumber = columnMatch ? Number(columnMatch[1]) : undefined;
    const generatedTokens: string[] = [];

    if (Number.isInteger(rowNumber) && rowNumber && rowNumber > 0) {
        generatedTokens.push(
            `row ${rowNumber}`,
            `row index ${rowNumber - 1}`,
            `rowIndex ${rowNumber - 1}`,
            `r${rowNumber}`,
        );
    }

    if (Number.isInteger(columnNumber) && columnNumber && columnNumber > 0) {
        generatedTokens.push(
            `column ${columnNumber}`,
            `column index ${columnNumber - 1}`,
            `columnIndex ${columnNumber - 1}`,
            `col ${columnNumber}`,
            `c${columnNumber}`,
        );
    }

    if (
        Number.isInteger(rowNumber) &&
        rowNumber &&
        rowNumber > 0 &&
        Number.isInteger(columnNumber) &&
        columnNumber &&
        columnNumber > 0
    ) {
        generatedTokens.push(
            `row ${rowNumber} column ${columnNumber}`,
            `r${rowNumber}c${columnNumber}`,
        );
    }

    return uniqueNormalizedMatchTokens([...targetParts, ...generatedTokens]);
};

const getApplySkippedReasonMatchScore = (error: string, item: SelectedFieldPreviewItem): number => {
    const normalizedError = normalizeForSkippedReasonMatch(error);
    const projectParts = item.projectLabel.split('·').map((part) => part.trim()).filter(Boolean);
    const projectId = projectParts[0] || '';
    const projectName = projectParts.slice(1).join(' · ');
    const projectIdMatched = Boolean(projectId && normalizedError.includes(normalizeForSkippedReasonMatch(projectId)));
    const projectNameMatched = Boolean(projectName && normalizedError.includes(normalizeForSkippedReasonMatch(projectName)));
    const projectMatched = projectIdMatched || projectNameMatched;
    const fieldMatched = getApplySkippedFieldMatchTokens(item)
        .some((token) => normalizedError.includes(token));
    const targetMatchCount = getApplySkippedTargetMatchTokens(item)
        .filter((token) => normalizedError.includes(token))
        .length;

    if (!projectMatched && !fieldMatched && targetMatchCount < 3) {
        return 0;
    }

    if (!projectMatched && targetMatchCount < 2) {
        return 0;
    }

    if (projectMatched && !fieldMatched && targetMatchCount < 2) {
        return 0;
    }

    return (
        (projectIdMatched ? 4 : 0) +
        (projectNameMatched ? 2 : 0) +
        (fieldMatched ? 4 : 0) +
        targetMatchCount
    );
};

const findApplySkippedHandoffMatch = (
    error: string,
    items: SelectedFieldPreviewItem[],
): SelectedFieldPreviewItem | undefined => {
    const matches = items
        .map((item) => ({
            item,
            score: getApplySkippedReasonMatchScore(error, item),
        }))
        .filter((match) => match.score > 0)
        .sort((a, b) => b.score - a.score);

    if (matches.length === 0) {
        return undefined;
    }

    if (matches.length > 1 && matches[0].score === matches[1].score) {
        return undefined;
    }

    return matches[0].item;
};

const getSelectedFieldPreviewItemKey = (item: SelectedFieldPreviewItem): string => (
    fieldKey(item.projectIndex, item.field)
);

const getSelectedFieldPreviewSignature = (items: SelectedFieldPreviewItem[]): string => (
    items.map(getSelectedFieldPreviewItemKey).sort().join('|')
);

const getApplySkippedMatchSummary = (result: ApplyResultReceipt): ApplySkippedMatchSummary => {
    const matchedKeys = new Set<string>();
    const unmatchedReasons: string[] = [];

    result.errors.forEach((reason) => {
        const matchedItem = findApplySkippedHandoffMatch(reason, result.submittedItems);
        if (matchedItem) {
            matchedKeys.add(getSelectedFieldPreviewItemKey(matchedItem));
        } else {
            unmatchedReasons.push(reason);
        }
    });

    return {
        matchedKeys,
        unmatchedReasons,
    };
};

const getApplyConfirmedSubmittedItems = (result: ApplyResultReceipt): SelectedFieldPreviewItem[] => {
    if (result.errors.length === 0) {
        return result.submittedItems;
    }

    const skippedSummary = getApplySkippedMatchSummary(result);
    if (skippedSummary.unmatchedReasons.length > 0) {
        return [];
    }

    if (skippedSummary.matchedKeys.size === 0) {
        return [];
    }

    return result.submittedItems.filter((item) => !skippedSummary.matchedKeys.has(getSelectedFieldPreviewItemKey(item)));
};

const getApplyMatchedSkippedSubmittedItems = (result: ApplyResultReceipt): SelectedFieldPreviewItem[] => {
    if (result.errors.length === 0) {
        return [];
    }

    const skippedSummary = getApplySkippedMatchSummary(result);
    const emittedKeys = new Set<string>();
    return result.submittedItems.filter((item) => {
        const key = getSelectedFieldPreviewItemKey(item);
        if (!skippedSummary.matchedKeys.has(key) || emittedKeys.has(key)) {
            return false;
        }

        emittedKeys.add(key);
        return true;
    });
};

const getApplySkippedNextStep = (error: string): string => {
    if (/没有返回具体跳过原因|未返回具体跳过原因|unexplained/i.test(error)) {
        return '先回到 Slides 对照本次提交字段核对实际内容；未解释字段不要当成已写入，必要时重新分析后分批提交。';
    }

    if (/subrequest|invalid request|batchupdate rejected|atomic|整批/i.test(error)) {
        return '先按本次字段目标核对 slide、表格、行列和权限；修复后整批重试，不要把这批字段当成已写入。';
    }

    if (/缺少可写表格列|missing writable column/i.test(error)) {
        return '在 Slides 表格补齐对应列，或按建议值手动填入后重新分析。';
    }

    if (/位置信息|定位|row|column|cell/i.test(error)) {
        return '回到原 slide 确认项目行仍存在，再重新触发分析。';
    }

    if (/api|permission|权限|token|auth/i.test(error)) {
        return '确认 Slides 权限和登录状态后重试；不要重复提交已确认写入的字段。';
    }

    return '先核对本次提交字段和原因，再回到 Slides 手动处理或重新分析。';
};

const buildUnexplainedApplySkippedReason = (
    updatedCount: number,
    submittedCount: number,
    unexplainedCount: number,
): string => (
    `Google Slides 返回已确认写回 ${updatedCount} 个字段，但本次提交 ${submittedCount} 个字段中还有 ${unexplainedCount} 个字段没有返回具体跳过原因；请回到 Slides 核对目标单元格，不要把未解释字段当成已落地。`
);

const normalizeApplySuccessSkippedErrors = (
    updatedCount: number,
    submittedItems: SelectedFieldPreviewItem[],
    returnedErrors: string[],
): string[] => {
    const submittedCount = submittedItems.length;
    const unexplainedCount = Math.max(0, submittedCount - updatedCount - returnedErrors.length);

    if (unexplainedCount === 0) {
        return returnedErrors;
    }

    return [
        ...returnedErrors,
        buildUnexplainedApplySkippedReason(updatedCount, submittedCount, unexplainedCount),
    ];
};

const buildApplySkippedHandoffItems = (result: ApplyResultReceipt): ApplySkippedHandoffItem[] => (
    result.errors.map((reason) => {
        const matchedItem = findApplySkippedHandoffMatch(reason, result.submittedItems);

        return {
            reason,
            projectLabel: matchedItem?.projectLabel || '未匹配到提交字段',
            fieldLabel: matchedItem?.fieldLabel || '跳过项',
            previewText: matchedItem?.previewText || '请根据跳过原因回到 Slides 手动核对。',
            evidenceText: matchedItem?.evidenceText || '没有匹配到字段级回执；请优先查看原始跳过原因。',
            targetText: matchedItem?.targetText || '写入目标: 未匹配到字段级定位；请按跳过原因回到 Slides 手动核对。',
            nextStep: getApplySkippedNextStep(reason),
            matched: Boolean(matchedItem),
        };
    })
);

const formatApplySkippedHandoffChecklist = (
    result: ApplyResultReceipt,
    items: ApplySkippedHandoffItem[],
    presentationId = '',
): string => {
    if (items.length === 0) {
        return '';
    }

    const confirmedItems = getApplyConfirmedSubmittedItems(result);
    const skippedMatchSummary = getApplySkippedMatchSummary(result);
    const confirmedBatchLine = skippedMatchSummary.unmatchedReasons.length > 0
        ? `Google Slides 已确认写回 ${result.updatedCount} 个字段，但 ${skippedMatchSummary.unmatchedReasons.length} 个跳过或缺失原因未能匹配到具体字段；已隐藏字段级确认列表。`
        : confirmedItems.length > 0
        ? getAtomicBatchSummary(confirmedItems)
        : '没有可确认字段进入 Google Slides batchUpdate。';

    return [
        'Google Slides 跳过字段接管清单',
        `Presentation: ${presentationId || 'unknown'}`,
        `Confirmed writeback: Google Slides 已确认写回 ${result.updatedCount} 个字段。`,
        `Skipped or unconfirmed: ${result.skippedCount} 项没有字段级写入确认；可能是本地预检跳过、API 跳过，或成功回包缺少具体原因。`,
        `Confirmed batch: ${confirmedBatchLine}`,
        `Selected before precheck: ${getAtomicBatchSummary(result.submittedItems)}`,
        'Boundary: Google Slides 已确认已发送批次整体完成；下列跳过或未解释项没有字段级写入确认，也不应当成已落地。',
        'Non-effects: 未选、无法写回、仅风险关注项不会写入，也不会反写 Jira 或 Memory Service。',
        '',
        ...items.map((item, index) => [
            `${index + 1}. ${item.projectLabel} · ${item.fieldLabel}`,
            `   建议: ${item.previewText}`,
            `   目标: ${item.targetText.replace(/^写入目标:\s*/, '')}`,
            `   依据: ${item.evidenceText}`,
            `   跳过原因: ${item.reason}`,
            `   下一步: ${item.nextStep}`,
        ].join('\n')),
    ].join('\n');
};

const buildApplyFailureHandoffItems = (failure: ApplyFailureReceipt): ApplySkippedHandoffItem[] => {
    const reason = failure.errors[0] || failure.errorMessage || 'Google Slides 未确认写回结果';
    const nextStep = getApplySkippedNextStep(reason);

    return failure.submittedItems.map((item) => ({
        reason,
        projectLabel: item.projectLabel,
        fieldLabel: item.fieldLabel,
        previewText: item.previewText,
        evidenceText: item.evidenceText,
        targetText: item.targetText,
        nextStep,
        matched: true,
    }));
};

const formatApplyFailureHandoffChecklist = (
    failure: ApplyFailureReceipt,
    items: ApplySkippedHandoffItem[],
): string => {
    if (items.length === 0) {
        return '';
    }

    return [
        'Google Slides 写回失败接管清单',
        `Failure: ${failure.errorMessage || 'Google Slides 未确认写回结果'}`,
        `Boundary: Google Slides 没有确认这批字段写入；不要把它们当成已落地。`,
        'Reasons:',
        ...failure.errors.map((error) => `- ${error}`),
        '',
        ...items.map((item, index) => [
            `${index + 1}. ${item.projectLabel} · ${item.fieldLabel}`,
            `   建议: ${item.previewText}`,
            `   目标: ${item.targetText.replace(/^写入目标:\s*/, '')}`,
            `   依据: ${item.evidenceText}`,
            `   失败原因: ${item.reason}`,
            `   下一步: ${item.nextStep}`,
        ].join('\n')),
    ].join('\n');
};

const getAtomicBatchProjectCount = (items: SelectedFieldPreviewItem[]): number => (
    new Set(items.map((item) => item.projectIndex)).size
);

const getAtomicBatchRequestCount = (items: SelectedFieldPreviewItem[]): number => (
    items.length * 2
);

const getAtomicBatchSummary = (items: SelectedFieldPreviewItem[]): string => (
    `一次原子批量写回: ${items.length} 个字段 / ${getAtomicBatchProjectCount(items)} 个项目，约 ${getAtomicBatchRequestCount(items)} 个 Slides 子请求。`
);

const ATOMIC_BATCH_BOUNDARY_TEXT = 'Google Slides batchUpdate 任一子请求无效时，整批不会写入；本地预检跳过项不会进入这批请求。';

const buildSelectedWritebackDecisionReceiptLines = (
    items: SelectedFieldPreviewItem[],
    visibleSelectedUpdateCount: number,
    hiddenSelectedUpdateCount: number,
    selectedReviewFieldCount: number,
    snapshotBasisLine = '',
    snapshotAgeLine = '',
): string[] => {
    if (items.length === 0) {
        return [];
    }

    const sourcedFieldCount = Math.max(0, items.length - selectedReviewFieldCount);
    const projectCount = getAtomicBatchProjectCount(items);
    const reviewLine = selectedReviewFieldCount > 0
        ? `复核状态: ${sourcedFieldCount} 个来源充分，${selectedReviewFieldCount} 个由你手动纳入；应用前仍需核对建议值、来源和目标单元格。`
        : `复核状态: ${sourcedFieldCount} 个字段均有直接来源；应用前仍保留目标单元格核对。`;

    return [
        `提交范围: ${items.length} 个字段 / ${projectCount} 个项目；当前视图 ${visibleSelectedUpdateCount} 个，隐藏 ${hiddenSelectedUpdateCount} 个。`,
        ...(snapshotBasisLine ? [snapshotBasisLine] : []),
        ...(snapshotAgeLine ? [snapshotAgeLine] : []),
        reviewLine,
        '执行边界: 只把已选字段发给 Google Slides；未选、无法写回、仅风险关注项不会写入，也不会反写 Jira 或 Memory Service。',
    ];
};

const buildReviewPacketCopyReceiptLines = (
    receipt: ReviewPacketCopyReceipt,
    currentSelectionSignature: string,
    currentSelectedFieldCount: number,
): string[] => {
    const presentationText = receipt.presentationId || 'unknown';
    const stale = receipt.selectionSignature !== currentSelectionSignature ||
        receipt.copiedFieldCount !== currentSelectedFieldCount;
    const statusLine = receipt.status === 'success'
        ? `复核清单复制回执: ${receipt.copiedAt} 已复制 ${receipt.copiedFieldCount} 个字段 / ${receipt.copiedProjectCount} 个项目；presentation ${presentationText}。`
        : `复核清单复制回执: 本机剪贴板未确认写入；${receipt.copiedFieldCount} 个字段仍只停留在页面预览。`;
    const selectionLine = `复制快照: 当时当前视图 ${receipt.visibleSelectedUpdateCount} 个，隐藏 ${receipt.hiddenSelectedUpdateCount} 个，人工纳入 ${receipt.selectedReviewFieldCount} 个。`;
    const staleLine = stale
        ? `当前选择已变更: 现在已选 ${currentSelectedFieldCount} 个字段；剪贴板里的旧清单不会自动更新，提交前请重新复制或以页面预览为准。`
        : '当前选择仍匹配这份复制清单；提交前仍以页面预览和 Google Slides 回包为准。';
    const boundaryLine = receipt.status === 'success'
        ? '非效果: 复制只写入本机剪贴板，不会写回 Slides、不重新分析 deck，也不会反写 Jira 或 Memory Service。'
        : '失败边界: 页面没有提交任何字段，也没有写回 Slides、Jira 或 Memory Service；请直接查看页面预览或稍后重试复制。';

    return [statusLine, selectionLine, staleLine, boundaryLine];
};

const buildApplySubmissionReceiptLines = (
    items: SelectedFieldPreviewItem[],
    presentationId: string,
    snapshotBasisLine = '',
    snapshotAgeLine = '',
): string[] => {
    if (items.length === 0) {
        return [];
    }

    return [
        `提交中回执: 已向原 Google Slides 页面发送 ${items.length} 个字段 / ${getAtomicBatchProjectCount(items)} 个项目的写回请求；presentation ${presentationId || 'unknown'}。`,
        ...(snapshotBasisLine ? [snapshotBasisLine] : []),
        ...(snapshotAgeLine ? [snapshotAgeLine] : []),
        `锁定批次: ${getAtomicBatchSummary(items)}字段勾选、筛选视图、全选和复核队列已暂时锁定，等待 Google Slides API 返回。`,
        '等待边界: 本页不会追加新字段、不会重新分析 deck、不会反写 Jira 或 Memory Service；如果超时，先回到 Slides 核对实际内容。',
    ];
};

const formatSelectedWritebackReviewPacket = (
    items: SelectedFieldPreviewItem[],
    presentationId: string,
    decisionReceiptLines: string[] = [],
): string => {
    if (items.length === 0) {
        return '';
    }

    return [
        'Google Slides 写回复核清单',
        `Presentation: ${presentationId || 'unknown'}`,
        `Selected fields: ${items.length}`,
        `Batch: ${getAtomicBatchSummary(items)}`,
        `Batch boundary: ${ATOMIC_BATCH_BOUNDARY_TEXT}`,
        '',
        ...(decisionReceiptLines.length > 0
            ? [
                'Decision receipt:',
                ...decisionReceiptLines.map((line) => `- ${line}`),
                '',
            ]
            : []),
        ...items.map((item, index) => [
            `${index + 1}. ${item.projectLabel} · ${item.fieldLabel}`,
            `   变更: ${item.previewText}`,
            `   目标: ${item.targetText.replace(/^写入目标:\s*/, '')}`,
            `   依据: ${item.evidenceText}`,
            `   复核: ${item.reviewLabel}`,
        ].join('\n')),
    ].join('\n');
};

const copyTextToClipboard = async (text: string): Promise<boolean> => {
    try {
        const writeText = window.navigator.clipboard?.writeText?.bind(window.navigator.clipboard);
        if (writeText) {
            await writeText(text);
            return true;
        }
    } catch (error) {
        console.warn('Clipboard API copy failed:', error);
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    try {
        return document.execCommand('copy');
    } catch (error) {
        console.warn('Fallback copy failed:', error);
        return false;
    } finally {
        document.body.removeChild(textarea);
    }
};

const getFieldCurrentValue = (suggestion: ProjectUpdateSuggestion, field: UpdateField): string | undefined => {
    if (field === 'status') {
        return suggestion.currentStatus;
    }
    if (field === 'owner') {
        return suggestion.currentOwner;
    }
    if (field === 'track') {
        return suggestion.currentTrack;
    }

    return suggestion.currentComments;
};

const getFieldSuggestedValue = (suggestion: ProjectUpdateSuggestion, field: UpdateField): string | undefined => {
    if (field === 'status') {
        return suggestion.suggestedStatus;
    }
    if (field === 'owner') {
        return suggestion.suggestedOwner;
    }
    if (field === 'track') {
        return suggestion.suggestedTrack;
    }

    return getNewSuggestedComments(suggestion);
};

const buildSelectedFieldPreviewItem = (
    suggestion: ProjectUpdateSuggestion,
    projectIndex: number,
    field: UpdateField,
): SelectedFieldPreviewItem => {
    const reviewKind = shouldDefaultSelectField(suggestion, field) ? 'ready' : 'review';
    const currentValue = compactPreviewText(getFieldCurrentValue(suggestion, field));
    const suggestedValue = compactPreviewText(getFieldSuggestedValue(suggestion, field));
    const fieldEvidence = getFieldEvidenceItems(suggestion, field).join('；');
    const fieldHint = getFieldReviewHint(suggestion, field);
    const isComments = field === 'comments';
    const rawEvidenceText = reviewKind === 'ready'
        ? fieldHint
        : (fieldEvidence ? `${fieldHint} ${fieldEvidence}` : fieldHint);

    return {
        projectIndex,
        field,
        projectLabel: `${suggestion.projectId} · ${suggestion.projectName}`,
        fieldLabel: UPDATE_FIELD_SHORT_LABELS[field],
        previewText: isComments
            ? `${suggestion.currentComments ? '追加备注' : '设置备注'}: ${suggestedValue}`
            : `${currentValue} -> ${suggestedValue}`,
        evidenceText: compactPreviewText(rawEvidenceText, SELECTED_FIELD_EVIDENCE_TEXT_LIMIT),
        targetText: formatWritebackTargetText(suggestion, field),
        reviewKind,
        reviewLabel: reviewKind === 'ready' ? '来源充分' : '需人工复核',
    };
};

const buildBlockedFieldDetailItem = (
    suggestion: ProjectUpdateSuggestion,
    field: UpdateField,
): BlockedFieldDetailItem => {
    const currentValue = compactPreviewText(getFieldCurrentValue(suggestion, field));
    const suggestedValue = compactPreviewText(getFieldSuggestedValue(suggestion, field));
    const fieldEvidence = getFieldEvidenceItems(suggestion, field).join('；');
    const fieldHint = getFieldReviewHint(suggestion, field);
    const evidenceText = fieldEvidence && !fieldHint.includes(fieldEvidence)
        ? `${fieldHint} ${fieldEvidence}`
        : fieldHint;

    return {
        field,
        fieldLabel: UPDATE_FIELD_SHORT_LABELS[field],
        previewText: field === 'comments'
            ? `${suggestion.currentComments ? '追加备注' : '设置备注'}: ${suggestedValue}`
            : `${currentValue} -> ${suggestedValue}`,
        evidenceText: compactPreviewText(evidenceText, SELECTED_FIELD_EVIDENCE_TEXT_LIMIT),
    };
};

const getBlockedFieldDetailItems = (suggestion: ProjectUpdateSuggestion): BlockedFieldDetailItem[] => (
    getUnavailableUpdateFieldTypes(suggestion).map((field) => buildBlockedFieldDetailItem(suggestion, field))
);

const getProjectReviewNote = (suggestion: ProjectUpdateSuggestion): string => {
    const confidence = suggestion.confidence || 0;
    const reviewFields = getReviewRequiredFields(suggestion);

    if (confidence < HIGH_CONFIDENCE_THRESHOLD) {
        const fieldNames = reviewFields.length > 0 ? `（${formatUpdateFieldNames(reviewFields)}）` : '';
        return `低可信建议${fieldNames}未自动选中，来源或理由不足时保持不写回。`;
    }

    if (!hasVisibleEvidence(suggestion)) {
        return '缺少可见来源或理由，需人工确认后手动勾选。';
    }

    if (reviewFields.length > 0) {
        return `部分字段缺少直接来源，未默认勾选: ${formatUpdateFieldNames(reviewFields)}。可在字段复核队列中处理。`;
    }

    return '建议需人工确认后手动勾选。';
};

const isRiskInsightOnlySuggestion = (suggestion: ProjectUpdateSuggestion): boolean => (
    getAvailableUpdateFields(suggestion).length === 0 &&
    getUnavailableUpdateFields(suggestion).length === 0 &&
    getRiskEvidenceItems(suggestion).length > 0
);

const getAvailableUpdateFields = (suggestion: ProjectUpdateSuggestion): UpdateField[] => {
    const fields: UpdateField[] = [];
    const hasStatusColumn = hasWritableColumnIndex(suggestion.columnIndices?.status);
    const hasOwnerColumn = hasWritableColumnIndex(suggestion.columnIndices?.owner);
    const hasTrackColumn = hasWritableColumnIndex(suggestion.columnIndices?.track);
    const hasCommentsColumn = hasWritableColumnIndex(suggestion.columnIndices?.comments);

    if (hasStatusColumn && hasMeaningfulSuggestedChange(suggestion.currentStatus, suggestion.suggestedStatus)) {
        fields.push('status');
    }
    if (hasCommentsColumn && getNewSuggestedComments(suggestion)) {
        fields.push('comments');
    }
    if (hasOwnerColumn && hasMeaningfulSuggestedChange(suggestion.currentOwner, suggestion.suggestedOwner)) {
        fields.push('owner');
    }
    if (hasTrackColumn && hasMeaningfulSuggestedChange(suggestion.currentTrack, suggestion.suggestedTrack)) {
        fields.push('track');
    }

    return fields;
};

const getUnavailableUpdateFields = (suggestion: ProjectUpdateSuggestion): string[] => {
    return getUnavailableUpdateFieldTypes(suggestion).map((field) => UPDATE_FIELD_COLUMN_LABELS[field]);
};

const getUnavailableUpdateFieldTypes = (suggestion: ProjectUpdateSuggestion): UpdateField[] => {
    const fields: UpdateField[] = [];

    if (
        hasMeaningfulSuggestedChange(suggestion.currentStatus, suggestion.suggestedStatus) &&
        !hasWritableColumnIndex(suggestion.columnIndices?.status)
    ) {
        fields.push('status');
    }

    if (
        getNewSuggestedComments(suggestion) &&
        !hasWritableColumnIndex(suggestion.columnIndices?.comments)
    ) {
        fields.push('comments');
    }

    if (
        hasMeaningfulSuggestedChange(suggestion.currentOwner, suggestion.suggestedOwner) &&
        !hasWritableColumnIndex(suggestion.columnIndices?.owner)
    ) {
        fields.push('owner');
    }

    if (
        hasMeaningfulSuggestedChange(suggestion.currentTrack, suggestion.suggestedTrack) &&
        !hasWritableColumnIndex(suggestion.columnIndices?.track)
    ) {
        fields.push('track');
    }

    return fields;
};

const getAllowedOpenerOrigin = (): string => {
    try {
        const referrerOrigin = new URL(document.referrer).origin;
        if (referrerOrigin === GOOGLE_SLIDES_ORIGIN) {
            return referrerOrigin;
        }
    } catch {
        // Fall through to the Google Slides origin used by the content script.
    }

    return GOOGLE_SLIDES_ORIGIN;
};

interface ToastProps {
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
    onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, type, onClose }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose();
        }, 5000);

        return () => clearTimeout(timer);
    }, [onClose]);

    return (
        <div className={`toast toast-${type}`}>
            {message}
        </div>
    );
};

const SlidesAnalysis: React.FC = () => {
    const [analysisResult, setAnalysisResult] = useState<DisplaySlideAnalysisResult | null>(null);
    const [presentationId, setPresentationId] = useState<string>('');
    const [analysisReceivedAt, setAnalysisReceivedAt] = useState<string>('');
    const [analysisReceivedAtMs, setAnalysisReceivedAtMs] = useState<number>(0);
    const [toast, setToast] = useState<{ message: string; type: 'info' | 'success' | 'warning' | 'error' } | null>(null);
    const [isApplying, setIsApplying] = useState(false);
    const [selectedFields, setSelectedFields] = useState<Record<string, boolean>>({});
    const [reviewFilter, setReviewFilter] = useState<ReviewFilter>('all');
    const [lastApplyResult, setLastApplyResult] = useState<ApplyResultReceipt | null>(null);
    const [lastApplyFailure, setLastApplyFailure] = useState<ApplyFailureReceipt | null>(null);
    const [loadError, setLoadError] = useState<string>('');
    const [loadRecoveryReceipt, setLoadRecoveryReceipt] = useState<string>('');
    const [selectionScopeReceipt, setSelectionScopeReceipt] = useState<string>('');
    const [applySubmissionReceiptLines, setApplySubmissionReceiptLines] = useState<string[]>([]);
    const [reviewPacketCopyReceipt, setReviewPacketCopyReceipt] = useState<ReviewPacketCopyReceipt | null>(null);
    const pendingApplyPreviewItemsRef = useRef<SelectedFieldPreviewItem[]>([]);
    const applyTimeoutRef = useRef<number | null>(null);
    const initialDataTimeoutRef = useRef<number | null>(null);

    const clearApplyTimeout = () => {
        if (applyTimeoutRef.current === null) {
            return;
        }

        window.clearTimeout(applyTimeoutRef.current);
        applyTimeoutRef.current = null;
    };

    const clearInitialDataTimeout = () => {
        if (initialDataTimeoutRef.current === null) {
            return;
        }

        window.clearTimeout(initialDataTimeoutRef.current);
        initialDataTimeoutRef.current = null;
    };

    useEffect(() => {
        initAnalysisPage();
        
        // 接收来自父窗口的消息
        const handleParentMessage = (event: MessageEvent) => {
            handleParentMessageReceived(event);
        };
        
        window.addEventListener('message', handleParentMessage);
        
        return () => {
            window.removeEventListener('message', handleParentMessage);
            clearApplyTimeout();
            clearInitialDataTimeout();
        };
    }, []);

    useEffect(() => {
        if (!analysisResult) {
            setSelectedFields({});
            setLastApplyResult(null);
            setSelectionScopeReceipt('');
            setApplySubmissionReceiptLines([]);
            setReviewPacketCopyReceipt(null);
            setAnalysisReceivedAtMs(0);
            return;
        }

        const defaults: Record<string, boolean> = {};
        analysisResult.updateSuggestions.forEach((suggestion, projectIndex) => {
            getDefaultSelectableFields(suggestion).forEach((field) => {
                defaults[fieldKey(projectIndex, field)] = true;
            });
        });

        setSelectedFields(defaults);
        setLastApplyResult(null);
        setSelectionScopeReceipt('');
        setApplySubmissionReceiptLines([]);
        setReviewPacketCopyReceipt(null);
    }, [analysisResult]);

    const initAnalysisPage = (isRetry = false) => {
        try {
            setLoadError('');
            clearInitialDataTimeout();

            // 告知父窗口页面已加载完成，请求数据
            if (window.opener) {
                if (isRetry) {
                    setLoadRecoveryReceipt(
                        '重新请求回执: 只向原 Google Slides 页面请求当前分析结果快照；不会重新分析 deck、不会写回 Slides、不会反写 Jira 或 Memory Service。',
                    );
                } else {
                    setLoadRecoveryReceipt('');
                }
                debugLog('向父窗口请求分析数据');
                window.opener.postMessage({ type: 'REQUEST_ANALYSIS_DATA' }, getAllowedOpenerOrigin());
                initialDataTimeoutRef.current = window.setTimeout(() => {
                    initialDataTimeoutRef.current = null;
                    const message = '未收到 Slides 页面返回的分析数据，请确认原 Slides 页面仍然打开后重试。';
                    setLoadError(message);
                    showToast(message, 'warning');
                    debugLog('请求分析数据超时，未收到父窗口响应');
                }, INITIAL_DATA_TIMEOUT_MS);
            } else {
                const message = '无法与父窗口通信，请从 Google Slides 页面重新触发分析。';
                setLoadRecoveryReceipt(
                    isRetry
                        ? '重新请求回执: 未找到原 Google Slides 父窗口；没有重新分析、没有写回 Slides，也没有修改 Jira 或 Memory Service。'
                        : '',
                );
                setLoadError(message);
                showToast(message, 'error');
            }
        } catch (err) {
            console.error('初始化分析页面时出错:', err);
            const message = '初始化页面失败: ' + (err as Error).message;
            setLoadError(message);
            showToast(message, 'error');
        }
    };

    const handleParentMessageReceived = (event: MessageEvent) => {
        debugLog('收到消息: ' + JSON.stringify({
            type: event.data?.type,
            source: event.origin
        }));

        if (event.source !== window.opener || event.origin !== getAllowedOpenerOrigin()) {
            debugLog('忽略非预期来源消息');
            return;
        }
        
        try {
            if (!event.data) {
                debugLog('接收到空消息数据');
                return;
            }
            
            if (event.data.type === 'ANALYSIS_DATA') {
                debugLog('收到分析数据');
                clearInitialDataTimeout();
                const data: AnalysisData = event.data.data;
                const receivedAtMs = Date.now();
                setAnalysisResult(data.result);
                setPresentationId(data.presentationId);
                setAnalysisReceivedAt(formatSnapshotReceivedAt(receivedAtMs));
                setAnalysisReceivedAtMs(receivedAtMs);
                setLoadError('');
                setLoadRecoveryReceipt('');
            } else if (event.data.type === 'UPDATE_SUCCESS') {
                debugLog('收到更新成功消息: ' + JSON.stringify(event.data));
                clearApplyTimeout();
                const updatedCount = Number(event.data.updatedCount) || 0;
                const returnedSkippedErrors = Array.isArray(event.data.errors)
                    ? event.data.errors
                        .filter((error): error is string => typeof error === 'string' && error.trim().length > 0)
                        .map((error) => error.trim())
                    : [];
                const submittedItems = pendingApplyPreviewItemsRef.current;
                const skippedErrors = normalizeApplySuccessSkippedErrors(
                    updatedCount,
                    submittedItems,
                    returnedSkippedErrors,
                );
                const skippedCount = skippedErrors.length;
                const skippedSummary = skippedCount > 0 ? `，跳过 ${skippedCount} 项` : '';
                showToast(`更新成功: 已写回 ${updatedCount} 个字段${skippedSummary}`, skippedCount > 0 ? 'warning' : 'success');
                setIsApplying(false);
                setApplySubmissionReceiptLines([]);
                setReviewPacketCopyReceipt(null);
                setSelectedFields({});
                setLastApplyResult({
                    updatedCount,
                    skippedCount,
                    errors: skippedErrors,
                    submittedItems,
                });
                setLastApplyFailure(null);
                pendingApplyPreviewItemsRef.current = [];
            } else if (event.data.type === 'UPDATE_ERROR') {
                clearApplyTimeout();
                const errorMessage = typeof event.data.errorMessage === 'string' && event.data.errorMessage.trim()
                    ? event.data.errorMessage.trim()
                    : '未知错误';
                const errors = Array.isArray(event.data.errors)
                    ? event.data.errors
                        .filter((error): error is string => typeof error === 'string' && error.trim().length > 0)
                        .map((error) => error.trim())
                    : [errorMessage];
                showToast('更新失败: ' + errorMessage, 'error');
                debugLog('收到更新错误消息: ' + JSON.stringify(event.data));
                setIsApplying(false);
                setApplySubmissionReceiptLines([]);
                setReviewPacketCopyReceipt(null);
                setLastApplyResult(null);
                setLastApplyFailure({
                    errorMessage,
                    errors,
                    submittedItems: pendingApplyPreviewItemsRef.current,
                });
                pendingApplyPreviewItemsRef.current = [];
            }
        } catch (err) {
            debugLog('处理消息时出错: ' + (err as Error).message);
            console.error('处理父窗口消息时出错:', err);
            setIsApplying(false);
        }
    };

    const handleSelectAll = (projectIndex: number, isChecked: boolean) => {
        if (isApplying) {
            return;
        }

        if (!analysisResult) {
            return;
        }

        const suggestion = analysisResult.updateSuggestions[projectIndex];
        if (!suggestion) {
            return;
        }

        setSelectedFields((current) => {
            const next = { ...current };
            getAvailableUpdateFields(suggestion).forEach((field) => {
                next[fieldKey(projectIndex, field)] = isChecked;
            });
            return next;
        });
        setSelectionScopeReceipt('');
    };

    const handleFieldSelection = (projectIndex: number, field: UpdateField, isChecked: boolean) => {
        if (isApplying) {
            return;
        }

        setSelectedFields((current) => ({
            ...current,
            [fieldKey(projectIndex, field)]: isChecked
        }));
        setSelectionScopeReceipt('');
    };

    const isFieldSelected = (projectIndex: number, field: UpdateField): boolean => {
        return Boolean(selectedFields[fieldKey(projectIndex, field)]);
    };

    const buildHighConfidenceDefaults = (): Record<string, boolean> => {
        const defaults: Record<string, boolean> = {};

        if (!analysisResult) {
            return defaults;
        }

        analysisResult.updateSuggestions.forEach((suggestion, projectIndex) => {
            getDefaultSelectableFields(suggestion).forEach((field) => {
                defaults[fieldKey(projectIndex, field)] = true;
            });
        });

        return defaults;
    };

    const handleRestoreHighConfidenceDefaults = () => {
        const defaults = buildHighConfidenceDefaults();
        const restoredCount = Object.keys(defaults).length;
        setSelectedFields(defaults);
        setSelectionScopeReceipt(
            `选择范围回执: 已恢复 ${restoredCount} 个高可信默认字段；这只更新结果页本地提交范围，没有重新分析 deck、没有写回 Slides、Jira 或 Memory Service。`,
        );
        showToast(`已恢复 ${restoredCount} 个高可信默认选择`, restoredCount > 0 ? 'info' : 'warning');
    };

    const handleClearSelectedFields = () => {
        const clearedCount = selectedUpdateCount;
        setSelectedFields({});
        setSelectionScopeReceipt(
            `选择范围回执: 已清空 ${clearedCount} 个已选字段；当前没有字段会提交，没有重新分析 deck、没有写回 Slides、Jira 或 Memory Service。`,
        );
        showToast('已清空选择', 'info');
    };

    const suggestionHasSelectedField = (suggestion: ProjectUpdateSuggestion, projectIndex: number): boolean => {
        return getAvailableUpdateFields(suggestion).some((field) => isFieldSelected(projectIndex, field));
    };

    const suggestionMatchesReviewFilter = (suggestion: ProjectUpdateSuggestion, projectIndex: number): boolean => {
        if (reviewFilter === 'selected') {
            return suggestionHasSelectedField(suggestion, projectIndex);
        }

        if (reviewFilter === 'review') {
            return isSuggestionReviewRequired(suggestion);
        }

        if (reviewFilter === 'risk') {
            return isRiskSpotlightSuggestion(suggestion);
        }

        if (reviewFilter === 'blocked') {
            return getUnavailableUpdateFields(suggestion).length > 0;
        }

        return true;
    };

    const selectedUpdateCount = analysisResult
        ? analysisResult.updateSuggestions.reduce((count, suggestion, projectIndex) => {
            return count + getAvailableUpdateFields(suggestion)
                .filter((field) => isFieldSelected(projectIndex, field)).length;
        }, 0)
        : 0;

    const availableUpdateFieldCount = analysisResult
        ? analysisResult.updateSuggestions.reduce((count, suggestion) => (
            count + getAvailableUpdateFields(suggestion).length
        ), 0)
        : 0;

    const defaultSelectedFieldCount = analysisResult
        ? analysisResult.updateSuggestions.reduce((count, suggestion) => {
            return count + getDefaultSelectableFields(suggestion).length;
        }, 0)
        : 0;

    const fieldReviewRequiredCount = analysisResult
        ? analysisResult.updateSuggestions.reduce((count, suggestion) => (
            count + getReviewRequiredFields(suggestion).length
        ), 0)
        : 0;

    const reviewRequiredCount = analysisResult
        ? analysisResult.updateSuggestions.filter((suggestion) => (
            isSuggestionReviewRequired(suggestion)
        )).length
        : 0;

    const missingEvidenceCount = analysisResult
        ? analysisResult.updateSuggestions.filter((suggestion) => !hasVisibleEvidence(suggestion)).length
        : 0;

    const unavailableUpdateFieldCount = analysisResult
        ? analysisResult.updateSuggestions.reduce((count, suggestion) => (
            count + getUnavailableUpdateFields(suggestion).length
        ), 0)
        : 0;

    const riskSpotlightEntries = analysisResult
        ? analysisResult.updateSuggestions
            .map((suggestion, index) => ({ suggestion, index, riskItems: getRiskEvidenceItems(suggestion) }))
            .filter(({ riskItems }) => riskItems.length > 0)
        : [];

    const riskSpotlightCount = riskSpotlightEntries.length;
    const analysisWarnings = (analysisResult?.summary.analysisWarnings || [])
        .filter((warning): warning is string => typeof warning === 'string' && warning.trim().length > 0)
        .map((warning) => warning.trim());
    const analyzedSlideCount = analysisResult?.summary.analyzedSlideCount;
    const totalSlideCount = analysisResult?.summary.totalSlideCount;
    const requestedSlideId = analysisResult?.summary.requestedSlideId;
    const analysisScopeReceiptLines = buildAnalysisScopeReceiptLines(
        analyzedSlideCount,
        totalSlideCount,
        requestedSlideId,
        analysisWarnings.length,
    );
    const shouldShowAnalysisScope = analysisScopeReceiptLines.length > 0;

    const filteredSuggestionEntries = analysisResult
        ? analysisResult.updateSuggestions
            .map((suggestion, index) => ({ suggestion, index }))
            .filter(({ suggestion, index }) => suggestionMatchesReviewFilter(suggestion, index))
        : [];

    const visibleSelectedUpdateCount = filteredSuggestionEntries.reduce((count, { suggestion, index }) => {
        return count + getAvailableUpdateFields(suggestion)
            .filter((field) => isFieldSelected(index, field)).length;
    }, 0);

    const hiddenSelectedUpdateCount = Math.max(0, selectedUpdateCount - visibleSelectedUpdateCount);
    const selectedReviewFieldCount = analysisResult
        ? analysisResult.updateSuggestions.reduce((count, suggestion, projectIndex) => {
            return count + getAvailableUpdateFields(suggestion)
                .filter((field) => isFieldSelected(projectIndex, field) && !shouldDefaultSelectField(suggestion, field))
                .length;
        }, 0)
        : 0;
    const selectedSourcedFieldCount = Math.max(0, selectedUpdateCount - selectedReviewFieldCount);
    const selectedFieldPreviewItems: SelectedFieldPreviewItem[] = analysisResult
        ? analysisResult.updateSuggestions.flatMap((suggestion, projectIndex) => (
            getAvailableUpdateFields(suggestion)
                .filter((field) => isFieldSelected(projectIndex, field))
                .map((field) => buildSelectedFieldPreviewItem(suggestion, projectIndex, field))
        ))
        : [];
    const selectedFieldPreviewSignature = getSelectedFieldPreviewSignature(selectedFieldPreviewItems);
    const selectedFieldPreviewVisibleItems = selectedFieldPreviewItems.slice(0, SELECTED_FIELD_PREVIEW_LIMIT);
    const selectedFieldPreviewOverflowCount = Math.max(0, selectedFieldPreviewItems.length - selectedFieldPreviewVisibleItems.length);
    const writebackSnapshotBasisLine = analysisResult
        ? buildWritebackSnapshotBasisLine(analysisResult, presentationId, analysisReceivedAt)
        : '';
    const writebackSnapshotAgeLine = analysisResult
        ? buildWritebackSnapshotAgeLine(analysisReceivedAtMs)
        : '';
    const selectedWritebackDecisionReceiptLines = buildSelectedWritebackDecisionReceiptLines(
        selectedFieldPreviewItems,
        visibleSelectedUpdateCount,
        hiddenSelectedUpdateCount,
        selectedReviewFieldCount,
        writebackSnapshotBasisLine,
        writebackSnapshotAgeLine,
    );
    const analysisSnapshotReceiptLines = analysisResult
        ? buildAnalysisSnapshotReceiptLines(
            analysisResult,
            presentationId,
            analysisReceivedAt,
            availableUpdateFieldCount,
            defaultSelectedFieldCount,
            selectedUpdateCount,
        )
        : [];
    const hasSelectedWritebackDecisionAttention = hiddenSelectedUpdateCount > 0 || selectedReviewFieldCount > 0;
    const reviewPacketCopyReceiptLines = reviewPacketCopyReceipt
        ? buildReviewPacketCopyReceiptLines(
            reviewPacketCopyReceipt,
            selectedFieldPreviewSignature,
            selectedFieldPreviewItems.length,
        )
        : [];
    const reviewPacketCopyReceiptIsStale = Boolean(
        reviewPacketCopyReceipt &&
        (
            reviewPacketCopyReceipt.selectionSignature !== selectedFieldPreviewSignature ||
            reviewPacketCopyReceipt.copiedFieldCount !== selectedFieldPreviewItems.length
        ),
    );

    const fieldReviewQueueItems: FieldReviewQueueItem[] = analysisResult
        ? analysisResult.updateSuggestions.flatMap((suggestion, projectIndex) => {
            const items: FieldReviewQueueItem[] = [];

            getReviewRequiredFields(suggestion).forEach((field) => {
                const previewItem = buildSelectedFieldPreviewItem(suggestion, projectIndex, field);
                items.push({
                    suggestion,
                    projectIndex,
                    field,
                    kind: 'review',
                    reason: getFieldReviewHint(suggestion, field),
                    previewText: previewItem.previewText,
                    evidenceText: previewItem.evidenceText,
                });
            });

            getUnavailableUpdateFieldTypes(suggestion).forEach((field) => {
                const blockedItem = buildBlockedFieldDetailItem(suggestion, field);
                items.push({
                    suggestion,
                    projectIndex,
                    field,
                    kind: 'blocked',
                    reason: `${UPDATE_FIELD_COLUMN_LABELS[field]} 未识别到可写表格列`,
                    previewText: blockedItem.previewText,
                    evidenceText: blockedItem.evidenceText,
                });
            });

            return items;
        })
        : [];
    const fieldReviewQueuePreview = fieldReviewQueueItems.slice(0, 8);
    const reviewFieldQueueCount = fieldReviewQueueItems.filter((item) => item.kind === 'review').length;
    const blockedFieldQueueCount = fieldReviewQueueItems.filter((item) => item.kind === 'blocked').length;

    const renderEmptyFilterState = () => {
        const actionButtons: React.ReactNode[] = [];
        const addAction = (
            id: string,
            label: string,
            onClick: () => void,
            disabled = false,
        ) => {
            actionButtons.push(
                <button
                    key={id}
                    id={id}
                    type="button"
                    className="btn-quiet empty-filter-action"
                    onClick={onClick}
                    disabled={isApplying || disabled}
                >
                    {label}
                </button>,
            );
        };

        let title = '当前视图没有匹配的更新建议';
        let detail = '这只是筛选结果为空，不代表重新分析 deck，也没有写回 Slides、Jira 或 Memory Service。';

        if (reviewFilter === 'selected') {
            title = selectedUpdateCount === 0
                ? '当前没有已选字段'
                : '当前已选字段不在这个筛选视图里';
            detail = selectedUpdateCount === 0
                ? '可以恢复高可信默认字段，再回到已选视图核对本次提交范围。'
                : '已选字段仍会保留在全部视图里，应用前请先查看写回决策回执。';
            addAction(
                'empty-filter-restore-defaults',
                '恢复高可信默认',
                handleRestoreHighConfidenceDefaults,
                defaultSelectedFieldCount === 0,
            );
            addAction('empty-filter-show-all', '查看全部建议', () => setReviewFilter('all'));
        } else if (reviewFilter === 'review') {
            title = '没有需要人工复核的建议';
            detail = '当前结果没有低可信或缺少直接来源的可写字段；仍请在全部视图核对来源和目标单元格。';
            addAction('empty-filter-show-all', '查看全部建议', () => setReviewFilter('all'));
            if (selectedUpdateCount > 0) {
                addAction('empty-filter-show-selected', '查看已选字段', () => setReviewFilter('selected'));
            }
        } else if (reviewFilter === 'risk') {
            title = '没有风险关注项';
            detail = '当前解析没有可见风险依据；这不代表 Slides 已更新，也不会修改任何外部系统。';
            addAction('empty-filter-show-all', '查看全部建议', () => setReviewFilter('all'));
            if (selectedUpdateCount > 0) {
                addAction('empty-filter-show-selected', '查看已选字段', () => setReviewFilter('selected'));
            }
        } else if (reviewFilter === 'blocked') {
            title = '没有无法写回字段';
            detail = '当前建议都有可写目标或没有字段差异；写回前仍要核对字段级来源和 Google Slides 原子批次。';
            addAction('empty-filter-show-all', '查看全部建议', () => setReviewFilter('all'));
            if (reviewFieldQueueCount > 0) {
                addAction('empty-filter-show-review', '查看需复核', () => setReviewFilter('review'));
            }
        } else {
            addAction('empty-filter-show-selected', '查看已选字段', () => setReviewFilter('selected'), selectedUpdateCount === 0);
        }

        return (
            <div className="empty-filter-state" role="status" aria-live="polite">
                <div className="empty-filter-title">{title}</div>
                <div className="empty-filter-detail">{detail}</div>
                <div className="empty-filter-boundary">
                    筛选或恢复选择只改变结果页本地选择；不会重新分析 deck、写回 Slides、Jira 或 Memory Service。
                </div>
                {actionButtons.length > 0 && (
                    <div className="empty-filter-actions">
                        {actionButtons}
                    </div>
                )}
            </div>
        );
    };

    const handleShowSelectedFields = () => {
        setReviewFilter('selected');
    };

    const handleKeepCurrentViewSelectedFields = () => {
        if (!analysisResult) {
            return;
        }

        const removedCount = hiddenSelectedUpdateCount;
        const remainingCount = Math.max(0, selectedUpdateCount - removedCount);

        setSelectedFields((current) => {
            const next: Record<string, boolean> = {};

            filteredSuggestionEntries.forEach(({ suggestion, index }) => {
                getAvailableUpdateFields(suggestion).forEach((field) => {
                    const key = fieldKey(index, field);
                    if (current[key]) {
                        next[key] = true;
                    }
                });
            });

            return next;
        });

        setSelectionScopeReceipt(
            removedCount > 0
                ? `选择范围回执: 已移除 ${removedCount} 个当前筛选外的隐藏选择，保留 ${remainingCount} 个当前视图字段；这只收敛本地提交范围，没有重新分析 deck、没有写回 Slides、Jira 或 Memory Service。`
                : '选择范围回执: 当前筛选没有隐藏选择，提交范围未改变；没有重新分析 deck、没有写回 Slides、Jira 或 Memory Service。',
        );
        showToast(
            removedCount > 0
                ? `已移除 ${removedCount} 个当前筛选外的选择`
                : '当前筛选没有隐藏选择',
            removedCount > 0 ? 'info' : 'warning',
        );
    };

    const handleCopySelectedWritebackReview = async () => {
        const reviewPacket = formatSelectedWritebackReviewPacket(
            selectedFieldPreviewItems,
            presentationId,
            selectedWritebackDecisionReceiptLines,
        );
        if (!reviewPacket) {
            showToast('没有已选字段可复制', 'warning');
            return;
        }

        const copied = await copyTextToClipboard(reviewPacket);
        const receipt: ReviewPacketCopyReceipt = {
            status: copied ? 'success' : 'failed',
            copiedAt: formatSnapshotReceivedAt(Date.now()),
            copiedFieldCount: selectedFieldPreviewItems.length,
            copiedProjectCount: getAtomicBatchProjectCount(selectedFieldPreviewItems),
            visibleSelectedUpdateCount,
            hiddenSelectedUpdateCount,
            selectedReviewFieldCount,
            presentationId,
            selectionSignature: selectedFieldPreviewSignature,
        };
        setReviewPacketCopyReceipt(receipt);

        if (copied) {
            showToast(`已复制 ${selectedFieldPreviewItems.length} 个字段写回复核清单`, 'success');
        } else {
            showToast('无法复制复核清单，请直接查看写回预览', 'warning');
        }
    };

    const handleApplyUpdates = () => {
        try {
            debugLog('应用更新按钮被点击');

            if (!analysisResult || selectedUpdateCount === 0) {
                showToast('请选择至少一个更新项', 'warning');
                return;
            }
            
            debugLog('选择了 ' + selectedUpdateCount + ' 个更新项');
            setLastApplyResult(null);
            setLastApplyFailure(null);
            setSelectionScopeReceipt('');
            setReviewPacketCopyReceipt(null);
            pendingApplyPreviewItemsRef.current = selectedFieldPreviewItems;

            const selectedUpdates = analysisResult.updateSuggestions
                .map((originalSuggestion, projectIndex) => {
                    const partialUpdate: ProjectUpdateSuggestion = {
                        projectId: originalSuggestion.projectId,
                        projectName: originalSuggestion.projectName,
                        slideId: originalSuggestion.slideId,
                        tableId: originalSuggestion.tableId,
                        rowIndex: originalSuggestion.rowIndex,
                        columnIndices: originalSuggestion.columnIndices,
                        currentStatus: originalSuggestion.currentStatus,
                        currentOwner: originalSuggestion.currentOwner,
                        currentTrack: originalSuggestion.currentTrack,
                        currentComments: originalSuggestion.currentComments,
                        reason: originalSuggestion.reason,
                        sourceInfo: originalSuggestion.sourceInfo,
                        confidence: originalSuggestion.confidence
                    };
                
                    if (isFieldSelected(projectIndex, 'status')) {
                        partialUpdate.suggestedStatus = originalSuggestion.suggestedStatus;
                    }
                    if (isFieldSelected(projectIndex, 'owner')) {
                        partialUpdate.suggestedOwner = originalSuggestion.suggestedOwner;
                    }
                    if (isFieldSelected(projectIndex, 'track')) {
                        partialUpdate.suggestedTrack = originalSuggestion.suggestedTrack;
                    }
                    if (isFieldSelected(projectIndex, 'comments')) {
                        const newSuggestedComments = getNewSuggestedComments(originalSuggestion);
                        if (newSuggestedComments) {
                            partialUpdate.suggestedComments = newSuggestedComments;
                        }
                    }

                    return partialUpdate;
                })
                .filter((update) => (
                    update.suggestedStatus ||
                    update.suggestedOwner ||
                    update.suggestedTrack ||
                    update.suggestedComments
                ));
            
            debugLog('准备发送 ' + selectedUpdates.length + ' 个项目更新到父窗口');
            
            const message = {
                type: 'APPLY_PROJECT_UPDATES',
                presentationId,
                selectedUpdates
            };
            
            if (window.opener) {
                clearApplyTimeout();
                window.opener.postMessage(message, getAllowedOpenerOrigin());
                showToast('正在应用更新...', 'info');
                setApplySubmissionReceiptLines(buildApplySubmissionReceiptLines(
                    selectedFieldPreviewItems,
                    presentationId,
                    writebackSnapshotBasisLine,
                    writebackSnapshotAgeLine,
                ));
                setIsApplying(true);
                applyTimeoutRef.current = window.setTimeout(() => {
                    applyTimeoutRef.current = null;
                    const submittedItems = pendingApplyPreviewItemsRef.current;
                    pendingApplyPreviewItemsRef.current = [];
                    setIsApplying(false);
                    setApplySubmissionReceiptLines([]);
                    setLastApplyResult(null);
                    setLastApplyFailure({
                        errorMessage: '写回请求超时，未收到 Google Slides 页面返回结果。',
                        errors: ['写回结果未知；请先回到 Slides 确认实际内容，再决定是否重新分析和提交。'],
                        submittedItems,
                    });
                    showToast('写回请求超时，请回到 Slides 页面确认是否已更新后再重试', 'warning');
                    debugLog('写回请求超时，未收到父窗口结果消息');
                }, APPLY_TIMEOUT_MS);
            } else {
                pendingApplyPreviewItemsRef.current = [];
                setApplySubmissionReceiptLines([]);
                showToast('无法与父窗口通信，请重新打开分析窗口', 'error');
                debugLog('父窗口引用不存在');
            }
        } catch (err) {
            clearApplyTimeout();
            pendingApplyPreviewItemsRef.current = [];
            setIsApplying(false);
            setApplySubmissionReceiptLines([]);
            showToast('更新操作失败: ' + (err as Error).message, 'error');
            debugLog('错误: ' + (err as Error).message);
            console.error(err);
        }
    };

    const showToast = (message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
        setToast({ message, type });
    };

    const handleCopyApplySkippedHandoff = async () => {
        if (!lastApplyResult || lastApplyResult.errors.length === 0) {
            return;
        }

        const checklist = formatApplySkippedHandoffChecklist(
            lastApplyResult,
            buildApplySkippedHandoffItems(lastApplyResult),
            presentationId,
        );
        if (!checklist) {
            return;
        }

        const copied = await copyTextToClipboard(checklist);
        if (copied) {
            showToast('已复制跳过字段接管清单', 'success');
        } else {
            showToast('无法复制清单，请直接查看完成面板中的人工接管项', 'warning');
        }
    };

    const handleReselectApplySkippedFields = () => {
        if (!lastApplyResult) {
            return;
        }

        const matchedItems = getApplyMatchedSkippedSubmittedItems(lastApplyResult);
        if (matchedItems.length === 0) {
            setSelectionScopeReceipt(
                '选择范围回执: 当前跳过原因没有唯一匹配到字段；未恢复任何提交选择，也没有写回 Slides、Jira 或 Memory Service。',
            );
            showToast('没有可重选的字段级跳过项', 'warning');
            return;
        }

        const skippedSummary = getApplySkippedMatchSummary(lastApplyResult);
        const nextSelectedFields: Record<string, boolean> = {};
        matchedItems.forEach((item) => {
            nextSelectedFields[getSelectedFieldPreviewItemKey(item)] = true;
        });

        setSelectedFields(nextSelectedFields);
        setReviewFilter('selected');
        setSelectionScopeReceipt(
            `选择范围回执: 已重新选择 ${matchedItems.length} 个已匹配跳过字段；这只恢复结果页本地提交范围，不会立即重试、不会写回 Slides，也不会反写 Jira 或 Memory Service。${skippedSummary.unmatchedReasons.length > 0 ? ` 另有 ${skippedSummary.unmatchedReasons.length} 项未匹配跳过原因仍需人工核对。` : ''}`,
        );
        showToast(`已重新选择 ${matchedItems.length} 个跳过字段`, 'info');
    };

    const handleCopyApplyFailureHandoff = async () => {
        if (!lastApplyFailure || lastApplyFailure.submittedItems.length === 0) {
            return;
        }

        const items = buildApplyFailureHandoffItems(lastApplyFailure);
        const checklist = formatApplyFailureHandoffChecklist(lastApplyFailure, items);
        if (!checklist) {
            return;
        }

        const copied = await copyTextToClipboard(checklist);
        if (copied) {
            showToast('已复制失败字段接管清单', 'success');
        } else {
            showToast('无法复制失败清单，请直接查看未完成字段回执', 'warning');
        }
    };

    const debugLog = (message: string) => {
        console.log('[分析窗口]', message);
    };

    const getStatusColor = (status: string): string => {
        if (!status) return '#999';
        
        const statusLower = status.toLowerCase();
        if (statusLower.includes('done') || statusLower.includes('完成') || statusLower.includes('resolved') || statusLower.includes('已解决')) {
            return '#36B37E';
        } else if (statusLower.includes('progress') || statusLower.includes('进行中') || statusLower.includes('处理中') || statusLower.includes('实现中')) {
            return '#0052CC';
        } else if (statusLower.includes('todo') || statusLower.includes('待办') || statusLower.includes('open') || statusLower.includes('待处理')) {
            return '#6554C0';
        } else if (statusLower.includes('block') || statusLower.includes('阻塞') || statusLower.includes('stuck')) {
            return '#FF5630';
        } else if (statusLower.includes('review') || statusLower.includes('审核') || statusLower.includes('待验证')) {
            return '#FF9000';
        } else if (statusLower.includes('test') || statusLower.includes('测试') || statusLower.includes('qa')) {
            return '#00B8D9';
        } else if (statusLower.includes('backlog') || statusLower.includes('规划中')) {
            return '#998DD9';
        } else if (statusLower.includes('cancel') || statusLower.includes('取消') || statusLower.includes('won\'t')) {
            return '#7A869A';
        } else {
            return '#999';
        }
    };

    const getPriorityColor = (priority: string): string => {
        if (!priority) return '#999';
        
        const priorityLower = priority.toLowerCase();
        if (priorityLower.includes('highest') || priorityLower.includes('紧急') || priorityLower.includes('critical')) {
            return '#FF5630';
        } else if (priorityLower.includes('high') || priorityLower.includes('高')) {
            return '#FF8B00';
        } else if (priorityLower.includes('medium') || priorityLower.includes('中')) {
            return '#FFAB00';
        } else if (priorityLower.includes('low') || priorityLower.includes('低')) {
            return '#36B37E';
        } else if (priorityLower.includes('lowest') || priorityLower.includes('微小')) {
            return '#7A869A';
        } else {
            return '#999';
        }
    };

    const formatDate = (dateString: string): string => {
        return formatDisplayDate(dateString);
    };

    if (!analysisResult) {
        return (
            <div className="slides-analysis">
                <div className="loading-container">
                    <p>正在加载分析结果...</p>
                    {loadError ? (
                        <div className="load-error-panel">
                            <p>{loadError}</p>
                            <button
                                type="button"
                                className="btn-secondary"
                                onClick={() => initAnalysisPage(true)}
                                disabled={!window.opener}
                            >
                                重新请求数据
                            </button>
                        </div>
                    ) : (
                        <p className="loading-hint">请保持原 Google Slides 页面打开。</p>
                    )}
                    {loadRecoveryReceipt && (
                        <div
                            className="load-recovery-receipt"
                            role="status"
                        >
                            {loadRecoveryReceipt}
                        </div>
                    )}
                </div>
                {toast && (
                    <Toast
                        message={toast.message}
                        type={toast.type}
                        onClose={() => setToast(null)}
                    />
                )}
                <style>{styles}</style>
            </div>
        );
    }

    const applySkippedHandoffItems = lastApplyResult
        ? buildApplySkippedHandoffItems(lastApplyResult)
        : [];
    const applySkippedMatchSummary = lastApplyResult
        ? getApplySkippedMatchSummary(lastApplyResult)
        : undefined;
    const applyHasUnmatchedSkippedReasons = Boolean(applySkippedMatchSummary?.unmatchedReasons.length);
    const applySkippedHandoffVisibleItems = applySkippedHandoffItems.slice(0, APPLY_SKIPPED_HANDOFF_LIMIT);
    const applySkippedHandoffOverflowCount = Math.max(
        0,
        applySkippedHandoffItems.length - applySkippedHandoffVisibleItems.length
    );
    const applyConfirmedSubmittedItems = lastApplyResult
        ? getApplyConfirmedSubmittedItems(lastApplyResult)
        : [];
    const applyMatchedSkippedSubmittedItems = lastApplyResult
        ? getApplyMatchedSkippedSubmittedItems(lastApplyResult)
        : [];
    const applyConfirmedSubmittedVisibleItems = applyConfirmedSubmittedItems.slice(0, APPLY_RESULT_RECEIPT_LIMIT);
    const applyConfirmedSubmittedOverflowCount = Math.max(
        0,
        applyConfirmedSubmittedItems.length - applyConfirmedSubmittedVisibleItems.length
    );
    const applySkippedOrUnconfirmedFieldCount = lastApplyResult
        ? lastApplyResult.skippedCount
        : 0;
    const applyFailureHandoffItems = lastApplyFailure
        ? buildApplyFailureHandoffItems(lastApplyFailure)
        : [];
    const applyFailureHandoffVisibleItems = applyFailureHandoffItems.slice(0, APPLY_SKIPPED_HANDOFF_LIMIT);
    const applyFailureHandoffOverflowCount = Math.max(
        0,
        applyFailureHandoffItems.length - applyFailureHandoffVisibleItems.length
    );

    return (
        <div className="slides-analysis">
            {lastApplyResult && (
                <div className={`success-message ${lastApplyResult.skippedCount > 0 ? 'success-message-warning' : ''}`}>
                    <h3>更新完成</h3>
                    <p>
                        Google Slides 已确认写回 {lastApplyResult.updatedCount} 个字段
                        {lastApplyResult.skippedCount > 0 ? `，跳过 ${lastApplyResult.skippedCount} 项` : ''}。
                    </p>
                    {lastApplyResult.submittedItems.length > 0 && (
                        <div className="apply-batch-receipt" aria-label="Google Slides 原子批次回执">
                            <strong>
                                {applyHasUnmatchedSkippedReasons
                                    ? `Google Slides 已确认写回 ${lastApplyResult.updatedCount} 个字段，但 ${applySkippedMatchSummary?.unmatchedReasons.length || 0} 个跳过或缺失原因未能匹配到具体字段。`
                                    : applyConfirmedSubmittedItems.length > 0
                                    ? getAtomicBatchSummary(applyConfirmedSubmittedItems)
                                    : `Google Slides 已确认写回 ${lastApplyResult.updatedCount} 个字段。`}
                            </strong>
                            <span>
                                Google Slides 已确认实际发送的批次整体完成；{applyHasUnmatchedSkippedReasons
                                    ? '字段级已确认列表已隐藏，避免把未写入字段误标为已落地。'
                                    : lastApplyResult.skippedCount > 0
                                    ? `另有 ${lastApplyResult.skippedCount} 项没有字段级写入确认；可能是本地预检、API 跳过或成功回包缺少具体原因。`
                                    : '没有跳过或未解释项。'}
                            </span>
                            {applySkippedOrUnconfirmedFieldCount > 0 && (
                                <span>
                                    原始选择为 {lastApplyResult.submittedItems.length} 个字段，其中 {applySkippedOrUnconfirmedFieldCount} 个已转入下方人工接管清单。
                                </span>
                            )}
                        </div>
                    )}
                    {applyConfirmedSubmittedItems.length > 0 && (
                        <div
                            className="applied-field-receipt"
                            aria-label="Google Slides 已确认写回字段回执"
                        >
                            <div className="applied-field-receipt-title">Google Slides 已确认写回字段</div>
                            <ul className="applied-field-receipt-list">
                                {applyConfirmedSubmittedVisibleItems.map((item) => (
                                    <li
                                        key={`${item.projectIndex}-${item.field}`}
                                        className="applied-field-receipt-item"
                                    >
                                        <span className="applied-field-receipt-main">
                                            <strong>{item.projectLabel} · {item.fieldLabel}</strong>
                                            <span>{item.previewText}</span>
                                            <span className="applied-field-receipt-target">
                                                {item.targetText}
                                            </span>
                                            <span className="applied-field-receipt-evidence">
                                                {item.evidenceText}
                                            </span>
                                        </span>
                                        <span className={`selected-writeback-preview-badge selected-writeback-preview-badge-${item.reviewKind}`}>
                                            {item.reviewLabel}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                            {applyConfirmedSubmittedOverflowCount > 0 && (
                                <div className="applied-field-receipt-more">
                                    还有 {applyConfirmedSubmittedOverflowCount} 个已确认字段未展示。
                                </div>
                            )}
                        </div>
                    )}
                    {lastApplyResult.errors.length > 0 && (
                        <div className="apply-skipped-details">
                            <div className="apply-skipped-title">跳过原因</div>
                            <ul>
                                {lastApplyResult.errors.slice(0, 5).map((error, index) => (
                                    <li key={index}>{error}</li>
                                ))}
                            </ul>
                            {lastApplyResult.errors.length > 5 && (
                                <div className="apply-skipped-more">
                                    还有 {lastApplyResult.errors.length - 5} 项未展示。
                                </div>
                            )}
                        </div>
                    )}
                    {applySkippedHandoffItems.length > 0 && (
                        <div
                            className="apply-skipped-handoff"
                            aria-label="跳过字段人工接管清单"
                        >
                            <div className="apply-skipped-handoff-header">
                                <div>
                                    <div className="apply-skipped-handoff-title">人工接管清单</div>
                                    <div className="apply-skipped-handoff-summary">
                                        对照建议值和跳过原因，处理完再重新分析或手动更新 Slides。
                                    </div>
                                </div>
                                <div className="apply-skipped-handoff-actions">
                                    <button
                                        id="reselect-apply-skipped-fields"
                                        type="button"
                                        className="btn-quiet"
                                        onClick={handleReselectApplySkippedFields}
                                        disabled={applyMatchedSkippedSubmittedItems.length === 0}
                                    >
                                        重选跳过字段
                                    </button>
                                    <button
                                        id="copy-apply-skipped-handoff"
                                        type="button"
                                        className="btn-quiet"
                                        onClick={handleCopyApplySkippedHandoff}
                                    >
                                        复制清单
                                    </button>
                                </div>
                            </div>
                            <div className="apply-skipped-reselect-boundary">
                                已匹配 {applyMatchedSkippedSubmittedItems.length} 个可重选字段
                                {applySkippedMatchSummary?.unmatchedReasons.length
                                    ? `；${applySkippedMatchSummary.unmatchedReasons.length} 项未匹配原因只能人工核对`
                                    : ''}。重选只改变本页选择，不会自动重试或写回。
                            </div>
                            <ul className="apply-skipped-handoff-list">
                                {applySkippedHandoffVisibleItems.map((item, index) => (
                                    <li
                                        key={`${item.projectLabel}-${item.fieldLabel}-${index}`}
                                        className={`apply-skipped-handoff-item ${item.matched ? '' : 'apply-skipped-handoff-item-unmatched'}`}
                                    >
                                        <span className="apply-skipped-handoff-main">
                                            <span className="apply-skipped-handoff-title-row">
                                                <strong>{item.projectLabel} · {item.fieldLabel}</strong>
                                                <span className={`apply-skipped-handoff-match-badge ${item.matched ? 'apply-skipped-handoff-match-badge-reselectable' : 'apply-skipped-handoff-match-badge-manual'}`}>
                                                    {item.matched ? '可重选' : '人工核对'}
                                                </span>
                                            </span>
                                            <span>{item.previewText}</span>
                                            <span className="apply-skipped-handoff-target">
                                                {item.targetText}
                                            </span>
                                            <span className="apply-skipped-handoff-evidence">
                                                {item.evidenceText}
                                            </span>
                                        </span>
                                        <span className="apply-skipped-handoff-reason">
                                            原因: {item.reason}
                                        </span>
                                        <span className="apply-skipped-handoff-next">
                                            下一步: {item.nextStep}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                            {applySkippedHandoffOverflowCount > 0 && (
                                <div className="apply-skipped-more">
                                    还有 {applySkippedHandoffOverflowCount} 个跳过字段未展示，可复制清单完整处理。
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {lastApplyFailure && (
                <div className="apply-failure-message" role="alert">
                    <h3>写回未完成</h3>
                    <p>{lastApplyFailure.errorMessage}</p>
                    {lastApplyFailure.submittedItems.length > 0 && (
                        <div className="apply-batch-receipt apply-batch-receipt-error" aria-label="Google Slides 原子批次失败回执">
                            <strong>{getAtomicBatchSummary(lastApplyFailure.submittedItems)}</strong>
                            <span>
                                {ATOMIC_BATCH_BOUNDARY_TEXT} 这次没有确认任何字段写入，请先修复权限、表格列或定位问题再重新提交。
                            </span>
                        </div>
                    )}
                    {lastApplyFailure.submittedItems.length > 0 && (
                        <div
                            className="applied-field-receipt applied-field-receipt-error"
                            aria-label="本次未完成字段回执"
                        >
                            <div className="applied-field-receipt-title">本次未完成字段</div>
                            <ul className="applied-field-receipt-list">
                                {lastApplyFailure.submittedItems.slice(0, APPLY_RESULT_RECEIPT_LIMIT).map((item) => (
                                    <li
                                        key={`${item.projectIndex}-${item.field}`}
                                        className="applied-field-receipt-item"
                                    >
                                        <span className="applied-field-receipt-main">
                                            <strong>{item.projectLabel} · {item.fieldLabel}</strong>
                                            <span>{item.previewText}</span>
                                            <span className="applied-field-receipt-target">
                                                {item.targetText}
                                            </span>
                                            <span className="applied-field-receipt-evidence">
                                                {item.evidenceText}
                                            </span>
                                        </span>
                                        <span className={`selected-writeback-preview-badge selected-writeback-preview-badge-${item.reviewKind}`}>
                                            {item.reviewLabel}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                            {lastApplyFailure.submittedItems.length > APPLY_RESULT_RECEIPT_LIMIT && (
                                <div className="applied-field-receipt-more">
                                    还有 {lastApplyFailure.submittedItems.length - APPLY_RESULT_RECEIPT_LIMIT} 个未完成字段未展示。
                                </div>
                            )}
                        </div>
                    )}
                    {lastApplyFailure.errors.length > 0 && (
                        <div className="apply-skipped-details apply-failure-details">
                            <div className="apply-skipped-title">失败原因</div>
                            <ul>
                                {lastApplyFailure.errors.slice(0, 5).map((error, index) => (
                                    <li key={index}>{error}</li>
                                ))}
                            </ul>
                            {lastApplyFailure.errors.length > 5 && (
                                <div className="apply-skipped-more">
                                    还有 {lastApplyFailure.errors.length - 5} 项未展示。
                                </div>
                            )}
                        </div>
                    )}
                    {applyFailureHandoffItems.length > 0 && (
                        <div
                            className="apply-skipped-handoff apply-failure-handoff"
                            aria-label="失败字段人工接管清单"
                        >
                            <div className="apply-skipped-handoff-header">
                                <div>
                                    <div className="apply-skipped-handoff-title">失败接管清单</div>
                                    <div className="apply-skipped-handoff-summary">
                                        整批没有确认写入；先对照字段目标和失败原因修复，再决定是否重新提交。
                                    </div>
                                </div>
                                <button
                                    id="copy-apply-failure-handoff"
                                    type="button"
                                    className="btn-quiet"
                                    onClick={handleCopyApplyFailureHandoff}
                                >
                                    复制清单
                                </button>
                            </div>
                            <ul className="apply-skipped-handoff-list">
                                {applyFailureHandoffVisibleItems.map((item, index) => (
                                    <li
                                        key={`${item.projectLabel}-${item.fieldLabel}-${index}`}
                                        className="apply-skipped-handoff-item apply-failure-handoff-item"
                                    >
                                        <span className="apply-skipped-handoff-main">
                                            <strong>{item.projectLabel} · {item.fieldLabel}</strong>
                                            <span>{item.previewText}</span>
                                            <span className="apply-skipped-handoff-target">
                                                {item.targetText}
                                            </span>
                                            <span className="apply-skipped-handoff-evidence">
                                                {item.evidenceText}
                                            </span>
                                        </span>
                                        <span className="apply-skipped-handoff-reason">
                                            失败原因: {item.reason}
                                        </span>
                                        <span className="apply-skipped-handoff-next">
                                            下一步: {item.nextStep}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                            {applyFailureHandoffOverflowCount > 0 && (
                                <div className="apply-skipped-more">
                                    还有 {applyFailureHandoffOverflowCount} 个失败字段未展示，可复制清单完整处理。
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            <div className="summary-section">
                <h3>📊 分析报告</h3>
                <div id="summary-info">
                    <p>检测到 {analysisResult.summary.totalProjects} 个项目，{analysisResult.summary.projectsNeedingUpdate} 个有字段建议</p>
                    {analysisResult.updateSuggestions.length > 0 && (
                        <p className="selection-summary">已选择 {selectedUpdateCount} 个字段</p>
                    )}
                    {analysisResult.updateSuggestions.length > 0 && (
                        <div className="review-strip">
                            <span className="review-chip">可更新字段 {availableUpdateFieldCount}</span>
                            <span className="review-chip review-chip-safe">高可信默认 {defaultSelectedFieldCount}</span>
                            <span className="review-chip review-chip-attention">需复核项目 {reviewRequiredCount}</span>
                            {fieldReviewRequiredCount > 0 && (
                                <span className="review-chip review-chip-attention">需复核字段 {fieldReviewRequiredCount}</span>
                            )}
                            {riskSpotlightCount > 0 && (
                                <span className="review-chip review-chip-risk">风险项目 {riskSpotlightCount}</span>
                            )}
                            {missingEvidenceCount > 0 && (
                                <span className="review-chip review-chip-attention">缺少来源 {missingEvidenceCount}</span>
                            )}
                            {unavailableUpdateFieldCount > 0 && (
                                <span className="review-chip review-chip-blocked">无法写回字段 {unavailableUpdateFieldCount}</span>
                            )}
                        </div>
                    )}
                    {analysisSnapshotReceiptLines.length > 0 && (
                        <div
                            className="analysis-snapshot-receipt"
                            role="status"
                            aria-label="Slides 分析快照回执"
                        >
                            <div className="analysis-snapshot-receipt-title">分析快照回执</div>
                            <ul>
                                {analysisSnapshotReceiptLines.map((line) => (
                                    <li key={line}>{line}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {analysisResult.updateSuggestions.length > 0 && (
                        <div className="review-controls" aria-label="审阅筛选和批量选择">
                            <div className="review-filter-group" role="group" aria-label="审阅视图">
                                {(Object.keys(REVIEW_FILTER_LABELS) as ReviewFilter[]).map((filter) => (
                                    <button
                                        key={filter}
                                        id={`review-filter-${filter}`}
                                        type="button"
                                        className={`review-filter-button ${reviewFilter === filter ? 'review-filter-button-active' : ''}`}
                                        aria-pressed={reviewFilter === filter}
                                        onClick={() => setReviewFilter(filter)}
                                        disabled={isApplying}
                                    >
                                        {REVIEW_FILTER_LABELS[filter]}
                                    </button>
                                ))}
                            </div>
                            <div className="bulk-actions">
                                <button
                                    id="restore-high-confidence-fields"
                                    type="button"
                                    className="btn-quiet"
                                    onClick={handleRestoreHighConfidenceDefaults}
                                    disabled={isApplying || defaultSelectedFieldCount === 0}
                                >
                                    恢复高可信默认
                                </button>
                                <button
                                    id="clear-selected-fields"
                                    type="button"
                                    className="btn-quiet"
                                    onClick={handleClearSelectedFields}
                                    disabled={isApplying || selectedUpdateCount === 0}
                                >
                                    清空选择
                                </button>
                            </div>
                        </div>
                    )}
                    {selectionScopeReceipt && (
                        <div
                            className="selection-scope-receipt"
                            role="status"
                            aria-live="polite"
                        >
                            {selectionScopeReceipt}
                        </div>
                    )}
                </div>
            </div>

            {shouldShowAnalysisScope && (
                <div className="analysis-scope-section">
                    <div className="section-header-row">
                        <div>
                            <h3>分析范围与提醒</h3>
                            <p className="analysis-scope-summary">
                                {typeof analyzedSlideCount === 'number' && typeof totalSlideCount === 'number'
                                    ? `已分析 ${analyzedSlideCount} / ${totalSlideCount} 张 slide`
                                    : '已完成 Slides 内容解析'}
                                {requestedSlideId ? ` · 当前目标 ${requestedSlideId}` : ''}
                            </p>
                        </div>
                    </div>
                    {analysisWarnings.length > 0 ? (
                        <ul className="analysis-warning-list">
                            {analysisWarnings.slice(0, 4).map((warning, index) => (
                                <li key={index}>{warning}</li>
                            ))}
                        </ul>
                    ) : (
                        <p className="analysis-scope-muted">
                            没有解析警告；写回前仍请按字段来源复核建议。
                        </p>
                    )}
                    {analysisWarnings.length > 4 && (
                        <div className="analysis-warning-more">
                            还有 {analysisWarnings.length - 4} 条解析提醒未展示。
                        </div>
                    )}
                    <div
                        className="analysis-scope-receipt"
                        role="status"
                        aria-label="Slides 分析范围判定回执"
                    >
                        <div className="analysis-scope-receipt-title">范围判定回执</div>
                        <ul>
                            {analysisScopeReceiptLines.map((line) => (
                                <li key={line}>{line}</li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}

            {fieldReviewQueueItems.length > 0 && (
                <div className="field-review-queue-section">
                    <div className="section-header-row">
                        <div>
                            <h3>字段复核队列</h3>
                            <p className="field-review-queue-summary">
                                需复核 {reviewFieldQueueCount} 个字段，无法写回 {blockedFieldQueueCount} 个字段。
                            </p>
                        </div>
                        <div className="field-review-queue-actions">
                            {reviewFieldQueueCount > 0 && (
                                <button
                                    id="queue-filter-review"
                                    type="button"
                                    className="btn-quiet"
                                    onClick={() => setReviewFilter('review')}
                                    disabled={isApplying}
                                >
                                    只看需复核
                                </button>
                            )}
                            {blockedFieldQueueCount > 0 && (
                                <button
                                    id="queue-filter-blocked"
                                    type="button"
                                    className="btn-quiet"
                                    onClick={() => setReviewFilter('blocked')}
                                    disabled={isApplying}
                                >
                                    只看无法写回
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="field-review-queue-list">
                        {fieldReviewQueuePreview.map(({ suggestion, projectIndex, field, kind, reason, previewText, evidenceText }) => {
                            const inputId = `review-queue-toggle-${projectIndex}-${field}`;

                            return (
                                <div
                                    key={`${projectIndex}-${field}-${kind}`}
                                    className={`field-review-queue-item field-review-queue-item-${kind}`}
                                >
                                    {kind === 'review' ? (
                                        <input
                                            id={inputId}
                                            type="checkbox"
                                            className="field-review-queue-checkbox"
                                            checked={isFieldSelected(projectIndex, field)}
                                            aria-label={`${suggestion.projectId} ${UPDATE_FIELD_SHORT_LABELS[field]} 复核选择`}
                                            onChange={(event) => handleFieldSelection(projectIndex, field, event.target.checked)}
                                            disabled={isApplying}
                                        />
                                    ) : (
                                        <span className="field-review-queue-lock">无法写回</span>
                                    )}
                                    <div className="field-review-queue-body">
                                        <label
                                            htmlFor={kind === 'review' ? inputId : undefined}
                                            className="field-review-queue-title"
                                        >
                                            {suggestion.projectId} · {suggestion.projectName} · {UPDATE_FIELD_SHORT_LABELS[field]}
                                        </label>
                                        <div className="field-review-queue-reason">{reason}</div>
                                        <div className="field-review-queue-preview">{previewText}</div>
                                        <div className="field-review-queue-evidence">{evidenceText}</div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    {fieldReviewQueueItems.length > fieldReviewQueuePreview.length && (
                        <div className="field-review-queue-more">
                            还有 {fieldReviewQueueItems.length - fieldReviewQueuePreview.length} 个字段可在筛选视图中处理。
                        </div>
                    )}
                </div>
            )}

            <div className="statistics-section">
                <h3>📈 项目统计</h3>
                <div id="project-statistics">
                    <div style={{ marginBottom: '8px' }}>● 正常进行: {analysisResult.summary.normalProjects}个项目</div>
                    <div style={{ marginBottom: '8px' }}>● 需要关注: {analysisResult.summary.attentionProjects}个项目</div>
                    <div style={{ marginBottom: '8px' }}>● 严重风险: {analysisResult.summary.riskProjects}个项目</div>
                </div>
            </div>

            <div className="findings-section">
                <h3>🔍 关键发现</h3>
                <ul id="key-findings">
                    {analysisResult.summary.keyFindings && analysisResult.summary.keyFindings.length > 0 
                        ? analysisResult.summary.keyFindings.map((finding, index) => (
                            <li key={index} style={{ marginBottom: '5px' }}>{finding}</li>
                        ))
                        : <li>没有关键发现</li>
                    }
                </ul>
            </div>

            {riskSpotlightEntries.length > 0 && (
                <div className="risk-spotlight-section">
                    <div className="section-header-row">
                        <h3>风险焦点</h3>
                        <button
                            id="review-filter-risk-inline"
                            type="button"
                            className="btn-quiet"
                            onClick={() => setReviewFilter('risk')}
                            disabled={isApplying}
                        >
                            只看风险
                        </button>
                    </div>
                    <div className="risk-spotlight-list">
                        {riskSpotlightEntries.slice(0, 4).map(({ suggestion, riskItems }) => (
                            <div key={`${suggestion.projectId}-${suggestion.projectName}`} className="risk-spotlight-item">
                                <div className="risk-spotlight-title">
                                    {suggestion.projectId}: {suggestion.projectName}
                                </div>
                                <ul className="risk-spotlight-reasons">
                                    {riskItems.map((item, riskIndex) => (
                                        <li key={riskIndex}>{item}</li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                    {riskSpotlightEntries.length > 4 && (
                        <div className="risk-spotlight-more">
                            还有 {riskSpotlightEntries.length - 4} 个风险项目可在风险视图中查看。
                        </div>
                    )}
                </div>
            )}

            <div className="suggestions-section">
                <h3>💡 更新建议与风险关注</h3>
                {analysisResult.updateSuggestions && analysisResult.updateSuggestions.length > 0 && (
                    <p className="filter-summary">
                        当前视图 {filteredSuggestionEntries.length} / {analysisResult.updateSuggestions.length} 个建议
                    </p>
                )}
                <div id="suggestions-container">
                    {analysisResult.updateSuggestions && analysisResult.updateSuggestions.length > 0 ? (
                        filteredSuggestionEntries.length > 0 ? filteredSuggestionEntries.map(({ suggestion, index }) => {
                            const hasStatusColumn = hasWritableColumnIndex(suggestion.columnIndices?.status);
                            const hasOwnerColumn = hasWritableColumnIndex(suggestion.columnIndices?.owner);
                            const hasTrackColumn = hasWritableColumnIndex(suggestion.columnIndices?.track);
                            const hasCommentsColumn = hasWritableColumnIndex(suggestion.columnIndices?.comments);
                            const availableFields = getAvailableUpdateFields(suggestion);
                            const unavailableFields = getUnavailableUpdateFields(suggestion);
                            const blockedFieldDetailItems = getBlockedFieldDetailItems(suggestion);
                            const evidenceItems = getSuggestionEvidenceItems(suggestion);
                            const riskItems = getRiskEvidenceItems(suggestion);
                            const needsReview = isSuggestionReviewRequired(suggestion);
                            const isDefaultSelectable = shouldDefaultSelectSuggestion(suggestion);
                            const isRiskInsightOnly = isRiskInsightOnlySuggestion(suggestion);
                            const newSuggestedComments = getNewSuggestedComments(suggestion);
                            const allAvailableSelected = availableFields.length > 0 &&
                                availableFields.every((field) => isFieldSelected(index, field));

                            return (
                                <div key={index} className="project-item">
                                    <div style={{ marginBottom: '10px' }}>
                                        <div className="project-header">
                                            <span className="project-title">项目 {suggestion.projectId}: {suggestion.projectName}</span>
                                            <span className={`confidence-badge ${isDefaultSelectable ? 'confidence-high' : 'confidence-review'}`}>
                                                {confidenceReviewText(suggestion)} · {Math.round((suggestion.confidence || 0) * 100)}%
                                            </span>
                                        </div>
                                        {needsReview && (
                                            <div className="project-review-note">
                                                {getProjectReviewNote(suggestion)}
                                            </div>
                                        )}
                                        {riskItems.length > 0 && (
                                            <div className="project-risk-evidence-panel">
                                                <div className="project-risk-evidence-title">风险依据</div>
                                                <ul className="project-risk-evidence-list">
                                                    {riskItems.map((item, riskIndex) => (
                                                        <li key={riskIndex}>{item}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                        <div className={`source-evidence-panel ${evidenceItems.length === 0 ? 'source-evidence-panel-empty' : ''}`}>
                                            <div className="source-evidence-title">来源证据</div>
                                            {evidenceItems.length > 0 ? (
                                                <ul className="source-evidence-list">
                                                    {evidenceItems.map((item, evidenceIndex) => (
                                                        <li key={evidenceIndex}>{item}</li>
                                                    ))}
                                                </ul>
                                            ) : (
                                                <div className="source-evidence-empty">没有可见来源，建议保持未勾选直到人工确认。</div>
                                            )}
                                        </div>
                                        {unavailableFields.length > 0 && (
                                            <div className="project-blocked-note">
                                                无法写回 {unavailableFields.join('、')}：未识别到可写表格列，请先在 Slides 表格中补齐对应列或手动更新。
                                            </div>
                                        )}
                                        {blockedFieldDetailItems.length > 0 && (
                                            <div
                                                className="project-blocked-field-details"
                                                aria-label={`${suggestion.projectId} 无法写回字段建议值`}
                                            >
                                                <div className="project-blocked-field-details-title">无法写回字段建议值</div>
                                                <ul className="project-blocked-field-details-list">
                                                    {blockedFieldDetailItems.map((item) => (
                                                        <li
                                                            key={item.field}
                                                            className="project-blocked-field-detail"
                                                        >
                                                            <strong>{item.fieldLabel}</strong>
                                                            <span>{item.previewText}</span>
                                                            <span className="project-blocked-field-evidence">
                                                                {item.evidenceText}
                                                            </span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                        {isRiskInsightOnly && (
                                            <div className="project-insight-note">
                                                此项目仅作为风险关注展示，目前没有可写回字段。
                                            </div>
                                        )}
                                        {hasDuplicateOnlySuggestedComments(suggestion) && (
                                            <div className="project-noop-note">
                                                备注建议已存在于当前备注，已从可写字段中排除。
                                            </div>
                                        )}
                                        
                                        {/* Jira信息显示区域 */}
                                        {suggestion.sourceInfo?.jiraIssues && suggestion.sourceInfo.jiraIssues.length > 0 && (
                                            <div className="jira-issues-container" style={{ 
                                                marginTop: '8px', 
                                                marginBottom: '10px', 
                                                padding: '8px', 
                                                background: '#f5f5f5', 
                                                borderRadius: '4px', 
                                                fontSize: '13px' 
                                            }}>
                                                <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>相关Jira问题:</div>
                                                {suggestion.sourceInfo.jiraIssues.map((issue, issueIndex) => {
                                                    const isOpenPastDue = isOpenJiraIssue(issue) && isPastDueDate(issue.duedate);
                                                    const issueUrl = getSafeExternalUrl(issue.url);
                                                    const updatedLabel = getJiraIssueUpdatedLabel(issue);

                                                    return (
                                                    <div key={issueIndex} className="jira-issue-item" style={{
                                                        marginBottom: '8px',
                                                        padding: '5px',
                                                        borderLeft: '3px solid #0052CC'
                                                    }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                            {issueUrl ? (
                                                                <a href={issueUrl} target="_blank" rel="noreferrer" className="jira-issue-key-link">
                                                                    {issue.key}
                                                                </a>
                                                            ) : (
                                                                <span className="jira-issue-key-text">{issue.key}</span>
                                                            )}
                                                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                                                {issue.priority && (
                                                                    <span className="jira-priority" style={{
                                                                        padding: '2px 6px',
                                                                        marginRight: '5px',
                                                                        borderRadius: '3px',
                                                                        fontSize: '11px',
                                                                        backgroundColor: getPriorityColor(issue.priority),
                                                                        color: 'white'
                                                                    }}>
                                                                        {issue.priority}
                                                                    </span>
                                                                )}
                                                                <span className="jira-status" style={{
                                                                    padding: '2px 6px',
                                                                    borderRadius: '3px',
                                                                    fontSize: '11px',
                                                                    backgroundColor: getStatusColor(issue.status),
                                                                    color: 'white'
                                                                }}>
                                                                    {issue.status}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div style={{ marginTop: '3px', fontWeight: '500' }}>{issue.summary}</div>
                                                        <div style={{ 
                                                            display: 'flex', 
                                                            flexWrap: 'wrap', 
                                                            marginTop: '5px', 
                                                            fontSize: '11px', 
                                                            color: '#555' 
                                                        }}>
                                                            {issue.assignee && (
                                                                <div style={{ 
                                                                    marginRight: '10px', 
                                                                    display: 'flex', 
                                                                    alignItems: 'center' 
                                                                }}>
                                                                    <span style={{ color: '#777', marginRight: '3px' }}>处理人:</span>
                                                                    <span style={{ 
                                                                        background: '#dfe1e6', 
                                                                        padding: '1px 5px', 
                                                                        borderRadius: '3px' 
                                                                    }}>
                                                                        {issue.assignee}
                                                                    </span>
                                                                </div>
                                                            )}
                                                            {issue.reporter && (
                                                                <div style={{ 
                                                                    marginRight: '10px', 
                                                                    display: 'flex', 
                                                                    alignItems: 'center' 
                                                                }}>
                                                                    <span style={{ color: '#777', marginRight: '3px' }}>报告人:</span>
                                                                    <span style={{ 
                                                                        background: '#dfe1e6', 
                                                                        padding: '1px 5px', 
                                                                        borderRadius: '3px' 
                                                                    }}>
                                                                        {issue.reporter}
                                                                    </span>
                                                                </div>
                                                            )}
                                                            {issue.duedate && (
                                                                <div style={{ 
                                                                    marginRight: '10px', 
                                                                    display: 'flex', 
                                                                    alignItems: 'center' 
                                                                }}>
                                                                    <span style={{ color: '#777', marginRight: '3px' }}>截止日期:</span>
                                                                    <span style={{ 
                                                                        color: isOpenPastDue ? '#FF5630' : '#333',
                                                                        fontWeight: isOpenPastDue ? 'bold' : 'normal'
                                                                    }}>
                                                                        {formatDate(issue.duedate)}
                                                                    </span>
                                                                </div>
                                                            )}
                                                            {updatedLabel && (
                                                                <div className="jira-updated-meta">
                                                                    <span>最近更新:</span>
                                                                    <span>{updatedLabel}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                                })}
                                            </div>
                                        )}
                                        
                                        <div style={{ marginTop: '5px', marginBottom: '10px', fontSize: '12px', color: '#666' }}>
                                            <span style={{ display: 'inline-block', marginRight: '10px' }}>
                                                <input 
                                                    type="checkbox" 
                                                    id={`select-all-${index}`} 
                                                    className="select-all-checkbox"
                                                    checked={allAvailableSelected}
                                                    disabled={isApplying || availableFields.length === 0}
                                                    onChange={(e) => handleSelectAll(index, e.target.checked)}
                                                />
                                                <label
                                                    htmlFor={`select-all-${index}`}
                                                    className={isApplying || availableFields.length === 0 ? 'disabled-label' : undefined}
                                                >
                                                    全选
                                                </label>
                                                <span className="available-fields-count">可更新 {availableFields.length} 个字段</span>
                                            </span>
                                        </div>
                                    </div>
                                    
                                    {hasStatusColumn && hasMeaningfulSuggestedChange(suggestion.currentStatus, suggestion.suggestedStatus) && (
                                        <div className="update-item">
                                            <input 
                                                type="checkbox" 
                                                id={`update-status-${index}`} 
                                                className="update-item-checkbox"
                                                aria-label={`${suggestion.projectId} ${UPDATE_FIELD_SHORT_LABELS.status} 写回选择`}
                                                checked={isFieldSelected(index, 'status')}
                                                disabled={isApplying}
                                                onChange={(e) => handleFieldSelection(index, 'status', e.target.checked)}
                                                style={{ marginRight: '8px' }}
                                            />
                                            <div>
                                                <div>状态: <span style={{ color: '#999' }}>{suggestion.currentStatus}</span> → 
                                                <span style={{ color: '#0066cc', fontWeight: 'bold' }}>{suggestion.suggestedStatus}</span></div>
                                                <div className="update-tag">
                                                    🔄 更新: Status列从"{suggestion.currentStatus}"更新为"{suggestion.suggestedStatus}"
                                                </div>
                                                {suggestion.suggestedStatusReason && (
                                                    <div className="reason-tag" style={{ 
                                                        marginTop: '5px', 
                                                        fontSize: '12px', 
                                                        color: '#555', 
                                                        fontStyle: 'italic' 
                                                    }}>
                                                        📝 理由: {suggestion.suggestedStatusReason}
                                                    </div>
                                                )}
                                                <div className={`field-source-note ${shouldDefaultSelectField(suggestion, 'status') ? 'field-source-note-ready' : 'field-source-note-review'}`}>
                                                    {getFieldReviewHint(suggestion, 'status')}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    
                                    {hasCommentsColumn && newSuggestedComments && (
                                        <div className="update-item">
                                            <input 
                                                type="checkbox" 
                                                id={`update-comments-${index}`} 
                                                className="update-item-checkbox"
                                                aria-label={`${suggestion.projectId} ${UPDATE_FIELD_SHORT_LABELS.comments} 写回选择`}
                                                checked={isFieldSelected(index, 'comments')}
                                                disabled={isApplying}
                                                onChange={(e) => handleFieldSelection(index, 'comments', e.target.checked)}
                                                style={{ marginRight: '8px' }}
                                            />
                                            <div>
                                                {suggestion.currentComments && (
                                                    <div className="comment-current">
                                                        当前备注已有内容；只会追加下面的新增行。
                                                    </div>
                                                )}
                                                <div className="update-tag">
                                                    🔄 更新: Comment列{suggestion.currentComments ? '追加' : '设置为'}新增备注
                                                </div>
                                                <div className="comment-preview">
                                                    {newSuggestedComments}
                                                </div>
                                                {suggestion.suggestedCommentsReason && (
                                                    <div className="reason-tag" style={{ 
                                                        marginTop: '5px', 
                                                        fontSize: '12px', 
                                                        color: '#555', 
                                                        fontStyle: 'italic' 
                                                    }}>
                                                        📝 理由: {suggestion.suggestedCommentsReason}
                                                    </div>
                                                )}
                                                <div className={`field-source-note ${shouldDefaultSelectField(suggestion, 'comments') ? 'field-source-note-ready' : 'field-source-note-review'}`}>
                                                    {getFieldReviewHint(suggestion, 'comments')}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    
                                    {hasOwnerColumn && hasMeaningfulSuggestedChange(suggestion.currentOwner, suggestion.suggestedOwner) && (
                                        <div className="update-item">
                                            <input 
                                                type="checkbox" 
                                                id={`update-owner-${index}`} 
                                                className="update-item-checkbox"
                                                aria-label={`${suggestion.projectId} ${UPDATE_FIELD_SHORT_LABELS.owner} 写回选择`}
                                                checked={isFieldSelected(index, 'owner')}
                                                disabled={isApplying}
                                                onChange={(e) => handleFieldSelection(index, 'owner', e.target.checked)}
                                                style={{ marginRight: '8px' }}
                                            />
                                            <div>
                                                <div>负责人: <span style={{ color: '#999' }}>{suggestion.currentOwner || '无'}</span> → 
                                                <span style={{ color: '#0066cc', fontWeight: 'bold' }}>{suggestion.suggestedOwner}</span></div>
                                                <div className="update-tag">
                                                    🔄 更新: Owner列从"{suggestion.currentOwner || '无'}"更新为"{suggestion.suggestedOwner}"
                                                </div>
                                                {suggestion.suggestedOwnerReason && (
                                                    <div className="reason-tag" style={{ 
                                                        marginTop: '5px', 
                                                        fontSize: '12px', 
                                                        color: '#555', 
                                                        fontStyle: 'italic' 
                                                    }}>
                                                        📝 理由: {suggestion.suggestedOwnerReason}
                                                    </div>
                                                )}
                                                <div className={`field-source-note ${shouldDefaultSelectField(suggestion, 'owner') ? 'field-source-note-ready' : 'field-source-note-review'}`}>
                                                    {getFieldReviewHint(suggestion, 'owner')}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    
                                    {hasTrackColumn && hasMeaningfulSuggestedChange(suggestion.currentTrack, suggestion.suggestedTrack) && (
                                        <div className="update-item">
                                            <input 
                                                type="checkbox" 
                                                id={`update-track-${index}`} 
                                                className="update-item-checkbox"
                                                aria-label={`${suggestion.projectId} ${UPDATE_FIELD_SHORT_LABELS.track} 写回选择`}
                                                checked={isFieldSelected(index, 'track')}
                                                disabled={isApplying}
                                                onChange={(e) => handleFieldSelection(index, 'track', e.target.checked)}
                                                style={{ marginRight: '8px' }}
                                            />
                                            <div>
                                                <div>赛道: <span style={{ color: '#999' }}>{suggestion.currentTrack || '无'}</span> → 
                                                <span style={{ color: '#0066cc', fontWeight: 'bold' }}>{suggestion.suggestedTrack}</span></div>
                                                <div className="update-tag">
                                                    🔄 更新: Track列{suggestion.currentTrack ? `从"${suggestion.currentTrack}"更新为` : '设置为'}"{suggestion.suggestedTrack}"
                                                </div>
                                                <div className={`field-source-note ${shouldDefaultSelectField(suggestion, 'track') ? 'field-source-note-ready' : 'field-source-note-review'}`}>
                                                    {getFieldReviewHint(suggestion, 'track')}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        }) : renderEmptyFilterState()
                    ) : (
                        <div className="center" style={{ padding: '20px', background: '#f9f9f9', borderRadius: '8px' }}>
                            <p>没有需要写回的字段建议或风险关注。</p>
                        </div>
                    )}
                </div>
            </div>

            <div className="apply-section">
                <div id="apply-button-container">
                    {analysisResult.updateSuggestions && analysisResult.updateSuggestions.length > 0 && (
                        <>
                            {selectedUpdateCount > 0 && (
                                <div className="apply-selection-context">
                                    {reviewFilter === 'all'
                                        ? `全部已选 ${selectedUpdateCount} 个字段。`
                                        : `当前视图已选 ${visibleSelectedUpdateCount} 个字段，全部已选 ${selectedUpdateCount} 个字段。`}
                                </div>
                            )}
                            {selectedUpdateCount > 0 && (
                                <div
                                    className={`selected-risk-summary ${selectedReviewFieldCount > 0 ? 'selected-risk-summary-attention' : 'selected-risk-summary-ready'}`}
                                    role="status"
                                >
                                    已选字段: {selectedSourcedFieldCount} 个来源充分
                                    {selectedReviewFieldCount > 0
                                        ? `，${selectedReviewFieldCount} 个需人工复核`
                                        : '，无需额外复核'}
                                </div>
                            )}
                            {selectedFieldPreviewItems.length > 0 && (
                                <div
                                    className="selected-writeback-preview"
                                    role="status"
                                    aria-label="已选写回字段预览"
                                >
                                    <div className="selected-writeback-preview-header">
                                        <div className="selected-writeback-preview-title">即将写回</div>
                                        <button
                                            id="copy-selected-writeback-review"
                                            type="button"
                                            className="btn-quiet selected-writeback-copy-button"
                                            onClick={handleCopySelectedWritebackReview}
                                            disabled={isApplying}
                                        >
                                            复制复核清单
                                        </button>
                                    </div>
                                    {selectedWritebackDecisionReceiptLines.length > 0 && (
                                        <div
                                            className={`selected-writeback-decision-receipt ${hasSelectedWritebackDecisionAttention ? 'selected-writeback-decision-receipt-attention' : ''}`}
                                            aria-label="写回决策回执"
                                        >
                                            <div className="selected-writeback-decision-receipt-title">写回决策回执</div>
                                            <ul className="selected-writeback-decision-receipt-list">
                                                {selectedWritebackDecisionReceiptLines.map((line) => (
                                                    <li key={line}>{line}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                    <div className="apply-batch-receipt apply-batch-receipt-preview" aria-label="Google Slides 原子写回回执">
                                        <strong>{getAtomicBatchSummary(selectedFieldPreviewItems)}</strong>
                                        <span>{ATOMIC_BATCH_BOUNDARY_TEXT}</span>
                                    </div>
                                    {reviewPacketCopyReceiptLines.length > 0 && (
                                        <div
                                            className={`selected-writeback-copy-receipt ${
                                                reviewPacketCopyReceipt?.status === 'failed'
                                                    ? 'selected-writeback-copy-receipt-error'
                                                    : reviewPacketCopyReceiptIsStale
                                                        ? 'selected-writeback-copy-receipt-stale'
                                                        : ''
                                            }`}
                                            role="status"
                                            aria-label="复核清单复制回执"
                                        >
                                            <div className="selected-writeback-copy-receipt-title">复核清单复制回执</div>
                                            <ul className="selected-writeback-copy-receipt-list">
                                                {reviewPacketCopyReceiptLines.map((line) => (
                                                    <li key={line}>{line}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                    <ul className="selected-writeback-preview-list">
                                        {selectedFieldPreviewVisibleItems.map((item) => (
                                            <li
                                                key={`${item.projectIndex}-${item.field}`}
                                                className="selected-writeback-preview-item"
                                            >
                                                <span className="selected-writeback-preview-main">
                                                    <strong>{item.projectLabel} · {item.fieldLabel}</strong>
                                                    <span>{item.previewText}</span>
                                                    <span className="selected-writeback-preview-target">
                                                        {item.targetText}
                                                    </span>
                                                    <span className="selected-writeback-preview-evidence">
                                                        {item.evidenceText}
                                                    </span>
                                                </span>
                                                <span className={`selected-writeback-preview-badge selected-writeback-preview-badge-${item.reviewKind}`}>
                                                    {item.reviewLabel}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                    {selectedFieldPreviewOverflowCount > 0 && (
                                        <div className="selected-writeback-preview-more">
                                            还有 {selectedFieldPreviewOverflowCount} 个已选字段会一并写回。
                                        </div>
                                    )}
                                </div>
                            )}
                            {hiddenSelectedUpdateCount > 0 && (
                                <div className="hidden-selection-warning" role="status">
                                    <span>
                                        当前筛选隐藏了 {hiddenSelectedUpdateCount} 个已选字段，应用时会一并写回。
                                    </span>
                                    <span className="hidden-selection-actions">
                                        <button
                                            id="show-selected-fields"
                                            type="button"
                                            className="hidden-selection-button"
                                            onClick={handleShowSelectedFields}
                                            disabled={isApplying}
                                        >
                                            查看已选
                                        </button>
                                        <button
                                            id="keep-visible-selected-fields"
                                            type="button"
                                            className="hidden-selection-button"
                                            onClick={handleKeepCurrentViewSelectedFields}
                                            disabled={isApplying}
                                        >
                                            仅保留当前视图
                                        </button>
                                    </span>
                                </div>
                            )}
                            {applySubmissionReceiptLines.length > 0 && (
                                <div
                                    className="apply-submission-receipt"
                                    role="status"
                                    aria-label="Slides 写回提交中回执"
                                >
                                    <div className="apply-submission-receipt-title">提交中回执</div>
                                    <ul className="apply-submission-receipt-list">
                                        {applySubmissionReceiptLines.map((line) => (
                                            <li key={line}>{line}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            {availableUpdateFieldCount > 0 ? (
                                <button
                                    id="apply-updates-button"
                                    className="btn-primary"
                                    onClick={handleApplyUpdates}
                                    disabled={isApplying || selectedUpdateCount === 0}
                                >
                                    {isApplying ? '正在更新...' : `应用 ${selectedUpdateCount} 个字段到 Slides`}
                                </button>
                            ) : (
                                <div className="apply-empty-note">
                                    当前没有可写回字段；请先处理上方风险关注或返回 Slides 手动调整。
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}

            <style>{styles}</style>
        </div>
    );
};

const styles = `
    .slides-analysis {
        font-family: Arial, sans-serif;
        max-width: 1200px;
        margin: 0 auto;
        padding: 20px;
        background: #fff;
        min-height: 100vh;
    }

    .loading-container {
        text-align: center;
        padding: 50px;
    }

    .loading-hint {
        color: #6b778c;
        font-size: 13px;
        margin-top: 8px;
    }

    .load-error-panel {
        background: #fffbdd;
        border: 1px solid #ffe380;
        border-radius: 6px;
        color: #5f4b00;
        display: inline-block;
        line-height: 1.5;
        margin-top: 16px;
        max-width: 520px;
        padding: 14px 16px;
        text-align: left;
    }

    .load-recovery-receipt {
        background: #f4f7ff;
        border: 1px solid #d6e4ff;
        border-radius: 6px;
        color: #172b4d;
        font-size: 12px;
        line-height: 1.5;
        margin-top: 12px;
        padding: 10px 12px;
    }

    .analysis-snapshot-receipt {
        background: #f6ffed;
        border: 1px solid #b7eb8f;
        border-radius: 8px;
        color: #172b4d;
        margin: 14px 0;
        padding: 12px;
    }

    .analysis-snapshot-receipt-title {
        color: #135200;
        font-size: 13px;
        font-weight: 700;
        margin-bottom: 6px;
    }

    .analysis-snapshot-receipt ul {
        margin: 0;
        padding-left: 18px;
    }

    .analysis-snapshot-receipt li {
        font-size: 13px;
        line-height: 1.5;
        margin-bottom: 4px;
    }

    .analysis-scope-section {
        background: #f4f7ff;
        border: 1px solid #d6e4ff;
        border-radius: 8px;
        color: #172b4d;
        margin-bottom: 20px;
        padding: 16px;
    }

    .analysis-scope-summary {
        color: #42526e;
        font-size: 13px;
        margin: 4px 0 0;
    }

    .analysis-warning-list {
        margin: 12px 0 0;
        padding-left: 20px;
    }

    .analysis-warning-list li {
        line-height: 1.5;
        margin-bottom: 6px;
    }

    .analysis-scope-muted,
    .analysis-warning-more {
        color: #5e6c84;
        font-size: 13px;
        margin: 10px 0 0;
    }

    .analysis-scope-receipt {
        background: #fff;
        border: 1px solid #c7d8ff;
        border-radius: 8px;
        color: #172b4d;
        margin-top: 12px;
        padding: 12px;
    }

    .analysis-scope-receipt-title {
        font-size: 13px;
        font-weight: 700;
        margin-bottom: 6px;
    }

    .analysis-scope-receipt ul {
        margin: 0;
        padding-left: 18px;
    }

    .analysis-scope-receipt li {
        font-size: 13px;
        line-height: 1.5;
        margin-bottom: 4px;
    }

    .success-message {
        background: #d4edda;
        border: 1px solid #c3e6cb;
        color: #155724;
        padding: 15px;
        border-radius: 5px;
        margin-bottom: 20px;
    }

    .success-message-warning {
        background: #fff3cd;
        border-color: #ffeeba;
        color: #856404;
    }

    .apply-failure-message {
        background: #ffebe6;
        border: 1px solid #ffbdad;
        border-radius: 5px;
        color: #bf2600;
        margin-bottom: 20px;
        padding: 15px;
    }

    .apply-batch-receipt {
        background: rgba(255, 255, 255, 0.7);
        border: 1px solid rgba(9, 30, 66, 0.16);
        border-radius: 6px;
        color: inherit;
        display: grid;
        font-size: 12px;
        gap: 3px;
        line-height: 1.4;
        margin-top: 10px;
        padding: 8px 10px;
        text-align: left;
    }

    .apply-batch-receipt-preview {
        background: #fff;
        border-color: #dfe1e6;
        color: #42526e;
        margin: 0 0 7px;
    }

    .apply-batch-receipt-error {
        background: rgba(255, 255, 255, 0.72);
        border-color: rgba(191, 38, 0, 0.24);
    }

    .apply-skipped-details {
        background: rgba(255, 255, 255, 0.65);
        border: 1px solid rgba(133, 100, 4, 0.25);
        border-radius: 6px;
        font-size: 13px;
        line-height: 1.45;
        margin-top: 10px;
        padding: 9px 12px;
    }

    .apply-skipped-title {
        font-weight: 700;
        margin-bottom: 4px;
    }

    .apply-skipped-details ul {
        margin: 0;
        padding-left: 18px;
    }

    .apply-skipped-more {
        color: #6b5a11;
        font-size: 12px;
        margin-top: 4px;
    }

    .apply-skipped-handoff {
        background: rgba(255, 255, 255, 0.72);
        border: 1px solid rgba(133, 100, 4, 0.25);
        border-radius: 6px;
        font-size: 13px;
        line-height: 1.45;
        margin-top: 10px;
        padding: 10px 12px;
    }

    .apply-skipped-handoff-header {
        align-items: flex-start;
        display: flex;
        gap: 12px;
        justify-content: space-between;
        margin-bottom: 8px;
    }

    .apply-skipped-handoff-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        justify-content: flex-end;
    }

    .apply-skipped-handoff-title {
        font-weight: 700;
    }

    .apply-skipped-handoff-summary {
        color: #6b5a11;
        font-size: 12px;
        margin-top: 2px;
    }

    .apply-skipped-reselect-boundary {
        background: rgba(255, 248, 220, 0.58);
        border: 1px solid rgba(133, 100, 4, 0.16);
        border-radius: 5px;
        color: #6b5a11;
        font-size: 12px;
        line-height: 1.4;
        margin-bottom: 8px;
        padding: 6px 8px;
    }

    .apply-skipped-handoff-list {
        display: grid;
        gap: 8px;
        list-style: none;
        margin: 0;
        padding: 0;
    }

    .apply-skipped-handoff-item {
        background: rgba(255, 248, 220, 0.72);
        border: 1px solid rgba(133, 100, 4, 0.18);
        border-radius: 6px;
        display: grid;
        gap: 5px;
        padding: 8px;
    }

    .apply-skipped-handoff-item-unmatched {
        background: rgba(255, 255, 255, 0.65);
    }

    .apply-skipped-handoff-main {
        display: grid;
        gap: 3px;
    }

    .apply-skipped-handoff-title-row {
        align-items: center;
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
    }

    .apply-skipped-handoff-match-badge {
        border-radius: 999px;
        font-size: 11px;
        font-weight: 700;
        line-height: 1.2;
        padding: 2px 7px;
    }

    .apply-skipped-handoff-match-badge-reselectable {
        background: #fff7d6;
        color: #6b5a11;
    }

    .apply-skipped-handoff-match-badge-manual {
        background: #eef2f7;
        color: #5e6c84;
    }

    .apply-skipped-handoff-target,
    .apply-skipped-handoff-evidence,
    .apply-skipped-handoff-reason,
    .apply-skipped-handoff-next {
        color: #6b5a11;
        font-size: 12px;
    }

    .apply-skipped-handoff-next {
        font-weight: 700;
    }

    .apply-failure-handoff {
        border-color: rgba(128, 26, 21, 0.22);
    }

    .apply-failure-handoff .apply-skipped-handoff-summary,
    .apply-failure-handoff .apply-skipped-handoff-reason,
    .apply-failure-handoff .apply-skipped-handoff-next {
        color: #7f1d1d;
    }

    .apply-failure-handoff-item {
        background: rgba(254, 242, 242, 0.72);
        border-color: rgba(128, 26, 21, 0.18);
    }

    .applied-field-receipt {
        background: rgba(255, 255, 255, 0.72);
        border: 1px solid rgba(21, 87, 36, 0.22);
        border-radius: 6px;
        color: inherit;
        font-size: 13px;
        line-height: 1.45;
        margin-top: 10px;
        padding: 10px 12px;
    }

    .success-message-warning .applied-field-receipt {
        border-color: rgba(133, 100, 4, 0.25);
    }

    .applied-field-receipt-error {
        border-color: rgba(191, 38, 0, 0.24);
    }

    .applied-field-receipt-title {
        font-weight: 700;
        margin-bottom: 6px;
    }

    .applied-field-receipt-list {
        display: grid;
        gap: 6px;
        list-style: none;
        margin: 0;
        padding: 0;
    }

    .applied-field-receipt-item {
        align-items: flex-start;
        display: grid;
        gap: 8px;
        grid-template-columns: minmax(0, 1fr) auto;
    }

    .applied-field-receipt-main {
        display: grid;
        gap: 2px;
        min-width: 0;
        overflow-wrap: anywhere;
    }

    .applied-field-receipt-target,
    .applied-field-receipt-evidence {
        color: #5e6c84;
        font-size: 11px;
        line-height: 1.35;
    }

    .applied-field-receipt-more {
        color: #6b778c;
        font-size: 12px;
        margin-top: 6px;
    }

    .summary-section, .field-review-queue-section, .statistics-section, .findings-section, .suggestions-section {
        margin-bottom: 30px;
        padding: 20px;
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        background: #fafafa;
    }

    .project-item {
        margin-bottom: 20px;
        padding: 15px;
        border: 1px solid #ddd;
        border-radius: 8px;
        background: #fff;
    }

    .project-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        flex-wrap: wrap;
    }

    .project-title {
        font-weight: bold;
        min-width: 0;
        overflow-wrap: anywhere;
    }

    .selection-summary {
        color: #42526e;
        font-size: 13px;
        margin-bottom: 0;
    }

    .review-strip {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 10px;
    }

    .review-chip {
        background: #eef2f7;
        border: 1px solid #d9e2ec;
        border-radius: 6px;
        color: #334e68;
        font-size: 12px;
        font-weight: 600;
        padding: 4px 8px;
    }

    .review-chip-safe {
        background: #e3fcef;
        border-color: #abf5d1;
        color: #006644;
    }

    .review-chip-attention {
        background: #fff0b3;
        border-color: #ffe380;
        color: #7a5d00;
    }

    .review-chip-blocked {
        background: #ffebe6;
        border-color: #ffbdad;
        color: #bf2600;
    }

    .review-chip-risk {
        background: #fff4e5;
        border-color: #ffbd7a;
        color: #8a4b00;
    }

    .review-controls {
        align-items: center;
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        justify-content: space-between;
        margin-top: 14px;
    }

    .review-filter-group,
    .bulk-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
    }

    .review-filter-button,
    .btn-quiet {
        background: #fff;
        border: 1px solid #dfe1e6;
        border-radius: 5px;
        color: #253858;
        cursor: pointer;
        font-size: 13px;
        font-weight: 600;
        min-height: 32px;
        padding: 6px 10px;
    }

    .review-filter-button-active {
        background: #deebff;
        border-color: #4c9aff;
        color: #0747a6;
    }

    .review-filter-button:hover,
    .btn-quiet:hover {
        background: #f4f5f7;
    }

    .review-filter-button-active:hover {
        background: #deebff;
    }

    .btn-quiet:disabled {
        background: #f4f5f7;
        color: #a5adba;
        cursor: not-allowed;
    }

    .selection-scope-receipt {
        background: #f4f7ff;
        border: 1px solid #d6e4ff;
        border-radius: 6px;
        color: #172b4d;
        font-size: 12px;
        line-height: 1.5;
        margin-top: 10px;
        padding: 9px 11px;
    }

    .filter-summary {
        color: #6b778c;
        font-size: 13px;
        margin: -8px 0 12px;
    }

    .empty-filter-state {
        background: #f4f5f7;
        border: 1px dashed #c1c7d0;
        border-radius: 6px;
        color: #42526e;
        padding: 18px;
    }

    .empty-filter-title {
        color: #172b4d;
        font-size: 15px;
        font-weight: 700;
        margin-bottom: 6px;
    }

    .empty-filter-detail {
        font-size: 13px;
        line-height: 1.5;
        margin-bottom: 12px;
    }

    .empty-filter-boundary {
        color: #5e6c84;
        font-size: 12px;
        line-height: 1.5;
        margin-bottom: 12px;
    }

    .empty-filter-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
    }

    .empty-filter-action {
        border-color: #c1c7d0;
    }

    .risk-spotlight-section {
        margin-bottom: 30px;
        padding: 18px 20px;
        border: 1px solid #ffbd7a;
        border-radius: 8px;
        background: #fffaf2;
    }

    .section-header-row {
        align-items: center;
        display: flex;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 10px;
    }

    .section-header-row h3 {
        margin: 0;
    }

    .risk-spotlight-list {
        display: grid;
        gap: 10px;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    }

    .risk-spotlight-item {
        background: #fff;
        border: 1px solid #ffe0b2;
        border-left: 4px solid #ff8b00;
        border-radius: 6px;
        padding: 10px 12px;
    }

    .risk-spotlight-title {
        color: #172b4d;
        font-weight: 700;
        overflow-wrap: anywhere;
    }

    .risk-spotlight-reasons {
        color: #5f4b00;
        font-size: 12px;
        line-height: 1.5;
        margin: 6px 0 0;
        padding-left: 18px;
    }

    .risk-spotlight-more {
        color: #6b4f00;
        font-size: 12px;
        margin-top: 10px;
    }

    .field-review-queue-section {
        background: #f8fbff;
        border-color: #cfe1ff;
    }

    .field-review-queue-summary {
        color: #42526e;
        font-size: 13px;
        margin: 6px 0 0;
    }

    .field-review-queue-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
    }

    .field-review-queue-list {
        display: grid;
        gap: 8px;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    }

    .field-review-queue-item {
        align-items: flex-start;
        background: #fff;
        border: 1px solid #dfe1e6;
        border-left: 4px solid #ffab00;
        border-radius: 6px;
        display: flex;
        gap: 10px;
        min-height: 70px;
        padding: 10px 12px;
    }

    .field-review-queue-item-blocked {
        border-left-color: #de350b;
    }

    .field-review-queue-checkbox {
        flex: 0 0 auto;
        margin-top: 3px;
    }

    .field-review-queue-lock {
        background: #ffebe6;
        border-radius: 4px;
        color: #bf2600;
        flex: 0 0 auto;
        font-size: 11px;
        font-weight: 700;
        line-height: 1;
        padding: 5px 6px;
        white-space: nowrap;
    }

    .field-review-queue-body {
        min-width: 0;
    }

    .field-review-queue-title {
        color: #172b4d;
        display: block;
        font-size: 13px;
        font-weight: 700;
        overflow-wrap: anywhere;
    }

    .field-review-queue-reason {
        color: #42526e;
        font-size: 12px;
        line-height: 1.45;
        margin-top: 4px;
        overflow-wrap: anywhere;
    }

    .field-review-queue-preview {
        color: #172b4d;
        font-size: 12px;
        font-weight: 700;
        line-height: 1.45;
        margin-top: 5px;
        overflow-wrap: anywhere;
    }

    .field-review-queue-evidence {
        color: #5e6c84;
        font-size: 11px;
        line-height: 1.4;
        margin-top: 3px;
        overflow-wrap: anywhere;
    }

    .field-review-queue-more {
        color: #6b778c;
        font-size: 12px;
        margin-top: 10px;
    }

    .project-risk-evidence-panel {
        background: #fff7ed;
        border: 1px solid #fed7aa;
        border-left: 4px solid #f97316;
        border-radius: 6px;
        color: #7c2d12;
        margin-top: 10px;
        padding: 10px 12px;
    }

    .project-risk-evidence-title {
        font-size: 12px;
        font-weight: 700;
        margin-bottom: 4px;
    }

    .project-risk-evidence-list {
        font-size: 12px;
        line-height: 1.5;
        margin: 0;
        padding-left: 18px;
    }

    .confidence-badge {
        flex: 0 0 auto;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 600;
        padding: 3px 8px;
    }

    .confidence-high {
        background: #e3fcef;
        color: #006644;
    }

    .confidence-review {
        background: #fff0b3;
        color: #7a5d00;
    }

    .project-review-note {
        background: #fffbdd;
        border-left: 3px solid #ffab00;
        color: #5f4b00;
        font-size: 12px;
        line-height: 1.5;
        margin-top: 8px;
        padding: 6px 8px;
    }

    .source-evidence-panel {
        background: #f4f8ff;
        border: 1px solid #deebff;
        border-radius: 6px;
        color: #253858;
        font-size: 12px;
        line-height: 1.5;
        margin-top: 8px;
        padding: 8px 10px;
    }

    .source-evidence-panel-empty {
        background: #fffbdd;
        border-color: #ffe380;
        color: #5f4b00;
    }

    .source-evidence-title {
        font-weight: 700;
        margin-bottom: 4px;
    }

    .source-evidence-list {
        margin: 0;
        padding-left: 18px;
    }

    .source-evidence-empty {
        color: inherit;
    }

    .jira-issue-key-link,
    .jira-issue-key-text {
        color: #0052cc;
        font-weight: 700;
        overflow-wrap: anywhere;
        text-decoration: none;
    }

    .jira-issue-key-text {
        color: #172b4d;
    }

    .jira-updated-meta {
        align-items: center;
        display: flex;
        gap: 3px;
        margin-right: 10px;
    }

    .jira-updated-meta span:first-child {
        color: #777;
    }

    .project-blocked-note {
        background: #ffebe6;
        border-left: 3px solid #de350b;
        color: #6b1f00;
        font-size: 12px;
        line-height: 1.5;
        margin-top: 8px;
        padding: 6px 8px;
    }

    .project-blocked-field-details {
        background: #fff7f5;
        border: 1px solid #ffbdad;
        border-radius: 6px;
        color: #5f2400;
        font-size: 12px;
        line-height: 1.45;
        margin-top: 8px;
        padding: 9px 10px;
    }

    .project-blocked-field-details-title {
        font-weight: 700;
        margin-bottom: 5px;
    }

    .project-blocked-field-details-list {
        display: grid;
        gap: 6px;
        list-style: none;
        margin: 0;
        padding: 0;
    }

    .project-blocked-field-detail {
        display: grid;
        gap: 2px;
        overflow-wrap: anywhere;
    }

    .project-blocked-field-evidence {
        color: #6b778c;
        font-size: 11px;
    }

    .project-insight-note {
        background: #eae6ff;
        border-left: 3px solid #6554c0;
        color: #403294;
        font-size: 12px;
        line-height: 1.5;
        margin-top: 8px;
        padding: 6px 8px;
    }

    .project-noop-note {
        background: #f4f5f7;
        border-left: 3px solid #8993a4;
        color: #42526e;
        font-size: 12px;
        line-height: 1.5;
        margin-top: 8px;
        padding: 6px 8px;
    }

    .available-fields-count {
        color: #6b778c;
        margin-left: 6px;
    }

    .disabled-label {
        color: #8993a4;
        cursor: not-allowed;
    }

    .update-item {
        display: flex;
        align-items: flex-start;
        margin-bottom: 10px;
        padding: 10px;
        background: #f8f9fa;
        border-radius: 5px;
    }

    .update-tag {
        font-size: 12px;
        color: #0066cc;
        font-weight: bold;
        margin-top: 3px;
    }

    .comment-current {
        color: #6b778c;
        font-size: 12px;
        margin-bottom: 4px;
    }

    .comment-preview {
        background: #fff;
        border: 1px solid #dfe1e6;
        border-radius: 4px;
        color: #172b4d;
        font-size: 12px;
        line-height: 1.5;
        margin-top: 6px;
        max-width: 760px;
        padding: 6px 8px;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
    }

    .reason-tag {
        margin-top: 5px;
        font-size: 12px;
        color: #555;
        font-style: italic;
    }

    .field-source-note {
        border-radius: 4px;
        font-size: 12px;
        line-height: 1.45;
        margin-top: 6px;
        padding: 5px 7px;
    }

    .field-source-note-ready {
        background: #e3fcef;
        color: #006644;
    }

    .field-source-note-review {
        background: #fffbdd;
        color: #5f4b00;
    }

    .btn-primary {
        background-color: #007bff;
        color: white;
        border: none;
        padding: 10px 20px;
        border-radius: 5px;
        cursor: pointer;
        font-size: 16px;
        margin: 10px 0;
    }

    .btn-primary:hover {
        background-color: #0056b3;
    }

    .btn-primary:disabled {
        background-color: #6c757d;
        cursor: not-allowed;
    }

    .btn-secondary {
        background-color: #fff;
        border: 1px solid #0052cc;
        border-radius: 5px;
        color: #0052cc;
        cursor: pointer;
        font-size: 14px;
        margin-top: 8px;
        padding: 8px 14px;
    }

    .btn-secondary:disabled {
        border-color: #a5adba;
        color: #8993a4;
        cursor: not-allowed;
    }

    .apply-section {
        position: sticky;
        bottom: 0;
        text-align: center;
        margin-top: 30px;
        padding: 12px;
        background: rgba(255, 255, 255, 0.96);
        border-top: 1px solid #e0e0e0;
    }

    .apply-selection-context {
        color: #42526e;
        font-size: 12px;
        margin-bottom: 6px;
    }

    .selected-risk-summary {
        border-radius: 6px;
        display: inline-block;
        font-size: 12px;
        line-height: 1.4;
        margin-bottom: 8px;
        max-width: 760px;
        padding: 7px 10px;
    }

    .selected-risk-summary-ready {
        background: #e3fcef;
        border: 1px solid #abf5d1;
        color: #006644;
    }

    .selected-risk-summary-attention {
        background: #fff0b3;
        border: 1px solid #ffe380;
        color: #5f4b00;
    }

    .selected-writeback-preview {
        background: #f7f9fc;
        border: 1px solid #dfe1e6;
        border-radius: 6px;
        color: #253858;
        display: block;
        font-size: 12px;
        line-height: 1.4;
        margin: 0 auto 8px;
        max-width: 760px;
        padding: 8px 10px;
        text-align: left;
    }

    .selected-writeback-preview-title {
        color: #172b4d;
        font-weight: 700;
    }

    .selected-writeback-preview-header {
        align-items: center;
        display: flex;
        gap: 8px;
        justify-content: space-between;
        margin-bottom: 5px;
    }

    .selected-writeback-decision-receipt {
        background: #e3fcef;
        border: 1px solid #abf5d1;
        border-radius: 6px;
        color: #006644;
        display: grid;
        gap: 4px;
        margin: 0 0 7px;
        padding: 8px 10px;
    }

    .selected-writeback-decision-receipt-attention {
        background: #fffbdd;
        border-color: #ffe380;
        color: #5f4b00;
    }

    .selected-writeback-decision-receipt-title {
        color: inherit;
        font-weight: 700;
    }

    .selected-writeback-decision-receipt-list {
        display: grid;
        gap: 3px;
        list-style: disc;
        margin: 0;
        padding-left: 18px;
    }

    .selected-writeback-copy-button {
        font-size: 12px;
        min-height: 28px;
        padding: 4px 8px;
    }

    .selected-writeback-copy-receipt {
        background: #e9f2ff;
        border: 1px solid #4c9aff;
        border-radius: 6px;
        color: #0747a6;
        display: grid;
        gap: 4px;
        margin: 0 0 7px;
        padding: 8px 10px;
    }

    .selected-writeback-copy-receipt-stale {
        background: #fffbdd;
        border-color: #ffe380;
        color: #5f4b00;
    }

    .selected-writeback-copy-receipt-error {
        background: #ffebe6;
        border-color: #ff8f73;
        color: #bf2600;
    }

    .selected-writeback-copy-receipt-title {
        color: inherit;
        font-weight: 700;
    }

    .selected-writeback-copy-receipt-list {
        display: grid;
        gap: 3px;
        list-style: disc;
        margin: 0;
        padding-left: 18px;
    }

    .apply-submission-receipt {
        background: #e9f2ff;
        border: 1px solid #4c9aff;
        border-radius: 6px;
        color: #0747a6;
        display: grid;
        font-size: 12px;
        gap: 4px;
        line-height: 1.4;
        margin: 0 auto 8px;
        max-width: 760px;
        padding: 8px 10px;
        text-align: left;
    }

    .apply-submission-receipt-title {
        color: inherit;
        font-weight: 700;
    }

    .apply-submission-receipt-list {
        display: grid;
        gap: 3px;
        list-style: disc;
        margin: 0;
        padding-left: 18px;
    }

    .selected-writeback-preview-list {
        display: grid;
        gap: 5px;
        list-style: none;
        margin: 0;
        padding: 0;
    }

    .selected-writeback-preview-item {
        align-items: flex-start;
        display: grid;
        gap: 8px;
        grid-template-columns: minmax(0, 1fr) auto;
    }

    .selected-writeback-preview-main {
        display: grid;
        gap: 2px;
        min-width: 0;
        overflow-wrap: anywhere;
    }

    .selected-writeback-preview-target,
    .selected-writeback-preview-evidence {
        color: #5e6c84;
        font-size: 11px;
        line-height: 1.35;
    }

    .selected-writeback-preview-badge {
        border-radius: 4px;
        font-size: 11px;
        font-weight: 700;
        line-height: 1;
        padding: 4px 6px;
        white-space: nowrap;
    }

    .selected-writeback-preview-badge-ready {
        background: #e3fcef;
        color: #006644;
    }

    .selected-writeback-preview-badge-review {
        background: #fff0b3;
        color: #7a5d00;
    }

    .selected-writeback-preview-more {
        color: #6b778c;
        margin-top: 5px;
    }

    .hidden-selection-warning {
        align-items: center;
        background: #fffbdd;
        border: 1px solid #ffe380;
        border-radius: 6px;
        color: #5f4b00;
        display: inline-flex;
        flex-wrap: wrap;
        font-size: 12px;
        gap: 8px;
        justify-content: center;
        line-height: 1.4;
        margin-bottom: 8px;
        max-width: 760px;
        padding: 7px 10px;
    }

    .hidden-selection-actions {
        display: inline-flex;
        flex-wrap: wrap;
        gap: 6px;
    }

    .hidden-selection-button {
        background: #fff;
        border: 1px solid #dfe1e6;
        border-radius: 5px;
        color: #253858;
        cursor: pointer;
        font-size: 12px;
        font-weight: 600;
        min-height: 28px;
        padding: 4px 8px;
    }

    .hidden-selection-button:hover {
        background: #f4f5f7;
    }

    .hidden-selection-button:disabled {
        color: #a5adba;
        cursor: not-allowed;
    }

    .apply-empty-note {
        background: #f4f5f7;
        border: 1px solid #dfe1e6;
        border-radius: 6px;
        color: #42526e;
        font-size: 13px;
        line-height: 1.5;
        padding: 10px 12px;
    }

    .center {
        text-align: center;
    }

    .toast {
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 5px;
        color: white;
        font-weight: bold;
        z-index: 9999;
    }

    .toast-info {
        background-color: #17a2b8;
    }

    .toast-success {
        background-color: #28a745;
    }

    .toast-warning {
        background-color: #ffc107;
        color: #212529;
    }

    .toast-error {
        background-color: #dc3545;
    }

    h3 {
        margin-top: 0;
        color: #333;
    }

    ul {
        padding-left: 20px;
    }

    input[type="checkbox"] {
        margin-right: 8px;
    }

    label {
        cursor: pointer;
    }

    a {
        color: #007bff;
        text-decoration: none;
    }

    a:hover {
        text-decoration: underline;
    }
`;

ReactDOM.render(
    <SlidesAnalysis />,
    document.getElementById('slides-analysis-root')
);
