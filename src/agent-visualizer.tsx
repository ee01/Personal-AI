import * as React from 'react';
import { useState, useEffect } from 'react';
import { ThoughtStep } from './agentThinking';
import {
  buildPendingApprovalActions,
  buildAgentRunReviewItems,
  buildAgentFlowSteps,
  formatApprovalEffect,
  formatApprovalRisk,
  formatToolResult,
  getAgentRunReviewSeverity,
  getStepDiagnosticSummary,
  getStepIntentSummary,
  getStepKind,
  getStepKindClass,
  getStepVisibleSummary,
  stepHasEmptyToolEvidence,
  stepHasToolApprovalRequired,
  stepHasToolBlocked,
  stepHasToolError,
  stepWasSkipped,
} from './agentVisualizerPresentation';

interface AgentVisualizerProps {
  thoughtProcess: ThoughtStep[];
  isProcessing?: boolean;
}

type ApprovalCopyStatus = {
  key: string;
  target: 'key' | 'payload' | 'retry';
  state: 'copied' | 'failed';
  message: string;
} | null;

const AgentVisualizer: React.FC<AgentVisualizerProps> = ({ thoughtProcess, isProcessing = false }) => {
  const [expandedSteps, setExpandedSteps] = useState<number[]>([]);
  const [approvalCopyStatus, setApprovalCopyStatus] = useState<ApprovalCopyStatus>(null);
  const runReviewItems = buildAgentRunReviewItems(thoughtProcess, {
    isProcessing,
  });
  const pendingApprovalActions = buildPendingApprovalActions(thoughtProcess);
  const runReviewSeverity = getAgentRunReviewSeverity(runReviewItems);
  const runReviewLabel: Record<typeof runReviewSeverity, string> = {
    ok: '正常',
    info: '提示',
    warning: '需复核',
    critical: '需处理',
  };

  useEffect(() => {
    setExpandedSteps(prevExpanded =>
      prevExpanded.filter(index => index < thoughtProcess.length),
    );
  }, [thoughtProcess.length]);
  
  // 切换展开/折叠状态
  const toggleExpand = (index: number) => {
    setExpandedSteps(prevExpanded => {
      if (prevExpanded.includes(index)) {
        return prevExpanded.filter(i => i !== index);
      } else {
        return [...prevExpanded, index];
      }
    });
  };

  const handleHeaderKeyDown = (
    event: React.KeyboardEvent<HTMLDivElement>,
    index: number,
  ) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    toggleExpand(index);
  };

  const copyTextToClipboard = async (text: string) => {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (error) {
        console.warn('Clipboard API 复制失败，尝试使用备用复制方式:', error);
      }
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', 'true');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    try {
      return document.execCommand('copy');
    } finally {
      document.body.removeChild(textarea);
    }
  };

  const handleCopyApprovalText = async (
    approvalKey: string,
    text: string,
    target: 'key' | 'payload' | 'retry',
    successMessage: string,
  ) => {
    if (!approvalKey || !text) return;

    try {
      const copied = await copyTextToClipboard(text);
      if (!copied) {
        throw new Error('clipboard copy returned false');
      }
      setApprovalCopyStatus({
        key: approvalKey,
        target,
        state: 'copied',
        message: successMessage,
      });
      window.setTimeout(() => {
        setApprovalCopyStatus(currentStatus =>
          currentStatus?.key === approvalKey && currentStatus.target === target
            ? null
            : currentStatus,
        );
      }, 1800);
    } catch (error) {
      setApprovalCopyStatus({
        key: approvalKey,
        target,
        state: 'failed',
        message:
          target === 'key'
            ? '复制失败，请手动选择 key'
            : target === 'payload'
              ? '复制失败，请手动选择审核包'
              : '复制失败，请手动选择重跑配置',
      });
      console.warn('复制批准 key 失败:', error);
    }
  };

  const handleCopyApprovalKey = (approvalKey: string) =>
    handleCopyApprovalText(approvalKey, approvalKey, 'key', '已复制批准 key');

  const handleCopyApprovalReviewPayload = (
    approvalKey: string,
    reviewPayload: string,
  ) =>
    handleCopyApprovalText(
      approvalKey,
      reviewPayload,
      'payload',
      '已复制审核包',
    );

  const handleCopyApprovalRetryConfig = (
    approvalKey: string,
    retryConfigPatch: string,
  ) =>
    handleCopyApprovalText(
      approvalKey,
      retryConfigPatch,
      'retry',
      '已复制重跑配置',
    );
  
  // 格式化时间戳
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };
  
  // 获取步骤类型的颜色和图标
  const getStepStyle = (step: ThoughtStep) => {
    if (step.action === 'finish') {
      return { color: '#4CAF50', icon: '✓' }; // 完成-绿色
    }

    if (step.toolUsed) {
      const toolResult = step.toolResult ?? (step as any).result;
      // 检查是否有错误
      if (!toolResult || stepHasToolError(step)) {
        return { color: '#F44336', icon: '✗' }; // 错误-红色
      }
      if (stepHasToolApprovalRequired(step)) {
        return { color: '#9A6700', icon: '!' };
      }
      if (stepHasToolBlocked(step)) {
        return { color: '#D97706', icon: '!' };
      }
      if (stepHasEmptyToolEvidence(step)) {
        return { color: '#BF8700', icon: '?' };
      }
      if (stepWasSkipped(step)) {
        return { color: '#757575', icon: '↷' };
      }
      return { color: '#2196F3', icon: '🔧' }; // 工具调用-蓝色
    }
    
    return { color: '#FF9800', icon: '💭' }; // 思考-橙色
  };
  
  return (
    <div className="agent-visualizer">
      <h3>智能Agent处理流程 {isProcessing && <span className="processing-indicator">处理中...</span>}</h3>
      
      {thoughtProcess.length === 0 ? (
        <div className="empty-state">
          {isProcessing ? '等待Agent开始处理...' : '没有处理记录'}
        </div>
      ) : (
        <>
          <section
            className={`agent-run-review ${runReviewSeverity}`}
            aria-live="polite"
          >
            <div className="agent-run-review-header">
              <div>
                <h4>运行检查</h4>
                <p>先处理失败、阻断和预算耗尽，再阅读完整时间线。</p>
              </div>
              <span className={`agent-run-review-status ${runReviewSeverity}`}>
                {runReviewLabel[runReviewSeverity]}
              </span>
            </div>
            <div className="agent-run-review-list">
              {runReviewItems.map((item, index) => (
                <div
                  key={`${item.title}-${index}`}
                  className={`agent-run-review-item ${item.severity}`}
                >
                  <div className="agent-run-review-title">{item.title}</div>
                  <div className="agent-run-review-detail">{item.detail}</div>
                  <div className="agent-run-review-action">{item.action}</div>
                </div>
              ))}
            </div>
          </section>

          {pendingApprovalActions.length > 0 && (
            <section
              className="agent-approval-queue"
              aria-label="待确认动作"
            >
              <div className="agent-approval-queue-header">
                <div>
                  <h4>待确认动作</h4>
                  <p>{pendingApprovalActions.length} 个工具动作等待确认。</p>
                </div>
              </div>
              <div className="agent-approval-list">
                {pendingApprovalActions.map((approval, index) => (
                  <div
                    key={`${approval.toolId}-${approval.approvalKey || index}`}
                    className="agent-approval-item"
                  >
                    <div className="agent-approval-main">
                      <span className="agent-approval-tool">
                        {approval.toolId}
                      </span>
                      <span className="agent-approval-meta">
                        {formatApprovalEffect(approval.effect)}
                      </span>
                      <span className="agent-approval-meta">
                        {formatApprovalRisk(approval.riskLevel)}
                      </span>
                      <span className="agent-approval-step">
                        步骤 {approval.stepIndex + 1}
                      </span>
                    </div>
                    <div className="agent-approval-message">
                      {approval.message}
                    </div>
                    <div className="agent-approval-review-hint">
                      <span>复核重点</span>
                      <p>{approval.reviewHint}</p>
                    </div>
                    <div className="agent-approval-params">
                      <span>参数</span>
                      <code>{approval.paramsPreview}</code>
                    </div>
                    <div className="agent-approval-key-row">
                      <code
                        tabIndex={approval.approvalKey ? 0 : undefined}
                        aria-label={`批准 key: ${approval.approvalKey || '无批准 key'}`}
                      >
                        {approval.approvalKey || '无批准 key'}
                      </code>
                      <div className="agent-approval-actions">
                        <button
                          type="button"
                          className="agent-approval-copy"
                          onClick={() => handleCopyApprovalKey(approval.approvalKey)}
                          aria-label={`复制 ${approval.toolId} 的批准 key`}
                          disabled={!approval.approvalKey}
                        >
                          {approvalCopyStatus?.key === approval.approvalKey &&
                          approvalCopyStatus.target === 'key' &&
                          approvalCopyStatus.state === 'copied'
                            ? '已复制'
                            : '复制 key'}
                        </button>
                        <button
                          type="button"
                          className="agent-approval-copy"
                          onClick={() =>
                            handleCopyApprovalReviewPayload(
                              approval.approvalKey,
                              approval.reviewPayload,
                            )
                          }
                          aria-label={`复制 ${approval.toolId} 的审核包`}
                          disabled={!approval.approvalKey || !approval.reviewPayload}
                        >
                          {approvalCopyStatus?.key === approval.approvalKey &&
                          approvalCopyStatus.target === 'payload' &&
                          approvalCopyStatus.state === 'copied'
                            ? '已复制'
                            : '复制审核包'}
                        </button>
                        <button
                          type="button"
                          className="agent-approval-copy"
                          onClick={() =>
                            handleCopyApprovalRetryConfig(
                              approval.approvalKey,
                              approval.retryConfigPatch,
                            )
                          }
                          aria-label={`复制 ${approval.toolId} 的重跑配置`}
                          disabled={!approval.approvalKey || !approval.retryConfigPatch}
                        >
                          {approvalCopyStatus?.key === approval.approvalKey &&
                          approvalCopyStatus.target === 'retry' &&
                          approvalCopyStatus.state === 'copied'
                            ? '已复制'
                            : '复制重跑配置'}
                        </button>
                      </div>
                    </div>
                    <div className="agent-approval-retry-config">
                      <span>重跑配置</span>
                      <code>{approval.retryConfigPatch}</code>
                    </div>
                    {approvalCopyStatus?.key === approval.approvalKey && (
                      <div
                        className={`agent-approval-copy-status ${approvalCopyStatus.state}`}
                        role="status"
                      >
                        {approvalCopyStatus.message}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          <div className="thought-timeline">
            {thoughtProcess.map((step, index) => {
              const isExpanded = expandedSteps.includes(index);
              const { color, icon } = getStepStyle(step);
              const intentSummary = getStepIntentSummary(step);
              const diagnosticSummary = getStepDiagnosticSummary(step);

              return (
                <div
                  key={index}
                  className={`thought-step ${isExpanded ? 'expanded' : ''}`}
                  style={{ borderLeftColor: color }}
                >
                  <div
                    className="step-header"
                    onClick={() => toggleExpand(index)}
                    onKeyDown={(event) => handleHeaderKeyDown(event, index)}
                    role="button"
                    tabIndex={0}
                    aria-expanded={isExpanded}
                    aria-controls={`agent-step-details-${index}`}
                  >
                    <span className="step-icon" style={{ backgroundColor: color }}>{icon}</span>
                    <div className="step-header-main">
                      <div className="step-title-row">
                        <span className="step-time">{formatTime(step.timestamp)}</span>
                        <span className="step-title">
                          {step.toolUsed
                            ? `使用工具: ${step.toolUsed}`
                            : (step.action === 'finish'
                              ? '完成处理'
                              : '分析判断')}
                        </span>
                        <span className={`step-status ${getStepKindClass(step)}`}>
                          {getStepKind(step)}
                        </span>
                      </div>
                      <div className="step-summary">{getStepVisibleSummary(step)}</div>
                    </div>
                    <span className="expand-icon">{isExpanded ? '▼' : '▶'}</span>
                  </div>

                  {isExpanded && (
                    <div
                      className="step-details"
                      id={`agent-step-details-${index}`}
                    >
                      <div className="thought-content">
                        <h4>决策摘要:</h4>
                        <p>{getStepVisibleSummary(step)}</p>
                      </div>

                      {intentSummary && (
                        <div className="intent-content">
                          <h4>调用意图:</h4>
                          <p>{intentSummary}</p>
                        </div>
                      )}

                      {diagnosticSummary && (
                        <div className="diagnostic-content">
                          <h4>状态说明:</h4>
                          <p>{diagnosticSummary}</p>
                        </div>
                      )}

                      <div className="action-content">
                        <h4>动作:</h4>
                        <p>{step.action}</p>
                      </div>

                      {step.toolUsed && (
                        <div className="tool-result">
                          <h4>工具结果:</h4>
                          <pre>{formatToolResult(step.toolResult ?? (step as any).result)}</pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

// 创建一个流程图组件，以可视化方式展示Agent处理流程
const AgentFlowVisualizer: React.FC<AgentVisualizerProps> = ({ thoughtProcess }) => {
  if (thoughtProcess.length === 0) {
    return (
      <div className="agent-flow-visualizer empty">
        <p>没有处理记录</p>
      </div>
    );
  }
  
  function formatTime(timestamp: number) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  }

  const flowSteps = buildAgentFlowSteps(thoughtProcess, formatTime);
  
  return (
    <div className="agent-flow-visualizer">
      <h3>处理流程图</h3>
      
      <div className="flow-diagram">
        {flowSteps.map((step, index) => {
          let iconClass = '';
          switch (step.type) {
            case 'analysis':
              iconClass = 'icon-analysis';
              break;
            case 'thought':
              iconClass = 'icon-thought';
              break;
            case 'tool':
              iconClass = 'icon-tool';
              break;
            case 'decision':
              iconClass = 'icon-decision';
              break;
          }
          
          return (
            <React.Fragment key={index}>
              <div
                className={`flow-node ${step.type} ${step.resultClass || ''}`}
                aria-label={`${step.name}${step.result ? `: ${step.result}` : ''}`}
              >
                <div className={`node-icon ${iconClass}`}></div>
                <div className="node-content">
                  <div className="node-main">
                    <div className="node-title">{step.name}</div>
                    {step.result && (
                      <span className={`node-result ${step.resultClass || 'success'}`}>
                        {step.result}
                      </span>
                    )}
                  </div>
                  {step.detail && (
                    <div className="node-detail">{step.detail}</div>
                  )}
                  <div className="node-time">{step.time}</div>
                </div>
              </div>
              
              {index < flowSteps.length - 1 && (
                <div className="flow-connector"></div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

// Agent处理结果组件
interface AgentResultSummaryProps {
  result: {
    isImportant: boolean;
    shouldStore: boolean;
    shouldNotify: boolean;
    confidence: number;
    summary: string;
    reasonsToStore?: string[];
  };
  thoughtProcess?: ThoughtStep[];
}

const AgentResultSummary: React.FC<AgentResultSummaryProps> = ({
  result,
  thoughtProcess = [],
}) => {
  const pendingApprovalActions = buildPendingApprovalActions(thoughtProcess);
  const pendingNotifyActions = pendingApprovalActions.filter((approval) =>
    approval.effect === 'notify' ||
    /notify|notification/i.test(approval.toolId),
  );
  const hasPendingNotify = pendingNotifyActions.length > 0;
  const notifyBadgeClass = result.shouldNotify
    ? 'notify'
    : hasPendingNotify
      ? 'pending-notify'
      : 'no-notify';
  const notifyBadgeLabel = result.shouldNotify
    ? '已通知'
    : hasPendingNotify
      ? '待确认通知'
      : '未通知';

  return (
    <div className="agent-result-summary">
      <h3>处理结果</h3>
      
      <div className="result-card">
        <div className="result-header">
          <div className="confidence-meter" title={`置信度: ${Math.round(result.confidence * 100)}%`}>
            <div 
              className="confidence-fill" 
              style={{ width: `${Math.round(result.confidence * 100)}%` }}
            ></div>
          </div>
        </div>
        
        <div className="result-body">
          {pendingApprovalActions.length > 0 && (
            <div className="result-pending-approval" role="status">
              <h4>待确认动作未执行</h4>
              <p>
                还有 {pendingApprovalActions.length} 个工具动作等待人工确认；最终结果没有把这些动作当作已完成。
              </p>
              <ul>
                {pendingApprovalActions.map((approval, index) => (
                  <li key={`${approval.toolId}-${approval.approvalKey || index}`}>
                    <strong>{approval.toolId}</strong>
                    <span>
                      {formatApprovalEffect(approval.effect)} /{' '}
                      {formatApprovalRisk(approval.riskLevel)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="summary-section">
            <h4>消息总结</h4>
            <p>{result.summary}</p>
          </div>
          
          <div className="decisions-section">
            <div className={`decision-badge ${result.isImportant ? 'important' : 'not-important'}`}>
              {result.isImportant ? '重要' : '非重要'}
            </div>
            
            <div className={`decision-badge ${result.shouldStore ? 'store' : 'no-store'}`}>
              {result.shouldStore ? '已存储' : '未存储'}
            </div>
            
            <div className={`decision-badge ${notifyBadgeClass}`}>
              {notifyBadgeLabel}
            </div>
          </div>
          
          {result.reasonsToStore && result.reasonsToStore.length > 0 && (
            <div className="reasons-section">
              <h4>存储理由</h4>
              <ul>
                {result.reasonsToStore.map((reason, index) => (
                  <li key={index}>{reason}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export { AgentVisualizer, AgentFlowVisualizer, AgentResultSummary };
