/**
 * Tests for ProactivityPolicy — notification utility scoring and throttling.
 */

import { getTestDb, cleanupTestDb } from './setup.js';
import { ProactivityPolicy } from '../core/ProactivityPolicy.js';
import { now } from '../utils/time.js';
import type { NotificationCandidate, PolicyConfig } from '../core/ProactivityPolicy.js';
import type Database from 'better-sqlite3';

let db: Database.Database;

beforeAll(() => {
  db = getTestDb();
});

beforeEach(() => {
  // Clean notification_records to reset spam/throttle state
  db.exec('DELETE FROM notification_records');
  db.exec('DELETE FROM user_profile_items');
});

afterAll(() => {
  cleanupTestDb();
});

// ---------------------------------------------------------------------------
// Helper: create a policy that disables quiet hours (so tests are
// deterministic regardless of when the CI runs).
// ---------------------------------------------------------------------------

function createPolicy(overrides?: Partial<PolicyConfig>): ProactivityPolicy {
  return new ProactivityPolicy(db, {
    // Disable quiet hours cost by default (so CI time doesn't matter)
    costs: { busy: 0, quietHours: 0, spamPenalty: 0.2, userPrefCost: 0 },
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// evaluate()
// ---------------------------------------------------------------------------

describe('ProactivityPolicy.evaluate()', () => {
  it('high importance + urgency -> action notify', async () => {
    const policy = createPolicy();
    const candidate: NotificationCandidate = {
      type: 'deadline',
      title: 'Critical deadline',
      body: 'Due in 1 hour',
      importance: 1.0,
      urgency: 1.0,
      confidence: 0.9,
      actionability: 0.9,
    };

    const decision = await policy.evaluate(candidate);
    // benefit = 0.35*1 + 0.25*1 + 0.20*0.9 + 0.20*0.9 = 0.35+0.25+0.18+0.18 = 0.96
    expect(decision.action).toBe('notify');
    expect(decision.utility).toBeGreaterThanOrEqual(0.4);
  });

  it('low everything -> action silent', async () => {
    const policy = createPolicy();
    const candidate: NotificationCandidate = {
      type: 'reminder',
      title: 'Low-priority note',
      body: 'Nothing urgent',
      importance: 0.1,
      urgency: 0.0,
      confidence: 0.2,
      actionability: 0.1,
    };

    const decision = await policy.evaluate(candidate);
    // benefit = 0.35*0.1 + 0.25*0 + 0.20*0.2 + 0.20*0.1 = 0.035+0+0.04+0.02 = 0.095
    expect(decision.action).toBe('silent');
    expect(decision.utility).toBeLessThan(0.25);
  });

  it('medium scores -> action confirm_only', async () => {
    const policy = createPolicy();
    const candidate: NotificationCandidate = {
      type: 'project_update',
      title: 'Moderate update',
      body: 'Something happened',
      importance: 0.5,
      urgency: 0.4,
      confidence: 0.5,
      actionability: 0.5,
    };

    const decision = await policy.evaluate(candidate);
    // benefit = 0.35*0.5 + 0.25*0.4 + 0.20*0.5 + 0.20*0.5 = 0.175+0.1+0.1+0.1 = 0.475
    // No cost -> utility = 0.475 which is >= 0.40 threshold
    // Adjust to get into confirm_only range (0.25-0.40)
    // Let's try lower values
    const confirmCandidate: NotificationCandidate = {
      type: 'project_update',
      title: 'Minor update',
      body: 'Small change',
      importance: 0.4,
      urgency: 0.2,
      confidence: 0.5,
      actionability: 0.3,
    };

    const confirmDecision = await policy.evaluate(confirmCandidate);
    // benefit = 0.35*0.4 + 0.25*0.2 + 0.20*0.5 + 0.20*0.3 = 0.14+0.05+0.10+0.06 = 0.35
    expect(confirmDecision.utility).toBeGreaterThanOrEqual(0.25);
    expect(confirmDecision.utility).toBeLessThan(0.4);
    expect(confirmDecision.action).toBe('confirm_only');
  });

  it('quiet hours increase cost and reduce chance to notify', async () => {
    // Enable quiet hours cost; we can't control the system clock, so we
    // compare utility WITH quietHours cost vs WITHOUT.
    const withQuiet = new ProactivityPolicy(db, {
      costs: { busy: 0, quietHours: 0.5, spamPenalty: 0, userPrefCost: 0 },
    });
    const withoutQuiet = new ProactivityPolicy(db, {
      costs: { busy: 0, quietHours: 0, spamPenalty: 0, userPrefCost: 0 },
    });

    const candidate: NotificationCandidate = {
      type: 'deadline',
      title: 'Something important',
      body: 'Check this',
      importance: 0.8,
      urgency: 0.6,
      confidence: 0.7,
      actionability: 0.5,
    };

    const decisionQuiet = await withQuiet.evaluate(candidate);
    const decisionNoQuiet = await withoutQuiet.evaluate(candidate);

    // If we ARE in quiet hours, the quiet-cost-enabled policy should have
    // lower or equal utility. If not in quiet hours, they'll be equal.
    expect(decisionQuiet.utility).toBeLessThanOrEqual(decisionNoQuiet.utility);
  });

  it('same topic spam -> penalised (higher cost)', async () => {
    const topicId = 'spam-topic-123';

    // Insert a recent notification with this topic
    const ts = now();
    db.prepare(`
      INSERT INTO notification_records (id, channel, type, title, topic_id, created_at, sent_at)
      VALUES (?, 'system', 'test', 'prev', ?, ?, ?)
    `).run(`notif-spam-1`, topicId, ts, ts);

    const policy = createPolicy({
      costs: { busy: 0, quietHours: 0, spamPenalty: 0.5, userPrefCost: 0 },
    });

    const candidateWithTopic: NotificationCandidate = {
      type: 'reminder',
      title: 'Follow-up',
      body: 'Same topic again',
      importance: 0.5,
      urgency: 0.3,
      confidence: 0.5,
      actionability: 0.4,
      topicId,
    };

    const candidateNoTopic: NotificationCandidate = {
      ...candidateWithTopic,
      topicId: undefined,
    };

    const withSpam = await policy.evaluate(candidateWithTopic);
    const noSpam = await policy.evaluate(candidateNoTopic);

    expect(withSpam.utility).toBeLessThan(noSpam.utility);
  });

  it('uses only confirmed profile items for preference alignment', async () => {
    const ts = now();
    const candidate: NotificationCandidate = {
      type: 'project_update',
      title: 'Personal AI profile calibration',
      body: 'Personal AI needs attention before the next rollout.',
      importance: 0.6,
      urgency: 0.4,
      confidence: 0.8,
      actionability: 0.6,
    };
    const policy = createPolicy({
      costs: { busy: 0, quietHours: 0, spamPenalty: 0, userPrefCost: 0.5 },
    });

    const baseline = await policy.evaluate(candidate);

    db.prepare(`
      INSERT INTO user_profile_items
        (id, item_type, item_key, item_value, source_kind, confidence, user_confirmed, status,
         salience_score, mention_count, last_seen, created_at, updated_at, fingerprint)
      VALUES (?, 'interest', 'focus_project', 'Personal AI', 'inferred', 0.95, 0, 'active',
              0.95, 1, ?, ?, ?, ?)
    `).run('unconfirmed-personal-ai', ts, ts, ts, 'fp-unconfirmed-personal-ai');

    const withUnconfirmed = await policy.evaluate(candidate);

    db.prepare(`
      INSERT INTO user_profile_items
        (id, item_type, item_key, item_value, source_kind, confidence, user_confirmed, status,
         salience_score, mention_count, last_seen, created_at, updated_at, fingerprint)
      VALUES (?, 'interest', 'focus_project', 'Personal AI', 'explicit', 0.95, 1, 'active',
              0.95, 1, ?, ?, ?, ?)
    `).run('confirmed-personal-ai', ts, ts, ts, 'fp-confirmed-personal-ai');

    const withConfirmed = await policy.evaluate(candidate);

    expect(withUnconfirmed.utility).toBeCloseTo(baseline.utility, 6);
    expect(withConfirmed.utility).toBeGreaterThan(withUnconfirmed.utility);
  });
});

// ---------------------------------------------------------------------------
// filterNotifications()
// ---------------------------------------------------------------------------

describe('ProactivityPolicy.filterNotifications()', () => {
  it('returns only candidates that pass evaluate() with notify', async () => {
    const policy = createPolicy();

    const candidates: NotificationCandidate[] = [
      {
        type: 'deadline',
        title: 'Urgent deadline',
        body: 'Due now',
        importance: 1.0,
        urgency: 1.0,
        confidence: 0.9,
        actionability: 0.9,
      },
      {
        type: 'reminder',
        title: 'Low priority',
        body: 'Not urgent',
        importance: 0.1,
        urgency: 0.0,
        confidence: 0.1,
        actionability: 0.1,
      },
      {
        type: 'alert',
        title: 'Important alert',
        body: 'Action needed',
        importance: 0.9,
        urgency: 0.8,
        confidence: 0.8,
        actionability: 0.7,
      },
    ];

    const approved = await policy.filterNotifications(candidates);

    // High-importance candidates should pass, low ones should not
    expect(approved.length).toBeGreaterThanOrEqual(1);
    expect(approved.length).toBeLessThan(candidates.length);

    const titles = approved.map((c) => c.title);
    expect(titles).toContain('Urgent deadline');
    expect(titles).not.toContain('Low priority');
  });

  it('returns empty array when no candidates pass', async () => {
    const policy = createPolicy();

    const candidates: NotificationCandidate[] = [
      {
        type: 'reminder',
        title: 'Weak 1',
        body: '',
        importance: 0.05,
        urgency: 0.0,
        confidence: 0.1,
        actionability: 0.0,
      },
      {
        type: 'reminder',
        title: 'Weak 2',
        body: '',
        importance: 0.1,
        urgency: 0.0,
        confidence: 0.1,
        actionability: 0.1,
      },
    ];

    const approved = await policy.filterNotifications(candidates);
    expect(approved).toHaveLength(0);
  });
});
