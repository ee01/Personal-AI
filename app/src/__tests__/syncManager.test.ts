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
      supportedScenarios: ['stable_memory', 'mobile_briefing', 'todo_sync', 'notice_sync', 'reminder_sync'],
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
      return { accepted: true, kind: 'stable_memory', targetBindingType: 'memory_sync', transcript: '', sentAt: new Date().toISOString() };
    },
    syncMobileBriefing: async () => {
      calls.push('bridge:mobile');
      return { accepted: true, kind: 'mobile_briefing', targetBindingType: 'mobile_context', transcript: '', sentAt: new Date().toISOString() };
    },
    syncTodosAsMemo: async () => {
      calls.push('bridge:todo-memo');
      return { accepted: true, kind: 'todo_sync', targetBindingType: 'mobile_context', transcript: '', sentAt: new Date().toISOString() };
    },
    syncNotices: async () => {
      calls.push('bridge:notice');
      return { accepted: true, kind: 'notice_sync', targetBindingType: 'mobile_context', transcript: '', sentAt: new Date().toISOString() };
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

  await manager.runNow('reminder_sync');

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
      return { accepted: true, kind: 'todo_sync', targetBindingType: 'mobile_context', transcript: '', sentAt: new Date().toISOString() };
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

  await manager.runNow('reminder_sync');

  assert.deepEqual(calls, [
    'render:reminder_sync',
    'bridge:todo-memo',
  ]);
});
