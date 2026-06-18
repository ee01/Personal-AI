/**
 * Tests for P1-8: cost-asymmetry utility v2 + scheduled fallback + calibration.
 */

import { vi } from 'vitest';
import { getTestDb, cleanupTestDb } from './setup.js';
import { ProactivityPolicy, type NotificationCandidate } from '../core/ProactivityPolicy.js';
import { now } from '../utils/time.js';
import type Database from 'better-sqlite3';

let db: Database.Database;

function candidate(type: string, over: Partial<NotificationCandidate> = {}): NotificationCandidate {
  return {
    type,
    title: `${type} title`,
    body: 'body',
    importance: 0.9,
    urgency: 0.9,
    confidence: 0.8,
    actionability: 0.8,
    ...over,
  };
}

beforeAll(() => {
  db = getTestDb();
});
afterAll(() => {
  cleanupTestDb();
});
beforeEach(() => {
  db.prepare('DELETE FROM notification_records').run();
  try {
    db.prepare('DELETE FROM notification_policy_audit').run();
  } catch {
    /* ignore */
  }
});

describe('ProactivityPolicy utility v2', () => {
  it('defers a deep-night high-miss deadline to a morning scheduled delivery (not silent)', async () => {
    const policy = new ProactivityPolicy(db, { utilityV2: true });
    vi.spyOn(policy as unknown as { isQuietHours: () => boolean }, 'isQuietHours').mockReturnValue(true);
    const decision = await policy.evaluate(candidate('deadline'));
    expect(decision.action).toBe('scheduled');
    expect(decision.reason).toContain('morning');
  });

  it('notifies the same deadline immediately outside quiet hours', async () => {
    const policy = new ProactivityPolicy(db, { utilityV2: true });
    vi.spyOn(policy as unknown as { isQuietHours: () => boolean }, 'isQuietHours').mockReturnValue(false);
    const decision = await policy.evaluate(candidate('deadline'));
    expect(decision.action).toBe('notify');
  });

  it('at the same need score, a dream_digest is harder to notify than a deadline', async () => {
    const policy = new ProactivityPolicy(db, { utilityV2: true });
    vi.spyOn(policy as unknown as { isQuietHours: () => boolean }, 'isQuietHours').mockReturnValue(false);
    const dream = await policy.evaluate(candidate('dream_digest'));
    const deadline = await policy.evaluate(candidate('deadline'));
    expect(deadline.utility).toBeGreaterThan(dream.utility);
    expect(dream.action).not.toBe('notify');
  });

  it('v1 (default) never returns scheduled and notifies a high-benefit candidate', async () => {
    const policy = new ProactivityPolicy(db, { utilityV2: false });
    vi.spyOn(policy as unknown as { isQuietHours: () => boolean }, 'isQuietHours').mockReturnValue(false);
    const decision = await policy.evaluate(candidate('deadline'));
    expect(decision.action).toBe('notify');
    expect(decision.action).not.toBe('scheduled');
  });
});

describe('ProactivityPolicy calibration', () => {
  it('raises interrupt for a type the user keeps dismissing (dryRun previews)', () => {
    const ts = now();
    const insert = db.prepare(
      `INSERT INTO notification_records (id, type, title, dismissed_at, created_at)
       VALUES (?, 'project_update', 't', ?, ?)`,
    );
    for (let i = 0; i < 10; i++) {
      insert.run(`n${i}`, i < 8 ? ts : null, ts);
    }
    const policy = new ProactivityPolicy(db, { utilityV2: true });
    const adj = policy.calibrate({ windowDays: 30, dryRun: true });
    const pu = adj.find((a) => a.type === 'project_update' && a.field === 'interrupt');
    expect(pu).toBeDefined();
    expect(pu!.newValue).toBeGreaterThan(pu!.oldValue);
    // dryRun writes no audit rows.
    const auditCount = db.prepare('SELECT COUNT(*) AS c FROM notification_policy_audit').get() as { c: number };
    expect(auditCount.c).toBe(0);
  });
});
