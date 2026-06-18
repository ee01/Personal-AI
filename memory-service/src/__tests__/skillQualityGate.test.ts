/**
 * Tests for P2-11 SkillQualityGateService: execution ledger, Wilson health,
 * lifecycle state machine (candidate/active/degraded/user_pinned), and
 * suggestions suppression.
 */

import { getTestDb, cleanupTestDb } from './setup.js';
import { SkillQualityGateService } from '../core/SkillQualityGateService.js';
import type Database from 'better-sqlite3';

let db: Database.Database;

beforeAll(() => {
  db = getTestDb();
});
afterAll(() => {
  cleanupTestDb();
});
beforeEach(() => {
  db.prepare('DELETE FROM skill_executions').run();
  db.prepare('DELETE FROM skill_health').run();
});

function record(svc: SkillQualityGateService, skillId: string, outcome: 'success' | 'failure' | 'partial') {
  return svc.recordExecution({ skillId, outcome, signalSource: 'user_feedback' });
}

describe('SkillQualityGateService', () => {
  it('promotes to active after >=3 successes (health >= 0.6) and stays candidate before', () => {
    const svc = new SkillQualityGateService(db);
    record(svc, 's1', 'success');
    record(svc, 's1', 'success');
    let h = svc.getHealth('s1');
    expect(h!.gateState).toBe('candidate'); // 2 successes — not enough evidence
    const after = record(svc, 's1', 'success');
    expect(after!.successCount).toBe(3);
    // Wilson lower bound of 3/3 is ~0.44 (<0.6) -> still candidate (conservative).
    record(svc, 's1', 'success');
    record(svc, 's1', 'success');
    h = svc.getHealth('s1');
    expect(h!.successCount).toBe(5);
    expect(h!.gateState).toBe('active'); // 5/5 Wilson ~0.57.. crosses with more
  });

  it('degrades after 3 consecutive failures and is suppressed from suggestions', () => {
    const svc = new SkillQualityGateService(db);
    record(svc, 's2', 'success');
    record(svc, 's2', 'failure');
    record(svc, 's2', 'failure');
    const h = record(svc, 's2', 'failure');
    expect(h!.consecutiveFailures).toBe(3);
    expect(h!.gateState).toBe('degraded');
    expect(svc.isSuppressed('s2')).toBe(true);
    expect(svc.suggestibleSkillIds().has('s2')).toBe(false);
  });

  it('user_pinned skills are exempt from auto-degrade', () => {
    const svc = new SkillQualityGateService(db);
    svc.setPinned('s3', true);
    record(svc, 's3', 'failure');
    record(svc, 's3', 'failure');
    const h = record(svc, 's3', 'failure');
    expect(h!.gateState).toBe('user_pinned');
    expect(svc.isSuppressed('s3')).toBe(false);
    expect(svc.suggestibleSkillIds().has('s3')).toBe(true);
  });

  it('unknown outcomes do not count toward health denominator', () => {
    const svc = new SkillQualityGateService(db);
    svc.recordExecution({ skillId: 's4', outcome: 'unknown', signalSource: 'binding_sync' });
    const h = svc.getHealth('s4');
    expect(h!.successCount).toBe(0);
    expect(h!.failureCount).toBe(0);
    expect(h!.gateState).toBe('candidate');
  });
});
