import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { useState, useEffect, useRef } from 'react';
import {
  BotPushTargetMode,
  defaultEnvConfig,
  EnvConfigType,
  getDefaultEnvConfig,
  normalizeEnvConfigShape,
  normalizeConcernedItemsDigestHour,
  normalizeBotPushTarget,
} from './utils';
import {
  MemoryServiceClient,
  getMemoryServiceClient,
  type OutreachDirectoryStatus,
  type RuntimeConfigResponse,
  type UpdateRuntimeConfigPayload,
  type CalendarEventsSyncResponse,
} from './services/MemoryServiceClient';
import { AgentExecutorsSettings } from './components/AgentExecutorsSettings';
import { ToggleField } from './components/ToggleField';
import { syncUserLanguagePreferenceProfileItem } from './services/UserLanguagePreferenceSync';
import { DEVICE_KEY_STORAGE } from './deviceApiKey';
import { agentCoordinator } from './agentWorkflow';
import {
  AGENT_WORKFLOW_SAVED_SCENARIO_LIMIT,
  AGENT_WORKFLOW_TEST_SCENARIOS,
  buildAgentWorkflowScenarioSourceReceipt,
  buildAgentWorkflowDiagnosticSnapshot,
  buildAgentWorkflowReplaySourceReceipt,
  buildAgentWorkflowRunScopeReceipt,
  buildAgentWorkflowSavedScenarioDeleteReceipt,
  buildAgentWorkflowSavedScenarioCapacityReceipt,
  buildAgentWorkflowSavedRegressionCoverageReceipt,
  buildAgentWorkflowSavedRegressionScopeReceipt,
  buildAgentWorkflowResultExpectation,
  buildAgentWorkflowSavedScenarioSourceReceipt,
  buildAgentWorkflowSavedScenario,
  buildAgentWorkflowScenarioInput,
  buildAgentWorkflowAgentConfigSnapshot,
  buildAgentWorkflowReplayMessages,
  formatAgentWorkflowAgentConfigSnapshot,
  formatAgentWorkflowSavedScenarioLabel,
  formatAgentWorkflowReplayLabel,
  formatAgentWorkflowDatetimeInputValue,
  formatAgentWorkflowRegressionFailureDetail,
  getAgentWorkflowTraceStatus,
  normalizeAgentWorkflowSavedScenarios,
  normalizeAgentWorkflowInputDatetime,
  type AgentWorkflowSavedExpectation,
  type AgentWorkflowSavedDiagnosticSnapshot,
  type AgentWorkflowAgentConfigSnapshot,
  type AgentWorkflowSavedScenario,
  type AgentWorkflowTestSourceReceipt,
  type AgentWorkflowTestInput,
  type AgentWorkflowReplayMessage,
} from './agentWorkflowReplay';
import {
  buildAgentWorkflowDecisionPath,
  buildAgentWorkflowConfigDiagnostics,
  buildAgentWorkflowResultDiagnostics,
  buildAgentWorkflowRecommendedActions,
  buildAgentWorkflowReadinessChecks,
  buildAgentWorkflowRunVerdict,
  buildAgentWorkflowStructuralCoverage,
  buildAgentWorkflowOrchestrationReceipt,
  buildAgentWorkflowNotificationReviewReceipt,
  buildAgentWorkflowRunEvidencePacket,
  normalizeAgentWorkflowConfidence,
  type AgentWorkflowDiagnostic,
} from './agentWorkflowDiagnostics';
import { IntelligentAgent, type AgentToolDescription } from './agentThinking';
import {
  AgentVisualizer,
  AgentFlowVisualizer,
  AgentResultSummary,
} from './agent-visualizer';
import {
  CONTEXT_SITE_ALLOW_STORAGE_KEY,
  CONTEXT_SITE_ALLOWLIST_MODE_STORAGE_KEY,
  CONTEXT_PAGE_BLOCK_STORAGE_KEY,
  CONTEXT_SITE_BLOCK_STORAGE_KEY,
  CONTEXT_SITE_MUTE_STORAGE_KEY,
  formatContextSiteMuteRemaining,
  getContextSiteMuteExpiresAt,
  normalizeContextPageBlockPrefix,
  normalizeContextSiteMuteHost,
  isContextHostCoveredBySiteRecord,
  pruneContextPageBlockRecord,
  pruneContextSiteAllowRecord,
  pruneContextSiteBlockRecord,
  pruneContextSiteMuteRecord,
  removeContextSiteRecordConflicts,
} from './web-intelligence/contextRecallGuards';
import { useExtensionUiLanguage, useStaticDomI18n } from './i18n/react';
import type { UiLanguage } from './i18n';

type PushTargetField =
  | 'MESSAGE_ANALYSIS_PUSH_TARGET'
  | 'FOLLOW_UP_PUSH_TARGET'
  | 'DREAM_INSIGHT_PUSH_TARGET'
  | 'WEEKLY_REPORT_PUSH_TARGET'
  | 'DECISION_CENTER_PUSH_TARGET'
  | 'OUTREACH_RESULT_PUSH_TARGET';

type PushGroupField =
  | 'MESSAGE_ANALYSIS_PUSH_GROUP_ID'
  | 'FOLLOW_UP_PUSH_GROUP_ID'
  | 'DREAM_INSIGHT_PUSH_GROUP_ID'
  | 'WEEKLY_REPORT_PUSH_GROUP_ID'
  | 'DECISION_CENTER_PUSH_GROUP_ID'
  | 'OUTREACH_RESULT_PUSH_GROUP_ID';

interface OutlookCalendarStatusView {
  connected: boolean;
  account?: {
    displayName?: string;
    userPrincipalName?: string;
  };
  expiresAt?: number;
  lastSyncAt?: number;
  lastSyncResult?: CalendarEventsSyncResponse;
  lastError?: string;
}

const PUSH_TARGET_RULES: Array<{
  targetKey: PushTargetField;
  groupKey: PushGroupField;
  label: string;
  allowNone?: boolean;
}> = [
  {
    targetKey: 'MESSAGE_ANALYSIS_PUSH_TARGET',
    groupKey: 'MESSAGE_ANALYSIS_PUSH_GROUP_ID',
    label: '消息分析推送',
  },
  {
    targetKey: 'FOLLOW_UP_PUSH_TARGET',
    groupKey: 'FOLLOW_UP_PUSH_GROUP_ID',
    label: '关注后续推送',
  },
  {
    targetKey: 'DREAM_INSIGHT_PUSH_TARGET',
    groupKey: 'DREAM_INSIGHT_PUSH_GROUP_ID',
    label: '梦境重放报表推送',
    allowNone: true,
  },
  {
    targetKey: 'WEEKLY_REPORT_PUSH_TARGET',
    groupKey: 'WEEKLY_REPORT_PUSH_GROUP_ID',
    label: '周报推送',
    allowNone: true,
  },
  {
    targetKey: 'DECISION_CENTER_PUSH_TARGET',
    groupKey: 'DECISION_CENTER_PUSH_GROUP_ID',
    label: '决策中心推送',
  },
  {
    targetKey: 'OUTREACH_RESULT_PUSH_TARGET',
    groupKey: 'OUTREACH_RESULT_PUSH_GROUP_ID',
    label: '主动询问结果推送',
  },
];

const MIN_OPENCLAW_TIMEOUT_SECONDS = 5 * 60;

type DigestManualPushKind = 'dream' | 'weekly';
type DigestManualPushPhase = 'blocked' | 'pending' | 'result';

interface DigestManualPushReceipt {
  kind: DigestManualPushKind;
  phase?: DigestManualPushPhase;
  generated: boolean;
  target: BotPushTargetMode;
  groupId?: string;
  targetLabel: string;
  notificationCreated?: boolean;
  botSent?: boolean;
  botError?: string;
  reportPath?: string;
  messageCount?: number;
  reflectionCount?: number;
  dreamCount?: number;
  latestDreamPath?: string;
  reason?: string;
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}

function formatDigestPushTargetLabel(
  target: BotPushTargetMode,
  groupId?: string,
): string {
  if (target === 'none') return '不推送';
  if (target === 'group') {
    return groupId ? `自定义群组 ${groupId}` : '自定义群组（未填写 ID）';
  }
  return 'Me';
}

function normalizeDigestPushGroupId(groupId?: string): string {
  return String(groupId || '').trim();
}

function buildPendingDigestPushReceipt(
  kind: DigestManualPushKind,
  target: BotPushTargetMode,
  groupId?: string,
): DigestManualPushReceipt {
  const normalizedGroupId = normalizeDigestPushGroupId(groupId);
  return {
    kind,
    phase: 'pending',
    generated: false,
    target,
    groupId: normalizedGroupId,
    targetLabel: formatDigestPushTargetLabel(target, normalizedGroupId),
  };
}

function buildBlockedDigestPushReceipt(
  kind: DigestManualPushKind,
  target: BotPushTargetMode,
  groupId: string | undefined,
  reason: string,
): DigestManualPushReceipt {
  const normalizedGroupId = normalizeDigestPushGroupId(groupId);
  return {
    kind,
    phase: 'blocked',
    generated: false,
    target,
    groupId: normalizedGroupId,
    targetLabel: formatDigestPushTargetLabel(target, normalizedGroupId),
    notificationCreated: false,
    botSent: false,
    reason,
  };
}

const sanitizeLocalEnvConfig = (
  targetConfig: EnvConfigType,
): EnvConfigType => ({
  ...normalizeEnvConfigShape(targetConfig),
  MEMORY_SERVICE_BOOTSTRAP_KEY:
    String(targetConfig.MEMORY_SERVICE_BOOTSTRAP_KEY || '').trim() ||
    defaultEnvConfig.MEMORY_SERVICE_BOOTSTRAP_KEY ||
    '',
  CONCERNED_ITEMS_DIGEST_HOUR: normalizeConcernedItemsDigestHour(
    targetConfig.CONCERNED_ITEMS_DIGEST_HOUR,
    8,
  ),
  OPENCLAW_API_KEY: '',
  OPENCLAW_CLEAR_API_KEY: false,
  RINGCENTRAL_CLIENT_SECRET: '',
  RINGCENTRAL_JWT: '',
  RINGCENTRAL_CLEAR_CLIENT_SECRET: false,
  RINGCENTRAL_CLEAR_JWT: false,
});

const CHROME_ON_DEVICE_ASR_LANG = 'zh-CN';
const DESKTOP_APP_RELEASE_URL =
  'https://github.com/ee01/personal-ai/releases/latest';

function ChromeOnDeviceASRPanel({ enabled }: { enabled: boolean }) {
  const [status, setStatus] = React.useState<{
    supported: boolean;
    availability?: string;
    message: string;
  }>({
    supported: false,
    message: 'Not checked',
  });
  const [busyAction, setBusyAction] = React.useState<
    'check' | 'install' | null
  >(null);

  const getSpeechRecognitionCtor = () => {
    const speechWindow = window as typeof window & {
      SpeechRecognition?: {
        available?: (args: {
          langs: string[];
          processLocally: boolean;
        }) => Promise<unknown>;
        install?: (args: {
          langs: string[];
          processLocally: boolean;
        }) => Promise<unknown>;
      };
      webkitSpeechRecognition?: {
        available?: (args: {
          langs: string[];
          processLocally: boolean;
        }) => Promise<unknown>;
        install?: (args: {
          langs: string[];
          processLocally: boolean;
        }) => Promise<unknown>;
      };
    };
    return speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
  };

  const checkAvailability = async (silent = false) => {
    if (!enabled) return;
    if (!silent) setBusyAction((current) => current || 'check');
    const SpeechRecognitionCtor = getSpeechRecognitionCtor();
    if (!SpeechRecognitionCtor?.available) {
      setStatus({
        supported: false,
        message: 'This Chrome build does not expose on-device SpeechRecognition checks.',
      });
      if (!silent) setBusyAction(null);
      return;
    }
    try {
      const result = await SpeechRecognitionCtor.available({
        langs: [CHROME_ON_DEVICE_ASR_LANG],
        processLocally: true,
      });
      const availability = String(result || 'unknown');
      setStatus({
        supported: availability === 'available',
        availability,
        message:
          availability === 'available'
            ? `${CHROME_ON_DEVICE_ASR_LANG} language pack is installed.`
            : `${CHROME_ON_DEVICE_ASR_LANG} language pack is ${availability}.`,
      });
    } catch (error) {
      setStatus({
        supported: false,
        message: String((error as Error)?.message || error),
      });
    } finally {
      if (!silent) setBusyAction(null);
    }
  };

  const installLanguagePack = async () => {
    if (!enabled) return;
    setBusyAction('install');
    const SpeechRecognitionCtor = getSpeechRecognitionCtor();
    if (!SpeechRecognitionCtor?.install) {
      setStatus({
        supported: false,
        message: 'This Chrome build does not expose SpeechRecognition.install().',
      });
      setBusyAction(null);
      return;
    }
    try {
      const result = await SpeechRecognitionCtor.install({
        langs: [CHROME_ON_DEVICE_ASR_LANG],
        processLocally: true,
      });
      await checkAvailability(true);
      if (!result) {
        setStatus((prev) => ({
          ...prev,
          message:
            'Chrome did not install the language pack. It may be unsupported on this version or blocked by browser policy.',
        }));
      }
    } catch (error) {
      setStatus({
        supported: false,
        message: String((error as Error)?.message || error),
      });
    } finally {
      setBusyAction(null);
    }
  };

  React.useEffect(() => {
    if (enabled) void checkAvailability();
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div
      className="form-group"
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        padding: '12px 16px',
        marginBottom: 16,
        backgroundColor: '#f9fafb',
      }}
    >
      <strong style={{ display: 'block', marginBottom: 8 }}>
        Chrome On-Device ASR
      </strong>
      <small style={{ color: '#4b5563', display: 'block', marginBottom: 8 }}>
        这是 Chrome Web Speech 的实验性本地识别能力。语言包不会可靠地静默完成；
        Chrome 文档建议先检查 `available()`，如果是 `downloadable` 或
        `downloading`，由用户触发 `install()` 安装。
      </small>
      <small style={{ color: '#6b7280', display: 'block', marginBottom: 8 }}>
        由于 Chrome 对 extension offscreen 中的自定义 audio track 支持不稳定，
        会议弹幕仅在 Local only 模式下尝试使用它；Auto 模式会优先
        Local ASR，然后回退 Cloud。
      </small>
      <small
        style={{
          color: status.supported ? '#16a34a' : '#b45309',
          display: 'block',
          marginBottom: 8,
        }}
      >
        {status.availability
          ? `Language pack ${CHROME_ON_DEVICE_ASR_LANG}: ${status.availability}`
          : status.message}
      </small>
      {status.availability && status.message !== status.availability ? (
        <small style={{ color: '#6b7280', display: 'block', marginBottom: 8 }}>
          {status.message}
        </small>
      ) : null}
      <button
        type="button"
        onClick={checkAvailability}
        disabled={Boolean(busyAction)}
        style={{ marginRight: 8, fontSize: 11, padding: '2px 8px' }}
      >
        {busyAction === 'check' ? 'Checking...' : 'Check'}
      </button>
      <button
        type="button"
        onClick={installLanguagePack}
        disabled={Boolean(busyAction)}
        style={{ fontSize: 11, padding: '2px 8px' }}
      >
        {busyAction === 'install' ? 'Installing...' : 'Install zh-CN Pack'}
      </button>
    </div>
  );
}

interface DesktopASREngineStatus {
  ready?: boolean;
  modelReady?: boolean;
  reason?: string;
  name?: string;
  whisperBinaryAvailable?: boolean;
  whisperBinaryInstallInProgress?: boolean;
}

interface DesktopASRStatus {
  ok: boolean;
  ready?: boolean;
  liveReady?: boolean;
  finalReady?: boolean;
  modelRoot?: string;
  engines?: {
    appleSpeech?: DesktopASREngineStatus;
    sherpaStreaming?: DesktopASREngineStatus;
    funasrFinal?: DesktopASREngineStatus;
    whisperFallback?: DesktopASREngineStatus;
  };
  activeSessionId?: string | null;
  activeSessions?: unknown[];
  downloadInProgress?: boolean;
  downloadProgress?: number;
  downloadTarget?: string;
  lastDownloadError?: string;
  error?: string;
}

function isDesktopASRLiveReady(status: DesktopASRStatus): boolean {
  return (
    status.liveReady ??
    Boolean(
      status.engines?.appleSpeech?.ready ||
        status.engines?.sherpaStreaming?.modelReady,
    )
  );
}

function isDesktopASRFinalReady(status: DesktopASRStatus): boolean {
  return (
    status.finalReady ??
    Boolean(
      status.engines?.funasrFinal?.modelReady ||
        status.engines?.whisperFallback?.ready,
    )
  );
}

function getDesktopASRLiveSummary(status: DesktopASRStatus): string {
  if (status.engines?.appleSpeech?.ready) return 'Apple Speech ready';
  if (status.engines?.sherpaStreaming?.modelReady) {
    return 'sherpa streaming ready';
  }
  const reason =
    status.engines?.appleSpeech?.reason ||
    status.engines?.sherpaStreaming?.reason;
  return reason ? `No live engine (${reason})` : 'No live engine';
}

function getDesktopASRFinalSummary(status: DesktopASRStatus): string {
  if (status.engines?.funasrFinal?.modelReady) return 'FunASR final ready';
  if (status.engines?.whisperFallback?.ready) return 'Whisper fallback ready';
  const reason =
    status.engines?.funasrFinal?.reason ||
    status.engines?.whisperFallback?.reason;
  return reason ? `No final engine (${reason})` : 'No final engine';
}

