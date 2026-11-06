import assert from 'node:assert/strict';
import { scheduleBase, authorizedScheduleSender, composeScheduleTask, handleScheduleBridge, createComposeSchedule, scheduleDeliveryMarkers } from '../src/scheduleService.js';
import { jiraScheduleSpec, prepareJiraSharedRule } from '../src/scheduleJira.js';
const state: Record<string, any> = {};
const requests: any[] = [];
let openCount = 0;
(globalThis as any).chrome = {
  storage: { local: { get: async (key: string) => ({ [key]: state[key] }), set: async (v: any) => Object.assign(state, v), remove: async (key: string) => { delete state[key]; } } },
  runtime: { id: 'extension-id', getURL: (p: string) => `chrome-extension://extension-id/${p}`, getManifest: () => ({ version: '12.2.0' }) },
  tabs: { create: async () => { openCount++; } },
};
(globalThis as any).fetch = async (url: string, init: any) => {
  requests.push({ url, init });
  const payload = url.endsWith('/extension/info') ? { schemaVersion: 1, handshake: { minExtensionVersion: '12.0.0' } }
    : url.endsWith('/me') ? { id: 'receiver', email: 'receiver@example.test' }
    : url.endsWith('/tasks') ? { task: { id: 'tsk_one' }, missing: [] } : { importId: 'imp_one', results: [] };
  return { ok: true, json: async () => payload };
};
assert.equal(scheduleBase('https://schedule.test/'), 'https://schedule.test');
for (const bad of ['javascript:alert(1)', 'https://user:secret@schedule.test', 'https://schedule.test/?secret=x']) assert.throws(() => scheduleBase(bad));
const sender = { id: 'extension-id', url: 'https://schedule.test/share/shr_one', frameId: 0 };
assert(authorizedScheduleSender(sender, 'https://schedule.test'));
assert(!authorizedScheduleSender({ ...sender, url: 'https://schedule.test.evil/share/shr_one' }, 'https://schedule.test'));
assert(!authorizedScheduleSender({ ...sender, frameId: 1 }, 'https://schedule.test'));
assert.throws(() => composeScheduleTask({ content: 'hello', chatId: 'chat', scheduledAt: '2000-01-01' }));
const compose = { content: 'hello', topic: 'future', chatId: 'chat', scheduledAt: new Date(Date.now() + 3600000).toISOString() };
const pending = await createComposeSchedule(compose);
assert.equal(pending.setupRequired, true); assert.equal(openCount, 1); assert.equal(requests.length, 0);
state.personalScheduleConnection = { baseUrl: 'https://schedule.test', token: 'receiver-secret' };
const results = await Promise.all([createComposeSchedule(compose), createComposeSchedule(compose)]);
assert.equal(results[0].messageId, results[1].messageId);
assert.equal(requests.filter(r => r.url.endsWith('/tasks')).length, 1);
const msg = { action: 'hello', schemaVersion: 1, shareToken: 'shr_one' };
assert.equal((await handleScheduleBridge(msg, sender)).account, 'receiver@example.test');
const count = requests.length;
await assert.rejects(handleScheduleBridge(msg, { ...sender, url: 'https://evil.test/' }));
await assert.rejects(handleScheduleBridge({ ...msg, schemaVersion: 999 }, sender));
await assert.rejects(handleScheduleBridge({ ...msg, action: 'import', selected: [] }, sender));
assert.equal(requests.length, count);
const rule = { name: 'Source', state: 'ENABLED', actorAccountId: 'source-actor', authorAccountId: 'source-author',
  trigger: { type: 'jira.incoming.webhook', value: { webhookToken: 'SOURCE-SECRET' } }, components: [], projects: [] };
const artifact = prepareJiraSharedRule(rule);
assert.equal(artifact.rules[0].state, 'DISABLED'); assert.equal(artifact.rules[0].actorAccountId, 'TARGET_ACTOR');
assert(!JSON.stringify(artifact).includes('SOURCE-SECRET')); assert(!JSON.stringify(artifact).includes('source-actor'));
assert.equal(rule.state, 'ENABLED'); assert.equal(rule.trigger.value.webhookToken, 'SOURCE-SECRET');
console.log('Schedule client: authorization, schema, configuration continuation, duplicate click and source credential isolation checks passed');

