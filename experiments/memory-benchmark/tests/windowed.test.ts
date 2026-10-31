import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { HistoryIndex, recentEvents, limitHits } from "../src/windowed/history.js";
import { budgetBlockReason } from "../src/cost/budget-guard.js";
import { attachHistory } from "../src/windowed/adapter.js";
import type { PersonalMemoryEvent, MemoryBenchmarkAdapter } from "../src/types.js";
const event = (id: string, time: string, scope = "s") => ({ event_id: id, text: `deadline ${id}`, observed_at: time, occurred_at: time, scope, acl: { scope, trust_class: null } } as PersonalMemoryEvent);
const embed = async () => [1, ...Array(1023).fill(0)];
describe("8h incremental strategy boundaries", () => {
  it("excludes future events and keeps exact T-8h in history", async () => {
    const events = [event("old", "2026-01-01T00:00:00Z"), event("boundary", "2026-01-01T04:00:00Z"), event("recent", "2026-01-01T05:00:00Z"), event("future", "2026-01-01T13:00:00Z"), event("private", "2026-01-01T00:00:00Z", "private")];
    expect(recentEvents(events, "2026-01-01T12:00:00Z").map(e=>e.event_id)).toEqual(["recent"]);
    const index = new HistoryIndex(events, embed);
    await index.prepare(mkdtempSync(join(tmpdir(), "e155-history-")));
    const hits = await index.recall({ text: "deadline", scope: "s" }, "2026-01-01T12:00:00Z");
    expect(new Set(hits.map(h=>h.event_id))).toEqual(new Set(["old", "boundary"]));
    index.delete("old");
    expect((await index.recall({text:"deadline",scope:"s"},"2026-01-01T12:00:00Z")).map(h=>h.event_id)).toEqual(["boundary"]);
    index.revoke("s");
    expect(await index.recall({text:"deadline",scope:"s"},"2026-01-01T12:00:00Z")).toEqual([]);
    index.close();
  });
  it("bounds multibyte context and deduplicates before counting top-k", () => {
    const r = limitHits([{event_id:"a",text:"中文"}, {event_id:"a",text:"中文"}, {event_id:"b",text:"hi"}], 20, 7);
    expect(r.hits.map(h=>h.event_id)).toEqual(["a"]); expect(r.bytes).toBe(6); expect(r.truncated).toBe(1);
  });
  it("passes history into native decide recall and rolls B decision state back", async () => {
    const sql: string[] = [];
    const runtime = { db: { exec: (s: string) => sql.push(s) }, recall: async () => ({ hits: [], latency_ms: 0 }) };
    const adapter = { schemeId: "B", init: async () => {}, runtime, delete: async () => {}, revoke: async () => {} } as unknown as MemoryBenchmarkAdapter;
    adapter.decide = async input => {
      const r = await (runtime.recall as MemoryBenchmarkAdapter["recall"])({text:"deadline",scope:"s"},input.as_of,"s");
      return {action:"show_sidecar",output_text:r.hits.map(h=>h.text).join(),cited_event_ids:[],latency_ms:0};
    };
    const history = { recall: async () => [{event_id:"old",text:"retained evidence",scope:"s"}] } as unknown as HistoryIndex;
    await attachHistory(adapter, history);
    const result = await adapter.decide({ scene:"message_sidecar",as_of:"2026-01-01T12:00:00Z",scope:"s",context:{text:"deadline"} });
    expect(result.output_text).toBe("retained evidence"); expect(sql).toEqual(["SAVEPOINT paired_probe", "ROLLBACK TO paired_probe; RELEASE paired_probe"]);
  });
  it("includes prior failures in budget and fails closed on missing policy", () => {
    const root = mkdtempSync(join(tmpdir(),"e155-budget-")), dir = join(root,"ledger"); mkdirSync(dir);
    const policy = join(root,"policy.json"); writeFileSync(policy,JSON.stringify({ledger_dir:dir,total_ceiling_usd:100,scheme_ceilings_usd:{A:49}}));
    writeFileSync(join(dir,"old-failed.jsonl"),JSON.stringify({scheme_id:"A",cost_usd:49})+"\n");
    expect(budgetBlockReason(policy,"A")).toBe("scheme_proxy_budget_exceeded");
    expect(budgetBlockReason(policy,"B")).toBe("invalid_budget_policy");
    expect(budgetBlockReason(join(root,"missing"),"A")).toBe("budget_policy_unreadable");
  });
});
