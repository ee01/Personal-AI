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
import { SupermemoryClient } from "./client.js";
import {
  bumpAclEpoch,
  getMeta,
  openRegistryDb,
  parseRevokedScopes,
  saveRevokedScopes,
} from "./registry-db.js";

export const SUPERMEMORY_SPEC_VERSION = "D-supermemory-local-1";

export interface SupermemoryRuntimeOptions {
  dbPath: string;
  runKey: string;
  client?: SupermemoryClient;
  costLedger?: SharedCostLedger;
}

export function namespaceForScope(runKey: string, scope: string): string {
  const safe = (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 36);
  return `bm-d-${safe(runKey)}-${safe(scope)}`.slice(0, 100);
}

export function documentIdForEvent(eventId: string): string {
  const sanitized = eventId.replace(/[^a-zA-Z0-9_-]/g, "_");
  if (sanitized.length <= 100) return sanitized;
  const h = contentHash(eventId, "", eventId).slice(0, 16);
  return `${sanitized.slice(0, 80)}_${h}`;
}

export class SupermemoryRuntime {
  readonly schemeId = "D";
  private db: Database.Database;
  private client: SupermemoryClient;
  private runKey: string;
  private models = loadModelsConfig();
  private ledger: SharedCostLedger;
  private recallCache = new Map<string, RecallResult>();
  private derivedSnippets: string[] = [];
  private inFlightConsolidation: string | null = null;
  private deletedEvents = new Set<string>();
  private clockAudit: Array<{ op: string; group: "virtual_harness" | "native_supermemory_api" }> =
    [];

  constructor(opts: SupermemoryRuntimeOptions) {
    this.db = openRegistryDb(opts.dbPath);
    this.runKey = opts.runKey;
    this.client = opts.client ?? new SupermemoryClient();
    this.ledger =
      opts.costLedger ??
      new InMemoryCostLedger(Number(process.env.MEMORY_B_SCHEME_BUDGET_USD ?? 50));
  }

  close(): void {
    this.db.close();
  }

