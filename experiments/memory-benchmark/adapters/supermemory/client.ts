import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export interface SupermemoryClientOptions {
  origin?: string;
  apiKey?: string;
  pollIntervalMs?: number;
  ingestDeadlineMs?: number;
  /** Server-side embedding workers (for batch deadline estimation). */
  embeddingConcurrent?: number;
  ingestMsPerDoc?: number;
}

export function resolveIngestDeadlineMs(override?: number): number {
  if (override != null) return override;
  const fromEnv = process.env.SUPERMEMORY_INGEST_DEADLINE_MS?.trim();
  if (fromEnv) {
    const n = Number(fromEnv);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 600_000;
}

export function resolveEmbeddingConcurrent(override?: number): number {
  if (override != null) return Math.max(1, override);
  const fromEnv = process.env.SUPERMEMORY_EMBEDDING_CONCURRENT?.trim();
  if (fromEnv) {
    const n = Number(fromEnv);
    if (Number.isFinite(n) && n > 0) return Math.max(1, Math.floor(n));
  }
  return 2;
}

/** Wall-clock budget for finishing N queued documents on a 2-worker embed queue. */
export function deadlineMsForBatch(
  docCount: number,
  baseMs: number,
  opts?: { concurrent?: number; msPerDoc?: number },
): number {
  if (docCount <= 0) return baseMs;
  const concurrent = opts?.concurrent ?? resolveEmbeddingConcurrent();
  const msPerDoc =
    opts?.msPerDoc ??
    (Number(process.env.SUPERMEMORY_INGEST_MS_PER_DOC) > 0
      ? Number(process.env.SUPERMEMORY_INGEST_MS_PER_DOC)
      : 5_000);
  const queueMs = Math.ceil(docCount / concurrent) * msPerDoc;
  return Math.max(baseMs, queueMs + 60_000);
}

export function createSupermemoryClient(opts: SupermemoryClientOptions = {}): SupermemoryClient {
  return new SupermemoryClient(opts);
}

export interface SupermemoryIngestFailure {
  id: string;
  namespace: string;
  status: string;
}

export interface WaitDocumentsResult {
  failures: SupermemoryIngestFailure[];
  maxQueuedWaitMs: number;
}

export interface SearchHit {
  content?: string;
  chunk?: string;
  score?: number;
  similarity?: number;
  docId?: string;
  id?: string;
  metadata?: Record<string, unknown>;
}

export class SupermemoryClient {
  readonly origin: string;
  private apiKey: string;
  private pollIntervalMs: number;
  private ingestDeadlineMs: number;
  private embeddingConcurrent: number;
  private ingestMsPerDoc: number;

  constructor(opts: SupermemoryClientOptions = {}) {
    this.origin = (opts.origin ?? process.env.SUPERMEMORY_ORIGIN ?? "http://127.0.0.1:6767").replace(
      /\/$/,
      "",
    );
    this.apiKey = opts.apiKey ?? resolveApiKey();
    this.pollIntervalMs = opts.pollIntervalMs ?? 500;
    this.ingestDeadlineMs = resolveIngestDeadlineMs(opts.ingestDeadlineMs);
    this.embeddingConcurrent = resolveEmbeddingConcurrent(opts.embeddingConcurrent);
    this.ingestMsPerDoc =
      opts.ingestMsPerDoc ??
      (Number(process.env.SUPERMEMORY_INGEST_MS_PER_DOC) > 0
        ? Number(process.env.SUPERMEMORY_INGEST_MS_PER_DOC)
        : 5_000);
  }

  headers(): Record<string, string> {
    return {
      authorization: `Bearer ${this.apiKey}`,
      "content-type": "application/json",
    };
  }

  async healthOk(): Promise<boolean> {
    try {
      const res = await fetch(`${this.origin}/health`, { method: "GET" });
      if (res.ok) return true;
    } catch {
      /* fall through */
    }
    try {
      const res = await fetch(`${this.origin}/ns/harness-health/search`, {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify({ query: "health", limit: 1, threshold: 0 }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async addDocument(
    namespace: string,
    id: string,
    content: string,
    metadata: Record<string, unknown>,
  ): Promise<{ id: string; status?: string }> {
    return this.request(`/ns/${encodeURIComponent(namespace)}/document`, {
      method: "POST",
      body: JSON.stringify({ id, content, metadata }),
    });
  }

  async patchDocument(
    namespace: string,
    id: string,
    content: string,
    metadata: Record<string, unknown>,
  ): Promise<unknown> {
    return this.request(`/ns/${encodeURIComponent(namespace)}/document/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ content, metadata }),
    });
  }

  async getDocument(namespace: string, id: string): Promise<{ system?: { status?: string } }> {
    return this.request(
      `/ns/${encodeURIComponent(namespace)}/document/${encodeURIComponent(id)}`,
      { method: "GET" },
    );
  }

  async waitDocumentDone(namespace: string, id: string): Promise<WaitDocumentsResult> {
    return this.waitDocumentsDone(namespace, [id]);
  }

  async waitDocumentsDone(
    namespace: string,
    ids: string[],
    opts?: { deadlineMs?: number },
  ): Promise<WaitDocumentsResult> {
    const unique = [...new Set(ids.filter(Boolean))];
    if (unique.length === 0) return { failures: [], maxQueuedWaitMs: 0 };

    const deadline =
      Date.now() +
      (opts?.deadlineMs ??
        deadlineMsForBatch(unique.length, this.ingestDeadlineMs, {
          concurrent: this.embeddingConcurrent,
          msPerDoc: this.ingestMsPerDoc,
        }));

    const pending = new Set(unique);
    const lastStatus = new Map<string, string>();
    const queuedSince = new Map<string, number>();
    const failures: SupermemoryIngestFailure[] = [];
    let maxQueuedWaitMs = 0;
    const now = () => Date.now();

    while (pending.size > 0 && now() < deadline) {
      for (const id of [...pending]) {
        const doc = await this.getDocument(namespace, id);
        const status = doc.system?.status ?? "unknown";
        lastStatus.set(id, status);
        if (status === "queued" || status === "extracting") {
          if (!queuedSince.has(id)) queuedSince.set(id, now());
        } else {
          queuedSince.delete(id);
        }
        if (status === "done") {
          pending.delete(id);
          continue;
        }
        if (status === "failed") {
          failures.push({ id, namespace, status: "failed" });
          pending.delete(id);
        }
      }
      if (pending.size > 0) {
        await sleep(this.pollIntervalMs);
      }
    }

    for (const [id, since] of queuedSince) {
      maxQueuedWaitMs = Math.max(maxQueuedWaitMs, now() - since);
    }

    if (pending.size > 0) {
      const sample = [...pending][0]!;
      throw new Error(
        `SUPERMEMORY_INGEST_TIMEOUT:${namespace}/${sample}:${lastStatus.get(sample) ?? "unknown"}`,
      );
    }

    return { failures, maxQueuedWaitMs };
  }

  async search(
    namespace: string,
    query: string,
    limit = 8,
    threshold = 0,
    searchMode: "hybrid" | "chunks" | "memories" = "hybrid",
  ): Promise<{ results?: SearchHit[] }> {
    return this.request(`/ns/${encodeURIComponent(namespace)}/search`, {
      method: "POST",
      body: JSON.stringify({ query, limit, threshold, searchMode }),
    });
  }

  async deleteDocuments(namespace: string, ids: string[]): Promise<{ count?: number }> {
    if (ids.length === 0) return { count: 0 };
    return this.request(`/ns/${encodeURIComponent(namespace)}/document`, {
      method: "DELETE",
      body: JSON.stringify({ ids }),
    });
  }

  async documentMissing(namespace: string, id: string): Promise<boolean> {
    const res = await fetch(
      `${this.origin}/ns/${encodeURIComponent(namespace)}/document/${encodeURIComponent(id)}`,
      { method: "GET", headers: this.headers() },
    );
    return res.status === 404;
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const response = await fetch(`${this.origin}${path}`, {
      ...init,
      headers: { ...this.headers(), ...(init.headers as Record<string, string>) },
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(
        `${init.method ?? "GET"} ${path}: ${response.status} ${JSON.stringify(body)}`,
      );
    }
    return body as T;
  }
}

function resolveApiKey(): string {
  const fromEnv = process.env.SUPERMEMORY_API_KEY?.trim();
  if (fromEnv) return fromEnv;
  const here = dirname(fileURLToPath(import.meta.url));
  const sibling = join(here, "../../../../../personal-ai-supermemory/local-state/data/api-key");
  if (existsSync(sibling)) {
    return readFileSync(sibling, "utf8").trim();
  }
  throw new Error("SUPERMEMORY_API_KEY missing (set env or start local server to generate api-key)");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function defaultSupermemoryCheckout(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return join(here, "../../../../../personal-ai-supermemory");
}
