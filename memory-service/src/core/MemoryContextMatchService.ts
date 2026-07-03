import type Database from 'better-sqlite3';

import type {
  ContextRecallCurrentContext,
  ContextRecallEntityHint,
  ContextRecallSourceContext,
  RecallScope,
  RecallSourceType,
} from '../types/index.js';
import { now } from '../utils/time.js';

export type MemoryContextMatchState = 'locked' | 'ambiguous' | 'none';

export interface MemoryContextMatchInput {
  query: string;
  surface?: string;
  contextType?: string;
  title?: string;
  sourceContext?: ContextRecallSourceContext;
  currentContext?: ContextRecallCurrentContext;
  secondaryTexts?: string[];
  entityHints?: ContextRecallEntityHint[];
  scope?: RecallScope;
  sourceTypes?: RecallSourceType[];
}

export interface MemoryContextTopicCandidate {
  id: string;
  label: string;
  score: number;
  confidence: number;
  reasons: string[];
  anchors: string[];
  roleTerms: string[];
  aliases: string[];
  sourceIds: string[];
  evidenceIds: string[];
}

export interface MemoryContextMatchResult {
  state: MemoryContextMatchState;
  selectedTopic?: MemoryContextTopicCandidate;
  candidates: MemoryContextTopicCandidate[];
  expandedQuery?: string;
  userFacingSummary: string;
}

interface ContextFrameRow {
  id: string;
  surface: string;
  source_type: string | null;
  conversation_id: string | null;
  group_id: string | null;
  meeting_id: string | null;
  issue_key: string | null;
  title: string | null;
  summary: string | null;
  dominant_projects_json: string | null;
  topics_json: string | null;
  role_terms_json: string | null;
  source_anchors_json: string | null;
  confidence: number | null;
  updated_at: number;
}

interface MessageContextRow {
  id: string;
  content: string;
  scope: 'work' | 'personal' | null;
  source_type: string;
  source_url: string | null;
  source_title: string | null;
  sender: string | null;
  group_id: string | null;
  group_name: string | null;
  timestamp: number;
  entities_json: string | null;
  matched_projects_json: string | null;
  metadata_json: string | null;
  importance: number | null;
}

interface WatchedProjectRow {
  id: string;
  name: string;
  aliases_json: string | null;
  priority: number | null;
}

interface EntityRow {
  id: string;
  type: string;
  name: string;
  aliases_json: string | null;
  description: string | null;
  importance: number | null;
}

interface CandidateAccumulator {
  id: string;
  label: string;
  projects: string[];
  aliases: string[];
  roleTerms: string[];
  anchors: string[];
  sourceIds: string[];
  evidenceIds: string[];
  sourceTypes: string[];
  latestTimestamp?: number;
  evidenceCount: number;
  sourceCount: number;
  importanceTotal: number;
  statusHitCount: number;
  interactionCount: number;
  rawScore: number;
  confidence: number;
  reasons: string[];
  text: string;
}

const RECENT_WINDOW_SECONDS = 90 * 24 * 60 * 60;
const MESSAGE_LOOKBACK_LIMIT = 260;
const LOCKED_SCORE_THRESHOLD = 0.72;
const LOCKED_CONFIDENCE_THRESHOLD = 0.65;
const AMBIGUOUS_SCORE_THRESHOLD = 0.55;
const AMBIGUOUS_GAP_THRESHOLD = 0.18;
const ROLE_TERM_ALIASES: Record<string, string[]> = {
  backend: ['BE', 'backend', 'back end', '后端', '服务端'],
  frontend: ['FE', 'frontend', 'front end', '前端', '客户端'],
};
const ROLE_TERM_PATTERNS: Array<[string, RegExp]> = [
  ['backend', /\bBE\b|\bback[-\s]?end\b|\bserver[-\s]?side\b|后端|服务端/i],
  ['frontend', /\bFE\b|\bfront[-\s]?end\b|\bclient[-\s]?side\b|前端|客户端/i],
];
const DEICTIC_PATTERN =
  /那个|这个|这块|那块|这边|那边|刚才|上面|前面|它|现在怎么样|怎么样了|\bthat\b|\bthis\b|\bit\b/i;
const STATUS_INTENT_PATTERN =
  /ready|done|complete|completed|pending|blocked?|waiting?|status|progress|merge|merged|ship|shipped|定了|确定|搞定|完成|就绪|状态|进展|阻塞|等待|合了|上线|发布|方案|设计|design/i;
const STATUS_EVIDENCE_PATTERN =
  /ready|done|complete|completed|pending|blocked?|waiting?|status|progress|merge|merged|ship|shipped|no target date|not ready|定了|确定|搞定|完成|未完成|还没有|就绪|状态|进展|阻塞|等待|合了|上线|发布|方案|设计|需要等|不明确|design/i;
const ISSUE_KEY_PATTERN = /\b[A-Z][A-Z0-9]+-\d+\b/g;
const URL_PATTERN = /https?:\/\/[^\s)）]+/g;
const LOW_SIGNAL_SOURCE_PATTERN =
  /docs\.google\.com|google docs|calendar|participant list|transcript controls|fileeditview|accessibility|print preview|personal room/i;
const LOW_SIGNAL_TOPIC_LABEL_PATTERN =
  /^(?:ringcentral video|calendar(?: event)?|meeting|personal room|participant list|untitled)$/i;
const WEAK_SOURCE_ANCHOR_PATTERN =
  /app\.ringcentral\.com\/messages|v\.ringcentral\.com\/conf/i;
const GENERIC_ROLE_LABEL_PATTERN =
  /^(?:rcw\s*)?(?:backend|frontend|be|fe|engineering|platform|api)(?:\s+team)?$/i;
