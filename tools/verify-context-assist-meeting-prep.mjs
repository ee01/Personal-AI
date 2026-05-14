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
    window.__paiContextRequests = [];
    window.__paiStorageSets = [];

    const fallbackAssist = {
      available: false,
      surface: 'meeting_prep',
      suggestionType: 'none',
      title: '暂无会前上下文',
      summary: '没有找到与本次会议足够相关的 Personal AI 记忆。',
      cueCards: [
        {
          id: 'fallback-brief',
          kind: 'brief',
          title: '暂无高置信记忆',
          body: 'Nova weekly sync 暂时没有命中足够相关的历史上下文。可以补充本次会议目标后重新生成。',
        },
      ],
      evidence: [],
      riskLevel: 'low',
      previewRequired: false,
      confidence: 0,
      queryTimeMs: 6,
    };

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
          if (message?.type === 'CONTEXT_ASSIST_REQUEST') {
            window.__paiContextRequests.push(message.request);
            const userGoal = String(message.request?.userGoal || '').trim();
            respond({
              success: true,
              result: userGoal
                ? {
                    ...preparedAssist,
                    cueCards: preparedAssist.cueCards.map((card) =>
                      card.id === 'goal'
                        ? {
                            ...card,
                            body: `围绕用户补充目标准备：${userGoal}`,
                          }
                        : card,
                    ),
                  }
                : fallbackAssist,
            });
            return;
          }
          respond({ success: true });
        },
      },
      storage: {
        local: {
          set: async (value) => {
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

async function fillGoal(page, value) {
  await page.evaluate((goal) => {
    const host = document.querySelector('#pai-meeting-prep-host');
    const textarea = host?.shadowRoot?.querySelector('textarea[data-role="goal"]');
    if (!(textarea instanceof HTMLTextAreaElement)) {
      throw new Error('Missing goal textarea');
    }
    textarea.value = goal;
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
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

    await waitForShadowSelector(page, 'textarea[data-role="goal"]');
    await page.waitForFunction(() => {
      const host = document.querySelector('#pai-meeting-prep-host');
      return host?.shadowRoot?.textContent?.includes('暂无高置信记忆');
    });

    const initialText = await shadowText(page, '.pai-card');
    assert(
      initialText.includes('Personal AI 会前准备') &&
        initialText.includes('生成建议') &&
        initialText.includes('暂无高置信记忆'),
      'Initial empty-state meeting prep card did not render expected controls',
    );

    await fillGoal(page, '确认 Rooms 依赖 owner 和下一步');
    await page.waitForFunction(() => {
      const host = document.querySelector('#pai-meeting-prep-host');
      const stale = host?.shadowRoot?.querySelector('[data-role="stale"]');
      return stale instanceof HTMLElement && !stale.hidden;
    });

    await clickShadow(page, 'button[data-action="generate"]');
    await page.waitForFunction(() => {
      const host = document.querySelector('#pai-meeting-prep-host');
      return host?.shadowRoot?.textContent?.includes('Rooms dependency');
    });
    const preparedText = await shadowText(page, '.pai-card');
    assert(
      preparedText.includes('建议带进会议的问题'),
      'Question cue should be visible in meeting prep output',
    );

    const requests = await page.evaluate(() => window.__paiContextRequests);
    const lastRequest = requests.at(-1);
    assert(
      lastRequest?.userGoal === '确认 Rooms 依赖 owner 和下一步',
      'Generate action did not send the latest user goal',
    );

    const handoffDisabled = await page.evaluate(() => {
      const host = document.querySelector('#pai-meeting-prep-host');
      const button = host?.shadowRoot?.querySelector('button[data-action="handoff"]');
      return button instanceof HTMLButtonElement ? button.disabled : true;
    });
    assert(!handoffDisabled, 'Handoff button should be enabled after fresh assist');

    await fillGoal(page, '确认 rollout 风险');
    await page.waitForFunction(() => {
      const host = document.querySelector('#pai-meeting-prep-host');
      const shadow = host?.shadowRoot;
      const stale = shadow?.querySelector('[data-role="stale"]');
      const output = shadow?.querySelector('[data-role="assist-output"]');
      const button = shadow?.querySelector('button[data-action="handoff"]');
      return (
        stale instanceof HTMLElement &&
        !stale.hidden &&
        output instanceof HTMLElement &&
        output.hidden &&
        button instanceof HTMLButtonElement &&
        button.disabled
      );
    });
    const outputHidden = await page.evaluate(() => {
      const host = document.querySelector('#pai-meeting-prep-host');
      const output = host?.shadowRoot?.querySelector('[data-role="assist-output"]');
      return output instanceof HTMLElement && output.hidden;
    });
    assert(
      outputHidden,
      'Stale assist output should be hidden after the meeting goal changes',
    );

    await clickShadow(page, 'button[data-action="generate"]');
    await page.waitForFunction(() => {
      const requests = window.__paiContextRequests || [];
      return requests.at(-1)?.userGoal === '确认 rollout 风险';
    });
    await page.waitForFunction(() => {
      const host = document.querySelector('#pai-meeting-prep-host');
      const button = host?.shadowRoot?.querySelector('button[data-action="handoff"]');
      return button instanceof HTMLButtonElement && !button.disabled;
    });

    await clickShadow(page, 'button[data-action="handoff"]');
    await page.waitForFunction(() => window.__paiStorageSets.length > 0);
    const storageSets = await page.evaluate(() => window.__paiStorageSets);
    const handoff = storageSets.at(-1)?.meetingPrepHandoff;
    assert(
      handoff?.goal === '确认 rollout 风险' &&
        handoff?.text?.includes('Personal AI meeting prep'),
      'Meeting Pilot handoff was not stored with the generated brief',
    );

    console.log(
      `Context Assist meeting prep E2E passed (${requests.length} assist requests).`,
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
