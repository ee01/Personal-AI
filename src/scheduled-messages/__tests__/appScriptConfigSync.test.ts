import test from 'node:test';
import assert from 'node:assert/strict';

import { ConfigSyncService } from '../ConfigSyncService.js';

type FetchCall = {
  url: string;
  init?: RequestInit;
};

const originalFetch = globalThis.fetch;
const originalChrome = (globalThis as any).chrome;
const originalDate = globalThis.Date;

function installFetchMock(handler: (url: string, init?: RequestInit) => Promise<Response> | Response) {
  const calls: FetchCall[] = [];

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    calls.push({ url, init });
    return handler(url, init);
  }) as typeof fetch;

  return calls;
}

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  (globalThis as any).Date = originalDate;
  (globalThis as any).chrome = originalChrome;
});

function installDateMock(isoValues: string[]) {
  let constructorCalls = 0;

  function MockDate(this: unknown, value?: string | number | Date) {
    if (!(this instanceof MockDate)) {
      return originalDate();
    }

    if (arguments.length === 0) {
      const isoValue = isoValues[Math.min(constructorCalls, isoValues.length - 1)];
      constructorCalls += 1;
      return new originalDate(isoValue);
    }

    return new originalDate(value as any);
  }

  MockDate.UTC = originalDate.UTC;
  MockDate.parse = originalDate.parse;
  MockDate.now = () =>
    new originalDate(isoValues[Math.min(constructorCalls, isoValues.length - 1)]).getTime();
  MockDate.prototype = originalDate.prototype;

  (globalThis as any).Date = MockDate;
}

test('ConfigSyncService reads App Script deployment metadata from Config sheet', async () => {
  const calls = installFetchMock(() =>
    new Response(
      JSON.stringify({
        values: [
          ['web_app_url', 'https://script.google.com/macros/s/deploy/exec'],
          ['script_id', 'script-123'],
          ['deployment_id', 'deployment-456'],
          ['sheet_version', '2.7'],
          ['app_script_version', '2.6.1'],
          ['app_script_last_updated', '2026-04-03'],
          ['created_by', 'Personal AI Extension'],
          ['created_at', '2026-04-30 12:00:00'],
          ['last_sync_action', 'app_script_metadata_update'],
        ],
      }),
      { status: 200 },
    ),
  );

  const service = new ConfigSyncService('token');
  const config = await service.readConfigFromSheet('sheet-123');

  assert.match(calls[0].url, /\/values\/Config!A2:B$/);
  assert.equal(config.scriptId, 'script-123');
  assert.equal(config.deploymentId, 'deployment-456');
  assert.equal(config.appScriptVersion, '2.6.1');
  assert.equal(config.appScriptLastUpdated, '2026-04-03');
  assert.equal(config.last_sync_action, 'app_script_metadata_update');
});

test('ConfigSyncService keeps canonical Config keys ahead of stale duplicate aliases', async () => {
  installFetchMock(() =>
    new Response(
      JSON.stringify({
        values: [
          ['web_app_url', 'https://script.google.com/macros/s/current/exec'],
          ['web_app_url', 'https://script.google.com/macros/s/stale/exec'],
          ['deployment_id', 'deployment-current'],
          ['deploymentId', 'deployment-stale'],
          ['app_script_version', '2.8.0'],
          ['appScriptVersion', '2.7.0'],
          ['messages_sheet_id', '101'],
          ['messages_sheet_id', '202'],
          ['bot_automation_executor_rule_id', 'executor-current'],
          ['bot_automation_executor_rule_id', 'executor-stale'],
          ['sheet_version', '2.7'],
          ['created_by', 'Personal AI Extension'],
          ['created_at', '2026-04-30 12:00:00'],
        ],
      }),
      { status: 200 },
    ),
  );

  const service = new ConfigSyncService('token');
  const config = await service.readConfigFromSheet('sheet-123');

  assert.equal(config.webAppUrl, 'https://script.google.com/macros/s/current/exec');
  assert.equal(config.deploymentId, 'deployment-current');
  assert.equal(config.appScriptVersion, '2.8.0');
  assert.equal(config.messagesSheetId, 101);
  assert.equal(config.botAutomation?.executorRule?.ruleId, 'executor-current');
});

test('ConfigSyncService reads the newest duplicate last_sync_time from Config sheet', async () => {
  installFetchMock(() =>
    new Response(
      JSON.stringify({
        values: [
          ['last_sync_time', '2026-05-12T09:00:00.000Z'],
          ['last_sync_time', '2026-05-12T07:00:00.000Z'],
          ['last_sync_time', 'not-a-date'],
          ['sheet_version', '2.7'],
          ['created_by', 'Personal AI Extension'],
          ['created_at', '2026-04-30 12:00:00'],
        ],
      }),
      { status: 200 },
    ),
  );

  const service = new ConfigSyncService('token');
  const config = await service.readConfigFromSheet('sheet-123');

  assert.equal(config.last_sync_time, '2026-05-12T09:00:00.000Z');
});

