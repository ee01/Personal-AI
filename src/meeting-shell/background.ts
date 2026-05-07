import {
  MEETING_PILOT_HOST_PREFIX,
  MEETING_PILOT_LIVE_MAP_PATH,
  MEETING_PILOT_OFFSCREEN_PATH,
  MEETING_PILOT_SIDE_PANEL_PATH,
  MeetingPilotAlert,
  MeetingPilotCaptureState,
  MeetingPilotDetectionPayload,
  MeetingPilotDecisionItem,
  MeetingPilotParticipant,
  MeetingPilotParticipantStance,
  MeetingPilotSessionSnapshot,
  MeetingPilotDependencyReadiness,
  MeetingPilotReadinessState,
  MeetingPilotSpeechGuidanceContext,
  MeetingPilotSpeechGuidanceProfileRef,
  MeetingPilotSpeechGuidanceSessionNote,
  MeetingPilotStructuredParseResult,
  MeetingPilotStateResponse,
  MeetingPilotTierStatus,
  buildMeetingPilotBadgeText,
  buildMeetingPilotTooltip,
  createMeetingPilotSessionSnapshot,
  extractMeetingIdFromUrl,
} from './protocol';
import { MeetingPilotRegistry } from './store';
import {
  getMemoryServiceClient,
  type MemoryServiceError,
} from '../services/MemoryServiceClient';
import {
  getEnvConfig,
  getMeetingTranscriptionMode,
  isMeetingRingCentralTranscriptEnabled,
} from '../utils';
import {
  isMainLLMConfiguredForMeetingAnalysis,
  runMeetingIntelligenceLLM,
} from '../llm';
import {
  buildMeetingPilotContextRecallRequest,
  contextMatchToMeetingPilotMemoryRef,
} from './memoryPresentation';
import {
  createAliasResolverFromEnv,
  resolveParticipantByName,
  resolveSpeakerForChunk,
} from './speakerResolver';
import { buildTranscriptTurns } from './transcriptTurns';
import { inferActionItemFromText } from './actionItems';
import {
  applyAiParticipantResolutions,
  mergeParticipants,
  renameParticipant,
} from './participantOps';
import {
  getActiveMeetingActionItems,
  mergeActionItemReviewStates,
  normalizeActionItemReviewState,
} from './actionItemReview';
import {
  doesProviderExposeTranscribeModel,
  normalizeMeetingTranscribeApiStyle,
  probeMeetingTranscribeProvider,
} from './asrProvider';
import { sanitizeASRTranscriptText } from './asr/transcriptFilter';
import {
  buildMeetingPilotSpeechSuggestion,
  buildSpeechSuggestionSignature,
  classifyMeetingPilotSpeechGuidanceInput,
  type MeetingPilotLlmRunner,
} from './speechSuggestion';

export { mergeActionItemReviewStates } from './actionItemReview';

const registry = new MeetingPilotRegistry();
let initPromise: Promise<void> | null = null;
let offscreenReady = false;
const memoryRefreshTimers = new Map<number, number>();
const speechSuggestionRefreshTimers = new Map<number, number>();
const speechSuggestionLastRunAt = new Map<number, number>();
const speechSuggestionLastSignatures = new Map<number, string>();
const digestPollTimers = new Map<number, number>();
const transcriptUpdateQueues = new Map<number, Promise<void>>();
let testForceSidePanelOpenFailure = false;
let testUseMockCapture = false;
const READINESS_CACHE_TTL_MS = 20_000;
let readinessCache:
  | {
      expiresAt: number;
      promise?: Promise<MeetingPilotReadinessState>;
      value?: MeetingPilotReadinessState;
    }
  | undefined;

const WHISPER_NATIVE_HOST = 'com.personal_ai.whisper_host';
let whisperBridgeToken: string | undefined;
let whisperNativeHostBackoffUntil = 0;
const WHISPER_NATIVE_HOST_BACKOFF_MS = 60_000;
const MEETING_TITLE_MAX_LENGTH = 40;
const GENERIC_MEETING_TITLE_PATTERNS = [
  /^$/,
  /^meeting$/,
  /^meeting record$/,
  /^meeting archive$/,
  /^ringcentral$/,
  /^ringcentral meeting$/,
  /^ringcentral video$/,
  /^video meeting$/,
  /^join meeting$/,
  /^join a meeting$/,
  /^live discussion$/,
  /^shared screen review$/,
  /^waiting for context$/,
  /^会议$/,
  /^会议记录$/,
  /^未命名会议$/,
];

async function pairWhisperBridge(): Promise<void> {
  const pairResponse = await fetch('http://127.0.0.1:46321/pair', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
    signal: AbortSignal.timeout(10_000),
  });
  if (!pairResponse.ok) {
    return;
  }
  const pairData = (await pairResponse.json()) as { token?: string };
  whisperBridgeToken = pairData.token?.trim() || undefined;
  if (!whisperBridgeToken) {
    return;
  }
  await fetch('http://127.0.0.1:46321/whisper/native-host/install', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-bridge-token': whisperBridgeToken,
    },
    body: JSON.stringify({ extensionIds: [chrome.runtime.id] }),
    signal: AbortSignal.timeout(10_000),
  }).catch(() => undefined);
}

async function sendWhisperNativeMessage<T>(message: {
  method: string;
  path: string;
  body?: Record<string, unknown>;
}): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    let port: chrome.runtime.Port | undefined;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      try {
        port?.disconnect();
      } catch {
        // ignore disconnect timeout cleanup
      }
      reject(new Error('native_messaging_timeout'));
    }, 10_000);

    try {
      port = chrome.runtime.connectNative(WHISPER_NATIVE_HOST);
    } catch (error) {
      clearTimeout(timeout);
      reject(error);
      return;
    }

    port.onMessage.addListener((response) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      try {
        port?.disconnect();
      } catch {
        // ignore disconnect cleanup
      }
      resolve(response as T);
    });

    port.onDisconnect.addListener(() => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      const messageText =
        chrome.runtime.lastError?.message || 'native_messaging_disconnected';
      reject(new Error(messageText));
    });

    port.postMessage(message);
  });
}

function getWhisperBridgeErrorMessage(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const error = (value as { error?: unknown }).error;
  return typeof error === 'string' ? error : undefined;
}

function isWhisperBridgeAuthError(value: unknown): boolean {
  const message = getWhisperBridgeErrorMessage(value)?.toLowerCase() || '';
  return (
    message.includes('missing or invalid bridge token') ||
    message.includes('bridge is not paired')
  );
}

async function sendWhisperBridgeRequest<T>(message: {
  method: string;
  path: string;
  body?: Record<string, unknown>;
}): Promise<T> {
  const sendHttpFallback = async (): Promise<T> => {
    if (!whisperBridgeToken) {
      await pairWhisperBridge().catch(() => undefined);
    }

    const url = `http://127.0.0.1:46321${message.path}`;
    const opts: RequestInit = {
      method: message.method,
      headers: {
        'Content-Type': 'application/json',
        ...(whisperBridgeToken ? { 'x-bridge-token': whisperBridgeToken } : {}),
      },
      signal: AbortSignal.timeout(10_000),
    };
    if (message.body && message.method !== 'GET') {
      opts.body = JSON.stringify(message.body);
    }
    let res = await fetch(url, opts);
    if (res.status === 401) {
      whisperBridgeToken = undefined;
      await pairWhisperBridge().catch(() => undefined);
      if (whisperBridgeToken) {
        opts.headers = {
          'Content-Type': 'application/json',
          'x-bridge-token': whisperBridgeToken,
        };
        res = await fetch(url, opts);
      }
    }
    return (
      res.ok ? await res.json() : { ok: false, error: `HTTP ${res.status}` }
    ) as T;
  };

  try {
    if (Date.now() >= whisperNativeHostBackoffUntil) {
      const response = await sendWhisperNativeMessage<T>(message);
      if (isWhisperBridgeAuthError(response)) {
        whisperBridgeToken = undefined;
        throw new Error(getWhisperBridgeErrorMessage(response));
      }
      whisperNativeHostBackoffUntil = 0;
      return response;
    }
  } catch {
    whisperNativeHostBackoffUntil = Date.now() + WHISPER_NATIVE_HOST_BACKOFF_MS;
    return sendHttpFallback();
  }

  return sendHttpFallback();
}

function createDependencyReadiness(
  status: 'ready' | 'degraded' | 'blocked',
  message: string,
  checkedAt = Date.now(),
): MeetingPilotDependencyReadiness {
  return {
    status,
    message,
    checkedAt,
  };
}

function buildReadinessSummary(args: {
  blockedByFeatureFlag: boolean;
  minutesApi: MeetingPilotDependencyReadiness;
  transcription: MeetingPilotDependencyReadiness;
  analysisModel: MeetingPilotDependencyReadiness;
  memoryService: MeetingPilotDependencyReadiness;
}): MeetingPilotReadinessState {
  const blockers = [
    ...(args.blockedByFeatureFlag
      ? ['Meeting Pilot is disabled in settings.']
      : []),
  ];
  const degradations = [
    args.minutesApi,
    args.transcription,
    args.analysisModel,
    args.memoryService,
  ]
    .filter((item) => item.status !== 'ready')
    .map((item) => item.message);
  const checkedAt = Math.max(
    args.minutesApi.checkedAt,
    args.transcription.checkedAt,
    args.analysisModel.checkedAt,
    args.memoryService.checkedAt,
  );
  const status = blockers.length
    ? 'blocked'
    : degradations.length
    ? 'degraded'
    : 'ready';

  return {
    status,
    summary:
      status === 'ready'
        ? 'Ready — capture and meeting memory are available.'
        : status === 'blocked'
        ? `Blocked — ${blockers[0]}`
        : `Degraded — ${degradations[0]}`,
    canStartCapture: blockers.length === 0,
    checkedAt,
    blockers,
    degradations,
    dependencies: {
      minutesApi: args.minutesApi,
      transcription: args.transcription,
      analysisModel: args.analysisModel,
      memoryService: args.memoryService,
    },
  };
}

function createDeferredDependencyReadiness(
  previous: MeetingPilotDependencyReadiness | undefined,
  message: string,
  checkedAt: number,
): MeetingPilotDependencyReadiness {
  if (previous && previous.message !== 'Waiting for preflight.') {
    return previous;
  }
  return createDependencyReadiness('degraded', message, checkedAt);
}

function buildCaptureGateReadiness(args: {
  blockedByFeatureFlag: boolean;
  previous?: MeetingPilotReadinessState;
  checkedAt?: number;
}): MeetingPilotReadinessState {
  const checkedAt = args.checkedAt || Date.now();
  const blockers = args.blockedByFeatureFlag
    ? ['Meeting Pilot is disabled in settings.']
    : [];
  const dependencies = {
    minutesApi: createDeferredDependencyReadiness(
      args.previous?.dependencies?.minutesApi,
      'Minutes API readiness will refresh after capture starts.',
      checkedAt,
    ),
    transcription: createDeferredDependencyReadiness(
      args.previous?.dependencies?.transcription,
      'Transcription readiness will refresh after capture starts.',
      checkedAt,
    ),
    analysisModel: createDeferredDependencyReadiness(
      args.previous?.dependencies?.analysisModel,
      'Meeting analysis readiness will refresh after capture starts.',
      checkedAt,
    ),
    memoryService: createDeferredDependencyReadiness(
      args.previous?.dependencies?.memoryService,
      'Memory service readiness will refresh after capture starts.',
      checkedAt,
    ),
  };
  const degradations = Object.values(dependencies)
    .filter((dependency) => dependency.status !== 'ready')
    .map((dependency) => dependency.message);

  return {
    status: blockers.length
      ? 'blocked'
      : degradations.length
      ? 'degraded'
      : 'ready',
    summary: blockers.length
      ? `Blocked — ${blockers[0]}`
      : 'Capture can start. Service readiness checks continue in background.',
    canStartCapture: blockers.length === 0,
    checkedAt,
    blockers,
    degradations,
    dependencies,
  };
}

function hasOwnRequestField(
  request: Record<string, unknown>,
  field: string,
): boolean {
  return Object.prototype.hasOwnProperty.call(request, field);
}

function sanitizeActionTextEdit(
  value: unknown,
  maxLength: number,
): string {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function withTimeoutSignal(timeoutMs: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), timeoutMs);
  return controller.signal;
}

function trimTrailingSlash(url: string): string {
  return url.replace(/\/$/, '');
}

function joinUrl(baseUrl: string, path: string): string {
  return `${trimTrailingSlash(baseUrl)}${
    path.startsWith('/') ? path : `/${path}`
  }`;
}

async function probeHttpCandidates(
  urls: string[],
  init?: RequestInit,
): Promise<boolean> {
  for (const url of urls) {
    try {
      const response = await fetch(url, {
        method: 'GET',
        signal: withTimeoutSignal(5000),
        ...init,
      });
      if (response.ok || response.status < 500) {
        return true;
      }
    } catch {
      // try the next probe target
    }
  }
  return false;
}

