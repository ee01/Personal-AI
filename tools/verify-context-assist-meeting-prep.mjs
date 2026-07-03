#!/usr/bin/env node
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import playwright from '../desktop-app/node_modules/playwright/index.js';

const { chromium } = playwright;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const contentScriptPath = path.join(
  repoRoot,
  'dist',
  'contentScriptRingCentralVideoHome.js',
);

const eventId = 'rc-event-context-assist-e2e';
const encodedEventId = Buffer.from(eventId, 'utf8').toString('base64url');
const fixtureUrl = `https://app.ringcentral.com/video/home/${encodedEventId}`;
const startTime = Date.now() + 25 * 60 * 1000;
const endTime = startTime + 30 * 60 * 1000;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function renderFixtureHtml() {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>RingCentral Video Home Fixture</title>
    <style>
      body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      main { display: grid; grid-template-columns: 360px minmax(420px, 1fr); min-height: 820px; gap: 24px; padding: 24px; }
      aside { border-right: 1px solid #e5e7eb; padding-right: 24px; }
      [data-at="calendar-event-item-wrapper"] { padding: 12px; border: 1px solid #2563eb; border-radius: 8px; }
      [data-test-automation-id="upcoming-meeting-detail-container"] { min-width: 420px; width: 520px; border: 1px solid #d1d5db; border-radius: 10px; padding: 20px; }
      button { font: inherit; }
    </style>
  </head>
  <body>
    <main>
      <aside>
        <div
          data-at="calendar-event-item-wrapper"
          data-calendar-event-item-id="${eventId}"
          aria-selected="true"
        >
          <strong>Nova weekly sync</strong>
          <button data-test-automation-id="calendar-event-item-join-button">Join</button>
        </div>
      </aside>
      <section data-test-automation-id="upcoming-meeting-detail-container">
        <h2>Nova weekly sync</h2>
        <p>Starts in 25 minutes</p>
        <p>Participants accepted: Sophia, Fred, Esone</p>
        <div id="upcoming-meeting-detail-description-box">
          Discuss Rooms dependency and lead handoff progress.
        </div>
        <button data-test-automation-id="join-meeting-button">Join meeting</button>
      </section>
    </main>
  </body>
</html>`;
}

function renderMessagesRouteHtml() {
  return `
    <main style="min-height: 820px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
      <aside style="width: 360px; float: left; min-height: 820px; border-right: 1px solid #e5e7eb;">
        <h2>Chat</h2>
        <div aria-selected="true">Nova weekly sync</div>
      </aside>
      <section
        class="conversation-route"
        style="margin-left: 560px; width: 620px; min-height: 560px; padding: 24px;"
      >
        <h1>Nova weekly sync</h1>
        <p>Hyperlink to team</p>
        <div role="listbox" aria-label="Hyperlink to team">
          <div role="option">2026 Hackathon Project</div>
          <div role="option">AI Relevant Scrum Masters</div>
          <div role="option">RCV SRE Support</div>
        </div>
        <article>
          <p>Participants accepted declined join are words that may exist in old chat history.</p>
          <p>Message composer text: #</p>
        </article>
      </section>
    </main>
  `;
}

async function seedCalendarIndexedDb(page) {
  await page.evaluate(
    async ({ eventId: id, startTime: start, endTime: end }) => {
      await new Promise((resolve, reject) => {
        const deleteRequest = indexedDB.deleteDatabase('Calendar');
        deleteRequest.onerror = () => reject(deleteRequest.error);
        deleteRequest.onsuccess = () => resolve();
        deleteRequest.onblocked = () => resolve();
      });

      await new Promise((resolve, reject) => {
        const openRequest = indexedDB.open('Calendar', 1);
        openRequest.onerror = () => reject(openRequest.error);
        openRequest.onupgradeneeded = () => {
          const db = openRequest.result;
          if (!db.objectStoreNames.contains('event2')) {
            db.createObjectStore('event2', { keyPath: 'id' });
          }
        };
        openRequest.onsuccess = () => {
          const db = openRequest.result;
          const tx = db.transaction(['event2'], 'readwrite');
          tx.objectStore('event2').put({
            id,
            subject: 'Nova weekly sync',
            description:
              '<p>Discuss Rooms dependency and lead handoff progress.</p>',
            startTime: start,
            endTime: end,
            organizer: { name: 'Sophia' },
            attendees: [
              { name: 'Fred', responseStatus: 'accepted' },
              { name: 'Esone', responseStatus: 'accepted' },
            ],
            location: 'https://v.ringcentral.com/join/123456',
            webLink: 'https://app.ringcentral.com/video/home',
            responseStatus: 'accepted',
          });
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => {
            db.close();
            reject(tx.error);
          };
        };
      });
    },
    { eventId, startTime, endTime },
  );
}

async function installChromeMock(page) {
  await page.addInitScript(() => {
    window.__paiTodayPilotRequests = [];
    window.__paiPrepareRequests = [];
    window.__paiStorageSets = [];
    const storageState = {};

    const preparedAssist = {
      available: true,
      surface: 'meeting_prep',
      suggestionType: 'meeting_brief',
      title: '会前准备',
      summary: '找到 2 条与本次会议相关的记忆。',
      insertText:
        'Personal AI meeting prep for Nova weekly sync:\\n- Rooms dependency is still waiting for owner confirmation.\\n- Leads handoff should include rollout progress.',
      cueCards: [
        {
          id: 'brief',
          kind: 'brief',
          title: '进入会议前先看',
          body: 'Nova weekly sync 已匹配到 2 条历史上下文。优先核对最近承诺、依赖进展和未关闭的问题。',
          evidenceIds: ['memory-1'],
        },
        {
          id: 'memory-memory-1',
          kind: 'memory',
          title: 'Rooms dependency',
          body: 'Rooms dependency is still waiting for owner confirmation.',
          evidenceIds: ['memory-1'],
        },
        {
          id: 'suggested-questions',
          kind: 'question',
          title: '建议带进会议的问题',
          body: '依赖或风险现在卡在哪里，owner 和下一步时间点是谁来确认？',
          evidenceIds: ['memory-1'],
        },
        {
          id: 'goal',
          kind: 'action',
          title: '本次目标',
          body: '围绕用户补充目标准备：确认 Rooms 依赖 owner 和下一步',
        },
      ],
      evidence: [
        {
          id: 'memory-1',
          type: 'chunk',
          title: 'Rooms dependency',
          snippet: 'Rooms dependency is still waiting for owner confirmation.',
          sourceLabel: 'glip',
          sourceUrl: 'https://internal.example.com/context-assist/rooms',
          sourceTitle: 'Rooms dependency thread',
          exploreLink: '?chunkId=memory-1',
          links: [
            {
              label: '打开来源',
              url: 'https://internal.example.com/context-assist/rooms',
            },
          ],
          whyMatched: '关键词匹配 Rooms dependency',
          score: 0.82,
        },
        {
          id: 'calendar-rc-event-context-assist-e2e',
          type: 'message',
          title: 'RingCentral Video',
          snippet:
            'Calendar event: RingCentral Video · Discuss Rooms dependency and handoff risk · Participants accepted: Sophia, Fred, Esone.',
          sourceLabel: 'calendar',
          whyMatched: '会议基础信息',
          score: 0.78,
        },
      ],
      riskLevel: 'low',
      previewRequired: false,
      confidence: 0.82,
      queryTimeMs: 8,
    };

    window.chrome = {
      runtime: {
        lastError: null,
        getURL: (resourcePath) => `chrome-extension://personal-ai-test/${resourcePath}`,
        sendMessage: (message, callback) => {
          const respond = (response) => setTimeout(() => callback(response), 0);
          if (message?.type === 'PERSONAL_AI_GET_ENV_CONFIG') {
            respond({
              success: true,
              envConfig: {
                CONTEXT_ASSIST_ENABLED: true,
                MEETING_PREP_ENABLED: true,
              },
            });
            return;
          }
          if (message?.type === 'CALENDAR_EVENTS_SYNC_REQUEST') {
            respond({
              success: true,
              result: {
                created: 1,
                updated: 0,
                unchanged: 0,
                cancelled: 0,
                deleted: 0,
                total: message.events?.length || 0,
              },
            });
            return;
          }
          if (message?.type === 'TODAY_PILOT_MEETING_PREP_REQUEST') {
            window.__paiTodayPilotRequests.push(message.request);
            respond({
              success: true,
              result: {
                assist: preparedAssist,
                prep: {
                  id: 'prep-nova-weekly-sync',
                  missionId: 'mission-nova-weekly-sync',
                  eventTitle: 'Nova weekly sync',
                  status: 'ready',
                  generatedMode: 'nightly_llm',
                  evidenceRefs: preparedAssist.evidence,
                  storylineOpportunity: null,
                },
                generated: false,
                source: 'cache',
                warnings: [],
              },
            });
            return;
          }
          if (message?.type === 'TODAY_PILOT_PREPARE_MEETINGS_REQUEST') {
            window.__paiPrepareRequests.push(message.request);
            respond({
              success: true,
              result: {
                date: message.request?.date || '',
                timezone: message.request?.timezone || '',
                prepared: 1,
                reused: 0,
                failed: 0,
                records: [],
              },
            });
            return;
          }
          respond({ success: true });
        },
      },
      storage: {
        local: {
          get: async (keys) => {
            if (Array.isArray(keys)) {
              return keys.reduce((next, key) => {
                next[key] = storageState[key];
                return next;
              }, {});
            }
            if (typeof keys === 'string') {
              return { [keys]: storageState[keys] };
            }
            if (keys && typeof keys === 'object') {
              return Object.keys(keys).reduce((next, key) => {
                next[key] =
                  storageState[key] === undefined ? keys[key] : storageState[key];
                return next;
              }, {});
            }
            return { ...storageState };
          },
          set: async (value) => {
            Object.assign(storageState, value);
            window.__paiStorageSets.push(value);
          },
        },
      },
    };
  });
}

