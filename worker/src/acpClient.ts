/**
 * Minimal ACP stdio client for the standalone worker.
 * HTTP MCP only — no stdio memory fallback (user machine talks to memory-service).
 */

import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { createInterface } from 'node:readline';
import { PassThrough } from 'node:stream';

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

export class WorkerAcpClient {
  private child: ChildProcessWithoutNullStreams | null = null;
  private readonly pending = new Map<number, Pending>();
  private nextId = 1;
  private closed = false;
  readonly updates: Array<Record<string, unknown>> = [];

  constructor(
    private readonly options: {
      command: string;
      args?: string[];
      cwd?: string;
      env?: NodeJS.ProcessEnv;
      spawnFn?: AcpSpawnFn;
      requestTimeoutMs?: number;
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
    const rl = createInterface({ input: child.stdout });
    rl.on('line', (line) => {
      void this.onLine(line);
    });
    child.on('exit', () => {
      this.closed = true;
      const err = new Error('ACP process exited');
      for (const pending of this.pending.values()) {
        clearTimeout(pending.timer);
        pending.reject(err);
      }
      this.pending.clear();
    });
  }

  async initialize(): Promise<unknown> {
    return this.request('initialize', {
      protocolVersion: 1,
      clientInfo: { name: 'personal-ai-worker', version: '1.0.0' },
    });
  }

  async newSession(params: {
    cwd: string;
    mcpServers?: Array<Record<string, unknown>>;
  }): Promise<{ sessionId: string }> {
    const result = (await this.request('session/new', {
      cwd: params.cwd,
      mcpServers: params.mcpServers || [],
    })) as { sessionId?: string };
    if (!result?.sessionId) {
      throw new Error('ACP session/new did not return sessionId');
    }
    return result as { sessionId: string };
  }

  async prompt(params: {
    sessionId: string;
    prompt: Array<{ type: string; text?: string }>;
  }): Promise<unknown> {
    return this.request('session/prompt', params);
  }

  close(): void {
    this.closed = true;
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(new Error('ACP client closed'));
    }
    this.pending.clear();
    if (this.child && !this.child.killed) this.child.kill('SIGTERM');
    this.child = null;
  }

  private async request(method: string, params?: Record<string, unknown>) {
    if (!this.child || this.closed) throw new Error('ACP client is not running');
    const id = this.nextId++;
    const timeoutMs = this.options.requestTimeoutMs ?? 600_000;
    const resultPromise = new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`ACP request timed out: ${method}`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
    });
    this.child.stdin.write(
      `${JSON.stringify({ jsonrpc: '2.0', id, method, params: params || {} })}\n`,
    );
    return resultPromise;
  }

  private async onLine(line: string): Promise<void> {
    const trimmed = line.trim();
    if (!trimmed) return;
    let msg: { id?: number; method?: string; params?: unknown; result?: unknown; error?: { message?: string } };
    try {
      msg = JSON.parse(trimmed);
    } catch {
      return;
    }
    if (msg.method && msg.id !== undefined) {
      this.child?.stdin.write(
        `${JSON.stringify({
          jsonrpc: '2.0',
          id: msg.id,
          result:
            msg.method === 'session/request_permission'
              ? { outcome: { outcome: 'selected', optionId: 'allow-once' } }
              : {},
        })}\n`,
      );
      return;
    }
    if (msg.method && msg.id === undefined && msg.params) {
      this.updates.push(msg.params as Record<string, unknown>);
      return;
    }
    if (msg.id !== undefined) {
      const pending = this.pending.get(msg.id);
      if (!pending) return;
      clearTimeout(pending.timer);
      this.pending.delete(msg.id);
      if (msg.error) {
        pending.reject(new Error(msg.error.message || 'ACP error'));
      } else {
        pending.resolve(msg.result);
      }
    }
  }
}

export function createFakeAcpChild(script: {
  onRequest: (
    method: string,
    params: Record<string, unknown>,
    respond: (result: unknown) => void,
  ) => void;
}): ChildProcessWithoutNullStreams {
  const stdout = new PassThrough();
  const stdin = new PassThrough();
  const stderr = new PassThrough();
  const ee = new EventEmitter() as ChildProcessWithoutNullStreams;
  Object.assign(ee, {
    stdout,
    stdin,
    stderr,
    killed: false,
    kill() {
      (ee as { killed: boolean }).killed = true;
      ee.emit('exit', 0, null);
    },
  });
  const rl = createInterface({ input: stdin });
  rl.on('line', (line) => {
    let msg: { id?: number; method?: string; params?: Record<string, unknown> };
    try {
      msg = JSON.parse(line);
    } catch {
      return;
    }
    if (!msg.method || msg.id === undefined) return;
    script.onRequest(String(msg.method), msg.params || {}, (result) => {
      stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id: msg.id, result })}\n`);
    });
  });
  return ee;
}
