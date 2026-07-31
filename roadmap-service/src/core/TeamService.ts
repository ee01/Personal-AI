import { createHash, randomBytes } from 'node:crypto';
import { nanoid } from 'nanoid';
import { getDb } from '../storage/Database.js';
import { getEventBus } from './EventBus.js';
import { config } from '../config.js';
import { buildJqlHints } from './JqlIntrospect.js';
import type {
  ActivityRow,
  ActorContext,
  IntentOp,
  ItemRow,
  ItemSource,
  MemberRow,
  SubRow,
  TeamRow,
  TeamSnapshot,
} from '../types.js';

function parseJsonArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function now(): number {
  return Date.now();
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function createShareTokenValue(): string {
  return `rw_${randomBytes(18).toString('base64url')}`;
}

export function hashShareToken(token: string): string {
  return hashToken(token);
}

function normalizeSource(raw: string | null | undefined): ItemSource {
  return raw === 'manual' ? 'manual' : 'jira';
}

/** Derive the Jira project key from a real issue key (`NOVA-123` -> `NOVA`). */
function projectKeyFromJiraKey(key: string): string | null {
  const match = /^([A-Za-z][A-Za-z0-9_]*)-\d+$/.exec(key.trim());
  return match ? match[1].toUpperCase() : null;
}

function mapItem(row: ItemRow, subs: SubRow[]) {
  return {
    key: row.key,
    type: row.type,
    title: row.title,
    source: normalizeSource(row.source),
    jiraKey: row.jira_key,
    projectKey: row.project_key,
    alias: row.alias,
    quarter: row.quarter,
    estimate: row.estimate,
    targetStart: row.target_start,
    targetEnd: row.target_end,
    scheduled: Boolean(row.scheduled),
    start: row.start_date,
    days: row.days,
    lane: row.lane,
    expanded: Boolean(row.expanded),
    version: row.version,
    subs: subs.map((sub) => ({
      id: sub.id,
      key: sub.jira_key,
      title: sub.title,
      alias: sub.alias,
      owner: sub.owner,
      start: sub.start_date,
      days: sub.days,
      temp: Boolean(sub.is_draft),
      createdBy: sub.created_by,
      version: sub.version,
    })),
  };
}

export function listTeams(): Array<{
  id: string;
  name: string;
  jql: string;
  checkedQuarters: string[];
  importedQuarters: string[];
  version: number;
}> {
  const db = getDb();
  const rows = db
    .prepare(`SELECT * FROM teams ORDER BY created_at ASC`)
    .all() as TeamRow[];
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    jql: row.jql,
    checkedQuarters: parseJsonArray(row.checked_quarters_json),
    importedQuarters: parseJsonArray(row.imported_quarters_json),
    version: row.version,
  }));
}

export function getTeam(teamId: string): TeamRow | null {
  const db = getDb();
  return (
    (db.prepare(`SELECT * FROM teams WHERE id = ?`).get(teamId) as
      | TeamRow
      | undefined) || null
  );
}

/**
 * Most common `type` among the team's imported items — the fallback used when
 * the JQL itself does not name an issue type. Manual items are excluded because
 * their type is seeded from these very hints.
 */
function modeItemType(teamId: string): string | null {
  const row = getDb()
    .prepare(
      `SELECT type FROM items
       WHERE team_id = ? AND source = 'jira' AND type IS NOT NULL AND TRIM(type) != ''
       GROUP BY type
       ORDER BY COUNT(*) DESC, type ASC
       LIMIT 1`,
    )
    .get(teamId) as { type: string } | undefined;
  return row?.type || null;
}

