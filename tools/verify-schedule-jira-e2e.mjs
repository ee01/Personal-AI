import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import playwright from '../desktop-app/node_modules/playwright/index.js';

// Actual extension and Schedule HTTP. Jira is a deliberately controlled HTTP
// fixture: this test must never be reported as production Jira creation proof.
const live = process.env.SCHEDULE_LIVE_URL;
const source = path.resolve(process.env.SCHEDULE_SOURCE || '../personal-schedule/service');
let scheduleServer, db, services, context, sharePage;
let baseUrl = live;
let ownerToken, receiverToken;
const createdIds = new Map(); const shares = []; const tags = [];
const results = [];
const screenshots = path.resolve(process.env.SCHEDULE_SCREENSHOTS || 'test-results/schedule-contract');
await fs.mkdir(screenshots, { recursive: true });
const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'e184-jira-browser-'));
let sourceAccess = true, targetRule = null, createCount = 0, forbiddenSourceReads = 0, hookCalls = 0;
const memoryRuns = new Map(); const memoryReads = [];
const sourceRule = { id: 101, name: 'E184 controlled JIRA rule', state: 'ENABLED', projects: [{ projectId: '10' }],
  actorAccountId: 'source-actor', authorAccountId: 'source-author', components: [],
  trigger: { type: 'jira.incoming.webhook', value: { webhookToken: 'SOURCE-ONLY-SECRET', searchOrProvide: 'none', jql: null } } };
