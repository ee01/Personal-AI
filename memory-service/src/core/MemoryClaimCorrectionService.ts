import { v4 as uuidv4 } from 'uuid';
import type BetterSqlite3 from 'better-sqlite3';

import {
  MemoryClaimRepository,
  type MemoryClaimLink,
  type MemoryClaimRevisionRecord,
} from '../repositories/MemoryClaimRepository.js';
import type {
  MemoryClaimCorrectionRequest,
  MemoryClaimCorrectionResponse,
  MemoryClaimEnvelope,
} from '../types/index.js';
import { now } from '../utils/time.js';
import { compileMemoryClaimPolicy } from './ClaimPolicyCompiler.js';

export class MemoryClaimNotFoundError extends Error {}

export class MemoryClaimRevisionConflictError extends Error {
  constructor(
    public readonly expectedRevision: number,
    public readonly currentRevision: number,
  ) {
    super(
      `Memory claim revision mismatch: expected ${expectedRevision}, current ${currentRevision}`,
    );
  }
}

export class MemoryClaimCorrectionValidationError extends Error {}

function correctedClaim(
  current: MemoryClaimEnvelope,
  request: MemoryClaimCorrectionRequest,
  undoRevision?: MemoryClaimRevisionRecord,
): MemoryClaimEnvelope {
  const timestamp = now();
  const next: MemoryClaimEnvelope = {
    ...current,
    owner: { ...current.owner },
    signals: Array.from(new Set([...current.signals, 'user_correction'])),
    revision: current.revision + 1,
    corrected: true,
    updatedAt: timestamp,
  };

  switch (request.correction) {
    case 'not_my_view':
      next.owner = { kind: 'unknown' };
      next.speechMode = 'reported_speech';
      next.commitment = 'none';
      next.confidence = 1;
      break;
    case 'my_decision':
      next.owner = { kind: 'self' };
      next.speechMode = 'correction';
      next.polarity = 'affirmed';
      next.timeBasis = 'current';
      next.commitment =
        current.commitment === 'assigned' || current.commitment === 'proposed'
          ? 'accepted'
          : current.commitment;
      next.confidence = 1;
      break;
    case 'reported_speech':
      next.owner =
        current.owner.kind === 'named_person'
          ? { ...current.owner }
          : { kind: 'unknown' };
      next.speechMode = 'reported_speech';
      next.commitment = 'none';
      next.confidence = 1;
      break;
    case 'hypothesis':
      next.speechMode = 'hypothesis';
      next.polarity = 'uncertain';
      next.timeBasis = 'hypothetical';
      next.commitment = 'none';
      next.confidence = 1;
      break;
    case 'undo_last': {
      if (!undoRevision) {
        throw new MemoryClaimCorrectionValidationError(
          'No correction revision is available to undo',
        );
      }
      const restored = undoRevision.previous;
      next.owner = { ...restored.owner };
      next.speechMode = restored.speechMode;
      next.polarity = restored.polarity;
      next.timeBasis = restored.timeBasis;
      next.verification = restored.verification;
      next.commitment = restored.commitment;
      next.confidence = restored.confidence;
      next.signals = Array.from(
        new Set([...restored.signals, 'user_correction']),
      );
      break;
    }
  }

  next.policy = compileMemoryClaimPolicy(next);
  return next;
}

export class MemoryClaimCorrectionService {
  private readonly repository: MemoryClaimRepository;

  constructor(private readonly db: BetterSqlite3.Database) {
    this.repository = new MemoryClaimRepository(db);
  }

