import { beforeEach, describe, expect, it } from 'vitest';

import { ConfirmRequestRepository } from '../repositories/ConfirmRequestRepository.js';
import { getTestDb } from './setup.js';

describe('confirm request resume_action_id', () => {
  const db = getTestDb();
  const repo = new ConfirmRequestRepository(db);

  beforeEach(() => {
    db.prepare('DELETE FROM confirm_requests').run();
  });

  it('persists and returns the action to resume', () => {
    const { record } = repo.createOrReusePending({
      question: '允许 codex 在本机改代码？',
      category: 'task_center_write_approval',
      resumeActionId: 'action-42',
    });
    expect(record.resumeActionId).toBe('action-42');
    expect(repo.getById(record.id)?.resumeActionId).toBe('action-42');
  });

  it('leaves it undefined when the gate does not name an action', () => {
    const { record } = repo.createOrReusePending({ question: '要不要继续？' });
    expect(record.resumeActionId).toBeUndefined();
  });

  it('accepts the link for any category, not just openclaw_delegation', () => {
    for (const category of [
      'openclaw_delegation',
      'task_center_write_approval',
      'task_center_plan_gate',
      'task_center_artifact_review',
    ]) {
      const { record } = repo.createOrReusePending({
        question: `gate for ${category}`,
        category,
        resumeActionId: `action-${category}`,
      });
      expect(repo.getById(record.id)?.resumeActionId).toBe(`action-${category}`);
    }
  });

  it('ignores a blank action id rather than storing empty string', () => {
    const { record } = repo.createOrReusePending({ question: 'blank', resumeActionId: '   ' });
    expect(record.resumeActionId).toBeUndefined();
  });

  it('keeps the column readable for rows created before migration 066', () => {
    // Simulate a legacy row: inserted without the new column.
    const id = 'legacy-1';
    db.prepare(
      `INSERT INTO confirm_requests (id, question, state, priority, created_at)
       VALUES (?, ?, 'pending', 'normal', ?)`,
    ).run(id, 'legacy question', Math.floor(Date.now() / 1000));
    const record = repo.getById(id);
    expect(record?.resumeActionId).toBeUndefined();
    expect(record?.question).toBe('legacy question');
  });
});