test('ConfigSyncService reads RingCentral sender config from Config sheet', async () => {
  installFetchMock(() =>
    new Response(
      JSON.stringify({
        values: [
          ['ringcentral_sender_enabled', 'true'],
          ['ringcentral_sender_client_id', 'rc-client-id'],
          ['ringcentral_sender_client_secret', 'rc-client-secret'],
          ['ringcentral_sender_jwt', 'rc-jwt'],
          ['ringcentral_sender_updated_at', '2026-05-07T10:00:00.000Z'],
        ],
      }),
      { status: 200 },
    ),
  );

  const service = new ConfigSyncService('token');
  const config = await service.readConfigFromSheet('sheet-123');

  assert.equal(config.ringCentralSender?.enabled, true);
  assert.equal(config.ringCentralSender?.clientId, 'rc-client-id');
  assert.equal(config.ringCentralSender?.clientSecret, 'rc-client-secret');
  assert.equal(config.ringCentralSender?.jwt, 'rc-jwt');
  assert.equal(config.ringCentralSender?.updatedAt, '2026-05-07T10:00:00.000Z');
});

test('ConfigSyncService ignores invalid Sheet grid IDs from Config sheet', async () => {
  installFetchMock(() =>
    new Response(
      JSON.stringify({
        values: [
          ['messages_sheet_id', '123abc'],
          ['logs_sheet_id', '0'],
          ['sheet_version', '2.7'],
          ['created_by', 'Personal AI Extension'],
          ['created_at', '2026-04-30 12:00:00'],
        ],
      }),
      { status: 200 },
    ),
  );

  const service = new ConfigSyncService('token');
  const config = await service.readConfigFromSheet('sheet-123');

  assert.equal(config.messagesSheetId, undefined);
  assert.equal(config.logsSheetId, 0);
});

test('ConfigSyncService writes App Script deployment metadata to Config sheet', async () => {
  const calls = installFetchMock((_url, init) => {
    if (init?.method === 'PUT') {
      return new Response('{}', { status: 200 });
    }

    return new Response(JSON.stringify({ values: [] }), { status: 200 });
  });

  const service = new ConfigSyncService('token');
  await service.saveConfigToSheet({
    sheetId: 'sheet-123',
    sheetUrl: 'https://docs.google.com/spreadsheets/d/sheet-123/edit',
    scriptId: 'script-123',
    webAppUrl: 'https://script.google.com/macros/s/deploy/exec',
    deploymentId: 'deployment-456',
    sheet_version: '2.7',
    appScriptVersion: '2.6.1',
    appScriptLastUpdated: '2026-04-03',
    created_by: 'Personal AI Extension',
    created_at: '2026-04-30 12:00:00',
  });

  assert.equal(calls.length, 2);
  const putCall = calls.find((call) => call.init?.method === 'PUT');
  assert.ok(putCall);
  assert.match(putCall.url, /valueInputOption=RAW/);
  const body = JSON.parse(String(putCall.init?.body));
  const rows = body.values as [string, string][];
  const configMap = new Map(rows.filter(([key]) => key));

  assert.equal(configMap.get('deployment_id'), 'deployment-456');
  assert.equal(configMap.get('app_script_version'), '2.6.1');
  assert.equal(configMap.get('app_script_last_updated'), '2026-04-03');
});

test('ConfigSyncService writes sync action metadata to Config sheet', async () => {
  const calls = installFetchMock((_url, init) => {
    if (init?.method === 'PUT') {
      return new Response('{}', { status: 200 });
    }

    return new Response(JSON.stringify({ values: [] }), { status: 200 });
  });

  const service = new ConfigSyncService('token');
  await service.saveConfigToSheet({
    sheetId: 'sheet-123',
    sheetUrl: 'https://docs.google.com/spreadsheets/d/sheet-123/edit',
    sheet_version: '2.7',
    created_by: 'Personal AI Extension',
    created_at: '2026-04-30 12:00:00',
  }, undefined, {
    syncAction: 'app_script_metadata_update',
  });

  const putCall = calls.find((call) => call.init?.method === 'PUT');
  assert.ok(putCall);
  const body = JSON.parse(String(putCall.init?.body));
  const configMap = new Map((body.values as [string, string][]).filter(([key]) => key));

  assert.equal(configMap.get('last_sync_action'), 'app_script_metadata_update');
});

test('ConfigSyncService writes RingCentral sender config to Config sheet', async () => {
  const calls = installFetchMock((_url, init) => {
    if (init?.method === 'PUT') {
      return new Response('{}', { status: 200 });
    }

    return new Response(JSON.stringify({ values: [] }), { status: 200 });
  });

  const service = new ConfigSyncService('token');
  await service.saveConfigToSheet({
    sheetId: 'sheet-123',
    sheetUrl: 'https://docs.google.com/spreadsheets/d/sheet-123/edit',
    sheet_version: '2.7',
    created_by: 'Personal AI Extension',
    created_at: '2026-05-07T10:00:00.000Z',
    ringCentralSender: {
      enabled: true,
      clientId: 'rc-client-id',
      clientSecret: 'rc-client-secret',
      jwt: 'rc-jwt',
      updatedAt: '2026-05-07T10:00:00.000Z',
    },
  });

  const putCall = calls.find((call) => call.init?.method === 'PUT');
  assert.ok(putCall);
  const body = JSON.parse(String(putCall.init?.body));
  const configMap = new Map((body.values as [string, string][]).filter(([key]) => key));

  assert.equal(configMap.get('ringcentral_sender_enabled'), 'true');
  assert.equal(configMap.get('ringcentral_sender_client_id'), 'rc-client-id');
  assert.equal(configMap.get('ringcentral_sender_client_secret'), 'rc-client-secret');
  assert.equal(configMap.get('ringcentral_sender_jwt'), 'rc-jwt');
});