const STOP_TOKENS = new Set([
  '那个',
  '这个',
  '这块',
  '那块',
  '刚才',
  'ready',
  'done',
  'status',
  'progress',
  '怎么样',
  '现在',
]);
const GENERIC_QUERY_TOKENS = new Set([
  'ai',
  'be',
  'fe',
  'ui',
  'pm',
  'cn',
  'new',
  'ready',
  'done',
  'status',
  'progress',
  'backend',
  'frontend',
  'design',
  '那个',
  '这个',
  '部分',
  '情况',
  '完成',
  '状态',
  '进展',
  '设计',
  '定了',
]);
const GENERIC_CONTEXT_HINT_TOKENS = new Set([
  ...GENERIC_QUERY_TOKENS,
  'mtr',
  'rcv',
  'vbg',
  'jira',
  'ringcentral',
]);

function safeJsonParse<T>(json: string | null | undefined): T | undefined {
  if (!json) return undefined;
  try {
    return JSON.parse(json) as T;
  } catch {
    return undefined;
  }
}

function normalizeText(value?: string | null): string {
  return (value || '').replace(/\s+/g, ' ').trim();
}

function normalizeComparable(value?: string | null): string {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9\u3400-\u9fff]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function uniq(values: Array<string | undefined | null>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const cleaned = normalizeText(value);
    if (!cleaned) continue;
    const key = normalizeComparable(cleaned);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(cleaned);
  }
  return out;
}

function parseJsonStringArray(value: string | null | undefined): string[] {
  const parsed = safeJsonParse<unknown>(value);
  if (!Array.isArray(parsed)) return [];
  return parsed
    .map((item) => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object') {
        const record = item as Record<string, unknown>;
        return typeof record.name === 'string'
          ? record.name
          : typeof record.value === 'string'
            ? record.value
            : '';
      }
      return '';
    })
    .filter(Boolean);
}

function parseEntityNames(value: string | null | undefined): {
  projects: string[];
  topics: string[];
} {
  const parsed = safeJsonParse<unknown>(value);
  const projects: string[] = [];
  const topics: string[] = [];
  if (!Array.isArray(parsed)) return { projects, topics };
  for (const item of parsed) {
    if (!item || typeof item !== 'object') continue;
    const record = item as Record<string, unknown>;
    const name = typeof record.name === 'string' ? record.name : '';
    const type = typeof record.type === 'string' ? record.type : '';
    if (!name) continue;
    if (/project/i.test(type)) projects.push(name);
    if (/topic|technology/i.test(type)) topics.push(name);
  }
  return { projects: uniq(projects), topics: uniq(topics) };
}

function extractAcronyms(value: string): string[] {
  return uniq(value.match(/\b[A-Z][A-Z0-9]{1,9}\b/g) ?? []);
}

function extractSourceAnchors(value: string): string[] {
  return uniq([...(value.match(ISSUE_KEY_PATTERN) ?? []), ...(value.match(URL_PATTERN) ?? [])]).slice(0, 12);
}

function anchorStrength(anchors: string[]): {
  issue: string[];
  strong: string[];
  weak: string[];
} {
  const issue: string[] = [];
  const strong: string[] = [];
  const weak: string[] = [];
  for (const anchor of anchors) {
    ISSUE_KEY_PATTERN.lastIndex = 0;
    if (ISSUE_KEY_PATTERN.test(anchor)) {
      issue.push(anchor);
    } else if (WEAK_SOURCE_ANCHOR_PATTERN.test(anchor)) {
      weak.push(anchor);
    } else if (/^https?:\/\//i.test(anchor)) {
      strong.push(anchor);
    }
    ISSUE_KEY_PATTERN.lastIndex = 0;
  }
  return {
    issue: uniq(issue),
    strong: uniq(strong),
    weak: uniq(weak),
  };
}

function topicAnchorBonus(anchors: string[]): number {
  const strength = anchorStrength(anchors);
  if (strength.issue.length) return 0.95;
  if (strength.strong.length) return 0.38;
  if (strength.weak.length) return 0.08;
  return 0;
}

function hasIssueOrStrongAnchor(anchors: string[]): boolean {
  const strength = anchorStrength(anchors);
  return Boolean(strength.issue.length || strength.strong.length);
}

function hasIssueKey(value: string): boolean {
  ISSUE_KEY_PATTERN.lastIndex = 0;
  const matched = ISSUE_KEY_PATTERN.test(value);
  ISSUE_KEY_PATTERN.lastIndex = 0;
  return matched;
}

function extractRoleTerms(value: string): string[] {
  const roles: string[] = [];
  for (const [role, pattern] of ROLE_TERM_PATTERNS) {
    if (pattern.test(value)) roles.push(role);
  }
  return uniq(roles);
}

function extractTokens(value: string): string[] {
  const tokens = new Set<string>();
  const matches = value.match(/[a-z0-9][a-z0-9._:-]{1,}|[\u3400-\u9fff]{2,}/giu) ?? [];
  for (const match of matches) {
    const normalized = match.toLowerCase();
    if (!STOP_TOKENS.has(normalized) && normalized.length >= 2) {
      tokens.add(normalized);
    }
    if (/^[\u3400-\u9fff]{3,}$/u.test(match)) {
      for (let index = 0; index <= match.length - 2; index += 1) {
        const gram = match.slice(index, index + 2);
        if (!STOP_TOKENS.has(gram)) tokens.add(gram);
      }
    }
  }
  for (const acronym of extractAcronyms(value)) {
    tokens.add(acronym.toLowerCase());
  }
  return Array.from(tokens).filter((token) => token.length >= 2);
}

function overlapCount(text: string, tokens: string[]): number {
  const comparable = normalizeComparable(text);
  let score = 0;
  for (const token of tokens) {
    if (comparable.includes(token.toLowerCase())) {
      score += token.length >= 4 ? 1.2 : 0.7;
    }
  }
  return score;
}

function distinctiveQueryTokens(query: string): string[] {
  return extractTokens(query).filter((token) => {
    const normalized = token.toLowerCase();
    if (GENERIC_QUERY_TOKENS.has(normalized)) return false;
    if (normalized.length >= 4) return true;
    return /^[a-z0-9]{3}$/i.test(normalized);
  });
}

