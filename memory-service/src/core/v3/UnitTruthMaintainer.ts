/**
 * v3 UnitTruthMaintainer (memory-foundation plan §5.6): the single entry
 * point for memory-unit state changes in the v3 schema.
 *
 * propose(candidate, sources, actor, workUnitKey) →
 *   created | corroborated | refined | disputed | superseded | rejected |
 *   pending_user_confirmation
 *
 * Hard rules encoded here (plan §4.2 / §5.6):
 *   I2  every unit row is committed together with ≥1 normalized source row
 *       and its append-only revision snapshot, in ONE SQLite transaction.
 *   I5  the same work_unit_key replays the existing integration receipt;
 *       a same-key/different-candidate_hash replay is a hard error.
 *   I6  same evidence_key or same provenance_family never raises
 *       confidence (independence is counted across families).
 *   CAS concurrency uses BEGIN IMMEDIATE + current_revision compare.
 *
 * Conflict policy v1 (version recorded in truth_policies + revisions):
 *   - same subject+predicate+scope, same normalized text → corroborate
 *   - different text → disputed (NEVER auto-supersede; system_inference
 *     can never supersede a non-inference source — plan §5.6)
 *   - only user confirmation (actor confirmation_state) can supersede
 */

import type Database from 'better-sqlite3';
import { createHash, randomUUID } from 'node:crypto';

import { spanTextHashOf } from './EpisodeRepository.js';

export const TRUTH_POLICY_VERSION = 'truth-policies-v1';

export type UnitEvidenceClass =
  | 'self_statement'
  | 'first_party_record'
  | 'official_source'
  | 'third_party_report'
  | 'system_inference';

export interface UnitCandidate {
  memoryForm: 'semantic' | 'episodic' | 'procedural';
  kind:
    | 'note' | 'fact' | 'preference' | 'decision' | 'action_item'
    | 'event' | 'risk' | 'open_question' | 'opinion' | 'procedure'
    | 'insight' | 'brief';
  subjectKey: string;
  predicateKey: string;
  text: string;
  language?: string;
  observedAt?: number | null;
  scopeLocator?: string;
  sensitivity?: 'public' | 'internal' | 'private' | 'restricted';
  confirmationState?: 'unconfirmed' | 'user_confirmed' | 'user_rejected';
}

export interface UnitSourceInput {
  episodeId: string;
  spanStart: number;
  spanEnd: number;
  sourceRole: string;
  evidenceKey: string;
  provenanceFamily: string;
  originType?: string;
  evidenceClass: UnitEvidenceClass;
  /** When omitted, the span hash is computed from the episode body. */
  spanTextHash?: string;
}

export interface ProposeActor {
  actorType: 'user' | 'system' | 'llm' | 'adapter';
  actorId: string;
  userId: string;
  tenantId?: string;
}

export type ProposeDecision =
  | 'created'
  | 'corroborated'
  | 'refined'
  | 'disputed'
  | 'superseded'
  | 'rejected'
  | 'pending_user_confirmation';

export interface ProposeResult {
  decision: ProposeDecision;
  unitId: string;
  revision: number;
  receipt: {
    workUnitKey: string;
    candidateHash: string;
    decision: ProposeDecision;
    targetRevision: number;
  };
}

interface UnitRow {
  id: string;
  tenant_id: string;
  owner_user_id: string;
  memory_form: string;
  kind: string;
  status: string;
  subject_key: string | null;
  predicate_key: string | null;
  text: string;
  normalized_text: string | null;
  language: string | null;
  observed_at: number | null;
  confidence: number;
  scope_locator: string | null;
  sensitivity: string;
  confirmation_state: string;
  source_independence_count_cached: number;
  evidence_class_set_cached: string | null;
  current_revision: number;
}

function candidateHashOf(candidate: UnitCandidate, sources: UnitSourceInput[]): string {
  const payload = JSON.stringify({
    c: {
      f: candidate.memoryForm,
      k: candidate.kind,
      s: candidate.subjectKey,
      p: candidate.predicateKey,
      t: candidate.text.trim(),
      o: candidate.observedAt ?? null,
    },
    srcs: sources
      .map((s) => [s.episodeId, s.spanStart, s.spanEnd, s.sourceRole, s.evidenceKey, s.evidenceClass])
      .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
  });
  return createHash('sha256').update(payload, 'utf8').digest('hex');
}

function normalizeText(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLowerCase();
}

export class UnitTruthMaintainer {
  constructor(
    private readonly db: Database.Database,
    private readonly episodes: import('./EpisodeRepository.js').EpisodeRepository,
  ) {}

