import { describe, expect, it } from 'vitest';

import {
  AcpStdioClient,
  createFakeAcpChild,
} from '../integrations/acp/AcpStdioClient.js';
import { AcpExecutor } from '../integrations/executors/AcpExecutor.js';

describe('AcpStdioClient', () => {
  it('initialize + session/new + prompt over fake stdio', async () => {
    const client = new AcpStdioClient({
      command: 'fake-acp',
      requestTimeoutMs: 5000,
      spawnFn: () =>
        createFakeAcpChild({
          onRequest: (method, _params, respond, notify) => {
            if (method === 'initialize') {
              respond({ protocolVersion: 1, agentCapabilities: {} });
              return;
            }
            if (method === 'session/new') {
              respond({ sessionId: 'sess-1' });
              return;
            }
            if (method === 'session/prompt') {
              notify('session/update', {
                sessionId: 'sess-1',
                update: {
                  sessionUpdate: 'agent_message_chunk',
                  content: { type: 'text', text: '{"status":"success","summary":"ok","artifacts":[{"kind":"note","content":"file read","metadata":{"sourceSystem":"git","entityId":"HEAD","verification":"read","observedFields":["commit"]}}]}' },
                },
              });
              respond({ stopReason: 'end_turn' });
            }
          },
        }),
    });

    await client.start();
    await client.initialize();
    const session = await client.newSession({ cwd: '/tmp' });
    expect(session.sessionId).toBe('sess-1');
    await client.prompt({
      sessionId: 'sess-1',
      prompt: [{ type: 'text', text: 'hi' }],
    });
    expect(client.updates.length).toBe(1);
    client.close();
  });
});

describe('AcpExecutor', () => {
  it('returns a verifiable success envelope from mocked ACP', async () => {
    const executor = new AcpExecutor(
      {
        id: 'codex-local',
        label: 'Codex',
        type: 'acp-codex',
        cwd: '/tmp/repo',
        enabled: true,
      },
      {
        userId: 'esone.qiu',
        spawnFn: () =>
          createFakeAcpChild({
            onRequest: (method, _params, respond, notify) => {
              if (method === 'initialize') {
                respond({ protocolVersion: 1 });
                return;
              }
              if (method === 'session/new') {
                respond({ sessionId: 'sess-42' });
                return;
              }
              if (method === 'session/prompt') {
                notify('session/update', {
                  update: {
                    sessionUpdate: 'agent_message_chunk',
                    content: {
                      type: 'text',
                      text: JSON.stringify({
                        status: 'success',
                        summary: 'found commit',
                        artifacts: [
                          {
                            kind: 'note',
                            content: 'HEAD is abc',
                            metadata: {
                              sourceSystem: 'git',
                              entityId: 'HEAD',
                              verification: 'read',
                              observedFields: ['commit'],
                            },
                          },
                        ],
                      }),
                    },
                  },
                });
                respond({ stopReason: 'end_turn' });
              }
            },
          }),
      },
    );

    const result = await executor.submit({
      task: 'what is HEAD?',
      mode: 'read',
      threadId: 't1',
      actionId: 'a1',
      sessionKey: 's1',
    });

    expect(result.status).toBe('succeeded');
    expect(result.remoteRunId).toBe('sess-42');
    expect(result.artifacts).toHaveLength(1);
  });
});
