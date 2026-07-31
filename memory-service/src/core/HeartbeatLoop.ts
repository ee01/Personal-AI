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
import { formatDate, now } from '../utils/time.js';
import { contentHash } from '../utils/hashing.js';
import {
  ProactivityPolicy,
  type NotificationCandidate,
} from './ProactivityPolicy.js';
import { ProfileManager } from './ProfileManager.js';
import { MarkdownManager } from './MarkdownManager.js';
import type { UserDataManager } from '../storage/UserDataManager.js';
import { WorkerCheckpointRepository } from '../repositories/WorkerCheckpointRepository.js';
import { ConfirmRequestRepository } from '../repositories/ConfirmRequestRepository.js';
import { ReflectionPlanner } from './ReflectionPlanner.js';
import { ActionExecutor } from './actions/ActionExecutor.js';
import { getUserRuntimeConfig } from '../runtimeConfig.js';
import type { RuntimePushTarget } from '../runtimeConfig.js';
import { NotificationCenterService } from './NotificationCenterService.js';
import { SourceMemoryDistillationWorker } from './SourceMemoryDistillationWorker.js';

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

type DreamDigestScheduleType = 'weekly' | 'every_x_days' | 'monthly';

interface DreamDigestRuntimeConfig {
  enabled: boolean;
  scheduleType: DreamDigestScheduleType;
  intervalDays: number;
  pushTarget: RuntimePushTarget;
  pushGroupId: string;
}

interface DreamDigestScopeReceipt {
  periodStart: number;
  periodEnd: number;
  periodLabel: string;
  includedCount: number;
  includedDreamPaths: string[];
  excludedOlderCount: number;
  excludedUndatedCount: number;
  excludedFutureCount: number;
  skippedUnreadableCount: number;
  boundary: 'current_digest_period_only';
}

export interface DreamDigestPushResult {
  generated: boolean;
  delivered: boolean;
  botSent: boolean;
  notificationCreated?: boolean;
  dreamCount?: number;
  latestDreamPath?: string;
  botError?: string;
  pushTarget?: RuntimePushTarget;
  reason?: string;
}

