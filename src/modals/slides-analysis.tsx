import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { useState, useEffect, useRef } from 'react';
import { ProjectUpdateSuggestion } from '../slide';
import { DisplaySlideAnalysisResult } from '../contentScriptGoogleSlide';
import {
    getNewSuggestionText,
    normalizeComparableText,
} from '../utils/slidesAnalyzerSuggestions';

interface AnalysisData {
    result: DisplaySlideAnalysisResult;
    presentationId: string;
}

type UpdateField = 'status' | 'owner' | 'track' | 'comments';
type ReviewFilter = 'all' | 'selected' | 'review' | 'blocked';

const GOOGLE_SLIDES_ORIGIN = 'https://docs.google.com';
const HIGH_CONFIDENCE_THRESHOLD = 0.75;
const APPLY_TIMEOUT_MS = 45000;
const INITIAL_DATA_TIMEOUT_MS = 12000;
const UPDATE_FIELD_LABELS: Record<UpdateField, string> = {
    status: '状态列',
    owner: '负责人列',
    track: '赛道列',
    comments: '备注列'
};
const REVIEW_FILTER_LABELS: Record<ReviewFilter, string> = {
    all: '全部',
    selected: '已选',
    review: '需复核',
    blocked: '无法写回'
};

const fieldKey = (projectIndex: number, field: UpdateField) => `${projectIndex}:${field}`;

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

const shouldDefaultSelectSuggestion = (suggestion: ProjectUpdateSuggestion): boolean => (
    getAvailableUpdateFields(suggestion).length > 0 &&
    (suggestion.confidence || 0) >= HIGH_CONFIDENCE_THRESHOLD &&
    hasVisibleEvidence(suggestion)
);

const isSuggestionReviewRequired = (suggestion: ProjectUpdateSuggestion): boolean => (
    (suggestion.confidence || 0) < HIGH_CONFIDENCE_THRESHOLD || !hasVisibleEvidence(suggestion)
);

