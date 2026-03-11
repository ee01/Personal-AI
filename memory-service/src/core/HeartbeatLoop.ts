/**
 * HeartbeatLoop -- micro-consolidation and proactive notification engine.
 *
 * Runs on a regular interval (default 15 minutes) and performs:
 *   1. Micro-consolidation of new messages (entity updates, deduplication)
 *   2. Pending truth-conflict reminders
 *   3. Watched project update detection
 *   4. Upcoming deadline notifications
 *   5. Proactivity filtering (via ProactivityPolicy)
 *   6. Notification delivery (insert into notification_records)
 */

import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import { now } from '../utils/time.js';
import { contentHash } from '../utils/hashing.js';
import { ProactivityPolicy, type NotificationCandidate } from './ProactivityPolicy.js';
import { ProfileManager } from './ProfileManager.js';
import { MarkdownManager } from './MarkdownManager.js';
import type { UserDataManager } from '../storage/UserDataManager.js';
import { getBotSender } from '../utils/botSender.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HeartbeatResult {
  actions: string[];
  notifications: NotificationCandidate[];
  updated: number;
  checkedAt: number;
}

// ---------------------------------------------------------------------------
// Row shapes for SQLite queries
// ---------------------------------------------------------------------------

interface MessageRow {
  id: string;
  content: string;
  summary: string | null;
  source_type: string;
  sender: string | null;
  group_id: string | null;
  group_name: string | null;
  timestamp: number;
  entities_json: string | null;
  matched_projects_json: string | null;
  importance: number;
  created_at: number;
}

interface ConfirmRequestRow {
  id: string;
  question: string;
  context: string | null;
  related_entity_id: string | null;
  state: string;
  created_at: number;
}

interface WatchedProjectRow {
  id: string;
  entity_id: string | null;
  name: string;
  aliases_json: string | null;
  is_active: number;
  priority: number;
}

interface EntityPropertyRow {
  id: number;
  entity_id: string;
  property_key: string;
  property_value: string;
  value_type: string;
}

interface EntityRow {
  id: string;
  name: string;
}

interface CountRow {
  cnt: number;
}

interface SyncStateRow {
  profile_dirty: number;
  last_snapshot_at: number;
}

interface HighSalienceItemRow {
  id: string;
  item_type: string;
  item_key: string;
  item_value: string;
  salience_score: number;
  updated_at: number;
}

// ---------------------------------------------------------------------------
// HeartbeatLoop
// ---------------------------------------------------------------------------

export class HeartbeatLoop {
  private db: Database.Database;
  private policy: ProactivityPolicy;
  private profileManager: ProfileManager;
  private userDataManager?: UserDataManager;
  private markdownManager?: MarkdownManager;
  private lastHeartbeat: number = 0;

  constructor(db: Database.Database, userDataManager?: UserDataManager) {
    this.db = db;
    this.policy = new ProactivityPolicy(db);
    this.profileManager = new ProfileManager(db);
    this.userDataManager = userDataManager;
    this.markdownManager = userDataManager?.isInitialized
      ? new MarkdownManager(db, userDataManager.rootDir)
      : undefined;
  }

  // ---- Main entry point ---------------------------------------------------

