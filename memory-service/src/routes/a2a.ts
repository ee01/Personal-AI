/**
 * A2A (Agent-to-Agent) surface — Agent Card + JSON-RPC task API (Block G).
 *
 * Mapping:
 *   A2A taskId      ↔ proposed_actions.id (agent run / action id)
 *   A2A contextId   ↔ params.metadata.a2aContextId (conversation thread)
 *
 * TaskStore is the existing action queue ledger (Block A).
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { randomUUID } from 'node:crypto';

import { ActionExecutor } from '../core/actions/ActionExecutor.js';
import {
  findEnabledExecutor,
  resolveExecutorDefaults,
} from '../integrations/executors/executorRegistry.js';
import { ActionRepository } from '../repositories/ActionRepository.js';
import { getUserRuntimeConfig } from '../runtimeConfig.js';
import { getConfig } from '../config.js';
import { resolveUserIdHeader } from '../utils/userIdentity.js';
import { now } from '../utils/time.js';

type JsonRpcId = string | number | null;

interface JsonRpcRequest {
  jsonrpc?: '2.0';
  id?: JsonRpcId;
  method?: string;
  params?: Record<string, unknown>;
}

function nonEmpty(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function extractTextFromMessage(message: unknown): string {
  if (!message || typeof message !== 'object') return '';
  const msg = message as Record<string, unknown>;
  if (typeof msg.text === 'string') return msg.text.trim();
  const parts = Array.isArray(msg.parts) ? msg.parts : [];
  const texts: string[] = [];
  for (const part of parts) {
    if (!part || typeof part !== 'object') continue;
    const p = part as Record<string, unknown>;
    if (typeof p.text === 'string') texts.push(p.text);
    if (p.type === 'text' && typeof p.text === 'string') texts.push(p.text);
  }
  return texts.join('\n').trim();
}

function mapQueueToA2AState(queueStatus: string): string {
  switch (queueStatus) {
    case 'queued':
      return 'submitted';
    case 'running':
    case 'input_required':
      return 'working';
    case 'succeeded':
      return 'completed';
    case 'cancelled':
      return 'canceled';
    case 'failed':
    case 'dead_letter':
      return 'failed';
    default:
      return 'unknown';
  }
}

function actionToA2ATask(action: {
  id: string;
  queueStatus: string;
  title: string;
  description?: string;
  result?: Record<string, unknown>;
  lastError?: string;
  params: Record<string, unknown>;
  runId?: string;
  threadId?: string;
}) {
  const metadata =
    action.params.metadata && typeof action.params.metadata === 'object'
      ? (action.params.metadata as Record<string, unknown>)
      : {};
  const contextId =
    nonEmpty(metadata.a2aContextId) ||
    action.threadId ||
    nonEmpty(metadata.conversationId) ||
    action.id;
  const summary =
    typeof action.result?.summary === 'string'
      ? action.result.summary
      : action.lastError || action.description || action.title;
  const state = mapQueueToA2AState(action.queueStatus);
  const artifacts = Array.isArray(action.result?.artifacts)
    ? (action.result!.artifacts as unknown[])
    : [];

  return {
    id: action.id,
    contextId,
    status: {
      state,
      timestamp: new Date().toISOString(),
      message: {
        role: 'agent',
        parts: [{ type: 'text', text: summary }],
      },
    },
    artifacts: artifacts.map((item, index) => ({
      artifactId: `artifact-${index}`,
      parts: [
        {
          type: 'text',
          text:
            item && typeof item === 'object'
              ? JSON.stringify(item)
              : String(item ?? ''),
        },
      ],
    })),
    metadata: {
      queueStatus: action.queueStatus,
      runId: action.runId || action.id,
      agentRunId: action.id,
      agentConversationId: contextId,
      result: action.result,
    },
    history: [
      {
        role: 'user',
        parts: [
          {
            type: 'text',
            text:
              typeof action.params.task === 'string'
                ? action.params.task
                : action.description || action.title,
          },
        ],
      },
    ],
  };
}

function buildAgentCard(baseUrl: string) {
  return {
    name: 'Personal AI Memory Agent',
    description:
      'Private personal memory agent: recall, ask, and run delegated agent tasks against the user memory ledger and configured executors (OpenClaw / Codex ACP).',
    version: '1.0.0',
    protocolVersion: '0.3',
    url: `${baseUrl}/a2a`,
    preferredTransport: 'JSONRPC',
    supportedInterfaces: [
      {
        url: `${baseUrl}/a2a`,
        protocolBinding: 'JSONRPC',
        protocolVersion: '0.3',
      },
    ],
    capabilities: {
      streaming: false,
      pushNotifications: false,
      extendedAgentCard: false,
    },
    defaultInputModes: ['text/plain', 'application/json'],
    defaultOutputModes: ['application/json', 'text/plain'],
    skills: [
      {
        id: 'memory-recall',
        name: 'Memory recall',
        description:
          'Search and answer from the user personal memory with evidence receipts.',
        tags: ['memory', 'recall', 'evidence'],
        examples: ['What did I decide about Nova last week?'],
      },
      {
        id: 'agent-task',
        name: 'Delegated agent task',
        description:
          'Enqueue a delegate_agent action on the Personal AI run ledger and execute via configured executor.',
        tags: ['agent', 'task', 'openclaw', 'codex'],
        examples: ['Open Baidu and report the URL with a verifiable artifact'],
      },
    ],
    securitySchemes: {
      bearer: {
        type: 'http',
        scheme: 'bearer',
      },
    },
    security: [{ bearer: [] }],
  };
}

function resolveBaseUrl(request: FastifyRequest): string {
  const configured =
    process.env.MEMORY_SERVICE_PUBLIC_URL || process.env.MEMORY_SERVICE_URL;
  if (configured) return configured.replace(/\/$/, '');
  const host = request.headers.host || `127.0.0.1:${getConfig().port}`;
  const proto =
    (request.headers['x-forwarded-proto'] as string | undefined)?.split(',')[0] ||
    'http';
  return `${proto}://${host}`;
}

function expectedBearer(): string {
  return (
    process.env.A2A_BEARER_TOKEN ||
    process.env.MCP_BEARER_TOKEN ||
    process.env.API_KEY ||
    getConfig().apiKey ||
    ''
  );
}

function checkBearer(request: FastifyRequest, reply: FastifyReply): boolean {
  const expected = expectedBearer();
  if (!expected) return true;
  const header = request.headers.authorization;
  if (typeof header !== 'string' || !header.toLowerCase().startsWith('bearer ')) {
    reply.code(401).send({ error: 'missing_bearer_token' });
    return false;
  }
  const token = header.slice(7).trim();
  if (token !== expected) {
    reply.code(401).send({ error: 'invalid_bearer_token' });
    return false;
  }
  return true;
}

function resolveUserId(request: FastifyRequest): string {
  const resolved = resolveUserIdHeader(request.headers['x-user-id']);
  if (resolved.userId) return resolved.userId;
  if (request.userId) return request.userId;
  return process.env.A2A_USER_ID || process.env.MCP_USER_ID || 'default';
}

async function sendMessage(
  request: FastifyRequest,
  params: Record<string, unknown>,
) {
  const userId = resolveUserId(request);
  const { db, userDataManager } = request.userContext;
  const runtimeConfig = getUserRuntimeConfig(userDataManager);
  const defaults = resolveExecutorDefaults(runtimeConfig);
  const executorId =
    nonEmpty(params.executor) ||
    nonEmpty((params.metadata as any)?.executor) ||
    defaults.agent_task;
  const executorInstance = findEnabledExecutor(runtimeConfig, executorId);
  if (!executorInstance) {
    throw Object.assign(new Error('no enabled agent executor configured'), {
      code: -32001,
    });
  }

  const message = params.message ?? params;
  const text = extractTextFromMessage(message);
  if (!text) {
    throw Object.assign(new Error('message text is required'), { code: -32602 });
  }

  const contextId =
    nonEmpty(params.contextId) ||
    nonEmpty(params.conversationId) ||
    nonEmpty((params.metadata as any)?.contextId) ||
    randomUUID();
  const requestedTaskId = nonEmpty(params.id) || nonEmpty(params.taskId);
  const idempotencyKey =
    nonEmpty(params.idempotencyKey) ||
    `a2a:${contextId}:${requestedTaskId || text.slice(0, 80)}`;

  const repo = new ActionRepository(db);
  const existing = repo.findReusableByIdempotencyKey(idempotencyKey);
  const action =
    existing ??
    repo.create({
      actionType: 'delegate_agent',
      title: text.slice(0, 120),
      description: text,
      params: {
        task: text,
        mode: 'read',
        targetSystem: 'a2a',
        executor: executorInstance.id,
        metadata: {
          a2aContextId: contextId,
          agentConversationId: contextId,
          triggerSource: 'a2a',
          executorId: executorInstance.id,
          executorType: executorInstance.type,
        },
      },
      riskLevel: 'medium',
      confidence: 0.8,
      requiresApproval: false,
      executionMode: 'auto',
      priority: 7,
      idempotencyKey,
      sourceKind: 'a2a',
      sourceRefId: contextId,
      queueStatus: 'queued',
      scheduledAt: now(),
      threadId: contextId,
    });

  if (
    !existing ||
    !['running', 'succeeded', 'failed', 'dead_letter', 'input_required'].includes(
      action.queueStatus,
    )
  ) {
    setImmediate(() => {
      void (async () => {
        try {
          const executorService = new ActionExecutor(db, userDataManager, userId);
          await executorService.executeAction(action.id);
        } catch {
          /* background; status visible via tasks/get */
        }
      })();
    });
  }

  const latest = repo.getById(action.id) ?? action;
  return actionToA2ATask(latest);
}

