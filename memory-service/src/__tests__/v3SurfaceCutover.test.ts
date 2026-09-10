/**
 * P2 §11.7 surface cutover tests: flag gating (default off, per-user
 * allowlist), and the non-inferiority gate harness (paired bootstrap CI).
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  isSurfaceCutOver,
  evaluateSurfaceGate,
  type ShadowObservation,
} from '../core/v3/SurfaceCutover.js';

describe('P2 surface cutover flags', () => {
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of Object.keys(process.env)) {
      if (key.startsWith('MEMORY_READ_V3_')) {
        savedEnv[key] = process.env[key];
        delete process.env[key];
      }
    }
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('all surfaces default off', () => {
    expect(isSurfaceCutOver('ask')).toBe(false);
    expect(isSurfaceCutOver('compose')).toBe(false);
    expect(isSurfaceCutOver('passive')).toBe(false);
  });

  it('enabling a surface only affects that surface', () => {
    process.env.MEMORY_READ_V3_ASK = 'true';
    expect(isSurfaceCutOver('ask')).toBe(true);
    expect(isSurfaceCutOver('compose')).toBe(false);
    expect(isSurfaceCutOver('passive')).toBe(false);
  });

  it('per-user allowlist restricts cutover to listed users', () => {
    process.env.MEMORY_READ_V3_ASK = 'true';
    process.env.MEMORY_READ_V3_ASK_USERS = 'alice,bob';
    expect(isSurfaceCutOver('ask', 'alice')).toBe(true);
    expect(isSurfaceCutOver('ask', 'carol')).toBe(false);
    expect(isSurfaceCutOver('ask')).toBe(false); // no userId provided
  });
});

describe('P2 non-inferiority gate harness', () => {
  it('insufficient data → verdict=insufficient_data', () => {
    const result = evaluateSurfaceGate('ask', []);
    expect(result.verdict).toBe('insufficient_data');
    expect(result.nonInferior).toBe(false);
  });

  it('v3 ≥ legacy passes the 2pp non-inferiority gate', () => {
    const obs: ShadowObservation[] = [];
    for (let i = 0; i < 50; i += 1) {
      obs.push({
        legacyCount: 3 + (i % 3),
        v3Count: 3 + (i % 3), // identical
        overlapCount: 3,
        v3OnlyCount: 0,
        requestId: `r-${i}`,
      });
    }
    const result = evaluateSurfaceGate('ask', obs);
    expect(result.verdict).toBe('pass');
    expect(result.ci95[0]).toBeGreaterThanOrEqual(-0.02);
  });

  it('v3 consistently worse than legacy fails the gate', () => {
    const obs: ShadowObservation[] = [];
    for (let i = 0; i < 50; i += 1) {
      obs.push({
        legacyCount: 5,
        v3Count: 1, // v3 always much worse
        overlapCount: 1,
        v3OnlyCount: 0,
        requestId: `r-${i}`,
      });
    }
    const result = evaluateSurfaceGate('ask', obs);
    expect(result.verdict).toBe('fail');
  });
});