  /**
   * Execute one heartbeat cycle. This is idempotent and safe to call
   * on any interval; it uses `lastHeartbeat` to avoid reprocessing.
   */
  async run(): Promise<HeartbeatResult> {
    const checkedAt = now();
    const actions: string[] = [];
    const allCandidates: NotificationCandidate[] = [];
    let updated = 0;

    try {
      // 1. Micro-consolidate new messages
      const newMessages = this.fetchNewMessages();
      if (newMessages.length > 0) {
        const microUpdates = await this.microConsolidate(newMessages);
        updated += microUpdates;
        actions.push(`micro-consolidated ${newMessages.length} messages (${microUpdates} updates)`);
      }

      // 1b. Check if user profile needs a snapshot refresh
      const profileRefreshed = await this.checkProfileDirty();
      if (profileRefreshed) {
        actions.push('refreshed USER_CORE.md (profile dirty)');
      }

      // 2. Check pending truth conflicts
      const conflictCandidates = this.checkPendingConflicts();
      if (conflictCandidates.length > 0) {
        allCandidates.push(...conflictCandidates);
        actions.push(`found ${conflictCandidates.length} stale truth conflict(s)`);
      }

      // 3. Check watched project updates
      const projectCandidates = this.checkWatchedProjects();
      if (projectCandidates.length > 0) {
        allCandidates.push(...projectCandidates);
        actions.push(`found ${projectCandidates.length} project update(s)`);
      }

      // 4. Check upcoming deadlines
      const deadlineCandidates = await this.checkUpcomingDeadlines();
      if (deadlineCandidates.length > 0) {
        allCandidates.push(...deadlineCandidates);
        actions.push(`found ${deadlineCandidates.length} upcoming deadline(s)`);
      }

      // 5. Check dream digest (Monday morning)
      const dreamCandidates = this.checkDreamDigest();
      if (dreamCandidates.length > 0) {
        allCandidates.push(...dreamCandidates);
        actions.push('dream digest ready for delivery');
      }

      // 6. Apply ProactivityPolicy to filter candidates
      const approved = await this.policy.filterNotifications(allCandidates);

      // 7. Deliver approved notifications
      if (approved.length > 0) {
        this.deliverNotifications(approved);
        actions.push(`delivered ${approved.length} notification(s)`);
      }

      // 7b. Bot push for dream digest
      for (const notif of approved) {
        if (notif.type === 'dream_digest' && notif.payload?.digestBody) {
          const botSender = getBotSender();
          if (botSender.isConfigured()) {
            await botSender.sendMarkdown(
              'Weekly Dream Digest',
              notif.payload.digestBody as string,
              { mention: false },
            );
          }
        }
      }

      // 8. Update heartbeat timestamp
      this.lastHeartbeat = checkedAt;

      console.log(
        `[HeartbeatLoop] Cycle complete: ${actions.length} action(s), ${approved.length} notification(s)`,
      );

      return { actions, notifications: approved, updated, checkedAt };
    } catch (err) {
      console.error(
        '[HeartbeatLoop] Error during heartbeat cycle:',
        err instanceof Error ? err.message : String(err),
      );

      // Still advance the heartbeat so we don't reprocess on crash-loop
      this.lastHeartbeat = checkedAt;

      return { actions, notifications: [], updated, checkedAt };
    }
  }

  // ---- Step 1: Micro-consolidation ---------------------------------------

  /**
   * Fetch messages created since the last heartbeat.
   */
  private fetchNewMessages(): MessageRow[] {
    return this.db
      .prepare(
        `SELECT id, content, summary, source_type, sender, group_id, group_name,
                timestamp, entities_json, matched_projects_json, importance, created_at
         FROM messages_raw
         WHERE created_at > ?
         ORDER BY created_at ASC`,
      )
      .all(this.lastHeartbeat) as MessageRow[];
  }

  /**
   * Perform micro-consolidation on a batch of new messages:
   *  - Update mention_count and last_seen for mentioned entities
   *  - Detect near-duplicate messages by content hash
   *
   * Returns the number of database updates made.
   */
  private async microConsolidate(messages: MessageRow[]): Promise<number> {
    let updates = 0;
    const currentTime = now();
    const seenHashes = new Set<string>();

    const updateEntityStmt = this.db.prepare(
      `UPDATE entities
       SET mention_count = mention_count + 1,
           last_seen = ?,
           updated_at = ?
       WHERE id = ?`,
    );

    const updateEntityByNameStmt = this.db.prepare(
      `UPDATE entities
       SET mention_count = mention_count + 1,
           last_seen = ?,
           updated_at = ?
       WHERE name = ? AND status = 'active'`,
    );

    for (const msg of messages) {
      // Update entity mention counts and last_seen
      if (msg.entities_json) {
        try {
          const entities = JSON.parse(msg.entities_json) as Array<{
            type: string;
            name: string;
            id?: string;
          }>;

          for (const ent of entities) {
            if (ent.id) {
              const result = updateEntityStmt.run(currentTime, currentTime, ent.id);
              updates += result.changes;
            } else {
              const result = updateEntityByNameStmt.run(currentTime, currentTime, ent.name);
              updates += result.changes;
            }
          }
        } catch {
          // Malformed JSON in entities_json; skip silently
        }
      }

      // Near-duplicate detection by content hash
      const hash = contentHash(msg.content.trim().toLowerCase());
      if (seenHashes.has(hash)) {
        console.warn(
          `[HeartbeatLoop] Near-duplicate message detected: ${msg.id}`,
        );
      }
      seenHashes.add(hash);
    }

    return updates;
  }

