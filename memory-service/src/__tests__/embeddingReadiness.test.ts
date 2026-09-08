/**
 * P0a-3 tests (memory-foundation plan §11.2 item 3 / §9.6):
 * a failed provider initialization must never be cached as permanently
 * unavailable; readiness must be observable; warmup retries.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

const transformerImportState = {
  calls: 0,
  failFirst: true,
};

vi.mock('@xenova/transformers', () => ({
  pipeline: vi.fn(async () => {
    transformerImportState.calls += 1;
    if (transformerImportState.failFirst && transformerImportState.calls === 1) {
      throw new Error('model download temporarily failed');
    }
    return ((texts: string) => ({
      tolist: () => [[0.1, 0.2, 0.3]],
    })) as unknown;
  }),
}));

// Reset the EmbeddingClient singleton + module state between tests.
async function freshEmbeddingClient() {
  vi.resetModules();
  transformerImportState.calls = 0;
  const mod = await import('../llm/EmbeddingClient.js');
  return mod.EmbeddingClient as typeof import('../llm/EmbeddingClient.js').EmbeddingClient;
}

describe('EmbeddingClient readiness + retryable warmup (P0a-3)', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('does NOT cache a failed load as permanently unavailable — retries after backoff', async () => {
    transformerImportState.failFirst = true;
    const EmbeddingClient = await freshEmbeddingClient();

    // First load fails.
    await expect(EmbeddingClient.getInstance()).rejects.toThrow(
      /temporarily failed/,
    );
    const afterFail = EmbeddingClient.readiness();
    expect(afterFail.loaded).toBe(false);
    expect(afterFail.loadAttempts).toBe(1);
    expect(afterFail.lastError).toContain('temporarily failed');
    expect(afterFail.nextRetryInMs).toBeGreaterThan(0);

    // Still inside the backoff window: fails fast with the readiness error,
    // but does not replay the original rejected promise forever.
    await expect(EmbeddingClient.getInstance()).rejects.toThrow(/backoff/);

    // After the backoff window elapses, the next call retries and succeeds.
    await new Promise((resolve) => setTimeout(resolve, 50));
    const realNow = Date.now.bind(Date);
    const fakeNow = vi
      .spyOn(Date, 'now')
      .mockImplementation(() => realNow() + 60_000);
    const client = await EmbeddingClient.getInstance();
    fakeNow.mockRestore();
    expect(EmbeddingClient.isLoaded()).toBe(true);
    expect(client.embed('hello')).resolves.toHaveLength(3);

    const ready = EmbeddingClient.readiness();
    expect(ready.loaded).toBe(true);
    expect(ready.lastError).toBeNull();
    expect(ready.nextRetryInMs).toBe(0);
  });

  it('warmup retries a bounded number of times and reports final state', async () => {
    transformerImportState.failFirst = false;
    const EmbeddingClient = await freshEmbeddingClient();

    await EmbeddingClient.warmup(2);
    expect(EmbeddingClient.isLoaded()).toBe(true);
  });
});