export function getTeamSnapshot(teamId: string): TeamSnapshot | null {
  const db = getDb();
  const team = getTeam(teamId);
  if (!team) return null;

  const items = db
    .prepare(`SELECT * FROM items WHERE team_id = ? ORDER BY quarter, key`)
    .all(teamId) as ItemRow[];
  const subs = db
    .prepare(`SELECT * FROM subs WHERE team_id = ? ORDER BY created_at ASC`)
    .all(teamId) as SubRow[];
  const members = db
    .prepare(`SELECT * FROM members WHERE team_id = ? ORDER BY name ASC`)
    .all(teamId) as MemberRow[];

  const cutoff = now() - 60_000;
  const presence = db
    .prepare(
      `SELECT client_id, name, source, last_seen
       FROM presence
       WHERE team_id = ? AND last_seen >= ?
       ORDER BY last_seen DESC`,
    )
    .all(teamId, cutoff) as Array<{
    client_id: string;
    name: string;
    source: string;
    last_seen: number;
  }>;

  const locks = db
    .prepare(
      `SELECT target_type, target_key, actor_name, actor_client_id, expires_at
       FROM soft_locks
       WHERE team_id = ? AND expires_at > ?`,
    )
    .all(teamId, now()) as Array<{
    target_type: string;
    target_key: string;
    actor_name: string;
    actor_client_id: string;
    expires_at: number;
  }>;

  const subsByItem = new Map<string, SubRow[]>();
  for (const sub of subs) {
    const list = subsByItem.get(sub.item_key) || [];
    list.push(sub);
    subsByItem.set(sub.item_key, list);
  }

  return {
    team: {
      id: team.id,
      name: team.name,
      jql: team.jql,
      checkedQuarters: parseJsonArray(team.checked_quarters_json),
      importedQuarters: parseJsonArray(team.imported_quarters_json),
      version: team.version,
      createdBy: team.created_by,
      jqlHints: buildJqlHints({
        jql: team.jql,
        modeItemType: modeItemType(teamId),
      }),
    },
    items: items.map((item) => mapItem(item, subsByItem.get(item.key) || [])),
    members: members.map((m) => ({
      id: m.id,
      name: m.name,
      avatarColor: m.avatar_color,
    })),
    presence: presence.map((p) => ({
      clientId: p.client_id,
      name: p.name,
      source: p.source as TeamSnapshot['presence'][number]['source'],
      lastSeen: p.last_seen,
    })),
    locks: locks.map((lock) => ({
      targetType: lock.target_type,
      targetKey: lock.target_key,
      actorName: lock.actor_name,
      actorClientId: lock.actor_client_id,
      expiresAt: lock.expires_at,
    })),
  };
}

export function createTeam(input: {
  name: string;
  jql: string;
  checkedQuarters?: string[];
  actor: ActorContext;
}): TeamSnapshot {
  const db = getDb();
  const id = nanoid(12);
  const ts = now();
  const checked = input.checkedQuarters || [];
  db.prepare(
    `INSERT INTO teams (
      id, name, jql, checked_quarters_json, imported_quarters_json,
      version, created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, '[]', 1, ?, ?, ?)`,
  ).run(
    id,
    input.name.trim(),
    input.jql.trim(),
    JSON.stringify(checked),
    input.actor.name,
    ts,
    ts,
  );

  writeActivity({
    teamId: id,
    actor: input.actor,
    op: 'create_team',
    targetType: 'team',
    targetKey: id,
    summary: { name: input.name.trim() },
  });

  const snapshot = getTeamSnapshot(id)!;
  getEventBus().emit('team_created', snapshot, id);
  return snapshot;
}

export function validateShareToken(
  teamId: string,
  token: string | undefined | null,
): { ok: boolean; shareTokenId?: string } {
  if (!token) return { ok: false };
  const db = getDb();
  const row = db
    .prepare(
      `SELECT id FROM share_tokens
       WHERE team_id = ? AND token_hash = ? AND revoked_at IS NULL`,
    )
    .get(teamId, hashShareToken(token)) as { id: string } | undefined;
  if (!row) return { ok: false };
  return { ok: true, shareTokenId: row.id };
}

export function createShareToken(
  teamId: string,
  actor: ActorContext,
): { token: string; id: string } {
  const db = getDb();
  const token = createShareTokenValue();
  const id = nanoid(10);
  db.prepare(
    `INSERT INTO share_tokens (id, team_id, token_hash, created_by, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(id, teamId, hashShareToken(token), actor.name, now());
  return { token, id };
}

export function touchPresence(
  teamId: string,
  actor: ActorContext,
): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO presence (team_id, client_id, name, source, last_seen)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(team_id, client_id) DO UPDATE SET
       name = excluded.name,
       source = excluded.source,
       last_seen = excluded.last_seen`,
  ).run(teamId, actor.clientId, actor.name, actor.source, now());
  getEventBus().emit(
    'presence',
    { teamId, clientId: actor.clientId, name: actor.name, source: actor.source },
    teamId,
  );
}

