import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type BetterSqlite3 from 'better-sqlite3';

import { MemoryClaimRepository } from '../repositories/MemoryClaimRepository.js';
import type { MemoryClaimEnvelope } from '../types/index.js';
import { getTestDb } from './setup.js';

const MESSAGE_PREFIX = 'claim-repository-message-';

function makeClaim(
  id: string,
  sourceMessageId: string,
  start: number,
  sourceText: string,
  overrides: Partial<MemoryClaimEnvelope> = {},
): MemoryClaimEnvelope {
  const timestamp = 1_780_000_000 + start;
  const base: MemoryClaimEnvelope = {
    id,
    sourceMessageId,
    sourceSpan: {
      start,
      end: start + sourceText.length,
      textHash: `hash-${id}`,
    },
    sourceText,
    normalizedClaim: sourceText,
    owner: { kind: 'self' },
    speechMode: 'direct_assertion',
    polarity: 'affirmed',
    timeBasis: 'current',
    verification: 'unverified',
    commitment: 'none',
    confidence: 0.91,
    signals: ['message_role'],
    policy: {
      profileCandidate: false,
      currentTruthCandidate: true,
      actionCandidate: false,
      passiveRecall: 'allow',
    },
    revision: 1,
    status: 'active',
    corrected: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  return {
    ...base,
    ...overrides,
    sourceSpan: overrides.sourceSpan ?? base.sourceSpan,
    owner: overrides.owner ?? base.owner,
    signals: overrides.signals ?? base.signals,
    policy: overrides.policy ?? base.policy,
  };
}

describe('MemoryClaimRepository', () => {
  let db: BetterSqlite3.Database;
  let repository: MemoryClaimRepository;

  beforeAll(() => {
    db = getTestDb();
    repository = new MemoryClaimRepository(db);
  });

  beforeEach(() => {
    db.prepare(
      `DELETE FROM messages_raw
       WHERE id LIKE ?`,
    ).run(`${MESSAGE_PREFIX}%`);
  });

  function insertMessage(id: string, content = 'A source message'): void {
    const timestamp = 1_780_000_000;
    db.prepare(
      `INSERT INTO messages_raw
         (id, content, source_type, timestamp, created_at)
       VALUES (?, ?, 'manual', ?, ?)`,
    ).run(id, content, timestamp, timestamp);
  }

  it('applies the claim-attribution migration columns and tables', () => {
    const messageColumns = db
      .prepare('PRAGMA table_info(messages_raw)')
      .all()
      .map((row) => (row as { name: string }).name);

    expect(messageColumns).toEqual(
      expect.arrayContaining([
        'claim_attribution_status',
        'claim_attribution_version',
        'claim_attributed_at',
        'claim_attribution_error',
      ]),
    );

    const tables = db
      .prepare(
        `SELECT name
         FROM sqlite_master
         WHERE type = 'table'
           AND name IN ('memory_claims', 'memory_claim_revisions', 'memory_claim_links')
         ORDER BY name`,
      )
      .all()
      .map((row) => (row as { name: string }).name);

    expect(tables).toEqual([
      'memory_claim_links',
      'memory_claim_revisions',
      'memory_claims',
    ]);
  });

  it('tracks the message claim state from pending through resolved', () => {
    const messageId = `${MESSAGE_PREFIX}state`;
    insertMessage(messageId);

    expect(repository.getMessageState(messageId)).toEqual({
      status: 'legacy_unclassified',
      version: 0,
      attributedAt: undefined,
      error: undefined,
    });

    repository.setMessageState(messageId, 'pending', { version: 1 });
    expect(repository.getMessageState(messageId)).toEqual({
      status: 'pending',
      version: 1,
      attributedAt: undefined,
      error: undefined,
    });

    repository.setMessageState(messageId, 'resolved', { version: 2 });
    expect(repository.getMessageState(messageId)).toMatchObject({
      status: 'resolved',
      version: 2,
      error: undefined,
    });
    expect(repository.getMessageState(messageId)?.attributedAt).toEqual(
      expect.any(Number),
    );
  });

  it('replaces active claims, reactivates matching spans, and gets inactive history', () => {
    const messageId = `${MESSAGE_PREFIX}replace`;
    insertMessage(messageId, 'I prefer short updates. I dislike noisy alerts.');

    const first = makeClaim(
      'claim-repository-first',
      messageId,
      0,
      'I prefer short updates.',
    );
    const second = makeClaim(
      'claim-repository-second',
      messageId,
      24,
      'I dislike noisy alerts.',
    );
    repository.replaceActiveClaims(messageId, [second, first], 'resolver-v1');

    expect(
      repository.getClaimsForMessage(messageId).map((claim) => claim.id),
    ).toEqual([first.id, second.id]);
    expect(repository.getClaim(second.id)).toMatchObject({
      id: second.id,
      status: 'active',
      normalizedClaim: second.normalizedClaim,
    });

    const updatedFirst = makeClaim(
      first.id,
      messageId,
      0,
      first.sourceText,
      {
        sourceSpan: first.sourceSpan,
        normalizedClaim: 'The user prefers concise updates.',
        confidence: 0.98,
      },
    );
    repository.replaceActiveClaims(messageId, [updatedFirst], 'resolver-v2');

    expect(repository.getClaimsForMessage(messageId)).toEqual([
      expect.objectContaining({
        id: first.id,
        normalizedClaim: updatedFirst.normalizedClaim,
        confidence: 0.98,
        status: 'active',
      }),
    ]);

    const allClaims = repository.getClaimsForMessage(messageId, {
      includeInactive: true,
    });
    expect(allClaims).toHaveLength(2);
    expect(allClaims).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: first.id, status: 'active' }),
        expect.objectContaining({ id: second.id, status: 'stale' }),
      ]),
    );
    expect(repository.getClaim(second.id)?.status).toBe('stale');
  });

  it('creates, invalidates, and reactivates a derived-memory link without duplicates', () => {
    const messageId = `${MESSAGE_PREFIX}links`;
    insertMessage(messageId);
    const claim = makeClaim(
      'claim-repository-link',
      messageId,
      0,
      'I prefer short updates.',
    );
    repository.replaceActiveClaims(messageId, [claim], 'resolver-v1');

    repository.linkDerived(claim.id, 'profile_item', 'profile-1', 'evidence');
    repository.linkDerived(claim.id, 'profile_item', 'profile-1', 'evidence');

    const [link] = repository.getActiveLinks(claim.id);
    expect(repository.getActiveLinks(claim.id)).toHaveLength(1);
    expect(link).toMatchObject({
      claimId: claim.id,
      targetType: 'profile_item',
      targetId: 'profile-1',
      linkRole: 'evidence',
      status: 'active',
    });

    repository.invalidateLink(link.id, 'test-correction');
    expect(repository.getActiveLinks(claim.id)).toEqual([]);
    expect(
      db
        .prepare(
          `SELECT status, invalidation_reason
           FROM memory_claim_links
           WHERE id = ?`,
        )
        .get(link.id),
    ).toMatchObject({
      status: 'invalidated',
      invalidation_reason: 'test-correction',
    });

    repository.linkDerived(claim.id, 'profile_item', 'profile-1', 'evidence');
    expect(repository.getActiveLinks(claim.id)).toEqual([
      expect.objectContaining({
        id: link.id,
        status: 'active',
        invalidatedAt: undefined,
        invalidationReason: undefined,
      }),
    ]);
  });
});
