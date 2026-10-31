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
import { parseVirtualMs } from "../../src/clock/virtual-time.js";
import {
  bumpAclEpoch,
  bumpWatermark,
  getMeta,
  nextIngestSeq,
  openDatabase,
  parseRevokedScopes,
  readWatermarks,
  saveRevokedScopes,
} from "./db.js";
import {
  clearBusinessClock,
  monotonicNowMs,
  setBusinessNowMs,
  virtualDayKey,
} from "./clock.js";
import { loadModelsConfig, SPEC_VERSION } from "./config.js";
import { contentHash } from "./hash.js";
import { cosine, deserializeVector, embedText, embeddingStats } from "./embedding.js";
import {
  cancelOutboxForScope,
  drainPendingJobs,
  enqueueDecisionOutbox,
  enqueueVecEmbedJob,
  listJobs,
  listOutbox,
} from "./jobs.js";
import { defaultLedgerPath, type FileCostLedger } from "./ledger-file.js";
import { NewCoreTruthMaintainer } from "./truth-maintainer.js";
import {
  observedMs,
  occurredMs,
  resolveSourceVersion,
  validateIngestEnvelope,
  VersionConflictError,
} from "./envelope.js";
import { InMemoryCostLedger, openRouterChat, type SharedCostLedger } from "./llm.js";
import { readAblationFromEnv, type AblationMode } from "../../src/ablation/config.js";

const OWNER = "benchmark-owner";
const TENANT = "benchmark-tenant";
const RECENT_WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_KNOWN_TO = 9223372036854775807;

export interface NewCoreRuntimeOptions {
  dbPath: string;
  dataRoot?: string;
  costLedger?: SharedCostLedger;
  ownerId?: string;
  tenantId?: string;
}

interface EvidenceRow {
  event_id: string;
  source_version: string;
  body: string;
  observed_at_ms: number;
  scope: string;
  speaker: string | null;
}

export class NewCoreRuntime {
  readonly schemeId = "B";
  private db: Database.Database;
  private ownerId: string;
  private tenantId: string;
  private ledger: SharedCostLedger;
  private ledgerFilePath: string | null = null;
  private models = loadModelsConfig();
  private ablation: AblationMode = readAblationFromEnv();
  private truth: NewCoreTruthMaintainer;
  private recallCache = new Map<string, RecallResult>();
  private derivedSnippets: string[] = [];
  private inFlightConsolidation: string | null = null;
  private deletedEvents = new Set<string>();
  private decisionTraces: Record<string, unknown>[] = [];

  constructor(opts: NewCoreRuntimeOptions) {
    this.db = openDatabase(opts.dbPath);
    this.ownerId = opts.ownerId ?? OWNER;
    this.tenantId = opts.tenantId ?? TENANT;
    this.ledger =
      opts.costLedger ??
      new InMemoryCostLedger(Number(process.env.MEMORY_B_SCHEME_BUDGET_USD ?? 50));
    if (opts.costLedger && "ledgerPath" in opts.costLedger) {
      this.ledgerFilePath = (opts.costLedger as FileCostLedger).ledgerPath();
    } else if (opts.dataRoot) {
      this.ledgerFilePath = defaultLedgerPath(opts.dataRoot);
    }
    this.truth = new NewCoreTruthMaintainer(this.db);
  }

  close(): void {
    this.db.close();
  }

  private async flushJobs(): Promise<void> {
    await drainPendingJobs(this.db, {
      traceIngestVec: (eventId, latencyMs, atMs) =>
        this.traceIngest("vec_index", eventId, latencyMs, atMs),
    });
  }

  private traceIngest(phase: string, eventId: string | null, latencyMs: number, atMs: number) {
    this.db
      .prepare(
        "INSERT INTO ingest_traces (phase, event_id, latency_ms, at_ms) VALUES (?,?,?,?)",
      )
      .run(phase, eventId, latencyMs, atMs);
  }

  private traceConsolidate(phase: string, day: string | null, latencyMs: number, atMs: number) {
    this.db
      .prepare(
        "INSERT INTO consolidate_traces (phase, virtual_day, latency_ms, at_ms) VALUES (?,?,?,?)",
      )
      .run(phase, day, latencyMs, atMs);
  }