function queryCompatibilityBonus(text: string, tokens: string[]): number {
  if (!tokens.length) return 0;
  const comparable = normalizeComparable(text);
  let bonus = 0;
  for (const token of tokens) {
    if (!comparable.includes(token.toLowerCase())) continue;
    bonus += token.length <= 3 ? 0.95 : 0.65;
  }
  return Math.min(1.8, bonus);
}

function queryCompatibilityMissPenalty(text: string, tokens: string[]): number {
  if (!tokens.length) return 0;
  const comparable = normalizeComparable(text);
  return tokens.some((token) => comparable.includes(token.toLowerCase())) ? 0 : 0.85;
}

function contextHintCompatibilityBonus(values: string[], externalContextText: string): number {
  const contextComparable = normalizeComparable(externalContextText);
  if (!contextComparable) return 0;

  let best = 0;
  for (const value of values) {
    const cleaned = normalizeText(value);
    const comparable = normalizeComparable(cleaned);
    if (!comparable || comparable.length < 3) continue;
    if (GENERIC_CONTEXT_HINT_TOKENS.has(comparable)) continue;
    if (!contextComparable.includes(comparable)) continue;

    if (hasIssueKey(cleaned)) {
      best = Math.max(best, 1.65);
    } else if (comparable.length >= 12 || comparable.includes(' ')) {
      best = Math.max(best, 1.25);
    } else {
      best = Math.max(best, 0.55);
    }
  }
  return best;
}

function recencyScore(timestamp?: number | null): number {
  if (!timestamp) return 0;
  const ageSeconds = Math.max(0, now() - timestamp);
  if (ageSeconds < 24 * 60 * 60) return 0.16;
  if (ageSeconds < 7 * 24 * 60 * 60) return 0.13;
  if (ageSeconds < 30 * 24 * 60 * 60) return 0.08;
  return 0.03;
}

function matchesScope(
  storedScope: 'work' | 'personal' | null | undefined,
  requestedScope: RecallScope | undefined,
): boolean {
  if (requestedScope === 'all' || requestedScope === 'both') return true;
  return (storedScope === 'personal' ? 'personal' : 'work') === (requestedScope ?? 'work');
}

function clipQuery(value: string, maxLength: number): string {
  const cleaned = normalizeText(value);
  if (cleaned.length <= maxLength) return cleaned;
  return cleaned.slice(0, maxLength).trimEnd();
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(0.99, value));
}

function sourceIdParts(input: MemoryContextMatchInput): {
  groupId?: string;
  conversationId?: string;
  meetingId?: string;
  issueKey?: string;
} {
  return {
    groupId: input.currentContext?.groupId || input.sourceContext?.groupId,
    conversationId: input.currentContext?.conversationId || input.sourceContext?.conversationId,
    meetingId: input.currentContext?.meetingId || input.sourceContext?.meetingId,
    issueKey: input.currentContext?.issueKey || input.sourceContext?.issueKey,
  };
}

function addReason(reasons: string[], reason: string): void {
  if (!reasons.includes(reason)) reasons.push(reason);
}

function hasCurrentContextAnchor(candidate: MemoryContextTopicCandidate | undefined): boolean {
  return Boolean(
    candidate?.reasons.some(
      (reason) => reason.includes('当前页面/会话锚点匹配') || reason.includes('外部上下文文本锚点匹配'),
    ),
  );
}

function hasDirectCurrentContextAnchor(candidate: MemoryContextTopicCandidate | undefined): boolean {
  return Boolean(
    candidate?.reasons.some((reason) => reason.includes('当前页面/会话锚点匹配')),
  );
}

function hasExternalContextHint(candidate: MemoryContextTopicCandidate | undefined): boolean {
  return Boolean(
    candidate?.reasons.some((reason) => reason.includes('外部上下文文本锚点匹配')),
  );
}

function hasRoleMatch(candidate: MemoryContextTopicCandidate | undefined): boolean {
  return Boolean(
    candidate?.reasons.some((reason) => reason.includes('匹配角色词')),
  );
}

function candidateDecisionScore(candidate: MemoryContextTopicCandidate): number {
  const directCurrentAnchorBoost = hasDirectCurrentContextAnchor(candidate) ? 0.16 : 0;
  const externalContextBoost = hasExternalContextHint(candidate) ? 0.035 : 0;
  const roleMatchBoost = hasRoleMatch(candidate) ? 0.035 : 0;
  return candidate.score + directCurrentAnchorBoost + externalContextBoost + roleMatchBoost;
}

function shouldClarifyAmbiguousQuery(input: {
  deictic: boolean;
  statusIntent: boolean;
  explicitQueryTokens: string[];
  roleTerms: string[];
  queryTokens: string[];
}): boolean {
  const hasExplicitSubject =
    input.explicitQueryTokens.some((token) => token.length >= 4) &&
    input.queryTokens.length >= 6 &&
    input.roleTerms.length === 0;
  if (input.deictic) return !hasExplicitSubject;
  const shortStatusQuestion =
    input.statusIntent &&
    input.queryTokens.length <= 5 &&
    input.explicitQueryTokens.length <= 1;
  const roleOnlyStatusQuestion =
    input.statusIntent &&
    input.roleTerms.length > 0 &&
    input.explicitQueryTokens.length === 0 &&
    input.queryTokens.length <= 7;
  return shortStatusQuestion || roleOnlyStatusQuestion;
}

export class MemoryContextMatchService {
  constructor(private db: Database.Database) {}

