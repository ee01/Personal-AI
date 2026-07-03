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
      window.__paiClipboardShouldFail = false;
      window.__paiClickLog = [];
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: async (text) => {
            if (window.__paiClipboardShouldFail) {
              throw new Error('clipboard_denied');
            }
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
            location:
              'https://nam01.safelinks.protection.outlook.com/?url=https%3A%2F%2Fv.ringcentral.com%2Flauncher%2F123456%3Fpasscode%3Dabc&data=calendar-wrapper',
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
    window.__paiStorageShouldFail = false;
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
            if (window.__paiStorageShouldFail) {
              throw new Error('storage_write_failed');
            }
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
      const linkPrivacy = fallback?.querySelector(
        '[data-pai-ringcentral-native-join-link-privacy]',
      );
      const revealLinkButton = fallback?.querySelector(
        '[data-pai-ringcentral-native-join-reveal-link]',
      );
      const handoffReceipt = fallback?.querySelector(
        '[data-pai-ringcentral-native-join-handoff-receipt]',
      );
      const meetingIdValue = fallback?.querySelector(
        '[data-pai-ringcentral-native-join-meeting-id-value]',
      );
      const meetingIdNote = fallback?.querySelector(
        '[data-pai-ringcentral-native-join-meeting-id-note]',
      );
      const copyMeetingIdButton = fallback?.querySelector(
        '[data-pai-ringcentral-native-join-copy-meeting-id]',
      );
      const passcodeValue = fallback?.querySelector(
        '[data-pai-ringcentral-native-join-passcode-value]',
      );
      const passcodeNote = fallback?.querySelector(
        '[data-pai-ringcentral-native-join-passcode-note]',
      );
      const copyPasscodeButton = fallback?.querySelector(
        '[data-pai-ringcentral-native-join-copy-passcode]',
      );
      return {
        fallbackText: fallback?.textContent || '',
        fallbackRole: fallback?.getAttribute('role') || '',
        fallbackLabel: fallback?.getAttribute('aria-label') || '',
        fallbackStyle: fallback?.getAttribute('style') || '',
        browserTag: browserLink?.tagName || '',
        copyTag: copyButton?.tagName || '',
        closeTag: closeButton?.tagName || '',
        closeLabel: closeButton?.getAttribute('aria-label') || '',
        visibleBrowserUrl: visibleBrowserLink?.textContent || '',
        linkPrivacyText: linkPrivacy?.textContent || '',
        revealLinkButtonText: revealLinkButton?.textContent || '',
        handoffReceiptText: handoffReceipt?.textContent || '',
        meetingIdText: meetingIdValue?.textContent || '',
        meetingIdNoteText: meetingIdNote?.textContent || '',
        copyMeetingIdButtonText: copyMeetingIdButton?.textContent || '',
        passcodeValueText: passcodeValue?.textContent || '',
        passcodeNoteText: passcodeNote?.textContent || '',
        copyPasscodeButtonText: copyPasscodeButton?.textContent || '',
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
        !result.fallbackText.includes('Try app again') &&
        !result.fallbackText.includes('Dismiss') &&
        !result.fallbackText.includes('Open app again'),
      'Native join fallback should expose browser fallback and copy action without initial app retry or bottom dismiss',
    );
    assert(
      result.handoffReceiptText.includes('Handoff receipt') &&
        result.handoffReceiptText.includes('App attempt started') &&
        result.handoffReceiptText.includes('validated full meeting link') &&
        result.handoffReceiptText.includes('whether you joined') &&
        result.handoffReceiptText.includes('cannot verify') &&
        result.handoffReceiptText.includes('browser recovery stays available') &&
        result.handoffReceiptText.includes('only in this panel') &&
        result.handoffReceiptText.includes(
          'Default join preference has not changed',
        ),
      `Native join fallback should show a persistent handoff receipt: ${JSON.stringify(
        result,
      )}`,
    );
    assert(
      result.fallbackRole === 'region' &&
        result.fallbackLabel === 'RingCentral app handoff fallback',
      'Native join fallback is missing accessible region metadata',
    );
    assert(
      result.fallbackStyle.includes('max-height') &&
        result.fallbackStyle.includes('100vh') &&
        result.fallbackStyle.includes('overflow: auto') &&
        result.fallbackStyle.includes('overscroll-behavior: contain'),
      `Native join fallback should be bounded and scrollable in short viewports: ${JSON.stringify(
        result,
      )}`,
    );
    assert(
      result.fallbackText.includes('If Chrome asks') &&
        result.fallbackText.includes('Open RingCentral') &&
        result.fallbackText.includes('continue in the browser'),
      `Native join fallback should guide the Chrome external app prompt: ${JSON.stringify(
        result,
      )}`,
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
        'https://v.ringcentral.com/conf/on/123456',
      'Native join fallback should hide passcode-bearing URL details by default',
    );
    assert(
      result.linkPrivacyText.includes('Passcode and extra URL details') &&
        result.revealLinkButtonText.includes('Show full link') &&
        !result.fallbackText.includes('passcode=abc'),
      `Native join fallback should disclose hidden URL details without exposing the passcode by default: ${JSON.stringify(
        result,
      )}`,
    );
    assert(
      result.meetingIdText === '123456' &&
        result.meetingIdNoteText.includes('ID only') &&
        result.meetingIdNoteText.includes('passcode/details') &&
        result.meetingIdNoteText.includes('Join in browser') &&
        result.meetingIdNoteText.includes('Copy link') &&
        result.meetingIdNoteText.includes('Show full link') &&
        result.copyMeetingIdButtonText.includes('Copy ID'),
      `Native join fallback should expose a copyable meeting ID for manual app join: ${JSON.stringify(
        result,
      )}`,
    );
    assert(
      result.passcodeValueText === 'Hidden until copied' &&
        result.passcodeNoteText.includes('manual app entry') &&
        result.copyPasscodeButtonText.includes('Copy passcode') &&
        !result.fallbackText.includes('passcode=abc'),
      `Native join fallback should expose passcode recovery without revealing it by default: ${JSON.stringify(
        result,
      )}`,
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
    const handoffRecoveryState = await page.evaluate(() => ({
      fallbackStillVisible: Boolean(
        document.querySelector('#pai-ringcentral-native-join-fallback'),
      ),
      fallbackText:
        document.querySelector('#pai-ringcentral-native-join-fallback')
          ?.textContent || '',
      status:
        document.querySelector(
          '[data-pai-ringcentral-native-join-status]',
        )?.textContent || '',
      handoffReceiptText:
        document.querySelector(
          '[data-pai-ringcentral-native-join-handoff-receipt]',
        )?.textContent || '',
      launchLinkStillPresent: Boolean(
        document.querySelector('#pai-ringcentral-native-join-launch-link'),
      ),
    }));
    assert(
      handoffRecoveryState.fallbackStillVisible &&
        handoffRecoveryState.status.includes('Still on this page?') &&
        handoffRecoveryState.fallbackText.includes(
          'RingCentral app did not take over',
        ) &&
        handoffRecoveryState.fallbackText.includes(
          'Use the browser fallback',
        ) &&
        handoffRecoveryState.fallbackText.includes('Try app again') &&
        handoffRecoveryState.handoffReceiptText.includes(
          'No app takeover was detected',
        ) &&
        handoffRecoveryState.handoffReceiptText.includes(
          'does not prove the app failed',
        ) &&
        handoffRecoveryState.handoffReceiptText.includes(
          'that you joined elsewhere',
        ) &&
        handoffRecoveryState.handoffReceiptText.includes(
          'copy the full meeting link',
        ) &&
        handoffRecoveryState.handoffReceiptText.includes(
          'Default join preference stays unchanged',
        ) &&
        !handoffRecoveryState.fallbackText.includes('passcode=abc'),
      `Native join fallback should stay visible with recovery guidance when the browser page remains active: ${JSON.stringify(
        handoffRecoveryState,
      )}`,
    );

    await page.click(
      'button[aria-label="Try opening this RingCentral meeting in the app again"]',
    );
    await page.waitForFunction(
      () => (window.__paiNativeLaunches || []).length >= 2,
    );
    const appRetryState = await page.evaluate(() => ({
      nativeLaunches: window.__paiNativeLaunches || [],
      fallbackStillVisible: Boolean(
        document.querySelector('#pai-ringcentral-native-join-fallback'),
      ),
      fallbackText:
        document.querySelector('#pai-ringcentral-native-join-fallback')
          ?.textContent || '',
      status:
        document.querySelector(
          '[data-pai-ringcentral-native-join-status]',
        )?.textContent || '',
      handoffReceiptText:
        document.querySelector(
          '[data-pai-ringcentral-native-join-handoff-receipt]',
        )?.textContent || '',
    }));
    assert(
      appRetryState.fallbackStillVisible &&
        appRetryState.nativeLaunches.filter(
          (href) => href === 'rcvdt://join/123456?passcode=abc',
        ).length >= 2 &&
        appRetryState.fallbackText.includes(
          'Trying RingCentral app again',
        ) &&
        appRetryState.status.includes(
          'Trying the RingCentral app again',
        ) &&
        appRetryState.handoffReceiptText.includes('App retry started') &&
        appRetryState.handoffReceiptText.includes(
          'reuses the validated full meeting link',
        ) &&
        appRetryState.handoffReceiptText.includes('whether you joined') &&
        appRetryState.handoffReceiptText.includes(
          'browser recovery and Copy link stay available',
        ) &&
        appRetryState.handoffReceiptText.includes(
          'Default join preference has not changed',
        ),
      `Try app again should relaunch the native URL without removing browser recovery or changing defaults: ${JSON.stringify(
        appRetryState,
      )}`,
    );

    await page.click('[data-pai-ringcentral-native-join-copy-meeting-id]');
    await page.waitForFunction(() => window.__paiCopiedText === '123456');
    const copiedMeetingIdState = await page.evaluate(() => ({
      copiedText: window.__paiCopiedText,
      fallbackStillVisible: Boolean(
        document.querySelector('#pai-ringcentral-native-join-fallback'),
      ),
      status:
        document.querySelector(
          '[data-pai-ringcentral-native-join-status]',
        )?.textContent || '',
      fallbackText:
        document.querySelector('#pai-ringcentral-native-join-fallback')
          ?.textContent || '',
    }));
    assert(
      copiedMeetingIdState.copiedText === '123456' &&
        copiedMeetingIdState.fallbackStillVisible &&
        copiedMeetingIdState.status.includes('Meeting ID copied') &&
        copiedMeetingIdState.status.includes('does not join the meeting') &&
        copiedMeetingIdState.status.includes('copy passcode/details') &&
        copiedMeetingIdState.status.includes('default join path') &&
        !copiedMeetingIdState.fallbackText.includes('passcode=abc'),
      `Copy Meeting ID should be a manual recovery action without leaking passcode or implying join success: ${JSON.stringify(
        copiedMeetingIdState,
      )}`,
    );

    await page.click('[data-pai-ringcentral-native-join-copy-passcode]');
    await page.waitForFunction(() => window.__paiCopiedText === 'abc');
    const copiedPasscodeState = await page.evaluate(() => ({
      copiedText: window.__paiCopiedText,
      fallbackStillVisible: Boolean(
        document.querySelector('#pai-ringcentral-native-join-fallback'),
      ),
      passcodeValueText:
        document.querySelector('[data-pai-ringcentral-native-join-passcode-value]')
          ?.textContent || '',
      status:
        document.querySelector(
          '[data-pai-ringcentral-native-join-status]',
        )?.textContent || '',
      fallbackText:
        document.querySelector('#pai-ringcentral-native-join-fallback')
          ?.textContent || '',
    }));
    assert(
      copiedPasscodeState.copiedText === 'abc' &&
        copiedPasscodeState.fallbackStillVisible &&
        copiedPasscodeState.passcodeValueText.includes('Hidden') &&
        copiedPasscodeState.status.includes('Meeting passcode copied') &&
        copiedPasscodeState.status.includes('manual app entry') &&
        copiedPasscodeState.status.includes('does not join the meeting') &&
        copiedPasscodeState.status.includes('retry the app') &&
        copiedPasscodeState.status.includes('copy the full link') &&
        copiedPasscodeState.status.includes('default join path') &&
        !copiedPasscodeState.fallbackText.includes('passcode=abc'),
      `Copy passcode should support manual app entry without revealing the full hidden link or implying join success: ${JSON.stringify(
        copiedPasscodeState,
      )}`,
    );

    await page.click('[data-pai-ringcentral-native-join-reveal-link]');
    const revealedLinkState = await page.evaluate(() => ({
      visibleBrowserUrl:
        document.querySelector('[data-pai-ringcentral-native-join-visible-link]')
          ?.textContent || '',
      privacyText:
        document.querySelector('[data-pai-ringcentral-native-join-link-privacy]')
          ?.textContent || '',
      revealButtonText:
        document.querySelector('[data-pai-ringcentral-native-join-reveal-link]')
          ?.textContent || '',
      status:
        document.querySelector(
          '[data-pai-ringcentral-native-join-status]',
        )?.textContent || '',
    }));
    assert(
      revealedLinkState.visibleBrowserUrl ===
        'https://v.ringcentral.com/conf/on/123456?passcode=abc' &&
        revealedLinkState.privacyText.includes('Full link is visible') &&
        revealedLinkState.revealButtonText.includes('Hide full link') &&
        revealedLinkState.status.includes('Full browser link is visible'),
      `Explicit reveal should show the full browser fallback link and warn about screen sharing: ${JSON.stringify(
        revealedLinkState,
      )}`,
    );
    await page.click('[data-pai-ringcentral-native-join-reveal-link]');
    const hiddenLinkState = await page.evaluate(() => ({
      visibleBrowserUrl:
        document.querySelector('[data-pai-ringcentral-native-join-visible-link]')
          ?.textContent || '',
      revealButtonText:
        document.querySelector('[data-pai-ringcentral-native-join-reveal-link]')
          ?.textContent || '',
      status:
        document.querySelector(
          '[data-pai-ringcentral-native-join-status]',
        )?.textContent || '',
    }));
    assert(
      hiddenLinkState.visibleBrowserUrl ===
        'https://v.ringcentral.com/conf/on/123456' &&
        hiddenLinkState.revealButtonText.includes('Show full link') &&
        hiddenLinkState.status.includes('Full browser link hidden'),
      `Hide full link should return the panel to the safer display URL: ${JSON.stringify(
        hiddenLinkState,
      )}`,
    );

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
      copyState.status.includes('Full browser meeting link copied') &&
        copyState.status.includes('hidden passcode/details') &&
        copyState.status.includes('does not join the meeting') &&
        copyState.status.includes('retry the app') &&
        copyState.status.includes('default join path'),
      `Copy link should confirm the copied browser meeting link: ${JSON.stringify(
        copyState,
      )}`,
    );
    assert(
      copyState.fallbackStillVisible,
      'Copying the browser link should keep the native handoff fallback panel visible',
    );

    await page.evaluate(() => {
      window.__paiClipboardShouldFail = true;
      window.__paiCopiedText = '';
    });
    await page.click('[data-pai-ringcentral-native-join-copy-link]');
    await page.waitForFunction(() =>
      (document.querySelector('[data-pai-ringcentral-native-join-status]')
        ?.textContent || ''
      ).includes('Copy failed'),
    );
    const copyFailureState = await page.evaluate(() => ({
      copiedText: window.__paiCopiedText,
      visibleBrowserUrl:
        document.querySelector('[data-pai-ringcentral-native-join-visible-link]')
          ?.textContent || '',
      privacyText:
        document.querySelector('[data-pai-ringcentral-native-join-link-privacy]')
          ?.textContent || '',
      revealButtonText:
        document.querySelector('[data-pai-ringcentral-native-join-reveal-link]')
          ?.textContent || '',
      status:
        document.querySelector(
          '[data-pai-ringcentral-native-join-status]',
        )?.textContent || '',
      fallbackStillVisible: Boolean(
        document.querySelector('#pai-ringcentral-native-join-fallback'),
      ),
    }));
    assert(
      copyFailureState.copiedText === '' &&
        copyFailureState.fallbackStillVisible &&
        copyFailureState.visibleBrowserUrl ===
          'https://v.ringcentral.com/conf/on/123456?passcode=abc' &&
        copyFailureState.privacyText.includes('Full link is visible') &&
        copyFailureState.revealButtonText.includes('Hide full link') &&
        copyFailureState.status.includes('manual copy'),
      `Copy failure should reveal the full recovery link instead of leaving a passcode-stripped link selected: ${JSON.stringify(
        copyFailureState,
      )}`,
    );
    await page.evaluate(() => {
      window.__paiClipboardShouldFail = false;
    });

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
      handoffReceiptText:
        document.querySelector(
          '[data-pai-ringcentral-native-join-handoff-receipt]',
        )?.textContent || '',
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
      browserDefaultState.handoffReceiptText.includes(
        'Default saved for future joins',
      ) &&
        browserDefaultState.handoffReceiptText.includes(
          'leave RingCentral meetings in the browser',
        ) &&
        browserDefaultState.handoffReceiptText.includes(
          'This meeting still has the browser recovery link available',
        ),
      `Saving browser default should update the handoff receipt without removing current recovery: ${JSON.stringify(
        browserDefaultState,
      )}`,
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
      handoffReceiptText:
        document.querySelector(
          '[data-pai-ringcentral-native-join-handoff-receipt]',
        )?.textContent || '',
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
    assert(
      appDefaultState.handoffReceiptText.includes(
        'Default saved for future joins',
      ) &&
        appDefaultState.handoffReceiptText.includes(
          'try the RingCentral app first',
        ) &&
        appDefaultState.handoffReceiptText.includes(
          'This meeting still has the browser recovery link available',
        ),
      `App-default undo should update the handoff receipt with the restored default: ${JSON.stringify(
        appDefaultState,
      )}`,
    );

    await page.evaluate(() => {
      window.__paiStorageShouldFail = true;
    });
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
    await page.waitForFunction(() =>
      (
        document.querySelector('[data-pai-ringcentral-native-join-status]')
          ?.textContent || ''
      ).includes('Could not save the default'),
    );
    const failedDefaultSaveState = await page.evaluate(() => ({
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
      handoffReceiptText:
        document.querySelector(
          '[data-pai-ringcentral-native-join-handoff-receipt]',
        )?.textContent || '',
      fallbackStillVisible: Boolean(
        document.querySelector('#pai-ringcentral-native-join-fallback'),
      ),
    }));
    assert(
      failedDefaultSaveState.nativeJoinEnabled === true,
      `Failed default save should leave the stored preference unchanged: ${JSON.stringify(
        failedDefaultSaveState,
      )}`,
    );
    assert(
      failedDefaultSaveState.fallbackStillVisible &&
        failedDefaultSaveState.defaultButtonText.includes(
          'Use browser by default',
        ),
      `Failed default save should keep the current recovery panel and undo action stable: ${JSON.stringify(
        failedDefaultSaveState,
      )}`,
    );
    assert(
      failedDefaultSaveState.status.includes('current join preference is unchanged') &&
        failedDefaultSaveState.handoffReceiptText.includes(
          'Default join preference was not saved',
        ) &&
        failedDefaultSaveState.handoffReceiptText.includes(
          'did not change future RingCentral joins',
        ) &&
        failedDefaultSaveState.handoffReceiptText.includes(
          'did not join this meeting',
        ) &&
        failedDefaultSaveState.handoffReceiptText.includes(
          'did not retry the app',
        ) &&
        failedDefaultSaveState.handoffReceiptText.includes(
          'did not open the browser meeting',
        ) &&
        failedDefaultSaveState.handoffReceiptText.includes(
          'did not copy any meeting material',
        ) &&
        failedDefaultSaveState.handoffReceiptText.includes(
          'browser recovery controls remain available',
        ),
      `Failed default save should expose a durable no-effect receipt: ${JSON.stringify(
        failedDefaultSaveState,
      )}`,
    );
    await page.evaluate(() => {
      window.__paiStorageShouldFail = false;
    });

    const nativeLaunchCountBeforeClose = await page.evaluate(
      () => (window.__paiNativeLaunches || []).length,
    );
    await page.evaluate(() => {
      const button = document.querySelector(
        '#pai-ringcentral-native-join-fallback [data-pai-ringcentral-native-join-close]',
      );
      button?.dispatchEvent(
        new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          button: 0,
        }),
      );
    });
    await page.waitForSelector('#pai-ringcentral-native-join-dismissed-recovery');
    const dismissedRecoveryState = await page.evaluate(() => ({
      fallbackVisible: Boolean(
        document.querySelector('#pai-ringcentral-native-join-fallback'),
      ),
      stripText:
        document.querySelector('#pai-ringcentral-native-join-dismissed-recovery')
          ?.textContent || '',
      restoreButtonText:
        document.querySelector(
          '[data-pai-ringcentral-native-join-restore-recovery]',
        )?.textContent || '',
      nativeLaunchCount: (window.__paiNativeLaunches || []).length,
    }));
    assert(
      !dismissedRecoveryState.fallbackVisible &&
        dismissedRecoveryState.stripText.includes(
          'RingCentral handoff hidden',
        ) &&
        dismissedRecoveryState.stripText.includes('No join was confirmed') &&
        dismissedRecoveryState.stripText.includes(
          'default path is unchanged',
        ) &&
        dismissedRecoveryState.restoreButtonText.includes('Restore recovery') &&
        dismissedRecoveryState.nativeLaunchCount === nativeLaunchCountBeforeClose,
      `Closing the handoff panel should leave a compact restore path without launching again: ${JSON.stringify(
        dismissedRecoveryState,
      )}`,
    );
    await page.click('[data-pai-ringcentral-native-join-restore-recovery]');
    await page.waitForSelector('#pai-ringcentral-native-join-fallback');
    const restoredRecoveryState = await page.evaluate(() => ({
      dismissedRecoveryVisible: Boolean(
        document.querySelector('#pai-ringcentral-native-join-dismissed-recovery'),
      ),
      fallbackText:
        document.querySelector('#pai-ringcentral-native-join-fallback')
          ?.textContent || '',
      title:
        document.querySelector('[data-pai-ringcentral-native-join-title]')
          ?.textContent || '',
      status:
        document.querySelector('[data-pai-ringcentral-native-join-status]')
          ?.textContent || '',
      handoffReceiptText:
        document.querySelector(
          '[data-pai-ringcentral-native-join-handoff-receipt]',
        )?.textContent || '',
      nativeLaunchCount: (window.__paiNativeLaunches || []).length,
    }));
    assert(
      !restoredRecoveryState.dismissedRecoveryVisible &&
        restoredRecoveryState.title.includes('RingCentral recovery restored') &&
        restoredRecoveryState.fallbackText.includes('Join in browser') &&
        restoredRecoveryState.fallbackText.includes('Copy link') &&
        restoredRecoveryState.fallbackText.includes('Try app again') &&
        restoredRecoveryState.status.includes('Recovery restored') &&
        restoredRecoveryState.status.includes('No join was confirmed') &&
        restoredRecoveryState.handoffReceiptText.includes(
          'Recovery panel restored after being hidden',
        ) &&
        restoredRecoveryState.handoffReceiptText.includes(
          'did not retry the app',
        ) &&
        restoredRecoveryState.handoffReceiptText.includes(
          'join in browser',
        ) &&
        restoredRecoveryState.handoffReceiptText.includes(
          'change the default join path',
        ) &&
        restoredRecoveryState.nativeLaunchCount === nativeLaunchCountBeforeClose,
      `Restoring recovery should not relaunch the app or imply a join happened: ${JSON.stringify(
        restoredRecoveryState,
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
