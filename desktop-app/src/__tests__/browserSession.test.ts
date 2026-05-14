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

test('post-send inspection requires a new visible message occurrence', async () => {
  const session = createSession() as any;
  const transcript = '请把以下长期稳定信息存入随手记：测试偏好';
  const probe = transcript.replace(/\s+/g, ' ').trim().slice(0, 24);
  const bodyText = `历史消息：${probe}：旧内容`;

  session.page = {
    evaluate: async () => bodyText,
  };

  const result = await session.inspectPostSend(transcript, 1);

  assert.equal(result.visibleMatchCount, 1);
  assert.equal(result.messageVisible, false);
});

test('post-send verification waits until a new visible message appears', async () => {
  const session = createSession() as any;
  const transcript = '请把以下长期稳定信息存入随手记：新的同步内容';
  const probe = transcript.replace(/\s+/g, ' ').trim().slice(0, 24);
  const bodySequence = [
    `历史消息：${probe}：旧内容`,
    `历史消息：${probe}：旧内容`,
    `历史消息：${probe}：旧内容\n本次消息：${probe}：新的同步内容`,
  ];
  let waits = 0;

  session.page = {
    evaluate: async () =>
      bodySequence.shift() ??
      `历史消息：${probe}：旧内容\n本次消息：${probe}：新的同步内容`,
    waitForTimeout: async () => {
      waits += 1;
    },
  };

  const result = await session.waitForPostSend(transcript, 1);

  assert.equal(result.visibleMatchCount, 2);
  assert.equal(result.messageVisible, true);
  assert.equal(waits, 2);
});
