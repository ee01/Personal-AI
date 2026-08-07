import type BetterSqlite3 from 'better-sqlite3';

import type {
  ClaimAttributionSignal,
  ClaimCommitmentState,
  ClaimOwnerKind,
  ClaimPassiveRecallPolicy,
  ClaimPolarity,
  ClaimSpeechMode,
  ClaimTimeBasis,
  ClaimVerificationState,
  MemoryClaimEnvelope,
  MemoryClaimPolicy,
  MessageClaimAttributionStatus,
  MemoryClaimCorrection,
} from '../types/index.js';
import { now } from '../utils/time.js';

interface MemoryClaimRow {
  id: string;
  source_message_id: string;
  span_start: number;
  span_end: number;
  span_text_hash: string;
  source_text: string;
  normalized_claim: string;
  owner_kind: ClaimOwnerKind;
  owner_entity_id: string | null;
  owner_display_name: string | null;
  speech_mode: ClaimSpeechMode;
  polarity: ClaimPolarity;
  time_basis: ClaimTimeBasis;
  verification_state: ClaimVerificationState;
  commitment_state: ClaimCommitmentState;
  confidence: number;
  signals_json: string;
  profile_candidate: number;
  current_truth_candidate: number;
  action_candidate: number;
  passive_recall: ClaimPassiveRecallPolicy;
  revision: number;
  status: MemoryClaimEnvelope['status'];
  corrected: number;
  created_at: number;
  updated_at: number;
}

export interface MemoryClaimLink {
  id: number;
  claimId: string;
  targetType: string;
  targetId: string;
  linkRole: string;
  status: 'active' | 'invalidated';
  invalidatedAt?: number;
  invalidationReason?: string;
}

export interface MessageClaimState {
  status: MessageClaimAttributionStatus;
  version: number;
  attributedAt?: number;
  error?: string;
}

export interface MemoryClaimRevisionRecord {
  id: string;
  claimId: string;
  revision: number;
  previous: MemoryClaimEnvelope;
  next: MemoryClaimEnvelope;
  correction: MemoryClaimCorrection;
  correctionSource: string;
  idempotencyKey?: string;
  invalidatedDerived: Record<string, number>;
  undoneAt?: number;
  createdAt: number;
}

const safeJsonArray = <T>(raw: string): T[] => {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
};

const safeJsonObject = <T extends Record<string, unknown>>(
  raw: string,
): T => {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as T)
      : ({} as T);
  } catch {
    return {} as T;
  }
};

function rowToRevision(row: {
  id: string;
  claim_id: string;
  revision: number;
  previous_attribution_json: string;
  next_attribution_json: string;
  correction: MemoryClaimCorrection;
  correction_source: string;
  idempotency_key: string | null;
  invalidated_derived_json: string;
  undone_at: number | null;
  created_at: number;
}): MemoryClaimRevisionRecord {
  return {
    id: row.id,
    claimId: row.claim_id,
    revision: row.revision,
    previous: JSON.parse(row.previous_attribution_json) as MemoryClaimEnvelope,
    next: JSON.parse(row.next_attribution_json) as MemoryClaimEnvelope,
    correction: row.correction,
    correctionSource: row.correction_source,
    idempotencyKey: row.idempotency_key ?? undefined,
    invalidatedDerived: safeJsonObject<Record<string, number>>(
      row.invalidated_derived_json,
    ),
    undoneAt: row.undone_at ?? undefined,
    createdAt: row.created_at,
  };
}

