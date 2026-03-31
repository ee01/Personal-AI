const { contextBridge, ipcRenderer } = require('electron');

const BASE_URL = 'http://127.0.0.1:46321';
let bridgeToken;

function mergeUrl(path) {
  return `${BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

async function readJson(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function pair() {
  const response = await fetch(mergeUrl('/pair'), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });

  const payload = await readJson(response);
  if (!response.ok) {
    throw new Error(payload?.error || 'Failed to pair with Doubao Bridge');
  }

  bridgeToken = payload?.token;
  return payload;
}

async function request(method, path, body, options = {}) {
  const headers = {
    Accept: 'application/json',
  };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (bridgeToken && !options.skipAuth) {
    headers['x-bridge-token'] = bridgeToken;
  }

  const response = await fetch(mergeUrl(path), {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await readJson(response);

  if (response.status === 401 && !options.skipAuth) {
    await pair();
    return request(method, path, body, { skipAuth: false });
  }

  if (!response.ok) {
    throw new Error(payload?.error || payload?.raw || `${method} ${path} failed`);
  }

  return payload;
}

contextBridge.exposeInMainWorld('bridgeApi', {
  pair,
  getHealth: () => request('GET', '/health', undefined, { skipAuth: true }),
  getStatus: () => request('GET', '/status'),
  getSettings: () => request('GET', '/settings'),
  updateSettings: (payload) => request('PUT', '/settings', payload),
  testMemoryService: () => request('POST', '/settings/test-memory-service', {}),
  openLogin: () => request('POST', '/auth/open-login', {}),
  createMemorySyncThread: () => request('POST', '/threads/create-memory-sync', {}),
  autoBindMobileThread: (title = '手机版对话') =>
    request('POST', '/threads/auto-bind-mobile', { title }),
  runNow: (kind) => request('POST', '/sync/run-now', { kind }),
});

contextBridge.exposeInMainWorld('appShell', {
  getMeta: () => ipcRenderer.invoke('bridge-app:get-meta'),
  openLogFile: () => ipcRenderer.invoke('bridge-app:open-log-file'),
  openSupportDir: () => ipcRenderer.invoke('bridge-app:open-support-dir'),
  stopBackgroundAndQuit: () => ipcRenderer.invoke('bridge-app:stop-background-and-quit'),
  showWindow: () => ipcRenderer.invoke('bridge-app:show-window'),
});