test('ConfigSyncService writes Config values as raw strings to avoid Sheet coercion', async () => {
  const calls = installFetchMock((_url, init) => {
    if (init?.method === 'PUT') {
      return new Response('{}', { status: 200 });
    }

    return new Response(JSON.stringify({ values: [] }), { status: 200 });
  });

  const service = new ConfigSyncService('token');
  await service.saveConfigToSheet({
    sheetId: 'sheet-123',
    sheetUrl: 'https://docs.google.com/spreadsheets/d/sheet-123/edit',
    sheet_version: '2.7',
    created_by: 'Personal AI Extension',
    created_at: '2026-05-05T18:30:00.000Z',
    botAutomation: {
      executorRule: {
        ruleId: '90071992547409931234',
        ruleName: 'Executor',
        webhookUrl: 'https://script.google.com/macros/s/deploy/exec',
        projectKey: 'MTR',
        jiraUrl: 'https://jira.example.com',
        createdAt: '2026-05-05T18:30:00.000Z',
      },
    },
  });

  const putCall = calls.find((call) => call.init?.method === 'PUT');
  assert.ok(putCall);
  assert.match(putCall.url, /valueInputOption=RAW/);
  const body = JSON.parse(String(putCall.init?.body));
  const configMap = new Map((body.values as [string, string][]).filter(([key]) => key));

  assert.equal(configMap.get('created_at'), '2026-05-05T18:30:00.000Z');
  assert.equal(configMap.get('bot_automation_executor_rule_id'), '90071992547409931234');
});

test('ConfigSyncService preserves unmanaged Config keys and remote sender keys while replacing managed keys', async () => {
  const calls = installFetchMock((_url, init) => {
    if (init?.method === 'PUT') {
      return new Response('{}', { status: 200 });
    }

    return new Response(
      JSON.stringify({
        values: [
          ['custom_owner_note', 'do not remove'],
          ['web_app_url', 'https://old.example.com/exec'],
          ['deploymentId', 'stale-deployment-alias'],
          ['bot_executor_rule_id', 'stale-rule'],
          ['ringcentral_sender_client_secret', 'old-secret'],
        ],
      }),
      { status: 200 },
    );
  });

  const service = new ConfigSyncService('token');
  await service.saveConfigToSheet({
    sheetId: 'sheet-123',
    sheetUrl: 'https://docs.google.com/spreadsheets/d/sheet-123/edit',
    scriptId: 'script-123',
    webAppUrl: 'https://script.google.com/macros/s/deploy/exec',
    sheet_version: '2.7',
    created_by: 'Personal AI Extension',
    created_at: '2026-04-30 12:00:00',
  });

  const putCall = calls.find((call) => call.init?.method === 'PUT');
  assert.ok(putCall);
  const body = JSON.parse(String(putCall.init?.body));
  const rows = body.values as [string, string][];
  const configMap = new Map(rows.filter(([key]) => key));

  assert.equal(configMap.get('custom_owner_note'), 'do not remove');
  assert.equal(configMap.get('web_app_url'), 'https://script.google.com/macros/s/deploy/exec');
  assert.equal(configMap.has('deploymentId'), false);
  assert.equal(configMap.has('bot_executor_rule_id'), false);
  assert.equal(configMap.get('ringcentral_sender_client_secret'), 'old-secret');
});