function normalizeDigestPushTarget(
  value: unknown,
  fallback: RuntimePushTarget,
): RuntimePushTarget {
  if (value === 'group' || value === 'team') return 'group';
  if (value === 'me' || value === 'user') return 'me';
  if (value === 'none') return 'none';
  return fallback;
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
  private userId?: string;
  private checkpointRepo: WorkerCheckpointRepository;
  private notificationCenterService: NotificationCenterService;

  constructor(
    db: Database.Database,
    userDataManager?: UserDataManager,
    userId?: string,
  ) {
    this.db = db;
    this.policy = new ProactivityPolicy(db);
    this.profileManager = new ProfileManager(db);
    this.userDataManager = userDataManager;
    this.markdownManager = userDataManager?.isInitialized
      ? new MarkdownManager(db, userDataManager.rootDir)
      : undefined;
    this.userId = userId;
    this.checkpointRepo = new WorkerCheckpointRepository(db);
    this.notificationCenterService = new NotificationCenterService(db);
  }

  // ---- Main entry point ---------------------------------------------------

  /**
   * Execute one heartbeat cycle. This is idempotent and safe to call
   * on any interval; it uses `lastHeartbeat` to avoid reprocessing.
   */
  async run(): Promise<HeartbeatResult> {
    const checkedAt = now();
    this.lastHeartbeat = this.getLastHeartbeatCheckpoint();
    const actions: string[] = [];
    const allCandidates: NotificationCandidate[] = [];
    let updated = 0;

    try {
      // 1. Micro-consolidate new messages
      const newMessages = this.fetchNewMessages();
      if (newMessages.length > 0) {
        const microUpdates = await this.microConsolidate(newMessages);
        updated += microUpdates;
        actions.push(
          `micro-consolidated ${newMessages.length} messages (${microUpdates} updates)`,
        );
      }

      // 1b. Check if user profile needs a snapshot refresh
      const profileRefreshed = await this.checkProfileDirty();
      if (profileRefreshed) {
        actions.push('refreshed USER_CORE.md (profile dirty)');
      }

      // 2. Check pending truth conflicts
      const confirmRepo = new ConfirmRequestRepository(this.db);
      const decisionSnoozeLifecycle =
        confirmRepo.processDecisionSnoozeLifecycle(checkedAt);
      if (
        decisionSnoozeLifecycle.resumed > 0 ||
        decisionSnoozeLifecycle.expired > 0
      ) {
        actions.push(
          `decision snooze lifecycle resumed ${decisionSnoozeLifecycle.resumed}, expired ${decisionSnoozeLifecycle.expired}`,
        );
      }
      const watchLifecycle = confirmRepo.processWatchLifecycle(checkedAt);
      if (watchLifecycle.resnoozed > 0 || watchLifecycle.expired > 0) {
        actions.push(
          `watch lifecycle resnoozed ${watchLifecycle.resnoozed}, expired ${watchLifecycle.expired}`,
        );
      }
      const dedupeSummary = confirmRepo.dedupePendingRequests();
      if (dedupeSummary.mergedRequests > 0) {
        actions.push(
          `confirm dedupe merged ${dedupeSummary.mergedRequests} request(s) across ${dedupeSummary.duplicateGroups} group(s)`,
        );
      }

      // 2. Check pending truth conflicts
      const conflictCandidates = this.checkPendingConflicts();
      if (conflictCandidates.length > 0) {
        allCandidates.push(...conflictCandidates);
        actions.push(
          `found ${conflictCandidates.length} stale truth conflict(s)`,
        );
      }

      // 2b. Check new confirm requests (created since last heartbeat)
      const newConflictCandidates = this.checkNewConflicts();
      if (newConflictCandidates.length > 0) {
        allCandidates.push(...newConflictCandidates);
        actions.push(`found ${newConflictCandidates.length} new conflict(s)`);
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

      // 5b. Continuous reflection planner/worker
      const reflectionPlanner = new ReflectionPlanner(
        this.db,
        this.userDataManager,
        this.userId,
      );
      const reflectionResult = await reflectionPlanner.runHeartbeat();
      if (
        !reflectionResult.skipped &&
        (reflectionResult.threadsTouched > 0 ||
          reflectionResult.runsCreated > 0)
      ) {
        actions.push(
          `reflection planner touched ${reflectionResult.threadsTouched} thread(s), created ${reflectionResult.runsCreated} run(s), queued ${reflectionResult.actionsQueued} action(s)`,
        );
      }

      // 5c. Process bounded Source Memory deep-distillation work.
      try {
        const distillationResult = await new SourceMemoryDistillationWorker(this.db, {
          userId: this.userId,
        }).runDueJobs(2);
        if (distillationResult.claimed > 0) {
          actions.push(
            `source-memory distillation claimed ${distillationResult.claimed}: ready ${distillationResult.ready}, blocked ${distillationResult.blocked}, retrying ${distillationResult.retrying}, failed ${distillationResult.failed}`,
          );
        }
      } catch (error) {
        console.warn(
          '[HeartbeatLoop] Source Memory distillation skipped:',
          error instanceof Error ? error.message : String(error),
        );
      }

      // 5d. Execute due auto actions from reflection/action runtime
      const actionExecutor = new ActionExecutor(
        this.db,
        this.userDataManager,
        this.userId,
      );
      const actionResults = await actionExecutor.runDueActions(10);
      if (actionResults.length > 0) {
        actions.push(`executed ${actionResults.length} queued action(s)`);
      }

      // 6. Apply ProactivityPolicy to filter candidates
      const approved = await this.policy.filterNotifications(allCandidates);

      // 7. Deliver approved notifications
      if (approved.length > 0) {
        const delivered = this.deliverNotifications(approved);
        actions.push(`delivered ${approved.length} notification(s)`);
        const dreamDigestConfig = this.getDreamDigestRuntimeConfig();
        for (const item of delivered) {
          if (
            item.type === 'dream_digest' &&
            item.payload?.digestBody &&
            dreamDigestConfig.pushTarget !== 'none'
          ) {
            await this.notificationCenterService.deliverNoticeToGlip({
              sourceRef: `notification:${item.id}`,
              title: 'Weekly Dream Digest',
              body: String(item.payload.digestBody),
              mention: false,
              targetUserId:
                dreamDigestConfig.pushTarget === 'me' ? this.userId : undefined,
              targetGroupId:
                dreamDigestConfig.pushTarget === 'group'
                  ? dreamDigestConfig.pushGroupId
                  : undefined,
            });
          }
        }
      }

      // 8. Update heartbeat timestamp
      this.lastHeartbeat = checkedAt;
      this.persistHeartbeatCheckpoint(checkedAt);

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
      this.persistHeartbeatCheckpoint(checkedAt);

      return { actions, notifications: [], updated, checkedAt };
    }
  }

  private getLastHeartbeatCheckpoint(): number {
    const userKey = this.userId ?? 'default';
    return this.checkpointRepo.getTimestamp(`heartbeat:${userKey}`, 0);
  }

  private persistHeartbeatCheckpoint(timestamp: number): void {
    const userKey = this.userId ?? 'default';
    this.checkpointRepo.set(`heartbeat:${userKey}`, timestamp, 'timestamp');
  }

  /**
   * Manually trigger a dream digest push immediately.
   *
   * This bypasses normal schedule window checks and idempotency guards,
   * so it is suitable for explicit user-triggered "push now" actions.
   * @param userId - Used to derive target email (e.g. esone.qiu -> esone.qiu@ringcentral.com)
   */
  async triggerDreamDigestNow(
    userId?: string,
    options?: {
      pushTarget?: RuntimePushTarget;
      pushGroupId?: string;
    },
  ): Promise<DreamDigestPushResult> {
    const runtimeConfig = this.getDreamDigestRuntimeConfig();
    const pushTarget = normalizeDigestPushTarget(
      options?.pushTarget,
      runtimeConfig.pushTarget,
    );
    const pushGroupId = (
      options?.pushGroupId ?? runtimeConfig.pushGroupId
    ).trim();
    const candidate = this.buildDreamDigestCandidate({
      ignoreScheduleWindow: true,
      ignoreIdempotency: true,
      ignorePushDisabled: true,
      manual: true,
    });

    if (!candidate) {
      console.log(
        '[DreamDigest] push-now: no candidate (no current-period dream content or userDataManager)',
      );
      return {
        generated: false,
        delivered: false,
        botSent: false,
        pushTarget,
        reason: 'No dream content available for the current digest period.',
      };
    }

    if (pushTarget === 'none') {
      return {
        generated: true,
        delivered: false,
        botSent: false,
        notificationCreated: false,
        dreamCount:
          typeof candidate.payload?.dreamCount === 'number'
            ? candidate.payload.dreamCount
            : undefined,
        latestDreamPath:
          typeof candidate.payload?.latestDreamPath === 'string'
            ? candidate.payload.latestDreamPath
            : undefined,
        pushTarget,
      };
    }

    const delivered = this.deliverNotifications([candidate]);
    const notificationCreated = Boolean(delivered[0]);

    let botSent = false;
    let botError: string | undefined;
    if (candidate.payload?.digestBody && delivered[0]) {
      console.log('[DreamDigest] push-now: sending to Bot...');
      const botResult =
        await this.notificationCenterService.deliverNoticeToGlip({
          sourceRef: `notification:${delivered[0].id}`,
          title: 'Weekly Dream Digest',
          body: String(candidate.payload.digestBody),
          mention: false,
          targetUserId: pushTarget === 'me' ? userId ?? this.userId : undefined,
          targetGroupId: pushTarget === 'group' ? pushGroupId : undefined,
        });
      if (botResult.sent) {
        botSent = true;
        console.log('[DreamDigest] push-now: botSent=true');
      } else if (botResult.error) {
        console.warn(`[DreamDigest] push-now: ${botResult.error}`);
        botError = botResult.error;
      }
    } else {
      console.warn(
        '[DreamDigest] push-now: digestBody empty, skipping Bot send',
      );
      botError = delivered[0]
        ? 'digest_body_empty'
        : 'notification_not_created';
    }

    return {
      generated: true,
      delivered: notificationCreated,
      botSent,
      notificationCreated,
      dreamCount:
        typeof candidate.payload?.dreamCount === 'number'
          ? candidate.payload.dreamCount
          : undefined,
      latestDreamPath:
        typeof candidate.payload?.latestDreamPath === 'string'
          ? candidate.payload.latestDreamPath
          : undefined,
      botError,
      pushTarget,
    };
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
              const result = updateEntityStmt.run(
                currentTime,
                currentTime,
                ent.id,
              );
              updates += result.changes;
            } else {
              const result = updateEntityByNameStmt.run(
                currentTime,
                currentTime,
                ent.name,
              );
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
        .prepare(
          "SELECT profile_dirty, last_snapshot_at FROM profile_sync_state WHERE id = 'singleton'",
        )
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
         WHERE state = 'pending'
           AND COALESCE(routing, 'decision') = 'decision'
           AND created_at < ?
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

  /**
   * Check for newly created confirm_requests since last heartbeat
   * and push Bot notifications for them.
   */
  private checkNewConflicts(): NotificationCandidate[] {
    const newRequests = this.db
      .prepare(
        `SELECT id, question, context, related_entity_id, state, created_at
         FROM confirm_requests
         WHERE state = 'pending'
           AND COALESCE(routing, 'decision') = 'decision'
           AND created_at > ?
         ORDER BY created_at ASC`,
      )
      .all(this.lastHeartbeat) as ConfirmRequestRow[];

    return newRequests.map((req) => ({
      type: 'new_conflict',
      title: '新的认知冲突需要决策',
      body: req.question,
      importance: 0.75,
      urgency: 0.7,
      confidence: 0.9,
      actionability: 0.9,
      topicId: `new_confirm_${req.id}`,
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
      const significance =
        Math.min(matchCount * 0.2, 1) * (0.5 + 0.5 * normalizedPriority);

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
  private deliverNotifications(notifications: NotificationCandidate[]): Array<{
    id: string;
    type: string;
    title: string;
    body: string;
    payload?: Record<string, unknown>;
  }> {
    const currentTime = now();
    const delivered: Array<{
      id: string;
      type: string;
      title: string;
      body: string;
      payload?: Record<string, unknown>;
    }> = [];

    const insertStmt = this.db.prepare(
      `INSERT INTO notification_records
        (id, channel, type, title, body, payload_json, topic_id,
         related_entity_id, utility_score, sent_at, created_at)
       VALUES (?, 'chrome_notification', ?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
    );

    for (const notif of notifications) {
      try {
        const notificationId = randomUUID();
        insertStmt.run(
          notificationId,
          notif.type,
          notif.title,
          notif.body,
          notif.payload ? JSON.stringify(notif.payload) : null,
          notif.topicId ?? null,
          notif.relatedEntityId ?? null,
          currentTime,
          currentTime,
        );
        delivered.push({
          id: notificationId,
          type: notif.type,
          title: notif.title,
          body: notif.body,
          payload: notif.payload,
        });
      } catch (err) {
        console.error(
          `[HeartbeatLoop] Failed to deliver notification "${notif.title}":`,
          err instanceof Error ? err.message : String(err),
        );
      }
    }

    return delivered;
  }

  // ---- Step 5: Dream digest (Monday morning) ------------------------------

  /**
   * Check if it's Monday morning and there are recent dreams to digest.
   * Generates a dream_digest notification (max once per week).
   */
  private checkDreamDigest(): NotificationCandidate[] {
    const candidate = this.buildDreamDigestCandidate();
    return candidate ? [candidate] : [];
  }

  private buildDreamDigestCandidate(options?: {
    ignoreScheduleWindow?: boolean;
    ignoreIdempotency?: boolean;
    ignorePushDisabled?: boolean;
    manual?: boolean;
  }): NotificationCandidate | null {
    const nowDate = new Date();
    const runtimeConfig = this.getDreamDigestRuntimeConfig();

    if (!options?.ignorePushDisabled && !runtimeConfig.enabled) {
      return null;
    }

    if (
      !options?.ignoreScheduleWindow &&
      !this.isDreamDigestWindow(nowDate, runtimeConfig)
    ) {
      return null;
    }

    if (!options?.ignoreIdempotency) {
      const periodStart = this.getDreamDigestPeriodStart(
        nowDate,
        runtimeConfig,
      );
      const existing = this.db
        .prepare(
          `SELECT id
           FROM notification_records
           WHERE type = 'dream_digest' AND created_at >= ?
           LIMIT 1`,
        )
        .get(periodStart);
      if (existing) return null;
    }

    if (!this.userDataManager) return null;

    const contentPeriodStart = this.getDreamDigestContentPeriodStart(
      nowDate,
      runtimeConfig,
    );
    const contentPeriodEnd = Math.floor(nowDate.getTime() / 1000);
    const dreamFiles = this.userDataManager.listFiles('dreams/');
    if (!dreamFiles || dreamFiles.length === 0) return null;

    const recentDreams: Array<{
      file: string;
      content: string;
      generatedAt: number;
    }> = [];
    let excludedOlderCount = 0;
    let excludedUndatedCount = 0;
    let excludedFutureCount = 0;
    let skippedUnreadableCount = 0;

    for (const file of dreamFiles) {
      if (!file.endsWith('.md')) continue;
      const content = this.userDataManager.readFile(`dreams/${file}`);
      if (!content) {
        skippedUnreadableCount++;
        continue;
      }
      const generatedAt = this.parseDreamGeneratedAt(file, content);
      if (generatedAt === null) {
        excludedUndatedCount++;
        continue;
      }
      if (generatedAt < contentPeriodStart) {
        excludedOlderCount++;
        continue;
      }
      if (generatedAt > contentPeriodEnd) {
        excludedFutureCount++;
        continue;
      }
      recentDreams.push({ file, content, generatedAt });
    }

    if (recentDreams.length === 0) return null;

    recentDreams.sort((a, b) => b.generatedAt - a.generatedAt);

    const digestBody = recentDreams
      .map(({ content }) => {
        const titleMatch =
          content.match(/# Dream: (.+)/) || content.match(/^# (.+)$/m);
        const narrativeMatch = content.match(
          /## Narrative\n([\s\S]*?)(?=\n## |$)/,
        );
        const insightsMatch = content.match(
          /## Insights\n([\s\S]*?)(?=\n## |$)/,
        );
        const title = titleMatch?.[1]?.trim() || 'Untitled';
        const narrative = narrativeMatch?.[1]?.trim().slice(0, 200) || '';
        const insights = insightsMatch?.[1]?.trim() || '';
        return `**${title}**\n${narrative}...\n${insights}`;
      })
      .join('\n\n---\n\n');

    const dateTag = nowDate.toISOString().slice(0, 10);
    const topicId = options?.manual
      ? `dream_digest_manual_${dateTag}_${now()}`
      : `dream_digest_${dateTag}`;
    const dreamDigestScope: DreamDigestScopeReceipt = {
      periodStart: contentPeriodStart,
      periodEnd: contentPeriodEnd,
      periodLabel: `${formatDate(contentPeriodStart)} 至 ${formatDate(
        contentPeriodEnd,
      )}`,
      includedCount: recentDreams.length,
      includedDreamPaths: recentDreams.map(({ file }) => `dreams/${file}`),
      excludedOlderCount,
      excludedUndatedCount,
      excludedFutureCount,
      skippedUnreadableCount,
      boundary: 'current_digest_period_only',
    };

    return {
      type: 'dream_digest',
      title: 'Weekly Dream Digest',
      body: `${recentDreams.length} dream(s) generated this period`,
      importance: 0.8,
      urgency: 0.3,
      confidence: 0.95,
      actionability: 0.4,
      topicId,
      payload: {
        dreamCount: recentDreams.length,
        dreamDigestScope,
        dreamDigestScopeReceipt:
          this.formatDreamDigestScopeReceipt(dreamDigestScope),
        digestBody,
        latestDreamPath: `dreams/${recentDreams[0].file}`,
        dreamPaths: dreamDigestScope.includedDreamPaths,
      },
    };
  }

  private formatDreamDigestScopeReceipt(
    scope: DreamDigestScopeReceipt,
  ): string {
    const exclusions: string[] = [];
    if (scope.excludedOlderCount > 0) {
      exclusions.push(`旧周期 ${scope.excludedOlderCount} 个`);
    }
    if (scope.excludedUndatedCount > 0) {
      exclusions.push(`日期缺失 ${scope.excludedUndatedCount} 个`);
    }
    if (scope.excludedFutureCount > 0) {
      exclusions.push(`未来日期 ${scope.excludedFutureCount} 个`);
    }
    if (scope.skippedUnreadableCount > 0) {
      exclusions.push(`读取失败 ${scope.skippedUnreadableCount} 个`);
    }

    return [
      `覆盖周期：${scope.periodLabel}`,
      `本次纳入：${scope.includedCount} 个梦境文件`,
      exclusions.length > 0
        ? `未纳入：${exclusions.join('，')}`
        : '未纳入：无',
      '边界：这次推送只汇总当前 Dream Digest 周期；旧梦境和日期缺失文件仍可在梦境重放页查看。',
    ].join('\n');
  }

  private getDreamDigestRuntimeConfig(): DreamDigestRuntimeConfig {
    const runtimeConfig = getUserRuntimeConfig(this.userDataManager);
    return {
      enabled: runtimeConfig.dreamDigestEnabled,
      scheduleType: runtimeConfig.dreamDigestScheduleType,
      intervalDays: runtimeConfig.dreamDigestIntervalDays,
      pushTarget: runtimeConfig.dreamDigestPushTarget,
      pushGroupId: runtimeConfig.dreamDigestPushGroupId,
    };
  }

  private isDreamDigestWindow(
    nowDate: Date,
    cfg: DreamDigestRuntimeConfig,
  ): boolean {
    // Shared delivery window: 08:00 <= hour < 10:00 local time.
    if (nowDate.getHours() < 8 || nowDate.getHours() >= 10) {
      return false;
    }

    if (cfg.scheduleType === 'monthly') {
      return this.isFirstMondayOfMonth(nowDate);
    }

    if (cfg.scheduleType === 'every_x_days') {
      // Any day in the window; interval check is done via getDreamDigestPeriodStart
      return true;
    }

    if (nowDate.getDay() !== 1) {
      return false;
    }

    return true; // weekly
  }

  private getDreamDigestPeriodStart(
    nowDate: Date,
    cfg: DreamDigestRuntimeConfig,
  ): number {
    if (cfg.scheduleType === 'monthly') {
      const start = new Date(
        nowDate.getFullYear(),
        nowDate.getMonth(),
        1,
        0,
        0,
        0,
        0,
      );
      return Math.floor(start.getTime() / 1000);
    }

    if (cfg.scheduleType === 'every_x_days') {
      const nowSec = Math.floor(nowDate.getTime() / 1000);
      return nowSec - cfg.intervalDays * 24 * 3600;
    }

    const thisWeekStart = this.getMondayStart(nowDate);
    return Math.floor(thisWeekStart.getTime() / 1000);
  }

  private getDreamDigestContentPeriodStart(
    nowDate: Date,
    cfg: DreamDigestRuntimeConfig,
  ): number {
    if (cfg.scheduleType === 'weekly') {
      const previousWeekStart = this.getMondayStart(nowDate);
      previousWeekStart.setDate(previousWeekStart.getDate() - 7);
      return Math.floor(previousWeekStart.getTime() / 1000);
    }

    return this.getDreamDigestPeriodStart(nowDate, cfg);
  }

  private parseDreamGeneratedAt(
    filename: string,
    content: string,
  ): number | null {
    const generatedMatch = content.match(/^_?Generated:\s*([^_\n]+)_?$/im);
    const generatedValue = generatedMatch?.[1]?.trim();
    if (generatedValue) {
      const parsed = this.parseLocalDateValue(generatedValue);
      if (parsed !== null) return parsed;
    }

    const filenameDate = filename.match(/(\d{4}-\d{2}-\d{2})/);
    if (filenameDate) {
      return this.parseLocalDateValue(filenameDate[1]);
    }

    return null;
  }

  private parseLocalDateValue(value: string): number | null {
    const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateOnly) {
      const date = new Date(
        Number(dateOnly[1]),
        Number(dateOnly[2]) - 1,
        Number(dateOnly[3]),
        0,
        0,
        0,
        0,
      );
      return Math.floor(date.getTime() / 1000);
    }

    return this.parseDateValue(value);
  }

  private isFirstMondayOfMonth(date: Date): boolean {
    if (date.getDay() !== 1) return false;
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
    const firstMondayDate = 1 + ((8 - firstDay.getDay()) % 7);
    return date.getDate() === firstMondayDate;
  }

  private getMondayStart(date: Date): Date {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const mondayOffset = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - mondayOffset);
    return d;
  }

  private getMondayWeekIndex(date: Date): number {
    const weekStart = this.getMondayStart(date);
    const epochMonday = new Date(1970, 0, 5);
    epochMonday.setHours(0, 0, 0, 0);
    return Math.floor(
      (weekStart.getTime() - epochMonday.getTime()) / (7 * 24 * 3600 * 1000),
    );
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
    if (
      !Number.isNaN(numeric) &&
      numeric > 1_000_000_000 &&
      numeric < 10_000_000_000
    ) {
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
