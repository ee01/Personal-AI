import type {
  MeetingOutcomeBinder,
  MeetingOutcomeSlot,
  MeetingOutcomeSlotStatus,
} from '../services/MemoryServiceClient';
import type { MeetingPilotSessionSnapshot } from './protocol';

export type MeetingOutcomeLiveState =
  | 'not_seen'
  | 'mentioned'
  | 'evidence_candidate'
  | 'final';

export interface MeetingOutcomeLiveSlot {
  slot: MeetingOutcomeSlot;
  state: MeetingOutcomeLiveState;
  label: string;
  detail: string;
}

function normalizeText(value: unknown): string {
  return String(value || '')
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function keywordSet(value: unknown): Set<string> {
  const normalized = normalizeText(value);
  const tokens = new Set<string>();
  for (const part of normalized.split(' ').filter(Boolean)) {
    if (/^[a-z0-9]+$/.test(part)) {
      if (part.length >= 2) tokens.add(part);
      continue;
    }
    if (part.length <= 4) tokens.add(part);
    for (let index = 0; index < part.length - 1; index += 1) {
      tokens.add(part.slice(index, index + 2));
    }
  }
  return tokens;
}

function overlaps(left: unknown, right: unknown): boolean {
  const leftTokens = keywordSet(left);
  const rightTokens = keywordSet(right);
  return Array.from(leftTokens).some((token) => rightTokens.has(token));
}

export function normalizeMeetingOutcomeBinder(
  value: unknown,
): MeetingOutcomeBinder | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const binder = value as Partial<MeetingOutcomeBinder>;
  if (
    !String(binder.id || '').trim() ||
    !String(binder.prepId || '').trim() ||
    !String(binder.eventTitle || '').trim() ||
    !Array.isArray(binder.slots) ||
    !binder.receipt ||
    typeof binder.receipt !== 'object'
  ) {
    return undefined;
  }
  const slots = binder.slots.filter(
    (slot): slot is MeetingOutcomeSlot =>
      Boolean(
        slot &&
          typeof slot === 'object' &&
          String(slot.id || '').trim() &&
          String(slot.title || '').trim() &&
          String(slot.status || '').trim(),
      ),
  );
  if (!slots.length) return undefined;
  return {
    ...(binder as MeetingOutcomeBinder),
    slots,
    sourceEvidence: Array.isArray(binder.sourceEvidence)
      ? binder.sourceEvidence
      : [],
  };
}

export function getMeetingOutcomeSlotStatusLabel(
  status: MeetingOutcomeSlotStatus,
): string {
  const labels: Record<MeetingOutcomeSlotStatus, string> = {
    planned: '待会议核验',
    resolved: '已闭环',
    partially_resolved: '部分闭环',
    unresolved: '提到但未闭环',
    carried_over: '带到后续',
    blocked_by_missing_evidence: '证据不足',
    discarded_agenda: '已移出议程',
  };
  return labels[status] || status;
}

export function getMeetingOutcomeLiveSlots(
  binder: MeetingOutcomeBinder,
  session: MeetingPilotSessionSnapshot,
): MeetingOutcomeLiveSlot[] {
  const decisions = session.decisions.map((item) => item.text);
  const actions = session.actionItems.map((item) =>
    [item.title, item.owner, item.deadline, item.evidence]
      .filter(Boolean)
      .join(' '),
  );
  const transcript = session.transcript.map((item) => item.text);

  return binder.slots.map((slot) => {
    if (slot.status !== 'planned') {
      return {
        slot,
        state: 'final',
        label: getMeetingOutcomeSlotStatusLabel(slot.status),
        detail: slot.resultSummary || binder.receipt.coverage,
      };
    }
    const hasDecision = decisions.some((text) => overlaps(slot.title, text));
    const hasAction = actions.some((text) => overlaps(slot.title, text));
    if (hasDecision || hasAction) {
      return {
        slot,
        state: 'evidence_candidate',
        label: '待会后核验',
        detail: hasDecision
          ? '已出现相关决议候选，会议结束后按证据装订。'
          : '已出现相关行动项候选，会议结束后按状态装订。',
      };
    }
    if (transcript.some((text) => overlaps(slot.title, text))) {
      return {
        slot,
        state: 'mentioned',
        label: '已提到',
        detail: '目前只有 transcript 提及，不能视为已解决。',
      };
    }
    return {
      slot,
      state: 'not_seen',
      label: '未提到',
      detail: '本场尚未出现可核验线索。',
    };
  });
}

