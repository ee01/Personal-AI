import { beforeEach, describe, expect, it } from 'vitest';

import { ActionRepository } from '../repositories/ActionRepository.js';
import { getTestDb } from './setup.js';

describe('ActionRepository.recoverStaleRunningActions', () => {
  const db = getTestDb();
  const repo = new ActionRepository(db);

  beforeEach(() => {
    db.prepare('DELETE FROM proposed_action_attempts').run();
    db.prepare('DELETE FROM proposed_actions').run();
  });

  function createRunning(params: Record<string, unknown>, startedAt: number) {
    const action = repo.create({
      actionType: 'delegate_agent',
      title: 'agent run',
      params,
    });
    db.prepare(
      `UPDATE proposed_actions SET queue_status = 'running', started_at = ? WHERE id = ?`,
    ).run(startedAt, action.id);
    return action.id;
  }

  it('reclaims a run that has no own timeoutMs once the global cutoff passes', () => {
    const currentTime = 2_000_000;
    const id = createRunning({ mode: 'read' }, currentTime - 700);

    const recovered = repo.recoverStaleRunningActions({
      actionType: 'delegate_agent',
      staleAfterSeconds: 660,
      currentTime,
    });

    expect(recovered.map((a) => a.id)).toEqual([id]);
  });

  it('keeps a long-timeout run alive past the global cutoff (Roadmap batch create)', () => {
    const currentTime = 2_000_000;
    const id = createRunning(
      { mode: 'read', timeoutMs: 30 * 60 * 1000 },
      currentTime - 700,
    );

    const recovered = repo.recoverStaleRunningActions({
      actionType: 'delegate_agent',
      staleAfterSeconds: 660,
      currentTime,
    });

    expect(recovered).toEqual([]);
    const row = repo.getById(id);
    expect(row?.queueStatus).toBe('running');
  });

  it('still reclaims a long-timeout run once its own timeout plus grace elapses', () => {
    const currentTime = 2_000_000;
    const id = createRunning(
      { mode: 'read', timeoutMs: 30 * 60 * 1000 },
      currentTime - (30 * 60 + 200),
    );

    const recovered = repo.recoverStaleRunningActions({
      actionType: 'delegate_agent',
      staleAfterSeconds: 660,
      currentTime,
    });

    expect(recovered.map((a) => a.id)).toEqual([id]);
    expect(repo.getById(id)?.queueStatus).toBe('dead_letter');
  });
});