async function evaluateMeetingReadiness(
  forceRefresh = false,
): Promise<MeetingPilotReadinessState> {
  const now = Date.now();
  if (
    !forceRefresh &&
    readinessCache?.value &&
    readinessCache.expiresAt > now
  ) {
    return readinessCache.value;
  }
  if (!forceRefresh && readinessCache?.promise) {
    return readinessCache.promise;
  }

  const promise = (async () => {
    const checkedAt = Date.now();
    const envConfig = await getEnvConfig();
    const blockedByFeatureFlag = envConfig.MEETING_PILOT_ENABLED === false;
    const minutesApiBaseUrl = trimTrailingSlash(
      String(
        envConfig.MEETING_MINUTES_API_URL ||
          envConfig.MEETING_DIGEST_API_BASE_URL ||
          '',
      ),
    );

    const minutesApi = !minutesApiBaseUrl
      ? createDependencyReadiness(
          'degraded',
          'Minutes API is not configured.',
          checkedAt,
        )
      : (await probeHttpCandidates([
          joinUrl(minutesApiBaseUrl, '/health'),
          minutesApiBaseUrl,
        ]))
      ? createDependencyReadiness(
          'ready',
          'Minutes API is reachable.',
          checkedAt,
        )
      : createDependencyReadiness(
          'degraded',
          'Minutes API is unreachable.',
          checkedAt,
        );

    const providerConfigured = Boolean(
      String(envConfig.MEETING_PROVIDER_BASE_URL || '').trim() &&
        String(envConfig.MEETING_PROVIDER_API_KEY || '').trim(),
    );
    const providerProbe = providerConfigured
      ? await probeMeetingTranscribeProvider(envConfig)
      : {
          reachable: false,
          models: null as Set<string> | null,
          compatibilityIssue: null,
        };
    const whisperModel = String(
      envConfig.MEETING_TRANSCRIBE_MODEL || 'whisper-1',
    ).trim();
    const transcribeApiStyle = normalizeMeetingTranscribeApiStyle(
      envConfig.MEETING_TRANSCRIBE_API_STYLE,
    );
    const mainLlmForAnalysis = isMainLLMConfiguredForMeetingAnalysis(envConfig);

    const transcriptionMode = getMeetingTranscriptionMode(envConfig);

    const cloudTranscription = !providerConfigured
      ? createDependencyReadiness(
          'degraded',
          'ASR / transcription provider is unavailable because the base URL or API key is missing.',
          checkedAt,
        )
      : providerProbe.compatibilityIssue
      ? createDependencyReadiness(
          'degraded',
          providerProbe.compatibilityIssue,
          checkedAt,
        )
      : !providerProbe.reachable
      ? createDependencyReadiness(
          'degraded',
          'ASR / transcription provider is degraded because the provider could not be reached.',
          checkedAt,
        )
      : providerProbe.models &&
        whisperModel &&
        !doesProviderExposeTranscribeModel(whisperModel, providerProbe.models)
      ? createDependencyReadiness(
          'degraded',
          `Transcribe model ${whisperModel} is not exposed by the provider (${transcribeApiStyle}).`,
          checkedAt,
        )
      : createDependencyReadiness(
          'ready',
          'Audio transcription is available.',
          checkedAt,
        );

    const desktopAvailable = await (async () => {
      try {
        const data = await sendWhisperBridgeRequest<{
          ok?: boolean;
          ready?: boolean;
        }>({
          method: 'GET',
          path: '/asr/status',
        });
        return Boolean(data?.ready);
      } catch {
        return false;
      }
    })();

    const transcription = (() => {
      if (transcriptionMode === 'cloud-only') {
        return cloudTranscription;
      }
      if (transcriptionMode === 'local-only') {
        if (desktopAvailable) {
          return createDependencyReadiness(
            'ready',
            'Local ASR is available.',
            checkedAt,
          );
        }
        return createDependencyReadiness(
          'degraded',
          'Local ASR is unavailable. Capture will still probe Chrome on-device speech recognition; install the Personal AI desktop app for the more stable local path.',
          checkedAt,
        );
      }
      if (desktopAvailable || cloudTranscription.status === 'ready') {
        return createDependencyReadiness(
          'ready',
          'Transcription is available.',
          checkedAt,
        );
      }
      return createDependencyReadiness(
        'degraded',
        'No transcription available. Configure a cloud API key in settings, or install the Personal AI desktop app for local transcription.',
        checkedAt,
      );
    })();

    const analysis = mainLlmForAnalysis.ok
      ? createDependencyReadiness(
          'ready',
          mainLlmForAnalysis.message,
          checkedAt,
        )
      : createDependencyReadiness(
          'degraded',
          `Meeting analysis (主 LLM): ${mainLlmForAnalysis.message}`,
          checkedAt,
        );

    const memoryService = (() => {
      const client = getMemoryServiceClient();
      return client
        .getHealth()
        .then((health) =>
          health.status === 'ok'
            ? createDependencyReadiness(
                'ready',
                'Memory service is reachable.',
                checkedAt,
              )
            : createDependencyReadiness(
                'degraded',
                `Memory service is ${health.status}.`,
                checkedAt,
              ),
        )
        .catch(() =>
          createDependencyReadiness(
            'degraded',
            'Memory service is unreachable.',
            checkedAt,
          ),
        );
    })();

    return buildReadinessSummary({
      blockedByFeatureFlag,
      minutesApi,
      transcription,
      analysisModel: analysis,
      memoryService: await memoryService,
    });
  })();

  readinessCache = {
    expiresAt: now + READINESS_CACHE_TTL_MS,
    promise,
  };

  const value = await promise;
  readinessCache = {
    expiresAt: Date.now() + READINESS_CACHE_TTL_MS,
    value,
  };
  return value;
}

async function syncSessionReadiness(
  tabId: number,
  forceRefresh = false,
): Promise<MeetingPilotSessionSnapshot | undefined> {
  const session = registry.getSessionByTabId(tabId);
  if (!session) return undefined;
  const readiness = await evaluateMeetingReadiness(forceRefresh);
  return registry.updateObservation(tabId, { readiness });
}

async function syncSessionCaptureGateReadiness(
  tabId: number,
): Promise<MeetingPilotSessionSnapshot | undefined> {
  const session = registry.getSessionByTabId(tabId);
  if (!session) return undefined;
  const envConfig = await getEnvConfig();
  const readiness = buildCaptureGateReadiness({
    blockedByFeatureFlag: envConfig.MEETING_PILOT_ENABLED === false,
    previous: session.readiness,
  });
  return registry.updateObservation(tabId, { readiness });
}

function refreshSessionReadinessInBackground(
  tabId: number,
  forceRefresh = false,
): void {
  void (async () => {
    const updated = await syncSessionReadiness(tabId, forceRefresh);
    if (!updated) return;
    await updateBrowserAction(updated);
    await broadcastSessionSnapshot(updated);
  })().catch((error) => {
    console.warn('[Meeting Pilot][background] readiness refresh failed', {
      tabId,
      error: String((error as Error)?.message || error),
    });
  });
}

function clearDigestPoll(tabId: number): void {
  const existing = digestPollTimers.get(tabId);
  if (existing) {
    clearTimeout(existing);
    digestPollTimers.delete(tabId);
  }
}

function scheduleDigestPoll(tabId: number, delayMs = 5000): void {
  clearDigestPoll(tabId);
  const timer = setTimeout(() => {
    digestPollTimers.delete(tabId);
    void pollDigestStatus(tabId);
  }, delayMs);
  digestPollTimers.set(tabId, timer as unknown as number);
}

async function pollDigestStatus(tabId: number): Promise<void> {
  const session = registry.getSessionByTabId(tabId);
  if (
    !session ||
    session.digest.status !== 'processing' ||
    !session.digest.lookupId
  ) {
    clearDigestPoll(tabId);
    return;
  }

  const envConfig = await getEnvConfig();
  const baseUrl = trimTrailingSlash(
    String(
      envConfig.MEETING_MINUTES_API_URL ||
        envConfig.MEETING_DIGEST_API_BASE_URL ||
        '',
    ),
  );
  if (!baseUrl) {
    clearDigestPoll(tabId);
    const failed = await registry.updateDigest(tabId, {
      status: 'failed',
      errorCode: 'missing_minutes_api_base_url',
      message:
        'Minutes API is not configured. PDF minutes were skipped for this meeting.',
      updatedAt: Date.now(),
    });
    if (failed) {
      await updateBrowserAction(failed);
      await broadcastSessionSnapshot(failed);
    }
    return;
  }

  try {
    const response = await fetch(
      joinUrl(
        baseUrl,
        `/api/v3/digest/${encodeURIComponent(session.digest.lookupId)}`,
      ),
      {
        method: 'GET',
        signal: withTimeoutSignal(8000),
      },
    );
    const data = await response.json();
    if (!response.ok) {
      throw new Error(String(data?.error || 'digest_poll_failed'));
    }

    if (data.status === 'COMPLETED') {
      clearDigestPoll(tabId);
      const updated = await registry.updateDigest(tabId, {
        status: 'completed',
        taskId: session.digest.taskId,
        lookupId: session.digest.lookupId,
        videoUrl: session.digest.videoUrl,
        resultUrl: typeof data.pdfUrl === 'string' ? data.pdfUrl : undefined,
        message: String(data.message || 'Digest ready'),
        errorCode: undefined,
        updatedAt: Date.now(),
      });
      const captureUpdated = await registry.setCaptureState(tabId, {
        kind: 'completed',
        lastError: undefined,
      });
      const next = captureUpdated || updated;
      if (next) {
        await updateBrowserAction(next);
        await broadcastSessionSnapshot(next);
        void archiveMeetingSession(next);
      }
      return;
    }

    if (data.status === 'FAILED') {
      clearDigestPoll(tabId);
      const updated = await registry.updateDigest(tabId, {
        status: 'failed',
        message: String(data.message || 'Digest failed'),
        errorCode: String(data.errorCode || '').trim() || undefined,
        updatedAt: Date.now(),
      });
      const captureUpdated = await registry.setCaptureState(tabId, {
        kind: 'error',
        lastError: String(data.message || 'digest_failed'),
      });
      const next = captureUpdated || updated;
      if (next) {
        await updateBrowserAction(next);
        await broadcastSessionSnapshot(next);
      }
      return;
    }

    const updated = await registry.updateDigest(tabId, {
      status: 'processing',
      taskId: session.digest.taskId,
      lookupId: session.digest.lookupId,
      videoUrl: session.digest.videoUrl,
      message: String(data.message || 'Digest generation in progress'),
      updatedAt: Date.now(),
    });
    if (updated) {
      await broadcastSessionSnapshot(updated);
    }
    scheduleDigestPoll(tabId);
  } catch (error) {
    const updated = await registry.updateDigest(tabId, {
      status: 'processing',
      message: `Digest polling retrying: ${String(
        (error as Error)?.message || error || 'unknown_error',
      )}`,
      updatedAt: Date.now(),
    });
    if (updated) {
      await broadcastSessionSnapshot(updated);
    }
    scheduleDigestPoll(tabId, 8000);
  }
}

async function resumeDigestPolling(): Promise<void> {
  for (const session of registry.listSessions()) {
    if (session.digest.status === 'processing' && session.digest.lookupId) {
      scheduleDigestPoll(session.tabId, 1000);
    }
  }
}

function normalizeStructuredJson(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }
  const objectMatch = raw.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    return objectMatch[0];
  }
  return raw.trim();
}

function normalizeTitleForGenericCheck(value?: string): string {
  return String(value || '')
    .trim()
    .replace(/\s*[|｜-]\s*Personal AI$/i, '')
    .replace(/\s*[|｜-]\s*Meeting Pilot$/i, '')
    .replace(/[“”"'.!！?？:：;；,，、()[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function shouldGenerateMeetingArchiveTitle(
  title?: string,
  meetingId?: string,
): boolean {
  const normalized = normalizeTitleForGenericCheck(title);
  if (
    GENERIC_MEETING_TITLE_PATTERNS.some((pattern) => pattern.test(normalized))
  ) {
    return true;
  }
  if (/^.+ speaking$/.test(normalized)) {
    return true;
  }
  const compactMeetingId = String(meetingId || '')
    .trim()
    .toLowerCase();
  if (
    compactMeetingId &&
    normalized.includes(compactMeetingId) &&
    normalized.length <= compactMeetingId.length + 20
  ) {
    return true;
  }
  return false;
}

export function normalizeGeneratedMeetingArchiveTitle(
  value?: string,
  meetingId?: string,
): string | undefined {
  let title = String(value || '')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, '')
    .replace(/^(?:title|会议标题)\s*[:：]\s*/i, '')
    .replace(/^\d+[).、]\s*/, '')
    .replace(/\s+/g, ' ')
    .replace(/[。.!！?？:：;；,，、]+$/g, '')
    .trim();

  if (!title) return undefined;
  if (title.length > MEETING_TITLE_MAX_LENGTH) {
    title = `${title.slice(0, MEETING_TITLE_MAX_LENGTH - 3).trim()}...`;
  }
  if (shouldGenerateMeetingArchiveTitle(title, meetingId)) {
    return undefined;
  }
  return title;
}

