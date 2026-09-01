#!/usr/bin/env node
// Guards the Glip native-join click interceptor against target drift: clicking
// something that merely mentions "join" must never hijack the click and open a
// meeting that was posted in a different conversation.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import playwright from '../desktop-app/node_modules/playwright/index.js';

const { chromium } = playwright;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const contentScriptPath = path.join(repoRoot, 'dist', 'contentScriptGlip.js');

const OPEN_CONVERSATION_URL = 'https://app.ringcentral.com/messages/162046074886';
const SIDEBAR_CONVERSATION_PATH = '/messages/159002796038';
const STREAM_MEETING_ID = '730504426';
const STREAM_MEETING_URL = `https://v.ringcentral.com/join/${STREAM_MEETING_ID}?pw=8cb6ae025dc12e02e0efacf8e938670f`;
const CARD_MEETING_ID = '111222333';
const CARD_MEETING_URL = `https://v.ringcentral.com/join/${CARD_MEETING_ID}`;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

// Mirrors the part of the Glip layout that matters here: the sidebar and the
// open conversation share an ancestor, so an unscoped upward search from a
// sidebar row can reach meeting links belonging to another thread.
function renderFixtureHtml() {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>RingCentral Glip Native Join Fixture</title>
  </head>
  <body>
    <div id="app">
      <main id="app-layout">
        <nav id="conversation-list">
          <ul>
            <li
              id="sidebar-room-smart-join"
              role="button"
              aria-label="Room Smart Join - QR Code, 1 unread"
            >
              <a href="${SIDEBAR_CONVERSATION_PATH}">
                <span>Room Smart Join - QR Code</span>
                <span>Harish: Team Smart QR Join &mdash; to close loop on room pairing</span>
              </a>
            </li>
          </ul>
        </nav>
        <section id="conversation-stream"></section>
      </main>
    </div>
    <script>
      window.__paiNativeLaunches = [];
      window.__paiNavigationReached = [];
      window.__paiDefaultPrevented = [];

      const originalAnchorClick = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = function () {
        const href = String(this.href || '');
        if (href.startsWith('rcvdt://')) {
          window.__paiNativeLaunches.push(href);
          return;
        }
        return originalAnchorClick.call(this);
      };

      window.__paiRenderPastedLinkStream = () => {
        document.querySelector('#conversation-stream').innerHTML = \`
          <div class="conversation-card-wrapper" data-id="post-1">
            <span>Dylan Hu shared a link</span>
            <a href="${STREAM_MEETING_URL}">${STREAM_MEETING_URL}</a>
          </div>
        \`;
      };

      window.__paiRenderMeetingCardStream = () => {
        document.querySelector('#conversation-stream').innerHTML = \`
          <div class="conversation-card-wrapper" data-id="post-2">
            <div data-test-automation-id="meeting-invite-card">
              <span>Nova standup</span>
              <a href="${CARD_MEETING_URL}">${CARD_MEETING_URL}</a>
              <button id="card-join-button">Join</button>
            </div>
          </div>
        \`;
      };

      window.__paiRenderPastedLinkStream();
    </script>
  </body>
</html>`;
}

async function installChromeMock(page) {
  await page.addInitScript(() => {
    window.__paiStorageEnvConfig = {
      MEETING_NATIVE_CLIENT_JOIN_ENABLED: true,
    };
    const storageArea = {
      get: async (keys) => {
        const all = { envConfig: { ...window.__paiStorageEnvConfig } };
        if (!keys) return all;
        const wanted = Array.isArray(keys) ? keys : [keys];
        return Object.fromEntries(
          wanted
            .filter((key) => key in all)
            .map((key) => [key, all[key]]),
        );
      },
      set: async (items) => {
        if (items?.envConfig) {
          window.__paiStorageEnvConfig = { ...items.envConfig };
        }
      },
      remove: async () => undefined,
    };
    window.chrome = {
      runtime: {
        id: 'personal-ai-test',
        lastError: null,
        getURL: (resourcePath) =>
          `chrome-extension://personal-ai-test/${resourcePath}`,
        sendMessage: (message, callback) => {
          if (typeof callback === 'function') {
            setTimeout(() => callback({ success: true }), 0);
          }
        },
        onMessage: { addListener: () => undefined, removeListener: () => undefined },
      },
      storage: {
        local: storageArea,
        sync: storageArea,
        onChanged: { addListener: () => undefined, removeListener: () => undefined },
      },
      i18n: { getMessage: () => '' },
    };
  });
}

async function installClickProbes(page) {
  await page.evaluate(() => {
    document.addEventListener('click', (event) => {
      const anchor = event.target?.closest?.('a[href]');
      if (anchor) {
        window.__paiNavigationReached.push(
          new URL(anchor.href, location.href).pathname,
        );
      }
      window.__paiDefaultPrevented.push(event.defaultPrevented === true);
      event.preventDefault();
    });
  });
}

async function resetProbes(page) {
  await page.evaluate(() => {
    window.__paiNativeLaunches = [];
    window.__paiNavigationReached = [];
    window.__paiDefaultPrevented = [];
    document.querySelector('#pai-ringcentral-native-join-fallback')?.remove();
    document
      .querySelector('#pai-ringcentral-native-join-dismissed-recovery')
      ?.remove();
  });
}

async function readJoinState(page) {
  return page.evaluate(() => ({
    fallbackVisible: Boolean(
      document.querySelector('#pai-ringcentral-native-join-fallback'),
    ),
    visibleBrowserUrl:
      document.querySelector(
        '[data-pai-ringcentral-native-join-visible-link]',
      )?.textContent || '',
    nativeLaunches: window.__paiNativeLaunches || [],
    navigationReached: window.__paiNavigationReached || [],
    defaultPrevented: window.__paiDefaultPrevented || [],
  }));
}

async function main() {
  await fs.access(contentScriptPath);

  const userDataDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'pai-glip-native-join-'),
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
    await page.goto(OPEN_CONVERSATION_URL);
    await page.addScriptTag({ path: contentScriptPath });
    // The Glip content script attaches its interceptors on a startup timer.
    await page.waitForTimeout(2500);
    await installClickProbes(page);

    await resetProbes(page);
    await page.click('#sidebar-room-smart-join span');
    await page.waitForTimeout(500);
    const sidebarState = await readJoinState(page);
    assert(
      !sidebarState.fallbackVisible &&
        sidebarState.nativeLaunches.length === 0,
      `Clicking a sidebar conversation named "Room Smart Join" must not start a meeting handoff: ${JSON.stringify(
        sidebarState,
      )}`,
    );
    assert(
      sidebarState.navigationReached.includes(SIDEBAR_CONVERSATION_PATH) &&
        sidebarState.defaultPrevented.every((value) => value === false),
      `Clicking a sidebar conversation must reach RingCentral's own navigation: ${JSON.stringify(
        sidebarState,
      )}`,
    );

    await resetProbes(page);
    await page.click('#conversation-stream a');
    await page.waitForSelector('#pai-ringcentral-native-join-fallback');
    const pastedLinkState = await readJoinState(page);
    assert(
      pastedLinkState.nativeLaunches.includes(
        `rcvdt://join/${STREAM_MEETING_ID}?pw=8cb6ae025dc12e02e0efacf8e938670f`,
      ) &&
        pastedLinkState.visibleBrowserUrl ===
          `https://v.ringcentral.com/conf/on/${STREAM_MEETING_ID}`,
      `A pasted meeting link in the open conversation should still hand off to the app: ${JSON.stringify(
        pastedLinkState,
      )}`,
    );

    await resetProbes(page);
    await page.evaluate(() => window.__paiRenderMeetingCardStream());
    await page.click('#card-join-button');
    await page.waitForSelector('#pai-ringcentral-native-join-fallback');
    const cardJoinState = await readJoinState(page);
    assert(
      cardJoinState.nativeLaunches.includes(`rcvdt://join/${CARD_MEETING_ID}`) &&
        cardJoinState.visibleBrowserUrl ===
          `https://v.ringcentral.com/conf/on/${CARD_MEETING_ID}`,
      `A real Join button should hand off its own meeting: ${JSON.stringify(
        cardJoinState,
      )}`,
    );

    console.log('RingCentral Glip native join click-scoping check passed.');
  } finally {
    if (context) await context.close();
    await fs.rm(userDataDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