export function writeActivity(input: {
  teamId: string;
  actor: ActorContext;
  op: IntentOp | string;
  targetType: string;
  targetKey?: string | null;
  summary?: Record<string, unknown>;
}): ActivityRow {
  const db = getDb();
  const id = nanoid(12);
  const at = now();
  db.prepare(
    `INSERT INTO activity_log (
      id, team_id, at, actor_name, actor_client_id, actor_source,
      op, target_type, target_key, summary_json, share_token_id, ip
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.teamId,
    at,
    input.actor.name,
    input.actor.clientId,
    input.actor.source,
    input.op,
    input.targetType,
    input.targetKey || null,
    JSON.stringify(input.summary || {}),
    input.actor.shareTokenId || null,
    input.actor.ip || null,
  );

  const row: ActivityRow = {
    id,
    team_id: input.teamId,
    at,
    actor_name: input.actor.name,
    actor_client_id: input.actor.clientId,
    actor_source: input.actor.source,
    op: input.op,
    target_type: input.targetType,
    target_key: input.targetKey || null,
    summary_json: JSON.stringify(input.summary || {}),
    share_token_id: input.actor.shareTokenId || null,
    ip: input.actor.ip || null,
  };

  getEventBus().emit('activity', formatActivity(row), input.teamId);
  return row;
}

export function formatActivity(row: ActivityRow) {
  let summary: Record<string, unknown> = {};
  try {
    summary = JSON.parse(row.summary_json || '{}');
  } catch {
    summary = {};
  }
  return {
    id: row.id,
    teamId: row.team_id,
    at: row.at,
    actorName: row.actor_name,
    actorClientId: row.actor_client_id,
    actorSource: row.actor_source,
    op: row.op,
    targetType: row.target_type,
    targetKey: row.target_key,
    summary,
    text: renderActivityText(row, summary),
  };
}

export function renderActivityText(
  row: ActivityRow,
  summary: Record<string, unknown>,
): string {
  const who = row.actor_name || 'Someone';
  const label =
    (summary.alias as string) ||
    (summary.title as string) ||
    row.target_key ||
    '';
  switch (row.op) {
    case 'create_team':
      return `${who} 创建了团队 ${summary.name || label}`;
    case 'update_jql':
      return `${who} 更新了团队 JQL`;
    case 'import':
      return `${who} 导入了 ${(summary.quarters as string[])?.join(', ') || '数据'}，${summary.count || 0} 项`;
    case 'schedule':
      return `${who} 把 ${label} 排进了 Gantt`;
    case 'unschedule':
      return `${who} 把 ${label} 退回 Backlog`;
    case 'move':
      return `${who} 把 ${label} 从 ${summary.from || '?'} 移到 ${summary.to || '?'}`;
    case 'resize':
      return `${who} 调整了 ${label} 的时长到 ${summary.days || '?'} 天`;
    case 'set_alias':
      return `${who} 把 ${summary.key || row.target_key} 备注名为 ${summary.alias || label}`;
    case 'add_item':
      return `${who} 新建了${summary.type ? `${summary.type} ` : ''}条目 ${label}`;
    case 'delete_item':
      return `${who} 删除了手动条目 ${label}`;
    case 'resolve_item':
      return `${who} 把 ${label} 创建为 ${summary.jiraKey || ''}`;
    case 'add_sub':
      return `${who} 给 ${summary.parent || row.target_key} 加了${summary.temp ? '草稿' : ''}任务 ${label}`;
    case 'delete_sub':
      return `${who} 删除了任务 ${label}`;
    case 'resolve_draft':
      return `${who} 将草稿 ${label} 创建为 ${summary.jiraKey || ''}`;
    case 'cleanup':
      return `${who} 清理了 ${summary.count || 0} 个过期任务`;
    case 'lock':
      return `${who} 正在编辑 ${label}`;
    default:
      return `${who} 执行了 ${row.op}${label ? ` · ${label}` : ''}`;
  }
}

export function listActivity(
  teamId: string,
  limit = 100,
): ReturnType<typeof formatActivity>[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT * FROM activity_log WHERE team_id = ? ORDER BY at DESC LIMIT ?`,
    )
    .all(teamId, limit) as ActivityRow[];
  return rows.map(formatActivity);
}

export function pruneOldActivity(): number {
  const db = getDb();
  const cutoff = now() - config.activityRetentionDays * 86_400_000;
  const result = db
    .prepare(`DELETE FROM activity_log WHERE at < ?`)
    .run(cutoff);
  return result.changes;
}

function getItem(teamId: string, key: string): ItemRow | null {
  const db = getDb();
  return (
    (db
      .prepare(`SELECT * FROM items WHERE team_id = ? AND key = ?`)
      .get(teamId, key) as ItemRow | undefined) || null
  );
}

/**
 * Find the row already holding a Jira key. Used by import to recognise a manual
 * item whose Jira issue we created earlier, instead of inserting a duplicate.
 */
