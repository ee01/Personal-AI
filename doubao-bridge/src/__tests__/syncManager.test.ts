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

test('runNow uses memo sync flows for stable memory and reminders', async () => {
  const calls: string[] = [];
  const memoryClient = {
    isEnabled: () => true,
    renderContextPackage: async ({ scenario }: { scenario: string }) => {
      calls.push(`render:${scenario}`);
      return {
        provider: 'doubao',
        scenario,
        packages: [
          {
            title: 'Test Package',
            kind: 'note',
            bodyMd: '- remember this',
            sourceRefs: [],
          },
        ],
      };
    },
    reportSyncJob: async () => undefined,
  };
  const bridgeService = {
    syncStableMemoryAsMemo: async () => {
      calls.push('bridge:stable-memo');
      return { accepted: true, kind: 'stable_memory', targetBindingType: 'memory_sync', transcript: '', sentAt: new Date().toISOString() };
    },
    syncStableMemory: async () => {
      calls.push('bridge:stable-legacy');
      return { accepted: true, kind: 'stable_memory', targetBindingType: 'memory_sync', transcript: '', sentAt: new Date().toISOString() };
    },
    syncMobileBriefing: async () => {
      calls.push('bridge:mobile');
      return { accepted: true, kind: 'mobile_briefing', targetBindingType: 'mobile_context', transcript: '', sentAt: new Date().toISOString() };
    },
    syncRemindersAsMemo: async () => {
      calls.push('bridge:reminder-memo');
      return { accepted: true, kind: 'reminder_sync', targetBindingType: 'mobile_context', transcript: '', sentAt: new Date().toISOString() };
    },
    syncReminders: async () => {
      calls.push('bridge:reminder-legacy');
      return { accepted: true, kind: 'reminder_sync', targetBindingType: 'mobile_context', transcript: '', sentAt: new Date().toISOString() };
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

  await manager.runNow('stable_memory');
  await manager.runNow('reminder_sync');

  assert.deepEqual(calls, [
    'render:stable_memory',
    'bridge:stable-memo',
    'render:reminder_sync',
    'bridge:reminder-memo',
  ]);
});
