import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildL1BotSavePayload,
  decideRingCentralAdoptFromSheet,
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
