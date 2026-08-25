#!/usr/bin/env node
import { randomUUID } from 'node:crypto';
import { createInterface } from 'node:readline';

import { probeCursorAgent, runCursorAgent, type CursorRunMode } from './cursorAgent.js';
import { injectHttpMcpServers, restoreMcpFile } from './mcpMerge.js';
import { resolveCursorAgentBinary } from './resolveBinary.js';
import {
  loadSessionMap,
  saveSessionMap,
  type CursorSessionRecord,
} from './sessionStore.js';

type JsonRpc = {
  jsonrpc?: string;
  id?: string | number;
  method?: string;
  params?: Record<string, unknown>;
  result?: unknown;
  error?: { code: number; message: string };
};

type SessionState = CursorSessionRecord & {
  mcpServers: unknown[];
  warnings: string[];
  mcpInjected: boolean;
};

const sessions = new Map<string, SessionState>();
const binary = resolveCursorAgentBinary();
const mode: CursorRunMode =
  process.env.INITIAL_AGENT_MODE === 'agent' ||
  process.env.INITIAL_AGENT_MODE === 'write' ||
  process.env.INITIAL_AGENT_MODE === 'agent' ||
  process.env.INITIAL_AGENT_MODE === 'write'
    ? 'write'
    : 'read';

function write(payload: JsonRpc): void {
  process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', ...payload })}\n`);
}

function textFromPrompt(params: Record<string, unknown> | undefined): string {
  const prompt = params?.prompt;
  if (typeof prompt === 'string') return prompt;
  if (!Array.isArray(prompt)) return '';
  return prompt
    .map((part) => {
      if (typeof part === 'string') return part;
      if (part && typeof part === 'object' && typeof (part as { text?: string }).text === 'string') {
        return (part as { text: string }).text;
      }
      return '';
    })
    .join('');
}

async function persist(cwd: string): Promise<void> {
  await saveSessionMap(
    cwd,
    [...sessions.values()].filter((item) => item.cwd === cwd),
  );
}

async function ensureMcp(session: SessionState): Promise<void> {
  if (session.mcpInjected) return;
  const guard = await injectHttpMcpServers(session.cwd, session.mcpServers);
  session.warnings.push(...guard.warnings);
  session.mcpInjected = true;
}

async function handle(msg: JsonRpc): Promise<void> {
  const id = msg.id;
  const method = String(msg.method || '');
  const params = msg.params || {};
  try {
    if (method === 'initialize') {
      if (process.env.CURSOR_ACP_SKIP_STATUS !== '1') {
        try {
          await probeCursorAgent(binary, process.cwd());
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          write({
            id,
            error: { code: -32000, message },
          });
          return;
        }
      }
      write({
        id,
        result: {
          protocolVersion: 1,
          agentCapabilities: {
            loadSession: true,
            promptCapabilities: { image: false, audio: false, embeddedContext: false },
          },
          agentInfo: { name: 'cursor-agent-acp', version: '0.1.0' },
        },
      });
      return;
    }

    if (method === 'session/new') {
      const cwd = typeof params.cwd === 'string' && params.cwd.trim() ? params.cwd : process.cwd();
      const sessionId = randomUUID();
      const mcpServers = Array.isArray(params.mcpServers) ? params.mcpServers : [];
      sessions.set(sessionId, {
        acpSessionId: sessionId,
        cwd,
        mcpServers,
        warnings: [],
        mcpInjected: false,
      });
      await persist(cwd);
      write({ id, result: { sessionId } });
      return;
    }

    if (method === 'session/load') {
      const sessionId = String(params.sessionId || '');
      const cwd = typeof params.cwd === 'string' && params.cwd.trim() ? params.cwd : process.cwd();
      const stored = (await loadSessionMap(cwd)).get(sessionId);
      sessions.set(sessionId, {
        acpSessionId: sessionId,
        cwd,
        cursorChatId: stored?.cursorChatId || sessionId,
        mcpServers: Array.isArray(params.mcpServers) ? params.mcpServers : [],
        warnings: [],
        mcpInjected: false,
      });
      await persist(cwd);
      write({ id, result: { sessionId } });
      return;
    }

    if (method === 'session/prompt') {
      const sessionId = String(params.sessionId || '');
      const session = sessions.get(sessionId);
      if (!session) {
        write({ id, error: { code: -32602, message: `Unknown ACP session ${sessionId}` } });
        return;
      }
      await ensureMcp(session);
      const prompt = textFromPrompt(params);
      const result = await runCursorAgent({
        binary,
        cwd: session.cwd,
        prompt,
        resumeId: session.cursorChatId,
        mode,
        handlers: {
          onSessionId: (cursorChatId) => {
            session.cursorChatId = cursorChatId;
          },
          onAssistantText: (text) => {
            write({
              method: 'session/update',
              params: {
                sessionId,
                update: {
                  sessionUpdate: 'agent_message_chunk',
                  content: { type: 'text', text },
                },
              },
            });
          },
        },
      });
      if (result.sessionId) session.cursorChatId = result.sessionId;
      await persist(session.cwd);
      await restoreMcpFile(session.cwd);
      session.mcpInjected = false;
      if (result.isError && !result.text) {
        const message = result.stderr.trim() || `cursor-agent exited ${result.exitCode ?? 'null'}`;
        write({ id, error: { code: -32000, message } });
        return;
      }
      const text =
        result.text ||
        (session.warnings.length
          ? `MCP warnings: ${session.warnings.join('; ')}`
          : '');
      write({
        id,
        result: {
          stopReason: 'end_turn',
          text,
          output: [{ type: 'text', text }],
        },
      });
      return;
    }

    if (method === 'session/cancel') {
      write({ id, result: {} });
      return;
    }

    if (id !== undefined) {
      write({ id, error: { code: -32601, message: `Method not found: ${method}` } });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (id !== undefined) {
      write({ id, error: { code: -32000, message } });
    }
  }
}

const rl = createInterface({ input: process.stdin });
rl.on('line', (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  let msg: JsonRpc;
  try {
    msg = JSON.parse(trimmed) as JsonRpc;
  } catch {
    return;
  }
  void handle(msg);
});

async function shutdown(): Promise<void> {
  const cwds = new Set([...sessions.values()].map((item) => item.cwd));
  for (const cwd of cwds) {
    await restoreMcpFile(cwd).catch(() => undefined);
  }
}

process.on('SIGINT', () => {
  void shutdown().finally(() => process.exit(0));
});
process.on('SIGTERM', () => {
  void shutdown().finally(() => process.exit(0));
});
process.on('exit', () => {
  for (const session of sessions.values()) {
    void restoreMcpFile(session.cwd);
  }
});
