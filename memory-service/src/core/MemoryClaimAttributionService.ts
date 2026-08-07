import type BetterSqlite3 from 'better-sqlite3';

import { MemoryClaimRepository } from '../repositories/MemoryClaimRepository.js';
import type {
  ClaimAttributionEffect,
  ClaimAttributionReceipt,
  ClaimAttributionReceiptBucket,
  ClaimAttributionReceiptItem,
  ContextRecallMatch,
  IngestClaimAttributionDecision,
  MemoryClaimEnvelope,
  MemoryClaimPolicy,
  RecallItem,
} from '../types/index.js';
import { contentHash } from '../utils/hashing.js';
import { now } from '../utils/time.js';
import {
  segmentMemoryClaims,
  type ClaimSegmentationInput,
  type SegmentedMemoryClaim,
} from './ClaimSegmenter.js';
import { compileMemoryClaimPolicy } from './ClaimPolicyCompiler.js';

const RESOLVER_VERSION = 'deterministic-v1';

export type MemoryClaimSegmenter = (
  input: ClaimSegmentationInput,
) => SegmentedMemoryClaim[];

export interface MemoryClaimAttributionServiceOptions {
  segmenter?: MemoryClaimSegmenter;
}

export interface ClaimFilteredRecall<T> {
  items: T[];
  attributionReceipt?: ClaimAttributionReceipt;
}

export type MemoryClaimPolicyKey =
  | 'profileCandidate'
  | 'currentTruthCandidate'
  | 'actionCandidate';

