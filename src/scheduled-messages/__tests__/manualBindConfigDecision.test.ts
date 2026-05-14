import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getManualBindDecision,
  getManualBindRestoreScope,
} from '../manualBindConfigDecision.js';
import type { SheetConfig } from '../types.js';

const baseConfig: SheetConfig = {
  sheetId: 'sheet-123',
  sheetUrl: 'https://docs.google.com/spreadsheets/d/sheet-123/edit',
  sheet_version: '2.7',
  created_by: 'Personal AI Extension',
  created_at: '2026-05-12T06:00:00.000Z',
};

test('manual bind decision pauses when local config is newer on the same Sheet', () => {
  const decision = getManualBindDecision({
    localConfig: {
      ...baseConfig,
      last_sync_time: '2026-05-12T08:00:00.000Z',
    },
    sheetConfig: {
      ...baseConfig,
      last_sync_time: '2026-05-12T07:00:00.000Z',
    },
    canonicalSheetUrl: baseConfig.sheetUrl,
    writeMode: 'storage',
  });

  assert.equal(decision?.kind, 'local-newer');
  assert.equal(decision?.writeMode, 'storage');
});

test('manual bind decision pauses before switching to a different maintenance Sheet', () => {
  const decision = getManualBindDecision({
    localConfig: {
      ...baseConfig,
      last_sync_time: '2026-05-12T08:00:00.000Z',
    },
    sheetConfig: {
      ...baseConfig,
      sheetId: 'sheet-456',
      sheetUrl: 'https://docs.google.com/spreadsheets/d/sheet-456/edit',
      last_sync_time: '2026-05-12T09:00:00.000Z',
    },
    canonicalSheetUrl: 'https://docs.google.com/spreadsheets/d/sheet-456/edit',
    writeMode: 'sync',
  });

  assert.equal(decision?.kind, 'different-sheet');
  assert.equal(decision?.localConfig.sheetId, 'sheet-123');
  assert.equal(decision?.sheetConfig.sheetId, 'sheet-456');
  assert.equal(decision?.writeMode, 'sync');
});

test('manual bind decision continues when Sheet config is current enough', () => {
  const decision = getManualBindDecision({
    localConfig: {
      ...baseConfig,
      last_sync_time: '2026-05-12T08:00:00.000Z',
    },
    sheetConfig: {
      ...baseConfig,
      last_sync_time: '2026-05-12T09:00:00.000Z',
    },
    canonicalSheetUrl: baseConfig.sheetUrl,
    writeMode: 'storage',
  });

  assert.equal(decision, null);
});

test('manual bind restore scope summarizes cross-device config areas', () => {
  assert.deepEqual(
    getManualBindRestoreScope({
      sheetId: 'sheet-123',
      sheetUrl: 'https://docs.google.com/spreadsheets/d/sheet-123/edit',
      webAppUrl: 'https://script.google.com/macros/s/deploy/exec',
      minute_trigger_id: 'minute-trigger',
      messagesSheetId: 101,
      botAutomation: {
        executorRule: {
          ruleId: 'executor-rule',
          ruleName: 'Executor',
          webhookUrl: 'https://example.com',
          projectKey: 'MTR',
          jiraUrl: 'https://jira.example.com',
          createdAt: '2026-05-12T06:00:00.000Z',
        },
      },
    }),
    [
      '维护表绑定',
      'Apps Script 与 Web App',
      '定时触发器',
      'Bot Automation 规则',
      'Messages / Logs 子表定位',
    ],
  );
});
