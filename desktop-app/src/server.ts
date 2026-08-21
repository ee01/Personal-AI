import Fastify from 'fastify';
import type { FastifyReply, FastifyRequest } from 'fastify';

import {
  buildAssistantRuntimeSummary,
  classifyRememberText,
} from './assistantRuntime.js';
import type { BridgeConfig } from './config.js';
import type { ExplorerManager } from './explorer/index.js';
import type { SourceId } from './explorer/types.js';
import { WebpageMcpHost } from './explorer/transports/WebpageMcpHost.js';
import {
  BridgeMemoryServiceClient,
  BridgeMemoryServiceHttpError,
} from './memoryServiceClient.js';
import { registerWhisperRoutes } from './whisper/whisperRoutes.js';
import { registerAsrRoutes } from './asr/asrRoutes.js';
import {
  applyBridgeSettingsToConfig,
  BridgeSettingsStore,
  type BridgeSettingsPayload,
  type BridgeUserSettings,
} from './settings.js';
import type {
  BridgeSyncManager,
  BridgeSyncManagerSnapshot,
} from './syncManager.js';
import type { LocalSkillSyncManager } from './skillSync/localSkillSyncManager.js';
import type {
  AutoSyncKind,
  BridgeAssistantStreamEvent,
  BindingType,
  BridgeAssistantAskRequest,
  BridgeBlockingReason,
  BridgeMemoryGrowthSummary,
  BridgeServiceStatus,
  BridgeRememberRequest,
  BridgeStatus,
  BridgeSyncReadiness,
  MemoSyncRequest,
  MobileBriefingRequest,
  QueryInjectRequest,
  ReminderSyncRequest,
  SendExperimentRequest,
  StableMemorySyncRequest,
} from './types.js';
import { DoubaoBridgeService } from './bridgeService.js';
import {
  isTrustedWorkerPairOrigin,
  WorkerSupervisor,
} from './workerSupervisor.js';

function readToken(
  request: Pick<FastifyRequest, 'headers'>,
): string | undefined {
  const value = request.headers['x-bridge-token'];
  return Array.isArray(value) ? value[0] : value;
}

function createAuthHook(service: DoubaoBridgeService) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (
      request.url === '/health' ||
      request.url === '/pair' ||
      request.url === '/worker/pair' ||
      request.url === '/worker/status'
    ) {
      return;
    }

    const status = await service.getStatus();
    if (!status.pairToken) {
      await reply.code(401).send({ error: 'Bridge is not paired' });
      return;
    }

    const token = readToken(request);
    if (token !== status.pairToken) {
      await reply.code(401).send({ error: 'Missing or invalid bridge token' });
    }
  };
}