function getItemByJiraKey(teamId: string, jiraKey: string): ItemRow | null {
  const db = getDb();
  return (
    (db
      .prepare(`SELECT * FROM items WHERE team_id = ? AND jira_key = ?`)
      .get(teamId, jiraKey) as ItemRow | undefined) || null
  );
}

/** Manual items keep this synthetic key forever; the real Jira key lands in `jira_key`. */
function generateLocalItemKey(teamId: string): string {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const key = `LOCAL-${nanoid(8)}`;
    if (!getItem(teamId, key)) return key;
  }
  return `LOCAL-${nanoid(12)}`;
}

function bumpItemVersion(teamId: string, key: string, baseVersion: number) {
  const item = getItem(teamId, key);
  if (!item) {
    return { ok: false as const, error: 'item_not_found' };
  }
  if (item.version !== baseVersion) {
    return {
      ok: false as const,
      error: 'version_conflict',
      current: mapItem(
        item,
        (getDb()
          .prepare(`SELECT * FROM subs WHERE team_id = ? AND item_key = ?`)
          .all(teamId, key) as SubRow[]),
      ),
    };
  }
  return { ok: true as const, item };
}

export function applyIntent(
  teamId: string,
  intent: Record<string, unknown>,
  actor: ActorContext,
):
  | { ok: true; snapshot: TeamSnapshot; itemKey?: string }
  | { ok: false; error: string; current?: unknown } {
  const team = getTeam(teamId);
  if (!team) return { ok: false, error: 'team_not_found' };

  const op = String(intent.op || '') as IntentOp;
  const db = getDb();
  const ts = now();
  touchPresence(teamId, actor);
  /** Set by `add_item` so the caller can locate the row it just created. */
  let createdItemKey: string | null = null;

  if (op === 'update_jql') {
    db.prepare(
      `UPDATE teams SET jql = ?, version = version + 1, updated_at = ? WHERE id = ?`,
    ).run(String(intent.jql || ''), ts, teamId);
    writeActivity({
      teamId,
      actor,
      op,
      targetType: 'team',
      targetKey: teamId,
      summary: { jql: intent.jql },
    });
  } else if (op === 'import') {
    const items = Array.isArray(intent.items) ? intent.items : [];
    const overwrite = Boolean(intent.overwrite);
    const quarters = Array.isArray(intent.quarters)
      ? intent.quarters.map(String)
      : [];
    if (overwrite && quarters.length) {
      const placeholders = quarters.map(() => '?').join(',');
      // Manual items are never owned by the import, so an overwrite must leave
      // them (and their subs) alone even when they sit in the same quarter.
      const doomed = (
        db
          .prepare(
            `SELECT key FROM items
             WHERE team_id = ? AND source = 'jira' AND quarter IN (${placeholders})`,
          )
          .all(teamId, ...quarters) as Array<{ key: string }>
      ).map((row) => row.key);
      if (doomed.length) {
        const keyPlaceholders = doomed.map(() => '?').join(',');
        db.prepare(
          `DELETE FROM subs WHERE team_id = ? AND item_key IN (${keyPlaceholders})`,
        ).run(teamId, ...doomed);
        db.prepare(
          `DELETE FROM items WHERE team_id = ? AND key IN (${keyPlaceholders})`,
        ).run(teamId, ...doomed);
      }
    }
    let imported = 0;
    for (const raw of items) {
      const item = raw as Record<string, unknown>;
      const key = String(item.key || '');
      if (!key) continue;
      // A manual item whose Jira issue we already created shows up in the JQL
      // results under its real key — update that row instead of duplicating it.
      const existing = getItem(teamId, key) || getItemByJiraKey(teamId, key);
      if (existing && !overwrite) continue;
      const projectKey =
        (item.projectKey ? String(item.projectKey) : null) ||
        projectKeyFromJiraKey(key);
      if (existing) {
        db.prepare(
          `UPDATE items SET
            type = ?, title = ?, quarter = ?, estimate = ?,
            target_start = ?, target_end = ?, source = 'jira', jira_key = ?,
            project_key = COALESCE(?, project_key),
            updated_at = ?, version = version + 1
           WHERE team_id = ? AND key = ?`,
        ).run(
          String(item.type || 'Epic'),
          String(item.title || key),
          item.quarter ? String(item.quarter) : null,
          typeof item.estimate === 'number' ? item.estimate : null,
          item.targetStart ? String(item.targetStart) : null,
          item.targetEnd ? String(item.targetEnd) : null,
          key,
          projectKey,
          ts,
          teamId,
          existing.key,
        );
      } else {
        db.prepare(
          `INSERT INTO items (
            id, team_id, key, type, title, alias, quarter, estimate,
            target_start, target_end, scheduled, start_date, days, lane,
            expanded, source, jira_key, project_key, version, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, 0, NULL, NULL, 0, 0, 'jira', ?, ?, 1, ?, ?)`,
        ).run(
          nanoid(12),
          teamId,
          key,
          String(item.type || 'Epic'),
          String(item.title || key),
          item.quarter ? String(item.quarter) : null,
          typeof item.estimate === 'number' ? item.estimate : null,
          item.targetStart ? String(item.targetStart) : null,
          item.targetEnd ? String(item.targetEnd) : null,
          key,
          projectKey,
          ts,
          ts,
        );
      }
      imported += 1;
    }
    // Only mark quarters as imported when we actually received items (or overwrite cleared them).
    // Empty imports used to poison importedQuarters and hide the Import button.
    const importedQuarters = Array.from(
      new Set([
        ...parseJsonArray(team.imported_quarters_json).filter((q) => {
          if (!quarters.includes(q)) return true;
          // keep previous imported quarter only if overwrite didn't empty it with zero items
          return !(overwrite && imported === 0);
        }),
        ...(imported > 0 ? quarters : []),
      ]),
    );
    const checkedQuarters = Array.isArray(intent.checkedQuarters)
      ? intent.checkedQuarters.map(String)
      : parseJsonArray(team.checked_quarters_json);
    db.prepare(
      `UPDATE teams SET
        checked_quarters_json = ?,
        imported_quarters_json = ?,
        version = version + 1,
        updated_at = ?
       WHERE id = ?`,
    ).run(
      JSON.stringify(checkedQuarters),
      JSON.stringify(importedQuarters),
      ts,
      teamId,
    );
    writeActivity({
      teamId,
      actor,
      op,
      targetType: 'team',
      targetKey: teamId,
      summary: { quarters, count: imported },
    });
  } else if (op === 'schedule' || op === 'move' || op === 'resize') {
    const key = String(intent.itemKey || '');
    const baseVersion = Number(intent.baseVersion);
    const check = bumpItemVersion(teamId, key, baseVersion);
    if (!check.ok) return check;
    const before = check.item;
    db.prepare(
      `UPDATE items SET
        scheduled = 1,
        start_date = ?,
        days = ?,
        lane = COALESCE(?, lane),
        version = version + 1,
        updated_at = ?
       WHERE team_id = ? AND key = ?`,
    ).run(
      intent.start ? String(intent.start) : before.start_date,
      typeof intent.days === 'number' ? intent.days : before.days,
      typeof intent.lane === 'number' ? intent.lane : null,
      ts,
      teamId,
      key,
    );
    writeActivity({
      teamId,
      actor,
      op,
      targetType: 'item',
      targetKey: key,
      summary: {
        title: before.title,
        alias: before.alias,
        from: before.start_date,
        to: intent.start || before.start_date,
        days: intent.days ?? before.days,
      },
    });
  } else if (op === 'unschedule') {
    const key = String(intent.itemKey || '');
    const baseVersion = Number(intent.baseVersion);
    const check = bumpItemVersion(teamId, key, baseVersion);
    if (!check.ok) return check;
    db.prepare(
      `UPDATE items SET
        scheduled = 0, start_date = NULL, days = NULL, expanded = 0,
        version = version + 1, updated_at = ?
       WHERE team_id = ? AND key = ?`,
    ).run(ts, teamId, key);
    writeActivity({
      teamId,
      actor,
      op,
      targetType: 'item',
      targetKey: key,
      summary: { title: check.item.title, alias: check.item.alias },
    });
  } else if (op === 'set_alias') {
    const key = String(intent.itemKey || intent.subId || '');
    if (intent.subId) {
      const sub = db
        .prepare(`SELECT * FROM subs WHERE team_id = ? AND id = ?`)
        .get(teamId, String(intent.subId)) as SubRow | undefined;
      if (!sub) return { ok: false, error: 'sub_not_found' };
      if (sub.version !== Number(intent.baseVersion)) {
        return { ok: false, error: 'version_conflict', current: sub };
      }
      db.prepare(
        `UPDATE subs SET alias = ?, version = version + 1, updated_at = ? WHERE id = ?`,
      ).run(intent.alias ? String(intent.alias) : null, ts, sub.id);
      writeActivity({
        teamId,
        actor,
        op,
        targetType: 'sub',
        targetKey: sub.id,
        summary: { alias: intent.alias, title: sub.title, key: sub.jira_key },
      });
    } else {
      const check = bumpItemVersion(teamId, key, Number(intent.baseVersion));
      if (!check.ok) return check;
      db.prepare(
        `UPDATE items SET alias = ?, version = version + 1, updated_at = ?
         WHERE team_id = ? AND key = ?`,
      ).run(intent.alias ? String(intent.alias) : null, ts, teamId, key);
      writeActivity({
        teamId,
        actor,
        op,
        targetType: 'item',
        targetKey: key,
        summary: { alias: intent.alias, title: check.item.title, key },
      });
    }
  } else if (op === 'expand' || op === 'collapse') {
    const key = String(intent.itemKey || '');
    const check = bumpItemVersion(teamId, key, Number(intent.baseVersion));
    if (!check.ok) return check;
    db.prepare(
      `UPDATE items SET expanded = ?, version = version + 1, updated_at = ?
       WHERE team_id = ? AND key = ?`,
    ).run(op === 'expand' ? 1 : 0, ts, teamId, key);
  } else if (op === 'add_item') {
    const title = String(intent.title || '').trim();
    if (!title) return { ok: false, error: 'title_required' };
    const hints = buildJqlHints({
      jql: team.jql,
      modeItemType: modeItemType(teamId),
    });
    const key = generateLocalItemKey(teamId);
    const type =
      String(intent.type || '').trim() || hints.itemType || 'Epic';
    const projectKey =
      String(intent.projectKey || '').trim() || hints.projectKey || null;
    db.prepare(
      `INSERT INTO items (
        id, team_id, key, type, title, alias, quarter, estimate,
        target_start, target_end, scheduled, start_date, days, lane,
        expanded, source, jira_key, project_key, version, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, 0, NULL, NULL, 0, 0, 'manual', NULL, ?, 1, ?, ?)`,
    ).run(
      nanoid(12),
      teamId,
      key,
      type,
      title,
      intent.quarter ? String(intent.quarter) : null,
      typeof intent.estimate === 'number' ? intent.estimate : null,
      intent.targetStart ? String(intent.targetStart) : null,
      intent.targetEnd ? String(intent.targetEnd) : null,
      projectKey,
      ts,
      ts,
    );
    createdItemKey = key;
    writeActivity({
      teamId,
      actor,
      op,
      targetType: 'item',
      targetKey: key,
      summary: { title, type, quarter: intent.quarter || null, projectKey },
    });
  } else if (op === 'delete_item') {
    const key = String(intent.itemKey || '');
    const item = getItem(teamId, key);
    if (!item) return { ok: false, error: 'item_not_found' };
    // Once a real Jira issue exists the row is no longer ours to throw away.
    if (normalizeSource(item.source) !== 'manual' || item.jira_key) {
      return { ok: false, error: 'item_has_jira' };
    }
    db.prepare(`DELETE FROM subs WHERE team_id = ? AND item_key = ?`).run(
      teamId,
      key,
    );
    db.prepare(`DELETE FROM items WHERE team_id = ? AND key = ?`).run(
      teamId,
      key,
    );
    writeActivity({
      teamId,
      actor,
      op,
      targetType: 'item',
      targetKey: key,
      summary: { title: item.title, alias: item.alias },
    });
  } else if (op === 'resolve_item') {
    // Deliberately no OCC check: the Jira issue already exists at this point, so
    // a concurrent drag bumping the version must never cost us the key.
    const key = String(intent.itemKey || '');
    const jiraKey = String(intent.jiraKey || '').trim();
    if (!jiraKey) return { ok: false, error: 'jira_key_required' };
    const item = getItem(teamId, key);
    if (!item) return { ok: false, error: 'item_not_found' };
    const type = String(intent.type || '').trim() || item.type;
    const projectKey =
      String(intent.projectKey || '').trim() ||
      item.project_key ||
      projectKeyFromJiraKey(jiraKey);
    const unchanged =
      item.jira_key === jiraKey &&
      item.type === type &&
      item.project_key === projectKey;
    if (!unchanged) {
      db.prepare(
        `UPDATE items SET
          jira_key = ?, type = ?, project_key = ?,
          version = version + 1, updated_at = ?
         WHERE team_id = ? AND key = ?`,
      ).run(jiraKey, type, projectKey, ts, teamId, key);
      writeActivity({
        teamId,
        actor,
        op,
        targetType: 'item',
        targetKey: key,
        summary: { title: item.title, alias: item.alias, jiraKey, type },
      });
    }
  } else if (op === 'add_sub') {
    const itemKey = String(intent.itemKey || '');
    const item = getItem(teamId, itemKey);
    if (!item) return { ok: false, error: 'item_not_found' };
    const id = nanoid(12);
    db.prepare(
      `INSERT INTO subs (
        id, team_id, item_key, jira_key, title, alias, owner,
        start_date, days, is_draft, created_by, version, created_at, updated_at
      ) VALUES (?, ?, ?, NULL, ?, NULL, ?, ?, ?, 1, ?, 1, ?, ?)`,
    ).run(
      id,
      teamId,
      itemKey,
      String(intent.title || 'Untitled'),
      intent.owner ? String(intent.owner) : null,
      intent.start ? String(intent.start) : item.start_date,
      typeof intent.days === 'number' ? intent.days : 3,
      actor.name,
      ts,
      ts,
    );
    if (intent.owner) {
      ensureMember(teamId, String(intent.owner));
    }
    writeActivity({
      teamId,
      actor,
      op,
      targetType: 'sub',
      targetKey: id,
      summary: {
        title: intent.title,
        parent: item.alias || item.title,
        temp: true,
      },
    });
  } else if (op === 'delete_sub') {
    const subId = String(intent.subId || '');
    const sub = db
      .prepare(`SELECT * FROM subs WHERE team_id = ? AND id = ?`)
      .get(teamId, subId) as SubRow | undefined;
    if (!sub) return { ok: false, error: 'sub_not_found' };
    db.prepare(`DELETE FROM subs WHERE id = ?`).run(subId);
    writeActivity({
      teamId,
      actor,
      op,
      targetType: 'sub',
      targetKey: subId,
      summary: { title: sub.title },
    });
  } else if (op === 'resolve_draft') {
    // Two callers write the same mapping: the extension resolves each child the
    // moment its issue exists, and the page re-sends the batch afterwards. Like
    // `resolve_item`, a repeat must be a no-op rather than a second version bump
    // and a duplicate activity line.
    const mappings = Array.isArray(intent.mappings) ? intent.mappings : [];
    for (const raw of mappings) {
      const mapping = raw as { draftId?: string; jiraKey?: string };
      if (!mapping.draftId || !mapping.jiraKey) continue;
      const sub = db
        .prepare(`SELECT * FROM subs WHERE team_id = ? AND id = ?`)
        .get(teamId, mapping.draftId) as SubRow | undefined;
      if (!sub) continue;
      if (sub.jira_key === mapping.jiraKey && !sub.is_draft) continue;
      db.prepare(
        `UPDATE subs SET jira_key = ?, is_draft = 0, version = version + 1, updated_at = ?
         WHERE id = ?`,
      ).run(mapping.jiraKey, ts, sub.id);
      writeActivity({
        teamId,
        actor,
        op,
        targetType: 'sub',
        targetKey: sub.id,
        summary: { title: sub.title, jiraKey: mapping.jiraKey },
      });
    }
  } else if (op === 'cleanup') {
    const expiredKeys = Array.isArray(intent.itemKeys)
      ? intent.itemKeys.map(String)
      : [];
    const expiredSubIds = Array.isArray(intent.subIds)
      ? intent.subIds.map(String)
      : [];
    for (const key of expiredKeys) {
      db.prepare(
        `UPDATE items SET
          scheduled = 0, start_date = NULL, days = NULL, expanded = 0,
          version = version + 1, updated_at = ?
         WHERE team_id = ? AND key = ?`,
      ).run(ts, teamId, key);
    }
    for (const subId of expiredSubIds) {
      db.prepare(`DELETE FROM subs WHERE team_id = ? AND id = ?`).run(
        teamId,
        subId,
      );
    }
    writeActivity({
      teamId,
      actor,
      op,
      targetType: 'team',
      targetKey: teamId,
      summary: { count: expiredKeys.length + expiredSubIds.length },
    });
  } else if (op === 'add_member') {
    ensureMember(teamId, String(intent.name || ''), String(intent.avatarColor || ''));
  } else if (op === 'remove_member') {
    db.prepare(`DELETE FROM members WHERE team_id = ? AND id = ?`).run(
      teamId,
      String(intent.memberId || ''),
    );
  } else if (op === 'lock') {
    const targetType = String(intent.targetType || 'item');
    const targetKey = String(intent.targetKey || '');
    db.prepare(
      `INSERT INTO soft_locks (
        team_id, target_type, target_key, actor_name, actor_client_id, locked_at, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(team_id, target_type, target_key) DO UPDATE SET
        actor_name = excluded.actor_name,
        actor_client_id = excluded.actor_client_id,
        locked_at = excluded.locked_at,
        expires_at = excluded.expires_at`,
    ).run(
      teamId,
      targetType,
      targetKey,
      actor.name,
      actor.clientId,
      ts,
      ts + config.softLockTtlMs,
    );
    getEventBus().emit(
      'lock',
      {
        teamId,
        targetType,
        targetKey,
        actorName: actor.name,
        actorClientId: actor.clientId,
        expiresAt: ts + config.softLockTtlMs,
      },
      teamId,
    );
  } else if (op === 'unlock') {
    db.prepare(
      `DELETE FROM soft_locks
       WHERE team_id = ? AND target_type = ? AND target_key = ? AND actor_client_id = ?`,
    ).run(
      teamId,
      String(intent.targetType || 'item'),
      String(intent.targetKey || ''),
      actor.clientId,
    );
    getEventBus().emit(
      'unlock',
      {
        teamId,
        targetType: intent.targetType,
        targetKey: intent.targetKey,
        actorClientId: actor.clientId,
      },
      teamId,
    );
  } else if (op === 'set_quarters') {
    db.prepare(
      `UPDATE teams SET checked_quarters_json = ?, version = version + 1, updated_at = ?
       WHERE id = ?`,
    ).run(JSON.stringify(intent.checkedQuarters || []), ts, teamId);
  } else {
    return { ok: false, error: `unsupported_op:${op}` };
  }

  const snapshot = getTeamSnapshot(teamId)!;
  getEventBus().emit('snapshot', snapshot, teamId);
  getEventBus().emit('intent', { op, intent, actor }, teamId);
  return createdItemKey
    ? { ok: true, snapshot, itemKey: createdItemKey }
    : { ok: true, snapshot };
}

