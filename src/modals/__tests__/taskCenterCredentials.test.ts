import test from 'node:test';
import assert from 'node:assert/strict';

import {
  asmePushReceipt,
  buildL1BotSavePayload,
  decideRingCentralAdoptFromSheet,
  mergeAsmePayloadIntoSheetConfig,
} from '../taskCenterCredentials.js';

test('adopts RingCentral sender only when memory-service JWT is empty', () => {
  const decision = decideRingCentralAdoptFromSheet({
    runtime: { ringCentralJwtConfigured: false, ringCentralClientId: '' },
    scheduledMessagesConfig: {
      ringCentralSender: {
        enabled: true,
        clientId: 'client',
        clientSecret: 'secret',
        jwt: 'jwt',
      },
    },
    ringCentralServerUrl: 'https://platform.ringcentral.com',
  });
  assert.equal(decision.adopt, true);
  if (decision.adopt) {
    assert.equal(decision.payload.ringCentralClientId, 'client');
    assert.equal(decision.payload.ringCentralJwt, 'jwt');
  }
});

test('does not adopt when runtime already has RingCentral JWT', () => {
  const decision = decideRingCentralAdoptFromSheet({
    runtime: { ringCentralJwtConfigured: true, ringCentralClientId: 'x' },
    scheduledMessagesConfig: {
      ringCentralSender: {
        enabled: true,
        clientId: 'client',
        clientSecret: 'secret',
        jwt: 'jwt',
      },
    },
  });
  assert.equal(decision.adopt, false);
  if (!decision.adopt) assert.equal(decision.reason, 'already_configured');
});

test('buildL1BotSavePayload omits empty token so configured token is kept', () => {
  const payload = buildL1BotSavePayload({
    botApiBaseUrl: 'https://botman.int.rclabenv.com/v2',
    botId: 'bot@glip.net',
    botToken: '',
    botTokenConfigured: true,
  });
  assert.equal(payload.botId, 'bot@glip.net');
  assert.equal(payload.botToken, undefined);
});

test('mergeAsmePayloadIntoSheetConfig copies runtime AsMe onto an existing Sheet', () => {
  const merged = mergeAsmePayloadIntoSheetConfig(
    {
      sheetId: 'sheet-1',
      ringCentralSender: { enabled: true, clientId: 'old', clientSecret: 'old-secret', jwt: 'old-jwt' },
    },
    { ringCentralClientId: 'new', ringCentralClientSecret: 'new-secret', ringCentralJwt: 'new-jwt' },
  );
  assert.equal(merged.kind, 'ready');
  if (merged.kind === 'ready') {
    assert.equal(merged.config.ringCentralSender?.clientId, 'new');
    assert.equal(merged.config.ringCentralSender?.jwt, 'new-jwt');
    assert.equal(merged.config.ringCentralSender?.enabled, true);
  }
});

test('mergeAsmePayloadIntoSheetConfig keeps existing secrets when the save left them blank', () => {
  const merged = mergeAsmePayloadIntoSheetConfig(
    {
      sheetId: 'sheet-1',
      ringCentralSender: { enabled: true, clientId: 'old', clientSecret: 'keep-secret', jwt: 'keep-jwt' },
    },
    { ringCentralClientId: 'new' },
  );
  assert.equal(merged.kind, 'ready');
  if (merged.kind === 'ready') {
    assert.equal(merged.config.ringCentralSender?.clientSecret, 'keep-secret');
    assert.equal(merged.config.ringCentralSender?.jwt, 'keep-jwt');
  }
});

test('asmePushReceipt tells the user Jira rules stay on the baked snapshot', () => {
  assert.match(
    asmePushReceipt({ pushed: true, reason: 'ok' }),
    /Jira 规则快照/,
  );
});