async function shadowText(page, selector) {
  return page.evaluate((innerSelector) => {
    const host = document.querySelector('#pai-meeting-prep-host');
    return host?.shadowRoot?.querySelector(innerSelector)?.textContent || '';
  }, selector);
}

async function waitForShadowSelector(page, selector) {
  await page.waitForFunction((innerSelector) => {
    const host = document.querySelector('#pai-meeting-prep-host');
    return Boolean(host?.shadowRoot?.querySelector(innerSelector));
  }, selector);
}

async function clickShadow(page, selector) {
  await page.evaluate((innerSelector) => {
    const host = document.querySelector('#pai-meeting-prep-host');
    const element = host?.shadowRoot?.querySelector(innerSelector);
    if (!(element instanceof HTMLElement)) {
      throw new Error(`Missing shadow element: ${innerSelector}`);
    }
    element.click();
  }, selector);
}

async function switchToMessagesRouteWithTeamPicker(page) {
  await page.evaluate((html) => {
    history.pushState({}, '', '/messages/6543474694');
    document.body.innerHTML = html;
  }, renderMessagesRouteHtml());
}

async function main() {
  await fs.access(contentScriptPath);

  const userDataDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'pai-context-assist-'),
  );
  let context;

  try {
    context = await chromium.launchPersistentContext(userDataDir, {
      channel: 'chromium',
      headless: true,
      viewport: { width: 1280, height: 900 },
    });
    await context.route('https://app.ringcentral.com/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: renderFixtureHtml(),
      });
    });

    const page = await context.newPage();
    await installChromeMock(page);
    await page.goto(fixtureUrl);
    await seedCalendarIndexedDb(page);
    await page.addScriptTag({ path: contentScriptPath });

    await waitForShadowSelector(page, '.pai-card');
    await page.waitForFunction(() => {
      const host = document.querySelector('#pai-meeting-prep-host');
      return host?.shadowRoot?.textContent?.includes('Rooms dependency');
    });

    const initialText = await shadowText(page, '.pai-card');
    assert(
      initialText.includes('Today Pilot 会前准备') &&
        initialText.includes('建议带进会议的问题') &&
        initialText.includes('提前准备') &&
        initialText.includes('高置信 1 条') &&
        initialText.includes('基础背景 1 条') &&
        initialText.includes('1 条高置信来源可展开') &&
        initialText.includes('1 条日历或低信号来源只作为准备背景保留') &&
        initialText.includes('本机会写入 Meeting Pilot handoff') &&
        initialText.includes('不会加入会议、录音、发消息、审批或写回日历/外部系统') &&
        initialText.includes('会中核对 owner / 下一步 / 风险') &&
        initialText.includes('Rooms dependency'),
      'Today Pilot meeting prep card did not render expected cached output',
    );

    await page.waitForFunction(() => {
      const sets = window.__paiStorageSets || [];
      return sets.some((item) => item.meetingPrepHandoff);
    });
    const preparedText = await shadowText(page, '.pai-card');
    assert(
      preparedText.includes('建议带进会议的问题'),
      'Question cue should be visible in meeting prep output',
    );

    const requests = await page.evaluate(() => window.__paiTodayPilotRequests);
    const lastRequest = requests.at(-1);
    assert(
      lastRequest?.autoGenerate === false &&
        lastRequest?.forceGenerate === false &&
        lastRequest?.event?.externalId === 'rc-event-context-assist-e2e',
      'Video Home did not read cached Today Pilot meeting prep for the selected event',
    );

    const storageSets = await page.evaluate(() => window.__paiStorageSets);
    const handoffSet = storageSets.find((item) => item.meetingPrepHandoff);
    const handoff = handoffSet?.meetingPrepHandoff;
    assert(
      handoff?.goal === '围绕用户补充目标准备：确认 Rooms 依赖 owner 和下一步' &&
        handoff?.source === 'today_pilot' &&
        handoff?.prepId === 'prep-nova-weekly-sync' &&
        handoff?.text?.includes('Personal AI meeting prep'),
      'Meeting Pilot handoff was not stored with the Today Pilot goal and brief',
    );
    assert(
      handoffSet?.meetingPrepHandoffs &&
        Object.values(handoffSet.meetingPrepHandoffs).some(
          (item) => item.prepId === 'prep-nova-weekly-sync',
        ),
      'Meeting Pilot multi-handoff cache did not include the Today Pilot handoff',
    );

    const requestsBeforeMessageRoute = requests.length;
    await switchToMessagesRouteWithTeamPicker(page);
    await page.waitForTimeout(3200);
    const messageRouteState = await page.evaluate(() => ({
      href: location.href,
      hostExists: Boolean(document.querySelector('#pai-meeting-prep-host')),
      requestCount: (window.__paiTodayPilotRequests || []).length,
      bodyText: document.body.textContent || '',
    }));
    assert(
      messageRouteState.href.endsWith('/messages/6543474694') &&
        messageRouteState.bodyText.includes('Hyperlink to team') &&
        !messageRouteState.hostExists &&
        messageRouteState.requestCount === requestsBeforeMessageRoute,
      'Today Pilot prep should not mount or request prep after RingCentral SPA moves to messages route',
    );

    await page.goto(fixtureUrl);
    await seedCalendarIndexedDb(page);
    await page.addScriptTag({ path: contentScriptPath });
    await waitForShadowSelector(page, '.pai-card');

    await clickShadow(page, 'button[data-action="sync"]');
    await page.waitForFunction(() => {
      return (window.__paiPrepareRequests || []).length > 0;
    });
    const prepareRequests = await page.evaluate(() => window.__paiPrepareRequests);
    assert(
      prepareRequests.at(-1)?.mode === 'nightly_llm' &&
        prepareRequests.at(-1)?.maxMeetings === 5,
      'Refresh did not backfill Today Pilot meeting prep before rereading cache',
    );

    console.log(
      `Today Pilot meeting prep E2E passed (${requests.length} cached prep requests).`,
    );
  } finally {
    if (context) await context.close();
    await fs.rm(userDataDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