function extractTitleCandidateFromSentence(value?: string): string | undefined {
  const sentence = String(value || '')
    .replace(/^#+\s*/gm, '')
    .split(/[\n。.!！?？]/)
    .map((item) => item.trim())
    .find(Boolean);
  if (!sentence) return undefined;
  return sentence.replace(
    /^(?:当前|本次)?会议(?:主要|讨论|聚焦于|围绕)?\s*/i,
    '',
  );
}

export function buildFallbackMeetingArchiveTitle(
  session: MeetingPilotSessionSnapshot,
): string | undefined {
  const candidates = [
    ...session.chapters
      .slice(-3)
      .reverse()
      .map((chapter) => chapter.title),
    session.latestStructuredParse?.topic,
    session.currentTopic,
    session.decisions[0]?.text,
    session.actionItems[0]?.title,
    extractTitleCandidateFromSentence(session.summary),
    extractTitleCandidateFromSentence(
      session.transcript
        .filter((chunk) => !chunk.lowConfidence)
        .slice(-4)
        .map((chunk) => chunk.text)
        .join(' '),
    ),
  ];

  for (const candidate of candidates) {
    const normalized = normalizeGeneratedMeetingArchiveTitle(
      candidate,
      session.meetingId,
    );
    if (normalized) return normalized;
  }
  return undefined;
}

function hasUsefulMeetingTitleContext(
  session: MeetingPilotSessionSnapshot,
): boolean {
  if (session.transcript.filter((chunk) => !chunk.lowConfidence).length >= 2) {
    return true;
  }
  if (session.chapters.some((chapter) => chapter.summary || chapter.title)) {
    return true;
  }
  const summary = String(session.summary || '').trim();
  const summaryIsGeneric =
    !summary ||
    /Meeting Pilot is waiting|participants detected|Open the panel|recording this meeting/i.test(
      summary,
    );
  return Boolean(
    !summaryIsGeneric ||
      session.decisions.length ||
      session.actionItems.length ||
      session.latestStructuredParse?.topic,
  );
}

function buildMeetingArchiveTitlePrompt(
  session: MeetingPilotSessionSnapshot,
): string {
  const transcriptWindow = session.transcript
    .filter((chunk) => !chunk.lowConfidence)
    .slice(-20)
    .map(
      (chunk) =>
        `[${formatTranscriptTimestamp(chunk.ts)}] ${chunk.speaker}: ${
          chunk.text
        }`,
    )
    .join('\n');
  const chapters = session.chapters
    .slice(-5)
    .map((chapter) => `- ${chapter.title}: ${chapter.summary || ''}`)
    .join('\n');
  const decisions = session.decisions
    .slice(0, 6)
    .map((decision) => `- ${decision.text}`)
    .join('\n');
  const actionItems = session.actionItems
    .slice(0, 6)
    .map((item) => `- ${item.owner}: ${item.title}`)
    .join('\n');

  return `Generate a concise archive title for this meeting. Return strict JSON only: {"title":"..."}.

Rules:
- Use the actual meeting topic/content, not the browser title.
- Keep it under 18 Chinese characters or 8 English words.
- Do not include dates, participant names unless essential, quotes, or generic words like "meeting" / "discussion".
- Prefer a noun phrase, for example "Q2 预算与排期确认" or "API migration risk review".

Browser title: ${session.title}
Current topic: ${session.currentTopic}
Summary: ${session.summary}
Chapters:
${chapters || 'none'}
Decisions:
${decisions || 'none'}
Action items:
${actionItems || 'none'}
Transcript:
${transcriptWindow || 'none'}`;
}

async function resolveMeetingArchiveTitle(
  session: MeetingPilotSessionSnapshot,
  envConfig: Awaited<ReturnType<typeof getEnvConfig>>,
): Promise<string | undefined> {
  if (!shouldGenerateMeetingArchiveTitle(session.title, session.meetingId)) {
    return normalizeGeneratedMeetingArchiveTitle(
      session.title,
      session.meetingId,
    );
  }

  const fallback = buildFallbackMeetingArchiveTitle(session);
  if (
    !hasUsefulMeetingTitleContext(session) ||
    !isMainLLMConfiguredForMeetingAnalysis(envConfig).ok
  ) {
    return fallback;
  }

  try {
    const raw = await runMeetingIntelligenceLLM({
      systemPrompt:
        'You write short, specific titles for archived meeting records. Output valid JSON only.',
      userPrompt: buildMeetingArchiveTitlePrompt(session),
    });
    const parsed = JSON.parse(normalizeStructuredJson(raw)) as {
      title?: string;
    };
    return (
      normalizeGeneratedMeetingArchiveTitle(parsed.title, session.meetingId) ||
      fallback
    );
  } catch (error) {
    console.warn('Meeting Pilot archive title generation failed:', error);
    return fallback;
  }
}

async function prepareMeetingSessionForArchive(
  session: MeetingPilotSessionSnapshot,
): Promise<MeetingPilotSessionSnapshot> {
  const envConfig = await getEnvConfig();
  const archiveTitle = await resolveMeetingArchiveTitle(session, envConfig);
  if (!archiveTitle || archiveTitle === session.title) {
    return session;
  }
  const updated = await registry.updateObservation(session.tabId, {
    title: archiveTitle,
  });
  if (updated) {
    await updateBrowserAction(updated);
    await broadcastSessionSnapshot(updated);
    return updated;
  }
  return {
    ...session,
    title: archiveTitle,
  };
}

function formatTranscriptTimestamp(ts: number): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

async function runMeetingAnalysis(
  session: MeetingPilotSessionSnapshot,
  transcript: MeetingPilotSessionSnapshot['transcript'],
  envConfig: Awaited<ReturnType<typeof getEnvConfig>>,
): Promise<MeetingPilotStructuredParseResult | undefined> {
  if (transcript.length < 2) {
    return undefined;
  }
  if (!isMainLLMConfiguredForMeetingAnalysis(envConfig).ok) {
    return undefined;
  }

  const transcriptWindow = transcript
    .slice(-12)
    .map(
      (chunk) =>
        `[${formatTranscriptTimestamp(chunk.ts)}] ${chunk.speaker}: ${
          chunk.text
        }`,
    )
    .join('\n');
  const participantList = session.participants
    .map(
      (item) =>
        `{id:${item.id},name:${item.name},state:${
          item.resolutionState || 'unknown'
        }}`,
    )
    .join(', ');
  const provisionalList = session.participants
    .filter(
      (p) =>
        p.resolutionState === 'provisional' || p.resolutionState === 'device',
    )
    .map((p) => `${p.id}=${p.name}`)
    .join(', ');
  const rosterList = session.participants
    .filter(
      (p) =>
        p.resolutionState === 'roster' || p.resolutionState === 'user_named',
    )
    .map((p) => `${p.id}=${p.name}`)
    .join(', ');
  const userPrompt = `You are analyzing an ongoing RingCentral meeting. Return strict JSON only with this shape:
{
  "topic": string,
  "summary": string,
  "actionItems": [{"title": string, "owner": string, "deadline": string, "status": "pending"|"done", "evidence": string}],
  "decisions": [{"text": string, "timestamp": string}],
  "alerts": [{"level": "P0"|"P1"|"P2", "title": string, "body": string, "source": "mention"|"memory"|"share"|"summary"|"action"}],
  "participantStances": [{"participant": string, "topic": string, "stance": "主导"|"支持"|"中立"|"质疑"|"反对", "keyQuote": string, "timeRange": string}],
  "participantResolutions": [{"fromId": string, "toId": string, "confidence": number, "evidence": string}],
  "latestObservationText": string
}

Requirements:
- Infer topic, summary, action items, decisions, alerts, and participant stances from the transcript plus screen observation when available.
- Use tone in the transcript when deciding stance (supportive, doubtful, strong objection, etc.).
- For participantStances.participant, prefer using one of the participant names listed below verbatim.
- participantResolutions: ONLY when you are highly confident (>=0.85) that a provisional/device participant is the same person as a roster participant, output {fromId, toId} mapping the provisional/device id to the roster id. Otherwise omit. Never merge two roster ids together.
- latestObservationText should be a concise OCR/observation-style text summary of the currently shared content or meeting focus.
- Prefer concrete owners and deadlines when present; otherwise use empty string.
- For actionItems.evidence, include the shortest supporting transcript quote that proves the task assignment.
- Keep alerts high precision and useful.

Meeting title: ${session.title}
Current topic hint: ${session.currentTopic}
Participants: ${participantList || 'Unknown'}
Roster (real names): ${rosterList || 'none'}
Provisional/device speakers (may be merged): ${provisionalList || 'none'}
Share state: ${session.shareState}
Sharer: ${session.sharerName || 'Unknown'}
Screen observation / OCR: ${session.latestObservationText || 'none'}
Transcript:\n${transcriptWindow}`;

  const systemPrompt =
    'You extract structured meeting intelligence. Output valid JSON only.';
  let content: string;
  try {
    content = (
      await runMeetingIntelligenceLLM({ systemPrompt, userPrompt })
    ).trim();
  } catch (error) {
    console.warn('Meeting Pilot runMeetingIntelligenceLLM failed:', error);
    return undefined;
  }
  if (!content) {
    return undefined;
  }

  const parsed = JSON.parse(normalizeStructuredJson(content)) as {
    topic?: string;
    summary?: string;
    actionItems?: Array<{
      title?: string;
      owner?: string;
      deadline?: string;
      status?: 'pending' | 'done';
      evidence?: string;
    }>;
    decisions?: Array<{
      text?: string;
      timestamp?: string;
    }>;
    alerts?: Array<{
      level?: MeetingPilotAlert['level'];
      title?: string;
      body?: string;
      source?: MeetingPilotAlert['source'];
    }>;
    participantStances?: Array<{
      participant?: string;
      topic?: string;
      stance?: MeetingPilotParticipantStance['stance'];
      keyQuote?: string;
      timeRange?: string;
    }>;
    participantResolutions?: Array<{
      fromId?: string;
      toId?: string;
      confidence?: number;
      evidence?: string;
    }>;
    latestObservationText?: string;
  };

  const nowLabel = formatTranscriptTimestamp(Date.now());
  return {
    topic: parsed.topic?.trim() || session.currentTopic,
    summary: parsed.summary?.trim() || session.summary,
    actionItems: (parsed.actionItems || [])
      .filter((item) => item.title?.trim())
      .map((item, index) => ({
        id: `action-llm-${index}`,
        title: item.title!.trim(),
        owner: item.owner?.trim() || 'Unknown',
        deadline: item.deadline?.trim() || undefined,
        status: item.status === 'done' ? 'done' : 'pending',
        reviewState: 'suggested',
        evidence: item.evidence?.trim() || undefined,
        timestamp: nowLabel,
        source: 'llm',
      })),
    decisions: (parsed.decisions || [])
      .filter((item) => item.text?.trim())
      .map(
        (item, index): MeetingPilotDecisionItem => ({
          id: `decision-llm-${index}`,
          text: item.text!.trim(),
          timestamp: item.timestamp?.trim() || nowLabel,
        }),
      ),
    alerts: (parsed.alerts || [])
      .filter((item) => item.level && item.title?.trim() && item.body?.trim())
      .map(
        (item, index): MeetingPilotAlert => ({
          id: `alert-llm-${index}-${Date.now()}`,
          level: item.level || 'P2',
          title: item.title!.trim(),
          body: item.body!.trim(),
          source: item.source || 'summary',
          createdAt: Date.now(),
        }),
      ),
    participantStances: (parsed.participantStances || [])
      .filter(
        (item) =>
          item.participant?.trim() &&
          item.topic?.trim() &&
          item.stance &&
          item.keyQuote?.trim(),
      )
      .map((item) => ({
        participant: item.participant!.trim(),
        topic: item.topic!.trim(),
        stance: item.stance!,
        keyQuote: item.keyQuote!.trim(),
        timeRange: item.timeRange?.trim(),
      })),
    participantResolutions: (parsed.participantResolutions || [])
      .filter(
        (item) =>
          item.fromId?.trim() &&
          item.toId?.trim() &&
          typeof item.confidence === 'number',
      )
      .map((item) => ({
        fromId: item.fromId!.trim(),
        toId: item.toId!.trim(),
        confidence: Number(item.confidence) || 0,
        evidence: item.evidence?.trim(),
      })),
    latestObservationText:
      parsed.latestObservationText?.trim() ||
      `${session.sharerName || '会议参与者'} 正在共享屏幕，当前讨论聚焦：${
        parsed.topic?.trim() || session.currentTopic
      }`,
  };
}

function inferDecisionFromText(text: string, chapterId: string, index: number) {
  if (!/确认|通过|决定|敲定|同意|approved|agreed/i.test(text)) return undefined;
  return {
    id: `decision-${index}`,
    text: text.slice(0, 96),
    timestamp: new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    }),
    chapterId,
  };
}

function buildStructuredMeetingData(
  session: MeetingPilotSessionSnapshot,
  transcript: MeetingPilotSessionSnapshot['transcript'],
  currentTopic: string,
  screenshotIntervalSec: number,
) {
  const chapterTitle = currentTopic || '会议讨论';
  const chapterId = `chapter-${
    chapterTitle.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/gi, '-') ||
    'current'
  }`;
  const chapterSummary = transcript
    .slice(-4)
    .map((chunk) => chunk.text)
    .join(' ');
  const chapter = {
    id: chapterId,
    title: chapterTitle,
    summary: chapterSummary || session.summary,
    viewMode: 'outline' as const,
    startLabel: new Date(transcript[0]?.ts || Date.now()).toLocaleTimeString(
      [],
      {
        hour: '2-digit',
        minute: '2-digit',
      },
    ),
    actionCount: 0,
    decisionCount: 0,
  };

  const priorChapters = session.chapters.filter(
    (item) => item.id !== chapterId,
  );

  const timelineEvents = transcript.slice(-10).map((chunk) => ({
    id: `timeline-${chunk.id}`,
    type: /负责|跟进|action|todo|ddl|截止|下周/i.test(chunk.text)
      ? ('action' as const)
      : /确认|通过|决定|敲定|同意|approved|agreed/i.test(chunk.text)
      ? ('decision' as const)
      : /提到你|esone|you/i.test(chunk.text)
      ? ('mention' as const)
      : ('topic' as const),
    title: chunk.text.slice(0, 48),
    description: chunk.text,
    timestamp: new Date(chunk.ts).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    }),
    speaker: chunk.speaker,
    chapterId,
  }));

  const lastScreenEvent = session.timelineEvents
    .filter((item) => item.type === 'screen')
    .slice(-1)[0];
  const latestTs = transcript[transcript.length - 1]?.ts || Date.now();
  const lastScreenTsMatch = lastScreenEvent?.id.match(/timeline-screen-(\d+)/);
  const lastScreenTs = lastScreenTsMatch?.[1]
    ? Number(lastScreenTsMatch[1])
    : 0;
  if (
    session.shareState === 'active' &&
    (!lastScreenEvent ||
      Math.abs(latestTs - lastScreenTs) >= screenshotIntervalSec * 1000)
  ) {
    timelineEvents.unshift({
      id: `timeline-screen-${latestTs}`,
      type: 'screen',
      title: '共享画面观察已更新',
      description:
        session.latestObservationText ||
        `${session.sharerName || 'Someone'} 正在共享屏幕，已记录最新观察。`,
      timestamp: new Date(latestTs).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
      speaker: session.sharerName,
      chapterId,
    });
  }

  const actionItems = transcript
    .map((chunk, index) =>
      inferActionItemFromText({
        text: chunk.text,
        speaker: chunk.speaker,
        chapterId,
        index,
        ts: chunk.ts,
      }),
    )
    .filter(
      (item): item is NonNullable<ReturnType<typeof inferActionItemFromText>> =>
        Boolean(item),
    )
    .slice(-8);

  const decisions = transcript
    .map((chunk, index) => inferDecisionFromText(chunk.text, chapterId, index))
    .filter(
      (item): item is NonNullable<ReturnType<typeof inferDecisionFromText>> =>
        Boolean(item),
    )
    .slice(-8);

  chapter.actionCount = actionItems.length;
  chapter.decisionCount = decisions.length;

  return {
    chapters: [...priorChapters, chapter].slice(-5),
    timelineEvents,
    actionItems,
    decisions,
    timelineProgress: transcript.length
      ? Math.min(1, (priorChapters.length + 1) / 5)
      : 0,
  };
}
const handledMeetingPilotTypes = new Set([
  'MEETING_PILOT_GET_STATE',
  'MEETING_PILOT_REGISTER_TAB',
  'MEETING_PILOT_UPDATE_CONTEXT',
  'MEETING_PILOT_OPEN_SIDE_PANEL',
  'MEETING_PILOT_CLOSE_SIDE_PANEL',
  'MEETING_PILOT_SET_SIDE_PANEL_PIN',
  'MEETING_PILOT_ENABLE_CAPTURE_AND_OPEN_PANEL',
  'MEETING_PILOT_SHOW_CAPTURE_AUTH_GUIDE',
  'MEETING_PILOT_OPEN_LIVE_MAP',
  'MEETING_PILOT_START_CAPTURE',
  'MEETING_PILOT_STOP_CAPTURE',
  'MEETING_PILOT_UPDATE_ALERTS',
  'MEETING_PILOT_UPDATE_ACTION_ITEM',
  'MEETING_PILOT_OBSERVATION_UPDATE',
  'MEETING_PILOT_TRANSCRIPT_UPDATE',
  'MEETING_PILOT_RINGCENTRAL_TRANSCRIPT_STATUS',
  'MEETING_PILOT_CAPTURE_STATUS',
  'MEETING_PILOT_DIGEST_STATUS',
  'MEETING_PILOT_RENAME_PARTICIPANT',
  'MEETING_PILOT_MERGE_PARTICIPANTS',
  'MEETING_PILOT_FOCUS_PARTICIPANT',
  'MEETING_PILOT_UPSERT_SPEECH_CONTEXT',
  'MEETING_PILOT_CLEAR_SPEECH_CONTEXT_NOTE',
  'MEETING_PILOT_REFRESH_SPEECH_SUGGESTION',
  'MEETING_PILOT_TEST_INJECT_CAPTURE_CHUNK',
  'MEETING_PILOT_TEST_BOOTSTRAP_CAPTURE',
  'MEETING_PILOT_TEST_SET_API_MOCK',
  'MEETING_PILOT_TEST_SET_SIDE_PANEL_FAILURE',
  'MEETING_PILOT_TEST_GET_API_LOG',
  'MEETING_PILOT_GET_CAPTURE_LOG',
]);

async function ensureInitialized(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      await registry.hydrate();
      await scanOpenMeetingTabs();
      await resumeDigestPolling();
    })();
  }
  await initPromise;
}

async function scanOpenMeetingTabs(): Promise<void> {
  try {
    const tabs = await chrome.tabs.query({
      url: `${MEETING_PILOT_HOST_PREFIX}*`,
    });
    for (const tab of tabs) {
      if (!tab.id || !tab.url) continue;
      const meetingId = extractMeetingIdFromUrl(tab.url);
      if (!meetingId) continue;
      await upsertMeetingSession({
        meetingId,
        tabId: tab.id,
        url: tab.url,
        title: tab.title || 'RingCentral meeting',
        inMeeting: true,
        shareState: 'unknown',
        selfSharing: false,
      });
    }
  } catch (error) {
    console.warn('Meeting Pilot startup scan failed:', error);
  }
}

function buildMeetingSidePanelPath(
  tabId: number,
  options?: {
    catchup?: boolean;
    debug?: boolean;
    surface?: 'side-panel' | 'window';
  },
): string {
  const params = new URLSearchParams({ tabId: String(tabId) });
  if (options?.catchup) {
    params.set('catchup', '1');
  }
  if (options?.debug) {
    params.set('debug', '1');
  }
  if (options?.surface) {
    params.set('surface', options.surface);
  }
  return `${MEETING_PILOT_SIDE_PANEL_PATH}?${params.toString()}`;
}

async function configureTabSidePanel(
  tabId: number,
  enabled: boolean,
  options?: { catchup?: boolean; debug?: boolean },
): Promise<void> {
  if (!chrome.sidePanel?.setOptions) return;
  await chrome.sidePanel.setOptions({
    tabId,
    enabled,
    path: buildMeetingSidePanelPath(tabId, {
      ...options,
      surface: 'side-panel',
    }),
  });
}

async function updateBrowserAction(
  session: MeetingPilotSessionSnapshot,
): Promise<void> {
  try {
    const badgeText = buildMeetingPilotBadgeText(session);
    await chrome.action.setBadgeText({ tabId: session.tabId, text: badgeText });
    await chrome.action.setBadgeBackgroundColor({
      tabId: session.tabId,
      color: session.capture.kind === 'recording' ? '#e74c3c' : '#6c5ce7',
    });
    await chrome.action.setTitle({
      tabId: session.tabId,
      title: buildMeetingPilotTooltip(session),
    });
  } catch (error) {
    console.warn('[Meeting Pilot][background] browser action update failed', {
      tabId: session.tabId,
      meetingId: session.meetingId,
      error: String((error as Error)?.message || error),
    });
  }
}

