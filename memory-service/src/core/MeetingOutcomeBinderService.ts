import type Database from 'better-sqlite3';

import { getLLMClient, type LLMClient } from '../llm/LLMClient.js';
import {
  MeetingOutcomeBinderRepository,
} from '../repositories/MeetingOutcomeBinderRepository.js';
import type {
  ComposerAssistEvidence,
  ContextAssistCueCard,
  ContextAssistMeetingEvent,
  MeetingOutcomeBindInput,
  MeetingOutcomeBinder,
  MeetingOutcomeCandidateSlot,
  MeetingOutcomeEvidence,
  MeetingOutcomeSlot,
  MeetingOutcomeSlotStatus,
  MeetingOutcomeSlotType,
} from '../types/index.js';
import { contentHash } from '../utils/hashing.js';
import { redactMeetingCredentials } from '../utils/meetingCredentialRedaction.js';

interface PreviewFromMeetingPrepInput {
  prepId: string;
  event: ContextAssistMeetingEvent;
  userGoal?: string;
  cueCards: ContextAssistCueCard[];
  questions: string[];
  evidenceRefs: ComposerAssistEvidence[];
  candidateSlots?: MeetingOutcomeCandidateSlot[];
  sourceHash: string;
  generatedAt?: number;
}

interface BindLlmSlot {
  slotId?: string;
  status?: MeetingOutcomeSlotStatus;
  resultSummary?: string;
  confidence?: number;
  evidenceRefs?: string[];
}

interface BindLlmResponse {
  slots?: BindLlmSlot[];
}

const SLOT_STATUSES = new Set<MeetingOutcomeSlotStatus>([
  'resolved',
  'partially_resolved',
  'unresolved',
  'carried_over',
  'blocked_by_missing_evidence',
  'discarded_agenda',
]);

const SLOT_TYPES = new Set<MeetingOutcomeSlotType>([
  'decision',
  'action',
  'open_question',
  'fact_update',
  'context_to_carry',
  'discarded_agenda',
]);

function compact(value: unknown, maxLength = 220): string {
  const text = redactMeetingCredentials(value)
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/^#+\s*/gm, '')
    .replace(/^[\s>*-]+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}

function normalizeTimestamp(value: number | undefined): number | undefined {
  if (!Number.isFinite(value)) return undefined;
  const numeric = Number(value);
  return numeric > 20_000_000_000 ? Math.floor(numeric / 1000) : Math.floor(numeric);
}

function slotTypeFor(text: string, requested?: MeetingOutcomeSlotType): MeetingOutcomeSlotType {
  if (requested && SLOT_TYPES.has(requested)) return requested;
  if (/下次|继续跟进|carry|follow[- ]?up/i.test(text)) return 'context_to_carry';
  if (/是否|能否|有没有|为什么|怎么|\?|？|待确认|未确认|open question/i.test(text)) {
    return 'open_question';
  }
  if (/决定|决策|敲定|定稿|批准|采用|口径|decision|approve|choose/i.test(text)) {
    return 'decision';
  }
  if (/字段|状态|版本|estimate|capacity|数值|更新|变化|fact/i.test(text)) {
    return 'fact_update';
  }
  return 'action';
}

function keywordSet(value: string): Set<string> {
  const normalized = value.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, ' ');
  const tokens = new Set<string>();
  for (const part of normalized.split(/\s+/).filter(Boolean)) {
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

function overlapScore(left: string, right: string): number {
  const leftTokens = keywordSet(left);
  const rightTokens = keywordSet(right);
  let score = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) score += token.length > 2 ? 2 : 1;
  }
  return score;
}

function uniqueStrings(values: unknown[], limit: number): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const text = compact(value, 180);
    const key = text.toLowerCase();
    if (!text || text.length < 4 || seen.has(key)) continue;
    if (/^(today pilot|会前背景|当前会议|暂无|建议带进会议的问题)$/i.test(text)) {
      continue;
    }
    seen.add(key);
    result.push(text);
    if (result.length >= limit) break;
  }
  return result;
}

function normalizeConfidence(value: unknown, fallback: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.min(1, numeric));
}

export class MeetingOutcomeBinderService {
  private readonly repo: MeetingOutcomeBinderRepository;
  private readonly llmClient: Pick<LLMClient, 'generateJSON'>;

  constructor(
    private readonly db: Database.Database,
    private readonly userId: string,
    options: { llmClient?: Pick<LLMClient, 'generateJSON'> } = {},
  ) {
    this.repo = new MeetingOutcomeBinderRepository(db);
    this.llmClient = options.llmClient ?? getLLMClient();
  }

