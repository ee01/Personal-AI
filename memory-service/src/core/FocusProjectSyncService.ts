/**
 * Focus project snapshot sync from Personal Roadmap (extension-owned).
 * Authority is per-team overwrite: items in the snapshot become focus;
 * missing ones for that team_ref become archived; other teams untouched.
 */

import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import { now } from '../utils/time.js';
import type { FocusProjectRecord } from './FocusProjectContextBuilder.js';

export interface FocusSyncItem {
  key: string;
  type?: string;
  title: string;
  alias?: string | null;
  displayName?: string;
  /** Hand-made backlog item with no Jira issue behind it yet. */
  isDraft?: boolean;
  /** Real Jira key; null while the item is still a draft. */
  jiraKey?: string | null;
  quarter?: string | null;
  targetStart?: string | null;
  targetEnd?: string | null;
  start?: string | null;
  days?: number | null;
  keywords?: string[];
  /** User / Jira description. Paragraph material only; never copied into aliases. */
  description?: string | null;
  priorityHints?: {
    hasAlias?: boolean;
    subActivity?: boolean;
    intersectsCurrentMonth?: boolean;
  };
}

export interface FocusSyncSnapshot {
  teamId: string;
  teamName?: string;
  items: FocusSyncItem[];
  syncedAt: number;
}

