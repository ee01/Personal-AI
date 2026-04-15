import {
  MEETING_PILOT_HOST_PREFIX,
  MEETING_PILOT_LIVE_MAP_PATH,
  MEETING_PILOT_OFFSCREEN_PATH,
  MEETING_PILOT_SIDE_PANEL_PATH,
  MeetingPilotAlert,
  MeetingPilotCaptureState,
  MeetingPilotDetectionPayload,
  MeetingPilotDecisionItem,
  MeetingPilotParticipantStance,
  MeetingPilotSessionSnapshot,
  MeetingPilotDependencyReadiness,
  MeetingPilotReadinessState,
  MeetingPilotStructuredParseResult,
  MeetingPilotStateResponse,
  buildMeetingPilotBadgeText,
  buildMeetingPilotTooltip,
  createMeetingPilotSessionSnapshot,
  extractMeetingIdFromUrl,
} from './protocol';
import { MeetingPilotRegistry } from './store';
import {
  getMemoryServiceClient,
  MemoryServiceError,
} from '../services/MemoryServiceClient';
import { getEnvConfig } from '../utils';
import {
  buildMeetingPilotRecallOptions,
  recallItemToMeetingPilotMemoryRef,
} from './memoryPresentation';

const registry = new MeetingPilotRegistry();
let initPromise: Promise<void> | null = null;
let offscreenReady = false;
const memoryRefreshTimers = new Map<number, number>();
const digestPollTimers = new Map<number, number>();
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
  whisper: MeetingPilotDependencyReadiness;
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
    args.whisper,
    args.analysisModel,
    args.memoryService,
  ]
    .filter((item) => item.status !== 'ready')
    .map((item) => item.message);
  const checkedAt = Math.max(
    args.minutesApi.checkedAt,
    args.whisper.checkedAt,
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
      whisper: args.whisper,
      analysisModel: args.analysisModel,
      memoryService: args.memoryService,
    },
  };
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
  return `${trimTrailingSlash(baseUrl)}${path.startsWith('/') ? path : `/${path}`}`;
}

