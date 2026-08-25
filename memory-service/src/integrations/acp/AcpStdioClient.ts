/**
 * Minimal ACP (Agent Client Protocol) stdio client.
 * Speaks NDJSON JSON-RPC with an agent process (e.g. @agentclientprotocol/codex-acp).
 */

import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { existsSync } from 'node:fs';
import { EventEmitter } from 'node:events';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { PassThrough } from 'node:stream';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export type AcpMcpServerConfig =
  | {
      name: string;
      command: string;
      args?: string[];
      env?: Record<string, string>;
    }
  | {
      name: string;
      type: 'http' | 'sse' | 'streamable-http';
      url: string;
      headers?: Record<string, string>;
    };

export type AcpSpawnFn = (
  command: string,
  args: string[],
  options: {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    stdio: ['pipe', 'pipe', 'pipe'];
  },
) => ChildProcessWithoutNullStreams;

type Pending = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

export class AcpStdioClient {
  private child: ChildProcessWithoutNullStreams | null = null;
  private readonly pending = new Map<string | number, Pending>();
  private nextId = 1;
  private closed = false;
  private stderr = '';
  readonly updates: Array<Record<string, unknown>> = [];

  constructor(
    private readonly options: {
      command: string;
      args?: string[];
      cwd?: string;
      env?: NodeJS.ProcessEnv;
      spawnFn?: AcpSpawnFn;
      requestTimeoutMs?: number;
      onAgentRequest?: (
        method: string,
        params: Record<string, unknown>,
      ) => Promise<unknown> | unknown;
    },
  ) {}

  async start(): Promise<void> {
    if (this.child) return;
    const spawnFn = this.options.spawnFn || spawn;
    const child = spawnFn(this.options.command, this.options.args || [], {
      cwd: this.options.cwd,
      env: { ...process.env, ...(this.options.env || {}) },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    this.child = child;

    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk: string) => {
      this.stderr += chunk;
      if (this.stderr.length > 20_000) {
        this.stderr = this.stderr.slice(-20_000);
      }
    });

    const rl = createInterface({ input: child.stdout });
    rl.on('line', (line) => {
      void this.onLine(line);
    });

    child.on('exit', (code, signal) => {
      this.closed = true;
      const err = new Error(
        `ACP process exited (code=${code ?? 'null'} signal=${signal ?? 'null'})${
          this.stderr.trim() ? `: ${this.stderr.trim().slice(0, 500)}` : ''
        }`,
      );
      for (const [, pending] of this.pending) {
        clearTimeout(pending.timer);
        pending.reject(err);
      }
      this.pending.clear();
    });
  }

  async initialize(params: Record<string, unknown> = {}): Promise<unknown> {
    return this.request('initialize', {
      protocolVersion: 1,
      clientCapabilities: {
        fs: { readTextFile: true, writeTextFile: false },
        terminal: false,
      },
      clientInfo: {
        name: 'personal-ai-memory-service',
        version: '1.0.0',
      },
      ...params,
    });
  }

  async newSession(params: {
    cwd: string;
    mcpServers?: AcpMcpServerConfig[];
  }): Promise<{ sessionId: string } & Record<string, unknown>> {
    const result = (await this.request('session/new', {
      cwd: params.cwd,
      mcpServers: params.mcpServers || [],
    })) as { sessionId?: string };
    if (!result?.sessionId) {
      throw new Error('ACP session/new did not return sessionId');
    }
    return result as { sessionId: string } & Record<string, unknown>;
  }

  async loadSession(params: {
    sessionId: string;
    cwd: string;
    mcpServers?: AcpMcpServerConfig[];
  }): Promise<unknown> {
    return this.request('session/load', {
      sessionId: params.sessionId,
      cwd: params.cwd,
      mcpServers: params.mcpServers || [],
    });
  }

  async prompt(params: {
    sessionId: string;
    prompt: Array<{ type: string; text?: string; [key: string]: unknown }>;
  }): Promise<unknown> {
    return this.request('session/prompt', params);
  }

  async cancel(sessionId: string): Promise<unknown> {
    return this.request('session/cancel', { sessionId });
  }

