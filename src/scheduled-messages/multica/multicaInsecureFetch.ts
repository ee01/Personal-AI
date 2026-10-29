type PageFetchResult = {
  status: number;
  body: string;
  finalUrl: string;
  error?: string;
};

type LiveTab = {
  origin: string;
  tabId: number;
  timer: ReturnType<typeof setTimeout> | null;
};

let gate: Promise<void> = Promise.resolve();
let live: LiveTab | null = null;

export function assertHttpResponseStayed(requestUrl: string, finalUrl: string): void {
  const requested = new URL(requestUrl);
  const final = new URL(finalUrl);
  if (requested.protocol !== 'http:' || final.protocol !== 'http:' || requested.host !== final.host) {
    throw new Error('HTTP 响应跳到了别的地址，已停止，以免送出 PAT');
  }
}

export function fetchOnInsecureOrigin(url: string, init: RequestInit = {}): Promise<Response> {
  const run = gate.then(() => fetchOnInsecureOriginExclusive(url, init), () => fetchOnInsecureOriginExclusive(url, init));
  gate = run.then(() => undefined, () => undefined);
  return run;
}

async function fetchOnInsecureOriginExclusive(url: string, init: RequestInit): Promise<Response> {
  const target = new URL(url);
  if (target.protocol !== 'http:') throw new Error('只有 HTTP 地址使用页面通道');
  const tabId = await retainHttpTab(target.origin);
  try {
    const headers: Record<string, string> = {};
    new Headers(init.headers).forEach((value, key) => {
      headers[key] = value;
    });
    const method = (init.method || 'GET').toUpperCase();
    const body = typeof init.body === 'string' ? init.body : '';
    const [injected] = await chrome.scripting.executeScript({
      target: { tabId },
      func: performHttpFetch,
      args: [url, method, headers, body],
    });
    const result = injected?.result as PageFetchResult | undefined;
    if (!result) throw new Error('HTTP 页面没有返回结果');
    if (result.error) throw new Error(result.error);
    assertHttpResponseStayed(url, result.finalUrl || url);
    return new Response(result.body, { status: result.status });
  } finally {
    releaseHttpTab();
  }
}

async function retainHttpTab(origin: string): Promise<number> {
  if (live?.origin === origin) {
    if (live.timer) clearTimeout(live.timer);
    live.timer = null;
    try {
      await chrome.tabs.get(live.tabId);
      return live.tabId;
    } catch {
      live = null;
    }
  }
  if (live) {
    await chrome.tabs.remove(live.tabId).catch(() => undefined);
    live = null;
  }
  const tab = await chrome.tabs.create({ url: `${origin}/`, active: false });
  if (!tab.id) throw new Error('没有打开 HTTP 页面');
  try {
    await waitUntilComplete(tab.id);
  } catch (error) {
    await chrome.tabs.remove(tab.id).catch(() => undefined);
    throw error;
  }
  live = { origin, tabId: tab.id, timer: null };
  return tab.id;
}

function releaseHttpTab(): void {
  if (!live) return;
  const current = live;
  if (current.timer) clearTimeout(current.timer);
  current.timer = setTimeout(() => {
    if (live?.tabId !== current.tabId) return;
    chrome.tabs.remove(current.tabId).catch(() => undefined);
    live = null;
  }, 1500);
}

function waitUntilComplete(tabId: number): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      chrome.tabs.onUpdated.removeListener(listener);
      if (error) reject(error);
      else resolve();
    };
    const timeout = setTimeout(() => finish(new Error('HTTP 页面没有在 15 秒内打开')), 15000);
    const listener = (id: number, info: chrome.tabs.TabChangeInfo) => {
      if (id === tabId && info.status === 'complete') finish();
    };
    chrome.tabs.onUpdated.addListener(listener);
    chrome.tabs.get(tabId).then((tab) => {
      if (tab.status === 'complete') finish();
    }).catch(() => undefined);
  });
}

async function performHttpFetch(
  url: string,
  method: string,
  headers: Record<string, string>,
  body: string,
): Promise<PageFetchResult> {
  try {
    const response = await fetch(url, {
      method,
      headers,
      body: method === 'GET' || method === 'HEAD' || !body ? undefined : body,
      credentials: 'omit',
      redirect: 'manual',
    });
    if (response.type === 'opaqueredirect' || (response.status >= 300 && response.status < 400)) {
      return {
        status: response.status,
        body: '',
        finalUrl: url,
        error: '服务器要求跳转，已停止，以免把 PAT 送到别的地址',
      };
    }
    return { status: response.status, body: await response.text(), finalUrl: response.url || url };
  } catch (error) {
    const message = error && typeof error === 'object' && 'message' in error
      ? String((error as { message?: unknown }).message || '')
      : '';
    return { status: 0, body: '', finalUrl: url, error: message || 'HTTP 页面请求失败' };
  }
}