function DesktopASRStatusPanel({ enabled }: { enabled: boolean }) {
  const [status, setStatus] = React.useState<DesktopASRStatus | null>(null);
  const isMac =
    typeof navigator !== 'undefined' &&
    navigator.platform?.toLowerCase().includes('mac');
  const autoEnsureModelRequestedRef = React.useRef(false);

  const requestDesktopDirectly = async <T,>(args: {
    method: string;
    path: string;
    body?: Record<string, unknown>;
  }): Promise<T> => {
    const { method, path, body } = args;
    const pairResponse = await fetch('http://127.0.0.1:46321/pair', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    if (!pairResponse.ok) {
      return {
        ok: false,
        error: `Desktop app pair failed: HTTP ${pairResponse.status}`,
      } as T;
    }
    const pairData = (await pairResponse.json()) as { token?: string };
    const token = pairData.token?.trim();
    if (!token) {
      return { ok: false, error: 'Desktop app pair failed: missing token' } as T;
    }
    const response = await fetch(`http://127.0.0.1:46321${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-bridge-token': token,
      },
      body: body && method !== 'GET' ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
      return {
        ok: false,
        error: `Desktop app request failed: HTTP ${response.status}`,
      } as T;
    }
    return (await response.json()) as T;
  };

  const requestDesktopStatusDirectly = async (): Promise<DesktopASRStatus> => {
    return requestDesktopDirectly({
      method: 'GET',
      path: '/asr/status',
    });
  };

  const ensureModelsDirectly = async (): Promise<void> => {
    const result = await requestDesktopDirectly<{
      ok?: boolean;
      error?: string;
    }>({
      method: 'POST',
      path: '/asr/model/ensure',
      body: {},
    });
    if (result.ok === false) {
      throw new Error(result.error || 'Desktop app ASR model ensure failed');
    }
  };

  const maybeAutoEnsureModels = (
    nextStatus: DesktopASRStatus,
    ensureModels: () => Promise<void>,
  ) => {
    if (
      !nextStatus.ok ||
      (isDesktopASRLiveReady(nextStatus) && isDesktopASRFinalReady(nextStatus)) ||
      nextStatus.downloadInProgress ||
      autoEnsureModelRequestedRef.current
    ) {
      return;
    }
    autoEnsureModelRequestedRef.current = true;
    void ensureModels().catch(() => {
      autoEnsureModelRequestedRef.current = false;
    });
  };

  React.useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | undefined;

    const sendWhisperRequest = async <T,>(message: {
      method: string;
      path: string;
      body?: Record<string, unknown>;
    }): Promise<T> => {
      return new Promise<T>((resolve, reject) => {
        chrome.runtime.sendMessage(
          { type: 'WHISPER_NM_REQUEST', ...message },
          (response: T) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(response);
            }
          },
        );
      });
    };

    const poll = async () => {
      try {
        const res = await sendWhisperRequest<{
          ok: boolean;
          ready?: boolean;
          liveReady?: boolean;
          finalReady?: boolean;
          engines?: DesktopASRStatus['engines'];
          activeSessionId?: string | null;
          activeSessions?: unknown[];
          downloadInProgress?: boolean;
          downloadProgress?: number;
          downloadTarget?: string;
          lastDownloadError?: string;
          error?: string;
        }>({
          method: 'GET',
          path: '/asr/status',
        });
        if (res.ok === false) {
          throw new Error(res.error || 'Desktop app not running');
        }
        if (!cancelled) {
          setStatus(res);
          maybeAutoEnsureModels(res, async () => {
            await sendWhisperRequest({
              method: 'POST',
              path: '/asr/model/ensure',
              body: {},
            });
          });
        }
      } catch (error) {
        try {
          const directStatus = await requestDesktopStatusDirectly();
          if (!cancelled) {
            setStatus(directStatus);
            maybeAutoEnsureModels(directStatus, ensureModelsDirectly);
          }
        } catch {
          if (!cancelled) {
            setStatus({
              ok: false,
              error: `Extension bridge failed: ${String(
                (error as Error)?.message || error,
              )}`,
            });
          }
        }
      }
    };

    const startPolling = () => {
      if (intervalId) return;
      void poll();
      intervalId = setInterval(poll, 5000);
    };

    const stopPolling = () => {
      if (!intervalId) return;
      clearInterval(intervalId);
      intervalId = undefined;
    };

    startPolling();

    const onVisibilityChange = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        startPolling();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      cancelled = true;
      stopPolling();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div
      className="form-group"
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        padding: '12px 16px',
        marginBottom: 16,
        backgroundColor: '#f9fafb',
      }}
    >
      <strong style={{ display: 'block', marginBottom: 8 }}>
        Desktop ASR (Local ASR)
      </strong>
      <small style={{ color: '#4b5563', display: 'block', marginBottom: 8 }}>
        Local ASR 不是 Chrome 内置能力。它需要安装并启动 Personal AI
        desktop app，由 desktop app 在本机运行本地转录模型，并通过 native messaging
        / localhost bridge 接收音频。Auto 模式会优先使用 Local ASR，然后回退 Cloud。
      </small>
      <button
        type="button"
        onClick={() => window.open(DESKTOP_APP_RELEASE_URL, '_blank', 'noopener')}
        style={{ marginBottom: 8, fontSize: 11, padding: '2px 8px' }}
      >
        Download App
      </button>
      {!isMac && (
        <small style={{ color: '#b45309', display: 'block', marginBottom: 8 }}>
          当前 Local ASR provider 代码只支持 macOS。Windows 上 local
          mode 暂无稳定本地转录路径；Auto 会回退云端，Local only 会显示 No ASR。
        </small>
      )}
      {!status ? (
        <small style={{ color: '#6b7280' }}>Checking...</small>
      ) : !status.ok ? (
        <div>
          <small style={{ color: '#dc2626' }}>
            {status.error || 'Desktop app not running'}
          </small>
        </div>
      ) : (
        <div>
          <small
            style={{
              color: isDesktopASRFinalReady(status) ? '#16a34a' : '#d97706',
            }}
          >
            {isDesktopASRFinalReady(status)
              ? 'Local ASR can transcribe now'
              : status.downloadInProgress
                ? `Preparing local ASR models ${status.downloadProgress ?? 0}%`
                : 'Local ASR final model is not ready'}
          </small>
          <small style={{ color: '#4b5563', display: 'block', marginTop: 4 }}>
            Live: {getDesktopASRLiveSummary(status)}
            {!isDesktopASRLiveReady(status) && isDesktopASRFinalReady(status)
              ? ' · final-only transcripts may appear after silence or stop'
              : ''}
          </small>
          <small style={{ color: '#4b5563', display: 'block', marginTop: 4 }}>
            Final: {getDesktopASRFinalSummary(status)}
          </small>
          <small
            style={{
              color: status.engines?.whisperFallback?.whisperBinaryAvailable
                ? '#16a34a'
                : '#d97706',
              display: 'block',
              marginTop: 4,
            }}
          >
            Whisper fallback:{' '}
            {status.engines?.whisperFallback?.whisperBinaryAvailable
              ? 'binary ready'
              : status.engines?.whisperFallback?.whisperBinaryInstallInProgress
                ? 'installing binary'
                : status.engines?.whisperFallback?.modelReady
                  ? 'model ready, binary missing'
                  : 'not ready'}
          </small>
          <small style={{ color: '#6b7280', display: 'block', marginTop: 4 }}>
            Desktop app connected
            {status.activeSessionId
              ? ` · active session ${status.activeSessionId}`
              : ''}
          </small>
          {status.downloadInProgress ? (
            <small style={{ color: '#6b7280', display: 'block', marginTop: 4 }}>
              Downloading {status.downloadTarget || 'ASR model'} ·{' '}
              {status.downloadProgress ?? 0}%
            </small>
          ) : null}
          {status.lastDownloadError ? (
            <small style={{ color: '#dc2626', display: 'block', marginTop: 4 }}>
              Local ASR model install failed: {status.lastDownloadError}
            </small>
          ) : null}
          {!isDesktopASRFinalReady(status) && !status.downloadInProgress ? (
            <small style={{ color: '#6b7280', display: 'block', marginTop: 4 }}>
              Desktop app 会自动安装本地 ASR 模型。至少需要一个 final
              engine；Whisper fallback ready 时即使 live engine 缺失也可转写。
            </small>
          ) : null}
        </div>
      )}
    </div>
  );
}

interface ContextMutedSiteView {
  host: string;
  mutedAt: number;
  remaining: string;
  expiresAtLabel: string;
}

interface ContextBlockedSiteView {
  host: string;
  blockedAtLabel: string;
}

interface ContextBlockedPageView {
  prefix: string;
  blockedAtLabel: string;
}

interface ContextAllowedSiteView {
  host: string;
  allowedAtLabel: string;
}

function ContextSiteMuteSettings() {
  const [mutedSites, setMutedSites] = React.useState<ContextMutedSiteView[]>(
    [],
  );
  const [blockedSites, setBlockedSites] = React.useState<ContextBlockedSiteView[]>(
    [],
  );
  const [blockedPages, setBlockedPages] = React.useState<ContextBlockedPageView[]>(
    [],
  );
  const [allowlistMode, setAllowlistMode] = React.useState(false);
  const [allowedSites, setAllowedSites] = React.useState<ContextAllowedSiteView[]>(
    [],
  );
  const [allowHostInput, setAllowHostInput] = React.useState('');
  const [blockHostInput, setBlockHostInput] = React.useState('');
  const [blockPageInput, setBlockPageInput] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [message, setMessage] = React.useState('');

  const toMutedSiteViews = (
    record: Record<string, number>,
  ): ContextMutedSiteView[] => {
    const formatter = new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    return Object.entries(record)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([host, mutedAt]) => {
        const expiresAt = getContextSiteMuteExpiresAt(mutedAt);
        return {
          host,
          mutedAt,
          remaining: formatContextSiteMuteRemaining(mutedAt),
          expiresAtLabel: expiresAt ? formatter.format(new Date(expiresAt)) : '',
        };
      });
  };

  const toBlockedSiteViews = (
    record: Record<string, number>,
  ): ContextBlockedSiteView[] => {
    const formatter = new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    return Object.entries(record)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([host, blockedAt]) => ({
        host,
        blockedAtLabel: formatter.format(new Date(blockedAt)),
      }));
  };

  const toAllowedSiteViews = (
    record: Record<string, number>,
  ): ContextAllowedSiteView[] => {
    const formatter = new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    return Object.entries(record)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([host, allowedAt]) => ({
        host,
        allowedAtLabel: formatter.format(new Date(allowedAt)),
      }));
  };

  const toBlockedPageViews = (
    record: Record<string, number>,
  ): ContextBlockedPageView[] => {
    const formatter = new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    return Object.entries(record)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([prefix, blockedAt]) => ({
        prefix,
        blockedAtLabel: formatter.format(new Date(blockedAt)),
      }));
  };

  const normalizeSiteControlHost = (rawValue: string): string => {
    const trimmed = rawValue.trim();
    if (!trimmed) return '';

    try {
      const parsed = new URL(
        trimmed.includes('://') ? trimmed : `https://${trimmed}`,
      );
      return normalizeContextSiteMuteHost(parsed.hostname);
    } catch (_error) {
      return normalizeContextSiteMuteHost(trimmed.split(/[/:?#]/)[0] || '');
    }
  };

  const siteControlInputIncludesPath = (rawValue: string): boolean => {
    const trimmed = rawValue.trim();
    if (!trimmed) return false;

    try {
      const parsed = new URL(
        trimmed.includes('://') ? trimmed : `https://${trimmed}`,
      );
      return parsed.pathname !== '' && parsed.pathname !== '/';
    } catch (_error) {
      return /\/.+/.test(trimmed);
    }
  };

  const normalizePageControlPrefix = (rawValue: string): string | null =>
    normalizeContextPageBlockPrefix(rawValue);

  const readMutedSiteRecord = async (): Promise<Record<string, number>> => {
    const result = await chrome.storage.local.get(CONTEXT_SITE_MUTE_STORAGE_KEY);
    const pruned = pruneContextSiteMuteRecord(
      result?.[CONTEXT_SITE_MUTE_STORAGE_KEY],
    );
    if (pruned.changed) {
      await chrome.storage.local.set({
        [CONTEXT_SITE_MUTE_STORAGE_KEY]: pruned.record,
      });
    }
    return pruned.record;
  };

  const readBlockedSiteRecord = async (): Promise<Record<string, number>> => {
    const result = await chrome.storage.local.get(CONTEXT_SITE_BLOCK_STORAGE_KEY);
    const pruned = pruneContextSiteBlockRecord(
      result?.[CONTEXT_SITE_BLOCK_STORAGE_KEY],
    );
    if (pruned.changed) {
      await chrome.storage.local.set({
        [CONTEXT_SITE_BLOCK_STORAGE_KEY]: pruned.record,
      });
    }
    return pruned.record;
  };

  const readAllowedSiteRecord = async (): Promise<Record<string, number>> => {
    const result = await chrome.storage.local.get(CONTEXT_SITE_ALLOW_STORAGE_KEY);
    const pruned = pruneContextSiteAllowRecord(
      result?.[CONTEXT_SITE_ALLOW_STORAGE_KEY],
    );
    if (pruned.changed) {
      await chrome.storage.local.set({
        [CONTEXT_SITE_ALLOW_STORAGE_KEY]: pruned.record,
      });
    }
    return pruned.record;
  };

  const readAllowlistMode = async (): Promise<boolean> => {
    const result = await chrome.storage.local.get(
      CONTEXT_SITE_ALLOWLIST_MODE_STORAGE_KEY,
    );
    return result?.[CONTEXT_SITE_ALLOWLIST_MODE_STORAGE_KEY] === true;
  };

  const readBlockedPageRecord = async (): Promise<Record<string, number>> => {
    const result = await chrome.storage.local.get(CONTEXT_PAGE_BLOCK_STORAGE_KEY);
    const pruned = pruneContextPageBlockRecord(
      result?.[CONTEXT_PAGE_BLOCK_STORAGE_KEY],
    );
    if (pruned.changed) {
      await chrome.storage.local.set({
        [CONTEXT_PAGE_BLOCK_STORAGE_KEY]: pruned.record,
      });
    }
    return pruned.record;
  };

  const buildAllowedSiteRecordFromViews = (): Record<string, number> =>
    Object.fromEntries(allowedSites.map((site) => [site.host, Date.now()]));

  const formatSiteControlActionReceipt = (
    actionSummary: string,
    options: {
      host?: string;
      allowRecord?: Record<string, number>;
      nextAllowlistMode?: boolean;
      forceAllPassiveQuiet?: boolean;
      forceDefaultMode?: boolean;
    } = {},
  ): string => {
    const nextAllowlistMode =
      options.nextAllowlistMode ?? (options.forceDefaultMode ? false : allowlistMode);
    const allowRecord = options.allowRecord ?? buildAllowedSiteRecordFromViews();
    let effectSummary = '已打开页面会实时重新评估右下角 Lens、页面召回和被动入库候选';

    if (options.forceAllPassiveQuiet) {
      effectSummary = '白名单模式下普通网页被动提示会全部保持静默';
    } else if (nextAllowlistMode && options.host) {
      effectSummary = isContextHostCoveredBySiteRecord(options.host, allowRecord)
        ? '此站点在允许列表内，已打开页面会实时重新评估右下角 Lens、页面召回和被动入库候选'
        : '白名单模式仍会让此站点的被动提示保持静默，除非重新加入允许列表';
    } else if (nextAllowlistMode && Object.keys(allowRecord).length === 0) {
      effectSummary = '白名单模式当前没有允许站点，普通网页被动提示全部保持静默';
    }

    return `${actionSummary}；${effectSummary}；主动划词仍可用；不会写入、删除、同步或外发已有记忆。`;
  };

  const refreshSiteControls = async (nextMessage = '') => {
    setLoading(true);
    try {
      const [
        muteRecord,
        blockRecord,
        pageBlockRecord,
        allowRecord,
        nextAllowlistMode,
      ] = await Promise.all([
        readMutedSiteRecord(),
        readBlockedSiteRecord(),
        readBlockedPageRecord(),
        readAllowedSiteRecord(),
        readAllowlistMode(),
      ]);
      setMutedSites(toMutedSiteViews(muteRecord));
      setBlockedSites(toBlockedSiteViews(blockRecord));
      setBlockedPages(toBlockedPageViews(pageBlockRecord));
      setAllowedSites(toAllowedSiteViews(allowRecord));
      setAllowlistMode(nextAllowlistMode);
      setMessage(nextMessage);
    } catch (error) {
      console.warn('Failed to load context site controls:', error);
      setMessage('读取站点控制失败');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    void refreshSiteControls();
  }, []);

  const unmuteSite = async (host: string) => {
    setLoading(true);
    try {
      const record = await readMutedSiteRecord();
      delete record[host];
      await chrome.storage.local.set({
        [CONTEXT_SITE_MUTE_STORAGE_KEY]: record,
      });
      setMutedSites(toMutedSiteViews(record));
      setMessage(
        formatSiteControlActionReceipt(`已移除 ${host} 的临时静默`, {
          host,
        }),
      );
    } catch (error) {
      console.warn('Failed to unmute context site:', error);
      setMessage('恢复站点失败');
    } finally {
      setLoading(false);
    }
  };

  const clearMutedSites = async () => {
    setLoading(true);
    try {
      await chrome.storage.local.set({ [CONTEXT_SITE_MUTE_STORAGE_KEY]: {} });
      setMutedSites([]);
      setMessage(
        formatSiteControlActionReceipt('已清空全部临时静默站点', {
          forceAllPassiveQuiet: allowlistMode && allowedSites.length === 0,
        }),
      );
    } catch (error) {
      console.warn('Failed to clear context site mutes:', error);
      setMessage('恢复全部站点失败');
    } finally {
      setLoading(false);
    }
  };

  const setAllowlistModeValue = async (nextValue: boolean) => {
    setLoading(true);
    try {
      await chrome.storage.local.set({
        [CONTEXT_SITE_ALLOWLIST_MODE_STORAGE_KEY]: nextValue,
      });
      setAllowlistMode(nextValue);
      setMessage(
        formatSiteControlActionReceipt(
          nextValue
            ? '已开启白名单模式：仅允许列表内站点显示网页记忆提示'
            : '已关闭白名单模式：恢复默认站点规则',
          {
            nextAllowlistMode: nextValue,
            forceAllPassiveQuiet: nextValue && allowedSites.length === 0,
            forceDefaultMode: !nextValue,
          },
        ),
      );
    } catch (error) {
      console.warn('Failed to update context allowlist mode:', error);
      setMessage('更新白名单模式失败');
    } finally {
      setLoading(false);
    }
  };

  const allowSite = async () => {
    if (siteControlInputIncludesPath(allowHostInput)) {
      setMessage('允许站点只接受域名；页面路径请继续使用路径屏蔽规则');
      return;
    }

    const host = normalizeSiteControlHost(allowHostInput);
    if (!host) {
      setMessage('请输入有效网站域名');
      return;
    }

    setLoading(true);
    try {
      const [muteRecord, blockRecord, allowRecord] = await Promise.all([
        readMutedSiteRecord(),
        readBlockedSiteRecord(),
        readAllowedSiteRecord(),
      ]);
      const nextMuteRecord = removeContextSiteRecordConflicts(
        host,
        muteRecord,
      );
      const nextBlockRecord = removeContextSiteRecordConflicts(
        host,
        blockRecord,
      );
      allowRecord[host] = Date.now();
      await chrome.storage.local.set({
        [CONTEXT_SITE_MUTE_STORAGE_KEY]: nextMuteRecord.record,
        [CONTEXT_SITE_BLOCK_STORAGE_KEY]: nextBlockRecord.record,
        [CONTEXT_SITE_ALLOW_STORAGE_KEY]: allowRecord,
      });
      setMutedSites(toMutedSiteViews(nextMuteRecord.record));
      setBlockedSites(toBlockedSiteViews(nextBlockRecord.record));
      setAllowedSites(toAllowedSiteViews(allowRecord));
      setAllowHostInput('');
      const removedConflictCount =
        nextMuteRecord.removedHosts.length + nextBlockRecord.removedHosts.length;
      setMessage(
        formatSiteControlActionReceipt(
          removedConflictCount > 0
            ? `已允许 ${host} 显示网页记忆提示，并移除 ${removedConflictCount} 条覆盖它的静默/屏蔽规则`
            : `已允许 ${host} 显示网页记忆提示`,
          {
            host,
            allowRecord,
          },
        ),
      );
    } catch (error) {
      console.warn('Failed to allow context site:', error);
      setMessage('添加允许站点失败');
    } finally {
      setLoading(false);
    }
  };

  const removeAllowedSite = async (host: string) => {
    setLoading(true);
    try {
      const record = await readAllowedSiteRecord();
      delete record[host];
      await chrome.storage.local.set({
        [CONTEXT_SITE_ALLOW_STORAGE_KEY]: record,
      });
      setAllowedSites(toAllowedSiteViews(record));
      setMessage(
        formatSiteControlActionReceipt(`已从允许列表移除 ${host}`, {
          host,
          allowRecord: record,
        }),
      );
    } catch (error) {
      console.warn('Failed to remove context allowed site:', error);
      setMessage('移除允许站点失败');
    } finally {
      setLoading(false);
    }
  };

  const clearAllowedSites = async () => {
    setLoading(true);
    try {
      await chrome.storage.local.set({ [CONTEXT_SITE_ALLOW_STORAGE_KEY]: {} });
      setAllowedSites([]);
      setMessage(
        formatSiteControlActionReceipt('已清空允许站点列表', {
          allowRecord: {},
          forceAllPassiveQuiet: allowlistMode,
        }),
      );
    } catch (error) {
      console.warn('Failed to clear context allowed sites:', error);
      setMessage('清空允许站点失败');
    } finally {
      setLoading(false);
    }
  };

  const blockSite = async () => {
    if (siteControlInputIncludesPath(blockHostInput)) {
      setMessage('整站屏蔽只接受域名；页面路径请使用下方输入框');
      return;
    }

    const host = normalizeSiteControlHost(blockHostInput);
    if (!host) {
      setMessage('请输入有效网站域名');
      return;
    }

    setLoading(true);
    try {
      const [muteRecord, blockRecord] = await Promise.all([
        readMutedSiteRecord(),
        readBlockedSiteRecord(),
      ]);
      const allowRecord = await readAllowedSiteRecord();
      const nextMuteRecord = removeContextSiteRecordConflicts(
        host,
        muteRecord,
      );
      const nextAllowRecord = removeContextSiteRecordConflicts(
        host,
        allowRecord,
      );
      blockRecord[host] = Date.now();
      await chrome.storage.local.set({
        [CONTEXT_SITE_MUTE_STORAGE_KEY]: nextMuteRecord.record,
        [CONTEXT_SITE_BLOCK_STORAGE_KEY]: blockRecord,
        [CONTEXT_SITE_ALLOW_STORAGE_KEY]: nextAllowRecord.record,
      });
      setMutedSites(toMutedSiteViews(nextMuteRecord.record));
      setBlockedSites(toBlockedSiteViews(blockRecord));
      setAllowedSites(toAllowedSiteViews(nextAllowRecord.record));
      setBlockHostInput('');
      const removedConflictCount =
        nextMuteRecord.removedHosts.length + nextAllowRecord.removedHosts.length;
      setMessage(
        formatSiteControlActionReceipt(
          removedConflictCount > 0
            ? `已永久关闭 ${host} 的网页记忆提示，并移除 ${removedConflictCount} 条允许/静默冲突规则`
            : `已永久关闭 ${host} 的网页记忆提示`,
          {
            host,
            allowRecord: nextAllowRecord.record,
          },
        ),
      );
    } catch (error) {
      console.warn('Failed to block context site:', error);
      setMessage('永久关闭站点失败');
    } finally {
      setLoading(false);
    }
  };

  const unblockSite = async (host: string) => {
    setLoading(true);
    try {
      const record = await readBlockedSiteRecord();
      delete record[host];
      await chrome.storage.local.set({
        [CONTEXT_SITE_BLOCK_STORAGE_KEY]: record,
      });
      setBlockedSites(toBlockedSiteViews(record));
      setMessage(
        formatSiteControlActionReceipt(`已移除 ${host} 的永久屏蔽`, {
          host,
        }),
      );
    } catch (error) {
      console.warn('Failed to unblock context site:', error);
      setMessage('恢复永久屏蔽站点失败');
    } finally {
      setLoading(false);
    }
  };

  const clearBlockedSites = async () => {
    setLoading(true);
    try {
      await chrome.storage.local.set({ [CONTEXT_SITE_BLOCK_STORAGE_KEY]: {} });
      setBlockedSites([]);
      setMessage(
        formatSiteControlActionReceipt('已清空全部永久屏蔽站点', {
          forceAllPassiveQuiet: allowlistMode && allowedSites.length === 0,
        }),
      );
    } catch (error) {
      console.warn('Failed to clear context site blocks:', error);
      setMessage('恢复全部永久屏蔽站点失败');
    } finally {
      setLoading(false);
    }
  };

  const blockPage = async () => {
    const prefix = normalizePageControlPrefix(blockPageInput);
    if (!prefix) {
      setMessage('请输入包含路径的 http/https URL；整站屏蔽请使用上方域名');
      return;
    }

    setLoading(true);
    try {
      const record = await readBlockedPageRecord();
      record[prefix] = Date.now();
      await chrome.storage.local.set({
        [CONTEXT_PAGE_BLOCK_STORAGE_KEY]: record,
      });
      setBlockedPages(toBlockedPageViews(record));
      setBlockPageInput('');
      setMessage(
        formatSiteControlActionReceipt(
          `已永久关闭 ${prefix} 下的被动网页处理`,
          {
            forceAllPassiveQuiet: allowlistMode && allowedSites.length === 0,
          },
        ),
      );
    } catch (error) {
      console.warn('Failed to block context page prefix:', error);
      setMessage('永久关闭页面路径失败');
    } finally {
      setLoading(false);
    }
  };

  const unblockPage = async (prefix: string) => {
    setLoading(true);
    try {
      const record = await readBlockedPageRecord();
      delete record[prefix];
      await chrome.storage.local.set({
        [CONTEXT_PAGE_BLOCK_STORAGE_KEY]: record,
      });
      setBlockedPages(toBlockedPageViews(record));
      setMessage(
        formatSiteControlActionReceipt(
          `已移除 ${prefix} 下的页面路径屏蔽`,
          {
            forceAllPassiveQuiet: allowlistMode && allowedSites.length === 0,
          },
        ),
      );
    } catch (error) {
      console.warn('Failed to unblock context page prefix:', error);
      setMessage('恢复页面路径失败');
    } finally {
      setLoading(false);
    }
  };

  const clearBlockedPages = async () => {
    setLoading(true);
    try {
      await chrome.storage.local.set({ [CONTEXT_PAGE_BLOCK_STORAGE_KEY]: {} });
      setBlockedPages([]);
      setMessage(
        formatSiteControlActionReceipt('已清空全部页面路径屏蔽规则', {
          forceAllPassiveQuiet: allowlistMode && allowedSites.length === 0,
        }),
      );
    } catch (error) {
      console.warn('Failed to clear context page blocks:', error);
      setMessage('恢复全部页面路径失败');
    } finally {
      setLoading(false);
    }
  };

  const controlSummary = allowlistMode
    ? `白名单模式 · 允许 ${allowedSites.length} 个站点 · 临时静默 ${mutedSites.length} · 屏蔽 ${blockedSites.length + blockedPages.length}`
    : `默认模式 · 临时静默 ${mutedSites.length} · 站点屏蔽 ${blockedSites.length} · 路径屏蔽 ${blockedPages.length}`;
  const blockedRuleCount = blockedSites.length + blockedPages.length;
  const siteControlStatusRows = [
    {
      label: '当前模式',
      value: allowlistMode
        ? `白名单模式：只允许 ${allowedSites.length} 个站点及其子域名被动提示`
        : '默认模式：未命中静默/屏蔽规则的站点可被动提示',
    },
    {
      label: '会被控制',
      value: '右下角 Lens、页面召回、整页/视觉入库候选',
    },
    {
      label: '当前阻断',
      value: allowlistMode
        ? allowedSites.length > 0
          ? `${allowedSites.length} 个允许站点外会保持静默；另有 ${blockedRuleCount} 条屏蔽规则`
          : '白名单已开启但没有允许站点：普通网页被动提示全部保持静默'
        : mutedSites.length + blockedRuleCount > 0
          ? `${mutedSites.length} 个临时静默、${blockedSites.length} 个整站屏蔽、${blockedPages.length} 个路径屏蔽正在生效`
          : '没有站点控制阻断；仍受敏感页、低信息和召回质量门控',
    },
    {
      label: '仍可使用',
      value: '主动划词检索仍可用；敏感页和密钥类选区继续拦截',
    },
    {
      label: '不会发生',
      value: '不删除、不同步、不外发已有记忆，也不反写当前网站',
    },
  ];
  const siteControlPassiveScope = '右下角 Lens、页面召回、整页/视觉入库候选';
  const siteControlNoEffectBoundary =
    '主动划词仍可用；不会写入、删除、同步或外发已有记忆';
  const siteControlLiveRecheck =
    `已打开页面会实时重新评估${siteControlPassiveScope}`;
  const formatSiteControlButtonBoundary = (
    actionSummary: string,
    effectSummary = siteControlLiveRecheck,
  ): string =>
    `${actionSummary}；${effectSummary}；${siteControlNoEffectBoundary}。`;
  const siteControlRefreshBoundary = formatSiteControlButtonBoundary(
    '刷新只重读本机 extension storage 的站点控制快照，不新增、恢复或删除规则',
    '只更新本页状态显示，不触发新的记忆写入',
  );
  const clearMutedSitesBoundary = formatSiteControlButtonBoundary(
    '清空全部 24 小时临时静默站点',
    allowlistMode && allowedSites.length === 0
      ? '白名单模式当前没有允许站点，普通网页被动提示仍会全部保持静默'
      : '已打开页面会按剩余白名单、整站屏蔽和路径屏蔽实时重新评估',
  );
  const allowlistModeBoundary = allowlistMode
    ? formatSiteControlButtonBoundary(
        '关闭白名单模式，恢复默认站点规则',
        siteControlLiveRecheck,
      )
    : formatSiteControlButtonBoundary(
        '开启白名单模式：仅允许列表内站点被动提示',
        allowedSites.length > 0
          ? `${allowedSites.length} 个允许站点可被动提示，其他普通网页保持静默`
          : '没有允许站点时普通网页被动提示会全部保持静默',
      );
  const allowHostCandidate = normalizeSiteControlHost(allowHostInput);
  const allowSiteBoundary = formatSiteControlButtonBoundary(
    allowHostCandidate
      ? `把 ${allowHostCandidate} 加入允许站点列表，并移除覆盖它的静默/屏蔽冲突`
      : '把输入域名加入允许站点列表；页面路径不会在这里写入',
    allowlistMode
      ? siteControlLiveRecheck
      : '默认模式下只是保存允许候选；开启白名单后才限制为允许列表',
  );
  const clearAllowedSitesBoundary = formatSiteControlButtonBoundary(
    '清空全部允许站点',
    allowlistMode
      ? '白名单模式会让普通网页被动提示全部保持静默'
      : '默认模式下只是清空未来白名单候选',
  );
  const blockHostCandidate = normalizeSiteControlHost(blockHostInput);
  const blockSiteBoundary = formatSiteControlButtonBoundary(
    blockHostCandidate
      ? `永久屏蔽 ${blockHostCandidate} 的被动网页处理，并移除允许/静默冲突`
      : '永久屏蔽输入域名的被动网页处理；页面路径请用路径屏蔽',
    '只停止该站点及覆盖范围内的被动网页处理',
  );
  const clearBlockedSitesBoundary = formatSiteControlButtonBoundary(
    '清空全部永久屏蔽站点',
    allowlistMode && allowedSites.length === 0
      ? '白名单模式当前没有允许站点，普通网页被动提示仍会全部保持静默'
      : '已打开页面会按剩余白名单、临时静默和路径屏蔽实时重新评估',
  );
  const blockPageCandidate = normalizePageControlPrefix(blockPageInput);
  const blockPageBoundary = formatSiteControlButtonBoundary(
    blockPageCandidate
      ? `永久屏蔽 ${blockPageCandidate} 路径及其子路径的被动网页处理`
      : '永久屏蔽输入 URL 路径及其子路径的被动网页处理',
    '只影响该路径范围，不影响同域名其他页面',
  );
  const clearBlockedPagesBoundary = formatSiteControlButtonBoundary(
    '清空全部页面路径屏蔽规则',
    allowlistMode && allowedSites.length === 0
      ? '白名单模式当前没有允许站点，普通网页被动提示仍会全部保持静默'
      : '已打开页面会按剩余白名单、临时静默和整站屏蔽实时重新评估',
  );
  const buildRemoveAllowedSiteBoundary = (host: string): string =>
    formatSiteControlButtonBoundary(
      `从允许站点列表移除 ${host}`,
      allowlistMode
        ? '白名单模式会让此站点被动提示保持静默，除非重新加入允许列表'
        : '默认模式下只是移除未来白名单候选',
    );
  const buildUnmuteSiteBoundary = (host: string): string =>
    formatSiteControlButtonBoundary(
      `恢复 ${host} 的 24 小时临时静默`,
      '只移除临时静默规则；是否恢复被动提示仍受白名单、整站屏蔽、路径屏蔽和敏感页门控',
    );
  const buildUnblockSiteBoundary = (host: string): string =>
    formatSiteControlButtonBoundary(
      `移除 ${host} 的永久屏蔽`,
      '只移除整站屏蔽规则；是否恢复被动提示仍受白名单、临时静默、路径屏蔽和敏感页门控',
    );
  const buildUnblockPageBoundary = (prefix: string): string =>
    formatSiteControlButtonBoundary(
      `移除 ${prefix} 的页面路径屏蔽`,
      '只恢复该路径被动候选资格；同站其他规则和敏感页门控仍会继续生效',
    );

  return (
    <div className="form-group">
      <div
        style={{
          border: '1px solid #e5e7eb',
          borderRadius: 8,
          background: '#f8fafc',
          padding: '12px 14px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <small style={{ color: '#64748b' }}>
            管理被动网页记忆提示的临时静默、整站屏蔽、页面路径屏蔽和白名单。
          </small>
          <small
            aria-live="polite"
            style={{
              color: '#334155',
              display: 'block',
              fontWeight: 600,
              marginTop: 4,
            }}
          >
            {controlSummary}
          </small>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              title={siteControlRefreshBoundary}
              aria-label={siteControlRefreshBoundary}
              onClick={() => refreshSiteControls('已刷新站点控制')}
              disabled={loading}
              style={{ fontSize: 12, padding: '4px 10px' }}
            >
              刷新
            </button>
            <button
              type="button"
              title={clearMutedSitesBoundary}
              aria-label={clearMutedSitesBoundary}
              onClick={clearMutedSites}
              disabled={loading || mutedSites.length === 0}
              style={{ fontSize: 12, padding: '4px 10px' }}
            >
              清空临时静默
            </button>
          </div>
        </div>

        <div
          className="context-site-control-status"
          aria-label="站点控制状态回执"
          style={{
            display: 'grid',
            gap: 6,
            border: '1px solid #bae6fd',
            borderRadius: 8,
            background: '#f0f9ff',
            color: '#0f4c5c',
            marginTop: 12,
            padding: '10px 12px',
          }}
        >
          <strong style={{ color: '#0c4a6e', fontSize: 13 }}>
            站点控制状态
          </strong>
          {siteControlStatusRows.map((row) => (
            <div
              key={row.label}
              style={{
                display: 'grid',
                gridTemplateColumns: '72px minmax(0, 1fr)',
                gap: 8,
                alignItems: 'start',
                fontSize: 12,
                lineHeight: 1.45,
              }}
            >
              <span style={{ color: '#0369a1', fontWeight: 700 }}>
                {row.label}
              </span>
              <span style={{ color: '#334155', overflowWrap: 'anywhere' }}>
                {row.value}
              </span>
            </div>
          ))}
        </div>

        <div
          style={{
            borderTop: '1px solid #e2e8f0',
            marginTop: 14,
            paddingTop: 14,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 12,
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            <div>
              <strong style={{ color: '#0f172a', fontSize: 13 }}>
                允许站点白名单
              </strong>
              <small style={{ color: '#64748b', display: 'block', marginTop: 2 }}>
                开启后，只在允许列表内的站点及其子域名显示网页记忆提示。
              </small>
            </div>
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                color: '#334155',
                fontSize: 12,
              }}
            >
              <input
                type="checkbox"
                title={allowlistModeBoundary}
                aria-label={allowlistModeBoundary}
                checked={allowlistMode}
                onChange={(event) =>
                  setAllowlistModeValue(event.currentTarget.checked)
                }
                disabled={loading}
              />
              仅允许白名单站点
            </label>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) auto',
              gap: 8,
              marginTop: 10,
            }}
          >
            <input
              type="text"
              value={allowHostInput}
              onChange={(event) => setAllowHostInput(event.target.value)}
              placeholder="docs.example.com"
              aria-label="添加允许站点"
              disabled={loading}
              style={{ fontSize: 12, padding: '6px 8px' }}
            />
            <button
              type="button"
              title={allowSiteBoundary}
              aria-label={allowSiteBoundary}
              onClick={allowSite}
              disabled={loading || !allowHostInput.trim()}
              style={{ fontSize: 12, padding: '4px 10px' }}
            >
              允许
            </button>
          </div>

          {allowedSites.length > 0 ? (
            <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
              {allowedSites.map((site) => (
                <div
                  key={site.host}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1fr) auto',
                    gap: 10,
                    alignItems: 'center',
                    border: '1px solid #e2e8f0',
                    borderRadius: 6,
                    background: '#fff',
                    padding: '9px 10px',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <strong
                      style={{
                        display: 'block',
                        color: '#0f172a',
                        overflowWrap: 'anywhere',
                      }}
                    >
                      {site.host}
                    </strong>
                    <small style={{ color: '#64748b' }}>
                      允许站点 · 添加于 {site.allowedAtLabel}
                    </small>
                  </div>
                  <button
                    type="button"
                    title={buildRemoveAllowedSiteBoundary(site.host)}
                    aria-label={buildRemoveAllowedSiteBoundary(site.host)}
                    onClick={() => removeAllowedSite(site.host)}
                    disabled={loading}
                    style={{ fontSize: 12, padding: '4px 10px' }}
                  >
                    移除
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <small style={{ color: '#64748b', display: 'block', marginTop: 10 }}>
              当前没有允许站点；开启白名单模式后将不会显示网页记忆提示。
            </small>
          )}

          <button
            type="button"
            title={clearAllowedSitesBoundary}
            aria-label={clearAllowedSitesBoundary}
            onClick={clearAllowedSites}
            disabled={loading || allowedSites.length === 0}
            style={{ fontSize: 12, padding: '4px 10px', marginTop: 10 }}
          >
            清空允许站点
          </button>
        </div>

        <div style={{ marginTop: 12 }}>
          <strong style={{ color: '#0f172a', fontSize: 13 }}>
            临时静默（24 小时）
          </strong>
        </div>

        {mutedSites.length > 0 ? (
          <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
            {mutedSites.map((site) => (
              <div
                key={site.host}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr) auto',
                  gap: 10,
                  alignItems: 'center',
                  border: '1px solid #e2e8f0',
                  borderRadius: 6,
                  background: '#fff',
                  padding: '9px 10px',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <strong
                    style={{
                      display: 'block',
                      color: '#0f172a',
                      overflowWrap: 'anywhere',
                    }}
                  >
                    {site.host}
                  </strong>
                  <small style={{ color: '#64748b' }}>
                    {site.remaining}
                    {site.expiresAtLabel ? ` · 到期 ${site.expiresAtLabel}` : ''}
                  </small>
                </div>
                <button
                  type="button"
                  title={buildUnmuteSiteBoundary(site.host)}
                  aria-label={buildUnmuteSiteBoundary(site.host)}
                  onClick={() => unmuteSite(site.host)}
                  disabled={loading}
                  style={{ fontSize: 12, padding: '4px 10px' }}
                >
                  恢复
                </button>
              </div>
            ))}
          </div>
        ) : (
          <small style={{ color: '#64748b', display: 'block', marginTop: 10 }}>
            当前没有被临时静默的网站。
          </small>
        )}

        <div
          style={{
            borderTop: '1px solid #e2e8f0',
            marginTop: 14,
            paddingTop: 14,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 12,
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            <div>
              <strong style={{ color: '#0f172a', fontSize: 13 }}>
                永久屏蔽站点
              </strong>
              <small style={{ color: '#64748b', display: 'block', marginTop: 2 }}>
                这些站点不会再触发网页记忆提示，直到你手动恢复。
              </small>
            </div>
            <button
              type="button"
              title={clearBlockedSitesBoundary}
              aria-label={clearBlockedSitesBoundary}
              onClick={clearBlockedSites}
              disabled={loading || blockedSites.length === 0}
              style={{ fontSize: 12, padding: '4px 10px' }}
            >
              清空永久屏蔽
            </button>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) auto',
              gap: 8,
              marginTop: 10,
            }}
          >
            <input
              type="text"
              value={blockHostInput}
              onChange={(event) => setBlockHostInput(event.target.value)}
              placeholder="example.com"
              disabled={loading}
              style={{ fontSize: 12, padding: '6px 8px' }}
            />
            <button
              type="button"
              title={blockSiteBoundary}
              aria-label={blockSiteBoundary}
              onClick={blockSite}
              disabled={loading || !blockHostInput.trim()}
              style={{ fontSize: 12, padding: '4px 10px' }}
            >
              添加
            </button>
          </div>

          {blockedSites.length > 0 ? (
            <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
              {blockedSites.map((site) => (
                <div
                  key={site.host}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1fr) auto',
                    gap: 10,
                    alignItems: 'center',
                    border: '1px solid #e2e8f0',
                    borderRadius: 6,
                    background: '#fff',
                    padding: '9px 10px',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <strong
                      style={{
                        display: 'block',
                        color: '#0f172a',
                        overflowWrap: 'anywhere',
                      }}
                    >
                      {site.host}
                    </strong>
                    <small style={{ color: '#64748b' }}>
                      永久屏蔽 · 添加于 {site.blockedAtLabel}
                    </small>
                  </div>
                  <button
                    type="button"
                    title={buildUnblockSiteBoundary(site.host)}
                    aria-label={buildUnblockSiteBoundary(site.host)}
                    onClick={() => unblockSite(site.host)}
                    disabled={loading}
                    style={{ fontSize: 12, padding: '4px 10px' }}
                  >
                    恢复
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <small style={{ color: '#64748b', display: 'block', marginTop: 10 }}>
              当前没有被永久屏蔽的网站。
            </small>
          )}
        </div>

        <div
          style={{
            borderTop: '1px solid #e2e8f0',
            marginTop: 14,
            paddingTop: 14,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 12,
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            <div>
              <strong style={{ color: '#0f172a', fontSize: 13 }}>
                永久屏蔽页面/路径
              </strong>
              <small style={{ color: '#64748b', display: 'block', marginTop: 2 }}>
                只关闭某个页面路径及其子路径，不影响同域名其他页面。
              </small>
            </div>
            <button
              type="button"
              title={clearBlockedPagesBoundary}
              aria-label={clearBlockedPagesBoundary}
              onClick={clearBlockedPages}
              disabled={loading || blockedPages.length === 0}
              style={{ fontSize: 12, padding: '4px 10px' }}
            >
              清空路径屏蔽
            </button>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) auto',
              gap: 8,
              marginTop: 10,
            }}
          >
            <input
              type="text"
              value={blockPageInput}
              onChange={(event) => setBlockPageInput(event.target.value)}
              placeholder="https://docs.example.com/doc/123"
              disabled={loading}
              style={{ fontSize: 12, padding: '6px 8px' }}
            />
            <button
              type="button"
              title={blockPageBoundary}
              aria-label={blockPageBoundary}
              onClick={blockPage}
              disabled={loading || !blockPageInput.trim()}
              style={{ fontSize: 12, padding: '4px 10px' }}
            >
              添加
            </button>
          </div>

          {blockedPages.length > 0 ? (
            <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
              {blockedPages.map((page) => (
                <div
                  key={page.prefix}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1fr) auto',
                    gap: 10,
                    alignItems: 'center',
                    border: '1px solid #e2e8f0',
                    borderRadius: 6,
                    background: '#fff',
                    padding: '9px 10px',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <strong
                      style={{
                        display: 'block',
                        color: '#0f172a',
                        overflowWrap: 'anywhere',
                      }}
                    >
                      {page.prefix}
                    </strong>
                    <small style={{ color: '#64748b' }}>
                      页面路径屏蔽 · 添加于 {page.blockedAtLabel}
                    </small>
                  </div>
                  <button
                    type="button"
                    title={buildUnblockPageBoundary(page.prefix)}
                    aria-label={buildUnblockPageBoundary(page.prefix)}
                    onClick={() => unblockPage(page.prefix)}
                    disabled={loading}
                    style={{ fontSize: 12, padding: '4px 10px' }}
                  >
                    恢复
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <small style={{ color: '#64748b', display: 'block', marginTop: 10 }}>
              当前没有被永久屏蔽的页面路径。
            </small>
          )}
        </div>

        {message ? (
          <small
            aria-live="polite"
            style={{ color: '#2563eb', display: 'block', marginTop: 10 }}
          >
            {message}
          </small>
        ) : null}
      </div>
    </div>
  );
}

const Options = () => {
  const { language: uiLanguage, setLanguage: setUiLanguage, t } =
    useExtensionUiLanguage();
  useStaticDomI18n(uiLanguage);
  const outreachConfigSectionRef = useRef<HTMLDivElement | null>(null);
  const meetingPilotConfigSectionRef = useRef<HTMLDivElement | null>(null);
  const openClawConfigSectionRef = useRef<HTMLDivElement | null>(null);
  const [config, setConfig] = useState<EnvConfigType>({ ...defaultEnvConfig });
  const [currentUsername, setCurrentUsername] = useState('');
  const [personalApiKey, setPersonalApiKey] = useState<{
    userId: string;
    keyPrefix: string;
  } | null>(null);
  const lastLanguageSyncKeyRef = useRef('');
  const [status, setStatus] = useState<{
    message: string;
    type: 'success' | 'error' | '';
  }>({
    message: '',
    type: '',
  });
  const [isDreamDigestPushing, setIsDreamDigestPushing] = useState(false);
  const [isWeeklyReportPushing, setIsWeeklyReportPushing] = useState(false);
  const [dreamDigestPushReceipt, setDreamDigestPushReceipt] =
    useState<DigestManualPushReceipt | null>(null);
  const [weeklyReportPushReceipt, setWeeklyReportPushReceipt] =
    useState<DigestManualPushReceipt | null>(null);
  const [outreachDirectoryStatus, setOutreachDirectoryStatus] = useState<
    OutreachDirectoryStatus[]
  >([]);
  const [outreachDirectoryRefreshing, setOutreachDirectoryRefreshing] =
    useState(false);
  const [outlookCalendarStatus, setOutlookCalendarStatus] =
    useState<OutlookCalendarStatusView>({ connected: false });
  const [outlookCalendarBusy, setOutlookCalendarBusy] = useState(false);
  const [highlightedSection, setHighlightedSection] = useState<string>('');

  // Weekly Report backend state (synced with memory-service)
  const [weeklyReportCron, setWeeklyReportCron] =
    useState<string>('0 18 * * 5');
  const [weeklyReportMinMessages, setWeeklyReportMinMessages] =
    useState<number>(20);
  const [weeklyReportSaving, setWeeklyReportSaving] = useState(false);

  const resolvePushTargetValue = (
    target: string | undefined,
    fallback: BotPushTargetMode = 'me',
    allowNone = false,
    enabled?: boolean,
  ): BotPushTargetMode => {
    const normalizedFallback =
      allowNone && enabled === false ? 'none' : fallback;
    return normalizeBotPushTarget(target, allowNone, normalizedFallback);
  };

  const buildDreamDigestPushReceipt = (
    result: Record<string, unknown>,
    target: BotPushTargetMode,
    groupId?: string,
    fallbackReason?: string,
  ): DigestManualPushReceipt => {
    const normalizedGroupId = normalizeDigestPushGroupId(groupId);
    return {
      kind: 'dream',
      generated: result.generated === true,
      target,
      groupId: normalizedGroupId,
      targetLabel: formatDigestPushTargetLabel(target, normalizedGroupId),
      notificationCreated:
        typeof result.notificationCreated === 'boolean'
          ? result.notificationCreated
          : typeof result.delivered === 'boolean'
            ? result.delivered
            : undefined,
      botSent:
        typeof result.botSent === 'boolean' ? result.botSent : undefined,
      botError: readString(result.botError),
      dreamCount: readNumber(result.dreamCount),
      latestDreamPath: readString(result.latestDreamPath),
      reason: readString(result.reason) || fallbackReason,
    };
  };

  const buildWeeklyReportPushReceipt = (
    result: Record<string, unknown>,
    target: BotPushTargetMode,
    groupId?: string,
    fallbackReason?: string,
  ): DigestManualPushReceipt => {
    const normalizedGroupId = normalizeDigestPushGroupId(groupId);
    return {
      kind: 'weekly',
      generated: result.generated === true,
      target,
      groupId: normalizedGroupId,
      targetLabel: formatDigestPushTargetLabel(target, normalizedGroupId),
      notificationCreated:
        typeof result.notificationCreated === 'boolean'
          ? result.notificationCreated
          : undefined,
      botSent:
        typeof result.botSent === 'boolean' ? result.botSent : undefined,
      botError: readString(result.botError),
      reportPath: readString(result.reportPath),
      messageCount: readNumber(result.messageCount),
      reflectionCount: readNumber(result.reflectionCount),
      reason: readString(result.reason) || fallbackReason,
    };
  };

  const readCurrentInputValue = (key: string): string | undefined => {
    const element = document.getElementById(key) as
      | HTMLInputElement
      | HTMLSelectElement
      | null;
    return element?.value;
  };

  const getCurrentPushTargetConfig = (
    targetKey: PushTargetField,
    groupKey: PushGroupField,
  ): EnvConfigType => ({
    ...config,
    [targetKey]: readCurrentInputValue(targetKey) ?? config[targetKey],
    [groupKey]: readCurrentInputValue(groupKey) ?? config[groupKey],
  });

  const renderDigestManualPushReceipt = (
    receipt: DigestManualPushReceipt | null,
  ) => {
    if (!receipt) return null;

    const currentTargetKey =
      receipt.kind === 'weekly'
        ? 'WEEKLY_REPORT_PUSH_TARGET'
        : 'DREAM_INSIGHT_PUSH_TARGET';
    const currentGroupKey =
      receipt.kind === 'weekly'
        ? 'WEEKLY_REPORT_PUSH_GROUP_ID'
        : 'DREAM_INSIGHT_PUSH_GROUP_ID';
    const currentTarget = resolvePushTargetValue(
      String(config[currentTargetKey] || ''),
      'me',
      true,
    );
    const currentGroupId = normalizeDigestPushGroupId(
      String(config[currentGroupKey] || ''),
    );
    const receiptGroupId = normalizeDigestPushGroupId(receipt.groupId);
    const currentTargetLabel = formatDigestPushTargetLabel(
      currentTarget,
      currentGroupId,
    );
    const currentTargetChanged =
      currentTarget !== receipt.target ||
      (currentTarget === 'group' &&
        receipt.target === 'group' &&
        currentGroupId !== receiptGroupId);

    const isBlocked = receipt.phase === 'blocked';
    const isPending = receipt.phase === 'pending';
    const title = isBlocked
      ? receipt.kind === 'weekly'
        ? '周报手动门禁'
        : 'Dream Digest 手动门禁'
      : isPending
        ? receipt.kind === 'weekly'
          ? '周报手动请求'
          : 'Dream Digest 手动请求'
        : receipt.kind === 'weekly'
          ? '周报手动结果'
          : 'Dream Digest 手动结果';
    const hasDeliveryIssue =
      !isPending &&
      receipt.generated &&
      receipt.target !== 'none' &&
      (receipt.notificationCreated === false ||
        receipt.botSent === false ||
        Boolean(receipt.botError));
    const deliveryState = isBlocked
      ? 'blocked'
      : isPending
      ? 'pending'
      : !receipt.generated
        ? 'not_generated'
        : hasDeliveryIssue
          ? 'partial_delivery'
          : 'generated';
    const receiptTone =
      deliveryState === 'generated'
        ? 'success'
        : deliveryState === 'pending'
          ? 'pending'
          : 'warning';
    const writeState = isBlocked
      ? '未请求通知写入'
      : isPending
      ? receipt.target === 'none'
        ? '本次不会请求通知写入'
        : '等待后端确认 notice 写入'
      : receipt.target === 'none'
        ? '未请求通知写入'
        : receipt.notificationCreated
          ? '通知中心 notice 已写入'
          : '通知中心 notice 未确认写入';
    const botState = isBlocked
      ? '未请求 Bot 投递'
      : isPending
      ? receipt.target === 'none'
        ? '本次不会请求 Bot 投递'
        : '等待后端 Bot 投递确认'
      : receipt.target === 'none'
        ? '未请求 Bot 投递'
        : receipt.botSent
          ? 'Bot 已确认送达'
          : receipt.botError
            ? `Bot 未送达：${receipt.botError}`
            : 'Bot 未确认送达';
    const contentDetail = isBlocked
      ? receipt.kind === 'weekly'
        ? '后端未收到周报生成请求'
        : '后端未收到 Dream Digest 生成请求'
      : isPending
      ? receipt.kind === 'weekly'
        ? '报告文件、消息数和反思数待后端返回'
        : 'dream 数量和最新落点待后端返回'
      : receipt.kind === 'weekly'
        ? [
            receipt.reportPath ? `文件 ${receipt.reportPath}` : '',
            receipt.messageCount !== undefined
              ? `消息 ${receipt.messageCount}`
              : '',
            receipt.reflectionCount !== undefined
              ? `反思 ${receipt.reflectionCount}`
              : '',
          ]
            .filter(Boolean)
            .join(' · ')
        : [
            receipt.dreamCount !== undefined
              ? `纳入 ${receipt.dreamCount} 个 dream`
              : '',
            receipt.latestDreamPath
              ? `落点 ${receipt.latestDreamPath}`
              : '',
          ]
            .filter(Boolean)
            .join(' · ');
    const boundary = isBlocked
      ? receipt.kind === 'weekly'
        ? '本次已在本页拦截：自定义群组目标缺少群组 ID；不会请求后端生成周报、写入 Notification Center、发送 Bot/Chrome/Doubao、改变自动周报调度或通知处理状态。填写群组 ID，或切回 Me/不推送后再试。'
        : '本次已在本页拦截：自定义群组目标缺少群组 ID；不会请求后端生成 Dream Digest、写入通知中心、发送 Bot/Chrome/Doubao、停止梦境重放或改变通知处理状态。填写群组 ID，或切回 Me/不推送后再试。'
      : isPending
      ? receipt.target === 'none'
        ? receipt.kind === 'weekly'
          ? '请求已提交：使用当前可见目标“不推送”，只等待后端生成报告；预期不创建 Notification Center 通知、不发送 Bot/Chrome/Doubao，也不改变自动周报调度或通知处理状态。'
          : '请求已提交：使用当前可见目标“不推送”，只等待后端生成 Dream Digest；预期不写入通知中心、不发送 Bot/Chrome/Doubao，也不停止梦境重放或改变通知处理状态。'
        : `请求已提交：使用当前可见目标“${receipt.targetLabel}”，正在等待 Notification Center notice 写入与 Bot 投递结果；不会改变自动调度，也不会确认、忽略或完成任何通知。`
      : !receipt.generated
      ? '本次没有生成可推送内容；不会创建通知、发送 Bot、改变调度，或确认/忽略任何通知。'
      : receipt.target === 'none'
        ? receipt.kind === 'weekly'
          ? '当前目标为不推送：只生成报告文件，不创建 Notification Center 通知、不发送 Bot/Chrome/Doubao，也不改变自动周报调度。'
          : '当前目标为不推送：只生成本次 Dream Digest 结果，不写入通知中心、不发送 Bot/Chrome/Doubao，也不停止梦境重放。'
        : hasDeliveryIssue
          ? '内容已生成，但本次投递未完整确认；请以“写入”和“Bot”两行判断需要补救的渠道。这次操作不会自动点击、忽略或完成通知，不会改变定时配置，也不会绕过当前投递目标。'
        : '通知中心写入和 Bot 投递分开显示；这次操作不会自动点击、忽略或完成通知，不会改变定时配置，也不会绕过当前投递目标。';

    return (
      <div
        className={`digest-push-receipt ${receiptTone}`}
        data-delivery-state={deliveryState}
        aria-live="polite"
      >
        <strong>{title}</strong>
        <dl>
          <div>
            <dt>状态</dt>
            <dd>
              {isBlocked
                ? '已拦截'
                : isPending
                ? '请求已提交'
                : !receipt.generated
                ? '未生成'
                : hasDeliveryIssue
                  ? '已生成，投递部分失败'
                  : '已生成'}
            </dd>
          </div>
          <div>
            <dt>提交目标</dt>
            <dd>{receipt.targetLabel}</dd>
          </div>
          {currentTargetChanged && (
            <div>
              <dt>当前设置</dt>
              <dd>
                已改为 {currentTargetLabel}；本回执仍是提交时快照，不代表当前可见设置已保存、已投递或已处理。
              </dd>
            </div>
          )}
          <div>
            <dt>写入</dt>
            <dd>{writeState}</dd>
          </div>
          <div>
            <dt>Bot</dt>
            <dd>{botState}</dd>
          </div>
          {contentDetail && (
            <div>
              <dt>内容</dt>
              <dd>{contentDetail}</dd>
            </div>
          )}
          {receipt.reason && (
            <div>
              <dt>原因</dt>
              <dd>{receipt.reason}</dd>
            </div>
          )}
        </dl>
        <small>{boundary}</small>
      </div>
    );
  };

  const validatePushTargets = (
    targetConfig: EnvConfigType,
    targetKeys?: PushTargetField[],
  ): string | null => {
    const rules = targetKeys
      ? PUSH_TARGET_RULES.filter((rule) => targetKeys.includes(rule.targetKey))
      : PUSH_TARGET_RULES;

    for (const rule of rules) {
      const mode = resolvePushTargetValue(
        String(targetConfig[rule.targetKey] || ''),
        'me',
        rule.allowNone,
      );
      if (
        mode === 'group' &&
        !String(targetConfig[rule.groupKey] || '').trim()
      ) {
        return `${rule.label} 已选择自定义群组，请填写群组 ID`;
      }
    }
    return null;
  };

  // Load weekly report settings from backend
  const loadWeeklyReportSettingsFromBackend = async (
    targetConfig: EnvConfigType,
  ) => {
    try {
      const data = await getRuntimeConfigFromBackend(targetConfig);
      if (!data) return;
      if (data.weeklyReportCron) {
        setWeeklyReportCron(data.weeklyReportCron);
      }
      if (data.weeklyReportMinMessages !== undefined) {
        setWeeklyReportMinMessages(Number(data.weeklyReportMinMessages));
      }
      setConfig((prev) => ({
        ...prev,
        WEEKLY_REPORT_CRON: data.weeklyReportCron || prev.WEEKLY_REPORT_CRON,
        WEEKLY_REPORT_MIN_MESSAGES:
          data.weeklyReportMinMessages !== undefined
            ? Number(data.weeklyReportMinMessages)
            : prev.WEEKLY_REPORT_MIN_MESSAGES,
        WEEKLY_REPORT_PUSH_TARGET: resolvePushTargetValue(
          data.weeklyReportPushTarget,
          prev.WEEKLY_REPORT_PUSH_TARGET || 'me',
          true,
          data.weeklyReportEnabled,
        ),
        WEEKLY_REPORT_PUSH_GROUP_ID:
          data.weeklyReportPushGroupId ||
          prev.WEEKLY_REPORT_PUSH_GROUP_ID ||
          '',
      }));
    } catch (err) {
      console.warn('Failed to load weekly report settings from backend:', err);
    }
  };

  // Save weekly report settings to backend
  const saveWeeklyReportSettings = async () => {
    const pushTarget = resolvePushTargetValue(
      config.WEEKLY_REPORT_PUSH_TARGET,
      'me',
      true,
    );
    const validationError = validatePushTargets(config, [
      'WEEKLY_REPORT_PUSH_TARGET',
    ]);
    if (validationError) {
      const blockedTarget = resolvePushTargetValue(
        currentPushConfig.DREAM_INSIGHT_PUSH_TARGET,
        'me',
        true,
      );
      setDreamDigestPushReceipt(
        buildBlockedDigestPushReceipt(
          'dream',
          blockedTarget,
          (currentPushConfig.DREAM_INSIGHT_PUSH_GROUP_ID || '').trim(),
          validationError,
        ),
      );
      setStatus({ message: validationError, type: 'error' });
      return;
    }
    setWeeklyReportSaving(true);
    try {
      const persistedConfig = sanitizeLocalEnvConfig(config);
      await chrome.storage.local.set({ envConfig: persistedConfig });
      await chrome.runtime.sendMessage({
        type: 'UPDATE_ENV_CONFIG',
        config: persistedConfig,
      });

      const client = await createMemoryServiceClient(config);
      await client.updateRuntimeConfig({
        weeklyReportEnabled: pushTarget !== 'none',
        weeklyReportCron,
        weeklyReportMinMessages,
        weeklyReportPushTarget: pushTarget,
        weeklyReportPushGroupId:
          (config.WEEKLY_REPORT_PUSH_GROUP_ID || '').trim() || undefined,
      });
      setStatus({ message: '周报设置已保存到后端', type: 'success' });
    } catch (err) {
      console.error('Save weekly report settings failed:', err);
      setStatus({ message: '保存周报设置失败', type: 'error' });
    } finally {
      setWeeklyReportSaving(false);
      setTimeout(() => setStatus({ message: '', type: '' }), 3000);
    }
  };

  // 页面加载时从 Chrome 存储中获取配置
  useEffect(() => {
    chrome.storage.local.get(
      ['envConfig', 'userinfo', 'memoryServiceUserApiKey', DEVICE_KEY_STORAGE],
      (result) => {
      console.log('result', result);
      const storedPersonalKey =
        result?.[DEVICE_KEY_STORAGE] || result?.memoryServiceUserApiKey;
      setPersonalApiKey(
        storedPersonalKey?.keyPrefix && storedPersonalKey?.userId
          ? {
              userId: String(storedPersonalKey.userId),
              keyPrefix: String(storedPersonalKey.keyPrefix),
            }
          : null,
      );
      // Align with MemoryServiceClient identity resolution: username, then
      // email local-part. Otherwise esone.qiu-only UI can stay hidden when
      // chrome.storage only has email / userEmail.
      const userinfo = result?.userinfo || {};
      const usernameCandidates = [
        userinfo.username,
        userinfo.userEmail?.split?.('@')?.[0],
        userinfo.email?.split?.('@')?.[0],
      ];
      const username =
        usernameCandidates
          .map((value: unknown) => String(value || '').trim())
          .find((value: string) => /^[a-zA-Z0-9._-]+$/.test(value)) || '';
      setCurrentUsername(username);
      if (result.envConfig) {
        const merged = sanitizeLocalEnvConfig({
          ...defaultEnvConfig,
          ...result.envConfig,
        });
        setConfig(merged);
        setWeeklyReportCron(merged.WEEKLY_REPORT_CRON || '0 18 * * 5');
        setWeeklyReportMinMessages(
          Number(merged.WEEKLY_REPORT_MIN_MESSAGES) || 20,
        );
        loadDreamDigestSettingsFromBackend(merged);
        loadOutreachDirectoryStatusFromBackend(merged);
        refreshOutlookCalendarStatus();
      } else {
        // 如果没有保存过配置，则尝试从 .env 加载
        loadEnvDefaults();
        refreshOutlookCalendarStatus();
      }
      },
    );
  }, []);

  // Load weekly report settings from backend when config is ready
  useEffect(() => {
    if (config.MEMORY_SERVICE_BASE_URL) {
      loadWeeklyReportSettingsFromBackend(config);
    }
  }, [config.MEMORY_SERVICE_BASE_URL, config.MEMORY_SERVICE_API_KEY]);

  useEffect(() => {
    const scrollToHashSection = () => {
      const hash = window.location.hash.replace(/^#/, '');
      const sectionMap: Record<string, HTMLDivElement | null> = {
        'outreach-config': outreachConfigSectionRef.current,
        'meeting-pilot-config': meetingPilotConfigSectionRef.current,
        'openclaw-config': openClawConfigSectionRef.current,
        'agent-executors-config': openClawConfigSectionRef.current,
        OPENCLAW_ENABLED: openClawConfigSectionRef.current,
      };
      const target = sectionMap[hash];

      if (!target) {
        return;
      }

      target.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
      setHighlightedSection(hash);
      window.setTimeout(() => {
        setHighlightedSection((current) => (current === hash ? '' : current));
      }, 2200);
    };

    scrollToHashSection();
    window.addEventListener('hashchange', scrollToHashSection);
    return () => window.removeEventListener('hashchange', scrollToHashSection);
  }, []);

  // 从.env加载默认值（通过background脚本）
  const loadEnvDefaults = async () => {
    try {
      const config = normalizeEnvConfigShape(getDefaultEnvConfig());
      setConfig(config);
      setWeeklyReportCron(config.WEEKLY_REPORT_CRON || '0 18 * * 5');
      setWeeklyReportMinMessages(
        Number(config.WEEKLY_REPORT_MIN_MESSAGES) || 20,
      );
      await loadDreamDigestSettingsFromBackend(config);
      await loadOutreachDirectoryStatusFromBackend(config);
      setStatus({
        message: '已从.env文件加载默认配置',
        type: 'success',
      });
    } catch (error) {
      console.error('加载环境配置失败:', error);
      setStatus({
        message: '加载环境配置失败',
        type: 'error',
      });
    }
  };

  const getRequestHeaders = async (
    targetConfig: EnvConfigType,
    options?: {
      accept?: string;
      contentType?: string | null;
    },
  ): Promise<Record<string, string>> => {
    const client = await createMemoryServiceClient(targetConfig);
    const headers = await client.buildAuthHeaders();
    headers.Accept = options?.accept || 'application/json';
    if (options?.contentType !== null) {
      headers['Content-Type'] = options?.contentType || 'application/json';
    }
    return headers;
  };

  const createMemoryServiceClient = async (targetConfig: EnvConfigType) => {
    const result = await chrome.storage.local.get(['userinfo']);
    const userId = result?.userinfo?.username?.trim() || 'default';
    return new MemoryServiceClient({
      baseUrl: targetConfig.MEMORY_SERVICE_BASE_URL,
      apiKey: targetConfig.MEMORY_SERVICE_API_KEY || undefined,
      timeout: targetConfig.MEMORY_SERVICE_TIMEOUT || 30_000,
      userId,
    });
  };

  const handleUiLanguageChange = async (nextLanguage: UiLanguage) => {
    await setUiLanguage(nextLanguage);
  };

  useEffect(() => {
    const baseUrl = config.MEMORY_SERVICE_BASE_URL?.trim();
    if (!currentUsername || !baseUrl) return;
    const syncKey = `${currentUsername}|${baseUrl}|${uiLanguage}`;
    if (lastLanguageSyncKeyRef.current === syncKey) return;
    lastLanguageSyncKeyRef.current = syncKey;

    void (async () => {
      try {
        const client = await createMemoryServiceClient(config);
        const result = await syncUserLanguagePreferenceProfileItem(
          uiLanguage,
          client,
        );
        if (result.operation !== 'unchanged') {
          await client.refreshKeystoneBriefLanguage();
          setStatus({
            message: '语言偏好已同步，相关简报正在后台刷新',
            type: 'success',
          });
        }
      } catch (error) {
        lastLanguageSyncKeyRef.current = '';
        console.warn('Failed to reconcile UI language with user profile:', error);
        setStatus({
          message: '界面语言已保存，但同步用户画像失败，请检查 memory-service 设置',
          type: 'error',
        });
      }
    })();
  }, [
    uiLanguage,
    currentUsername,
    config.MEMORY_SERVICE_BASE_URL,
    config.MEMORY_SERVICE_API_KEY,
  ]);

  const getRuntimeConfigFromBackend = async (
    targetConfig: EnvConfigType,
  ): Promise<RuntimeConfigResponse | null> => {
    if (!targetConfig.MEMORY_SERVICE_BASE_URL) return null;
    try {
      const client = await createMemoryServiceClient(targetConfig);
      return await client.getRuntimeConfig();
    } catch (err) {
      console.warn('Failed to load runtime config from backend:', err);
      return null;
    }
  };

  const downloadJson = (payload: unknown, filename: string) => {
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    downloadBlob(blob, filename);
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);

    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();

    URL.revokeObjectURL(url);
  };

  const loadDreamDigestSettingsFromBackend = async (
    targetConfig: EnvConfigType,
  ) => {
    if (!targetConfig.MEMORY_SERVICE_BASE_URL) return;
    try {
      const serverConfig = await getRuntimeConfigFromBackend(targetConfig);
      if (!serverConfig) return;
      const scheduleType = String(serverConfig?.dreamDigestScheduleType || '');
      const intervalDays =
        Number(serverConfig?.dreamDigestIntervalDays) ||
        (Number(serverConfig?.dreamDigestIntervalWeeks) || 0) * 7;
      const resolvedScheduleType =
        scheduleType === 'every_x_weeks' ? 'every_x_days' : scheduleType;
      setConfig((prev) => ({
        ...prev,
        DREAM_DIGEST_SCHEDULE_TYPE:
          resolvedScheduleType === 'every_x_days' ||
          resolvedScheduleType === 'monthly'
            ? resolvedScheduleType
            : prev.DREAM_DIGEST_SCHEDULE_TYPE || 'every_x_days',
        DREAM_DIGEST_INTERVAL_DAYS: Number.isFinite(intervalDays)
          ? Math.max(1, Math.floor(intervalDays))
          : prev.DREAM_DIGEST_INTERVAL_DAYS || 1,
        DREAM_INSIGHT_PUSH_TARGET: resolvePushTargetValue(
          serverConfig?.dreamDigestPushTarget,
          prev.DREAM_INSIGHT_PUSH_TARGET || 'me',
          true,
          serverConfig?.dreamDigestEnabled,
        ),
        DREAM_INSIGHT_PUSH_GROUP_ID:
          serverConfig?.dreamDigestPushGroupId ||
          prev.DREAM_INSIGHT_PUSH_GROUP_ID ||
          '',
        SELF_REFLECTION_ENABLED:
          serverConfig?.reflectionEnabled !== undefined
            ? Boolean(serverConfig.reflectionEnabled)
            : prev.SELF_REFLECTION_ENABLED,
        SELF_REFLECTION_HEARTBEAT_MINUTES: Number.isFinite(
          Number(serverConfig?.reflectionHeartbeatMinutes),
        )
          ? Math.max(
              1,
              Math.floor(Number(serverConfig.reflectionHeartbeatMinutes)),
            )
          : prev.SELF_REFLECTION_HEARTBEAT_MINUTES || 15,
        DECISION_CENTER_PUSH_TARGET: resolvePushTargetValue(
          serverConfig?.decisionCenterPushTarget,
          prev.DECISION_CENTER_PUSH_TARGET || 'me',
          false,
        ),
        DECISION_CENTER_PUSH_GROUP_ID:
          serverConfig?.decisionCenterPushGroupId ||
          prev.DECISION_CENTER_PUSH_GROUP_ID ||
          '',
        OPENCLAW_ENABLED:
          serverConfig?.openClawEnabled !== undefined
            ? Boolean(serverConfig.openClawEnabled)
            : prev.OPENCLAW_ENABLED !== false,
        OPENCLAW_BASE_URL:
          typeof serverConfig?.openClawBaseUrl === 'string'
            ? serverConfig.openClawBaseUrl
            : prev.OPENCLAW_BASE_URL,
        OPENCLAW_TIMEOUT_MS: Number.isFinite(
          Number(serverConfig?.openClawTimeoutMs),
        )
          ? Math.max(
              MIN_OPENCLAW_TIMEOUT_SECONDS * 1000,
              Math.floor(Number(serverConfig.openClawTimeoutMs)),
            )
          : prev.OPENCLAW_TIMEOUT_MS || 600000,
        OPENCLAW_API_KEY_CONFIGURED: Boolean(
          serverConfig?.openClawApiKeyConfigured,
        ),
        AGENT_EXECUTORS: Array.isArray(serverConfig?.agentExecutors)
          ? serverConfig.agentExecutors.map((item) => ({
              id: String(item.id || ''),
              label: String(item.label || item.id || ''),
              type:
                item.type === 'openclaw-gateway' ||
                item.type === 'acp-codex' ||
                item.type === 'acp-claude-code'
                  ? item.type
                  : 'openclaw-responses',
              baseUrl: item.baseUrl || '',
              apiKey: '',
              cwd: item.cwd || '',
              enabled: true,
              apiKeyConfigured: Boolean(item.apiKeyConfigured),
              clearApiKey: false,
            }))
          : prev.AGENT_EXECUTORS || [],
        EXECUTOR_DEFAULTS: {
          agent_task: serverConfig?.executorDefaults?.agent_task || '',
          reflection_research:
            serverConfig?.executorDefaults?.reflection_research || '',
        },
        OUTREACH_ENABLED:
          serverConfig?.outreachEnabled !== undefined
            ? Boolean(serverConfig.outreachEnabled)
            : prev.OUTREACH_ENABLED,
        OUTREACH_INTERVAL_MS: Number.isFinite(
          Number(serverConfig?.outreachIntervalMs),
        )
          ? Math.max(1000, Math.floor(Number(serverConfig.outreachIntervalMs)))
          : prev.OUTREACH_INTERVAL_MS || 60000,
        OUTREACH_REQUIRE_APPROVAL_FOR_REFLECTION:
          serverConfig?.outreachRequireApprovalForReflection !== undefined
            ? Boolean(serverConfig.outreachRequireApprovalForReflection)
            : prev.OUTREACH_REQUIRE_APPROVAL_FOR_REFLECTION,
        OUTREACH_REQUIRE_APPROVAL_FOR_MANUAL:
          serverConfig?.outreachRequireApprovalForManual !== undefined
            ? Boolean(serverConfig.outreachRequireApprovalForManual)
            : prev.OUTREACH_REQUIRE_APPROVAL_FOR_MANUAL,
        OUTREACH_RESULT_PUSH_TARGET: resolvePushTargetValue(
          serverConfig?.outreachResultPushTarget,
          prev.OUTREACH_RESULT_PUSH_TARGET || 'me',
          false,
        ),
        OUTREACH_RESULT_PUSH_GROUP_ID:
          serverConfig?.outreachResultPushGroupId ||
          prev.OUTREACH_RESULT_PUSH_GROUP_ID ||
          '',
        RINGCENTRAL_SERVER_URL:
          typeof serverConfig?.ringCentralServerUrl === 'string'
            ? serverConfig.ringCentralServerUrl
            : prev.RINGCENTRAL_SERVER_URL,
        RINGCENTRAL_CLIENT_ID:
          typeof serverConfig?.ringCentralClientId === 'string'
            ? serverConfig.ringCentralClientId
            : prev.RINGCENTRAL_CLIENT_ID,
        RINGCENTRAL_CLIENT_SECRET_CONFIGURED: Boolean(
          serverConfig?.ringCentralClientSecretConfigured,
        ),
        RINGCENTRAL_JWT_CONFIGURED: Boolean(
          serverConfig?.ringCentralJwtConfigured,
        ),
        BOT_API_BASE_URL:
          typeof serverConfig?.botApiBaseUrl === 'string'
            ? serverConfig.botApiBaseUrl.trim() || prev.BOT_API_BASE_URL
            : prev.BOT_API_BASE_URL,
        BOT_ID:
          typeof serverConfig?.botId === 'string'
            ? serverConfig.botId.trim() || prev.BOT_ID
            : prev.BOT_ID,
        BOT_TYPE:
          serverConfig?.botType === 'team' || serverConfig?.botType === 'user'
            ? serverConfig.botType
            : prev.BOT_TYPE,
        TEAM_ID:
          typeof serverConfig?.botTeamId === 'string'
            ? serverConfig.botTeamId
            : prev.TEAM_ID,
        BOT_TOKEN_CONFIGURED: Boolean(serverConfig?.botTokenConfigured),
      }));
    } catch (error) {
      console.warn('加载梦境重放报表配置失败:', error);
    }
  };

  const loadOutreachDirectoryStatusFromBackend = async (
    targetConfig: EnvConfigType,
  ) => {
    if (!targetConfig.MEMORY_SERVICE_BASE_URL) return;
    try {
      const client = await createMemoryServiceClient(targetConfig);
      const response = await client.getOutreachDirectoryStatus();
      setOutreachDirectoryStatus(
        Array.isArray(response?.items) ? response.items : [],
      );
    } catch (error) {
      console.warn('加载主动询问目录状态失败:', error);
      setOutreachDirectoryStatus([]);
    }
  };

  const handleRefreshOutreachDirectory = async () => {
    try {
      setOutreachDirectoryRefreshing(true);
      const client = await createMemoryServiceClient(config);
      const response = await client.syncOutreachDirectory(true);
      setOutreachDirectoryStatus(
        Array.isArray(response?.items) ? response.items : [],
      );
      setStatus({
        message: '已触发 RingCentral 目录刷新',
        type: 'success',
      });
    } catch (error) {
      console.error('刷新主动询问目录失败:', error);
      setStatus({
        message: `刷新目录失败: ${(error as Error).message}`,
        type: 'error',
      });
    } finally {
      setOutreachDirectoryRefreshing(false);
    }
  };

  const refreshOutlookCalendarStatus = async () => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'OUTLOOK_CALENDAR_STATUS',
      });
      if (response?.success && response.result) {
        setOutlookCalendarStatus(response.result);
      }
    } catch (error) {
      console.warn('Failed to load Outlook calendar status:', error);
    }
  };

  const persistConfigForCalendarAction = async (): Promise<EnvConfigType> => {
    const persistedConfig = sanitizeLocalEnvConfig(config);
    await chrome.storage.local.set({ envConfig: persistedConfig });
    await chrome.runtime.sendMessage({
      type: 'UPDATE_ENV_CONFIG',
      config: persistedConfig,
    });
    return persistedConfig;
  };

  const handleOutlookCalendarConnect = async () => {
    if (!(config.MS_OUTLOOK_CLIENT_ID || '').trim()) {
      setStatus({
        message: '连接 Outlook Calendar 前需要填写 Microsoft Outlook Client ID',
        type: 'error',
      });
      return;
    }
    setOutlookCalendarBusy(true);
    try {
      const persistedConfig = await persistConfigForCalendarAction();
      const response = await chrome.runtime.sendMessage({
        type: 'OUTLOOK_CALENDAR_CONNECT',
        config: persistedConfig,
      });
      if (!response?.success) {
        throw new Error(response?.error || 'outlook_connect_failed');
      }
      setOutlookCalendarStatus(response.result);
      setStatus({ message: 'Outlook Calendar 已连接', type: 'success' });
    } catch (error) {
      setStatus({
        message: `连接 Outlook Calendar 失败: ${(error as Error).message}`,
        type: 'error',
      });
    } finally {
      setOutlookCalendarBusy(false);
    }
  };

  const handleOutlookCalendarDisconnect = async () => {
    setOutlookCalendarBusy(true);
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'OUTLOOK_CALENDAR_DISCONNECT',
      });
      if (!response?.success) {
        throw new Error(response?.error || 'outlook_disconnect_failed');
      }
      setOutlookCalendarStatus(response.result || { connected: false });
      setStatus({ message: 'Outlook Calendar 已断开', type: 'success' });
    } catch (error) {
      setStatus({
        message: `断开 Outlook Calendar 失败: ${(error as Error).message}`,
        type: 'error',
      });
    } finally {
      setOutlookCalendarBusy(false);
    }
  };

  const handleOutlookCalendarSyncNow = async () => {
    setOutlookCalendarBusy(true);
    try {
      const persistedConfig = await persistConfigForCalendarAction();
      const response = await chrome.runtime.sendMessage({
        type: 'OUTLOOK_CALENDAR_SYNC_NOW',
        config: persistedConfig,
      });
      if (!response?.success) {
        throw new Error(response?.error || 'outlook_sync_failed');
      }
      await refreshOutlookCalendarStatus();
      const result = response.result as CalendarEventsSyncResponse | undefined;
      setStatus({
        message: result
          ? `Outlook Calendar 已同步 ${result.total} 个会议，变化 ${
              result.created + result.updated + result.cancelled + result.deleted
            }`
          : 'Outlook Calendar 已同步',
        type: 'success',
      });
    } catch (error) {
      setStatus({
        message: `同步 Outlook Calendar 失败: ${(error as Error).message}`,
        type: 'error',
      });
    } finally {
      setOutlookCalendarBusy(false);
    }
  };

  const getOutreachDirectoryScopeStatus = (scope: 'users' | 'teams') =>
    outreachDirectoryStatus.find((item) => item.scope === scope);

  const formatOutreachDirectoryScopeStatus = (scope: 'users' | 'teams') => {
    const item = getOutreachDirectoryScopeStatus(scope);
    if (!item) {
      return '未同步';
    }
    const staleText = item.stale ? '（缓存过期）' : '';
    const errorText = item.lastError ? `：${item.lastError}` : '';
    if (item.status === 'ready') {
      return `已就绪，${item.recordCount} 条${staleText}`;
    }
    if (item.status === 'syncing') {
      return `同步中，当前 ${item.recordCount} 条${staleText}`;
    }
    if (item.status === 'error') {
      return `同步失败${staleText}${errorText}`;
    }
    return `未同步${staleText}`;
  };

  // 保存配置到 Chrome 存储
  const saveConfig = async () => {
    try {
      // 验证配置：检查是否会导致消息遗漏
      if (config.MESSAGE_CONTEXT_WINDOW < config.MESSAGE_ANALYSIS_INTERVAL) {
        const confirmed = window.confirm(
          `⚠️ 警告：当前配置可能导致消息遗漏！\n\n` +
            `消息上下文窗口（${config.MESSAGE_CONTEXT_WINDOW}分钟）小于分析频度（${config.MESSAGE_ANALYSIS_INTERVAL}分钟）\n\n` +
            `建议：将上下文窗口设置为至少 ${config.MESSAGE_ANALYSIS_INTERVAL} 分钟或更大。\n\n` +
            `是否仍要保存此配置？`,
        );

        if (!confirmed) {
          setStatus({
            message: '已取消保存',
            type: 'error',
          });
          setTimeout(() => {
            setStatus({ message: '', type: '' });
          }, 3000);
          return;
        }
      }

      if (
        config.DREAM_DIGEST_SCHEDULE_TYPE === 'every_x_days' &&
        (Number(config.DREAM_DIGEST_INTERVAL_DAYS) < 1 ||
          Number.isNaN(Number(config.DREAM_DIGEST_INTERVAL_DAYS)))
      ) {
        setStatus({
          message: '梦境重放报表间隔天数必须 >= 1',
          type: 'error',
        });
        return;
      }

      if (
        Number(config.SELF_REFLECTION_HEARTBEAT_MINUTES) < 1 ||
        Number.isNaN(Number(config.SELF_REFLECTION_HEARTBEAT_MINUTES))
      ) {
        setStatus({
          message: '自我反思频率必须 >= 1 分钟',
          type: 'error',
        });
        return;
      }

      const openClawExecutor = (config.AGENT_EXECUTORS || []).find(
        (item) =>
          item.id === 'openclaw' ||
          item.type === 'openclaw-responses' ||
          item.type === 'openclaw-gateway',
      );
      const openClawBaseUrl = (
        openClawExecutor?.baseUrl ||
        config.OPENCLAW_BASE_URL ||
        ''
      ).trim();
      // External-delegation master switch (reflection/linkage only). Agent Task
      // does not require it; OpenClaw URL is required when any OpenClaw executor exists.
      if (openClawExecutor && !openClawBaseUrl) {
        setStatus({
          message: 'OpenClaw 执行器需填写 Base URL',
          type: 'error',
        });
        return;
      }

      if (
        Number(config.OPENCLAW_TIMEOUT_MS) <
          MIN_OPENCLAW_TIMEOUT_SECONDS * 1000 ||
        Number.isNaN(Number(config.OPENCLAW_TIMEOUT_MS))
      ) {
        setStatus({
          message: `OpenClaw 超时必须 >= ${MIN_OPENCLAW_TIMEOUT_SECONDS} 秒`,
          type: 'error',
        });
        return;
      }

      if (
        Number(config.OUTREACH_INTERVAL_MS) < 1000 ||
        Number.isNaN(Number(config.OUTREACH_INTERVAL_MS))
      ) {
        setStatus({
          message: '主动询问轮询间隔必须 >= 1000 毫秒',
          type: 'error',
        });
        return;
      }

      const pushTargetValidationError = validatePushTargets(config);
      if (pushTargetValidationError) {
        setStatus({
          message: pushTargetValidationError,
          type: 'error',
        });
        return;
      }

      const persistedConfig = sanitizeLocalEnvConfig(config);
      await chrome.storage.local.set({ envConfig: persistedConfig });
      // 通知background脚本更新配置
      await chrome.runtime.sendMessage({
        type: 'UPDATE_ENV_CONFIG',
        config: persistedConfig,
      });

      // 同步梦境重放/自我反思/OpenClaw配置到 memory-service 运行时配置
      const dreamInsightPushTarget = resolvePushTargetValue(
        config.DREAM_INSIGHT_PUSH_TARGET,
        'me',
        true,
      );
      const openClawApiKeyFromExecutor = (
        (config.AGENT_EXECUTORS || []).find((item) => item.id === 'openclaw')
          ?.apiKey ||
        (config.AGENT_EXECUTORS || []).find(
          (item) =>
            item.type === 'openclaw-responses' ||
            item.type === 'openclaw-gateway',
        )?.apiKey ||
        ''
      ).trim();
      const openClawApiKey =
        openClawApiKeyFromExecutor || (config.OPENCLAW_API_KEY || '').trim();
      const clearOpenClawApiKey =
        (Boolean(config.OPENCLAW_CLEAR_API_KEY) ||
          (config.AGENT_EXECUTORS || []).some(
            (item) =>
              (item.id === 'openclaw' ||
                item.type === 'openclaw-responses' ||
                item.type === 'openclaw-gateway') &&
              item.clearApiKey === true,
          )) &&
        openClawApiKey.length === 0;
      const ringCentralClientSecret = (
        config.RINGCENTRAL_CLIENT_SECRET || ''
      ).trim();
      const ringCentralJwt = (config.RINGCENTRAL_JWT || '').trim();
      const clearRingCentralClientSecret =
        Boolean(config.RINGCENTRAL_CLEAR_CLIENT_SECRET) &&
        ringCentralClientSecret.length === 0;
      const clearRingCentralJwt =
        Boolean(config.RINGCENTRAL_CLEAR_JWT) && ringCentralJwt.length === 0;
      const decisionCenterPushTarget = resolvePushTargetValue(
        config.DECISION_CENTER_PUSH_TARGET,
        'me',
        false,
      );
      const outreachResultPushTarget = resolvePushTargetValue(
        config.OUTREACH_RESULT_PUSH_TARGET,
        'me',
        false,
      );
      const botToken = (config.BOT_TOKEN || '').trim();
      const payload: UpdateRuntimeConfigPayload = {
        dreamDigestScheduleType:
          config.DREAM_DIGEST_SCHEDULE_TYPE || 'every_x_days',
        dreamDigestIntervalDays: Math.max(
          1,
          Number(config.DREAM_DIGEST_INTERVAL_DAYS) || 1,
        ),
        dreamDigestEnabled: dreamInsightPushTarget !== 'none',
        dreamDigestPushTarget: dreamInsightPushTarget,
        dreamDigestPushGroupId:
          (config.DREAM_INSIGHT_PUSH_GROUP_ID || '').trim() || undefined,
        reflectionEnabled: config.SELF_REFLECTION_ENABLED !== false,
        reflectionHeartbeatMinutes: Math.max(
          1,
          Number(config.SELF_REFLECTION_HEARTBEAT_MINUTES) || 15,
        ),
        decisionCenterPushTarget:
          decisionCenterPushTarget === 'group' ? 'group' : 'me',
        decisionCenterPushGroupId:
          (config.DECISION_CENTER_PUSH_GROUP_ID || '').trim() || undefined,
        weeklyReportEnabled:
          resolvePushTargetValue(
            config.WEEKLY_REPORT_PUSH_TARGET,
            'me',
            true,
          ) !== 'none',
        weeklyReportCron,
        weeklyReportMinMessages,
        weeklyReportPushTarget: resolvePushTargetValue(
          config.WEEKLY_REPORT_PUSH_TARGET,
          'me',
          true,
        ),
        weeklyReportPushGroupId:
          (config.WEEKLY_REPORT_PUSH_GROUP_ID || '').trim() || undefined,
        openClawEnabled: config.OPENCLAW_ENABLED !== false,
        openClawBaseUrl: (
          (config.AGENT_EXECUTORS || []).find((item) => item.id === 'openclaw')
            ?.baseUrl ||
          (config.AGENT_EXECUTORS || []).find(
            (item) =>
              item.type === 'openclaw-responses' ||
              item.type === 'openclaw-gateway',
          )?.baseUrl ||
          config.OPENCLAW_BASE_URL ||
          ''
        ).trim(),
        openClawTimeoutMs: Math.max(
          MIN_OPENCLAW_TIMEOUT_SECONDS * 1000,
          Number(config.OPENCLAW_TIMEOUT_MS) || 600000,
        ),
        clearOpenClawApiKey,
        agentExecutors: (config.AGENT_EXECUTORS || []).map((item) => ({
          id: item.id,
          label: item.label,
          type: item.type,
          baseUrl: item.baseUrl,
          cwd: item.cwd,
          enabled: true,
          clearApiKey: item.clearApiKey === true,
          ...(item.apiKey && item.apiKey.trim()
            ? { apiKey: item.apiKey.trim() }
            : {}),
        })),
        executorDefaults: {
          agent_task: config.EXECUTOR_DEFAULTS?.agent_task || '',
          reflection_research:
            config.EXECUTOR_DEFAULTS?.reflection_research || '',
        },
        outreachEnabled: config.OUTREACH_ENABLED,
        outreachIntervalMs: Math.max(
          1000,
          Number(config.OUTREACH_INTERVAL_MS) || 60000,
        ),
        outreachRequireApprovalForReflection:
          config.OUTREACH_REQUIRE_APPROVAL_FOR_REFLECTION,
        outreachRequireApprovalForManual:
          config.OUTREACH_REQUIRE_APPROVAL_FOR_MANUAL,
        outreachResultPushTarget:
          outreachResultPushTarget === 'group' ? 'group' : 'me',
        outreachResultPushGroupId:
          (config.OUTREACH_RESULT_PUSH_GROUP_ID || '').trim() || undefined,
        ringCentralServerUrl: (config.RINGCENTRAL_SERVER_URL || '').trim(),
        ringCentralClientId: (config.RINGCENTRAL_CLIENT_ID || '').trim(),
        botApiBaseUrl: (config.BOT_API_BASE_URL || '').trim(),
        botId: (config.BOT_ID || '').trim(),
        botType: config.BOT_TYPE === 'team' ? 'team' : 'user',
        botTeamId: (config.TEAM_ID || '').trim(),
        clearRingCentralClientSecret,
        clearRingCentralJwt,
      };
      if (openClawApiKey.length > 0) {
        payload.openClawApiKey = openClawApiKey;
      }
      if (ringCentralClientSecret.length > 0) {
        payload.ringCentralClientSecret = ringCentralClientSecret;
      }
      if (ringCentralJwt.length > 0) {
        payload.ringCentralJwt = ringCentralJwt;
      }
      if (botToken.length > 0) {
        payload.botToken = botToken;
      }
      const client = await createMemoryServiceClient(config);
      await client.updateRuntimeConfig(payload);
      await loadDreamDigestSettingsFromBackend(config);
      await loadOutreachDirectoryStatusFromBackend(config);
      setConfig((prev) => ({
        ...prev,
        OPENCLAW_API_KEY: '',
        OPENCLAW_CLEAR_API_KEY: false,
        OPENCLAW_API_KEY_CONFIGURED: clearOpenClawApiKey
          ? false
          : openClawApiKey.length > 0
            ? true
            : prev.OPENCLAW_API_KEY_CONFIGURED,
        RINGCENTRAL_CLIENT_SECRET: '',
        RINGCENTRAL_JWT: '',
        RINGCENTRAL_CLEAR_CLIENT_SECRET: false,
        RINGCENTRAL_CLEAR_JWT: false,
        RINGCENTRAL_CLIENT_SECRET_CONFIGURED: clearRingCentralClientSecret
          ? false
          : ringCentralClientSecret.length > 0
            ? true
            : prev.RINGCENTRAL_CLIENT_SECRET_CONFIGURED,
        RINGCENTRAL_JWT_CONFIGURED: clearRingCentralJwt
          ? false
          : ringCentralJwt.length > 0
            ? true
            : prev.RINGCENTRAL_JWT_CONFIGURED,
        BOT_TOKEN_CONFIGURED:
          botToken.length > 0 ? true : prev.BOT_TOKEN_CONFIGURED,
      }));

      setStatus({
        message: '配置已保存',
        type: 'success',
      });
      // 3秒后清除状态消息
      setTimeout(() => {
        setStatus({ message: '', type: '' });
      }, 3000);
    } catch (error) {
      console.error('保存配置失败:', error);
      setStatus({
        message: '保存配置失败',
        type: 'error',
      });
    }
  };

  const handlePushDreamDigestNow = async () => {
    const currentPushConfig = getCurrentPushTargetConfig(
      'DREAM_INSIGHT_PUSH_TARGET',
      'DREAM_INSIGHT_PUSH_GROUP_ID',
    );
    const validationError = validatePushTargets(currentPushConfig, [
      'DREAM_INSIGHT_PUSH_TARGET',
    ]);
    if (validationError) {
      const blockedTarget = resolvePushTargetValue(
        currentPushConfig.DREAM_INSIGHT_PUSH_TARGET,
        'me',
        true,
      );
      setDreamDigestPushReceipt(
        buildBlockedDigestPushReceipt(
          'dream',
          blockedTarget,
          (currentPushConfig.DREAM_INSIGHT_PUSH_GROUP_ID || '').trim(),
          validationError,
        ),
      );
      setStatus({ message: validationError, type: 'error' });
      return;
    }
    setIsDreamDigestPushing(true);
    try {
      const headers = await getRequestHeaders(config);
      const dreamInsightPushTarget = resolvePushTargetValue(
        currentPushConfig.DREAM_INSIGHT_PUSH_TARGET,
        'me',
        true,
      );
      const dreamDigestPushGroupId = (
        currentPushConfig.DREAM_INSIGHT_PUSH_GROUP_ID || ''
      ).trim();
      setDreamDigestPushReceipt(
        buildPendingDigestPushReceipt(
          'dream',
          dreamInsightPushTarget,
          dreamDigestPushGroupId,
        ),
      );
      const response = await fetch(
        `${config.MEMORY_SERVICE_BASE_URL}/dream-digest/push-now`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            force: true,
            dreamDigestPushTarget: dreamInsightPushTarget,
            dreamDigestPushGroupId: dreamDigestPushGroupId || undefined,
          }),
        },
      );
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.error || '推送失败');
      }
      setDreamDigestPushReceipt(
        buildDreamDigestPushReceipt(
          (result || {}) as Record<string, unknown>,
          dreamInsightPushTarget,
          dreamDigestPushGroupId,
        ),
      );
      if (result?.generated) {
        setStatus({
          message:
            dreamInsightPushTarget === 'none'
              ? '梦境重放报表已立即生成（当前配置为不推送）'
              : result?.botSent
                ? '梦境重放报表已立即推送（Chrome + Bot）'
                : '梦境重放报表已立即推送（Chrome 通知已写入）',
          type: 'success',
        });
      } else {
        setStatus({
          message: result?.reason || '未生成简报（可能暂无 dreams 内容）',
          type: 'error',
        });
      }
    } catch (error) {
      console.error('立即推送梦境重放报表失败:', error);
      setDreamDigestPushReceipt(
        buildDreamDigestPushReceipt(
          { generated: false },
          resolvePushTargetValue(
            currentPushConfig.DREAM_INSIGHT_PUSH_TARGET,
            'me',
            true,
          ),
          (currentPushConfig.DREAM_INSIGHT_PUSH_GROUP_ID || '').trim(),
          (error as Error).message,
        ),
      );
      setStatus({
        message: `立即推送失败: ${(error as Error).message}`,
        type: 'error',
      });
    } finally {
      setIsDreamDigestPushing(false);
    }
  };

  const handlePushWeeklyReportNow = async () => {
    const currentPushConfig = getCurrentPushTargetConfig(
      'WEEKLY_REPORT_PUSH_TARGET',
      'WEEKLY_REPORT_PUSH_GROUP_ID',
    );
    const validationError = validatePushTargets(currentPushConfig, [
      'WEEKLY_REPORT_PUSH_TARGET',
    ]);
    if (validationError) {
      const blockedTarget = resolvePushTargetValue(
        currentPushConfig.WEEKLY_REPORT_PUSH_TARGET,
        'me',
        true,
      );
      setWeeklyReportPushReceipt(
        buildBlockedDigestPushReceipt(
          'weekly',
          blockedTarget,
          (currentPushConfig.WEEKLY_REPORT_PUSH_GROUP_ID || '').trim(),
          validationError,
        ),
      );
      setStatus({ message: validationError, type: 'error' });
      return;
    }
    setIsWeeklyReportPushing(true);
    try {
      const headers = await getRequestHeaders(config);
      const weeklyReportPushTarget = resolvePushTargetValue(
        currentPushConfig.WEEKLY_REPORT_PUSH_TARGET,
        'me',
        true,
      );
      const weeklyReportPushGroupId = (
        currentPushConfig.WEEKLY_REPORT_PUSH_GROUP_ID || ''
      ).trim();
      setWeeklyReportPushReceipt(
        buildPendingDigestPushReceipt(
          'weekly',
          weeklyReportPushTarget,
          weeklyReportPushGroupId,
        ),
      );
      const response = await fetch(
        `${config.MEMORY_SERVICE_BASE_URL}/weekly-report/push-now`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            force: true,
            weeklyReportPushTarget,
            weeklyReportPushGroupId: weeklyReportPushGroupId || undefined,
          }),
        },
      );
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.error || '推送失败');
      }
      setWeeklyReportPushReceipt(
        buildWeeklyReportPushReceipt(
          (result || {}) as Record<string, unknown>,
          weeklyReportPushTarget,
          weeklyReportPushGroupId,
        ),
      );
      if (result?.generated) {
        setStatus({
          message:
            weeklyReportPushTarget === 'none'
              ? '周报已立即生成（当前配置为不推送）'
              : result?.botSent
                ? '周报已立即推送（Chrome + Bot）'
                : '周报已立即生成（Chrome 通知已写入）',
          type: 'success',
        });
      } else {
        setStatus({
          message: result?.reason || '未生成周报',
          type: 'error',
        });
      }
    } catch (error) {
      console.error('立即推送周报失败:', error);
      setWeeklyReportPushReceipt(
        buildWeeklyReportPushReceipt(
          { generated: false },
          resolvePushTargetValue(
            currentPushConfig.WEEKLY_REPORT_PUSH_TARGET,
            'me',
            true,
          ),
          (currentPushConfig.WEEKLY_REPORT_PUSH_GROUP_ID || '').trim(),
          (error as Error).message,
        ),
      );
      setStatus({
        message: `立即推送周报失败: ${(error as Error).message}`,
        type: 'error',
      });
    } finally {
      setIsWeeklyReportPushing(false);
    }
  };

  // 重置配置为默认值
  const resetConfig = () => {
    setConfig({ ...defaultEnvConfig });
    setWeeklyReportCron(defaultEnvConfig.WEEKLY_REPORT_CRON || '0 18 * * 5');
    setWeeklyReportMinMessages(
      Number(defaultEnvConfig.WEEKLY_REPORT_MIN_MESSAGES) || 20,
    );
    setStatus({
      message: '配置已重置为默认值',
      type: 'success',
    });
  };

  // 处理输入变化
  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    const { name, value, type } = e.target;

    setConfig((prev) => {
      const nextValue =
        type === 'checkbox'
          ? (e.target as HTMLInputElement).checked
          : name === 'SCHEDULED_INTERVAL' ||
              name === 'MESSAGE_ANALYSIS_INTERVAL' ||
              name === 'MESSAGE_CONTEXT_WINDOW' ||
              name === 'CONCERNED_ITEMS_DIGEST_HOUR' ||
              name === 'MEMORY_SERVICE_TIMEOUT' ||
              name === 'DREAM_DIGEST_INTERVAL_DAYS' ||
              name === 'SELF_REFLECTION_HEARTBEAT_MINUTES' ||
              name === 'OUTREACH_INTERVAL_MS'
            ? Number(value)
            : name === 'OPENCLAW_TIMEOUT_MS'
              ? Number(value) * 1000
              : value;

      const nextConfig = {
        ...prev,
        [name]: nextValue,
      } as EnvConfigType;

      if (name === 'MEETING_PILOT_ENABLED') {
        nextConfig.MEETING_FEATURE_ENABLED = Boolean(nextValue);
      }
      if (name === 'CONTEXT_ASSIST_ENABLED' && nextValue === false) {
        nextConfig.COMPOSE_ASSIST_ENABLED = false;
        nextConfig.SCENE_REHEARSAL_DISPLAY_ENABLED = false;
      }
      if (name === 'MEETING_MINUTES_API_URL') {
        nextConfig.MEETING_DIGEST_API_BASE_URL = String(nextValue || '');
      }

      return nextConfig;
    });
  };

  // 处理导入配置
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importedConfig = JSON.parse(event.target?.result as string);
        setConfig(
          sanitizeLocalEnvConfig(
            normalizeEnvConfigShape({ ...defaultEnvConfig, ...importedConfig }),
          ),
        );
        setWeeklyReportCron(
          importedConfig.WEEKLY_REPORT_CRON ||
            defaultEnvConfig.WEEKLY_REPORT_CRON ||
            '0 18 * * 5',
        );
        setWeeklyReportMinMessages(
          Number(importedConfig.WEEKLY_REPORT_MIN_MESSAGES) ||
            Number(defaultEnvConfig.WEEKLY_REPORT_MIN_MESSAGES) ||
            20,
        );
        setStatus({
          message: '配置已导入',
          type: 'success',
        });
      } catch (error) {
        console.error('导入配置失败:', error);
        setStatus({
          message: '导入配置失败，文件格式错误',
          type: 'error',
        });
      }
    };
    reader.readAsText(file);
  };

  // 处理导出配置
  const handleExport = () => {
    downloadJson(config, 'personal-ai-config.json');
  };

  const openPromptConfigPage = () => {
    const promptConfigUrl =
      typeof chrome !== 'undefined' && chrome.runtime?.getURL
        ? chrome.runtime.getURL('prompt-config.html')
        : 'prompt-config.html';
    window.open(promptConfigUrl, '_blank');
  };

  const renderPushTargetFields = (
    label: string,
    targetKey: PushTargetField,
    groupKey: PushGroupField,
    allowNone = false,
    description?: string,
  ) => {
    const targetValue = resolvePushTargetValue(
      String(config[targetKey] || ''),
      'me',
      allowNone,
    );

    return (
      <>
        <div className="form-group">
          <label htmlFor={targetKey}>{label}</label>
          <select
            id={targetKey}
            name={targetKey}
            value={targetValue}
            onChange={handleInputChange}
          >
            {allowNone && <option value="none">不推送</option>}
            <option value="me">推送给 Me（user）</option>
            <option value="group">自定义群组</option>
          </select>
          {description && (
            <small
              style={{ color: '#666', display: 'block', marginTop: '5px' }}
            >
              {description}
            </small>
          )}
        </div>
        {targetValue === 'group' && (
          <div className="form-group">
            <label htmlFor={groupKey}>{label}群组 ID</label>
            <input
              type="text"
              id={groupKey}
              name={groupKey}
              value={String(config[groupKey] || '')}
              onChange={handleInputChange}
              placeholder="输入 RingCentral 群组 ID"
            />
            <small
              style={{ color: '#666', display: 'block', marginTop: '5px' }}
            >
              仅在选择「自定义群组」时生效。配置后，该群组会自动从消息分析输入中排除，避免推送回流导致重复分析。
            </small>
          </div>
        )}
      </>
    );
  };

  return (
    <div>
      <div className="form-section">
        <h2>{t('options.sections.language')}</h2>
        <div className="form-group">
          <label htmlFor="ui-language">{t('language.label')}</label>
          <select
            id="ui-language"
            value={uiLanguage}
            onChange={(event) => {
              void handleUiLanguageChange(event.target.value as UiLanguage);
            }}
          >
            <option value="zh-CN">{t('language.zhCN')}</option>
            <option value="en-US">{t('language.enUS')}</option>
          </select>
          <small
            style={{ color: '#666', display: 'block', marginTop: '5px' }}
          >
            {t('options.language.description')}
          </small>
        </div>
      </div>

      <div className="form-section prompt-config-entry-section">
        <h2>{t('options.sections.promptConfig')}</h2>
        <small className="prompt-config-entry-copy">
          {t('options.promptConfig.description')}
        </small>
        <div className="prompt-config-entry-actions">
          <button
            type="button"
            className="prompt-config-open-btn"
            onClick={openPromptConfigPage}
          >
            {t('options.promptConfig.open')}
          </button>
          <span>{t('options.promptConfig.receipt')}</span>
        </div>
      </div>

      <div className="form-section">
        <h2>{t('options.sections.demo')}</h2>
        <div
          className="quick-access-buttons"
          style={{
            display: 'flex',
            gap: '10px',
            flexWrap: 'wrap',
            marginBottom: '15px',
          }}
        >
          <button
            onClick={() =>
              window.open(
                'http://eexx.me/Personal-AI/demo/%E5%AE%9E%E4%BD%93%E8%AE%B0%E5%BF%86%E6%9F%A5%E8%AF%A2%E7%95%8C%E9%9D%A2.html',
                '_blank',
              )
            }
            style={{
              backgroundColor: '#667eea',
              color: 'white',
              padding: '10px 20px',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold',
            }}
          >
            🧠 实体记忆查询
          </button>
          <button
            onClick={() =>
              window.open(
                'http://eexx.me/Personal-AI/demo/项目进展图-缩放版.html',
                '_blank',
              )
            }
            style={{
              backgroundColor: '#2ecc71',
              color: 'white',
              padding: '10px 20px',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold',
            }}
          >
            📊 项目进展图
          </button>
          <button
            onClick={() =>
              window.open(
                'http://eexx.me/Personal-AI/demo/%E7%94%A8%E9%87%8F%E5%88%86%E6%9E%90-%E4%BD%BF%E7%94%A8%E8%A7%86%E8%A7%92.html',
                '_blank',
              )
            }
            style={{
              backgroundColor: '#0ea5e9',
              color: 'white',
              padding: '10px 20px',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold',
            }}
          >
            📈 用量分析（使用视角 Demo）
          </button>
          <button
            onClick={() =>
              window.open(
                'http://eexx.me/Personal-AI/demo/%E5%AE%9A%E6%97%B6%E6%B6%88%E6%81%AF-%E5%BE%85%E5%8F%91%E9%80%81%E5%8A%A8%E7%94%BB.html',
                '_blank',
              )
            }
            style={{
              backgroundColor: '#f59e0b',
              color: 'white',
              padding: '10px 20px',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold',
            }}
          >
            ⏱ 定时消息（待发送动画）
          </button>
          <button
            type="button"
            onClick={() => {
              const url =
                typeof chrome !== 'undefined' && chrome.runtime?.getURL
                  ? chrome.runtime.getURL('help-demos/roadmap-demo.html')
                  : 'docs/demo/roadmap-demo.html';
              window.open(url, '_blank');
            }}
            style={{
              backgroundColor: '#20242A',
              color: 'white',
              padding: '10px 20px',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold',
            }}
            title="纯静态 Personal Roadmap 原型（无真实 Jira / 扩展调用）"
          >
            🗺 项目 Roadmap（静态 Demo）
          </button>
          <button
            type="button"
            onClick={async () => {
              try {
                const base = String(config.MEMORY_SERVICE_BASE_URL || '')
                  .trim()
                  .replace(/\/+$/, '');
                if (!base) {
                  setStatus({
                    message: '请先填写记忆服务 API 地址',
                    type: 'error',
                  });
                  return;
                }
                const client = await createMemoryServiceClient(config);
                const link = await client.createUsageMyLink();
                window.open(
                  `${base}${link.path}`,
                  '_blank',
                  'noopener',
                );
              } catch (error) {
                setStatus({
                  message:
                    error instanceof Error
                      ? `打开我的用量报表失败: ${error.message}`
                      : '打开我的用量报表失败',
                  type: 'error',
                });
              }
            }}
            style={{
              backgroundColor: '#0ea5e9',
              color: 'white',
              padding: '10px 20px',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold',
            }}
          >
            📊 打开我的用量报表
          </button>
          {currentUsername.toLowerCase() === 'esone.qiu' && (
            <button
              type="button"
              onClick={() => {
                const base = String(config.MEMORY_SERVICE_BASE_URL || '')
                  .trim()
                  .replace(/\/+$/, '');
                if (!base) {
                  setStatus({
                    message: '请先填写记忆服务 API 地址',
                    type: 'error',
                  });
                  return;
                }
                const token = String(
                  config.ANALYTICS_ADMIN_TOKEN || 'esone',
                ).trim();
                window.open(
                  `${base}/usage/dashboard?token=${encodeURIComponent(token)}`,
                  '_blank',
                  'noopener',
                );
              }}
              style={{
                backgroundColor: '#6366f1',
                color: 'white',
                padding: '10px 20px',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 'bold',
              }}
            >
              📊 打开全体用量报表（Admin）
            </button>
          )}
        </div>
      </div>

      <div className="form-section">
        <h2>{t('options.sections.messageAnalysis')}</h2>
        <small
          style={{ color: '#666', display: 'block', marginBottom: '15px' }}
        >
          配置消息分析频度、过滤规则，以及命中关注项后的推送位置。
        </small>
        <div className="form-group">
          <label htmlFor="MESSAGE_ANALYSIS_INTERVAL">
            消息分析频度（分钟）
          </label>
          <input
            type="number"
            id="MESSAGE_ANALYSIS_INTERVAL"
            name="MESSAGE_ANALYSIS_INTERVAL"
            value={config.MESSAGE_ANALYSIS_INTERVAL}
            onChange={(e) => {
              const numValue = Number(e.target.value);
              setConfig((prev) => ({
                ...prev,
                MESSAGE_ANALYSIS_INTERVAL: numValue,
              }));

              // 检查是否会导致消息遗漏
              if (numValue > config.MESSAGE_CONTEXT_WINDOW) {
                setStatus({
                  message:
                    '⚠️ 警告：消息上下文窗口小于分析频度，可能会遗漏消息！建议将上下文窗口设置为大于等于分析频度。',
                  type: 'error',
                });
                setTimeout(() => {
                  setStatus({ message: '', type: '' });
                }, 8000);
              }
            }}
            min="1"
          />
          <small style={{ color: '#666', display: 'block', marginTop: '5px' }}>
            每隔多久执行一次消息分析（默认: 120分钟）
          </small>
        </div>

        <div className="form-group">
          <label htmlFor="MESSAGE_CONTEXT_WINDOW">消息上下文窗口（分钟）</label>
          <input
            type="number"
            id="MESSAGE_CONTEXT_WINDOW"
            name="MESSAGE_CONTEXT_WINDOW"
            value={config.MESSAGE_CONTEXT_WINDOW}
            onChange={(e) => {
              const numValue = Number(e.target.value);
              setConfig((prev) => ({
                ...prev,
                MESSAGE_CONTEXT_WINDOW: numValue,
              }));

              // 检查是否会导致消息遗漏
              if (numValue < config.MESSAGE_ANALYSIS_INTERVAL) {
                setStatus({
                  message:
                    '⚠️ 警告：消息上下文窗口小于分析频度，可能会遗漏消息！建议将上下文窗口设置为大于等于分析频度。',
                  type: 'error',
                });
                setTimeout(() => {
                  setStatus({ message: '', type: '' });
                }, 8000);
              }
            }}
            min="1"
          />
          <small style={{ color: '#666', display: 'block', marginTop: '5px' }}>
            每次分析时获取距离此刻的历史消息时间范围（默认: 125分钟）
          </small>
          {config.MESSAGE_CONTEXT_WINDOW < config.MESSAGE_ANALYSIS_INTERVAL && (
            <small
              style={{
                color: '#d32f2f',
                display: 'block',
                marginTop: '5px',
                fontWeight: 'bold',
              }}
            >
              ⚠️ 当前设置可能导致消息遗漏！上下文窗口（
              {config.MESSAGE_CONTEXT_WINDOW}分钟）小于分析频度（
              {config.MESSAGE_ANALYSIS_INTERVAL}分钟）
            </small>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="ANALYSIS_TYPE">分析系统类型</label>
          <select
            id="ANALYSIS_TYPE"
            name="ANALYSIS_TYPE"
            value={config.ANALYSIS_TYPE}
            onChange={handleInputChange}
          >
            <option value="filter">根据关注列表直接过滤</option>
            <option value="agentWorkflow">
              标准Agent工作流（按流程分析消息中的实体、关系，自动判断消息重要性）
            </option>
            <option value="agentThinking">
              智能Agent思考（具有独立思考能力，按需调用工具分析消息）
            </option>
          </select>
        </div>

        <ToggleField
          id="ANALYZE_BY_GROUP"
          name="ANALYZE_BY_GROUP"
          checked={config.ANALYZE_BY_GROUP}
          onChange={handleInputChange}
          label="拆开每个群组独立分析"
          description="开启后，不同群组的消息会分别进入独立分析流程。"
        />

        {config.ANALYSIS_TYPE !== 'agentThinking' &&
          config.ANALYSIS_TYPE !== 'agentWorkflow' && (
            <ToggleField
              id="LLM_REVIEW_BEFORE_SEND"
              name="LLM_REVIEW_BEFORE_SEND"
              checked={config.LLM_REVIEW_BEFORE_SEND}
              onChange={handleInputChange}
              label="启用消息审核"
              description="关闭后，会直接推送所有命中关注项的消息。"
            />
          )}

        {renderPushTargetFields(
          '消息分析推送',
          'MESSAGE_ANALYSIS_PUSH_TARGET',
          'MESSAGE_ANALYSIS_PUSH_GROUP_ID',
          false,
          '命中关注项后的即时提醒。Bot Key 和 Base URL 从 env 读取。',
        )}
        <div className="form-group">
          <label htmlFor="CONCERNED_ITEMS_DIGEST_HOUR">
            ConcernedItems 摘要推送时间（小时）
          </label>
          <input
            type="number"
            id="CONCERNED_ITEMS_DIGEST_HOUR"
            name="CONCERNED_ITEMS_DIGEST_HOUR"
            value={normalizeConcernedItemsDigestHour(
              config.CONCERNED_ITEMS_DIGEST_HOUR,
              8,
            )}
            onChange={(e) => {
              const value = normalizeConcernedItemsDigestHour(
                e.target.value,
                8,
              );
              setConfig((prev) => ({
                ...prev,
                CONCERNED_ITEMS_DIGEST_HOUR: value,
              }));
            }}
            min="0"
            max="23"
            step="1"
          />
          <small style={{ color: '#666', display: 'block', marginTop: '5px' }}>
            仅影响在 concerned item 中启用了「使用定时摘要推送」的规则。默认每天
            8:00 左右汇总推送。
          </small>
        </div>

        <ToggleField
          id="FILTER_OWN_MESSAGES"
          name="FILTER_OWN_MESSAGES"
          checked={config.FILTER_OWN_MESSAGES}
          onChange={handleInputChange}
          label="过滤自己发送的消息"
          description="开启后，消息分析会自动忽略自己发出的消息。"
        />
        <ToggleField
          id="OWNER_SPEECH_LEARNING_ENABLED"
          name="OWNER_SPEECH_LEARNING_ENABLED"
          checked={config.OWNER_SPEECH_LEARNING_ENABLED}
          onChange={handleInputChange}
          label="自动学习我的发言以优化输入建议"
          description="只用于学习你的表达习惯和上下文偏好；不改变外部消息监控、过滤和通知规则。"
        />
      </div>

      <div className="form-section">
        <h2>{t('options.sections.messageInteraction')}</h2>
        <p style={{ color: '#666', fontSize: '13px', marginBottom: '15px' }}>
          在 RingCentral
          消息页面，悬停在消息上时会显示交互工具栏。可以选择启用/禁用以下功能：
        </p>
        <ToggleField
          id="ENABLE_SNOOZE"
          name="ENABLE_SNOOZE"
          checked={config.ENABLE_SNOOZE}
          onChange={handleInputChange}
          label="启用「稍后处理」功能"
          description="设置提醒时间，到时 Bot 会推送消息提醒您。"
        />
        <ToggleField
          id="ENABLE_FOLLOW_THREAD"
          name="ENABLE_FOLLOW_THREAD"
          checked={config.ENABLE_FOLLOW_THREAD}
          onChange={handleInputChange}
          label="启用「关注后续」功能"
          description="围绕当前消息快速创建关注后续规则，持续追踪后续讨论。"
        />
        {renderPushTargetFields(
          '关注后续推送',
          'FOLLOW_UP_PUSH_TARGET',
          'FOLLOW_UP_PUSH_GROUP_ID',
          false,
          '关注后续汇总和相关提醒的推送位置。默认推送给 Me。',
        )}
        <ToggleField
          id="ENABLE_AUTO_REPLY"
          name="ENABLE_AUTO_REPLY"
          checked={config.ENABLE_AUTO_REPLY}
          onChange={handleInputChange}
          label="启用「自动答复」功能"
          description="配置自动答复规则，匹配消息时自动发送回复。"
        />
        <ToggleField
          id="ENABLE_LINKED_ACTION"
          name="ENABLE_LINKED_ACTION"
          checked={config.ENABLE_LINKED_ACTION}
          onChange={handleInputChange}
          label="启用「联动操作」功能"
          description="从消息快速创建带联动操作的记忆入口规则。"
        />
      </div>

      <div className="form-section">
        <h2>{t('options.sections.memoryService')}</h2>
        <div className="form-group">
          <label htmlFor="MEMORY_SERVICE_BASE_URL">记忆服务 API 地址</label>
          <input
            type="url"
            id="MEMORY_SERVICE_BASE_URL"
            name="MEMORY_SERVICE_BASE_URL"
            value={config.MEMORY_SERVICE_BASE_URL}
            onChange={handleInputChange}
            placeholder={defaultEnvConfig.MEMORY_SERVICE_BASE_URL}
          />
          <small style={{ color: '#666', display: 'block', marginTop: '5px' }}>
            记忆系统后端地址，需包含 /api/v1 路径。未保存时使用当前构建默认值：
            {defaultEnvConfig.MEMORY_SERVICE_BASE_URL}
            。想私有部署？见{' '}
            <a
              href="https://github.com/ee01/Personal-AI/blob/develop/docs/self-hosting-memory-service.md"
              target="_blank"
              rel="noreferrer"
            >
              自托管指引
            </a>
            。
          </small>
        </div>
        <div className="form-group">
          <label htmlFor="MEMORY_SERVICE_BOOTSTRAP_KEY">
            Bootstrap 密钥（签发用，可选）
          </label>
          <input
            type="password"
            id="MEMORY_SERVICE_BOOTSTRAP_KEY"
            name="MEMORY_SERVICE_BOOTSTRAP_KEY"
            value={config.MEMORY_SERVICE_BOOTSTRAP_KEY || ''}
            onChange={handleInputChange}
            placeholder="后端 BOOTSTRAP_API_KEY；构建默认也可注入"
          />
          <small style={{ color: '#666', display: 'block', marginTop: '5px' }}>
            只能签发个人设备 key，不能直接读写记忆。公共服务器通常由构建注入；自托管时与
            服务端 <code>BOOTSTRAP_API_KEY</code> 保持一致。
          </small>
        </div>
        <div className="form-group">
          <label>本机设备 key（个人凭证）</label>
          <input
            type="text"
            value={
              personalApiKey
                ? `${personalApiKey.keyPrefix}…（绑定 ${personalApiKey.userId}）`
                : '尚未签发（首次访问记忆服务时自动生成）'
            }
            readOnly
            style={{ background: '#f5f5f5', color: '#666' }}
          />
          <small style={{ color: '#666', display: 'block', marginTop: '5px' }}>
            每台设备各自签发；换浏览器会自动再签一把。管理全部设备 / 外接工具
            key：打开「帮助中心 → 记忆外接」。
          </small>
        </div>
        <div className="form-group">
          <label htmlFor="MEMORY_SERVICE_TIMEOUT">请求超时（毫秒）</label>
          <input
            type="number"
            id="MEMORY_SERVICE_TIMEOUT"
            name="MEMORY_SERVICE_TIMEOUT"
            value={config.MEMORY_SERVICE_TIMEOUT || 30000}
            onChange={handleInputChange}
            min="1000"
            step="1000"
          />
          <small style={{ color: '#666', display: 'block', marginTop: '5px' }}>
            对 ask 等长耗时接口建议 {'>='} 60000。保存后会写入扩展配置。
          </small>
        </div>
        {currentUsername.toLowerCase() === 'esone.qiu' && (
          <div className="form-group">
            <label htmlFor="ANALYTICS_ADMIN_TOKEN">用量分析 Admin Token</label>
            <input
              type="password"
              id="ANALYTICS_ADMIN_TOKEN"
              name="ANALYTICS_ADMIN_TOKEN"
              value={config.ANALYTICS_ADMIN_TOKEN || ''}
              onChange={handleInputChange}
              placeholder="与 memory-service ANALYTICS_ADMIN_TOKEN 一致"
            />
            <small style={{ color: '#666', display: 'block', marginTop: '5px' }}>
              仅 esone.qiu 可见。用于打开用量分析报表；默认可用 esone（与当前远端配置一致）。
            </small>
            <button
              type="button"
              style={{ marginTop: '10px' }}
              onClick={() => {
                const base = String(config.MEMORY_SERVICE_BASE_URL || '')
                  .trim()
                  .replace(/\/+$/, '');
                if (!base) {
                  setStatus({
                    message: '请先填写记忆服务 API 地址',
                    type: 'error',
                  });
                  return;
                }
                const token = String(
                  config.ANALYTICS_ADMIN_TOKEN || 'esone',
                ).trim();
                const url = `${base}/usage/dashboard?token=${encodeURIComponent(
                  token,
                )}`;
                window.open(url, '_blank', 'noopener');
              }}
            >
              打开用量分析报表
            </button>
            <button
              type="button"
              style={{ marginTop: '10px', marginLeft: '8px' }}
              onClick={async () => {
                try {
                  const response = await chrome.runtime.sendMessage({
                    type: 'FLUSH_USAGE_TELEMETRY',
                  });
                  const diag = response?.diagnostics;
                  if (!response?.success) {
                    setStatus({
                      message: `用量上报失败：${
                        response?.error ||
                        diag?.lastFlushError ||
                        '未知错误'
                      }（缓冲 ${diag?.bufferSize ?? '?'} 条）`,
                      type: 'error',
                    });
                    return;
                  }
                  setStatus({
                    message: `用量上报成功：本次 ${
                      diag?.lastFlushIngested ?? 0
                    } 条，剩余缓冲 ${diag?.bufferSize ?? 0} 条`,
                    type: 'success',
                  });
                } catch (error: any) {
                  setStatus({
                    message: `用量自检失败：${error?.message || String(error)}`,
                    type: 'error',
                  });
                }
              }}
            >
              立即上报并自检
            </button>
          </div>
        )}
        <h3 style={{ margin: '16px 0 10px' }}>自我反思 / 场景预演生产</h3>
        <ToggleField
          id="SELF_REFLECTION_ENABLED"
          name="SELF_REFLECTION_ENABLED"
          checked={config.SELF_REFLECTION_ENABLED !== false}
          onChange={handleInputChange}
          label="启用自我反思（场景预演生产总开关）"
          description="默认开启。关闭后不会自动推进 Reflection，也不会从 Reflection 生成新的场景预演候选；已存在的场景预演和梦境重放不受影响。"
        />
        <div className="form-group">
          <label htmlFor="SELF_REFLECTION_HEARTBEAT_MINUTES">
            自我反思频率（分钟）
          </label>
          <input
            type="number"
            id="SELF_REFLECTION_HEARTBEAT_MINUTES"
            name="SELF_REFLECTION_HEARTBEAT_MINUTES"
            value={config.SELF_REFLECTION_HEARTBEAT_MINUTES || 15}
            onChange={handleInputChange}
            min="1"
            step="1"
            disabled={config.SELF_REFLECTION_ENABLED === false}
          />
          <small style={{ color: '#666', display: 'block', marginTop: '5px' }}>
            保存后会同步到 memory-service，按用户分别生效。
          </small>
        </div>
        {renderPushTargetFields(
          '决策中心推送',
          'DECISION_CENTER_PUSH_TARGET',
          'DECISION_CENTER_PUSH_GROUP_ID',
          false,
          '用于冲突/待确认类的决策中心提醒。默认推送给 Me。',
        )}
        {renderPushTargetFields(
          '梦境重放报表推送',
          'DREAM_INSIGHT_PUSH_TARGET',
          'DREAM_INSIGHT_PUSH_GROUP_ID',
          true,
          '梦境重放会持续运行；这里仅控制报表推送到 Me、自定义群组，或完全不推送。',
        )}
        <div className="form-group">
          <label htmlFor="DREAM_DIGEST_SCHEDULE_TYPE">
            梦境重放报表推送频率
          </label>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              flexWrap: 'wrap',
            }}
          >
            <select
              id="DREAM_DIGEST_SCHEDULE_TYPE"
              name="DREAM_DIGEST_SCHEDULE_TYPE"
              value={config.DREAM_DIGEST_SCHEDULE_TYPE || 'every_x_days'}
              onChange={handleInputChange}
            >
              <option value="every_x_days">每天 / 每隔 X 天</option>
              <option value="weekly">每周</option>
              <option value="monthly">每月</option>
            </select>
            {config.DREAM_DIGEST_SCHEDULE_TYPE === 'every_x_days' && (
              <>
                <span>每隔</span>
                <input
                  type="number"
                  id="DREAM_DIGEST_INTERVAL_DAYS"
                  name="DREAM_DIGEST_INTERVAL_DAYS"
                  value={config.DREAM_DIGEST_INTERVAL_DAYS || 1}
                  onChange={handleInputChange}
                  min="1"
                  style={{ width: '80px' }}
                />
                <span>天</span>
              </>
            )}
            <button
              type="button"
              onClick={handlePushDreamDigestNow}
              disabled={isDreamDigestPushing}
            >
              {isDreamDigestPushing ? '推送中...' : '立即推送'}
            </button>
          </div>
          <small style={{ color: '#666', display: 'block', marginTop: '5px' }}>
            点击「保存配置」后会同步到
            memory-service。选择「不推送」时只会关闭报表推送，不会停止梦境重放本身；点击「立即推送」会跳过时间窗口，直接触发
            Dream Digest。
          </small>
          {renderDigestManualPushReceipt(dreamDigestPushReceipt)}
        </div>
      </div>

      <div className="form-section" id="roadmap-config">
        <h2>{t('options.sections.roadmap')}</h2>
        <div className="form-group">
          <label htmlFor="ROADMAP_BASE_URL">项目 Roadmap 站点地址</label>
          <input
            type="url"
            id="ROADMAP_BASE_URL"
            name="ROADMAP_BASE_URL"
            value={config.ROADMAP_BASE_URL || ''}
            onChange={handleInputChange}
            placeholder="http://roadmap.xmnup.com"
          />
          <small style={{ color: '#666', display: 'block', marginTop: '5px' }}>
            Personal Roadmap 可视化站点，默认 http://roadmap.xmnup.com。Popup「项目
            Roadmap」会打开此地址；留空则跳转到本配置项。已安装扩展时，打开站点会自动带入
            Glip 身份，无需再手动输入名字。自定义域名会在保存后动态注入桥接脚本；改完请刷新
            Roadmap 页。
          </small>
        </div>
      </div>

      <div
        id="meeting-pilot-config"
        ref={meetingPilotConfigSectionRef}
        className="form-section"
        style={
          highlightedSection === 'meeting-pilot-config'
            ? {
                scrollMarginTop: '16px',
                boxShadow: '0 0 0 3px rgba(14, 165, 233, 0.22)',
                borderRadius: '12px',
                transition: 'box-shadow 0.25s ease',
              }
            : {
                scrollMarginTop: '16px',
                transition: 'box-shadow 0.25s ease',
              }
        }
      >
        <h2>{t('options.sections.meetingPilot')}</h2>
        <small
          style={{ color: '#666', display: 'block', marginBottom: '15px' }}
        >
          这里是会议弹幕的唯一核心配置入口：ASR / 转写 Provider、 Minutes
          API、分析模型与密钥都在这里维护；side panel
          只保留会中体验和个性化设置。建议配置转写能力，用于实时 transcript，
          并提升摘要、行动项和决议提取准确度； Minutes API 可选，主要用于会后
          PDF 纪要。
        </small>
        <ToggleField
          id="MEETING_PILOT_ENABLED"
          name="MEETING_PILOT_ENABLED"
          checked={config.MEETING_PILOT_ENABLED === true}
          onChange={handleInputChange}
          label="每次会议默认开启会议弹幕"
          description="关闭后不会在会议页默认注入悬浮入口；仍可从扩展 popup 点击“开启会议弹幕”，对当前会议单次启用。"
        />
        <ToggleField
          id="MEETING_PILOT_FLOATING_ICON_VISIBLE"
          name="MEETING_PILOT_FLOATING_ICON_VISIBLE"
          checked={config.MEETING_PILOT_FLOATING_ICON_VISIBLE !== false}
          onChange={handleInputChange}
          label="显示会议页右下角悬浮入口"
          description="悬浮 icon hover 3 秒后会出现小 x，可隐藏当前页面入口或选择永不展示；如果选过“永不展示”，可以在这里重新打开。关闭后仅隐藏会议页悬浮入口与浮层提醒，不会停用 popup 单次会议弹幕。"
          disabled={config.MEETING_PILOT_ENABLED !== true}
        />
        <ToggleField
          id="MEETING_NATIVE_CLIENT_JOIN_ENABLED"
          name="MEETING_NATIVE_CLIENT_JOIN_ENABLED"
          checked={config.MEETING_NATIVE_CLIENT_JOIN_ENABLED !== false}
          onChange={handleInputChange}
          label="优先用 RingCentral app 加会"
          description="开启后会拦截 RingCentral Web 中的 Video Join 链接和部分 Join 按钮，改用本机 RingCentral app 打开会议；若 app 没有接管，页面会保留浏览器加入兜底，也可在兜底浮层里改为默认使用浏览器。"
        />
        {config.MEETING_PILOT_ENABLED === true &&
        config.MEETING_PILOT_FLOATING_ICON_VISIBLE === false ? (
          <small
            style={{ color: '#b45309', display: 'block', marginBottom: '15px' }}
          >
            当前会议页面悬浮入口已设为永不展示。重新打开这个开关后，右下角
            icon 会恢复显示。
          </small>
        ) : null}
        <div
          className="form-group"
          style={{
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            padding: '14px',
            marginTop: '14px',
            marginBottom: '18px',
            background: '#fbfdff',
          }}
        >
          <h3 style={{ margin: '0 0 10px' }}>
            {t('options.sections.contextAssist')}
          </h3>
          <small style={{ color: '#666', display: 'block', marginBottom: 12 }}>
            在 RingCentral Video Home 的会议详情右侧显示 Personal AI
            会前准备；Outlook 未授权时会使用 RingCentral 本地 Calendar IndexedDB
            的轻量会议元数据做静默同步。
          </small>
          <ToggleField
            id="CONTEXT_ASSIST_ENABLED"
            name="CONTEXT_ASSIST_ENABLED"
            checked={config.CONTEXT_ASSIST_ENABLED !== false}
            onChange={handleInputChange}
            label="启用 Context Assist"
            description="统一启用会前准备和写作护航的场景化记忆提示。"
          />
          <ToggleField
            id="SCENE_REHEARSAL_DISPLAY_ENABLED"
            name="SCENE_REHEARSAL_DISPLAY_ENABLED"
            checked={
              config.CONTEXT_ASSIST_ENABLED !== false &&
              config.SCENE_REHEARSAL_DISPLAY_ENABLED !== false
            }
            onChange={handleInputChange}
            label="显示场景预演提醒"
            description="在写作护航、Memory Lens、会议和会前准备中显示 Rehearsal/场景预演提示；关闭后仍保留预演数据和自我反思候选生成。"
            disabled={config.CONTEXT_ASSIST_ENABLED === false}
          />
          <ToggleField
            id="COMPOSE_ASSIST_ENABLED"
            name="COMPOSE_ASSIST_ENABLED"
            checked={
              config.CONTEXT_ASSIST_ENABLED !== false &&
              config.COMPOSE_ASSIST_ENABLED !== false
            }
            onChange={handleInputChange}
            label="启用写作护航"
            description="在支持的消息、Jira 和网页 AI 输入框旁显示可预览、可插入的 Personal AI 建议。"
            disabled={config.CONTEXT_ASSIST_ENABLED === false}
          />
          <ToggleField
            id="MEETING_PREP_ENABLED"
            name="MEETING_PREP_ENABLED"
            checked={config.MEETING_PREP_ENABLED !== false}
            onChange={handleInputChange}
            label="启用会前准备"
            description="在 RingCentral Video Home 的选中会议详情区注入会前准备卡片。"
            disabled={config.CONTEXT_ASSIST_ENABLED === false}
          />
          <div className="form-group">
            <label htmlFor="MEETING_PREP_CALENDAR_SOURCE">Calendar Source</label>
            <select
              id="MEETING_PREP_CALENDAR_SOURCE"
              name="MEETING_PREP_CALENDAR_SOURCE"
              value={config.MEETING_PREP_CALENDAR_SOURCE || 'auto'}
              onChange={handleInputChange}
              disabled={
                config.CONTEXT_ASSIST_ENABLED === false ||
                config.MEETING_PREP_ENABLED === false
              }
            >
              <option value="auto">Auto：Outlook 优先，RingCentral 本地兜底</option>
              <option value="outlook">Microsoft Outlook Calendar</option>
              <option value="ringcentral_indexeddb">
                RingCentral IndexedDB fallback
              </option>
            </select>
          </div>
          {config.MEETING_PREP_CALENDAR_SOURCE !== 'ringcentral_indexeddb' ? (
            <>
              <div className="form-group">
                <label htmlFor="MS_OUTLOOK_CLIENT_ID">
                  Microsoft Outlook Client ID
                </label>
                <input
                  type="text"
                  id="MS_OUTLOOK_CLIENT_ID"
                  name="MS_OUTLOOK_CLIENT_ID"
                  value={config.MS_OUTLOOK_CLIENT_ID || ''}
                  onChange={handleInputChange}
                  placeholder="Azure App Registration client id"
                  disabled={
                    config.CONTEXT_ASSIST_ENABLED === false ||
                    config.MEETING_PREP_ENABLED === false
                  }
                />
              </div>
              <div className="form-group">
                <label htmlFor="MS_OUTLOOK_TENANT_ID">
                  Microsoft Tenant ID
                </label>
                <input
                  type="text"
                  id="MS_OUTLOOK_TENANT_ID"
                  name="MS_OUTLOOK_TENANT_ID"
                  value={config.MS_OUTLOOK_TENANT_ID || 'common'}
                  onChange={handleInputChange}
                  placeholder="common / organizations / tenant id"
                  disabled={
                    config.CONTEXT_ASSIST_ENABLED === false ||
                    config.MEETING_PREP_ENABLED === false
                  }
                />
                <small
                  style={{ color: '#666', display: 'block', marginTop: '5px' }}
                >
                  Redirect URI：
                  {chrome.identity.getRedirectURL('outlook-calendar')}
                </small>
              </div>
              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  flexWrap: 'wrap',
                  alignItems: 'center',
                }}
              >
                <button
                  type="button"
                  onClick={handleOutlookCalendarConnect}
                  disabled={outlookCalendarBusy}
                >
                  {outlookCalendarStatus.connected
                    ? '重新授权 Outlook'
                    : '授权 Outlook Calendar'}
                </button>
                <button
                  type="button"
                  onClick={handleOutlookCalendarSyncNow}
                  disabled={outlookCalendarBusy || !outlookCalendarStatus.connected}
                >
                  立即同步
                </button>
                <button
                  type="button"
                  onClick={handleOutlookCalendarDisconnect}
                  disabled={outlookCalendarBusy || !outlookCalendarStatus.connected}
                >
                  断开
                </button>
              </div>
              <small
                style={{ color: '#666', display: 'block', marginTop: '8px' }}
              >
                {outlookCalendarStatus.connected
                  ? `已连接 ${
                      outlookCalendarStatus.account?.displayName ||
                      outlookCalendarStatus.account?.userPrincipalName ||
                      'Outlook account'
                    }${
                      outlookCalendarStatus.lastSyncAt
                        ? ` · 上次同步 ${new Date(
                            outlookCalendarStatus.lastSyncAt,
                          ).toLocaleString()}`
                        : ''
                    }`
                  : '未连接 Outlook；Video Home 页面会自动使用 RingCentral 本地会议元数据。'}
              </small>
            </>
          ) : (
            <small style={{ color: '#666', display: 'block' }}>
              当前仅使用 RingCentral IndexedDB fallback。同步会在 Video Home 页面打开时静默发生。
            </small>
          )}
        </div>
        <div className="form-group">
          <label htmlFor="MEETING_TRANSCRIPTION_MODE">Transcription Mode</label>
          <select
            id="MEETING_TRANSCRIPTION_MODE"
            name="MEETING_TRANSCRIPTION_MODE"
            value={config.MEETING_TRANSCRIPTION_MODE || 'auto'}
            onChange={handleInputChange}
            disabled={config.MEETING_PILOT_ENABLED !== true}
          >
            <option value="auto">Auto (local first)</option>
            <option value="local-only">Local only</option>
            <option value="cloud-only">Cloud only</option>
          </select>
          <small style={{ color: '#666', display: 'block', marginTop: '5px' }}>
            Auto: 先尝试读取 RingCentral 自带 Transcript；如果不可用，再尝试
            Personal AI desktop app 的 Local ASR，然后回退 cloud。Chrome Web
            Speech on-device 只在 Local only 中作为实验性本地兜底使用。Local
            only: never contacts cloud. Cloud only: 在 RingCentral Transcript
            不可用时直接使用 cloud (requires API key).
          </small>
        </div>
        <ToggleField
          id="MEETING_RINGCENTRAL_TRANSCRIPT_ENABLED"
          name="MEETING_RINGCENTRAL_TRANSCRIPT_ENABLED"
          checked={config.MEETING_RINGCENTRAL_TRANSCRIPT_ENABLED !== false}
          onChange={handleInputChange}
          label="自动识别 RingCentral Transcript"
          description="开启后优先读取会议页面 Notes / Transcript 中 RingCentral 自动生成的转录；读取成功时不会再启动 Local ASR 或 Cloud ASR。"
          disabled={config.MEETING_PILOT_ENABLED !== true}
        />
        {config.MEETING_TRANSCRIPTION_MODE !== 'cloud-only' && (
          <>
            {config.MEETING_TRANSCRIPTION_MODE === 'local-only' && (
              <ChromeOnDeviceASRPanel
                enabled={config.MEETING_PILOT_ENABLED === true}
              />
            )}
            <DesktopASRStatusPanel
              enabled={config.MEETING_PILOT_ENABLED === true}
            />
          </>
        )}
        <div className="form-group">
          <label htmlFor="MEETING_PROVIDER_BASE_URL">
            ASR Provider Base URL
          </label>
          <input
            type="url"
            id="MEETING_PROVIDER_BASE_URL"
            name="MEETING_PROVIDER_BASE_URL"
            value={config.MEETING_PROVIDER_BASE_URL || ''}
            onChange={handleInputChange}
            placeholder="https://api.openai.com"
            disabled={config.MEETING_PILOT_ENABLED !== true}
          />
          <small style={{ color: '#666', display: 'block', marginTop: '5px' }}>
            转写服务的 Base URL。可填写 `https://api.openai.com`，也可填写
            `https://dashscope.aliyuncs.com/compatible-mode` 或已包含 `/v1`
            的等价地址；具体会调用哪个 endpoint 取决于下方 API Style 配置。
          </small>
        </div>
        <div className="form-group">
          <label htmlFor="MEETING_TRANSCRIBE_API_STYLE">
            Transcribe API Style
          </label>
          <select
            id="MEETING_TRANSCRIBE_API_STYLE"
            name="MEETING_TRANSCRIBE_API_STYLE"
            value={
              config.MEETING_TRANSCRIBE_API_STYLE ||
              'openai_audio_transcriptions'
            }
            onChange={handleInputChange}
            disabled={config.MEETING_PILOT_ENABLED !== true}
          >
            <option value="openai_audio_transcriptions">
              OpenAI Audio Transcriptions (/v1/audio/transcriptions)
            </option>
            <option value="openai_chat_completions">
              OpenAI Chat Completions + input_audio
            </option>
          </select>
          <small style={{ color: '#666', display: 'block', marginTop: '5px' }}>
            Whisper / OneAPI 类模型通常选择前者；阿里云 DashScope 的
            `qwen3-asr-flash` 这类 OpenAI 兼容 ASR 通常选择后者。`fun-asr` /
            `fun-asr-mtl` 不属于这两种协议，它们走 DashScope 原生 ASR API 或
            WebSocket。
          </small>
        </div>
        <div className="form-group">
          <label htmlFor="MEETING_PROVIDER_API_KEY">ASR Provider API Key</label>
          <input
            type="password"
            id="MEETING_PROVIDER_API_KEY"
            name="MEETING_PROVIDER_API_KEY"
            value={config.MEETING_PROVIDER_API_KEY || ''}
            onChange={handleInputChange}
            placeholder="输入会议弹幕转写服务 API Key"
            autoComplete="new-password"
            disabled={config.MEETING_PILOT_ENABLED !== true}
          />
        </div>
        <div className="form-group">
          <label htmlFor="MEETING_TRANSCRIBE_MODEL">
            Transcribe / ASR Model
          </label>
          <input
            type="text"
            id="MEETING_TRANSCRIBE_MODEL"
            name="MEETING_TRANSCRIBE_MODEL"
            value={config.MEETING_TRANSCRIBE_MODEL || ''}
            onChange={handleInputChange}
            placeholder="whisper-1"
            disabled={config.MEETING_PILOT_ENABLED !== true}
          />
          <small style={{ color: '#666', display: 'block', marginTop: '5px' }}>
            例如 `whisper-1`、`gpt-4o-mini-transcribe`、`qwen3-asr-flash`。
            若填写阿里云 `fun-asr` / `fun-asr-mtl`，需要使用 DashScope 原生 ASR
            接口而不是 OpenAI 风格转写接口。
          </small>
        </div>
        <div className="form-group">
          <label htmlFor="MEETING_MINUTES_API_URL">
            Meeting Minutes API URL
          </label>
          <input
            type="url"
            id="MEETING_MINUTES_API_URL"
            name="MEETING_MINUTES_API_URL"
            value={config.MEETING_MINUTES_API_URL || ''}
            onChange={handleInputChange}
            placeholder="https://10.32.45.219:9527"
            disabled={config.MEETING_PILOT_ENABLED !== true}
          />
          <small style={{ color: '#666', display: 'block', marginTop: '5px' }}>
            独立外部服务，用于上传会议录制并生成 PDF 会议纪要。留空不影响
            Capture、本地总结和基础归档，只是不会生成正式 PDF 纪要。
          </small>
        </div>
      </div>

      <div className="form-section">
        <h2>{t('options.sections.memoryLens')}</h2>
        <ContextSiteMuteSettings />
      </div>

      <AgentExecutorsSettings
        sectionRef={openClawConfigSectionRef}
        highlighted={
          highlightedSection === 'openclaw-config' ||
          highlightedSection === 'OPENCLAW_ENABLED' ||
          highlightedSection === 'agent-executors-config'
        }
        executors={config.AGENT_EXECUTORS || []}
        defaults={
          config.EXECUTOR_DEFAULTS || {
            agent_task: '',
            reflection_research: '',
          }
        }
        externalDelegationEnabled={config.OPENCLAW_ENABLED !== false}
        openClawTimeoutMs={Number(config.OPENCLAW_TIMEOUT_MS) || 600000}
        openClawApiKeyConfigured={config.OPENCLAW_API_KEY_CONFIGURED === true}
        minOpenClawTimeoutSeconds={MIN_OPENCLAW_TIMEOUT_SECONDS}
        onChange={({
          executors,
          defaults,
          openClawEnabled,
          openClawBaseUrl,
          openClawTimeoutMs,
          clearOpenClawApiKey,
        }) =>
          setConfig((prev) => ({
            ...prev,
            AGENT_EXECUTORS: executors,
            EXECUTOR_DEFAULTS: defaults,
            OPENCLAW_ENABLED: openClawEnabled,
            OPENCLAW_BASE_URL: openClawBaseUrl,
            ...(typeof openClawTimeoutMs === 'number'
              ? { OPENCLAW_TIMEOUT_MS: openClawTimeoutMs }
              : {}),
            ...(clearOpenClawApiKey !== undefined
              ? { OPENCLAW_CLEAR_API_KEY: clearOpenClawApiKey }
              : {}),
          }))
        }
      />

      <div
        id="outreach-config"
        ref={outreachConfigSectionRef}
        className="form-section"
        style={
          highlightedSection === 'outreach-config'
            ? {
                scrollMarginTop: '16px',
                boxShadow: '0 0 0 3px rgba(14, 165, 233, 0.22)',
                borderRadius: '12px',
                transition: 'box-shadow 0.25s ease',
              }
            : {
                scrollMarginTop: '16px',
                transition: 'box-shadow 0.25s ease',
              }
        }
      >
        <h2>{t('options.sections.outreach')}</h2>
        <small
          style={{ color: '#666', display: 'block', marginBottom: '15px' }}
        >
          Scheduled Messages 的 Outreach 模板和反思动作 `ask_external_user`
          都由主动询问引擎推进。
        </small>
        <ToggleField
          id="OUTREACH_ENABLED"
          name="OUTREACH_ENABLED"
          checked={config.OUTREACH_ENABLED === true}
          onChange={handleInputChange}
          label="启用主动询问引擎"
          description="开启后，模板派发、等待回复、追问和升级才会真正运行。"
        />
        <div className="form-group">
          <label htmlFor="OUTREACH_INTERVAL_MS">主动询问轮询间隔（毫秒）</label>
          <input
            type="number"
            id="OUTREACH_INTERVAL_MS"
            name="OUTREACH_INTERVAL_MS"
            value={config.OUTREACH_INTERVAL_MS || 60000}
            onChange={handleInputChange}
            min="1000"
            step="1000"
            disabled={config.OUTREACH_ENABLED !== true}
          />
          <small style={{ color: '#666', display: 'block', marginTop: '5px' }}>
            决定模板派发和回复轮询频率。开发调试时可临时调小，例如 5000。
          </small>
        </div>
        <ToggleField
          id="OUTREACH_REQUIRE_APPROVAL_FOR_REFLECTION"
          name="OUTREACH_REQUIRE_APPROVAL_FOR_REFLECTION"
          checked={config.OUTREACH_REQUIRE_APPROVAL_FOR_REFLECTION === true}
          onChange={handleInputChange}
          label="反思发起的主动询问默认先审批"
          description="开启后，反思生成的外联会先进入待审批，不会直接发出。"
          disabled={config.OUTREACH_ENABLED !== true}
        />
        <ToggleField
          id="OUTREACH_REQUIRE_APPROVAL_FOR_MANUAL"
          name="OUTREACH_REQUIRE_APPROVAL_FOR_MANUAL"
          checked={config.OUTREACH_REQUIRE_APPROVAL_FOR_MANUAL === true}
          onChange={handleInputChange}
          label="手动/定时模板发起的主动询问默认先审批"
          description="开启后，Scheduled Messages 里的手动模板也会进入待审批。"
          disabled={config.OUTREACH_ENABLED !== true}
        />
        {renderPushTargetFields(
          '主动询问结果推送',
          'OUTREACH_RESULT_PUSH_TARGET',
          'OUTREACH_RESULT_PUSH_GROUP_ID',
          false,
          '当主动询问拿到最终结果时，用 Bot 推送给 Me 或指定群组。默认推送给 Me。',
        )}
        <div className="form-group">
          <label htmlFor="RINGCENTRAL_SERVER_URL">RingCentral Server URL</label>
          <input
            type="url"
            id="RINGCENTRAL_SERVER_URL"
            name="RINGCENTRAL_SERVER_URL"
            value={config.RINGCENTRAL_SERVER_URL || ''}
            onChange={handleInputChange}
            placeholder="https://platform.ringcentral.com"
            disabled={config.OUTREACH_ENABLED !== true}
          />
          <small style={{ color: '#666', display: 'block', marginTop: '5px' }}>
            还没有 RingCentral app？可前往{' '}
            <a
              href="https://developer.ringcentral.com/"
              target="_blank"
              rel="noopener noreferrer"
            >
              developer.ringcentral.com
            </a>{' '}
            注册并创建应用，获取 Client ID / Secret / JWT。
          </small>
        </div>
        <div className="form-group">
          <label htmlFor="RINGCENTRAL_CLIENT_ID">RingCentral Client ID</label>
          <input
            type="text"
            id="RINGCENTRAL_CLIENT_ID"
            name="RINGCENTRAL_CLIENT_ID"
            value={config.RINGCENTRAL_CLIENT_ID || ''}
            onChange={handleInputChange}
            placeholder="输入 RingCentral app client id"
            disabled={config.OUTREACH_ENABLED !== true}
          />
        </div>
        <div className="form-group">
          <label htmlFor="RINGCENTRAL_CLIENT_SECRET">
            RingCentral Client Secret（写入后不回显）
          </label>
          <input
            type="password"
            id="RINGCENTRAL_CLIENT_SECRET"
            name="RINGCENTRAL_CLIENT_SECRET"
            value={config.RINGCENTRAL_CLIENT_SECRET || ''}
            onChange={handleInputChange}
            placeholder={
              config.RINGCENTRAL_CLIENT_SECRET_CONFIGURED
                ? '已配置（如需更新请输入新 secret）'
                : '输入新的 client secret'
            }
            autoComplete="new-password"
            disabled={config.OUTREACH_ENABLED !== true}
          />
          <small style={{ color: '#666', display: 'block', marginTop: '5px' }}>
            当前状态：
            {config.RINGCENTRAL_CLIENT_SECRET_CONFIGURED
              ? '后端已配置 secret'
              : '后端未配置 secret'}
            。
          </small>
        </div>
        <div className="form-group">
          <label htmlFor="RINGCENTRAL_JWT">
            RingCentral JWT（写入后不回显）
          </label>
          <textarea
            id="RINGCENTRAL_JWT"
            name="RINGCENTRAL_JWT"
            value={config.RINGCENTRAL_JWT || ''}
            onChange={handleInputChange}
            placeholder={
              config.RINGCENTRAL_JWT_CONFIGURED
                ? '已配置（如需更新请输入新的 JWT）'
                : '输入新的 JWT'
            }
            autoComplete="new-password"
            rows={4}
            disabled={config.OUTREACH_ENABLED !== true}
          />
          <small style={{ color: '#666', display: 'block', marginTop: '5px' }}>
            当前状态：
            {config.RINGCENTRAL_JWT_CONFIGURED
              ? '后端已配置 JWT'
              : '后端未配置 JWT'}
            。
          </small>
        </div>
        <div className="form-group">
          <label>
            <input
              type="checkbox"
              name="RINGCENTRAL_CLEAR_CLIENT_SECRET"
              checked={config.RINGCENTRAL_CLEAR_CLIENT_SECRET === true}
              onChange={handleInputChange}
              disabled={config.OUTREACH_ENABLED !== true}
            />
            清除后端已保存的 RingCentral Client Secret（仅当上方 secret
            输入为空时生效）
          </label>
        </div>
        <div className="form-group">
          <label>
            <input
              type="checkbox"
              name="RINGCENTRAL_CLEAR_JWT"
              checked={config.RINGCENTRAL_CLEAR_JWT === true}
              onChange={handleInputChange}
              disabled={config.OUTREACH_ENABLED !== true}
            />
            清除后端已保存的 RingCentral JWT（仅当上方 JWT 输入为空时生效）
          </label>
        </div>
        <div className="form-group">
          <label>RingCentral 目录缓存状态</label>
          <div
            style={{
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '12px',
              background: '#fafafa',
            }}
          >
            <div style={{ marginBottom: '8px' }}>
              <strong>联系人目录：</strong>
              {formatOutreachDirectoryScopeStatus('users')}
            </div>
            <div style={{ marginBottom: '12px' }}>
              <strong>群组目录：</strong>
              {formatOutreachDirectoryScopeStatus('teams')}
            </div>
            <button
              type="button"
              className="secondary-button"
              onClick={handleRefreshOutreachDirectory}
              disabled={
                config.OUTREACH_ENABLED !== true || outreachDirectoryRefreshing
              }
            >
              {outreachDirectoryRefreshing
                ? '刷新中...'
                : '立即刷新 RingCentral 目录'}
            </button>
            <small
              style={{ color: '#666', display: 'block', marginTop: '8px' }}
            >
              开启主动询问后，系统会后台同步联系人和群组目录；搜索时会优先使用本地缓存，聊天链接
              / chat ID 仍可实时解析。
            </small>
          </div>
        </div>
      </div>

      <div className="form-section">
        <h2>{t('options.sections.weeklyReport')}</h2>
        <small
          style={{ color: '#666', display: 'block', marginBottom: '15px' }}
        >
          自动周报功能会在指定时间自动生成本周工作总结。默认每周推送给
          Me，也可以切到自定义群组或不推送。
        </small>
        {renderPushTargetFields(
          '周报推送',
          'WEEKLY_REPORT_PUSH_TARGET',
          'WEEKLY_REPORT_PUSH_GROUP_ID',
          true,
          '选择「不推送」时，保存到后端会自动按禁用处理。',
        )}
        <div className="form-group">
          <label htmlFor="WEEKLY_REPORT_CRON">Cron 表达式</label>
          <input
            type="text"
            id="WEEKLY_REPORT_CRON"
            value={weeklyReportCron}
            onChange={(e) => {
              setWeeklyReportCron(e.target.value);
              setConfig((prev) => ({
                ...prev,
                WEEKLY_REPORT_CRON: e.target.value,
              }));
            }}
            placeholder="0 18 * * 5"
          />
          <small style={{ color: '#666', display: 'block', marginTop: '5px' }}>
            默认: 每周五 18:00 (0 18 * * 5)。格式: 分 时 日 月 周几
          </small>
        </div>
        <div className="form-group">
          <label htmlFor="WEEKLY_REPORT_MIN_MESSAGES">最少消息数阈值</label>
          <input
            type="number"
            id="WEEKLY_REPORT_MIN_MESSAGES"
            value={weeklyReportMinMessages}
            onChange={(e) => {
              const value = Number(e.target.value);
              setWeeklyReportMinMessages(value);
              setConfig((prev) => ({
                ...prev,
                WEEKLY_REPORT_MIN_MESSAGES: value,
              }));
            }}
            min={0}
            placeholder="20"
          />
          <small style={{ color: '#666', display: 'block', marginTop: '5px' }}>
            本周消息数低于此阈值时不生成周报。默认 20
          </small>
        </div>
        <button
          onClick={saveWeeklyReportSettings}
          disabled={weeklyReportSaving}
          style={{
            backgroundColor: '#2ecc71',
            color: 'white',
            padding: '8px 16px',
            border: 'none',
            borderRadius: '4px',
            cursor: weeklyReportSaving ? 'not-allowed' : 'pointer',
            fontSize: '14px',
          }}
        >
          {weeklyReportSaving ? '保存中...' : '保存周报设置到后端'}
        </button>
        <button
          onClick={handlePushWeeklyReportNow}
          disabled={isWeeklyReportPushing}
          style={{
            backgroundColor: '#667eea',
            color: 'white',
            padding: '8px 16px',
            border: 'none',
            borderRadius: '4px',
            cursor: isWeeklyReportPushing ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            marginLeft: '8px',
          }}
        >
          {isWeeklyReportPushing ? '推送中...' : '立即推送周报'}
        </button>
        {renderDigestManualPushReceipt(weeklyReportPushReceipt)}
      </div>

      <div className="form-section">
        <h2>{t('options.sections.llm')}</h2>
        <div className="form-group">
          <label htmlFor="LLM_TYPE">LLM 类型</label>
          <select
            id="LLM_TYPE"
            name="LLM_TYPE"
            value={config.LLM_TYPE}
            onChange={handleInputChange}
          >
            <option value="local">本地</option>
            <option value="openai">OpenAI</option>
            <option value="groq">Groq</option>
            <option value="dify">Dify</option>
          </select>
        </div>
      </div>

      {config.LLM_TYPE === 'local' && (
        <div className="form-section">
          <h2>{t('options.sections.ollama')}</h2>
          <div className="form-group">
            <label htmlFor="OLLAMA_BASE_URL">Ollama 基础 URL</label>
            <input
              type="url"
              id="OLLAMA_BASE_URL"
              name="OLLAMA_BASE_URL"
              value={config.OLLAMA_BASE_URL}
              onChange={handleInputChange}
            />
          </div>
          <div className="form-group">
            <label htmlFor="OLLAMA_MODEL">Ollama 模型</label>
            <input
              type="text"
              id="OLLAMA_MODEL"
              name="OLLAMA_MODEL"
              value={config.OLLAMA_MODEL}
              onChange={handleInputChange}
            />
          </div>
          <div className="form-group">
            <label htmlFor="OLLAMA_REVIEW_MODEL">Ollama 审核模型</label>
            <input
              type="text"
              id="OLLAMA_REVIEW_MODEL"
              name="OLLAMA_REVIEW_MODEL"
              value={config.OLLAMA_REVIEW_MODEL}
              onChange={handleInputChange}
            />
          </div>
          <div className="form-group">
            <label htmlFor="OLLAMA_QUERY_MODEL">Ollama 查询模型</label>
            <input
              type="text"
              id="OLLAMA_QUERY_MODEL"
              name="OLLAMA_QUERY_MODEL"
              value={config.OLLAMA_QUERY_MODEL}
              onChange={handleInputChange}
            />
          </div>
        </div>
      )}

      {config.LLM_TYPE === 'dify' && (
        <div className="form-section">
          <h2>{t('options.sections.dify')}</h2>
          <div className="form-group">
            <label htmlFor="DIFY_API_KEY">Dify API Key</label>
            <input
              type="text"
              id="DIFY_API_KEY"
              name="DIFY_API_KEY"
              value={config.DIFY_API_KEY}
              onChange={handleInputChange}
            />
          </div>
          <div className="form-group">
            <label htmlFor="DIFY_REVIEW_API_KEY">Dify 审核 API Key</label>
            <input
              type="text"
              id="DIFY_REVIEW_API_KEY"
              name="DIFY_REVIEW_API_KEY"
              value={config.DIFY_REVIEW_API_KEY}
              onChange={handleInputChange}
            />
          </div>
          <div className="form-group">
            <label htmlFor="DIFY_API_BASE_URL">Dify API 基础 URL</label>
            <input
              type="url"
              id="DIFY_API_BASE_URL"
              name="DIFY_API_BASE_URL"
              value={config.DIFY_API_BASE_URL}
              onChange={handleInputChange}
            />
          </div>
        </div>
      )}

      {config.LLM_TYPE === 'openai' && (
        <div className="form-section">
          <h2>{t('options.sections.openai')}</h2>
          <div className="form-group">
            <label htmlFor="OPENAI_API_KEY">OpenAI API Key</label>
            <input
              type="text"
              id="OPENAI_API_KEY"
              name="OPENAI_API_KEY"
              value={config.OPENAI_API_KEY}
              onChange={handleInputChange}
            />
          </div>
          <div className="form-group">
            <label htmlFor="OPENAI_MODEL">OpenAI 模型</label>
            <input
              type="text"
              id="OPENAI_MODEL"
              name="OPENAI_MODEL"
              value={config.OPENAI_MODEL}
              onChange={handleInputChange}
            />
          </div>
          <div className="form-group">
            <label htmlFor="OPENAI_REVIEW_MODEL">OpenAI 审核模型</label>
            <input
              type="text"
              id="OPENAI_REVIEW_MODEL"
              name="OPENAI_REVIEW_MODEL"
              value={config.OPENAI_REVIEW_MODEL}
              onChange={handleInputChange}
            />
          </div>
          <div className="form-group">
            <label htmlFor="OPENAI_API_BASE_URL">OpenAI API 基础 URL</label>
            <input
              type="url"
              id="OPENAI_API_BASE_URL"
              name="OPENAI_API_BASE_URL"
              value={config.OPENAI_API_BASE_URL}
              onChange={handleInputChange}
            />
          </div>
        </div>
      )}

      {config.LLM_TYPE === 'groq' && (
        <div className="form-section">
          <h2>{t('options.sections.groq')}</h2>
          <div className="form-group">
            <label htmlFor="GROQ_API_KEY">Groq API Key</label>
            <input
              type="text"
              id="GROQ_API_KEY"
              name="GROQ_API_KEY"
              value={config.GROQ_API_KEY}
              onChange={handleInputChange}
            />
          </div>
          <div className="form-group">
            <label htmlFor="GROQ_MODEL">Groq 模型</label>
            <input
              type="text"
              id="GROQ_MODEL"
              name="GROQ_MODEL"
              value={config.GROQ_MODEL}
              onChange={handleInputChange}
            />
          </div>
          <div className="form-group">
            <label htmlFor="GROQ_REVIEW_MODEL">Groq 审核模型</label>
            <input
              type="text"
              id="GROQ_REVIEW_MODEL"
              name="GROQ_REVIEW_MODEL"
              value={config.GROQ_REVIEW_MODEL}
              onChange={handleInputChange}
            />
          </div>
        </div>
      )}

      <div className="form-section">
        <h2>{t('options.sections.jira')}</h2>
        <div className="form-group">
          <label htmlFor="JIRA_BASE_URL">Jira Base URL</label>
          <input
            type="url"
            id="JIRA_BASE_URL"
            name="JIRA_BASE_URL"
            value={config.JIRA_BASE_URL}
            onChange={handleInputChange}
            placeholder="https://jira.example.com"
          />
        </div>

        <div className="form-group">
          <label htmlFor="JIRA_USERNAME">Jira Email</label>
          <input
            type="text"
            id="JIRA_USERNAME"
            name="JIRA_USERNAME"
            value={config.JIRA_USERNAME}
            onChange={handleInputChange}
            placeholder="your.email@example.com"
          />
        </div>

        <div className="form-group">
          <label htmlFor="JIRA_API_TOKEN">
            Jira Token (
            <a
              href="https://jira.ringcentral.com/secure/ViewProfile.jspa?selectedTab=com.atlassian.pats.pats-plugin:jira-user-personal-access-tokens"
              target="_blank"
              rel="noopener noreferrer"
            >
              点击这里生成
            </a>
            )
          </label>
          <input
            type="text"
            id="JIRA_API_TOKEN"
            name="JIRA_API_TOKEN"
            value={config.JIRA_API_TOKEN}
            onChange={handleInputChange}
            placeholder="输入你的 Jira API Token"
          />
        </div>

        <div className="form-group">
          <label htmlFor="DESIGN_JIRA_PROJECT">Design JIRA Project 前缀</label>
          <input
            type="text"
            id="DESIGN_JIRA_PROJECT"
            name="DESIGN_JIRA_PROJECT"
            value={config.DESIGN_JIRA_PROJECT || ''}
            onChange={handleInputChange}
            placeholder="UX"
          />
          <small style={{ color: '#666', display: 'block', marginTop: '5px' }}>
            设计相关的 JIRA 项目匹配规则。使用 "UX*" 前缀匹配（匹配 UX-123,
            UXDES-456 等），"UX" 完全匹配（只匹配 UX-xxx）
          </small>
        </div>

        <div className="form-group">
          <label htmlFor="DESIGN_LINK_DOMAINS">Design link domains</label>
          <input
            type="text"
            id="DESIGN_LINK_DOMAINS"
            name="DESIGN_LINK_DOMAINS"
            value={config.DESIGN_LINK_DOMAINS || ''}
            onChange={handleInputChange}
            placeholder="prototype.example.com, *.design.example.com"
          />
          <small style={{ color: '#666', display: 'block', marginTop: '5px' }}>
            额外识别 description 和 Jira remote links 里的内部原型/设计系统域名；Figma、Miro、Loom、Google Slides 不需要配置。
          </small>
        </div>

        <div className="form-group">
          <label htmlFor="DEPENDENCIES_JIRA_PROJECT">
            Dependencies JIRA Project 前缀
          </label>
          <input
            type="text"
            id="DEPENDENCIES_JIRA_PROJECT"
            name="DEPENDENCIES_JIRA_PROJECT"
            value={config.DEPENDENCIES_JIRA_PROJECT || ''}
            onChange={handleInputChange}
            placeholder="RCV"
          />
          <small style={{ color: '#666', display: 'block', marginTop: '5px' }}>
            外部依赖的 JIRA 项目匹配规则，用于显示 Backend Progress。"RCV"
            完全匹配（只匹配 RCV-xxx），"RCV*" 前缀匹配
          </small>
        </div>
      </div>

      {config.ANALYSIS_TYPE === 'agentThinking' && (
        <div className="form-section">
          <h2>{t('options.sections.intelligentAgent')}</h2>
          <IntelligentAgentSettings />
        </div>
      )}

      {config.ANALYSIS_TYPE === 'agentWorkflow' && (
        <div className="form-section">
          <h2>{t('options.sections.standardAgent')}</h2>
          <AgentSettings />
        </div>
      )}

      <div className="form-section">
        <h2>{t('options.sections.importExport')}</h2>
        <div className="form-group">
          <label htmlFor="import-config">导入配置</label>
          <input
            type="file"
            id="import-config"
            accept=".json"
            onChange={handleImport}
          />
        </div>
        <button onClick={handleExport}>导出配置</button>
      </div>

      {status.message && (
        <div className={`status-message ${status.type}`}>{status.message}</div>
      )}

      <div className="buttons">
        <button onClick={resetConfig}>重置为默认值</button>
        <button onClick={loadEnvDefaults}>从.env文件加载</button>
        <button className="save-button" onClick={saveConfig}>
          保存配置
        </button>
      </div>
    </div>
  );
};