test('ConfigSyncService deduplicates stale managed Config keys when saving', async () => {
  const calls = installFetchMock((_url, init) => {
    if (init?.method === 'PUT') {
      return new Response('{}', { status: 200 });
    }

    return new Response(
      JSON.stringify({
        values: [
          ['web_app_url', 'https://old.example.com/exec'],
          ['web_app_url', 'https://older.example.com/exec'],
          ['custom_owner_note', 'keep me'],
          ['bot_automation_executor_rule_id', 'stale-rule'],
          ['bot_automation_executor_rule_id', 'older-stale-rule'],
          ['bot_automation_executor_rule_name', 'Stale Executor'],
          ['bot_automation_executor_rule_name', 'Older Stale Executor'],
        ],
      }),
      { status: 200 },
    );
  });

  const service = new ConfigSyncService('token');
  await service.saveConfigToSheet({
    sheetId: 'sheet-123',
    sheetUrl: 'https://docs.google.com/spreadsheets/d/sheet-123/edit',
    webAppUrl: 'https://script.google.com/macros/s/deploy/exec',
    sheet_version: '2.7',
    created_by: 'Personal AI Extension',
    created_at: '2026-04-30 12:00:00',
    botAutomation: {
      executorRule: {
        ruleId: 'executor-new',
        ruleName: 'Executor New',
        webhookUrl: 'https://script.google.com/macros/s/deploy/exec',
        projectKey: 'MTR',
        jiraUrl: 'https://jira.example.com',
        createdAt: '2026-05-01T00:00:00.000Z',
      },
    },
  });

  const putCall = calls.find((call) => call.init?.method === 'PUT');
  assert.ok(putCall);
  const body = JSON.parse(String(putCall.init?.body));
  const rows = (body.values as [string, string][]).filter(([key]) => key);
  const countKey = (targetKey: string) => rows.filter(([key]) => key === targetKey).length;
  const configMap = new Map(rows);

  assert.equal(countKey('web_app_url'), 1);
  assert.equal(countKey('bot_automation_executor_rule_id'), 1);
  assert.equal(countKey('bot_automation_executor_rule_name'), 1);
  assert.equal(configMap.get('web_app_url'), 'https://script.google.com/macros/s/deploy/exec');
  assert.equal(configMap.get('bot_automation_executor_rule_id'), 'executor-new');
  assert.equal(configMap.get('bot_automation_executor_rule_name'), 'Executor New');
  assert.equal(configMap.get('custom_owner_note'), 'keep me');
});

test('ConfigSyncService stops writes when Sheet Config is newer than the local base', async () => {
  let putCount = 0;
  installFetchMock((_url, init) => {
    if (init?.method === 'PUT') {
      putCount += 1;
      return new Response('{}', { status: 200 });
    }

    return new Response(
      JSON.stringify({
        values: [
          ['last_sync_time', '2026-05-12T09:00:00.000Z'],
          ['web_app_url', 'https://script.google.com/macros/s/remote/exec'],
        ],
      }),
      { status: 200 },
    );
  });

  const service = new ConfigSyncService('token');
  await assert.rejects(
    () => service.saveConfigToSheet({
      sheetId: 'sheet-123',
      sheetUrl: 'https://docs.google.com/spreadsheets/d/sheet-123/edit',
      webAppUrl: 'https://script.google.com/macros/s/local/exec',
      sheet_version: '2.7',
      created_by: 'Personal AI Extension',
      created_at: '2026-04-30 12:00:00',
      last_sync_time: '2026-05-12T08:00:00.000Z',
    }),
    /Sheet Config 已更新/,
  );

  assert.equal(putCount, 0);
});

test('ConfigSyncService stops writes when local freshness is unknown but Sheet has a sync time', async () => {
  let putCount = 0;
  installFetchMock((_url, init) => {
    if (init?.method === 'PUT') {
      putCount += 1;
      return new Response('{}', { status: 200 });
    }

    return new Response(
      JSON.stringify({
        values: [
          ['last_sync_time', '2026-05-12T09:00:00.000Z'],
        ],
      }),
      { status: 200 },
    );
  });

  const service = new ConfigSyncService('token');
  await assert.rejects(
    () => service.saveConfigToSheet({
      sheetId: 'sheet-123',
      sheetUrl: 'https://docs.google.com/spreadsheets/d/sheet-123/edit',
      webAppUrl: 'https://script.google.com/macros/s/local/exec',
      sheet_version: '2.7',
      created_by: 'Personal AI Extension',
      created_at: '2026-04-30 12:00:00',
    }),
    /本机基准：未知/,
  );

  assert.equal(putCount, 0);
});

test('ConfigSyncService allows an explicitly newer local config to replace older Sheet Config', async () => {
  const calls = installFetchMock((_url, init) => {
    if (init?.method === 'PUT') {
      return new Response('{}', { status: 200 });
    }

    return new Response(
      JSON.stringify({
        values: [
          ['last_sync_time', '2026-05-12T07:00:00.000Z'],
          ['web_app_url', 'https://script.google.com/macros/s/remote/exec'],
        ],
      }),
      { status: 200 },
    );
  });

  const service = new ConfigSyncService('token');
  await service.saveConfigToSheet({
    sheetId: 'sheet-123',
    sheetUrl: 'https://docs.google.com/spreadsheets/d/sheet-123/edit',
    webAppUrl: 'https://script.google.com/macros/s/local/exec',
    sheet_version: '2.7',
    created_by: 'Personal AI Extension',
    created_at: '2026-04-30 12:00:00',
    last_sync_time: '2026-05-12T08:00:00.000Z',
  });

  const putCall = calls.find((call) => call.init?.method === 'PUT');
  assert.ok(putCall);
  const body = JSON.parse(String(putCall.init?.body));
  const configMap = new Map((body.values as [string, string][]).filter(([key]) => key));

  assert.equal(configMap.get('web_app_url'), 'https://script.google.com/macros/s/local/exec');
});

