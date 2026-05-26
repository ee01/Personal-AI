import type Database from 'better-sqlite3';

import { ContextRecallService } from './ContextRecallService.js';
import { getLLMClient, type LLMClient } from '../llm/LLMClient.js';
import {
  TodayPilotMeetingPrepRepository,
  type TodayPilotMeetingPrepRecord,
} from '../repositories/TodayPilotMeetingPrepRepository.js';
import { contentHash } from '../utils/hashing.js';
import { normalizeStorylineOpportunity } from '../utils/storyline.js';
import { now } from '../utils/time.js';
import type {
  ComposerAssistEvidence,
  ContextAssistCueCard,
  ContextAssistMeetingEvent,
  ContextAssistRequest,
  ContextAssistResponse,
  ContextRecallRequest,
  RecallSourceType,
  StorylineOpportunity,
} from '../types/index.js';

type MeetingPrepMode = 'nightly_llm' | 'on_demand_llm';

export interface TodayPilotMeetingPrepPrepareOptions {
  date?: string;
  localDate?: string;
  timezone?: string;
  horizonHours?: number;
  maxMeetings?: number;
  mode?: MeetingPrepMode;
}

export interface TodayPilotMeetingPrepPrepareResponse {
  prepared: number;
  skipped: number;
  failed: number;
  items: TodayPilotMeetingPrepRecord[];
  warnings: string[];
}

export interface TodayPilotMeetingPrepResolveOptions {
  event?: ContextAssistMeetingEvent;
  timezone?: string;
  userGoal?: string;
  autoGenerate?: boolean;
  forceGenerate?: boolean;
  sourceTypes?: RecallSourceType[];
}

export interface TodayPilotMeetingPrepResolveResponse {
  prep: TodayPilotMeetingPrepRecord | null;
  assist: ContextAssistResponse | null;
  generated: boolean;
  source: 'cached' | 'generated' | 'fallback' | 'none';
  warnings: string[];
}

interface CalendarEventRow {
  id: string;
  source_system: string;
  external_id: string;
  series_key: string | null;
  title: string;
  description_preview: string | null;
  start_at: number;
  end_at: number | null;
  organizer_json: string | null;
  attendees_json: string | null;
  location: string | null;
  join_url: string | null;
  source_url: string | null;
  metadata_json: string | null;
}

interface TodayPilotMeetingPrepLlmResponse {
  summaryMd?: string;
  cueCards?: Array<Partial<ContextAssistCueCard>>;
  suggestedQuestions?: string[];
  risksOrOpenLoops?: string[];
  contextPackMd?: string;
  redactionPreview?: string[];
  storylineOpportunity?: StorylineOpportunity;
  usage?: Record<string, unknown>;
}

const MEETING_PREP_SOURCES: RecallSourceType[] = [
  'calendar',
  'meeting',
  'glip',
  'jira',
  'web',
  'manual',
  'system',
  'user_core',
  'markdown',
  'reflection',
  'rehearsal',
];

const MAX_LLM_EVIDENCE = 5;

function normalizeMeetingPrepSourceTypes(
  sourceTypes?: RecallSourceType[],
): RecallSourceType[] {
  const requested = sourceTypes?.length
    ? sourceTypes.filter((sourceType) =>
        MEETING_PREP_SOURCES.includes(sourceType),
      )
    : MEETING_PREP_SOURCES;
  return requested.length ? requested : MEETING_PREP_SOURCES;
}

