import type Database from "better-sqlite3";
import type {
  ConsolidateResult,
  DecideInput,
  DecideResult,
  PersonalMemoryEvent,
  RecallQuery,
  RecallResult,
  SceneInput,
} from "../../src/types.js";
import { isVisibleAt, parseVirtualMs, virtualDayKey } from "../../src/clock/virtual-time.js";
import {
  observedMs,
  resolveSourceVersion,
  validateIngestEnvelope,
  VersionConflictError,
} from "../new-core/envelope.js";
import { contentHash } from "../new-core/hash.js";
import { loadModelsConfig } from "../new-core/config.js";
import { InMemoryCostLedger, openRouterChat, type SharedCostLedger } from "../new-core/llm.js";
import { LettaAppClient } from "./client.js";
import {
  bumpAclEpoch,
  getMeta,
  openRegistryDb,
  parseRevokedScopes,
  saveRevokedScopes,
  setMeta,
} from "./registry-db.js";

export const LETTA_SPEC_VERSION = "E-letta-app-server-1";
export const LETTA_PACKAGE_VERSION = "0.34.33";
export const LETTA_COMMIT = "ebc496e532f1a34da9ac8d7e2da41c5920ea77e6";

export interface LettaRuntimeOptions {
  dbPath: string;
  runKey: string;
  client?: LettaAppClient;
  costLedger?: SharedCostLedger;
}

export function memfsPathForEvent(eventId: string): string {
  const sanitized = eventId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const base = sanitized.length <= 80 ? sanitized : `${sanitized.slice(0, 64)}_${contentHash(eventId, "", eventId).slice(0, 12)}`;
  return `benchmark/ev/${base}.md`;
}

export function agentMetaKey(scope: string): string {
  return `letta_agent:${scope}`;
}

export function conversationMetaKey(scope: string): string {
  return `letta_conversation:${scope}`;
}

function memfsDocumentBody(
  event: PersonalMemoryEvent,
  sourceVersion: string,
  body: string,
): string {
  const safeName = event.event_id.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 48);
  return `---
name: ${safeName}
description: Personal memory benchmark evidence
---

benchmark_event_id: ${event.event_id}
source_version: ${sourceVersion}
observed_at: ${event.observed_at}
scope: ${event.scope}

${body}`;
}

export class LettaRuntime {
  readonly schemeId = "E";
  private db: Database.Database;
  private client: LettaAppClient;
  private runKey: string;
  private models = loadModelsConfig();
  private ledger: SharedCostLedger;
  private recallCache = new Map<string, RecallResult>();
  private derivedSnippets: string[] = [];
  private dreamAudit: Array<{
    virtual_day: string;
    ok: boolean;
    output: string;
    at: string;
  }> = [];
  private inFlightConsolidation: string | null = null;
  private deletedEvents = new Set<string>();
  private agentsCreated = new Set<string>();
  private clockAudit: Array<{ op: string; group: "virtual_harness" | "native_letta_api" }> = [];

  constructor(opts: LettaRuntimeOptions) {
    this.db = openRegistryDb(opts.dbPath);
    this.runKey = opts.runKey;
    this.client = opts.client ?? new LettaAppClient();
    this.ledger =
      opts.costLedger ??
      new InMemoryCostLedger(Number(process.env.MEMORY_B_SCHEME_BUDGET_USD ?? 50));
  }

  close(): void {
    for (const agentId of this.agentsCreated) {
      void this.client.deleteAgent(agentId);
    }
    this.client.close();
    this.db.close();
  }

  private agentModel(): string {
    return `openrouter/${this.models.main.model}`;
  }

  private async ensureMemfsLayout(agentId: string): Promise<void> {
    const key = `memfs_boot:${agentId}`;
    if (getMeta(this.db, key) === "1") return;
    const indexes: Array<{ path: string; content: string }> = [
      {
        path: "MEMORY.md",
        content: "# Personal memory benchmark\n\n- [benchmark](./benchmark/MEMORY.md)\n",
      },
      {
        path: "benchmark/MEMORY.md",
        content:
          "# Benchmark partition\n\n- [evidence events](./ev/MEMORY.md)\n- [consolidations](./consolidation/MEMORY.md)\n",
      },
      {
        path: "benchmark/consolidation/MEMORY.md",
        content: "# Harness daily digests\n\nWritten by virtual-day consolidate().\n",
      },
      {
        path: "benchmark/ev/MEMORY.md",
        content: "# Ingested evidence\n\nOne file per harness event_id.\n",
      },
    ];
    for (const idx of indexes) {
      await this.client.writeMemoryFile(agentId, idx.path, idx.content, "bootstrap memfs indexes");
      this.clockAudit.push({ op: `memfs.bootstrap:${idx.path}`, group: "native_letta_api" });
    }
    setMeta(this.db, key, "1");
  }