test('ConfigSyncService clears remote sender credentials when sender is explicitly disabled', async () => {
  const calls = installFetchMock((_url, init) => {
    if (init?.method === 'PUT') {
      return new Response('{}', { status: 200 });
    }

    return new Response(
      JSON.stringify({
        values: [
          ['ringcentral_sender_enabled', 'true'],
          ['ringcentral_sender_client_id', 'old-client-id'],
          ['ringcentral_sender_client_secret', 'old-secret'],
          ['ringcentral_sender_jwt', 'old-jwt'],
          ['ringcentral_sender_updated_at', '2026-05-07T10:00:00.000Z'],
        ],
      }),
      { status: 200 },
    );
  });

  const service = new ConfigSyncService('token');
  await service.saveConfigToSheet({
    sheetId: 'sheet-123',
    sheetUrl: 'https://docs.google.com/spreadsheets/d/sheet-123/edit',
    sheet_version: '2.7',
    created_by: 'Personal AI Extension',
    created_at: '2026-05-07T10:00:00.000Z',
    ringCentralSender: {
      enabled: false,
      updatedAt: '2026-05-08T10:00:00.000Z',
    },
  });

  const putCall = calls.find((call) => call.init?.method === 'PUT');
  assert.ok(putCall);
  const body = JSON.parse(String(putCall.init?.body));
  const configMap = new Map((body.values as [string, string][]).filter(([key]) => key));

  assert.equal(configMap.get('ringcentral_sender_enabled'), 'false');
  assert.equal(configMap.get('ringcentral_sender_updated_at'), '2026-05-08T10:00:00.000Z');
  assert.equal(configMap.has('ringcentral_sender_client_id'), false);
  assert.equal(configMap.has('ringcentral_sender_client_secret'), false);
  assert.equal(configMap.has('ringcentral_sender_jwt'), false);
});

test('ConfigSyncService creates missing Config sheet before saving to a legacy maintenance sheet', async () => {
  let configReadCount = 0;
  const calls = installFetchMock((url, init) => {
    if (url.includes('/values/Config!A2:B') && !init?.method) {
      configReadCount += 1;
      if (configReadCount === 1) {
        return new Response(
          JSON.stringify({ error: { message: 'Unable to parse range: Config!A2:B' } }),
          { status: 400 },
        );
      }

      return new Response(JSON.stringify({ values: [] }), { status: 200 });
    }

    if (url.includes('?fields=sheets.properties')) {
      return new Response(
        JSON.stringify({
          sheets: [
            { properties: { sheetId: 11, title: 'Messages', index: 0 } },
            { properties: { sheetId: 12, title: 'Logs', index: 1 } },
          ],
        }),
        { status: 200 },
      );
    }

    if (url.endsWith(':batchUpdate') && init?.method === 'POST') {
      return new Response(
        JSON.stringify({
          replies: [{ addSheet: { properties: { sheetId: 13, title: 'Config' } } }],
        }),
        { status: 200 },
      );
    }

    if (url.includes('/values/Config!A1:B1') && init?.method === 'PUT') {
      return new Response('{}', { status: 200 });
    }

    if (url.includes('/values/Config!A2:B') && init?.method === 'PUT') {
      return new Response('{}', { status: 200 });
    }

    throw new Error(`Unexpected fetch call: ${url}`);
  });

  const service = new ConfigSyncService('token');
  await service.saveConfigToSheet({
    sheetId: 'sheet-123',
    sheetUrl: 'https://docs.google.com/spreadsheets/d/sheet-123/edit',
    sheet_version: '2.7',
    created_by: 'Manual',
    created_at: '2026-04-30 12:00:00',
  });

  assert.equal(configReadCount, 2);

  const addSheetCall = calls.find(call => call.url.endsWith(':batchUpdate'));
  assert.ok(addSheetCall);
  const addSheetBody = JSON.parse(String(addSheetCall.init?.body));
  assert.equal(addSheetBody.requests[0].addSheet.properties.title, 'Config');

  const headerCall = calls.find(call => call.url.includes('/values/Config!A1:B1'));
  assert.ok(headerCall);
  assert.deepEqual(JSON.parse(String(headerCall.init?.body)).values, [['Key', 'Value']]);

  const finalPutCall = calls.find(call => call.url.includes('/values/Config!A2:B') && call.init?.method === 'PUT');
  assert.ok(finalPutCall);
  const body = JSON.parse(String(finalPutCall.init?.body));
  const configMap = new Map((body.values as [string, string][]).filter(([key]) => key));
  assert.equal(configMap.get('sheet_version'), '2.7');
});

test('ConfigSyncService returns worksheet IDs by title for manual bind recovery', async () => {
  installFetchMock((url) => {
    assert.match(url, /\?fields=sheets\.properties/);
    return new Response(
      JSON.stringify({
        sheets: [
          { properties: { sheetId: 101, title: 'Messages', index: 0 } },
          { properties: { sheetId: 102, title: 'Config', index: 1 } },
          { properties: { sheetId: 103, title: 'Logs', index: 2 } },
        ],
      }),
      { status: 200 },
    );
  });

  const service = new ConfigSyncService('token');
  const ids = await service.getScheduledMessagesWorksheetIds('sheet-123');

  assert.deepEqual(ids, {
    messagesSheetId: 101,
    logsSheetId: 103,
    configSheetId: 102,
  });
});

