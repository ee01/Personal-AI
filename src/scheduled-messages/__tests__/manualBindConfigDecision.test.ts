import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getManualBindConfigDiff,
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

test('manual bind decision pauses when same-sheet configs differ without reliable freshness', () => {
  const decision = getManualBindDecision({
    localConfig: {
      ...baseConfig,
      webAppUrl: 'https://script.google.com/macros/s/local/exec',
    },
    sheetConfig: {
      ...baseConfig,
      webAppUrl: 'https://script.google.com/macros/s/sheet/exec',
    },
    canonicalSheetUrl: baseConfig.sheetUrl,
    writeMode: 'storage',
  });

  assert.equal(decision?.kind, 'content-different');
  assert.equal(decision?.writeMode, 'storage');
});

test('manual bind decision trusts newer Sheet config even when contents differ', () => {
  const decision = getManualBindDecision({
    localConfig: {
      ...baseConfig,
      webAppUrl: 'https://script.google.com/macros/s/local/exec',
      last_sync_time: '2026-05-12T08:00:00.000Z',
    },
    sheetConfig: {
      ...baseConfig,
      webAppUrl: 'https://script.google.com/macros/s/sheet/exec',
      last_sync_time: '2026-05-12T09:00:00.000Z',
    },
    canonicalSheetUrl: baseConfig.sheetUrl,
    writeMode: 'storage',
  });

  assert.equal(decision, null);
});

test('manual bind config diff summarizes changed recovery fields without exposing secrets', () => {
  assert.deepEqual(
    getManualBindConfigDiff(
      {
        ...baseConfig,
        webAppUrl: 'https://script.google.com/macros/s/local/exec',
        messagesSheetId: 101,
        botAutomation: {
          executorRule: {
            ruleId: 'executor-rule',
            ruleName: 'Executor',
            webhookUrl: 'https://jira.example.com/rest/cb-automation/latest/hooks/local-webhook-secret',
            projectKey: 'MTR',
            jiraUrl: 'https://jira.example.com',
            createdAt: '2026-05-12T06:00:00.000Z',
          },
          timelineSyncRule: {
            ruleId: 'timeline-rule',
            ruleName: 'Timeline',
            webhookUrl: 'https://jira.example.com/rest/cb-automation/latest/hooks/local-timeline-secret',
            projectKey: 'MTR',
            jiraUrl: 'https://jira.example.com',
            createdAt: '2026-05-12T06:00:00.000Z',
          },
        },
        ringCentralSender: {
          enabled: true,
          clientId: 'local-client',
          clientSecret: 'local-secret',
          jwt: 'local-jwt',
        },
      },
      {
        ...baseConfig,
        webAppUrl: 'https://script.google.com/macros/s/sheet/exec',
        messagesSheetId: 202,
        botAutomation: {
          executorRule: {
            ruleId: 'executor-rule',
            ruleName: 'Executor',
            webhookUrl: 'https://jira.example.com/rest/cb-automation/latest/hooks/sheet-webhook-secret',
            projectKey: 'MTR',
            jiraUrl: 'https://jira.example.com',
            createdAt: '2026-05-12T06:00:00.000Z',
          },
          timelineSyncRule: {
            ruleId: 'timeline-rule',
            ruleName: 'Timeline',
            webhookUrl: 'https://jira.example.com/rest/cb-automation/latest/hooks/sheet-timeline-secret',
            projectKey: 'MTR',
            jiraUrl: 'https://jira.example.com',
            createdAt: '2026-05-12T06:00:00.000Z',
          },
        },
        ringCentralSender: {
          enabled: false,
          clientId: 'sheet-client',
          clientSecret: 'sheet-secret',
          jwt: 'sheet-jwt',
        },
      },
    ),
    [
      {
        label: 'Web App URL',
        localValue: 'https://script.google.com/macros/s/local/exec',
        sheetValue: 'https://script.google.com/macros/s/sheet/exec',
      },
      {
        label: 'Messages 子表 ID',
        localValue: '101',
        sheetValue: '202',
      },
      {
        label: 'Bot 执行 Webhook',
        localValue: '已配置（值不同）',
        sheetValue: '已配置（值不同）',
      },
      {
        label: 'Timeline Sync Webhook',
        localValue: '已配置（值不同）',
        sheetValue: '已配置（值不同）',
      },
      {
        label: 'RingCentral 发送',
        localValue: '启用',
        sheetValue: '未启用',
      },
      {
        label: 'RingCentral Client ID',
        localValue: 'local-client',
        sheetValue: 'sheet-client',
      },
      {
        label: 'RingCentral Client Secret',
        localValue: '已配置（值不同）',
        sheetValue: '已配置（值不同）',
      },
      {
        label: 'RingCentral JWT',
        localValue: '已配置（值不同）',
        sheetValue: '已配置（值不同）',
      },
    ],
  );
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
