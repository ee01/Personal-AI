/**
 * Scheme A — in-process Personal AI memory-service harness adapter.
 * Uses isolated user storage under experiments/memory-benchmark/.local/ (gitignored).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type Database from 'better-sqlite3';

import { runWithBusinessClockAtAsync } from '../clock/businessClock.js';
import { ActiveRecallService } from '../core/ActiveRecallService.js';
import { IngestionPipeline } from '../core/IngestionPipeline.js';
import { SleepReconciliation } from '../core/v3/SleepReconciliation.js';
import { MemoryLineageService } from '../core/MemoryLineageService.js';
import { UserContextManager } from '../core/UserContextManager.js';
import type { IngestPayload, RecallScope, SourceType } from '../types/index.js';
import { resetConfigForTests } from '../config.js';
import {
  applyBaselineBenchmarkLlmEnv,
  isBenchmarkLiveLlmEnabled,
} from './benchmarkLlmEnv.js';

export type BenchmarkAblationMode =
  | 'none'
  | 'raw_hybrid_only'
  | 'no_background_consolidation'
  | 'no_link_precalc';

const BENCHMARK_USER_ID = 'benchmark-scheme-a';

function applyHarnessServiceEnv(): void {
  process.env.MEMORY_CONSOLIDATION_V3 ??= 'A';
  process.env.MEMORY_WRITE_V3_SHADOW ??= 'false';
  process.env.MEMORY_READ_V3_VECTOR ??= '';
  process.env.MEMORY_READ_V3_RECALL_SHADOW ??= 'false';
  process.env.PROACTIVE_SCHEDULER_ENABLED ??= 'false';
  process.env.PROACTIVE_BACKGROUND_ENABLED ??= 'false';
  process.env.RECONCILE_B_MODE ??= 'off';
  process.env.RECONCILE_C_MODE ??= 'off';
  resetConfigForTests();
}

export interface HarnessPersonalMemoryEvent {
  event_id: string;
  source: string;
  source_type: string;
  occurred_at: string;
  observed_at: string;
  scope: string;
  group_id: string | null;
  thread_root: string | null;
  sender: string | null;
  text: string;
  metadata: Record<string, unknown>;
  acl: { scope: string; trust_class: string | null };
  provenance: Record<string, unknown>;
}

export interface HarnessRecallQuery {
  text: string;
  scope: string;
}

export interface HarnessRecallHit {
  event_id?: string;
  text: string;
  observed_at?: string;
  scope?: string;
}

export interface HarnessRecallResult {
  hits: HarnessRecallHit[];
  latency_ms: number;
  cached_replay?: boolean;
}

export interface HarnessDecideInput {
  scene: string;
  as_of: string;
  scope: string;
  context: {
    scene_id?: string;
    text?: string;
    entity_ids?: string[];
    thread_id?: string | null;
    group_id?: string | null;
    recall_query?: string;
  };
}

export interface HarnessDecideResult {
  action: string;
  output_text: string;
  cited_event_ids: string[];
  latency_ms: number;
  cached_replay?: boolean;
}

export interface HarnessConsolidateResult {
  virtual_day: string;
  latency_ms: number;
  cached_replay?: boolean;
}

export interface BaselineMemoryAdapter {
  readonly schemeId: string;
  ingest(event: HarnessPersonalMemoryEvent): Promise<void>;
  consolidate(virtualNow: string): Promise<HarnessConsolidateResult>;
  recall(
    query: HarnessRecallQuery,
    asOf: string,
    scope: string,
  ): Promise<HarnessRecallResult>;
  decide(input: HarnessDecideInput): Promise<HarnessDecideResult>;
  export(): Promise<Record<string, unknown>>;
  delete(eventId: string): Promise<void>;
  revoke(scope: string): Promise<void>;
  close(): Promise<void>;
}

function parseVirtualSec(iso: string): number {
  return Math.floor(new Date(iso).getTime() / 1000);
}

function mapSourceType(sourceType: string): SourceType {
  if (sourceType === 'glip') return 'glip';
  if (sourceType === 'daily') return 'manual';
  if (sourceType === 'jira') return 'jira';
  if (sourceType === 'web') return 'web';
  return 'manual';
}

function defaultDataRoot(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, '../../../experiments/memory-benchmark/.local/baseline-data');
}

export interface CreateBaselineAdapterOptions {
  schemeId?: string;
  dataRoot?: string;
  fresh?: boolean;
  /** When set, route memory-service LLM calls through this OpenAI-compatible base (proxy). */
  openAiBaseUrl?: string;
  modelsConfigPath?: string;
  /** Default: true when OPENROUTER_API_KEY is set and openAiBaseUrl provided. */
  liveLlm?: boolean;
  ablation?: BenchmarkAblationMode;
}

