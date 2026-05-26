import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { SheetInitializer } from '../src/scheduled-messages/SheetInitializer';

type CapturedRequest = {
  url: string;
  method: string;
  body?: string;
};

const capturedRequests: CapturedRequest[] = [];
const originalFetch = globalThis.fetch;
const originalChrome = (globalThis as any).chrome;

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

  throw new Error(`Unexpected fetch: ${method} ${url}`);
};

try {
  const initializer = new SheetInitializer('fake-token');
  const result = await initializer.createScheduledMessagesSheet();

  assert.equal(result.success, true);
  assert.equal(result.needsAuthorization, true);
  assert.equal(result.sheetId, 'sheet-123');
  assert.equal(result.scriptId, 'script-123');
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

  console.log('Scheduled Messages one-click setup safety verifier passed');
} finally {
  globalThis.fetch = originalFetch;
  (globalThis as any).chrome = originalChrome;
}
