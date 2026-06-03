import assert from 'node:assert/strict';
import test from 'node:test';

import { BridgeSyncManager } from '../syncManager.js';
import type { BridgeSyncAttemptLogEntry } from '../types.js';

function createSettingsStore(overrides: Record<string, unknown> = {}) {
  const settings = {
    memoryServiceBaseUrl: 'http://127.0.0.1:3210',
    memoryServiceUserId: 'tester',
    autoSync: true,
    pollIntervalMs: 300_000,
    stableMemoryIntervalMs: 43_200_000,
    mobileBriefingIntervalMs: 14_400_000,
    reminderSyncIntervalMs: 900_000,
    reminderDailyDigestEnabled: false,
    reminderDailyDigestTime: '09:00',
    reminderDedupSameDay: true,
    ...overrides,
  };
  return {
    subscribe: () => () => undefined,
    getSettings: () => settings,
  };
}

test('runNow uses todo_sync and notice_sync when the backend supports them', async () => {
  const calls: string[] = [];
  const deliveryEvents: Array<{
    sourceRef: string;
    lane: string;
    channel: string;
    status: string;
    error?: string;
  }> = [];
  const memoryClient = {
    isEnabled: () => true,
    getProviderCapabilities: async () => ({
      provider: 'doubao',
      supportedScenarios: [
        'stable_memory',
        'mobile_briefing',
        'todo_sync',
        'notice_sync',
        'reminder_sync',
      ],
    }),
    renderContextPackage: async ({ scenario }: { scenario: string }) => {
      calls.push(`render:${scenario}`);
      if (scenario === 'notice_sync') {
        return {
          provider: 'doubao',
          scenario,
          packages: [
            {
              title: 'Notice Digest',
              kind: 'notice_digest',
              bodyMd: '- Weekly Report Ready - Your weekly report is ready',
              sourceRefs: ['notification:notif-notice-1'],
            },
          ],
        };
      }
      return {
        provider: 'doubao',
        scenario,
        packages: [
          {
            title: 'Todo Digest',
            kind: scenario === 'todo_sync' ? 'todo_digest' : 'reminder_digest',
            bodyMd: '- 跟进周报',
            sourceRefs: ['proposed_action:action-1'],
          },
        ],
      };
    },
    reportSyncJob: async () => undefined,
    reportNotificationDelivery: async (
      events: Array<{
        sourceRef: string;
        lane: string;
        channel: string;
        status: string;
        error?: string;
      }>,
    ) => {
      deliveryEvents.push(...events);
    },
  };
  const bridgeService = {
    syncStableMemoryAsMemo: async () => {
      calls.push('bridge:stable-memo');
      return {
        accepted: true,
        kind: 'stable_memory',
        targetBindingType: 'memory_sync',
        transcript: '',
        sentAt: new Date().toISOString(),
      };
    },
    syncMobileBriefing: async () => {
      calls.push('bridge:mobile');
      return {
        accepted: true,
        kind: 'mobile_briefing',
        targetBindingType: 'mobile_context',
        transcript: '',
        sentAt: new Date().toISOString(),
      };
    },
    syncTodosAsMemo: async () => {
      calls.push('bridge:todo-memo');
      return {
        accepted: true,
        kind: 'todo_sync',
        targetBindingType: 'mobile_context',
        transcript: '',
        sentAt: new Date().toISOString(),
      };
    },
    syncNotices: async () => {
      calls.push('bridge:notice');
      return {
        accepted: true,
        kind: 'notice_sync',
        targetBindingType: 'mobile_context',
        transcript: '',
        sentAt: new Date().toISOString(),
      };
    },
  };

  const manager = new BridgeSyncManager(
    {
      provider: 'doubao',
    } as any,
    createSettingsStore() as any,
    memoryClient as any,
    bridgeService as any,
  );

  const result = await manager.runNow('reminder_sync');

  assert.equal(result.status, 'succeeded');
  assert.deepEqual(result.packageKinds, ['todo_digest', 'notice_digest']);
  assert.equal(result.sourceRefCount, 2);
  assert.deepEqual(calls, [
    'render:todo_sync',
    'bridge:todo-memo',
    'render:notice_sync',
    'bridge:notice',
  ]);
  assert.deepEqual(deliveryEvents, [
    {
      sourceRef: 'proposed_action:action-1',
      lane: 'todo',
      channel: 'doubao',
      status: 'delivered',
      error: undefined,
    },
    {
      sourceRef: 'notification:notif-notice-1',
      lane: 'notice',
      channel: 'doubao',
      status: 'delivered',
      error: undefined,
    },
  ]);
});

