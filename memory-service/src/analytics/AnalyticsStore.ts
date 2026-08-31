/**
 * AnalyticsStore — standalone centralized SQLite store for the usage-analytics
 * system.
 *
 * This DB is intentionally separate from the per-user memory databases and does
 * NOT participate in the numbered migration system (no 0XX_*.sql). Its schema
 * lives in `schema.sql` (same directory) and is applied on construction.
 *
 * All timestamps are stored as Unix epoch MILLISECONDS.
 */

import BetterSqlite3, { type Database as SQLiteDatabase } from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  type CapabilityKey,
  normalizeCapability,
} from './capabilityMap.js';
import {
  estimateCostUsd,
  setPricingOverrides,
  MODEL_PRICING,
  type ModelPricing,
} from './pricing.js';
import { getConfig } from '../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type UsageSide = 'frontend' | 'backend';
export type UsageEventStatus = 'ok' | 'error';

export interface UsageEventInput {
  ts?: number;
  userId?: string | null;
  side: UsageSide;
  capability?: string | null;
  feature?: string | null;
  route?: string | null;
  model?: string | null;
  promptTokens?: number | null;
  completionTokens?: number | null;
  status?: UsageEventStatus | string | null;
  errorKind?: string | null;
  requestId?: string | null;
  meta?: Record<string, unknown> | null;
}

export interface ApiCallEventInput {
  ts?: number;
  userId?: string | null;
  capability?: string | null;
  route: string;
  method: string;
  status: number;
}

export interface UsageAggregateRow {
  side: UsageSide;
  capability: CapabilityKey;
  model: string;
  callCount: number;
  failCount: number;
  promptTokens: number;
  completionTokens: number;
  estCostUsd: number;
}

export interface CapabilityFeatureAggregateRow {
  capability: CapabilityKey;
  side: UsageSide;
  /** Frontend feature label or backend route. */
  detail: string;
  detailKind: 'feature' | 'route';
  callCount: number;
  failCount: number;
  promptTokens: number;
  completionTokens: number;
  estCostUsd: number;
}

export interface ApiCallAggregateRow {
  capability: CapabilityKey;
  route: string;
  count: number;
}

export interface UserCapabilityAggregateRow {
  userId: string;
  capability: CapabilityKey;
  llmCallCount: number;
  promptTokens: number;
  completionTokens: number;
  estCostUsd: number;
}

export interface ApiCallUserCapabilityRow {
  userId: string;
  capability: CapabilityKey;
  count: number;
}

export interface DailyActivityRow {
  day: string; // 'YYYY-MM-DD' (UTC，与 rollup 口径一致)
  activeUsers: number;
  llmCalls: number;
  apiCalls: number;
  totalTokens: number;
}

export interface ActiveUserRow {
  userId: string;
  eventCount: number;
  lastTs: number;
}

export interface UsageQueryOptions {
  sinceMs: number;
  nowMs: number;
  userId?: string | null;
}

export interface PricingEntry extends ModelPricing {
  model: string;
  note: string | null;
  updatedAt: number;
  /** True when this row lives only in the compiled-in seed, not the DB. */
  source: 'db' | 'builtin';
}

export interface UnpricedModelRow {
  model: string;
  callCount: number;
  totalTokens: number;
}

export interface ErrorKindAggregateRow {
  errorKind: string;
  side: UsageSide;
  capability: CapabilityKey;
  count: number;
}

export interface BackgroundLlmDailyRow {
  feature: string;
  capability: CapabilityKey;
  callCount: number;
  totalTokens: number;
}

// ---------------------------------------------------------------------------
// Time helpers (UTC)
// ---------------------------------------------------------------------------

const MS_PER_DAY = 86_400_000;

function normalizeTs(ts: number | null | undefined): number {
  if (ts == null || !Number.isFinite(ts)) return Date.now();
  // Values that look like epoch seconds (< year 2286 in ms) are scaled up.
  return ts < 1_000_000_000_000 ? Math.round(ts * 1000) : Math.round(ts);
}

function startOfUtcDayMs(ms: number): number {
  return Math.floor(ms / MS_PER_DAY) * MS_PER_DAY;
}

function dayStringFromMs(ms: number): string {
  return new Date(startOfUtcDayMs(ms)).toISOString().slice(0, 10);
}

function enumerateDays(startDayMs: number, endDayMsInclusive: number): string[] {
  const days: string[] = [];
  for (let d = startDayMs; d <= endDayMsInclusive; d += MS_PER_DAY) {
    days.push(dayStringFromMs(d));
  }
  return days;
}

// ---------------------------------------------------------------------------
// Schema loading
// ---------------------------------------------------------------------------

function loadSchemaSql(): string {
  const candidates = [
    path.join(__dirname, 'schema.sql'),
    path.resolve(__dirname, '../../src/analytics/schema.sql'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return fs.readFileSync(candidate, 'utf-8');
    }
  }
  throw new Error(
    `[AnalyticsStore] schema.sql not found. Checked: ${candidates.join(', ')}`,
  );
}

// ---------------------------------------------------------------------------
// Corruption handling
// ---------------------------------------------------------------------------

/**
 * True for the SQLite errors that mean the file itself is damaged, as opposed
 * to a schema/constraint problem. Raw telemetry is disposable, but salvaging it
 * still needs an operator, so the store degrades instead of serving 500s from
 * every read.
 */