  match(input: MemoryContextMatchInput): MemoryContextMatchResult {
    const query = normalizeText(input.query);
    const contextText = this.buildContextText(input);
    const externalContextText = this.buildExternalContextText(input);
    const queryRoles = extractRoleTerms(query);
    const contextRoles = extractRoleTerms(contextText);
    const roleTerms = uniq([...queryRoles, ...contextRoles]);
    const queryTokens = extractTokens([query, contextText].join(' '));
    const explicitQueryTokens = distinctiveQueryTokens(query);
    const deictic = DEICTIC_PATTERN.test(query);
    const statusIntent = STATUS_INTENT_PATTERN.test(query);

    const candidates = this.mergeCandidatesByLabel([
      ...this.collectFrameCandidates(input, contextText, externalContextText, queryTokens, explicitQueryTokens, roleTerms, statusIntent),
      ...this.collectRecentMessageCandidates(input, contextText, externalContextText, queryTokens, explicitQueryTokens, roleTerms, deictic, statusIntent),
      ...this.collectWatchedProjectCandidates(contextText, queryTokens, roleTerms),
      ...this.collectEntityCandidates(contextText, queryTokens, roleTerms),
    ])
      .filter((candidate) => candidate.score > 0)
      .sort(
        (a, b) =>
          candidateDecisionScore(b) - candidateDecisionScore(a) ||
          b.score - a.score ||
          b.confidence - a.confidence,
      )
      .slice(0, 5);

    const top = candidates[0];
    const second = candidates[1];
    const gap = top && second ? candidateDecisionScore(top) - candidateDecisionScore(second) : top ? 1 : 0;
    const topHasExplicitQueryAnchor = Boolean(
      top?.reasons.some((reason) => reason.includes('显式 query 锚点')),
    );
    const topHasCurrentContextAnchor = hasCurrentContextAnchor(top);
    const shouldClarifyAmbiguous = shouldClarifyAmbiguousQuery({
      deictic,
      statusIntent,
      explicitQueryTokens,
      roleTerms,
      queryTokens,
    });
    const isAmbiguous =
      shouldClarifyAmbiguous &&
      top &&
      second &&
      top.score >= AMBIGUOUS_SCORE_THRESHOLD &&
      second.score >= AMBIGUOUS_SCORE_THRESHOLD &&
      gap < AMBIGUOUS_GAP_THRESHOLD &&
      !(topHasExplicitQueryAnchor && top.score >= 0.85 && gap >= 0.03) &&
      !(topHasCurrentContextAnchor && top.score >= LOCKED_SCORE_THRESHOLD && top.confidence >= LOCKED_CONFIDENCE_THRESHOLD);
    const isLocked =
      top &&
      !isAmbiguous &&
      top.score >= LOCKED_SCORE_THRESHOLD &&
      top.confidence >= LOCKED_CONFIDENCE_THRESHOLD;

    if (isLocked) {
      return {
        state: 'locked',
        selectedTopic: top,
        candidates,
        expandedQuery: this.buildExpandedQuery(query, top),
        userFacingSummary: `我先把这个问题锁定到：${top.label}。原因：${top.reasons.slice(0, 3).join('、') || '最近记忆匹配度最高'}。`,
      };
    }

    if (isAmbiguous) {
      return {
        state: 'ambiguous',
        candidates,
        expandedQuery: undefined,
        userFacingSummary: `这个问题可能指向多个近期话题：${candidates
          .slice(0, 3)
          .map((candidate) => candidate.label)
          .join('、')}。请确认你指的是哪一个。`,
      };
    }

    return {
      state: 'none',
      candidates,
      expandedQuery: undefined,
      userFacingSummary: '没有足够强的近期记忆话题可锁定，已按原问题检索。',
    };
  }

  private buildContextText(input: MemoryContextMatchInput): string {
    const visibleMessages =
      input.currentContext?.visibleMessages
        ?.slice(-12)
        .map((message) => [message.sender, message.text].filter(Boolean).join(': '))
        .join(' ') ?? '';
    return [
      input.query,
      input.title,
      input.sourceContext?.title,
      input.sourceContext?.topic,
      input.currentContext?.title,
      ...(input.secondaryTexts ?? []),
      ...(input.entityHints ?? []).map((hint) => hint.value),
      ...(input.currentContext?.participants ?? []),
      ...(input.currentContext?.sourceAnchorHints ?? []),
      visibleMessages,
    ]
      .filter(Boolean)
      .map((part) => normalizeText(part))
      .join(' ');
  }

  private buildExternalContextText(input: MemoryContextMatchInput): string {
    const visibleMessages =
      input.currentContext?.visibleMessages
        ?.slice(-12)
        .map((message) => [message.sender, message.text].filter(Boolean).join(': '))
        .join(' ') ?? '';
    return [
      input.title,
      input.sourceContext?.title,
      input.sourceContext?.topic,
      input.currentContext?.title,
      ...(input.secondaryTexts ?? []),
      ...(input.entityHints ?? []).map((hint) => hint.value),
      ...(input.currentContext?.participants ?? []),
      ...(input.currentContext?.sourceAnchorHints ?? []),
      visibleMessages,
    ]
      .filter(Boolean)
      .map((part) => normalizeText(part))
      .join(' ');
  }

  private buildExpandedQuery(query: string, candidate: MemoryContextTopicCandidate): string {
    return clipQuery(
      uniq([
        query,
        candidate.label,
        ...candidate.aliases.slice(0, 8),
        ...candidate.roleTerms.flatMap((role) => ROLE_TERM_ALIASES[role] ?? [role]),
        ...candidate.anchors.slice(0, 8),
      ]).join(' '),
      900,
    );
  }

  private mergeCandidatesByLabel(
    candidates: MemoryContextTopicCandidate[],
  ): MemoryContextTopicCandidate[] {
    const byLabel = new Map<string, MemoryContextTopicCandidate>();
    for (const candidate of candidates) {
      const key = normalizeComparable(candidate.label);
      if (!key) continue;
      const existing = byLabel.get(key);
      if (!existing) {
        byLabel.set(key, {
          ...candidate,
          reasons: [...candidate.reasons],
          anchors: [...candidate.anchors],
          roleTerms: [...candidate.roleTerms],
          aliases: [...candidate.aliases],
          sourceIds: [...candidate.sourceIds],
          evidenceIds: [...candidate.evidenceIds],
        });
        continue;
      }
      existing.score = Math.max(existing.score, candidate.score);
      existing.confidence = Math.max(existing.confidence, candidate.confidence);
      existing.reasons = uniq([...existing.reasons, ...candidate.reasons]).slice(0, 8);
      existing.anchors = uniq([...existing.anchors, ...candidate.anchors]).slice(0, 16);
      existing.roleTerms = uniq([...existing.roleTerms, ...candidate.roleTerms]);
      existing.aliases = uniq([...existing.aliases, ...candidate.aliases]).slice(0, 20);
      existing.sourceIds = uniq([...existing.sourceIds, ...candidate.sourceIds]);
      existing.evidenceIds = uniq([...existing.evidenceIds, ...candidate.evidenceIds]).slice(0, 12);
    }
    return Array.from(byLabel.values());
  }

