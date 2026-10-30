import type {
  MemoryBenchmarkAdapter,
  PersonalMemoryEvent,
  ProbePoint,
} from "../types.js";
import { probeCheckpointKind } from "../scene/adapter-input.js";
import { AuthorityFixtureStore } from "./authority-fixture.js";
import { filterVisibleEvents, parseVirtualMs, virtualDayKey } from "./virtual-time.js";
import { NotificationSink } from "../sink/notification-sink.js";

export interface ReplayCheckpoint {
  kind: "pre_consolidation" | "post_consolidation" | "event_batch";
  virtual_now: string;
  virtual_day: string;
  event_count_visible: number;
}

export interface VirtualReplayOptions {
  /** @deprecated Use per-probe `checkpoint` on ProbePoint. */
  probeCheckpoint?: "pre_consolidation" | "post_consolidation";
}

export interface VirtualReplayCallbacks {
  onCheckpoint?: (checkpoint: ReplayCheckpoint) => Promise<void>;
}

export interface VirtualReplayStats {
  virtual_now: string;
  events_ingested: number;
  consolidations: number;
  checkpoints: ReplayCheckpoint[];
}

/**
 * Discrete event replay with virtual business clock.
 * Does not modify system clock. At most one consolidation per virtual UTC day.
 */
export async function runVirtualReplay(
  adapter: MemoryBenchmarkAdapter,
  events: PersonalMemoryEvent[],
  authority: AuthorityFixtureStore,
  sink: NotificationSink,
  _options: VirtualReplayOptions = {},
  callbacks: VirtualReplayCallbacks = {},
): Promise<VirtualReplayStats> {
  const checkpoints: ReplayCheckpoint[] = [];
  let virtualNow = events[0]?.observed_at ?? new Date(0).toISOString();
  let eventsIngested = 0;
  let consolidations = 0;
  const consolidatedDays = new Set<string>();

  let i = 0;
  while (i < events.length) {
    const batchDay = virtualDayKey(events[i]!.observed_at);
    while (i < events.length && virtualDayKey(events[i]!.observed_at) === batchDay) {
      const ev = events[i]!;
      virtualNow = ev.observed_at;
      await adapter.ingest(ev);
      eventsIngested++;
      i++;
    }

    const visible = filterVisibleEvents(events.slice(0, i), virtualNow);
    checkpoints.push({
      kind: "event_batch",
      virtual_now: virtualNow,
      virtual_day: batchDay,
      event_count_visible: visible.length,
    });
    await callbacks.onCheckpoint?.(checkpoints[checkpoints.length - 1]!);

    if (!consolidatedDays.has(batchDay)) {
      // Jump to end of virtual day before consolidation (compresses "wait until midnight").
      virtualNow = `${batchDay}T23:59:59.999Z`;
      const visibleEod = filterVisibleEvents(events.slice(0, i), virtualNow);

      checkpoints.push({
        kind: "pre_consolidation",
        virtual_now: virtualNow,
        virtual_day: batchDay,
        event_count_visible: visibleEod.length,
      });
      await callbacks.onCheckpoint?.(checkpoints[checkpoints.length - 1]!);

      await adapter.consolidate(virtualNow);
      consolidations++;
      consolidatedDays.add(batchDay);

      checkpoints.push({
        kind: "post_consolidation",
        virtual_now: virtualNow,
        virtual_day: batchDay,
        event_count_visible: visibleEod.length,
      });
      await callbacks.onCheckpoint?.(checkpoints[checkpoints.length - 1]!);
    }

    void authority;
    void sink;
  }

  return {
    virtual_now: virtualNow,
    events_ingested: eventsIngested,
    consolidations,
    checkpoints,
  };
}

export function probesDueAtCheckpoint(
  probes: ProbePoint[],
  checkpoint: ReplayCheckpoint,
): ProbePoint[] {
  if (checkpoint.kind !== "pre_consolidation" && checkpoint.kind !== "post_consolidation") {
    return [];
  }
  const day = checkpoint.virtual_day;
  const cpMs = parseVirtualMs(checkpoint.virtual_now);
  return probes.filter((p) => {
    if (probeCheckpointKind(p) !== checkpoint.kind) return false;
    const probeDay = virtualDayKey(p.as_of);
    if (probeDay !== day) return false;
    return parseVirtualMs(p.as_of) <= cpMs;
  });
}
