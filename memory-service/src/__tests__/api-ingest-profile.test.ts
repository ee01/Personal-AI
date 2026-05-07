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
});
