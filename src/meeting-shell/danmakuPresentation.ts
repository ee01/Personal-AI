import type { MeetingPilotMemoryRef } from './protocol';

/**
 * Danmaku presentation rules for Meeting Pilot.
 *
 * Meeting danmaku is a one-line rolling surface: a memory that is relevant to
 * the live conversation scrolls across the meeting page. Two product rules live
 * here so they are testable outside the content script:
 *
 * 1. The rolling pill shows the *compressed* gist of the associated memory. The
 *    canonical gist is produced once at storage time (LLM summary) and framed
 *    at recall time (relation label / why-now), so the danmaku never has to
 *    invent a sentence or show a raw content prefix.
 * 2. Hovering expands the *original* memory text plus its time. We show the
 *    real information time (message send time / source time) as the primary
 *    label, because that is the anchor a person recalls in a meeting. The
 *    recall-match time is only a fallback, and it is labelled as such instead of
 *    being presented as if it were when the information happened.
 */

export const DANMAKU_ONE_LINE_MAX = 120;
export const DANMAKU_DETAIL_MAX = 800;
/** Extra distance before the pill fully enters the viewport from the right. */
export const DANMAKU_START_GAP = 48;
/** Extra distance after the pill leaves the viewport on the left. */
export const DANMAKU_END_MARGIN = 240;

export interface DanmakuCuePresentation {
  /** Collapsed sentence shown while the pill is rolling. */
  oneLine: string;
  /** Expanded detail heading (original memory title), when it adds information. */
  detailTitle?: string;
  /** Expanded original memory text. */
  detail: string;
  /**
   * Why this memory is relevant (relation label / role / score). Deliberately
   * kept out of the rolling pill: a text prefix steals width from the sentence,
   * so it is only shown in the expanded hover detail.
   */
  contextLabel?: string;
  /** Expanded time label, e.g. `消息时间`. */
  timeLabel?: string;
  /** Expanded time value, e.g. `2026-05-12 14:03`. */
  timeValue?: string;
}

export interface DanmakuTravelMetrics {
  /** translateX offset where the pill is parked off-screen right. */
  startX: number;
  /** translateX offset where the pill has fully left the viewport. */
  endX: number;
}

export function normalizeDanmakuText(value?: string | null): string {
  return String(value ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/[ \t\u00a0]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}

/** Take the first complete sentence so a rolling pill never shows a clause. */
export function toDanmakuSentence(value: string): string {
  const text = normalizeDanmakuText(value).replace(/\n+/g, ' ');
  if (!text) return '';
  const match = text.match(/^[^。！？!?]*[。！？!?]/);
  const sentence = (match ? match[0] : text).trim();
  return sentence || text;
}

export function clipDanmakuText(value: string, maxLength: number): string {
  const text = normalizeDanmakuText(value);
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trimEnd()}…`;
}

function firstNonEmpty(...values: Array<string | undefined>): string {
  for (const value of values) {
    const normalized = normalizeDanmakuText(value);
    if (normalized) return normalized;
  }
  return '';
}

/**
 * Collapsed one-line text: prefer the stored LLM gist (`cueLine`), then the
 * recall-time summary, then the extractive preview. Always reduced to a single
 * sentence so the pill reads as one line instead of a cut-off fragment.
 */
export function resolveDanmakuCueLine(ref: MeetingPilotMemoryRef): string {
  const candidate = firstNonEmpty(
    ref.cueLine,
    ref.cueBody,
    ref.snippet,
    ref.evidenceSnippet,
    ref.title,
    ref.cueTitle,
  );
  if (!candidate) return '';
  return clipDanmakuText(toDanmakuSentence(candidate), DANMAKU_ONE_LINE_MAX);
}

/**
 * Why this memory is on screen (relation / role / score). This is expanded-only
 * context: the rolling pill keeps just an icon plus the sentence so the text is
 * not squeezed by a prefix.
 */
export function resolveDanmakuContextLabel(
  ref: MeetingPilotMemoryRef,
): string {
  const label =
    normalizeDanmakuText(ref.relationLabel) ||
    normalizeDanmakuText(ref.evidenceRoleLabel);
  if (label) return label;
  return `关联 ${Math.round((ref.score || 0) * 100)}%`;
}

/** Expanded original memory text. */
export function resolveDanmakuDetail(ref: MeetingPilotMemoryRef): string {
  const detail = firstNonEmpty(
    ref.fullSnippet,
    ref.evidenceSnippet,
    ref.cueBody,
    ref.snippet,
    ref.cueLine,
    ref.title,
    ref.cueTitle,
  );
  return clipDanmakuText(detail, DANMAKU_DETAIL_MAX);
}

function resolveDanmakuDetailTitle(
  ref: MeetingPilotMemoryRef,
  detail: string,
): string | undefined {
  const title = firstNonEmpty(ref.title, ref.cueTitle);
  if (!title) return undefined;
  const comparable = (value: string) => value.replace(/\s+/g, '');
  if (comparable(title) === comparable(detail)) return undefined;
  return clipDanmakuText(title, 120) || undefined;
}

function toEpochMs(value?: number): number | undefined {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return parsed < 10_000_000_000 ? parsed * 1000 : parsed;
}

/** Deterministic local time formatting so behaviour is testable. */
export function formatDanmakuTimestamp(value: number): string {
  const date = new Date(value);
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function resolveSourceTimeLabel(ref: MeetingPilotMemoryRef): string {
  switch (ref.type) {
    case 'message':
      return '消息时间';
    case 'source_memory':
      return '资料时间';
    case 'rehearsal':
      return '预演时间';
    default:
      return '记录时间';
  }
}

export function resolveDanmakuTime(
  ref: MeetingPilotMemoryRef,
): { label: string; value: string } | undefined {
  const sourceTs = toEpochMs(ref.timestamp);
  if (sourceTs) {
    return {
      label: resolveSourceTimeLabel(ref),
      value: formatDanmakuTimestamp(sourceTs),
    };
  }
  const matchedTs = toEpochMs(ref.matchedAt);
  if (matchedTs) {
    return {
      label: '记忆匹配于',
      value: formatDanmakuTimestamp(matchedTs),
    };
  }
  return undefined;
}

export function buildDanmakuCuePresentation(
  ref: MeetingPilotMemoryRef,
): DanmakuCuePresentation {
  const oneLine = resolveDanmakuCueLine(ref);
  const detail = resolveDanmakuDetail(ref) || oneLine;
  const time = resolveDanmakuTime(ref);
  return {
    oneLine: oneLine || detail,
    detailTitle: resolveDanmakuDetailTitle(ref, detail),
    detail,
    contextLabel: resolveDanmakuContextLabel(ref),
    timeLabel: time?.label,
    timeValue: time?.value,
  };
}

/**
 * px offsets for the rolling animation. Using absolute pixels (instead of
 * percentage keyframes) keeps the pill's position stable when hover expands it,
 * which is what lets pause/resume continue from the same spot.
 */
export function buildDanmakuTravelMetrics(args: {
  itemWidth: number;
  viewportWidth: number;
}): DanmakuTravelMetrics {
  const width = Number.isFinite(args.itemWidth) ? Math.max(0, args.itemWidth) : 0;
  const viewport = Number.isFinite(args.viewportWidth)
    ? Math.max(0, args.viewportWidth)
    : 0;
  return {
    startX: width + DANMAKU_START_GAP,
    endX: -(viewport + DANMAKU_END_MARGIN),
  };
}
