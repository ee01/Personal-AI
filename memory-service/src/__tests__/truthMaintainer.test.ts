/**
 * Tests for TruthMaintainer — bitemporal property management and conflict resolution.
 */

import { getTestDb, cleanupTestDb, createMockEntity } from './setup.js';
import { TruthMaintainer } from '../core/TruthMaintainer.js';
import type { PropertyChange } from '../core/TruthMaintainer.js';
import type Database from 'better-sqlite3';

let db: Database.Database;
let tm: TruthMaintainer;
const TEST_ENTITY_ID = 'test-entity-tm';

beforeAll(() => {
  db = getTestDb();
});

beforeEach(() => {
  tm = new TruthMaintainer(db);

  // Clean tables for isolation
  db.exec('DELETE FROM entity_properties');
  db.exec('DELETE FROM confirm_requests');
  db.exec('DELETE FROM notification_records');

  // Ensure the test entity exists (idempotent)
  db.exec(`
    INSERT OR IGNORE INTO entities (id, type, name, importance, access_count, mention_count, status, created_at)
    VALUES ('${TEST_ENTITY_ID}', 'Person', 'Test Person', 0.5, 0, 0, 'active', ${Math.floor(Date.now() / 1000)})
  `);
});

afterAll(() => {
  cleanupTestDb();
});

// ---------------------------------------------------------------------------
// processPropertyChange()
// ---------------------------------------------------------------------------

describe('TruthMaintainer.processPropertyChange()', () => {
  it('first set: new property -> status created', async () => {
    const change: PropertyChange = {
      entityId: TEST_ENTITY_ID,
      key: 'role',
      value: 'engineer',
      actionType: 'set',
      sourceAuthority: 'peer',
    };

    const result = await tm.processPropertyChange(change);
    expect(result.action).toBe('created');
    expect(result.propertyId).toBeGreaterThan(0);

    // Verify in DB
    const active = tm.getActiveProperty(TEST_ENTITY_ID, 'role');
    expect(active).toBeDefined();
    expect(active!.property_value).toBe('engineer');
    expect(active!.status).toBe('active');
  });

  it('same value set again -> confidence boost (confirmed), not duplicate', async () => {
    await tm.processPropertyChange({
      entityId: TEST_ENTITY_ID,
      key: 'location',
      value: 'NYC',
      actionType: 'set',
      sourceAuthority: 'peer',
      confidence: 0.8,
    });

    const result = await tm.processPropertyChange({
      entityId: TEST_ENTITY_ID,
      key: 'location',
      value: 'NYC',
      actionType: 'set',
      sourceAuthority: 'peer',
      confidence: 0.8,
    });

    expect(result.action).toBe('confirmed');

    // Confidence should have been boosted
    const prop = tm.getActiveProperty(TEST_ENTITY_ID, 'location');
    expect(prop).toBeDefined();
    expect(prop!.confidence).toBeGreaterThan(0.8);
  });

  it('different value with higher authority -> supersedes old', async () => {
    await tm.processPropertyChange({
      entityId: TEST_ENTITY_ID,
      key: 'team',
      value: 'Alpha',
      actionType: 'set',
      sourceAuthority: 'peer',
      confidence: 0.8,
    });

    const result = await tm.processPropertyChange({
      entityId: TEST_ENTITY_ID,
      key: 'team',
      value: 'Beta',
      actionType: 'set',
      sourceAuthority: 'official',
      confidence: 0.9,
    });

    expect(result.action).toBe('superseded');
    expect(result.notificationId).toBeDefined();

    // New active property should be 'Beta'
    const active = tm.getActiveProperty(TEST_ENTITY_ID, 'team');
    expect(active).toBeDefined();
    expect(active!.property_value).toBe('Beta');
  });

  it('different value with lower authority -> creates dispute + confirm_request', async () => {
    // Set initial with high authority
    await tm.processPropertyChange({
      entityId: TEST_ENTITY_ID,
      key: 'manager',
      value: 'Alice',
      actionType: 'set',
      sourceAuthority: 'official',
      confidence: 0.9,
    });

    // Try to change with lower authority
    const result = await tm.processPropertyChange({
      entityId: TEST_ENTITY_ID,
      key: 'manager',
      value: 'Bob',
      actionType: 'set',
      sourceAuthority: 'hearsay',
      confidence: 0.5,
    });

    expect(result.action).toBe('disputed');
    expect(result.confirmRequestId).toBeDefined();

    // Original should still be active
    const active = tm.getActiveProperty(TEST_ENTITY_ID, 'manager');
    expect(active).toBeDefined();
    expect(active!.property_value).toBe('Alice');
  });

  it('confirm action -> sets is_final on existing', async () => {
    await tm.processPropertyChange({
      entityId: TEST_ENTITY_ID,
      key: 'email',
      value: 'test@example.com',
      actionType: 'set',
      sourceAuthority: 'self',
    });

    const result = await tm.processPropertyChange({
      entityId: TEST_ENTITY_ID,
      key: 'email',
      value: 'test@example.com',
      actionType: 'confirm',
    });

    expect(result.action).toBe('confirmed');

    const prop = tm.getActiveProperty(TEST_ENTITY_ID, 'email');
    expect(prop).toBeDefined();
    expect(prop!.is_final).toBe(1);
  });

  it('confirm on nonexistent property -> rejected', async () => {
    const result = await tm.processPropertyChange({
      entityId: TEST_ENTITY_ID,
      key: 'nonexistent-key',
      value: 'whatever',
      actionType: 'confirm',
    });
    expect(result.action).toBe('rejected');
    expect(result.propertyId).toBe(-1);
  });

  it('retract action -> marks property retracted', async () => {
    await tm.processPropertyChange({
      entityId: TEST_ENTITY_ID,
      key: 'nickname',
      value: 'Testy',
      actionType: 'set',
    });

    const result = await tm.processPropertyChange({
      entityId: TEST_ENTITY_ID,
      key: 'nickname',
      value: 'Testy',
      actionType: 'retract',
    });

    expect(result.action).toBe('superseded');

    // Property should no longer be active
    const active = tm.getActiveProperty(TEST_ENTITY_ID, 'nickname');
    expect(active).toBeUndefined();

    // History should show retracted entry
    const history = tm.getPropertyHistory(TEST_ENTITY_ID, 'nickname');
    const retracted = history.find((h: any) => h.status === 'retracted');
    expect(retracted).toBeDefined();
  });

  it('retract on nonexistent property -> rejected', async () => {
    const result = await tm.processPropertyChange({
      entityId: TEST_ENTITY_ID,
      key: 'no-such-key',
      value: '',
      actionType: 'retract',
    });
    expect(result.action).toBe('rejected');
  });

  it('propose action -> creates pending_confirm + confirm_request', async () => {
    const result = await tm.processPropertyChange({
      entityId: TEST_ENTITY_ID,
      entityName: 'Test Person',
      key: 'hobby',
      value: 'painting',
      actionType: 'propose',
      sourceAuthority: 'inferred',
    });

    expect(result.action).toBe('proposed');
    expect(result.confirmRequestId).toBeDefined();

    // The property should be pending_confirm, not active
    const active = tm.getActiveProperty(TEST_ENTITY_ID, 'hobby');
    expect(active).toBeUndefined(); // not active yet

    const history = tm.getPropertyHistory(TEST_ENTITY_ID, 'hobby');
    const pending = history.find((h: any) => h.status === 'pending_confirm');
    expect(pending).toBeDefined();
  });

  it('propose when property already exists -> creates second pending + confirm_request', async () => {
    await tm.processPropertyChange({
      entityId: TEST_ENTITY_ID,
      key: 'title',
      value: 'Senior',
      actionType: 'set',
      sourceAuthority: 'peer',
    });

    const result = await tm.processPropertyChange({
      entityId: TEST_ENTITY_ID,
      key: 'title',
      value: 'Lead',
      actionType: 'propose',
      sourceAuthority: 'inferred',
    });

    expect(result.action).toBe('proposed');
    expect(result.confirmRequestId).toBeDefined();

    // Original should still be active
    const active = tm.getActiveProperty(TEST_ENTITY_ID, 'title');
    expect(active!.property_value).toBe('Senior');
  });
});

