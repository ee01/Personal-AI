import type Database from 'better-sqlite3';

import type {
  ContextRecallCurrentContext,
  ContextRecallEntityHint,
  ContextRecallSourceContext,
  EntityType,
  RecallScope,
  RecallSourceType,
  SourceType,
} from '../types/index.js';
import { now } from '../utils/time.js';
import { toSlug } from '../utils/slug.js';
import {
  MemoryContextMatchService,
  type MemoryContextMatchResult,
  type MemoryContextTopicCandidate,
} from './MemoryContextMatchService.js';

export interface RecallContextExpansionInput {
  query: string;
  preferredTopicTitle?: string;
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

export interface RecallContextExpansion {
  originalQuery: string;
  expandedQuery: string;
  addedTerms: string[];
  entityHints: ContextRecallEntityHint[];
  sourceAnchors: string[];
  resolvedProject?: string;
  resolvedRole?: string;
  ambiguity?: {
    state: 'none' | 'ambiguous';
    candidates: Array<{ label: string; score: number; reason?: string }>;
  };
  contextMatch?: MemoryContextMatchResult;
}

export interface ContextFrameIngestInput {
  messageId: string;
  content: string;
  sourceType: SourceType;
  source?: string | null;
  sourceUrl?: string | null;
  sourceTitle?: string | null;
  sender?: string | null;
  conversationId?: string | null;
  groupId?: string | null;
  groupName?: string | null;
  meetingId?: string | null;
  issueKey?: string | null;
  timestamp: number;
  entities: Array<{ type: EntityType; name: string; id?: string }>;
  matchedProjects: string[];
  summary?: string | null;
  metadata?: Record<string, any>;
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
  dominant_entities_json: string | null;
  dominant_projects_json: string | null;
  topics_json: string | null;
  acronym_aliases_json: string | null;
  role_terms_json: string | null;
  source_anchors_json: string | null;
  confidence: number | null;
  window_start: number | null;
  window_end: number | null;
  updated_at: number;
}

interface MessageContextRow {
  id: string;
  content: string;
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

interface ExpansionCandidate {
  id: string;
  label: string;
  projects: string[];
  topics: string[];
  roleTerms: string[];
  sourceAnchors: string[];
  sourceIds: string[];
  score: number;
  confidence: number;
  reason: string;
}

const MAX_EXPANDED_QUERY_CHARS = 900;
const RECENT_WINDOW_SECONDS = 90 * 24 * 60 * 60;
const SOURCE_ANCHOR_LIMIT = 8;
const ROLE_TERM_ALIASES: Record<string, string[]> = {
  backend: ['BE', 'backend', 'back end', '后端', '服务端'],
  frontend: ['FE', 'frontend', 'front end', '前端'],
};
const ROLE_TERM_PATTERNS: Array<[string, RegExp]> = [
  ['backend', /\bBE\b|\bback[-\s]?end\b|\bserver[-\s]?side\b|后端|服务端/i],
  ['frontend', /\bFE\b|\bfront[-\s]?end\b|\bclient[-\s]?side\b|前端|客户端/i],
];
const DEICTIC_PATTERN =
  /那个|这个|这块|那块|这边|那边|刚才|上面|前面|它|ready\s*了吗|搞定了吗|完成了吗|\bthat\b|\bthis\b|\bit\b|\bready\b/i;
const STATUS_INTENT_PATTERN =
  /ready|done|complete|completed|pending|blocked?|waiting?|status|progress|merge|merged|ship|shipped|定了|确定|搞定|完成|就绪|状态|进展|阻塞|等待|合了|上线|发布|方案|设计|design/i;
const ISSUE_KEY_PATTERN = /\b[A-Z][A-Z0-9]+-\d+\b/g;
const ISSUE_KEY_SINGLE_PATTERN = /\b[A-Z][A-Z0-9]+-\d+\b/;
const URL_PATTERN = /https?:\/\/[^\s)）]+/g;
const DIRECT_NAMED_SUBJECT_PATTERN = /\b[A-Z][A-Za-z0-9._-]{2,}\b/g;
const GENERIC_NAMED_SUBJECTS = new Set([
  'API',
  'AND',
  'FOR',
  'THE',
  'THIS',
  'THAT',
  'WHAT',
  'WHEN',
  'WITH',
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

function normalizeComparable(value: string): string {
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

function mergeLimited(existing: string[], incoming: string[], limit: number): string[] {
  return uniq([...incoming, ...existing]).slice(0, limit);
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
  all: string[];
  projects: string[];
  topics: string[];
} {
  const parsed = safeJsonParse<unknown>(value);
  const all: string[] = [];
  const projects: string[] = [];
  const topics: string[] = [];
  if (!Array.isArray(parsed)) return { all, projects, topics };
  for (const item of parsed) {
    if (!item || typeof item !== 'object') continue;
    const record = item as Record<string, unknown>;
    const name = typeof record.name === 'string' ? record.name : '';
    const type = typeof record.type === 'string' ? record.type : '';
    if (!name) continue;
    all.push(name);
    if (/project/i.test(type)) projects.push(name);
    if (/topic|technology/i.test(type)) topics.push(name);
  }
  return { all: uniq(all), projects: uniq(projects), topics: uniq(topics) };
}

function extractAcronyms(value: string): string[] {
  const matches = value.match(/\b[A-Z][A-Z0-9]{1,9}\b/g) ?? [];
  return uniq(matches.filter((term) => term.length >= 2));
}

function extractRoleTerms(value: string): string[] {
  const roles: string[] = [];
  for (const [role, pattern] of ROLE_TERM_PATTERNS) {
    if (pattern.test(value)) roles.push(role);
  }
  return uniq(roles);
}

function extractSourceAnchors(value: string): string[] {
  return uniq([...(value.match(ISSUE_KEY_PATTERN) ?? []), ...(value.match(URL_PATTERN) ?? [])]).slice(
    0,
    SOURCE_ANCHOR_LIMIT,
  );
}

function extractTokens(value: string): string[] {
  const tokens = new Set<string>();
  const matches = value.match(/[a-z0-9][a-z0-9._:-]{1,}|[\u3400-\u9fff]{2,}/giu) ?? [];
  for (const match of matches) {
    const normalized = match.toLowerCase();
    if (normalized.length >= 2) tokens.add(normalized);
    if (/^[\u3400-\u9fff]{3,}$/u.test(match)) {
      for (let index = 0; index <= match.length - 2; index += 1) {
        tokens.add(match.slice(index, index + 2));
      }
    }
  }
  for (const acronym of extractAcronyms(value)) {
    tokens.add(acronym.toLowerCase());
  }
  return Array.from(tokens).filter((token) => token.length >= 2);
}

function hasDirectNamedSubject(query: string): boolean {
  if (ISSUE_KEY_SINGLE_PATTERN.test(query)) return true;
  return (query.match(DIRECT_NAMED_SUBJECT_PATTERN) ?? []).some((token) => {
    const normalized = token.toUpperCase();
    return !GENERIC_NAMED_SUBJECTS.has(normalized) && !/^(?:BE|FE)$/i.test(token);
  });
}

function overlapCount(text: string, tokens: string[]): number {
  const comparable = normalizeComparable(text);
  let score = 0;
  for (const token of tokens) {
    if (comparable.includes(token.toLowerCase())) {
      score += token.length >= 4 ? 2 : 1;
    }
  }
  return score;
}

function frameIdFor(input: ContextFrameIngestInput): string | undefined {
  const metadataConversationId =
    typeof input.metadata?.conversationId === 'string'
      ? input.metadata.conversationId
      : typeof input.metadata?.conversation_id === 'string'
        ? input.metadata.conversation_id
        : undefined;
  const conversationId =
    input.conversationId || metadataConversationId || input.groupId || input.meetingId;
  if (!conversationId && !input.groupName && !input.sourceTitle) return undefined;
  const sourceKey =
    input.groupId ||
    metadataConversationId ||
    input.meetingId ||
    input.groupName ||
    input.sourceTitle ||
    'source';
  return `${input.sourceType}:${toSlug(String(sourceKey)) || String(sourceKey).slice(0, 64)}`;
}

function hasUsefulExpansion(expansion: RecallContextExpansion): boolean {
  return (
    expansion.addedTerms.length > 0 ||
    Boolean(expansion.resolvedProject) ||
    Boolean(expansion.resolvedRole)
  );
}

export class RecallContextExpansionService {
  constructor(private db: Database.Database) {}

  expand(input: RecallContextExpansionInput): RecallContextExpansion {
    const originalQuery = normalizeText(input.query);
    const contextText = this.buildContextText(input);
    const queryRoles = extractRoleTerms(originalQuery);
    const contextRoles = extractRoleTerms(contextText);
    const roleTerms = uniq([...queryRoles, ...contextRoles]);
    const deictic = DEICTIC_PATTERN.test(originalQuery);
    const statusIntent = STATUS_INTENT_PATTERN.test(originalQuery);
    const directNamedSubject = hasDirectNamedSubject(originalQuery);
    const hasExplicitSurfaceContext = Boolean(
      input.preferredTopicTitle ||
        input.currentContext?.title ||
        input.currentContext?.sourceAnchorHints?.length,
    );
    const queryTokens = extractTokens([originalQuery, contextText].join(' '));
    const shouldRunContextMatch =
      Boolean(input.preferredTopicTitle) ||
      (deictic && !directNamedSubject) ||
      (statusIntent && !directNamedSubject) ||
      roleTerms.length > 0 ||
      ISSUE_KEY_SINGLE_PATTERN.test(originalQuery) ||
      Boolean(input.currentContext?.sourceAnchorHints?.length);
    const contextMatch: MemoryContextMatchResult = shouldRunContextMatch
      ? new MemoryContextMatchService(this.db).match(input)
      : {
          state: 'none',
          candidates: [],
          userFacingSummary: '当前问题不属于短指代或状态型缺上下文查询，未执行记忆话题锁定。',
        };
    const contextMatchCandidate =
      contextMatch.state === 'locked' && contextMatch.selectedTopic
        ? this.toExpansionCandidate(contextMatch.selectedTopic)
        : undefined;
    const candidates = this.collectCandidates(input, contextText, queryTokens, roleTerms)
      .filter((candidate) => candidate.score > 0)
      .sort((a, b) => b.score - a.score || b.confidence - a.confidence);

    const top = contextMatchCandidate ?? candidates[0];
    const second = contextMatchCandidate ? undefined : candidates[1];
    const ambiguous =
      contextMatch.state === 'ambiguous'
        ? true
        : Boolean(
            top &&
              second &&
              second.score >= 1.0 &&
              top.score - second.score < 0.75 &&
              second.score / Math.max(top.score, 0.1) >= 0.75,
          );
    const canResolve =
      contextMatchCandidate ||
      ((!directNamedSubject || roleTerms.length > 0 || hasExplicitSurfaceContext) &&
        top &&
        !ambiguous &&
        (top.score >= 2.2 || (deictic && top.score >= 1.6) || roleTerms.length > 0));

    const selected = canResolve ? top : undefined;
    const sourceAnchors = uniq([
      ...extractSourceAnchors(contextText),
      ...(selected?.sourceAnchors ?? []),
    ]).slice(0, SOURCE_ANCHOR_LIMIT);
    const resolvedRole = roleTerms[0];
    const addedTerms = uniq([
      ...(resolvedRole ? ROLE_TERM_ALIASES[resolvedRole] ?? [resolvedRole] : []),
      ...(selected?.projects ?? []),
      ...(selected?.topics ?? []).slice(0, 6),
      ...sourceAnchors,
    ]).filter((term) => normalizeComparable(term) !== normalizeComparable(originalQuery));
    const expandedQuery = clipQuery(
      uniq([originalQuery, ...addedTerms]).join(' '),
      MAX_EXPANDED_QUERY_CHARS,
    );
    const entityHints: ContextRecallEntityHint[] = [];
    if (selected?.projects.length) {
      for (const project of selected.projects.slice(0, 3)) {
        entityHints.push({ kind: 'project', value: project });
      }
    }
    for (const anchor of sourceAnchors.filter((value) => ISSUE_KEY_SINGLE_PATTERN.test(value)).slice(0, 3)) {
      entityHints.push({ kind: 'jira_key', value: anchor });
    }

    const expansion: RecallContextExpansion = {
      originalQuery,
      expandedQuery,
      addedTerms,
      entityHints,
      sourceAnchors,
      resolvedProject: selected?.projects[0] ?? selected?.label,
      resolvedRole,
      ambiguity: ambiguous
        ? {
            state: 'ambiguous',
            candidates:
              contextMatch.state === 'ambiguous'
                ? contextMatch.candidates.slice(0, 3).map((candidate) => ({
                    label: candidate.label,
                    score: Number(candidate.score.toFixed(2)),
                    reason: candidate.reasons.join(', '),
                  }))
                : candidates.slice(0, 3).map((candidate) => ({
                    label: candidate.label,
                    score: Number(candidate.score.toFixed(2)),
                    reason: candidate.reason,
                  })),
          }
        : { state: 'none', candidates: [] },
      contextMatch,
    };

    return hasUsefulExpansion(expansion) || contextMatch.state !== 'none'
      ? expansion
      : {
          originalQuery,
          expandedQuery: originalQuery,
          addedTerms: [],
          entityHints: [],
          sourceAnchors: [],
          ambiguity: { state: 'none', candidates: [] },
          contextMatch,
        };
  }

  private toExpansionCandidate(candidate: MemoryContextTopicCandidate): ExpansionCandidate {
    return {
      id: candidate.id,
      label: candidate.label,
      projects: [candidate.label],
      topics: candidate.aliases,
      roleTerms: candidate.roleTerms,
      sourceAnchors: candidate.anchors,
      sourceIds: candidate.sourceIds,
      score: candidate.score * 5,
      confidence: candidate.confidence,
      reason: candidate.reasons.join(', ') || 'memory context match',
    };
  }

  upsertFrameFromMessage(input: ContextFrameIngestInput): void {
    if (!this.hasContextFramesTable()) return;
    const id = frameIdFor(input);
    if (!id) return;

    const content = [input.content, input.summary, input.sourceTitle, input.groupName]
      .filter(Boolean)
      .join(' ');
    const entityNames = input.entities.map((entity) => entity.name);
    const projects = uniq([
      ...input.matchedProjects,
      ...input.entities
        .filter((entity) => entity.type === 'Project')
        .map((entity) => entity.name),
    ]);
    const topics = uniq([
      ...input.entities
        .filter((entity) => entity.type === 'Topic' || entity.type === 'Technology')
        .map((entity) => entity.name),
      ...extractAcronyms(content).filter((term) => !extractRoleTerms(term).length),
    ]);
    const roleTerms = extractRoleTerms(content);
    const sourceAnchors = uniq([
      ...(input.sourceUrl ? [input.sourceUrl] : []),
      ...extractSourceAnchors(content),
    ]).slice(0, SOURCE_ANCHOR_LIMIT);

    if (
      projects.length === 0 &&
      topics.length === 0 &&
      roleTerms.length === 0 &&
      sourceAnchors.length === 0
    ) {
      return;
    }

    const existing = this.getFrameById(id);
    const createdAt = existing?.updated_at ?? now();
    const updatedAt = now();
    const windowStart = existing?.window_start
      ? Math.min(existing.window_start, input.timestamp)
      : input.timestamp;
    const windowEnd = existing?.window_end
      ? Math.max(existing.window_end, input.timestamp)
      : input.timestamp;
    const mergedEntities = mergeLimited(
      parseJsonStringArray(existing?.dominant_entities_json),
      entityNames,
      24,
    );
    const mergedProjects = mergeLimited(
      parseJsonStringArray(existing?.dominant_projects_json),
      projects,
      12,
    );
    const mergedTopics = mergeLimited(
      parseJsonStringArray(existing?.topics_json),
      topics,
      24,
    );
    const mergedRoles = mergeLimited(
      parseJsonStringArray(existing?.role_terms_json),
      roleTerms,
      8,
    );
    const mergedAnchors = mergeLimited(
      parseJsonStringArray(existing?.source_anchors_json),
      sourceAnchors,
      SOURCE_ANCHOR_LIMIT,
    );
    const conversationId =
      input.conversationId ||
      getMetadataString(input.metadata, 'conversationId', 'conversation_id') ||
      input.groupId ||
      null;

    this.db
      .prepare(
        `INSERT INTO conversation_context_frames
          (id, surface, source_type, conversation_id, group_id, meeting_id, issue_key,
           title, summary, dominant_entities_json, dominant_projects_json,
           topics_json, acronym_aliases_json, role_terms_json, source_anchors_json,
           confidence, window_start, window_end, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           surface = excluded.surface,
           source_type = excluded.source_type,
           conversation_id = COALESCE(excluded.conversation_id, conversation_context_frames.conversation_id),
           group_id = COALESCE(excluded.group_id, conversation_context_frames.group_id),
           meeting_id = COALESCE(excluded.meeting_id, conversation_context_frames.meeting_id),
           issue_key = COALESCE(excluded.issue_key, conversation_context_frames.issue_key),
           title = COALESCE(excluded.title, conversation_context_frames.title),
           summary = excluded.summary,
           dominant_entities_json = excluded.dominant_entities_json,
           dominant_projects_json = excluded.dominant_projects_json,
           topics_json = excluded.topics_json,
           acronym_aliases_json = excluded.acronym_aliases_json,
           role_terms_json = excluded.role_terms_json,
           source_anchors_json = excluded.source_anchors_json,
           confidence = excluded.confidence,
           window_start = excluded.window_start,
           window_end = excluded.window_end,
           updated_at = excluded.updated_at`,
      )
      .run(
        id,
        input.sourceType,
        input.sourceType,
        conversationId,
        input.groupId ?? null,
        input.meetingId ?? getMetadataString(input.metadata, 'meetingId', 'meeting_id') ?? null,
        input.issueKey ?? getMetadataString(input.metadata, 'issueKey', 'issue_key') ?? null,
        input.groupName ?? input.sourceTitle ?? null,
        normalizeText(input.summary || input.content).slice(0, 320),
        JSON.stringify(mergedEntities),
        JSON.stringify(mergedProjects),
        JSON.stringify(mergedTopics),
        JSON.stringify(extractAcronyms(content).map((acronym) => ({ acronym }))),
        JSON.stringify(mergedRoles),
        JSON.stringify(mergedAnchors),
        Math.min(0.95, Math.max(0.45, 0.55 + mergedProjects.length * 0.08 + mergedRoles.length * 0.06)),
        windowStart,
        windowEnd,
        createdAt,
        updatedAt,
      );
  }

  private buildContextText(input: RecallContextExpansionInput): string {
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

  private collectCandidates(
    input: RecallContextExpansionInput,
    contextText: string,
    queryTokens: string[],
    roleTerms: string[],
  ): ExpansionCandidate[] {
    const candidates = [
      ...this.collectFrameCandidates(input, contextText, queryTokens, roleTerms),
      ...this.collectRecentMessageCandidates(input, contextText, queryTokens, roleTerms),
      ...this.collectWatchedProjectCandidates(contextText, queryTokens, roleTerms),
      ...this.collectEntityCandidates(contextText, queryTokens, roleTerms),
    ];
    const byLabel = new Map<string, ExpansionCandidate>();
    for (const candidate of candidates) {
      const key = normalizeComparable(candidate.label);
      if (!key) continue;
      const existing = byLabel.get(key);
      if (!existing || candidate.score > existing.score) {
        byLabel.set(key, candidate);
      }
    }
    return Array.from(byLabel.values());
  }

  private collectFrameCandidates(
    input: RecallContextExpansionInput,
    contextText: string,
    queryTokens: string[],
    roleTerms: string[],
  ): ExpansionCandidate[] {
    if (!this.hasContextFramesTable()) return [];
    const sourceIds = this.getSourceIds(input);
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

    if (rows.length < 12 && queryTokens.length > 0) {
      const likeTerms = queryTokens
        .filter((token) => token.length >= 3)
        .slice(0, 4)
        .map((token) => `%${token}%`);
      if (likeTerms.length > 0) {
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
               LIMIT 20`,
            )
            .all(...likeTerms.flatMap((term) => [term, term, term, term, term])) as ContextFrameRow[],
        );
      }
    }
    if (rows.length < 12 && roleTerms.length > 0) {
      const roleLikeTerms = roleTerms.map((role) => `%${role}%`);
      addRows(
        this.db
          .prepare(
            `SELECT * FROM conversation_context_frames
             WHERE ${roleLikeTerms.map(() => 'role_terms_json LIKE ?').join(' OR ')}
             ORDER BY updated_at DESC
             LIMIT 20`,
          )
          .all(...roleLikeTerms) as ContextFrameRow[],
      );
    }

    return rows.map((row) => {
      const projects = parseJsonStringArray(row.dominant_projects_json);
      const topics = parseJsonStringArray(row.topics_json);
      const frameRoles = parseJsonStringArray(row.role_terms_json);
      const sourceAnchors = parseJsonStringArray(row.source_anchors_json);
      const sourceAnchorMatch = Boolean(
        sourceIds.issueKey &&
          sourceAnchors.some(
            (anchor) =>
              normalizeComparable(anchor) ===
              normalizeComparable(sourceIds.issueKey!),
          ),
      );
      const sourceMatch = [
        sourceIds.groupId && row.group_id === sourceIds.groupId,
        sourceIds.conversationId && row.conversation_id === sourceIds.conversationId,
        sourceIds.meetingId && row.meeting_id === sourceIds.meetingId,
        sourceIds.issueKey && row.issue_key === sourceIds.issueKey,
        sourceAnchorMatch,
      ].some(Boolean);
      const candidateText = [
        row.title,
        row.summary,
        ...projects,
        ...topics,
        ...sourceAnchors,
      ].join(' ');
      const score =
        overlapCount(candidateText, queryTokens) +
        (sourceMatch ? 3 : 0) +
        roleOverlapScore(frameRoles, roleTerms) +
        recencyScore(row.updated_at);
      return {
        id: row.id,
        label: projects[0] || row.title || row.id,
        projects,
        topics,
        roleTerms: frameRoles,
        sourceAnchors,
        sourceIds: [
          row.group_id ? `group:${row.group_id}` : '',
          row.conversation_id ? `conversation:${row.conversation_id}` : '',
          row.meeting_id ? `meeting:${row.meeting_id}` : '',
          row.issue_key ? `issue:${row.issue_key}` : '',
        ].filter(Boolean),
        score,
        confidence: row.confidence ?? 0.55,
        reason: sourceMatch ? 'current source frame' : 'recent context frame',
      };
    });
  }

  private collectRecentMessageCandidates(
    input: RecallContextExpansionInput,
    contextText: string,
    queryTokens: string[],
    roleTerms: string[],
  ): ExpansionCandidate[] {
    const sourceIds = this.getSourceIds(input);
    const params: any[] = [now() - RECENT_WINDOW_SECONDS];
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

    if (clauses.length === 0) return [];

    const rows = this.db
      .prepare(
        `SELECT id, content, source_type, source_url, source_title, sender, group_id,
                group_name, timestamp, entities_json, matched_projects_json,
                metadata_json, importance
         FROM messages_raw
         WHERE timestamp >= ? AND (${clauses.join(' OR ')})
         ORDER BY timestamp DESC
         LIMIT 80`,
      )
      .all(...params) as MessageContextRow[];

    return rows.map((row) => {
      const metadata = safeJsonParse<Record<string, any>>(row.metadata_json) ?? {};
      const entityNames = parseEntityNames(row.entities_json);
      const matchedProjects = parseJsonStringArray(row.matched_projects_json);
      const watchedProjects = this.matchWatchedProjectsInText(
        [row.content, row.source_title, row.group_name].join(' '),
      );
      const projects = uniq([...matchedProjects, ...entityNames.projects, ...watchedProjects]);
      const topics = uniq([
        ...entityNames.topics,
        ...extractAcronyms([row.content, row.source_title].join(' ')),
      ]);
      const messageRoles = extractRoleTerms(row.content);
      const sourceAnchors = uniq([
        row.source_url ?? '',
        ...extractSourceAnchors(row.content),
      ]).slice(0, SOURCE_ANCHOR_LIMIT);
      const sourceMatch =
        (sourceIds.groupId && row.group_id === sourceIds.groupId) ||
        (sourceIds.conversationId &&
          JSON.stringify(metadata).includes(sourceIds.conversationId));
      const candidateText = [
        row.content,
        row.source_title,
        row.group_name,
        ...projects,
        ...topics,
        ...sourceAnchors,
      ].join(' ');
      const score =
        overlapCount(candidateText, queryTokens) +
        (sourceMatch ? 2.4 : 0) +
        roleOverlapScore(messageRoles, roleTerms) +
        recencyScore(row.timestamp) +
        (row.importance ?? 0.5);
      return {
        id: `message:${row.id}`,
        label: projects[0] || row.source_title || row.group_name || row.id,
        projects,
        topics,
        roleTerms: messageRoles,
        sourceAnchors,
        sourceIds: [
          row.group_id ? `group:${row.group_id}` : '',
          sourceIds.conversationId ? `conversation:${sourceIds.conversationId}` : '',
        ].filter(Boolean),
        score,
        confidence: Math.min(0.9, 0.45 + (row.importance ?? 0.5) * 0.4),
        reason: sourceMatch ? 'recent same conversation message' : 'recent matching message',
      };
    });
  }

  private collectWatchedProjectCandidates(
    contextText: string,
    queryTokens: string[],
    roleTerms: string[],
  ): ExpansionCandidate[] {
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
      const candidateText = [row.name, ...aliases].join(' ');
      const score =
        overlapCount(candidateText, queryTokens) +
        (normalizeComparable(contextText).includes(normalizeComparable(row.name)) ? 2 : 0) +
        (row.priority ?? 0) * 0.15 +
        (roleTerms.length > 0 ? 0.3 : 0);
      return {
        id: `project:${row.id}`,
        label: row.name,
        projects: [row.name],
        topics: aliases,
        roleTerms: [],
        sourceAnchors: [],
        sourceIds: [],
        score,
        confidence: 0.65,
        reason: 'watched project match',
      };
    });
  }

  private collectEntityCandidates(
    contextText: string,
    queryTokens: string[],
    roleTerms: string[],
  ): ExpansionCandidate[] {
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
      const candidateText = [row.name, row.description, ...aliases].join(' ');
      const score =
        overlapCount(candidateText, queryTokens) +
        (normalizeComparable(contextText).includes(normalizeComparable(row.name)) ? 1.5 : 0) +
        (row.importance ?? 0.5) +
        (roleTerms.length > 0 ? 0.2 : 0);
      return {
        id: `entity:${row.id}`,
        label: row.name,
        projects: row.type === 'Project' ? [row.name] : [],
        topics: row.type === 'Project' ? aliases : [row.name, ...aliases],
        roleTerms: [],
        sourceAnchors: [],
        sourceIds: [],
        score,
        confidence: Math.min(0.85, 0.45 + (row.importance ?? 0.5) * 0.3),
        reason: `${row.type.toLowerCase()} entity match`,
      };
    });
  }

  private getSourceIds(input: RecallContextExpansionInput): {
    groupId?: string;
    conversationId?: string;
    meetingId?: string;
    issueKey?: string;
  } {
    return {
      groupId: input.currentContext?.groupId || input.sourceContext?.groupId,
      conversationId:
        input.currentContext?.conversationId || input.sourceContext?.conversationId,
      meetingId: input.currentContext?.meetingId || input.sourceContext?.meetingId,
      issueKey: input.currentContext?.issueKey || input.sourceContext?.issueKey,
    };
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

  private hasContextFramesTable(): boolean {
    try {
      const row = this.db
        .prepare(
          `SELECT name FROM sqlite_master
           WHERE type = 'table' AND name = 'conversation_context_frames'
           LIMIT 1`,
        )
        .get() as { name: string } | undefined;
      return Boolean(row);
    } catch {
      return false;
    }
  }

  private getFrameById(id: string): ContextFrameRow | undefined {
    try {
      return this.db
        .prepare(`SELECT * FROM conversation_context_frames WHERE id = ? LIMIT 1`)
        .get(id) as ContextFrameRow | undefined;
    } catch {
      return undefined;
    }
  }
}

function roleOverlapScore(candidateRoles: string[], queryRoles: string[]): number {
  if (candidateRoles.length === 0 || queryRoles.length === 0) return 0;
  const candidateSet = new Set(candidateRoles.map(normalizeComparable));
  let score = 0;
  for (const role of queryRoles) {
    if (candidateSet.has(normalizeComparable(role))) score += 1.4;
  }
  return score;
}

function recencyScore(timestamp?: number | null): number {
  if (!timestamp) return 0;
  const ageSeconds = Math.max(0, now() - timestamp);
  if (ageSeconds < 24 * 60 * 60) return 1;
  if (ageSeconds < 7 * 24 * 60 * 60) return 0.8;
  if (ageSeconds < 30 * 24 * 60 * 60) return 0.45;
  return 0.15;
}

function clipQuery(value: string, maxLength: number): string {
  const cleaned = normalizeText(value);
  if (cleaned.length <= maxLength) return cleaned;
  return cleaned.slice(0, maxLength).trimEnd();
}

function getMetadataString(
  metadata: Record<string, any> | undefined,
  ...keys: string[]
): string | undefined {
  if (!metadata) return undefined;
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return undefined;
}
