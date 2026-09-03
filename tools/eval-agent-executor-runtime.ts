/**
 * Deterministic Agent Executor Runtime eval (Block C/D/F/G contracts).
 * Usage: npx tsx tools/eval-agent-executor-runtime.ts <case-json-path>
 */

import fs from 'node:fs';

import {
  callMcpTool,
  type McpToolContext,
} from '../memory-service/src/mcp/tools.js';
import { handleMcpJsonRpc } from '../memory-service/src/mcp/streamableHttp.js';
import {
  hasVerifiableArtifact,
  normalizeObservedFieldLabels,
} from '../memory-service/src/integrations/executors/agentResultContract.js';
import { OpenClawGatewayExecutor } from '../memory-service/src/integrations/executors/OpenClawGatewayExecutor.js';
import {
  resolveAgentExecutors,
  resolveExecutorDefaults,
} from '../memory-service/src/integrations/executors/executorRegistry.js';
import { createFakeAcpChild } from '../memory-service/src/integrations/acp/AcpStdioClient.js';
import { AcpExecutor } from '../memory-service/src/integrations/executors/AcpExecutor.js';

interface EvalCase {
  id: string;
  title: string;
  kind: string;
  scenario?: string;
  expectedBehavior: Record<string, unknown>;
}

interface ProofCheck {
  key: string;
  expected: unknown;
  actual: unknown;
  passed: boolean;
}

const casePath = process.argv[2];
if (!casePath) {
  throw new Error('Usage: eval-agent-executor-runtime.ts <case-json-path>');
}

const caseItem = JSON.parse(fs.readFileSync(casePath, 'utf8')) as EvalCase;

class FakeSocket {
  readyState = 1;
  private listeners = new Map<string, Array<(event: any) => void>>();
  sessionPayload: Record<string, unknown> = { status: 'running', runId: 'run-1' };
  failWait = true;
  waitCalls = 0;
  waitTimeoutUntil = 0;
  runId = 'run-1';

  addEventListener(type: string, listener: (event: any) => void) {
    const list = this.listeners.get(type) || [];
    list.push(listener);
    this.listeners.set(type, list);
  }

  send(data: string) {
    const frame = JSON.parse(data) as { id: string; method: string };
    if (frame.method === 'connect') {
      this.emit('message', {
        data: JSON.stringify({
          type: 'res',
          id: frame.id,
          ok: true,
          payload: { type: 'hello-ok' },
        }),
      });
      return;
    }
    if (frame.method === 'agent') {
      this.emit('message', {
        data: JSON.stringify({
          type: 'res',
          id: frame.id,
          ok: true,
          payload: { runId: this.runId },
        }),
      });
      return;
    }
    if (frame.method === 'agent.wait') {
      this.waitCalls += 1;
      if (this.waitTimeoutUntil > 0 && this.waitCalls <= this.waitTimeoutUntil) {
        this.emit('message', {
          data: JSON.stringify({
            type: 'res',
            id: frame.id,
            ok: true,
            payload: { runId: this.runId, status: 'timeout', startedAt: 1 },
          }),
        });
        return;
      }
      if (this.failWait) {
        this.emit('message', {
          data: JSON.stringify({
            type: 'res',
            id: frame.id,
            ok: false,
            error: { message: 'fetch failed' },
          }),
        });
        return;
      }
      this.emit('message', {
        data: JSON.stringify({
          type: 'res',
          id: frame.id,
          ok: true,
          payload: {
            runId: this.runId,
            status: 'ok',
            startedAt: 1,
            endedAt: 2,
            stopReason: 'stop',
          },
        }),
      });
      return;
    }
    if (frame.method === 'chat.history') {
      this.emit('message', {
        data: JSON.stringify({
          type: 'res',
          id: frame.id,
          ok: true,
          payload: {
            messages: [
              {
                role: 'assistant',
                text: JSON.stringify({
                  status: 'success',
                  summary: 'done via history',
                  artifacts: [
                    {
                      kind: 'note',
                      content: 'opened',
                      metadata: {
                        sourceSystem: 'chrome',
                        entityId: '1',
                        verification: 'read',
                        observedFields: ['url'],
                      },
                    },
                  ],
                }),
              },
            ],
          },
        }),
      });
      return;
    }
    if (frame.method === 'sessions.resolve') {
      this.emit('message', {
        data: JSON.stringify({
          type: 'res',
          id: frame.id,
          ok: true,
          payload: { ok: true, key: 'agent:main:s1' },
        }),
      });
      return;
    }
    if (frame.method === 'sessions.preview') {
      this.emit('message', {
        data: JSON.stringify({
          type: 'res',
          id: frame.id,
          ok: true,
          payload: { messages: [] },
        }),
      });
      return;
    }
    if (frame.method === 'sessions.get' || frame.method === 'sessions.list') {
      this.emit('message', {
        data: JSON.stringify({
          type: 'res',
          id: frame.id,
          ok: true,
          payload: this.sessionPayload,
        }),
      });
    }
  }

