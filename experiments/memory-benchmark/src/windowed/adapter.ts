import type { MemoryBenchmarkAdapter, RecallQuery, RecallResult, DecideInput } from "../types.js";
import { HistoryIndex, limitHits } from "./history.js";

// Explicit experiment-only bridge: native decide methods call their inner runtime's recall.
// Fail closed if the adapter shape changes instead of silently leaving history out of decisions.
interface Inner {
  recall: MemoryBenchmarkAdapter["recall"];
  db?: { exec(sql: string): void };
}
export async function attachHistory(adapter: MemoryBenchmarkAdapter, history: HistoryIndex, enabled = true, hours = 8) {
  const bridge = adapter as unknown as { init(): Promise<void>; inner?: Inner; runtime?: Inner };
  await bridge.init();
  const inner = bridge.inner ?? bridge.runtime;
  if (!inner) throw new Error("unsupported_history_bridge");
  const nativeRecall = inner.recall.bind(inner);
  const traces: Record<string, unknown>[] = [];
  inner.recall = async (query: RecallQuery, asOf: string, scope: string): Promise<RecallResult> => {
    const started = performance.now();
    const native = await nativeRecall(query, asOf, scope);
    const old = enabled ? await history.recall({ text: query.text, scope }, asOf, hours) : [];
    // Reciprocal-rank fusion of native recent hits and common historical hybrid hits.
    const ranked = new Map<string, { hit: RecallResult["hits"][number]; score: number }>();
    for (const list of [native.hits, old]) list.forEach((hit, rank) => {
      if (hit.scope && hit.scope !== scope) throw new Error("native_scope_leak");
      if (hit.observed_at && Date.parse(hit.observed_at) > Date.parse(asOf)) throw new Error("native_future_leak");
      const key = hit.event_id ?? hit.text;
      const prior = ranked.get(key);
      ranked.set(key, { hit, score: (prior?.score ?? 0) + 1 / (61 + rank) });
    });
    const bounded = limitHits([...ranked.values()].sort((a, b) => b.score - a.score).map(x => x.hit));
    traces.push({ as_of: asOf, query: query.text, native_ids: native.hits.map(h => h.event_id), native_cached: native.cached_replay ?? false, native_latency_ms: native.latency_ms, history_ids: old.map(h => h.event_id), selected_ids: bounded.hits.map(h => h.event_id), bytes: bounded.bytes, truncated: bounded.truncated });
    return { hits: bounded.hits, latency_ms: performance.now() - started, cached_replay: false };
  };
  const nativeDelete = adapter.delete.bind(adapter), nativeRevoke = adapter.revoke.bind(adapter);
  adapter.delete = async id => { history.delete(id); await nativeDelete(id); };
  adapter.revoke = async scope => { history.revoke(scope); await nativeRevoke(scope); };
  const nativeDecide = adapter.decide.bind(adapter);
  adapter.decide = async (input: DecideInput) => {
    // Only B has durable decision effects today. Restore cooldown/outbox and any
    // incidental SQLite mutations; generated memories are never copied across builds.
    const db = adapter.schemeId === "B" ? inner.db : undefined;
    if (adapter.schemeId === "B" && !db) throw new Error("missing_decision_isolation_db");
    db?.exec("SAVEPOINT paired_probe");
    try { return await nativeDecide(input); }
    finally { db?.exec("ROLLBACK TO paired_probe; RELEASE paired_probe"); }
  };
  return traces;
}
