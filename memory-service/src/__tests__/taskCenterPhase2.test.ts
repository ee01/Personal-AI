import { beforeEach, describe, expect, it } from 'vitest';

import { ActionRepository } from '../repositories/ActionRepository.js';
import { AgentWorkerRepository } from '../repositories/AgentWorkerRepository.js';
import {
  hasVerifiableArtifact,
  isSafeRelativeArtifactPath,
  isVerifiedFileArtifact,
} from '../integrations/executors/agentResultContract.js';
import { getTestDb } from './setup.js';

describe('Phase 2: execution capacity', () => {
  const db = getTestDb();
  const actions = new ActionRepository(db);
  const workers = new AgentWorkerRepository(db);

  beforeEach(() => {
    db.prepare('DELETE FROM agent_worker_leases').run();
    db.prepare('DELETE FROM proposed_action_attempts').run();
    db.prepare('DELETE FROM proposed_actions').run();
  });

  describe('lease renewal', () => {
    function seedLease(leaseUntil: number) {
      const action = actions.create({ actionType: 'delegate_agent', title: 'long run' });
      workers.putLease({ actionId: action.id, workerId: 'w1', fenceToken: 3, leaseUntil });
      return action;
    }

    it('extends a live lease held by the same worker with a matching fence', () => {
      const nowSec = Math.floor(Date.now() / 1000);
      const action = seedLease(nowSec + 60);
      const renewed = workers.renewLease({
        actionId: action.id,
        workerId: 'w1',
        fenceToken: 3,
        leaseUntil: nowSec + 600,
      });
      expect(renewed?.leaseUntil).toBe(nowSec + 600);
    });

    it('refuses a stale fence token, so a worker that lost the lease cannot take it back', () => {
      const nowSec = Math.floor(Date.now() / 1000);
      const action = seedLease(nowSec + 60);
      const renewed = workers.renewLease({
        actionId: action.id,
        workerId: 'w1',
        fenceToken: 2,
        leaseUntil: nowSec + 600,
      });
      expect(renewed).toBeNull();
    });

    it('refuses renewal from a different worker', () => {
      const nowSec = Math.floor(Date.now() / 1000);
      const action = seedLease(nowSec + 60);
      const renewed = workers.renewLease({
        actionId: action.id,
        workerId: 'other',
        fenceToken: 3,
        leaseUntil: nowSec + 600,
      });
      expect(renewed).toBeNull();
    });

    it('lists a worker leases so a heartbeat can renew them all at once', () => {
      const nowSec = Math.floor(Date.now() / 1000);
      seedLease(nowSec + 60);
      seedLease(nowSec + 60);
      expect(workers.listLeasesForWorker('w1')).toHaveLength(2);
      expect(workers.listLeasesForWorker('nobody')).toHaveLength(0);
    });

    it('keeps the action row leaseUntil in step so run state does not look expired', () => {
      const nowSec = Math.floor(Date.now() / 1000);
      const action = seedLease(nowSec + 60);
      actions.markClaimedByWorker(action.id, 'w1', 3, nowSec + 60);
      actions.extendWorkerLease(action.id, nowSec + 900);
      expect(actions.getById(action.id)?.result?.leaseUntil).toBe(nowSec + 900);
    });
  });

  describe('shared claim pool', () => {
    it('returns only unassigned work', () => {
      const pooled = actions.create({
        actionType: 'delegate_agent',
        title: 'pooled',
        queueStatus: 'awaiting_claim',
      });
      const bound = actions.create({
        actionType: 'delegate_agent',
        title: 'bound',
        queueStatus: 'awaiting_claim',
      });
      db.prepare('UPDATE proposed_actions SET target_worker_id = ? WHERE id = ?').run('w1', bound.id);

      const pool = actions.listPoolAwaitingClaim(10).map((a) => a.id);
      expect(pool).toContain(pooled.id);
      expect(pool).not.toContain(bound.id);
    });

    it('ignores tasks that are not awaiting claim', () => {
      actions.create({ actionType: 'delegate_agent', title: 'queued only' });
      expect(actions.listPoolAwaitingClaim(10)).toHaveLength(0);
    });

    it('orders by priority so urgent pool work is taken first', () => {
      const low = actions.create({
        actionType: 'delegate_agent', title: 'low', priority: 2, queueStatus: 'awaiting_claim',
      });
      const high = actions.create({
        actionType: 'delegate_agent', title: 'high', priority: 9, queueStatus: 'awaiting_claim',
      });
      expect(actions.listPoolAwaitingClaim(10)[0].id).toBe(high.id);
      expect(actions.listPoolAwaitingClaim(10)[1].id).toBe(low.id);
    });
  });

  describe('file artifacts', () => {
    const fileArtifact = {
      kind: 'file',
      title: 'sqlite-vec 对比',
      content: 'p95 延迟对比与迁移成本结论',
      metadata: { path: 'research/sqlite-vec-vs-lancedb.md', verification: 'file_write' },
    };

    it('accepts a deliverable as a valid success receipt', () => {
      expect(isVerifiedFileArtifact(fileArtifact)).toBe(true);
      expect(hasVerifiableArtifact([fileArtifact])).toBe(true);
    });

    it('rejects a file receipt with no verification', () => {
      expect(isVerifiedFileArtifact({ ...fileArtifact, metadata: { path: 'a.md' } })).toBe(false);
    });

    it('rejects a file receipt with no path', () => {
      expect(
        isVerifiedFileArtifact({ ...fileArtifact, metadata: { verification: 'file_write' } }),
      ).toBe(false);
    });

    it('rejects path traversal and absolute paths — a receipt is not a file picker', () => {
      for (const path of ['../../etc/passwd', '/etc/passwd', 'C:\\Windows\\system32', 'a/../../b']) {
        expect(isSafeRelativeArtifactPath(path)).toBe(false);
        expect(isVerifiedFileArtifact({ ...fileArtifact, metadata: { path, verification: 'file_write' } }))
          .toBe(false);
      }
    });

    it('accepts ordinary nested relative paths', () => {
      for (const path of ['research/a.md', 'reports/2026/q3.pptx', 'a.md']) {
        expect(isSafeRelativeArtifactPath(path)).toBe(true);
      }
    });

    it('still rejects a bare note with no evidence at all', () => {
      expect(hasVerifiableArtifact([{ kind: 'note', title: 'done', content: 'trust me' }])).toBe(false);
    });
  });
});