  private async ensureAgent(scope: string): Promise<string> {
    const key = agentMetaKey(scope);
    const existing = getMeta(this.db, key);
    if (existing) return existing;

    const agentId = await this.client.createBenchmarkAgent(
      this.agentModel(),
      `${this.runKey}-${scope}`.slice(0, 64),
    );
    this.agentsCreated.add(agentId);
    setMeta(this.db, key, agentId);
    setMeta(this.db, conversationMetaKey(scope), `benchmark-${this.runKey}-${scope}`.slice(0, 80));
    this.clockAudit.push({ op: `create_agent:${scope}`, group: "native_letta_api" });
    await this.ensureMemfsLayout(agentId);
    return agentId;
  }

  private cacheKey(query: RecallQuery, asOf: string, scope: string): string {
    return `${scope}|${asOf}|${query.text}|${getMeta(this.db, "acl_epoch")}`;
  }

  async ingest(event: PersonalMemoryEvent): Promise<void> {
    validateIngestEnvelope(event);
    if (this.deletedEvents.has(event.event_id)) return;
    if (parseRevokedScopes(this.db).has(event.scope)) return;

    const sourceVersion = resolveSourceVersion(event);
    const hash = contentHash(event.text, event.source, event.event_id);
    const obsMs = observedMs(event);
    const memPath = memfsPathForEvent(event.event_id);
    const agentId = await this.ensureAgent(event.scope);

    const existing = this.db
      .prepare(
        `SELECT content_hash, memfs_path FROM evidence_events
         WHERE event_id=? AND source_version=? AND tombstone=0`,
      )
      .get(event.event_id, sourceVersion) as
      | { content_hash: string; memfs_path: string }
      | undefined;

    if (existing) {
      if (existing.content_hash === hash) return;
      throw new VersionConflictError(event.event_id);
    }

    const doc = memfsDocumentBody(event, sourceVersion, event.text);
    const t0 = performance.now();
    await this.client.writeMemoryFile(
      agentId,
      memPath,
      doc,
      `ingest ${event.event_id}@${sourceVersion}`,
    );
    const nativeMs = performance.now() - t0;
    this.clockAudit.push({ op: `memfs.write:${event.event_id}`, group: "native_letta_api" });
    this.derivedSnippets.push(`ingest:native_ms=${nativeMs.toFixed(1)}:${event.event_id}`);

    this.db
      .prepare(
        `INSERT INTO evidence_events (
        event_id, source_version, scope, body, content_hash, observed_at_ms,
        tombstone, unconsolidated, memfs_path, letta_agent_id
      ) VALUES (?,?,?,?,?,?,0,1,?,?)
      ON CONFLICT(event_id, source_version) DO UPDATE SET
        body=excluded.body,
        content_hash=excluded.content_hash,
        memfs_path=excluded.memfs_path,
        letta_agent_id=excluded.letta_agent_id`,
      )
      .run(
        event.event_id,
        sourceVersion,
        event.scope,
        event.text,
        hash,
        obsMs,
        memPath,
        agentId,
      );
  }

