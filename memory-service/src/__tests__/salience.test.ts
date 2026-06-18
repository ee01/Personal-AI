/**
 * Tests for SalienceScorer — pure computation methods and threshold logic.
 */

import { getTestDb, cleanupTestDb } from './setup.js';
import { SalienceScorer } from '../core/SalienceScorer.js';
import { now } from '../utils/time.js';
import type { SalienceInput } from '../core/SalienceScorer.js';
import type Database from 'better-sqlite3';

let db: Database.Database;
let scorer: SalienceScorer;

beforeAll(() => {
  db = getTestDb();
});

beforeEach(() => {
  scorer = new SalienceScorer(db);
});

afterAll(() => {
  cleanupTestDb();
});

// ---------------------------------------------------------------------------
// score() — pure computation with default weights
// ---------------------------------------------------------------------------

describe('SalienceScorer.score()', () => {
  it('high importance yields a high score', () => {
    const input: SalienceInput = {
      importance: 1.0,
      frequency: 0,
      recency: 0.5,
      surprise: 0.5,
      redundancy: 0,
    };
    const result = scorer.score(input);
    // alpha=0.35*1 + beta=0.20*0 + gamma=0.15*0.5 + eta=0.10*0.5 + zeta=0.15*0 = 0.35+0.075+0.05 = 0.475
    expect(result.score).toBeGreaterThan(0.4);
  });

  it('positive entity affinity boosts the score; negative affinity does not (P0-4 P1)', () => {
    const base: SalienceInput = {
      importance: 0.4,
      frequency: 0,
      recency: 0.3,
      surprise: 0.2,
      redundancy: 0,
    };
    const baseScore = scorer.score(base).score;

    const boosted = scorer.score({ ...base, entityAffinityBoost: 0.8 }).score;
    expect(boosted).toBeGreaterThan(baseScore);

    // Negative affinity must never change the intake score relative to base
    // (the negative side never blocks storage).
    const negative = scorer.score({ ...base, entityAffinityBoost: -0.5 }).score;
    expect(negative).toBeCloseTo(baseScore, 6);
  });

  it('high redundancy (>0.7) penalises the score', () => {
    const baseInput: SalienceInput = {
      importance: 0.5,
      frequency: 2,
      recency: 0.5,
      surprise: 0.3,
      redundancy: 0,
    };
    const baseResult = scorer.score(baseInput);

    const redundantInput: SalienceInput = { ...baseInput, redundancy: 1.0 };
    const redundantResult = scorer.score(redundantInput);

    // delta=0.40 * max(0, 1.0-0.7) = 0.40*0.3 = 0.12 penalty
    expect(redundantResult.score).toBeLessThan(baseResult.score);
  });

  it('redundancy <= 0.7 does not penalise', () => {
    const input: SalienceInput = {
      importance: 0.5,
      frequency: 2,
      recency: 0.5,
      surprise: 0.3,
      redundancy: 0.7,
    };
    const noPenalty = scorer.score(input);

    const lowerRedundancy: SalienceInput = { ...input, redundancy: 0 };
    const noRedundancy = scorer.score(lowerRedundancy);

    // Both should have the same score (no penalty below threshold)
    expect(noPenalty.score).toBeCloseTo(noRedundancy.score, 5);
  });

  it('all zeros yields score of 0', () => {
    const input: SalienceInput = {
      importance: 0,
      frequency: 0,
      recency: 0,
      surprise: 0,
      redundancy: 0,
    };
    const result = scorer.score(input);
    expect(result.score).toBe(0);
  });

  it('all ones yields a reasonable score', () => {
    const input: SalienceInput = {
      importance: 1,
      frequency: 5,
      recency: 1,
      surprise: 1,
      redundancy: 1,
    };
    const result = scorer.score(input);
    // alpha*1 + beta*1 + gamma*1 + eta*1 - delta*0.3
    // 0.35 + 0.15 + 0.25 + 0.15 - 0.12 = 0.78
    expect(result.score).toBeGreaterThan(0.5);
    expect(result.score).toBeLessThanOrEqual(1);
  });

  it('score is always clamped between 0 and 1', () => {
    // Try to push above 1
    const high: SalienceInput = {
      importance: 1,
      frequency: 100,
      recency: 1,
      surprise: 1,
      redundancy: 0,
    };
    expect(scorer.score(high).score).toBeLessThanOrEqual(1);

    // Try to push below 0 (high redundancy, everything else low)
    const low: SalienceInput = {
      importance: 0,
      frequency: 0,
      recency: 0,
      surprise: 0,
      redundancy: 1,
    };
    expect(scorer.score(low).score).toBeGreaterThanOrEqual(0);
  });

  it('returns components in the result for debugging', () => {
    const input: SalienceInput = {
      importance: 0.7,
      frequency: 3,
      recency: 0.8,
      surprise: 0.2,
      redundancy: 0.1,
    };
    const result = scorer.score(input);
    expect(result.components).toEqual(input);
  });
});

