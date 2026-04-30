import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { useState, useEffect } from 'react';
import { ProjectUpdateSuggestion } from '../slide';
import { DisplaySlideAnalysisResult } from '../contentScriptGoogleSlide';

interface AnalysisData {
    result: DisplaySlideAnalysisResult;
    presentationId: string;
}

type UpdateField = 'status' | 'owner' | 'track' | 'comments';

const GOOGLE_SLIDES_ORIGIN = 'https://docs.google.com';
const HIGH_CONFIDENCE_THRESHOLD = 0.75;

const fieldKey = (projectIndex: number, field: UpdateField) => `${projectIndex}:${field}`;

const getAvailableUpdateFields = (suggestion: ProjectUpdateSuggestion): UpdateField[] => {
    const fields: UpdateField[] = [];
    const hasStatusColumn = suggestion.columnIndices?.status !== undefined && suggestion.columnIndices.status !== -1;
    const hasOwnerColumn = suggestion.columnIndices?.owner !== undefined && suggestion.columnIndices.owner !== -1;
    const hasTrackColumn = suggestion.columnIndices?.track !== undefined && suggestion.columnIndices.track !== -1;
    const hasCommentsColumn = suggestion.columnIndices?.comments !== undefined && suggestion.columnIndices.comments !== -1;

    if (hasStatusColumn && suggestion.suggestedStatus && suggestion.suggestedStatus !== suggestion.currentStatus) {
        fields.push('status');
    }
    if (hasCommentsColumn && suggestion.suggestedComments) {
        fields.push('comments');
    }
    if (hasOwnerColumn && suggestion.suggestedOwner && suggestion.suggestedOwner !== suggestion.currentOwner) {
        fields.push('owner');
    }
    if (hasTrackColumn && suggestion.suggestedTrack && suggestion.suggestedTrack !== suggestion.currentTrack) {
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
    const [toast, setToast] = useState<{ message: string; type: 'info' | 'success' | 'warning' | 'error' } | null>(null);
    const [isApplying, setIsApplying] = useState(false);
    const [selectedFields, setSelectedFields] = useState<Record<string, boolean>>({});

    useEffect(() => {
        initAnalysisPage();
        
        // 接收来自父窗口的消息
        const handleParentMessage = (event: MessageEvent) => {
            handleParentMessageReceived(event);
        };
        
        window.addEventListener('message', handleParentMessage);
        
        return () => {
            window.removeEventListener('message', handleParentMessage);
        };
    }, []);

    useEffect(() => {
        if (!analysisResult) {
            setSelectedFields({});
            return;
        }

        const defaults: Record<string, boolean> = {};
        analysisResult.updateSuggestions.forEach((suggestion, projectIndex) => {
            if ((suggestion.confidence || 0) < HIGH_CONFIDENCE_THRESHOLD) {
                return;
            }

            getAvailableUpdateFields(suggestion).forEach((field) => {
                defaults[fieldKey(projectIndex, field)] = true;
            });
        });

        setSelectedFields(defaults);
    }, [analysisResult]);

    const initAnalysisPage = () => {
        try {
            // 告知父窗口页面已加载完成，请求数据
            if (window.opener) {
                debugLog('向父窗口请求分析数据');
                window.opener.postMessage({ type: 'REQUEST_ANALYSIS_DATA' }, getAllowedOpenerOrigin());
            } else {
                showToast('无法与父窗口通信', 'error');
            }
        } catch (err) {
            console.error('初始化分析页面时出错:', err);
            showToast('初始化页面失败: ' + (err as Error).message, 'error');
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
                const data: AnalysisData = event.data.data;
                setAnalysisResult(data.result);
                setPresentationId(data.presentationId);
            } else if (event.data.type === 'UPDATE_SUCCESS') {
                debugLog('收到更新成功消息: ' + JSON.stringify(event.data));
                showToast(`更新成功: 已更新 ${event.data.updatedCount || '0'} 个项目`, 'success');
                setIsApplying(false);
            } else if (event.data.type === 'UPDATE_ERROR') {
                showToast('更新失败: ' + (event.data.errorMessage || '未知错误'), 'error');
                debugLog('收到更新错误消息: ' + JSON.stringify(event.data));
                setIsApplying(false);
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

    const selectedUpdateCount = analysisResult
        ? analysisResult.updateSuggestions.reduce((count, suggestion, projectIndex) => {
            return count + getAvailableUpdateFields(suggestion)
                .filter((field) => isFieldSelected(projectIndex, field)).length;
        }, 0)
        : 0;

    const handleApplyUpdates = () => {
        try {
            debugLog('应用更新按钮被点击');

            if (!analysisResult || selectedUpdateCount === 0) {
                showToast('请选择至少一个更新项', 'warning');
                return;
            }
            
            debugLog('选择了 ' + selectedUpdateCount + ' 个更新项');

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
                        partialUpdate.suggestedComments = originalSuggestion.suggestedComments;
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
                window.opener.postMessage(message, getAllowedOpenerOrigin());
                showToast('正在应用更新...', 'info');
                setIsApplying(true);
            } else {
                showToast('无法与父窗口通信，请重新打开分析窗口', 'error');
                debugLog('父窗口引用不存在');
            }
        } catch (err) {
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
            <div className="success-message" id="success-message" style={{ display: 'none' }}>
                <h3>✅ 更新完成</h3>
                <p id="success-details"></p>
            </div>

            <div className="summary-section">
                <h3>📊 分析报告</h3>
                <div id="summary-info">
                    <p>检测到 {analysisResult.summary.totalProjects} 个项目，{analysisResult.summary.projectsNeedingUpdate} 个需要更新</p>
                    {analysisResult.updateSuggestions.length > 0 && (
                        <p className="selection-summary">已选择 {selectedUpdateCount} 项更新</p>
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
                <div id="suggestions-container">
                    {analysisResult.updateSuggestions && analysisResult.updateSuggestions.length > 0 ? (
                        analysisResult.updateSuggestions.map((suggestion, index) => {
                            const hasStatusColumn = suggestion.columnIndices?.status !== undefined && suggestion.columnIndices.status !== -1;
                            const hasOwnerColumn = suggestion.columnIndices?.owner !== undefined && suggestion.columnIndices.owner !== -1;
                            const hasTrackColumn = suggestion.columnIndices?.track !== undefined && suggestion.columnIndices.track !== -1;
                            const hasCommentsColumn = suggestion.columnIndices?.comments !== undefined && suggestion.columnIndices.comments !== -1;
                            const availableFields = getAvailableUpdateFields(suggestion);
                            const allAvailableSelected = availableFields.length > 0 &&
                                availableFields.every((field) => isFieldSelected(index, field));

                            return (
                                <div key={index} className="project-item">
                                    <div style={{ marginBottom: '10px' }}>
                                        <div className="project-header">
                                            <span className="project-title">项目 {suggestion.projectId}: {suggestion.projectName}</span>
                                            <span className={`confidence-badge ${suggestion.confidence >= HIGH_CONFIDENCE_THRESHOLD ? 'confidence-high' : 'confidence-review'}`}>
                                                可信度 {Math.round((suggestion.confidence || 0) * 100)}%
                                            </span>
                                        </div>
                                        
                                        {/* Jira信息显示区域 */}
                                        {suggestion.sourceInfo.jiraIssues && suggestion.sourceInfo.jiraIssues.length > 0 && (
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
                                                    onChange={(e) => handleSelectAll(index, e.target.checked)}
                                                />
                                                <label htmlFor={`select-all-${index}`}>全选</label>
                                            </span>
                                        </div>
                                    </div>
                                    
                                    {hasStatusColumn && suggestion.suggestedStatus && suggestion.suggestedStatus !== suggestion.currentStatus && (
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
                                    
                                    {hasCommentsColumn && suggestion.suggestedComments && (
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
                                                <div className="update-tag">
                                                    🔄 更新: Comment列{suggestion.currentComments ? '添加' : '设置为'}"{suggestion.suggestedComments}"
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
                                    
                                    {hasOwnerColumn && suggestion.suggestedOwner && suggestion.suggestedOwner !== suggestion.currentOwner && (
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
                                    
                                    {hasTrackColumn && suggestion.suggestedTrack && suggestion.suggestedTrack !== suggestion.currentTrack && (
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
                        })
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
                            {isApplying ? '正在更新...' : `应用 ${selectedUpdateCount} 项更新`}
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

    .success-message {
        background: #d4edda;
        border: 1px solid #c3e6cb;
        color: #155724;
        padding: 15px;
        border-radius: 5px;
        margin-bottom: 20px;
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