test('auto reminder sync renders only new todo items with incremental delivery mode', async () => {
  const calls: string[] = [];
  const memoryClient = {
    isEnabled: () => true,
    getProviderCapabilities: async () => ({
      provider: 'doubao',
      supportedScenarios: ['todo_sync', 'notice_sync', 'reminder_sync'],
    }),
    renderContextPackage: async ({
      scenario,
      deliveryMode,
    }: {
      scenario: string;
      deliveryMode?: string;
    }) => {
      calls.push(`render:${scenario}:${deliveryMode ?? 'default'}`);
      return {
        provider: 'doubao',
        scenario,
        packages:
          scenario === 'notice_sync'
            ? []
            : [
                {
                  title: 'Todo Digest',
                  kind: 'todo_digest',
                  bodyMd: '- 新待办',
                  itemCount: 1,
                  sourceRefs: ['proposed_action:new-action'],
                },
              ],
      };
    },
    reportSyncJob: async () => undefined,
    reportNotificationDelivery: async () => undefined,
  };
  const bridgeService = {
    getStatus: async () => ({
      authStatus: 'connected',
      bindings: {
        mobile_context: { threadId: 'mobile-thread' },
      },
    }),
    syncTodosAsMemo: async () => {
      calls.push('bridge:todo');
      return { accepted: true, threadId: 'mobile-thread' };
    },
    syncNotices: async () => {
      calls.push('bridge:notice');
      return { accepted: true, threadId: 'mobile-thread' };
    },
  };

  const manager = new BridgeSyncManager(
    {
      provider: 'doubao',
    } as any,
    createSettingsStore() as any,
    memoryClient as any,
    bridgeService as any,
  );
  (manager as any).syncState.mobileBriefing = Date.now();

  await manager.tick();

  assert.deepEqual(calls, [
    'render:todo_sync:incremental',
    'bridge:todo',
    'render:notice_sync:default',
  ]);
  assert.equal(
    manager.getSnapshot().recentAttempts[0].reminderDeliveryMode,
    'new_items',
  );
});

test('daily reminder digest sends the complete unfinished todo list without notices', async () => {
  const calls: string[] = [];
  const memoryClient = {
    isEnabled: () => true,
    getProviderCapabilities: async () => ({
      provider: 'doubao',
      supportedScenarios: ['todo_sync', 'notice_sync', 'reminder_sync'],
    }),
    renderContextPackage: async ({
      scenario,
      deliveryMode,
    }: {
      scenario: string;
      deliveryMode?: string;
    }) => {
      calls.push(`render:${scenario}:${deliveryMode ?? 'default'}`);
      return {
        provider: 'doubao',
        scenario,
        packages: [
          {
            title: 'Daily Todo Digest',
            kind: 'todo_digest',
            bodyMd: '- 历史未完成待办',
            itemCount: 1,
            sourceRefs: ['proposed_action:old-action'],
          },
        ],
      };
    },
    reportSyncJob: async () => undefined,
    reportNotificationDelivery: async () => undefined,
  };
  const bridgeService = {
    getStatus: async () => ({
      authStatus: 'connected',
      bindings: {
        mobile_context: { threadId: 'mobile-thread' },
      },
    }),
    syncTodosAsMemo: async () => {
      calls.push('bridge:todo');
      return { accepted: true, threadId: 'mobile-thread' };
    },
    syncNotices: async () => {
      calls.push('bridge:notice');
      return { accepted: true, threadId: 'mobile-thread' };
    },
  };

  const manager = new BridgeSyncManager(
    {
      provider: 'doubao',
    } as any,
    createSettingsStore({
      reminderDailyDigestEnabled: true,
      reminderDailyDigestTime: '00:00',
    }) as any,
    memoryClient as any,
    bridgeService as any,
  );
  (manager as any).syncState.mobileBriefing = Date.now();

  await manager.tick();

  assert.deepEqual(calls, ['render:todo_sync:daily_digest', 'bridge:todo']);
  assert.equal(
    manager.getSnapshot().recentAttempts[0].reminderDeliveryMode,
    'daily_digest',
  );
});

test('runNow keeps delivery provenance in recent sync attempts', async () => {
  const memoryClient = {
    isEnabled: () => true,
    renderContextPackage: async ({ scenario }: { scenario: string }) => ({
      provider: 'doubao',
      scenario,
      packages: [
        {
          title: 'Persona Core',
          kind: 'persona_core',
          bodyMd: '- Prefers concise updates',
          sourceRefs: ['profile_item:response_length'],
        },
      ],
      syncJob: {
        id: `job-${scenario}`,
        status: 'queued',
      },
    }),
    reportSyncJob: async () => undefined,
  };
  const bridgeService = {
    syncStableMemoryAsMemo: async () => ({
      accepted: true,
      kind: 'stable_memory',
      targetBindingType: 'memory_sync',
      threadId: 'thread-persona-1234567890',
      transcript: '',
      sentAt: new Date().toISOString(),
      transportUsed: 'dom',
      transportMode: 'playwright',
      transportFallbackReason: 'webpage_mcp send failed',
      verified: true,
      messageVisible: true,
      challengeDetected: false,
    }),
  };

  const manager = new BridgeSyncManager(
    {
      provider: 'doubao',
    } as any,
    createSettingsStore() as any,
    memoryClient as any,
    bridgeService as any,
  );

  const result = await manager.runNow('stable_memory');
  const [attempt] = manager.getSnapshot().recentAttempts;

  assert.equal(result.status, 'succeeded');
  assert.equal(result.externalThreadId, 'thread-persona-1234567890');
  assert.deepEqual(result.packageKinds, ['persona_core']);
  assert.equal(result.sourceRefCount, 1);
  assert.equal(result.verified, true);
  assert.equal(result.messageVisible, true);
  assert.equal(result.challengeDetected, false);
  assert.equal(result.transportMode, 'playwright');
  assert.equal(result.transportFallbackReason, 'webpage_mcp send failed');
  assert.equal(attempt.externalThreadId, 'thread-persona-1234567890');
  assert.deepEqual(attempt.packageKinds, ['persona_core']);
  assert.equal(attempt.sourceRefCount, 1);
  assert.equal(attempt.verified, true);
  assert.equal(attempt.messageVisible, true);
  assert.equal(attempt.challengeDetected, false);
  assert.equal(attempt.transportMode, 'playwright');
  assert.equal(
    attempt.transportFallbackReason,
    'webpage_mcp send failed',
  );
});

