import test from 'node:test';
import assert from 'node:assert/strict';

import {
  runPersistentlyThrottledTask,
  type PersistentTaskThrottleStorage,
} from '../PersistentTaskThrottle.js';

function createStorage(): PersistentTaskThrottleStorage {
  const values: Record<string, unknown> = {};
  return {
    async get(key) {
      return { [key]: values[key] };
    },
    async set(items) {
      Object.assign(values, items);
    },
  };
}

test('successful bootstrap work is skipped across worker lifetimes until due', async () => {
  const storage = createStorage();
  let now = 1_000;
  let calls = 0;
  const run = () =>
    runPersistentlyThrottledTask({
      storage,
      taskId: 'identity-test',
      successIntervalMs: 300,
      now: () => now,
      task: async () => ++calls,
    });

  assert.equal((await run()).ran, true);
  now = 1_100;
  assert.equal((await run()).ran, false);
  now = 1_301;
  assert.equal((await run()).ran, true);
  assert.equal(calls, 2);
});

test('concurrent startup work shares one in-flight promise', async () => {
  const storage = createStorage();
  let release: (() => void) | undefined;
  let calls = 0;
  const task = async () => {
    calls += 1;
    await new Promise<void>((resolve) => {
      release = resolve;
    });
    return 'done';
  };
  const options = {
    storage,
    taskId: 'join-test',
    successIntervalMs: 300,
    now: () => 1_000,
    task,
  };
  const first = runPersistentlyThrottledTask(options);
  const second = runPersistentlyThrottledTask(options);
  await new Promise((resolve) => setTimeout(resolve, 0));
  release?.();

  assert.equal((await first).value, 'done');
  assert.equal((await second).joined, true);
  assert.equal(calls, 1);
});
