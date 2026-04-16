import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';

import { WorkerCheckpointRepository } from '../repositories/WorkerCheckpointRepository.js';
import type { ReflectionThreadRecord } from '../repositories/ReflectionThreadRepository.js';
import type { UserDataManager } from '../storage/UserDataManager.js';
import { getUserRuntimeConfig } from '../runtimeConfig.js';
import { now } from '../utils/time.js';
import { ReflectionThreadService } from './ReflectionThreadService.js';

interface IdRow<T = string | number> {
  id: T;
}

export interface ReflectionPlannerResult {
  threadsTouched: number;
  runsCreated: number;
  actionsQueued: number;
  checkpointFrom: number;
  checkpointTo: number;
  skipped?: boolean;
  reason?: string;
}

export class ReflectionPlanner {
  private readonly checkpoints: WorkerCheckpointRepository;
  private readonly service: ReflectionThreadService;

  constructor(
    private readonly db: Database.Database,
    private readonly userDataManager?: UserDataManager,
    private readonly userId?: string,
  ) {
    this.checkpoints = new WorkerCheckpointRepository(db);
    this.service = new ReflectionThreadService(db, userDataManager, userId);
  }

  async runHeartbeat(): Promise<ReflectionPlannerResult> {
    const runtimeConfig = getUserRuntimeConfig(this.userDataManager);
    if (!runtimeConfig.reflectionEnabled) {
      const checkpoint = this.checkpoints.getTimestamp(
        `reflection-planner:${this.userId ?? 'default'}:cursor`,
        0,
      );
      return {
        threadsTouched: 0,
        runsCreated: 0,
        actionsQueued: 0,
        checkpointFrom: checkpoint,
        checkpointTo: checkpoint,
        skipped: true,
        reason: 'reflection_disabled',
      };
    }

    const ownerId = randomUUID();
    const leaseKey = `reflection-planner:${this.userId ?? 'default'}`;
    const checkpointKey = `${leaseKey}:cursor`;
    const topicLimit = runtimeConfig.reflectionActiveTopicLimit;

    if (!this.checkpoints.acquireLease(leaseKey, ownerId, 5 * 60)) {
      return {
        threadsTouched: 0,
        runsCreated: 0,
        actionsQueued: 0,
        checkpointFrom: this.checkpoints.getTimestamp(checkpointKey, 0),
        checkpointTo: this.checkpoints.getTimestamp(checkpointKey, 0),
        skipped: true,
        reason: 'lease_unavailable',
      };
    }

    const checkpointFrom = this.checkpoints.getTimestamp(checkpointKey, 0);
    const baseline = checkpointFrom > 0 ? checkpointFrom : now() - 24 * 3600;
    const checkpointTo = now();

    try {
      let threadsTouched = 0;
      let runsCreated = 0;
      let actionsQueued = 0;

      const confirmRequestIds = this.db
        .prepare(
          `SELECT id
           FROM confirm_requests
           WHERE created_at > ?
             AND state = 'pending'
             AND COALESCE(routing, 'decision') = 'decision'
           ORDER BY created_at ASC
           LIMIT ?`,
        )
        .all(baseline, topicLimit * 2) as Array<IdRow<string>>;
      for (const row of confirmRequestIds) {
        if (this.service.ingestConfirmRequest(row.id)) {
          threadsTouched++;
        }
      }

      const propertyIds = this.db
        .prepare(
          `SELECT id
           FROM entity_properties
           WHERE tx_start > ? AND status = 'active'
           ORDER BY tx_start ASC
           LIMIT ?`,
        )
        .all(baseline, topicLimit * 3) as Array<IdRow<number>>;
      for (const row of propertyIds) {
        if (this.service.ingestEntityPropertySignal(row.id)) {
          threadsTouched++;
        }
      }

      const profileIds = this.db
        .prepare(
          `SELECT id
           FROM user_profile_items
           WHERE updated_at > ? AND status = 'active' AND salience_score >= 0.72
           ORDER BY updated_at ASC
           LIMIT ?`,
        )
        .all(baseline, topicLimit * 2) as Array<IdRow<string>>;
      for (const row of profileIds) {
        if (this.service.ingestProfileSignal(row.id)) {
          threadsTouched++;
        }
      }

      const messageIds = this.db
        .prepare(
          `SELECT id
           FROM messages_raw
           WHERE created_at > ? AND importance >= 0.75
           ORDER BY created_at ASC
           LIMIT ?`,
        )
        .all(baseline, topicLimit * 3) as Array<IdRow<string>>;
      for (const row of messageIds) {
        if (this.service.ingestMessageSignal(row.id)) {
          threadsTouched++;
        }
      }

      const dueThreads = this.service.listDueThreads(topicLimit);
      for (const thread of dueThreads) {
        const blockingReason = this.service.getHeartbeatBlockingReason(
          thread.id,
        );
        if (blockingReason) {
          this.service.deferHeartbeatReflection(thread.id, blockingReason);
          continue;
        }
        const runResult = await this.service.runReflection(thread.id, {
          runType: 'continuous_reflection',
          triggerType: 'heartbeat',
        });
        if (runResult) {
          runsCreated++;
          actionsQueued += runResult.actions.length;
        }
      }

      this.checkpoints.set(checkpointKey, checkpointTo, 'timestamp');

      return {
        threadsTouched,
        runsCreated,
        actionsQueued,
        checkpointFrom: baseline,
        checkpointTo,
      };
    } finally {
      this.checkpoints.releaseLease(leaseKey, ownerId);
    }
  }
}