test('runNow falls back to reminder_sync when todo_sync is not supported', async () => {
  const calls: string[] = [];
  const memoryClient = {
    isEnabled: () => true,
    getProviderCapabilities: async () => ({
      provider: 'doubao',
      supportedScenarios: ['stable_memory', 'mobile_briefing', 'reminder_sync'],
    }),
    renderContextPackage: async ({ scenario }: { scenario: string }) => {
      calls.push(`render:${scenario}`);
      return {
        provider: 'doubao',
        scenario,
        packages: [
          {
            title: 'Todo Digest',
            kind: 'reminder_digest',
            bodyMd: '- 跟进周报',
            sourceRefs: ['notification:notif-todo-1'],
          },
        ],
      };
    },
    reportSyncJob: async () => undefined,
    reportNotificationDelivery: async () => undefined,
  };
  const bridgeService = {
    syncTodosAsMemo: async () => {
      calls.push('bridge:todo-memo');
      return {
        accepted: true,
        kind: 'todo_sync',
        targetBindingType: 'mobile_context',
        transcript: '',
        sentAt: new Date().toISOString(),
      };
    },
  };

  const manager = new BridgeSyncManager(
    {
      provider: 'doubao',
    } as any,
    createSettingsStore() as any,
    memoryClient as any,
    bridgeService as any,
  );

  const result = await manager.runNow('reminder_sync');

  assert.equal(result.status, 'succeeded');
  assert.deepEqual(result.packageKinds, ['reminder_digest']);
  assert.equal(result.sourceRefCount, 1);
  assert.deepEqual(calls, ['render:reminder_sync', 'bridge:todo-memo']);
});

test('runNow skips placeholder todo and notice digests when itemCount is 0', async () => {
  const calls: string[] = [];
  const reportedJobs: Array<{
    provider: string;
    id: string;
    payload: {
      status: string;
      errorMessage?: string;
      result?: Record<string, unknown>;
    };
  }> = [];
  const memoryClient = {
    isEnabled: () => true,
    getProviderCapabilities: async () => ({
      provider: 'doubao',
      supportedScenarios: [
        'stable_memory',
        'mobile_briefing',
        'todo_sync',
        'notice_sync',
        'reminder_sync',
      ],
    }),
    renderContextPackage: async ({ scenario }: { scenario: string }) => {
      calls.push(`render:${scenario}`);
      return {
        provider: 'doubao',
        scenario,
        packages: [
          {
            title: scenario === 'notice_sync' ? 'Notice Digest' : 'Todo Digest',
            kind: scenario === 'notice_sync' ? 'notice_digest' : 'todo_digest',
            bodyMd:
              scenario === 'notice_sync'
                ? '- No new notices.'
                : '- No pending todos.',
            itemCount: 0,
            sourceRefs: [],
          },
        ],
        syncJob: {
          id: `job-${scenario}`,
          status: 'queued',
        },
      };
    },
    reportSyncJob: async (provider: string, id: string, payload: any) => {
      reportedJobs.push({ provider, id, payload });
    },
    reportNotificationDelivery: async () => undefined,
  };
  const bridgeService = {
    syncTodosAsMemo: async () => {
      calls.push('bridge:todo-memo');
      return {
        accepted: true,
        kind: 'todo_sync',
        targetBindingType: 'mobile_context',
        transcript: '',
        sentAt: new Date().toISOString(),
      };
    },
    syncNotices: async () => {
      calls.push('bridge:notice');
      return {
        accepted: true,
        kind: 'notice_sync',
        targetBindingType: 'mobile_context',
        transcript: '',
        sentAt: new Date().toISOString(),
      };
    },
  };

  const manager = new BridgeSyncManager(
    {
      provider: 'doubao',
    } as any,
    createSettingsStore() as any,
    memoryClient as any,
    bridgeService as any,
  );

  const result = await manager.runNow('reminder_sync');

  assert.deepEqual(result, {
    status: 'skipped',
    errorMessage: 'No pending todos to sync / No notices to sync',
    packageKinds: ['todo_digest', 'notice_digest'],
    packageItemCount: 0,
    sourceRefCount: 0,
    reminderDeliveryMode: 'manual',
  });
  assert.deepEqual(calls, ['render:todo_sync', 'render:notice_sync']);
  assert.deepEqual(
    reportedJobs.map((job) => ({
      id: job.id,
      status: job.payload.status,
      errorMessage: job.payload.errorMessage,
    })),
    [
      {
        id: 'job-todo_sync',
        status: 'skipped',
        errorMessage: 'No pending todos to sync',
      },
      {
        id: 'job-notice_sync',
        status: 'skipped',
        errorMessage: 'No notices to sync',
      },
    ],
  );
});

