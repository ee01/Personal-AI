import Fastify from 'fastify';
import type { FastifyReply, FastifyRequest } from 'fastify';

import type { BridgeConfig } from './config.js';
import { BridgeMemoryServiceClient } from './memoryServiceClient.js';
import { applyBridgeSettingsToConfig, BridgeSettingsStore, type BridgeSettingsPayload, type BridgeUserSettings } from './settings.js';
import type { BridgeSyncManager, BridgeSyncManagerSnapshot } from './syncManager.js';
import type {
  AutoSyncKind,
  BindingType,
  BridgeBlockingReason,
  BridgeStatus,
  BridgeSyncReadiness,
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

async function buildStatus(
  service: DoubaoBridgeService,
  deps: BridgeServerDependencies,
): Promise<BridgeStatus> {
  const baseStatus = await service.getStatus();
  const syncSnapshot = deps.syncManager.getSnapshot();
  const settingsPayload = deps.settingsStore.getPayload();
  const blockingReasons = buildBlockingReasons(settingsPayload.effective, baseStatus);

  return {
    ...baseStatus,
    appVersion: deps.version,
    memoryServiceConfigured: Boolean(
      settingsPayload.effective.memoryServiceBaseUrl && settingsPayload.effective.memoryServiceUserId,
    ),
    autoSyncEnabled: settingsPayload.effective.autoSync,
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

  return app;
}
