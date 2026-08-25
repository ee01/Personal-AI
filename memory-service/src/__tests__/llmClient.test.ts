import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Config } from '../config.js';
import { LLMClient } from '../llm/LLMClient.js';

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
});