// Agent系统设置组件
const buildWorkflowTestInputComparisonKey = (
  input: AgentWorkflowTestInput,
): string => {
  const datetime = input.datetime.trim()
    ? normalizeAgentWorkflowInputDatetime(input.datetime)
    : '';

  return JSON.stringify({
    sender: input.sender.trim(),
    teamName: input.teamName.trim(),
    teamId: input.teamId.trim(),
    datetime,
    content: input.content.trim(),
  });
};

const buildWorkflowAgentConfigComparisonKey = (agents: any[]): string => {
  return buildAgentWorkflowAgentConfigSnapshot(agents)?.key || '[]';
};

const AGENT_WORKFLOW_SAVED_SCENARIOS_STORAGE_KEY =
  'agentWorkflowSavedScenarios';

type WorkflowSavedBaselineStatus = 'same' | 'changed';
type WorkflowSavedRegressionStatus =
  | 'same'
  | 'changed'
  | 'no-baseline'
  | 'error';

interface WorkflowSavedBaselineRow {
  id: string;
  label: string;
  expected: string;
  actual: string;
  status: WorkflowSavedBaselineStatus;
}

interface WorkflowSavedRegressionResult {
  id: string;
  label: string;
  status: WorkflowSavedRegressionStatus;
  summary: string;
  detail?: string;
  actual?: AgentWorkflowSavedExpectation;
  diagnostics?: AgentWorkflowSavedDiagnosticSnapshot;
  baselineAgentConfig?: AgentWorkflowAgentConfigSnapshot;
  actualAgentConfig?: AgentWorkflowAgentConfigSnapshot;
  agentConfigChanged?: boolean;
}

