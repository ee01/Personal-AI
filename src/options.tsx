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
import { agentCoordinator } from './agentWorkflow';
import {
  AGENT_WORKFLOW_TEST_SCENARIOS,
  buildAgentWorkflowScenarioInput,
  buildAgentWorkflowReplayMessages,
  formatAgentWorkflowReplayLabel,
  formatAgentWorkflowDatetimeInputValue,
  normalizeAgentWorkflowInputDatetime,
  type AgentWorkflowTestInput,
  type AgentWorkflowReplayMessage,
} from './agentWorkflowReplay';
import {
  buildAgentWorkflowDecisionPath,
  buildAgentWorkflowConfigDiagnostics,
  buildAgentWorkflowResultDiagnostics,
  type AgentWorkflowDiagnostic,
} from './agentWorkflowDiagnostics';
import { IntelligentAgent, type AgentToolDescription } from './agentThinking';
import {
  AgentVisualizer,
  AgentFlowVisualizer,
  AgentResultSummary,
} from './agent-visualizer';
import {
  CONTEXT_SITE_MUTE_STORAGE_KEY,
  formatContextSiteMuteRemaining,
  getContextSiteMuteExpiresAt,
  pruneContextSiteMuteRecord,
} from './web-intelligence/contextRecallGuards';

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

interface MemoryImportResponse {
  mode: 'merge' | 'replace';
  importedAt: string;
  restoredLayers: Array<'A' | 'B'>;
  database: {
    action: 'merged' | 'replaced';
    changedRows?: number;
    tableChanges?: Record<string, number>;
    skippedTables?: string[];
  };
  files: {
    written: number;
    overwritten: number;
    preserved: number;
    deleted: number;
    writtenPaths: string[];
    overwrittenPaths: string[];
    preservedPaths: string[];
    deletedPaths: string[];
  };
  warnings: string[];
}

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

const sanitizeLocalEnvConfig = (
  targetConfig: EnvConfigType,
): EnvConfigType => ({
  ...normalizeEnvConfigShape(targetConfig),
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

interface ToggleFieldProps {
  id: string;
  name: string;
  checked: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  label: string;
  description?: React.ReactNode;
  disabled?: boolean;
}

const ToggleField = ({
  id,
  name,
  checked,
  onChange,
  label,
  description,
  disabled = false,
}: ToggleFieldProps) => (
  <div className="form-group">
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '16px',
      }}
    >
      <div style={{ flex: 1 }}>
        <label
          htmlFor={id}
          style={{
            display: 'block',
            fontWeight: 600,
            cursor: disabled ? 'not-allowed' : 'pointer',
          }}
        >
          {label}
        </label>
        {description && (
          <small style={{ color: '#666', display: 'block', marginTop: '5px' }}>
            {description}
          </small>
        )}
      </div>
      <label
        htmlFor={id}
        style={{
          position: 'relative',
          display: 'inline-flex',
          width: '46px',
          height: '28px',
          flexShrink: 0,
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      >
        <input
          type="checkbox"
          id={id}
          name={name}
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          style={{
            opacity: 0,
            width: 0,
            height: 0,
            position: 'absolute',
          }}
        />
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '999px',
            backgroundColor: disabled
              ? '#d0d7de'
              : checked
                ? '#2ecc71'
                : '#c7ccd1',
            transition: 'background-color 0.2s ease',
          }}
        />
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: '3px',
            left: checked ? '21px' : '3px',
            width: '22px',
            height: '22px',
            borderRadius: '50%',
            backgroundColor: '#fff',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.24)',
            transition: 'left 0.2s ease',
          }}
        />
      </label>
    </div>
  </div>
);

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
        Meeting Pilot 仅在 Local only 模式下尝试使用它；Auto 模式会优先
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