test('runNow reports failed todo delivery and surfaces the send error', async () => {
  const calls: string[] = [];
  const deliveryEvents: Array<{
    sourceRef: string;
    lane: string;
    channel: string;
    status: string;
    error?: string;
  }> = [];
  const reportedJobs: Array<{
    id: string;
    payload: {
      status: string;
      errorMessage?: string;
    };
  }> = [];
  const memoryClient = {
    isEnabled: () => true,
    getProviderCapabilities: async () => ({
      provider: 'doubao',
      supportedScenarios: ['todo_sync', 'notice_sync', 'reminder_sync'],
    }),
    renderContextPackage: async ({ scenario }: { scenario: string }) => {
      calls.push(`render:${scenario}`);
      return {
        provider: 'doubao',
        scenario,
        packages: [
          {
            title: scenario === 'notice_sync' ? 'Notice Digest' : 'Todo Digest',
            kind: scenario === 'notice_sync' ? 'notice_digest' : 'todo_digest',
            bodyMd:
              scenario === 'notice_sync'
                ? '- Weekly Report Ready - Your weekly report is ready'
                : '- 跟进周报',
            itemCount: 1,
            sourceRefs:
              scenario === 'notice_sync'
                ? ['notification:notif-notice-pending']
                : ['proposed_action:action-failed'],
          },
        ],
        syncJob: {
          id: `job-${scenario}`,
          status: 'queued',
        },
      };
    },
    reportSyncJob: async (_provider: string, id: string, payload: any) => {
      reportedJobs.push({ id, payload });
    },
    reportNotificationDelivery: async (
      events: Array<{
        sourceRef: string;
        lane: string;
        channel: string;
        status: string;
        error?: string;
      }>,
    ) => {
      deliveryEvents.push(...events);
    },
  };
  const bridgeService = {
    syncTodosAsMemo: async () => {
      calls.push('bridge:todo-memo');
      return {
        accepted: false,
        kind: 'todo_sync',
        targetBindingType: 'mobile_context',
        transcript: '',
        sentAt: new Date().toISOString(),
        error: 'Doubao challenge detected before send',
      };
    },
    syncNotices: async () => {
      calls.push('bridge:notice');
      return {
        accepted: true,
        kind: 'notice_sync',
        targetBindingType: 'mobile_context',
        transcript: '',
        sentAt: new Date().toISOString(),
      };
    },
  };

  const manager = new BridgeSyncManager(
    {
      provider: 'doubao',
    } as any,
    createSettingsStore() as any,
    memoryClient as any,
    bridgeService as any,
  );

  await assert.rejects(
    () => manager.runNow('reminder_sync'),
    /Doubao challenge detected before send/,
  );

  assert.deepEqual(calls, ['render:todo_sync', 'bridge:todo-memo']);
  assert.deepEqual(deliveryEvents, [
    {
      sourceRef: 'proposed_action:action-failed',
      lane: 'todo',
      channel: 'doubao',
      status: 'failed',
      error: 'Doubao challenge detected before send',
    },
  ]);
  assert.deepEqual(
    reportedJobs.map((job) => ({
      id: job.id,
      status: job.payload.status,
      errorMessage: job.payload.errorMessage,
    })),
    [
      {
        id: 'job-todo_sync',
        status: 'failed',
        errorMessage: 'Doubao challenge detected before send',
      },
    ],
  );
});