function rowToEnvelope(row: MemoryClaimRow): MemoryClaimEnvelope {
  const policy: MemoryClaimPolicy = {
    profileCandidate: row.profile_candidate === 1,
    currentTruthCandidate: row.current_truth_candidate === 1,
    actionCandidate: row.action_candidate === 1,
    passiveRecall: row.passive_recall,
  };
  return {
    id: row.id,
    sourceMessageId: row.source_message_id,
    sourceSpan: {
      start: row.span_start,
      end: row.span_end,
      textHash: row.span_text_hash,
    },
    sourceText: row.source_text,
    normalizedClaim: row.normalized_claim,
    owner: {
      kind: row.owner_kind,
      entityId: row.owner_entity_id ?? undefined,
      displayName: row.owner_display_name ?? undefined,
    },
    speechMode: row.speech_mode,
    polarity: row.polarity,
    timeBasis: row.time_basis,
    verification: row.verification_state,
    commitment: row.commitment_state,
    confidence: row.confidence,
    signals: safeJsonArray<ClaimAttributionSignal>(row.signals_json),
    policy,
    revision: row.revision,
    status: row.status,
    corrected: row.corrected === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class MemoryClaimRepository {
  constructor(private readonly db: BetterSqlite3.Database) {}

  getMessageState(messageId: string): MessageClaimState | null {
    const row = this.db
      .prepare(
        `SELECT claim_attribution_status, claim_attribution_version,
                claim_attributed_at, claim_attribution_error
         FROM messages_raw
         WHERE id = ?`,
      )
      .get(messageId) as
      | {
          claim_attribution_status: MessageClaimAttributionStatus;
          claim_attribution_version: number;
          claim_attributed_at: number | null;
          claim_attribution_error: string | null;
        }
      | undefined;
    if (!row) return null;
    return {
      status: row.claim_attribution_status,
      version: row.claim_attribution_version,
      attributedAt: row.claim_attributed_at ?? undefined,
      error: row.claim_attribution_error ?? undefined,
    };
  }

  setMessageState(
    messageId: string,
    status: MessageClaimAttributionStatus,
    options: { version?: number; error?: string } = {},
  ): void {
    const timestamp = now();
    this.db
      .prepare(
        `UPDATE messages_raw
         SET claim_attribution_status = ?,
             claim_attribution_version = ?,
             claim_attributed_at = ?,
             claim_attribution_error = ?,
             updated_at = COALESCE(updated_at, ?)
         WHERE id = ?`,
      )
      .run(
        status,
        options.version ?? 1,
        status === 'resolved' || status === 'failed' ? timestamp : null,
        options.error?.slice(0, 240) ?? null,
        timestamp,
        messageId,
      );
  }

  replaceActiveClaims(
    messageId: string,
    claims: MemoryClaimEnvelope[],
    resolverVersion: string,
  ): void {
    const transaction = this.db.transaction(() => {
      this.db
        .prepare(
          `UPDATE memory_claims
           SET status = 'stale', updated_at = ?
           WHERE source_message_id = ? AND status = 'active'`,
        )
        .run(now(), messageId);

      const insert = this.db.prepare(
        `INSERT INTO memory_claims (
           id, source_message_id, span_start, span_end, span_text_hash,
           source_text, normalized_claim, owner_kind, owner_entity_id,
           owner_display_name, speech_mode, polarity, time_basis,
           verification_state, commitment_state, confidence, signals_json,
           profile_candidate, current_truth_candidate, action_candidate,
           passive_recall, revision, status, corrected, resolver_version,
           created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(source_message_id, span_start, span_end, span_text_hash)
         DO UPDATE SET
           source_text = excluded.source_text,
           normalized_claim = excluded.normalized_claim,
           owner_kind = CASE WHEN memory_claims.corrected = 1 THEN memory_claims.owner_kind ELSE excluded.owner_kind END,
           owner_entity_id = CASE WHEN memory_claims.corrected = 1 THEN memory_claims.owner_entity_id ELSE excluded.owner_entity_id END,
           owner_display_name = CASE WHEN memory_claims.corrected = 1 THEN memory_claims.owner_display_name ELSE excluded.owner_display_name END,
           speech_mode = CASE WHEN memory_claims.corrected = 1 THEN memory_claims.speech_mode ELSE excluded.speech_mode END,
           polarity = CASE WHEN memory_claims.corrected = 1 THEN memory_claims.polarity ELSE excluded.polarity END,
           time_basis = CASE WHEN memory_claims.corrected = 1 THEN memory_claims.time_basis ELSE excluded.time_basis END,
           verification_state = CASE WHEN memory_claims.corrected = 1 THEN memory_claims.verification_state ELSE excluded.verification_state END,
           commitment_state = CASE WHEN memory_claims.corrected = 1 THEN memory_claims.commitment_state ELSE excluded.commitment_state END,
           confidence = CASE WHEN memory_claims.corrected = 1 THEN memory_claims.confidence ELSE excluded.confidence END,
           signals_json = CASE WHEN memory_claims.corrected = 1 THEN memory_claims.signals_json ELSE excluded.signals_json END,
           profile_candidate = CASE WHEN memory_claims.corrected = 1 THEN memory_claims.profile_candidate ELSE excluded.profile_candidate END,
           current_truth_candidate = CASE WHEN memory_claims.corrected = 1 THEN memory_claims.current_truth_candidate ELSE excluded.current_truth_candidate END,
           action_candidate = CASE WHEN memory_claims.corrected = 1 THEN memory_claims.action_candidate ELSE excluded.action_candidate END,
           passive_recall = CASE WHEN memory_claims.corrected = 1 THEN memory_claims.passive_recall ELSE excluded.passive_recall END,
           status = 'active',
           resolver_version = excluded.resolver_version,
           updated_at = excluded.updated_at`,
      );

      for (const claim of claims) {
        insert.run(
          claim.id,
          messageId,
          claim.sourceSpan.start,
          claim.sourceSpan.end,
          claim.sourceSpan.textHash,
          claim.sourceText,
          claim.normalizedClaim,
          claim.owner.kind,
          claim.owner.entityId ?? null,
          claim.owner.displayName ?? null,
          claim.speechMode,
          claim.polarity,
          claim.timeBasis,
          claim.verification,
          claim.commitment,
          claim.confidence,
          JSON.stringify(claim.signals),
          claim.policy.profileCandidate ? 1 : 0,
          claim.policy.currentTruthCandidate ? 1 : 0,
          claim.policy.actionCandidate ? 1 : 0,
          claim.policy.passiveRecall,
          claim.revision,
          claim.status,
          claim.corrected ? 1 : 0,
          resolverVersion,
          claim.createdAt,
          claim.updatedAt,
        );
      }
    });
    transaction();
  }

  getClaimsForMessage(
    messageId: string,
    options: { includeInactive?: boolean } = {},
  ): MemoryClaimEnvelope[] {
    const whereStatus = options.includeInactive ? '' : "AND status = 'active'";
    const rows = this.db
      .prepare(
        `SELECT * FROM memory_claims
         WHERE source_message_id = ? ${whereStatus}
         ORDER BY span_start ASC, span_end ASC`,
      )
      .all(messageId) as MemoryClaimRow[];
    return rows.map(rowToEnvelope);
  }

  getClaim(claimId: string): MemoryClaimEnvelope | null {
    const row = this.db
      .prepare('SELECT * FROM memory_claims WHERE id = ?')
      .get(claimId) as MemoryClaimRow | undefined;
    return row ? rowToEnvelope(row) : null;
  }

  findMessageIdForEvidence(
    type: string,
    id: string,
    metadata?: Record<string, unknown>,
  ): string | null {
    const explicit = [
      metadata?.messageId,
      metadata?.sourceMessageId,
      metadata?.relatedMessageId,
    ].find((value) => typeof value === 'string' && value.trim());
    if (typeof explicit === 'string') return explicit.trim();

    if (type === 'message') {
      const row = this.db
        .prepare('SELECT id FROM messages_raw WHERE id = ?')
        .get(id) as { id: string } | undefined;
      return row?.id ?? null;
    }

    if (type === 'chunk') {
      const normalized = id.replace(/^chunk:/, '');
      if (!/^\d+$/.test(normalized)) return null;
      const row = this.db
        .prepare(
          `SELECT related_entity_id
           FROM chunks
           WHERE chunk_id = ?`,
        )
        .get(Number(normalized)) as { related_entity_id: string | null } | undefined;
      if (!row?.related_entity_id) return null;
      const message = this.db
        .prepare('SELECT id FROM messages_raw WHERE id = ?')
        .get(row.related_entity_id) as { id: string } | undefined;
      return message?.id ?? null;
    }

    return null;
  }

  linkDerived(
    claimId: string,
    targetType: string,
    targetId: string | number,
    linkRole: string,
  ): void {
    const timestamp = now();
    this.db
      .prepare(
        `INSERT INTO memory_claim_links (
           claim_id, target_type, target_id, link_role, status,
           invalidated_at, invalidation_reason, created_at, updated_at
         ) VALUES (?, ?, ?, ?, 'active', NULL, NULL, ?, ?)
         ON CONFLICT(claim_id, target_type, target_id, link_role)
         DO UPDATE SET
           status = 'active', invalidated_at = NULL,
           invalidation_reason = NULL, updated_at = excluded.updated_at`,
      )
      .run(claimId, targetType, String(targetId), linkRole, timestamp, timestamp);
  }

  getActiveLinks(claimId: string): MemoryClaimLink[] {
    const rows = this.db
      .prepare(
        `SELECT id, claim_id, target_type, target_id, link_role, status,
                invalidated_at, invalidation_reason
         FROM memory_claim_links
         WHERE claim_id = ? AND status = 'active'`,
      )
      .all(claimId) as Array<{
      id: number;
      claim_id: string;
      target_type: string;
      target_id: string;
      link_role: string;
      status: 'active' | 'invalidated';
      invalidated_at: number | null;
      invalidation_reason: string | null;
    }>;
    return rows.map((row) => ({
      id: row.id,
      claimId: row.claim_id,
      targetType: row.target_type,
      targetId: row.target_id,
      linkRole: row.link_role,
      status: row.status,
      invalidatedAt: row.invalidated_at ?? undefined,
      invalidationReason: row.invalidation_reason ?? undefined,
    }));
  }

  countOtherActiveLinks(
    claimId: string,
    targetType: string,
    targetId: string,
  ): number {
    const row = this.db
      .prepare(
        `SELECT COUNT(*) AS count
         FROM memory_claim_links
         WHERE claim_id <> ? AND target_type = ? AND target_id = ?
           AND status = 'active'`,
      )
      .get(claimId, targetType, targetId) as { count: number };
    return row.count;
  }

  invalidateLink(linkId: number, reason: string): void {
    const timestamp = now();
    this.db
      .prepare(
        `UPDATE memory_claim_links
         SET status = 'invalidated', invalidated_at = ?,
             invalidation_reason = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(timestamp, reason, timestamp, linkId);
  }

  updateClaimAttribution(claim: MemoryClaimEnvelope): void {
    this.db
      .prepare(
        `UPDATE memory_claims
         SET owner_kind = ?, owner_entity_id = ?, owner_display_name = ?,
             speech_mode = ?, polarity = ?, time_basis = ?,
             verification_state = ?, commitment_state = ?, confidence = ?,
             signals_json = ?, profile_candidate = ?,
             current_truth_candidate = ?, action_candidate = ?,
             passive_recall = ?, revision = ?, corrected = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(
        claim.owner.kind,
        claim.owner.entityId ?? null,
        claim.owner.displayName ?? null,
        claim.speechMode,
        claim.polarity,
        claim.timeBasis,
        claim.verification,
        claim.commitment,
        claim.confidence,
        JSON.stringify(claim.signals),
        claim.policy.profileCandidate ? 1 : 0,
        claim.policy.currentTruthCandidate ? 1 : 0,
        claim.policy.actionCandidate ? 1 : 0,
        claim.policy.passiveRecall,
        claim.revision,
        claim.corrected ? 1 : 0,
        claim.updatedAt,
        claim.id,
      );
  }

  getRevisionByIdempotencyKey(
    claimId: string,
    idempotencyKey: string,
  ): MemoryClaimRevisionRecord | null {
    const row = this.db
      .prepare(
        `SELECT * FROM memory_claim_revisions
         WHERE claim_id = ? AND idempotency_key = ?`,
      )
      .get(claimId, idempotencyKey) as Parameters<typeof rowToRevision>[0] | undefined;
    return row ? rowToRevision(row) : null;
  }

  getLatestActiveRevision(claimId: string): MemoryClaimRevisionRecord | null {
    const row = this.db
      .prepare(
        `SELECT * FROM memory_claim_revisions
         WHERE claim_id = ? AND undone_at IS NULL
         ORDER BY revision DESC
         LIMIT 1`,
      )
      .get(claimId) as Parameters<typeof rowToRevision>[0] | undefined;
    return row ? rowToRevision(row) : null;
  }

  insertRevision(revision: MemoryClaimRevisionRecord): void {
    this.db
      .prepare(
        `INSERT INTO memory_claim_revisions (
           id, claim_id, revision, previous_attribution_json,
           next_attribution_json, correction, correction_source,
           idempotency_key, invalidated_derived_json, undone_at, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        revision.id,
        revision.claimId,
        revision.revision,
        JSON.stringify(revision.previous),
        JSON.stringify(revision.next),
        revision.correction,
        revision.correctionSource,
        revision.idempotencyKey ?? null,
        JSON.stringify(revision.invalidatedDerived),
        revision.undoneAt ?? null,
        revision.createdAt,
      );
  }

  markRevisionUndone(revisionId: string, undoneAt: number): void {
    this.db
      .prepare(
        `UPDATE memory_claim_revisions
         SET undone_at = ?
         WHERE id = ? AND undone_at IS NULL`,
      )
      .run(undoneAt, revisionId);
  }
}
