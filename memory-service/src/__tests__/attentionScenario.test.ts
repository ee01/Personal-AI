/** Source/API/notification/nightly integration. In-memory data and clock only. */
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
const llmCall = vi.hoisted(() => vi.fn());
vi.mock('../llm/LLMClient.js', () => ({
  getLLMClient: () => ({ generate: llmCall, generateJSON: llmCall }),
  LLMClient: vi.fn(),
  LLMBudgetExceededError: class extends Error {},
}));
vi.mock('../llm/EmbeddingClient.js', () => ({
  EmbeddingClient: {
    getInstance: vi
      .fn()
      .mockRejectedValue(new Error('isolated scenario: embeddings disabled')),
    isLoaded: vi.fn().mockReturnValue(false),
    getModelName: vi.fn().mockReturnValue('isolated-model'),
  },
}));
import Fastify from 'fastify';
import { getTestDb } from './setup.js';
import { ingestRoutes } from '../routes/ingest.js';
import { attentionRoutes } from '../routes/attention.js';
import { AttentionService } from '../core/AttentionService.js';
import { HeartbeatLoop } from '../core/HeartbeatLoop.js';
import {
  ProactivityPolicy,
  type NotificationCandidate,
} from '../core/ProactivityPolicy.js';
import { SleepReconciliation } from '../core/v3/SleepReconciliation.js';
import { reminderPlan, wallTime } from '../core/AttentionTriage.js';

const db = getTestDb();
const app = Fastify();
const owner = 'attention-scenario';
const at = wallTime(2026, 10, 9, 10, 'Asia/Shanghai');
const due = wallTime(2026, 10, 13, 23, 'Asia/Shanghai') + 3599;
const service = new AttentionService(db, owner);
let clock: ReturnType<typeof vi.spyOn>;
beforeAll(async () => {
  app.addHook('preHandler', async (request) => {
    request.userId = owner;
    request.userContext = { db } as any;
  });
  await app.register(ingestRoutes);
  await app.register(attentionRoutes);
  await app.ready();
});
afterAll(() => app.close());
beforeEach(() => {
  llmCall.mockClear();
  vi.stubEnv('ATTENTION_TRIAGE_ENABLED', 'remind');
  vi.stubEnv('MEMORY_WRITE_V3_SHADOW', 'false');
  vi.stubEnv('INGEST_EMBEDDING_ENABLED', 'false');
  for (const table of [
    'attention_feedback',
    'attention_sources',
    'attention_items',
    'proposed_action_attempts',
    'proposed_actions',
    'notification_records',
    'messages_raw',
  ])
    db.prepare(`DELETE FROM ${table}`).run();
  clock = vi.spyOn(Date, 'now').mockReturnValue(at * 1000);
});
afterEach(() => {
  expect(llmCall).not.toHaveBeenCalled();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
async function ingest(
  postId: string,
  content: string,
  self = false,
  replyToPostId?: string,
) {
  const response = await app.inject({
    method: 'POST',
    url: '/ingest',
    payload: {
      content,
      sourceType: 'glip',
      sender: self ? owner : 'Scenario Manager',
      groupId: 'isolated-team',
      timestamp: Math.floor(Date.now() / 1000),
      skipExtraction: true,
      metadata: {
        postId,
        attentionMatchedRule: true,
        ...(self ? { authorRole: 'owner', isSelf: true } : {}),
        ...(replyToPostId ? { replyToPostId } : {}),
      },
    },
  });
  expect(response.statusCode).toBe(200);
  expect(response.json().status).toBe('created');
  return response.json().id as string;
}
async function propose() {
  const messageId = await ingest(
    'goal-request',
    '@Team 请大家完成并提交 E77 验收目标。Deadline 10/13/2026',
  );
  expect(
    db.prepare('SELECT count(*) AS n FROM proposed_actions').get(),
  ).toEqual({ n: 0 });
  const response = await app.inject('/attention?postIds=goal-request');
  expect(response.statusCode).toBe(200);
  const [card] = response.json().items;
  expect(card.source_message_id).toBe(messageId);
  expect(card.due_at).toBe(due);
  return card.id as string;
}
async function decide(id: string, verdict: string) {
  const response = await app.inject({
    method: 'POST',
    url: `/attention/${id}/decision`,
    payload: { verdict },
  });
  expect(response.statusCode).toBe(200);
  return response.json().item;
}
async function deliver(at: number) {
  clock.mockReturnValue(at * 1000);
  const candidates = service.dueCandidates(at);
  const approved = await new ProactivityPolicy(db).filterNotifications(
    candidates,
  );
  // Execute the exact persistence method used by run(), without unrelated
  // planner/executor/LLM jobs. Time remains frozen at this reminder occurrence.
  const heartbeat = new HeartbeatLoop(db, undefined, owner) as unknown as {
    deliverNotifications(items: NotificationCandidate[]): Array<{ id: string }>;
  };
  return heartbeat.deliverNotifications(approved);
}
describe('Attention full scenario', () => {
  it('ingest → visible proposal → consent → three persisted reminders without waiting days', async () => {
    const id = await propose();
    const item = await decide(id, 'accepted');
    expect(item.status).toBe('armed');
    expect(item.accepted_action_id).toBeTruthy();
    const task = db
      .prepare(
        'SELECT task_kind,queue_status,source_kind FROM proposed_actions WHERE id=?',
      )
      .get(item.accepted_action_id);
    expect(task).toEqual({
      task_kind: 'remind',
      queue_status: 'paused',
      source_kind: 'attention',
    });
    expect(
      (await app.inject('/attention/open-loops')).json().items,
    ).toHaveLength(1);
    for (const t of reminderPlan(due, 'Asia/Shanghai')) {
      expect(await deliver(t)).toHaveLength(1);
      expect(await deliver(t + 60)).toHaveLength(0);
    }
    expect(
      db.prepare('SELECT count(*) AS n FROM notification_records').get(),
    ).toEqual({ n: 3 });
    expect(service.get(id)?.fire_count).toBe(3);
    expect(service.get(id)?.status).toBe('done');
  });
  it('owner reply done → actual nightly E phase stops the remaining notifications', async () => {
    const id = await propose();
    await decide(id, 'accepted');
    const [first, second] = reminderPlan(due, 'Asia/Shanghai');
    expect(await deliver(first)).toHaveLength(1);
    clock.mockReturnValue((first + 3600) * 1000);
    const evidenceId = await ingest('goal-done', 'done', true, 'goal-request');
    const result = new SleepReconciliation(db).attention(first + 7200);
    expect(result.completed).toBe(1);
    expect(
      db
        .prepare(
          'SELECT status,completed_evidence_id FROM attention_items WHERE id=?',
        )
        .get(id),
    ).toEqual({ status: 'completed', completed_evidence_id: evidenceId });
    expect(await deliver(second)).toHaveLength(0);
    expect((await app.inject('/attention/open-loops')).json().items).toEqual(
      [],
    );
  });
  it('explicit cancellation survives repeated acceptance and a new reminder cycle', async () => {
    const id = await propose();
    await decide(id, 'remind');
    await decide(id, 'cancelled');
    expect((await decide(id, 'accepted')).status).toBe('cancelled');
    expect(await deliver(reminderPlan(due, 'Asia/Shanghai')[0])).toHaveLength(
      0,
    );
    expect(
      db.prepare('SELECT count(*) AS n FROM notification_records').get(),
    ).toEqual({ n: 0 });
  });
});