  private collectFrameCandidates(
    input: MemoryContextMatchInput,
    contextText: string,
    externalContextText: string,
    queryTokens: string[],
    explicitQueryTokens: string[],
    roleTerms: string[],
    statusIntent: boolean,
  ): MemoryContextTopicCandidate[] {
    if (!this.hasTable('conversation_context_frames')) return [];
    const sourceIds = sourceIdParts(input);
    const rows: ContextFrameRow[] = [];
    const seen = new Set<string>();
    const addRows = (incoming: ContextFrameRow[]) => {
      for (const row of incoming) {
        if (seen.has(row.id)) continue;
        seen.add(row.id);
        rows.push(row);
      }
    };

    for (const [column, value] of [
      ['group_id', sourceIds.groupId],
      ['conversation_id', sourceIds.conversationId],
      ['meeting_id', sourceIds.meetingId],
      ['issue_key', sourceIds.issueKey],
    ] as const) {
      if (!value) continue;
      if (column === 'issue_key') {
        addRows(
          this.db
            .prepare(
              `SELECT * FROM conversation_context_frames
               WHERE issue_key = ? OR source_anchors_json LIKE ?
               ORDER BY updated_at DESC
               LIMIT 12`,
            )
            .all(value, `%${value}%`) as ContextFrameRow[],
        );
      } else {
        addRows(
          this.db
            .prepare(
              `SELECT * FROM conversation_context_frames
               WHERE ${column} = ?
               ORDER BY updated_at DESC
               LIMIT 12`,
            )
            .all(value) as ContextFrameRow[],
        );
      }
    }

    const likeTerms = queryTokens
      .filter((token) => token.length >= 3)
      .slice(0, 5)
      .map((token) => `%${token}%`);
    if (likeTerms.length) {
      const clauses = likeTerms.map(
        () =>
          `(dominant_projects_json LIKE ? OR topics_json LIKE ? OR source_anchors_json LIKE ? OR title LIKE ? OR summary LIKE ?)`,
      );
      addRows(
        this.db
          .prepare(
            `SELECT * FROM conversation_context_frames
             WHERE ${clauses.join(' OR ')}
             ORDER BY updated_at DESC
             LIMIT 30`,
          )
          .all(...likeTerms.flatMap((term) => [term, term, term, term, term])) as ContextFrameRow[],
      );
    }

    if (roleTerms.length) {
      const roleLikeTerms = roleTerms.map((role) => `%${role}%`);
      addRows(
        this.db
          .prepare(
            `SELECT * FROM conversation_context_frames
             WHERE ${roleLikeTerms.map(() => 'role_terms_json LIKE ?').join(' OR ')}
             ORDER BY updated_at DESC
             LIMIT 30`,
          )
          .all(...roleLikeTerms) as ContextFrameRow[],
      );
    }

    if (statusIntent) {
      addRows(
        this.db
          .prepare(
            `SELECT * FROM conversation_context_frames
             WHERE source_anchors_json GLOB '*[A-Z][A-Z0-9]*-[0-9]*'
             ORDER BY confidence DESC, updated_at DESC
             LIMIT 40`,
          )
          .all() as ContextFrameRow[],
      );
    }

    if ((statusIntent || roleTerms.length) && rows.length < 20) {
      addRows(
        this.db
          .prepare(
            `SELECT * FROM conversation_context_frames
             ORDER BY confidence DESC, updated_at DESC
             LIMIT 30`,
          )
          .all() as ContextFrameRow[],
      );
    }

    return rows.map((row) => {
      const projects = parseJsonStringArray(row.dominant_projects_json);
      const aliases = uniq([
        ...parseJsonStringArray(row.topics_json),
        row.title,
        row.summary,
      ]).slice(0, 12);
      const rowRoles = parseJsonStringArray(row.role_terms_json);
      const anchors = parseJsonStringArray(row.source_anchors_json);
      const sourceMatch = [
        sourceIds.groupId && row.group_id === sourceIds.groupId,
        sourceIds.conversationId && row.conversation_id === sourceIds.conversationId,
        sourceIds.meetingId && row.meeting_id === sourceIds.meetingId,
        sourceIds.issueKey && (row.issue_key === sourceIds.issueKey || anchors.includes(sourceIds.issueKey)),
      ].some(Boolean);
      const anchorEntityContext = this.loadEntityContextForAnchors(anchors);
      const anchorEntityBridgeBonus =
        statusIntent &&
        anchorEntityContext &&
        (overlapCount(anchorEntityContext, queryTokens) > 0 ||
          STATUS_EVIDENCE_PATTERN.test(anchorEntityContext))
          ? 1.35
          : 0;
      const text = [
        row.title,
        row.summary,
        ...projects,
        ...aliases,
        ...anchors,
        anchorEntityContext,
      ].join(' ');
      const roleOverlap = rowRoles.filter((role) => roleTerms.includes(role)).length;
      const statusHit = statusIntent && STATUS_EVIDENCE_PATTERN.test(text);
      const label = projects[0] || row.title || row.id;
      const lowSignalLabel = LOW_SIGNAL_TOPIC_LABEL_PATTERN.test(normalizeText(label));
      const anchorBonus = topicAnchorBonus(anchors);
      const explicitBonus = queryCompatibilityBonus(text, explicitQueryTokens);
      const explicitMissPenalty = queryCompatibilityMissPenalty(text, explicitQueryTokens);
      const contextHintBonus = contextHintCompatibilityBonus(
        [label, row.title ?? '', ...projects, ...aliases, ...anchors],
        externalContextText,
      );
      const raw =
        overlapCount(text, queryTokens) * 0.32 +
        explicitBonus +
        contextHintBonus +
        roleOverlap * 1.2 +
        (sourceMatch ? 1.6 : 0) +
        (statusHit ? 0.55 : 0) +
        anchorEntityBridgeBonus +
        (row.confidence ?? 0.55) * 0.9 +
        recencyScore(row.updated_at) * 3.5 +
        anchorBonus -
        explicitMissPenalty -
        (lowSignalLabel && !hasIssueOrStrongAnchor(anchors) ? 1.1 : 0);
      const score = clampScore(raw / 4.6);
      const reasons: string[] = [];
      if (sourceMatch) addReason(reasons, '当前页面/会话锚点匹配');
      if (contextHintBonus) addReason(reasons, '外部上下文文本锚点匹配');
      if (roleOverlap) addReason(reasons, `匹配角色词: ${rowRoles.filter((role) => roleTerms.includes(role)).join(', ')}`);
      if (statusHit) addReason(reasons, '包含状态/进展信号');
      if (anchorEntityBridgeBonus) addReason(reasons, '关联实体补充 source anchor 上下文');
      if (explicitBonus) addReason(reasons, `匹配显式 query 锚点: ${explicitQueryTokens.join(', ')}`);
      if (anchorBonus >= 0.9) addReason(reasons, `包含强 source anchor: ${anchors.slice(0, 2).join(', ')}`);
      else if (anchors.length) addReason(reasons, `包含 source anchor: ${anchors.slice(0, 2).join(', ')}`);
      if (lowSignalLabel) addReason(reasons, '低信号 topic label 已降权');
      addReason(reasons, '近期上下文 frame');
      return {
        id: row.id,
        label,
        score,
        confidence: Math.min(0.95, Math.max(row.confidence ?? 0.55, score)),
        reasons,
        anchors,
        roleTerms: rowRoles,
        aliases,
        sourceIds: [
          row.group_id ? `group:${row.group_id}` : '',
          row.conversation_id ? `conversation:${row.conversation_id}` : '',
          row.meeting_id ? `meeting:${row.meeting_id}` : '',
          row.issue_key ? `issue:${row.issue_key}` : '',
        ].filter(Boolean),
        evidenceIds: [],
      };
    });
  }

