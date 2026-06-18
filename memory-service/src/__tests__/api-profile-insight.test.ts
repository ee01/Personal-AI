import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const { generateMock } = vi.hoisted(() => ({ generateMock: vi.fn() }));

vi.mock('../llm/LLMClient.js', () => ({
  LLMClient: vi.fn().mockImplementation(() => ({
    generate: generateMock,
    generateJSON: async (...args: unknown[]) => {
      const res = await generateMock(...args);
      return typeof res === 'string' ? JSON.parse(res) : res;
    },
  })),
}));

vi.mock('../llm/EmbeddingClient.js', () => ({
  EmbeddingClient: {
    getInstance: vi.fn().mockRejectedValue(new Error('no embeddings in tests')),
    isLoaded: vi.fn().mockReturnValue(false),
    getModelName: vi.fn().mockReturnValue('mock-model'),
  },
}));

import type { FastifyInstance } from 'fastify';

import { buildApp } from '../server.js';
import { MarkdownManager } from '../core/MarkdownManager.js';
import { UserContextManager } from '../core/UserContextManager.js';
import { contentHash } from '../utils/hashing.js';
import { now } from '../utils/time.js';

describe('Profile Insight API (QW-2)', () => {
  const userId = 'profile-insight-user';
  let app: FastifyInstance;
  let userContextManager: UserContextManager;
  let tempDir: string;

  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'profile-insight-'));
    userContextManager = new UserContextManager(tempDir);
    const result = await buildApp({ userContextManager });
    app = result.app;
    await app.ready();
  });

  beforeEach(() => {
    vi.spyOn(MarkdownManager.prototype, 'reindexFile').mockResolvedValue(0);
    generateMock.mockReset();
    const context = userContextManager.getContext(userId);
    context.db.prepare('DELETE FROM user_profile_items').run();
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await app.close();
    userContextManager.closeAll();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  function seedConfirmedItem(key: string, value: string): void {
    const ts = now();
    userContextManager
      .getContext(userId)
      .db.prepare(
        `INSERT INTO user_profile_items
          (id, item_type, item_key, item_value, evidence_refs, source_kind,
           confidence, user_confirmed, status, salience_score, mention_count,
           last_seen, created_at, updated_at, fingerprint)
         VALUES (?, 'preference', ?, ?, '[]', 'user', 0.9, 1, 'active', 0.8, 3, ?, ?, ?, ?)`,
      )
      .run(`pi-${key}`, key, value, ts, ts, ts, contentHash(`${key}:${value}`));
  }

  it('returns available:false with reason when there is no profile signal', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/profile/insight',
      headers: { 'x-user-id': userId },
      payload: { question: 'How does the user prefer status updates?' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.available).toBe(false);
    expect(body.reason).toBe('no_profile_signal');
    expect(generateMock).not.toHaveBeenCalled();
  });

  it('synthesizes an insight without echoing raw evidence text', async () => {
    seedConfirmedItem('communication_style', 'concise, no fluff');
    seedConfirmedItem('review_pref', 'wants evidence before recommendations');
    seedConfirmedItem('timezone', 'Asia/Shanghai');

    generateMock.mockResolvedValue(
      JSON.stringify({
        insight: 'They would want a short, evidence-backed summary up front.',
        confidence: 0.8,
        aspectsUsed: ['confirmed_profile'],
      }),
    );

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/profile/insight',
      headers: { 'x-user-id': userId },
      payload: { question: 'How should I present a recommendation to them?' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.available).toBe(true);
    expect(body.insight).toContain('evidence-backed');
    expect(body.basisCount).toBeGreaterThanOrEqual(3);
    expect(body.confidence).toBeCloseTo(0.8, 5);
    // Must not leak raw stored item text.
    expect(body.insight).not.toContain('no fluff');
    expect(generateMock).toHaveBeenCalledTimes(1);
  });

  it('caps confidence when the basis is thin (single confirmed item)', async () => {
    seedConfirmedItem('communication_style', 'concise');
    generateMock.mockResolvedValue(
      JSON.stringify({ insight: 'They prefer brevity.', confidence: 0.95 }),
    );
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/profile/insight',
      headers: { 'x-user-id': userId },
      payload: { question: 'How verbose should I be?' },
    });
    const body = res.json();
    expect(body.available).toBe(true);
    expect(body.basisCount).toBe(1);
    // basisCap for 1 item is 0.5, so 0.95 must be clamped down.
    expect(body.confidence).toBe(0.5);
  });

  it('rejects an empty question via schema validation', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/profile/insight',
      headers: { 'x-user-id': userId },
      payload: { question: '' },
    });
    expect(res.statusCode).toBe(400);
  });
});
