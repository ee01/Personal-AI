import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';

const { generateJSONMock } = vi.hoisted(() => ({
  generateJSONMock: vi.fn(),
}));

vi.mock('../llm/LLMClient.js', () => ({
  getLLMClient: () => ({
    generate: vi.fn().mockResolvedValue(''),
    generateJSON: generateJSONMock,
  }),
  LLMClient: vi.fn(),
}));

vi.mock('../llm/EmbeddingClient.js', () => ({
  EmbeddingClient: {
    getInstance: vi
      .fn()
      .mockRejectedValue(new Error('Embedding not available in tests')),
    isLoaded: vi.fn().mockReturnValue(false),
    getModelName: vi.fn().mockReturnValue('mock-model'),
  },
}));

import { buildApp } from '../server.js';
import { UserContextManager } from '../core/UserContextManager.js';

describe('Ingest API profile extraction', () => {
  const userId = 'ingest-profile-user';
  let app: FastifyInstance;
  let userContextManager: UserContextManager;
  let tempDir: string;

  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ingest-profile-'));
    userContextManager = new UserContextManager(tempDir);
    const result = await buildApp({ userContextManager });
    app = result.app;
    await app.ready();
  });

  beforeEach(() => {
    generateJSONMock.mockReset();
    const context = userContextManager.getContext(userId);
    context.db.prepare('DELETE FROM user_profile_items').run();
    context.db.prepare('DELETE FROM memory_metadata').run();
    context.db.prepare('DELETE FROM chunks').run();
    context.db.prepare('DELETE FROM messages_raw').run();
  });

  afterAll(async () => {
    await app.close();
    userContextManager.closeAll();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('stores profile candidates with evidence refs from the current schema', async () => {
    const timestamp = 1_778_000_000;
    generateJSONMock.mockResolvedValue({
      entities: {
        people: [],
        projects: ['Personal AI'],
        topics: ['user profile'],
        technologies: [],
        organizations: [],
      },
      properties: [],
      importance: 0.82,
      sentiment: 'neutral',
      summary: 'User prefers concise product status updates.',
      is_decision: false,
      is_action_item: false,
      profile_candidates: [
        {
          item_type: 'preference',
          item_key: 'communication_style',
          item_value: 'concise product status updates',
          claim_index: 0,
          claim_text: 'I prefer concise product status updates.',
        },
      ],
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ingest',
      headers: { 'x-user-id': userId },
      payload: {
        content: 'I prefer concise product status updates.',
        sourceType: 'manual',
        sender: 'test-user',
        timestamp,
        metadata: { authorRole: 'owner' },
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('created');

    const context = userContextManager.getContext(userId);
    const row = context.db
      .prepare(
        `SELECT item_type, item_key, item_value, evidence_refs, source_kind, status
         FROM user_profile_items
         WHERE item_key = 'communication_style'`,
      )
      .get() as
      | {
          item_type: string;
          item_key: string;
          item_value: string;
          evidence_refs: string;
          source_kind: string;
          status: string;
        }
      | undefined;

    expect(row).toBeTruthy();
    expect(row?.item_type).toBe('preference');
    expect(row?.item_value).toBe('concise product status updates');
    expect(row?.source_kind).toBe('inferred');
    expect(row?.status).toBe('pending_confirm');

    const evidenceRefs = JSON.parse(row?.evidence_refs ?? '[]');
    expect(evidenceRefs).toHaveLength(1);
    expect(evidenceRefs[0]).toMatchObject({ ts: timestamp });
    expect(evidenceRefs[0].messageId).toBe(res.json().id);

    const coreBeforeConfirm = await app.inject({
      method: 'GET',
      url: '/api/v1/profile/core',
      headers: { 'x-user-id': userId },
    });
    expect(coreBeforeConfirm.statusCode).toBe(200);
    expect(coreBeforeConfirm.json().content).not.toContain('concise product status updates');

    const profileItem = context.db
      .prepare('SELECT id FROM user_profile_items WHERE item_key = ?')
      .get('communication_style') as { id: string };

    const confirmRes = await app.inject({
      method: 'POST',
      url: `/api/v1/profile/items/${profileItem.id}/confirm`,
      headers: { 'x-user-id': userId },
    });
    expect(confirmRes.statusCode).toBe(200);
    expect(confirmRes.json().status).toBe('active');

    const coreAfterConfirm = await app.inject({
      method: 'GET',
      url: '/api/v1/profile/core',
      headers: { 'x-user-id': userId },
    });
    expect(coreAfterConfirm.statusCode).toBe(200);
    expect(coreAfterConfirm.json().content).toContain('concise product status updates');
  });

  it('does not store profile candidates from external senders', async () => {
    const timestamp = 1_778_000_100;
    generateJSONMock.mockResolvedValue({
      entities: {
        people: ['External Sender'],
        projects: ['Personal AI'],
        topics: ['user profile'],
        technologies: [],
        organizations: [],
      },
      properties: [],
      importance: 0.9,
      sentiment: 'neutral',
      summary: 'External sender describes a preference.',
      is_decision: false,
      is_action_item: false,
      profile_candidates: [
        {
          item_type: 'preference',
          item_key: 'communication_style',
          item_value: 'likes long weekly summaries',
        },
      ],
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ingest',
      headers: { 'x-user-id': userId },
      payload: {
        content: 'Esone likes long weekly summaries.',
        sourceType: 'glip',
        sender: 'external-sender',
        timestamp,
        metadata: { authorRole: 'external', isSelf: false },
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('created');

    const context = userContextManager.getContext(userId);
    const profileCount = context.db
      .prepare('SELECT COUNT(*) AS count FROM user_profile_items')
      .get() as { count: number };
    expect(profileCount.count).toBe(0);

    const message = context.db
      .prepare(
        `SELECT id, entities_json
         FROM messages_raw
         WHERE id = ?`,
      )
      .get(res.json().id) as { id: string; entities_json: string | null } | undefined;
    expect(message).toBeTruthy();
    expect(message?.entities_json).toContain('External Sender');

    const chunkCount = context.db
      .prepare('SELECT COUNT(*) AS count FROM chunks WHERE related_entity_id = ?')
      .get(res.json().id) as { count: number };
    expect(chunkCount.count).toBeGreaterThan(0);
  });

  it('stores owner writing style signals as pending profile items', async () => {
    const timestamp = 1_778_000_200;
    generateJSONMock.mockResolvedValue({
      entities: {
        people: [],
        projects: [],
        topics: ['release updates'],
        technologies: [],
        organizations: [],
      },
      properties: [],
      importance: 0.7,
      sentiment: 'neutral',
      summary: 'Owner writes concise release updates.',
      is_decision: false,
      is_action_item: false,
      profile_candidates: [
        {
          item_type: 'fact',
          item_key: 'writing_style.conciseness',
          item_value: 'prefers short direct release updates',
          claim_index: 0,
          claim_text: 'I prefer release notes that are short and direct.',
        },
      ],
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ingest',
      headers: { 'x-user-id': userId },
      payload: {
        content: 'I prefer release notes that are short and direct.',
        sourceType: 'manual',
        sender: 'test-user',
        timestamp,
        metadata: { isSelf: true },
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('created');

    const context = userContextManager.getContext(userId);
    const row = context.db
      .prepare(
        `SELECT item_type, item_key, item_value, source_kind, status, user_confirmed
         FROM user_profile_items
         WHERE item_key = 'writing_style.conciseness'`,
      )
      .get() as
      | {
          item_type: string;
          item_key: string;
          item_value: string;
          source_kind: string;
          status: string;
          user_confirmed: number;
        }
      | undefined;

    expect(row).toBeTruthy();
    expect(row?.item_type).toBe('preference');
    expect(row?.item_value).toBe('prefers short direct release updates');
    expect(row?.source_kind).toBe('inferred');
    expect(row?.status).toBe('pending_confirm');
    expect(row?.user_confirmed).toBe(0);
  });
});
