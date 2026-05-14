import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LLMClient } from '../llm/LLMClient.js';

describe('LLMClient', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
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
});