async function loadActiveBrowserContext(): Promise<{
  available: boolean;
  title?: string;
  url?: string;
  selectionText?: string;
  visibleText?: string;
  error?: string;
}> {
  try {
    const raw = await WebpageMcpHost.getInstance().evalInTab(
      undefined,
      `JSON.stringify((() => {
        const text = (value) => String(value || '').replace(/\\s+/g, ' ').trim();
        const title = text(document.title);
        const url = text(window.location.href);
        const selectionText = text(window.getSelection?.().toString?.() || '').slice(0, 1000);
        const visibleText = text(document.body?.innerText || '').slice(0, 2600);
        return { title, url, selectionText, visibleText };
      })())`,
    );
    const parsed = JSON.parse(raw || '{}') as Record<string, unknown>;
    return {
      available: Boolean(parsed.url || parsed.title || parsed.visibleText),
      title: typeof parsed.title === 'string' ? parsed.title : undefined,
      url: typeof parsed.url === 'string' ? parsed.url : undefined,
      selectionText:
        typeof parsed.selectionText === 'string'
          ? parsed.selectionText
          : undefined,
      visibleText:
        typeof parsed.visibleText === 'string' ? parsed.visibleText : undefined,
    };
  } catch (error) {
    return {
      available: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

interface BridgeServerDependencies {
  memoryClient: BridgeMemoryServiceClient;
  settingsStore: BridgeSettingsStore;
  syncManager: BridgeSyncManager;
  explorerManager?: ExplorerManager;
  localSkillSyncManager?: LocalSkillSyncManager;
  workerSupervisor?: WorkerSupervisor;
  version: string;
}

type SyncReadinessKey = 'stableMemory' | 'mobileBriefing' | 'reminderSync';
type RunNowRequestKind =
  | AutoSyncKind
  | 'stableMemory'
  | 'mobileBriefing'
  | 'reminderSync';
const LOW_MESSAGE_THRESHOLD = 50;
const MEMORY_GROWTH_WINDOW_DAYS = 90;

function normalizeAutoSyncKind(kind: RunNowRequestKind): AutoSyncKind {
  if (kind === 'stableMemory') return 'stable_memory';
  if (kind === 'mobileBriefing') return 'mobile_briefing';
  if (kind === 'reminderSync') return 'reminder_sync';
  return kind;
}

function buildRunNowResponse(
  kind: AutoSyncKind,
  result: Awaited<ReturnType<BridgeSyncManager['runNow']>>,
): Record<string, unknown> {
  const response: Record<string, unknown> = {
    ok: true,
    kind,
    status: result.status,
  };
  const metadataKeys = [
    'errorMessage',
    'externalThreadId',
    'packageKinds',
    'packageItemCount',
    'sourceRefCount',
    'feedHasMore',
    'feedLimit',
    'feedSnapshotReceipt',
    'transportUsed',
    'transportMode',
    'transportFallbackReason',
    'verified',
    'messageVisible',
    'challengeDetected',
    'telemetryError',
    'reminderDeliveryMode',
  ] as const;

  for (const key of metadataKeys) {
    if (result[key] !== undefined) {
      response[key] = result[key];
    }
  }
  return response;
}

function uniqueReasons(
  reasons: BridgeBlockingReason[],
): BridgeBlockingReason[] {
  return reasons.filter(
    (reason, index) =>
      reasons.findIndex((candidate) => candidate.code === reason.code) ===
      index,
  );
}

function extractDoubaoThreadId(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    if (hostname !== 'doubao.com' && !hostname.endsWith('.doubao.com')) {
      return undefined;
    }
    const match = parsed.pathname.match(/\/(?:chat|thread)\/([^/?#]+)/);
    return match?.[1];
  } catch {
    return undefined;
  }
}

function hasUsableDoubaoThreadUrl(url?: string): boolean {
  return Boolean(extractDoubaoThreadId(url));
}

function bindingHasUsableThreadUrl(
  status: BridgeServiceStatus,
  bindingType: BindingType,
): boolean {
  const binding = status.bindings[bindingType];
  if (!binding?.threadId) return false;
  const record = status.threads.find((thread) => thread.id === binding.threadId);
  return (
    hasUsableDoubaoThreadUrl(binding.threadUrl) ||
    hasUsableDoubaoThreadUrl(record?.url)
  );
}

function buildBlockingReasons(
  settings: BridgeSettingsPayload['effective'],
  status: Awaited<ReturnType<DoubaoBridgeService['getStatus']>>,
) {
  const reasons: BridgeBlockingReason[] = [];

  if (!settings.autoSync) {
    reasons.push({
      code: 'auto_sync_disabled',
      message: '自动同步尚未开启',
      syncKinds: ['stableMemory', 'mobileBriefing', 'reminderSync'],
    });
  }

  if (!settings.memoryServiceBaseUrl) {
    reasons.push({
      code: 'memory_service_not_configured',
      message: '还没有连接 Memory Service',
      syncKinds: ['stableMemory', 'mobileBriefing', 'reminderSync'],
    });
  } else if (!settings.memoryServiceUserId) {
    reasons.push({
      code: 'memory_service_user_missing',
      message: 'Memory Service User ID 尚未配置',
      syncKinds: ['stableMemory', 'mobileBriefing', 'reminderSync'],
    });
  }

  if (status.authStatus !== 'connected') {
    const usesDailyBrowserBroadcast =
      settings.explorer.doubao.broadcastTransport === 'webpage_mcp';
    reasons.push({
      code: 'auth_required',
      message: usesDailyBrowserBroadcast
        ? '日常 Chrome 的豆包标签页尚未登录或不可用'
        : '豆包尚未登录',
      syncKinds: ['stableMemory', 'mobileBriefing', 'reminderSync'],
    });
  }

  if (!bindingHasUsableThreadUrl(status, 'memory_sync')) {
    reasons.push({
      code: 'memory_sync_not_bound',
      message: '长期记忆线程尚未绑定，或绑定缺少可打开的豆包会话链接',
      syncKinds: ['stableMemory'],
    });
  }

  if (!bindingHasUsableThreadUrl(status, 'mobile_context')) {
    reasons.push({
      code: 'mobile_context_not_bound',
      message: '手机对话尚未绑定，或绑定缺少可打开的豆包会话链接',
      syncKinds: ['mobileBriefing', 'reminderSync'],
    });
  }

  return uniqueReasons(reasons);
}

function filterReadiness(
  kind: SyncReadinessKey,
  reasons: BridgeBlockingReason[],
  taskSnapshot: BridgeSyncManagerSnapshot['tasks'][SyncReadinessKey],
): BridgeSyncReadiness {
  const kindReasons = reasons.filter((reason) =>
    reason.syncKinds.includes(kind),
  );

  return {
    ready: kindReasons.length === 0,
    reasons: kindReasons,
    intervalMs: taskSnapshot.intervalMs,
    lastRunAt: taskSnapshot.lastRunAt,
  };
}

async function loadMemoryGrowthSummary(
  memoryClient: BridgeMemoryServiceClient,
): Promise<BridgeMemoryGrowthSummary | undefined> {
  if (!memoryClient.isEnabled()) return undefined;

  try {
    const stats = await memoryClient.getStats();
    const recentMessageCount = stats.messages.last90Days;
    if (
      typeof recentMessageCount !== 'number' ||
      Number.isNaN(recentMessageCount)
    ) {
      return undefined;
    }

    return {
      windowDays: MEMORY_GROWTH_WINDOW_DAYS,
      recentMessageCount,
      lowMessageThreshold: LOW_MESSAGE_THRESHOLD,
      belowThreshold: recentMessageCount < LOW_MESSAGE_THRESHOLD,
    };
  } catch {
    return undefined;
  }
}

async function buildStatus(
  service: DoubaoBridgeService,
  deps: BridgeServerDependencies,
): Promise<BridgeStatus> {
  const baseStatus = await service.getStatus();
  const syncSnapshot = deps.syncManager.getSnapshot();
  const settingsPayload = deps.settingsStore.getPayload();
  const blockingReasons = buildBlockingReasons(
    settingsPayload.effective,
    baseStatus,
  );
  const memoryGrowth = await loadMemoryGrowthSummary(deps.memoryClient);

  return {
    ...baseStatus,
    appVersion: deps.version,
    memoryServiceConfigured: Boolean(
      settingsPayload.effective.memoryServiceBaseUrl &&
      settingsPayload.effective.memoryServiceUserId,
    ),
    autoSyncEnabled: settingsPayload.effective.autoSync,
    memoryGrowth,
    blockingReasons,
    syncReadiness: {
      stableMemory: filterReadiness(
        'stableMemory',
        blockingReasons,
        syncSnapshot.tasks.stableMemory,
      ),
      mobileBriefing: filterReadiness(
        'mobileBriefing',
        blockingReasons,
        syncSnapshot.tasks.mobileBriefing,
      ),
      reminderSync: filterReadiness(
        'reminderSync',
        blockingReasons,
        syncSnapshot.tasks.reminderSync,
      ),
    },
    syncState: syncSnapshot,
    settings: {
      memoryServiceBaseUrl: settingsPayload.effective.memoryServiceBaseUrl,
      memoryServiceUserId: settingsPayload.effective.memoryServiceUserId,
      autoSync: settingsPayload.effective.autoSync,
      pollIntervalMs: settingsPayload.effective.pollIntervalMs,
      stableMemoryIntervalMs: settingsPayload.effective.stableMemoryIntervalMs,
      mobileBriefingIntervalMs:
        settingsPayload.effective.mobileBriefingIntervalMs,
      reminderSyncIntervalMs: settingsPayload.effective.reminderSyncIntervalMs,
      reminderDailyDigestEnabled:
        settingsPayload.effective.reminderDailyDigestEnabled,
      reminderDailyDigestTime:
        settingsPayload.effective.reminderDailyDigestTime,
      reminderDedupSameDay: settingsPayload.effective.reminderDedupSameDay,
    },
    setupChecklist: {
      memoryServiceConfigured: Boolean(
        settingsPayload.effective.memoryServiceBaseUrl &&
        settingsPayload.effective.memoryServiceUserId,
      ),
      autoSyncEnabled: settingsPayload.effective.autoSync,
      doubaoConnected: baseStatus.authStatus === 'connected',
      memorySyncBound: bindingHasUsableThreadUrl(baseStatus, 'memory_sync'),
      mobileContextBound: bindingHasUsableThreadUrl(
        baseStatus,
        'mobile_context',
      ),
    },
  };
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function writeSseEvent(
  reply: FastifyReply,
  event: BridgeAssistantStreamEvent['type'],
  payload: Record<string, unknown>,
) {
  reply.raw.write(`event: ${event}\n`);
  reply.raw.write(`data: ${JSON.stringify({ type: event, ...payload })}\n\n`);
}

async function loadAssistantRuntimeSummary(
  service: DoubaoBridgeService,
  deps: BridgeServerDependencies,
) {
  const status = await buildStatus(service, deps);
  if (!deps.memoryClient.isEnabled()) {
    return buildAssistantRuntimeSummary({ status });
  }

  try {
    const [
      confirmRequests,
      runningActions,
      queuedActions,
      outreachSummary,
      waitingReplySessions,
      pendingApprovalSessions,
    ] = await Promise.all([
      deps.memoryClient.getConfirmRequests('pending', 5, 'decision'),
      deps.memoryClient.getActions({ queueStatus: 'running', limit: 5 }),
      deps.memoryClient.getActions({ queueStatus: 'queued', limit: 5 }),
      deps.memoryClient.getOutreachSummary(),
      deps.memoryClient.getOutreachSessions({
        status: 'waiting_reply',
        limit: 1,
      }),
      deps.memoryClient.getOutreachSessions({
        status: 'pending_approval',
        limit: 1,
      }),
    ]);

    return buildAssistantRuntimeSummary({
      status,
      confirmRequests,
      runningActions,
      queuedActions,
      outreachSummary,
      waitingReplySessions,
      pendingApprovalSessions,
    });
  } catch (error) {
    return buildAssistantRuntimeSummary({
      status,
      runtimeErrorMessage: describeError(error),
    });
  }
}

export async function createBridgeServer(
  config: BridgeConfig,
  service: DoubaoBridgeService,
  deps: BridgeServerDependencies,
) {
  const app = Fastify({ logger: process.env.NODE_ENV !== 'test' });

  app.addHook('onRequest', createAuthHook(service));

  app.get('/health', async () => service.getHealth());

  app.post<{
    Body: { token?: string };
  }>('/pair', async (request, reply) => {
    try {
      return await service.pair(request.body?.token);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Pair failed';
      return reply.code(401).send({ error: message });
    }
  });

  app.get('/worker/status', async () => {
    return deps.workerSupervisor?.getStatusAsync() || { state: 'offline', paired: false };
  });

  app.post<{
    Body: { pairingToken?: string; serverUrl?: string; token?: string };
  }>('/worker/pair', async (request, reply) => {
    if (
      !isTrustedWorkerPairOrigin(
        typeof request.headers.origin === 'string' ? request.headers.origin : undefined,
        typeof request.headers['x-personal-ai-extension-id'] === 'string'
          ? request.headers['x-personal-ai-extension-id']
          : undefined,
        request.ip,
      )
    ) {
      return reply.code(403).send({ ok: false, error: 'untrusted origin' });
    }
    const pairingToken = String(
      request.body?.pairingToken || request.body?.token || '',
    ).trim();
    if (!pairingToken) {
      return reply.code(400).send({ ok: false, error: 'pairingToken required' });
    }
    if (!deps.workerSupervisor) {
      return reply.code(501).send({ ok: false, error: 'worker supervisor unavailable' });
    }
    const serverUrl =
      String(request.body?.serverUrl || '').trim() ||
      deps.settingsStore.get().memoryServiceBaseUrl ||
      'http://127.0.0.1:3210';
    await deps.workerSupervisor.pair({ pairingToken, serverUrl });
    return { ok: true, ...(await deps.workerSupervisor.getStatusAsync()) };
  });

  app.get('/status', async () => buildStatus(service, deps));

  app.get('/auth/status', async () => buildStatus(service, deps));

  app.post('/auth/open-login', async (_request, reply) => {
    try {
      return await service.openLogin();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to open Doubao login';
      return reply.code(400).send({ error: message });
    }
  });

  app.get('/settings', async () => deps.settingsStore.getPayload());

  app.put<{
    Body: Partial<BridgeUserSettings>;
  }>('/settings', async (request) => {
    const payload = await deps.settingsStore.update(request.body || {});
    applyBridgeSettingsToConfig(config, payload.effective);
    deps.syncManager.reload();
    return payload;
  });

  app.post('/settings/test-memory-service', async (_request, reply) => {
    try {
      return await deps.memoryClient.testConnection();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Memory Service test failed';
      return reply.code(400).send({ ok: false, error: message });
    }
  });

  app.post<{
    Body: { platform?: string };
  }>('/skills/sync/run', async (request, reply) => {
    if (!deps.localSkillSyncManager) {
      return reply.code(501).send({ error: 'Local skill sync is not available.' });
    }
    try {
      return await deps.localSkillSyncManager.run({
        platform: request.body?.platform,
      });
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  if (deps.explorerManager) {
    app.get('/explorer/status', async () => deps.explorerManager?.getStatus());

    app.post<{
      Body: { source: SourceId };
    }>('/explorer/auth/open-login', async (request, reply) => {
      try {
        return await deps.explorerManager?.openLogin(request.body.source);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Unable to open explorer login';
        return reply.code(400).send({ error: message });
      }
    });

    app.post<{
      Body: { source: SourceId };
    }>('/explorer/run-now', async (request, reply) => {
      try {
        return await deps.explorerManager?.runNow(request.body.source);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Explorer run-now failed';
        return reply.code(400).send({ error: message });
      }
    });

    app.post<{
      Body: { source: SourceId; conversationId?: string };
    }>('/explorer/reset-cache', async (request, reply) => {
      try {
        return await deps.explorerManager?.resetCache(
          request.body.source,
          request.body.conversationId,
        );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Explorer cache reset failed';
        return reply.code(400).send({ error: message });
      }
    });

    app.post<{
      Body: { source: SourceId; scope: 'work' | 'personal' };
    }>('/explorer/revoke-ingested-memory', async (request, reply) => {
      try {
        return await deps.explorerManager?.revokeIngestedMemories(
          request.body.source,
          request.body.scope,
        );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Explorer revoke ingested memory failed';
        return reply.code(400).send({ error: message });
      }
    });

    app.get<{
      Querystring: {
        source: SourceId;
        conversationId?: string;
        limit?: string;
      };
    }>('/explorer/preview', async (request, reply) => {
      try {
        return await deps.explorerManager?.preview({
          source: request.query.source,
          conversationId: request.query.conversationId,
          limit: request.query.limit ? Number(request.query.limit) : undefined,
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Explorer preview failed';
        return reply.code(400).send({ error: message });
      }
    });

    app.get<{
      Querystring: {
        source?: SourceId;
        q?: string;
        limit?: string;
        offset?: string;
      };
    }>('/explorer/memories', async (request, reply) => {
      try {
        const result = deps.explorerManager?.listExploredMemories({
          source: request.query.source,
          query: request.query.q,
          limit: request.query.limit ? Number(request.query.limit) : undefined,
          offset: request.query.offset
            ? Number(request.query.offset)
            : undefined,
        });
        return (
          result ?? { items: [], total: 0, limit: 0, offset: 0, hasMore: false }
        );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Explorer memories listing failed';
        return reply.code(400).send({ error: message });
      }
    });

    app.get('/explorer/webpage-mcp/status', async () => {
      return WebpageMcpHost.getInstance().getStatus();
    });

    app.post('/explorer/webpage-mcp/test', async (_, reply) => {
      try {
        const { tabCount } =
          await WebpageMcpHost.getInstance().testConnection();
        return { ok: true, tabCount };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return reply.code(500).send({ ok: false, error: message });
      }
    });
  }

  app.get('/assistant/runtime-summary', async () =>
    loadAssistantRuntimeSummary(service, deps),
  );

  app.get('/assistant/active-browser-context', async () =>
    loadActiveBrowserContext(),
  );

  app.post<{
    Body: BridgeAssistantAskRequest;
  }>('/assistant/ask', async (request, reply) => {
    if (!deps.memoryClient.isEnabled()) {
      return reply.code(503).send({
        error: 'Quick Ask 需要先连接 Memory Service。',
      });
    }

    try {
      const result = await deps.memoryClient.ask(
        request.body.query,
        request.body.context,
        request.body.includeEvidence,
        request.body.scope,
        request.body.contextHints,
      );
      const runtime = await loadAssistantRuntimeSummary(service, deps);
      return {
        ...result,
        runtime,
      };
    } catch (error) {
      return reply.code(503).send({
        error: describeError(error),
      });
    }
  });

  app.post<{
    Body: BridgeAssistantAskRequest;
  }>('/assistant/ask/stream', async (request, reply) => {
    if (!deps.memoryClient.isEnabled()) {
      return reply.code(503).send({
        error: 'Quick Ask 需要先连接 Memory Service。',
      });
    }

    reply.hijack();
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    reply.raw.flushHeaders?.();

    try {
      await deps.memoryClient.streamAsk(
        request.body.query,
        request.body.context,
        request.body.includeEvidence,
        request.body.scope,
        async (event) => {
          if (event.type === 'result') {
            const runtime = await loadAssistantRuntimeSummary(service, deps);
            writeSseEvent(reply, 'result', {
              ...event,
              runtime,
            });
            return;
          }

          if (event.type === 'start') {
            writeSseEvent(reply, 'start', { requestId: event.requestId });
            return;
          }

          if (event.type === 'delta') {
            writeSseEvent(reply, 'delta', { text: event.text });
            return;
          }

          if (event.type === 'status') {
            writeSseEvent(reply, 'status', { message: event.message });
            return;
          }

          if (event.type === 'answer_done') {
            writeSseEvent(reply, 'answer_done', { answer: event.answer });
            return;
          }

          if (event.type === 'recall_done') {
            writeSseEvent(reply, 'recall_done', {
              itemsCount: event.itemsCount,
              blocks: event.blocks,
              evidence: event.evidence,
            });
            return;
          }

          if (event.type === 'error') {
            writeSseEvent(reply, 'error', { message: event.message });
            return;
          }
        },
        request.body.contextHints,
      );
    } catch (error) {
      writeSseEvent(reply, 'error', {
        message: describeError(error),
      });
    } finally {
      reply.raw.end();
    }
  });

  app.post<{
    Body: BridgeRememberRequest;
  }>('/assistant/memory/remember', async (request, reply) => {
    if (!deps.memoryClient.isEnabled()) {
      return reply.code(503).send({
        error: 'Quick Ask 需要先连接 Memory Service。',
      });
    }

    const classification = classifyRememberText(request.body.text);
    try {
      const created = await deps.memoryClient.createProfileItem({
        itemType: classification.itemType,
        itemKey: classification.itemKey,
        itemValue: classification.itemValue,
        confidence: 1,
      });
      return {
        items: [
          {
            id: created.id,
            itemType: classification.itemType,
            itemKey: classification.itemKey,
            itemValue: classification.itemValue,
          },
        ],
      };
    } catch (error) {
      if (
        error instanceof BridgeMemoryServiceHttpError &&
        error.status === 409
      ) {
        const payload =
          error.payload && typeof error.payload === 'object'
            ? (error.payload as { existingId?: string })
            : {};
        return {
          items: [
            {
              id: payload.existingId,
              itemType: classification.itemType,
              itemKey: classification.itemKey,
              itemValue: classification.itemValue,
              duplicate: true,
            },
          ],
        };
      }

      return reply.code(503).send({
        error: describeError(error),
      });
    }
  });

  app.get('/threads', async () => service.listThreads());

  app.post('/threads/create-memory-sync', async (_request, reply) => {
    try {
      return await service.createMemorySyncThread();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unable to create memory-sync thread';
      return reply.code(400).send({ error: message });
    }
  });

  app.post<{
    Body: { title?: string };
  }>('/threads/auto-bind-mobile', async (request, reply) => {
    const title = request.body?.title?.trim() || '手机版对话';
    try {
      const binding = await service.bindMobileContextByTitle(title);
      if (!binding) {
        return reply.code(404).send({
          error: `没有找到名为“${title}”的豆包对话，也没有可绑定的当前豆包 /chat 或 /thread 页面。请先在豆包中打开你真正会继续使用的手机对话，再点击“自动绑定手机对话”。`,
        });
      }
      return binding;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unable to bind mobile-context thread';
      return reply.code(400).send({ error: message });
    }
  });

  app.post<{
    Body: {
      bindingType: BindingType;
      threadId?: string;
      threadUrl?: string;
      title?: string;
    };
  }>('/threads/bind', async (request) =>
    service.bindThread(request.body.bindingType, {
      id: request.body.threadId,
      threadUrl: request.body.threadUrl,
      url: request.body.threadUrl,
      title: request.body.title,
    }),
  );

  app.post<{ Body: StableMemorySyncRequest }>(
    '/sync/stable-memory',
    async (request) => service.syncStableMemory(request.body),
  );

  app.post<{ Body: MobileBriefingRequest }>(
    '/sync/mobile-briefing',
    async (request) => service.syncMobileBriefing(request.body),
  );

  app.post<{
    Body: { kind: RunNowRequestKind };
  }>('/sync/run-now', async (request, reply) => {
    try {
      const kind = normalizeAutoSyncKind(request.body.kind);
      const result = await deps.syncManager.runNow(kind);
      return buildRunNowResponse(kind, result);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Run-now sync failed';
      return reply.code(400).send({ ok: false, error: message });
    }
  });

  app.post<{ Body: QueryInjectRequest }>('/inject/query', async (request) =>
    service.injectQuery(request.body),
  );

  app.post<{ Body: SendExperimentRequest }>(
    '/debug/send-experiment',
    async (request, reply) => {
      try {
        return await service.sendExperiment(request.body);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Experiment send failed';
        return reply.code(400).send({ accepted: false, error: message });
      }
    },
  );

  app.post<{ Body: ReminderSyncRequest }>('/reminders/sync', async (request) =>
    service.syncReminders(request.body),
  );

  // 随手记同步 API
  app.post<{ Body: MemoSyncRequest }>('/memo/sync', async (request) =>
    service.syncMemo(request.body),
  );

  // 随手记格式的长期记忆同步
  app.post<{ Body: StableMemorySyncRequest }>(
    '/memo/stable-memory',
    async (request) => service.syncStableMemoryAsMemo(request.body),
  );

  // 随手记格式的提醒同步
  app.post<{ Body: ReminderSyncRequest }>('/memo/reminders', async (request) =>
    service.syncRemindersAsMemo(request.body),
  );

  // 分类测试 API
  app.post<{ Body: { text: string } }>('/memo/classify', async (request) => {
    const { classifyMessage, extractMemoContent } =
      await import('./memoClassifier.js');
    const classification = classifyMessage(request.body.text);
    const metadata = extractMemoContent(request.body.text, classification.type);
    return {
      ...classification,
      metadata,
    };
  });

  await registerWhisperRoutes(app);
  await registerAsrRoutes(app);

  return app;
}
