import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import playwright from '../desktop-app/node_modules/playwright/index.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'multica-edit-e2e-'));
const calls = [];
const writes = [];
const api = http.createServer((req, res) => {
  calls.push(req.url);
  const data = {
    '/api/workspaces': [{ id: 'ws_fixture', slug: 'fixture', name: 'Fixture workspace' }],
    '/api/agents': [{ id: 'agent_fixture', name: 'Fixture agent' }],
    '/api/projects': [{ id: 'project_fixture', name: 'Last project' }, { id: 'project_saved', name: 'Saved task project' }],
    '/api/runtimes': [],
  };
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data[req.url] || {}));
});
let context;
try {
  await new Promise(resolve => api.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${api.address().port}`;
  const base = {
    Topic: 'Saved Multica task', Content: 'Find the status', Schedule_Date: '2099-11-20', Schedule_Time: '09:00',
    Push_Method: 'AgentTask', Status: 'Active', Exec_Count: '1', Agent_Provider: 'multica',
    Last_Exec: '2026-11-04 09:00', Exec_Log: '✅ 推送成功', Schedule_Revision: '',
    Glip_User_Name: 'fixture.user', Target_Type: 'private',
    Agent_Binding_ID: '11111111-1111-4111-8111-111111111111', Agent_Provision_State: 'ready',
    Agent_Multica_Api_Origin: origin, Agent_Multica_Web_Origin: origin, Agent_Multica_User_ID: 'user_fixture',
    Agent_Multica_Workspace_ID: 'ws_fixture', Agent_Multica_Workspace_Slug: 'fixture',
    Agent_Multica_Project_ID: 'project_saved', Agent_Multica_Agent_ID: 'agent_fixture',
    Agent_Multica_Autopilot_ID: 'ap_fixture', Agent_Multica_Trigger_ID: 'tg_fixture',
  };
  const rows = [{ ID: 'saved_multica', ...base }, { ...base, ID: 'saved_memory', Topic: 'Saved Memory task', Agent_Provider: 'legacy_memory' },
    { ...base, ID: 'saved_bot', Topic: 'Rearm Bot task', Push_Method: 'Bot', Agent_Provider: '' }];
  const headers = Object.keys(rows[0]);
  context = await playwright.chromium.launchPersistentContext(profile, {
    channel: 'chromium', headless: true,
    args: [`--disable-extensions-except=${root}/dist`, `--load-extension=${root}/dist`],
  });
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  const id = new URL(worker.url()).host;
  await worker.evaluate(async ({ origin }) => {
    await chrome.storage.local.clear();
    await chrome.storage.local.set({
      multicaConnectionRemembered: {
        apiOrigin: origin, webOrigin: origin, pat: 'private_fixture', userId: 'user_fixture',
        accountLabel: 'Fixture account', workspaceId: 'ws_fixture', workspaceSlug: 'fixture',
        allowedWorkspaceIds: ['ws_fixture'], remember: true,
      },
      multicaTaskDefaults: { [`${origin}|user_fixture`]: {
        workspaceId: 'ws_fixture', workspaceSlug: 'fixture', agentId: 'agent_fixture', projectId: 'project_fixture',
      } },
      scheduledMessagesConfig: {
        sheetId: 'fixture_sheet', messagesSheetId: 101, logsSheetId: 102, sheet_version: '2.14',
        appScriptVersion: '3.2.3', webAppUrl: 'https://script.google.com/macros/s/fixture/exec',
        botAutomation: { executorRule: { ruleId: '1646', ruleVersion: '1.8.1', projectKey: 'MTR',
          webhookUrl: 'https://jira.example.com/hooks/executor', jiraUrl: 'https://jira.example.com' } },
      },
    });
  }, { origin });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    chrome.identity.getAuthToken = (_options, callback) => callback('fixture_oauth');
    chrome.identity.removeCachedAuthToken = (_options, callback) => callback();
  });
  await page.route('https://sheets.googleapis.com/**', async route => {
    const req = route.request(); const url = decodeURIComponent(req.url());
    if (req.method() === 'PUT' && url.includes('/values/Messages!')) {
      const values = req.postDataJSON().values[0];
      const row = Object.fromEntries(headers.map((key, i) => [key, values[i] ?? '']));
      writes.push(row); Object.assign(rows.find(item => item.ID === row.ID), row);
    }
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(
      url.includes('/values/Messages?') ? { values: [headers, ...rows.map(row => headers.map(key => row[key] || ''))] }
      : url.includes('/values/Messages!1:1') ? { values: [headers] } : {}) });
  });
  await page.route('https://www.googleapis.com/**', route => route.fulfill({ contentType: 'application/json', body: '{"email":"fixture@example.test"}' }));
  await page.route('http://localhost:3210/**', route => route.fulfill({ contentType: 'application/json', body: '{"items":[],"executors":[]}' }));
  await page.route('https://jira.example.com/**', route => route.fulfill({ contentType: 'application/json', body: '{}' }));
  await page.route('https://script.google.com/**', route => route.fulfill({ contentType: 'application/json', body: '{"success":true,"ready":true,"mode":"sheet_primary","spreadsheetId":"fixture_sheet","executionStoreSchemaVersion":1,"scriptVersion":"3.2.3"}' }));
  await page.goto(`chrome-extension://${id}/scheduled-messages.html`);
  await page.locator('h1', { hasText: '定时消息管理' }).waitFor();
  const fold = page.getByTestId('agent-execution-config');
  const panel = page.getByRole('region', { name: '连接你的 Multica' });
  const select = label => panel.locator('label').filter({ hasText: label }).locator('select');
  const openEdit = async topic => {
    const row = page.locator('tr').filter({ hasText: topic });
    await row.getByRole('button', { name: /编辑/ }).click();
    await fold.waitFor();
    assert.equal(await fold.getAttribute('open'), null);
    if (topic === 'Saved Multica task') await page.screenshot({ path: path.join(root, 'test-results/multica-edit-collapsed.png') });
    await fold.locator('summary').click();
  };
  const todayFuture = await page.evaluate(() => {
    const d = new Date(Date.now() + 5 * 60000);
    return { date: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`,
      time: `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}` };
  });
  await page.locator('tr').filter({ hasText: 'Rearm Bot task' }).getByRole('button', { name: /编辑/ }).click();
  await page.locator('input[type=date]').fill(todayFuture.date);
  await page.locator('input[type=time]').first().fill(todayFuture.time);
  await page.getByRole('button', { name: '✅ 保存修改', exact: true }).click();
  await page.waitForFunction(() => !document.querySelector('input[type=date]'));
  const saved = writes.find(row => row.ID === 'saved_bot');
  assert.ok(saved, 'saving reaches Sheets');
  assert.equal(saved.Last_Exec, ''); assert.match(saved.Exec_Log, /待执行/);
  assert.match(saved.Schedule_Revision, /^[0-9a-f-]{36}$/);
  assert.equal(Number(saved.Exec_Count), 1, 'rescheduling preserves count');
  assert.equal(saved.Schedule_Time, todayFuture.time);
  await page.goto(`chrome-extension://${id}/scheduled-messages.html`);
  await page.locator('h1', { hasText: '定时消息管理' }).waitFor();
  await openEdit('Saved Multica task');
  await panel.getByText(/已复用.*本机 PAT/).waitFor();
  assert.equal(await select('Workspace').inputValue(), 'ws_fixture');
  assert.equal(await select('Agent').inputValue(), 'agent_fixture');
  assert.equal(await select('Project').inputValue(), 'project_saved', 'edit keeps task project instead of last default');
  assert.equal(await panel.locator('input[type=password]').inputValue(), '', 'PAT stays in worker');
  assert.ok(await panel.getByRole('button', { name: '重新检查连接' }).isEnabled());
  await fold.getByLabel(/保存时新建 Autopilot/).check();
  await panel.getByText(/已复用.*本机 PAT/).waitFor();
  assert.equal(await select('Project').inputValue(), 'project_fixture');
  await fold.getByRole('button', { name: '现有 Memory 执行器', exact: true }).click();
  assert.equal(await panel.count(), 0);
  await page.getByRole('button', { name: '取消', exact: true }).click();

  await openEdit('Saved Memory task');
  await fold.getByRole('button', { name: 'Multica', exact: true }).click();
  await panel.getByText(/已复用.*本机 PAT/).waitFor();
  assert.equal(await select('Project').inputValue(), 'project_fixture');
  await select('Project').selectOption('project_saved');
  await page.waitForFunction(async () => {
    const { multicaTaskDefaults } = await chrome.storage.local.get('multicaTaskDefaults');
    return Object.values(multicaTaskDefaults || {}).some(item => item.projectId === 'project_saved');
  });
  await page.getByRole('button', { name: '取消', exact: true }).click();
  await page.getByRole('button', { name: /新增/ }).click();
  await page.getByRole('tab', { name: /帮我做/ }).click();
  await panel.getByText(/已复用.*本机 PAT/).waitFor();
  assert.equal(await select('Workspace').inputValue(), 'ws_fixture');
  assert.equal(await select('Project').inputValue(), 'project_saved');
  assert.equal(await select('Agent').inputValue(), 'agent_fixture');
  assert.equal(await panel.locator('input[type=password]').inputValue(), '');
  assert.equal(calls.some(url => /autopilots/.test(url)), false, 'opening/editing never provisions remotely');
  assert.deepEqual(errors, []);
  console.log('PASS: future-time save rearms with revision/count preserved; collapsed editing, cached PAT, provider switch and defaults');
} finally {
  await context?.close();
  await new Promise(resolve => api.close(resolve));
  await fs.rm(profile, { recursive: true, force: true });
}