  // ---- Step 1b: Profile dirty check --------------------------------------

  /**
   * Check the profile_sync_state table for profile_dirty = 1.
   * If dirty, query top-5 highest-salience user_profile_items updated since
   * last_snapshot_at, compare against current USER_CORE.md, and regenerate
   * if new high-salience items are found that are not yet included.
   *
   * Returns true if USER_CORE.md was regenerated.
   */
  private async checkProfileDirty(): Promise<boolean> {
    try {
      const syncState = this.db
        .prepare("SELECT profile_dirty, last_snapshot_at FROM profile_sync_state WHERE id = 'singleton'")
        .get() as SyncStateRow | undefined;

      if (!syncState || syncState.profile_dirty !== 1) {
        return false;
      }

      const lastSnapshot = syncState.last_snapshot_at;

      // Query top-5 highest-salience items updated since last snapshot
      const recentItems = this.db
        .prepare(
          `SELECT id, item_type, item_key, item_value, salience_score, updated_at
           FROM user_profile_items
           WHERE status = 'active' AND updated_at > ?
           ORDER BY salience_score DESC
           LIMIT 5`,
        )
        .all(lastSnapshot) as HighSalienceItemRow[];

      if (recentItems.length === 0) {
        // No new items — clear dirty flag and return
        this.clearProfileDirty();
        return false;
      }

      // Read existing USER_CORE.md to check if items are already present
      let existingContent = '';
      if (this.userDataManager) {
        existingContent = this.userDataManager.readFile('USER_CORE.md') ?? '';
      }

      const lowerExisting = existingContent.toLowerCase();
      const missingItems = recentItems.filter(
        (item) => !lowerExisting.includes(item.item_value.toLowerCase()),
      );

      if (missingItems.length === 0) {
        // All high-salience items already in USER_CORE.md — just clear the flag
        this.clearProfileDirty();
        return false;
      }

      // Regenerate USER_CORE.md via ProfileManager (per-user via UserDataManager)
      const rendered = this.profileManager.renderUserCore(10);
      this.userDataManager?.writeFile('USER_CORE.md', rendered);
      await this.markdownManager?.reindexFile('USER_CORE.md');

      // Clear dirty flag and update last_snapshot_at
      this.clearProfileDirty();

      console.log(
        `[HeartbeatLoop] Refreshed USER_CORE.md — ${missingItems.length} new high-salience item(s): ` +
          missingItems.map((i) => `${i.item_key}=${i.item_value}`).join(', '),
      );

      return true;
    } catch (err) {
      console.error(
        '[HeartbeatLoop] Error checking profile dirty flag:',
        err instanceof Error ? err.message : String(err),
      );
      return false;
    }
  }

  /**
   * Clear the profile dirty flag and update last_snapshot_at to current time.
   */
  private clearProfileDirty(): void {
    const currentTime = now();
    this.db
      .prepare(
        `UPDATE profile_sync_state
         SET profile_dirty = 0, last_snapshot_at = ?
         WHERE id = 'singleton'`,
      )
      .run(currentTime);
  }

  // ---- Step 2: Pending truth conflicts -----------------------------------

  /**
   * Check for confirm_requests that have been pending for over 24 hours
   * and generate reminder notifications for them.
   */
  private checkPendingConflicts(): NotificationCandidate[] {
    const oneDayAgo = now() - 86_400;

    const staleRequests = this.db
      .prepare(
        `SELECT id, question, context, related_entity_id, state, created_at
         FROM confirm_requests
         WHERE state = 'pending' AND created_at < ?
         ORDER BY created_at ASC`,
      )
      .all(oneDayAgo) as ConfirmRequestRow[];

    return staleRequests.map((req) => ({
      type: 'truth_conflict',
      title: 'Pending truth conflict needs attention',
      body: req.question,
      importance: 0.7,
      urgency: 0.6,
      confidence: 0.9,
      actionability: 0.8,
      topicId: `confirm_${req.id}`,
      relatedEntityId: req.related_entity_id ?? undefined,
      payload: { confirmRequestId: req.id, context: req.context },
    }));
  }

  // ---- Step 3: Watched project updates -----------------------------------

