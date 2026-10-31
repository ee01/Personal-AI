import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import Database from "better-sqlite3";
import type { PersonalMemoryEvent, RecallHit, RecallQuery } from "../types.js";

export const HISTORY_TOP_K = 20;
// UTF-8 bytes are a conservative upper bound on byte-tokenizer token count.
export const CONTEXT_BYTE_LIMIT = 12_000;
export function recentEvents(events: PersonalMemoryEvent[], asOf: string, hours = 8) {
  const end = Date.parse(asOf), start = end - hours * 3600_000;
  return events.filter(e => Date.parse(e.observed_at) > start && Date.parse(e.observed_at) <= end)
    .sort((a, b) => Date.parse(a.observed_at) - Date.parse(b.observed_at));
}
export function terms(text: string): string[] {
  const words = text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  return [...new Set(words.flatMap(w => /\p{Script=Han}/u.test(w) ? [...w].map((_, i) => w.slice(i, i + 2)).filter(x => x.length === 2) : [w]))].slice(0, 64);
}
export function limitHits(hits: RecallHit[], topK = HISTORY_TOP_K, byteLimit = CONTEXT_BYTE_LIMIT) {
  let bytes = 0, truncated = 0;
  const seen = new Set<string>(), selected: RecallHit[] = [];
  for (const hit of hits) {
    const key = hit.event_id ?? hit.text;
    if (seen.has(key)) continue;
    seen.add(key);
    if (selected.length >= topK) { truncated++; continue; }
    const size = Buffer.byteLength(hit.text, "utf8");
    if (bytes + size > byteLimit) { truncated++; continue; }
    bytes += size;
    selected.push(hit);
  }
  return { hits: selected, bytes, truncated };
}
export async function strictEmbedBatch(texts: string[]): Promise<number[][]> {
  const response = await fetch(`${process.env.OLLAMA_HOST ?? "http://127.0.0.1:11434"}/api/embed`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "bge-m3", input: texts }), signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) throw new Error(`bge_m3_http_${response.status}`);
  const body = await response.json() as { embeddings: number[][] };
  if (body.embeddings?.length !== texts.length) throw new Error("invalid_bge_m3_batch");
  return body.embeddings.map(vector => {
    if (vector?.length !== 1024 || vector.some(x => !Number.isFinite(x))) throw new Error("invalid_bge_m3_embedding");
    const norm = Math.hypot(...vector) || 1;
    return vector.map(x => x / norm);
  });
}
export async function strictEmbed(text: string): Promise<number[]> {
  return (await strictEmbedBatch([text]))[0]!;
}
export class HistoryIndex {
  private db = new Database(":memory:");
  private vectors: number[][] = [];
  private deleted = new Set<string>();
  private revoked = new Set<string>();
  constructor(private events: PersonalMemoryEvent[], private embed = strictEmbed) {
    this.db.exec("CREATE VIRTUAL TABLE raw_fts USING fts5(body)");
    const insert = this.db.prepare("INSERT INTO raw_fts(rowid,body) VALUES (?,?)");
    this.db.transaction(() => events.forEach((e, i) => insert.run(i + 1, e.text)))();
  }
  async prepare(cacheDir: string) {
    await mkdir(cacheDir, { recursive: true });
    for (let offset = 0; offset < this.events.length; offset += 32) {
      const batch = this.events.slice(offset, offset + 32);
      const missing: Array<{ index: number; path: string; text: string }> = [];
      for (const [j, event] of batch.entries()) {
        const hash = createHash("sha256").update(`bge-m3:1024:v1:${event.text}`).digest("hex");
        const path = join(cacheDir, `${hash}.json`);
        try {
          const vector = JSON.parse(await readFile(path, "utf8")) as number[];
          if (vector.length !== 1024 || vector.some(x => !Number.isFinite(x))) throw new Error("invalid_cached_embedding");
          this.vectors[offset + j] = vector;
        } catch { missing.push({ index: offset + j, path, text: event.text }); }
      }
      if (missing.length) {
        const vectors = this.embed === strictEmbed ? await strictEmbedBatch(missing.map(x => x.text)) : await Promise.all(missing.map(x => this.embed(x.text)));
        for (const [j, item] of missing.entries()) {
          this.vectors[item.index] = vectors[j]!;
          await writeFile(item.path, JSON.stringify(vectors[j]));
        }
      }
      if (offset % 256 === 0 || offset + 32 >= this.events.length) console.log(JSON.stringify({ event: "history_index", done: Math.min(offset + 32, this.events.length), total: this.events.length }));
    }
  }

  async recall(query: RecallQuery, asOf: string, hours = 8): Promise<RecallHit[]> {
    const cutoff = Date.parse(asOf) - hours * 3600_000;
    const allowed = (i: number) => {
      const e = this.events[i]!;
      return !this.deleted.has(e.event_id) && !this.revoked.has(e.scope) && Date.parse(e.observed_at) <= cutoff && e.scope === query.scope && e.acl.scope === query.scope;
    };
    const scores = new Map<number, number>();
    const add = (ids: number[]) => ids.forEach((i, rank) => scores.set(i, (scores.get(i) ?? 0) + 1 / (60 + rank + 1)));
    const tokens = terms(query.text);
    if (tokens.length) {
      const rows = this.db.prepare("SELECT rowid FROM raw_fts WHERE raw_fts MATCH ? ORDER BY rank").all(tokens.map(t => `"${t.replaceAll('"', '""')}"`).join(" OR ")) as { rowid: number }[];
      add(rows.map(r => r.rowid - 1).filter(allowed).slice(0, 100));
    }
    const q = await this.embed(query.text || " ");
    add(this.events.map((_, i) => i).filter(allowed).map(i => ({ i, score: this.vectors[i]!.reduce((s, v, j) => s + v * q[j]!, 0) }))
      .sort((a, b) => b.score - a.score).slice(0, 100).map(x => x.i));
    return [...scores].sort((a, b) => b[1] - a[1]).slice(0, HISTORY_TOP_K).map(([i]) => {
      const e = this.events[i]!;
      return { event_id: e.event_id, text: e.text, observed_at: e.observed_at, scope: e.scope };
    });
  }
  delete(id: string) { this.deleted.add(id); }
  revoke(scope: string) { this.revoked.add(scope); }
  close() { this.db.close(); }
}
