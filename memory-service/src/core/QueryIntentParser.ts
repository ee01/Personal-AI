import type Database from 'better-sqlite3';

import type { RecallSourceType } from '../types/index.js';
import { parseQueryTimeRange } from '../utils/queryTime.js';

type QueryIntentKind = 'search' | 'aggregate' | 'timeline' | 'profile' | 'entity_detail';

interface ProjectRow {
  name: string;
  aliases_json: string | null;
}

interface NamedCountRow {
  value: string;
}

interface EntityNameRow {
  name: string;
  aliases_json: string | null;
}

export interface ParsedQueryIntent {
  cleanedQuery: string;
  filters: {
    senderNames?: string[];
    groupNames?: string[];
    timeRange?: { start: number; end: number };
    entityNames?: string[];
    projectNames?: string[];
    minImportance?: number;
    sourceTypes?: RecallSourceType[];
  };
  intent: QueryIntentKind;
}

const IMPORTANCE_PATTERN = /\b(important|urgent|critical|high priority)\b|重要|关键|重点|紧急/iu;
const PROFILE_PATTERN = /\b(my|me)\b.*\b(preference|habit|style|pattern|focus)\b|我的?(偏好|习惯|风格|模式|喜好|工作偏好|关注点)/iu;
const TIMELINE_PATTERN = /\btimeline\b|时间线|历程|过程|什么时候|何时|最近.*(发生|讨论|进展)|过去.*(发生|变化)/iu;
const AGGREGATE_PATTERN = /\b(trend|distribution|count|statistics?|analytics?)\b|趋势|分布|统计|多少次|汇总/iu;
const ENTITY_DETAIL_PATTERN = /\b(detail|history|status|background)\b|详情|历史|状态|进展|变化/iu;
const SPEAKER_PATTERN = /\b(said|mentioned|wrote|posted|discussed)\b|说过|说了|提到|发过|写过|讨论过/iu;
const GROUP_PATTERN = /\b(group|channel|chat)\b|群|频道|讨论组/iu;

const SOURCE_PATTERNS: Array<{ sourceType: RecallSourceType; patterns: RegExp[] }> = [
  { sourceType: 'glip', patterns: [/\bglip\b/iu, /glip\s*消息/iu, /聊天消息/iu, /群消息/iu] },
  { sourceType: 'jira', patterns: [/\bjira\b/iu, /\bissue\b/iu, /\bticket\b/iu, /工单/iu, /任务单/iu] },
  { sourceType: 'web', patterns: [/\bweb\b/iu, /网页/iu, /浏览记录/iu, /页面内容/iu] },
  { sourceType: 'manual', patterns: [/\bmanual\b/iu, /手动记录/iu, /手动输入/iu] },
  { sourceType: 'system', patterns: [/\bsystem\b/iu, /系统消息/iu] },
  { sourceType: 'reflection', patterns: [/\breflection\b/iu, /反思/iu] },
  { sourceType: 'dream', patterns: [/\bdream\b/iu, /梦境/iu, /做梦/iu] },
  { sourceType: 'user_core', patterns: [/\buser[_\s-]?core\b/iu, /用户画像文件/iu, /画像总结/iu] },
];