  /**
   * For each active watched project, count new messages matching its name
   * or aliases since the last heartbeat. If the significance exceeds the
   * threshold (0.6), generate a project-update notification.
   */
  private checkWatchedProjects(): NotificationCandidate[] {
    const candidates: NotificationCandidate[] = [];

    const projects = this.db
      .prepare(
        `SELECT id, entity_id, name, aliases_json, is_active, priority
         FROM watched_projects
         WHERE is_active = 1`,
      )
      .all() as WatchedProjectRow[];

    for (const project of projects) {
      const matchCount = this.countProjectMessages(project);

      if (matchCount === 0) continue;

      // Significance heuristic: normalize count and scale by priority
      // priority is 1-10, higher = more important
      const normalizedPriority = Math.min(project.priority / 10, 1);
      const significance = Math.min(matchCount * 0.2, 1) * (0.5 + 0.5 * normalizedPriority);

      if (significance >= 0.6) {
        candidates.push({
          type: 'project_update',
          title: `Updates on "${project.name}"`,
          body: `${matchCount} new message(s) since last check`,
          importance: significance,
          urgency: 0.4,
          confidence: 0.85,
          actionability: 0.5,
          topicId: `project_${project.id}`,
          relatedEntityId: project.entity_id ?? undefined,
          payload: { projectId: project.id, messageCount: matchCount },
        });
      }
    }

    return candidates;
  }

  /**
   * Count messages since lastHeartbeat that match a watched project's name
   * or aliases (by checking matched_projects_json).
   */
  private countProjectMessages(project: WatchedProjectRow): number {
    // First try matched_projects_json (most reliable)
    const row = this.db
      .prepare(
        `SELECT COUNT(*) AS cnt
         FROM messages_raw
         WHERE created_at > ?
           AND matched_projects_json LIKE ?`,
      )
      .get(this.lastHeartbeat, `%${project.id}%`) as CountRow | undefined;

    let count = row?.cnt ?? 0;

    // Also match by project name in content (fallback)
    if (count === 0) {
      const nameRow = this.db
        .prepare(
          `SELECT COUNT(*) AS cnt
           FROM messages_raw
           WHERE created_at > ?
             AND content LIKE ?`,
        )
        .get(this.lastHeartbeat, `%${project.name}%`) as CountRow | undefined;

      count = nameRow?.cnt ?? 0;
    }

    return count;
  }

  // ---- Step 4: Upcoming deadlines ----------------------------------------

  /**
   * Search entity_properties for date-type values within the next 48 hours
   * and return them as notification candidates.
   */
  private async checkUpcomingDeadlines(): Promise<NotificationCandidate[]> {
    const candidates: NotificationCandidate[] = [];
    const currentTime = now();
    const horizon = currentTime + 48 * 3600; // 48 hours from now

    // Fetch all date-type properties that are currently active
    const dateProps = this.db
      .prepare(
        `SELECT ep.id, ep.entity_id, ep.property_key, ep.property_value, ep.value_type
         FROM entity_properties ep
         WHERE ep.value_type = 'date'
           AND ep.status = 'active'
           AND ep.tx_end IS NULL`,
      )
      .all() as EntityPropertyRow[];

    for (const prop of dateProps) {
      const deadlineTs = this.parseDateValue(prop.property_value);
      if (deadlineTs === null) continue;

      // Check if the deadline falls within the next 48 hours
      if (deadlineTs > currentTime && deadlineTs <= horizon) {
        const hoursUntil = Math.round((deadlineTs - currentTime) / 3600);

        // Look up the entity name for a better notification title
        const entity = this.db
          .prepare(`SELECT id, name FROM entities WHERE id = ?`)
          .get(prop.entity_id) as EntityRow | undefined;

        const entityName = entity?.name ?? prop.entity_id;
        const urgency = hoursUntil <= 12 ? 0.9 : hoursUntil <= 24 ? 0.7 : 0.5;

        candidates.push({
          type: 'deadline',
          title: `Upcoming deadline: ${entityName}`,
          body: `"${prop.property_key}" is due in ${hoursUntil} hour(s)`,
          importance: 0.8,
          urgency,
          confidence: 0.95,
          actionability: 0.7,
          topicId: `deadline_${prop.entity_id}_${prop.property_key}`,
          relatedEntityId: prop.entity_id,
          payload: {
            propertyId: prop.id,
            propertyKey: prop.property_key,
            deadlineTs,
            hoursUntil,
          },
        });
      }
    }

    return candidates;
  }