function readProxyGenerationIds(): string[] {
  const ledgerPath = process.env.MEMORY_BENCHMARK_PROXY_LEDGER?.trim();
  if (!ledgerPath || !fs.existsSync(ledgerPath)) return [];
  const ids: string[] = [];
  for (const line of fs.readFileSync(ledgerPath, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      const row = JSON.parse(line) as { generation_id?: string | null; scheme_id?: string };
      if (row.scheme_id && row.scheme_id !== 'A') continue;
      if (row.generation_id) ids.push(row.generation_id);
    } catch {
      /* skip */
    }
  }
  return ids;
}

export async function createBaselineMemoryAdapter(
  options: CreateBaselineAdapterOptions = {},
): Promise<BaselineMemoryAdapter> {
  applyHarnessServiceEnv();
  if (options.openAiBaseUrl) {
    const live =
      options.liveLlm ??
      Boolean(process.env.OPENROUTER_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim());
    applyBaselineBenchmarkLlmEnv({
      openAiBaseUrl: options.openAiBaseUrl,
      modelsPath: options.modelsConfigPath,
      enableLive: live,
    });
  }
  const schemeId = options.schemeId ?? 'A';
  const ablation = options.ablation ?? 'none';
  const useLiveExtraction = isBenchmarkLiveLlmEnabled();
  const dataRoot = options.dataRoot ?? defaultDataRoot();
  const usersDir = path.join(dataRoot, 'users', BENCHMARK_USER_ID);

  if (options.fresh !== false && fs.existsSync(usersDir)) {
    fs.rmSync(usersDir, { recursive: true, force: true });
  }
  fs.mkdirSync(dataRoot, { recursive: true });

  const userContextManager = new UserContextManager(dataRoot, 30 * 60 * 1000, {
    disableIdleEviction: true,
  });
  const ctx = userContextManager.getContext(BENCHMARK_USER_ID);
  const db = ctx.db;
  const pipeline = new IngestionPipeline(db, ctx.userDataManager, BENCHMARK_USER_ID);
  const recallService = new ActiveRecallService(db);
  const sleep = new SleepReconciliation(db);

  const eventToMessage = new Map<string, string>();
  const messageToEvent = new Map<string, string>();
  const deletedEvents = new Set<string>();
  const revokedScopes = new Set<string>();
  const recallCache = new Map<string, HarnessRecallResult>();
  const consolidationDays = new Set<string>();
  const derivedSnippets: string[] = [];
  let inFlightConsolidation: string | null = null;

  const toPayload = (event: HarnessPersonalMemoryEvent): IngestPayload => ({
    content: event.text,
    sourceType: mapSourceType(event.source_type),
    scope: (event.scope === 'personal' ? 'personal' : 'work') as 'work' | 'personal',
    source: event.source,
    sender: event.sender ?? undefined,
    groupId: event.group_id ?? undefined,
    timestamp: parseVirtualSec(event.observed_at),
    skipExtraction: !useLiveExtraction,
    metadata: {
      ...event.metadata,
      postId: event.event_id,
      benchmarkEventId: event.event_id,
      importance: 0.85,
    },
  });

  const cacheKey = (query: HarnessRecallQuery, asOf: string, scope: string) =>
    `${scope}|${asOf}|${query.text}`;

  const purgeDerivedForEvent = (eventId: string) => {
    for (const [key, result] of recallCache) {
      if (result.hits.some((h) => h.event_id === eventId)) recallCache.delete(key);
    }
    for (let i = derivedSnippets.length - 1; i >= 0; i--) {
      if (derivedSnippets[i]!.includes(eventId)) derivedSnippets.splice(i, 1);
    }
  };

  const adapter: BaselineMemoryAdapter = {
    schemeId,

    async ingest(event) {
      if (deletedEvents.has(event.event_id)) return;
      const atSec = parseVirtualSec(event.observed_at);
      await runWithBusinessClockAtAsync(atSec, async () => {
        const result = await pipeline.ingest(toPayload(event));
        if (result.id) {
          eventToMessage.set(event.event_id, result.id);
          messageToEvent.set(result.id, event.event_id);
        }
      });
    },

    async consolidate(virtualNow) {
      const day = virtualNow.slice(0, 10);
      const atSec = parseVirtualSec(virtualNow);
      const t0 = performance.now();
      if (ablation === 'no_background_consolidation') {
        consolidationDays.add(day);
        return {
          virtual_day: day,
          latency_ms: performance.now() - t0,
          cached_replay: true,
        };
      }
      inFlightConsolidation = day;
      await runWithBusinessClockAtAsync(atSec, async () => {
        if (ablation !== 'no_link_precalc') {
          await sleep.run(atSec);
        }
      });
      consolidationDays.add(day);
      derivedSnippets.push(`consolidation:${day}`);
      inFlightConsolidation = null;
      return {
        virtual_day: day,
        latency_ms: performance.now() - t0,
        cached_replay: false,
      };
    },

    async recall(query, asOf, scope) {
      const t0 = performance.now();
      if (revokedScopes.has(scope)) {
        return { hits: [], latency_ms: performance.now() - t0, cached_replay: false };
      }

      const key = cacheKey(query, asOf, scope);
      const cached = recallCache.get(key);
      if (cached) {
        return { ...cached, latency_ms: performance.now() - t0, cached_replay: true };
      }

      const atSec = parseVirtualSec(asOf);
      const recallChannels =
        ablation === 'raw_hybrid_only' || ablation === 'no_link_precalc'
          ? (['fts', 'vector'] as const)
          : undefined;
      const hits: HarnessRecallHit[] = await runWithBusinessClockAtAsync(atSec, async () => {
        const result = await recallService.recall({
          query: query.text,
          scope: scope as RecallScope,
          topK: 8,
          ...(recallChannels ? { channels: [...recallChannels] } : {}),
        });
        return (result.items ?? [])
          .filter((item) => {
            const ts = item.timestamp ?? 0;
            if (ts > atSec) return false;
            const eventId = messageToEvent.get(item.id);
            if (!eventId || deletedEvents.has(eventId)) return false;
            return true;
          })
          .slice(0, 8)
          .map((item) => {
            const eventId = messageToEvent.get(item.id);
            return {
              event_id: eventId,
              text: item.displayText || item.content || '',
              observed_at: item.timestamp
                ? new Date(item.timestamp * 1000).toISOString()
                : undefined,
              scope,
            };
          });
      });

      const result: HarnessRecallResult = {
        hits,
        latency_ms: performance.now() - t0,
        cached_replay: false,
      };
      recallCache.set(key, result);
      for (const hit of hits) {
        if (hit.event_id) derivedSnippets.push(`derived:${hit.event_id}`);
      }
      return result;
    },

    async decide(input) {
      const t0 = performance.now();
      const sceneText = (input.context.text ?? input.context.recall_query ?? '').trim();
      const recall = await adapter.recall(
        { text: sceneText || ' ', scope: input.scope },
        input.as_of,
        input.scope,
      );

      const tokens = sceneText
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 2);

      if (tokens.length === 0 || recall.hits.length === 0) {
        return {
          action: 'silence',
          output_text: '',
          cited_event_ids: [],
          latency_ms: performance.now() - t0,
        };
      }

      const ranked = recall.hits
        .map((hit) => {
          const text = hit.text.toLowerCase();
          const score = tokens.filter((t) => text.includes(t)).length;
          return { hit, score };
        })
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score);

      if (ranked.length === 0) {
        return {
          action: 'silence',
          output_text: '',
          cited_event_ids: [],
          latency_ms: performance.now() - t0,
        };
      }

      const pick = ranked[0]!.hit;
      const action =
        input.scene === 'proactive_discovery' ? 'send_notification' : 'show_sidecar';
      return {
        action,
        output_text: pick.text,
        cited_event_ids: pick.event_id ? [pick.event_id] : [],
        latency_ms: performance.now() - t0,
      };
    },

    async export() {
      const liveEvents = [...eventToMessage.keys()].filter((id) => !deletedEvents.has(id));
      const recallCacheEventIds = [
        ...new Set(
          [...recallCache.values()].flatMap((r) =>
            r.hits.map((h) => h.event_id).filter((id): id is string => Boolean(id)),
          ),
        ),
      ];
      let reconcile_nightly_runs: unknown[] = [];
      try {
        reconcile_nightly_runs = db
          .prepare(
            `SELECT night, started_at, finished_at, trigger_kind FROM reconcile_nightly_runs ORDER BY night DESC LIMIT 8`,
          )
          .all();
      } catch {
        /* v3 tables optional in older DBs */
      }
      return {
        event_count: liveEvents.length,
        evidence_event_ids: liveEvents,
        consolidation_days: [...consolidationDays],
        deleted: [...deletedEvents],
        revoked: [...revokedScopes],
        recall_cache_keys: [...recallCache.keys()],
        recall_cache_event_ids: recallCacheEventIds,
        derived_snippets: [...derivedSnippets],
        in_flight_consolidation: inFlightConsolidation,
        reconcile_nightly_runs,
        user_id: BENCHMARK_USER_ID,
        data_root: dataRoot,
        live_llm: useLiveExtraction,
        ablation_mode: ablation,
        openrouter_generation_ids: readProxyGenerationIds(),
      };
    },

    async delete(eventId) {
      deletedEvents.add(eventId);
      const messageId = eventToMessage.get(eventId);
      if (messageId) {
        try {
          deleteMessageCascade(db, messageId);
        } catch (err) {
          console.warn(
            '[baseline-adapter] delete cascade degraded:',
            (err as Error).message,
          );
        }
      }
      purgeDerivedForEvent(eventId);
      recallCache.clear();
    },

    async revoke(scope) {
      revokedScopes.add(scope);
      recallCache.clear();
      derivedSnippets.push(`revoked:scope:${scope}`);
    },

    async close() {
      userContextManager.resetContext(BENCHMARK_USER_ID);
    },
  };

  return adapter;
}