  /**
   * Idempotent truth integration. The whole decision commits atomically:
   * receipt + unit + sources + revision + body view + projection outbox.
   */
  propose(
    candidate: UnitCandidate,
    sources: UnitSourceInput[],
    actor: ProposeActor,
    workUnitKey: string,
  ): ProposeResult {
    if (sources.length === 0) {
      throw new Error('[UnitTruthMaintainer] propose requires at least one source row (I2)');
    }
    const candidateHash = candidateHashOf(candidate, sources);

    // I5 — replay returns the existing receipt.
    const existing = this.db
      .prepare(
        `SELECT work_unit_key, candidate_hash, decision, target_type, target_id, target_revision
         FROM truth_integrations WHERE work_unit_key = ?`,
      )
      .get(workUnitKey) as
      | { work_unit_key: string; candidate_hash: string; decision: string; target_type: string; target_id: string; target_revision: number }
      | undefined;
    if (existing) {
      if (existing.candidate_hash !== candidateHash) {
        throw new Error(
          `[UnitTruthMaintainer] work_unit_key replay with different candidate hash: ${workUnitKey} (hard error, receipt preserved)`,
        );
      }
      return {
        decision: existing.decision as ProposeDecision,
        unitId: existing.target_id,
        revision: existing.target_revision,
        receipt: {
          workUnitKey,
          candidateHash,
          decision: existing.decision as ProposeDecision,
          targetRevision: existing.target_revision,
        },
      };
    }

    // Resolve/validate every source span against the persisted episode body.
    const preparedSources = sources.map((s) => {
      let spanText: string;
      try {
        spanText = this.episodes.getSpan(s.episodeId, s.spanStart, s.spanEnd);
      } catch (err) {
        throw new Error(
          `[UnitTruthMaintainer] source span invalid (${s.episodeId} ${s.spanStart}-${s.spanEnd}): ${(err as Error).message}`,
        );
      }
      const computedHash = spanTextHashOf(spanText);
      if (s.spanTextHash && s.spanTextHash !== computedHash) {
        throw new Error(
          `[UnitTruthMaintainer] span hash drift for ${s.episodeId} ${s.spanStart}-${s.spanEnd}: stored ${s.spanTextHash.slice(0, 8)}… actual ${computedHash.slice(0, 8)}…`,
        );
      }
      return { ...s, spanTextHash: computedHash };
    });

    // better-sqlite3: the returned transaction function supports mode
    // variants — .immediate() issues BEGIN IMMEDIATE for compare-and-swap
    // concurrency (plan §5.6: no last-write-wins).
    const integrateTx = this.db.transaction(() =>
      this.integrate(candidate, preparedSources, actor, workUnitKey, candidateHash),
    );
    return integrateTx.immediate();
  }