function DesktopASRStatusPanel({ enabled }: { enabled: boolean }) {
  const [status, setStatus] = React.useState<{
    ok: boolean;
    modelName?: string;
    modelPath?: string;
    modelReady?: boolean;
    whisperBinaryAvailable?: boolean;
    whisperBinaryPath?: string;
    whisperBinaryInstallInProgress?: boolean;
    whisperBinaryInstallProgress?: number;
    whisperBinaryInstallError?: string;
    downloadInProgress?: boolean;
    downloadProgress?: number;
    engineLoaded?: boolean;
    error?: string;
  } | null>(null);
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

  const requestDesktopStatusDirectly = async (): Promise<{
    ok: boolean;
    modelName?: string;
    modelPath?: string;
    modelReady?: boolean;
    whisperBinaryAvailable?: boolean;
    whisperBinaryPath?: string;
    whisperBinaryInstallInProgress?: boolean;
    whisperBinaryInstallProgress?: number;
    whisperBinaryInstallError?: string;
    downloadInProgress?: boolean;
    downloadProgress?: number;
    engineLoaded?: boolean;
    error?: string;
  }> => {
    return requestDesktopDirectly({
      method: 'GET',
      path: '/whisper/status',
    });
  };

  const ensureModelDirectly = async (): Promise<void> => {
    const result = await requestDesktopDirectly<{
      ok?: boolean;
      error?: string;
    }>({
      method: 'POST',
      path: '/whisper/model/ensure',
      body: {},
    });
    if (result.ok === false) {
      throw new Error(result.error || 'Desktop app model ensure failed');
    }
  };

  const maybeAutoEnsureModel = (
    nextStatus: {
      ok: boolean;
      modelReady?: boolean;
      downloadInProgress?: boolean;
    },
    ensureModel: () => Promise<void>,
  ) => {
    if (
      !nextStatus.ok ||
      nextStatus.modelReady ||
      nextStatus.downloadInProgress ||
      autoEnsureModelRequestedRef.current
    ) {
      return;
    }
    autoEnsureModelRequestedRef.current = true;
    void ensureModel().catch(() => {
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
          modelName?: string;
          modelPath?: string;
          modelReady?: boolean;
          whisperBinaryAvailable?: boolean;
          whisperBinaryPath?: string;
          whisperBinaryInstallInProgress?: boolean;
          whisperBinaryInstallProgress?: number;
          whisperBinaryInstallError?: string;
          downloadInProgress?: boolean;
          downloadProgress?: number;
          engineLoaded?: boolean;
          error?: string;
        }>({
          method: 'GET',
          path: '/whisper/status',
        });
        if (!cancelled) {
          setStatus(
            res.ok
              ? res
              : { ok: false, error: res.error || 'Desktop app not running' },
          );
          maybeAutoEnsureModel(res, async () => {
            await sendWhisperRequest({
              method: 'POST',
              path: '/whisper/model/ensure',
              body: {},
            });
          });
        }
      } catch (error) {
        try {
          const directStatus = await requestDesktopStatusDirectly();
          if (!cancelled) {
            setStatus(directStatus);
            maybeAutoEnsureModel(directStatus, ensureModelDirectly);
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
          <small style={{ color: status.modelReady ? '#16a34a' : '#d97706' }}>
            Model:{' '}
            {status.modelName ? `${status.modelName} · ` : ''}
            {status.modelReady
              ? 'Ready'
              : status.downloadInProgress
                ? `Downloading ${status.downloadProgress ?? 0}%`
                : 'Not downloaded'}
          </small>
          <small
            style={{
              color: status.whisperBinaryAvailable ? '#16a34a' : '#dc2626',
              display: 'block',
              marginTop: 4,
            }}
          >
          Whisper binary:{' '}
          {status.whisperBinaryAvailable
            ? status.whisperBinaryPath || 'Found'
            : status.whisperBinaryInstallInProgress
              ? `Installing ${status.whisperBinaryInstallProgress ?? 0}%`
              : 'Missing'}
        </small>
          <small style={{ color: '#6b7280', display: 'block', marginTop: 4 }}>
            Desktop app connected
            {status.engineLoaded ? ' · Whisper engine loaded' : ''}
          </small>
          {status.whisperBinaryInstallError ? (
            <small style={{ color: '#dc2626', display: 'block', marginTop: 4 }}>
              Whisper binary install failed: {status.whisperBinaryInstallError}
            </small>
          ) : null}
          {!status.whisperBinaryAvailable &&
          !status.whisperBinaryInstallInProgress ? (
            <small style={{ color: '#6b7280', display: 'block', marginTop: 4 }}>
              Desktop app 会自动安装本地 Whisper binary。安装完成后 Local
              Whisper 才会真正转录。
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

function ContextSiteMuteSettings() {
  const [mutedSites, setMutedSites] = React.useState<ContextMutedSiteView[]>(
    [],
  );
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

  const refreshMutedSites = async (nextMessage = '') => {
    setLoading(true);
    try {
      const record = await readMutedSiteRecord();
      setMutedSites(toMutedSiteViews(record));
      setMessage(nextMessage);
    } catch (error) {
      console.warn('Failed to load context site mutes:', error);
      setMessage('读取静默站点失败');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    void refreshMutedSites();
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
      setMessage(`已恢复 ${host} 的网页记忆提示`);
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
      setMessage('已恢复全部网页记忆提示站点');
    } catch (error) {
      console.warn('Failed to clear context site mutes:', error);
      setMessage('恢复全部站点失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="form-group">
      <label>网页记忆提示静默站点</label>
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
            管理右下角记忆卡片里选择“此网站今天不提示”的站点。
          </small>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => refreshMutedSites('已刷新静默站点')}
              disabled={loading}
              style={{ fontSize: 12, padding: '4px 10px' }}
            >
              刷新
            </button>
            <button
              type="button"
              onClick={clearMutedSites}
              disabled={loading || mutedSites.length === 0}
              style={{ fontSize: 12, padding: '4px 10px' }}
            >
              全部恢复
            </button>
          </div>
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
  const outreachConfigSectionRef = useRef<HTMLDivElement | null>(null);
  const meetingPilotConfigSectionRef = useRef<HTMLDivElement | null>(null);
  const [config, setConfig] = useState<EnvConfigType>({ ...defaultEnvConfig });
  const [status, setStatus] = useState<{
    message: string;
    type: 'success' | 'error' | '';
  }>({
    message: '',
    type: '',
  });
  const memoryImportInputRef = useRef<HTMLInputElement | null>(null);
  const [isDreamDigestPushing, setIsDreamDigestPushing] = useState(false);
  const [isWeeklyReportPushing, setIsWeeklyReportPushing] = useState(false);
  const [isMemoryExporting, setIsMemoryExporting] = useState(false);
  const [isMemoryImporting, setIsMemoryImporting] = useState(false);
  const [replaceMemoryOnImport, setReplaceMemoryOnImport] = useState(false);
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
    chrome.storage.local.get(['envConfig'], (result) => {
      console.log('result', result);
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
    });
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
    const result = await chrome.storage.local.get(['userinfo']);
    const username = result?.userinfo?.username?.trim();
    const userId = username || 'default';
    const headers: Record<string, string> = {
      Accept: options?.accept || 'application/json',
      'X-User-Id': userId,
    };
    if (options?.contentType !== null) {
      headers['Content-Type'] = options?.contentType || 'application/json';
    }
    if (targetConfig.MEMORY_SERVICE_API_KEY) {
      headers['Authorization'] =
        `Bearer ${targetConfig.MEMORY_SERVICE_API_KEY}`;
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

  const parseContentDispositionFilename = (
    contentDisposition: string | null,
  ) => {
    if (!contentDisposition) {
      return null;
    }

    const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match?.[1]) {
      try {
        return decodeURIComponent(utf8Match[1]);
      } catch {
        return utf8Match[1];
      }
    }

    const filenameMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
    return filenameMatch?.[1] || null;
  };

  const readResponseErrorMessage = async (response: Response) => {
    const rawText = await response.text();
    try {
      const payload = JSON.parse(rawText);
      return (
        payload?.error || payload?.message || response.statusText || '请求失败'
      );
    } catch {
      return rawText || response.statusText || '请求失败';
    }
  };

  const formatExportTimestamp = (iso?: string) => {
    const source = iso || new Date().toISOString();
    return source.replace(/\.\d{3}Z$/, 'Z').replace(/[:]/g, '-');
  };

  const ensureMemoryServiceConfigured = () => {
    if (!config.MEMORY_SERVICE_BASE_URL) {
      setStatus({
        message: '请先配置 Memory Service API 地址',
        type: 'error',
      });
      return false;
    }
    return true;
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
            : prev.OPENCLAW_ENABLED,
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

      if (config.OPENCLAW_ENABLED && !(config.OPENCLAW_BASE_URL || '').trim()) {
        setStatus({
          message: '启用 OpenClaw 时，需填写 OpenClaw Base URL',
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
      const openClawApiKey = (config.OPENCLAW_API_KEY || '').trim();
      const clearOpenClawApiKey =
        Boolean(config.OPENCLAW_CLEAR_API_KEY) && openClawApiKey.length === 0;
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
        openClawEnabled: config.OPENCLAW_ENABLED,
        openClawBaseUrl: (config.OPENCLAW_BASE_URL || '').trim(),
        openClawTimeoutMs: Math.max(
          MIN_OPENCLAW_TIMEOUT_SECONDS * 1000,
          Number(config.OPENCLAW_TIMEOUT_MS) || 600000,
        ),
        clearOpenClawApiKey,
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
    const validationError = validatePushTargets(config, [
      'DREAM_INSIGHT_PUSH_TARGET',
    ]);
    if (validationError) {
      setStatus({ message: validationError, type: 'error' });
      return;
    }
    setIsDreamDigestPushing(true);
    try {
      const headers = await getRequestHeaders(config);
      const dreamInsightPushTarget = resolvePushTargetValue(
        config.DREAM_INSIGHT_PUSH_TARGET,
        'me',
        true,
      );
      const response = await fetch(
        `${config.MEMORY_SERVICE_BASE_URL}/dream-digest/push-now`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            force: true,
            dreamDigestPushTarget: dreamInsightPushTarget,
            dreamDigestPushGroupId:
              (config.DREAM_INSIGHT_PUSH_GROUP_ID || '').trim() || undefined,
          }),
        },
      );
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.error || '推送失败');
      }
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
      setStatus({
        message: `立即推送失败: ${(error as Error).message}`,
        type: 'error',
      });
    } finally {
      setIsDreamDigestPushing(false);
    }
  };

  const handlePushWeeklyReportNow = async () => {
    const validationError = validatePushTargets(config, [
      'WEEKLY_REPORT_PUSH_TARGET',
    ]);
    if (validationError) {
      setStatus({ message: validationError, type: 'error' });
      return;
    }
    setIsWeeklyReportPushing(true);
    try {
      const headers = await getRequestHeaders(config);
      const weeklyReportPushTarget = resolvePushTargetValue(
        config.WEEKLY_REPORT_PUSH_TARGET,
        'me',
        true,
      );
      const response = await fetch(
        `${config.MEMORY_SERVICE_BASE_URL}/weekly-report/push-now`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            force: true,
            weeklyReportPushTarget,
            weeklyReportPushGroupId:
              (config.WEEKLY_REPORT_PUSH_GROUP_ID || '').trim() || undefined,
          }),
        },
      );
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.error || '推送失败');
      }
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

  const handleMemoryExport = async () => {
    if (!ensureMemoryServiceConfigured()) {
      return;
    }

    setIsMemoryExporting(true);
    try {
      const headers = await getRequestHeaders(config, {
        accept: 'application/zip',
      });
      const response = await fetch(`${config.MEMORY_SERVICE_BASE_URL}/export`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          format: 'backup_zip',
        }),
      });

      if (!response.ok) {
        throw new Error(await readResponseErrorMessage(response));
      }

      const backupBlob = await response.blob();
      const filename =
        parseContentDispositionFilename(
          response.headers.get('content-disposition'),
        ) || `personal-ai-memory-backup-${formatExportTimestamp()}.zip`;
      downloadBlob(backupBlob, filename);

      setStatus({
        message: `记忆导出完成，已下载备份包 ${filename}`,
        type: 'success',
      });
    } catch (error) {
      console.error('导出记忆失败:', error);
      setStatus({
        message:
          error instanceof Error
            ? `导出记忆失败: ${error.message}`
            : '导出记忆失败',
        type: 'error',
      });
    } finally {
      setIsMemoryExporting(false);
    }
  };

  const handleOpenMemoryImport = () => {
    memoryImportInputRef.current?.click();
  };

  const handleMemoryImport = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }
    if (!ensureMemoryServiceConfigured()) {
      return;
    }

    const memoryImportMode = replaceMemoryOnImport ? 'replace' : 'merge';

    if (memoryImportMode === 'replace') {
      const confirmed = window.confirm(
        'replace 会覆盖当前用户的记忆数据库，并删除备份包中不存在的本地文件。确定继续吗？',
      );
      if (!confirmed) {
        return;
      }
    }

    setIsMemoryImporting(true);
    try {
      const headers = await getRequestHeaders(config, {
        accept: 'application/json',
        contentType: null,
      });
      const formData = new FormData();
      formData.append(
        'file',
        file,
        file.name || 'personal-ai-memory-backup.zip',
      );
      formData.append('mode', memoryImportMode);

      const response = await fetch(`${config.MEMORY_SERVICE_BASE_URL}/import`, {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!response.ok) {
        throw new Error(await readResponseErrorMessage(response));
      }

      const result = (await response.json()) as MemoryImportResponse;
      const warningText =
        result.warnings.length > 0 ? `，警告 ${result.warnings.length} 项` : '';
      const dbSummary =
        result.database.action === 'merged' &&
        typeof result.database.changedRows === 'number'
          ? `，数据库变更 ${result.database.changedRows} 行`
          : '';

      setStatus({
        message: `记忆导入完成（${result.mode}）：写入 ${result.files.written} 个文件，覆盖 ${result.files.overwritten} 个，保留 ${result.files.preserved} 个，删除 ${result.files.deleted} 个${dbSummary}${warningText}`,
        type: 'success',
      });
    } catch (error) {
      console.error('导入记忆失败:', error);
      setStatus({
        message:
          error instanceof Error
            ? `导入记忆失败: ${error.message}`
            : '导入记忆失败',
        type: 'error',
      });
    } finally {
      setIsMemoryImporting(false);
    }
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
        <h2>功能 Demo</h2>
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
        </div>
      </div>

      <div className="form-section">
        <h2>常规设置</h2>
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
      </div>

      <div className="form-section">
        <h2>Bot 推送设置</h2>
        <small
          style={{ color: '#666', display: 'block', marginBottom: '15px' }}
        >
          Bot Key 和 Base URL 从 env 读取，这里只配置各场景推送到
          Me（user）还是自定义群组。
        </small>
        {renderPushTargetFields(
          '消息分析推送',
          'MESSAGE_ANALYSIS_PUSH_TARGET',
          'MESSAGE_ANALYSIS_PUSH_GROUP_ID',
          false,
          '命中关注项后的即时提醒。默认推送给 Me。',
        )}
        {renderPushTargetFields(
          '关注后续推送',
          'FOLLOW_UP_PUSH_TARGET',
          'FOLLOW_UP_PUSH_GROUP_ID',
          false,
          '与消息分析拆开配置，关注后续汇总和相关提醒走这一套。',
        )}
        {renderPushTargetFields(
          '决策中心推送',
          'DECISION_CENTER_PUSH_TARGET',
          'DECISION_CENTER_PUSH_GROUP_ID',
          false,
          '用于冲突/待确认类的决策中心提醒。默认推送给 Me。',
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
      </div>

      <div className="form-section">
        <h2>消息过滤设置</h2>
        <ToggleField
          id="FILTER_OWN_MESSAGES"
          name="FILTER_OWN_MESSAGES"
          checked={config.FILTER_OWN_MESSAGES}
          onChange={handleInputChange}
          label="过滤自己发送的消息"
          description="开启后，消息分析会自动忽略自己发出的消息。"
        />
      </div>

      <div className="form-section">
        <h2>消息交互功能</h2>
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
          description="从消息快速创建带关联操作的记忆入口规则。"
        />
      </div>

      <div className="form-section">
        <h2>记忆系统 (Memory Service)</h2>
        <div className="form-group">
          <label htmlFor="MEMORY_SERVICE_BASE_URL">记忆服务 API 地址</label>
          <input
            type="url"
            id="MEMORY_SERVICE_BASE_URL"
            name="MEMORY_SERVICE_BASE_URL"
            value={config.MEMORY_SERVICE_BASE_URL}
            onChange={handleInputChange}
            placeholder="http://localhost:3210/api/v1"
          />
          <small style={{ color: '#666', display: 'block', marginTop: '5px' }}>
            记忆系统后端地址，需包含 /api/v1 路径。默认 localhost:3210
          </small>
        </div>
        <div className="form-group">
          <label htmlFor="MEMORY_SERVICE_API_KEY">API 密钥（可选）</label>
          <input
            type="password"
            id="MEMORY_SERVICE_API_KEY"
            name="MEMORY_SERVICE_API_KEY"
            value={config.MEMORY_SERVICE_API_KEY || ''}
            onChange={handleInputChange}
            placeholder="后端配置 API_KEY 时填写"
          />
          <small style={{ color: '#666', display: 'block', marginTop: '5px' }}>
            后端配置 API_KEY 时需填写相同密钥；本地开发通常留空
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
        <ContextSiteMuteSettings />
        <ToggleField
          id="SELF_REFLECTION_ENABLED"
          name="SELF_REFLECTION_ENABLED"
          checked={config.SELF_REFLECTION_ENABLED !== false}
          onChange={handleInputChange}
          label="启用自我反思"
          description="每个用户可以单独关闭自我反思；关闭后不会影响梦境重放的持续生成。"
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
        </div>
        <div className="form-group">
          <label>记忆备份导入/导出</label>
          <div
            style={{
              display: 'flex',
              gap: '12px',
              flexWrap: 'wrap',
              alignItems: 'center',
            }}
          >
            <button
              type="button"
              onClick={handleMemoryExport}
              disabled={isMemoryExporting || isMemoryImporting}
            >
              {isMemoryExporting ? '导出中...' : '导出记忆'}
            </button>
            <button
              type="button"
              onClick={handleOpenMemoryImport}
              disabled={isMemoryExporting || isMemoryImporting}
            >
              {isMemoryImporting ? '导入中...' : '导入记忆'}
            </button>
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                margin: 0,
              }}
            >
              <input
                type="checkbox"
                checked={replaceMemoryOnImport}
                onChange={(e) => setReplaceMemoryOnImport(e.target.checked)}
                disabled={isMemoryImporting}
              />
              覆盖替换现有记忆
            </label>
          </div>
          <input
            ref={memoryImportInputRef}
            type="file"
            accept=".zip,application/zip"
            onChange={handleMemoryImport}
            style={{ display: 'none' }}
          />
          <small style={{ color: '#666', display: 'block', marginTop: '5px' }}>
            默认不勾选时按 merge 导入 zip 备份，保留本地未冲突内容；勾选后按
            replace 导入，会替换数据库并删除备份包中不存在的本地记忆文件。
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
        <h2>Meeting Pilot</h2>
        <small
          style={{ color: '#666', display: 'block', marginBottom: '15px' }}
        >
          这里是 Meeting Pilot 的唯一核心配置入口：ASR / 转写 Provider、 Minutes
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
          label="启用 Meeting Pilot"
          description="关闭后不再注入会议浮层入口，也不会显示 Meeting Pilot 主流程。"
        />
        <ToggleField
          id="MEETING_PILOT_FLOATING_ICON_VISIBLE"
          name="MEETING_PILOT_FLOATING_ICON_VISIBLE"
          checked={config.MEETING_PILOT_FLOATING_ICON_VISIBLE !== false}
          onChange={handleInputChange}
          label="显示会议页右下角悬浮入口"
          description="如果你在 meeting 页面通过悬浮 icon 上的小 x 选择了“永不展示”，可以在这里重新打开。关闭后仅隐藏会议页悬浮入口与浮层提醒，不会停用整个 Meeting Pilot 功能。"
          disabled={config.MEETING_PILOT_ENABLED !== true}
        />
        {config.MEETING_PILOT_ENABLED === true &&
        config.MEETING_PILOT_FLOATING_ICON_VISIBLE === false ? (
          <small
            style={{ color: '#b45309', display: 'block', marginBottom: '15px' }}
          >
            当前 meeting 页面悬浮入口已设为永不展示。重新打开这个开关后，右下角
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
          <h3 style={{ margin: '0 0 10px' }}>Context Assist / 会前准备</h3>
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
            placeholder="输入 Meeting Pilot 转写服务 API Key"
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
        <h2>OpenClaw 对接</h2>
        <small
          style={{ color: '#666', display: 'block', marginBottom: '15px' }}
        >
          自我反思与关联操作里的外部执行入口都会走这里的 OpenClaw
          配置。启用后才会真正调用外部系统。
        </small>
        <ToggleField
          id="OPENCLAW_ENABLED"
          name="OPENCLAW_ENABLED"
          checked={config.OPENCLAW_ENABLED === true}
          onChange={handleInputChange}
          label="启用 OpenClaw 外部委派"
          description="开启后，自我反思与关联操作都可把外部系统查询/执行委派给 OpenClaw（OpenAI 兼容 Responses）。"
        />
        <div className="form-group">
          <label htmlFor="OPENCLAW_BASE_URL">OpenClaw Base URL</label>
          <input
            type="url"
            id="OPENCLAW_BASE_URL"
            name="OPENCLAW_BASE_URL"
            value={config.OPENCLAW_BASE_URL || ''}
            onChange={handleInputChange}
            placeholder="https://openclaw.example.com"
            disabled={config.OPENCLAW_ENABLED !== true}
          />
          <small style={{ color: '#666', display: 'block', marginTop: '5px' }}>
            示例：`https://openclaw.example.com`，后端会自动拼接
            `/v1/responses`。
          </small>
        </div>
        <div className="form-group">
          <label htmlFor="OPENCLAW_TIMEOUT_MS">OpenClaw 超时（秒）</label>
          <input
            type="number"
            id="OPENCLAW_TIMEOUT_MS"
            name="OPENCLAW_TIMEOUT_MS"
            value={Math.max(
              MIN_OPENCLAW_TIMEOUT_SECONDS,
              Math.floor(Number(config.OPENCLAW_TIMEOUT_MS || 600000) / 1000),
            )}
            onChange={handleInputChange}
            min={String(MIN_OPENCLAW_TIMEOUT_SECONDS)}
            step="1"
            disabled={config.OPENCLAW_ENABLED !== true}
          />
          <small style={{ color: '#666', display: 'block', marginTop: '5px' }}>
            最短 300 秒。保存时会自动换算成后端使用的毫秒值。
          </small>
        </div>
        <div className="form-group">
          <label htmlFor="OPENCLAW_API_KEY">
            OpenClaw API Key（写入后不回显）
          </label>
          <input
            type="password"
            id="OPENCLAW_API_KEY"
            name="OPENCLAW_API_KEY"
            value={config.OPENCLAW_API_KEY || ''}
            onChange={handleInputChange}
            placeholder={
              config.OPENCLAW_API_KEY_CONFIGURED
                ? '已配置（如需更新请输入新 key）'
                : '输入新的 OpenClaw API Key'
            }
            autoComplete="new-password"
            disabled={config.OPENCLAW_ENABLED !== true}
          />
          <small style={{ color: '#666', display: 'block', marginTop: '5px' }}>
            当前状态：
            {config.OPENCLAW_API_KEY_CONFIGURED
              ? '后端已配置 key'
              : '后端未配置 key'}
            。
          </small>
        </div>
        <div className="form-group">
          <label>
            <input
              type="checkbox"
              name="OPENCLAW_CLEAR_API_KEY"
              checked={config.OPENCLAW_CLEAR_API_KEY === true}
              onChange={handleInputChange}
              disabled={config.OPENCLAW_ENABLED !== true}
            />
            清除后端已保存的 OpenClaw API Key（仅当上方 key 输入为空时生效）
          </label>
        </div>
      </div>

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
        <h2>主动询问</h2>
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
        <h2>自动周报 (Weekly Report)</h2>
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
      </div>

      <div className="form-section">
        <h2>LLM 设置</h2>
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
          <h2>Ollama 设置</h2>
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
          <h2>Dify 设置</h2>
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
          <h2>OpenAI 设置</h2>
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
          <h2>Groq 设置</h2>
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
        <h2>Jira 设置</h2>
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
          <h2>智能Agent系统设置</h2>
          <IntelligentAgentSettings />
        </div>
      )}

      {config.ANALYSIS_TYPE === 'agentWorkflow' && (
        <div className="form-section">
          <h2>标准Agent系统设置</h2>
          <AgentSettings />
        </div>
      )}

      <div className="form-section">
        <h2>配置导入/导出</h2>
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
      const result = await client.recall('', {
        topK: 12,
        channels: ['time'],
        includeMetadata: true,
        previewMaxLength: 260,
      });
      const samples = buildAgentWorkflowReplayMessages(result.items || [], 8);
      setWorkflowReplaySamples(samples);
      setWorkflowReplaySelectedId(samples[0]?.id || '');
      if (samples.length === 0) {
        setWorkflowReplayError('没有可回放的最近消息');
      }
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
  };

  const runWorkflowTest = async (input: AgentWorkflowTestInput) => {
    const messageContent = input.content.trim();
    if (!messageContent) {
      setWorkflowTestError('请输入测试消息');
      setWorkflowTestResult(null);
      return;
    }

    setWorkflowTestRunning(true);
    setWorkflowTestError('');
    setWorkflowTestResult(null);
    try {
      const result = await agentCoordinator.processMessage({
        post_id: `agent-workflow-test-${Date.now()}`,
        team_id: input.teamId.trim() || 'agent-workflow-test',
        team_name: input.teamName.trim() || 'Example Group',
        message_content: messageContent,
        sender: input.sender.trim() || 'Example Sender',
        datetime: normalizeAgentWorkflowInputDatetime(input.datetime),
      });
      setWorkflowTestResult(result);
    } catch (error) {
      console.error('Agent Workflow 测试失败:', error);
      setWorkflowTestError(
        error instanceof Error ? error.message : 'Agent Workflow 测试失败',
      );
    } finally {
      setWorkflowTestRunning(false);
    }
  };

  const handleRunWorkflowTest = () => {
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
  };

  const handleRunWorkflowReplaySample = async () => {
    const sample = getSelectedWorkflowReplaySample();
    if (!sample) return;

    const nextInput = buildWorkflowInputFromReplaySample(sample);
    setWorkflowTestInput(nextInput);
    setWorkflowReplayError('');
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
  };

  const handleRunWorkflowScenario = async () => {
    const scenario = getSelectedWorkflowScenario();
    if (!scenario) return;

    const nextInput = buildAgentWorkflowScenarioInput(scenario);
    setWorkflowTestInput(nextInput);
    setWorkflowReplayError('');
    await runWorkflowTest(nextInput);
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
  const workflowTestMessageReady = workflowTestInput.content.trim().length > 0;
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
  const workflowTestConfidence =
    typeof workflowTestResult?.confidence === 'number'
      ? workflowTestResult.confidence
      : 0;
  const workflowTestNotificationLabel = workflowTestResult?.notificationReview
    ?.required
    ? '待复核'
    : workflowTestResult?.shouldNotify
      ? '发送'
      : '不发送';
  const workflowTestStorageReview = workflowTestResult?.storageReview;
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
    error: '失败',
  };
  const workflowTestTraceStatus =
    workflowTestStorageReview?.traceStatus ||
    (workflowTestTrace.length === 0
      ? 'missing'
      : workflowTestTrace.some((step: any) => step.status === 'error')
        ? 'partial'
        : 'complete');
  const workflowConfigDiagnostics = buildAgentWorkflowConfigDiagnostics(
    sortedAgents,
    availableTools,
  );
  const workflowRunDiagnostics = buildAgentWorkflowResultDiagnostics(
    workflowTestResult,
  );
  const workflowDecisionPath =
    buildAgentWorkflowDecisionPath(workflowTestResult);
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
            (workflowTestStorageReview.failedAgents || []).join('、') ||
            (workflowTestStorageReview.toolErrorCount
              ? `工具错误 ${workflowTestStorageReview.toolErrorCount}`
              : '-'),
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

      <div className="agent-workflow-test-panel">
        <div className="agent-workflow-test-header">
          <div>
            <h3>关注项测试</h3>
          </div>
          <button
            onClick={handleRunWorkflowTest}
            disabled={workflowTestRunning || !workflowTestMessageReady}
          >
            {workflowTestRunning ? '测试中...' : '运行测试'}
          </button>
        </div>
        <div className="agent-workflow-scenario-row">
          <div className="form-group">
            <label htmlFor="workflowScenario">内置样例</label>
            <select
              id="workflowScenario"
              value={workflowScenarioSelectedId}
              onChange={handleWorkflowScenarioChange}
            >
              {AGENT_WORKFLOW_TEST_SCENARIOS.map((scenario) => (
                <option key={scenario.id} value={scenario.id}>
                  {scenario.label} · {scenario.signal}
                </option>
              ))}
            </select>
          </div>
          <div className="agent-workflow-scenario-actions">
            <button type="button" onClick={handleLoadWorkflowScenario}>
              填入样例
            </button>
            <button
              type="button"
              onClick={handleRunWorkflowScenario}
              disabled={workflowTestRunning}
            >
              {workflowTestRunning ? '测试中...' : '运行样例'}
            </button>
          </div>
        </div>
        <div className="agent-workflow-replay-row">
          <div className="form-group">
            <label htmlFor="workflowReplaySample">最近消息</label>
            <select
              id="workflowReplaySample"
              value={workflowReplaySelectedId}
              onChange={(event) =>
                setWorkflowReplaySelectedId(event.target.value)
              }
              disabled={workflowReplayLoading || workflowReplaySamples.length === 0}
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
              disabled={workflowReplayLoading || workflowReplaySamples.length === 0}
            >
              填入
            </button>
            <button
              type="button"
              onClick={handleRunWorkflowReplaySample}
              disabled={
                workflowReplayLoading ||
                workflowTestRunning ||
                workflowReplaySamples.length === 0
              }
            >
              {workflowTestRunning ? '测试中...' : '回放测试'}
            </button>
            <button
              type="button"
              onClick={loadWorkflowReplaySamples}
              disabled={workflowReplayLoading}
            >
              {workflowReplayLoading ? '刷新中...' : '刷新'}
            </button>
          </div>
        </div>
        {workflowReplayError && (
          <p className="error-message">{workflowReplayError}</p>
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
          />
        </div>
        {workflowTestError && (
          <p className="error-message">{workflowTestError}</p>
        )}
        {workflowTestResult && (
          <div className="agent-workflow-test-result">
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
                置信度 {Math.round(workflowTestConfidence * 100)}%
              </span>
            </div>
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
            <div className="agent-workflow-diagnostic-block compact">
              <div className="agent-test-section-title">运行诊断</div>
              {renderWorkflowDiagnostics(
                workflowRunDiagnostics,
                '本次 trace 未发现阻塞项',
              )}
            </div>
            {workflowTestResult.notificationReview?.required && (
              <div className="agent-test-review-banner">
                {workflowTestResult.notificationReview.message}
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

      <button onClick={handleAddAgent} disabled={!canAddAgent}>
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

      // 模拟重复工具调用被跳过
      await wait(2000);
      if (!isDemoRunActive()) return;
      setDemoThoughtProcess((prev) => [
        ...prev,
        {
          timestamp: Date.now(),
          thought:
            '模型再次提出用同样参数查询历史消息。系统已经有相同工具结果，因此跳过重复调用并保留已有证据。',
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

      // 模拟最终判断
      await wait(2000);
      if (!isDemoRunActive()) return;
      setDemoThoughtProcess((prev) => [
        ...prev,
        {
          timestamp: Date.now(),
          thought:
            '结合历史上下文和 JIRA 状态，这是一条需要存储的项目进展；当前没有阻塞或高风险变化，因此不需要即时通知。',
          action: 'finish',
        },
      ]);

      // 设置最终结果
      await wait(1000);
      if (!isDemoRunActive()) return;
      setDemoResult({
        isImportant: true,
        shouldStore: true,
        shouldNotify: false,
        confidence: 0.85,
        summary:
          '项目 PROJ-1001 仍在进行中，预计 2026-05-12 完成；本次消息应沉淀为项目进展，但无需打断用户。',
        reasonsToStore: [
          `通过 ${historyToolName} 确认为近期关注项目`,
          `通过 ${jiraToolName} 获得任务状态和截止时间`,
          '本轮重复工具调用已被跳过，避免浪费和重复证据',
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
              <th>参数</th>
            </tr>
          </thead>
          <tbody>
            {tools.map((tool) => (
              <tr key={tool.id}>
                <td>{tool.id}</td>
                <td>{tool.name}</td>
                <td>{tool.description}</td>
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

            {demoResult && <AgentResultSummary result={demoResult} />}
          </>
        )}
      </div>
    </div>
  );
};

ReactDOM.render(<Options />, document.getElementById('options-root'));
