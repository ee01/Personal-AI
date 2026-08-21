import assert from 'node:assert/strict';
import test from 'node:test';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';

import {
  isTrustedWorkerPairOrigin,
  WorkerSupervisor,
} from '../workerSupervisor.js';

test('trusted pair origin allows extension and loopback', () => {
  assert.equal(
    isTrustedWorkerPairOrigin('chrome-extension://abc', undefined, '10.0.0.1'),
    true,
  );
  assert.equal(
    isTrustedWorkerPairOrigin(undefined, 'hkmimegiefnbeadjoonnlogikcdddcho', '10.0.0.1'),
    true,
  );
  assert.equal(isTrustedWorkerPairOrigin(undefined, undefined, '127.0.0.1'), true);
  assert.equal(isTrustedWorkerPairOrigin(undefined, undefined, '8.8.8.8'), false);
});

test('supervisor persists pairing and reports status', async () => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'worker-sup-'));
  const entry = path.join(dataDir, 'fake-worker.mjs');
  await fs.writeFile(
    entry,
    'setInterval(() => {}, 60_000);\n',
    'utf8',
  );
  const supervisor = new WorkerSupervisor({ dataDir, workerEntry: entry });
  await supervisor.pair({
    pairingToken: 'wpt.test.token',
    serverUrl: 'http://127.0.0.1:3210',
  });
  const status = supervisor.getStatus();
  assert.equal(status.paired, true);
  assert.ok(['online', 'starting'].includes(status.state));
  await supervisor.stop();
  await fs.rm(dataDir, { recursive: true, force: true });
});

test('supervisor defers process ownership when Electron main owns the worker', async () => {
  const previous = process.env.PERSONAL_AI_MAIN_OWNS_WORKER;
  process.env.PERSONAL_AI_MAIN_OWNS_WORKER = '1';
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'worker-sup-main-'));
  const entry = path.join(dataDir, 'fake-worker.mjs');
  await fs.writeFile(entry, 'setInterval(() => {}, 60_000);\n', 'utf8');
  const supervisor = new WorkerSupervisor({ dataDir, workerEntry: entry });
  await supervisor.pair({
    pairingToken: 'wpt.test.token',
    serverUrl: 'http://127.0.0.1:3210',
  });
  const status = supervisor.getStatus();
  assert.equal(status.paired, true);
  assert.equal(status.state, 'offline');
  assert.equal(status.pid, undefined);
  const flag = await fs.readFile(path.join(dataDir, 'restart.flag'), 'utf8');
  assert.ok(flag.length > 0);
  await supervisor.stop();
  await fs.rm(dataDir, { recursive: true, force: true });
  if (previous === undefined) delete process.env.PERSONAL_AI_MAIN_OWNS_WORKER;
  else process.env.PERSONAL_AI_MAIN_OWNS_WORKER = previous;
});