  async consolidate(virtualNow: string): Promise<ConsolidateResult> {
    const t0 = performance.now();
    const day = virtualDayKey(virtualNow);
    const atMs = parseVirtualMs(virtualNow);
    this.clockAudit.push({ op: `consolidate:${day}`, group: "virtual_harness" });

    const done = this.db.prepare("SELECT 1 FROM consolidation_days WHERE virtual_day = ?").get(day);
    if (done) {
      return { virtual_day: day, latency_ms: performance.now() - t0, cached_replay: true };
    }

    this.inFlightConsolidation = day;
    const batch = this.db
      .prepare(
        `SELECT event_id, body, scope FROM evidence_events
         WHERE tombstone=0 AND unconsolidated=1 AND observed_at_ms <= ?
         ORDER BY observed_at_ms`,
      )
      .all(atMs) as Array<{ event_id: string; body: string; scope: string }>;

    const lines: string[] = [];
    const scopes = new Set<string>();
    for (const row of batch) {
      if (parseRevokedScopes(this.db).has(row.scope)) continue;
      scopes.add(row.scope);
      lines.push(`- [${row.event_id}] ${row.body.slice(0, 400)}`);
    }

    if (lines.length > 0) {
      const digest = await openRouterChat(
        { ...this.models, scheme_id: "E" },
        "main",
        "Summarize cross-event themes for benchmark harness consolidation. JSON only: {\"themes\": string[]}",
        lines.join("\n"),
        this.ledger,
        "harness_consolidate",
        virtualNow,
      );
      if (digest) {
        this.derivedSnippets.push(`harness_consolidation:${day}:${digest.slice(0, 500)}`);
      } else {
        this.derivedSnippets.push(`harness_consolidation:${day}:heuristic`);
      }

      for (const scope of scopes) {
        const agentId = await this.ensureAgent(scope);
        const digestPath = `benchmark/consolidation/${day.replace(/[^0-9-]/g, "")}.md`;
        const content = memfsDocumentBody(
          {
            ...({} as PersonalMemoryEvent),
            event_id: `consolidation:${day}`,
            observed_at: virtualNow,
            scope,
            text: digest ?? lines.join("\n").slice(0, 2000),
            source: "harness",
            source_type: "consolidation",
            occurred_at: virtualNow,
            group_id: null,
            thread_root: null,
            sender: null,
            metadata: {},
            acl: { scope, trust_class: null },
            provenance: { harness: true },
          },
          `day-${day}`,
          digest ?? lines.join("\n").slice(0, 2000),
        );
        await this.client.writeMemoryFile(
          agentId,
          digestPath,
          content,
          `harness consolidation ${day}`,
        );
        this.clockAudit.push({ op: `memfs.consolidation:${day}`, group: "native_letta_api" });
      }
    }

    for (const scope of [...new Set(batch.map((r) => r.scope))]) {
      if (parseRevokedScopes(this.db).has(scope)) continue;
      const agentId = await this.ensureAgent(scope);
      const conversationId = getMeta(this.db, conversationMetaKey(scope)) || agentId;
      const dream = await this.client.tryDream(agentId, conversationId);
      this.clockAudit.push({ op: `letta.dream:${day}:${scope}`, group: "native_letta_api" });
      this.dreamAudit.push({
        virtual_day: day,
        ok: dream.ok,
        output: dream.output.slice(0, 500),
        at: new Date().toISOString(),
      });
      this.derivedSnippets.push(
        `letta_dream:${day}:${scope}:${dream.ok ? "ok" : "fail"}:${dream.output.slice(0, 120)}`,
      );
    }

    for (const row of batch) {
      this.db
        .prepare("UPDATE evidence_events SET unconsolidated=0 WHERE event_id=?")
        .run(row.event_id);
      this.derivedSnippets.push(`derived:${row.event_id}`);
    }

    this.db
      .prepare("INSERT INTO consolidation_days (virtual_day, completed_at_ms) VALUES (?,?)")
      .run(day, atMs);
    this.inFlightConsolidation = null;
    this.recallCache.clear();
    return { virtual_day: day, latency_ms: performance.now() - t0, cached_replay: false };
  }

