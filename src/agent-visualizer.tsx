import * as React from 'react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { ThoughtStep } from './agentThinking';
import {
  type AgentDiagnosticCopiedSnapshot,
  buildAgentRunDiagnosticPacket,
  buildAgentRunSnapshot,
  buildAgentDiagnosticCopyScope,
  buildAgentDiagnosticCopyPreflight,
  buildAgentDiagnosticCopiedSnapshot,
  buildAgentDiagnosticCopyFreshnessReceipt,
  buildAgentDiagnosticCopySuccessReceipt,
  buildAgentApprovalCopyButtonBoundary,
  buildAgentTraceReviewLane,
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
  manualText?: string;
} | null;

type ApprovalCopyReceipt = {
  key: string;
  toolId: string;
  target: 'key' | 'payload' | 'retry';
  targetLabel: string;
  copiedSnapshot: AgentDiagnosticCopiedSnapshot | null;
  copiedAt: string;
} | null;

type RunPacketCopyStatus = {
  state: 'copied' | 'failed';
  message: string;
  copiedSnapshot: AgentDiagnosticCopiedSnapshot;
  manualText?: string;
} | null;

const AGENT_TRACE_JUMP_EVENT = 'agent-thinking:jump-to-step';
const AGENT_TRACE_STEP_BUTTON_NO_EFFECT_BOUNDARY =
  '只展开并聚焦当前页面时间线；不会批准、复制诊断包、重跑、发送通知、写入、删除或执行外部动作。';

const normalizeAgentTraceButtonBoundaryPart = (value?: string) =>
  value?.trim().replace(/。+$/u, '') || '';

const buildAgentTraceStepButtonBoundary = (
  sourceLabel: string,
  stepNumber: number,
  reason?: string,
  boundary = AGENT_TRACE_STEP_BUTTON_NO_EFFECT_BOUNDARY,
) =>
  [
    `从${sourceLabel}跳到步骤 ${stepNumber}`,
    reason ? `复核理由：${reason}` : '',
    boundary,
  ]
    .map(normalizeAgentTraceButtonBoundaryPart)
    .filter(Boolean)
    .join('。') + '。';

const approvalCopyTargetLabel: Record<
  Exclude<ApprovalCopyStatus, null>['target'],
  string
> = {
  key: '批准 key',
  payload: '审核包',
  retry: '重跑配置',
};