// ---------------------------------------------------------------------------
// getPropertyHistory()
// ---------------------------------------------------------------------------

describe('TruthMaintainer.getPropertyHistory()', () => {
  it('returns all versions including superseded', async () => {
    await tm.processPropertyChange({
      entityId: TEST_ENTITY_ID,
      key: 'dept',
      value: 'Engineering',
      actionType: 'set',
      sourceAuthority: 'peer',
    });
    await tm.processPropertyChange({
      entityId: TEST_ENTITY_ID,
      key: 'dept',
      value: 'Product',
      actionType: 'update',
      sourceAuthority: 'official',
    });

    const history = tm.getPropertyHistory(TEST_ENTITY_ID, 'dept');
    expect(history.length).toBeGreaterThanOrEqual(2);

    const statuses = history.map((h: any) => h.status);
    expect(statuses).toContain('active');
    expect(statuses).toContain('superseded');
  });

  it('returns results ordered by tx_start descending', async () => {
    await tm.processPropertyChange({
      entityId: TEST_ENTITY_ID,
      key: 'version',
      value: 'v1',
      actionType: 'set',
      sourceAuthority: 'peer',
    });
    await tm.processPropertyChange({
      entityId: TEST_ENTITY_ID,
      key: 'version',
      value: 'v2',
      actionType: 'update',
      sourceAuthority: 'official',
    });

    const history = tm.getPropertyHistory(TEST_ENTITY_ID, 'version');
    // tx_start DESC means newest first
    for (let i = 0; i < history.length - 1; i++) {
      expect(history[i].tx_start).toBeGreaterThanOrEqual(history[i + 1].tx_start);
    }
  });
});

