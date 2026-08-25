import { fork, type ChildProcess } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export type WorkerSupervisorStatus = {
  state: 'offline' | 'starting' | 'online' | 'error';
  pid?: number;
  restartsLastHour: number;
  lastError?: string;
  currentTaskCount: number;
  paired: boolean;
  logFile?: string;
};

const MAX_RESTARTS_PER_HOUR = 5;

export type WorkerLocalSettings = {
  cwd?: string;
  acpCodexCommand?: string;
  acpClaudeCommand?: string;
  acpCursorCommand?: string;
  cursorAgentCommand?: string;
};

export class WorkerSupervisor {
  private child: ChildProcess | null = null;
  private restarts: number[] = [];
  private lastError?: string;
  private starting = false;
  private pairPayload: {
    pairingToken: string;
    serverUrl: string;
  } | null = null;
  private stopping = false;

  constructor(
    private readonly options: {
      dataDir: string;
      workerEntry?: string;
      logFile?: string;
    },
  ) {}

  private mainOwnsWorker(): boolean {
    return process.env.PERSONAL_AI_MAIN_OWNS_WORKER === '1';
  }

  logPath(): string {
    return this.options.logFile || path.join(this.options.dataDir, 'worker.log');
  }

  resolveEntry(): string {
    if (this.options.workerEntry) return this.options.workerEntry;
    const here = path.dirname(fileURLToPath(import.meta.url));
    return path.resolve(here, '..', 'worker', 'index.js');
  }

  async writeLocalSettings(settings: WorkerLocalSettings): Promise<void> {
    await fs.mkdir(this.options.dataDir, { recursive: true });
    const file = path.join(this.options.dataDir, 'settings.json');
    const serialized = JSON.stringify(settings, null, 2);
    try {
      const previous = await fs.readFile(file, 'utf8');
      if (previous === serialized) return;
    } catch {
      /* first write */
    }
    await fs.writeFile(file, serialized, 'utf8');
    if (this.mainOwnsWorker()) {
      await this.requestMainRestart();
      return;
    }
    if (this.pairPayload?.pairingToken || this.child) {
      await this.restart();
    }
  }

  async pair(input: { pairingToken: string; serverUrl: string }): Promise<void> {
    this.pairPayload = input;
    await fs.mkdir(this.options.dataDir, { recursive: true });
    await fs.writeFile(
      path.join(this.options.dataDir, 'pair.json'),
      JSON.stringify(input, null, 2),
      'utf8',
    );
    if (this.mainOwnsWorker()) {
      await this.requestMainRestart();
      return;
    }
    await this.restart();
  }

  async startIfPaired(): Promise<void> {
    try {
      const raw = await fs.readFile(
        path.join(this.options.dataDir, 'pair.json'),
        'utf8',
      );
      this.pairPayload = JSON.parse(raw) as {
        pairingToken: string;
        serverUrl: string;
      };
    } catch {
      return;
    }
    if (!this.pairPayload?.pairingToken) return;
    if (this.mainOwnsWorker()) {
      await this.requestMainRestart();
      return;
    }
    await this.restart();
  }

  getStatus(): WorkerSupervisorStatus {
    const now = Date.now();
    this.restarts = this.restarts.filter((ts) => now - ts < 60 * 60 * 1000);
    const childOnline = Boolean(this.child && !this.child.killed);
    return {
      state: childOnline
        ? 'online'
        : this.starting
          ? 'starting'
          : this.lastError
            ? 'error'
            : 'offline',
      pid: this.child?.pid,
      restartsLastHour: this.restarts.length,
      lastError: this.lastError,
      currentTaskCount: 0,
      paired: Boolean(this.pairPayload?.pairingToken),
      logFile: this.logPath(),
    };
  }

  async getStatusAsync(): Promise<WorkerSupervisorStatus> {
    const base = this.getStatus();
    if (base.state === 'online') return base;
    try {
      const raw = await fs.readFile(
        path.join(this.options.dataDir, 'runtime.json'),
        'utf8',
      );
      const runtime = JSON.parse(raw) as {
        pid?: number;
        currentTaskCount?: number;
        updatedAt?: number;
      };
      const fresh =
        typeof runtime.updatedAt === 'number' &&
        Date.now() - runtime.updatedAt < 45_000;
      if (fresh) {
        return {
          ...base,
          state: 'online',
          pid: runtime.pid,
          currentTaskCount: runtime.currentTaskCount || 0,
          paired: base.paired || true,
        };
      }
    } catch {
      /* no runtime yet */
    }
    return base;
  }

  async stop(): Promise<void> {
    this.stopping = true;
    if (!this.child) return;
    this.child.removeAllListeners();
    this.child.kill('SIGTERM');
    this.child = null;
  }

  private async requestMainRestart(): Promise<void> {
    await fs.mkdir(this.options.dataDir, { recursive: true });
    await fs.writeFile(
      path.join(this.options.dataDir, 'restart.flag'),
      String(Date.now()),
      'utf8',
    );
  }

  private async restart(): Promise<void> {
    this.stopping = true;
    await this.stop();
    this.stopping = false;
    const now = Date.now();
    this.restarts = this.restarts.filter((ts) => now - ts < 60 * 60 * 1000);
    if (this.restarts.length >= MAX_RESTARTS_PER_HOUR) {
      this.lastError = `Worker crashed ${MAX_RESTARTS_PER_HOUR} times in the last hour; giving up until Desktop App restart.`;
      return;
    }
    this.starting = true;
    const entry = this.resolveEntry();
    const args = [
      '--server',
      this.pairPayload?.serverUrl || 'http://127.0.0.1:3210',
      '--token',
      this.pairPayload?.pairingToken || '',
      '--data-dir',
      this.options.dataDir,
      '--host-kind',
      'desktop',
    ];
    const extraPath = [
      path.join(os.homedir(), '.local', 'bin'),
      '/usr/local/bin',
      '/opt/homebrew/bin',
      process.env.PATH || '',
    ].join(path.delimiter);
    const child = fork(entry, args, {
      stdio: 'pipe',
      env: {
        ...process.env,
        PATH: extraPath,
        WORKER_HOST_KIND: 'desktop',
      },
    });
    this.child = child;
    this.starting = false;
    try {
      await fs.mkdir(path.dirname(this.logPath()), { recursive: true });
      const logStream = createWriteStream(this.logPath(), { flags: 'a' });
      child.stdout?.pipe(logStream);
      child.stderr?.pipe(logStream);
    } catch {
      /* logging is best-effort */
    }
    child.on('exit', (code) => {
      this.lastError = `worker exit ${code ?? 'null'}`;
      this.child = null;
      if (this.stopping) return;
      this.restarts.push(Date.now());
      const delay = Math.min(30_000, 1000 * 2 ** Math.min(this.restarts.length, 5));
      setTimeout(() => {
        void this.restart();
      }, delay);
    });
    child.on('error', (error) => {
      this.lastError = error.message;
    });
  }
}

export function isTrustedWorkerPairOrigin(
  origin: string | undefined,
  extensionIdHeader: string | undefined,
  ip: string | undefined,
): boolean {
  if (origin && origin.startsWith('chrome-extension://')) return true;
  if (extensionIdHeader && extensionIdHeader.trim()) return true;
  if (ip === '127.0.0.1' || ip === '::1' || ip === ':ffff:127.0.0.1') return true;
  return false;
}