  // ---- Step 6: Notification delivery -------------------------------------

  /**
   * Insert approved notification candidates into the notification_records table.
   */
  private deliverNotifications(notifications: NotificationCandidate[]): void {
    const currentTime = now();

    const insertStmt = this.db.prepare(
      `INSERT INTO notification_records
        (id, channel, type, title, body, payload_json, topic_id,
         related_entity_id, utility_score, sent_at, created_at)
       VALUES (?, 'chrome_notification', ?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
    );

    for (const notif of notifications) {
      try {
        insertStmt.run(
          randomUUID(),
          notif.type,
          notif.title,
          notif.body,
          notif.payload ? JSON.stringify(notif.payload) : null,
          notif.topicId ?? null,
          notif.relatedEntityId ?? null,
          currentTime,
          currentTime,
        );
      } catch (err) {
        console.error(
          `[HeartbeatLoop] Failed to deliver notification "${notif.title}":`,
          err instanceof Error ? err.message : String(err),
        );
      }
    }
  }

  // ---- Step 5: Dream digest (Monday morning) ------------------------------

  /**
   * Check if it's Monday morning and there are recent dreams to digest.
   * Generates a dream_digest notification (max once per week).
   */
  private checkDreamDigest(): NotificationCandidate[] {
    const nowDate = new Date();
    // Only on Monday 08:00-10:00
    if (nowDate.getDay() !== 1 || nowDate.getHours() < 8 || nowDate.getHours() >= 10) {
      return [];
    }

    // Check idempotency: no dream_digest in last 7 days
    const sevenDaysAgo = now() - 7 * 86400;
    const existing = this.db
      .prepare(
        `SELECT id FROM notification_records WHERE type = 'dream_digest' AND created_at > ? LIMIT 1`,
      )
      .get(sevenDaysAgo);

    if (existing) return [];

    // Find recent dream files
    if (!this.userDataManager) return [];

    const dreamFiles = this.userDataManager.listFiles('dreams/');
    if (!dreamFiles || dreamFiles.length === 0) return [];

    // Read dream file contents (only .md files)
    const recentDreams: string[] = [];
    for (const file of dreamFiles) {
      if (!file.endsWith('.md')) continue;
      const content = this.userDataManager.readFile(`dreams/${file}`);
      if (!content) continue;
      recentDreams.push(content);
    }

    if (recentDreams.length === 0) return [];

    // Extract summaries from dream content
    const digestBody = recentDreams
      .map((content) => {
        const titleMatch = content.match(/# Dream: (.+)/);
        const narrativeMatch = content.match(/## Narrative\n([\s\S]*?)(?=\n## |$)/);
        const insightsMatch = content.match(/## Insights\n([\s\S]*?)(?=\n## |$)/);
        const title = titleMatch?.[1] || 'Untitled';
        const narrative = narrativeMatch?.[1]?.trim().slice(0, 200) || '';
        const insights = insightsMatch?.[1]?.trim() || '';
        return `**${title}**\n${narrative}...\n${insights}`;
      })
      .join('\n\n---\n\n');

    return [
      {
        type: 'dream_digest',
        title: 'Weekly Dream Digest',
        body: `${recentDreams.length} dream(s) generated this week`,
        importance: 0.8,
        urgency: 0.3,
        confidence: 0.95,
        actionability: 0.4,
        topicId: `dream_digest_${nowDate.toISOString().slice(0, 10)}`,
        payload: { dreamCount: recentDreams.length, digestBody },
      },
    ];
  }

  // ---- Utility helpers ----------------------------------------------------

  /**
   * Attempt to parse a date string or Unix timestamp (seconds) into
   * a Unix epoch (seconds). Returns null if unparseable.
   *
   * Supports:
   *  - ISO 8601 strings ("2025-06-15", "2025-06-15T09:00:00Z")
   *  - Numeric strings that look like epoch seconds
   */
  private parseDateValue(value: string): number | null {
    // Try as numeric epoch (seconds)
    const numeric = Number(value);
    if (!Number.isNaN(numeric) && numeric > 1_000_000_000 && numeric < 10_000_000_000) {
      return numeric;
    }

    // Try as ISO date string
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) {
      return Math.floor(parsed / 1000);
    }

    return null;
  }
}
