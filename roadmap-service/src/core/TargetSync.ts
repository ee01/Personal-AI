import { config } from '../config.js';
import { getDb } from '../storage/Database.js';
import type { ActorContext, ItemRow } from '../types.js';
import {
  addIsoDays,
  jiraUpdateTargetDates,
  JiraHttpError,
} from './JiraClient.js';

const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
const pendingActors = new Map<string, ActorContext>();

const DEBOUNCE_MS = 1500;

function mapKey(teamId: string, itemKey: string) {
  return `${teamId}:${itemKey}`;
}

/**
 * Debounced side-path using server JIRA_PAT. Returns whether the sync was
 * queued; when Jira is not configured, returns skipped (silent no-op).
 */
export function queueTargetSync(
  teamId: string,
  itemKey: string,
  actor: ActorContext,
): { queued: boolean; skipped?: string } {
  if (!config.jira.enabled) {
    return { queued: false, skipped: 'jira_not_configured' };
  }
  const key = mapKey(teamId, itemKey);
  pendingActors.set(key, actor);
  const existing = debounceTimers.get(key);
  if (existing) clearTimeout(existing);
  debounceTimers.set(
    key,
    setTimeout(() => {
      debounceTimers.delete(key);
      const who = pendingActors.get(key) || actor;
      pendingActors.delete(key);
      void flushTargetSync(teamId, itemKey, who);
    }, DEBOUNCE_MS),
  );
  return { queued: true };
}

/** Test helper — clear pending timers without flushing. */
export function clearTargetSyncQueue(): void {
  for (const t of debounceTimers.values()) clearTimeout(t);
  debounceTimers.clear();
  pendingActors.clear();
}

/** Test helper — run due syncs immediately (skips remaining debounce). */
export async function flushAllTargetSyncs(): Promise<void> {
  const keys = [...debounceTimers.keys()];
  for (const k of keys) {
    const timer = debounceTimers.get(k);
    if (timer) clearTimeout(timer);
    debounceTimers.delete(k);
    const [teamId, ...rest] = k.split(':');
    const itemKey = rest.join(':');
    const actor = pendingActors.get(k);
    pendingActors.delete(k);
    if (actor) await flushTargetSync(teamId, itemKey, actor);
  }
}

async function flushTargetSync(
  teamId: string,
  itemKey: string,
  actor: ActorContext,
): Promise<void> {
  if (!config.jira.enabled) return;
  const db = getDb();
  const item = db
    .prepare(`SELECT * FROM items WHERE team_id = ? AND key = ?`)
    .get(teamId, itemKey) as ItemRow | undefined;
  if (!item?.jira_key || !item.start_date || !item.days) return;

  const start = item.start_date;
  const end = addIsoDays(start, Math.max(1, item.days) - 1);
  const jiraKey = item.jira_key;

  // Dynamic import avoids a load-time cycle with TeamService → TargetSync.
  const { writeActivity, getTeamSnapshot } = await import('./TeamService.js');
  const { getEventBus } = await import('./EventBus.js');

  try {
    await jiraUpdateTargetDates(jiraKey, start, end);
    const ts = Date.now();
    db.prepare(
      `UPDATE items SET target_start = ?, target_end = ?, updated_at = ?
       WHERE team_id = ? AND key = ?`,
    ).run(start, end, ts, teamId, itemKey);

    writeActivity({
      teamId,
      actor,
      op: 'jira_sync',
      targetType: 'item',
      targetKey: itemKey,
      summary: {
        title: item.title,
        alias: item.alias,
        jiraKey,
        start,
        end,
      },
    });

    const snapshot = getTeamSnapshot(teamId);
    if (snapshot) getEventBus().emit('snapshot', snapshot, teamId);
  } catch (err) {
    const status = err instanceof JiraHttpError ? err.status : 0;
    const snippet =
      err instanceof JiraHttpError
        ? err.bodySnippet
        : err instanceof Error
          ? err.message
          : String(err);
    writeActivity({
      teamId,
      actor,
      op: 'jira_sync_failed',
      targetType: 'item',
      targetKey: itemKey,
      summary: {
        title: item.title,
        alias: item.alias,
        jiraKey,
        start,
        end,
        status,
        error: snippet.slice(0, 200),
      },
    });
  }
}
