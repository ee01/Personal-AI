import test from 'node:test';
import assert from 'node:assert/strict';

import { probeTaskCenterLevels } from '../taskCenterLevels.js';

test('recognizes an existing L2 cache that uses sheetId, not spreadsheetId', () => {
  const probed = probeTaskCenterLevels({
    scheduledMessagesConfig: {
      sheetId: '1abcSheet',
      webAppUrl: 'https://script.google.com/macros/s/xxx/exec',
      botAutomation: {
        executorRule: {
          ruleId: '2154',
          ruleName: '[Esone] Scheduled Messages',
          webhookUrl: 'https://script.example/exec',
          projectKey: 'MTR',
          jiraUrl: 'https://jira.example.com',
          createdAt: '2026-05-08T00:00:00.000Z',
        },
      },
    },
  });

  assert.equal(probed.cloudLaneAvailable, true);
  assert.equal(probed.sheetId, '1abcSheet');
  assert.equal(probed.cloudBotConfigured, true);
  assert.equal(probed.botConfigured, false);
  assert.equal(probed.asmeConfigured, false);
});

test('does not treat a missing Sheet as Level 2 even if spreadsheetId was expected', () => {
  const probed = probeTaskCenterLevels({
    scheduledMessagesConfig: { webAppUrl: 'https://script.google.com/macros/s/xxx/exec' },
  });
  assert.equal(probed.cloudLaneAvailable, false);
});

test('unlocks home-lane Bot from memory-service runtime, not Jira executor rules', () => {
  const probed = probeTaskCenterLevels({
    scheduledMessagesConfig: {
      sheetId: '1abcSheet',
      botAutomation: {
        executorRule: {
          ruleId: '2154',
          ruleName: 'executor',
          webhookUrl: 'https://script.example/exec',
          projectKey: 'MTR',
          jiraUrl: 'https://jira.example.com',
          createdAt: '2026-05-08T00:00:00.000Z',
        },
      },
    },
    runtime: { botTokenConfigured: true, botId: '4700372020@37439510.bot.glip.net' },
  });
  assert.equal(probed.cloudBotConfigured, true);
  assert.equal(probed.botConfigured, true);
});
