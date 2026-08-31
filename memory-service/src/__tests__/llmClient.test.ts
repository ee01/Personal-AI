import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Config } from '../config.js';
import { LLMClient } from '../llm/LLMClient.js';

const recordLlmUsageMock = vi.fn();
vi.mock('../analytics/UsageRecorder.js', () => ({
  recordLlmUsage: (...args: unknown[]) => recordLlmUsageMock(...args),
}));

describe('LLMClient', () => {
  const fetchMock = vi.fn();

  function makeConfig(overrides: Partial<Config> = {}): Config {
    return {
      port: 3210,
      host: '0.0.0.0',
      dataDir: '/tmp',
      logLevel: 'info',
      sqliteJournalMode: 'WAL',
      sqliteSynchronous: 'NORMAL',
      llmProvider: 'openai',
      openaiApiKey: 'test-key',
      openaiApiBaseUrl: '',
      openaiModel: 'gpt-4o-mini',
      claudeApiKey: '',
      claudeModel: 'claude-sonnet-4-6',
      groqApiKey: '',
      difyApiKey: '',
      difyApiUrl: '',
      difyAppMode: 'chat',
      ollamaBaseUrl: 'http://localhost:11434',
      ollamaModel: 'llama3',
      llmRequestTimeoutMs: 30000,
      llmFallbacks: [],
      llmFallbackCooldownMs: 60_000,
      llmFallbackFailureThreshold: 3,
      llmFallbackOnJsonParse: false,
      embeddingProvider: 'local',
      embeddingModel: 'Xenova/all-MiniLM-L6-v2',
      embeddingDimension: 384,
      apiKey: '',
      botApiBaseUrl: '',
      botToken: '',
      botId: '',
      botType: '',
      botTeamId: '',
      botTargetEmail: '',
      contextMatchThreshold: 0.5,
      heartbeatIntervalMs: 900000,
      dailyCron: '0 23 * * *',
      weeklyCron: '0 3 * * 0',
      quietHoursStart: 22,
      quietHoursEnd: 8,
      todayPilotPrepCron: '30 6 * * *',
      todayPilotTimezone: 'Asia/Shanghai',
      todayPilotMeetingPrepMax: 5,
      todayPilotMeetingPrepEnabled: true,
      composeAssistEnabled: true,
      ...overrides,
    };
  }

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    recordLlmUsageMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('inlines systemPrompt when using the Dify provider', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ answer: '{"answer":"ok"}' }),
    });

    const client = new LLMClient(makeConfig({
      llmProvider: 'dify',
      openaiApiKey: '',
      difyApiKey: 'test-key',
      difyApiUrl: 'https://example.dify.ai',
      difyAppMode: 'chat',
    }));

    await client.generate('What changed?', {
      systemPrompt: 'Return JSON only.',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, requestInit] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(requestInit?.body));

    expect(body.query).toContain('System instructions:');
    expect(body.query).toContain('Return JSON only.');
    expect(body.query).toContain('User request:');
    expect(body.query).toContain('What changed?');
  });

  it('aborts provider requests after the configured timeout', async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation((_url, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const err = new Error('aborted');
          err.name = 'AbortError';
          reject(err);
        });
      });
    });

    const client = new LLMClient(makeConfig({
      llmProvider: 'openai',
      openaiApiKey: 'test-key',
      openaiModel: 'gpt-4o-mini',
    }));

    const promise = client.generate('slow response', {
      timeoutMs: 1000,
      retryCount: 0,
    });
    const expectation = expect(promise).rejects.toThrow(
      '[LLMClient] Request timed out after 1000ms',
    );
    await vi.advanceTimersByTimeAsync(1000);

    await expectation;
    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBeDefined();
  });

  it('uses an OpenAI-compatible base URL when configured', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    });

    const client = new LLMClient(makeConfig({
      llmProvider: 'openai',
      openaiApiBaseUrl: 'https://oneapi.example.com',
    }));

    await client.generate('health check');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'https://oneapi.example.com/v1/chat/completions',
    );
  });

  it('accepts a full OpenAI-compatible chat completions URL', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    });

    const client = new LLMClient(makeConfig({
      llmProvider: 'openai',
      openaiApiBaseUrl: 'https://oneapi.example.com/v1/chat/completions',
    }));

    await client.generate('health check');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'https://oneapi.example.com/v1/chat/completions',
    );
  });

  it('passes reasoning effort only to GPT-5 compatible requests', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    });

    const gpt5Client = new LLMClient(makeConfig({
      llmProvider: 'openai',
      openaiModel: 'gpt-5.5',
    }));
    await gpt5Client.generate('compile prompt', {
      reasoningEffort: 'none',
    });
    const gpt5Body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(gpt5Body.reasoning_effort).toBe('none');

    const gpt4Client = new LLMClient(makeConfig({
      llmProvider: 'openai',
      openaiModel: 'gpt-4o-mini',
    }));
    await gpt4Client.generate('compile prompt', {
      reasoningEffort: 'none',
    });
    const gpt4Body = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));
    expect(gpt4Body).not.toHaveProperty('reasoning_effort');
  });

  it('omits sampling params for models that reject them', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    });

    const client = new LLMClient(makeConfig({
      llmProvider: 'openai',
      openaiModel: 'o3-mini',
    }));

    await client.generate('extract fields', { temperature: 0.2 });

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body).not.toHaveProperty('temperature');
    expect(body).not.toHaveProperty('top_p');
    expect(body).not.toHaveProperty('max_tokens');
    expect(body.max_completion_tokens).toBe(2000);
  });

  it('keeps sampling params and max_tokens for ordinary models', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    });

    const client = new LLMClient(makeConfig({
      llmProvider: 'openai',
      openaiModel: 'gpt-4o-mini',
    }));

    await client.generate('extract fields', { temperature: 0.2 });

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body.temperature).toBe(0.2);
    expect(body.max_tokens).toBe(2000);
    expect(body).not.toHaveProperty('max_completion_tokens');
  });

  it('resolves temperature from the requested scenario', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    });

    const client = new LLMClient(makeConfig({
      llmProvider: 'openai',
      openaiModel: 'gpt-4o-mini',
    }));

    await client.generate('ocr this frame', { scenario: 'extraction' });

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body.temperature).toBe(0.1);
  });

  it('calls Anthropic chat completions without a base URL for the claude provider', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    });

    const client = new LLMClient(
      makeConfig({
        llmProvider: 'claude',
        openaiApiKey: '',
        openaiApiBaseUrl: '',
        claudeApiKey: 'sk-ant-test',
        claudeModel: 'claude-sonnet-4-6',
      }),
    );

    await client.generate('hello');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'https://api.anthropic.com/v1/chat/completions',
    );
    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Record<
      string,
      string
    >;
    expect(headers['anthropic-version']).toBe('2023-06-01');
    expect(headers.Authorization).toBe('Bearer sk-ant-test');
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body.model).toBe('claude-sonnet-4-6');
  });

  describe('failure telemetry (B4/B5/B6/B7/B9)', () => {
    it('B4: records the real usage when a successful, billed response fails to parse as JSON', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'not valid json' } }],
          usage: { prompt_tokens: 42, completion_tokens: 7 },
        }),
      });

      const client = new LLMClient(
        makeConfig({ llmFallbackOnJsonParse: true }),
      );
      await expect(
        client.generateJSON('extract fields', { retryCount: 0 }),
      ).rejects.toThrow();

      const failureCall = recordLlmUsageMock.mock.calls.find(
        (call) => call[0]?.status === 'error',
      );
      expect(failureCall).toBeDefined();
      const params = failureCall![0];
      // The provider generated and billed real tokens before JSON.parse
      // failed — previously this was always recorded as 0/0.
      expect(params.promptTokens).toBe(42);
      expect(params.completionTokens).toBe(7);
      expect(params.meta.tokensEstimated).toBeUndefined();
      expect(typeof params.meta.errorText).toBe('string');
      expect(params.meta.errorText.length).toBeGreaterThan(0);
    });

    it('B4/B7: estimates tokens from prompt+content when the provider omits usage on a parse failure', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'still not json, but fairly long content' } }],
          // no `usage` field
        }),
      });

      const client = new LLMClient(
        makeConfig({ llmFallbackOnJsonParse: true }),
      );
      await expect(
        client.generateJSON('extract fields from this prompt', { retryCount: 0 }),
      ).rejects.toThrow();

      const failureCall = recordLlmUsageMock.mock.calls.find(
        (call) => call[0]?.status === 'error',
      );
      expect(failureCall).toBeDefined();
      const params = failureCall![0];
      expect(params.promptTokens).toBeGreaterThan(0);
      expect(params.completionTokens).toBeGreaterThan(0);
      expect(params.meta.tokensEstimated).toBe(true);
    });

    it('B6: estimates billed promptTokens on a client-side timeout instead of recording 0', async () => {
      vi.useFakeTimers();
      fetchMock.mockImplementation((_url, init?: RequestInit) => {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            const err = new Error('aborted');
            err.name = 'AbortError';
            reject(err);
          });
        });
      });

      const client = new LLMClient(makeConfig());
      const prompt = 'a fairly long prompt that should estimate to a few tokens';
      const promise = client.generate(prompt, { timeoutMs: 1000, retryCount: 0 });
      const expectation = expect(promise).rejects.toThrow();
      await vi.advanceTimersByTimeAsync(1000);
      await expectation;

      expect(recordLlmUsageMock).toHaveBeenCalledTimes(1);
      const params = recordLlmUsageMock.mock.calls[0][0];
      expect(params.status).toBe('error');
      expect(params.errorKind).toBe('timeout');
      expect(params.promptTokens).toBeGreaterThan(0);
      expect(params.completionTokens).toBe(0);
      expect(params.meta.billedEstimate).toBe(true);
    });

    it('B5: records each retried attempt, not just the final failure', async () => {
      let call = 0;
      fetchMock.mockImplementation(async () => {
        call += 1;
        if (call === 1) {
          return { ok: false, status: 500, text: async () => 'server error' };
        }
        return {
          ok: true,
          json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
        };
      });

      const client = new LLMClient(makeConfig());
      await client.generate('retry me', { retryCount: 1 });

      expect(recordLlmUsageMock).toHaveBeenCalledTimes(2);
      const [retryCall, successCall] = recordLlmUsageMock.mock.calls.map((c) => c[0]);
      expect(retryCall.status).toBe('error');
      expect(retryCall.meta.attempt).toBe(1);
      expect(retryCall.meta.willRetry).toBe(true);
      expect(successCall.status).toBeUndefined(); // success path omits `status`
    });

    it('B9: keeps the provider error text (truncated) for diagnosis', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => 'x'.repeat(500),
      });

      const client = new LLMClient(makeConfig());
      await expect(
        client.generate('bad request repro', { retryCount: 0 }),
      ).rejects.toThrow();

      expect(recordLlmUsageMock).toHaveBeenCalledTimes(1);
      const params = recordLlmUsageMock.mock.calls[0][0];
      expect(params.errorKind).toBe('bad_request');
      expect(params.meta.errorText.length).toBeLessThanOrEqual(200);
      expect(params.meta.errorText).toContain('xxx');
    });
  });
});