test('runNow preserves the Doubao send error when delivery reporting fails', async () => {
  const calls: string[] = [];
  const memoryClient = {
    isEnabled: () => true,
    getProviderCapabilities: async () => ({
      provider: 'doubao',
      supportedScenarios: ['todo_sync', 'notice_sync', 'reminder_sync'],
    }),
    renderContextPackage: async ({ scenario }: { scenario: string }) => {
      calls.push(`render:${scenario}`);
      return {
        provider: 'doubao',
        scenario,
        packages: [
          {
            title: 'Todo Digest',
            kind: 'todo_digest',
            bodyMd: '- 跟进周报',
            itemCount: 1,
            sourceRefs: ['proposed_action:action-failed'],
          },
        ],
        syncJob: {
          id: `job-${scenario}`,
          status: 'queued',
        },
      };
    },
    reportSyncJob: async () => undefined,
    reportNotificationDelivery: async () => {
      throw new Error('delivery endpoint timeout');
    },
  };
  const bridgeService = {
    syncTodosAsMemo: async () => {
      calls.push('bridge:todo-memo');
      return {
        accepted: false,
        kind: 'todo_sync',
        targetBindingType: 'mobile_context',
        transcript: '',
        sentAt: new Date().toISOString(),
        error: 'Doubao challenge detected before send',
      };
    },
  };

  const manager = new BridgeSyncManager(
    {
      provider: 'doubao',
    } as any,
    createSettingsStore() as any,
    memoryClient as any,
    bridgeService as any,
  );

  await assert.rejects(
    () => manager.runNow('reminder_sync'),
    /Doubao challenge detected before send/,
  );

  const [attempt] = manager.getSnapshot().recentAttempts;
  assert.deepEqual(calls, ['render:todo_sync', 'bridge:todo-memo']);
  assert.equal(attempt.status, 'failed');
  assert.equal(attempt.errorMessage, 'Doubao challenge detected before send');
  assert.match(
    attempt.telemetryError || '',
    /Delivery report failed: delivery endpoint timeout/,
  );
});

test('runNow keeps successful delivery when sync job reporting fails', async () => {
  const memoryClient = {
    isEnabled: () => true,
    renderContextPackage: async ({ scenario }: { scenario: string }) => ({
      provider: 'doubao',
      scenario,
      packages: [
        {
          title: 'Persona Core',
          kind: 'persona_core',
          bodyMd: '- Prefers concise updates',
          sourceRefs: ['profile_item:response_length'],
        },
      ],
      syncJob: {
        id: `job-${scenario}`,
        status: 'queued',
      },
    }),
    reportSyncJob: async () => {
      throw new Error('sync job endpoint timeout');
    },
  };
  const bridgeService = {
    syncStableMemoryAsMemo: async () => ({
      accepted: true,
      kind: 'stable_memory',
      targetBindingType: 'memory_sync',
      transcript: '',
      sentAt: new Date().toISOString(),
    }),
  };

  const manager = new BridgeSyncManager(
    {
      provider: 'doubao',
    } as any,
    createSettingsStore() as any,
    memoryClient as any,
    bridgeService as any,
  );

  const result = await manager.runNow('stable_memory');
  const [attempt] = manager.getSnapshot().recentAttempts;

  assert.equal(result.status, 'succeeded');
  assert.match(
    result.telemetryError || '',
    /Sync job report failed: sync job endpoint timeout/,
  );
  assert.equal(attempt.status, 'succeeded');
  assert.match(
    attempt.telemetryError || '',
    /Sync job report failed: sync job endpoint timeout/,
  );
});

test('runNow skips placeholder mobile briefing when itemCount is 0', async () => {
  const calls: string[] = [];
  const reportedJobs: Array<{
    id: string;
    payload: {
      status: string;
      errorMessage?: string;
    };
  }> = [];
  const memoryClient = {
    isEnabled: () => true,
    renderContextPackage: async ({ scenario }: { scenario: string }) => {
      calls.push(`render:${scenario}`);
      return {
        provider: 'doubao',
        scenario,
        packages: [
          {
            title: 'Active Focus Digest',
            kind: 'active_focus_digest',
            bodyMd:
              '- No recent high-signal memories found in the freshness window.',
            itemCount: 0,
            sourceRefs: [],
          },
        ],
        syncJob: {
          id: `job-${scenario}`,
          status: 'queued',
        },
      };
    },
    reportSyncJob: async (_provider: string, id: string, payload: any) => {
      reportedJobs.push({ id, payload });
    },
  };
  const bridgeService = {
    syncMobileBriefing: async () => {
      calls.push('bridge:mobile');
      return {
        accepted: true,
        kind: 'mobile_briefing',
        targetBindingType: 'mobile_context',
        transcript: '',
        sentAt: new Date().toISOString(),
      };
    },
  };

  const manager = new BridgeSyncManager(
    {
      provider: 'doubao',
    } as any,
    createSettingsStore() as any,
    memoryClient as any,
    bridgeService as any,
  );

  const result = await manager.runNow('mobile_briefing');

  assert.deepEqual(result, {
    status: 'skipped',
    errorMessage: 'No recent memory highlights to sync',
    packageKinds: ['active_focus_digest'],
    packageItemCount: 0,
    sourceRefCount: 0,
  });
  assert.deepEqual(calls, ['render:mobile_briefing']);
  assert.deepEqual(
    reportedJobs.map((job) => ({
      id: job.id,
      status: job.payload.status,
      errorMessage: job.payload.errorMessage,
    })),
    [
      {
        id: 'job-mobile_briefing',
        status: 'skipped',
        errorMessage: 'No recent memory highlights to sync',
      },
    ],
  );
});

