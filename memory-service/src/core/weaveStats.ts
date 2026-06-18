/**
 * weaveStats (P0-5) — "缝合可感知 / weave provenance".
 *
 * The system's differentiated value over "a better search" is cross-source,
 * cross-time stitching: pulling a conclusion together from several sources over
 * a span of days that a human couldn't scan by hand. The lesson from 《置身钉内》
 * is that this stitching must be *made visible* — otherwise the user's mental
 * comparison is "I could've found this myself" and they discount it.
 *
 * This module computes a lightweight stat over the evidence behind a synthesized
 * result so the UI can render a "stitched N sources × M days" badge. It is a
 * pure function over already-retrieved items — zero extra queries.
 *
 * Anti-inflation: the badge only makes sense when stitching actually happened.
 * `crossSource` is true only when ≥2 distinct sources or a ≥7-day span; callers
 * should omit the weave field entirely when `crossSource` is false, so
 * single-source results don't get a meaningless badge.
 */

export interface WeaveStats {
  /** Distinct source kinds behind the result. */
  sourceCount: number;
  /** The distinct source kinds (e.g. ['ringcentral','jira','web']). */
  sourceKinds: string[];
  /** Span in days between the earliest and latest evidence. */
  daySpanDays: number;
  /** Distinct entities referenced across the evidence. */
  entityCount: number;
  /** Whether stitching is significant enough to surface a badge. */
  crossSource: boolean;
}

/** Minimal shape needed to compute weave stats (a subset of RecallItem). */
export interface WeaveInput {
  type?: string;
  source?: string;
  timestamp?: number;
  id?: string;
  entity?: { id?: string } | null;
  metadata?: Record<string, unknown> | null;
}

const DAY_SECONDS = 86_400;
const CROSS_SOURCE_MIN_SOURCES = 2;
const CROSS_SOURCE_MIN_DAYS = 7;

/**
 * Compute weave stats over a set of evidence items. Returns `crossSource:false`
 * (and the caller should then omit the field) when the result is single-source
 * and within a week.
 */
export function buildWeaveStats(items: WeaveInput[]): WeaveStats {
  const sources = new Set<string>();
  const entities = new Set<string>();
  const timestamps: number[] = [];

  for (const item of items) {
    const source = (item.source ?? '').trim();
    if (source) sources.add(source.toLowerCase());

    if (typeof item.timestamp === 'number' && Number.isFinite(item.timestamp)) {
      timestamps.push(item.timestamp);
    }

    // Entity references: entity-type items by id, plus a linked entity id.
    if (item.type === 'entity' && item.id) entities.add(item.id);
    if (item.entity?.id) entities.add(item.entity.id);
  }

  const daySpanDays =
    timestamps.length >= 2
      ? Math.floor((Math.max(...timestamps) - Math.min(...timestamps)) / DAY_SECONDS)
      : 0;

  const sourceCount = sources.size;
  const crossSource =
    sourceCount >= CROSS_SOURCE_MIN_SOURCES || daySpanDays >= CROSS_SOURCE_MIN_DAYS;

  return {
    sourceCount,
    sourceKinds: Array.from(sources),
    daySpanDays,
    entityCount: entities.size,
    crossSource,
  };
}