  private traceRecall(queryHash: string, phase: string, latencyMs: number, atMs: number) {
    this.db
      .prepare(
        "INSERT INTO recall_traces (query_hash, phase, latency_ms, at_ms) VALUES (?,?,?,?)",
      )
      .run(queryHash, phase, latencyMs, atMs);
  }

  async ingest(event: PersonalMemoryEvent): Promise<void> {
    const t0 = monotonicNowMs();
    validateIngestEnvelope(event);
    if (this.deletedEvents.has(event.event_id)) return;
    if (parseRevokedScopes(this.db).has(event.scope)) return;

    const sourceVersion = resolveSourceVersion(event);
    const hash = contentHash(event.text, event.source, event.event_id);
    const obsMs = observedMs(event);
    setBusinessNowMs(obsMs);

    const existing = this.db
      .prepare(
        `SELECT content_hash FROM evidence_events
         WHERE owner_id=? AND source=? AND event_id=? AND source_version=? AND tombstone=0`,
      )
      .get(this.ownerId, event.source, event.event_id, sourceVersion) as
      | { content_hash: string }
      | undefined;

    if (existing) {
      if (existing.content_hash === hash) {
        this.traceIngest("noop", event.event_id, monotonicNowMs() - t0, obsMs);
        clearBusinessClock();
        return;
      }
      clearBusinessClock();
      throw new VersionConflictError(event.event_id);
    }

    const ingestSeq = nextIngestSeq(this.db);
    this.db
      .prepare(
        `INSERT INTO evidence_events (
        event_id, source_version, source, source_type, content_hash, body,
        occurred_at_ms, observed_at_ms, ingest_seq, owner_id, tenant_id, scope,
        speaker, acl_scope, tombstone, unconsolidated
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,1)`,
      )
      .run(
        event.event_id,
        sourceVersion,
        event.source,
        event.source_type,
        hash,
        event.text,
        occurredMs(event),
        obsMs,
        ingestSeq,
        this.ownerId,
        this.tenantId,
        event.scope,
        event.sender,
        event.acl.scope,
      );

    this.db
      .prepare(
        "INSERT INTO evidence_fts (event_id, source_version, scope, body) VALUES (?,?,?,?)",
      )
      .run(event.event_id, sourceVersion, event.scope, event.text);

    bumpWatermark(this.db, "ingest", obsMs);
    bumpWatermark(this.db, "raw_index", obsMs);
    this.traceIngest("durable", event.event_id, monotonicNowMs() - t0, obsMs);

    enqueueVecEmbedJob(this.db, {
      event_id: event.event_id,
      source_version: sourceVersion,
      scope: event.scope,
      text: event.text,
      observed_at_ms: obsMs,
    });
    this.traceIngest("vec_queued", event.event_id, monotonicNowMs() - t0, obsMs);
    clearBusinessClock();
  }

  async consolidate(virtualNow: string): Promise<ConsolidateResult> {
    await this.flushJobs();
    const t0 = monotonicNowMs();
    const day = virtualDayKey(virtualNow);
    const atMs = parseVirtualMs(virtualNow);
    setBusinessNowMs(atMs);

    const done = this.db
      .prepare("SELECT 1 FROM consolidation_days WHERE virtual_day = ?")
      .get(day);
    if (done) {
      clearBusinessClock();
      return { virtual_day: day, latency_ms: monotonicNowMs() - t0, cached_replay: true };
    }

    if (this.ablation === "no_background_consolidation") {
      this.db
        .prepare("INSERT INTO consolidation_days (virtual_day, completed_at_ms) VALUES (?,?)")
        .run(day, atMs);
      bumpWatermark(this.db, "consolidated", atMs);
      clearBusinessClock();
      return { virtual_day: day, latency_ms: monotonicNowMs() - t0, cached_replay: true };
    }

    this.inFlightConsolidation = day;
    this.traceConsolidate("start", day, 0, atMs);

    const batch = this.db
      .prepare(
        `SELECT event_id, source_version, body, observed_at_ms, scope, speaker
         FROM evidence_events
         WHERE tombstone=0 AND unconsolidated=1 AND observed_at_ms <= ?
         ORDER BY observed_at_ms, ingest_seq
         LIMIT 100`,
      )
      .all(atMs) as EvidenceRow[];

    let modelCalls = 0;
    for (const row of batch) {
      if (parseRevokedScopes(this.db).has(row.scope)) continue;
      const extracted = await this.extractFacts(row, virtualNow);
      modelCalls += extracted.modelCalls;
      for (const fact of extracted.facts) {
        this.appendFact(fact, row);
      }
      if (extracted.artifact && this.ablation !== "no_link_precalc") {
        this.appendArtifact(extracted.artifact, row);
      }
      this.db
        .prepare(
          "UPDATE evidence_events SET unconsolidated=0 WHERE event_id=? AND source_version=?",
        )
        .run(row.event_id, row.source_version);
      this.derivedSnippets.push(`derived:${row.event_id}`);
    }

    this.db
      .prepare("INSERT INTO consolidation_days (virtual_day, completed_at_ms) VALUES (?,?)")
      .run(day, atMs);
    bumpWatermark(this.db, "consolidated", atMs);
    this.inFlightConsolidation = null;
    this.recallCache.clear();
    this.traceConsolidate("done", day, monotonicNowMs() - t0, atMs);
    this.traceConsolidate(`model_calls:${modelCalls}`, day, 0, atMs);
    clearBusinessClock();
    return { virtual_day: day, latency_ms: monotonicNowMs() - t0, cached_replay: false };
  }