async function broadcastSessionSnapshot(
  session: MeetingPilotSessionSnapshot,
): Promise<void> {
  try {
    await chrome.runtime.sendMessage({
      type: 'MEETING_PILOT_SESSION_SNAPSHOT',
      snapshot: session,
    });
  } catch {
    // Ignore when no extension page is listening.
  }
  await pushSessionSnapshotToMeetingTab(session, { silent: true });
}

async function pushSessionSnapshotToMeetingTab(
  session: MeetingPilotSessionSnapshot,
  options?: { silent?: boolean },
): Promise<boolean> {
  try {
    await chrome.tabs.sendMessage(session.tabId, {
      type: 'MEETING_PILOT_SESSION_SNAPSHOT',
      snapshot: session,
    });
    return true;
  } catch (error) {
    if (!options?.silent) {
      console.warn('[Meeting Pilot][background] tab snapshot sync failed', {
        tabId: session.tabId,
        meetingId: session.meetingId,
        error: String((error as Error)?.message || error),
      });
    }
    return false;
  }
}

async function clearBrowserAction(tabId: number): Promise<void> {
  await chrome.action.setBadgeText({ tabId, text: '' });
  await chrome.action.setTitle({ tabId, title: 'Meeting Pilot' });
}

async function ensureOffscreenDocument(): Promise<void> {
  if (offscreenReady || !chrome.offscreen?.createDocument) return;
  try {
    await chrome.offscreen.createDocument({
      url: MEETING_PILOT_OFFSCREEN_PATH,
      reasons: ['USER_MEDIA'],
      justification: 'Record meeting tab audio/video for Meeting Pilot',
    });
    offscreenReady = true;
  } catch (error) {
    const message = String((error as Error)?.message || error || '');
    if (!/already exists/i.test(message)) {
      console.warn('Failed to create Meeting Pilot offscreen document:', error);
    }
    offscreenReady = true;
  }
}

async function getMediaStreamId(tabId: number): Promise<string | null> {
  if (!chrome.tabCapture?.getMediaStreamId) return null;
  return new Promise((resolve) => {
    chrome.tabCapture.getMediaStreamId({ targetTabId: tabId }, (streamId) => {
      if (chrome.runtime.lastError) {
        console.warn(
          'Meeting Pilot tabCapture stream error:',
          chrome.runtime.lastError.message,
        );
        resolve(null);
        return;
      }
      resolve(streamId || null);
    });
  });
}

async function pushOffscreenCommand(
  message: Record<string, unknown>,
): Promise<void> {
  await chrome.runtime.sendMessage(message);
}

async function upsertMeetingSession(
  payload: MeetingPilotDetectionPayload,
): Promise<MeetingPilotSessionSnapshot> {
  const existing = registry.getSessionByTabId(payload.tabId);
  const meetingChanged = Boolean(
    existing && existing.meetingId !== payload.meetingId,
  );

  if (payload.inMeeting === false) {
    if (existing?.inMeeting) {
      return (
        (await finalizeMeetingTabSession(payload.tabId)) ||
        createMeetingPilotSessionSnapshot({
          meetingId: payload.meetingId,
          tabId: payload.tabId,
          url: payload.url,
          title: payload.title,
          inMeeting: false,
          status: 'ended',
          endedAt: Date.now(),
        })
      );
    }

    const ended = await registry.upsertDetection(payload);
    await configureTabSidePanel(ended.tabId, false);
    await clearBrowserAction(ended.tabId);
    await broadcastSessionSnapshot(ended);
    return ended;
  }

  if (existing && meetingChanged) {
    await finalizeMeetingTabSession(payload.tabId);
  }

  const session = await registry.upsertDetection(payload);
  const gated = (await syncSessionCaptureGateReadiness(session.tabId)) || session;
  refreshSessionReadinessInBackground(gated.tabId);
  await configureTabSidePanel(gated.tabId, true);
  await updateBrowserAction(gated);
  await broadcastSessionSnapshot(gated);
  return gated;
}

async function endMeetingSession(
  tabId: number,
): Promise<MeetingPilotSessionSnapshot | undefined> {
  const session = await registry.removeByTabId(tabId);
  try {
    await configureTabSidePanel(tabId, false);
  } catch (error) {
    console.warn('[Meeting Pilot][background] side panel cleanup failed', {
      tabId,
      error: String((error as Error)?.message || error),
    });
  }
  try {
    await clearBrowserAction(tabId);
  } catch (error) {
    console.warn('[Meeting Pilot][background] browser action cleanup failed', {
      tabId,
      error: String((error as Error)?.message || error),
    });
  }
  if (session) {
    await broadcastSessionSnapshot(session);
  }
  return session;
}

function shouldStopCaptureForLifecycle(
  session?: MeetingPilotSessionSnapshot,
): boolean {
  return Boolean(session && session.capture.kind === 'recording');
}

async function finalizeMeetingTabSession(
  tabId: number,
  reason = 'meeting-finalize',
): Promise<MeetingPilotSessionSnapshot | undefined> {
  const session = registry.getSessionByTabId(tabId);
  if (!session) return undefined;
  console.info('[Meeting Pilot][background] finalizing meeting tab session', {
    tabId,
    meetingId: session.meetingId,
    reason,
    captureKind: session.capture.kind,
  });
  clearDigestPoll(tabId);
  if (shouldStopCaptureForLifecycle(session)) {
    await stopMeetingCapture(tabId, session.meetingId, reason);
  }
  return endMeetingSession(tabId);
}

async function isRecordingSessionStillOpen(
  session: MeetingPilotSessionSnapshot,
): Promise<boolean> {
  if (!session.inMeeting || session.status === 'ended') {
    return false;
  }
  try {
    const tab = await chrome.tabs.get(session.tabId);
    const tabMeetingId = extractMeetingIdFromUrl(tab.url);
    return tabMeetingId === session.meetingId;
  } catch {
    return false;
  }
}

async function resolveActiveRecordingBlocker(
  tabId: number,
): Promise<MeetingPilotSessionSnapshot | undefined> {
  const activeRecordings = registry
    .listSessions()
    .filter(
      (session) =>
        session.capture.kind === 'recording' && session.tabId !== tabId,
    );

  for (const candidate of activeRecordings) {
    if (await isRecordingSessionStillOpen(candidate)) {
      return candidate;
    }
    console.warn(
      '[Meeting Pilot][background] clearing stale recording session',
      {
        tabId: candidate.tabId,
        meetingId: candidate.meetingId,
        status: candidate.status,
        inMeeting: candidate.inMeeting,
      },
    );
    await finalizeMeetingTabSession(candidate.tabId, 'stale-recording-cleanup');
  }

  return undefined;
}

function isRecentRingCentralTranscriptActive(
  session: MeetingPilotSessionSnapshot | undefined,
): boolean {
  if (!session?.webTranscript?.enabled || !session.webTranscript.active) {
    return false;
  }
  const lastSeenAt = Number(session.webTranscript.lastSeenAt || 0);
  return Boolean(lastSeenAt && Date.now() - lastSeenAt < 60_000);
}

function buildRingCentralTranscriptTierStatus(
  envConfig: Awaited<ReturnType<typeof getEnvConfig>>,
  reason: string,
): MeetingPilotTierStatus {
  return {
    activeTier: 'ringcentral_transcript',
    badge: 'RC Transcript',
    mode: getMeetingTranscriptionMode(envConfig),
    lastTransitionAt: Date.now(),
    lastTransitionReason: reason,
  };
}

type StartMeetingCaptureResult = {
  session?: MeetingPilotSessionSnapshot;
  activeRecording?: MeetingPilotSessionSnapshot;
};

function resolveSessionSelfName(
  session: MeetingPilotSessionSnapshot,
): string | undefined {
  const explicit = session.selfName?.trim();
  if (explicit) return explicit;
  const selfParticipant = session.participants.find(
    (participant) => participant.isSelf || participant.role === 'You',
  );
  return (
    selfParticipant?.name?.replace(/\s*\(you\)\s*$/i, '').trim() || undefined
  );
}

async function startMeetingCapture(
  tabId: number,
  meetingId: string,
  preferredStreamId?: string,
): Promise<StartMeetingCaptureResult> {
  await ensureInitialized();

  const activeRecording = await resolveActiveRecordingBlocker(tabId);
  if (activeRecording) {
    const blocked = await registry.updateSession(tabId, (s) => ({
      ...s,
      capture: {
        ...s.capture,
        kind: 'error' as const,
        lastError: `Already recording meeting ${activeRecording.meetingId} on another tab. Stop that first.`,
      },
      updatedAt: Date.now(),
    }));
    if (blocked) await broadcastSessionSnapshot(blocked);
    return {
      session: blocked ?? undefined,
      activeRecording,
    };
  }

  const session = await syncSessionCaptureGateReadiness(tabId);
  if (!session || session.meetingId !== meetingId) {
    console.warn('[Meeting Pilot][background] capture session not ready', {
      tabId,
      meetingId,
      sessionMeetingId: session?.meetingId,
      hasSession: Boolean(session),
    });
    return { session: undefined };
  }
  if (!session.readiness.canStartCapture) {
    console.warn('[Meeting Pilot][background] capture blocked by readiness', {
      tabId,
      meetingId,
      readiness: session.readiness,
    });
    await broadcastSessionSnapshot(session);
    return { session };
  }
  refreshSessionReadinessInBackground(tabId);

  const envConfig = await getEnvConfig();
  const webTranscriptActive =
    isMeetingRingCentralTranscriptEnabled(envConfig) &&
    isRecentRingCentralTranscriptActive(session);
  const selfName = resolveSessionSelfName(session);
  const armed = await registry.setCaptureState(tabId, {
    kind: 'armed',
    startedAt: Date.now(),
    stoppedAt: undefined,
    chunkCount: session.capture.chunkCount,
    lastError: undefined,
  });
  if (armed) {
    await updateBrowserAction(armed);
    await broadcastSessionSnapshot(armed);
  }
  const streamId = preferredStreamId || (await getMediaStreamId(tabId));

  if (!streamId) {
    if (testUseMockCapture) {
      const fallbackStreamId = '__meeting_pilot_test_mock_stream__';
      await ensureOffscreenDocument();
      await new Promise((resolve) => setTimeout(resolve, 150));
      await pushOffscreenCommand({
        type: 'MEETING_PILOT_OFFSCREEN_START_CAPTURE',
        tabId,
        meetingId,
        streamId: fallbackStreamId,
        title: session.title,
        micMuted: session.micMuted === true,
        selfName,
        speakerLabel: session.speakerLabel,
        webTranscriptActive,
      });
      const updated = await registry.setCaptureState(tabId, {
        kind: 'recording',
        startedAt: session.capture.startedAt || Date.now(),
        streamId: fallbackStreamId,
        chunkCount: session.capture.chunkCount,
        lastError: undefined,
      });
      if (updated) {
        await updateBrowserAction(updated);
        await broadcastSessionSnapshot(updated);
      }
      return { session: updated };
    }
    console.warn('[Meeting Pilot][background] tabCapture stream unavailable', {
      tabId,
      meetingId,
      preferredStreamProvided: Boolean(preferredStreamId),
    });
    const updated = await registry.setCaptureState(tabId, {
      kind: 'error',
      lastError: 'tabCapture_stream_unavailable',
      startedAt: Date.now(),
    });
    if (updated) {
      await updateBrowserAction(updated);
      await broadcastSessionSnapshot(updated);
    }
    return { session: updated };
  }

  await ensureOffscreenDocument();
  await new Promise((resolve) => setTimeout(resolve, 150));
  try {
    await pushOffscreenCommand({
      type: 'MEETING_PILOT_OFFSCREEN_START_CAPTURE',
      tabId,
      meetingId,
      streamId,
      title: session.title,
      micMuted: session.micMuted === true,
      selfName,
      speakerLabel: session.speakerLabel,
      webTranscriptActive,
    });
  } catch (error) {
    const updated = await registry.setCaptureState(tabId, {
      kind: 'error',
      lastError: String(
        (error as Error)?.message || error || 'offscreen_start_failed',
      ),
      startedAt: Date.now(),
      streamId,
    });
    if (updated) {
      await updateBrowserAction(updated);
      await broadcastSessionSnapshot(updated);
    }
    return { session: updated };
  }

  const updated = await registry.setCaptureState(tabId, {
    kind: 'recording',
    startedAt: session.capture.startedAt || Date.now(),
    streamId,
    chunkCount: session.capture.chunkCount,
    lastError: undefined,
  });
  if (updated) {
    await updateBrowserAction(updated);
    await broadcastSessionSnapshot(updated);
  }
  return { session: updated };
}

async function ensureMeetingSessionForCapture(params: {
  tabId: number;
  meetingId: string;
  url?: string;
  title?: string;
  sender?: chrome.runtime.MessageSender;
}): Promise<MeetingPilotSessionSnapshot | undefined> {
  const existing = registry.getSessionByTabId(params.tabId);
  if (existing && existing.meetingId === params.meetingId) {
    return existing;
  }
  if (!params.tabId || !params.meetingId) {
    return existing;
  }
  return upsertMeetingSession({
    meetingId: params.meetingId,
    tabId: params.tabId,
    url: params.url || params.sender?.tab?.url || '',
    title: params.title || params.sender?.tab?.title || 'RingCentral meeting',
    inMeeting: true,
    shareState: 'unknown',
    selfSharing: false,
    detectedAt: Date.now(),
  });
}

async function stopMeetingCapture(
  tabId: number,
  meetingId: string,
  reason = 'manual-stop',
): Promise<MeetingPilotSessionSnapshot | undefined> {
  await ensureInitialized();
  const session = registry.getSessionByTabId(tabId);
  if (!session || session.meetingId !== meetingId) return undefined;

  console.info('[Meeting Pilot][background] stopping meeting capture', {
    tabId,
    meetingId,
    reason,
    chunkCount: session.capture.chunkCount,
  });
  try {
    await pushOffscreenCommand({
      type: 'MEETING_PILOT_OFFSCREEN_STOP_CAPTURE',
      tabId,
      meetingId,
      reason,
    });
  } catch (error) {
    console.warn('Meeting Pilot offscreen stop failed:', error);
  }

  const updated = await registry.setCaptureState(tabId, {
    kind: 'stopped',
    stoppedAt: Date.now(),
    chunkCount: session.capture.chunkCount,
  });
  if (updated) {
    await updateBrowserAction(updated);
    await broadcastSessionSnapshot(updated);
    void archiveMeetingSession(updated);
  }
  return updated;
}

async function openMeetingLiveMap(tabId: number): Promise<void> {
  await chrome.windows.create({
    url: chrome.runtime.getURL(`${MEETING_PILOT_LIVE_MAP_PATH}?tabId=${tabId}`),
    type: 'popup',
    width: 1360,
    height: 920,
    focused: true,
  });
  if (chrome.sidePanel?.open) {
    try {
      await chrome.sidePanel.open({ tabId });
    } catch {
      // ignore if side panel cannot be opened for the active tab
    }
  }
}

async function openMeetingSidePanelWindow(
  tabId: number,
  options?: { catchup?: boolean; debug?: boolean },
): Promise<void> {
  await chrome.windows.create({
    url: chrome.runtime.getURL(
      buildMeetingSidePanelPath(tabId, {
        ...options,
        surface: 'window',
      }),
    ),
    type: 'popup',
    width: 1280,
    height: 920,
    focused: true,
  });
}