async function getTask(request: FastifyRequest, params: Record<string, unknown>) {
  const id = nonEmpty(params.id) || nonEmpty(params.taskId);
  if (!id) {
    throw Object.assign(new Error('task id is required'), { code: -32602 });
  }
  const { db } = request.userContext;
  const repo = new ActionRepository(db);
  const action = repo.getById(id);
  if (!action) {
    throw Object.assign(new Error(`task not found: ${id}`), { code: -32004 });
  }
  return actionToA2ATask(action);
}

async function cancelTask(
  request: FastifyRequest,
  params: Record<string, unknown>,
) {
  const id = nonEmpty(params.id) || nonEmpty(params.taskId);
  if (!id) {
    throw Object.assign(new Error('task id is required'), { code: -32602 });
  }
  const { db } = request.userContext;
  const repo = new ActionRepository(db);
  const action = repo.getById(id);
  if (!action) {
    throw Object.assign(new Error(`task not found: ${id}`), { code: -32004 });
  }
  if (['succeeded', 'failed', 'dead_letter', 'cancelled'].includes(action.queueStatus)) {
    return actionToA2ATask(action);
  }
  const updated = repo.cancel(id, 'Cancelled via A2A') ?? action;
  return actionToA2ATask(updated);
}

export async function a2aRoutes(app: FastifyInstance): Promise<void> {
  const serveCard = async (request: FastifyRequest, reply: FastifyReply) => {
    const card = buildAgentCard(resolveBaseUrl(request));
    return reply
      .header('Content-Type', 'application/a2a+json')
      .send(card);
  };

  app.get('/.well-known/agent-card.json', serveCard);
  app.get('/.well-known/agent.json', serveCard);

  app.post('/a2a', async (request, reply) => {
    if (!checkBearer(request, reply)) return;

    // Ensure user context exists even if auth middleware skipped somehow.
    if (!request.userContext) {
      const userId = resolveUserId(request);
      request.userId = userId;
      request.userContext = (app as any).userContextManager?.getContext(userId);
      if (!request.userContext) {
        return reply.code(500).send({ error: 'user_context_unavailable' });
      }
    }

    const body = request.body as JsonRpcRequest;
    const id = (body?.id ?? null) as JsonRpcId;
    const method = String(body?.method || '');
    const params =
      body?.params && typeof body.params === 'object'
        ? (body.params as Record<string, unknown>)
        : {};

    try {
      let result: unknown;
      if (
        method === 'message/send' ||
        method === 'tasks/send' ||
        method === 'SendMessage'
      ) {
        result = await sendMessage(request, params);
      } else if (method === 'tasks/get' || method === 'GetTask') {
        result = await getTask(request, params);
      } else if (method === 'tasks/cancel' || method === 'CancelTask') {
        result = await cancelTask(request, params);
      } else if (method === 'agent/getAuthenticatedExtendedCard') {
        result = buildAgentCard(resolveBaseUrl(request));
      } else {
        return reply.code(200).send({
          jsonrpc: '2.0',
          id,
          error: { code: -32601, message: `Method not found: ${method}` },
        });
      }
      return reply.code(200).send({ jsonrpc: '2.0', id, result });
    } catch (error: any) {
      return reply.code(200).send({
        jsonrpc: '2.0',
        id,
        error: {
          code: typeof error?.code === 'number' ? error.code : -32000,
          message: error instanceof Error ? error.message : String(error),
        },
      });
    }
  });
}