function shouldRetryLegacyMeetingRecall(error: unknown): boolean {
  if (!(error instanceof MemoryServiceError) || error.status !== 400) {
    return false;
  }

  const bodyText =
    typeof error.body === 'string'
      ? error.body
      : JSON.stringify(error.body || {});
  const message = `${error.message} ${bodyText}`.toLowerCase();

  return (
    message.includes('presentationhint') ||
    message.includes('previewmaxlength') ||
    (message.includes('additional properties') &&
      (message.includes('presentation') || message.includes('preview')))
  );
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

async function probeProviderModels(
  envConfig: Awaited<ReturnType<typeof getEnvConfig>>,
): Promise<{
  reachable: boolean;
  models: Set<string> | null;
}> {
  const baseUrl = trimTrailingSlash(
    String(envConfig.MEETING_PROVIDER_BASE_URL || ''),
  );
  const apiKey = String(envConfig.MEETING_PROVIDER_API_KEY || '').trim();
  if (!baseUrl || !apiKey) {
    return { reachable: false, models: null };
  }

  try {
    const response = await fetch(joinUrl(baseUrl, '/v1/models'), {
      method: 'GET',
      signal: withTimeoutSignal(6000),
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });
    if (!response.ok) {
      return { reachable: false, models: null };
    }
    const payload = await response.json();
    const models = Array.isArray(payload?.data)
      ? new Set(
          payload.data
            .map((item: { id?: string }) => String(item?.id || '').trim())
            .filter(Boolean),
        )
      : null;
    return { reachable: true, models };
  } catch {
    return { reachable: false, models: null };
  }
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
      ? await probeProviderModels(envConfig)
      : { reachable: false, models: null as Set<string> | null };
    const whisperModel = String(
      envConfig.MEETING_TRANSCRIBE_MODEL || 'whisper-1',
    ).trim();
    const analysisModel = String(envConfig.MEETING_ANALYSIS_MODEL || '').trim();

    const whisper = !providerConfigured
      ? createDependencyReadiness(
          'degraded',
          'Whisper is unavailable because the provider or API key is missing.',
          checkedAt,
        )
      : !providerProbe.reachable
        ? createDependencyReadiness(
            'degraded',
            'Whisper is degraded because the provider could not be reached.',
            checkedAt,
          )
        : providerProbe.models &&
            whisperModel &&
            !providerProbe.models.has(whisperModel)
          ? createDependencyReadiness(
              'degraded',
              `Whisper model ${whisperModel} is not exposed by the provider.`,
              checkedAt,
            )
          : createDependencyReadiness(
              'ready',
              'Whisper transcription is available.',
              checkedAt,
            );

    const analysis = !providerConfigured
      ? createDependencyReadiness(
          'degraded',
          'Analysis model is unavailable because the provider or API key is missing.',
          checkedAt,
        )
      : !analysisModel
        ? createDependencyReadiness(
            'degraded',
            'Analysis model is not configured.',
            checkedAt,
          )
        : !providerProbe.reachable
          ? createDependencyReadiness(
              'degraded',
              'Analysis model is degraded because the provider could not be reached.',
              checkedAt,
            )
          : providerProbe.models && !providerProbe.models.has(analysisModel)
            ? createDependencyReadiness(
                'degraded',
                `Analysis model ${analysisModel} is not exposed by the provider.`,
                checkedAt,
              )
            : createDependencyReadiness(
                'ready',
                'Analysis model is available.',
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
      whisper,
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
        void ingestMeetingSession(next);
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
      message: `Digest polling retrying: ${String((error as Error)?.message || error || 'unknown_error')}`,
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
  const baseUrl = String(envConfig.MEETING_PROVIDER_BASE_URL || '').replace(
    /\/$/,
    '',
  );
  const apiKey = String(envConfig.MEETING_PROVIDER_API_KEY || '').trim();
  const model = String(envConfig.MEETING_ANALYSIS_MODEL || '').trim();
  if (!baseUrl || !apiKey || !model || transcript.length < 2) {
    return undefined;
  }

  const transcriptWindow = transcript
    .slice(-12)
    .map(
      (chunk) =>
        `[${formatTranscriptTimestamp(chunk.ts)}] ${chunk.speaker}: ${chunk.text}`,
    )
    .join('\n');
  const participantList = session.participants
    .map((item) => item.name)
    .join(', ');
  const prompt = `You are analyzing an ongoing RingCentral meeting. Return strict JSON only with this shape:
{
  "topic": string,
  "summary": string,
  "actionItems": [{"title": string, "owner": string, "deadline": string, "status": "pending"|"done"}],
  "decisions": [{"text": string, "timestamp": string}],
  "alerts": [{"level": "P0"|"P1"|"P2", "title": string, "body": string, "source": "mention"|"memory"|"share"|"summary"|"action"}],
  "participantStances": [{"participant": string, "topic": string, "stance": "主导"|"支持"|"中立"|"质疑"|"反对", "keyQuote": string, "timeRange": string}],
  "latestObservationText": string
}

Requirements:
- Infer topic, summary, action items, decisions, alerts, and participant stances from the transcript.
- Use tone in the transcript when deciding stance (supportive, doubtful, strong objection, etc.).
- latestObservationText should be a concise OCR/observation-style text summary of the currently shared content or meeting focus.
- Prefer concrete owners and deadlines when present; otherwise use empty string.
- Keep alerts high precision and useful.

Meeting title: ${session.title}
Current topic hint: ${session.currentTopic}
Participants: ${participantList || 'Unknown'}
Share state: ${session.shareState}
Sharer: ${session.sharerName || 'Unknown'}
Transcript:\n${transcriptWindow}`;

  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You extract structured meeting intelligence. Output valid JSON only.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
    }),
  });
  const payload = await response.json();
  const content = String(payload?.choices?.[0]?.message?.content || '').trim();
  if (!response.ok || !content) {
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
    latestObservationText:
      parsed.latestObservationText?.trim() ||
      `${session.sharerName || '会议参与者'} 正在共享屏幕，当前讨论聚焦：${parsed.topic?.trim() || session.currentTopic}`,
  };
}