function deleteMessageCascade(db: Database.Database, messageId: string): void {
  const chunkRows = db
    .prepare(`SELECT chunk_id FROM chunks WHERE related_entity_id = ?`)
    .all(messageId) as Array<{ chunk_id: number }>;
  const chunkIds = chunkRows.map((r) => r.chunk_id);

  db.transaction(() => {
    new MemoryLineageService(db).applyCascade([messageId]);
    if (chunkIds.length) {
      const ph = chunkIds.map(() => 'CAST(? AS INTEGER)').join(', ');
      try {
        db.prepare(`DELETE FROM chunks_vec WHERE chunk_id IN (${ph})`).run(...chunkIds);
      } catch {
        /* vec table optional */
      }
      db.prepare(`DELETE FROM chunks WHERE chunk_id IN (${ph})`).run(...chunkIds);
      const strs = chunkIds.map(String);
      db.prepare(
        `DELETE FROM memory_metadata WHERE target_type = 'chunk' AND target_id IN (${strs.map(() => '?').join(',')})`,
      ).run(...strs);
    }
    try {
      db.prepare(`DELETE FROM messages_vec WHERE message_id = ?`).run(messageId);
    } catch {
      /* optional */
    }
    db.prepare(`DELETE FROM messages_raw WHERE id = ?`).run(messageId);
    db.prepare(
      `DELETE FROM memory_metadata WHERE target_type = 'message' AND target_id = ?`,
    ).run(messageId);
  })();
}