  private async extractFacts(row: EvidenceRow, atVirtual: string) {
    const bodyBytes = Buffer.byteLength(row.body, "utf8");
    const system =
      'Return JSON only matching extraction-contract-v1 with a "candidates" array.';
    const user = `Extract atomic candidates from:\n${row.body}`;
    const raw = await openRouterChat(
      this.models,
      "fast",
      system,
      user,
      this.ledger,
      "consolidate_extract",
      atVirtual,
    );
    let modelCalls = raw ? 1 : 0;
    const facts: Array<{ subject: string; predicate: string; object: string; class: string }> =
      [];

    if (raw) {
      try {
        const { parseJsonFromLlmText } = await import(
          "../../../../memory-service/src/llm/parseLlmJson.js"
        );
        const parsed = parseJsonFromLlmText<unknown>(raw);
        const { parseExtractionBatch } = await import(
          "../../../../memory-service/src/core/v3/ExtractionContract.js"
        );
        const batch = parseExtractionBatch(parsed, bodyBytes);
        if (batch.ok) {
          for (const c of batch.batch.candidates) {
            facts.push({
              subject: c.subjectKey,
              predicate: c.predicateKey,
              object: c.text,
              class: "observation",
            });
          }
        }
      } catch {
        /* heuristic */
      }
    }

    if (facts.length === 0) {
      facts.push(...heuristicFacts(row.body, row.speaker));
    }

    let artifact: { type: string; subject: string; text: string; refs: string[] } | undefined;
    if (this.ablation === "no_link_precalc") {
      return { facts, artifact: undefined, modelCalls };
    }
    const ticket = row.body.match(/\b([A-Z]+-\d+)\b/);
    if (ticket) {
      artifact = {
        type: "change_card",
        subject: ticket[1]!,
        text: row.body.slice(0, 500),
        refs: [row.event_id],
      };
    } else if (/reminder|ship|by friday|deadline|harness/i.test(row.body)) {
      artifact = {
        type: "commitment_card",
        subject: "commitment",
        text: row.body.slice(0, 500),
        refs: [row.event_id],
      };
    }

    if (artifact) {
      const summary = await openRouterChat(
        this.models,
        "main",
        'Return JSON only: {"summary": string}',
        `Summarize for memory card:\n${row.body.slice(0, 800)}`,
        this.ledger,
        "consolidate_card_main",
        atVirtual,
      );
      modelCalls += summary ? 1 : 0;
      if (summary) {
        try {
          const parsed = JSON.parse(summary) as { summary?: string };
          if (parsed.summary) artifact.text = parsed.summary.slice(0, 500);
        } catch {
          /* keep slice */
        }
      }
    }

    return { facts, artifact, modelCalls };
  }

  private appendFact(
    fact: { subject: string; predicate: string; object: string; class: string },
    row: EvidenceRow,
  ): void {
    this.truth.appendFact({
      subject: fact.subject,
      predicate: fact.predicate,
      object: fact.object,
      class: fact.class,
      observedAtMs: row.observed_at_ms,
      scope: row.scope,
      evidenceEventId: row.event_id,
      evidenceSourceVersion: row.source_version,
    });
  }

