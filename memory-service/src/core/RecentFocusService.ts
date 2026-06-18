import type Database from 'better-sqlite3';

import { daysAgo, formatDateTime } from '../utils/time.js';

/**
 * RecentFocusService — the single source of truth for the "近期重点 / recent
 * focus" block.
 *
 * Background: ChatGPT's leaked system prompt research highlights its "Recent
 * Conversation Content" component as the highest-value, lowest-cost slice of
 * personalization — a cheap rolling summary of "what the user has been up to".
 * This system already builds the same content inside
 * ProviderContextService.renderActiveFocusDigest, but it only served the Doubao
 * bridge. This module extracts that logic so every entry point (/ask,
 * quick-ask, and the provider digest) injects the same block.
 *
 * The block is rolling context, never a fact layer: it never writes profile,
 * never carries watch-rule state, and is always rebuilt from current
 * high-signal memories.
 */

export interface RecentFocusOptions {
  /** Freshness window in days. */
  windowDays?: number;
  /** Approximate token budget for the rendered block. */
  tokenBudget?: number;
  /** Minimum salience/importance to qualify as high-signal. */
  minSalience?: number;
}

export interface RecentFocusBlock {
  /** Rendered markdown block, already clamped to budget. Empty if no signal. */
  bodyMd: string;
  /** Number of source items (messages + profile signals + reflections). */
  itemCount: number;
  /** Source references for provenance, e.g. `message:abc`. */
  sourceRefs: string[];
}

interface MessageRow {
  id: string;
  summary: string | null;
  content: string;
  timestamp: number;
  sender: string | null;
  group_name: string | null;
  importance: number;
  salience_score: number | null;
  consolidation_level: string | null;
  matched_projects_json: string | null;
}

interface ProfileItemRow {
  item_key: string;
  item_value: string;
  salience_score: number;
  user_confirmed: number;
  last_seen: number;
  created_at: number;
}

interface ReflectionArtifactRow {
  id: string;
  scope: string;
  scope_ref: string | null;
  summary: string;
  created_at: number;
}

const DEFAULT_WINDOW_DAYS = 14;
const DEFAULT_TOKEN_BUDGET = 320;
const DEFAULT_MIN_SALIENCE = 0.35;

function compactText(text: string, maxLength: number): string {
  const normalized = (text ?? '').replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}

function safeJsonParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function formatMatchedProjects(raw: string | null): string | null {
  const parsed = safeJsonParse<unknown[]>(raw, []);
  const names = parsed
    .map((item) => {
      if (typeof item === 'string') return item.trim();
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        const record = item as Record<string, unknown>;
        for (const key of ['name', 'title', 'project', 'projectName']) {
          const value = record[key];
          if (typeof value === 'string' && value.trim()) return value.trim();
        }
      }
      return null;
    })
    .filter((item): item is string => Boolean(item));
  if (names.length === 0) return null;
  return compactText(names.slice(0, 3).join(', '), 80);
}

function formatRecentMemoryHighlight(row: MessageRow): string {
  const text = row.summary ?? compactText(row.content, 160);
  const prefix = `${formatDateTime(row.timestamp)}${row.sender ? ` ${row.sender}` : ''}${row.group_name ? ` @ ${row.group_name}` : ''}`;
  const projects = formatMatchedProjects(row.matched_projects_json);
  const score = Math.max(row.salience_score ?? 0, row.importance ?? 0);
  const meta = [
    projects ? `projects ${projects}` : null,
    Number.isFinite(score) ? `score ${score.toFixed(2)}` : null,
  ].filter((item): item is string => Boolean(item));
  return `${prefix}: ${compactText(text, 180)}${meta.length ? ` [${compactText(meta.join('; '), 120)}]` : ''}`;
}

function formatProfileSignal(row: ProfileItemRow): string {
  const confidence = row.user_confirmed ? 'confirmed' : 'inferred';
  return `**${row.item_key}**: ${compactText(row.item_value, 160)} [${confidence}; salience ${row.salience_score.toFixed(2)}]`;
}

function markdownListOrNote(items: string[], emptyFallback: string): string {
  if (items.length === 0) return `> ${emptyFallback}`;
  return items.map((item) => `- ${item}`).join('\n');
}