async function openMeetingEmbeddedPanel(
  tabId: number,
  source?: string,
  retried = false,
): Promise<boolean> {
  try {
    const response = await chrome.tabs.sendMessage(tabId, {
      type: 'MEETING_PILOT_OPEN_EMBEDDED_PANEL',
      tabId,
      source,
    });
    const success = Boolean(response?.success);
    if (!success) {
      console.warn('[Meeting Pilot][background] embedded panel open rejected', {
        tabId,
        source,
        response,
      });
      if (!retried) {
        await ensureMeetingContentScript(tabId);
        return openMeetingEmbeddedPanel(tabId, source, true);
      }
    }
    return success;
  } catch (error) {
    console.warn('[Meeting Pilot][background] embedded panel open failed', {
      tabId,
      source,
      error: String((error as Error)?.message || error),
    });
    if (!retried) {
      await ensureMeetingContentScript(tabId);
      return openMeetingEmbeddedPanel(tabId, source, true);
    }
    return false;
  }
}

async function ensureMeetingContentScript(tabId: number): Promise<void> {
  if (!chrome.scripting?.executeScript) {
    return;
  }
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['contentScriptRingCentralMeeting.js'],
    });
    await new Promise((resolve) => setTimeout(resolve, 100));
  } catch (error) {
    console.warn(
      '[Meeting Pilot][background] content script injection failed',
      {
        tabId,
        error: String((error as Error)?.message || error),
      },
    );
  }
}

async function closeMeetingEmbeddedPanel(tabId: number): Promise<boolean> {
  try {
    const response = await chrome.tabs.sendMessage(tabId, {
      type: 'MEETING_PILOT_CLOSE_EMBEDDED_PANEL',
      tabId,
    });
    return Boolean(response?.success);
  } catch {
    return false;
  }
}

async function showCaptureAuthGuide(
  tabId: number,
  retried = false,
): Promise<boolean> {
  try {
    const response = await chrome.tabs.sendMessage(tabId, {
      type: 'MEETING_PILOT_SHOW_CAPTURE_AUTH_GUIDE',
      tabId,
    });
    return Boolean(response?.success);
  } catch (error) {
    if (!retried) {
      await ensureMeetingContentScript(tabId);
      return showCaptureAuthGuide(tabId, true);
    }
    console.warn('[Meeting Pilot][background] auth guide open failed', {
      tabId,
      error: String((error as Error)?.message || error),
    });
    return false;
  }
}

function buildSidePanelOpenOptions(source?: string): {
  catchup: boolean;
  debug: boolean;
} {
  return {
    catchup: source === 'overlay-catchup',
    debug: source === 'overlay' || source === 'overlay-catchup',
  };
}

async function openMeetingChromeSidePanel(
  tabId: number,
  source?: string,
  behavior?: { fallbackToWindow?: boolean },
): Promise<'side-panel' | 'window' | 'unavailable'> {
  const openOptions = buildSidePanelOpenOptions(source);
  await configureTabSidePanel(tabId, true, openOptions);

  if (chrome.sidePanel?.open) {
    try {
      if (testForceSidePanelOpenFailure) {
        throw new Error('sidepanel_user_gesture_required');
      }
      await chrome.sidePanel.open({ tabId });
      return 'side-panel';
    } catch (error) {
      console.warn(
        '[Meeting Pilot][background] Chrome side panel open failed',
        {
          tabId,
          source,
          error: String((error as Error)?.message || error),
        },
      );
    }
  }

  if (behavior?.fallbackToWindow === false) {
    return 'unavailable';
  }

  console.warn(
    '[Meeting Pilot][background] falling back to side panel window',
    {
      tabId,
      source,
      catchup: openOptions.catchup,
      debug: openOptions.debug,
    },
  );
  await openMeetingSidePanelWindow(tabId, openOptions);
  return 'window';
}

async function openMeetingSidePanel(
  tabId: number,
  source?: string,
  options?: { preferSurface?: 'embedded' | 'side-panel' },
): Promise<'embedded' | 'side-panel' | 'window' | 'unavailable'> {
  if (options?.preferSurface === 'side-panel') {
    return openMeetingChromeSidePanel(tabId, source, {
      fallbackToWindow: false,
    });
  }

  const openOptions = buildSidePanelOpenOptions(source);
  await configureTabSidePanel(tabId, true, openOptions);

  if (await openMeetingEmbeddedPanel(tabId, source)) {
    return 'embedded';
  }

  if (options?.preferSurface === 'embedded') {
    return 'unavailable';
  }

  return openMeetingChromeSidePanel(tabId, source);
}

function isCaptureActiveForUi(session?: MeetingPilotSessionSnapshot): boolean {
  return Boolean(
    session &&
      ['armed', 'recording', 'uploading', 'completed'].includes(
        session.capture.kind,
      ),
  );
}

function buildStateResponse(tabId?: number): MeetingPilotStateResponse {
  const sessions = registry.listSessions();
  const activeSession =
    typeof tabId === 'number'
      ? registry.getSessionByTabId(tabId)
      : registry.getActiveSession();
  return {
    activeMeetingId: registry.getActiveMeetingId(),
    sessions,
    activeSession,
  };
}

function getMeetingLlmRunner(
  envConfig: Awaited<ReturnType<typeof getEnvConfig>>,
): MeetingPilotLlmRunner | undefined {
  return isMainLLMConfiguredForMeetingAnalysis(envConfig).ok
    ? runMeetingIntelligenceLLM
    : undefined;
}

function createSpeechGuidanceContext(
  current?: MeetingPilotSpeechGuidanceContext,
): MeetingPilotSpeechGuidanceContext {
  return {
    sessionNotes: current?.sessionNotes || [],
    profileRefs: current?.profileRefs || [],
    lastInputText: current?.lastInputText,
    lastClassifiedAt: current?.lastClassifiedAt,
    lastClassificationScope: current?.lastClassificationScope,
    lastClassificationReason: current?.lastClassificationReason,
    updatedAt: current?.updatedAt,
  };
}