  private collectRecentMessageCandidates(
    input: MemoryContextMatchInput,
    contextText: string,
    externalContextText: string,
    queryTokens: string[],
    explicitQueryTokens: string[],
    roleTerms: string[],
    deictic: boolean,
    statusIntent: boolean,
  ): MemoryContextTopicCandidate[] {
    const sourceIds = sourceIdParts(input);
    const params: unknown[] = [now() - RECENT_WINDOW_SECONDS];
    const clauses: string[] = [];

    if (sourceIds.groupId) {
      clauses.push('group_id = ?');
      params.push(sourceIds.groupId);
    }
    if (sourceIds.conversationId) {
      clauses.push('metadata_json LIKE ?');
      params.push(`%${sourceIds.conversationId}%`);
    }
    for (const token of queryTokens.filter((term) => term.length >= 3).slice(0, 5)) {
      clauses.push('(content LIKE ? OR source_title LIKE ? OR group_name LIKE ?)');
      params.push(`%${token}%`, `%${token}%`, `%${token}%`);
    }
    for (const role of roleTerms) {
      for (const alias of (ROLE_TERM_ALIASES[role] ?? [role]).slice(0, 4)) {
        clauses.push('(content LIKE ? OR source_title LIKE ? OR group_name LIKE ?)');
        params.push(`%${alias}%`, `%${alias}%`, `%${alias}%`);
      }
    }
    if (statusIntent) {
      clauses.push(
        `(content LIKE '%ready%' OR content LIKE '%pending%' OR content LIKE '%block%' OR content LIKE '%wait%' OR content LIKE '%design%' OR content LIKE '%完成%' OR content LIKE '%等待%' OR content LIKE '%阻塞%' OR content LIKE '%设计%' OR content LIKE '%合了%')`,
      );
    }
    if (clauses.length === 0 && (deictic || statusIntent)) {
      clauses.push(`source_type IN ('glip', 'ringcentral')`);
    }
    if (clauses.length === 0) return [];

    let rows: MessageContextRow[] = [];
    try {
      rows = this.db
        .prepare(
          `SELECT id, content, scope, source_type, source_url, source_title, sender, group_id,
                  group_name, timestamp, entities_json, matched_projects_json,
                  metadata_json, importance
           FROM messages_raw
           WHERE timestamp >= ? AND (${clauses.join(' OR ')})
           ORDER BY timestamp DESC
           LIMIT ${MESSAGE_LOOKBACK_LIMIT}`,
        )
        .all(...params) as MessageContextRow[];
    } catch {
      return [];
    }

    const watchedProjectNames = this.matchWatchedProjectsInText.bind(this);
    const byLabel = new Map<string, CandidateAccumulator>();
    for (const row of rows) {
      if (!matchesScope(row.scope, input.scope)) continue;
      if (input.sourceTypes?.length && !input.sourceTypes.includes(row.source_type as RecallSourceType)) {
        continue;
      }
      const combined = [row.content, row.source_title, row.group_name].join(' ');
      if (LOW_SIGNAL_SOURCE_PATTERN.test(combined)) continue;
      const entityNames = parseEntityNames(row.entities_json);
      const matchedProjects = parseJsonStringArray(row.matched_projects_json);
      const watchedProjects = watchedProjectNames(combined);
      const projects = uniq([...matchedProjects, ...entityNames.projects, ...watchedProjects]);
      const anchors = uniq([row.source_url ?? '', ...extractSourceAnchors(combined)]).slice(0, 12);
      const aliases = uniq([
        ...entityNames.topics,
        ...extractAcronyms(combined),
        row.source_title,
        row.group_name,
      ]).slice(0, 16);
      const label = projects[0] || row.source_title || row.group_name || row.id;
      const key = normalizeComparable(label);
      if (!key) continue;
      const sourceMatch =
        (sourceIds.groupId && row.group_id === sourceIds.groupId) ||
        (sourceIds.conversationId && (row.metadata_json || '').includes(sourceIds.conversationId)) ||
        (sourceIds.issueKey && combined.includes(sourceIds.issueKey));
      const rowRoles = extractRoleTerms(combined);
      const roleOverlap = rowRoles.filter((role) => roleTerms.includes(role)).length;
      const statusHit = STATUS_EVIDENCE_PATTERN.test(row.content);
      const lowSignalTopicLabel = LOW_SIGNAL_TOPIC_LABEL_PATTERN.test(normalizeText(label));
      const topicAnchored = hasIssueOrStrongAnchor(anchors);
      const hasSpecificAnchor =
        projects.length > 0 ||
        topicAnchored ||
        hasIssueKey([row.source_title, row.group_name].join(' '));
      const genericRoleLabel =
        GENERIC_ROLE_LABEL_PATTERN.test(normalizeText(row.source_title || row.group_name || ''));
      const effectiveSpecificAnchor =
        hasSpecificAnchor && !genericRoleLabel && !lowSignalTopicLabel;
      const specificStatusBonus =
        statusIntent && statusHit && effectiveSpecificAnchor ? 0.45 : 0;
      const explicitBonus = queryCompatibilityBonus(combined, explicitQueryTokens);
      const explicitMissPenalty = queryCompatibilityMissPenalty(combined, explicitQueryTokens);
      const contextHintBonus = contextHintCompatibilityBonus(
        [label, row.source_title ?? '', row.group_name ?? '', ...projects, ...aliases, ...anchors],
        externalContextText,
      );
      const weakAnchorOnly =
        anchors.length > 0 && !topicAnchored && !hasIssueKey([row.source_title, row.group_name].join(' '));
      const noisePenalty =
        (genericRoleLabel ? 1.35 : 0) +
        (lowSignalTopicLabel ? 1.35 : 0) +
        (weakAnchorOnly && !projects.length ? 0.45 : 0);
      const rowRaw =
        overlapCount(combined, queryTokens) * 0.22 +
        explicitBonus +
        contextHintBonus +
        roleOverlap * 0.95 +
        (statusIntent && statusHit ? 0.72 : 0) +
        (sourceMatch ? 1.25 : 0) +
        (effectiveSpecificAnchor ? 0.62 : 0) +
        topicAnchorBonus(anchors) +
        specificStatusBonus +
        (row.importance ?? 0.5) * 0.65 +
        recencyScore(row.timestamp) * 3.2 -
        explicitMissPenalty -
        noisePenalty;
      const existing = byLabel.get(key);
      const acc =
        existing ??
        {
          id: `topic:${key}`,
          label,
          projects: [],
          aliases: [],
          roleTerms: [],
          anchors: [],
          sourceIds: [],
          evidenceIds: [],
          sourceTypes: [],
          latestTimestamp: undefined,
          evidenceCount: 0,
          sourceCount: 0,
          importanceTotal: 0,
          statusHitCount: 0,
          interactionCount: 0,
          rawScore: 0,
          confidence: 0.5,
          reasons: [],
          text: '',
        };
      acc.projects = uniq([...acc.projects, ...projects]);
      acc.aliases = uniq([...acc.aliases, ...aliases]);
      acc.roleTerms = uniq([...acc.roleTerms, ...rowRoles]);
      acc.anchors = uniq([...acc.anchors, ...anchors]).slice(0, 12);
      acc.sourceIds = uniq([
        ...acc.sourceIds,
        row.group_id ? `group:${row.group_id}` : '',
      ]);
      acc.evidenceIds = uniq([...acc.evidenceIds, row.id]).slice(0, 8);
      acc.sourceTypes = uniq([...acc.sourceTypes, row.source_type]);
      acc.latestTimestamp = Math.max(acc.latestTimestamp ?? 0, row.timestamp);
      acc.evidenceCount += 1;
      acc.importanceTotal += row.importance ?? 0.5;
      acc.statusHitCount += statusHit ? 1 : 0;
      acc.interactionCount += this.hasInteractionSignal(row, input) ? 1 : 0;
      acc.rawScore = Math.max(acc.rawScore, rowRaw);
      acc.text = `${acc.text} ${combined}`;
      if (sourceMatch) addReason(acc.reasons, '当前页面/会话锚点匹配');
      if (contextHintBonus) addReason(acc.reasons, '外部上下文文本锚点匹配');
      if (roleOverlap) addReason(acc.reasons, `匹配角色词: ${rowRoles.filter((role) => roleTerms.includes(role)).join(', ')}`);
      if (statusHit) addReason(acc.reasons, '包含状态/进展信号');
      if (explicitBonus) addReason(acc.reasons, `匹配显式 query 锚点: ${explicitQueryTokens.join(', ')}`);
      if (effectiveSpecificAnchor) addReason(acc.reasons, '包含项目或强 source anchor');
      if (lowSignalTopicLabel) addReason(acc.reasons, '低信号 topic label 已降权');
      byLabel.set(key, acc);
    }

    for (const acc of byLabel.values()) {
      acc.sourceCount = acc.sourceTypes.length;
    }

    return Array.from(byLabel.values()).map((acc) => {
      const salience = Math.min(0.75, Math.log1p(acc.evidenceCount) * 0.18 + acc.sourceCount * 0.08);
      const interaction = Math.min(0.25, acc.interactionCount * 0.08);
      const status = statusIntent ? Math.min(0.32, acc.statusHitCount * 0.11) : 0;
      const raw = acc.rawScore + salience + interaction + status;
      const score = clampScore(raw / 4.6);
      if (acc.evidenceCount >= 2) addReason(acc.reasons, `近期多次出现 (${acc.evidenceCount})`);
      if (acc.latestTimestamp && now() - acc.latestTimestamp < 7 * 24 * 60 * 60) {
        addReason(acc.reasons, '最近 7 天活跃');
      }
      if (acc.interactionCount > 0) addReason(acc.reasons, '包含用户互动信号');
      return {
        id: acc.id,
        label: acc.projects[0] || acc.label,
        score,
        confidence: clampScore(Math.max(0.45, score + Math.min(0.18, acc.evidenceCount * 0.03))),
        reasons: acc.reasons.slice(0, 5),
        anchors: acc.anchors,
        roleTerms: acc.roleTerms,
        aliases: uniq([...acc.aliases, ...acc.projects, acc.label]).slice(0, 14),
        sourceIds: acc.sourceIds,
        evidenceIds: acc.evidenceIds,
      };
    });
  }

