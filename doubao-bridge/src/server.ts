import Fastify from 'fastify';
import type { FastifyReply, FastifyRequest } from 'fastify';

import {
  buildAssistantRuntimeSummary,
  classifyRememberText,
} from './assistantRuntime.js';
import type { BridgeConfig } from './config.js';
import {
  BridgeMemoryServiceClient,
  BridgeMemoryServiceHttpError,
} from './memoryServiceClient.js';
import { applyBridgeSettingsToConfig, BridgeSettingsStore, type BridgeSettingsPayload, type BridgeUserSettings } from './settings.js';
import type { BridgeSyncManager, BridgeSyncManagerSnapshot } from './syncManager.js';
import type {
  AutoSyncKind,
  BridgeAssistantStreamEvent,
  BindingType,
  BridgeAssistantAskRequest,
  BridgeBlockingReason,
  BridgeMemoryGrowthSummary,
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

function readToken(request: Pick<FastifyRequest, 'headers'>): string | undefined {
  const value = request.headers['x-bridge-token'];
  return Array.isArray(value) ? value[0] : value;
}

function createAuthHook(service: DoubaoBridgeService) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.url === '/health' || request.url === '/pair') return;

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

interface BridgeServerDependencies {
  memoryClient: BridgeMemoryServiceClient;
  settingsStore: BridgeSettingsStore;
  syncManager: BridgeSyncManager;
  version: string;
}

type SyncReadinessKey = 'stableMemory' | 'mobileBriefing' | 'reminderSync';
type RunNowRequestKind = AutoSyncKind | 'stableMemory' | 'mobileBriefing' | 'reminderSync';
const LOW_MESSAGE_THRESHOLD = 50;
const MEMORY_GROWTH_WINDOW_DAYS = 90;

function normalizeAutoSyncKind(kind: RunNowRequestKind): AutoSyncKind {
  if (kind === 'stableMemory') return 'stable_memory';
  if (kind === 'mobileBriefing') return 'mobile_briefing';
  if (kind === 'reminderSync') return 'reminder_sync';
  return kind;
}

