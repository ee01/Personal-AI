import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import playwright from '../desktop-app/node_modules/playwright/index.js';

const { chromium } = playwright;

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname);
const contentScriptPath = path.join(
  repoRoot,
  'dist',
  'contentScriptRingCentralVideoHome.js',
);
const fixtureUrl =
  'https://app.ringcentral.com/video/home/storyline-fixture-event';

function renderFixtureHtml() {
  return `<!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>RingCentral Video Home Fixture</title>
        <style>
          body { margin: 0; font-family: system-ui, sans-serif; }
          main { display: grid; grid-template-columns: 42% 58%; min-height: 100vh; }
          .left { padding: 24px; background: #f8fafc; }
          .right { padding: 24px; background: #fff; }
          [data-test-automation-id="upcoming-meeting-detail-container"] {
            min-height: 420px;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 18px;
          }
        </style>
      </head>
      <body>
        <main>
          <section class="left">
            <div
              data-at="calendar-event-item-wrapper"
              data-calendar-event-item-id="event-storyline"
              aria-selected="true"
            >
              Storyline workshop review
              <button data-test-automation-id="calendar-event-item-join-button">Join</button>
            </div>
          </section>
          <section class="right">
            <div data-test-automation-id="upcoming-meeting-detail-container">
              <h2>Storyline workshop review</h2>
              <div>Participants accepted declined join starts in 10 minutes</div>
              <a href="https://v.ringcentral.com/join/123456">Join meeting</a>
              <div id="upcoming-meeting-detail-description-box">
                Prepare a workshop recap and share the project storyline.
              </div>
            </div>
          </section>
        </main>
      </body>
    </html>`;
}

async function seedCalendarIndexedDb(page) {
  await page.evaluate(() => {
    const request = indexedDB.open('Calendar', 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('event2', { keyPath: 'id' });
    };
    return new Promise((resolve, reject) => {
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('event2', 'readwrite');
        tx.objectStore('event2').put({
          id: 'event-storyline',
          subject: 'Storyline workshop review',
          description:
            'Prepare a workshop recap and share the project storyline.',
          startTime: Date.now() + 20 * 60 * 1000,
          endTime: Date.now() + 80 * 60 * 1000,
          organizer: { name: 'Elina' },
          attendees: [{ name: 'Esone' }, { name: 'Project team' }],
          meetingUrl: 'https://v.ringcentral.com/join/123456',
          webLink: 'https://app.ringcentral.com/video/home/storyline-fixture-event',
        });
        tx.oncomplete = () => {
          db.close();
          resolve(null);
        };
        tx.onerror = () => reject(tx.error);
      };
    });
  });
}

