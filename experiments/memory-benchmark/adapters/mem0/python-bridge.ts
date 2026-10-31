import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface } from "node:readline";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadBenchmarkDotenv } from "./load-env.js";

export interface Mem0WorkerOptions {
  mem0Checkout?: string;
  pythonPath?: string;
  qdrantPath: string;
  collection: string;
  env?: NodeJS.ProcessEnv;
}

export interface Mem0AddResult {
  results?: Array<{ id?: string; memory?: string; event?: string; metadata?: Record<string, unknown> }>;
}

export interface Mem0SearchResult {
  results?: Array<{
    id?: string;
    memory?: string;
    score?: number;
    metadata?: Record<string, unknown>;
  }>;
}

let nextId = 1;

export class Mem0PythonWorker {
  private proc: ChildProcessWithoutNullStreams | null = null;
  private pending = new Map<
    number,
    { resolve: (v: unknown) => void; reject: (e: Error) => void }
  >();
  private ready: Promise<void> | null = null;

  constructor(private opts: Mem0WorkerOptions) {}

  static defaultCheckout(): string {
    const here = dirname(fileURLToPath(import.meta.url));
    const candidates = [
      resolve(here, "../../../../../personal-ai-mem0"),
      resolve(here, "../../../../../../personal-ai-mem0"),
      process.env.MEM0_CHECKOUT,
    ].filter((p): p is string => Boolean(p));
    for (const p of candidates) {
      if (existsSync(p)) return p;
    }
    return candidates[0]!;
  }

  static defaultPython(checkout: string): string {
    const venv = join(checkout, ".venv/bin/python");
    if (existsSync(venv)) return venv;
    return "python3";
  }

  async start(): Promise<void> {
    if (this.ready) return this.ready;
    loadBenchmarkDotenv();
    const checkout = this.opts.mem0Checkout ?? Mem0PythonWorker.defaultCheckout();
    const python = this.opts.pythonPath ?? Mem0PythonWorker.defaultPython(checkout);
    const workerScript = join(dirname(fileURLToPath(import.meta.url)), "mem0_worker.py");
    if (!existsSync(workerScript)) {
      throw new Error(`MEM0_WORKER_MISSING:${workerScript}`);
    }

    const env = {
      ...process.env,
      MEM0_TELEMETRY: "false",
      MEM0_QDRANT_PATH: this.opts.qdrantPath,
      MEM0_COLLECTION: this.opts.collection,
      OPENAI_API_BASE_URL:
        process.env.OPENAI_API_BASE_URL?.trim() || "https://openrouter.ai/api/v1",
      OPENAI_MODEL: process.env.MEM0_FAST_MODEL ?? "z-ai/glm-5.3-flash",
      OPENAI_API_KEY: process.env.OPENROUTER_API_KEY ?? process.env.OPENAI_API_KEY ?? "",
      ...this.opts.env,
    };

    this.proc = spawn(python, [workerScript], {
      cwd: checkout,
      env,
      stdio: ["pipe", "pipe", "pipe"],
    });

    const rl = createInterface({ input: this.proc.stdout });
    rl.on("line", (line) => {
      try {
        const msg = JSON.parse(line) as { id?: number; ok?: boolean; result?: unknown; error?: string };
        const id = msg.id;
        if (id === undefined || id === null) return;
        const p = this.pending.get(id);
        if (!p) return;
        this.pending.delete(id);
        if (msg.ok) p.resolve(msg.result);
        else p.reject(new Error(msg.error ?? "mem0_worker_error"));
      } catch {
        /* ignore malformed */
      }
    });

    this.proc.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString("utf8").trim();
      if (text) process.stderr.write(`[mem0-worker] ${text}\n`);
    });

    this.ready = (async () => {
      await this.call("ping", {});
      await this.call("init", {
        qdrant_path: this.opts.qdrantPath,
        collection: this.opts.collection,
      });
    })();
    return this.ready;
  }

  private call(cmd: string, payload: Record<string, unknown>): Promise<unknown> {
    if (!this.proc?.stdin.writable) {
      return Promise.reject(new Error("MEM0_WORKER_NOT_RUNNING"));
    }
    const id = nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.proc!.stdin.write(JSON.stringify({ id, cmd, ...payload }) + "\n");
    });
  }

  async add(
    userId: string,
    text: string,
    metadata: Record<string, unknown>,
    infer = true,
  ): Promise<Mem0AddResult> {
    await this.start();
    return (await this.call("add", { user_id: userId, text, metadata, infer })) as Mem0AddResult;
  }

  async search(userId: string, query: string, limit = 5): Promise<Mem0SearchResult> {
    await this.start();
    return (await this.call("search", { user_id: userId, query, limit })) as Mem0SearchResult;
  }

  async deleteMemory(memoryId: string): Promise<void> {
    await this.start();
    await this.call("delete", { memory_id: memoryId });
  }

  async deleteAll(userId: string): Promise<void> {
    await this.start();
    await this.call("delete_all", { user_id: userId });
  }

  async shutdown(): Promise<void> {
    if (!this.proc) return;
    try {
      await this.call("shutdown", {});
    } catch {
      /* ignore */
    }
    this.proc.kill();
    this.proc = null;
    this.ready = null;
  }
}
