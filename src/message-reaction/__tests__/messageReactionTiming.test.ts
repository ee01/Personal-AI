import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MESSAGE_REACTION_SETTINGS_DELAY_MS,
  MESSAGE_REACTION_SHOW_DELAY_MS,
} from '../messageReactionTiming.js';

test('message reaction toolbar appears after a short hover intent delay', () => {
  assert.equal(MESSAGE_REACTION_SHOW_DELAY_MS, 800);
  assert.ok(MESSAGE_REACTION_SHOW_DELAY_MS < 1000);
});

test('settings affordance remains a deliberate long-hover action', () => {
  assert.ok(MESSAGE_REACTION_SETTINGS_DELAY_MS > MESSAGE_REACTION_SHOW_DELAY_MS);
});