  async request(method: string, params?: Record<string, unknown>): Promise<unknown> {
    if (!this.child || this.closed) {
      throw new Error('ACP client is not running');
    }
    const id = this.nextId++;
    const payload = {
      jsonrpc: '2.0',
      id,
      method,
      params: params || {},
    };
    const timeoutMs = this.options.requestTimeoutMs ?? 600_000;
    const resultPromise = new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`ACP request timed out: ${method}`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
    });
    this.child.stdin.write(`${JSON.stringify(payload)}\n`);
    return resultPromise;
  }

  close(): void {
    this.closed = true;
    for (const [, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(new Error('ACP client closed'));
    }
    this.pending.clear();
    if (this.child && !this.child.killed) {
      this.child.kill('SIGTERM');
    }
    this.child = null;
  }

  private async onLine(line: string): Promise<void> {
    const trimmed = line.trim();
    if (!trimmed) return;
    let msg: any;
    try {
      msg = JSON.parse(trimmed);
    } catch {
      return;
    }

    if (msg.method && msg.id !== undefined) {
      // Agent → client request (permissions, fs reads, etc.)
      let result: unknown = {};
      try {
        result =
          (await this.options.onAgentRequest?.(
            String(msg.method),
            (msg.params || {}) as Record<string, unknown>,
          )) ?? defaultAgentRequestHandler(String(msg.method), msg.params || {});
      } catch (error) {
        this.write({
          jsonrpc: '2.0',
          id: msg.id,
          error: {
            code: -32000,
            message: error instanceof Error ? error.message : String(error),
          },
        });
        return;
      }
      this.write({ jsonrpc: '2.0', id: msg.id, result });
      return;
    }

    if (msg.method && msg.id === undefined) {
      if (msg.method === 'session/update' && msg.params) {
        this.updates.push(msg.params as Record<string, unknown>);
      }
      return;
    }

    if (msg.id !== undefined && (msg.result !== undefined || msg.error)) {
      const pending = this.pending.get(msg.id);
      if (!pending) return;
      clearTimeout(pending.timer);
      this.pending.delete(msg.id);
      if (msg.error) {
        pending.reject(
          new Error(
            typeof msg.error?.message === 'string'
              ? msg.error.message
              : JSON.stringify(msg.error),
          ),
        );
      } else {
        pending.resolve(msg.result);
      }
    }
  }

  private write(payload: Record<string, unknown>): void {
    if (!this.child || this.closed) return;
    this.child.stdin.write(`${JSON.stringify(payload)}\n`);
  }
}

function defaultAgentRequestHandler(
  method: string,
  params: Record<string, unknown>,
): unknown {
  if (method === 'session/request_permission') {
    return {
      outcome: { outcome: 'selected', optionId: 'allow-once' },
    };
  }
  if (method === 'fs/read_text_file') {
    return {
      content: '',
      error: `fs/read_text_file not granted for ${String(params.path || '')}`,
    };
  }
  if (method === 'fs/write_text_file') {
    return { error: 'fs/write_text_file denied by Personal AI ACP client' };
  }
  return {};
}

export function createFakeAcpChild(script: {
  onRequest: (
    method: string,
    params: Record<string, unknown>,
    respond: (result: unknown) => void,
    notify: (method: string, params: Record<string, unknown>) => void,
  ) => void;
}): ChildProcessWithoutNullStreams {
  const stdout = new PassThrough();
  const stdin = new PassThrough();
  const stderr = new PassThrough();
  const ee = new EventEmitter() as ChildProcessWithoutNullStreams;
  (ee as any).stdout = stdout;
  (ee as any).stdin = stdin;
  (ee as any).stderr = stderr;
  (ee as any).killed = false;
  (ee as any).kill = () => {
    (ee as any).killed = true;
    ee.emit('exit', 0, null);
  };

  const rl = createInterface({ input: stdin });
  rl.on('line', (line) => {
    let msg: any;
    try {
      msg = JSON.parse(line);
    } catch {
      return;
    }
    if (!msg.method || msg.id === undefined) return;
    const respond = (result: unknown) => {
      stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id: msg.id, result })}\n`);
    };
    const notify = (method: string, params: Record<string, unknown>) => {
      stdout.write(`${JSON.stringify({ jsonrpc: '2.0', method, params })}\n`);
    };
    script.onRequest(String(msg.method), msg.params || {}, respond, notify);
  });

  return ee;
}

export function defaultCodexAcpCommand(): { command: string; args: string[] } {
  return {
    command: process.env.ACP_CODEX_COMMAND || 'npx',
    args: process.env.ACP_CODEX_ARGS
      ? process.env.ACP_CODEX_ARGS.split(/\s+/).filter(Boolean)
      : ['-y', '@agentclientprotocol/codex-acp'],
  };
}

export function defaultCursorAcpCommand(): { command: string; args: string[] } {
  if (process.env.ACP_CURSOR_COMMAND) {
    return {
      command: process.env.ACP_CURSOR_COMMAND,
      args: process.env.ACP_CURSOR_ARGS
        ? process.env.ACP_CURSOR_ARGS.split(/\s+/).filter(Boolean)
        : [],
    };
  }
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(here, '../../../../cursor-acp/dist/index.js'),
    path.resolve(here, '../../cursor-acp/dist/index.js'),
    path.resolve(here, '../vendor/cursor-acp/index.js'),
    path.resolve(here, 'vendor/cursor-acp/index.js'),
    path.resolve(here, '../cursor-acp/index.js'),
  ];
  const file = candidates.find((candidate) => existsSync(candidate)) || candidates[0]!;
  return { command: process.execPath, args: [file] };
}

export function acpCommandForType(
  type: string,
): { command: string; args: string[] } {
  if (type === 'acp-claude-code') {
    return {
      command: process.env.ACP_CLAUDE_COMMAND || 'npx',
      args: process.env.ACP_CLAUDE_ARGS
        ? process.env.ACP_CLAUDE_ARGS.split(/\s+/).filter(Boolean)
        : ['-y', '@agentclientprotocol/claude-code-acp'],
    };
  }
  if (type === 'acp-cursor') {
    return defaultCursorAcpCommand();
  }
  return defaultCodexAcpCommand();
}

export function newSessionKey(): string {
  return `acp_${randomUUID()}`;
}
