import assert from 'node:assert/strict';
import test from 'node:test';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';

import { loadConfig } from '../config.js';
import { StateStore } from '../persistence.js';
import { DoubaoBridgeService } from '../bridgeService.js';
import { createBridgeServer } from '../server.js';

class FakeBrowser {
  running = false;
  currentUrl = '';

  async ensureStarted(): Promise<void> {
    this.running = true;
  }

  async openLogin(): Promise<string> {
    await this.ensureStarted();
    this.currentUrl = 'https://www.doubao.com/';
    return this.currentUrl;
  }

  async openThread(url: string): Promise<string> {
    await this.ensureStarted();
    this.currentUrl = url;
    return url;
  }

  async sendTranscript(transcript: string, threadUrl?: string): Promise<{ url?: string; sent: boolean }> {
    await this.ensureStarted();
    this.currentUrl = threadUrl || this.currentUrl;
    return { url: this.currentUrl, sent: transcript.length > 0 };
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

  await app.close();
});
