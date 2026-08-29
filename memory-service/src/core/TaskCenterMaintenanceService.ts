/**
 * Task Center maintenance sweeps.
 *
 * Two jobs that must happen after tasks reach a terminal state, both written as
 * idempotent scans rather than hooks on markSucceeded/markFailed:
 *
 * 1. Recurrence rollover — clone the next occurrence of a repeating task.
 * 2. Parent aggregation — complete a parent once every child has succeeded.
 *
 * They are scans because runs end through several paths that never touch
 * markSucceeded: cancel(), recoverStaleRunningActions(), and the remote worker
 * report path. A hook on one of them would silently miss the others, which for
 * a recurring task means the series just stops.
 */

import {
  ActionRepository,
  type QueuedActionRecord,
} from '../repositories/ActionRepository.js';
import { isRecurringSchedule, parseNextDispatch } from './scheduleSpec.js';
import { now } from '../utils/time.js';

export interface TaskCenterSweepResult {
  rolledOver: number;
  seriesEnded: number;
  parentsCompleted: number;
}

/** Occurrence suffix keeps each run's idempotency key unique but deterministic. */
export function buildOccurrenceIdempotencyKey(
  baseKey: string | undefined,
  actionId: string,
  nextScheduledAt: number,
): string {
  const base = baseKey?.trim() || `task:${actionId}`;
  // Strip any previous occurrence suffix so a long-running series does not
  // accumulate ":occ:...:occ:..." and drift past the column's usable length.
  const root = base.replace(/:occ:\d+$/, '');
  return `${root}:occ:${nextScheduledAt}`;
}

/**
 * Decide the next occurrence for a finished recurring task.
 * Returns null when the series has ended (repeatCount reached, endDate passed,
 * or the spec no longer describes a repeat).
 */
export function computeNextOccurrence(
  action: QueuedActionRecord,
  currentTime = now(),
): { scheduledAt: number; dispatchCount: number } | null {
  const spec = action.recurrenceSpec;
  if (!spec || !isRecurringSchedule(spec)) return null;

  const dispatchCount = Number(spec.dispatchCount);
  const nextDispatchCount = (Number.isFinite(dispatchCount) ? dispatchCount : 0) + 1;

  // repeatCount is not handled by the schedule interpreter (OutreachRepository
  // owns it for outreach templates), so the ledger counts its own occurrences.
  const repeatCount = Number(spec.repeatCount);
  if (Number.isFinite(repeatCount) && repeatCount > 0 && nextDispatchCount >= repeatCount) {
    return null;
  }

  // Baseline off this occurrence's own scheduled time when we have it, so a
  // late or retried run does not push the whole series forward.
  const baseline = action.scheduledAt ?? action.finishedAt ?? currentTime;
  const nextScheduledAt = parseNextDispatch(spec, baseline);
  if (!nextScheduledAt || nextScheduledAt <= baseline) return null;

  return { scheduledAt: nextScheduledAt, dispatchCount: nextDispatchCount };
}

export class TaskCenterMaintenanceService {
  private readonly actionRepo: ActionRepository;

  constructor(private readonly db: any) {
    this.actionRepo = new ActionRepository(db);
  }

  /** Run both sweeps. Safe to call on every drain tick. */
  sweep(limit = 20): TaskCenterSweepResult {
    const recurrence = this.rollRecurringOccurrences(limit);
    const parentsCompleted = this.completeFinishedParents(limit);
    return { ...recurrence, parentsCompleted };
  }

  rollRecurringOccurrences(limit = 20): { rolledOver: number; seriesEnded: number } {
    const pending = this.actionRepo.listRecurringActionsPendingRollover(limit);
    let rolledOver = 0;
    let seriesEnded = 0;

    for (const action of pending) {
      const next = computeNextOccurrence(action);
      if (!next) {
        // Stamp anyway: that is what stops the scan from revisiting a series
        // that has legitimately ended.
        this.actionRepo.markRecurrenceRolledOver(action.id, null);
        seriesEnded += 1;
        continue;
      }

      const created = this.actionRepo.create({
        actionType: action.actionType,
        title: action.title,
        description: action.description,
        params: action.params,
        riskLevel: action.riskLevel,
        confidence: action.confidence,
        evidenceRefs: action.evidenceRefs,
        requiresApproval: action.requiresApproval,
        executionMode: action.executionMode,
        priority: action.priority,
        // A UNIQUE idempotency key is what makes a double sweep harmless: the
        // second create returns the row the first one made.
        idempotencyKey: buildOccurrenceIdempotencyKey(
          action.idempotencyKey,
          action.id,
          next.scheduledAt,
        ),
        dependsOn: action.dependsOn,
        scheduledAt: next.scheduledAt,
        sourceKind: action.sourceKind,
        sourceRefId: action.sourceRefId,
        queueStatus: 'queued',
        parentActionId: action.parentActionId,
        lane: action.lane,
        taskKind: action.taskKind,
        mirrorRef: action.mirrorRef,
        recurrenceSpec: {
          ...action.recurrenceSpec,
          dispatchCount: next.dispatchCount,
          // The successor must not inherit the predecessor's rollover stamp,
          // or it would never roll over itself.
          rolledOverAt: undefined,
          nextActionId: undefined,
        },
      });

      this.actionRepo.markRecurrenceRolledOver(action.id, created.id);
      rolledOver += 1;
    }

    return { rolledOver, seriesEnded };
  }

  completeFinishedParents(limit = 20): number {
    const parents = this.actionRepo.listParentsReadyToComplete(limit);
    let completed = 0;

    for (const parent of parents) {
      const children = this.actionRepo.listChildren(parent.id);
      // Re-check under the same read: listParentsReadyToComplete already
      // filtered, but a child could have been retried between the two queries.
      if (
        children.length === 0 ||
        children.some((child) => child.queueStatus !== 'succeeded')
      ) {
        continue;
      }

      this.actionRepo.markParentCompleted(parent.id, {
        status: 'success',
        summary: `全部 ${children.length} 个子任务已完成`,
        aggregatedFrom: children.map((child) => child.id),
      });
      completed += 1;
    }

    return completed;
  }
}