export function isAnalyticsCorruptionError(err: unknown): boolean {
  const code = (err as { code?: unknown } | null)?.code;
  if (typeof code === 'string' && /^SQLITE_(CORRUPT|NOTADB)/.test(code)) {
    return true;
  }
  const message = err instanceof Error ? err.message : '';
  return /database disk image is malformed|file is not a database/i.test(
    message,
  );
}

export class AnalyticsCorruptError extends Error {
  readonly dbPath: string;

  constructor(dbPath: string, cause: unknown) {
    super(
      `Analytics database is corrupt (${dbPath}). Run "npm --prefix memory-service run repair:analytics" to salvage it.`,
    );
    this.name = 'AnalyticsCorruptError';
    this.dbPath = dbPath;
    this.cause = cause;
  }
}

// ---------------------------------------------------------------------------
// AnalyticsStore
// ---------------------------------------------------------------------------

export class AnalyticsStore {
  private db: SQLiteDatabase;
  private readonly dbPath: string;
  private corrupt = false;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.db = new BetterSqlite3(dbPath);
    // Analytics is the highest-churn DB in the service and lives on the same
    // (often bind-mounted) volume as the memory DBs, so it needs the same
    // journal/sync escape hatch instead of forcing WAL — with its own override
    // so telemetry can go DELETE + FULL without slowing memory writes.
    const config = getConfig();
    this.db.pragma(`journal_mode = ${config.analyticsSqliteJournalMode}`);
    this.db.pragma(`synchronous = ${config.analyticsSqliteSynchronous}`);
    this.db.exec(loadSchemaSql());
    this.ensureSchemaMigrations();
    this.reloadPricingOverrides();
    this.pruneOldEvents();
    this.repriceFlaggedEvents();
  }

  /** True once a statement failed with SQLITE_CORRUPT; reads/writes stop. */
  get isCorrupt(): boolean {
    return this.corrupt;
  }

  /**
   * Latch the store off when a statement reports file-level damage, so one bad
   * page stops producing generic 500s from every subsequent read.
   * Returns true when the error was a corruption error.
   */
  markCorruptIfNeeded(err: unknown): boolean {
    if (!isAnalyticsCorruptionError(err)) return false;
    if (!this.corrupt) {
      this.corrupt = true;
      console.error(
        `[AnalyticsStore] Corrupt database at ${this.dbPath}; usage analytics ` +
          'is disabled until the file is repaired ' +
          '(npm --prefix memory-service run repair:analytics).',
      );
    }
    return true;
  }

  /** Best-effort write: telemetry must never fail the request it describes. */
  private guardWrite(label: string, fn: () => void): void {
    if (this.corrupt) return;
    try {
      fn();
    } catch (err) {
      if (!this.markCorruptIfNeeded(err)) {
        console.warn(
          `[AnalyticsStore] ${label} failed:`,
          err instanceof Error ? err.message : String(err),
        );
      }
    }
  }

  /**
   * Drop raw events older than the retention window. Daily rollups keep the
   * long-term LLM history, reports never look back further than 30 days, and
   * unbounded `api_call_events` growth is what makes this file large enough to
   * be worth corrupting in the first place.
   */
  pruneOldEvents(nowMs: number = Date.now()): {
    usageEvents: number;
    apiCallEvents: number;
  } {
    const config = getConfig();
    const deleteOlderThan = (table: string, retentionDays: number): number => {
      if (!Number.isFinite(retentionDays) || retentionDays <= 0) return 0;
      return this.db
        .prepare(`DELETE FROM ${table} WHERE ts < ?`)
        .run(nowMs - retentionDays * MS_PER_DAY).changes;
    };
    try {
      const usageEvents = deleteOlderThan(
        'usage_events',
        config.analyticsRetentionDays,
      );
      const apiCallEvents = deleteOlderThan(
        'api_call_events',
        config.analyticsApiRetentionDays,
      );
      if (usageEvents || apiCallEvents) {
        console.log(
          `[AnalyticsStore] Pruned ${usageEvents} usage_events (>${config.analyticsRetentionDays}d) ` +
            `and ${apiCallEvents} api_call_events (>${config.analyticsApiRetentionDays}d)`,
        );
      }
      return { usageEvents, apiCallEvents };
    } catch (err) {
      if (isAnalyticsCorruptionError(err)) this.corrupt = true;
      console.warn(
        '[AnalyticsStore] pruneOldEvents skipped:',
        err instanceof Error ? err.message : String(err),
      );
      return { usageEvents: 0, apiCallEvents: 0 };
    }
  }

  /**
   * Additive migrations for existing analytics DBs that were created before
   * status/error_kind/fail_count columns existed. CREATE TABLE IF NOT EXISTS
   * will not alter already-present tables.
   */
  private ensureSchemaMigrations(): void {
    const ensureColumn = (
      table: string,
      column: string,
      ddl: string,
    ): void => {
      const rows = this.db.prepare(`PRAGMA table_info(${table})`).all() as Array<{
        name: string;
      }>;
      if (!rows.some((row) => row.name === column)) {
        this.db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
      }
    };
    // Add columns first, then indexes that depend on them.
    ensureColumn('usage_events', 'status', `status TEXT NOT NULL DEFAULT 'ok'`);
    ensureColumn('usage_events', 'error_kind', 'error_kind TEXT');
    ensureColumn(
      'usage_events',
      'is_background',
      'is_background INTEGER NOT NULL DEFAULT 0',
    );
    ensureColumn(
      'usage_rollup_daily',
      'fail_count',
      'fail_count INTEGER NOT NULL DEFAULT 0',
    );
    this.db.exec(
      `CREATE INDEX IF NOT EXISTS idx_usage_events_status_ts ON usage_events (status, ts)`,
    );
    this.db.exec(
      `CREATE INDEX IF NOT EXISTS idx_usage_events_background_ts ON usage_events (is_background, ts)`,
    );
  }

  /**
   * Load the `model_pricing` table into pricing.ts's module-level override
   * map. Called on construction and after every pricing write so
   * estimateCostUsd() sees admin-set prices immediately.
   */
  private reloadPricingOverrides(): void {
    try {
      const rows = this.db
        .prepare(
          `SELECT model, input_per_1m, output_per_1m, cache_read_per_1m, cache_write_per_1m
           FROM model_pricing`,
        )
        .all() as Array<{
        model: string;
        input_per_1m: number;
        output_per_1m: number;
        cache_read_per_1m: number | null;
        cache_write_per_1m: number | null;
      }>;
      const overrides: Record<string, ModelPricing> = {};
      for (const row of rows) {
        overrides[row.model] = {
          inputPer1M: row.input_per_1m,
          outputPer1M: row.output_per_1m,
        };
      }
      setPricingOverrides(overrides);
    } catch (err) {
      console.warn(
        '[AnalyticsStore] reloadPricingOverrides skipped:',
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  /**
   * Backfill est_cost_usd for historical rows still flagged un-priced —
   * either because the model was added to pricing after they were recorded,
   * or an admin just corrected a price via PUT /usage/pricing.
   *
   * Paginates by an `id` cursor until exhausted (bounded to avoid a
   * pathological startup stall). This must be cursor-based, not a plain
   * repeated `LIMIT 5000` — a version of this method that re-issued the same
   * unqualified `LIMIT 5000` (with no ORDER BY/cursor) stopped as soon as one
   * whole batch repriced nothing, on the assumption that meant every
   * remaining flagged row was permanently unpriceable. That assumption is
   * false: SQLite returns the same head-of-table rows every time, so if
   * those first 5000 rows happened to all belong to models nobody had priced
   * *yet* (e.g. gpt-5-nano before its first PUT /usage/pricing), the loop
   * gave up immediately and never advanced far enough to reach a
   * *genuinely* priceable model's rows sitting right behind them — caught in
   * production 2026-08-26 when claude-sonnet-4-6 (already priced in the seed
   * table) stayed stuck flagged behind a backlog of not-yet-priced models.
   * Advancing `id > cursor` regardless of whether a batch made progress is
   * what actually guarantees forward progress through the whole table.
   */
  private repriceFlaggedEvents(maxRows = 50_000): void {
    try {
      const selectBatch = this.db.prepare(
        `SELECT id, model, prompt_tokens, completion_tokens
         FROM usage_events
         WHERE cost_flagged = 1 AND COALESCE(model, '') != '' AND id > ?
         ORDER BY id ASC
         LIMIT 5000`,
      );
      const update = this.db.prepare(
        `UPDATE usage_events SET est_cost_usd = ?, cost_flagged = 0 WHERE id = ?`,
      );
      let processed = 0;
      let repriced = 0;
      let cursor = 0;
      for (let iterations = 0; iterations < Math.ceil(maxRows / 5000); iterations++) {
        const rows = selectBatch.all(cursor) as Array<{
          id: number;
          model: string;
          prompt_tokens: number;
          completion_tokens: number;
        }>;
        if (rows.length === 0) break;
        const tx = this.db.transaction(() => {
          for (const row of rows) {
            const { estCostUsd, flagged } = estimateCostUsd(
              row.model,
              row.prompt_tokens,
              row.completion_tokens,
            );
            // A genuinely-still-unpriced model (flagged=true) is left as-is:
            // cost_flagged stays 1, so the report layer keeps excluding it
            // from cost totals (see routes/usage.ts pricedCost) instead of
            // silently reporting $0 as if it were priced.
            if (!flagged) {
              update.run(estCostUsd, row.id);
              repriced++;
            }
          }
        });
        tx();
        processed += rows.length;
        cursor = rows[rows.length - 1].id; // advance regardless of progress
        if (rows.length < 5000) break; // reached the tail of the flagged set
      }
      if (processed > 0) {
        console.log(
          `[AnalyticsStore] repriceFlaggedEvents: repriced ${repriced}/${processed} flagged rows`,
        );
      }
      if (repriced > 0) {
        // Refresh rollup costs so already-cached days pick up the new price.
        this.rollupRecentDays(35);
      }
    } catch (err) {
      console.warn(
        '[AnalyticsStore] repriceFlaggedEvents skipped:',
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  get filePath(): string {
    return this.dbPath;
  }

  get raw(): SQLiteDatabase {
    return this.db;
  }

  // ---- Ingestion --------------------------------------------------------

  recordUsageEvent(event: UsageEventInput): void {
    const ts = normalizeTs(event.ts);
    const capability = normalizeCapability(event.capability);
    const promptTokens = Math.max(0, Math.round(event.promptTokens ?? 0));
    const completionTokens = Math.max(
      0,
      Math.round(event.completionTokens ?? 0),
    );
    const totalTokens = promptTokens + completionTokens;
    const status: UsageEventStatus =
      event.status === 'error' ? 'error' : 'ok';
    const { estCostUsd, flagged } = estimateCostUsd(
      event.model,
      promptTokens,
      completionTokens,
    );
    const isBackground = Boolean(event.meta?.backgroundLlm);

    this.guardWrite('recordUsageEvent', () => {
      this.db
        .prepare(
          `INSERT INTO usage_events
           (ts, user_id, side, capability, feature, route, model,
            prompt_tokens, completion_tokens, total_tokens,
            est_cost_usd, cost_flagged, status, error_kind, request_id, meta_json,
            is_background)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          ts,
          event.userId ?? 'unknown',
          event.side,
          capability,
          event.feature ?? null,
          event.route ?? null,
          event.model ?? null,
          promptTokens,
          completionTokens,
          totalTokens,
          estCostUsd,
          flagged ? 1 : 0,
          status,
          event.errorKind ?? null,
          event.requestId ?? null,
          event.meta ? JSON.stringify(event.meta) : null,
          isBackground ? 1 : 0,
        );
    });
  }

  // ---- Pricing (admin-managed model_pricing table) -----------------------

  /** Merged pricing table: DB overrides + compiled-in seed, each tagged with source. */
  getPricingTable(): PricingEntry[] {
    const dbRows = this.db
      .prepare(
        `SELECT model, input_per_1m, output_per_1m, cache_read_per_1m, cache_write_per_1m, note, updated_at
         FROM model_pricing`,
      )
      .all() as Array<{
      model: string;
      input_per_1m: number;
      output_per_1m: number;
      cache_read_per_1m: number | null;
      cache_write_per_1m: number | null;
      note: string | null;
      updated_at: number;
    }>;
    const seen = new Set<string>();
    const entries: PricingEntry[] = dbRows.map((row) => {
      seen.add(row.model);
      return {
        model: row.model,
        inputPer1M: row.input_per_1m,
        outputPer1M: row.output_per_1m,
        note: row.note,
        updatedAt: row.updated_at,
        source: 'db',
      };
    });
    for (const [model, pricing] of Object.entries(MODEL_PRICING)) {
      if (seen.has(model)) continue;
      entries.push({
        model,
        inputPer1M: pricing.inputPer1M,
        outputPer1M: pricing.outputPer1M,
        note: null,
        updatedAt: 0,
        source: 'builtin',
      });
    }
    return entries.sort((a, b) => a.model.localeCompare(b.model));
  }

  /**
   * Batch upsert model prices, reload the live override map, and reprice any
   * previously-flagged rows so historical cost catches up immediately.
   */
  upsertPricing(
    entries: Array<{
      model: string;
      inputPer1M: number;
      outputPer1M: number;
      cacheReadPer1M?: number | null;
      cacheWritePer1M?: number | null;
      note?: string | null;
    }>,
  ): void {
    const ts = Date.now();
    const stmt = this.db.prepare(
      `INSERT INTO model_pricing (model, input_per_1m, output_per_1m, cache_read_per_1m, cache_write_per_1m, note, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(model) DO UPDATE SET
         input_per_1m = excluded.input_per_1m,
         output_per_1m = excluded.output_per_1m,
         cache_read_per_1m = excluded.cache_read_per_1m,
         cache_write_per_1m = excluded.cache_write_per_1m,
         note = excluded.note,
         updated_at = excluded.updated_at`,
    );
    const tx = this.db.transaction(() => {
      for (const entry of entries) {
        const model = entry.model.trim().toLowerCase();
        if (!model || !Number.isFinite(entry.inputPer1M) || !Number.isFinite(entry.outputPer1M)) {
          continue;
        }
        stmt.run(
          model,
          entry.inputPer1M,
          entry.outputPer1M,
          entry.cacheReadPer1M ?? null,
          entry.cacheWritePer1M ?? null,
          entry.note ?? null,
          ts,
        );
      }
    });
    tx();
    this.reloadPricingOverrides();
    this.repriceFlaggedEvents();
  }

  /**
   * Models that produced usage in the window but have no price anywhere
   * (DB or builtin) — the exact input the update-model-pricing skill needs.
   */
  getUnpricedModels(sinceMs: number): UnpricedModelRow[] {
    const rows = this.db
      .prepare(
        `SELECT model, COUNT(*) AS call_count, SUM(total_tokens) AS total_tokens
         FROM usage_events
         WHERE cost_flagged = 1 AND ts >= ? AND COALESCE(model, '') != ''
         GROUP BY model
         ORDER BY total_tokens DESC`,
      )
      .all(sinceMs) as Array<{
      model: string;
      call_count: number;
      total_tokens: number;
    }>;
    return rows.map((row) => ({
      model: row.model,
      callCount: row.call_count,
      totalTokens: row.total_tokens,
    }));
  }

  // ---- Error-kind and background-LLM diagnostics --------------------------

  /** Failure breakdown by errorKind/side/capability for a time window. */
  getErrorKindAggregate(opts: UsageQueryOptions): ErrorKindAggregateRow[] {
    const { sinceMs, nowMs, userId } = opts;
    const params: unknown[] = [sinceMs, nowMs];
    let userClause = '';
    if (userId && userId !== 'all') {
      userClause = ' AND user_id = ?';
      params.push(userId);
    }
    const rows = this.db
      .prepare(
        `SELECT COALESCE(NULLIF(error_kind, ''), 'unknown') AS error_kind, side, capability, COUNT(*) AS count
         FROM usage_events
         WHERE status = 'error' AND ts >= ? AND ts <= ?${userClause}
         GROUP BY error_kind, side, capability
         ORDER BY count DESC
         LIMIT 100`,
      )
      .all(...params) as Array<{
      error_kind: string;
      side: string;
      capability: string;
      count: number;
    }>;
    return rows.map((row) => ({
      errorKind: row.error_kind,
      side: (row.side === 'frontend' ? 'frontend' : 'backend') as UsageSide,
      capability: normalizeCapability(row.capability),
      count: row.count,
    }));
  }

  /**
   * Backend LLM token totals for a UTC day, broken down by feature — used to
   * flag a background job (heartbeat, weekly_dreaming, ...) that is quietly
   * burning far more than expected in a single day.
   */
  getBackgroundLlmDailyTotals(dayStr: string): BackgroundLlmDailyRow[] {
    const dayStartMs = Date.parse(`${dayStr}T00:00:00.000Z`);
    if (!Number.isFinite(dayStartMs)) return [];
    const dayEndMs = dayStartMs + MS_PER_DAY;
    const rows = this.db
      .prepare(
        `SELECT COALESCE(NULLIF(feature, ''), 'unknown') AS feature, capability,
                COUNT(*) AS call_count, SUM(total_tokens) AS total_tokens
         FROM usage_events
         WHERE is_background = 1 AND ts >= ? AND ts < ?
         GROUP BY feature, capability
         ORDER BY total_tokens DESC`,
      )
      .all(dayStartMs, dayEndMs) as Array<{
      feature: string;
      capability: string;
      call_count: number;
      total_tokens: number;
    }>;
    return rows.map((row) => ({
      feature: row.feature,
      capability: normalizeCapability(row.capability),
      callCount: row.call_count,
      totalTokens: row.total_tokens,
    }));
  }

  recordApiCall(event: ApiCallEventInput): void {
    const ts = normalizeTs(event.ts);
    this.guardWrite('recordApiCall', () => {
      this.db
        .prepare(
          `INSERT INTO api_call_events
           (ts, user_id, capability, route, method, status)
         VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(
          ts,
          event.userId ?? 'unknown',
          event.capability ? normalizeCapability(event.capability) : null,
          event.route,
          event.method,
          event.status,
        );
    });
  }

  // ---- Rollup -----------------------------------------------------------

  /**
   * Recompute usage_rollup_daily for a single UTC day ('YYYY-MM-DD') from raw
   * usage_events. Returns the number of aggregated rows written.
   */
  rollupDay(dayStr: string): number {
    const dayStartMs = Date.parse(`${dayStr}T00:00:00.000Z`);
    if (!Number.isFinite(dayStartMs)) {
      throw new Error(`[AnalyticsStore] Invalid day string: ${dayStr}`);
    }
    const dayEndMs = dayStartMs + MS_PER_DAY;

    const run = this.db.transaction(() => {
      this.db
        .prepare('DELETE FROM usage_rollup_daily WHERE day = ?')
        .run(dayStr);
      const result = this.db
        .prepare(
          `INSERT INTO usage_rollup_daily
             (day, user_id, side, capability, model,
              call_count, fail_count, prompt_tokens, completion_tokens, est_cost_usd)
           SELECT ?, user_id, side, capability, COALESCE(model, 'unknown'),
                  COUNT(*),
                  SUM(CASE WHEN COALESCE(status, 'ok') = 'error' THEN 1 ELSE 0 END),
                  SUM(prompt_tokens), SUM(completion_tokens),
                  SUM(est_cost_usd)
           FROM usage_events
           WHERE ts >= ? AND ts < ?
           GROUP BY user_id, side, capability, COALESCE(model, 'unknown')`,
        )
        .run(dayStr, dayStartMs, dayEndMs);
      return result.changes;
    });

    return run();
  }

  /**
   * Roll up the given number of trailing days (including today). Used by the
   * scheduler's daily/hourly cron and on startup.
   */
  rollupRecentDays(days: number, nowMs: number = Date.now()): string[] {
    const todayStart = startOfUtcDayMs(nowMs);
    const startDay = todayStart - Math.max(0, days - 1) * MS_PER_DAY;
    const dayStrings = enumerateDays(startDay, todayStart);
    for (const day of dayStrings) {
      this.rollupDay(day);
    }
    return dayStrings;
  }

  // ---- Reporting --------------------------------------------------------

  /**
   * Aggregated token/cost usage for a time window. Reads usage_rollup_daily for
   * full days before today and merges raw usage_events for today, per the
   * caching design.
   */
  getUsageAggregate(opts: UsageQueryOptions): UsageAggregateRow[] {
    const { sinceMs, nowMs, userId } = opts;
    const todayStart = startOfUtcDayMs(nowMs);
    const merged = new Map<string, UsageAggregateRow>();

    const mergeRow = (row: {
      side: string;
      capability: string;
      model: string;
      call_count: number;
      fail_count?: number;
      prompt_tokens: number;
      completion_tokens: number;
      est_cost_usd: number;
    }): void => {
      const side = (row.side === 'frontend' ? 'frontend' : 'backend') as UsageSide;
      const capability = normalizeCapability(row.capability);
      const model = row.model || 'unknown';
      const key = `${side}|${capability}|${model}`;
      const failCount = Number(row.fail_count || 0);
      const existing = merged.get(key);
      if (existing) {
        existing.callCount += row.call_count;
        existing.failCount += failCount;
        existing.promptTokens += row.prompt_tokens;
        existing.completionTokens += row.completion_tokens;
        existing.estCostUsd += row.est_cost_usd;
      } else {
        merged.set(key, {
          side,
          capability,
          model,
          callCount: row.call_count,
          failCount,
          promptTokens: row.prompt_tokens,
          completionTokens: row.completion_tokens,
          estCostUsd: row.est_cost_usd,
        });
      }
    };

    // Full days (rollup) before today.
    const sinceDayStart = startOfUtcDayMs(sinceMs);
    if (sinceDayStart < todayStart) {
      const days = enumerateDays(sinceDayStart, todayStart - MS_PER_DAY);
      if (days.length > 0) {
        const placeholders = days.map(() => '?').join(', ');
        const params: unknown[] = [...days];
        let userClause = '';
        if (userId && userId !== 'all') {
          userClause = ' AND user_id = ?';
          params.push(userId);
        }
        const rows = this.db
          .prepare(
            `SELECT side, capability, model,
                    SUM(call_count) AS call_count,
                    SUM(COALESCE(fail_count, 0)) AS fail_count,
                    SUM(prompt_tokens) AS prompt_tokens,
                    SUM(completion_tokens) AS completion_tokens,
                    SUM(est_cost_usd) AS est_cost_usd
             FROM usage_rollup_daily
             WHERE day IN (${placeholders})${userClause}
             GROUP BY side, capability, model`,
          )
          .all(...params) as Array<{
          side: string;
          capability: string;
          model: string;
          call_count: number;
          fail_count: number;
          prompt_tokens: number;
          completion_tokens: number;
          est_cost_usd: number;
        }>;
        for (const row of rows) mergeRow(row);
      }
    }

    // Today (raw events, from the later of sinceMs and today's start).
    const rawSince = Math.max(sinceMs, todayStart);
    {
      const params: unknown[] = [rawSince, nowMs];
      let userClause = '';
      if (userId && userId !== 'all') {
        userClause = ' AND user_id = ?';
        params.push(userId);
      }
      const rows = this.db
        .prepare(
          `SELECT side, capability, COALESCE(model, 'unknown') AS model,
                  COUNT(*) AS call_count,
                  SUM(CASE WHEN COALESCE(status, 'ok') = 'error' THEN 1 ELSE 0 END) AS fail_count,
                  SUM(prompt_tokens) AS prompt_tokens,
                  SUM(completion_tokens) AS completion_tokens,
                  SUM(est_cost_usd) AS est_cost_usd
           FROM usage_events
           WHERE ts >= ? AND ts <= ?${userClause}
           GROUP BY side, capability, COALESCE(model, 'unknown')`,
        )
        .all(...params) as Array<{
        side: string;
        capability: string;
        model: string;
        call_count: number;
        fail_count: number;
        prompt_tokens: number;
        completion_tokens: number;
        est_cost_usd: number;
      }>;
      for (const row of rows) mergeRow(row);
    }

    return [...merged.values()];
  }

  /**
   * Feature/route drill-down for a time window (raw events only; rollup does
   * not retain feature granularity).
   */
  getCapabilityFeatureAggregate(
    opts: UsageQueryOptions & { side?: UsageSide | 'all' | null },
  ): CapabilityFeatureAggregateRow[] {
    const { sinceMs, nowMs, userId, side } = opts;
    const params: unknown[] = [sinceMs, nowMs];
    let clauses = 'WHERE ts >= ? AND ts <= ?';
    if (userId && userId !== 'all') {
      clauses += ' AND user_id = ?';
      params.push(userId);
    }
    if (side === 'frontend' || side === 'backend') {
      clauses += ' AND side = ?';
      params.push(side);
    }
    const rows = this.db
      .prepare(
        `SELECT side, capability,
                CASE
                  WHEN side = 'frontend' THEN COALESCE(NULLIF(feature, ''), 'unknown')
                  ELSE COALESCE(NULLIF(route, ''), COALESCE(NULLIF(feature, ''), 'unknown'))
                END AS detail,
                CASE WHEN side = 'frontend' THEN 'feature' ELSE 'route' END AS detail_kind,
                COUNT(*) AS call_count,
                SUM(CASE WHEN COALESCE(status, 'ok') = 'error' THEN 1 ELSE 0 END) AS fail_count,
                SUM(prompt_tokens) AS prompt_tokens,
                SUM(completion_tokens) AS completion_tokens,
                SUM(est_cost_usd) AS est_cost_usd
         FROM usage_events
         ${clauses}
         GROUP BY side, capability, detail, detail_kind
         ORDER BY call_count DESC
         LIMIT 500`,
      )
      .all(...params) as Array<{
      side: string;
      capability: string;
      detail: string;
      detail_kind: string;
      call_count: number;
      fail_count: number;
      prompt_tokens: number;
      completion_tokens: number;
      est_cost_usd: number;
    }>;
    return rows.map((row) => ({
      side: (row.side === 'frontend' ? 'frontend' : 'backend') as UsageSide,
      capability: normalizeCapability(row.capability),
      detail: row.detail || 'unknown',
      detailKind: row.detail_kind === 'route' ? 'route' : 'feature',
      callCount: row.call_count,
      failCount: row.fail_count || 0,
      promptTokens: row.prompt_tokens,
      completionTokens: row.completion_tokens,
      estCostUsd: row.est_cost_usd,
    }));
  }

  /** Per-route + per-capability API-call frequency in a time window (raw). */
  getApiCallAggregate(opts: UsageQueryOptions): ApiCallAggregateRow[] {
    const { sinceMs, nowMs, userId } = opts;
    const params: unknown[] = [sinceMs, nowMs];
    let userClause = '';
    if (userId && userId !== 'all') {
      userClause = ' AND user_id = ?';
      params.push(userId);
    }
    const rows = this.db
      .prepare(
        `SELECT COALESCE(capability, 'unknown') AS capability, route,
                COUNT(*) AS count
         FROM api_call_events
         WHERE ts >= ? AND ts <= ?${userClause}
         GROUP BY COALESCE(capability, 'unknown'), route
         ORDER BY count DESC`,
      )
      .all(...params) as Array<{
      capability: string;
      route: string;
      count: number;
    }>;
    return rows.map((row) => ({
      capability: normalizeCapability(row.capability),
      route: row.route,
      count: row.count,
    }));
  }

  /**
   * Per-user × capability LLM aggregate (rollup + today's raw).
   * Always all-users; ignores opts.userId (matrix views are global).
   */
  getUserCapabilityAggregate(
    opts: Pick<UsageQueryOptions, 'sinceMs' | 'nowMs'>,
  ): UserCapabilityAggregateRow[] {
    const { sinceMs, nowMs } = opts;
    const todayStart = startOfUtcDayMs(nowMs);
    const merged = new Map<string, UserCapabilityAggregateRow>();

    const mergeRow = (row: {
      user_id: string;
      capability: string;
      llm_call_count: number;
      prompt_tokens: number;
      completion_tokens: number;
      est_cost_usd: number;
    }) => {
      const userId = row.user_id || 'unknown';
      const capability = normalizeCapability(row.capability);
      const key = `${userId}|${capability}`;
      const existing = merged.get(key);
      if (existing) {
        existing.llmCallCount += row.llm_call_count;
        existing.promptTokens += row.prompt_tokens;
        existing.completionTokens += row.completion_tokens;
        existing.estCostUsd += row.est_cost_usd;
      } else {
        merged.set(key, {
          userId,
          capability,
          llmCallCount: row.llm_call_count,
          promptTokens: row.prompt_tokens,
          completionTokens: row.completion_tokens,
          estCostUsd: row.est_cost_usd,
        });
      }
    };

    const sinceDayStart = startOfUtcDayMs(sinceMs);
    if (sinceDayStart < todayStart) {
      const days = enumerateDays(sinceDayStart, todayStart - MS_PER_DAY);
      if (days.length > 0) {
        const placeholders = days.map(() => '?').join(', ');
        const rows = this.db
          .prepare(
            `SELECT user_id, capability,
                    SUM(call_count) AS llm_call_count,
                    SUM(prompt_tokens) AS prompt_tokens,
                    SUM(completion_tokens) AS completion_tokens,
                    SUM(est_cost_usd) AS est_cost_usd
             FROM usage_rollup_daily
             WHERE day IN (${placeholders})
             GROUP BY user_id, capability`,
          )
          .all(...days) as Array<{
          user_id: string;
          capability: string;
          llm_call_count: number;
          prompt_tokens: number;
          completion_tokens: number;
          est_cost_usd: number;
        }>;
        for (const row of rows) mergeRow(row);
      }
    }

    const rawSince = Math.max(sinceMs, todayStart);
    {
      const rows = this.db
        .prepare(
          `SELECT user_id, capability,
                  COUNT(*) AS llm_call_count,
                  SUM(prompt_tokens) AS prompt_tokens,
                  SUM(completion_tokens) AS completion_tokens,
                  SUM(est_cost_usd) AS est_cost_usd
           FROM usage_events
           WHERE ts >= ? AND ts <= ?
           GROUP BY user_id, capability`,
        )
        .all(rawSince, nowMs) as Array<{
        user_id: string;
        capability: string;
        llm_call_count: number;
        prompt_tokens: number;
        completion_tokens: number;
        est_cost_usd: number;
      }>;
      for (const row of rows) mergeRow(row);
    }

    return [...merged.values()];
  }

  /** Per-user × capability API-call counts (raw window scan). */
  getApiCallUserCapabilityAggregate(
    opts: Pick<UsageQueryOptions, 'sinceMs' | 'nowMs'>,
  ): ApiCallUserCapabilityRow[] {
    const { sinceMs, nowMs } = opts;
    const rows = this.db
      .prepare(
        `SELECT user_id, COALESCE(capability, 'unknown') AS capability, COUNT(*) AS count
         FROM api_call_events
         WHERE ts >= ? AND ts <= ?
         GROUP BY user_id, COALESCE(capability, 'unknown')`,
      )
      .all(sinceMs, nowMs) as Array<{
      user_id: string;
      capability: string;
      count: number;
    }>;
    return rows.map((row) => ({
      userId: row.user_id || 'unknown',
      capability: normalizeCapability(row.capability),
      count: row.count,
    }));
  }

  /**
   * Daily active users / LLM / API / tokens across both tables (UTC days).
   * Zero-fills missing days in the window for continuous charts.
   * When userId is set (and not 'all'), only that user's activity is counted.
   */
  getDailyActivity(
    opts: Pick<UsageQueryOptions, 'sinceMs' | 'nowMs' | 'userId'>,
  ): DailyActivityRow[] {
    const { sinceMs, nowMs, userId } = opts;
    const usageParams: unknown[] = [sinceMs, nowMs];
    const apiParams: unknown[] = [sinceMs, nowMs];
    let usageUserClause = '';
    let apiUserClause = '';
    if (userId && userId !== 'all') {
      usageUserClause = ' AND user_id = ?';
      apiUserClause = ' AND user_id = ?';
      usageParams.push(userId);
      apiParams.push(userId);
    }

    const rows = this.db
      .prepare(
        `SELECT day,
                COUNT(DISTINCT user_id) AS active_users,
                SUM(llm) AS llm_calls,
                SUM(api) AS api_calls,
                SUM(tokens) AS total_tokens
         FROM (
           SELECT strftime('%Y-%m-%d', ts / 1000, 'unixepoch') AS day,
                  user_id, 1 AS llm, 0 AS api, total_tokens AS tokens
           FROM usage_events WHERE ts >= ? AND ts <= ?${usageUserClause}
           UNION ALL
           SELECT strftime('%Y-%m-%d', ts / 1000, 'unixepoch') AS day,
                  user_id, 0 AS llm, 1 AS api, 0 AS tokens
           FROM api_call_events WHERE ts >= ? AND ts <= ?${apiUserClause}
         )
         GROUP BY day
         ORDER BY day ASC`,
      )
      .all(...usageParams, ...apiParams) as Array<{
      day: string;
      active_users: number;
      llm_calls: number;
      api_calls: number;
      total_tokens: number;
    }>;

    const byDay = new Map(
      rows.map((row) => [
        row.day,
        {
          day: row.day,
          activeUsers: row.active_users,
          llmCalls: row.llm_calls,
          apiCalls: row.api_calls,
          totalTokens: row.total_tokens,
        } satisfies DailyActivityRow,
      ]),
    );

    const startDay = startOfUtcDayMs(sinceMs);
    const endDay = startOfUtcDayMs(nowMs);
    const filled: DailyActivityRow[] = [];
    for (const day of enumerateDays(startDay, endDay)) {
      filled.push(
        byDay.get(day) ?? {
          day,
          activeUsers: 0,
          llmCalls: 0,
          apiCalls: 0,
          totalTokens: 0,
        },
      );
    }
    return filled;
  }

  /** Users with any recorded activity since the given timestamp. */
  getActiveUsers(sinceMs: number): ActiveUserRow[] {
    const rows = this.db
      .prepare(
        `SELECT user_id AS userId,
                SUM(event_count) AS eventCount,
                MAX(last_ts) AS lastTs
         FROM (
           SELECT user_id, COUNT(*) AS event_count, MAX(ts) AS last_ts
           FROM usage_events WHERE ts >= ? GROUP BY user_id
           UNION ALL
           SELECT user_id, COUNT(*) AS event_count, MAX(ts) AS last_ts
           FROM api_call_events WHERE ts >= ? GROUP BY user_id
         )
         GROUP BY user_id
         ORDER BY lastTs DESC`,
      )
      .all(sinceMs, sinceMs) as Array<{
      userId: string;
      eventCount: number;
      lastTs: number;
    }>;
    return rows;
  }

  /**
   * Today's (UTC) backend LLM call count for one user + route — the guard
   * behind webpage-analysis's per-user daily quota (nothing new to schema;
   * this reuses usage_events, which already records one row per call).
   */
  getTodayCallCountForRoute(
    userId: string,
    route: string,
    nowMs: number = Date.now(),
  ): number {
    const dayStart = startOfUtcDayMs(nowMs);
    const row = this.db
      .prepare(
        `SELECT COUNT(*) AS count
         FROM usage_events
         WHERE user_id = ? AND route = ? AND side = 'backend' AND ts >= ?`,
      )
      .get(userId, route, dayStart) as { count: number } | undefined;
    return row?.count ?? 0;
  }

  close(): void {
    try {
      this.db.close();
    } catch {
      // best-effort
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton management
// ---------------------------------------------------------------------------

let _instance: AnalyticsStore | null = null;

/**
 * Initialize the singleton analytics store using the given data directory.
 * The DB lives at `${dataDir}/analytics/usage.db`. Safe to call multiple times
 * (subsequent calls return the existing instance).
 */
export function initAnalyticsStore(dataDir: string): AnalyticsStore | null {
  if (_instance) return _instance;
  try {
    const dbPath = path.join(dataDir, 'analytics', 'usage.db');
    _instance = new AnalyticsStore(dbPath);
    console.log(`[AnalyticsStore] Initialized at ${dbPath}`);
  } catch (err) {
    console.error(
      '[AnalyticsStore] Failed to initialize; usage analytics disabled:',
      err instanceof Error ? err.message : String(err),
    );
    _instance = null;
  }
  return _instance;
}

/** Get the singleton analytics store, or null if not initialized. */
export function getAnalyticsStore(): AnalyticsStore | null {
  return _instance;
}

/** Close and discard the singleton (used on shutdown / in tests). */
export function closeAnalyticsStore(): void {
  if (_instance) {
    _instance.close();
    _instance = null;
  }
}
