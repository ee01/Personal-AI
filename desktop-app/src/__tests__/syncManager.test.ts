import assert from 'node:assert/strict';
import test from 'node:test';

import { BridgeSyncManager } from '../syncManager.js';

function createSettingsStore() {
  return {
    subscribe: () => () => undefined,
    getSettings: () => ({
      memoryServiceBaseUrl: 'http://127.0.0.1:3210',
      memoryServiceUserId: 'tester',
      autoSync: true,
      pollIntervalMs: 300_000,
      stableMemoryIntervalMs: 43_200_000,
      mobileBriefingIntervalMs: 14_400_000,
      reminderSyncIntervalMs: 900_000,
    }),
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

  assert.deepEqual(result, { status: 'succeeded' });
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

  assert.deepEqual(result, { status: 'succeeded' });
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
            bodyMd: scenario === 'notice_sync' ? '- No notices.' : '- 跟进周报',
            itemCount: scenario === 'notice_sync' ? 0 : 1,
            sourceRefs:
              scenario === 'notice_sync'
                ? []
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

  assert.deepEqual(calls, [
    'render:todo_sync',
    'bridge:todo-memo',
    'render:notice_sync',
  ]);
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
      {
        id: 'job-notice_sync',
        status: 'skipped',
        errorMessage: 'No notices to sync',
      },
    ],
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
  });
  assert.equal(manager.getSnapshot().recentAttempts.length, 1);
  assert.deepEqual(
    {
      kind: manager.getSnapshot().recentAttempts[0].kind,
      trigger: manager.getSnapshot().recentAttempts[0].trigger,
      status: manager.getSnapshot().recentAttempts[0].status,
      errorMessage: manager.getSnapshot().recentAttempts[0].errorMessage,
    },
    {
      kind: 'stable_memory',
      trigger: 'manual',
      status: 'skipped',
      errorMessage: 'No stable memory items to sync',
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