async function installChromeMock(page) {
  await page.addInitScript(() => {
    const storage = {};
    const storylineOpportunity = {
      available: true,
      confidence: 0.86,
      storyType: 'training',
      buttonLabel: '生成 workshop 故事线',
      oneLineReason:
        '这场会有 workshop、项目进展和可分享经验三类素材，可以整理成讲述材料。',
      audienceHint: '项目组',
      estimatedLengthMinutes: 8,
      evidenceClusters: [
        {
          label: 'Workshop 经验',
          sourceKinds: [],
          evidenceCount: 4,
        },
      ],
      suggestedArtifact: 'slides_outline',
    };
    const prep = {
      id: 'prep-storyline',
      userId: 'test',
      localDate: '2026-05-26',
      timezone: 'Asia/Shanghai',
      eventExternalId: 'event-storyline',
      eventTitle: 'Storyline workshop review',
      startAt: Math.floor(Date.now() / 1000) + 1200,
      goalHash: '',
      status: 'ready',
      generatedMode: 'nightly_llm',
      summaryMd: '## Storyline workshop review\n- 准备 workshop 复盘。',
      cueCards: [
        {
          id: 'brief',
          kind: 'brief',
          title: '进入会议前先看',
          body: '优先讲清 workshop 经验、项目进展和下一步。',
          evidenceIds: ['memory-1'],
        },
      ],
      questions: ['哪些经验值得分享给项目组？'],
      evidenceRefs: [
        {
          id: 'memory-1',
          type: 'chunk',
          title: 'Workshop memory',
          snippet: 'Workshop generated useful project automation lessons.',
          sourceLabel: 'meeting',
          sourceTitle: 'Workshop memory',
          whyMatched: 'workshop review',
          score: 0.88,
        },
        {
          id: 'memory-2',
          type: 'chunk',
          title: 'Project progress memory',
          snippet: 'The project team agreed to turn the workshop lessons into a rollout plan.',
          sourceLabel: 'glip',
          sourceTitle: 'Project progress memory',
          whyMatched: 'project progress',
          score: 0.82,
        },
        {
          id: 'memory-3',
          type: 'chunk',
          title: 'Stakeholder update memory',
          snippet: 'Stakeholders asked for a concise story about outcomes, risks, and next steps.',
          sourceLabel: 'meeting',
          sourceTitle: 'Stakeholder update memory',
          whyMatched: 'storytelling need',
          score: 0.8,
        },
      ],
      contextPackMd: '# Today Pilot meeting prep\n\nWorkshop recap.',
      redaction: {
        redactionPreview: ['客户内部项目名需要脱敏'],
        risksOrOpenLoops: ['外发前核对截图权限'],
      },
      llmUsage: { storylineOpportunity },
      storylineOpportunity,
      sourceHash: 'source-storyline',
      generatedAt: Math.floor(Date.now() / 1000),
      expiresAt: Math.floor(Date.now() / 1000) + 12 * 3600,
      createdAt: Math.floor(Date.now() / 1000),
      updatedAt: Math.floor(Date.now() / 1000),
    };
    const assist = {
      available: true,
      surface: 'meeting_prep',
      suggestionType: 'meeting_brief',
      title: 'Today Pilot 会前准备',
      summary: '找到 workshop 相关记忆，可以准备分享故事线。',
      insertText: prep.contextPackMd,
      cueCards: prep.cueCards,
      evidence: prep.evidenceRefs,
      riskLevel: 'low',
      previewRequired: false,
      confidence: 0.82,
      queryTimeMs: 4,
      storylineOpportunity,
    };

    window.__openedUrls = [];
    window.open = (url) => {
      window.__openedUrls.push(String(url));
      return null;
    };
    window.chrome = {
      runtime: {
        lastError: null,
        getURL: (resourcePath) =>
          `chrome-extension://personal-ai-test/${resourcePath}`,
        sendMessage: (message, callback) => {
          const respond = (response) => setTimeout(() => callback(response), 0);
          if (message?.type === 'PERSONAL_AI_GET_ENV_CONFIG') {
            respond({ success: true, envConfig: {} });
          } else if (message?.type === 'CALENDAR_EVENTS_SYNC_REQUEST') {
            respond({
              success: true,
              result: { created: 0, updated: 0, unchanged: 1, total: 1 },
            });
          } else if (message?.type === 'TODAY_PILOT_MEETING_PREP_REQUEST') {
            respond({
              success: true,
              result: {
                prep,
                assist,
                generated: false,
                source: 'cached',
                warnings: [],
              },
            });
          } else if (message?.type === 'TODAY_PILOT_PREPARE_MEETINGS_REQUEST') {
            respond({ success: true, result: { prepared: 1 } });
          } else {
            respond({ success: false, error: `unexpected:${message?.type}` });
          }
        },
      },
      storage: {
        local: {
          get: async (keys) => {
            if (Array.isArray(keys)) {
              return Object.fromEntries(keys.map((key) => [key, storage[key]]));
            }
            return storage;
          },
          set: async (items) => {
            Object.assign(storage, items);
          },
        },
      },
    };
  });
}

async function shadowText(page, selector) {
  return page.evaluate((targetSelector) => {
    const host = document.querySelector('#pai-meeting-prep-host');
    return host?.shadowRoot?.querySelector(targetSelector)?.textContent || '';
  }, selector);
}