// ---------------------------------------------------------------------------
// computeRecency()
// ---------------------------------------------------------------------------

describe('SalienceScorer.computeRecency()', () => {
  it('returns ~1.0 for the current timestamp', () => {
    const recency = scorer.computeRecency(now());
    expect(recency).toBeGreaterThan(0.99);
    expect(recency).toBeLessThanOrEqual(1.0);
  });

  it('returns < 1.0 but > 0 for 24 hours ago', () => {
    const dayAgo = now() - 24 * 3600;
    const recency = scorer.computeRecency(dayAgo);
    // exp(-0.01 * 24) = exp(-0.24) ≈ 0.787
    expect(recency).toBeGreaterThan(0.5);
    expect(recency).toBeLessThan(1.0);
  });

  it('returns close to 0 for 1000 hours ago', () => {
    const veryOld = now() - 1000 * 3600;
    const recency = scorer.computeRecency(veryOld);
    // exp(-0.01 * 1000) = exp(-10) ≈ 0.0000454
    expect(recency).toBeLessThan(0.01);
    expect(recency).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// shouldIndex threshold
// ---------------------------------------------------------------------------

describe('SalienceScorer.shouldIndex threshold', () => {
  it('score >= 0.3 -> shouldIndex true', () => {
    const input: SalienceInput = {
      importance: 0.8,
      frequency: 3,
      recency: 0.7,
      surprise: 0.5,
      redundancy: 0,
    };
    const result = scorer.score(input);
    expect(result.score).toBeGreaterThanOrEqual(0.3);
    expect(result.shouldIndex).toBe(true);
  });

  it('score < 0.3 -> shouldIndex false', () => {
    const input: SalienceInput = {
      importance: 0.1,
      frequency: 0,
      recency: 0.1,
      surprise: 0,
      redundancy: 0.9,
    };
    const result = scorer.score(input);
    // 0.35*0.1 + 0.15*0 + 0.25*0.1 + 0.15*0 - 0.40*0.2
    // = 0.035 + 0.025 - 0.08 = -0.02 -> clamped to 0
    expect(result.score).toBeLessThan(0.3);
    expect(result.shouldIndex).toBe(false);
  });
});

describe('SalienceScorer.ensureMetadata()', () => {
  it('persists salience components and initializes lifecycle salience when available', () => {
    const targetId = `metadata-components-${Date.now()}`;
    const components: SalienceInput = {
      importance: 0.82,
      frequency: 3,
      recency: 0.91,
      surprise: 0.44,
      redundancy: 0.18,
      userInterestBoost: 0.3,
    };

    scorer.ensureMetadata('message', targetId, 0.73, components);

    const row = db
      .prepare(
        `SELECT salience_score, importance, frequency, recency_boost,
                surprise_score, redundancy, effective_salience, retrieval_tier
         FROM memory_metadata
         WHERE target_type = 'message' AND target_id = ?`,
      )
      .get(targetId) as {
      salience_score: number;
      importance: number;
      frequency: number;
      recency_boost: number;
      surprise_score: number;
      redundancy: number;
      effective_salience?: number;
      retrieval_tier?: string;
    };

    expect(row.salience_score).toBeCloseTo(0.73);
    expect(row.importance).toBeCloseTo(components.importance);
    expect(row.frequency).toBeCloseTo(components.frequency);
    expect(row.recency_boost).toBeCloseTo(components.recency);
    expect(row.surprise_score).toBeCloseTo(components.surprise);
    expect(row.redundancy).toBeCloseTo(components.redundancy);
    expect(row.effective_salience).toBeCloseTo(0.73);
    expect(row.retrieval_tier).toBe('active');
  });
});