function uniqueReasons(reasons: BridgeBlockingReason[]): BridgeBlockingReason[] {
  return reasons.filter(
    (reason, index) =>
      reasons.findIndex((candidate) => candidate.code === reason.code) === index,
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
    reasons.push({
      code: 'auth_required',
      message: '豆包尚未登录',
      syncKinds: ['stableMemory', 'mobileBriefing', 'reminderSync'],
    });
  }

  if (!status.bindings.memory_sync) {
    reasons.push({
      code: 'memory_sync_not_bound',
      message: '长期记忆线程尚未绑定',
      syncKinds: ['stableMemory'],
    });
  }

  if (!status.bindings.mobile_context) {
    reasons.push({
      code: 'mobile_context_not_bound',
      message: '手机对话尚未绑定',
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
  const kindReasons = reasons.filter((reason) => reason.syncKinds.includes(kind));

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
    if (typeof recentMessageCount !== 'number' || Number.isNaN(recentMessageCount)) {
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
  const blockingReasons = buildBlockingReasons(settingsPayload.effective, baseStatus);
  const memoryGrowth = await loadMemoryGrowthSummary(deps.memoryClient);

  return {
    ...baseStatus,
    appVersion: deps.version,
    memoryServiceConfigured: Boolean(
      settingsPayload.effective.memoryServiceBaseUrl && settingsPayload.effective.memoryServiceUserId,
    ),
    autoSyncEnabled: settingsPayload.effective.autoSync,
    memoryGrowth,
    blockingReasons,
    syncReadiness: {
      stableMemory: filterReadiness('stableMemory', blockingReasons, syncSnapshot.tasks.stableMemory),
      mobileBriefing: filterReadiness('mobileBriefing', blockingReasons, syncSnapshot.tasks.mobileBriefing),
      reminderSync: filterReadiness('reminderSync', blockingReasons, syncSnapshot.tasks.reminderSync),
    },
    syncState: syncSnapshot,
    settings: {
      memoryServiceBaseUrl: settingsPayload.effective.memoryServiceBaseUrl,
      memoryServiceUserId: settingsPayload.effective.memoryServiceUserId,
      autoSync: settingsPayload.effective.autoSync,
      pollIntervalMs: settingsPayload.effective.pollIntervalMs,
      stableMemoryIntervalMs: settingsPayload.effective.stableMemoryIntervalMs,
      mobileBriefingIntervalMs: settingsPayload.effective.mobileBriefingIntervalMs,
      reminderSyncIntervalMs: settingsPayload.effective.reminderSyncIntervalMs,
    },
    setupChecklist: {
      memoryServiceConfigured: Boolean(
        settingsPayload.effective.memoryServiceBaseUrl && settingsPayload.effective.memoryServiceUserId,
      ),
      autoSyncEnabled: settingsPayload.effective.autoSync,
      doubaoConnected: baseStatus.authStatus === 'connected',
      memorySyncBound: Boolean(baseStatus.bindings.memory_sync),
      mobileContextBound: Boolean(baseStatus.bindings.mobile_context),
    },
  };
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function writeSseEvent(reply: FastifyReply, event: BridgeAssistantStreamEvent['type'], payload: Record<string, unknown>) {
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
      deps.memoryClient.getConfirmRequests('pending', 5),
      deps.memoryClient.getActions({ queueStatus: 'running', limit: 5 }),
      deps.memoryClient.getActions({ queueStatus: 'queued', limit: 5 }),
      deps.memoryClient.getOutreachSummary(),
      deps.memoryClient.getOutreachSessions({ status: 'waiting_reply', limit: 1 }),
      deps.memoryClient.getOutreachSessions({ status: 'pending_approval', limit: 1 }),
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

export async function createBridgeServer(config: BridgeConfig, service: DoubaoBridgeService, deps: BridgeServerDependencies) {
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

  app.get('/status', async () => buildStatus(service, deps));

  app.get('/auth/status', async () => buildStatus(service, deps));

  app.post('/auth/open-login', async (_request, reply) => {
    try {
      return await service.openLogin();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to open Doubao login';
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
      const message = error instanceof Error ? error.message : 'Memory Service test failed';
      return reply.code(400).send({ ok: false, error: message });
    }
  });

  app.get('/assistant/runtime-summary', async () => loadAssistantRuntimeSummary(service, deps));

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

          writeSseEvent(reply, 'error', { message: event.message });
        },
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
      if (error instanceof BridgeMemoryServiceHttpError && error.status === 409) {
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
      const message = error instanceof Error ? error.message : 'Unable to create memory-sync thread';
      return reply.code(400).send({ error: message });
    }
  });

  app.post<{
    Body: { title?: string };
  }>('/threads/auto-bind-mobile', async (request, reply) => {
    try {
      const binding = await service.bindMobileContextByTitle(request.body?.title || '手机版对话');
      if (!binding) {
        return reply.code(404).send({ error: 'Mobile-context thread not found' });
      }
      return binding;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to bind mobile-context thread';
      return reply.code(400).send({ error: message });
    }
  });

  app.post<{
    Body: { bindingType: BindingType; threadId?: string; threadUrl?: string; title?: string };
  }>('/threads/bind', async (request) =>
    service.bindThread(request.body.bindingType, {
      id: request.body.threadId,
      threadUrl: request.body.threadUrl,
      url: request.body.threadUrl,
      title: request.body.title,
    }),
  );

  app.post<{ Body: StableMemorySyncRequest }>('/sync/stable-memory', async (request) =>
    service.syncStableMemory(request.body),
  );

  app.post<{ Body: MobileBriefingRequest }>('/sync/mobile-briefing', async (request) =>
    service.syncMobileBriefing(request.body),
  );

  app.post<{
    Body: { kind: RunNowRequestKind };
  }>('/sync/run-now', async (request, reply) => {
    try {
      const kind = normalizeAutoSyncKind(request.body.kind);
      await deps.syncManager.runNow(kind);
      return {
        ok: true,
        kind,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Run-now sync failed';
      return reply.code(400).send({ ok: false, error: message });
    }
  });

  app.post<{ Body: QueryInjectRequest }>('/inject/query', async (request) => service.injectQuery(request.body));

  app.post<{ Body: SendExperimentRequest }>('/debug/send-experiment', async (request, reply) => {
    try {
      return await service.sendExperiment(request.body);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Experiment send failed';
      return reply.code(400).send({ accepted: false, error: message });
    }
  });

  app.post<{ Body: ReminderSyncRequest }>('/reminders/sync', async (request) => service.syncReminders(request.body));

  // 随手记同步 API
  app.post<{ Body: MemoSyncRequest }>('/memo/sync', async (request) => service.syncMemo(request.body));

  // 随手记格式的长期记忆同步
  app.post<{ Body: StableMemorySyncRequest }>('/memo/stable-memory', async (request) =>
    service.syncStableMemoryAsMemo(request.body),
  );

  // 随手记格式的提醒同步
  app.post<{ Body: ReminderSyncRequest }>('/memo/reminders', async (request) =>
    service.syncRemindersAsMemo(request.body),
  );

  // 分类测试 API
  app.post<{ Body: { text: string } }>('/memo/classify', async (request) => {
    const { classifyMessage, extractMemoContent } = await import('./memoClassifier.js');
    const classification = classifyMessage(request.body.text);
    const metadata = extractMemoContent(request.body.text, classification.type);
    return {
      ...classification,
      metadata,
    };
  });

  return app;
}