interface WorkflowSavedRegressionSummary {
  total: number;
  same: number;
  changed: number;
  noBaseline: number;
  failed: number;
  results: WorkflowSavedRegressionResult[];
}

interface WorkflowSavedRegressionProgress {
  currentIndex: number;
  total: number;
  label: string;
}

interface WorkflowBaselineWritebackReceipt {
  scope?: 'single' | 'batch';
  title?: string;
  summary?: string;
  boundary?: string;
  accepted: number;
  changed: number;
  noBaseline: number;
  failed: number;
  total: number;
  updatedAt: string;
}

interface WorkflowRunEvidenceCopyReceipt {
  status: 'pending' | 'success' | 'error';
  copiedAt: string;
  title: string;
  summary: string;
  boundary: string;
  stale: boolean;
  qualification: string;
  error?: string;
}

interface WorkflowSavedRegressionReport {
  type: 'agent-workflow.saved-regression-report';
  generatedAt: string;
  summary: {
    total: number;
    same: number;
    changed: number;
    noBaseline: number;
    failed: number;
  };
  results: Array<{
    id: string;
    label: string;
    status: WorkflowSavedRegressionStatus;
    summary: string;
    detail?: string;
    actual?: AgentWorkflowSavedExpectation;
    diagnostics?: AgentWorkflowSavedDiagnosticSnapshot;
    baselineAgentConfig?: AgentWorkflowAgentConfigSnapshot;
    actualAgentConfig?: AgentWorkflowAgentConfigSnapshot;
    agentConfigChanged?: boolean;
  }>;
}