  private collectWatchedProjectCandidates(
    contextText: string,
    queryTokens: string[],
    roleTerms: string[],
  ): MemoryContextTopicCandidate[] {
    let rows: WatchedProjectRow[] = [];
    try {
      rows = this.db
        .prepare(
          `SELECT id, name, aliases_json, priority
           FROM watched_projects
           WHERE is_active = 1
           ORDER BY priority DESC, created_at DESC
           LIMIT 200`,
        )
        .all() as WatchedProjectRow[];
    } catch {
      return [];
    }

    return rows.map((row) => {
      const aliases = parseJsonStringArray(row.aliases_json);
      const text = [row.name, ...aliases].join(' ');
      const raw =
        overlapCount(text, queryTokens) * 0.38 +
        (normalizeComparable(contextText).includes(normalizeComparable(row.name)) ? 1.3 : 0) +
        (row.priority ?? 0) * 0.08 +
        (roleTerms.length > 0 ? 0.22 : 0);
      const score = clampScore(raw / 4.6);
      return {
        id: `project:${row.id}`,
        label: row.name,
        score,
        confidence: Math.max(0.55, Math.min(0.8, score + 0.1)),
        reasons: score > 0 ? ['关注项目匹配'] : [],
        anchors: [],
        roleTerms: [],
        aliases,
        sourceIds: [],
        evidenceIds: [],
      };
    });
  }