function inferActionItemFromText(
  text: string,
  speaker: string,
  chapterId: string,
  index: number,
) {
  if (!/负责|跟进|action|todo|ddl|截止|下周|owner/i.test(text))
    return undefined;
  const ownerMatch = text.match(
    /(?:让|由|owner[:：]?|负责)\s*([A-Za-z\u4e00-\u9fa5 ]{2,30})/i,
  );
  const deadlineMatch = text.match(/(\d{2}[-/]\d{2}|下周[一二三四五六日天]?)/);
  return {
    id: `action-${index}`,
    title: text.slice(0, 72),
    owner: (ownerMatch?.[1] || speaker || 'Unknown').trim(),
    deadline: deadlineMatch?.[1],
    status: 'pending' as const,
    chapterId,
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
  const chapterId = `chapter-${chapterTitle.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/gi, '-') || 'current'}`;
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
      description: `${session.sharerName || 'Someone'} 正在共享屏幕，已记录最新观察。`,
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
      inferActionItemFromText(chunk.text, chunk.speaker, chapterId, index),
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
  'MEETING_PILOT_ENABLE_CAPTURE_AND_OPEN_PANEL',
  'MEETING_PILOT_OPEN_LIVE_MAP',
  'MEETING_PILOT_START_CAPTURE',
  'MEETING_PILOT_STOP_CAPTURE',
  'MEETING_PILOT_UPDATE_ALERTS',
  'MEETING_PILOT_OBSERVATION_UPDATE',
  'MEETING_PILOT_TRANSCRIPT_UPDATE',
  'MEETING_PILOT_CAPTURE_STATUS',
  'MEETING_PILOT_DIGEST_STATUS',
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
  options?: { catchup?: boolean; debug?: boolean },
): string {
  const params = new URLSearchParams({ tabId: String(tabId) });
  if (options?.catchup) {
    params.set('catchup', '1');
  }
  if (options?.debug) {
    params.set('debug', '1');
  }
  return `${MEETING_PILOT_SIDE_PANEL_PATH}?${params.toString()}`;
}

async function configureTabSidePanel(
  tabId: number,
  enabled: boolean,
  options?: { catchup?: boolean },
): Promise<void> {
  if (!chrome.sidePanel?.setOptions) return;
  await chrome.sidePanel.setOptions({
    tabId,
    enabled,
    path: buildMeetingSidePanelPath(tabId, options),
  });
}

async function updateBrowserAction(
  session: MeetingPilotSessionSnapshot,
): Promise<void> {
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
  const hydrated = (await syncSessionReadiness(session.tabId)) || session;
  await configureTabSidePanel(hydrated.tabId, true);
  await updateBrowserAction(hydrated);
  await broadcastSessionSnapshot(hydrated);
  return hydrated;
}

async function endMeetingSession(
  tabId: number,
): Promise<MeetingPilotSessionSnapshot | undefined> {
  const session = await registry.removeByTabId(tabId);
  await configureTabSidePanel(tabId, false);
  await clearBrowserAction(tabId);
  if (session) await broadcastSessionSnapshot(session);
  return session;
}

function shouldStopCaptureForLifecycle(
  session?: MeetingPilotSessionSnapshot,
): boolean {
  return Boolean(session && session.capture.kind === 'recording');
}

async function finalizeMeetingTabSession(
  tabId: number,
): Promise<MeetingPilotSessionSnapshot | undefined> {
  const session = registry.getSessionByTabId(tabId);
  if (!session) return undefined;
  clearDigestPoll(tabId);
  if (shouldStopCaptureForLifecycle(session)) {
    await stopMeetingCapture(tabId, session.meetingId);
  }
  return endMeetingSession(tabId);
}

async function startMeetingCapture(
  tabId: number,
  meetingId: string,
): Promise<MeetingPilotSessionSnapshot | undefined> {
  await ensureInitialized();
  const session = await syncSessionReadiness(tabId, true);
  if (!session || session.meetingId !== meetingId) return undefined;
  if (!session.readiness.canStartCapture) {
    await broadcastSessionSnapshot(session);
    return session;
  }

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
  const streamId = await getMediaStreamId(tabId);

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
      return updated;
    }
    const updated = await registry.setCaptureState(tabId, {
      kind: 'error',
      lastError: 'tabCapture_stream_unavailable',
      startedAt: Date.now(),
    });
    if (updated) {
      await updateBrowserAction(updated);
      await broadcastSessionSnapshot(updated);
    }
    return updated;
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
    return updated;
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
  return updated;
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
): Promise<MeetingPilotSessionSnapshot | undefined> {
  await ensureInitialized();
  const session = registry.getSessionByTabId(tabId);
  if (!session || session.meetingId !== meetingId) return undefined;

  try {
    await pushOffscreenCommand({
      type: 'MEETING_PILOT_OFFSCREEN_STOP_CAPTURE',
      tabId,
      meetingId,
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
    void ingestMeetingSession(updated);
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
    url: chrome.runtime.getURL(buildMeetingSidePanelPath(tabId, options)),
    type: 'popup',
    width: 1280,
    height: 920,
    focused: true,
  });
}

async function openMeetingEmbeddedPanel(
  tabId: number,
  source?: string,
): Promise<boolean> {
  try {
    const response = await chrome.tabs.sendMessage(tabId, {
      type: 'MEETING_PILOT_OPEN_EMBEDDED_PANEL',
      tabId,
      source,
    });
    return Boolean(response?.success);
  } catch {
    return false;
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

async function openMeetingSidePanel(
  tabId: number,
  source?: string,
): Promise<'embedded' | 'side-panel' | 'window'> {
  const shouldOpenCatchup = source === 'overlay-catchup';
  const shouldOpenDebug = source === 'overlay' || source === 'overlay-catchup';
  await configureTabSidePanel(tabId, true, {
    catchup: shouldOpenCatchup,
    debug: shouldOpenDebug,
  });

  if (await openMeetingEmbeddedPanel(tabId, source)) {
    return 'embedded';
  }

  if (chrome.sidePanel?.open) {
    try {
      if (testForceSidePanelOpenFailure) {
        throw new Error('sidepanel_user_gesture_required');
      }
      await chrome.sidePanel.open({ tabId });
      return 'side-panel';
    } catch {
      // Fall back to a popup window when side panel open is rejected.
    }
  }

  await openMeetingSidePanelWindow(tabId, {
    catchup: shouldOpenCatchup,
    debug: shouldOpenDebug,
  });
  return 'window';
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

async function handleCapturedStatusUpdate(
  message: Record<string, any>,
): Promise<void> {
  const tabId = Number(message.tabId);
  const capture = message.capture as
    | Partial<MeetingPilotCaptureState>
    | undefined;
  if (!Number.isFinite(tabId) || !capture) return;
  const updated = await registry.setCaptureState(tabId, capture);
  if (updated) {
    await updateBrowserAction(updated);
    await broadcastSessionSnapshot(updated);
  }
}

async function handleTranscriptUpdate(
  message: Record<string, any>,
): Promise<void> {
  const tabId = Number(message.tabId);
  const transcriptChunk = message.transcriptChunk as
    | MeetingPilotSessionSnapshot['transcript'][number]
    | undefined;
  if (!Number.isFinite(tabId) || !transcriptChunk) return;

  const session = registry.getSessionByTabId(tabId);
  if (!session) return;
  const envConfig = await getEnvConfig();
  const aliasEntries = String(envConfig.MEETING_NAME_ALIASES || '')
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => item.split('=').map((part) => part.trim()))
    .filter((parts) => parts.length === 2);
  const resolveAlias = (name: string) => {
    const normalized = name
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fa5]+/gi, '');
    const match = aliasEntries.find(
      ([alias]) =>
        alias.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/gi, '') ===
        normalized,
    );
    return match?.[1] || name;
  };

  const effectiveSpeaker =
    transcriptChunk.speaker && transcriptChunk.speaker !== 'Unknown participant'
      ? resolveAlias(transcriptChunk.speaker)
      : resolveAlias(session.speakerLabel || 'Unknown participant');
  const nextTranscript = [
    ...session.transcript,
    { ...transcriptChunk, speaker: effectiveSpeaker },
  ].slice(-60);
  const configuredHotwords = String(envConfig.MEETING_HOTWORDS || '')
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
  const hotwordTopic = configuredHotwords.find((item) =>
    transcriptChunk.text.toLowerCase().includes(item.toLowerCase()),
  );
  const topicHintMatch = transcriptChunk.text.match(
    /(预算|排期|技术评审|风险|QA|owner|行动项)/i,
  );
  const heuristicTopic =
    hotwordTopic ||
    topicHintMatch?.[1] ||
    transcriptChunk.text.slice(0, 48) ||
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
    return `📍 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  };

  const heuristicParticipants = (() => {
    const current = [...session.participants];
    const speakerId = effectiveSpeaker
      ? effectiveSpeaker.toLowerCase().replace(/[^a-z0-9]+/g, '')
      : '';
    const speakerIndex = current.findIndex(
      (participant) =>
        participant.name.toLowerCase().replace(/[^a-z0-9]+/g, '') === speakerId,
    );
    if (speakerIndex === -1 && effectiveSpeaker !== 'Unknown participant') {
      current.push({
        id: speakerId || `participant-${current.length + 1}`,
        name: effectiveSpeaker,
        role: 'Participant',
        speakingPct: 0,
        stances: [],
      });
    }

    const totalChunksBySpeaker = nextTranscript.reduce<Record<string, number>>(
      (acc, chunk) => {
        const key = chunk.speaker.toLowerCase().replace(/[^a-z0-9]+/g, '');
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      },
      {},
    );
    const totalCount = nextTranscript.length || 1;

    return current.map((participant) => {
      const participantKey = participant.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '');
      const speakingPct = Math.round(
        ((totalChunksBySpeaker[participantKey] || 0) / totalCount) * 100,
      );

      if (
        participantKey !== speakerId ||
        effectiveSpeaker === 'Unknown participant' ||
        transcriptChunk.lowConfidence
      ) {
        return { ...participant, speakingPct };
      }

      const stanceItem = {
        topic: heuristicTopic || '会议讨论',
        stance: inferStance(transcriptChunk.text),
        keyQuote: transcriptChunk.text,
        timeRange: inferTimeLabel(transcriptChunk.ts),
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

  let llmResult: MeetingPilotStructuredParseResult | undefined;
  try {
    llmResult = await runMeetingAnalysis(
      session,
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
  const nextParticipants = (() => {
    if (!llmResult?.participantStances.length) {
      return heuristicParticipants;
    }
    return heuristicParticipants.map((participant) => {
      const participantMatches = llmResult.participantStances.filter(
        (item) => item.participant === participant.name,
      );
      if (!participantMatches.length) {
        return participant;
      }
      return {
        ...participant,
        stances: participantMatches.slice(0, 5).map((item) => ({
          topic: item.topic,
          stance: item.stance,
          keyQuote: item.keyQuote,
          timeRange: item.timeRange,
        })),
      };
    });
  })();

  const structuredData = buildStructuredMeetingData(
    session,
    analysisTranscript.length ? analysisTranscript : session.transcript,
    nextTopic,
    Number(envConfig.MEETING_SCREENSHOT_INTERVAL_SEC) || 18,
  );
  const mergedTimelineEvents = llmResult
    ? [
        ...structuredData.timelineEvents.filter(
          (event) => event.type === 'screen',
        ),
        ...llmResult.decisions.map((decision, index) => ({
          id: `timeline-llm-decision-${index}`,
          type: 'decision' as const,
          title: decision.text.slice(0, 48),
          description: decision.text,
          timestamp: decision.timestamp,
          chapterId:
            structuredData.chapters[structuredData.chapters.length - 1]?.id,
        })),
        ...llmResult.actionItems.map((item, index) => ({
          id: `timeline-llm-action-${index}`,
          type: 'action' as const,
          title: item.title.slice(0, 48),
          description: `${item.owner} · ${item.title}`,
          timestamp: formatTranscriptTimestamp(Date.now()),
          speaker: item.owner,
          chapterId:
            structuredData.chapters[structuredData.chapters.length - 1]?.id,
        })),
        ...structuredData.timelineEvents.filter(
          (event) => event.type === 'topic',
        ),
      ].slice(-12)
    : structuredData.timelineEvents;

  const latestStructuredParse = llmResult || {
    topic: nextTopic,
    summary: nextSummary || session.summary,
    actionItems: structuredData.actionItems,
    decisions: structuredData.decisions,
    alerts: [],
    participantStances: nextParticipants.flatMap((participant) =>
      (participant.stances || []).map((item) => ({
        participant: participant.name,
        topic: item.topic,
        stance: item.stance,
        keyQuote: item.keyQuote,
        timeRange: item.timeRange,
      })),
    ),
    latestObservationText:
      session.shareState === 'active'
        ? `${session.sharerName || 'Someone'} 正在共享屏幕，当前内容聚焦于 ${nextTopic}`
        : `当前会议讨论聚焦于 ${nextTopic}`,
  };

  const updated = await registry.updateObservation(tabId, {
    transcript: nextTranscript,
    currentTopic: nextTopic,
    summary: llmResult?.summary || nextSummary || session.summary,
    participants: nextParticipants,
    chapters: structuredData.chapters,
    timelineEvents: mergedTimelineEvents,
    actionItems: llmResult?.actionItems.length
      ? llmResult.actionItems
      : structuredData.actionItems,
    decisions: llmResult?.decisions.length
      ? llmResult.decisions
      : structuredData.decisions,
    timelineProgress: structuredData.timelineProgress,
    latestObservationText: latestStructuredParse.latestObservationText,
    latestStructuredParse,
  });
  if (updated) {
    const generatedAlerts = llmResult?.alerts || [];
    for (const alert of generatedAlerts) {
      const existing = updated.alerts.find(
        (item) => item.title === alert.title && item.body === alert.body,
      );
      if (!existing) {
        const alertUpdated = await registry.addAlert(tabId, alert);
        if (alertUpdated) {
          await updateBrowserAction(alertUpdated);
          await broadcastSessionSnapshot(alertUpdated);
        }
      }
    }
    await broadcastSessionSnapshot(updated);
    scheduleMeetingMemoryRefresh(tabId);
  }
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
      void ingestMeetingSession(sessionForBroadcast);
    }
  }
}

function buildMeetingIngestPayloads(session: MeetingPilotSessionSnapshot) {
  const panoramaUrl = chrome.runtime.getURL(
    `meeting-panorama.html?meetingId=${encodeURIComponent(session.meetingId)}&tabId=${session.tabId}`,
  );
  const summaryPayload = {
    content: `## 会议: ${session.title}
日期: ${new Date(session.detectedAt).toISOString()}
参会者: ${session.participants.map((participant) => participant.name).join(', ')}

### 摘要
${session.summary}

### 决议
${session.decisions.map((decision) => `- ${decision.text}`).join('\n') || '- 暂无'}

### 行动项
${session.actionItems.map((item) => `- [${item.owner}] ${item.title}${item.deadline ? ` (DDL: ${item.deadline})` : ''}`).join('\n') || '- 暂无'}`,
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
      actionItemCount: session.actionItems.length,
      latestObservationText: session.latestObservationText || null,
      summary: session.summary,
      chapters: session.chapters,
      actionItems: session.actionItems,
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
  const visualObservation = [
    session.shareState === 'active'
      ? `${session.sharerName || 'Someone'} is sharing the screen.`
      : undefined,
    session.speakerLabel
      ? `Current speaker: ${session.speakerLabel}.`
      : undefined,
  ]
    .filter(Boolean)
    .join(' ');
  const meetingMetadata = [
    `Meeting: ${session.title}`,
    session.participants.length
      ? `Participants: ${session.participants.map((participant) => participant.name).join(', ')}`
      : undefined,
  ]
    .filter(Boolean)
    .join(' ');

  const query = [
    session.currentTopic,
    session.summary,
    transcriptSummary,
    visualObservation,
    meetingMetadata,
  ]
    .filter(Boolean)
    .join(' ');
  if (!query.trim()) return;

  try {
    const client = getMemoryServiceClient();
    let result;
    try {
      result = await client.recall(query, buildMeetingPilotRecallOptions());
    } catch (error) {
      if (!shouldRetryLegacyMeetingRecall(error)) {
        throw error;
      }
      result = await client.recall(query, {
        topK: 3,
        channels: ['fts', 'time'],
        includeMetadata: true,
        sourceTypes: ['meeting', 'manual', 'web', 'glip'],
      });
    }

    const memoryRefs = result.items.map(recallItemToMeetingPilotMemoryRef);

    const updated = await registry.updateObservation(tabId, { memoryRefs });
    if (updated) {
      await broadcastSessionSnapshot(updated);
    }
  } catch (error) {
    console.warn('Meeting Pilot recall failed:', error);
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
        await syncSessionReadiness(tabId, true);
      } else {
        const activeSession = registry.getActiveSession();
        if (activeSession) {
          await syncSessionReadiness(activeSession.tabId, true);
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
        participantCount: payload.participantCount,
        participants: payload.participants,
        sharerName: payload.sharerName,
        speakerLabel: payload.speakerLabel,
        detectedAt: payload.detectedAt || Date.now(),
      });
      await broadcastSessionSnapshot(session);
      scheduleMeetingMemoryRefresh(session.tabId);
      sendResponse(session);
      return;
    }
    case 'MEETING_PILOT_OPEN_SIDE_PANEL': {
      await ensureInitialized();
      const surface = await openMeetingSidePanel(
        Number(request.tabId || tabId || 0),
        typeof request.source === 'string' ? request.source : undefined,
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
      const result = await startMeetingCapture(
        resolvedTabId,
        String(request.meetingId || request.payload?.meetingId || ''),
      );
      let surface: 'embedded' | 'side-panel' | 'window' | undefined;
      let panelError: string | undefined;
      if (isCaptureActiveForUi(result)) {
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
      const result = await startMeetingCapture(
        resolvedTabId,
        String(request.meetingId || request.payload?.meetingId || ''),
      );
      sendResponse({ success: isCaptureActiveForUi(result), session: result });
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
      }
      sendResponse({ success: Boolean(session), session });
      return;
    }
    case 'MEETING_PILOT_TRANSCRIPT_UPDATE': {
      await ensureInitialized();
      await handleTranscriptUpdate({
        ...request,
        tabId: Number(request.tabId || tabId || 0),
      });
      sendResponse({ success: true });
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
      void finalizeMeetingTabSession(tabId);
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

export async function initMeetingPilotBackgroundRuntime(): Promise<void> {
  await ensureInitialized();

  chrome.tabs.onUpdated.addListener(handleTabUpdate);
  chrome.tabs.onRemoved.addListener((tabId) => {
    void finalizeMeetingTabSession(tabId);
  });

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
    );
    return true;
  });

  chrome.runtime.onInstalled.addListener(() => {
    void scanOpenMeetingTabs();
  });

  chrome.runtime.onStartup.addListener(() => {
    void scanOpenMeetingTabs();
  });
}
