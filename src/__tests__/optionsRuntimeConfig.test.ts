import test from 'node:test';
import assert from 'node:assert/strict';

import { getDefaultEnvConfig } from '../utils.js';
import {
  applyRuntimeConfigToEnvConfig,
  canSaveWithRuntimeConfig,
  diffServerBackedEnvConfig,
  displayServerBackedDefaultOn,
  displayServerBackedToggle,
  formatRuntimeHydrationReceipt,
  shouldWriteRuntimeConfig,
} from '../optionsRuntimeConfig.js';

test('server outreach off wins over stale local envConfig cache', () => {
  const local = {
    ...getDefaultEnvConfig(),
    OUTREACH_ENABLED: true,
    OPENAI_API_KEY: 'sk-local-only',
    RINGCENTRAL_SERVER_URL: '',
  };
  const hydrated = applyRuntimeConfigToEnvConfig(local, {
    outreachEnabled: false,
    ringCentralServerUrl: 'https://platform.ringcentral.com',
    ringCentralClientId: 'client-from-server',
  });

  assert.equal(hydrated.OUTREACH_ENABLED, false);
  assert.equal(hydrated.OPENAI_API_KEY, 'sk-local-only');
  assert.equal(
    hydrated.RINGCENTRAL_SERVER_URL,
    'https://platform.ringcentral.com',
  );
  assert.equal(hydrated.RINGCENTRAL_CLIENT_ID, 'client-from-server');
});

test('diff lists outreach when local cache disagrees with server', () => {
  const local = {
    ...getDefaultEnvConfig(),
    OUTREACH_ENABLED: true,
    SELF_REFLECTION_ENABLED: false,
  };
  const hydrated = applyRuntimeConfigToEnvConfig(local, {
    outreachEnabled: false,
    reflectionEnabled: false,
  });
  const diffs = diffServerBackedEnvConfig(local, hydrated);

  assert.deepEqual(
    diffs.map((item) => item.key),
    ['OUTREACH_ENABLED'],
  );
  assert.match(
    formatRuntimeHydrationReceipt(diffs),
    /主动询问引擎 本机 开启 → 服务端 关闭/,
  );
});

test('pending hydration hides stale local toggles and blocks PUT', () => {
  assert.equal(displayServerBackedToggle('pending', true), false);
  assert.equal(displayServerBackedToggle('ready', true), true);
  assert.equal(displayServerBackedDefaultOn('pending', true), false);
  assert.equal(displayServerBackedDefaultOn('ready', false), false);
  assert.equal(canSaveWithRuntimeConfig('pending'), false);
  assert.equal(canSaveWithRuntimeConfig('ready'), true);
  assert.equal(shouldWriteRuntimeConfig('ready'), true);
  assert.equal(shouldWriteRuntimeConfig('error'), false);
  assert.equal(shouldWriteRuntimeConfig('skipped'), false);
});