test('runNow skips mobile briefing metadata-only packages', async () => {
  const calls: string[] = [];
  const reportedJobs: Array<{
    id: string;
    payload: {
      status: string;
      errorMessage?: string;
    };
  }> = [];
  const memoryClient = {
    isEnabled: () => true,
    renderContextPackage: async ({ scenario }: { scenario: string }) => {
      calls.push(`render:${scenario}`);
      return {
        provider: 'doubao',
        scenario,
        packages: [
          {
            title: 'Active Focus Digest',
            kind: 'active_focus_digest',
            bodyMd: [
              '# Active Focus Digest',
              '> Freshness window: 7 day(s). Built from recent high-signal memories, profile updates, and reflections. Watch rules / concerned items are not treated as memory highlights.',
              '',
              '## Recent Memory Highlights',
              '> No recent high-signal memories found in the freshness window.',
              '',
              '## Recent Profile Signals',
              '> No recent profile signals found in the freshness window.',
              '',
              '## Recent Reflections',
              '> No recent reflections found.',
            ].join('\n'),
            itemCount: 1,
            sourceRefs: ['message:stale-placeholder'],
          },
        ],
        syncJob: {
          id: `job-${scenario}`,
          status: 'queued',
        },
      };
    },
    reportSyncJob: async (_provider: string, id: string, payload: any) => {
      reportedJobs.push({ id, payload });
    },
  };
  const bridgeService = {
    syncMobileBriefing: async () => {
      calls.push('bridge:mobile-briefing');
      return {
        accepted: true,
        kind: 'mobile_briefing',
        targetBindingType: 'mobile_context',
        transcript: '',
        sentAt: new Date().toISOString(),
      };
    },
  };

  const manager = new BridgeSyncManager(
    {
      provider: 'doubao',
    } as any,
    createSettingsStore() as any,
    memoryClient as any,
    bridgeService as any,
  );

  const result = await manager.runNow('mobile_briefing');

  assert.deepEqual(result, {
    status: 'skipped',
    errorMessage: 'No mobile briefing bullets extracted',
    packageKinds: ['active_focus_digest'],
    packageItemCount: 1,
    sourceRefCount: 1,
  });
  assert.deepEqual(calls, ['render:mobile_briefing']);
  assert.deepEqual(
    reportedJobs.map((job) => ({
      id: job.id,
      status: job.payload.status,
      errorMessage: job.payload.errorMessage,
    })),
    [
      {
        id: 'job-mobile_briefing',
        status: 'skipped',
        errorMessage: 'No mobile briefing bullets extracted',
      },
    ],
  );
});

test('runNow deduplicates mobile briefing bullets before sending', async () => {
  const calls: string[] = [];
  let sentBullets: string[] | undefined;
  const memoryClient = {
    isEnabled: () => true,
    renderContextPackage: async ({ scenario }: { scenario: string }) => {
      calls.push(`render:${scenario}`);
      return {
        provider: 'doubao',
        scenario,
        packages: [
          {
            title: 'Active Focus Digest',
            kind: 'active_focus_digest',
            bodyMd: [
              '- Project Alpha needs API review',
              '- Project Alpha needs API review.',
              '- 发布窗口需要今天确认',
            ].join('\n'),
            itemCount: 3,
            sourceRefs: ['message:alpha-1', 'message:release-1'],
          },
          {
            title: 'Recent Profile Signals',
            kind: 'active_focus_digest',
            bodyMd: [
              '- project alpha needs api review',
              '- 跟进 MTR-123 设计验收',
            ].join('\n'),
            itemCount: 2,
            sourceRefs: ['message:alpha-2', 'message:mtr-123'],
          },
        ],
        syncJob: {
          id: `job-${scenario}`,
          status: 'queued',
        },
      };
    },
    reportSyncJob: async () => undefined,
  };
  const bridgeService = {
    syncMobileBriefing: async (payload: { bullets: string[] }) => {
      calls.push('bridge:mobile-briefing');
      sentBullets = payload.bullets;
      return {
        accepted: true,
        kind: 'mobile_briefing',
        targetBindingType: 'mobile_context',
        threadId: 'mobile-thread',
        transcript: '',
        sentAt: new Date().toISOString(),
      };
    },
  };

  const manager = new BridgeSyncManager(
    {
      provider: 'doubao',
    } as any,
    createSettingsStore() as any,
    memoryClient as any,
    bridgeService as any,
  );

  const result = await manager.runNow('mobile_briefing');

  assert.equal(result.status, 'succeeded');
  assert.deepEqual(sentBullets, [
    'Project Alpha needs API review',
    '发布窗口需要今天确认',
    '跟进 MTR-123 设计验收',
  ]);
  assert.deepEqual(calls, ['render:mobile_briefing', 'bridge:mobile-briefing']);
});