  correct(
    claimId: string,
    request: MemoryClaimCorrectionRequest,
  ): MemoryClaimCorrectionResponse {
    if (request.idempotencyKey) {
      const existing = this.repository.getRevisionByIdempotencyKey(
        claimId,
        request.idempotencyKey,
      );
      if (existing) {
        if (existing.correction !== request.correction) {
          throw new MemoryClaimCorrectionValidationError(
            'The idempotency key was already used for a different correction',
          );
        }
        return this.toResponse(existing);
      }
    }

    const current = this.repository.getClaim(claimId);
    if (!current || current.status !== 'active') {
      throw new MemoryClaimNotFoundError(`Memory claim "${claimId}" not found`);
    }
    if (current.revision !== request.expectedRevision) {
      throw new MemoryClaimRevisionConflictError(
        request.expectedRevision,
        current.revision,
      );
    }

    const undoRevision =
      request.correction === 'undo_last'
        ? this.repository.getLatestActiveRevision(claimId)
        : undefined;
    const next = correctedClaim(current, request, undoRevision ?? undefined);

    return this.db.transaction(() => {
      const invalidatedDerived = this.invalidateDerivedClaims(
        claimId,
        `claim_correction:${request.correction}`,
      );
      const revision: MemoryClaimRevisionRecord = {
        id: uuidv4(),
        claimId,
        revision: next.revision,
        previous: current,
        next,
        correction: request.correction,
        correctionSource: request.source,
        idempotencyKey: request.idempotencyKey,
        invalidatedDerived,
        createdAt: now(),
      };

      this.repository.updateClaimAttribution(next);
      this.repository.insertRevision(revision);
      if (undoRevision) {
        this.repository.markRevisionUndone(undoRevision.id, now());
      }
      return this.toResponse(revision);
    })();
  }

  private invalidateDerivedClaims(
    claimId: string,
    reason: string,
  ): Record<string, number> {
    const counts: Record<string, number> = {};
    const links = this.repository.getActiveLinks(claimId);
    for (const link of links) {
      const changed = this.invalidateTarget(claimId, link);
      this.repository.invalidateLink(link.id, reason);
      const bucket = changed ? link.targetType : 'link_only';
      counts[bucket] = (counts[bucket] ?? 0) + 1;
    }
    return counts;
  }

  private invalidateTarget(claimId: string, link: MemoryClaimLink): boolean {
    const timestamp = now();
    const hasOtherEvidence =
      this.repository.countOtherActiveLinks(
        claimId,
        link.targetType,
        link.targetId,
      ) > 0;

    switch (link.targetType) {
      case 'profile_item':
        if (hasOtherEvidence) return false;
        this.db
          .prepare(
            `UPDATE user_profile_items
             SET status = 'retracted', updated_at = ?
             WHERE id = ? AND status IN ('active', 'pending_confirm')`,
          )
          .run(timestamp, link.targetId);
        this.db
          .prepare('UPDATE profile_sync_state SET profile_dirty = 1')
          .run();
        return true;
      case 'entity_property':
      case 'timeline_property':
        this.db
          .prepare(
            `UPDATE entity_properties
             SET status = 'retracted', tx_end = ?
             WHERE id = ? AND status = 'active'`,
          )
          .run(timestamp, link.targetId);
        return true;
      case 'opinion_item':
        if (hasOtherEvidence) return false;
        this.db
          .prepare(
            `UPDATE opinion_items
             SET status = 'retracted', updated_at = ?
             WHERE id = ? AND status IN ('active', 'pending_confirm')`,
          )
          .run(timestamp, link.targetId);
        return true;
      case 'memory_change_event':
        this.db
          .prepare(
            `UPDATE memory_change_events
             SET active = 0, updated_at = ?
             WHERE id = ? AND active = 1`,
          )
          .run(timestamp, link.targetId);
        return true;
      case 'action':
      case 'proposed_action':
        this.db
          .prepare(
            `UPDATE proposed_actions
             SET state = 'dismissed'
             WHERE id = ? AND state IN ('pending', 'approved')`,
          )
          .run(link.targetId);
        return true;
      default:
        return false;
    }
  }

  private toResponse(
    revision: MemoryClaimRevisionRecord,
  ): MemoryClaimCorrectionResponse {
    const invalidatedCount = Object.values(revision.invalidatedDerived).reduce(
      (total, count) => total + count,
      0,
    );
    return {
      claimId: revision.claimId,
      previous: revision.previous,
      current: revision.next,
      revision: revision.revision,
      invalidatedDerived: revision.invalidatedDerived,
      recomputeStatus: invalidatedCount > 0 ? 'required' : 'not_needed',
      rawSourceChanged: false,
    };
  }
}
