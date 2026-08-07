import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../llm/EmbeddingClient.js', () => ({
  EmbeddingClient: {
    getInstance: vi.fn().mockRejectedValue(new Error('no embeddings in claim attribution tests')),
    isLoaded: vi.fn().mockReturnValue(false),
    getModelName: vi.fn().mockReturnValue('mock-model'),
  },
}));

import type BetterSqlite3 from 'better-sqlite3';

import { ContextRecallService } from '../core/ContextRecallService.js';
import type {
  ClaimAttributionReceipt,
  ContextRecallResponse,
} from '../types/index.js';
import { getTestDb } from './setup.js';

interface SeedMessageInput {
  chunkId: number;
  messageId: string;
  content: string;
  sourceType?: string;
  sender?: string;
  metadata?: Record<string, unknown>;
}

describe('ContextRecallService claim attribution contract', () => {
  let db: BetterSqlite3.Database;
  let recall: ContextRecallService;
  let previousFastMode: string | undefined;
  let previousFastSearch: string | undefined;
  let previousFastVector: string | undefined;

  beforeAll(() => {
    db = getTestDb();
    recall = new ContextRecallService(db, 'claim-attribution-test-user');
    previousFastMode = process.env.CONTEXT_RECALL_PASSIVE_FAST_MODE;
    previousFastSearch = process.env.CONTEXT_RECALL_PASSIVE_SEARCH_ENABLED;
    previousFastVector = process.env.CONTEXT_RECALL_PASSIVE_VECTOR_ENABLED;
    process.env.CONTEXT_RECALL_PASSIVE_FAST_MODE = 'true';
    process.env.CONTEXT_RECALL_PASSIVE_SEARCH_ENABLED = 'true';
    process.env.CONTEXT_RECALL_PASSIVE_VECTOR_ENABLED = 'false';
  });

  afterAll(() => {
    restoreEnv('CONTEXT_RECALL_PASSIVE_FAST_MODE', previousFastMode);
    restoreEnv('CONTEXT_RECALL_PASSIVE_SEARCH_ENABLED', previousFastSearch);
    restoreEnv('CONTEXT_RECALL_PASSIVE_VECTOR_ENABLED', previousFastVector);
  });

  beforeEach(() => {
    db.prepare('DELETE FROM memory_claim_links').run();
    db.prepare('DELETE FROM memory_claim_revisions').run();
    db.prepare('DELETE FROM memory_claims').run();
    db.prepare('DELETE FROM chunks').run();
    db.prepare(`INSERT INTO chunks_fts(chunks_fts) VALUES ('delete-all')`).run();
    db.prepare('DELETE FROM messages_raw').run();
    process.env.CONTEXT_RECALL_PASSIVE_FAST_MODE = 'true';
    process.env.CONTEXT_RECALL_PASSIVE_SEARCH_ENABLED = 'true';
    process.env.CONTEXT_RECALL_PASSIVE_VECTOR_ENABLED = 'false';
  });

  function seedMessage(input: SeedMessageInput): void {
    const timestamp = Math.floor(Date.now() / 1000) - input.chunkId;
    const sourceType = input.sourceType ?? 'glip';
    db.prepare(
      `INSERT INTO messages_raw (
         id, content, source_type, source, scope, sender, timestamp,
         importance, sentiment, metadata_json, created_at
       ) VALUES (?, ?, ?, ?, 'work', ?, ?, 0.8, 'neutral', ?, ?)`,
    ).run(
      input.messageId,
      input.content,
      sourceType,
      sourceType,
      input.sender ?? null,
      timestamp,
      JSON.stringify(input.metadata ?? {}),
      timestamp,
    );
    db.prepare(
      `INSERT INTO chunks (
         chunk_id, file_path, line_start, line_end, content, content_hash,
         scope, source, source_type, related_project, related_entity_id,
         created_at
       ) VALUES (?, ?, 1, 1, ?, ?, 'work', ?, ?, 'Claim Attribution', ?, ?)`,
    ).run(
      input.chunkId,
      `messages/${input.messageId}`,
      input.content,
      `claim-attribution-hash-${input.chunkId}`,
      sourceType,
      sourceType,
      input.messageId,
      timestamp,
    );
    db.prepare(`INSERT INTO chunks_fts(rowid, content) VALUES (?, ?)`).run(
      input.chunkId,
      input.content,
    );
  }

  async function passiveRecall(
    primaryText: string,
    limit = 5,
  ): Promise<ContextRecallResponse> {
    return recall.recall({
      surface: 'web_passive',
      contextType: 'webpage',
      title: primaryText,
      primaryText,
      scope: 'work',
      limit,
      debug: true,
    });
  }

  it('omits the receipt for an ordinary single self claim', async () => {
    seedMessage({
      chunkId: 58_101,
      messageId: 'claim-single-self',
      content: '我的偏好是 Project Atlas 前端继续使用 Vue。',
      metadata: { authorRole: 'user' },
    });

    const response = await passiveRecall('Project Atlas Vue 前端偏好决定');

    expect(response.matches).toHaveLength(1);
    expect(response.matches[0]).toMatchObject({
      id: '58101',
      snippet: expect.stringContaining('Vue'),
    });
    expect(response.matches[0].claimAttribution).toBeUndefined();
    expect(response.attributionReceipt).toBeUndefined();
  });

  it('keeps AI advice as background, removes a hypothesis, and emits one compact mixed receipt', async () => {
    seedMessage({
      chunkId: 58_102,
      messageId: 'claim-mixed-message',
      content:
        '我的决定是 Project Nimbus 保留 Vue；另一位 AI 建议 Project Nimbus 改用 React；先假设 Project Nimbus 七月一日上线。',
      metadata: { authorRole: 'user' },
    });

    const response = await passiveRecall(
      'Project Nimbus Vue React 上线架构决定',
    );

    expect(response.matches).toHaveLength(1);
    expect(response.matches[0].snippet).toContain('保留 Vue');
    expect(response.matches[0].snippet).toContain('改用 React');
    expect(response.matches[0].snippet).not.toContain('七月一日上线');

    const receipt = response.attributionReceipt as ClaimAttributionReceipt;
    expect(receipt).toMatchObject({
      visibility: 'compact',
      affectedHighResponsibility: false,
      correctedCount: 0,
    });
    expect(receipt.claims.map((claim) => claim.effect)).toEqual([
      'used',
      'background_only',
      'blocked',
    ]);
    expect(receipt.used).toEqual([
      expect.objectContaining({ label: '你 · 明确表达', count: 1 }),
    ]);
    expect(receipt.backgroundOnly).toEqual([
      expect.objectContaining({ label: 'AI · 建议', count: 1 }),
    ]);
    expect(receipt.blocked).toEqual([
      expect.objectContaining({ label: '你 · 假设', count: 1 }),
    ]);
    expect(response.matches[0].claimAttribution).toEqual(receipt.claims);
  });

  it('does not expose new unknown or previously failed messages on passive surfaces', async () => {
    seedMessage({
      chunkId: 58_103,
      messageId: 'claim-roleless-import',
      content: 'Project Eclipse migration decision uses Svelte architecture.',
      sourceType: 'chatgpt',
      metadata: {},
    });
    seedMessage({
      chunkId: 58_104,
      messageId: 'claim-segmenter-failed',
      content: 'Project Eclipse migration decision has a failed attribution record.',
      metadata: { authorRole: 'user' },
    });
    db.prepare(
      `UPDATE messages_raw
       SET claim_attribution_status = 'failed',
           claim_attribution_version = 1,
           claim_attribution_error = 'claim_segmenter_returned_no_claims'
       WHERE id = 'claim-segmenter-failed'`,
    ).run();

    const response = await passiveRecall(
      'Project Eclipse migration architecture decision',
    );

    expect(response.matches).toEqual([]);
    expect(response.topMatch).toBeNull();
    expect(response.attributionReceipt).toBeUndefined();
    const states = db
      .prepare(
        `SELECT id, claim_attribution_status AS status
         FROM messages_raw
         WHERE id IN ('claim-roleless-import', 'claim-segmenter-failed')
         ORDER BY id`,
      )
      .all() as Array<{ id: string; status: string }>;
    expect(states).toEqual([
      { id: 'claim-roleless-import', status: 'resolved' },
      { id: 'claim-segmenter-failed', status: 'failed' },
    ]);
  });

  it('aggregates the receipt from final matches only, after blocked candidates are removed', async () => {
    seedMessage({
      chunkId: 58_105,
      messageId: 'claim-final-mixed',
      content:
        '我的决定是 Project Orion 保留 Vue；AI 建议 Project Orion 用 React。',
      metadata: { authorRole: 'user' },
    });
    seedMessage({
      chunkId: 58_106,
      messageId: 'claim-filtered-unknown',
      content: 'Project Orion migration decision might use Svelte.',
      sourceType: 'chatgpt',
      metadata: {},
    });

    const response = await passiveRecall(
      'Project Orion Vue React Svelte migration decision',
    );

    expect(response.matches).toHaveLength(1);
    expect(response.matches[0].id).toBe('58105');
    expect(response.attributionReceipt).toBeDefined();
    expect(
      response.attributionReceipt?.claims.map((claim) => claim.sourceMessageId),
    ).toEqual(['claim-final-mixed', 'claim-final-mixed']);
    expect(
      response.attributionReceipt?.claims.some(
        (claim) => claim.sourceMessageId === 'claim-filtered-unknown',
      ),
    ).toBe(false);
  });
});

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
