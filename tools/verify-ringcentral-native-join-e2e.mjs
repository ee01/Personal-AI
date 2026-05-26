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

const eventId = 'rc-event-native-join-e2e';
const messageFixtureUrl = 'https://app.ringcentral.com/messages/native-join-e2e';
const startTime = Date.now() + 10 * 60 * 1000;
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
    <title>RingCentral Native Join Fixture</title>
    <style>
      body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      main { display: grid; grid-template-columns: 360px minmax(420px, 1fr); min-height: 760px; gap: 24px; padding: 24px; }
      aside { border-right: 1px solid #e5e7eb; padding-right: 24px; }
      .message-view { padding: 24px; }
      [data-at="calendar-event-item-wrapper"] { padding: 12px; border: 1px solid #2563eb; border-radius: 8px; }
      [data-test-automation-id="upcoming-meeting-detail-container"] { width: 520px; border: 1px solid #d1d5db; border-radius: 10px; padding: 20px; }
      button { font: inherit; }
    </style>
  </head>
  <body>
    <div id="app"></div>
    <script>
      window.__paiOriginalJoinReached = false;
      window.__paiOpenedUrls = [];
      window.__paiNativeLaunches = [];
      window.__paiBlockWindowOpen = false;
      window.__paiCopiedText = '';
      window.__paiClickLog = [];
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: async (text) => {
            window.__paiCopiedText = String(text || '');
          },
        },
      });
      window.open = (url, target, features) => {
        const entry = {
          url: String(url || ''),
          target: String(target || ''),
          features: String(features || ''),
          assignedUrl: '',
        };
        window.__paiOpenedUrls.push(entry);
        if (window.__paiBlockWindowOpen) {
          return null;
        }
        return {
          opener: window,
          closed: false,
          location: {
            get href() {
              return entry.assignedUrl || entry.url;
            },
            set href(value) {
              entry.assignedUrl = String(value || '');
            },
          },
          close() {},
        };
      };
      const originalAnchorClick = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = function () {
        const href = String(this.href || '');
        if (href.startsWith('rcvdt://')) {
          window.__paiNativeLaunches.push(href);
          return;
        }
        return originalAnchorClick.call(this);
      };

      function renderMessageView() {
        document.querySelector('#app').innerHTML = '<div class="message-view"><h1>Messages</h1><button id="nav-to-video">Video</button></div>';
      }

      function renderVideoHome() {
        document.querySelector('#app').innerHTML = \`
          <main>
            <aside>
              <div
                data-at="calendar-event-item-wrapper"
                data-calendar-event-item-id="${eventId}"
                aria-selected="true"
              >
                <strong>Native join regression</strong>
                <button data-test-automation-id="calendar-event-item-join-button">Join</button>
              </div>
            </aside>
            <section data-test-automation-id="upcoming-meeting-detail-container">
              <h2>Native join regression</h2>
              <p>Starts soon</p>
              <div id="upcoming-meeting-detail-description-box">
                Native join should open the RingCentral app and show browser recovery controls briefly.
              </div>
              <button data-test-automation-id="join-meeting-button">Join meeting</button>
            </section>
          </main>
        \`;
      }

      document.addEventListener('click', (event) => {
        const target = event.target;
        window.__paiClickLog.push({
          text: String(target?.textContent || '').trim(),
          tag: String(target?.tagName || ''),
          testId:
            target?.getAttribute?.('data-test-automation-id') ||
            target?.closest?.('[data-test-automation-id]')?.getAttribute?.(
              'data-test-automation-id',
            ) ||
            '',
          defaultPrevented: event.defaultPrevented === true,
        });
      }, true);

      document.addEventListener('click', (event) => {
        if (event.target?.closest?.('#nav-to-video')) {
          history.pushState({}, '', '/video/home');
          renderVideoHome();
        }
      });

      document.addEventListener('click', (event) => {
        if (event.target?.closest?.('[data-test-automation-id="calendar-event-item-join-button"], [data-test-automation-id="join-meeting-button"]')) {
          window.__paiOriginalJoinReached = true;
        }
      });

      if (location.pathname.startsWith('/video/home')) {
        renderVideoHome();
      } else {
        renderMessageView();
      }
    </script>
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
            subject: 'Native join regression',
            description:
              '<p>Native join should show browser recovery controls briefly.</p>',
            startTime: start,
            endTime: end,
            location: 'http://v.ringcentral.com/launcher/123456?passcode=abc',
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
    window.__paiCalendarSyncCount = 0;
    window.__paiStorageEnvConfig = {
      MEETING_NATIVE_CLIENT_JOIN_ENABLED: true,
    };
    window.chrome = {
      runtime: {
        lastError: null,
        getURL: (resourcePath) =>
          `chrome-extension://personal-ai-test/${resourcePath}`,
        sendMessage: (message, callback) => {
          const respond = (response) => setTimeout(() => callback(response), 0);
          if (message?.type === 'PERSONAL_AI_GET_ENV_CONFIG') {
            respond({
              success: true,
              envConfig: {
                CONTEXT_ASSIST_ENABLED: false,
                MEETING_PREP_ENABLED: false,
                MEETING_NATIVE_CLIENT_JOIN_ENABLED: true,
              },
            });
            return;
          }
          if (message?.type === 'CALENDAR_EVENTS_SYNC_REQUEST') {
            window.__paiCalendarSyncCount += 1;
            respond({
              success: true,
              result: {
                created: message.events?.length || 0,
                updated: 0,
                unchanged: 0,
                cancelled: 0,
                deleted: 0,
                total: message.events?.length || 0,
              },
            });
            return;
          }
          respond({ success: true });
        },
      },
      storage: {
        local: {
          get: async () => ({
            envConfig: { ...window.__paiStorageEnvConfig },
          }),
          set: async (items) => {
            if (items?.envConfig) {
              window.__paiStorageEnvConfig = { ...items.envConfig };
            }
          },
        },
      },
    };
  });
}