  private appendArtifact(
    art: { type: string; subject: string; text: string; refs: string[] },
    row: EvidenceRow,
  ): void {
    const artifactId = `${art.type}:${art.subject}`;
    const revRow = this.db
      .prepare("SELECT MAX(revision) AS r FROM artifacts WHERE artifact_id = ?")
      .get(artifactId) as { r: number | null };
    const revision = (revRow.r ?? 0) + 1;
    this.db
      .prepare(
        `INSERT INTO artifacts (
        artifact_id, revision, type, subject, text, observed_at_ms, known_from_ms, known_to_ms,
        scope, status, evidence_refs_json
      ) VALUES (?,?,?,?,?,?,?,?,?,'active',?)`,
      )
      .run(
        artifactId,
        revision,
        art.type,
        art.subject,
        art.text,
        row.observed_at_ms,
        row.observed_at_ms,
        MAX_KNOWN_TO,
        row.scope,
        JSON.stringify(art.refs),
      );
  }

  private cacheKey(query: RecallQuery, asOf: string, scope: string): string {
    return `${scope}|${asOf}|${query.text}|${getMeta(this.db, "acl_epoch")}`;
  }

  async recall(query: RecallQuery, asOf: string, scope: string): Promise<RecallResult> {
    await this.flushJobs();
    const t0 = monotonicNowMs();
    const asMs = parseVirtualMs(asOf);
    if (query.scope !== scope) {
      return { hits: [], latency_ms: monotonicNowMs() - t0 };
    }
    if (parseRevokedScopes(this.db).has(scope)) {
      return { hits: [], latency_ms: monotonicNowMs() - t0, cached_replay: false };
    }

    const key = this.cacheKey(query, asOf, scope);
    const cached = this.recallCache.get(key);
    if (cached) {
      return { ...cached, latency_ms: monotonicNowMs() - t0, cached_replay: true };
    }

    const qHash = key.slice(0, 48);
    const queryVec = await embedText(query.text);

    const ftsHits = this.ftsChannel(query.text, scope, asMs, 40);
    this.traceRecall(qHash, "fts", monotonicNowMs() - t0, asMs);
    const denseHits = this.denseChannel(queryVec, scope, asMs, 40);
    this.traceRecall(qHash, "dense", monotonicNowMs() - t0, asMs);
    const channelLists: string[][] = [ftsHits, denseHits];
    if (this.ablation === "raw_hybrid_only") {
      /* fts + dense only */
    } else if (this.ablation === "no_link_precalc") {
      const recentHits = this.recentChannel(query.text, scope, asMs, 20);
      this.traceRecall(qHash, "recent", monotonicNowMs() - t0, asMs);
      channelLists.push(recentHits);
    } else {
      const recentHits = this.recentChannel(query.text, scope, asMs, 20);
      this.traceRecall(qHash, "recent", monotonicNowMs() - t0, asMs);
      const cardHits = this.cardChannel(query.text, scope, asMs, 32);
      this.traceRecall(qHash, "cards", monotonicNowMs() - t0, asMs);
      channelLists.push(recentHits, cardHits);
    }

    const merged = rrfMerge(channelLists, 5, (id) =>
      this.loadEventForRecall(id, scope, asMs),
    );

    const result: RecallResult = {
      hits: merged,
      latency_ms: monotonicNowMs() - t0,
      cached_replay: false,
    };
    this.recallCache.set(key, result);
    for (const h of merged) {
      if (h.event_id) this.derivedSnippets.push(`derived:${h.event_id}`);
    }
    return result;
  }

  private loadEventForRecall(
    eventId: string,
    scope: string,
    asMs: number,
  ): RecallResult["hits"][0] | null {
    if (this.deletedEvents.has(eventId)) return null;
    const row = this.db
      .prepare(
        `SELECT event_id, body, observed_at_ms, scope FROM evidence_events
         WHERE event_id=? AND scope=? AND tombstone=0 AND observed_at_ms <= ?`,
      )
      .get(eventId, scope, asMs) as
      | { event_id: string; body: string; observed_at_ms: number; scope: string }
      | undefined;
    if (!row) return null;
    return {
      event_id: row.event_id,
      text: row.body,
      observed_at: new Date(row.observed_at_ms).toISOString(),
      scope: row.scope,
    };
  }