test('runNow skips placeholder stable memory when itemCount is 0', async () => {
  const calls: string[] = [];
  const reportedJobs: Array<{
    id: string;
    payload: {
      status: string;
      errorMessage?: string;
    };
  }> = [];
  const memoryClient = {
    isEnabled: () => true,
    renderContextPackage: async ({ scenario }: { scenario: string }) => {
      calls.push(`render:${scenario}`);
      return {
        provider: 'doubao',
        scenario,
        packages: [
          {
            title: 'Persona Core',
            kind: 'persona_core',
            bodyMd: '- No stable profile items found.',
            itemCount: 0,
            sourceRefs: [],
          },
        ],
        syncJob: {
          id: `job-${scenario}`,
          status: 'queued',
        },
      };
    },
    reportSyncJob: async (_provider: string, id: string, payload: any) => {
      reportedJobs.push({ id, payload });
    },
  };
  const bridgeService = {
    syncStableMemoryAsMemo: async () => {
      calls.push('bridge:stable-memo');
      return {
        accepted: true,
        kind: 'stable_memory',
        targetBindingType: 'memory_sync',
        transcript: '',
        sentAt: new Date().toISOString(),
      };
    },
  };

  const manager = new BridgeSyncManager(
    {
      provider: 'doubao',
    } as any,
    createSettingsStore() as any,
    memoryClient as any,
    bridgeService as any,
  );

  const result = await manager.runNow('stable_memory');

  assert.deepEqual(result, {
    status: 'skipped',
    errorMessage: 'No stable memory items to sync',
    packageKinds: ['persona_core'],
    packageItemCount: 0,
    sourceRefCount: 0,
  });
  assert.deepEqual(calls, ['render:stable_memory']);
  assert.deepEqual(
    reportedJobs.map((job) => ({
      id: job.id,
      status: job.payload.status,
      errorMessage: job.payload.errorMessage,
    })),
    [
      {
        id: 'job-stable_memory',
        status: 'skipped',
        errorMessage: 'No stable memory items to sync',
      },
    ],
  );
});

test('tick still runs explorer scheduling when Doubao output sync is not ready', async () => {
  let explorerTicks = 0;
  const calls: string[] = [];
  const memoryClient = {
    isEnabled: () => true,
  };
  const bridgeService = {
    getStatus: async () => ({
      authStatus: 'needs_login',
      bindings: {},
    }),
    syncStableMemoryAsMemo: async () => {
      calls.push('bridge:stable-memo');
      return { accepted: true };
    },
    syncMobileBriefing: async () => {
      calls.push('bridge:mobile');
      return { accepted: true };
    },
    syncTodosAsMemo: async () => {
      calls.push('bridge:todo-memo');
      return { accepted: true };
    },
    syncNotices: async () => {
      calls.push('bridge:notice');
      return { accepted: true };
    },
  };
  const explorerManager = {
    tick: async () => {
      explorerTicks += 1;
    },
  };

  const manager = new BridgeSyncManager(
    {
      provider: 'doubao',
    } as any,
    createSettingsStore() as any,
    memoryClient as any,
    bridgeService as any,
    explorerManager as any,
  );

  await manager.tick();

  assert.equal(explorerTicks, 1);
  assert.deepEqual(calls, []);
});

test('tick records and clears auto-sync errors in the status snapshot', async () => {
  let failRender = true;
  const memoryClient = {
    isEnabled: () => true,
    getProviderCapabilities: async () => ({
      provider: 'doubao',
      supportedScenarios: ['stable_memory', 'mobile_briefing', 'reminder_sync'],
    }),
    renderContextPackage: async ({ scenario }: { scenario: string }) => {
      if (failRender) {
        throw new Error('Memory Service connection reset');
      }
      return {
        provider: 'doubao',
        scenario,
        packages: [],
      };
    },
    reportSyncJob: async () => undefined,
  };
  const bridgeService = {
    getStatus: async () => ({
      authStatus: 'connected',
      bindings: {
        memory_sync: { threadId: 'memory-thread' },
        mobile_context: { threadId: 'mobile-thread' },
      },
    }),
    syncStableMemoryAsMemo: async () => ({ accepted: true }),
    syncMobileBriefing: async () => ({ accepted: true }),
    syncTodosAsMemo: async () => ({ accepted: true }),
    syncNotices: async () => ({ accepted: true }),
  };

  const manager = new BridgeSyncManager(
    {
      provider: 'doubao',
    } as any,
    createSettingsStore() as any,
    memoryClient as any,
    bridgeService as any,
  );

  await manager.tick();
  assert.match(
    manager.getSnapshot().lastErrorMessage || '',
    /Memory Service connection reset/,
  );
  assert.ok(manager.getSnapshot().lastErrorAt);

  failRender = false;
  await manager.tick();
  assert.equal(manager.getSnapshot().lastErrorMessage, undefined);
  assert.equal(manager.getSnapshot().lastErrorAt, undefined);
});