async function main() {
  await fs.access(contentScriptPath);

  const userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pai-native-join-'));
  let context;

  try {
    context = await chromium.launchPersistentContext(userDataDir, {
      channel: 'chromium',
      headless: true,
      viewport: { width: 1280, height: 820 },
    });
    await context.route('https://app.ringcentral.com/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: renderFixtureHtml(),
      });
    });
    await context.route('https://v.ringcentral.com/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<!doctype html><title>Browser meeting join</title>',
      });
    });

    const page = await context.newPage();
    await installChromeMock(page);
    await page.goto(messageFixtureUrl);
    await seedCalendarIndexedDb(page);
    await page.addScriptTag({ path: contentScriptPath });
    await page.click('#nav-to-video');

    await page.waitForFunction(() => window.__paiCalendarSyncCount >= 1);
    await page.click('[data-test-automation-id="calendar-event-item-join-button"]');
    await page.waitForSelector('#pai-ringcentral-native-join-fallback');

    const result = await page.evaluate(() => {
      const fallback = document.querySelector(
        '#pai-ringcentral-native-join-fallback',
      );
      const browserLink = fallback?.querySelector(
        '[data-pai-ringcentral-native-join-fallback-link]',
      );
      const copyButton = fallback?.querySelector(
        '[data-pai-ringcentral-native-join-copy-link]',
      );
      const closeButton = fallback?.querySelector(
        '[data-pai-ringcentral-native-join-close]',
      );
      const launchLink = document.querySelector(
        '#pai-ringcentral-native-join-launch-link',
      );
      const visibleBrowserLink = fallback?.querySelector(
        '[data-pai-ringcentral-native-join-visible-link]',
      );
      return {
        fallbackText: fallback?.textContent || '',
        fallbackRole: fallback?.getAttribute('role') || '',
        fallbackLabel: fallback?.getAttribute('aria-label') || '',
        browserTag: browserLink?.tagName || '',
        copyTag: copyButton?.tagName || '',
        closeTag: closeButton?.tagName || '',
        closeLabel: closeButton?.getAttribute('aria-label') || '',
        visibleBrowserUrl: visibleBrowserLink?.textContent || '',
        browserUrl:
          browserLink?.getAttribute(
            'data-pai-ringcentral-native-join-browser-url',
          ) || '',
        launchHref:
          launchLink instanceof HTMLAnchorElement ? launchLink.href : '',
        nativeLaunches: window.__paiNativeLaunches || [],
        originalJoinReached: window.__paiOriginalJoinReached === true,
      };
    });

    assert(
      result.fallbackText.includes('Join in browser') &&
        result.fallbackText.includes('Copy link') &&
        !result.fallbackText.includes('Dismiss') &&
        !result.fallbackText.includes('Open app again'),
      'Native join fallback should expose browser fallback and copy action without bottom dismiss or app retry',
    );
    assert(
      result.fallbackRole === 'region' &&
        result.fallbackLabel === 'RingCentral app handoff fallback',
      'Native join fallback is missing accessible region metadata',
    );
    assert(
      result.browserTag === 'BUTTON',
      'Browser fallback action should be a button so it does not open a second default link',
    );
    assert(
      result.copyTag === 'BUTTON',
      'Copy fallback action should be a button so it remains an explicit user action',
    );
    assert(
      result.closeTag === 'BUTTON' &&
        result.closeLabel === 'Close RingCentral app handoff popup',
      'Native join fallback should use a top-right close button instead of a bottom Dismiss action',
    );
    assert(
      result.browserUrl ===
        'https://v.ringcentral.com/conf/on/123456?passcode=abc',
      'Browser fallback should point at the direct browser meeting route',
    );
    assert(
      result.visibleBrowserUrl ===
        'https://v.ringcentral.com/conf/on/123456?passcode=abc',
      'Native join fallback should show the browser meeting link for manual recovery',
    );
    assert(
      result.launchHref === 'rcvdt://join/123456?passcode=abc' &&
        result.nativeLaunches.includes('rcvdt://join/123456?passcode=abc'),
      `Native protocol URL was not launched from the parsed meeting target: ${JSON.stringify(
        result,
      )}`,
    );
    assert(
      !result.originalJoinReached,
      'Original RingCentral join click should be blocked after native handoff',
    );

    assert(
      result.fallbackText.includes('Prefer browser next time?') &&
        result.fallbackText.includes('Use browser by default'),
      'Native join fallback should include a subtle browser-default hint',
    );
    await page.waitForTimeout(5300);
    const handoffAutoDismissState = await page.evaluate(() => ({
      fallbackStillVisible: Boolean(
        document.querySelector('#pai-ringcentral-native-join-fallback'),
      ),
      launchLinkStillPresent: Boolean(
        document.querySelector('#pai-ringcentral-native-join-launch-link'),
      ),
    }));
    assert(
      !handoffAutoDismissState.fallbackStillVisible &&
        !handoffAutoDismissState.launchLinkStillPresent,
      `Native join fallback should auto-dismiss five seconds after app handoff: ${JSON.stringify(
        handoffAutoDismissState,
      )}`,
    );

    await page.click('[data-test-automation-id="calendar-event-item-join-button"]');
    await page.waitForSelector('#pai-ringcentral-native-join-fallback');
    await page.click('[data-pai-ringcentral-native-join-copy-link]');
    await page.waitForFunction(
      () =>
        window.__paiCopiedText ===
        'https://v.ringcentral.com/conf/on/123456?passcode=abc',
    );
    const copyState = await page.evaluate(() => ({
      copiedText: window.__paiCopiedText,
      status:
        document.querySelector(
          '[data-pai-ringcentral-native-join-status]',
        )?.textContent || '',
      fallbackStillVisible: Boolean(
        document.querySelector('#pai-ringcentral-native-join-fallback'),
      ),
    }));
    assert(
      copyState.status.includes('copied'),
      `Copy link should confirm the copied browser meeting link: ${JSON.stringify(
        copyState,
      )}`,
    );
    assert(
      copyState.fallbackStillVisible,
      'Copying the browser link should keep the native handoff fallback panel visible',
    );

    await page.evaluate(() => {
      const button = document.querySelector(
        '[data-pai-ringcentral-native-join-prefer-browser]',
      );
      button?.dispatchEvent(
        new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          button: 0,
        }),
      );
    });
    await page.waitForFunction(
      () =>
        window.__paiStorageEnvConfig?.MEETING_NATIVE_CLIENT_JOIN_ENABLED ===
        false,
    );
    const browserDefaultState = await page.evaluate(() => ({
      nativeJoinEnabled:
        window.__paiStorageEnvConfig?.MEETING_NATIVE_CLIENT_JOIN_ENABLED,
      status:
        document.querySelector(
          '[data-pai-ringcentral-native-join-status]',
        )?.textContent || '',
      defaultButtonText:
        document.querySelector(
          '[data-pai-ringcentral-native-join-prefer-browser]',
        )?.textContent || '',
      defaultPromptText:
        document
          .querySelector('#pai-ringcentral-native-join-fallback')
          ?.textContent || '',
      fallbackStillVisible: Boolean(
        document.querySelector('#pai-ringcentral-native-join-fallback'),
      ),
    }));
    assert(
      browserDefaultState.nativeJoinEnabled === false,
      'Browser-default hint should disable native client join in envConfig',
    );
    assert(
      browserDefaultState.status.includes(
        'Future RingCentral joins will use the browser',
      ),
      `Browser-default hint should confirm the saved default: ${JSON.stringify(
        browserDefaultState,
      )}`,
    );
    assert(
      browserDefaultState.fallbackStillVisible,
      'Saving the browser default should keep the current fallback controls available',
    );
    assert(
      browserDefaultState.defaultButtonText.includes('Use app by default') &&
        browserDefaultState.defaultPromptText.includes(
          'Prefer app next time?',
        ),
      `Saving browser default should expose an in-panel app-default undo: ${JSON.stringify(
        browserDefaultState,
      )}`,
    );

    await page.evaluate(() => {
      const button = document.querySelector(
        '[data-pai-ringcentral-native-join-prefer-browser]',
      );
      button?.dispatchEvent(
        new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          button: 0,
        }),
      );
    });
    await page.waitForFunction(
      () =>
        window.__paiStorageEnvConfig?.MEETING_NATIVE_CLIENT_JOIN_ENABLED ===
        true,
    );
    const appDefaultState = await page.evaluate(() => ({
      nativeJoinEnabled:
        window.__paiStorageEnvConfig?.MEETING_NATIVE_CLIENT_JOIN_ENABLED,
      status:
        document.querySelector(
          '[data-pai-ringcentral-native-join-status]',
        )?.textContent || '',
      defaultButtonText:
        document.querySelector(
          '[data-pai-ringcentral-native-join-prefer-browser]',
        )?.textContent || '',
      defaultPromptText:
        document
          .querySelector('#pai-ringcentral-native-join-fallback')
          ?.textContent || '',
      fallbackStillVisible: Boolean(
        document.querySelector('#pai-ringcentral-native-join-fallback'),
      ),
    }));
    assert(
      appDefaultState.nativeJoinEnabled === true,
      'App-default undo should re-enable native client join in envConfig',
    );
    assert(
      appDefaultState.status.includes('try the app first') &&
        appDefaultState.defaultButtonText.includes('Use browser by default') &&
        appDefaultState.defaultPromptText.includes('Prefer browser next time?'),
      `App-default undo should restore the browser-default action: ${JSON.stringify(
        appDefaultState,
      )}`,
    );

    await page.evaluate(() => {
      window.__paiFallbackClickSeen = 0;
      const button = document.querySelector(
        '[data-pai-ringcentral-native-join-fallback-link]',
      );
      button?.addEventListener(
        'click',
        () => {
          window.__paiFallbackClickSeen += 1;
        },
        { capture: true },
      );
    });
    const popup = null;
    await page.evaluate(() => {
      const button = document.querySelector(
        '[data-pai-ringcentral-native-join-fallback-link]',
      );
      button?.dispatchEvent(
        new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          button: 0,
        }),
      );
    });
    const browserFallback = await page.evaluate(() => ({
      openedUrls: window.__paiOpenedUrls,
      clickSeen: window.__paiFallbackClickSeen,
      fallbackStillVisible: Boolean(
        document.querySelector('#pai-ringcentral-native-join-fallback'),
      ),
    }));
    const observedBrowserUrls = browserFallback.openedUrls.map(
      (item) => item.assignedUrl || item.url,
    );
    if (observedBrowserUrls.length > 0) {
      assert(
        observedBrowserUrls.length === 1,
        'Join in browser should open exactly one browser window',
      );
      assert(
        browserFallback.openedUrls[0]?.url === 'about:blank',
        'Join in browser should detach opener before navigating the popup',
      );
      assert(
        observedBrowserUrls[0] ===
          'https://v.ringcentral.com/conf/on/123456?passcode=abc',
        'Join in browser should open the direct browser meeting route',
      );
      assert(
        popup || browserFallback.openedUrls[0]?.target === '_blank',
        'Join in browser should use a new browser window target',
      );
    }
    assert(
      !browserFallback.fallbackStillVisible,
      `Join in browser should close the native handoff fallback panel: ${JSON.stringify(
        browserFallback,
      )}`,
    );

    await page.evaluate(() => {
      window.__paiOriginalJoinReached = false;
    });
    await page.evaluate(() => {
      const detailButton = document.querySelector(
        '[data-test-automation-id="join-meeting-button"]',
      );
      detailButton?.dispatchEvent(
        new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          button: 0,
        }),
      );
    });
    await page
      .waitForFunction(
        () =>
          Boolean(document.querySelector('#pai-ringcentral-native-join-fallback')) ||
          window.__paiOriginalJoinReached === true,
        undefined,
        { timeout: 3000 },
      )
      .catch(() => undefined);
    const detailJoinState = await page.evaluate(() => ({
      fallbackVisible: Boolean(
        document.querySelector('#pai-ringcentral-native-join-fallback'),
      ),
      originalJoinReached: window.__paiOriginalJoinReached === true,
      selectedEventId:
        document
          .querySelector(
            '[data-at="calendar-event-item-wrapper"][data-calendar-event-item-id][aria-selected="true"]',
          )
          ?.getAttribute('data-calendar-event-item-id') || '',
      calendarSyncCount: window.__paiCalendarSyncCount || 0,
      clickLog: window.__paiClickLog || [],
      locationPath: window.location.pathname,
    }));
    assert(
      !detailJoinState.originalJoinReached,
      `Detail join click should be intercepted before RingCentral handles it: ${JSON.stringify(
        detailJoinState,
      )}`,
    );
    assert(
      detailJoinState.fallbackVisible,
      `Detail join click should show the native handoff fallback: ${JSON.stringify(
        detailJoinState,
      )}`,
    );
    await page.evaluate(() => {
      window.__paiBlockWindowOpen = true;
      window.__paiOpenedUrls = [];
    });
    await page.evaluate(() => {
      const button = document.querySelector(
        '[data-pai-ringcentral-native-join-fallback-link]',
      );
      button?.dispatchEvent(
        new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          button: 0,
        }),
      );
    });
    await page.waitForURL(
      'https://v.ringcentral.com/conf/on/123456?passcode=abc',
    );
    assert(
      page.url() === 'https://v.ringcentral.com/conf/on/123456?passcode=abc',
      'Blocked popup fallback should continue in the current tab',
    );

    console.log('RingCentral native join E2E passed.');
  } finally {
    if (context) await context.close();
    await fs.rm(userDataDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