  ns(scope: string): string {
    return namespaceForScope(this.runKey, scope);
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
    const docId = documentIdForEvent(event.event_id);
    const ns = this.ns(event.scope);

    const existing = this.db
      .prepare(
        `SELECT content_hash, sm_document_id FROM evidence_events
         WHERE event_id=? AND source_version=? AND tombstone=0`,
      )
      .get(event.event_id, sourceVersion) as
      | { content_hash: string; sm_document_id: string }
      | undefined;

    if (existing) {
      if (existing.content_hash === hash) return;
      throw new VersionConflictError(event.event_id);
    }

    const metadata = {
      benchmark_event_id: event.event_id,
      scope: event.scope,
      observed_at: event.observed_at,
      source_version: sourceVersion,
      source: event.source,
      source_type: event.source_type,
    };

    const t0 = performance.now();
    const prior = this.db
      .prepare("SELECT sm_document_id FROM evidence_events WHERE event_id=? AND tombstone=0 LIMIT 1")
      .get(event.event_id) as { sm_document_id: string } | undefined;

    if (prior?.sm_document_id) {
      await this.client.patchDocument(ns, docId, event.text, metadata);
      this.clockAudit.push({ op: `sm.patch:${event.event_id}`, group: "native_supermemory_api" });
    } else {
      await this.client.addDocument(ns, docId, event.text, metadata);
      this.clockAudit.push({ op: `sm.add:${event.event_id}`, group: "native_supermemory_api" });
    }
    await this.client.waitDocumentDone(ns, docId);
    const nativeMs = performance.now() - t0;
    this.derivedSnippets.push(`ingest:native_ms=${nativeMs.toFixed(1)}:${event.event_id}`);

    this.db
      .prepare(
        `INSERT INTO evidence_events (
        event_id, source_version, scope, body, content_hash, observed_at_ms,
        tombstone, unconsolidated, sm_document_id, sm_namespace
      ) VALUES (?,?,?,?,?,?,0,1,?,?)
      ON CONFLICT(event_id, source_version) DO UPDATE SET
        body=excluded.body,
        content_hash=excluded.content_hash,
        sm_document_id=excluded.sm_document_id,
        sm_namespace=excluded.sm_namespace`,
      )
      .run(
        event.event_id,
        sourceVersion,
        event.scope,
        event.text,
        hash,
        obsMs,
        docId,
        ns,
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
    for (const row of batch) {
      if (parseRevokedScopes(this.db).has(row.scope)) continue;
      lines.push(`- [${row.event_id}] ${row.body.slice(0, 400)}`);
    }

    if (lines.length > 0) {
      const digest = await openRouterChat(
        { ...this.models, scheme_id: "D" },
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

    const nativeT0 = performance.now();
    const raw = await this.client.search(this.ns(scope), query.text, 8, 0);
    const nativeMs = performance.now() - nativeT0;
    this.clockAudit.push({ op: `sm.search:${nativeMs.toFixed(0)}ms`, group: "native_supermemory_api" });

    const hits: RecallResult["hits"] = [];
    const seenEvents = new Set<string>();
    for (const item of raw.results ?? []) {
      let eventId = item.metadata?.benchmark_event_id as string | undefined;
      if (!eventId && item.docId) {
        const mapped = this.db
          .prepare("SELECT event_id FROM evidence_events WHERE sm_document_id=? AND tombstone=0")
          .get(item.docId) as { event_id: string } | undefined;
        eventId = mapped?.event_id;
      }
      if (!eventId && item.id) {
        const mapped = this.db
          .prepare("SELECT event_id FROM evidence_events WHERE sm_document_id=? AND tombstone=0")
          .get(item.id) as { event_id: string } | undefined;
        eventId = mapped?.event_id;
      }
      if (!eventId || seenEvents.has(eventId) || this.deletedEvents.has(eventId)) continue;

      const row = this.db
        .prepare(
          `SELECT event_id, body, observed_at_ms, scope FROM evidence_events
           WHERE event_id=? AND scope=? AND tombstone=0`,
        )
        .get(eventId, scope) as
        | { event_id: string; body: string; observed_at_ms: number; scope: string }
        | undefined;
      if (!row) continue;
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
      seenEvents.add(eventId);
      hits.push({
        event_id: row.event_id,
        text: row.body,
        observed_at: observedAt,
        scope: row.scope,
      });
      if (hits.length >= 5) break;
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
    return {
      schema: "supermemory-local-harness-export-v1",
      spec_version: SUPERMEMORY_SPEC_VERSION,
      scheme_id: "D",
      supermemory_server: "0.0.9",
      supermemory_docs_commit: "a619e2727d9118607cde5cc1a407d84f223ff022",
      models: { ...this.models, scheme_id: "D" },
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
      capability_notes: {
        supermemory_dreaming: "server-side optional; harness uses main-tier day digest only",
        url_ingestion: false,
        hosted_reader: false,
      },
      cost_ledger: this.ledger.snapshot(),
    };
  }

  async delete(eventId: string): Promise<void> {
    bumpAclEpoch(this.db);
    this.deletedEvents.add(eventId);
    const row = this.db
      .prepare(
        "SELECT sm_document_id, sm_namespace, scope FROM evidence_events WHERE event_id=? AND tombstone=0",
      )
      .get(eventId) as { sm_document_id: string; sm_namespace: string; scope: string } | undefined;
    if (row?.sm_document_id && row.sm_namespace) {
      try {
        await this.client.deleteDocuments(row.sm_namespace, [row.sm_document_id]);
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

    const rows = this.db
      .prepare(
        "SELECT DISTINCT sm_document_id, sm_namespace FROM evidence_events WHERE scope=? AND tombstone=0 AND sm_document_id != ''",
      )
      .all(scope) as Array<{ sm_document_id: string; sm_namespace: string }>;

    const byNs = new Map<string, string[]>();
    for (const row of rows) {
      const list = byNs.get(row.sm_namespace) ?? [];
      list.push(row.sm_document_id);
      byNs.set(row.sm_namespace, list);
    }
    for (const [ns, ids] of byNs) {
      try {
        await this.client.deleteDocuments(ns, ids);
      } catch {
        /* best effort */
      }
    }
    this.db
      .prepare("UPDATE evidence_events SET tombstone=1 WHERE scope=? AND tombstone=0")
      .run(scope);
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
