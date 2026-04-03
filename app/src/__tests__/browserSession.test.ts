import assert from 'node:assert/strict';
import test from 'node:test';
import os from 'node:os';
import path from 'node:path';

import { loadConfig } from '../config.js';
import { DoubaoBrowserSession } from '../browserSession.js';

function createSession() {
  const tempDir = path.join(os.tmpdir(), `doubao-browser-session-${Date.now()}-${Math.random()}`);
  return new DoubaoBrowserSession(
    loadConfig({
      DOUBAO_BRIDGE_DATA_DIR: tempDir,
      DOUBAO_BRIDGE_PROFILE_DIR: path.join(tempDir, 'profile'),
      DOUBAO_BRIDGE_HEADLESS: 'true',
    }),
  );
}

test('status treats a manually closed browser as not running', () => {
  const session = createSession() as any;
  let pagesCalls = 0;

  session.page = {
    isClosed: () => true,
    url: () => 'about:blank',
  };
  session.context = {
    pages: () => {
      pagesCalls += 1;
      return [];
    },
  };

  const status = session.status();

  assert.equal(status.running, false);
  assert.equal(status.currentUrl, undefined);
  assert.equal(pagesCalls, 1);
  assert.equal(session.page, null);
  assert.equal(session.context, null);
});

test('status reuses another live page instead of clearing the session', () => {
  const session = createSession() as any;
  const livePage = {
    isClosed: () => false,
    url: () => 'https://www.doubao.com/chat/existing-thread',
  };

  session.page = {
    isClosed: () => true,
    url: () => 'about:blank',
  };
  session.context = {
    pages: () => [livePage],
  };

  const status = session.status();

  assert.equal(status.running, true);
  assert.equal(status.currentUrl, 'https://www.doubao.com/chat/existing-thread');
  assert.equal(session.page, livePage);
  assert.ok(session.context);
});

test('probeAuthStatus returns needs_login after the browser was manually closed', async () => {
  const session = createSession() as any;

  session.page = {
    isClosed: () => true,
    url: () => 'about:blank',
  };
  session.context = {
    pages: () => [],
  };

  const status = await session.probeAuthStatus();

  assert.equal(status, 'needs_login');
  assert.equal(session.page, null);
  assert.equal(session.context, null);
});