const formatWorkflowBoolean = (value: boolean): string => (value ? '是' : '否');

const formatWorkflowConfidence = (value: number | null): string =>
  typeof value === 'number' && Number.isFinite(value)
    ? `${Math.round(value * 100)}%`
    : '-';

const joinAgentWorkflowControlBoundary = (
  ...parts: Array<string | false | null | undefined>
): string => parts.filter(Boolean).join(' ');

const formatWorkflowRuleRefs = (
  refs: string[] = [],
  ids: number[] = [],
): string => refs.join('、') || ids.join('、') || '-';

const buildWorkflowSavedBaselineRows = (
  expected: AgentWorkflowSavedExpectation,
  actual: AgentWorkflowSavedExpectation,
): WorkflowSavedBaselineRow[] => {
  const confidenceChanged =
    expected.confidence === null || actual.confidence === null
      ? expected.confidence !== actual.confidence
      : Math.abs(expected.confidence - actual.confidence) >= 0.05;
  const expectedRules = formatWorkflowRuleRefs(
    expected.matchedRuleRefs,
    expected.matchedRuleIds,
  );
  const actualRules = formatWorkflowRuleRefs(
    actual.matchedRuleRefs,
    actual.matchedRuleIds,
  );
  const rows: WorkflowSavedBaselineRow[] = [
    {
      id: 'store',
      label: '存储',
      expected: formatWorkflowBoolean(expected.shouldStore),
      actual: formatWorkflowBoolean(actual.shouldStore),
      status: expected.shouldStore === actual.shouldStore ? 'same' : 'changed',
    },
    {
      id: 'notify',
      label: '通知',
      expected: formatWorkflowBoolean(expected.shouldNotify),
      actual: formatWorkflowBoolean(actual.shouldNotify),
      status: expected.shouldNotify === actual.shouldNotify ? 'same' : 'changed',
    },
    {
      id: 'review',
      label: '复核',
      expected: expected.notificationReviewRequired ? '待复核' : '无需',
      actual: actual.notificationReviewRequired ? '待复核' : '无需',
      status:
        expected.notificationReviewRequired ===
        actual.notificationReviewRequired
          ? 'same'
          : 'changed',
    },
    {
      id: 'trace',
      label: 'Trace',
      expected: expected.traceStatus,
      actual: actual.traceStatus,
      status: expected.traceStatus === actual.traceStatus ? 'same' : 'changed',
    },
    {
      id: 'rules',
      label: '规则',
      expected: expectedRules,
      actual: actualRules,
      status: expectedRules === actualRules ? 'same' : 'changed',
    },
    {
      id: 'confidence',
      label: '置信度',
      expected: formatWorkflowConfidence(expected.confidence),
      actual: formatWorkflowConfidence(actual.confidence),
      status: confidenceChanged ? 'changed' : 'same',
    },
  ];

  if (expected.agentConfigSnapshot) {
    const actualConfig = actual.agentConfigSnapshot;
    rows.push({
      id: 'agent-config',
      label: '配置',
      expected: formatAgentWorkflowAgentConfigSnapshot(
        expected.agentConfigSnapshot,
      ),
      actual: formatAgentWorkflowAgentConfigSnapshot(actualConfig),
      status:
        actualConfig?.key && actualConfig.key === expected.agentConfigSnapshot.key
          ? 'same'
          : 'changed',
    });
  }

  return rows;
};

