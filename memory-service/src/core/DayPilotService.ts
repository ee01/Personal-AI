import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';

import { contentHash } from '../utils/hashing.js';
import { formatDateTime, now } from '../utils/time.js';
import {
  DayPilotRepository,
  type DayPilotAttentionBudget,
  type DayPilotBrief,
  type DayPilotCard,
  type DayPilotCardType,
  type DayPilotEvidenceRef,
  type DayPilotFeedbackInput,
  type DayPilotFeedbackSignal,
  type DayPilotMission,
  type DayPilotPriority,
  type DayPilotSourceStats,
  type DayPilotState,
} from '../repositories/DayPilotRepository.js';

type RefreshMode = 'light' | 'full';
export type TargetProvider =
  | 'codex'
  | 'chatgpt'
  | 'claude'
  | 'doubao'
  | 'generic';

export interface DayPilotProviderProfile {
  id: TargetProvider;
  label: string;
  defaultTokenBudget: number;
  style: 'implementation' | 'conversation' | 'analysis' | 'chinese' | 'plain';
}

interface DayPilotGetTodayOptions {
  localDate?: string;
  timezone?: string;
  autoGenerate?: boolean;
}

interface DayPilotRefreshOptions {
  localDate?: string;
  timezone?: string;
  mode?: RefreshMode;
}

export interface DayPilotTodayResponse {
  brief: DayPilotBrief;
  generated: boolean;
  stale: boolean;
}

export interface DayPilotContextPackResponse {
  missionId: string;
  generatedAt: number;
  tokenBudget: number;
  maxChars: number;
  targetProvider: TargetProvider;
  providerProfile: DayPilotProviderProfile;
  usageIntent: {
    kind: 'external_ai_context';
    boundary: 'context_only_not_execution';
    defaultSensitiveHandling: 'redacted_by_default' | 'included_sensitive';
  };
  sourceSummary: {
    evidenceCount: number;
    sourceKinds: Record<string, number>;
    redactionApplied: boolean;
    truncated: boolean;
  };
  bodyMd: string;
  evidenceRefs: DayPilotEvidenceRef[];
  warnings: string[];
  redactionPreview: string[];
  redactionApplied: boolean;
  truncated: boolean;
}

interface CountRow {
  count: number;
}

interface MessageCandidateRow {
  id: string;
  content: string;
  summary: string | null;
  source_type: string;
  source_url: string | null;
  source_title: string | null;
  sender: string | null;
  group_id: string | null;
  group_name: string | null;
  timestamp: number;
  entities_json: string | null;
  matched_projects_json: string | null;
  importance: number | null;
  metadata_json: string | null;
}

interface CalendarCandidateRow {
  id: string;
  external_id: string;
  title: string;
  description_preview: string | null;
  start_at: number;
  end_at: number | null;
  series_key: string | null;
  organizer_json: string | null;
  attendees_json: string | null;
  join_url: string | null;
  source_url: string | null;
  source_system: string;
}

interface NotificationCandidateRow {
  id: string;
  channel: string | null;
  type: string | null;
  title: string;
  body: string | null;
  payload_json: string | null;
  topic_id: string | null;
  related_entity_id: string | null;
  utility_score: number | null;
  created_at: number;
}

interface ActionCandidateRow {
  id: string;
  type: string;
  title: string;
  description: string | null;
  risk_level: string | null;
  confidence: number | null;
  evidence_refs_json: string | null;
  requires_approval: number;
  created_at: number;
  action_type: string | null;
  execution_mode: string | null;
  priority: number | null;
  scheduled_at: number | null;
  last_error: string | null;
  source_kind: string | null;
  source_ref_id: string | null;
  queue_status: string | null;
  utility_score: number | null;
  urgency_score: number | null;
}

interface ReflectionCandidateRow {
  id: string;
  topic_key: string;
  title: string;
  priority: number;
  salience: number;
  source_type: string | null;
  source_ref_id: string | null;
  current_hypothesis: string | null;
  open_questions_json: string | null;
  latest_summary: string | null;
  next_reflection_at: number | null;
  updated_at: number;
}

interface RehearsalCandidateRow {
  id: string;
  title: string;
  scenario_type: string;
  status: string;
  summary: string | null;
  content: string;
  activation_cues_json: string | null;
  evidence_refs_json: string | null;
  confidence: number;
  priority: number;
  valid_until: number | null;
  last_activated_at: number | null;
  updated_at: number;
  stale_reason: string | null;
}

interface SkillCandidateRow {
  id: string;
  slug: string;
  title: string;
  summary: string;
  scope: string;
  risk: string;
  trigger_text: string | null;
  not_use_text: string | null;
  status: string;
  source_kinds_json: string | null;
  repetition: string | null;
  risk_brief: string | null;
  suggested_from: string | null;
  suggested_at: number | null;
  suggestion_cluster_key: string | null;
  updated_at: number;
}

interface RelationshipCandidateRow {
  entity_id: string;
  score: number;
  interaction_count: number;
  last_interaction_at: number | null;
  summary: string | null;
  evidence_refs_json: string | null;
  entity_name: string | null;
}

interface Candidate {
  sourceKind: string;
  sourceId: string;
  clusterKey: string;
  title: string;
  snippet: string;
  timestamp?: number;
  dueAt?: number;
  score: number;
  urgency: number;
  openLoopPressure: number;
  sourceImportance: number;
  evidenceConfidence: number;
  privacyRisk: number;
  recurringNoise: number;
  cardType: DayPilotCardType;
  state: DayPilotState;
  people: Array<{ id?: string; name: string; type?: string }>;
  projects: Array<{ id?: string; name: string; type?: string }>;
  evidence: DayPilotEvidenceRef;
  openQuestions: string[];
  sourceUrl?: string;
  meetingExternalId?: string;
}

interface Cluster {
  key: string;
  candidates: Candidate[];
}

const PROVIDER_PROFILES: Record<TargetProvider, DayPilotProviderProfile> = {
  codex: {
    id: 'codex',
    label: 'Codex implementation brief',
    defaultTokenBudget: 1600,
    style: 'implementation',
  },
  chatgpt: {
    id: 'chatgpt',
    label: 'ChatGPT conversation brief',
    defaultTokenBudget: 1400,
    style: 'conversation',
  },
  claude: {
    id: 'claude',
    label: 'Claude analysis brief',
    defaultTokenBudget: 1800,
    style: 'analysis',
  },
  doubao: {
    id: 'doubao',
    label: '豆包中文上下文包',
    defaultTokenBudget: 1200,
    style: 'chinese',
  },
  generic: {
    id: 'generic',
    label: 'Generic context pack',
    defaultTokenBudget: 1200,
    style: 'plain',
  },
};

const RECENT_NOTIFICATION_WINDOW_SECONDS = 7 * 86400;
const HEARTBEAT_FACT_NOTIFICATION_PATTERN =
  /was revisited by heartbeat|事实跟进:|recent evidence item\(s\)|newest signal pointing to|事实变化/i;
const GENERIC_TRUTH_CONFLICT_TITLE_PATTERN =
  /pending truth conflict needs attention|truth conflict needs attention|待处理.{0,8}(事实|记忆).{0,8}冲突/i;
const LOW_VALUE_NOTIFICATION_TITLE_PATTERN =
  /weekly dream digest|\d+\s+dream\(s\) generated|heartbeat digest/i;
const OPENCLAW_MISSING_CAPABILITY_PATTERN =
  /openclaw.{0,24}(缺少能力|无可用|无法执行|配置完成后.{0,12}重试)|缺少能力.{0,24}openclaw/i;
const LOW_VALUE_FACT_FOLLOWUP_PATTERN =
  /事实跟进:|fact follow[-\s]?up|was revisited by heartbeat|no evidence of (planned |further )?change|remains (at|current)|still current/i;
const LOW_VALUE_JIRA_FIELD_CHANGE_PATTERN =
  /\bfix\s*version\b|fixVersion|sprint (?:was )?(?:set|updated)|updated from [^.;]+ to/i;
const JIRA_FIELD_CHANGE_ACTIONABLE_EXCEPTION_PATTERN =
  /\b(owner|eta|deadline|block(?:ed|er)?|risk|decision|approval|confirm|investigate|retry|failing?)\b|待确认|确认|阻塞|风险|负责人|下一步|审批|排查|重试/i;
const STRONG_ACTIONABLE_PATTERN =
  /follow[-\s]?up|action item|owner|eta|deadline|block(?:ed|er)?|risk|decision|approval|pending|unanswered|reply|\brespond\b|confirm|investigate|retry|failing?|跟进|待回复|未回复|回复|承诺|待确认|确认|阻塞|风险|负责人|下一步|审批|排查|重试/i;
const ACTIONABLE_RELATIONSHIP_PATTERN =
  /follow[-\s]?up|open loop|reply|respond|unanswered|pending|owner|eta|deadline|block(?:ed|er)?|risk|decision|approval|commitment|promise|owed|going cold|touch base|check in|跟进|待回复|未回复|回复|承诺|答应|欠|未关闭|待确认|确认.{0,12}(owner|负责人|时间|下一步)|阻塞|风险|变冷|冷却|久未|重新联系|会前|准备/i;
const ACTIONABLE_FOLLOWUP_PATTERN =
  /follow[-\s]?up|todo|action item|owner|eta|deadline|block(?:ed|er)?|risk|decision|approval|pending|unanswered|reply|\brespond\b|needs? to\s+(?:confirm|decide|review|reply|respond|investigate|fix|retry|approve|prepare|schedule|update|ship|release|resolve|upload|check|follow)|should\s+(?:confirm|decide|review|reply|respond|investigate|fix|retry|approve|prepare|schedule|update|ship|release|resolve|upload|check|follow)|confirm|investigate|fix|retry|failing?|跟进|待回复|未回复|回复|承诺|待确认|确认|需要|阻塞|风险|负责人|下一步|审批|排查|修复|上传|准备/i;
const ACTIONABLE_QUESTION_PATTERN =
  /(?:(?:\?|？).{0,80}(?:owner|eta|deadline|risk|approval|decision|confirm|reply|respond|fix|retry|blocked|investigate|prepare|follow[-\s]?up|跟进|待确认|确认|阻塞|风险|负责人|下一步|审批|排查|修复|准备)|(?:owner|eta|deadline|risk|approval|decision|confirm|reply|respond|fix|retry|blocked|investigate|prepare|follow[-\s]?up|跟进|待确认|确认|阻塞|风险|负责人|下一步|审批|排查|修复|准备).{0,80}(?:\?|？)|(?:怎么|如何|how (?:do|to|should|can|could)).{0,48}(?:配|配置|处理|确认|排查|修复|推进|落地|复用|接入|迁移|更新|安排|准备|回复|审批|configure|debug|fix|resolve|deploy|ship|review|confirm|respond|reply|prepare|schedule|update))/i;
const STRUCTURED_ACTIONABLE_SOURCE_KINDS = new Set([
  'action',
  'calendar',
  'notification',
  'reflection',
  'rehearsal',
  'skill',
  'relationship',
]);
const ACTIONABLE_NOTIFICATION_TYPES = new Set([
  'truth_conflict',
  'deadline',
  'reminder',
  'approval_required',
  'decision_required',
]);
const NON_ACTIONABLE_CALENDAR_TERMS = new Set(['jira', 'nova']);
const DEFAULT_LATER_SNOOZE_SECONDS = 6 * 3600;

function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function compactText(
  text: string | undefined | null,
  maxLength: number,
): string {
  const normalized = String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}

function countBySourceKind(
  evidenceRefs: DayPilotEvidenceRef[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const ref of evidenceRefs) {
    counts[ref.sourceKind] = (counts[ref.sourceKind] || 0) + 1;
  }
  return counts;
}

function uniqByName<T extends { name: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    const key = item.name.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

function normalizeKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[^\p{L}\p{N}._-]+/gu, ' ')
    .trim()
    .split(/\s+/)
    .slice(0, 6)
    .join('-');
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function pickFirstString(
  record: Record<string, any>,
  keys: string[],
): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function extractNamesFromJson(
  raw: string | null,
): Array<{ id?: string; name: string; type?: string }> {
  const parsed = safeJsonParse<unknown[]>(raw, []);
  return parsed
    .map((item) => {
      if (typeof item === 'string') return { name: item };
      if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
      const record = item as Record<string, any>;
      const name = pickFirstString(record, [
        'name',
        'title',
        'project',
        'projectName',
      ]);
      if (!name) return null;
      return {
        id: typeof record.id === 'string' ? record.id : undefined,
        name,
        type: typeof record.type === 'string' ? record.type : undefined,
      };
    })
    .filter((item): item is { id?: string; name: string; type?: string } =>
      Boolean(item),
    );
}