const jira = http.createServer(async (req, res) => {
  let body = ''; for await (const chunk of req) body += chunk;
  const url = req.url; let data = {}; let status = 200;
  if (url === '/api/v1/agent-tasks/execute') {
    const input = JSON.parse(body); const actionId = `fixture-action-${memoryRuns.size + 1}`;
    memoryRuns.set(actionId, { runId: actionId, taskId: input.taskId, scheduleSpec: input.scheduleSpec,
      status: 'succeeded', summaryForOwner: 'PRIVATE fixture summary; never publish this', attachments: [] });
    status = 202; data = { accepted: true, actionId, notificationOwner: 'memory', publishOwner: 'schedule_service' };
  } else if (url.startsWith('/api/v1/agent-tasks/runs/')) {
    const actionId = url.split('/')[5]; memoryReads.push(actionId); data = memoryRuns.get(actionId) || {}; if (!memoryRuns.has(actionId)) status = 404;
  } else if (url.startsWith('/rest/api/2/project/')) {
    const id = decodeURIComponent(url.split('/').pop());
    if (id === 'SOURCE' || id === '10') {
      if (!sourceAccess) { forbiddenSourceReads++; status = 403; }
      data = { id: '10', key: 'SOURCE', projectTypeKey: 'software' };
    } else data = { id: '20', key: 'TARGET', projectTypeKey: 'software' };
  } else if (url.endsWith('/myself')) data = { key: 'receiver-actor' };
  else if (url === '/rest/cb-automation/latest/project/10/rule') {
    if (!sourceAccess) { forbiddenSourceReads++; status = 403; } data = [sourceRule];
  } else if (url.endsWith('/securetoken')) data = { token: 'FRESH-TARGET-ONLY' };
  else if (url === '/rest/cb-automation/latest/project/20/rule' && req.method === 'POST') {
    createCount++; targetRule = { ...JSON.parse(body), id: 9001 }; data = targetRule;
  } else if (url === '/rest/cb-automation/latest/project/20/rule') data = targetRule ? [targetRule] : [];
  else if (url.includes('/hooks/')) { hookCalls++; status = 500; data = { error: 'Business execution forbidden in this test' }; }
  else { status = 404; data = { error: 'Unknown fixture route' }; }
  res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data));
});
await new Promise(resolve => jira.listen(0, '127.0.0.1', resolve));
const jiraUrl = `http://127.0.0.1:${jira.address().port}`;
const api = async (endpoint, method = 'GET', body, token = receiverToken) => {
  const response = await fetch(`${baseUrl}/api/v1${endpoint}`, { method, signal: AbortSignal.timeout(12000),
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const value = await response.json();
  assert(response.ok, `${endpoint}: ${response.status} ${value.error || ''}`); return value;
};
try {
  if (live) {
    // Reuse the task-authorized E credential in process memory only. Never log,
    // persist, put in the page URL, or include it in screenshots/artifacts.
    const secret = execFileSync('ssh', ['-o','BatchMode=yes','-o','ConnectTimeout=5','rcadmin@10.32.56.212', 'cat ~/personal-schedule/BOOTSTRAP_TOKEN.txt'], { encoding: 'utf8' });
    ownerToken = secret.match(/pst_[A-Za-z0-9_-]+/)?.[0]; assert(ownerToken, 'authorized test credential unavailable');
    receiverToken = ownerToken;
  } else {
    const { openDb } = await import(pathToFileURL(path.join(source, 'src/db.js')));
    const { buildApp } = await import(pathToFileURL(path.join(source, 'src/server.js')));
    const { listen } = await import(pathToFileURL(path.join(source, 'src/http.js')));
    db = openDb(':memory:'); const built = buildApp(db); services = built.services;
    scheduleServer = await listen(built.app, { port: 0, host: '127.0.0.1' });
    baseUrl = `http://127.0.0.1:${scheduleServer.address().port}`;
    ownerToken = services.auth.issueToken(services.auth.ensureUser('e184-owner@example.test').id);
    receiverToken = services.auth.issueToken(services.auth.ensureUser('e184-receiver@example.test').id);
  }
  context = await playwright.chromium.launchPersistentContext(profile, { channel: 'chromium', headless: true, timeout: 30000,
    args: [`--disable-extensions-except=${path.resolve('dist')}`, `--load-extension=${path.resolve('dist')}`] });
  let [worker] = context.serviceWorkers(); if (!worker) worker = await context.waitForEvent('serviceworker');
  const extensionId = new URL(worker.url()).host;
  await worker.evaluate(async ({ baseUrl, token, jiraUrl }) => chrome.storage.local.set({
    personalScheduleConnection: { baseUrl, token }, envConfig: { JIRA_BASE_URL: jiraUrl, JIRA_API_TOKEN: 'fixture-receiver-only' },
  }), { baseUrl, token: ownerToken, jiraUrl });
  const options = await context.newPage(); await options.goto(`chrome-extension://${extensionId}/options.html`);
  const hosted = await options.evaluate(data => chrome.runtime.sendMessage({ type: 'HOST_SCHEDULE_JIRA', data }), {
    projectKey: 'SOURCE', projectId: '10', ruleId: '101', content: 'Controlled fixture. Never execute.', scheduleSpec: { kind: 'rate', intervalMinutes: 120 },
  });
  assert(hosted.success, hosted.error); createdIds.set(hosted.taskId, ownerToken);
  const composeInput = { content: 'E184 browser scheduled message fixture', topic: 'E184 paused-by-missing-connection fixture',
    chatId: 'fixture-only-do-not-send', scheduledAt: new Date(Date.now() + 86400000).toISOString() };
  // Never enable these fixture tasks; no RC connection is needed to exercise creation.
  const composeResults = await options.evaluate(async data => Promise.all([
    chrome.runtime.sendMessage({ type: 'CREATE_GLIP_COMPOSE_SCHEDULED_MESSAGE', data }),
    chrome.runtime.sendMessage({ type: 'CREATE_GLIP_COMPOSE_SCHEDULED_MESSAGE', data }),
  ]), composeInput);
  assert(composeResults.every(r => r.success), composeResults.find(r => !r.success)?.error);
  assert.equal(composeResults[0].messageId, composeResults[1].messageId);
  createdIds.set(composeResults[0].messageId, ownerToken);
  await api(`/tasks/${composeResults[0].messageId}/status`, 'POST', { status: 'paused' }, ownerToken);
  const completion = options.locator('details').filter({ has: options.locator('summary').filter({ hasText: 'JIRA Automation 分享导出 / 导入补全' }) });
  await completion.locator('summary').click();
  const readTasks = () => completion.getByRole('button', { name: '读取我的 JIRA 任务', exact: true }).click();
  await readTasks(); await completion.locator(`option[value="${hosted.taskId}"]`).waitFor({ state: 'attached' });
  await completion.getByLabel('JIRA 计划任务').selectOption(hosted.taskId);
  await completion.getByRole('button', { name: '预览我准备的源规则', exact: true }).click();
  await completion.getByLabel('JIRA 规则内容').waitFor();
  await options.waitForFunction(() => document.querySelector('[aria-label="JIRA 规则内容"]')?.value.includes('"payload"'));
  const material = JSON.parse(await completion.getByLabel('JIRA 规则内容').inputValue());
  assert(material.payload); assert(!JSON.stringify(material).includes('SOURCE-ONLY-SECRET'));
  await completion.getByRole('button', { name: '确认授权此规则内容随分组分享', exact: true }).click();
  await completion.getByRole('status').filter({ hasText: '已授权导出内容' }).waitFor();
  const tag = await api('/tags', 'POST', { name: `E184 browser ${Date.now()}` }, ownerToken); tags.push(tag.id);
  await api(`/tasks/${hosted.taskId}`, 'PATCH', { tagIds: [tag.id] }, ownerToken);
  const { share } = await api(`/tags/${tag.id}/share`, 'POST', {}, ownerToken); shares.push(share.token);
  const shared = await api(`/shares/${share.token}`, 'GET', undefined, ownerToken);
  assert(shared.tasks[0].jiraRuleExport?.payload, 'reviewed material survives actual share API');
  assert(!JSON.stringify(shared).includes('SOURCE-ONLY-SECRET'));
  sourceAccess = false;
  await worker.evaluate(async ({ baseUrl, token }) => chrome.storage.local.set({ personalScheduleConnection: { baseUrl, token } }), { baseUrl, token: receiverToken });
  const page = await context.newPage(); sharePage = page; await page.goto(`${baseUrl}/share/${share.token}`);
  await options.evaluate(() => chrome.runtime.sendMessage({ type: 'SCHEDULE_SETUP_SAVED' }));
  const panel = page.locator('#personal-schedule-extension');
  await panel.getByRole('button', { name: '导入勾选任务', exact: true }).waitFor();
  await page.locator('#ext-banner').filter({ hasText: '已检测到 Personal AI 扩展' }).waitFor();
  await panel.getByRole('button', { name: '导入勾选任务', exact: true }).click();
  await panel.getByRole('status').filter({ hasText: 'imported_inactive' }).waitFor();
  let receiverTasks = await api('/tasks?type=jira_automation');
  const draft = receiverTasks.find(t => t.source_share_id === share.shareId && t.id !== hosted.taskId && t.config?.jiraImportState === 'pending_target');
  assert(draft, 'receiver draft with pending_target'); createdIds.set(draft.id, receiverToken);
  assert(draft.config.jiraRuleExport?.payload);
  await page.locator('#personal-schedule-extension').screenshot({ path: path.join(screenshots, `${live ? 'live' : 'local'}-jira-share.png`) });
  await readTasks(); await completion.locator(`option[value="${draft.id}"]`).waitFor({ state: 'attached' });
  await completion.getByLabel('JIRA 计划任务').selectOption(draft.id);
  await completion.getByLabel('目标 JIRA Project', { exact: true }).fill('TARGET');
  await completion.getByRole('button', { name: '校验目标项目并预览副本', exact: true }).click();
  await completion.getByText('已审查上述依赖', { exact: false }).waitFor();
  await completion.getByRole('checkbox', { name: '已审查上述依赖', exact: false }).check();
  let failOnce = true;
  await options.route(`**/api/v1/tasks/${draft.id}/jira-import`, async route => {
    const body = route.request().postDataJSON();
    if (body.state === 'created_disabled_needs_review' && failOnce) { failOnce = false; await route.fulfill({ status: 502, contentType: 'application/json', body: '{"error":"E184 simulated interrupted binding"}' }); }
    else await route.continue();
  });
  const create = completion.getByRole('button', { name: '创建或续绑目标副本', exact: true });
  await create.click(); await completion.getByRole('status').filter({ hasText: 'E184 simulated interrupted binding' }).waitFor();
  assert.equal(createCount, 1); assert.equal(targetRule.state, 'DISABLED');
  await create.click(); await completion.getByRole('status').filter({ hasText: '已创建并登记禁用副本' }).waitFor();
  assert.equal(createCount, 1, 'resume reuses the same target rule');
  let current = await api(`/tasks/${draft.id}`); assert.equal(current.config.jiraImportState, 'created_disabled_needs_review');
  assert(current.missing.includes('jiraImportState:created_disabled_needs_review'));
  await completion.getByRole('checkbox', { name: '我已在目标 JIRA 审查字段', exact: false }).check();
  const finish = completion.getByRole('button', { name: '核验目标规则并完成绑定', exact: true });
  await finish.click(); await completion.getByRole('status').filter({ hasText: '目标规则尚未启用' }).waitFor();
  targetRule.state = 'ENABLED'; // Fixture simulates human review/enable, not a Jira success claim.
  await finish.click(); await completion.getByRole('status').filter({ hasText: '已核验目标规则启用' }).waitFor();
  current = await api(`/tasks/${draft.id}`); assert.equal(current.config.jiraImportState, 'completed');
  assert.deepEqual(current.missing, []); assert.equal(current.status, 'paused');
  assert.equal(forbiddenSourceReads, 0, 'receiver never accesses the forbidden source project');
  assert.equal(hookCalls, 0, 'preview, import and completion never execute business rules');
  await completion.screenshot({ path: path.join(screenshots, `${live ? 'live' : 'local'}-jira-binding.png`) });
  if (!live) {
    // Actual Schedule Runner, controlled Memory result fixture. No model or RC
    // call: only explicit result selection and publication gating are exercised.
    await api('/connections/memory', 'PUT', { baseUrl: jiraUrl, userKey: 'fixture-only' });
    const { task: agent } = await api('/tasks', 'POST', { type: 'agent_task', title: 'E184 exact action results', content: 'Read-only fixture',
      scheduleSpec: { kind: 'rate', intervalMinutes: 120 }, status: 'paused', config: { executor: 'memory' },
      notify: { notifyMe: { mode: 'off' }, publish: { enabled: true, source: 'final_output', recipients: [{chatId:'fixture-no-send'}], identity: 'user' } } });
    createdIds.set(agent.id, receiverToken);
    const now = Math.floor(Date.now()/1000);
    for (let index = 0; index < 2; index++) {
      db.prepare("UPDATE tasks SET status='active', revision=revision+1, next_run_at=? WHERE id=?").run(now - 20 + index, agent.id);
      await services.runner.tick();
    }
    db.prepare("UPDATE tasks SET status='paused' WHERE id=?").run(agent.id);
    const runs = await options.evaluate(async ({baseUrl, taskId}) => {
      const {personalScheduleConnection:c} = await chrome.storage.local.get('personalScheduleConnection');
      return fetch(`${baseUrl}/api/v1/tasks/${taskId}/runs`, {headers:{Authorization:`Bearer ${c.token}`}}).then(r=>r.json());
    }, {baseUrl, taskId:agent.id});
    assert.equal(runs.length, 2); assert.equal(new Set(runs.map(r=>r.action_id)).size, 2);
    for(const run of runs) {
      assert.equal(run.result.runId, run.action_id); assert.equal(run.publish_status,'publish_paused');
      assert.equal(run.result.finalOutput, undefined); assert(memoryReads.includes(run.action_id));
    }
    results.push({ exactActionIdResults: true, occurrences: 2, privateSummaryFallback: false, missingBodyPauses: true, memory: 'controlled-result-fixture' });
  }
  results.push({ schedule: live ? 'deployed' : 'local-real', extension: 'fresh-dist', jira: 'controlled-http-fixture',
    reviewedPayload: true, v1Presence: true, noReceiverSourceAccess: true, targetCopies: createCount,
    bindingRetryReusesCopy: true, disabledGate: true, completedStillPaused: true, businessExecutions: hookCalls });
  console.log(JSON.stringify(results));
} catch (error) {
  const fixtureStatus = sharePage ? await sharePage.locator('#personal-schedule-extension').getByRole('status').innerText().catch(() => 'unavailable') : 'not opened';
  console.error(JSON.stringify({ failure: String(error.message).slice(0, 250), fixtureStatus: fixtureStatus.slice(0, 1000) }));
  throw error;
} finally {
  if (context) await context.close();
  for (const token of shares) await api(`/shares/${token}/revoke`, 'POST', {}, ownerToken).catch(() => {});
  for (const [id, token] of createdIds) await api(`/tasks/${id}`, 'DELETE', undefined, token).catch(() => {});
  for (const id of tags) await api(`/tags/${id}`, 'DELETE', undefined, ownerToken).catch(() => {});
  await fs.rm(profile, { recursive: true, force: true });
  await new Promise(resolve => jira.close(resolve));
  if (scheduleServer) await new Promise(resolve => scheduleServer.close(resolve));
  if (db) db.close();
}