// ---------------------------------------------------------------------------
// getEntityTimeline()
// ---------------------------------------------------------------------------

describe('TruthMaintainer.getEntityTimeline()', () => {
  it('returns chronological changes ordered by tx_start ASC', async () => {
    await tm.processPropertyChange({
      entityId: TEST_ENTITY_ID,
      key: 'color',
      value: 'red',
      actionType: 'set',
    });
    await tm.processPropertyChange({
      entityId: TEST_ENTITY_ID,
      key: 'size',
      value: 'large',
      actionType: 'set',
    });

    const timeline = tm.getEntityTimeline(TEST_ENTITY_ID);
    expect(timeline.length).toBeGreaterThanOrEqual(2);

    // Chronological order
    for (let i = 0; i < timeline.length - 1; i++) {
      expect(timeline[i].txStart).toBeLessThanOrEqual(timeline[i + 1].txStart);
    }
  });

  it('includes all change types in timeline', async () => {
    await tm.processPropertyChange({
      entityId: TEST_ENTITY_ID,
      key: 'field',
      value: 'A',
      actionType: 'set',
    });
    await tm.processPropertyChange({
      entityId: TEST_ENTITY_ID,
      key: 'field',
      value: 'B',
      actionType: 'update',
      sourceAuthority: 'official',
    });

    const timeline = tm.getEntityTimeline(TEST_ENTITY_ID);
    expect(timeline.length).toBeGreaterThanOrEqual(2);

    const keys = timeline.map((t) => t.key);
    expect(keys).toContain('field');
  });
});

// ---------------------------------------------------------------------------
// resolveConfirmRequest()
// ---------------------------------------------------------------------------

describe('TruthMaintainer.resolveConfirmRequest()', () => {
  it('accept answer -> disputed property becomes active', async () => {
    // Create a high-authority property
    await tm.processPropertyChange({
      entityId: TEST_ENTITY_ID,
      key: 'salary',
      value: '100k',
      actionType: 'set',
      sourceAuthority: 'official',
      confidence: 0.9,
    });

    // Dispute it with lower authority
    const disputeResult = await tm.processPropertyChange({
      entityId: TEST_ENTITY_ID,
      key: 'salary',
      value: '120k',
      actionType: 'set',
      sourceAuthority: 'hearsay',
      confidence: 0.5,
    });

    expect(disputeResult.action).toBe('disputed');
    expect(disputeResult.confirmRequestId).toBeDefined();

    // Accept the disputed value
    tm.resolveConfirmRequest(disputeResult.confirmRequestId!, 'accept');

    // The disputed property (120k) should now be active
    const active = tm.getActiveProperty(TEST_ENTITY_ID, 'salary');
    expect(active).toBeDefined();
    expect(active!.property_value).toBe('120k');
    expect(active!.status).toBe('active');
  });

  it('reject answer -> disputed property retracted', async () => {
    await tm.processPropertyChange({
      entityId: TEST_ENTITY_ID,
      key: 'office',
      value: 'Floor 3',
      actionType: 'set',
      sourceAuthority: 'official',
      confidence: 0.9,
    });

    const disputeResult = await tm.processPropertyChange({
      entityId: TEST_ENTITY_ID,
      key: 'office',
      value: 'Floor 7',
      actionType: 'set',
      sourceAuthority: 'hearsay',
      confidence: 0.4,
    });

    expect(disputeResult.confirmRequestId).toBeDefined();

    // Reject the disputed value
    tm.resolveConfirmRequest(disputeResult.confirmRequestId!, 'reject');

    // The disputed property should be retracted
    const history = tm.getPropertyHistory(TEST_ENTITY_ID, 'office');
    const disputed = history.find((h: any) => h.property_value === 'Floor 7');
    expect(disputed).toBeDefined();
    expect(disputed!.status).toBe('retracted');

    // Original should still be active
    const active = tm.getActiveProperty(TEST_ENTITY_ID, 'office');
    expect(active).toBeDefined();
    expect(active!.property_value).toBe('Floor 3');
  });

  it('throws for non-existent confirm request', () => {
    expect(() => tm.resolveConfirmRequest('nonexistent-id', 'accept')).toThrow(
      /not found/i,
    );
  });

  it('throws for already resolved confirm request', async () => {
    const result = await tm.processPropertyChange({
      entityId: TEST_ENTITY_ID,
      key: 'badge',
      value: 'gold',
      actionType: 'propose',
    });

    tm.resolveConfirmRequest(result.confirmRequestId!, 'accept');

    // Second resolve should throw
    expect(() => tm.resolveConfirmRequest(result.confirmRequestId!, 'reject')).toThrow(
      /already/i,
    );
  });
});