const AV_COLORS = [
  '#5B8DEF',
  '#E4708A',
  '#57A773',
  '#B08BD9',
  '#E0A458',
  '#4FA3A5',
  '#C97B5A',
];

function ensureMember(teamId: string, name: string, color = ''): void {
  const trimmed = name.trim();
  if (!trimmed) return;
  const db = getDb();
  const existing = db
    .prepare(`SELECT id FROM members WHERE team_id = ? AND name = ?`)
    .get(teamId, trimmed);
  if (existing) return;
  db.prepare(
    `INSERT INTO members (id, team_id, name, avatar_color, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(
    nanoid(10),
    teamId,
    trimmed,
    color || AV_COLORS[Math.floor(Math.random() * AV_COLORS.length)],
    now(),
  );
}

/** Focus items currently on Gantt for a team (for extension sync). */
export function listFocusItems(teamId: string) {
  const snapshot = getTeamSnapshot(teamId);
  if (!snapshot) return [];
  return snapshot.items
    .filter((item) => item.scheduled)
    .map((item) => {
      const jiraKey =
        item.jiraKey || (item.source === 'jira' ? item.key : null);
      return {
        key: item.key,
        jiraKey,
        source: item.source,
        isDraft: !jiraKey,
        type: item.type,
        title: item.title,
        alias: item.alias,
        displayName: item.alias || truncateTitle(item.title, item.key),
        quarter: item.quarter,
        targetStart: item.targetStart,
        targetEnd: item.targetEnd,
        start: item.start,
        days: item.days,
        // The synthetic LOCAL-xxx key never appears in a message, so it would
        // only pollute the generated watch rules.
        keywords: [
          jiraKey,
          item.alias,
          ...item.subs.map((s) => s.alias || s.title).filter(Boolean),
        ].filter(Boolean),
        hasAlias: Boolean(item.alias),
        subCount: item.subs.length,
        priorityHints: {
          hasAlias: Boolean(item.alias),
          subActivity: item.subs.length > 0,
          intersectsCurrentMonth: intersectsCurrentMonth(item.start, item.days),
        },
      };
    });
}

function truncateTitle(title: string, key: string): string {
  const cleaned = title.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= 12) return cleaned || key;
  return `${cleaned.slice(0, 10)}…`;
}

function intersectsCurrentMonth(
  start: string | null | undefined,
  days: number | null | undefined,
): boolean {
  if (!start || !days) return false;
  const s = new Date(start);
  const e = new Date(s.getTime() + days * 86_400_000);
  const nowDate = new Date();
  const mStart = new Date(nowDate.getFullYear(), nowDate.getMonth(), 1);
  const mEnd = new Date(nowDate.getFullYear(), nowDate.getMonth() + 1, 0);
  return s <= mEnd && e >= mStart;
}