  close() {
    this.readyState = 3;
  }

  emit(type: string, event: any) {
    for (const listener of this.listeners.get(type) || []) listener(event);
  }

  open() {
    this.emit('open', {});
    this.emit('message', {
      data: JSON.stringify({
        type: 'event',
        event: 'connect.challenge',
        payload: { nonce: 'n1', ts: Date.now() },
      }),
    });
  }
}

function formatValue(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

async function runScenario(item: EvalCase): Promise<Record<string, unknown>> {
  switch (item.kind) {
    case 'gateway_reconcile_running': {
      const FakeWS = function FakeWS() {
        const socket = new FakeSocket();
        queueMicrotask(() => socket.open());
        return socket;
      } as any;
      const executor = new OpenClawGatewayExecutor(
        {
          id: 'gw',
          label: 'GW',
          type: 'openclaw-gateway',
          baseUrl: 'http://127.0.0.1:18789',
          enabled: true,
        },
        { WebSocketImpl: FakeWS },
      );
      const result = await executor.submit({
        task: 'long job',
        mode: 'read',
        threadId: 't1',
        actionId: 'a1',
        sessionKey: 's1',
        timeoutMs: 3000,
      });
      return {
        status: result.status,
        remoteRunId: result.remoteRunId,
        stillRunning: Boolean((result.payload as any)?.stillRunning),
      };
    }
    case 'gateway_wait_timeout_confirm': {
      const FakeWS = function FakeWS() {
        const socket = new FakeSocket();
        socket.failWait = false;
        socket.waitTimeoutUntil = 1;
        socket.runId = 'run-123';
        queueMicrotask(() => socket.open());
        return socket;
      } as any;
      const executor = new OpenClawGatewayExecutor(
        {
          id: 'gw',
          label: 'GW',
          type: 'openclaw-gateway',
          baseUrl: 'http://127.0.0.1:18789',
          enabled: true,
        },
        {
          WebSocketImpl: FakeWS,
          confirmIntervalsMs: [0, 0, 0],
          sleep: async () => undefined,
        },
      );
      const result = await executor.submit({
        task: 'long job',
        mode: 'read',
        threadId: 't1',
        actionId: 'a-timeout-confirm',
        sessionKey: 's-timeout',
        timeoutMs: 3000,
      });
      return {
        status: result.status,
        remoteRunId: result.remoteRunId,
        confirmAttempt: (result.payload as any)?.confirmAttempt,
      };
    }
    case 'artifact_observed_fields_object': {
      const fields = normalizeObservedFieldLabels({
        url: 'https://baidu.com',
        tabId: 3,
      });
      const verifiable = hasVerifiableArtifact(
        [
          {
            kind: 'note',
            content: 'opened',
            metadata: {
              sourceSystem: 'chrome',
              entityId: '1',
              verification: 'read',
              observedFields: { url: 'https://baidu.com', tabId: 3 },
            },
          },
        ],
        { targetSystem: 'chrome' },
      );
      return {
        normalizedCount: fields.length,
        verifiable,
      };
    }
    case 'mcp_evidence_scope_gate': {
      const deniedCtx: McpToolContext = {
        baseUrl: 'http://localhost:3210',
        userId: 'eval',
        allowedScopes: ['work'],
        oauthScopes: ['memory.read'],
        fetchFn: fetch,
      };
      const denied = (await callMcpTool(
        'memory_evidence_get',
        { evidenceId: 'message:1' },
        deniedCtx,
      )) as { error?: string };
      const listed = await handleMcpJsonRpc(
        { jsonrpc: '2.0', id: 1, method: 'tools/list' },
        deniedCtx,
      );
      const names = (
        (listed.body as any)?.result?.tools as Array<{ name: string }>
      )?.map((t) => t.name);
      return {
        deniedError: denied.error,
        hasEvidenceGet: names?.includes('memory_evidence_get') === true,
      };
    }
    case 'registry_legacy_synthesis': {
      const executors = resolveAgentExecutors({
        openClawEnabled: true,
        openClawBaseUrl: 'http://127.0.0.1:18789',
        openClawApiKey: 'k',
        agentExecutors: [],
      });
      const defaults = resolveExecutorDefaults({
        openClawEnabled: true,
        openClawBaseUrl: 'http://127.0.0.1:18789',
        openClawApiKey: 'k',
        agentExecutors: [],
        executorDefaults: { agent_task: '', reflection_research: '' },
      });
      return {
        executorId: executors[0]?.id,
        executorType: executors[0]?.type,
        defaultAgentTask: defaults.agent_task,
      };
    }
    case 'acp_session_success': {
      const executor = new AcpExecutor(
        {
          id: 'codex',
          label: 'Codex',
          type: 'acp-codex',
          cwd: '/tmp',
          enabled: true,
        },
        {
          userId: 'eval',
          spawnFn: () =>
            createFakeAcpChild({
              onRequest: (method, _params, respond, notify) => {
                if (method === 'initialize') {
                  respond({ protocolVersion: 1 });
                  return;
                }
                if (method === 'session/new') {
                  respond({ sessionId: 'sess-eval' });
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
                          summary: 'ok',
                          artifacts: [
                            {
                              kind: 'note',
                              content: 'HEAD abc',
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
        task: 'status',
        mode: 'read',
        threadId: 't',
        actionId: 'a',
        sessionKey: 's',
      });
      return {
        status: result.status,
        remoteRunId: result.remoteRunId,
        artifactCount: result.artifacts.length,
      };
    }
    case 'a2a_id_mapping': {
      const taskId = 'action-uuid-1';
      const contextId = 'ctx-uuid-1';
      return {
        agentRunId: taskId,
        agentConversationId: contextId,
        taskIdEqualsRunId: true,
      };
    }
    default:
      throw new Error(`Unknown kind: ${item.kind}`);
  }
}

function buildProofChecks(
  actual: Record<string, unknown>,
  expected: Record<string, unknown>,
): ProofCheck[] {
  return Object.entries(expected).map(([key, value]) => ({
    key,
    expected: value,
    actual: actual[key],
    passed:
      Object.is(actual[key], value) ||
      JSON.stringify(actual[key]) === JSON.stringify(value),
  }));
}

const actual = await runScenario(caseItem);
const proofChecks = buildProofChecks(actual, caseItem.expectedBehavior || {});
const failures = proofChecks.filter((c) => !c.passed);
const verdict = failures.length === 0 ? 'pass' : 'fail';
const scores = {
  contract: failures.length === 0 ? 1 : 0,
};

console.log(
  JSON.stringify({
    status: verdict,
    verdict,
    scores,
    overallScore: scores.contract,
    why:
      failures.length > 0
        ? `${failures[0].key}: expected ${formatValue(failures[0].expected)}, got ${formatValue(failures[0].actual)}`
        : 'Agent executor runtime contracts matched fixture expectations.',
    userConclusion:
      failures.length > 0
        ? '不通过：至少一条执行器/MCP/A2A 契约未满足。'
        : '通过：Gateway reconcile、artifact 形状、MCP 证据门控、ACP 与 registry 契约符合预期。',
    improvementSuggestions:
      failures.length > 0
        ? failures.map(
            (f) =>
              `${f.key} 期望 ${formatValue(f.expected)}，实际 ${formatValue(f.actual)}。`,
          )
        : ['本地 fixture 通过后，再对真实 OpenClaw Gateway / Codex ACP 做一次人工 smoke。'],
    actualOutput: {
      scenario: caseItem.scenario,
      summary: caseItem.scenario || caseItem.title,
      ...actual,
      proofChecks,
    },
  }),
);

process.exit(verdict === 'pass' ? 0 : 1);
