/**
 * P3 + P4 tests: consolidation phase gating, profile auto-promotion rules,
 * FSRS-lite lifecycle, exposure/outcome recording, and the full ACL/egress
 * negative test matrix (plan §10.2, §12.5 safety hard gates).
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type BetterSqlite3 from 'better-sqlite3';
import { getTestDb } from './setup.js';
import { EpisodeRepository } from '../core/v3/EpisodeRepository.js';
import { UnitTruthMaintainer } from '../core/v3/UnitTruthMaintainer.js';
import { ExposureOutcomeService } from '../core/v3/ExposureOutcomeService.js';
import {
  isConsolidationPhaseEnabled,
  canAutoPromoteProfile,
  classifyOutcomeImpact,
  computeStability,
} from '../core/v3/ConsolidationPhases.js';
import {
  EgressPolicyEngine,
  type Principal,
  type MemoryItem,
  type DestinationContext,
} from '../core/v3/EgressPolicyEngine.js';

describe('P3 consolidation phase gating (§11.8)', () => {
  const saved = process.env.MEMORY_CONSOLIDATION_V3;

  afterEach(() => {
    if (saved === undefined) delete process.env.MEMORY_CONSOLIDATION_V3;
    else process.env.MEMORY_CONSOLIDATION_V3 = saved;
  });

  it('all phases default off', () => {
    delete process.env.MEMORY_CONSOLIDATION_V3;
    for (const phase of ['A', 'B', 'C', 'D', 'E'] as const) {
      expect(isConsolidationPhaseEnabled(phase)).toBe(false);
    }
  });

  it('comma-separated whitelist enables specific phases', () => {
    process.env.MEMORY_CONSOLIDATION_V3 = 'A,B';
    expect(isConsolidationPhaseEnabled('A')).toBe(true);
    expect(isConsolidationPhaseEnabled('B')).toBe(true);
    expect(isConsolidationPhaseEnabled('C')).toBe(false);
    expect(isConsolidationPhaseEnabled('D')).toBe(false);
    expect(isConsolidationPhaseEnabled('E')).toBe(false);
  });
});

describe('P3 profile auto-promotion rules (§6.6)', () => {
  it('durable slots always need user confirmation', () => {
    expect(canAutoPromoteProfile({ sensitivity: 'durable', independentSourceCount: 5 })).toBe(false);
    expect(canAutoPromoteProfile({ sensitivity: 'sensitive', independentSourceCount: 5 })).toBe(false);
  });

  it('normal slots need ≥2 independent sources', () => {
    expect(canAutoPromoteProfile({ sensitivity: 'normal', independentSourceCount: 1 })).toBe(false);
    expect(canAutoPromoteProfile({ sensitivity: 'normal', independentSourceCount: 2 })).toBe(true);
  });
});

describe('P3 outcome → lifecycle impact (§7.8/§8.4)', () => {
  it('shown/opened = pure exposure, never affects lifecycle (I9)', () => {
    expect(classifyOutcomeImpact({ unitId: 'x', outcomeType: 'opened' })).toBe('none');
    expect(classifyOutcomeImpact({ unitId: 'x', outcomeType: 'opened' })).toBe('none');
  });

  it('dismissed = decay; adopted = utility bump; confirmed = confirmation', () => {
    expect(classifyOutcomeImpact({ unitId: 'x', outcomeType: 'dismissed' })).toBe('decay');
    expect(classifyOutcomeImpact({ unitId: 'x', outcomeType: 'adopted' })).toBe('utility_bump');
    expect(classifyOutcomeImpact({ unitId: 'x', outcomeType: 'user_confirmed' })).toBe('confirmation');
    expect(classifyOutcomeImpact({ unitId: 'x', outcomeType: 'user_corrected' })).toBe('correction');
    expect(classifyOutcomeImpact({ unitId: 'x', outcomeType: 'user_rejected' })).toBe('correction');
    expect(classifyOutcomeImpact({ unitId: 'x', outcomeType: 'downstream_task_failure' })).toBe('correction');
  });

  it('FSRS-lite stability: confirmation ×1.8, utility ×1.15, correction ×0.7', () => {
    expect(computeStability(2.0, 'confirmation')).toBeCloseTo(3.6);
    expect(computeStability(2.0, 'utility_bump')).toBeCloseTo(2.3);
    expect(computeStability(2.0, 'correction')).toBeCloseTo(1.4);
    expect(computeStability(2.0, 'none')).toBe(2.0);
    expect(computeStability(1.0, 'confirmation')).toBeLessThanOrEqual(10); // capped
  });
});

describe('P3 ExposureOutcomeService (§7.8)', () => {
  let db: BetterSqlite3.Database;
  let svc: ExposureOutcomeService;
  let unitId: string;

  const seedUnit = () => {
    const epId = `ep-${Math.random().toString(36).slice(2)}`;
    db.prepare(
      `INSERT INTO messages_raw (id, content, source_type, sender, scope, timestamp, trust_class, claim_attribution_status, claim_attribution_version, created_at)
       VALUES (?, 'test SPAN content', 'glip', 'c', 'work', 1780000000, 'internal', 'pending', 1, 1780000000)`,
    ).run(epId);
    const truth = new UnitTruthMaintainer(db, new EpisodeRepository(db));
    const result = truth.propose(
      { memoryForm: 'semantic', kind: 'fact', subjectKey: 'exp-test', predicateKey: 'is', text: 'exposure test fact', language: 'en', observedAt: 1780000000 },
      [{ episodeId: epId, spanStart: 5, spanEnd: 9, sourceRole: 'primary', evidenceKey: 'ev-exp', provenanceFamily: epId, evidenceClass: 'self_statement' }],
      { actorType: 'system', actorId: 't', userId: 'test-user' },
      'wuk-exp-test',
    );
    return result.unitId;
  };

  beforeEach(() => {
    db = getTestDb();
    for (const t of [
      'memory_exposures', 'memory_outcomes', 'unit_lifecycle',
      'projection_outbox', 'memory_unit_views', 'memory_unit_revisions',
      'memory_unit_sources', 'memory_units', 'truth_integrations',
    ]) {
      db.prepare(`DELETE FROM ${t}`).run();
    }
    db.prepare(`DELETE FROM messages_raw WHERE id LIKE 'ep-%'`).run();
    svc = new ExposureOutcomeService(db);
    unitId = seedUnit();
  });

  it('exposures recorded but never touch lifecycle (I9)', () => {
    const count = svc.recordExposures('req-1', [
      { requestId: 'req-1', unitId, surface: 'ask', rank: 1, shown: true, quieted: false, noResult: false },
      { requestId: 'req-1', unitId, surface: 'ask', rank: 2, shown: true, quieted: false, noResult: false },
    ]);
    expect(count).toBe(2);
    const lifecycle = db.prepare('SELECT * FROM unit_lifecycle WHERE unit_id = ?').get(unitId);
    expect(lifecycle).toBeUndefined(); // no lifecycle row from pure exposure
  });

  it('outcome adopted → utility_bump creates lifecycle row with stability', () => {
    const { impact, newStability } = svc.recordOutcome({
      unitId, outcomeType: 'adopted', surface: 'compose',
    });
    expect(impact).toBe('utility_bump');
    expect(newStability).toBeGreaterThan(0);
    const row = db.prepare('SELECT * FROM unit_lifecycle WHERE unit_id = ?').get(unitId) as any;
    expect(row).toBeTruthy();
    expect(row.stability).toBeCloseTo(newStability);
    expect(row.access_count).toBe(1);
  });

  it('outcome opened → impact=none, no lifecycle row (I9)', () => {
    const { impact } = svc.recordOutcome({ unitId, outcomeType: 'opened' });
    expect(impact).toBe('none');
    const row = db.prepare('SELECT * FROM unit_lifecycle WHERE unit_id = ?').get(unitId);
    expect(row).toBeUndefined();
  });

  it('user_confirmed → stability boosted, explicit_reinforce incremented', () => {
    svc.recordOutcome({ unitId, outcomeType: 'user_confirmed' });
    const row1 = db.prepare('SELECT stability, explicit_reinforce_count FROM unit_lifecycle WHERE unit_id = ?').get(unitId) as any;
    expect(row1.explicit_reinforce_count).toBe(1);
    svc.recordOutcome({ unitId, outcomeType: 'user_confirmed' });
    const row2 = db.prepare('SELECT stability, explicit_reinforce_count FROM unit_lifecycle WHERE unit_id = ?').get(unitId) as any;
    expect(row2.explicit_reinforce_count).toBe(2);
    expect(row2.stability).toBeGreaterThan(row1.stability);
  });
});

describe('P4 ACL/egress negative test matrix (§10.2, §12.5)', () => {
  const owner: Principal = { tenantId: 't1', userId: 'user-a', scope: 'user' };
  const otherUser: Principal = { tenantId: 't1', userId: 'user-b', scope: 'user' };
  const otherTenant: Principal = { tenantId: 't2', userId: 'user-a', scope: 'user' };
  const sandboxAgent: Principal = { tenantId: 't1', userId: 'agent-x', scope: 'sandbox', claimedByUserId: null };
  const claimedAgent: Principal = { tenantId: 't1', userId: 'agent-x', scope: 'agent', claimedByUserId: 'user-a' };

  const baseItem: MemoryItem = {
    tenantId: 't1',
    ownerUserId: 'user-a',
    sensitivity: 'internal',
    egressPolicy: 'approved_destinations',
    scopeLocator: null,
    status: 'active',
  };

  const localDest: DestinationContext = { destinationHost: 'local', modelProvider: null, purpose: 'recall' };
  const externalDest: DestinationContext = { destinationHost: 'api.external.com', modelProvider: 'openai', purpose: 'recall' };

  it('owner can read internal items locally', () => {
    const r = EgressPolicyEngine.checkRead(owner, baseItem, localDest);
    expect(r.allowed).toBe(true);
  });

  it('cross-tenant read denied', () => {
    const r = EgressPolicyEngine.checkRead(otherTenant, baseItem, localDest);
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe('cross_tenant');
  });

  it('non-owner read denied', () => {
    const r = EgressPolicyEngine.checkRead(otherUser, baseItem, localDest);
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe('not_owner_or_claimed_agent');
  });

  it('sandbox agent denied real data', () => {
    const r = EgressPolicyEngine.checkRead(sandboxAgent, baseItem, localDest);
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe('sandbox_no_real_data');
  });

  it('claimed agent can read for its claiming user', () => {
    const r = EgressPolicyEngine.checkRead(claimedAgent, baseItem, localDest);
    expect(r.allowed).toBe(true);
  });

  it('retracted item blocked from all reads (I6)', () => {
    const r = EgressPolicyEngine.checkRead(owner, { ...baseItem, status: 'retracted' }, localDest);
    expect(r.allowed).toBe(false);
    expect(r.reason).toContain('status');
  });

  it('local_only never egresses to external destination', () => {
    const r = EgressPolicyEngine.checkRead(owner, { ...baseItem, egressPolicy: 'local_only' }, externalDest);
    expect(r.allowed).toBe(false);
    expect(r.reason).toContain('local_only');
  });

  it('private/restricted items blocked from external egress', () => {
    const r = EgressPolicyEngine.checkRead(owner, { ...baseItem, sensitivity: 'private' }, externalDest);
    expect(r.allowed).toBe(false);
    expect(r.reason).toContain('sensitivity_private');
    const r2 = EgressPolicyEngine.checkRead(owner, { ...baseItem, sensitivity: 'restricted' }, externalDest);
    expect(r2.allowed).toBe(false);
  });

  it('user_selected requires preview purpose', () => {
    const r = EgressPolicyEngine.checkRead(owner, { ...baseItem, egressPolicy: 'user_selected' }, { ...externalDest, purpose: 'recall' });
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe('user_selected_requires_preview_purpose');
  });

  it('missing destination fields fail-closed (I10)', () => {
    const r = EgressPolicyEngine.checkRead(owner, baseItem, { destinationHost: '', modelProvider: null, purpose: '' });
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe('missing_destination_fields');
  });

  it('adapter cannot set user_confirmed; only user UI/token can (§10.1)', () => {
    expect(EgressPolicyEngine.canSetUserConfirmed('adapter')).toBe(false);
    expect(EgressPolicyEngine.canSetUserConfirmed('agent')).toBe(false);
    expect(EgressPolicyEngine.canSetUserConfirmed('user_ui')).toBe(true);
    expect(EgressPolicyEngine.canSetUserConfirmed('user_token')).toBe(true);
  });

  it('adapter surface is the fixed 5-operation set (§11.9)', () => {
    expect([...EgressPolicyEngine.ADAPTER_OPERATIONS]).toEqual([
      'recall', 'open_sources', 'write_explicit', 'feedback', 'delete',
    ]);
    // All operations require re-authorization on every call.
    for (const op of EgressPolicyEngine.ADAPTER_OPERATIONS) {
      expect(EgressPolicyEngine.requireReAuthorization(op)).toBe(true);
    }
  });
});
