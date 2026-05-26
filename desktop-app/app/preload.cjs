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
    throw new Error(payload?.error || 'Failed to pair with Personal AI');
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
    throw new Error(
      payload?.error || payload?.raw || `${method} ${path} failed`,
    );
  }

  return payload;
}

function parseSseBlock(block) {
  const lines = block.split(/\r?\n/);
  let event = 'message';
  const dataLines = [];

  for (const line of lines) {
    if (!line || line.startsWith(':')) continue;
    if (line.startsWith('event:')) {
      event = line.slice(6).trim() || 'message';
      continue;
    }
    if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trim());
    }
  }

  const rawData = dataLines.join('\n');
  if (!rawData) return null;

  let payload = rawData;
  try {
    payload = JSON.parse(rawData);
  } catch {
    payload = { type: event, raw: rawData };
  }

  if (
    payload &&
    typeof payload === 'object' &&
    !Array.isArray(payload) &&
    !payload.type
  ) {
    payload.type = event;
  }

  return payload;
}

async function requestStream(path, body, onEvent, options = {}) {
  const headers = {
    Accept: 'text/event-stream',
    'Content-Type': 'application/json',
  };
  if (bridgeToken && !options.skipAuth) {
    headers['x-bridge-token'] = bridgeToken;
  }

  const response = await fetch(mergeUrl(path), {
    method: 'POST',
    headers,
    body: JSON.stringify(body || {}),
  });

  if (response.status === 401 && !options.skipAuth) {
    await pair();
    return requestStream(path, body, onEvent, { skipAuth: false });
  }

  if (!response.ok) {
    const payload = await readJson(response);
    throw new Error(payload?.error || payload?.raw || `POST ${path} failed`);
  }

  if (!response.body) {
    throw new Error(`POST ${path} returned no stream body`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });

    let delimiterIndex = buffer.search(/\r?\n\r?\n/);
    while (delimiterIndex >= 0) {
      const rawBlock = buffer.slice(0, delimiterIndex);
      const separatorLength = buffer[delimiterIndex] === '\r' ? 4 : 2;
      buffer = buffer.slice(delimiterIndex + separatorLength);
      const payload = parseSseBlock(rawBlock.trim());
      if (payload) {
        onEvent(payload);
      }
      delimiterIndex = buffer.search(/\r?\n\r?\n/);
    }

    if (done) {
      const trailing = buffer.trim();
      if (trailing) {
        const payload = parseSseBlock(trailing);
        if (payload) {
          onEvent(payload);
        }
      }
      break;
    }
  }
}

