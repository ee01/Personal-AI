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
  assert.ok(session.context);
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

test('ensureStarted reopens a page in the existing persistent context when all windows were closed', async () => {
  const session = createSession() as any;
  const reopenedPage = {
    isClosed: () => false,
    url: () => 'https://www.doubao.com/',
  };
  let launchCalls = 0;
  let newPageCalls = 0;

  session.page = {
    isClosed: () => true,
    url: () => 'about:blank',
  };
  session.context = {
    pages: () => [],
    newPage: async () => {
      newPageCalls += 1;
      return reopenedPage;
    },
    grantPermissions: async () => undefined,
  };
  session.launchPersistentContext = async () => {
    launchCalls += 1;
    throw new Error('launchPersistentContext should not be called when context can be reused');
  };

  await session.ensureStarted();

  assert.equal(newPageCalls, 1);
  assert.equal(launchCalls, 0);
  assert.equal(session.page, reopenedPage);
  assert.ok(session.context);
});

test('ensureStarted retries launch after recovering a locked profile directory', async () => {
  const session = createSession() as any;
  const createdPage = {
    isClosed: () => false,
    url: () => 'https://www.doubao.com/',
  };
  const createdContext = {
    pages: () => [createdPage],
    newPage: async () => createdPage,
    grantPermissions: async () => undefined,
  };
  let launchCalls = 0;
  let recoveryCalls = 0;

  session.launchPersistentContext = async () => {
    launchCalls += 1;
    if (launchCalls === 1) {
      throw new Error('Failed to create a ProcessSingleton for your profile directory.');
    }
    return createdContext;
  };
  session.recoverProfileDirectoryLock = async () => {
    recoveryCalls += 1;
    return true;
  };

  await session.ensureStarted();

  assert.equal(recoveryCalls, 1);
  assert.equal(launchCalls, 2);
  assert.equal(session.context, createdContext);
  assert.equal(session.page, createdPage);
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
  assert.ok(session.context);
});