const AgentVisualizer: React.FC<AgentVisualizerProps> = ({ thoughtProcess, isProcessing = false }) => {
  const [expandedSteps, setExpandedSteps] = useState<number[]>([]);
  const [approvalCopyStatus, setApprovalCopyStatus] = useState<ApprovalCopyStatus>(null);
  const [approvalCopyReceipt, setApprovalCopyReceipt] =
    useState<ApprovalCopyReceipt>(null);
  const [runPacketCopyStatus, setRunPacketCopyStatus] = useState<RunPacketCopyStatus>(null);
  const runReviewItems = buildAgentRunReviewItems(thoughtProcess, {
    isProcessing,
  });
  const pendingApprovalActions = buildPendingApprovalActions(thoughtProcess);
  const runReviewSeverity = getAgentRunReviewSeverity(runReviewItems);
  const runDiagnosticPacket = useMemo(
    () =>
      thoughtProcess.length === 0
        ? null
        : buildAgentRunDiagnosticPacket(thoughtProcess, {
            isProcessing,
          }),
    [thoughtProcess, isProcessing],
  );
  const runSnapshot = useMemo(
    () => (runDiagnosticPacket ? buildAgentRunSnapshot(runDiagnosticPacket) : null),
    [runDiagnosticPacket],
  );
  const diagnosticCopyScope = useMemo(
    () =>
      runDiagnosticPacket
        ? buildAgentDiagnosticCopyScope(runDiagnosticPacket)
        : null,
    [runDiagnosticPacket],
  );
  const diagnosticCopyPreflight = useMemo(
    () =>
      runDiagnosticPacket
        ? buildAgentDiagnosticCopyPreflight(runDiagnosticPacket)
        : null,
    [runDiagnosticPacket],
  );
  const traceReviewLane = useMemo(
    () =>
      runDiagnosticPacket
        ? buildAgentTraceReviewLane(runDiagnosticPacket)
        : null,
    [runDiagnosticPacket],
  );
  const traceNavigationReceipt =
    runDiagnosticPacket?.navigationReceipt || null;
  const traceSpanComposition =
    runDiagnosticPacket?.traceSpanComposition || null;
  const approvalQueueReceipt =
    runDiagnosticPacket?.approvalQueueReceipt || null;
  const runReviewLabel: Record<typeof runReviewSeverity, string> = {
    ok: '正常',
    info: '提示',
    warning: '需复核',
    critical: '需处理',
  };
  const runPacketCopyIsStale = Boolean(
    runPacketCopyStatus &&
    runDiagnosticPacket &&
    runPacketCopyStatus.copiedSnapshot.traceId !==
      runDiagnosticPacket.traceIdentity.traceId,
  );
  const runPacketCopyFreshnessReceipt =
    runPacketCopyStatus && runPacketCopyStatus.copiedSnapshot
      ? buildAgentDiagnosticCopyFreshnessReceipt(
          runPacketCopyStatus.copiedSnapshot,
          runDiagnosticPacket,
        )
      : null;
  const resultHandoffReceipt =
    runDiagnosticPacket?.resultHandoffReceipt || null;
  const processingIndicatorText = resultHandoffReceipt
    ? '结果整理中...'
    : isProcessing
      ? '处理中...'
      : '';

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

  const jumpToStep = useCallback((index: number) => {
    setExpandedSteps(prevExpanded =>
      prevExpanded.includes(index)
        ? prevExpanded
        : [...prevExpanded, index],
    );

    window.requestAnimationFrame(() => {
      const stepElement = document.getElementById(`agent-step-${index}`);
      const stepHeader = document.getElementById(`agent-step-header-${index}`);
      stepElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      stepHeader?.focus();
    });
  }, []);

  useEffect(() => {
    const handleExternalJump = (event: Event) => {
      const stepIndex = (event as CustomEvent<{ stepIndex?: number }>).detail
        ?.stepIndex;
      if (
        !Number.isInteger(stepIndex) ||
        stepIndex < 0 ||
        stepIndex >= thoughtProcess.length
      ) {
        return;
      }
      jumpToStep(stepIndex);
    };

    window.addEventListener(AGENT_TRACE_JUMP_EVENT, handleExternalJump);
    return () => {
      window.removeEventListener(AGENT_TRACE_JUMP_EVENT, handleExternalJump);
    };
  }, [jumpToStep, thoughtProcess.length]);

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
    toolId: string,
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
      setApprovalCopyReceipt({
        key: approvalKey,
        toolId,
        target,
        targetLabel: approvalCopyTargetLabel[target],
        copiedSnapshot: runDiagnosticPacket
          ? buildAgentDiagnosticCopiedSnapshot(runDiagnosticPacket)
          : null,
        copiedAt: new Date().toISOString(),
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
        manualText: text,
      });
      console.warn('复制批准 key 失败:', error);
    }
  };

  const handleCopyApprovalKey = (toolId: string, approvalKey: string) =>
    handleCopyApprovalText(
      toolId,
      approvalKey,
      approvalKey,
      'key',
      '已复制批准 key：只复制同工具、同参数重跑所需的 key；工具动作还没有执行。',
    );

  const handleCopyApprovalReviewPayload = (
    toolId: string,
    approvalKey: string,
    reviewPayload: string,
  ) =>
    handleCopyApprovalText(
      toolId,
      approvalKey,
      reviewPayload,
      'payload',
      '已复制审核包：包含工具、参数、审批边界和重跑配置；不会执行通知、写入或外部动作。',
    );

  const handleCopyApprovalRetryConfig = (
    toolId: string,
    approvalKey: string,
    retryConfigPatch: string,
  ) =>
    handleCopyApprovalText(
      toolId,
      approvalKey,
      retryConfigPatch,
      'retry',
      '已复制重跑配置：只包含 approvedToolActionKeys；调用方仍需用同一工具和参数重新运行。',
    );

  const handleCopyRunDiagnosticPacket = async () => {
    if (!runDiagnosticPacket) return;

    const diagnosticPacketText = JSON.stringify(runDiagnosticPacket, null, 2);
    const copiedSnapshot = buildAgentDiagnosticCopiedSnapshot(runDiagnosticPacket);
    try {
      const copied = await copyTextToClipboard(diagnosticPacketText);
      if (!copied) {
        throw new Error('clipboard copy returned false');
      }
      setRunPacketCopyStatus({
        state: 'copied',
        message: buildAgentDiagnosticCopySuccessReceipt(runDiagnosticPacket),
        copiedSnapshot,
      });
    } catch (error) {
      setRunPacketCopyStatus({
        state: 'failed',
        message: '复制失败，请手动选择诊断包',
        copiedSnapshot,
        manualText: diagnosticPacketText,
      });
      console.warn('复制 Agent 运行诊断包失败:', error);
    }
  };
  
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
      <h3>
        智能Agent处理流程{' '}
        {processingIndicatorText && (
          <span
            className={`processing-indicator ${
              resultHandoffReceipt ? 'finalizing' : ''
            }`}
          >
            {processingIndicatorText}
          </span>
        )}
      </h3>
      
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
                <p>
                  先处理失败、阻断和预算耗尽，再阅读完整时间线。
                </p>
                {resultHandoffReceipt && (
                  <div
                    className="agent-result-handoff-receipt"
                    aria-label="结果整理回执"
                    role="status"
                  >
                    <span>{resultHandoffReceipt.title}</span>
                    <p>{resultHandoffReceipt.traceState}</p>
                    <p>{resultHandoffReceipt.resultState}</p>
                    <p>{resultHandoffReceipt.unresolvedIssueSummary}</p>
                    <p>{resultHandoffReceipt.inspectionRoute}</p>
                    {resultHandoffReceipt.terminalStepNumber && (
                      <div
                        className="agent-result-handoff-steps"
                        aria-label="结果整理终止步骤"
                      >
                        <button
                          type="button"
                          onClick={() =>
                            jumpToStep(
                              resultHandoffReceipt.terminalStepNumber! - 1,
                            )
                          }
                          title={buildAgentTraceStepButtonBoundary(
                            '结果整理回执',
                            resultHandoffReceipt.terminalStepNumber,
                            resultHandoffReceipt.inspectionRoute,
                          )}
                          aria-label={buildAgentTraceStepButtonBoundary(
                            '结果整理回执',
                            resultHandoffReceipt.terminalStepNumber,
                            resultHandoffReceipt.inspectionRoute,
                          )}
                        >
                          终止步骤 #{resultHandoffReceipt.terminalStepNumber}
                        </button>
                      </div>
                    )}
                    <small>{resultHandoffReceipt.boundary}</small>
                  </div>
                )}
                {traceReviewLane && (
                  <div
                    className="agent-trace-review-lane"
                    aria-label="Trace 复核路线"
                  >
                    <div className="agent-trace-review-lane-header">
                      <span>{traceReviewLane.title}</span>
                      <p>{traceReviewLane.detail}</p>
                    </div>
                    <div className="agent-trace-review-lane-items">
                      {traceReviewLane.items.map((item) => (
                        <article
                          key={item.key}
                          className={`agent-trace-review-lane-item ${item.tone}`}
                        >
                          <span>{item.label}</span>
                          <strong>{item.value}</strong>
                          <p>{item.detail}</p>
                          {Boolean(
                            item.stepRoutes?.length ||
                              item.stepIndexes?.length,
                          ) && (
                            <div
                              className="agent-trace-review-lane-steps"
                              aria-label={`${item.label}相关步骤`}
                            >
                              {(
                                item.stepRoutes?.length
                                  ? item.stepRoutes
                                  : item.stepIndexes!.map((stepIndex) => ({
                                      stepNumber: stepIndex + 1,
                                      reason: '',
                                    }))
                              ).map((route) => (
                                <div
                                  key={route.stepNumber}
                                  className="agent-trace-review-lane-step-route"
                                >
                                  <button
                                    type="button"
                                    onClick={() =>
                                      jumpToStep(route.stepNumber - 1)
                                    }
                                    title={buildAgentTraceStepButtonBoundary(
                                      item.label,
                                      route.stepNumber,
                                      route.reason,
                                    )}
                                    aria-label={buildAgentTraceStepButtonBoundary(
                                      item.label,
                                      route.stepNumber,
                                      route.reason,
                                    )}
                                  >
                                    步骤 #{route.stepNumber}
                                  </button>
                                  {route.reason && <span>{route.reason}</span>}
                                </div>
                              ))}
                            </div>
                          )}
                        </article>
                      ))}
                    </div>
                  </div>
                )}
                {traceNavigationReceipt && (
                  <div
                    className="agent-trace-navigation-receipt"
                    aria-label="当前 trace 导航"
                  >
                    <span>{traceNavigationReceipt.title}</span>
                    <p>{traceNavigationReceipt.currentTrace}</p>
                    <p>{traceNavigationReceipt.primaryRoute}</p>
                    <p>{traceNavigationReceipt.stepScope}</p>
                    {traceNavigationReceipt.stepRoutes.length > 0 && (
                      <div
                        className="agent-trace-navigation-steps"
                        aria-label="当前 trace 优先步骤"
                      >
                        {traceNavigationReceipt.stepRoutes.map((route) => (
                          <div
                            key={route.stepNumber}
                            className="agent-trace-navigation-route"
                          >
                            <button
                              type="button"
                              onClick={() => jumpToStep(route.stepNumber - 1)}
                              title={buildAgentTraceStepButtonBoundary(
                                '当前 trace 导航',
                                route.stepNumber,
                                route.reason,
                                traceNavigationReceipt.noEffectBoundary,
                              )}
                              aria-label={buildAgentTraceStepButtonBoundary(
                                '当前 trace 导航',
                                route.stepNumber,
                                route.reason,
                                traceNavigationReceipt.noEffectBoundary,
                              )}
                            >
                              步骤 #{route.stepNumber}
                            </button>
                            <span>{route.reason}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <small>{traceNavigationReceipt.noEffectBoundary}</small>
                  </div>
                )}
                {runSnapshot && (
                  <div
                    className="agent-run-summary"
                    aria-label="Agent 运行摘要"
                  >
                    <span className="agent-run-summary-detail">
                      {runSnapshot.detail}
                    </span>
                    <span className="agent-run-summary-action">
                      优先处理：{runSnapshot.primaryAction}
                    </span>
                    <div className="agent-run-summary-chips">
                      {runSnapshot.chips.map((chip) => (
                        <span
                          key={`${chip.label}-${chip.value}`}
                          className={`agent-run-summary-chip ${chip.tone}`}
                        >
                          <span>{chip.label}</span>
                          <strong>{chip.value}</strong>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {traceSpanComposition && (
                  <div
                    className="agent-trace-span-composition"
                    aria-label="Trace span 构成"
                  >
                    <div className="agent-trace-span-composition-header">
                      <span>{traceSpanComposition.title}</span>
                      <p>{traceSpanComposition.detail}</p>
                    </div>
                    <div className="agent-trace-span-composition-items">
                      {traceSpanComposition.items.map((item) => (
                        <article
                          key={item.key}
                          className={`agent-trace-span-composition-item ${item.tone}`}
                        >
                          <span>{item.label}</span>
                          <strong>{item.value}</strong>
                          <p>{item.detail}</p>
                          {item.stepNumbers && item.stepNumbers.length > 0 && (
                            <div
                              className="agent-trace-span-composition-steps"
                              aria-label={`${item.label}对应步骤`}
                            >
                              {item.stepNumbers.map((stepNumber) => (
                                <button
                                  key={stepNumber}
                                  type="button"
                                  onClick={() => jumpToStep(stepNumber - 1)}
                                  title={buildAgentTraceStepButtonBoundary(
                                    item.label,
                                    stepNumber,
                                    item.detail,
                                  )}
                                  aria-label={buildAgentTraceStepButtonBoundary(
                                    item.label,
                                    stepNumber,
                                    item.detail,
                                  )}
                                >
                                  步骤 #{stepNumber}
                                </button>
                              ))}
                            </div>
                          )}
                        </article>
                      ))}
                    </div>
                    <small>{traceSpanComposition.boundary}</small>
                  </div>
                )}
              </div>
              <div className="agent-run-review-actions">
                {diagnosticCopyPreflight && (
                  <div
                    className="agent-run-diagnostic-preflight"
                    aria-label="诊断包复制预检"
                  >
                    <span>{diagnosticCopyPreflight.title}</span>
                    <p>{diagnosticCopyPreflight.detail}</p>
                    <ul>
                      {diagnosticCopyPreflight.items.map((item) => (
                        <li
                          key={item.label}
                          className={`agent-run-diagnostic-preflight-item ${item.tone}`}
                        >
                          <strong>{item.label}</strong>
                          <span>{item.value}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <button
                  type="button"
                  className="agent-run-diagnostic-copy"
                  onClick={handleCopyRunDiagnosticPacket}
                  disabled={thoughtProcess.length === 0}
                >
                  {runPacketCopyStatus?.state === 'copied'
                    ? runPacketCopyIsStale
                      ? '重新复制'
                      : '已复制'
                    : '复制诊断包'}
                </button>
                <span className={`agent-run-review-status ${runReviewSeverity}`}>
                  {runReviewLabel[runReviewSeverity]}
                </span>
              </div>
            </div>
            {runPacketCopyStatus && (
              <>
                <div
                  className={`agent-run-diagnostic-copy-status ${
                    runPacketCopyStatus.state
                  } ${runPacketCopyIsStale ? 'stale' : 'current'}`}
                  role="status"
                >
                  {runPacketCopyStatus.message}
                </div>
                {runPacketCopyFreshnessReceipt && (
                  <div
                    className={`agent-run-diagnostic-copy-freshness ${
                      runPacketCopyIsStale ? 'stale' : 'current'
                    }`}
                    role="note"
                  >
                    {runPacketCopyFreshnessReceipt}
                  </div>
                )}
                {runPacketCopyStatus.state === 'failed' &&
                  runPacketCopyStatus.manualText && (
                    <textarea
                      className="agent-run-diagnostic-manual-copy"
                      aria-label="手动复制诊断包"
                      readOnly
                      value={runPacketCopyStatus.manualText}
                      onFocus={(event) => event.currentTarget.select()}
                    />
                  )}
              </>
            )}
            {diagnosticCopyScope && (
              <div
                className="agent-run-diagnostic-scope"
                aria-label="诊断包范围"
              >
                <span>{diagnosticCopyScope.title}</span>
                <p>{diagnosticCopyScope.detail}</p>
                <ul>
                  <li>{diagnosticCopyScope.identityBoundary}</li>
                  <li>{diagnosticCopyScope.freshnessBoundary}</li>
                  <li>{diagnosticCopyScope.privacyBoundary}</li>
                  <li>{diagnosticCopyScope.exportBoundary}</li>
                  <li>{diagnosticCopyScope.schemaBoundary}</li>
                  <li>{diagnosticCopyScope.approvalBoundary}</li>
                </ul>
              </div>
            )}
            <div className="agent-run-review-list">
              {runReviewItems.map((item, index) => (
                <div
                  key={`${item.title}-${index}`}
                  className={`agent-run-review-item ${item.severity}`}
                >
                  <div className="agent-run-review-title">{item.title}</div>
                  <div className="agent-run-review-detail">{item.detail}</div>
                  <div className="agent-run-review-action">{item.action}</div>
                  {item.stepIndexes && item.stepIndexes.length > 0 && (
                    <div
                      className="agent-run-review-step-links"
                      aria-label={`${item.title}涉及的步骤`}
                    >
                      <span>涉及步骤</span>
                      {item.stepIndexes.map((stepIndex) => (
                        <button
                          key={stepIndex}
                          type="button"
                          onClick={() => jumpToStep(stepIndex)}
                          title={buildAgentTraceStepButtonBoundary(
                            item.title,
                            stepIndex + 1,
                            item.action,
                          )}
                          aria-label={buildAgentTraceStepButtonBoundary(
                            item.title,
                            stepIndex + 1,
                            item.action,
                          )}
                        >
                          #{stepIndex + 1}
                        </button>
                      ))}
                    </div>
                  )}
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
              {approvalQueueReceipt && (
                <div
                  className="agent-approval-queue-receipt"
                  aria-label="待确认队列口径"
                  role="note"
                >
                  <span>{approvalQueueReceipt.title}</span>
                  <p>{approvalQueueReceipt.traceScope}</p>
                  <p>{approvalQueueReceipt.pendingScope}</p>
                  <p>{approvalQueueReceipt.persistenceBoundary}</p>
                  <p>{approvalQueueReceipt.copyBoundary}</p>
                  <p>{approvalQueueReceipt.nextStep}</p>
                  {approvalQueueReceipt.stepNumbers.length > 0 && (
                    <div
                      className="agent-approval-queue-steps"
                      aria-label="待确认队列对应步骤"
                    >
                      {approvalQueueReceipt.stepNumbers.map((stepNumber) => (
                        <button
                          key={stepNumber}
                          type="button"
                          onClick={() => jumpToStep(stepNumber - 1)}
                          title={buildAgentTraceStepButtonBoundary(
                            '待确认队列',
                            stepNumber,
                            approvalQueueReceipt.nextStep,
                          )}
                          aria-label={buildAgentTraceStepButtonBoundary(
                            '待确认队列',
                            stepNumber,
                            approvalQueueReceipt.nextStep,
                          )}
                        >
                          步骤 #{stepNumber}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div className="agent-approval-list">
                {pendingApprovalActions.map((approval, index) => {
                  const keyCopyBoundary = buildAgentApprovalCopyButtonBoundary({
                    toolId: approval.toolId,
                    target: 'key',
                    available: Boolean(approval.approvalKey),
                  });
                  const reviewCopyBoundary = buildAgentApprovalCopyButtonBoundary({
                    toolId: approval.toolId,
                    target: 'payload',
                    available: Boolean(
                      approval.approvalKey && approval.reviewPayload,
                    ),
                  });
                  const retryCopyBoundary = buildAgentApprovalCopyButtonBoundary({
                    toolId: approval.toolId,
                    target: 'retry',
                    available: Boolean(
                      approval.approvalKey && approval.retryConfigPatch,
                    ),
                  });

                  return (
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
                    <div
                      className="agent-approval-preflight"
                      role="note"
                      aria-label="审批前确认"
                    >
                      <span>{approval.preflightReceipt.title}</span>
                      <ul>
                        <li>
                          <strong>待处理</strong>
                          <p>{approval.preflightReceipt.pendingAction}</p>
                        </li>
                        <li>
                          <strong>未执行</strong>
                          <p>{approval.preflightReceipt.noEffectBoundary}</p>
                        </li>
                        <li>
                          <strong>复制边界</strong>
                          <p>{approval.preflightReceipt.copyBoundary}</p>
                        </li>
                        <li>
                          <strong>下一步</strong>
                          <p>{approval.preflightReceipt.nextStep}</p>
                        </li>
                      </ul>
                    </div>
                    <div className="agent-approval-review-hint">
                      <span>复核重点</span>
                      <p>{approval.reviewHint}</p>
                    </div>
                    {approval.safetyNote && (
                      <div className="agent-approval-policy-note">
                        <span>工具安全说明</span>
                        <p>{approval.safetyNote}</p>
                      </div>
                    )}
                    <div
                      className="agent-approval-decision-guide"
                      aria-label="审批决策导览"
                    >
                      <span>审批决策导览</span>
                      <div className="agent-approval-decision-guide-list">
                        {approval.decisionGuide.map((item) => (
                          <article
                            key={item.type}
                            className={`agent-approval-decision-guide-item ${item.type}`}
                          >
                            <strong>{item.label}</strong>
                            <p>{item.currentState}</p>
                            <p>{item.nextStep}</p>
                            <small>{item.boundary}</small>
                          </article>
                        ))}
                      </div>
                    </div>
                    <div className="agent-approval-decision-options">
                      <span>处理方式</span>
                      <ul>
                        {approval.decisionOptions.map((option) => (
                          <li key={option.type}>
                            <strong>{option.label}</strong>
                            <p>{option.description}</p>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="agent-approval-resume-note" role="note">
                      {approval.resumeInstruction}
                    </div>
                    <div className="agent-approval-boundary" role="note">
                      <span>恢复边界</span>
                      <ul>
                        <li>
                          <strong>{approval.reviewBoundary.label}</strong>
                          <p>{approval.reviewBoundary.description}</p>
                        </li>
                        <li>
                          <strong>生成时间</strong>
                          <p>{approval.reviewBoundary.generatedAt}</p>
                        </li>
                        <li>
                          <strong>适用范围</strong>
                          <p>{approval.reviewBoundary.scope}</p>
                        </li>
                        <li>
                          <strong>失效条件</strong>
                          <p>{approval.reviewBoundary.expiresWhen}</p>
                        </li>
                        <li>
                          <strong>Key 绑定</strong>
                          <p>{approval.reviewBoundary.approvalKeyBinding}</p>
                        </li>
                      </ul>
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
                          onClick={() =>
                            handleCopyApprovalKey(
                              approval.toolId,
                              approval.approvalKey,
                            )
                          }
                          title={keyCopyBoundary.title}
                          aria-label={keyCopyBoundary.ariaLabel}
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
                              approval.toolId,
                              approval.approvalKey,
                              approval.reviewPayload,
                            )
                          }
                          title={reviewCopyBoundary.title}
                          aria-label={reviewCopyBoundary.ariaLabel}
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
                              approval.toolId,
                              approval.approvalKey,
                              approval.retryConfigPatch,
                            )
                          }
                          title={retryCopyBoundary.title}
                          aria-label={retryCopyBoundary.ariaLabel}
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
                    <div
                      className="agent-approval-retry-receipt"
                      aria-label="重跑配置回执"
                    >
                      <span>{approval.retryReceipt.title}</span>
                      <ul>
                        <li>
                          <strong>审批对象</strong>
                          <p>{approval.retryReceipt.configScope}</p>
                        </li>
                        <li>
                          <strong>复制内容</strong>
                          <p>{approval.retryReceipt.copiedFields}</p>
                        </li>
                        <li>
                          <strong>未复制</strong>
                          <p>{approval.retryReceipt.notCopied}</p>
                        </li>
                        <li>
                          <strong>恢复边界</strong>
                          <p>{approval.retryReceipt.recoveryBoundary}</p>
                        </li>
                      </ul>
                    </div>
                    {approvalCopyStatus?.key === approval.approvalKey && (
                      <>
                        <div
                          className={`agent-approval-copy-status ${approvalCopyStatus.state}`}
                          role="status"
                        >
                          {approvalCopyStatus.message}
                        </div>
                        {approvalCopyStatus.state === 'failed' &&
                          approvalCopyStatus.manualText && (
                            <textarea
                              className="agent-approval-manual-copy"
                              aria-label={`手动复制 ${approval.toolId} 的${
                                approvalCopyStatus.target === 'key'
                                  ? '批准 key'
                                  : approvalCopyStatus.target === 'payload'
                                    ? '审核包'
                                    : '重跑配置'
                              }`}
                              readOnly
                              value={approvalCopyStatus.manualText}
                              onFocus={(event) => event.currentTarget.select()}
                            />
                        )}
                      </>
                    )}
                    {approvalCopyReceipt?.key === approval.approvalKey && (
                      <div
                        className={`agent-approval-copy-receipt ${
                          runDiagnosticPacket &&
                          approvalCopyReceipt.copiedSnapshot &&
                          approvalCopyReceipt.copiedSnapshot.traceId !==
                            runDiagnosticPacket.traceIdentity.traceId
                            ? 'stale'
                            : 'current'
                        }`}
                        role="note"
                      >
                        <span>
                          {runDiagnosticPacket &&
                          approvalCopyReceipt.copiedSnapshot &&
                          approvalCopyReceipt.copiedSnapshot.traceId !==
                            runDiagnosticPacket.traceIdentity.traceId
                            ? '旧审批复制回执'
                            : '当前审批复制回执'}
                        </span>
                        <p>
                          剪贴板里是 {approvalCopyReceipt.toolId} 的
                          {approvalCopyReceipt.targetLabel}，复制于{' '}
                          {approvalCopyReceipt.copiedAt}
                          {approvalCopyReceipt.copiedSnapshot
                            ? `，来自本地 trace ${approvalCopyReceipt.copiedSnapshot.traceId}`
                            : '。'}
                        </p>
                        {runDiagnosticPacket &&
                          approvalCopyReceipt.copiedSnapshot &&
                          approvalCopyReceipt.copiedSnapshot.traceId !==
                            runDiagnosticPacket.traceIdentity.traceId && (
                            <p>
                              当前页面已经变为{' '}
                              {runDiagnosticPacket.traceIdentity.traceId}；请重新复制后再用于审批。
                            </p>
                          )}
                        <p>
                          复制只产生本地文本，不会批准、恢复 run、重跑、发送通知、写入、删除或执行外部动作；参数、上下文、工具策略或 trace 变化后要重新生成并复制。
                        </p>
                      </div>
                    )}
                  </div>
                  );
                })}
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
                  id={`agent-step-${index}`}
                  className={`thought-step ${isExpanded ? 'expanded' : ''}`}
                  style={{ borderLeftColor: color }}
                >
                  <div
                    id={`agent-step-header-${index}`}
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
  const jumpToTimelineStep = (stepIndex?: number) => {
    if (!Number.isInteger(stepIndex) || stepIndex < 0) return;
    window.dispatchEvent(
      new CustomEvent(AGENT_TRACE_JUMP_EVENT, {
        detail: { stepIndex },
      }),
    );
  };
  const handleFlowNodeKeyDown = (
    event: React.KeyboardEvent<HTMLDivElement>,
    stepIndex?: number,
  ) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    jumpToTimelineStep(stepIndex);
  };
  
  return (
    <div className="agent-flow-visualizer">
      <h3>处理流程图</h3>
      
      <div className="flow-diagram">
        {flowSteps.map((step, index) => {
          let iconClass = '';
          const canJumpToTimeline = Number.isInteger(step.stepIndex);
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
                className={`flow-node ${step.type} ${step.resultClass || ''} ${
                  canJumpToTimeline ? 'jumpable' : ''
                }`}
                title={
                  canJumpToTimeline
                    ? buildAgentTraceStepButtonBoundary(
                        '处理流程图',
                        (step.stepIndex ?? 0) + 1,
                        step.detail || step.result || step.name,
                      )
                    : undefined
                }
                aria-label={
                  canJumpToTimeline
                    ? buildAgentTraceStepButtonBoundary(
                        '处理流程图',
                        (step.stepIndex ?? 0) + 1,
                        step.detail || step.result || step.name,
                      )
                    : `${step.name}${step.result ? `: ${step.result}` : ''}`
                }
                role={canJumpToTimeline ? 'button' : undefined}
                tabIndex={canJumpToTimeline ? 0 : undefined}
                onClick={() => jumpToTimelineStep(step.stepIndex)}
                onKeyDown={(event) =>
                  handleFlowNodeKeyDown(event, step.stepIndex)
                }
              >
                <div className={`node-icon ${iconClass}`}></div>
                <div className="node-content">
                  <div className="node-main">
                    <div className="node-title">{step.name}</div>
                    {canJumpToTimeline && (
                      <span className="node-step-index">
                        #{(step.stepIndex ?? 0) + 1}
                      </span>
                    )}
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
  const jumpToPendingApprovalStep = (stepIndex: number) => {
    window.dispatchEvent(
      new CustomEvent(AGENT_TRACE_JUMP_EVENT, {
        detail: { stepIndex },
      }),
    );
  };
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
            <div
              className="result-pending-approval"
              role="region"
              aria-label="待确认动作摘要"
            >
              <h4>待确认动作未执行</h4>
              <p>
                还有 {pendingApprovalActions.length} 个工具动作等待人工确认；最终结果没有把这些动作当作已完成。
              </p>
              <div
                className="result-pending-approval-handoff"
                role="note"
                aria-label="结果区审批定位边界"
              >
                <strong>审批定位</strong>
                <p>
                  点击定位只展开本轮 trace 的对应步骤，不会批准、复制、重跑、发送通知、写入、删除或执行外部动作；实际审批仍在待确认动作队列中复制审核包或重跑配置后重新运行。
                </p>
              </div>
              <ul>
                {pendingApprovalActions.map((approval, index) => (
                  <li key={`${approval.toolId}-${approval.approvalKey || index}`}>
                    <div className="result-pending-approval-main">
                      <strong>{approval.toolId}</strong>
                      <span>
                        {formatApprovalEffect(approval.effect)} /{' '}
                        {formatApprovalRisk(approval.riskLevel)}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="result-pending-approval-step"
                      onClick={() => jumpToPendingApprovalStep(approval.stepIndex)}
                      title={buildAgentTraceStepButtonBoundary(
                        '结果区审批定位',
                        approval.stepIndex + 1,
                        `${approval.toolId} 尚未执行，实际审批仍在待确认动作队列中复制审核包或重跑配置后重新运行。`,
                        '只展开并聚焦当前页面时间线；不会批准、复制、重跑、发送通知、写入、删除或执行外部动作。',
                      )}
                      aria-label={buildAgentTraceStepButtonBoundary(
                        '结果区审批定位',
                        approval.stepIndex + 1,
                        `${approval.toolId} 尚未执行，实际审批仍在待确认动作队列中复制审核包或重跑配置后重新运行。`,
                        '只展开并聚焦当前页面时间线；不会批准、复制、重跑、发送通知、写入、删除或执行外部动作。',
                      )}
                    >
                      定位步骤 #{approval.stepIndex + 1}
                    </button>
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