function safeJsonParse<T>(json: string | null): T | undefined {
  if (!json) return undefined;
  try {
    return JSON.parse(json) as T;
  } catch {
    return undefined;
  }
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function containsNamedCandidate(query: string, candidate: string): boolean {
  const normalizedCandidate = candidate.trim();
  if (!normalizedCandidate) return false;

  const lowerQuery = query.toLowerCase();
  const lowerCandidate = normalizedCandidate.toLowerCase();

  if (/^[a-z0-9][a-z0-9 ._:-]*$/i.test(normalizedCandidate)) {
    if (lowerCandidate.length < 3) return false;
    const pattern = new RegExp(
      `(^|[^a-z0-9])${escapeRegex(lowerCandidate).replace(/\s+/g, '\\s+')}(?=$|[^a-z0-9])`,
      'iu',
    );
    return pattern.test(lowerQuery);
  }

  return lowerQuery.includes(lowerCandidate);
}

function uniq(values: string[]): string[] {
  return Array.from(new Set(values));
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export class QueryIntentParser {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  parse(query: string): ParsedQueryIntent {
    const cleanedQuery = collapseWhitespace(query);
    const senderNames = this.matchSenders(cleanedQuery);
    const groupNames = this.matchGroups(cleanedQuery);
    const projectNames = this.matchProjects(cleanedQuery);
    const entityNames = this.matchEntities(cleanedQuery);
    const sourceTypes = this.matchSourceTypes(cleanedQuery);
    const timeRange = parseQueryTimeRange(cleanedQuery) ?? undefined;
    const minImportance = IMPORTANCE_PATTERN.test(cleanedQuery) ? 0.7 : undefined;

    const filters: ParsedQueryIntent['filters'] = {};
    if (senderNames.length > 0) filters.senderNames = senderNames;
    if (groupNames.length > 0) filters.groupNames = groupNames;
    if (projectNames.length > 0) filters.projectNames = projectNames;
    if (entityNames.length > 0) filters.entityNames = entityNames;
    if (sourceTypes.length > 0) filters.sourceTypes = sourceTypes;
    if (timeRange) filters.timeRange = timeRange;
    if (minImportance != null) filters.minImportance = minImportance;

    return {
      cleanedQuery,
      filters,
      intent: this.detectIntent(cleanedQuery, filters),
    };
  }

  private detectIntent(
    query: string,
    filters: ParsedQueryIntent['filters'],
  ): QueryIntentKind {
    if (PROFILE_PATTERN.test(query)) {
      return 'profile';
    }

    if (AGGREGATE_PATTERN.test(query)) {
      return 'aggregate';
    }

    if (TIMELINE_PATTERN.test(query) || filters.timeRange != null) {
      return 'timeline';
    }

    if ((filters.projectNames?.length ?? 0) > 0 || (filters.entityNames?.length ?? 0) > 0) {
      if (ENTITY_DETAIL_PATTERN.test(query)) {
        return 'entity_detail';
      }
    }

    return 'search';
  }

  private matchSourceTypes(query: string): RecallSourceType[] {
    return SOURCE_PATTERNS
      .filter((entry) => entry.patterns.some((pattern) => pattern.test(query)))
      .map((entry) => entry.sourceType);
  }

  private matchSenders(query: string): string[] {
    if (!SPEAKER_PATTERN.test(query)) {
      return [];
    }

    const rows = this.db
      .prepare(
        `SELECT sender AS value
         FROM messages_raw
         WHERE sender IS NOT NULL AND TRIM(sender) != ''
         GROUP BY sender
         ORDER BY COUNT(*) DESC, sender ASC
         LIMIT 200`,
      )
      .all() as NamedCountRow[];

    return uniq(
      rows
        .map((row) => row.value)
        .filter((value) => containsNamedCandidate(query, value)),
    );
  }

  private matchGroups(query: string): string[] {
    if (!GROUP_PATTERN.test(query)) {
      return [];
    }

    const rows = this.db
      .prepare(
        `SELECT group_name AS value
         FROM messages_raw
         WHERE group_name IS NOT NULL AND TRIM(group_name) != ''
         GROUP BY group_name
         ORDER BY COUNT(*) DESC, group_name ASC
         LIMIT 200`,
      )
      .all() as NamedCountRow[];

    return uniq(
      rows
        .map((row) => row.value)
        .filter((value) => containsNamedCandidate(query, value)),
    );
  }

  private matchProjects(query: string): string[] {
    const rows = this.db
      .prepare(
        `SELECT name, aliases_json
         FROM watched_projects
         WHERE is_active = 1
         ORDER BY priority DESC, created_at DESC
         LIMIT 200`,
      )
      .all() as ProjectRow[];

    const matched: string[] = [];

    for (const row of rows) {
      const aliases = safeJsonParse<string[]>(row.aliases_json) ?? [];
      const candidates = [row.name, ...aliases];
      if (candidates.some((candidate) => containsNamedCandidate(query, candidate))) {
        matched.push(row.name);
      }
    }

    return uniq(matched);
  }

  private matchEntities(query: string): string[] {
    const rows = this.db
      .prepare(
        `SELECT name, aliases_json
         FROM entities
         WHERE status = 'active'
         ORDER BY importance DESC, mention_count DESC
         LIMIT 200`,
      )
      .all() as EntityNameRow[];

    const matched: string[] = [];

    for (const row of rows) {
      const aliases = safeJsonParse<string[]>(row.aliases_json) ?? [];
      const candidates = [row.name, ...aliases];
      if (candidates.some((candidate) => containsNamedCandidate(query, candidate))) {
        matched.push(row.name);
      }
    }

    return uniq(matched);
  }
}