function extractParticipants(
  raw: string | null,
): Array<{ name: string; type?: string }> {
  const parsed = safeJsonParse<unknown>(raw, []);
  const items = Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];
  return items
    .map((item): { name: string; type?: string } | null => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
      const name = pickFirstString(item as Record<string, any>, [
        'name',
        'email',
      ]);
      return name ? { name, type: 'Person' } : null;
    })
    .filter((item): item is { name: string; type?: string } => Boolean(item));
}

function topicTerms(text: string): string[] {
  const lower = text.toLowerCase();
  const dictionary: Array<[string, string]> = [
    ['webpage-mcp', 'webpage-mcp'],
    ['webpage mcp', 'webpage-mcp'],
    ['generatednotes', 'generatednotes'],
    ['ai notes', 'ai-notes'],
    ['codex', 'codex'],
    ['mcp', 'mcp'],
    ['capacity', 'capacity'],
    ['poster', 'poster'],
    ['jira', 'jira'],
    ['factory.ai', 'factory-ai'],
    ['factory ai', 'factory-ai'],
    ['cursor', 'cursor'],
    ['claude', 'claude'],
    ['openai', 'openai'],
    ['cop', 'cop'],
    ['rio', 'rio'],
    ['kibana', 'kibana'],
    ['meeting pilot', 'meeting-pilot'],
    ['action item', 'action-item'],
    ['npm registry', 'npm-registry'],
    ['nexus', 'nexus'],
    ['migration', 'migration'],
    ['insufficient_quota', 'quota'],
    ['quota', 'quota'],
    ['realtime voice', 'realtime-voice'],
    ['realtime', 'realtime'],
    ['voice', 'voice'],
    ['init project', 'init'],
    ['init', 'init'],
    ['epic estimates', 'epic-estimates'],
    ['epic', 'epic'],
    ['estimates', 'estimates'],
    ['nova', 'nova'],
    ['dry run', 'dry-run'],
    ['story point', 'story-point'],
    ['google sheet', 'google-sheet'],
    ['team messaging bot', 'team-messaging-bot'],
    ['action blocks', 'action-blocks'],
    ['result blocks', 'result-blocks'],
    ['owner', 'owner'],
    ['follow up', 'follow-up'],
    ['配置', 'config'],
    ['重复', 'repeat'],
    ['上传', 'upload'],
    ['分享', 'sharing'],
  ];
  return Array.from(
    new Set(
      dictionary
        .filter(([needle]) => lower.includes(needle))
        .map(([, term]) => term),
    ),
  );
}

function hasOpenLoopSignal(text: string): boolean {
  const lower = text.toLowerCase();
  if (
    [
      'follow up',
      'todo',
      'owner',
      'eta',
      'block',
      'fail',
      'retry',
      '重复',
      '失败',
      '上传',
      '需要',
      '确认',
    ].some((needle) => lower.includes(needle))
  ) {
    return true;
  }
  return ACTIONABLE_QUESTION_PATTERN.test(text);
}

function recurringMeetingNoise(
  title: string,
  seriesKey?: string | null,
): number {
  const text = `${title} ${seriesKey || ''}`;
  if (/daily|standup|scrum|例会|晨会|日报/i.test(text)) return 1;
  if (/weekly|sync|all[-\s]?hands|周会|同步会|全员会/i.test(text)) return 0.75;
  return 0;
}

function splitCalendarTitleAndDescription(rawTitle: string): {
  title: string;
  inlineDescription: string;
} {
  const withoutPrefix = rawTitle.replace(/^calendar event:\s*/i, '').trim();
  const parts = withoutPrefix.split(/\s+description:\s*/i);
  return {
    title: parts[0]?.trim() || withoutPrefix,
    inlineDescription: parts.slice(1).join(' Description: ').trim(),
  };
}

function cleanCalendarTitle(rawTitle: string): string {
  const { title } = splitCalendarTitleAndDescription(rawTitle);
  return (
    compactText(
      title
        .replace(/https?:\/\/\S+/g, '')
        .replace(/\b(meeting link|dashboard|jira board|board):\s*$/i, '')
        .replace(/\s*[-|]\s*$/g, '')
        .trim(),
      88,
    ) || '日历会议'
  );
}

