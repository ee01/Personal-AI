import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LLMClient } from '../llm/LLMClient.js';

describe('LLMClient', () => {
  const fetchMock = vi.fn();

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

    const client = new LLMClient({
      port: 3210,
      host: '0.0.0.0',
      dataDir: '/tmp',
      logLevel: 'info',
      llmProvider: 'dify',
      openaiApiKey: '',
      openaiModel: 'gpt-4o-mini',
      groqApiKey: '',
      difyApiKey: 'test-key',
      difyApiUrl: 'https://example.dify.ai',
      difyAppMode: 'chat',
      ollamaBaseUrl: 'http://localhost:11434',
      ollamaModel: 'llama3',
      llmRequestTimeoutMs: 30000,
      embeddingProvider: 'local',
      embeddingModel: 'Xenova/all-MiniLM-L6-v2',
      embeddingDimension: 384,
      apiKey: '',
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
    });

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

    const client = new LLMClient({
      port: 3210,
      host: '0.0.0.0',
      dataDir: '/tmp',
      logLevel: 'info',
      llmProvider: 'openai',
      openaiApiKey: 'test-key',
      openaiModel: 'gpt-4o-mini',
      groqApiKey: '',
      difyApiKey: '',
      difyApiUrl: '',
      difyAppMode: 'chat',
      ollamaBaseUrl: 'http://localhost:11434',
      ollamaModel: 'llama3',
      llmRequestTimeoutMs: 30000,
      embeddingProvider: 'local',
      embeddingModel: 'Xenova/all-MiniLM-L6-v2',
      embeddingDimension: 384,
      apiKey: '',
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
    });

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
});