function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function compactText(value: string, maxLength: number): string {
  const text = value.replace(/\s+/g, ' ').trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trimEnd()}…`;
}

function normalizeTimestamp(
  value: number | undefined,
  fallback = now(),
): number {
  if (!Number.isFinite(value)) return fallback;
  const numeric = Number(value);
  return numeric > 20_000_000_000
    ? Math.floor(numeric / 1000)
    : Math.floor(numeric);
}

function firstNonEmpty(...values: Array<string | undefined | null>): string {
  for (const value of values) {
    const text = String(value || '').trim();
    if (text) return text;
  }
  return '';
}

function eventAttendeeNames(event: ContextAssistMeetingEvent): string[] {
  return (event.attendees ?? [])
    .map((item) => firstNonEmpty(item.name, item.email))
    .filter(Boolean)
    .slice(0, 16);
}

function goalHashFor(userGoal?: string): string {
  const goal = String(userGoal || '').trim();
  return goal ? contentHash(goal).slice(0, 20) : '';
}

function buildLocalDate(date: Date, timezone: string): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date);
}

function localDateStartApprox(localDate: string): number {
  return Math.floor(new Date(`${localDate}T00:00:00.000Z`).getTime() / 1000);
}

function isRecurringNoise(event: ContextAssistMeetingEvent): boolean {
  const title = String(event.title || '').trim();
  if (!event.seriesKey) return false;
  return /daily|weekly|standup|sync|scrum|例会|周会|站会/i.test(title);
}

function hasDeepPrepSignal(event: ContextAssistMeetingEvent): boolean {
  const text = [
    event.title,
    event.descriptionPreview,
    event.organizer?.name,
    ...eventAttendeeNames(event),
  ]
    .filter(Boolean)
    .join(' ');
  return /\bai\b|codex|mcp|pilot|decision|risk|block|fail|retry|owner|dependency|launch|review|jira|sharing|方案|决策|风险|阻塞|失败|确认|准备|分享|复盘/i.test(
    text,
  );
}

function toEvidence(match: {
  id: string;
  type: 'message' | 'chunk' | 'entity' | 'rehearsal' | 'source_memory';
  title?: string;
  snippet: string;
  sourceLabel?: string;
  sourceUrl?: string;
  sourceTitle?: string;
  exploreLink?: string;
  links?: Array<{ label: string; url: string }>;
  whyMatched?: string;
  timestamp?: number;
  score?: number;
}): ComposerAssistEvidence {
  return {
    id: match.id,
    type: match.type,
    title: match.title,
    snippet: match.snippet,
    sourceLabel: match.sourceLabel,
    sourceUrl: match.sourceUrl,
    sourceTitle: match.sourceTitle,
    exploreLink: match.exploreLink,
    links: match.links,
    whyMatched: match.whyMatched,
    timestamp: match.timestamp,
    score: match.score,
  };
}

export class TodayPilotMeetingPrepService {
  private readonly repo: TodayPilotMeetingPrepRepository;
  private readonly recallService: ContextRecallService;
  private readonly llmClient: Pick<LLMClient, 'generateJSON'>;

  constructor(
    private readonly db: Database.Database,
    private readonly userId: string,
    options: { llmClient?: Pick<LLMClient, 'generateJSON'> } = {},
  ) {
    this.repo = new TodayPilotMeetingPrepRepository(db);
    this.recallService = new ContextRecallService(db);
    this.llmClient = options.llmClient ?? getLLMClient();
  }

  async prepare(
    options: TodayPilotMeetingPrepPrepareOptions = {},
  ): Promise<TodayPilotMeetingPrepPrepareResponse> {
    const timezone = options.timezone || 'Asia/Shanghai';
    const localDate =
      options.localDate || options.date || buildLocalDate(new Date(), timezone);
    const horizonHours = Math.max(1, Math.min(options.horizonHours ?? 36, 96));
    const maxMeetings = Math.max(1, Math.min(options.maxMeetings ?? 5, 20));
    const mode = options.mode ?? 'nightly_llm';
    const startAt = Math.max(now() - 15 * 60, localDateStartApprox(localDate));
    const endAt = startAt + horizonHours * 3600;
    const rows = this.db
      .prepare(
        `SELECT id, source_system, external_id, series_key, title,
                description_preview, start_at, end_at, organizer_json,
                attendees_json, location, join_url, source_url, metadata_json
         FROM calendar_events
         WHERE cancelled = 0
           AND start_at >= ?
           AND start_at <= ?
         ORDER BY start_at ASC
         LIMIT 80`,
      )
      .all(startAt, endAt) as CalendarEventRow[];

    const items: TodayPilotMeetingPrepRecord[] = [];
    const warnings: string[] = [];
    let skipped = 0;
    let failed = 0;
    for (const row of rows) {
      const event = this.calendarRowToEvent(row);
      if (isRecurringNoise(event) && !hasDeepPrepSignal(event)) {
        skipped += 1;
        continue;
      }
      if (items.length >= maxMeetings) {
        skipped += 1;
        continue;
      }
      try {
        const prep = await this.generateForEvent({
          event,
          timezone,
          localDate,
          userGoal: '',
          mode,
        });
        items.push(prep);
      } catch (error) {
        failed += 1;
        warnings.push(
          `${event.title || row.external_id}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    return {
      prepared: items.length,
      skipped,
      failed,
      items,
      warnings,
    };
  }

  async resolve(
    options: TodayPilotMeetingPrepResolveOptions,
  ): Promise<TodayPilotMeetingPrepResolveResponse> {
    const timezone = options.timezone || 'Asia/Shanghai';
    const event = this.normalizeEvent(options.event);
    if (!event) {
      return {
        prep: null,
        assist: null,
        generated: false,
        source: 'none',
        warnings: ['missing_event'],
      };
    }
    const localDate = buildLocalDate(
      new Date(normalizeTimestamp(event.startTime) * 1000),
      timezone,
    );
    const goalHash = goalHashFor(options.userGoal);
    const eventExternalId = this.eventExternalId(event);
    const cached =
      !options.forceGenerate &&
      this.repo.findBestForEvent(
        this.userId,
        localDate,
        eventExternalId,
        event.seriesKey,
        event.title,
        goalHash,
      );
    if (cached) {
      return {
        prep: cached,
        assist: this.toContextAssistResponse(cached, {
          delegated: true,
          source: 'cached',
        }),
        generated: false,
        source: 'cached',
        warnings: [],
      };
    }

    if (options.autoGenerate === false) {
      return {
        prep: null,
        assist: null,
        generated: false,
        source: 'none',
        warnings: ['prep_not_found'],
      };
    }

    const prep = await this.generateForEvent({
      event,
      timezone,
      localDate,
      userGoal: options.userGoal,
      mode: goalHash ? 'on_demand_llm' : 'nightly_llm',
      sourceTypes: options.sourceTypes,
    });
    return {
      prep,
      assist: this.toContextAssistResponse(prep, {
        delegated: true,
        source: prep.status === 'fallback' ? 'fallback' : 'generated',
      }),
      generated: true,
      source: prep.status === 'fallback' ? 'fallback' : 'generated',
      warnings: prep.error ? [prep.error] : [],
    };
  }

  async resolveFromContextAssist(
    request: ContextAssistRequest,
    timezone = 'Asia/Shanghai',
  ): Promise<ContextAssistResponse> {
    const result = await this.resolve({
      event: request.event ?? {
        externalId: request.url || request.title || 'context-assist-meeting',
        title: request.title || '当前会议',
        descriptionPreview: request.primaryText,
        sourceUrl: request.url,
        startTime: now(),
      },
      timezone,
      userGoal: request.userGoal,
      autoGenerate: true,
      forceGenerate: Boolean(request.userGoal),
    });
    if (result.assist) {
      return {
        ...result.assist,
        debug: {
          ...(result.assist.debug ?? {}),
          deprecated: true,
          delegatedTo: 'today_pilot',
          resolveSource: result.source,
        },
      };
    }
    return {
      available: false,
      surface: 'meeting_prep',
      suggestionType: 'none',
      title: '暂无会前上下文',
      summary: 'Today Pilot 没有找到或生成可用的会前准备。',
      cueCards: [
        {
          id: 'fallback-brief',
          kind: 'brief',
          title: '暂无高置信记忆',
          body: '可以补充本次会议目标后重新生成。',
        },
      ],
      evidence: [],
      riskLevel: 'low',
      previewRequired: false,
      confidence: 0,
      queryTimeMs: 0,
      debug: {
        deprecated: true,
        delegatedTo: 'today_pilot',
        warnings: result.warnings,
      },
    };
  }

  toContextAssistResponse(
    prep: TodayPilotMeetingPrepRecord,
    debug?: Record<string, unknown>,
  ): ContextAssistResponse {
    const summary = compactText(
      prep.summaryMd.replace(/^#+\s*/gm, '').replace(/\n+/g, ' '),
      220,
    );
    return {
      available: prep.status === 'ready' || prep.status === 'fallback',
      surface: 'meeting_prep',
      suggestionType: 'meeting_brief',
      title:
        prep.status === 'fallback'
          ? 'Today Pilot 会前准备（fallback）'
          : 'Today Pilot 会前准备',
      summary: summary || `已为 ${prep.eventTitle} 准备会前上下文。`,
      insertText: prep.contextPackMd,
      cueCards: prep.cueCards,
      evidence: prep.evidenceRefs,
      riskLevel:
        Array.isArray(prep.redaction.redactionPreview) &&
        prep.redaction.redactionPreview.length > 0
          ? 'medium'
          : 'low',
      previewRequired: false,
      confidence: prep.status === 'ready' ? 0.82 : 0.58,
      queryTimeMs: 0,
      storylineOpportunity: prep.storylineOpportunity,
      debug: {
        deprecated: false,
        prepId: prep.id,
        missionId: prep.missionId,
        generatedMode: prep.generatedMode,
        status: prep.status,
        ...(debug ?? {}),
      },
    };
  }

  private async generateForEvent(input: {
    event: ContextAssistMeetingEvent;
    timezone: string;
    localDate: string;
    userGoal?: string;
    mode: MeetingPrepMode;
    sourceTypes?: RecallSourceType[];
  }): Promise<TodayPilotMeetingPrepRecord> {
    const event = this.normalizeEvent(input.event)!;
    const startAt = normalizeTimestamp(event.startTime);
    const eventExternalId = this.eventExternalId(event);
    const goalHash = goalHashFor(input.userGoal);
    const recall = await this.recallForEvent(
      event,
      input.userGoal,
      input.sourceTypes,
    );
    const evidence = this.buildEvidence(event, recall.matches.map(toEvidence));
    const sourceHash = contentHash(
      JSON.stringify({
        eventExternalId,
        eventTitle: event.title,
        startAt,
        goalHash,
        evidence: evidence.map((item) => item.id),
      }),
    );
    const expiresAt = Math.max(startAt + 12 * 3600, now() + 12 * 3600);

    try {
      const generated =
        await this.llmClient.generateJSON<TodayPilotMeetingPrepLlmResponse>(
          this.buildLlmPrompt(event, input.userGoal, evidence),
          {
            temperature: 0.2,
            maxTokens: 1400,
            systemPrompt:
              'You generate concise meeting preparation JSON. Use only provided evidence. Do not invent facts. Return JSON only.',
          },
        );
      const normalized = this.normalizeLlmResponse(
        event,
        input.userGoal,
        evidence,
        generated,
      );
      return this.repo.upsert({
        userId: this.userId,
        localDate: input.localDate,
        timezone: input.timezone,
        eventExternalId,
        eventSeriesKey: event.seriesKey,
        eventTitle: event.title || '当前会议',
        startAt,
        goalHash,
        status: 'ready',
        generatedMode: input.mode,
        sourceHash,
        expiresAt,
        ...normalized,
      });
    } catch (error) {
      const fallback = this.buildDeterministicFallback(
        event,
        input.userGoal,
        evidence,
      );
      return this.repo.upsert({
        userId: this.userId,
        localDate: input.localDate,
        timezone: input.timezone,
        eventExternalId,
        eventSeriesKey: event.seriesKey,
        eventTitle: event.title || '当前会议',
        startAt,
        goalHash,
        status: 'fallback',
        generatedMode: 'deterministic_fallback',
        sourceHash,
        expiresAt,
        error: error instanceof Error ? error.message : String(error),
        ...fallback,
      });
    }
  }

  private async recallForEvent(
    event: ContextAssistMeetingEvent,
    userGoal?: string,
    sourceTypes?: RecallSourceType[],
  ) {
    const attendeeNames = eventAttendeeNames(event);
    const recallRequest: ContextRecallRequest = {
      surface: 'meeting_prep',
      contextType: 'meeting',
      title: event.title,
      url: event.sourceUrl || event.joinUrl,
      primaryText: [
        event.title,
        userGoal ? `Meeting goal: ${userGoal}` : '',
        event.descriptionPreview,
        event.organizer?.name ? `Organizer: ${event.organizer.name}` : '',
        attendeeNames.length ? `Participants: ${attendeeNames.join(', ')}` : '',
        event.location,
      ]
        .filter(Boolean)
        .join('\n')
        .slice(0, 1800),
      secondaryTexts: [userGoal || ''].filter(Boolean),
      entityHints: [
        event.externalId
          ? { kind: 'calendar_event', value: event.externalId }
          : null,
        event.seriesKey
          ? { kind: 'calendar_series', value: event.seriesKey }
          : null,
        event.organizer?.name
          ? { kind: 'person', value: event.organizer.name }
          : null,
        ...attendeeNames.slice(0, 8).map((name) => ({
          kind: 'person',
          value: name,
        })),
      ].filter((item): item is { kind: string; value: string } =>
        Boolean(item),
      ),
      scope: 'work',
      sourceTypes: normalizeMeetingPrepSourceTypes(sourceTypes),
      limit: MAX_LLM_EVIDENCE,
      debug: false,
    };
    return this.recallService.recall(recallRequest);
  }

  private buildEvidence(
    event: ContextAssistMeetingEvent,
    recalled: ComposerAssistEvidence[],
  ): ComposerAssistEvidence[] {
    const eventEvidence: ComposerAssistEvidence = {
      id: `calendar:${this.eventExternalId(event)}`,
      type: 'message',
      title: event.title || 'Calendar event',
      snippet: compactText(
        [
          event.title,
          event.descriptionPreview,
          event.organizer?.name ? `Organizer: ${event.organizer.name}` : '',
          eventAttendeeNames(event).length
            ? `Participants: ${eventAttendeeNames(event).join(', ')}`
            : '',
        ]
          .filter(Boolean)
          .join(' · '),
        420,
      ),
      sourceLabel: 'calendar',
      sourceUrl: event.sourceUrl || event.joinUrl,
      links:
        event.sourceUrl || event.joinUrl
          ? [
              {
                label: '打开会议来源',
                url: event.sourceUrl || event.joinUrl || '',
              },
            ]
          : [],
      timestamp: normalizeTimestamp(event.startTime),
      score: 0.78,
    };
    const seen = new Set<string>([eventEvidence.id]);
    const result = [eventEvidence];
    for (const item of recalled) {
      if (!item.snippet || seen.has(item.id)) continue;
      seen.add(item.id);
      result.push(item);
      if (result.length >= MAX_LLM_EVIDENCE) break;
    }
    return result;
  }

  private buildLlmPrompt(
    event: ContextAssistMeetingEvent,
    userGoal: string | undefined,
    evidence: ComposerAssistEvidence[],
  ): string {
    const evidenceText = evidence
      .slice(0, MAX_LLM_EVIDENCE)
      .map((item, index) => {
        const label =
          item.sourceTitle || item.title || item.sourceLabel || item.id;
        return `[E${index + 1}] ${label}\n${compactText(item.snippet, 700)}`;
      })
      .join('\n\n');
    return [
      'Generate a Today Pilot meeting prep brief in JSON.',
      '',
      `Meeting: ${event.title || 'Current meeting'}`,
      `Time: ${new Date(
        normalizeTimestamp(event.startTime) * 1000,
      ).toISOString()}`,
      userGoal ? `User goal: ${userGoal}` : 'User goal: default offline prep',
      event.descriptionPreview
        ? `Calendar description: ${event.descriptionPreview}`
        : '',
      '',
      'Evidence:',
      evidenceText,
      '',
      'JSON schema:',
      JSON.stringify({
        summaryMd: 'markdown summary, 3-5 bullets max',
        cueCards: [
          {
            id: 'brief',
            kind: 'brief',
            title: 'short cue title',
            body: 'one practical meeting cue',
            evidenceIds: ['E1'],
          },
        ],
        suggestedQuestions: ['question to bring into the meeting'],
        risksOrOpenLoops: ['risk or open loop'],
        contextPackMd: 'markdown context pack for Meeting Pilot',
        redactionPreview: ['sensitive detail to review before sharing'],
        storylineOpportunity: {
          available: true,
          confidence: 0.0,
          storyType:
            'sharing | status_report | retro | training | proposal | weekly_update',
          buttonLabel: 'short button copy; user clicks before generating',
          oneLineReason:
            'why there is enough material for a story, one short sentence',
          audienceHint: 'who this would be for',
          estimatedLengthMinutes: 8,
          evidenceClusters: [
            {
              label: 'cluster of related evidence',
              sourceKinds: ['meeting', 'glip'],
              evidenceCount: 3,
            },
          ],
          blockedReasons: [
            'why no button should show when available is false',
          ],
          suggestedArtifact:
            'speaker_notes | slides_outline | ringcentral_post | docs_brief',
        },
      }),
      '',
      'Storyline opportunity rules:',
      '- Set storylineOpportunity.available=true only when the meeting likely requires an outward explanation, sharing, report, training, retro, proposal, or weekly update.',
      '- Require enough evidence for at least 3 story segments and at least one clear audience.',
      '- Do not show it for ordinary daily sync, 1:1, or a single isolated todo unless evidence shows explicit sharing/retro/report intent.',
      '- If private or sensitive evidence dominates, either set available=false with blockedReasons or choose an internal artifact target.',
      '- This field only controls whether a button appears; do not generate the full storyline here.',
    ]
      .filter(Boolean)
      .join('\n');
  }

  private normalizeLlmResponse(
    event: ContextAssistMeetingEvent,
    userGoal: string | undefined,
    evidence: ComposerAssistEvidence[],
    response: TodayPilotMeetingPrepLlmResponse,
  ): Pick<
    Parameters<TodayPilotMeetingPrepRepository['upsert']>[0],
    | 'summaryMd'
    | 'cueCards'
    | 'questions'
    | 'evidenceRefs'
    | 'contextPackMd'
    | 'redaction'
    | 'llmUsage'
  > {
    const fallback = this.buildDeterministicFallback(event, userGoal, evidence);
    const questions = Array.isArray(response.suggestedQuestions)
      ? response.suggestedQuestions
          .map((item) => String(item || '').trim())
          .filter(Boolean)
          .slice(0, 6)
      : fallback.questions;
    const cueCards = this.normalizeCueCards(
      response.cueCards,
      questions,
      evidence,
    );
    const contextPackMd = firstNonEmpty(
      response.contextPackMd,
      fallback.contextPackMd,
    );
    const storylineOpportunity = normalizeStorylineOpportunity(
      response.storylineOpportunity,
    );
    const llmUsage: Record<string, unknown> = { ...(response.usage ?? {}) };
    if (storylineOpportunity) {
      llmUsage.storylineOpportunity = storylineOpportunity;
    }
    return {
      summaryMd: firstNonEmpty(response.summaryMd, fallback.summaryMd),
      cueCards: cueCards.length ? cueCards : fallback.cueCards,
      questions,
      evidenceRefs: evidence,
      contextPackMd: /today pilot meeting prep/i.test(contextPackMd)
        ? contextPackMd
        : `# Today Pilot meeting prep: ${
            event.title || '当前会议'
          }\n\n${contextPackMd}`,
      redaction: {
        redactionPreview: Array.isArray(response.redactionPreview)
          ? response.redactionPreview
              .map((item) => String(item || '').trim())
              .filter(Boolean)
              .slice(0, 8)
          : [],
        risksOrOpenLoops: Array.isArray(response.risksOrOpenLoops)
          ? response.risksOrOpenLoops
              .map((item) => String(item || '').trim())
              .filter(Boolean)
              .slice(0, 8)
          : [],
      },
      llmUsage,
    };
  }

  private normalizeCueCards(
    cards: TodayPilotMeetingPrepLlmResponse['cueCards'],
    questions: string[],
    evidence: ComposerAssistEvidence[],
  ): ContextAssistCueCard[] {
    const normalized = Array.isArray(cards)
      ? cards
          .map((card, index): ContextAssistCueCard | null => {
            const title = String(card.title || '').trim();
            const body = String(card.body || '').trim();
            if (!title || !body) return null;
            const kind =
              card.kind === 'memory' ||
              card.kind === 'question' ||
              card.kind === 'action'
                ? card.kind
                : 'brief';
            return {
              id: String(card.id || `llm-card-${index + 1}`),
              kind,
              title,
              body,
              evidenceIds: Array.isArray(card.evidenceIds)
                ? card.evidenceIds.map(String).slice(0, 5)
                : evidence.slice(0, 2).map((item) => item.id),
            };
          })
          .filter((card): card is ContextAssistCueCard => Boolean(card))
      : [];
    if (
      questions.length > 0 &&
      !normalized.some((card) => card.kind === 'question')
    ) {
      normalized.push({
        id: 'suggested-questions',
        kind: 'question',
        title: '建议带进会议的问题',
        body: questions.slice(0, 3).join(' '),
        evidenceIds: evidence.slice(0, 3).map((item) => item.id),
      });
    }
    return normalized.slice(0, 8);
  }

  private buildDeterministicFallback(
    event: ContextAssistMeetingEvent,
    userGoal: string | undefined,
    evidence: ComposerAssistEvidence[],
  ): Pick<
    Parameters<TodayPilotMeetingPrepRepository['upsert']>[0],
    | 'summaryMd'
    | 'cueCards'
    | 'questions'
    | 'evidenceRefs'
    | 'contextPackMd'
    | 'redaction'
    | 'llmUsage'
  > {
    const title = event.title || '当前会议';
    const evidenceLines = evidence
      .slice(0, 5)
      .map(
        (item, index) => `- [E${index + 1}] ${compactText(item.snippet, 220)}`,
      );
    const questions = [
      '这场会今天最需要确认的 owner、下一步和时间点是什么？',
      '历史上下文里是否有未关闭风险或依赖需要在会中重新校准？',
    ];
    const cueCards: ContextAssistCueCard[] = [
      {
        id: 'meeting-context',
        kind: 'brief',
        title: '会前背景',
        body: evidence.length
          ? `Today Pilot 命中 ${evidence.length} 条相关记忆，先核对最近变更和未关闭事项。`
          : '暂未命中强相关记忆，先明确本次会议目标和需要输出的决定。',
        evidenceIds: evidence.slice(0, 3).map((item) => item.id),
      },
      {
        id: 'suggested-questions',
        kind: 'question',
        title: '建议带进会议的问题',
        body: questions.join(' '),
        evidenceIds: evidence.slice(0, 3).map((item) => item.id),
      },
    ];
    const contextPackMd = [
      `# Today Pilot meeting prep: ${title}`,
      '',
      ...(userGoal ? [`## User goal`, userGoal, ''] : []),
      '## Known facts',
      evidenceLines.length
        ? evidenceLines.join('\n')
        : '- No strong memory evidence found yet.',
      '',
      '## Suggested ask',
      questions.map((item) => `- ${item}`).join('\n'),
      '',
      '## Evidence refs',
      ...evidence.slice(0, 5).map((item, index) => {
        const label =
          item.sourceTitle || item.title || item.sourceLabel || item.id;
        return `- [E${index + 1}] ${label}`;
      }),
      '',
      'Review private/internal details before sharing this outside Personal AI.',
    ].join('\n');
    return {
      summaryMd: [
        `## ${title}`,
        '',
        evidence.length
          ? `- 已召回 ${evidence.length} 条相关记忆，优先检查最近承诺、风险和 owner。`
          : '- 暂无强相关记忆，建议先明确会议目标。',
        userGoal ? `- 本次目标：${userGoal}` : '- 使用默认离线会前准备。',
      ].join('\n'),
      cueCards,
      questions,
      evidenceRefs: evidence,
      contextPackMd,
      redaction: {
        redactionPreview: evidence
          .filter(
            (item) =>
              item.sourceUrl && /token|key|secret/i.test(item.sourceUrl),
          )
          .map((item) => item.sourceUrl)
          .slice(0, 5),
      },
      llmUsage: { fallback: true },
    };
  }

  private calendarRowToEvent(row: CalendarEventRow): ContextAssistMeetingEvent {
    return {
      externalId: row.external_id,
      seriesKey: row.series_key ?? undefined,
      title: row.title,
      descriptionPreview: row.description_preview ?? undefined,
      startTime: row.start_at,
      endTime: row.end_at ?? undefined,
      organizer: safeJsonParse<ContextAssistMeetingEvent['organizer']>(
        row.organizer_json,
        undefined,
      ),
      attendees: safeJsonParse<
        NonNullable<ContextAssistMeetingEvent['attendees']>
      >(row.attendees_json, []),
      location: row.location ?? undefined,
      joinUrl: row.join_url ?? undefined,
      sourceUrl: row.source_url ?? undefined,
      cancelled: false,
      metadata: safeJsonParse<Record<string, unknown>>(row.metadata_json, {
        sourceSystem: row.source_system,
      }),
    };
  }

  private normalizeEvent(
    event?: ContextAssistMeetingEvent,
  ): ContextAssistMeetingEvent | null {
    if (!event) return null;
    const title = firstNonEmpty(
      event.title,
      event.descriptionPreview,
      '当前会议',
    );
    return {
      ...event,
      externalId: firstNonEmpty(event.externalId, event.sourceUrl, title),
      title,
      startTime: normalizeTimestamp(event.startTime),
      endTime: event.endTime ? normalizeTimestamp(event.endTime) : undefined,
    };
  }

  private eventExternalId(event: ContextAssistMeetingEvent): string {
    return firstNonEmpty(
      event.externalId,
      event.sourceUrl,
      event.joinUrl,
      `${event.title || 'meeting'}:${normalizeTimestamp(event.startTime)}`,
    );
  }
}
