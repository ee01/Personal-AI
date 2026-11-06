/** Extension-owned Schedule credentials. Never expose tokens to a web page. */
export interface ScheduleConnection { baseUrl: string; token: string; allowWebLogin?: boolean }
export const SCHEDULE_CONNECTION_KEY = 'personalScheduleConnection';
export const SCHEDULE_PENDING_KEY = 'personalSchedulePending';
export function scheduleBase(value: string): string {
  const url = new URL(value);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error('请输入有效的 Schedule Service 地址');
  }
  return url.href.replace(/\/+$/, '');
}
export async function scheduleConnection(): Promise<ScheduleConnection | null> {
  const data = await chrome.storage.local.get(SCHEDULE_CONNECTION_KEY);
  const c = data[SCHEDULE_CONNECTION_KEY];
  return c?.baseUrl && c?.token ? { baseUrl: scheduleBase(c.baseUrl), token: c.token, allowWebLogin: c.allowWebLogin === true } : null;
}
export async function scheduleApi(path: string, method = 'GET', body?: unknown, connection?: ScheduleConnection): Promise<any> {
  const c = connection || await scheduleConnection();
  if (!c) throw new Error('请先配置 Personal Schedule');
  if (!path.startsWith('/') || path.startsWith('//')) throw new Error('Invalid Schedule path');
  const response = await fetch(`${c.baseUrl}/api/v1${path}`, {
    method, headers: { Authorization: `Bearer ${c.token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body), redirect: 'error',
    signal: AbortSignal.timeout(20000),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(`Schedule 请求失败 (${response.status})：${result.error || '请检查连接与权限'}`);
  return result;
}
export async function openSchedule(): Promise<void> {
  const c = await scheduleConnection();
  await chrome.tabs.create({ url: c ? `${c.baseUrl}/app` : chrome.runtime.getURL('options.html#personal-schedule-config') });
}
export function composeScheduleTask(data: any) {
  const dateTime = Math.floor(new Date(data.scheduledAt).getTime() / 1000);
  if (!data.content?.trim() || !data.chatId || !Number.isFinite(dateTime) || dateTime * 1000 <= Date.now()) {
    throw new Error('请检查消息内容、目标会话及未来发送时间');
  }
  return { type: 'asme', title: data.topic || '定时发送消息', content: data.content,
    scheduleSpec: { kind: 'one_shot', dateTime, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone },
    config: { chatId: String(data.chatId), glipSource: 'compose' } };
}
const creating = new Map<string, Promise<any>>();
export async function createComposeSchedule(data: any): Promise<any> {
  const task = composeScheduleTask(data);
  const connection = await scheduleConnection();
  const owner = connection ? await scheduleApi('/me') : null;
  const key = JSON.stringify([connection?.baseUrl, owner?.id, task]);
  if (creating.has(key)) return creating.get(key);
  const work = (async () => {
    if (!await scheduleConnection()) {
      await chrome.storage.local.set({ [SCHEDULE_PENDING_KEY]: { kind: 'compose', data, savedAt: Date.now() } });
      await openSchedule();
      return { success: false, setupRequired: true, error: '请在已打开的设置页配置 Personal Schedule，保存后将继续提交' };
    }
    const saved = await chrome.storage.local.get('personalScheduleComposeReceipt');
    if (saved.personalScheduleComposeReceipt?.key === key) {
      if (saved.personalScheduleComposeReceipt.result) return saved.personalScheduleComposeReceipt.result;
      if (!saved.personalScheduleComposeReceipt.idempotencyKey) throw new Error('此前提交结果未知，请先在 Schedule 任务列表核对，避免重复发送');
    }
    const idempotencyKey = saved.personalScheduleComposeReceipt?.key === key
      ? saved.personalScheduleComposeReceipt.idempotencyKey : crypto.randomUUID();
    await chrome.storage.local.set({ personalScheduleComposeReceipt: { key, state: 'creating', idempotencyKey } });
    const payload = await scheduleApi('/tasks', 'POST', { ...task, idempotencyKey });
    const result = { success: true, messageId: payload.task.id, task: payload.task,
      ringCentralSenderConfigured: !payload.missing?.length };
    await chrome.storage.local.set({ personalScheduleComposeReceipt: { key, result } });
    await chrome.storage.local.remove(SCHEDULE_PENDING_KEY);
    return result;
  })();
  creating.set(key, work);
  try { return await work; } finally { creating.delete(key); }
}
export function authorizedScheduleSender(sender: chrome.runtime.MessageSender, baseUrl: string): boolean {
  try { return sender.id === chrome.runtime.id && sender.frameId === 0 &&
    new URL(sender.url || '').origin === new URL(baseUrl).origin; } catch { return false; }
}
export async function handleScheduleBridge(request: any, sender: chrome.runtime.MessageSender): Promise<any> {
  const c = await scheduleConnection();
  if (!c || !authorizedScheduleSender(sender, c.baseUrl)) throw new Error('请先在扩展设置中授权此 Schedule 网站');
  if (request.schemaVersion !== 1) throw new Error('分享格式不兼容，请升级扩展');
  const token = String(request.shareToken || '');
  if (!/^shr_[A-Za-z0-9_-]+$/.test(token)) throw new Error('Invalid share token');
  if (request.action === 'hello') {
    const info = await scheduleApi('/extension/info');
    const version = chrome.runtime.getManifest().version;
    const required = String(info.handshake?.minExtensionVersion || '0').split('.').map(Number);
    const actual = version.split('.').map(Number);
    const index = required.findIndex((n: number, i: number) => n !== (actual[i] || 0));
    if (info.schemaVersion !== 1 || index >= 0 && required[index] > (actual[index] || 0)) throw new Error('需要升级 Personal AI 扩展');
    const me = await scheduleApi('/me');
    return { version: chrome.runtime.getManifest().version, schemaVersion: 1, account: me.email };
  }
  if (request.action === 'preview') return scheduleApi(`/shares/${encodeURIComponent(token)}`);
  if (request.action === 'import') {
    if (!Array.isArray(request.selected) || !request.selected.length || request.selected.length > 1000 ||
        request.selected.some((s: unknown) => typeof s !== 'string') || !request.requestId) throw new Error('请选择要导入的任务');
    return scheduleApi(`/shares/${encodeURIComponent(token)}/import`, 'POST', {
      selected: [...new Set(request.selected)], requestId: String(request.requestId), confirmDuplicates: request.confirmDuplicates === true,
    });
  }
  if (request.action === 'retry' && /^imp_[A-Za-z0-9_-]+$/.test(request.importId)) {
    return scheduleApi(`/imports/${encodeURIComponent(request.importId)}/retry`, 'POST', {});
  }
  throw new Error('Unsupported Schedule action');
}
export async function registerScheduleBridge(): Promise<void> {
  const c = await scheduleConnection();
  const scripting = chrome.scripting as typeof chrome.scripting & {
    unregisterContentScripts(filter: { ids: string[] }): Promise<void>;
    registerContentScripts(scripts: Array<{ id: string; matches: string[]; js: string[]; runAt: 'document_idle'; allFrames: boolean }>): Promise<void>;
  };
  await scripting.unregisterContentScripts({ ids: ['personal-schedule'] }).catch(() => undefined);
  if (c && !['http://schedule.xmnup.com', 'https://schedule.xmnup.com', 'http://localhost:3230', 'http://127.0.0.1:3230'].includes(new URL(c.baseUrl).origin)) await scripting.registerContentScripts([{ id: 'personal-schedule',
    matches: [`${new URL(c.baseUrl).origin}/*`], js: ['contentScriptSchedule.js'], runAt: 'document_idle', allFrames: false }]);
  // Installation and account setup also reach share tabs that are already open.
  // Content scripts registered after navigation otherwise need a manual reload.
  const origins = c ? [new URL(c.baseUrl).origin] : ['http://schedule.xmnup.com', 'https://schedule.xmnup.com'];
  const tabs = await chrome.tabs.query({ url: origins.map(origin => `${origin}/*`) });
  await Promise.all(tabs.filter(tab => tab.id !== undefined).map(tab =>
    chrome.scripting.executeScript({ target: { tabId: tab.id! }, files: ['contentScriptSchedule.js'] }).catch(() => undefined)));
}

/** Confirm pending Glip previews from delivery evidence, never from elapsed time. */
export async function scheduleDeliveryMarkers() {
  const empty = { markers: {} as Record<string, Record<string, any[]>>, delivered: [] as string[] };
  if (!await scheduleConnection()) return empty;
  const tasks = await scheduleApi('/tasks?type=asme');
  const candidates = tasks.filter((t: any) => t.config?.glipSource === 'compose').slice(0, 20);
  await Promise.all(candidates.map(async (task: any) => {
    const runs = await scheduleApi(`/tasks/${encodeURIComponent(task.id)}/runs`);
    for (const run of runs) {
      const evidence = run.result?.evidence;
      if (run.status !== 'succeeded' || !evidence?.chatId || !evidence?.postId) continue;
      empty.delivered.push(task.id);
      const chat = String(evidence.chatId); const post = String(evidence.postId);
      empty.markers[chat] ||= {};
      empty.markers[chat][post] = [{ id: `schedule:${run.id}`, type: 'scheduled_asme', label: '定时发送',
        chatId: chat, postId: post, source: 'schedule_service', sourceId: run.id,
        updatedAt: run.finished_at || run.updated_at, metadata: { messageId: task.id, executionKey: run.occ_key } }];
    }
  }));
  return empty;
}
