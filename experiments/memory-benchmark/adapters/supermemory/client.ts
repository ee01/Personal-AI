import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export interface SupermemoryClientOptions {
  origin?: string;
  apiKey?: string;
  pollIntervalMs?: number;
  ingestDeadlineMs?: number;
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

  constructor(opts: SupermemoryClientOptions = {}) {
    this.origin = (opts.origin ?? process.env.SUPERMEMORY_ORIGIN ?? "http://127.0.0.1:6767").replace(
      /\/$/,
      "",
    );
    this.apiKey = opts.apiKey ?? resolveApiKey();
    this.pollIntervalMs = opts.pollIntervalMs ?? 500;
    this.ingestDeadlineMs = opts.ingestDeadlineMs ?? 120_000;
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

  async waitDocumentDone(namespace: string, id: string): Promise<void> {
    const deadline = Date.now() + this.ingestDeadlineMs;
    let doc = await this.getDocument(namespace, id);
    while (doc.system?.status !== "done" && Date.now() < deadline) {
      await sleep(this.pollIntervalMs);
      doc = await this.getDocument(namespace, id);
    }
    if (doc.system?.status !== "done") {
      throw new Error(
        `SUPERMEMORY_INGEST_TIMEOUT:${namespace}/${id}:${doc.system?.status ?? "unknown"}`,
      );
    }
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