  private integrate(
    candidate: UnitCandidate,
    sources: Array<UnitSourceInput & { spanTextHash: string }>,
    actor: ProposeActor,
    workUnitKey: string,
    candidateHash: string,
  ): ProposeResult {
    const tenantId = actor.tenantId ?? 'default';
    const nowSec = Math.floor(Date.now() / 1000);

    // Conflict scope: tenant + owner + subject + predicate + scope (plan §5.6).
    const conflicting = this.db
      .prepare(
        `SELECT * FROM memory_units
         WHERE tenant_id = ? AND owner_user_id = ?
           AND subject_key = ? AND predicate_key = ?
           AND COALESCE(scope_locator, '') = COALESCE(?, '')
           AND status IN ('provisional', 'active', 'disputed')
           AND (valid_to IS NULL OR valid_to > ?)
         ORDER BY updated_at DESC
         LIMIT 1`,
      )
      .get(
        tenantId,
        actor.userId,
        candidate.subjectKey,
        candidate.predicateKey,
        candidate.scopeLocator ?? null,
        nowSec,
      ) as UnitRow | undefined;

    const decision: ProposeDecision = this.decide(candidate, sources, conflicting);

    if (decision === 'rejected') {
      const receipt = this.writeReceipt(workUnitKey, candidateHash, decision, 'none', '', 0);
      return { decision, unitId: '', revision: 0, receipt };
    }

    if (!conflicting) {
      const unitId = randomUUID();
      const revision = 1;
      this.db
        .prepare(
          `INSERT INTO memory_units
            (id, tenant_id, owner_user_id, memory_form, kind, status,
             subject_key, predicate_key, text, normalized_text, language,
             observed_at, observed_at_quality, valid_from, tx_start,
             confirmation_state, confidence, scope_locator, sensitivity,
             source_independence_count_cached, evidence_class_set_cached,
             current_revision, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 'provisional', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
        )
        .run(
          unitId,
          tenantId,
          actor.userId,
          candidate.memoryForm,
          candidate.kind,
          candidate.subjectKey,
          candidate.predicateKey,
          candidate.text,
          normalizeText(candidate.text),
          candidate.language ?? null,
          candidate.observedAt ?? null,
          candidate.observedAt ? 'source_timestamp' : null,
          candidate.observedAt ?? null,
          nowSec,
          candidate.confirmationState === 'user_confirmed' ? 'user_confirmed' : 'unconfirmed',
          candidate.confirmationState === 'user_confirmed' ? 0.9 : 0.6,
          candidate.scopeLocator ?? null,
          candidate.sensitivity ?? 'internal',
          1,
          JSON.stringify([...new Set(sources.map((s) => s.evidenceClass))]),
          nowSec,
          nowSec,
        );
      this.writeSources(unitId, sources, nowSec);
      this.writeRevision(unitId, 1, 'created', null, unitId, actor, workUnitKey);
      this.writeBodyView(unitId, candidate, 1, actor, nowSec);
      const receipt = this.writeReceipt(workUnitKey, candidateHash, 'created', 'unit', unitId, 1);
      return { decision: 'created', unitId, revision, receipt };
    }

    // Existing unit: dedupe sources by evidence_key — replayed evidence
    // never re-integrates (I5) and never reinforces (I6).
    const existingKeys = new Set(
      (this.db
        .prepare(`SELECT evidence_key FROM memory_unit_sources WHERE unit_id = ?`)
        .all(conflicting.id) as Array<{ evidence_key: string }>).map((r) => r.evidence_key),
    );
    const newSources = sources.filter((s) => !existingKeys.has(s.evidenceKey));

    const sameText = normalizeText(conflicting.text) === normalizeText(candidate.text);

    if (newSources.length === 0 && sameText) {
      // Pure evidence replay: receipt only, unit state untouched.
      const receipt = this.writeReceipt(workUnitKey, candidateHash, 'corroborated', 'unit', conflicting.id, conflicting.current_revision);
      return {
        decision: 'corroborated',
        unitId: conflicting.id,
        revision: conflicting.current_revision,
        receipt,
      };
    }

    const finalDecision: ProposeDecision = sameText ? 'corroborated' : 'disputed';

    const families = new Set(
      (this.db
        .prepare(`SELECT provenance_family FROM memory_unit_sources WHERE unit_id = ?`)
        .all(conflicting.id) as Array<{ provenance_family: string }>).map((r) => r.provenance_family),
    );
    const familiesBefore = families.size;
    newSources.forEach((s) => families.add(s.provenanceFamily));
    const independence = families.size;
    // I5/I6 spirit: confidence grows ONLY with newly independent families
    // (same evidence_key / provenance_family replays never reinforce) or
    // explicit user confirmation, capped.
    const newFamilies = Math.max(0, independence - familiesBefore);
    const confidence = Math.min(
      0.95,
      conflicting.confidence + (sameText ? 0.08 * newFamilies : 0),
    );

    const newStatus =
      finalDecision === 'disputed' ? 'disputed' : conflicting.status;

    const updated = this.db
      .prepare(
        `UPDATE memory_units
         SET status = ?, confidence = ?,
             source_independence_count_cached = ?,
             current_revision = current_revision + 1,
             updated_at = ?
         WHERE id = ? AND current_revision = ?`,
      )
      .run(newStatus, confidence, independence, nowSec, conflicting.id, conflicting.current_revision);
    if (updated.changes !== 1) {
      throw new Error(
        `[UnitTruthMaintainer] CAS conflict on unit ${conflicting.id}; reload truth and retry (no last-write-wins)`,
      );
    }
    const newRevision = conflicting.current_revision + 1;
    this.writeSources(conflicting.id, newSources, nowSec);
    this.writeRevision(conflicting.id, newRevision, finalDecision, conflicting.id, conflicting.id, actor, workUnitKey);
    const receipt = this.writeReceipt(workUnitKey, candidateHash, finalDecision, 'unit', conflicting.id, newRevision);
    return { decision: finalDecision, unitId: conflicting.id, revision: newRevision, receipt };
  }

  /**
   * Policy v1 decisions. System-inference candidates never supersede a
   * non-inference existing unit (plan §5.6); conflicts stay disputed until a
   * user confirms — which arrives through a separate high-responsibility
   * path, not through replaying propose(). Corroborate-vs-dispute is decided
   * by normalized-text comparison in integrate().
   */
  private decide(
    candidate: UnitCandidate,
    sources: UnitSourceInput[],
    conflicting: UnitRow | undefined,
  ): ProposeDecision {
    if (!conflicting) return 'created';
    const inferenceOnly = sources.every((s) => s.evidenceClass === 'system_inference');
    if (inferenceOnly && conflicting.status === 'disputed') return 'rejected';
    return 'disputed_or_corroborated' as ProposeDecision;
  }

  private writeSources(
    unitId: string,
    sources: Array<UnitSourceInput & { spanTextHash: string }>,
    nowSec: number,
  ): void {
    const stmt = this.db.prepare(
      `INSERT INTO memory_unit_sources
        (unit_id, episode_id, span_start_byte, span_end_byte, span_text_hash,
         source_role, evidence_key, provenance_family, origin_type, evidence_class, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const s of sources) {
      stmt.run(
        unitId,
        s.episodeId,
        s.spanStart,
        s.spanEnd,
        s.spanTextHash,
        s.sourceRole,
        s.evidenceKey,
        s.provenanceFamily,
        s.originType ?? null,
        s.evidenceClass,
        nowSec,
      );
    }
  }

  private writeRevision(
    unitId: string,
    revision: number,
    operation: string,
    beforeUnitId: string | null,
    afterUnitId: string,
    actor: ProposeActor,
    requestId: string,
  ): void {
    const after = this.db
      .prepare(`SELECT * FROM memory_units WHERE id = ?`)
      .get(afterUnitId) as Record<string, unknown> | undefined;
    const before = beforeUnitId
      ? (this.db.prepare(`SELECT * FROM memory_units WHERE id = ?`).get(beforeUnitId) as
          | Record<string, unknown>
          | undefined)
      : null;
    this.db
      .prepare(
        `INSERT INTO memory_unit_revisions
          (unit_id, revision, operation, before_snapshot_json, after_snapshot_json,
           reason, actor_type, actor_id, request_id, truth_policy_version, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        unitId,
        revision,
        operation,
        before ? JSON.stringify(before) : null,
        after ? JSON.stringify(after) : null,
        operation,
        actor.actorType,
        actor.actorId,
        requestId,
        TRUTH_POLICY_VERSION,
        Math.floor(Date.now() / 1000),
      );
  }

  private writeBodyView(
    unitId: string,
    candidate: UnitCandidate,
    revision: number,
    actor: ProposeActor,
    nowSec: number,
  ): void {
    this.db
      .prepare(
        `INSERT INTO memory_unit_views
          (unit_id, view_kind, raw_text, segmented_text, language,
           source_unit_revision, created_by, model, prompt_version, embedding_model, created_at)
         VALUES (?, 'body', ?, ?, ?, ?, ?, NULL, NULL, NULL, ?)`,
      )
      .run(
        unitId,
        candidate.text,
        candidate.text,
        candidate.language ?? null,
        revision,
        `actor:${actor.actorType}/${actor.actorId}`,
        nowSec,
      );
    const view = this.db
      .prepare(`SELECT view_id FROM memory_unit_views WHERE unit_id = ? AND view_kind = 'body'`)
      .get(unitId) as { view_id: number };
    // Projection outbox task (I4: FTS synced via triggers; vec deferred to
    // the embedding-config decision from P0.5).
    this.db
      .prepare(
        `INSERT INTO projection_outbox
          (projection_key, unit_id, view_kind, source_unit_revision, projection_config_hash,
           status, attempts, last_error, created_at, updated_at)
         VALUES (?, ?, 'body', ?, 'p0c-fts-config-v1', 'pending', 0, NULL, ?, ?)`,
      )
      .run(`body-fts:${unitId}:${revision}`, unitId, revision, nowSec, nowSec);
    void view;
  }

  private writeReceipt(
    workUnitKey: string,
    candidateHash: string,
    decision: ProposeDecision,
    targetType: string,
    targetId: string,
    targetRevision: number,
  ): ProposeResult['receipt'] {
    this.db
      .prepare(
        `INSERT INTO truth_integrations
          (work_unit_key, candidate_hash, truth_policy_version, decision,
           target_type, target_id, target_revision, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        workUnitKey,
        candidateHash,
        TRUTH_POLICY_VERSION,
        decision,
        targetType,
        targetId,
        targetRevision,
        Math.floor(Date.now() / 1000),
      );
    return {
      workUnitKey,
      candidateHash,
      decision,
      targetRevision,
    };
  }
}