  async recall(query: RecallQuery, asOf: string, scope: string): Promise<RecallResult> {
    const t0 = performance.now();
    this.clockAudit.push({ op: "recall", group: "virtual_harness" });
    if (query.scope !== scope || parseRevokedScopes(this.db).has(scope)) {
      return { hits: [], latency_ms: performance.now() - t0, cached_replay: false };
    }

    const key = this.cacheKey(query, asOf, scope);
    const cached = this.recallCache.get(key);
    if (cached) {
      return { ...cached, latency_ms: performance.now() - t0, cached_replay: true };
    }

    const agentId = getMeta(this.db, agentMetaKey(scope));
    if (!agentId) {
      return { hits: [], latency_ms: performance.now() - t0, cached_replay: false };
    }

    const nativeT0 = performance.now();
    const entries = await this.client.listMemory(agentId);
    const nativeMs = performance.now() - nativeT0;
    this.clockAudit.push({ op: `memfs.list:${nativeMs.toFixed(0)}ms`, group: "native_letta_api" });

    const rows = this.db
      .prepare(
        `SELECT event_id, body, observed_at_ms, scope, memfs_path FROM evidence_events
         WHERE scope=? AND tombstone=0`,
      )
      .all(scope) as Array<{
      event_id: string;
      body: string;
      observed_at_ms: number;
      scope: string;
      memfs_path: string;
    }>;

    const pathToRow = new Map(rows.map((r) => [r.memfs_path, r]));
    const queryTokens = tokenize(query.text);
    const hits: RecallResult["hits"] = [];
    const seenEvents = new Set<string>();

    const candidates: Array<{ score: number; row: (typeof rows)[0] }> = [];
    for (const entry of entries) {
      if (!entry.relative_path.startsWith("benchmark/ev/")) continue;
      const row = pathToRow.get(entry.relative_path);
      if (!row || seenEvents.has(row.event_id) || this.deletedEvents.has(row.event_id)) continue;
      const observedAt = new Date(row.observed_at_ms).toISOString();
      const pseudo: PersonalMemoryEvent = {
        ...({} as PersonalMemoryEvent),
        event_id: row.event_id,
        observed_at: observedAt,
        scope: row.scope,
        text: row.body,
        source: "",
        source_type: "",
        occurred_at: observedAt,
        group_id: null,
        thread_root: null,
        sender: null,
        metadata: {},
        acl: { scope: row.scope, trust_class: null },
        provenance: {},
      };
      if (!isVisibleAt(pseudo, asOf)) continue;
      const score = scoreOverlap(queryTokens, `${row.body} ${entry.content}`);
      if (score > 0) candidates.push({ score, row });
    }

    candidates.sort((a, b) => b.score - a.score);
    for (const c of candidates) {
      if (hits.length >= 5) break;
      seenEvents.add(c.row.event_id);
      hits.push({
        event_id: c.row.event_id,
        text: c.row.body,
        observed_at: new Date(c.row.observed_at_ms).toISOString(),
        scope: c.row.scope,
      });
    }

    const result: RecallResult = {
      hits,
      latency_ms: performance.now() - t0,
      cached_replay: false,
    };
    this.recallCache.set(key, result);
    for (const h of hits) {
      if (h.event_id) this.derivedSnippets.push(`derived:${h.event_id}`);
    }
    return result;
  }

  async decide(input: DecideInput): Promise<DecideResult> {
    const t0 = performance.now();
    if (!whitelistScene(input.context) || parseRevokedScopes(this.db).has(input.scope)) {
      return silence(t0);
    }
    const sceneText = (input.context.text ?? "").trim();
    if (!sceneText) return silence(t0);

    if (input.scene === "message_sidecar") {
      const sideTokens = sceneText.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
      const commitmentCue = sideTokens.some((t) =>
        ["ship", "harness", "friday", "confirm", "deadline", "review", "draft"].includes(t),
      );
      if (!commitmentCue) return silence(t0);
    }

    const recallQuery = input.context.recall_query ?? sceneText;
    const recall = await this.recall(
      { text: recallQuery, scope: input.scope },
      input.as_of,
      input.scope,
    );
    if (recall.hits.length === 0) return silence(t0);

    const ranked = rankHits(recall.hits, sceneText);
    if (ranked.score === 0) return silence(t0);

    const action =
      input.scene === "proactive_discovery" ? "send_notification" : "show_sidecar";
    return {
      action,
      output_text: ranked.pick.text,
      cited_event_ids: ranked.pick.event_id ? [ranked.pick.event_id] : [],
      latency_ms: performance.now() - t0,
    };
  }

  async export(): Promise<Record<string, unknown>> {
    const recallCacheEventIds = [
      ...new Set(
        [...this.recallCache.values()].flatMap((r) =>
          r.hits.map((h) => h.event_id).filter((id): id is string => Boolean(id)),
        ),
      ),
    ];
    const harnessMain = this.ledger
      .snapshot()
      .filter((r) => r.label.startsWith("harness_"));
    const dreamRelated = this.ledger.snapshot().filter((r) => r.label.includes("dream"));
    return {
      schema: "letta-app-server-harness-export-v1",
      spec_version: LETTA_SPEC_VERSION,
      scheme_id: "E",
      letta_code_version: LETTA_PACKAGE_VERSION,
      letta_commit: LETTA_COMMIT,
      models: { ...this.models, scheme_id: "E" },
      run_key: this.runKey,
      evidence_events: this.db.prepare("SELECT * FROM evidence_events WHERE tombstone=0").all(),
      consolidation_days: this.db.prepare("SELECT * FROM consolidation_days").all(),
      revoked_scopes: [...parseRevokedScopes(this.db)],
      deleted_event_ids: [...this.deletedEvents],
      recall_cache_keys: [...this.recallCache.keys()],
      recall_cache_event_ids: recallCacheEventIds,
      derived_snippets: [...this.derivedSnippets],
      in_flight_consolidation: this.inFlightConsolidation,
      clock_audit: this.clockAudit,
      dream_audit: this.dreamAudit,
      capability_notes: {
        memfs_editable_memory: true,
        persistent_agent_identity: true,
        letta_dream_execute_command: true,
        harness_virtual_observed_at: true,
        memfs_semantic_search: false,
        strict_temporal_facts_native: false,
        high_frequency_ingest: "direct MemFS write per event (wall-clock commit)",
      },
      cost_ledger: this.ledger.snapshot(),
      cost_ledger_harness_main: harnessMain,
      cost_ledger_letta_dream: dreamRelated,
    };
  }

