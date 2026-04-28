import assert from 'node:assert/strict';
import test from 'node:test';

import { loadConfig } from '../config.js';

test('loadConfig prefers DESKTOP_APP_* env vars over legacy DOUBAO_BRIDGE_* vars', () => {
  const config = loadConfig({
    DESKTOP_APP_PORT: '51234',
    DOUBAO_BRIDGE_PORT: '46321',
    DESKTOP_APP_HOST: '127.0.0.2',
    DOUBAO_BRIDGE_HOST: '127.0.0.1',
    DESKTOP_APP_DATA_DIR: '/tmp/desktop-data',
    DOUBAO_BRIDGE_DATA_DIR: '/tmp/legacy-data',
    DESKTOP_APP_PROFILE_DIR: '/tmp/desktop-profile',
    DOUBAO_BRIDGE_PROFILE_DIR: '/tmp/legacy-profile',
    DESKTOP_APP_AUTO_SYNC: 'false',
    DOUBAO_BRIDGE_AUTO_SYNC: 'true',
  });

  assert.equal(config.port, 51234);
  assert.equal(config.host, '127.0.0.2');
  assert.equal(config.dataDir, '/tmp/desktop-data');
  assert.equal(config.profileDir, '/tmp/desktop-profile');
  assert.equal(config.autoSync, false);
});

test('loadConfig falls back to legacy DOUBAO_BRIDGE_* env vars with deprecation warnings', () => {
  const warnings: string[] = [];
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    warnings.push(args.map((value) => String(value)).join(' '));
  };

  try {
    const config = loadConfig({
      DOUBAO_BRIDGE_PORT: '46322',
      DOUBAO_BRIDGE_HOST: '127.0.0.3',
      DOUBAO_BRIDGE_DATA_DIR: '/tmp/legacy-data',
      DOUBAO_BRIDGE_PROFILE_DIR: '/tmp/legacy-profile',
      DOUBAO_BRIDGE_AUTO_SYNC: 'true',
    });

    assert.equal(config.port, 46322);
    assert.equal(config.host, '127.0.0.3');
    assert.equal(config.dataDir, '/tmp/legacy-data');
    assert.equal(config.profileDir, '/tmp/legacy-profile');
    assert.equal(config.autoSync, true);
    assert.ok(
      warnings.some((warning) => warning.includes('DOUBAO_BRIDGE_PORT')),
    );
    assert.ok(
      warnings.some((warning) => warning.includes('DOUBAO_BRIDGE_DATA_DIR')),
    );
  } finally {
    console.warn = originalWarn;
  }
});
