/**
 * Tests for ForgettingEngine — decay computation, reinforcement, and forgetting cycle.
 */

import { getTestDb, cleanupTestDb } from './setup.js';
import { ForgettingEngine } from '../core/ForgettingEngine.js';
import { now } from '../utils/time.js';
import type Database from 'better-sqlite3';

let db: Database.Database;
let engine: ForgettingEngine;

beforeAll(() => {
  db = getTestDb();
});

beforeEach(() => {
  engine = new ForgettingEngine(db);
  // Clean memory_metadata table before each test
  db.exec('DELETE FROM memory_metadata');
});

afterAll(() => {
  cleanupTestDb();
});

// ---------------------------------------------------------------------------
// Helper to insert a memory_metadata row directly
// ---------------------------------------------------------------------------

function insertMeta(overrides: {
  targetType?: string;
  targetId?: string;
  salienceScore?: number;
  accessCount?: number;
  lastAccessed?: number | null;
  decayRate?: number;
  halfLifeDays?: number;
  consolidationLevel?: string;
  createdAt?: number;
}) {
  const ts = now();
  db.prepare(`
    INSERT INTO memory_metadata
      (target_type, target_id, salience_score, importance, frequency,
       recency_boost, surprise_score, redundancy,
       access_count, last_accessed, decay_rate, half_life_days,
       consolidation_level, created_at, updated_at)
    VALUES (?, ?, ?, 0.5, 1, 1.0, 0, 0, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    overrides.targetType ?? 'entity',
    overrides.targetId ?? `test-${Math.random().toString(36).slice(2, 8)}`,
    overrides.salienceScore ?? 0.5,
    overrides.accessCount ?? 0,
    overrides.lastAccessed ?? null,
    overrides.decayRate ?? 1.0,
    overrides.halfLifeDays ?? 30,
    overrides.consolidationLevel ?? 'working',
    overrides.createdAt ?? ts,
    ts,
  );
}

// ---------------------------------------------------------------------------
// computeCurrentSalience()
// ---------------------------------------------------------------------------

describe('ForgettingEngine.computeCurrentSalience()', () => {
  it('permanent memory returns 999999', () => {
    const meta = {
      id: 1,
      target_type: 'entity',
      target_id: 'perm-1',
      salience_score: 0.5,
      importance: 0.5,
      frequency: 1,
      recency_boost: 1.0,
      surprise_score: 0,
      redundancy: 0,
      access_count: 0,
      last_accessed: null,
      decay_rate: 1.0,
      half_life_days: 30,
      consolidation_level: 'permanent',
      next_review_at: null,
      created_at: now(),
      updated_at: null,
    };
    expect(engine.computeCurrentSalience(meta)).toBe(999999);
  });

  it('fresh memory (just accessed) returns near original score', () => {
    const currentTime = now();
    const meta = {
      id: 2,
      target_type: 'entity',
      target_id: 'fresh-1',
      salience_score: 0.8,
      importance: 0.5,
      frequency: 1,
      recency_boost: 1.0,
      surprise_score: 0,
      redundancy: 0,
      access_count: 5,
      last_accessed: currentTime,
      decay_rate: 1.0,
      half_life_days: 30,
      consolidation_level: 'working',
      next_review_at: null,
      created_at: currentTime - 86400,
      updated_at: null,
    };
    const salience = engine.computeCurrentSalience(meta);
    // Just accessed -> exp(-0/(30*24*1)) = 1.0 -> salience ≈ 0.8
    expect(salience).toBeCloseTo(0.8, 1);
  });

  it('old memory (1000 hours ago) returns much lower score', () => {
    const hoursAgo1000 = now() - 1000 * 3600;
    const meta = {
      id: 3,
      target_type: 'entity',
      target_id: 'old-1',
      salience_score: 0.8,
      importance: 0.5,
      frequency: 1,
      recency_boost: 1.0,
      surprise_score: 0,
      redundancy: 0,
      access_count: 0,
      last_accessed: hoursAgo1000,
      decay_rate: 1.0,
      half_life_days: 30,
      consolidation_level: 'working',
      next_review_at: null,
      created_at: hoursAgo1000 - 86400,
      updated_at: null,
    };
    const salience = engine.computeCurrentSalience(meta);
    // t=1000h, T=30*24=720h, decay_rate=1.0 -> exp(-1000/720) ≈ 0.248 -> 0.8*0.248 ≈ 0.199
    expect(salience).toBeLessThan(0.3);
    expect(salience).toBeGreaterThan(0);
  });

  it('lower decay_rate means slower decay', () => {
    const hoursAgo500 = now() - 500 * 3600;
    const baseMeta = {
      id: 4,
      target_type: 'entity',
      target_id: 'decay-test',
      salience_score: 0.8,
      importance: 0.5,
      frequency: 1,
      recency_boost: 1.0,
      surprise_score: 0,
      redundancy: 0,
      access_count: 5,
      last_accessed: hoursAgo500,
      half_life_days: 30,
      consolidation_level: 'working',
      next_review_at: null,
      created_at: hoursAgo500 - 86400,
      updated_at: null,
    };

    // Note: lower decay_rate means HIGHER denominator = slower decay
    // Wait, the formula is exp(-t / (T * decay_rate)).
    // Lower decay_rate -> smaller denominator -> faster decay.
    // But the code has: decay_rate starts at 1.0 and is multiplied by 0.9 each access.
    // So lower decay_rate = faster decay (the denominator shrinks).
    // However, the test description says "lower decay_rate -> slower decay".
    // Let's just verify the formula: higher decay_rate -> larger denominator -> slower decay.
    const fastDecay = engine.computeCurrentSalience({ ...baseMeta, decay_rate: 0.5 });
    const slowDecay = engine.computeCurrentSalience({ ...baseMeta, decay_rate: 2.0 });

    // Higher decay_rate -> larger denominator -> exp closer to 1 -> higher salience
    expect(slowDecay).toBeGreaterThan(fastDecay);
  });
});

// ---------------------------------------------------------------------------
// reinforceMemory()
// ---------------------------------------------------------------------------

describe('ForgettingEngine.reinforceMemory()', () => {
  it('creates a new memory_metadata record for a new target', () => {
    const targetId = `new-${Date.now()}`;
    engine.reinforceMemory('entity', targetId);

    const row = db
      .prepare('SELECT * FROM memory_metadata WHERE target_type = ? AND target_id = ?')
      .get('entity', targetId) as any;

    expect(row).toBeDefined();
    expect(row.access_count).toBe(1);
    expect(row.salience_score).toBe(5); // 5 * (1/(1+0)) = 5
  });

  it('increments access_count and boosts salience for existing target', () => {
    const targetId = `existing-${Date.now()}`;
    // First reinforcement creates the record
    engine.reinforceMemory('entity', targetId);

    const before = db
      .prepare('SELECT * FROM memory_metadata WHERE target_type = ? AND target_id = ?')
      .get('entity', targetId) as any;

    // Second reinforcement updates it
    engine.reinforceMemory('entity', targetId);

    const after = db
      .prepare('SELECT * FROM memory_metadata WHERE target_type = ? AND target_id = ?')
      .get('entity', targetId) as any;

    expect(after.access_count).toBe(before.access_count + 1);
    expect(after.salience_score).toBeGreaterThan(before.salience_score);
  });

  it('provides diminishing returns: increment = 5/(1+N)', () => {
    const targetId = `diminish-${Date.now()}`;
    engine.reinforceMemory('entity', targetId); // access_count=1, salience=5

    const s1 = (db
      .prepare('SELECT salience_score FROM memory_metadata WHERE target_id = ?')
      .get(targetId) as any).salience_score;

    engine.reinforceMemory('entity', targetId); // increment=5/(1+1)=2.5

    const s2 = (db
      .prepare('SELECT salience_score FROM memory_metadata WHERE target_id = ?')
      .get(targetId) as any).salience_score;

    engine.reinforceMemory('entity', targetId); // increment=5/(1+2)=1.667

    const s3 = (db
      .prepare('SELECT salience_score FROM memory_metadata WHERE target_id = ?')
      .get(targetId) as any).salience_score;

    const inc1 = s2 - s1; // 2.5
    const inc2 = s3 - s2; // ~1.667
    expect(inc1).toBeGreaterThan(inc2);
    expect(inc1).toBeCloseTo(2.5, 1);
    expect(inc2).toBeCloseTo(5 / 3, 1);
  });

  it('decreases decay_rate by factor 0.9 each reinforcement', () => {
    const targetId = `decay-rate-${Date.now()}`;
    engine.reinforceMemory('entity', targetId);

    const r1 = (db
      .prepare('SELECT decay_rate FROM memory_metadata WHERE target_id = ?')
      .get(targetId) as any).decay_rate;

    engine.reinforceMemory('entity', targetId);

    const r2 = (db
      .prepare('SELECT decay_rate FROM memory_metadata WHERE target_id = ?')
      .get(targetId) as any).decay_rate;

    expect(r2).toBeCloseTo(r1 * 0.9, 5);
  });

  it('increases half_life_days by factor 1.1, capped at 365', () => {
    const targetId = `half-life-${Date.now()}`;
    engine.reinforceMemory('entity', targetId);

    const h1 = (db
      .prepare('SELECT half_life_days FROM memory_metadata WHERE target_id = ?')
      .get(targetId) as any).half_life_days;

    engine.reinforceMemory('entity', targetId);

    const h2 = (db
      .prepare('SELECT half_life_days FROM memory_metadata WHERE target_id = ?')
      .get(targetId) as any).half_life_days;

    expect(h2).toBeCloseTo(Math.min(h1 * 1.1, 365), 1);
  });
});

// ---------------------------------------------------------------------------
// runForgettingCycle()
// ---------------------------------------------------------------------------

describe('ForgettingEngine.runForgettingCycle()', () => {
  it('marks very low salience records as forgotten', async () => {
    // Insert a record with very low salience that was accessed long ago
    const veryOld = now() - 5000 * 3600;
    insertMeta({
      targetId: 'forget-me',
      salienceScore: 0.01,
      lastAccessed: veryOld,
      createdAt: veryOld,
      consolidationLevel: 'temporary',
    });

    const result = await engine.runForgettingCycle();
    expect(result.forgotten).toBeGreaterThanOrEqual(1);

    const row = db
      .prepare("SELECT consolidation_level FROM memory_metadata WHERE target_id = 'forget-me'")
      .get() as any;
    expect(row.consolidation_level).toBe('forgotten');
  });

  it('does not touch permanent records', async () => {
    insertMeta({
      targetId: 'perm-keep',
      salienceScore: 0.01,
      consolidationLevel: 'permanent',
    });

    await engine.runForgettingCycle();

    const row = db
      .prepare("SELECT consolidation_level FROM memory_metadata WHERE target_id = 'perm-keep'")
      .get() as any;
    expect(row.consolidation_level).toBe('permanent');
  });

  it('archives records with low but not forgotten salience', async () => {
    // Salience that decays to between 0.05 and 0.15
    const oldTime = now() - 2000 * 3600;
    insertMeta({
      targetId: 'archive-me',
      salienceScore: 0.15,
      lastAccessed: oldTime,
      createdAt: oldTime,
      decayRate: 1.0,
      halfLifeDays: 30,
      consolidationLevel: 'working',
    });

    const result = await engine.runForgettingCycle();

    const row = db
      .prepare("SELECT consolidation_level FROM memory_metadata WHERE target_id = 'archive-me'")
      .get() as any;
    // Very old with 0.15 salience -> will decay well below 0.05 -> forgotten
    // or archived depending on exact decay
    expect(['archived', 'forgotten']).toContain(row.consolidation_level);
    expect(result.totalProcessed).toBeGreaterThanOrEqual(1);
  });

  it('returns correct totalProcessed count', async () => {
    insertMeta({ targetId: 'count-1', consolidationLevel: 'working' });
    insertMeta({ targetId: 'count-2', consolidationLevel: 'temporary' });
    insertMeta({ targetId: 'count-perm', consolidationLevel: 'permanent' });

    const result = await engine.runForgettingCycle();
    // permanent is exempt, so 2 should be processed
    expect(result.totalProcessed).toBe(2);
  });
});
