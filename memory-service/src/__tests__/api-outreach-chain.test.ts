import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeAll, afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../server.js';
import { UserContextManager } from '../core/UserContextManager.js';
import { issueUserApiKey } from '../core/auth/userApiKeys.js';
import { OutreachRepository } from '../repositories/OutreachRepository.js';
import { resetConfigForTests } from '../config.js';
import { pathToFileURL } from 'node:url';

describe('Schedule outreach chain: actual HTTP routes and per-user databases', () => {
  let app: Awaited<ReturnType<typeof buildApp>>['app'];
  let manager: UserContextManager, directory: string, base: string, alice: string, bob: string, firstId: string;
  let repo: OutreachRepository;
  const previous = { API_KEY: process.env.API_KEY, BOOTSTRAP_API_KEY: process.env.BOOTSTRAP_API_KEY };
  const realFetch = globalThis.fetch;
  const templateId = 'schedule-chain-fixture';
  const scheduleSource=path.resolve(process.env.SCHEDULE_SOURCE || '../../personal-schedule/service','src');
  const occurrenceKey = 'fixture-task:1:2026-11-07T09:00';
  async function call(url: string, key = alice, body?: unknown, extra: Record<string, string> = {}) {
    const response = await realFetch(`${base}/api/v1${url}`, { method: body === undefined ? 'GET' : 'POST',
      headers: { ...(key ? { Authorization: `Bearer ${key}` } : {}), 'Content-Type': 'application/json', ...extra },
      body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, body: await response.json(), cacheControl: response.headers.get('cache-control') };
  }
  beforeAll(async () => {
    process.env.API_KEY = 'fixture-service-only'; delete process.env.BOOTSTRAP_API_KEY; resetConfigForTests();
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'outreach-chain-http-'));
    manager = new UserContextManager(directory);
    const a = manager.getContext('chain-alice'), b = manager.getContext('chain-bob');
    a.userDataManager.writeFile('config.json', JSON.stringify({ outreachEnabled: true, outreachRequireApprovalForManual: true }));
    alice = issueUserApiKey(a.db, a.userId, { scopes: ['memory.read', 'memory.write'] }).token;
    bob = issueUserApiKey(b.db, b.userId, { scopes: ['memory.read'] }).token;
    repo = new OutreachRepository(a.db);
    ({ app } = await buildApp({ userContextManager: manager }));
    base = await app.listen({ port: 0, host: '127.0.0.1' });
    const triggered = await call(`/outreach/templates/${templateId}/trigger-occurrence`, alice, {
      sourceSystem: 'schedule_service', occurrenceKey, scheduledFor: Math.floor(Date.now()/1000)+3600,
      template: { question: 'Controlled fixture question', recipients: ['fixture-chat'], approvalPolicy: 'always_review', maxFollowup: 3 },
    });
    expect(triggered.status).toBe(200); firstId = triggered.body.session.id;
    await call(`/outreach/templates/${templateId}/trigger-occurrence`, alice, {
      sourceSystem: 'schedule_service', occurrenceKey: 'fixture-task:1:next', scheduledFor: Math.floor(Date.now()/1000)+7200,
    });
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
  afterAll(async () => {
    await app?.close(); manager?.closeAll(); if(directory) fs.rmSync(directory, {recursive:true,force:true});
    for (const [key,value] of Object.entries(previous)) { if(value===undefined) delete process.env[key]; else process.env[key]=value; }
    resetConfigForTests();
  });
  it('projects exact occurrence, actual approval history, stable paging and no external call/write', async () => {
    // Approval still belongs to the existing engine; resolve fixture identity
    // and retain a future send time so this route test never dispatches.
    repo.updateSession(firstId, { targetResolutionStatus:'resolved', targetResolvedChatId:'fixture-chat',
      targetResolvedType:'group', targetResolvedId:'fixture-chat', targetResolvedLabel:'Fixture group',
      nextCheckAt:Math.floor(Date.now()/1000)+3600 });
    expect((await call(`/outreach/sessions/${firstId}/approve`, alice, {})).status).toBe(200);
    // Fixture history only: no real message is sent or claimed to be received.
    repo.createEvent(firstId, 'reply_received', { replyText: 'Fixture reply', classification: 'later' });
    repo.createEvent(firstId, 'followup_sent', { followupCount: 1, postId: 'fixture-post' });
    const before = JSON.stringify(repo.getSessionById(firstId));
    const external = vi.fn(() => { throw new Error('GET must not call external services'); }); vi.stubGlobal('fetch', external);
    const query = `/outreach/sessions?templateId=${templateId}&occurrenceKey=${encodeURIComponent(occurrenceKey)}&includeHistory=1&eventLimit=2`;
    const result = await call(query);
    expect(result.status).toBe(200); expect(result.body).toMatchObject({ schemaVersion:1, total:1, historyIncluded:true, timeUnit:'unix_seconds' });
    expect(result.cacheControl).toBe('private, no-store');
    const item = result.body.items[0];
    expect(item).toMatchObject({ id:firstId, occurrenceKey, status:'scheduled', businessRef:{id:firstId}, history:{total:4,hasMore:true} });
    expect(item.events.map((e: any) => e.eventType)).toEqual(['created','approved']);
    const next = await call(query+'&eventOffset=2');
    expect(next.body.items[0].events.map((e: any) => e.eventType)).toEqual(['reply_received','followup_sent']);
    expect(next.body.items[0].history.hasMore).toBe(false);
    expect(external).not.toHaveBeenCalled();
    // Authorization updates personal-key lastUsedAt; business rows must stay unchanged.
    expect(repo.getSessionById(firstId)?.status).toBe('scheduled');
    expect(JSON.stringify(repo.getSessionById(firstId))).toBe(before);
    expect(repo.listEventsBySession(firstId)).toHaveLength(4);
    const out = path.resolve('..','test-results','outreach-chain'); fs.mkdirSync(out,{recursive:true});
    fs.writeFileSync(path.join(out,'sample.json'), JSON.stringify({ transport:'actual local Memory HTTP; fixture business events, no RC send',request:query,response:result.body,secondPage:next.body },null,2));
  });
  it('isolates the same template and occurrence across personal keys, and rejects impersonation', async () => {
    const query = `/outreach/sessions?templateId=${templateId}&occurrenceKey=${encodeURIComponent(occurrenceKey)}&includeHistory=true`;
    const other = await call(query,bob);
    expect(other.body).toMatchObject({items:[],total:0,emptyReason:'no_sessions'});
    expect((await call(`/outreach/sessions/${firstId}`,bob)).status).toBe(404);
    expect((await call(query,bob,undefined,{'X-User-Id':'chain-alice'})).status).toBe(403);
    expect((await call(query,'')).status).toBe(401);
    const reader=issueUserApiKey(manager.getContext('chain-alice').db,'chain-alice',{scopes:['memory.read']}).token;
    expect((await call(query,reader)).status).toBe(200);
    expect((await call(`/outreach/sessions/${firstId}/cancel`,reader,{})).status).toBe(403);
  });
  it('keeps all occurrences separate, legacy list unchanged and stable session pagination', async () => {
    const all = await call(`/outreach/sessions?templateId=${templateId}&includeHistory=1&limit=1`);
    const next = await call(`/outreach/sessions?templateId=${templateId}&includeHistory=1&limit=1&offset=1`);
    expect(all.body.total).toBe(2); expect(all.body.hasMore).toBe(true);
    expect(all.body.items[0].id).not.toBe(next.body.items[0].id);
    const legacy = await call(`/outreach/sessions?templateId=${templateId}`);
    expect(legacy.body.total).toBe(2); expect(legacy.body.items[0].events).toBeUndefined();
    expect((await call(`/outreach/sessions?templateId=${templateId}&occurrenceKey=missing&includeHistory=1`)).body.emptyReason).toBe('no_sessions');
  });
  it('preserves every existing business state, reply and follow-up fields without inventing progress', async () => {
    for (const status of ['pending_approval','scheduled','waiting_reply','deferred','resolved','no_reply','escalated','cancelled','failed'] as const) {
      repo.updateSession(firstId,{status,followupCount:1,replyRawText:'Fixture reply',replyClassification:'later',
        waitUntil:Math.floor(Date.now()/1000)+86400,nextCheckAt:Math.floor(Date.now()/1000)+60});
      const response=await call(`/outreach/sessions?templateId=${templateId}&occurrenceKey=${encodeURIComponent(occurrenceKey)}&includeHistory=1`);
      expect(response.body.items[0]).toMatchObject({status,followupCount:1,maxFollowup:3,replyRawText:'Fixture reply',replyClassification:'later'});
    }
    repo.updateSession(firstId,{status:'scheduled'});
  });
  it.skipIf(!fs.existsSync(path.join(scheduleSource,'server.js')))('serves the existing Schedule proxy through real Memory HTTP; history opt-in remains a Schedule handoff', async () => {
    const source=scheduleSource;
    const {openDb}=await import(pathToFileURL(path.join(source,'db.js')).href);
    const {buildApp:buildSchedule}=await import(pathToFileURL(path.join(source,'server.js')).href);
    const {listen}=await import(pathToFileURL(path.join(source,'http.js')).href);
    const scheduleDb=openDb(':memory:'); const built=buildSchedule(scheduleDb);
    const server=await listen(built.app,{port:0,host:'127.0.0.1'});
    try {
      const address=`http://127.0.0.1:${server.address().port}`;
      const token=built.services.auth.issueToken(built.services.auth.ensureUser('schedule-chain@example.test').id);
      const request=async(endpoint:string,method='GET',body?:unknown)=>{
        const response=await realFetch(`${address}/api/v1${endpoint}`,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
        expect(response.ok).toBe(true);return response.json();
      };
      await request('/connections/memory','PUT',{baseUrl:base,userKey:alice});
      const created=await request('/tasks','POST',{type:'outreach',title:'Proxy fixture',content:'Never execute',
        scheduleSpec:{kind:'one_shot',dateTime:Math.floor(Date.now()/1000)+86400,timezone:'UTC'},config:{memoryTemplateId:templateId}});
      const response=await request(`/tasks/${created.task.id}/chain`);
      expect(response).toMatchObject({available:true,source:'memory:outreach',sessions:{total:2}});
      expect(response.sessions.items.map((s:any)=>s.templateId)).toEqual([templateId,templateId]);
      const direct=await call(`/outreach/sessions?templateId=${templateId}&occurrenceKey=${encodeURIComponent(occurrenceKey)}&includeHistory=1`);
      expect(direct.body.items[0].events.length).toBeGreaterThan(0);
      const out=path.resolve('..','test-results','outreach-chain');fs.mkdirSync(out,{recursive:true});
      fs.writeFileSync(path.join(out,'cross-service.json'),JSON.stringify({transport:'actual local Schedule + Memory HTTP, no proxy mock',
        available:response.available,source:response.source,sessionCount:response.sessions.total,customTemplateMapping:true,
        historyOptInAvailable:direct.body.historyIncluded,taskEnabled:false,businessMessagesSent:0},null,2));
    } finally { server.closeAllConnections();await new Promise<void>(resolve=>server.close(resolve));scheduleDb.close(); }
  });
  it('rejects malformed queries and distinguishes transient failure from empty success', async () => {
    for (const query of ['includeHistory=1','includeHistory=bad','templateId=x&includeHistory=1&eventLimit=201','templateId=x&includeHistory=1&offset=-1','occurrenceKey=unscoped']) {
      expect((await call(`/outreach/sessions?${query}`)).status).toBe(400);
    }
    vi.spyOn(OutreachRepository.prototype,'listEventsPage').mockImplementation(()=>{throw new Error('controlled database read failure');});
    const failed = await call(`/outreach/sessions?templateId=${templateId}&includeHistory=1`);
    expect(failed.status).toBe(503); expect(failed.body).toEqual({error:'outreach_chain_unavailable',retryable:true});
  });
});
