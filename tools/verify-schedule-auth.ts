import assert from 'node:assert/strict';
import { handleScheduleAuth, handleScheduleLogin } from '../src/scheduleAuth.js';
const state: Record<string, any> = {};
const calls: Array<{url: string; init: any}> = [];
let mail = true, enabled = true, rejectToken = false, badIdentity = false, failTLS = false;
let signedWeb = false, wrongGuest = false;
const deviceToken = 'pst_FIXTURE_DEVICE_SECRET';
const baseUrl = 'https://schedule.fixture.test';
const email = 'receiver@ringcentral.com';
(globalThis as any).chrome = {
  runtime: { id: 'test-extension', getURL: (path: string) => `chrome-extension://test-extension/${path}` },
  storage: { local: { get: async (key: string) => ({ [key]: state[key] }),
    set: async (data: any) => Object.assign(state, data), remove: async (key: string) => { delete state[key]; } } },
};
(globalThis as any).fetch = async (url: string, init: any) => {
  calls.push({ url, init });
  if (failTLS) throw new Error('certificate invalid');
  let value: any = {}, status = 200;
  if (url.endsWith('/auth/meta')) value = { emailLogin: true, resendConfigured: mail, devFallback: !mail,
    loginBridge: { enabled, nonceTtlSec: 120, channel: 'personal-schedule-extension-v1' } };
  else if (url.endsWith('/auth/email/verify')) value = { user: { id: 'receiver', email: badIdentity ? 'other@ringcentral.com' : email } };
  else if (url.endsWith('/auth/tokens')) value = { token: deviceToken };
  else if (url.endsWith('/me')) { value = init.credentials === 'include'
    ? { id: wrongGuest ? 'other-guest' : 'guest', isGuest: !signedWeb } : { id: 'receiver', email }; if (rejectToken) status = 401; }
  else if (url.endsWith('/auth/bridge/exchange')) value = { user: { id: 'receiver', email } };
  return { ok: status === 200, status, json: async () => value };
};
const options = { id: 'test-extension', url: 'chrome-extension://test-extension/options.html' };
const page = { id: 'test-extension', url: `${baseUrl}/app`, frameId: 0, tab: { id: 1 } };
const request = { baseUrl, email, action: 'request-code' };
await assert.rejects(handleScheduleAuth(request, page), /Options/);
await assert.rejects(handleScheduleAuth({ ...request, baseUrl: 'http://schedule.fixture.test' }, options), /HTTPS/);
assert.equal(calls.length, 0);
mail = false;
await assert.rejects(handleScheduleAuth(request, options), /真实邮件/);
assert(!calls.some(c => c.url.endsWith('/email/request')));
mail = true; failTLS = true;
await assert.rejects(handleScheduleAuth(request, options), /HTTPS/);
failTLS = false;
const { challengeId } = await handleScheduleAuth(request, options);
await assert.rejects(handleScheduleAuth({ ...request, action: 'verify-code', challengeId, code: '123456', email: 'changed@ringcentral.com' }, options), /失效/);
const bound = await handleScheduleAuth({ ...request, action: 'verify-code', challengeId, code: '123456' }, options);
assert.deepEqual(bound, { email, bound: true });
assert(!JSON.stringify(bound).includes(deviceToken));
assert.equal(state.personalScheduleConnection.token, deviceToken);
await assert.rejects(handleScheduleAuth({ ...request, action: 'verify-code', challengeId, code: '123456' }, options), /失效/);
const login = (id: string, sender = page) => handleScheduleLogin({ schemaVersion: 1, nonce: id.repeat(32), initiatorId: 'guest' }, sender);
const before = calls.length;
await assert.rejects(login('a', { ...page, url: 'https://evil.fixture.test/app' }), /绑定/);
await assert.rejects(login('a', { ...page, frameId: 1 }), /绑定/);
await assert.rejects(login('a', { ...page, id: 'other-extension' }), /绑定/);
assert.equal(before, calls.length);
enabled = false;
await assert.rejects(login('b'), /一次性/);
assert(!calls.some(c => c.url.endsWith('/auth/login')));
enabled = true;
const exchanged = await login('c');
assert.equal(exchanged.userId, 'receiver'); assert(!JSON.stringify(exchanged).includes(deviceToken));
await assert.rejects(login('c'), /已使用/);
signedWeb = true;
await assert.rejects(login('e'), /身份已变更/);
signedWeb = false; wrongGuest = true;
await assert.rejects(login('f'), /身份已变更/);
wrongGuest = false;
rejectToken = true;
await assert.rejects(login('d'), /401/);
rejectToken = false; badIdentity = true;
const mismatch = await handleScheduleAuth(request, options);
await assert.rejects(handleScheduleAuth({ ...request, action: 'verify-code', challengeId: mismatch.challengeId, code: '123456' }, options), /不匹配/);
badIdentity = false;
await handleScheduleAuth({ action: 'disconnect' }, options);
assert(!state.personalScheduleConnection);
console.log('Schedule auth: trusted Options, HTTPS/TLS, real-mail gate, verified-only binding, replay, exact origin/frame/extension, missing protocol, revoked device and no PAT disclosure passed (controlled fetch).');