  private loadEntityContextForAnchors(anchors: string[]): string {
    const issueAnchors = anchors.filter((anchor) => hasIssueKey(anchor)).slice(0, 4);
    if (!issueAnchors.length) return '';
    try {
      const clauses = issueAnchors.map(() => 'description LIKE ?').join(' OR ');
      const rows = this.db
        .prepare(
          `SELECT name, description
           FROM entities
           WHERE status = 'active'
             AND type IN ('Project', 'Topic', 'Technology')
             AND (${clauses})
           ORDER BY importance DESC, mention_count DESC
           LIMIT 6`,
        )
        .all(...issueAnchors.map((anchor) => `%${anchor}%`)) as Array<{
        name: string;
        description: string | null;
      }>;
      return rows
        .map((row) => [row.name, row.description].filter(Boolean).join(': '))
        .join(' ');
    } catch {
      return '';
    }
  }

  private collectEntityCandidates(
    contextText: string,
    queryTokens: string[],
    roleTerms: string[],
  ): MemoryContextTopicCandidate[] {
    let rows: EntityRow[] = [];
    try {
      rows = this.db
        .prepare(
          `SELECT id, type, name, aliases_json, description, importance
           FROM entities
           WHERE status = 'active' AND type IN ('Project', 'Topic', 'Technology')
           ORDER BY importance DESC, mention_count DESC
           LIMIT 200`,
        )
        .all() as EntityRow[];
    } catch {
      return [];
    }

    return rows.map((row) => {
      const aliases = parseJsonStringArray(row.aliases_json);
      const text = [row.name, row.description, ...aliases].join(' ');
      const raw =
        overlapCount(text, queryTokens) * 0.32 +
        (normalizeComparable(contextText).includes(normalizeComparable(row.name)) ? 0.9 : 0) +
        (row.importance ?? 0.5) * 0.4 +
        (roleTerms.length > 0 ? 0.14 : 0);
      const score = clampScore(raw / 4.6);
      return {
        id: `entity:${row.id}`,
        label: row.name,
        score,
        confidence: Math.max(0.45, Math.min(0.75, score + 0.08)),
        reasons: score > 0 ? [`${row.type.toLowerCase()} entity match`] : [],
        anchors: [],
        roleTerms: [],
        aliases,
        sourceIds: [],
        evidenceIds: [],
      };
    });
  }

  private matchWatchedProjectsInText(value: string): string[] {
    const text = normalizeComparable(value);
    if (!text) return [];
    try {
      const rows = this.db
        .prepare(
          `SELECT name, aliases_json
           FROM watched_projects
           WHERE is_active = 1
           ORDER BY priority DESC, created_at DESC
           LIMIT 200`,
        )
        .all() as Array<{ name: string; aliases_json: string | null }>;
      const matches: string[] = [];
      for (const row of rows) {
        const aliases = parseJsonStringArray(row.aliases_json);
        const candidates = [row.name, ...aliases].map(normalizeComparable).filter(Boolean);
        if (candidates.some((candidate) => text.includes(candidate))) {
          matches.push(row.name);
        }
      }
      return uniq(matches);
    } catch {
      return [];
    }
  }

  private hasInteractionSignal(row: MessageContextRow, input: MemoryContextMatchInput): boolean {
    const text = [row.sender, row.content].join(' ');
    const userHints = [
      process.env.EVAL_USER_ID,
      process.env.USER,
      input.currentContext?.participants?.find((participant) => /esone|qiu/i.test(participant)),
    ].filter(Boolean) as string[];
    return /@?esone|esone\.qiu|qiu/i.test(text) || userHints.some((hint) => text.includes(hint));
  }

  private hasTable(name: string): boolean {
    try {
      const row = this.db
        .prepare(
          `SELECT name FROM sqlite_master
           WHERE type = 'table' AND name = ?
           LIMIT 1`,
        )
        .get(name) as { name: string } | undefined;
      return Boolean(row);
    } catch {
      return false;
    }
  }
}
