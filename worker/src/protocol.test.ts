import assert from 'node:assert/strict';
import test from 'node:test';

import { WORKER_PROTOCOL_VERSION } from './protocol.js';

test('worker protocol version is 1', () => {
  assert.equal(WORKER_PROTOCOL_VERSION, 1);
});
