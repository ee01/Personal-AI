import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import Fastify from 'fastify';
import { attentionRoutes } from '../routes/attention.js';
import { AttentionService } from '../core/AttentionService.js';
import { getTestDb } from './setup.js';
const db = getTestDb();
const app = Fastify();
let id: string;
beforeAll(async () => {
  app.addHook('preHandler', async (request) => {
    request.userContext = { db } as any;
    request.userId = String(request.headers['x-user-id'] ?? 'owner');
  });
  await app.register(attentionRoutes);
  await app.ready();
});
afterAll(() => app.close());
beforeEach(() => {
  process.env.ATTENTION_TRIAGE_ENABLED = 'remind';
  process.env.ATTENTION_MANAGER_CHIP_ENABLED = 'false';
  db.prepare('DELETE FROM attention_feedback').run();
  db.prepare('DELETE FROM attention_sources').run();
  db.prepare('DELETE FROM attention_items').run();
  db.prepare('DELETE FROM proposed_actions').run();
  db.prepare('DELETE FROM messages_raw').run();
  const now = Math.floor(Date.now() / 1000);
  db.prepare(
    "INSERT INTO messages_raw(id,content,source_type,sender,group_id,timestamp,created_at,metadata_json,origin_class) VALUES ('api-msg','@Team 请大家明天提交季度目标','glip','Manager','team',?,?,?, 'observed')",
  ).run(
    now,
    now,
    JSON.stringify({ postId: 'api-post', matchedRules: ['rule'] }),
  );
  id = new AttentionService(db, 'owner').capture(
    'api-msg',
    [],
    undefined,
    now,
  )!.id;
});
describe('Attention routes', () => {
  it('shows a single scoped source card', async () => {
    const r = await app.inject('/attention?postIds=api-post');
    expect(r.statusCode).toBe(200);
    expect(r.json().items).toHaveLength(1);
    expect(r.json().items[0].postId).toBe('api-post');
  });
  it('isolates source lists by owner', async () => {
    const r = await app.inject({
      url: '/attention?postIds=api-post',
      headers: { 'x-user-id': 'other' },
    });
    expect(r.json().items).toEqual([]);
  });
  it('rejects decisions against another owner', async () => {
    const r = await app.inject({
      method: 'POST',
      url: `/attention/${id}/decision`,
      headers: { 'x-user-id': 'other' },
      payload: { verdict: 'accepted' },
    });
    expect(r.statusCode).toBe(404);
  });
  it('enforces the closed verdict contract', async () => {
    const r = await app.inject({
      method: 'POST',
      url: `/attention/${id}/decision`,
      payload: { verdict: 'send_reply' },
    });
    expect(r.statusCode).toBe(400);
  });
  it('accepts idempotently and exposes open loops with evidence', async () => {
    for (let i = 0; i < 2; i++) {
      const r = await app.inject({
        method: 'POST',
        url: `/attention/${id}/decision`,
        payload: { verdict: 'accepted' },
      });
      expect(r.json().item.status).toBe('armed');
    }
    expect(
      db.prepare('SELECT count(*) AS n FROM proposed_actions').get(),
    ).toEqual({ n: 1 });
    const r = await app.inject('/attention/open-loops');
    expect(r.json().items[0].source_message_id).toBe('api-msg');
  });
  it('cancels with a durable terminal state', async () => {
    await app.inject({
      method: 'POST',
      url: `/attention/${id}/decision`,
      payload: { verdict: 'cancelled' },
    });
    const r = await app.inject({
      method: 'POST',
      url: `/attention/${id}/decision`,
      payload: { verdict: 'accepted' },
    });
    expect(r.json().item.status).toBe('cancelled');
  });
  it('gates durable identity writes separately', async () => {
    const r = await app.inject({
      method: 'POST',
      url: `/attention/${id}/identity`,
      payload: { key: 'role', value: '敏捷教练' },
    });
    expect(r.statusCode).toBe(403);
  });
  it('shadow returns no passive cards', async () => {
    process.env.ATTENTION_TRIAGE_ENABLED = 'shadow';
    const r = await app.inject('/attention?postIds=api-post');
    expect(r.json().items).toEqual([]);
  });
});