function onChannel(channel, callback) {
  const listener = (_event, payload) => {
    callback(payload);
  };
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld('bridgeApi', {
  pair,
  getHealth: () => request('GET', '/health', undefined, { skipAuth: true }),
  getStatus: () => request('GET', '/status'),
  getSettings: () => request('GET', '/settings'),
  updateSettings: (payload) => request('PUT', '/settings', payload),
  testMemoryService: () => request('POST', '/settings/test-memory-service', {}),
  openLogin: () => request('POST', '/auth/open-login', {}),
  createMemorySyncThread: () =>
    request('POST', '/threads/create-memory-sync', {}),
  autoBindMobileThread: (title = '手机版对话') =>
    request('POST', '/threads/auto-bind-mobile', { title }),
  runNow: (kind) => request('POST', '/sync/run-now', { kind }),
});

contextBridge.exposeInMainWorld('appShell', {
  getMeta: () => ipcRenderer.invoke('bridge-app:get-meta'),
  openLogFile: () => ipcRenderer.invoke('bridge-app:open-log-file'),
  openSupportDir: () => ipcRenderer.invoke('bridge-app:open-support-dir'),
  openMemoryListWindow: () =>
    ipcRenderer.invoke('bridge-app:open-memory-list-window'),
  openAccessibilitySettings: () =>
    ipcRenderer.invoke('bridge-app:open-accessibility-settings'),
  openInputMonitoringSettings: () =>
    ipcRenderer.invoke('bridge-app:open-input-monitoring-settings'),
  openMicrophoneSettings: () =>
    ipcRenderer.invoke('bridge-app:open-microphone-settings'),
  refreshShortcutHelper: () =>
    ipcRenderer.invoke('bridge-app:refresh-shortcut-helper'),
  getVoicePreferences: () =>
    ipcRenderer.invoke('bridge-app:get-voice-preferences'),
  setVoicePreferences: (payload) =>
    ipcRenderer.invoke('bridge-app:set-voice-preferences', payload),
  openExternal: (url) => ipcRenderer.invoke('bridge-app:open-external', url),
  stopBackgroundAndQuit: () =>
    ipcRenderer.invoke('bridge-app:stop-background-and-quit'),
  showWindow: () => ipcRenderer.invoke('bridge-app:show-window'),
  onShortcutStatus: (callback) =>
    onChannel('bridge-app:shortcut-status', callback),
});

contextBridge.exposeInMainWorld('quickAsk', {
  ask: (payload) => request('POST', '/assistant/ask', payload),
  askStream: (payload, onEvent) =>
    requestStream('/assistant/ask/stream', payload, onEvent),
  injectQuery: (payload) => request('POST', '/inject/query', payload),
  getRuntimeSummary: () => request('GET', '/assistant/runtime-summary'),
  remember: (payload) => request('POST', '/assistant/memory/remember', payload),
  hide: () => ipcRenderer.invoke('quick-ask:hide'),
  openSettings: () => ipcRenderer.invoke('quick-ask:open-settings'),
  openFullBridge: () => ipcRenderer.invoke('quick-ask:open-full-bridge'),
  newSession: () => ipcRenderer.invoke('quick-ask:new-session'),
  getPreferences: () => ipcRenderer.invoke('quick-ask:get-preferences'),
  startNativeVoice: (payload) =>
    ipcRenderer.invoke('quick-ask:voice-start', payload),
  stopNativeVoice: () => ipcRenderer.invoke('quick-ask:voice-stop'),
  cancelNativeVoice: () => ipcRenderer.invoke('quick-ask:voice-cancel'),
  resolveShortcutGesture: () =>
    ipcRenderer.invoke('quick-ask:resolve-shortcut-gesture'),
  log: (payload) => ipcRenderer.invoke('quick-ask:log', payload),
  setLayout: (payload) => ipcRenderer.invoke('quick-ask:set-layout', payload),
  onNativeShortcutEvent: (callback) =>
    onChannel('quick-ask:native-shortcut', callback),
  onVoiceEvent: (callback) => onChannel('quick-ask:voice-event', callback),
  onShortcutStatus: (callback) =>
    onChannel('quick-ask:shortcut-status', callback),
  onResetSession: (callback) => onChannel('quick-ask:reset-session', callback),
  onWindowShown: (callback) => onChannel('quick-ask:window-shown', callback),
  onPrepareHide: (callback) => onChannel('quick-ask:prepare-hide', callback),
  onFocusInput: (callback) => onChannel('quick-ask:focus-input', callback),
});

contextBridge.exposeInMainWorld('explorerApi', {
  getStatus: () => request('GET', '/explorer/status'),
  openLogin: (source) =>
    request('POST', '/explorer/auth/open-login', { source }),
  runNow: (source) => request('POST', '/explorer/run-now', { source }),
  resetCache: (source, conversationId) =>
    request('POST', '/explorer/reset-cache', { source, conversationId }),
  revokeIngestedMemory: (source, scope) =>
    request('POST', '/explorer/revoke-ingested-memory', { source, scope }),
  preview: ({ source, conversationId, limit } = {}) => {
    const params = new URLSearchParams();
    if (source) params.set('source', source);
    if (conversationId) params.set('conversationId', conversationId);
    if (limit !== undefined) params.set('limit', String(limit));
    const query = params.toString();
    return request(
      'GET',
      query ? `/explorer/preview?${query}` : '/explorer/preview',
    );
  },
  listMemories: ({ source, query, limit, offset } = {}) => {
    const params = new URLSearchParams();
    if (source) params.set('source', source);
    if (query) params.set('q', query);
    if (limit !== undefined) params.set('limit', String(limit));
    if (offset !== undefined) params.set('offset', String(offset));
    const qs = params.toString();
    return request(
      'GET',
      qs ? `/explorer/memories?${qs}` : '/explorer/memories',
    );
  },
  testWebpageMcp: () => request('GET', '/explorer/webpage-mcp/status'),
  testWebpageMcpConnection: () => request('POST', '/explorer/webpage-mcp/test'),
});