  previewFromMeetingPrep(input: PreviewFromMeetingPrepInput): MeetingOutcomeBinder {
    const sourceEvidence = this.buildPrepEvidence(input.event, input.evidenceRefs);
    const slots = this.buildPreviewSlots(input, sourceEvidence);
    const eventExternalId = compact(
      input.event.externalId || input.event.sourceUrl || input.event.title || input.prepId,
      240,
    );
    return this.repo.upsertPreview({
      userId: this.userId,
      prepId: input.prepId,
      eventExternalId,
      eventSeriesKey: compact(input.event.seriesKey, 240) || undefined,
      eventTitle: compact(input.event.title || '当前会议', 180),
      eventStartAt: normalizeTimestamp(input.event.startTime) ?? Math.floor(Date.now() / 1000),
      slots,
      sourceEvidence,
      sourceHash: contentHash(`${input.sourceHash}:${JSON.stringify(slots.map((slot) => slot.title))}`),
      generatedAt: input.generatedAt,
    });
  }

  getById(id: string): MeetingOutcomeBinder | null {
    return this.repo.findById(this.userId, id);
  }

  getByPrepId(prepId: string): MeetingOutcomeBinder | null {
    return this.repo.findByPrepId(this.userId, prepId);
  }

  getByMeetingId(meetingId: string): MeetingOutcomeBinder | null {
    return this.repo.findByMeetingId(this.userId, meetingId);
  }

  findRelevant(query: string, limit = 3): MeetingOutcomeBinder[] {
    const normalizedQuery = compact(query, 500);
    if (!normalizedQuery) return [];
    return this.repo
      .listRecent(this.userId, 80)
      .map((binder) => {
        const searchable = [
          binder.eventTitle,
          ...binder.slots.flatMap((slot) => [slot.title, slot.resultSummary || '']),
        ].join(' ');
        const overlap = overlapScore(normalizedQuery, searchable);
        const recencyBoost = Math.max(0, 3 - (Date.now() / 1000 - binder.updatedAt) / 86_400);
        return { binder, overlap, score: overlap + recencyBoost };
      })
      .filter((item) => item.overlap > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, Math.max(1, Math.min(limit, 5)))
      .map((item) => item.binder);
  }

  formatForAsk(binders: MeetingOutcomeBinder[]): string {
    if (!binders.length) return '';
    return binders
      .map((binder, index) => {
        const slotLines = binder.slots.map((slot) => {
          const result = slot.resultSummary ? `; result=${slot.resultSummary}` : '';
          return `- ${slot.title}: ${slot.status}${result}`;
        });
        return [
          `[Meeting outcome ${index + 1}] ${binder.eventTitle}`,
          `status=${binder.status}; meetingId=${binder.meetingId || 'not_bound'}`,
          ...slotLines,
          'Boundary: read-only derived meeting result; Calendar/Jira/RingCentral were not updated.',
        ].join('\n');
      })
      .join('\n\n');
  }

