import assert from 'node:assert/strict';
import test from 'node:test';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';

import { loadConfig } from '../config.js';
import { StateStore } from '../persistence.js';
import { DoubaoBridgeService } from '../bridgeService.js';
import { createBridgeServer } from '../server.js';
import type { BrowserSendResult, BrowserThreadSnapshot } from '../browserSession.js';

class FakeBrowser {
  running = false;
  currentUrl = '';
  threadCounter = 0;

  async ensureStarted(): Promise<void> {
    this.running = true;
  }

  async openLogin(): Promise<string> {
    await this.ensureStarted();
    this.currentUrl = 'https://www.doubao.com/';
    return this.currentUrl;
  }

  async openThread(url: string): Promise<BrowserThreadSnapshot> {
    await this.ensureStarted();
    this.currentUrl = url;
    const threadId = url.split('/').pop() || undefined;
    return { url, title: 'Opened Thread', threadId };
  }

  async sendTranscript(transcript: string, threadUrl?: string): Promise<BrowserSendResult> {
    await this.ensureStarted();
    if (threadUrl && /\/(?:chat|thread)\//.test(threadUrl)) {
      this.currentUrl = threadUrl;
      return {
        url: this.currentUrl,
        title: 'Existing Thread',
        threadId: threadUrl.split('/').pop() || undefined,
        sent: transcript.length > 0,
      };
    }

    this.threadCounter += 1;
    this.currentUrl = `https://www.doubao.com/chat/generated-${this.threadCounter}`;
    return {
      url: this.currentUrl,
      title: '长期记忆同步线程',
      threadId: `generated-${this.threadCounter}`,
      sent: transcript.length > 0,
    };
  }

  async probeAuthStatus(): Promise<'connected' | 'needs_login'> {
    return this.running ? 'connected' : 'needs_login';
  }

  async findThreadByTitle(title: string): Promise<BrowserThreadSnapshot | null> {
    return {
      title,
      url: `https://www.doubao.com/chat/${encodeURIComponent(title)}`,
      threadId: encodeURIComponent(title),
    };
  }

  status() {
    return { running: this.running, currentUrl: this.currentUrl };
  }

  async close(): Promise<void> {}
}

test('bridge health and pairing flow', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'doubao-bridge-test-'));
  const config = loadConfig({
    DOUBAO_BRIDGE_DATA_DIR: tempDir,
    DOUBAO_BRIDGE_PROFILE_DIR: path.join(tempDir, 'profile'),
    DOUBAO_BRIDGE_HEADLESS: 'true',
  });

  const store = new StateStore(path.join(tempDir, 'bridge-state.json'));
  const browser = new FakeBrowser();
  const service = new DoubaoBridgeService(config, store, browser);
  await service.init();

  const app = await createBridgeServer(config, service);
  const health = await app.inject({ method: 'GET', url: '/health' });
  assert.equal(health.statusCode, 200);

  const pair = await app.inject({ method: 'POST', url: '/pair', payload: {} });
  assert.equal(pair.statusCode, 200);
  const pairBody = pair.json() as { paired: boolean; token: string };
  assert.equal(pairBody.paired, true);
  assert.ok(pairBody.token);

  const status = await app.inject({ method: 'GET', url: '/auth/status', headers: { 'x-bridge-token': pairBody.token } });
  assert.equal(status.statusCode, 200);
  const statusBody = status.json() as { paired: boolean };
  assert.equal(statusBody.paired, true);

  await app.close();
});

test('sync endpoints require a paired token and accept dry-run payloads', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'doubao-bridge-test-sync-'));
  const config = loadConfig({
    DOUBAO_BRIDGE_DATA_DIR: tempDir,
    DOUBAO_BRIDGE_PROFILE_DIR: path.join(tempDir, 'profile'),
    DOUBAO_BRIDGE_HEADLESS: 'true',
  });

  const store = new StateStore(path.join(tempDir, 'bridge-state.json'));
  const browser = new FakeBrowser();
  const service = new DoubaoBridgeService(config, store, browser);
  await service.init();

  const app = await createBridgeServer(config, service);
  const pair = await app.inject({ method: 'POST', url: '/pair', payload: {} });
  const token = (pair.json() as { token: string }).token;

  const sync = await app.inject({
    method: 'POST',
    url: '/sync/stable-memory',
    headers: { 'x-bridge-token': token },
    payload: {
      dryRun: true,
      items: [{ title: 'Preference', body: 'Prefers concise replies' }],
    },
  });
  assert.equal(sync.statusCode, 200);
  const syncBody = sync.json() as { accepted: boolean; transcript: string };
  assert.equal(syncBody.accepted, true);
  assert.match(syncBody.transcript, /Prefers concise replies/);

  const autoBind = await app.inject({
    method: 'POST',
    url: '/threads/auto-bind-mobile',
    headers: { 'x-bridge-token': token },
    payload: {
      title: '手机版对话',
    },
  });
  assert.equal(autoBind.statusCode, 200);
  const autoBindBody = autoBind.json() as { bindingType: string; title: string };
  assert.equal(autoBindBody.bindingType, 'mobile_context');
  assert.equal(autoBindBody.title, '手机版对话');

  await app.close();
});

test('createMemorySyncThread creates a real chat-style binding', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'doubao-bridge-test-thread-'));
  const config = loadConfig({
    DOUBAO_BRIDGE_DATA_DIR: tempDir,
    DOUBAO_BRIDGE_PROFILE_DIR: path.join(tempDir, 'profile'),
    DOUBAO_BRIDGE_HEADLESS: 'true',
  });

  const store = new StateStore(path.join(tempDir, 'bridge-state.json'));
  const browser = new FakeBrowser();
  const service = new DoubaoBridgeService(config, store, browser);
  await service.init();

  const thread = await service.createMemorySyncThread();
  assert.match(thread.id, /^generated-/);
  assert.match(thread.url || '', /\/chat\/generated-/);

  const status = await service.getStatus();
  assert.equal(status.bindings.memory_sync?.threadId, thread.id);
  assert.equal(status.bindings.memory_sync?.threadUrl, thread.url);
});