function clampMarkdownByBudget(markdown: string, tokenBudget: number): string {
  const maxChars = Math.max(400, tokenBudget * 4);
  if (markdown.length <= maxChars) return markdown;
  const cutoff = Math.max(0, maxChars - 32);
  return `${markdown.slice(0, cutoff).trim()}\n\n> Truncated to fit token budget.`;
}

/**
 * Build the recent-focus block from current high-signal memories, recent
 * confirmed profile signals, and recent reflections. Returns `itemCount === 0`
 * with empty bodyMd when there is no signal in the window — callers should skip
 * injection in that case rather than emit a placeholder.
 */
export function buildRecentFocusBlock(
  db: Database.Database,
  options: RecentFocusOptions = {},
): RecentFocusBlock {
  const windowDays = options.windowDays ?? DEFAULT_WINDOW_DAYS;
  const tokenBudget = options.tokenBudget ?? DEFAULT_TOKEN_BUDGET;
  const minSalience = options.minSalience ?? DEFAULT_MIN_SALIENCE;
  const cutoff = daysAgo(windowDays);

  const recentMessages = db
    .prepare(
      `SELECT
         m.id, m.summary, m.content, m.timestamp, m.sender, m.group_name,
         m.importance, m.matched_projects_json,
         mm.salience_score, mm.consolidation_level
       FROM messages_raw m
       LEFT JOIN memory_metadata mm
         ON mm.target_type = 'message' AND mm.target_id = m.id
       WHERE m.timestamp >= ?
         AND MAX(COALESCE(mm.salience_score, 0), COALESCE(m.importance, 0)) >= ?
       ORDER BY MAX(COALESCE(mm.salience_score, 0), COALESCE(m.importance, 0)) DESC,
                m.importance DESC, m.timestamp DESC
       LIMIT 10`,
    )
    .all(cutoff, minSalience) as MessageRow[];

  const recentProfileSignals = db
    .prepare(
      `SELECT item_key, item_value, salience_score, user_confirmed, last_seen, created_at
       FROM user_profile_items
       WHERE status = 'active' AND user_confirmed = 1
         AND last_seen >= ? AND salience_score >= ?
       ORDER BY user_confirmed DESC, salience_score DESC, last_seen DESC
       LIMIT 6`,
    )
    .all(cutoff, minSalience) as ProfileItemRow[];

  const recentReflections = db
    .prepare(
      `SELECT id, scope, scope_ref, summary, created_at
       FROM reflection_artifacts
       WHERE created_at >= ?
       ORDER BY created_at DESC
       LIMIT 4`,
    )
    .all(cutoff) as ReflectionArtifactRow[];

  const itemCount =
    recentMessages.length + recentProfileSignals.length + recentReflections.length;

  if (itemCount === 0) {
    return { bodyMd: '', itemCount: 0, sourceRefs: [] };
  }

  const bodySections = [
    '# Active Focus Digest',
    `> Freshness window: ${windowDays} day(s). Built from recent high-signal memories, profile updates, and reflections. Watch rules / concerned items are not treated as memory highlights.`,
    '',
    '## Recent Memory Highlights',
    markdownListOrNote(
      recentMessages.map(formatRecentMemoryHighlight),
      'No recent high-signal memories found in the freshness window.',
    ),
    '',
    '## Recent Profile Signals',
    markdownListOrNote(
      recentProfileSignals.map(formatProfileSignal),
      'No recent profile signals found in the freshness window.',
    ),
    '',
    '## Recent Reflections',
    markdownListOrNote(
      recentReflections.map((row) => {
        const scope = row.scope_ref ? `${row.scope}/${row.scope_ref}` : row.scope;
        return `${scope}: ${compactText(row.summary, 160)}`;
      }),
      'No recent reflections found.',
    ),
  ];

  const sourceRefs = [
    ...recentMessages.map((row) => `message:${row.id}`),
    ...recentProfileSignals.map((row) => `profile_item:${row.item_key}`),
    ...recentReflections.map((row) => `reflection:${row.id}`),
  ];

  return {
    bodyMd: clampMarkdownByBudget(bodySections.join('\n'), tokenBudget),
    itemCount,
    sourceRefs,
  };
}
