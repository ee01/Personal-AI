import { beforeEach, describe, expect, it } from 'vitest';

import { ActionRepository } from '../repositories/ActionRepository.js';
import {
  TaskCenterMaintenanceService,
  buildOccurrenceIdempotencyKey,
  computeNextOccurrence,
} from '../core/TaskCenterMaintenanceService.js';
import { getTestDb } from './setup.js';

describe('Task Center maintenance sweeps', () => {
  const db = getTestDb();
  const repo = new ActionRepository(db);
  const service = new TaskCenterMaintenanceService(db);

  beforeEach(() => {
    db.prepare('DELETE FROM proposed_action_attempts').run();
    db.prepare('DELETE FROM proposed_actions').run();
  });

  const DAILY = {
    scheduleDate: '2026-03-02', // a Monday
    scheduleTime: '09:00',
    repeatEvery: 1,
    repeatUnit: 'Day',
    timezone: 'Asia/Shanghai',
  };

  function createRecurring(overrides: Record<string, unknown> = {}) {
    return repo.create({
      actionType: 'delegate_agent',
      title: 'daily push',
      executionMode: 'auto',
      requiresApproval: false,
      taskKind: 'push',
      lane: 'memory_cron',
      recurrenceSpec: DAILY,
      idempotencyKey: 'jira_rule:msg_1:adhoc',
      ...overrides,
    });
  }

  function finish(id: string, how: 'succeeded' | 'failed' | 'cancelled' = 'succeeded') {
    if (how === 'cancelled') {
      repo.cancel(id);
      return;
    }
    const attempt = repo.markRunning(id);
    if (how === 'succeeded') repo.markSucceeded(id, attempt, { status: 'success' });
    else repo.markFailed(id, attempt, 'boom');
  }

  describe('recurrence rollover', () => {
    it('clones the next occurrence after a run succeeds', () => {
      const first = createRecurring({ scheduledAt: Math.floor(Date.UTC(2026, 2, 2, 1) / 1000) });
      finish(first.id);

      const result = service.rollRecurringOccurrences();
      expect(result.rolledOver).toBe(1);

      const successors = repo
        .list({ queueStatus: 'queued', limit: 50 })
        .items.filter((a) => a.id !== first.id);
      expect(successors).toHaveLength(1);
      expect(successors[0].scheduledAt).toBeGreaterThan(first.scheduledAt!);
      expect(successors[0].taskKind).toBe('push');
      expect(successors[0].lane).toBe('memory_cron');
      expect(successors[0].recurrenceSpec?.dispatchCount).toBe(1);
    });

    it('rolls over after failure too, so one bad run does not end the series', () => {
      const first = createRecurring({ scheduledAt: Math.floor(Date.UTC(2026, 2, 2, 1) / 1000) });
      finish(first.id, 'failed');
      expect(service.rollRecurringOccurrences().rolledOver).toBe(1);
    });

    it('rolls over a cancelled occurrence — cancel never calls markFailed', () => {
      const first = createRecurring({ scheduledAt: Math.floor(Date.UTC(2026, 2, 2, 1) / 1000) });
      finish(first.id, 'cancelled');
      expect(service.rollRecurringOccurrences().rolledOver).toBe(1);
    });

    it('is idempotent: a second sweep creates no duplicate', () => {
      const first = createRecurring({ scheduledAt: Math.floor(Date.UTC(2026, 2, 2, 1) / 1000) });
      finish(first.id);
      service.rollRecurringOccurrences();
      const after = service.rollRecurringOccurrences();
      expect(after.rolledOver).toBe(0);
      expect(repo.list({ queueStatus: 'all', limit: 50 }).items).toHaveLength(2);
    });

    it('never rolls a task that has not finished', () => {
      createRecurring({ scheduledAt: Math.floor(Date.UTC(2026, 2, 2, 1) / 1000) });
      expect(service.rollRecurringOccurrences().rolledOver).toBe(0);
    });

    it('ends the series once repeatCount is reached', () => {
      const first = createRecurring({
        scheduledAt: Math.floor(Date.UTC(2026, 2, 2, 1) / 1000),
        recurrenceSpec: { ...DAILY, repeatCount: 2, dispatchCount: 1 },
      });
      finish(first.id);
      const result = service.rollRecurringOccurrences();
      expect(result.rolledOver).toBe(0);
      expect(result.seriesEnded).toBe(1);
      expect(repo.list({ queueStatus: 'all', limit: 50 }).items).toHaveLength(1);
    });

    it('ends the series past endDate', () => {
      const first = createRecurring({
        scheduledAt: Math.floor(Date.UTC(2026, 2, 2, 1) / 1000),
        recurrenceSpec: { ...DAILY, endDate: '2026-03-02' },
      });
      finish(first.id);
      expect(service.rollRecurringOccurrences().seriesEnded).toBe(1);
    });

    it('leaves one-shot tasks alone', () => {
      const oneShot = repo.create({
        actionType: 'delegate_agent',
        title: 'one shot',
        executionMode: 'auto',
        requiresApproval: false,
      });
      finish(oneShot.id);
      expect(service.rollRecurringOccurrences().rolledOver).toBe(0);
    });

    it('gives the successor a distinct idempotency key that does not nest', () => {
      const key = buildOccurrenceIdempotencyKey('jira_rule:msg_1:occ:100', 'a1', 200);
      expect(key).toBe('jira_rule:msg_1:occ:200');
    });

    it('does not advance the series when the run was merely late', () => {
      const scheduledAt = Math.floor(Date.UTC(2026, 2, 2, 1) / 1000);
      const action = repo.create({
        actionType: 'delegate_agent',
        title: 'late run',
        executionMode: 'auto',
        requiresApproval: false,
        recurrenceSpec: DAILY,
        scheduledAt,
      });
      // Baseline must come from scheduledAt, not "now", or a run that executed
      // days late would skip every occurrence in between.
      const next = computeNextOccurrence({ ...action, finishedAt: scheduledAt + 86400 * 5 });
      expect(next!.scheduledAt).toBeLessThan(scheduledAt + 86400 * 3);
    });
  });

  describe('parent aggregation', () => {
    function createParentWithChildren(childCount: number) {
      const parent = repo.create({
        actionType: 'delegate_agent',
        title: 'parent',
        executionMode: 'auto',
        requiresApproval: false,
        taskKind: 'dev',
      });
      const children = Array.from({ length: childCount }, (_, i) =>
        repo.create({
          actionType: 'delegate_agent',
          title: `child ${i}`,
          executionMode: 'auto',
          requiresApproval: false,
          parentActionId: parent.id,
        }),
      );
      return { parent, children };
    }

    it('completes the parent once every child succeeded', () => {
      const { parent, children } = createParentWithChildren(2);
      children.forEach((c) => finish(c.id));

      expect(service.completeFinishedParents()).toBe(1);
      const stored = repo.getById(parent.id)!;
      expect(stored.queueStatus).toBe('succeeded');
      expect(stored.result?.aggregatedFrom).toEqual(children.map((c) => c.id));
    });

    it('leaves the parent open while any child is unfinished', () => {
      const { parent, children } = createParentWithChildren(2);
      finish(children[0].id);
      expect(service.completeFinishedParents()).toBe(0);
      expect(repo.getById(parent.id)!.queueStatus).toBe('queued');
    });

    it('leaves the parent open when a child failed', () => {
      const { parent, children } = createParentWithChildren(2);
      finish(children[0].id);
      finish(children[1].id, 'failed');
      expect(service.completeFinishedParents()).toBe(0);
      expect(repo.getById(parent.id)!.queueStatus).toBe('queued');
    });

    it('never completes a childless task — that would finish work nobody ran', () => {
      repo.create({
        actionType: 'delegate_agent',
        title: 'lonely',
        executionMode: 'auto',
        requiresApproval: false,
      });
      expect(service.completeFinishedParents()).toBe(0);
    });

    it('is idempotent across sweeps', () => {
      const { children } = createParentWithChildren(1);
      finish(children[0].id);
      expect(service.completeFinishedParents()).toBe(1);
      expect(service.completeFinishedParents()).toBe(0);
    });

    it('lists children for the task tree', () => {
      const { parent, children } = createParentWithChildren(3);
      expect(repo.listChildren(parent.id).map((c) => c.id)).toEqual(children.map((c) => c.id));
    });
  });

  it('sweep() runs both jobs together', () => {
    const recurring = createRecurring({ scheduledAt: Math.floor(Date.UTC(2026, 2, 2, 1) / 1000) });
    finish(recurring.id);

    const parent = repo.create({
      actionType: 'delegate_agent',
      title: 'parent',
      executionMode: 'auto',
      requiresApproval: false,
    });
    const child = repo.create({
      actionType: 'delegate_agent',
      title: 'child',
      executionMode: 'auto',
      requiresApproval: false,
      parentActionId: parent.id,
    });
    finish(child.id);

    const result = service.sweep();
    expect(result.rolledOver).toBe(1);
    expect(result.parentsCompleted).toBe(1);
  });
});