function createSpeechGuidanceNote(
  text: string,
  sourceInput?: string,
): MeetingPilotSpeechGuidanceSessionNote {
  return {
    id: `speech-note-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    text,
    sourceInput,
    createdAt: Date.now(),
  };
}

async function getProfileCoreForSpeechSuggestion(): Promise<string> {
  try {
    const client = getMemoryServiceClient();
    const profile = await client.getUserCore();
    return profile.content || '';
  } catch {
    return '';
  }
}

function resolveSpeechActionTabId(rawTabId: number): number {
  if (Number.isFinite(rawTabId) && registry.getSessionByTabId(rawTabId)) {
    return rawTabId;
  }
  const activeSession = registry.getActiveSession();
  if (activeSession) {
    return activeSession.tabId;
  }
  const activeRecording = registry
    .listSessions()
    .find((session) => session.capture.kind === 'recording');
  if (activeRecording) {
    return activeRecording.tabId;
  }
  return rawTabId;
}

async function refreshSpeechSuggestion(
  tabId: number,
  options: { force?: boolean } = {},
): Promise<MeetingPilotSessionSnapshot | undefined> {
  const session = registry.getSessionByTabId(tabId);
  if (!session || session.status === 'ended') {
    return session;
  }

  const profileCore = await getProfileCoreForSpeechSuggestion();
  const signature = buildSpeechSuggestionSignature(session, profileCore);
  const existingSignature = speechSuggestionLastSignatures.get(tabId);
  const existingSuggestion = session.speechSuggestion;
  if (
    !options.force &&
    existingSignature === signature &&
    existingSuggestion?.expiresAt &&
    existingSuggestion.expiresAt > Date.now()
  ) {
    return session;
  }

  const envConfig = await getEnvConfig();
  const suggestion = await buildMeetingPilotSpeechSuggestion(
    {
      session,
      profileCore,
      now: Date.now(),
    },
    getMeetingLlmRunner(envConfig),
  );
  speechSuggestionLastRunAt.set(tabId, Date.now());
  speechSuggestionLastSignatures.set(tabId, signature);

  if (
    !options.force &&
    existingSuggestion?.text === suggestion.text &&
    existingSuggestion?.source === suggestion.source &&
    existingSuggestion?.intent === suggestion.intent
  ) {
    return session;
  }

  const updated = await registry.updateObservation(tabId, {
    speechSuggestion: suggestion,
  });
  if (updated) {
    await broadcastSessionSnapshot(updated);
  }
  return updated;
}

function scheduleSpeechSuggestionRefresh(tabId: number, delayMs = 1200): void {
  const existing = speechSuggestionRefreshTimers.get(tabId);
  if (existing) {
    clearTimeout(existing);
  }
  const lastRunAt = speechSuggestionLastRunAt.get(tabId) || 0;
  const throttleDelay = Math.max(delayMs, 10_000 - (Date.now() - lastRunAt));
  const timer = setTimeout(() => {
    speechSuggestionRefreshTimers.delete(tabId);
    void refreshSpeechSuggestion(tabId).catch((error) => {
      console.warn('Meeting Pilot speech suggestion refresh failed:', error);
    });
  }, throttleDelay);
  speechSuggestionRefreshTimers.set(tabId, timer as unknown as number);
}

async function createSpeechProfileRef(args: {
  session: MeetingPilotSessionSnapshot;
  itemType: MeetingPilotSpeechGuidanceProfileRef['itemType'];
  itemKey: string;
  itemValue: string;
  confidence: number;
}): Promise<MeetingPilotSpeechGuidanceProfileRef> {
  const client = getMemoryServiceClient();
  try {
    const created = await client.createProfileItem({
      itemType: args.itemType,
      itemKey: args.itemKey,
      itemValue: args.itemValue,
      confidence: args.confidence,
      evidenceRefs: [
        {
          source: 'meeting_pilot_speech_context',
          meetingId: args.session.meetingId,
          tabId: args.session.tabId,
          title: args.session.title,
          capturedAt: Date.now(),
        },
      ],
    });
    return {
      id: String((created as any)?.id || ''),
      itemType: args.itemType,
      itemKey: args.itemKey,
      itemValue: args.itemValue,
      createdAt: Date.now(),
    };
  } catch (error) {
    const status = (error as MemoryServiceError)?.status;
    const existingId = (error as MemoryServiceError)?.body?.existingId;
    if (status === 409 && existingId) {
      return {
        id: String(existingId),
        itemType: args.itemType,
        itemKey: args.itemKey,
        itemValue: args.itemValue,
        createdAt: Date.now(),
      };
    }
    throw error;
  }
}

async function handleSpeechContextUpsert(
  request: Record<string, any>,
  tabId: number,
): Promise<{
  success: boolean;
  message: string;
  session?: MeetingPilotSessionSnapshot;
  scope?: string;
  memorySaved?: boolean;
  error?: string;
}> {
  const text = String(request.text || request.value || '').trim();
  const session = registry.getSessionByTabId(tabId);
  if (
    !session ||
    (request.meetingId && request.meetingId !== session.meetingId)
  ) {
    return { success: false, message: '没有找到当前会议。' };
  }
  if (!text) {
    return { success: false, message: '请输入身份或本场上下文。' };
  }

  const envConfig = await getEnvConfig();
  const classification = await classifyMeetingPilotSpeechGuidanceInput(
    {
      text,
      meetingTitle: session.title,
      currentTopic: session.currentTopic,
    },
    getMeetingLlmRunner(envConfig),
  );
  const baseContext = createSpeechGuidanceContext(
    session.speechGuidanceContext,
  );
  let nextContext: MeetingPilotSpeechGuidanceContext = {
    ...baseContext,
    lastInputText: text,
    lastClassifiedAt: Date.now(),
    lastClassificationScope: classification.scope,
    lastClassificationReason: classification.reason,
    updatedAt: Date.now(),
  };

  let memorySaved = false;
  let responseMessage = '已用于本次会议';
  let memoryError: string | undefined;

  if (classification.scope === 'long_term_profile') {
    try {
      const profileRef = await createSpeechProfileRef({
        session,
        itemType: classification.itemType,
        itemKey: classification.itemKey,
        itemValue: classification.itemValue,
        confidence: classification.confidence,
      });
      memorySaved = true;
      responseMessage = '已记住，下次会议会自动使用';
      nextContext = {
        ...nextContext,
        profileRefs: [
          profileRef,
          ...nextContext.profileRefs.filter((ref) => ref.id !== profileRef.id),
        ].slice(0, 12),
      };
    } catch (error) {
      memoryError = String((error as Error)?.message || error);
      const fallbackNote = createSpeechGuidanceNote(
        classification.itemValue || text,
        text,
      );
      nextContext = {
        ...nextContext,
        sessionNotes: [fallbackNote, ...nextContext.sessionNotes].slice(0, 8),
      };
      responseMessage = '已用于本次会议；长期记忆保存失败';
    }
  } else if (classification.scope === 'session_only') {
    const noteText = classification.sessionNote || text;
    const alreadyExists = nextContext.sessionNotes.some(
      (note) => note.text === noteText,
    );
    nextContext = {
      ...nextContext,
      sessionNotes: alreadyExists
        ? nextContext.sessionNotes
        : [
            createSpeechGuidanceNote(noteText, text),
            ...nextContext.sessionNotes,
          ].slice(0, 8),
    };
  } else {
    responseMessage = '这条信息暂时不会影响发言建议';
  }

  const contextUpdated = await registry.updateObservation(tabId, {
    speechGuidanceContext: nextContext,
  });
  if (contextUpdated) {
    await broadcastSessionSnapshot(contextUpdated);
  }
  const refreshed = await refreshSpeechSuggestion(tabId, { force: true });
  return {
    success: true,
    message: responseMessage,
    session: refreshed || contextUpdated,
    scope: classification.scope,
    memorySaved,
    error: memoryError,
  };
}

async function handleSpeechContextClear(
  request: Record<string, any>,
  tabId: number,
): Promise<{
  success: boolean;
  session?: MeetingPilotSessionSnapshot;
}> {
  const session = registry.getSessionByTabId(tabId);
  if (
    !session ||
    (request.meetingId && request.meetingId !== session.meetingId)
  ) {
    return { success: false };
  }
  const noteId = String(request.noteId || '').trim();
  const current = createSpeechGuidanceContext(session.speechGuidanceContext);
  const nextContext: MeetingPilotSpeechGuidanceContext = {
    ...current,
    sessionNotes: noteId
      ? current.sessionNotes.filter((note) => note.id !== noteId)
      : [],
    updatedAt: Date.now(),
  };
  const updated = await registry.updateObservation(tabId, {
    speechGuidanceContext: nextContext,
  });
  if (updated) {
    await broadcastSessionSnapshot(updated);
  }
  const refreshed = await refreshSpeechSuggestion(tabId, { force: true });
  return {
    success: Boolean(refreshed || updated),
    session: refreshed || updated,
  };
}

async function handleCapturedStatusUpdate(
  message: Record<string, any>,
): Promise<void> {
  const tabId = resolveMeetingPilotStatusTabId(Number(message.tabId));
  const capture = message.capture as
    | Partial<MeetingPilotCaptureState>
    | undefined;
  if (!Number.isFinite(tabId) || !capture) return;
  const tierStatus = message.tierStatus as MeetingPilotTierStatus | undefined;
  const updated = tierStatus
    ? await registry.updateSession(tabId, (session) => ({
        ...session,
        capture: {
          ...session.capture,
          ...capture,
        },
        tier: tierStatus,
        status:
          capture.kind === 'recording'
            ? 'recording'
            : capture.kind === 'error'
            ? 'error'
            : session.inMeeting
            ? 'ready'
            : session.status,
      }))
    : await registry.setCaptureState(tabId, capture);
  if (updated) {
    await updateBrowserAction(updated);
    await broadcastSessionSnapshot(updated);
  }
}

function resolveMeetingPilotStatusTabId(rawTabId: number): number {
  if (Number.isFinite(rawTabId) && registry.getSessionByTabId(rawTabId)) {
    return rawTabId;
  }
  const activeRecording = registry
    .listSessions()
    .find((session) => session.capture.kind === 'recording');
  if (activeRecording) {
    return activeRecording.tabId;
  }
  return rawTabId;
}

async function handleTranscriptUpdate(
  message: Record<string, any>,
): Promise<void> {
  const tabId = Number(message.tabId);
  const transcriptChunk = message.transcriptChunk as
    | MeetingPilotSessionSnapshot['transcript'][number]
    | undefined;
  if (!Number.isFinite(tabId) || !transcriptChunk) return;

  const sanitizedText = sanitizeASRTranscriptText(transcriptChunk.text);
  if (!sanitizedText) return;
  const normalizedChunk = {
    ...transcriptChunk,
    text: sanitizedText,
  };

  const session = registry.getSessionByTabId(tabId);
  if (!session) return;

  const envConfig = await getEnvConfig();
  const resolveAlias = createAliasResolverFromEnv(
    envConfig.MEETING_NAME_ALIASES,
  );

  if (normalizedChunk.lowConfidence) {
    const previewResolution = resolveSpeakerForChunk(
      session,
      { ...normalizedChunk, lowConfidence: false },
      { resolveAlias },
    );
    const previewChunk = {
      ...normalizedChunk,
      speaker: previewResolution.resolvedName,
      participantId: previewResolution.participantId,
      resolutionSource: previewResolution.source,
      resolutionConfidence: previewResolution.confidence,
    };
    const updated = await registry.updateSession(tabId, (s) => {
      const transcriptWithoutPreviousPreview = s.transcript.filter(
        (chunk) => chunk.id !== previewChunk.id,
      );
      const transcript = [
        ...transcriptWithoutPreviousPreview,
        previewChunk,
      ].slice(-60);
      return {
        ...s,
        participants: previewResolution.participantsAfter,
        transcript,
        transcriptTurns: buildTranscriptTurns(
          transcript,
          previewResolution.participantsAfter,
        ),
        updatedAt: Date.now(),
      };
    });
    if (updated) await broadcastSessionSnapshot(updated);
    return;
  }

  const resolution = resolveSpeakerForChunk(session, normalizedChunk, {
    resolveAlias,
  });

  let workingParticipants = resolution.participantsAfter;
  if (resolution.newParticipant) {
    // already included via participantsAfter; nothing else to do
  }

  const enrichedChunk = {
    ...normalizedChunk,
    speaker: resolution.resolvedName,
    participantId: resolution.participantId,
    resolutionSource: resolution.source,
    resolutionConfidence: resolution.confidence,
  };
  const nextTranscript = [
    ...session.transcript.filter((chunk) => chunk.id !== enrichedChunk.id),
    enrichedChunk,
  ].slice(-60);

  const configuredHotwords = String(envConfig.MEETING_HOTWORDS || '')
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
  const hotwordTopic = configuredHotwords.find((item) =>
    normalizedChunk.text.toLowerCase().includes(item.toLowerCase()),
  );
  const topicHintMatch = normalizedChunk.text.match(
    /(预算|排期|技术评审|风险|QA|owner|行动项)/i,
  );
  const heuristicTopic =
    hotwordTopic ||
    topicHintMatch?.[1] ||
    normalizedChunk.text.slice(0, 48) ||
    session.currentTopic;
  const nextSummary = nextTranscript
    .slice(-3)
    .map((chunk) => `${chunk.speaker}: ${chunk.text}`)
    .join(' ');
  const analysisTranscript = nextTranscript.filter(
    (chunk) => !chunk.lowConfidence,
  );

  const inferStance = (text: string) => {
    if (/不同意|反对|否决/i.test(text)) return '反对' as const;
    if (/建议|风险|瓶颈|质疑|担心|问题/i.test(text)) return '质疑' as const;
    if (/同意|支持|可以|ok|没问题/i.test(text)) return '支持' as const;
    if (/负责|推进|敲定|确认|主导|我们要/i.test(text)) return '主导' as const;
    return '中立' as const;
  };

  const inferTimeLabel = (ts: number) => {
    const date = new Date(ts);
    return `📍 ${String(date.getHours()).padStart(2, '0')}:${String(
      date.getMinutes(),
    ).padStart(2, '0')}`;
  };

  // Stance accumulation by participantId
  const heuristicParticipants = (() => {
    const totalChunksByParticipantId = nextTranscript.reduce<
      Record<string, number>
    >((acc, chunk) => {
      if (!chunk.participantId) return acc;
      acc[chunk.participantId] = (acc[chunk.participantId] || 0) + 1;
      return acc;
    }, {});
    const totalCount = nextTranscript.length || 1;

    return workingParticipants.map((participant) => {
      const speakingPct = Math.round(
        ((totalChunksByParticipantId[participant.id] || 0) / totalCount) * 100,
      );

      if (
        participant.id !== resolution.participantId ||
        normalizedChunk.lowConfidence
      ) {
        return { ...participant, speakingPct };
      }

      const stanceItem = {
        topic: heuristicTopic || '会议讨论',
        stance: inferStance(normalizedChunk.text),
        keyQuote: normalizedChunk.text,
        timeRange: inferTimeLabel(normalizedChunk.ts),
      };

      const existingStances = participant.stances || [];
      const filtered = existingStances.filter(
        (item) => item.topic !== stanceItem.topic,
      );

      return {
        ...participant,
        speakingPct,
        stances: [stanceItem, ...filtered].slice(0, 5),
      };
    });
  })();

  workingParticipants = heuristicParticipants;

  let llmResult: MeetingPilotStructuredParseResult | undefined;
  try {
    llmResult = await runMeetingAnalysis(
      { ...session, participants: workingParticipants },
      analysisTranscript.length ? analysisTranscript : nextTranscript,
      envConfig,
    );
  } catch (error) {
    console.warn(
      'Meeting Pilot analysis failed, falling back to heuristics:',
      error,
    );
  }
  const nextTopic = llmResult?.topic || heuristicTopic;

  // Apply LLM stance results, mapping LLM-emitted participant strings back to canonical ids.
  let nextParticipants: MeetingPilotParticipant[] = workingParticipants;
  let resolvedStances: MeetingPilotStructuredParseResult['participantStances'] =
    [];

  if (llmResult?.participantStances.length) {
    const stancesByParticipantId = new Map<
      string,
      MeetingPilotParticipantStance[]
    >();
    resolvedStances = llmResult.participantStances.map((item) => {
      const target = resolveParticipantByName(
        workingParticipants,
        item.participant,
      );
      if (target) {
        const list = stancesByParticipantId.get(target.id) || [];
        list.push({
          topic: item.topic,
          stance: item.stance,
          keyQuote: item.keyQuote,
          timeRange: item.timeRange,
        });
        stancesByParticipantId.set(target.id, list);
        return { ...item, participantId: target.id };
      }
      return item;
    });
    nextParticipants = workingParticipants.map((participant) => {
      const llmStances = stancesByParticipantId.get(participant.id);
      if (!llmStances || !llmStances.length) {
        return participant;
      }
      return {
        ...participant,
        stances: llmStances.slice(0, 5),
      };
    });
  }

  // Apply AI auto-merge suggestions (high-confidence only)
  if (llmResult?.participantResolutions?.length) {
    const aiMerge = applyAiParticipantResolutions(
      {
        ...session,
        participants: nextParticipants,
        transcript: nextTranscript,
        transcriptTurns: session.transcriptTurns,
      },
      llmResult.participantResolutions,
    );
    if (aiMerge.changed) {
      nextParticipants = aiMerge.session.participants;
      // mergeParticipants also rewrites transcript/turns; pull updated transcript back
      // (we'll regenerate turns below from the latest transcript).
    }
  }

  // Aggregate turns from latest transcript
  const nextTranscriptForTurns = nextTranscript;
  const nextTranscriptTurns = buildTranscriptTurns(
    nextTranscriptForTurns,
    nextParticipants,
  );

  const structuredData = buildStructuredMeetingData(
    session,
    analysisTranscript.length ? analysisTranscript : session.transcript,
    nextTopic,
    Number(envConfig.MEETING_SCREENSHOT_INTERVAL_SEC) || 18,
  );
  const currentChapterId =
    structuredData.chapters[structuredData.chapters.length - 1]?.id;
  const llmActionItems =
    llmResult?.actionItems.map((item) => ({
      ...item,
      chapterId: item.chapterId || currentChapterId,
    })) || [];
  const llmDecisions =
    llmResult?.decisions.map((item) => ({
      ...item,
      chapterId: item.chapterId || currentChapterId,
    })) || [];
  const mergedTimelineEvents = llmResult
    ? [
        ...structuredData.timelineEvents.filter(
          (event) => event.type === 'screen',
        ),
        ...llmDecisions.map((decision, index) => ({
          id: `timeline-llm-decision-${index}`,
          type: 'decision' as const,
          title: decision.text.slice(0, 48),
          description: decision.text,
          timestamp: decision.timestamp,
          chapterId: decision.chapterId,
        })),
        ...llmActionItems.map((item, index) => ({
          id: `timeline-llm-action-${index}`,
          type: 'action' as const,
          title: item.title.slice(0, 48),
          description: item.evidence
            ? `${item.owner} · ${item.title}\n依据：${item.evidence}`
            : `${item.owner} · ${item.title}`,
          timestamp: item.timestamp || formatTranscriptTimestamp(Date.now()),
          speaker: item.owner,
          chapterId: item.chapterId,
        })),
        ...structuredData.timelineEvents.filter(
          (event) => event.type === 'topic',
        ),
      ].slice(-12)
    : structuredData.timelineEvents;

  const latestStructuredParse: MeetingPilotStructuredParseResult = llmResult
    ? {
        ...llmResult,
        actionItems: llmActionItems,
        decisions: llmDecisions,
        participantStances: resolvedStances,
      }
    : {
        topic: nextTopic,
        summary: nextSummary || session.summary,
        actionItems: structuredData.actionItems,
        decisions: structuredData.decisions,
        alerts: [],
        participantStances: nextParticipants.flatMap((participant) =>
          (participant.stances || []).map((item) => ({
            participant: participant.name,
            participantId: participant.id,
            topic: item.topic,
            stance: item.stance,
            keyQuote: item.keyQuote,
            timeRange: item.timeRange,
          })),
        ),
        latestObservationText:
          session.shareState === 'active'
            ? `${
                session.sharerName || 'Someone'
              } 正在共享屏幕，当前内容聚焦于 ${nextTopic}`
            : `当前会议讨论聚焦于 ${nextTopic}`,
      };
  const nextActionItems = mergeActionItemReviewStates(
    llmActionItems.length ? llmActionItems : structuredData.actionItems,
    session.actionItems,
  );
  latestStructuredParse.actionItems = nextActionItems;

  const updated = await registry.updateObservation(tabId, {
    transcript: nextTranscript,
    transcriptTurns: nextTranscriptTurns,
    currentTopic: nextTopic,
    summary: llmResult?.summary || nextSummary || session.summary,
    participants: nextParticipants,
    chapters: structuredData.chapters,
    timelineEvents: mergedTimelineEvents,
    actionItems: nextActionItems,
    decisions: llmDecisions.length ? llmDecisions : structuredData.decisions,
    timelineProgress: structuredData.timelineProgress,
    latestObservationText: latestStructuredParse.latestObservationText,
    latestStructuredParse,
  });
  if (updated) {
    const generatedAlerts = llmResult?.alerts || [];
    let latestSession = updated;
    for (const alert of generatedAlerts) {
      const existing = latestSession.alerts.find(
        (item) => item.title === alert.title && item.body === alert.body,
      );
      if (!existing) {
        const alertUpdated = await registry.addAlert(tabId, alert);
        if (alertUpdated) {
          latestSession = alertUpdated;
          await updateBrowserAction(alertUpdated);
          await broadcastSessionSnapshot(alertUpdated);
        }
      }
    }
    await broadcastSessionSnapshot(latestSession);
    scheduleMeetingMemoryRefresh(tabId);
    scheduleSpeechSuggestionRefresh(tabId);
  }
}

function enqueueTranscriptUpdate(
  tabId: number,
  message: Record<string, any>,
): Promise<void> {
  const previous = transcriptUpdateQueues.get(tabId) || Promise.resolve();
  const next = previous
    .catch(() => undefined)
    .then(() => handleTranscriptUpdate(message));
  const queued = next.finally(() => {
    if (transcriptUpdateQueues.get(tabId) === queued) {
      transcriptUpdateQueues.delete(tabId);
    }
  });
  transcriptUpdateQueues.set(tabId, queued);
  return next;
}

async function handleRingCentralTranscriptStatus(
  message: Record<string, any>,
): Promise<void> {
  const tabId = Number(message.tabId);
  if (!Number.isFinite(tabId)) return;
  const session = registry.getSessionByTabId(tabId);
  if (!session) return;
  const envConfig = await getEnvConfig();
  const enabled =
    isMeetingRingCentralTranscriptEnabled(envConfig) &&
    message.enabled !== false;
  const active = Boolean(enabled && message.active);
  const available = Boolean(enabled && (message.available || active));
  const lastSeenAt = active
    ? Number(message.lastSeenAt || Date.now())
    : session.webTranscript?.lastSeenAt;
  const webTranscript = {
    enabled,
    available,
    active,
    lastSeenAt,
    latestChunkId:
      typeof message.latestChunkId === 'string'
        ? message.latestChunkId
        : session.webTranscript?.latestChunkId,
    lastError:
      typeof message.lastError === 'string'
        ? message.lastError
        : session.webTranscript?.lastError,
  };
  const tier = active
    ? buildRingCentralTranscriptTierStatus(
        envConfig,
        'RingCentral web transcript detected; audio ASR is bypassed.',
      )
    : session.tier?.activeTier === 'ringcentral_transcript'
      ? {
          activeTier: null,
          badge: 'Probing' as const,
          mode: getMeetingTranscriptionMode(envConfig),
          lastTransitionAt: Date.now(),
          lastTransitionReason:
            'RingCentral web transcript is not currently visible.',
        }
      : session.tier;

  const updated = await registry.updateObservation(tabId, {
    webTranscript,
    tier,
  });
  if (updated) {
    await broadcastSessionSnapshot(updated);
  }
  await pushOffscreenCommand({
    type: 'MEETING_PILOT_OFFSCREEN_SET_WEB_TRANSCRIPT_ACTIVE',
    tabId,
    meetingId: session.meetingId,
    active,
  }).catch(() => undefined);
}

async function handleDigestStatusUpdate(
  message: Record<string, any>,
): Promise<void> {
  const tabId = Number(message.tabId);
  const digest = message.digest as
    | Partial<MeetingPilotSessionSnapshot['digest']>
    | undefined;
  if (!Number.isFinite(tabId) || !digest) return;
  const updated = await registry.updateDigest(tabId, {
    ...digest,
    updatedAt: Date.now(),
  });
  if (updated) {
    let sessionForBroadcast: MeetingPilotSessionSnapshot | undefined = updated;
    if (digest.status === 'processing' && updated.digest.lookupId) {
      scheduleDigestPoll(tabId, 1500);
    }
    if (digest.status === 'failed') {
      clearDigestPoll(tabId);
      if (updated.digest.errorCode === 'missing_minutes_api_base_url') {
        await updateBrowserAction(sessionForBroadcast);
      } else {
        sessionForBroadcast =
          (await registry.setCaptureState(tabId, {
            kind: 'error',
            lastError: updated.digest.message || 'digest_failed',
          })) || updated;
        await updateBrowserAction(sessionForBroadcast);
      }
    }
    if (digest.status === 'completed') {
      clearDigestPoll(tabId);
      sessionForBroadcast =
        (await registry.setCaptureState(tabId, {
          kind: 'completed',
          lastError: undefined,
        })) || updated;
      await updateBrowserAction(sessionForBroadcast);
    }
    await broadcastSessionSnapshot(sessionForBroadcast);
    if (digest.status === 'completed') {
      void archiveMeetingSession(sessionForBroadcast);
    }
  }
}

export function buildMeetingIngestPayloads(
  session: MeetingPilotSessionSnapshot,
) {
  const activeActionItems = getActiveMeetingActionItems(session.actionItems);
  const panoramaUrl = chrome.runtime.getURL(
    `meeting-panorama.html?meetingId=${encodeURIComponent(
      session.meetingId,
    )}&tabId=${session.tabId}`,
  );
  const summaryPayload = {
    content: `## 会议: ${session.title}
日期: ${new Date(session.detectedAt).toISOString()}
参会者: ${session.participants
      .map((participant) => participant.name)
      .join(', ')}

### 摘要
${session.summary}

### 决议
${
  session.decisions.map((decision) => `- ${decision.text}`).join('\n') ||
  '- 暂无'
}

### 行动项
${
  activeActionItems
    .map(
      (item) =>
        `- [${item.owner}] ${item.title}${
          item.deadline ? ` (DDL: ${item.deadline})` : ''
        }`,
    )
    .join('\n') || '- 暂无'
}`,
    sourceType: 'meeting' as const,
    sourceUrl: panoramaUrl,
    sourceTitle: session.title,
    sender: 'meeting-pilot',
    groupId: session.meetingId,
    groupName: session.title,
    timestamp: session.updatedAt,
    metadata: {
      meetingId: session.meetingId,
      digestId: session.digest.lookupId || session.digest.taskId || 'pending',
      digestStatus: session.digest.status,
      digestErrorCode: session.digest.errorCode || null,
      pdfUrl: session.digest.resultUrl || null,
      participants: session.participants.map((participant) => participant.name),
      durationMs:
        session.capture.startedAt && session.capture.stoppedAt
          ? session.capture.stoppedAt - session.capture.startedAt
          : undefined,
      topicCount: session.chapters.length,
      actionItemCount: activeActionItems.length,
      latestObservationText: session.latestObservationText || null,
      summary: session.summary,
      chapters: session.chapters,
      actionItems: activeActionItems,
      allActionItems: session.actionItems,
      decisions: session.decisions,
      timelineEvents: session.timelineEvents,
      participantStances: session.participants.flatMap((participant) =>
        (participant.stances || []).map((stance) => ({
          participant: participant.name,
          topic: stance.topic,
          stance: stance.stance,
          keyQuote: stance.keyQuote,
          timeRange: stance.timeRange,
        })),
      ),
    },
  };

  const chapterPayloads = session.chapters.map((chapter) => ({
    content: `[会议话题] ${chapter.title}
时间: ${chapter.startLabel}

${chapter.summary}`,
    sourceType: 'meeting' as const,
    sourceUrl: panoramaUrl,
    sourceTitle: `${session.title} — ${chapter.title}`,
    sender: 'meeting-pilot',
    groupId: session.meetingId,
    groupName: session.title,
    timestamp: session.updatedAt,
    metadata: {
      meetingId: session.meetingId,
      chapterId: chapter.id,
    },
  }));

  return [summaryPayload, ...chapterPayloads];
}

async function ingestMeetingSession(
  session: MeetingPilotSessionSnapshot,
): Promise<void> {
  try {
    const client = getMemoryServiceClient();
    const payloads = buildMeetingIngestPayloads(session);
    if (payloads.length === 1) {
      await client.ingest(payloads[0]);
      return;
    }
    await client.ingestBatch(payloads);
  } catch (error) {
    console.warn('Meeting Pilot ingest failed:', error);
  }
}

async function archiveMeetingSession(
  session: MeetingPilotSessionSnapshot,
): Promise<void> {
  const archiveSession = await prepareMeetingSessionForArchive(session);
  await ingestMeetingSession(archiveSession);
}

async function refreshMeetingMemory(tabId: number): Promise<void> {
  const session = registry.getSessionByTabId(tabId);
  if (!session) return;

  const envConfig = await getEnvConfig();
  if (!envConfig.MEETING_MEMORY_CONTEXT_ENABLED) {
    return;
  }

  const transcriptSummary = session.transcript
    .slice(-6)
    .map((chunk) => `${chunk.speaker}: ${chunk.text}`)
    .join(' ');
  const screenObservation = String(session.latestObservationText || '').trim();
  const meetingMetadata = [
    `Meeting: ${session.title}`,
    session.participants.length
      ? `Participants: ${session.participants
          .map((participant) => participant.name)
          .join(', ')}`
      : undefined,
  ]
    .filter(Boolean)
    .join(' ');

  // Don't fire recall if there is no meaningful content beyond the meeting
  // title. "RingCentral Video" / generic titles are useless as recall signals
  // and will return noisy or irrelevant matches.
  const hasRealTranscript = transcriptSummary.trim().length > 20;
  const hasRealTopic =
    session.currentTopic.trim() &&
    session.currentTopic.trim().toLowerCase() !==
      session.title.trim().toLowerCase() &&
    session.currentTopic !== 'Live discussion';
  const hasRealSummary = session.summary.trim().length > 20;
  const hasRealScreenObservation = screenObservation.length > 20;
  if (
    !hasRealTranscript &&
    !hasRealTopic &&
    !hasRealSummary &&
    !hasRealScreenObservation
  ) {
    return;
  }

  // Intentionally exclude shareSummary / speakerSummary boilerplate to avoid
  // self-echoing recall noise.
  const requestBody = buildMeetingPilotContextRecallRequest({
    excludeMeetingId: session.meetingId,
    meetingTitle: session.title,
    currentTopic: session.currentTopic,
    summary: session.summary,
    transcriptSummary,
    screenObservation,
    meetingMetadata,
  });

  if (
    !requestBody.primaryText?.trim() &&
    !requestBody.secondaryTexts?.some((part) => part.trim())
  ) {
    return;
  }

  try {
    const client = getMemoryServiceClient();
    const result = await client.contextRecall(requestBody);

    const memoryRefs = result.matches
      .filter((match) => {
        const itemMeetingId = (match as any)?.metadata?.meetingId;
        return !itemMeetingId || itemMeetingId !== session.meetingId;
      })
      .map(contextMatchToMeetingPilotMemoryRef)
      .filter((ref) => ref && (ref.snippet?.trim() || ref.fullSnippet?.trim()));

    const updated = await registry.updateObservation(tabId, { memoryRefs });
    if (updated) {
      await broadcastSessionSnapshot(updated);
      void refreshSpeechSuggestion(tabId).catch((error) => {
        console.warn(
          'Meeting Pilot speech suggestion after recall failed:',
          error,
        );
      });
    }
  } catch (error) {
    console.warn('Meeting Pilot context recall failed:', error);
  }
}

function scheduleMeetingMemoryRefresh(tabId: number): void {
  const existing = memoryRefreshTimers.get(tabId);
  if (existing) {
    clearTimeout(existing);
  }
  void getEnvConfig().then((envConfig) => {
    const delayMs = Math.max(
      1200,
      (Number(envConfig.MEETING_SUMMARY_INTERVAL_SEC) || 45) * 1000,
    );
    const timer = setTimeout(() => {
      memoryRefreshTimers.delete(tabId);
      void refreshMeetingMemory(tabId);
    }, delayMs);
    memoryRefreshTimers.set(tabId, timer as unknown as number);
  });
}

async function handleMeetingPilotMessage(
  request: Record<string, any>,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void,
): Promise<void> {
  const requestTabId = Number(request.tabId);
  const tabId =
    Number.isFinite(requestTabId) && requestTabId > 0
      ? requestTabId
      : sender.tab?.id;

  switch (request.type) {
    case 'MEETING_PILOT_GET_STATE': {
      await ensureInitialized();
      if (typeof tabId === 'number' && Number.isFinite(tabId)) {
        await syncSessionCaptureGateReadiness(tabId);
        refreshSessionReadinessInBackground(tabId);
      } else {
        const activeSession = registry.getActiveSession();
        if (activeSession) {
          await syncSessionCaptureGateReadiness(activeSession.tabId);
          refreshSessionReadinessInBackground(activeSession.tabId);
        }
      }
      sendResponse(buildStateResponse(tabId));
      return;
    }
    case 'MEETING_PILOT_REGISTER_TAB':
    case 'MEETING_PILOT_UPDATE_CONTEXT': {
      await ensureInitialized();
      const payload = request.payload || request;
      const session = await upsertMeetingSession({
        meetingId: payload.meetingId,
        tabId: Number(payload.tabId || tabId || 0),
        url: payload.url,
        title: payload.title || sender.tab?.title || 'RingCentral meeting',
        inMeeting: payload.inMeeting !== false,
        shareState: payload.shareState || 'unknown',
        selfSharing: Boolean(payload.selfSharing),
        micMuted:
          typeof payload.micMuted === 'boolean' ? payload.micMuted : undefined,
        participantCount: payload.participantCount,
        participants: payload.participants,
        selfName: payload.selfName,
        sharerName: payload.sharerName,
        speakerLabel: payload.speakerLabel,
        detectedAt: payload.detectedAt || Date.now(),
      });
      if (
        session.capture.kind === 'recording' &&
        (typeof payload.micMuted === 'boolean' ||
          typeof payload.speakerLabel === 'string' ||
          typeof payload.selfName === 'string')
      ) {
        await pushOffscreenCommand({
          type: 'MEETING_PILOT_OFFSCREEN_UPDATE_CONTEXT',
          tabId: session.tabId,
          micMuted: payload.micMuted,
          selfName: session.selfName,
          speakerLabel: session.speakerLabel,
        }).catch((error) => {
          console.warn(
            '[Meeting Pilot][background] offscreen context sync failed',
            {
              tabId: session.tabId,
              error: String((error as Error)?.message || error),
            },
          );
        });
      }
      await broadcastSessionSnapshot(session);
      scheduleMeetingMemoryRefresh(session.tabId);
      scheduleSpeechSuggestionRefresh(session.tabId, 1600);
      sendResponse(session);
      return;
    }
    case 'MEETING_PILOT_OPEN_SIDE_PANEL': {
      await ensureInitialized();
      const resolvedTabId = Number(request.tabId || tabId || 0);
      const session = registry.getSessionByTabId(resolvedTabId);
      if (session) {
        await pushSessionSnapshotToMeetingTab(session);
      }
      const surface = await openMeetingSidePanel(
        resolvedTabId,
        typeof request.source === 'string' ? request.source : undefined,
        request.preferSurface === 'side-panel' ||
          request.preferSurface === 'embedded'
          ? { preferSurface: request.preferSurface }
          : undefined,
      );
      sendResponse({ success: true, surface });
      return;
    }
    case 'MEETING_PILOT_CLOSE_SIDE_PANEL': {
      await ensureInitialized();
      const resolvedTabId = Number(request.tabId || tabId || 0);
      await closeMeetingEmbeddedPanel(resolvedTabId);
      await configureTabSidePanel(resolvedTabId, false);
      sendResponse({ success: true });
      return;
    }
    case 'MEETING_PILOT_SET_SIDE_PANEL_PIN': {
      await ensureInitialized();
      const resolvedTabId = Number(request.tabId || tabId || 0);
      const pinned = Boolean(request.pinned);
      const current = registry.getSessionByTabId(resolvedTabId);
      if (
        !current ||
        (request.meetingId && String(request.meetingId) !== current.meetingId)
      ) {
        sendResponse({ success: false });
        return;
      }
      const updated = await registry.updateSession(
        resolvedTabId,
        (session) => ({
          ...session,
          sidePanelPinned: pinned,
        }),
      );
      if (updated) {
        await broadcastSessionSnapshot(updated);
        await pushSessionSnapshotToMeetingTab(updated);
      }
      let surface: 'side-panel' | 'window' | 'unavailable' | undefined;
      if (updated && pinned && !request.skipOpen) {
        surface = await openMeetingChromeSidePanel(
          resolvedTabId,
          typeof request.source === 'string' ? request.source : undefined,
          { fallbackToWindow: false },
        );
      }
      sendResponse({ success: Boolean(updated), session: updated, surface });
      return;
    }
    case 'MEETING_PILOT_SHOW_CAPTURE_AUTH_GUIDE': {
      await ensureInitialized();
      const resolvedTabId = Number(request.tabId || tabId || 0);
      const success = await showCaptureAuthGuide(resolvedTabId);
      sendResponse({ success });
      return;
    }
    case 'MEETING_PILOT_ENABLE_CAPTURE_AND_OPEN_PANEL': {
      await ensureInitialized();
      const resolvedTabId = Number(request.tabId || tabId || 0);
      await ensureMeetingSessionForCapture({
        tabId: resolvedTabId,
        meetingId: String(
          request.meetingId || request.payload?.meetingId || '',
        ),
        url: String(request.url || request.payload?.url || ''),
        title: String(request.title || request.payload?.title || ''),
        sender,
      });
      const captureResult = await startMeetingCapture(
        resolvedTabId,
        String(request.meetingId || request.payload?.meetingId || ''),
        String(request.streamId || request.payload?.streamId || ''),
      );
      const result = captureResult.session;
      let surface:
        | 'embedded'
        | 'side-panel'
        | 'window'
        | 'unavailable'
        | undefined;
      let panelError: string | undefined;
      if (isCaptureActiveForUi(result)) {
        await pushSessionSnapshotToMeetingTab(result);
        try {
          surface = await openMeetingSidePanel(
            resolvedTabId,
            typeof request.source === 'string' ? request.source : 'overlay',
          );
        } catch (error) {
          panelError = String(
            (error as Error)?.message || error || 'meeting_panel_open_failed',
          );
        }
      }
      sendResponse({
        success: isCaptureActiveForUi(result),
        session: result,
        activeRecording: captureResult.activeRecording,
        panelError,
        surface,
      });
      return;
    }
    case 'MEETING_PILOT_OPEN_LIVE_MAP': {
      await ensureInitialized();
      await openMeetingLiveMap(Number(request.tabId || tabId || 0));
      sendResponse({ success: true });
      return;
    }
    case 'MEETING_PILOT_START_CAPTURE': {
      await ensureInitialized();
      const resolvedTabId = Number(request.tabId || tabId || 0);
      await ensureMeetingSessionForCapture({
        tabId: resolvedTabId,
        meetingId: String(
          request.meetingId || request.payload?.meetingId || '',
        ),
        url: String(request.url || request.payload?.url || ''),
        title: String(request.title || request.payload?.title || ''),
        sender,
      });
      const captureResult = await startMeetingCapture(
        resolvedTabId,
        String(request.meetingId || request.payload?.meetingId || ''),
        String(request.streamId || request.payload?.streamId || ''),
      );
      sendResponse({
        success: isCaptureActiveForUi(captureResult.session),
        session: captureResult.session,
        activeRecording: captureResult.activeRecording,
      });
      return;
    }
    case 'MEETING_PILOT_STOP_CAPTURE': {
      await ensureInitialized();
      const result = await stopMeetingCapture(
        Number(request.tabId || tabId || 0),
        String(request.meetingId || request.payload?.meetingId || ''),
      );
      sendResponse({ success: Boolean(result), session: result });
      return;
    }
    case 'MEETING_PILOT_UPDATE_ALERTS': {
      await ensureInitialized();
      const alert = request.alert as MeetingPilotAlert;
      if (alert && Number.isFinite(tabId)) {
        const session = await registry.addAlert(tabId, alert);
        if (session) {
          await updateBrowserAction(session);
          await broadcastSessionSnapshot(session);
        }
        sendResponse({ success: true, session });
      } else {
        sendResponse({ success: false });
      }
      return;
    }
    case 'MEETING_PILOT_UPDATE_ACTION_ITEM': {
      await ensureInitialized();
      const actionTabId = Number(request.tabId || tabId || 0);
      const actionItemId = String(request.actionItemId || '');
      const status =
        request.status === 'done'
          ? 'done'
          : request.status === 'pending'
          ? 'pending'
          : undefined;
      const reviewState = normalizeActionItemReviewState(request.reviewState);
      const titleProvided = hasOwnRequestField(request, 'title');
      const ownerProvided = hasOwnRequestField(request, 'owner');
      const deadlineProvided = hasOwnRequestField(request, 'deadline');
      const nextTitle = titleProvided
        ? sanitizeActionTextEdit(request.title, 160)
        : undefined;
      const nextOwner = ownerProvided
        ? sanitizeActionTextEdit(request.owner, 80)
        : undefined;
      const nextDeadline = deadlineProvided
        ? sanitizeActionTextEdit(request.deadline, 80)
        : undefined;
      if ((titleProvided && !nextTitle) || (ownerProvided && !nextOwner)) {
        sendResponse({
          success: false,
          message: '行动项标题和负责人不能为空。',
        });
        return;
      }
      const hasContentEdit = titleProvided || ownerProvided || deadlineProvided;
      if (!Number.isFinite(actionTabId) || !actionItemId) {
        sendResponse({ success: false });
        return;
      }
      const reviewedAt = Date.now();
      const updated = await registry.updateSession(actionTabId, (session) => {
        let changed = false;
        const actionItems = session.actionItems.map((item) => {
          if (item.id !== actionItemId) {
            return item;
          }
          changed = true;
          const firstContentEdit = hasContentEdit && !item.editedAt;
          return {
            ...item,
            title: nextTitle || item.title,
            owner: nextOwner || item.owner,
            deadline: deadlineProvided
              ? nextDeadline || undefined
              : item.deadline,
            status: status || item.status,
            reviewState:
              reviewState ||
              (hasContentEdit ? 'confirmed' : item.reviewState) ||
              'suggested',
            reviewedAt,
            editedAt: hasContentEdit ? reviewedAt : item.editedAt,
            generatedTitle:
              firstContentEdit && !item.generatedTitle
                ? item.title
                : item.generatedTitle,
            generatedOwner:
              firstContentEdit && !item.generatedOwner
                ? item.owner
                : item.generatedOwner,
            generatedDeadline:
              firstContentEdit && item.generatedDeadline === undefined
                ? item.deadline || ''
                : item.generatedDeadline,
          };
        });
        if (!changed) {
          return session;
        }
        return {
          ...session,
          actionItems,
          latestStructuredParse: session.latestStructuredParse
            ? {
                ...session.latestStructuredParse,
                actionItems,
              }
            : session.latestStructuredParse,
        };
      });
      if (updated) {
        await broadcastSessionSnapshot(updated);
        await pushSessionSnapshotToMeetingTab(updated);
      }
      sendResponse({ success: Boolean(updated), session: updated });
      return;
    }
    case 'MEETING_PILOT_OBSERVATION_UPDATE': {
      await ensureInitialized();
      const observationText = String(request.observationText || '').trim();
      if (!observationText || !Number.isFinite(tabId)) {
        sendResponse({ success: false });
        return;
      }
      const current = registry.getSessionByTabId(Number(tabId));
      const session = await registry.updateObservation(Number(tabId), {
        latestObservationText: observationText,
        latestStructuredParse: current?.latestStructuredParse
          ? {
              ...current.latestStructuredParse,
              latestObservationText: observationText,
            }
          : current?.latestStructuredParse,
      });
      if (session) {
        await broadcastSessionSnapshot(session);
        scheduleMeetingMemoryRefresh(Number(tabId));
        scheduleSpeechSuggestionRefresh(Number(tabId));
      }
      sendResponse({ success: Boolean(session), session });
      return;
    }
    case 'MEETING_PILOT_TRANSCRIPT_UPDATE': {
      await ensureInitialized();
      const transcriptTabId = Number(request.tabId || tabId || 0);
      await enqueueTranscriptUpdate(transcriptTabId, {
        ...request,
        tabId: transcriptTabId,
      });
      sendResponse({ success: true });
      return;
    }
    case 'MEETING_PILOT_RINGCENTRAL_TRANSCRIPT_STATUS': {
      await ensureInitialized();
      const transcriptTabId = Number(request.tabId || tabId || 0);
      await handleRingCentralTranscriptStatus({
        ...request,
        tabId: transcriptTabId,
      });
      sendResponse({ success: true });
      return;
    }
    case 'MEETING_PILOT_UPSERT_SPEECH_CONTEXT': {
      await ensureInitialized();
      const speechTabId = resolveSpeechActionTabId(
        Number(request.tabId || tabId || 0),
      );
      const result = await handleSpeechContextUpsert(request, speechTabId);
      sendResponse(result);
      return;
    }
    case 'MEETING_PILOT_CLEAR_SPEECH_CONTEXT_NOTE': {
      await ensureInitialized();
      const speechTabId = resolveSpeechActionTabId(
        Number(request.tabId || tabId || 0),
      );
      const result = await handleSpeechContextClear(request, speechTabId);
      sendResponse(result);
      return;
    }
    case 'MEETING_PILOT_REFRESH_SPEECH_SUGGESTION': {
      await ensureInitialized();
      const speechTabId = resolveSpeechActionTabId(
        Number(request.tabId || tabId || 0),
      );
      const session = await refreshSpeechSuggestion(speechTabId, {
        force: true,
      });
      sendResponse({ success: Boolean(session), session });
      return;
    }
    case 'MEETING_PILOT_TIER_STATUS_UPDATE': {
      await ensureInitialized();
      const tierTabId = resolveMeetingPilotStatusTabId(
        Number(request.tabId || tabId || 0),
      );
      const tierStatus = request.tierStatus;
      if (tierTabId && tierStatus) {
        const updated = await registry.updateSession(tierTabId, (s) => ({
          ...s,
          tier: tierStatus,
          updatedAt: Date.now(),
        }));
        if (updated) await broadcastSessionSnapshot(updated);
      } else {
        console.warn('[Meeting Pilot][background] tier status dropped', {
          tabId: request.tabId,
          senderTabId: tabId,
          hasTierStatus: Boolean(tierStatus),
        });
      }
      sendResponse({ success: true });
      return;
    }
    case 'WHISPER_NM_REQUEST': {
      const { method = 'GET', path = '/whisper/status', body } = request;
      try {
        const data = await sendWhisperBridgeRequest<unknown>({
          method,
          path,
          body:
            body && typeof body === 'object'
              ? (body as Record<string, unknown>)
              : undefined,
        });
        sendResponse(data);
      } catch (e) {
        sendResponse({ ok: false, error: String((e as Error)?.message || e) });
      }
      return;
    }
    case 'MEETING_PILOT_CAPTURE_STATUS': {
      await handleCapturedStatusUpdate(request);
      sendResponse({ success: true });
      return;
    }
    case 'MEETING_PILOT_DIGEST_STATUS': {
      await handleDigestStatusUpdate(request);
      sendResponse({ success: true });
      return;
    }
    case 'MEETING_PILOT_TEST_INJECT_CAPTURE_CHUNK': {
      await ensureOffscreenDocument();
      await pushOffscreenCommand({
        type: 'MEETING_PILOT_OFFSCREEN_INJECT_CHUNK',
        text: String(request.text || 'fixture chunk'),
      });
      sendResponse({ success: true });
      return;
    }
    case 'MEETING_PILOT_TEST_BOOTSTRAP_CAPTURE': {
      await ensureOffscreenDocument();
      await pushOffscreenCommand({
        type: 'MEETING_PILOT_OFFSCREEN_BOOTSTRAP_CAPTURE',
        meetingId: String(request.meetingId || ''),
        tabId: Number(request.tabId || tabId || 0),
        title: String(request.title || ''),
      });
      const updated = await registry.setCaptureState(
        Number(request.tabId || tabId || 0),
        {
          kind: 'recording',
          startedAt: Date.now(),
        },
      );
      if (updated) {
        await broadcastSessionSnapshot(updated);
      }
      sendResponse({ success: true, session: updated });
      return;
    }
    case 'MEETING_PILOT_TEST_SET_API_MOCK': {
      testUseMockCapture = Boolean(request.enabled);
      await ensureOffscreenDocument();
      await pushOffscreenCommand({
        type: 'MEETING_PILOT_OFFSCREEN_SET_TEST_API_MOCK',
        enabled: Boolean(request.enabled),
      });
      sendResponse({ success: true });
      return;
    }
    case 'MEETING_PILOT_TEST_SET_SIDE_PANEL_FAILURE': {
      testForceSidePanelOpenFailure = Boolean(request.enabled);
      sendResponse({ success: true, enabled: testForceSidePanelOpenFailure });
      return;
    }
    case 'MEETING_PILOT_TEST_GET_API_LOG': {
      await ensureOffscreenDocument();
      const response = await chrome.runtime.sendMessage({
        type: 'MEETING_PILOT_OFFSCREEN_GET_TEST_API_LOG',
      });
      sendResponse(response);
      return;
    }
    case 'MEETING_PILOT_GET_CAPTURE_LOG': {
      await ensureOffscreenDocument();
      const response = await chrome.runtime.sendMessage({
        type: 'MEETING_PILOT_OFFSCREEN_GET_CAPTURE_LOG',
      });
      sendResponse(response);
      return;
    }
    case 'MEETING_PILOT_RENAME_PARTICIPANT': {
      await ensureInitialized();
      const renameTabId = Number(request.tabId || tabId || 0);
      const participantId = String(request.participantId || '');
      const newName = String(request.newName || '');
      if (!Number.isFinite(renameTabId) || !participantId || !newName) {
        sendResponse({ success: false });
        return;
      }
      const session = registry.getSessionByTabId(renameTabId);
      if (!session) {
        sendResponse({ success: false });
        return;
      }
      const result = renameParticipant(session, participantId, newName, {
        allowMerge: true,
      });
      if (!result.changed) {
        sendResponse({ success: false });
        return;
      }
      const updated = await registry.updateObservation(renameTabId, {
        participants: result.session.participants,
        transcript: result.session.transcript,
        transcriptTurns: result.session.transcriptTurns,
      });
      if (updated) {
        await broadcastSessionSnapshot(updated);
      }
      sendResponse({
        success: true,
        merged: result.merged,
        session: updated,
      });
      return;
    }
    case 'MEETING_PILOT_MERGE_PARTICIPANTS': {
      await ensureInitialized();
      const mergeTabId = Number(request.tabId || tabId || 0);
      const fromId = String(request.fromId || '');
      const toId = String(request.toId || '');
      if (!Number.isFinite(mergeTabId) || !fromId || !toId) {
        sendResponse({ success: false });
        return;
      }
      const session = registry.getSessionByTabId(mergeTabId);
      if (!session) {
        sendResponse({ success: false });
        return;
      }
      const result = mergeParticipants(session, fromId, toId);
      if (!result.changed) {
        sendResponse({ success: false });
        return;
      }
      const updated = await registry.updateObservation(mergeTabId, {
        participants: result.session.participants,
        transcript: result.session.transcript,
        transcriptTurns: result.session.transcriptTurns,
      });
      if (updated) {
        await broadcastSessionSnapshot(updated);
      }
      sendResponse({ success: true, session: updated });
      return;
    }
    case 'MEETING_PILOT_FOCUS_PARTICIPANT': {
      await ensureInitialized();
      const focusTabId = Number(request.tabId || tabId || 0);
      const participantId = String(request.participantId || '');
      if (!Number.isFinite(focusTabId) || !participantId) {
        sendResponse({ success: false });
        return;
      }
      try {
        await chrome.tabs.sendMessage(focusTabId, {
          type: 'MEETING_PILOT_FOCUS_PARTICIPANT',
          participantId,
        });
        sendResponse({ success: true });
      } catch (error) {
        sendResponse({ success: false, error: String(error) });
      }
      return;
    }
    default:
      return;
  }
}

function handleTabUpdate(
  tabId: number,
  changeInfo: chrome.tabs.TabChangeInfo,
  tab: chrome.tabs.Tab,
): void {
  const url = changeInfo.url || tab.url;
  if (!url) return;
  const meetingId = extractMeetingIdFromUrl(url);
  if (!meetingId) {
    const current = registry.getSessionByTabId(tabId);
    if (current && current.inMeeting) {
      void finalizeMeetingTabSession(tabId, 'tab-left-meeting-url').catch(
        (error) => {
          console.warn(
            '[Meeting Pilot][background] tab update finalize failed',
            {
              tabId,
              error: String((error as Error)?.message || error),
            },
          );
        },
      );
    }
    return;
  }

  void upsertMeetingSession({
    meetingId,
    tabId,
    url,
    title: tab.title || currentTitleHint(tab) || 'RingCentral meeting',
    inMeeting: true,
    shareState: inferShareStateFromTab(tab),
    selfSharing: inferSelfSharingFromTab(tab),
    sharerName: inferSharerNameFromTab(tab),
    speakerLabel: inferSpeakerLabelFromTab(tab),
  });
}

function currentTitleHint(tab: chrome.tabs.Tab): string {
  return tab.title || 'RingCentral meeting';
}

function inferShareStateFromTab(
  tab: chrome.tabs.Tab,
): 'none' | 'active' | 'minimized' | 'unknown' {
  const title = tab.title || '';
  if (/screen share/i.test(title)) return 'active';
  return 'unknown';
}

function inferSelfSharingFromTab(tab: chrome.tabs.Tab): boolean {
  return Boolean(tab.title && /\(You\)/i.test(tab.title));
}

function inferSharerNameFromTab(tab: chrome.tabs.Tab): string | undefined {
  const title = tab.title || '';
  const match = title.match(/(.+?)\s+is sharing/i);
  return match?.[1]?.trim();
}

function inferSpeakerLabelFromTab(tab: chrome.tabs.Tab): string | undefined {
  return tab.title?.includes('speaking') ? tab.title : undefined;
}

let meetingPilotMessageListenerRegistered = false;

function registerMeetingPilotMessageListener(): void {
  if (meetingPilotMessageListenerRegistered) {
    return;
  }
  meetingPilotMessageListenerRegistered = true;

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (
      typeof request?.type !== 'string' ||
      !handledMeetingPilotTypes.has(request.type)
    ) {
      return false;
    }
    void handleMeetingPilotMessage(
      request as Record<string, any>,
      sender,
      sendResponse,
    ).catch((error) => {
      console.warn('[Meeting Pilot][background] message handler failed', {
        type: request.type,
        error: String((error as Error)?.message || error),
      });
      try {
        sendResponse({
          ok: false,
          success: false,
          error: String((error as Error)?.message || error),
        });
      } catch {
        // The sender may already be gone.
      }
    });
    return true;
  });
}

export async function initMeetingPilotBackgroundRuntime(): Promise<void> {
  registerMeetingPilotMessageListener();
  await ensureInitialized();

  chrome.tabs.onUpdated.addListener(handleTabUpdate);
  chrome.tabs.onRemoved.addListener((tabId) => {
    void finalizeMeetingTabSession(tabId, 'tab-removed').catch((error) => {
      console.warn('[Meeting Pilot][background] tab removal finalize failed', {
        tabId,
        error: String((error as Error)?.message || error),
      });
    });
  });

  chrome.runtime.onInstalled.addListener(() => {
    void scanOpenMeetingTabs();
  });

  chrome.runtime.onStartup.addListener(() => {
    void scanOpenMeetingTabs();
  });
}
