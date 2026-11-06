import { authorizedScheduleSender, scheduleBase, scheduleConnection, SCHEDULE_CONNECTION_KEY } from './scheduleService';

export const SCHEDULE_LOGIN_PROTOCOL = 1;
const CHALLENGE_KEY = 'personalScheduleEmailChallenge';
const verifying = new Set<string>();
let bindingGeneration = 0;
const inFlight = new Set<number>();
const usedRequests = new Map<string, number>();

function secureBase(value: string): string {
  const base = scheduleBase(value);
  if (new URL(base).protocol !== 'https:') throw new Error('邮箱绑定及自动登录需要受信 HTTPS，请先完成站点证书配置');
  if (new URL(base).pathname !== '/') throw new Error('Schedule 登录服务地址请使用站点根地址');
  return base;
}
function ownOptions(sender: chrome.runtime.MessageSender): boolean {
  try {
    const url = new URL(sender.url || '');
    return sender.id === chrome.runtime.id && url.origin === new URL(chrome.runtime.getURL('options.html')).origin &&
      url.pathname === '/options.html' && !sender.tab?.url?.startsWith('http');
  } catch { return false; }
}
async function authFetch(base: string, path: string, body?: unknown, bearer?: string, cookies = false) {
  let response: Response;
  try {
    response = await fetch(`${base}/api/v1${path}`, {
      method: body === undefined ? 'GET' : 'POST', redirect: 'error', cache: 'no-store',
      credentials: cookies ? 'include' : 'omit', signal: AbortSignal.timeout(20000),
      headers: { 'Content-Type': 'application/json', ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch { throw new Error('无法安全连接 Schedule，请检查受信 HTTPS 与服务可用性'); }
  const data = await response.json().catch(() => ({}));
  // Never relay server error text: it could contain a credential or email code.
  if (!response.ok) throw new Error(`Schedule 身份验证失败 (${response.status})，请重新验证邮箱或检查账号权限`);
  return data;
}
async function mailAvailable(base: string) {
  const meta = await authFetch(base, '/auth/meta');
  if (meta.emailLogin !== true || meta.resendConfigured !== true || meta.devFallback === true) {
    throw new Error('本站真实邮件发送尚未配置，暂不能通过邮箱绑定设备');
  }
}

/** Only Options may request/verify codes. No website can enroll a device. */
export async function handleScheduleAuth(request: any, sender: chrome.runtime.MessageSender) {
  if (!ownOptions(sender)) throw new Error('请在扩展 Options 完成邮箱验证与设备绑定');
  if (request.action === 'disconnect') {
    bindingGeneration++;
    await chrome.storage.local.remove(CHALLENGE_KEY);
    await chrome.storage.local.remove(SCHEDULE_CONNECTION_KEY);
    return { disconnected: true };
  }
  const base = secureBase(String(request.baseUrl || ''));
  const email = String(request.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('请输入有效邮箱');
  // Do not duplicate the server's new-registration domain policy: existing
  // administrators outside that domain must remain eligible to authenticate.
  if (request.action === 'request-code') {
    bindingGeneration++;
    await mailAvailable(base);
    await authFetch(base, '/auth/email/request', { email });
    const challengeId = crypto.randomUUID();
    // Persist only public challenge metadata so MV3 worker suspension while
    // the user reads their email does not invalidate a legitimate code.
    await chrome.storage.local.set({ [CHALLENGE_KEY]: { challengeId, baseUrl: base, email, expiresAt: Date.now() + 10 * 60000 } });
    return { challengeId, email };
  }
  if (request.action !== 'verify-code') throw new Error('Unsupported Schedule authentication action');
  const challengeId = String(request.challengeId || '');
  const challenge = (await chrome.storage.local.get(CHALLENGE_KEY))[CHALLENGE_KEY];
  if (!challengeId || !challenge || challenge.challengeId !== challengeId || challenge.baseUrl !== base || challenge.email !== email || challenge.expiresAt <= Date.now()) {
    throw new Error('验证请求已失效，请重新获取验证码');
  }
  const code = String(request.code || '');
  if (!/^\d{6}$/.test(code)) throw new Error('请输入 6 位邮箱验证码');
  if (verifying.has(challengeId)) throw new Error('邮箱验证正在进行，请稍候');
  verifying.add(challengeId);
  const generation = bindingGeneration;
  try {
    await chrome.storage.local.remove(CHALLENGE_KEY);
    const verified = await authFetch(base, '/auth/email/verify', { email, code }, undefined, true);
    if (!verified.user?.id || verified.user.isGuest || String(verified.user.email).toLowerCase() !== email) {
      throw new Error('邮箱身份不匹配，设备未绑定');
    }
    // Backend session is HttpOnly. Mint a separate revocable device credential;
    // the full token is consumed here, never returned to Options or the website.
    const issued = await authFetch(base, '/auth/tokens', { label: `Personal AI 设备 ${crypto.randomUUID().slice(0, 8)}` }, undefined, true);
    if (typeof issued.token !== 'string' || !/^pst_[A-Za-z0-9_-]+$/.test(issued.token)) throw new Error('设备凭据响应无效');
    const me = await authFetch(base, '/me', undefined, issued.token);
    if (me.id !== verified.user.id || me.isGuest) throw new Error('设备身份不匹配，绑定未保存');
    if (bindingGeneration !== generation) throw new Error('绑定请求已取消，请重新验证邮箱');
    await chrome.storage.local.set({ [SCHEDULE_CONNECTION_KEY]: { baseUrl: base, token: issued.token, allowWebLogin: true } });
    return { email: me.email, bound: true };
  } finally { verifying.delete(challengeId); }
}

/** One-use ticket is delivered to our isolated script, never to page JS. */
export async function handleScheduleLogin(request: any, sender: chrome.runtime.MessageSender) {
  const c = await scheduleConnection();
  if (!c || !authorizedScheduleSender(sender, c.baseUrl) || sender.tab?.id === undefined) throw new Error('请先在扩展中绑定本站账号');
  if (!c.allowWebLogin) throw new Error('请先在扩展 Options 重新验证邮箱并授权网页登录');
  const base = secureBase(c.baseUrl);
  if (request.schemaVersion !== 1 || !/^[a-f0-9]{32}$/.test(request.requestId || '')) throw new Error('登录请求不兼容');
  const tabId = sender.tab.id;
  if (inFlight.has(tabId)) throw new Error('此页面已有登录请求');
  const nonceKey = `${tabId}:${request.requestId}`;
  usedRequests.forEach((expiresAt, key) => { if (expiresAt <= Date.now()) usedRequests.delete(key); });
  if (usedRequests.has(nonceKey) || usedRequests.size >= 1024) throw new Error('登录请求已使用，请刷新页面');
  usedRequests.set(nonceKey, Date.now() + 60000);
  inFlight.add(tabId);
  try {
    const meta = await authFetch(base, '/auth/meta');
    if (meta.extensionLogin?.schemaVersion !== SCHEDULE_LOGIN_PROTOCOL || meta.extensionLogin?.enabled !== true) {
      throw new Error('本站尚未提供一次性扩展登录协议，请使用邮箱登录');
    }
    const me = await authFetch(base, '/me', undefined, c.token);
    if (!me.id || me.isGuest) throw new Error('设备绑定已失效，请重新验证邮箱');
    const result = await authFetch(base, '/auth/extension/ticket', { requestId: request.requestId, origin: new URL(base).origin }, c.token);
    if (result.requestId !== request.requestId || typeof result.ticket !== 'string' ||
      !/^[A-Za-z0-9_-]{32,512}$/.test(result.ticket) || !Number.isFinite(result.expiresAt) ||
      result.expiresAt <= Date.now() || result.expiresAt > Date.now() + 60000) throw new Error('一次性登录凭据响应无效');
    // Detect account switches/unbinding while the network request was pending.
    const current = await scheduleConnection();
    if (current?.baseUrl !== c.baseUrl || current?.token !== c.token) throw new Error('账号绑定已变更，请重新登录');
    return { ticket: result.ticket, requestId: result.requestId, expiresAt: result.expiresAt, userId: me.id };
  } finally { inFlight.delete(tabId); }
}
