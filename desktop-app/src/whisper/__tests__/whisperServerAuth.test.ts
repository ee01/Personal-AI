import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { DoubaoBridgeService } from '../../bridgeService.js';
import { loadConfig } from '../../config.js';
import { BridgeMemoryServiceClient } from '../../memoryServiceClient.js';
import { StateStore } from '../../persistence.js';
import { createBridgeServer } from '../../server.js';
import {
  applyBridgeSettingsToConfig,
  BridgeSettingsStore,
} from '../../settings.js';
import { BridgeSyncManager } from '../../syncManager.js';

class FakeBrowser {
  async init(): Promise<void> {}
  async ensureAuthenticated(): Promise<boolean> {
    return true;
  }
  async openLogin(): Promise<{ url: string }> {
    return { url: 'https://example.test/login' };
  }
  async close(): Promise<void> {}
  async bringToFront(): Promise<void> {}
  async ensureReady(): Promise<void> {}
  async findLatestThread(): Promise<null> {
    return null;
  }
  async findThreadByTitle(): Promise<null> {
    return null;
  }
  async probeAuthStatus(): Promise<'connected'> {
    return 'connected';
  }
  status() {
    return { running: true, currentUrl: 'https://example.test' };
  }
}

test('whisper status endpoint requires pair token on full desktop server', async () => {
  const tempDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'personal-ai-whisper-auth-'),
  );
  const config = loadConfig({
    DOUBAO_BRIDGE_DATA_DIR: tempDir,
    DOUBAO_BRIDGE_PROFILE_DIR: path.join(tempDir, 'profile'),
    DOUBAO_BRIDGE_HEADLESS: 'true',
  });

  const store = new StateStore(path.join(tempDir, 'bridge-state.json'));
  const settingsStore = new BridgeSettingsStore(
    config,
    path.join(tempDir, 'bridge-settings.json'),
  );
  await settingsStore.init();
  applyBridgeSettingsToConfig(config, settingsStore.get());

  const browser = new FakeBrowser();
  const service = new DoubaoBridgeService(config, store, browser as never);
  await service.init();

  const memoryClient = new BridgeMemoryServiceClient(() => settingsStore.get());
  const syncManager = new BridgeSyncManager(
    config,
    settingsStore,
    memoryClient,
    service,
  );

  const app = await createBridgeServer(config, service, {
    memoryClient,
    settingsStore,
    syncManager,
    version: '2.0.0-test',
  });

  try {
    const unauthorized = await app.inject({
      method: 'GET',
      url: '/whisper/status',
    });
    assert.equal(unauthorized.statusCode, 401);

    const pair = await app.inject({
      method: 'POST',
      url: '/pair',
      payload: {},
    });
    assert.equal(pair.statusCode, 200);
    const token = (pair.json() as { token: string }).token;
    assert.ok(token);

    const authorized = await app.inject({
      method: 'GET',
      url: '/whisper/status',
      headers: { 'x-bridge-token': token },
    });
    assert.equal(authorized.statusCode, 200);
    const body = authorized.json() as { ok: boolean };
    assert.equal(body.ok, true);
  } finally {
    syncManager.stop();
    await app.close();
  }
});
