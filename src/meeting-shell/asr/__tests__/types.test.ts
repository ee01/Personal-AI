import test from 'node:test';
import assert from 'node:assert/strict';
import { createASREventEmitter } from '../types';

test('emitter: listener receives emitted event', () => {
  const emitter = createASREventEmitter();
  const received: any[] = [];
  emitter.on('transcript', (e) => received.push(e));
  emitter.emit('transcript', {
    kind: 'final',
    text: 'hello',
    tier: 'cloud',
    ts: 1,
  });
  assert.equal(received.length, 1);
  assert.equal(received[0].text, 'hello');
});

test('emitter: unsubscribe stops receiving events', () => {
  const emitter = createASREventEmitter();
  const received: any[] = [];
  const unsub = emitter.on('transcript', (e) => received.push(e));
  unsub();
  emitter.emit('transcript', {
    kind: 'final',
    text: 'hello',
    tier: 'cloud',
    ts: 1,
  });
  assert.equal(received.length, 0);
});

test('emitter: transcript events do not trigger error listeners', () => {
  const emitter = createASREventEmitter();
  const errors: any[] = [];
  emitter.on('error', (e) => errors.push(e));
  emitter.emit('transcript', {
    kind: 'final',
    text: 'hello',
    tier: 'cloud',
    ts: 1,
  });
  assert.equal(errors.length, 0);
});

test('emitter: multiple listeners on same event all receive', () => {
  const emitter = createASREventEmitter();
  let count = 0;
  emitter.on('status', () => count++);
  emitter.on('status', () => count++);
  emitter.emit('status', { tier: 'cloud', state: 'running', ts: 1 });
  assert.equal(count, 2);
});
