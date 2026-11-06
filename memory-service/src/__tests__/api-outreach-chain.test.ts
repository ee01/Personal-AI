import fs from 'node:fs';
import Database from 'better-sqlite3';
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
  const capUrl = () => `/outreach/sessions/${firstId}/increase-followup-limit`;
  function waiting(status: 'waiting_reply' | 'deferred' = 'waiting_reply') {
    repo.updateSession(firstId, { status, maxFollowup:3, followupCount:1,
      waitUntil:2000000000, nextCheckAt:1999999900, lastPollAt:1999999800,
      sentChatId:'fixture-thread', sentPostId:'fixture-first-post' });
  }
  it('increases a waiting cap by exactly two without dispatch, reschedule or reset; exposes history', async () => {
    waiting(); const before = repo.getSessionById(firstId)!;
    const external = vi.fn(() => { throw new Error('cap change must not send'); }); vi.stubGlobal('fetch',external);
    const result = await call(capUrl(),alice,{requestId:'cap-waiting-request-01',expectedMaxFollowup:3});
    expect(result.status).toBe(200); expect(result.body).toMatchObject({replayed:false,appliedMaxFollowup:5});
    expect(result.body.session).toEqual({...before,maxFollowup:5,updatedAt:result.body.session.updatedAt});
    expect(external).not.toHaveBeenCalled();
    const history=await call(`/outreach/sessions?templateId=${templateId}&occurrenceKey=${encodeURIComponent(occurrenceKey)}&includeHistory=1`);
    const event=history.body.items[0].events.find((e:any)=>e.id===result.body.eventId);
    expect(event).toMatchObject({eventType:'followup_limit_increased',payload:{previousMaxFollowup:3,maxFollowup:5,increment:2,status:'waiting_reply'}});
    const out=path.resolve('..','test-results','outreach-cap');fs.mkdirSync(out,{recursive:true});
    fs.writeFileSync(path.join(out,'sample.json'),JSON.stringify({transport:'actual local HTTP; isolated fixtures; no external send',
      request:{method:'POST',path:capUrl(),body:{requestId:'cap-waiting-request-01',expectedMaxFollowup:3}},response:result.body,event},null,2));
  });
  it('serializes concurrent duplicate HTTP requests into one durable change and event', async () => {
    waiting(); const body={requestId:'cap-concurrent-same-01',expectedMaxFollowup:3};
    const results=await Promise.all(Array.from({length:8},()=>call(capUrl(),alice,body)));
    expect(results.map(r=>r.status)).toEqual(Array(8).fill(200));
    expect(results.filter(r=>!r.body.replayed)).toHaveLength(1);
    expect(new Set(results.map(r=>r.body.eventId)).size).toBe(1);
    expect(repo.getSessionById(firstId)?.maxFollowup).toBe(5);
    expect(repo.listEventsBySession(firstId).filter(e=>e.payload?.requestId===body.requestId)).toHaveLength(1);
    const secondConnection=new Database(manager.getContext('chain-alice').db.name);
    try {
      const fresh=new OutreachRepository(secondConnection);
      expect(fresh.increaseFollowupLimit(firstId,body.requestId,3).replayed).toBe(true);
      expect(fresh.getSessionById(firstId)?.maxFollowup).toBe(5);
    } finally { secondConnection.close(); }
  });
  it('rejects concurrent distinct clicks with the same old cap; permits a deliberate next increment', async () => {
    waiting();
    const results=await Promise.all(['cap-distinct-click-01','cap-distinct-click-02'].map(requestId=>call(capUrl(),alice,{requestId,expectedMaxFollowup:3})));
    expect(results.map(r=>r.status).sort()).toEqual([200,409]);
    expect(repo.getSessionById(firstId)?.maxFollowup).toBe(5);
    expect((await call(capUrl(),alice,{requestId:'cap-deliberate-next-01',expectedMaxFollowup:5})).body.session.maxFollowup).toBe(7);
  });
  it('rejects receipt reuse with a different body and never reopens a terminal session on replay', async () => {
    waiting(); const body={requestId:'cap-replay-terminal-01',expectedMaxFollowup:3};
    expect((await call(capUrl(),alice,body)).status).toBe(200);
    expect((await call(capUrl(),alice,{...body,expectedMaxFollowup:5})).body.error).toBe('idempotency_conflict');
    repo.updateSession(firstId,{status:'resolved',resolvedAt:1999999999});
    const before=repo.getSessionById(firstId);
    const replay=await call(capUrl(),alice,body);
    expect(replay.body).toMatchObject({replayed:true,session:{status:'resolved',maxFollowup:5}});
    expect(repo.getSessionById(firstId)).toEqual(before);
  });
  it('preserves deferred timing and rejects every non-waiting state without writes', async () => {
    waiting('deferred');
    expect((await call(capUrl(),alice,{requestId:'cap-deferred-request-01',expectedMaxFollowup:3})).body.session).toMatchObject({status:'deferred',maxFollowup:5,nextCheckAt:1999999900,waitUntil:2000000000,followupCount:1});
    for(const status of ['pending_approval','scheduled','resolved','no_reply','escalated','cancelled','failed'] as const) {
      repo.updateSession(firstId,{status});const before=repo.getSessionById(firstId);const count=repo.listEventsBySession(firstId).length;
      const response=await call(capUrl(),alice,{requestId:`cap-invalid-${status}-01`,expectedMaxFollowup:5});
      expect(response.status).toBe(409);expect(response.body.error).toBe('outreach_session_not_waiting');
      expect(repo.getSessionById(firstId)).toEqual(before);expect(repo.listEventsBySession(firstId)).toHaveLength(count);
    }
  });
  it('requires owner write scope and refuses foreign identities and unknown sessions', async () => {
    const body={requestId:'cap-ownership-request-01',expectedMaxFollowup:3};
    const own=manager.getContext('chain-alice'),other=manager.getContext('chain-bob');
    const reader=issueUserApiKey(own.db,own.userId,{scopes:['memory.read']}).token;
    const otherWriter=issueUserApiKey(other.db,other.userId,{scopes:['memory.read','memory.write']}).token;
    // Existing write guard rejects unauthenticated writes before auth middleware.
    expect((await call(capUrl(),'',body)).status).toBe(403);
    expect((await call(capUrl(),reader,body)).status).toBe(403);
    expect((await call(capUrl(),otherWriter,body)).status).toBe(404);
    expect((await call(capUrl(),otherWriter,body,{'X-User-Id':own.userId})).status).toBe(403);
    expect((await call('/outreach/sessions/missing/increase-followup-limit',alice,body)).status).toBe(404);
  });
  it('rejects malformed inputs and unsafe numeric overflow without partially applying', async () => {
    waiting();
    for(const body of [{},{requestId:'short',expectedMaxFollowup:3},{requestId:'cap-invalid-input-01',expectedMaxFollowup:'3'},
      {requestId:'cap-invalid-input-01',expectedMaxFollowup:-1},{requestId:'cap-invalid-input-01',expectedMaxFollowup:1.5},
      {requestId:'cap-invalid-input-01',expectedMaxFollowup:3,increment:99}]) {
      expect((await call(capUrl(),alice,body)).status).toBe(400);
    }
    repo.updateSession(firstId,{maxFollowup:9});
    expect((await call(capUrl(),alice,{requestId:'cap-above-ten-request-01',expectedMaxFollowup:9})).body.session.maxFollowup).toBe(11);
    repo.updateSession(firstId,{maxFollowup:Number.MAX_SAFE_INTEGER});
    expect((await call(capUrl(),alice,{requestId:'cap-overflow-request-01',expectedMaxFollowup:Number.MAX_SAFE_INTEGER})).body.error).toBe('followup_limit_overflow');
    expect(repo.getSessionById(firstId)?.maxFollowup).toBe(Number.MAX_SAFE_INTEGER);
  });
  it('rolls back the cap when history persistence fails, then safely retries', async () => {
    waiting();const db=manager.getContext('chain-alice').db;
    db.exec(`CREATE TEMP TRIGGER fail_cap_event BEFORE INSERT ON outreach_events WHEN NEW.event_type = 'followup_limit_increased' BEGIN SELECT RAISE(ABORT, 'controlled failure'); END`);
    const body={requestId:'cap-rollback-request-01',expectedMaxFollowup:3};
    try {
      expect((await call(capUrl(),alice,body)).status).toBe(503);
      expect(repo.getSessionById(firstId)?.maxFollowup).toBe(3);
      expect(repo.listEventsBySession(firstId).some(e=>e.payload?.requestId===body.requestId)).toBe(false);
    } finally { db.exec('DROP TRIGGER fail_cap_event'); }
    expect((await call(capUrl(),alice,body)).body).toMatchObject({replayed:false,appliedMaxFollowup:5});
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
