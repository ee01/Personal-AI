import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { SheetInitializer } from '../src/scheduled-messages/SheetInitializer';
import {
  buildScheduledMessagesSetupReceipt,
  buildScheduledMessagesSetupReceiptNotice,
} from '../src/scheduled-messages/setupReceipt';

type CapturedRequest = {
  url: string;
  method: string;
  body?: string;
};

const capturedRequests: CapturedRequest[] = [];
const originalFetch = globalThis.fetch;
const originalChrome = (globalThis as any).chrome;
const storageState: Record<string, unknown> = {};

function jsonResponse(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });
}

function textResponse(text: string, init: ResponseInit = {}): Response {
  return new Response(text, {
    status: 200,
    headers: { 'content-type': 'text/plain' },
    ...init,
  });
}

(globalThis as any).chrome = {
  runtime: {
    getURL: (resourcePath: string) => `chrome-extension://personal-ai/${resourcePath}`,
  },
  storage: {
    local: {
      async get(keys?: string[] | string) {
        if (Array.isArray(keys)) {
          return Object.fromEntries(keys.map((key) => [key, storageState[key]]));
        }
        if (typeof keys === 'string') {
          return { [keys]: storageState[keys] };
        }
        return { ...storageState };
      },
      async set(values: Record<string, unknown>) {
        Object.assign(storageState, values);
      },
    },
  },
};

globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = String(input);
  const method = (init?.method || 'GET').toUpperCase();
  capturedRequests.push({
    url,
    method,
    body: typeof init?.body === 'string' ? init.body : undefined,
  });

  if (url === 'https://www.googleapis.com/oauth2/v2/userinfo') {
    return jsonResponse({
      email: 'esone@example.com',
      name: 'Esone Qiu',
      given_name: 'Esone',
      family_name: 'Qiu',
      picture: '',
      hd: 'example.com',
    });
  }

  if (url === 'https://sheets.googleapis.com/v4/spreadsheets' && method === 'POST') {
    return jsonResponse({
      spreadsheetId: 'sheet-123',
      spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/sheet-123/edit',
      sheets: [
        { properties: { title: 'Messages', sheetId: 101 } },
        { properties: { title: 'Config', sheetId: 102 } },
        { properties: { title: 'Logs', sheetId: 103 } },
      ],
    });
  }

  if (url === 'https://www.googleapis.com/drive/v3/files/sheet-123/permissions' && method === 'POST') {
    return jsonResponse(
      { error: { message: 'Domain sharing disabled by admin policy' } },
      { status: 403 },
    );
  }

  if (url === 'https://sheets.googleapis.com/v4/spreadsheets/sheet-123:batchUpdate' && method === 'POST') {
    return jsonResponse({ replies: [] });
  }

  if (url === 'https://script.googleapis.com/v1/projects' && method === 'POST') {
    return jsonResponse({ scriptId: 'script-123' });
  }

  if (url === 'chrome-extension://personal-ai/app-script-template.gs') {
    return textResponse(readFileSync('src/scheduled-messages/app-script-template.gs', 'utf8'));
  }

  if (url === 'https://script.googleapis.com/v1/projects/script-123/content' && method === 'PUT') {
    return jsonResponse({});
  }

  if (url === 'https://script.googleapis.com/v1/projects/script-123/versions' && method === 'POST') {
    return jsonResponse({ versionNumber: 1 });
  }

  if (url === 'https://script.googleapis.com/v1/projects/script-123/deployments' && method === 'POST') {
    return jsonResponse({
      deploymentId: 'deployment-123',
      entryPoints: [
        {
          entryPointType: 'WEB_APP',
          webApp: {
            url: 'https://script.google.com/macros/s/deployment-123/exec',
          },
        },
      ],
    });
  }

  if (
    url === 'https://script.google.com/macros/s/deployment-123/exec?action=setupTriggers' &&
    method === 'GET'
  ) {
    return jsonResponse({
      success: true,
      message: 'Trigger created successfully: minuteTrigger',
    });
  }

  if (
    url === 'https://sheets.googleapis.com/v4/spreadsheets/sheet-123/values/Messages!A2:AA2?valueInputOption=USER_ENTERED' &&
    method === 'PUT'
  ) {
    return jsonResponse({});
  }

  if (
    url === 'https://sheets.googleapis.com/v4/spreadsheets/sheet-123/values/Config!A2:B' &&
    method === 'GET'
  ) {
    return jsonResponse({ values: [] });
  }

  if (
    url === 'https://sheets.googleapis.com/v4/spreadsheets/sheet-123/values/Config!A2:B57?valueInputOption=RAW' &&
    method === 'PUT'
  ) {
    return jsonResponse({});
  }

  throw new Error(`Unexpected fetch: ${method} ${url}`);
};

