import { beforeEach, describe, expect, it } from 'vitest';

import { ActionRepository } from '../repositories/ActionRepository.js';
import { getTestDb } from './setup.js';

describe('Task Center ledger fields', () => {
  const db = getTestDb();
  const repo = new ActionRepository(db);

  beforeEach(() => {
    db.prepare('DELETE FROM proposed_action_attempts').run();
    db.prepare('DELETE FROM proposed_actions').run();
  });

  function createAuto(overrides: Parameters<ActionRepository['create']>[0]) {
    return repo.create({
      actionType: 'delegate_agent',
      title: 'task',
      executionMode: 'auto',
      requiresApproval: false,
      ...overrides,
    });
  }

  function dueIds() {
    return repo.listDueAutoActions(50).map((action) => action.id);
  }

  describe('lane', () => {
    it('runs memory_cron rows locally', () => {
      const action = createAuto({ title: 'local', lane: 'memory_cron', taskKind: 'push' });
      expect(dueIds()).toContain(action.id);
      expect(repo.getById(action.id)?.lane).toBe('memory_cron');
    });

    it('skips jira_sheet rows so Jira Automation stays the only trigger', () => {
      const action = createAuto({ title: 'mirrored', lane: 'jira_sheet', taskKind: 'push' });
      expect(dueIds()).not.toContain(action.id);
    });

    it('treats a row with no lane as locally scheduled', () => {
      const action = createAuto({ title: 'legacy' });
      expect(dueIds()).toContain(action.id);
      expect(repo.getById(action.id)?.lane).toBeUndefined();
    });
  });

  describe('depends_on', () => {
    it('holds a task until its dependency succeeds', () => {
      const upstream = createAuto({ title: 'upstream' });
      const downstream = createAuto({ title: 'downstream', dependsOn: [upstream.id] });

      expect(dueIds()).toEqual([upstream.id]);

      const attempt = repo.markRunning(upstream.id);
      repo.markSucceeded(upstream.id, attempt, { status: 'success' });

      expect(dueIds()).toEqual([downstream.id]);
    });

    it('keeps blocking when a dependency failed rather than running downstream work', () => {
      const upstream = createAuto({ title: 'upstream' });
      const downstream = createAuto({ title: 'downstream', dependsOn: [upstream.id] });

      const attempt = repo.markRunning(upstream.id);
      repo.markFailed(upstream.id, attempt, 'boom');

      expect(dueIds()).not.toContain(downstream.id);
    });

    it('requires every dependency, not just one', () => {
      const a = createAuto({ title: 'a' });
      const b = createAuto({ title: 'b' });
      const downstream = createAuto({ title: 'downstream', dependsOn: [a.id, b.id] });

      repo.markSucceeded(a.id, repo.markRunning(a.id), { status: 'success' });
      expect(dueIds()).not.toContain(downstream.id);

      repo.markSucceeded(b.id, repo.markRunning(b.id), { status: 'success' });
      expect(dueIds()).toContain(downstream.id);
    });

    it('blocks on a dependency id that no longer exists', () => {
      const downstream = createAuto({ title: 'downstream', dependsOn: ['missing-action-id'] });
      expect(dueIds()).not.toContain(downstream.id);
    });

    it('leaves tasks without dependencies unaffected', () => {
      const action = createAuto({ title: 'independent' });
      expect(dueIds()).toContain(action.id);
    });
  });

  describe('round-tripped fields', () => {
    it('persists parent, recurrence, kind and mirror ref', () => {
      const parent = createAuto({ title: 'parent', taskKind: 'dev' });
      const child = createAuto({
        title: 'child',
        parentActionId: parent.id,
        taskKind: 'dev',
        recurrenceSpec: { repeatEvery: 1, repeatUnit: 'Day', timezone: 'Asia/Shanghai' },
        lane: 'jira_sheet',
        mirrorRef: { sheetMessageId: 'msg_123', syncState: 'synced' },
      });

      const stored = repo.getById(child.id)!;
      expect(stored.parentActionId).toBe(parent.id);
      expect(stored.taskKind).toBe('dev');
      expect(stored.recurrenceSpec).toEqual({
        repeatEvery: 1,
        repeatUnit: 'Day',
        timezone: 'Asia/Shanghai',
      });
      expect(stored.mirrorRef).toEqual({ sheetMessageId: 'msg_123', syncState: 'synced' });
    });

    it('ignores an unknown lane or kind instead of surfacing junk', () => {
      const action = createAuto({
        title: 'bad enum',
        lane: 'nonsense' as never,
        taskKind: 'nonsense' as never,
      });
      const stored = repo.getById(action.id)!;
      expect(stored.lane).toBeUndefined();
      expect(stored.taskKind).toBeUndefined();
    });
  });
});
