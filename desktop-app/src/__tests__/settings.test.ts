import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { loadConfig } from '../config.js';
import { BridgeSettingsStore } from '../settings.js';

async function createTempDir(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

test('BridgeSettingsStore preserves autoSync=false across reloads', async () => {
  const tempDir = await createTempDir('bridge-settings-false-');
  const settingsFile = path.join(tempDir, 'bridge-settings.json');
  const config = loadConfig({
    DOUBAO_BRIDGE_DATA_DIR: tempDir,
    DOUBAO_BRIDGE_AUTO_SYNC: 'true',
  });

  const store = new BridgeSettingsStore(config, settingsFile);
  await store.init();
  await store.update({ autoSync: false });

  const reloaded = new BridgeSettingsStore(config, settingsFile);
  await reloaded.init();

  assert.equal(reloaded.get().autoSync, false);
  assert.equal(reloaded.getPayload().user.autoSync, false);
});

test('BridgeSettingsStore preserves autoSync=true across reloads', async () => {
  const tempDir = await createTempDir('bridge-settings-true-');
  const settingsFile = path.join(tempDir, 'bridge-settings.json');
  const config = loadConfig({
    DOUBAO_BRIDGE_DATA_DIR: tempDir,
    DOUBAO_BRIDGE_AUTO_SYNC: 'false',
  });

  const store = new BridgeSettingsStore(config, settingsFile);
  await store.init();
  await store.update({ autoSync: true });

  const reloaded = new BridgeSettingsStore(config, settingsFile);
  await reloaded.init();

  assert.equal(reloaded.get().autoSync, true);
  assert.equal(reloaded.getPayload().user.autoSync, true);
});

test('BridgeSettingsStore falls back to config default when autoSync override is absent', async () => {
  const tempDir = await createTempDir('bridge-settings-default-');
  const settingsFile = path.join(tempDir, 'bridge-settings.json');
  const config = loadConfig({
    DOUBAO_BRIDGE_DATA_DIR: tempDir,
    DOUBAO_BRIDGE_AUTO_SYNC: 'false',
  });

  const store = new BridgeSettingsStore(config, settingsFile);
  await store.init();

  assert.equal(store.get().autoSync, false);
  assert.deepEqual(store.getPayload().user, {});
});

test('BridgeSettingsStore persists explorer settings safely across reloads', async () => {
  const tempDir = await createTempDir('bridge-settings-explorer-');
  const settingsFile = path.join(tempDir, 'bridge-settings.json');
  const config = loadConfig({
    DOUBAO_BRIDGE_DATA_DIR: tempDir,
    DOUBAO_BRIDGE_AUTO_SYNC: 'true',
  });

  const store = new BridgeSettingsStore(config, settingsFile);
  await store.init();
  await store.update({
    explorer: {
      doubao: {
        enabled: true,
        lookbackDays: 14,
        intervalMinutes: 30,
        defaultScope: 'personal',
      },
      chatgpt: {
        enabled: true,
        maxConversations: 20,
        lookbackDays: 3,
        intervalMinutes: 90,
        defaultScope: 'work',
      },
      autoClassify: false,
      askDefaultScope: 'work',
    },
  });

  const reloaded = new BridgeSettingsStore(config, settingsFile);
  await reloaded.init();

  assert.deepEqual(reloaded.get().explorer, {
    doubao: {
      enabled: true,
      lookbackDays: 14,
      intervalMinutes: 30,
      defaultScope: 'personal',
      transport: undefined,
      broadcastTransport: undefined,
    },
    chatgpt: {
      enabled: true,
      maxConversations: 20,
      lookbackDays: 3,
      intervalMinutes: 90,
      defaultScope: 'work',
      transport: undefined,
    },
    autoClassify: false,
    askDefaultScope: 'work',
  });
  assert.deepEqual(reloaded.getPayload().user.explorer, {
    doubao: {
      enabled: true,
      lookbackDays: 14,
      intervalMinutes: 30,
      defaultScope: 'personal',
    },
    chatgpt: {
      enabled: true,
      maxConversations: 20,
      lookbackDays: 3,
      intervalMinutes: 90,
      defaultScope: 'work',
    },
    autoClassify: false,
    askDefaultScope: 'work',
  });
});