test('runNow records recent manual sync attempts for audit display', async () => {
  let failRender = false;
  const memoryClient = {
    isEnabled: () => true,
    renderContextPackage: async ({ scenario }: { scenario: string }) => {
      if (failRender) {
        throw new Error('Memory Service timeout');
      }
      return {
        provider: 'doubao',
        scenario,
        packages: [
          {
            title: 'Persona Core',
            kind: 'persona_core',
            bodyMd: '- No stable profile items found.',
            itemCount: 0,
            sourceRefs: [],
          },
        ],
        syncJob: {
          id: `job-${scenario}`,
          status: 'queued',
        },
      };
    },
    reportSyncJob: async () => undefined,
  };
  const bridgeService = {
    syncStableMemoryAsMemo: async () => ({
      accepted: true,
      kind: 'stable_memory',
      targetBindingType: 'memory_sync',
      transcript: '',
      sentAt: new Date().toISOString(),
    }),
  };

  const manager = new BridgeSyncManager(
    {
      provider: 'doubao',
    } as any,
    createSettingsStore() as any,
    memoryClient as any,
    bridgeService as any,
  );

  const skipped = await manager.runNow('stable_memory');

  assert.deepEqual(skipped, {
    status: 'skipped',
    errorMessage: 'No stable memory items to sync',
    packageKinds: ['persona_core'],
    packageItemCount: 0,
    sourceRefCount: 0,
  });
  assert.equal(manager.getSnapshot().recentAttempts.length, 1);
  assert.deepEqual(
    {
      kind: manager.getSnapshot().recentAttempts[0].kind,
      trigger: manager.getSnapshot().recentAttempts[0].trigger,
      status: manager.getSnapshot().recentAttempts[0].status,
      errorMessage: manager.getSnapshot().recentAttempts[0].errorMessage,
      packageKinds: manager.getSnapshot().recentAttempts[0].packageKinds,
      packageItemCount:
        manager.getSnapshot().recentAttempts[0].packageItemCount,
      sourceRefCount: manager.getSnapshot().recentAttempts[0].sourceRefCount,
    },
    {
      kind: 'stable_memory',
      trigger: 'manual',
      status: 'skipped',
      errorMessage: 'No stable memory items to sync',
      packageKinds: ['persona_core'],
      packageItemCount: 0,
      sourceRefCount: 0,
    },
  );

  failRender = true;
  await assert.rejects(
    () => manager.runNow('stable_memory'),
    /Memory Service timeout/,
  );

  const [latestAttempt, previousAttempt] = manager.getSnapshot().recentAttempts;
  assert.equal(latestAttempt.kind, 'stable_memory');
  assert.equal(latestAttempt.trigger, 'manual');
  assert.equal(latestAttempt.status, 'failed');
  assert.equal(latestAttempt.errorMessage, 'Memory Service timeout');
  assert.equal(previousAttempt.status, 'skipped');
  assert.ok(latestAttempt.startedAt);
  assert.ok(latestAttempt.completedAt);
  assert.ok(latestAttempt.durationMs >= 0);
});

test('sync attempt audit log is restored and persisted after new attempts', async () => {
  const restoredAttempt: BridgeSyncAttemptLogEntry = {
    id: 'restored-stable-memory',
    kind: 'stable_memory' as const,
    trigger: 'auto' as const,
    status: 'failed' as const,
    startedAt: '2026-05-15T10:00:00.000Z',
    completedAt: '2026-05-15T10:00:02.000Z',
    durationMs: 2000,
    errorMessage: 'Previous app run hit Doubao challenge',
    packageKinds: ['persona_core'],
    sourceRefCount: 1,
    verified: false,
    challengeDetected: true,
  };
  const persisted: BridgeSyncAttemptLogEntry[][] = [];
  const memoryClient = {
    isEnabled: () => true,
    renderContextPackage: async ({ scenario }: { scenario: string }) => ({
      provider: 'doubao',
      scenario,
      packages: [
        {
          title: 'Persona Core',
          kind: 'persona_core',
          bodyMd: '- No stable profile items found.',
          itemCount: 0,
          sourceRefs: [],
        },
      ],
      syncJob: {
        id: `job-${scenario}`,
        status: 'queued',
      },
    }),
    reportSyncJob: async () => undefined,
  };
  const bridgeService = {
    syncStableMemoryAsMemo: async () => ({
      accepted: true,
      kind: 'stable_memory',
      targetBindingType: 'memory_sync',
      transcript: '',
      sentAt: new Date().toISOString(),
    }),
  };

  const manager = new BridgeSyncManager(
    {
      provider: 'doubao',
    } as any,
    createSettingsStore() as any,
    memoryClient as any,
    bridgeService as any,
    undefined,
    undefined,
    {
      initialAttempts: [restoredAttempt],
      onRecentAttemptsChanged: (attempts) => {
        persisted.push([...attempts]);
      },
    },
  );

  assert.deepEqual(manager.getSnapshot().recentAttempts, [restoredAttempt]);

  await manager.runNow('stable_memory');

  const attempts = manager.getSnapshot().recentAttempts;
  assert.equal(attempts.length, 2);
  assert.equal(attempts[0].status, 'skipped');
  assert.equal(attempts[0].errorMessage, 'No stable memory items to sync');
  assert.equal(attempts[1].id, 'restored-stable-memory');
  assert.equal(persisted.length, 1);
  assert.deepEqual(
    persisted[0].map((attempt) => attempt.id),
    attempts.map((attempt) => attempt.id),
  );
});