const confidenceReviewText = (suggestion: ProjectUpdateSuggestion): string => {
    const confidence = suggestion.confidence || 0;

    if (getAvailableUpdateFields(suggestion).length === 0) {
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

    return '高可信有来源 · 已默认选中';
};

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
    const fields: string[] = [];

    if (
        hasMeaningfulSuggestedChange(suggestion.currentStatus, suggestion.suggestedStatus) &&
        !hasWritableColumnIndex(suggestion.columnIndices?.status)
    ) {
        fields.push(UPDATE_FIELD_LABELS.status);
    }

    if (
        getNewSuggestedComments(suggestion) &&
        !hasWritableColumnIndex(suggestion.columnIndices?.comments)
    ) {
        fields.push(UPDATE_FIELD_LABELS.comments);
    }

    if (
        hasMeaningfulSuggestedChange(suggestion.currentOwner, suggestion.suggestedOwner) &&
        !hasWritableColumnIndex(suggestion.columnIndices?.owner)
    ) {
        fields.push(UPDATE_FIELD_LABELS.owner);
    }

    if (
        hasMeaningfulSuggestedChange(suggestion.currentTrack, suggestion.suggestedTrack) &&
        !hasWritableColumnIndex(suggestion.columnIndices?.track)
    ) {
        fields.push(UPDATE_FIELD_LABELS.track);
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
    const [toast, setToast] = useState<{ message: string; type: 'info' | 'success' | 'warning' | 'error' } | null>(null);
    const [isApplying, setIsApplying] = useState(false);
    const [selectedFields, setSelectedFields] = useState<Record<string, boolean>>({});
    const [reviewFilter, setReviewFilter] = useState<ReviewFilter>('all');
    const [lastApplyResult, setLastApplyResult] = useState<{ updatedCount: number; skippedCount: number } | null>(null);
    const [loadError, setLoadError] = useState<string>('');
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
            return;
        }

        const defaults: Record<string, boolean> = {};
        analysisResult.updateSuggestions.forEach((suggestion, projectIndex) => {
            if (!shouldDefaultSelectSuggestion(suggestion)) {
                return;
            }

            getAvailableUpdateFields(suggestion).forEach((field) => {
                defaults[fieldKey(projectIndex, field)] = true;
            });
        });

        setSelectedFields(defaults);
        setLastApplyResult(null);
    }, [analysisResult]);

    const initAnalysisPage = () => {
        try {
            setLoadError('');
            clearInitialDataTimeout();

            // 告知父窗口页面已加载完成，请求数据
            if (window.opener) {
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
                setAnalysisResult(data.result);
                setPresentationId(data.presentationId);
                setLoadError('');
            } else if (event.data.type === 'UPDATE_SUCCESS') {
                debugLog('收到更新成功消息: ' + JSON.stringify(event.data));
                clearApplyTimeout();
                const updatedCount = Number(event.data.updatedCount) || 0;
                const skippedCount = Array.isArray(event.data.errors) ? event.data.errors.length : 0;
                const skippedSummary = skippedCount > 0 ? `，跳过 ${skippedCount} 项` : '';
                showToast(`更新成功: 已写回 ${updatedCount} 个字段${skippedSummary}`, skippedCount > 0 ? 'warning' : 'success');
                setIsApplying(false);
                setSelectedFields({});
                setLastApplyResult({ updatedCount, skippedCount });
            } else if (event.data.type === 'UPDATE_ERROR') {
                clearApplyTimeout();
                showToast('更新失败: ' + (event.data.errorMessage || '未知错误'), 'error');
                debugLog('收到更新错误消息: ' + JSON.stringify(event.data));
                setIsApplying(false);
                setLastApplyResult(null);
            }
        } catch (err) {
            debugLog('处理消息时出错: ' + (err as Error).message);
            console.error('处理父窗口消息时出错:', err);
            setIsApplying(false);
        }
    };

    const handleSelectAll = (projectIndex: number, isChecked: boolean) => {
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
    };

    const handleFieldSelection = (projectIndex: number, field: UpdateField, isChecked: boolean) => {
        setSelectedFields((current) => ({
            ...current,
            [fieldKey(projectIndex, field)]: isChecked
        }));
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
            if (!shouldDefaultSelectSuggestion(suggestion)) {
                return;
            }

            getAvailableUpdateFields(suggestion).forEach((field) => {
                defaults[fieldKey(projectIndex, field)] = true;
            });
        });

        return defaults;
    };

    const handleRestoreHighConfidenceDefaults = () => {
        const defaults = buildHighConfidenceDefaults();
        const restoredCount = Object.keys(defaults).length;
        setSelectedFields(defaults);
        showToast(`已恢复 ${restoredCount} 个高可信默认选择`, restoredCount > 0 ? 'info' : 'warning');
    };

    const handleClearSelectedFields = () => {
        setSelectedFields({});
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
            if (!shouldDefaultSelectSuggestion(suggestion)) {
                return count;
            }

            return count + getAvailableUpdateFields(suggestion).length;
        }, 0)
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

    const filteredSuggestionEntries = analysisResult
        ? analysisResult.updateSuggestions
            .map((suggestion, index) => ({ suggestion, index }))
            .filter(({ suggestion, index }) => suggestionMatchesReviewFilter(suggestion, index))
        : [];

    const handleApplyUpdates = () => {
        try {
            debugLog('应用更新按钮被点击');

            if (!analysisResult || selectedUpdateCount === 0) {
                showToast('请选择至少一个更新项', 'warning');
                return;
            }
            
            debugLog('选择了 ' + selectedUpdateCount + ' 个更新项');
            setLastApplyResult(null);

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
                setIsApplying(true);
                applyTimeoutRef.current = window.setTimeout(() => {
                    applyTimeoutRef.current = null;
                    setIsApplying(false);
                    setLastApplyResult(null);
                    showToast('写回请求超时，请回到 Slides 页面确认是否已更新后再重试', 'warning');
                    debugLog('写回请求超时，未收到父窗口结果消息');
                }, APPLY_TIMEOUT_MS);
            } else {
                showToast('无法与父窗口通信，请重新打开分析窗口', 'error');
                debugLog('父窗口引用不存在');
            }
        } catch (err) {
            clearApplyTimeout();
            setIsApplying(false);
            showToast('更新操作失败: ' + (err as Error).message, 'error');
            debugLog('错误: ' + (err as Error).message);
            console.error(err);
        }
    };

    const showToast = (message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
        setToast({ message, type });
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
        if (!dateString) return '';
        
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('zh-CN');
        } catch (e) {
            return dateString;
        }
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
                                onClick={initAnalysisPage}
                                disabled={!window.opener}
                            >
                                重新请求数据
                            </button>
                        </div>
                    ) : (
                        <p className="loading-hint">请保持原 Google Slides 页面打开。</p>
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

    return (
        <div className="slides-analysis">
            {lastApplyResult && (
                <div className={`success-message ${lastApplyResult.skippedCount > 0 ? 'success-message-warning' : ''}`}>
                    <h3>更新完成</h3>
                    <p>
                        已写回 {lastApplyResult.updatedCount} 个字段
                        {lastApplyResult.skippedCount > 0 ? `，跳过 ${lastApplyResult.skippedCount} 项` : ''}。
                    </p>
                </div>
            )}

            <div className="summary-section">
                <h3>📊 分析报告</h3>
                <div id="summary-info">
                    <p>检测到 {analysisResult.summary.totalProjects} 个项目，{analysisResult.summary.projectsNeedingUpdate} 个需要更新</p>
                    {analysisResult.updateSuggestions.length > 0 && (
                        <p className="selection-summary">已选择 {selectedUpdateCount} 个字段</p>
                    )}
                    {analysisResult.updateSuggestions.length > 0 && (
                        <div className="review-strip">
                            <span className="review-chip">可更新字段 {availableUpdateFieldCount}</span>
                            <span className="review-chip review-chip-safe">高可信默认 {defaultSelectedFieldCount}</span>
                            <span className="review-chip review-chip-attention">需复核项目 {reviewRequiredCount}</span>
                            {missingEvidenceCount > 0 && (
                                <span className="review-chip review-chip-attention">缺少来源 {missingEvidenceCount}</span>
                            )}
                            {unavailableUpdateFieldCount > 0 && (
                                <span className="review-chip review-chip-blocked">无法写回字段 {unavailableUpdateFieldCount}</span>
                            )}
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
                </div>
            </div>

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

            <div className="suggestions-section">
                <h3>💡 更新建议</h3>
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
                            const evidenceItems = getSuggestionEvidenceItems(suggestion);
                            const needsReview = isSuggestionReviewRequired(suggestion);
                            const isDefaultSelectable = shouldDefaultSelectSuggestion(suggestion);
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
                                                {(suggestion.confidence || 0) < HIGH_CONFIDENCE_THRESHOLD
                                                    ? '低可信建议未自动选中，来源或理由不足时保持不写回。'
                                                    : '缺少可见来源或理由，需人工确认后手动勾选。'}
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
                                                {suggestion.sourceInfo.jiraIssues.map((issue, issueIndex) => (
                                                    <div key={issueIndex} className="jira-issue-item" style={{ 
                                                        marginBottom: '8px', 
                                                        padding: '5px', 
                                                        borderLeft: '3px solid #0052CC' 
                                                    }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                            <a href={issue.url || '#'} target="_blank" rel="noreferrer" style={{
                                                                color: '#0052CC', 
                                                                fontWeight: 'bold', 
                                                                textDecoration: 'none' 
                                                            }}>
                                                                {issue.key}
                                                            </a>
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
                                                                        color: new Date(issue.duedate) < new Date() ? '#FF5630' : '#333',
                                                                        fontWeight: new Date(issue.duedate) < new Date() ? 'bold' : 'normal'
                                                                    }}>
                                                                        {formatDate(issue.duedate)}
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        
                                        <div style={{ marginTop: '5px', marginBottom: '10px', fontSize: '12px', color: '#666' }}>
                                            <span style={{ display: 'inline-block', marginRight: '10px' }}>
                                                <input 
                                                    type="checkbox" 
                                                    id={`select-all-${index}`} 
                                                    className="select-all-checkbox"
                                                    checked={allAvailableSelected}
                                                    disabled={availableFields.length === 0}
                                                    onChange={(e) => handleSelectAll(index, e.target.checked)}
                                                />
                                                <label
                                                    htmlFor={`select-all-${index}`}
                                                    className={availableFields.length === 0 ? 'disabled-label' : undefined}
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
                                                checked={isFieldSelected(index, 'status')}
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
                                            </div>
                                        </div>
                                    )}
                                    
                                    {hasCommentsColumn && newSuggestedComments && (
                                        <div className="update-item">
                                            <input 
                                                type="checkbox" 
                                                id={`update-comments-${index}`} 
                                                className="update-item-checkbox"
                                                checked={isFieldSelected(index, 'comments')}
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
                                            </div>
                                        </div>
                                    )}
                                    
                                    {hasOwnerColumn && hasMeaningfulSuggestedChange(suggestion.currentOwner, suggestion.suggestedOwner) && (
                                        <div className="update-item">
                                            <input 
                                                type="checkbox" 
                                                id={`update-owner-${index}`} 
                                                className="update-item-checkbox"
                                                checked={isFieldSelected(index, 'owner')}
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
                                            </div>
                                        </div>
                                    )}
                                    
                                    {hasTrackColumn && hasMeaningfulSuggestedChange(suggestion.currentTrack, suggestion.suggestedTrack) && (
                                        <div className="update-item">
                                            <input 
                                                type="checkbox" 
                                                id={`update-track-${index}`} 
                                                className="update-item-checkbox"
                                                checked={isFieldSelected(index, 'track')}
                                                onChange={(e) => handleFieldSelection(index, 'track', e.target.checked)}
                                                style={{ marginRight: '8px' }}
                                            />
                                            <div>
                                                <div>赛道: <span style={{ color: '#999' }}>{suggestion.currentTrack || '无'}</span> → 
                                                <span style={{ color: '#0066cc', fontWeight: 'bold' }}>{suggestion.suggestedTrack}</span></div>
                                                <div className="update-tag">
                                                    🔄 更新: Track列{suggestion.currentTrack ? `从"${suggestion.currentTrack}"更新为` : '设置为'}"{suggestion.suggestedTrack}"
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        }) : (
                            <div className="empty-filter-state">
                                当前视图没有匹配的更新建议。
                            </div>
                        )
                    ) : (
                        <div className="center" style={{ padding: '20px', background: '#f9f9f9', borderRadius: '8px' }}>
                            <p>所有项目信息均已是最新，无需更新。</p>
                        </div>
                    )}
                </div>
            </div>

            <div className="apply-section">
                <div id="apply-button-container">
                    {analysisResult.updateSuggestions && analysisResult.updateSuggestions.length > 0 && (
                        <button 
                            id="apply-updates-button" 
                            className="btn-primary"
                            onClick={handleApplyUpdates}
                            disabled={isApplying || selectedUpdateCount === 0}
                        >
                            {isApplying ? '正在更新...' : `应用 ${selectedUpdateCount} 个字段到 Slides`}
                        </button>
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

    .summary-section, .statistics-section, .findings-section, .suggestions-section {
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
        text-align: center;
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

    .project-blocked-note {
        background: #ffebe6;
        border-left: 3px solid #de350b;
        color: #6b1f00;
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
