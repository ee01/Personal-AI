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

test('BridgeSettingsStore defaults uiLanguage to zh-CN for old settings files', async () => {
  const tempDir = await createTempDir('bridge-settings-language-default-');
  const settingsFile = path.join(tempDir, 'bridge-settings.json');
  const config = loadConfig({
    DOUBAO_BRIDGE_DATA_DIR: tempDir,
  });
  await fs.writeFile(settingsFile, JSON.stringify({ autoSync: false }), 'utf8');

  const store = new BridgeSettingsStore(config, settingsFile);
  await store.init();

  assert.equal(store.get().uiLanguage, 'zh-CN');
  assert.equal(store.getPayload().effective.uiLanguage, 'zh-CN');
});

test('BridgeSettingsStore preserves uiLanguage across reloads', async () => {
  const tempDir = await createTempDir('bridge-settings-language-');
  const settingsFile = path.join(tempDir, 'bridge-settings.json');
  const config = loadConfig({
    DOUBAO_BRIDGE_DATA_DIR: tempDir,
  });

  const store = new BridgeSettingsStore(config, settingsFile);
  await store.init();
  await store.update({ uiLanguage: 'en-US' });

  const reloaded = new BridgeSettingsStore(config, settingsFile);
  await reloaded.init();

  assert.equal(reloaded.get().uiLanguage, 'en-US');
  assert.equal(reloaded.getPayload().user.uiLanguage, 'en-US');
});

test('BridgeSettingsStore defaults reminder delivery controls for old settings files', async () => {
  const tempDir = await createTempDir('bridge-settings-reminder-defaults-');
  const settingsFile = path.join(tempDir, 'bridge-settings.json');
  const config = loadConfig({
    DOUBAO_BRIDGE_DATA_DIR: tempDir,
  });
  await fs.writeFile(settingsFile, JSON.stringify({ autoSync: true }), 'utf8');

  const store = new BridgeSettingsStore(config, settingsFile);
  await store.init();

  assert.equal(store.get().reminderDailyDigestEnabled, true);
  assert.equal(store.get().reminderDailyDigestTime, '09:00');
  assert.equal(store.get().reminderDedupSameDay, true);
});

test('BridgeSettingsStore persists reminder delivery controls safely', async () => {
  const tempDir = await createTempDir('bridge-settings-reminder-controls-');
  const settingsFile = path.join(tempDir, 'bridge-settings.json');
  const config = loadConfig({
    DOUBAO_BRIDGE_DATA_DIR: tempDir,
  });

  const store = new BridgeSettingsStore(config, settingsFile);
  await store.init();
  await store.update({
    reminderDailyDigestEnabled: false,
    reminderDailyDigestTime: '7:05',
    reminderDedupSameDay: false,
  });

  const reloaded = new BridgeSettingsStore(config, settingsFile);
  await reloaded.init();

  assert.equal(reloaded.get().reminderDailyDigestEnabled, false);
  assert.equal(reloaded.get().reminderDailyDigestTime, '07:05');
  assert.equal(reloaded.get().reminderDedupSameDay, false);
  assert.equal(reloaded.getPayload().user.reminderDailyDigestTime, '7:05');
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
    codex_cli: {
      enabled: false,
      rootPaths: ['${CODEX_HOME:-~/.codex}/sessions'],
      lookbackDays: 30,
      intervalMinutes: 60,
      maxSessions: 50,
      includeSubagents: false,
      defaultScope: 'work',
    },
    claude_code_cli: {
      enabled: false,
      rootPaths: ['~/.claude/projects', '~/.claude/transcripts'],
      lookbackDays: 30,
      intervalMinutes: 60,
      maxSessions: 50,
      includeSubagents: true,
      defaultScope: 'work',
    },
    cursor_agent_cli: {
      enabled: false,
      rootPaths: ['~/.cursor/projects'],
      lookbackDays: 30,
      intervalMinutes: 60,
      maxSessions: 50,
      includeSubagents: true,
      defaultScope: 'work',
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

test('BridgeSettingsStore preserves backupPull across reloads', async () => {
  const tempDir = await createTempDir('bridge-settings-backup-pull-');
  const settingsFile = path.join(tempDir, 'bridge-settings.json');
  const config = loadConfig({
    DOUBAO_BRIDGE_DATA_DIR: tempDir,
  });

  const store = new BridgeSettingsStore(config, settingsFile);
  await store.init();
  await store.update({
    backupPull: {
      enabled: true,
      hour: 8,
      directory: '~/Library/CloudStorage/iCloud Drive/personal-ai-backups',
      retentionCount: 5,
      encrypt: false,
    },
  });

  const reloaded = new BridgeSettingsStore(config, settingsFile);
  await reloaded.init();

  assert.equal(reloaded.get().backupPull.enabled, true);
  assert.equal(reloaded.get().backupPull.hour, 8);
  assert.equal(
    reloaded.get().backupPull.directory,
    '~/Library/CloudStorage/iCloud Drive/personal-ai-backups',
  );
  assert.equal(reloaded.get().backupPull.retentionCount, 5);
  assert.equal(reloaded.get().backupPull.encrypt, false);
});