function cleanCalendarSnippet(
  rawTitle: string,
  rawDescription?: string | null,
): string {
  const { inlineDescription } = splitCalendarTitleAndDescription(rawTitle);
  const source = [rawDescription, inlineDescription]
    .filter((item): item is string => Boolean(item && item.trim()))
    .join(' ');
  return compactText(
    source
      .replace(/https?:\/\/\S+/g, '[link]')
      .replace(
        /\b[\w .'-]+ has invited you to a RingCentral Video meeting\.?/gi,
        '',
      )
      .replace(/[^。]{0,80}已邀请您加入 RingCentral Video 会议。?/g, '')
      .replace(/请使用以下链接加入[:：]?/g, '')
      .replace(/please (use the following link to )?join[:：]?/gi, '')
      .replace(/\b(meeting link|dashboard|jira board|board):\s*\[link\]/gi, '')
      .replace(/\s+/g, ' ')
      .trim(),
    260,
  );
}

function isOpaqueId(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function priorityFromScore(
  score: number,
  privacyRisk: number,
): DayPilotPriority {
  if (score >= 0.82 && privacyRisk < 0.7) return 'critical';
  if (score >= 0.62) return 'high';
  if (score >= 0.38) return 'medium';
  return 'low';
}

export class DayPilotService {
  private readonly repo: DayPilotRepository;

  constructor(
    private readonly db: Database.Database,
    private readonly userId: string,
  ) {
    this.repo = new DayPilotRepository(db);
  }

  getToday(options: DayPilotGetTodayOptions = {}): DayPilotTodayResponse {
    const timezone = options.timezone || 'Asia/Shanghai';
    const localDate = options.localDate || this.localDateForTimezone(timezone);
    const autoGenerate = options.autoGenerate ?? true;
    const existing = this.repo.getBriefByDate(this.userId, localDate);
    const stale = existing ? this.isBriefStale(existing) : true;

    if (existing && !stale) {
      return { brief: existing, generated: false, stale: false };
    }
    if (existing && !autoGenerate) {
      return { brief: existing, generated: false, stale };
    }
    if (!existing && !autoGenerate) {
      return {
        brief: this.emptyBrief(localDate, timezone),
        generated: false,
        stale: true,
      };
    }

    const brief = this.generateBrief({ localDate, timezone, mode: 'light' });
    return { brief, generated: true, stale };
  }

  refreshToday(options: DayPilotRefreshOptions = {}): DayPilotTodayResponse {
    const timezone = options.timezone || 'Asia/Shanghai';
    const localDate = options.localDate || this.localDateForTimezone(timezone);
    const brief = this.generateBrief({
      localDate,
      timezone,
      mode: options.mode ?? 'light',
    });
    return { brief, generated: true, stale: false };
  }

  recordCardFeedback(
    cardId: string,
    payload: DayPilotFeedbackInput,
  ): DayPilotTodayResponse {
    const card = this.repo.findCardById(cardId);
    const brief = this.repo.findBriefForCard(cardId);
    if (!card || !brief || brief.userId !== this.userId) {
      throw new Error('Day Pilot card not found');
    }
    this.repo.insertFeedback(
      brief.id,
      card,
      this.normalizeFeedbackInput(payload),
    );
    const reloaded = this.repo.getBriefById(brief.id);
    if (!reloaded) {
      throw new Error('Day Pilot brief not found after feedback');
    }
    return { brief: reloaded, generated: false, stale: false };
  }

  private normalizeFeedbackInput(
    payload: DayPilotFeedbackInput,
  ): DayPilotFeedbackInput {
    if (payload.action !== 'later') return payload;
    const currentTime = now();
    if (
      payload.snoozeUntil &&
      Number.isFinite(payload.snoozeUntil) &&
      payload.snoozeUntil > currentTime
    ) {
      return payload;
    }
    return {
      ...payload,
      snoozeUntil: currentTime + DEFAULT_LATER_SNOOZE_SECONDS,
    };
  }

  renderMissionContextPack(
    missionId: string,
    options: {
      tokenBudget?: number;
      targetProvider?: TargetProvider;
      includeSensitive?: boolean;
    } = {},
  ): DayPilotContextPackResponse {
    const targetProvider = this.normalizeProvider(options.targetProvider);
    const providerProfile = PROVIDER_PROFILES[targetProvider];
    const mission = this.repo.findMissionById(missionId);
    if (!mission) {
      throw new Error('Day Pilot mission not found');
    }
    const brief = this.repo.getBriefById(mission.briefId);
    if (!brief || brief.userId !== this.userId) {
      throw new Error('Day Pilot mission not found');
    }
    const card = this.repo.findCardByMissionId(missionId);
    const tokenBudget = Math.max(
      400,
      Math.min(options.tokenBudget ?? providerProfile.defaultTokenBudget, 4000),
    );
    const evidenceRefs = card?.evidenceRefs ?? [];
    const resolvedEvidence = evidenceRefs.map((ref) => {
      if (ref.sourceKind === 'message') {
        return this.repo.getMessageEvidence(ref.sourceId) ?? ref;
      }
      return ref;
    });
    const redaction = this.prepareEvidenceForHandoff(
      resolvedEvidence,
      Boolean(options.includeSensitive),
    );
    const baseWarnings = [
      ...redaction.warnings,
      targetProvider !== 'generic'
        ? `Target provider: ${providerProfile.label}. Verify the copied context stays within that tool's data policy.`
        : 'Generic context pack. Review before pasting into an external AI tool.',
    ].filter(Boolean);
    const initialBodyMd = this.renderProviderMarkdown({
      providerProfile,
      mission,
      card,
      evidenceRefs: redaction.evidenceRefs,
      warnings: baseWarnings,
    });
    let clamped = this.clampMarkdown(initialBodyMd, tokenBudget);
    const warnings = clamped.truncated
      ? [
          ...baseWarnings,
          `Context pack was truncated to fit the ${tokenBudget} token budget; open Today Pilot for the full evidence trail if needed.`,
        ]
      : baseWarnings;
    if (clamped.truncated) {
      clamped = this.clampMarkdown(
        this.renderProviderMarkdown({
          providerProfile,
          mission,
          card,
          evidenceRefs: redaction.evidenceRefs,
          warnings,
        }),
        tokenBudget,
      );
    }

    return {
      missionId,
      generatedAt: now(),
      tokenBudget,
      maxChars: clamped.maxChars,
      targetProvider,
      providerProfile,
      usageIntent: {
        kind: 'external_ai_context',
        boundary: 'context_only_not_execution',
        defaultSensitiveHandling: options.includeSensitive
          ? 'included_sensitive'
          : 'redacted_by_default',
      },
      sourceSummary: {
        evidenceCount: redaction.evidenceRefs.length,
        sourceKinds: countBySourceKind(redaction.evidenceRefs),
        redactionApplied: redaction.redactionApplied,
        truncated: clamped.truncated,
      },
      bodyMd: clamped.bodyMd,
      evidenceRefs: redaction.evidenceRefs,
      warnings,
      redactionPreview: redaction.redactionPreview,
      redactionApplied: redaction.redactionApplied,
      truncated: clamped.truncated,
    };
  }

  private generateBrief(options: {
    localDate: string;
    timezone: string;
    mode: RefreshMode;
  }): DayPilotBrief {
    const generatedAt = now();
    const horizonStart =
      this.localDateStartApprox(options.localDate) - 72 * 3600;
    const horizonEnd =
      this.localDateStartApprox(options.localDate) +
      (options.mode === 'full' ? 21 : 14) * 86400;
    const scan = this.scanCandidates(horizonStart, horizonEnd, generatedAt);
    const clusters = this.clusterCandidates(scan.candidates);
    const cards = clusters
      .map((cluster) =>
        this.buildMissionAndCard(cluster, options.localDate, generatedAt),
      )
      .filter(
        (item): item is { mission: DayPilotMission; card: DayPilotCard } =>
          Boolean(item && item.card.nextBestAction),
      )
      .sort((a, b) => b.card.score - a.card.score)
      .slice(0, 7);
    const sourceStats = this.sourceStatsWithSelectedCounts(
      scan.sourceStats,
      cards.map((item) => item.card),
    );

    const interruptibleCards = cards
      .filter((item) => this.shouldInterrupt(item.card))
      .slice(0, 3);
    const attentionBudget: DayPilotAttentionBudget = {
      maxInterruptions: 3,
      usedInterruptions: interruptibleCards.length,
      plannedInterruptions: interruptibleCards.map((item) => ({
        cardId: item.card.id,
        reason: this.interruptionReason(item.card),
      })),
      boardOnlyCardIds: cards
        .filter((item) => !interruptibleCards.includes(item))
        .map((item) => item.card.id),
      quietWindows: this.deriveQuietWindows(
        cards.map((item) => item.card),
        generatedAt,
      ),
    };
    const summary =
      cards.length > 0
        ? `今天生成 ${cards.length} 个具体 mission，覆盖 ${Array.from(
            new Set(cards.flatMap((item) => item.mission.sourceKinds)),
          )
            .slice(0, 5)
            .join('、')}。`
        : '今天暂未发现需要进入 Day Pilot 的高价值 mission。';

    return this.repo.storeGeneratedBrief({
      userId: this.userId,
      localDate: options.localDate,
      timezone: options.timezone,
      generatedAt,
      horizonFrom: horizonStart,
      horizonTo: horizonEnd,
      status: 'ready',
      summary,
      attentionBudget,
      sourceStats,
      missions: cards.map((item) => item.mission),
      cards: cards.map((item) => item.card),
    });
  }

  private sourceStatsWithSelectedCounts(
    sourceStats: DayPilotSourceStats,
    cards: DayPilotCard[],
  ): DayPilotSourceStats {
    const selected = this.countSelectedSourceRefs(cards);
    return {
      messages: {
        ...sourceStats.messages,
        selected: selected.messages,
      },
      calendar: {
        ...sourceStats.calendar,
        selected: selected.calendar,
      },
      notifications: {
        ...sourceStats.notifications,
        selected: selected.notifications,
      },
      actions: {
        ...sourceStats.actions,
        selected: selected.actions,
      },
      reflections: {
        ...sourceStats.reflections,
        selected: selected.reflections,
      },
      rehearsals: {
        ...sourceStats.rehearsals,
        selected: selected.rehearsals,
      },
      skills: {
        ...sourceStats.skills,
        selected: selected.skills,
      },
      relationships: {
        ...sourceStats.relationships,
        selected: selected.relationships,
      },
    };
  }

  private countSelectedSourceRefs(
    cards: DayPilotCard[],
  ): Record<keyof DayPilotSourceStats, number> {
    const counts: Record<keyof DayPilotSourceStats, number> = {
      messages: 0,
      calendar: 0,
      notifications: 0,
      actions: 0,
      reflections: 0,
      rehearsals: 0,
      skills: 0,
      relationships: 0,
    };
    const seen = new Set<string>();
    for (const card of cards) {
      for (const ref of card.evidenceRefs) {
        const key = `${ref.sourceKind}:${ref.sourceId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const bucket = this.sourceStatsBucketForEvidence(ref);
        counts[bucket] += 1;
      }
    }
    return counts;
  }

  private sourceStatsBucketForEvidence(
    ref: DayPilotEvidenceRef,
  ): keyof DayPilotSourceStats {
    switch (ref.sourceKind) {
      case 'calendar':
        return 'calendar';
      case 'notification':
        return 'notifications';
      case 'action':
        return 'actions';
      case 'reflection':
        return 'reflections';
      case 'rehearsal':
        return 'rehearsals';
      case 'skill':
        return 'skills';
      case 'relationship':
        return 'relationships';
      case 'message':
      default:
        return 'messages';
    }
  }

  private scanCandidates(
    horizonStart: number,
    horizonEnd: number,
    currentTime: number,
  ): { candidates: Candidate[]; sourceStats: DayPilotSourceStats } {
    const candidates: Candidate[] = [];
    const messages = this.scanMessages(horizonStart, horizonEnd, currentTime);
    const calendar = this.scanCalendar(currentTime, horizonEnd);
    const notifications = this.scanNotifications(currentTime);
    const actions = this.scanActions(currentTime);
    const reflections = this.scanReflections(currentTime);
    const rehearsals = this.scanRehearsals(currentTime);
    const skills = this.scanSkills();
    const relationships = this.scanRelationships(currentTime);

    candidates.push(
      ...messages.candidates,
      ...calendar.candidates,
      ...notifications.candidates,
      ...actions.candidates,
      ...reflections.candidates,
      ...rehearsals.candidates,
      ...skills.candidates,
      ...relationships.candidates,
    );

    return {
      candidates,
      sourceStats: {
        messages: {
          scanned: messages.candidates.length,
          totalRecent: messages.total,
        },
        calendar: {
          scanned: calendar.candidates.length,
          upcoming: calendar.total,
        },
        notifications: {
          scanned: notifications.candidates.length,
          pending: notifications.total,
        },
        actions: {
          scanned: actions.candidates.length,
          queued: actions.total,
        },
        reflections: {
          scanned: reflections.candidates.length,
          active: reflections.total,
        },
        rehearsals: {
          scanned: rehearsals.candidates.length,
          active: rehearsals.total,
        },
        skills: {
          scanned: skills.candidates.length,
          suggestions: skills.total,
        },
        relationships: {
          scanned: relationships.candidates.length,
          highFrequencyPeople: relationships.total,
        },
      },
    };
  }

  private scanMessages(
    horizonStart: number,
    horizonEnd: number,
    currentTime: number,
  ): {
    candidates: Candidate[];
    total: number;
  } {
    const total = (
      this.db
        .prepare(
          `SELECT COUNT(*) AS count
           FROM messages_raw
           WHERE timestamp >= ?
             AND (
               (source_type = 'calendar' AND timestamp <= ?)
               OR (COALESCE(source_type, '') != 'calendar' AND timestamp <= ?)
             )`,
        )
        .get(horizonStart, horizonEnd, currentTime) as CountRow
    ).count;
    const rows = this.db
      .prepare(
        `SELECT id, content, summary, source_type, source_url, source_title, sender,
                group_id, group_name, timestamp, entities_json, matched_projects_json,
                importance, metadata_json
         FROM messages_raw
         WHERE timestamp >= ?
           AND (
             (source_type = 'calendar' AND timestamp <= ?)
             OR (COALESCE(source_type, '') != 'calendar' AND timestamp <= ?)
           )
         ORDER BY importance DESC, timestamp DESC
         LIMIT 160`,
      )
      .all(horizonStart, horizonEnd, currentTime) as MessageCandidateRow[];

    const candidates = rows
      .filter((row) => {
        const text = `${row.summary || ''} ${row.content}`;
        if (row.source_type === 'calendar') return true;
        if (this.isLowValueJiraFieldChange(row, text)) return false;
        return (row.importance ?? 0.5) >= 0.55 || hasOpenLoopSignal(text);
      })
      .map((row) => this.messageCandidate(row, currentTime))
      .filter((item): item is Candidate => Boolean(item))
      .slice(0, 60);

    return { candidates, total };
  }

  private isLowValueJiraFieldChange(
    row: MessageCandidateRow,
    text: string,
  ): boolean {
    return (
      row.source_type === 'jira' &&
      LOW_VALUE_JIRA_FIELD_CHANGE_PATTERN.test(text) &&
      !JIRA_FIELD_CHANGE_ACTIONABLE_EXCEPTION_PATTERN.test(text)
    );
  }

  private messageCandidate(
    row: MessageCandidateRow,
    currentTime: number,
  ): Candidate | null {
    if (row.source_type === 'calendar') {
      return this.calendarMemoryCandidate(row, currentTime);
    }

    const text = `${row.summary || ''} ${row.content}`;
    const terms = topicTerms(text);
    const clusterKey = terms.length
      ? `message:${row.group_id || row.source_type}:${terms
          .slice(0, 3)
          .join('+')}`
      : `message:${row.group_id || row.source_type}:${normalizeKey(
          row.summary || row.content,
        )}`;
    const people = uniqByName([
      ...(row.sender ? [{ name: row.sender, type: 'Person' }] : []),
      ...extractNamesFromJson(row.entities_json).filter(
        (entity) => entity.type === 'Person',
      ),
    ]);
    const projects = uniqByName([
      ...extractNamesFromJson(row.matched_projects_json),
      ...extractNamesFromJson(row.entities_json).filter(
        (entity) => entity.type && entity.type !== 'Person',
      ),
    ]);
    const cardType = this.inferCardType(row.source_type, text);
    const urgency = hasOpenLoopSignal(text) ? 0.8 : 0.45;
    const score = this.computeScore({
      urgency,
      openLoopPressure: hasOpenLoopSignal(text) ? 0.9 : 0.35,
      userRoleRelevance: 0.7,
      sourceImportance: row.importance ?? 0.5,
      sourceDiversity: 0.35,
      evidenceConfidence: 0.68,
      novelty: 0.7,
      recurringNoise: 0,
      feedbackFatigue: 0,
      privacyRisk: this.privacyRisk(text),
    });

    return {
      sourceKind: row.source_type,
      sourceId: row.id,
      clusterKey,
      title: this.titleForTerms(terms, row.summary || row.content),
      snippet: compactText(row.summary || row.content, 260),
      timestamp: row.timestamp,
      score,
      urgency,
      openLoopPressure: hasOpenLoopSignal(text) ? 0.9 : 0.35,
      sourceImportance: row.importance ?? 0.5,
      evidenceConfidence: 0.68,
      privacyRisk: this.privacyRisk(text),
      recurringNoise: 0,
      cardType,
      state: urgency >= 0.75 ? 'now' : 'prepare',
      people,
      projects,
      evidence: {
        sourceKind: 'message',
        sourceId: row.id,
        title:
          row.source_title ||
          [row.group_name, row.sender].filter(Boolean).join(' · ') ||
          row.source_type,
        snippet: compactText(row.summary || row.content, 260),
        timestamp: row.timestamp,
        sourceUrl: row.source_url ?? undefined,
      },
      openQuestions: this.openQuestionsForText(text, cardType),
      sourceUrl: row.source_url ?? undefined,
    };
  }

  private calendarMemoryCandidate(
    row: MessageCandidateRow,
    currentTime: number,
  ): Candidate | null {
    const rawTitle = row.source_title || row.summary || row.content;
    const title = cleanCalendarTitle(rawTitle);
    const snippet =
      cleanCalendarSnippet(rawTitle, row.summary || row.content) || title;
    const text = `${title} ${snippet}`;
    const recurringNoise = recurringMeetingNoise(title, row.group_id);
    const terms = topicTerms(text);
    const actionable = this.hasActionableCalendarSignal(
      text,
      terms,
      recurringNoise,
    );
    if (!actionable) {
      return null;
    }

    const hoursUntil = (row.timestamp - currentTime) / 3600;
    const baseUrgency =
      hoursUntil <= 2 && hoursUntil >= -1
        ? 0.78
        : hoursUntil <= 36 && hoursUntil >= -1
        ? 0.5
        : 0.26;
    const urgency =
      recurringNoise > 0 ? Math.min(baseUrgency, 0.46) : baseUrgency;
    const sourceImportance =
      terms.some((term) => !NON_ACTIONABLE_CALENDAR_TERMS.has(term)) ||
      ACTIONABLE_FOLLOWUP_PATTERN.test(text)
        ? 0.64
        : 0.38;
    const privacyRisk = this.privacyRisk(text);
    const score = this.computeScore({
      urgency,
      openLoopPressure: ACTIONABLE_FOLLOWUP_PATTERN.test(text) ? 0.56 : 0.32,
      userRoleRelevance: 0.62,
      sourceImportance,
      sourceDiversity: 0.32,
      evidenceConfidence: 0.68,
      novelty: recurringNoise > 0 ? 0.18 : terms.length > 0 ? 0.56 : 0.3,
      recurringNoise,
      feedbackFatigue: 0,
      privacyRisk,
    });

    return {
      sourceKind: 'calendar',
      sourceId: row.id,
      clusterKey: `calendar:${row.group_id || normalizeKey(title)}`,
      title: this.titleForTerms(terms, title),
      snippet,
      timestamp: row.timestamp,
      dueAt: row.timestamp >= currentTime - 3600 ? row.timestamp : undefined,
      score,
      urgency,
      openLoopPressure: ACTIONABLE_FOLLOWUP_PATTERN.test(text) ? 0.56 : 0.32,
      sourceImportance,
      evidenceConfidence: 0.68,
      privacyRisk,
      recurringNoise,
      cardType: 'meeting_prepare',
      state: hoursUntil <= 2 && hoursUntil >= -1 ? 'now' : 'prepare',
      people: uniqByName([
        ...(row.sender ? [{ name: row.sender, type: 'Person' }] : []),
        ...extractNamesFromJson(row.entities_json).filter(
          (entity) => entity.type === 'Person',
        ),
      ]),
      projects: terms.map((term) => ({
        name: this.prettyTerm(term),
        type: 'Topic',
      })),
      evidence: {
        sourceKind: 'calendar',
        sourceId: row.id,
        title,
        snippet,
        timestamp: row.timestamp,
        sourceUrl: row.source_url ?? undefined,
      },
      openQuestions: this.openQuestionsForCalendar(text, recurringNoise),
      sourceUrl: row.source_url ?? undefined,
    };
  }

  private scanCalendar(
    currentTime: number,
    horizonEnd: number,
  ): { candidates: Candidate[]; total: number } {
    const total = (
      this.db
        .prepare(
          `SELECT COUNT(*) AS count
           FROM calendar_events
           WHERE cancelled = 0 AND start_at >= ? AND start_at <= ?`,
        )
        .get(currentTime - 3600, horizonEnd) as CountRow
    ).count;
    const rows = this.db
      .prepare(
        `SELECT id, external_id, title, description_preview, start_at, end_at, series_key,
                organizer_json, attendees_json, join_url, source_url, source_system
         FROM calendar_events
         WHERE cancelled = 0 AND start_at >= ? AND start_at <= ?
         ORDER BY start_at ASC
         LIMIT 80`,
      )
      .all(currentTime - 3600, horizonEnd) as CalendarCandidateRow[];

    const candidates = rows
      .map((row) => this.calendarCandidate(row, currentTime))
      .filter((item): item is Candidate => Boolean(item));

    return { candidates, total };
  }

  private calendarCandidate(
    row: CalendarCandidateRow,
    currentTime: number,
  ): Candidate | null {
    const title = cleanCalendarTitle(row.title);
    const snippet = cleanCalendarSnippet(row.title, row.description_preview);
    const text = `${title} ${snippet}`;
    const recurringNoise = recurringMeetingNoise(title, row.series_key);
    const terms = topicTerms(text);
    const actionable = this.hasActionableCalendarSignal(
      text,
      terms,
      recurringNoise,
    );
    if (!actionable) {
      return null;
    }
    const hoursUntil = (row.start_at - currentTime) / 3600;
    const baseUrgency = hoursUntil <= 2 ? 0.82 : hoursUntil <= 36 ? 0.52 : 0.28;
    const urgency =
      recurringNoise > 0 ? Math.min(baseUrgency, 0.48) : baseUrgency;
    const sourceImportance =
      terms.some((term) => !NON_ACTIONABLE_CALENDAR_TERMS.has(term)) ||
      ACTIONABLE_FOLLOWUP_PATTERN.test(text)
        ? 0.68
        : 0.42;
    const privacyRisk = this.privacyRisk(text);
    const score = this.computeScore({
      urgency,
      openLoopPressure: ACTIONABLE_FOLLOWUP_PATTERN.test(text) ? 0.58 : 0.34,
      userRoleRelevance: 0.64,
      sourceImportance,
      sourceDiversity: 0.35,
      evidenceConfidence: 0.75,
      novelty: recurringNoise > 0 ? 0.22 : terms.length > 0 ? 0.64 : 0.38,
      recurringNoise,
      feedbackFatigue: 0,
      privacyRisk,
    });

    return {
      sourceKind: 'calendar',
      sourceId: row.id,
      clusterKey: `calendar:${row.series_key || row.id}`,
      title: this.titleForTerms(terms, title),
      snippet: snippet || title,
      timestamp: row.start_at,
      dueAt: row.start_at,
      score,
      urgency,
      openLoopPressure: ACTIONABLE_FOLLOWUP_PATTERN.test(text) ? 0.58 : 0.34,
      sourceImportance,
      evidenceConfidence: 0.75,
      privacyRisk,
      recurringNoise,
      cardType: 'meeting_prepare',
      state: hoursUntil <= 2 ? 'now' : 'prepare',
      people: uniqByName([
        ...extractParticipants(row.organizer_json),
        ...extractParticipants(row.attendees_json),
      ]),
      projects: terms.map((term) => ({
        name: this.prettyTerm(term),
        type: 'Topic',
      })),
      evidence: {
        sourceKind: 'calendar',
        sourceId: row.id,
        title,
        snippet: snippet || title,
        timestamp: row.start_at,
        sourceUrl: row.source_url || row.join_url || undefined,
      },
      openQuestions: this.openQuestionsForCalendar(text, recurringNoise),
      sourceUrl: row.source_url || row.join_url || undefined,
      meetingExternalId: row.external_id,
    };
  }

  private hasActionableCalendarSignal(
    text: string,
    terms: string[],
    recurringNoise: number,
  ): boolean {
    if (ACTIONABLE_FOLLOWUP_PATTERN.test(text)) return true;
    if (recurringNoise > 0) return false;
    return terms.some((term) => !NON_ACTIONABLE_CALENDAR_TERMS.has(term));
  }

  private openQuestionsForCalendar(
    text: string,
    recurringNoise: number,
  ): string[] {
    if (recurringNoise > 0) {
      return ['这场重复会议今天是否有明确 owner、风险、决策或阻塞要带进去？'];
    }
    if (/分享|presentation|deck|材料|cop|sharing/i.test(text)) {
      return ['会前材料里还缺哪个真实案例或结论？'];
    }
    return ['这场会前需要准备哪些上下文？'];
  }

  private scanNotifications(currentTime: number): {
    candidates: Candidate[];
    total: number;
  } {
    const total = (
      this.db
        .prepare(
          `SELECT COUNT(*) AS count
           FROM notification_records
           WHERE clicked_at IS NULL AND dismissed_at IS NULL
             AND (sent_at IS NULL OR sent_at <= ?)`,
        )
        .get(currentTime) as CountRow
    ).count;
    const rows = this.db
      .prepare(
        `SELECT id, channel, type, title, body, payload_json, topic_id,
                related_entity_id, utility_score, created_at
         FROM notification_records
         WHERE clicked_at IS NULL AND dismissed_at IS NULL
           AND (sent_at IS NULL OR sent_at <= ?)
           AND (
             created_at >= ?
             OR type IN ('truth_conflict', 'deadline', 'reminder',
                         'approval_required', 'decision_required')
           )
         ORDER BY COALESCE(utility_score, 0.5) DESC, created_at DESC
         LIMIT 80`,
      )
      .all(
        currentTime,
        currentTime - RECENT_NOTIFICATION_WINDOW_SECONDS,
      ) as NotificationCandidateRow[];

    return {
      total,
      candidates: rows
        .filter((row) => (row.utility_score ?? 0.5) >= 0.45)
        .map((row) => this.notificationCandidate(row, currentTime))
        .filter((item): item is Candidate => Boolean(item))
        .slice(0, 40),
    };
  }

  private notificationCandidate(
    row: NotificationCandidateRow,
    currentTime: number,
  ): Candidate | null {
    const text = `${row.title} ${row.body || ''}`;
    if (this.isLowActionabilityNotification(row, text, currentTime)) {
      return null;
    }
    const utility = row.utility_score ?? 0.55;
    const isTruthConflict = row.type === 'truth_conflict';
    const ageSeconds = Math.max(0, currentTime - row.created_at);
    const isFresh = ageSeconds <= 2 * 86400;
    const urgency = isTruthConflict
      ? 0.82
      : isFresh && utility >= 0.75
      ? 0.72
      : 0.44;
    const openLoopPressure = isTruthConflict
      ? 0.85
      : hasOpenLoopSignal(text)
      ? 0.58
      : 0.34;
    const privacyRisk = this.privacyRisk(text);
    const score = this.computeScore({
      urgency,
      openLoopPressure,
      userRoleRelevance: isTruthConflict ? 0.7 : 0.58,
      sourceImportance: utility,
      sourceDiversity: 0.5,
      evidenceConfidence: 0.62,
      novelty: isFresh ? 0.55 : 0.22,
      recurringNoise: isFresh ? 0 : 0.25,
      feedbackFatigue: 0,
      privacyRisk,
    });
    const topicName = this.notificationTopicName(row);
    const title = this.cleanNotificationTitle(row);
    return {
      sourceKind: 'notification',
      sourceId: row.id,
      clusterKey: this.notificationClusterKey(row, title, topicName),
      title,
      snippet: compactText(row.body || row.title, 260),
      timestamp: row.created_at,
      score,
      urgency,
      openLoopPressure,
      sourceImportance: utility,
      evidenceConfidence: 0.62,
      privacyRisk,
      recurringNoise: isFresh ? 0 : 0.25,
      cardType: isTruthConflict ? 'memory_quality' : 'thread_followup',
      state:
        isTruthConflict || (isFresh && utility >= 0.75) ? 'now' : 'prepare',
      people: [],
      projects: topicName
        ? [{ id: row.topic_id ?? undefined, name: topicName, type: 'Topic' }]
        : [],
      evidence: {
        sourceKind: 'notification',
        sourceId: row.id,
        title,
        snippet: compactText(row.body || row.title, 260),
        timestamp: row.created_at,
      },
      openQuestions: isTruthConflict
        ? ['哪条记忆应该作为今天使用的可信版本？']
        : [],
    };
  }

  private isLowActionabilityNotification(
    row: NotificationCandidateRow,
    text: string,
    currentTime: number,
  ): boolean {
    if (
      row.type === 'notify_user' &&
      HEARTBEAT_FACT_NOTIFICATION_PATTERN.test(text)
    ) {
      return true;
    }
    if (LOW_VALUE_NOTIFICATION_TITLE_PATTERN.test(text)) {
      return true;
    }
    if (
      !ACTIONABLE_NOTIFICATION_TYPES.has(row.type || '') &&
      !STRONG_ACTIONABLE_PATTERN.test(text) &&
      !OPENCLAW_MISSING_CAPABILITY_PATTERN.test(text) &&
      !hasOpenLoopSignal(text)
    ) {
      return true;
    }

    const ageSeconds = Math.max(0, currentTime - row.created_at);
    if (
      ageSeconds > RECENT_NOTIFICATION_WINDOW_SECONDS &&
      !ACTIONABLE_NOTIFICATION_TYPES.has(row.type || '')
    ) {
      return true;
    }

    return false;
  }

  private cleanNotificationTitle(row: NotificationCandidateRow): string {
    const cleaned = row.title.replace(/^自我反思:\s*/, '');
    const combined = `${cleaned} ${row.body || ''}`;
    if (OPENCLAW_MISSING_CAPABILITY_PATTERN.test(combined)) {
      return 'OpenClaw 缺少能力重试确认';
    }
    if (
      row.type === 'truth_conflict' &&
      GENERIC_TRUTH_CONFLICT_TITLE_PATTERN.test(cleaned)
    ) {
      return '待核对的记忆事实冲突';
    }
    return compactText(cleaned, 88);
  }

  private notificationClusterKey(
    row: NotificationCandidateRow,
    title: string,
    topicName?: string,
  ): string {
    if (
      row.type === 'truth_conflict' &&
      (GENERIC_TRUTH_CONFLICT_TITLE_PATTERN.test(row.title) ||
        title === '待核对的记忆事实冲突')
    ) {
      return 'notification:truth_conflict:generic';
    }
    if (
      /新的认知冲突需要决策|new cognitive conflict needs decision/i.test(title)
    ) {
      return `notification:title:${normalizeKey(title)}`;
    }
    if (title === 'OpenClaw 缺少能力重试确认') {
      return 'notification:openclaw:missing-capability';
    }
    return `notification:${
      row.topic_id || row.related_entity_id || topicName || row.type || row.id
    }`;
  }

  private notificationTopicName(
    row: NotificationCandidateRow,
  ): string | undefined {
    const payload = safeJsonParse<Record<string, unknown>>(
      row.payload_json,
      {},
    );
    const fromPayload = pickFirstString(payload, [
      'topicName',
      'topicTitle',
      'entityName',
      'label',
      'name',
    ]);
    if (fromPayload) return fromPayload;
    if (row.topic_id && !isOpaqueId(row.topic_id)) return row.topic_id;
    if (row.related_entity_id && !isOpaqueId(row.related_entity_id)) {
      return row.related_entity_id;
    }
    return undefined;
  }

  private isStaleLowValueFactFollowup(
    text: string,
    timestamp: number | null | undefined,
    currentTime: number,
  ): boolean {
    if (!timestamp || currentTime - timestamp <= 14 * 86400) return false;
    return LOW_VALUE_FACT_FOLLOWUP_PATTERN.test(text);
  }

  private scanActions(currentTime: number): {
    candidates: Candidate[];
    total: number;
  } {
    const total = (
      this.db
        .prepare(
          `SELECT COUNT(*) AS count
           FROM proposed_actions
           WHERE COALESCE(queue_status, 'queued') IN ('queued', 'failed')`,
        )
        .get() as CountRow
    ).count;
    const rows = this.db
      .prepare(
        `SELECT id, type, title, description, risk_level, confidence, evidence_refs_json,
                requires_approval, created_at, action_type, execution_mode, priority,
                scheduled_at, last_error, source_kind, source_ref_id, queue_status,
                utility_score, urgency_score
         FROM proposed_actions
         WHERE COALESCE(queue_status, 'queued') IN ('queued', 'failed')
         ORDER BY priority DESC, created_at DESC
         LIMIT 40`,
      )
      .all() as ActionCandidateRow[];
    return {
      total,
      candidates: rows
        .map((row) => this.actionCandidate(row, currentTime))
        .filter((item): item is Candidate => Boolean(item)),
    };
  }

  private actionCandidate(
    row: ActionCandidateRow,
    currentTime: number,
  ): Candidate | null {
    const text = `${row.title} ${row.description || ''} ${
      row.last_error || ''
    }`;
    if (this.isStaleLowValueFactFollowup(text, row.created_at, currentTime)) {
      return null;
    }
    const actionTime = row.scheduled_at || row.created_at;
    if (
      !row.requires_approval &&
      actionTime &&
      currentTime - actionTime > 14 * 86400
    ) {
      return null;
    }
    const riskUrgency =
      row.requires_approval || row.risk_level === 'high' ? 0.86 : 0.55;
    const urgency = clamp01(row.urgency_score ?? riskUrgency);
    const sourceImportance = clamp01(
      row.utility_score ?? (row.priority ?? 5) / 10,
    );
    const privacyRisk = this.privacyRisk(text);
    const score = this.computeScore({
      urgency,
      openLoopPressure: row.queue_status === 'failed' ? 0.85 : 0.6,
      userRoleRelevance: 0.72,
      sourceImportance,
      sourceDiversity: 0.48,
      evidenceConfidence: row.confidence ?? 0.6,
      novelty: 0.55,
      recurringNoise: 0,
      feedbackFatigue: 0,
      privacyRisk,
    });
    return {
      sourceKind: 'action',
      sourceId: row.id,
      clusterKey: `action:${row.source_kind || row.action_type || row.type}:${
        row.source_ref_id || normalizeKey(row.title)
      }`,
      title: row.title,
      snippet: compactText(row.description || row.last_error || row.title, 260),
      timestamp: row.scheduled_at || row.created_at,
      dueAt: row.scheduled_at ?? undefined,
      score,
      urgency,
      openLoopPressure: row.queue_status === 'failed' ? 0.85 : 0.6,
      sourceImportance,
      evidenceConfidence: row.confidence ?? 0.6,
      privacyRisk,
      recurringNoise: 0,
      cardType: row.requires_approval ? 'decision_check' : 'thread_followup',
      state: row.requires_approval ? 'now' : 'prepare',
      people: [],
      projects: row.source_kind
        ? [{ name: row.source_kind, type: 'Source' }]
        : [],
      evidence: {
        sourceKind: 'action',
        sourceId: row.id,
        title: row.action_type || row.type,
        snippet: compactText(
          row.description || row.last_error || row.title,
          260,
        ),
        timestamp: row.created_at,
      },
      openQuestions: row.requires_approval
        ? ['是否允许这条动作继续执行？']
        : [],
    };
  }

  private scanReflections(currentTime: number): {
    candidates: Candidate[];
    total: number;
  } {
    const total = (
      this.db
        .prepare(
          `SELECT COUNT(*) AS count
           FROM reflection_threads
           WHERE status = 'active'`,
        )
        .get() as CountRow
    ).count;
    const rows = this.db
      .prepare(
        `SELECT id, topic_key, title, priority, salience, source_type, source_ref_id,
                current_hypothesis, open_questions_json, latest_summary,
                next_reflection_at, updated_at
         FROM reflection_threads
         WHERE status = 'active'
           AND (priority >= 7 OR next_reflection_at IS NULL OR next_reflection_at <= ?)
         ORDER BY priority DESC, updated_at DESC
         LIMIT 30`,
      )
      .all(currentTime) as ReflectionCandidateRow[];
    return {
      total,
      candidates: rows
        .map((row) => this.reflectionCandidate(row, currentTime))
        .filter((item): item is Candidate => Boolean(item)),
    };
  }

  private reflectionCandidate(
    row: ReflectionCandidateRow,
    currentTime: number,
  ): Candidate | null {
    const text = `${row.title} ${row.current_hypothesis || ''} ${
      row.latest_summary || ''
    }`;
    if (this.isStaleLowValueFactFollowup(text, row.updated_at, currentTime)) {
      return null;
    }
    const due =
      !row.next_reflection_at || row.next_reflection_at <= currentTime;
    const privacyRisk = this.privacyRisk(text);
    const urgency = due ? 0.68 : 0.38;
    const score = this.computeScore({
      urgency,
      openLoopPressure: 0.72,
      userRoleRelevance: 0.68,
      sourceImportance: clamp01((row.priority || 5) / 10),
      sourceDiversity: 0.42,
      evidenceConfidence: row.salience ?? 0.55,
      novelty: 0.5,
      recurringNoise: 0,
      feedbackFatigue: 0,
      privacyRisk,
    });
    return {
      sourceKind: 'reflection',
      sourceId: row.id,
      clusterKey: `reflection:${row.topic_key}`,
      title: row.title,
      snippet: compactText(
        row.current_hypothesis || row.latest_summary || row.title,
        260,
      ),
      timestamp: row.updated_at,
      dueAt: row.next_reflection_at ?? undefined,
      score,
      urgency,
      openLoopPressure: 0.72,
      sourceImportance: clamp01((row.priority || 5) / 10),
      evidenceConfidence: row.salience ?? 0.55,
      privacyRisk,
      recurringNoise: 0,
      cardType: 'thread_followup',
      state: due ? 'waiting' : 'prepare',
      people: [],
      projects: row.source_type
        ? [{ name: row.source_type, type: 'Source' }]
        : [],
      evidence: {
        sourceKind: 'reflection',
        sourceId: row.id,
        title: row.topic_key,
        snippet: compactText(
          row.current_hypothesis || row.latest_summary || row.title,
          260,
        ),
        timestamp: row.updated_at,
      },
      openQuestions: safeJsonParse<string[]>(row.open_questions_json, []).slice(
        0,
        3,
      ),
    };
  }

  private scanRehearsals(currentTime: number): {
    candidates: Candidate[];
    total: number;
  } {
    const total = (
      this.db
        .prepare(
          `SELECT COUNT(*) AS count
           FROM rehearsals
           WHERE status IN ('active', 'candidate', 'stale')`,
        )
        .get() as CountRow
    ).count;
    const rows = this.db
      .prepare(
        `SELECT id, title, scenario_type, status, summary, content,
                activation_cues_json, evidence_refs_json, confidence, priority,
                valid_until, last_activated_at, updated_at, stale_reason
         FROM rehearsals
         WHERE status IN ('active', 'stale')
            OR (status = 'candidate' AND confidence >= 0.82)
         ORDER BY
           CASE status WHEN 'active' THEN 0 WHEN 'candidate' THEN 1 ELSE 2 END,
           priority DESC,
           confidence DESC,
           updated_at DESC
         LIMIT 30`,
      )
      .all() as RehearsalCandidateRow[];
    return {
      total,
      candidates: rows
        .map((row) => this.rehearsalCandidate(row, currentTime))
        .filter((item): item is Candidate => Boolean(item)),
    };
  }

  private rehearsalCandidate(
    row: RehearsalCandidateRow,
    currentTime: number,
  ): Candidate | null {
    const cues = safeJsonParse<Record<string, string[]>>(
      row.activation_cues_json,
      {},
    );
    const text = `${row.title} ${row.summary || ''} ${row.content}`;
    const isExpired = Boolean(row.valid_until && row.valid_until < currentTime);
    const aging =
      row.last_activated_at && currentTime - row.last_activated_at > 30 * 86400;
    const urgency = row.valid_until
      ? row.valid_until < currentTime
        ? 0.24
        : row.valid_until - currentTime <= 3 * 86400
        ? 0.72
        : 0.46
      : 0.48;
    const privacyRisk = this.privacyRisk(text);
    const score = this.computeScore({
      urgency,
      openLoopPressure: row.status === 'stale' || isExpired ? 0.38 : 0.68,
      userRoleRelevance: 0.7,
      sourceImportance: clamp01((row.priority || 5) / 10),
      sourceDiversity: 0.45,
      evidenceConfidence: row.confidence ?? 0.55,
      novelty: row.status === 'candidate' ? 0.62 : 0.48,
      recurringNoise: aging || row.status === 'stale' ? 0.32 : 0,
      feedbackFatigue: 0,
      privacyRisk,
    });
    if (score < 0.42 && row.status === 'stale') return null;

    const people = (cues.people ?? []).slice(0, 5).map((name) => ({
      name,
      type: 'Person',
    }));
    const projects = [...(cues.projects ?? []), ...(cues.issueKeys ?? [])]
      .slice(0, 5)
      .map((name) => ({ name, type: 'Cue' }));
    const snippet = compactText(row.summary || row.content || row.title, 260);
    return {
      sourceKind: 'rehearsal',
      sourceId: row.id,
      clusterKey: `rehearsal:${row.id}`,
      title: row.title,
      snippet,
      timestamp: row.updated_at,
      dueAt: row.valid_until ?? undefined,
      score,
      urgency,
      openLoopPressure: row.status === 'stale' || isExpired ? 0.38 : 0.68,
      sourceImportance: clamp01((row.priority || 5) / 10),
      evidenceConfidence: row.confidence ?? 0.55,
      privacyRisk,
      recurringNoise: aging || row.status === 'stale' ? 0.32 : 0,
      cardType: 'rehearsal_prompt',
      state: row.status === 'stale' || isExpired ? 'waiting' : 'prepare',
      people,
      projects,
      evidence: {
        sourceKind: 'rehearsal',
        sourceId: row.id,
        title: row.scenario_type,
        snippet,
        timestamp: row.updated_at,
        exploreLink: `/rehearsals?rehearsalId=${encodeURIComponent(row.id)}`,
      },
      openQuestions:
        row.status === 'stale'
          ? [`这条预演已降权：${row.stale_reason || '长期未触发'}`]
          : [],
    };
  }

  private scanSkills(): { candidates: Candidate[]; total: number } {
    const total = (
      this.db
        .prepare(
          `SELECT COUNT(*) AS count
           FROM personal_skills
           WHERE status = 'suggestion'`,
        )
        .get() as CountRow
    ).count;
    const rows = this.db
      .prepare(
        `SELECT id, slug, title, summary, scope, risk, trigger_text, not_use_text,
                status, source_kinds_json, repetition, risk_brief, suggested_from,
                suggested_at, suggestion_cluster_key, updated_at
         FROM personal_skills
         WHERE status = 'suggestion'
         ORDER BY COALESCE(suggested_at, updated_at) DESC
         LIMIT 30`,
      )
      .all() as SkillCandidateRow[];
    return { total, candidates: rows.map((row) => this.skillCandidate(row)) };
  }

  private skillCandidate(row: SkillCandidateRow): Candidate {
    const text = `${row.title} ${row.summary} ${row.trigger_text || ''} ${
      row.repetition || ''
    }`;
    const privacyRisk = this.privacyRisk(text);
    const score = this.computeScore({
      urgency: row.risk === 'high' ? 0.62 : 0.45,
      openLoopPressure: 0.56,
      userRoleRelevance: 0.72,
      sourceImportance: row.risk === 'low' ? 0.54 : 0.66,
      sourceDiversity: 0.6,
      evidenceConfidence: 0.6,
      novelty: 0.65,
      recurringNoise: 0,
      feedbackFatigue: 0,
      privacyRisk,
    });
    return {
      sourceKind: 'skill',
      sourceId: row.id,
      clusterKey: `skill:${row.suggestion_cluster_key || row.slug}`,
      title: `沉淀技能：${row.title}`,
      snippet: compactText(
        row.summary || row.repetition || row.trigger_text || row.title,
        260,
      ),
      timestamp: row.suggested_at || row.updated_at,
      score,
      urgency: row.risk === 'high' ? 0.62 : 0.45,
      openLoopPressure: 0.56,
      sourceImportance: row.risk === 'low' ? 0.54 : 0.66,
      evidenceConfidence: 0.6,
      privacyRisk,
      recurringNoise: 0,
      cardType: 'skill_opportunity',
      state: 'prepare',
      people: [],
      projects: [{ name: row.scope, type: 'SkillScope' }],
      evidence: {
        sourceKind: 'skill',
        sourceId: row.id,
        title: row.suggested_from || row.scope,
        snippet: compactText(row.summary || row.repetition || row.title, 260),
        timestamp: row.suggested_at || row.updated_at,
      },
      openQuestions: ['这条方法是否会重复使用？'],
    };
  }

  private scanRelationships(currentTime: number): {
    candidates: Candidate[];
    total: number;
  } {
    const total = (
      this.db
        .prepare(
          `SELECT COUNT(*) AS count
           FROM relationship_radar_people
           WHERE radar_state IN ('core', 'active', 'rising')`,
        )
        .get() as CountRow
    ).count;
    const rows = this.db
      .prepare(
        `SELECT r.entity_id, r.score, r.interaction_count, r.last_interaction_at,
                r.summary, r.evidence_refs_json, e.name AS entity_name
         FROM relationship_radar_people r
         LEFT JOIN entities e ON e.id = r.entity_id
         WHERE r.radar_state IN ('core', 'active', 'rising')
           AND r.score >= 0.65
         ORDER BY r.score DESC, r.last_interaction_at DESC
         LIMIT 12`,
      )
      .all() as RelationshipCandidateRow[];
    return {
      total,
      candidates: rows
        .map((row) => this.relationshipCandidate(row, currentTime))
        .filter((item): item is Candidate => Boolean(item)),
    };
  }

  private relationshipCandidate(
    row: RelationshipCandidateRow,
    currentTime: number,
  ): Candidate | null {
    const name = row.entity_name || row.entity_id;
    const evidenceRefs = safeJsonParse<DayPilotEvidenceRef[]>(
      row.evidence_refs_json,
      [],
    );
    const evidenceText = evidenceRefs
      .map((ref) => `${ref.title || ''} ${ref.snippet}`)
      .join(' ');
    const signalText = `${row.summary || ''} ${evidenceText}`;
    if (!ACTIONABLE_RELATIONSHIP_PATTERN.test(signalText)) {
      return null;
    }

    const snippet =
      row.summary ||
      evidenceRefs[0]?.snippet ||
      `${name} 有一条明确 follow-up 信号，今天适合确认是否需要主动同步。`;
    const latestEvidenceAt =
      row.last_interaction_at ??
      evidenceRefs
        .map((ref) => ref.timestamp)
        .filter((item): item is number => Number.isFinite(item))
        .sort((a, b) => b - a)[0];
    const ageSeconds = latestEvidenceAt
      ? Math.max(0, currentTime - latestEvidenceAt)
      : undefined;
    const urgency =
      /deadline|block(?:ed|er)?|risk|owner|eta|阻塞|风险|负责人|时间/i.test(
        signalText,
      )
        ? 0.58
        : ageSeconds !== undefined && ageSeconds <= 3 * 86400
        ? 0.48
        : 0.38;
    const score = this.computeScore({
      urgency,
      openLoopPressure: 0.64,
      userRoleRelevance: 0.62,
      sourceImportance: clamp01(row.score),
      sourceDiversity: 0.45,
      evidenceConfidence: 0.62,
      novelty: ageSeconds !== undefined && ageSeconds <= 7 * 86400 ? 0.5 : 0.32,
      recurringNoise: 0,
      feedbackFatigue: 0,
      privacyRisk: this.privacyRisk(snippet),
    });
    return {
      sourceKind: 'relationship',
      sourceId: row.entity_id,
      clusterKey: `relationship:${row.entity_id}`,
      title: `关系 follow-up：${name}`,
      snippet: compactText(snippet, 260),
      timestamp: latestEvidenceAt ?? undefined,
      score,
      urgency,
      openLoopPressure: 0.64,
      sourceImportance: clamp01(row.score),
      evidenceConfidence: 0.62,
      privacyRisk: this.privacyRisk(snippet),
      recurringNoise: 0,
      cardType: 'relationship_ping',
      state: 'waiting',
      people: [{ id: row.entity_id, name, type: 'Person' }],
      projects: [],
      evidence: {
        sourceKind: 'relationship',
        sourceId: row.entity_id,
        title: name,
        snippet: compactText(snippet, 260),
        timestamp: latestEvidenceAt ?? undefined,
      },
      openQuestions: ['今天是否需要主动同步这条 follow-up 或补齐下一步？'],
    };
  }

  private clusterCandidates(candidates: Candidate[]): Cluster[] {
    const clusters = new Map<string, Candidate[]>();
    for (const candidate of candidates) {
      const key =
        candidate.clusterKey || `${candidate.sourceKind}:${candidate.sourceId}`;
      const existing = clusters.get(key) ?? [];
      existing.push(candidate);
      clusters.set(key, existing);
    }
    return Array.from(clusters.entries()).map(([key, items]) => ({
      key,
      candidates: items.sort((a, b) => b.score - a.score),
    }));
  }

  private buildMissionAndCard(
    cluster: Cluster,
    localDate: string,
    generatedAt: number,
  ): { mission: DayPilotMission; card: DayPilotCard } | null {
    const top = cluster.candidates[0];
    if (!top) return null;
    const sourceKinds = Array.from(
      new Set(cluster.candidates.map((item) => item.sourceKind)),
    );
    const people = uniqByName(
      cluster.candidates.flatMap((item) => item.people),
    ).slice(0, 6);
    const projects = uniqByName(
      cluster.candidates.flatMap((item) => item.projects),
    ).slice(0, 6);
    const evidenceRefs = this.compactEvidence(
      cluster.candidates.map((item) => item.evidence),
    );
    if (evidenceRefs.length === 0) return null;

    const privacyRisk = Math.max(
      ...cluster.candidates.map((item) => item.privacyRisk),
    );
    const sourceHash = contentHash(
      JSON.stringify({
        key: cluster.key,
        sources: evidenceRefs.map((ref) => `${ref.sourceKind}:${ref.sourceId}`),
      }),
    );
    const feedbackSignal = this.repo.getFeedbackSignal(this.userId, sourceHash);
    if (feedbackSignal.muteCount > 0) {
      return null;
    }
    const missionId = `daymission:${localDate}:${sourceHash.slice(0, 18)}`;
    const cardId = `daycard:${localDate}:${sourceHash.slice(0, 18)}`;
    const cardType = this.pickCardType(cluster.candidates);
    const state = this.pickState(cluster.candidates);
    const title = compactText(this.clusterTitle(cluster), 90);
    const nextAction = this.nextBestAction(cardType, title, cluster.candidates);
    const score = this.applyFeedbackSignal(
      this.clusterScore(cluster) -
        this.clusterStalenessPenalty(cluster, generatedAt),
      feedbackSignal,
    );
    if (score < 0.18 && feedbackSignal.wrongCount > 0) {
      return null;
    }
    const timeValues = cluster.candidates
      .flatMap((item) => [item.timestamp, item.dueAt])
      .filter((item): item is number => Number.isFinite(item));
    const mission: DayPilotMission = {
      id: missionId,
      briefId: '',
      missionKey: cluster.key,
      title,
      status: state === 'waiting' ? 'waiting' : 'active',
      sourceKinds,
      timeWindow:
        timeValues.length > 0
          ? {
              from: Math.min(...timeValues),
              to: Math.max(...timeValues),
            }
          : {},
      relatedRefs: {
        sources: evidenceRefs.map((ref) => `${ref.sourceKind}:${ref.sourceId}`),
        people,
        projects,
      },
      currentState: this.whyNow(cluster),
      desiredOutcome: nextAction,
      nextActions: [
        {
          title: nextAction,
          desc: this.nextActionDesc(cardType),
        },
      ],
      score,
      createdAt: generatedAt,
      updatedAt: generatedAt,
    };
    const trust = {
      confidence: clamp01(
        cluster.candidates.reduce(
          (sum, item) => sum + item.evidenceConfidence,
          0,
        ) / cluster.candidates.length,
      ),
      riskLevel:
        privacyRisk >= 0.7
          ? ('high' as const)
          : privacyRisk >= 0.35
          ? ('medium' as const)
          : ('low' as const),
      staleEvidenceCount: cluster.candidates.filter(
        (item) => item.timestamp && generatedAt - item.timestamp > 14 * 86400,
      ).length,
      sensitiveEvidenceCount: cluster.candidates.filter(
        (item) => item.privacyRisk >= 0.7,
      ).length,
    };
    const priority = this.priorityForCluster(score, privacyRisk, cluster);
    const card: DayPilotCard = {
      id: cardId,
      briefId: '',
      missionId,
      cardType,
      title,
      priority,
      state,
      whyNow: this.whyNow(cluster),
      nextBestAction: nextAction,
      dueAt: this.pickDueAt(cluster.candidates),
      people,
      projects,
      evidenceRefs,
      openQuestions: Array.from(
        new Set(cluster.candidates.flatMap((item) => item.openQuestions)),
      ).slice(0, 5),
      trust,
      contextPack: {
        preview: compactText(`${title}: ${this.whyNow(cluster)}`, 260),
        prepId:
          cardType === 'meeting_prepare'
            ? this.findDefaultMeetingPrepId(cluster.candidates, localDate)
            : undefined,
        tokenBudget:
          PROVIDER_PROFILES[this.defaultProvider(cardType)].defaultTokenBudget,
        defaultProvider: this.defaultProvider(cardType),
        providers: Object.values(PROVIDER_PROFILES).map((profile) => ({
          id: profile.id,
          label: profile.label,
          tokenBudget: profile.defaultTokenBudget,
        })),
        redaction: {
          required: trust.sensitiveEvidenceCount > 0 || privacyRisk >= 0.35,
          sensitiveEvidenceCount: trust.sensitiveEvidenceCount,
          preview: this.redactionPreviewForEvidence(evidenceRefs),
        },
        attention: {
          delivery: this.deliveryMode(priority, state, trust),
          reason: this.deliveryReason(priority, state, trust),
        },
        feedback: {
          usefulCount: feedbackSignal.usefulCount,
          wrongCount: feedbackSignal.wrongCount,
          laterCount: feedbackSignal.laterCount,
        },
      },
      sourceHash,
      score,
      createdAt: generatedAt,
      updatedAt: generatedAt,
    };
    return { mission, card };
  }

  private findDefaultMeetingPrepId(
    candidates: Candidate[],
    localDate: string,
  ): string | undefined {
    const eventExternalId = candidates.find(
      (item) => item.meetingExternalId,
    )?.meetingExternalId;
    if (!eventExternalId) return undefined;
    try {
      const row = this.db
        .prepare(
          `SELECT id
           FROM today_meeting_preps
           WHERE user_id = ?
             AND local_date = ?
             AND event_external_id = ?
             AND goal_hash = ''
             AND status IN ('ready', 'fallback')
           ORDER BY generated_at DESC
           LIMIT 1`,
        )
        .get(this.userId, localDate, eventExternalId) as
        | { id: string }
        | undefined;
      return row?.id;
    } catch {
      return undefined;
    }
  }

  private normalizeProvider(provider?: TargetProvider): TargetProvider {
    return provider && PROVIDER_PROFILES[provider] ? provider : 'generic';
  }

  private prepareEvidenceForHandoff(
    evidenceRefs: DayPilotEvidenceRef[],
    includeSensitive: boolean,
  ): {
    evidenceRefs: DayPilotEvidenceRef[];
    warnings: string[];
    redactionPreview: string[];
    redactionApplied: boolean;
  } {
    const redactionPreview = this.redactionPreviewForEvidence(evidenceRefs);
    if (includeSensitive) {
      return {
        evidenceRefs,
        redactionPreview,
        redactionApplied: false,
        warnings: redactionPreview.length
          ? [
              'Sensitive or direct source fields are included because includeSensitive=true.',
            ]
          : [],
      };
    }

    const redactedEvidence = evidenceRefs.map((ref) => ({
      ...ref,
      snippet: this.redactText(ref.snippet),
      sourceUrl: undefined,
    }));
    return {
      evidenceRefs: redactedEvidence,
      redactionPreview,
      redactionApplied: redactionPreview.length > 0,
      warnings: [
        redactionPreview.length > 0
          ? 'Sensitive or direct source fields were redacted by default; use includeSensitive only after review.'
          : 'Sensitive fields are not expanded automatically; review evidence before external AI handoff.',
      ],
    };
  }

  private renderProviderMarkdown(input: {
    providerProfile: DayPilotProviderProfile;
    mission: DayPilotMission;
    card: DayPilotCard | null;
    evidenceRefs: DayPilotEvidenceRef[];
    warnings: string[];
  }): string {
    const { providerProfile, mission, card, evidenceRefs, warnings } = input;
    const whyNow =
      card?.whyNow ||
      mission.currentState ||
      'This mission is part of today’s Memory Day Pilot brief.';
    const nextBestAction =
      card?.nextBestAction ||
      mission.nextActions.map((action) => action.title).join('; ') ||
      'Review the linked evidence and decide the next step.';
    const openQuestions = card?.openQuestions.length
      ? card.openQuestions.slice(0, 5)
      : ['No explicit open questions.'];
    const evidenceLines = evidenceRefs.map((ref) =>
      this.evidenceMarkdownLine(ref),
    );
    const handoffBoundary = [
      '- This pack gives the target AI context to read; it is not permission to execute external actions.',
      '- Keep final decisions, external sends, approvals, and destructive changes under user control.',
    ];
    const chineseHandoffBoundary = [
      '- 这份上下文包只是给目标 AI 阅读的背景，不是执行授权。',
      '- 最终决策、外部发送、审批和破坏性修改仍必须由用户控制。',
    ];

    if (providerProfile.style === 'implementation') {
      return [
        `# Codex Brief: ${mission.title}`,
        '',
        `Generated: ${formatDateTime(now())}`,
        `Mission ID: ${mission.id}`,
        '',
        '## Goal',
        nextBestAction,
        '',
        '## Next Best Action',
        nextBestAction,
        '',
        '## Current Context',
        whyNow,
        '',
        '## Handoff Boundary',
        ...handoffBoundary,
        '',
        '## Constraints',
        '- Use only the evidence below unless the user provides more context.',
        '- Preserve privacy boundaries; do not request or expose redacted source URLs.',
        '- Keep implementation or investigation steps small and verifiable.',
        '',
        '## Evidence',
        ...evidenceLines,
        '',
        '## Open Questions',
        ...openQuestions.map((question) => `- ${question}`),
        '',
        '## Suggested First Step',
        `- ${nextBestAction}`,
        '',
        '## Warnings',
        ...warnings.map((warning) => `- ${warning}`),
      ].join('\n');
    }

    if (providerProfile.style === 'conversation') {
      return [
        `# Context for ChatGPT: ${mission.title}`,
        '',
        '## What I Need',
        nextBestAction,
        '',
        '## Background',
        whyNow,
        '',
        '## Handoff Boundary',
        ...handoffBoundary,
        '',
        '## Relevant Facts',
        ...evidenceLines,
        '',
        '## Questions To Help Me Answer',
        ...openQuestions.map((question) => `- ${question}`),
        '',
        '## Safety Notes',
        ...warnings.map((warning) => `- ${warning}`),
      ].join('\n');
    }

    if (providerProfile.style === 'analysis') {
      return [
        `# Analysis Pack: ${mission.title}`,
        '',
        '## Objective',
        nextBestAction,
        '',
        '## Situation',
        whyNow,
        '',
        '## Handoff Boundary',
        ...handoffBoundary,
        '',
        '## Evidence Timeline',
        ...evidenceLines,
        '',
        '## Unknowns',
        ...openQuestions.map((question) => `- ${question}`),
        '',
        '## Boundaries',
        ...warnings.map((warning) => `- ${warning}`),
      ].join('\n');
    }

    if (providerProfile.style === 'chinese') {
      return [
        `# ${mission.title}`,
        '',
        `生成时间：${formatDateTime(now())}`,
        '',
        '## 目标',
        nextBestAction,
        '',
        '## 为什么现在处理',
        whyNow,
        '',
        '## 交接边界',
        ...chineseHandoffBoundary,
        '',
        '## 已知事实',
        ...evidenceLines,
        '',
        '## 待确认问题',
        ...openQuestions.map((question) => `- ${question}`),
        '',
        '## 复制前提醒',
        ...warnings.map((warning) => `- ${warning}`),
      ].join('\n');
    }

    return [
      `# ${mission.title}`,
      '',
      `Generated: ${formatDateTime(now())}`,
      `Mission ID: ${mission.id}`,
      '',
      '## Why Now',
      whyNow,
      '',
      '## Next Best Action',
      nextBestAction,
      '',
      '## Handoff Boundary',
      ...handoffBoundary,
      '',
      '## Known Facts',
      ...evidenceLines,
      '',
      '## Open Questions',
      ...openQuestions.map((question) => `- ${question}`),
      '',
      '## Warnings',
      ...warnings.map((warning) => `- ${warning}`),
    ].join('\n');
  }

  private evidenceMarkdownLine(ref: DayPilotEvidenceRef): string {
    return `- ${ref.title || ref.sourceKind}:${ref.sourceId}${
      ref.timestamp ? ` @ ${formatDateTime(ref.timestamp)}` : ''
    }: ${compactText(ref.snippet, 240)}`;
  }

  private redactionPreviewForEvidence(
    evidenceRefs: DayPilotEvidenceRef[],
  ): string[] {
    const previews: string[] = [];
    for (const ref of evidenceRefs) {
      if (ref.sourceUrl) {
        previews.push(
          `${ref.title || ref.sourceKind}:${ref.sourceId} source URL omitted`,
        );
      }
      if (this.hasSensitiveText(ref.snippet)) {
        previews.push(
          `${ref.title || ref.sourceKind}:${
            ref.sourceId
          } snippet contains sensitive markers`,
        );
      }
      if (previews.length >= 5) break;
    }
    return previews;
  }

  private hasSensitiveText(text: string): boolean {
    return /https?:\/\/|token|password|secret|private key|credential|ssn|身份证/i.test(
      text,
    );
  }

  private redactText(text: string): string {
    return compactText(
      text
        .replace(/https?:\/\/\S+/g, '[redacted-url]')
        .replace(
          /(token|password|secret|private key|credential)\s*[:=]\s*\S+/gi,
          '$1=[redacted]',
        ),
      280,
    );
  }

  private applyFeedbackSignal(
    baseScore: number,
    signal: DayPilotFeedbackSignal,
  ): number {
    const boost = Math.min(0.16, signal.usefulCount * 0.06);
    const fatigue = Math.min(
      0.28,
      signal.wrongCount * 0.14 +
        signal.laterCount * 0.05 +
        signal.doneCount * 0.03,
    );
    return clamp01(baseScore + boost - fatigue);
  }

  private defaultProvider(cardType: DayPilotCardType): TargetProvider {
    if (
      cardType === 'meeting_prepare' ||
      cardType === 'relationship_ping' ||
      cardType === 'rehearsal_prompt'
    ) {
      return 'chatgpt';
    }
    if (cardType === 'project_risk' || cardType === 'ai_tool_shift') {
      return 'codex';
    }
    if (cardType === 'memory_quality') return 'claude';
    return 'generic';
  }

  private deliveryMode(
    priority: DayPilotPriority,
    state: DayPilotState,
    trust: DayPilotCard['trust'],
  ): 'interrupt' | 'board' | 'silent' {
    if (trust.riskLevel === 'high') return 'silent';
    if (state === 'now' && (priority === 'critical' || priority === 'high')) {
      return 'interrupt';
    }
    if (priority === 'low' || state === 'waiting') return 'silent';
    return 'board';
  }

  private deliveryReason(
    priority: DayPilotPriority,
    state: DayPilotState,
    trust: DayPilotCard['trust'],
  ): string {
    if (trust.riskLevel === 'high') {
      return 'High privacy risk cards stay on the board and are not interruptive.';
    }
    if (state === 'now' && (priority === 'critical' || priority === 'high')) {
      return 'High-priority now card can consume one interruption slot.';
    }
    if (priority === 'low' || state === 'waiting') {
      return 'Low urgency cards stay silent unless the user opens the board.';
    }
    return 'Board-only card: visible in Day Pilot without a push interruption.';
  }

  private shouldInterrupt(card: DayPilotCard): boolean {
    return card.contextPack?.attention
      ? (card.contextPack.attention as { delivery?: string }).delivery ===
          'interrupt'
      : card.state === 'now' &&
          (card.priority === 'critical' || card.priority === 'high') &&
          card.trust.riskLevel !== 'high';
  }

  private interruptionReason(card: DayPilotCard): string {
    return (
      ((card.contextPack?.attention as { reason?: string } | undefined)
        ?.reason as string | undefined) ||
      `${card.priority} priority ${card.state} mission`
    );
  }

  private deriveQuietWindows(
    cards: DayPilotCard[],
    generatedAt: number,
  ): Array<{ from: number; to: number; reason?: string }> {
    const todayEnd = generatedAt + 24 * 3600;
    return cards
      .filter(
        (card) =>
          card.cardType === 'meeting_prepare' &&
          card.dueAt &&
          card.dueAt >= generatedAt &&
          card.dueAt <= todayEnd,
      )
      .slice(0, 4)
      .map((card) => ({
        from: Math.max(generatedAt, (card.dueAt as number) - 10 * 60),
        to: (card.dueAt as number) + 30 * 60,
        reason: `Meeting window: ${card.title}`,
      }));
  }

  private computeScore(parts: {
    urgency: number;
    openLoopPressure: number;
    userRoleRelevance: number;
    sourceImportance: number;
    sourceDiversity: number;
    evidenceConfidence: number;
    novelty: number;
    recurringNoise: number;
    feedbackFatigue: number;
    privacyRisk: number;
  }): number {
    return clamp01(
      parts.urgency * 0.24 +
        parts.openLoopPressure * 0.18 +
        parts.userRoleRelevance * 0.16 +
        parts.sourceImportance * 0.14 +
        parts.sourceDiversity * 0.1 +
        parts.evidenceConfidence * 0.1 +
        parts.novelty * 0.08 -
        parts.recurringNoise * 0.12 -
        parts.feedbackFatigue * 0.12 -
        parts.privacyRisk * 0.08,
    );
  }

  private clusterScore(cluster: Cluster): number {
    const sourceDiversity = new Set(
      cluster.candidates.map((item) => item.sourceKind),
    ).size;
    const topScore = cluster.candidates[0]?.score ?? 0;
    const recurringNoise = Math.max(
      ...cluster.candidates.map((item) => item.recurringNoise),
    );
    const supportStep =
      cluster.key === 'notification:truth_conflict:generic'
        ? 0.005
        : recurringNoise > 0
        ? 0.015
        : 0.04;
    const support = Math.min(
      cluster.key === 'notification:truth_conflict:generic' ? 0.06 : 0.16,
      (cluster.candidates.length - 1) * supportStep,
    );
    const diversity = Math.min(0.1, (sourceDiversity - 1) * 0.04);
    return clamp01(topScore + support + diversity - recurringNoise * 0.14);
  }

  private priorityForCluster(
    score: number,
    privacyRisk: number,
    cluster: Cluster,
  ): DayPilotPriority {
    const priority = priorityFromScore(score, privacyRisk);
    const recurringNoise = Math.max(
      ...cluster.candidates.map((item) => item.recurringNoise),
    );
    if (recurringNoise <= 0) return priority;
    if (priority === 'critical') return 'high';
    if (priority === 'high' && recurringNoise >= 0.75) return 'medium';
    return priority;
  }

  private clusterStalenessPenalty(
    cluster: Cluster,
    generatedAt: number,
  ): number {
    if (
      cluster.candidates.some(
        (item) => item.dueAt && item.dueAt >= generatedAt - 3600,
      )
    ) {
      return 0;
    }

    const latest = Math.max(
      ...cluster.candidates
        .map((item) => item.timestamp)
        .filter((item): item is number => Number.isFinite(item)),
    );
    if (!Number.isFinite(latest)) return 0;

    const ageDays = (generatedAt - latest) / 86400;
    if (ageDays > 30) return 0.28;
    if (ageDays > 14) return 0.18;
    if (ageDays > 7) return 0.1;
    if (ageDays > 3) return 0.05;
    return 0;
  }

  private pickCardType(candidates: Candidate[]): DayPilotCardType {
    const counts = new Map<DayPilotCardType, number>();
    for (const candidate of candidates) {
      counts.set(
        candidate.cardType,
        (counts.get(candidate.cardType) ?? 0) + candidate.score,
      );
    }
    return (
      Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ||
      'thread_followup'
    );
  }

  private pickState(candidates: Candidate[]): DayPilotState {
    if (candidates.some((item) => item.state === 'now')) return 'now';
    if (candidates.some((item) => item.state === 'prepare')) return 'prepare';
    return 'waiting';
  }

  private pickDueAt(candidates: Candidate[]): number | undefined {
    return candidates
      .map((item) => item.dueAt)
      .filter((item): item is number => Number.isFinite(item))
      .sort((a, b) => a - b)[0];
  }

  private clusterTitle(cluster: Cluster): string {
    if (
      cluster.key === 'notification:truth_conflict:generic' ||
      cluster.candidates[0]?.title === '待核对的记忆事实冲突'
    ) {
      return '待核对的记忆事实冲突';
    }
    const combined = cluster.candidates
      .map((item) => `${item.title} ${item.snippet}`)
      .join(' ');
    const terms = topicTerms(combined);
    return this.titleForTerms(
      terms,
      cluster.candidates[0]?.title || '今日记忆 mission',
    );
  }

  private whyNow(cluster: Cluster): string {
    const top = cluster.candidates[0];
    const sourceKinds = Array.from(
      new Set(cluster.candidates.map((item) => item.sourceKind)),
    );
    const evidenceCount = cluster.candidates.length;
    const latestTimestamp = Math.max(
      ...cluster.candidates
        .map((item) => item.timestamp)
        .filter((item): item is number => Number.isFinite(item)),
    );
    const agePrefix =
      Number.isFinite(latestTimestamp) && now() - latestTimestamp > 7 * 86400
        ? `${Math.floor((now() - latestTimestamp) / 86400)} 天前的`
        : '最近窗口内的';
    if (top.cardType === 'meeting_prepare' && top.dueAt) {
      return `${formatDateTime(
        top.dueAt,
      )} 有相关日历事件，且 ${evidenceCount} 条记忆信号提示今天适合提前准备。`;
    }
    if (top.cardType === 'skill_opportunity') {
      return `Personal AI 发现一条可沉淀的重复做法，今天可以决定是否纳入个人技能库。`;
    }
    if (top.cardType === 'memory_quality') {
      return `有 ${evidenceCount} 条记忆质量或事实冲突提醒仍未处理，可能影响今天交给 AI 的上下文。`;
    }
    if (top.cardType === 'relationship_ping') {
      return `关系雷达发现 ${evidenceCount} 条带 follow-up、承诺或变冷风险的证据，今天适合确认是否需要主动同步。`;
    }
    if (top.cardType === 'rehearsal_prompt') {
      return `有一条未来场景预演记忆与今天的上下文相关，适合提前带入真实对话、会议或写作场景。`;
    }
    return `${evidenceCount} 条来自 ${sourceKinds.join(
      '、',
    )} 的${agePrefix}记忆信号指向同一件事：${compactText(top.snippet, 120)}`;
  }

  private nextBestAction(
    cardType: DayPilotCardType,
    title: string,
    candidates: Candidate[],
  ): string {
    const text = `${title} ${candidates.map((item) => item.snippet).join(' ')}`;
    if (cardType === 'decision_check')
      return '进入对应处理页确认是否执行或如何拍板';
    if (cardType === 'skill_opportunity')
      return '审阅这条技能建议，决定使用、丢弃或稍后处理';
    if (cardType === 'memory_quality')
      return '核对冲突证据，确认今天应采用哪条记忆';
    if (cardType === 'relationship_ping')
      return '打开人物上下文，确认是否需要今天 follow-up 或补齐下一步问题';
    if (cardType === 'rehearsal_prompt')
      return '查看预演提示，决定今天是否要使用、更新、暂停或标记不相关';
    if (/npm registry|nexus|internal nexus|registry migration/i.test(text)) {
      return '确认 NPM Registry 迁移影响范围，并更新需要改配置的项目或 owner';
    }
    if (/insufficient_quota|quota|openai api/i.test(text)) {
      return '确认 OpenAI API quota 状态和替代方案，回复相关人能否继续用 Codex';
    }
    if (/dry run|story point|google sheet|q2 nova/i.test(text)) {
      return '核对 Q2 nova epic dry run 数据和 story point 趋势表，确认是否需要补字段或同步';
    }
    if (/team messaging bot|action blocks|result blocks/i.test(text)) {
      return '沉淀 Team Messaging bot 操作规则，并确认是否要更新自动化模板';
    }
    if (/realtime voice|gpt realtime|voice model|new gpt.*voice/i.test(text)) {
      return '整理 Realtime Voice 模型评估口径，确认是否需要试跑 benchmark';
    }
    if (/\binit\b|q2 plan/i.test(text)) {
      return '确认 INIT Q2 plan 当前 owner、缺口和下一步同步对象';
    }
    if (/epic estimates|273行|table|表格/i.test(text)) {
      return '确认 Epic Estimates 表格更新是否已同步，并决定是否收尾';
    }
    if (/ai notes|generatednotes|重复|retry|fail/i.test(text))
      return '整理排查包并确认 owner、时间窗和下一步';
    if (/webpage-mcp|codex.*mcp|mcp.*codex/i.test(text))
      return '整理一版可复用的配置说明并回复相关人';
    if (/capacity|poster|上传/i.test(text))
      return '确认 owner 是否已经上传，必要时保留 follow-up';
    if (OPENCLAW_MISSING_CAPABILITY_PATTERN.test(text)) {
      return '先补齐 OpenClaw 所缺的外部能力，再决定这些失败动作是否需要重试';
    }
    if (cardType === 'meeting_prepare') {
      if (/daily|sync|standup|例会|周会/i.test(text)) {
        return '会前只确认今天新增的 owner、风险或阻塞，不把例会本身当待办';
      }
      if (/分享|presentation|deck|材料|cop|sharing/i.test(text)) {
        return '整理会前材料里的关键结论、真实案例和需要现场确认的问题';
      }
      return '准备这场会的上下文包和要问的问题';
    }
    if (cardType === 'ai_tool_shift') {
      return '整理这条 AI 工具变化的影响，确认是否需要沉淀为团队说明或个人 skill';
    }
    if (cardType === 'project_risk') {
      return '确认风险 owner、证据和下一步排查路径';
    }
    if (candidates.some((item) => item.sourceKind === 'action')) {
      return '处理这条排队动作，确认执行状态、失败原因或下一步 owner';
    }
    if (candidates.some((item) => item.sourceKind === 'notification')) {
      return '核对这条提醒的证据，确认今天是否仍需要处理';
    }
    if (candidates.some((item) => item.sourceKind === 'reflection')) {
      return '复核反思线程里的待确认问题，决定今天是否继续推进';
    }
    if (!this.hasConcreteFollowupSignal(candidates)) return '';
    return '打开相关上下文，确认今天是否需要推进或暂缓';
  }

  private hasConcreteFollowupSignal(candidates: Candidate[]): boolean {
    const text = candidates
      .map(
        (item) =>
          `${item.title} ${item.snippet} ${item.openQuestions.join(' ')}`,
      )
      .join(' ');
    return candidates.some(
      (item) =>
        Boolean(item.dueAt) ||
        item.openQuestions.length > 0 ||
        item.cardType !== 'thread_followup' ||
        STRUCTURED_ACTIONABLE_SOURCE_KINDS.has(item.sourceKind),
    )
      ? true
      : ACTIONABLE_FOLLOWUP_PATTERN.test(text) || hasOpenLoopSignal(text);
  }

  private nextActionDesc(cardType: DayPilotCardType): string {
    const map: Record<DayPilotCardType, string> = {
      meeting_prepare: '从日历、消息和会议记忆里提取最小会前上下文。',
      thread_followup: '回到原始 thread 或相关页面，完成轻量 follow-up。',
      decision_check: '强状态变更仍在原子页面完成，Day Pilot 只负责提示。',
      ai_tool_shift: '把近期 AI 工具讨论沉淀成可复用说明或材料。',
      project_risk: '确认风险 owner、证据和下一步排查路径。',
      relationship_ping: '查看人物上下文，决定是否需要主动同步。',
      rehearsal_prompt: '复核这条场景化记忆提示，确认今天是否适合使用或更新。',
      skill_opportunity: '判断是否值得沉淀成个人 skill。',
      memory_quality: '核对证据，避免把错误记忆交给外部 AI。',
    };
    return map[cardType];
  }

  private inferCardType(sourceType: string, text: string): DayPilotCardType {
    const lower = text.toLowerCase();
    if (sourceType === 'meeting') return 'meeting_prepare';
    if (/webpage-mcp|codex|factory\.ai|cursor|claude|openai|mcp/i.test(lower)) {
      return 'ai_tool_shift';
    }
    if (/fail|retry|重复|失败|block|owner|kibana|incident/i.test(lower)) {
      return 'project_risk';
    }
    return 'thread_followup';
  }

  private titleForTerms(terms: string[], fallback: string): string {
    const set = new Set(terms);
    if (set.has('webpage-mcp') || (set.has('codex') && set.has('mcp'))) {
      return 'Webpage-MCP / Codex 插件配置整理';
    }
    if (set.has('ai-notes') || set.has('generatednotes')) {
      return 'AI Notes 重复 GeneratedNotes 消费';
    }
    if (set.has('capacity') && set.has('poster')) {
      return 'Capacity poster 未闭环';
    }
    if (set.has('npm-registry') || set.has('nexus')) {
      return 'NPM Registry 迁移到 Nexus 的影响确认';
    }
    if (set.has('quota') && set.has('openai')) {
      return 'OpenAI API quota / Codex 可用性排查';
    }
    if (
      set.has('realtime-voice') ||
      (set.has('realtime') && set.has('voice'))
    ) {
      return 'GPT Realtime Voice 模型评估';
    }
    if (set.has('init')) {
      return 'INIT Q2 plan 当前状态确认';
    }
    if (
      set.has('epic-estimates') ||
      (set.has('epic') && set.has('estimates'))
    ) {
      return 'Epic Estimates 表格更新确认';
    }
    if (
      set.has('nova') &&
      (set.has('dry-run') || set.has('story-point') || set.has('google-sheet'))
    ) {
      return 'Q2 nova epic dry run 评估数据整理';
    }
    if (
      set.has('team-messaging-bot') ||
      set.has('action-blocks') ||
      set.has('result-blocks')
    ) {
      return 'Team Messaging bot 操作规则沉淀';
    }
    if (set.has('cop') || set.has('sharing')) {
      return 'AI 工具分享材料预热';
    }
    return compactText(fallback, 88) || '今日记忆 mission';
  }

  private prettyTerm(term: string): string {
    const map: Record<string, string> = {
      'webpage-mcp': 'Webpage-MCP',
      'ai-notes': 'AI Notes',
      generatednotes: 'GeneratedNotes',
      codex: 'Codex',
      mcp: 'MCP',
      capacity: 'Capacity',
      poster: 'Poster',
      jira: 'Jira',
      cop: 'CoP',
      rio: 'RIO',
      kibana: 'Kibana',
    };
    return map[term] || term;
  }

  private openQuestionsForText(
    text: string,
    cardType: DayPilotCardType,
  ): string[] {
    if (cardType === 'project_risk') {
      return ['谁是当前 owner？', '是否已有 incident、排查记录或明确下一步？'];
    }
    if (cardType === 'ai_tool_shift') {
      return ['是否需要形成团队 wiki 或个人 skill？'];
    }
    if (/上传|poster/i.test(text)) {
      return ['是否已有完成证据？'];
    }
    return [];
  }

  private compactEvidence(
    evidenceRefs: DayPilotEvidenceRef[],
  ): DayPilotEvidenceRef[] {
    const seen = new Set<string>();
    const result: DayPilotEvidenceRef[] = [];
    for (const ref of evidenceRefs) {
      const key = `${ref.sourceKind}:${ref.sourceId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push({ ...ref, snippet: compactText(ref.snippet, 280) });
      if (result.length >= 5) break;
    }
    return result;
  }

  private privacyRisk(text: string): number {
    if (/password|token|secret|private key|credential|ssn/i.test(text))
      return 0.9;
    if (/salary|personal|medical|家庭|宝宝|身份证/i.test(text)) return 0.65;
    return 0.18;
  }

  private isBriefStale(brief: DayPilotBrief): boolean {
    if (brief.status === 'stale') return true;
    return now() - brief.generatedAt > 6 * 3600;
  }

  private emptyBrief(localDate: string, timezone: string): DayPilotBrief {
    const currentTime = now();
    return {
      id: `empty:${this.userId}:${localDate}`,
      userId: this.userId,
      localDate,
      timezone,
      generatedAt: currentTime,
      horizon: {
        from: this.localDateStartApprox(localDate) - 72 * 3600,
        to: this.localDateStartApprox(localDate) + 14 * 86400,
      },
      status: 'draft',
      summary: '',
      attentionBudget: {
        maxInterruptions: 3,
        usedInterruptions: 0,
        quietWindows: [],
      },
      sourceStats: {
        messages: { scanned: 0, totalRecent: 0, selected: 0 },
        calendar: { scanned: 0, upcoming: 0, selected: 0 },
        notifications: { scanned: 0, pending: 0, selected: 0 },
        actions: { scanned: 0, queued: 0, selected: 0 },
        reflections: { scanned: 0, active: 0, selected: 0 },
        rehearsals: { scanned: 0, active: 0, selected: 0 },
        skills: { scanned: 0, suggestions: 0, selected: 0 },
        relationships: { scanned: 0, highFrequencyPeople: 0, selected: 0 },
      },
      cards: [],
      missions: [],
      createdAt: currentTime,
      updatedAt: currentTime,
    };
  }

  private localDateForTimezone(timezone: string): string {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    const year = parts.find((part) => part.type === 'year')?.value;
    const month = parts.find((part) => part.type === 'month')?.value;
    const day = parts.find((part) => part.type === 'day')?.value;
    return `${year}-${month}-${day}`;
  }

  private localDateStartApprox(localDate: string): number {
    const parsed = Date.parse(`${localDate}T00:00:00Z`);
    if (Number.isNaN(parsed)) return now() - (now() % 86400);
    return Math.floor(parsed / 1000);
  }

  private clampMarkdown(
    markdown: string,
    tokenBudget: number,
  ): { bodyMd: string; truncated: boolean; maxChars: number } {
    const maxChars = Math.max(800, tokenBudget * 4);
    if (markdown.length <= maxChars) {
      return { bodyMd: markdown, truncated: false, maxChars };
    }
    const note = '> Truncated to fit token budget.';
    const sliceLength = Math.max(0, maxChars - note.length - 2);
    return {
      bodyMd: `${markdown.slice(0, sliceLength).trim()}\n\n${note}`,
      truncated: true,
      maxChars,
    };
  }
}