test('ConfigSyncService recovers missing worksheet IDs from existing sheet tabs', async () => {
  installFetchMock((url) => {
    assert.match(url, /\?fields=sheets\.properties/);
    return new Response(
      JSON.stringify({
        sheets: [
          { properties: { sheetId: 101, title: 'Messages', index: 0 } },
          { properties: { sheetId: 102, title: 'Config', index: 1 } },
          { properties: { sheetId: 103, title: 'Logs', index: 2 } },
        ],
      }),
      { status: 200 },
    );
  });

  const service = new ConfigSyncService('token');
  const config = await service.recoverScheduledMessagesWorksheetIds('sheet-123', {
    sheetId: 'sheet-123',
    sheetUrl: 'https://docs.google.com/spreadsheets/d/sheet-123/edit',
    messagesSheetId: 909,
    sheet_version: '2.7',
    created_by: 'Manual',
    created_at: '2026-04-30T00:00:00.000Z',
  });

  assert.equal(config.messagesSheetId, 909);
  assert.equal(config.logsSheetId, 103);
});

test('ConfigSyncService skips missing Bot Automation rule fields instead of writing null values', async () => {
  const calls = installFetchMock((_url, init) => {
    if (init?.method === 'PUT') {
      return new Response('{}', { status: 200 });
    }

    return new Response(JSON.stringify({ values: [] }), { status: 200 });
  });

  const service = new ConfigSyncService('token');
  await service.saveConfigToSheet({
    sheetId: 'sheet-123',
    sheetUrl: 'https://docs.google.com/spreadsheets/d/sheet-123/edit',
    sheet_version: '2.7',
    created_by: 'Personal AI Extension',
    created_at: '2026-04-30 12:00:00',
    botAutomation: {
      executorRule: {
        ruleId: 'executor-only',
      },
    },
  } as any);

  const putCall = calls.find((call) => call.init?.method === 'PUT');
  assert.ok(putCall);
  const body = JSON.parse(String(putCall.init?.body));
  const rows = body.values as [string, string][];
  const configMap = new Map(rows.filter(([key]) => key));

  assert.equal(configMap.get('bot_automation_executor_rule_id'), 'executor-only');
  assert.equal(configMap.has('bot_executor_rule_id'), false);
  assert.equal(configMap.has('bot_executor_rule_name'), false);
  assert.equal(configMap.has('bot_automation_executor_webhook_url'), false);
  assert.equal(rows.some((row) => row.some((value) => value === null || value === undefined)), false);
});

test('ConfigSyncService writes Sheet before local storage during full sync', async () => {
  const events: string[] = [];
  let storedConfig: any;
  let sheetLastSyncTime = '';

  installFetchMock((_url, init) => {
    if (init?.method === 'PUT') {
      events.push('sheet');
      const body = JSON.parse(String(init.body));
      const rows = body.values as [string, string][];
      sheetLastSyncTime = new Map(rows.filter(([key]) => key)).get('last_sync_time') || '';
      assert.equal(new Map(rows.filter(([key]) => key)).get('last_sync_action'), 'one_click_setup');
      return new Response('{}', { status: 200 });
    }

    return new Response(JSON.stringify({ values: [] }), { status: 200 });
  });

  (globalThis as any).chrome = {
    storage: {
      local: {
        set: async (value: any) => {
          events.push('storage');
          storedConfig = value.scheduledMessagesConfig;
        },
      },
    },
  };

  const service = new ConfigSyncService('token');
  await service.syncConfig({
    sheetId: 'sheet-123',
    sheetUrl: 'https://docs.google.com/spreadsheets/d/sheet-123/edit',
    scriptId: 'script-123',
    webAppUrl: 'https://script.google.com/macros/s/deploy/exec',
    sheet_version: '2.7',
    created_by: 'Personal AI Extension',
    created_at: '2026-04-30 12:00:00',
  }, {
    syncAction: 'one_click_setup',
  });

  assert.deepEqual(events, ['sheet', 'storage']);
  assert.ok(sheetLastSyncTime);
  assert.equal(storedConfig.last_sync_time, sheetLastSyncTime);
  assert.equal(storedConfig.last_sync_action, 'one_click_setup');
});