  async delete(eventId: string): Promise<void> {
    bumpAclEpoch(this.db);
    this.deletedEvents.add(eventId);
    const row = this.db
      .prepare(
        "SELECT memfs_path, letta_agent_id FROM evidence_events WHERE event_id=? AND tombstone=0",
      )
      .get(eventId) as { memfs_path: string; letta_agent_id: string } | undefined;
    if (row?.memfs_path && row.letta_agent_id) {
      try {
        await this.client.deleteMemoryFile(row.letta_agent_id, row.memfs_path);
        this.clockAudit.push({ op: `memfs.delete:${eventId}`, group: "native_letta_api" });
      } catch {
        /* best effort */
      }
      this.db.prepare("UPDATE evidence_events SET tombstone=1 WHERE event_id=?").run(eventId);
    }
    this.purgeDerivedForEvent(eventId);
    this.recallCache.clear();
  }

  async revoke(scope: string): Promise<void> {
    bumpAclEpoch(this.db);
    const revoked = parseRevokedScopes(this.db);
    revoked.add(scope);
    saveRevokedScopes(this.db, revoked);

    const agentId = getMeta(this.db, agentMetaKey(scope));
    if (agentId) {
      const rows = this.db
        .prepare("SELECT memfs_path FROM evidence_events WHERE scope=? AND tombstone=0")
        .all(scope) as Array<{ memfs_path: string }>;
      for (const row of rows) {
        if (!row.memfs_path) continue;
        try {
          await this.client.deleteMemoryFile(agentId, row.memfs_path);
        } catch {
          /* best effort */
        }
      }
      await this.client.deleteAgent(agentId);
      this.agentsCreated.delete(agentId);
      setMeta(this.db, agentMetaKey(scope), "");
    }

    this.db.prepare("UPDATE evidence_events SET tombstone=1 WHERE scope=?").run(scope);
    this.purgeScopeFromDerived(scope);
    this.recallCache.clear();
    this.derivedSnippets.push(`revoked:scope:${scope}`);
  }

  private purgeDerivedForEvent(eventId: string): void {
    for (const [key, result] of this.recallCache) {
      if (result.hits.some((h) => h.event_id === eventId)) this.recallCache.delete(key);
    }
    this.derivedSnippets = this.derivedSnippets.filter((s) => !s.includes(eventId));
  }

  private purgeScopeFromDerived(scope: string): void {
    for (const [key, result] of this.recallCache) {
      if (result.hits.some((h) => h.scope === scope)) this.recallCache.delete(key);
    }
    this.derivedSnippets = this.derivedSnippets.filter((s) => !s.includes(`scope:${scope}`));
  }
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s,.;:!?，。；：！？]+/)
    .filter((w) => w.length > 1);
}

function scoreOverlap(queryTokens: string[], haystack: string): number {
  const lower = haystack.toLowerCase();
  return queryTokens.filter((t) => lower.includes(t)).length;
}

function whitelistScene(context: SceneInput): boolean {
  const forbidden = [
    "required_facts",
    "visible_evidence_ids",
    "forbidden_assertions",
    "should_trigger",
  ];
  for (const k of forbidden) {
    if (k in (context as Record<string, unknown>)) return false;
  }
  return true;
}

function rankHits(hits: RecallResult["hits"], sceneText: string) {
  const tokens = sceneText
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2);
  let pick = hits[0]!;
  let score = 0;
  for (const h of hits) {
    const text = h.text.toLowerCase();
    const s = tokens.filter((t) => text.includes(t)).length;
    if (s > score) {
      score = s;
      pick = h;
    }
  }
  return { pick, score };
}

function silence(t0: number): DecideResult {
  return {
    action: "silence",
    output_text: "",
    cited_event_ids: [],
    latency_ms: performance.now() - t0,
  };
}