try {
  const initializer = new SheetInitializer('fake-token');
  const result = await initializer.createScheduledMessagesSheet();

  assert.equal(result.success, true);
  assert.equal(result.needsAuthorization, true);
  assert.equal(result.sheetId, 'sheet-123');
  assert.equal(result.scriptId, 'script-123');
  assert.equal(result.deploymentId, 'deployment-123');
  assert.equal(result.messagesSheetId, 101);
  assert.equal(result.logsSheetId, 103);
  assert.match(result.authUrl || '', /action=authSuccess/);
  assert.ok(
    result.setupWarnings?.some((warning) => warning.includes('仅创建者可编辑')),
    'Domain-sharing failure should be surfaced as an owner-only setup warning',
  );

  const permissionRequests = capturedRequests.filter((request) =>
    request.url === 'https://www.googleapis.com/drive/v3/files/sheet-123/permissions',
  );
  assert.equal(permissionRequests.length, 1, 'Initializer should only attempt the domain permission request');
  const permissionBody = JSON.parse(permissionRequests[0].body || '{}');
  assert.equal(permissionBody.type, 'domain');
  assert.equal(permissionBody.role, 'writer');
  assert.equal(permissionBody.domain, 'example.com');
  assert.equal(
    capturedRequests.some((request) => request.body?.includes('"type":"anyone"')),
    false,
    'Initializer must not silently fall back to anyone-with-link writer sharing',
  );

  const phaseTwoInitializer = new SheetInitializer('fake-token');
  const completed = await phaseTwoInitializer.completeInitialization(
    result.sheetId,
    result.scriptId,
    result.webAppUrl,
    {
      deploymentId: result.deploymentId,
      messagesSheetId: result.messagesSheetId,
      logsSheetId: result.logsSheetId,
    },
  );

  assert.equal(completed.success, true);
  assert.equal(completed.deploymentId, 'deployment-123');
  assert.equal(completed.messagesSheetId, 101);
  assert.equal(completed.logsSheetId, 103);

  const configWrite = capturedRequests.find((request) =>
    request.url === 'https://sheets.googleapis.com/v4/spreadsheets/sheet-123/values/Config!A2:B57?valueInputOption=RAW',
  );
  assert.ok(configWrite, 'Completed setup should write Config rows');
  const configRows = JSON.parse(configWrite.body || '{}').values as [string, string][];
  const configMap = new Map(configRows);
  assert.equal(configMap.get('deployment_id'), 'deployment-123');
  assert.equal(configMap.get('messages_sheet_id'), '101');
  assert.equal(configMap.get('logs_sheet_id'), '103');
  assert.equal(configMap.get('last_sync_action'), 'one_click_setup');

  const storedConfig = storageState.scheduledMessagesConfig as Record<string, unknown>;
  assert.equal(storedConfig.deploymentId, 'deployment-123');
  assert.equal(storedConfig.messagesSheetId, 101);
  assert.equal(storedConfig.logsSheetId, 103);

  const combinedSetupResult = {
    ...completed,
    setupWarnings: [
      ...(result.setupWarnings || []),
      ...(completed.setupWarnings || []),
    ],
  };
  const receipt = buildScheduledMessagesSetupReceipt(
    combinedSetupResult,
    '2026-06-04T00:00:00.000Z',
  );
  const receiptNotice = buildScheduledMessagesSetupReceiptNotice(receipt, storedConfig);

  assert.equal(receiptNotice.tone, 'warning');
  assert.equal(receiptNotice.title, '定时消息系统已初始化');
  assert.ok(
    receiptNotice.description.includes('维护表、App Script、触发器、测试消息和 Config 已完成'),
    'Receipt should summarize the completed setup path',
  );
  assert.ok(
    receiptNotice.details.some((detail) => detail.includes('Sheet: sheet-123')),
    'Receipt should expose the created Sheet ID',
  );
  assert.ok(
    receiptNotice.details.some((detail) => detail.includes('Messages 101 / Logs 103')),
    'Receipt should expose worksheet positioning',
  );
  assert.ok(
    receiptNotice.details.some((detail) => detail.includes('Deployment: deployment-123')),
    'Receipt should expose the Web App deployment ID',
  );
  assert.ok(
    receiptNotice.details.some((detail) => detail.includes('分钟 / 每日触发器已写入 Config')),
    'Receipt should confirm trigger metadata from Config',
  );
  assert.ok(
    receiptNotice.details.some((detail) => detail.includes('仅创建者可编辑')),
    'Receipt should carry setup warnings into the initialized page notice',
  );

  console.log('Scheduled Messages one-click setup safety verifier passed');
} finally {
  globalThis.fetch = originalFetch;
  (globalThis as any).chrome = originalChrome;
}