function parseMetadata(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function ownerLabel(claim: MemoryClaimEnvelope): string {
  switch (claim.owner.kind) {
    case 'self':
      return '你';
    case 'ai_agent':
      return claim.owner.displayName || 'AI';
    case 'named_person':
      return claim.owner.displayName || '他人';
    case 'organization_or_source':
      return claim.owner.displayName || '外部来源';
    case 'system_observation':
      return claim.owner.displayName || '系统观察';
    default:
      return '归属未确认';
  }
}

function modeLabel(claim: MemoryClaimEnvelope): string {
  switch (claim.speechMode) {
    case 'quote':
      return '引用';
    case 'reported_speech':
      return '转述';
    case 'suggestion':
      return '建议';
    case 'question':
      return '提问';
    case 'hypothesis':
      return '假设';
    case 'simulation':
      return '模拟';
    case 'intent_or_plan':
      return '计划';
    case 'commitment':
      return claim.commitment === 'accepted' ? '已接受承诺' : '未接受承诺';
    case 'correction':
      return '已纠正决定';
    default:
      return '明确表达';
  }
}

function effectForClaim(claim: MemoryClaimEnvelope): ClaimAttributionEffect {
  if (claim.policy.passiveRecall === 'allow') return 'used';
  if (claim.policy.passiveRecall === 'background_only') {
    return 'background_only';
  }
  return 'blocked';
}

function consequenceForEffect(effect: ClaimAttributionEffect): string {
  switch (effect) {
    case 'used':
      return '可作为本轮直接证据';
    case 'background_only':
      return '仅作背景，不代表你的立场';
    case 'blocked':
      return '本轮不使用，也不会沉淀为你的事实或承诺';
  }
}

function claimToReceiptItem(
  claim: MemoryClaimEnvelope,
  effect = effectForClaim(claim),
): ClaimAttributionReceiptItem {
  const owner = ownerLabel(claim);
  const mode = modeLabel(claim);
  return {
    claimId: claim.id,
    sourceMessageId: claim.sourceMessageId,
    revision: claim.revision,
    excerpt: claim.sourceText.slice(0, 160),
    ownerKind: claim.owner.kind,
    ownerLabel: owner,
    speechMode: claim.speechMode,
    verification: claim.verification,
    commitment: claim.commitment,
    effect,
    displayLabel: `${owner} · ${mode}`,
    consequence: consequenceForEffect(effect),
    correctionAllowed: claim.status === 'active',
    corrected: claim.corrected,
  };
}

function bucketReceiptItems(
  items: ClaimAttributionReceiptItem[],
): ClaimAttributionReceiptBucket[] {
  const buckets = new Map<string, ClaimAttributionReceiptBucket>();
  for (const item of items) {
    const key = `${item.ownerKind}:${item.speechMode}`;
    const current = buckets.get(key);
    if (current) {
      current.count += 1;
    } else {
      buckets.set(key, {
        kind: key,
        label: item.displayLabel,
        count: 1,
      });
    }
  }
  return [...buckets.values()];
}

function summaryPart(
  label: string,
  items: ClaimAttributionReceiptItem[],
): string | null {
  if (items.length === 0) return null;
  return `${label} ${items.length} 条`;
}

function uniqueClaims(claims: MemoryClaimEnvelope[]): MemoryClaimEnvelope[] {
  return [...new Map(claims.map((claim) => [claim.id, claim])).values()];
}

export class MemoryClaimAttributionService {
  private readonly repository: MemoryClaimRepository;
  private readonly segmenter: MemoryClaimSegmenter;

  constructor(
    private readonly db: BetterSqlite3.Database,
    options: MemoryClaimAttributionServiceOptions = {},
  ) {
    this.repository = new MemoryClaimRepository(db);
    this.segmenter = options.segmenter ?? segmentMemoryClaims;
  }

  /**
   * Resolve and persist claims for one raw message. Raw storage is never rolled
   * back when attribution fails; callers must treat a failed result as a closed
   * high-responsibility gate.
   */
  ensureForMessage(
    messageId: string,
    options: { force?: boolean } = {},
  ): IngestClaimAttributionDecision {
    const existingState = this.repository.getMessageState(messageId);
    if (!existingState) {
      return {
        status: 'failed',
        claimCount: 0,
        highResponsibilityAllowed: 0,
        highResponsibilityBlocked: 0,
      };
    }

    const existingClaims = this.repository.getClaimsForMessage(messageId);
    if (
      !options.force &&
      existingState.status === 'resolved' &&
      existingClaims.length > 0
    ) {
      return this.toDecision('resolved', existingClaims);
    }
    if (!options.force && existingState.status === 'failed') {
      return this.toDecision('failed', existingClaims);
    }

    const row = this.db
      .prepare(
        `SELECT content, source_type, sender, metadata_json
         FROM messages_raw
         WHERE id = ?`,
      )
      .get(messageId) as
      | {
          content: string;
          source_type: string;
          sender: string | null;
          metadata_json: string | null;
        }
      | undefined;
    if (!row) {
      return {
        status: 'failed',
        claimCount: 0,
        highResponsibilityAllowed: 0,
        highResponsibilityBlocked: 0,
      };
    }

    this.repository.setMessageState(messageId, 'pending', { version: 1 });
    try {
      const segmented = this.segmenter({
        content: row.content,
        sourceMessageId: messageId,
        sourceType: row.source_type,
        sender: row.sender ?? undefined,
        metadata: parseMetadata(row.metadata_json),
      });
      if (row.content.trim() && segmented.length === 0) {
        throw new Error('claim_segmenter_returned_no_claims');
      }

      const timestamp = now();
      const claims = segmented.map((claim) =>
        this.toEnvelope(messageId, claim, timestamp),
      );
      this.repository.replaceActiveClaims(
        messageId,
        claims,
        RESOLVER_VERSION,
      );
      this.repository.setMessageState(messageId, 'resolved', { version: 1 });
      return this.toDecision('resolved', claims);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'claim_attribution_failed';
      this.repository.setMessageState(messageId, 'failed', {
        version: 1,
        error: message,
      });
      return {
        status: 'failed',
        claimCount: 0,
        highResponsibilityAllowed: 0,
        highResponsibilityBlocked: row.content.trim() ? 1 : 0,
      };
    }
  }

  getClaimsForMessage(
    messageId: string,
    options: { ensure?: boolean } = { ensure: true },
  ): MemoryClaimEnvelope[] {
    if (options.ensure !== false) this.ensureForMessage(messageId);
    return this.repository.getClaimsForMessage(messageId);
  }

  buildReceipt(
    claims: MemoryClaimEnvelope[],
    options: {
      effects?: Map<string, ClaimAttributionEffect>;
      affectedHighResponsibility?: boolean;
    } = {},
  ): ClaimAttributionReceipt | undefined {
    const deduplicated = uniqueClaims(claims);
    if (deduplicated.length === 0) return undefined;
    const items = deduplicated.map((claim) =>
      claimToReceiptItem(
        claim,
        options.effects?.get(claim.id) ?? effectForClaim(claim),
      ),
    );
    const used = items.filter((item) => item.effect === 'used');
    const backgroundOnly = items.filter(
      (item) => item.effect === 'background_only',
    );
    const blocked = items.filter((item) => item.effect === 'blocked');
    const correctedCount = items.filter((item) => item.corrected).length;
    const ordinary =
      backgroundOnly.length === 0 &&
      blocked.length === 0 &&
      correctedCount === 0 &&
      items.every(
        (item) =>
          item.ownerKind === 'self' &&
          (item.speechMode === 'direct_assertion' ||
            item.speechMode === 'correction'),
      );
    if (ordinary) return undefined;

    const ownerModes = new Set(
      items.map((item) => `${item.ownerKind}:${item.speechMode}`),
    );
    const status: ClaimAttributionReceipt['status'] =
      correctedCount > 0
        ? 'corrected'
        : backgroundOnly.length > 0 || blocked.length > 0
          ? 'downgraded'
          : ownerModes.size > 1
            ? 'mixed'
            : 'downgraded';
    const summary = [
      summaryPart('采用', used),
      summaryPart('仅作背景', backgroundOnly),
      summaryPart('未使用', blocked),
    ]
      .filter((part): part is string => Boolean(part))
      .join('；');
    return {
      status,
      visibility: options.affectedHighResponsibility ? 'review' : 'compact',
      summary,
      boundary:
        '归属回执只影响 Personal AI 如何使用派生记忆，不修改原始消息或外部系统。',
      used: bucketReceiptItems(used),
      backgroundOnly: bucketReceiptItems(backgroundOnly),
      blocked: bucketReceiptItems(blocked),
      claims: items,
      affectedHighResponsibility:
        options.affectedHighResponsibility === true,
      correctedCount,
    };
  }

  resolveCandidateClaim(
    claims: MemoryClaimEnvelope[],
    reference: { claimIndex?: number; claimText?: string },
    policyKey: MemoryClaimPolicyKey,
  ): MemoryClaimEnvelope | null {
    let claim: MemoryClaimEnvelope | undefined;
    if (
      Number.isInteger(reference.claimIndex) &&
      (reference.claimIndex as number) >= 0
    ) {
      claim = claims[reference.claimIndex as number];
    } else if (reference.claimText?.trim()) {
      const exact = reference.claimText.trim();
      const matches = claims.filter(
        (candidate) =>
          candidate.sourceText.trim() === exact ||
          candidate.normalizedClaim.trim() === exact,
      );
      if (matches.length === 1) claim = matches[0];
    }
    return claim?.policy[policyKey] ? claim : null;
  }

  uniqueEligibleClaim(
    claims: MemoryClaimEnvelope[],
    policyKey: MemoryClaimPolicyKey,
  ): MemoryClaimEnvelope | null {
    const eligible = claims.filter((claim) => claim.policy[policyKey]);
    return eligible.length === 1 ? eligible[0] : null;
  }

  filterRecallItems(items: RecallItem[]): ClaimFilteredRecall<RecallItem> {
    const claimsForReceipt: MemoryClaimEnvelope[] = [];
    const effects = new Map<string, ClaimAttributionEffect>();
    const filtered: RecallItem[] = [];

    for (const item of items) {
      const result = this.filterEvidence(item.type, item.id, item.metadata);
      if (!result) {
        filtered.push(item);
        continue;
      }
      for (const claim of result.claims) {
        claimsForReceipt.push(claim);
        effects.set(claim.id, effectForClaim(claim));
      }
      if (result.included.length === 0) continue;
      const sanitized = result.included
        .map((claim) => claim.sourceText.trim())
        .filter(Boolean)
        .join(' ');
      const localReceipt = this.buildReceipt(result.claims, { effects });
      filtered.push({
        ...item,
        content: sanitized || item.content,
        displayText: sanitized || item.displayText,
        previewText: sanitized || item.previewText,
        claimAttribution: localReceipt?.claims,
      });
    }

    return {
      items: filtered,
      attributionReceipt: this.buildReceipt(claimsForReceipt, { effects }),
    };
  }

  filterContextMatches(
    matches: ContextRecallMatch[],
  ): ClaimFilteredRecall<ContextRecallMatch> {
    const claimsForReceipt: MemoryClaimEnvelope[] = [];
    const effects = new Map<string, ClaimAttributionEffect>();
    const filtered: ContextRecallMatch[] = [];

    for (const match of matches) {
      const result = this.filterEvidence(match.type, match.id, match.metadata);
      if (!result) {
        filtered.push(match);
        continue;
      }
      for (const claim of result.claims) {
        claimsForReceipt.push(claim);
        effects.set(claim.id, effectForClaim(claim));
      }
      if (result.included.length === 0) continue;
      const sanitized = result.included
        .map((claim) => claim.sourceText.trim())
        .filter(Boolean)
        .join(' ');
      const localReceipt = this.buildReceipt(result.claims, { effects });
      filtered.push({
        ...match,
        snippet: sanitized || match.snippet,
        uiSummary: sanitized || match.uiSummary,
        claimAttribution: localReceipt?.claims,
      });
    }

    return {
      items: filtered,
      attributionReceipt: this.buildReceipt(claimsForReceipt, { effects }),
    };
  }

  private filterEvidence(
    type: string,
    id: string,
    metadata?: Record<string, unknown>,
  ):
    | { claims: MemoryClaimEnvelope[]; included: MemoryClaimEnvelope[] }
    | null {
    const messageId = this.repository.findMessageIdForEvidence(
      type,
      id,
      metadata,
    );
    if (!messageId) return null;
    const decision = this.ensureForMessage(messageId);
    if (decision.status !== 'resolved') {
      return { claims: [], included: [] };
    }
    const claims = this.repository.getClaimsForMessage(messageId);
    return {
      claims,
      included: claims.filter(
        (claim) => claim.policy.passiveRecall !== 'block',
      ),
    };
  }

  private toEnvelope(
    messageId: string,
    segmented: SegmentedMemoryClaim,
    timestamp: number,
  ): MemoryClaimEnvelope {
    const policy: MemoryClaimPolicy = compileMemoryClaimPolicy(segmented);
    return {
      id: `claim_${contentHash(
        `${messageId}:${segmented.sourceSpan.start}:${segmented.sourceSpan.end}:${segmented.sourceSpan.textHash}`,
      ).slice(0, 32)}`,
      sourceMessageId: messageId,
      sourceSpan: segmented.sourceSpan,
      sourceText: segmented.sourceText,
      normalizedClaim: segmented.normalizedClaim,
      owner: segmented.owner,
      speechMode: segmented.speechMode,
      polarity: segmented.polarity,
      timeBasis: segmented.timeBasis,
      verification: segmented.verification,
      commitment: segmented.commitment,
      confidence: segmented.confidence,
      signals: [...segmented.signals],
      policy,
      revision: 1,
      status: 'active',
      corrected: false,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  }

  private toDecision(
    status: IngestClaimAttributionDecision['status'],
    claims: MemoryClaimEnvelope[],
  ): IngestClaimAttributionDecision {
    const allowed = claims.filter(
      (claim) =>
        claim.policy.profileCandidate ||
        claim.policy.currentTruthCandidate ||
        claim.policy.actionCandidate,
    ).length;
    return {
      status,
      claimCount: claims.length,
      highResponsibilityAllowed: status === 'resolved' ? allowed : 0,
      highResponsibilityBlocked:
        status === 'resolved' ? claims.length - allowed : claims.length,
      receipt:
        status === 'resolved'
          ? this.buildReceipt(claims, {
              affectedHighResponsibility: claims.length - allowed > 0,
            })
          : undefined,
    };
  }
}
