import type {
  ConsolidateResult,
  DecideInput,
  DecideResult,
  MemoryBenchmarkAdapter,
  PersonalMemoryEvent,
  RecallQuery,
  RecallResult,
  SceneInput,
} from "../src/types.js";
import { isVisibleAt } from "../src/clock/virtual-time.js";

/**
 * Reference adapter for harness smoke tests — keyword recall, no LLM.
 * Uses only adapter-visible scene fields (never golden rubric).
 */
export class StubMemoryAdapter implements MemoryBenchmarkAdapter {
  readonly schemeId: string;
  private events: PersonalMemoryEvent[] = [];
  private consolidationDays = new Set<string>();
  private deleted = new Set<string>();
  private revoked = new Set<string>();
  private recallCache = new Map<string, RecallResult>();
  private derivedSnippets: string[] = [];
  private inFlightConsolidation: string | null = null;

  constructor(schemeId = "stub") {
    this.schemeId = schemeId;
  }

  async ingest(event: PersonalMemoryEvent): Promise<void> {
    if (this.deleted.has(event.event_id)) return;
    this.events.push({ ...event });
  }

  async consolidate(virtualNow: string): Promise<ConsolidateResult> {
    const day = virtualNow.slice(0, 10);
    this.inFlightConsolidation = day;
    this.consolidationDays.add(day);
    this.derivedSnippets.push(`consolidation:${day}`);
    this.inFlightConsolidation = null;
    return { virtual_day: day, latency_ms: 1, cached_replay: false };
  }

  private sceneText(context: SceneInput): string {
    return (context.text ?? "").trim();
  }

  private cacheKey(query: RecallQuery, asOf: string, scope: string): string {
    return `${scope}|${asOf}|${query.text}`;
  }

  private purgeEventFromDerived(eventId: string): void {
    for (const [key, result] of this.recallCache) {
      if (result.hits.some((h) => h.event_id === eventId)) {
        this.recallCache.delete(key);
      }
    }
    this.derivedSnippets = this.derivedSnippets.filter(
      (s) => !s.includes(eventId) && !this.deleted.has(eventId),
    );
  }

  private purgeScopeFromDerived(scope: string): void {
    for (const [key, result] of this.recallCache) {
      if (result.hits.some((h) => h.scope === scope)) {
        this.recallCache.delete(key);
      }
    }
    this.derivedSnippets = this.derivedSnippets.filter((s) => !s.includes(`scope:${scope}`));
  }

  async recall(query: RecallQuery, asOf: string, scope: string): Promise<RecallResult> {
    const t0 = performance.now();
    if (this.revoked.has(scope)) {
      return { hits: [], latency_ms: performance.now() - t0, cached_replay: false };
    }

    const key = this.cacheKey(query, asOf, scope);
    const cached = this.recallCache.get(key);
    if (cached) {
      return { ...cached, latency_ms: performance.now() - t0, cached_replay: true };
    }

    const q = query.text.toLowerCase();
    const token = q.split(/\s+/).find((w) => w.length > 2) ?? "";
    const hits = this.events
      .filter(
        (e) =>
          !this.deleted.has(e.event_id) &&
          !this.revoked.has(e.scope) &&
          e.scope === scope &&
          isVisibleAt(e, asOf) &&
          (token.length === 0 || e.text.toLowerCase().includes(token)),
      )
      .slice(0, 5)
      .map((e) => ({
        event_id: e.event_id,
        text: e.text,
        observed_at: e.observed_at,
        scope: e.scope,
      }));

    const result: RecallResult = {
      hits,
      latency_ms: performance.now() - t0,
      cached_replay: false,
    };
    this.recallCache.set(key, result);
    for (const hit of hits) {
      if (hit.event_id) {
        this.derivedSnippets.push(`derived:${hit.event_id}`);
      }
    }
    return result;
  }

  async decide(input: DecideInput): Promise<DecideResult> {
    const t0 = performance.now();
    const sceneText = this.sceneText(input.context);
    const tokens = sceneText
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2);

    if (tokens.length === 0) {
      return {
        action: "silence",
        output_text: "",
        cited_event_ids: [],
        latency_ms: performance.now() - t0,
      };
    }

    const visible = this.events.filter(
      (e) =>
        !this.deleted.has(e.event_id) &&
        !this.revoked.has(e.scope) &&
        e.scope === input.scope &&
        isVisibleAt(e, input.as_of),
    );

    const ranked = visible
      .map((ev) => {
        const text = ev.text.toLowerCase();
        const score = tokens.filter((t) => text.includes(t)).length;
        return { ev, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score);

    if (ranked.length === 0) {
      return {
        action: "silence",
        output_text: "",
        cited_event_ids: [],
        latency_ms: performance.now() - t0,
      };
    }

    const pick = ranked[0]!.ev;
    const action =
      input.scene === "proactive_discovery" ? "send_notification" : "show_sidecar";
    return {
      action,
      output_text: pick.text,
      cited_event_ids: [pick.event_id],
      latency_ms: performance.now() - t0,
    };
  }

  async export(): Promise<Record<string, unknown>> {
    const liveEvents = this.events.filter((e) => !this.deleted.has(e.event_id));
    const recallCacheEventIds = [
      ...new Set(
        [...this.recallCache.values()].flatMap((r) =>
          r.hits.map((h) => h.event_id).filter((id): id is string => Boolean(id)),
        ),
      ),
    ];
    return {
      event_count: liveEvents.length,
      consolidation_days: [...this.consolidationDays],
      deleted: [...this.deleted],
      revoked: [...this.revoked],
      recall_cache_keys: [...this.recallCache.keys()],
      recall_cache_event_ids: recallCacheEventIds,
      derived_snippets: [...this.derivedSnippets],
      in_flight_consolidation: this.inFlightConsolidation,
    };
  }

  async delete(eventId: string): Promise<void> {
    this.deleted.add(eventId);
    this.purgeEventFromDerived(eventId);
    this.recallCache.clear();
  }

  async revoke(scope: string): Promise<void> {
    this.revoked.add(scope);
    this.purgeScopeFromDerived(scope);
    this.recallCache.clear();
    this.derivedSnippets.push(`revoked:scope:${scope}`);
  }
}
