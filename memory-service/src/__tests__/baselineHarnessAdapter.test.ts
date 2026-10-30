import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../llm/LLMClient.js', () => ({
  getLLMClient: () => ({
    generate: vi.fn().mockRejectedValue(new Error('LLM not available in tests')),
    generateJSON: vi.fn().mockRejectedValue(new Error('LLM not available in tests')),
  }),
  LLMClient: vi.fn(),
}));

vi.mock('../llm/EmbeddingClient.js', () => ({
  EmbeddingClient: {
    getInstance: vi.fn().mockRejectedValue(new Error('Embedding not available in tests')),
    isLoaded: vi.fn().mockReturnValue(false),
    getModelName: vi.fn().mockReturnValue('mock-model'),
  },
}));

import { createBaselineMemoryAdapter } from '../benchmark/createBaselineMemoryAdapter.js';
import { withBusinessClock } from '../clock/businessClock.js';
import { getTestDb, cleanupTestDb } from './setup.js';
import { SleepReconciliation } from '../core/v3/SleepReconciliation.js';
import os from 'node:os';
import path from 'node:path';

const sampleEvent = () => ({
  event_id: 'bench:evt:1',
  source: 'messages_raw',
  source_type: 'glip',
  occurred_at: '2026-01-15T08:00:00.000Z',
  observed_at: '2026-01-15T08:00:05.000Z',
  scope: 'work',
  group_id: 'g1',
  thread_root: 't1',
  sender: '@Owner',
  text: 'Reminder: ship harness by Friday.',
  metadata: {},
  acl: { scope: 'work', trust_class: null },
  provenance: { synthetic: true },
});

describe('business clock', () => {
  beforeEach(() => cleanupTestDb());
  afterEach(() => cleanupTestDb());

  it('SleepReconciliation finished_at uses injected at, not wall clock', async () => {
    const db = getTestDb();
    const at = 1_735_000_000;
    const runner = new SleepReconciliation(db);
    await withBusinessClock(at, () => runner.run(at));
    const row = db
      .prepare('SELECT finished_at FROM reconcile_nightly_runs ORDER BY night DESC LIMIT 1')
      .get() as { finished_at: number };
    expect(row.finished_at).toBe(at);
    expect(row.finished_at).not.toBe(Math.floor(Date.now() / 1000));
  });
});

describe('baseline harness adapter', () => {
  it('ingest / consolidate / recall / decide / export / delete / revoke', async () => {
    const adapter = await createBaselineMemoryAdapter({
      schemeId: 'A-test',
      fresh: true,
      dataRoot: path.join(os.tmpdir(), `pa-benchmark-a-${process.pid}-${Date.now()}`),
    });

    const event = sampleEvent();
    await adapter.ingest(event);
    await adapter.consolidate('2026-01-15T23:59:59.999Z');

    const recall = await adapter.recall(
      { text: 'harness Friday', scope: 'work' },
      event.observed_at,
      'work',
    );
    expect(recall.hits.length).toBeGreaterThan(0);

    const decide = await adapter.decide({
      scene: 'message_sidecar',
      as_of: event.observed_at,
      scope: 'work',
      context: { text: 'Did we confirm shipping the harness by Friday?' },
    });
    expect(['show_sidecar', 'silence']).toContain(decide.action);

    const exported = await adapter.export();
    expect(exported.event_count).toBe(1);

    await adapter.delete(event.event_id);
    const recallAfterDelete = await adapter.recall(
      { text: 'harness', scope: 'work' },
      event.observed_at,
      'work',
    );
    expect(recallAfterDelete.hits.some((h) => h.event_id === event.event_id)).toBe(false);

    await adapter.revoke('work');
    const recallAfterRevoke = await adapter.recall(
      { text: 'harness', scope: 'work' },
      event.observed_at,
      'work',
    );
    expect(recallAfterRevoke.hits.length).toBe(0);

    await adapter.close();
  });
});
