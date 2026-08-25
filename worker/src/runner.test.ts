import assert from 'node:assert/strict';
import test from 'node:test';

import { createFakeAcpChild } from './acpClient.js';
import { runClaimedTask } from './runner.js';

test('runClaimedTask drives initialize, session/new, and prompt', async () => {
  const methods: string[] = [];
  const envelope = await runClaimedTask(
    {
      actionId: 'act-1',
      fenceToken: 1,
      leaseUntil: Date.now() + 60_000,
      executor: { type: 'acp-codex', cwd: '/tmp' },
      request: { task: 'list files', mode: 'read', actionId: 'act-1' },
      memory: { mcpUrl: 'http://127.0.0.1:3210/mcp', userId: 'esone.qiu' },
    },
    {
      mcpBearer: 'awk.test',
      spawnFn: () =>
        createFakeAcpChild({
          onRequest(method, params, respond) {
            methods.push(method);
            if (method === 'initialize') {
              respond({ protocolVersion: 1 });
              return;
            }
            if (method === 'session/new') {
              const servers = params.mcpServers as Array<{ type?: string }>;
              assert.equal(servers[0]?.type, 'streamable-http');
              respond({ sessionId: 'sess-1' });
              return;
            }
            if (method === 'session/prompt') {
              respond({
                text: JSON.stringify({
                  status: 'success',
                  summary: 'listed',
                  artifacts: [
                    {
                      kind: 'note',
                      content: 'ok',
                      metadata: {
                        sourceSystem: 'fs',
                        entityId: '/tmp',
                        verification: 'read',
                        observedFields: ['path'],
                      },
                    },
                  ],
                }),
              });
            }
          },
        }),
    },
  );
  assert.deepEqual(methods, ['initialize', 'session/new', 'session/prompt']);
  assert.equal(envelope.status, 'succeeded');
  assert.equal(envelope.summary, 'listed');
  assert.equal(envelope.remoteRunId, 'sess-1');
});

test('runClaimedTask maps acp-cursor to the cursor-acp shim command', async () => {
  const commands: string[] = [];
  await runClaimedTask(
    {
      actionId: 'act-cursor',
      fenceToken: 1,
      leaseUntil: Date.now() + 60_000,
      executor: { type: 'acp-cursor', cwd: '/tmp' },
      request: { task: 'inspect', mode: 'read', actionId: 'act-cursor' },
      memory: { mcpUrl: 'http://127.0.0.1:3210/mcp', userId: 'esone.qiu' },
    },
    {
      mcpBearer: 'awk.test',
      spawnFn: (command) => {
        commands.push(command);
        return createFakeAcpChild({
          onRequest(method, _params, respond) {
            if (method === 'initialize') {
              respond({ protocolVersion: 1 });
              return;
            }
            if (method === 'session/new') {
              respond({ sessionId: 'sess-cursor' });
              return;
            }
            if (method === 'session/prompt') {
              respond({
                text: JSON.stringify({
                  status: 'success',
                  summary: 'ok',
                  artifacts: [],
                }),
              });
            }
          },
        });
      },
    },
  );
  assert.equal(commands[0], process.execPath);
});
