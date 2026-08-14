/**
 * Roadmap JQL 导入端到端校验。
 *
 * 关键点：roadmap 页面和 Jira 不同源，MV3 内容脚本的 fetch 仍受宿主页面 CORS 约束，
 * 所以 Jira REST 必须由 service worker 代发。本脚本用一个本地 fixture 当 Jira：
 * 页面从 http://localhost:3220 加载，JIRA_BASE_URL 指向 http://127.0.0.1:3220，
 * 两者跨源且 fixture 不返回任何 CORS 头 —— 内容脚本直连必然失败，只有走代理才能通。
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import playwright from '../desktop-app/node_modules/playwright/index.js';

const { chromium } = playwright;

const PORT = 3220;
const PAGE_ORIGIN = `http://localhost:${PORT}`;
const JIRA_ORIGIN = `http://127.0.0.1:${PORT}`;
const JIRA_TOKEN = 'roadmap-fixture-token';

const repoRoot = process.cwd();
const distPath = path.join(repoRoot, 'dist');
const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'personal-ai-roadmap-jql-'));

const pageHtml = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Roadmap fixture</title>
    <script>
      window.__paiLog = { hello: false, ack: null, result: null, directFetchError: null };
      window.addEventListener('message', (ev) => {
        const data = ev.data || {};
        if (data.type === 'pai-roadmap-hello') window.__paiLog.hello = true;
        if (data.type === 'pai-roadmap-import-jql-ack') window.__paiLog.ack = Date.now();
        if (data.type === 'pai-roadmap-import-jql-result') window.__paiLog.result = data;
      });
      window.startImport = function (requestId) {
        window.__paiLog.started = Date.now();
        window.postMessage(
          {
            type: 'pai-roadmap-import-jql',
            requestId,
            jql: 'project = NOVA AND "Target Delivery Quarter" in (2026Q1)',
            quarters: ['2026Q3'],
          },
          '*',
        );
      };
      // 复现旧实现：页面/内容脚本直连 Jira 会被 CORS 拦掉，用来证明代理不是多余的
      window.probeDirectJiraFetch = async function (url) {
        try {
          await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: '{}',
          });
          return null;
        } catch (error) {
          return String(error && error.message ? error.message : error);
        }
      };
    </script>
  </head>
  <body>
    <h1>Roadmap fixture</h1>
  </body>
</html>`;

const jiraRequests = [];

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname === '/rest/api/2/search') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      // 只记真正的查询；跨源直连会先发 OPTIONS 预检，那条不算查询到达
      if (req.method !== 'OPTIONS') {
        jiraRequests.push({
          host: req.headers.host,
          origin: req.headers.origin || null,
          authorization: req.headers.authorization || null,
          body: JSON.parse(body || '{}'),
        });
      }
      // 故意不返回任何 Access-Control-* 头
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          total: 1,
          issues: [
            {
              key: 'NOVA-1',
              fields: {
                summary: 'Fixture epic',
                issuetype: { name: 'Epic' },
                customfield_21998: { value: '2026Q3' },
                customfield_25757: 10,
                customfield_18350: '2026-07-01',
                customfield_18351: '2026-08-01',
              },
            },
          ],
        }),
      );
    });
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(pageHtml);
});

await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(PORT, resolve);
});

const context = await chromium.launchPersistentContext(userDataDir, {
  channel: 'chromium',
  headless: true,
  args: [
    `--disable-extensions-except=${distPath}`,
    `--load-extension=${distPath}`,
  ],
});

try {
  let [worker] = context.serviceWorkers();
  if (!worker) worker = await context.waitForEvent('serviceworker', { timeout: 30000 });
  const extensionId = new URL(worker.url()).host;

  await worker.evaluate(
    ({ jiraBaseUrl, token }) =>
      chrome.storage.local.set({
        envConfig: {
          JIRA_BASE_URL: jiraBaseUrl,
          JIRA_API_TOKEN: token,
          // 填齐 meeting 字段，避免 getEnvConfig 再向 SW 自己发一轮消息
          MEETING_PROVIDER_BASE_URL: 'http://127.0.0.1:9/meeting',
          MEETING_PROVIDER_API_KEY: 'fixture',
        },
      }),
    { jiraBaseUrl: JIRA_ORIGIN, token: JIRA_TOKEN },
  );

  const page = await context.newPage();
  await page.goto(`${PAGE_ORIGIN}/`);
  await page.waitForFunction(() => window.__paiLog?.hello === true, null, { timeout: 20000 });

  const directFetchError = await page.evaluate(
    (url) => window.probeDirectJiraFetch(url),
    `${JIRA_ORIGIN}/rest/api/2/search`,
  );
  assert.ok(
    directFetchError,
    'fixture 必须是跨源且无 CORS 头，直连要失败，否则这个用例证明不了代理的必要性',
  );
  assert.equal(
    jiraRequests.length,
    0,
    '直连止步于 CORS 预检，真正的 search 请求不会发出（页面 Network 面板看不到查询，正是用户报的现象）',
  );

  await page.evaluate(() => window.startImport('req-fixture-1'));

  await page.waitForFunction(() => window.__paiLog?.ack !== null, null, { timeout: 5000 });
  const ackDelay = await page.evaluate(() => window.__paiLog.ack - window.__paiLog.started);
  assert.ok(ackDelay < 4000, `内容脚本必须在 4s 内回执，实际 ${ackDelay}ms`);

  await page.waitForFunction(() => window.__paiLog?.result !== null, null, { timeout: 30000 });
  const result = await page.evaluate(() => window.__paiLog.result);

  assert.equal(result.requestId, 'req-fixture-1', '结果必须带回原请求 id');
  assert.equal(result.ok, true, `导入应成功，实际错误：${result.error}`);
  assert.deepEqual(
    result.items,
    [
      {
        key: 'NOVA-1',
        type: 'Epic',
        title: 'Fixture epic',
        quarter: '2026Q3',
        estimate: 2,
        targetStart: '2026-07-01',
        targetEnd: '2026-08-01',
      },
    ],
    'Jira issue 应映射成 roadmap 导入项（DEV Estimate 10 人日 → 2 周）',
  );

  assert.equal(jiraRequests.length, 1, 'service worker 应代发且只发一次 search 请求');
  const [jiraRequest] = jiraRequests;
  assert.equal(jiraRequest.host, `127.0.0.1:${PORT}`, '代理应打到配置的 Jira origin');
  assert.equal(
    jiraRequest.authorization,
    `Bearer ${JIRA_TOKEN}`,
    'token 应由扩展上下文附加，不经过页面',
  );
  assert.equal(
    jiraRequest.body.jql,
    'project = NOVA AND "Target Delivery Quarter" in (2026Q3)',
    'quarter 子句应被替换成本次导入的 quarters',
  );

  // 代理只允许打到当前配置的 Jira origin
  // `share-modal.html` immediately redirects to Help Center, which destroys the
  // page context before the runtime reply arrives. Use a stable extension page
  // so this assertion continues to exercise the real message boundary.
  const guardPage = await context.newPage();
  await guardPage.goto(`chrome-extension://${extensionId}/popup.html`);
  const blocked = await guardPage.evaluate(() =>
    chrome.runtime.sendMessage({
      type: 'PERSONAL_AI_JIRA_PROXY_FETCH',
      url: 'https://evil.example.com/rest/api/2/search',
      method: 'POST',
    }),
  );
  assert.equal(blocked.success, false, '非 Jira origin 的代理请求必须被拒绝');
  assert.match(blocked.error, /代理仅允许访问/, '拒绝原因应说明 origin 白名单');

  console.log('Roadmap JQL import extension E2E passed');
} finally {
  await context.close();
  await new Promise((resolve) => server.close(resolve));
  fs.rmSync(userDataDir, { recursive: true, force: true });
}
