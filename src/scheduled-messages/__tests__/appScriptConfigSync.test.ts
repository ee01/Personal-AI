import test from 'node:test';
import assert from 'node:assert/strict';

import { ConfigSyncService } from '../ConfigSyncService';

type FetchCall = {
  url: string;
  init?: RequestInit;
};

const originalFetch = globalThis.fetch;

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
});

test('ConfigSyncService reads App Script deployment metadata from Config sheet', async () => {
  installFetchMock(() =>
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
        ],
      }),
      { status: 200 },
    ),
  );

  const service = new ConfigSyncService('token');
  const config = await service.readConfigFromSheet('sheet-123');

  assert.equal(config.scriptId, 'script-123');
  assert.equal(config.deploymentId, 'deployment-456');
  assert.equal(config.appScriptVersion, '2.6.1');
  assert.equal(config.appScriptLastUpdated, '2026-04-03');
});

test('ConfigSyncService writes App Script deployment metadata to Config sheet', async () => {
  const calls = installFetchMock(() => new Response('{}', { status: 200 }));

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

  assert.equal(calls.length, 1);
  const body = JSON.parse(String(calls[0].init?.body));
  const rows = body.values as [string, string][];
  const configMap = new Map(rows.filter(([key]) => key));

  assert.equal(configMap.get('deployment_id'), 'deployment-456');
  assert.equal(configMap.get('app_script_version'), '2.6.1');
  assert.equal(configMap.get('app_script_last_updated'), '2026-04-03');
});
