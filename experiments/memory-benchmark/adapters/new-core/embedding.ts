import { loadModelsConfig } from "./config.js";

const FALLBACK_DIM = 256;
const OLLAMA_HOST = process.env.OLLAMA_HOST?.replace(/\/$/, "") ?? "http://127.0.0.1:11434";

let cachedDim: number | null = null;
let embeddingBackend: "ollama-bge-m3" | "fallback-bow" = "ollama-bge-m3";
let totalEmbedMs = 0;
let embedCallCount = 0;

export function embeddingStats(): {
  backend: string;
  dimensions: number;
  total_embed_ms: number;
  embed_call_count: number;
} {
  return {
    backend: embeddingBackend,
    dimensions: cachedDim ?? loadModelsConfig().embedding.dimensions,
    total_embed_ms: totalEmbedMs,
    embed_call_count: embedCallCount,
  };
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

function embedBow(text: string, dim: number): Float32Array {
  const vec = new Float32Array(dim);
  for (const tok of tokenize(text)) {
    let h = 0;
    for (let i = 0; i < tok.length; i++) h = (h * 31 + tok.charCodeAt(i)) >>> 0;
    vec[h % dim] += 1;
  }
  let norm = 0;
  for (let i = 0; i < dim; i++) norm += vec[i]! * vec[i]!;
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < dim; i++) vec[i]! /= norm;
  return vec;
}

async function embedOllama(text: string, model: string, expectedDim: number): Promise<Float32Array> {
  const t0 = performance.now();
  const res = await fetch(`${OLLAMA_HOST}/api/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, prompt: text }),
    signal: AbortSignal.timeout(Number(process.env.OLLAMA_EMBED_TIMEOUT_MS ?? 120_000)),
  });
  if (!res.ok) {
    throw new Error(`ollama_embeddings_http_${res.status}`);
  }
  const json = (await res.json()) as { embedding?: number[] };
  const arr = json.embedding;
  if (!arr?.length) throw new Error("ollama_empty_embedding");
  if (arr.length !== expectedDim) {
    throw new Error(`ollama_dim_mismatch:${arr.length}!=${expectedDim}`);
  }
  const vec = new Float32Array(arr.length);
  for (let i = 0; i < arr.length; i++) vec[i] = arr[i]!;
  let norm = 0;
  for (let i = 0; i < vec.length; i++) norm += vec[i]! * vec[i]!;
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < vec.length; i++) vec[i]! /= norm;
  totalEmbedMs += performance.now() - t0;
  embedCallCount += 1;
  return vec;
}

/** Local bge-m3 (1024d) via Ollama; falls back to deterministic BoW only when Ollama unreachable. */
export async function embedText(text: string): Promise<Float32Array> {
  const cfg = loadModelsConfig().embedding;
  const expectedDim = cfg.dimensions;
  const skipOllama = process.env.VITEST === "true" || process.env.NEW_CORE_EMBED_BOW === "1";
  if (!skipOllama && embeddingBackend !== "fallback-bow") {
    try {
      const vec = await embedOllama(text, cfg.model, expectedDim);
      cachedDim = expectedDim;
      embeddingBackend = "ollama-bge-m3";
      return vec;
    } catch (error) {
      if (process.env.MEMORY_BENCHMARK_STRICT_BGE === "1") throw error;
      embeddingBackend = "fallback-bow";
    }
  }
  cachedDim = FALLBACK_DIM;
  return embedBow(text, FALLBACK_DIM);
}

export function cosine(a: Float32Array, b: Float32Array): number {
  const n = Math.min(a.length, b.length);
  let s = 0;
  for (let i = 0; i < n; i++) s += a[i]! * b[i]!;
  return s;
}

export function serializeVector(v: Float32Array): Buffer {
  return Buffer.from(v.buffer, v.byteOffset, v.byteLength);
}

export function deserializeVector(buf: Buffer): Float32Array {
  return new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
}

export const EMBEDDING_DIM = loadModelsConfig().embedding.dimensions;