assert.equal(jiraScheduleSpec({ method: 'CRON', cronExpression: '0 30 9 ? * 2-6 *' }, 'Asia/Shanghai').expr, '0 30 9 * * 1-5');
assert.equal(jiraScheduleSpec({ method: 'FIXED', rate: 2, rateInterval: 3600 }, 'UTC').intervalMinutes, 120);
assert.throws(() => jiraScheduleSpec({ method: 'CRON', cronExpression: '0 0 9 L * ?' }, 'UTC'));

// Exercise the existing Jira request path with controlled HTTP responses.
// No live rule is created, enabled or touched by this verifier.
const { previewJiraCompletion, completeJiraImport } = await import('../src/scheduleJira.js');
state.envConfig = { JIRA_BASE_URL: 'https://jira.test', JIRA_API_TOKEN: 'receiver-jira-secret' };
let target: any = null;
let jiraCreates = 0;
let failBind = true;
let denyProject = false;
const calls: any[] = [];
(globalThis as any).fetch = async (url: string, init: any) => {
  calls.push({url, init});
  let payload: any = {};
  let status = 200;
  if (url.startsWith('https://jira.test')) {
    if (url.includes('/rest/api/2/project/')) { payload = {id:'10010',key:'TARGET',projectTypeKey:'software'}; if(denyProject) status=403; }
    else if (url.endsWith('/myself')) payload = {key:'receiver-jira-actor'};
    else if (url.endsWith('/securetoken')) payload = {token:'FRESH-TARGET-WEBHOOK'};
    else if (url.endsWith('/rule') && init.method === 'POST') {
      jiraCreates++; target = {...JSON.parse(init.body),id:9001}; payload=target;
    } else if(url.endsWith('/rule')) payload=target?[target]:[];
    else throw new Error('Unexpected Jira request');
  } else if(url.endsWith('/me')) payload={id:'receiver',email:'receiver@example.test'};
  else if(url.endsWith('/tasks/tsk_jira') && init.method === 'PATCH') {
    if(failBind) {failBind=false; throw new Error('simulated interrupted Schedule binding');}
    payload={task:{id:'tsk_jira'}};
  } else if(url.endsWith('/tasks/tsk_jira')) payload={id:'tsk_jira',type:'jira_automation',config:{jiraRuleRef:{jiraUrl:'https://source-no-access.test',projectId:'SOURCE',ruleId:'1'},jiraRuleExport:artifact}};
  return {ok:status===200,status,json:async()=>payload};
};
const preview = await previewJiraCompletion('tsk_jira','TARGET');
assert.equal(preview.payload.actorAccountId,'receiver-jira-actor');
assert.equal(preview.payload.state,'DISABLED');
assert.equal(preview.payload.trigger.type,'jira.incoming.webhook');
assert(!calls.some(c=>c.url.includes('source-no-access')));
await assert.rejects(completeJiraImport('tsk_jira',preview), /interrupted Schedule binding/);
assert.equal(jiraCreates,1);
const bound = await completeJiraImport('tsk_jira',preview);
assert.equal(bound.ruleId,'9001'); assert.equal(jiraCreates,1,'retry reuses disabled target rule');
assert.equal(target.state,'DISABLED'); assert.equal(target.trigger.value.webhookToken,'FRESH-TARGET-WEBHOOK');
assert(!calls.some(c=>c.init.method==='PUT'),'never edits source rule');
const before=calls.length; denyProject=true;
await assert.rejects(previewJiraCompletion('tsk_jira','TARGET'),/403/);
assert.equal(jiraCreates,1);
assert(calls.slice(before).every(c=>!['POST','PUT','PATCH'].includes(c.init.method)));
console.log('JIRA controlled HTTP: no source permission required, target actor/token remap, disabled-only create, interrupted binding retry without duplicate rule, target 403 refusal passed');

(globalThis as any).fetch = async (url: string) => ({ok:true,json:async()=>url.endsWith('/runs')
  ? [{id:'run-delivered',status:'succeeded',result:{evidence:{chatId:'chat',postId:'post'}},finished_at:123,occ_key:'slot'}, {id:'unknown',status:'unknown',result:{evidence:{chatId:'chat',postId:'wrong'}}}]
  : [{id:'tsk_one',config:{glipSource:'compose'}}]});
const markers = await scheduleDeliveryMarkers();
assert.deepEqual(markers.delivered,['tsk_one']); assert.equal(markers.markers.chat.post[0].source,'schedule_service'); assert.equal(markers.markers.chat.wrong,undefined);
