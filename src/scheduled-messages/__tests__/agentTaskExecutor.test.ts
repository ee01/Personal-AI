import test from 'node:test';
import assert from 'node:assert/strict';

import {
  agentTaskExecutorMissingReason,
  listAgentExecutorOptions,
  resolveAgentTaskExecutorSelection,
} from '../agentTaskExecutor.js';

test('listAgentExecutorOptions keeps listed instance ids and labels', () => {
  assert.deepEqual(
    listAgentExecutorOptions({
      agentExecutors: [
        { id: 'openclaw', label: 'OpenClaw', enabled: true },
        { id: 'exec_t4com0', label: 'Mac mini openclaw', enabled: true },
      ],
    }),
    [
      { id: 'openclaw', label: 'OpenClaw' },
      { id: 'exec_t4com0', label: 'Mac mini openclaw' },
    ],
  );
});

test('resolveAgentTaskExecutorSelection prefers saved id, then Options default', () => {
  const executors = [
    { id: 'openclaw', label: 'OpenClaw' },
    { id: 'exec_t4com0', label: 'Mac mini openclaw' },
  ];
  assert.equal(
    resolveAgentTaskExecutorSelection({
      savedId: '',
      defaultId: 'exec_t4com0',
      executors,
    }),
    'exec_t4com0',
  );
  assert.equal(
    resolveAgentTaskExecutorSelection({
      savedId: 'openclaw',
      defaultId: 'exec_t4com0',
      executors,
    }),
    'openclaw',
  );
  assert.equal(
    resolveAgentTaskExecutorSelection({
      savedId: 'gone',
      defaultId: 'exec_t4com0',
      executors,
    }),
    'exec_t4com0',
  );
});

test('agentTaskExecutorMissingReason waits for load then requires a listed executor', () => {
  assert.match(agentTaskExecutorMissingReason([], false), /正在检查/);
  assert.match(agentTaskExecutorMissingReason([], true), /尚未配置/);
  assert.equal(
    agentTaskExecutorMissingReason([{ id: 'openclaw', label: 'OpenClaw' }], true),
    '',
  );
});