test('ConfigSyncService keeps sibling Bot Automation rule on partial update', async () => {
  let storedConfig: any;

  installFetchMock((_url, init) => {
    if (init?.method === 'PUT') {
      return new Response('{}', { status: 200 });
    }

    return new Response(JSON.stringify({ values: [] }), { status: 200 });
  });

  (globalThis as any).chrome = {
    storage: {
      local: {
        get: async () => ({
          scheduledMessagesConfig: {
            sheetId: 'sheet-123',
            sheetUrl: 'https://docs.google.com/spreadsheets/d/sheet-123/edit',
            sheet_version: '2.7',
            created_by: 'Personal AI Extension',
            created_at: '2026-04-30 12:00:00',
            botAutomation: {
              executorRule: {
                ruleId: 'executor-old',
                ruleName: 'Executor Old',
                webhookUrl: 'https://old.example.com',
                projectKey: 'OLD',
                jiraUrl: 'https://jira.example.com',
                createdAt: '2026-04-30T00:00:00.000Z',
              },
              timelineSyncRule: {
                ruleId: 'timeline-keep',
                ruleName: 'Timeline Keep',
                webhookUrl: 'https://timeline.example.com',
                projectKey: 'OLD',
                jiraUrl: 'https://jira.example.com',
                createdAt: '2026-04-30T00:00:00.000Z',
              },
            },
          },
        }),
        set: async (value: any) => {
          storedConfig = value.scheduledMessagesConfig;
        },
      },
    },
  };

  const service = new ConfigSyncService('token');
  const config = await service.updatePartialConfig({
    botAutomation: {
      executorRule: {
        ruleId: 'executor-new',
        ruleName: 'Executor New',
        webhookUrl: 'https://new.example.com',
        projectKey: 'NEW',
        jiraUrl: 'https://jira.example.com',
        createdAt: '2026-05-01T00:00:00.000Z',
      },
    },
  });

  assert.equal(config.botAutomation?.executorRule?.ruleId, 'executor-new');
  assert.equal(config.botAutomation?.timelineSyncRule?.ruleId, 'timeline-keep');
  assert.equal(storedConfig.botAutomation.timelineSyncRule.ruleId, 'timeline-keep');
});

test('ConfigSyncService uses newer Sheet Config as base for partial updates', async () => {
  let storedConfig: any;
  const remoteRows = [
    ['sheet_version', '2.7'],
    ['created_by', 'Personal AI Extension'],
    ['created_at', '2026-05-01T00:00:00.000Z'],
    ['last_sync_time', '2026-05-01T10:00:00.000Z'],
    ['bot_automation_executor_rule_id', 'executor-remote'],
    ['bot_automation_executor_rule_name', 'Executor Remote'],
    ['bot_automation_timeline_sync_rule_id', 'timeline-remote'],
    ['bot_automation_timeline_sync_rule_name', 'Timeline Remote'],
  ];

  const calls = installFetchMock((_url, init) => {
    if (init?.method === 'PUT') {
      return new Response('{}', { status: 200 });
    }

    return new Response(JSON.stringify({ values: remoteRows }), { status: 200 });
  });

  (globalThis as any).chrome = {
    storage: {
      local: {
        get: async () => ({
          scheduledMessagesConfig: {
            sheetId: 'sheet-123',
            sheetUrl: 'https://docs.google.com/spreadsheets/d/sheet-123/edit',
            sheet_version: '2.7',
            created_by: 'Personal AI Extension',
            created_at: '2026-04-30T00:00:00.000Z',
            last_sync_time: '2026-05-01T09:00:00.000Z',
            botAutomation: {
              executorRule: {
                ruleId: 'executor-local',
                ruleName: 'Executor Local',
                webhookUrl: 'https://local.example.com/executor',
                projectKey: 'OLD',
                jiraUrl: 'https://jira.example.com',
                createdAt: '2026-04-30T00:00:00.000Z',
              },
              timelineSyncRule: {
                ruleId: 'timeline-local',
                ruleName: 'Timeline Local',
                webhookUrl: 'https://local.example.com/timeline',
                projectKey: 'OLD',
                jiraUrl: 'https://jira.example.com',
                createdAt: '2026-04-30T00:00:00.000Z',
              },
            },
          },
        }),
        set: async (value: any) => {
          storedConfig = value.scheduledMessagesConfig;
        },
      },
    },
  };

  const service = new ConfigSyncService('token');
  const config = await service.updatePartialConfig({
    botAutomation: {
      executorRule: {
        ruleName: 'Executor Updated',
      } as any,
    },
  } as any);

  const putCall = calls.find((call) => call.init?.method === 'PUT');
  assert.ok(putCall);
  const body = JSON.parse(String(putCall.init?.body));
  const configMap = new Map((body.values as [string, string][]).filter(([key]) => key));

  assert.equal(config.botAutomation?.executorRule?.ruleId, 'executor-remote');
  assert.equal(config.botAutomation?.executorRule?.ruleName, 'Executor Updated');
  assert.equal(config.botAutomation?.timelineSyncRule?.ruleId, 'timeline-remote');
  assert.equal(storedConfig.botAutomation.timelineSyncRule.ruleId, 'timeline-remote');
  assert.equal(configMap.get('bot_automation_executor_rule_name'), 'Executor Updated');
  assert.equal(configMap.get('bot_automation_timeline_sync_rule_id'), 'timeline-remote');
});

