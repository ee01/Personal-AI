import assert from 'node:assert/strict';
import test from 'node:test';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';

import { loadConfig } from '../config.js';
import { StateStore } from '../persistence.js';
import { DoubaoBridgeService } from '../bridgeService.js';
import { createBridgeServer } from '../server.js';
import { BridgeMemoryServiceClient } from '../memoryServiceClient.js';
import {
  applyBridgeSettingsToConfig,
  BridgeSettingsStore,
} from '../settings.js';
import { BridgeSyncManager } from '../syncManager.js';
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
  const settingsStore = new BridgeSettingsStore(config, path.join(tempDir, 'bridge-settings.json'));
  await settingsStore.init();
  applyBridgeSettingsToConfig(config, settingsStore.get());
  const browser = new FakeBrowser();
  const service = new DoubaoBridgeService(config, store, browser);
  await service.init();
  const memoryClient = new BridgeMemoryServiceClient(() => settingsStore.get());
  const syncManager = new BridgeSyncManager(config, settingsStore, memoryClient, service);

  const app = await createBridgeServer(config, service, {
    memoryClient,
    settingsStore,
    syncManager,
    version: '2.0.0-test',
  });
  const health = await app.inject({ method: 'GET', url: '/health' });
  assert.equal(health.statusCode, 200);

  const pair = await app.inject({ method: 'POST', url: '/pair', payload: {} });
  assert.equal(pair.statusCode, 200);
  const pairBody = pair.json() as { paired: boolean; token: string };
  assert.equal(pairBody.paired, true);
  assert.ok(pairBody.token);

  const status = await app.inject({ method: 'GET', url: '/auth/status', headers: { 'x-bridge-token': pairBody.token } });
  assert.equal(status.statusCode, 200);
  const statusBody = status.json() as { paired: boolean; appVersion: string; blockingReasons: Array<{ code: string }> };
  assert.equal(statusBody.paired, true);
  assert.equal(statusBody.appVersion, '2.0.0-test');
  assert.deepEqual(
    statusBody.blockingReasons.map((item) => item.code).sort(),
    ['auth_required', 'memory_service_user_missing', 'memory_sync_not_bound', 'mobile_context_not_bound'].sort(),
  );

  syncManager.stop();
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
  const settingsStore = new BridgeSettingsStore(config, path.join(tempDir, 'bridge-settings.json'));
  await settingsStore.init();
  applyBridgeSettingsToConfig(config, settingsStore.get());
  const browser = new FakeBrowser();
  const service = new DoubaoBridgeService(config, store, browser);
  await service.init();
  const memoryClient = new BridgeMemoryServiceClient(() => settingsStore.get());
  const syncManager = new BridgeSyncManager(config, settingsStore, memoryClient, service);

  const app = await createBridgeServer(config, service, {
    memoryClient,
    settingsStore,
    syncManager,
    version: '2.0.0-test',
  });
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

  syncManager.stop();
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

test('settings endpoint updates effective sync configuration', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'doubao-bridge-test-settings-'));
  const config = loadConfig({
    DOUBAO_BRIDGE_DATA_DIR: tempDir,
    DOUBAO_BRIDGE_PROFILE_DIR: path.join(tempDir, 'profile'),
    DOUBAO_BRIDGE_HEADLESS: 'true',
  });

  const store = new StateStore(path.join(tempDir, 'bridge-state.json'));
  const settingsStore = new BridgeSettingsStore(config, path.join(tempDir, 'bridge-settings.json'));
  await settingsStore.init();
  applyBridgeSettingsToConfig(config, settingsStore.get());
  const browser = new FakeBrowser();
  const service = new DoubaoBridgeService(config, store, browser);
  await service.init();
  const memoryClient = new BridgeMemoryServiceClient(() => settingsStore.get());
  const syncManager = new BridgeSyncManager(config, settingsStore, memoryClient, service);

  const app = await createBridgeServer(config, service, {
    memoryClient,
    settingsStore,
    syncManager,
    version: '2.0.0-test',
  });
  const pair = await app.inject({ method: 'POST', url: '/pair', payload: {} });
  const token = (pair.json() as { token: string }).token;

  const update = await app.inject({
    method: 'PUT',
    url: '/settings',
    headers: { 'x-bridge-token': token },
    payload: {
      memoryServiceBaseUrl: 'http://127.0.0.1:3210',
      memoryServiceUserId: 'esone.qiu',
      autoSync: true,
      stableMemoryIntervalMs: 60_000,
    },
  });
  assert.equal(update.statusCode, 200);

  const settings = await app.inject({
    method: 'GET',
    url: '/settings',
    headers: { 'x-bridge-token': token },
  });
  const settingsBody = settings.json() as {
    effective: {
      memoryServiceBaseUrl?: string;
      memoryServiceUserId?: string;
      autoSync?: boolean;
      stableMemoryIntervalMs?: number;
    };
  };
  assert.equal(settingsBody.effective.memoryServiceBaseUrl, 'http://127.0.0.1:3210');
  assert.equal(settingsBody.effective.memoryServiceUserId, 'esone.qiu');
  assert.equal(settingsBody.effective.autoSync, true);
  assert.equal(settingsBody.effective.stableMemoryIntervalMs, 60_000);

  const status = await app.inject({
    method: 'GET',
    url: '/status',
    headers: { 'x-bridge-token': token },
  });
  const statusBody = status.json() as {
    memoryServiceConfigured: boolean;
    autoSyncEnabled: boolean;
    syncReadiness: {
      stableMemory: { reasons: Array<{ code: string }> };
    };
  };
  assert.equal(statusBody.memoryServiceConfigured, true);
  assert.equal(statusBody.autoSyncEnabled, true);
  assert.deepEqual(
    statusBody.syncReadiness.stableMemory.reasons.map((item) => item.code).sort(),
    ['auth_required', 'memory_sync_not_bound'].sort(),
  );

  syncManager.stop();
  await app.close();
});