async function clickShadow(page, selector) {
  await page.evaluate((targetSelector) => {
    const host = document.querySelector('#pai-meeting-prep-host');
    const button = host?.shadowRoot?.querySelector(targetSelector);
    if (!(button instanceof HTMLButtonElement)) {
      throw new Error(`Missing shadow button: ${targetSelector}`);
    }
    button.click();
  }, selector);
}

async function main() {
  await fs.access(contentScriptPath);
  const userDataDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'pai-storyline-video-home-'),
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

    await page.waitForFunction(() => {
      const host = document.querySelector('#pai-meeting-prep-host');
      return host?.shadowRoot?.querySelector('.pai-storyline');
    });
    const cardText = await shadowText(page, '.pai-card');
    assert(cardText.includes('可生成 Storyline'), 'storyline strip missing');
    assert(
      cardText.includes('生成 workshop 故事线'),
      'storyline action label missing',
    );
    assert(
      cardText.includes('复核证据后手动复制'),
      'storyline boundary copy missing',
    );
    assert(cardText.includes('入口回执'), 'storyline entry receipt missing');
    assert(
      cardText.includes('输出：Slides 提纲'),
      'storyline target artifact receipt missing',
    );
    assert(cardText.includes('素材组 1'), 'storyline cluster receipt missing');
    assert(
      cardText.includes('素材估计 4 条'),
      'storyline model-estimated evidence count receipt missing',
    );
    assert(
      cardText.includes('实际 refs 3 条'),
      'storyline actual evidence ref count receipt missing',
    );
    assert(
      cardText.includes('素材来源：会议 / 消息'),
      'storyline source-kind fallback receipt missing',
    );
    assert(
      cardText.includes('点击后才调用 Draft API'),
      'storyline lazy-generation boundary missing',
    );
    assert(
      cardText.includes('模型素材数与实际 refs 不一致'),
      'storyline evidence mismatch boundary missing',
    );
    assert(
      cardText.includes('外发复核：私有素材 3 条 / 脱敏提示 1 条 / 风险提醒 1 条'),
      'storyline share review summary missing',
    );
    assert(
      cardText.includes('不是外发就绪稿'),
      'storyline not-ready-to-share boundary missing',
    );

    await clickShadow(page, 'button[data-action="storyline-generate"]');
    const openedUrls = await page.evaluate(() => window.__openedUrls);
    assert.equal(openedUrls.length, 1, 'storyline click should open one route');
    assert(
      openedUrls[0].includes(
        'memory-exploring.html#/storylines/draft?source=today_meeting_prep',
      ),
      `unexpected storyline route: ${openedUrls[0]}`,
    );
    assert(openedUrls[0].includes('prepId=prep-storyline'));
    assert(openedUrls[0].includes('target=slides_outline'));

    await clickShadow(page, 'button[data-action="storyline-dismiss"]');
    await page.waitForFunction(() => {
      const host = document.querySelector('#pai-meeting-prep-host');
      return !host?.shadowRoot?.querySelector('.pai-storyline');
    });
    const dismissedText = await shadowText(page, '.pai-card');
    assert(
      !dismissedText.includes('可生成 Storyline'),
      'dismissed storyline strip should be hidden',
    );
    assert(
      dismissedText.includes('Storyline 提示已隐藏'),
      'storyline dismiss receipt missing',
    );
    assert(
      dismissedText.includes('chrome.storage.local.storylineOpportunityDismissals'),
      'storyline dismiss storage boundary missing',
    );
    assert(
      dismissedText.includes('不删除会前准备、证据、Draft 草稿或 Meeting Pilot handoff'),
      'storyline dismiss side-effect boundary missing',
    );
    assert(
      dismissedText.includes('不会写回 Slides / Docs / RingCentral'),
      'storyline dismiss writeback boundary missing',
    );

    console.log('Storyline Video Home E2E verified.');
  } finally {
    await context?.close();
    await fs.rm(userDataDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