test('ConfigSyncService uses same-timestamp Sheet Config as base for partial updates', async () => {
  let storedConfig: any;
  const remoteRows = [
    ['sheet_version', '2.7'],
    ['created_by', 'Personal AI Extension'],
    ['created_at', '2026-05-01T00:00:00.000Z'],
    ['last_sync_time', '2026-05-01T10:00:00.000Z'],
    ['web_app_url', 'https://script.google.com/macros/s/remote/exec'],
    ['bot_automation_executor_rule_id', 'executor-remote'],
    ['bot_automation_executor_rule_name', 'Executor Remote'],
    ['bot_automation_timeline_sync_rule_id', 'timeline-remote'],
    ['bot_automation_timeline_sync_rule_name', 'Timeline Remote'],
  ];

  const calls = installFetchMock((_url, init) => {
    if (init?.method === 'PUT') {
      return new Response('{}', { status: 200 });
    }

    return new Response(JSON.stringify({ values: remoteRows }), { status: 200 });
  });

  (globalThis as any).chrome = {
    storage: {
      local: {
        get: async () => ({
          scheduledMessagesConfig: {
            sheetId: 'sheet-123',
            sheetUrl: 'https://docs.google.com/spreadsheets/d/sheet-123/edit',
            sheet_version: '2.7',
            created_by: 'Personal AI Extension',
            created_at: '2026-05-01T00:00:00.000Z',
            last_sync_time: '2026-05-01T10:00:00.000Z',
            webAppUrl: 'https://script.google.com/macros/s/local/exec',
            botAutomation: {
              executorRule: {
                ruleId: 'executor-local',
                ruleName: 'Executor Local',
                webhookUrl: 'https://local.example.com/executor',
                projectKey: 'OLD',
                jiraUrl: 'https://jira.example.com',
                createdAt: '2026-04-30T00:00:00.000Z',
              },
            },
          },
        }),
        set: async (value: any) => {
          storedConfig = value.scheduledMessagesConfig;
        },
      },
    },
  };

  const service = new ConfigSyncService('token');
  const config = await service.updatePartialConfig({
    appScriptVersion: '2.8.0',
  });

  const putCall = calls.find((call) => call.init?.method === 'PUT');
  assert.ok(putCall);
  const body = JSON.parse(String(putCall.init?.body));
  const configMap = new Map((body.values as [string, string][]).filter(([key]) => key));

  assert.equal(config.webAppUrl, 'https://script.google.com/macros/s/remote/exec');
  assert.equal(config.appScriptVersion, '2.8.0');
  assert.equal(config.botAutomation?.executorRule?.ruleId, 'executor-remote');
  assert.equal(config.botAutomation?.timelineSyncRule?.ruleId, 'timeline-remote');
  assert.equal(storedConfig.webAppUrl, 'https://script.google.com/macros/s/remote/exec');
  assert.equal(storedConfig.botAutomation.timelineSyncRule.ruleId, 'timeline-remote');
  assert.equal(configMap.get('web_app_url'), 'https://script.google.com/macros/s/remote/exec');
  assert.equal(configMap.get('app_script_version'), '2.8.0');
  assert.equal(configMap.get('bot_automation_executor_rule_id'), 'executor-remote');
  assert.equal(configMap.get('bot_automation_timeline_sync_rule_id'), 'timeline-remote');
});

test('ConfigSyncService returns the persisted timestamp from partial updates', async () => {
  installDateMock([
    '2026-05-10T00:00:00.000Z',
    '2026-05-10T00:00:01.000Z',
  ]);

  let storedConfig: any;
  let sheetLastSyncTime = '';

  installFetchMock((_url, init) => {
    if (init?.method === 'PUT') {
      const body = JSON.parse(String(init.body));
      const rows = body.values as [string, string][];
      sheetLastSyncTime = new Map(rows.filter(([key]) => key)).get('last_sync_time') || '';
      return new Response('{}', { status: 200 });
    }

    return new Response(
      JSON.stringify({
        values: [
          ['sheet_version', '2.7'],
          ['created_by', 'Personal AI Extension'],
          ['created_at', '2026-05-01T00:00:00.000Z'],
          ['last_sync_time', '2026-05-09T00:00:00.000Z'],
        ],
      }),
      { status: 200 },
    );
  });

  (globalThis as any).chrome = {
    storage: {
      local: {
        get: async () => ({
          scheduledMessagesConfig: {
            sheetId: 'sheet-123',
            sheetUrl: 'https://docs.google.com/spreadsheets/d/sheet-123/edit',
            sheet_version: '2.7',
            created_by: 'Personal AI Extension',
            created_at: '2026-05-01T00:00:00.000Z',
            last_sync_time: '2026-05-09T00:00:00.000Z',
          },
        }),
        set: async (value: any) => {
          storedConfig = value.scheduledMessagesConfig;
        },
      },
    },
  };

  const service = new ConfigSyncService('token');
  const config = await service.updatePartialConfig({
    webAppUrl: 'https://script.google.com/macros/s/new-deploy/exec',
  });

  assert.equal(sheetLastSyncTime, '2026-05-10T00:00:00.000Z');
  assert.equal(config.last_sync_time, sheetLastSyncTime);
  assert.equal(storedConfig.last_sync_time, sheetLastSyncTime);
  assert.equal(config.last_sync_action, 'partial_update');
  assert.equal(storedConfig.last_sync_action, 'partial_update');
});
