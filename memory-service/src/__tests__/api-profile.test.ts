import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';

import { buildApp } from '../server.js';
import { MarkdownManager } from '../core/MarkdownManager.js';
import { UserContextManager } from '../core/UserContextManager.js';
import { contentHash } from '../utils/hashing.js';
import { now } from '../utils/time.js';

describe('Profile API', () => {
  const userId = 'profile-api-user';
  let app: FastifyInstance;
  let userContextManager: UserContextManager;
  let tempDir: string;

  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'profile-api-'));
    userContextManager = new UserContextManager(tempDir);
    const result = await buildApp({ userContextManager });
    app = result.app;
    await app.ready();
  });

  beforeEach(() => {
    vi.spyOn(MarkdownManager.prototype, 'reindexFile').mockResolvedValue(0);
    const context = userContextManager.getContext(userId);
    context.db.prepare('DELETE FROM user_profile_items').run();
    context.db
      .prepare(
        `UPDATE profile_sync_state
         SET profile_dirty = 0, last_snapshot_at = 0, last_full_rebuild_at = 0
         WHERE id = 'singleton'`,
      )
      .run();
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await app.close();
    userContextManager.closeAll();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('creates explicit profile items with salience aligned to confidence', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/profile/items',
      headers: { 'x-user-id': userId },
      payload: {
        itemType: 'preference',
        itemKey: 'communication_style',
        itemValue: 'Prefers concise status updates',
        evidenceRefs: [{ source: 'user', id: 'manual-entry' }],
        confidence: 0.92,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.confidence).toBe(0.92);
    expect(body.salienceScore).toBe(0.92);
    expect(body.userConfirmed).toBe(true);
    expect(body.evidenceRefs).toEqual([{ source: 'user', id: 'manual-entry' }]);
  });

  it('shows pending profile candidates and activates them on confirmation', async () => {
    const context = userContextManager.getContext(userId);
    const currentTime = now();
    context.db
      .prepare(
        `INSERT INTO user_profile_items
          (id, item_type, item_key, item_value, evidence_refs, source_kind,
           confidence, user_confirmed, status, salience_score, mention_count,
           last_seen, created_at, updated_at, fingerprint)
         VALUES (?, 'interest', 'focus_project', 'Personal AI', ?, 'inferred',
           0.74, 0, 'pending_confirm', 0.71, 1, ?, ?, ?, ?)`,
      )
      .run(
        'pending-profile-1',
        JSON.stringify([{ messageId: 'msg-1', ts: currentTime }]),
        currentTime,
        currentTime,
        currentTime,
        contentHash('focus_project:personal ai'),
      );

    const listRes = await app.inject({
      method: 'GET',
      url: '/api/v1/profile/items',
      headers: { 'x-user-id': userId },
    });

    expect(listRes.statusCode).toBe(200);
    const listed = listRes.json();
    expect(listed.items).toHaveLength(1);
    expect(listed.items[0].status).toBe('pending_confirm');
    expect(listed.items[0].evidenceRefs).toEqual([{ messageId: 'msg-1', ts: currentTime }]);

    const confirmRes = await app.inject({
      method: 'POST',
      url: '/api/v1/profile/items/pending-profile-1/confirm',
      headers: { 'x-user-id': userId },
    });

    expect(confirmRes.statusCode).toBe(200);
    const confirmed = confirmRes.json();
    expect(confirmed.userConfirmed).toBe(true);
    expect(confirmed.status).toBe('active');
  });

  it('records inferred profile candidates as pending and reinforces repeats', async () => {
    const firstRes = await app.inject({
      method: 'POST',
      url: '/api/v1/profile/items/inferred',
      headers: { 'x-user-id': userId },
      payload: {
        itemType: 'interest',
        itemKey: 'web_project',
        itemValue: 'Personal AI',
        evidenceRefs: [{ sourceType: 'web', url: 'https://example.test/a' }],
        confidence: 0.42,
      },
    });

    expect(firstRes.statusCode).toBe(201);
    const first = firstRes.json();
    expect(first.sourceKind).toBe('inferred');
    expect(first.status).toBe('pending_confirm');
    expect(first.userConfirmed).toBe(false);
    expect(first.mentionCount).toBe(1);
    expect(first.evidenceRefs).toEqual([
      { sourceType: 'web', url: 'https://example.test/a' },
    ]);

    const secondRes = await app.inject({
      method: 'POST',
      url: '/api/v1/profile/items/inferred',
      headers: { 'x-user-id': userId },
      payload: {
        itemType: 'interest',
        itemKey: 'web_project',
        itemValue: 'Personal AI',
        evidenceRefs: [{ sourceType: 'web', url: 'https://example.test/b' }],
        confidence: 0.7,
      },
    });

    expect(secondRes.statusCode).toBe(200);
    const second = secondRes.json();
    expect(second.id).toBe(first.id);
    expect(second.mentionCount).toBe(2);
    expect(second.confidence).toBe(0.7);
    expect(second.evidenceRefs).toEqual([
      { sourceType: 'web', url: 'https://example.test/a' },
      { sourceType: 'web', url: 'https://example.test/b' },
    ]);

    const coreRes = await app.inject({
      method: 'GET',
      url: '/api/v1/profile/core',
      headers: { 'x-user-id': userId },
    });

    expect(coreRes.statusCode).toBe(200);
    expect(coreRes.json().content).not.toContain('Personal AI');
  });

  it('rejects updates that would duplicate another visible profile item', async () => {
    const create = async (itemValue: string) =>
      app.inject({
        method: 'POST',
        url: '/api/v1/profile/items',
        headers: { 'x-user-id': userId },
        payload: {
          itemType: 'preference',
          itemKey: 'writing_style',
          itemValue,
          confidence: 0.8,
        },
      });

    const first = await create('Use concise summaries');
    const second = await create('Use detailed summaries');
    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(201);

    const res = await app.inject({
      method: 'PUT',
      url: `/api/v1/profile/items/${second.json().id}`,
      headers: { 'x-user-id': userId },
      payload: { itemValue: 'Use concise summaries' },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().existingId).toBe(first.json().id);
  });

  it('keeps unconfirmed active rows out of USER_CORE rendering', async () => {
    const context = userContextManager.getContext(userId);
    const currentTime = now();
    context.db
      .prepare(
        `INSERT INTO user_profile_items
          (id, item_type, item_key, item_value, evidence_refs, source_kind,
           confidence, user_confirmed, status, salience_score, mention_count,
           last_seen, created_at, updated_at, fingerprint)
         VALUES
          ('unconfirmed-active-interest', 'interest', 'focus_project', 'Unconfirmed Project', NULL,
           'inferred', 0.9, 0, 'active', 0.9, 1, ?, ?, ?, ?),
          ('confirmed-active-interest', 'interest', 'focus_project', 'Confirmed Project', NULL,
           'explicit', 0.9, 1, 'active', 0.9, 1, ?, ?, ?, ?)`,
      )
      .run(
        currentTime,
        currentTime,
        currentTime,
        contentHash('focus_project:unconfirmed project'),
        currentTime,
        currentTime,
        currentTime,
        contentHash('focus_project:confirmed project'),
      );

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/profile/core',
      headers: { 'x-user-id': userId },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().content).not.toContain('Unconfirmed Project');
    expect(res.json().content).toContain('Confirmed Project');
  });
});