  async bindMeetingSession(input: MeetingOutcomeBindInput): Promise<MeetingOutcomeBinder> {
    const binder = input.binderId
      ? this.repo.findById(this.userId, input.binderId)
      : input.eventExternalId
      ? this.repo.findLatestForEvent(this.userId, input.eventExternalId)
      : null;
    if (!binder) throw new Error('Meeting outcome binder not found');

    const evidence = this.buildMeetingEvidence(input);
    if (!evidence.length) {
      const slots = binder.slots.map((slot) => ({
        ...slot,
        status: 'blocked_by_missing_evidence' as const,
        mentionState: 'not_seen' as const,
        evidence: [],
        resultSummary: '本场没有可核验的 transcript、决议、章节或行动项。',
        confidence: 0.2,
      }));
      return this.repo.saveBinding({
        binderId: binder.id,
        userId: this.userId,
        meetingId: input.meetingId,
        status: 'blocked',
        slots,
        bindingMode: 'deterministic_fallback',
        bindingError: 'missing_meeting_evidence',
      });
    }

    try {
      const response = await this.llmClient.generateJSON<BindLlmResponse>(
        this.buildBindPrompt(binder, evidence),
        {
          temperature: 0.1,
          maxTokens: 1400,
          systemPrompt:
            'Bind planned meeting goals to supplied meeting evidence. Mention is not resolution. Use only supplied evidence and return JSON only.',
        },
      );
      const slots = this.normalizeBoundSlots(binder.slots, evidence, response.slots);
      return this.repo.saveBinding({
        binderId: binder.id,
        userId: this.userId,
        meetingId: input.meetingId,
        status: this.overallStatus(slots),
        slots,
        bindingMode: 'llm',
      });
    } catch (error) {
      const slots = this.buildDeterministicBinding(binder.slots, evidence);
      return this.repo.saveBinding({
        binderId: binder.id,
        userId: this.userId,
        meetingId: input.meetingId,
        status: this.overallStatus(slots),
        slots,
        bindingMode: 'deterministic_fallback',
        bindingError: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private buildPrepEvidence(
    event: ContextAssistMeetingEvent,
    evidenceRefs: ComposerAssistEvidence[],
  ): MeetingOutcomeEvidence[] {
    const result: MeetingOutcomeEvidence[] = [
      {
        id: `calendar:${compact(event.externalId || event.title, 180)}`,
        kind: 'calendar',
        refId: compact(event.externalId || event.title, 180),
        label: event.title,
        snippet: compact([event.title, event.descriptionPreview].filter(Boolean).join(' · '), 420),
        timestamp: normalizeTimestamp(event.startTime),
        sourceUrl: event.sourceUrl || event.joinUrl,
      },
    ];
    for (const item of evidenceRefs.slice(0, 12)) {
      const id = compact(item.id, 180);
      const snippet = compact(item.snippet, 420);
      if (!id || !snippet || result.some((entry) => entry.refId === id)) continue;
      result.push({
        id: `memory:${id}`,
        kind: 'memory',
        refId: id,
        label: item.sourceTitle || item.title || item.sourceLabel,
        snippet,
        timestamp: normalizeTimestamp(item.timestamp),
        sourceUrl: item.sourceUrl,
      });
    }
    return result;
  }

  private buildPreviewSlots(
    input: PreviewFromMeetingPrepInput,
    sourceEvidence: MeetingOutcomeEvidence[],
  ): MeetingOutcomeSlot[] {
    const llmCandidates = (input.candidateSlots || []).map((slot) => ({
      title: compact(slot.title, 180),
      type: slot.type,
      evidenceIds: Array.isArray(slot.evidenceIds) ? slot.evidenceIds.map(String) : [],
    }));
    const fallbackCandidates = uniqueStrings(
      [
        input.userGoal,
        ...input.questions,
        ...input.cueCards
          .filter((card) => card.kind === 'action' || card.kind === 'question')
          .flatMap((card) => [card.body, card.title]),
        ...(String(input.event.descriptionPreview || '').split(/[\n;；。]+/)),
      ],
      5,
    ).map((title) => ({ title, type: undefined, evidenceIds: [] as string[] }));
    const merged = (llmCandidates.length ? llmCandidates : fallbackCandidates).filter(
      (candidate) => candidate.title,
    );
    const seen = new Set<string>();
    const slots: MeetingOutcomeSlot[] = [];
    for (const candidate of merged) {
      const key = candidate.title.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const rankedEvidence = sourceEvidence
        .map((evidence) => ({ evidence, score: overlapScore(candidate.title, evidence.snippet) }))
        .filter((item) => item.score > 0)
        .sort((left, right) => right.score - left.score)
        .slice(0, 3)
        .map((item) => item.evidence.id);
      const requestedEvidence = candidate.evidenceIds
        .map((id) => {
          const indexMatch = String(id).match(/^E(\d+)$/i);
          if (indexMatch) return sourceEvidence[Number(indexMatch[1]) - 1]?.id;
          return sourceEvidence.find((entry) => entry.refId === id || entry.id === id)?.id;
        })
        .filter((id): id is string => Boolean(id));
      slots.push({
        id: `slot-${slots.length + 1}-${contentHash(candidate.title).slice(0, 8)}`,
        title: candidate.title,
        type: slotTypeFor(candidate.title, candidate.type),
        status: 'planned',
        mentionState: 'not_seen',
        sourceEvidenceIds: Array.from(new Set([...requestedEvidence, ...rankedEvidence])).slice(0, 4),
        evidence: [],
        confidence: llmCandidates.includes(candidate) ? 0.82 : 0.62,
      });
      if (slots.length >= 5) break;
    }
    if (!slots.length) {
      const title = `确认 ${compact(input.event.title || '本场会议', 100)} 的决定、owner 和下一步`;
      slots.push({
        id: `slot-1-${contentHash(title).slice(0, 8)}`,
        title,
        type: 'decision',
        status: 'planned',
        mentionState: 'not_seen',
        sourceEvidenceIds: sourceEvidence.slice(0, 1).map((item) => item.id),
        evidence: [],
        confidence: 0.5,
      });
    }
    return slots;
  }

  private buildMeetingEvidence(input: MeetingOutcomeBindInput): MeetingOutcomeEvidence[] {
    const result: MeetingOutcomeEvidence[] = [];
    for (const [index, decision] of (input.decisions || []).slice(0, 30).entries()) {
      result.push({
        id: `D${index + 1}`,
        kind: 'decision',
        refId: decision.id,
        label: '决议',
        snippet: compact(decision.text, 420),
        metadata: { timestamp: decision.timestamp },
      });
    }
    for (const [index, action] of (input.actionItems || []).slice(0, 40).entries()) {
      result.push({
        id: `A${index + 1}`,
        kind: 'action',
        refId: action.id,
        label: '行动项',
        snippet: compact(
          [action.title, action.owner && `owner: ${action.owner}`, action.deadline, action.evidence]
            .filter(Boolean)
            .join(' · '),
          520,
        ),
        metadata: { status: action.status || 'pending', deadline: action.deadline },
      });
    }
    for (const [index, chapter] of (input.chapters || []).slice(0, 30).entries()) {
      result.push({
        id: `C${index + 1}`,
        kind: 'chapter',
        refId: chapter.id,
        label: chapter.title,
        snippet: compact([chapter.title, chapter.summary].filter(Boolean).join(' · '), 480),
        metadata: { startLabel: chapter.startLabel },
      });
    }
    for (const [index, chunk] of (input.transcript || []).slice(-60).entries()) {
      const snippet = compact([chunk.speaker, chunk.text].filter(Boolean).join(': '), 520);
      if (!snippet) continue;
      result.push({
        id: `T${index + 1}`,
        kind: 'transcript',
        refId: chunk.id,
        label: chunk.speaker || 'Transcript',
        snippet,
        timestamp: normalizeTimestamp(chunk.ts),
      });
    }
    return result;
  }

  private buildBindPrompt(
    binder: MeetingOutcomeBinder,
    evidence: MeetingOutcomeEvidence[],
  ): string {
    return [
      `Meeting: ${binder.eventTitle}`,
      'Planned outcome slots:',
      ...binder.slots.map((slot) => `${slot.id}: ${slot.title} (type=${slot.type})`),
      '',
      'Meeting evidence:',
      ...evidence.map((item) => `[${item.id}] ${item.kind}: ${item.snippet}`),
      '',
      'Return JSON with slots: [{slotId,status,resultSummary,confidence,evidenceRefs}].',
      'Allowed status: resolved, partially_resolved, unresolved, carried_over, blocked_by_missing_evidence, discarded_agenda.',
      'Rules:',
      '- A transcript mention alone is unresolved, not resolved.',
      '- resolved requires a decision or a completed action with matching evidence.',
      '- A matching pending action is at most partially_resolved.',
      '- Use carried_over only when evidence explicitly says it continues to a later meeting.',
      '- Every result must cite supplied evidence ids. Do not invent evidence.',
    ].join('\n');
  }

  private normalizeBoundSlots(
    plannedSlots: MeetingOutcomeSlot[],
    evidence: MeetingOutcomeEvidence[],
    responseSlots: BindLlmSlot[] | undefined,
  ): MeetingOutcomeSlot[] {
    if (!Array.isArray(responseSlots) || !responseSlots.length) {
      return this.buildDeterministicBinding(plannedSlots, evidence);
    }
    const responseById = new Map(
      responseSlots.map((slot) => [compact(slot.slotId, 180), slot]),
    );
    return plannedSlots.map((planned) => {
      const response = responseById.get(planned.id);
      if (!response || !SLOT_STATUSES.has(response.status as MeetingOutcomeSlotStatus)) {
        return this.buildDeterministicBinding([planned], evidence)[0];
      }
      const cited = (response.evidenceRefs || [])
        .map((id) => evidence.find((item) => item.id === String(id)))
        .filter((item): item is MeetingOutcomeEvidence => Boolean(item));
      const selected = cited.filter(
        (item) => overlapScore(planned.title, item.snippet) > 0,
      );
      const hasDecision = selected.some((item) => item.kind === 'decision');
      const hasDoneAction = selected.some(
        (item) => item.kind === 'action' && item.metadata?.status === 'done',
      );
      const hasPendingAction = selected.some(
        (item) => item.kind === 'action' && item.metadata?.status !== 'done',
      );
      const hasExplicitCarry = selected.some((item) =>
        /下次|继续跟进|next meeting|carry over/i.test(item.snippet),
      );
      const hasExplicitDiscard = selected.some((item) =>
        /取消|不再讨论|移出议程|跳过|drop(?:ped)?|cancel(?:led)?|skip(?:ped)?/i.test(
          item.snippet,
        ),
      );
      let status = response.status as MeetingOutcomeSlotStatus;
      if (!selected.length) status = 'blocked_by_missing_evidence';
      if (status === 'resolved' && !hasDecision && !hasDoneAction) {
        status = hasPendingAction ? 'partially_resolved' : 'unresolved';
      }
      if (status === 'partially_resolved' && !hasPendingAction) {
        status = hasDecision || hasDoneAction ? 'resolved' : 'unresolved';
      }
      if (status === 'carried_over' && !hasExplicitCarry) {
        status = hasPendingAction ? 'partially_resolved' : 'unresolved';
      }
      if (status === 'discarded_agenda' && !hasExplicitDiscard) {
        status = 'unresolved';
      }
      const mentionState =
        hasDecision || hasDoneAction || hasPendingAction
          ? 'supported'
          : selected.length
          ? 'mentioned'
          : 'not_seen';
      return {
        ...planned,
        status,
        mentionState,
        evidence: selected.slice(0, 6),
        resultSummary:
          status === response.status
            ? compact(response.resultSummary, 260) ||
              this.defaultResultSummary(status)
            : this.defaultResultSummary(status),
        confidence: normalizeConfidence(response.confidence, selected.length ? 0.65 : 0.25),
      };
    });
  }

  private buildDeterministicBinding(
    plannedSlots: MeetingOutcomeSlot[],
    evidence: MeetingOutcomeEvidence[],
  ): MeetingOutcomeSlot[] {
    return plannedSlots.map((planned) => {
      const ranked = evidence
        .map((item) => ({ item, score: overlapScore(planned.title, item.snippet) }))
        .filter((entry) => entry.score > 0)
        .sort((left, right) => right.score - left.score)
        .slice(0, 6)
        .map((entry) => entry.item);
      const hasDecision = ranked.some((item) => item.kind === 'decision');
      const hasDoneAction = ranked.some(
        (item) => item.kind === 'action' && item.metadata?.status === 'done',
      );
      const hasPendingAction = ranked.some(
        (item) => item.kind === 'action' && item.metadata?.status !== 'done',
      );
      const explicitCarry = ranked.some((item) => /下次|继续跟进|next meeting|carry over/i.test(item.snippet));
      let status: MeetingOutcomeSlotStatus = 'blocked_by_missing_evidence';
      if (hasDecision || hasDoneAction) status = 'resolved';
      else if (hasPendingAction) status = 'partially_resolved';
      else if (ranked.length) status = explicitCarry ? 'carried_over' : 'unresolved';
      return {
        ...planned,
        status,
        mentionState:
          hasDecision || hasDoneAction || hasPendingAction
            ? 'supported'
            : ranked.length
            ? 'mentioned'
            : 'not_seen',
        evidence: ranked,
        resultSummary: this.defaultResultSummary(status),
        confidence:
          status === 'resolved'
            ? 0.78
            : status === 'partially_resolved'
            ? 0.66
            : ranked.length
            ? 0.48
            : 0.2,
      };
    });
  }

  private defaultResultSummary(status: MeetingOutcomeSlotStatus): string {
    const labels: Record<MeetingOutcomeSlotStatus, string> = {
      planned: '等待会议证据。',
      resolved: '存在决议或已完成行动项证据。',
      partially_resolved: '已有相关行动或结论，但仍需补齐或完成。',
      unresolved: '会议中提到了该目标，但没有形成可核验结论。',
      carried_over: '证据明确表示需要带到后续会议继续。',
      blocked_by_missing_evidence: '当前没有足够证据判断结果。',
      discarded_agenda: '会议中明确放弃了该议题。',
    };
    return labels[status];
  }

  private overallStatus(slots: MeetingOutcomeSlot[]): 'bound' | 'partial' | 'blocked' {
    if (slots.every((slot) => slot.status === 'blocked_by_missing_evidence')) {
      return 'blocked';
    }
    if (
      slots.some(
        (slot) =>
          slot.status === 'partially_resolved' ||
          slot.status === 'unresolved' ||
          slot.status === 'carried_over' ||
          slot.status === 'blocked_by_missing_evidence',
      )
    ) {
      return 'partial';
    }
    return 'bound';
  }
}