const buildWorkflowSavedRegressionSummary = (
  results: WorkflowSavedRegressionResult[],
): WorkflowSavedRegressionSummary => ({
  total: results.length,
  same: results.filter((item) => item.status === 'same').length,
  changed: results.filter((item) => item.status === 'changed').length,
  noBaseline: results.filter((item) => item.status === 'no-baseline').length,
  failed: results.filter((item) => item.status === 'error').length,
  results,
});

const buildWorkflowSavedRegressionReport = (
  summary: WorkflowSavedRegressionSummary,
  generatedAt: string,
): WorkflowSavedRegressionReport => ({
  type: 'agent-workflow.saved-regression-report',
  generatedAt,
  summary: {
    total: summary.total,
    same: summary.same,
    changed: summary.changed,
    noBaseline: summary.noBaseline,
    failed: summary.failed,
  },
  results: summary.results.map((item) => ({
    id: item.id,
    label: item.label,
    status: item.status,
    summary: item.summary,
    detail: item.detail,
    actual: item.actual,
    diagnostics: item.diagnostics,
    baselineAgentConfig: item.baselineAgentConfig,
    actualAgentConfig: item.actualAgentConfig,
    agentConfigChanged: item.agentConfigChanged,
  })),
});

const downloadWorkflowSavedRegressionReport = (
  summary: WorkflowSavedRegressionSummary,
): string => {
  const generatedAt = new Date().toISOString();
  const report = buildWorkflowSavedRegressionReport(summary, generatedAt);
  const filename = `agent-workflow-regression-${generatedAt.replace(/[:.]/g, '-')}.json`;
  const blob = new Blob([JSON.stringify(report, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
  return filename;
};

const AgentSettings = () => {
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const defaultWorkflowScenario = AGENT_WORKFLOW_TEST_SCENARIOS[0];

  // 新Agent表单状态
  const [newAgent, setNewAgent] = useState<{
    id: string;
    name: string;
    description: string;
    enabled: boolean;
    priority: number;
    tools: string[];
  }>({
    id: '',
    name: '',
    description: '',
    enabled: true,
    priority: 50,
    tools: [],
  });
  const [workflowTestInput, setWorkflowTestInput] =
    useState<AgentWorkflowTestInput>(() =>
      defaultWorkflowScenario
        ? buildAgentWorkflowScenarioInput(defaultWorkflowScenario)
        : {
            sender: 'Example Sender',
            teamName: 'Example Group',
            teamId: '',
            datetime: formatAgentWorkflowDatetimeInputValue(),
            content: '',
          },
    );
  const [workflowTestRunning, setWorkflowTestRunning] = useState(false);
  const [workflowTestResult, setWorkflowTestResult] = useState<any>(null);
  const [workflowTestResultInput, setWorkflowTestResultInput] =
    useState<AgentWorkflowTestInput | null>(null);
  const [workflowTestResultConfigKey, setWorkflowTestResultConfigKey] =
    useState('');
  const [workflowTestError, setWorkflowTestError] = useState('');
  const [workflowReplaySamples, setWorkflowReplaySamples] = useState<
    AgentWorkflowReplayMessage[]
  >([]);
  const [workflowReplaySelectedId, setWorkflowReplaySelectedId] = useState('');
  const [workflowReplayLoading, setWorkflowReplayLoading] = useState(false);
  const [workflowReplayError, setWorkflowReplayError] = useState('');
  const [workflowScenarioSelectedId, setWorkflowScenarioSelectedId] = useState(
    AGENT_WORKFLOW_TEST_SCENARIOS[0]?.id || '',
  );
  const [workflowSavedScenarios, setWorkflowSavedScenarios] = useState<
    AgentWorkflowSavedScenario[]
  >([]);
  const [workflowSavedScenarioSelectedId, setWorkflowSavedScenarioSelectedId] =
    useState('');
  const [workflowSavedScenarioError, setWorkflowSavedScenarioError] =
    useState('');
  const [workflowSavedScenarioStatus, setWorkflowSavedScenarioStatus] =
    useState('');
  const [workflowSavedRegressionRunning, setWorkflowSavedRegressionRunning] =
    useState(false);
  const [workflowSavedRegressionSummary, setWorkflowSavedRegressionSummary] =
    useState<WorkflowSavedRegressionSummary | null>(null);
  const [workflowSavedRegressionProgress, setWorkflowSavedRegressionProgress] =
    useState<WorkflowSavedRegressionProgress | null>(null);
  const [
    workflowBaselineWritebackReceipt,
    setWorkflowBaselineWritebackReceipt,
  ] = useState<WorkflowBaselineWritebackReceipt | null>(null);
  const [
    workflowRunEvidenceCopyReceipt,
    setWorkflowRunEvidenceCopyReceipt,
  ] = useState<WorkflowRunEvidenceCopyReceipt | null>(null);
  const [
    workflowSavedScenarioDeleteReceipt,
    setWorkflowSavedScenarioDeleteReceipt,
  ] = useState<AgentWorkflowTestSourceReceipt | null>(null);
  const workflowLastRunErrorRef = useRef('');

  // 获取可用工具列表
  const availableTools = [
    'entityExtraction',
    'relationshipAnalysis',
    'historySearch',
    'relevanceJudgment',
    'externalServiceQuery',
    'replyAdviser',
    'concernedItemMatcher', // 新增：关注项匹配工具
  ];

  // 工具名称映射
  const toolNameMap: Record<string, string> = {
    entityExtraction: '实体提取工具',
    relationshipAnalysis: '关系分析工具',
    historySearch: '历史消息搜索工具',
    relevanceJudgment: '重要性判断工具',
    externalServiceQuery: '外部服务查询工具',
    replyAdviser: '回复建议工具',
    concernedItemMatcher: '关注项匹配工具',
  };

  const workflowPhaseMap: Record<string, string> = {
    entityRecognizer: '提取实体',
    notificationJudge: '匹配关注项',
    relationshipAnalyzer: '补全关系',
    relevanceJudge: '判断存储',
    externalInfoFetcher: '查询外部信息',
    responseAdviser: '生成回复建议',
  };

  // 加载当前Agent列表
  useEffect(() => {
    const loadAgents = async () => {
      try {
        setLoading(true);
        const agentList = await agentCoordinator.getAgents();
        setAgents(agentList);
        setLoading(false);
      } catch (error) {
        console.error('加载Agent失败:', error);
        setErrorMsg('加载Agent失败');
        setLoading(false);
      }
    };

    loadAgents();
  }, []);

  const loadWorkflowReplaySamples = async () => {
    setWorkflowReplayLoading(true);
    setWorkflowReplayError('');
    try {
      const client = getMemoryServiceClient();
      const result = await client.recall('近期工作流回放样本', {
        topK: 12,
        channels: ['time'],
        includeMetadata: true,
        previewMaxLength: 260,
      });
      const samples = buildAgentWorkflowReplayMessages(result.items || [], 8);
      setWorkflowReplaySamples(samples);
      setWorkflowReplaySelectedId(samples[0]?.id || '');
    } catch (error) {
      console.error('加载 Agent Workflow 回放样本失败:', error);
      setWorkflowReplaySamples([]);
      setWorkflowReplaySelectedId('');
      setWorkflowReplayError(
        error instanceof Error ? error.message : '加载最近消息失败',
      );
    } finally {
      setWorkflowReplayLoading(false);
    }
  };

  useEffect(() => {
    loadWorkflowReplaySamples();
  }, []);

  useEffect(() => {
    let cancelled = false;
    chrome.storage.local.get(
      [AGENT_WORKFLOW_SAVED_SCENARIOS_STORAGE_KEY],
      (result) => {
        if (cancelled) return;
        const savedScenarios = normalizeAgentWorkflowSavedScenarios(
          result[AGENT_WORKFLOW_SAVED_SCENARIOS_STORAGE_KEY],
        );
        setWorkflowSavedScenarios(savedScenarios);
        setWorkflowSavedScenarioSelectedId(savedScenarios[0]?.id || '');
      },
    );

    return () => {
      cancelled = true;
    };
  }, []);

  // 处理新Agent表单变化
  const handleNewAgentChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value, type } = e.target;
    setNewAgent((prev) => ({
      ...prev,
      [name]:
        type === 'checkbox'
          ? (e.target as HTMLInputElement).checked
          : name === 'priority'
            ? Number(value)
            : value,
    }));
  };

  // 处理工具选择变化
  const handleToolChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const tool = e.target.name;
    const isChecked = e.target.checked;

    setNewAgent((prev) => {
      const tools = isChecked
        ? [...prev.tools, tool]
        : prev.tools.filter((t) => t !== tool);

      return {
        ...prev,
        tools,
      };
    });
  };

  const handleWorkflowTestInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setWorkflowSavedRegressionSummary(null);
    setWorkflowBaselineWritebackReceipt(null);
    setWorkflowRunEvidenceCopyReceipt(null);
    setWorkflowSavedScenarioDeleteReceipt(null);
    setWorkflowTestInput((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleWorkflowScenarioChange = (
    e: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    const scenarioId = e.target.value;
    setWorkflowScenarioSelectedId(scenarioId);
    const scenario = AGENT_WORKFLOW_TEST_SCENARIOS.find(
      (item) => item.id === scenarioId,
    );
    if (!scenario) return;

    setWorkflowTestInput(buildAgentWorkflowScenarioInput(scenario));
    setWorkflowTestResult(null);
    setWorkflowTestError('');
    setWorkflowReplayError('');
    setWorkflowSavedScenarioError('');
    setWorkflowSavedScenarioStatus('');
    setWorkflowSavedRegressionSummary(null);
    setWorkflowBaselineWritebackReceipt(null);
    setWorkflowRunEvidenceCopyReceipt(null);
    setWorkflowSavedScenarioDeleteReceipt(null);
  };

  const runWorkflowTest = async (input: AgentWorkflowTestInput) => {
    const messageContent = input.content.trim();
    if (!messageContent) {
      const errorMessage = '请输入测试消息';
      workflowLastRunErrorRef.current = errorMessage;
      setWorkflowTestError(errorMessage);
      setWorkflowTestResult(null);
      setWorkflowTestResultInput(null);
      setWorkflowTestResultConfigKey('');
      setWorkflowRunEvidenceCopyReceipt(null);
      setWorkflowSavedScenarioDeleteReceipt(null);
      return null;
    }

    let resultConfigKey = buildWorkflowAgentConfigComparisonKey(agents);
    setWorkflowTestRunning(true);
    setWorkflowTestError('');
    workflowLastRunErrorRef.current = '';
    setWorkflowTestResult(null);
    setWorkflowTestResultInput(null);
    setWorkflowTestResultConfigKey('');
    setWorkflowRunEvidenceCopyReceipt(null);
    setWorkflowSavedScenarioDeleteReceipt(null);
    try {
      const agentsForRun = await agentCoordinator.getAgents();
      setAgents(agentsForRun);
      resultConfigKey = buildWorkflowAgentConfigComparisonKey(agentsForRun);

      const result = await agentCoordinator.processMessage({
        post_id: `agent-workflow-test-${Date.now()}`,
        team_id: input.teamId.trim() || 'agent-workflow-test',
        team_name: input.teamName.trim() || 'Example Group',
        message_content: messageContent,
        sender: input.sender.trim() || 'Example Sender',
        datetime: normalizeAgentWorkflowInputDatetime(input.datetime),
      });
      setWorkflowTestResult(result);
      setWorkflowTestResultInput(input);
      setWorkflowTestResultConfigKey(resultConfigKey);
      workflowLastRunErrorRef.current = '';
      return result;
    } catch (error) {
      console.error('Agent Workflow 测试失败:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Agent Workflow 测试失败';
      workflowLastRunErrorRef.current = errorMessage;
      setWorkflowTestError(errorMessage);
      setWorkflowTestResultInput(null);
      setWorkflowTestResultConfigKey('');
      return null;
    } finally {
      setWorkflowTestRunning(false);
    }
  };

  const handleRunWorkflowTest = () => {
    setWorkflowSavedScenarioStatus('');
    setWorkflowSavedRegressionSummary(null);
    setWorkflowBaselineWritebackReceipt(null);
    setWorkflowRunEvidenceCopyReceipt(null);
    setWorkflowSavedScenarioDeleteReceipt(null);
    runWorkflowTest(workflowTestInput);
  };

  const buildWorkflowInputFromReplaySample = (
    sample: AgentWorkflowReplayMessage,
  ): AgentWorkflowTestInput => ({
    sender: sample.sender,
    teamName: sample.teamName,
    teamId: sample.teamId || '',
    datetime: formatAgentWorkflowDatetimeInputValue(sample.datetime),
    content: sample.content,
  });

  const getSelectedWorkflowReplaySample = () => {
    const sample = workflowReplaySamples.find(
      (item) => item.id === workflowReplaySelectedId,
    );
    if (!sample) {
      setWorkflowReplayError('请选择一条最近消息');
      return null;
    }
    return sample;
  };

  const handleLoadWorkflowReplaySample = () => {
    const sample = getSelectedWorkflowReplaySample();
    if (!sample) return;

    setWorkflowTestInput(buildWorkflowInputFromReplaySample(sample));
    setWorkflowTestResult(null);
    setWorkflowTestError('');
    setWorkflowReplayError('');
    setWorkflowSavedScenarioError('');
    setWorkflowSavedScenarioStatus('');
    setWorkflowSavedRegressionSummary(null);
    setWorkflowBaselineWritebackReceipt(null);
    setWorkflowRunEvidenceCopyReceipt(null);
    setWorkflowSavedScenarioDeleteReceipt(null);
  };

  const handleRunWorkflowReplaySample = async () => {
    const sample = getSelectedWorkflowReplaySample();
    if (!sample) return;

    const nextInput = buildWorkflowInputFromReplaySample(sample);
    setWorkflowTestInput(nextInput);
    setWorkflowReplayError('');
    setWorkflowSavedScenarioError('');
    setWorkflowSavedScenarioStatus('');
    setWorkflowSavedRegressionSummary(null);
    setWorkflowBaselineWritebackReceipt(null);
    setWorkflowRunEvidenceCopyReceipt(null);
    setWorkflowSavedScenarioDeleteReceipt(null);
    await runWorkflowTest(nextInput);
  };

  const getSelectedWorkflowScenario = () =>
    AGENT_WORKFLOW_TEST_SCENARIOS.find(
      (scenario) => scenario.id === workflowScenarioSelectedId,
    ) || AGENT_WORKFLOW_TEST_SCENARIOS[0];

  const handleLoadWorkflowScenario = () => {
    const scenario = getSelectedWorkflowScenario();
    if (!scenario) return;

    setWorkflowTestInput(buildAgentWorkflowScenarioInput(scenario));
    setWorkflowTestResult(null);
    setWorkflowTestError('');
    setWorkflowReplayError('');
    setWorkflowSavedScenarioError('');
    setWorkflowSavedScenarioStatus('');
    setWorkflowSavedRegressionSummary(null);
    setWorkflowBaselineWritebackReceipt(null);
    setWorkflowRunEvidenceCopyReceipt(null);
    setWorkflowSavedScenarioDeleteReceipt(null);
  };

  const handleRunWorkflowScenario = async () => {
    const scenario = getSelectedWorkflowScenario();
    if (!scenario) return;

    const nextInput = buildAgentWorkflowScenarioInput(scenario);
    setWorkflowTestInput(nextInput);
    setWorkflowReplayError('');
    setWorkflowSavedScenarioError('');
    setWorkflowSavedScenarioStatus('');
    setWorkflowSavedRegressionSummary(null);
    setWorkflowBaselineWritebackReceipt(null);
    setWorkflowRunEvidenceCopyReceipt(null);
    setWorkflowSavedScenarioDeleteReceipt(null);
    await runWorkflowTest(nextInput);
  };

  const persistWorkflowSavedScenarios = async (
    scenarios: AgentWorkflowSavedScenario[],
  ) => {
    const normalizedScenarios = normalizeAgentWorkflowSavedScenarios(scenarios);
    setWorkflowSavedScenarios(normalizedScenarios);
    await chrome.storage.local.set({
      [AGENT_WORKFLOW_SAVED_SCENARIOS_STORAGE_KEY]: normalizedScenarios,
    });
    return normalizedScenarios;
  };

  const getSelectedWorkflowSavedScenario = () => {
    const scenario = workflowSavedScenarios.find(
      (item) => item.id === workflowSavedScenarioSelectedId,
    );
    if (!scenario) {
      setWorkflowSavedScenarioError('请选择一个保存样例');
      setWorkflowSavedScenarioStatus('');
      return null;
    }
    return scenario;
  };

  const handleSaveWorkflowScenario = async () => {
    if (!workflowTestInput.content.trim()) {
      setWorkflowSavedScenarioError('请输入测试消息后再保存样例');
      setWorkflowSavedScenarioStatus('');
      return;
    }

    const baselineResult =
      workflowTestResult && !workflowResultIsStale ? workflowTestResult : null;
    const snapshot = buildAgentWorkflowSavedScenario(
      workflowTestInput,
      baselineResult,
      new Date(),
      sortedAgents,
    );
    const snapshotInputKey = buildWorkflowTestInputComparisonKey(snapshot.input);
    const replacedScenario = workflowSavedScenarios.find(
      (scenario) =>
        buildWorkflowTestInputComparisonKey(scenario.input) ===
        snapshotInputKey,
    );
    const evictedScenario =
      !replacedScenario &&
      workflowSavedScenarios.length >= AGENT_WORKFLOW_SAVED_SCENARIO_LIMIT
        ? workflowSavedScenarios[AGENT_WORKFLOW_SAVED_SCENARIO_LIMIT - 1]
        : null;
    const nextScenarios = [
      snapshot,
      ...workflowSavedScenarios.filter(
        (scenario) =>
          buildWorkflowTestInputComparisonKey(scenario.input) !==
          snapshotInputKey,
      ),
    ].slice(0, AGENT_WORKFLOW_SAVED_SCENARIO_LIMIT);

    await persistWorkflowSavedScenarios(nextScenarios);
    setWorkflowSavedScenarioSelectedId(snapshot.id);
    setWorkflowSavedScenarioError('');
    setWorkflowSavedRegressionSummary(null);
    setWorkflowBaselineWritebackReceipt(null);
    setWorkflowRunEvidenceCopyReceipt(null);
    setWorkflowSavedScenarioDeleteReceipt(null);
    const saveStatus = replacedScenario
      ? baselineResult
        ? '已更新同输入保存样例和结果基线；未增加样例数'
        : '已更新同输入保存样例；运行后可再次保存基线'
      : baselineResult
        ? '已保存当前用例和结果基线'
        : '已保存当前用例；运行后可再次保存基线';
    setWorkflowSavedScenarioStatus(
      evictedScenario
        ? `${saveStatus}；本地上限 ${AGENT_WORKFLOW_SAVED_SCENARIO_LIMIT}，已移出旧样例：${evictedScenario.label}`
        : saveStatus,
    );
  };

  const handleUpdateWorkflowSavedBaseline = async () => {
    const scenario = getSelectedWorkflowSavedScenario();
    if (!scenario) return;

    if (!workflowTestResult || !workflowTestResultInput) {
      setWorkflowSavedScenarioError('请先运行这个保存样例，再更新基线');
      setWorkflowSavedScenarioStatus('');
      return;
    }

    if (workflowResultIsStale) {
      setWorkflowSavedScenarioError('当前结果已过期，请重新运行后再更新基线');
      setWorkflowSavedScenarioStatus('');
      return;
    }

    if (
      buildWorkflowTestInputComparisonKey(scenario.input) !==
      buildWorkflowTestInputComparisonKey(workflowTestResultInput)
    ) {
      setWorkflowSavedScenarioError(
        '当前结果不属于所选保存样例，请先运行该保存样例',
      );
      setWorkflowSavedScenarioStatus('');
      return;
    }

    const nextExpectation = buildAgentWorkflowResultExpectation(
      workflowTestResult,
      new Date(),
      sortedAgents,
    );
    if (!nextExpectation) {
      setWorkflowSavedScenarioError('当前结果不能生成基线，请重新运行后再试');
      setWorkflowSavedScenarioStatus('');
      return;
    }

    const hadBaseline = Boolean(scenario.expectedResult);
    const updatedAt = new Date().toISOString();
    const nextScenarios = workflowSavedScenarios.map((item) =>
      item.id === scenario.id
        ? {
            ...item,
            updatedAt,
            expectedResult: nextExpectation,
          }
        : item,
    );

    await persistWorkflowSavedScenarios(nextScenarios);
    setWorkflowSavedScenarioSelectedId(scenario.id);
    setWorkflowSavedScenarioError('');
    setWorkflowSavedRegressionSummary(null);
    setWorkflowRunEvidenceCopyReceipt(null);
    setWorkflowSavedScenarioDeleteReceipt(null);
    setWorkflowSavedScenarioStatus(
      hadBaseline
        ? '已接受当前结果为新基线'
        : '已为保存样例建立当前结果基线',
    );
    setWorkflowBaselineWritebackReceipt({
      scope: 'single',
      title: hadBaseline ? '单条基线写回回执' : '单条基线建立回执',
      summary: `已更新 1 个保存样例：${
        hadBaseline ? '覆盖原基线' : '建立新基线'
      }；后续单条对比和批量回归会使用这个本地基线。`,
      boundary:
        '只改写 chrome.storage.local 的 agentWorkflowSavedScenarios 基线；不会写入 Memory Service、发送通知、执行规则自动化、导出报告、覆盖测试输入或导出原始消息正文。',
      accepted: 1,
      changed: hadBaseline ? 1 : 0,
      noBaseline: hadBaseline ? 0 : 1,
      failed: 0,
      total: 1,
      updatedAt,
    });
  };

  const handleLoadWorkflowSavedScenario = () => {
    const scenario = getSelectedWorkflowSavedScenario();
    if (!scenario) return;

    setWorkflowTestInput(scenario.input);
    setWorkflowTestResult(null);
    setWorkflowTestError('');
    setWorkflowReplayError('');
    setWorkflowSavedScenarioError('');
    setWorkflowSavedRegressionSummary(null);
    setWorkflowBaselineWritebackReceipt(null);
    setWorkflowRunEvidenceCopyReceipt(null);
    setWorkflowSavedScenarioDeleteReceipt(null);
    setWorkflowSavedScenarioStatus(
      scenario.expectedResult ? '已填入保存样例和基线' : '已填入保存样例',
    );
  };

  const handleRunWorkflowSavedScenario = async () => {
    const scenario = getSelectedWorkflowSavedScenario();
    if (!scenario) return;

    setWorkflowTestInput(scenario.input);
    setWorkflowReplayError('');
    setWorkflowSavedScenarioError('');
    setWorkflowSavedScenarioStatus('');
    setWorkflowSavedRegressionSummary(null);
    setWorkflowBaselineWritebackReceipt(null);
    setWorkflowRunEvidenceCopyReceipt(null);
    setWorkflowSavedScenarioDeleteReceipt(null);
    const result = await runWorkflowTest(scenario.input);
    if (result) {
      setWorkflowSavedScenarioStatus(
        scenario.expectedResult
          ? '已运行保存样例；下方显示基线对比'
          : '已运行保存样例；再次保存可记录基线',
      );
    }
  };

  const handleRunWorkflowSavedRegression = async () => {
    if (workflowSavedScenarios.length === 0) {
      setWorkflowSavedScenarioError('请先保存至少一个样例');
      setWorkflowSavedScenarioStatus('');
      setWorkflowSavedRegressionSummary(null);
      setWorkflowSavedRegressionProgress(null);
      setWorkflowBaselineWritebackReceipt(null);
      setWorkflowRunEvidenceCopyReceipt(null);
      setWorkflowSavedScenarioDeleteReceipt(null);
      return;
    }

    setWorkflowReplayError('');
    setWorkflowSavedScenarioError('');
    setWorkflowSavedRegressionRunning(true);
    setWorkflowSavedRegressionSummary(null);
    setWorkflowSavedRegressionProgress(null);
    setWorkflowBaselineWritebackReceipt(null);
    setWorkflowRunEvidenceCopyReceipt(null);
    setWorkflowSavedScenarioDeleteReceipt(null);

    const results: WorkflowSavedRegressionResult[] = [];

    try {
      for (const [index, scenario] of workflowSavedScenarios.entries()) {
        setWorkflowSavedScenarioSelectedId(scenario.id);
        setWorkflowTestInput(scenario.input);
        setWorkflowSavedRegressionProgress({
          currentIndex: index + 1,
          total: workflowSavedScenarios.length,
          label: scenario.label,
        });
        setWorkflowSavedScenarioStatus(
          `正在批量回归 ${index + 1}/${workflowSavedScenarios.length}：${scenario.label}`,
        );

        try {
          const result = await runWorkflowTest(scenario.input);
          const actual = buildAgentWorkflowResultExpectation(
            result,
            new Date(),
            sortedAgents,
          );
          const diagnostics = buildAgentWorkflowDiagnosticSnapshot(
            result,
            sortedAgents,
          );

          if (!result || !actual) {
            results.push({
              id: scenario.id,
              label: scenario.label,
              status: 'error',
              summary: '运行失败',
              detail: formatAgentWorkflowRegressionFailureDetail(
                workflowLastRunErrorRef.current,
              ),
            });
            continue;
          }

          if (!scenario.expectedResult) {
            results.push({
              id: scenario.id,
              label: scenario.label,
              status: 'no-baseline',
              summary: '没有保存基线',
              detail:
                '本次已能运行；可直接接受本次批量结果，建立后续对比基线。',
              actual,
              diagnostics,
              actualAgentConfig: actual.agentConfigSnapshot,
            });
            continue;
          }

          const baselineRows = buildWorkflowSavedBaselineRows(
            scenario.expectedResult,
            actual,
          );
          const changedRows = baselineRows.filter(
            (row) => row.status === 'changed',
          );
          const baselineAgentConfig =
            scenario.expectedResult.agentConfigSnapshot;
          const actualAgentConfig = actual.agentConfigSnapshot;
          const agentConfigChanged = Boolean(
            baselineAgentConfig &&
              actualAgentConfig &&
              baselineAgentConfig.key !== actualAgentConfig.key,
          );

          results.push({
            id: scenario.id,
            label: scenario.label,
            status: changedRows.length > 0 ? 'changed' : 'same',
            summary:
              changedRows.length > 0
                ? `${changedRows.length} 项变化`
                : '基线一致',
            detail:
              changedRows.length > 0
                ? changedRows
                    .map(
                      (row) =>
                        `${row.label}: ${row.expected} -> ${row.actual}`,
                    )
                    .join('；')
                : '存储、通知、复核、Trace、规则和置信度都未漂移。',
            actual,
            diagnostics,
            baselineAgentConfig,
            actualAgentConfig,
            agentConfigChanged,
          });
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Agent Workflow 测试失败';
          workflowLastRunErrorRef.current = errorMessage;
          setWorkflowTestError(errorMessage);
          results.push({
            id: scenario.id,
            label: scenario.label,
            status: 'error',
            summary: '运行失败',
            detail: formatAgentWorkflowRegressionFailureDetail(errorMessage),
          });
        }
      }

      const summary = buildWorkflowSavedRegressionSummary(results);
      setWorkflowSavedRegressionSummary(summary);
      setWorkflowSavedRegressionProgress(null);
      setWorkflowSavedScenarioStatus(
        `批量回归完成：通过 ${summary.same} / 变化 ${summary.changed} / 无基线 ${summary.noBaseline} / 失败 ${summary.failed}`,
      );
    } finally {
      setWorkflowSavedRegressionRunning(false);
    }
  };

  const handleAcceptWorkflowRegressionBaselines = async () => {
    const previousSummary = workflowSavedRegressionSummary;
    const acceptables = (workflowSavedRegressionSummary?.results || []).filter(
      (item) =>
        (item.status === 'changed' || item.status === 'no-baseline') &&
        item.actual,
    );

    if (acceptables.length === 0) {
      setWorkflowSavedScenarioError('没有可接受为基线的批量回归结果');
      setWorkflowSavedScenarioStatus('');
      return;
    }

    const expectationsById = new Map(
      acceptables.map((item) => [item.id, item.actual!]),
    );
    const updatedAt = new Date().toISOString();
    const acceptedChanged = acceptables.filter(
      (item) => item.status === 'changed',
    ).length;
    const acceptedNoBaseline = acceptables.filter(
      (item) => item.status === 'no-baseline',
    ).length;
    const nextScenarios = workflowSavedScenarios.map((scenario) =>
      expectationsById.has(scenario.id)
        ? {
            ...scenario,
            updatedAt,
            expectedResult: expectationsById.get(scenario.id),
          }
        : scenario,
    );

    await persistWorkflowSavedScenarios(nextScenarios);

    const nextResults = (workflowSavedRegressionSummary?.results || []).map(
      (item) =>
        expectationsById.has(item.id)
          ? {
              ...item,
              status: 'same' as WorkflowSavedRegressionStatus,
              summary: '已接受为新基线',
              detail: '该保存样例的本次批量回归结果已写入基线。',
            }
          : item,
    );
    setWorkflowSavedRegressionSummary(
      buildWorkflowSavedRegressionSummary(nextResults),
    );
    setWorkflowSavedScenarioError('');
    setWorkflowSavedScenarioStatus(
      `已接受 ${acceptables.length} 个批量回归结果为新基线`,
    );
    setWorkflowSavedScenarioDeleteReceipt(null);
    setWorkflowBaselineWritebackReceipt({
      scope: 'batch',
      title: '批量基线写回回执',
      summary: `已更新 ${acceptables.length} 个保存样例：变化 ${acceptedChanged} / 无基线 ${acceptedNoBaseline}；失败 ${
        previousSummary?.failed || 0
      } 个未覆盖；样例总数 ${previousSummary?.total || acceptables.length}。`,
      boundary:
        '只改写 chrome.storage.local 的 agentWorkflowSavedScenarios 基线；不会写入 Memory Service、发送通知、执行规则自动化、覆盖测试输入或导出原始消息正文。',
      accepted: acceptables.length,
      changed: acceptedChanged,
      noBaseline: acceptedNoBaseline,
      failed: previousSummary?.failed || 0,
      total: previousSummary?.total || acceptables.length,
      updatedAt,
    });
  };

  const handleExportWorkflowRegressionReport = () => {
    if (!workflowSavedRegressionSummary) {
      setWorkflowSavedScenarioError('请先完成一次批量回归再导出报告');
      setWorkflowSavedScenarioStatus('');
      return;
    }

    const filename = downloadWorkflowSavedRegressionReport(
      workflowSavedRegressionSummary,
    );
    setWorkflowSavedScenarioError('');
    setWorkflowSavedScenarioStatus(`已导出批量回归报告：${filename}`);
    setWorkflowSavedScenarioDeleteReceipt(null);
  };

  const handleDeleteWorkflowSavedScenario = async () => {
    const scenario = getSelectedWorkflowSavedScenario();
    if (!scenario) return;

    const nextScenarios = workflowSavedScenarios.filter(
      (item) => item.id !== scenario.id,
    );
    const persistedScenarios = await persistWorkflowSavedScenarios(nextScenarios);
    const nextSelectedScenario = persistedScenarios[0] || null;
    setWorkflowSavedScenarioSelectedId(nextSelectedScenario?.id || '');
    setWorkflowSavedScenarioError('');
    setWorkflowSavedRegressionSummary(null);
    setWorkflowBaselineWritebackReceipt(null);
    setWorkflowRunEvidenceCopyReceipt(null);
    setWorkflowSavedScenarioStatus('');
    setWorkflowSavedScenarioDeleteReceipt(
      buildAgentWorkflowSavedScenarioDeleteReceipt({
        scenario,
        remainingCount: persistedScenarios.length,
        nextScenarioLabel: nextSelectedScenario?.label,
      }),
    );
  };

  // 添加新Agent
  const handleAddAgent = async () => {
    try {
      const sanitizedAgent = {
        ...newAgent,
        id: newAgent.id.trim(),
        name: newAgent.name.trim(),
        description: newAgent.description.trim(),
        tools: newAgent.tools.filter((tool) => availableTools.includes(tool)),
      };

      if (!sanitizedAgent.id || !sanitizedAgent.name) {
        setErrorMsg('请填写Agent ID和名称');
        return;
      }

      if (!/^[a-zA-Z][a-zA-Z0-9_-]{1,63}$/.test(sanitizedAgent.id)) {
        setErrorMsg('Agent ID需以字母开头，仅包含字母、数字、_ 或 -');
        return;
      }

      if (sanitizedAgent.tools.length === 0) {
        setErrorMsg('请至少选择一个工具');
        return;
      }

      // 检查ID是否重复
      if (agents.some((a) => a.id === sanitizedAgent.id)) {
        setErrorMsg('Agent ID已存在');
        return;
      }

      const success = await agentCoordinator.addAgent(sanitizedAgent);
      if (success) {
        // 重新加载Agent列表
        const agentList = await agentCoordinator.getAgents();
        setAgents(agentList);

        // 重置表单
        setNewAgent({
          id: '',
          name: '',
          description: '',
          enabled: true,
          priority: 50,
          tools: [],
        });

        setErrorMsg('');
      } else {
        setErrorMsg('添加Agent失败');
      }
    } catch (error) {
      console.error('添加Agent失败:', error);
      setErrorMsg('添加Agent失败');
    }
  };

  const sortedAgents = [...agents].sort(
    (a, b) => (b.priority || 0) - (a.priority || 0),
  );
  const enabledAgents = sortedAgents.filter((agent) => agent.enabled !== false);
  const enabledToolCount = new Set(
    enabledAgents.flatMap((agent) => agent.tools || []),
  ).size;
  const sanitizedNewAgentId = newAgent.id.trim();
  const selectedToolLabels = newAgent.tools
    .map((tool) => toolNameMap[tool] || tool)
    .join('、');
  const previewAgents = sanitizedNewAgentId
    ? [
        ...agents,
        {
          ...newAgent,
          id: sanitizedNewAgentId,
          name: newAgent.name.trim() || sanitizedNewAgentId,
        },
      ].sort((a, b) => (b.priority || 0) - (a.priority || 0))
    : sortedAgents;
  const previewOrder = sanitizedNewAgentId
    ? previewAgents.findIndex((agent) => agent.id === sanitizedNewAgentId) + 1
    : 0;
  const canAddAgent =
    Boolean(sanitizedNewAgentId) &&
    Boolean(newAgent.name.trim()) &&
    newAgent.tools.length > 0 &&
    /^[a-zA-Z][a-zA-Z0-9_-]{1,63}$/.test(sanitizedNewAgentId) &&
    !agents.some((agent) => agent.id === sanitizedNewAgentId);
  const workflowExecutionBusy =
    workflowTestRunning || workflowSavedRegressionRunning;
  const workflowRunEvidenceCopyPending =
    workflowRunEvidenceCopyReceipt?.status === 'pending';
  const workflowControlLocked =
    workflowExecutionBusy || workflowRunEvidenceCopyPending;
  const workflowTestMessageReady = workflowTestInput.content.trim().length > 0;
  const workflowCurrentConfigSnapshot =
    buildAgentWorkflowAgentConfigSnapshot(agents);
  const workflowCurrentConfigKey =
    workflowCurrentConfigSnapshot?.key || buildWorkflowAgentConfigComparisonKey(agents);
  const workflowResultInputIsStale = Boolean(
    workflowTestResult &&
      workflowTestResultInput &&
      buildWorkflowTestInputComparisonKey(workflowTestInput) !==
        buildWorkflowTestInputComparisonKey(workflowTestResultInput),
  );
  const workflowResultConfigIsStale = Boolean(
    workflowTestResult &&
      workflowTestResultConfigKey &&
      workflowCurrentConfigKey !== workflowTestResultConfigKey,
  );
  const workflowResultIsStale =
    workflowResultInputIsStale || workflowResultConfigIsStale;
  const workflowStaleReason =
    workflowResultInputIsStale && workflowResultConfigIsStale
      ? '当前输入和 Agent 配置已修改'
      : workflowResultConfigIsStale
        ? 'Agent 配置已修改'
        : '当前输入已修改';
  const workflowRunButtonLabel = workflowTestRunning
    ? '测试中...'
    : workflowSavedRegressionRunning
      ? '批量运行中...'
      : workflowResultIsStale
      ? '重新运行测试'
      : '运行测试';
  const firstAgent = enabledAgents[0];
  const storageAuditFields = [
    '存储原因',
    '执行 Trace',
    '实体摘要',
    '关系数量',
    '失败 Agent',
    '通知复核',
  ];
  const workflowTestTrace = workflowTestResult?.agentWorkflowTrace || [];
  const workflowTestStorageReview = workflowTestResult?.storageReview;
  const workflowTestConfidence =
    normalizeAgentWorkflowConfidence(workflowTestResult?.confidence) ??
    normalizeAgentWorkflowConfidence(workflowTestStorageReview?.confidence);
  const workflowTestNotificationLabel = workflowTestResult?.notificationReview
    ?.required
    ? '待复核'
    : workflowTestResult?.shouldNotify
      ? '发送'
      : '不发送';
  const workflowTraceStatusLabels: Record<string, string> = {
    complete: '完整',
    partial: '部分异常',
    missing: '缺失',
    success: '成功',
    skipped: '跳过',
    error: '失败',
  };
  const workflowToolStatusLabels: Record<string, string> = {
    success: '成功',
    skipped: '跳过',
    placeholder: '占位',
    error: '失败',
  };
  const workflowTestTraceStatus =
    workflowTestStorageReview?.traceStatus ||
    getAgentWorkflowTraceStatus(workflowTestResult);
  const workflowConfigDiagnostics = buildAgentWorkflowConfigDiagnostics(
    sortedAgents,
    availableTools,
  );
  const workflowRunDiagnostics = buildAgentWorkflowResultDiagnostics(
    workflowTestResult,
  );
  const workflowDecisionPath =
    buildAgentWorkflowDecisionPath(workflowTestResult);
  const workflowRecommendedActions = buildAgentWorkflowRecommendedActions(
    workflowTestResult,
    workflowRunDiagnostics,
  );
  const workflowReadinessChecks =
    buildAgentWorkflowReadinessChecks(workflowTestResult);
  const workflowRunVerdict = buildAgentWorkflowRunVerdict(
    workflowTestResult,
    workflowReadinessChecks,
    workflowRecommendedActions,
  );
  const workflowStructuralCoverage = buildAgentWorkflowStructuralCoverage(
    workflowTestResult,
    sortedAgents,
  );
  const workflowOrchestrationReceipt =
    buildAgentWorkflowOrchestrationReceipt(workflowTestResult, sortedAgents);
  const workflowNotificationReviewReceipt =
    buildAgentWorkflowNotificationReviewReceipt(workflowTestResult);
  const workflowDiagnosticSeverityLabels: Record<string, string> = {
    error: '阻塞',
    warning: '注意',
    info: '提示',
    ok: '通过',
  };
  const workflowDecisionPathStatusLabels: Record<string, string> = {
    success: '通过',
    warning: '注意',
    error: '阻塞',
    info: '提示',
    muted: '跳过',
  };
  const workflowRecommendedActionStatusLabels: Record<string, string> = {
    review: '复核',
    fix: '修复',
    optimize: '优化',
    verify: '确认',
    done: '完成',
  };
  const workflowReadinessStatusLabels: Record<string, string> = {
    ready: '就绪',
    review: '复核',
    blocked: '阻塞',
    skipped: '跳过',
  };
  const workflowRunVerdictStatusLabels: Record<string, string> = {
    ready: '就绪',
    review: '复核',
    blocked: '阻塞',
    idle: '无动作',
  };
  const workflowStructuralCoverageStatusLabels: Record<string, string> = {
    covered: '覆盖',
    partial: '缺口',
    missing: '缺失',
  };
  const workflowOrchestrationReceiptStatusLabels: Record<string, string> = {
    ready: '就绪',
    review: '复核',
    blocked: '阻塞',
    idle: '无动作',
  };
  const workflowSavedRegressionStatusLabels: Record<
    WorkflowSavedRegressionStatus,
    string
  > = {
    same: '通过',
    changed: '变化',
    'no-baseline': '无基线',
    error: '失败',
  };
  const workflowSavedRegressionHasIssues = Boolean(
    workflowSavedRegressionSummary &&
      (workflowSavedRegressionSummary.changed > 0 ||
        workflowSavedRegressionSummary.noBaseline > 0 ||
        workflowSavedRegressionSummary.failed > 0),
  );
  const workflowSavedRegressionAcceptableCount =
    workflowSavedRegressionSummary?.results.filter(
      (item) =>
        (item.status === 'changed' || item.status === 'no-baseline') &&
        item.actual,
    ).length || 0;
  const selectedWorkflowSavedScenario = workflowSavedScenarios.find(
    (scenario) => scenario.id === workflowSavedScenarioSelectedId,
  );
  const selectedWorkflowScenario = getSelectedWorkflowScenario();
  const selectedWorkflowReplaySample = workflowReplaySamples.find(
    (sample) => sample.id === workflowReplaySelectedId,
  );
  const workflowCurrentInputKey =
    buildWorkflowTestInputComparisonKey(workflowTestInput);
  const workflowSameInputSavedScenario = workflowSavedScenarios.find(
    (scenario) =>
      buildWorkflowTestInputComparisonKey(scenario.input) ===
      workflowCurrentInputKey,
  );
  const workflowEvictedSavedScenario =
    !workflowSameInputSavedScenario &&
    workflowSavedScenarios.length >= AGENT_WORKFLOW_SAVED_SCENARIO_LIMIT
      ? workflowSavedScenarios[AGENT_WORKFLOW_SAVED_SCENARIO_LIMIT - 1]
      : null;
  const workflowScenarioSourceReceipt =
    buildAgentWorkflowScenarioSourceReceipt(selectedWorkflowScenario);
  const workflowReplaySourceReceipt = buildAgentWorkflowReplaySourceReceipt(
    selectedWorkflowReplaySample,
    {
      loading: workflowReplayLoading,
      error: workflowReplayError,
      sampleCount: workflowReplaySamples.length,
    },
  );
  const workflowCurrentInputMatchesSavedScenario = Boolean(
    selectedWorkflowSavedScenario &&
      buildWorkflowTestInputComparisonKey(selectedWorkflowSavedScenario.input) ===
        buildWorkflowTestInputComparisonKey(workflowTestInput),
  );
  const workflowResultMatchesSavedScenario = Boolean(
    selectedWorkflowSavedScenario &&
      workflowTestResult &&
      workflowTestResultInput &&
      buildWorkflowTestInputComparisonKey(selectedWorkflowSavedScenario.input) ===
      buildWorkflowTestInputComparisonKey(workflowTestResultInput),
  );
  const selectedWorkflowBaselineConfig =
    selectedWorkflowSavedScenario?.expectedResult?.agentConfigSnapshot;
  const workflowSavedScenarioConfigMatchesCurrent = Boolean(
    !selectedWorkflowBaselineConfig ||
      (workflowCurrentConfigSnapshot &&
        selectedWorkflowBaselineConfig.key === workflowCurrentConfigSnapshot.key),
  );
  const workflowSavedScenarioSourceReceipt =
    buildAgentWorkflowSavedScenarioSourceReceipt(selectedWorkflowSavedScenario, {
      currentInputMatchesScenario: workflowCurrentInputMatchesSavedScenario,
      hasResult: Boolean(workflowTestResult),
      resultMatchesScenario: workflowResultMatchesSavedScenario,
      resultIsStale: workflowResultIsStale,
      agentConfigMatchesBaseline: workflowSavedScenarioConfigMatchesCurrent,
      baselineAgentConfigLabel: formatAgentWorkflowAgentConfigSnapshot(
        selectedWorkflowBaselineConfig,
      ),
      currentAgentConfigLabel: formatAgentWorkflowAgentConfigSnapshot(
        workflowCurrentConfigSnapshot,
      ),
    });
  const workflowSavedScenarioCapacityReceipt =
    buildAgentWorkflowSavedScenarioCapacityReceipt({
      savedScenarioCount: workflowSavedScenarios.length,
      limit: AGENT_WORKFLOW_SAVED_SCENARIO_LIMIT,
      inputHasContent: workflowTestMessageReady,
      replacesExisting: Boolean(workflowSameInputSavedScenario),
      evictedScenarioLabel: workflowEvictedSavedScenario?.label,
    });
  const workflowSavedRegressionScopeReceipt =
    buildAgentWorkflowSavedRegressionScopeReceipt({
      savedScenarioCount: workflowSavedScenarios.length,
      running: workflowSavedRegressionRunning,
      currentIndex: workflowSavedRegressionProgress?.currentIndex,
      currentLabel: workflowSavedRegressionProgress?.label,
      summary: workflowSavedRegressionSummary
        ? {
            total: workflowSavedRegressionSummary.total,
            same: workflowSavedRegressionSummary.same,
            changed: workflowSavedRegressionSummary.changed,
            noBaseline: workflowSavedRegressionSummary.noBaseline,
            failed: workflowSavedRegressionSummary.failed,
          }
        : null,
    });
  const workflowSavedRegressionCoverageReceipt =
    buildAgentWorkflowSavedRegressionCoverageReceipt({
      scenarios: workflowSavedScenarios,
    });
  const workflowRunScopeReceipt = buildAgentWorkflowRunScopeReceipt({
    input: workflowTestInput,
    agentConfig: workflowCurrentConfigSnapshot,
    savedScenarioCount: workflowSavedScenarios.length,
    resultIsStale: workflowResultIsStale,
    selectedSavedScenarioHasBaseline: selectedWorkflowSavedScenario
      ? Boolean(selectedWorkflowSavedScenario.expectedResult)
      : undefined,
    currentInputMatchesSavedScenario: selectedWorkflowSavedScenario
      ? workflowCurrentInputMatchesSavedScenario
      : undefined,
    agentConfigMatchesSavedBaseline:
      selectedWorkflowSavedScenario?.expectedResult
        ? workflowSavedScenarioConfigMatchesCurrent
        : undefined,
  });
  const workflowCurrentResultExpectation = workflowTestResult
    ? buildAgentWorkflowResultExpectation(
        workflowTestResult,
        new Date(),
        sortedAgents,
      )
    : undefined;
  const workflowSavedBaselineRows =
    selectedWorkflowSavedScenario?.expectedResult &&
    workflowCurrentResultExpectation &&
    workflowResultMatchesSavedScenario
      ? buildWorkflowSavedBaselineRows(
          selectedWorkflowSavedScenario.expectedResult,
          workflowCurrentResultExpectation,
        )
      : [];
  const workflowSavedBaselineHasChanges = workflowSavedBaselineRows.some(
    (row) => row.status === 'changed',
  );
  const workflowSavedBaselineDiagnostics =
    selectedWorkflowSavedScenario?.expectedResult?.diagnosticSnapshot;
  const workflowCanUpdateSavedBaseline = Boolean(
    selectedWorkflowSavedScenario &&
      workflowCurrentResultExpectation &&
      workflowResultMatchesSavedScenario &&
      !workflowResultIsStale,
  );
  const workflowSavedBaselineActionLabel =
    selectedWorkflowSavedScenario?.expectedResult
      ? workflowSavedBaselineHasChanges
        ? '接受当前结果为基线'
        : '刷新当前基线'
      : '建立当前结果基线';
  const workflowBaselineWritebackTitle =
    workflowBaselineWritebackReceipt?.title ||
    (workflowBaselineWritebackReceipt?.scope === 'single'
      ? '单条基线写回回执'
      : '批量基线写回回执');
  const workflowBaselineWritebackSummary =
    workflowBaselineWritebackReceipt?.summary ||
    (workflowBaselineWritebackReceipt
      ? `已更新 ${workflowBaselineWritebackReceipt.accepted} 个保存样例：变化 ${workflowBaselineWritebackReceipt.changed} / 无基线 ${workflowBaselineWritebackReceipt.noBaseline}；失败 ${workflowBaselineWritebackReceipt.failed} 个未覆盖；样例总数 ${workflowBaselineWritebackReceipt.total}。`
      : '');
  const workflowBaselineWritebackBoundary =
    workflowBaselineWritebackReceipt?.boundary ||
    '只改写 chrome.storage.local 的 agentWorkflowSavedScenarios 基线；不会写入 Memory Service、发送通知、执行规则自动化、覆盖测试输入或导出原始消息正文。';
  const workflowRunEvidenceQualification = (() => {
    if (!workflowTestResult) return undefined;

    if (workflowResultIsStale) {
      return {
        status: 'stale' as const,
        title: '证据需重跑',
        summary: workflowStaleReason,
        detail:
          '这份证据包只代表上一次运行；复制会标成旧快照，作为当前排障或发布前门禁前请重新运行测试。',
      };
    }

    if (selectedWorkflowSavedScenario) {
      if (!workflowResultMatchesSavedScenario) {
        return {
          status: 'review' as const,
          title: '保存样例未对齐',
          summary: '当前结果不是所选保存样例的运行结果',
          detail:
            '先填入并运行该保存样例，或把当前输入另存为新样例后再建立基线。',
        };
      }

      if (!selectedWorkflowSavedScenario.expectedResult) {
        return {
          status: 'review' as const,
          title: '保存样例无基线',
          summary: '当前结果可用于建立基线，但还不是回归证据',
          detail:
            '点击建立当前结果基线后，后续同一保存样例才能作为本地回归门禁比较。',
        };
      }

      if (!workflowSavedScenarioConfigMatchesCurrent) {
        return {
          status: 'review' as const,
          title: '基线配置已变更',
          summary: '保存样例基线的 Agent 配置不同于当前配置',
          detail:
            '先复核配置差异并刷新基线，避免把配置版本差异误读成消息判断质量漂移。',
        };
      }

      return {
        status: 'ready' as const,
        title: '可作本地回归证据',
        summary: '当前结果匹配保存样例、已有基线且 Agent 配置一致',
        detail:
          '可作为本地发布前门禁证据；复制仍只写入本机剪贴板，不写入 Memory Service。',
      };
    }

    if (selectedWorkflowReplaySample) {
      return {
        status: 'review' as const,
        title: '最近消息回放证据',
        summary: '当前结果来自 Memory Service 召回样本，未绑定保存样例基线',
        detail:
          '适合排障真实样本；作为回归证据前请保存为样例并建立基线。',
      };
    }

    return {
      status: 'review' as const,
      title: '单次调试证据',
      summary: '当前结果未绑定保存样例基线',
      detail:
        '可复制用于排障；作为本地发布前门禁前请保存样例并建立基线。',
    };
  })();
  const workflowRunEvidencePacket = buildAgentWorkflowRunEvidencePacket(
    workflowTestResult,
    sortedAgents,
    {
      stale: workflowResultIsStale,
      staleReason: workflowResultIsStale ? workflowStaleReason : undefined,
      sourceLabel: selectedWorkflowSavedScenario
        ? 'Options 关注项测试 · 保存样例'
        : selectedWorkflowReplaySample
          ? 'Options 关注项测试 · 最近消息回放'
          : 'Options 关注项测试',
      redactedInputContent: workflowTestResultInput?.content,
      qualification: workflowRunEvidenceQualification,
    },
  );
  const workflowRecommendedActionNoEffectBoundary =
    '下一步动作只是本地排障指引；不会自动重跑测试，不会写入 Memory Service，不会发送通知，不会执行规则自动化，不会确认复核候选，不会接入外部 adapter，不会覆盖基线，不会导出报告，也不会复制原始消息正文。';
  const formatWorkflowRecommendedActionBoundary = (
    item: (typeof workflowRecommendedActions)[number],
  ) =>
    [
      `下一步动作 ${workflowRecommendedActionStatusLabels[item.status] || item.status}：${item.title}。`,
      item.summary,
      item.detail,
      workflowRecommendedActionNoEffectBoundary,
    ]
      .filter(Boolean)
      .join(' ');

  const workflowLocalRunNoEffectBoundary =
    '本地测试不会写入 Memory Service、发送通知、执行规则自动化、标记原消息已读或覆盖保存基线。';
  const workflowFormOnlyBoundary =
    '只改写本页测试表单、清空旧结果和本地回执；不会运行 Agent Workflow、写入 Memory Service、发送通知、执行规则自动化、标记原消息已读或覆盖基线。';
  const workflowRunTestControlBoundary = joinAgentWorkflowControlBoundary(
    `${workflowRunButtonLabel}：${
      workflowTestRunning
        ? '正在本页重跑当前表单，输入和来源选择暂时锁定'
        : workflowSavedRegressionRunning
          ? '批量回归正在逐条运行本地保存样例，本按钮等待当前批次结束'
          : !workflowTestMessageReady
            ? '先填写测试消息后才能运行'
            : workflowResultIsStale
              ? '重跑当前表单和当前 Agent 配置，刷新下方旧结果'
              : '只重跑当前表单和当前 Agent 配置，刷新下方诊断'
    }。`,
    workflowLocalRunNoEffectBoundary,
  );
  const workflowScenarioLoadControlBoundary =
    '填入样例：只把所选内置样例复制到本页测试表单。' +
    workflowFormOnlyBoundary;
  const workflowScenarioRunControlBoundary = joinAgentWorkflowControlBoundary(
    `${workflowExecutionBusy ? '测试中' : '运行样例'}：先填入所选内置样例，再在 Options 本地测试面板重跑。`,
    workflowLocalRunNoEffectBoundary,
  );
  const workflowReplayLoadControlBoundary =
    '填入最近消息：只把所选 Memory Service time 召回样本复制到本页测试表单。' +
    workflowFormOnlyBoundary;
  const workflowReplayRunControlBoundary = joinAgentWorkflowControlBoundary(
    `${workflowExecutionBusy ? '测试中' : '回放测试'}：先填入所选最近消息样本，再在 Options 本地测试面板重跑。`,
    workflowLocalRunNoEffectBoundary,
  );
  const workflowReplayRefreshControlBoundary = joinAgentWorkflowControlBoundary(
    `${workflowReplayLoading ? '刷新中' : '刷新最近消息'}：只重新读取 Memory Service time 通道的最近可回放样本。`,
    '不会运行 Agent Workflow、不会写入 Memory Service、不会发送通知、不会执行规则自动化、不会标记原消息已读、不会覆盖基线，也不会证明线上没有相关消息。',
  );
  const workflowSaveScenarioControlBoundary = joinAgentWorkflowControlBoundary(
    '保存当前用例：把当前测试输入写入 chrome.storage.local 的本地保存样例；若当前结果未过期，会一起记录本地基线。',
    workflowSameInputSavedScenario
      ? '同输入只更新这一条保存样例。'
      : workflowEvictedSavedScenario
        ? `已达上限时会移出最旧样例：${workflowEvictedSavedScenario.label}。`
        : '当前还有容量，不会挤掉其他保存样例。',
    '不会写入 Memory Service、发送通知、执行规则自动化、标记原消息已读、导出报告或复制原始消息正文。',
  );
  const workflowSavedLoadControlBoundary =
    '填入保存样例：只把所选本地保存样例复制到本页测试表单。' +
    workflowFormOnlyBoundary;
  const workflowSavedRunControlBoundary = joinAgentWorkflowControlBoundary(
    `${workflowExecutionBusy ? '测试中' : '运行保存样例'}：先填入所选本地保存样例，再用当前 Agent 配置重跑并刷新基线对比。`,
    workflowLocalRunNoEffectBoundary,
  );
  const workflowSavedRegressionControlBoundary = joinAgentWorkflowControlBoundary(
    `${workflowSavedRegressionRunning ? '批量运行中' : '批量回归'}：逐条重跑 chrome.storage.local 中的本地保存样例，并生成本页回归摘要。`,
    '不会覆盖基线、写入 Memory Service、发送通知、执行规则自动化、标记原消息已读、导出报告或复制原始消息正文；接受基线和导出报告需要单独点击。',
  );
  const workflowSavedDeleteControlBoundary = joinAgentWorkflowControlBoundary(
    '删除保存样例：只移除所选 chrome.storage.local 本地保存样例及其本地基线。',
    '不会删除 Memory Service 记忆、移除真实消息、发送通知、执行规则自动化、撤销已导出的报告或改写当前测试输入。',
  );
  const workflowUpdateBaselineControlBoundary = joinAgentWorkflowControlBoundary(
    `${workflowSavedBaselineActionLabel}：只更新所选保存样例在 chrome.storage.local 的本地基线。`,
    selectedWorkflowSavedScenario?.expectedResult
      ? '会覆盖这条样例的原基线。'
      : '会建立后续单条对比和批量回归使用的本地基线。',
    '不会写入 Memory Service、发送通知、执行规则自动化、导出报告、覆盖测试输入或导出原始消息正文。',
  );
  const workflowExportRegressionReportControlBoundary = joinAgentWorkflowControlBoundary(
    '导出报告：只把当前批量回归摘要下载为本机 JSON 文件。',
    workflowSavedRegressionSummary
      ? `当前摘要为总数 ${workflowSavedRegressionSummary.total}、变化 ${workflowSavedRegressionSummary.changed}、无基线 ${workflowSavedRegressionSummary.noBaseline}、失败 ${workflowSavedRegressionSummary.failed}。`
      : '需要先完成一次批量回归。',
    '不会接受基线、写入 Memory Service、发送通知、执行规则自动化、覆盖保存样例或复制原始消息正文。',
  );
  const workflowAcceptRegressionBaselinesControlBoundary = joinAgentWorkflowControlBoundary(
    `接受 ${workflowSavedRegressionAcceptableCount} 个结果为基线：只把变化或无基线样例的本次结果写回 chrome.storage.local 本地基线。`,
    `失败 ${workflowSavedRegressionSummary?.failed || 0} 个不会被覆盖。`,
    '不会写入 Memory Service、发送通知、执行规则自动化、导出报告、标记原消息已读或复制原始消息正文。',
  );
  const workflowCopyEvidenceControlBoundary = joinAgentWorkflowControlBoundary(
    workflowRunEvidenceCopyReceipt?.status === 'pending'
      ? '复制中：正在写入本机剪贴板，测试输入和来源选择暂时锁定。'
      : '复制证据包：只把当前单次运行的脱敏诊断证据写入本机剪贴板。',
    workflowRunEvidencePacket
      ? `证据资格：${workflowRunEvidencePacket.qualification.title}。`
      : '',
    '不会写入 Memory Service、发送通知、执行规则自动化、覆盖基线、导出报告，也不会包含原始消息正文或工具参数。',
  );

  const handleCopyWorkflowRunEvidencePacket = async () => {
    if (!workflowRunEvidencePacket) return;

    setWorkflowRunEvidenceCopyReceipt({
      status: 'pending',
      copiedAt: new Date().toISOString(),
      title: '证据包复制中',
      summary:
        '正在写入本机剪贴板；还没有确认复制成功，测试输入暂时锁定。',
      boundary:
        '等待期间会暂时锁定测试输入、来源选择和基线动作，避免复制中的旧证据被误认为新的当前结果；不会写入 Memory Service、不会发送通知、不会执行规则自动化、不会覆盖基线，也不会导出报告。',
      stale: workflowResultIsStale,
      qualification: workflowRunEvidencePacket.qualification.title,
    });
    setWorkflowSavedScenarioError('');

    try {
      await navigator.clipboard.writeText(workflowRunEvidencePacket.text);
      setWorkflowRunEvidenceCopyReceipt({
        status: 'success',
        copiedAt: new Date().toISOString(),
        title: workflowRunEvidencePacket.title,
        summary: workflowRunEvidencePacket.summary,
        boundary: workflowRunEvidencePacket.boundary,
        stale: workflowResultIsStale,
        qualification: workflowRunEvidencePacket.qualification.title,
      });
      setWorkflowSavedScenarioError('');
    } catch (error) {
      console.error('复制 Agent Workflow 证据包失败:', error);
      const errorMessage =
        error instanceof Error ? error.message : '复制证据包失败';
      setWorkflowRunEvidenceCopyReceipt({
        status: 'error',
        copiedAt: new Date().toISOString(),
        title: '复制证据包失败',
        summary: '剪贴板写入未完成；证据包仍停留在本页。',
        boundary:
          '本次失败不会写入剪贴板、不会导出报告、不会覆盖基线、不会写入 Memory Service、不会发送通知，也不会执行规则自动化。',
        stale: workflowResultIsStale,
        qualification: workflowRunEvidencePacket.qualification.title,
        error: errorMessage,
      });
      setWorkflowSavedScenarioError('');
    }
  };

  const renderWorkflowTestSourceReceipt = (
    receipt: AgentWorkflowTestSourceReceipt,
  ) => (
    <div
      className={`agent-workflow-source-receipt ${receipt.tone}`}
      aria-label={receipt.title}
    >
      <div>
        <strong>{receipt.title}</strong>
        <small>{receipt.summary}</small>
        <em>{receipt.detail}</em>
      </div>
      <div className="agent-workflow-source-receipt-chips">
        {receipt.chips.map((chip) => (
          <span key={chip}>{chip}</span>
        ))}
      </div>
    </div>
  );

  const formatWorkflowTraceDuration = (durationMs?: number) => {
    if (typeof durationMs !== 'number' || !Number.isFinite(durationMs)) {
      return '-';
    }
    return durationMs < 1000
      ? `${Math.round(durationMs)}ms`
      : `${(durationMs / 1000).toFixed(1)}s`;
  };

  const formatWorkflowEntitySummary = (summary: any) => {
    if (!summary || typeof summary !== 'object') return '-';
    return [
      `人 ${summary.people || 0}`,
      `项目 ${summary.projects || 0}`,
      `主题 ${summary.topics || 0}`,
      `行动项 ${summary.actions || 0}`,
    ].join(' / ');
  };

  const workflowTestReviewRows = workflowTestStorageReview
    ? [
        {
          label: '存储原因',
          value:
            workflowTestStorageReview.primaryReason ||
            workflowTestStorageReview.summary ||
            '-',
        },
        {
          label: 'Trace 状态',
          value:
            workflowTraceStatusLabels[workflowTestTraceStatus] ||
            workflowTestTraceStatus,
        },
        {
          label: '匹配规则',
          value:
            (workflowTestStorageReview.matchedRuleRefs || []).join('、') ||
            (workflowTestStorageReview.matchedRuleIds || []).join('、') ||
            '-',
        },
        {
          label: '实体/关系',
          value: `${formatWorkflowEntitySummary(
            workflowTestStorageReview.entitySummary,
          )} / 关系 ${workflowTestStorageReview.relationshipCount || 0}`,
        },
        {
          label: '回复建议',
          value: workflowTestStorageReview.replyAdviceAvailable ? '有' : '无',
        },
        {
          label: '异常',
          value:
            [
              (workflowTestStorageReview.failedAgents || []).join('、'),
              workflowTestStorageReview.toolErrorCount
                ? `工具错误 ${workflowTestStorageReview.toolErrorCount}`
                : '',
              workflowTestStorageReview.toolSkippedCount
                ? `跳过工具 ${workflowTestStorageReview.toolSkippedCount}`
                : '',
              workflowTestStorageReview.toolPlaceholderCount
                ? `占位工具 ${workflowTestStorageReview.toolPlaceholderCount}`
                : '',
            ]
              .filter(Boolean)
              .join('、') || '-',
        },
      ]
    : [];

  const renderWorkflowDiagnostics = (
    diagnostics: AgentWorkflowDiagnostic[],
    emptyMessage: string,
  ) => {
    const okDiagnostic = {
      id: 'ok',
      severity: 'ok',
      title: '检查通过',
      message: emptyMessage,
      detail: undefined,
    } as const;
    const visibleDiagnostics =
      diagnostics.length > 0 ? diagnostics : [okDiagnostic];

    return (
      <div className="agent-workflow-diagnostics">
        {visibleDiagnostics.map((item) => (
          <div
            key={item.id}
            className={`agent-workflow-diagnostic ${item.severity}`}
          >
            <span>
              {workflowDiagnosticSeverityLabels[item.severity] ||
                item.severity}
            </span>
            <strong>{item.title}</strong>
            <small>{item.message}</small>
            {item.detail && <em>{item.detail}</em>}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="agent-settings">
      <div className="agent-workflow-summary">
        <div>
          <span className="agent-summary-value">{enabledAgents.length}</span>
          <span className="agent-summary-label">启用 Agent</span>
        </div>
        <div>
          <span className="agent-summary-value">{enabledToolCount}</span>
          <span className="agent-summary-label">启用工具</span>
        </div>
        <div>
          <span className="agent-summary-value">
            {firstAgent
              ? workflowPhaseMap[firstAgent.id] || firstAgent.name
              : '-'}
          </span>
          <span className="agent-summary-label">首个阶段</span>
        </div>
        <div>
          <span className="agent-summary-value">Storage Review</span>
          <span className="agent-summary-label">记忆审计</span>
        </div>
      </div>

      <div className="agent-audit-strip" aria-label="Agent Workflow 记忆审计字段">
        {storageAuditFields.map((field) => (
          <span key={field} className="agent-audit-chip">
            {field}
          </span>
        ))}
      </div>

      <div className="agent-workflow-diagnostic-block">
        <div className="agent-test-section-title">配置检查</div>
        {renderWorkflowDiagnostics(
          workflowConfigDiagnostics,
          '当前配置未发现阻塞项',
        )}
      </div>

      <div
        className="agent-workflow-test-panel"
        aria-busy={workflowControlLocked}
      >
        <div className="agent-workflow-test-header">
          <div>
            <h3>关注项测试</h3>
          </div>
          <button
            onClick={handleRunWorkflowTest}
            disabled={workflowControlLocked || !workflowTestMessageReady}
            title={workflowRunTestControlBoundary}
            aria-label={workflowRunTestControlBoundary}
          >
            {workflowRunButtonLabel}
          </button>
        </div>
        {renderWorkflowTestSourceReceipt(workflowRunScopeReceipt)}
        <div className="agent-workflow-scenario-row">
          <div className="form-group">
            <label htmlFor="workflowScenario">内置样例</label>
            <select
              id="workflowScenario"
              value={workflowScenarioSelectedId}
              onChange={handleWorkflowScenarioChange}
              disabled={workflowControlLocked}
            >
              {AGENT_WORKFLOW_TEST_SCENARIOS.map((scenario) => (
                <option key={scenario.id} value={scenario.id}>
                  {scenario.label} · {scenario.signal}
                </option>
              ))}
            </select>
          </div>
          <div className="agent-workflow-scenario-actions">
            <button
              type="button"
              onClick={handleLoadWorkflowScenario}
              disabled={workflowControlLocked}
              title={workflowScenarioLoadControlBoundary}
              aria-label={workflowScenarioLoadControlBoundary}
            >
              填入样例
            </button>
            <button
              type="button"
              onClick={handleRunWorkflowScenario}
              disabled={workflowControlLocked}
              title={workflowScenarioRunControlBoundary}
              aria-label={workflowScenarioRunControlBoundary}
            >
              {workflowExecutionBusy ? '测试中...' : '运行样例'}
            </button>
          </div>
        </div>
        {renderWorkflowTestSourceReceipt(workflowScenarioSourceReceipt)}
        <div className="agent-workflow-replay-row">
          <div className="form-group">
            <label htmlFor="workflowReplaySample">最近消息</label>
            <select
              id="workflowReplaySample"
              value={workflowReplaySelectedId}
              onChange={(event) =>
                setWorkflowReplaySelectedId(event.target.value)
              }
              disabled={
                workflowControlLocked ||
                workflowReplayLoading ||
                workflowReplaySamples.length === 0
              }
            >
              {workflowReplaySamples.length === 0 ? (
                <option value="">
                  {workflowReplayLoading ? '加载中...' : '无可用消息'}
                </option>
              ) : (
                workflowReplaySamples.map((sample) => (
                  <option key={sample.id} value={sample.id}>
                    {formatAgentWorkflowReplayLabel(sample)}
                  </option>
                ))
              )}
            </select>
          </div>
          <div className="agent-workflow-replay-actions">
            <button
              type="button"
              onClick={handleLoadWorkflowReplaySample}
              disabled={
                workflowControlLocked ||
                workflowReplayLoading ||
                workflowReplaySamples.length === 0
              }
              title={workflowReplayLoadControlBoundary}
              aria-label={workflowReplayLoadControlBoundary}
            >
              填入
            </button>
            <button
              type="button"
              onClick={handleRunWorkflowReplaySample}
              disabled={
                workflowReplayLoading ||
                workflowControlLocked ||
                workflowReplaySamples.length === 0
              }
              title={workflowReplayRunControlBoundary}
              aria-label={workflowReplayRunControlBoundary}
            >
              {workflowExecutionBusy ? '测试中...' : '回放测试'}
            </button>
            <button
              type="button"
              onClick={loadWorkflowReplaySamples}
              disabled={workflowControlLocked || workflowReplayLoading}
              title={workflowReplayRefreshControlBoundary}
              aria-label={workflowReplayRefreshControlBoundary}
            >
              {workflowReplayLoading ? '刷新中...' : '刷新'}
            </button>
          </div>
        </div>
        {renderWorkflowTestSourceReceipt(workflowReplaySourceReceipt)}
        <div className="agent-workflow-saved-row">
          <div className="form-group">
            <label htmlFor="workflowSavedScenario">保存样例</label>
            <select
              id="workflowSavedScenario"
              value={workflowSavedScenarioSelectedId}
              onChange={(event) => {
                setWorkflowSavedScenarioSelectedId(event.target.value);
                setWorkflowSavedScenarioError('');
                setWorkflowSavedScenarioStatus('');
                setWorkflowSavedRegressionSummary(null);
                setWorkflowBaselineWritebackReceipt(null);
                setWorkflowSavedScenarioDeleteReceipt(null);
              }}
              disabled={
                workflowControlLocked || workflowSavedScenarios.length === 0
              }
            >
              {workflowSavedScenarios.length === 0 ? (
                <option value="">还没有保存样例</option>
              ) : (
                workflowSavedScenarios.map((scenario) => (
                  <option key={scenario.id} value={scenario.id}>
                    {formatAgentWorkflowSavedScenarioLabel(scenario)}
                  </option>
                ))
              )}
            </select>
          </div>
          <div className="agent-workflow-saved-actions">
            <button
              type="button"
              onClick={handleSaveWorkflowScenario}
              disabled={workflowControlLocked || !workflowTestMessageReady}
              title={workflowSaveScenarioControlBoundary}
              aria-label={workflowSaveScenarioControlBoundary}
            >
              保存当前用例
            </button>
            <button
              type="button"
              onClick={handleLoadWorkflowSavedScenario}
              disabled={
                workflowControlLocked || workflowSavedScenarios.length === 0
              }
              title={workflowSavedLoadControlBoundary}
              aria-label={workflowSavedLoadControlBoundary}
            >
              填入
            </button>
            <button
              type="button"
              onClick={handleRunWorkflowSavedScenario}
              disabled={
                workflowControlLocked || workflowSavedScenarios.length === 0
              }
              title={workflowSavedRunControlBoundary}
              aria-label={workflowSavedRunControlBoundary}
            >
              {workflowExecutionBusy ? '测试中...' : '运行保存样例'}
            </button>
            <button
              type="button"
              onClick={handleRunWorkflowSavedRegression}
              disabled={
                workflowControlLocked || workflowSavedScenarios.length === 0
              }
              title={workflowSavedRegressionControlBoundary}
              aria-label={workflowSavedRegressionControlBoundary}
            >
              {workflowSavedRegressionRunning ? '批量运行中...' : '批量回归'}
            </button>
            <button
              type="button"
              onClick={handleDeleteWorkflowSavedScenario}
              disabled={
                workflowControlLocked || workflowSavedScenarios.length === 0
              }
              title={workflowSavedDeleteControlBoundary}
              aria-label={workflowSavedDeleteControlBoundary}
            >
              删除
            </button>
          </div>
        </div>
        {renderWorkflowTestSourceReceipt(workflowSavedScenarioCapacityReceipt)}
        {workflowSavedScenarioDeleteReceipt &&
          renderWorkflowTestSourceReceipt(workflowSavedScenarioDeleteReceipt)}
        {renderWorkflowTestSourceReceipt(workflowSavedScenarioSourceReceipt)}
        {renderWorkflowTestSourceReceipt(workflowSavedRegressionCoverageReceipt)}
        {renderWorkflowTestSourceReceipt(workflowSavedRegressionScopeReceipt)}
        {workflowReplayError && (
          <p className="error-message">{workflowReplayError}</p>
        )}
        {workflowSavedScenarioError && (
          <p className="error-message">{workflowSavedScenarioError}</p>
        )}
        {workflowSavedScenarioStatus && (
          <p className="agent-workflow-saved-status">
            {workflowSavedScenarioStatus}
          </p>
        )}
        {workflowBaselineWritebackReceipt && (
          <div
            className="agent-workflow-baseline-writeback"
            aria-label={`Agent Workflow ${workflowBaselineWritebackTitle}`}
          >
            <span>已写回</span>
            <div>
              <strong>{workflowBaselineWritebackTitle}</strong>
              <small>{workflowBaselineWritebackSummary}</small>
              <em>
                写回时间 {new Date(
                  workflowBaselineWritebackReceipt.updatedAt,
                ).toLocaleString()}
              </em>
              <em>{workflowBaselineWritebackBoundary}</em>
            </div>
          </div>
        )}
        {workflowSavedRegressionSummary && (
          <div
            className={`agent-workflow-regression ${workflowSavedRegressionHasIssues ? 'changed' : 'same'}`}
            aria-label="Agent Workflow 保存样例批量回归"
          >
            <div className="agent-workflow-regression-header">
              <div>
                <div className="agent-test-section-title">
                  保存样例批量回归
                </div>
                {workflowSavedRegressionAcceptableCount > 0 && (
                  <small className="agent-workflow-regression-boundary">
                    接受后只把变化或无基线样例的本次结果写回本地基线；失败项不会被覆盖，也不会写入
                    Memory Service、发送通知、执行规则自动化、导出报告或复制原始消息正文。
                  </small>
                )}
              </div>
              <div className="agent-workflow-regression-actions">
                <button
                  type="button"
                  onClick={handleExportWorkflowRegressionReport}
                  disabled={workflowControlLocked}
                  title={workflowExportRegressionReportControlBoundary}
                  aria-label={workflowExportRegressionReportControlBoundary}
                >
                  导出报告
                </button>
                {workflowSavedRegressionAcceptableCount > 0 && (
                  <button
                    type="button"
                    onClick={handleAcceptWorkflowRegressionBaselines}
                    disabled={workflowControlLocked}
                    title={workflowAcceptRegressionBaselinesControlBoundary}
                    aria-label={workflowAcceptRegressionBaselinesControlBoundary}
                  >
                    接受 {workflowSavedRegressionAcceptableCount} 个结果为基线
                  </button>
                )}
              </div>
            </div>
            <div className="agent-workflow-regression-metrics">
              <span>总数 {workflowSavedRegressionSummary.total}</span>
              <span>通过 {workflowSavedRegressionSummary.same}</span>
              <span>变化 {workflowSavedRegressionSummary.changed}</span>
              <span>无基线 {workflowSavedRegressionSummary.noBaseline}</span>
              <span>失败 {workflowSavedRegressionSummary.failed}</span>
            </div>
            <div className="agent-workflow-regression-list">
              {workflowSavedRegressionSummary.results.map((item) => (
                <div
                  className={`agent-workflow-regression-item ${item.status}`}
                  key={item.id}
                >
                  <span>{workflowSavedRegressionStatusLabels[item.status]}</span>
                  <div>
                    <strong>{item.label}</strong>
                    <small>{item.summary}</small>
                    {item.detail && <em>{item.detail}</em>}
                    {(item.baselineAgentConfig || item.actualAgentConfig) && (
                      <em className="agent-workflow-regression-diagnostics">
                        配置{' '}
                        {item.agentConfigChanged ? '已变更' : '一致或未记录'}
                        ：基线{' '}
                        {formatAgentWorkflowAgentConfigSnapshot(
                          item.baselineAgentConfig,
                        )}
                        ；当前{' '}
                        {formatAgentWorkflowAgentConfigSnapshot(
                          item.actualAgentConfig,
                        )}
                      </em>
                    )}
                    {item.diagnostics && (
                      <em className="agent-workflow-regression-diagnostics">
                        {item.diagnostics.summary}
                      </em>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="agent-workflow-test-grid">
          <div className="form-group">
            <label htmlFor="workflowTestSender">发送者</label>
            <input
              type="text"
              id="workflowTestSender"
              name="sender"
              value={workflowTestInput.sender}
              onChange={handleWorkflowTestInputChange}
              disabled={workflowControlLocked}
            />
          </div>
          <div className="form-group">
            <label htmlFor="workflowTestTeamName">群组</label>
            <input
              type="text"
              id="workflowTestTeamName"
              name="teamName"
              value={workflowTestInput.teamName}
              onChange={handleWorkflowTestInputChange}
              disabled={workflowControlLocked}
            />
          </div>
          <div className="form-group">
            <label htmlFor="workflowTestTeamId">群组 ID</label>
            <input
              type="text"
              id="workflowTestTeamId"
              name="teamId"
              value={workflowTestInput.teamId}
              onChange={handleWorkflowTestInputChange}
              placeholder="可选，用于范围匹配"
              disabled={workflowControlLocked}
            />
          </div>
          <div className="form-group">
            <label htmlFor="workflowTestDatetime">消息时间</label>
            <input
              type="datetime-local"
              id="workflowTestDatetime"
              name="datetime"
              step="1"
              value={workflowTestInput.datetime}
              onChange={handleWorkflowTestInputChange}
              disabled={workflowControlLocked}
            />
          </div>
        </div>
        <div className="form-group">
          <label htmlFor="workflowTestContent">测试消息</label>
          <textarea
            id="workflowTestContent"
            name="content"
            value={workflowTestInput.content}
            onChange={handleWorkflowTestInputChange}
            placeholder="消息内容"
            disabled={workflowControlLocked}
          />
        </div>
        {workflowTestError && (
          <p className="error-message">{workflowTestError}</p>
        )}
        {workflowTestResult && (
          <div
            className={`agent-workflow-test-result ${workflowResultIsStale ? 'stale' : ''}`}
          >
            {workflowResultIsStale && (
              <div className="agent-test-stale-banner" aria-live="polite">
                {workflowStaleReason}，下面仍是上一次运行结果；重新运行后再作为门禁依据。
              </div>
            )}
            <div className="agent-test-decision-row">
              <span
                className={`agent-test-decision ${workflowTestResult.shouldStore ? 'on' : 'off'}`}
              >
                存储 {workflowTestResult.shouldStore ? '是' : '否'}
              </span>
              <span
                className={`agent-test-decision ${workflowTestResult.shouldNotify ? 'on' : workflowTestResult.notificationReview?.required ? 'review' : 'off'}`}
              >
                通知 {workflowTestNotificationLabel}
              </span>
              <span className="agent-test-decision">
                置信度 {formatWorkflowConfidence(workflowTestConfidence)}
              </span>
            </div>
            {workflowSavedBaselineRows.length > 0 && (
              <div
                className={`agent-workflow-baseline ${workflowSavedBaselineHasChanges ? 'changed' : 'same'}`}
                aria-label="Agent Workflow 保存基线对比"
              >
                <div className="agent-workflow-baseline-header">
                  <div>
                    <div className="agent-test-section-title">保存基线对比</div>
                    {workflowSavedBaselineDiagnostics?.summary && (
                      <em className="agent-workflow-baseline-diagnostics">
                        基线诊断：{workflowSavedBaselineDiagnostics.summary}
                      </em>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleUpdateWorkflowSavedBaseline}
                    disabled={
                      workflowExecutionBusy || !workflowCanUpdateSavedBaseline
                    }
                    title={workflowUpdateBaselineControlBoundary}
                    aria-label={workflowUpdateBaselineControlBoundary}
                  >
                    {workflowSavedBaselineActionLabel}
                  </button>
                </div>
                <div className="agent-workflow-baseline-list">
                  {workflowSavedBaselineRows.map((row) => (
                    <div
                      key={row.id}
                      className={`agent-workflow-baseline-item ${row.status}`}
                    >
                      <span>{row.status === 'changed' ? '变化' : '一致'}</span>
                      <strong>{row.label}</strong>
                      <small>
                        基线 {row.expected} / 当前 {row.actual}
                      </small>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {selectedWorkflowSavedScenario &&
              !selectedWorkflowSavedScenario.expectedResult &&
              workflowCanUpdateSavedBaseline && (
                <div
                  className="agent-workflow-baseline no-baseline"
                  aria-label="Agent Workflow 保存基线待建立"
                >
                  <div className="agent-workflow-baseline-header">
                    <div>
                      <div className="agent-test-section-title">保存基线待建立</div>
                      <small>
                        这个保存样例已经跑出结果，但还没有记录可回归的基线。
                      </small>
                    </div>
                    <button
                      type="button"
                      onClick={handleUpdateWorkflowSavedBaseline}
                      disabled={workflowControlLocked}
                      title={workflowUpdateBaselineControlBoundary}
                      aria-label={workflowUpdateBaselineControlBoundary}
                    >
                      {workflowSavedBaselineActionLabel}
                    </button>
                  </div>
                </div>
              )}
            {workflowOrchestrationReceipt && (
              <div
                className={`agent-workflow-orchestration ${workflowOrchestrationReceipt.status}`}
                aria-label="Agent Workflow 编排回执"
              >
                <span>
                  {workflowOrchestrationReceiptStatusLabels[
                    workflowOrchestrationReceipt.status
                  ] || workflowOrchestrationReceipt.status}
                </span>
                <div>
                  <strong>{workflowOrchestrationReceipt.title}</strong>
                  <small>{workflowOrchestrationReceipt.summary}</small>
                  <em>{workflowOrchestrationReceipt.detail}</em>
                  <em>{workflowOrchestrationReceipt.boundary}</em>
                  <div className="agent-workflow-orchestration-chips">
                    {workflowOrchestrationReceipt.chips.map((chip) => (
                      <b key={chip}>{chip}</b>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {workflowRunVerdict && (
              <div
                className={`agent-workflow-verdict ${workflowRunVerdict.status}`}
                aria-label="Agent Workflow 运行结论"
              >
                <span>
                  {workflowRunVerdictStatusLabels[workflowRunVerdict.status] ||
                    workflowRunVerdict.status}
                </span>
                <div>
                  <strong>{workflowRunVerdict.title}</strong>
                  <small>{workflowRunVerdict.summary}</small>
                  {workflowRunVerdict.detail && (
                    <em>{workflowRunVerdict.detail}</em>
                  )}
                </div>
                {workflowRunVerdict.actionLabel && (
                  <b>{workflowRunVerdict.actionLabel}</b>
                )}
              </div>
            )}
            {workflowStructuralCoverage && (
              <div
                className={`agent-workflow-structure ${workflowStructuralCoverage.status}`}
                aria-label="Agent Workflow 结构覆盖回执"
              >
                <span>
                  {workflowStructuralCoverageStatusLabels[
                    workflowStructuralCoverage.status
                  ] || workflowStructuralCoverage.status}
                </span>
                <div>
                  <strong>结构覆盖回执</strong>
                  <small>{workflowStructuralCoverage.summary}</small>
                  {(workflowStructuralCoverage.missingAgents.length > 0 ||
                    workflowStructuralCoverage.missingTools.length > 0 ||
                    workflowStructuralCoverage.issueSummary.length > 0) && (
                    <em>
                      {[
                        workflowStructuralCoverage.missingAgents.length > 0
                          ? `缺阶段 ${workflowStructuralCoverage.missingAgents.join('、')}`
                          : '',
                        workflowStructuralCoverage.missingTools.length > 0
                          ? `缺工具 ${workflowStructuralCoverage.missingTools.join('、')}`
                          : '',
                        ...workflowStructuralCoverage.issueSummary,
                      ]
                        .filter(Boolean)
                        .join('；')}
                    </em>
                  )}
                </div>
              </div>
            )}
            {workflowRunEvidencePacket && (
              <div
                className={`agent-workflow-evidence-packet ${workflowRunEvidencePacket.qualification.status}`}
                aria-label="Agent Workflow 单次运行证据包"
              >
                <div>
                  <strong>{workflowRunEvidencePacket.title}</strong>
                  <small>{workflowRunEvidencePacket.summary}</small>
                  <em>{workflowRunEvidencePacket.detail}</em>
                  <em>{workflowRunEvidencePacket.boundary}</em>
                  {workflowRunEvidenceCopyReceipt && (
                    <em
                      className={`agent-workflow-evidence-copy-receipt ${workflowRunEvidenceCopyReceipt.status}`}
                    >
                      {workflowRunEvidenceCopyReceipt.status === 'pending'
                        ? '证据包复制中'
                        : workflowRunEvidenceCopyReceipt.status === 'success'
                          ? '已复制到本机剪贴板'
                          : '复制证据包失败'}
                      {' · '}
                      {workflowRunEvidenceCopyReceipt.stale ? '旧快照' : '当前结果'}
                      {' · '}
                      {workflowRunEvidenceCopyReceipt.qualification}
                      {' · '}
                      {new Date(
                        workflowRunEvidenceCopyReceipt.copiedAt,
                      ).toLocaleString()}
                      {workflowRunEvidenceCopyReceipt.status === 'pending'
                        ? ` · ${workflowRunEvidenceCopyReceipt.summary} · ${workflowRunEvidenceCopyReceipt.boundary}`
                        : ''}
                      {workflowRunEvidenceCopyReceipt.status === 'error'
                        ? ` · ${workflowRunEvidenceCopyReceipt.summary} · ${workflowRunEvidenceCopyReceipt.boundary}${
                            workflowRunEvidenceCopyReceipt.error
                              ? ` · ${workflowRunEvidenceCopyReceipt.error}`
                              : ''
                          }`
                        : ''}
                    </em>
                  )}
                  <div className="agent-workflow-evidence-chips">
                    {workflowRunEvidencePacket.chips.map((chip) => (
                      <b key={chip}>{chip}</b>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCopyWorkflowRunEvidencePacket}
                  disabled={
                    workflowExecutionBusy ||
                    workflowRunEvidenceCopyReceipt?.status === 'pending'
                  }
                  title={workflowCopyEvidenceControlBoundary}
                  aria-label={workflowCopyEvidenceControlBoundary}
                >
                  {workflowRunEvidenceCopyReceipt?.status === 'pending'
                    ? '复制中'
                    : '复制证据包'}
                </button>
              </div>
            )}
            {workflowDecisionPath.length > 0 && (
              <div className="agent-workflow-path" aria-label="Agent Workflow 决策路径">
                {workflowDecisionPath.map((item) => (
                  <div
                    key={item.id}
                    className={`agent-workflow-path-item ${item.status}`}
                  >
                    <span>
                      {workflowDecisionPathStatusLabels[item.status] ||
                        item.status}
                    </span>
                    <strong>{item.title}</strong>
                    <small>{item.summary}</small>
                    {item.detail && <em>{item.detail}</em>}
                  </div>
                ))}
              </div>
            )}
            {workflowReadinessChecks.length > 0 && (
              <div
                className="agent-workflow-readiness"
                aria-label="Agent Workflow 运行就绪检查"
              >
                <div className="agent-test-section-title">运行就绪检查</div>
                <div className="agent-workflow-readiness-list">
                  {workflowReadinessChecks.map((item) => (
                    <div
                      key={item.id}
                      className={`agent-workflow-readiness-item ${item.status}`}
                    >
                      <span>
                        {workflowReadinessStatusLabels[item.status] ||
                          item.status}
                      </span>
                      <strong>{item.title}</strong>
                      <small>{item.summary}</small>
                      {item.detail && <em>{item.detail}</em>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {workflowRecommendedActions.length > 0 && (
              <div
                className="agent-workflow-next-actions"
                aria-label="Agent Workflow 下一步动作"
              >
                <div className="agent-test-section-title">下一步</div>
                <div
                  className="agent-workflow-next-action-boundary"
                  aria-label="Agent Workflow 下一步动作边界"
                >
                  <strong>下一步动作边界</strong>
                  <small>{workflowRecommendedActionNoEffectBoundary}</small>
                </div>
                <div className="agent-workflow-next-action-list">
                  {workflowRecommendedActions.map((item) => (
                    <div
                      key={item.id}
                      className={`agent-workflow-next-action ${item.status}`}
                      title={formatWorkflowRecommendedActionBoundary(item)}
                      aria-label={formatWorkflowRecommendedActionBoundary(item)}
                    >
                      <span>
                        {workflowRecommendedActionStatusLabels[item.status] ||
                          item.status}
                      </span>
                      <strong>{item.title}</strong>
                      <small>{item.summary}</small>
                      {item.detail && <em>{item.detail}</em>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="agent-workflow-diagnostic-block compact">
              <div className="agent-test-section-title">运行诊断</div>
              {renderWorkflowDiagnostics(
                workflowRunDiagnostics,
                '本次 trace 未发现阻塞项',
              )}
            </div>
            {workflowNotificationReviewReceipt && (
              <div className="agent-test-review-banner">
                <strong>{workflowNotificationReviewReceipt.title}</strong>
                <small>{workflowNotificationReviewReceipt.summary}</small>
                <em>{workflowNotificationReviewReceipt.detail}</em>
                <em>{workflowNotificationReviewReceipt.boundary}</em>
              </div>
            )}
            <div className="agent-test-summary">
              {workflowTestResult.summary || '未生成摘要'}
            </div>
            {workflowTestReviewRows.length > 0 && (
              <div
                className="agent-test-review-grid"
                aria-label="Agent Workflow 存储审计"
              >
                {workflowTestReviewRows.map((row) => (
                  <div key={row.label} className="agent-test-review-item">
                    <span>{row.label}</span>
                    <strong>{row.value}</strong>
                  </div>
                ))}
              </div>
            )}
            {workflowTestTrace.length > 0 && (
              <div
                className={`agent-test-trace ${workflowTestTraceStatus}`}
                aria-label="Agent Workflow 执行 Trace"
              >
                <div className="agent-test-section-title">执行 Trace</div>
                {workflowTestTrace.map((step: any) => (
                  <details
                    key={`${step.agentId}-${step.startedAt}`}
                    className={`agent-test-trace-step ${step.status}`}
                    open={step.status === 'error'}
                  >
                    <summary>
                      <span className="agent-test-trace-main">
                        <span>
                          {workflowPhaseMap[step.agentId] || step.agentName}
                        </span>
                        <small>{step.outputSummary || '未生成输出摘要'}</small>
                      </span>
                      <span className="agent-test-trace-meta">
                        <strong>
                          {workflowTraceStatusLabels[step.status] ||
                            step.status}
                        </strong>
                        <span>
                          {formatWorkflowTraceDuration(step.durationMs)}
                        </span>
                      </span>
                    </summary>
                    {step.error && (
                      <div className="agent-test-trace-error">{step.error}</div>
                    )}
                    {Array.isArray(step.tools) && step.tools.length > 0 && (
                      <div className="agent-test-tool-list">
                        {step.tools.map((tool: any) => (
                          <div
                            key={`${step.agentId}-${tool.name}`}
                            className={`agent-test-tool ${tool.status}`}
                          >
                            <span>{tool.displayName || tool.name}</span>
                            <strong>
                              {workflowToolStatusLabels[tool.status] ||
                                tool.status}
                            </strong>
                            <small>
                              {tool.summary || tool.error || '无摘要'}
                            </small>
                          </div>
                        ))}
                      </div>
                    )}
                  </details>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <h3>执行顺序</h3>
      {loading ? (
        <p>加载中...</p>
      ) : (
        <div className="agent-flow-list">
          {sortedAgents.map((agent, index) => (
            <div
              key={agent.id}
              className={`agent-flow-card ${agent.enabled === false ? 'disabled' : ''}`}
            >
              <div className="agent-flow-index">{index + 1}</div>
              <div className="agent-flow-main">
                <div className="agent-flow-title-row">
                  <div>
                    <div className="agent-flow-phase">
                      {workflowPhaseMap[agent.id] || '自定义阶段'}
                    </div>
                    <div className="agent-flow-name">{agent.name}</div>
                  </div>
                  <div className="agent-flow-meta">
                    <span className="agent-priority">
                      P{agent.priority || 0}
                    </span>
                    <span
                      className={`agent-state ${agent.enabled === false ? 'off' : 'on'}`}
                    >
                      {agent.enabled === false ? '停用' : '启用'}
                    </span>
                  </div>
                </div>
                <div className="agent-flow-description">
                  {agent.description || agent.id}
                </div>
                <div className="agent-tool-chips">
                  {(agent.tools || []).map((tool: string) => (
                    <span key={tool} className="agent-tool-chip">
                      {toolNameMap[tool] || tool}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <h3>添加自定义 Agent</h3>
      {errorMsg && <p className="error-message">{errorMsg}</p>}

      <div className="form-group">
        <label htmlFor="agentId">Agent ID</label>
        <input
          type="text"
          id="agentId"
          name="id"
          value={newAgent.id}
          onChange={handleNewAgentChange}
          placeholder="自定义Agent的唯一标识符"
        />
      </div>

      <div className="form-group">
        <label htmlFor="agentName">名称</label>
        <input
          type="text"
          id="agentName"
          name="name"
          value={newAgent.name}
          onChange={handleNewAgentChange}
          placeholder="Agent的显示名称"
        />
      </div>

      <div className="form-group">
        <label htmlFor="agentDescription">描述</label>
        <textarea
          id="agentDescription"
          name="description"
          value={newAgent.description}
          onChange={handleNewAgentChange}
          placeholder="Agent的功能描述"
        />
      </div>

      <div className="form-group">
        <label htmlFor="agentPriority">优先级</label>
        <input
          type="number"
          id="agentPriority"
          name="priority"
          value={newAgent.priority}
          onChange={handleNewAgentChange}
          min="1"
          max="100"
        />
        <span className="form-note">1-100，值越大优先级越高</span>
      </div>

      <div className="form-group">
        <label>可用工具</label>
        <div className="tools-list">
          {availableTools.map((tool) => (
            <div key={tool} className="tool-item">
              <label>
                <input
                  type="checkbox"
                  name={tool}
                  checked={newAgent.tools.includes(tool)}
                  onChange={handleToolChange}
                />
                {toolNameMap[tool] || tool}
              </label>
            </div>
          ))}
        </div>
      </div>

      <div className="agent-form-preview" aria-live="polite">
        <span>预计顺序</span>
        <strong>{previewOrder ? `#${previewOrder}` : '-'}</strong>
        <span>{selectedToolLabels || '未选择工具'}</span>
      </div>

      <button
        onClick={handleAddAgent}
        disabled={!canAddAgent || workflowControlLocked}
      >
        添加 Agent
      </button>
    </div>
  );
};

const agent = new IntelligentAgent();

// 智能Agent系统设置组件
const IntelligentAgentSettings = () => {
  const [tools, setTools] = useState<AgentToolDescription[]>([]);
  const [demoMode, setDemoMode] = useState(false);
  const [demoThoughtProcess, setDemoThoughtProcess] = useState<any[]>([]);
  const [demoResult, setDemoResult] = useState<any>(null);
  const demoRunRef = useRef(0);

  const getToolLabel = (toolId: string) => {
    return tools.find((tool) => tool.id === toolId)?.name || toolId;
  };

  const formatToolParameters = (tool: AgentToolDescription) => {
    if (!tool.parameters || tool.parameters.length === 0) {
      return '无参数';
    }

    return tool.parameters
      .map((param) => `${param.name}${param.required ? '*' : ''}`)
      .join('、');
  };

  const formatToolEffect = (effect: AgentToolDescription['effect']) => {
    const labels: Record<AgentToolDescription['effect'], string> = {
      read: '只读',
      external_read: '外部只读',
      write: '写入',
      notify: '通知',
      delete: '删除',
    };
    return labels[effect] || effect;
  };

  const formatToolRisk = (riskLevel: AgentToolDescription['riskLevel']) => {
    const labels: Record<AgentToolDescription['riskLevel'], string> = {
      low: '低风险',
      medium: '中风险',
      high: '高风险',
    };
    return labels[riskLevel] || riskLevel;
  };

  // 获取可用工具
  useEffect(() => {
    try {
      const availableTools = agent.getToolCatalog();
      setTools(availableTools);
    } catch (error) {
      console.error('加载工具失败:', error);
    }
  }, []);

  // 启动演示模式
  const startDemo = () => {
    const runId = demoRunRef.current + 1;
    demoRunRef.current = runId;
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const isDemoRunActive = () => demoRunRef.current === runId;

    setDemoMode(true);
    setDemoThoughtProcess([]);
    setDemoResult(null);

    const historyToolId = 'historySearch';
    const jiraToolId = 'jiraQuery';
    const historyToolName = getToolLabel(historyToolId);
    const jiraToolName = getToolLabel(jiraToolId);
    const approvalTailToken = 'approval-tail-token-visible-in-ui';
    const notificationApprovalKey =
      'messageNotification:{"channel":"project-alerts","message":"提醒团队确认 PROJ-1001 的 2026-05-12 截止时间，并同步 owner、风险级别和下一步行动，这是一段较长的待确认通知参数，用来验证完整批准 key 不会在界面里被截断。","reason":"deadline-risk-review","token":"approval-tail-token-visible-in-ui"}';

    // 模拟思考过程
    const simulateThoughtProcess = async () => {
      // 模拟初始思考
      await wait(1000);
      if (!isDemoRunActive()) return;
      setDemoThoughtProcess([
        {
          timestamp: Date.now(),
          thought:
            '收到一条项目状态消息，需要先确认是否和用户近期关注的上下文相关。',
          publicSummary: `准备调用 ${historyToolName} 判断这条项目消息是否属于近期关注上下文。`,
          action: 'use_tool',
          toolUsed: historyToolId,
          result: {
            [historyToolId]: {
              message: '找到 2 条相关历史消息：上周讨论过 PROJ-1001 的交付风险和截止时间。',
              result: [
                {
                  summary: 'PROJ-1001 需要在下周前完成主要开发。',
                  sender: 'Product Lead',
                },
                {
                  summary: '用户关注该项目是否需要升级风险。',
                  sender: 'Current User',
                },
              ],
            },
          },
        },
      ]);

      // 模拟历史搜索后的判断
      await wait(2000);
      if (!isDemoRunActive()) return;
      setDemoThoughtProcess((prev) => [
        ...prev,
        {
          timestamp: Date.now(),
          thought:
            '历史消息显示该项目是近期关注对象。消息里出现了明确的 JIRA key，需要查询任务状态后再决定是否通知。',
          publicSummary: `准备调用 ${jiraToolName} 补充任务状态和截止时间证据。`,
          action: 'use_tool',
          toolUsed: jiraToolId,
          result: {
            [jiraToolId]: {
              message: '[PROJ-1001][In Progress] 查询数据：示例项目任务，预计下周完成。',
              type: 'single',
              result: {
                key: 'PROJ-1001',
                summary: '示例项目任务',
                status: 'In Progress',
                assignee: '开发人员A',
                duedate: '2026-05-12',
              },
            },
          },
        },
      ]);

      // 模拟工具成功但没有返回证据
      await wait(1200);
      if (!isDemoRunActive()) return;
      setDemoThoughtProcess((prev) => [
        ...prev,
        {
          timestamp: Date.now(),
          thought:
            '模型尝试用更窄的关键词补充历史证据，但工具返回空结果。系统需要把这类空证据前置，避免误判为成功调用。',
          publicSummary: `准备调用 ${historyToolName} 验证更窄关键词下是否还有补充证据。`,
          action: 'use_tool',
          toolUsed: historyToolId,
          result: {
            [historyToolId]: {
              message: '没有找到匹配的历史消息。',
              result: [],
            },
          },
        },
      ]);

      // 模拟重复工具调用被跳过
      await wait(2000);
      if (!isDemoRunActive()) return;
      setDemoThoughtProcess((prev) => [
        ...prev,
        {
          timestamp: Date.now(),
          thought:
            '模型再次提出用同样参数查询历史消息。系统已经有相同工具结果，因此跳过重复调用并保留已有证据。',
          publicSummary: `检测到 ${historyToolName} 的重复参数，本轮跳过重复调用。`,
          action: 'use_tool',
          toolUsed: historyToolId,
          result: {
            [historyToolId]: {
              skipped: true,
              message: '已跳过重复工具调用',
            },
          },
        },
      ]);

      // 模拟无效工具调用被阻断
      await wait(1600);
      if (!isDemoRunActive()) return;
      setDemoThoughtProcess((prev) => [
        ...prev,
        {
          timestamp: Date.now(),
          thought:
            '模型提出了一个未注册工具调用。系统在执行前完成校验，阻断该调用并提示当前可用工具。',
          publicSummary: '未注册工具未通过执行前校验，系统已阻断调用。',
          action: 'use_tool',
          toolUsed: 'orgStructure',
          result: {
            orgStructure: {
              blocked: true,
              message: '工具 orgStructure 未注册，已阻断调用。当前可用工具: historySearch, jiraQuery',
            },
          },
        },
      ]);

      // 模拟需要人工确认的工具调用
      await wait(1400);
      if (!isDemoRunActive()) return;
      setDemoThoughtProcess((prev) => [
        ...prev,
        {
          timestamp: Date.now(),
          thought:
            '模型建议发出项目风险通知。系统识别这是外部通知动作，未获得用户确认前暂停执行。',
          publicSummary:
            '通知动作需要人工确认，系统已暂停执行并生成精确批准 key。',
          action: 'use_tool',
          toolUsed: 'messageNotification',
          result: {
            messageNotification: {
              blocked: true,
              approvalRequired: true,
              reason: 'approval_required',
              effect: 'notify',
              riskLevel: 'medium',
              safetyNote:
                '示例通知动作：只允许发送给项目告警渠道，不应外发到个人私聊。',
              message:
                `工具 messageNotification 属于中风险通知动作，需要人工确认，已阻断执行。 批准 key: ${notificationApprovalKey}`,
              approvalKey: notificationApprovalKey,
              params: {
                channel: 'project-alerts',
                reason: 'deadline-risk-review',
                token: approvalTailToken,
              },
            },
          },
        },
      ]);

      // 模拟预算耗尽后的阶段性判断
      await wait(2000);
      if (!isDemoRunActive()) return;
      setDemoThoughtProcess((prev) => [
        ...prev,
        {
          timestamp: Date.now(),
          thought:
            '行动预算已经用完；本轮已有足够信息给出阶段性判断，但仍有待确认通知、阻断工具和空证据需要用户处理后重跑。',
          publicSummary:
            '已达到最大行动次数；请先处理待确认动作、阻断工具和证据不足后再重跑。',
          action: 'max_actions_reached',
        },
      ]);

      // 设置最终结果
      await wait(1600);
      if (!isDemoRunActive()) return;
      setDemoResult({
        isImportant: true,
        shouldStore: true,
        shouldNotify: false,
        confidence: 0.85,
        summary:
          '阶段性结论：项目 PROJ-1001 仍在进行中，预计 2026-05-12 完成；本次消息应沉淀为项目进展，但通知动作仍需人工确认。',
        reasonsToStore: [
          `通过 ${historyToolName} 确认为近期关注项目`,
          `通过 ${jiraToolName} 获得任务状态和截止时间`,
          '精确历史查询未返回补充证据，已在运行检查中标记',
          '本轮重复工具调用已被跳过，避免浪费和重复证据',
          '外部通知动作进入待确认状态，未在演示中自动执行',
        ],
      });
    };

    simulateThoughtProcess();
  };

  // 停止演示
  const stopDemo = () => {
    demoRunRef.current += 1;
    setDemoMode(false);
    setDemoThoughtProcess([]);
    setDemoResult(null);
  };

  return (
    <div className="intelligent-agent-settings">
      <h3>可用工具列表</h3>
      <div className="tools-table-container">
        <table className="tools-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>名称</th>
              <th>描述</th>
              <th>安全边界</th>
              <th>参数</th>
            </tr>
          </thead>
          <tbody>
            {tools.map((tool) => (
              <tr key={tool.id}>
                <td>{tool.id}</td>
                <td>{tool.name}</td>
                <td>{tool.description}</td>
                <td>
                  <div className="tool-safety">
                    <span className={`tool-safety-badge effect ${tool.effect}`}>
                      {formatToolEffect(tool.effect)}
                    </span>
                    <span className={`tool-safety-badge risk ${tool.riskLevel}`}>
                      {formatToolRisk(tool.riskLevel)}
                    </span>
                    <span
                      className={`tool-safety-badge approval ${
                        tool.requiresHumanApproval ? 'required' : 'clear'
                      }`}
                    >
                      {tool.requiresHumanApproval ? '需要确认' : '无需确认'}
                    </span>
                    {tool.safetyNote && (
                      <small className="tool-safety-note">
                        {tool.safetyNote}
                      </small>
                    )}
                  </div>
                </td>
                <td>{formatToolParameters(tool)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="demo-section">
        <h3>流程演示</h3>
        <div className="demo-controls">
          {!demoMode ? (
            <button onClick={startDemo}>启动演示</button>
          ) : (
            <button onClick={stopDemo}>停止演示</button>
          )}
        </div>

        {demoMode && (
          <>
            <AgentVisualizer
              thoughtProcess={demoThoughtProcess}
              isProcessing={demoResult === null}
            />

            <AgentFlowVisualizer thoughtProcess={demoThoughtProcess} />

            {demoResult && (
              <AgentResultSummary
                result={demoResult}
                thoughtProcess={demoThoughtProcess}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
};

ReactDOM.render(<Options />, document.getElementById('options-root'));