interface WatchedRow {
  id: string;
  entity_id: string | null;
  name: string;
  description: string | null;
  aliases_json: string | null;
  auto_capture_rules_json: string | null;
  tracked_properties_json: string | null;
  is_active: number;
  priority: number;
  created_at: number;
  updated_at: number | null;
  source?: string | null;
  team_ref?: string | null;
  external_ref_json?: string | null;
  tier?: string | null;
  display_name?: string | null;
  last_engaged_at?: number | null;
  last_synced_at?: number | null;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function computePriority(item: FocusSyncItem, engagedAt: number): number {
  let score = 40;
  if (item.priorityHints?.hasAlias || item.alias) score += 30;
  if (item.priorityHints?.subActivity) score += 15;
  if (item.priorityHints?.intersectsCurrentMonth) score += 10;
  // recency boost within 7 days
  if (Date.now() - engagedAt < 7 * 86_400_000) score += 10;
  return Math.min(100, score);
}

function displayNameOf(item: FocusSyncItem): string {
  if (item.displayName?.trim()) return item.displayName.trim();
  if (item.alias?.trim()) return item.alias.trim();
  const title = String(item.title || '').replace(/\s+/g, ' ').trim();
  if (title.length <= 12) return title || item.key;
  return `${title.slice(0, 10)}…`;
}

export function listFocusProjects(db: Database.Database): FocusProjectRecord[] {
  const rows = db
    .prepare(
      `SELECT * FROM watched_projects
       WHERE COALESCE(tier, 'focus') IN ('focus', 'candidate')
       ORDER BY priority DESC, COALESCE(last_engaged_at, updated_at, created_at) DESC`,
    )
    .all() as WatchedRow[];

  return rows.map((row) => {
    let externalRef: FocusProjectRecord['externalRef'];
    try {
      externalRef = row.external_ref_json
        ? JSON.parse(row.external_ref_json)
        : undefined;
    } catch {
      externalRef = undefined;
    }
    let aliases: string[] | undefined;
    try {
      aliases = row.aliases_json ? JSON.parse(row.aliases_json) : undefined;
    } catch {
      aliases = undefined;
    }
    return {
      id: row.id,
      entityId: row.entity_id ?? undefined,
      name: row.name,
      displayName: row.display_name ?? undefined,
      aliases,
      teamRef: row.team_ref ?? undefined,
      externalRef,
      description:
        typeof externalRef?.description === 'string' &&
        externalRef.description.trim()
          ? externalRef.description
          : undefined,
      tier: (row.tier as FocusProjectRecord['tier']) || 'focus',
      priority: row.priority,
      lastEngagedAt: row.last_engaged_at ?? undefined,
    };
  });
}

export function syncFocusProjectsForTeam(
  db: Database.Database,
  snapshot: FocusSyncSnapshot,
): {
  upserted: number;
  archived: number;
  skipped: boolean;
  projects: FocusProjectRecord[];
} {
  const teamId = String(snapshot.teamId || '').trim();
  if (!teamId) {
    throw new Error('teamId is required');
  }
  const syncedAtRaw = Number(snapshot.syncedAt) || Date.now();
  const syncedAt = syncedAtRaw > 1e12 ? Math.floor(syncedAtRaw / 1000) : syncedAtRaw;
  const teamName = snapshot.teamName || teamId;

  const existing = db
    .prepare(`SELECT * FROM watched_projects WHERE team_ref = ?`)
    .all(teamId) as WatchedRow[];

  const latestSynced = existing.reduce(
    (max, row) => Math.max(max, row.last_synced_at || 0),
    0,
  );
  if (syncedAt < latestSynced) {
    return {
      upserted: 0,
      archived: 0,
      skipped: true,
      projects: listFocusProjects(db),
    };
  }

  const keepIds = new Set<string>();
  let upserted = 0;
  const ts = now();

  const tx = db.transaction(() => {
    for (const item of snapshot.items || []) {
      const key = String(item.key || '').trim();
      if (!key) continue;
      // Derived from the immutable item key, never from jiraKey: a draft that later
      // gets a real Jira issue must keep the same memory identity instead of being
      // archived and re-created under a new id.
      const id = `roadmap-${teamId}-${slugify(key) || randomUUID().slice(0, 8)}`;
      keepIds.add(id);

      const jiraKey = String(item.jiraKey || '').trim();
      const isDraft = Boolean(item.isDraft) && !jiraKey;
      const displayName = displayNameOf(item);
      // A draft's key is synthetic (LOCAL-…) and can never appear in a chat message,
      // so it is kept out of aliases to avoid polluting matching and rule text.
      const aliasSeeds = isDraft
        ? [item.alias, displayName, ...(item.keywords || [])]
        : [item.alias, key, jiraKey, ...(item.keywords || [])];
      const aliases = Array.from(
        new Set(
          aliasSeeds.map((v) => String(v || '').trim()).filter(Boolean),
        ),
      );
      const priority = computePriority(item, ts);
      const externalRef = JSON.stringify({
        itemKey: key,
        jiraKey: isDraft ? null : jiraKey || key,
        isDraft,
        teamName,
        quarter: item.quarter || null,
        targetStart: item.targetStart || null,
        targetEnd: item.targetEnd || null,
        start: item.start || null,
        days: item.days || null,
        description: String(item.description || '').trim() || null,
      });

      const entityId = `project-${id}`;
      db.prepare(
        `INSERT OR IGNORE INTO entities (
          id, type, name, aliases_json, description, importance,
          access_count, mention_count, status, created_at
        ) VALUES (?, 'Project', ?, ?, ?, 7, 0, 0, 'active', ?)`,
      ).run(
        entityId,
        displayName,
        JSON.stringify(aliases),
        `${teamName} · ${item.title}`,
        ts,
      );
      db.prepare(
        `UPDATE entities SET
          name = ?, aliases_json = ?, description = ?, status = 'active'
         WHERE id = ?`,
      ).run(displayName, JSON.stringify(aliases), `${teamName} · ${item.title}`, entityId);

      const current = db
        .prepare(`SELECT id FROM watched_projects WHERE id = ?`)
        .get(id) as { id: string } | undefined;

      if (current) {
        db.prepare(
          `UPDATE watched_projects SET
            entity_id = ?,
            name = ?,
            description = ?,
            aliases_json = ?,
            is_active = 1,
            priority = ?,
            source = 'roadmap',
            team_ref = ?,
            external_ref_json = ?,
            tier = 'focus',
            display_name = ?,
            last_engaged_at = ?,
            last_synced_at = ?,
            updated_at = ?
           WHERE id = ?`,
        ).run(
          entityId,
          item.title,
          `${teamName} roadmap focus`,
          JSON.stringify(aliases),
          priority,
          teamId,
          externalRef,
          displayName,
          ts,
          syncedAt,
          ts,
          id,
        );
      } else {
        db.prepare(
          `INSERT INTO watched_projects (
            id, entity_id, name, description, aliases_json,
            auto_capture_rules_json, tracked_properties_json,
            is_active, priority, created_at, updated_at,
            source, team_ref, external_ref_json, tier, display_name,
            last_engaged_at, last_synced_at
          ) VALUES (?, ?, ?, ?, ?, NULL, NULL, 1, ?, ?, ?, 'roadmap', ?, ?, 'focus', ?, ?, ?)`,
        ).run(
          id,
          entityId,
          item.title,
          `${teamName} roadmap focus`,
          JSON.stringify(aliases),
          priority,
          ts,
          ts,
          teamId,
          externalRef,
          displayName,
          ts,
          syncedAt,
        );
      }
      upserted += 1;
    }

    let archived = 0;
    for (const row of existing) {
      if (keepIds.has(row.id)) continue;
      db.prepare(
        `UPDATE watched_projects SET
          tier = 'archived',
          is_active = 0,
          last_synced_at = ?,
          updated_at = ?
         WHERE id = ?`,
      ).run(syncedAt, ts, row.id);
      archived += 1;
    }

    return archived;
  });

  const archived = tx();
  return {
    upserted,
    archived,
    skipped: false,
    projects: listFocusProjects(db),
  };
}

export function archiveTeamFocusProjects(
  db: Database.Database,
  teamId: string,
): number {
  const ts = now();
  const result = db
    .prepare(
      `UPDATE watched_projects SET
        tier = 'archived',
        is_active = 0,
        updated_at = ?
       WHERE team_ref = ? AND COALESCE(tier, 'focus') != 'archived'`,
    )
    .run(ts, teamId);
  return result.changes;
}