function normalizeTimeMs(value: unknown): number | undefined {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return undefined;
  return numeric < 10_000_000_000 ? numeric * 1000 : numeric;
}

function extractMeetingId(value: unknown): string | undefined {
  const text = String(value || '');
  const match = text.match(/\/conf\/on\/(\d+)/i);
  return match?.[1];
}

function titleOverlapScore(left: unknown, right: unknown): number {
  const leftText = normalizeText(left);
  const rightText = normalizeText(right);
  if (!leftText || !rightText) return 0;
  if (leftText === rightText) return 60;
  if (
    (leftText.length >= 8 && rightText.includes(leftText)) ||
    (rightText.length >= 8 && leftText.includes(rightText))
  ) {
    return 45;
  }
  const leftTokens = keywordSet(leftText);
  const count = Array.from(keywordSet(rightText)).filter((token) =>
    leftTokens.has(token),
  ).length;
  return count >= 2 ? 25 + Math.min(count, 10) : 0;
}

function handoffScore(
  handoff: Record<string, unknown>,
  session: MeetingPilotSessionSnapshot,
): number {
  const event =
    handoff.event && typeof handoff.event === 'object'
      ? (handoff.event as Record<string, unknown>)
      : {};
  const sessionMeetingId = extractMeetingId(session.url) ||
    (/^\d{3,}$/.test(session.meetingId) ? session.meetingId : undefined);
  const eventMeetingId = [event.joinUrl, event.sourceUrl, event.location]
    .map(extractMeetingId)
    .find(Boolean);
  if (sessionMeetingId && eventMeetingId === sessionMeetingId) return 100;

  const eventStart = normalizeTimeMs(event.startTime);
  const eventEnd = normalizeTimeMs(event.endTime) ||
    (eventStart ? eventStart + 2 * 60 * 60 * 1000 : undefined);
  const sessionStart = normalizeTimeMs(
    session.capture.startedAt || session.detectedAt,
  );
  if (
    eventStart &&
    eventEnd &&
    sessionStart &&
    (sessionStart < eventStart - 30 * 60 * 1000 ||
      sessionStart > eventEnd + 60 * 60 * 1000)
  ) {
    return 0;
  }
  return titleOverlapScore(event.title, session.title);
}

export function selectMeetingOutcomeBinderFromStorage(
  payload: Record<string, unknown> | undefined,
  session: MeetingPilotSessionSnapshot,
): MeetingOutcomeBinder | undefined {
  const sessionBinder = normalizeMeetingOutcomeBinder(session.outcomeBinder);
  if (sessionBinder) return sessionBinder;
  if (!payload) return undefined;
  const collection = payload.meetingPrepHandoffs;
  const handoffs: unknown[] = [payload.meetingPrepHandoff];
  if (Array.isArray(collection)) handoffs.push(...collection);
  else if (collection && typeof collection === 'object') {
    handoffs.push(...Object.values(collection as Record<string, unknown>));
  }
  return handoffs
    .filter(
      (item): item is Record<string, unknown> =>
        Boolean(item && typeof item === 'object'),
    )
    .map((handoff) => ({
      binder: normalizeMeetingOutcomeBinder(handoff.outcomeBinder),
      score: handoffScore(handoff, session),
      createdAt: Number(handoff.createdAt || 0),
    }))
    .filter(
      (item): item is {
        binder: MeetingOutcomeBinder;
        score: number;
        createdAt: number;
      } => Boolean(item.binder && item.score > 0),
    )
    .sort(
      (left, right) =>
        right.score - left.score || right.createdAt - left.createdAt,
    )[0]?.binder;
}