  private ftsChannel(text: string, scope: string, asMs: number, limit: number): string[] {
    const tokens = text
      .replace(/[^\p{L}\p{N}\s]+/gu, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2)
      .slice(0, 8);
    if (tokens.length === 0) return [];
    const match = tokens.map((t) => `"${t.replace(/"/g, "")}"`).join(" OR ");
    try {
      const rows = this.db
        .prepare(
          `SELECT e.event_id FROM evidence_fts f
           JOIN evidence_events e ON e.event_id = f.event_id AND e.source_version = f.source_version
           WHERE f MATCH ? AND e.scope = ? AND e.tombstone=0 AND e.observed_at_ms <= ?
           LIMIT ?`,
        )
        .all(match, scope, asMs, limit) as Array<{ event_id: string }>;
      return rows.map((r) => r.event_id);
    } catch {
      return this.recentChannel(text, scope, asMs, limit);
    }
  }

  private denseChannel(
    queryVec: Float32Array,
    scope: string,
    asMs: number,
    limit: number,
  ): string[] {
    const rows = this.db
      .prepare(
        `SELECT v.event_id, v.vec FROM event_vectors v
         JOIN evidence_events e ON e.event_id = v.event_id AND e.source_version = v.source_version
         WHERE v.scope=? AND e.tombstone=0 AND e.observed_at_ms <= ?`,
      )
      .all(scope, asMs) as Array<{ event_id: string; vec: Buffer }>;
    return rows
      .map((r) => ({
        id: r.event_id,
        score: cosine(queryVec, deserializeVector(r.vec)),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((s) => s.id);
  }

  private recentChannel(text: string, scope: string, asMs: number, limit: number): string[] {
    const minMs = asMs - RECENT_WINDOW_MS;
    const token = text.toLowerCase().split(/\s+/).find((w) => w.length > 2) ?? "";
    const rows = this.db
      .prepare(
        `SELECT event_id, body FROM evidence_events
         WHERE scope=? AND tombstone=0 AND observed_at_ms <= ? AND observed_at_ms >= ?
         ORDER BY observed_at_ms DESC LIMIT 200`,
      )
      .all(scope, asMs, minMs) as Array<{ event_id: string; body: string }>;
    return rows
      .filter((r) => token.length === 0 || r.body.toLowerCase().includes(token))
      .slice(0, limit)
      .map((r) => r.event_id);
  }

  private cardChannel(text: string, scope: string, asMs: number, limit: number): string[] {
    const q = text.toLowerCase();
    const rows = this.db
      .prepare(
        `SELECT evidence_refs_json, text FROM artifacts
         WHERE scope=? AND known_from_ms <= ? AND known_to_ms > ? AND status='active'`,
      )
      .all(scope, asMs, asMs) as Array<{ evidence_refs_json: string; text: string }>;
    const ids: string[] = [];
    for (const row of rows) {
      const words = row.text.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
      if (!words.some((w) => q.includes(w)) && !words.some((w) => q.split(/\s+/).includes(w))) {
        continue;
      }
      try {
        const refs = JSON.parse(row.evidence_refs_json) as string[];
        for (const id of refs) {
          if (!ids.includes(id)) ids.push(id);
        }
      } catch {
        /* skip */
      }
      if (ids.length >= limit) break;
    }
    return ids.slice(0, limit);
  }

  async decide(input: DecideInput): Promise<DecideResult> {
    const t0 = monotonicNowMs();
    if (!whitelistScene(input.context)) {
      return silenceResult(t0);
    }
    if (parseRevokedScopes(this.db).has(input.scope)) {
      return silenceResult(t0);
    }

    const sceneText = (input.context.text ?? "").trim();
    if (!sceneText) {
      return silenceResult(t0);
    }

    if (input.scene === "message_sidecar") {
      const sideTokens = sceneText.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
      const commitmentCue = sideTokens.some((t) =>
        ["ship", "harness", "friday", "confirm", "deadline"].includes(t),
      );
      if (!commitmentCue) {
        return silenceResult(t0);
      }
    }

    const recallQuery = input.context.recall_query ?? sceneText;
    const recall = await this.recall(
      { text: recallQuery, scope: input.scope },
      input.as_of,
      input.scope,
    );
    if (recall.hits.length === 0) {
      return silenceResult(t0);
    }

    const ranked = rankHits(recall.hits, sceneText, input.context);
    if (ranked.score === 0) {
      return silenceResult(t0);
    }

    const V = valueScore(ranked, input.as_of);
    const threshold = input.scene === "proactive_discovery" ? 0.7 : 0.5;
    if (V < threshold) {
      return silenceResult(t0);
    }

    const fp = changeFingerprint(ranked.pick, input);
    if (isCoolingDown(this.db, fp, input.as_of)) {
      return silenceResult(t0);
    }

    const action =
      input.scene === "proactive_discovery" ? "send_notification" : "show_sidecar";
    recordCooldown(this.db, fp, input.as_of);
    this.decisionTraces.push({
      action,
      V,
      target: "E",
      event_id: ranked.pick.event_id,
    });

    const decisionId = `dec:${fp}:${parseVirtualMs(input.as_of)}`;
    enqueueDecisionOutbox(this.db, {
      decision_id: decisionId,
      idempotency_key: fp,
      scene: input.scene,
      target: "E",
      action,
      evidence_refs_json: JSON.stringify(
        ranked.pick.event_id ? [{ event_id: ranked.pick.event_id }] : [],
      ),
      reason_codes_json: JSON.stringify(["value_threshold"]),
      value_score: V,
      created_at_virtual: input.as_of,
      created_at_ms: parseVirtualMs(input.as_of),
      scope: input.scope,
      acl_epoch: this.truth.aclEpoch(),
    });

    return {
      action,
      output_text: ranked.pick.text,
      cited_event_ids: ranked.pick.event_id ? [ranked.pick.event_id] : [],
      latency_ms: monotonicNowMs() - t0,
    };
  }

  async export(): Promise<Record<string, unknown>> {
    const revoked = [...parseRevokedScopes(this.db)];
    const events = this.db
      .prepare(
        "SELECT event_id, source_version, scope, observed_at_ms, tombstone FROM evidence_events",
      )
      .all();
    const recallCacheEventIds = [
      ...new Set(
        [...this.recallCache.values()].flatMap((r) =>
          r.hits.map((h) => h.event_id).filter((id): id is string => Boolean(id)),
        ),
      ),
    ];

    return {
      schema: "memory-core-v4-export-v1",
      spec_version: SPEC_VERSION,
      scheme_id: "B",
      ablation_mode: this.ablation,
      models: this.models,
      watermarks: readWatermarks(this.db),
      acl_epoch: Number(getMeta(this.db, "acl_epoch")) || 0,
      evidence_events: (events as Array<{ tombstone: number }>).filter((e) => !e.tombstone),
      fact_revisions: this.db.prepare("SELECT * FROM fact_revisions").all(),
      artifacts: this.db.prepare("SELECT * FROM artifacts").all(),
      entity_edges: this.db.prepare("SELECT * FROM entity_edges").all(),
      revoked_scopes: revoked,
      deleted_event_ids: [...this.deletedEvents],
      recall_cache_keys: [...this.recallCache.keys()],
      recall_cache_event_ids: recallCacheEventIds,
      derived_snippets: [...this.derivedSnippets],
      in_flight_consolidation: this.inFlightConsolidation,
      decision_traces: this.decisionTraces,
      ingest_traces: this.db.prepare("SELECT * FROM ingest_traces ORDER BY id").all(),
      consolidate_traces: this.db
        .prepare("SELECT * FROM consolidate_traces ORDER BY id")
        .all(),
      recall_traces: this.db.prepare("SELECT * FROM recall_traces ORDER BY id").all(),
      async_jobs: listJobs(this.db),
      decision_outbox: listOutbox(this.db),
      vec_index_build_ms: Number(getMeta(this.db, "vec_index_build_ms")) || 0,
      embedding: embeddingStats(),
      cost_ledger: this.ledger.snapshot(),
      cost_ledger_file: this.ledgerFilePath,
    };
  }

  async delete(eventId: string): Promise<void> {
    const row = this.db
      .prepare("SELECT observed_at_ms FROM evidence_events WHERE event_id=? LIMIT 1")
      .get(eventId) as { observed_at_ms: number } | undefined;
    const atMs = row?.observed_at_ms ?? Date.now();
    this.deletedEvents.add(eventId);
    this.truth.retractEvidence(eventId, atMs);
    this.db
      .prepare("UPDATE evidence_events SET tombstone=1 WHERE event_id=? AND owner_id=?")
      .run(eventId, this.ownerId);
    this.db.prepare("DELETE FROM evidence_fts WHERE event_id=?").run(eventId);
    this.db.prepare("DELETE FROM event_vectors WHERE event_id=?").run(eventId);
    this.purgeDerivedForEvent(eventId);
    this.recallCache.clear();
  }

  async revoke(scope: string): Promise<void> {
    const revoked = parseRevokedScopes(this.db);
    revoked.add(scope);
    saveRevokedScopes(this.db, revoked);
    this.truth.retractScope(scope, Date.now());
    cancelOutboxForScope(this.db, scope);
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

function heuristicFacts(body: string, speaker: string | null) {
  const facts: Array<{ subject: string; predicate: string; object: string; class: string }> =
    [];
  const subj = speaker?.replace(/^@/, "") ?? "unknown";
  if (/reminder|ship|friday|harness/i.test(body)) {
    facts.push({ subject: subj, predicate: "commitment", object: body, class: "observation" });
  }
  const ticket = body.match(/\b([A-Z]+-\d+)\b/);
  if (ticket) {
    facts.push({
      subject: ticket[1]!,
      predicate: "status",
      object: body,
      class: "observation",
    });
  }
  return facts;
}

function rrfMerge(
  channels: string[][],
  topK: number,
  load: (id: string) => RecallResult["hits"][0] | null,
): RecallResult["hits"] {
  const scores = new Map<string, number>();
  for (const channel of channels) {
    channel.forEach((id, idx) => {
      scores.set(id, (scores.get(id) ?? 0) + 1 / (60 + idx + 1));
    });
  }
  const hits: RecallResult["hits"] = [];
  for (const [id] of [...scores.entries()].sort((a, b) => b[1] - a[1]).slice(0, topK)) {
    const hit = load(id);
    if (hit) hits.push(hit);
  }
  return hits;
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

function rankHits(hits: RecallResult["hits"], sceneText: string, ctx: SceneInput) {
  const tokens = sceneText
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2);
  let pick = hits[0]!;
  let score = 0;
  for (const h of hits) {
    const text = h.text.toLowerCase();
    let s = tokens.filter((t) => text.includes(t)).length;
    if (ctx.thread_id && text.includes("harness")) s += 1;
    if (s > score) {
      score = s;
      pick = h;
    }
  }
  return { pick, score };
}

function valueScore(
  ranked: { pick: RecallResult["hits"][0]; score: number },
  asOf: string,
): number {
  const relevance = Math.min(1, ranked.score / 3);
  const actionability = /reminder|follow|alpha|ticket|ship|deadline|harness/i.test(
    ranked.pick.text,
  )
    ? 1
    : 0.5;
  const observed = ranked.pick.observed_at
    ? parseVirtualMs(ranked.pick.observed_at)
    : parseVirtualMs(asOf);
  const urgency = parseVirtualMs(asOf) - observed < 7 * 86400000 ? 0.7 : 0.3;
  return 0.5 * relevance + 0.3 * actionability + 0.2 * urgency;
}

function changeFingerprint(pick: RecallResult["hits"][0], input: DecideInput): string {
  return `${input.scope}|${input.scene}|${pick.event_id}|${pick.text.slice(0, 80)}`;
}

function isCoolingDown(db: Database.Database, key: string, asOf: string): boolean {
  const row = db
    .prepare("SELECT last_sent_ms FROM decision_cooldown WHERE cooldown_key = ?")
    .get(key) as { last_sent_ms: number } | undefined;
  if (!row) return false;
  return parseVirtualMs(asOf) - row.last_sent_ms < 24 * 60 * 60 * 1000;
}

function recordCooldown(db: Database.Database, key: string, asOf: string): void {
  db.prepare(
    "INSERT INTO decision_cooldown (cooldown_key, last_sent_ms) VALUES (?,?) ON CONFLICT(cooldown_key) DO UPDATE SET last_sent_ms=excluded.last_sent_ms",
  ).run(key, parseVirtualMs(asOf));
}

function silenceResult(t0: number): DecideResult {
  return {
    action: "silence",
    output_text: "",
    cited_event_ids: [],
    latency_ms: monotonicNowMs() - t0,
  };
}
